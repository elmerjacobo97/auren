import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  AddWriteError,
  DuplicateInstallTargetError,
  ExistingInstallTargetError,
} from "./add-errors.js";
import type { AddInstallationPlan, AddPlannedFile } from "./add-types.js";

export async function applyAddInstallationPlan(
  plan: AddInstallationPlan,
): Promise<void> {
  const originals = new Map<string, Buffer>();
  const temporaryFiles = new Set<string>();
  const appliedFiles: AddPlannedFile[] = [];
  const targetPaths = new Set<string>();

  try {
    await preflightTargets(plan, originals, targetPaths);

    for (const file of plan.files) {
      await mkdir(path.dirname(file.absoluteTargetPath), { recursive: true });
      const temporaryPath = path.join(
        path.dirname(file.absoluteTargetPath),
        `.${path.basename(file.absoluteTargetPath)}.auren-${randomUUID()}.tmp`,
      );
      temporaryFiles.add(temporaryPath);

      if (!plan.force) {
        await rejectNewCollision(file);
      } else if (!originals.has(file.absoluteTargetPath)) {
        await captureOriginal(file, originals);
      }

      try {
        await writeFile(temporaryPath, file.content, {
          encoding: "utf8",
          flag: "wx",
        });
        await rename(temporaryPath, file.absoluteTargetPath);
        temporaryFiles.delete(temporaryPath);
        appliedFiles.push(file);
      } catch (cause) {
        throw new AddWriteError(file.targetPath, cause);
      }
    }
  } catch (error) {
    await cleanupTemporaryFiles(temporaryFiles);
    await rollback(appliedFiles, originals);
    await removeEmptyParents(appliedFiles);

    if (
      error instanceof AddWriteError ||
      error instanceof DuplicateInstallTargetError ||
      error instanceof ExistingInstallTargetError
    ) {
      throw error;
    }

    const targetPath =
      error instanceof Error && "targetPath" in error
        ? String((error as { targetPath: unknown }).targetPath)
        : (plan.files[appliedFiles.length]?.targetPath ?? plan.requestedId);
    throw new AddWriteError(targetPath, error);
  }
}

export const writeAddInstallation = applyAddInstallationPlan;

async function preflightTargets(
  plan: AddInstallationPlan,
  originals: Map<string, Buffer>,
  targetPaths: Set<string>,
): Promise<void> {
  for (const file of plan.files) {
    if (targetPaths.has(file.targetPath)) {
      throw new DuplicateInstallTargetError(file.targetPath);
    }

    targetPaths.add(file.targetPath);
    let entry: Awaited<ReturnType<typeof lstat>>;

    try {
      entry = await lstat(file.absoluteTargetPath);
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }

      throw error;
    }

    if (entry.isDirectory() || !plan.force) {
      throw new ExistingInstallTargetError(file.targetPath);
    }

    if (!entry.isFile()) {
      throw new ExistingInstallTargetError(file.targetPath);
    }

    originals.set(
      file.absoluteTargetPath,
      await readFile(file.absoluteTargetPath),
    );
  }
}

async function rejectNewCollision(file: AddPlannedFile): Promise<void> {
  try {
    await lstat(file.absoluteTargetPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return;
    }

    throw error;
  }

  throw new ExistingInstallTargetError(file.targetPath);
}

async function captureOriginal(
  file: AddPlannedFile,
  originals: Map<string, Buffer>,
): Promise<void> {
  let entry: Awaited<ReturnType<typeof lstat>>;

  try {
    entry = await lstat(file.absoluteTargetPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return;
    }

    throw error;
  }

  if (!entry.isFile()) {
    throw new ExistingInstallTargetError(file.targetPath);
  }

  originals.set(
    file.absoluteTargetPath,
    await readFile(file.absoluteTargetPath),
  );
}

async function rollback(
  appliedFiles: readonly AddPlannedFile[],
  originals: ReadonlyMap<string, Buffer>,
): Promise<void> {
  for (const file of [...appliedFiles].reverse()) {
    const original = originals.get(file.absoluteTargetPath);

    try {
      if (original === undefined) {
        await rm(file.absoluteTargetPath, { force: true });
      } else {
        await writeFile(file.absoluteTargetPath, original);
      }
    } catch {}
  }
}

async function cleanupTemporaryFiles(
  temporaryFiles: ReadonlySet<string>,
): Promise<void> {
  await Promise.all(
    [...temporaryFiles].map((temporaryPath) =>
      rm(temporaryPath, { force: true }).catch(() => undefined),
    ),
  );
}

async function removeEmptyParents(
  appliedFiles: readonly AddPlannedFile[],
): Promise<void> {
  const directories = new Set(
    appliedFiles.map((file) => path.dirname(file.absoluteTargetPath)),
  );

  for (const directory of [...directories].sort(depthDescending)) {
    await rm(directory, { recursive: false }).catch(() => undefined);
  }
}

function depthDescending(left: string, right: string): number {
  return right.split(path.sep).length - left.split(path.sep).length;
}

function isMissingPathError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
