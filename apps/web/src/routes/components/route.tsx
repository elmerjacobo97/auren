import { createRoute } from "@tanstack/react-router";
import { ComponentsPage } from "@/routes/components/index.js";
import { rootRoute } from "@/routes/__root.js";

export const componentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/components",
  component: ComponentsPage,
});
