import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { expectedCoreExports, expectedCorePaths } from "./verify-workspace.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

test("Core manifest matches the pinned executable-package contract", () => {
  const manifest = readJson("packages/core/package.json");

  assert.deepEqual(manifest.exports, expectedCoreExports);
  assert.deepEqual(manifest.dependencies, {
    "@auren/registry": "workspace:*",
    "@auren/schemas": "workspace:*",
  });
  assert.deepEqual(manifest.devDependencies ?? {}, {});
  assert.deepEqual(manifest.scripts, {
    build: "tsc --project tsconfig.build.json && node scripts/verify-dist.mjs",
    test: "vitest run",
    typecheck: "tsc --project tsconfig.json --noEmit",
  });
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
