import {
  blockTypeValues,
  categoryValues,
  featureValues,
  frameworkValues,
  industryValues,
  styleValues,
} from "@auren/schemas/taxonomy";
import { RouterContextProvider } from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { router } from "@/router";
import {
  type CatalogFilterState,
  emptyCatalogFilterState,
  parseCatalogFilterSearch,
} from "../filters/catalog-filters.js";
import { CatalogContext } from "../providers/catalog-context.js";
import { createCatalogElement } from "../test/fixtures.js";
import type { CatalogContextValue, CatalogState } from "../types/catalog.js";
import { CatalogClientError } from "../utils/catalog-errors.js";
import { CatalogBlocks } from "./catalog-blocks.js";

const block = createCatalogElement("hero-001", {
  name: "Product launch hero",
  description: "A responsive hero for a product launch.",
  features: ["dark-mode", "responsive", "two-cta"],
});
const pricingBlock = createCatalogElement("pricing-002", {
  name: "Fintech pricing",
  type: "pricing",
  styles: ["corporate"],
  industries: ["fintech"],
  features: ["mobile-first", "responsive"],
});
const sidebarBlock = createCatalogElement("sidebar-003", {
  name: "Developer sidebar",
  category: "application-ui",
  type: "sidebar",
  styles: ["developer"],
  industries: ["developer-tools"],
  features: ["responsive", "sidebar", "search"],
});
const indexedBlocks = [block, pricingBlock, sidebarBlock];

function createFilterState(
  changes: Partial<CatalogFilterState>,
): CatalogFilterState {
  return { ...emptyCatalogFilterState, ...changes };
}

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

interface InteractiveRenderOptions {
  readonly filters?: CatalogFilterState;
  readonly onFiltersChange?: (value: CatalogFilterState) => void;
  readonly onClearFilters?: () => void;
}

function renderInteractiveWithState(
  state: CatalogState,
  options: InteractiveRenderOptions = {},
) {
  const context: CatalogContextValue = {
    state,
    retry: vi.fn(),
    loadBlockDetail: vi.fn(),
    retryBlockDetail: vi.fn(),
  };
  const filters = options.filters ?? emptyCatalogFilterState;
  const onFiltersChange = options.onFiltersChange ?? vi.fn();
  const onClearFilters = options.onClearFilters ?? vi.fn();

  render(
    <RouterContextProvider router={router}>
      <CatalogContext.Provider value={context}>
        <CatalogBlocks
          filters={filters}
          onClearFilters={onClearFilters}
          onFiltersChange={onFiltersChange}
        />
      </CatalogContext.Provider>
    </RouterContextProvider>,
  );

  return { onClearFilters, onFiltersChange };
}

afterEach(() => {
  cleanup();
});

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

  it("exposes every official taxonomy filter with associated controls", () => {
    renderInteractiveWithState({
      status: "success",
      blocks: indexedBlocks,
    });

    const selectValues = (label: string) =>
      Array.from(
        (screen.getByLabelText(label) as HTMLSelectElement).options,
      ).map((option) => option.value);

    expect(selectValues("Category")).toEqual(["", ...categoryValues]);
    expect(selectValues("Type")).toEqual(["", ...blockTypeValues]);
    expect(selectValues("Style")).toEqual(["", ...styleValues]);
    expect(selectValues("Industry")).toEqual(["", ...industryValues]);
    expect(selectValues("Framework")).toEqual(["", ...frameworkValues]);
    expect(
      within(screen.getByRole("group", { name: "Features" })).getAllByRole(
        "checkbox",
      ),
    ).toHaveLength(featureValues.length);
    expect(screen.getByRole("form", { name: "Filter blocks" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Clear all filters" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("restores normalized URL selections in the controls and results", () => {
    const filters = parseCatalogFilterSearch({
      category: "marketing",
      type: "hero",
      style: "minimal",
      industry: "saas",
      features: "responsive,dark-mode",
      framework: "react",
    });

    renderInteractiveWithState(
      { status: "success", blocks: indexedBlocks },
      { filters },
    );

    expect((screen.getByLabelText("Category") as HTMLSelectElement).value).toBe(
      "marketing",
    );
    expect((screen.getByLabelText("Type") as HTMLSelectElement).value).toBe(
      "hero",
    );
    expect(
      (screen.getByLabelText("Dark Mode") as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText("Responsive") as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.getByText("Showing 1 of 3 blocks")).toBeTruthy();
    expect(screen.getByText(/Active filters:/)).toBeTruthy();
  });

  it("changes filters through the callback and clears active state", () => {
    const onFiltersChange = vi.fn();
    const { onClearFilters } = renderInteractiveWithState(
      { status: "success", blocks: indexedBlocks },
      { onFiltersChange },
    );

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "application-ui" },
    });
    expect(onFiltersChange).toHaveBeenCalledWith({
      category: "application-ui",
      features: [],
    });

    cleanup();
    const activeClear = vi.fn();
    renderInteractiveWithState(
      { status: "success", blocks: indexedBlocks },
      {
        filters: createFilterState({ category: "marketing" }),
        onClearFilters: activeClear,
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(activeClear).toHaveBeenCalledOnce();
    expect(onClearFilters).not.toHaveBeenCalled();
  });

  it("applies combined filters, feature AND semantics, and stable order", () => {
    renderInteractiveWithState(
      { status: "success", blocks: indexedBlocks },
      {
        filters: createFilterState({
          category: "marketing",
          features: ["dark-mode", "responsive"],
        }),
      },
    );

    expect(
      screen
        .getAllByRole("link", { name: /details$/ })
        .map((link) => link.textContent),
    ).toEqual(["Product launch hero"]);

    cleanup();
    renderInteractiveWithState(
      { status: "success", blocks: indexedBlocks },
      { filters: createFilterState({ features: ["responsive"] }) },
    );
    expect(
      screen
        .getAllByRole("link", { name: /details$/ })
        .map((link) => link.textContent),
    ).toEqual(["Product launch hero", "Fintech pricing", "Developer sidebar"]);
  });

  it("distinguishes a filtered no-match state and offers recovery", () => {
    const onClearFilters = vi.fn();
    renderInteractiveWithState(
      { status: "success", blocks: [block] },
      {
        filters: createFilterState({ category: "application-ui" }),
        onClearFilters,
      },
    );

    expect(
      screen.getByRole("heading", { name: "No blocks match these filters" }),
    ).toBeTruthy();
    expect(screen.getByText("Showing 0 of 1 blocks")).toBeTruthy();
    expect(screen.getAllByText(/Active filters: Category:/)).toHaveLength(2);
    const clearButtons = screen.getAllByRole("button", {
      name: "Clear all filters",
    });
    expect(clearButtons).toHaveLength(2);
    const noMatchClearButton = clearButtons[1];
    if (noMatchClearButton === undefined) {
      throw new Error("The no-match reset button is missing");
    }
    fireEvent.click(noMatchClearButton);
    expect(onClearFilters).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: /details$/ })).toBeNull();
  });

  it("keeps filter focus and result layout usable at narrow widths", () => {
    const markup = renderWithState({
      status: "success",
      blocks: indexedBlocks,
    });

    expect(markup).toContain('aria-label="Catalog results"');
    expect(markup).toContain("grid min-w-0");
    expect(markup).toContain("focus-visible:outline-2");
    expect(markup).not.toContain("overflow-x-auto");
  });
});
