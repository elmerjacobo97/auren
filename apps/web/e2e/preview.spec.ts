import { expect, test, type Page } from "@playwright/test";

const contentVersion = `sha256-${"a".repeat(64)}`;
const identity = `sha256-${"b".repeat(64)}`;

const componentFile = { path: "component.tsx", kind: "component" };
const styleFile = { path: "styles/preview.css", kind: "style" };
const sourceFiles = [componentFile, styleFile];

const detailFiles = [
  {
    ...componentFile,
    content: `export function Hero() {
  return <section className="bg-lime-200 e2e-surface p-4"><h1>Preview hero</h1></section>;
}
`,
  },
  {
    ...styleFile,
    content: ".e2e-surface { color: rgb(220 38 38); }\n",
  },
];

function createDescriptor(changes: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    contentType: "block",
    contentId: "hero-001",
    contentVersion,
    framework: "react",
    runtime: "react-vite-tailwind-4",
    runtimeVersion: "1.0.0",
    delivery: "inline",
    identity,
    status: "ready",
    artifact: {
      kind: "inline",
      reference: `previews/hero-001/${identity}.json`,
    },
    ...changes,
  };
}

function createRegistryPayload(descriptor: Record<string, unknown>) {
  const shared = {
    id: "hero-001",
    name: "Preview hero",
    description: "A deterministic preview fixture.",
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["mobile-first", "responsive"],
    frameworks: ["react"],
    dependencies: [],
    metadata: {},
    preview: descriptor,
  };

  return {
    index: {
      ...shared,
      files: sourceFiles,
    },
    detail: {
      ...shared,
      files: detailFiles,
    },
  };
}

async function mockRegistry(
  page: Page,
  descriptor = createDescriptor(),
): Promise<void> {
  const { index, detail } = createRegistryPayload(descriptor);

  await page.route("**/registry.json", (route) =>
    route.fulfill({
      body: JSON.stringify({ schemaVersion: 1, blocks: [index] }),
      contentType: "application/json",
    }),
  );
  await page.route("**/blocks/hero-001.json", (route) =>
    route.fulfill({
      body: JSON.stringify(detail),
      contentType: "application/json",
    }),
  );
}

test("renders styled output, isolates it, and preserves the instance across tabs", async ({
  page,
}) => {
  await mockRegistry(page);
  await page.goto("/blocks/hero-001");

  const preview = page.locator('iframe[data-preview-isolated="true"]');
  await expect(page.locator('[data-preview-status="ready"]')).toBeVisible();
  await expect(preview).toHaveAttribute(
    "sandbox",
    "allow-scripts allow-same-origin",
  );
  await expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");

  const previewFrame = page.frameLocator(
    'iframe[data-preview-isolated="true"]',
  );
  await expect(
    previewFrame.getByRole("heading", { name: "Preview hero" }),
  ).toBeVisible();
  await expect(previewFrame.locator(".e2e-surface")).toHaveCSS(
    "color",
    "rgb(220, 38, 38)",
  );
  await expect(
    previewFrame.locator("meta[http-equiv=Content-Security-Policy]"),
  ).toHaveAttribute("content", /connect-src 'none'/);

  const initialSource = await preview.getAttribute("src");

  await page.getByRole("tab", { name: "Code" }).click();
  await page.getByRole("tab", { name: "Install" }).click();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(preview).toHaveAttribute("src", initialSource ?? "");

  await page.getByRole("button", { name: "Preview at mobile width" }).click();
  await expect
    .poll(() =>
      preview.evaluate((frame) => frame.getBoundingClientRect().width),
    )
    .toBeLessThan(400);
});

test("recreates the preview only after explicit refresh", async ({ page }) => {
  await mockRegistry(page);
  await page.goto("/blocks/hero-001");

  const preview = page.locator('iframe[data-preview-isolated="true"]');
  await expect(preview).toBeVisible();
  await expect(page.locator('[data-preview-status="ready"]')).toBeVisible();
  const initialSource = await preview.getAttribute("src");

  await page.getByRole("button", { name: "Refresh preview" }).click();
  await expect(page.locator('[data-preview-status="ready"]')).toBeVisible();
  await expect.poll(() => preview.getAttribute("src")).not.toBe(initialSource);
});

test("opens denied external previews safely and keeps failed previews usable", async ({
  page,
}) => {
  await mockRegistry(
    page,
    createDescriptor({
      artifact: undefined,
      delivery: "external",
      livePreview: {
        url: "https://preview.example.test/hero-001",
        embedding: "denied",
      },
    }),
  );
  await page.goto("/blocks/hero-001");

  const externalLink = page.getByRole("link", { name: "Open live preview" });
  await expect(externalLink).toHaveAttribute("target", "_blank");
  await expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(externalLink).toHaveAttribute("referrerpolicy", "no-referrer");
  await expect(page.getByTitle("External live preview")).toHaveCount(0);

  await page.unroute("**/registry.json");
  await page.unroute("**/blocks/hero-001.json");
  await mockRegistry(
    page,
    createDescriptor({
      artifact: undefined,
      failure: {
        category: "build",
        message: "The preview fixture failed to compile.",
      },
      status: "failure",
    }),
  );
  await page.reload();

  await expect(page.getByRole("status")).toContainText(
    "The preview fixture failed to compile.",
  );
  await expect(
    page.locator('iframe[data-preview-isolated="true"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Dependencies" }),
  ).toBeVisible();
});
