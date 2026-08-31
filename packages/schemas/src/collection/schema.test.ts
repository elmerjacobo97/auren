import type {
  Collection,
  CollectionBlockId,
  CollectionBlocks,
  CollectionFeatures,
  CollectionFrameworks,
  CollectionIndustries,
  CollectionMetadata,
  CollectionStyles,
} from "./schema.js";
import {
  collectionSchema,
  collectionBlockIdSchema,
  collectionBlocksSchema,
  collectionFeaturesSchema,
  collectionFrameworksSchema,
  collectionIndustriesSchema,
  collectionMetadataSchema,
  collectionStylesSchema,
} from "./schema.js";
import { describe, expect, it } from "vitest";
import { canonicalCollection } from "./fixtures/canonical-collection.js";

function withCollectionChanges(changes: Record<string, unknown>) {
  return { ...canonicalCollection, ...changes };
}

function expectInvalid(value: unknown) {
  expect(collectionSchema.safeParse(value).success).toBe(false);
}

function expectIssueAt(value: unknown, path: readonly (string | number)[]) {
  const result = collectionSchema.safeParse(value);

  expect(result.success).toBe(false);

  if (result.success) {
    return;
  }

  expect(
    result.error.issues.some(
      (issue) =>
        issue.path.length === path.length &&
        issue.path.every((segment, index) => segment === path[index]),
    ),
  ).toBe(true);
}

describe("collectionSchema", () => {
  it("accepts a complete collection and preserves authored values", () => {
    const parsed = collectionSchema.parse(canonicalCollection);

    expect(parsed).toEqual(canonicalCollection);
    expect(parsed.blocks).toEqual([
      "navbar-001",
      "hero-001",
      "features-001",
      "footer-001",
    ]);
    expect(parsed.metadata).toEqual(canonicalCollection.metadata);
  });

  it("requires every strict top-level field and rejects unknown fields", () => {
    for (const field of Object.keys(canonicalCollection)) {
      const incomplete: Record<string, unknown> = {
        ...canonicalCollection,
      };
      delete incomplete[field];
      expectInvalid(incomplete);
    }

    expectInvalid(withCollectionChanges({ extra: true }));
    expectInvalid(withCollectionChanges({ type: "hero" }));
  });

  it("validates official classifications by their own taxonomy dimensions", () => {
    const cases = [
      { field: "category", value: "saas" },
      { field: "styles", value: ["dark-mode"] },
      { field: "industries", value: ["minimal"] },
      { field: "features", value: ["saas"] },
      { field: "frameworks", value: ["vue"] },
    ] as const;

    for (const { field, value } of cases) {
      expectInvalid(withCollectionChanges({ [field]: value }));
    }

    expectIssueAt(withCollectionChanges({ styles: ["minimal", "vue"] }), [
      "styles",
      1,
    ]);
    expectIssueAt(withCollectionChanges({ frameworks: ["vue"] }), [
      "frameworks",
      0,
    ]);
  });

  it("rejects duplicate classifications, an empty framework list, and invalid IDs", () => {
    for (const field of [
      "styles",
      "industries",
      "features",
      "frameworks",
    ] as const) {
      const values = [
        ...canonicalCollection[field],
        canonicalCollection[field][0],
      ];
      expectInvalid(withCollectionChanges({ [field]: values }));
    }

    expectInvalid(withCollectionChanges({ frameworks: [] }));
    expectInvalid(withCollectionChanges({ blocks: [] }));
    expectInvalid(
      withCollectionChanges({
        blocks: [...canonicalCollection.blocks, canonicalCollection.blocks[0]],
      }),
    );

    for (const id of [
      "Hero-001",
      "has space",
      "with_under-score",
      "double--hyphen",
      "-leading",
      "trailing-",
    ]) {
      expectInvalid(withCollectionChanges({ id }));
      expectInvalid(withCollectionChanges({ blocks: [id] }));
    }
  });

  it("accepts and preserves recursively JSON-safe metadata", () => {
    const metadata = {
      author: "Auren",
      nested: ["value", 2, false, null, { enabled: true }],
    };

    expect(
      collectionSchema.parse(withCollectionChanges({ metadata })).metadata,
    ).toEqual(metadata);
  });

  it("rejects runtime-only metadata values", () => {
    class RuntimeMetadataValue {}
    const invalidValues: unknown[] = [
      undefined,
      () => "not-json",
      Symbol("not-json"),
      Number.POSITIVE_INFINITY,
      Number.NaN,
      new Date("2026-01-01"),
      new Map<string, string>(),
      new RuntimeMetadataValue(),
    ];

    for (const value of invalidValues) {
      expectInvalid(withCollectionChanges({ metadata: { value } }));
    }
  });

  it("exposes nested schemas and inferred types", () => {
    const blockId: CollectionBlockId = "hero-001";
    const blocks: CollectionBlocks = [blockId];
    const styles: CollectionStyles = ["minimal"];
    const industries: CollectionIndustries = ["saas"];
    const features: CollectionFeatures = ["responsive"];
    const frameworks: CollectionFrameworks = ["react"];
    const metadata: CollectionMetadata = { source: "fixture" };
    const collection: Collection = {
      ...canonicalCollection,
      blocks,
      styles,
      industries,
      features,
      frameworks,
      metadata,
    };

    expect(collectionBlockIdSchema.parse(blockId)).toBe(blockId);
    expect(collectionBlocksSchema.parse(blocks)).toEqual(blocks);
    expect(collectionStylesSchema.parse(styles)).toEqual(styles);
    expect(collectionIndustriesSchema.parse(industries)).toEqual(industries);
    expect(collectionFeaturesSchema.parse(features)).toEqual(features);
    expect(collectionFrameworksSchema.parse(frameworks)).toEqual(frameworks);
    expect(collectionMetadataSchema.parse(metadata)).toEqual(metadata);
    expect(collectionSchema.parse(collection)).toEqual(collection);
  });
});
