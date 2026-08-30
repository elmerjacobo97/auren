import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FutureCatalogSection } from "./future-catalog-section.js";

describe("FutureCatalogSection", () => {
  it.each(["components", "pages", "collections"] as const)(
    "keeps %s explicit and empty",
    (section) => {
      const markup = renderToStaticMarkup(
        <FutureCatalogSection section={section} />,
      );

      expect(markup).toContain("not available yet");
      expect(markup).not.toContain("hero-001");
      expect(markup).not.toContain("Product launch hero");
    },
  );
});
