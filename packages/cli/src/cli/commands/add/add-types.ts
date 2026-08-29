import type { AurenConfiguration } from "@auren/core/configuration";
import type { PackageDependency } from "@auren/core/dependencies";
import type { ProjectDetection } from "@auren/core/project";
import type { InstallableCatalogSource } from "../../catalog/catalog-source.js";
import type { CatalogElement } from "@auren/schemas/catalog";

export interface AddInstallationPlanOptions {
  readonly projectDir: string;
  readonly id: string;
  readonly force: boolean;
  readonly source: InstallableCatalogSource;
}

export interface AddPlannedFile {
  readonly blockId: string;
  readonly sourcePath: string;
  readonly kind: CatalogElement["files"][number]["kind"];
  readonly content: string;
  readonly targetPath: string;
  readonly absoluteTargetPath: string;
}

export interface AddInstallationPlan {
  readonly requestedId: string;
  readonly projectDir: string;
  readonly configuration: AurenConfiguration;
  readonly detection: ProjectDetection;
  readonly blocks: readonly CatalogElement[];
  readonly packages: readonly PackageDependency[];
  readonly files: readonly AddPlannedFile[];
  readonly warnings: readonly string[];
  readonly force: boolean;
}
