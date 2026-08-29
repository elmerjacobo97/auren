import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it } from "vitest";
import { formatSearchResults } from "./search-formatter.js";

const heroElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["mobile-first", "responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [
    {
      path: "component.tsx",
      kind: "component",
      content: "export const SecretContent = () => null;",
    },
  ],
  metadata: { author: "Auren" },
};

const navbarElement: CatalogElement = {
  id: "navbar-001",
  name: "Glass navigation bar",
  description: "A glassy responsive navigation bar.",
  category: "application-ui",
  type: "navbar",
  styles: ["glass"],
  industries: ["fintech"],
  features: ["responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

describe("formatSearchResults", () => {
  it("renders an explicit no-match message for empty results", () => {
    expect(formatSearchResults([])).toBe(
      "No matching catalog elements found.\n",
    );
  });

  it("renders a singular count line for one match", () => {
    const output = formatSearchResults([heroElement]);

    expect(output).toBe(
      "1 result\n\n" +
        "hero-001 - Product launch hero\n" +
        "Category: marketing, Type: hero\n" +
        "A responsive product launch hero.\n",
    );
  });

  it("renders a plural count line and every match in order", () => {
    const output = formatSearchResults([heroElement, navbarElement]);

    expect(output).toBe(
      "2 results\n\n" +
        "hero-001 - Product launch hero\n" +
        "Category: marketing, Type: hero\n" +
        "A responsive product launch hero.\n\n" +
        "navbar-001 - Glass navigation bar\n" +
        "Category: application-ui, Type: navbar\n" +
        "A glassy responsive navigation bar.\n",
    );
  });

  it("never prints file contents, dependencies, or metadata", () => {
    const output = formatSearchResults([heroElement]);

    expect(output).not.toContain("SecretContent");
    expect(output).not.toContain("component.tsx");
    expect(output).not.toContain("author");
    expect(output).not.toContain("mobile-first");
  });
});
