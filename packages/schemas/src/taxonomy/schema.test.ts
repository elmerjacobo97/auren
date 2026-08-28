import type {
  BlockType,
  Category,
  Feature,
  Framework,
  Industry,
  Style,
} from "@auren/schemas/taxonomy";
import {
  blockTypeSchema,
  blockTypeValues,
  categorySchema,
  categoryValues,
  featureSchema,
  featureValues,
  frameworkSchema,
  frameworkValues,
  industrySchema,
  industryValues,
  styleSchema,
  styleValues,
} from "@auren/schemas/taxonomy";
import { describe, expect, it } from "vitest";

const dimensions = [
  {
    name: "categories",
    values: categoryValues,
    schema: categorySchema,
    expected: ["marketing", "application-ui", "ecommerce", "authentication"],
  },
  {
    name: "block types",
    values: blockTypeValues,
    schema: blockTypeSchema,
    expected: ["hero", "pricing", "features", "sidebar", "table"],
  },
  {
    name: "styles",
    values: styleValues,
    schema: styleSchema,
    expected: [
      "minimal",
      "bold",
      "editorial",
      "corporate",
      "glass",
      "brutalist",
      "luxury",
      "developer",
    ],
  },
  {
    name: "industries",
    values: industryValues,
    schema: industrySchema,
    expected: [
      "saas",
      "fintech",
      "ai",
      "developer-tools",
      "ecommerce",
      "education",
      "portfolio",
      "agency",
    ],
  },
  {
    name: "features",
    values: featureValues,
    schema: featureSchema,
    expected: [
      "dark-mode",
      "mobile-first",
      "responsive",
      "product-screenshot",
      "two-cta",
      "animated",
      "sidebar",
      "search",
      "command-palette",
    ],
  },
  {
    name: "frameworks",
    values: frameworkValues,
    schema: frameworkSchema,
    expected: ["react"],
  },
] as const;

describe("catalog taxonomy", () => {
  it("exports each vocabulary in its documented order", () => {
    for (const { name, values, expected } of dimensions) {
      expect([...values], name).toEqual(expected);
      expect(new Set(values).size, name).toBe(values.length);
      expect(
        values.every((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)),
        name,
      ).toBe(true);
    }
  });

  it("accepts every official value without transforming it", () => {
    for (const { values, schema } of dimensions) {
      for (const value of values) {
        expect(schema.parse(value)).toBe(value);
      }
    }
  });

  it("keeps shared spellings independent by dimension", () => {
    expect(categorySchema.parse("ecommerce")).toBe("ecommerce");
    expect(industrySchema.parse("ecommerce")).toBe("ecommerce");
    expect(blockTypeSchema.parse("sidebar")).toBe("sidebar");
    expect(featureSchema.parse("sidebar")).toBe("sidebar");
    expect(styleSchema.safeParse("dark-mode").success).toBe(false);
  });

  it("rejects unknown and non-canonical values without normalization", () => {
    const invalidValues = [
      "not-official",
      "marketing-page",
      "Dark Mode",
      "dark_mode",
      "dark mode",
      " marketing",
      "marketing ",
      "MARKETING",
    ];

    for (const { schema } of dimensions) {
      for (const value of invalidValues) {
        expect(schema.safeParse(value).success).toBe(false);
      }
    }
  });

  it("freezes public vocabulary collections at runtime", () => {
    for (const { values } of dimensions) {
      const firstValue = values[0];

      expect(Object.isFrozen(values)).toBe(true);
      expect(() => Object.assign(values, { 0: "changed" })).toThrow();
      expect(values[0]).toBe(firstValue);
    }
  });

  it("exposes types inferred from the public dimension schemas", () => {
    const category: Category = "marketing";
    const blockType: BlockType = "hero";
    const style: Style = "minimal";
    const industry: Industry = "saas";
    const feature: Feature = "dark-mode";
    const framework: Framework = "react";

    expect([category, blockType, style, industry, feature, framework]).toEqual([
      "marketing",
      "hero",
      "minimal",
      "saas",
      "dark-mode",
      "react",
    ]);
  });
});
