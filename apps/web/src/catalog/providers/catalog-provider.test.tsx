import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalogBlocks } from "../views/catalog-blocks.js";
import type { CatalogFetch } from "../types/catalog.js";
import { createCatalogElement, createIndex } from "../test/fixtures.js";
import { useCatalog } from "../hooks/use-catalog.js";
import { CatalogProvider } from "./catalog-provider.js";
import { CatalogRegistryService } from "../services/catalog-registry.service.js";

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

  it("retries through the provider and replaces the error state", async () => {
    const fetchImplementation = vi
      .fn<CatalogFetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(createJsonResponse(createIndex([block])));
    const service = new CatalogRegistryService({ fetchImplementation });

    render(
      <CatalogProvider service={service}>
        <CatalogBlocks />
      </CatalogProvider>,
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
