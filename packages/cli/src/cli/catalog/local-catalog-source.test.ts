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
import type { Collection } from "@auren/schemas/collection";
import { afterEach, describe, expect, it } from "vitest";
import {
  CatalogMetadataError,
  CatalogUnavailableError,
  CollectionMetadataError,
  DuplicateCatalogIdError,
  MissingCollectionMemberError,
} from "./catalog-source.js";
import { createLocalCatalogSource } from "./local-catalog-source.js";

const validElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive hero section.",
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

const validCollection: Collection = {
  id: "saas-minimal",
  name: "SaaS Minimal",
  description: "A minimal SaaS collection.",
  category: "marketing",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["responsive"],
  frameworks: ["react"],
  blocks: ["hero-001"],
  metadata: {},
};

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function createFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-cli-catalog-"));
  fixtureRoots.push(root);
  return root;
}

async function writeCollection(
  root: string,
  category: string,
  directory: string,
  collection: unknown,
  extraFiles: Record<string, string> = {},
): Promise<string> {
  const collectionDir = path.join(root, category, directory);
  await mkdir(collectionDir, { recursive: true });
  await writeFile(
    path.join(collectionDir, "registry.json"),
    `${JSON.stringify(collection, null, 2)}\n`,
  );

  for (const [relativePath, content] of Object.entries(extraFiles)) {
    await writeFile(path.join(collectionDir, relativePath), content);
  }

  return collectionDir;
}

async function writeElement(
  root: string,
  category: string,
  type: string,
  directory: string,
  element: unknown,
): Promise<string> {
  const blockDir = path.join(root, category, type, directory);
  await mkdir(blockDir, { recursive: true });
  await writeFile(
    path.join(blockDir, "registry.json"),
    `${JSON.stringify(element, null, 2)}\n`,
  );
  return blockDir;
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

describe("createLocalCatalogSource", () => {
  it("loads an element by its exact ID", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);

    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.getById("hero-001")).resolves.toEqual(validElement);
  });

  it("keeps IDs case-sensitive and does not trim requests", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);

    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.getById("Hero-001")).resolves.toBeUndefined();
    await expect(source.getById(" hero-001 ")).resolves.toBeUndefined();
    await expect(
      source.getInstallableById("Hero-001"),
    ).resolves.toBeUndefined();
    await expect(
      source.getInstallableById(" hero-001 "),
    ).resolves.toBeUndefined();
  });

  it("associates exact-ID metadata with its physical block directory", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);

    const source = createLocalCatalogSource({ catalogRoot: root });

    const record = await source.getInstallableById("hero-001");

    expect(record?.element).toEqual(validElement);
    expect(record?.loadFiles).toEqual(expect.any(Function));
  });

  it("lists deterministic installable records and shares them with metadata listing", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);
    const navbarElement = {
      ...validElement,
      id: "navbar-001",
      category: "application-ui",
      type: "navbar",
    } as const;
    await writeElement(
      root,
      "application-ui",
      "navbar",
      "navbar-001",
      navbarElement,
    );

    const source = createLocalCatalogSource({ catalogRoot: root });

    const records = await source.listInstallable();

    expect(records.map(({ element }) => element)).toEqual([
      validElement,
      navbarElement,
    ]);
    expect(records.map(({ loadFiles }) => loadFiles)).toEqual([
      expect.any(Function),
      expect.any(Function),
    ]);
    await expect(source.list()).resolves.toEqual([validElement, navbarElement]);
  });

  it("returns undefined for an unknown ID", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);

    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.getById("missing-001")).resolves.toBeUndefined();
  });

  it("reports an unavailable catalog root", async () => {
    const root = path.join(await createFixture(), "missing");
    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.getById("hero-001")).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });

  it("reports malformed catalog metadata with its block directory", async () => {
    const root = await createFixture();
    const blockDir = await writeElement(root, "marketing", "hero", "hero-001", {
      ...validElement,
      category: "future-category",
    });
    const source = createLocalCatalogSource({ catalogRoot: root });

    const error = await source.getById("hero-001").catch((cause) => cause);

    expect(error).toBeInstanceOf(CatalogMetadataError);
    expect(error).toMatchObject({ blockDir });
    expect((error as CatalogMetadataError).message).toContain(blockDir);
  });

  it("rejects duplicate IDs across catalog directories", async () => {
    const root = await createFixture();
    const firstDir = await writeElement(
      root,
      "marketing",
      "hero",
      "hero-001",
      validElement,
    );
    const secondDir = await writeElement(
      root,
      "application-ui",
      "navbar",
      "navbar-001",
      { ...validElement, category: "application-ui", type: "navbar" },
    );
    const source = createLocalCatalogSource({ catalogRoot: root });

    const error = await source.getById("hero-001").catch((cause) => cause);

    expect(error).toBeInstanceOf(DuplicateCatalogIdError);
    expect(error).toMatchObject({
      id: "hero-001",
      firstBlockDir: firstDir,
      duplicateBlockDir: secondDir,
    });
  });

  it("does not modify the catalog while loading it", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);
    const before = await snapshotTree(root);
    const source = createLocalCatalogSource({ catalogRoot: root });

    await source.getById("hero-001");

    expect(await snapshotTree(root)).toEqual(before);
  });

  it("lists every catalog element in deterministic order", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);
    const navbarElement = {
      ...validElement,
      id: "navbar-001",
      category: "application-ui",
      type: "navbar",
    };
    await writeElement(
      root,
      "application-ui",
      "navbar",
      "navbar-001",
      navbarElement,
    );

    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.list()).resolves.toEqual([validElement, navbarElement]);
    await expect(source.list()).resolves.toEqual([validElement, navbarElement]);
  });

  it("shares the validated catalog between exact-ID lookup and listing", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);

    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.getById("hero-001")).resolves.toEqual(validElement);
    await expect(source.list()).resolves.toEqual([validElement]);
  });

  it("reports an unavailable catalog root through listing", async () => {
    const root = path.join(await createFixture(), "missing");
    const source = createLocalCatalogSource({ catalogRoot: root });

    await expect(source.list()).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it("reports malformed catalog metadata through listing", async () => {
    const root = await createFixture();
    const blockDir = await writeElement(root, "marketing", "hero", "hero-001", {
      ...validElement,
      category: "future-category",
    });
    const source = createLocalCatalogSource({ catalogRoot: root });

    const error = await source.list().catch((cause) => cause);

    expect(error).toBeInstanceOf(CatalogMetadataError);
    expect(error).toMatchObject({ blockDir });
  });

  it("rejects duplicate IDs through listing", async () => {
    const root = await createFixture();
    const firstDir = await writeElement(
      root,
      "marketing",
      "hero",
      "hero-001",
      validElement,
    );
    const secondDir = await writeElement(
      root,
      "application-ui",
      "navbar",
      "navbar-001",
      {
        ...validElement,
        id: "hero-001",
        category: "application-ui",
        type: "navbar",
      },
    );
    const source = createLocalCatalogSource({ catalogRoot: root });

    const error = await source.list().catch((cause) => cause);

    expect(error).toBeInstanceOf(DuplicateCatalogIdError);
    expect(error).toMatchObject({
      id: "hero-001",
      firstBlockDir: firstDir,
      duplicateBlockDir: secondDir,
    });
  });

  it("does not modify the catalog while listing it", async () => {
    const root = await createFixture();
    await writeElement(root, "marketing", "hero", "hero-001", validElement);
    const before = await snapshotTree(root);
    const source = createLocalCatalogSource({ catalogRoot: root });

    await source.list();

    expect(await snapshotTree(root)).toEqual(before);
  });

  it("loads validated Collections with authored members and defensive copies", async () => {
    const blocksRoot = await createFixture();
    const collectionsRoot = await createFixture();
    await writeElement(
      blocksRoot,
      "marketing",
      "hero",
      "hero-001",
      validElement,
    );
    await writeCollection(
      collectionsRoot,
      "marketing",
      "saas-minimal",
      validCollection,
    );
    const source = createLocalCatalogSource({
      catalogRoot: blocksRoot,
      collectionsRoot,
    });

    const record = await source.getInstallableCollectionById("saas-minimal");
    const collection = await record?.loadCollection();

    expect(collection).toEqual(validCollection);
    expect(record?.collection.blocks).toEqual(["hero-001"]);
    expect(await source.listCollections()).toEqual([validCollection]);
    if (collection !== undefined) {
      collection.blocks.push("mutated-001");
    }
    await expect(source.getCollectionById("saas-minimal")).resolves.toEqual(
      validCollection,
    );
  });

  it("rejects invalid Collection members and payload files", async () => {
    const blocksRoot = await createFixture();
    const collectionsRoot = await createFixture();
    await writeElement(
      blocksRoot,
      "marketing",
      "hero",
      "hero-001",
      validElement,
    );
    const collectionDir = await writeCollection(
      collectionsRoot,
      "marketing",
      "saas-minimal",
      { ...validCollection, blocks: ["missing-001"] },
      { "nested.txt": "unexpected\n" },
    );
    const source = createLocalCatalogSource({
      catalogRoot: blocksRoot,
      collectionsRoot,
    });

    await expect(source.listCollections()).rejects.toBeInstanceOf(
      CollectionMetadataError,
    );

    await rm(path.join(collectionDir, "nested.txt"));
    await writeCollection(collectionsRoot, "marketing", "saas-minimal", {
      ...validCollection,
      blocks: ["missing-001"],
    });
    const missingSource = createLocalCatalogSource({
      catalogRoot: blocksRoot,
      collectionsRoot,
    });
    await expect(
      missingSource.getCollectionById("saas-minimal"),
    ).rejects.toBeInstanceOf(MissingCollectionMemberError);
    expect(collectionDir).toContain(collectionsRoot);
  });
});
