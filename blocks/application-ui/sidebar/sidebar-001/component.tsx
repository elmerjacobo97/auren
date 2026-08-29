import { useEffect, useId, useState, type MouseEventHandler } from "react";
import type {
  AdminSidebarAccount,
  AdminSidebarBrand,
  AdminSidebarNavSection,
  AdminSidebarProps,
} from "./utilities/types";
export type {
  AdminSidebarAccount,
  AdminSidebarBrand,
  AdminSidebarNavItem,
  AdminSidebarNavSection,
  AdminSidebarProps,
} from "./utilities/types";

const defaultBrand: AdminSidebarBrand = {
  name: "Auren",
  description: "Admin workspace",
  href: "/",
};

const defaultNavigationSections: readonly AdminSidebarNavSection[] = [
  {
    id: "workspace",
    label: "Workspace",
    items: [
      { id: "overview", label: "Overview", href: "/" },
      { id: "projects", label: "Projects", href: "/projects" },
      { id: "reports", label: "Reports", href: "/reports" },
    ],
  },
  {
    id: "manage",
    label: "Manage",
    items: [
      { id: "team", label: "Team", href: "/team" },
      { id: "settings", label: "Settings", href: "/settings" },
    ],
  },
];

const defaultAccount: AdminSidebarAccount = {
  name: "Auren operator",
  email: "operator@auren.dev",
  profileHref: "/settings/profile",
  profileLabel: "View profile",
  actionLabel: "Sign out",
};

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "A";
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

export function AdminSidebar({
  brand,
  sections = defaultNavigationSections,
  activeItemId = "overview",
  account,
  navigationLabel = "Primary navigation",
  menuLabel = "Open navigation menu",
  closeLabel = "Close navigation menu",
  backdropLabel = "Close navigation menu backdrop",
  id,
  className,
}: AdminSidebarProps) {
  const generatedId = useId();
  const sidebarId = id ?? `admin-sidebar-${generatedId.replaceAll(":", "")}`;
  const [isOpen, setIsOpen] = useState(false);
  const resolvedBrand = { ...defaultBrand, ...brand };
  const resolvedAccount = { ...defaultAccount, ...account };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsOpen(false);
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const closeDrawer = () => setIsOpen(false);
  const handleAccountAction: MouseEventHandler<HTMLButtonElement> = (event) => {
    resolvedAccount.onAction?.(event);
    closeDrawer();
  };
  const rootClassName = [
    "relative flex min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div className="flex w-full min-w-0 flex-col lg:hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
          <button
            aria-controls={sidebarId}
            aria-expanded={isOpen}
            aria-label={menuLabel}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:outline-indigo-400"
            onClick={() => setIsOpen(true)}
            type="button"
          >
            <MenuIcon />
            <span>Menu</span>
          </button>
          <span className="min-w-0 truncate text-sm font-medium text-slate-600 dark:text-slate-300">
            {resolvedBrand.name}
          </span>
        </div>
      </div>

      {isOpen ? (
        <button
          aria-label={backdropLabel}
          className="fixed inset-0 z-30 bg-slate-950/50 hover:bg-slate-950/60 focus-visible:outline-2 focus-visible:outline-indigo-600 dark:bg-slate-950/75 dark:hover:bg-slate-950/80 dark:focus-visible:outline-indigo-400 lg:hidden"
          onClick={closeDrawer}
          type="button"
        />
      ) : null}

      <aside
        aria-label={`${resolvedBrand.name} sidebar`}
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-72 max-w-[calc(100vw-1rem)] flex-col overflow-x-hidden overflow-y-auto border-r border-slate-200 bg-white text-slate-950 shadow-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50 lg:static lg:z-auto lg:flex lg:w-72 lg:shadow-none",
          isOpen ? "flex" : "hidden",
        ].join(" ")}
        id={sidebarId}
      >
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 dark:border-slate-800">
          {resolvedBrand.href ? (
            <a
              className="flex min-w-0 items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:bg-slate-900 dark:focus-visible:outline-indigo-400"
              href={resolvedBrand.href}
              onClick={closeDrawer}
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-sm font-semibold tracking-wide text-white dark:bg-indigo-400 dark:text-slate-950"
              >
                {resolvedBrand.mark ?? "A"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                  {resolvedBrand.name}
                </span>
                {resolvedBrand.description ? (
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {resolvedBrand.description}
                  </span>
                ) : null}
              </span>
            </a>
          ) : (
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-950 text-sm font-semibold tracking-wide text-white dark:bg-indigo-400 dark:text-slate-950"
              >
                {resolvedBrand.mark ?? "A"}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                  {resolvedBrand.name}
                </span>
                {resolvedBrand.description ? (
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                    {resolvedBrand.description}
                  </span>
                ) : null}
              </span>
            </div>
          )}

          <button
            aria-label={closeLabel}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:outline-indigo-400 lg:hidden"
            onClick={closeDrawer}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label={navigationLabel} className="min-w-0 flex-1 px-3 py-5">
          <div className="grid gap-6">
            {sections.map((section) => (
              <div className="min-w-0" key={section.id}>
                {section.label ? (
                  <h2 className="mb-2 truncate px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {section.label}
                  </h2>
                ) : null}
                <ul className="grid min-w-0 gap-1">
                  {section.items.map((item) => {
                    const isActive = item.id === activeItemId;
                    const linkClassName = [
                      "group flex min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-lg border-l-2 px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400",
                      isActive
                        ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-700 dark:border-indigo-400 dark:bg-indigo-400/15 dark:text-indigo-200"
                        : "border-transparent text-slate-700 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white",
                    ].join(" ");

                    return (
                      <li className="min-w-0" key={item.id}>
                        <a
                          aria-current={isActive ? "page" : undefined}
                          className={linkClassName}
                          href={item.href}
                          onClick={closeDrawer}
                          title={item.label}
                        >
                          {item.icon !== undefined && item.icon !== null ? (
                            <span
                              aria-hidden="true"
                              className="flex size-5 shrink-0 items-center justify-center text-current"
                            >
                              {item.icon}
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          {isActive ? (
                            <span className="sr-only">Current page</span>
                          ) : null}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="flex min-w-0 items-center gap-3 px-2 py-2">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {resolvedAccount.avatar ?? getInitials(resolvedAccount.name)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {resolvedAccount.name}
              </span>
              {resolvedAccount.email ? (
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {resolvedAccount.email}
                </span>
              ) : null}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 px-2 pt-2">
            {resolvedAccount.profileHref ? (
              <a
                className="inline-flex min-w-0 flex-1 basis-24 items-center justify-center rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:outline-indigo-400"
                href={resolvedAccount.profileHref}
                onClick={closeDrawer}
              >
                <span className="truncate">
                  {resolvedAccount.profileLabel ?? "View profile"}
                </span>
              </a>
            ) : null}
            <button
              className="inline-flex min-w-0 flex-1 basis-24 items-center justify-center rounded-md border border-transparent px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white dark:focus-visible:outline-indigo-400"
              onClick={handleAccountAction}
              type="button"
            >
              <span className="truncate">
                {resolvedAccount.actionLabel ?? "Sign out"}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
