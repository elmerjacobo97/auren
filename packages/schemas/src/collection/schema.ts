import {
  aurenMetadataSchema,
  createClassificationListSchema,
  elementDescriptionSchema,
  elementNameSchema,
  kebabCaseKeySchema,
} from "@auren/schemas/element";
import {
  categorySchema,
  featureSchema,
  frameworkSchema,
  industrySchema,
  styleSchema,
} from "@auren/schemas/taxonomy";
import { z } from "zod";

export const collectionBlockIdSchema = kebabCaseKeySchema;

export const collectionStylesSchema = createClassificationListSchema(
  styleSchema,
  "Style list",
);
export const collectionIndustriesSchema = createClassificationListSchema(
  industrySchema,
  "Industry list",
);
export const collectionFeaturesSchema = createClassificationListSchema(
  featureSchema,
  "Feature list",
);
export const collectionFrameworksSchema = createClassificationListSchema(
  frameworkSchema,
  "Framework list",
  "At least one framework is required",
);
export const collectionBlocksSchema = createClassificationListSchema(
  collectionBlockIdSchema,
  "Block list",
  "At least one block is required",
);
export const collectionMetadataSchema = aurenMetadataSchema;

export const collectionSchema = z.strictObject({
  id: kebabCaseKeySchema,
  name: elementNameSchema,
  description: elementDescriptionSchema,
  category: categorySchema,
  styles: collectionStylesSchema,
  industries: collectionIndustriesSchema,
  features: collectionFeaturesSchema,
  frameworks: collectionFrameworksSchema,
  blocks: collectionBlocksSchema,
  metadata: collectionMetadataSchema,
});

export type Collection = z.infer<typeof collectionSchema>;
export type CollectionBlockId = z.infer<typeof collectionBlockIdSchema>;
export type CollectionBlocks = z.infer<typeof collectionBlocksSchema>;
export type CollectionStyles = z.infer<typeof collectionStylesSchema>;
export type CollectionIndustries = z.infer<typeof collectionIndustriesSchema>;
export type CollectionFeatures = z.infer<typeof collectionFeaturesSchema>;
export type CollectionFrameworks = z.infer<typeof collectionFrameworksSchema>;
export type CollectionMetadata = z.infer<typeof collectionMetadataSchema>;
