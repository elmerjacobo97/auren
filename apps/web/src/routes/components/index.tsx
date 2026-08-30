import { createRoute } from "@tanstack/react-router";
import { FutureCatalogSection } from "@/catalog/views/future-catalog-section.js";
import { rootRoute } from "@/routes/__root.js";

export function ComponentsPage() {
  return <FutureCatalogSection section="components" />;
}

export const componentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/components",
  component: ComponentsPage,
});
