# Project Guidelines

## Overview

- Auren is a pnpm/Turborepo monorepo for a versioned UI component and block catalog consumed by developers and coding agents.
- The implemented foundation is local: Schemas, an in-memory Registry, Core catalog logic, and the Node CLI. The Web and MCP workspaces are still private `export {}` shells.
- Treat manifests, source, validators, and tests as authoritative. `docs/stack.md` also describes roadmap technology that is not implemented yet.

## Architecture

- `@auren/schemas` is the Zod contract and taxonomy source. It intentionally has no root barrel; use `@auren/schemas/element`, `/taxonomy`, `/catalog`, or `/configuration`.
- `@auren/registry` provides `LocalRegistry`: validated catalog elements, unique IDs, taxonomy indexes, AND queries, registration-order results, and defensive copies. It is in-memory only and does not read `blocks/` or persist data.
- `@auren/core` exposes direct capability entrypoints for search, dependency-aware resolution, metadata/file loading, compatibility, project detection, and `auren.json` configuration. It has no root export.
- `@auren/cli` is the `auren` Node executable. Its local catalog source discovers `blocks/`; current commands are `init`, `info`, `search`, and `add`, plus `--help` and `--version`. `add` plans and safely writes files, resolves Auren/package/shadcn requirements, and uses `--force` for existing targets.
- Workspace dependency direction is Schemas → Registry → Core → CLI. Cross-workspace consumers use package names, not source-relative imports.

## Tech Stack and Structure

- Node `>=20.19.0 <26`, pnpm `11.21.0`, TypeScript ESM with strict shared settings, Turborepo, and Biome.
- Vitest covers package code; Node’s built-in test runner covers repository verifiers. React and Tailwind CSS v4 are the block baseline; shadcn/ui is optional and compatibility is explicit.
- Workspaces are exactly `apps/*` and `packages/*`:
  - `apps/web` — private typecheck-only application shell.
  - `packages/schemas` — element, taxonomy, catalog, and configuration contracts.
  - `packages/registry` — local in-memory Registry.
  - `packages/core` — shared catalog/project/configuration capabilities.
  - `packages/cli` — executable CLI with colocated command modules.
  - `packages/mcp` — private typecheck-only shell.
- `blocks/` is versioned catalog source, not a workspace. The pinned roots are `marketing`, `application-ui`, `ecommerce`, and `authentication`.

## Commands

- Install reproducibly: `pnpm install --frozen-lockfile`.
- Repository checks: `pnpm check` builds Schemas, verifies workspace contracts, and scans the complete block tree.
- Full gates: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format`, and `pnpm build`. `pnpm build` follows the Turbo dependency graph; `pnpm dev` is the Turborepo entry point but no workspace currently implements `dev`.
- `pnpm test` also runs `node --test scripts/verify-blocks.test.mjs scripts/verify-workspace.test.mjs` before Turbo package tests.
- Run a package gate as `pnpm --filter @auren/<package> <gate>` (`typecheck`, `test`, or `build` where that package defines it); a focused Schemas test is `pnpm --filter @auren/schemas exec vitest run src/<capability>/<file>.test.ts`.
- `lint` and `format` are read-only Biome checks; only `lint:fix` and `format:fix` write. There is currently no CI or pre-commit gate, so local gates are authoritative.

## Code Conventions

- Organize growing source by domain/capability/feature and keep tests beside implementations. Avoid flat `src/` layouts and premature abstractions.
- Keep shared compiler defaults in root `tsconfig.base.json`; Node and Web profiles own environment settings. Workspace configs should only declare inputs and verified aliases.
- Use `@/*` for cross-capability imports inside `packages/schemas` and `packages/core`, relative imports within one capability, and `@auren/<package>` with `workspace:*` across workspaces. Existing workspace ESM TypeScript uses `.js` import specifiers.
- Keep all workspace packages private ESM packages at `0.0.0`; do not add workspace-local lint/format configuration. Generated `dist/`, Turbo output, and coverage are not source files to edit.
- Keep the public package boundaries intact: Schemas and Core expose direct capability paths, Registry exposes only `.`, and CLI’s bin is `dist/index.js`.

## Blocks

- Follow `blocks/README.md` as the detailed block standard. Use `blocks/<category>/<type>/<type>-NNN/` with a zero-padded ID from `001`–`999`; IDs are unique across the whole catalog.
- A block root contains exactly `component.tsx` and `registry.json`; additional files belong only under `components/`, `utilities/`, `styles/`, or `assets/`. Never add `package.json` beneath `blocks/`.
- `registry.json` must pass the public `catalogElementSchema`, match its path identity, list every payload file exactly once, omit source `target`/`content`, and include `mobile-first` and `responsive`. Run `pnpm check` after block or manifest changes.
- Use only the supported React baseline imports unless a matching dependency descriptor exists. Auren dependencies use `kind: "auren"`; shadcn requirements use `kind: "shadcn"` and canonical `@/components/ui/<name>` imports. Do not copy shadcn source into a block or use custom registry paths.
- Block quality claims remain author/review obligations: design for 320px first and desktop widths, and keep semantic HTML, keyboard/focus behavior, readable themes, and reduced-motion behavior correct when those features are declared.

## OpenSpec and Development Rules

- Before designing or implementing, read `docs/architecture.md`, `docs/stack.md`, `docs/listado-specs.md`, and the relevant domain README (`docs/modelo-negocio.md`, `packages/schemas/README.md`, or `blocks/README.md`).
- Specs 01–18 are implemented and archived; Spec 19 (Registry Build) is next. Keep `docs/listado-specs.md` checkboxes synchronized, use `openspec/changes/` for active work, and use `openspec/changes/archive/` for completed changes.
- The current Registry remains local and in-memory. Remote Registry build/publication, Collections, Web catalog, MCP, backend services, and other roadmap capabilities belong to later specs; do not add them opportunistically.
- Work only from this repository. When changing topology, manifests, exports, aliases, shared config, or block rules, run the relevant verifier and preserve the contracts enforced by `scripts/verify-workspace.mjs` and `scripts/verify-blocks.mjs`.
