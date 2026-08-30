import type { Command } from "commander";
import { CommandExitError } from "../../command/command-exit-error.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import {
  createRemoteCatalogSource,
  type RemoteCatalogSourceOptions,
} from "../../catalog/remote-catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { runInfoFlow } from "./info-flow.js";

export interface RegisterInfoCommandOptions extends RemoteCatalogSourceOptions {
  readonly catalogSource?: CatalogSource;
}

export function registerInfoCommand(
  program: Command,
  terminal: Terminal,
  options: RegisterInfoCommandOptions = {},
): void {
  program
    .command("info")
    .description("Inspect a catalog element")
    .usage("<id>")
    .argument("<id>", "catalog element ID")
    .option("--registry-url <url>", "remote Registry document-root URL")
    .action(async (id: string, actionOptions: { registryUrl?: string }) => {
      const status = await runInfoFlow({
        id,
        terminal,
        source:
          options.catalogSource ??
          createRemoteCatalogSource({
            ...options,
            registryUrl: actionOptions.registryUrl ?? options.registryUrl,
          }),
      });

      if (status !== 0) {
        throw new CommandExitError(status);
      }
    });
}
