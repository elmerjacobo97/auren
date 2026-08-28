import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sourceRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@auren/schemas/catalog",
        replacement: path.join(sourceRoot, "catalog/element-schema.ts"),
      },
      {
        find: "@auren/schemas/element",
        replacement: path.join(sourceRoot, "element/structural-schema.ts"),
      },
      {
        find: "@auren/schemas/taxonomy",
        replacement: path.join(sourceRoot, "taxonomy/schema.ts"),
      },
      { find: "@", replacement: sourceRoot },
    ],
  },
});
