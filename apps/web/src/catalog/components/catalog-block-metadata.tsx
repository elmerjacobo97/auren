import type { CatalogElement } from "@auren/schemas/catalog";

export interface CatalogBlockMetadataProps {
  readonly block: CatalogElement;
}

export function CatalogBlockMetadata({ block }: CatalogBlockMetadataProps) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 border-y border-[#e3e9e0] py-4 text-sm dark:border-slate-800">
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
          Category
        </dt>
        <dd className="mt-1 truncate font-semibold text-[#17231d] dark:text-slate-100">
          {block.category}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
          Type
        </dt>
        <dd className="mt-1 truncate font-semibold text-[#17231d] dark:text-slate-100">
          {block.type}
        </dd>
      </div>
      <div className="col-span-2 min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#849787] dark:text-slate-500">
          Framework
        </dt>
        <dd className="mt-1 truncate font-semibold text-[#17231d] dark:text-slate-100">
          {block.frameworks.join(", ")}
        </dd>
      </div>
    </dl>
  );
}
