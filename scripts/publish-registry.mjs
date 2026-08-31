#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryPublishError } from "./registry-publish/errors.mjs";
import {
  defaultOutputRoot,
  defaultRegistryRoot,
  parsePublishArguments,
} from "./registry-publish/paths.mjs";

export async function main(argumentsList = process.argv.slice(2)) {
  let options;

  try {
    options = parsePublishArguments(argumentsList);
  } catch (error) {
    reportFailure(error);
    return false;
  }

  if (options.help) {
    printHelp();
    return true;
  }

  try {
    const { publishRegistry } = await import(
      "./registry-publish/publisher.mjs"
    );
    const result = await publishRegistry(options);
    const displayOutput = result.outputRoot.startsWith(`${process.cwd()}/`)
      ? result.outputRoot.slice(process.cwd().length + 1)
      : result.outputRoot;

    process.stdout.write(
      `Public Registry publication completed: ${result.blockCount} blocks and ${result.collectionCount} collections written to ${displayOutput}\n`,
    );
    return true;
  } catch (error) {
    reportFailure(error);
    return false;
  }
}

function reportFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Public Registry publication failed: ${message}\n`);

  if (error instanceof RegistryPublishError) {
    for (const detail of error.details) {
      process.stderr.write(`- ${detail}\n`);
    }
  }
}

function printHelp() {
  process.stdout.write(`Usage: node scripts/publish-registry.mjs [options]

Options:
  --registry-root <path>  Generated Registry root (default: ${defaultRegistryRoot})
  --output-root <path>    Public Registry root (default: ${defaultOutputRoot})
  -h, --help              Show this help\n`);
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
