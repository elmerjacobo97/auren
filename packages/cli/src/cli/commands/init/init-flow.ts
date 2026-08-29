import {
  AurenConfigurationError,
  readAurenConfig,
  writeAurenConfig,
  type AurenConfiguration,
} from "@auren/core/configuration";
import { detectProject, type ProjectDetection } from "@auren/core/project";
import {
  aurenConfigurationSchema,
  type AurenConfiguration as SchemaConfiguration,
} from "@auren/schemas/configuration";
import type { Terminal } from "../../terminal/terminal.js";
import type { InitPrompt } from "./init-prompt.js";

export type InitPromptResult =
  | { readonly kind: "cancelled" }
  | { readonly kind: "value"; readonly value: string };

export interface InitFlowOptions {
  readonly projectDir: string;
  readonly terminal: Terminal;
  readonly force: boolean;
  readonly interactive: boolean;
  readonly prompt: InitPrompt;
}

function defaultDestination(hasSrcDirectory: boolean): string {
  return hasSrcDirectory ? "src/components/auren" : "components/auren";
}

function describeTailwindEvidence(detection: ProjectDetection): string {
  const { detected, declaredRange, installedVersion, configPath, major } =
    detection.tailwind;

  if (!detected) {
    return "no Tailwind evidence found";
  }

  const parts: string[] = [];

  if (declaredRange) {
    parts.push(`declared ${declaredRange}`);
  }

  if (installedVersion) {
    parts.push(`installed ${installedVersion}`);
  }

  if (configPath) {
    parts.push(`config at ${configPath}`);
  }

  return parts.length > 0
    ? parts.join(", ")
    : major === null
      ? "Tailwind evidence without a resolvable version"
      : `Tailwind evidence with major ${major}`;
}

class ExitStatusError extends Error {
  constructor(readonly status: number) {
    super(`CLI exited with status ${status}`);
    this.name = "ExitStatusError";
  }
}

export function isExitStatusError(error: unknown): error is ExitStatusError {
  return error instanceof ExitStatusError;
}

export async function runInitFlow({
  projectDir,
  terminal,
  force,
  interactive,
  prompt,
}: InitFlowOptions): Promise<number> {
  const detection = await detectProject(projectDir).catch(
    (error: unknown): never => {
      terminal.error(
        `Could not initialize Auren: project detection failed at "${projectDir}" (${messageOf(error)})`,
      );
      throw new ExitStatusError(1);
    },
  );

  renderDetectionSummary(terminal, detection);

  for (const diagnostic of detection.diagnostics) {
    terminal.writeErr(`warning: ${diagnostic.message}\n`);
  }

  const existing = await readAurenConfig(projectDir).catch(
    (error: unknown): never => {
      if (error instanceof AurenConfigurationError) {
        terminal.error(
          `Could not initialize Auren: existing configuration problem (${error.message})`,
        );
        throw new ExitStatusError(1);
      }

      throw error;
    },
  );

  if (existing !== null && !force) {
    terminal.error(
      'Could not initialize Auren: a valid "auren.json" already exists; pass --force to replace it',
    );
    return 1;
  }

  if (detection.framework === null) {
    terminal.error(
      "Could not initialize Auren: the catalog requires a React project",
    );
    return 1;
  }

  if (!detection.tailwind.detected || detection.tailwind.major !== 4) {
    terminal.error(
      `Could not initialize Auren: the catalog requires Tailwind CSS v4 (${describeTailwindEvidence(detection)}); install tailwindcss@^4 and retry`,
    );
    return 1;
  }

  let destination = defaultDestination(detection.source.hasSrcDirectory);

  if (interactive) {
    const result = await prompt(destination);

    if (result.kind === "cancelled") {
      terminal.error("Could not initialize Auren: cancelled by the user");
      return 1;
    }

    destination = result.value;
  }

  const configuration = assembleConfiguration(detection, destination);

  try {
    await writeAurenConfig(projectDir, configuration);
  } catch (error) {
    terminal.error(
      `Could not initialize Auren: writing the configuration failed (${messageOf(error)})`,
    );
    return 1;
  }

  terminal.writeOut(
    `auren.json written to ${projectDir}/auren.json\nNext steps: run "auren search" to browse blocks and "auren add" to install one.\n`,
  );

  return 0;
}

function assembleConfiguration(
  detection: ProjectDetection,
  components: string,
): SchemaConfiguration {
  const configuration: AurenConfiguration = {
    framework: detection.framework ?? "react",
    tailwind: true,
    components,
  };

  if (
    detection.shadcn.detected &&
    Object.keys(detection.shadcn.aliases).length > 0
  ) {
    configuration.aliases = { ...detection.shadcn.aliases };
    configuration.integrations = { shadcn: { enabled: true } };
  }

  const parsed = aurenConfigurationSchema.safeParse(configuration);

  if (!parsed.success) {
    throw new Error(
      `Could not initialize Auren: invalid configuration (${parsed.error.message})`,
    );
  }

  return parsed.data;
}

function renderDetectionSummary(
  terminal: Terminal,
  detection: ProjectDetection,
): void {
  const shadcn = detection.shadcn.detected ? "detected" : "not detected";
  const tailwind = detection.tailwind.detected
    ? detection.tailwind.major === null
      ? "found (unknown version)"
      : `found (v${detection.tailwind.major})`
    : "not found";
  const typescript = detection.typescript ? "TypeScript" : "JavaScript";
  const packageManager = detection.packageManager?.name ?? "unknown";

  terminal.writeOut(
    `Detected ${detection.framework ?? "unknown framework"} project (${typescript}, Tailwind CSS ${tailwind}, shadcn/ui ${shadcn}, ${packageManager})\n`,
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
