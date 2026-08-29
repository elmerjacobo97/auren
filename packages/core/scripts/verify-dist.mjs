import { searchBlocks } from "@auren/core/search";
import {
  CircularDependencyError,
  MissingAurenDependencyError,
  UnknownBlockError,
  resolveBlock,
} from "@auren/core/resolve";
import {
  ConflictingPackageVersionsError,
  collectPackageDependencies,
  createDependencyPlan,
} from "@auren/core/dependencies";
import {
  BlockMetadataError,
  loadBlockMetadata,
} from "@auren/core/load/metadata";
import { MissingBlockFileError, loadBlockFiles } from "@auren/core/load/files";
import { validateCompatibility } from "@auren/core/compatibility";
import { ProjectDetectionError, detectProject } from "@auren/core/project";

const errorClasses = [
  [UnknownBlockError, "UnknownBlockError"],
  [MissingAurenDependencyError, "MissingAurenDependencyError"],
  [CircularDependencyError, "CircularDependencyError"],
  [ConflictingPackageVersionsError, "ConflictingPackageVersionsError"],
  [BlockMetadataError, "BlockMetadataError"],
  [MissingBlockFileError, "MissingBlockFileError"],
  [ProjectDetectionError, "ProjectDetectionError"],
];

if (
  typeof searchBlocks !== "function" ||
  typeof resolveBlock !== "function" ||
  typeof collectPackageDependencies !== "function" ||
  typeof createDependencyPlan !== "function" ||
  typeof loadBlockMetadata !== "function" ||
  typeof loadBlockFiles !== "function" ||
  typeof validateCompatibility !== "function" ||
  typeof detectProject !== "function" ||
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
