import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedBlockCategories } from "./verify-workspace.mjs";
import { verifyBlockTree } from "./verify-blocks/tree.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultBlocksRoot = path.resolve(scriptsDirectory, "../blocks");

function validateDuplicateIds(idClaims, errors) {
  const claimsById = new Map();

  for (const { id, location } of idClaims) {
    const claims = claimsById.get(id) ?? new Set();
    claims.add(location);
    claimsById.set(id, claims);
  }

  for (const [id, claims] of [...claimsById.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const locations = [...claims].sort();

    if (locations.length < 2) {
      continue;
    }

    for (const location of locations) {
      const otherLocations = locations
        .filter((candidate) => candidate !== location)
        .join(", ");
      errors.add(
        `${location}: block id ${JSON.stringify(id)} is duplicated at ${otherLocations}`,
      );
    }
  }
}

export function verifyBlocks({
  blocksRoot = defaultBlocksRoot,
  categoryRoots = expectedBlockCategories,
} = {}) {
  const treeResult = verifyBlockTree({ blocksRoot, categoryRoots });
  const errors = new Set(treeResult.errors);

  validateDuplicateIds(treeResult.idClaims, errors);

  return {
    blockCount: treeResult.blockCount,
    categoryCount: treeResult.categoryCount,
    errors: [...errors].sort(),
  };
}

function parseArguments(argumentsList) {
  const options = {};

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--blocks-root") {
      const blocksRoot = argumentsList[index + 1];

      if (!blocksRoot) {
        throw new Error("--blocks-root requires a directory path");
      }

      options.blocksRoot = blocksRoot;
      index += 1;
      continue;
    }

    if (argument === "--categories") {
      const categories = argumentsList[index + 1];

      if (!categories) {
        throw new Error("--categories requires a comma-separated list");
      }

      options.categoryRoots = categories.split(",").filter(Boolean);
      index += 1;
      continue;
    }

    throw new Error(`unknown argument ${argument}`);
  }

  return options;
}

function run() {
  let options;

  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(`Block verification failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const result = verifyBlocks(options);

  if (result.errors.length > 0) {
    console.error("Block verification failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    console.error(
      "Fix the reported block path or manifest and run pnpm check again.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Block source verification passed.");
  console.log(
    `- ${result.categoryCount} category roots scanned outside the workspace`,
  );
  console.log(`- ${result.blockCount} block source directories verified`);
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  run();
}
