import type { LocalRegistry, RegistryFilter } from "@auren/registry";
import type { CatalogElement } from "@auren/schemas/catalog";

export type SearchQuery = {
  text?: string;
  filters?: RegistryFilter;
};

export function searchBlocks(
  registry: LocalRegistry,
  query: SearchQuery = {},
): readonly CatalogElement[] {
  const text = query.text?.trim().toLowerCase() ?? "";

  return registry.query(query.filters).filter((element) => {
    if (text.length === 0) {
      return true;
    }

    return (
      element.id.toLowerCase().includes(text) ||
      element.name.toLowerCase().includes(text) ||
      element.description.toLowerCase().includes(text)
    );
  });
}
