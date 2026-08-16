#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { AuthorizationStore } from "./remote-mic/authorization-store.js";
import { defaultRemoteMicPaths } from "./remote-mic/paths.js";
import { runRemoteMicHistoryServer } from "./remote-mic/server.js";

const CLIENT_ID_ENV = "SAYALL_MCP_CLIENT_ID";
const ACCESS_TOKEN_ENV = "SAYALL_MCP_ACCESS_TOKEN";

async function main(): Promise<void> {
  const [domain, command, ...argumentsList] = process.argv.slice(2);
  if (domain !== "remote-mic" || !command) {
    printUsageAndExit();
  }

  const paths = defaultRemoteMicPaths();
  const authorizationStore = new AuthorizationStore(paths.accessRoot);

  switch (command) {
    case "enable":
      await authorizationStore.setEnabled(true);
      printJSON({ enabled: true });
      return;
    case "disable":
      await authorizationStore.setEnabled(false);
      printJSON({ enabled: false });
      return;
    case "status":
      printJSON({
        enabled: await authorizationStore.isEnabled(),
        authorizations: (await authorizationStore.listAuthorizations()).map(publicAuthorization),
      });
      return;
    case "authorize": {
      const displayName = requiredOption(argumentsList, "--name");
      const authorization = await authorizationStore.createAuthorization(displayName);
      const cliPath = fileURLToPath(import.meta.url);
      printJSON({
        authorization,
        mcpConfig: {
          command: process.execPath,
          args: [cliPath, "remote-mic", "serve"],
          env: {
            [CLIENT_ID_ENV]: authorization.clientId,
            [ACCESS_TOKEN_ENV]: authorization.token,
          },
        },
        warning:
          "Remote Mic and SayAll MCP do not upload transcripts. The authorized AI client may send returned text to its own provider.",
      });
      return;
    }
    case "revoke":
      await authorizationStore.revokeAuthorization(requiredOption(argumentsList, "--client-id"));
      printJSON({ revoked: true });
      return;
    case "list":
      printJSON({
        authorizations: (await authorizationStore.listAuthorizations()).map(publicAuthorization),
      });
      return;
    case "serve": {
      const clientId = process.env[CLIENT_ID_ENV] ?? "";
      const token = process.env[ACCESS_TOKEN_ENV] ?? "";
      await runRemoteMicHistoryServer(paths, { clientId, token });
      return;
    }
    default:
      printUsageAndExit();
  }
}

function publicAuthorization(authorization: {
  clientId: string;
  displayName: string;
  scope: string;
  createdAt: string;
  revokedAt: string | null;
}) {
  return {
    clientId: authorization.clientId,
    displayName: authorization.displayName,
    scope: authorization.scope,
    createdAt: authorization.createdAt,
    revokedAt: authorization.revokedAt,
  };
}

function requiredOption(argumentsList: string[], name: string): string {
  const index = argumentsList.indexOf(name);
  const value = index >= 0 ? argumentsList[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required option ${name}.`);
  }
  return value;
}

function printJSON(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printUsageAndExit(): never {
  process.stderr.write(
    [
      "Usage:",
      "  sayall-mcp remote-mic enable",
      "  sayall-mcp remote-mic disable",
      "  sayall-mcp remote-mic status",
      "  sayall-mcp remote-mic authorize --name <client-name>",
      "  sayall-mcp remote-mic revoke --client-id <uuid>",
      "  sayall-mcp remote-mic list",
      "  sayall-mcp remote-mic serve",
    ].join("\n") + "\n",
  );
  process.exit(2);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`sayall-mcp: ${message}\n`);
  process.exit(1);
});
