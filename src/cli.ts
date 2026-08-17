#!/usr/bin/env node

import { fileURLToPath } from "node:url";

import { AuthorizationStore } from "./remote-mic/authorization-store.js";
import {
  createMCPIntegrationOutput,
  formatMCPIntegrationOutput,
} from "./remote-mic/integration-config.js";
import { defaultRemoteMicPaths } from "./remote-mic/paths.js";
import { runRemoteMicHistoryServer } from "./remote-mic/server.js";

const CLIENT_ID_ENV = "SAYALL_MCP_CLIENT_ID";
const ACCESS_TOKEN_ENV = "SAYALL_MCP_ACCESS_TOKEN";

async function main(): Promise<void> {
  const cliArguments = process.argv.slice(2);
  const usesLegacyDomain = cliArguments[0] === "remote-mic";
  const command = usesLegacyDomain ? cliArguments[1] : cliArguments[0];
  const argumentsList = usesLegacyDomain ? cliArguments.slice(2) : cliArguments.slice(1);
  if (!command) {
    printUsageAndExit();
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printUsageAndExit(0);
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
      printJSON(
        createMCPIntegrationOutput(
          authorization,
          process.execPath,
          fileURLToPath(import.meta.url),
        ),
      );
      return;
    }
    case "setup": {
      const displayName = argumentsList.includes("--name")
        ? requiredOption(argumentsList, "--name")
        : "Local AI Client";
      const authorization = await authorizationStore.setupAuthorization(displayName);
      const output = createMCPIntegrationOutput(
        authorization,
        process.execPath,
        fileURLToPath(import.meta.url),
      );
      if (argumentsList.includes("--json")) {
        printJSON(output);
      } else {
        process.stdout.write(formatMCPIntegrationOutput(output));
      }
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
  const value = optionalOption(argumentsList, name);
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required option ${name}.`);
  }
  return value;
}

function optionalOption(argumentsList: string[], name: string): string | undefined {
  const index = argumentsList.indexOf(name);
  const value = index >= 0 ? argumentsList[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function printJSON(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printUsageAndExit(exitCode = 2): never {
  process.stderr.write(
    [
      "Usage:",
      "  sayall-mcp setup [--name <client-name>] [--json]",
      "  sayall-mcp status",
      "  sayall-mcp list",
      "  sayall-mcp revoke --client-id <uuid>",
      "  sayall-mcp enable",
      "  sayall-mcp disable",
      "  sayall-mcp authorize --name <client-name>",
      "  sayall-mcp serve",
      "",
      "Legacy 'sayall-mcp remote-mic <command>' syntax remains supported.",
    ].join("\n") + "\n",
  );
  process.exit(exitCode);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  process.stderr.write(`sayall-mcp: ${message}\n`);
  process.exit(1);
});
