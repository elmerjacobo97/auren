import type { CatalogElement } from "@auren/schemas/catalog";
import { CatalogBlockMetadata } from "./catalog-block-metadata.js";
import { CatalogClassificationList } from "./catalog-classification-list.js";

export interface BlockCardProps {
  readonly block: CatalogElement;
}

export function BlockCard({ block }: BlockCardProps) {
  const headingId = `catalog-block-${block.id}`;

  return (
    <article
      aria-labelledby={headingId}
      className="flex h-full flex-col rounded-2xl border border-[#ccd7cc] bg-white p-5 shadow-[0_12px_40px_rgba(33,57,42,0.06)] dark:border-slate-800 dark:bg-slate-900"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[#e3e9e0] pb-4 dark:border-slate-800">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#52705b] dark:text-lime-300">
            {block.id}
          </p>
          <h2
            className="mt-2 font-serif text-2xl font-semibold leading-tight tracking-tight text-[#17231d] dark:text-white"
            id={headingId}
          >
            {block.name}
          </h2>
        </div>
        <span
          aria-hidden="true"
          className="mt-1 size-3 shrink-0 rounded-full bg-[#d6ff57] ring-4 ring-[#edf3e9] dark:ring-slate-800"
        />
      </header>

      <p className="mt-4 text-sm leading-6 text-[#4d6354] dark:text-slate-300">
        {block.description}
      </p>

      <CatalogBlockMetadata block={block} />

      <div className="mt-auto pt-5">
        <CatalogClassificationList label="Styles" values={block.styles} />
        <CatalogClassificationList
          label="Industries"
          values={block.industries}
        />
        <CatalogClassificationList label="Features" values={block.features} />
      </div>
    </article>
  );
}
