import { createRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  type CatalogFilterState,
  normalizeCatalogFilterSearch,
  parseCatalogFilterSearch,
  serializeCatalogFilterState,
} from "@/catalog/filters/catalog-filters.js";
import { CatalogBlocks } from "@/catalog/views/catalog-blocks.js";
import { rootRoute } from "@/routes/__root.js";

export const blocksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/blocks",
  validateSearch: normalizeCatalogFilterSearch,
  component: BlocksRoute,
});

function BlocksRoute() {
  const search = useSearch({ from: "/blocks" });
  const navigate = useNavigate({ from: "/blocks" });
  const filters = parseCatalogFilterSearch(search);

  const handleFiltersChange = useCallback(
    (next: CatalogFilterState) => {
      void navigate({
        to: "/blocks",
        search: serializeCatalogFilterState(next),
        replace: true,
      });
    },
    [navigate],
  );

  const handleClearFilters = useCallback(() => {
    void navigate({
      to: "/blocks",
      search: {},
      replace: true,
    });
  }, [navigate]);

  return (
    <CatalogBlocks
      filters={filters}
      onClearFilters={handleClearFilters}
      onFiltersChange={handleFiltersChange}
    />
  );
}
