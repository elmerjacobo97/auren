import type { ResolvedBlockFile } from "@auren/core/load/files";
import type { CatalogElement } from "@auren/schemas/catalog";

export interface CatalogSource {
  getById(id: string): Promise<CatalogElement | undefined>;
  list(): Promise<readonly CatalogElement[]>;
}

export type InstallableCatalogRecord = {
  readonly element: CatalogElement;
  readonly loadFiles: () => Promise<readonly ResolvedBlockFile[]>;
};

export interface InstallableCatalogSource extends CatalogSource {
  getInstallableById(id: string): Promise<InstallableCatalogRecord | undefined>;
  listInstallable(): Promise<readonly InstallableCatalogRecord[]>;
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
