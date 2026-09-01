/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDetailElement } from "../test/fixtures.js";

vi.mock("../preview/preview-adapter.js", () => ({
  PreviewAdapter: () => <div data-testid="preview-runtime" />,
}));

import { BlockPlayground } from "./block-playground.js";

const block = createDetailElement("hero-001");

afterEach(() => {
  cleanup();
});

describe("BlockPlayground", () => {
  it("keeps the inline preview mounted while switching tabs", () => {
    render(
      <BlockPlayground
        block={block}
        codePanel={<pre>source</pre>}
        installPanel={<pre>auren add hero-001</pre>}
      />,
    );

    const preview = screen.getByTestId("preview-runtime");

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    expect(screen.getByTestId("preview-runtime")).toBe(preview);

    fireEvent.click(screen.getByRole("tab", { name: "Install" }));
    expect(screen.getByTestId("preview-runtime")).toBe(preview);

    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));
    expect(screen.getByTestId("preview-runtime")).toBe(preview);
  });

  it("recreates the preview only after explicit refresh", () => {
    render(
      <BlockPlayground
        block={block}
        codePanel={<pre>source</pre>}
        installPanel={<pre>auren add hero-001</pre>}
      />,
    );

    const preview = screen.getByTestId("preview-runtime");
    fireEvent.click(screen.getByRole("button", { name: "Refresh preview" }));

    expect(screen.getByTestId("preview-runtime")).not.toBe(preview);
  });
});
