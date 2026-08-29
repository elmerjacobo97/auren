import type { Command } from "commander";
import { CommandExitError } from "../../command/command-exit-error.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import { createLocalCatalogSource } from "../../catalog/local-catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { runInfoFlow } from "./info-flow.js";

export interface RegisterInfoCommandOptions {
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
    .action(async (id: string) => {
      const status = await runInfoFlow({
        id,
        terminal,
        source: options.catalogSource ?? createLocalCatalogSource(),
      });

      if (status !== 0) {
        throw new CommandExitError(status);
      }
    });
}
