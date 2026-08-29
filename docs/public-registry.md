# Public Registry

Auren publishes the generated Registry as a provider-neutral static document
root. The release command validates the local Registry Build output and writes
a complete copy to `dist/public-registry/`:

```bash
pnpm registry:publish
```

The direct executable can consume an already-built Registry and choose isolated
roots:

```bash
node scripts/publish-registry.mjs \
  --registry-root dist/registry \
  --output-root dist/public-registry
```

The publisher is offline. It does not upload files, select a hosting provider,
create DNS records, or add credentials. Both generated directories are ignored
build artifacts and must not be committed.

## Document-root contract

Configure the static host's document root as `dist/public-registry/`. The
published tree contains only:

```text
registry.json
blocks/<id>.json
```

A host rooted at that directory must expose these stable resources:

- `GET /registry.json`
- `HEAD /registry.json`
- `GET /blocks/<id>.json`
- `HEAD /blocks/<id>.json`

The responses must:

- be available anonymously, without authentication redirects;
- return `Content-Type: application/json; charset=utf-8`;
- preserve the published UTF-8 bytes without HTML fallbacks, directory-prefix
  rewriting, or runtime payload transformation; and
- allow browser consumers with a CORS policy such as
  `Access-Control-Allow-Origin: *` (or an explicitly documented equivalent).

The index should have a cache policy that permits revalidation when the catalog
changes, for example with validators supplied by the static host. Detail files
use stable ID-based paths and may use a longer cache lifetime, but they are not
content-versioned; deployments should still revalidate them when their payloads
change.

The host name, base URL, cache headers, CORS configuration, upload mechanism,
DNS, and credentials belong to deployment configuration. No generated Registry
file needs to change when the same document root is served from localhost,
staging, or production.
