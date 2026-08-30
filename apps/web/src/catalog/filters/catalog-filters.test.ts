import { describe, expect, it } from "vitest";
import { createCatalogElement } from "../test/fixtures.js";
import {
  type CatalogFilterState,
  emptyCatalogFilterState,
  filterCatalogElements,
  hasActiveCatalogFilters,
  matchesCatalogFilters,
  normalizeCatalogFilterSearch,
  parseCatalogFilterSearch,
  serializeCatalogFilterState,
} from "./catalog-filters.js";

const hero = createCatalogElement("hero-001", {
  styles: ["minimal", "bold"],
  industries: ["saas", "ai"],
  features: ["dark-mode", "responsive", "two-cta"],
});
const pricing = createCatalogElement("pricing-002", {
  type: "pricing",
  styles: ["corporate"],
  industries: ["fintech"],
  features: ["mobile-first", "responsive"],
});
const sidebar = createCatalogElement("sidebar-003", {
  category: "application-ui",
  type: "sidebar",
  styles: ["developer"],
  industries: ["developer-tools"],
  features: ["responsive", "sidebar", "search"],
});
const blocks = [hero, pricing, sidebar];

function state(changes: Partial<CatalogFilterState>): CatalogFilterState {
  return { ...emptyCatalogFilterState, ...changes };
}

describe("catalog filter search state", () => {
  it("starts with every dimension unfiltered", () => {
    expect(parseCatalogFilterSearch({})).toEqual(emptyCatalogFilterState);
    expect(hasActiveCatalogFilters(emptyCatalogFilterState)).toBe(false);
  });

  it("accepts official scalar values and canonicalizes features", () => {
    expect(
      parseCatalogFilterSearch({
        category: "marketing",
        type: "hero",
        style: "minimal",
        industry: "saas",
        features: "responsive,dark-mode,responsive,command-palette",
        framework: "react",
      }),
    ).toEqual({
      category: "marketing",
      type: "hero",
      style: "minimal",
      industry: "saas",
      features: ["dark-mode", "responsive", "command-palette"],
      framework: "react",
    });
  });

  it("ignores unsupported values and non-string scalar inputs", () => {
    expect(
      normalizeCatalogFilterSearch({
        category: "unknown",
        type: ["hero"],
        style: "dark-mode",
        industry: "unknown",
        features: "responsive,unknown,responsive",
        framework: 1,
      }),
    ).toEqual({ features: "responsive" });
  });

  it("serializes only active values in official feature order", () => {
    expect(
      serializeCatalogFilterState(
        state({
          category: "marketing",
          features: ["command-palette", "dark-mode", "responsive"],
          framework: "react",
        }),
      ),
    ).toEqual({
      category: "marketing",
      features: "dark-mode,responsive,command-palette",
      framework: "react",
    });
  });

  it("accepts repeated feature input while preserving one canonical value", () => {
    expect(
      parseCatalogFilterSearch({
        features: ["responsive,dark-mode", "responsive"],
      }),
    ).toEqual({ features: ["dark-mode", "responsive"] });
  });
});

describe("catalog element matching", () => {
  it("matches every block when the filter state is empty", () => {
    expect(filterCatalogElements(blocks, emptyCatalogFilterState)).toEqual(
      blocks,
    );
  });

  it.each([
    ["category", state({ category: "application-ui" }), ["sidebar-003"]],
    ["type", state({ type: "pricing" }), ["pricing-002"]],
    ["style", state({ style: "bold" }), ["hero-001"]],
    ["industry", state({ industry: "fintech" }), ["pricing-002"]],
    [
      "framework",
      state({ framework: "react" }),
      ["hero-001", "pricing-002", "sidebar-003"],
    ],
  ] as const)("filters by %s exactly", (_dimension, filters, ids) => {
    expect(
      filterCatalogElements(blocks, filters).map((block) => block.id),
    ).toEqual(ids);
  });

  it("requires every selected feature", () => {
    expect(
      filterCatalogElements(
        blocks,
        state({ features: ["dark-mode", "responsive"] }),
      ).map((block) => block.id),
    ).toEqual(["hero-001"]);
  });

  it("combines dimensions with AND semantics", () => {
    expect(
      filterCatalogElements(
        blocks,
        state({
          category: "marketing",
          type: "hero",
          style: "minimal",
          industry: "saas",
          features: ["dark-mode", "responsive"],
          framework: "react",
        }),
      ).map((block) => block.id),
    ).toEqual(["hero-001"]);
  });

  it("keeps the validated index order", () => {
    expect(
      filterCatalogElements(
        [sidebar, hero, pricing],
        state({ features: ["responsive"] }),
      ).map((block) => block.id),
    ).toEqual(["sidebar-003", "hero-001", "pricing-002"]);
  });

  it("reports whether a state has active filters", () => {
    expect(hasActiveCatalogFilters(state({ style: "minimal" }))).toBe(true);
    expect(
      matchesCatalogFilters(hero, state({ features: ["dark-mode"] })),
    ).toBe(true);
    expect(
      matchesCatalogFilters(pricing, state({ features: ["dark-mode"] })),
    ).toBe(false);
  });
});
