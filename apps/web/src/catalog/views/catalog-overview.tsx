import { useCatalog } from "../hooks/use-catalog.js";
import { catalogSections } from "../types/catalog-sections.js";
import { CatalogOverviewSummary } from "../components/catalog-overview-summary.js";
import { CatalogPageIntro } from "../components/catalog-page-intro.js";
import { CatalogSectionLink } from "../components/catalog-section-link.js";

export function CatalogOverview() {
  const { state, retry } = useCatalog();
  const availableSections = catalogSections.filter(
    (section) => section.availability === "available",
  );
  const futureSections = catalogSections.filter(
    (section) => section.availability === "coming-soon",
  );

  return (
    <div className="space-y-12">
      <CatalogPageIntro
        description="A focused index of Auren’s published interface building blocks, with honest seams for everything still on the way."
        eyebrow="Auren / catalog"
        title="Start with something already considered."
      >
        <CatalogOverviewSummary onRetry={retry} state={state} />
      </CatalogPageIntro>

      <section aria-labelledby="published-catalog-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
              Published now
            </p>
            <h2
              className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#17231d] dark:text-white"
              id="published-catalog-heading"
            >
              Browse Blocks
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#63786a] dark:text-slate-400">
            The live catalog starts here. Filter the published index, then open
            a block to preview and install it.
          </p>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {availableSections.map((section) => (
            <li key={section.path}>
              <CatalogSectionLink section={section} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="catalog-roadmap-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#849787] dark:text-slate-500">
              On the roadmap
            </p>
            <h2
              className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#17231d] dark:text-white"
              id="catalog-roadmap-heading"
            >
              More ways to compose
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#63786a] dark:text-slate-400">
            These sections are named now, but they are not published in the
            current Registry snapshot.
          </p>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {futureSections.map((section) => (
            <li key={section.path}>
              <CatalogSectionLink section={section} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
