import type { CatalogElement } from "@auren/schemas/catalog";
import { describe, expect, it, vi } from "vitest";
import { createTerminal } from "../../terminal/terminal.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import { runSearchFlow, type SearchFilterOptions } from "./search-flow.js";

const heroElement: CatalogElement = {
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
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

const navbarElement: CatalogElement = {
  id: "navbar-001",
  name: "Glass navigation bar",
  description: "A glassy responsive navigation bar.",
  category: "application-ui",
  type: "navbar",
  styles: ["glass"],
  industries: ["fintech"],
  features: ["responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

const pricingElement: CatalogElement = {
  id: "pricing-001",
  name: "Tiered pricing table",
  description: "Compare plans for your product.",
  category: "marketing",
  type: "pricing",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["dark-mode"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};

const catalogElements = [heroElement, navbarElement, pricingElement];

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

function createSource(
  elements: readonly CatalogElement[] = catalogElements,
): CatalogSource & { list: ReturnType<typeof vi.fn> } {
  return {
    getById: vi.fn(async () => undefined),
    list: vi.fn(async () => elements),
  };
}

async function run(
  query: string | undefined,
  filters: SearchFilterOptions = {},
  source: CatalogSource = createSource(),
): Promise<{ status: number; stdout: string; stderr: string }> {
  const captured = createCapturedTerminal();

  const status = await runSearchFlow({
    query,
    filters,
    terminal: captured.terminal,
    source,
  });

  return { status, stdout: captured.stdout(), stderr: captured.stderr() };
}

describe("runSearchFlow text matching", () => {
  it("matches the query against id, name, and description", async () => {
    await expect(run("hero").then((r) => r.stdout)).resolves.toContain(
      "hero-001",
    );
    await expect(run("navigation").then((r) => r.stdout)).resolves.toContain(
      "navbar-001",
    );
    await expect(run("launch").then((r) => r.stdout)).resolves.toContain(
      "hero-001",
    );
    await expect(run("plans").then((r) => r.stdout)).resolves.toContain(
      "pricing-001",
    );
  });

  it("matches case-insensitively", async () => {
    const result = await run("HERO");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("hero-001");
  });
});

describe("runSearchFlow taxonomy filters", () => {
  it.each([
    [{ type: "hero" }, ["hero-001"]],
    [{ category: "marketing" }, ["hero-001", "pricing-001"]],
    [{ style: "glass" }, ["navbar-001"]],
    [{ industry: "fintech" }, ["navbar-001"]],
    [{ feature: "dark-mode" }, ["pricing-001"]],
  ] as const)("filters with %j", async (filters, expectedIds) => {
    const result = await run(undefined, filters);

    expect(result.status).toBe(0);

    for (const element of catalogElements) {
      const expected = expectedIds.includes(element.id as never);
      expect(result.stdout.includes(element.id)).toBe(expected);
    }
  });

  it("combines filters with AND semantics", async () => {
    const result = await run(undefined, {
      category: "marketing",
      feature: "responsive",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("hero-001");
    expect(result.stdout).not.toContain("pricing-001");
    expect(result.stdout).not.toContain("navbar-001");
  });

  it("does not normalize filter value casing", async () => {
    const mismatchedCase = await run(undefined, { category: "Marketing" });

    expect(mismatchedCase.status).toBe(1);
    expect(mismatchedCase.stderr).toContain(
      'Invalid value for --category: "Marketing"',
    );
  });

  it.each([
    ["--type", { type: "not-a-type" }],
    ["--category", { category: "not-a-category" }],
    ["--style", { style: "not-a-style" }],
    ["--industry", { industry: "not-an-industry" }],
    ["--feature", { feature: "not-a-feature" }],
  ] as const)(
    "rejects an invalid %s value before catalog access",
    async (option, filters) => {
      const source = createSource();

      const result = await run("hero", filters, source);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Invalid value for ${option}`);
      expect(result.stderr).toContain(Object.values(filters)[0]);
      expect(source.list).not.toHaveBeenCalled();
    },
  );
});

describe("runSearchFlow result presentation", () => {
  it("lists the whole catalog without a query or filters", async () => {
    const result = await run(undefined);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("3 results");

    for (const element of catalogElements) {
      expect(result.stdout).toContain(element.id);
    }
  });

  it("orders matches by ascending canonical id", async () => {
    const source: CatalogSource = {
      getById: vi.fn(async () => undefined),
      list: vi.fn(async () => [navbarElement, pricingElement, heroElement]),
    };

    const result = await run(undefined, {}, source);

    expect(result.status).toBe(0);
    const heroIndex = result.stdout.indexOf("hero-001");
    const navbarIndex = result.stdout.indexOf("navbar-001");
    const pricingIndex = result.stdout.indexOf("pricing-001");

    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(heroIndex).toBeLessThan(navbarIndex);
    expect(navbarIndex).toBeLessThan(pricingIndex);
  });

  it("treats an empty result set as success", async () => {
    const result = await run("zzz-no-match");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("No matching catalog elements found.\n");
    expect(result.stderr).toBe("");
  });

  it("writes successful output only to stdout", async () => {
    const result = await run("hero");

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("1 result");
  });
});

describe("runSearchFlow failures", () => {
  it("renders source failures concisely without stack traces", async () => {
    const source: CatalogSource = {
      getById: vi.fn(async () => undefined),
      list: vi.fn(async () => {
        throw new Error("catalog unavailable\n    at hidden stack");
      }),
    };

    const result = await run("hero", {}, source);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("error: catalog unavailable\n");
    expect(result.stderr).not.toContain("hidden stack");
  });
});
