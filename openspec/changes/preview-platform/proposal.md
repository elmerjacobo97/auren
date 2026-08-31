## Why

Auren's current block preview is coupled to a React/Vite Sandpack setup and
assumes that source files plus package names are enough to produce a faithful
runtime. That assumption already causes missing CSS and lifecycle problems, and
it will not hold for Vue, Svelte, Angular, Next.js, Astro, server-rendered
pages, or future full templates. Auren needs an explicit preview platform
contract before Specs 29 and 30 expand the catalog beyond isolated Blocks.

## What Changes

- Define a framework-neutral preview descriptor for catalog elements and
  generated preview artifacts without coupling the Registry to Sandpack.
- Separate source resolution, build/runtime selection, and preview presentation
  so the Web does not infer a complete toolchain from arbitrary source files.
- Support an inline preview strategy for runtimes that can be safely and
  reliably embedded in the catalog.
- Support an external live-preview strategy that opens a complete isolated
  project in a new tab or iframe when the framework needs its own build/server.
- Define per-framework runtime adapters and explicit unsupported/failure states,
  starting with the existing React + Vite + Tailwind MVP.
- Define versioned, cacheable preview identity and invalidation rules so tab
  changes do not rebuild or download a preview again.
- Establish security, dependency, network, timeout, and resource boundaries
  for previews that execute catalog source code.
- Add verification requirements for rendered output, CSS/toolchain loading,
  lifecycle persistence, responsive viewports, and external-preview links.

## Capabilities

### New Capabilities

- `preview-platform`: Framework-aware preview descriptors, runtime/provider
  selection, inline and external delivery, caching, lifecycle, and safety
  contracts for Blocks, Pages, Collections, and Templates.

### Modified Capabilities

No existing OpenSpec capability files are present to modify.

## Impact

- `apps/web` preview adapter, playground lifecycle, loading/failure UI, and
  external preview navigation.
- Registry build/publication metadata for preview descriptors and immutable
  artifact URLs, if the selected delivery strategy is published artifacts.
- Future preview build workers or sandbox providers, without requiring one
  provider to become Auren's public API.
- Validation and visual-testing workflows for supported framework/runtime
  combinations.
- No immediate change to the existing Block source format or CLI installation
  protocol is required by this proposal.
