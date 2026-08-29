import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyBlocks } from "./verify-blocks.mjs";
import { expectedBlockCategories } from "./verify-workspace.mjs";

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

function baseManifest({ category, type, id, files }) {
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
    dependencies: [],
    files,
    metadata: {},
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
    omitComponent = false,
    omitRegistry = false,
    registryContents,
  } = {},
) {
  const blockRoot = path.join(blocksRoot, category, type, id);
  await mkdir(blockRoot, { recursive: true });

  for (const sourcePath of sourceFiles) {
    if (sourcePath === "component.tsx" && omitComponent) {
      continue;
    }

    const filePath = path.join(blockRoot, ...sourcePath.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      sourcePath.endsWith(".css")
        ? ".example-block { color: inherit; }\n"
        : sourcePath.endsWith(".webp")
          ? "asset fixture"
          : componentSource,
    );
  }

  if (!omitRegistry) {
    const manifest = {
      ...baseManifest({ category, type, id, files: descriptors }),
      ...manifestChanges,
    };
    await writeFile(
      path.join(blockRoot, "registry.json"),
      registryContents ?? `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  return blockRoot;
}

function assertErrors(result, ...patterns) {
  const message = result.errors.join("\n");

  for (const pattern of patterns) {
    assert.match(message, pattern, message);
  }
}

test("accepts empty category roots and reports a deterministic summary", async () => {
  await withFixture(async (blocksRoot) => {
    const result = verifyBlocks({ blocksRoot });

    assert.deepEqual(result.errors, []);
    assert.equal(result.categoryCount, 4);
    assert.equal(result.blockCount, 0);
  });
});

test("accepts a multi-file block with designated payload kinds", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      sourceFiles: [
        "component.tsx",
        "components/Badge.tsx",
        "utilities/format.ts",
        "styles/hero.css",
        "assets/product-preview.webp",
      ],
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "components/Badge.tsx", kind: "component" },
        { path: "utilities/format.ts", kind: "utility" },
        { path: "styles/hero.css", kind: "style" },
        { path: "assets/product-preview.webp", kind: "asset" },
      ],
    });

    const result = verifyBlocks({ blocksRoot });

    assert.deepEqual(result.errors, []);
    assert.equal(result.blockCount, 1);
  });
});

test("rejects unlisted categories and invalid type or id paths", async () => {
  await withFixture(async (blocksRoot) => {
    await mkdir(path.join(blocksRoot, "landing"), { recursive: true });
    await createBlock(blocksRoot, {
      type: "not_a_type",
      id: "not_a_type-000",
    });
    await createBlock(blocksRoot, {
      id: "hero-1000",
    });

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /landing: unlisted category directory/,
      /marketing\/not_a_type: type directory must use lowercase kebab-case/,
      /marketing\/not_a_type\/not_a_type-000: block id must match/,
      /marketing\/hero\/hero-1000: block id must match/,
      /schema issue at type/,
    );
  });
});

test("rejects globally duplicated ids and path-to-manifest identity drift", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, { category: "marketing" });
    await createBlock(blocksRoot, { category: "application-ui" });
    await createBlock(blocksRoot, {
      id: "hero-002",
      manifestChanges: {
        category: "ecommerce",
        type: "pricing",
        id: "pricing-002",
      },
    });

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /marketing\/hero\/hero-001: block id "hero-001" is duplicated/,
      /application-ui\/hero\/hero-001: block id "hero-001" is duplicated/,
      /marketing\/hero\/hero-002\/registry\.json: category must match path segment/,
      /marketing\/hero\/hero-002\/registry\.json: type must match path segment/,
      /marketing\/hero\/hero-002\/registry\.json: id must match path segment/,
    );
  });
});

test("reports malformed and schema-invalid manifests with actionable paths", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      registryContents: "{\n",
    });
    await createBlock(blocksRoot, {
      id: "hero-002",
      manifestChanges: { name: "" },
    });
    await createBlock(blocksRoot, {
      id: "hero-003",
      manifestChanges: { features: ["mobile-first"] },
    });

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /marketing\/hero\/hero-001\/registry\.json: invalid JSON/,
      /marketing\/hero\/hero-002\/registry\.json: schema issue at name:/,
      /marketing\/hero\/hero-003\/registry\.json: features must include "responsive"/,
    );
  });
});

test("rejects missing required files and nested package manifests", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      omitComponent: true,
    });
    await createBlock(blocksRoot, {
      id: "hero-002",
      omitRegistry: true,
    });
    const packageManifest = path.join(
      blocksRoot,
      "marketing",
      "hero",
      "hero-001",
      "components",
      "package.json",
    );
    await mkdir(path.dirname(packageManifest), { recursive: true });
    await writeFile(packageManifest, "{}\n");

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /marketing\/hero\/hero-001: required root file component\.tsx is missing/,
      /marketing\/hero\/hero-001\/components\/package\.json: blocks must not contain package manifests/,
      /marketing\/hero\/hero-002: required root file registry\.json is missing/,
    );
  });
});

test("rejects inconsistent, unsafe, and incomplete file descriptors", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      sourceFiles: ["component.tsx", "utilities/format.ts", "styles/hero.css"],
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "component.tsx", kind: "component" },
        { path: "../escape.tsx", kind: "component" },
        { path: "utilities/missing.ts", kind: "utility" },
        { path: "utilities/format.ts", kind: "component" },
        { path: "styles/hero.css", kind: "style", target: "src/hero.css" },
      ],
    });
    await createBlock(blocksRoot, {
      id: "hero-002",
      sourceFiles: ["component.tsx", "helper.ts"],
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "helper.ts", kind: "utility" },
      ],
    });
    await createBlock(blocksRoot, {
      id: "hero-003",
      descriptors: [
        { path: "component.tsx", kind: "component", content: componentSource },
      ],
    });
    await createBlock(blocksRoot, {
      id: "hero-004",
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "registry.json", kind: "component" },
      ],
    });
    await createBlock(blocksRoot, {
      id: "hero-005",
      sourceFiles: ["component.tsx", "utilities/unused.ts"],
      descriptors: [{ path: "component.tsx", kind: "component" }],
    });

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /hero-001\/registry\.json files\[1\]\.path: duplicate descriptor path "component\.tsx"/,
      /hero-001\/registry\.json files\[2\]\.path: .*not a safe relative POSIX path/,
      /hero-001\/registry\.json files\[3\]\.path: .*does not resolve to a regular payload file/,
      /hero-001\/registry\.json files\[4\]\.kind: .*must use kind "utility"/,
      /hero-001\/registry\.json files\[5\]\.target: source descriptors must omit "target"/,
      /hero-002\/helper\.ts: unexpected source file/,
      /hero-002\/registry\.json files\[1\]\.path: "helper\.ts" is outside the allowed source inventory/,
      /hero-003\/registry\.json files\[0\]\.content: source descriptors must omit "content"/,
      /hero-004\/registry\.json files\[1\]\.path: registry\.json is the source manifest/,
      /hero-005\/registry\.json: payload file "utilities\/unused\.ts" is not declared/,
    );
  });
});

test("rejects invalid asset filenames and asset directory segments", async () => {
  await withFixture(async (blocksRoot) => {
    await createBlock(blocksRoot, {
      id: "hero-001",
      sourceFiles: [
        "component.tsx",
        "assets/Not_Allowed.PNG",
        "assets/not_allowed/product-preview.webp",
      ],
      descriptors: [
        { path: "component.tsx", kind: "component" },
        { path: "assets/Not_Allowed.PNG", kind: "asset" },
        { path: "assets/not_allowed/product-preview.webp", kind: "asset" },
      ],
    });

    const result = verifyBlocks({ blocksRoot });

    assertErrors(
      result,
      /assets\/Not_Allowed\.PNG: asset filenames must use one lowercase kebab-case stem/,
      /assets\/not_allowed: asset directory segments must use lowercase kebab-case/,
    );
  });
});

test("does not require a committed block fixture in the real catalog", async () => {
  const marker = await readFile(
    path.join(process.cwd(), "blocks", "marketing", ".gitkeep"),
    "utf8",
  );

  assert.equal(marker, "");
  const result = verifyBlocks();

  assert.deepEqual(result.errors, []);
  assert.equal(result.blockCount, 0);
});
