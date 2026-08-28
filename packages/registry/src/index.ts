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

export class DuplicateElementError extends Error {
  constructor(readonly id: string) {
    super(`An element with ID "${id}" is already registered`);
    this.name = "DuplicateElementError";
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

  get size(): number {
    return this.elementsById.size;
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

  getById(id: string): CatalogElement | undefined {
    const element = this.elementsById.get(id);

    return element ? cloneElement(element) : undefined;
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
}
