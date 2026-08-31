import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";
import {
  type CollectionFilter,
  DuplicateCollectionError,
  IncompatibleCollectionError,
  LocalRegistry,
  MissingCollectionBlockError,
  type RegistryFilter,
} from "./index.js";
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
    files: [
      {
        path: `${id}.tsx`,
        kind: "component",
        content: `export function ${id.replaceAll("-", "_")}() {}`,
      },
    ],
    metadata: {
      author: "Auren",
      flags: { featured: true, rank: 1 },
      tags: ["conversion", "landing-page"],
    },
    ...changes,
  };
}

function createCollection(
  id: string,
  blocks: string[] = ["hero-001"],
  changes: Partial<Collection> = {},
): Collection {
  return {
    id,
    name: `Collection ${id}`,
    description: `Complete collection ${id}.`,
    category: "marketing",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    blocks,
    metadata: {
      author: "Auren",
      flags: { featured: true, rank: 1 },
      tags: ["conversion", "landing-page"],
    },
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

function registerBlocks(
  registry: LocalRegistry,
  ids: readonly string[] = ["hero-001"],
) {
  registry.registerMany(ids.map((id) => createElement(id)));
}

describe("LocalRegistry Collections", () => {
  it("starts both namespaces empty through the public entrypoint", () => {
    const registry = new LocalRegistry();
    const blockFilter: RegistryFilter = { type: "hero" };
    const collectionFilter: CollectionFilter = {
      category: "marketing",
      style: "minimal",
      industry: "saas",
      feature: "responsive",
      framework: "react",
      metadata: { author: "Auren" },
    };

    expect(registry.size).toBe(0);
    expect(registry.collectionSize).toBe(0);
    expect(registry.list()).toEqual([]);
    expect(registry.listCollections()).toEqual([]);
    expect(registry.getById("hero-001")).toBeUndefined();
    expect(registry.getCollectionById("saas-minimal")).toBeUndefined();
    expect(registry.query(blockFilter)).toEqual([]);
    expect(registry.queryCollections(collectionFilter)).toEqual([]);
    expect(DuplicateCollectionError.name).toBe("DuplicateCollectionError");
    expect(MissingCollectionBlockError.name).toBe(
      "MissingCollectionBlockError",
    );
    expect(IncompatibleCollectionError.name).toBe(
      "IncompatibleCollectionError",
    );
  });

  it("registers compatible Collections with ordered members and independent counts", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry, ["navbar-001", "hero-001", "footer-001"]);
    const input = createCollection("saas-minimal", [
      "navbar-001",
      "hero-001",
      "footer-001",
    ]);

    const registered = registry.registerCollection(input);

    expect(registered).toEqual(input);
    expect(registered.blocks).toEqual(["navbar-001", "hero-001", "footer-001"]);
    expect(registry.size).toBe(3);
    expect(registry.collectionSize).toBe(1);
    expect(registry.hasCollection("saas-minimal")).toBe(true);
    expect(registry.getCollectionById("saas-minimal")).toEqual(input);
    expect(registry.listCollections()).toEqual([input]);
    expect(registry.list()).toHaveLength(3);
  });

  it("keeps block and Collection namespaces independent for shared IDs", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry, ["saas-minimal", "hero-001"]);
    const collection = createCollection("saas-minimal", ["hero-001"]);

    registry.registerCollection(collection);

    expect(registry.getById("saas-minimal")).toEqual(
      createElement("saas-minimal"),
    );
    expect(registry.getCollectionById("saas-minimal")).toEqual(collection);
    expect(registry.has("saas-minimal")).toBe(true);
    expect(registry.hasCollection("saas-minimal")).toBe(true);
    expect(registry.size).toBe(2);
    expect(registry.collectionSize).toBe(1);
  });

  it("preserves successful Collection registration order in lists and queries", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry);
    const first = createCollection("first-001");
    const second = createCollection("second-001", ["hero-001"], {
      metadata: { author: "Auren", order: 2 },
    });
    const third = createCollection("third-001", ["hero-001"], {
      metadata: { author: "Auren", order: 3 },
    });

    registry.registerCollections([first, second, third]);

    expect(registry.listCollections().map(({ id }) => id)).toEqual([
      "first-001",
      "second-001",
      "third-001",
    ]);
    expect(registry.queryCollections().map(({ id }) => id)).toEqual([
      "first-001",
      "second-001",
      "third-001",
    ]);
    expect(registry.queryCollections({ category: "marketing" })).toEqual([
      first,
      second,
      third,
    ]);
  });

  it("rejects malformed, duplicate, missing, and unsupported collections atomically", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry);

    const valid = createCollection("valid-001");
    const malformed = { ...createCollection("malformed-001"), blocks: [] };
    const malformedError = captureError(() =>
      registry.registerCollections([valid, malformed]),
    );

    expect(malformedError).toMatchObject({ name: "ZodError" });
    expect(registry.collectionSize).toBe(0);

    registry.registerCollection(valid);
    const duplicateError = captureError(() =>
      registry.registerCollection(createCollection("valid-001")),
    );

    expect(duplicateError).toBeInstanceOf(DuplicateCollectionError);
    expect(duplicateError).toMatchObject({
      id: "valid-001",
      name: "DuplicateCollectionError",
    });
    expect(registry.getCollectionById("valid-001")).toEqual(valid);

    const batchDuplicateError = captureError(() =>
      registry.registerCollections([
        createCollection("second-001"),
        createCollection("second-001"),
      ]),
    );

    expect(batchDuplicateError).toBeInstanceOf(DuplicateCollectionError);
    expect(batchDuplicateError).toMatchObject({ id: "second-001" });
    expect(registry.hasCollection("second-001")).toBe(false);

    const missingError = captureError(() =>
      registry.registerCollection(
        createCollection("missing-001", ["unknown-001"]),
      ),
    );

    expect(missingError).toBeInstanceOf(MissingCollectionBlockError);
    expect(missingError).toMatchObject({
      collectionId: "missing-001",
      blockId: "unknown-001",
      name: "MissingCollectionBlockError",
    });
    expect(registry.hasCollection("missing-001")).toBe(false);

    const invalidFramework = {
      ...createCollection("unsupported-001"),
      frameworks: ["vue"],
    };
    const frameworkError = captureError(() =>
      registry.registerCollection(invalidFramework),
    );

    expect(frameworkError).toMatchObject({ name: "ZodError" });
    expect(registry.hasCollection("unsupported-001")).toBe(false);
    expect(registry.collectionSize).toBe(1);
  });

  it("filters Collections by official dimensions with AND and recursive metadata semantics", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry, ["hero-001", "pricing-001", "sidebar-001"]);
    const minimalSaas = createCollection("minimal-saas", ["hero-001"], {
      metadata: {
        author: "Auren",
        flags: { featured: true, rank: 1 },
        tags: ["conversion", "landing-page"],
      },
    });
    const boldFintech = createCollection("bold-fintech", ["pricing-001"], {
      styles: ["bold"],
      industries: ["fintech"],
      features: ["dark-mode"],
      metadata: { author: "Partner", flags: { featured: false } },
    });
    const developerTools = createCollection(
      "developer-tools",
      ["sidebar-001"],
      {
        category: "application-ui",
        styles: ["developer"],
        industries: ["developer-tools"],
        features: ["sidebar", "search"],
        metadata: { author: "Auren", flags: { featured: true, rank: 3 } },
      },
    );
    registry.registerCollections([minimalSaas, boldFintech, developerTools]);

    expect(registry.queryCollections({ category: "marketing" })).toEqual([
      minimalSaas,
      boldFintech,
    ]);
    expect(registry.queryCollections({ style: "minimal" })).toEqual([
      minimalSaas,
    ]);
    expect(registry.queryCollections({ industry: "fintech" })).toEqual([
      boldFintech,
    ]);
    expect(registry.queryCollections({ feature: "sidebar" })).toEqual([
      developerTools,
    ]);
    expect(registry.queryCollections({ framework: "react" })).toEqual([
      minimalSaas,
      boldFintech,
      developerTools,
    ]);
    expect(
      registry.queryCollections({
        category: "marketing",
        style: "minimal",
        industry: "saas",
        feature: "responsive",
        framework: "react",
        metadata: {
          author: "Auren",
          flags: { rank: 1, featured: true },
        },
      }),
    ).toEqual([minimalSaas]);
    expect(
      registry.queryCollections({ metadata: { author: "Auren" } }),
    ).toEqual([minimalSaas, developerTools]);
    expect(
      registry.queryCollections({ metadata: { flags: { featured: true } } }),
    ).toEqual([]);
    expect(
      registry.queryCollections({
        metadata: { tags: ["landing-page", "conversion"] },
      }),
    ).toEqual([]);
    expect(registry.queryCollections({ metadata: { missing: true } })).toEqual(
      [],
    );
    expect(registry.queryCollections({ category: "ecommerce" })).toEqual([]);
    expect(registry.queryCollections({})).toEqual([
      minimalSaas,
      boldFintech,
      developerTools,
    ]);

    const typeFilter = { type: "hero" } as unknown as CollectionFilter;
    expect(registry.queryCollections(typeFilter)).toEqual([
      minimalSaas,
      boldFintech,
      developerTools,
    ]);
  });

  it("isolates Collection inputs and all returned values from stored state", () => {
    const registry = new LocalRegistry();
    registerBlocks(registry, ["hero-001", "pricing-001"]);
    const input = createCollection("isolated-001", ["hero-001", "pricing-001"]);
    const registered = registry.registerCollection(input);

    input.blocks[0] = "pricing-001";
    input.styles[0] = "bold";
    input.metadata.author = "Input mutation";
    if (
      typeof input.metadata.flags === "object" &&
      input.metadata.flags !== null &&
      !Array.isArray(input.metadata.flags)
    ) {
      input.metadata.flags.featured = false;
    }
    registered.blocks.reverse();
    registered.industries[0] = "fintech";
    registered.metadata.author = "Register result mutation";

    const batchInput = createCollection("batch-001");
    const batchResult = registry.registerCollections([batchInput]);
    batchInput.features[0] = "dark-mode";
    batchResult[0].blocks[0] = "pricing-001";

    const lookup = registry.getCollectionById("isolated-001");
    expect(lookup).toBeDefined();
    if (lookup) {
      lookup.features[0] = "dark-mode";
      lookup.metadata.author = "Lookup mutation";
    }

    const listed = registry.listCollections();
    listed[0].styles[0] = "luxury";
    listed[1].metadata.author = "List mutation";

    const queried = registry.queryCollections({ style: "minimal" });
    queried[0].metadata.author = "Query mutation";
    queried[0].blocks[0] = "pricing-001";

    expect(registry.getCollectionById("isolated-001")).toEqual(
      createCollection("isolated-001", ["hero-001", "pricing-001"]),
    );
    expect(registry.getCollectionById("batch-001")).toEqual(
      createCollection("batch-001"),
    );
    expect(
      registry.queryCollections({ style: "minimal" }).map(({ id }) => id),
    ).toEqual(["isolated-001", "batch-001"]);
    expect(registry.queryCollections({ style: "bold" })).toEqual([]);
    expect(registry.queryCollections({ industry: "fintech" })).toEqual([]);
    expect(registry.queryCollections({ feature: "dark-mode" })).toEqual([]);
    expect(registry.collectionSize).toBe(2);
  });
});
