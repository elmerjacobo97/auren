import { existsSync, lstatSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const errors = [];

export const expectedPackageManager = "pnpm@11.21.0";
export const expectedNodeEngine = ">=20.19.0 <26";
export const expectedWorkspaceGlobs = ["apps/*", "packages/*"];
export const expectedPackageVersion = "0.0.0";
export const expectedSchemasZodVersion = "4.5.1";
export const expectedVitestVersion = "4.1.11";
export const expectedTypecheckScript = "tsc --project tsconfig.json --noEmit";
export const expectedRegistryBuildScript =
  "tsc --project tsconfig.build.json && node scripts/verify-dist.mjs";
export const expectedCliDependencies = {
  "@auren/core": "workspace:*",
  "@auren/schemas": "workspace:*",
  "@clack/prompts": "1.7.0",
  commander: "14.0.3",
  picocolors: "1.1.1",
};
export const expectedCliBin = {
  auren: "dist/index.js",
};
export const expectedCliScripts = {
  build: expectedRegistryBuildScript,
  test: "vitest run",
  typecheck: expectedTypecheckScript,
};
export const expectedPackages = {
  "apps/web": "@auren/web",
  "packages/schemas": "@auren/schemas",
  "packages/registry": "@auren/registry",
  "packages/core": "@auren/core",
  "packages/cli": "@auren/cli",
  "packages/mcp": "@auren/mcp",
};
export const expectedSchemasExports = {
  "./catalog": {
    import: "./dist/catalog/element-schema.js",
    types: "./dist/catalog/element-schema.d.ts",
  },
  "./element": {
    import: "./dist/element/structural-schema.js",
    types: "./dist/element/structural-schema.d.ts",
  },
  "./taxonomy": {
    import: "./dist/taxonomy/schema.js",
    types: "./dist/taxonomy/schema.d.ts",
  },
  "./configuration": {
    import: "./dist/configuration/schema.js",
    types: "./dist/configuration/schema.d.ts",
  },
};
export const expectedSchemasPaths = {
  "@/*": ["./src/*"],
  "@auren/schemas/catalog": ["./src/catalog/element-schema.ts"],
  "@auren/schemas/element": ["./src/element/structural-schema.ts"],
  "@auren/schemas/taxonomy": ["./src/taxonomy/schema.ts"],
  "@auren/schemas/configuration": ["./src/configuration/schema.ts"],
};
export const expectedRegistryExports = {
  ".": {
    import: "./dist/index.js",
    types: "./dist/index.d.ts",
  },
};
export const expectedCoreExports = {
  "./search": {
    import: "./dist/search/search.js",
    types: "./dist/search/search.d.ts",
  },
  "./resolve": {
    import: "./dist/resolve/resolve.js",
    types: "./dist/resolve/resolve.d.ts",
  },
  "./dependencies": {
    import: "./dist/dependencies/dependency-plan.js",
    types: "./dist/dependencies/dependency-plan.d.ts",
  },
  "./load/metadata": {
    import: "./dist/load/load-block-metadata.js",
    types: "./dist/load/load-block-metadata.d.ts",
  },
  "./load/files": {
    import: "./dist/load/load-block-files.js",
    types: "./dist/load/load-block-files.d.ts",
  },
  "./compatibility": {
    import: "./dist/compatibility/compatibility.js",
    types: "./dist/compatibility/compatibility.d.ts",
  },
  "./project": {
    import: "./dist/project/detect-project.js",
    types: "./dist/project/detect-project.d.ts",
  },
  "./configuration": {
    import: "./dist/configuration/configuration.js",
    types: "./dist/configuration/configuration.d.ts",
  },
};
export const expectedRegistryPaths = {
  "@auren/schemas/catalog": ["../schemas/src/catalog/element-schema.ts"],
  "@auren/schemas/element": ["../schemas/src/element/structural-schema.ts"],
  "@auren/schemas/taxonomy": ["../schemas/src/taxonomy/schema.ts"],
};
export const expectedCorePaths = {
  "@/*": ["./src/*"],
  "@auren/registry": ["../registry/src/index.ts"],
  "@auren/schemas/catalog": ["../schemas/src/catalog/element-schema.ts"],
  "@auren/schemas/element": ["../schemas/src/element/structural-schema.ts"],
  "@auren/schemas/taxonomy": ["../schemas/src/taxonomy/schema.ts"],
  "@auren/schemas/configuration": ["../schemas/src/configuration/schema.ts"],
};
export const expectedCliPaths = {
  "@auren/core/project": ["../core/src/project/detect-project.ts"],
  "@auren/core/configuration": ["../core/src/configuration/configuration.ts"],
  "@auren/schemas/configuration": ["../schemas/src/configuration/schema.ts"],
  "@auren/schemas/taxonomy": ["../schemas/src/taxonomy/schema.ts"],
  "@auren/schemas/element": ["../schemas/src/element/structural-schema.ts"],
};
export const expectedWorkspaceProfiles = {
  "apps/web": {
    extends: "../../tsconfig.web.json",
    include: ["src/**/*.ts", "src/**/*.tsx"],
    entrypoints: ["src/index.ts"],
  },
  "packages/schemas": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
    entrypoints: [
      "src/catalog/element-schema.ts",
      "src/element/structural-schema.ts",
      "src/taxonomy/schema.ts",
      "src/configuration/schema.ts",
    ],
  },
  "packages/registry": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
    entrypoints: ["src/index.ts"],
  },
  "packages/core": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
    entrypoints: [
      "src/search/search.ts",
      "src/resolve/resolve.ts",
      "src/dependencies/dependency-plan.ts",
      "src/load/load-block-metadata.ts",
      "src/load/load-block-files.ts",
      "src/compatibility/compatibility.ts",
      "src/project/detect-project.ts",
      "src/configuration/configuration.ts",
    ],
  },
  "packages/cli": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
    entrypoints: ["src/cli/index.ts"],
  },
  "packages/mcp": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
    entrypoints: ["src/index.ts"],
  },
};
export const expectedBlockCategories = Object.freeze([
  "marketing",
  "application-ui",
  "ecommerce",
  "authentication",
]);
export const expectedBlocks = expectedBlockCategories.map(
  (category) => `blocks/${category}`,
);

export function relativePath(filePath) {
  return path.relative(root, filePath) || ".";
}

export function absolutePath(relative) {
  return path.join(root, relative);
}

export function requireDirectory(relative) {
  const filePath = absolutePath(relative);

  if (!existsSync(filePath)) {
    errors.push(`${relative}: required directory is missing`);
    return false;
  }

  if (!lstatSync(filePath).isDirectory()) {
    errors.push(`${relative}: expected a directory`);
    return false;
  }

  return true;
}

export function requireFile(relative) {
  const filePath = absolutePath(relative);

  if (!existsSync(filePath)) {
    errors.push(`${relative}: required file is missing`);
    return false;
  }

  if (!lstatSync(filePath).isFile()) {
    errors.push(`${relative}: expected a file`);
    return false;
  }

  return true;
}

export function readJson(relative) {
  if (!requireFile(relative)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(absolutePath(relative), "utf8"));
  } catch (error) {
    errors.push(`${relative}: invalid JSON (${error.message})`);
    return null;
  }
}

export function readText(relative) {
  if (!requireFile(relative)) {
    return null;
  }

  return readFileSync(absolutePath(relative), "utf8");
}

export function hasExactVersion(value) {
  return (
    typeof value === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
  );
}

export function arraysEqual(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}
