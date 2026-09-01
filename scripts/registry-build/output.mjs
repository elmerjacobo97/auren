import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { collectionSchema as defaultCollectionSchema } from "@auren/schemas/collection";
import { RegistryBuildError } from "./errors.mjs";
import { validateGeneratedArtifacts } from "./catalog.mjs";

const previewDirectoryPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const previewFilenamePattern = /^sha256-[0-9a-f]{64}\.json$/;

export async function inspectExistingOutput(
  outputRoot,
  catalogElementSchema,
  collectionSchema = defaultCollectionSchema,
) {
  let stat;

  try {
    stat = await lstat(outputRoot);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { exists: false, recognized: false };
    }

    throw new RegistryBuildError(
      `cannot inspect output root ${displayPath(outputRoot)}`,
      [error.message],
    );
  }

  if (!stat.isDirectory()) {
    throw new RegistryBuildError(
      `output root is not a directory: ${displayPath(outputRoot)}`,
    );
  }

  const topEntries = await readdir(outputRoot, { withFileTypes: true });

  if (topEntries.length === 0) {
    return { exists: true, recognized: true, empty: true };
  }

  const topNames = new Set(topEntries.map((entry) => entry.name));
  const hasCollectionsDirectory = topNames.has("collections");
  const hasPreviewsDirectory = topNames.has("previews");
  const expectedTopEntryCount =
    2 + Number(hasCollectionsDirectory) + Number(hasPreviewsDirectory);

  if (
    topNames.size !== expectedTopEntryCount ||
    !topNames.has("registry.json") ||
    !topNames.has("blocks") ||
    topEntries.some(
      (entry) =>
        (entry.name === "registry.json" && !entry.isFile()) ||
        (entry.name === "blocks" && !entry.isDirectory()) ||
        (entry.name === "collections" && !entry.isDirectory()) ||
        (entry.name === "previews" && !entry.isDirectory()),
    )
  ) {
    throw new RegistryBuildError(
      `existing output root is not recognizable Registry Build output: ${displayPath(outputRoot)}`,
      [
        "expected registry.json, blocks/, and optional collections/ and previews/",
      ],
    );
  }

  const index = await readJson(path.join(outputRoot, "registry.json"));
  const hasCollectionIndex = Object.hasOwn(index ?? {}, "collections");

  if (
    index?.schemaVersion !== 1 ||
    !Number.isInteger(index.schemaVersion) ||
    !Array.isArray(index.blocks) ||
    hasCollectionIndex !== hasCollectionsDirectory ||
    (hasCollectionIndex && !Array.isArray(index.collections))
  ) {
    throw new RegistryBuildError(
      `existing output root has an invalid Registry Build index: ${displayPath(outputRoot)}`,
    );
  }

  const detailEntries = await readdir(path.join(outputRoot, "blocks"), {
    withFileTypes: true,
  });
  const details = [];

  for (const entry of detailEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      throw new RegistryBuildError(
        `existing output contains an unexpected detail entry: ${displayPath(path.join(outputRoot, "blocks", entry.name))}`,
      );
    }

    const id = entry.name.slice(0, -".json".length);
    const payload = await readJson(path.join(outputRoot, "blocks", entry.name));
    details.push({ id, detail: payload });
  }

  details.sort((left, right) => compareStrings(left.id, right.id));

  let collectionEntries;

  if (hasCollectionsDirectory) {
    const collectionRoot = path.join(outputRoot, "collections");
    const entries = await readdir(collectionRoot, { withFileTypes: true });
    collectionEntries = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        throw new RegistryBuildError(
          `existing output contains an unexpected Collection detail entry: ${displayPath(path.join(collectionRoot, entry.name))}`,
        );
      }

      const id = entry.name.slice(0, -".json".length);
      const payload = await readJson(path.join(collectionRoot, entry.name));
      collectionEntries.push({ id, detail: payload });
    }

    collectionEntries.sort((left, right) => compareStrings(left.id, right.id));
  }

  const previews = hasPreviewsDirectory
    ? await readPreviewEntries(path.join(outputRoot, "previews"))
    : [];

  validateGeneratedArtifacts({
    catalogElementSchema,
    index,
    entries: details,
    expectedIds: index.blocks.map((block) => block?.id),
    collectionSchema,
    collectionEntries,
    expectedCollectionIds: index.collections?.map(
      (collection) => collection?.id,
    ),
    previews,
  });

  return { exists: true, recognized: true, empty: false };
}

export async function stageAndReplaceOutput({
  outputRoot,
  artifacts,
  catalogElementSchema,
  collectionSchema = defaultCollectionSchema,
  existingOutput,
}) {
  const parentDirectory = path.dirname(outputRoot);
  await mkdir(parentDirectory, { recursive: true });

  let stagingRoot;

  try {
    stagingRoot = await mkdtemp(
      path.join(parentDirectory, `.${path.basename(outputRoot)}.staging-`),
    );
    await writeStagedArtifacts(stagingRoot, artifacts);
    await validateStagedOutput({
      stagingRoot,
      artifacts,
      catalogElementSchema,
      collectionSchema,
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

async function writeStagedArtifacts(stagingRoot, artifacts) {
  const blocksRoot = path.join(stagingRoot, "blocks");
  const collectionsRoot = path.join(stagingRoot, "collections");
  await mkdir(blocksRoot);
  await mkdir(collectionsRoot);
  await writeJson(path.join(stagingRoot, "registry.json"), artifacts.index);

  for (const entry of artifacts.entries) {
    await writeJson(path.join(blocksRoot, `${entry.id}.json`), entry.detail);
  }

  for (const entry of artifacts.collections ?? []) {
    await writeJson(
      path.join(collectionsRoot, `${entry.id}.json`),
      entry.detail,
    );
  }

  if ((artifacts.previews ?? []).length > 0) {
    const previewsRoot = path.join(stagingRoot, "previews");
    await mkdir(previewsRoot);

    for (const entry of artifacts.previews) {
      const previewPath = path.join(stagingRoot, entry.reference);
      await mkdir(path.dirname(previewPath), { recursive: true });
      await writeJson(previewPath, entry.payload);
    }
  }
}

async function validateStagedOutput({
  stagingRoot,
  artifacts,
  catalogElementSchema,
  collectionSchema,
}) {
  const topEntries = await readdir(stagingRoot, { withFileTypes: true });
  const topNames = new Set(topEntries.map((entry) => entry.name));
  const hasPreviewsDirectory = topNames.has("previews");
  const hasPreviewArtifacts = (artifacts.previews ?? []).length > 0;

  if (
    topNames.size !== 3 + Number(hasPreviewArtifacts) ||
    !topNames.has("registry.json") ||
    !topNames.has("blocks") ||
    !topNames.has("collections") ||
    hasPreviewsDirectory !== hasPreviewArtifacts ||
    topEntries.some(
      (entry) =>
        (entry.name === "registry.json" && !entry.isFile()) ||
        (entry.name === "blocks" && !entry.isDirectory()) ||
        (entry.name === "collections" && !entry.isDirectory()) ||
        (entry.name === "previews" && !entry.isDirectory()),
    )
  ) {
    throw new RegistryBuildError(
      "staged Registry output has an unexpected layout",
    );
  }

  const index = await readJson(path.join(stagingRoot, "registry.json"));
  const detailEntries = await readdir(path.join(stagingRoot, "blocks"), {
    withFileTypes: true,
  });
  const details = [];

  for (const entry of detailEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      throw new RegistryBuildError(
        `staged Registry output contains an unexpected detail entry: ${entry.name}`,
      );
    }

    details.push({
      id: entry.name.slice(0, -".json".length),
      detail: await readJson(path.join(stagingRoot, "blocks", entry.name)),
    });
  }

  const collectionDetailEntries = await readdir(
    path.join(stagingRoot, "collections"),
    { withFileTypes: true },
  );
  const collectionEntries = [];

  for (const entry of collectionDetailEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      throw new RegistryBuildError(
        `staged Registry output contains an unexpected Collection detail entry: ${entry.name}`,
      );
    }

    collectionEntries.push({
      id: entry.name.slice(0, -".json".length),
      detail: await readJson(path.join(stagingRoot, "collections", entry.name)),
    });
  }

  details.sort((left, right) => compareStrings(left.id, right.id));
  collectionEntries.sort((left, right) => compareStrings(left.id, right.id));
  const previews = hasPreviewArtifacts
    ? await readPreviewEntries(path.join(stagingRoot, "previews"))
    : [];
  validateGeneratedArtifacts({
    catalogElementSchema,
    index,
    entries: details,
    expectedIds: artifacts.entries.map(({ id }) => id),
    collectionSchema,
    collectionEntries,
    expectedCollectionIds: artifacts.collections.map(({ id }) => id),
    previews,
  });
}

async function readPreviewEntries(previewsRoot) {
  const directories = await readdir(previewsRoot, { withFileTypes: true });
  const previews = [];

  for (const directory of directories) {
    if (
      !directory.isDirectory() ||
      !previewDirectoryPattern.test(directory.name)
    ) {
      throw new RegistryBuildError(
        `preview artifact directory is unsafe: ${displayPath(path.join(previewsRoot, directory.name))}`,
      );
    }

    const entries = await readdir(path.join(previewsRoot, directory.name), {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const artifactPath = path.join(previewsRoot, directory.name, entry.name);

      if (!entry.isFile() || !previewFilenamePattern.test(entry.name)) {
        throw new RegistryBuildError(
          `preview artifact entry is unsafe: ${displayPath(artifactPath)}`,
        );
      }

      previews.push({
        reference: `previews/${directory.name}/${entry.name}`,
        payload: await readJson(artifactPath),
      });
    }
  }

  previews.sort((left, right) =>
    compareStrings(left.reference, right.reference),
  );
  return previews;
}

async function replaceOutputDirectory({
  stagingRoot,
  outputRoot,
  existingOutput,
}) {
  let backupRoot;
  let outputMoved = false;
  let stagingMoved = false;

  try {
    if (existingOutput.exists) {
      backupRoot = await createSiblingPlaceholder(outputRoot, "backup");
      await rename(outputRoot, backupRoot);
      outputMoved = true;
    }

    await rename(stagingRoot, outputRoot);
    stagingMoved = true;

    if (backupRoot !== undefined) {
      await rm(backupRoot, { recursive: true, force: true });
      backupRoot = undefined;
    }
  } catch (error) {
    const recoveryErrors = [];

    if (stagingMoved) {
      try {
        await rm(outputRoot, { recursive: true, force: true });
      } catch (recoveryError) {
        recoveryErrors.push(
          `could not remove replacement: ${recoveryError.message}`,
        );
      }
    }

    if (outputMoved && backupRoot !== undefined) {
      try {
        await rename(backupRoot, outputRoot);
        backupRoot = undefined;
      } catch (recoveryError) {
        recoveryErrors.push(
          `could not restore previous output: ${recoveryError.message}`,
        );
      }
    }

    if (recoveryErrors.length > 0) {
      throw new RegistryBuildError(
        `output replacement failed: ${error.message}`,
        recoveryErrors,
        { cause: error },
      );
    }

    throw error;
  } finally {
    if (backupRoot !== undefined && !outputMoved) {
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

async function readJson(filePath) {
  let source;

  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    throw new RegistryBuildError(
      `could not read generated JSON ${displayPath(filePath)}`,
      [error.message],
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new RegistryBuildError(
      `generated JSON is malformed: ${displayPath(filePath)}`,
      [error.message],
    );
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function displayPath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith(`..${path.sep}`)
    ? relative.split(path.sep).join("/")
    : filePath.split(path.sep).join("/");
}

function compareStrings(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
