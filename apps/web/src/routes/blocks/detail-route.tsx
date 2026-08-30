import { createRoute } from "@tanstack/react-router";
import { BlockDetailRoute } from "@/routes/blocks/detail.js";
import { rootRoute } from "@/routes/__root.js";

export const blockDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blocks/$id",
  component: BlockDetailRoute,
});
