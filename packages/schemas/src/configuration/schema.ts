import { frameworkSchema } from "@auren/schemas/taxonomy";
import {
  jsonValueSchema,
  relativePosixPathSchema,
} from "@auren/schemas/element";
import { z } from "zod";

const aliasNameSchema = z.string().min(1, "Alias names must not be empty");
const aliasValueSchema = z.string().min(1, "Alias values must not be empty");

export const aliasesSchema = z.record(aliasNameSchema, aliasValueSchema);

export const integrationKeySchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Integration keys must use lowercase ASCII letters, digits, and single hyphen separators",
  );

export const integrationsSchema = z.record(
  integrationKeySchema,
  jsonValueSchema,
);

export const outputSchema = z.strictObject({
  utilities: relativePosixPathSchema.optional(),
  styles: relativePosixPathSchema.optional(),
  assets: relativePosixPathSchema.optional(),
});

export const aurenConfigurationSchema = z.strictObject({
  framework: frameworkSchema,
  components: relativePosixPathSchema,
  tailwind: z.boolean(),
  output: outputSchema.optional(),
  aliases: aliasesSchema.optional(),
  integrations: integrationsSchema.optional(),
});

export type AurenConfiguration = z.infer<typeof aurenConfigurationSchema>;
export type AurenConfigurationOutput = z.infer<typeof outputSchema>;
export type AurenConfigurationAliases = z.infer<typeof aliasesSchema>;
export type AurenConfigurationIntegrations = z.infer<typeof integrationsSchema>;
