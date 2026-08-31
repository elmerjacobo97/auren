import { readFile, readdir, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlockFiles, MissingBlockFileError } from "@auren/core/load/files";
import { loadBlockMetadata } from "@auren/core/load/metadata";
import type { CatalogElement } from "@auren/schemas/catalog";
import { collectionSchema, type Collection } from "@auren/schemas/collection";
import { categoryValues } from "@auren/schemas/taxonomy";
import {
  CatalogMetadataError,
  CatalogUnavailableError,
  CollectionMetadataError,
  DuplicateCatalogIdError,
  DuplicateCollectionIdError,
  IncompatibleCollectionMemberError,
  MissingCollectionMemberError,
  type CollectionCatalogSource,
  type InstallableCatalogRecord,
  type InstallableCatalogSource,
  type InstallableCollectionRecord,
} from "./catalog-source.js";

export interface LocalCatalogSourceOptions {
  readonly catalogRoot?: string;
  readonly collectionsRoot?: string;
}

export function createLocalCatalogSource(
  options: LocalCatalogSourceOptions = {},
): InstallableCatalogSource & CollectionCatalogSource {
  let catalogPromise:
    | Promise<ReadonlyMap<string, InstallableCatalogRecord>>
    | undefined;
  let collectionsPromise:
    | Promise<ReadonlyMap<string, InstallableCollectionRecord>>
    | undefined;

  async function readCatalog(): Promise<
    ReadonlyMap<string, InstallableCatalogRecord>
  > {
    catalogPromise ??= loadCatalog(options.catalogRoot);

    try {
      return await catalogPromise;
    } catch (error) {
      catalogPromise = undefined;
      throw error;
    }
  }

  async function readCollections(): Promise<
    ReadonlyMap<string, InstallableCollectionRecord>
  > {
    if (collectionsPromise === undefined) {
      const blockRecords = await readCatalog();
      collectionsPromise = loadCollections(
        options.collectionsRoot,
        options.catalogRoot,
        blockRecords,
      );
    }

    const promise = collectionsPromise;

    if (promise === undefined) {
      throw new Error("Collection catalog loading was not initialized");
    }

    try {
      return await promise;
    } catch (error) {
      collectionsPromise = undefined;
      throw error;
    }
  }

  return {
    async getById(id) {
      return (await readCatalog()).get(id)?.element;
    },

    async list() {
      return [...(await readCatalog()).values()].map(({ element }) => element);
    },

    async getInstallableById(id) {
      return (await readCatalog()).get(id);
    },

    async listInstallable() {
      return [...(await readCatalog()).values()];
    },

    async getCollectionById(id) {
      const record = (await readCollections()).get(id);
      return record === undefined
        ? undefined
        : cloneCollection(record.collection);
    },

    async listCollections() {
      return [...(await readCollections()).values()]
        .map(({ collection }) => cloneCollection(collection))
        .sort((left, right) => left.id.localeCompare(right.id));
    },

    async getInstallableCollectionById(id) {
      const record = (await readCollections()).get(id);
      return record === undefined ? undefined : cloneCollectionRecord(record);
    },

    async listInstallableCollections() {
      return [...(await readCollections()).values()]
        .map(cloneCollectionRecord)
        .sort((left, right) =>
          left.collection.id.localeCompare(right.collection.id),
        );
    },
  };
}

async function loadCatalog(
  configuredRoot: string | undefined,
): Promise<ReadonlyMap<string, InstallableCatalogRecord>> {
  const catalogRoot =
    configuredRoot ?? (await discoverCatalogRoot(path.dirname(modulePath)));

  if (catalogRoot === null) {
    throw new CatalogUnavailableError(
      path.join(path.dirname(modulePath), "blocks"),
    );
  }

  await listDirectories(catalogRoot, false);

  const records = new Map<string, InstallableCatalogRecord>();
  const blockDirectoriesById = new Map<string, string>();
  const elementDirectories = await discoverElementDirectories(catalogRoot);

  for (const blockDir of elementDirectories) {
    let element: CatalogElement;

    try {
      element = await loadBlockMetadata(blockDir);
    } catch (error) {
      throw new CatalogMetadataError(blockDir, error);
    }

    const previousDir = blockDirectoriesById.get(element.id);

    if (previousDir !== undefined) {
      throw new DuplicateCatalogIdError(element.id, previousDir, blockDir);
    }

    records.set(element.id, {
      element,
      loadFiles: async () => {
        try {
          return await loadBlockFiles(blockDir, element);
        } catch (error) {
          if (error instanceof MissingBlockFileError) {
            throw new MissingBlockFileError(
              path.join(blockDir, error.missingPath),
            );
          }

          throw error;
        }
      },
    });
    blockDirectoriesById.set(element.id, blockDir);
  }

  return records;
}

async function loadCollections(
  configuredRoot: string | undefined,
  configuredCatalogRoot: string | undefined,
  blockRecords: ReadonlyMap<string, InstallableCatalogRecord>,
): Promise<ReadonlyMap<string, InstallableCollectionRecord>> {
  const catalogRoot =
    configuredCatalogRoot ??
    (await discoverCatalogRoot(path.dirname(modulePath)));

  if (catalogRoot === null) {
    throw new CatalogUnavailableError(
      path.join(path.dirname(modulePath), "blocks"),
    );
  }

  const collectionsRoot = path.resolve(
    configuredRoot ?? path.join(path.dirname(catalogRoot), "collections"),
  );
  let rootEntries: Dirent[];

  try {
    rootEntries = await readdir(collectionsRoot, { withFileTypes: true });
  } catch (error) {
    if (isMissingPathError(error) && configuredRoot === undefined) {
      return new Map();
    }

    throw new CatalogUnavailableError(collectionsRoot, error);
  }

  const categorySet = new Set<string>(categoryValues);

  for (const entry of rootEntries) {
    if (
      (entry.name === "README.md" || entry.name === ".gitkeep") &&
      entry.isFile()
    ) {
      continue;
    }

    if (!categorySet.has(entry.name) || !entry.isDirectory()) {
      throw new CollectionMetadataError(
        path.join(collectionsRoot, entry.name),
        new Error("unexpected Collection source root entry"),
      );
    }
  }

  const records = new Map<string, InstallableCollectionRecord>();
  const directoriesById = new Map<string, string>();

  for (const category of categoryValues) {
    const categoryRoot = path.join(collectionsRoot, category);
    let entries: Dirent[];

    try {
      entries = await readdir(categoryRoot, { withFileTypes: true });
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw new CatalogUnavailableError(categoryRoot, error);
    }

    for (const entry of entries) {
      if (entry.name === ".gitkeep" && entry.isFile()) {
        continue;
      }

      const collectionDir = path.join(categoryRoot, entry.name);

      if (!entry.isDirectory()) {
        throw new CollectionMetadataError(
          collectionDir,
          new Error("Collection category contains a non-directory entry"),
        );
      }

      const registryPath = path.join(collectionDir, "registry.json");
      let collectionEntries: Dirent[];

      try {
        collectionEntries = await readdir(collectionDir, {
          withFileTypes: true,
        });
      } catch (error) {
        throw new CollectionMetadataError(collectionDir, error);
      }

      if (
        collectionEntries.length !== 1 ||
        collectionEntries[0]?.name !== "registry.json" ||
        !collectionEntries[0].isFile()
      ) {
        throw new CollectionMetadataError(
          collectionDir,
          new Error("Collection directory must contain only registry.json"),
        );
      }

      let parsed: Collection;

      try {
        const payload = JSON.parse(await readFile(registryPath, "utf8"));
        parsed = collectionSchema.parse(payload);
      } catch (error) {
        throw new CollectionMetadataError(collectionDir, error);
      }

      if (parsed.category !== category || parsed.id !== entry.name) {
        throw new CollectionMetadataError(
          collectionDir,
          new Error(
            `Collection path must match category ${JSON.stringify(category)} and id ${JSON.stringify(entry.name)}`,
          ),
        );
      }

      const previousDir = directoriesById.get(parsed.id);

      if (previousDir !== undefined) {
        throw new DuplicateCollectionIdError(
          parsed.id,
          previousDir,
          collectionDir,
        );
      }

      for (const blockId of parsed.blocks) {
        const block = blockRecords.get(blockId);

        if (block === undefined) {
          throw new MissingCollectionMemberError(parsed.id, blockId);
        }

        for (const framework of parsed.frameworks) {
          if (!block.element.frameworks.includes(framework)) {
            throw new IncompatibleCollectionMemberError(
              parsed.id,
              blockId,
              framework,
            );
          }
        }
      }

      const collection = cloneCollection(parsed);
      records.set(parsed.id, {
        collection,
        loadCollection: async () => cloneCollection(collection),
      });
      directoriesById.set(parsed.id, collectionDir);
    }
  }

  return records;
}

function cloneCollectionRecord(
  record: InstallableCollectionRecord,
): InstallableCollectionRecord {
  const collection = cloneCollection(record.collection);

  return {
    collection,
    loadCollection: async () => cloneCollection(collection),
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

const modulePath = fileURLToPath(import.meta.url);

async function discoverCatalogRoot(
  startDirectory: string,
): Promise<string | null> {
  let currentDirectory = startDirectory;

  while (true) {
    const candidate = path.join(currentDirectory, "blocks");

    try {
      if ((await stat(candidate)).isDirectory()) {
        return candidate;
      }
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw new CatalogUnavailableError(candidate, error);
      }
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

async function discoverElementDirectories(
  catalogRoot: string,
): Promise<string[]> {
  const blockDirectories: string[] = [];

  for (const category of categoryValues) {
    const categoryDirectory = path.join(catalogRoot, category);
    const typeDirectories = await listDirectories(categoryDirectory, true);

    for (const typeDirectory of typeDirectories) {
      const elementDirectories = await listDirectories(
        path.join(categoryDirectory, typeDirectory),
        false,
      );

      for (const elementDirectory of elementDirectories) {
        blockDirectories.push(
          path.join(categoryDirectory, typeDirectory, elementDirectory),
        );
      }
    }
  }

  return blockDirectories;
}

async function listDirectories(
  directory: string,
  optional: boolean,
): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (optional && isMissingPathError(error)) {
      return [];
    }

    throw new CatalogUnavailableError(directory, error);
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
