import { asObject } from "./object.js";
import type { JsonObject } from "./types.js";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export function collectDependencies(
  manifest: JsonObject | null,
): Readonly<Record<string, string>> {
  const dependencies: Record<string, string> = {};

  for (const section of dependencySections) {
    const values = asObject(manifest?.[section]);

    for (const [name, range] of Object.entries(values ?? {})) {
      if (typeof range === "string") {
        dependencies[name] = range;
      }
    }
  }

  return dependencies;
}
