import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { collectionSchema as defaultCollectionSchema } from "@auren/schemas/collection";
import { previewArtifactManifestSchema } from "@auren/schemas/preview";
import { RegistryPublishError } from "./errors.mjs";

const detailFilenamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/;
const previewDirectoryPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const previewFilenamePattern = /^sha256-[0-9a-f]{64}\.json$/;
export async function loadPublicRegistry(
  registryRoot,
  { catalogElementSchema, collectionSchema } = {},
) {
  await assertDirectory(registryRoot);
  const topEntries = await readDirectory(registryRoot);
  const { hasCollectionsDirectory, hasPreviewsDirectory } = assertStaticLayout(
    registryRoot,
    topEntries,
  );

  const schema = catalogElementSchema ?? (await loadCatalogElementSchema());
  const collectionContract = collectionSchema ?? defaultCollectionSchema;
  const indexResource = await readJsonResource(
    path.join(registryRoot, "registry.json"),
  );
  validateIndexEnvelope(indexResource.value);
  const indexBlocks = validateIndexBlocks(schema, indexResource.value.blocks);
  const indexCollections = validateIndexCollections(
    collectionContract,
    indexResource.value.collections,
  );

  if ((indexCollections !== undefined) !== hasCollectionsDirectory) {
    throw new RegistryPublishError(
      "Registry Collection resources do not match the index envelope",
      ["collections/ and registry.json.collections must be present together"],
    );
  }

  const details = await loadDetails(registryRoot, schema);
  const collections = await loadCollectionDetails(
    registryRoot,
    collectionContract,
    indexCollections,
  );

  validateCorrespondence(indexBlocks, details);
  validateCollectionCorrespondence(indexCollections, collections);
  const previews = await loadPreviewDetails(registryRoot, hasPreviewsDirectory);
  validatePreviewCorrespondence(indexBlocks, previews);

  return {
    catalogElementSchema: schema,
    collectionSchema: collectionContract,
    index: indexResource.value,
    indexBytes: indexResource.bytes,
    details,
    collections,
    previews,
  };
}

async function assertDirectory(registryRoot) {
  let stat;

  try {
    stat = await lstat(registryRoot);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new RegistryPublishError(
        `Registry input root does not exist: ${displayPath(registryRoot)}`,
      );
    }

    throw new RegistryPublishError(
      `cannot inspect Registry input root ${displayPath(registryRoot)}`,
      [error.message],
    );
  }

  if (!stat.isDirectory()) {
    throw new RegistryPublishError(
      `Registry input root is not a directory: ${displayPath(registryRoot)}`,
    );
  }
}

async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    throw new RegistryPublishError(
      `could not read Registry directory ${displayPath(directory)}`,
      [error.message],
    );
  }
}

function assertStaticLayout(registryRoot, topEntries) {
  const topNames = new Set(topEntries.map((entry) => entry.name));
  const hasCollectionsDirectory = topNames.has("collections");
  const hasPreviewsDirectory = topNames.has("previews");
  const expectedEntryCount =
    2 + Number(hasCollectionsDirectory) + Number(hasPreviewsDirectory);
  const hasExpectedEntries =
    topNames.size === expectedEntryCount &&
    topNames.has("registry.json") &&
    topNames.has("blocks");
  const hasExpectedTypes = topEntries.every(
    (entry) =>
      (entry.name === "registry.json" && entry.isFile()) ||
      (entry.name === "blocks" && entry.isDirectory()) ||
      (entry.name === "collections" && entry.isDirectory()) ||
      (entry.name === "previews" && entry.isDirectory()),
  );

  if (!hasExpectedEntries || !hasExpectedTypes) {
    throw new RegistryPublishError(
      `Registry input has an unexpected top-level entry: ${displayPath(registryRoot)}`,
      [
        "expected registry.json, blocks/, and optional collections/ and previews/",
      ],
    );
  }

  return { hasCollectionsDirectory, hasPreviewsDirectory };
}

function validateIndexEnvelope(index) {
  if (
    index === null ||
    typeof index !== "object" ||
    Array.isArray(index) ||
    index.schemaVersion !== 1 ||
    !Number.isInteger(index.schemaVersion) ||
    !Array.isArray(index.blocks) ||
    (Object.hasOwn(index, "collections") && !Array.isArray(index.collections))
  ) {
    throw new RegistryPublishError("Registry index has an invalid envelope", [
      "expected { schemaVersion: 1, blocks: [], collections?: [] }",
    ]);
  }
}

function validateIndexBlocks(catalogElementSchema, blocks) {
  const indexBlocks = [];
  const ids = new Set();

  for (const [position, block] of blocks.entries()) {
    assertSchema(
      catalogElementSchema,
      block,
      `Registry index block ${position}`,
    );
    assertNoInstallationFields(
      block,
      `Registry index block ${position}`,
      "index",
    );

    if (ids.has(block.id)) {
      throw new RegistryPublishError(
        "Registry index contains duplicate block IDs",
        [`duplicate block id: ${block.id}`],
      );
    }

    ids.add(block.id);
    indexBlocks.push(block);
  }

  return indexBlocks;
}

function validateIndexCollections(collectionSchema, collections) {
  if (collections === undefined) {
    return undefined;
  }

  const indexCollections = [];
  const ids = new Set();

  for (const [position, collection] of collections.entries()) {
    assertSchema(
      collectionSchema,
      collection,
      `Registry index Collection ${position}`,
      "collection",
    );
    assertNoCollectionInstallationFields(
      collection,
      `Registry index Collection ${position}`,
    );

    if (ids.has(collection.id)) {
      throw new RegistryPublishError(
        "Registry index contains duplicate Collection IDs",
        [`duplicate Collection id: ${collection.id}`],
      );
    }

    ids.add(collection.id);
    indexCollections.push(collection);
  }

  return indexCollections;
}

async function loadDetails(registryRoot, catalogElementSchema) {
  const blocksRoot = path.join(registryRoot, "blocks");
  const entries = await readDirectory(blocksRoot);
  const details = [];

  for (const entry of entries) {
    const detailPath = path.join(blocksRoot, entry.name);

    if (!entry.isFile()) {
      throw new RegistryPublishError(
        `Registry detail entry is not a regular file: ${displayPath(detailPath)}`,
      );
    }

    if (!entry.name.endsWith(".json")) {
      throw new RegistryPublishError(
        `Registry detail entry is not JSON: ${displayPath(detailPath)}`,
      );
    }

    if (!detailFilenamePattern.test(entry.name)) {
      throw new RegistryPublishError(
        `Registry detail filename is unsafe: ${displayPath(detailPath)}`,
      );
    }

    const id = entry.name.slice(0, -".json".length);
    const resource = await readJsonResource(detailPath);
    assertSchema(catalogElementSchema, resource.value, `Registry detail ${id}`);
    assertNoInstallationFields(
      resource.value,
      `Registry detail ${id}`,
      "detail",
    );
    validateDetailContent(resource.value, id);

    details.push({
      id,
      detail: resource.value,
      bytes: resource.bytes,
      fileName: entry.name,
    });
  }

  details.sort((left, right) => compareStrings(left.id, right.id));
  return details;
}

async function loadCollectionDetails(
  registryRoot,
  collectionSchema,
  indexCollections,
) {
  if (indexCollections === undefined) {
    return undefined;
  }

  const collectionsRoot = path.join(registryRoot, "collections");
  const entries = await readDirectory(collectionsRoot);
  const collections = [];

  for (const entry of entries) {
    const collectionPath = path.join(collectionsRoot, entry.name);

    if (!entry.isFile()) {
      throw new RegistryPublishError(
        `Registry Collection detail entry is not a regular file: ${displayPath(collectionPath)}`,
      );
    }

    if (!entry.name.endsWith(".json")) {
      throw new RegistryPublishError(
        `Registry Collection detail entry is not JSON: ${displayPath(collectionPath)}`,
      );
    }

    if (!detailFilenamePattern.test(entry.name)) {
      throw new RegistryPublishError(
        `Registry Collection detail filename is unsafe: ${displayPath(collectionPath)}`,
      );
    }

    const id = entry.name.slice(0, -".json".length);
    const resource = await readJsonResource(collectionPath);
    assertSchema(
      collectionSchema,
      resource.value,
      `Registry Collection detail ${id}`,
      "collection",
    );
    assertNoCollectionInstallationFields(
      resource.value,
      `Registry Collection detail ${id}`,
    );

    if (resource.value.id !== id) {
      throw new RegistryPublishError(
        "Registry Collection detail filename and payload IDs differ",
        [`${entry.name}: payload id is ${JSON.stringify(resource.value.id)}`],
      );
    }

    collections.push({
      id,
      detail: resource.value,
      bytes: resource.bytes,
      fileName: entry.name,
    });
  }

  collections.sort((left, right) => compareStrings(left.id, right.id));
  return collections;
}

async function loadPreviewDetails(registryRoot, hasPreviewsDirectory) {
  if (!hasPreviewsDirectory) {
    return [];
  }

  const previewsRoot = path.join(registryRoot, "previews");
  const directories = await readDirectory(previewsRoot);
  const previews = [];

  for (const directory of directories) {
    const directoryPath = path.join(previewsRoot, directory.name);

    if (
      !directory.isDirectory() ||
      !previewDirectoryPattern.test(directory.name)
    ) {
      throw new RegistryPublishError(
        `preview artifact directory is unsafe: ${displayPath(directoryPath)}`,
      );
    }

    const entries = await readDirectory(directoryPath);

    for (const entry of entries) {
      const artifactPath = path.join(directoryPath, entry.name);

      if (!entry.isFile() || !previewFilenamePattern.test(entry.name)) {
        throw new RegistryPublishError(
          `preview artifact entry is unsafe: ${displayPath(artifactPath)}`,
        );
      }

      const resource = await readJsonResource(artifactPath);
      assertSchema(
        previewArtifactManifestSchema,
        resource.value,
        `Registry preview artifact ${directory.name}/${entry.name}`,
        "preview",
      );
      previews.push({
        reference: `previews/${directory.name}/${entry.name}`,
        payload: resource.value,
        bytes: resource.bytes,
        fileName: `${directory.name}/${entry.name}`,
      });
    }
  }

  previews.sort((left, right) =>
    compareStrings(left.reference, right.reference),
  );
  return previews;
}

function validateCorrespondence(indexBlocks, details) {
  const indexById = new Map(indexBlocks.map((block) => [block.id, block]));
  const detailById = new Map();

  for (const entry of details) {
    if (detailById.has(entry.id)) {
      throw new RegistryPublishError(
        "Registry detail resources contain duplicate IDs",
        [`duplicate detail id: ${entry.id}`],
      );
    }

    detailById.set(entry.id, entry);

    if (!indexById.has(entry.id)) {
      throw new RegistryPublishError(
        "Registry detail resources do not match the index",
        [`extra detail not listed by index: ${entry.fileName}`],
      );
    }

    if (entry.detail.id !== entry.id) {
      throw new RegistryPublishError(
        "Registry detail filename and payload IDs differ",
        [`${entry.fileName}: payload id is ${JSON.stringify(entry.detail.id)}`],
      );
    }

    const indexBlock = indexById.get(entry.id);

    if (
      !sameJsonValue(
        publicProjection(indexBlock),
        publicProjection(entry.detail),
      )
    ) {
      throw new RegistryPublishError(
        "Registry index and detail metadata differ",
        [`${entry.id}: index and detail payloads do not correspond`],
      );
    }
  }

  for (const block of indexBlocks) {
    if (!detailById.has(block.id)) {
      throw new RegistryPublishError(
        "Registry detail resources do not match the index",
        [`missing detail for index id: ${block.id}`],
      );
    }
  }
}

function validateCollectionCorrespondence(indexCollections, details) {
  if (indexCollections === undefined || details === undefined) {
    return;
  }

  const indexById = new Map(
    indexCollections.map((collection) => [collection.id, collection]),
  );
  const detailById = new Map();

  for (const entry of details) {
    if (detailById.has(entry.id)) {
      throw new RegistryPublishError(
        "Registry Collection detail resources contain duplicate IDs",
        [`duplicate Collection detail id: ${entry.id}`],
      );
    }

    detailById.set(entry.id, entry);

    if (!indexById.has(entry.id)) {
      throw new RegistryPublishError(
        "Registry Collection detail resources do not match the index",
        [`extra Collection detail not listed by index: ${entry.fileName}`],
      );
    }

    if (!sameJsonValue(indexById.get(entry.id), entry.detail)) {
      throw new RegistryPublishError(
        "Registry Collection index and detail metadata differ",
        [`${entry.id}: index and detail payloads do not correspond`],
      );
    }
  }

  for (const collection of indexCollections) {
    if (!detailById.has(collection.id)) {
      throw new RegistryPublishError(
        "Registry Collection detail resources do not match the index",
        [`missing Collection detail for index id: ${collection.id}`],
      );
    }
  }
}

function validatePreviewCorrespondence(indexBlocks, previews) {
  const previewsByReference = new Map();

  for (const preview of previews) {
    if (previewsByReference.has(preview.reference)) {
      throw new RegistryPublishError(
        "Registry preview artifacts contain duplicate references",
        [preview.reference],
      );
    }

    previewsByReference.set(preview.reference, preview);
  }

  const referencedPreviews = new Set();

  for (const block of indexBlocks) {
    const descriptor = block.preview;

    if (descriptor?.status !== "ready") {
      continue;
    }

    const reference = descriptor.artifact?.reference;

    if (reference === undefined) {
      continue;
    }

    const preview = previewsByReference.get(reference);

    if (preview === undefined) {
      throw new RegistryPublishError(
        "Registry preview descriptor references a missing artifact",
        [`${block.id}: ${reference}`],
      );
    }

    if (
      preview.payload.contentId !== descriptor.contentId ||
      preview.payload.identity !== descriptor.identity ||
      preview.payload.runtime !== descriptor.runtime ||
      preview.payload.runtimeVersion !== descriptor.runtimeVersion
    ) {
      throw new RegistryPublishError(
        "Registry preview descriptor and artifact identities differ",
        [`${block.id}: ${reference}`],
      );
    }

    referencedPreviews.add(reference);
  }

  for (const reference of previewsByReference.keys()) {
    if (!referencedPreviews.has(reference)) {
      throw new RegistryPublishError(
        "Registry preview artifact is not referenced by a ready descriptor",
        [reference],
      );
    }
  }
}

function validateDetailContent(element, id) {
  for (const file of element.files) {
    if (!Object.hasOwn(file, "content") || typeof file.content !== "string") {
      throw new RegistryPublishError(
        "Registry detail payload is missing inline file content",
        [`${id}: ${file.path}`],
      );
    }

    if (file.kind === "asset" && !isCanonicalBase64(file.content)) {
      throw new RegistryPublishError(
        "Registry detail asset content is not canonical base64",
        [`${id}: ${file.path}`],
      );
    }
  }
}

function assertNoCollectionInstallationFields(collection, label) {
  for (const field of ["target", "content", "files"]) {
    if (Object.hasOwn(collection, field)) {
      throw new RegistryPublishError(
        `${label} contains a forbidden ${field} field`,
      );
    }
  }
}

function assertNoInstallationFields(element, label, kind) {
  if (Object.hasOwn(element, "target")) {
    throw new RegistryPublishError(
      `${label} contains a forbidden target field`,
    );
  }

  if (Object.hasOwn(element, "content")) {
    throw new RegistryPublishError(
      `${label} contains a forbidden content field`,
    );
  }

  for (const file of element.files ?? []) {
    if (Object.hasOwn(file, "target")) {
      throw new RegistryPublishError(
        `${label} contains a forbidden file target`,
        [`${element.id}: ${file.path}`],
      );
    }

    if (kind === "index" && Object.hasOwn(file, "content")) {
      throw new RegistryPublishError(
        `${label} contains a forbidden file content field`,
        [`${element.id}: ${file.path}`],
      );
    }
  }
}

function assertSchema(schema, value, label, schemaName = "catalog") {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new RegistryPublishError(
      `${label} failed @auren/schemas/${schemaName} validation`,
      formatSchemaIssues(result.error.issues),
    );
  }
}

async function readJsonResource(filePath) {
  let bytes;

  try {
    bytes = await readFile(filePath);
  } catch (error) {
    throw new RegistryPublishError(
      `could not read Registry JSON ${displayPath(filePath)}`,
      [error.message],
    );
  }

  const source = bytes.toString("utf8");

  if (!Buffer.from(source, "utf8").equals(bytes)) {
    throw new RegistryPublishError(
      `Registry JSON is not valid UTF-8: ${displayPath(filePath)}`,
    );
  }

  try {
    return { value: JSON.parse(source), bytes };
  } catch (error) {
    throw new RegistryPublishError(
      `Registry JSON is malformed: ${displayPath(filePath)}`,
      [error.message],
    );
  }
}

async function loadCatalogElementSchema() {
  try {
    const module = await import("@auren/schemas/catalog");

    if (!module.catalogElementSchema) {
      throw new Error("catalogElementSchema export is missing");
    }

    return module.catalogElementSchema;
  } catch (error) {
    throw new RegistryPublishError(
      "unable to load the built public @auren/schemas/catalog entrypoint; run pnpm --filter @auren/schemas build first",
      [error.message],
    );
  }
}

function publicProjection(element) {
  return {
    ...element,
    files: element.files.map(({ path: filePath, kind }) => ({
      path: filePath,
      kind,
    })),
  };
}

function sameJsonValue(left, right) {
  return (
    JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right))
  );
}

function sortJsonValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareStrings)
        .map((key) => [key, sortJsonValue(value[key])]),
    );
  }

  return value;
}

function isCanonicalBase64(value) {
  return (
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    ) && Buffer.from(value, "base64").toString("base64") === value
  );
}

function formatSchemaIssues(issues) {
  return issues.map(
    (issue) => `${formatIssuePath(issue.path)}: ${issue.message}`,
  );
}

function formatIssuePath(issuePath) {
  if (issuePath.length === 0) {
    return "<root>";
  }

  return issuePath.reduce((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }

    return formatted.length === 0 ? segment : `${formatted}.${segment}`;
  }, "");
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
