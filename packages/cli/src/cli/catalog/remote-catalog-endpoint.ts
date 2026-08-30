import type { RemoteFetch } from "./remote-catalog-transport.js";
import { InvalidRegistryUrlError } from "./remote-catalog-errors.js";

export const DEFAULT_REGISTRY_URL = "https://registry.auren.dev";
export const DEFAULT_REMOTE_CATALOG_TIMEOUT_MS = 10_000;
export const MAX_REMOTE_CATALOG_TIMEOUT_MS = 60_000;

export type RegistryUrlInput = string | URL;

export interface RemoteCatalogSourceOptions {
  readonly registryUrl?: RegistryUrlInput;
  readonly fetch?: RemoteFetch;
  readonly fetchImpl?: RemoteFetch;
  readonly timeoutMs?: number;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function resolveRegistryUrl(
  registryUrl?: RegistryUrlInput,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return normalizeRegistryUrl(
    registryUrl ?? env.AUREN_REGISTRY_URL ?? DEFAULT_REGISTRY_URL,
  );
}

export function normalizeRegistryUrl(value: RegistryUrlInput): string {
  const input = typeof value === "string" ? value : value.toString();

  if (input.length === 0 || input.trim() !== input) {
    throw new InvalidRegistryUrlError(value);
  }

  let parsed: URL;

  try {
    parsed = new URL(input);
  } catch {
    throw new InvalidRegistryUrlError(value);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new InvalidRegistryUrlError(value);
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = `${pathname}/`;

  return parsed.toString();
}

export function normalizeTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REMOTE_CATALOG_TIMEOUT_MS;
  }

  return Math.min(
    Math.max(Math.floor(value), 1),
    MAX_REMOTE_CATALOG_TIMEOUT_MS,
  );
}
