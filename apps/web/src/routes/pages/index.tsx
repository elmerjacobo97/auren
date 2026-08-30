import { createRoute } from "@tanstack/react-router";
import { FutureCatalogSection } from "@/catalog/views/future-catalog-section.js";
import { rootRoute } from "@/routes/__root.js";

export function PagesPage() {
  return <FutureCatalogSection section="pages" />;
}

export const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pages",
  component: PagesPage,
});
