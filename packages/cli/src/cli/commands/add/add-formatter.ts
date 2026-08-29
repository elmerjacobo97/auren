import type { PackageDependency } from "@auren/core/dependencies";
import type { AddInstallationPlan } from "./add-types.js";

export function formatAddResult(
  plan: AddInstallationPlan,
  installedPackages: readonly PackageDependency[],
): string {
  const lines = [
    `Added ${plan.requestedId}`,
    "Resolved blocks:",
    ...plan.blocks.map((block) => `- ${block.id}`),
    "Satisfied package requirements:",
  ];

  lines.push(
    ...(plan.dependencyResolution.satisfied.length === 0
      ? ["- none"]
      : plan.dependencyResolution.satisfied.map(formatPackage)),
    "Installed package requirements:",
    ...(installedPackages.length === 0
      ? ["- none"]
      : installedPackages.map(formatPackage)),
    "Installed files:",
    ...plan.files.map((file) => `- ${file.targetPath}`),
  );

  return `${lines.join("\n")}\n`;
}

function formatPackage({ name, version }: PackageDependency): string {
  return `- ${name}@${version}`;
}
