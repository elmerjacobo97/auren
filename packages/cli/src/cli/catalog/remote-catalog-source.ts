import type { ResolvedBlockFile } from "@auren/core/load/files";
import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "./catalog-source.js";

export const DEFAULT_REGISTRY_URL = "https://registry.auren.dev";
export const DEFAULT_REMOTE_CATALOG_TIMEOUT_MS = 10_000;
export const MAX_REMOTE_CATALOG_TIMEOUT_MS = 60_000;
export const MAX_REMOTE_CATALOG_RESPONSE_BYTES = 10 * 1024 * 1024;

export type RegistryUrlInput = string | URL;

export interface RemoteCatalogResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: {
    get(name: string): string | null;
  };
  text(): Promise<string>;
}

export type RemoteFetch = (
  input: string | URL,
  init?: {
    readonly method?: string;
    readonly signal?: AbortSignal;
  },
) => Promise<RemoteCatalogResponse>;

export interface RemoteCatalogSourceOptions {
  readonly registryUrl?: RegistryUrlInput;
  readonly fetch?: RemoteFetch;
  readonly fetchImpl?: RemoteFetch;
  readonly timeoutMs?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export class RemoteCatalogError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RemoteCatalogError";
  }
}

export class InvalidRegistryUrlError extends RemoteCatalogError {
  constructor(readonly value: unknown) {
    super(
      `Invalid Registry URL "${String(value)}": expected an http(s) document root without credentials, query, or fragment`,
    );
    this.name = "InvalidRegistryUrlError";
  }
}

export class RemoteCatalogRequestError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Unable to reach remote Registry resource "${resource}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogRequestError";
  }
}

export class RemoteCatalogHttpError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    const statusLabel = statusText.trim()
      ? `${status} ${statusText.trim()}`
      : String(status);
    super(
      `Remote Registry request failed for "${resource}" at "${url}": HTTP ${statusLabel}`,
    );
    this.name = "RemoteCatalogHttpError";
  }
}

export class RemoteCatalogContentTypeError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    readonly contentType: string | null,
  ) {
    super(
      `Remote Registry resource "${resource}" at "${url}" did not return JSON${contentType === null ? "" : ` (content type: ${contentType})`}`,
    );
    this.name = "RemoteCatalogContentTypeError";
  }
}

export class RemoteCatalogPayloadError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Invalid remote Registry resource "${resource}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogPayloadError";
  }
}

export class RemoteCatalogDetailError extends RemoteCatalogError {
  constructor(
    readonly id: string,
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Invalid remote Registry detail for "${id}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogDetailError";
  }
}

export function resolveRegistryUrl(
  registryUrl?: RegistryUrlInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return normalizeRegistryUrl(
    registryUrl ?? env.AUREN_REGISTRY_URL ?? DEFAULT_REGISTRY_URL,
  );
}

export function normalizeRegistryUrl(value: RegistryUrlInput): string {
  const input = typeof value === "string" ? value : value.toString();

  if (input.length === 0 || input.trim() !== input) {
    throw new InvalidRegistryUrlError(value);
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new InvalidRegistryUrlError(value);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new InvalidRegistryUrlError(value);
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = `${pathname}/`;

  return parsed.toString();
}

export function createRemoteCatalogSource(
  options: RemoteCatalogSourceOptions = {},
): InstallableCatalogSource {
  const registryUrl = resolveRegistryUrl(options.registryUrl, options.env);
  const fetchImplementation =
    options.fetchImpl ?? options.fetch ?? getDefaultFetch();
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const indexUrl = new URL("registry.json", registryUrl).toString();
  const indexResource = "/registry.json";
  let indexPromise: Promise<ReadonlyMap<string, CatalogElement>> | undefined;
  const detailPromises = new Map<string, Promise<CatalogElement>>();

  async function readIndex(): Promise<ReadonlyMap<string, CatalogElement>> {
    indexPromise ??= loadIndex({
      fetchImplementation,
      indexResource,
      indexUrl,
      timeoutMs,
    });

    try {
      return await indexPromise;
    } catch (error) {
      indexPromise = undefined;
      throw error;
    }
  }

  async function readDetail(
    id: string,
    indexedElement: CatalogElement,
  ): Promise<CatalogElement> {
    const existingPromise = detailPromises.get(id);

    if (existingPromise !== undefined) {
      try {
        return await existingPromise;
      } catch (error) {
        detailPromises.delete(id);
        throw error;
      }
    }

    const resource = `/blocks/${encodeURIComponent(id)}.json`;
    const url = new URL(
      `blocks/${encodeURIComponent(id)}.json`,
      registryUrl,
    ).toString();
    const detailPromise = loadDetail({
      fetchImplementation,
      id,
      indexedElement,
      resource,
      url,
      timeoutMs,
    });
    detailPromises.set(id, detailPromise);

    try {
      return await detailPromise;
    } catch (error) {
      detailPromises.delete(id);
      throw error;
    }
  }

  function createInstallableRecord(
    indexedElement: CatalogElement,
  ): InstallableCatalogRecord {
    return {
      element: cloneElement(indexedElement),
      loadFiles: async () => {
        const detail = await readDetail(indexedElement.id, indexedElement);
        return detail.files.map(toResolvedBlockFile);
      },
    };
  }

  return {
    async getById(id) {
      const element = (await readIndex()).get(id);
      return element === undefined ? undefined : cloneElement(element);
    },

    async list() {
      return [...(await readIndex()).values()].map(cloneElement);
    },

    async getInstallableById(id) {
      const element = (await readIndex()).get(id);
      return element === undefined
        ? undefined
        : createInstallableRecord(element);
    },

    async listInstallable() {
      return [...(await readIndex()).values()].map(createInstallableRecord);
    },
  };
}

interface LoadIndexOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly indexResource: string;
  readonly indexUrl: string;
  readonly timeoutMs: number;
}

async function loadIndex({
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

interface LoadDetailOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly id: string;
  readonly indexedElement: CatalogElement;
  readonly resource: string;
  readonly url: string;
  readonly timeoutMs: number;
}

async function loadDetail({
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

interface RequestJsonOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly resource: string;
  readonly url: string;
  readonly timeoutMs: number;
}

async function requestJson({
  fetchImplementation,
  resource,
  url,
  timeoutMs,
}: RequestJsonOptions): Promise<unknown> {
  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const request = (async () => {
    const response = await fetchImplementation(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new RemoteCatalogHttpError(
        resource,
        url,
        response.status,
        response.statusText,
      );
    }

    const contentType = response.headers.get("content-type");

    if (!isJsonContentType(contentType)) {
      throw new RemoteCatalogContentTypeError(resource, url, contentType);
    }

    const contentLength = response.headers.get("content-length");

    if (contentLength !== null && isOversizedContentLength(contentLength)) {
      throw new RemoteCatalogPayloadError(
        resource,
        url,
        `response exceeds the ${MAX_REMOTE_CATALOG_RESPONSE_BYTES} byte limit`,
      );
    }

    let body: string;

    try {
      body = await response.text();
    } catch (error) {
      throw new RemoteCatalogRequestError(
        resource,
        url,
        `response body could not be read: ${messageOf(error)}`,
        error,
      );
    }

    if (Buffer.byteLength(body, "utf8") > MAX_REMOTE_CATALOG_RESPONSE_BYTES) {
      throw new RemoteCatalogPayloadError(
        resource,
        url,
        `response exceeds the ${MAX_REMOTE_CATALOG_RESPONSE_BYTES} byte limit`,
      );
    }

    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new RemoteCatalogPayloadError(
        resource,
        url,
        "response is malformed JSON",
      );
    }
  })();

  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("remote Registry request timed out"));
    }, timeoutMs);
    timeoutHandle.unref?.();
  });

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (error instanceof RemoteCatalogError) {
      throw error;
    }

    if (timedOut || isAbortError(error)) {
      throw new RemoteCatalogRequestError(
        resource,
        url,
        `request timed out after ${timeoutMs}ms`,
        error,
      );
    }

    throw new RemoteCatalogRequestError(resource, url, messageOf(error), error);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
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

function toResolvedBlockFile(
  file: CatalogElement["files"][number],
): ResolvedBlockFile {
  return {
    path: file.path,
    kind: file.kind,
    target: file.target,
    content: file.content as string,
  };
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

function cloneElement(element: CatalogElement): CatalogElement {
  return {
    ...element,
    styles: [...element.styles],
    industries: [...element.industries],
    features: [...element.features],
    frameworks: [...element.frameworks],
    dependencies: element.dependencies.map((dependency) => ({ ...dependency })),
    files: element.files.map((file) => ({ ...file })),
    metadata: cloneJsonValue(element.metadata),
  };
}

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

function isJsonContentType(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" || mediaType?.endsWith("+json") === true
  );
}

function isOversizedContentLength(value: string): boolean {
  const length = Number(value);
  return Number.isFinite(length) && length > MAX_REMOTE_CATALOG_RESPONSE_BYTES;
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

function normalizeTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REMOTE_CATALOG_TIMEOUT_MS;
  }

  return Math.min(
    Math.max(Math.floor(value), 1),
    MAX_REMOTE_CATALOG_TIMEOUT_MS,
  );
}

function getDefaultFetch(): RemoteFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new RemoteCatalogError(
      "Built-in fetch is unavailable in this Node runtime",
    );
  }

  return globalThis.fetch.bind(globalThis) as RemoteFetch;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split(/\r?\n/, 1)[0]?.trim() || "request failed";
  }

  return String(error).split(/\r?\n/, 1)[0]?.trim() || "request failed";
}
