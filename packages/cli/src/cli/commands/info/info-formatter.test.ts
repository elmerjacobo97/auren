import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it } from "vitest";
import { formatCatalogElement } from "./info-formatter.js";

const completeElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: ["bold"],
  industries: ["saas", "ai"],
  features: ["mobile-first", "responsive"],
  frameworks: ["react"],
  dependencies: [
    { kind: "package", name: "motion", version: "^12.0.0" },
    { kind: "auren", id: "button-001" },
  ],
  files: [
    { path: "component.tsx", kind: "component", content: "secret content" },
    {
      path: "utilities/types.ts",
      kind: "utility",
      target: "src/components/types.ts",
    },
  ],
  metadata: { author: "Auren", viewport: { minWidth: 320 } },
};

const emptyElement: CatalogElement = {
  ...completeElement,
  styles: [],
  industries: [],
  features: [],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

describe("formatCatalogElement", () => {
  it("renders canonical fields in stable order without file content", () => {
    const output = formatCatalogElement(completeElement);

    expect(output).toBe(`ID: hero-001
Name: Product launch hero
Description: A responsive product launch hero.
Category: marketing
Type: hero
Styles: bold
Industries: saas, ai
Features: mobile-first, responsive
Frameworks: react
Dependencies:
  - package: motion@^12.0.0
  - auren: button-001
Files:
  - component.tsx (component)
  - utilities/types.ts (utility), target: src/components/types.ts
Metadata:
{
  "author": "Auren",
  "viewport": {
    "minWidth": 320
  }
}
`);
    expect(output).not.toContain("secret content");
  });

  it("renders empty lists and metadata explicitly", () => {
    const output = formatCatalogElement(emptyElement);

    expect(output).toContain("Styles: none");
    expect(output).toContain("Industries: none");
    expect(output).toContain("Features: none");
    expect(output).toContain("Dependencies: none");
    expect(output).toContain("Metadata: none");
  });
});
