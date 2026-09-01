import { transform } from "esbuild";
import {
  createPreviewContentHash,
  createPreviewIdentity,
  evaluatePreviewExecutionPolicy,
  previewArtifactManifestSchema,
  previewDescriptorSchema,
  previewExecutionPolicy,
} from "@auren/schemas/preview";
import { logPreviewDiagnostic } from "./preview-diagnostics.mjs";

export const REACT_PREVIEW_RUNTIME = "react-vite-tailwind-4";
export const REACT_PREVIEW_RUNTIME_VERSION = "1.0.0";

const runtimeDependencies = Object.freeze({
  "@tailwindcss/browser": "4.3.3",
  "@vitejs/plugin-react": "6.1.1",
  react: "19.2.8",
  "react-dom": "19.2.8",
  tailwindcss: "4.3.3",
  vite: "8.2.2",
});

const buildConfiguration = Object.freeze({
  cssProcessor: "tailwindcss-browser",
  entry: "/index.tsx",
  input: "empty",
  policyVersion: previewExecutionPolicy.version,
  contentSecurityPolicy: previewExecutionPolicy.contentSecurityPolicy,
  stylesheet: "/styles.css",
  template: "vite-react-ts",
});

export async function createPreviewArtifactKey({ element, files }) {
  const { identity } = await createPreviewBuildInput({ element, files });
  return `${element.id}:${identity}`;
}

export async function createPreviewArtifact({ element, files }) {
  const { contentHash, dependencies, identity, materializedFiles } =
    await createPreviewBuildInput({ element, files });
  const descriptorBase = {
    schemaVersion: 1,
    contentType: "block",
    contentId: element.id,
    contentVersion: contentHash,
    framework: "react",
    runtime: REACT_PREVIEW_RUNTIME,
    runtimeVersion: REACT_PREVIEW_RUNTIME_VERSION,
    delivery: "inline",
    identity,
  };

  const failure = await withTimeout(
    getPreviewFailure({
      dependencies,
      element,
      files: materializedFiles,
    }),
    previewExecutionPolicy.timeoutMs,
  );

  if (failure !== undefined) {
    logPreviewDiagnostic({
      category: failure.category,
      contentId: element.id,
      identity,
      message: failure.message,
      phase: "build",
      runtime: REACT_PREVIEW_RUNTIME,
    });

    return {
      descriptor: previewDescriptorSchema.parse({
        ...descriptorBase,
        status: failure.category === "unsupported" ? "unsupported" : "failure",
        failure,
      }),
      artifact: undefined,
    };
  }

  const artifactReference = `previews/${element.id}/${identity}.json`;
  const artifact = previewArtifactManifestSchema.parse({
    schemaVersion: 1,
    contentId: element.id,
    identity,
    runtime: REACT_PREVIEW_RUNTIME,
    runtimeVersion: REACT_PREVIEW_RUNTIME_VERSION,
    entry: "/index.tsx",
    input: { kind: "empty" },
    files: createPreviewFiles(materializedFiles),
    dependencies,
    buildConfiguration,
  });

  return {
    descriptor: previewDescriptorSchema.parse({
      ...descriptorBase,
      status: "ready",
      artifact: { kind: "inline", reference: artifactReference },
    }),
    artifact: {
      reference: artifactReference,
      payload: artifact,
    },
  };
}

async function createPreviewBuildInput({ element, files }) {
  const materializedFiles = [...files].sort((left, right) =>
    compareStrings(left.path, right.path),
  );
  const contentHash = await createPreviewContentHash(
    JSON.stringify(materializedFiles),
  );
  const dependencies = getDependencies(element.dependencies);
  const identity = await createPreviewIdentity({
    buildConfiguration,
    contentHash,
    dependencies,
    runtime: REACT_PREVIEW_RUNTIME,
    runtimeVersion: REACT_PREVIEW_RUNTIME_VERSION,
  });

  return { contentHash, dependencies, identity, materializedFiles };
}

function getDependencies(dependencies) {
  const result = {};

  for (const dependency of dependencies) {
    if (dependency.kind === "package") {
      result[dependency.name] = dependency.version;
    } else if (dependency.kind === "auren") {
      result[`auren:${dependency.id}`] = "catalog";
    } else {
      result[`shadcn:${dependency.name}`] = "catalog";
    }
  }

  for (const [name, version] of Object.entries(runtimeDependencies)) {
    if (!Object.hasOwn(result, name)) {
      result[name] = version;
    }
  }

  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) =>
      compareStrings(left, right),
    ),
  );
}

async function getPreviewFailure({ dependencies, element, files }) {
  if (!element.frameworks.includes("react")) {
    return {
      category: "unsupported",
      message: "This element does not declare the React framework.",
    };
  }

  const component = files.find(
    (file) => file.path === "component.tsx" && file.kind === "component",
  );

  if (component === undefined) {
    return {
      category: "unsupported",
      message: "The element does not contain a React component entrypoint.",
    };
  }

  if (files.some((file) => file.kind === "asset")) {
    return {
      category: "asset",
      message: "The React preview runtime does not support binary assets yet.",
    };
  }

  for (const dependency of element.dependencies) {
    if (dependency.kind !== "package") {
      return {
        category: "unsupported",
        message:
          "The preview requires a catalog dependency that is not bundled.",
      };
    }

    if (
      Object.hasOwn(runtimeDependencies, dependency.name) &&
      runtimeDependencies[dependency.name] !== dependency.version
    ) {
      return {
        category: "unsupported",
        message: `The declared dependency ${dependency.name}@${dependency.version} conflicts with the pinned preview runtime.`,
      };
    }
  }

  const policyFailure = evaluatePreviewExecutionPolicy({
    fileCount: files.length,
    fileSizes: files.map((file) =>
      typeof file.content === "string"
        ? new TextEncoder().encode(file.content).byteLength
        : 0,
    ),
    dependencyRoots: element.dependencies
      .filter((dependency) => dependency.kind === "package")
      .map((dependency) => dependency.name),
  });

  if (policyFailure !== null) {
    return {
      category: policyFailure === "resource-limit" ? "build" : "unsupported",
      message:
        policyFailure === "resource-limit"
          ? "The preview exceeds the pinned source resource limits."
          : "The preview declares a dependency outside the approved execution policy.",
    };
  }

  for (const [name, version] of Object.entries(runtimeDependencies)) {
    const declaredVersion = dependencies[name];

    if (declaredVersion !== version) {
      return {
        category: "unsupported",
        message: `The declared dependency ${name}@${declaredVersion} conflicts with the pinned preview runtime.`,
      };
    }
  }

  for (const file of files) {
    if (file.kind === "style") {
      continue;
    }

    const importFailure = inspectImports(
      file.content,
      file.path,
      files.map((candidate) => candidate.path),
      dependencies,
    );

    if (importFailure !== undefined) {
      return importFailure;
    }

    const loader = file.path.endsWith(".tsx") ? "tsx" : "ts";

    try {
      await transform(file.content, {
        format: "esm",
        loader,
        sourcemap: false,
      });
    } catch (error) {
      return {
        category: "build",
        message: `The preview source could not be compiled: ${firstLine(error)}`,
      };
    }
  }

  if (!hasRenderableExport(component.content)) {
    return {
      category: "build",
      message: "The component does not expose a renderable export.",
    };
  }

  return undefined;
}

function inspectImports(source, currentPath, filePaths, dependencies) {
  if (/\bimport\s*\(/.test(source) || /\bimport\.meta\b/.test(source)) {
    return {
      category: "unsupported",
      message: `The preview uses a dynamic import in ${currentPath}.`,
    };
  }

  const specifiers = new Set();
  const importPatterns = [
    /\bimport\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /\brequire\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const pattern of importPatterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1] !== undefined) {
        specifiers.add(match[1]);
      }
    }
  }

  for (const specifier of specifiers) {
    if (specifier.startsWith(".") || specifier.startsWith("/")) {
      if (
        specifier.startsWith("/") ||
        !hasRelativeFile(currentPath, specifier, filePaths)
      ) {
        return {
          category: "unsupported",
          message: `The preview cannot resolve ${specifier} from ${currentPath}.`,
        };
      }
      continue;
    }

    if (specifier.startsWith("@/")) {
      return {
        category: "unsupported",
        message: `The preview cannot resolve the consumer alias ${specifier}.`,
      };
    }

    const packageRoot = getPackageRoot(specifier);

    if (!Object.hasOwn(dependencies, packageRoot)) {
      return {
        category: "unsupported",
        message: `The preview dependency ${packageRoot} is not declared.`,
      };
    }
  }

  if (/\brequire\s*\(/.test(source)) {
    return {
      category: "unsupported",
      message: `The preview uses CommonJS loading in ${currentPath}.`,
    };
  }

  return undefined;
}

function getPackageRoot(specifier) {
  if (specifier.startsWith("@")) {
    return specifier.split("/", 2).join("/");
  }

  return specifier.split("/", 1)[0] ?? specifier;
}

function hasRelativeFile(currentPath, specifier, filePaths) {
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

function createPreviewFiles(files) {
  const sourceFiles = files
    .filter((file) => file.kind !== "asset")
    .map((file) => ({
      path: `/src/${file.path}`,
      content: file.content,
    }));

  return [
    {
      path: "/index.tsx",
      content: createPreviewWrapper(),
    },
    {
      path: "/styles.css",
      content: createPreviewStylesheet(
        files.filter((file) => file.kind === "style").map((file) => file.path),
      ),
    },
    {
      path: "/vite.config.ts",
      content: createPreviewViteConfig(),
    },
    { path: "/index.html", content: createPreviewIndexHtml() },
    ...sourceFiles,
  ].sort((left, right) => compareStrings(left.path, right.path));
}

function createPreviewWrapper() {
  return `import "@tailwindcss/browser";
import * as BlockModule from "./src/component.tsx";
import { createElement, type ComponentType, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const namedExports = Object.entries(BlockModule).filter(
  ([name, value]) => name !== "default" && typeof value === "function",
);
const candidate =
  typeof BlockModule.default === "function"
    ? BlockModule.default
    : namedExports[0]?.[1];

function BlockPreview() {
  if (typeof candidate !== "function") {
    throw new Error("The block has no renderable preview export");
  }

  return createElement(candidate as ComponentType);
}

function PreviewRoot() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.parent.postMessage({ type: "auren-preview-ready" }, "*");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  return createElement(BlockPreview);
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The preview document has no root element");
}

createRoot(rootElement).render(createElement(PreviewRoot));
`;
}

function createPreviewStylesheet(stylePaths) {
  return stylePaths
    .map((filePath) => `@import "./src/${filePath}";`)
    .join("\n");
}

function createPreviewViteConfig() {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;
}

function createPreviewIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="${previewExecutionPolicy.contentSecurityPolicy}" />
    <title>Auren Preview</title>
    <style type="text/tailwindcss">@import "tailwindcss";</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
`;
}

async function withTimeout(promise, timeoutMs) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              category: "timeout",
              message: "The preview build exceeded its time limit.",
            }),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

function hasRenderableExport(source) {
  return (
    /\bexport\s+default\s+(?:async\s+)?(?:function|class|[A-Za-z_$][\w$]*)/.test(
      source,
    ) ||
    /\bexport\s+(?:async\s+)?function\s+[A-Za-z_$][\w$]*/.test(source) ||
    /\bexport\s+(?:const|let|var|class)\s+[A-Za-z_$][\w$]*/.test(source)
  );
}

function firstLine(error) {
  return error instanceof Error
    ? error.message.split(/\r?\n/, 1)[0]
    : String(error).split(/\r?\n/, 1)[0];
}

function compareStrings(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
