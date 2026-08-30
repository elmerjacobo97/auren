import type { Command } from "commander";
import { CommandExitError } from "../../command/command-exit-error.js";
import type { InstallableCatalogSource } from "../../catalog/catalog-source.js";
import {
  createRemoteCatalogSource,
  type RemoteCatalogSourceOptions,
} from "../../catalog/remote-catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { runAddFlow } from "./add-flow.js";
import {
  createPackageInstaller,
  type PackageInstaller,
} from "./package-installer.js";
import {
  createShadcnInstaller,
  type ShadcnInstaller,
} from "./shadcn-installer.js";

export interface RegisterAddCommandOptions extends RemoteCatalogSourceOptions {
  readonly installableCatalogSource?: InstallableCatalogSource;
  readonly packageInstaller?: PackageInstaller;
  readonly shadcnInstaller?: ShadcnInstaller;
}

export function registerAddCommand(
  program: Command,
  terminal: Terminal,
  options: RegisterAddCommandOptions = {},
): void {
  program
    .command("add")
    .description("Install a catalog element into the current project")
    .usage("<id>")
    .argument("<id>", "catalog element ID")
    .option("--force", "replace existing planned files")
    .option("--registry-url <url>", "remote Registry document-root URL")
    .action(
      async (
        id: string,
        actionOptions: { force?: boolean; registryUrl?: string },
      ) => {
        const status = await runAddFlow({
          projectDir: process.cwd(),
          id,
          force: actionOptions.force ?? false,
          terminal,
          source:
            options.installableCatalogSource ??
            createRemoteCatalogSource({
              ...options,
              registryUrl: actionOptions.registryUrl ?? options.registryUrl,
            }),
          packageInstaller:
            options.packageInstaller ?? createPackageInstaller(),
          shadcnInstaller: options.shadcnInstaller ?? createShadcnInstaller(),
        });

        if (status !== 0) {
          throw new CommandExitError(status);
        }
      },
    );
}
