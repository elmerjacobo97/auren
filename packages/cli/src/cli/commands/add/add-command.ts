import type { Command } from "commander";
import { CommandExitError } from "../../command/command-exit-error.js";
import { createLocalCatalogSource } from "../../catalog/local-catalog-source.js";
import type { InstallableCatalogSource } from "../../catalog/catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { runAddFlow } from "./add-flow.js";
import {
  createPackageInstaller,
  type PackageInstaller,
} from "./package-installer.js";

export interface RegisterAddCommandOptions {
  readonly installableCatalogSource?: InstallableCatalogSource;
  readonly packageInstaller?: PackageInstaller;
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
    .action(async (id: string, actionOptions: { force?: boolean }) => {
      const status = await runAddFlow({
        projectDir: process.cwd(),
        id,
        force: actionOptions.force ?? false,
        terminal,
        source: options.installableCatalogSource ?? createLocalCatalogSource(),
        packageInstaller: options.packageInstaller ?? createPackageInstaller(),
      });

      if (status !== 0) {
        throw new CommandExitError(status);
      }
    });
}
