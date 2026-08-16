import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as z from "zod/v4";

import { appendPrivateLine } from "./paths.js";

const MAX_CLIENT_NAME_LENGTH = 100;

const settingEventSchema = z.object({
  schemaVersion: z.literal(1),
  type: z.literal("access_changed"),
  enabled: z.boolean(),
  changedAt: z.iso.datetime(),
});

const authorizationCreatedSchema = z.object({
  schemaVersion: z.literal(1),
  type: z.literal("authorization_created"),
  clientId: z.uuid(),
  displayName: z.string().min(1).max(MAX_CLIENT_NAME_LENGTH),
  scope: z.literal("transcripts.read.all"),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(),
});

const authorizationRevokedSchema = z.object({
  schemaVersion: z.literal(1),
  type: z.literal("authorization_revoked"),
  clientId: z.uuid(),
  revokedAt: z.iso.datetime(),
});

const authorizationEventSchema = z.discriminatedUnion("type", [
  authorizationCreatedSchema,
  authorizationRevokedSchema,
]);

type AuthorizationEvent = z.infer<typeof authorizationEventSchema>;

export interface AuthorizationRecord {
  clientId: string;
  displayName: string;
  scope: "transcripts.read.all";
  tokenHash: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreatedAuthorization {
  clientId: string;
  displayName: string;
  scope: "transcripts.read.all";
  token: string;
  createdAt: string;
}

export class AccessDeniedError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AccessDeniedError";
    this.code = code;
  }
}

export class AuthorizationStore {
  private readonly settingsFile: string;
  private readonly authorizationsFile: string;

  constructor(private readonly accessRoot: string) {
    this.settingsFile = path.join(accessRoot, "settings.ndjson");
    this.authorizationsFile = path.join(accessRoot, "authorizations.ndjson");
  }

  async isEnabled(): Promise<boolean> {
    const events = await readEventLines(this.settingsFile, settingEventSchema);
    return events.at(-1)?.enabled ?? false;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await appendPrivateEvent(this.accessRoot, this.settingsFile, {
      schemaVersion: 1,
      type: "access_changed",
      enabled,
      changedAt: new Date().toISOString(),
    });
  }

  async createAuthorization(displayName: string): Promise<CreatedAuthorization> {
    if (!(await this.isEnabled())) {
      throw new AccessDeniedError(
        "access_disabled",
        "Local Agent access is disabled. Enable it before creating an authorization.",
      );
    }

    const normalizedName = displayName.trim();
    if (normalizedName.length === 0 || normalizedName.length > MAX_CLIENT_NAME_LENGTH) {
      throw new Error(`Client name must contain 1-${MAX_CLIENT_NAME_LENGTH} characters.`);
    }

    const clientId = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const createdAt = new Date().toISOString();
    await appendPrivateEvent(this.accessRoot, this.authorizationsFile, {
      schemaVersion: 1,
      type: "authorization_created",
      clientId,
      displayName: normalizedName,
      scope: "transcripts.read.all",
      tokenHash: hashToken(token),
      createdAt,
    });

    return {
      clientId,
      displayName: normalizedName,
      scope: "transcripts.read.all",
      token,
      createdAt,
    };
  }

  async revokeAuthorization(clientId: string): Promise<void> {
    const normalizedClientId = z.uuid().parse(clientId);
    const authorization = (await this.listAuthorizations()).find(
      (candidate) => candidate.clientId === normalizedClientId,
    );
    if (!authorization) {
      throw new Error("Authorization was not found.");
    }
    if (authorization.revokedAt) {
      return;
    }

    await appendPrivateEvent(this.accessRoot, this.authorizationsFile, {
      schemaVersion: 1,
      type: "authorization_revoked",
      clientId: normalizedClientId,
      revokedAt: new Date().toISOString(),
    });
  }

  async listAuthorizations(): Promise<AuthorizationRecord[]> {
    const events = await readEventLines(this.authorizationsFile, authorizationEventSchema);
    const records = new Map<string, AuthorizationRecord>();

    for (const event of events) {
      if (event.type === "authorization_created") {
        if (records.has(event.clientId)) {
          throw new Error("Authorization log contains a duplicate client identifier.");
        }
        records.set(event.clientId, {
          clientId: event.clientId,
          displayName: event.displayName,
          scope: event.scope,
          tokenHash: event.tokenHash,
          createdAt: event.createdAt,
          revokedAt: null,
        });
      } else {
        const record = records.get(event.clientId);
        if (!record) {
          throw new Error("Authorization log contains a revocation without a matching client.");
        }
        record.revokedAt = event.revokedAt;
      }
    }

    return [...records.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async requireAuthorized(clientId: string, token: string): Promise<AuthorizationRecord> {
    if (!(await this.isEnabled())) {
      throw new AccessDeniedError("access_disabled", "Local Agent access is disabled.");
    }

    const parsedClientId = z.uuid().safeParse(clientId);
    if (!parsedClientId.success || token.length < 32 || token.length > 256) {
      throw new AccessDeniedError("invalid_credentials", "Client credentials are invalid.");
    }

    const record = (await this.listAuthorizations()).find(
      (candidate) => candidate.clientId === parsedClientId.data,
    );
    if (!record || record.revokedAt) {
      throw new AccessDeniedError("authorization_unavailable", "Authorization is unavailable.");
    }

    const providedHash = Buffer.from(hashToken(token), "hex");
    const storedHash = Buffer.from(record.tokenHash, "hex");
    if (providedHash.length !== storedHash.length || !timingSafeEqual(providedHash, storedHash)) {
      throw new AccessDeniedError("invalid_credentials", "Client credentials are invalid.");
    }

    return record;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

async function appendPrivateEvent(
  directory: string,
  file: string,
  event: Record<string, unknown>,
): Promise<void> {
  await appendPrivateLine(directory, file, JSON.stringify(event));
}

async function readEventLines<T extends z.ZodType>(
  file: string,
  schema: T,
): Promise<z.output<T>[]> {
  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return content
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line, index) => {
      try {
        return schema.parse(JSON.parse(line));
      } catch {
        throw new Error(`Authorization event log is invalid at line ${index + 1}.`);
      }
    });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
