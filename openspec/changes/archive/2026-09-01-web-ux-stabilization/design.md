## Context

The Web consumes the public Registry correctly, but its isolated preview layer
has two independent failure modes. `createPreviewProject` always generates an
`/index.tsx` wrapper, while `SandpackPreviewRuntime` only passes the generated
files and dependencies to `SandpackProvider`; the provider therefore continues
to use the template entry and can leave the preview iframe mounted without a
rendered block. Separately, `hasRequiredRuntimeProps` uses a non-balanced regex
and comma splitting, so object defaults containing braces or commas can be
reported as required props.

The catalog also exposes Components, Blocks, Pages, and Collections as peers in
the primary header even though the public Registry currently publishes blocks.
The overview repeats that ambiguity with four equally weighted links. This
change must improve the usable block path without changing the Registry, CLI,
schema, or future content models.

The Web already uses React, Vite, TypeScript, Tailwind CSS v4, TanStack Router,
Vitest, and Sandpack 2.20.0. The existing green-and-lime visual language and
local component patterns remain the design foundation.

## Goals / Non-Goals

**Goals:**

- Make every supported preview use the entry file that its project generator
  created.
- Distinguish preview loading, successful runtime, unsupported input, and
  runtime failure states in the DOM and in the user-facing copy.
- Detect genuinely required destructured props without rejecting defaults,
  nested values, or harmless rest/standard props.
- Make published Blocks the unmistakable primary catalog path while keeping
  future sections honest and directly routable when visited explicitly.
- Establish a clear discovery sequence: published inventory, filters, block
  detail, preview, metadata, source, and installation.
- Cover the regressions with focused Vitest tests and a headed Playwright pass
  at desktop and mobile widths.

**Non-Goals:**

- Adding Pages, Components, Collections, or new Registry data.
- Changing Registry or CLI protocols, schemas, deployment architecture, or
  public resource formats.
- Adding shadcn/ui or another UI library as a mandatory dependency.
- Building a complete visual regression framework or changing block source
  quality claims.
- Modifying `.gitignore` or any user-owned worktree change.

## Decisions

### 1. Preserve the preview project contract and pass its entry explicitly

Keep `PreviewProject.entry` as the generated `"/index.tsx"` contract and pass
it through `customSetup.entry` alongside the existing dependencies:

```tsx
customSetup={{ entry: project.entry, dependencies: project.dependencies }}
```

This follows Sandpack's supported custom-entry mechanism and fixes the wiring
at the runtime boundary instead of duplicating entry knowledge in the UI.
`files` remains the complete controlled set, including the wrapper and CSS.

The alternative was to rename the generated file to Sandpack's template entry
or omit `entry` from `PreviewProject`. Both hide a contract mismatch and make
future preview project changes more fragile.

### 2. Use a small balanced source scanner for required props

Replace the current non-balanced regex and `.split(",")` logic with private
helpers in `preview-project.ts` that:

- locate supported exported component parameter forms;
- walk strings, comments, template literals, and nested delimiters to find the
  matching destructuring close brace;
- split only on top-level commas; and
- treat a property as required only when it has no top-level default value,
  ignoring rest properties, the standard `children`, `className`, and `id`
  values already accepted by the wrapper, and local `default<Property>` object
  fallbacks merged with the prop.

This intentionally remains a narrow source inspection heuristic because the
preview gate runs in the Web bundle and the project has no parser dependency.
It does not claim to parse arbitrary TypeScript. The fallback remains
`required-props` when a clearly required top-level destructured property is
found.

The alternative was adding a TypeScript/Babel parser. That would be more
precise but would add bundle/dependency cost for a defensive catalog check and
would not make unsupported component APIs renderable.

### 3. Derive runtime presentation from Sandpack status

Use Sandpack's public state and client listener to drive the existing preview
surface:

- `initial`, `idle`, and `running` render a loading state;
- the client `done` message with `compilatonError: false` renders
  `SandpackPreview` with `data-preview-status="ready"`; and
- a client `done` message with `compilatonError: true`, a non-null
  `sandpack.error`, or `timeout` renders
  `PreviewUnavailable` with `runtime-failure`.

The adapter continues to handle synchronous render errors with its error
boundary, while `PreviewUnavailable` continues to explain static unsupported
reasons before Sandpack mounts. This avoids labelling a merely mounted iframe
as ready and keeps failure messaging consistent. Sandpack 2.20.0 keeps the
provider status at `running` after startup, so the client `done` event is the
completion signal rather than a `sandpack.status === "done"` check.

### 4. Make catalog availability explicit in the navigation model

Extend `CatalogSection` with an availability value. `Blocks` is the only
available section in this release. `CatalogShell` renders available sections
in the primary navigation; `CatalogOverview` gives the available section the
main discovery treatment and renders future sections in a distinct,
non-interactive roadmap group. `CatalogSectionLink` renders a real router link
only for available sections and a clearly labelled non-link card for future
sections.

The existing future routes remain valid for direct navigation and retain their
empty-state explanation. The alternative of removing future sections
completely would hide the roadmap; leaving them as normal links would preserve
the current misleading product hierarchy.

### 5. Reuse the existing visual system and native controls

Keep the current Tailwind classes, typography, warm paper/forest surfaces,
subtle border/shadow depth, semantic headings, native `select`, and existing
focus/reduced-motion patterns. Copy and layout changes will make the order of
actions explicit without introducing a new design system or custom interactive
primitive.

## Risks / Trade-offs

- [Source scanning still cannot understand every valid TypeScript parameter
  form] -> Keep the supported forms narrow, test nested/default cases, and
  retain a truthful unsupported fallback rather than attempting unsafe
  rendering.
- [Sandpack may remain unavailable when its external bundler or analytics
  service is slow] -> Surface loading and runtime failure states separately;
  do not treat an iframe mount as a successful render.
- [Hiding future sections from primary navigation may reduce discoverability]
  -> Preserve direct routes and show a visible roadmap on the overview.
- [A visual hierarchy change can invalidate brittle page tests] -> Update
  colocated tests by accessible role/text and verify the headed browser at
  390px and desktop widths.
- [Source and detail payloads are network-backed] -> Keep the validated index
  and existing retry/error boundaries unchanged; this change is Web-only.

## Migration Plan

1. Add the design/spec/tasks artifacts and validate the OpenSpec change.
2. Apply preview runtime and prop-detection changes with focused regression
   tests.
3. Apply catalog navigation and overview hierarchy changes with component
   tests.
4. Run Web typecheck, tests, build, and the repository checks that cover Web.
5. Start the local Web, verify supported and unsupported block details with
   headed Playwright at desktop and 390px widths, then deploy through the
   existing Web path when requested.

No data migration or Registry rollback is required. If the preview runtime
regresses, revert the Web change; the public Registry and CLI remain
independent.

## Open Questions

- None blocking implementation. The existing future routes and copy remain in
  place unless the later Pages/Collections specs define their data contracts.
