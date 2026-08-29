import type {
  FooterGroup,
  FooterProps,
  FooterSocialLink,
} from "./utilities/types";

export type {
  FooterGroup,
  FooterLink,
  FooterProps,
  FooterSocialLink,
} from "./utilities/types";

const defaultGroups: readonly FooterGroup[] = [
  {
    id: "product",
    label: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#changelog" },
      { label: "Roadmap", href: "#roadmap" },
    ],
  },
  {
    id: "resources",
    label: "Resources",
    links: [
      { label: "Documentation", href: "#docs" },
      { label: "Block standard", href: "#block-standard" },
      { label: "Support", href: "#support" },
    ],
  },
  {
    id: "company",
    label: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Careers", href: "#careers" },
      { label: "Privacy", href: "#privacy" },
      { label: "Terms", href: "#terms" },
    ],
  },
];

const defaultSocialLinks: readonly FooterSocialLink[] = [
  { id: "github", label: "Auren on GitHub", href: "#github" },
  { id: "x", label: "Auren on X", href: "#x" },
  { id: "linkedin", label: "Auren on LinkedIn", href: "#linkedin" },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

function SocialIcon({ id }: { id: FooterSocialLink["id"] }) {
  switch (id) {
    case "github":
      return (
        <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7 0-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
      );
    case "x":
      return (
        <path d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2 3h6.3l4.3 5.7L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
      );
    case "linkedin":
      return (
        <path d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21h-4V9Z" />
      );
  }
}

export function Footer({
  brandName = "Auren",
  tagline = "The versioned block catalog for marketing sites.",
  groups = defaultGroups,
  socialLinks = defaultSocialLinks,
  copyright = "© 2026 Auren. All rights reserved.",
  navigationLabel = "Footer",
  id,
  className,
}: FooterProps) {
  const rootClassName = [
    "w-full border-t border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <footer className={rootClassName} id={id}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
              {brandName}
            </p>
            {tagline ? (
              <p className="mt-2 max-w-xs text-sm text-slate-600 dark:text-slate-300">
                {tagline}
              </p>
            ) : null}
            <ul className="mt-6 flex items-center gap-2">
              {socialLinks.map((social) => (
                <li key={social.id}>
                  <a
                    className={`inline-flex size-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
                    href={social.href}
                  >
                    <svg
                      aria-hidden="true"
                      className="size-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <SocialIcon id={social.id} />
                    </svg>
                    <span className="sr-only">{social.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label={navigationLabel} className="min-w-0">
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <li className="min-w-0" key={group.id}>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {group.label}
                  </h2>
                  <ul className="mt-3 grid gap-2">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <a
                          className={`rounded-sm text-sm text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white ${focusRing}`}
                          href={link.href}
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <p className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {copyright}
        </p>
      </div>
    </footer>
  );
}
