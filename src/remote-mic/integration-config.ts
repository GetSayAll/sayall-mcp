import type { CreatedAuthorization } from "./authorization-store.js";

const CLIENT_ID_ENV = "SAYALL_MCP_CLIENT_ID";
const ACCESS_TOKEN_ENV = "SAYALL_MCP_ACCESS_TOKEN";

export interface MCPIntegrationOutput {
  authorization: CreatedAuthorization;
  mcpConfig: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
  standardJson: string;
  codexToml: string;
  warning: string;
}

export function createMCPIntegrationOutput(
  authorization: CreatedAuthorization,
  nodeExecutable: string,
  cliPath: string,
): MCPIntegrationOutput {
  const mcpConfig = {
    command: nodeExecutable,
    args: [cliPath, "serve"],
    env: {
      [CLIENT_ID_ENV]: authorization.clientId,
      [ACCESS_TOKEN_ENV]: authorization.token,
    },
  };

  return {
    authorization,
    mcpConfig,
    standardJson: JSON.stringify(
      {
        mcpServers: {
          sayall_history: mcpConfig,
        },
      },
      null,
      2,
    ),
    codexToml: [
      "[mcp_servers.sayall_history]",
      `command = ${tomlString(mcpConfig.command)}`,
      `args = [${mcpConfig.args.map(tomlString).join(", ")}]`,
      `env = { ${CLIENT_ID_ENV} = ${tomlString(authorization.clientId)}, ${ACCESS_TOKEN_ENV} = ${tomlString(authorization.token)} }`,
    ].join("\n"),
    warning:
      "无线麦SayAll.app and this MCP server do not upload transcripts. The authorized AI client may send returned text to its own provider.",
  };
}

export function formatMCPIntegrationOutput(output: MCPIntegrationOutput): string {
  return [
    `Created read-only authorization for: ${output.authorization.displayName}`,
    `Client ID: ${output.authorization.clientId}`,
    "",
    "Standard MCP JSON (Claude Desktop, Cursor, Windsurf, and compatible hosts):",
    output.standardJson,
    "",
    "Codex TOML:",
    output.codexToml,
    "",
    `Privacy notice: ${output.warning}`,
    "",
  ].join("\n");
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}
