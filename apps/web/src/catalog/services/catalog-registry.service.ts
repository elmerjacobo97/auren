import { parseCatalogIndex } from "../schemas/catalog-index.js";
import {
  CatalogClientError,
  createTransportError,
} from "../utils/catalog-errors.js";
import { resolveRegistryIndexUrl } from "../utils/catalog-url.js";
import type { CatalogFetch, CatalogIndexRequest } from "../types/catalog.js";
import type { CatalogElement } from "@auren/schemas/catalog";

export interface CatalogRegistryServiceOptions {
  readonly fetchImplementation?: CatalogFetch;
}

export class CatalogRegistryService {
  private readonly fetchImplementation: CatalogFetch;

  constructor({ fetchImplementation }: CatalogRegistryServiceOptions = {}) {
    this.fetchImplementation = fetchImplementation ?? getDefaultFetch();
  }

  async loadIndex({
    registryUrl,
    signal,
  }: CatalogIndexRequest = {}): Promise<ReadonlyArray<CatalogElement>> {
    const indexUrl = resolveRegistryIndexUrl(registryUrl);
    const requestInit: RequestInit = {
      method: "GET",
      headers: { Accept: "application/json" },
    };

    if (signal !== undefined) {
      requestInit.signal = signal;
    }

    let response: Response;

    try {
      response = await this.fetchImplementation(indexUrl, requestInit);
    } catch (error) {
      throw createTransportError(error);
    }

    if (response.status < 200 || response.status >= 300) {
      throw new CatalogClientError(
        "http",
        `The Registry index request failed with HTTP ${response.status}.`,
      );
    }

    if (!isJsonContentType(response.headers.get("content-type"))) {
      throw new CatalogClientError(
        "content-type",
        "The Registry index response was not JSON.",
      );
    }

    let payload: unknown;

    try {
      payload = (await response.json()) as unknown;
    } catch (error) {
      throw new CatalogClientError(
        "malformed-json",
        "The Registry index response was malformed JSON.",
        { cause: error },
      );
    }

    return parseCatalogIndex(payload);
  }
}

export const catalogRegistryService = new CatalogRegistryService();

function getDefaultFetch(): CatalogFetch {
  const fetchImplementation = globalThis.fetch;

  if (fetchImplementation === undefined) {
    throw createTransportError();
  }

  return fetchImplementation.bind(globalThis) as CatalogFetch;
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
