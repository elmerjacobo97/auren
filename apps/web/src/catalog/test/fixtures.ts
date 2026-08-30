import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";

export function createCatalogElement(
  id: string,
  changes: Record<string, unknown> = {},
): CatalogElement {
  return catalogElementSchema.parse({
    id,
    name: `Block ${id}`,
    description: `Description for ${id}`,
    category: "marketing",
    type: "hero",
    styles: ["minimal"],
    industries: ["saas"],
    features: ["responsive"],
    frameworks: ["react"],
    dependencies: [],
    files: [{ path: "component.tsx", kind: "component" }],
    metadata: {},
    ...changes,
  });
}

export function createDetailElement(
  id: string,
  changes: Record<string, unknown> = {},
): CatalogElement {
  const element = createCatalogElement(id, changes);

  return {
    ...element,
    files: element.files.map((file) => ({
      ...file,
      content: file.kind === "asset" ? "aGVsbG8=" : `source for ${file.path}`,
    })),
  };
}

export function createIndex(blocks: readonly unknown[]) {
  return { schemaVersion: 1, blocks };
}
