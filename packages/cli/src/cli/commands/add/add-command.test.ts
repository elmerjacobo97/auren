import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "../../catalog/catalog-source.js";
import { runCli } from "../../command/runner.js";
import type { PackageInstaller } from "./package-installer.js";

const fixtureRoots: string[] = [];

const element: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["mobile-first", "responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [
    {
      path: "component.tsx",
      kind: "component",
      content: "export function Hero() { return null; }\n",
    },
    {
      path: "utilities/types.ts",
      kind: "utility",
      content: "export type HeroSize = 'large' | 'small';\n",
    },
  ],
  metadata: {},
};

async function createProject(
  dependencies: Record<string, string> = {
    react: "^19.0.0",
    tailwindcss: "^4.0.0",
  },
  packageManager?: string,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-command-"));
  fixtureRoots.push(root);
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        dependencies,
        ...(packageManager ? { packageManager } : {}),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(root, "auren.json"),
    `${JSON.stringify(
      {
        framework: "react",
        components: "src/components/auren",
        tailwind: true,
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

function createSource(
  records: readonly InstallableCatalogRecord[] = [
    { element, blockDir: "/catalog/marketing/hero/hero-001" },
  ],
): InstallableCatalogSource & {
  listInstallable: ReturnType<typeof vi.fn>;
} {
  const listInstallable = vi.fn(async () => records);

  return {
    getById: vi.fn(
      async (id: string) =>
        records.find((record) => record.element.id === id)?.element,
    ),
    list: vi.fn(async () => records.map(({ element: item }) => item)),
    getInstallableById: vi.fn(async (id: string) =>
      records.find((record) => record.element.id === id),
    ),
    listInstallable,
  };
}

async function invoke(
  projectDir: string,
  args: readonly string[],
  source: InstallableCatalogSource,
  packageInstaller?: PackageInstaller,
): Promise<{ status: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  vi.spyOn(process, "cwd").mockReturnValue(projectDir);

  const status = await runCli(["node", "auren", ...args], {
    catalogSource: source,
    color: false,
    stdout: (text) => {
      stdout += text;
    },
    stderr: (text) => {
      stderr += text;
    },
    packageInstaller,
  });

  return { status, stdout, stderr };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("auren add command", () => {
  it("shows add help without accessing the source", async () => {
    const source = createSource();
    const result = await invoke(
      "/directory/without/a/project",
      ["add", "--help"],
      source,
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: auren add <id>");
    expect(result.stdout).toContain("--force");
    expect(result.stderr).toBe("");
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", ["add"]],
    ["extra", ["add", "hero-001", "extra"]],
  ] as const)("rejects %s IDs before source access", async (_, args) => {
    const source = createSource();
    const result = await invoke("/directory/without/a/project", args, source);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error:");
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it("installs files with deterministic stdout and no package manifest mutation", async () => {
    const project = await createProject();
    const packageBefore = await readFile(
      path.join(project, "package.json"),
      "utf8",
    );
    const source = createSource();

    const result = await invoke(project, ["add", "hero-001"], source);

    expect(result).toEqual({
      status: 0,
      stdout: expect.stringContaining("Added hero-001"),
      stderr: "",
    });
    expect(result.stdout).toContain("Resolved blocks:\n- hero-001");
    expect(result.stdout).toContain(
      "- src/components/auren/hero-001/component.tsx",
    );
    expect(result.stdout).toContain(
      "- src/components/auren/hero-001/utilities/types.ts",
    );
    expect(result.stdout).toContain("Satisfied package requirements:\n- none");
    expect(result.stdout).toContain("Installed package requirements:\n- none");
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
        "utf8",
      ),
    ).resolves.toBe("export function Hero() { return null; }\n");
    await expect(
      readFile(path.join(project, "package.json"), "utf8"),
    ).resolves.toBe(packageBefore);
  });

  it("installs missing packages before writing block files", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "npm@10.0.0",
    );
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const packageElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const source = createSource([
      { element: packageElement, blockDir: "/catalog/marketing/hero/hero-001" },
    ]);
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async ({ projectDir, packageManager, packages }) => {
        expect(projectDir).toBe(project);
        expect(packageManager).toBe("npm");
        expect(packages).toEqual([{ name: "motion", version: "^12.0.0" }]);
        await expect(readFile(target)).rejects.toMatchObject({
          code: "ENOENT",
        });
        return { packages };
      }),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      source,
      packageInstaller,
    );

    expect(result.status).toBe(0);
    expect(packageInstaller.install).toHaveBeenCalledTimes(1);
    expect(result.stdout).toContain(
      "Installed package requirements:\n- motion@^12.0.0",
    );
    await expect(readFile(target, "utf8")).resolves.toBe(
      "export function Hero() { return null; }\n",
    );
  });

  it("reuses satisfied package requirements without invoking the installer", async () => {
    const project = await createProject(
      {
        react: "^19.0.0",
        tailwindcss: "^4.0.0",
        motion: "^12.0.0",
      },
      "npm@10.0.0",
    );
    const packageElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => ({ packages: [] })),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([
        {
          element: packageElement,
          blockDir: "/catalog/marketing/hero/hero-001",
        },
      ]),
      packageInstaller,
    );

    expect(result.status).toBe(0);
    expect(packageInstaller.install).not.toHaveBeenCalled();
    expect(result.stdout).toContain(
      "Satisfied package requirements:\n- motion@^12.0.0",
    );
    expect(result.stdout).toContain("Installed package requirements:\n- none");
  });

  it("fails before writing when the package manager fails", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "pnpm@11.21.0",
    );
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const packageElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => {
        throw new Error("registry unavailable");
      }),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([
        {
          element: packageElement,
          blockDir: "/catalog/marketing/hero/hero-001",
        },
      ]),
      packageInstaller,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("registry unavailable");
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails without a package manager before invoking installation", async () => {
    const project = await createProject();
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const packageElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => ({ packages: [] })),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([
        {
          element: packageElement,
          blockDir: "/catalog/marketing/hero/hero-001",
        },
      ]),
      packageInstaller,
    );

    expect(result.status).toBe(1);
    expect(packageInstaller.install).not.toHaveBeenCalled();
    expect(result.stderr).toContain("no unambiguous package manager");
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a collision without force and leaves the target unchanged", async () => {
    const project = await createProject();
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "existing\n");
    const source = createSource();

    const result = await invoke(project, ["add", "hero-001"], source);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("already exists");
    expect(result.stderr).toContain("--force");
    await expect(readFile(target, "utf8")).resolves.toBe("existing\n");
  });

  it("force replaces planned files and preserves unrelated files", async () => {
    const project = await createProject();
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const unrelated = path.join(project, "src/unrelated.tsx");
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(target, "existing\n");
    await writeFile(unrelated, "untouched\n");

    const result = await invoke(
      project,
      ["add", "hero-001", "--force"],
      createSource(),
    );

    expect(result.status).toBe(0);
    await expect(readFile(target, "utf8")).resolves.toBe(
      "export function Hero() { return null; }\n",
    );
    await expect(readFile(unrelated, "utf8")).resolves.toBe("untouched\n");
  });

  it("reports unknown elements as concise stderr failures", async () => {
    const project = await createProject();
    const source = createSource([]);

    const result = await invoke(project, ["add", "missing-001"], source);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Unknown block");
    expect(result.stderr).not.toContain(" at ");
  });
});
