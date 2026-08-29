import path from "node:path";
import { diagnostic } from "./diagnostics.js";
import { fileExists } from "./fs.js";
import { readOptionalJson } from "./json.js";
import { asObject } from "./object.js";
import type {
  JsonObject,
  ProjectDetectionDiagnostic,
  TypeScriptAliasDetection,
} from "./types.js";

export type ProjectConfigRead = {
  readonly selectedPath: string | null;
  readonly merged: JsonObject | null;
  readonly diagnostics: readonly ProjectDetectionDiagnostic[];
};

export async function readProjectConfig(
  projectDir: string,
): Promise<ProjectConfigRead> {
  const rootPath = await selectRootProjectConfig(projectDir);

  if (!rootPath) {
    return { selectedPath: null, merged: null, diagnostics: [] };
  }

  const diagnostics: ProjectDetectionDiagnostic[] = [];
  const merged = await readConfigWithExtends(
    projectDir,
    rootPath,
    [],
    diagnostics,
  );

  return { selectedPath: rootPath, merged, diagnostics };
}

export function extractTypeScriptAliases(
  configPath: string | null,
  config: JsonObject | null,
): TypeScriptAliasDetection {
  const compilerOptions = asObject(config?.compilerOptions);
  const paths = asObject(compilerOptions?.paths);
  const rawBaseUrl = compilerOptions?.baseUrl;
  const extractedPaths: Record<string, readonly string[]> = {};

  for (const [alias, values] of Object.entries(paths ?? {})) {
    if (
      Array.isArray(values) &&
      values.every((value) => typeof value === "string")
    ) {
      extractedPaths[alias] = values;
    }
  }

  return {
    configPath,
    baseUrl: typeof rawBaseUrl === "string" ? rawBaseUrl : null,
    paths: extractedPaths,
  };
}

async function selectRootProjectConfig(
  projectDir: string,
): Promise<string | null> {
  if (await fileExists(path.join(projectDir, "tsconfig.json"))) {
    return "tsconfig.json";
  }

  if (await fileExists(path.join(projectDir, "jsconfig.json"))) {
    return "jsconfig.json";
  }

  return null;
}

async function readConfigWithExtends(
  projectDir: string,
  relativePath: string,
  seen: readonly string[],
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<JsonObject | null> {
  if (seen.includes(relativePath)) {
    diagnostics.push(
      diagnostic(
        "warning",
        "config-extends-cycle",
        `Project config extends cycle includes ${relativePath}`,
        relativePath,
      ),
    );
    return null;
  }

  if (seen.length >= 8) {
    diagnostics.push(
      diagnostic(
        "warning",
        "config-extends-depth-exceeded",
        "Project config extends traversal exceeded the maximum depth",
        relativePath,
      ),
    );
    return null;
  }

  const parsed = await readOptionalJson(projectDir, relativePath, "jsonc");

  if (parsed.state === "absent") {
    diagnostics.push(
      diagnostic(
        "warning",
        "unreadable-file",
        `Project config ${relativePath} is missing`,
        relativePath,
      ),
    );
    return null;
  }

  if (parsed.state !== "parsed") {
    diagnostics.push(
      diagnostic(
        parsed.state === "malformed" ? "error" : "warning",
        parsed.state === "malformed" ? "malformed-json" : "unreadable-file",
        `Could not read project config ${relativePath}`,
        relativePath,
        parsed.cause,
      ),
    );
    return null;
  }

  const ownConfig = asObject(parsed.value);

  if (!ownConfig) {
    diagnostics.push(
      diagnostic(
        "error",
        "malformed-json",
        `Project config ${relativePath} must be an object`,
        relativePath,
      ),
    );
    return null;
  }

  const baseConfig = await readBaseConfig(
    projectDir,
    relativePath,
    ownConfig.extends,
    seen,
    diagnostics,
  );

  return mergeConfig(baseConfig, ownConfig);
}

async function readBaseConfig(
  projectDir: string,
  relativePath: string,
  extendsValue: unknown,
  seen: readonly string[],
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<JsonObject | null> {
  if (extendsValue === undefined) {
    return null;
  }

  if (typeof extendsValue !== "string") {
    diagnostics.push(
      diagnostic(
        "warning",
        "unsupported-config-extends",
        `Project config ${relativePath} has an unsupported extends value`,
        relativePath,
      ),
    );
    return null;
  }

  const nextPath = resolveExtendsPath(projectDir, relativePath, extendsValue);

  if (nextPath.status === "error") {
    diagnostics.push(
      diagnostic("warning", nextPath.code, nextPath.message, relativePath),
    );
    return null;
  }

  return readConfigWithExtends(
    projectDir,
    nextPath.relativePath,
    [...seen, relativePath],
    diagnostics,
  );
}

function resolveExtendsPath(
  projectDir: string,
  fromRelativePath: string,
  extendsValue: string,
):
  | { readonly status: "ok"; readonly relativePath: string }
  | {
      readonly status: "error";
      readonly code: "unsupported-config-extends" | "external-config-extends";
      readonly message: string;
    } {
  if (!extendsValue.startsWith(".")) {
    return {
      status: "error",
      code: "unsupported-config-extends",
      message: `Package-based project config extends are not followed: ${extendsValue}`,
    };
  }

  const fromDir = path.dirname(path.join(projectDir, fromRelativePath));
  const rawTarget = path.resolve(fromDir, extendsValue);
  const candidates = path.extname(rawTarget)
    ? [rawTarget]
    : [`${rawTarget}.json`, rawTarget];
  const target = candidates[0];
  const relative = path.relative(projectDir, target);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return {
      status: "error",
      code: "external-config-extends",
      message: `Project config extends outside the requested project directory: ${extendsValue}`,
    };
  }

  return { status: "ok", relativePath: relative.split(path.sep).join("/") };
}

function mergeConfig(
  baseConfig: JsonObject | null,
  childConfig: JsonObject,
): JsonObject {
  const baseCompilerOptions = asObject(baseConfig?.compilerOptions);
  const childCompilerOptions = asObject(childConfig.compilerOptions);

  return {
    ...(baseConfig ?? {}),
    ...childConfig,
    compilerOptions: {
      ...(baseCompilerOptions ?? {}),
      ...(childCompilerOptions ?? {}),
      paths: {
        ...(asObject(baseCompilerOptions?.paths) ?? {}),
        ...(asObject(childCompilerOptions?.paths) ?? {}),
      },
    },
  };
}
