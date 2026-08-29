import type { AddInstallationPlan } from "./add-types.js";

export function formatAddResult(plan: AddInstallationPlan): string {
  const lines = [
    `Added ${plan.requestedId}`,
    "Resolved blocks:",
    ...plan.blocks.map((block) => `- ${block.id}`),
    "Installed files:",
    ...plan.files.map((file) => `- ${file.targetPath}`),
    "Package requirements:",
  ];

  if (plan.packages.length === 0) {
    lines.push("- none");
  } else {
    lines.push(
      ...plan.packages.map(({ name, version }) => `- ${name}@${version}`),
    );
  }

  return `${lines.join("\n")}\n`;
}
