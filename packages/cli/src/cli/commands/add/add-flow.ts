import type { InstallableCatalogSource } from "../../catalog/catalog-source.js";
import type { Terminal } from "../../terminal/terminal.js";
import type {
  PackageInstallationResult,
  PackageInstaller,
} from "./package-installer.js";
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
  readonly packageInstaller: PackageInstaller;
}

export async function runAddFlow({
  projectDir,
  id,
  force,
  terminal,
  source,
  packageInstaller,
}: AddFlowOptions): Promise<number> {
  try {
    const plan = await createAddInstallationPlan({
      projectDir,
      id,
      force,
      source,
    });
    let installation: PackageInstallationResult = { packages: [] };

    if (plan.dependencyResolution.missing.length > 0) {
      const packageManager = plan.detection.packageManager;

      if (packageManager === null) {
        throw new Error("Package manager was not resolved for installation");
      }

      installation = await packageInstaller.install({
        projectDir: plan.projectDir,
        packageManager: packageManager.name,
        packages: plan.dependencyResolution.missing,
      });
    }

    await applyAddInstallationPlan(plan);
    renderWarnings(terminal, plan);
    terminal.writeOut(formatAddResult(plan, installation.packages));
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
