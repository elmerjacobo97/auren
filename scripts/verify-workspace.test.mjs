import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  expectedCliBin,
  expectedCliDependencies,
  expectedCliPaths,
  expectedCliScripts,
  expectedCoreExports,
  expectedCorePaths,
  expectedSchemasExports,
  expectedSchemasPaths,
  expectedWebDependencies,
  expectedWebDevDependencies,
  expectedWebPaths,
  expectedWebScripts,
  expectedWorkspaceProfiles,
} from "./verify-workspace.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

test("Web manifest and TypeScript settings match the application contract", () => {
  const manifest = readJson("apps/web/package.json");
  const sourceConfig = readJson("apps/web/tsconfig.json");
  const entrypoint = readFileSync(
    path.join(root, "apps/web/src/main.tsx"),
    "utf8",
  );
  const router = readFileSync(
    path.join(root, "apps/web/src/router.tsx"),
    "utf8",
  );
  const routeSource = [
    "__root.tsx",
    "catalog/index.tsx",
    "catalog/route-paths.ts",
    "components/index.tsx",
    "blocks/index.tsx",
    "pages/index.tsx",
    "collections/index.tsx",
  ]
    .map((file) =>
      readFileSync(path.join(root, "apps/web/src/routes", file), "utf8"),
    )
    .join("\n");
  const stylesheet = readFileSync(
    path.join(root, "apps/web/src/styles.css"),
    "utf8",
  );
  const viteConfig = readFileSync(
    path.join(root, "apps/web/vite.config.ts"),
    "utf8",
  );
  const html = readFileSync(path.join(root, "apps/web/index.html"), "utf8");

  assert.equal(manifest.name, "@auren/web");
  assert.equal(manifest.version, "0.0.0");
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.deepEqual(manifest.dependencies, expectedWebDependencies);
  assert.equal(manifest.dependencies["@auren/schemas"], "workspace:*");
  assert.deepEqual(manifest.devDependencies, expectedWebDevDependencies);
  assert.deepEqual(manifest.scripts, expectedWebScripts);
  assert.equal(manifest.scripts.test, "vitest run");
  assert.equal("@auren/core" in manifest.dependencies, false);
  assert.equal("@auren/cli" in manifest.dependencies, false);
  assert.equal("exports" in manifest, false);
  assert.equal("main" in manifest, false);
  assert.equal("module" in manifest, false);
  assert.equal("bin" in manifest, false);

  assert.equal(sourceConfig.extends, "../../tsconfig.web.json");
  assert.deepEqual(
    sourceConfig.include,
    expectedWorkspaceProfiles["apps/web"].include,
  );
  assert.deepEqual(sourceConfig.compilerOptions?.paths, expectedWebPaths);
  assert.equal(sourceConfig.compilerOptions?.exactOptionalPropertyTypes, true);
  assert.equal(sourceConfig.compilerOptions?.noImplicitOverride, true);
  assert.equal(sourceConfig.compilerOptions?.noUncheckedIndexedAccess, true);
  assert.equal(existsSync(path.join(root, "apps/web/src/index.ts")), false);
  assert.equal(existsSync(path.join(root, "apps/web/src/vite-env.d.ts")), true);

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.tsx"/);
  assert.match(entrypoint, /import "\.\/styles\.css"/);
  assert.match(entrypoint, /createRoot/);
  assert.match(entrypoint, /RouterProvider/);
  assert.match(router, /createRouter/);
  assert.match(routeSource, /createRootRoute/);
  assert.equal(routeSource.includes('path: "/"'), true);
  for (const pathName of ["/components", "/blocks", "/pages", "/collections"]) {
    assert.equal(routeSource.includes(`path: "${pathName}"`), true);
  }
  assert.equal(router.includes("createRoute("), false);
  assert.equal(router.includes("CatalogOverview"), false);
  assert.equal(`${router}\n${routeSource}`.includes("$id"), false);
  assert.equal(
    router.includes('declare module "@tanstack/react-router"'),
    true,
  );
  assert.equal(stylesheet, '@import "tailwindcss";\n');
  assert.match(viteConfig, /@vitejs\/plugin-react/);
  assert.match(viteConfig, /@tailwindcss\/vite/);
  assert.match(viteConfig, /fileURLToPath/);
  assert.match(viteConfig, /alias/);
  assert.equal(existsSync(path.join(root, "apps/web/index.html")), true);
});

test("Core manifest matches the pinned executable-package contract", () => {
  const manifest = readJson("packages/core/package.json");

  assert.deepEqual(manifest.exports, expectedCoreExports);
  assert.deepEqual(manifest.dependencies, {
    "@auren/registry": "workspace:*",
    "@auren/schemas": "workspace:*",
    semver: "7.7.2",
  });
  assert.deepEqual(manifest.devDependencies ?? {}, {});
  assert.deepEqual(manifest.scripts, {
    build: "tsc --project tsconfig.build.json && node scripts/verify-dist.mjs",
    test: "vitest run",
    typecheck: "tsc --project tsconfig.json --noEmit",
  });
});

test("CLI manifest and TypeScript settings match the executable contract", () => {
  const manifest = readJson("packages/cli/package.json");
  const sourceConfig = readJson("packages/cli/tsconfig.json");
  const buildConfig = readJson("packages/cli/tsconfig.build.json");
  const source = readFileSync(
    path.join(root, "packages/cli/src/cli/index.ts"),
    "utf8",
  );

  assert.deepEqual(manifest.bin, expectedCliBin);
  assert.deepEqual(manifest.dependencies, expectedCliDependencies);
  assert.deepEqual(manifest.devDependencies ?? {}, {});
  assert.deepEqual(manifest.scripts, expectedCliScripts);
  assert.equal("exports" in manifest, false);
  assert.equal("main" in manifest, false);
  assert.equal("module" in manifest, false);
  assert.deepEqual(sourceConfig.include, ["src/**/*.ts"]);
  assert.deepEqual(sourceConfig.compilerOptions?.paths, expectedCliPaths);
  assert.equal(buildConfig.extends, "./tsconfig.json");
  assert.deepEqual(buildConfig.include, ["src/cli/index.ts"]);
  assert.equal(buildConfig.compilerOptions?.noEmit, false);
  assert.equal(buildConfig.compilerOptions?.outDir, "dist");
  assert.equal(buildConfig.compilerOptions?.rootDir, "src/cli");
  assert.equal(buildConfig.compilerOptions?.sourceMap, true);
  assert.equal(source.startsWith("#!/usr/bin/env node"), true);
  assert.equal(
    existsSync(path.join(root, "packages/cli/vitest.config.ts")),
    true,
  );
  assert.equal(
    existsSync(path.join(root, "packages/cli/scripts/verify-dist.mjs")),
    true,
  );
});

test("Schemas manifest and TypeScript settings match the capability contract", () => {
  const manifest = readJson("packages/schemas/package.json");
  const sourceConfig = readJson("packages/schemas/tsconfig.json");
  const buildConfig = readJson("packages/schemas/tsconfig.build.json");

  assert.deepEqual(manifest.exports, expectedSchemasExports);
  assert.deepEqual(manifest.dependencies, { zod: "4.5.1" });
  assert.deepEqual(sourceConfig.compilerOptions?.paths, expectedSchemasPaths);
  assert.equal(buildConfig.extends, "./tsconfig.json");
  assert.deepEqual(buildConfig.include, [
    "src/catalog/element-schema.ts",
    "src/element/structural-schema.ts",
    "src/taxonomy/schema.ts",
    "src/configuration/schema.ts",
  ]);
  assert.equal(buildConfig.compilerOptions?.declaration, true);
  assert.equal(buildConfig.compilerOptions?.declarationMap, true);
  assert.equal(buildConfig.compilerOptions?.noEmit, false);
  assert.equal(buildConfig.compilerOptions?.outDir, "dist");
  assert.equal(buildConfig.compilerOptions?.rootDir, "src");
  assert.equal(
    existsSync(path.join(root, "packages/schemas/src/index.ts")),
    false,
  );
});

test("Schemas configuration public entrypoint resolves the built API", async () => {
  const { aurenConfigurationSchema } = await import(
    "@auren/schemas/configuration"
  );
  const configuration = {
    framework: "react",
    components: "src/components/auren",
    tailwind: true,
  };

  assert.deepEqual(
    aurenConfigurationSchema.parse(configuration),
    configuration,
  );
});

test("Core TypeScript settings and direct entrypoint files match the contract", () => {
  const sourceConfig = readJson("packages/core/tsconfig.json");
  const buildConfig = readJson("packages/core/tsconfig.build.json");

  assert.deepEqual(sourceConfig.compilerOptions?.paths, expectedCorePaths);
  assert.equal(buildConfig.extends, "./tsconfig.json");
  assert.deepEqual(buildConfig.include, [
    "src/search/search.ts",
    "src/resolve/resolve.ts",
    "src/dependencies/dependency-plan.ts",
    "src/load/load-block-metadata.ts",
    "src/load/load-block-files.ts",
    "src/compatibility/compatibility.ts",
    "src/project/detect-project.ts",
    "src/configuration/configuration.ts",
  ]);
  assert.equal(buildConfig.compilerOptions?.declaration, true);
  assert.equal(buildConfig.compilerOptions?.declarationMap, true);
  assert.equal(buildConfig.compilerOptions?.noEmit, false);
  assert.equal(buildConfig.compilerOptions?.outDir, "dist");
  assert.equal(buildConfig.compilerOptions?.rootDir, "src");
  assert.equal(
    existsSync(path.join(root, "packages/core/src/index.ts")),
    false,
  );
  assert.equal(
    existsSync(path.join(root, "packages/core/vitest.config.ts")),
    true,
  );
  assert.equal(
    existsSync(path.join(root, "packages/core/scripts/verify-dist.mjs")),
    true,
  );
});
