import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { RemoteMicPaths } from "../src/remote-mic/paths.js";

const APPLE_REFERENCE_TO_UNIX_SECONDS = 978_307_200;

export interface FixtureRecord {
  id: string;
  sessionID: string;
  startedAt: string;
  endedAt: string;
  applicationName: string;
  bundleIdentifier: string;
  applicationKey: string;
  localDateKey: string;
  text: string;
  source?: string;
  timeZoneIdentifier?: string;
}

export async function createTestPaths(label: string): Promise<RemoteMicPaths> {
  const identifier = `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const root = path.join(os.tmpdir(), "sayall-mcp-tests", identifier);
  return {
    transcriptRoot: path.join(root, "Transcripts", "v1"),
    accessRoot: path.join(root, "AgentAccess", "v1"),
  };
}

export async function writeTranscriptDay(
  transcriptRoot: string,
  records: FixtureRecord[],
): Promise<string> {
  const first = records[0];
  if (!first) {
    throw new Error("A fixture day requires at least one record.");
  }
  const applicationDirectory = path.join(transcriptRoot, first.applicationKey);
  await mkdir(applicationDirectory, { recursive: true, mode: 0o700 });
  const file = path.join(applicationDirectory, `${first.localDateKey}.json`);
  const dayFile = {
    formatVersion: 1,
    applicationKey: first.applicationKey,
    applicationName: first.applicationName,
    bundleIdentifier: first.bundleIdentifier,
    localDateKey: first.localDateKey,
    records: records.map((record) => ({
      schemaVersion: 1,
      id: record.id,
      sessionID: record.sessionID,
      startedAt: isoToAppleDate(record.startedAt),
      endedAt: isoToAppleDate(record.endedAt),
      localDateKey: record.localDateKey,
      timeZoneIdentifier: record.timeZoneIdentifier ?? "Asia/Shanghai",
      applicationKey: record.applicationKey,
      applicationName: record.applicationName,
      bundleIdentifier: record.bundleIdentifier,
      source: record.source ?? "bluetoothRemote",
      originalTranscript: record.text,
      captureMethodVersion: 1,
    })),
  };
  await writeFile(file, JSON.stringify(dayFile), { encoding: "utf8", mode: 0o600 });
  return file;
}

export function fixtureRecord(overrides: Partial<FixtureRecord> = {}): FixtureRecord {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    sessionID: "20000000-0000-4000-8000-000000000001",
    startedAt: "2026-08-17T02:30:20.000Z",
    endedAt: "2026-08-17T02:30:30.000Z",
    applicationName: "Codex",
    bundleIdentifier: "com.openai.codex",
    applicationKey: "com.openai.codex-9c3380ef6e22570f",
    localDateKey: "2026-08-17",
    text: "测试语音历史",
    ...overrides,
  };
}

function isoToAppleDate(value: string): number {
  return Date.parse(value) / 1_000 - APPLE_REFERENCE_TO_UNIX_SECONDS;
}
