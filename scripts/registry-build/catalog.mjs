import { readFile } from "node:fs/promises";
import path from "node:path";
import { expectedBlockCategories } from "../verify-workspace.mjs";
import { RegistryBuildError } from "./errors.mjs";

export const catalogFields = Object.freeze([
  "id",
  "name",
  "description",
  "category",
  "type",
  "styles",
  "industries",
  "features",
  "frameworks",
  "dependencies",
  "files",
  "metadata",
]);

export async function loadSourceCatalog({
  blocksRoot,
  categoryRoots = expectedBlockCategories,
}) {
  const catalogElementSchema = await loadCatalogElementSchema();
  const { verifyBlocks } = await import("../verify-blocks.mjs");
  const verification = verifyBlocks({
    blocksRoot,
    categoryRoots,
    includeInventory: true,
  });

  if (verification.errors.length > 0) {
    throw new RegistryBuildError(
      "source catalog verification failed",
      verification.errors,
    );
  }

  const elements = [];

  for (const block of verification.blocks ?? []) {
    const manifestPath = path.join(block.blockRoot, "registry.json");
    let manifest;

    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      throw new RegistryBuildError(
        `could not read source manifest ${displayPath(manifestPath)}`,
        [error.message],
      );
    }

    const parsed = catalogElementSchema.safeParse(manifest);

    if (!parsed.success) {
      throw new RegistryBuildError(
        `source manifest does not satisfy @auren/schemas/catalog: ${displayPath(manifestPath)}`,
        formatSchemaIssues(parsed.error.issues),
      );
    }

    elements.push({
      blockRoot: block.blockRoot,
      actualFiles: block.actualFiles,
      element: parsed.data,
    });
  }

  elements.sort((left, right) =>
    compareStrings(left.element.id, right.element.id),
  );
  validateCatalogDependencies(elements);

  return { catalogElementSchema, elements };
}

export async function createCatalogArtifacts({
  catalogElementSchema,
  elements,
}) {
  const entries = [];

  for (const { blockRoot, actualFiles, element } of elements) {
    const materializedFiles = [];

    for (const descriptor of [...element.files].sort((left, right) =>
      compareStrings(left.path, right.path),
    )) {
      const actualFile = actualFiles?.get(descriptor.path);

      if (!actualFile || actualFile.kind !== descriptor.kind) {
        throw new RegistryBuildError(
          `source payload inventory changed while building ${element.id}`,
          [`${element.id}: ${descriptor.path}`],
        );
      }

      const sourcePath = path.join(blockRoot, ...descriptor.path.split("/"));
      let bytes;

      try {
        bytes = await readFile(sourcePath);
      } catch (error) {
        throw new RegistryBuildError(
          `could not read payload ${displayPath(sourcePath)}`,
          [error.message],
        );
      }

      let content;

      if (descriptor.kind === "asset") {
        content = bytes.toString("base64");
      } else {
        content = decodeUtf8(bytes, sourcePath);
      }

      materializedFiles.push({
        path: descriptor.path,
        kind: descriptor.kind,
        content,
      });
    }

    const detail = projectCatalogElement(element, materializedFiles);
    const index = projectCatalogElement(
      element,
      materializedFiles.map(({ path: filePath, kind }) => ({
        path: filePath,
        kind,
      })),
    );

    entries.push({ id: element.id, index, detail });
  }

  entries.sort((left, right) => compareStrings(left.id, right.id));

  const artifacts = {
    index: {
      schemaVersion: 1,
      blocks: entries.map(({ index }) => index),
    },
    entries,
  };

  validateGeneratedArtifacts({
    catalogElementSchema,
    index: artifacts.index,
    entries: artifacts.entries,
    expectedIds: entries.map(({ id }) => id),
  });

  return artifacts;
}

export function validateGeneratedArtifacts({
  catalogElementSchema,
  index,
  entries,
  expectedIds,
}) {
  if (
    index?.schemaVersion !== 1 ||
    !Number.isInteger(index.schemaVersion) ||
    !Array.isArray(index.blocks)
  ) {
    throw new RegistryBuildError(
      "generated Registry index has an invalid envelope",
      ["expected { schemaVersion: 1, blocks: [] }"],
    );
  }

  const sortedExpectedIds = [...expectedIds].sort(compareStrings);
  const entryIds = entries.map(({ id }) => id);

  if (
    new Set(sortedExpectedIds).size !== sortedExpectedIds.length ||
    entryIds.length !== sortedExpectedIds.length ||
    !entryIds.every(
      (id, indexPosition) => id === sortedExpectedIds[indexPosition],
    )
  ) {
    throw new RegistryBuildError(
      "generated Registry identities do not match the source catalog",
      [
        `expected detail ids: ${sortedExpectedIds.join(", ")}`,
        `actual detail ids: ${entryIds.join(", ")}`,
      ],
    );
  }

  const indexIds = index.blocks.map((block) => block?.id);

  if (
    indexIds.length !== sortedExpectedIds.length ||
    !indexIds.every(
      (id, indexPosition) => id === sortedExpectedIds[indexPosition],
    )
  ) {
    throw new RegistryBuildError(
      "generated Registry index identities do not match the source catalog",
      [
        `expected index ids: ${sortedExpectedIds.join(", ")}`,
        `actual index ids: ${indexIds.join(", ")}`,
      ],
    );
  }

  const indexById = new Map();

  for (const [position, block] of index.blocks.entries()) {
    assertSchema(
      catalogElementSchema,
      block,
      `generated registry index block ${position}`,
    );
    assertNoInstallationFields(
      block,
      `generated registry index block ${position}`,
    );
    indexById.set(block.id, block);
  }

  for (const entry of entries) {
    const indexBlock = indexById.get(entry.id);

    if (!indexBlock) {
      throw new RegistryBuildError(
        "generated Registry is missing an index entry",
        [`missing index entry for ${entry.id}`],
      );
    }

    assertSchema(
      catalogElementSchema,
      entry.detail,
      `generated detail payload ${entry.id}`,
    );
    assertNoInstallationFields(
      entry.detail,
      `generated detail payload ${entry.id}`,
    );

    for (const file of entry.detail.files) {
      if (typeof file.content !== "string") {
        throw new RegistryBuildError(
          "generated detail payload is missing file content",
          [`${entry.id}: ${file.path}`],
        );
      }

      if (file.kind === "asset" && !isCanonicalBase64(file.content)) {
        throw new RegistryBuildError(
          "generated asset content is not canonical base64",
          [`${entry.id}: ${file.path}`],
        );
      }
    }

    for (const field of catalogFields) {
      if (field === "files") {
        continue;
      }

      if (!sameJsonValue(indexBlock[field], entry.detail[field])) {
        throw new RegistryBuildError(
          "generated index and detail metadata differ",
          [`${entry.id}: field ${field}`],
        );
      }
    }

    const indexFiles = indexBlock.files.map(({ path: filePath, kind }) => ({
      path: filePath,
      kind,
    }));
    const detailFiles = entry.detail.files.map(({ path: filePath, kind }) => ({
      path: filePath,
      kind,
    }));

    if (!sameJsonValue(indexFiles, detailFiles)) {
      throw new RegistryBuildError(
        "generated index and detail file inventories differ",
        [`${entry.id}: files`],
      );
    }
  }
}

function projectCatalogElement(element, files) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    category: element.category,
    type: element.type,
    styles: [...element.styles],
    industries: [...element.industries],
    features: [...element.features],
    frameworks: [...element.frameworks],
    dependencies: element.dependencies.map(canonicalDependency),
    files: [...files].sort((left, right) =>
      compareStrings(left.path, right.path),
    ),
    metadata: sortJsonValue(element.metadata),
  };
}

function canonicalDependency(dependency) {
  if (dependency.kind === "package") {
    return {
      kind: "package",
      name: dependency.name,
      version: dependency.version,
    };
  }

  if (dependency.kind === "auren") {
    return { kind: "auren", id: dependency.id };
  }

  return { kind: "shadcn", name: dependency.name };
}

function validateCatalogDependencies(elements) {
  const ids = new Set();
  const errors = [];

  for (const { element } of elements) {
    if (ids.has(element.id)) {
      errors.push(`duplicate source catalog id ${JSON.stringify(element.id)}`);
    }
    ids.add(element.id);
  }

  for (const { element } of elements) {
    for (const dependency of element.dependencies) {
      if (dependency.kind === "auren" && !ids.has(dependency.id)) {
        errors.push(
          `${element.id}: missing internal Auren dependency ${JSON.stringify(dependency.id)}`,
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new RegistryBuildError(
      "source catalog dependency validation failed",
      errors,
    );
  }

  const states = new Map();
  const elementsById = new Map(
    elements.map(({ element }) => [element.id, element]),
  );
  const reportedCycles = new Set();

  function visit(id, stack) {
    const state = states.get(id);

    if (state === "visiting") {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id].join(" -> ");
      if (!reportedCycles.has(cycle)) {
        reportedCycles.add(cycle);
      }
      return;
    }

    if (state === "visited") {
      return;
    }

    states.set(id, "visiting");
    const element = elementsById.get(id);
    const dependencies = element.dependencies
      .filter((dependency) => dependency.kind === "auren")
      .map((dependency) => dependency.id)
      .sort(compareStrings);

    for (const dependencyId of dependencies) {
      visit(dependencyId, [...stack, id]);
    }

    states.set(id, "visited");
  }

  for (const id of [...elementsById.keys()].sort(compareStrings)) {
    visit(id, []);
  }

  if (reportedCycles.size > 0) {
    throw new RegistryBuildError(
      "source catalog dependency validation failed",
      [...reportedCycles]
        .sort(compareStrings)
        .map((cycle) => `internal Auren dependency cycle: ${cycle}`),
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
    throw new RegistryBuildError(
      "unable to load the built public @auren/schemas/catalog entrypoint; run pnpm --filter @auren/schemas build first",
      [error.message],
    );
  }
}

function assertSchema(schema, value, label) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new RegistryBuildError(
      `${label} failed @auren/schemas/catalog validation`,
      formatSchemaIssues(result.error.issues),
    );
  }
}

function assertNoInstallationFields(element, label) {
  for (const field of ["target", "content"]) {
    if (Object.hasOwn(element, field)) {
      throw new RegistryBuildError(
        `${label} contains a forbidden ${field} field`,
      );
    }
  }

  for (const file of element.files ?? []) {
    if (Object.hasOwn(file, "target")) {
      throw new RegistryBuildError(
        `${label} contains a forbidden file target`,
        [`${element.id}: ${file.path}`],
      );
    }

    if (label.includes("index") && Object.hasOwn(file, "content")) {
      throw new RegistryBuildError(
        `${label} contains a forbidden file content field`,
        [`${element.id}: ${file.path}`],
      );
    }
  }
}

function decodeUtf8(bytes, sourcePath) {
  const content = bytes.toString("utf8");

  if (!Buffer.from(content, "utf8").equals(bytes)) {
    throw new RegistryBuildError(
      `text payload is not valid UTF-8: ${displayPath(sourcePath)}`,
    );
  }

  return content;
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

function sameJsonValue(left, right) {
  return (
    JSON.stringify(sortJsonValue(left)) === JSON.stringify(sortJsonValue(right))
  );
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
