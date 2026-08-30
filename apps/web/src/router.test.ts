import { describe, expect, it } from "vitest";
import { catalogRoutePaths, router } from "@/router";

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
});
