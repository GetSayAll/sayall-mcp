import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";

const APPLE_REFERENCE_TO_UNIX_SECONDS = 978_307_200;
const MAX_DAY_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARACTERS = 8_000;
const SAFE_APPLICATION_KEY = /^[\p{L}\p{N}._-]+$/u;
const LOCAL_DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const transcriptRecordSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.uuid(),
  sessionID: z.uuid(),
  startedAt: z.number().finite(),
  endedAt: z.number().finite(),
  localDateKey: z.string().regex(LOCAL_DATE_KEY),
  timeZoneIdentifier: z.string().min(1).max(200),
  applicationKey: z.string().min(1).max(200).regex(SAFE_APPLICATION_KEY),
  applicationName: z.string().max(500),
  bundleIdentifier: z.string().max(500),
  source: z.string().min(1).max(100),
  originalTranscript: z.string().min(1).max(MAX_TRANSCRIPT_CHARACTERS),
  captureMethodVersion: z.number().int().positive(),
});

const transcriptDayFileSchema = z.object({
  formatVersion: z.literal(1),
  applicationKey: z.string().min(1).max(200).regex(SAFE_APPLICATION_KEY),
  applicationName: z.string().max(500),
  bundleIdentifier: z.string().max(500),
  localDateKey: z.string().regex(LOCAL_DATE_KEY),
  records: z.array(transcriptRecordSchema),
});

type StoredTranscriptRecord = z.infer<typeof transcriptRecordSchema>;

export interface TranscriptAgentRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  localDateKey: string;
  timeZoneIdentifier: string;
  applicationName: string;
  bundleIdentifier: string;
  source: string;
  text: string;
}

export interface TranscriptApplicationSummary {
  applicationName: string;
  bundleIdentifier: string;
  recordCount: number;
  earliestEndedAt: string;
  latestEndedAt: string;
}

export interface TranscriptQuery {
  startedAtOrAfter?: string | undefined;
  endedAtBefore?: string | undefined;
  bundleIdentifiers?: string[] | undefined;
  order?: "ascending" | "descending" | undefined;
  limit?: number | undefined;
  cursor?: string | undefined;
}

export interface TranscriptQueryPage {
  records: TranscriptAgentRecord[];
  nextCursor: string | null;
  hasMore: boolean;
  skippedFileCount: number;
}

interface LoadedHistory {
  records: StoredTranscriptRecord[];
  skippedFileCount: number;
}

interface CursorPayload {
  v: 1;
  endedAt: number;
  id: string;
  order: "ascending" | "descending";
}

export class TranscriptHistoryStore {
  constructor(private readonly transcriptRoot: string) {}

  async listApplications(): Promise<{
    applications: TranscriptApplicationSummary[];
    skippedFileCount: number;
  }> {
    const loaded = await this.loadAllRecords();
    const groups = new Map<
      string,
      {
        applicationName: string;
        bundleIdentifier: string;
        count: number;
        earliest: number;
        latest: number;
      }
    >();

    for (const record of loaded.records) {
      const key = record.bundleIdentifier || record.applicationKey;
      const group = groups.get(key);
      if (!group) {
        groups.set(key, {
          applicationName: record.applicationName,
          bundleIdentifier: record.bundleIdentifier,
          count: 1,
          earliest: record.endedAt,
          latest: record.endedAt,
        });
      } else {
        group.count += 1;
        group.earliest = Math.min(group.earliest, record.endedAt);
        group.latest = Math.max(group.latest, record.endedAt);
      }
    }

    const applications = [...groups.values()]
      .map((group) => ({
        applicationName: group.applicationName,
        bundleIdentifier: group.bundleIdentifier,
        recordCount: group.count,
        earliestEndedAt: appleDateToISOString(group.earliest),
        latestEndedAt: appleDateToISOString(group.latest),
      }))
      .sort((left, right) => {
        const latestComparison = right.latestEndedAt.localeCompare(left.latestEndedAt);
        return latestComparison !== 0
          ? latestComparison
          : left.applicationName.localeCompare(right.applicationName);
      });

    return { applications, skippedFileCount: loaded.skippedFileCount };
  }

  async query(query: TranscriptQuery): Promise<TranscriptQueryPage> {
    const order = query.order ?? "descending";
    const limit = query.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("limit must be an integer between 1 and 500.");
    }

    const startedAtOrAfter = parseOptionalISODate(query.startedAtOrAfter, "startedAtOrAfter");
    const endedAtBefore = parseOptionalISODate(query.endedAtBefore, "endedAtBefore");
    if (
      startedAtOrAfter !== undefined &&
      endedAtBefore !== undefined &&
      startedAtOrAfter >= endedAtBefore
    ) {
      throw new Error("startedAtOrAfter must be earlier than endedAtBefore.");
    }

    const bundleIdentifiers = normalizeBundleIdentifiers(query.bundleIdentifiers);
    const cursor = query.cursor ? decodeCursor(query.cursor, order) : undefined;
    const loaded = await this.loadAllRecords();
    const filtered = loaded.records.filter((record) => {
      if (startedAtOrAfter !== undefined && appleDateToUnixMilliseconds(record.startedAt) < startedAtOrAfter) {
        return false;
      }
      if (endedAtBefore !== undefined && appleDateToUnixMilliseconds(record.endedAt) >= endedAtBefore) {
        return false;
      }
      if (bundleIdentifiers && !bundleIdentifiers.has(record.bundleIdentifier)) {
        return false;
      }
      if (cursor) {
        const comparison = compareRecordToCursor(record, cursor);
        return order === "ascending" ? comparison > 0 : comparison < 0;
      }
      return true;
    });

    filtered.sort((left, right) => {
      const comparison = compareStoredRecords(left, right);
      return order === "ascending" ? comparison : -comparison;
    });

    const selected = filtered.slice(0, limit);
    const hasMore = filtered.length > selected.length;
    const lastRecord = selected.at(-1);

    return {
      records: selected.map(toAgentRecord),
      nextCursor: hasMore && lastRecord ? encodeCursor(lastRecord, order) : null,
      hasMore,
      skippedFileCount: loaded.skippedFileCount,
    };
  }

  private async loadAllRecords(): Promise<LoadedHistory> {
    try {
      const rootMetadata = await lstat(this.transcriptRoot);
      if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
        throw new Error("Transcript root must be a regular directory.");
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { records: [], skippedFileCount: 0 };
      }
      throw error;
    }

    let applicationEntries;
    try {
      applicationEntries = await readdir(this.transcriptRoot, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return { records: [], skippedFileCount: 0 };
      }
      throw error;
    }

    const records: StoredTranscriptRecord[] = [];
    let skippedFileCount = 0;

    for (const applicationEntry of applicationEntries) {
      if (
        !applicationEntry.isDirectory() ||
        applicationEntry.isSymbolicLink() ||
        !SAFE_APPLICATION_KEY.test(applicationEntry.name)
      ) {
        continue;
      }

      const applicationDirectory = path.join(this.transcriptRoot, applicationEntry.name);
      let fileEntries;
      try {
        fileEntries = await readdir(applicationDirectory, { withFileTypes: true });
      } catch {
        skippedFileCount += 1;
        continue;
      }

      for (const fileEntry of fileEntries) {
        const localDateKey = path.basename(fileEntry.name, ".json");
        if (
          !fileEntry.isFile() ||
          fileEntry.isSymbolicLink() ||
          path.extname(fileEntry.name) !== ".json" ||
          !LOCAL_DATE_KEY.test(localDateKey)
        ) {
          continue;
        }

        const file = path.join(applicationDirectory, fileEntry.name);
        try {
          const metadata = await lstat(file);
          if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_DAY_FILE_BYTES) {
            skippedFileCount += 1;
            continue;
          }
          const dayFile = transcriptDayFileSchema.parse(JSON.parse(await readFile(file, "utf8")));
          if (
            dayFile.applicationKey !== applicationEntry.name ||
            dayFile.localDateKey !== localDateKey ||
            dayFile.records.some(
              (record) =>
                record.applicationKey !== dayFile.applicationKey ||
                record.localDateKey !== dayFile.localDateKey,
            )
          ) {
            skippedFileCount += 1;
            continue;
          }
          records.push(...dayFile.records);
        } catch {
          skippedFileCount += 1;
        }
      }
    }

    return { records, skippedFileCount };
  }
}

function toAgentRecord(record: StoredTranscriptRecord): TranscriptAgentRecord {
  return {
    id: record.id,
    startedAt: appleDateToISOString(record.startedAt),
    endedAt: appleDateToISOString(record.endedAt),
    localDateKey: record.localDateKey,
    timeZoneIdentifier: record.timeZoneIdentifier,
    applicationName: record.applicationName,
    bundleIdentifier: record.bundleIdentifier,
    source: record.source,
    text: record.originalTranscript,
  };
}

function compareStoredRecords(left: StoredTranscriptRecord, right: StoredTranscriptRecord): number {
  const endedAtComparison = left.endedAt - right.endedAt;
  return endedAtComparison !== 0 ? endedAtComparison : left.id.localeCompare(right.id);
}

function compareRecordToCursor(record: StoredTranscriptRecord, cursor: CursorPayload): number {
  const endedAtComparison = record.endedAt - cursor.endedAt;
  return endedAtComparison !== 0 ? endedAtComparison : record.id.localeCompare(cursor.id);
}

function encodeCursor(
  record: StoredTranscriptRecord,
  order: "ascending" | "descending",
): string {
  const cursor: CursorPayload = { v: 1, endedAt: record.endedAt, id: record.id, order };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(
  encoded: string,
  order: "ascending" | "descending",
): CursorPayload {
  if (encoded.length > 2_048) {
    throw new Error("cursor is too long.");
  }
  try {
    const parsed = z
      .object({
        v: z.literal(1),
        endedAt: z.number().finite(),
        id: z.uuid(),
        order: z.enum(["ascending", "descending"]),
      })
      .parse(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")));
    if (parsed.order !== order) {
      throw new Error("cursor order does not match the query order.");
    }
    return parsed;
  } catch (error) {
    if (error instanceof Error && error.message === "cursor order does not match the query order.") {
      throw error;
    }
    throw new Error("cursor is invalid.");
  }
}

function normalizeBundleIdentifiers(values: string[] | undefined): Set<string> | undefined {
  if (!values || values.length === 0) {
    return undefined;
  }
  if (values.length > 100) {
    throw new Error("bundleIdentifiers cannot contain more than 100 values.");
  }
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0 || value.length > 500)) {
    throw new Error("bundleIdentifiers contains an invalid value.");
  }
  return new Set(normalized);
}

function parseOptionalISODate(value: string | undefined, field: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${field} must be a valid ISO-8601 date-time.`);
  }
  return milliseconds;
}

function appleDateToUnixMilliseconds(value: number): number {
  return (value + APPLE_REFERENCE_TO_UNIX_SECONDS) * 1_000;
}

function appleDateToISOString(value: number): string {
  const date = new Date(appleDateToUnixMilliseconds(value));
  if (!Number.isFinite(date.getTime())) {
    throw new Error("Transcript contains an invalid timestamp.");
  }
  return date.toISOString();
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
