# Auren Collection Standard

Collections are versioned, metadata-only compositions of existing blocks. Each
Collection lives at `collections/<category>/<collection-id>/registry.json` and
must reference block IDs already present in the canonical `blocks/` catalog.

## Source layout

```text
collections/
└── <category>/
    └── <collection-id>/
        └── registry.json
```

The manifest is validated by the public `@auren/schemas/collection` entrypoint.
Its `category` and `id` must match the directory path, and `blocks` preserves
the authored member order. Collection directories contain only `registry.json`;
block files, dependency descriptors, and installation targets remain owned by
the referenced blocks.

A Collection manifest contains the following metadata:

| Field | Meaning |
| --- | --- |
| `id`, `name`, `description` | Stable kebab-case identity and human-readable copy |
| `category` | One of the four supported catalog categories |
| `styles`, `industries`, `features`, `frameworks` | Ordered, unique taxonomy values |
| `blocks` | Ordered, unique IDs of existing catalog blocks |
| `metadata` | Recursive JSON-safe author metadata |

Collections do not add `type`, `files`, `dependencies`, `target`, or `content`.
The source verifier checks every member exists and supports every declared
Collection framework. Run `pnpm check` after changing this tree.

## Public Registry resources

`pnpm registry:build` emits the metadata-only Collection index entries in
`registry.json.collections` and one detail resource at
`collections/<collection-id>.json`. `pnpm registry:publish` copies those exact
JSON bytes into the deployable static document root. A host serving that root
must provide anonymous `GET` and `HEAD` responses with
`application/json; charset=utf-8` for:

- `/registry.json`
- `/blocks/<block-id>.json`
- `/collections/<collection-id>.json` when the index contains Collections

The host should preserve bytes, support browser CORS (normally
`Access-Control-Allow-Origin: *`), and allow revalidation of `registry.json`.
No host URL or deployment configuration is written into a resource. Legacy
block-only roots with no `collections` field or directory remain readable.

## Installation

The CLI treats plain IDs as blocks and only the explicit
`collection/<collection-id>` form as a Collection selector:

```bash
auren add collection/saas-minimal
```

Core returns the direct members in authored order and a globally deduplicated,
dependency-safe deep-first block order for installation. The CLI validates the
complete closure and all file targets before its first write, consolidates
package and shadcn requirements, and uses the existing ID-specific block
target convention. `--force` is required to replace an existing target.

If an external package manager or shadcn runner has already changed a manifest,
lockfile, or shared UI file, those external changes are not automatically
uninstalled when a later Auren file write fails. Auren's own planned files are
written atomically with rollback and temporary-file cleanup where possible.
