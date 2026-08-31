import {
  aurenElementSchema,
  createClassificationListSchema,
} from "@auren/schemas/element";
import {
  blockTypeSchema,
  categorySchema,
  featureSchema,
  frameworkSchema,
  industrySchema,
  styleSchema,
} from "@auren/schemas/taxonomy";
import type { z } from "zod";

export const catalogElementSchema = aurenElementSchema.safeExtend({
  category: categorySchema,
  type: blockTypeSchema,
  styles: createClassificationListSchema(styleSchema),
  industries: createClassificationListSchema(industrySchema),
  features: createClassificationListSchema(featureSchema),
  frameworks: createClassificationListSchema(
    frameworkSchema,
    "Framework list",
    "At least one framework is required",
  ),
});

export type CatalogElement = z.infer<typeof catalogElementSchema>;
