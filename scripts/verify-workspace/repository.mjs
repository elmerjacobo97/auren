import {
  absolutePath,
  arraysEqual,
  errors,
  expectedBlocks,
  readJson,
  relativePath,
  requireDirectory,
  requireFile,
} from "./context.mjs";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

export function validateBiomeConfiguration() {
  const biome = readJson("biome.json");

  if (!biome) {
    return;
  }

  if (biome.formatter?.enabled !== true) {
    errors.push("biome.json: formatter.enabled must be true");
  }

  if (
    biome.linter?.enabled !== true ||
    biome.linter?.rules?.preset !== "recommended"
  ) {
    errors.push(
      'biome.json: linter must be enabled with the "recommended" preset',
    );
  }

  if (biome.assist?.actions?.source?.organizeImports !== "on") {
    errors.push(
      'biome.json: assist.actions.source.organizeImports must be "on"',
    );
  }
}

export function validateWorkspaceRoots() {
  const expectedRoots = new Map([
    ["apps", new Set(["web"])],
    ["packages", new Set(["schemas", "registry", "core", "cli", "mcp"])],
  ]);

  for (const [rootName, expectedChildren] of expectedRoots) {
    if (!requireDirectory(rootName)) {
      continue;
    }

    const actualChildren = new Set(
      readdirSync(absolutePath(rootName), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name),
    );

    for (const child of expectedChildren) {
      if (!actualChildren.has(child)) {
        errors.push(
          `${rootName}/${child}: required workspace directory is missing`,
        );
      }
    }

    for (const child of actualChildren) {
      if (!expectedChildren.has(child)) {
        errors.push(`${rootName}/${child}: unexpected workspace directory`);
      }
    }
  }
}

export function validateBlockCategories() {
  for (const relative of expectedBlocks) {
    if (!requireDirectory(relative)) {
      continue;
    }

    requireFile(`${relative}/.gitkeep`);
  }
}

export function reportBlockPackageManifests(directory) {
  if (!existsSync(directory) || !lstatSync(directory).isDirectory()) {
    return;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      reportBlockPackageManifests(entryPath);
    } else if (entry.isFile() && entry.name === "package.json") {
      errors.push(
        `${relativePath(entryPath)}: blocks must not contain package manifests`,
      );
    }
  }
}

export function validateConfigurationFiles() {
  const tsconfig = readJson("tsconfig.base.json");
  const compilerOptions = tsconfig?.compilerOptions;

  if (compilerOptions?.strict !== true) {
    errors.push("tsconfig.base.json: compilerOptions.strict must be true");
  }

  if (compilerOptions?.module !== "ESNext") {
    errors.push("tsconfig.base.json: compilerOptions.module must be ESNext");
  }

  if (compilerOptions?.moduleResolution !== "Bundler") {
    errors.push(
      "tsconfig.base.json: compilerOptions.moduleResolution must be Bundler",
    );
  }

  if (compilerOptions?.target !== "ES2022") {
    errors.push("tsconfig.base.json: compilerOptions.target must be ES2022");
  }

  if (compilerOptions?.skipLibCheck !== true) {
    errors.push(
      "tsconfig.base.json: compilerOptions.skipLibCheck must be true",
    );
  }

  if ("paths" in (compilerOptions ?? {})) {
    errors.push(
      "tsconfig.base.json: compilerOptions.paths must not bypass workspace package boundaries",
    );
  }

  const turbo = readJson("turbo.json");
  const tasks = turbo?.tasks;

  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) {
    errors.push("turbo.json: tasks must be an object");
    return;
  }

  if (
    !Array.isArray(tasks.build?.dependsOn) ||
    !tasks.build.dependsOn.includes("^build")
  ) {
    errors.push('turbo.json: tasks.build.dependsOn must include "^build"');
  }

  if (!arraysEqual(tasks.build?.outputs, ["dist/**"])) {
    errors.push('turbo.json: tasks.build.outputs must be exactly "dist/**"');
  }

  if (
    !Array.isArray(tasks.typecheck?.dependsOn) ||
    !tasks.typecheck.dependsOn.includes("^typecheck")
  ) {
    errors.push(
      'turbo.json: tasks.typecheck.dependsOn must include "^typecheck"',
    );
  }

  if (
    !Array.isArray(tasks.test?.dependsOn) ||
    !tasks.test.dependsOn.includes("^test")
  ) {
    errors.push('turbo.json: tasks.test.dependsOn must include "^test"');
  }

  if (tasks.dev?.cache !== false) {
    errors.push("turbo.json: tasks.dev.cache must be false");
  }

  if (tasks.dev?.persistent !== true) {
    errors.push("turbo.json: tasks.dev.persistent must be true");
  }
}

export function validateRequiredFiles() {
  for (const relative of [
    "pnpm-lock.yaml",
    ".gitignore",
    "README.md",
    "scripts/verify-workspace.mjs",
  ]) {
    requireFile(relative);
  }
}
