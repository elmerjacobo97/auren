import { describe, expect, it } from "vitest";
import { CatalogClientError } from "../utils/catalog-errors.js";
import { createCatalogElement, createIndex } from "../test/fixtures.js";
import { parseCatalogIndex } from "./catalog-index.js";

describe("parseCatalogIndex", () => {
  it("returns metadata-only elements in deterministic ID order", () => {
    const elements = parseCatalogIndex(
      createIndex([
        createCatalogElement("hero-010"),
        createCatalogElement("cta-001"),
      ]),
    );

    expect(elements.map((element) => element.id)).toEqual([
      "cta-001",
      "hero-010",
    ]);
  });

  it.each([
    null,
    [],
    { schemaVersion: 1.5, blocks: [] },
    { schemaVersion: 2, blocks: [] },
    { schemaVersion: 1 },
    { schemaVersion: 1, blocks: {} },
  ])("rejects invalid Registry envelope %j", (payload) => {
    expect(() => parseCatalogIndex(payload)).toThrow(
      /Registry index envelope was invalid/,
    );
  });

  it("rejects a schema-invalid element without exposing valid neighbors", () => {
    expect(() =>
      parseCatalogIndex(
        createIndex([
          createCatalogElement("hero-001"),
          {
            ...createCatalogElement("invalid-001"),
            type: "not-a-supported-block",
          },
        ]),
      ),
    ).toThrow(/invalid block metadata at entry 1/);
  });

  it("rejects duplicate IDs", () => {
    expect(() =>
      parseCatalogIndex(
        createIndex([
          createCatalogElement("hero-001"),
          createCatalogElement("hero-001"),
        ]),
      ),
    ).toThrow(/duplicate block ID "hero-001"/);
  });

  it.each([
    { content: "export function Hero() {}" },
    { target: "src/components/hero.tsx" },
  ])("rejects forbidden file field %j", (fileChange) => {
    expect(() =>
      parseCatalogIndex(
        createIndex([
          createCatalogElement("hero-001", {
            files: [
              {
                path: "component.tsx",
                kind: "component",
                ...fileChange,
              },
            ],
          }),
        ]),
      ),
    ).toThrow(CatalogClientError);
  });
});
