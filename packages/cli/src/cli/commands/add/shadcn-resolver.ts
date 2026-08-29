import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { ProjectDetection } from "@auren/core/project";
import {
  InvalidShadcnAliasError,
  MissingShadcnConfigurationError,
  ShadcnComponentCollisionError,
  ShadcnComponentVerificationError,
} from "./add-errors.js";
import type {
  ShadcnRequirementPath,
  ShadcnRequirementResolution,
} from "./add-types.js";

type ShadcnDetectionInput = Pick<
  ProjectDetection,
  "projectDir" | "shadcn" | "aliases"
>;

export async function resolveShadcnUiDirectory(
  detection: ShadcnDetectionInput,
  components: readonly string[] = [],
): Promise<string> {
  const { projectDir, shadcn } = detection;

  const uiAlias =
    "uiAlias" in shadcn && typeof shadcn.uiAlias === "string"
      ? shadcn.uiAlias
      : null;

  if (!shadcn.detected || shadcn.configPath === null || uiAlias === null) {
    throw new MissingShadcnConfigurationError(components);
  }

  if (uiAlias.length === 0) {
    throw new InvalidShadcnAliasError(uiAlias, "the alias must not be empty");
  }

  validatePathFragment(uiAlias, uiAlias, "the alias");

  const mappedTarget = resolveTypeScriptAlias(
    uiAlias,
    detection.aliases.typescript.paths,
  );
  const absoluteDirectory =
    mappedTarget === null
      ? resolveRelativeAlias(projectDir, uiAlias)
      : resolveMappedAlias(
          projectDir,
          detection.aliases.typescript.baseUrl,
          mappedTarget.target,
          mappedTarget.capture,
          uiAlias,
        );

  await validateProjectBoundary(projectDir, absoluteDirectory, uiAlias);
  await validateDirectoryEntry(absoluteDirectory, uiAlias);

  return absoluteDirectory;
}

export const resolveShadcnAlias = resolveShadcnUiDirectory;

export async function resolveShadcnRequirements(
  detection: ShadcnDetectionInput,
  required: readonly string[],
): Promise<ShadcnRequirementResolution> {
  if (required.length === 0) {
    return {
      required: [],
      satisfied: [],
      missing: [],
      uiDirectory: "",
      paths: [],
    };
  }

  const uiDirectory = await resolveShadcnUiDirectory(detection, required);
  const tsx =
    "tsx" in detection.shadcn &&
    (typeof detection.shadcn.tsx === "boolean" || detection.shadcn.tsx === null)
      ? detection.shadcn.tsx
      : null;
  const expectedExtensions =
    tsx === true ? ["tsx"] : tsx === false ? ["jsx"] : ["tsx", "jsx"];
  const satisfied: string[] = [];
  const missing: string[] = [];
  const paths: ShadcnRequirementPath[] = [];

  for (const name of required) {
    validateComponentName(name);
    const expectedCandidates = expectedExtensions.map((extension) =>
      path.join(uiDirectory, `${name}.${extension}`),
    );
    const allCandidates = ["tsx", "jsx"].map((extension) =>
      path.join(uiDirectory, `${name}.${extension}`),
    );
    const existing = await findExistingComponentPaths(allCandidates, name);

    if (existing.length > 1) {
      throw new ShadcnComponentCollisionError(name, existing);
    }

    const expectedPath = expectedCandidates.find((candidate) =>
      existing.includes(candidate),
    );

    if (expectedPath !== undefined) {
      satisfied.push(name);
      paths.push({ name, path: expectedPath });
    } else {
      missing.push(name);
      paths.push({ name, path: expectedCandidates[0] });
    }
  }

  return { required, satisfied, missing, uiDirectory, paths };
}

export async function verifyShadcnRequirements(
  detection: ShadcnDetectionInput,
  required: readonly string[],
): Promise<ShadcnRequirementResolution> {
  const resolution = await resolveShadcnRequirements(detection, required);

  if (resolution.missing.length > 0) {
    throw new ShadcnComponentVerificationError(
      resolution.missing,
      resolution.uiDirectory,
    );
  }

  return resolution;
}

async function findExistingComponentPaths(
  candidates: readonly string[],
  component: string,
): Promise<string[]> {
  const existing: string[] = [];

  for (const candidate of candidates) {
    try {
      const entry = await lstat(candidate);

      if (!entry.isFile()) {
        throw new ShadcnComponentCollisionError(component, [candidate]);
      }

      existing.push(candidate);
    } catch (error) {
      if (error instanceof ShadcnComponentCollisionError) {
        throw error;
      }

      if (!isMissingPathError(error)) {
        throw error;
      }
    }
  }

  return existing;
}

function validateComponentName(name: string): void {
  if (!shadcnNamePattern.test(name)) {
    throw new InvalidShadcnAliasError(
      name,
      "the component name must use lowercase kebab-case",
    );
  }
}

function resolveTypeScriptAlias(
  alias: string,
  paths: Readonly<Record<string, readonly string[]>>,
): { readonly target: string; readonly capture: string } | null {
  const matches: Array<{ readonly target: string; readonly capture: string }> =
    [];

  for (const [pattern, targets] of Object.entries(paths)) {
    const capture = matchAliasPattern(alias, pattern);

    if (capture === null) {
      continue;
    }

    if (targets.length !== 1 || typeof targets[0] !== "string") {
      throw new InvalidShadcnAliasError(
        alias,
        `TypeScript path mapping ${pattern} must contain exactly one string target`,
      );
    }

    matches.push({ target: targets[0], capture });
  }

  if (matches.length > 1) {
    throw new InvalidShadcnAliasError(
      alias,
      "the TypeScript path matches more than one mapping",
    );
  }

  return matches[0] ?? null;
}

function matchAliasPattern(alias: string, pattern: string): string | null {
  const wildcardIndex = pattern.indexOf("*");

  if (wildcardIndex === -1) {
    return alias === pattern ? "" : null;
  }

  if (pattern.indexOf("*", wildcardIndex + 1) !== -1) {
    return null;
  }

  const prefix = pattern.slice(0, wildcardIndex);
  const suffix = pattern.slice(wildcardIndex + 1);

  if (
    !alias.startsWith(prefix) ||
    !alias.endsWith(suffix) ||
    alias.length < prefix.length + suffix.length
  ) {
    return null;
  }

  return alias.slice(prefix.length, alias.length - suffix.length);
}

function resolveMappedAlias(
  projectDir: string,
  baseUrl: string | null,
  target: string,
  capture: string,
  alias: string,
): string {
  validatePathFragment(baseUrl ?? ".", alias, "baseUrl");
  validatePathFragment(target, alias, "the TypeScript target", true);

  const wildcardCount = [...target].filter(
    (character) => character === "*",
  ).length;

  if (wildcardCount > 1 || (wildcardCount === 0 && capture !== "")) {
    throw new InvalidShadcnAliasError(
      alias,
      "the TypeScript path mapping cannot safely substitute the alias",
    );
  }

  const substituted = target.replace("*", capture);
  return path.resolve(projectDir, baseUrl ?? ".", ...substituted.split("/"));
}

function resolveRelativeAlias(projectDir: string, alias: string): string {
  validatePathFragment(alias, alias, "the alias");

  if (alias.startsWith("@") || alias.startsWith("~")) {
    throw new InvalidShadcnAliasError(
      alias,
      "no verified TypeScript or JavaScript path mapping was found",
    );
  }

  return path.resolve(projectDir, ...alias.split("/"));
}

function validatePathFragment(
  value: string,
  alias: string,
  label: string,
  allowWildcard = false,
): void {
  if (
    value.length === 0 ||
    value.includes("\\") ||
    value.includes("\u0000") ||
    (!allowWildcard && value.includes("*")) ||
    path.isAbsolute(value) ||
    /^[A-Za-z]:/.test(value) ||
    value.split("/").some((segment) => segment === ".." || segment.length === 0)
  ) {
    throw new InvalidShadcnAliasError(
      alias,
      `${label} is absolute, empty, malformed, or escapes the project`,
    );
  }
}

async function validateProjectBoundary(
  projectDir: string,
  directory: string,
  alias: string,
): Promise<void> {
  const projectRealPath = await realpath(projectDir);
  let candidate = directory;

  while (true) {
    try {
      const candidateRealPath = await realpath(candidate);
      const relative = path.relative(projectRealPath, candidateRealPath);

      if (
        path.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`)
      ) {
        throw new InvalidShadcnAliasError(
          alias,
          "the resolved UI directory escapes the project",
        );
      }

      return;
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      const parent = path.dirname(candidate);

      if (parent === candidate) {
        throw new InvalidShadcnAliasError(
          alias,
          "the resolved UI directory escapes the project",
        );
      }

      candidate = parent;
    }
  }
}

async function validateDirectoryEntry(
  directory: string,
  alias: string,
): Promise<void> {
  try {
    const entry = await lstat(directory);

    if (!entry.isDirectory()) {
      throw new InvalidShadcnAliasError(
        alias,
        "the resolved UI path exists but is not a directory",
      );
    }
  } catch (error) {
    if (
      error instanceof InvalidShadcnAliasError ||
      !isMissingPathError(error)
    ) {
      throw error;
    }
  }
}

const shadcnNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
