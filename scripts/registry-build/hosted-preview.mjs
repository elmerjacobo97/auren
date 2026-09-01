import {
  previewDescriptorSchema,
  previewHostedRequestSchema,
} from "@auren/schemas/preview";

export async function createHostedPreviewDescriptor({
  request,
  createProject,
}) {
  const validatedRequest = previewHostedRequestSchema.parse(request);

  try {
    const project = await createProject(validatedRequest);

    return previewDescriptorSchema.parse({
      ...validatedRequest,
      delivery: "external",
      status: "ready",
      livePreview: {
        url: project.url,
        embedding: project.embedding,
      },
    });
  } catch {
    return previewDescriptorSchema.parse({
      ...validatedRequest,
      delivery: "external",
      status: "failure",
      failure: {
        category: "provider",
        message: "The hosted preview provider could not create a project.",
      },
    });
  }
}
