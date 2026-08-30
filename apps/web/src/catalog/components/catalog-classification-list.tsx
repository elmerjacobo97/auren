export interface CatalogClassificationListProps {
  readonly label: string;
  readonly values: readonly string[];
}

export function CatalogClassificationList({
  label,
  values,
}: CatalogClassificationListProps) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 first:mt-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
        {label}
      </h3>
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={label}>
        {values.map((value) => (
          <li
            className="rounded-full border border-[#cbd8c8] bg-[#f4f8f1] px-2.5 py-1 font-mono text-[0.7rem] text-[#52705b] dark:border-slate-700 dark:bg-slate-800 dark:text-lime-200"
            key={value}
          >
            {value}
          </li>
        ))}
      </ul>
    </div>
  );
}
