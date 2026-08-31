import { expectedBlockCategories } from "../verify-workspace.mjs";
import { createCatalogArtifacts, loadSourceCatalog } from "./catalog.mjs";
import { RegistryBuildError } from "./errors.mjs";
import {
  defaultBlocksRoot,
  defaultOutputRoot,
  pathsOverlap,
  resolveBuildRoots,
} from "./paths.mjs";
import { inspectExistingOutput, stageAndReplaceOutput } from "./output.mjs";

export { defaultBlocksRoot, defaultOutputRoot };

export async function buildRegistry({
  blocksRoot,
  collectionsRoot,
  outputRoot = defaultOutputRoot,
  categoryRoots = expectedBlockCategories,
} = {}) {
  const roots = resolveBuildRoots({
    blocksRoot,
    collectionsRoot,
    outputRoot,
  });

  validateBuildRoots(roots);

  const sourceCatalog = await loadSourceCatalog({
    blocksRoot: roots.blocksRoot,
    collectionsRoot: roots.collectionsRoot,
    categoryRoots,
  });
  const artifacts = await createCatalogArtifacts(sourceCatalog);
  const existingOutput = await inspectExistingOutput(
    roots.outputRoot,
    sourceCatalog.catalogElementSchema,
    sourceCatalog.collectionSchema,
  );

  await stageAndReplaceOutput({
    outputRoot: roots.outputRoot,
    artifacts,
    catalogElementSchema: sourceCatalog.catalogElementSchema,
    collectionSchema: sourceCatalog.collectionSchema,
    existingOutput,
  });

  return {
    blockCount: artifacts.entries.length,
    collectionCount: artifacts.collections.length,
    blocksRoot: roots.blocksRoot,
    collectionsRoot: roots.collectionsRoot,
    outputRoot: roots.outputRoot,
  };
}

function validateBuildRoots({ blocksRoot, collectionsRoot, outputRoot }) {
  const roots = [
    ["blocks", blocksRoot],
    ["collections", collectionsRoot],
    ["output", outputRoot],
  ];

  for (let leftIndex = 0; leftIndex < roots.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < roots.length;
      rightIndex += 1
    ) {
      const [leftName, leftRoot] = roots[leftIndex];
      const [rightName, rightRoot] = roots[rightIndex];

      if (pathsOverlap(leftRoot, rightRoot)) {
        throw new RegistryBuildError(
          `${leftName} and ${rightName} roots must be disjoint`,
          [`${leftName} root: ${leftRoot}`, `${rightName} root: ${rightRoot}`],
        );
      }
    }
  }
}
