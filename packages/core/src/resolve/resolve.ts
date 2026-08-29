import type { CatalogElement } from "@auren/schemas/catalog";
import type { LocalRegistry } from "@auren/registry";

export type ResolvedBlock = {
  element: CatalogElement;
  blocks: readonly CatalogElement[];
};

export class UnknownBlockError extends Error {
  constructor(readonly id: string) {
    super(`Unknown block "${id}"`);
    this.name = "UnknownBlockError";
  }
}

export class MissingAurenDependencyError extends Error {
  constructor(
    readonly id: string,
    readonly missingDependencyId: string,
  ) {
    super(`Block "${id}" depends on unknown block "${missingDependencyId}"`);
    this.name = "MissingAurenDependencyError";
  }
}

export class CircularDependencyError extends Error {
  constructor(readonly chain: readonly string[]) {
    super(`Circular dependency: ${chain.join(" -> ")}`);
    this.name = "CircularDependencyError";
  }
}

export function resolveBlock(
  registry: LocalRegistry,
  id: string,
): ResolvedBlock {
  const element = registry.getById(id);

  if (!element) {
    throw new UnknownBlockError(id);
  }

  const blocks: CatalogElement[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (element: CatalogElement, chain: readonly string[]) => {
    visiting.add(element.id);

    for (const dependency of element.dependencies) {
      if (dependency.kind !== "auren") {
        continue;
      }

      if (visiting.has(dependency.id)) {
        throw new CircularDependencyError([...chain, dependency.id]);
      }

      if (visited.has(dependency.id)) {
        continue;
      }

      const dependencyElement = registry.getById(dependency.id);

      if (!dependencyElement) {
        throw new MissingAurenDependencyError(id, dependency.id);
      }

      visit(dependencyElement, [...chain, dependency.id]);
    }

    visiting.delete(element.id);
    visited.add(element.id);
    blocks.push(element);
  };

  visit(element, [id]);

  return { element, blocks };
}
