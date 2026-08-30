import { createRoute } from "@tanstack/react-router";
import { PagesPage } from "@/routes/pages/index.js";
import { rootRoute } from "@/routes/__root.js";

export const pagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pages",
  component: PagesPage,
});
