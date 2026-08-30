import { readFileSync } from "node:fs";
import { EOL } from "node:os";
import { fileURLToPath } from "node:url";
import { Command, Option } from "commander";
import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it, vi } from "vitest";
import { createRootProgram } from "./program.js";
import { runCli, type RunCliOptions } from "./runner.js";
import type { CatalogSource } from "../catalog/catalog-source.js";
import type {
  RemoteCatalogResponse,
  RemoteFetch,
} from "../catalog/remote-catalog-source.js";
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

function createJsonResponse(
  value: unknown,
  status = 200,
  contentType = "application/json; charset=utf-8",
): RemoteCatalogResponse {
  const body = JSON.stringify(value);

  return {
    status,
    statusText: status === 200 ? "OK" : "Unavailable",
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    text: async () => body,
  };
}

function createRemoteFetch(
  handler: (url: string) => Promise<RemoteCatalogResponse>,
): { fetch: RemoteFetch; calls: string[]; spy: ReturnType<typeof vi.fn> } {
  const calls: string[] = [];
  const spy = vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  });

  return { fetch: spy as unknown as RemoteFetch, calls, spy };
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

  it("keeps command help request-free and advertises the Registry override", async () => {
    const { fetch, spy } = createRemoteFetch(async () =>
      createJsonResponse({ schemaVersion: 1, blocks: [] }),
    );

    for (const args of [
      ["info", "--help"],
      ["search", "--help"],
      ["add", "--help"],
    ] as const) {
      const result = await invoke(args, { fetch });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("--registry-url");
      expect(result.stderr).toBe("");
    }

    expect(spy).not.toHaveBeenCalled();
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
    expect(result.stdout).toContain("--registry-url");
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

  it("uses an injected source before attempting remote transport", async () => {
    const getById = vi.fn(async (id: string) =>
      id === infoElement.id ? infoElement : undefined,
    );
    const { fetch, spy } = createRemoteFetch(async () => {
      throw new Error("injected source should win");
    });

    const result = await invoke(["info", "hero-001"], {
      catalogSource: { getById, list: vi.fn(async () => [infoElement]) },
      fetch,
    });

    expect(result).toEqual({
      status: 0,
      stdout: expect.stringContaining("ID: hero-001"),
      stderr: "",
    });
    expect(getById).toHaveBeenCalledWith("hero-001");
    expect(spy).not.toHaveBeenCalled();
  });

  it("applies command Registry URLs before environment URLs", async () => {
    const { fetch, calls } = createRemoteFetch(async () =>
      createJsonResponse({ schemaVersion: 1, blocks: [infoElement] }),
    );

    const commandResult = await invoke(
      [
        "info",
        "hero-001",
        "--registry-url",
        "https://command.example.test/catalog",
      ],
      {
        env: { AUREN_REGISTRY_URL: "https://environment.example.test/catalog" },
        fetch,
      },
    );

    expect(commandResult.status).toBe(0);
    expect(calls).toEqual([
      "https://command.example.test/catalog/registry.json",
    ]);

    calls.splice(0);
    const environmentResult = await invoke(["info", "hero-001"], {
      env: { AUREN_REGISTRY_URL: "https://environment.example.test/catalog" },
      fetch,
    });

    expect(environmentResult.status).toBe(0);
    expect(calls).toEqual([
      "https://environment.example.test/catalog/registry.json",
    ]);
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

  it("reports an unavailable remote Registry without a stack trace", async () => {
    const { fetch } = createRemoteFetch(async () => {
      throw new Error("socket unavailable");
    });

    const result = await invoke(["info", "hero-001"], {
      registryUrl: "https://registry.example.test",
      fetch,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unable to reach remote Registry resource");
    expect(result.stderr).not.toContain("\n    at ");
  });

  it("reports an invalid remote index without a response body or stack trace", async () => {
    const { fetch } = createRemoteFetch(async () =>
      createJsonResponse({ schemaVersion: 2, blocks: [] }),
    );

    const result = await invoke(["info", "hero-001"], {
      registryUrl: "https://registry.example.test",
      fetch,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid remote Registry resource");
    expect(result.stderr).not.toContain("\n    at ");
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
    expect(result.stdout).toContain("--registry-url");
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

  it("searches remote index metadata without downloading block details", async () => {
    const { fetch, calls } = createRemoteFetch(async () =>
      createJsonResponse({
        schemaVersion: 1,
        blocks: [searchNavbarElement, infoElement],
      }),
    );

    const result = await invoke(
      ["search", "hero", "--registry-url", "https://command.example.test"],
      { fetch },
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("1 result");
    expect(result.stdout).toContain("hero-001");
    expect(calls).toEqual(["https://command.example.test/registry.json"]);
  });

  it("reports an unavailable remote Registry without a stack trace", async () => {
    const { fetch } = createRemoteFetch(async () => {
      throw new Error("socket unavailable");
    });

    const result = await invoke(["search", "hero"], {
      registryUrl: "https://registry.example.test",
      fetch,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unable to reach remote Registry resource");
    expect(result.stderr).not.toContain("\n    at ");
  });

  it("reports an invalid remote index without a response body or stack trace", async () => {
    const { fetch } = createRemoteFetch(async () =>
      createJsonResponse({ schemaVersion: 2, blocks: [] }),
    );

    const result = await invoke(["search", "hero"], {
      registryUrl: "https://registry.example.test",
      fetch,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid remote Registry resource");
    expect(result.stderr).not.toContain("\n    at ");
  });
});
