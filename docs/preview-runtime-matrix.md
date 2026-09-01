# Preview Runtime Matrix

The Web consumes the provider-neutral `PreviewDescriptor`. Runtime-specific
entrypoints, dependencies, stylesheet processing, input fixtures, and readiness
signals belong behind a registered adapter.

| Runtime key | Framework | Delivery | Status | Required surface |
| --- | --- | --- | --- | --- |
| `react-vite-tailwind-4` | React | Inline | Supported | Vite React TypeScript entry, Tailwind CSS v4 browser compiler, sandboxed iframe, CSP, bounded readiness |
| Future runtime keys | Runtime-specific | Inline or external | Unsupported until registered | Explicit adapter, descriptor, artifact or hosted URL, and failure coverage |

## Adding A Runtime

- Use a lowercase kebab-case runtime key and pin its toolchain version.
- Define the complete entrypoint, dependency set, CSS/build processor, asset
  handling, and input fixture.
- Register an adapter that owns project creation and readiness reporting.
- Define allowed dependencies, network behavior, credentials policy, resource
  limits, and build/runtime timeouts.
- Choose inline artifact delivery or an external hosted-project boundary without
  exposing provider configuration in source manifests.
- Add supported, unsupported, compile-failure, asset-failure, runtime-failure,
  timeout, and missing-style behavior.
- Verify desktop and 320px/mobile output, keyboard/focus behavior, readable
  themes, and reduced-motion behavior where declared by the content.
- Add deterministic identity and invalidation tests for source, dependency,
  runtime, and build-configuration changes.
- Keep runtime policy versioned with the descriptor build configuration: network
  and credentials denied, approved dependency roots only, bounded files/bytes,
  and a 30-second build/runtime timeout.
- Keep inline previews on a separate origin with sandbox attributes, no
  referrer, and a restrictive CSP. Sandpack currently requires `unsafe-eval`
  inside that already isolated runtime; never pass catalog or consumer secrets.
- Add headed browser coverage with `pnpm web:e2e` for
  rendering, CSS, responsive viewports, tab persistence, explicit refresh,
  external links, and failure states.
- Update this matrix and publish/rollback documentation before enabling the key.
