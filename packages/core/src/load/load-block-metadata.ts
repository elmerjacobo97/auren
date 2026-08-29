import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  catalogElementSchema,
  type CatalogElement,
} from "@auren/schemas/catalog";

function failureMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export class BlockMetadataError extends Error {
  constructor(
    readonly blockDir: string,
    override cause: unknown,
  ) {
    super(
      `Failed to load block metadata from "${blockDir}": ${failureMessage(cause)}`,
      { cause },
    );
    this.name = "BlockMetadataError";
  }
}

export async function loadBlockMetadata(
  blockDir: string,
): Promise<CatalogElement> {
  let raw: string;

  try {
    raw = await readFile(path.join(blockDir, "registry.json"), "utf8");
  } catch (cause) {
    throw new BlockMetadataError(blockDir, cause);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new BlockMetadataError(blockDir, cause);
  }

  try {
    return catalogElementSchema.parse(parsed);
  } catch (cause) {
    throw new BlockMetadataError(blockDir, cause);
  }
}
