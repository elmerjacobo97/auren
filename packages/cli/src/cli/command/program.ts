import { Command } from "commander";
import { readCliVersion } from "../runtime/version.js";

export function createRootProgram(): Command {
  const program = new Command();

  program
    .name("auren")
    .description("Auren UI block catalog CLI")
    .version(readCliVersion());

  program.action(() => {
    program.outputHelp();
  });

  return program;
}
