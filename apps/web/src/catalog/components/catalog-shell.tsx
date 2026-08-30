import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { catalogSections } from "../types/catalog-sections.js";

export interface CatalogShellProps {
  readonly children: ReactNode;
}

export function CatalogShell({ children }: CatalogShellProps) {
  const location = useLocation();

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#f4f1e8] text-[#17231d] dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-[#294235] bg-[#12221c] text-[#f4f1e8]">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            className="group inline-flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6ff57]"
            to="/"
          >
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-[#d6ff57] font-serif text-lg font-bold text-[#12221c] transition-transform group-hover:-rotate-3 motion-reduce:transition-none"
            >
              A
            </span>
            <span className="min-w-0">
              <span className="block truncate font-serif text-lg font-semibold tracking-tight">
                Auren
              </span>
              <span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#a9c0ae]">
                Public catalog
              </span>
            </span>
          </Link>

          <div className="ml-auto text-right text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[#a9c0ae]">
            <span className="hidden sm:block">
              Built for the next interface
            </span>
            <span className="sm:hidden">UI building blocks</span>
          </div>

          <nav
            aria-label="Catalog sections"
            className="w-full border-t border-[#294235] pt-3"
          >
            <ul className="flex flex-wrap gap-2">
              {catalogSections.map((section) => {
                const isActive = location.pathname === section.path;

                return (
                  <li key={section.path}>
                    <Link
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d6ff57] motion-reduce:transition-none",
                        isActive
                          ? "border-[#d6ff57] bg-[#d6ff57] text-[#12221c]"
                          : "border-transparent text-[#d8e4d7] hover:border-[#66816d] hover:bg-[#1d352a] hover:text-white",
                      ].join(" ")}
                      to={section.path}
                    >
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="size-1.5 rounded-full bg-[#12221c]"
                        />
                      ) : null}
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16"
        id="main-content"
      >
        {children}
      </main>

      <footer className="mx-auto w-full max-w-7xl px-4 pb-8 text-xs text-[#63786a] sm:px-6 lg:px-8 dark:text-slate-500">
        Auren catalog · metadata from the public Registry index
      </footer>
    </div>
  );
}
