import {
  arraysEqual,
  errors,
  expectedCliPaths,
  expectedCorePaths,
  expectedRegistryPaths,
  expectedSchemasPaths,
  expectedWorkspaceProfiles,
  readJson,
  requireFile,
} from "./context.mjs";

export function validateTypeScriptProfiles() {
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

    if (relative === "packages/schemas") {
      const compilerOptions = tsconfig.compilerOptions ?? {};
      const paths = compilerOptions.paths ?? {};

      if (
        Object.keys(paths).length !==
          Object.keys(expectedSchemasPaths).length ||
        Object.entries(expectedSchemasPaths).some(
          ([alias, expectedTargets]) =>
            !arraysEqual(paths[alias], expectedTargets),
        )
      ) {
        errors.push(
          `${configPath}: compilerOptions.paths must contain only the declared schemas capability aliases`,
        );
      }
    } else if (relative === "packages/registry") {
      const compilerOptions = tsconfig.compilerOptions ?? {};
      const paths = compilerOptions.paths ?? {};

      if (
        Object.keys(paths).length !==
          Object.keys(expectedRegistryPaths).length ||
        Object.entries(expectedRegistryPaths).some(
          ([alias, expectedTargets]) =>
            !arraysEqual(paths[alias], expectedTargets),
        )
      ) {
        errors.push(
          `${configPath}: compilerOptions.paths must contain only the schemas capability aliases used by Registry`,
        );
      }
    } else if (relative === "packages/core") {
      const compilerOptions = tsconfig.compilerOptions ?? {};
      const paths = compilerOptions.paths ?? {};

      if (
        Object.keys(paths).length !== Object.keys(expectedCorePaths).length ||
        Object.entries(expectedCorePaths).some(
          ([alias, expectedTargets]) =>
            !arraysEqual(paths[alias], expectedTargets),
        )
      ) {
        errors.push(
          `${configPath}: compilerOptions.paths must contain only the source alias and the Registry and Schemas capability aliases used by Core`,
        );
      }
    } else if (relative === "packages/cli") {
      const compilerOptions = tsconfig.compilerOptions ?? {};
      const paths = compilerOptions.paths ?? {};

      if (
        Object.keys(paths).length !== Object.keys(expectedCliPaths).length ||
        Object.entries(expectedCliPaths).some(
          ([alias, expectedTargets]) =>
            !arraysEqual(paths[alias], expectedTargets),
        )
      ) {
        errors.push(
          `${configPath}: compilerOptions.paths must contain only the Core and Schemas capability aliases used by the CLI`,
        );
      }
    } else if ("compilerOptions" in tsconfig) {
      errors.push(
        `${configPath}: compilerOptions must be inherited from the shared profile`,
      );
    }

    if (relative === "apps/web") {
      requireFile(`${relative}/index.html`);
    }

    for (const entrypoint of expected.entrypoints) {
      requireFile(`${relative}/${entrypoint}`);
    }
  }
}
