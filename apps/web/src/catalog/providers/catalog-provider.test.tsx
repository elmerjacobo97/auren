import { RouterContextProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/router";
import {
  type CatalogFilterState,
  emptyCatalogFilterState,
} from "../filters/catalog-filters.js";
import { useCatalog } from "../hooks/use-catalog.js";
import { CatalogRegistryService } from "../services/catalog-registry.service.js";
import {
  createCatalogElement,
  createDetailElement,
  createIndex,
} from "../test/fixtures.js";
import type { CatalogFetch } from "../types/catalog.js";
import { CatalogClientError } from "../utils/catalog-errors.js";
import { CatalogBlocks } from "../views/catalog-blocks.js";
import { CatalogProvider } from "./catalog-provider.js";

const block = createCatalogElement("hero-001", {
  name: "Product launch hero",
});

function createJsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function StatusProbe({ label }: { readonly label: string }) {
  const { state } = useCatalog();

  return <output data-testid={label}>{state.status}</output>;
}

function DetailProbe({ id }: { readonly id: string }) {
  const { state, loadBlockDetail } = useCatalog();
  const [detailName, setDetailName] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    void Promise.all([loadBlockDetail(id), loadBlockDetail(id)]).then(
      ([first]) => setDetailName(first.name),
    );
  }, [id, loadBlockDetail, state]);

  return (
    <output data-testid="detail-probe">{detailName ?? state.status}</output>
  );
}

function DetailAttemptProbe({ id }: { readonly id: string }) {
  const { state, loadBlockDetail } = useCatalog();
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    void loadBlockDetail(id).then(
      () => setResult("loaded"),
      (error: unknown) =>
        setResult(error instanceof CatalogClientError ? error.code : "unknown"),
    );
  }, [id, loadBlockDetail, state]);

  return <output data-testid="detail-attempt">{result ?? state.status}</output>;
}

function FilteredCatalogProbe() {
  const [filters, setFilters] = useState<CatalogFilterState>(
    emptyCatalogFilterState,
  );

  return (
    <CatalogBlocks
      filters={filters}
      onClearFilters={() => setFilters(emptyCatalogFilterState)}
      onFiltersChange={setFilters}
    />
  );
}

describe("CatalogProvider", () => {
  it("shares one validated request across all consumers", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValue(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <CatalogProvider service={service}>
        <StatusProbe label="first-status" />
        <StatusProbe label="second-status" />
      </CatalogProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("first-status").textContent).toBe("success");
      expect(screen.getByTestId("second-status").textContent).toBe("success");
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate the initial request in StrictMode", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValue(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <StrictMode>
        <CatalogProvider service={service}>
          <StatusProbe label="strict-status" />
        </CatalogProvider>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("strict-status").textContent).toBe("success");
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("loads only the selected detail and memoizes its successful request", async () => {
    const detail = createDetailElement("hero-001", {
      name: block.name,
    });
    const fetchImplementation = vi.fn<CatalogFetch>(async (input) => {
      if (String(input).endsWith("/registry.json")) {
        return createJsonResponse(createIndex([block]));
      }

      return createJsonResponse(detail);
    });
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <CatalogProvider service={service}>
        <DetailProbe id={block.id} />
      </CatalogProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-probe").textContent).toBe(block.name);
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(
      fetchImplementation.mock.calls.map(([input]) => String(input)),
    ).toEqual([
      "https://auren.elmerjacobo.dev/registry.json",
      "https://auren.elmerjacobo.dev/blocks/hero-001.json",
    ]);
  });

  it("does not request a detail for an ID absent from the index", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValue(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <CatalogProvider service={service}>
        <DetailAttemptProbe id="missing-999" />
      </CatalogProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("detail-attempt").textContent).toBe(
        "invalid-detail",
      );
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("filters the loaded index locally without requesting registry details", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValue(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <RouterContextProvider router={router}>
        <CatalogProvider service={service}>
          <FilteredCatalogProbe />
        </CatalogProvider>
      </RouterContextProvider>,
    );

    await screen.findByText(block.name);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "application-ui" },
    });
    await screen.findByRole("heading", {
      name: "No blocks match these filters",
    });

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(
      fetchImplementation.mock.calls.map(([input]) => String(input)),
    ).toEqual(["https://auren.elmerjacobo.dev/registry.json"]);
  });

  it("retries through the provider and replaces the error state", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <RouterContextProvider router={router}>
        <CatalogProvider service={service}>
          <CatalogBlocks />
        </CatalogProvider>
      </RouterContextProvider>,
    );

    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));

    await waitFor(() => {
      expect(screen.getByText(block.name)).toBeTruthy();
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight request when the provider unmounts", async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchImplementation = vi.fn<CatalogFetch>(async (_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return await new Promise<Response>(() => undefined);
    });
    const service = new CatalogRegistryService({ fetchImplementation });

    const { unmount } = render(
      <CatalogProvider service={service}>
        <StatusProbe label="pending-status" />
      </CatalogProvider>,
    );

    await waitFor(() => {
      expect(fetchImplementation).toHaveBeenCalledTimes(1);
    });

    unmount();
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    expect(requestSignal?.aborted).toBe(true);
  });
});
