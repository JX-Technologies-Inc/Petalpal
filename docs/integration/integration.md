# PetalPal Expo Integration Status

## Direction
- Jinyin's existing Expo V1 presentation is authoritative and visually frozen.
- Existing backend owns data, identity, privacy, consent and AI semantics.
- React `client/` is a behavior reference; Expo will eventually replace it.

## Git
- Branch: `integration/frontend-v1`; push destination: `origin` only.
- Current integration HEAD: resolve `git rev-parse HEAD` in this checkout; this report ships in the HUD/Garden commit. Starting baseline: `29101f5d23c5586702da60d3584cff7f82a9e192`.
- Known main/origin-main HEAD: `bd4697180871e96f8d277f4f413a9e3c064eff84` (unchanged).

## Completed
- Phase 1 Firebase login/registration, verification/resend/recovery, profile completion, refresh/terminal-401 invalidation, session hydration, account isolation and logout.
- Real Event create/read, explicit Primary Mood, backend secondary emotions/canonical flowers, bounded polling, flower detail and Support/messages.
- Authenticated `/` renders the existing Garden, with additive game HUD shortcuts and honest statuses. Explicit QA routes remain separate.
- Complete owner Garden hydration, historical/Daily secondary mapping, matched device placements and deterministic unplaced-flower previews; focus/reload refresh and retry.
- Navigation returns to the existing Garden; hidden zero-size layouts retain the Skia canvas rather than recreate its GPU surface.

## Current feature status

| Feature | Status | Route | Backend |
|---|---|---|---|
| Garden | REAL | `/` (optional `/garden-history`) | `GET /users/:id/garden`; existing flower detail/actions |
| Events / Flowers | REAL | `/journal` | `POST /events`, `GET /events/:id`, Garden |
| Daily | COMING SOON | `/feature/daily` | Not connected |
| Friends | COMING SOON | `/feature/friends` | Not connected |
| Visit | COMING SOON | `/feature/visit` | Not connected |
| Fairy | COMING SOON | `/feature/fairy` | Not connected |
| Profile | PREVIEW | `/feature/profile` | Hydrated `/session`, read only |
| Weekly | COMING SOON | `/feature/weekly` | Not connected |
| Monthly | COMING SOON | `/feature/monthly` | Not connected |
| Settings | PREVIEW | `/feature/settings` | Hydrated account info, real Firebase logout |

## Important migrated React behavior
- All canonical Garden flowers are included regardless of `sourceEventId` or device coordinates.
- Event secondary labels come from `sourceEvent`; historical/Daily labels come from `dailyCheckIn.emotionResult`, with array/type guards.
- Canonical source IDs, date, Primary, secondary labels, species and modifiers survive layout adaptation. Garden state retains no Event/Journal text.
- Backend/private-owner and public-visitor reads remain distinct; visitor adaptation strips source/private metadata and ignores owner device layouts.
- Confirm/delete preserves other unplaced backend flowers; backend mode cannot reset to demo seeds.

## Remaining React behavior
- Daily/onboarding progression; Friends lifecycle; Garden visit/leave; profile/avatar mutations; explicit AI consent controls; general realtime invalidation.
- Fairy, Weekly and Monthly product surfaces need their own scoped migration work.

## Known product/backend blockers
- No approved cross-device Expo V1 coordinate write contract. Backend flower state remains canonical; confirmed visual positions remain device-local.
- FALLBACK anchors are temporary, deterministic for the current flower set, never auto-saved, and may shift as the set changes. Crowded previews can share anchors; final layout polish/capacity is future work.
- Species without approved planting collision geometry remain unplantable; backend images or safe markers keep them visible without guessed species/geometry.

## Temporary UI
- `GardenHud` icon placement/labels/status badges; Jinyin can replace this presentation independently.
- One lightweight feature route for six COMING SOON features and read-only Profile/partial Settings previews.
- Optional Garden history is a backend-test detail surface, not the main Garden.

## Known local/dev issues
- Expo runs in CI mode without watching; restart after source changes.
- Existing untracked root `node_modules` symlink supports the local backend; preserve it and never stage it.
- Local frontend `http://localhost:8107`, API `http://localhost:3107`, localhost PostgreSQL `petalpal_dev`, development/manual AI dispatch. No production connection or deployment.

## Validation
- Focused Garden/HUD: 13 passed; existing Event/flower detail integration: 30 passed; Phase 1 auth: 23 passed.
- Typecheck and web export passed. Real local Firebase login → root Garden → every HUD route → Event create → persisted Garden/reload → mobile viewport → Settings/logout/reload passed; synthetic local flower cleaned up. Exact staged secret/privacy review passed (credentials/private text excluded; synthetic fixtures only).
- Seven repeated feature/return cycles retained one canvas with stable WASM memory and no runtime errors.
- Fixtures cover every source, all 12 fallback masks, determinism/reload/no writes, privacy/account isolation, retry, historical planting, save/delete preservation and release canonical rendering.

## Next recommended phase
- Daily Check-in and onboarding progression, reusing existing backend contracts and Jinyin presentation where available. Do not begin automatically.
