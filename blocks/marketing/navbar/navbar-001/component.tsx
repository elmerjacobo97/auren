import { useId, useState } from "react";
import type {
  NavbarBrand,
  NavbarCta,
  NavbarLink,
  NavbarProps,
} from "./utilities/types";

export type {
  NavbarBrand,
  NavbarCta,
  NavbarLink,
  NavbarProps,
} from "./utilities/types";

const defaultBrand: NavbarBrand = {
  name: "Auren",
  href: "/",
};

const defaultLinks: readonly NavbarLink[] = [
  { id: "features", label: "Features", href: "#features" },
  { id: "pricing", label: "Pricing", href: "#pricing" },
  { id: "docs", label: "Docs", href: "#docs" },
  { id: "changelog", label: "Changelog", href: "#changelog" },
];

const defaultCta: NavbarCta = {
  label: "Get started",
  href: "#start",
};

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

function BrandMark() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2 22 12 12 22 2 12Z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar({
  brand,
  links = defaultLinks,
  cta = defaultCta,
  activeLinkId,
  navigationLabel = "Main",
  menuLabel = "Open main menu",
  closeLabel = "Close main menu",
  id,
  className,
}: NavbarProps) {
  const generatedId = useId();
  const menuId = id ?? `navbar-menu-${generatedId.replaceAll(":", "")}`;
  const [isOpen, setIsOpen] = useState(false);
  const resolvedBrand = { ...defaultBrand, ...brand };
  const rootClassName = [
    "w-full border-b border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={rootClassName}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <a
          className={`flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-900 ${focusRing}`}
          href={resolvedBrand.href}
        >
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white dark:bg-indigo-400 dark:text-slate-950"
          >
            <BrandMark />
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
            {resolvedBrand.name}
          </span>
        </a>

        <nav aria-label={navigationLabel} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => {
              const isActive = link.id === activeLinkId;

              return (
                <li key={link.id}>
                  <a
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "block rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-offset-2",
                      focusRing,
                      isActive
                        ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white",
                    ].join(" ")}
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            className={`hidden rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 sm:inline-block ${focusRing}`}
            href={cta.href}
          >
            {cta.label}
          </a>
          <button
            aria-controls={menuId}
            aria-expanded={isOpen}
            aria-label={isOpen ? closeLabel : menuLabel}
            className={`inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white md:hidden ${focusRing}`}
            onClick={() => setIsOpen((open) => !open)}
            type="button"
          >
            {isOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {isOpen ? (
        <nav
          aria-label={`${navigationLabel} (mobile)`}
          className="border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-950"
          id={menuId}
        >
          <ul className="grid gap-1 px-4 py-3">
            {links.map((link) => {
              const isActive = link.id === activeLinkId;

              return (
                <li key={link.id}>
                  <a
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      "block rounded-md px-3 py-2.5 text-sm font-medium",
                      focusRing,
                      isActive
                        ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white",
                    ].join(" ")}
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
            <li className="pt-2">
              <a
                className={`block rounded-lg bg-indigo-600 px-3.5 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 ${focusRing}`}
                href={cta.href}
              >
                {cta.label}
              </a>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
