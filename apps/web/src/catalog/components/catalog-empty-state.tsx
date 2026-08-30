export interface CatalogEmptyStateProps {
  readonly title: string;
  readonly description: string;
}

export function CatalogEmptyState({
  title,
  description,
}: CatalogEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-[#9eb0a0] bg-[#edf3e9] p-6 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
        Nothing here yet
      </p>
      <h2 className="mt-2 font-serif text-xl font-semibold text-[#17231d] dark:text-white">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#63786a] dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}
