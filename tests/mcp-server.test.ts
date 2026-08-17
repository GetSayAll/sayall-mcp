import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

import { AuditLog } from "../src/remote-mic/audit-log.js";
import { AuthorizationStore } from "../src/remote-mic/authorization-store.js";
import { TranscriptHistoryStore } from "../src/remote-mic/history-store.js";
import { createRemoteMicHistoryServer } from "../src/remote-mic/server.js";
import { createTestPaths, fixtureRecord, writeTranscriptDay } from "./test-fixtures.js";

describe("Remote Mic MCP server", () => {
  it("exposes only two read-only tools and rechecks revocation", async () => {
    const paths = await createTestPaths("mcp-server");
    const sensitiveText = "MCP 集成测试正文";
    await writeTranscriptDay(paths.transcriptRoot, [fixtureRecord({ text: sensitiveText })]);
    const authorizationStore = new AuthorizationStore(paths.accessRoot);
    await authorizationStore.setEnabled(true);
    const authorization = await authorizationStore.createAuthorization("Codex");
    const server = createRemoteMicHistoryServer(
      authorizationStore,
      new TranscriptHistoryStore(paths.transcriptRoot),
      new AuditLog(paths.accessRoot),
      { clientId: authorization.clientId, token: authorization.token },
    );
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    const applicationResult = await client.callTool({ name: "list_transcript_apps", arguments: {} });
    const queryResult = await client.callTool({ name: "query_transcripts", arguments: {} });

    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "list_transcript_apps",
      "query_transcripts",
    ]);
    for (const tool of tools.tools) {
      expect(tool.outputSchema).toMatchObject({ type: "object" });
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
    expect(applicationResult.isError).not.toBe(true);
    expect(JSON.stringify(applicationResult)).not.toContain(sensitiveText);
    expect(queryResult.isError).not.toBe(true);
    expect(JSON.stringify(queryResult)).toContain(sensitiveText);

    await authorizationStore.revokeAuthorization(authorization.clientId);
    const revokedResult = await client.callTool({ name: "query_transcripts", arguments: {} });
    expect(revokedResult.isError).toBe(true);
    expect(JSON.stringify(revokedResult)).toContain("authorization_unavailable");

    const auditFile = path.join(paths.accessRoot, "audit", `${new Date().toISOString().slice(0, 10)}.ndjson`);
    const auditContent = await readFile(auditFile, "utf8");
    expect(auditContent).not.toContain(sensitiveText);
    expect(auditContent).not.toContain(authorization.token);

    await client.close();
    await server.close();
  });
});
