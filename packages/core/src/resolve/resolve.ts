import type { LocalRegistry } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";

export type ResolvedBlock = {
  element: CatalogElement;
  blocks: readonly CatalogElement[];
};

export type CollectionResolution = {
  collection: Collection;
  members: readonly CatalogElement[];
  blocks: readonly CatalogElement[];
};

export class UnknownBlockError extends Error {
  constructor(readonly id: string) {
    super(`Unknown block "${id}"`);
    this.name = "UnknownBlockError";
  }
}

export class UnknownCollectionError extends Error {
  constructor(readonly id: string) {
    super(`Unknown Collection "${id}"`);
    this.name = "UnknownCollectionError";
  }
}

export class MissingCollectionBlockError extends Error {
  constructor(
    readonly collectionId: string,
    readonly blockId: string,
  ) {
    super(`Collection "${collectionId}" references unknown block "${blockId}"`);
    this.name = "MissingCollectionBlockError";
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

export function resolveCollection(
  registry: LocalRegistry,
  id: string,
): CollectionResolution {
  const collection = registry.getCollectionById(id);

  if (!collection) {
    throw new UnknownCollectionError(id);
  }

  const members: CatalogElement[] = [];
  const blocks: CatalogElement[] = [];
  const resolvedIds = new Set<string>();

  for (const blockId of collection.blocks) {
    const member = registry.getById(blockId);

    if (!member) {
      throw new MissingCollectionBlockError(collection.id, blockId);
    }

    members.push(member);

    for (const block of resolveBlock(registry, blockId).blocks) {
      if (resolvedIds.has(block.id)) {
        continue;
      }

      resolvedIds.add(block.id);
      blocks.push(block);
    }
  }

  return { collection, members, blocks };
}
