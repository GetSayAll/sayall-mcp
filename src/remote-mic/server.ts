import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

import { AccessDeniedError, AuthorizationStore } from "./authorization-store.js";
import { AuditLog } from "./audit-log.js";
import { TranscriptHistoryStore, type TranscriptQuery } from "./history-store.js";
import type { RemoteMicPaths } from "./paths.js";

export interface ServerCredentials {
  clientId: string;
  token: string;
}

export async function runRemoteMicHistoryServer(
  paths: RemoteMicPaths,
  credentials: ServerCredentials,
): Promise<void> {
  const authorizationStore = new AuthorizationStore(paths.accessRoot);
  const historyStore = new TranscriptHistoryStore(paths.transcriptRoot);
  const auditLog = new AuditLog(paths.accessRoot);
  const server = createRemoteMicHistoryServer(
    authorizationStore,
    historyStore,
    auditLog,
    credentials,
  );

  try {
    await authorizationStore.requireAuthorized(credentials.clientId, credentials.token);
    await auditLog.append({
      clientId: credentials.clientId,
      tool: "server_start",
      occurredAt: new Date().toISOString(),
      result: "allowed",
    });
  } catch (error) {
    await auditLog.append({
      clientId: credentials.clientId,
      tool: "server_start",
      occurredAt: new Date().toISOString(),
      result: "denied",
      reasonCode: errorCode(error),
    });
    throw error;
  }

  const transport = new StdioServerTransport(process.stdin, process.stdout, {
    maxBufferSize: 1024 * 1024,
  });
  await server.connect(transport);
  console.error("SayAll Remote Mic history MCP server is running on stdio.");
}

export function createRemoteMicHistoryServer(
  authorizationStore: AuthorizationStore,
  historyStore: TranscriptHistoryStore,
  auditLog: AuditLog,
  credentials: ServerCredentials,
): McpServer {
  const server = new McpServer({
    name: "sayall-remote-mic-history",
    version: "0.1.0",
  });

  server.registerTool(
    "list_transcript_apps",
    {
      title: "List Remote Mic transcript applications",
      description:
        "List applications represented in the user's local Remote Mic voice transcript history. Does not return transcript text.",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const occurredAt = new Date().toISOString();
      try {
        await authorizationStore.requireAuthorized(credentials.clientId, credentials.token);
        const result = await historyStore.listApplications();
        await auditLog.append({
          clientId: credentials.clientId,
          tool: "list_transcript_apps",
          occurredAt,
          result: "allowed",
          returnedRecordCount: result.applications.reduce(
            (total, application) => total + application.recordCount,
            0,
          ),
        });
        return toolSuccess(result);
      } catch (error) {
        await writeToolFailureAudit(auditLog, credentials.clientId, "list_transcript_apps", occurredAt, error);
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "query_transcripts",
    {
      title: "Query Remote Mic transcripts",
      description:
        "Read authorized local Remote Mic transcript records with optional time and application filters. Results are paginated.",
      inputSchema: {
        startedAtOrAfter: z.iso.datetime().optional(),
        endedAtBefore: z.iso.datetime().optional(),
        bundleIdentifiers: z.array(z.string().min(1).max(500)).max(100).optional(),
        order: z.enum(["ascending", "descending"]).optional(),
        limit: z.number().int().min(1).max(500).optional(),
        cursor: z.string().max(2_048).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (query) => {
      const occurredAt = new Date().toISOString();
      const normalizedQuery: TranscriptQuery = {
        startedAtOrAfter: query.startedAtOrAfter,
        endedAtBefore: query.endedAtBefore,
        bundleIdentifiers: query.bundleIdentifiers,
        order: query.order,
        limit: query.limit,
        cursor: query.cursor,
      };
      try {
        await authorizationStore.requireAuthorized(credentials.clientId, credentials.token);
        const result = await historyStore.query(normalizedQuery);
        await auditLog.append({
          clientId: credentials.clientId,
          tool: "query_transcripts",
          occurredAt,
          result: "allowed",
          returnedRecordCount: result.records.length,
          startedAtOrAfter: normalizedQuery.startedAtOrAfter,
          endedAtBefore: normalizedQuery.endedAtBefore,
          bundleIdentifierCount: normalizedQuery.bundleIdentifiers?.length ?? 0,
        });
        return toolSuccess(result);
      } catch (error) {
        await writeToolFailureAudit(
          auditLog,
          credentials.clientId,
          "query_transcripts",
          occurredAt,
          error,
          normalizedQuery,
        );
        return toolFailure(error);
      }
    },
  );

  return server;
}

function toolSuccess(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function toolFailure(error: unknown) {
  const code = errorCode(error);
  const message = error instanceof AccessDeniedError ? error.message : "The local history request failed.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ code, message }) }],
  };
}

async function writeToolFailureAudit(
  auditLog: AuditLog,
  clientId: string,
  tool: "list_transcript_apps" | "query_transcripts",
  occurredAt: string,
  error: unknown,
  query?: TranscriptQuery,
): Promise<void> {
  await auditLog.append({
    clientId,
    tool,
    occurredAt,
    result: error instanceof AccessDeniedError ? "denied" : "error",
    reasonCode: errorCode(error),
    startedAtOrAfter: query?.startedAtOrAfter,
    endedAtBefore: query?.endedAtBefore,
    bundleIdentifierCount: query?.bundleIdentifiers?.length ?? 0,
  });
}

function errorCode(error: unknown): string {
  if (error instanceof AccessDeniedError) {
    return error.code;
  }
  return "request_failed";
}
