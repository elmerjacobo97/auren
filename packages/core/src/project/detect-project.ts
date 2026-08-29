import path from "node:path";
import { diagnostic } from "./diagnostics.js";
import { directoryExists, normalizeProjectDir } from "./fs.js";
import { readOptionalJson } from "./json.js";
import { asObject } from "./object.js";
import { collectDependencies } from "./package-manifest.js";
import { detectPackageManager } from "./package-manager.js";
import {
  extractTypeScriptAliases,
  readProjectConfig,
} from "./project-config.js";
import { detectShadcn } from "./shadcn.js";
import { detectTailwind } from "./tailwind.js";
import type {
  JsonObject,
  ProjectDetection,
  ProjectDetectionDiagnostic,
} from "./types.js";

export type {
  AliasDetection,
  PackageManagerDetection,
  PackageManagerEvidence,
  PackageManagerName,
  ProjectDetection,
  ProjectDetectionDiagnostic,
  ProjectDetectionDiagnosticCode,
  ProjectDetectionDiagnosticSeverity,
  ShadcnDetection,
  SourceLayoutDetection,
  TailwindDetection,
  TypeScriptAliasDetection,
} from "./types.js";
export { ProjectDetectionError } from "./project-detection-error.js";

export async function detectProject(
  projectDir = process.cwd(),
): Promise<ProjectDetection> {
  const absoluteProjectDir = await normalizeProjectDir(projectDir);
  const diagnostics: ProjectDetectionDiagnostic[] = [];
  const manifest = await readPackageManifest(absoluteProjectDir, diagnostics);
  const dependencies = collectDependencies(manifest);
  const projectConfig = await readProjectConfig(absoluteProjectDir);
  diagnostics.push(...projectConfig.diagnostics);

  const [tailwind, shadcn, packageManager, hasSrcDirectory] = await Promise.all(
    [
      detectTailwind(absoluteProjectDir, dependencies, diagnostics),
      detectShadcn(absoluteProjectDir, diagnostics),
      detectPackageManager(absoluteProjectDir, manifest, diagnostics),
      directoryExists(path.join(absoluteProjectDir, "src")),
    ],
  );
  const typescriptAliases = extractTypeScriptAliases(
    projectConfig.selectedPath,
    projectConfig.merged,
  );

  return {
    projectDir: absoluteProjectDir,
    framework: dependencies.react ? "react" : null,
    typescript: Boolean(
      dependencies.typescript || projectConfig.selectedPath === "tsconfig.json",
    ),
    tailwind,
    shadcn,
    source: { hasSrcDirectory },
    aliases: {
      typescript: typescriptAliases,
      shadcn: shadcn.aliases,
    },
    packageManager,
    diagnostics,
  };
}

async function readPackageManifest(
  projectDir: string,
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<JsonObject | null> {
  const packageJson = await readOptionalJson(
    projectDir,
    "package.json",
    "json",
  );

  if (packageJson.state === "parsed") {
    return asObject(packageJson.value);
  }

  if (packageJson.state === "unreadable" || packageJson.state === "malformed") {
    diagnostics.push(
      diagnostic(
        packageJson.state === "malformed" ? "error" : "warning",
        packageJson.state === "malformed"
          ? "malformed-json"
          : "unreadable-file",
        "Could not read package.json",
        "package.json",
        packageJson.cause,
      ),
    );
  }

  return null;
}
