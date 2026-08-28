# @auren/schemas

`@auren/schemas` is the structural and taxonomy contract for an Auren catalog
element. It exports each capability from a direct package subpath. It does not
use a root barrel or access the filesystem.

## Public API

```ts
import { aurenElementSchema } from "@auren/schemas/element";
import type { AurenElement } from "@auren/schemas/element";
import { catalogElementSchema } from "@auren/schemas/catalog";
import type { CatalogElement } from "@auren/schemas/catalog";
import {
  categorySchema,
  categoryValues,
} from "@auren/schemas/taxonomy";

const result = catalogElementSchema.safeParse(input);
if (result.success) {
  const element: CatalogElement = result.data;
}

const category = categorySchema.parse(categoryValues[0]);
const shapeOnlyResult = aurenElementSchema.safeParse(input);
const shapeOnlyElement: AurenElement | undefined = shapeOnlyResult.success
  ? shapeOnlyResult.data
  : undefined;
```

The package has three direct capability entrypoints:

- `@auren/schemas/element` exports the structural element and reusable
  dependency, file, metadata, key, classification, path, and kind schemas,
  plus `AurenElement`, `AurenDependency`, `AurenFile`, and `AurenMetadata`.
- `@auren/schemas/taxonomy` exports the six immutable value collections,
  dimension-specific schemas, and inferred taxonomy types.
- `@auren/schemas/catalog` exports `catalogElementSchema` and
  `CatalogElement`.

There is intentionally no `@auren/schemas` root export and no barrel file.

## Source Layout

Implementation and tests are colocated by capability:

- `src/element` contains the shape-only contract and structural invariants.
- `src/taxonomy` contains the official vocabulary source and dimension schemas.
- `src/catalog` contains the composed taxonomy-aware element contract.
- `src/element/fixtures` contains shared canonical examples.

## Element Fields

Every element must contain exactly these twelve top-level fields:

| Field | Shape and invariants |
| --- | --- |
| `id` | Lowercase kebab-case key, at most 100 characters. |
| `name` | Non-empty string, at most 100 characters. |
| `description` | Non-empty string, at most 1,000 characters. |
| `category` | Lowercase kebab-case key, at most 100 characters; `catalogElementSchema` requires an official category. |
| `type` | Lowercase kebab-case key, at most 100 characters; `catalogElementSchema` requires an official block type. |
| `styles` | Array of unique lowercase kebab-case keys; may be empty; catalog validation requires official styles. |
| `industries` | Array of unique lowercase kebab-case keys; may be empty; catalog validation requires official industries. |
| `features` | Array of unique lowercase kebab-case keys; may be empty; catalog validation requires official features. |
| `frameworks` | Array of unique lowercase kebab-case keys with at least one value; catalog validation requires official frameworks. |
| `dependencies` | Array of strict typed package or Auren descriptors; duplicate pairs are rejected. |
| `files` | At least one strict file descriptor; source paths are unique and safe. |
| `metadata` | Plain object containing only recursively JSON-safe values. |

Keys contain only ASCII lowercase letters, digits, and single hyphen
separators. `aurenElementSchema` validates key syntax but does not validate
membership in an official taxonomy. Use `catalogElementSchema` when the
element must use the official catalog vocabulary.

## Catalog Taxonomy

The taxonomy collections are the immutable source of truth for the public Zod
schemas and inferred TypeScript types. Values are listed in stable order and
must be used exactly as written.

| Dimension | Values collection | Schema | Type | Canonical identifiers |
| --- | --- | --- | --- | --- |
| Category | `categoryValues` | `categorySchema` | `Category` | `marketing`, `application-ui`, `ecommerce`, `authentication` |
| Block type | `blockTypeValues` | `blockTypeSchema` | `BlockType` | `hero`, `pricing`, `features`, `sidebar`, `table` |
| Style | `styleValues` | `styleSchema` | `Style` | `minimal`, `bold`, `editorial`, `corporate`, `glass`, `brutalist`, `luxury`, `developer` |
| Industry | `industryValues` | `industrySchema` | `Industry` | `saas`, `fintech`, `ai`, `developer-tools`, `ecommerce`, `education`, `portfolio`, `agency` |
| Feature | `featureValues` | `featureSchema` | `Feature` | `dark-mode`, `mobile-first`, `responsive`, `product-screenshot`, `two-cta`, `animated`, `sidebar`, `search`, `command-palette` |
| Framework | `frameworkValues` | `frameworkSchema` | `Framework` | `react` |

Membership is specific to each dimension even when spelling is shared:
`ecommerce` is both a category and an industry, and `sidebar` is both a block
type and a feature. `dark-mode` is a feature, not a style. No dimension implies
membership in another dimension.

## Choosing A Validator

Import `aurenElementSchema` from `@auren/schemas/element` for shape-only validation when a producer needs to
accept a syntactically valid future classification before the official catalog
has been updated. Import `catalogElementSchema` from `@auren/schemas/catalog` at catalog boundaries and for
published elements so every classification belongs to the corresponding
official dimension.

Individual values can be checked without constructing an element:

```ts
const categoryResult = categorySchema.safeParse("marketing");
const styleResult = styleSchema.safeParse("dark-mode"); // failure: feature only
```

Complete elements can be checked with the composed contract:

```ts
const result = catalogElementSchema.safeParse(input);
if (result.success) {
  const element: CatalogElement = result.data;
}
```

Neither path trims, recases, aliases, coerces, or silently removes a
classification. Unknown list values report the collection and item index in
the Zod issue path.

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
  "styles": ["minimal"],
  "industries": ["saas", "ai"],
  "features": ["responsive", "product-screenshot", "two-cta", "dark-mode"],
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

This example is valid under both `aurenElementSchema` and
`catalogElementSchema`. The structural schema remains open to future
kebab-case classifications; the composed schema enforces the official values
listed above.

## Extending The Taxonomy

Taxonomy changes are reviewed source changes. Add, remove, or rename a value
only by updating the corresponding immutable collection, its tests, the
affected fixtures, and this documentation in the same change. The schemas and
inferred types derive from the collection, so no second union or list should
be written.

Official values are not loaded from environment variables, JSON files, or
runtime configuration. Aliases, translations, and normalization are not part
of the contract; a migration or presentation layer must handle those concerns
explicitly if they are introduced later.
