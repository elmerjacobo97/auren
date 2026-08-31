import type { ResolvedBlockFile } from "@auren/core/load/files";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";

export interface CatalogSource {
  getById(id: string): Promise<CatalogElement | undefined>;
  list(): Promise<readonly CatalogElement[]>;
}

export type InstallableCatalogRecord = {
  readonly element: CatalogElement;
  readonly loadFiles: () => Promise<readonly ResolvedBlockFile[]>;
};

export type InstallableCollectionRecord = {
  readonly collection: Collection;
  readonly loadCollection: () => Promise<Collection>;
};

export interface CollectionCatalogSource {
  getCollectionById(id: string): Promise<Collection | undefined>;
  listCollections(): Promise<readonly Collection[]>;
  getInstallableCollectionById(
    id: string,
  ): Promise<InstallableCollectionRecord | undefined>;
  listInstallableCollections(): Promise<readonly InstallableCollectionRecord[]>;
}

export interface InstallableCatalogSource extends CatalogSource {
  getInstallableById(id: string): Promise<InstallableCatalogRecord | undefined>;
  listInstallable(): Promise<readonly InstallableCatalogRecord[]>;
  getCollectionById?: CollectionCatalogSource["getCollectionById"];
  listCollections?: CollectionCatalogSource["listCollections"];
  getInstallableCollectionById?: CollectionCatalogSource["getInstallableCollectionById"];
  listInstallableCollections?: CollectionCatalogSource["listInstallableCollections"];
}

export class UnknownCatalogElementError extends Error {
  constructor(readonly id: string) {
    super(`Catalog element not found: "${id}"`);
    this.name = "UnknownCatalogElementError";
  }
}

export class CatalogUnavailableError extends Error {
  constructor(
    readonly catalogRoot: string,
    cause?: unknown,
  ) {
    super(
      `Local catalog is unavailable at "${catalogRoot}"${cause === undefined ? "" : `: ${messageOf(cause)}`}`,
      cause === undefined ? undefined : { cause },
    );
    this.name = "CatalogUnavailableError";
  }
}

export class CatalogMetadataError extends Error {
  constructor(
    readonly blockDir: string,
    cause: unknown,
  ) {
    super(`Invalid catalog metadata at "${blockDir}": ${messageOf(cause)}`, {
      cause,
    });
    this.name = "CatalogMetadataError";
  }
}

export class CollectionMetadataError extends Error {
  constructor(
    readonly collectionDir: string,
    cause: unknown,
  ) {
    super(
      `Invalid Collection metadata at "${collectionDir}": ${messageOf(cause)}`,
      { cause },
    );
    this.name = "CollectionMetadataError";
  }
}

export class DuplicateCollectionIdError extends Error {
  constructor(
    readonly id: string,
    readonly firstCollectionDir: string,
    readonly duplicateCollectionDir: string,
  ) {
    super(
      `Duplicate Collection ID "${id}" found in "${firstCollectionDir}" and "${duplicateCollectionDir}"`,
    );
    this.name = "DuplicateCollectionIdError";
  }
}

export class MissingCollectionMemberError extends Error {
  constructor(
    readonly collectionId: string,
    readonly blockId: string,
  ) {
    super(`Collection "${collectionId}" references unknown block "${blockId}"`);
    this.name = "MissingCollectionMemberError";
  }
}

export class IncompatibleCollectionMemberError extends Error {
  constructor(
    readonly collectionId: string,
    readonly blockId: string,
    readonly framework: string,
  ) {
    super(
      `Collection "${collectionId}" requires framework "${framework}" unsupported by member block "${blockId}"`,
    );
    this.name = "IncompatibleCollectionMemberError";
  }
}

export class DuplicateCatalogIdError extends Error {
  constructor(
    readonly id: string,
    readonly firstBlockDir: string,
    readonly duplicateBlockDir: string,
  ) {
    super(
      `Duplicate catalog element ID "${id}" found in "${firstBlockDir}" and "${duplicateBlockDir}"`,
    );
    this.name = "DuplicateCatalogIdError";
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
