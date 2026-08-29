import { Command } from "commander";
import {
  registerInitCommand,
  type RegisterInitCommandOptions,
} from "../commands/init/init-command.js";
import {
  registerInfoCommand,
  type RegisterInfoCommandOptions,
} from "../commands/info/info-command.js";
import {
  registerSearchCommand,
  type RegisterSearchCommandOptions,
} from "../commands/search/search-command.js";
import {
  registerAddCommand,
  type RegisterAddCommandOptions,
} from "../commands/add/add-command.js";
import type {
  CatalogSource,
  InstallableCatalogSource,
} from "../catalog/catalog-source.js";
import type { Terminal } from "../terminal/terminal.js";
import { readCliVersion } from "../runtime/version.js";

export interface CreateRootProgramOptions
  extends RegisterInitCommandOptions,
    RegisterInfoCommandOptions,
    RegisterSearchCommandOptions,
    RegisterAddCommandOptions {
  readonly catalogSource?: CatalogSource;
}

export function createRootProgram(
  terminal: Terminal,
  options: CreateRootProgramOptions = {},
): Command {
  const program = new Command();

  program
    .name("auren")
    .description("Auren UI block catalog CLI")
    .version(readCliVersion());

  program.action(() => {
    program.outputHelp();
  });

  registerInitCommand(program, terminal, options);
  registerInfoCommand(program, terminal, options);
  registerSearchCommand(program, terminal, options);
  registerAddCommand(program, terminal, {
    installableCatalogSource:
      options.installableCatalogSource ??
      (isInstallableCatalogSource(options.catalogSource)
        ? options.catalogSource
        : undefined),
    packageInstaller: options.packageInstaller,
  });

  return program;
}

function isInstallableCatalogSource(
  source: CatalogSource | undefined,
): source is InstallableCatalogSource {
  return (
    source !== undefined &&
    typeof (source as Partial<InstallableCatalogSource>).listInstallable ===
      "function"
  );
}
