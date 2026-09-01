# Preview Platform

## Purpose

TBD: define the provider-neutral preview lifecycle for catalog content across
supported runtimes and delivery strategies.

## Requirements

### Requirement: Preview descriptor

The system SHALL represent each previewable version with a provider-neutral
descriptor containing its content identity, framework, runtime/toolchain key,
delivery strategy, and the URL or artifact reference required to render it.
The descriptor SHALL be optional for existing catalog elements.

#### Scenario: Inline descriptor is available

- **WHEN** a published React block has a successfully built inline artifact
- **THEN** the descriptor identifies the block version and React runtime and
  provides an immutable artifact reference for the Web to render

#### Scenario: External descriptor is available

- **WHEN** a framework requires a hosted build or server
- **THEN** the descriptor identifies the runtime and provides a safe external
  live-preview URL without exposing provider-specific configuration as the
  public source contract

#### Scenario: Descriptor is absent

- **WHEN** a catalog element has no compatible published preview
- **THEN** the Web keeps the catalog and installation content usable and shows
  an explicit unavailable state instead of attempting to infer a runtime

### Requirement: Explicit runtime selection

The preview system SHALL select a runtime adapter using an explicit framework
and toolchain key. An adapter SHALL own its entrypoint, dependency policy,
stylesheet/build integration, input fixture, and readiness signal.

#### Scenario: Supported React runtime

- **WHEN** a descriptor selects the supported React + Vite + Tailwind CSS v4
  runtime
- **THEN** the system uses that runtime's complete template and reports ready
  only after the block is mounted and its required stylesheet assets are loaded

#### Scenario: Unsupported framework/runtime

- **WHEN** a descriptor selects a framework or toolchain with no registered
  adapter
- **THEN** the system reports an explicit unsupported state and does not mount
  a misleading React or default runtime

### Requirement: Deterministic preview identity and caching

The preview build identity SHALL include the catalog element version or source
hash, selected runtime/toolchain version, dependency versions, and relevant
build configuration. Successfully built client previews SHALL be addressable by
an immutable identity and reusable across page visits.

#### Scenario: Same preview is requested again

- **WHEN** the same element version and runtime identity are requested again
- **THEN** the system reuses the existing descriptor or artifact without
  starting a duplicate build

#### Scenario: Source or runtime changes

- **WHEN** the source, dependency set, runtime version, or build configuration
  changes
- **THEN** the system produces a new preview identity and does not serve the
  previous artifact as the current preview

#### Scenario: Client preview build fails

- **WHEN** the builder cannot compile or mount the requested preview
- **THEN** the descriptor records a failure state and diagnostic category, and
  the Web stops loading after a bounded timeout

### Requirement: Stable playground lifecycle

The Web SHALL keep a mounted inline preview instance alive while the user
switches between Preview, Code, and Install. Tab selection SHALL NOT rebuild,
re-download, or replace the preview instance.

#### Scenario: User switches tabs

- **WHEN** the user changes from Preview to Code or Install and then returns to
  Preview
- **THEN** the same preview identity and iframe instance remain available
  without a new preview request

#### Scenario: User explicitly refreshes

- **WHEN** the user activates Refresh preview
- **THEN** the Web may invalidate and recreate the current preview instance,
  showing its loading state again

### Requirement: Inline and external delivery

The Web SHALL render inline descriptors in an isolated iframe when the selected
delivery strategy permits embedding and SHALL provide an external live-preview
action when the descriptor requires a separate page or tab.

#### Scenario: Inline artifact renders

- **WHEN** a descriptor has an embeddable inline artifact
- **THEN** the detail page renders that artifact inside an isolated iframe and
  exposes loading, ready, and failure states

#### Scenario: External preview opens

- **WHEN** a descriptor provides an external live-preview URL
- **THEN** the detail page offers an action that opens the URL in a new tab with
  safe opener isolation

#### Scenario: External preview cannot be embedded

- **WHEN** the external provider denies iframe embedding
- **THEN** the Web keeps the catalog page usable and directs the user to the
  new-tab action instead of displaying a permanently blank iframe

### Requirement: Honest preview states

The preview UI SHALL distinguish unsupported input, build/loading, ready,
timeout, and runtime failure states. It SHALL NOT label a merely created iframe
or completed bundler event as ready unless the selected adapter confirms a
mounted preview.

#### Scenario: Preview is loading

- **WHEN** the descriptor is being fetched, built, or mounted
- **THEN** the UI exposes a bounded loading state and does not claim the block
  is ready

#### Scenario: Preview is ready

- **WHEN** the selected adapter confirms that the preview mounted successfully
  and its required assets loaded
- **THEN** the UI marks the preview ready and removes the loading overlay

#### Scenario: Preview fails

- **WHEN** compilation, asset loading, runtime execution, or the timeout limit
  fails
- **THEN** the UI shows a useful failure state and, when available, an external
  preview action

### Requirement: Isolated and bounded execution

Preview builders and runtimes SHALL execute catalog source away from the
catalog origin and SHALL enforce dependency, network, resource, and timeout
policies. They MUST NOT receive Auren, Registry, or consumer secrets.

#### Scenario: Preview requests a dependency

- **WHEN** a preview declares a package dependency
- **THEN** the builder resolves it through the approved dependency policy and
  rejects unresolved or disallowed dependencies with a categorized failure

#### Scenario: Preview exceeds its limit

- **WHEN** a build or runtime exceeds its configured time or resource limit
- **THEN** the system terminates or isolates the preview and reports timeout or
  resource failure without blocking the catalog page indefinitely

#### Scenario: Preview source attempts catalog access

- **WHEN** preview code attempts to access catalog-origin credentials or
  privileged consumer data
- **THEN** the isolation boundary prevents that access and no secret is exposed

### Requirement: Reusable content-type contract

The preview descriptor SHALL apply to Blocks, Pages, Collections, and Templates
without requiring the Web to implement a separate preview lifecycle for each
content type. Each content type MAY select a different entrypoint, fixture,
runtime, or delivery strategy.

#### Scenario: Page uses a complete runtime

- **WHEN** a published Page selects a server-capable runtime
- **THEN** the Web consumes its descriptor through the same preview surface and
  opens the hosted live preview when inline embedding is not supported

#### Scenario: Collection uses an inline runtime

- **WHEN** a Collection has a compatible client-side artifact
- **THEN** the Web renders it through the same inline lifecycle used by a Block
  without changing CLI installation semantics
