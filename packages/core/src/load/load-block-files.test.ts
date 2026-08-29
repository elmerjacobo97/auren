import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MissingBlockFileError, loadBlockFiles } from "./load-block-files";

function createElement(changes: Partial<CatalogElement> = {}): CatalogElement {
  return {
    id: "hero-001",
    name: "Product launch hero",
    description: "A responsive hero section.",
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    dependencies: [],
    files: [{ path: "component.tsx", kind: "component" }],
    metadata: {},
    ...changes,
  };
}

describe("loadBlockFiles", () => {
  let fixtureRoot: string;

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), "auren-files-"));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it("uses inline content verbatim without requiring files on disk", async () => {
    const element = createElement({
      files: [
        {
          path: "utilities/inline.ts",
          kind: "utility",
          content: "export const inline = true;",
        },
        {
          path: "component.tsx",
          kind: "component",
          content: "export function Hero() { return null; }",
        },
      ],
    });

    const resolved = await loadBlockFiles(fixtureRoot, element);

    expect(resolved).toEqual([
      {
        path: "utilities/inline.ts",
        kind: "utility",
        target: undefined,
        content: "export const inline = true;",
      },
      {
        path: "component.tsx",
        kind: "component",
        target: undefined,
        content: "export function Hero() { return null; }",
      },
    ]);
  });

  it("reads descriptor files from the block directory and preserves target", async () => {
    const componentSource = "export function Hero() { return null; }\n";
    const styleSource = ".hero { display: grid; }\n";
    await mkdir(path.join(fixtureRoot, "styles"), { recursive: true });
    await writeFile(path.join(fixtureRoot, "component.tsx"), componentSource);
    await writeFile(path.join(fixtureRoot, "styles", "hero.css"), styleSource);

    const element = createElement({
      files: [
        { path: "component.tsx", kind: "component" },
        {
          path: "styles/hero.css",
          kind: "style",
          target: "src/components/hero.css",
        },
      ],
    });

    const resolved = await loadBlockFiles(fixtureRoot, element);

    expect(resolved).toEqual([
      {
        path: "component.tsx",
        kind: "component",
        target: undefined,
        content: componentSource,
      },
      {
        path: "styles/hero.css",
        kind: "style",
        target: "src/components/hero.css",
        content: styleSource,
      },
    ]);
  });

  it("rejects a descriptor whose disk file is missing", async () => {
    const element = createElement({
      files: [
        { path: "component.tsx", kind: "component" },
        { path: "utilities/missing.ts", kind: "utility" },
      ],
    });

    await writeFile(
      path.join(fixtureRoot, "component.tsx"),
      "export function Hero() { return null; }\n",
    );

    const error = await loadBlockFiles(fixtureRoot, element).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(MissingBlockFileError);
    expect(error).toMatchObject({
      missingPath: "utilities/missing.ts",
      name: "MissingBlockFileError",
    });
  });

  it("resolves one entry per descriptor when inline and disk files mix", async () => {
    const styleSource = ".hero { display: grid; }\n";
    await writeFile(path.join(fixtureRoot, "hero.css"), styleSource);

    const element = createElement({
      files: [
        {
          path: "component.tsx",
          kind: "component",
          content: "export function Hero() { return null; }",
        },
        { path: "hero.css", kind: "style" },
      ],
    });

    const resolved = await loadBlockFiles(fixtureRoot, element);

    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      path: "component.tsx",
      kind: "component",
      content: "export function Hero() { return null; }",
    });
    expect(resolved[1]).toMatchObject({
      path: "hero.css",
      kind: "style",
      content: styleSource,
    });
  });
});
