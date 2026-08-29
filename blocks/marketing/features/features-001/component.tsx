import type { FeatureItem, FeaturesProps } from "./utilities/types";

export type { FeatureItem, FeaturesProps } from "./utilities/types";

const defaultItems: readonly FeatureItem[] = [
  {
    id: "catalog",
    title: "Versioned block catalog",
    description:
      "Every section is a versioned block with taxonomy-accurate metadata, so search and filters always have real signal.",
    icon: "layers",
  },
  {
    id: "accessible",
    title: "Accessible by default",
    description:
      "Semantic HTML, keyboard-operable controls, and visible focus states come with every block from day one.",
    icon: "shield",
  },
  {
    id: "responsive",
    title: "Mobile-first layouts",
    description:
      "Base layouts are authored for a 320-pixel viewport and adapt cleanly through desktop widths.",
    icon: "globe",
  },
  {
    id: "fast",
    title: "Zero-dependency source",
    description:
      "Blocks are copied source built on React and Tailwind utilities, with no runtime packages to install.",
    icon: "bolt",
  },
  {
    id: "insights",
    title: "Usage insights",
    description:
      "Track which blocks ship to production and double down on the sections that convert.",
    icon: "chart",
  },
  {
    id: "integrations",
    title: "Framework ready",
    description:
      "A stable manifest contract keeps blocks portable across tooling, previews, and future integrations.",
    icon: "plug",
  },
];

const iconPaths: Record<FeatureItem["icon"], string> = {
  bolt: "M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z",
  shield: "M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3Z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  plug: "M9 3v5m6-5v5M7 8h10v3a5 5 0 0 1-10 0V8Zm5 8v5",
  layers: "m12 3 9 5-9 5-9-5 9-5Zm-9 9.5 9 5 9-5",
  globe:
    "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm-9 9h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z",
};

export function Features({
  heading = "Everything a landing page needs",
  description = "Composable sections with the quality bar already raised: responsive, accessible, and honest about what they claim.",
  items = defaultItems,
  id,
  className,
}: FeaturesProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const rootClassName = [
    "w-full bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby={headingId} className={rootClassName} id={id}>
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="max-w-2xl">
          <h2
            className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white"
            id={headingId}
          >
            {heading}
          </h2>
          {description ? (
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              key={item.id}
            >
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300"
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                  viewBox="0 0 24 24"
                >
                  <path d={iconPaths[item.icon]} />
                </svg>
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-950 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {item.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
