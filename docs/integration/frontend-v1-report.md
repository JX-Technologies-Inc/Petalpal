# Frontend V1 integration review

Updated 2026-09-29 (America/Vancouver). Production remains `client/`; `mobile/` stays separate.

## Baseline

Main is unchanged at `bd4697180871e96f8d277f4f413a9e3c064eff84`. Frontend source is `origin/frontend-V1` at `280b6d759fd92bfadc82f6d7b57ceb7b84c75d4b`. Initial merge commit: `5726ce04dc29592f5cd4cdf00dde855e7460a7ab`; five conflicts resolved. Its visitor Journal privacy fix is retained.

Work only continues on `integration/frontend-v1` in `/Users/xingranma/Desktop/PetalPal_JX-integration`. No main-worktree/research files were edited.

## Application integration

| Area | Before | After | Remaining |
|---|---|---|---|
| Auth | Stored token fallback, no login | Firebase email/password sign-in, verified backend session, existing profile completion, refreshed bearer tokens, bounded 401 retry, sign-out and stale-response rejection. Native uses Firebase AsyncStorage persistence; web uses Firebase browser persistence. | Public client settings/API origin are required at runtime. Real-account web sign-in/session/Event/logout verified against isolated local backend; native-device verification deferred. Additional production sign-in methods remain outside this pass. |
| Event/planting | Sample Journal entries and local flowers | Events screen POSTs /events with stable retry idempotency key; owner flowers come from GET /users/:id/garden. Planting checks owner flower and GET /events/:id, and validates flower existence before committing local coordinates. Deleted backend flowers are excluded on reload. No sample Events are used in this flow. | Backend has no V1 coordinate-update API. Layout is explicitly device-local, scoped by backend user ID; canonical Event/Flower data remains server-owned. |
| Emotion | Static prototype mood labels | User selects canonical Primary; backend secondary/status fields are displayed. No local classifier or duplicated redundancy rules. | None for the supported Event contract. |
| Flower | Sample species assumptions | Backend species/name/image/accent/effect retained; canonical artwork in legacy renderer and visual overlays in V1 growth renderer do not replace species. Friend-created assets remain. | Some backend species have no approved V1 collision class/art composition; planting is blocked rather than assigning another species or guessing geometry. |
| Async AI | No AI state UX | Event saving, pending/success/failed/skipped emotion state, manual refetch and bounded pending-only polling (10 seconds, then 15 seconds; four requests maximum). Memory state comes only from the POST response, including terminal states on idempotent replay. Refresh errors preserve saved Event/flower state. | Current client API has no durable memory-job status endpoint, so later completion/failure cannot be refetched by this frontend. No fake status or new job system added. |
| Fairy/RAG | No corresponding V1 screen | No new feature built; existing backend remains. | Product UI task. |
| Weekly | No corresponding V1 report screen | No new feature built; existing backend remains. | Product UI task. |
| Monthly | Geometric garden growth only | Geometric growth remains distinct from Bouquet/Reflection AI reports. | Product UI task. |

## Changes

- Frontend: auth gate and provider; existing navigation/Home/Journal-to-Events screens; planting canonical-data adaptation and account scope; canonical artwork/modifier overlays; social API uses the same refreshed auth transport, including socket reconnect authentication.
- Backend: none. Existing Firebase/session/Event/garden/detail contracts were read and reused, without changing production API behavior or deployment.
- Shared: lightweight typed mobile API and Event/Flower contracts in `mobile/src/services/`; Firebase client dependency added to the mobile lockfile. Existing client modules use Vite/browser globals, so they were not imported into Expo; the same Firebase project/session contract is used.
- Tests: application auth/API/ownership/consent/status/account-switch tests; existing flower-detail tests adapted to refreshed Firebase token injection. `npm run test:integration --prefix mobile` bypasses the known unrelated checkpoint dependency.

## Configuration

Set `EXPO_PUBLIC_FIREBASE_API_KEY` to the Firebase public client API key used by production. Optional public overrides: `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`. No private Firebase credentials are used.

Set `EXPO_PUBLIC_API_BASE_URL` to the existing backend origin for native clients and separate web hosting. Development web defaults to the same host on port 3000; same-origin web can use an empty base URL. Backend CORS and Firebase authorized domains must allow the actual prototype web origin. No backend secret, database URL, signing key or worker token belongs in these variables. No .env file was copied or committed.

Long-term AI requests use explicitly entered Event text only. Existing Journal data is not converted into Events. Session/profile sync does not grant AI consent; new profiles default to aiConsent=false. Existing backend consent and Event-only privacy gates remain authoritative. Social responses still exclude other users' private content. Private API responses already in flight are discarded when the auth connection changes; logout unmounts account screens and clears in-memory layout scope.

## Validation

- Mobile typecheck: PASS.
- Mobile Expo web export: PASS.
- Application + flower-detail tests: 30/30 PASS, including token refresh, no 403 retry, logout/in-flight private-response rejection, Event payload/idempotency, canonical species/modifiers, account-scoped storage and delayed auth-session restoration, explicit Primary selection and UI retry idempotency.
- Focused production growth and rendering tests: PASS.
- Backend tests: not rerun; no backend/shared-production contract code changed.
- Client regression: not rerun; client and deployment configuration unchanged.
- Known full prototype test checkpoint failure and missing ESLint dependencies remain as recorded in the initial review; not rerun or altered in this pass.
- Staged secret/privacy scan: passed for changed source/lockfile/report; no private credentials, .env contents, raw user data or research/reviewer datasets added. Test content/tokens are synthetic.
- Graphify: no existing integration artifacts; no regeneration needed.
- Real-account web verification: PASS using existing dedicated test credentials/config in memory, without copying or printing credentials. The actual mobile app obtained a Firebase bearer token, synced its authenticated backend session, created/read an owner-scoped synthetic Event, signed out and stayed signed out after reload. The test Event was deleted. Backend ran against the existing isolated local development database in manual dispatch mode. Native devices and production Cloudflare/Render/durable-memory execution were not exercised.

## Remaining item classification

| Item | Classification | Reason | Action |
|---|---|---|---|
| Real-account web auth | A — PR blocker, resolved | Validate real Firebase → backend → Event → logout. | Live browser verification passed; synthetic Event cleaned up. |
| Native auth verification | B — safe follow-up | Native infrastructure not required for this separate web prototype PR. | Explicitly deferred. |
| Device-local coordinates | D — missing backend contract; non-blocking | Existing Flower coordinate fields have no supported update contract for V1 world placement. | Account-scoped local layout retained and disclosed; no API invented. |
| Later durable-memory status | D — missing backend contract; non-blocking | Event/emotion states already have bounded refetch/fallback. Internal job polling is unnecessary for this PR. | Kept existing UX; removed technical API details from pending-memory copy. |
| Unsupported species geometry | C — product/asset decision; non-blocking | Approved geometry cannot be guessed. | Added tests for safe rejection and missing-art rendering; kept assets. |
| Fairy/RAG UI | B — safe follow-up | V1 has no corresponding screen. | No new feature or API created. |
| Weekly UI | B — safe follow-up | V1 has no corresponding report screen. | No new feature or API created. |
| Monthly AI UI | B — safe follow-up | Geometric growth remains separate from AI reports. | No new feature or API created. |

## PR readiness pass

Only frontend copy, two fallback tests and this report changed. Backend and production client remain unchanged. Mobile export/typecheck and all 30 focused tests pass; live auth smoke test passed. Staged secret/privacy review found no added credentials, raw user/reviewer data or environment files. The known unpublished checkpoint and missing prototype lint dependencies remain separate, non-blocking validation limitations; neither was changed or rerun.

## Verdict

READY FOR PR TO MAIN

The branch safely adds a separate prototype, preserves the current production client/backend and handles unavailable functionality explicitly. Missing roadmap screens, visual-layout persistence, internal memory-job refetch and unapproved species geometry are follow-up product work, not merge blockers for this scope. Main has not been merged or modified; production has not been deployed.
