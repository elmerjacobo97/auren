## Context

Auren currently generates a small React project in the Web and passes it to a
hard-coded `vite-react-ts` Sandpack runtime. The current `PreviewProject`
contract contains an entry file, source files, and package versions, but not
the build toolchain that makes those files executable. This has already caused
three distinct classes of failure: a generated entry that did not mount React,
Tailwind source that was present but not compiled into utilities, and a preview
iframe that was destroyed when the user changed tabs.

The current catalog is React-first, while the product roadmap includes Pages,
Templates, Vue, and Svelte. The product may also need Angular, Next.js, Astro,
and other runtimes whose assumptions differ from a client-only Vite project.
Some are suitable for a browser sandbox; others need a real build or server.
The Registry and CLI should continue to describe and install source files, not
become coupled to one preview vendor.

## Goals / Non-Goals

**Goals:**

- Define a provider-neutral preview descriptor that can describe an inline
  artifact, an external live project, or an unavailable preview.
- Select a complete, explicit runtime by framework and toolchain rather than
  inferring one from arbitrary source files.
- Make preview artifacts deterministic, versioned, cacheable, and independent
  from tab navigation in the Web.
- Support inline previews where the runtime is reliable and external previews
  in a new tab or iframe where a framework needs its own build/server.
- Keep the catalog UI honest about loading, ready, unsupported, and failed
  states, with a useful fallback action when an external preview exists.
- Define isolation, dependency, network, timeout, and resource boundaries for
  executing catalog source code.
- Let Blocks, Pages, Collections, and Templates use the same preview contract.

**Non-Goals:**

- Supporting every framework in the first implementation.
- Selecting or permanently adopting Sandpack, StackBlitz, CodeSandbox, or any
  other provider as Auren's public API.
- Building a browser code editor or allowing arbitrary user code execution in
  the catalog.
- Changing the Block installation protocol or requiring preview dependencies in
  consumer projects.
- Implementing Pages, Templates, Vue, Svelte, Angular, Next.js, or Astro as
  part of this change unless a later framework-specific task is approved.
- Replacing source validation and quality checks with a preview build.

## Decisions

### 1. Use a preview descriptor as the boundary

The Web SHALL consume a `PreviewDescriptor` rather than reconstructing a
runtime directly from `CatalogElement.files`. The descriptor identifies the
content identity, framework, runtime/toolchain, delivery strategy, and the
immutable artifact or live-preview URL. Existing catalog elements without a
descriptor remain valid and render an honest unavailable state.

The descriptor is an additive build/publication concern. The initial
implementation may keep it in a generated preview manifest or detail payload;
the source Block format and CLI install payload do not need to contain build
configuration. If the descriptor later becomes part of the public Registry
schema, it must be optional so older elements remain readable.

Alternatives considered:

- Letting the Web derive the descriptor from source files was rejected because
  it repeats build-system knowledge in the client and cannot model SSR or
  framework-specific entrypoints reliably.
- Adding a provider-specific URL directly to every Block source manifest was
  rejected because it couples the Registry contract to an infrastructure
  vendor.

### 2. Build and cache previews outside tab navigation

Validated source, an explicit runtime manifest, dependency versions, and the
toolchain version form a preview build identity. A preview builder produces an
immutable artifact or an isolated live-project URL keyed by that identity.
The Web reuses the descriptor and does not rebuild or download a preview merely
because the user switches between Preview, Code, and Install.

Static/client previews SHOULD be built at publication time and served from a
CDN or static host. Frameworks that require a server MAY use an isolated,
short-lived hosted project. Both paths must expose a stable descriptor to the
Web.

Alternatives considered:

- Building on every page visit was rejected because it creates slow, duplicate,
  and failure-prone work for a discovery page.
- Building on every tab change was rejected because tabs are presentation
  state, not preview identity changes.
- Storing only screenshots was rejected because it removes useful interaction
  and does not cover the live-preview use case.

### 3. Implement runtimes behind framework/toolchain adapters

The preview layer SHALL select an adapter using an explicit framework and
runtime key, for example `react-vite-tailwind-4` or `vue-vite-tailwind-4`.
Each adapter owns its entrypoint, dependency policy, CSS/build integration,
prop/input fixture, and readiness signal. A provider such as Sandpack is an
implementation detail of an adapter, not the framework-neutral contract.

The first adapter remains React + Vite + Tailwind CSS v4. It must use a
complete known template or a published artifact, including its CSS processor,
entrypoint, and dependencies. Adding another framework creates a new adapter
and verification matrix instead of expanding a shared React wrapper with
conditionals.

Alternatives considered:

- One universal Sandpack template was rejected because templates, compilers,
  SSR, and dependency resolution differ by framework.
- A regex-based universal prop/entry parser was rejected because it cannot
  faithfully understand Vue SFCs, Angular templates, server components, or
  framework conventions.
- A separate provider hard-coded into each UI component was rejected because it
  would make the catalog surface depend on infrastructure details.

### 4. Support two delivery surfaces

The Web SHALL support both of these surfaces:

- `inline`: an isolated iframe embedded in the detail page for a ready,
  cacheable artifact or supported browser runtime.
- `external`: a safe link that opens a complete live preview in a new tab, with
  an iframe option when embedding is permitted.

The playground keeps the preview surface mounted while Code and Install are
selected. An explicit Refresh action may invalidate the current preview
instance, but tab selection must not. Unsupported combinations show why they
are unavailable and expose the external action when one exists.

This preserves a fast shadcn-like catalog experience without pretending that a
full Next.js or Astro server belongs inside the React Web process.

### 5. Treat execution as untrusted and isolated

Preview builds and live projects SHALL run away from the catalog origin and
without access to Auren or consumer secrets. Providers/builders must enforce
allowed dependencies, bounded CPU/memory/time, controlled network access, and
clear failure reporting. External URLs must be generated or allow-listed by
Auren and opened with safe browser relationship attributes.

The preview is a demonstration environment, not a general-purpose execution
endpoint. A build failure must never be hidden behind an indefinite loading
state.

### 6. Reuse the contract for future content types

The descriptor is attached to a versioned previewable artifact, not only to a
Block. A Page, Collection, or Template can therefore publish a descriptor with
its own entrypoint, runtime, dependencies, and delivery strategy. Composition
and installation remain separate concerns: a preview may show a complete
composition without changing what the CLI installs.

## Risks / Trade-offs

- [A publish-time build can delay Registry publication] → Build previews as a
  separate status-bearing job and publish the catalog element even when its
  preview is temporarily unavailable.
- [A third-party provider can change APIs, limits, or pricing] → Keep provider
  details behind adapters and store provider-neutral descriptors in Auren.
- [An external live preview can be slower than inline rendering] → Prefer
  immutable static artifacts for client-only previews and show explicit loading
  and failure actions for hosted projects.
- [Framework adapters multiply verification work] → Add adapters only when a
  framework is a product requirement and require a runtime matrix with build,
  CSS, interaction, responsive, and failure tests.
- [Executing catalog code creates a security boundary] → Use isolated origins,
  dependency/network policies, resource limits, and never pass catalog or
  consumer credentials into a preview.
- [Existing Web work currently mixes source generation and runtime concerns] →
  Introduce the descriptor/adapter boundary incrementally and retain the
  existing unavailable fallback during migration.

## Migration Plan

1. Define the preview descriptor, runtime key, delivery strategy, and state
   contracts without changing CLI installation behavior.
2. Move the current React preview behind the first explicit adapter and make
   its template/build configuration complete, including Tailwind CSS output.
3. Keep the preview mounted across playground tabs and verify that the same
   descriptor/iframe is reused; only explicit refresh creates a new instance.
4. Add an external-preview link path and a safe unavailable state before adding
   any new framework.
5. Add publication/build integration for immutable preview artifacts, with
   rollback consisting of removing or invalidating the descriptor while the
   source Registry remains available.
6. Add Vue/Svelte or server-oriented adapters only through separate
   framework-specific changes after this contract is stable.

## Open Questions

- Which hosted builder or sandbox provider best fits Auren's cost, isolation,
  and deployment constraints is intentionally not decided here.
- Whether descriptors belong in the existing detail payload or a separate
  public preview manifest should be decided when Registry publication work is
  implemented.
- The exact retention and invalidation policy for hosted live projects remains
  a deployment concern.
