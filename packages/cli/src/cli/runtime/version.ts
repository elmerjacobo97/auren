import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface CliPackageManifest {
  version?: unknown;
}

function findCliPackageManifest(): string {
  let directory = dirname(fileURLToPath(import.meta.url));

  while (true) {
    const manifestPath = join(directory, "package.json");

    if (existsSync(manifestPath)) {
      return manifestPath;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      break;
    }

    directory = parent;
  }

  throw new Error("CLI package manifest was not found.");
}

export function readCliVersion(): string {
  let manifest: CliPackageManifest;

  try {
    manifest = JSON.parse(
      readFileSync(findCliPackageManifest(), "utf8"),
    ) as CliPackageManifest;
  } catch {
    throw new Error("Unable to load CLI package version from package.json.");
  }

  if (
    !manifest ||
    typeof manifest !== "object" ||
    Array.isArray(manifest) ||
    typeof manifest.version !== "string" ||
    manifest.version.length === 0
  ) {
    throw new Error("CLI package version is missing from package.json.");
  }

  return manifest.version;
}
