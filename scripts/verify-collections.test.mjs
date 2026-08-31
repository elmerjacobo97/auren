import { strict as assert } from "node:assert";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyCollections } from "./verify-collections.mjs";

const block = {
  id: "hero-001",
  frameworks: ["react"],
};
const secondBlock = {
  id: "footer-001",
  frameworks: ["react"],
};

async function withFixture(callback) {
  const root = await mkdtemp(path.join(tmpdir(), "auren-collections-"));

  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function collection(overrides = {}) {
  return {
    id: "saas-minimal",
    name: "SaaS Minimal",
    description: "A minimal SaaS collection.",
    category: "marketing",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    blocks: ["hero-001", "footer-001"],
    metadata: {},
    ...overrides,
  };
}

async function writeCollection(root, category, id, payload, extraFiles = {}) {
  const collectionRoot = path.join(root, category, id);
  await mkdir(collectionRoot, { recursive: true });
  await writeFile(
    path.join(collectionRoot, "registry.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );

  for (const [relativePath, content] of Object.entries(extraFiles)) {
    await writeFile(path.join(collectionRoot, relativePath), content);
  }

  return collectionRoot;
}

async function snapshotTree(root) {
  const entries = [];

  async function visit(directory) {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = path.join(directory, entry.name);
      const relative = path.relative(root, entryPath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        entries.push([relative, "<directory>"]);
        await visit(entryPath);
      } else {
        entries.push([relative, await readFile(entryPath, "utf8")]);
      }
    }
  }

  await visit(root);
  return entries;
}

test("accepts a valid Collection and preserves authored member order", async () => {
  await withFixture(async (root) => {
    await writeCollection(root, "marketing", "saas-minimal", collection());
    const before = await snapshotTree(root);

    const result = verifyCollections({
      collectionsRoot: root,
      blocks: [block, secondBlock],
      includeInventory: true,
    });

    assert.deepEqual(result.errors, []);
    assert.equal(result.collectionCount, 1);
    assert.deepEqual(result.collections[0].collection.blocks, [
      "hero-001",
      "footer-001",
    ]);
    assert.deepEqual(await snapshotTree(root), before);
  });
});

test("rejects malformed metadata and unexpected nested files", async () => {
  await withFixture(async (root) => {
    await writeCollection(
      root,
      "marketing",
      "saas-minimal",
      collection({ name: "" }),
      { "nested.txt": "unexpected\n" },
    );

    const result = verifyCollections({
      collectionsRoot: root,
      blocks: [block, secondBlock],
    });

    assert.match(result.errors.join("\n"), /schema issue/);
    assert.match(
      result.errors.join("\n"),
      /collection directories may contain only registry.json/,
    );
  });
});

test("rejects path identity drift and duplicate Collection IDs", async () => {
  await withFixture(async (root) => {
    await writeCollection(root, "marketing", "saas-minimal", collection());
    await writeCollection(
      root,
      "application-ui",
      "other-collection",
      collection({ id: "saas-minimal", category: "application-ui" }),
    );

    const result = verifyCollections({
      collectionsRoot: root,
      blocks: [block, secondBlock],
    });
    const message = result.errors.join("\n");

    assert.match(message, /duplicate collection id "saas-minimal"/);
    assert.doesNotMatch(message, /category must match path segment/);
  });
});

test("rejects missing members and framework mismatches", async () => {
  await withFixture(async (root) => {
    await writeCollection(
      root,
      "marketing",
      "saas-minimal",
      collection({
        blocks: ["hero-001", "missing-001"],
        frameworks: ["react"],
      }),
    );

    const missing = verifyCollections({
      collectionsRoot: root,
      blocks: [block],
    });
    assert.match(
      missing.errors.join("\n"),
      /references missing block "missing-001"/,
    );

    await writeCollection(
      root,
      "marketing",
      "saas-minimal",
      collection({ frameworks: ["react"], blocks: ["hero-001"] }),
    );
    const mismatch = verifyCollections({
      collectionsRoot: root,
      blocks: [{ id: "hero-001", frameworks: ["vue"] }],
    });
    assert.match(
      mismatch.errors.join("\n"),
      /framework "react" is unsupported by member block "hero-001"/,
    );
  });
});
