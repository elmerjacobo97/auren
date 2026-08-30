import type { CatalogState } from "../types/catalog.js";
import { CatalogUnavailableState } from "./catalog-unavailable-state.js";

export interface CatalogOverviewSummaryProps {
  readonly state: CatalogState;
  readonly onRetry: () => void;
}

export function CatalogOverviewSummary({
  state,
  onRetry,
}: CatalogOverviewSummaryProps) {
  const blockCount = state.status === "success" ? state.blocks.length : null;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
        <div className="rounded-2xl bg-[#12221c] p-6 text-[#f4f1e8] shadow-[0_18px_50px_rgba(18,34,28,0.16)] dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b8cbb8]">
            The index is the contract
          </p>
          <p className="mt-3 max-w-2xl font-serif text-2xl leading-tight text-white sm:text-3xl">
            Browse the metadata first. Preview and installation belong to the
            next layer.
          </p>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#c5d4c5]">
            Every card below comes from the public Registry index and is
            validated before it reaches the page.
          </p>
        </div>
        <aside className="rounded-2xl border border-[#ccd7cc] bg-[#eaf2e5] p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
            Published blocks
          </p>
          <p className="mt-3 font-mono text-5xl font-bold tracking-tight text-[#17231d] dark:text-white">
            {blockCount ?? "—"}
          </p>
          <p className="mt-2 text-sm leading-5 text-[#63786a] dark:text-slate-400">
            {state.status === "success"
              ? "Available in this Registry snapshot"
              : "Waiting for the Registry snapshot"}
          </p>
        </aside>
      </div>

      {state.status === "loading" ? (
        <div className="mt-4">
          <p
            aria-live="polite"
            className="text-sm font-semibold text-[#52705b] dark:text-lime-300"
            role="status"
          >
            Checking the published index…
          </p>
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="mt-4">
          <CatalogUnavailableState onRetry={onRetry} />
        </div>
      ) : null}
      {state.status === "success" && blockCount === 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#52705b] dark:text-lime-300">
            The Registry is valid, but no blocks have been published yet.
          </p>
        </div>
      ) : null}
    </>
  );
}
