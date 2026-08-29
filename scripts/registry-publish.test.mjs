import { strict as assert } from "node:assert";
import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";
import { catalogElementSchema } from "@auren/schemas/catalog";
import { expectedBlockCategories } from "./verify-workspace.mjs";
import { buildRegistry } from "./registry-build/builder.mjs";
import { publishRegistry } from "./registry-publish/publisher.mjs";
import { loadPublicRegistry } from "./registry-publish/validator.mjs";

const execFile = promisify(execFileCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentSource = "export function ExampleBlock() { return null; }\n";

async function withFixture(callback) {
  const blocksRoot = await mkdtemp(
    path.join(tmpdir(), "auren-publish-blocks-"),
  );

  try {
    for (const category of expectedBlockCategories) {
      await mkdir(path.join(blocksRoot, category), { recursive: true });
      await writeFile(path.join(blocksRoot, category, ".gitkeep"), "");
    }

    return await callback(blocksRoot);
  } finally {
    await rm(blocksRoot, { recursive: true, force: true });
  }
}

async function withRoots(callback) {
  const parent = await mkdtemp(path.join(tmpdir(), "auren-publish-roots-"));

  try {
    return await callback({
      parent,
      registryRoot: path.join(parent, "registry"),
      outputRoot: path.join(parent, "public-registry"),
    });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

function baseManifest({
  category,
  type,
  id,
  files,
  dependencies = [],
  metadata = {},
}) {
  return {
    id,
    name: "Example block",
    description: "A structurally valid temporary block fixture.",
    category,
    type,
    styles: ["minimal"],
    industries: ["saas"],
    features: ["mobile-first", "responsive"],
    frameworks: ["react"],
    dependencies,
    files,
    metadata,
  };
}

async function createBlock(
  blocksRoot,
  {
    category = "marketing",
    type = "hero",
    id = "hero-001",
    sourceFiles = ["component.tsx"],
    descriptors = sourceFiles.map((sourcePath) => ({
      path: sourcePath,
      kind: sourcePath === "component.tsx" ? "component" : "utility",
    })),
    manifestChanges = {},
    sourceContents = {},
  } = {},
) {
  const blockRoot = path.join(blocksRoot, category, type, id);
  await mkdir(blockRoot, { recursive: true });

  for (const sourcePath of sourceFiles) {
    const filePath = path.join(blockRoot, ...sourcePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      sourceContents[sourcePath] ?? defaultContent(sourcePath),
    );
  }

  const manifest = {
    ...baseManifest({ category, type, id, files: descriptors }),
    ...manifestChanges,
  };
  await writeFile(
    path.join(blockRoot, "registry.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return blockRoot;
}

function defaultContent(sourcePath) {
  if (sourcePath.endsWith(".webp")) {
    return Buffer.from([0, 1, 2, 255, 254]);
  }

  return componentSource;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function snapshotTree(directory) {
  const entries = [];

  async function visit(currentDirectory) {
    const children = await readdir(currentDirectory, { withFileTypes: true });

    for (const child of children.sort((left, right) =>
      compareStrings(left.name, right.name),
    )) {
      const childPath = path.join(currentDirectory, child.name);

      if (child.isDirectory()) {
        await visit(childPath);
      } else if (child.isFile()) {
        entries.push([
          path.relative(directory, childPath).split(path.sep).join("/"),
          (await readFile(childPath)).toString("base64"),
        ]);
      }
    }
  }

  await visit(directory);
  return JSON.stringify(entries);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorText(error) {
  return [error.message, ...(error.details ?? [])].join("\n");
}

async function createGeneratedRegistry(blocksRoot, registryRoot) {
  await buildRegistry({ blocksRoot, outputRoot: registryRoot });
}

async function withPublishedRegistry(callback) {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot);

    await withRoots(async ({ registryRoot, outputRoot, ...roots }) => {
      await createGeneratedRegistry(blocksRoot, registryRoot);
      await publishRegistry({ registryRoot, outputRoot });
      const outputSnapshot = await snapshotTree(outputRoot);

      await callback({
        blocksRoot,
        registryRoot,
        outputRoot,
        outputSnapshot,
        ...roots,
      });
    });
  });
}

test("publishes a schema-valid custom root without changing bytes or source", async () => {
  await withFixture(async (blocksRoot) => {
    const sourceFiles = [
      "component.tsx",
      "assets/preview.webp",
      "utilities/types.ts",
    ];
    await createBlock(blocksRoot, {
      sourceFiles,
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "assets/preview.webp", kind: "asset" },
        { path: "utilities/types.ts", kind: "utility" },
      ],
      sourceContents: {
        "component.tsx": "export function Hero() { return null; }\n",
        "assets/preview.webp": Buffer.from([0, 1, 2, 255, 254]),
        "utilities/types.ts": 'export type HeroSize = "sm" | "lg";\n',
      },
    });
    const sourceSnapshot = await snapshotTree(blocksRoot);

    await withRoots(async ({ registryRoot, outputRoot }) => {
      await createGeneratedRegistry(blocksRoot, registryRoot);
      const registrySnapshot = await snapshotTree(registryRoot);

      const result = await publishRegistry({ registryRoot, outputRoot });

      assert.equal(result.blockCount, 1);
      assert.equal(await snapshotTree(outputRoot), registrySnapshot);
      assert.equal(await snapshotTree(blocksRoot), sourceSnapshot);

      const published = await loadPublicRegistry(outputRoot);
      const index = await readJson(path.join(outputRoot, "registry.json"));
      const detail = await readJson(
        path.join(outputRoot, "blocks/hero-001.json"),
      );

      catalogElementSchema.parse(index.blocks[0]);
      catalogElementSchema.parse(detail);
      assert.deepEqual(
        index.blocks.map((block) => block.id),
        ["hero-001"],
      );
      assert.equal(detail.id, "hero-001");
      assert.equal(published.details[0].detail.id, index.blocks[0].id);
      assert.equal(
        detail.files.find((file) => file.path === "component.tsx").content,
        "export function Hero() { return null; }\n",
      );
      assert.deepEqual(
        Buffer.from(
          detail.files.find((file) => file.path === "assets/preview.webp")
            .content,
          "base64",
        ),
        Buffer.from([0, 1, 2, 255, 254]),
      );
    });
  });
});

test("repeated publication is deterministic and replaces stale details", async () => {
  await withFixture(async (blocksRoot) => {
    const oldBlockRoot = await createBlock(blocksRoot, { id: "hero-001" });
    await createBlock(blocksRoot, { id: "hero-002" });

    await withRoots(async ({ registryRoot, outputRoot, parent }) => {
      await createGeneratedRegistry(blocksRoot, registryRoot);
      await publishRegistry({ registryRoot, outputRoot });
      const firstSnapshot = await snapshotTree(outputRoot);

      await publishRegistry({ registryRoot, outputRoot });
      assert.equal(await snapshotTree(outputRoot), firstSnapshot);
      assert.deepEqual(
        (await readdir(path.join(outputRoot, "blocks"))).sort(),
        ["hero-001.json", "hero-002.json"],
      );

      const secondOutputRoot = path.join(parent, "public-registry-again");
      await publishRegistry({
        registryRoot,
        outputRoot: secondOutputRoot,
      });
      assert.equal(await snapshotTree(secondOutputRoot), firstSnapshot);

      await rm(oldBlockRoot, { recursive: true, force: true });
      await createGeneratedRegistry(blocksRoot, registryRoot);
      await publishRegistry({ registryRoot, outputRoot });
      assert.deepEqual(
        (await readdir(path.join(outputRoot, "blocks"))).sort(),
        ["hero-002.json"],
      );
    });
  });
});

test("rejects malformed and schema-invalid resources before replacement", async () => {
  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      await writeFile(path.join(registryRoot, "registry.json"), "{\n");

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /Registry JSON is malformed/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);

      const validIndex = {
        schemaVersion: 1,
        blocks: [
          {
            id: "hero-001",
            name: "Example block",
            description: "A structurally valid temporary block fixture.",
            category: "marketing",
            type: "hero",
            styles: ["minimal"],
            industries: ["saas"],
            features: ["mobile-first", "responsive"],
            frameworks: ["react"],
            dependencies: [],
            files: [{ path: "component.tsx", kind: "component" }],
            metadata: {},
          },
        ],
      };
      await writeJson(path.join(registryRoot, "registry.json"), validIndex);
      await writeFile(path.join(registryRoot, "blocks/hero-001.json"), "{\n");

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /Registry JSON is malformed/);
          assert.match(errorText(error), /hero-001\.json/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const detailPath = path.join(registryRoot, "blocks/hero-001.json");
      const detail = await readJson(detailPath);
      detail.name = "";
      await writeJson(detailPath, detail);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /@auren\/schemas\/catalog validation/);
          assert.match(errorText(error), /hero-001/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );
});

test("rejects missing, extra, duplicate, and mismatched details", async () => {
  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      await rm(path.join(registryRoot, "blocks/hero-001.json"));
      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /missing detail/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const detail = await readJson(
        path.join(registryRoot, "blocks/hero-001.json"),
      );
      detail.id = "hero-002";
      await writeJson(path.join(registryRoot, "blocks/hero-002.json"), detail);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /extra detail not listed by index/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const indexPath = path.join(registryRoot, "registry.json");
      const index = await readJson(indexPath);
      index.blocks.push(index.blocks[0]);
      await writeJson(indexPath, index);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /duplicate block id/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const detailPath = path.join(registryRoot, "blocks/hero-001.json");
      const detail = await readJson(detailPath);
      detail.description = "Different detail metadata.";
      await writeJson(detailPath, detail);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /metadata differ/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );
});

test("requires inline content and rejects installation targets", async () => {
  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const detailPath = path.join(registryRoot, "blocks/hero-001.json");
      const detail = await readJson(detailPath);
      delete detail.files[0].content;
      await writeJson(detailPath, detail);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /missing inline file content/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      const detailPath = path.join(registryRoot, "blocks/hero-001.json");
      const detail = await readJson(detailPath);
      detail.files[0].target = "src/component.tsx";
      await writeJson(detailPath, detail);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /forbidden file target/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );
});

test("rejects unsafe names and unexpected entries", async () => {
  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      await rename(
        path.join(registryRoot, "blocks/hero-001.json"),
        path.join(registryRoot, "blocks/hero_001.json"),
      );

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /filename is unsafe/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      await writeFile(
        path.join(registryRoot, "blocks/notes.txt"),
        "not JSON\n",
      );

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /detail entry is not JSON/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );

  await withPublishedRegistry(
    async ({ registryRoot, outputRoot, outputSnapshot }) => {
      await writeFile(
        path.join(registryRoot, "README.txt"),
        "not a resource\n",
      );

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /unexpected top-level entry/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    },
  );
});

test("protects unrelated outputs and rejects overlapping roots", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot);

    await withRoots(async ({ parent, registryRoot, outputRoot }) => {
      await createGeneratedRegistry(blocksRoot, registryRoot);
      await mkdir(outputRoot, { recursive: true });
      const unrelatedPath = path.join(outputRoot, "unrelated.txt");
      await writeFile(unrelatedPath, "keep me\n");
      const unrelatedSnapshot = await snapshotTree(outputRoot);

      await assert.rejects(
        () => publishRegistry({ registryRoot, outputRoot }),
        (error) => {
          assert.match(
            errorText(error),
            /not recognizable public Registry output/,
          );
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), unrelatedSnapshot);

      const sourceSnapshot = await snapshotTree(registryRoot);
      for (const overlappingOutput of [
        registryRoot,
        path.join(registryRoot, "nested-output"),
        parent,
      ]) {
        await assert.rejects(
          () =>
            publishRegistry({
              registryRoot,
              outputRoot: overlappingOutput,
            }),
          (error) => {
            assert.match(errorText(error), /roots must be disjoint/);
            return true;
          },
        );
        assert.equal(await snapshotTree(registryRoot), sourceSnapshot);
      }
    });
  });
});

test("cleans up a staging setup failure without changing the source", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot);
    await withRoots(async ({ parent, registryRoot }) => {
      await createGeneratedRegistry(blocksRoot, registryRoot);
      const sourceSnapshot = await snapshotTree(registryRoot);
      const blockedParent = path.join(parent, "blocked-parent");
      await writeFile(blockedParent, "not a directory\n");

      await assert.rejects(
        () =>
          publishRegistry({
            registryRoot,
            outputRoot: path.join(blockedParent, "public-registry"),
          }),
        (error) => {
          assert.match(errorText(error), /not a directory|ENOTDIR/);
          return true;
        },
      );
      assert.equal(await snapshotTree(registryRoot), sourceSnapshot);
      assert.deepEqual((await readdir(parent)).sort(), [
        "blocked-parent",
        "registry",
      ]);
    });
  });
});

test("built commands publish the committed catalog without network or source mutation", async () => {
  const sourceRoot = path.join(root, "blocks");
  const sourceSnapshot = await snapshotTree(sourceRoot);

  await withRoots(async ({ registryRoot, outputRoot }) => {
    const buildResult = await execFile(
      process.execPath,
      [
        path.join(root, "scripts/build-registry.mjs"),
        "--output-root",
        registryRoot,
      ],
      { cwd: root },
    );
    assert.match(buildResult.stdout, /Registry build completed: 11 blocks/);

    const publishResult = await execFile(
      process.execPath,
      [
        path.join(root, "scripts/publish-registry.mjs"),
        "--registry-root",
        registryRoot,
        "--output-root",
        outputRoot,
      ],
      { cwd: root },
    );
    assert.match(
      publishResult.stdout,
      /Public Registry publication completed: 11 blocks/,
    );

    assert.equal(await snapshotTree(sourceRoot), sourceSnapshot);
    assert.deepEqual((await readdir(outputRoot)).sort(), [
      "blocks",
      "registry.json",
    ]);
    assert.equal((await readdir(path.join(outputRoot, "blocks"))).length, 11);
    const hero = await readJson(path.join(outputRoot, "blocks/hero-001.json"));
    assert.match(
      hero.files.find((file) => file.path === "component.tsx").content,
      /Ship your product pages without the busywork/,
    );
  });
});
