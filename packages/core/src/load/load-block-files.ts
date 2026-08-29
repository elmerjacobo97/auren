import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogElement } from "@auren/schemas/catalog";
import type { AurenFile } from "@auren/schemas/element";

export type ResolvedBlockFile = {
  path: string;
  kind: AurenFile["kind"];
  target?: AurenFile["target"];
  content: string;
};

export class MissingBlockFileError extends Error {
  constructor(readonly missingPath: string) {
    super(`Block file not found: "${missingPath}"`);
    this.name = "MissingBlockFileError";
  }
}

export async function loadBlockFiles(
  blockDir: string,
  element: CatalogElement,
): Promise<readonly ResolvedBlockFile[]> {
  const resolvedFiles: ResolvedBlockFile[] = [];

  for (const file of element.files) {
    if (file.content !== undefined) {
      resolvedFiles.push({
        path: file.path,
        kind: file.kind,
        target: file.target,
        content: file.content,
      });
      continue;
    }

    let content: string;

    try {
      content = await readFile(path.join(blockDir, file.path), "utf8");
    } catch {
      throw new MissingBlockFileError(file.path);
    }

    resolvedFiles.push({
      path: file.path,
      kind: file.kind,
      target: file.target,
      content,
    });
  }

  return resolvedFiles;
}
