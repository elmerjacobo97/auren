import { describe, expect, it } from "vitest";
import { catalogRoutePaths, router } from "@/router";
import { blocksRoute } from "@/routes/blocks/index.js";

describe("catalog route tree", () => {
  it("registers the public catalog sections and block detail route", () => {
    expect(catalogRoutePaths).toEqual([
      "/",
      "/components",
      "/blocks",
      "/pages",
      "/collections",
    ]);
    expect(Object.keys(router.routesByPath).sort()).toEqual([
      "/",
      "/blocks",
      "/blocks/$id",
      "/collections",
      "/components",
      "/pages",
    ]);
  });

  it("normalizes Blocks search values at the typed route boundary", () => {
    const validateSearch = blocksRoute.options.validateSearch;

    if (typeof validateSearch !== "function") {
      throw new Error("Blocks route search validation is not a function");
    }

    expect(
      validateSearch({
        category: "marketing",
        features: "responsive,dark-mode,unknown,responsive",
        framework: "react",
        type: "not-a-type",
      }),
    ).toEqual({
      category: "marketing",
      features: "dark-mode,responsive",
      framework: "react",
    });
  });
});
