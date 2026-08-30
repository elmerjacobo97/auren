import { createContext } from "react";
import type { CatalogContextValue } from "../types/catalog.js";

export const CatalogContext = createContext<CatalogContextValue | null>(null);
