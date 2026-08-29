import type { LogoCloudItem, LogoCloudProps } from "./utilities/types";

export type { LogoCloudItem, LogoCloudProps } from "./utilities/types";

const defaultItems: readonly LogoCloudItem[] = [
  { id: "northwind", name: "Northwind", mark: "diamond" },
  { id: "acme", name: "Acme Corp", mark: "circle" },
  { id: "globex", name: "Globex", mark: "triangle" },
  { id: "initech", name: "Initech", mark: "hexagon" },
  { id: "umbra", name: "Umbra Labs", mark: "ring" },
  { id: "vertex", name: "Vertex", mark: "bars" },
];

function LogoMark({ mark }: { mark: LogoCloudItem["mark"] }) {
  switch (mark) {
    case "diamond":
      return <path d="M12 3 21 12 12 21 3 12Z" />;
    case "circle":
      return <circle cx="12" cy="12" r="8" />;
    case "triangle":
      return <path d="M12 4 21 19H3Z" />;
    case "hexagon":
      return <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9Z" />;
    case "ring":
      return (
        <path
          d="M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
          fillRule="evenodd"
        />
      );
    case "bars":
      return <path d="M4 6h16v3H4Zm0 4.5h10v3H4ZM4 15h13v3H4Z" />;
  }
}

export function LogoCloud({
  heading = "Trusted by teams that ship fast",
  description = "Product and platform teams use these blocks as their starting point.",
  items = defaultItems,
  id,
  className,
}: LogoCloudProps) {
  const headingId = id ? `${id}-heading` : undefined;
  const rootClassName = [
    "w-full border-y border-slate-200 bg-slate-50 text-slate-950 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-50",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby={headingId} className={rootClassName} id={id}>
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <h2
            className="text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl dark:text-white"
            id={headingId}
          >
            {heading}
          </h2>
          {description ? (
            <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {items.map((item) => (
            <li
              className="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-3"
              key={item.id}
            >
              <svg
                aria-hidden="true"
                className="size-5 shrink-0 fill-slate-400 dark:fill-slate-500"
                viewBox="0 0 24 24"
              >
                <LogoMark mark={item.mark} />
              </svg>
              <span className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                {item.name}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
