import type { CatalogElement } from "@auren/schemas/catalog";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "./catalog-source.js";
import {
  normalizeTimeout,
  resolveRegistryUrl,
  type RemoteCatalogSourceOptions,
} from "./remote-catalog-endpoint.js";
import { getDefaultFetch } from "./remote-catalog-transport.js";
import {
  loadDetail,
  loadIndex,
  toResolvedBlockFile,
} from "./remote-catalog-validation.js";

export {
  DEFAULT_REGISTRY_URL,
  DEFAULT_REMOTE_CATALOG_TIMEOUT_MS,
  MAX_REMOTE_CATALOG_TIMEOUT_MS,
  normalizeRegistryUrl,
  resolveRegistryUrl,
} from "./remote-catalog-endpoint.js";
export type {
  RegistryUrlInput,
  RemoteCatalogSourceOptions,
} from "./remote-catalog-endpoint.js";
export { MAX_REMOTE_CATALOG_RESPONSE_BYTES } from "./remote-catalog-transport.js";
export type {
  RemoteCatalogResponse,
  RemoteFetch,
} from "./remote-catalog-transport.js";
export {
  InvalidRegistryUrlError,
  RemoteCatalogContentTypeError,
  RemoteCatalogDetailError,
  RemoteCatalogError,
  RemoteCatalogHttpError,
  RemoteCatalogPayloadError,
  RemoteCatalogRequestError,
} from "./remote-catalog-errors.js";

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
