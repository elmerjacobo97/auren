/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import type { CatalogElement } from "@auren/schemas/catalog";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDetailElement } from "../test/fixtures.js";
import { PreviewAdapter, type PreviewRuntimeProps } from "./preview-adapter.js";
import { createPreviewProject } from "./preview-project.js";

function createPreviewBlock(
  componentSource: string,
  changes: Record<string, unknown> = {},
): CatalogElement {
  const detail = createDetailElement("hero-001", {
    files: [{ path: "component.tsx", kind: "component" }],
    ...changes,
  });

  return {
    ...detail,
    files: detail.files.map((file) =>
      file.path === "component.tsx"
        ? { ...file, content: componentSource }
        : file,
    ),
  };
}

const supportedBlock = createPreviewBlock(
  `import { type HeroProps } from "./utilities/types";
export function Hero() {
  return <section aria-label="Preview"><h1>Safe preview</h1></section>;
}
`,
  {
    files: [
      { path: "component.tsx", kind: "component" },
      { path: "utilities/types.ts", kind: "utility" },
    ],
    dependencies: [
      { kind: "package", name: "lucide-react", version: "^0.468.0" },
    ],
  },
);

function MockPreview({ project }: PreviewRuntimeProps) {
  return (
    <div data-testid="mock-preview">
      {project.files["/src/component.tsx"]?.code}
    </div>
  );
}

function ThrowingPreview(_props: PreviewRuntimeProps): never {
  throw new Error("sandbox runtime failed");
}

afterEach(() => {
  cleanup();
});

describe("createPreviewProject", () => {
  it("maps validated textual files and declared package versions", () => {
    const result = createPreviewProject(supportedBlock);

    expect(result.status).toBe("supported");

    if (result.status !== "supported") {
      return;
    }

    expect(result.project.entry).toBe("/index.tsx");
    expect(result.project.files["/src/component.tsx"]?.code).toContain(
      "Safe preview",
    );
    expect(result.project.files["/src/utilities/types.ts"]?.code).toBe(
      "source for utilities/types.ts",
    );
    expect(result.project.dependencies["lucide-react"]).toBe("^0.468.0");
    expect(result.project.dependencies.tailwindcss).toBe("4.3.3");
    expect(result.project.files["/index.tsx"]?.code).toContain("BlockModule");
    expect(result.project.files["/index.tsx"]?.code).toContain(
      "createRoot(rootElement).render(createElement(BlockPreview))",
    );
    expect(result.project.files["/index.tsx"]?.code).toContain(
      'import "./styles.css"',
    );
  });

  it("supports default props with nested values and standard pass-through props", () => {
    const block = createPreviewBlock(
      `export function Hero({
  content = { title: "Launch", actions: ["Explore", "Save"] },
  renderAction = () => ({ label: "Explore", href: "#" }),
  children,
  className,
  id,
  ...rest
}: { content?: object; renderAction?: () => object }) {
  return <section id={id} className={className}>{children ?? rest.content}</section>;
}
`,
    );

    expect(createPreviewProject(block)).toMatchObject({ status: "supported" });
  });

  it("keeps a genuinely required destructured prop unsupported", () => {
    const block = createPreviewBlock(
      `export function Hero({ title, ...rest }: { title: string }) {
  return <h1>{title}</h1>;
}
`,
    );

    expect(createPreviewProject(block)).toEqual({
      status: "unsupported",
      reason: "required-props",
    });
  });

  it("supports props resolved from a local fallback object", () => {
    const block = createPreviewBlock(
      `const defaultBrand = { name: "Auren" };
export function Navbar({ brand }: { brand?: { name: string } }) {
  const resolvedBrand = { ...defaultBrand, ...brand };
  return <nav>{resolvedBrand.name}</nav>;
}
`,
    );

    expect(createPreviewProject(block)).toMatchObject({ status: "supported" });
  });

  it("supports props marked optional by a shared type", () => {
    const block = createPreviewBlock(
      `interface HeroProps { active?: boolean }
export function Hero({ active }: HeroProps) {
  return <h1>{active ? "Active" : "Idle"}</h1>;
}
`,
    );

    expect(createPreviewProject(block)).toMatchObject({ status: "supported" });
  });

  it.each([
    [
      "asset",
      createPreviewBlock("export function Hero() { return null; }", {
        files: [
          { path: "component.tsx", kind: "component" },
          { path: "assets/logo.png", kind: "asset" },
        ],
      }),
      "unsupported-asset",
    ],
    [
      "Auren dependency",
      createPreviewBlock("export function Hero() { return null; }", {
        dependencies: [{ kind: "auren", id: "button-001" }],
      }),
      "unresolved-dependency",
    ],
    [
      "shadcn dependency",
      createPreviewBlock("export function Hero() { return null; }", {
        dependencies: [{ kind: "shadcn", name: "button" }],
      }),
      "unresolved-dependency",
    ],
    [
      "missing export",
      createPreviewBlock("const Hero = () => null;"),
      "missing-export",
    ],
    [
      "required props",
      createPreviewBlock(
        "export function Hero({ title }: { title: string }) { return <h1>{title}</h1>; }",
      ),
      "required-props",
    ],
    [
      "unresolved import",
      createPreviewBlock(
        "import { Button } from '@/components/ui/button'; export function Hero() { return <Button />; }",
      ),
      "unsupported-import",
    ],
  ] as const)("uses the explicit fallback for %s", (_label, block, reason) => {
    expect(createPreviewProject(block)).toEqual({
      status: "unsupported",
      reason,
    });
  });
});

describe("PreviewAdapter", () => {
  it("renders a mocked isolated preview runtime", () => {
    render(<PreviewAdapter block={supportedBlock} runtime={MockPreview} />);

    expect(screen.getByTestId("mock-preview").textContent).toContain(
      "Safe preview",
    );
    expect(screen.queryByText("Preview unavailable")).toBeNull();
  });

  it("renders a useful fallback for unsupported previews", () => {
    const block = createPreviewBlock("const Hero = () => null;");

    render(<PreviewAdapter block={block} runtime={MockPreview} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Preview unavailable")).toBeTruthy();
    expect(screen.getByText(/no unambiguous renderable export/)).toBeTruthy();
  });

  it("contains mocked preview runtime failures", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<PreviewAdapter block={supportedBlock} runtime={ThrowingPreview} />);

    expect(screen.getByText("Preview unavailable")).toBeTruthy();
    expect(screen.getByText(/compile or runtime failure/)).toBeTruthy();
  });
});
