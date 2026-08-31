#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryBuildError } from "./registry-build/errors.mjs";
import {
  defaultBlocksRoot,
  defaultCollectionsRoot,
  defaultOutputRoot,
  parseBuildArguments,
} from "./registry-build/paths.mjs";

export async function main(argumentsList = process.argv.slice(2)) {
  let options;

  try {
    options = parseBuildArguments(argumentsList);
  } catch (error) {
    reportFailure(error);
    return false;
  }

  if (options.help) {
    printHelp();
    return true;
  }

  try {
    const { buildRegistry } = await import("./registry-build/builder.mjs");
    const result = await buildRegistry(options);
    const displayOutput = result.outputRoot.startsWith(`${process.cwd()}/`)
      ? result.outputRoot.slice(process.cwd().length + 1)
      : result.outputRoot;

    console.log(
      `Registry build completed: ${result.blockCount} blocks and ${result.collectionCount} collections written to ${displayOutput}`,
    );
    return true;
  } catch (error) {
    reportFailure(error);
    return false;
  }
}

function reportFailure(error) {
  if (error instanceof RegistryBuildError) {
    console.error(`Registry build failed: ${error.message}`);

    for (const detail of error.details) {
      console.error(`- ${detail}`);
    }

    return;
  }

  console.error(`Registry build failed: ${error.message}`);
}

function printHelp() {
  console.log(`Usage: node scripts/build-registry.mjs [options]

Options:
  --blocks-root <path>       Source catalog root (default: ${defaultBlocksRoot})
  --collections-root <path> Collection source root (default: ${defaultCollectionsRoot})
  --output-root <path>       Generated Registry root (default: ${defaultOutputRoot})
  -h, --help                 Show this help`);
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().then((success) => {
    if (!success) {
      process.exitCode = 1;
    }
  });
}
