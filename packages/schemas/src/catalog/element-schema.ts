import { aurenElementSchema } from "@auren/schemas/element";
import {
  blockTypeSchema,
  categorySchema,
  featureSchema,
  frameworkSchema,
  industrySchema,
  styleSchema,
} from "@auren/schemas/taxonomy";
import { z } from "zod";

function addDuplicateIssues(
  values: readonly string[],
  ctx: z.RefinementCtx,
  label: string,
) {
  const seen = new Set<string>();

  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      ctx.addIssue({
        code: "custom",
        path: [index],
        message: `${label} must not contain duplicate values`,
      });
    }

    seen.add(value);
  }
}

function createTaxonomyListSchema<T extends z.ZodType<string>>(
  itemSchema: T,
  label = "Classification list",
  minimumMessage?: string,
) {
  const list = minimumMessage
    ? z.array(itemSchema).min(1, minimumMessage)
    : z.array(itemSchema);

  return list.superRefine((values, ctx) => {
    addDuplicateIssues(values, ctx, label);
  });
}

export const catalogElementSchema = aurenElementSchema.safeExtend({
  category: categorySchema,
  type: blockTypeSchema,
  styles: createTaxonomyListSchema(styleSchema),
  industries: createTaxonomyListSchema(industrySchema),
  features: createTaxonomyListSchema(featureSchema),
  frameworks: createTaxonomyListSchema(
    frameworkSchema,
    "Framework list",
    "At least one framework is required",
  ),
});

export type CatalogElement = z.infer<typeof catalogElementSchema>;
