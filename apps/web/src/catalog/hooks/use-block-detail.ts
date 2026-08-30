import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogElement } from "@auren/schemas/catalog";
import { useCatalog } from "./use-catalog.js";
import {
  CatalogClientError,
  createDetailTransportError,
} from "../utils/catalog-errors.js";

export type BlockDetailViewState =
  | { readonly status: "index-loading" }
  | { readonly status: "index-error"; readonly error: CatalogClientError }
  | { readonly status: "not-found"; readonly id: string }
  | {
      readonly status: "detail-loading";
      readonly indexedBlock: CatalogElement;
    }
  | {
      readonly status: "detail-error";
      readonly indexedBlock: CatalogElement;
      readonly error: CatalogClientError;
    }
  | { readonly status: "success"; readonly block: CatalogElement };

export interface BlockDetailViewModel {
  readonly state: BlockDetailViewState;
  readonly retryIndex: () => void;
  readonly retryDetail: () => void;
}

export function useBlockDetail(id: string): BlockDetailViewModel {
  const {
    state: catalogState,
    retry: retryIndex,
    loadBlockDetail,
    retryBlockDetail,
  } = useCatalog();
  const [attempt, setAttempt] = useState(0);
  const attemptRef = useRef(attempt);
  useEffect(() => {
    attemptRef.current = attempt;
  }, [attempt]);
  const [detailState, setDetailState] = useState<{
    readonly id: string;
    readonly state:
      | { readonly status: "loading" }
      | { readonly status: "success"; readonly block: CatalogElement }
      | { readonly status: "error"; readonly error: CatalogClientError };
  }>({ id, state: { status: "loading" } });

  const indexedBlock =
    catalogState.status === "success"
      ? catalogState.blocks.find((block) => block.id === id)
      : undefined;

  useEffect(() => {
    if (catalogState.status !== "success" || indexedBlock === undefined) {
      return;
    }

    let active = true;
    const requestAttempt = attempt;
    setDetailState({ id, state: { status: "loading" } });

    void loadBlockDetail(id).then(
      (block) => {
        if (active && attemptRef.current === requestAttempt) {
          setDetailState({ id, state: { status: "success", block } });
        }
      },
      (error: unknown) => {
        if (active && attemptRef.current === requestAttempt) {
          setDetailState({
            id,
            state: { status: "error", error: toDetailError(error) },
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [attempt, catalogState, id, indexedBlock, loadBlockDetail]);

  const retryDetail = useCallback(() => {
    retryBlockDetail(id);
    setDetailState({ id, state: { status: "loading" } });
    setAttempt((current) => current + 1);
  }, [id, retryBlockDetail]);

  if (catalogState.status === "loading") {
    return { state: { status: "index-loading" }, retryIndex, retryDetail };
  }

  if (catalogState.status === "error") {
    return {
      state: { status: "index-error", error: catalogState.error },
      retryIndex,
      retryDetail,
    };
  }

  if (indexedBlock === undefined) {
    return { state: { status: "not-found", id }, retryIndex, retryDetail };
  }

  if (detailState.id !== id || detailState.state.status === "loading") {
    return {
      state: { status: "detail-loading", indexedBlock },
      retryIndex,
      retryDetail,
    };
  }

  if (detailState.state.status === "error") {
    return {
      state: {
        status: "detail-error",
        indexedBlock,
        error: detailState.state.error,
      },
      retryIndex,
      retryDetail,
    };
  }

  return {
    state: { status: "success", block: detailState.state.block },
    retryIndex,
    retryDetail,
  };
}

function toDetailError(error: unknown): CatalogClientError {
  if (error instanceof CatalogClientError) {
    return error;
  }

  return createDetailTransportError(error);
}
