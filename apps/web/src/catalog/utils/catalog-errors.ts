export type CatalogClientErrorCode =
  | "invalid-endpoint"
  | "transport"
  | "http"
  | "content-type"
  | "malformed-json"
  | "invalid-index";

export class CatalogClientError extends Error {
  constructor(
    readonly code: CatalogClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CatalogClientError";
  }
}

export function createInvalidEndpointError(cause?: unknown) {
  return new CatalogClientError(
    "invalid-endpoint",
    "The configured Registry URL must be an HTTP(S) document root without credentials, query, or fragment.",
    cause === undefined ? undefined : { cause },
  );
}

export function createInvalidIndexError() {
  return new CatalogClientError(
    "invalid-index",
    "The Registry index envelope was invalid.",
  );
}

export function createTransportError(cause?: unknown) {
  return new CatalogClientError(
    "transport",
    "The Registry index request could not be completed.",
    cause === undefined ? undefined : { cause },
  );
}
