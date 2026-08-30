import type { CatalogElement } from "@auren/schemas/catalog";
import {
  type BlockType,
  blockTypeValues,
  type Category,
  categoryValues,
  type Feature,
  type Framework,
  featureValues,
  frameworkValues,
  type Industry,
  industryValues,
  type Style,
  styleValues,
} from "@auren/schemas/taxonomy";

export interface CatalogFilterState {
  readonly category?: Category;
  readonly type?: BlockType;
  readonly style?: Style;
  readonly industry?: Industry;
  readonly features: readonly Feature[];
  readonly framework?: Framework;
}

/**
 * This is the route-facing shape. `features` stays a string so TanStack
 * Router's default search serializer writes one comma-delimited query value.
 */
export interface CatalogFilterSearch {
  readonly category?: Category;
  readonly type?: BlockType;
  readonly style?: Style;
  readonly industry?: Industry;
  readonly features?: string;
  readonly framework?: Framework;
}

export const emptyCatalogFilterState: CatalogFilterState = {
  features: [],
};

type MutableCatalogFilterState = {
  -readonly [Key in keyof CatalogFilterState]: CatalogFilterState[Key];
};

type MutableCatalogFilterSearch = {
  -readonly [Key in keyof CatalogFilterSearch]: CatalogFilterSearch[Key];
};

export function parseCatalogFilterSearch(input: unknown): CatalogFilterState {
  const search = asRecord(input);
  const state: MutableCatalogFilterState = {
    features: normalizeFeatures(search.features),
  };

  const category = parseScalar(search.category, categoryValues);
  if (category !== undefined) {
    state.category = category;
  }

  const type = parseScalar(search.type, blockTypeValues);
  if (type !== undefined) {
    state.type = type;
  }

  const style = parseScalar(search.style, styleValues);
  if (style !== undefined) {
    state.style = style;
  }

  const industry = parseScalar(search.industry, industryValues);
  if (industry !== undefined) {
    state.industry = industry;
  }

  const framework = parseScalar(search.framework, frameworkValues);
  if (framework !== undefined) {
    state.framework = framework;
  }

  return state;
}

export function normalizeCatalogFilterSearch(
  input: unknown,
): CatalogFilterSearch {
  return serializeCatalogFilterState(parseCatalogFilterSearch(input));
}

export function serializeCatalogFilterState(
  input: CatalogFilterState,
): CatalogFilterSearch {
  const state = parseCatalogFilterSearch(input);
  const search: MutableCatalogFilterSearch = {};

  if (state.category !== undefined) {
    search.category = state.category;
  }

  if (state.type !== undefined) {
    search.type = state.type;
  }

  if (state.style !== undefined) {
    search.style = state.style;
  }

  if (state.industry !== undefined) {
    search.industry = state.industry;
  }

  if (state.features.length > 0) {
    search.features = state.features.join(",");
  }

  if (state.framework !== undefined) {
    search.framework = state.framework;
  }

  return search;
}

export function hasActiveCatalogFilters(state: CatalogFilterState): boolean {
  return (
    state.category !== undefined ||
    state.type !== undefined ||
    state.style !== undefined ||
    state.industry !== undefined ||
    state.features.length > 0 ||
    state.framework !== undefined
  );
}

export function formatCatalogFilterSummary(state: CatalogFilterState): string {
  const values = [
    state.category === undefined
      ? undefined
      : `Category: ${formatCatalogFilterValue(state.category)}`,
    state.type === undefined
      ? undefined
      : `Type: ${formatCatalogFilterValue(state.type)}`,
    state.style === undefined
      ? undefined
      : `Style: ${formatCatalogFilterValue(state.style)}`,
    state.industry === undefined
      ? undefined
      : `Industry: ${formatCatalogFilterValue(state.industry)}`,
    state.features.length === 0
      ? undefined
      : `Features: ${state.features.map(formatCatalogFilterValue).join(", ")}`,
    state.framework === undefined
      ? undefined
      : `Framework: ${formatCatalogFilterValue(state.framework)}`,
  ].filter((value): value is string => value !== undefined);

  return values.length === 0 ? "All blocks" : values.join(" · ");
}

export function formatCatalogFilterValue(value: string): string {
  return value
    .split("-")
    .map((word) => {
      if (word.length <= 3) {
        return word.toUpperCase();
      }

      return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`;
    })
    .join(" ");
}

export function matchesCatalogFilters(
  block: CatalogElement,
  state: CatalogFilterState,
): boolean {
  return (
    (state.category === undefined || block.category === state.category) &&
    (state.type === undefined || block.type === state.type) &&
    (state.style === undefined || block.styles.includes(state.style)) &&
    (state.industry === undefined ||
      block.industries.includes(state.industry)) &&
    state.features.every((feature) => block.features.includes(feature)) &&
    (state.framework === undefined ||
      block.frameworks.includes(state.framework))
  );
}

export function filterCatalogElements(
  blocks: readonly CatalogElement[],
  state: CatalogFilterState,
): CatalogElement[] {
  return blocks.filter((block) => matchesCatalogFilters(block, state));
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === "object" && input !== null
    ? (input as Record<string, unknown>)
    : {};
}

function parseScalar<T extends string>(
  input: unknown,
  values: readonly T[],
): T | undefined {
  return typeof input === "string" && values.includes(input as T)
    ? (input as T)
    : undefined;
}

function normalizeFeatures(input: unknown): Feature[] {
  const requested = new Set<string>();

  for (const value of featureInputs(input)) {
    requested.add(value);
  }

  return featureValues.filter((feature) => requested.has(feature));
}

function featureInputs(input: unknown): string[] {
  if (typeof input === "string") {
    return input.split(",");
  }

  if (Array.isArray(input)) {
    return input.flatMap((value) =>
      typeof value === "string" ? value.split(",") : [],
    );
  }

  return [];
}
