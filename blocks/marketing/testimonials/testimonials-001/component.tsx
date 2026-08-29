import type { TestimonialItem, TestimonialsProps } from "./utilities/types";

export type { TestimonialItem, TestimonialsProps } from "./utilities/types";

const defaultItems: readonly TestimonialItem[] = [
  {
    id: "mariana",
    quote:
      "We rebuilt our launch page in an afternoon. Every section was accessible out of the box, which used to cost us a full review cycle.",
    author: "Mariana Costa",
    role: "Head of Marketing, Northwind",
  },
  {
    id: "jonas",
    quote:
      "The catalog metadata makes search actually useful. We filter by style and industry, and the results are never noise.",
    author: "Jonas Weber",
    role: "Design Lead, Globex",
  },
  {
    id: "priya",
    quote:
      "Blocks are copied source with no runtime dependencies. Our security review was the shortest it has ever been.",
    author: "Priya Nair",
    role: "Engineering Manager, Umbra Labs",
  },
];

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "A";
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6L12 16.8 6.6 19.7l1.1-6L3.2 9.4l6.1-.8L12 3Z" />
    </svg>
  );
}

export function Testimonials({
  heading = "Teams that stopped rebuilding from scratch",
  description = "What product and marketing teams say after shipping with the catalog.",
  items = defaultItems,
  id,
  className,
}: TestimonialsProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const rootClassName = [
    "w-full bg-slate-50 text-slate-950 dark:bg-slate-900/40 dark:text-slate-50",
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

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <li
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              key={item.id}
            >
              <figure className="flex h-full min-w-0 flex-col">
                <div
                  aria-hidden="true"
                  className="flex gap-0.5 text-amber-500 dark:text-amber-400"
                >
                  <StarIcon />
                  <StarIcon />
                  <StarIcon />
                  <StarIcon />
                  <StarIcon />
                </div>
                <blockquote className="mt-4 flex-1">
                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    “{item.quote}”
                  </p>
                </blockquote>
                <figcaption className="mt-6 flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-200"
                  >
                    {item.initials ?? getInitials(item.author)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                      {item.author}
                    </span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {item.role}
                    </span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
