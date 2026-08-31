import { type Collection, collectionSchema } from "@auren/schemas/collection";
import {
  type CatalogElement,
  catalogElementSchema,
} from "@auren/schemas/catalog";
import type { AurenMetadata } from "@auren/schemas/element";
import type {
  BlockType,
  Category,
  Feature,
  Framework,
  Industry,
  Style,
} from "@auren/schemas/taxonomy";

export type RegistryFilter = {
  category?: Category;
  type?: BlockType;
  style?: Style;
  industry?: Industry;
  feature?: Feature;
  framework?: Framework;
  metadata?: AurenMetadata;
};

export type CollectionFilter = {
  category?: Category;
  style?: Style;
  industry?: Industry;
  feature?: Feature;
  framework?: Framework;
  metadata?: AurenMetadata;
};

export class DuplicateElementError extends Error {
  constructor(readonly id: string) {
    super(`An element with ID "${id}" is already registered`);
    this.name = "DuplicateElementError";
  }
}

export class DuplicateCollectionError extends Error {
  constructor(readonly id: string) {
    super(`A collection with ID "${id}" is already registered`);
    this.name = "DuplicateCollectionError";
  }
}

export class MissingCollectionBlockError extends Error {
  constructor(
    readonly collectionId: string,
    readonly blockId: string,
  ) {
    super(
      `Collection "${collectionId}" references unregistered block "${blockId}"`,
    );
    this.name = "MissingCollectionBlockError";
  }
}

export class IncompatibleCollectionError extends Error {
  constructor(
    readonly collectionId: string,
    readonly blockId: string,
    readonly framework: string,
  ) {
    super(
      `Collection "${collectionId}" requires framework "${framework}" unsupported by block "${blockId}"`,
    );
    this.name = "IncompatibleCollectionError";
  }
}

type ClassificationIndex = Map<string, Set<string>>;

function cloneJsonValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item)) as T;
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]),
    ) as T;
  }

  return value;
}

function cloneElement(element: CatalogElement): CatalogElement {
  return {
    ...element,
    styles: [...element.styles],
    industries: [...element.industries],
    features: [...element.features],
    frameworks: [...element.frameworks],
    dependencies: element.dependencies.map((dependency) => ({
      ...dependency,
    })),
    files: element.files.map((file) => ({ ...file })),
    metadata: cloneJsonValue(element.metadata),
  };
}

function cloneCollection(collection: Collection): Collection {
  return {
    ...collection,
    styles: [...collection.styles],
    industries: [...collection.industries],
    features: [...collection.features],
    frameworks: [...collection.frameworks],
    blocks: [...collection.blocks],
    metadata: cloneJsonValue(collection.metadata),
  };
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }

  if (
    typeof left !== "object" ||
    left === null ||
    typeof right !== "object" ||
    right === null
  ) {
    return false;
  }

  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;

  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, value]) =>
        Object.hasOwn(rightRecord, key) &&
        jsonValuesEqual(value, rightRecord[key]),
    )
  );
}

function metadataMatches(
  metadata: AurenMetadata,
  requested: AurenMetadata | undefined,
): boolean {
  if (requested === undefined) {
    return true;
  }

  return Object.entries(requested).every(
    ([key, value]) =>
      Object.hasOwn(metadata, key) && jsonValuesEqual(metadata[key], value),
  );
}

function addToIndex(index: ClassificationIndex, value: string, id: string) {
  const ids = index.get(value);

  if (ids) {
    ids.add(id);
  } else {
    index.set(value, new Set([id]));
  }
}

export class LocalRegistry {
  private readonly elementsById = new Map<string, CatalogElement>();
  private readonly categoryIndex: ClassificationIndex = new Map();
  private readonly typeIndex: ClassificationIndex = new Map();
  private readonly styleIndex: ClassificationIndex = new Map();
  private readonly industryIndex: ClassificationIndex = new Map();
  private readonly featureIndex: ClassificationIndex = new Map();
  private readonly frameworkIndex: ClassificationIndex = new Map();
  private readonly collectionsById = new Map<string, Collection>();
  private readonly collectionCategoryIndex: ClassificationIndex = new Map();
  private readonly collectionStyleIndex: ClassificationIndex = new Map();
  private readonly collectionIndustryIndex: ClassificationIndex = new Map();
  private readonly collectionFeatureIndex: ClassificationIndex = new Map();
  private readonly collectionFrameworkIndex: ClassificationIndex = new Map();

  get size(): number {
    return this.elementsById.size;
  }

  get collectionSize(): number {
    return this.collectionsById.size;
  }

  register(input: unknown): CatalogElement {
    return this.registerMany([input])[0];
  }

  registerMany(inputs: readonly unknown[]): readonly CatalogElement[] {
    const parsedElements = inputs.map((input) =>
      catalogElementSchema.parse(input),
    );
    const batchIds = new Set<string>();

    for (const element of parsedElements) {
      if (this.elementsById.has(element.id) || batchIds.has(element.id)) {
        throw new DuplicateElementError(element.id);
      }

      batchIds.add(element.id);
    }

    const storedElements = parsedElements.map((element) =>
      cloneElement(element),
    );

    for (const element of storedElements) {
      this.elementsById.set(element.id, element);
      this.indexElement(element);
    }

    return storedElements.map((element) => cloneElement(element));
  }

  registerCollection(input: unknown): Collection {
    return this.registerCollections([input])[0];
  }

  registerCollections(inputs: readonly unknown[]): readonly Collection[] {
    const parsedCollections = inputs.map((input) =>
      collectionSchema.parse(input),
    );
    const batchIds = new Set<string>();

    for (const collection of parsedCollections) {
      if (
        this.collectionsById.has(collection.id) ||
        batchIds.has(collection.id)
      ) {
        throw new DuplicateCollectionError(collection.id);
      }

      batchIds.add(collection.id);
    }

    for (const collection of parsedCollections) {
      for (const blockId of collection.blocks) {
        const block = this.elementsById.get(blockId);

        if (block === undefined) {
          throw new MissingCollectionBlockError(collection.id, blockId);
        }

        for (const framework of collection.frameworks) {
          if (!block.frameworks.includes(framework)) {
            throw new IncompatibleCollectionError(
              collection.id,
              blockId,
              framework,
            );
          }
        }
      }
    }

    const storedCollections = parsedCollections.map((collection) =>
      cloneCollection(collection),
    );

    for (const collection of storedCollections) {
      this.collectionsById.set(collection.id, collection);
      this.indexCollection(collection);
    }

    return storedCollections.map((collection) => cloneCollection(collection));
  }

  getById(id: string): CatalogElement | undefined {
    const element = this.elementsById.get(id);

    return element ? cloneElement(element) : undefined;
  }

  getCollectionById(id: string): Collection | undefined {
    const collection = this.collectionsById.get(id);

    return collection ? cloneCollection(collection) : undefined;
  }

  hasCollection(id: string): boolean {
    return this.collectionsById.has(id);
  }

  listCollections(): readonly Collection[] {
    return Array.from(this.collectionsById.values(), (collection) =>
      cloneCollection(collection),
    );
  }

  has(id: string): boolean {
    return this.elementsById.has(id);
  }

  list(): readonly CatalogElement[] {
    return Array.from(this.elementsById.values(), (element) =>
      cloneElement(element),
    );
  }

  query(filter: RegistryFilter = {}): readonly CatalogElement[] {
    let matchingIds: Set<string> | undefined;

    const applyIndex = (
      value: string | undefined,
      index: ClassificationIndex,
    ) => {
      if (value === undefined) {
        return true;
      }

      const indexedIds = index.get(value);

      if (!indexedIds) {
        return false;
      }

      matchingIds = matchingIds
        ? new Set([...matchingIds].filter((id) => indexedIds.has(id)))
        : new Set(indexedIds);

      return matchingIds.size > 0;
    };

    if (
      !applyIndex(filter.category, this.categoryIndex) ||
      !applyIndex(filter.type, this.typeIndex) ||
      !applyIndex(filter.style, this.styleIndex) ||
      !applyIndex(filter.industry, this.industryIndex) ||
      !applyIndex(filter.feature, this.featureIndex) ||
      !applyIndex(filter.framework, this.frameworkIndex)
    ) {
      return [];
    }

    const results: CatalogElement[] = [];

    for (const element of this.elementsById.values()) {
      if (
        (matchingIds === undefined || matchingIds.has(element.id)) &&
        metadataMatches(element.metadata, filter.metadata)
      ) {
        results.push(cloneElement(element));
      }
    }

    return results;
  }

  queryCollections(filter: CollectionFilter = {}): readonly Collection[] {
    let matchingIds: Set<string> | undefined;

    const applyIndex = (
      value: string | undefined,
      index: ClassificationIndex,
    ) => {
      if (value === undefined) {
        return true;
      }

      const indexedIds = index.get(value);

      if (!indexedIds) {
        return false;
      }

      matchingIds = matchingIds
        ? new Set([...matchingIds].filter((id) => indexedIds.has(id)))
        : new Set(indexedIds);

      return matchingIds.size > 0;
    };

    if (
      !applyIndex(filter.category, this.collectionCategoryIndex) ||
      !applyIndex(filter.style, this.collectionStyleIndex) ||
      !applyIndex(filter.industry, this.collectionIndustryIndex) ||
      !applyIndex(filter.feature, this.collectionFeatureIndex) ||
      !applyIndex(filter.framework, this.collectionFrameworkIndex)
    ) {
      return [];
    }

    const results: Collection[] = [];

    for (const collection of this.collectionsById.values()) {
      if (
        (matchingIds === undefined || matchingIds.has(collection.id)) &&
        metadataMatches(collection.metadata, filter.metadata)
      ) {
        results.push(cloneCollection(collection));
      }
    }

    return results;
  }

  private indexElement(element: CatalogElement) {
    addToIndex(this.categoryIndex, element.category, element.id);
    addToIndex(this.typeIndex, element.type, element.id);

    for (const style of element.styles) {
      addToIndex(this.styleIndex, style, element.id);
    }

    for (const industry of element.industries) {
      addToIndex(this.industryIndex, industry, element.id);
    }

    for (const feature of element.features) {
      addToIndex(this.featureIndex, feature, element.id);
    }

    for (const framework of element.frameworks) {
      addToIndex(this.frameworkIndex, framework, element.id);
    }
  }

  private indexCollection(collection: Collection) {
    addToIndex(
      this.collectionCategoryIndex,
      collection.category,
      collection.id,
    );

    for (const style of collection.styles) {
      addToIndex(this.collectionStyleIndex, style, collection.id);
    }

    for (const industry of collection.industries) {
      addToIndex(this.collectionIndustryIndex, industry, collection.id);
    }

    for (const feature of collection.features) {
      addToIndex(this.collectionFeatureIndex, feature, collection.id);
    }

    for (const framework of collection.frameworks) {
      addToIndex(this.collectionFrameworkIndex, framework, collection.id);
    }
  }
}
