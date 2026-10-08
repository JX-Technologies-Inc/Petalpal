# SDK 57 decoder security backport

Private CommonJS backport of the official GHSA-vcc3-ghjq-m6fr fix:
https://github.com/SamVerschueren/decode-uri-component/commit/fa479dafeede7bedf04e5c89aa78f2a78c664005

`index.cjs` is that commit's `index.js` with exactly three adaptations:
1. Export the callable function with `module.exports` instead of an ESM default.
2. Preserve decoder 0.2.x `+` → space behavior required by existing callers.
3. After native decoding fails, return the plus-normalized encoded component unchanged if it exceeds 4096 UTF-16 code units, before entering the fallback. Valid components, including longer values, decode normally. Within the bound, upstream's single-pass UTF-8 scanner replaces exponential recursive decoding; the retained replacement map has bounded work.

MIT license retained. Package version 0.2.2 preserves query-string 7's dependency range; it is **not** a claim to be upstream 0.5.0 or to close registry/GitHub advisories. Source SHA-256 before adaptations: `9401353df38f8010ad7035fe8d666bce6a4902bc1cff809afc4ab23fa2e0bdaa`.

The mobile manifest uses a local file dependency, deduplicated by its lockfile. Clean `npm ci` installs this source for all query-string consumers without scripts, overrides or edits to node_modules. Run `node --test test/decoderBackport.test.mjs test/routerUrlSecurity.test.mjs test/routePolicy.test.mjs` after installing. Tests verify resolution, CommonJS compatibility, URL semantics and bounded malicious inputs. Never remove this backport until a supported SDK dependency chain includes the upstream fix and these regressions pass.
