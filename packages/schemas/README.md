# @auren/schemas

`@auren/schemas` is the structural contract for an Auren catalog element. It
exports Zod schemas and TypeScript types from its package entrypoint. It does
not choose the official catalog taxonomy or access the filesystem.

## Public API

```ts
import {
  aurenElementSchema,
  type AurenElement,
} from "@auren/schemas";

const result = aurenElementSchema.safeParse(input);
if (result.success) {
  const element: AurenElement = result.data;
}
```

The entrypoint also exports the reusable dependency, file, metadata, key,
classification, path, and kind schemas. `AurenElement`, `AurenDependency`,
`AurenFile`, and `AurenMetadata` are inferred from those schemas.

## Element Fields

Every element must contain exactly these twelve top-level fields:

| Field | Shape and invariants |
| --- | --- |
| `id` | Lowercase kebab-case key, at most 100 characters. |
| `name` | Non-empty string, at most 100 characters. |
| `description` | Non-empty string, at most 1,000 characters. |
| `category` | Lowercase kebab-case key, at most 100 characters. |
| `type` | Lowercase kebab-case key, at most 100 characters. |
| `styles` | Array of unique lowercase kebab-case keys; may be empty. |
| `industries` | Array of unique lowercase kebab-case keys; may be empty. |
| `features` | Array of unique lowercase kebab-case keys; may be empty. |
| `frameworks` | Array of unique lowercase kebab-case keys with at least one value. |
| `dependencies` | Array of strict typed package or Auren descriptors; duplicate pairs are rejected. |
| `files` | At least one strict file descriptor; source paths are unique and safe. |
| `metadata` | Plain object containing only recursively JSON-safe values. |

Keys contain only ASCII lowercase letters, digits, and single hyphen
separators. The schema validates key syntax but does not validate membership
in an official taxonomy.

## Dependencies

External packages use this shape:

```json
{
  "kind": "package",
  "name": "@acme/ui",
  "version": "^1.2.0"
}
```

References to another Auren element use this shape:

```json
{
  "kind": "auren",
  "id": "button-001"
}
```

Both objects are strict. Package names and version ranges must be non-empty
strings. Auren dependency ids use the same key rules as element ids. A
dependency cannot point to the element that contains it, and each kind plus
identifier pair can appear only once.

## Files

Supported `kind` values are `component`, `utility`, `style`, and `asset`.
`target` and `content` are optional. `path` and `target` must be non-empty
relative POSIX paths. They cannot be absolute, use backslashes, contain `.` or
`..` segments, contain empty path segments, or use a Windows drive prefix.

## Metadata

Metadata may use future domain keys, including an empty object. Values are
limited recursively to strings, finite numbers, booleans, `null`, arrays, and
plain objects. Functions, `undefined`, symbols, dates, maps, class instances,
`NaN`, and infinities are rejected.

## Canonical Example

```json
{
  "id": "hero-001",
  "name": "Product launch hero",
  "description": "A responsive hero section with a product screenshot and two calls to action.",
  "category": "marketing",
  "type": "hero",
  "styles": ["minimal", "dark-mode"],
  "industries": ["saas", "ai"],
  "features": ["responsive", "product-screenshot", "two-cta"],
  "frameworks": ["react"],
  "dependencies": [
    {
      "kind": "package",
      "name": "@acme/ui",
      "version": "^1.2.0"
    },
    {
      "kind": "auren",
      "id": "button-001"
    }
  ],
  "files": [
    {
      "path": "component.tsx",
      "kind": "component",
      "target": "src/components/hero.tsx",
      "content": "export function Hero() { return null; }"
    },
    {
      "path": "hero.css",
      "kind": "style",
      "content": ".hero { display: grid; }"
    }
  ],
  "metadata": {
    "author": "Auren",
    "featured": true,
    "score": 4.5,
    "tags": ["conversion", "landing-page"]
  }
}
```

This example is structurally valid. A later taxonomy change may refine the
allowed values for `category`, `type`, styles, industries, features, or
frameworks without changing this base representation.
