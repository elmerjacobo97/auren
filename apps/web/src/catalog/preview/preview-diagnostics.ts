import {
  previewDiagnosticSchema,
  type PreviewDiagnostic,
} from "@auren/schemas/preview";

export function reportPreviewDiagnostic(
  diagnostic: Omit<PreviewDiagnostic, "event">,
  write: (message: string) => void = console.warn,
): PreviewDiagnostic {
  const payload = previewDiagnosticSchema.parse({
    event: "auren.preview",
    ...diagnostic,
  });

  write(`[auren-preview] ${JSON.stringify(payload)}`);
  return payload;
}
