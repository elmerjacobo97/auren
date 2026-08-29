import type { Command } from "commander";
import type { Terminal } from "../../terminal/terminal.js";
import { isExitStatusError, runInitFlow } from "./init-flow.js";
import { clackInitPrompt, type InitPrompt } from "./init-prompt.js";

export interface RegisterInitCommandOptions {
  prompt?: InitPrompt;
}

export function registerInitCommand(
  program: Command,
  terminal: Terminal,
  options: RegisterInitCommandOptions = {},
): void {
  program
    .command("init")
    .description("Initialize auren.json in the current project")
    .option("--force", "replace an existing auren.json")
    .action(async (actionOptions: { force?: boolean }) => {
      const status = await runInitFlow({
        projectDir: process.cwd(),
        terminal,
        force: actionOptions.force ?? false,
        interactive: terminal.interactive,
        prompt: options.prompt ?? clackInitPrompt,
      }).catch((error: unknown): number => {
        if (isExitStatusError(error)) {
          return error.status;
        }

        throw error;
      });

      if (status !== 0) {
        throw new CommandExitError(status);
      }
    });
}

export class CommandExitError extends Error {
  constructor(readonly status: number) {
    super(`Command exited with status ${status}`);
    this.name = "CommandExitError";
  }
}
