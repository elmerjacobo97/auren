# Auren

A versioned UI component and block catalog consumed by developers and coding agents.

## What is this?

A monorepo containing:

- **`packages/cli`** — `auren` CLI: `init`, `search`, `info`, `add`
- **`packages/core`** — Shared catalog logic: search, dependency resolution, project detection
- **`packages/registry`** — In-memory local registry with validated catalog elements
- **`packages/schemas`** — Zod contracts: element schema, taxonomy, catalog, configuration, collections
- **`apps/web`** — Public catalog web UI with block preview, filters, and copy-to-clipboard
- **`blocks/`** — Versioned block catalog source (11 blocks, 1 collection)
- **`collections/`** — Metadata-only block compositions

## Topology

```
apps/
└── web/                 # Public catalog UI

packages/
├── schemas/             # Zod contracts
├── registry/            # In-memory local registry
├── core/                # Shared catalog logic
├── cli/                 # auren CLI
└── mcp/                 # MCP tools (upcoming)

blocks/
├── marketing/
├── application-ui/
├── ecommerce/
└── authentication/

collections/
└── <category>/<collection-id>/registry.json
```

Only `apps/*` and `packages/*` are pnpm workspace globs. `blocks/` is versioned catalog source and is excluded from dependency installation.

## Requirements

- Node.js `>=20.19.0 <26`
- pnpm `11.21.0`

## Quick Start

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Commands

```bash
pnpm check              # Validate workspace topology, blocks, collections
pnpm typecheck          # TypeScript across all packages
pnpm test              # Run all tests
pnpm lint              # Biome lint (read-only)
pnpm format            # Biome format (read-only)
pnpm build             # Build packages + publish Registry to dist/public-registry/
pnpm registry:build    # Build Registry (11 blocks, 1 collection)
pnpm registry:publish  # Publish Registry to dist/public-registry/
```

## CLI Usage

```bash
npx auren init               # Analyze project and create auren.json
npx auren search hero        # Search blocks
npx auren info hero-001      # Inspect a block
npx auren add hero-001       # Install a block
npx auren add collection/saas-minimal  # Install a collection
```

The CLI uses `https://registry.auren.elmerjacobo.dev/` as the default Registry URL. Override with `--registry-url` or `AUREN_REGISTRY_URL`.

## Deployment

- `https://auren.elmerjacobo.dev` hosts the public catalog Web application.
- `https://registry.auren.elmerjacobo.dev` hosts the static Registry document root.
- The `auren` CLI is published to npm only from `vX.Y.Z` release tags.

## Registry Contract

The Registry is a static document root. A valid endpoint exposes:

- `GET /registry.json`
- `GET /blocks/<id>.json`
- `GET /collections/<id>.json`

## License

MIT
