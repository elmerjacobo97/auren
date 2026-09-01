import { describe, expect, it, vi } from "vitest";
import { reportPreviewDiagnostic } from "./preview-diagnostics.js";

describe("reportPreviewDiagnostic", () => {
  it("writes structured preview failures without provider details", () => {
    const write = vi.fn();

    const payload = reportPreviewDiagnostic(
      {
        category: "provider",
        contentId: "hero-001",
        message: "The hosted preview provider could not create a project.",
        phase: "provider",
        runtime: "react-vite-tailwind-4",
      },
      write,
    );

    expect(payload).toEqual({
      event: "auren.preview",
      category: "provider",
      contentId: "hero-001",
      message: "The hosted preview provider could not create a project.",
      phase: "provider",
      runtime: "react-vite-tailwind-4",
    });
    expect(write).toHaveBeenCalledWith(
      `[auren-preview] ${JSON.stringify(payload)}`,
    );
  });
});
