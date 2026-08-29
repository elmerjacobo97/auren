import { readFileSync } from "node:fs";
import { EOL } from "node:os";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import { describe, expect, it, vi } from "vitest";
import { createRootProgram } from "./program.js";
import { runCli, type RunCliOptions } from "./runner.js";
import { createTerminal } from "../terminal/terminal.js";
import { readCliVersion } from "../runtime/version.js";

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

async function invoke(
  args: readonly string[] = [],
  options: Omit<RunCliOptions, "stdout" | "stderr"> = {},
): Promise<CliResult> {
  let stdout = "";
  let stderr = "";

  const status = await runCli(["node", "auren", ...args], {
    ...options,
    color: false,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  return { status, stdout, stderr };
}

describe("Auren root CLI", () => {
  it("shows help for the long and short help options", async () => {
    const long = await invoke(["--help"]);
    const short = await invoke(["-h"]);

    expect(long.status).toBe(0);
    expect(long.stderr).toBe("");
    expect(long.stdout).toContain("Usage: auren [options]");
    expect(long.stdout).toContain("-V, --version");
    expect(short).toEqual(long);
  });

  it("reports the manifest version for both version options", async () => {
    const manifestPath = fileURLToPath(
      new URL("../../../package.json", import.meta.url),
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      version: string;
    };
    const long = await invoke(["--version"]);
    const short = await invoke(["-V"]);

    expect(readCliVersion()).toBe(manifest.version);
    expect(long).toEqual({
      status: 0,
      stdout: `${manifest.version}${EOL}`,
      stderr: "",
    });
    expect(short).toEqual(long);
  });

  it("shows help without performing domain work when no arguments are given", async () => {
    const noArguments = await invoke();
    const help = await invoke(["--help"]);
    const program = createRootProgram();

    expect(noArguments).toEqual(help);
    expect(noArguments.status).toBe(0);
    expect(program.commands).toHaveLength(0);
  });

  it("keeps successful output on stdout and failures on stderr", async () => {
    const success = await invoke(["--help"]);
    const failure = await invoke(["--unsupported"]);

    expect(success.stdout).not.toBe("");
    expect(success.stderr).toBe("");
    expect(failure.status).toBe(1);
    expect(failure.stdout).toBe("");
    expect(failure.stderr).toContain("error:");
    expect(failure.stderr).toContain("unsupported");
  });

  it("keeps error text readable when color is disabled", () => {
    let stderr = "";
    const terminal = createTerminal({
      color: false,
      stderr: (text) => {
        stderr += text;
      },
    });

    terminal.error(new Error("readable failure"));

    expect(stderr).toBe("error: readable failure\n");
    expect(stderr.includes(`${String.fromCharCode(27)}[`)).toBe(false);
  });

  it("writes to injected output writers", async () => {
    const stdout = vi.fn<(text: string) => void>();
    const stderr = vi.fn<(text: string) => void>();

    const status = await runCli(["node", "auren", "--version"], {
      color: false,
      stdout,
      stderr,
    });

    expect(status).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${readCliVersion()}\n`);
    expect(stderr).not.toHaveBeenCalled();
  });
});

describe("Auren CLI failure contract", () => {
  it("returns status 1 for unknown commands and options", async () => {
    const commandFailure = await invoke(["unsupported-command"]);
    const optionFailure = await invoke(["--unsupported-option"]);

    expect(commandFailure.status).toBe(1);
    expect(commandFailure.stderr).toContain("error:");
    expect(optionFailure.status).toBe(1);
    expect(optionFailure.stderr).toContain("unknown option");
    expect(optionFailure.stderr).not.toContain(" at ");
  });

  it("normalizes malformed option values", async () => {
    const result = await invoke(["--count", "not-a-number"], {
      createProgram: () => {
        const program = new Command().name("auren");
        program.addOption(
          new Option("--count <value>").argParser((value) => {
            if (!/^\d+$/.test(value)) {
              throw new Error("count must be numeric");
            }
            return value;
          }),
        );
        program.action(() => {});
        return program;
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("count must be numeric");
    expect(result.stderr).not.toContain("Error:");
  });

  it("normalizes unexpected thrown values without terminating the host", async () => {
    const result = await invoke([], {
      createProgram: () => {
        const program = new Command().name("auren");
        program.action(() => {
          throw { unexpected: true };
        });
        return program;
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("error: Unexpected CLI failure.\n");
    expect(result.stderr).not.toContain("at ");
  });
});
