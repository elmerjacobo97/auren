import {
  errors,
  expectedCliBin,
  expectedCliDependencies,
  expectedCliScripts,
  expectedCoreExports,
  expectedNodeEngine,
  expectedPackageManager,
  expectedPackageVersion,
  expectedRegistryBuildScript,
  expectedRegistryExports,
  expectedSchemasExports,
  expectedSchemasZodVersion,
  expectedTypecheckScript,
  expectedVitestVersion,
  expectedWebDependencies,
  expectedWebDevDependencies,
  expectedWebScripts,
  expectedWorkspaceGlobs,
  expectedPackages,
  hasExactVersion,
  readJson,
  readText,
  requireDirectory,
  requireFile,
  arraysEqual,
} from "./context.mjs";

export function validateRootManifest() {
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
    check:
      "pnpm --filter @auren/schemas build && node scripts/verify-workspace.mjs && node scripts/verify-blocks.mjs && node scripts/verify-collections.mjs",
    build: "turbo run build && pnpm registry:publish",
    dev: "turbo run dev",
    "registry:build":
      "pnpm --filter @auren/schemas build && node scripts/build-registry.mjs",
    "registry:publish":
      "pnpm registry:build && node scripts/publish-registry.mjs",
    test: "pnpm --filter @auren/schemas build && node --test scripts/verify-blocks.test.mjs scripts/verify-collections.test.mjs scripts/verify-workspace.test.mjs scripts/registry-build.test.mjs scripts/registry-publish.test.mjs && turbo run test",
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

  if (manifest.devDependencies?.["@auren/schemas"] !== "workspace:*") {
    errors.push(
      "package.json: devDependencies.@auren/schemas must use workspace:*",
    );
  }
}

export function validateWorkspaceManifest() {
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

export function validateSchemasManifest(manifest) {
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
  const exportNames = Object.keys(exports ?? {});
  const hasExpectedExports = Object.entries(expectedSchemasExports).every(
    ([name, expected]) => {
      const entry = exports?.[name];

      return (
        entry &&
        Object.keys(entry).length === 2 &&
        entry.import === expected.import &&
        entry.types === expected.types
      );
    },
  );

  if (
    !exports ||
    exportNames.length !== Object.keys(expectedSchemasExports).length ||
    exportNames.some((name) => !Object.hasOwn(expectedSchemasExports, name)) ||
    !hasExpectedExports
  ) {
    errors.push(
      "packages/schemas/package.json: exports must expose only the catalog, element, taxonomy, configuration, and collection capability entrypoints",
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

  if (
    !arraysEqual(buildConfig.include, [
      "src/catalog/element-schema.ts",
      "src/element/structural-schema.ts",
      "src/taxonomy/schema.ts",
      "src/configuration/schema.ts",
      "src/collection/schema.ts",
      "src/preview/schema.ts",
    ])
  ) {
    errors.push(
      "packages/schemas/tsconfig.build.json: include must contain only the six public capability entrypoints",
    );
  }
}

export function validateRegistryManifest(manifest) {
  if (
    Object.keys(manifest.dependencies ?? {}).length !== 1 ||
    manifest.dependencies?.["@auren/schemas"] !== "workspace:*"
  ) {
    errors.push(
      "packages/registry/package.json: runtime dependencies must contain only @auren/schemas at workspace:*",
    );
  }

  if (Object.keys(manifest.devDependencies ?? {}).length > 0) {
    errors.push(
      "packages/registry/package.json: build and test tools must remain root devDependencies",
    );
  }

  const exports = manifest.exports;
  const entry = exports?.["."];

  if (
    !exports ||
    Object.keys(exports).length !== 1 ||
    !entry ||
    Object.keys(entry).length !== 2 ||
    entry.import !== expectedRegistryExports["."].import ||
    entry.types !== expectedRegistryExports["."].types
  ) {
    errors.push(
      "packages/registry/package.json: exports must expose only the generated root ESM entrypoint and declarations",
    );
  }

  const buildConfig = readJson("packages/registry/tsconfig.build.json");

  if (!buildConfig) {
    return;
  }

  if (buildConfig.extends !== "./tsconfig.json") {
    errors.push(
      "packages/registry/tsconfig.build.json: extends must be ./tsconfig.json",
    );
  }

  const compilerOptions = buildConfig.compilerOptions ?? {};

  if (compilerOptions.declaration !== true) {
    errors.push(
      "packages/registry/tsconfig.build.json: compilerOptions.declaration must be true",
    );
  }

  if (compilerOptions.noEmit !== false) {
    errors.push(
      "packages/registry/tsconfig.build.json: compilerOptions.noEmit must be false",
    );
  }

  if (compilerOptions.outDir !== "dist") {
    errors.push(
      'packages/registry/tsconfig.build.json: compilerOptions.outDir must be "dist"',
    );
  }

  if (compilerOptions.rootDir !== "src") {
    errors.push(
      'packages/registry/tsconfig.build.json: compilerOptions.rootDir must be "src"',
    );
  }

  if (!arraysEqual(buildConfig.include, ["src/index.ts"])) {
    errors.push(
      "packages/registry/tsconfig.build.json: include must contain only src/index.ts",
    );
  }

  requireFile("packages/registry/vitest.config.ts");
  requireFile("packages/registry/scripts/verify-dist.mjs");
}

export function validateCoreManifest(manifest) {
  const expectedDependencies = {
    "@auren/registry": "workspace:*",
    "@auren/schemas": "workspace:*",
    semver: "7.7.2",
  };

  for (const [dependency, version] of Object.entries(expectedDependencies)) {
    if (manifest.dependencies?.[dependency] !== version) {
      errors.push(
        `packages/core/package.json: runtime dependency ${dependency} must be ${version}`,
      );
    }
  }

  if (
    Object.keys(manifest.dependencies ?? {}).some(
      (dependency) => !Object.hasOwn(expectedDependencies, dependency),
    )
  ) {
    errors.push(
      "packages/core/package.json: runtime dependencies must contain only the pinned Core dependencies",
    );
  }

  if (Object.keys(manifest.devDependencies ?? {}).length > 0) {
    errors.push(
      "packages/core/package.json: build and test tools must remain root devDependencies",
    );
  }

  const exports = manifest.exports;
  const exportNames = Object.keys(exports ?? {});
  const hasExpectedExports = Object.entries(expectedCoreExports).every(
    ([name, expected]) => {
      const entry = exports?.[name];

      return (
        entry &&
        Object.keys(entry).length === 2 &&
        entry.import === expected.import &&
        entry.types === expected.types
      );
    },
  );

  if (
    !exports ||
    exportNames.length !== Object.keys(expectedCoreExports).length ||
    exportNames.some((name) => !Object.hasOwn(expectedCoreExports, name)) ||
    !hasExpectedExports
  ) {
    errors.push(
      "packages/core/package.json: exports must expose only the generated Core capability entrypoints and declarations",
    );
  }

  const buildConfig = readJson("packages/core/tsconfig.build.json");

  if (!buildConfig) {
    return;
  }

  if (buildConfig.extends !== "./tsconfig.json") {
    errors.push(
      "packages/core/tsconfig.build.json: extends must be ./tsconfig.json",
    );
  }

  const compilerOptions = buildConfig.compilerOptions ?? {};

  if (compilerOptions.declaration !== true) {
    errors.push(
      "packages/core/tsconfig.build.json: compilerOptions.declaration must be true",
    );
  }

  if (compilerOptions.noEmit !== false) {
    errors.push(
      "packages/core/tsconfig.build.json: compilerOptions.noEmit must be false",
    );
  }

  if (compilerOptions.outDir !== "dist") {
    errors.push(
      'packages/core/tsconfig.build.json: compilerOptions.outDir must be "dist"',
    );
  }

  if (compilerOptions.rootDir !== "src") {
    errors.push(
      'packages/core/tsconfig.build.json: compilerOptions.rootDir must be "src"',
    );
  }

  if (
    !arraysEqual(buildConfig.include, [
      "src/search/search.ts",
      "src/resolve/resolve.ts",
      "src/dependencies/dependency-plan.ts",
      "src/load/load-block-metadata.ts",
      "src/load/load-block-files.ts",
      "src/compatibility/compatibility.ts",
      "src/project/detect-project.ts",
      "src/configuration/configuration.ts",
    ])
  ) {
    errors.push(
      "packages/core/tsconfig.build.json: include must contain only the eight Core capability entrypoints",
    );
  }

  requireFile("packages/core/vitest.config.ts");
  requireFile("packages/core/scripts/verify-dist.mjs");
}

export function validateCliManifest(manifest) {
  if (
    Object.keys(manifest.dependencies ?? {}).length !==
      Object.keys(expectedCliDependencies).length ||
    Object.entries(expectedCliDependencies).some(
      ([dependency, version]) =>
        manifest.dependencies?.[dependency] !== version,
    )
  ) {
    errors.push(
      "packages/cli/package.json: runtime dependencies must contain only the pinned Commander, @clack/prompts, picocolors, and the Auren workspace packages at workspace:*",
    );
  }

  for (const section of [
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    if (Object.keys(manifest[section] ?? {}).length > 0) {
      errors.push(
        `packages/cli/package.json: ${section} must remain empty for the executable package`,
      );
    }
  }

  if (
    !manifest.bin ||
    Object.keys(manifest.bin).length !== Object.keys(expectedCliBin).length ||
    Object.entries(expectedCliBin).some(
      ([name, target]) => manifest.bin[name] !== target,
    )
  ) {
    errors.push(
      'packages/cli/package.json: bin must map only "auren" to "dist/index.js"',
    );
  }

  const buildConfig = readJson("packages/cli/tsconfig.build.json");

  if (buildConfig) {
    if (buildConfig.extends !== "./tsconfig.json") {
      errors.push(
        "packages/cli/tsconfig.build.json: extends must be ./tsconfig.json",
      );
    }

    const compilerOptions = buildConfig.compilerOptions ?? {};

    if (compilerOptions.noEmit !== false) {
      errors.push(
        "packages/cli/tsconfig.build.json: compilerOptions.noEmit must be false",
      );
    }

    if (compilerOptions.outDir !== "dist") {
      errors.push(
        'packages/cli/tsconfig.build.json: compilerOptions.outDir must be "dist"',
      );
    }

    if (compilerOptions.rootDir !== "src/cli") {
      errors.push(
        'packages/cli/tsconfig.build.json: compilerOptions.rootDir must be "src/cli"',
      );
    }

    if (compilerOptions.sourceMap !== true) {
      errors.push(
        "packages/cli/tsconfig.build.json: compilerOptions.sourceMap must be true",
      );
    }

    if (!arraysEqual(buildConfig.include, ["src/cli/index.ts"])) {
      errors.push(
        "packages/cli/tsconfig.build.json: include must contain only src/cli/index.ts",
      );
    }
  }

  const entrypoint = readText("packages/cli/src/cli/index.ts");

  if (entrypoint !== null && !entrypoint.startsWith("#!/usr/bin/env node")) {
    errors.push(
      "packages/cli/src/cli/index.ts: executable entrypoint must start with a Node shebang",
    );
  }

  requireFile("packages/cli/vitest.config.ts");
  requireFile("packages/cli/scripts/verify-dist.mjs");
}

function validateWebManifest(manifest) {
  const expectedDependencies = {
    dependencies: expectedWebDependencies,
    devDependencies: expectedWebDevDependencies,
  };

  for (const [section, expected] of Object.entries(expectedDependencies)) {
    const actual = manifest[section] ?? {};

    if (
      Object.keys(actual).length !== Object.keys(expected).length ||
      Object.entries(expected).some(
        ([dependency, version]) => actual[dependency] !== version,
      )
    ) {
      errors.push(
        `apps/web/package.json: ${section} must contain only the pinned web dependencies`,
      );
    }
  }

  if (manifest.dependencies?.["@auren/schemas"] !== "workspace:*") {
    errors.push(
      "apps/web/package.json: dependencies.@auren/schemas must use the public workspace entrypoint at workspace:*",
    );
  }
}

export function validatePackageShells() {
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

    let expectedScripts;

    if (relative === "packages/schemas") {
      expectedScripts = {
        build: "tsc --project tsconfig.build.json",
        test: "vitest run",
        typecheck: expectedTypecheckScript,
      };
    } else if (
      relative === "packages/registry" ||
      relative === "packages/core"
    ) {
      expectedScripts = {
        build: expectedRegistryBuildScript,
        test: "vitest run",
        typecheck: expectedTypecheckScript,
      };
    } else if (relative === "packages/cli") {
      expectedScripts = expectedCliScripts;
    } else if (relative === "apps/web") {
      expectedScripts = expectedWebScripts;
      validateWebManifest(manifest);
    } else {
      expectedScripts = { typecheck: expectedTypecheckScript };
    }

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
        !(
          ((relative === "packages/schemas" ||
            relative === "packages/registry" ||
            relative === "packages/core") &&
            field === "exports") ||
          (relative === "packages/cli" && field === "bin")
        )
      ) {
        errors.push(`${relative}/package.json: shell must not define ${field}`);
      }
    }

    if (relative === "packages/schemas") {
      validateSchemasManifest(manifest);
    } else if (relative === "packages/registry") {
      validateRegistryManifest(manifest);
    } else if (relative === "packages/core") {
      validateCoreManifest(manifest);
    } else if (relative === "packages/cli") {
      validateCliManifest(manifest);
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
