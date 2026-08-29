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
  blocksRoot = defaultBlocksRoot,
  outputRoot = defaultOutputRoot,
  categoryRoots = expectedBlockCategories,
} = {}) {
  const roots = resolveBuildRoots({ blocksRoot, outputRoot });

  validateBuildRoots(roots);

  const sourceCatalog = await loadSourceCatalog({
    blocksRoot: roots.blocksRoot,
    categoryRoots,
  });
  const artifacts = await createCatalogArtifacts(sourceCatalog);
  const existingOutput = await inspectExistingOutput(
    roots.outputRoot,
    sourceCatalog.catalogElementSchema,
  );

  await stageAndReplaceOutput({
    outputRoot: roots.outputRoot,
    artifacts,
    catalogElementSchema: sourceCatalog.catalogElementSchema,
    existingOutput,
  });

  return {
    blockCount: artifacts.entries.length,
    blocksRoot: roots.blocksRoot,
    outputRoot: roots.outputRoot,
  };
}

function validateBuildRoots({ blocksRoot, outputRoot }) {
  if (pathsOverlap(blocksRoot, outputRoot)) {
    throw new RegistryBuildError("blocks and output roots must be disjoint", [
      `blocks root: ${blocksRoot}`,
      `output root: ${outputRoot}`,
    ]);
  }
}
