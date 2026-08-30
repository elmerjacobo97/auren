import { createRoute } from "@tanstack/react-router";
import { CatalogBlocks } from "@/catalog/views/catalog-blocks.js";
import { rootRoute } from "@/routes/__root.js";

export const blocksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blocks",
  component: CatalogBlocks,
});
