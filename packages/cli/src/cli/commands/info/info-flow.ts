import type { Terminal } from "../../terminal/terminal.js";
import {
  UnknownCatalogElementError,
  type CatalogSource,
} from "../../catalog/catalog-source.js";
import { formatCatalogElement } from "./info-formatter.js";

export interface InfoFlowOptions {
  readonly id: string;
  readonly terminal: Terminal;
  readonly source: CatalogSource;
}

export async function runInfoFlow({
  id,
  terminal,
  source,
}: InfoFlowOptions): Promise<number> {
  try {
    const element = await source.getById(id);

    if (element === undefined) {
      throw new UnknownCatalogElementError(id);
    }

    terminal.writeOut(formatCatalogElement(element));
    return 0;
  } catch (error) {
    terminal.error(error);
    return 1;
  }
}
