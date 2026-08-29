import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ProjectDetectionError, detectProject } from "./detect-project.js";

async function createFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "auren-project-detection-"));
}

async function writeJson(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  await writeFile(
    path.join(root, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

async function snapshotFiles(
  root: string,
  relativePaths: readonly string[],
): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();

  for (const relativePath of relativePaths) {
    snapshot.set(
      relativePath,
      await readFile(path.join(root, relativePath), "utf8"),
    );
  }

  return snapshot;
}

describe("detectProject", () => {
  it("detects React, TypeScript, Tailwind v4, shadcn, aliases, src, and explicit package manager evidence", async () => {
    const root = await createFixture();

    try {
      await mkdir(path.join(root, "src"));
      await mkdir(path.join(root, "node_modules/tailwindcss"), {
        recursive: true,
      });
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0", tailwindcss: "^4.1.0" },
        devDependencies: { typescript: "^5.9.0" },
        peerDependencies: { "peer-package": "^1.0.0" },
        optionalDependencies: { "optional-package": "^2.0.0" },
        packageManager: "pnpm@11.21.0",
      });
      await writeJson(root, "node_modules/tailwindcss/package.json", {
        name: "tailwindcss",
        version: "4.1.3",
      });
      await writeJson(root, "tsconfig.json", {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
      });
      await writeJson(root, "components.json", {
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
        },
        tsx: true,
      });
      await writeFile(path.join(root, "package-lock.json"), "{}");

      const detection = await detectProject(root);

      expect(detection.projectDir).toBe(root);
      expect(detection.framework).toBe("react");
      expect(detection.typescript).toBe(true);
      expect(detection.tailwind).toEqual({
        detected: true,
        declaredRange: "^4.1.0",
        installedVersion: "4.1.3",
        major: 4,
        configPath: null,
      });
      expect(detection.shadcn).toEqual({
        detected: true,
        configPath: "components.json",
        aliases: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
        },
        uiAlias: "@/components/ui",
        tsx: true,
      });
      expect(detection.aliases).toEqual({
        typescript: {
          configPath: "tsconfig.json",
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
        shadcn: {
          components: "@/components",
          utils: "@/lib/utils",
          ui: "@/components/ui",
        },
      });
      expect(detection.source.hasSrcDirectory).toBe(true);
      expect(detection.dependencies).toEqual({
        react: "^19.0.0",
        tailwindcss: "^4.1.0",
        typescript: "^5.9.0",
        "peer-package": "^1.0.0",
        "optional-package": "^2.0.0",
      });
      expect(detection.packageManager).toEqual({
        name: "pnpm",
        version: "11.21.0",
        evidence: "packageManager",
        path: "package.json",
      });
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({ code: "conflicting-package-managers" }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects Tailwind from a config marker without executing it", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {});
      await writeFile(
        path.join(root, "tailwind.config.ts"),
        "import { writeFileSync } from 'node:fs';\nwriteFileSync('side-effect', 'bad');\nexport default {};\n",
      );

      const detection = await detectProject(root);

      expect(detection.tailwind).toEqual({
        detected: true,
        declaredRange: null,
        installedVersion: null,
        major: null,
        configPath: "tailwind.config.ts",
      });
      await expect(
        readFile(path.join(root, "side-effect"), "utf8"),
      ).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses installed Tailwind package metadata when manifest evidence is absent", async () => {
    const root = await createFixture();

    try {
      await mkdir(path.join(root, "node_modules/tailwindcss"), {
        recursive: true,
      });
      await writeJson(root, "package.json", {});
      await writeJson(root, "node_modules/tailwindcss/package.json", {
        version: "3.4.17",
      });

      const detection = await detectProject(root);

      expect(detection.tailwind.detected).toBe(true);
      expect(detection.tailwind.declaredRange).toBeNull();
      expect(detection.tailwind.installedVersion).toBe("3.4.17");
      expect(detection.tailwind.major).toBe(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports JSONC project config inheritance with child precedence", async () => {
    const root = await createFixture();

    try {
      await writeFile(
        path.join(root, "base.json"),
        `{
          // inherited alias
          "compilerOptions": {
            "baseUrl": ".",
            "paths": {
              "@/*": ["./src/*"],
              "~/*": ["./shared/*"],
            },
          },
        }`,
      );
      await writeFile(
        path.join(root, "tsconfig.json"),
        `{
          "extends": "./base.json",
          "compilerOptions": {
            "baseUrl": "src",
            "paths": { "@/*": ["./app/*"] }
          }
        }`,
      );

      const detection = await detectProject(root);

      expect(detection.typescript).toBe(true);
      expect(detection.aliases.typescript).toEqual({
        configPath: "tsconfig.json",
        baseUrl: "src",
        paths: { "@/*": ["./app/*"], "~/*": ["./shared/*"] },
      });
      expect(detection.diagnostics).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports unsupported, external, cyclic, and unreadable config inheritance as diagnostics", async () => {
    const root = await createFixture();

    try {
      await writeFile(
        path.join(root, "tsconfig.json"),
        `{ "extends": "./cycle.json" }`,
      );
      await writeFile(
        path.join(root, "cycle.json"),
        `{ "extends": "./tsconfig.json" }`,
      );
      let detection = await detectProject(root);
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({
          code: "config-extends-cycle",
          path: "tsconfig.json",
        }),
      ]);

      await writeFile(
        path.join(root, "tsconfig.json"),
        `{ "extends": "../outside.json" }`,
      );
      detection = await detectProject(root);
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({ code: "external-config-extends" }),
      ]);

      await writeFile(
        path.join(root, "tsconfig.json"),
        `{ "extends": "@tsconfig/node20/tsconfig.json" }`,
      );
      detection = await detectProject(root);
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({ code: "unsupported-config-extends" }),
      ]);

      await writeFile(
        path.join(root, "tsconfig.json"),
        `{ "extends": "./missing.json" }`,
      );
      detection = await detectProject(root);
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({
          code: "unreadable-file",
          path: "missing.json",
        }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("returns empty, false, or null values when optional signals are absent", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {});

      const detection = await detectProject(root);

      expect(detection.framework).toBeNull();
      expect(detection.typescript).toBe(false);
      expect(detection.tailwind.detected).toBe(false);
      expect(detection.shadcn).toEqual({
        detected: false,
        configPath: null,
        aliases: {},
        uiAlias: null,
        tsx: null,
      });
      expect(detection.source.hasSrcDirectory).toBe(false);
      expect(detection.aliases.typescript).toEqual({
        configPath: null,
        baseUrl: null,
        paths: {},
      });
      expect(detection.packageManager).toBeNull();
      expect(detection.diagnostics).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps partial valid detections when optional configuration is malformed", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0" },
      });
      await writeFile(path.join(root, "components.json"), "{ not-json");

      const detection = await detectProject(root);

      expect(detection.framework).toBe("react");
      expect(detection.shadcn).toEqual({
        detected: true,
        configPath: "components.json",
        aliases: {},
        uiAlias: null,
        tsx: null,
      });
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({
          code: "malformed-json",
          path: "components.json",
        }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports missing and invalid shadcn fields without conflating alias sources", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {});
      await writeJson(root, "components.json", {
        aliases: {
          components: "@/components",
          ui: false,
          invalid: 42,
        },
        tsx: "yes",
      });
      await writeJson(root, "jsconfig.json", {
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["./src/*"] },
        },
      });

      const detection = await detectProject(root);

      expect(detection.shadcn).toEqual({
        detected: true,
        configPath: "components.json",
        aliases: { components: "@/components" },
        uiAlias: null,
        tsx: null,
      });
      expect(detection.aliases.typescript).toEqual({
        configPath: "jsconfig.json",
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      });
      expect(detection.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "invalid-shadcn-config",
            path: "components.json",
            message: expect.stringContaining("aliases.ui"),
          }),
          expect.objectContaining({
            code: "invalid-shadcn-config",
            path: "components.json",
            message: expect.stringContaining("tsx"),
          }),
        ]),
      );
      expect(detection.diagnostics).toHaveLength(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("supports a components config with omitted optional shadcn fields", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {});
      await writeJson(root, "components.json", {
        aliases: { components: "@/components" },
      });

      await expect(detectProject(root)).resolves.toMatchObject({
        shadcn: {
          detected: true,
          configPath: "components.json",
          aliases: { components: "@/components" },
          uiAlias: null,
          tsx: null,
        },
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects package managers through deterministic precedence", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {});
      await writeFile(
        path.join(root, "pnpm-lock.yaml"),
        "lockfileVersion: '9.0'\n",
      );
      let detection = await detectProject(root);
      expect(detection.packageManager).toEqual({
        name: "pnpm",
        version: null,
        evidence: "lockfile",
        path: "pnpm-lock.yaml",
      });

      await writeFile(path.join(root, "yarn.lock"), "");
      detection = await detectProject(root);
      expect(detection.packageManager).toBeNull();
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({ code: "ambiguous-package-manager" }),
      ]);

      await rm(path.join(root, "pnpm-lock.yaml"));
      await rm(path.join(root, "yarn.lock"));
      await writeFile(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
      detection = await detectProject(root);
      expect(detection.packageManager).toEqual({
        name: "pnpm",
        version: null,
        evidence: "workspace",
        path: "pnpm-workspace.yaml",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports invalid package manager values without discarding unrelated detections", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0" },
        packageManager: "deno@2.0.0",
      });

      const detection = await detectProject(root);

      expect(detection.framework).toBe("react");
      expect(detection.packageManager).toBeNull();
      expect(detection.diagnostics).toEqual([
        expect.objectContaining({
          code: "invalid-package-manager",
          path: "package.json",
        }),
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing or non-directory roots with ProjectDetectionError causes", async () => {
    const root = await createFixture();

    try {
      const missingRoot = path.join(root, "missing");
      await expect(detectProject(missingRoot)).rejects.toBeInstanceOf(
        ProjectDetectionError,
      );

      await writeFile(path.join(root, "file.txt"), "not a directory");
      await expect(
        detectProject(path.join(root, "file.txt")),
      ).rejects.toMatchObject({
        name: "ProjectDetectionError",
        requestedDir: path.join(root, "file.txt"),
        cause: expect.any(Error),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not mutate fixture files", async () => {
    const root = await createFixture();

    try {
      await writeJson(root, "package.json", {
        dependencies: { react: "^19.0.0" },
      });
      await writeJson(root, "components.json", {
        aliases: { components: "@/components" },
      });
      const before = await snapshotFiles(root, [
        "package.json",
        "components.json",
      ]);

      await detectProject(root);

      expect(
        await snapshotFiles(root, ["package.json", "components.json"]),
      ).toEqual(before);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
