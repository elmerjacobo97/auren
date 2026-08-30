import { createRoute } from "@tanstack/react-router";
import { CatalogOverview } from "@/catalog/views/catalog-overview.js";
import { rootRoute } from "@/routes/__root.js";

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: CatalogOverview,
});
