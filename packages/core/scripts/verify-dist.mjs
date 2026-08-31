import { searchBlocks } from "@auren/core/search";
import {
  CircularDependencyError,
  MissingAurenDependencyError,
  MissingCollectionBlockError,
  UnknownBlockError,
  UnknownCollectionError,
  resolveBlock,
  resolveCollection,
} from "@auren/core/resolve";
import {
  ConflictingPackageVersionsError,
  InvalidPackageRequirementError,
  InvalidShadcnRequirementError,
  collectPackageDependencies,
  collectShadcnDependencies,
  createCollectionDependencyPlan,
  createDependencyPlan,
  resolveProjectCollectionDependencies,
  resolveProjectDependencies,
} from "@auren/core/dependencies";
import {
  BlockMetadataError,
  loadBlockMetadata,
} from "@auren/core/load/metadata";
import { MissingBlockFileError, loadBlockFiles } from "@auren/core/load/files";
import { validateCompatibility } from "@auren/core/compatibility";
import { ProjectDetectionError, detectProject } from "@auren/core/project";
import {
  AurenConfigurationError,
  readAurenConfig,
  writeAurenConfig,
} from "@auren/core/configuration";

const errorClasses = [
  [UnknownBlockError, "UnknownBlockError"],
  [MissingAurenDependencyError, "MissingAurenDependencyError"],
  [CircularDependencyError, "CircularDependencyError"],
  [UnknownCollectionError, "UnknownCollectionError"],
  [MissingCollectionBlockError, "MissingCollectionBlockError"],
  [ConflictingPackageVersionsError, "ConflictingPackageVersionsError"],
  [InvalidPackageRequirementError, "InvalidPackageRequirementError"],
  [InvalidShadcnRequirementError, "InvalidShadcnRequirementError"],
  [BlockMetadataError, "BlockMetadataError"],
  [MissingBlockFileError, "MissingBlockFileError"],
  [ProjectDetectionError, "ProjectDetectionError"],
  [AurenConfigurationError, "AurenConfigurationError"],
];

if (
  typeof searchBlocks !== "function" ||
  typeof resolveBlock !== "function" ||
  typeof resolveCollection !== "function" ||
  typeof collectPackageDependencies !== "function" ||
  typeof collectShadcnDependencies !== "function" ||
  typeof createDependencyPlan !== "function" ||
  typeof createCollectionDependencyPlan !== "function" ||
  typeof resolveProjectDependencies !== "function" ||
  typeof resolveProjectCollectionDependencies !== "function" ||
  typeof loadBlockMetadata !== "function" ||
  typeof loadBlockFiles !== "function" ||
  typeof validateCompatibility !== "function" ||
  typeof detectProject !== "function" ||
  typeof readAurenConfig !== "function" ||
  typeof writeAurenConfig !== "function" ||
  errorClasses.some(
    ([errorClass, expectedName]) => errorClass.name !== expectedName,
  )
) {
  throw new Error(
    "Core package entrypoint did not expose the built public API",
  );
}

try {
  await import("@auren/core");
  throw new Error("Core package must not expose a root barrel entrypoint");
} catch (error) {
  if (
    !(error instanceof Error) ||
    !Object.hasOwn(error, "code") ||
    error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED"
  ) {
    throw error;
  }
}
