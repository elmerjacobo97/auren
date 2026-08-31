#!/usr/bin/env node

/**
 * Bundles @auren/cli into a standalone, publishable npm package under
 * dist/npm-pkg/.  The bundle is self-contained (all workspace JS is inlined);
 * only Node.js built-in modules remain external.
 *
 * Aliases map the workspace package names (used in the compiled dist/) to the
 * actual .js files in each package's dist/ directory, matching the exports map
 * in each package.json.
 *
 * Usage:
 *   node scripts/bundle-npm.mjs
 *
 * Prerequisite:
 *   pnpm build   (must be run first so that @auren/core, @auren/registry and
 *                 @auren/schemas have their dist/ directories populated)
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLI_ROOT = resolve(__dirname, "..");
const WORKSPACE_ROOT = resolve(CLI_ROOT, "../..");
const DIST_NPM_PKG = resolve(WORKSPACE_ROOT, "dist/npm-pkg");

// ---------------------------------------------------------------------------
// Package metadata — release workflows provide AUREN_NPM_VERSION from the tag.
// ---------------------------------------------------------------------------

const NPM_NAME = "auren";
const NPM_VERSION = process.env.AUREN_NPM_VERSION ?? "0.1.2";
const NPM_DESCRIPTION =
  "Discover and install versioned UI components and block catalogs.";

// ---------------------------------------------------------------------------
// esbuild API — loaded dynamically from the installed dependency
// ---------------------------------------------------------------------------

const { build } = await import(
  new URL(
    "../../../node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js",
    import.meta.url,
  ).href
);

// ---------------------------------------------------------------------------
// Alias map — must mirror the exports field in each package's dist
// ---------------------------------------------------------------------------

const CORE_DIST = resolve(WORKSPACE_ROOT, "packages/core/dist");
const SCHEMAS_DIST = resolve(WORKSPACE_ROOT, "packages/schemas/dist");
const REGISTRY_DIST = resolve(WORKSPACE_ROOT, "packages/registry/dist");

const WORKSPACE_ALIASES = {
  // @auren/core subpath exports
  "@auren/core/search": resolve(CORE_DIST, "search/search.js"),
  "@auren/core/resolve": resolve(CORE_DIST, "resolve/resolve.js"),
  "@auren/core/dependencies": resolve(
    CORE_DIST,
    "dependencies/dependency-plan.js",
  ),
  "@auren/core/load/metadata": resolve(
    CORE_DIST,
    "load/load-block-metadata.js",
  ),
  "@auren/core/load/files": resolve(CORE_DIST, "load/load-block-files.js"),
  "@auren/core/compatibility": resolve(
    CORE_DIST,
    "compatibility/compatibility.js",
  ),
  "@auren/core/project": resolve(CORE_DIST, "project/detect-project.js"),
  "@auren/core/configuration": resolve(
    CORE_DIST,
    "configuration/configuration.js",
  ),
  // @auren/schemas subpath exports
  "@auren/schemas/catalog": resolve(SCHEMAS_DIST, "catalog/element-schema.js"),
  "@auren/schemas/element": resolve(
    SCHEMAS_DIST,
    "element/structural-schema.js",
  ),
  "@auren/schemas/taxonomy": resolve(SCHEMAS_DIST, "taxonomy/schema.js"),
  "@auren/schemas/configuration": resolve(
    SCHEMAS_DIST,
    "configuration/schema.js",
  ),
  "@auren/schemas/collection": resolve(SCHEMAS_DIST, "collection/schema.js"),
  // @auren/registry root export
  "@auren/registry": resolve(REGISTRY_DIST, "index.js"),
};

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

const entryPoint = resolve(CLI_ROOT, "dist/index.js");

await mkdir(DIST_NPM_PKG, { recursive: true });

console.log("Bundling @auren/cli for npm...");
console.log(`  Entry : ${entryPoint}`);
console.log(`  Output: ${DIST_NPM_PKG}`);
console.log(
  `  Aliases (${Object.keys(WORKSPACE_ALIASES).length}):\n${Object.entries(
    WORKSPACE_ALIASES,
  )
    .map(([k, v]) => `    ${k} → ${v}`)
    .join("\n")}`,
);

await build({
  entryPoints: [entryPoint],
  bundle: true,
  platform: "node",
  outfile: resolve(DIST_NPM_PKG, "index.js"),
  format: "esm",
  target: "node20",
  alias: WORKSPACE_ALIASES,
  // Only Node.js built-ins and the CLI's runtime dependencies remain external;
  // commander, @clack/prompts and picocolors use the native require() provided
  // by Node.js at runtime.
  external: [
    // CLI runtime dependencies — resolved by npm install, not bundled
    "commander",
    "@clack/prompts",
    "picocolors",
    // Node.js built-in modules
    "node:fs",
    "node:fs/promises",
    "node:path",
    "node:path/posix",
    "node:path/win32",
    "node:url",
    "node:os",
    "node:crypto",
    "node:child_process",
    "node:module",
    "node:process",
    "node:stream",
    "node:events",
    "node:util",
    "node:util/types",
    "node:assert",
    "node:assert/strict",
    "node:buffer",
    "node:string_decoder",
    "node:tty",
    "node:querystring",
  ],
  logLevel: "info",
});

const npmReadmeSrc = resolve(CLI_ROOT, "npm-readme.md");
const npmReadmeDst = resolve(DIST_NPM_PKG, "README.md");
await mkdir(DIST_NPM_PKG, { recursive: true });
await writeFile(npmReadmeDst, await readFile(npmReadmeSrc, "utf8"));

console.log("\nWriting companion package.json…");

const packageManifest = {
  name: NPM_NAME,
  version: NPM_VERSION,
  description: NPM_DESCRIPTION,
  type: "module",
  engines: {
    node: ">=20.19.0 <27",
  },
  bin: {
    auren: "index.js",
  },
  files: ["index.js"],
  dependencies: {
    commander: "^14.0.3",
    "@clack/prompts": "^1.7.0",
    picocolors: "^1.1.1",
  },
  keywords: [
    "ui",
    "components",
    "blocks",
    "catalog",
    "react",
    "tailwind",
    "shadcn",
  ],
  license: "MIT",
  repository: {
    type: "git",
    url: "git+https://github.com/elmerjacobo97/auren.git",
  },
};

await writeFile(
  resolve(DIST_NPM_PKG, "package.json"),
  `${JSON.stringify(packageManifest, null, 2)}\n`,
);

console.log(
  `Bundle complete → ${resolve(DIST_NPM_PKG, "index.js")} (${NPM_NAME}@${NPM_VERSION})`,
);
console.log("Publish with: npm publish --access public");
