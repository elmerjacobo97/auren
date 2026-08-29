import type { CatalogElement } from "@auren/schemas/catalog";
import type { Framework } from "@auren/schemas/taxonomy";
import { describe, expect, it } from "vitest";
import { validateCompatibility } from "./compatibility";

function createElement(changes: Partial<CatalogElement> = {}): CatalogElement {
  return {
    id: "hero-001",
    name: "Product launch hero",
    description: "A responsive hero section.",
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["mobile-first", "responsive", "dark-mode"],
    frameworks: ["react"],
    dependencies: [],
    files: [{ path: "component.tsx", kind: "component" }],
    metadata: {},
    ...changes,
  };
}

describe("validateCompatibility", () => {
  it("reports compatibility when every requested value is declared", () => {
    const element = createElement();
    const report = validateCompatibility(element, {
      frameworks: ["react"],
      features: ["mobile-first", "responsive"],
    });

    expect(report).toEqual({
      compatible: true,
      missing: { frameworks: [], features: [] },
    });
  });

  it("reports each missing requested value in its classification list", () => {
    const element = createElement();
    const report = validateCompatibility(element, {
      frameworks: ["react", "vue"] as unknown as readonly Framework[],
      features: ["mobile-first", "animated", "sidebar"],
    });

    expect(report.compatible).toBe(false);
    expect(report.missing.frameworks).toEqual(["vue"]);
    expect(report.missing.features).toEqual(["animated", "sidebar"]);
  });

  it("treats an empty target as fully compatible", () => {
    const report = validateCompatibility(createElement());

    expect(report).toEqual({
      compatible: true,
      missing: { frameworks: [], features: [] },
    });
    expect(validateCompatibility(createElement(), {})).toEqual({
      compatible: true,
      missing: { frameworks: [], features: [] },
    });
  });

  it("does not mutate the element or target inputs", () => {
    const element = createElement();
    const target = {
      frameworks: ["react"] as const,
      features: ["animated"] as const,
    };

    validateCompatibility(element, target);

    expect(element.frameworks).toEqual(["react"]);
    expect(element.features).toEqual([
      "mobile-first",
      "responsive",
      "dark-mode",
    ]);
    expect(target).toEqual({ frameworks: ["react"], features: ["animated"] });
  });
});
