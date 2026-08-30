import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";
import {
  CatalogClientError,
  createInvalidIndexError,
} from "@/catalog/utils/catalog-errors";

export function parseCatalogIndex(
  value: unknown,
): ReadonlyArray<CatalogElement> {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.schemaVersion) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.blocks)
  ) {
    throw createInvalidIndexError();
  }

  const elements: CatalogElement[] = [];
  const ids = new Set<string>();

  for (const [position, candidate] of value.blocks.entries()) {
    const parsed = catalogElementSchema.safeParse(candidate);

    if (!parsed.success) {
      throw new CatalogClientError(
        "invalid-index",
        `The Registry index contains invalid block metadata at entry ${position}.`,
        { cause: parsed.error },
      );
    }

    const element = parsed.data;

    if (ids.has(element.id)) {
      throw new CatalogClientError(
        "invalid-index",
        `The Registry index contains duplicate block ID "${element.id}".`,
      );
    }

    assertMetadataOnlyFiles(element);
    ids.add(element.id);
    elements.push(element);
  }

  return elements.sort(compareElements);
}

function assertMetadataOnlyFiles(element: CatalogElement): void {
  for (const file of element.files) {
    if (Object.hasOwn(file, "content")) {
      throw new CatalogClientError(
        "invalid-index",
        `The Registry index contains file content for "${element.id}".`,
      );
    }

    if (Object.hasOwn(file, "target")) {
      throw new CatalogClientError(
        "invalid-index",
        `The Registry index contains an installation target for "${element.id}".`,
      );
    }
  }
}

function compareElements(left: CatalogElement, right: CatalogElement): number {
  if (left.id < right.id) {
    return -1;
  }

  if (left.id > right.id) {
    return 1;
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
