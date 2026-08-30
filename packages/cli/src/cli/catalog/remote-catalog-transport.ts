import {
  RemoteCatalogContentTypeError,
  RemoteCatalogError,
  RemoteCatalogHttpError,
  RemoteCatalogPayloadError,
  RemoteCatalogRequestError,
  messageOf,
} from "./remote-catalog-errors.js";

export const MAX_REMOTE_CATALOG_RESPONSE_BYTES = 10 * 1024 * 1024;

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

export interface RequestJsonOptions {
  readonly fetchImplementation: RemoteFetch;
  readonly resource: string;
  readonly url: string;
  readonly timeoutMs: number;
}

export async function requestJson({
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

export function getDefaultFetch(): RemoteFetch {
  if (typeof globalThis.fetch !== "function") {
    throw new RemoteCatalogError(
      "Built-in fetch is unavailable in this Node runtime",
    );
  }

  return globalThis.fetch.bind(globalThis) as RemoteFetch;
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
