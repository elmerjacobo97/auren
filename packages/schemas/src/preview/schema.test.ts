import { describe, expect, it } from "vitest";
import {
  createPreviewContentHash,
  createPreviewIdentity,
  previewArtifactManifestSchema,
  previewDescriptorSchema,
  evaluatePreviewExecutionPolicy,
  previewExecutionPolicy,
} from "@auren/schemas/preview";

const contentHash = `sha256-${"a".repeat(64)}`;
const identity = `sha256-${"b".repeat(64)}`;

function baseDescriptor(changes: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    contentType: "block",
    contentId: "hero-001",
    contentVersion: contentHash,
    framework: "react",
    runtime: "react-vite-tailwind-4",
    runtimeVersion: "1.0.0",
    delivery: "inline",
    identity,
    status: "ready",
    artifact: { kind: "inline", reference: "previews/hero-001/artifact.json" },
    ...changes,
  };
}

describe("previewDescriptorSchema", () => {
  it("accepts a ready inline descriptor", () => {
    expect(previewDescriptorSchema.parse(baseDescriptor())).toEqual(
      baseDescriptor(),
    );
  });

  it("requires the delivery-specific payload for ready descriptors", () => {
    expect(
      previewDescriptorSchema.safeParse(baseDescriptor({ artifact: undefined }))
        .success,
    ).toBe(false);
    expect(
      previewDescriptorSchema.safeParse(
        baseDescriptor({
          delivery: "external",
          artifact: undefined,
          livePreview: {
            url: "https://preview.example.test/",
            embedding: "denied",
          },
        }),
      ).success,
    ).toBe(true);
  });

  it("requires a categorized failure for unsupported descriptors", () => {
    expect(
      previewDescriptorSchema.safeParse(
        baseDescriptor({ status: "unsupported", artifact: undefined }),
      ).success,
    ).toBe(false);
    expect(
      previewDescriptorSchema.safeParse(
        baseDescriptor({
          status: "unsupported",
          artifact: undefined,
          failure: { category: "unsupported" },
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects credential-bearing external preview URLs", () => {
    expect(
      previewDescriptorSchema.safeParse(
        baseDescriptor({
          delivery: "external",
          artifact: undefined,
          livePreview: {
            url: "https://user:secret@preview.example.test/",
            embedding: "unknown",
          },
        }),
      ).success,
    ).toBe(false);
  });
});

describe("preview identity helpers", () => {
  it("is stable for reordered identity inputs and changes with source", async () => {
    const first = await createPreviewIdentity({
      contentHash,
      runtime: "react-vite-tailwind-4",
      runtimeVersion: "1.0.0",
      dependencies: { react: "19.2.8", vite: "8.2.2" },
      buildConfiguration: { entry: "/index.tsx", css: { processor: "v4" } },
    });
    const reordered = await createPreviewIdentity({
      contentHash,
      runtime: "react-vite-tailwind-4",
      runtimeVersion: "1.0.0",
      dependencies: { vite: "8.2.2", react: "19.2.8" },
      buildConfiguration: { css: { processor: "v4" }, entry: "/index.tsx" },
    });
    const changed = await createPreviewIdentity({
      contentHash: await createPreviewContentHash("changed"),
      runtime: "react-vite-tailwind-4",
      runtimeVersion: "1.0.0",
      dependencies: { react: "19.2.8", vite: "8.2.2" },
      buildConfiguration: { entry: "/index.tsx", css: { processor: "v4" } },
    });

    expect(first).toMatch(/^sha256-[0-9a-f]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });

  it.each([
    ["dependencies", { dependencies: { react: "19.2.8", vite: "8.2.3" } }],
    ["runtime", { runtime: "react-vite-tailwind-5" }],
    ["runtime version", { runtimeVersion: "1.0.1" }],
    [
      "build configuration",
      { buildConfiguration: { entry: "/main.tsx", css: { processor: "v4" } } },
    ],
  ] as const)("changes when %s changes", async (_label, changes) => {
    const base = {
      contentHash,
      runtime: "react-vite-tailwind-4",
      runtimeVersion: "1.0.0",
      dependencies: { react: "19.2.8", vite: "8.2.2" },
      buildConfiguration: { entry: "/index.tsx", css: { processor: "v4" } },
    };

    const first = await createPreviewIdentity(base);
    const changed = await createPreviewIdentity({ ...base, ...changes });

    expect(changed).not.toBe(first);
  });
});

describe("preview execution policy", () => {
  it("accepts the pinned dependency allowlist and bounded source", () => {
    expect(
      evaluatePreviewExecutionPolicy({
        fileCount: 1,
        fileSizes: [previewExecutionPolicy.maxFileBytes],
        dependencyRoots: [...previewExecutionPolicy.allowedDependencyRoots],
      }),
    ).toBeNull();
    expect(previewExecutionPolicy.contentSecurityPolicy).toContain(
      "default-src 'none'",
    );
  });

  it.each([
    ["too many files", previewExecutionPolicy.maxFiles + 1, [0], []],
    ["too large file", 1, [previewExecutionPolicy.maxFileBytes + 1], []],
    ["too much source", 2, [previewExecutionPolicy.maxTotalBytes, 1], []],
  ] as const)("rejects %s", (_label, fileCount, fileSizes, dependencyRoots) => {
    expect(
      evaluatePreviewExecutionPolicy({ fileCount, fileSizes, dependencyRoots }),
    ).toBe("resource-limit");
  });

  it("rejects an undeclared runtime dependency", () => {
    expect(
      evaluatePreviewExecutionPolicy({
        fileCount: 1,
        fileSizes: [0],
        dependencyRoots: ["unknown-package"],
      }),
    ).toBe("disallowed-dependency");
  });
});

describe("previewArtifactManifestSchema", () => {
  it("accepts the immutable client artifact shape", () => {
    const manifest = {
      schemaVersion: 1,
      contentId: "hero-001",
      identity,
      runtime: "react-vite-tailwind-4",
      runtimeVersion: "1.0.0",
      entry: "/index.tsx",
      input: { kind: "empty" },
      files: [
        { path: "/index.tsx", content: "export default function Preview() {}" },
      ],
      dependencies: { react: "19.2.8" },
      buildConfiguration: {
        cssProcessor: "tailwindcss-browser",
        entry: "/index.tsx",
        input: "empty",
        policyVersion: 1,
        contentSecurityPolicy: previewExecutionPolicy.contentSecurityPolicy,
        stylesheet: "/styles.css",
        template: "vite-react-ts",
      },
    };

    expect(previewArtifactManifestSchema.parse(manifest)).toEqual(manifest);
  });
});
