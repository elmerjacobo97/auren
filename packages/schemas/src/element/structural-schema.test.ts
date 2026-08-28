import type {
  AurenDependency,
  AurenElement,
  AurenFile,
  AurenMetadata,
} from "@auren/schemas/element";
import {
  aurenElementSchema,
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
} from "@auren/schemas/element";
import { describe, expect, it } from "vitest";
import { canonicalElement } from "@/element/fixtures/canonical-element.js";

function withElementChanges(changes: Record<string, unknown>) {
  return { ...canonicalElement, ...changes };
}

function expectInvalid(value: unknown) {
  expect(aurenElementSchema.safeParse(value).success).toBe(false);
}

describe("aurenElementSchema", () => {
  it("accepts a complete element and preserves its values", () => {
    const parsed = aurenElementSchema.parse(canonicalElement);
    const result = aurenElementSchema.safeParse(canonicalElement);

    expect(parsed).toEqual(canonicalElement);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual(canonicalElement);
    }
  });

  it("rejects missing and unknown top-level fields", () => {
    for (const field of Object.keys(canonicalElement)) {
      const incomplete: Record<string, unknown> = { ...canonicalElement };
      delete incomplete[field];
      expectInvalid(incomplete);
    }

    expectInvalid(withElementChanges({ extra: true }));
  });

  it("rejects unknown nested structural fields", () => {
    expectInvalid(
      withElementChanges({
        dependencies: [
          {
            kind: "package",
            name: "@acme/ui",
            version: "^1.2.0",
            extra: true,
          },
        ],
      }),
    );
    expectInvalid(
      withElementChanges({
        files: [
          {
            path: "component.tsx",
            kind: "component",
            extra: true,
          },
        ],
      }),
    );
  });

  it("rejects non-canonical keys and text outside documented limits", () => {
    const invalidKeys = [
      "Hero",
      "has space",
      "with_under-score",
      "double--hyphen",
      "-leading",
      "trailing-",
    ];

    for (const field of ["id", "category", "type"]) {
      for (const value of invalidKeys) {
        expectInvalid(withElementChanges({ [field]: value }));
      }
    }

    for (const field of ["styles", "industries", "features", "frameworks"]) {
      for (const value of invalidKeys) {
        expectInvalid(withElementChanges({ [field]: [value] }));
      }
    }

    expectInvalid(withElementChanges({ name: "" }));
    expectInvalid(
      withElementChanges({ name: "n".repeat(MAX_NAME_LENGTH + 1) }),
    );
    expectInvalid(withElementChanges({ description: "" }));
    expectInvalid(
      withElementChanges({
        description: "d".repeat(MAX_DESCRIPTION_LENGTH + 1),
      }),
    );
  });

  it("rejects duplicate classifications and an empty framework list", () => {
    for (const field of [
      "styles",
      "industries",
      "features",
      "frameworks",
    ] as const) {
      const values = [...canonicalElement[field], canonicalElement[field][0]];
      expectInvalid(withElementChanges({ [field]: values }));
    }

    expectInvalid(withElementChanges({ frameworks: [] }));
  });

  it("rejects incompatible, duplicate, and self-referencing dependencies", () => {
    expectInvalid(
      withElementChanges({
        dependencies: [{ kind: "package", name: "@acme/ui" }],
      }),
    );
    expectInvalid(
      withElementChanges({
        dependencies: [
          { kind: "package", name: "@acme/ui", version: "^1.2.0", id: "wrong" },
        ],
      }),
    );
    expectInvalid(
      withElementChanges({
        dependencies: [{ kind: "auren", id: "button-001", name: "wrong" }],
      }),
    );
    expectInvalid(
      withElementChanges({
        dependencies: [{ kind: "unknown", id: "button-001" }],
      }),
    );

    expectInvalid(
      withElementChanges({
        dependencies: [
          { kind: "package", name: "@acme/ui", version: "^1.2.0" },
          { kind: "package", name: "@acme/ui", version: "~1.3.0" },
        ],
      }),
    );
    expectInvalid(
      withElementChanges({
        dependencies: [
          { kind: "auren", id: "button-001" },
          { kind: "auren", id: "button-001" },
        ],
      }),
    );
    expectInvalid(
      withElementChanges({
        dependencies: [{ kind: "auren", id: "hero-001" }],
      }),
    );
  });

  it("rejects empty, duplicate, absolute, and unsafe file paths", () => {
    expectInvalid(withElementChanges({ files: [] }));
    expectInvalid(
      withElementChanges({
        files: [
          canonicalElement.files[0],
          { ...canonicalElement.files[0], kind: "utility" },
        ],
      }),
    );

    for (const path of [
      "",
      "/absolute.tsx",
      "../escape.tsx",
      "nested/../escape.tsx",
      "./dot.tsx",
      "nested\\file.tsx",
      "C:/absolute.tsx",
    ]) {
      expectInvalid(
        withElementChanges({
          files: [{ path, kind: "component" }],
        }),
      );
      expectInvalid(
        withElementChanges({
          files: [{ path: "component.tsx", kind: "component", target: path }],
        }),
      );
    }
  });

  it("rejects metadata values that are not JSON-safe", () => {
    class RuntimeMetadataValue {}

    const invalidValues: unknown[] = [
      undefined,
      () => "not-json",
      Symbol("not-json"),
      Number.POSITIVE_INFINITY,
      Number.NaN,
      new Date("2026-01-01"),
      new Map<string, string>(),
      new RuntimeMetadataValue(),
    ];

    for (const value of invalidValues) {
      expectInvalid(withElementChanges({ metadata: { value } }));
    }
  });

  it("supports the public inferred types without private imports", () => {
    const metadata: AurenMetadata = {
      source: "fixture",
      nested: [true, null, { count: 1 }],
    };
    const dependency: AurenDependency = {
      kind: "package",
      name: "@acme/ui",
      version: "^1.2.0",
    };
    const file: AurenFile = {
      path: "component.tsx",
      kind: "component",
    };
    const element: AurenElement = {
      ...canonicalElement,
      dependencies: [dependency],
      files: [file],
      metadata,
    };

    expect(aurenElementSchema.safeParse(element).success).toBe(true);
  });
});
