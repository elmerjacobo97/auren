import { previewDiagnosticSchema } from "@auren/schemas/preview";

export function logPreviewDiagnostic(diagnostic, write = console.warn) {
  const payload = previewDiagnosticSchema.parse({
    event: "auren.preview",
    ...diagnostic,
  });

  write(JSON.stringify(payload));
  return payload;
}
