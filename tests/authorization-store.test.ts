import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AccessDeniedError,
  AuthorizationStore,
} from "../src/remote-mic/authorization-store.js";
import { createTestPaths } from "./test-fixtures.js";

describe("AuthorizationStore", () => {
  it("defaults off and rejects authorization creation", async () => {
    const paths = await createTestPaths("auth-default-off");
    const store = new AuthorizationStore(paths.accessRoot);

    expect(await store.isEnabled()).toBe(false);
    await expect(store.createAuthorization("Codex")).rejects.toMatchObject({
      code: "access_disabled",
    });
  });

  it("creates a private per-client authorization and stores only its hash", async () => {
    const paths = await createTestPaths("auth-create");
    const store = new AuthorizationStore(paths.accessRoot);
    await store.setEnabled(true);

    const created = await store.createAuthorization("Codex");
    const authorized = await store.requireAuthorized(created.clientId, created.token);
    const authorizationLog = await readFile(
      path.join(paths.accessRoot, "authorizations.ndjson"),
      "utf8",
    );

    expect(authorized.displayName).toBe("Codex");
    expect(authorizationLog).not.toContain(created.token);
    expect((await stat(paths.accessRoot)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(paths.accessRoot, "settings.ndjson"))).mode & 0o777).toBe(0o600);
    expect((await stat(path.join(paths.accessRoot, "authorizations.ndjson"))).mode & 0o777).toBe(
      0o600,
    );
  });

  it("combines enabling and authorization in the simplified setup flow", async () => {
    const paths = await createTestPaths("auth-setup");
    const store = new AuthorizationStore(paths.accessRoot);

    const created = await store.setupAuthorization("Codex");

    expect(await store.isEnabled()).toBe(true);
    await expect(store.requireAuthorized(created.clientId, created.token)).resolves.toMatchObject({
      displayName: "Codex",
    });
  });

  it("fails closed for wrong, revoked, and globally disabled credentials", async () => {
    const paths = await createTestPaths("auth-revoke");
    const store = new AuthorizationStore(paths.accessRoot);
    await store.setEnabled(true);
    const created = await store.createAuthorization("Codex");

    await expect(store.requireAuthorized(created.clientId, "x".repeat(43))).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await store.revokeAuthorization(created.clientId);
    await expect(store.requireAuthorized(created.clientId, created.token)).rejects.toMatchObject({
      code: "authorization_unavailable",
    });

    const second = await store.createAuthorization("Claude");
    await store.setEnabled(false);
    await expect(store.requireAuthorized(second.clientId, second.token)).rejects.toMatchObject({
      code: "access_disabled",
    });
  });
});
