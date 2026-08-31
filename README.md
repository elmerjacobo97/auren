# Auren

Auren is a monorepo for a component and block registry. This repository currently contains the executable foundation only; product behavior is added by later specs.

## Topology

```text
apps/
└── web/                 # Private application shell

packages/
├── schemas/             # Canonical element schema, taxonomy, and inferred types
├── registry/            # Private package shell
├── core/                # Private package shell
├── cli/                 # Private package shell
└── mcp/                 # Private package shell

blocks/
├── marketing/           # Block catalog source, not a workspace package
├── application-ui/      # Block catalog source, not a workspace package
├── ecommerce/           # Block catalog source, not a workspace package
└── authentication/      # Block catalog source, not a workspace package

collections/
└── <category>/<collection-id>/registry.json  # Metadata-only compositions
```

Only `apps/*` and `packages/*` are pnpm workspace globs. The `blocks/` tree is versioned catalog content and is intentionally excluded from dependency installation.

## Requirements

- Node.js `>=20.19.0 <26`
- pnpm `11.21.0`

The root `package.json` pins pnpm through `packageManager` and keeps the bootstrap tools on exact versions.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm registry:build
pnpm registry:publish
pnpm lint
pnpm format
pnpm lint:fix
pnpm format:fix
pnpm build
pnpm dev
```

`pnpm check` validates workspace topology, block manifests, and Collection manifests without generating the Registry. `pnpm registry:build` validates both source catalogs and writes the distributable `dist/registry/registry.json`, block details, and metadata-only `collections/<id>.json` details; it accepts `-- --blocks-root <path> --collections-root <path> --output-root <path>` for isolated builds. `pnpm registry:publish` builds that Registry and publishes a validated, byte-preserving static copy under `dist/public-registry`; direct publication accepts `-- --registry-root <path> --output-root <path>`. `pnpm typecheck` runs each shell through Turborepo. `pnpm test` runs package tests through the same graph. `lint` and `format` are read-only Biome checks; only their `:fix` variants write changes. `build` runs workspace builds and then produces the ignored `dist/registry` and `dist/public-registry` artifacts; `dev` remains the Turborepo entry point for later implementation specs.

### CLI Registry source

`auren info`, `auren search`, and `auren add` use the public Registry document root
`https://auren.elmerjacobo.dev/` by default. Override it per command or process:

```bash
auren search hero --registry-url https://staging.example.test/auren/
AUREN_REGISTRY_URL=https://staging.example.test/auren auren info hero-001
```

Endpoint precedence is `--registry-url`, then `AUREN_REGISTRY_URL`, then the
production default. A valid endpoint is an `http` or `https` static document
root exposing `registry.json`, `blocks/<id>.json`, and, for a collection-aware
index, `collections/<id>.json`; it cannot contain credentials, a query, or a
fragment. The CLI does not write the endpoint to `auren.json`, persist a
catalog cache, inspect a local `blocks/` checkout, or fall back to one when the
remote Registry is unavailable. `info` and `search` request only
`registry.json`; `add` requests detail files only for the resolved installation
chain.

### Collection installation

Collections are metadata-only compositions of existing blocks. Install a
single block with its plain ID or install an authored Collection explicitly:

```bash
auren add hero-001
auren add collection/saas-minimal
```

The Collection detail preserves member order; Core then deduplicates shared
transitive Auren dependencies in dependency-safe deep-first order. Every
resolved block is checked against the consumer's React/Tailwind v4 project and
is installed below `components/<block-id>/...`. Package and shadcn requirements
are consolidated before writes. Planning failures leave consumer files and
catalog sources unchanged; external package or shadcn changes are not rolled
back if that external tool has already succeeded.

## Shared Conventions

- Root `tsconfig.base.json` owns universal strictness and module resolution. Node shells extend `tsconfig.node.json`; browser applications extend `tsconfig.web.json`.
- Every workspace keeps a minimal local `tsconfig.json` whose inputs stay inside that workspace. Do not repeat base/profile options locally.
- Workspace names use `@auren/<package>`. Cross-workspace imports use those package names, never relative paths into another workspace's source.
- Internal dependencies use the destination manifest name with the exact range `workspace:*`.
- `@auren/schemas` exposes direct capability entrypoints for `element`, `taxonomy`, `catalog`, `configuration`, and `collection`; its source uses the local `@/*` path alias without a root barrel.
- Root Biome configuration is the only formatting, lint, and import-organization policy. Do not add workspace-level Biome, ESLint, or Prettier configuration.
- Shell manifests remain private ESM packages at version `0.0.0` and expose only `typecheck` until a product spec introduces a real entrypoint.

## Bootstrap Limits

The `@auren/schemas` package provides the structural element contract and the official catalog taxonomy. It does not implement Registry behavior, block content, Core, CLI, MCP, or a functional Web application. Storage, indexing, dependency resolution, local source aliases, CI, backend services, authentication, payments, and framework adapters remain scoped to later changes in the implementation order documented in `docs/listado-specs.md`.
