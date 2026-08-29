# Auren Agent Instructions

## Current State

- This is a pnpm 11.21.0/Turborepo monorepo requiring Node `>=20.19.0 <26`.
- `@auren/schemas` defines catalog contracts, `@auren/registry` provides the local in-memory Registry, `@auren/core` holds shared catalog logic (search, resolve, dependencies, loading, compatibility, project detection, configuration), and `@auren/cli` ships the `auren` bin with `--help`, `--version`, `init`, and `info`. `apps/web` and `packages/mcp` remain private `export {}` shells.
- `pnpm build` builds Schemas before Registry/Core/CLI; `pnpm dev` has no workspace implementation yet.
- `blocks/` is versioned catalog source, not a workspace, and now holds real catalog content across `marketing/`, `application-ui/`, `ecommerce/`, and `authentication/`. It follows the block standard in `blocks/README.md`; never add package manifests beneath it.

## Spec Progress

- Specs 01–14 in `docs/listado-specs.md` are implemented and archived; the next spec is Spec 15 — `auren search`.
- Keep the checkboxes in `docs/listado-specs.md` synchronized with implementation status, marking a spec only after its OpenSpec change is implemented and archived.
- Use `openspec/changes/archive/` as the record of completed changes; active OpenSpec work belongs under `openspec/changes/`.

## Commands

- Install reproducibly: `pnpm install --frozen-lockfile`.
- Validate pinned topology, manifests, exports, aliases, shared config, and the full `blocks/` tree (structure, id uniqueness, `registry.json` vs `catalogElementSchema`): `pnpm check`.
- Run repository gates: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, `pnpm build`.
- Root `check` and `test` build `@auren/schemas` first; `test` also runs the Node fixture tests for the blocks and workspace verifiers (`node --test scripts/verify-blocks.test.mjs scripts/verify-workspace.test.mjs`) before Turbo.
- Run schemas only: `pnpm --filter @auren/schemas typecheck`, `pnpm --filter @auren/schemas test`, or `pnpm --filter @auren/schemas build`.
- Run one schemas test: `pnpm --filter @auren/schemas exec vitest run src/<capability>/<file>.test.ts`.
- Run Registry only: `pnpm --filter @auren/registry typecheck`, `pnpm --filter @auren/registry test`, or `pnpm --filter @auren/registry... build`.
- Run the Registry contract test: `pnpm --filter @auren/registry exec vitest run src/index.test.ts`.
- Run Core or CLI gates: `pnpm --filter @auren/core <gate>` / `pnpm --filter @auren/cli <gate>`; both build with `tsc` + `scripts/verify-dist.mjs` and require Schemas (CLI also requires Core) built first.
- `lint` and `format` are read-only; `lint:fix` and `format:fix` write changes.
- No CI or pre-commit gate exists; local verification is authoritative.

## Architecture

- Before designing or implementing, read `docs/architecture.md`, `docs/stack.md`, and `docs/listado-specs.md`; OpenSpec designs must follow `docs/architecture.md`.
- `docs/stack.md` mixes implemented foundation with roadmap. Trust manifests, config, and source when they differ.
- Follow `docs/listado-specs.md` implementation order; each spec is intended to complete independently.
- Use `docs/modelo-negocio.md` for domain terminology and `packages/schemas/README.md` for schema invariants and taxonomy.
- Block work is governed by `blocks/README.md` (block standard); OpenSpec block specs live under `openspec/specs/`.
- Work only from this repository; never import code or assumptions from sibling projects.

## Repository Contracts

- `scripts/verify-workspace.mjs` pins workspace names, directories, scripts, versions, Schemas/Registry/Core exports, the CLI bin and dependencies, aliases, block categories, and TypeScript profiles. Run `pnpm check` after changing any of them.
- Keep tests beside implementations and organize growing source by domain/capability; avoid flat `src/` layouts and premature abstractions.
- Avoid re-export-only barrel files. `@auren/schemas` intentionally has no root export; import `@auren/schemas/element`, `/taxonomy`, `/catalog`, or `/configuration`.
- Inside `packages/schemas`, use `@/*` across capabilities and relative imports within one capability. Cross-workspace imports use `@auren/<package>` with `workspace:*`, never source-relative paths.
- Registry is in-memory only: persistence, loading `blocks/`, remote Registry output, Collections, and CLI `search`/`add` remain later specs.
- Blocks live at `blocks/<category>/<type>/<type>-NNN/` (taxonomy ids, zero-padded id) with exactly `component.tsx` + `registry.json` at the root; payload files only under `components/`, `utilities/`, `styles/`, `assets/`.
- Each `registry.json` must pass the public `catalogElementSchema` unchanged, declare `mobile-first` and `responsive` features, and use an id unique across the whole catalog — `pnpm check` enforces this.
- Keep TypeScript defaults in root profiles and Biome policy in root `biome.json`; workspace configs should only narrow inputs or declare verified aliases.
- `dist/`, coverage, and Turbo output are generated and ignored; edit source/config, not generated artifacts.
