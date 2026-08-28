import type { CatalogElement } from "@auren/schemas/catalog";
import {
  DuplicateElementError,
  LocalRegistry,
  type RegistryFilter,
} from "@auren/registry";
import { describe, expect, it } from "vitest";

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
    dependencies: [{ kind: "package", name: "@acme/ui", version: "^1.0.0" }],
    files: [
      {
        path: `${id}.tsx`,
        kind: "component",
        content: `export function ${id.replaceAll("-", "_")}() {}`,
      },
    ],
    metadata: {
      author: "Auren",
      score: 4.5,
      flags: { featured: true, rank: 1 },
      tags: ["conversion", "landing-page"],
    },
    ...changes,
  };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw");
}

function expectDuplicate(action: () => unknown, id: string) {
  const error = captureError(action);

  expect(error).toBeInstanceOf(DuplicateElementError);
  expect(error).toMatchObject({ id, name: "DuplicateElementError" });
}

describe("LocalRegistry", () => {
  it("exposes an empty typed public API", () => {
    const registry = new LocalRegistry();
    const filter: RegistryFilter = {
      category: "marketing",
      type: "hero",
      style: "minimal",
      industry: "saas",
      feature: "responsive",
      framework: "react",
      metadata: { author: "Auren" },
    };

    expect(registry.size).toBe(0);
    expect(registry.has("hero-001")).toBe(false);
    expect(registry.getById("hero-001")).toBeUndefined();
    expect(registry.list()).toEqual([]);
    expect(registry.query()).toEqual([]);
    expect(registry.query(filter)).toEqual([]);
  });

  it("registers individual elements and preserves accepted values", () => {
    const registry = new LocalRegistry();
    const input = createElement("hero-001");
    const registered = registry.register(input);

    expect(registered).toEqual(input);
    expect(registry.size).toBe(1);
    expect(registry.has(input.id)).toBe(true);
    expect(registry.getById(input.id)).toEqual(input);
    expect(registry.list()).toEqual([input]);
  });

  it("registers batches atomically and preserves registration order", () => {
    const registry = new LocalRegistry();
    const first = createElement("hero-001");
    const second = createElement("pricing-001", {
      type: "pricing",
      styles: ["bold"],
    });

    expect(registry.registerMany([first, second])).toEqual([first, second]);
    expect(registry.size).toBe(2);
    expect(registry.list().map(({ id }) => id)).toEqual([
      "hero-001",
      "pricing-001",
    ]);
  });

  it("propagates Zod issues without mutating on invalid registration", () => {
    const registry = new LocalRegistry();
    const existing = createElement("hero-001");
    registry.register(existing);

    const invalid = {
      ...createElement("invalid-001"),
      category: "future-category",
    };
    const error = captureError(() => registry.register(invalid));

    expect(error).toMatchObject({ name: "ZodError" });
    expect(error).toHaveProperty("issues");
    expect(
      (error as { issues: { path: PropertyKey[] }[] }).issues.some(
        ({ path }) => path.length === 1 && path[0] === "category",
      ),
    ).toBe(true);
    expect(registry.size).toBe(1);
    expect(registry.list()).toEqual([existing]);
  });

  it("does not commit any batch element when validation fails", () => {
    const registry = new LocalRegistry();
    const valid = createElement("hero-001");
    const invalid = {
      ...createElement("pricing-001"),
      files: [{ path: "../escape.tsx", kind: "component" }],
    };

    expect(() => registry.registerMany([valid, invalid])).toThrow();
    expect(registry.size).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it("rejects existing IDs without replacing the stored element", () => {
    const registry = new LocalRegistry();
    const original = createElement("hero-001");
    registry.register(original);

    expectDuplicate(
      () =>
        registry.register(createElement("hero-001", { name: "Replacement" })),
      "hero-001",
    );
    expect(registry.size).toBe(1);
    expect(registry.getById("hero-001")).toEqual(original);
  });

  it("rejects duplicate IDs inside a batch without partial commit", () => {
    const registry = new LocalRegistry();
    const existing = createElement("existing-001");
    registry.register(existing);

    expectDuplicate(
      () =>
        registry.registerMany([
          createElement("hero-001"),
          createElement("hero-001", { name: "Duplicate" }),
        ]),
      "hero-001",
    );
    expect(registry.list()).toEqual([existing]);
  });

  it("rejects a batch collision with an existing ID without partial commit", () => {
    const registry = new LocalRegistry();
    const existing = createElement("hero-001");
    registry.register(existing);

    expectDuplicate(
      () =>
        registry.registerMany([
          createElement("pricing-001", { type: "pricing" }),
          createElement("hero-001", { name: "Duplicate" }),
        ]),
      "hero-001",
    );
    expect(registry.list()).toEqual([existing]);
  });

  it("queries every classification index and preserves registration order", () => {
    const registry = new LocalRegistry();
    const first = createElement("hero-001");
    const second = createElement("pricing-001", {
      type: "pricing",
      styles: ["bold"],
      industries: ["fintech"],
      features: ["dark-mode"],
    });
    const third = createElement("sidebar-001", {
      category: "application-ui",
      type: "sidebar",
      styles: ["developer"],
      industries: ["developer-tools"],
      features: ["sidebar", "responsive"],
    });
    registry.registerMany([first, second, third]);

    expect(registry.query({ category: "marketing" })).toEqual([first, second]);
    expect(registry.query({ type: "sidebar" })).toEqual([third]);
    expect(registry.query({ style: "bold" })).toEqual([second]);
    expect(registry.query({ industry: "developer-tools" })).toEqual([third]);
    expect(registry.query({ feature: "responsive" })).toEqual([first, third]);
    expect(registry.query({ framework: "react" })).toEqual([
      first,
      second,
      third,
    ]);
    expect(registry.query()).toEqual([first, second, third]);
    expect(registry.query({})).toEqual([first, second, third]);
  });

  it("combines classification filters with AND semantics", () => {
    const registry = new LocalRegistry();
    const hero = createElement("hero-001");
    const pricing = createElement("pricing-001", {
      type: "pricing",
      styles: ["bold"],
    });
    registry.registerMany([hero, pricing]);

    expect(
      registry.query({
        category: "marketing",
        type: "hero",
        style: "minimal",
        industry: "saas",
        feature: "responsive",
        framework: "react",
      }),
    ).toEqual([hero]);
    expect(registry.query({ type: "hero", style: "bold" })).toEqual([]);
    expect(registry.query({ category: "ecommerce" })).toEqual([]);
  });

  it("matches partial top-level metadata with recursive JSON equality", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001");
    registry.register(element);

    expect(registry.query({ metadata: { author: "Auren" } })).toEqual([
      element,
    ]);
    expect(
      registry.query({ metadata: { flags: { rank: 1, featured: true } } }),
    ).toEqual([element]);
    expect(
      registry.query({
        metadata: { tags: ["conversion", "landing-page"] },
      }),
    ).toEqual([element]);
    expect(
      registry.query({
        metadata: { tags: ["landing-page", "conversion"] },
      }),
    ).toEqual([]);
    expect(registry.query({ metadata: { flags: { featured: true } } })).toEqual(
      [],
    );
    expect(registry.query({ metadata: { missing: true } })).toEqual([]);
    expect(registry.query({ metadata: { score: 5 } })).toEqual([]);
  });

  it("isolates caller input and every returned element from stored state", () => {
    const registry = new LocalRegistry();
    const input = createElement("hero-001");
    const registered = registry.register(input);

    input.styles[0] = "bold";
    input.files[0].path = "mutated-input.tsx";
    input.metadata.author = "Input mutation";
    registered.industries[0] = "fintech";
    registered.metadata.author = "Register result mutation";

    const batchInput = createElement("pricing-001", { type: "pricing" });
    const batchResult = registry.registerMany([batchInput]);
    batchInput.features[0] = "dark-mode";
    batchResult[0].frameworks.length = 0;

    const lookup = registry.getById("hero-001");
    expect(lookup).toBeDefined();
    if (lookup) {
      lookup.features[0] = "animated";
      lookup.files[0].content = "mutated lookup";
    }

    const listed = registry.list();
    listed[0].styles[0] = "luxury";
    listed[0].dependencies[0] = {
      kind: "package",
      name: "mutated",
      version: "1.0.0",
    };

    const queried = registry.query({ style: "minimal" });
    queried[0].metadata.author = "Query result mutation";

    expect(registry.getById("hero-001")).toEqual(createElement("hero-001"));
    expect(registry.getById("pricing-001")).toEqual(
      createElement("pricing-001", { type: "pricing" }),
    );
    expect(registry.query({ style: "minimal" }).map(({ id }) => id)).toEqual([
      "hero-001",
      "pricing-001",
    ]);
    expect(registry.query({ style: "bold" })).toEqual([]);
    expect(registry.query({ industry: "fintech" })).toEqual([]);
    expect(registry.query({ feature: "dark-mode" })).toEqual([]);
    expect(registry.size).toBe(2);
  });
});
