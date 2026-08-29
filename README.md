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
├── marketing/           # Catalog source, not a workspace package
├── application-ui/      # Catalog source, not a workspace package
├── ecommerce/           # Catalog source, not a workspace package
└── authentication/      # Catalog source, not a workspace package
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
pnpm lint
pnpm format
pnpm lint:fix
pnpm format:fix
pnpm build
pnpm dev
```

`pnpm check` validates workspace topology and shared configuration without generating the Registry. `pnpm registry:build` validates the source catalog and writes the distributable `dist/registry/registry.json` plus one detail file per block; it also accepts `-- --blocks-root <path> --output-root <path>` through the executable for isolated builds. `pnpm typecheck` runs each shell through Turborepo. `pnpm test` runs package tests through the same graph. `lint` and `format` are read-only Biome checks; only their `:fix` variants write changes. `build` runs workspace builds and then produces the ignored `dist/registry` artifact; `dev` remains the Turborepo entry point for later implementation specs.

## Shared Conventions

- Root `tsconfig.base.json` owns universal strictness and module resolution. Node shells extend `tsconfig.node.json`; browser applications extend `tsconfig.web.json`.
- Every workspace keeps a minimal local `tsconfig.json` whose inputs stay inside that workspace. Do not repeat base/profile options locally.
- Workspace names use `@auren/<package>`. Cross-workspace imports use those package names, never relative paths into another workspace's source.
- Internal dependencies use the destination manifest name with the exact range `workspace:*`.
- `@auren/schemas` exposes direct capability entrypoints for `element`, `taxonomy`, and `catalog`; its source uses the local `@/*` path alias without a root barrel.
- Root Biome configuration is the only formatting, lint, and import-organization policy. Do not add workspace-level Biome, ESLint, or Prettier configuration.
- Shell manifests remain private ESM packages at version `0.0.0` and expose only `typecheck` until a product spec introduces a real entrypoint.

## Bootstrap Limits

The `@auren/schemas` package provides the structural element contract and the official catalog taxonomy. It does not implement Registry behavior, block content, Core, CLI, MCP, or a functional Web application. Storage, indexing, dependency resolution, local source aliases, CI, backend services, authentication, payments, and framework adapters remain scoped to later changes in the implementation order documented in `docs/listado-specs.md`.
