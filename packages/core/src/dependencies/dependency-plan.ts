import type { LocalRegistry } from "@auren/registry";
import { subset, validRange } from "semver";
import { resolveBlock } from "../resolve/resolve.js";

export type PackageDependency = {
  name: string;
  version: string;
};

export type DependencyPlan = {
  auren: readonly string[];
  packages: readonly PackageDependency[];
};

export type ProjectDependencyResolution = DependencyPlan & {
  satisfied: readonly PackageDependency[];
  missing: readonly PackageDependency[];
};

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

export { InvalidPackageRequirementError as InvalidPackageDependencyError };

export function collectPackageDependencies(
  registry: LocalRegistry,
  id: string,
): readonly PackageDependency[] {
  const resolved = resolveBlock(registry, id);
  const packagesByName = new Map<string, string>();

  for (const element of resolved.blocks) {
    for (const dependency of element.dependencies) {
      if (dependency.kind !== "package") {
        continue;
      }

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
    }
  }

  return Array.from(packagesByName, ([name, version]) => ({ name, version }));
}

export function createDependencyPlan(
  registry: LocalRegistry,
  id: string,
): DependencyPlan {
  const resolved = resolveBlock(registry, id);

  return {
    auren: resolved.blocks.map((element) => element.id),
    packages: collectPackageDependencies(registry, id),
  };
}

export function resolveProjectDependencies(
  registry: LocalRegistry,
  id: string,
  projectDependencies: Readonly<Record<string, string>> = {},
): ProjectDependencyResolution {
  const plan = createDependencyPlan(registry, id);
  const satisfied: PackageDependency[] = [];
  const missing: PackageDependency[] = [];

  for (const dependency of plan.packages) {
    if (coversRange(projectDependencies[dependency.name], dependency.version)) {
      satisfied.push(dependency);
    } else {
      missing.push(dependency);
    }
  }

  return {
    ...plan,
    satisfied,
    missing,
  };
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
