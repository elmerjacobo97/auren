import { z } from "zod";

export const categoryValues = Object.freeze([
  "marketing",
  "application-ui",
  "ecommerce",
  "authentication",
] as const);

export const blockTypeValues = Object.freeze([
  "hero",
  "pricing",
  "features",
  "sidebar",
  "table",
] as const);

export const styleValues = Object.freeze([
  "minimal",
  "bold",
  "editorial",
  "corporate",
  "glass",
  "brutalist",
  "luxury",
  "developer",
] as const);

export const industryValues = Object.freeze([
  "saas",
  "fintech",
  "ai",
  "developer-tools",
  "ecommerce",
  "education",
  "portfolio",
  "agency",
] as const);

export const featureValues = Object.freeze([
  "dark-mode",
  "mobile-first",
  "responsive",
  "product-screenshot",
  "two-cta",
  "animated",
  "sidebar",
  "search",
  "command-palette",
] as const);

export const frameworkValues = Object.freeze(["react"] as const);

export const categorySchema = z.enum(categoryValues);
export const blockTypeSchema = z.enum(blockTypeValues);
export const styleSchema = z.enum(styleValues);
export const industrySchema = z.enum(industryValues);
export const featureSchema = z.enum(featureValues);
export const frameworkSchema = z.enum(frameworkValues);

export type Category = z.infer<typeof categorySchema>;
export type BlockType = z.infer<typeof blockTypeSchema>;
export type Style = z.infer<typeof styleSchema>;
export type Industry = z.infer<typeof industrySchema>;
export type Feature = z.infer<typeof featureSchema>;
export type Framework = z.infer<typeof frameworkSchema>;
