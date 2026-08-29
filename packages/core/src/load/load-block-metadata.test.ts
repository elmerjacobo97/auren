import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalRegistry } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BlockMetadataError, loadBlockMetadata } from "./load-block-metadata";

const validElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive hero section with a product screenshot.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: { author: "Auren" },
};

describe("loadBlockMetadata", () => {
  let fixtureRoot: string;

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-metadata-"));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it("loads a valid registry.json into an equivalent element", async () => {
    await writeFile(
      path.join(fixtureRoot, "registry.json"),
      `${JSON.stringify(validElement, null, 2)}\n`,
    );

    const element = await loadBlockMetadata(fixtureRoot);

    expect(element).toEqual(validElement);

    const registry = new LocalRegistry();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.getById(validElement.id)).toBeUndefined();
  });

  it("rejects malformed JSON with BlockMetadataError and the parse cause", async () => {
    await writeFile(path.join(fixtureRoot, "registry.json"), "{\n");

    const error = await loadBlockMetadata(fixtureRoot).catch((cause) => cause);

    expect(error).toBeInstanceOf(BlockMetadataError);
    expect(error).toMatchObject({
      blockDir: fixtureRoot,
      name: "BlockMetadataError",
    });
    expect((error as BlockMetadataError).cause).toBeInstanceOf(SyntaxError);
  });

  it("rejects schema-invalid metadata with BlockMetadataError and the Zod cause", async () => {
    await writeFile(
      path.join(fixtureRoot, "registry.json"),
      JSON.stringify({ ...validElement, category: "future-category" }),
    );

    const error = await loadBlockMetadata(fixtureRoot).catch((cause) => cause);

    expect(error).toBeInstanceOf(BlockMetadataError);
    expect(error).toMatchObject({
      blockDir: fixtureRoot,
      name: "BlockMetadataError",
    });
    expect((error as BlockMetadataError).cause).toMatchObject({
      name: "ZodError",
    });
  });

  it("rejects a missing registry.json with BlockMetadataError", async () => {
    const error = await loadBlockMetadata(fixtureRoot).catch((cause) => cause);

    expect(error).toBeInstanceOf(BlockMetadataError);
    expect(error).toMatchObject({
      blockDir: fixtureRoot,
      name: "BlockMetadataError",
    });
    expect((error as BlockMetadataError).cause).toBeInstanceOf(Error);
  });
});
