import { createRouter } from "@tanstack/react-router";
import { blocksRoute } from "@/routes/blocks/index.js";
import { collectionsRoute } from "@/routes/collections/index.js";
import { componentsRoute } from "@/routes/components/index.js";
import { indexRoute } from "@/routes/catalog/index.js";
import { pagesRoute } from "@/routes/pages/index.js";
import { rootRoute } from "@/routes/__root.js";
import { catalogRoutePaths } from "@/routes/catalog/route-paths.js";

export { catalogRoutePaths };

export const routeTree = rootRoute.addChildren([
  indexRoute,
  componentsRoute,
  blocksRoute,
  pagesRoute,
  collectionsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
