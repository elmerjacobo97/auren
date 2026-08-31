import {
  DuplicateCollectionError,
  DuplicateElementError,
  IncompatibleCollectionError,
  LocalRegistry,
  MissingCollectionBlockError,
} from "@auren/registry";

const registry = new LocalRegistry();
const block = {
  id: "hero-001",
  name: "Hero",
  description: "A hero block.",
  category: "marketing",
  type: "hero",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["responsive"],
  frameworks: ["react"],
  dependencies: [],
  files: [{ path: "component.tsx", kind: "component" }],
  metadata: {},
};
const collection = {
  id: "saas-minimal",
  name: "SaaS Minimal",
  description: "A minimal SaaS collection.",
  category: "marketing",
  styles: ["minimal"],
  industries: ["saas"],
  features: ["responsive"],
  frameworks: ["react"],
  blocks: ["hero-001"],
  metadata: {},
};

registry.register(block);
const registeredCollection = registry.registerCollection(collection);

if (
  registry.size !== 1 ||
  registry.collectionSize !== 1 ||
  registry.getCollectionById("saas-minimal")?.id !== registeredCollection.id ||
  DuplicateElementError.name !== "DuplicateElementError" ||
  DuplicateCollectionError.name !== "DuplicateCollectionError" ||
  MissingCollectionBlockError.name !== "MissingCollectionBlockError" ||
  IncompatibleCollectionError.name !== "IncompatibleCollectionError"
) {
  throw new Error(
    "Registry package entrypoint did not expose the built block and Collection API",
  );
}
