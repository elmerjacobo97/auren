# Auren Agent Instructions

## Current state

- This repository currently contains documentation only under `docs/`; no application source, package manifest, workspace config, test/lint/build config, CI, or runnable command exists.
- Treat `docs/stack.md` as proposed architecture and roadmap, not as evidence that planned tools, packages, or directories already exist.
- Use `docs/modelo-negocio.md` for product and domain context.

## Boundaries

- Work only from this repository; do not import assumptions or files from sibling projects or paths.
- When implementation starts, establish and verify executable setup from repository manifests/config before documenting commands.

## Planned architecture

- Intended monorepo uses `pnpm` and Turborepo, with planned boundaries `apps/web`, `packages/{schemas,registry,core,cli,mcp}`, and `blocks/`.
- Registry is intended as source of truth; `packages/core` owns block resolution, installation, dependency, and configuration logic shared by Web, CLI, and MCP.
- Planned MVP stack is React, TypeScript, and Tailwind CSS v4; Vitest, Playwright, and Biome are planned quality tools, not currently available here.
- Backend, database, Stripe, Vue, and Svelte are explicitly post-MVP in the current plan.
