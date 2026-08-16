import { appendFile, chmod, lstat, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface RemoteMicPaths {
  transcriptRoot: string;
  accessRoot: string;
}

export function defaultRemoteMicPaths(): RemoteMicPaths {
  if (process.platform !== "darwin") {
    throw new Error("Remote Mic history access currently supports macOS only.");
  }

  const applicationSupport = path.join(os.homedir(), "Library", "Application Support");
  return {
    transcriptRoot: path.join(applicationSupport, "RemoteMic", "Transcripts", "v1"),
    accessRoot: path.join(applicationSupport, "SayAllMCP", "RemoteMicHistory", "v1"),
  };
}

export async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("Private data directory must be a regular directory.");
  }
  await chmod(directory, 0o700);
}

export async function appendPrivateLine(
  directory: string,
  file: string,
  line: string,
): Promise<void> {
  await ensurePrivateDirectory(directory);
  try {
    const metadata = await lstat(file);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error("Private event file must be a regular file.");
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "ENOENT") {
      throw error;
    }
  }
  await appendFile(file, `${line}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(file, 0o600);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
