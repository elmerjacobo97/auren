import { useCatalog } from "../hooks/use-catalog.js";
import { catalogSections } from "../types/catalog-sections.js";
import { CatalogOverviewSummary } from "../components/catalog-overview-summary.js";
import { CatalogPageIntro } from "../components/catalog-page-intro.js";
import { CatalogSectionLink } from "../components/catalog-section-link.js";

export function CatalogOverview() {
  const { state, retry } = useCatalog();

  return (
    <div className="space-y-12">
      <CatalogPageIntro
        description="A focused index of Auren’s published interface building blocks, with honest seams for everything still on the way."
        eyebrow="Auren / catalog"
        title="Start with something already considered."
      >
        <CatalogOverviewSummary onRetry={retry} state={state} />
      </CatalogPageIntro>

      <section aria-labelledby="catalog-sections-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#52705b] dark:text-lime-300">
              Choose a lane
            </p>
            <h2
              className="mt-2 font-serif text-3xl font-semibold tracking-tight text-[#17231d] dark:text-white"
              id="catalog-sections-heading"
            >
              Explore the catalog
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#63786a] dark:text-slate-400">
            Four content types, one shared navigation, and no invented entries.
          </p>
        </div>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catalogSections.map((section) => (
            <li key={section.path}>
              <CatalogSectionLink section={section} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
