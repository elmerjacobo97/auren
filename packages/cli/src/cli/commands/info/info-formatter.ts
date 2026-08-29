import type { CatalogElement } from "@auren/schemas/catalog";

export function formatCatalogElement(element: CatalogElement): string {
  const lines = [
    `ID: ${element.id}`,
    `Name: ${element.name}`,
    `Description: ${element.description}`,
    `Category: ${element.category}`,
    `Type: ${element.type}`,
    formatListField("Styles", element.styles),
    formatListField("Industries", element.industries),
    formatListField("Features", element.features),
    formatListField("Frameworks", element.frameworks),
    ...formatDependencies(element),
    ...formatFiles(element),
    ...formatMetadata(element),
  ];

  return `${lines.join("\n")}\n`;
}

function formatListField(label: string, values: readonly string[]): string {
  return `${label}: ${values.length === 0 ? "none" : values.join(", ")}`;
}

function formatDependencies(element: CatalogElement): string[] {
  if (element.dependencies.length === 0) {
    return ["Dependencies: none"];
  }

  return [
    "Dependencies:",
    ...element.dependencies.map((dependency) =>
      dependency.kind === "package"
        ? `  - package: ${dependency.name}@${dependency.version}`
        : dependency.kind === "auren"
          ? `  - auren: ${dependency.id}`
          : formatShadcnDependency(dependency),
    ),
  ];
}

function formatShadcnDependency(dependency: unknown): string {
  if (
    typeof dependency === "object" &&
    dependency !== null &&
    "name" in dependency
  ) {
    return `  - shadcn: ${String(dependency.name)}`;
  }

  return "  - shadcn: unknown";
}

function formatFiles(element: CatalogElement): string[] {
  if (element.files.length === 0) {
    return ["Files: none"];
  }

  return [
    "Files:",
    ...element.files.map((file) =>
      file.target === undefined
        ? `  - ${file.path} (${file.kind})`
        : `  - ${file.path} (${file.kind}), target: ${file.target}`,
    ),
  ];
}

function formatMetadata(element: CatalogElement): string[] {
  if (Object.keys(element.metadata).length === 0) {
    return ["Metadata: none"];
  }

  return ["Metadata:", JSON.stringify(element.metadata, null, 2)];
}
