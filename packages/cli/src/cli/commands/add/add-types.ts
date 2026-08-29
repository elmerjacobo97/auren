import type { AurenConfiguration } from "@auren/core/configuration";
import type {
  PackageDependency,
  ProjectDependencyResolution,
} from "@auren/core/dependencies";
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

export type ShadcnDependency = {
  readonly name: string;
};

export interface ShadcnRequirementPath {
  readonly name: string;
  readonly path: string;
}

export interface ShadcnRequirementResolution {
  readonly required: readonly string[];
  readonly satisfied: readonly string[];
  readonly missing: readonly string[];
  readonly uiDirectory: string;
  readonly paths: readonly ShadcnRequirementPath[];
}

export interface AddInstallationPlan {
  readonly requestedId: string;
  readonly projectDir: string;
  readonly configuration: AurenConfiguration;
  readonly detection: ProjectDetection;
  readonly blocks: readonly CatalogElement[];
  readonly packages: readonly PackageDependency[];
  readonly shadcn: readonly ShadcnDependency[];
  readonly dependencyResolution: ProjectDependencyResolution;
  readonly shadcnResolution: ShadcnRequirementResolution | null;
  readonly files: readonly AddPlannedFile[];
  readonly warnings: readonly string[];
  readonly force: boolean;
}
