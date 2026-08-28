import { defineConfig } from "vitest/config";

const sourceRoot = new URL("./src/", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@auren/schemas/catalog",
        replacement: `${sourceRoot}catalog/element-schema.ts`,
      },
      {
        find: "@auren/schemas/element",
        replacement: `${sourceRoot}element/structural-schema.ts`,
      },
      {
        find: "@auren/schemas/taxonomy",
        replacement: `${sourceRoot}taxonomy/schema.ts`,
      },
      { find: "@", replacement: sourceRoot },
    ],
  },
});
