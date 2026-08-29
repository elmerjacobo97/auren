import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../command/runner.js";
import { createLocalCatalogSource } from "../../catalog/local-catalog-source.js";

const element: CatalogElement = {
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
  metadata: { author: "Auren" },
};

const fixtureRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function createFixture(): Promise<{
  consumerRoot: string;
  catalogRoot: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-cli-search-readonly-"));
  fixtureRoots.push(root);

  const consumerRoot = path.join(root, "consumer");
  const catalogRoot = path.join(root, "catalog");

  await mkdir(path.join(consumerRoot, "src/components"), { recursive: true });
  await writeFile(
    path.join(consumerRoot, "auren.json"),
    '{"framework":"react","tailwind":true,"components":"src/components"}\n',
  );
  await writeFile(
    path.join(consumerRoot, "src/components/existing.tsx"),
    "export const Existing = () => null;\n",
  );
  await mkdir(path.join(catalogRoot, "marketing/hero/hero-001"), {
    recursive: true,
  });
  await writeFile(
    path.join(catalogRoot, "marketing/hero/hero-001/registry.json"),
    `${JSON.stringify(element, null, 2)}\n`,
  );

  return { consumerRoot, catalogRoot };
}

async function snapshotTree(root: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  async function visit(directory: string, prefix: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        snapshot.set(relativePath, "<directory>");
        await visit(entryPath, relativePath);
      } else {
        snapshot.set(relativePath, await readFile(entryPath, "utf8"));
      }
    }
  }

  await visit(root, "");
  return snapshot;
}

async function invoke(
  consumerRoot: string,
  catalogRoot: string,
  args: readonly string[],
): Promise<{ status: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  const previousCwd = process.cwd();
  process.chdir(consumerRoot);

  try {
    const status = await runCli(["node", "auren", "search", ...args], {
      catalogSource: createLocalCatalogSource({ catalogRoot }),
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

describe("auren search read-only behavior", () => {
  it("leaves the consumer project and catalog unchanged after success", async () => {
    const { consumerRoot, catalogRoot } = await createFixture();
    const consumerBefore = await snapshotTree(consumerRoot);
    const catalogBefore = await snapshotTree(catalogRoot);

    const result = await invoke(consumerRoot, catalogRoot, ["hero"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("hero-001");
    expect(await snapshotTree(consumerRoot)).toEqual(consumerBefore);
    expect(await snapshotTree(catalogRoot)).toEqual(catalogBefore);
  });

  it("leaves the catalog unchanged after a catalog metadata failure", async () => {
    const root = await mkdtemp(
      path.join(tmpdir(), "auren-cli-search-readonly-"),
    );
    fixtureRoots.push(root);

    const consumerRoot = path.join(root, "consumer");
    const catalogRoot = path.join(root, "catalog");
    const blockDir = path.join(catalogRoot, "marketing/hero/hero-001");

    await mkdir(path.join(consumerRoot, "src/components"), { recursive: true });
    await writeFile(
      path.join(consumerRoot, "auren.json"),
      '{"framework":"react","tailwind":true,"components":"src/components"}\n',
    );
    await mkdir(blockDir, { recursive: true });
    await writeFile(path.join(blockDir, "registry.json"), "{ invalid");

    const consumerBefore = await snapshotTree(consumerRoot);
    const catalogBefore = await snapshotTree(catalogRoot);

    const result = await invoke(consumerRoot, catalogRoot, []);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Invalid catalog metadata");
    expect(await snapshotTree(consumerRoot)).toEqual(consumerBefore);
    expect(await snapshotTree(catalogRoot)).toEqual(catalogBefore);
  });

  it("does not install files, resolve dependencies, or prepare an add", async () => {
    const { consumerRoot, catalogRoot } = await createFixture();

    const result = await invoke(consumerRoot, catalogRoot, []);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 result");
    expect(result.stdout).not.toContain("Files:");

    const componentEntries = await readdir(
      path.join(consumerRoot, "src/components"),
    );
    expect(componentEntries).toEqual(["existing.tsx"]);
  });
});
