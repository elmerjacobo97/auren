import type { StatItem, StatsProps } from "./utilities/types";

export type { StatItem, StatsProps } from "./utilities/types";

const defaultItems: readonly StatItem[] = [
  {
    id: "uptime",
    value: "99.98%",
    label: "Platform uptime",
    detail: "Rolling 90-day availability",
  },
  {
    id: "deploys",
    value: "4,200+",
    label: "Deploys per week",
    detail: "Across every customer workspace",
  },
  {
    id: "latency",
    value: "87ms",
    label: "Median response",
    detail: "Measured at the edge",
  },
  {
    id: "teams",
    value: "1,400",
    label: "Teams onboarded",
    detail: "From solo founders to enterprise",
  },
];

export function Stats({
  heading = "Numbers that hold up in production",
  description = "Measured across the full platform, not cherry-picked for a slide.",
  items = defaultItems,
  id,
  className,
}: StatsProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const rootClassName = [
    "w-full border-y border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby={headingId} className={rootClassName} id={id}>
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
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

        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              key={item.id}
            >
              <figure>
                <p className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {item.value}
                </p>
                <figcaption className="mt-2">
                  <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {item.label}
                  </span>
                  {item.detail ? (
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      {item.detail}
                    </span>
                  ) : null}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
