import { createRoute } from "@tanstack/react-router";
import { CollectionsPage } from "@/routes/collections/index.js";
import { rootRoute } from "@/routes/__root.js";

export const collectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collections",
  component: CollectionsPage,
});
