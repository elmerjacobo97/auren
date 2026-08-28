# Auren Agent Instructions

## Current State

- This is a pnpm 11.21.0/Turborepo monorepo requiring Node `>=20.19.0 <26`.
- `@auren/schemas` defines catalog contracts and `@auren/registry` provides the local in-memory Registry. `apps/web`, `packages/core`, `packages/cli`, and `packages/mcp` remain private `export {}` shells.
- `pnpm build` builds Schemas before Registry; `pnpm dev` has no workspace implementation yet.
- `blocks/` is versioned catalog source, not a workspace. Never add package manifests beneath it.

## Commands

- Install reproducibly: `pnpm install --frozen-lockfile`.
- Validate pinned topology, manifests, exports, aliases, and shared config: `pnpm check`.
- Run repository gates: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm build`.
- Run schemas only: `pnpm --filter @auren/schemas typecheck`, `pnpm --filter @auren/schemas test`, or `pnpm --filter @auren/schemas build`.
- Run one schemas test: `pnpm --filter @auren/schemas exec vitest run src/<capability>/<file>.test.ts`.
- Run Registry only: `pnpm --filter @auren/registry typecheck`, `pnpm --filter @auren/registry test`, or `pnpm --filter @auren/registry... build`.
- Run the Registry contract test: `pnpm --filter @auren/registry exec vitest run src/index.test.ts`.
- `lint` and `format` are read-only; `lint:fix` and `format:fix` write changes.
- No CI or pre-commit gate exists; local verification is authoritative.

## Architecture

- Before designing or implementing, read `docs/architecture.md`, `docs/stack.md`, and `docs/listado-specs.md`; OpenSpec designs must follow `docs/architecture.md`.
- `docs/stack.md` mixes implemented foundation with roadmap. Trust manifests, config, and source when they differ.
- Follow `docs/listado-specs.md` implementation order; each spec is intended to complete independently.
- Use `docs/modelo-negocio.md` for domain terminology and `packages/schemas/README.md` for schema invariants and taxonomy.
- Work only from this repository; never import code or assumptions from sibling projects.

## Repository Contracts

- `scripts/verify-workspace.mjs` pins workspace names, directories, scripts, versions, Schemas/Registry exports, aliases, and TypeScript profiles. Run `pnpm check` after changing any of them.
- Keep tests beside implementations and organize growing source by domain/capability; avoid flat `src/` layouts and premature abstractions.
- Avoid re-export-only barrel files. `@auren/schemas` intentionally has no root export; import `@auren/schemas/element`, `/taxonomy`, or `/catalog`.
- Inside `packages/schemas`, use `@/*` across capabilities and relative imports within one capability. Cross-workspace imports use `@auren/<package>` with `workspace:*`, never source-relative paths.
- Registry is in-memory only: persistence, loading `blocks/`, remote Registry output, Collections, Core, and CLI behavior remain later specs.
- Keep TypeScript defaults in root profiles and Biome policy in root `biome.json`; workspace configs should only narrow inputs or declare verified aliases.
- `dist/`, coverage, and Turbo output are generated and ignored; edit source/config, not generated artifacts.
