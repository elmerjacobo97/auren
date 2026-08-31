import { RouterContextProvider } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/router";
import { CatalogContext } from "../providers/catalog-context.js";
import { createCatalogElement } from "../test/fixtures.js";
import type { CatalogContextValue } from "../types/catalog.js";
import { CatalogOverview } from "./catalog-overview.js";

describe("CatalogOverview", () => {
  it("leads with published Blocks and separates future sections", () => {
    const context: CatalogContextValue = {
      state: { status: "success", blocks: [createCatalogElement("hero-001")] },
      retry: vi.fn(),
      loadBlockDetail: vi.fn(),
      retryBlockDetail: vi.fn(),
    };

    const markup = renderToStaticMarkup(
      <RouterContextProvider router={router}>
        <CatalogContext.Provider value={context}>
          <CatalogOverview />
        </CatalogContext.Provider>
      </RouterContextProvider>,
    );

    expect(markup).toContain("Browse Blocks");
    expect(markup).toContain("Published now");
    expect(markup).toContain("More ways to compose");
    expect(markup).toContain('href="/blocks"');
    expect(markup).not.toContain('href="/components"');
    expect(markup).not.toContain('href="/pages"');
    expect(markup).not.toContain('href="/collections"');
    expect(
      markup.match(/data-catalog-availability="coming-soon"/g),
    ).toHaveLength(3);
  });
});
