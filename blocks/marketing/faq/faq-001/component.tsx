import type { FaqItem, FaqProps } from "./utilities/types";

export type { FaqItem, FaqProps } from "./utilities/types";

const defaultItems: readonly FaqItem[] = [
  {
    id: "dependencies",
    question: "Do blocks add runtime dependencies to my project?",
    answer:
      "No. Every block is copied source built on React, TypeScript, and Tailwind CSS v4 utility classes. The baseline imports only react and react-dom, and each manifest declares an empty dependency list.",
  },
  {
    id: "dark-mode",
    question: "How is dark mode handled?",
    answer:
      "Blocks that declare dark-mode support Tailwind's class-based dark context on every surface, text color, border, control, and interaction state. Blocks without full coverage simply do not claim the feature.",
  },
  {
    id: "customization",
    question: "Can I customize a block after copying it?",
    answer:
      "Yes. Once a block is copied into your project it is ordinary source code. Props are typed and documented at the top of the component, so you can adapt content, styling, and behavior freely.",
  },
  {
    id: "accessibility",
    question: "Are the blocks accessible?",
    answer:
      "Blocks use native semantic HTML, give every control an accessible name, keep a logical heading hierarchy, and remain fully keyboard-operable with visible focus indicators.",
  },
  {
    id: "updates",
    question: "Do blocks receive updates?",
    answer:
      "New variants ship as new catalog ids, so your copied source never changes underneath you. Upgrade deliberately by pulling a newer variant when you want it.",
  },
];

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

function ChevronIcon() {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function Faq({
  heading = "Frequently asked questions",
  description = "Answers to what teams usually ask before adopting the catalog.",
  items = defaultItems,
  contactLabel = "Contact support",
  contactHref = "#support",
  id,
  className,
}: FaqProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const rootClassName = [
    "w-full bg-white text-slate-950 dark:bg-slate-950 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby={headingId} className={rootClassName} id={id}>
      <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
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

        <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {items.map((item) => (
            <details className="group py-1" key={item.id}>
              <summary
                className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-900 ${focusRing}`}
              >
                <span className="min-w-0">{item.question}</span>
                <span className="text-slate-400 group-open:rotate-180 dark:text-slate-500">
                  <ChevronIcon />
                </span>
              </summary>
              <p className="px-2 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Still have questions?{" "}
          <a
            className={`font-semibold text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-300 ${focusRing} rounded-sm`}
            href={contactHref}
          >
            {contactLabel}
          </a>
        </p>
      </div>
    </section>
  );
}
