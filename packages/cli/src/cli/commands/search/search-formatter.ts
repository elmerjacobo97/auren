import type { CatalogElement } from "@auren/schemas/catalog";

export function formatSearchResults(
  matches: readonly CatalogElement[],
): string {
  if (matches.length === 0) {
    return "No matching catalog elements found.\n";
  }

  const countLine =
    matches.length === 1 ? "1 result" : `${matches.length} results`;
  const entries = matches.map((element) =>
    [
      `${element.id} - ${element.name}`,
      `Category: ${element.category}, Type: ${element.type}`,
      element.description,
    ].join("\n"),
  );

  return `${countLine}\n\n${entries.join("\n\n")}\n`;
}
