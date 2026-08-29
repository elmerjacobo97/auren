const canonicalUiPrefix = "@/components/ui/";

export function rewriteShadcnImports(source: string, uiAlias: string): string {
  if (uiAlias === "@/components/ui") {
    return source;
  }

  const replacements: Array<{
    readonly start: number;
    readonly end: number;
  }> = [];

  for (let index = 0; index < source.length; ) {
    const current = source[index];

    if (current === "/" && source[index + 1] === "/") {
      index = skipLineComment(source, index + 2);
      continue;
    }

    if (current === "/" && source[index + 1] === "*") {
      index = skipBlockComment(source, index + 2);
      continue;
    }

    if (current === '"' || current === "'" || current === "`") {
      index = skipString(source, index, current);
      continue;
    }

    if (!isIdentifierStart(current)) {
      index += 1;
      continue;
    }

    const tokenStart = index;
    index += 1;

    while (index < source.length && isIdentifierPart(source[index])) {
      index += 1;
    }

    const token = source.slice(tokenStart, index);

    if (
      (token === "import" || token === "require") &&
      source[tokenStart - 1] === "."
    ) {
      continue;
    }

    let argumentIndex = skipWhitespace(source, index);

    if (token === "import") {
      if (source[argumentIndex] === "(") {
        argumentIndex = skipWhitespace(source, argumentIndex + 1);
      } else if (
        source[argumentIndex] !== '"' &&
        source[argumentIndex] !== "'"
      ) {
        continue;
      }
    } else if (token === "require") {
      if (source[argumentIndex] !== "(") {
        continue;
      }
      argumentIndex = skipWhitespace(source, argumentIndex + 1);
    } else if (token !== "from") {
      continue;
    }

    const quote = source[argumentIndex];

    if (quote !== '"' && quote !== "'") {
      continue;
    }

    const stringEnd = readStringEnd(source, argumentIndex, quote);

    if (stringEnd === null) {
      break;
    }

    const specifier = source.slice(argumentIndex + 1, stringEnd);

    if (specifier.startsWith(canonicalUiPrefix)) {
      replacements.push({
        start: argumentIndex + 1,
        end: stringEnd,
      });
    }

    index = stringEnd + 1;
  }

  if (replacements.length === 0) {
    return source;
  }

  let rewritten = "";
  let cursor = 0;

  for (const replacement of replacements) {
    rewritten += source.slice(cursor, replacement.start);
    const specifier = source.slice(replacement.start, replacement.end);
    rewritten += `${uiAlias}/${specifier.slice(canonicalUiPrefix.length)}`;
    cursor = replacement.end;
  }

  return rewritten + source.slice(cursor);
}

function skipWhitespace(source: string, index: number): number {
  while (index < source.length && /\s/.test(source[index])) {
    index += 1;
  }

  return index;
}

function skipLineComment(source: string, index: number): number {
  while (index < source.length && source[index] !== "\n") {
    index += 1;
  }

  return index;
}

function skipBlockComment(source: string, index: number): number {
  const end = source.indexOf("*/", index);
  return end === -1 ? source.length : end + 2;
}

function skipString(source: string, index: number, quote: string): number {
  const end = readStringEnd(source, index, quote);
  return end === null ? source.length : end + 1;
}

function readStringEnd(
  source: string,
  index: number,
  quote: string,
): number | null {
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === "\\") {
      cursor += 1;
      continue;
    }

    if (source[cursor] === quote) {
      return cursor;
    }
  }

  return null;
}

function isIdentifierStart(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z_$]/.test(value);
}

function isIdentifierPart(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z0-9_$]/.test(value);
}
