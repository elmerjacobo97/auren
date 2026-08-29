import type { LocalRegistry } from "@auren/registry";
import { resolveBlock } from "../resolve/resolve.js";

export type PackageDependency = {
  name: string;
  version: string;
};

export type DependencyPlan = {
  auren: readonly string[];
  packages: readonly PackageDependency[];
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
