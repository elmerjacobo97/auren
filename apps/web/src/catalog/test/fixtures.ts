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

export function createIndex(blocks: readonly unknown[]) {
  return { schemaVersion: 1, blocks };
}
