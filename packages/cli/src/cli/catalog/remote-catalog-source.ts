import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";
import type {
  CollectionCatalogSource,
  InstallableCatalogRecord,
  InstallableCatalogSource,
  InstallableCollectionRecord,
} from "./catalog-source.js";
import {
  normalizeTimeout,
  resolveRegistryUrl,
  type RemoteCatalogSourceOptions,
} from "./remote-catalog-endpoint.js";
import { getDefaultFetch } from "./remote-catalog-transport.js";
import {
  RemoteCatalogCollectionDetailError,
  RemoteCatalogDetailError,
} from "./remote-catalog-errors.js";
import {
  loadCollectionDetail,
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
  RemoteCatalogCollectionDetailError,
  RemoteCatalogDetailError,
  RemoteCatalogError,
  RemoteCatalogHttpError,
  RemoteCatalogPayloadError,
  RemoteCatalogRequestError,
} from "./remote-catalog-errors.js";

export function createRemoteCatalogSource(
  options: RemoteCatalogSourceOptions = {},
): InstallableCatalogSource & CollectionCatalogSource {
  const registryUrl = resolveRegistryUrl(options.registryUrl, options.env);
  const fetchImplementation =
    options.fetchImpl ?? options.fetch ?? getDefaultFetch();
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const indexUrl = new URL("registry.json", registryUrl).toString();
  const indexResource = "/registry.json";
  let indexPromise: ReturnType<typeof loadIndex> | undefined;
  const detailPromises = new Map<string, Promise<CatalogElement>>();
  const collectionDetailPromises = new Map<string, Promise<Collection>>();

  async function readIndex(): Promise<Awaited<ReturnType<typeof loadIndex>>> {
    if (indexPromise === undefined) {
      indexPromise = loadIndex({
        fetchImplementation,
        indexResource,
        indexUrl,
        timeoutMs,
      });
    }

    const promise = indexPromise;

    try {
      return await promise;
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

  async function readCollectionDetail(
    id: string,
    indexedCollection: Collection,
  ): Promise<Collection> {
    const existingPromise = collectionDetailPromises.get(id);

    if (existingPromise !== undefined) {
      try {
        return await existingPromise;
      } catch (error) {
        collectionDetailPromises.delete(id);
        throw error;
      }
    }

    const resource = `/collections/${encodeURIComponent(id)}.json`;
    const url = new URL(
      `collections/${encodeURIComponent(id)}.json`,
      registryUrl,
    ).toString();
    const detailPromise = loadCollectionDetail({
      fetchImplementation,
      id,
      indexedCollection,
      resource,
      url,
      timeoutMs,
    });
    collectionDetailPromises.set(id, detailPromise);

    try {
      return await detailPromise;
    } catch (error) {
      collectionDetailPromises.delete(id);
      throw error instanceof RemoteCatalogCollectionDetailError
        ? error
        : error instanceof RemoteCatalogDetailError
          ? new RemoteCatalogCollectionDetailError(
              id,
              resource,
              url,
              error.message,
              error,
            )
          : error;
    }
  }

  function createInstallableCollectionRecord(
    indexedCollection: Collection,
  ): InstallableCollectionRecord {
    return {
      collection: cloneCollection(indexedCollection),
      loadCollection: async () => {
        const detail = await readCollectionDetail(
          indexedCollection.id,
          indexedCollection,
        );
        return cloneCollection(detail);
      },
    };
  }

  return {
    async getById(id) {
      const element = (await readIndex()).blocks.get(id);
      return element === undefined ? undefined : cloneElement(element);
    },

    async list() {
      return [...(await readIndex()).blocks.values()].map(cloneElement);
    },

    async getInstallableById(id) {
      const element = (await readIndex()).blocks.get(id);
      return element === undefined
        ? undefined
        : createInstallableRecord(element);
    },

    async listInstallable() {
      return [...(await readIndex()).blocks.values()].map(
        createInstallableRecord,
      );
    },

    async getCollectionById(id) {
      const collection = (await readIndex()).collections.get(id);
      return collection === undefined ? undefined : cloneCollection(collection);
    },

    async listCollections() {
      return [...(await readIndex()).collections.values()].map(cloneCollection);
    },

    async getInstallableCollectionById(id) {
      const collection = (await readIndex()).collections.get(id);
      return collection === undefined
        ? undefined
        : createInstallableCollectionRecord(collection);
    },

    async listInstallableCollections() {
      return [...(await readIndex()).collections.values()].map(
        createInstallableCollectionRecord,
      );
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
