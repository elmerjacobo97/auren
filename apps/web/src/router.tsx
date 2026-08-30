import { createRouter } from "@tanstack/react-router";
import { blockDetailRoute } from "@/routes/blocks/detail-route.js";
import { blocksRoute } from "@/routes/blocks/index.js";
import { collectionsRoute } from "@/routes/collections/route.js";
import { componentsRoute } from "@/routes/components/route.js";
import { indexRoute } from "@/routes/catalog/index.js";
import { pagesRoute } from "@/routes/pages/route.js";
import { rootRoute } from "@/routes/__root.js";
import { catalogRoutePaths } from "@/routes/catalog/route-paths.js";

export { catalogRoutePaths };

export const routeTree = rootRoute.addChildren([
  indexRoute,
  componentsRoute,
  blocksRoute,
  blockDetailRoute,
  pagesRoute,
  collectionsRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
