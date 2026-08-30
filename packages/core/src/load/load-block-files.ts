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
  const loadedFiles = await Promise.all(
    element.files.map(async (file) => {
      if (file.content !== undefined) {
        return {
          file: {
            path: file.path,
            kind: file.kind,
            target: file.target,
            content: file.content,
          },
          missingPath: null,
        };
      }

      try {
        const content = await readFile(path.join(blockDir, file.path), "utf8");
        return {
          file: {
            path: file.path,
            kind: file.kind,
            target: file.target,
            content,
          },
          missingPath: null,
        };
      } catch {
        return { file: null, missingPath: file.path };
      }
    }),
  );

  const missingFile = loadedFiles.find((result) => result.missingPath !== null);

  if (missingFile !== undefined && missingFile.missingPath !== null) {
    throw new MissingBlockFileError(missingFile.missingPath);
  }

  return loadedFiles.flatMap((result) =>
    result.file === null ? [] : [result.file],
  );
}
