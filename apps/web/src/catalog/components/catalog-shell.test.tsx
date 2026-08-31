import { RouterContextProvider } from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { router } from "@/router";
import { CatalogShell } from "./catalog-shell.js";

describe("CatalogShell", () => {
  it("keeps only published sections in primary navigation", () => {
    const markup = renderToStaticMarkup(
      <RouterContextProvider router={router}>
        <CatalogShell>
          <p>Catalog content</p>
        </CatalogShell>
      </RouterContextProvider>,
    );

    expect(markup).toContain('aria-label="Catalog sections"');
    expect(markup).toContain('href="/blocks"');
    expect(markup).not.toContain('href="/components"');
    expect(markup).not.toContain('href="/pages"');
    expect(markup).not.toContain('href="/collections"');
  });
});
