import type { ResolvedBlockFile } from "@auren/core/load/files";
import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";
import {
  RemoteCatalogDetailError,
  RemoteCatalogError,
  RemoteCatalogPayloadError,
  messageOf,
} from "./remote-catalog-errors.js";
import { requestJson, type RemoteFetch } from "./remote-catalog-transport.js";

export interface LoadIndexOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly indexResource: string;
  readonly indexUrl: string;
  readonly timeoutMs: number;
}

export async function loadIndex({
  fetchImplementation,
  indexResource,
  indexUrl,
  timeoutMs,
}: LoadIndexOptions): Promise<ReadonlyMap<string, CatalogElement>> {
  const payload = await requestJson({
    fetchImplementation,
    resource: indexResource,
    url: indexUrl,
    timeoutMs,
  });

  if (
    !isRecord(payload) ||
    payload.schemaVersion !== 1 ||
    !Array.isArray(payload.blocks)
  ) {
    throw new RemoteCatalogPayloadError(
      indexResource,
      indexUrl,
      "expected an envelope with integer schemaVersion 1 and a blocks array",
    );
  }

  const elements: CatalogElement[] = [];
  const ids = new Set<string>();

  for (const [position, candidate] of payload.blocks.entries()) {
    const element = parseCatalogElement(
      candidate,
      indexResource,
      indexUrl,
      position,
    );

    if (ids.has(element.id)) {
      throw new RemoteCatalogPayloadError(
        indexResource,
        indexUrl,
        `contains duplicate catalog element ID "${element.id}"`,
      );
    }

    assertMetadataOnlyIndexElement(element, indexResource, indexUrl);
    ids.add(element.id);
    elements.push(element);
  }

  elements.sort(compareElements);
  return new Map(elements.map((element) => [element.id, element]));
}

export interface LoadDetailOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly id: string;
  readonly indexedElement: CatalogElement;
  readonly resource: string;
  readonly url: string;
  readonly timeoutMs: number;
}

export async function loadDetail({
  fetchImplementation,
  id,
  indexedElement,
  resource,
  url,
  timeoutMs,
}: LoadDetailOptions): Promise<CatalogElement> {
  let payload: unknown;

  try {
    payload = await requestJson({
      fetchImplementation,
      resource,
      url,
      timeoutMs,
    });
  } catch (error) {
    if (error instanceof RemoteCatalogError) {
      throw error;
    }

    throw new RemoteCatalogDetailError(
      id,
      resource,
      url,
      messageOf(error),
      error,
    );
  }

  let detail: CatalogElement;

  try {
    detail = parseCatalogElement(payload, resource, url);
  } catch (error) {
    throw new RemoteCatalogDetailError(
      id,
      resource,
      url,
      messageOf(error),
      error,
    );
  }

  if (detail.id !== id) {
    throw new RemoteCatalogDetailError(
      id,
      resource,
      url,
      `ID is "${detail.id}" but "${id}" was requested`,
    );
  }

  assertDetailFiles(detail, id, resource, url);

  for (const field of catalogFields) {
    if (field === "files") {
      continue;
    }

    if (!jsonValuesEqual(indexedElement[field], detail[field])) {
      throw new RemoteCatalogDetailError(
        id,
        resource,
        url,
        `field "${field}" differs from the validated index entry`,
      );
    }
  }

  const indexedFiles = indexedElement.files.map(toFileInventoryEntry);
  const detailFiles = detail.files.map(toFileInventoryEntry);

  if (!jsonValuesEqual(indexedFiles, detailFiles)) {
    throw new RemoteCatalogDetailError(
      id,
      resource,
      url,
      "file inventory differs from the validated index entry",
    );
  }

  return detail;
}

export function toResolvedBlockFile(
  file: CatalogElement["files"][number],
): ResolvedBlockFile {
  return {
    path: file.path,
    kind: file.kind,
    target: file.target,
    content: file.content as string,
  };
}

function parseCatalogElement(
  value: unknown,
  resource: string,
  url: string,
  position?: number,
): CatalogElement {
  const result = catalogElementSchema.safeParse(value);

  if (result.success) {
    return result.data;
  }

  const location = position === undefined ? "" : ` at index ${position}`;
  throw new RemoteCatalogPayloadError(
    resource,
    url,
    `catalog element${location} failed @auren/schemas/catalog validation: ${formatSchemaIssues(result.error.issues)}`,
  );
}

function assertMetadataOnlyIndexElement(
  element: CatalogElement,
  resource: string,
  url: string,
): void {
  for (const file of element.files) {
    if (Object.hasOwn(file, "content")) {
      throw new RemoteCatalogPayloadError(
        resource,
        url,
        `index entry "${element.id}" contains forbidden file content for "${file.path}"`,
      );
    }

    if (Object.hasOwn(file, "target")) {
      throw new RemoteCatalogPayloadError(
        resource,
        url,
        `index entry "${element.id}" contains forbidden file target for "${file.path}"`,
      );
    }
  }
}

function assertDetailFiles(
  detail: CatalogElement,
  id: string,
  resource: string,
  url: string,
): void {
  for (const file of detail.files) {
    if (Object.hasOwn(file, "target")) {
      throw new RemoteCatalogDetailError(
        id,
        resource,
        url,
        `file "${file.path}" contains a forbidden installation target`,
      );
    }

    if (typeof file.content !== "string") {
      throw new RemoteCatalogDetailError(
        id,
        resource,
        url,
        `file "${file.path}" is missing inline content`,
      );
    }

    if (file.kind === "asset" && !isCanonicalBase64(file.content)) {
      throw new RemoteCatalogDetailError(
        id,
        resource,
        url,
        `asset file "${file.path}" does not contain canonical base64 content`,
      );
    }
  }
}

function toFileInventoryEntry(file: CatalogElement["files"][number]) {
  return { path: file.path, kind: file.kind };
}

const catalogFields: readonly (keyof CatalogElement)[] = [
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
];

function compareElements(left: CatalogElement, right: CatalogElement): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalBase64(value: string): boolean {
  return (
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    ) && Buffer.from(value, "base64").toString("base64") === value
  );
}

function formatSchemaIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string {
  const formatted = issues.slice(0, 3).map((issue) => {
    const path = issue.path.reduce<string>((result, segment) => {
      if (typeof segment === "number") {
        return `${result}[${segment}]`;
      }

      const label = String(segment);
      return result.length === 0 ? label : `${result}.${label}`;
    }, "");
    return `${path || "<root>"}: ${issue.message}`;
  });

  if (issues.length > formatted.length) {
    formatted.push(`and ${issues.length - formatted.length} more issue(s)`);
  }

  return formatted.join("; ");
}
