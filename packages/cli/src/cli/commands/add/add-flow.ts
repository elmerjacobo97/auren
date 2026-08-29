import type { InstallableCatalogSource } from "../../catalog/catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import { formatAddResult } from "./add-formatter.js";
import { createAddInstallationPlan } from "./add-planner.js";
import type { AddInstallationPlan } from "./add-types.js";
import { applyAddInstallationPlan } from "./add-writer.js";

export interface AddFlowOptions {
  readonly projectDir: string;
  readonly id: string;
  readonly force: boolean;
  readonly terminal: Terminal;
  readonly source: InstallableCatalogSource;
}

export async function runAddFlow({
  projectDir,
  id,
  force,
  terminal,
  source,
}: AddFlowOptions): Promise<number> {
  try {
    const plan = await createAddInstallationPlan({
      projectDir,
      id,
      force,
      source,
    });
    renderWarnings(terminal, plan);
    await applyAddInstallationPlan(plan);
    terminal.writeOut(formatAddResult(plan));
    return 0;
  } catch (error) {
    terminal.error(error);
    return 1;
  }
}

function renderWarnings(terminal: Terminal, plan: AddInstallationPlan): void {
  for (const warning of plan.warnings) {
    terminal.writeErr(`warning: ${warning}\n`);
  }
}
