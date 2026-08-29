import { failureMessage } from "./diagnostics.js";

export class ProjectDetectionError extends Error {
  constructor(
    readonly requestedDir: string,
    override cause?: unknown,
  ) {
    super(
      `Failed to detect project at "${requestedDir}": ${failureMessage(cause)}`,
      {
        cause,
      },
    );
    this.name = "ProjectDetectionError";
  }
}
