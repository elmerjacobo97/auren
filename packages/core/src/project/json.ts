import { readOptionalFile } from "./fs.js";

export type OptionalJsonFile =
  | {
      readonly state: "absent";
      readonly relativePath: string;
      readonly absolutePath: string;
    }
  | {
      readonly state: "parsed";
      readonly relativePath: string;
      readonly absolutePath: string;
      readonly value: unknown;
    }
  | {
      readonly state: "unreadable" | "malformed";
      readonly relativePath: string;
      readonly absolutePath: string;
      readonly cause: unknown;
    };

export type OptionalJsonReadFailure = Extract<
  OptionalJsonFile,
  { readonly state: "unreadable" | "malformed" }
>;

export async function readOptionalJson(
  projectDir: string,
  relativePath: string,
  mode: "json" | "jsonc",
): Promise<OptionalJsonFile> {
  const file = await readOptionalFile(projectDir, relativePath);

  if (file.state !== "present") {
    return file;
  }

  try {
    return {
      state: "parsed",
      relativePath,
      absolutePath: file.absolutePath,
      value: JSON.parse(
        mode === "jsonc" ? stripJsonc(file.content) : file.content,
      ),
    };
  } catch (cause) {
    return {
      state: "malformed",
      relativePath,
      absolutePath: file.absolutePath,
      cause,
    };
  }
}

function stripJsonc(source: string): string {
  let output = "";
  let inString = false;
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1];

    if (inString) {
      output += current;

      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === quote) {
        inString = false;
        quote = null;
      }

      continue;
    }

    if (current === '"' || current === "'") {
      inString = true;
      quote = current;
      output += current;
      continue;
    }

    if (current === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      output += "\n";
      continue;
    }

    if (current === "/" && next === "*") {
      index += 2;
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
        output += source[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      index += 1;
      continue;
    }

    output += current;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
}
