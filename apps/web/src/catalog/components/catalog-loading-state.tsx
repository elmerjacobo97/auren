export function CatalogLoadingState() {
  return (
    <div
      aria-live="polite"
      className="rounded-2xl border border-[#cfd8cc] bg-white/70 p-6 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900/70"
      role="status"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-1 size-3 shrink-0 rounded-full bg-[#d6ff57] motion-safe:animate-pulse"
        />
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#17231d] dark:text-white">
            Reading the published catalog
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#63786a] dark:text-slate-400">
            We are checking the public Registry index. No block metadata is
            shown until the complete index is validated.
          </p>
        </div>
      </div>
    </div>
  );
}
