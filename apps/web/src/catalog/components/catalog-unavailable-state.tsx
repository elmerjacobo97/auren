export interface CatalogUnavailableStateProps {
  readonly onRetry: () => void;
}

export function CatalogUnavailableState({
  onRetry,
}: CatalogUnavailableStateProps) {
  return (
    <div
      aria-live="assertive"
      className="rounded-2xl border border-[#d9b8a7] bg-[#fff8f3] p-6 shadow-[0_12px_40px_rgba(111,58,35,0.06)] dark:border-rose-900 dark:bg-rose-950/30"
      role="alert"
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a85135] dark:text-rose-300">
        Registry unavailable
      </p>
      <h2 className="mt-2 font-serif text-xl font-semibold text-[#4b261c] dark:text-rose-100">
        The catalog could not be loaded.
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#79584d] dark:text-rose-200/80">
        The published index is unavailable or invalid. Try again to request a
        fresh copy; the page will not treat this failure as an empty catalog.
      </p>
      <button
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-md bg-[#4b261c] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#6b3325] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4b261c] motion-reduce:transition-none dark:bg-rose-200 dark:text-rose-950 dark:hover:bg-white dark:focus-visible:outline-rose-200"
        onClick={onRetry}
        type="button"
      >
        Retry loading
      </button>
    </div>
  );
}
