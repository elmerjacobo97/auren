import { strict as assert } from "node:assert";
import { execFile as execFileCallback } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogElementSchema } from "@auren/schemas/catalog";
import { collectionSchema } from "@auren/schemas/collection";
import { previewArtifactManifestSchema } from "@auren/schemas/preview";
import { expectedBlockCategories } from "./verify-workspace.mjs";
import { buildRegistry } from "./registry-build/builder.mjs";
import { createHostedPreviewDescriptor } from "./registry-build/hosted-preview.mjs";
import { createPreviewArtifactKey } from "./registry-build/preview.mjs";
import { createPreviewArtifactCache } from "./registry-build/preview-cache.mjs";
import { logPreviewDiagnostic } from "./registry-build/preview-diagnostics.mjs";

const execFile = promisify(execFileCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const componentSource = "export function ExampleBlock() { return null; }\n";

async function withFixture(callback) {
  const blocksRoot = await mkdtemp(path.join(tmpdir(), "auren-blocks-"));

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

async function withOutput(callback) {
  const parent = await mkdtemp(path.join(tmpdir(), "auren-output-"));

  try {
    return await callback(path.join(parent, "registry"), parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

function baseCollection({
  id = "saas-minimal",
  blocks = ["hero-001", "footer-001"],
  category = "marketing",
  metadata = {},
} = {}) {
  return {
    id,
    name: "SaaS Minimal",
    description: "A structurally valid temporary Collection fixture.",
    category,
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    blocks,
    metadata,
  };
}

async function createCollection(collectionsRoot, options = {}) {
  const collection = baseCollection(options);
  const collectionRoot = path.join(
    collectionsRoot,
    collection.category,
    collection.id,
  );
  await mkdir(collectionRoot, { recursive: true });
  await writeFile(
    path.join(collectionRoot, "registry.json"),
    `${JSON.stringify(collection, null, 2)}\n`,
  );
  return collectionRoot;
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
  if (sourcePath.endsWith(".css")) {
    return ".example-block { color: inherit; }\n";
  }

  if (sourcePath.endsWith(".webp")) {
    return Buffer.from([0, 1, 2, 255, 254]);
  }

  return componentSource;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
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

test("generates schema-valid index and detail payloads with text and binary content", async () => {
  await withFixture(async (blocksRoot) => {
    await withOutput(async (outputRoot) => {
      await createBlock(blocksRoot, {
        sourceFiles: [
          "component.tsx",
          "assets/preview.webp",
          "styles/hero.css",
          "utilities/types.ts",
        ],
        descriptors: [
          { path: "utilities/types.ts", kind: "utility" },
          { path: "component.tsx", kind: "component" },
          { path: "assets/preview.webp", kind: "asset" },
          { path: "styles/hero.css", kind: "style" },
        ],
        sourceContents: {
          "component.tsx": "export function Hero() { return null; }\n",
          "utilities/types.ts": 'export type HeroSize = "sm" | "lg";\n',
          "styles/hero.css": ".hero { color: red; }\n",
          "assets/preview.webp": Buffer.from([0, 1, 2, 255, 254]),
        },
        manifestChanges: {
          metadata: {
            zeta: { second: 2, first: 1 },
            alpha: ["first", "second"],
          },
        },
      });
      const sourceSnapshot = await snapshotTree(blocksRoot);

      await buildRegistry({ blocksRoot, outputRoot });

      const index = await readJson(path.join(outputRoot, "registry.json"));
      assert.equal(index.schemaVersion, 1);
      assert.deepEqual(
        index.blocks.map((block) => block.id),
        ["hero-001"],
      );
      assert.deepEqual(index.blocks[0].files, [
        { path: "assets/preview.webp", kind: "asset" },
        { path: "component.tsx", kind: "component" },
        { path: "styles/hero.css", kind: "style" },
        { path: "utilities/types.ts", kind: "utility" },
      ]);
      assert.equal(Object.hasOwn(index.blocks[0].files[0], "content"), false);
      catalogElementSchema.parse(index.blocks[0]);
      assert.equal(index.blocks[0].preview.status, "failure");
      assert.equal(index.blocks[0].preview.failure.category, "asset");

      const detail = await readJson(
        path.join(outputRoot, "blocks/hero-001.json"),
      );
      catalogElementSchema.parse(detail);
      assert.deepEqual(Object.keys(detail.metadata), ["alpha", "zeta"]);
      assert.deepEqual(Object.keys(detail.metadata.zeta), ["first", "second"]);
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
      assert.deepEqual(
        (await readdir(path.join(outputRoot, "blocks"))).sort(),
        ["hero-001.json"],
      );
      assert.equal(await snapshotTree(blocksRoot), sourceSnapshot);
    });
  });
});

test("sorts IDs and produces byte-identical output on repeated custom-root builds", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, { id: "hero-002" });
    await createBlock(blocksRoot, { id: "hero-001" });

    await withOutput(async (outputRoot) => {
      await buildRegistry({ blocksRoot, outputRoot });
      const firstSnapshot = await snapshotTree(outputRoot);
      const firstIndex = await readJson(path.join(outputRoot, "registry.json"));

      await buildRegistry({ blocksRoot, outputRoot });
      assert.equal(await snapshotTree(outputRoot), firstSnapshot);
      assert.deepEqual(
        firstIndex.blocks.map((block) => block.id),
        ["hero-001", "hero-002"],
      );
    });
  });
});

test("removes stale detail payloads after a source block is removed", async () => {
  await withFixture(async (blocksRoot) => {
    const oldBlockRoot = await createBlock(blocksRoot, { id: "hero-001" });

    await withOutput(async (outputRoot) => {
      await buildRegistry({ blocksRoot, outputRoot });
      await rm(oldBlockRoot, { recursive: true, force: true });
      await createBlock(blocksRoot, { id: "hero-002" });
      await buildRegistry({ blocksRoot, outputRoot });

      assert.deepEqual(
        (await readdir(path.join(outputRoot, "blocks"))).sort(),
        ["hero-002.json"],
      );
    });
  });
});

test("preserves an existing output when source preflight fails", async () => {
  await withFixture(async (blocksRoot) => {
    const blockRoot = await createBlock(blocksRoot);

    await withOutput(async (outputRoot, parent) => {
      await buildRegistry({ blocksRoot, outputRoot });
      const outputSnapshot = await snapshotTree(outputRoot);
      await writeFile(path.join(blockRoot, "registry.json"), "{\n");

      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /invalid JSON/);
          return true;
        },
      );

      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
      assert.deepEqual(await readdir(parent), ["registry"]);
    });
  });
});

test("preserves output for duplicate IDs and source inventory drift", async () => {
  await withFixture(async (blocksRoot) => {
    const blockRoot = await createBlock(blocksRoot);

    await withOutput(async (outputRoot) => {
      await buildRegistry({ blocksRoot, outputRoot });
      const outputSnapshot = await snapshotTree(outputRoot);
      const duplicateRoot = await createBlock(blocksRoot, {
        category: "application-ui",
        id: "hero-001",
      });

      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /block id "hero-001" is duplicated/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);

      await rm(duplicateRoot, { recursive: true, force: true });
      const manifest = await readJson(path.join(blockRoot, "registry.json"));
      manifest.files.push({ path: "utilities/missing.ts", kind: "utility" });
      await writeFile(
        path.join(blockRoot, "registry.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
      );

      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /utilities\/missing\.ts/);
          return true;
        },
      );
      assert.equal(await snapshotTree(outputRoot), outputSnapshot);
    });
  });
});

test("rejects missing and cyclic internal Auren dependencies", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      manifestChanges: {
        dependencies: [{ kind: "auren", id: "hero-999" }],
      },
    });

    await withOutput(async (outputRoot) => {
      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /hero-001.*hero-999/);
          return true;
        },
      );
    });
  });

  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      manifestChanges: {
        dependencies: [{ kind: "auren", id: "hero-002" }],
      },
    });
    await createBlock(blocksRoot, {
      id: "hero-002",
      manifestChanges: {
        dependencies: [{ kind: "auren", id: "hero-001" }],
      },
    });

    await withOutput(async (outputRoot) => {
      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(errorText(error), /internal Auren dependency cycle/);
          return true;
        },
      );
    });
  });
});

test("protects unrelated output and rejects overlapping roots", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot);

    await withOutput(async (outputRoot) => {
      const unrelatedPath = path.join(outputRoot, "unrelated.txt");
      await mkdir(outputRoot, { recursive: true });
      await writeFile(unrelatedPath, "keep me\n");

      await assert.rejects(
        () => buildRegistry({ blocksRoot, outputRoot }),
        (error) => {
          assert.match(
            errorText(error),
            /not recognizable Registry Build output/,
          );
          return true;
        },
      );
      assert.equal(await readFile(unrelatedPath, "utf8"), "keep me\n");
    });

    await assert.rejects(
      () =>
        buildRegistry({
          blocksRoot,
          outputRoot: path.join(blocksRoot, "generated"),
        }),
      (error) => {
        assert.match(errorText(error), /roots must be disjoint/);
        return true;
      },
    );
  });
});

test("builds, validates, and removes Collection metadata without touching sources", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, { id: "hero-001" });
    await createBlock(blocksRoot, { type: "footer", id: "footer-001" });
    const collectionsRoot = await mkdtemp(
      path.join(tmpdir(), "auren-collections-source-"),
    );

    try {
      await createCollection(collectionsRoot);
      const blocksSnapshot = await snapshotTree(blocksRoot);
      const collectionsSnapshot = await snapshotTree(collectionsRoot);

      await withOutput(async (outputRoot) => {
        await buildRegistry({ blocksRoot, collectionsRoot, outputRoot });

        assert.equal(await snapshotTree(blocksRoot), blocksSnapshot);
        assert.equal(await snapshotTree(collectionsRoot), collectionsSnapshot);
        const index = await readJson(path.join(outputRoot, "registry.json"));
        collectionSchema.parse(index.collections[0]);
        collectionSchema.parse(
          await readJson(
            path.join(outputRoot, "collections/saas-minimal.json"),
          ),
        );
        assert.deepEqual(index.collections[0].blocks, [
          "hero-001",
          "footer-001",
        ]);

        await rm(path.join(collectionsRoot, "marketing", "saas-minimal"), {
          recursive: true,
          force: true,
        });
        await buildRegistry({ blocksRoot, collectionsRoot, outputRoot });
        assert.deepEqual(
          (await readJson(path.join(outputRoot, "registry.json"))).collections,
          [],
        );
        await assert.rejects(
          () =>
            readFile(path.join(outputRoot, "collections/saas-minimal.json")),
          { code: "ENOENT" },
        );
      });

      assert.equal(await snapshotTree(blocksRoot), blocksSnapshot);
      assert.equal(await snapshotTree(collectionsRoot), "[]");
    } finally {
      await rm(collectionsRoot, { recursive: true, force: true });
    }
  });
});

test("built command generates the committed catalog without changing source", async () => {
  const sourceRoot = path.join(root, "blocks");
  const sourceSnapshot = await snapshotTree(sourceRoot);

  await withOutput(async (outputRoot) => {
    const { stdout } = await execFile(
      process.execPath,
      [
        path.join(root, "scripts/build-registry.mjs"),
        "--output-root",
        outputRoot,
      ],
      { cwd: root },
    );
    assert.match(
      stdout,
      /Registry build completed: 11 blocks and 1 collections/,
    );

    const index = await readJson(path.join(outputRoot, "registry.json"));
    assert.equal(index.blocks.length, 11);
    assert.equal(index.collections.length, 1);
    assert.deepEqual(
      index.blocks.map((block) => block.id),
      [...index.blocks.map((block) => block.id)].sort(compareStrings),
    );
    assert.deepEqual(index.collections[0].blocks, [
      "navbar-001",
      "hero-001",
      "features-001",
      "footer-001",
    ]);

    const collection = await readJson(
      path.join(outputRoot, "collections/saas-minimal.json"),
    );
    assert.equal(collection.id, "saas-minimal");
    assert.deepEqual(collection.blocks, index.collections[0].blocks);

    const hero = await readJson(path.join(outputRoot, "blocks/hero-001.json"));
    const heroComponent = hero.files.find(
      (file) => file.path === "component.tsx",
    );
    assert.match(
      heroComponent.content,
      /Ship your product pages without the busywork/,
    );
    assert.deepEqual((await readdir(outputRoot)).sort(), [
      "blocks",
      "collections",
      "previews",
      "registry.json",
    ]);
    assert.equal(await snapshotTree(sourceRoot), sourceSnapshot);
  });
});

test("publishes an immutable inline preview artifact and changes identity with source", async () => {
  await withFixture(async (blocksRoot) => {
    const blockRoot = await createBlock(blocksRoot, {
      sourceContents: {
        "component.tsx": "export function ExampleBlock() { return null; }\n",
      },
    });

    await withOutput(async (outputRoot) => {
      await buildRegistry({ blocksRoot, outputRoot });
      const firstIndex = await readJson(path.join(outputRoot, "registry.json"));
      const firstPreview = firstIndex.blocks[0].preview;
      const firstArtifact = await readJson(
        path.join(outputRoot, firstPreview.artifact.reference),
      );

      assert.equal(firstPreview.status, "ready");
      assert.equal(firstPreview.delivery, "inline");
      previewArtifactManifestSchema.parse(firstArtifact);
      assert.equal(firstArtifact.identity, firstPreview.identity);
      assert.equal(firstArtifact.contentId, "hero-001");
      assert.equal(firstArtifact.entry, "/index.tsx");

      await writeFile(
        path.join(blockRoot, "component.tsx"),
        "export function ExampleBlock() { return <div />; }\n",
      );
      await buildRegistry({ blocksRoot, outputRoot });
      const secondIndex = await readJson(
        path.join(outputRoot, "registry.json"),
      );

      assert.notEqual(
        secondIndex.blocks[0].preview.identity,
        firstPreview.identity,
      );
      await assert.rejects(
        () => readFile(path.join(outputRoot, firstPreview.artifact.reference)),
        { code: "ENOENT" },
      );
    });
  });
});

test("keeps a buildable Registry entry when preview compilation fails", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      sourceContents: {
        "component.tsx": "export function ExampleBlock( { return null; }\n",
      },
    });

    await withOutput(async (outputRoot) => {
      await buildRegistry({ blocksRoot, outputRoot });
      const index = await readJson(path.join(outputRoot, "registry.json"));
      const detail = await readJson(
        path.join(outputRoot, "blocks/hero-001.json"),
      );

      assert.deepEqual(index.blocks[0].preview, detail.preview);
      assert.equal(index.blocks[0].preview.status, "failure");
      assert.equal(index.blocks[0].preview.failure.category, "build");
      await assert.rejects(() => readdir(path.join(outputRoot, "previews")), {
        code: "ENOENT",
      });
    });
  });
});

test("creates a provider-neutral hosted descriptor and strips provider fields", async () => {
  const request = {
    schemaVersion: 1,
    contentType: "block",
    contentId: "hero-001",
    contentVersion: `sha256-${"a".repeat(64)}`,
    framework: "nextjs",
    runtime: "nextjs-app-router",
    runtimeVersion: "1.0.0",
    identity: `sha256-${"b".repeat(64)}`,
  };
  let receivedRequest;

  const descriptor = await createHostedPreviewDescriptor({
    request,
    createProject: async (received) => {
      receivedRequest = received;
      return {
        embedding: "denied",
        providerProjectId: "provider-secret",
        url: "https://preview.example.test/hero-001",
      };
    },
  });

  assert.deepEqual(receivedRequest, request);
  assert.deepEqual(descriptor, {
    ...request,
    delivery: "external",
    livePreview: {
      embedding: "denied",
      url: "https://preview.example.test/hero-001",
    },
    status: "ready",
  });
  assert.equal(Object.hasOwn(descriptor, "providerProjectId"), false);
});

test("records a provider failure without leaking provider error details", async () => {
  const descriptor = await createHostedPreviewDescriptor({
    request: {
      schemaVersion: 1,
      contentType: "page",
      contentId: "login-001",
      contentVersion: `sha256-${"c".repeat(64)}`,
      framework: "nextjs",
      runtime: "nextjs-app-router",
      runtimeVersion: "1.0.0",
      identity: `sha256-${"d".repeat(64)}`,
    },
    createProject: async () => {
      throw new Error("provider secret should not be published");
    },
  });

  assert.equal(descriptor.status, "failure");
  assert.deepEqual(descriptor.failure, {
    category: "provider",
    message: "The hosted preview provider could not create a project.",
  });
});

test("reuses preview builds by identity and invalidates changed source", async () => {
  const element = {
    id: "hero-001",
    dependencies: [],
  };
  const source = [
    {
      content: "export function Hero() { return null; }",
      kind: "component",
      path: "component.tsx",
    },
  ];
  const cache = createPreviewArtifactCache();
  const firstKey = await createPreviewArtifactKey({ element, files: source });
  let buildCount = 0;

  const first = await cache.getOrCreate(firstKey, async () => {
    buildCount += 1;
    return { identity: firstKey };
  });
  const second = await cache.getOrCreate(firstKey, async () => {
    buildCount += 1;
    return { identity: firstKey };
  });

  const changedKey = await createPreviewArtifactKey({
    element,
    files: [
      {
        ...source[0],
        content: "export function Hero() { return <div />; }",
      },
    ],
  });
  await cache.getOrCreate(changedKey, async () => {
    buildCount += 1;
    return { identity: changedKey };
  });

  assert.equal(first, second);
  assert.notEqual(changedKey, firstKey);
  assert.equal(buildCount, 2);
});

test("writes categorized Registry preview diagnostics", () => {
  const writes = [];

  const payload = logPreviewDiagnostic(
    {
      category: "asset",
      contentId: "hero-001",
      identity: `sha256-${"e".repeat(64)}`,
      message: "The preview does not support binary assets.",
      phase: "build",
      runtime: "react-vite-tailwind-4",
    },
    (message) => writes.push(message),
  );

  assert.equal(payload.event, "auren.preview");
  assert.equal(writes.length, 1);
  assert.match(writes[0], /"category":"asset"/);
});
