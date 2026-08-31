import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { Collection } from "@auren/schemas/collection";
import { vi } from "vitest";
import type {
  CollectionCatalogSource,
  InstallableCatalogRecord,
  InstallableCatalogSource,
  InstallableCollectionRecord,
} from "../../catalog/catalog-source.js";
import { runCli } from "../../command/runner.js";
import type { PackageInstaller } from "./package-installer.js";
import type { ShadcnInstaller } from "./shadcn-installer.js";

const fixtureRoots: string[] = [];

export const element: CatalogElement = {
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

export async function createProject(
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

export function shadcnDependency(
  name: string,
): CatalogElement["dependencies"][number] {
  // SAFETY: the fixture intentionally constructs the shadcn dependency variant
  // that the catalog schema exposes through the shared dependency union.
  return {
    kind: "shadcn",
    name,
  } as unknown as CatalogElement["dependencies"][number];
}

export function createRecord(item: CatalogElement): InstallableCatalogRecord {
  return {
    element: item,
    loadFiles: async () =>
      item.files.map((file) => ({
        path: file.path,
        kind: file.kind,
        target: file.target,
        content: file.content ?? "",
      })),
  };
}

export function createCollectionRecord(
  item: Collection,
): InstallableCollectionRecord {
  return {
    collection: item,
    loadCollection: async () => item,
  };
}

export async function configureShadcn(
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
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: uiAlias,
        },
        ...(options.tsx === undefined ? {} : { tsx: options.tsx }),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(project, "tsconfig.json"),
    `${JSON.stringify({ compilerOptions: { baseUrl: ".", paths } }, null, 2)}\n`,
  );
  await mkdir(path.join(project, uiDirectory), { recursive: true });
  return path.join(project, uiDirectory);
}

export function createSource(
  records: readonly InstallableCatalogRecord[] = [createRecord(element)],
  collections: readonly InstallableCollectionRecord[] = [],
): InstallableCatalogSource &
  CollectionCatalogSource & {
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
    getCollectionById: vi.fn(
      async (id: string) =>
        collections.find((record) => record.collection.id === id)?.collection,
    ),
    listCollections: vi.fn(async () =>
      collections.map(({ collection: item }) => item),
    ),
    getInstallableCollectionById: vi.fn(async (id: string) =>
      collections.find((record) => record.collection.id === id),
    ),
    listInstallableCollections: vi.fn(async () => collections),
  };
}

export async function invoke(
  projectDir: string,
  args: readonly string[],
  source: InstallableCatalogSource,
  packageInstaller?: PackageInstaller,
  shadcnInstaller?: ShadcnInstaller,
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
    shadcnInstaller,
  });

  return { status, stdout, stderr };
}

export async function cleanupFixtures(): Promise<void> {
  vi.restoreAllMocks();
  await Promise.all(
    fixtureRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
}
