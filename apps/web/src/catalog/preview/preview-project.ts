import type { CatalogElement } from "@auren/schemas/catalog";

export interface PreviewFile {
  readonly code: string;
  readonly active?: boolean;
}

export interface PreviewProject {
  readonly entry: "/index.tsx";
  readonly files: Record<string, PreviewFile>;
  readonly dependencies: Record<string, string>;
}

export type PreviewUnavailableReason =
  | "unsupported-framework"
  | "missing-component"
  | "missing-content"
  | "unsupported-asset"
  | "unsupported-file"
  | "unresolved-dependency"
  | "unsupported-import"
  | "missing-export"
  | "required-props";

export type PreviewProjectResult =
  | { readonly status: "supported"; readonly project: PreviewProject }
  | {
      readonly status: "unsupported";
      readonly reason: PreviewUnavailableReason;
    };

const TAILWIND_VERSION = "4.3.3";
const BASELINE_PACKAGE_ROOTS = new Set(["react", "react-dom"]);
const textFileExtensions = {
  component: [".tsx"],
  utility: [".ts", ".tsx"],
  style: [".css"],
} as const;

export function createPreviewProject(
  block: CatalogElement,
): PreviewProjectResult {
  if (!block.frameworks.includes("react")) {
    return unsupported("unsupported-framework");
  }

  const component = block.files.find(
    (file) => file.path === "component.tsx" && file.kind === "component",
  );

  if (component === undefined) {
    return unsupported("missing-component");
  }

  const componentSource = component.content;

  if (typeof componentSource !== "string") {
    return unsupported("missing-content");
  }

  const packageDependencies = new Map<string, string>();
  for (const dependency of block.dependencies) {
    if (dependency.kind === "package") {
      packageDependencies.set(dependency.name, dependency.version);
    }
  }

  if (block.dependencies.some((dependency) => dependency.kind !== "package")) {
    return unsupported("unresolved-dependency");
  }

  const files: Record<string, PreviewFile> = {
    "/index.tsx": { code: createPreviewWrapper(), active: true },
    "/styles.css": {
      code: '@import "tailwindcss";',
    },
  };

  for (const file of block.files) {
    if (file.kind === "asset") {
      return unsupported("unsupported-asset");
    }

    if (typeof file.content !== "string") {
      return unsupported("missing-content");
    }

    const extension = extensionOf(file.path);
    const supportedExtensions = textFileExtensions[file.kind];

    if (!supportedExtensions.includes(extension as never)) {
      return unsupported("unsupported-file");
    }

    const sourcePath = `/src/${file.path}`;
    const importResult = inspectImports(
      file.content,
      file.path,
      block.files.map((candidate) => candidate.path),
      packageDependencies,
    );

    if (importResult !== null) {
      return unsupported(importResult);
    }

    files[sourcePath] = { code: file.content };
  }

  if (!hasRenderableExport(componentSource)) {
    return unsupported("missing-export");
  }

  const typeSource = block.files
    .map((file) => (typeof file.content === "string" ? file.content : ""))
    .join("\n");

  if (hasRequiredRuntimeProps(componentSource, typeSource)) {
    return unsupported("required-props");
  }

  const dependencies = Object.fromEntries(packageDependencies);
  dependencies.tailwindcss ??= TAILWIND_VERSION;

  return {
    status: "supported",
    project: { entry: "/index.tsx", files, dependencies },
  };
}

function unsupported(reason: PreviewUnavailableReason): PreviewProjectResult {
  return { status: "unsupported", reason };
}

function extensionOf(filePath: string): string {
  const extension = filePath.slice(filePath.lastIndexOf("."));
  return extension.toLowerCase();
}

function inspectImports(
  source: string,
  currentPath: string,
  filePaths: readonly string[],
  packageDependencies: ReadonlyMap<string, string>,
): PreviewUnavailableReason | null {
  if (/\bimport\s*\(/.test(source) || /\bimport\.meta\b/.test(source)) {
    return "unsupported-import";
  }

  const specifiers = new Set<string>();
  const importPatterns = [
    /\bimport\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier !== undefined) {
        specifiers.add(specifier);
      }
    }
  }

  for (const specifier of specifiers) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      if (
        specifier.startsWith("/") ||
        !hasRelativeFile(currentPath, specifier, filePaths)
      ) {
        return "unsupported-import";
      }
      continue;
    }

    if (specifier.startsWith("@/")) {
      return "unsupported-import";
    }

    const packageRoot = getPackageRoot(specifier);

    if (
      !BASELINE_PACKAGE_ROOTS.has(packageRoot) &&
      !packageDependencies.has(packageRoot)
    ) {
      return "unresolved-dependency";
    }
  }

  if (/\brequire\s*\(/.test(source)) {
    return "unsupported-import";
  }

  return null;
}

function getPackageRoot(specifier: string): string {
  if (specifier.startsWith("@")) {
    return specifier.split("/", 2).join("/");
  }

  return specifier.split("/", 1)[0] ?? specifier;
}

function hasRelativeFile(
  currentPath: string,
  specifier: string,
  filePaths: readonly string[],
): boolean {
  const currentSegments = currentPath.split("/");
  currentSegments.pop();

  for (const segment of specifier.split("/")) {
    if (segment === "." || segment === "") {
      continue;
    }

    if (segment === "..") {
      currentSegments.pop();
    } else {
      currentSegments.push(segment);
    }
  }

  const candidate = currentSegments.join("/");
  const withoutExtension = candidate.replace(/\.(?:js|jsx|ts|tsx|css)$/, "");

  return filePaths.some((filePath) => {
    const fileWithoutExtension = filePath.replace(
      /\.(?:js|jsx|ts|tsx|css)$/,
      "",
    );

    return (
      filePath === candidate ||
      fileWithoutExtension === candidate ||
      fileWithoutExtension === withoutExtension ||
      filePath === `${candidate}/index.ts` ||
      filePath === `${candidate}/index.tsx`
    );
  });
}

function hasRenderableExport(source: string): boolean {
  return (
    /\bexport\s+default\s+(?:async\s+)?(?:function|class|[A-Za-z_$][\w$]*)/.test(
      source,
    ) ||
    /\bexport\s+(?:async\s+)?function\s+[A-Za-z_$][\w$]*/.test(source) ||
    /\bexport\s+(?:const|let|var|class)\s+[A-Za-z_$][\w$]*/.test(source)
  );
}

function hasRequiredRuntimeProps(source: string, typeSource = source): boolean {
  const parameterPatterns = [
    /\bexport\s+(?:default\s+)?(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(\s*\{/g,
    /\bexport\s+(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(\s*\{/g,
    /\bexport\s+default\s+(?:async\s+)?\(\s*\{/g,
  ];

  return parameterPatterns.some((pattern) =>
    Array.from(source.matchAll(pattern)).some((match) => {
      const openingBraceIndex = (match.index ?? 0) + match[0].lastIndexOf("{");
      const parameterBody = readBalancedBlock(
        source,
        openingBraceIndex,
        "{",
        "}",
      );

      return (
        parameterBody !== null &&
        hasRequiredProperty(parameterBody.content, source, typeSource)
      );
    }),
  );
}

function hasRequiredProperty(
  properties: string,
  source: string,
  typeSource: string,
): boolean {
  return splitTopLevel(properties, ",")
    .map((property) => property.trim())
    .some((property) => {
      if (property.length === 0 || property.startsWith("...")) {
        return false;
      }

      if (splitTopLevel(property, "=").length > 1) {
        return false;
      }

      const propertyMatch = property.match(
        /^([A-Za-z_$][\w$]*)(\?)?(?:\s*[:]|\s*$)/,
      );
      const propertyName = propertyMatch?.[1];

      return (
        propertyMatch?.[2] !== "?" &&
        !hasLocalDefault(propertyName, source) &&
        !hasOptionalTypeProperty(propertyName, typeSource) &&
        !["children", "className", "id"].includes(propertyName ?? "")
      );
    });
}

function hasOptionalTypeProperty(
  propertyName: string | undefined,
  source: string,
) {
  if (propertyName === undefined) {
    return false;
  }

  return new RegExp(`\\b${propertyName}\\s*\\?\\s*:`).test(source);
}

function hasLocalDefault(propertyName: string | undefined, source: string) {
  if (propertyName === undefined) {
    return false;
  }

  const capitalizedName = `${propertyName[0]?.toUpperCase() ?? ""}${propertyName.slice(1)}`;

  return (
    new RegExp(`\\.\\.\\.\\s*default${capitalizedName}\\b`).test(source) &&
    new RegExp(`\\.\\.\\.\\s*${propertyName}\\b`).test(source)
  );
}

interface BalancedBlock {
  readonly content: string;
}

function readBalancedBlock(
  source: string,
  openingIndex: number,
  openingCharacter: string,
  closingCharacter: string,
): BalancedBlock | null {
  let depth = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote !== null) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }

    if (character === openingCharacter) {
      depth += 1;
      continue;
    }

    if (character === closingCharacter) {
      depth -= 1;
      if (depth === 0) {
        return {
          content: source.slice(openingIndex + 1, index),
        };
      }
    }
  }

  return null;
}

function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let startIndex = 0;
  let parentheses = 0;
  let brackets = 0;
  let braces = 0;
  let quote: "'" | '"' | "`" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote !== null) {
      if (character === "\\") {
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }

    if (character === "(") {
      parentheses += 1;
    } else if (character === ")") {
      parentheses -= 1;
    } else if (character === "[") {
      brackets += 1;
    } else if (character === "]") {
      brackets -= 1;
    } else if (character === "{") {
      braces += 1;
    } else if (character === "}") {
      braces -= 1;
    } else if (
      character === separator &&
      parentheses === 0 &&
      brackets === 0 &&
      braces === 0
    ) {
      parts.push(source.slice(startIndex, index));
      startIndex = index + 1;
    }
  }

  parts.push(source.slice(startIndex));
  return parts;
}

function createPreviewWrapper(): string {
  return `import * as BlockModule from "./src/component.tsx";
import { createElement, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const namedExports = Object.entries(BlockModule).filter(
  ([name, value]) => name !== "default" && typeof value === "function",
);
const candidate =
  typeof BlockModule.default === "function"
    ? BlockModule.default
    : namedExports[0]?.[1];

export default function BlockPreview() {
  if (typeof candidate !== "function") {
    throw new Error("The block has no renderable preview export");
  }

  return createElement(candidate as ComponentType);
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The preview document has no root element");
}

createRoot(rootElement).render(createElement(BlockPreview));
`;
}
