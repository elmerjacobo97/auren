import type { PricingPlan, PricingProps } from "./utilities/types";

export type { PricingPlan, PricingProps } from "./utilities/types";

const defaultPlans: readonly PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$0",
    cadence: "/month",
    description: "For side projects and early prototypes.",
    features: [
      "Up to 3 projects",
      "Community support",
      "Catalog search",
      "Basic usage reports",
    ],
    ctaLabel: "Start for free",
    ctaHref: "#start-free",
  },
  {
    id: "team",
    name: "Team",
    price: "$29",
    cadence: "/user/month",
    description: "For product teams shipping marketing pages weekly.",
    features: [
      "Unlimited projects",
      "Priority support",
      "Collections and presets",
      "Advanced usage reports",
      "Shared block library",
    ],
    ctaLabel: "Start team trial",
    ctaHref: "#start-team",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    description: "For organizations with security and scale needs.",
    features: [
      "Single sign-on",
      "Dedicated support",
      "Custom review workflows",
      "Invoice billing",
    ],
    ctaLabel: "Contact sales",
    ctaHref: "#contact-sales",
  },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export function Pricing({
  heading = "Simple pricing that scales with you",
  description = "Every plan includes the full block catalog. Upgrade when your team does.",
  plans = defaultPlans,
  id,
  className,
}: PricingProps) {
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

        <ul className="mt-10 grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => {
            const cardClassName = [
              "flex h-full min-w-0 flex-col rounded-2xl border p-6",
              plan.highlighted
                ? "border-indigo-600 bg-indigo-50/60 dark:border-indigo-400 dark:bg-indigo-400/10"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            ].join(" ");

            return (
              <li className="min-w-0" key={plan.id}>
                <article
                  aria-labelledby={`${plan.id}-plan-name`}
                  className={cardClassName}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className="text-base font-semibold text-slate-950 dark:text-white"
                      id={`${plan.id}-plan-name`}
                    >
                      {plan.name}
                    </h3>
                    {plan.highlighted ? (
                      <span className="rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-indigo-400 dark:text-slate-950">
                        Most popular
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-slate-950 dark:text-white">
                    <span className="text-4xl font-bold tracking-tight">
                      {plan.price}
                    </span>
                    {plan.cadence ? (
                      <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">
                        {plan.cadence}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {plan.description}
                  </p>

                  <ul className="mt-6 grid flex-1 content-start gap-2.5">
                    {plan.features.map((feature) => (
                      <li
                        className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                        key={feature}
                      >
                        <span className="mt-0.5 text-indigo-600 dark:text-indigo-300">
                          <CheckIcon />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {plan.current ? (
                      <button
                        className={`inline-flex w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:disabled:border-slate-800 dark:disabled:bg-slate-900 dark:disabled:text-slate-500 ${focusRing}`}
                        disabled
                        type="button"
                      >
                        Current plan
                      </button>
                    ) : (
                      <a
                        aria-label={`${plan.ctaLabel} — ${plan.name} plan`}
                        className={[
                          "inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold",
                          focusRing,
                          plan.highlighted
                            ? "bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-400 dark:text-slate-950 dark:hover:bg-indigo-300"
                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white",
                        ].join(" ")}
                        href={plan.ctaHref}
                      >
                        {plan.ctaLabel}
                      </a>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
