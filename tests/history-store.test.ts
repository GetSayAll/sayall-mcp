import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { TranscriptHistoryStore } from "../src/remote-mic/history-store.js";
import { createTestPaths, fixtureRecord, writeTranscriptDay } from "./test-fixtures.js";

describe("TranscriptHistoryStore", () => {
  it("lists applications without returning transcript text", async () => {
    const paths = await createTestPaths("list-apps");
    await writeTranscriptDay(paths.transcriptRoot, [fixtureRecord()]);
    await writeTranscriptDay(paths.transcriptRoot, [
      fixtureRecord({
        id: "10000000-0000-4000-8000-000000000002",
        sessionID: "20000000-0000-4000-8000-000000000002",
        applicationName: "TextEdit",
        bundleIdentifier: "com.apple.TextEdit",
        applicationKey: "com.apple.TextEdit-97bb05cf4b325745",
        endedAt: "2026-08-17T03:00:00.000Z",
        text: "另一条敏感正文",
      }),
    ]);

    const result = await new TranscriptHistoryStore(paths.transcriptRoot).listApplications();

    expect(result.skippedFileCount).toBe(0);
    expect(result.applications).toHaveLength(2);
    expect(result.applications[0]?.applicationName).toBe("TextEdit");
    expect(JSON.stringify(result)).not.toContain("测试语音历史");
    expect(JSON.stringify(result)).not.toContain("另一条敏感正文");
  });

  it("filters and paginates records with a stable cursor", async () => {
    const paths = await createTestPaths("pagination");
    await writeTranscriptDay(paths.transcriptRoot, [
      fixtureRecord({
        id: "10000000-0000-4000-8000-000000000001",
        sessionID: "20000000-0000-4000-8000-000000000001",
        endedAt: "2026-08-17T02:30:30.000Z",
        text: "第一条",
      }),
      fixtureRecord({
        id: "10000000-0000-4000-8000-000000000002",
        sessionID: "20000000-0000-4000-8000-000000000002",
        startedAt: "2026-08-17T02:39:50.000Z",
        endedAt: "2026-08-17T02:40:00.000Z",
        text: "第二条",
      }),
      fixtureRecord({
        id: "10000000-0000-4000-8000-000000000003",
        sessionID: "20000000-0000-4000-8000-000000000003",
        startedAt: "2026-08-17T02:49:50.000Z",
        endedAt: "2026-08-17T02:50:00.000Z",
        text: "第三条",
      }),
    ]);
    const store = new TranscriptHistoryStore(paths.transcriptRoot);

    const firstPage = await store.query({ limit: 2, order: "descending" });
    const secondPage = await store.query({
      limit: 2,
      order: "descending",
      cursor: firstPage.nextCursor ?? undefined,
    });

    expect(firstPage.records.map((record) => record.text)).toEqual(["第三条", "第二条"]);
    expect(firstPage.hasMore).toBe(true);
    expect(secondPage.records.map((record) => record.text)).toEqual(["第一条"]);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.nextCursor).toBeNull();
    expect(firstPage.records[0]).not.toHaveProperty("sessionID");
    expect(firstPage.records[0]).not.toHaveProperty("applicationKey");
  });

  it("applies time and application filters", async () => {
    const paths = await createTestPaths("filters");
    await writeTranscriptDay(paths.transcriptRoot, [fixtureRecord({ text: "Codex 记录" })]);
    await writeTranscriptDay(paths.transcriptRoot, [
      fixtureRecord({
        id: "10000000-0000-4000-8000-000000000004",
        sessionID: "20000000-0000-4000-8000-000000000004",
        applicationName: "TextEdit",
        bundleIdentifier: "com.apple.TextEdit",
        applicationKey: "com.apple.TextEdit-97bb05cf4b325745",
        startedAt: "2026-08-17T04:00:00.000Z",
        endedAt: "2026-08-17T04:00:10.000Z",
        text: "TextEdit 记录",
      }),
    ]);

    const result = await new TranscriptHistoryStore(paths.transcriptRoot).query({
      startedAtOrAfter: "2026-08-17T03:00:00.000Z",
      endedAtBefore: "2026-08-17T05:00:00.000Z",
      bundleIdentifiers: ["com.apple.TextEdit"],
    });

    expect(result.records.map((record) => record.text)).toEqual(["TextEdit 记录"]);
  });

  it("skips a damaged day file without blocking valid history", async () => {
    const paths = await createTestPaths("damaged-file");
    await writeTranscriptDay(paths.transcriptRoot, [fixtureRecord()]);
    const damagedDirectory = path.join(paths.transcriptRoot, "com.example.Broken-1234");
    await mkdir(damagedDirectory, { recursive: true, mode: 0o700 });
    await writeFile(path.join(damagedDirectory, "2026-08-17.json"), "not-json", {
      encoding: "utf8",
      mode: 0o600,
    });

    const result = await new TranscriptHistoryStore(paths.transcriptRoot).query({});

    expect(result.records).toHaveLength(1);
    expect(result.skippedFileCount).toBe(1);
  });

  it("rejects malformed cursors and oversized pages", async () => {
    const paths = await createTestPaths("invalid-query");
    const store = new TranscriptHistoryStore(paths.transcriptRoot);

    await expect(store.query({ cursor: "invalid" })).rejects.toThrow("cursor is invalid");
    await expect(store.query({ limit: 501 })).rejects.toThrow("between 1 and 500");
  });

  it("rejects a transcript root redirected through a symbolic link", async () => {
    const targetPaths = await createTestPaths("symlink-target");
    const linkPaths = await createTestPaths("symlink-root");
    await writeTranscriptDay(targetPaths.transcriptRoot, [fixtureRecord()]);
    await mkdir(path.dirname(linkPaths.transcriptRoot), { recursive: true, mode: 0o700 });
    await symlink(targetPaths.transcriptRoot, linkPaths.transcriptRoot);

    await expect(new TranscriptHistoryStore(linkPaths.transcriptRoot).query({})).rejects.toThrow(
      "regular directory",
    );
  });
});
