import type { LocalRegistry } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";
import { subset, validRange } from "semver";
import {
  resolveBlock,
  resolveCollection,
  type CollectionResolution,
} from "../resolve/resolve.js";

export type PackageDependency = {
  name: string;
  version: string;
};

export type ShadcnDependency = {
  name: string;
};

export type DependencyPlan = {
  auren: readonly string[];
  packages: readonly PackageDependency[];
  shadcn: readonly ShadcnDependency[];
};

export type ProjectDependencyResolution = DependencyPlan & {
  satisfied: readonly PackageDependency[];
  missing: readonly PackageDependency[];
};

export type CollectionDependencyPlan = DependencyPlan & {
  collection: Collection;
  members: readonly CatalogElement[];
};

export type CollectionProjectDependencyResolution = CollectionDependencyPlan & {
  satisfied: readonly PackageDependency[];
  missing: readonly PackageDependency[];
};

type CatalogDependency =
  | {
      readonly kind: "package";
      readonly name: string;
      readonly version: string;
    }
  | { readonly kind: "auren"; readonly id: string }
  | { readonly kind: "shadcn"; readonly name: string };

export class ConflictingPackageVersionsError extends Error {
  constructor(
    readonly packageName: string,
    readonly ranges: readonly [string, string],
  ) {
    super(
      `Conflicting version ranges for package "${packageName}": ${ranges[0]} and ${ranges[1]}`,
    );
    this.name = "ConflictingPackageVersionsError";
  }
}

export class InvalidPackageRequirementError extends Error {
  constructor(
    readonly packageName: string,
    readonly version: string,
    reason: string,
  ) {
    super(
      `Invalid npm package requirement "${packageName}@${version}": ${reason}`,
    );
    this.name = "InvalidPackageRequirementError";
  }
}

export class InvalidShadcnRequirementError extends Error {
  constructor(
    readonly componentName: string,
    reason: string,
  ) {
    super(
      `Invalid shadcn/ui component requirement "${componentName}": ${reason}`,
    );
    this.name = "InvalidShadcnRequirementError";
  }
}

export {
  InvalidPackageRequirementError as InvalidPackageDependencyError,
  InvalidShadcnRequirementError as InvalidShadcnDependencyError,
};

export function collectPackageDependencies(
  registry: LocalRegistry,
  id: string,
): readonly PackageDependency[] {
  return collectDependencyRequirements(resolveBlock(registry, id).blocks)
    .packages;
}

export function collectShadcnDependencies(
  registry: LocalRegistry,
  id: string,
): readonly ShadcnDependency[] {
  return collectDependencyRequirements(resolveBlock(registry, id).blocks)
    .shadcn;
}

export function createDependencyPlan(
  registry: LocalRegistry,
  id: string,
): DependencyPlan {
  const resolved = resolveBlock(registry, id);
  const requirements = collectDependencyRequirements(resolved.blocks);

  return {
    auren: resolved.blocks.map((element) => element.id),
    packages: requirements.packages,
    shadcn: requirements.shadcn,
  };
}

export function collectCollectionPackageDependencies(
  registry: LocalRegistry,
  id: string,
): readonly PackageDependency[] {
  return createCollectionDependencyPlan(registry, id).packages;
}

export function collectCollectionShadcnDependencies(
  registry: LocalRegistry,
  id: string,
): readonly ShadcnDependency[] {
  return createCollectionDependencyPlan(registry, id).shadcn;
}

export function createCollectionDependencyPlan(
  registry: LocalRegistry,
  id: string,
): CollectionDependencyPlan {
  const resolved = resolveCollection(registry, id);
  return createCollectionDependencyPlanFromResolution(resolved);
}

function createCollectionDependencyPlanFromResolution(
  resolved: CollectionResolution,
): CollectionDependencyPlan {
  const requirements = collectDependencyRequirements(resolved.blocks);

  return {
    collection: resolved.collection,
    members: resolved.members,
    auren: resolved.blocks.map((element) => element.id),
    packages: requirements.packages,
    shadcn: requirements.shadcn,
  };
}

function collectDependencyRequirements(elements: readonly CatalogElement[]): {
  readonly packages: readonly PackageDependency[];
  readonly shadcn: readonly ShadcnDependency[];
} {
  const packagesByName = new Map<string, string>();
  const shadcnByName = new Map<string, ShadcnDependency>();

  for (const element of elements) {
    for (const dependency of element.dependencies as readonly CatalogDependency[]) {
      if (dependency.kind === "package") {
        validatePackageDependency(dependency);
        const declaredVersion = packagesByName.get(dependency.name);

        if (declaredVersion === undefined) {
          packagesByName.set(dependency.name, dependency.version);
        } else if (declaredVersion !== dependency.version) {
          throw new ConflictingPackageVersionsError(dependency.name, [
            declaredVersion,
            dependency.version,
          ]);
        }
        continue;
      }

      if (dependency.kind === "shadcn") {
        validateShadcnDependency(dependency);
        shadcnByName.set(dependency.name, { name: dependency.name });
      }
    }
  }

  return {
    packages: Array.from(packagesByName, ([name, version]) => ({
      name,
      version,
    })),
    shadcn: [...shadcnByName.values()],
  };
}

export function resolveProjectDependencies(
  registry: LocalRegistry,
  id: string,
  projectDependencies: Readonly<Record<string, string>> = {},
): ProjectDependencyResolution {
  const plan = createDependencyPlan(registry, id);
  return {
    ...plan,
    ...reconcilePackages(plan.packages, projectDependencies),
  };
}

export function resolveProjectCollectionDependencies(
  registry: LocalRegistry,
  id: string,
  projectDependencies: Readonly<Record<string, string>> = {},
): CollectionProjectDependencyResolution {
  const plan = createCollectionDependencyPlan(registry, id);
  return {
    ...plan,
    ...reconcilePackages(plan.packages, projectDependencies),
  };
}

function reconcilePackages(
  packages: readonly PackageDependency[],
  projectDependencies: Readonly<Record<string, string>>,
): {
  readonly satisfied: readonly PackageDependency[];
  readonly missing: readonly PackageDependency[];
} {
  const satisfied: PackageDependency[] = [];
  const missing: PackageDependency[] = [];

  for (const dependency of packages) {
    if (coversRange(projectDependencies[dependency.name], dependency.version)) {
      satisfied.push(dependency);
    } else {
      missing.push(dependency);
    }
  }

  return { satisfied, missing };
}

export function validatePackageDependency(dependency: PackageDependency): void {
  if (!packageNamePattern.test(dependency.name)) {
    throw new InvalidPackageRequirementError(
      dependency.name,
      dependency.version,
      "the package name is not a supported npm package name",
    );
  }

  if (validRange(dependency.version) === null) {
    throw new InvalidPackageRequirementError(
      dependency.name,
      dependency.version,
      "the version must be a valid semver range",
    );
  }
}

export function validateShadcnDependency(dependency: ShadcnDependency): void {
  if (!shadcnNamePattern.test(dependency.name)) {
    throw new InvalidShadcnRequirementError(
      dependency.name,
      "the component name must use lowercase kebab-case",
    );
  }
}

function coversRange(
  declaredVersion: string | undefined,
  requiredVersion: string,
): boolean {
  if (declaredVersion === undefined) {
    return false;
  }

  const declaredRange = validRange(declaredVersion);
  const requiredRange = validRange(requiredVersion);

  return (
    declaredRange !== null &&
    requiredRange !== null &&
    subset(requiredRange, declaredRange)
  );
}

const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const shadcnNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
