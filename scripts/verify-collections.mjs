import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectionSchema } from "@auren/schemas/collection";
import { expectedBlockCategories } from "./verify-workspace.mjs";
import { verifyBlocks } from "./verify-blocks.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultCollectionsRoot = path.resolve(
  scriptsDirectory,
  "../collections",
);
const defaultBlocksRoot = path.resolve(scriptsDirectory, "../blocks");

/**
 * Verify the metadata-only Collection source tree and its references to blocks.
 * A missing root is treated as an empty optional catalog so temporary block-only
 * build fixtures remain compatible with the Registry Build API.
 */
export function verifyCollections({
  collectionsRoot = defaultCollectionsRoot,
  blocksRoot = defaultBlocksRoot,
  categoryRoots = expectedBlockCategories,
  blocks,
  includeInventory = false,
} = {}) {
  const resolvedCollectionsRoot = path.resolve(collectionsRoot);
  const categories = categoryRoots.map((category) => String(category));
  const errors = new Set();
  let blockCatalog = normalizeBlockCatalog(blocks);

  if (blockCatalog === null) {
    const blockVerification = verifyBlocks({
      blocksRoot,
      categoryRoots,
      includeInventory: true,
    });
    for (const error of blockVerification.errors) {
      errors.add(error);
    }
    blockCatalog = loadBlockCatalog(blockVerification.blocks ?? []);
  }

  const treeResult = scanCollectionTree({
    collectionsRoot: resolvedCollectionsRoot,
    categories,
    blockCatalog,
    includeInventory,
  });

  for (const error of treeResult.errors) {
    errors.add(error);
  }

  const result = {
    collectionCount: treeResult.collectionCount,
    categoryCount: treeResult.categoryCount,
    errors: [...errors].sort(compareStrings),
  };

  if (includeInventory) {
    result.collections = treeResult.collections;
  }

  return result;
}

export function loadCollectionSource({
  collectionsRoot = defaultCollectionsRoot,
  categoryRoots = expectedBlockCategories,
  blocks,
} = {}) {
  const result = verifyCollections({
    collectionsRoot,
    categoryRoots,
    blocks,
    includeInventory: true,
  });

  return result;
}

function scanCollectionTree({
  collectionsRoot,
  categories,
  blockCatalog,
  includeInventory,
}) {
  const errors = [];
  const idClaims = [];
  const collections = [];
  let collectionCount = 0;
  let rootStat;

  try {
    rootStat = lstatSync(collectionsRoot);
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        collectionCount,
        categoryCount: categories.length,
        errors,
        collections,
      };
    }

    return {
      collectionCount,
      categoryCount: categories.length,
      errors: [
        `collections: cannot inspect required source root ${displayPath(collectionsRoot)} (${error.message})`,
      ],
      collections,
    };
  }

  if (!rootStat.isDirectory()) {
    return {
      collectionCount,
      categoryCount: categories.length,
      errors: [
        `collections: required source root must be a directory: ${displayPath(collectionsRoot)}`,
      ],
      collections,
    };
  }

  const categorySet = new Set(categories);
  const rootEntries = readSortedEntries(collectionsRoot, errors, "collections");

  for (const entry of rootEntries) {
    const entryPath = path.join(collectionsRoot, entry.name);

    if (categorySet.has(entry.name)) {
      if (!entry.isDirectory()) {
        errors.push(
          `${relativeToRoot(collectionsRoot, entryPath)}: expected a category directory`,
        );
      }
      continue;
    }

    if (
      (entry.name === "README.md" || entry.name === ".gitkeep") &&
      entry.isFile()
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      errors.push(
        `${relativeToRoot(collectionsRoot, entryPath)}: unlisted collection category directory`,
      );
    } else {
      errors.push(
        `${relativeToRoot(collectionsRoot, entryPath)}: unexpected entry under collections`,
      );
    }
  }

  for (const category of categories) {
    const categoryRoot = path.join(collectionsRoot, category);
    let categoryStat;

    try {
      categoryStat = lstatSync(categoryRoot);
    } catch (error) {
      if (error.code === "ENOENT") {
        continue;
      }

      errors.push(
        `${category}: cannot inspect collection category (${error.message})`,
      );
      continue;
    }

    if (!categoryStat.isDirectory()) {
      errors.push(`${category}: expected a collection category directory`);
      continue;
    }

    const categoryEntries = readSortedEntries(
      categoryRoot,
      errors,
      `collections/${category}`,
    );

    for (const entry of categoryEntries) {
      const collectionPath = path.join(categoryRoot, entry.name);

      if (entry.name === ".gitkeep" && entry.isFile()) {
        continue;
      }

      if (!entry.isDirectory()) {
        errors.push(
          `${relativeToRoot(collectionsRoot, collectionPath)}: collection categories may contain only collection directories or .gitkeep`,
        );
        continue;
      }

      collectionCount += 1;
      const location = `collections/${category}/${entry.name}`;
      const collectionResult = readCollectionManifest({
        collectionsRoot,
        category,
        id: entry.name,
        collectionRoot: collectionPath,
        location,
        blockCatalog,
      });
      errors.push(...collectionResult.errors);
      idClaims.push(...collectionResult.idClaims);

      if (collectionResult.collection && includeInventory) {
        collections.push(collectionResult.collection);
      }
    }
  }

  validateDuplicateIds(idClaims, errors);

  if (includeInventory) {
    collections.sort((left, right) =>
      compareStrings(left.collection.id, right.collection.id),
    );
  }

  return {
    collectionCount,
    categoryCount: categories.length,
    errors,
    collections,
  };
}

function readCollectionManifest({
  collectionsRoot,
  category,
  id,
  collectionRoot,
  location,
  blockCatalog,
}) {
  const errors = [];
  const idClaims = [{ id, location }];
  const entries = readSortedEntries(collectionRoot, errors, location);
  const registryEntry = entries.find((entry) => entry.name === "registry.json");

  for (const entry of entries) {
    if (entry.name === "registry.json" && entry.isFile()) {
      continue;
    }

    errors.push(
      `${relativeToRoot(collectionsRoot, path.join(collectionRoot, entry.name))}: collection directories may contain only registry.json`,
    );
  }

  if (registryEntry === undefined) {
    errors.push(`${location}: required registry.json is missing`);
    return { errors, idClaims, collection: null };
  }

  const registryPath = path.join(collectionRoot, "registry.json");
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    errors.push(
      `${relativeToRoot(collectionsRoot, registryPath)}: invalid JSON (${error.message})`,
    );
    return { errors, idClaims, collection: null };
  }

  const schemaResult = collectionSchema.safeParse(manifest);

  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push(
        `${relativeToRoot(collectionsRoot, registryPath)}: schema issue at ${formatIssuePath(issue.path)}: ${issue.message}`,
      );
    }
  }

  if (!isRecord(manifest)) {
    return { errors, idClaims, collection: null };
  }

  if (typeof manifest.id === "string") {
    idClaims.push({ id: manifest.id, location });
  }

  for (const [field, expected] of [
    ["category", category],
    ["id", id],
  ]) {
    if (manifest[field] !== expected) {
      errors.push(
        `${relativeToRoot(collectionsRoot, registryPath)}: ${field} must match path segment ${JSON.stringify(expected)}, got ${JSON.stringify(manifest[field])}`,
      );
    }
  }

  if (!schemaResult.success) {
    return { errors, idClaims, collection: null };
  }

  for (const blockId of schemaResult.data.blocks) {
    const block = blockCatalog.get(blockId);

    if (block === undefined) {
      errors.push(
        `${location}: references missing block ${JSON.stringify(blockId)}`,
      );
      continue;
    }

    for (const framework of schemaResult.data.frameworks) {
      if (!block.frameworks.includes(framework)) {
        errors.push(
          `${location}: framework ${JSON.stringify(framework)} is unsupported by member block ${JSON.stringify(blockId)}`,
        );
      }
    }
  }

  return {
    errors,
    idClaims,
    collection: {
      collectionRoot,
      collection: schemaResult.data,
    },
  };
}

function normalizeBlockCatalog(blocks) {
  if (blocks === undefined) {
    return null;
  }

  const catalog = new Map();

  for (const block of blocks) {
    const element = block?.element ?? block;

    if (
      element &&
      typeof element.id === "string" &&
      Array.isArray(element.frameworks)
    ) {
      catalog.set(element.id, {
        id: element.id,
        frameworks: element.frameworks,
      });
    }
  }

  return catalog;
}

function loadBlockCatalog(blocks) {
  const catalog = new Map();

  for (const block of blocks) {
    let manifest;

    try {
      manifest = JSON.parse(
        readFileSync(path.join(block.blockRoot, "registry.json"), "utf8"),
      );
    } catch {
      continue;
    }

    if (
      manifest &&
      typeof manifest.id === "string" &&
      Array.isArray(manifest.frameworks)
    ) {
      catalog.set(manifest.id, {
        id: manifest.id,
        frameworks: manifest.frameworks,
      });
    }
  }

  return catalog;
}

function validateDuplicateIds(idClaims, errors) {
  const claimsById = new Map();

  for (const { id, location } of idClaims) {
    const claims = claimsById.get(id) ?? new Set();
    claims.add(location);
    claimsById.set(id, claims);
  }

  for (const [id, claims] of [...claimsById.entries()].sort(([left], [right]) =>
    compareStrings(left, right),
  )) {
    const locations = [...claims].sort(compareStrings);

    if (locations.length < 2) {
      continue;
    }

    errors.push(
      `duplicate collection id ${JSON.stringify(id)} at ${locations.join(", ")}`,
    );
  }
}

function readSortedEntries(directory, errors, display) {
  try {
    return readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      compareStrings(left.name, right.name),
    );
  } catch (error) {
    errors.push(`${display}: cannot read directory (${error.message})`);
    return [];
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function relativeToRoot(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
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

function isMainModule() {
  return (
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  );
}

if (isMainModule()) {
  const result = verifyCollections();

  if (result.errors.length > 0) {
    console.error("Collection source verification failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error(
      "Fix the reported Collection path or manifest and run pnpm check again.",
    );
    process.exitCode = 1;
  } else {
    console.log("Collection source verification passed.");
    console.log(
      `- ${result.collectionCount} Collection source manifest(s) verified`,
    );
  }
}
