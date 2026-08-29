import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadBlockMetadata } from "@auren/core/load/metadata";
import type { CatalogElement } from "@auren/schemas/catalog";
import { categoryValues } from "@auren/schemas/taxonomy";
import {
  CatalogMetadataError,
  CatalogUnavailableError,
  DuplicateCatalogIdError,
  type InstallableCatalogRecord,
  type InstallableCatalogSource,
} from "./catalog-source.js";

export interface LocalCatalogSourceOptions {
  readonly catalogRoot?: string;
}

export function createLocalCatalogSource(
  options: LocalCatalogSourceOptions = {},
): InstallableCatalogSource {
  let catalogPromise:
    | Promise<ReadonlyMap<string, InstallableCatalogRecord>>
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

    records.set(element.id, { element, blockDir });
    blockDirectoriesById.set(element.id, blockDir);
  }

  return records;
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
