import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

const expectedPackageManager = "pnpm@11.21.0";
const expectedNodeEngine = ">=20.19.0 <26";
const expectedWorkspaceGlobs = ["apps/*", "packages/*"];
const expectedPackages = {
  "apps/web": "@auren/web",
  "packages/schemas": "@auren/schemas",
  "packages/registry": "@auren/registry",
  "packages/core": "@auren/core",
  "packages/cli": "@auren/cli",
  "packages/mcp": "@auren/mcp"
};
const expectedBlocks = [
  "blocks/marketing",
  "blocks/application",
  "blocks/ecommerce",
  "blocks/authentication"
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
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function validateRootManifest() {
  const manifest = readJson("package.json");

  if (!manifest) {
    return;
  }

  if (manifest.private !== true) {
    errors.push("package.json: root package must be private");
  }

  if (manifest.packageManager !== expectedPackageManager) {
    errors.push(
      `package.json: packageManager must be ${expectedPackageManager}, got ${String(manifest.packageManager)}`
    );
  }

  if (manifest.engines?.node !== expectedNodeEngine) {
    errors.push(
      `package.json: engines.node must be ${expectedNodeEngine}, got ${String(manifest.engines?.node)}`
    );
  }

  if (manifest.engines?.pnpm !== "11.21.0") {
    errors.push(
      `package.json: engines.pnpm must be 11.21.0, got ${String(manifest.engines?.pnpm)}`
    );
  }

  const expectedScripts = {
    check: "node scripts/verify-workspace.mjs",
    build: "turbo run build",
    dev: "turbo run dev",
    typecheck: "turbo run typecheck"
  };

  for (const [name, command] of Object.entries(expectedScripts)) {
    if (manifest.scripts?.[name] !== command) {
      errors.push(`package.json: scripts.${name} must be ${JSON.stringify(command)}`);
    }
  }

  for (const dependency of ["turbo", "typescript"]) {
    const version = manifest.devDependencies?.[dependency];

    if (!hasExactVersion(version)) {
      errors.push(
        `package.json: devDependencies.${dependency} must use an exact semver version, got ${String(version)}`
      );
    }
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

  const globs = [...workspace.matchAll(/^\s*-\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/gm)].map(
    (match) => match[1]
  );

  if (
    globs.length !== expectedWorkspaceGlobs.length ||
    globs.some((glob, index) => glob !== expectedWorkspaceGlobs[index])
  ) {
    errors.push(
      `pnpm-workspace.yaml: workspace globs must be exactly ${expectedWorkspaceGlobs.join(", ")}`
    );
  }
}

function validatePackageShells() {
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

    if (manifest.type !== "module") {
      errors.push(`${relative}/package.json: package shell must use type module`);
    }

    for (const field of [
      "exports",
      "main",
      "module",
      "bin",
      "scripts",
      "dependencies",
      "devDependencies"
    ]) {
      if (field in manifest) {
        errors.push(`${relative}/package.json: shell must not define ${field}`);
      }
    }
  }
}

function validateWorkspaceRoots() {
  const expectedRoots = new Map([
    ["apps", new Set(["web"])],
    ["packages", new Set(["schemas", "registry", "core", "cli", "mcp"])]
  ]);

  for (const [rootName, expectedChildren] of expectedRoots) {
    if (!requireDirectory(rootName)) {
      continue;
    }

    const actualChildren = new Set(
      readdirSync(absolutePath(rootName), { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    );

    for (const child of expectedChildren) {
      if (!actualChildren.has(child)) {
        errors.push(`${rootName}/${child}: required workspace directory is missing`);
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
      errors.push(`${relativePath(entryPath)}: blocks must not contain package manifests`);
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
    errors.push("tsconfig.base.json: compilerOptions.moduleResolution must be Bundler");
  }

  if (compilerOptions?.target !== "ES2022") {
    errors.push("tsconfig.base.json: compilerOptions.target must be ES2022");
  }

  if (compilerOptions?.skipLibCheck !== true) {
    errors.push("tsconfig.base.json: compilerOptions.skipLibCheck must be true");
  }

  const turbo = readJson("turbo.json");
  const tasks = turbo?.tasks;

  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) {
    errors.push("turbo.json: tasks must be an object");
    return;
  }

  if (!Array.isArray(tasks.build?.dependsOn) || !tasks.build.dependsOn.includes("^build")) {
    errors.push('turbo.json: tasks.build.dependsOn must include "^build"');
  }

  if (
    !Array.isArray(tasks.typecheck?.dependsOn) ||
    !tasks.typecheck.dependsOn.includes("^typecheck")
  ) {
    errors.push('turbo.json: tasks.typecheck.dependsOn must include "^typecheck"');
  }

  if (tasks.dev?.cache !== false) {
    errors.push("turbo.json: tasks.dev.cache must be false");
  }

  if (tasks.dev?.persistent !== true) {
    errors.push("turbo.json: tasks.dev.persistent must be true");
  }
}

function validateRequiredFiles() {
  for (const relative of ["pnpm-lock.yaml", ".gitignore", "README.md", "scripts/verify-workspace.mjs"]) {
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
  console.log("- 6 private workspace package shells verified");
  console.log("- 4 block categories verified outside the workspace");
}
