import {
  evaluatePreviewExecutionPolicy,
  previewExecutionPolicy,
  type PreviewPolicyFailure,
} from "@auren/schemas/preview";

export { previewExecutionPolicy };
export type { PreviewPolicyFailure };

export function getPreviewPolicyFailure(
  fileCount: number,
  fileSizes: readonly number[],
  dependencyRoots: readonly string[],
): PreviewPolicyFailure | null {
  return evaluatePreviewExecutionPolicy({
    fileCount,
    fileSizes,
    dependencyRoots,
  });
}
