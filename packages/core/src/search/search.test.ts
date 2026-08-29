import type { CatalogElement } from "@auren/schemas/catalog";
import { LocalRegistry } from "@auren/registry";
import { describe, expect, it } from "vitest";
import { searchBlocks } from "./search";

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

function registerElements(
  registry: LocalRegistry,
  elements: readonly CatalogElement[],
) {
  registry.registerMany(elements);
}

describe("searchBlocks", () => {
  it("matches text case-insensitively across id, name and description", () => {
    const registry = new LocalRegistry();
    const hero = createElement("hero-001", {
      name: "Product Launch Hero",
      description: "Responsive hero with product graphics.",
    });
    const pricing = createElement("pricing-001", {
      type: "pricing",
      name: "Launch pricing table",
    });
    const stats = createElement("stats-001", {
      type: "stats",
      name: "Platform metrics",
      description: "Performance stats for the platform.",
    });
    registerElements(registry, [hero, pricing, stats]);

    expect(
      searchBlocks(registry, { text: "LAUNCH" }).map(({ id }) => id),
    ).toEqual(["hero-001", "pricing-001"]);
    expect(
      searchBlocks(registry, { text: "product" }).map(({ id }) => id),
    ).toEqual(["hero-001"]);
    expect(
      searchBlocks(registry, { text: "STATS-001" }).map(({ id }) => id),
    ).toEqual(["stats-001"]);
  });

  it("returns no results when the text term matches nothing", () => {
    const registry = new LocalRegistry();
    registerElements(registry, [createElement("hero-001")]);

    expect(searchBlocks(registry, { text: "nonexistent-term" })).toEqual([]);
  });

  it("combines text matching with registry filter semantics", () => {
    const registry = new LocalRegistry();
    const hero = createElement("hero-001", {
      name: "Launch hero",
    });
    const pricing = createElement("pricing-001", {
      type: "pricing",
      name: "Launch pricing",
      styles: ["bold"],
    });
    registerElements(registry, [hero, pricing]);

    expect(
      searchBlocks(registry, {
        text: "launch",
        filters: { type: "pricing" },
      }).map(({ id }) => id),
    ).toEqual(["pricing-001"]);
    expect(
      searchBlocks(registry, {
        text: "launch",
        filters: { style: "minimal" },
      }).map(({ id }) => id),
    ).toEqual(["hero-001"]);
    expect(
      searchBlocks(registry, {
        text: "launch",
        filters: { type: "sidebar" },
      }),
    ).toEqual([]);
  });

  it("is pure with respect to registry state", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001");
    registerElements(registry, [element]);

    const before = {
      size: registry.size,
      list: registry.list(),
      byId: registry.getById("hero-001"),
    };
    searchBlocks(registry, { text: "hero" });
    searchBlocks(registry, { text: "missing" });
    searchBlocks(registry, { filters: { type: "pricing" } });

    expect(registry.size).toBe(before.size);
    expect(registry.list()).toEqual(before.list);
    expect(registry.getById("hero-001")).toEqual(before.byId);
  });

  it("keeps registry query order and does not mutate results or input", () => {
    const registry = new LocalRegistry();
    const first = createElement("hero-001", { name: "Zebra hero" });
    const second = createElement("hero-002");
    registerElements(registry, [first, second]);

    const results = searchBlocks(registry, { text: "hero" });
    expect(results.map(({ id }) => id)).toEqual(["hero-001", "hero-002"]);

    if (results[0]) {
      results[0].name = "Mutated";
    }
    expect(registry.getById("hero-001")).toEqual(first);
  });
});
