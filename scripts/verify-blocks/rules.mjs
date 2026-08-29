import path from "node:path";

export const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const blockIdPattern = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d{3})$/;
export const assetFilenamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+$/;
export const payloadDirectories = new Set([
  "components",
  "utilities",
  "styles",
  "assets",
]);

export function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

export function relativeToRoot(root, filePath) {
  return toPosix(path.relative(root, filePath));
}

export function isKebabCase(value) {
  return kebabCasePattern.test(value);
}

export function isSafeRelativePosixPath(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\u0000") ||
    /^[A-Za-z]:/.test(value)
  ) {
    return false;
  }

  return value
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}

export function classifyPayloadFile(directoryName, filename) {
  if (directoryName === "components" && filename.endsWith(".tsx")) {
    return "component";
  }

  if (
    directoryName === "utilities" &&
    (filename.endsWith(".ts") || filename.endsWith(".tsx"))
  ) {
    return "utility";
  }

  if (directoryName === "styles" && filename.endsWith(".css")) {
    return "style";
  }

  if (directoryName === "assets") {
    return "asset";
  }

  return null;
}

export function expectedExtensionDescription(directoryName) {
  if (directoryName === "components") {
    return ".tsx files";
  }

  if (directoryName === "utilities") {
    return ".ts or .tsx files";
  }

  if (directoryName === "styles") {
    return ".css files";
  }

  return "regular files with a valid asset filename";
}

export function formatIssuePath(issuePath) {
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

export function normalizeCategoryName(value) {
  const normalized = String(value).replaceAll("\\", "/");
  return normalized.split("/").at(-1);
}
