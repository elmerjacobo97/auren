import { randomUUID } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  aurenConfigurationSchema,
  type AurenConfiguration as AurenConfigurationType,
} from "@auren/schemas/configuration";
import { failureMessage } from "../project/diagnostics.js";
import { normalizeProjectDir } from "../project/fs.js";
import { ProjectDetectionError } from "../project/project-detection-error.js";
import { readOptionalJson } from "../project/json.js";

const CONFIGURATION_FILE = "auren.json";

export type {
  AurenConfiguration,
  AurenConfigurationAliases,
  AurenConfigurationIntegrations,
  AurenConfigurationOutput,
} from "@auren/schemas/configuration";

export type AurenConfigurationErrorCode =
  | "invalid-project-directory"
  | "unreadable-file"
  | "malformed-json"
  | "invalid-configuration"
  | "write-failed";

export class AurenConfigurationError extends Error {
  readonly affectedPath: string;
  readonly path: string;
  readonly projectDir: string;

  constructor(
    readonly code: AurenConfigurationErrorCode,
    readonly requestedDir: string,
    affectedPath: string,
    override cause?: unknown,
  ) {
    super(
      `Auren configuration ${code} at "${affectedPath}" for project "${requestedDir}": ${failureMessage(cause)}`,
      { cause },
    );
    this.name = "AurenConfigurationError";
    this.affectedPath = affectedPath;
    this.path = affectedPath;
    this.projectDir = requestedDir;
  }
}

export async function readAurenConfig(
  projectDir = process.cwd(),
): Promise<AurenConfigurationType | null> {
  const absoluteProjectDir = await normalizeConfigurationProjectDir(projectDir);
  const configurationPath = path.join(absoluteProjectDir, CONFIGURATION_FILE);
  const file = await readOptionalJson(
    absoluteProjectDir,
    CONFIGURATION_FILE,
    "json",
  );

  if (file.state === "absent") {
    return null;
  }

  if (file.state !== "parsed") {
    throw new AurenConfigurationError(
      file.state === "unreadable" ? "unreadable-file" : "malformed-json",
      projectDir,
      configurationPath,
      file.cause,
    );
  }

  const parsed = aurenConfigurationSchema.safeParse(file.value);

  if (!parsed.success) {
    throw new AurenConfigurationError(
      "invalid-configuration",
      projectDir,
      configurationPath,
      parsed.error,
    );
  }

  return parsed.data;
}

export async function writeAurenConfig(
  projectDir: string,
  input: unknown,
): Promise<AurenConfigurationType> {
  const configuration = aurenConfigurationSchema.safeParse(input);

  if (!configuration.success) {
    throw new AurenConfigurationError(
      "invalid-configuration",
      projectDir,
      configurationPathFor(projectDir),
      configuration.error,
    );
  }

  let serialized: string;

  try {
    serialized = `${JSON.stringify(configuration.data, null, 2)}\n`;
  } catch (cause) {
    throw new AurenConfigurationError(
      "invalid-configuration",
      projectDir,
      configurationPathFor(projectDir),
      cause,
    );
  }

  const absoluteProjectDir = await normalizeConfigurationProjectDir(projectDir);
  const configurationPath = path.join(absoluteProjectDir, CONFIGURATION_FILE);
  const temporaryPath = path.join(
    absoluteProjectDir,
    `.${CONFIGURATION_FILE}.${randomUUID()}.tmp`,
  );

  try {
    await writeFile(temporaryPath, serialized, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, configurationPath);
  } catch (cause) {
    await removeTemporaryFile(temporaryPath);
    throw new AurenConfigurationError(
      "write-failed",
      projectDir,
      configurationPath,
      cause,
    );
  }

  return configuration.data;
}

async function normalizeConfigurationProjectDir(
  requestedDir: string,
): Promise<string> {
  try {
    return await normalizeProjectDir(requestedDir);
  } catch (cause) {
    const originalCause =
      cause instanceof ProjectDetectionError ? (cause.cause ?? cause) : cause;

    throw new AurenConfigurationError(
      "invalid-project-directory",
      requestedDir,
      configurationPathFor(requestedDir),
      originalCause,
    );
  }
}

function configurationPathFor(requestedDir: string): string {
  try {
    return path.join(path.resolve(requestedDir), CONFIGURATION_FILE);
  } catch {
    return String(requestedDir);
  }
}

async function removeTemporaryFile(temporaryPath: string): Promise<void> {
  try {
    await rm(temporaryPath, { force: true });
  } catch {
    // Preserve the original write or replacement failure.
  }
}
