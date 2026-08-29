import { defineConfig } from "vitest/config";

const coreProjectEntrypoint = new URL(
  "../core/src/project/detect-project.ts",
  import.meta.url,
).pathname;
const coreConfigurationEntrypoint = new URL(
  "../core/src/configuration/configuration.ts",
  import.meta.url,
).pathname;
const coreMetadataEntrypoint = new URL(
  "../core/src/load/load-block-metadata.ts",
  import.meta.url,
).pathname;
const coreSearchEntrypoint = new URL(
  "../core/src/search/search.ts",
  import.meta.url,
).pathname;
const registryEntrypoint = new URL("../registry/src/index.ts", import.meta.url)
  .pathname;
const schemasCatalogEntrypoint = new URL(
  "../schemas/src/catalog/element-schema.ts",
  import.meta.url,
).pathname;
const schemasConfigurationEntrypoint = new URL(
  "../schemas/src/configuration/schema.ts",
  import.meta.url,
).pathname;
const schemasTaxonomyEntrypoint = new URL(
  "../schemas/src/taxonomy/schema.ts",
  import.meta.url,
).pathname;
const schemasElementEntrypoint = new URL(
  "../schemas/src/element/structural-schema.ts",
  import.meta.url,
).pathname;

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@auren/core/project",
        replacement: coreProjectEntrypoint,
      },
      {
        find: "@auren/core/configuration",
        replacement: coreConfigurationEntrypoint,
      },
      {
        find: "@auren/core/resolve",
        replacement: new URL("../core/src/resolve/resolve.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@auren/core/dependencies",
        replacement: new URL(
          "../core/src/dependencies/dependency-plan.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@auren/core/load/files",
        replacement: new URL(
          "../core/src/load/load-block-files.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@auren/core/compatibility",
        replacement: new URL(
          "../core/src/compatibility/compatibility.ts",
          import.meta.url,
        ).pathname,
      },
      {
        find: "@auren/core/load/metadata",
        replacement: coreMetadataEntrypoint,
      },
      {
        find: "@auren/core/search",
        replacement: coreSearchEntrypoint,
      },
      {
        find: "@auren/registry",
        replacement: registryEntrypoint,
      },
      {
        find: "@auren/schemas/catalog",
        replacement: schemasCatalogEntrypoint,
      },
      {
        find: "@auren/schemas/configuration",
        replacement: schemasConfigurationEntrypoint,
      },
      {
        find: "@auren/schemas/taxonomy",
        replacement: schemasTaxonomyEntrypoint,
      },
      {
        find: "@auren/schemas/element",
        replacement: schemasElementEntrypoint,
      },
    ],
  },
});
