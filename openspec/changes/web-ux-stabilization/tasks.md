## 1. OpenSpec and test baseline

- [x] 1.1 Validate the completed proposal, design, and capability spec with
      `openspec validate "web-ux-stabilization" --type change --strict`.
- [x] 1.2 Read the existing Web preview and catalog tests and record the
      assertions that must remain valid.

## 2. Preview stabilization

- [x] 2.1 Pass `PreviewProject.entry` through `customSetup.entry` in
      `sandpack-preview-runtime.tsx`.
- [x] 2.2 Replace the unbalanced required-prop regex and comma split in
      `preview-project.ts` with a narrow balanced scanner for supported
      destructured component parameters.
- [x] 2.3 Map Sandpack `initial`/`idle`/`running` states and client `done`/
      failure messages to loading, ready, and unavailable surfaces without
      labelling early iframe mounts as ready.
- [x] 2.4 Add focused Vitest coverage for default object/array/function props,
      nested commas, genuinely required props, entry wiring, and runtime
      fallback states.

## 3. Catalog hierarchy

- [x] 3.1 Add explicit availability to the catalog section type and mark only
      Blocks as available in `catalog-sections.ts`.
- [x] 3.2 Render only available sections in the primary shell navigation and
      keep future routes reachable by direct URL.
- [x] 3.3 Rework the overview into a Blocks-first discovery area followed by a
      distinct non-interactive future roadmap.
- [x] 3.4 Update section card semantics and copy so future entries are labelled
      unavailable/coming soon and are not rendered as normal links.
- [x] 3.5 Tighten Blocks/detail copy and preserve the existing preview,
      metadata, source, dependency, install, focus, and responsive behavior.
- [x] 3.6 Update colocated catalog tests for navigation, overview, and future
      empty-state behavior.

## 4. Verification

- [ ] 4.1 Run `pnpm --filter @auren/web test`.
- [ ] 4.2 Run `pnpm --filter @auren/web typecheck` and
      `pnpm --filter @auren/web build`.
- [ ] 4.3 Run repository validation relevant to the change, including
      `pnpm check` and `pnpm lint` when the workspace is available.
- [ ] 4.4 Run headed Playwright against `http://localhost:5173/` at desktop and
      390px widths; verify Blocks navigation, filters, supported previews,
      unsupported messaging, and absence of horizontal overflow.
- [ ] 4.5 Confirm `.gitignore` retains the user's Playwright rule unchanged and
      report any unrelated worktree changes without modifying them.
