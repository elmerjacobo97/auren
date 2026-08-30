import {
  blockTypeValues,
  categoryValues,
  featureValues,
  frameworkValues,
  industryValues,
  styleValues,
} from "@auren/schemas/taxonomy";
import {
  type CatalogFilterState,
  formatCatalogFilterValue,
  hasActiveCatalogFilters,
  parseCatalogFilterSearch,
} from "../filters/catalog-filters.js";

export interface CatalogFiltersProps {
  readonly value: CatalogFilterState;
  readonly onChange: (value: CatalogFilterState) => void;
  readonly onClear: () => void;
}

const controlClassName =
  "mt-2 block min-h-11 w-full min-w-0 rounded-md border border-[#b8c7b7] bg-white px-3 py-2 text-sm text-[#17231d] shadow-sm outline-none transition-colors hover:border-[#849787] focus-visible:border-[#52705b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500 dark:focus-visible:border-lime-300 dark:focus-visible:outline-lime-300 motion-reduce:transition-none";

export function CatalogFilters({
  value,
  onChange,
  onClear,
}: CatalogFiltersProps) {
  const headingId = "catalog-filters-heading";
  const hasFilters = hasActiveCatalogFilters(value);

  return (
    <form
      aria-labelledby={headingId}
      className="rounded-2xl border border-[#ccd7cc] bg-[#f4f8f1] p-4 shadow-[0_12px_40px_rgba(33,57,42,0.04)] sm:p-5 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset>
        <legend
          className="font-serif text-2xl font-semibold tracking-tight text-[#17231d] dark:text-white"
          id={headingId}
        >
          Filter blocks
        </legend>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63786a] dark:text-slate-400">
          Choose any classification to narrow the loaded index. Selected
          features must all be present on a block.
        </p>

        <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FilterSelect
            id="catalog-filter-category"
            label="Category"
            name="category"
            onValueChange={(category) =>
              onChange(parseCatalogFilterSearch({ ...value, category }))
            }
            values={categoryValues}
            value={value.category ?? ""}
          />
          <FilterSelect
            id="catalog-filter-type"
            label="Type"
            name="type"
            onValueChange={(type) =>
              onChange(parseCatalogFilterSearch({ ...value, type }))
            }
            values={blockTypeValues}
            value={value.type ?? ""}
          />
          <FilterSelect
            id="catalog-filter-style"
            label="Style"
            name="style"
            onValueChange={(style) =>
              onChange(parseCatalogFilterSearch({ ...value, style }))
            }
            values={styleValues}
            value={value.style ?? ""}
          />
          <FilterSelect
            id="catalog-filter-industry"
            label="Industry"
            name="industry"
            onValueChange={(industry) =>
              onChange(parseCatalogFilterSearch({ ...value, industry }))
            }
            values={industryValues}
            value={value.industry ?? ""}
          />
          <FilterSelect
            id="catalog-filter-framework"
            label="Framework"
            name="framework"
            onValueChange={(framework) =>
              onChange(parseCatalogFilterSearch({ ...value, framework }))
            }
            values={frameworkValues}
            value={value.framework ?? ""}
          />

          <fieldset className="min-w-0 sm:col-span-2 lg:col-span-1">
            <legend className="text-sm font-bold text-[#17231d] dark:text-slate-100">
              Features
            </legend>
            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {featureValues.map((feature) => (
                <label
                  className="flex min-w-0 items-start gap-2 rounded-md px-1 py-1.5 text-sm text-[#4d6354] hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                  htmlFor={`catalog-filter-feature-${feature}`}
                  key={feature}
                >
                  <input
                    checked={value.features.includes(feature)}
                    className="mt-0.5 size-4 shrink-0 accent-[#52705b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] dark:accent-lime-300 dark:focus-visible:outline-lime-300"
                    id={`catalog-filter-feature-${feature}`}
                    name="features"
                    onChange={(event) => {
                      const features = event.target.checked
                        ? [...value.features, feature]
                        : value.features.filter(
                            (selected) => selected !== feature,
                          );
                      onChange({ ...value, features });
                    }}
                    type="checkbox"
                  />
                  <span className="min-w-0 break-words">
                    {formatCatalogFilterValue(feature)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[#d9e2d7] pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-xs leading-5 text-[#63786a] dark:text-slate-400">
            Filters update this page from the validated Registry index only.
          </p>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-[#52705b] px-4 py-2 text-sm font-bold text-[#52705b] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52705b] disabled:cursor-not-allowed disabled:border-[#b8c7b7] disabled:text-[#9aaa99] dark:border-lime-300 dark:text-lime-300 dark:hover:bg-slate-800 dark:focus-visible:outline-lime-300 dark:disabled:border-slate-700 dark:disabled:text-slate-600 motion-reduce:transition-none"
            disabled={!hasFilters}
            onClick={onClear}
            type="button"
          >
            Clear all filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}

interface FilterSelectProps<T extends string> {
  readonly id: string;
  readonly label: string;
  readonly name: string;
  readonly values: readonly T[];
  readonly value: T | "";
  readonly onValueChange: (value: T | undefined) => void;
}

function FilterSelect<T extends string>({
  id,
  label,
  name,
  values,
  value,
  onValueChange,
}: FilterSelectProps<T>) {
  return (
    <div className="min-w-0">
      <label
        className="text-sm font-bold text-[#17231d] dark:text-slate-100"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        className={controlClassName}
        id={id}
        name={name}
        onChange={(event) => {
          const nextValue = values.find(
            (option) => option === event.target.value,
          );
          onValueChange(nextValue);
        }}
        value={value}
      >
        <option value="">Any {label.toLowerCase()}</option>
        {values.map((option) => (
          <option key={option} value={option}>
            {formatCatalogFilterValue(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
