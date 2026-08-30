import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";
import { createInvalidDetailError } from "../utils/catalog-errors.js";

const catalogFields = [
  "id",
  "name",
  "description",
  "category",
  "type",
  "styles",
  "industries",
  "features",
  "frameworks",
  "dependencies",
  "metadata",
] as const satisfies readonly (keyof CatalogElement)[];

export interface CatalogDetailValidationOptions {
  readonly id: string;
  readonly indexedElement: CatalogElement;
}

export function parseCatalogDetail(
  value: unknown,
  { id, indexedElement }: CatalogDetailValidationOptions,
): CatalogElement {
  const parsed = catalogElementSchema.safeParse(value);

  if (!parsed.success) {
    throw createInvalidDetailError(
      "The Registry detail payload failed catalog validation.",
      parsed.error,
    );
  }

  const detail = parsed.data;

  if (indexedElement.id !== id || detail.id !== id) {
    throw createInvalidDetailError(
      "The Registry detail identity did not match the requested catalog entry.",
    );
  }

  for (const field of catalogFields) {
    if (!sameJsonValue(indexedElement[field], detail[field])) {
      throw createInvalidDetailError(
        `The Registry detail ${field} differed from the published index.`,
      );
    }
  }

  if (
    !sameJsonValue(
      indexedElement.files.map(toFileInventory),
      detail.files.map(toFileInventory),
    )
  ) {
    throw createInvalidDetailError(
      "The Registry detail file inventory differed from the published index.",
    );
  }

  for (const file of detail.files) {
    if (Object.hasOwn(file, "target")) {
      throw createInvalidDetailError(
        "The Registry detail contains an installation target.",
      );
    }

    if (!Object.hasOwn(file, "content") || typeof file.content !== "string") {
      throw createInvalidDetailError(
        "The Registry detail is missing inline file content.",
      );
    }

    if (file.kind === "asset" && !isCanonicalBase64(file.content)) {
      throw createInvalidDetailError(
        "The Registry detail contains non-canonical asset content.",
      );
    }
  }

  return detail;
}

export function isCanonicalBase64(value: string): boolean {
  if (
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    return false;
  }

  try {
    return btoa(atob(value)) === value;
  } catch {
    return false;
  }
}

function toFileInventory(file: CatalogElement["files"][number]) {
  return { path: file.path, kind: file.kind };
}

type JsonComparable =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly JsonComparable[]
  | { readonly [key: string]: JsonComparable };

function sameJsonValue(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right))
  );
}

function sortJsonValue(value: unknown): JsonComparable {
  if (value === null || value === undefined) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, sortJsonValue(value[key as keyof typeof value])]),
    );
  }

  return undefined;
}
