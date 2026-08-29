import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { catalogElementSchema } from "@auren/schemas/catalog";
import { formatIssuePath, isSafeRelativePosixPath, toPosix } from "./rules.mjs";

function isPlainRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateBlockManifest({
  blockRoot,
  blockPath,
  category,
  type,
  id,
  actualFiles,
}) {
  const errors = [];
  const idClaims = [];
  const registryPath = path.join(blockRoot, "registry.json");
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(registryPath, "utf8"));
  } catch (error) {
    errors.push(`${blockPath}/registry.json: invalid JSON (${error.message})`);
    return { errors, idClaims };
  }

  const schemaResult = catalogElementSchema.safeParse(manifest);

  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      errors.push(
        `${blockPath}/registry.json: schema issue at ${formatIssuePath(issue.path)}: ${issue.message}`,
      );
    }
  }

  if (!isPlainRecord(manifest)) {
    return { errors, idClaims };
  }

  if (typeof manifest.id === "string") {
    idClaims.push({ id: manifest.id, location: blockPath });
  }

  for (const [field, expected] of [
    ["category", category],
    ["type", type],
    ["id", id],
  ]) {
    if (manifest[field] !== expected) {
      errors.push(
        `${blockPath}/registry.json: ${field} must match path segment ${JSON.stringify(expected)}, got ${JSON.stringify(manifest[field])}`,
      );
    }
  }

  if (Array.isArray(manifest.features)) {
    for (const requiredFeature of ["mobile-first", "responsive"]) {
      if (!manifest.features.includes(requiredFeature)) {
        errors.push(
          `${blockPath}/registry.json: features must include ${JSON.stringify(requiredFeature)}`,
        );
      }
    }
  }

  for (const field of ["target", "content"]) {
    if (Object.hasOwn(manifest, field)) {
      errors.push(
        `${blockPath}/registry.json: source manifests must omit ${JSON.stringify(field)}`,
      );
    }
  }

  if (!Array.isArray(manifest.files)) {
    return { errors, idClaims };
  }

  const descriptorPaths = new Set();

  for (const [index, descriptor] of manifest.files.entries()) {
    if (!isPlainRecord(descriptor)) {
      continue;
    }

    for (const field of ["target", "content"]) {
      if (Object.hasOwn(descriptor, field)) {
        errors.push(
          `${blockPath}/registry.json files[${index}].${field}: source descriptors must omit ${JSON.stringify(field)}`,
        );
      }
    }

    if (typeof descriptor.path !== "string") {
      continue;
    }

    const descriptorPath = descriptor.path;

    if (descriptorPaths.has(descriptorPath)) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: duplicate descriptor path ${JSON.stringify(descriptorPath)}`,
      );
    }
    descriptorPaths.add(descriptorPath);

    if (descriptorPath === "registry.json") {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: registry.json is the source manifest and must not be listed as payload`,
      );
    }

    if (!isSafeRelativePosixPath(descriptorPath)) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} is not a safe relative POSIX path`,
      );
      continue;
    }

    const descriptorAbsolutePath = path.resolve(
      blockRoot,
      ...descriptorPath.split("/"),
    );
    const relativeToBlock = path.relative(blockRoot, descriptorAbsolutePath);

    if (
      path.isAbsolute(relativeToBlock) ||
      relativeToBlock === ".." ||
      relativeToBlock.startsWith(`..${path.sep}`)
    ) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} escapes the block directory`,
      );
      continue;
    }

    let descriptorStat;

    try {
      descriptorStat = lstatSync(descriptorAbsolutePath);
    } catch {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} does not resolve to a regular payload file`,
      );
      continue;
    }

    if (!descriptorStat.isFile()) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} does not resolve to a regular payload file`,
      );
    }

    const actualFile = actualFiles.get(
      toPosix(path.relative(blockRoot, descriptorAbsolutePath)),
    );

    if (!actualFile) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} is not a recognized payload file`,
      );
      continue;
    }

    if (actualFile.kind === null) {
      errors.push(
        `${blockPath}/registry.json files[${index}].path: ${JSON.stringify(descriptorPath)} is outside the allowed source inventory`,
      );
    } else if (descriptor.kind !== actualFile.kind) {
      errors.push(
        `${blockPath}/registry.json files[${index}].kind: ${JSON.stringify(descriptorPath)} must use kind ${JSON.stringify(actualFile.kind)}`,
      );
    }
  }

  if (!descriptorPaths.has("component.tsx")) {
    errors.push(
      `${blockPath}/registry.json: files must declare root component.tsx with kind component`,
    );
  } else {
    const componentDescriptor = manifest.files.find(
      (descriptor) =>
        isPlainRecord(descriptor) && descriptor.path === "component.tsx",
    );

    if (componentDescriptor?.kind !== "component") {
      errors.push(
        `${blockPath}/registry.json: root component.tsx must use kind component`,
      );
    }
  }

  for (const relativePath of actualFiles.keys()) {
    if (!descriptorPaths.has(relativePath)) {
      errors.push(
        `${blockPath}/registry.json: payload file ${JSON.stringify(relativePath)} is not declared in files`,
      );
    }
  }

  validateShadcnContract({
    blockRoot,
    blockPath,
    manifest,
    actualFiles,
    descriptorPaths,
    errors,
  });

  return { errors, idClaims };
}

function validateShadcnContract({
  blockRoot,
  blockPath,
  manifest,
  actualFiles,
  descriptorPaths,
  errors,
}) {
  const shadcnDependencies = Array.isArray(manifest.dependencies)
    ? manifest.dependencies.filter(
        (dependency) =>
          isPlainRecord(dependency) && dependency.kind === "shadcn",
      )
    : [];
  const declaredNames = new Set(
    shadcnDependencies
      .filter((dependency) => typeof dependency.name === "string")
      .map((dependency) => dependency.name),
  );
  const importedNames = new Set();

  for (const relativePath of actualFiles.keys()) {
    if (!/\.(?:tsx|ts)$/.test(relativePath)) {
      continue;
    }

    let source;

    try {
      source = readFileSync(
        path.join(blockRoot, ...relativePath.split("/")),
        "utf8",
      );
    } catch {
      continue;
    }

    for (const specifier of findModuleSpecifiers(source)) {
      if (specifier.startsWith("@/components/ui/")) {
        const match = /^@\/components\/ui\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(
          specifier,
        );

        if (!match) {
          errors.push(
            `${blockPath}/${relativePath}: shadcn imports must use the canonical @/components/ui/<name> module path, got ${JSON.stringify(specifier)}`,
          );
          continue;
        }

        const name = match[1];
        importedNames.add(name);

        if (!declaredNames.has(name)) {
          errors.push(
            `${blockPath}/${relativePath}: shadcn component ${JSON.stringify(name)} must be declared with a matching shadcn dependency`,
          );
        }
      } else if (specifier.startsWith("@/registry/")) {
        errors.push(
          `${blockPath}/${relativePath}: custom shadcn registry imports are not portable: ${JSON.stringify(specifier)}`,
        );
      }
    }
  }

  for (const relativePath of descriptorPaths) {
    if (
      relativePath === "components/ui" ||
      relativePath.startsWith("components/ui/")
    ) {
      errors.push(
        `${blockPath}/registry.json: copied shadcn source is not allowed at ${JSON.stringify(relativePath)}; declare a shadcn dependency instead`,
      );
    }
  }

  for (const name of declaredNames) {
    if (!importedNames.has(name)) {
      errors.push(
        `${blockPath}/registry.json: shadcn dependency ${JSON.stringify(name)} is not used by a canonical @/components/ui/${name} import`,
      );
    }
  }
}

function findModuleSpecifiers(source) {
  const specifiers = [];

  for (let index = 0; index < source.length; ) {
    const current = source[index];

    if (current === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index + 2);
      continue;
    }

    if (current === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index + 2);
      continue;
    }

    if (current === '"' || current === "'" || current === "`") {
      index = skipString(source, index, current);
      continue;
    }

    if (isIdentifierStart(current)) {
      const start = index;
      index += 1;

      while (index < source.length && isIdentifierPart(source[index])) {
        index += 1;
      }

      const token = source.slice(start, index);

      if (token !== "from" && token !== "import" && token !== "require") {
        continue;
      }

      let argumentIndex = skipWhitespace(source, index);

      if (token === "from") {
        // `from` is the module boundary for import and export declarations.
      } else if (token === "import") {
        if (source[argumentIndex] === "(") {
          argumentIndex = skipWhitespace(source, argumentIndex + 1);
        } else if (
          source[argumentIndex] !== '"' &&
          source[argumentIndex] !== "'"
        ) {
          continue;
        }
      } else {
        if (source[argumentIndex] !== "(") {
          continue;
        }
        argumentIndex = skipWhitespace(source, argumentIndex + 1);
      }

      const quote = source[argumentIndex];

      if (quote !== '"' && quote !== "'") {
        continue;
      }

      const result = readString(source, argumentIndex, quote);

      if (result !== null) {
        specifiers.push(result.value);
        index = result.end;
      }
    } else {
      index += 1;
    }
  }

  return specifiers;
}

function skipWhitespace(source, index) {
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  return index;
}

function skipLineComment(source, index) {
  while (index < source.length && source[index] !== "\n") {
    index += 1;
  }

  return index;
}

function skipBlockComment(source, index) {
  const end = source.indexOf("*/", index);
  return end === -1 ? source.length : end + 2;
}

function skipString(source, index, quote) {
  const result = readString(source, index, quote);
  return result === null ? source.length : result.end;
}

function readString(source, index, quote) {
  let value = "";

  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const current = source[cursor];

    if (current === "\\") {
      value += current;
      const escaped = source[cursor + 1];
      if (escaped !== undefined) {
        value += escaped;
        cursor += 1;
      }
      continue;
    }

    if (current === quote) {
      return { value, end: cursor + 1 };
    }

    value += current;
  }

  return null;
}

function isIdentifierStart(value) {
  return value !== undefined && /[A-Za-z_$]/.test(value);
}

function isIdentifierPart(value) {
  return value !== undefined && /[A-Za-z0-9_$]/.test(value);
}
