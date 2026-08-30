import { createRootRoute, Outlet } from "@tanstack/react-router";
import { CatalogShell } from "@/catalog/components/catalog-shell.js";
import { CatalogProvider } from "@/catalog/providers/catalog-provider.js";

function RootLayout() {
  return (
    <CatalogProvider>
      <CatalogShell>
        <Outlet />
      </CatalogShell>
    </CatalogProvider>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
