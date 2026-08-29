import path from "node:path";
import { fileURLToPath } from "node:url";
import { RegistryPublishError } from "./errors.mjs";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const defaultRegistryRoot = path.resolve(projectRoot, "dist/registry");
export const defaultOutputRoot = path.resolve(
  projectRoot,
  "dist/public-registry",
);

export function parsePublishArguments(argumentsList) {
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

    if (argument === "--registry-root" || argument === "--output-root") {
      const value = argumentsList[index + 1];

      if (!value || value.startsWith("--")) {
        throw new RegistryPublishError(`${argument} requires a directory path`);
      }

      options[argument === "--registry-root" ? "registryRoot" : "outputRoot"] =
        value;
      index += 1;
      continue;
    }

    throw new RegistryPublishError(`unknown argument ${argument}`);
  }

  return options;
}

export function resolvePublishRoots(options = {}) {
  return {
    registryRoot: path.resolve(options.registryRoot ?? defaultRegistryRoot),
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
