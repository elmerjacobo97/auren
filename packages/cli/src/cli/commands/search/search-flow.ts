import { searchBlocks } from "@auren/core/search";
import { LocalRegistry, type RegistryFilter } from "@auren/registry";
import {
  blockTypeValues,
  categoryValues,
  featureValues,
  industryValues,
  styleValues,
} from "@auren/schemas/taxonomy";
import type { Terminal } from "../../terminal/terminal.js";
import type { CatalogSource } from "../../catalog/catalog-source.js";
import { formatSearchResults } from "./search-formatter.js";

export interface SearchFilterOptions {
  readonly type?: string;
  readonly category?: string;
  readonly style?: string;
  readonly industry?: string;
  readonly feature?: string;
}

export class InvalidSearchFilterError extends Error {
  constructor(
    readonly option: string,
    readonly value: string,
  ) {
    super(`Invalid value for ${option}: "${value}"`);
    this.name = "InvalidSearchFilterError";
  }
}

export interface SearchFlowOptions {
  readonly query?: string;
  readonly filters: SearchFilterOptions;
  readonly terminal: Terminal;
  readonly source: CatalogSource;
}

export async function runSearchFlow({
  query,
  filters,
  terminal,
  source,
}: SearchFlowOptions): Promise<number> {
  try {
    const registryFilter = validateSearchFilters(filters);
    const catalog = await source.list();
    const registry = new LocalRegistry();
    registry.registerMany(catalog);

    const matches = [
      ...searchBlocks(registry, { text: query, filters: registryFilter }),
    ].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );

    terminal.writeOut(formatSearchResults(matches));
    return 0;
  } catch (error) {
    terminal.error(error);
    return 1;
  }
}

export function validateSearchFilters(
  filters: SearchFilterOptions,
): RegistryFilter {
  return {
    type: checkFilterValue("--type", filters.type, blockTypeValues),
    category: checkFilterValue("--category", filters.category, categoryValues),
    style: checkFilterValue("--style", filters.style, styleValues),
    industry: checkFilterValue("--industry", filters.industry, industryValues),
    feature: checkFilterValue("--feature", filters.feature, featureValues),
  };
}

function checkFilterValue<const Value extends string>(
  option: string,
  value: string | undefined,
  allowedValues: readonly Value[],
): Value | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!(allowedValues as readonly string[]).includes(value)) {
    throw new InvalidSearchFilterError(option, value);
  }

  return value as Value;
}
