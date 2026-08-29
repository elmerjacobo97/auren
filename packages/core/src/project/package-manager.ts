import path from "node:path";
import { diagnostic } from "./diagnostics.js";
import { fileExists } from "./fs.js";
import type {
  JsonObject,
  PackageManagerDetection,
  PackageManagerName,
  ProjectDetectionDiagnostic,
} from "./types.js";

const lockfiles: ReadonlyArray<{
  readonly relativePath: string;
  readonly name: PackageManagerName;
}> = [
  { relativePath: "pnpm-lock.yaml", name: "pnpm" },
  { relativePath: "package-lock.json", name: "npm" },
  { relativePath: "yarn.lock", name: "yarn" },
  { relativePath: "bun.lock", name: "bun" },
  { relativePath: "bun.lockb", name: "bun" },
];

type PackageManagerFieldParse =
  | {
      readonly valid: true;
      readonly name: PackageManagerName;
      readonly version: string | null;
    }
  | { readonly valid: false };

export async function detectPackageManager(
  projectDir: string,
  manifest: JsonObject | null,
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<PackageManagerDetection | null> {
  const manifestValue = manifest?.packageManager;
  const explicit = parsePackageManagerField(manifestValue);
  const presentLockfiles = await findPresentLockfiles(projectDir);

  if (manifestValue !== undefined && !explicit.valid) {
    diagnostics.push(
      diagnostic(
        "warning",
        "invalid-package-manager",
        "package.json packageManager is not a recognized npm, pnpm, yarn, or bun value",
        "package.json",
      ),
    );
  }

  if (explicit.valid) {
    reportLockfileConflicts(explicit.name, presentLockfiles, diagnostics);

    return {
      name: explicit.name,
      version: explicit.version,
      evidence: "packageManager",
      path: "package.json",
    };
  }

  return detectImplicitPackageManager(
    projectDir,
    presentLockfiles,
    diagnostics,
  );
}

function parsePackageManagerField(value: unknown): PackageManagerFieldParse {
  if (typeof value !== "string") {
    return { valid: false };
  }

  const match = value.match(/^(npm|pnpm|yarn|bun)(?:@(.*))?$/);

  if (!match) {
    return { valid: false };
  }

  return {
    valid: true,
    name: match[1] as PackageManagerName,
    version: match[2] || null,
  };
}

async function findPresentLockfiles(projectDir: string): Promise<
  Array<{
    relativePath: string;
    name: PackageManagerName;
  }>
> {
  const presentLockfiles = [] as Array<{
    relativePath: string;
    name: PackageManagerName;
  }>;

  for (const lockfile of lockfiles) {
    if (await fileExists(path.join(projectDir, lockfile.relativePath))) {
      presentLockfiles.push(lockfile);
    }
  }

  return presentLockfiles;
}

function reportLockfileConflicts(
  selectedName: PackageManagerName,
  presentLockfiles: ReadonlyArray<{
    readonly relativePath: string;
    readonly name: PackageManagerName;
  }>,
  diagnostics: ProjectDetectionDiagnostic[],
): void {
  const conflicts = presentLockfiles.filter(
    (lockfile) => lockfile.name !== selectedName,
  );

  if (conflicts.length === 0) {
    return;
  }

  diagnostics.push(
    diagnostic(
      "warning",
      "conflicting-package-managers",
      `packageManager selects ${selectedName}, but conflicting lockfiles are present: ${conflicts.map((lockfile) => lockfile.relativePath).join(", ")}`,
      "package.json",
    ),
  );
}

async function detectImplicitPackageManager(
  projectDir: string,
  presentLockfiles: ReadonlyArray<{
    readonly relativePath: string;
    readonly name: PackageManagerName;
  }>,
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<PackageManagerDetection | null> {
  const uniqueLockfileManagers = new Set(
    presentLockfiles.map((lockfile) => lockfile.name),
  );

  if (uniqueLockfileManagers.size === 1 && presentLockfiles.length === 1) {
    const [lockfile] = presentLockfiles;
    return {
      name: lockfile.name,
      version: null,
      evidence: "lockfile",
      path: lockfile.relativePath,
    };
  }

  if (uniqueLockfileManagers.size > 1 || presentLockfiles.length > 1) {
    diagnostics.push(
      diagnostic(
        "warning",
        "ambiguous-package-manager",
        `Multiple package manager lockfiles are present without a recognized packageManager field: ${presentLockfiles.map((lockfile) => lockfile.relativePath).join(", ")}`,
      ),
    );
    return null;
  }

  if (await fileExists(path.join(projectDir, "pnpm-workspace.yaml"))) {
    return {
      name: "pnpm",
      version: null,
      evidence: "workspace",
      path: "pnpm-workspace.yaml",
    };
  }

  return null;
}
