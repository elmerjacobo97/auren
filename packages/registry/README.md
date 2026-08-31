# @auren/registry

`@auren/registry` provides Auren's local in-memory catalog. It validates complete
catalog elements and Collections, enforces namespaced unique IDs, maintains
classification indexes, and returns results in registration order.

## Public API

```ts
import { LocalRegistry } from "@auren/registry";

const registry = new LocalRegistry();

registry.register(element);
registry.registerMany(moreElements);

const hero = registry.getById("hero-001");
const minimalSaasHeroes = registry.query({
  category: "marketing",
  type: "hero",
  style: "minimal",
  industry: "saas",
});

registry.registerCollection({
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
});

const collections = registry.queryCollections({
  style: "minimal",
  framework: "react",
});
```

The root entrypoint exports:

- `LocalRegistry`, with the block API (`size`, `register`, `registerMany`,
  `getById`, `has`, `list`, and `query`) and the namespaced Collection API
  (`collectionSize`, `registerCollection`, `registerCollections`,
  `getCollectionById`, `hasCollection`, `listCollections`, and
  `queryCollections`).
- `RegistryFilter` and `CollectionFilter`, typed from the official schemas
  taxonomy. Collection filters intentionally have no block `type` field.
- `DuplicateElementError`, `DuplicateCollectionError`,
  `MissingCollectionBlockError`, and `IncompatibleCollectionError`.

## Registration

`register` and `registerMany` accept unknown runtime values and validate them
with `catalogElementSchema`. Structural errors, unofficial classifications,
unsafe files, invalid dependencies, duplicate classifications, and non-JSON
metadata throw the original Zod error with its issue paths.

`registerCollection` and `registerCollections` validate with
`collectionSchema`, then require every referenced block to be registered and
to support every declared Collection framework. Missing members throw
`MissingCollectionBlockError`; unsupported frameworks throw
`IncompatibleCollectionError`. Collection IDs are unique only within the
Collection namespace, and failed collection batches are atomic.

Registration does not trim, recase, coerce, default, or remove accepted values.
IDs are unique. A duplicate existing ID or repeated ID in one batch throws
`DuplicateElementError`. Batch validation and duplicate checks finish before
commit, so failed batches add nothing.

## Queries

`query` supports exact `category` and `type` filters plus membership filters for
`style`, `industry`, `feature`, and `framework`. Every supplied filter uses AND
semantics. `query()` and `query({})` return the complete block catalog.

`queryCollections` supports exact `category` plus membership filters for
`style`, `industry`, `feature`, and `framework`. Its filters also use AND
semantics and preserve Collection registration order. `queryCollections()` and
`queryCollections({})` return the complete Collection catalog.

`metadata` is a partial top-level filter. Every requested key must exist. Its
value uses recursive JSON equality: object key order is ignored, array order is
significant, and nested objects or arrays must match as complete values.

`list` and `query` always preserve successful registration order.

## State Isolation

The Registry copies validated input before storage. Elements returned by
`register`, `registerMany`, `getById`, `list`, and `query`, and Collections
returned by `registerCollection`, `registerCollections`, `getCollectionById`,
`listCollections`, and `queryCollections`, are independent deep copies.
Mutating caller-owned input or a result cannot alter stored records,
classification indexes, or later results.

## Limits

The catalogs exist only for the lifetime of the `LocalRegistry` instance. This
package does not persist data, read `blocks/`, scan files, build or publish a
remote Registry, or implement Core or CLI behavior. Collection installation and
transport belong to later specs.
