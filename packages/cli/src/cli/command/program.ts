import { Command } from "commander";
import {
  registerInitCommand,
  type RegisterInitCommandOptions,
} from "../commands/init/init-command.js";
import {
  registerInfoCommand,
  type RegisterInfoCommandOptions,
} from "../commands/info/info-command.js";
import type { Terminal } from "../terminal/terminal.js";
import { readCliVersion } from "../runtime/version.js";

export interface CreateRootProgramOptions
  extends RegisterInitCommandOptions,
    RegisterInfoCommandOptions {}

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

  return program;
}
