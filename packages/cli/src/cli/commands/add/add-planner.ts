import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import {
  readAurenConfig,
  type AurenConfiguration,
} from "@auren/core/configuration";
import { validateCompatibility } from "@auren/core/compatibility";
import {
  resolveProjectCollectionDependencies,
  resolveProjectDependencies,
} from "@auren/core/dependencies";
import { MissingBlockFileError } from "@auren/core/load/files";
import type { ResolvedBlockFile } from "@auren/core/load/files";
import { detectProject, type ProjectDetection } from "@auren/core/project";
import {
  resolveBlock,
  resolveCollection,
  UnknownCollectionError,
} from "@auren/core/resolve";
import { LocalRegistry } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";
import type { Feature } from "@auren/schemas/taxonomy";
import {
  InvalidInstallAliasError,
  DuplicateInstallTargetError,
  ExistingInstallTargetError,
  IncompatibleCatalogElementError,
  IncompatibleProjectError,
  MissingAurenConfigurationError,
  MissingInstallSourceFileError,
  MissingInstallableRecordError,
  InvalidShadcnConfigurationError,
  MissingPackageManagerError,
  UnsafeInstallTargetError,
} from "./add-errors.js";
import type {
  AddInstallationPlan,
  AddInstallationPlanOptions,
  AddPlannedFile,
} from "./add-types.js";
import { parseAddSelector } from "./add-selector.js";
import { resolveShadcnRequirements } from "./shadcn-resolver.js";
import { rewriteShadcnImports } from "./shadcn-rewriter.js";

const requiredFeatures: readonly Feature[] = ["mobile-first", "responsive"];
const canonicalShadcnUiAlias = "@/components/ui";

type PlannedShadcnDependency = {
  readonly name: string;
};

export async function createAddInstallationPlan({
  projectDir,
  id,
  force,
  source,
}: AddInstallationPlanOptions): Promise<AddInstallationPlan> {
  const selector = parseAddSelector(id);
  const configuration = await readAurenConfig(projectDir);

  if (configuration === null) {
    throw new MissingAurenConfigurationError();
  }

  const detection = await detectProject(projectDir);
  validateProject(configuration, detection.framework, detection.tailwind.major);

  const records = await source.listInstallable();
  validateRawTargets(records, configuration);
  const recordsById = new Map(
    records.map((record) => [record.element.id, record]),
  );
  const registry = new LocalRegistry();
  registry.registerMany(records.map(({ element }) => element));

  let collection: Collection | null = null;
  let members: readonly CatalogElement[] = [];
  let resolvedBlocks: readonly CatalogElement[];

  if (selector.kind === "collection") {
    const getInstallableCollectionById = source.getInstallableCollectionById;

    if (getInstallableCollectionById === undefined) {
      throw new MissingInstallableRecordError(`collection/${selector.id}`);
    }

    const collectionRecord = await getInstallableCollectionById(selector.id);

    if (collectionRecord === undefined) {
      throw new UnknownCollectionError(selector.id);
    }

    const detail = await collectionRecord.loadCollection();
    registry.registerCollection(detail);
    const resolved = resolveCollection(registry, selector.id);
    collection = resolved.collection;
    members = resolved.members;
    resolvedBlocks = resolved.blocks;
  } else {
    resolvedBlocks = resolveBlock(registry, selector.id).blocks;
  }

  for (const element of resolvedBlocks) {
    const compatibility = validateCompatibility(element, {
      frameworks: [configuration.framework],
      features: requiredFeatures,
    });

    if (!compatibility.compatible) {
      const missing = [
        ...compatibility.missing.frameworks,
        ...compatibility.missing.features,
      ].join(", ");
      throw new IncompatibleCatalogElementError(
        element.id,
        `missing ${missing}`,
      );
    }
  }

  const dependencyResolution =
    selector.kind === "collection"
      ? resolveProjectCollectionDependencies(
          registry,
          selector.id,
          detection.dependencies,
        )
      : resolveProjectDependencies(
          registry,
          selector.id,
          detection.dependencies,
        );
  const shadcn =
    "shadcn" in dependencyResolution
      ? (dependencyResolution.shadcn as readonly PlannedShadcnDependency[])
      : [];
  const invalidShadcnDiagnostic = detection.diagnostics.find(
    ({ code }) => String(code) === "invalid-shadcn-config",
  );
  let shadcnResolution = null;

  if (shadcn.length > 0) {
    if (invalidShadcnDiagnostic !== undefined) {
      throw new InvalidShadcnConfigurationError(
        "components.json",
        invalidShadcnDiagnostic.message,
      );
    }

    shadcnResolution = await resolveShadcnRequirements(
      detection,
      shadcn.map(({ name }) => name),
    );
  }

  const missingRequirements = [
    ...dependencyResolution.missing.map(
      (dependency: { name: string; version: string }) =>
        `${dependency.name}@${dependency.version}`,
    ),
    ...(shadcnResolution?.missing.map((name) => `shadcn/${name}`) ?? []),
  ];

  const shadcnUiAlias = getShadcnUiAlias(detection);
  const files: AddPlannedFile[] = [];
  const targets = new Set<string>();

  for (const element of resolvedBlocks) {
    const record = recordsById.get(element.id);

    if (record === undefined) {
      throw new MissingInstallableRecordError(element.id);
    }

    let resolvedFiles: readonly ResolvedBlockFile[];

    try {
      resolvedFiles = await record.loadFiles();
    } catch (error) {
      if (error instanceof MissingBlockFileError) {
        throw new MissingInstallSourceFileError(error.missingPath);
      }

      throw error;
    }

    for (const file of resolvedFiles) {
      let content = file.content;

      if (shadcnResolution !== null && shadcnUiAlias !== null) {
        validateSourceAliases(
          file.content,
          configuration,
          canonicalShadcnUiAlias,
        );
        content = rewriteShadcnImports(file.content, shadcnUiAlias);
        validateSourceAliases(content, configuration, shadcnUiAlias);
      } else {
        validateSourceAliases(content, configuration, null);
      }
      const requestedTarget =
        file.target ??
        [configuration.components, element.id, file.path].join("/");
      const targetPath = await normalizeTarget(
        detection.projectDir,
        requestedTarget,
        file.target !== undefined,
        configuration,
      );

      if (
        shadcnResolution !== null &&
        isWithinDirectory(
          targetPath.absoluteTargetPath,
          shadcnResolution.uiDirectory,
        )
      ) {
        throw new UnsafeInstallTargetError(
          `${requestedTarget} (shadcn UI directory)`,
        );
      }

      if (targets.has(targetPath.targetPath)) {
        throw new DuplicateInstallTargetError(targetPath.targetPath);
      }

      targets.add(targetPath.targetPath);
      await validateExistingTarget(
        targetPath.absoluteTargetPath,
        targetPath.targetPath,
        force,
      );
      files.push({
        blockId: element.id,
        sourcePath: file.path,
        kind: file.kind,
        content,
        targetPath: targetPath.targetPath,
        absoluteTargetPath: targetPath.absoluteTargetPath,
      });
    }
  }

  if (missingRequirements.length > 0 && detection.packageManager === null) {
    throw new MissingPackageManagerError(missingRequirements);
  }

  return {
    requestedId: id,
    selector,
    collection,
    members,
    projectDir: detection.projectDir,
    configuration,
    detection,
    blocks: resolvedBlocks,
    packages: dependencyResolution.packages,
    shadcn,
    dependencyResolution,
    shadcnResolution,
    files,
    warnings: detection.diagnostics.map(({ message }) => message),
    force,
  };
}

export const planAddInstallation = createAddInstallationPlan;

function validateProject(
  configuration: AurenConfiguration,
  detectedFramework: string | null,
  tailwindMajor: number | null,
): void {
  if (detectedFramework !== configuration.framework) {
    throw new IncompatibleProjectError(
      `Configured framework "${configuration.framework}" does not match detected framework "${detectedFramework ?? "none"}"`,
    );
  }

  if (!configuration.tailwind) {
    throw new IncompatibleProjectError(
      "Tailwind CSS is disabled in auren.json; enable it before adding a block",
    );
  }

  if (tailwindMajor !== 4) {
    throw new IncompatibleProjectError(
      `Tailwind CSS v4 is required; detected major version ${tailwindMajor === null ? "unknown" : String(tailwindMajor)}`,
    );
  }
}

function validateRawTargets(
  records: readonly { element: CatalogElement }[],
  configuration: AurenConfiguration,
): void {
  for (const record of records) {
    for (const file of record.element.files) {
      if (file.target === undefined) {
        continue;
      }

      validateTargetSyntax(file.target);
      validateExplicitTargetAlias(file.target, configuration);
    }
  }
}

function validateTargetSyntax(target: string): void {
  if (
    target.length === 0 ||
    target.includes("\\") ||
    target.includes("\u0000") ||
    path.isAbsolute(target) ||
    /^[A-Za-z]:/.test(target) ||
    target
      .split("/")
      .some(
        (segment) =>
          segment.length === 0 || segment === "." || segment === "..",
      )
  ) {
    throw new UnsafeInstallTargetError(target);
  }
}

async function normalizeTarget(
  projectDir: string,
  requestedTarget: string,
  explicit: boolean,
  configuration: AurenConfiguration,
): Promise<{ targetPath: string; absoluteTargetPath: string }> {
  validateTargetSyntax(requestedTarget);

  if (explicit) {
    validateExplicitTargetAlias(requestedTarget, configuration);
  }

  const absoluteTargetPath = path.resolve(
    projectDir,
    ...requestedTarget.split("/"),
  );
  const relativeTargetPath = path.relative(projectDir, absoluteTargetPath);

  if (
    relativeTargetPath === "" ||
    path.isAbsolute(relativeTargetPath) ||
    relativeTargetPath === ".." ||
    relativeTargetPath.startsWith(`..${path.sep}`)
  ) {
    throw new UnsafeInstallTargetError(requestedTarget);
  }

  await validateRealPathBoundary(
    projectDir,
    absoluteTargetPath,
    requestedTarget,
  );

  return {
    targetPath: relativeTargetPath.split(path.sep).join("/"),
    absoluteTargetPath,
  };
}

async function validateRealPathBoundary(
  projectDir: string,
  targetPath: string,
  requestedTarget: string,
): Promise<void> {
  const projectRealPath = await realpath(projectDir);
  let candidate = targetPath;

  while (true) {
    try {
      const candidateRealPath = await realpath(candidate);
      const relative = path.relative(projectRealPath, candidateRealPath);

      if (
        path.isAbsolute(relative) ||
        relative === ".." ||
        relative.startsWith(`..${path.sep}`)
      ) {
        throw new UnsafeInstallTargetError(requestedTarget);
      }

      return;
    } catch (error) {
      if (!isMissingPathError(error)) {
        throw error;
      }

      const parent = path.dirname(candidate);

      if (parent === candidate) {
        throw new UnsafeInstallTargetError(requestedTarget);
      }

      candidate = parent;
    }
  }
}

async function validateExistingTarget(
  absoluteTargetPath: string,
  targetPath: string,
  force: boolean,
): Promise<void> {
  let entry: Awaited<ReturnType<typeof lstat>>;

  try {
    entry = await lstat(absoluteTargetPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return;
    }

    throw error;
  }

  if (entry.isDirectory() || !force) {
    throw new ExistingInstallTargetError(targetPath);
  }
}

function validateSourceAliases(
  content: string,
  configuration: AurenConfiguration,
  shadcnUiAlias: string | null,
): void {
  const aliases = configuration.aliases ?? {};
  const aliasValues = [
    ...Object.values(aliases),
    ...(shadcnUiAlias === null ? [] : [shadcnUiAlias]),
  ];
  const importPattern =
    /(?:from\s*|import\s*\(\s*|require\s*\(\s*)(["'])([^"']+)\1/g;
  let match = importPattern.exec(content);

  while (match !== null) {
    const specifier = match[2];

    if (looksLikeAlias(specifier, aliases, aliasValues)) {
      const known =
        aliasValues.some(
          (alias) => specifier === alias || specifier.startsWith(`${alias}/`),
        ) ||
        Object.keys(aliases).some(
          (alias) => specifier === alias || specifier.startsWith(`${alias}/`),
        );

      if (!known || specifier.split("/").includes("..")) {
        throw new InvalidInstallAliasError(specifier);
      }
    }

    match = importPattern.exec(content);
  }
}

function looksLikeAlias(
  specifier: string,
  aliases: Readonly<Record<string, string>>,
  aliasValues: readonly string[],
): boolean {
  return (
    specifier.startsWith("@/") ||
    specifier.startsWith("~/") ||
    aliasValues.some((alias) => specifier.startsWith(alias)) ||
    Object.keys(aliases).some(
      (alias) => specifier === alias || specifier.startsWith(`${alias}/`),
    )
  );
}

function validateExplicitTargetAlias(
  target: string,
  configuration: AurenConfiguration,
): void {
  const aliases = configuration.aliases ?? {};

  if (
    Object.values(aliases).some(
      (alias) => target === alias || target.startsWith(`${alias}/`),
    ) ||
    target.startsWith("@/") ||
    target.startsWith("~/")
  ) {
    throw new InvalidInstallAliasError(target);
  }
}

function getShadcnUiAlias(
  detection: Pick<ProjectDetection, "shadcn">,
): string | null {
  const shadcn = detection.shadcn;

  return "uiAlias" in shadcn && typeof shadcn.uiAlias === "string"
    ? shadcn.uiAlias
    : null;
}

function isWithinDirectory(candidate: string, directory: string): boolean {
  const relative = path.relative(directory, candidate);

  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
