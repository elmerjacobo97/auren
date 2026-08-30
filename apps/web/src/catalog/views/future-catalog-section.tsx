import { CatalogEmptyState } from "../components/catalog-empty-state.js";
import { CatalogPageIntro } from "../components/catalog-page-intro.js";

export type FutureCatalogSection = "components" | "pages" | "collections";

const futureSectionCopy: Record<
  FutureCatalogSection,
  { label: string; description: string }
> = {
  components: {
    label: "Components",
    description:
      "Reusable interface pieces are coming after the block catalog foundation.",
  },
  pages: {
    label: "Pages",
    description:
      "Complete page compositions will land in a later catalog release.",
  },
  collections: {
    label: "Collections",
    description:
      "Curated groups will appear here once the Collections model is defined.",
  },
};

export interface FutureCatalogSectionProps {
  readonly section: FutureCatalogSection;
}

export function FutureCatalogSection({ section }: FutureCatalogSectionProps) {
  const copy = futureSectionCopy[section];

  return (
    <div className="space-y-8">
      <CatalogPageIntro
        description={copy.description}
        eyebrow={`Auren / ${section}`}
        title={`${copy.label}, when they are ready.`}
      />
      <CatalogEmptyState
        description={`The current Registry publishes blocks only. ${copy.label} entries will appear here when their dedicated data model is available.`}
        title={`${copy.label} are not available yet`}
      />
    </div>
  );
}
