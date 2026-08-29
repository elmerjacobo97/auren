import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  CircularDependencyError,
  MissingAurenDependencyError,
  UnknownBlockError,
  resolveBlock,
} from "./resolve/resolve.js";
import {
  ConflictingPackageVersionsError,
  collectPackageDependencies,
  createDependencyPlan,
} from "./dependencies/dependency-plan.js";
import {
  BlockMetadataError,
  loadBlockMetadata,
} from "./load/load-block-metadata.js";
import {
  MissingBlockFileError,
  loadBlockFiles,
} from "./load/load-block-files.js";
import { searchBlocks } from "./search/search.js";
import { validateCompatibility } from "./compatibility/compatibility.js";
import { LocalRegistry } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it } from "vitest";

function createElement(
  id: string,
  changes: Partial<CatalogElement> = {},
): CatalogElement {
  return {
    id,
    name: `Element ${id}`,
    description: `Complete catalog element ${id}.`,
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    dependencies: [],
    files: [{ path: "component.tsx", kind: "component" }],
    metadata: {},
    ...changes,
  };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw");
}

describe("Core public capability modules", () => {
  it("exposes every operation from its capability module", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001");
    registry.register(element);

    expect(
      searchBlocks(registry, { text: "hero" }).map(({ id }) => id),
    ).toEqual(["hero-001"]);
    expect(
      resolveBlock(registry, "hero-001").blocks.map(({ id }) => id),
    ).toEqual(["hero-001"]);
    expect(collectPackageDependencies(registry, "hero-001")).toEqual([]);
    expect(createDependencyPlan(registry, "hero-001")).toEqual({
      auren: ["hero-001"],
      packages: [],
    });
    expect(validateCompatibility(element, { frameworks: ["react"] })).toEqual({
      compatible: true,
      missing: { frameworks: [], features: [] },
    });
  });

  it("loads metadata and resolves files from their capability modules", async () => {
    const fixtureRoot = await mkdtemp(
      path.join(tmpdir(), "auren-core-entrypoint-"),
    );

    try {
      const element = createElement("hero-001", {
        files: [
          {
            path: "component.tsx",
            kind: "component",
            content: "export function Hero() { return null; }",
          },
        ],
      });
      await writeFile(
        path.join(fixtureRoot, "registry.json"),
        `${JSON.stringify(element, null, 2)}\n`,
      );

      const loaded = await loadBlockMetadata(fixtureRoot);
      const files = await loadBlockFiles(fixtureRoot, loaded);

      expect(loaded).toEqual(element);
      expect(files).toEqual([
        {
          path: "component.tsx",
          kind: "component",
          target: undefined,
          content: "export function Hero() { return null; }",
        },
      ]);
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("exposes brand-named error classes discriminated by instanceof", () => {
    const metadataRoot = path.join(tmpdir(), "auren-missing-dir");
    const registry = new LocalRegistry();
    registry.register(
      createElement("hero-001", {
        dependencies: [
          { kind: "auren", id: "missing-001" },
          { kind: "package", name: "@acme/ui", version: "^1.0.0" },
        ],
      }),
    );

    const errors = [
      captureError(() => resolveBlock(registry, "unknown-001")),
      captureError(() => resolveBlock(registry, "hero-001")),
      captureError(() => resolveBlock(registry, "missing-001")),
      captureError(() => collectPackageDependencies(registry, "unknown-001")),
      new BlockMetadataError(metadataRoot, new SyntaxError("bad")),
      new MissingBlockFileError("component.tsx"),
    ];

    expect(errors[0]).toBeInstanceOf(UnknownBlockError);
    expect(errors[1]).toBeInstanceOf(MissingAurenDependencyError);
    expect(errors[2]).toBeInstanceOf(UnknownBlockError);
    expect(errors[3]).toBeInstanceOf(UnknownBlockError);
    expect(errors[4]).toBeInstanceOf(BlockMetadataError);
    expect(errors[5]).toBeInstanceOf(MissingBlockFileError);
    expect(errors.map((error) => (error as Error).name)).toEqual([
      "UnknownBlockError",
      "MissingAurenDependencyError",
      "UnknownBlockError",
      "UnknownBlockError",
      "BlockMetadataError",
      "MissingBlockFileError",
    ]);
  });

  it("rejects resolution cycles from the resolve capability", () => {
    const registry = new LocalRegistry();
    registry.registerMany([
      createElement("cycle-a-001", {
        dependencies: [{ kind: "auren", id: "cycle-b-001" }],
      }),
      createElement("cycle-b-001", {
        dependencies: [{ kind: "auren", id: "cycle-a-001" }],
      }),
    ]);

    const error = captureError(() => resolveBlock(registry, "cycle-a-001"));

    expect(error).toBeInstanceOf(CircularDependencyError);
    expect(error).toMatchObject({ name: "CircularDependencyError" });
  });

  it("rejects conflicting package versions from the dependency capability", () => {
    const registry = new LocalRegistry();
    registry.registerMany([
      createElement("inner-001", {
        dependencies: [
          { kind: "package", name: "@acme/ui", version: "^1.0.0" },
        ],
      }),
      createElement("outer-001", {
        dependencies: [
          { kind: "auren", id: "inner-001" },
          { kind: "package", name: "@acme/ui", version: "^2.0.0" },
        ],
      }),
    ]);

    const error = captureError(() =>
      collectPackageDependencies(registry, "outer-001"),
    );

    expect(error).toBeInstanceOf(ConflictingPackageVersionsError);
    expect(error).toMatchObject({
      packageName: "@acme/ui",
      ranges: ["^1.0.0", "^2.0.0"],
      name: "ConflictingPackageVersionsError",
    });
  });

  it("never mutates the registry when operations fail", async () => {
    const fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-mutation-"));
    const registry = new LocalRegistry();
    const element = createElement("hero-001", {
      dependencies: [{ kind: "auren", id: "missing-001" }],
    });
    registry.register(element);

    const before = {
      size: registry.size,
      list: registry.list(),
      byId: registry.getById("hero-001"),
    };

    captureError(() => resolveBlock(registry, "hero-001"));
    captureError(() => createDependencyPlan(registry, "hero-001"));
    captureError(() => resolveBlock(registry, "unknown-001"));
    await loadBlockMetadata(fixtureRoot).catch(() => undefined);
    await loadBlockFiles(fixtureRoot, element).catch(() => undefined);
    await rm(fixtureRoot, { recursive: true, force: true });

    expect(registry.size).toBe(before.size);
    expect(registry.list()).toEqual(before.list);
    expect(registry.getById("hero-001")).toEqual(before.byId);
  });
});
