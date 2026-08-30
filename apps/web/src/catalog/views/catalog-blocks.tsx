import { BlockCard } from "../components/block-card.js";
import { CatalogEmptyState } from "../components/catalog-empty-state.js";
import { CatalogLoadingState } from "../components/catalog-loading-state.js";
import { CatalogPageIntro } from "../components/catalog-page-intro.js";
import { CatalogUnavailableState } from "../components/catalog-unavailable-state.js";
import { useCatalog } from "../hooks/use-catalog.js";

export function CatalogBlocks() {
  const { state, retry } = useCatalog();

  return (
    <div className="space-y-8">
      <CatalogPageIntro
        description="Browse the published block inventory by verified metadata. Source code, detail payloads, filters, and installation actions stay outside this first catalog view."
        eyebrow="Auren / blocks"
        title="The block library, in plain view."
      />

      {state.status === "loading" ? <CatalogLoadingState /> : null}
      {state.status === "error" ? (
        <CatalogUnavailableState onRetry={retry} />
      ) : null}
      {state.status === "success" && state.blocks.length === 0 ? (
        <CatalogEmptyState
          description="The Registry answered successfully, but its block list is empty. Check back when the first published block is ready."
          title="No blocks published yet"
        />
      ) : null}
      {state.status === "success" && state.blocks.length > 0 ? (
        <ul
          aria-label="Published blocks"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {state.blocks.map((block) => (
            <li key={block.id}>
              <BlockCard block={block} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
