import { describe, expect, it } from "vitest";

import { createMCPIntegrationOutput } from "../src/remote-mic/integration-config.js";

describe("MCP integration configuration", () => {
  it("returns ready-to-copy generic and Codex configurations", () => {
    const output = createMCPIntegrationOutput(
      {
        clientId: "10000000-0000-4000-8000-000000000001",
        displayName: "Codex",
        scope: "transcripts.read.all",
        token: "test-token-without-real-credentials",
        createdAt: "2026-08-17T01:00:00.000Z",
      },
      "/usr/local/bin/node",
      "/Applications/SayAll MCP/dist/cli.js",
    );

    expect(output.mcpConfig.args).toEqual([
      "/Applications/SayAll MCP/dist/cli.js",
      "remote-mic",
      "serve",
    ]);
    expect(output.codexToml).toContain("[mcp_servers.sayall_remote_mic_history]");
    expect(output.codexToml).toContain('command = "/usr/local/bin/node"');
    expect(output.codexToml).toContain("SAYALL_MCP_CLIENT_ID");
    expect(output.codexToml).toContain("SAYALL_MCP_ACCESS_TOKEN");
  });
});
