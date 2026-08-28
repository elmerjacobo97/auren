import { DuplicateElementError, LocalRegistry } from "@auren/registry";

const registry = new LocalRegistry();

if (
  registry.size !== 0 ||
  DuplicateElementError.name !== "DuplicateElementError"
) {
  throw new Error(
    "Registry package entrypoint did not expose the built public API",
  );
}
