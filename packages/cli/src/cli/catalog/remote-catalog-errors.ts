export class RemoteCatalogError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "RemoteCatalogError";
  }
}

export class InvalidRegistryUrlError extends RemoteCatalogError {
  constructor(readonly value: unknown) {
    super(
      `Invalid Registry URL "${String(value)}": expected an http(s) document root without credentials, query, or fragment`,
    );
    this.name = "InvalidRegistryUrlError";
  }
}

export class RemoteCatalogRequestError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Unable to reach remote Registry resource "${resource}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogRequestError";
  }
}

export class RemoteCatalogHttpError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    const statusLabel = statusText.trim()
      ? `${status} ${statusText.trim()}`
      : String(status);
    super(
      `Remote Registry request failed for "${resource}" at "${url}": HTTP ${statusLabel}`,
    );
    this.name = "RemoteCatalogHttpError";
  }
}

export class RemoteCatalogContentTypeError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    readonly contentType: string | null,
  ) {
    super(
      `Remote Registry resource "${resource}" at "${url}" did not return JSON${contentType === null ? "" : ` (content type: ${contentType})`}`,
    );
    this.name = "RemoteCatalogContentTypeError";
  }
}

export class RemoteCatalogPayloadError extends RemoteCatalogError {
  constructor(
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Invalid remote Registry resource "${resource}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogPayloadError";
  }
}

export class RemoteCatalogDetailError extends RemoteCatalogError {
  constructor(
    readonly id: string,
    readonly resource: string,
    readonly url: string,
    message: string,
    cause?: unknown,
  ) {
    super(
      `Invalid remote Registry detail for "${id}" at "${url}": ${message}`,
      cause,
    );
    this.name = "RemoteCatalogDetailError";
  }
}

export function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split(/\r?\n/, 1)[0]?.trim() || "request failed";
  }

  return String(error).split(/\r?\n/, 1)[0]?.trim() || "request failed";
}
