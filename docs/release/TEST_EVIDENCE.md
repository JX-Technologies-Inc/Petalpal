# Local release test evidence — 2026-10-15

Final implementation checkpoint: `4ea40fd`.

All runs are from the isolated `codex/appstore-release-readiness` worktree. They use synthetic data and mock identity/provider behavior; no real Firebase users, private data, paid inference, production databases or external deployment. Passing source tests do not establish native device, production provider or store approval.

## Final integrated regression — 255 passed, 0 failed/cancelled/skipped

```
node scripts/release-regression.mjs test/back/garden-privacy.test.js test/back/flower-social-mutations.test.js test/back/garden-response.test.js test/back/realtime-security.test.js test/back/private-journals.test.js test/back/ai-event.route.test.js test/back/ai-cost-gate.test.js test/back/report-write-fence.test.js test/back/prompt-injection.security.test.js test/back/logging-privacy.test.js test/back/account-deletion.route.test.js test/back/account-deletion.test.js test/back/request-object-security.test.js test/back/content-safety.test.js test/back/ai-consent-lifecycle.test.js test/back/haiku-event-emotion.test.js test/back/speech-transcription.test.js test/back/ai-worker-lifecycle.test.js mobile/test/releaseConfig.test.mjs mobile/test/releaseReadiness.test.mjs mobile/test/emotionalSafety.test.mjs mobile/test/applicationIntegration.test.mjs mobile/test/authSession.test.mjs mobile/test/routePolicy.test.mjs mobile/test/privacyControls.test.mjs
```

Runner discards inherited provider/DB settings and points dotenv to /dev/null. Some mobile files import the pre-existing Flower detail test module, so counts include its repeated execution in separate Node test processes, not 255 unique end-to-end scenarios. Tests execute source UI callbacks/API requests using a hook harness, not a signed native renderer.

## Real PostgreSQL/pgvector — 5 passed

`node scripts/release-readiness-test.mjs`

Creates its own unique, loopback-only disposable pgvector PostgreSQL 16 container, applies all migrations, runs actual Express/Socket.IO/API scenarios, then removes its container. Network instrumentation recorded zero external attempts. Firebase deletion is injected/fake. Includes a real 384-dimensional memory-vector cleanup assertion and another owner's preserved data. Latest run also verifies current profile denial, paginated block-list response shape, moderator content removal and profile screening.

## Independent PostgreSQL races — 34 passed

`node scripts/api-security-fuzz.js --atomic`

Creates a separate loopback PostgreSQL fixture and independent database connections. 43 loopback HTTP requests, zero external attempts. Privacy revoke/regrant, sorted pair locks, commit failures, contention/deadlock handling and rollback remain asserted. Fixture schema now includes UserBlock and accepted Community version; no locking assertions were removed.

## Mobile configuration / source / export

- `node scripts/release-regression.mjs mobile/test/releaseConfig.test.mjs`: 1 passed after final identifier-validation edit.
- `node scripts/release-regression.mjs mobile/test/privacyControls.test.mjs`: 4 passed, also in integrated run.
- In mobile, installed TypeScript `tsc --noEmit` with environment/ dotenv isolation: exit 0.
- `node scripts/release-export.mjs`: Expo production JavaScript export for iOS, Android and web; environment contains only synthetic public Firebase/API configuration. This does not authenticate, call AI, sign, upload or deploy. Export output must never be published or submitted. Native binary compilation/signing is NOT VERIFIED.
- `git diff --check` and syntax checks for edited backend/config/scripts: passed.

## Evidence logs and earlier runs

Temporary local logs: `/tmp/petalpal-release-regression-final.log`, `/tmp/petalpal-release-postgres-final.log`, `/tmp/petalpal-release-atomic.log`, `/tmp/petalpal-release-types-final.log`, `/tmp/petalpal-release-export-final.log`, `/tmp/petalpal-release-config.log`. They are not committed and may expire. Central readiness document preserves counts/findings and checkpoint SHAs.

Earlier phase evidence remains recorded in the central report. The first combined run failed due to new-schema fixture omissions, additive author ID, onboarding dependency stubs, outdated pre-existing cache expectations and a missing generated static build. The errors were investigated; no FAIL was converted to PASS by deleting security assertions. Signed devices, real accessibility, live providers/settings, public URLs, inbox delivery and commercial/legal approval remain unverified.

## Export and HTTP follow-through

Final all-platform export rerun after mobile edits exited 0. A temporary copy of its web output was used by `node scripts/release-regression.mjs test/back/http-security.test.js`: **7/7 passed**. The legacy test's favicon path was corrected to the emitted Expo `favicon.ico`; status, cache and security-header assertions were retained. Scratch `mobile/dist` and copied `client/dist` were removed after verification so synthetic build configuration cannot be mistaken for an approved release. The HTTP evidence log is `/tmp/petalpal-release-http-final.log`.
