import { CommanderError, type Command } from "commander";
import { CommandExitError } from "./command-exit-error.js";
import { createRootProgram, type CreateRootProgramOptions } from "./program.js";
import {
  createTerminal,
  type Terminal,
  type TerminalOptions,
} from "../terminal/terminal.js";
import type {
  CatalogSource,
  InstallableCatalogSource,
} from "../catalog/catalog-source.js";
import type { InitPrompt } from "../commands/init/init-prompt.js";
import type { PackageInstaller } from "../commands/add/package-installer.js";

const successfulControlFlowCodes = new Set([
  "commander.helpDisplayed",
  "commander.version",
]);

export type CliProgramFactory = (
  terminal: Terminal,
  options?: CreateRootProgramOptions,
) => Command;

export interface RunCliOptions extends TerminalOptions {
  createProgram?: CliProgramFactory;
  prompt?: InitPrompt;
  catalogSource?: CatalogSource;
  installableCatalogSource?: InstallableCatalogSource;
  packageInstaller?: PackageInstaller;
}

function isSuccessfulControlFlow(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    successfulControlFlowCodes.has(error.code)
  );
}

function isCommandExitError(error: unknown): error is CommandExitError {
  return error instanceof CommandExitError;
}

export async function runCli(
  argv: readonly string[] = process.argv,
  options: RunCliOptions = {},
): Promise<number> {
  const terminal = createTerminal(options);
  let commanderErrorRendered = false;

  try {
    const program = (options.createProgram ?? createRootProgram)(terminal, {
      prompt: options.prompt,
      catalogSource: options.catalogSource,
      installableCatalogSource: options.installableCatalogSource,
      packageInstaller: options.packageInstaller,
    });

    for (const command of [program, ...program.commands]) {
      command.configureOutput({
        writeOut: terminal.writeOut,
        writeErr: terminal.writeErr,
        outputError(message) {
          commanderErrorRendered = true;
          terminal.error(message);
        },
      });
      command.exitOverride((error) => {
        throw error;
      });
      command.showSuggestionAfterError(false);
    }

    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (isSuccessfulControlFlow(error)) {
      return 0;
    }

    if (isCommandExitError(error)) {
      return error.status;
    }

    if (!commanderErrorRendered) {
      terminal.error(error);
    }

    return 1;
  }
}
