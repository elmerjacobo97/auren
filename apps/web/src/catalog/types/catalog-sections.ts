import type { CatalogSection } from "./catalog.js";

export const catalogSections = [
  {
    label: "Blocks",
    path: "/blocks",
    description:
      "Published sections and patterns, ready to browse by their verified metadata.",
    availability: "available",
  },
  {
    label: "Components",
    path: "/components",
    description:
      "Reusable interface pieces are coming after the block catalog foundation.",
    availability: "coming-soon",
  },
  {
    label: "Pages",
    path: "/pages",
    description:
      "Complete page compositions will land in a later catalog release.",
    availability: "coming-soon",
  },
  {
    label: "Collections",
    path: "/collections",
    description:
      "Curated groups will appear here once the Collections model is defined.",
    availability: "coming-soon",
  },
] as const satisfies readonly CatalogSection[];
