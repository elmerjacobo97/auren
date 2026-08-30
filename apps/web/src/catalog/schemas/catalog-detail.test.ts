import { describe, expect, it } from "vitest";
import { createCatalogElement, createDetailElement } from "../test/fixtures.js";
import { isCanonicalBase64, parseCatalogDetail } from "./catalog-detail.js";

const indexedBlock = createCatalogElement("hero-001", {
  name: "Product launch hero",
  metadata: { tone: "quiet", tags: ["launch"] },
  files: [
    { path: "component.tsx", kind: "component" },
    { path: "utilities/types.ts", kind: "utility" },
  ],
});

const detailBlock = createDetailElement("hero-001", {
  name: indexedBlock.name,
  description: indexedBlock.description,
  category: indexedBlock.category,
  type: indexedBlock.type,
  styles: indexedBlock.styles,
  industries: indexedBlock.industries,
  features: indexedBlock.features,
  frameworks: indexedBlock.frameworks,
  dependencies: indexedBlock.dependencies,
  metadata: indexedBlock.metadata,
  files: indexedBlock.files,
});

describe("parseCatalogDetail", () => {
  it("returns a complete detail after schema and index validation", () => {
    expect(
      parseCatalogDetail(detailBlock, {
        id: indexedBlock.id,
        indexedElement: indexedBlock,
      }),
    ).toEqual(detailBlock);
  });

  it.each([
    {
      label: "route identity",
      payload: { ...detailBlock, id: "cta-001" },
      message: "identity",
    },
    {
      label: "metadata",
      payload: { ...detailBlock, name: "Different block" },
      message: "name",
    },
    {
      label: "file inventory",
      payload: {
        ...detailBlock,
        files: [...detailBlock.files].reverse(),
      },
      message: "file inventory",
    },
    {
      label: "inline content",
      payload: {
        ...detailBlock,
        files: detailBlock.files.map(({ path, kind }) => ({ path, kind })),
      },
      message: "inline file content",
    },
    {
      label: "installation target",
      payload: {
        ...detailBlock,
        files: detailBlock.files.map((file, index) =>
          index === 0 ? { ...file, target: "src/hero.tsx" } : file,
        ),
      },
      message: "installation target",
    },
  ])("rejects $label drift", ({ payload, message }) => {
    expect(() =>
      parseCatalogDetail(payload, {
        id: indexedBlock.id,
        indexedElement: indexedBlock,
      }),
    ).toThrow(message);
  });

  it("rejects a schema-invalid detail without exposing a partial payload", () => {
    expect(() =>
      parseCatalogDetail(
        { ...detailBlock, type: "not-a-block-type" },
        { id: indexedBlock.id, indexedElement: indexedBlock },
      ),
    ).toThrow(/catalog validation/);
  });

  it("rejects non-canonical asset content", () => {
    const indexed = createCatalogElement("hero-002", {
      files: [
        { path: "component.tsx", kind: "component" },
        { path: "assets/logo.png", kind: "asset" },
      ],
    });
    const detail = createDetailElement("hero-002", {
      files: indexed.files,
    });

    expect(() =>
      parseCatalogDetail(
        {
          ...detail,
          files: detail.files.map((file, index) =>
            index === 1 ? { ...file, content: "not base64" } : file,
          ),
        },
        { id: indexed.id, indexedElement: indexed },
      ),
    ).toThrow(/non-canonical asset/);
  });
});

describe("isCanonicalBase64", () => {
  it.each([
    ["", true],
    ["aGVsbG8=", true],
    ["aGVsbG8", false],
    ["not base64", false],
    ["aGVsbG8===", false],
  ])("checks %j", (value, expected) => {
    expect(isCanonicalBase64(value)).toBe(expected);
  });
});
