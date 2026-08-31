import { defineConfig } from "vitest/config";

const schemasSourceRoot = new URL("../schemas/src/", import.meta.url).pathname;
const registryEntrypoint = new URL("./src/index.ts", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@auren/registry",
        replacement: registryEntrypoint,
      },
      {
        find: "@auren/schemas/catalog",
        replacement: `${schemasSourceRoot}catalog/element-schema.ts`,
      },
      {
        find: "@auren/schemas/collection",
        replacement: `${schemasSourceRoot}collection/schema.ts`,
      },
      {
        find: "@auren/schemas/element",
        replacement: `${schemasSourceRoot}element/structural-schema.ts`,
      },
      {
        find: "@auren/schemas/taxonomy",
        replacement: `${schemasSourceRoot}taxonomy/schema.ts`,
      },
    ],
  },
});
