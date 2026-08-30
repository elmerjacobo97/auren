export type CatalogClientErrorCode =
  | "invalid-endpoint"
  | "transport"
  | "http"
  | "content-type"
  | "malformed-json"
  | "invalid-index"
  | "detail-transport"
  | "detail-http"
  | "detail-content-type"
  | "detail-malformed-json"
  | "invalid-detail";

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

export function createDetailTransportError(cause?: unknown) {
  return new CatalogClientError(
    "detail-transport",
    "The selected Registry detail request could not be completed.",
    cause === undefined ? undefined : { cause },
  );
}

export function createDetailHttpError(status: number) {
  return new CatalogClientError(
    "detail-http",
    `The selected Registry detail request failed with HTTP ${status}.`,
  );
}

export function createDetailContentTypeError() {
  return new CatalogClientError(
    "detail-content-type",
    "The selected Registry detail response was not JSON.",
  );
}

export function createDetailMalformedJsonError(cause?: unknown) {
  return new CatalogClientError(
    "detail-malformed-json",
    "The selected Registry detail response was malformed JSON.",
    cause === undefined ? undefined : { cause },
  );
}

export function createInvalidDetailError(
  message = "The Registry detail payload was invalid.",
  cause?: unknown,
) {
  return new CatalogClientError(
    "invalid-detail",
    message,
    cause === undefined ? undefined : { cause },
  );
}
