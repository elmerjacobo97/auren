import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { EOL, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it, vi } from "vitest";
import { createRootProgram } from "./program.js";
import { runCli, type RunCliOptions } from "./runner.js";
import type { CatalogSource } from "../catalog/catalog-source.js";
import { createLocalCatalogSource } from "../catalog/local-catalog-source.js";
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
    const program = createRootProgram(createTerminal({ color: false }));

    expect(noArguments).toEqual(help);
    expect(noArguments.status).toBe(0);
    expect(program.commands).toHaveLength(4);
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "info",
      "search",
      "add",
    ]);
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

const infoElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["mobile-first", "responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

describe("auren info command", () => {
  it("advertises info in root help", async () => {
    const result = await invoke(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("info");
    expect(result.stderr).toBe("");
  });

  it("shows info help without accessing the catalog", async () => {
    const getById = vi.fn(async () => infoElement);
    const list = vi.fn(async () => [infoElement]);
    const source: CatalogSource = { getById, list };

    const result = await invoke(["info", "--help"], {
      catalogSource: source,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: auren info <id>");
    expect(result.stderr).toBe("");
    expect(getById).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", ["info"]],
    ["extra", ["info", "hero-001", "extra"]],
  ] as const)(
    "rejects %s info arguments before source access",
    async (_, args) => {
      const getById = vi.fn(async () => infoElement);
      const list = vi.fn(async () => [infoElement]);
      const result = await invoke(args, {
        catalogSource: { getById, list },
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("error:");
      expect(getById).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    },
  );

  it("uses an injected source and writes successful output only to stdout", async () => {
    const getById = vi.fn(async (id: string) =>
      id === infoElement.id ? infoElement : undefined,
    );

    const result = await invoke(["info", "hero-001"], {
      catalogSource: { getById, list: vi.fn(async () => [infoElement]) },
    });

    expect(result).toEqual({
      status: 0,
      stdout: expect.stringContaining("ID: hero-001"),
      stderr: "",
    });
    expect(getById).toHaveBeenCalledWith("hero-001");
  });

  it("reports unknown IDs without a partial result", async () => {
    const result = await invoke(["info", "missing-001"], {
      catalogSource: {
        getById: vi.fn(async () => undefined),
        list: vi.fn(async () => []),
      },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Catalog element not found");
  });

  it("reports an unavailable local catalog", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-runner-"));

    try {
      const result = await invoke(["info", "hero-001"], {
        catalogSource: createLocalCatalogSource({
          catalogRoot: `${fixtureRoot}/missing`,
        }),
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Local catalog is unavailable");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("reports invalid local catalog metadata without a stack trace", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-runner-"));
    const blockDir = `${fixtureRoot}/marketing/hero/hero-001`;

    try {
      await mkdir(blockDir, { recursive: true });
      await writeFile(`${blockDir}/registry.json`, "{ invalid");

      const result = await invoke(["info", "hero-001"], {
        catalogSource: createLocalCatalogSource({ catalogRoot: fixtureRoot }),
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Invalid catalog metadata");
      expect(result.stderr).toContain(blockDir);
      expect(result.stderr).not.toContain("\n    at ");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});

const searchNavbarElement: CatalogElement = {
  id: "navbar-001",
  name: "Glass navigation bar",
  description: "A glassy responsive navigation bar.",
  category: "application-ui",
  type: "navbar",
  styles: ["glass"],
  industries: ["fintech"],
  features: ["responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

describe("auren search command", () => {
  it("advertises search in root help", async () => {
    const result = await invoke(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("search");
    expect(result.stderr).toBe("");
  });

  it("shows search help without accessing the catalog", async () => {
    const list = vi.fn(async () => [infoElement]);
    const source: CatalogSource = {
      getById: vi.fn(async () => undefined),
      list,
    };

    const result = await invoke(["search", "--help"], {
      catalogSource: source,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: auren search [query]");
    expect(result.stderr).toBe("");

    for (const option of [
      "--type",
      "--category",
      "--style",
      "--industry",
      "--feature",
    ]) {
      expect(result.stdout).toContain(option);
    }

    expect(list).not.toHaveBeenCalled();
  });

  it("rejects extra positional arguments before source access", async () => {
    const list = vi.fn(async () => [infoElement]);

    const result = await invoke(["search", "hero", "extra"], {
      catalogSource: { getById: vi.fn(async () => undefined), list },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error:");
    expect(list).not.toHaveBeenCalled();
  });

  it("rejects an invalid filter value before catalog access", async () => {
    const list = vi.fn(async () => [infoElement]);

    const result = await invoke(["search", "--style", "nonexistent"], {
      catalogSource: { getById: vi.fn(async () => undefined), list },
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error:");
    expect(result.stderr).toContain("--style");
    expect(result.stderr).toContain("nonexistent");
    expect(list).not.toHaveBeenCalled();
  });

  it("uses an injected source and writes successful output only to stdout", async () => {
    const list = vi.fn(async () => [searchNavbarElement, infoElement]);

    const result = await invoke(["search", "hero"], {
      catalogSource: { getById: vi.fn(async () => undefined), list },
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("1 result");
    expect(result.stdout).toContain("hero-001");
    expect(result.stdout).toContain("Product launch hero");
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("reports an unavailable local catalog", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-runner-"));

    try {
      const result = await invoke(["search", "hero"], {
        catalogSource: createLocalCatalogSource({
          catalogRoot: `${fixtureRoot}/missing`,
        }),
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Local catalog is unavailable");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("reports invalid local catalog metadata without a stack trace", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-cli-runner-"));
    const blockDir = `${fixtureRoot}/marketing/hero/hero-001`;

    try {
      await mkdir(blockDir, { recursive: true });
      await writeFile(`${blockDir}/registry.json`, "{ invalid");

      const result = await invoke(["search", "hero"], {
        catalogSource: createLocalCatalogSource({ catalogRoot: fixtureRoot }),
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain("Invalid catalog metadata");
      expect(result.stderr).toContain(blockDir);
      expect(result.stderr).not.toContain("\n    at ");
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });
});
