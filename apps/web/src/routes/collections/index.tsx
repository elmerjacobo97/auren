import { createRoute } from "@tanstack/react-router";
import { FutureCatalogSection } from "@/catalog/views/future-catalog-section.js";
import { rootRoute } from "@/routes/__root.js";

export function CollectionsPage() {
  return <FutureCatalogSection section="collections" />;
}

export const collectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collections",
  component: CollectionsPage,
});
