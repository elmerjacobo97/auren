import path from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryBuildError } from "./errors.mjs";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const defaultBlocksRoot = path.resolve(projectRoot, "blocks");
export const defaultCollectionsRoot = path.resolve(projectRoot, "collections");
export const defaultOutputRoot = path.resolve(projectRoot, "dist/registry");

export function parseBuildArguments(argumentsList) {
  const options = {};

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === "--") {
      continue;
    }

    if (argument === "--help" || argument === "-h") {
      options.help = true;
      continue;
    }

    if (
      argument === "--blocks-root" ||
      argument === "--collections-root" ||
      argument === "--output-root"
    ) {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new RegistryBuildError(`${argument} requires a directory path`);
      }

      const optionName =
        argument === "--blocks-root"
          ? "blocksRoot"
          : argument === "--collections-root"
            ? "collectionsRoot"
            : "outputRoot";
      options[optionName] = value;
      index += 1;
      continue;
    }

    throw new RegistryBuildError(`unknown argument ${argument}`);
  }

  return options;
}

export function resolveBuildRoots(options = {}) {
  const blocksRoot = path.resolve(options.blocksRoot ?? defaultBlocksRoot);

  return {
    blocksRoot,
    collectionsRoot: path.resolve(
      options.collectionsRoot ??
        (options.blocksRoot === undefined
          ? defaultCollectionsRoot
          : path.join(path.dirname(blocksRoot), "collections")),
    ),
    outputRoot: path.resolve(options.outputRoot ?? defaultOutputRoot),
  };
}

export function pathsOverlap(left, right) {
  return isPathWithin(left, right) || isPathWithin(right, left);
}

function isPathWithin(parent, child) {
  const relative = path.relative(parent, child);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
