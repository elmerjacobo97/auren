import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PackageInstaller } from "./package-installer.js";
import type { ShadcnInstaller } from "./shadcn-installer.js";
import {
  cleanupFixtures,
  configureShadcn,
  createProject,
  createRecord,
  createSource,
  element,
  invoke,
  shadcnDependency,
} from "./add-test-support.js";

afterEach(cleanupFixtures);

describe("auren add command — shadcn/ui dependencies", () => {
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
});
