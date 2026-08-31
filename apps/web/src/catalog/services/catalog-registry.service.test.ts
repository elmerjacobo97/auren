import { describe, expect, it, vi } from "vitest";
import { CatalogClientError } from "../utils/catalog-errors.js";
import type { CatalogFetch } from "../types/catalog.js";
import {
  DEFAULT_REGISTRY_URL,
  normalizeRegistryDocumentRoot,
  resolveRegistryDetailUrl,
  resolveRegistryDocumentRoot,
  resolveRegistryIndexUrl,
} from "../utils/catalog-url.js";
import {
  CatalogRegistryService,
  type CatalogRegistryServiceOptions,
} from "./catalog-registry.service.js";
import {
  createCatalogElement,
  createDetailElement,
  createIndex,
} from "../test/fixtures.js";

function createJsonResponse(
  payload: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function createService(response: Response): {
  readonly service: CatalogRegistryService;
  readonly fetchImplementation: CatalogFetch;
} {
  const fetchImplementation = vi.fn(
    async () => response,
  ) as unknown as CatalogFetch;
  const options: CatalogRegistryServiceOptions = { fetchImplementation };

  return {
    service: new CatalogRegistryService(options),
    fetchImplementation,
  };
}

describe("catalog Registry URL", () => {
  it("uses the production root and resolves registry.json", () => {
    expect(resolveRegistryDocumentRoot()).toBe(DEFAULT_REGISTRY_URL);
    expect(resolveRegistryIndexUrl(DEFAULT_REGISTRY_URL)).toBe(
      "https://registry.auren.elmerjacobo.dev/registry.json",
    );
  });

  it("normalizes custom document roots", () => {
    expect(
      normalizeRegistryDocumentRoot("http://localhost:4173/catalog///"),
    ).toBe("http://localhost:4173/catalog/");
    expect(resolveRegistryIndexUrl("https://registry.example.test/auren")).toBe(
      "https://registry.example.test/auren/registry.json",
    );
    expect(
      resolveRegistryDetailUrl(
        "hero 001",
        "https://registry.example.test/auren/",
      ),
    ).toBe("https://registry.example.test/auren/blocks/hero%20001.json");
  });
});

describe("CatalogRegistryService", () => {
  it("performs one injectable GET for the metadata index", async () => {
    const { service, fetchImplementation } = createService(
      createJsonResponse(createIndex([])),
    );

    await expect(
      service.loadIndex({ registryUrl: "https://registry.example.test/" }),
    ).resolves.toEqual([]);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://registry.example.test/registry.json",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it.each([
    "",
    " https://registry.example.test/ ",
    "not-a-url",
    "ftp://registry.example.test/",
    "https://user:password@registry.example.test/",
    "https://registry.example.test/?token=secret",
    "https://registry.example.test/#catalog",
  ])("rejects invalid endpoint %j before a request", async (registryUrl) => {
    const { service, fetchImplementation } = createService(
      createJsonResponse(createIndex([])),
    );

    await expect(service.loadIndex({ registryUrl })).rejects.toMatchObject({
      code: "invalid-endpoint",
    });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("rejects HTTP, non-JSON, and malformed JSON responses", async () => {
    const http = createService(
      new Response("unavailable", {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "content-type": "text/plain" },
      }),
    ).service;
    const html = createService(
      new Response("<html>private response</html>", {
        headers: { "content-type": "text/html" },
      }),
    ).service;
    const malformed = createService(
      new Response("{not-json", {
        headers: { "content-type": "application/json" },
      }),
    ).service;

    await expect(http.loadIndex()).rejects.toMatchObject({
      code: "http",
      message: "The Registry index request failed with HTTP 503.",
    });
    await expect(html.loadIndex()).rejects.toMatchObject({
      code: "content-type",
      message: "The Registry index response was not JSON.",
    });
    await expect(malformed.loadIndex()).rejects.toMatchObject({
      code: "malformed-json",
      message: "The Registry index response was malformed JSON.",
    });
  });

  it("loads a validated detail with the configured encoded URL and JSON headers", async () => {
    const indexedElement = createCatalogElement("hero-001");
    const detail = createDetailElement("hero-001");
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValue(createJsonResponse(detail));
    const service = new CatalogRegistryService({ fetchImplementation });
    const signal = new AbortController().signal;

    await expect(
      service.loadDetail({
        registryUrl: "https://registry.example.test/auren/",
        id: "hero-001",
        indexedElement,
        signal,
      }),
    ).resolves.toEqual(detail);

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://registry.example.test/auren/blocks/hero-001.json",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal,
      },
    );
  });

  it("rejects invalid detail endpoints before making a detail request", async () => {
    const { service, fetchImplementation } = createService(
      createJsonResponse(createDetailElement("hero-001")),
    );
    const indexedElement = createCatalogElement("hero-001");

    await expect(
      service.loadDetail({
        registryUrl: "https://registry.example.test/?private=secret",
        id: "hero-001",
        indexedElement,
      }),
    ).rejects.toMatchObject({ code: "invalid-endpoint" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("sanitizes detail HTTP, content-type, malformed JSON, and transport failures", async () => {
    const indexedElement = createCatalogElement("hero-001");
    const http = createService(
      new Response("private response", { status: 404 }),
    ).service;
    const html = createService(
      new Response("<html>private response</html>", {
        headers: { "content-type": "text/html" },
      }),
    ).service;
    const malformed = createService(
      new Response("{not-json", {
        headers: { "content-type": "application/json" },
      }),
    ).service;
    const transportFetch = vi
      .fn<CatalogFetch>()
      .mockRejectedValue(new Error("private transport details\nwith a stack"));
    const transport = new CatalogRegistryService({
      fetchImplementation: transportFetch,
    });

    const request = { id: "hero-001", indexedElement };

    await expect(http.loadDetail(request)).rejects.toMatchObject({
      code: "detail-http",
      message: "The selected Registry detail request failed with HTTP 404.",
    });
    await expect(html.loadDetail(request)).rejects.toMatchObject({
      code: "detail-content-type",
      message: "The selected Registry detail response was not JSON.",
    });
    await expect(malformed.loadDetail(request)).rejects.toMatchObject({
      code: "detail-malformed-json",
      message: "The selected Registry detail response was malformed JSON.",
    });
    await expect(transport.loadDetail(request)).rejects.toMatchObject({
      code: "detail-transport",
      message: "The selected Registry detail request could not be completed.",
    });
    expect(transportFetch).toHaveBeenCalledTimes(1);
  });

  it("sanitizes transport failures and never requests block details", async () => {
    const fetchImplementation = vi
      .fn()
      .mockRejectedValue(
        new Error("private network details\nwith a stack"),
      ) as unknown as CatalogFetch;
    const service = new CatalogRegistryService({ fetchImplementation });

    let error: unknown;

    try {
      await service.loadIndex();
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(CatalogClientError);

    if (!(error instanceof Error)) {
      throw new Error("Expected a CatalogClientError");
    }

    expect(error.message).toBe(
      "The Registry index request could not be completed.",
    );
    expect(error.message).not.toContain("private network details");

    const success = createService(
      createJsonResponse(createIndex([createCatalogElement("hero-001")])),
    );
    await success.service.loadIndex({
      registryUrl: "https://registry.example.test/",
    });

    const requestedUrls = (
      success.fetchImplementation as ReturnType<typeof vi.fn>
    ).mock.calls.map(([input]) => String(input));
    expect(requestedUrls).toEqual([
      "https://registry.example.test/registry.json",
    ]);
    expect(requestedUrls.some((url) => url.includes("/blocks/"))).toBe(false);
  });
});
