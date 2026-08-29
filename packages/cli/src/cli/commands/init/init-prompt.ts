import { aurenConfigurationSchema } from "@auren/schemas/configuration";
import { cancel, isCancel, text } from "@clack/prompts";
import type { InitPromptResult } from "./init-flow.js";

export type InitPrompt = (
  defaultDestination: string,
) => Promise<InitPromptResult>;

export const clackInitPrompt: InitPrompt = async (defaultDestination) => {
  const result = await text({
    message: "Components destination",
    initialValue: defaultDestination,
    validate(value) {
      const parsed = aurenConfigurationSchema.shape.components.safeParse(value);

      if (!parsed.success) {
        return 'Components destination must be a safe relative path (no "..", absolute, or Windows-style paths)';
      }

      return undefined;
    },
  });

  if (isCancel(result)) {
    cancel("Initialization cancelled");
    return { kind: "cancelled" };
  }

  return { kind: "value", value: result };
};
