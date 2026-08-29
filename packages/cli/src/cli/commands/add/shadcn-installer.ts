import { spawn } from "node:child_process";
import type { PackageManagerName } from "@auren/core/project";

export interface ShadcnInstallerOptions {
  readonly projectDir: string;
  readonly packageManager: PackageManagerName;
  readonly components: readonly string[];
}

export interface ShadcnInstallationResult {
  readonly components: readonly string[];
}

export interface ShadcnInstaller {
  install(options: ShadcnInstallerOptions): Promise<ShadcnInstallationResult>;
}

export class InvalidShadcnComponentError extends Error {
  constructor(readonly component: string) {
    super(
      `Invalid shadcn/ui component requirement "${component}": the component name must use lowercase kebab-case`,
    );
    this.name = "InvalidShadcnComponentError";
  }
}

export class ShadcnProcessError extends Error {
  constructor(
    readonly packageManager: PackageManagerName,
    readonly components: readonly string[],
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
      `Shadcn/ui runner "${packageManager}" failed to install ${formatComponents(components)}: ${detail}${output ? `: ${output}` : ""}`,
    );
    this.name = "ShadcnProcessError";
  }
}

export class ShadcnInstallerUnavailableError extends Error {
  constructor(
    readonly packageManager: PackageManagerName,
    readonly components: readonly string[],
    cause: unknown,
  ) {
    super(
      `Shadcn/ui runner "${packageManager}" is unavailable while installing ${formatComponents(components)}: ${messageOf(cause)}`,
      { cause },
    );
    this.name = "ShadcnInstallerUnavailableError";
  }
}

export function createShadcnInstaller(): ShadcnInstaller {
  return { install: installShadcnComponents };
}

export async function installShadcnComponents(
  options: ShadcnInstallerOptions,
): Promise<ShadcnInstallationResult> {
  const components = options.components.map((name) => {
    validateShadcnComponentName(name);
    return name;
  });

  if (components.length === 0) {
    return { components: [] };
  }

  const command = shadcnCommands[options.packageManager];
  const args = [...command.args, ...components];
  let child: ReturnType<typeof spawn>;

  try {
    child = spawn(command.executable, args, {
      cwd: options.projectDir,
      shell: false,
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (cause) {
    throw new ShadcnInstallerUnavailableError(
      options.packageManager,
      components,
      cause,
    );
  }

  let stderr = "";

  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return await new Promise<ShadcnInstallationResult>((resolve, reject) => {
    let settled = false;

    child.once("error", (cause) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(
        new ShadcnInstallerUnavailableError(
          options.packageManager,
          components,
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
        resolve({ components });
        return;
      }

      reject(
        new ShadcnProcessError(
          options.packageManager,
          components,
          exitCode,
          signal,
          stderr,
        ),
      );
    });
  });
}

const shadcnCommands: Record<
  PackageManagerName,
  { readonly executable: string; readonly args: readonly string[] }
> = {
  npm: {
    executable: "npx",
    args: ["--yes", "shadcn@latest", "add", "--yes"],
  },
  pnpm: {
    executable: "pnpm",
    args: ["dlx", "shadcn@latest", "add", "--yes"],
  },
  yarn: {
    executable: "yarn",
    args: ["dlx", "shadcn@latest", "add", "--yes"],
  },
  bun: {
    executable: "bunx",
    args: ["--bun", "shadcn@latest", "add", "--yes"],
  },
};

function validateShadcnComponentName(name: string): void {
  if (!shadcnNamePattern.test(name)) {
    throw new InvalidShadcnComponentError(name);
  }
}

function formatComponents(components: readonly string[]): string {
  return components.join(", ");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const shadcnNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
