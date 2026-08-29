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

  return { errors, idClaims };
}
