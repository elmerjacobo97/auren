# Auren

Auren is a monorepo for a component and block registry. This repository currently contains the executable foundation only; product behavior is added by later specs.

## Topology

```text
apps/
└── web/                 # Private application shell

packages/
├── schemas/             # Private package shell
├── registry/            # Private package shell
├── core/                # Private package shell
├── cli/                 # Private package shell
└── mcp/                 # Private package shell

blocks/
├── marketing/           # Catalog source, not a workspace package
├── application/         # Catalog source, not a workspace package
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
pnpm build
pnpm typecheck
pnpm dev
```

`pnpm check` validates the workspace topology and configuration without external dependencies. `build`, `typecheck`, and `dev` are the root Turborepo entry points; package tasks will be added with the corresponding implementation specs.

## Bootstrap Limits

This change does not implement Schemas, Registry behavior, block content, Core, CLI, MCP, or a functional Web application. It also does not add Biome, aliases, testing, CI, backend services, authentication, payments, or framework adapters. Those concerns remain scoped to later changes in the implementation order documented in `docs/listado-specs.md`.
