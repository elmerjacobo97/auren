import { relativePosixPathSchema } from "@auren/schemas/element";
import { z } from "zod";

export const previewContentTypeSchema = z.enum([
  "block",
  "page",
  "collection",
  "template",
]);

export const previewDeliverySchema = z.enum(["inline", "external"]);

export const previewStatusSchema = z.enum(["ready", "unsupported", "failure"]);

export const previewFailureCategorySchema = z.enum([
  "build",
  "asset",
  "runtime",
  "provider",
  "timeout",
  "unsupported",
]);

export const previewRuntimeKeySchema = z
  .string()
  .min(1, "Preview runtime keys must not be empty")
  .max(100, "Preview runtime keys must be at most 100 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Preview runtime keys must use lowercase ASCII letters, digits, and single hyphen separators",
  );

export const previewHashSchema = z
  .string()
  .regex(/^sha256-[0-9a-f]{64}$/, "Expected a SHA-256 preview hash");

export const previewExecutionPolicySchema = z.strictObject({
  version: z.literal(1),
  network: z.literal("deny"),
  credentials: z.literal("deny"),
  timeoutMs: z.number().int().positive(),
  maxFiles: z.number().int().positive(),
  maxFileBytes: z.number().int().positive(),
  maxTotalBytes: z.number().int().positive(),
  maxDependencies: z.number().int().nonnegative(),
  allowedDependencyRoots: z.array(z.string().min(1)),
  contentSecurityPolicy: z.string().min(1),
});

export const previewExecutionPolicy = Object.freeze({
  version: 1,
  network: "deny" as const,
  credentials: "deny" as const,
  timeoutMs: 30_000,
  maxFiles: 64,
  maxFileBytes: 500_000,
  maxTotalBytes: 2_000_000,
  maxDependencies: 32,
  allowedDependencyRoots: Object.freeze([
    "@tailwindcss/browser",
    "@vitejs/plugin-react",
    "lucide-react",
    "react",
    "react-dom",
    "tailwindcss",
    "vite",
  ]),
  contentSecurityPolicy:
    "default-src 'none'; base-uri 'none'; connect-src 'none'; font-src 'none'; form-action 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
});

const previewUrlSchema = z
  .string()
  .url("Expected a valid preview URL")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.username === "" &&
        url.password === ""
      );
    } catch {
      return false;
    }
  }, "Preview URLs must use http(s) without credentials");

const previewArtifactSchema = z.strictObject({
  kind: z.literal("inline"),
  reference: relativePosixPathSchema,
});

const previewArtifactFileSchema = z.strictObject({
  path: z
    .string()
    .min(2)
    .regex(/^\/[A-Za-z0-9._/-]+$/, "Preview artifact paths must be absolute"),
  content: z.string(),
});

export const previewArtifactManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contentId: z.string().min(1).max(100),
  identity: previewHashSchema,
  runtime: previewRuntimeKeySchema,
  runtimeVersion: z.string().min(1).max(100),
  entry: z
    .string()
    .min(2)
    .regex(/^\/[A-Za-z0-9._/-]+$/, "Preview artifact entries must be absolute"),
  input: z.strictObject({ kind: z.literal("empty") }),
  files: z.array(previewArtifactFileSchema).min(1),
  dependencies: z.record(z.string().min(1), z.string().min(1)),
  buildConfiguration: z.strictObject({
    cssProcessor: z.string().min(1),
    entry: z.string().min(2),
    input: z.literal("empty"),
    policyVersion: z.literal(1),
    contentSecurityPolicy: z.string().min(1),
    stylesheet: z.string().min(2),
    template: z.string().min(1),
  }),
});

const previewLiveProjectSchema = z.strictObject({
  url: previewUrlSchema,
  embedding: z.enum(["allowed", "denied", "unknown"]),
});

const previewFailureSchema = z.strictObject({
  category: previewFailureCategorySchema,
  message: z.string().min(1).max(500).optional(),
});

export const previewDescriptorSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    contentType: previewContentTypeSchema,
    contentId: z.string().min(1).max(100),
    contentVersion: previewHashSchema,
    framework: z.string().min(1).max(100),
    runtime: previewRuntimeKeySchema,
    runtimeVersion: z.string().min(1).max(100),
    delivery: previewDeliverySchema,
    identity: previewHashSchema,
    status: previewStatusSchema,
    artifact: previewArtifactSchema.optional(),
    livePreview: previewLiveProjectSchema.optional(),
    failure: previewFailureSchema.optional(),
  })
  .superRefine((descriptor, ctx) => {
    if (descriptor.status === "ready") {
      if (descriptor.failure !== undefined) {
        ctx.addIssue({
          code: "custom",
          path: ["failure"],
          message: "A ready preview must not contain a failure",
        });
      }

      if (
        descriptor.delivery === "inline" &&
        descriptor.artifact === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["artifact"],
          message: "A ready inline preview requires an artifact reference",
        });
      }

      if (
        descriptor.delivery === "external" &&
        descriptor.livePreview === undefined
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["livePreview"],
          message: "A ready external preview requires a live-preview URL",
        });
      }
    }

    if (
      (descriptor.status === "unsupported" ||
        descriptor.status === "failure") &&
      descriptor.failure === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["failure"],
        message: "An unavailable preview requires a failure category",
      });
    }

    if (
      descriptor.status === "unsupported" &&
      descriptor.failure?.category !== "unsupported"
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["failure", "category"],
        message: "An unsupported preview must use the unsupported category",
      });
    }

    if (descriptor.artifact !== undefined && descriptor.delivery !== "inline") {
      ctx.addIssue({
        code: "custom",
        path: ["artifact"],
        message: "Artifact references are only valid for inline previews",
      });
    }
  });

export const previewHostedRequestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contentType: previewContentTypeSchema,
  contentId: z.string().min(1).max(100),
  contentVersion: previewHashSchema,
  framework: z.string().min(1).max(100),
  runtime: previewRuntimeKeySchema,
  runtimeVersion: z.string().min(1).max(100),
  identity: previewHashSchema,
});

export const previewDiagnosticSchema = z.strictObject({
  event: z.literal("auren.preview"),
  phase: z.enum(["build", "runtime", "provider"]),
  category: previewFailureCategorySchema,
  message: z.string().min(1).max(500),
  contentId: z.string().min(1).max(100).optional(),
  identity: previewHashSchema.optional(),
  runtime: previewRuntimeKeySchema.optional(),
});

export type PreviewContentType = z.infer<typeof previewContentTypeSchema>;
export type PreviewDelivery = z.infer<typeof previewDeliverySchema>;
export type PreviewStatus = z.infer<typeof previewStatusSchema>;
export type PreviewFailureCategory = z.infer<
  typeof previewFailureCategorySchema
>;
export type PreviewArtifactManifest = z.infer<
  typeof previewArtifactManifestSchema
>;
export type PreviewDescriptor = z.infer<typeof previewDescriptorSchema>;
export type PreviewHostedRequest = z.infer<typeof previewHostedRequestSchema>;
export type PreviewDiagnostic = z.infer<typeof previewDiagnosticSchema>;
export type PreviewExecutionPolicy = z.infer<
  typeof previewExecutionPolicySchema
>;

export type PreviewJsonValue =
  | string
  | number
  | boolean
  | null
  | PreviewJsonValue[]
  | { readonly [key: string]: PreviewJsonValue };

export interface PreviewIdentityInput {
  readonly contentHash: string;
  readonly runtime: string;
  readonly runtimeVersion: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly buildConfiguration: PreviewJsonValue;
}

export type PreviewPolicyFailure = "resource-limit" | "disallowed-dependency";

export interface PreviewPolicyInput {
  readonly fileCount: number;
  readonly fileSizes: readonly number[];
  readonly dependencyRoots: readonly string[];
}

export function evaluatePreviewExecutionPolicy({
  fileCount,
  fileSizes,
  dependencyRoots,
}: PreviewPolicyInput): PreviewPolicyFailure | null {
  const totalBytes = fileSizes.reduce((total, size) => total + size, 0);

  if (
    fileCount > previewExecutionPolicy.maxFiles ||
    totalBytes > previewExecutionPolicy.maxTotalBytes ||
    fileSizes.some((size) => size > previewExecutionPolicy.maxFileBytes)
  ) {
    return "resource-limit";
  }

  if (
    dependencyRoots.length > previewExecutionPolicy.maxDependencies ||
    dependencyRoots.some(
      (dependency) =>
        !previewExecutionPolicy.allowedDependencyRoots.includes(dependency),
    )
  ) {
    return "disallowed-dependency";
  }

  return null;
}

export function canonicalizePreviewIdentityInput(
  input: PreviewIdentityInput,
): string {
  return JSON.stringify({
    buildConfiguration: sortJsonValue(input.buildConfiguration),
    contentHash: input.contentHash,
    dependencies: Object.fromEntries(
      Object.entries(input.dependencies).sort(([left], [right]) =>
        compareStrings(left, right),
      ),
    ),
    runtime: input.runtime,
    runtimeVersion: input.runtimeVersion,
  });
}

export async function createPreviewContentHash(
  content: string,
): Promise<string> {
  return formatHash(await digestText(content));
}

export async function createPreviewIdentity(
  input: PreviewIdentityInput,
): Promise<string> {
  return formatHash(await digestText(canonicalizePreviewIdentityInput(input)));
}

function sortJsonValue(value: PreviewJsonValue): PreviewJsonValue {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareStrings)
        .map((key) => [key, sortJsonValue(value[key])]),
    );
  }

  return value;
}

async function digestText(value: string): Promise<Uint8Array> {
  const crypto = globalThis.crypto;

  if (crypto?.subtle === undefined) {
    throw new Error(
      "Web Crypto with SubtleCrypto is required for preview identities",
    );
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

function formatHash(bytes: Uint8Array): string {
  return `sha256-${Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
