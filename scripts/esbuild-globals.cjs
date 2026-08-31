// Injected into the esbuild bundle to replace its ESM/CJS shim with a stub
// that delegates directly to the native Node.js require().  Without this, the
// shim throws "Dynamic require of 'node:events' is not supported" in Node ESM
// mode because the synthetic require() used by the shim rejects node:-prefixed
// built-in specifiers.
//
// The __require variable must exist in the bundle's scope; we create it as a
// plain function that forwards to the real require().

globalThis.__require = (x) => require(x);
