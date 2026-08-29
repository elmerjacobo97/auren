import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AurenConfiguration,
  AurenConfigurationError,
} from "@auren/core/configuration";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "../../catalog/catalog-source.js";
import {
  IncompatibleProjectError,
  MissingAurenConfigurationError,
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
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-planner-"));
  fixtureRoots.push(root);
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ dependencies }, null, 2)}\n`,
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
  return elements.map((element) => ({
    element,
    blockDir: path.join(root, element.category, element.type, element.id),
  }));
}

async function createCatalogRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "auren-add-catalog-"));
  fixtureRoots.push(root);
  return root;
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
    const project = await createProject();
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
});
