import type { Command } from "commander";
import { CommandExitError } from "../../command/command-exit-error.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import {
  createRemoteCatalogSource,
  type RemoteCatalogSourceOptions,
} from "../../catalog/remote-catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { runSearchFlow, type SearchFilterOptions } from "./search-flow.js";

export interface RegisterSearchCommandOptions
  extends RemoteCatalogSourceOptions {
  readonly catalogSource?: CatalogSource;
}

interface SearchCommandActionOptions {
  readonly type?: string;
  readonly category?: string;
  readonly style?: string;
  readonly industry?: string;
  readonly feature?: string;
}

export function registerSearchCommand(
  program: Command,
  terminal: Terminal,
  options: RegisterSearchCommandOptions = {},
): void {
  program
    .command("search")
    .description("Search the catalog")
    .usage("[query]")
    .argument("[query]", "free-text search query")
    .option("--type <type>", "filter by block type")
    .option("--category <category>", "filter by category")
    .option("--style <style>", "filter by style")
    .option("--industry <industry>", "filter by industry")
    .option("--feature <feature>", "filter by feature")
    .option("--registry-url <url>", "remote Registry document-root URL")
    .action(
      async (
        query: string | undefined,
        actionOptions: SearchCommandActionOptions & { registryUrl?: string },
      ) => {
        const filters: SearchFilterOptions = {
          type: actionOptions.type,
          category: actionOptions.category,
          style: actionOptions.style,
          industry: actionOptions.industry,
          feature: actionOptions.feature,
        };
        const status = await runSearchFlow({
          query,
          filters,
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
      },
    );
}
