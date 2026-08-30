# React Doctor false positives

## Versioned block catalog

- **Scope:** `blocks/**`
- **Diagnostic:** `deslop/unused-file`
- **Decision:** Rejected as a false positive. Block source is versioned catalog payload discovered by the Registry/CLI catalog builders; it is intentionally not imported into an application entry point.
- **Evidence:** `blocks/README.md`, `scripts/verify-blocks.mjs`, and the committed block tree define and validate this source outside the workspace graph.
- **Guardrail:** Keep `pnpm check` and the block verifiers authoritative for catalog reachability and payload completeness. Do not import block source solely to satisfy dead-code analysis.
