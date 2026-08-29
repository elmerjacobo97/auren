import { diagnostic } from "./diagnostics.js";
import { readOptionalJson } from "./json.js";
import { asObject } from "./object.js";
import type { ProjectDetectionDiagnostic, ShadcnDetection } from "./types.js";

export async function detectShadcn(
  projectDir: string,
  diagnostics: ProjectDetectionDiagnostic[],
): Promise<ShadcnDetection> {
  const componentsJson = await readOptionalJson(
    projectDir,
    "components.json",
    "json",
  );
  const detected = componentsJson.state !== "absent";

  if (
    componentsJson.state === "unreadable" ||
    componentsJson.state === "malformed"
  ) {
    diagnostics.push(
      diagnostic(
        componentsJson.state === "malformed" ? "error" : "warning",
        componentsJson.state === "malformed"
          ? "malformed-json"
          : "unreadable-file",
        "Could not read components.json",
        "components.json",
        componentsJson.cause,
      ),
    );
  }

  if (componentsJson.state !== "parsed") {
    return {
      detected,
      configPath: detected ? "components.json" : null,
      aliases: {},
      uiAlias: null,
      tsx: null,
    };
  }

  return parseShadcnConfig(componentsJson.value, diagnostics, detected);
}

function parseShadcnConfig(
  value: unknown,
  diagnostics: ProjectDetectionDiagnostic[],
  detected: boolean,
): ShadcnDetection {
  const config = asObject(value);

  if (config === null) {
    diagnostics.push(
      diagnostic(
        "warning",
        "invalid-shadcn-config",
        "components.json must contain a JSON object",
        "components.json",
      ),
    );

    return {
      detected,
      configPath: "components.json",
      aliases: {},
      uiAlias: null,
      tsx: null,
    };
  }

  const rawAliases = config.aliases;
  const aliases = asObject(rawAliases);

  if (rawAliases !== undefined && aliases === null) {
    diagnostics.push(
      diagnostic(
        "warning",
        "invalid-shadcn-config",
        "components.json aliases must be an object",
        "components.json",
      ),
    );
  }

  const extractedAliases: Record<string, string> = {};

  for (const [alias, target] of Object.entries(aliases ?? {})) {
    if (typeof target === "string") {
      extractedAliases[alias] = target;
    } else {
      diagnostics.push(
        diagnostic(
          "warning",
          "invalid-shadcn-config",
          `components.json aliases.${alias} must be a string`,
          "components.json",
        ),
      );
    }
  }

  let uiAlias: string | null = null;

  if (typeof aliases?.ui === "string") {
    uiAlias = aliases.ui;
  }

  let tsx: boolean | null = null;

  if (config.tsx !== undefined) {
    if (typeof config.tsx === "boolean") {
      tsx = config.tsx;
    } else {
      diagnostics.push(
        diagnostic(
          "warning",
          "invalid-shadcn-config",
          "components.json tsx must be a boolean",
          "components.json",
        ),
      );
    }
  }

  return {
    detected,
    configPath: "components.json",
    aliases: extractedAliases,
    uiAlias,
    tsx,
  };
}
