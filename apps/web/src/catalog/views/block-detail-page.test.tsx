import { RouterContextProvider } from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogContext } from "../providers/catalog-context.js";
import { CatalogProvider } from "../providers/catalog-provider.js";
import type {
  CatalogContextValue,
  CatalogFetch,
  CatalogState,
} from "../types/catalog.js";
import {
  CatalogClientError,
  createDetailTransportError,
} from "../utils/catalog-errors.js";
import {
  createCatalogElement,
  createDetailElement,
  createIndex,
} from "../test/fixtures.js";
import { CatalogRegistryService } from "../services/catalog-registry.service.js";
import { BlockDetailPage } from "./block-detail-page.js";
import { router } from "@/router";

const indexedBlock = createCatalogElement("hero-001", {
  name: "Product launch hero",
  description: "A quiet launch panel for a new product.",
  metadata: { source: "catalog", note: "<strong>escaped</strong>" },
  dependencies: [
    { kind: "package", name: "lucide-react", version: "^0.468.0" },
    { kind: "auren", id: "button-001" },
    { kind: "shadcn", name: "button" },
  ],
  files: [
    { path: "component.tsx", kind: "component" },
    { path: "utilities/types.ts", kind: "utility" },
    { path: "assets/logo.png", kind: "asset" },
  ],
});

const componentSource = 'export const component = "preserved";\n';
const utilitySource = 'export const utility = "  exact";\r\n\r\n';
const detailElement = createDetailElement("hero-001", {
  name: indexedBlock.name,
  description: indexedBlock.description,
  category: indexedBlock.category,
  type: indexedBlock.type,
  styles: indexedBlock.styles,
  industries: indexedBlock.industries,
  features: indexedBlock.features,
  frameworks: indexedBlock.frameworks,
  dependencies: indexedBlock.dependencies,
  metadata: indexedBlock.metadata,
  files: indexedBlock.files,
});
const detailBlock = {
  ...detailElement,
  files: detailElement.files.map((file) =>
    file.path === "component.tsx"
      ? { ...file, content: componentSource }
      : file.path === "utilities/types.ts"
        ? { ...file, content: utilitySource }
        : file,
  ),
};

function createJsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function renderWithContext(
  state: CatalogState,
  options: {
    readonly id?: string;
    readonly loadBlockDetail?: CatalogContextValue["loadBlockDetail"];
    readonly retryBlockDetail?: CatalogContextValue["retryBlockDetail"];
  } = {},
) {
  const value: CatalogContextValue = {
    state,
    retry: vi.fn(),
    loadBlockDetail:
      options.loadBlockDetail ?? vi.fn().mockResolvedValue(detailBlock),
    retryBlockDetail: options.retryBlockDetail ?? vi.fn(),
  };

  return render(
    <RouterContextProvider router={router}>
      <CatalogContext.Provider value={value}>
        <BlockDetailPage id={options.id ?? indexedBlock.id} />
      </CatalogContext.Provider>
    </RouterContextProvider>,
  );
}

function createCatalogDetailHarness(
  detailResponses: readonly unknown[] = [detailBlock],
) {
  const responses = [...detailResponses];
  const fetchImplementation = vi.fn<CatalogFetch>(async (input) => {
    if (String(input).endsWith("/registry.json")) {
      return createJsonResponse(createIndex([indexedBlock]));
    }

    return createJsonResponse(responses.shift() ?? detailBlock);
  });
  const service = new CatalogRegistryService({ fetchImplementation });

  render(
    <RouterContextProvider router={router}>
      <CatalogProvider
        registryUrl="https://registry.example.test/"
        service={service}
      >
        <BlockDetailPage id={indexedBlock.id} />
      </CatalogProvider>
    </RouterContextProvider>,
  );

  return fetchImplementation;
}

function installClipboard(writeText: ReturnType<typeof vi.fn> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: writeText === undefined ? undefined : { writeText },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
});

describe("BlockDetailPage", () => {
  it("renders a safe not-found state with a return link", () => {
    renderWithContext(
      { status: "success", blocks: [indexedBlock] },
      { id: "missing-999" },
    );

    expect(
      screen.getByRole("heading", { name: "Block not found" }),
    ).toBeTruthy();
    expect(screen.getByText("missing-999")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Back to Blocks/ })).toBeTruthy();
  });

  it("keeps source and metadata hidden while the selected detail loads", () => {
    const loadBlockDetail = vi.fn<CatalogContextValue["loadBlockDetail"]>(
      () => new Promise(() => undefined),
    );

    renderWithContext(
      { status: "success", blocks: [indexedBlock] },
      { loadBlockDetail },
    );

    expect(
      screen.getByRole("heading", { name: "Loading hero-001" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Metadata" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Source" })).toBeNull();
  });

  it("renders validated metadata, grouped dependencies, and the playground views", async () => {
    const fetchImplementation = createCatalogDetailHarness();

    expect(
      await screen.findByRole("heading", { name: detailBlock.name }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Metadata" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dependencies" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Preview" })).toBeTruthy();
    expect(screen.getByText("Packages")).toBeTruthy();
    expect(screen.getByText("lucide-react")).toBeTruthy();
    expect(screen.getByText("Auren blocks")).toBeTruthy();
    expect(screen.getByText("button-001")).toBeTruthy();
    expect(screen.getByText("shadcn/ui")).toBeTruthy();
    expect(screen.getByText("Preview unavailable")).toBeTruthy();
    const previewPanel = screen.getByRole("tabpanel", { name: "Preview" });
    expect(previewPanel.hidden).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(previewPanel.hidden).toBe(true);
    expect(screen.getByRole("heading", { name: "Source" })).toBeTruthy();
    expect(screen.getByText("assets/logo.png")).toBeTruthy();
    expect(screen.getByText(/<strong>escaped<\/strong>/)).toBeTruthy();
    const componentCode = screen.getByText(
      (_, element) =>
        element?.tagName === "CODE" && element.textContent === componentSource,
    );
    expect(componentCode.parentElement?.className).toContain("overflow-x-auto");

    fireEvent.click(screen.getByRole("tab", { name: "Install" }));
    expect(previewPanel.hidden).toBe(true);
    expect(screen.getByRole("heading", { name: "Install" })).toBeTruthy();
    expect(screen.getByText("npx auren add hero-001").className).toContain(
      "break-all",
    );
    expect(fetchImplementation).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(previewPanel.hidden).toBe(false);
  });

  it("copies each selected text file exactly without changing source or fetching again", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const fetchImplementation = createCatalogDetailHarness();

    await screen.findByRole("heading", { name: detailBlock.name });
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));

    const componentCode = screen.getByText(
      (_, element) =>
        element?.tagName === "CODE" && element.textContent === componentSource,
    );
    expect(componentCode.textContent).toBe(componentSource);
    expect(
      screen.getByRole("button", { name: "Copy code from component.tsx" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Copy code from assets/logo.png" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from component.tsx" }),
    );

    expect(await screen.findByText("Code copied.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(componentSource);
    expect(componentCode.textContent).toBe(componentSource);

    fireEvent.click(screen.getByText("utilities/types.ts"));
    const utilityButton = await screen.findByRole("button", {
      name: "Copy code from utilities/types.ts",
    });
    fireEvent.click(utilityButton);

    await waitFor(() => {
      expect(writeText).toHaveBeenNthCalledWith(2, utilitySource);
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("keeps source copy feedback independent for each file", async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("denied"));
    installClipboard(writeText);
    createCatalogDetailHarness();
    await screen.findByRole("heading", { name: detailBlock.name });
    fireEvent.click(screen.getByRole("tab", { name: "Code" }));

    const componentButton = screen.getByRole("button", {
      name: "Copy code from component.tsx",
    });
    fireEvent.click(componentButton);
    expect((await screen.findByText("Code copied.")).textContent).toContain(
      "Code copied",
    );
    expect(componentButton.textContent).toContain("Copied");

    fireEvent.click(screen.getByText("utilities/types.ts"));
    const utilityButton = await screen.findByRole("button", {
      name: "Copy code from utilities/types.ts",
    });
    fireEvent.click(utilityButton);

    expect(
      await screen.findByText(
        "The code could not be copied; select it to copy manually.",
      ),
    ).toBeTruthy();
    expect(componentButton.textContent).toContain("Copied");
    expect(utilityButton.textContent).toContain("Copy code");
    expect(screen.queryByText("denied")).toBeNull();
  });

  it.each([
    ["unsupported", undefined, "Clipboard access is not supported here"],
    [
      "failed",
      vi.fn().mockRejectedValue(new Error("denied")),
      "The code could not be copied",
    ],
  ] as const)(
    "reports %s source clipboard state with manual-copy guidance",
    async (_state, writeText, message) => {
      installClipboard(writeText);
      createCatalogDetailHarness();
      await screen.findByRole("heading", { name: detailBlock.name });
      fireEvent.click(screen.getByRole("tab", { name: "Code" }));

      fireEvent.click(
        screen.getByRole("button", { name: "Copy code from component.tsx" }),
      );

      expect(
        await screen.findByText((content) => content.includes(message)),
      ).toBeTruthy();
      expect(
        screen.getByText(
          (_, element) =>
            element?.tagName === "CODE" &&
            element.textContent === componentSource,
        ).textContent,
      ).toBe(componentSource);
    },
  );

  it("does not render partial detail content and retries the detail request", async () => {
    const fetchImplementation = createCatalogDetailHarness([
      { ...detailBlock, name: "Drifted detail" },
      detailBlock,
    ]);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Could not load hero-001")).toBeTruthy();
    expect(screen.queryByText("Drifted detail")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Source" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry detail" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: detailBlock.name }),
      ).toBeTruthy();
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["unsupported", undefined, "Clipboard access is not supported here"],
    [
      "failed",
      vi.fn().mockRejectedValue(new Error("denied")),
      "The command could not be copied",
    ],
  ] as const)(
    "reports %s clipboard state",
    async (_state, writeText, message) => {
      installClipboard(writeText);
      createCatalogDetailHarness();
      await screen.findByRole("heading", { name: detailBlock.name });
      fireEvent.click(screen.getByRole("tab", { name: "Install" }));
      await screen.findByText("npx auren add hero-001");

      fireEvent.click(
        screen.getByRole("button", {
          name: "Copy installation command for hero-001",
        }),
      );

      expect(
        await screen.findByText((content) => content.includes(message)),
      ).toBeTruthy();
    },
  );

  it("reports a successful clipboard copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    createCatalogDetailHarness();
    await screen.findByRole("heading", { name: detailBlock.name });
    fireEvent.click(screen.getByRole("tab", { name: "Install" }));
    await screen.findByText("npx auren add hero-001");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy installation command for hero-001",
      }),
    );

    expect(
      (
        await screen.findByRole("button", {
          name: "Copy installation command for hero-001",
        })
      ).textContent,
    ).toContain("Copied");
    expect(writeText).toHaveBeenCalledWith("npx auren add hero-001");
  });

  it("renders recoverable index and detail errors with the intended retry actions", () => {
    const indexRetry = vi.fn();
    const indexError = new CatalogClientError(
      "transport",
      "The Registry index request could not be completed.",
    );
    const { unmount } = render(
      <RouterContextProvider router={router}>
        <CatalogContext.Provider
          value={{
            state: { status: "error", error: indexError },
            retry: indexRetry,
            loadBlockDetail: vi.fn(),
            retryBlockDetail: vi.fn(),
          }}
        >
          <BlockDetailPage id={indexedBlock.id} />
        </CatalogContext.Provider>
      </RouterContextProvider>,
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry loading" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    expect(indexRetry).toHaveBeenCalledTimes(1);
    unmount();

    const detailRetry = vi.fn();
    const detailError = createDetailTransportError();
    renderWithContext(
      { status: "success", blocks: [indexedBlock] },
      {
        loadBlockDetail: vi.fn().mockRejectedValue(detailError),
        retryBlockDetail: detailRetry,
      },
    );

    return waitFor(() => {
      expect(screen.getByText("Retry detail")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Retry detail" }));
      expect(detailRetry).toHaveBeenCalledWith("hero-001");
    });
  });
});
