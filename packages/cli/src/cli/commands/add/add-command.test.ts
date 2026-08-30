import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RemoteCatalogResponse,
  RemoteFetch,
} from "../../catalog/remote-catalog-source.js";
import type {
  InstallableCatalogRecord,
  InstallableCatalogSource,
} from "../../catalog/catalog-source.js";
import { runCli } from "../../command/runner.js";
import type { PackageInstaller } from "./package-installer.js";
import type { ShadcnInstaller } from "./shadcn-installer.js";

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

function shadcnDependency(
  name: string,
): CatalogElement["dependencies"][number] {
  return {
    kind: "shadcn",
    name,
  } as unknown as CatalogElement["dependencies"][number];
}

function createRecord(item: CatalogElement): InstallableCatalogRecord {
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

function createRemoteJsonResponse(
  value: unknown,
  status = 200,
): RemoteCatalogResponse {
  return {
    status,
    statusText: status === 200 ? "OK" : "Unavailable",
    headers: {
      get(name: string) {
        return name.toLowerCase() === "content-type"
          ? "application/json; charset=utf-8"
          : null;
      },
    },
    text: async () => JSON.stringify(value),
  };
}

function createRemoteFetch(
  handler: (url: string) => Promise<RemoteCatalogResponse>,
): { fetch: RemoteFetch; calls: string[] } {
  const calls: string[] = [];
  const spy = vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  });

  return { fetch: spy as unknown as RemoteFetch, calls };
}

function metadataOnly(item: CatalogElement): CatalogElement {
  return {
    ...item,
    files: item.files.map(({ path: filePath, kind, target }) => ({
      path: filePath,
      kind,
      ...(target === undefined ? {} : { target }),
    })),
  };
}

function createSource(
  records: readonly InstallableCatalogRecord[] = [createRecord(element)],
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

async function invokeRemote(
  projectDir: string,
  args: readonly string[],
  fetch: RemoteFetch,
  packageInstaller?: PackageInstaller,
  shadcnInstaller?: ShadcnInstaller,
): Promise<{ status: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  vi.spyOn(process, "cwd").mockReturnValue(projectDir);

  const status = await runCli(["node", "auren", ...args], {
    registryUrl: "https://registry.example.test",
    fetch,
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

async function invoke(
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
    const source = createSource([createRecord(packageElement)]);
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
      createSource([createRecord(packageElement)]),
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
      createSource([createRecord(packageElement)]),
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
      createSource([createRecord(packageElement)]),
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

  it("reuses an existing shadcn component without invoking its installer", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "pnpm@11.21.0",
    );
    const uiDirectory = await configureShadcn(project, { tsx: true });
    await writeFile(path.join(uiDirectory, "button.tsx"), "custom button\n");
    const shadcnElement = {
      ...element,
      dependencies: [shadcnDependency("button")],
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content:
            'import { Button } from "@/components/ui/button";\nexport { Button };\n',
        },
      ],
    } satisfies CatalogElement;
    const shadcnInstaller: ShadcnInstaller = {
      install: vi.fn(async () => ({ components: [] })),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([createRecord(shadcnElement)]),
      undefined,
      shadcnInstaller,
    );

    expect(result.status).toBe(0);
    expect(shadcnInstaller.install).not.toHaveBeenCalled();
    expect(result.stdout).toContain(
      "Satisfied shadcn/ui components:\n- button",
    );
    expect(result.stdout).toContain("Installed shadcn/ui components:\n- none");
    await expect(
      readFile(path.join(uiDirectory, "button.tsx"), "utf8"),
    ).resolves.toBe("custom button\n");
  });

  it("installs missing shadcn components before writing Auren files", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "pnpm@11.21.0",
    );
    const uiDirectory = await configureShadcn(project, { tsx: true });
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const shadcnElement = {
      ...element,
      dependencies: [shadcnDependency("button")],
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content:
            'import { Button } from "@/components/ui/button";\nexport { Button };\n',
        },
      ],
    } satisfies CatalogElement;
    const shadcnInstaller: ShadcnInstaller = {
      install: vi.fn(async ({ projectDir, packageManager, components }) => {
        expect(projectDir).toBe(project);
        expect(packageManager).toBe("pnpm");
        expect(components).toEqual(["button"]);
        await expect(readFile(target)).rejects.toMatchObject({
          code: "ENOENT",
        });
        await writeFile(path.join(uiDirectory, "button.tsx"), "generated\n");
        return { components };
      }),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([createRecord(shadcnElement)]),
      undefined,
      shadcnInstaller,
    );

    expect(result.status).toBe(0);
    expect(shadcnInstaller.install).toHaveBeenCalledTimes(1);
    expect(result.stdout).toContain(
      "Installed shadcn/ui components:\n- button",
    );
    await expect(readFile(target, "utf8")).resolves.toContain(
      'from "@/components/ui/button"',
    );
  });

  it("runs npm and shadcn installers before the Auren writer", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "npm@10.0.0",
    );
    const uiDirectory = await configureShadcn(project, { tsx: true });
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const bothElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
        shadcnDependency("button"),
      ],
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content:
            'import { Button } from "@/components/ui/button";\nexport { Button };\n',
        },
      ],
    } satisfies CatalogElement;
    const order: string[] = [];
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => {
        order.push("npm");
        await expect(readFile(target)).rejects.toMatchObject({
          code: "ENOENT",
        });
        return { packages: [{ name: "motion", version: "^12.0.0" }] };
      }),
    };
    const shadcnInstaller: ShadcnInstaller = {
      install: vi.fn(async ({ components }) => {
        order.push("shadcn");
        expect(components).toEqual(["button"]);
        await writeFile(path.join(uiDirectory, "button.tsx"), "generated\n");
        await expect(readFile(target)).rejects.toMatchObject({
          code: "ENOENT",
        });
        return { components };
      }),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([createRecord(bothElement)]),
      packageInstaller,
      shadcnInstaller,
    );

    expect(result.status).toBe(0);
    expect(order).toEqual(["npm", "shadcn"]);
    expect(await readFile(target, "utf8")).toContain("Button");
  });

  it("does not write Auren files when shadcn installation misses its postcondition", async () => {
    const project = await createProject(
      { react: "^19.0.0", tailwindcss: "^4.0.0" },
      "pnpm@11.21.0",
    );
    await configureShadcn(project, { tsx: true });
    const target = path.join(
      project,
      "src/components/auren/hero-001/component.tsx",
    );
    const shadcnElement = {
      ...element,
      dependencies: [shadcnDependency("button")],
    } satisfies CatalogElement;
    const shadcnInstaller: ShadcnInstaller = {
      install: vi.fn(async () => ({ components: ["button"] })),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([createRecord(shadcnElement)]),
      undefined,
      shadcnInstaller,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("did not create");
    await expect(readFile(target)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails before either installer when a missing shadcn component has no manager", async () => {
    const project = await createProject();
    await configureShadcn(project, { tsx: true });
    const shadcnElement = {
      ...element,
      dependencies: [shadcnDependency("button")],
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => ({ packages: [] })),
    };
    const shadcnInstaller: ShadcnInstaller = {
      install: vi.fn(async () => ({ components: [] })),
    };

    const result = await invoke(
      project,
      ["add", "hero-001"],
      createSource([createRecord(shadcnElement)]),
      packageInstaller,
      shadcnInstaller,
    );

    expect(result.status).toBe(1);
    expect(packageInstaller.install).not.toHaveBeenCalled();
    expect(shadcnInstaller.install).not.toHaveBeenCalled();
    expect(result.stderr).toContain("no unambiguous package manager");
  });

  it("installs remote inline text and asset payloads after detail validation", async () => {
    const project = await createProject();
    const remoteIndexElement = {
      ...element,
      files: [
        { path: "component.tsx", kind: "component" as const },
        { path: "assets/logo.svg", kind: "asset" as const },
      ],
    } satisfies CatalogElement;
    const assetContent = Buffer.from("<svg>remote</svg>\n").toString("base64");
    const remoteDetailElement = {
      ...remoteIndexElement,
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content: "export const RemoteHero = true;\n",
        },
        {
          path: "assets/logo.svg",
          kind: "asset" as const,
          content: assetContent,
        },
      ],
    } satisfies CatalogElement;
    const { fetch, calls } = createRemoteFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return createRemoteJsonResponse({
          schemaVersion: 1,
          blocks: [remoteIndexElement],
        });
      }

      return createRemoteJsonResponse(remoteDetailElement);
    });

    const result = await invokeRemote(project, ["add", "hero-001"], fetch);

    expect(result.status).toBe(0);
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
        "utf8",
      ),
    ).resolves.toBe("export const RemoteHero = true;\n");
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/assets/logo.svg"),
        "utf8",
      ),
    ).resolves.toBe(assetContent);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
  });

  it("downloads details only for the resolved remote dependency chain", async () => {
    const project = await createProject();
    const leaf = {
      ...element,
      id: "leaf-001",
      name: "Leaf block",
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content: "export const Leaf = true;\n",
        },
      ],
    } satisfies CatalogElement;
    const requested = {
      ...element,
      dependencies: [{ kind: "auren" as const, id: "leaf-001" }],
    } satisfies CatalogElement;
    const unrelated = {
      ...element,
      id: "other-001",
      name: "Unrelated block",
    } satisfies CatalogElement;
    const details = new Map<string, CatalogElement>([
      [leaf.id, leaf],
      [requested.id, requested],
      [unrelated.id, unrelated],
    ]);
    const { fetch, calls } = createRemoteFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return createRemoteJsonResponse({
          schemaVersion: 1,
          blocks: [
            metadataOnly(unrelated),
            metadataOnly(requested),
            metadataOnly(leaf),
          ],
        });
      }

      const id = url
        .split("/")
        .at(-1)
        ?.replace(/\.json$/, "");
      const detail = id === undefined ? undefined : details.get(id);

      if (detail === undefined) {
        throw new Error(`unexpected detail request: ${url}`);
      }

      return createRemoteJsonResponse(detail);
    });

    const result = await invokeRemote(project, ["add", "hero-001"], fetch);

    expect(result.status).toBe(0);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/leaf-001.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
    expect(calls).not.toContain(
      "https://registry.example.test/blocks/other-001.json",
    );
  });

  it("rejects invalid remote detail before package installation or writes", async () => {
    const project = await createProject();
    const remoteIndexElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const invalidDetailElement = {
      ...remoteIndexElement,
      files: remoteIndexElement.files.map(({ path: filePath, kind }) => ({
        path: filePath,
        kind,
      })),
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => ({
        packages: [{ name: "motion", version: "^12.0.0" }],
      })),
    };
    const { fetch } = createRemoteFetch(async (url) =>
      createRemoteJsonResponse(
        url.endsWith("/registry.json")
          ? { schemaVersion: 1, blocks: [metadataOnly(remoteIndexElement)] }
          : invalidDetailElement,
      ),
    );
    const packageBefore = await readFile(
      path.join(project, "package.json"),
      "utf8",
    );

    const result = await invokeRemote(
      project,
      ["add", "hero-001"],
      fetch,
      packageInstaller,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing inline content");
    expect(packageInstaller.install).not.toHaveBeenCalled();
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(path.join(project, "package.json"), "utf8"),
    ).resolves.toBe(packageBefore);
  });

  it("installs remote inline text and asset payloads after detail validation", async () => {
    const project = await createProject();
    const remoteIndexElement = {
      ...element,
      files: [
        { path: "component.tsx", kind: "component" as const },
        { path: "assets/logo.svg", kind: "asset" as const },
      ],
    } satisfies CatalogElement;
    const assetContent = Buffer.from("<svg>remote</svg>\n").toString("base64");
    const remoteDetailElement = {
      ...remoteIndexElement,
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content: "export const RemoteHero = true;\n",
        },
        {
          path: "assets/logo.svg",
          kind: "asset" as const,
          content: assetContent,
        },
      ],
    } satisfies CatalogElement;
    const { fetch, calls } = createRemoteFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return createRemoteJsonResponse({
          schemaVersion: 1,
          blocks: [remoteIndexElement],
        });
      }

      return createRemoteJsonResponse(remoteDetailElement);
    });

    const result = await invokeRemote(project, ["add", "hero-001"], fetch);

    expect(result.status).toBe(0);
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
        "utf8",
      ),
    ).resolves.toBe("export const RemoteHero = true;\n");
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/assets/logo.svg"),
        "utf8",
      ),
    ).resolves.toBe(assetContent);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
  });

  it("downloads details only for the resolved remote dependency chain", async () => {
    const project = await createProject();
    const leaf = {
      ...element,
      id: "leaf-001",
      name: "Leaf block",
      files: [
        {
          path: "component.tsx",
          kind: "component" as const,
          content: "export const Leaf = true;\n",
        },
      ],
    } satisfies CatalogElement;
    const requested = {
      ...element,
      dependencies: [{ kind: "auren" as const, id: "leaf-001" }],
    } satisfies CatalogElement;
    const unrelated = {
      ...element,
      id: "other-001",
      name: "Unrelated block",
    } satisfies CatalogElement;
    const details = new Map<string, CatalogElement>([
      [leaf.id, leaf],
      [requested.id, requested],
      [unrelated.id, unrelated],
    ]);
    const { fetch, calls } = createRemoteFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return createRemoteJsonResponse({
          schemaVersion: 1,
          blocks: [
            metadataOnly(unrelated),
            metadataOnly(requested),
            metadataOnly(leaf),
          ],
        });
      }

      const id = url
        .split("/")
        .at(-1)
        ?.replace(/\.json$/, "");
      const detail = id === undefined ? undefined : details.get(id);

      if (detail === undefined) {
        throw new Error(`unexpected detail request: ${url}`);
      }

      return createRemoteJsonResponse(detail);
    });

    const result = await invokeRemote(project, ["add", "hero-001"], fetch);

    expect(result.status).toBe(0);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/leaf-001.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
    expect(calls).not.toContain(
      "https://registry.example.test/blocks/other-001.json",
    );
  });

  it("rejects invalid remote detail before package installation or writes", async () => {
    const project = await createProject();
    const remoteIndexElement = {
      ...element,
      dependencies: [
        { kind: "package" as const, name: "motion", version: "^12.0.0" },
      ],
    } satisfies CatalogElement;
    const invalidDetailElement = {
      ...remoteIndexElement,
      files: remoteIndexElement.files.map(({ path: filePath, kind }) => ({
        path: filePath,
        kind,
      })),
    } satisfies CatalogElement;
    const packageInstaller: PackageInstaller = {
      install: vi.fn(async () => ({
        packages: [{ name: "motion", version: "^12.0.0" }],
      })),
    };
    const { fetch } = createRemoteFetch(async (url) =>
      createRemoteJsonResponse(
        url.endsWith("/registry.json")
          ? { schemaVersion: 1, blocks: [metadataOnly(remoteIndexElement)] }
          : invalidDetailElement,
      ),
    );
    const packageBefore = await readFile(
      path.join(project, "package.json"),
      "utf8",
    );

    const result = await invokeRemote(
      project,
      ["add", "hero-001"],
      fetch,
      packageInstaller,
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing inline content");
    expect(packageInstaller.install).not.toHaveBeenCalled();
    await expect(
      readFile(
        path.join(project, "src/components/auren/hero-001/component.tsx"),
      ),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      readFile(path.join(project, "package.json"), "utf8"),
    ).resolves.toBe(packageBefore);
  });
});
