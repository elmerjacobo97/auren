import { spawn } from "node:child_process";
import {
  validatePackageDependency,
  type PackageDependency,
} from "@auren/core/dependencies";

export { InvalidPackageRequirementError } from "@auren/core/dependencies";
import type { PackageManagerName } from "@auren/core/project";

export interface PackageInstallerOptions {
  readonly projectDir: string;
  readonly packageManager: PackageManagerName;
  readonly packages: readonly PackageDependency[];
}

export interface PackageInstallationResult {
  readonly packages: readonly PackageDependency[];
}

export interface PackageInstaller {
  install(options: PackageInstallerOptions): Promise<PackageInstallationResult>;
}

export class PackageManagerProcessError extends Error {
  constructor(
    readonly packageManager: PackageManagerName,
    readonly packages: readonly PackageDependency[],
    readonly exitCode: number | null,
    readonly signal: NodeJS.Signals | null,
    readonly stderr: string,
  ) {
    const detail =
      exitCode === null
        ? `terminated by ${signal ?? "an unknown signal"}`
        : `exited with code ${exitCode}`;
    const output = stderr.trim().split(/\r?\n/, 1)[0]?.trim();

    super(
      `Package manager "${packageManager}" failed to install ${formatPackages(packages)}: ${detail}${output ? `: ${output}` : ""}`,
    );
    this.name = "PackageManagerProcessError";
  }
}

export class PackageManagerUnavailableError extends Error {
  constructor(
    readonly packageManager: PackageManagerName,
    readonly packages: readonly PackageDependency[],
    cause: unknown,
  ) {
    super(
      `Package manager "${packageManager}" is unavailable while installing ${formatPackages(packages)}: ${messageOf(cause)}`,
      { cause },
    );
    this.name = "PackageManagerUnavailableError";
  }
}

export function createPackageInstaller(): PackageInstaller {
  return { install: installPackages };
}

export async function installPackages(
  options: PackageInstallerOptions,
): Promise<PackageInstallationResult> {
  const packages = options.packages.map((dependency) => {
    validatePackageDependency(dependency);
    return dependency;
  });

  if (packages.length === 0) {
    return { packages: [] };
  }

  const command = packageManagerCommands[options.packageManager];
  const args = [command.subcommand, "--", ...packages.map(formatPackage)];

  let child: ReturnType<typeof spawn>;

  try {
    child = spawn(command.executable, args, {
      cwd: options.projectDir,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (cause) {
    throw new PackageManagerUnavailableError(
      options.packageManager,
      packages,
      cause,
    );
  }

  let stderr = "";

  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return await new Promise<PackageInstallationResult>((resolve, reject) => {
    let settled = false;

    child.once("error", (cause) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new PackageManagerUnavailableError(
          options.packageManager,
          packages,
          cause,
        ),
      );
    });
    child.once("close", (exitCode, signal) => {
      if (settled) {
        return;
      }

      settled = true;

      if (exitCode === 0) {
        resolve({ packages });
        return;
      }

      reject(
        new PackageManagerProcessError(
          options.packageManager,
          packages,
          exitCode,
          signal,
          stderr,
        ),
      );
    });
  });
}

const packageManagerCommands: Record<
  PackageManagerName,
  { readonly executable: string; readonly subcommand: string }
> = {
  npm: { executable: "npm", subcommand: "install" },
  pnpm: { executable: "pnpm", subcommand: "add" },
  yarn: { executable: "yarn", subcommand: "add" },
  bun: { executable: "bun", subcommand: "add" },
};

function formatPackage(dependency: PackageDependency): string {
  return `${dependency.name}@${dependency.version}`;
}

function formatPackages(packages: readonly PackageDependency[]): string {
  return packages.map(formatPackage).join(", ");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
