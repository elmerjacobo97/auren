import { z } from "zod";

export const MAX_KEY_LENGTH = 100;
export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1_000;

const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const kebabCaseKeySchema = z
  .string()
  .min(1, "Expected a non-empty kebab-case key")
  .max(MAX_KEY_LENGTH, `Keys must be at most ${MAX_KEY_LENGTH} characters`)
  .regex(
    kebabCasePattern,
    "Keys must use lowercase ASCII letters, digits, and single hyphen separators",
  );

export const elementNameSchema = z
  .string()
  .min(1, "Name must not be empty")
  .max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`);

export const elementDescriptionSchema = z
  .string()
  .min(1, "Description must not be empty")
  .max(
    MAX_DESCRIPTION_LENGTH,
    `Description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
  );

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

export function createClassificationListSchema<T extends z.ZodType<string>>(
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

export const classificationListSchema =
  createClassificationListSchema(kebabCaseKeySchema);

export const frameworksSchema = createClassificationListSchema(
  kebabCaseKeySchema,
  "Framework list",
  "At least one framework is required",
);

const packageDependencySchema = z.strictObject({
  kind: z.literal("package"),
  name: z.string().min(1, "Package dependency name must not be empty"),
  version: z
    .string()
    .min(1, "Package dependency version range must not be empty"),
});

const aurenReferenceDependencySchema = z.strictObject({
  kind: z.literal("auren"),
  id: kebabCaseKeySchema,
});

export const shadcnDependencySchema = z.strictObject({
  kind: z.literal("shadcn"),
  name: kebabCaseKeySchema,
});

export const aurenDependencySchema = z.discriminatedUnion("kind", [
  packageDependencySchema,
  aurenReferenceDependencySchema,
  shadcnDependencySchema,
]);

export const aurenDependenciesSchema = z
  .array(aurenDependencySchema)
  .superRefine((dependencies, ctx) => {
    const seen = new Set<string>();

    for (const [index, dependency] of dependencies.entries()) {
      const identifier =
        dependency.kind === "package"
          ? dependency.name
          : dependency.kind === "auren"
            ? dependency.id
            : dependency.name;
      const key = `${dependency.kind}\u0000${identifier}`;

      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message:
            "Dependencies must not contain duplicate kind-and-identifier pairs",
        });
      }

      seen.add(key);
    }
  });

export const fileKindSchema = z.enum([
  "component",
  "utility",
  "style",
  "asset",
]);

function isSafeRelativePosixPath(value: string) {
  if (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\u0000") ||
    /^[A-Za-z]:/.test(value)
  ) {
    return false;
  }

  return value
    .split("/")
    .every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    );
}

export const relativePosixPathSchema = z
  .string()
  .refine(isSafeRelativePosixPath, {
    message:
      "Path must be a non-empty relative POSIX path without backslashes or traversal segments",
  });

export const aurenFileSchema = z.strictObject({
  path: relativePosixPathSchema,
  kind: fileKindSchema,
  target: relativePosixPathSchema.optional(),
  content: z.string().optional(),
});

export const aurenFilesSchema = z
  .array(aurenFileSchema)
  .min(1, "At least one file is required")
  .superRefine((files, ctx) => {
    const seen = new Set<string>();

    for (const [index, file] of files.entries()) {
      if (seen.has(file.path)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "path"],
          message: "Files must not contain duplicate source paths",
        });
      }

      seen.add(file.path);
    }
  });

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return (
    (prototype === Object.prototype || prototype === null) &&
    Object.getOwnPropertySymbols(value).length === 0
  );
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const jsonObjectSchema = () =>
  z
    .custom<Record<string, unknown>>(isPlainObject, {
      message: "Expected a plain JSON object",
    })
    .pipe(z.record(z.string(), jsonValueSchema));

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    jsonObjectSchema(),
  ]),
);

export const aurenMetadataSchema = jsonObjectSchema();

export const aurenElementSchema = z
  .strictObject({
    id: kebabCaseKeySchema,
    name: elementNameSchema,
    description: elementDescriptionSchema,
    category: kebabCaseKeySchema,
    type: kebabCaseKeySchema,
    styles: classificationListSchema,
    industries: classificationListSchema,
    features: classificationListSchema,
    frameworks: frameworksSchema,
    dependencies: aurenDependenciesSchema,
    files: aurenFilesSchema,
    metadata: aurenMetadataSchema,
  })
  .superRefine((element, ctx) => {
    for (const [index, dependency] of element.dependencies.entries()) {
      if (dependency.kind === "auren" && dependency.id === element.id) {
        ctx.addIssue({
          code: "custom",
          path: ["dependencies", index, "id"],
          message: "An element must not depend on itself",
        });
      }
    }
  });

export type AurenElement = z.infer<typeof aurenElementSchema>;
export type AurenDependency = z.infer<typeof aurenDependencySchema>;
export type ShadcnDependency = z.infer<typeof shadcnDependencySchema>;
export type AurenFile = z.infer<typeof aurenFileSchema>;
export type AurenMetadata = z.infer<typeof aurenMetadataSchema>;
