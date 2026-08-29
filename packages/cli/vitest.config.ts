import { defineConfig } from "vitest/config";

const coreProjectEntrypoint = new URL(
  "../core/src/project/detect-project.ts",
  import.meta.url,
).pathname;
const coreConfigurationEntrypoint = new URL(
  "../core/src/configuration/configuration.ts",
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
