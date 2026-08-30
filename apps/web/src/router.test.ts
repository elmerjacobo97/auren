import { describe, expect, it } from "vitest";
import { catalogRoutePaths, router } from "@/router";

describe("catalog route tree", () => {
  it("registers only the public catalog section paths", () => {
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
      "/collections",
      "/components",
      "/pages",
    ]);
    expect(Object.keys(router.routesByPath)).not.toContain("/blocks/$id");
  });
});
