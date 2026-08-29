import type {
  ProjectDetectionDiagnostic,
  ProjectDetectionDiagnosticCode,
  ProjectDetectionDiagnosticSeverity,
} from "./types.js";

export function failureMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function diagnostic(
  severity: ProjectDetectionDiagnosticSeverity,
  code: ProjectDetectionDiagnosticCode,
  message: string,
  filePath?: string,
  cause?: unknown,
): ProjectDetectionDiagnostic {
  return {
    severity,
    code,
    message,
    path: filePath,
    cause: cause === undefined ? undefined : failureMessage(cause),
  };
}
