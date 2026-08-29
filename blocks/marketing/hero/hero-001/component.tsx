import type { HeroProps } from "./utilities/types";

export type { HeroCta, HeroProps } from "./utilities/types";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

function HeroVisual() {
  return (
    <svg
      aria-hidden="true"
      className="w-full"
      fill="none"
      viewBox="0 0 480 320"
    >
      <rect
        className="fill-slate-100 dark:fill-slate-900"
        height="320"
        rx="16"
        width="480"
      />
      <rect
        className="fill-white dark:fill-slate-950"
        height="256"
        rx="12"
        stroke="currentColor"
        strokeOpacity="0.08"
        width="416"
        x="32"
        y="32"
      />
      <rect
        className="fill-indigo-600 dark:fill-indigo-400"
        height="10"
        rx="5"
        width="128"
        x="56"
        y="64"
      />
      <rect
        className="fill-slate-300 dark:fill-slate-700"
        height="8"
        rx="4"
        width="208"
        x="56"
        y="88"
      />
      <rect
        className="fill-indigo-200 dark:fill-indigo-400/40"
        height="120"
        rx="8"
        width="176"
        x="56"
        y="120"
      />
      <rect
        className="fill-slate-200 dark:fill-slate-800"
        height="120"
        rx="8"
        width="176"
        x="248"
        y="120"
      />
      <rect
        className="fill-indigo-600 dark:fill-indigo-400"
        height="40"
        rx="8"
        width="96"
        x="56"
        y="256"
      />
      <rect
        className="fill-slate-300 dark:fill-slate-700"
        height="40"
        rx="8"
        width="96"
        x="168"
        y="256"
      />
    </svg>
  );
}

export function Hero({
  eyebrow = "Now in public beta",
  title = "Ship your product pages without the busywork",
  description = "Auren turns your component blocks into a searchable, versioned catalog so every landing page starts from proven, accessible sections.",
  primaryCta = { label: "Start building", href: "#start" },
  secondaryCta = { label: "Browse the catalog", href: "#catalog" },
  footnote = "Free for small teams. No credit card required.",
  id,
  className,
}: HeroProps) {
  const rootClassName = [
    "w-full bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      aria-labelledby={id ? `${id}-title` : undefined}
      className={rootClassName}
      id={id}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-12 lg:py-20">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-300">
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl dark:text-white"
            id={id ? `${id}-title` : undefined}
          >
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            {description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              className={`inline-flex min-h-11 items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300 ${focusRing}`}
              href={primaryCta.href}
            >
              {primaryCta.label}
            </a>
            <a
              className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white ${focusRing}`}
              href={secondaryCta.href}
            >
              {secondaryCta.label}
            </a>
          </div>
          {footnote ? (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              {footnote}
            </p>
          ) : null}
        </div>

        <div
          aria-hidden="true"
          className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 text-slate-950 shadow-sm dark:border-slate-800 dark:text-slate-50"
        >
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
