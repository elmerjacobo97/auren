import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it, vi } from "vitest";
import { createTerminal } from "../../terminal/terminal.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import { runInfoFlow } from "./info-flow.js";

const element: CatalogElement = {
  id: "hero-001",
  name: "Product launch hero",
  description: "A responsive product launch hero.",
  category: "marketing",
  type: "hero",
  styles: [],
  industries: [],
  features: [],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

function createCapturedTerminal(): {
  terminal: ReturnType<typeof createTerminal>;
  stdout: () => string;
  stderr: () => string;
} {
  let stdout = "";
  let stderr = "";

  return {
    terminal: createTerminal({
      color: false,
      stdout: (text) => {
        stdout += text;
      },
      stderr: (text) => {
        stderr += text;
      },
    }),
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

describe("runInfoFlow", () => {
  it("writes only a formatted result on success", async () => {
    const captured = createCapturedTerminal();
    const source: CatalogSource = {
      getById: vi.fn(async () => element),
      list: vi.fn(async () => [element]),
    };

    const status = await runInfoFlow({
      id: "hero-001",
      terminal: captured.terminal,
      source,
    });

    expect(status).toBe(0);
    expect(captured.stdout()).toContain("ID: hero-001");
    expect(captured.stderr()).toBe("");
  });

  it("renders unknown IDs as status 1 errors without output", async () => {
    const captured = createCapturedTerminal();
    const source: CatalogSource = {
      getById: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
    };

    const status = await runInfoFlow({
      id: "missing-001",
      terminal: captured.terminal,
      source,
    });

    expect(status).toBe(1);
    expect(captured.stdout()).toBe("");
    expect(captured.stderr()).toBe(
      'error: Catalog element not found: "missing-001"\n',
    );
  });

  it("renders source failures concisely without stack traces", async () => {
    const captured = createCapturedTerminal();
    const source: CatalogSource = {
      getById: vi.fn(async () => {
        throw new Error("catalog unavailable\n    at hidden stack");
      }),
      list: vi.fn(async () => []),
    };

    const status = await runInfoFlow({
      id: "hero-001",
      terminal: captured.terminal,
      source,
    });

    expect(status).toBe(1);
    expect(captured.stdout()).toBe("");
    expect(captured.stderr()).toBe("error: catalog unavailable\n");
    expect(captured.stderr()).not.toContain("at hidden stack");
  });
});
