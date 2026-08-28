# Auren Agent Instructions

## State

- This repository is documentation-only: it has no application source, package manifest, workspace config, CI, build/test/lint/typecheck config, or runnable command.
- Treat `docs/stack.md` as proposed architecture and roadmap. Its planned `pnpm`/Turborepo structure, tools, and package boundaries are not implemented until verified in repository config.
- Treat `docs/listado-specs.md` as the recommended implementation order; each spec is intended to be completed independently before the next.
- Use `docs/modelo-negocio.md` for product/domain context and terminology.

## Boundaries

- Work only from this repository; do not import code or assumptions from sibling projects or planned paths.
- When implementation begins, establish and verify executable setup from repository manifests/config first; derive commands from those files rather than from roadmap examples.
