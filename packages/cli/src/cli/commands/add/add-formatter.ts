import type { PackageDependency } from "@auren/core/dependencies";
import type { AddInstallationPlan } from "./add-types.js";

export function formatAddResult(
  plan: AddInstallationPlan,
  installedPackages: readonly PackageDependency[],
  installedShadcnComponents: readonly string[] = [],
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
  );

  if (plan.shadcn.length > 0) {
    lines.push(
      "Satisfied shadcn/ui components:",
      ...(plan.shadcnResolution?.satisfied.length
        ? plan.shadcnResolution.satisfied.map(formatShadcnComponent)
        : ["- none"]),
      "Installed shadcn/ui components:",
      ...(installedShadcnComponents.length === 0
        ? ["- none"]
        : installedShadcnComponents.map(formatShadcnComponent)),
    );
  }

  lines.push(
    "Installed files:",
    ...plan.files.map((file) => `- ${file.targetPath}`),
  );

  return `${lines.join("\n")}\n`;
}

function formatPackage({ name, version }: PackageDependency): string {
  return `- ${name}@${version}`;
}

function formatShadcnComponent(name: string): string {
  return `- ${name}`;
}
