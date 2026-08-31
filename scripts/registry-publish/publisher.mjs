import {
  lstat,
  mkdir,
  mkdtemp,
  rename,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { RegistryPublishError } from "./errors.mjs";
import {
  defaultOutputRoot,
  defaultRegistryRoot,
  pathsOverlap,
  resolvePublishRoots,
} from "./paths.mjs";
import { loadPublicRegistry } from "./validator.mjs";

export async function publishRegistry({
  registryRoot = defaultRegistryRoot,
  outputRoot = defaultOutputRoot,
} = {}) {
  const roots = resolvePublishRoots({ registryRoot, outputRoot });

  if (pathsOverlap(roots.registryRoot, roots.outputRoot)) {
    throw new RegistryPublishError(
      "Registry input and output roots must be disjoint",
      [
        `Registry input root: ${displayPath(roots.registryRoot)}`,
        `output root: ${displayPath(roots.outputRoot)}`,
      ],
    );
  }

  const registry = await loadPublicRegistry(roots.registryRoot);
  const existingOutput = await inspectExistingOutput(roots.outputRoot);

  await stageAndReplaceOutput({
    outputRoot: roots.outputRoot,
    registry,
    existingOutput,
  });

  return {
    blockCount: registry.details.length,
    collectionCount: registry.collections?.length ?? 0,
    registryRoot: roots.registryRoot,
    outputRoot: roots.outputRoot,
  };
}

async function inspectExistingOutput(outputRoot) {
  let stat;

  try {
    stat = await lstat(outputRoot);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, recognized: false };
    }

    throw new RegistryPublishError(
      `cannot inspect output root ${displayPath(outputRoot)}`,
      [error.message],
    );
  }

  if (!stat.isDirectory()) {
    throw new RegistryPublishError(
      `output root is not a directory: ${displayPath(outputRoot)}`,
    );
  }

  const entries = await readdir(outputRoot, { withFileTypes: true });

  if (entries.length === 0) {
    return { exists: true, recognized: true, empty: true };
  }

  try {
    await loadPublicRegistry(outputRoot);
  } catch (error) {
    throw new RegistryPublishError(
      `existing output root is not recognizable public Registry output: ${displayPath(outputRoot)}`,
      errorDetails(error),
      { cause: error },
    );
  }

  return { exists: true, recognized: true, empty: false };
}

async function stageAndReplaceOutput({ outputRoot, registry, existingOutput }) {
  const parentDirectory = path.dirname(outputRoot);
  await mkdir(parentDirectory, { recursive: true });

  let stagingRoot;

  try {
    stagingRoot = await mkdtemp(
      path.join(parentDirectory, `.${path.basename(outputRoot)}.staging-`),
    );
    await writeStagedRegistry(stagingRoot, registry);
    await loadPublicRegistry(stagingRoot, {
      catalogElementSchema: registry.catalogElementSchema,
      collectionSchema: registry.collectionSchema,
    });
    await replaceOutputDirectory({
      stagingRoot,
      outputRoot,
      existingOutput,
    });
    stagingRoot = undefined;
  } finally {
    if (stagingRoot !== undefined) {
      await rm(stagingRoot, { recursive: true, force: true });
    }
  }
}

async function writeStagedRegistry(stagingRoot, registry) {
  const blocksRoot = path.join(stagingRoot, "blocks");
  await mkdir(blocksRoot);

  if (registry.collections !== undefined) {
    await mkdir(path.join(stagingRoot, "collections"));
  }

  await writeFile(path.join(stagingRoot, "registry.json"), registry.indexBytes);

  for (const entry of registry.details) {
    await writeFile(path.join(blocksRoot, entry.fileName), entry.bytes);
  }

  for (const entry of registry.collections ?? []) {
    await writeFile(
      path.join(stagingRoot, "collections", entry.fileName),
      entry.bytes,
    );
  }
}

async function replaceOutputDirectory({
  stagingRoot,
  outputRoot,
  existingOutput,
}) {
  let backupRoot;
  let previousMoved = false;
  let replacementMoved = false;

  try {
    if (existingOutput.exists) {
      backupRoot = await createSiblingPlaceholder(outputRoot, "backup");
      await rename(outputRoot, backupRoot);
      previousMoved = true;
    }

    await rename(stagingRoot, outputRoot);
    replacementMoved = true;

    if (backupRoot !== undefined) {
      await rm(backupRoot, { recursive: true, force: true });
      backupRoot = undefined;
      previousMoved = false;
    }
  } catch (error) {
    const recoveryErrors = [];

    if (replacementMoved) {
      try {
        await rm(outputRoot, { recursive: true, force: true });
      } catch (recoveryError) {
        recoveryErrors.push(
          `could not remove replacement: ${recoveryError.message}`,
        );
      }
    }

    if (previousMoved && backupRoot !== undefined) {
      try {
        await rename(backupRoot, outputRoot);
        backupRoot = undefined;
        previousMoved = false;
      } catch (recoveryError) {
        recoveryErrors.push(
          `could not restore previous output: ${recoveryError.message}`,
        );
      }
    }

    if (recoveryErrors.length > 0) {
      throw new RegistryPublishError(
        `output replacement failed: ${error.message}`,
        recoveryErrors,
        { cause: error },
      );
    }

    throw error;
  } finally {
    if (backupRoot !== undefined && !previousMoved) {
      await rm(backupRoot, { recursive: true, force: true });
    }
  }
}

async function createSiblingPlaceholder(outputRoot, label) {
  const parentDirectory = path.dirname(outputRoot);
  const prefix = path.join(
    parentDirectory,
    `.${path.basename(outputRoot)}.${label}-`,
  );
  const placeholder = await mkdtemp(prefix);
  await rm(placeholder, { recursive: true, force: true });
  return placeholder;
}

function errorDetails(error) {
  return [error.message, ...(error.details ?? [])];
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith(`..${path.sep}`)
    ? relative.split(path.sep).join("/")
    : filePath.split(path.sep).join("/");
}
