import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const expectedPackageManager = "pnpm@11.21.0";
const expectedNodeEngine = ">=20.19.0 <26";
const expectedWorkspaceGlobs = ["apps/*", "packages/*"];
const expectedPackageVersion = "0.0.0";
const expectedSchemasZodVersion = "4.5.1";
const expectedVitestVersion = "4.1.11";
const expectedTypecheckScript = "tsc --project tsconfig.json --noEmit";
const expectedPackages = {
  "apps/web": "@auren/web",
  "packages/schemas": "@auren/schemas",
  "packages/registry": "@auren/registry",
  "packages/core": "@auren/core",
  "packages/cli": "@auren/cli",
  "packages/mcp": "@auren/mcp",
};
const expectedWorkspaceProfiles = {
  "apps/web": {
    extends: "../../tsconfig.web.json",
    include: ["src/**/*.ts", "src/**/*.tsx"],
  },
  "packages/schemas": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
  },
  "packages/registry": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
  },
  "packages/core": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
  },
  "packages/cli": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
  },
  "packages/mcp": {
    extends: "../../tsconfig.node.json",
    include: ["src/**/*.ts"],
  },
};
const expectedBlocks = [
  "blocks/marketing",
  "blocks/application",
  "blocks/ecommerce",
  "blocks/authentication",
];

function relativePath(filePath) {
  return path.relative(root, filePath) || ".";
}

function absolutePath(relative) {
  return path.join(root, relative);
}

function requireDirectory(relative) {
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

function requireFile(relative) {
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

function readJson(relative) {
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

function readText(relative) {
  if (!requireFile(relative)) {
    return null;
  }

  return readFileSync(absolutePath(relative), "utf8");
}

function hasExactVersion(value) {
  return (
    typeof value === "string" &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)
  );
}

function arraysEqual(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function validateRootManifest() {
  const manifest = readJson("package.json");

  if (!manifest) {
    return;
  }

  if (manifest.private !== true) {
    errors.push("package.json: root package must be private");
  }

  if (manifest.type !== "module") {
    errors.push("package.json: root package must use type module");
  }

  if (manifest.packageManager !== expectedPackageManager) {
    errors.push(
      `package.json: packageManager must be ${expectedPackageManager}, got ${String(manifest.packageManager)}`,
    );
  }

  if (manifest.engines?.node !== expectedNodeEngine) {
    errors.push(
      `package.json: engines.node must be ${expectedNodeEngine}, got ${String(manifest.engines?.node)}`,
    );
  }

  if (manifest.engines?.pnpm !== "11.21.0") {
    errors.push(
      `package.json: engines.pnpm must be 11.21.0, got ${String(manifest.engines?.pnpm)}`,
    );
  }

  const expectedScripts = {
    check: "node scripts/verify-workspace.mjs",
    build: "turbo run build",
    dev: "turbo run dev",
    test: "turbo run test",
    typecheck: "turbo run typecheck",
    lint: "biome lint .",
    "lint:fix": "biome lint --write .",
    format: "biome format .",
    "format:fix": "biome format --write .",
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (manifest.scripts?.[name] !== command) {
      errors.push(
        `package.json: scripts.${name} must be ${JSON.stringify(command)}`,
      );
    }
  }

  for (const dependency of [
    "@biomejs/biome",
    "turbo",
    "typescript",
    "vitest",
  ]) {
    const version = manifest.devDependencies?.[dependency];

    if (!hasExactVersion(version)) {
      errors.push(
        `package.json: devDependencies.${dependency} must use an exact semver version, got ${String(version)}`,
      );
    }
  }

  if (manifest.devDependencies?.vitest !== expectedVitestVersion) {
    errors.push(
      `package.json: devDependencies.vitest must be ${expectedVitestVersion}`,
    );
  }
}

function validateWorkspaceManifest() {
  const workspace = readText("pnpm-workspace.yaml");

  if (workspace === null) {
    return;
  }

  if (!/^packages:\s*$/m.test(workspace)) {
    errors.push("pnpm-workspace.yaml: expected a packages declaration");
  }

  const packagesSection = workspace.match(
    /^packages:\s*\n((?:\s+-\s*[^\n]*\n?)*)/m,
  )?.[1];
  const globs = packagesSection
    ? [
        ...packagesSection.matchAll(
          /^\s*-\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/gm,
        ),
      ].map((match) => match[1])
    : [];

  if (
    globs.length !== expectedWorkspaceGlobs.length ||
    globs.some((glob, index) => glob !== expectedWorkspaceGlobs[index])
  ) {
    errors.push(
      `pnpm-workspace.yaml: workspace globs must be exactly ${expectedWorkspaceGlobs.join(", ")}`,
    );
  }
}

function validateSchemasManifest(manifest) {
  if (manifest.dependencies?.zod !== expectedSchemasZodVersion) {
    errors.push(
      `packages/schemas/package.json: dependencies.zod must be the exact version ${expectedSchemasZodVersion}`,
    );
  }

  if (
    Object.keys(manifest.dependencies ?? {}).some(
      (dependency) => dependency !== "zod",
    )
  ) {
    errors.push(
      "packages/schemas/package.json: runtime dependencies must contain only zod for this change",
    );
  }

  if (Object.keys(manifest.devDependencies ?? {}).length > 0) {
    errors.push(
      "packages/schemas/package.json: build and test tools must remain root devDependencies",
    );
  }

  const exports = manifest.exports;
  const rootExport = exports?.["."];

  if (
    !exports ||
    Object.keys(exports).length !== 1 ||
    !rootExport ||
    Object.keys(rootExport).length !== 2 ||
    rootExport.types !== "./dist/index.d.ts" ||
    rootExport.import !== "./dist/index.js"
  ) {
    errors.push(
      'packages/schemas/package.json: exports must expose only "." with ./dist/index.js and ./dist/index.d.ts',
    );
  }

  const buildConfig = readJson("packages/schemas/tsconfig.build.json");

  if (!buildConfig) {
    return;
  }

  if (buildConfig.extends !== "./tsconfig.json") {
    errors.push(
      "packages/schemas/tsconfig.build.json: extends must be ./tsconfig.json",
    );
  }

  const compilerOptions = buildConfig.compilerOptions ?? {};

  if (compilerOptions.declaration !== true) {
    errors.push(
      "packages/schemas/tsconfig.build.json: compilerOptions.declaration must be true",
    );
  }

  if (compilerOptions.noEmit !== false) {
    errors.push(
      "packages/schemas/tsconfig.build.json: compilerOptions.noEmit must be false",
    );
  }

  if (compilerOptions.outDir !== "dist") {
    errors.push(
      'packages/schemas/tsconfig.build.json: compilerOptions.outDir must be "dist"',
    );
  }

  if (!arraysEqual(buildConfig.include, ["src/index.ts"])) {
    errors.push(
      "packages/schemas/tsconfig.build.json: include must contain only src/index.ts",
    );
  }
}

function validatePackageShells() {
  const packageNames = new Set(Object.values(expectedPackages));

  for (const [relative, expectedName] of Object.entries(expectedPackages)) {
    if (!requireDirectory(relative)) {
      continue;
    }

    const manifest = readJson(`${relative}/package.json`);

    if (!manifest) {
      continue;
    }

    if (manifest.name !== expectedName) {
      errors.push(`${relative}/package.json: name must be ${expectedName}`);
    }

    if (manifest.private !== true) {
      errors.push(`${relative}/package.json: package shell must be private`);
    }

    if (manifest.version !== expectedPackageVersion) {
      errors.push(
        `${relative}/package.json: version must be ${expectedPackageVersion}`,
      );
    }

    if (manifest.type !== "module") {
      errors.push(
        `${relative}/package.json: package shell must use type module`,
      );
    }

    const expectedScripts =
      relative === "packages/schemas"
        ? {
            build: "tsc --project tsconfig.build.json",
            test: "vitest run",
            typecheck: expectedTypecheckScript,
          }
        : { typecheck: expectedTypecheckScript };

    for (const [name, command] of Object.entries(expectedScripts)) {
      if (manifest.scripts?.[name] !== command) {
        errors.push(
          `${relative}/package.json: scripts.${name} must be ${JSON.stringify(command)}`,
        );
      }
    }

    if (
      Object.keys(manifest.scripts ?? {}).some(
        (script) => !Object.hasOwn(expectedScripts, script),
      )
    ) {
      errors.push(
        `${relative}/package.json: shell scripts must contain only ${Object.keys(expectedScripts).join(", ")}`,
      );
    }

    for (const field of ["exports", "main", "module", "bin"]) {
      if (
        field in manifest &&
        !(relative === "packages/schemas" && field === "exports")
      ) {
        errors.push(`${relative}/package.json: shell must not define ${field}`);
      }
    }

    if (relative === "packages/schemas") {
      validateSchemasManifest(manifest);
    }

    for (const section of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ]) {
      for (const [dependency, version] of Object.entries(
        manifest[section] ?? {},
      )) {
        if (!dependency.startsWith("@auren/")) {
          continue;
        }

        if (!packageNames.has(dependency)) {
          errors.push(
            `${relative}/package.json: ${section}.${dependency} does not match a workspace package name`,
          );
        } else if (version !== "workspace:*") {
          errors.push(
            `${relative}/package.json: ${section}.${dependency} must use workspace:*, got ${String(version)}`,
          );
        }
      }
    }
  }
}

function validateTypeScriptProfiles() {
  const universalOptions = [
    "strict",
    "target",
    "module",
    "moduleResolution",
    "skipLibCheck",
  ];
  const profiles = {
    "tsconfig.node.json": {
      lib: ["ES2022"],
    },
    "tsconfig.web.json": {
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      jsx: "react-jsx",
    },
  };

  for (const [relative, expectedOptions] of Object.entries(profiles)) {
    const profile = readJson(relative);

    if (!profile) {
      continue;
    }

    if (profile.extends !== "./tsconfig.base.json") {
      errors.push(`${relative}: extends must be ./tsconfig.base.json`);
    }

    if (!arraysEqual(profile.compilerOptions?.lib, expectedOptions.lib)) {
      errors.push(
        `${relative}: compilerOptions.lib must be ${expectedOptions.lib.join(", ")}`,
      );
    }

    if (
      expectedOptions.jsx &&
      profile.compilerOptions?.jsx !== expectedOptions.jsx
    ) {
      errors.push(
        `${relative}: compilerOptions.jsx must be ${expectedOptions.jsx}`,
      );
    }

    if (profile.compilerOptions?.noEmit !== true) {
      errors.push(`${relative}: compilerOptions.noEmit must be true`);
    }

    for (const option of universalOptions) {
      if (option in (profile.compilerOptions ?? {})) {
        errors.push(
          `${relative}: compilerOptions.${option} belongs in tsconfig.base.json`,
        );
      }
    }

    if ("paths" in (profile.compilerOptions ?? {})) {
      errors.push(
        `${relative}: compilerOptions.paths must not bypass workspace package boundaries`,
      );
    }
  }

  for (const [relative, expected] of Object.entries(
    expectedWorkspaceProfiles,
  )) {
    const configPath = `${relative}/tsconfig.json`;
    const tsconfig = readJson(configPath);

    if (!tsconfig) {
      continue;
    }

    if (tsconfig.extends !== expected.extends) {
      errors.push(`${configPath}: extends must be ${expected.extends}`);
    }

    if (!arraysEqual(tsconfig.include, expected.include)) {
      errors.push(
        `${configPath}: include must be exactly ${expected.include.join(", ")}`,
      );
    }

    if ("compilerOptions" in tsconfig) {
      errors.push(
        `${configPath}: compilerOptions must be inherited from the shared profile`,
      );
    }

    requireFile(`${relative}/src/index.ts`);
  }
}

function validateBiomeConfiguration() {
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

function validateWorkspaceRoots() {
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

function validateBlockCategories() {
  for (const relative of expectedBlocks) {
    if (!requireDirectory(relative)) {
      continue;
    }

    requireFile(`${relative}/.gitkeep`);
  }
}

function reportBlockPackageManifests(directory) {
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

function validateConfigurationFiles() {
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

function validateRequiredFiles() {
  for (const relative of [
    "pnpm-lock.yaml",
    ".gitignore",
    "README.md",
    "scripts/verify-workspace.mjs",
  ]) {
    requireFile(relative);
  }
}

validateRequiredFiles();
validateRootManifest();
validateWorkspaceManifest();
validateWorkspaceRoots();
validatePackageShells();
validateBlockCategories();
validateConfigurationFiles();
validateTypeScriptProfiles();
validateBiomeConfiguration();
reportBlockPackageManifests(absolutePath("blocks"));

if (errors.length > 0) {
  console.error("Workspace verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("Fix the reported path or manifest and run pnpm check again.");
  process.exitCode = 1;
} else {
  console.log("Workspace verification passed.");
  console.log(
    "- 6 private workspace package shells and TypeScript profiles verified",
  );
  console.log("- Root Biome and internal package alias contracts verified");
  console.log("- 4 block categories verified outside the workspace");
}
