# PetalPal Expo Integration Status

## Direction
- Jinyin's existing Expo V1 presentation is authoritative and visually frozen.
- Existing backend owns data, identity, privacy, consent and AI semantics.
- React `client/` is a behavior reference; Expo will eventually replace it.

## Git
- Branch: `integration/frontend-v1`; push destination: `origin` only.
- Current integration HEAD: resolve `git rev-parse HEAD` in this checkout; this report ships in the HUD/Garden commit. Starting baseline: `29101f5d23c5586702da60d3584cff7f82a9e192`.
- Known main/origin-main HEAD: `bd4697180871e96f8d277f4f413a9e3c064eff84` (unchanged).

## Safe restore point
- Branch: `backup/jinyin-ui-before-motion`.
- Annotated tag: `jinyin-ui-safe-v1` (Safe Jinyin Expo UI before Garden motion refactor).
- Pre-refactor commit: `d26700d08b22ec264622c646671b16c9488f7bc2`; integration, backup and peeled tag initially matched. Backup branch and tag pushed and verified on `origin`.

## Garden Rendering / Motion
- Existing Skia world camera, Reanimated and Gesture Handler remain unchanged. Water, terrain, landmarks and flowers share one world transform; HUD remains outside the Canvas.
- Artwork, composition, effects, typography, colors, layout and navigation presentation are preserved. No visual effect was removed. The earlier camera/shader experiments were reverted.
- Current Web checks: idle, short/long diagonal pans, reversals, camera + local animation, fixed HUD, five route round trips and a temporary 30-flower presentation fixture passed. Automated drag checks do not certify native fast-flick/pinch behavior; the real account has one Event flower. Temporary fixtures/probes were removed without backend writes.

## Runtime Performance / Resource Usage
- Measured 2026-09-29: Apple M2 / 8 GB, Codex Chromium/ANGLE Metal, CSS 319×664 / backing 638×1328. CPU is macOS percent (100% = one core); memory is `top` physical footprint including compression, not RSS. The GPU helper is shared; other apps also contribute to system memory pressure. No whole-app memory ceiling or 60 FPS claim.
- Verified culprit: CanvasKit's default 256 MiB resource cache evicted/reuploaded the unchanged Garden (~542 MiB textures in dev, ~260 MiB in release) on idle animation frames. Dev scene recording was ~4 ms versus drawPicture ~156 ms. Pausing all animation reduced GPU CPU to 6–7%; removing water field, ripples or waterfall individually did not solve it. One Canvas; no React camera rerender storm.

| Warm idle metric | Before | After |
|---|---|---|
| Dev GPU / tab CPU | 60–93% / 11–26% | 16–22% / 13–23% |
| Dev tab / GPU footprint | ~837–846 / ~500–1304 MiB | ~821–841 / ~847–913 MiB |
| Production GPU / tab CPU | 62–79% / 14–19% | 17–25% / 13–21% |
| Production tab / GPU footprint | ~674 / ~512–635 MiB | initial ~531, settled ~606–634 / ~482–567 MiB |
| Dev / production draw median | ~156 / ~38 ms | ~1.4 / ~0.5–1.2 ms |
| Production callback p95 / long tasks | ~67 ms / 13–15 per 6 s | ~34–35 ms / zero warm |

- Fix: Web bootstrap sets a demand-filled 640 MiB texture ceiling, owns one surface per canvas, and deletes replaced surfaces, Gr contexts and WebGL registry handles. Skia 2.6.2 Web otherwise orphaned prior renderers on hidden-route/resized layouts. Artwork/DPR unchanged. All landmark/water motion pauses on blur/background; Fish frame callback explicitly deactivates and cleans up.
- Leak found: YES, orphaned Web surfaces/contexts; hidden landmarks also continued recording ~180 scenes per 6 s. Final bounded checks (~3 minutes / five production returns; ~2 minutes / three dev returns) had one live context, surface creates minus deletes = 1, constant image decodes (76 release / 85 dev). WASM capacity rose once (release 382→459 MiB; dev 551→647 MiB), then stabilized; JS heap fluctuated with GC. No continuing navigation growth. Leaving Garden reduced GPU cache to ~6 MiB, GPU footprint to ~204–301 MiB and settled tab CPU to ~1–2%, with zero scene recording/drawing; scene images/heap capacity remain for return.
- Login/light/process checks: fresh dev login ~220 MiB tab / ~1% CPU / zero Canvas; production sign-out ~526 MiB retained tab heap / ~1% CPU / zero Canvas. Warm Metro/backend/static server CPU ~0–0.1% / 0% / 0%; footprints Metro ~205–231 MiB after restart (before ~444–922), backend ~169–175 MiB, server ~18 MiB. Metro footprint change is restart/tooling behavior, not an app-code saving. Garden focus requests invalidate stale responses; detail sockets and world-time interval/AppState listeners have cleanup. No unbounded array/map or accumulating gesture listener found in targeted inspection.
- Smoothness: normal idle, short/long pans, reversals, camera + local animation, HUD and repeated returns passed. Temporary 30-flower fixture at DPR 2: draw ~1.2 ms median / ~1.8 ms p95, zero warm long tasks, GPU ~18–21%, tab ~15–17%. Real account has one Event flower; fixture did not write backend data. Observed callback cadence ~30 Hz; cold decode/compilation long tasks remain. Automated drags do not certify native flick/pinch behavior.
- Native: cache/renderer fixes are WEB-ONLY; inactive animation scheduling is CROSS-PLATFORM. Decoded artwork (~351 MiB release / ~531 MiB dev cumulative estimate) and actual device GPU/RAM NEED NATIVE VERIFICATION. `simctl` unavailable; no native pipeline installed.
- Validation: 129 focused resource/auth/application/Garden/detail tests; 57 mask assertions; production rendering and 591-piece spatial/coverage checks; typecheck and clean production export passed. Clean final-build sample: GPU CPU ~18–20%, tab ~12–15%, footprints ~537–567 / ~632–634 MiB respectively. No final runtime errors; existing RN Web shadow/pointer-events deprecation warnings remain. Approved-checkpoint render-cache/full planting suites remain unavailable due to missing reference/storage fixtures; none invented. Exact changed-file secret/privacy scan passed. All probes and 30-flower toggles removed.

## Completed
- Phase 1 Firebase login/registration, verification/resend/recovery, profile completion, refresh/terminal-401 invalidation, session hydration, account isolation and logout.
- Real Event create/read, explicit Primary Mood, backend secondary emotions/canonical flowers, bounded polling, flower detail and Support/messages.
- Authenticated `/` renders the existing Garden, with additive game HUD shortcuts and honest statuses. Explicit QA routes remain separate.
- Complete owner Garden hydration, historical/Daily secondary mapping, matched device placements and deterministic unplaced-flower previews; focus/reload refresh and retry.
- Navigation retains Garden camera/images; the Web adapter releases replaced GPU surfaces on hidden zero-size layouts, and inactive scene motion pauses.

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
