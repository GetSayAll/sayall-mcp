import path from "node:path";

import { appendPrivateLine } from "./paths.js";

export interface AuditEvent {
  clientId: string;
  tool: "list_transcript_apps" | "query_transcripts" | "server_start";
  occurredAt: string;
  result: "allowed" | "denied" | "error";
  returnedRecordCount?: number | undefined;
  startedAtOrAfter?: string | undefined;
  endedAtBefore?: string | undefined;
  bundleIdentifierCount?: number | undefined;
  reasonCode?: string | undefined;
}

export class AuditLog {
  private readonly auditDirectory: string;

  constructor(accessRoot: string) {
    this.auditDirectory = path.join(accessRoot, "audit");
  }

  async append(event: AuditEvent): Promise<void> {
    const dateKey = event.occurredAt.slice(0, 10);
    const file = path.join(this.auditDirectory, `${dateKey}.ndjson`);
    await appendPrivateLine(this.auditDirectory, file, JSON.stringify(event));
  }
}
