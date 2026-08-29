import { CommanderError, type Command } from "commander";
import { createRootProgram } from "./program.js";
import {
  createTerminal,
  type Terminal,
  type TerminalOptions,
} from "../terminal/terminal.js";

const successfulControlFlowCodes = new Set([
  "commander.helpDisplayed",
  "commander.version",
]);

export type CliProgramFactory = (terminal: Terminal) => Command;

export interface RunCliOptions extends TerminalOptions {
  createProgram?: CliProgramFactory;
}

function isSuccessfulControlFlow(error: unknown): boolean {
  return (
    error instanceof CommanderError &&
    successfulControlFlowCodes.has(error.code)
  );
}

export async function runCli(
  argv: readonly string[] = process.argv,
  options: RunCliOptions = {},
): Promise<number> {
  const terminal = createTerminal(options);
  let commanderErrorRendered = false;

  try {
    const program = (options.createProgram ?? createRootProgram)(terminal);

    program.configureOutput({
      writeOut: terminal.writeOut,
      writeErr: terminal.writeErr,
      outputError(message) {
        commanderErrorRendered = true;
        terminal.error(message);
      },
    });
    program.exitOverride((error) => {
      throw error;
    });
    program.showSuggestionAfterError(false);

    await program.parseAsync(argv);
    return 0;
  } catch (error) {
    if (isSuccessfulControlFlow(error)) {
      return 0;
    }

    if (!commanderErrorRendered) {
      terminal.error(error);
    }

    return 1;
  }
}
