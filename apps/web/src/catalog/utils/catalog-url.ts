import { createInvalidEndpointError } from "./catalog-errors.js";

export const DEFAULT_REGISTRY_URL = "https://registry.auren.dev/";
export const REGISTRY_INDEX_RESOURCE = "registry.json";

export function resolveRegistryDocumentRoot(
  configuredUrl: string | undefined = import.meta.env.VITE_AUREN_REGISTRY_URL,
): string {
  return normalizeRegistryDocumentRoot(configuredUrl ?? DEFAULT_REGISTRY_URL);
}

export function normalizeRegistryDocumentRoot(value: string): string {
  if (value.length === 0 || value.trim() !== value) {
    throw createInvalidEndpointError();
  }

  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch (error) {
    throw createInvalidEndpointError(error);
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw createInvalidEndpointError();
  }

  const pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = `${pathname}/`;

  return parsed.toString();
}

export function resolveRegistryIndexUrl(
  documentRoot = resolveRegistryDocumentRoot(),
): string {
  return new URL(
    REGISTRY_INDEX_RESOURCE,
    normalizeRegistryDocumentRoot(documentRoot),
  ).toString();
}
