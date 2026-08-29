import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runCli, type RunCliOptions } from "../../command/runner.js";
import type { InitPrompt } from "./init-prompt.js";

interface CliResult {
  status: number;
  stdout: string;
  stderr: string;
}

async function createFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "auren-cli-command-"));
}

async function writeJson(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeFile(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

async function installReactV4Project(root: string): Promise<void> {
  await mkdir(path.join(root, "src"));
  await mkdir(path.join(root, "node_modules/tailwindcss"), {
    recursive: true,
  });
  await writeJson(root, "node_modules/tailwindcss/package.json", {
    name: "tailwindcss",
    version: "4.1.3",
  });
  await writeJson(root, "package.json", {
    dependencies: { react: "^19.0.0", tailwindcss: "^4.1.0" },
  });
}

async function invoke(
  args: readonly string[],
  options: Omit<RunCliOptions, "stdout" | "stderr"> = {},
  cwd = process.cwd(),
): Promise<CliResult> {
  let stdout = "";
  let stderr = "";

  const previousCwd = process.cwd();
  process.chdir(cwd);

  try {
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
  } finally {
    process.chdir(previousCwd);
  }
}

describe("auren init command", () => {
  it("lists init in the root help output", async () => {
    const result = await invoke(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("init");
  });

  it("shows init help with the --force option without touching the project", async () => {
    const root = await createFixture();

    try {
      const result = await invoke(["init", "--help"], {}, root);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Usage: auren init");
      expect(result.stdout).toContain("--force");

      const { readdir } = await import("node:fs/promises");
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps successful output on stdout and failures on stderr with status 1", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", { dependencies: {} });

      const failure = await invoke(["init"], {}, root);

      expect(failure.status).toBe(1);
      expect(failure.stdout).not.toBe("");
      expect(failure.stderr).toContain("error:");
      expect(failure.stderr).toContain("React");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes a schema-valid configuration on success", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);

      const result = await invoke(["init"], {}, root);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("auren.json written to");

      const configuration = JSON.parse(
        await readFile(path.join(root, "auren.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(configuration).toEqual({
        framework: "react",
        tailwind: true,
        components: "src/components/auren",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses the interactive prompt stub to override the destination", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);

      const prompt = vi.fn<InitPrompt>(async (defaultDestination) => {
        expect(defaultDestination).toBe("src/components/auren");
        return { kind: "value", value: "src/custom" };
      });

      const result = await invoke(
        ["init"],
        { interactive: true, prompt },
        root,
      );

      expect(result.status).toBe(0);
      expect(prompt).toHaveBeenCalledTimes(1);

      const configuration = JSON.parse(
        await readFile(path.join(root, "auren.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(configuration.components).toBe("src/custom");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects an unsafe interactive override without writing", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);

      const result = await invoke(
        ["init"],
        {
          interactive: true,
          prompt: async () => ({ kind: "value", value: "../outside" }),
        },
        root,
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("error:");

      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(root);
      expect(entries).not.toContain("auren.json");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("aborts without writes when the interactive prompt is cancelled", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);

      const result = await invoke(
        ["init"],
        {
          interactive: true,
          prompt: async () => ({ kind: "cancelled" }),
        },
        root,
      );

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("error:");
      expect(result.stderr).toContain("cancelled");

      const { readdir } = await import("node:fs/promises");
      const entries = await readdir(root);
      expect(entries).not.toContain("auren.json");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
