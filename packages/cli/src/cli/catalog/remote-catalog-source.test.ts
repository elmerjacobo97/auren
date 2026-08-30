import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  RemoteCatalogResponse,
  RemoteFetch,
} from "./remote-catalog-source.js";
import {
  DEFAULT_REGISTRY_URL,
  InvalidRegistryUrlError,
  RemoteCatalogContentTypeError,
  RemoteCatalogHttpError,
  RemoteCatalogPayloadError,
  RemoteCatalogRequestError,
  createRemoteCatalogSource,
  resolveRegistryUrl,
} from "./remote-catalog-source.js";
import type { CatalogElement } from "@auren/schemas/catalog";

const indexElement: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["mobile-first", "responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [
    { path: "component.tsx", kind: "component" },
    { path: "assets/preview.webp", kind: "asset" },
  ],
  metadata: { author: "Auren", viewport: { minWidth: 320 } },
};

const detailElement: CatalogElement = {
  ...indexElement,
  files: [
    {
      path: "component.tsx",
      kind: "component",
      content: "export function Hero() { return null; }\n",
    },
    {
      path: "assets/preview.webp",
      kind: "asset",
      content: Buffer.from("preview").toString("base64"),
    },
  ],
};

const fixtureResponses: RemoteCatalogResponse[] = [];

afterEach(() => {
  fixtureResponses.splice(0);
});

function jsonResponse(
  value: unknown,
  options: { readonly status?: number; readonly contentType?: string } = {},
): RemoteCatalogResponse {
  const response = new Response(JSON.stringify(value), {
    status: options.status ?? 200,
    headers: {
      "content-type": options.contentType ?? "application/json; charset=utf-8",
    },
  });
  fixtureResponses.push(response);
  return response;
}

function createFetch(
  handler: (
    url: string,
    init: { readonly method?: string; readonly signal?: AbortSignal },
  ) => Promise<RemoteCatalogResponse>,
): { fetch: RemoteFetch; calls: string[]; spy: ReturnType<typeof vi.fn> } {
  const calls: string[] = [];
  const spy = vi.fn(
    async (
      input: string | URL,
      init: { readonly method?: string; readonly signal?: AbortSignal },
    ) => {
      const url = String(input);
      calls.push(url);
      return handler(url, init);
    },
  );

  return { fetch: spy as RemoteFetch, calls, spy };
}

function indexEnvelope(...blocks: readonly unknown[]) {
  return { schemaVersion: 1, blocks };
}

describe("createRemoteCatalogSource endpoint selection", () => {
  it("uses the production default and command-compatible document roots", async () => {
    const defaultEndpoint = resolveRegistryUrl(undefined, {});
    expect(defaultEndpoint).toBe(`${DEFAULT_REGISTRY_URL}/`);

    const customEndpoint = "https://registry.example.test/auren";
    const { fetch, calls } = createFetch(async (url) => {
      expect(url).toBe(`${customEndpoint}/registry.json`);
      return jsonResponse(indexEnvelope(indexElement));
    });
    const source = createRemoteCatalogSource({
      registryUrl: customEndpoint,
      fetch,
    });

    await expect(source.getById("hero-001")).resolves.toEqual(indexElement);
    expect(calls).toEqual([`${customEndpoint}/registry.json`]);
  });

  it("rejects unsafe endpoint URLs before invoking transport", () => {
    const fetch = vi.fn() as unknown as RemoteFetch;

    for (const registryUrl of [
      "file:///tmp/registry",
      "https://user:secret@example.test/",
      "https://example.test/?tenant=one",
      "https://example.test/#fragment",
      "not a URL",
      " https://example.test/",
    ]) {
      expect(() => createRemoteCatalogSource({ registryUrl, fetch })).toThrow(
        InvalidRegistryUrlError,
      );
    }

    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses command endpoint values before the environment override", async () => {
    const { fetch, calls } = createFetch(async (url) => {
      expect(url).toBe("https://command.example.test/registry.json");
      return jsonResponse(indexEnvelope(indexElement));
    });
    const source = createRemoteCatalogSource({
      registryUrl: "https://command.example.test",
      env: { AUREN_REGISTRY_URL: "https://environment.example.test" },
      fetch,
    });

    await source.list();

    expect(calls).toEqual(["https://command.example.test/registry.json"]);
  });
});

describe("remote Registry index loading", () => {
  it("validates and sorts metadata once without downloading details", async () => {
    const second = { ...indexElement, id: "navbar-001", type: "navbar" };
    const { fetch, calls, spy } = createFetch(async (url, init) => {
      expect(init.method).toBe("GET");
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(url).toBe("https://registry.example.test/registry.json");
      return jsonResponse(indexEnvelope(second, indexElement));
    });
    const source = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test/",
      fetch,
    });

    await expect(source.list()).resolves.toEqual([indexElement, second]);
    await expect(source.getById("hero-001")).resolves.toEqual(indexElement);

    expect(calls).toEqual(["https://registry.example.test/registry.json"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate IDs and forbidden index installation fields", async () => {
    const duplicate = { ...indexElement };
    const { fetch: duplicateFetch } = createFetch(async () =>
      jsonResponse(indexEnvelope(indexElement, duplicate)),
    );
    const duplicateSource = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch: duplicateFetch,
    });

    await expect(duplicateSource.list()).rejects.toMatchObject({
      name: "RemoteCatalogPayloadError",
      message: expect.stringContaining("duplicate catalog element ID"),
    });

    const contentIndex = {
      ...indexElement,
      files: [{ path: "component.tsx", kind: "component", content: "x" }],
    };
    const { fetch: contentFetch } = createFetch(async () =>
      jsonResponse(indexEnvelope(contentIndex)),
    );
    const contentSource = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch: contentFetch,
    });

    await expect(contentSource.list()).rejects.toMatchObject({
      name: "RemoteCatalogPayloadError",
      message: expect.stringContaining("forbidden file content"),
    });
  });

  it("rejects malformed envelopes and schema-invalid entries without partial results", async () => {
    const { fetch, calls } = createFetch(async () =>
      jsonResponse({ schemaVersion: 2, blocks: [indexElement] }),
    );
    const source = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch,
    });

    await expect(source.list()).rejects.toBeInstanceOf(
      RemoteCatalogPayloadError,
    );
    expect(calls).toHaveLength(1);

    const { fetch: invalidFetch } = createFetch(async () =>
      jsonResponse(indexEnvelope({ ...indexElement, category: "unknown" })),
    );
    const invalidSource = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch: invalidFetch,
    });

    await expect(invalidSource.list()).rejects.toThrow(
      /failed @auren\/schemas\/catalog validation/,
    );
  });
});

describe("remote Registry detail loading", () => {
  it("loads matching text and asset content lazily and memoizes the detail", async () => {
    const { fetch, calls } = createFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return jsonResponse(indexEnvelope(indexElement));
      }

      expect(url).toBe("https://registry.example.test/blocks/hero-001.json");
      return jsonResponse(detailElement);
    });
    const source = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch,
    });
    const record = await source.getInstallableById("hero-001");

    expect(record).toBeDefined();
    expect(calls).toEqual(["https://registry.example.test/registry.json"]);

    const first = await record?.loadFiles();
    const second = await record?.loadFiles();

    expect(first).toEqual(second);
    expect(first?.[0]?.content).toBe(detailElement.files[0]?.content);
    expect(first?.[1]?.content).toBe(detailElement.files[1]?.content);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
  });

  it.each([
    ["ID mismatch", { ...detailElement, id: "navbar-001" }, /ID is/],
    [
      "metadata drift",
      { ...detailElement, name: "Different hero" },
      /field "name" differs/,
    ],
    [
      "missing content",
      {
        ...detailElement,
        files: [{ path: "component.tsx", kind: "component" }],
      },
      /missing inline content/,
    ],
    [
      "installation target",
      {
        ...detailElement,
        files: [
          {
            path: "component.tsx",
            kind: "component",
            content: "x",
            target: "src/unsafe.tsx",
          },
          detailElement.files[1],
        ],
      },
      /forbidden installation target/,
    ],
  ] as const)(
    "rejects detail %s before exposing files",
    async (_, detail, message) => {
      const { fetch } = createFetch(async (url) =>
        jsonResponse(
          url.endsWith("/registry.json") ? indexEnvelope(indexElement) : detail,
        ),
      );
      const source = createRemoteCatalogSource({
        registryUrl: "https://registry.example.test",
        fetch,
      });
      const record = await source.getInstallableById("hero-001");

      await expect(record?.loadFiles()).rejects.toMatchObject({
        name: expect.stringMatching(/RemoteCatalog/),
        message: expect.stringMatching(message),
      });
    },
  );

  it("clears failed detail requests so a later retry can succeed", async () => {
    let detailAttempt = 0;
    const { fetch, calls } = createFetch(async (url) => {
      if (url.endsWith("/registry.json")) {
        return jsonResponse(indexEnvelope(indexElement));
      }

      detailAttempt += 1;
      if (detailAttempt === 1) {
        return jsonResponse({ error: "temporary" }, { status: 503 });
      }

      return jsonResponse(detailElement);
    });
    const source = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch,
    });
    const record = await source.getInstallableById("hero-001");

    await expect(record?.loadFiles()).rejects.toBeInstanceOf(
      RemoteCatalogHttpError,
    );
    await expect(record?.loadFiles()).resolves.toHaveLength(2);
    expect(calls).toEqual([
      "https://registry.example.test/registry.json",
      "https://registry.example.test/blocks/hero-001.json",
      "https://registry.example.test/blocks/hero-001.json",
    ]);
  });
});

describe("remote Registry transport failures", () => {
  it("rejects HTTP, content-type, malformed JSON, and network failures without response bodies", async () => {
    const cases = [
      {
        response: jsonResponse("secret body", { status: 404 }),
        error: RemoteCatalogHttpError,
      },
      {
        response: jsonResponse("<html>secret</html>", {
          contentType: "text/html",
        }),
        error: RemoteCatalogContentTypeError,
      },
    ] as const;

    for (const { response, error } of cases) {
      const { fetch } = createFetch(async () => response);
      const source = createRemoteCatalogSource({
        registryUrl: "https://registry.example.test",
        fetch,
      });

      await expect(source.list()).rejects.toBeInstanceOf(error);
      await expect(source.list()).rejects.toBeInstanceOf(error);
    }

    const { fetch: malformedFetch } = createFetch(async () => {
      const response = new Response("{", {
        headers: { "content-type": "application/json" },
      });
      return response;
    });
    const malformedSource = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch: malformedFetch,
    });
    await expect(malformedSource.list()).rejects.toBeInstanceOf(
      RemoteCatalogPayloadError,
    );

    const { fetch: networkFetch } = createFetch(async () => {
      throw new Error("socket failed");
    });
    const networkSource = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch: networkFetch,
    });
    await expect(networkSource.list()).rejects.toMatchObject({
      name: "RemoteCatalogRequestError",
      message: expect.not.stringContaining("secret"),
    });
  });

  it("aborts a request after the configured bounded timeout", async () => {
    const fetch = vi.fn(
      async (
        _url: string | URL,
        init: { readonly signal?: AbortSignal },
      ): Promise<RemoteCatalogResponse> =>
        await new Promise<RemoteCatalogResponse>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    ) as unknown as RemoteFetch;
    const source = createRemoteCatalogSource({
      registryUrl: "https://registry.example.test",
      fetch,
      timeoutMs: 5,
    });

    await expect(source.list()).rejects.toBeInstanceOf(
      RemoteCatalogRequestError,
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
