import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  CatalogClientError,
  createTransportError,
} from "../utils/catalog-errors.js";
import {
  catalogRegistryService,
  type CatalogRegistryService,
} from "../services/catalog-registry.service.js";
import type { CatalogContextValue, CatalogState } from "../types/catalog.js";

export const CatalogContext = createContext<CatalogContextValue | null>(null);

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

  const startRequest = useCallback(() => {
    controllerRef.current?.abort();

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
  }, [registryUrl, service]);

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
        requestOwnerRef.current = null;
      });
    };
  }, [startRequest]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    startRequest();
  }, [startRequest]);
  const contextValue = useMemo<CatalogContextValue>(
    () => ({ state, retry }),
    [retry, state],
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
