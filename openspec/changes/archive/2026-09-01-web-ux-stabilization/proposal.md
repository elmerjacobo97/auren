## Why

The public Web currently exposes the catalog, but its most important product promise is incomplete: block detail pages can show blank or unavailable previews even when the published Registry payload is valid. The primary navigation also gives equal weight to Components, Pages, and Collections even though the public Registry currently exposes blocks only, making the product feel unfinished and obscuring the usable path.

This should be corrected before Spec 29 adds Pages. A clear, reliable block-discovery flow is the foundation on which future content types will depend.

## What Changes

- Make the isolated block preview use the generated entry file and report its actual loading, ready, and failure states.
- Replace the preview prop heuristic that misclassifies default object props as required runtime props.
- Add regression coverage for supported previews, unsupported previews, and the Sandpack entry contract.
- Make Blocks the primary catalog path and label future catalog types as unavailable without presenting them as populated destinations.
- Rework the catalog overview and block discovery hierarchy so the published block inventory, search/filter action, preview, metadata, and install command are understandable in that order.
- Keep Tailwind CSS as the Web styling foundation; use shadcn/ui only for interactive primitives when a concrete interaction needs one.

## Capabilities

### New Capabilities

- `web-ux-stabilization`: Reliable block previews and a block-first, honest catalog discovery experience.

### Modified Capabilities

## Impact

- `apps/web` preview runtime, preview project generation, catalog navigation, overview, block discovery, and block detail views.
- Web component and Playwright/Vitest regression coverage.
- No Registry or CLI protocol changes.
- No new mandatory UI library dependency; existing Sandpack remains the isolated preview runtime.
- `.gitignore` is user-owned and must not be modified by this change.
