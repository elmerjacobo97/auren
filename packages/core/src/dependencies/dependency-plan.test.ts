import type { CatalogElement } from "@auren/schemas/catalog";
import { LocalRegistry } from "@auren/registry";
import { describe, expect, it } from "vitest";
import {
  ConflictingPackageVersionsError,
  InvalidPackageRequirementError,
  InvalidShadcnRequirementError,
  collectPackageDependencies,
  createDependencyPlan,
  resolveProjectDependencies,
  validateShadcnDependency,
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
    expect(plan.shadcn).toEqual([]);
  });

  it("deduplicates shared internal dependencies in deep-first order", () => {
    const registry = new LocalRegistry();
    const button = createElement("button-001");
    const left = createElement("left-001", {
      dependencies: [{ kind: "auren", id: "button-001" }],
    });
    const right = createElement("right-001", {
      dependencies: [{ kind: "auren", id: "button-001" }],
    });
    const root = createElement("root-001", {
      dependencies: [
        { kind: "auren", id: "left-001" },
        { kind: "auren", id: "right-001" },
      ],
    });
    registry.registerMany([button, left, right, root]);

    expect(createDependencyPlan(registry, "root-001").auren).toEqual([
      "button-001",
      "left-001",
      "right-001",
      "root-001",
    ]);
  });

  it("deduplicates shared shadcn requirements in deep-first order", () => {
    const registry = new LocalRegistry();
    const leaf = createElement("leaf-001", {
      dependencies: [
        { kind: "shadcn", name: "button" },
        { kind: "shadcn", name: "dialog" },
      ],
    });
    const branch = createElement("branch-001", {
      dependencies: [
        { kind: "auren", id: "leaf-001" },
        { kind: "shadcn", name: "button" },
        { kind: "shadcn", name: "alert-dialog" },
      ],
    });
    const root = createElement("root-001", {
      dependencies: [
        { kind: "auren", id: "branch-001" },
        { kind: "shadcn", name: "dialog" },
      ],
    });
    registry.registerMany([leaf, branch, root]);

    const plan = createDependencyPlan(registry, "root-001");

    expect(plan.shadcn).toEqual([
      { name: "button" },
      { name: "dialog" },
      { name: "alert-dialog" },
    ]);
    expect(plan.packages).toEqual([]);
  });

  it("reconciles satisfied, missing, and incompatible package ranges", () => {
    const registry = new LocalRegistry();
    registry.register(
      createElement("hero-001", {
        dependencies: [
          packageDependency("motion", "^12.0.0"),
          packageDependency("lucide-react", "^0.468.0"),
        ],
      }),
    );

    expect(
      resolveProjectDependencies(registry, "hero-001", {
        motion: "^12.0.0",
        "lucide-react": "^0.400.0",
      }),
    ).toEqual({
      auren: ["hero-001"],
      packages: [
        { name: "motion", version: "^12.0.0" },
        { name: "lucide-react", version: "^0.468.0" },
      ],
      shadcn: [],
      satisfied: [{ name: "motion", version: "^12.0.0" }],
      missing: [{ name: "lucide-react", version: "^0.468.0" }],
    });
  });

  it.each([
    ["bad name", packageDependency("-unsafe", "^1.0.0")],
    ["bad range", packageDependency("motion", "not-semver")],
  ])("rejects an invalid %s package requirement", (_, dependency) => {
    const registry = new LocalRegistry();
    registry.register(
      createElement("hero-001", { dependencies: [dependency] }),
    );

    expect(() => createDependencyPlan(registry, "hero-001")).toThrow(
      InvalidPackageRequirementError,
    );
  });

  it("rejects unsafe shadcn component requirements before execution", () => {
    for (const name of ["Button", "button/extra", "--help", "../button"]) {
      expect(() => validateShadcnDependency({ name })).toThrow(
        InvalidShadcnRequirementError,
      );
    }
  });

  it("does not mutate the registry while reconciling project dependencies", () => {
    const registry = new LocalRegistry();
    registry.register(
      createElement("hero-001", {
        dependencies: [packageDependency("motion", "^12.0.0")],
      }),
    );
    const before = { size: registry.size, list: registry.list() };

    resolveProjectDependencies(registry, "hero-001", {});

    expect(registry.size).toBe(before.size);
    expect(registry.list()).toEqual(before.list);
  });
});
