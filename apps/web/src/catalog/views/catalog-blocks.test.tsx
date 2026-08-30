import { RouterContextProvider } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogClientError } from "../utils/catalog-errors.js";
import { CatalogContext } from "../providers/catalog-context.js";
import type { CatalogContextValue, CatalogState } from "../types/catalog.js";
import { createCatalogElement } from "../test/fixtures.js";
import { CatalogBlocks } from "./catalog-blocks.js";
import { router } from "@/router";

const block = createCatalogElement("hero-001", {
  name: "Product launch hero",
  description: "A responsive hero for a product launch.",
});

function renderWithState(state: CatalogState) {
  const context: CatalogContextValue = {
    state,
    retry: vi.fn(),
    loadBlockDetail: vi.fn(),
    retryBlockDetail: vi.fn(),
  };

  return renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <CatalogContext.Provider value={context}>
        <CatalogBlocks />
      </CatalogContext.Provider>
    </RouterContextProvider>,
  );
}

describe("CatalogBlocks", () => {
  it("renders a clear loading state without incomplete cards", () => {
    const markup = renderWithState({ status: "loading" });

    expect(markup).toContain("Reading the published catalog");
    expect(markup).not.toContain(block.id);
  });

  it("renders a valid empty index as an explicit empty state", () => {
    const markup = renderWithState({ status: "success", blocks: [] });

    expect(markup).toContain("No blocks published yet");
    expect(markup).not.toContain("Registry unavailable");
  });

  it("renders core metadata without source or installation payloads", () => {
    const markup = renderWithState({ status: "success", blocks: [block] });

    expect(markup).toContain(block.id);
    expect(markup).toContain(block.name);
    expect(markup).toContain(block.description);
    expect(markup).toContain(block.category);
    expect(markup).toContain(block.type);
    expect(markup).toContain("react");
    expect(markup).not.toContain("component.tsx");
    expect(markup).not.toContain("dependencies");
    expect(markup).toContain('href="/blocks/hero-001"');
    expect(markup).toContain("View Product launch hero (hero-001) details");
  });

  it("renders a retryable unavailable state without raw error details", () => {
    const markup = renderWithState({
      status: "error",
      error: new CatalogClientError("transport", "private transport details"),
    });

    expect(markup).toContain("Registry unavailable");
    expect(markup).toContain("Retry loading");
    expect(markup).not.toContain("private transport details");
  });
});
