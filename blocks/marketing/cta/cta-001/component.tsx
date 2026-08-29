import type { CtaProps } from "./utilities/types";

export type { CtaAction, CtaProps } from "./utilities/types";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:focus-visible:outline-indigo-300";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </svg>
  );
}

export function Cta({
  eyebrow = "Ready when you are",
  heading = "Start shipping landing pages from proven blocks",
  description = "Copy a block, change the copy, and publish. Your next campaign does not need another blank page.",
  primaryAction = { label: "Create free account", href: "#signup" },
  secondaryAction = { label: "Talk to sales", href: "#sales" },
  footnote = "Includes the full catalog on every plan.",
  id,
  className,
}: CtaProps) {
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
        <div className="relative overflow-hidden rounded-3xl bg-indigo-600 px-6 py-12 text-white sm:px-12 lg:py-16 dark:bg-indigo-500 dark:text-slate-950">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 right-0 size-72 text-indigo-500/60 dark:text-indigo-300/40"
            fill="currentColor"
            viewBox="0 0 200 200"
          >
            <path d="M42.8-58.6C55.4-49.7 65.4-36.5 70.6-21.3 75.8-6.1 76.2 11.1 69.7 25.1 63.2 39.1 49.8 49.9 35.1 57.3 20.4 64.7 4.4 68.7-12.3 66.8-29 64.9-46.4 57.1-57.1 43.6-67.8 30.1-71.8 10.9-69.4-7.1-67-25.1-58.2-41.9-45.2-51.3-32.2-60.7-15-62.7 1.6-64.9 18.2-67.1 30.2-67.5 42.8-58.6Z" />
          </svg>

          <div className="relative max-w-2xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100 dark:text-indigo-900">
                {eyebrow}
              </p>
            ) : null}
            <h2
              className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
              id={headingId}
            >
              {heading}
            </h2>
            <p className="mt-4 text-base text-indigo-100 dark:text-indigo-900">
              {description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:bg-slate-950 dark:text-indigo-300 dark:hover:bg-slate-900 ${focusRing}`}
                href={primaryAction.href}
              >
                {primaryAction.label}
                <ArrowIcon />
              </a>
              <a
                className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-indigo-200/60 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500/60 dark:border-indigo-900/30 dark:text-slate-950 dark:hover:bg-indigo-400/60 ${focusRing}`}
                href={secondaryAction.href}
              >
                {secondaryAction.label}
              </a>
            </div>

            {footnote ? (
              <p className="mt-4 text-xs text-indigo-100 dark:text-indigo-900">
                {footnote}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
