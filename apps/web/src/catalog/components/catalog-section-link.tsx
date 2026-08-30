import { Link } from "@tanstack/react-router";
import type { CatalogSection } from "../types/catalog.js";

export interface CatalogSectionLinkProps {
  readonly section: CatalogSection;
}

export function CatalogSectionLink({ section }: CatalogSectionLinkProps) {
  return (
    <Link
      className="group flex h-full min-h-44 flex-col justify-between rounded-2xl border border-[#ccd7cc] bg-white p-5 shadow-[0_12px_40px_rgba(33,57,42,0.06)] transition-transform hover:-translate-y-1 hover:border-[#819d87] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#52705b] motion-reduce:transform-none motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600 dark:focus-visible:outline-lime-300"
      to={section.path}
    >
      <span>
        <span className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#52705b] dark:text-lime-300">
            {section.label}
          </span>
          <span
            aria-hidden="true"
            className="text-xl text-[#849787] transition-transform group-hover:translate-x-1 motion-reduce:transition-none"
          >
            ↗
          </span>
        </span>
        <span className="mt-4 block font-serif text-2xl font-semibold leading-tight text-[#17231d] dark:text-white">
          {section.label} collection
        </span>
      </span>
      <span className="mt-6 block text-sm leading-5 text-[#63786a] dark:text-slate-400">
        {section.description}
      </span>
    </Link>
  );
}
