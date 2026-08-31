import { InvalidAddSelectorError } from "./add-errors.js";

export type AddSelector =
  | { readonly kind: "block"; readonly id: string }
  | { readonly kind: "collection"; readonly id: string };

export function parseAddSelector(value: string): AddSelector {
  if (value.startsWith("collection/")) {
    const id = value.slice("collection/".length);

    if (!idPattern.test(id)) {
      throw new InvalidAddSelectorError(value);
    }

    return { kind: "collection", id };
  }

  if (!idPattern.test(value)) {
    throw new InvalidAddSelectorError(value);
  }

  return { kind: "block", id: value };
}

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
