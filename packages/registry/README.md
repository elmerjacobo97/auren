# @auren/registry

`@auren/registry` provides Auren's local in-memory catalog. It validates complete
catalog elements, enforces unique IDs, maintains taxonomy indexes, and returns
results in registration order.

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
```

The root entrypoint exports:

- `LocalRegistry`, with `size`, `register`, `registerMany`, `getById`, `has`,
  `list`, and `query`.
- `RegistryFilter`, typed from the official schemas taxonomy.
- `DuplicateElementError`, which exposes the conflicting `id`.

## Registration

`register` and `registerMany` accept unknown runtime values and validate them
with `catalogElementSchema`. Structural errors, unofficial classifications,
unsafe files, invalid dependencies, duplicate classifications, and non-JSON
metadata throw the original Zod error with its issue paths.

Registration does not trim, recase, coerce, default, or remove accepted values.
IDs are unique. A duplicate existing ID or repeated ID in one batch throws
`DuplicateElementError`. Batch validation and duplicate checks finish before
commit, so failed batches add nothing.

## Queries

`query` supports exact `category` and `type` filters plus membership filters for
`style`, `industry`, `feature`, and `framework`. Every supplied filter uses AND
semantics. `query()` and `query({})` return the complete catalog.

`metadata` is a partial top-level filter. Every requested key must exist. Its
value uses recursive JSON equality: object key order is ignored, array order is
significant, and nested objects or arrays must match as complete values.

`list` and `query` always preserve successful registration order.

## State Isolation

The Registry copies validated input before storage. Elements returned by
`register`, `registerMany`, `getById`, `list`, and `query` are independent deep
copies. Mutating caller-owned input or a result cannot alter stored elements,
taxonomy indexes, or later results.

## Limits

The catalog exists only for the lifetime of the `LocalRegistry` instance. This
package does not persist data, read `blocks/`, scan files, build or publish a
remote Registry, provide Collections, or implement Core or CLI behavior. Those
capabilities belong to later specs.
