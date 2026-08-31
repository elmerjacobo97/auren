import { BlockCard } from "../components/block-card.js";
import { CatalogEmptyState } from "../components/catalog-empty-state.js";
import { CatalogFilters } from "../components/catalog-filters.js";
import { CatalogLoadingState } from "../components/catalog-loading-state.js";
import { CatalogPageIntro } from "../components/catalog-page-intro.js";
import { CatalogUnavailableState } from "../components/catalog-unavailable-state.js";
import {
  type CatalogFilterState,
  emptyCatalogFilterState,
  filterCatalogElements,
  formatCatalogFilterSummary,
  hasActiveCatalogFilters,
} from "../filters/catalog-filters.js";
import { useCatalog } from "../hooks/use-catalog.js";

export interface CatalogBlocksProps {
  readonly filters?: CatalogFilterState;
  readonly onFiltersChange?: (value: CatalogFilterState) => void;
  readonly onClearFilters?: () => void;
}

const noop = () => undefined;

export function CatalogBlocks({
  filters = emptyCatalogFilterState,
  onFiltersChange = noop,
  onClearFilters = noop,
}: CatalogBlocksProps) {
  const { state, retry } = useCatalog();
  const filteredBlocks =
    state.status === "success" && state.blocks.length > 0
      ? filterCatalogElements(state.blocks, filters)
      : [];
  const hasFilters = hasActiveCatalogFilters(filters);
  const showNoMatch = hasFilters && filteredBlocks.length === 0;

  return (
    <div className="space-y-8">
      <CatalogPageIntro
        description="Start with the published Registry index. Filter by verified metadata, then open a block for its live preview, source, and install command."
        eyebrow="Auren / blocks"
        title="Choose a block to build from."
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
        <>
          <CatalogFilters
            onChange={onFiltersChange}
            onClear={onClearFilters}
            value={filters}
          />
          <CatalogResultSummary
            filters={filters}
            total={state.blocks.length}
            visible={filteredBlocks.length}
          />
          {showNoMatch ? (
            <CatalogNoMatchState filters={filters} onClear={onClearFilters} />
          ) : null}
          {!showNoMatch ? (
            <ul
              aria-label="Published blocks"
              className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3"
            >
              {filteredBlocks.map((block) => (
                <li key={block.id}>
                  <BlockCard block={block} />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

interface CatalogResultSummaryProps {
  readonly filters: CatalogFilterState;
  readonly total: number;
  readonly visible: number;
}

function CatalogResultSummary({
  filters,
  total,
  visible,
}: CatalogResultSummaryProps) {
  const activeSummary = formatCatalogFilterSummary(filters);

  return (
    <section
      aria-atomic="true"
      aria-live="polite"
      aria-label="Catalog results"
      className="rounded-xl border border-[#ccd7cc] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-sm font-bold text-[#17231d] dark:text-white">
        Showing {visible} of {total} blocks
      </p>
      <p className="mt-1 text-sm leading-6 text-[#63786a] dark:text-slate-400">
        {activeSummary === "All blocks"
          ? "Showing the complete validated index."
          : `Active filters: ${activeSummary}`}
      </p>
    </section>
  );
}

interface CatalogNoMatchStateProps {
  readonly filters: CatalogFilterState;
  readonly onClear: () => void;
}

function CatalogNoMatchState({ filters, onClear }: CatalogNoMatchStateProps) {
  return (
    <section
      aria-labelledby="catalog-no-match-heading"
      className="rounded-2xl border border-dashed border-[#9eb0a0] bg-[#edf3e9] p-6 dark:border-slate-700 dark:bg-slate-900"
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
        Filtered catalog
      </p>
      <h2
        className="mt-2 font-serif text-xl font-semibold text-[#17231d] dark:text-white"
        id="catalog-no-match-heading"
      >
        No blocks match these filters
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#63786a] dark:text-slate-400">
        Try removing one or more criteria, or clear all filters to see every
        published block again.
      </p>
      <p className="mt-3 text-sm font-semibold text-[#4d6354] dark:text-slate-300">
        Active filters: {formatCatalogFilterSummary(filters)}
      </p>
      <button
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[#52705b] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3f5847] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] dark:bg-lime-300 dark:text-slate-950 dark:hover:bg-lime-200 dark:focus-visible:outline-lime-300 motion-reduce:transition-none"
        onClick={onClear}
        type="button"
      >
        Clear all filters
      </button>
    </section>
  );
}
