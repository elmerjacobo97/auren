import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RemoteCatalogResponse,
  RemoteFetch,
} from "../../catalog/remote-catalog-source.js";
import { runCli } from "../../command/runner.js";
import type { PackageInstaller } from "./package-installer.js";
import { cleanupFixtures, createProject, element } from "./add-test-support.js";

afterEach(cleanupFixtures);

describe("auren add command — remote Registry", () => {
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

async function invokeRemote(
  projectDir: string,
  args: readonly string[],
  fetch: RemoteFetch,
  packageInstaller?: PackageInstaller,
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
  });

  return { status, stdout, stderr };
}
