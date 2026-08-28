import type { CatalogElement } from "@auren/schemas/catalog";
import { catalogElementSchema } from "@auren/schemas/catalog";
import { aurenElementSchema } from "@auren/schemas/element";
import type {
  Category,
  Feature,
  Framework,
  Industry,
  Style,
} from "@auren/schemas/taxonomy";
import {
  categorySchema,
  featureSchema,
  frameworkSchema,
  industrySchema,
  styleSchema,
} from "@auren/schemas/taxonomy";
import { describe, expect, it } from "vitest";
import { canonicalElement } from "@/element/fixtures/canonical-element.js";

function withElementChanges(changes: Record<string, unknown>) {
  return { ...canonicalElement, ...changes };
}

function expectCatalogInvalid(value: unknown) {
  expect(catalogElementSchema.safeParse(value).success).toBe(false);
}

function expectCatalogIssueAt(
  value: unknown,
  path: readonly (string | number)[],
) {
  const result = catalogElementSchema.safeParse(value);

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

describe("catalogElementSchema", () => {
  it("accepts a complete officially classified element unchanged", () => {
    const parsed = catalogElementSchema.parse(canonicalElement);

    expect(parsed).toEqual(canonicalElement);
    expect(canonicalElement.styles).toEqual(["minimal"]);
    expect(canonicalElement.features).toContain("dark-mode");
  });

  it("reports unknown scalar classifications at their fields", () => {
    expectCatalogIssueAt(withElementChanges({ category: "future-category" }), [
      "category",
    ]);
    expectCatalogIssueAt(withElementChanges({ type: "future-block" }), [
      "type",
    ]);
  });

  it("reports unknown collection classifications at their indexes", () => {
    const cases = [
      {
        field: "styles",
        values: [...canonicalElement.styles, "unofficial-style"],
      },
      {
        field: "industries",
        values: [...canonicalElement.industries, "unofficial-industry"],
      },
      {
        field: "features",
        values: [...canonicalElement.features, "unofficial-feature"],
      },
      {
        field: "frameworks",
        values: [...canonicalElement.frameworks, "vue"],
      },
    ] as const;

    for (const { field, values } of cases) {
      expectCatalogIssueAt(withElementChanges({ [field]: values }), [
        field,
        values.length - 1,
      ]);
    }
  });

  it("preserves structural refinements and strictness", () => {
    expectCatalogInvalid(
      withElementChanges({
        styles: [...canonicalElement.styles, canonicalElement.styles[0]],
      }),
    );
    expectCatalogInvalid(withElementChanges({ frameworks: [] }));
    expectCatalogInvalid(
      withElementChanges({
        files: [{ path: "../escape.tsx", kind: "component" }],
      }),
    );
    expectCatalogInvalid(withElementChanges({ extra: true }));
    expectCatalogInvalid(
      withElementChanges({
        dependencies: [{ kind: "auren", id: canonicalElement.id }],
      }),
    );
    expectCatalogInvalid(
      withElementChanges({
        dependencies: [
          { kind: "package", name: "@acme/ui", version: "^1.2.0" },
          { kind: "package", name: "@acme/ui", version: "~1.3.0" },
        ],
      }),
    );
    expectCatalogInvalid(
      withElementChanges({
        files: [
          { path: "component.tsx", kind: "component" },
          { path: "component.tsx", kind: "utility" },
        ],
      }),
    );
    expectCatalogInvalid(
      withElementChanges({
        metadata: { invalid: Number.POSITIVE_INFINITY },
      }),
    );
  });

  it("keeps shape-only validation open to future kebab-case keys", () => {
    const futureElement = withElementChanges({ category: "future-category" });

    expect(aurenElementSchema.safeParse(futureElement).success).toBe(true);
    expectCatalogIssueAt(futureElement, ["category"]);
  });

  it("supports all taxonomy types and schemas through the public entrypoint", () => {
    const category: Category = categorySchema.parse("marketing");
    const style: Style = styleSchema.parse("minimal");
    const industry: Industry = industrySchema.parse("saas");
    const feature: Feature = featureSchema.parse("dark-mode");
    const framework: Framework = frameworkSchema.parse("react");
    const element: CatalogElement = {
      id: "hero-001",
      name: "Product launch hero",
      description: "A complete catalog element.",
      category,
      type: "hero",
      styles: [style],
      industries: [industry],
      features: [feature],
      frameworks: [framework],
      dependencies: [{ kind: "package", name: "@acme/ui", version: "^1.2.0" }],
      files: [{ path: "component.tsx", kind: "component" }],
      metadata: { source: "public-entrypoint-test" },
    };

    expect(catalogElementSchema.safeParse(element).success).toBe(true);
  });
});
