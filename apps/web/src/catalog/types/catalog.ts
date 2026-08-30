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

export interface CatalogDetailRequest {
  readonly registryUrl?: string;
  readonly id: string;
  readonly indexedElement: CatalogElement;
  readonly signal?: AbortSignal;
}

export type CatalogState =
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly blocks: ReadonlyArray<CatalogElement>;
    }
  | { readonly status: "error"; readonly error: CatalogClientError };

export type CatalogDetailState =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly block: CatalogElement }
  | { readonly status: "not-found"; readonly id: string }
  | { readonly status: "error"; readonly error: CatalogClientError };

export interface CatalogContextValue {
  readonly state: CatalogState;
  readonly retry: () => void;
  readonly loadBlockDetail: (id: string) => Promise<CatalogElement>;
  readonly retryBlockDetail: (id: string) => void;
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
