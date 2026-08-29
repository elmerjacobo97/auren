import { lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { validateBlockManifest } from "./manifest.mjs";
import {
  assetFilenamePattern,
  blockIdPattern,
  classifyPayloadFile,
  expectedExtensionDescription,
  isKebabCase,
  normalizeCategoryName,
  payloadDirectories,
  relativeToRoot,
  toPosix,
} from "./rules.mjs";

function readSortedEntries(directory, errors, displayPath) {
  try {
    return readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  } catch (error) {
    errors.push(`${displayPath}: cannot read directory (${error.message})`);
    return [];
  }
}

function addActualFile(files, blockRoot, filePath, kind) {
  files.set(toPosix(path.relative(blockRoot, filePath)), { kind });
}

function scanPayloadDirectory({
  blockRoot,
  blockPath,
  directoryName,
  directory,
  files,
}) {
  const errors = [];
  const entries = readSortedEntries(
    directory,
    errors,
    `${blockPath}/${directoryName}`,
  );

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    const relativePath = `${blockPath}/${relativeToRoot(blockRoot, entryPath)}`;

    if (entry.isDirectory()) {
      if (directoryName === "assets" && !isKebabCase(entry.name)) {
        errors.push(
          `${relativePath}: asset directory segments must use lowercase kebab-case`,
        );
      }

      const nestedResult = scanPayloadDirectory({
        blockRoot,
        blockPath,
        directoryName,
        directory: entryPath,
        files,
      });
      errors.push(...nestedResult.errors);
      continue;
    }

    if (!entry.isFile()) {
      errors.push(
        `${relativePath}: source entries must be regular files or directories`,
      );
      continue;
    }

    const kind = classifyPayloadFile(directoryName, entry.name);
    addActualFile(files, blockRoot, entryPath, kind);

    if (directoryName === "assets" && !assetFilenamePattern.test(entry.name)) {
      errors.push(
        `${relativePath}: asset filenames must use one lowercase kebab-case stem and one lowercase alphanumeric extension`,
      );
    } else if (kind === null) {
      errors.push(
        `${relativePath}: unexpected source file; ${directoryName}/ accepts ${expectedExtensionDescription(directoryName)}`,
      );
    }
  }

  return { errors };
}

function validateBlockDirectory({
  blocksRoot,
  category,
  type,
  id,
  blockRoot,
  inventory,
}) {
  const errors = [];
  const idClaims = [{ id, location: `${category}/${type}/${id}` }];
  const blockPath = `${category}/${type}/${id}`;
  const idMatch = blockIdPattern.exec(id);

  if (!idMatch || idMatch[1] !== type || Number(idMatch[2]) < 1) {
    errors.push(
      `${blockPath}: block id must match ${type}-NNN with NNN between 001 and 999`,
    );
  }

  const entries = readSortedEntries(blockRoot, errors, blockPath);
  const actualFiles = new Map();
  const rootFileNames = new Set();

  for (const entry of entries) {
    const entryPath = path.join(blockRoot, entry.name);
    const relativePath = relativeToRoot(blocksRoot, entryPath);

    if (entry.isFile()) {
      rootFileNames.add(entry.name);

      if (entry.name === "component.tsx") {
        addActualFile(actualFiles, blockRoot, entryPath, "component");
      } else if (entry.name !== "registry.json") {
        addActualFile(actualFiles, blockRoot, entryPath, null);
        errors.push(
          `${relativePath}: unexpected source file; only component.tsx or designated payload directories are allowed at the block root`,
        );
      }

      continue;
    }

    if (entry.isDirectory() && payloadDirectories.has(entry.name)) {
      const payloadResult = scanPayloadDirectory({
        blockRoot,
        blockPath,
        directoryName: entry.name,
        directory: entryPath,
        files: actualFiles,
      });
      errors.push(...payloadResult.errors);
      continue;
    }

    errors.push(
      `${relativePath}: unexpected source entry; use component.tsx, registry.json, components, utilities, styles, or assets`,
    );
  }

  if (!rootFileNames.has("component.tsx")) {
    errors.push(`${blockPath}: required root file component.tsx is missing`);
  }

  if (!rootFileNames.has("registry.json")) {
    errors.push(`${blockPath}: required root file registry.json is missing`);
    return { errors, idClaims };
  }

  const manifestResult = validateBlockManifest({
    blockRoot,
    blockPath,
    category,
    type,
    id,
    actualFiles,
  });

  errors.push(...manifestResult.errors);
  idClaims.push(...manifestResult.idClaims);

  inventory?.push({
    blockRoot,
    category,
    type,
    id,
    actualFiles: new Map(actualFiles),
  });

  return { errors, idClaims };
}

function scanTypeDirectory({
  blocksRoot,
  category,
  type,
  typeRoot,
  inventory,
}) {
  const errors = [];
  const idClaims = [];
  const typePath = `${category}/${type}`;
  let blockCount = 0;

  if (!isKebabCase(type)) {
    errors.push(`${typePath}: type directory must use lowercase kebab-case`);
  }

  const entries = readSortedEntries(typeRoot, errors, typePath);

  for (const entry of entries) {
    const entryPath = path.join(typeRoot, entry.name);

    if (!entry.isDirectory()) {
      errors.push(
        `${relativeToRoot(blocksRoot, entryPath)}: type directories may contain only block directories`,
      );
      continue;
    }

    blockCount += 1;
    const blockResult = validateBlockDirectory({
      blocksRoot,
      category,
      type,
      id: entry.name,
      blockRoot: entryPath,
      inventory,
    });
    errors.push(...blockResult.errors);
    idClaims.push(...blockResult.idClaims);
  }

  if (blockCount === 0) {
    errors.push(
      `${typePath}: type directory must contain at least one block directory`,
    );
  }

  return { errors, idClaims, blockCount };
}

function scanCategoryDirectory({
  blocksRoot,
  category,
  categoryRoot,
  inventory,
}) {
  const errors = [];
  const idClaims = [];
  let blockCount = 0;
  const entries = readSortedEntries(categoryRoot, errors, category);

  for (const entry of entries) {
    const entryPath = path.join(categoryRoot, entry.name);

    if (entry.name === ".gitkeep") {
      if (!entry.isFile()) {
        errors.push(
          `${relativeToRoot(blocksRoot, entryPath)}: category marker must be a regular file`,
        );
      }
      continue;
    }

    if (!entry.isDirectory()) {
      errors.push(
        `${relativeToRoot(blocksRoot, entryPath)}: category roots may contain only type directories or .gitkeep`,
      );
      continue;
    }

    const typeResult = scanTypeDirectory({
      blocksRoot,
      category,
      type: entry.name,
      typeRoot: entryPath,
      inventory,
    });
    errors.push(...typeResult.errors);
    idClaims.push(...typeResult.idClaims);
    blockCount += typeResult.blockCount;
  }

  return { errors, idClaims, blockCount };
}

function scanPackageManifests(directory, blocksRoot) {
  const errors = [];
  const entries = readSortedEntries(
    directory,
    errors,
    relativeToRoot(blocksRoot, directory) || ".",
  );

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.name === "package.json" && entry.isFile()) {
      errors.push(
        `${relativeToRoot(blocksRoot, entryPath)}: blocks must not contain package manifests`,
      );
    }

    if (entry.isDirectory()) {
      const nestedResult = scanPackageManifests(entryPath, blocksRoot);
      errors.push(...nestedResult);
    }
  }

  return errors;
}

export function verifyBlockTree({
  blocksRoot,
  categoryRoots,
  inventory = null,
}) {
  const resolvedBlocksRoot = path.resolve(blocksRoot);
  const errors = [];
  const idClaims = [];
  const categories = categoryRoots.map(normalizeCategoryName);
  let blockCount = 0;
  let rootStat;

  try {
    rootStat = lstatSync(resolvedBlocksRoot);
  } catch {
    return {
      blockCount,
      categoryCount: categories.length,
      errors: ["blocks: required catalog root is missing"],
      idClaims,
    };
  }

  if (!rootStat.isDirectory()) {
    return {
      blockCount,
      categoryCount: categories.length,
      errors: ["blocks: required catalog root must be a directory"],
      idClaims,
    };
  }

  const categorySet = new Set(categories);
  const rootEntries = readSortedEntries(resolvedBlocksRoot, errors, "blocks");

  for (const entry of rootEntries) {
    const entryPath = path.join(resolvedBlocksRoot, entry.name);

    if (categorySet.has(entry.name)) {
      if (!entry.isDirectory()) {
        errors.push(
          `${relativeToRoot(resolvedBlocksRoot, entryPath)}: expected a category directory`,
        );
      }
      continue;
    }

    if (entry.name === "README.md" && entry.isFile()) {
      continue;
    }

    if (entry.isDirectory()) {
      errors.push(
        `${relativeToRoot(resolvedBlocksRoot, entryPath)}: unlisted category directory`,
      );
    } else {
      errors.push(
        `${relativeToRoot(resolvedBlocksRoot, entryPath)}: unexpected entry under blocks`,
      );
    }
  }

  for (const category of categories) {
    const categoryRoot = path.join(resolvedBlocksRoot, category);
    let categoryStat;

    try {
      categoryStat = lstatSync(categoryRoot);
    } catch {
      errors.push(`${category}: required category directory is missing`);
      continue;
    }

    if (!categoryStat.isDirectory()) {
      errors.push(`${category}: expected a category directory`);
      continue;
    }

    const categoryResult = scanCategoryDirectory({
      blocksRoot: resolvedBlocksRoot,
      category,
      categoryRoot,
      inventory,
    });
    errors.push(...categoryResult.errors);
    idClaims.push(...categoryResult.idClaims);
    blockCount += categoryResult.blockCount;
  }

  errors.push(...scanPackageManifests(resolvedBlocksRoot, resolvedBlocksRoot));

  return {
    blockCount,
    categoryCount: categories.length,
    errors,
    idClaims,
  };
}
