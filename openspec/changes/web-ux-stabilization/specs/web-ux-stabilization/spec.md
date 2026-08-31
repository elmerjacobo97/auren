## ADDED Requirements

### Requirement: Preview projects use their generated entry file

The Web preview runtime MUST pass the `PreviewProject.entry` value to
Sandpack's custom setup and MUST preserve the generated project files and
declared dependencies.

#### Scenario: Generated wrapper renders through the configured entry

- **WHEN** a supported React block produces a preview project with
  `entry: "/index.tsx"`
- **THEN** the Sandpack provider uses `/index.tsx` as its bundle entry and the
  preview mounts the generated wrapper instead of the template entry

#### Scenario: Preview dependencies remain available

- **WHEN** a supported block declares package dependencies
- **THEN** the runtime passes those versions through the existing Sandpack
  dependency setup while also retaining the generated Tailwind dependency

### Requirement: Required runtime props are detected without false positives

The preview project builder MUST reject a component only when its supported
destructured parameter form contains a genuinely required property. It MUST
handle nested delimiters and top-level defaults, and MUST ignore rest
properties plus the standard `children`, `className`, and `id` properties.

#### Scenario: Default object values are supported

- **WHEN** a component destructures props with object, array, function, or
  nested default values
- **THEN** `createPreviewProject` returns `status: "supported"` when all
  top-level props have defaults or are standard ignored props

#### Scenario: Local fallback objects are supported

- **WHEN** a component merges a destructured prop with a matching local
  `default<Property>` object before rendering
- **THEN** the preview builder treats that prop as runtime-optional

#### Scenario: A genuinely required prop remains unsupported

- **WHEN** a component destructures a non-standard top-level prop without a
  default value
- **THEN** `createPreviewProject` returns `status: "unsupported"` with reason
  `"required-props"`

#### Scenario: Nested commas do not split the wrong property

- **WHEN** a default value contains nested objects, arrays, calls, or template
  expressions with commas
- **THEN** the required-prop check evaluates top-level properties only

### Requirement: Preview state communicates the actual isolated runtime state

The Web MUST present distinct loading, ready, statically unsupported, and
runtime failure states for block previews. A mounted Sandpack iframe MUST NOT
be labelled ready before Sandpack reports completion.

#### Scenario: Sandpack is initializing

- **WHEN** Sandpack status is `initial`, `idle`, or `running` without a runtime
  error
- **THEN** the preview renders an accessible loading surface with
  `data-preview-status="loading"`

#### Scenario: Sandpack completion event is successful

- **WHEN** Sandpack emits a `done` message with `compilatonError: false` and no
  runtime error exists
- **THEN** the preview renders `SandpackPreview` with
  `data-preview-status="ready"`

#### Scenario: Sandpack reports a runtime failure

- **WHEN** Sandpack exposes an error, emits a `done` message with
  `compilatonError: true`, or reaches `timeout`
- **THEN** the preview renders the existing unavailable surface with reason
  `"runtime-failure"` and does not claim the preview is ready

#### Scenario: Static preview limitations are found before runtime startup

- **WHEN** the project builder returns an unsupported reason such as an asset,
  unresolved dependency, or required prop
- **THEN** the adapter renders the reason-specific unavailable surface without
  mounting Sandpack

### Requirement: Published Blocks are the primary catalog path

The catalog MUST identify Blocks as the only currently available primary
section. Components, Pages, and Collections MUST be visibly labelled as future
sections and MUST NOT appear as equivalent populated destinations in the
primary navigation.

#### Scenario: Primary navigation reflects published content

- **WHEN** a user visits any catalog route while the Registry publishes blocks
  only
- **THEN** the primary catalog navigation exposes Blocks as the available
  section and omits future sections as normal navigation links

#### Scenario: Overview leads to the usable inventory

- **WHEN** the catalog overview loads with a validated Registry index
- **THEN** the main discovery treatment leads to the published Blocks inventory
  and its count before the future-section roadmap

#### Scenario: Future sections remain honest

- **WHEN** a user visits Components, Pages, or Collections directly
- **THEN** the page clearly states that the current Registry publishes blocks
  only and does not display fabricated entries

#### Scenario: Future roadmap cards are not misleading links

- **WHEN** a future catalog section is shown on the overview
- **THEN** it is visually distinct, labelled as unavailable or coming soon, and
  has no interactive catalog link

### Requirement: Catalog discovery preserves a clear action sequence

The Web MUST make the published inventory, local filters, block detail, preview,
metadata, source, and installation actions understandable in that order, with
responsive layouts and existing keyboard/focus behavior preserved.

#### Scenario: Block inventory explains the next action

- **WHEN** the published Blocks page has loaded
- **THEN** its heading and supporting copy identify the inventory, its filters
  explain that they operate on the validated index, and each result exposes a
  detail link

#### Scenario: Block detail prioritizes preview and install context

- **WHEN** a valid block detail page loads
- **THEN** the page presents the preview and metadata before dependencies,
  source, and the install command

#### Scenario: Discovery remains usable on a narrow viewport

- **WHEN** the overview, Blocks page, or block detail is rendered at a 320px
  or wider viewport
- **THEN** content remains readable, controls remain keyboard reachable, and
  no horizontal overflow is introduced

### Requirement: Regression coverage protects the stabilization contract

The Web MUST include focused automated coverage for the preview entry contract,
required-prop detection, runtime state mapping, catalog availability, and the
future-section empty states.

#### Scenario: Preview regressions are caught locally

- **WHEN** the Web Vitest suite runs
- **THEN** it verifies supported default-prop blocks, genuinely required-prop
  blocks, the generated entry passed to the runtime, and runtime failure
  fallback behavior

#### Scenario: Catalog regressions are caught locally

- **WHEN** the catalog component/view tests run
- **THEN** they verify Blocks-first navigation and overview hierarchy while
  preserving honest future-section copy
