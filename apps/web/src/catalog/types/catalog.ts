import type { CatalogClientError } from "@/catalog/utils/catalog-errors";
import type { CatalogElement } from "@auren/schemas/catalog";

export type CatalogFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface CatalogIndexRequest {
  readonly registryUrl?: string;
  readonly signal?: AbortSignal;
}

export type CatalogState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly blocks: ReadonlyArray<CatalogElement>;
    }
  | { readonly status: "error"; readonly error: CatalogClientError };

export interface CatalogContextValue {
  readonly state: CatalogState;
  readonly retry: () => void;
}

export type CatalogSectionPath =
  | "/components"
  | "/blocks"
  | "/pages"
  | "/collections";

export interface CatalogSection {
  readonly label: string;
  readonly path: CatalogSectionPath;
  readonly description: string;
}
