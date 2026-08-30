import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  CatalogClientError,
  createInvalidDetailError,
  createTransportError,
} from "../utils/catalog-errors.js";
import {
  catalogRegistryService,
  type CatalogRegistryService,
} from "../services/catalog-registry.service.js";
import { resolveRegistryDocumentRoot } from "../utils/catalog-url.js";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { CatalogContextValue, CatalogState } from "../types/catalog.js";
import { CatalogContext } from "./catalog-context.js";

export interface CatalogProviderProps extends PropsWithChildren {
  readonly registryUrl?: string;
  readonly service?: CatalogRegistryService;
}

export function CatalogProvider({
  children,
  registryUrl,
  service = catalogRegistryService,
}: CatalogProviderProps) {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const mountedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestOwnerRef = useRef<(() => void) | null>(null);
  const requestIdRef = useRef(0);
  const detailCacheRef = useRef(new Map<string, CatalogElement>());
  const detailRequestsRef = useRef(new Map<string, Promise<CatalogElement>>());
  const detailControllersRef = useRef(new Map<string, AbortController>());

  const cancelDetailRequests = useCallback(() => {
    for (const controller of detailControllersRef.current.values()) {
      controller.abort();
    }

    detailControllersRef.current.clear();
    detailRequestsRef.current.clear();
    detailCacheRef.current.clear();
  }, []);

  const startRequest = useCallback(() => {
    controllerRef.current?.abort();
    cancelDetailRequests();

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current = controller;
    const request =
      registryUrl === undefined
        ? { signal: controller.signal }
        : { registryUrl, signal: controller.signal };

    void service.loadIndex(request).then(
      (blocks) => {
        if (mountedRef.current && requestIdRef.current === requestId) {
          setState({ status: "success", blocks });
        }
      },
      (error: unknown) => {
        if (mountedRef.current && requestIdRef.current === requestId) {
          setState({ status: "error", error: toCatalogError(error) });
        }
      },
    );
  }, [cancelDetailRequests, registryUrl, service]);

  const loadBlockDetail = useCallback(
    async (id: string): Promise<CatalogElement> => {
      const currentState = state;

      if (currentState.status !== "success") {
        throw createInvalidDetailError(
          "A block detail cannot load before the Registry index succeeds.",
        );
      }

      const indexedElement = currentState.blocks.find(
        (block) => block.id === id,
      );

      if (indexedElement === undefined) {
        throw createInvalidDetailError(
          "The requested block is not present in the Registry index.",
        );
      }

      const documentRoot = resolveRegistryDocumentRoot(registryUrl);
      const cacheKey = `${documentRoot}\u0000${id}`;
      const cachedDetail = detailCacheRef.current.get(cacheKey);

      if (cachedDetail !== undefined) {
        return cachedDetail;
      }

      const pendingRequest = detailRequestsRef.current.get(cacheKey);

      if (pendingRequest !== undefined) {
        return pendingRequest;
      }

      const controller = new AbortController();
      detailControllersRef.current.set(cacheKey, controller);
      const detailRequest =
        registryUrl === undefined
          ? { id, indexedElement, signal: controller.signal }
          : { registryUrl, id, indexedElement, signal: controller.signal };
      const request = service.loadDetail(detailRequest).then((detail) => {
        if (mountedRef.current) {
          detailCacheRef.current.set(cacheKey, detail);
        }

        return detail;
      });

      detailRequestsRef.current.set(cacheKey, request);
      void request.then(
        () => {
          if (detailRequestsRef.current.get(cacheKey) === request) {
            detailRequestsRef.current.delete(cacheKey);
            detailControllersRef.current.delete(cacheKey);
          }
        },
        () => {
          if (detailRequestsRef.current.get(cacheKey) === request) {
            detailRequestsRef.current.delete(cacheKey);
            detailControllersRef.current.delete(cacheKey);
          }
        },
      );

      return request;
    },
    [registryUrl, service, state],
  );

  const retryBlockDetail = useCallback(
    (id: string) => {
      const documentRoot = resolveRegistryDocumentRoot(registryUrl);
      const cacheKey = `${documentRoot}\u0000${id}`;
      detailControllersRef.current.get(cacheKey)?.abort();
      detailControllersRef.current.delete(cacheKey);
      detailRequestsRef.current.delete(cacheKey);
      detailCacheRef.current.delete(cacheKey);
    },
    [registryUrl],
  );

  useEffect(() => {
    mountedRef.current = true;

    if (requestOwnerRef.current !== startRequest) {
      requestOwnerRef.current = startRequest;
      setState({ status: "loading" });
      startRequest();
    }

    return () => {
      mountedRef.current = false;

      queueMicrotask(() => {
        if (mountedRef.current || requestOwnerRef.current !== startRequest) {
          return;
        }

        controllerRef.current?.abort();
        controllerRef.current = null;
        cancelDetailRequests();
        requestOwnerRef.current = null;
      });
    };
  }, [cancelDetailRequests, startRequest]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    startRequest();
  }, [startRequest]);
  const contextValue = useMemo<CatalogContextValue>(
    () => ({ state, retry, loadBlockDetail, retryBlockDetail }),
    [loadBlockDetail, retry, retryBlockDetail, state],
  );

  return (
    <CatalogContext.Provider value={contextValue}>
      {children}
    </CatalogContext.Provider>
  );
}

function toCatalogError(error: unknown): CatalogClientError {
  if (error instanceof CatalogClientError) {
    return error;
  }

  return createTransportError(error);
}
