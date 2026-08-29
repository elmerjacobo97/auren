import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddInstallationPlan, AddPlannedFile } from "./add-types.js";
import { ExistingInstallTargetError, AddWriteError } from "./add-errors.js";
import { applyAddInstallationPlan } from "./add-writer.js";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function createRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-writer-"));
  roots.push(root);
  return root;
}

function createFile(
  projectDir: string,
  targetPath: string,
  content: string,
): AddPlannedFile {
  return {
    blockId: "hero-001",
    sourcePath: "component.tsx",
    kind: "component",
    content,
    targetPath,
    absoluteTargetPath: path.join(projectDir, ...targetPath.split("/")),
  };
}

function createPlan(
  projectDir: string,
  files: readonly AddPlannedFile[],
  force = false,
): AddInstallationPlan {
  return {
    requestedId: "hero-001",
    projectDir,
    configuration: {
      framework: "react",
      components: "src/components/auren",
      tailwind: true,
    },
    detection: {
      projectDir,
      framework: "react",
      typescript: true,
      tailwind: {
        detected: true,
        declaredRange: "^4.0.0",
        installedVersion: null,
        major: 4,
        configPath: null,
      },
      shadcn: { detected: false, configPath: null, aliases: {} },
      source: { hasSrcDirectory: false },
      aliases: {
        typescript: { configPath: null, baseUrl: null, paths: {} },
        shadcn: {},
      },
      packageManager: null,
      diagnostics: [],
    },
    blocks: [],
    packages: [],
    files,
    warnings: [],
    force,
  };
}

async function findTemporaryFiles(root: string): Promise<string[]> {
  const found: string[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (
        entry.name.includes(".auren-") &&
        entry.name.endsWith(".tmp")
      ) {
        found.push(entryPath);
      }
    }
  }

  await visit(root);
  return found;
}

describe("applyAddInstallationPlan", () => {
  it("writes all planned files and cleans temporary siblings", async () => {
    const project = await createRoot();
    const files = [
      createFile(
        project,
        "src/components/auren/hero-001/component.tsx",
        "component\n",
      ),
      createFile(
        project,
        "src/components/auren/hero-001/utilities/types.ts",
        "types\n",
      ),
    ];

    await applyAddInstallationPlan(createPlan(project, files));

    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
        "utf8",
      ),
    ).resolves.toBe("component\n");
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/utilities/types.ts"),
        "utf8",
      ),
    ).resolves.toBe("types\n");
    await expect(findTemporaryFiles(project)).resolves.toEqual([]);
  });

  it("refuses existing targets without force and leaves them unchanged", async () => {
    const project = await createRoot();
    const target = path.join(project, "src/existing.tsx");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "original\n");

    await expect(
      applyAddInstallationPlan(
        createPlan(project, [
          createFile(project, "src/existing.tsx", "replacement\n"),
        ]),
      ),
    ).rejects.toBeInstanceOf(ExistingInstallTargetError);
    await expect(readFile(target, "utf8")).resolves.toBe("original\n");
  });

  it("force replaces only planned targets", async () => {
    const project = await createRoot();
    const target = path.join(project, "src/existing.tsx");
    const unrelated = path.join(project, "src/unrelated.tsx");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "original\n");
    await writeFile(unrelated, "untouched\n");

    await applyAddInstallationPlan(
      createPlan(
        project,
        [createFile(project, "src/existing.tsx", "replacement\n")],
        true,
      ),
    );

    await expect(readFile(target, "utf8")).resolves.toBe("replacement\n");
    await expect(readFile(unrelated, "utf8")).resolves.toBe("untouched\n");
  });

  it("rolls back created and forced files when a later write fails", async () => {
    const project = await createRoot();
    const forcedTarget = path.join(project, "src/existing.tsx");
    const blockedParent = path.join(project, "blocked");
    await mkdir(path.dirname(forcedTarget), { recursive: true });
    await writeFile(forcedTarget, "original\n");
    await writeFile(blockedParent, "not a directory\n");

    const files = [
      createFile(project, "src/existing.tsx", "replacement\n"),
      createFile(project, "blocked/new.tsx", "new\n"),
    ];

    await expect(
      applyAddInstallationPlan(createPlan(project, files, true)),
    ).rejects.toBeInstanceOf(AddWriteError);
    await expect(readFile(forcedTarget, "utf8")).resolves.toBe("original\n");
    await expect(
      readFile(path.join(project, "blocked/new.tsx")),
    ).rejects.toThrow();
    await expect(findTemporaryFiles(project)).resolves.toEqual([]);
  });

  it("rejects duplicate planned targets before writing", async () => {
    const project = await createRoot();
    const files = [
      createFile(project, "src/shared.tsx", "first\n"),
      createFile(project, "src/shared.tsx", "second\n"),
    ];

    await expect(
      applyAddInstallationPlan(createPlan(project, files, true)),
    ).rejects.toMatchObject({ name: "DuplicateInstallTargetError" });
    await expect(
      readFile(path.join(project, "src/shared.tsx")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
