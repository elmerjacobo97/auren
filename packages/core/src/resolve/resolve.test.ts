import type { CatalogElement } from "@auren/schemas/catalog";
import { LocalRegistry } from "@auren/registry";
import { describe, expect, it } from "vitest";
import {
  CircularDependencyError,
  MissingAurenDependencyError,
  UnknownBlockError,
  resolveBlock,
} from "./resolve";

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

function aurenDependency(id: string): CatalogElement["dependencies"][number] {
  return { kind: "auren", id };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw");
}

describe("resolveBlock", () => {
  it("returns the element itself when it declares no internal dependencies", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001");
    registry.register(element);

    const result = resolveBlock(registry, "hero-001");

    expect(result.element).toEqual(element);
    expect(result.blocks).toEqual([element]);
  });

  it("orders a transitive dependency chain deeply first as [c, b, a]", () => {
    const registry = new LocalRegistry();
    const a = createElement("a-001", {
      dependencies: [
        aurenDependency("b-001"),
        { kind: "package", name: "@acme/ui", version: "^1.0.0" },
      ],
    });
    const b = createElement("b-001", {
      dependencies: [aurenDependency("c-001")],
    });
    const c = createElement("c-001");
    registry.registerMany([b, a, c]);

    const result = resolveBlock(registry, "a-001");

    expect(result.blocks.map(({ id }) => id)).toEqual([
      "c-001",
      "b-001",
      "a-001",
    ]);
    expect(result.element).toEqual(a);
  });

  it("includes a shared dependency exactly once", () => {
    const registry = new LocalRegistry();
    const shared = createElement("shared-001");
    const left = createElement("left-001", {
      dependencies: [aurenDependency("shared-001")],
    });
    const right = createElement("right-001", {
      dependencies: [aurenDependency("shared-001")],
    });
    const root = createElement("root-001", {
      dependencies: [aurenDependency("left-001"), aurenDependency("right-001")],
    });
    registry.registerMany([shared, left, right, root]);

    const result = resolveBlock(registry, "root-001");

    expect(result.blocks.map(({ id }) => id)).toEqual([
      "shared-001",
      "left-001",
      "right-001",
      "root-001",
    ]);
  });

  it("rejects an unknown requested id with UnknownBlockError", () => {
    const registry = new LocalRegistry();
    registry.register(createElement("hero-001"));

    const error = captureError(() => resolveBlock(registry, "missing-001"));

    expect(error).toBeInstanceOf(UnknownBlockError);
    expect(error).toMatchObject({
      id: "missing-001",
      name: "UnknownBlockError",
    });
  });

  it("rejects a missing auren dependency with the requested and missing ids", () => {
    const registry = new LocalRegistry();
    const element = createElement("a-001", {
      dependencies: [aurenDependency("missing-001")],
    });
    registry.register(element);

    const error = captureError(() => resolveBlock(registry, "a-001"));

    expect(error).toBeInstanceOf(MissingAurenDependencyError);
    expect(error).toMatchObject({
      id: "a-001",
      missingDependencyId: "missing-001",
      name: "MissingAurenDependencyError",
    });
  });

  it("rejects transitive cycles with CircularDependencyError", () => {
    const registry = new LocalRegistry();
    const a = createElement("cycle-a-001", {
      dependencies: [aurenDependency("cycle-b-001")],
    });
    const b = createElement("cycle-b-001", {
      dependencies: [aurenDependency("cycle-a-001")],
    });
    registry.registerMany([a, b]);

    const error = captureError(() => resolveBlock(registry, "cycle-a-001"));

    expect(error).toBeInstanceOf(CircularDependencyError);
    expect(error).toMatchObject({
      chain: ["cycle-a-001", "cycle-b-001", "cycle-a-001"],
      name: "CircularDependencyError",
    });
  });

  it("ignores package-kind dependencies during registry resolution", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001", {
      dependencies: [
        { kind: "package", name: "@acme/ui", version: "^1.0.0" },
        { kind: "package", name: "motion", version: "^12.0.0" },
      ],
    });
    registry.register(element);

    const result = resolveBlock(registry, "hero-001");

    expect(result.blocks.map(({ id }) => id)).toEqual(["hero-001"]);
  });

  it("does not mutate the registry when resolution fails", () => {
    const registry = new LocalRegistry();
    const element = createElement("hero-001", {
      dependencies: [aurenDependency("missing-001")],
    });
    registry.register(element);

    const before = {
      size: registry.size,
      list: registry.list(),
      byId: registry.getById("hero-001"),
    };
    captureError(() => resolveBlock(registry, "hero-001"));
    captureError(() => resolveBlock(registry, "unknown-001"));

    expect(registry.size).toBe(before.size);
    expect(registry.list()).toEqual(before.list);
    expect(registry.getById("hero-001")).toEqual(before.byId);
  });
});
