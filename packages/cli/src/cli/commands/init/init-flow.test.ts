import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runInitFlow, type InitPromptResult } from "./init-flow.js";
import { createTerminal } from "../../terminal/terminal.js";

interface CliResult {
  stdout: string;
  stderr: string;
}

async function createFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "auren-cli-init-"));
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

async function installTailwindV4(root: string): Promise<void> {
  await mkdir(path.join(root, "node_modules/tailwindcss"), {
    recursive: true,
  });
  await writeJson(root, "node_modules/tailwindcss/package.json", {
    name: "tailwindcss",
    version: "4.1.3",
  });
}

async function installReactV4Project(root: string, src = true): Promise<void> {
  if (src) {
    await mkdir(path.join(root, "src"));
  }
  await installTailwindV4(root);
  await writeJson(root, "package.json", {
    dependencies: { react: "^19.0.0", tailwindcss: "^4.1.0" },
  });
}

async function run(
  root: string,
  options: {
    force?: boolean;
    interactive?: boolean;
    prompt?: (defaultDestination: string) => Promise<InitPromptResult>;
  } = {},
): Promise<CliResult> {
  let stdout = "";
  let stderr = "";

  const terminal = createTerminal({
    color: false,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
  });

  const status = await runInitFlow({
    projectDir: root,
    terminal,
    force: options.force ?? false,
    interactive: options.interactive ?? false,
    prompt:
      options.prompt ??
      (async () => ({ kind: "value", value: "components/auren" })),
  });

  expect(status).toBe(0);
  return { stdout, stderr };
}

async function runExpectingFailure(
  root: string,
  options: { force?: boolean } = {},
): Promise<{ status: number; stderr: string }> {
  let stderr = "";

  const terminal = createTerminal({
    color: false,
    stdout: () => {},
    stderr: (text) => {
      stderr += text;
    },
  });

  let status: number;

  try {
    status = await runInitFlow({
      projectDir: root,
      terminal,
      force: options.force ?? false,
      interactive: false,
      prompt: async () => ({ kind: "value", value: "components/auren" }),
    });
  } catch (error) {
    const exitStatus = (error as { status?: unknown }).status;
    status = typeof exitStatus === "number" ? exitStatus : 1;
  }

  expect(status).toBe(1);
  return { status, stderr };
}

async function installTailwindVersion(
  root: string,
  version: string,
  declared: string,
): Promise<void> {
  await mkdir(path.join(root, "node_modules/tailwindcss"), {
    recursive: true,
  });
  await writeJson(root, "node_modules/tailwindcss/package.json", {
    name: "tailwindcss",
    version,
  });
  await writeJson(root, "package.json", {
    dependencies: { react: "^19.0.0", tailwindcss: declared },
  });
}

function listFiles(root: string): Promise<string[]> {
  return readdir(root);
}

async function snapshotTree(root: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        snapshot.set(relative, "<directory>");
        await walk(path.join(dir, entry.name), relative);
      } else if (entry.isFile()) {
        snapshot.set(
          relative,
          await readFile(path.join(dir, entry.name), "utf8"),
        );
      }
    }
  }

  await walk(root, "");
  return snapshot;
}

describe("runInitFlow", () => {
  it("initializes a src-based React + Tailwind v4 project with the default destination", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);

      const { stdout } = await run(root);

      expect(stdout).toContain("Detected react project");
      expect(stdout).toContain("Tailwind CSS found (v4)");
      expect(stdout).toContain("auren.json written to");

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

  it("uses a root-relative destination when the project has no src directory", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root, false);

      await run(root);

      const configuration = JSON.parse(
        await readFile(path.join(root, "auren.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(configuration.components).toBe("components/auren");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("carries shadcn aliases and the integration marker into the configuration", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);
      await writeJson(root, "components.json", {
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          invalid: false,
        },
      });

      await run(root);

      const configuration = JSON.parse(
        await readFile(path.join(root, "auren.json"), "utf8"),
      ) as Record<string, unknown>;
      expect(configuration.aliases).toEqual({
        components: "@/components",
        utils: "@/lib/utils",
      });
      expect(configuration.integrations).toEqual({
        shadcn: { enabled: true },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a non-React project", async () => {
    const root = await createFixture();

    try {
      await installTailwindV4(root);
      await writeJson(root, "package.json", {
        dependencies: { tailwindcss: "^4.1.0" },
      });

      const { stderr } = await runExpectingFailure(root);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("React");
      expect(await listFiles(root)).toEqual(["node_modules", "package.json"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a project without Tailwind evidence", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0" },
      });

      const { stderr } = await runExpectingFailure(root);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("Tailwind CSS v4");
      expect(await listFiles(root)).toEqual(["package.json"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a project with non-v4 Tailwind evidence", async () => {
    const root = await createFixture();

    try {
      await installTailwindVersion(root, "3.4.17", "^3.4.0");

      const { stderr } = await runExpectingFailure(root);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("Tailwind CSS v4");
      expect(stderr).toContain("3.4.17");
      expect(await listFiles(root)).toEqual(["node_modules", "package.json"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a project with unknown-major Tailwind evidence", async () => {
    const root = await createFixture();

    try {
      await installTailwindVersion(root, "3", "^3");

      const { stderr } = await runExpectingFailure(root);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("Tailwind CSS v4");
      expect(await listFiles(root)).toEqual(["node_modules", "package.json"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("renders detection diagnostics as warnings without aborting", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0", tailwindcss: "^4.1.0" },
        packageManager: "pnpm@11.21.0",
      });
      await writeFile(path.join(root, "package-lock.json"), "{}");
      await writeFile(path.join(root, "pnpm-lock.yaml"), "");

      const { stderr } = await run(root);

      expect(stderr).toContain("warning:");
      expect(stderr).toContain("packageManager selects pnpm");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("aborts without writes when detection fails", async () => {
    const root = await createFixture();

    try {
      const unusable = path.join(root, "unusable");
      await writeFile(unusable, "not a directory");

      const { stderr } = await runExpectingFailure(unusable);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("detection");
      expect(await listFiles(root)).toEqual(["unusable"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("runInitFlow with an existing configuration", () => {
  const existingConfiguration = {
    framework: "react",
    tailwind: true,
    components: "components/auren",
  };

  async function installProjectWithConfiguration(
    root: string,
    configuration: unknown,
  ): Promise<void> {
    await installReactV4Project(root);
    await writeJson(root, "auren.json", configuration);
  }

  it("fails without --force and leaves a valid configuration unchanged", async () => {
    const root = await createFixture();

    try {
      await installProjectWithConfiguration(root, existingConfiguration);
      const before = await readFile(path.join(root, "auren.json"), "utf8");

      const { stderr } = await runExpectingFailure(root);

      expect(stderr).toContain("error:");
      expect(stderr).toContain("--force");
      expect(await readFile(path.join(root, "auren.json"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("replaces a valid configuration with --force", async () => {
    const root = await createFixture();

    try {
      await installProjectWithConfiguration(root, existingConfiguration);

      await run(root, { force: true });

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

  it("fails on malformed configuration with and without --force, leaving it unchanged", async () => {
    for (const force of [false, true]) {
      const root = await createFixture();

      try {
        await installProjectWithConfiguration(root, {
          framework: "react",
          tailwind: true,
          components: "../outside",
        });
        const before = await readFile(path.join(root, "auren.json"), "utf8");

        const { stderr } = await runExpectingFailure(root, { force });

        expect(stderr).toContain("error:");
        expect(stderr).toContain("configuration");
        expect(await readFile(path.join(root, "auren.json"), "utf8")).toBe(
          before,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("fails on malformed JSON with and without --force, leaving it unchanged", async () => {
    for (const force of [false, true]) {
      const root = await createFixture();

      try {
        await installReactV4Project(root);
        await writeFile(path.join(root, "auren.json"), "{ not json");
        const before = await readFile(path.join(root, "auren.json"), "utf8");

        const { stderr } = await runExpectingFailure(root, { force });

        expect(stderr).toContain("error:");
        expect(stderr).toContain("configuration");
        expect(await readFile(path.join(root, "auren.json"), "utf8")).toBe(
          before,
        );
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });
});

describe("runInitFlow fixture integrity", () => {
  it("only adds auren.json to the project on success", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);
      await writeJson(root, "components.json", {
        aliases: { components: "@/components" },
      });
      const before = await snapshotTree(root);

      await run(root);

      const after = await snapshotTree(root);

      expect(after.size).toBe(before.size + 1);

      for (const [relativePath, content] of before) {
        expect(after.get(relativePath)).toBe(content);
      }

      expect(after.has("auren.json")).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("leaves the project fully untouched on a framework rejection", async () => {
    const root = await createFixture();

    try {
      await installTailwindV4(root);
      await writeJson(root, "package.json", {
        dependencies: { tailwindcss: "^4.1.0" },
      });
      const before = await snapshotTree(root);

      await runExpectingFailure(root);

      expect(await snapshotTree(root)).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("leaves the project fully untouched on a Tailwind rejection", async () => {
    const root = await createFixture();

    try {
      await installTailwindVersion(root, "3.4.17", "^3.4.0");
      const before = await snapshotTree(root);

      await runExpectingFailure(root);

      expect(await snapshotTree(root)).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("leaves the project fully untouched when an existing configuration blocks init", async () => {
    const root = await createFixture();

    try {
      await installReactV4Project(root);
      await writeJson(root, "auren.json", {
        framework: "react",
        tailwind: true,
        components: "components/auren",
      });
      const before = await snapshotTree(root);

      await runExpectingFailure(root);

      expect(await snapshotTree(root)).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
