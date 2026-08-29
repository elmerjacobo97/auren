import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { AurenConfiguration } from "./configuration.js";
import {
  AurenConfigurationError,
  readAurenConfig,
  writeAurenConfig,
} from "./configuration.js";

const validConfiguration: AurenConfiguration = {
  framework: "react",
  components: "src/components/auren",
  tailwind: true,
  output: {
    utilities: "src/lib/auren",
    styles: "src/styles/auren",
    assets: "public/auren",
  },
  aliases: {
    components: "@/components",
    lib: "@/lib",
  },
  integrations: {
    shadcn: {
      enabled: true,
      style: "new-york",
      options: ["neutral", null, { rounded: false }],
    },
  },
};

async function createFixture(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "auren-configuration-"));
}

async function temporaryFiles(root: string): Promise<string[]> {
  return (await readdir(root)).filter((entry) =>
    entry.startsWith(".auren.json."),
  );
}

describe("readAurenConfig", () => {
  it("returns null for an absent or non-file root configuration", async () => {
    const root = await createFixture();

    try {
      expect(await readAurenConfig(root)).toBeNull();

      await mkdir(path.join(root, "auren.json"));
      expect(await readAurenConfig(root)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reads only a valid root configuration and leaves it unchanged", async () => {
    const parent = await createFixture();
    const child = path.join(parent, "child");

    try {
      await mkdir(child);
      const contents = `${JSON.stringify(validConfiguration, null, 2)}\n`;
      await writeFile(path.join(parent, "auren.json"), contents);
      await writeFile(path.join(child, "auren.json"), contents);
      const before = await readFile(path.join(child, "auren.json"), "utf8");

      expect(await readAurenConfig(child)).toEqual(validConfiguration);
      expect(await readFile(path.join(child, "auren.json"), "utf8")).toBe(
        before,
      );
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("does not inherit a parent configuration", async () => {
    const parent = await createFixture();
    const child = path.join(parent, "child");

    try {
      await mkdir(child);
      await writeFile(
        path.join(parent, "auren.json"),
        `${JSON.stringify(validConfiguration)}\n`,
      );

      expect(await readAurenConfig(child)).toBeNull();
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("reports malformed JSON with the configuration path and cause", async () => {
    const root = await createFixture();
    const configurationPath = path.join(root, "auren.json");

    try {
      await writeFile(configurationPath, '{ "framework": ');

      await expect(readAurenConfig(root)).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "malformed-json",
        path: configurationPath,
        cause: expect.any(SyntaxError),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports schema-invalid JSON without returning a partial result", async () => {
    const root = await createFixture();
    const configurationPath = path.join(root, "auren.json");

    try {
      await writeFile(
        configurationPath,
        `${JSON.stringify({ ...validConfiguration, tailwind: "true" })}\n`,
      );

      await expect(readAurenConfig(root)).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-configuration",
        path: configurationPath,
        cause: expect.objectContaining({ issues: expect.any(Array) }),
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing and non-directory project roots", async () => {
    const root = await createFixture();
    const missingRoot = path.join(root, "missing");
    const fileRoot = path.join(root, "file.txt");

    try {
      await expect(readAurenConfig(missingRoot)).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-project-directory",
        path: path.join(missingRoot, "auren.json"),
        cause: expect.any(Error),
      });
      await expect(
        writeAurenConfig(missingRoot, validConfiguration),
      ).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-project-directory",
        path: path.join(missingRoot, "auren.json"),
        cause: expect.any(Error),
      });

      await writeFile(fileRoot, "not a directory");
      await expect(readAurenConfig(fileRoot)).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-project-directory",
        path: path.join(fileRoot, "auren.json"),
        cause: expect.any(Error),
      });
      await expect(
        writeAurenConfig(fileRoot, validConfiguration),
      ).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-project-directory",
        path: path.join(fileRoot, "auren.json"),
        cause: expect.any(Error),
      });

      await expect(stat(missingRoot)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("writeAurenConfig", () => {
  it("writes deterministic JSON and replaces an existing root file", async () => {
    const root = await createFixture();
    const configurationPath = path.join(root, "auren.json");
    const replacement: AurenConfiguration = {
      framework: "react",
      components: "src/components",
      tailwind: false,
    };

    try {
      expect(await writeAurenConfig(root, validConfiguration)).toEqual(
        validConfiguration,
      );
      expect(await readFile(configurationPath, "utf8")).toBe(
        `${JSON.stringify(validConfiguration, null, 2)}\n`,
      );

      expect(await writeAurenConfig(root, replacement)).toEqual(replacement);
      expect(await readFile(configurationPath, "utf8")).toBe(
        `${JSON.stringify(replacement, null, 2)}\n`,
      );
      expect(await temporaryFiles(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates before mutation and preserves an existing file for invalid input", async () => {
    const root = await createFixture();
    const configurationPath = path.join(root, "auren.json");
    const existingContents = '{"preserve":"exactly"}\n';

    try {
      await writeFile(configurationPath, existingContents);

      await expect(
        writeAurenConfig(root, { ...validConfiguration, unknown: true }),
      ).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "invalid-configuration",
        path: configurationPath,
        cause: expect.objectContaining({ issues: expect.any(Array) }),
      });

      expect(await readFile(configurationPath, "utf8")).toBe(existingContents);
      expect(await temporaryFiles(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not create a missing project root", async () => {
    const root = await createFixture();
    const missingRoot = path.join(root, "missing");

    try {
      await expect(
        writeAurenConfig(missingRoot, validConfiguration),
      ).rejects.toBeInstanceOf(AurenConfigurationError);
      await expect(stat(missingRoot)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("cleans up the temporary sibling when replacement fails", async () => {
    const root = await createFixture();
    const configurationPath = path.join(root, "auren.json");

    try {
      await mkdir(configurationPath);

      await expect(
        writeAurenConfig(root, validConfiguration),
      ).rejects.toMatchObject({
        name: "AurenConfigurationError",
        code: "write-failed",
        path: configurationPath,
        cause: expect.any(Error),
      });

      expect((await stat(configurationPath)).isDirectory()).toBe(true);
      expect(await temporaryFiles(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
