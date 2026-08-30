import path from "node:path";
import { diagnostic } from "./diagnostics.js";
import { fileExists, relativePosix } from "./fs.js";
import { type OptionalJsonReadFailure, readOptionalJson } from "./json.js";
import { asObject } from "./object.js";
import type { ProjectDetectionDiagnostic, TailwindDetection } from "./types.js";

const tailwindConfigFiles = [
  "tailwind.config.js",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
  "tailwind.config.ts",
  "tailwind.config.cts",
  "tailwind.config.mts",
] as const;

export async function detectTailwind(
  projectDir: string,
  dependencies: Readonly<Record<string, string>>,
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<TailwindDetection> {
  const [configPath, installed] = await Promise.all([
    firstExistingTailwindConfig(projectDir),
    loadInstalledPackageVersion(projectDir, "tailwindcss"),
  ]);

  if (installed.unreadable) {
    diagnostics.push(
      diagnostic(
        installed.unreadable.state === "malformed" ? "error" : "warning",
        installed.unreadable.state === "malformed"
          ? "malformed-json"
          : "unreadable-file",
        "Could not read installed Tailwind package metadata",
        relativePosix(projectDir, installed.unreadable.absolutePath),
        installed.unreadable.cause,
      ),
    );
  }

  const declaredRange = dependencies.tailwindcss ?? null;
  const installedVersion = installed.version;

  return {
    detected: Boolean(declaredRange || installedVersion || configPath),
    declaredRange,
    installedVersion,
    major: parseMajor(installedVersion) ?? parseMajor(declaredRange),
    configPath,
  };
}

function parseMajor(versionOrRange: string | null): number | null {
  if (!versionOrRange) {
    return null;
  }

  const match =
    versionOrRange.match(/(?:^|[^\d])(\d+)\./) ??
    versionOrRange.match(/^(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function loadInstalledPackageVersion(
  projectDir: string,
  packageName: string,
): Promise<{
  version: string | null;
  unreadable: OptionalJsonReadFailure | null;
}> {
  const parsed = await readOptionalJson(
    projectDir,
    path.join("node_modules", packageName, "package.json"),
    "json",
  );

  if (parsed.state === "absent") {
    return { version: null, unreadable: null };
  }

  if (parsed.state !== "parsed") {
    return { version: null, unreadable: parsed };
  }

  const value = asObject(parsed.value)?.version;
  return {
    version: typeof value === "string" ? value : null,
    unreadable: null,
  };
}

async function firstExistingTailwindConfig(
  projectDir: string,
): Promise<string | null> {
  for (const filename of tailwindConfigFiles) {
    if (await fileExists(path.join(projectDir, filename))) {
      return filename;
    }
  }

  return null;
}
