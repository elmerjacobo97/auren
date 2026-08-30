import { useContext } from "react";
import { CatalogContext } from "../providers/catalog-context.js";
import type { CatalogContextValue } from "../types/catalog.js";

export function useCatalog(): CatalogContextValue {
  const context = useContext(CatalogContext);

  if (context === null) {
    throw new Error("useCatalog must be used inside CatalogProvider");
  }

  return context;
}
