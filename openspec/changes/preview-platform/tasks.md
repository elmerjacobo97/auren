## 1. Preview contract

- [ ] 1.1 Define the provider-neutral `PreviewDescriptor`, delivery strategy,
      runtime key, identity, and failure-state types in the shared contract
      layer without making the descriptor mandatory for existing elements.
- [ ] 1.2 Define the runtime-adapter interface and selection boundary so
      framework/toolchain behavior is owned by adapters rather than the
      catalog UI or a generic source parser.
- [ ] 1.3 Define the preview identity and invalidation algorithm using content,
      dependency, runtime, and build-configuration inputs.

## 2. Web delivery and lifecycle

- [ ] 2.1 Update the Web preview adapter to consume descriptors and route
      `inline`, `external`, `unsupported`, and `failure` states consistently.
- [ ] 2.2 Keep inline preview instances mounted while Preview, Code, and Install
      tabs change, and reserve recreation for an explicit refresh action.
- [ ] 2.3 Add the external-preview action with safe new-tab behavior and an
      iframe fallback only when embedding is allowed.
- [ ] 2.4 Replace indefinite loading with bounded loading, ready, timeout, and
      runtime-failure UI that preserves the catalog and installation actions.

## 3. React MVP runtime

- [ ] 3.1 Select and pin a complete React + Vite + TypeScript + Tailwind CSS v4
      runtime template whose entrypoint, CSS processor, dependencies, and
      asset handling are all explicit.
- [ ] 3.2 Move the current React preview behind the explicit runtime adapter
      and prove that Tailwind utilities and declared block styles are rendered
      in the isolated surface.
- [ ] 3.3 Define the React preview entry/input contract so rendering does not
      depend on regex inference of arbitrary component props.
- [ ] 3.4 Add the React runtime's supported, unsupported, compile-failure, and
      missing-style fallback behavior.

## 4. Build and publication

- [ ] 4.1 Define the preview builder input/output manifest and produce an
      immutable client-preview artifact for a validated React Block.
- [ ] 4.2 Integrate preview artifact status and immutable references with the
      Registry build/publication flow without changing CLI installation files.
- [ ] 4.3 Add a hosted-project integration boundary for runtimes that require a
      server or cannot be embedded, without exposing provider details as the
      source Block contract.
- [ ] 4.4 Add cache reuse and invalidation coverage for unchanged and changed
      source, dependency, runtime, and build identities.

## 5. Isolation and operations

- [ ] 5.1 Define and enforce allowed dependencies, network policy, resource
      limits, and build/runtime timeouts for preview execution.
- [ ] 5.2 Ensure preview origins cannot access Auren, Registry, consumer
      credentials, or privileged catalog state.
- [ ] 5.3 Add categorized diagnostics and operational logging that distinguish
      build, asset, runtime, provider, timeout, and unsupported failures.

## 6. Verification and future runtimes

- [ ] 6.1 Add unit coverage for descriptor validation, adapter selection,
      identity generation, delivery states, and backward-compatible absence of
      a descriptor.
- [ ] 6.2 Add headed Playwright coverage for styled React output, responsive
      viewports, tab persistence, explicit refresh, external links, and failure
      states.
- [ ] 6.3 Document the runtime compatibility matrix and the checklist required
      before adding Vue, Svelte, Angular, Next.js, Astro, or another framework.
- [ ] 6.4 Validate the complete repository and update the related roadmap/spec
      references before archiving this change.
