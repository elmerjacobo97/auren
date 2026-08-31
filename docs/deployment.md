# Auren Deployment

Auren has three independently deployable products:

- Web catalog: `https://auren.elmerjacobo.dev`
- Static Registry: `https://registry.auren.elmerjacobo.dev`
- CLI package: `https://www.npmjs.com/package/auren`

## Vercel Projects

Create two Vercel projects under the same account or team:

- Registry project: deploys `dist/public-registry` and receives the
  `registry.auren.elmerjacobo.dev` alias.
- Web project: deploys `apps/web/dist` and receives the
  `auren.elmerjacobo.dev` alias.

The workflow targets the projects with these repository secrets:

- `VERCEL_TOKEN`: personal token for an account that can deploy both projects.
- `VERCEL_ORG_ID`: team or account ID shared by both projects.
- `VERCEL_PROJECT_ID`: Registry project ID.
- `VERCEL_WEB_PROJECT_ID`: Web project ID.
- `NPM_TOKEN`: npm automation token allowed to publish `auren`.

The Registry deployment uses `deploy/registry/vercel.json` for CORS headers. The
Web deployment uses `deploy/web/vercel.json` for client-side routing and keeps
the old Registry resource paths redirecting to the new Registry host so already
published CLI versions remain usable. Each deployment explicitly reapplies its
production alias so future deployments do not leave the custom host on an older
deployment.

## Release Flow

- Every push to `main` runs checks and deploys the Web and Registry.
- A tag such as `v0.1.3` runs checks and publishes the CLI with that version.
- The CLI is not published for ordinary commits; create a release tag only when a new CLI version is intended.

The Registry URL can still be overridden with `--registry-url`,
`AUREN_REGISTRY_URL`, or `VITE_AUREN_REGISTRY_URL` for staging and local work.

## Cutover Order

1. Create the Registry Vercel project, assign `registry.auren.elmerjacobo.dev`, and verify `/registry.json`.
2. Create the Web Vercel project, assign `auren.elmerjacobo.dev`, and configure `VERCEL_WEB_PROJECT_ID`.
3. Regenerate `VERCEL_TOKEN` from an account that can access both projects.
4. Push the workflow changes and verify both production URLs.
