import { describe, expect, it } from "vitest";
import {
  getPreviewPolicyFailure,
  previewExecutionPolicy,
} from "./preview-policy.js";

describe("previewExecutionPolicy", () => {
  it("denies network and credentials and accepts bounded source", () => {
    expect(previewExecutionPolicy.network).toBe("deny");
    expect(previewExecutionPolicy.credentials).toBe("deny");
    expect(
      getPreviewPolicyFailure(
        1,
        [previewExecutionPolicy.maxFileBytes],
        [...previewExecutionPolicy.allowedDependencyRoots],
      ),
    ).toBeNull();
  });

  it.each([
    ["too many files", previewExecutionPolicy.maxFiles + 1, [0], []],
    ["too large file", 1, [previewExecutionPolicy.maxFileBytes + 1], []],
  ] as const)("rejects %s", (_label, fileCount, fileSizes, dependencies) => {
    expect(getPreviewPolicyFailure(fileCount, fileSizes, dependencies)).toBe(
      "resource-limit",
    );
  });

  it("rejects too many dependencies", () => {
    expect(
      getPreviewPolicyFailure(
        1,
        [0],
        Array.from(
          { length: previewExecutionPolicy.maxDependencies + 1 },
          (_value, index) => `package-${index}`,
        ),
      ),
    ).toBe("disallowed-dependency");
  });

  it("rejects a dependency outside the pinned allowlist", () => {
    expect(getPreviewPolicyFailure(1, [0], ["unknown-package"])).toBe(
      "disallowed-dependency",
    );
  });
});
