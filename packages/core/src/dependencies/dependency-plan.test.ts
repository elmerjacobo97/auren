import type { CatalogElement } from "@auren/schemas/catalog";
import { LocalRegistry } from "@auren/registry";
import { describe, expect, it } from "vitest";
import {
  ConflictingPackageVersionsError,
  collectPackageDependencies,
  createDependencyPlan,
} from "./dependency-plan";

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

function packageDependency(name: string, version: string) {
  return { kind: "package" as const, name, version };
}

function captureError(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw");
}

describe("dependency planning", () => {
  it("merges duplicate package dependencies declared across the chain", () => {
    const registry = new LocalRegistry();
    const inner = createElement("inner-001", {
      dependencies: [
        packageDependency("@acme/ui", "^1.0.0"),
        packageDependency("motion", "^12.0.0"),
      ],
    });
    const outer = createElement("outer-001", {
      dependencies: [
        { kind: "auren", id: "inner-001" },
        packageDependency("@acme/ui", "^1.0.0"),
      ],
    });
    registry.registerMany([inner, outer]);

    expect(collectPackageDependencies(registry, "outer-001")).toEqual([
      { name: "@acme/ui", version: "^1.0.0" },
      { name: "motion", version: "^12.0.0" },
    ]);
  });

  it("throws ConflictingPackageVersionsError for different ranges of one package", () => {
    const registry = new LocalRegistry();
    const inner = createElement("inner-001", {
      dependencies: [packageDependency("@acme/ui", "^1.0.0")],
    });
    const outer = createElement("outer-001", {
      dependencies: [
        { kind: "auren", id: "inner-001" },
        packageDependency("@acme/ui", "^2.0.0"),
      ],
    });
    registry.registerMany([inner, outer]);

    const error = captureError(() =>
      collectPackageDependencies(registry, "outer-001"),
    );

    expect(error).toBeInstanceOf(ConflictingPackageVersionsError);
    expect(error).toMatchObject({
      packageName: "@acme/ui",
      ranges: ["^1.0.0", "^2.0.0"],
      name: "ConflictingPackageVersionsError",
    });
  });

  it("builds an ordered plan with internal ids and folded packages", () => {
    const registry = new LocalRegistry();
    const leaf = createElement("leaf-001", {
      dependencies: [packageDependency("motion", "^12.0.0")],
    });
    const branch = createElement("branch-001", {
      dependencies: [
        { kind: "auren", id: "leaf-001" },
        packageDependency("@acme/ui", "^1.0.0"),
      ],
    });
    const root = createElement("root-001", {
      dependencies: [
        { kind: "auren", id: "branch-001" },
        packageDependency("@acme/ui", "^1.0.0"),
      ],
    });
    registry.registerMany([leaf, branch, root]);

    const plan = createDependencyPlan(registry, "root-001");

    expect(plan.auren).toEqual(["leaf-001", "branch-001", "root-001"]);
    expect(plan.packages).toEqual([
      { name: "motion", version: "^12.0.0" },
      { name: "@acme/ui", version: "^1.0.0" },
    ]);
  });
});
