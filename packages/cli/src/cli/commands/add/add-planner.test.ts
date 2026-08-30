import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AurenConfiguration,
  AurenConfigurationError,
} from "@auren/core/configuration";
import { loadBlockFiles, MissingBlockFileError } from "@auren/core/load/files";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "../../catalog/catalog-source.js";
import {
  IncompatibleProjectError,
  InvalidShadcnAliasError,
  MissingAurenConfigurationError,
  MissingShadcnConfigurationError,
  ShadcnComponentCollisionError,
  UnsafeInstallTargetError,
  type DuplicateInstallTargetError,
  type IncompatibleCatalogElementError,
  type MissingInstallSourceFileError,
} from "./add-errors.js";
import { createAddInstallationPlan } from "./add-planner.js";

const defaultConfiguration: AurenConfiguration = {
  framework: "react",
  components: "src/components/auren",
  tailwind: true,
  aliases: {
    components: "@/components",
    lib: "@/lib",
  },
};

const fixtureRoots: string[] = [];

async function createProject(
  configuration: unknown = defaultConfiguration,
  dependencies: Record<string, string> = {
    react: "^19.0.0",
    tailwindcss: "^4.0.0",
  },
  packageManager?: string,
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-planner-"));
  fixtureRoots.push(root);
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(
      { dependencies, ...(packageManager ? { packageManager } : {}) },
      null,
      2,
    )}\n`,
  );

  if (configuration !== undefined) {
    await writeFile(
      path.join(root, "auren.json"),
      `${JSON.stringify(configuration, null, 2)}\n`,
    );
  }

  return root;
}

function createElement(
  id: string,
  changes: Partial<CatalogElement> = {},
): CatalogElement {
  return {
    id,
    name: `Element ${id}`,
    description: `Complete catalog element ${id}.`,
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
        content: `export function ${id.replaceAll("-", "_")}() { return null; }\n`,
      },
    ],
    metadata: {},
    ...changes,
  };
}

function shadcnDependency(
  name: string,
): CatalogElement["dependencies"][number] {
  return {
    kind: "shadcn",
    name,
  } as unknown as CatalogElement["dependencies"][number];
}

function createSource(
  records: readonly InstallableCatalogRecord[],
): InstallableCatalogSource & {
  listInstallable: ReturnType<typeof vi.fn>;
} {
  const listInstallable = vi.fn(async () => records);

  return {
    getById: vi.fn(
      async (id: string) =>
        records.find((record) => record.element.id === id)?.element,
    ),
    list: vi.fn(async () => records.map(({ element }) => element)),
    getInstallableById: vi.fn(async (id: string) =>
      records.find((record) => record.element.id === id),
    ),
    listInstallable,
  };
}

function createRecords(
  elements: readonly CatalogElement[],
  root: string,
): InstallableCatalogRecord[] {
  return elements.map((element) => {
    const blockDir = path.join(
      root,
      element.category,
      element.type,
      element.id,
    );

    return {
      element,
      loadFiles: async () => {
        try {
          return await loadBlockFiles(blockDir, element);
        } catch (error) {
          if (error instanceof MissingBlockFileError) {
            throw new MissingBlockFileError(
              path.join(blockDir, error.missingPath),
            );
          }

          throw error;
        }
      },
    };
  });
}

async function createCatalogRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-catalog-"));
  fixtureRoots.push(root);
  return root;
}

async function configureShadcn(
  project: string,
  options: {
    readonly uiAlias?: string;
    readonly uiDirectory?: string;
    readonly tsx?: boolean;
    readonly paths?: Record<string, readonly string[]>;
  } = {},
): Promise<string> {
  const uiAlias = options.uiAlias ?? "@/components/ui";
  const uiDirectory = options.uiDirectory ?? "src/components/ui";
  const paths = options.paths ?? { "@/*": ["./src/*"] };

  await writeFile(
    path.join(project, "components.json"),
    `${JSON.stringify(
      {
        $schema: "https://ui.shadcn.com/schema.json",
        ...(options.tsx === undefined ? {} : { tsx: options.tsx }),
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: uiAlias,
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(project, "tsconfig.json"),
    `${JSON.stringify(
      { compilerOptions: { baseUrl: ".", paths } },
      null,
      2,
    )}\n`,
  );
  await mkdir(path.join(project, uiDirectory), { recursive: true });
  return path.join(project, uiDirectory);
}

afterEach(async () => {
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("createAddInstallationPlan", () => {
  it("requires auren.json before accessing the catalog", async () => {
    const project = await createProject();
    await rm(path.join(project, "auren.json"));
    const source = createSource([]);

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: "hero-001",
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(MissingAurenConfigurationError);
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it("rejects malformed configuration without accessing the catalog", async () => {
    const project = await createProject();
    await writeFile(path.join(project, "auren.json"), '{ "framework": ');
    const source = createSource([]);

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: "hero-001",
        force: false,
        source,
      }),
    ).rejects.toMatchObject({
      name: "AurenConfigurationError",
      code: "malformed-json",
    } satisfies Partial<AurenConfigurationError>);
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it("rejects a stale framework detection before catalog access", async () => {
    const project = await createProject(defaultConfiguration, {
      tailwindcss: "^4.0.0",
    });
    const source = createSource([]);

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: "hero-001",
        force: false,
        source,
      }),
    ).rejects.toEqual(
      expect.objectContaining({ name: "IncompatibleProjectError" }),
    );
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it("resolves dependencies deeply first and folds package requirements", async () => {
    const project = await createProject(
      defaultConfiguration,
      {
        react: "^19.0.0",
        tailwindcss: "^4.0.0",
      },
      "pnpm@11.21.0",
    );
    const catalogRoot = await createCatalogRoot();
    const leaf = createElement("leaf-001", {
      dependencies: [{ kind: "package", name: "motion", version: "^12.0.0" }],
    });
    const root = createElement("hero-001", {
      dependencies: [
        { kind: "auren", id: "leaf-001" },
        { kind: "package", name: "motion", version: "^12.0.0" },
      ],
      files: [
        {
          path: "component.tsx",
          kind: "component",
          content:
            'import { Leaf } from "@/components/leaf";\nexport { Leaf };\n',
        },
        {
          path: "utilities/types.ts",
          kind: "utility",
          content: "export type HeroSize = 'large' | 'small';\n",
        },
      ],
    });
    const source = createSource(createRecords([root, leaf], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: "hero-001",
      force: false,
      source,
    });

    expect(plan.blocks.map(({ id }) => id)).toEqual(["leaf-001", "hero-001"]);
    expect(plan.packages).toEqual([{ name: "motion", version: "^12.0.0" }]);
    expect(plan.files.map(({ targetPath }) => targetPath)).toEqual([
      "src/components/auren/leaf-001/component.tsx",
      "src/components/auren/hero-001/component.tsx",
      "src/components/auren/hero-001/utilities/types.ts",
    ]);
    expect(plan.files[1]?.content).toContain('"@/components/leaf"');
  });

  it("honors safe explicit targets and preserves source aliases", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      files: [
        {
          path: "component.tsx",
          kind: "component",
          target: "src/styles/hero.css",
          content: '@import "@/components/base.css";\n',
        },
      ],
    });
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: false,
      source,
    });

    expect(plan.files[0]).toMatchObject({
      targetPath: "src/styles/hero.css",
      content: '@import "@/components/base.css";\n',
    });
  });

  it("rejects unsafe targets before registry validation or writes", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      files: [
        {
          path: "component.tsx",
          kind: "component",
          target: "../outside.tsx",
          content: "export {};\n",
        },
      ],
    });
    const source = createSource(
      createRecords([element], catalogRoot) as InstallableCatalogRecord[],
    );

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(UnsafeInstallTargetError);
    await expect(
      readFile(path.join(project, "outside.tsx")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects duplicate resolved targets regardless of force", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      files: [
        {
          path: "first.tsx",
          kind: "component",
          target: "src/shared.tsx",
          content: "export const first = true;\n",
        },
        {
          path: "second.tsx",
          kind: "utility",
          target: "src/shared.tsx",
          content: "export const second = true;\n",
        },
      ],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: true,
        source,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "DuplicateInstallTargetError",
        targetPath: "src/shared.tsx",
      } satisfies Partial<DuplicateInstallTargetError>),
    );
  });

  it("rejects incompatible blocks before loading their source files", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      features: ["responsive"],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "IncompatibleCatalogElementError",
        id: element.id,
      } satisfies Partial<IncompatibleCatalogElementError>),
    );
  });

  it("reports missing source files without creating consumer targets", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      files: [{ path: "missing.tsx", kind: "component" }],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: "MissingInstallSourceFileError",
        sourcePath: path.join(
          catalogRoot,
          "marketing/hero/hero-001/missing.tsx",
        ),
      } satisfies Partial<MissingInstallSourceFileError>),
    );
    await expect(
      readFile(path.join(project, "src/components/auren/hero-001/missing.tsx")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects circular dependencies without changing the project", async () => {
    const project = await createProject();
    const catalogRoot = await createCatalogRoot();
    const first = createElement("first-001", {
      dependencies: [{ kind: "auren", id: "second-001" }],
    });
    const second = createElement("second-001", {
      dependencies: [{ kind: "auren", id: "first-001" }],
    });
    const source = createSource(createRecords([first, second], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: first.id,
        force: false,
        source,
      }),
    ).rejects.toThrow("Circular dependency");
    await expect(
      readFile(
        path.join(project, "src/components/auren/first-001/component.tsx"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects an unknown element without a target directory", async () => {
    const project = await createProject();
    const source = createSource([]);

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: "missing-001",
        force: false,
        source,
      }),
    ).rejects.toThrow('Unknown block "missing-001"');
    await expect(
      readFile(
        path.join(project, "src/components/auren/missing-001/component.tsx"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("reports usable detection diagnostics as warnings in the plan", async () => {
    const project = await createProject();
    await writeFile(path.join(project, "tsconfig.json"), "{ invalid");
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001");
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: false,
      source,
    });

    expect(plan.warnings.length).toBeGreaterThan(0);
    expect(plan.warnings.join(" ")).toContain("tsconfig.json");
  });

  it("rejects a project with disabled Tailwind before catalog access", async () => {
    const project = await createProject({
      ...defaultConfiguration,
      tailwind: false,
    });
    const source = createSource([]);

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: "hero-001",
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(IncompatibleProjectError);
    expect(source.listInstallable).not.toHaveBeenCalled();
  });

  it("does not create directories while planning an existing target collision", async () => {
    const project = await createProject();
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, "existing\n");
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001");
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toThrow("--force");
    expect(await readFile(target, "utf8")).toBe("existing\n");
  });

  it("requires components.json for shadcn-dependent blocks", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(MissingShadcnConfigurationError);
  });

  it("resolves the configured UI alias and reuses an existing tsx component", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    const uiDirectory = await configureShadcn(project, { tsx: true });
    await writeFile(path.join(uiDirectory, "button.tsx"), "custom button\n");
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
      files: [
        {
          path: "component.tsx",
          kind: "component",
          content:
            'import { Button } from "@/components/ui/button";\nexport { Button };\n',
        },
      ],
    });
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: true,
      source,
    });

    expect(plan.shadcnResolution).toMatchObject({
      required: ["button"],
      satisfied: ["button"],
      missing: [],
      uiDirectory,
    });
    expect(plan.shadcnResolution?.paths).toEqual([
      { name: "button", path: path.join(uiDirectory, "button.tsx") },
    ]);
    expect(plan.files[0]?.content).toContain('from "@/components/ui/button"');
    expect(await readFile(path.join(uiDirectory, "button.tsx"), "utf8")).toBe(
      "custom button\n",
    );
  });

  it("adapts canonical imports to a custom UI alias without touching strings", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    await configureShadcn(project, {
      uiAlias: "~/ui",
      uiDirectory: "src/ui",
      tsx: true,
      paths: { "~/*": ["./src/*"] },
    });
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
      files: [
        {
          path: "component.tsx",
          kind: "component",
          content: [
            'import { Button } from "@/components/ui/button";',
            'const text = "@/components/ui/button";',
            '// import("@/components/ui/button")',
            "export { Button };",
            "",
          ].join("\n"),
        },
      ],
    });
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: false,
      source,
    });

    expect(plan.files[0]?.content).toContain('from "~/ui/button"');
    expect(plan.files[0]?.content).toContain('"@/components/ui/button"');
    expect(plan.files[0]?.content).toContain(
      '// import("@/components/ui/button")',
    );
  });

  it("uses jsx expectations when components.json sets tsx false", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    const uiDirectory = await configureShadcn(project, { tsx: false });
    await writeFile(path.join(uiDirectory, "button.jsx"), "button\n");
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
    });
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: false,
      source,
    });

    expect(plan.shadcnResolution?.satisfied).toEqual(["button"]);
    expect(plan.shadcnResolution?.paths[0]?.path).toBe(
      path.join(uiDirectory, "button.jsx"),
    );
  });

  it("accepts exactly one format when tsx is absent and rejects both", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    const uiDirectory = await configureShadcn(project);
    await rm(path.join(project, "components.json"));
    await writeFile(
      path.join(project, "components.json"),
      `${JSON.stringify({ aliases: { ui: "@/components/ui" } }, null, 2)}\n`,
    );
    await writeFile(path.join(uiDirectory, "button.jsx"), "button\n");
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
    });
    const source = createSource(createRecords([element], catalogRoot));

    const plan = await createAddInstallationPlan({
      projectDir: project,
      id: element.id,
      force: false,
      source,
    });
    expect(plan.shadcnResolution?.satisfied).toEqual(["button"]);

    await writeFile(path.join(uiDirectory, "button.tsx"), "button\n");
    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(ShadcnComponentCollisionError);
  });

  it("rejects UI directory targets before any Auren file is planned", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    await configureShadcn(project);
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
      files: [
        {
          path: "component.tsx",
          kind: "component",
          target: "src/components/ui/button.tsx",
          content: "export {};\n",
        },
      ],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(UnsafeInstallTargetError);
    await expect(
      readFile(path.join(project, "src/components/ui/button.tsx")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects ambiguous TypeScript UI mappings during planning", async () => {
    const project = await createProject(
      defaultConfiguration,
      undefined,
      "pnpm@11.21.0",
    );
    await configureShadcn(project, {
      paths: {
        "@/*": ["./src/*"],
        "@/components/*": ["./src/components/*"],
      },
    });
    const catalogRoot = await createCatalogRoot();
    const element = createElement("hero-001", {
      dependencies: [shadcnDependency("button")],
    });
    const source = createSource(createRecords([element], catalogRoot));

    await expect(
      createAddInstallationPlan({
        projectDir: project,
        id: element.id,
        force: false,
        source,
      }),
    ).rejects.toBeInstanceOf(InvalidShadcnAliasError);
  });
});
