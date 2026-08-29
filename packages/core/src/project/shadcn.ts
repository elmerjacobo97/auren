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

  return {
    detected,
    configPath: detected ? "components.json" : null,
    aliases:
      componentsJson.state === "parsed"
        ? extractShadcnAliases(componentsJson.value)
        : {},
  };
}

function extractShadcnAliases(
  value: unknown,
): Readonly<Record<string, string>> {
  const aliases = asObject(asObject(value)?.aliases);
  const result: Record<string, string> = {};

  for (const [alias, target] of Object.entries(aliases ?? {})) {
    if (typeof target === "string") {
      result[alias] = target;
    }
  }

  return result;
}
