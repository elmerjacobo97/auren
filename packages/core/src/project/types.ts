import type { Framework } from "@auren/schemas/taxonomy";

export type ProjectDetectionDiagnosticSeverity = "warning" | "error";

export type ProjectDetectionDiagnosticCode =
  | "invalid-project-directory"
  | "unreadable-file"
  | "malformed-json"
  | "invalid-package-manager"
  | "conflicting-package-managers"
  | "ambiguous-package-manager"
  | "unsupported-config-extends"
  | "external-config-extends"
  | "config-extends-cycle"
  | "config-extends-depth-exceeded";

export type ProjectDetectionDiagnostic = {
  readonly severity: ProjectDetectionDiagnosticSeverity;
  readonly code: ProjectDetectionDiagnosticCode;
  readonly message: string;
  readonly path?: string;
  readonly cause?: string;
};

export type TailwindDetection = {
  readonly detected: boolean;
  readonly declaredRange: string | null;
  readonly installedVersion: string | null;
  readonly major: number | null;
  readonly configPath: string | null;
};

export type ShadcnDetection = {
  readonly detected: boolean;
  readonly configPath: string | null;
  readonly aliases: Readonly<Record<string, string>>;
};

export type SourceLayoutDetection = {
  readonly hasSrcDirectory: boolean;
};

export type TypeScriptAliasDetection = {
  readonly configPath: string | null;
  readonly baseUrl: string | null;
  readonly paths: Readonly<Record<string, readonly string[]>>;
};

export type AliasDetection = {
  readonly typescript: TypeScriptAliasDetection;
  readonly shadcn: Readonly<Record<string, string>>;
};

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export type PackageManagerEvidence =
  | "packageManager"
  | "lockfile"
  | "workspace";

export type PackageManagerDetection = {
  readonly name: PackageManagerName;
  readonly version: string | null;
  readonly evidence: PackageManagerEvidence;
  readonly path: string;
};

export type ProjectDetection = {
  readonly projectDir: string;
  readonly framework: Framework | null;
  readonly typescript: boolean;
  readonly tailwind: TailwindDetection;
  readonly shadcn: ShadcnDetection;
  readonly source: SourceLayoutDetection;
  readonly aliases: AliasDetection;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly packageManager: PackageManagerDetection | null;
  readonly diagnostics: readonly ProjectDetectionDiagnostic[];
};

export type JsonObject = Record<string, unknown>;
