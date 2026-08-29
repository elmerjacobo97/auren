import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ProjectDetectionError } from "./project-detection-error.js";

export type OptionalTextFile =
  | {
      readonly state: "absent";
      readonly relativePath: string;
      readonly absolutePath: string;
    }
  | {
      readonly state: "present";
      readonly relativePath: string;
      readonly absolutePath: string;
      readonly content: string;
    }
  | {
      readonly state: "unreadable";
      readonly relativePath: string;
      readonly absolutePath: string;
      readonly cause: unknown;
    };

export function relativePosix(projectDir: string, filePath: string): string {
  return path.relative(projectDir, filePath).split(path.sep).join("/") || ".";
}

export async function normalizeProjectDir(projectDir: string): Promise<string> {
  const absoluteProjectDir = path.resolve(projectDir);

  try {
    const info = await stat(absoluteProjectDir);

    if (!info.isDirectory()) {
      throw new Error("Path is not a directory");
    }

    await access(absoluteProjectDir, constants.R_OK);
  } catch (cause) {
    throw new ProjectDetectionError(projectDir, cause);
  }

  return absoluteProjectDir;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isDirectory();
  } catch {
    return false;
  }
}

export async function readOptionalFile(
  projectDir: string,
  relativePath: string,
): Promise<OptionalTextFile> {
  const absolutePath = path.join(projectDir, relativePath);

  try {
    const info = await stat(absolutePath);

    if (!info.isFile()) {
      return { state: "absent", relativePath, absolutePath };
    }
  } catch (cause) {
    if (isNotFound(cause)) {
      return { state: "absent", relativePath, absolutePath };
    }

    return { state: "unreadable", relativePath, absolutePath, cause };
  }

  try {
    return {
      state: "present",
      relativePath,
      absolutePath,
      content: await readFile(absolutePath, "utf8"),
    };
  } catch (cause) {
    return { state: "unreadable", relativePath, absolutePath, cause };
  }
}

function isNotFound(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    cause.code === "ENOENT"
  );
}
