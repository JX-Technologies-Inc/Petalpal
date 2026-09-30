# PetalPal Mobile Backend Integration

## Visual Baseline
- Jinyin UI safe baseline: `d26700d08b22ec264622c646671b16c9488f7bc2`.
- Garden presentation frozen; scene/artwork, root screen and bootstrap are unchanged from the safe version. The additive integration HUD and temporary feature presentation can be restyled independently.
- Local and origin `backup/jinyin-ui-before-motion` and peeled `jinyin-ui-safe-v1` still resolve to the safe commit.

## Branch
- `integration/mobile-backend-test`; base: `d26700d08b22ec264622c646671b16c9488f7bc2`.
- Push to origin only. Keep main and `integration/frontend-v1` history intact.

## Working Backend Features
REAL = connected and testable; PREVIEW = existing backend but incomplete mobile workflow; COMING SOON = backend/product not ready; MISSING BACKEND CONTRACT = required behavior lacks a safe public contract. These are integration capabilities, not live health checks. HUD badges retain their existing mobile-functionality labels.

| Feature | Mobile Status | Backend | Testable |
|---|---|---|---|
| Auth / Session | REAL | Firebase; POST /auth/session; GET /session | Login, verification, profile setup, session/reload, logout |
| Events / Flowers | REAL | POST /events; GET /events/:eventId | Save/read; chosen Primary; backend Secondary; canonical flower |
| Garden | REAL | GET /users/:userId/garden | Owner hydration, refresh, all sources; device-only placement |
| Daily Check-in | PREVIEW | POST /users/:userId/flowers; GET /users/:userId/check-ins; GET /session | Existing Daily flowers/session metadata only; no Daily submission screen |
| Profile / Avatar | PREVIEW | GET /session; PUT /users/avatar; PUT /users/:userId/profile (locale only) | Read hydrated profile; editing not connected |
| AI Consent / Settings | PREVIEW | GET/PUT /users/:userId/ai-consent | Existing consent governs Events; Settings logout works; no consent editor |
| Friends | PREVIEW | GET /users/search?name=; GET /users/:userId/friends; POST /friends/remove | No mobile friend lifecycle yet |
| Friend Requests | PREVIEW | POST /friends/request; GET /friends/requests/:userId; POST /friends/requests/:requestId/accept or /reject | Not connected in mobile |
| Visit Friend Garden | PREVIEW | GET /users/:userId/garden (public visitor view); POST /visit, /visit/move, /leave | Visitor adapter exists; no mobile visit workflow |
| Support / Flower interaction | REAL | GET /users/:userId/flowers/:flowerId; POST .../support or .../message; DELETE flower | Detail/message/support logic connected; support requires a non-owner flower; visitor navigation pending |
| Realtime updates | PREVIEW | Authenticated Socket.IO; supportUpdated, messageAdded, visitRecordAdded, visitor movement | Flower-detail updates connected; general Garden/friend invalidation pending |
| Fairy / Memory | PREVIEW | GET /api/fairies, /api/fairy/progress, /api/fairy/runtime; PUT /api/fairies/:fairyId/active; GET/PUT /users/:userId/fairy-state; GET /ai/memories/:memoryId | Session/onboarding metadata and Event memory job summary only; no Fairy/Memory browser |
| Weekly | PREVIEW | POST /ai/reports/weekly/trigger; GET /ai/reports/weekly/:reportId | Backend exists, subject to consent/eligibility; mobile placeholder |
| Monthly | MISSING BACKEND CONTRACT | GET /ai/reports/monthly/:reportId | Read-by-ID exists; no public monthly trigger/list/discovery contract; no mobile workflow |

## Temporary Testing UI
- Direct development-only `/dev/backend-qa`, absent from normal navigation. Uses existing session/Garden services through a separate hook.
- Shows the feature map, API success/failure, owner-scoped flower/source/secondary counts and today's check-in flag. No credentials, tokens, raw Event/Journal text or private profile details.
- Production guard disables QA requests; browser verification of the production export returns to Garden without displaying QA. Existing `/garden-history` remains a separate backend-test screen; `/journal` and `/feature/*` now enter the shared Garden overlay.
- Local frontend: `http://localhost:8107/`; QA: `http://localhost:8107/dev/backend-qa`; API: `http://localhost:3107`. Backend database is localhost `petalpal_dev`.

- Validation: 150 focused Auth/Event/Garden/flower-detail/QA tests passed; mobile typecheck and web export passed. Browser comparison of clean d267 and this branch at 319 × 664 preserved framing/HUD/artwork; Garden scene/root/bootstrap remain unchanged; HUD interaction and styling are temporary integration UI.
- Live local flow: A Event save/read → Primary preserved and backend Secondary returned → Garden/reload; A logout → disposable B registration/verification/profile → zero B flowers/Events after reload → B logout → A data restored. B's request for A's private Event returned 404; public Garden stripped private source metadata. Placement/cache account switching and late responses passed focused tests.
- Synthetic Event/flower removed through the existing owner-scoped repository deletion path; original flower preserved. A has no historical/Daily flowers in the current dataset, so historical retention/rendering is validated by focused fixtures rather than a live historical sample.
- The single disposable B account and local profile were safely removed using the existing E2E cleanup helpers after exact email/UID and zero-content/relationship checks; original A data remained intact. Temporary credentials were kept mode-600 in the gitignored E2E env file, then removed after cleanup. Registration recovered from a transient connection error without creating another account. No production user was modified.
- Expo dev server uses CI mode: restart after source changes.

## Temporary Feature UI
- Primary accent: `#5AA4AB`; secondary accent: `#A67EB7`. Used on temporary icon tiles, actions, panel highlights, mood selection and status chips.
- Garden visual layer frozen. HUD side/vertical anchors and tile dimensions preserved; icon taps open a scrollable, centered transparent modal with a close X, Escape/native back, and Return to Garden.
- Events / Flowers: REAL. Profile and Settings: PREVIEW (hydrated read-only profile, real logout). Daily, Friends, Visit, Fairy, Weekly and Monthly: COMING SOON; no new backend actions.
- `/journal` and `/feature/:feature` deep links open the same Garden panel. Ordinary icon/close actions keep the Garden route and mounted scene; Garden icon only focuses/closes. Existing Event orchestration is extracted into `useEventJournal`, including unchanged Primary, idempotency, bounded emotion polling and canonical planting data. Successful save/status refresh updates the mounted Garden through its existing refresh hook.
- Jinyin can replace/restyle the lightweight FeatureOverlay, shared actions/sections/status chips and EventsPanel without changing services.
- Validation: live panel navigation, Event save/reconciliation, session reload/logout and same-viewport HUD parity now pass; see Verified Integration Corrections below.

## Remaining Backend/Mobile Integration
- Daily input/onboarding; profile/avatar and consent mutations; friend requests/lifecycle and visits.
- General realtime invalidation; Fairy/Memory workflow; report discovery and Monthly generation contract.
- Cross-device Expo placement writes remain unapproved; fallback layouts remain device-local previews.

## Rules
- Jinyin UI frozen; no Garden performance refactor, canvas/DPR/camera/Skia/cache/animation changes.
- React is a behavior reference only; backend identity, privacy, consent, emotion and canonical flowers are authoritative.
- Temporary feature panels are allowed; services → controller/hook → screen. No fake backend actions.
- Local development tests only; credentials stay in gitignored local files. No production deployment, main merge, personal push, history rewrite or safe-ref modification.

## Next Feature
Daily Check-in: connect the existing owner-scoped submission/onboarding contract to a minimal separate screen. Do not implement in this run.

## Invisible Web Performance Patch
- Prepared, uncommitted resource-only patch: Jinyin scene coordinates, camera fit, viewport, geometry, placement and artwork unchanged; existing feature/HUD edits preserved.
- Cache/resource cleanup: 640 MiB demand-filled Web texture-cache ceiling; dispose replaced surfaces and their Gr/WebGL registry contexts once.
- Hidden animation pause/lifecycle: foreground + route activity gates existing animations; Fish frame callback unregisters when inactive/disabled and on unmount; listeners clean up.
- Visual parity: pending same-viewport baseline comparison; no PASS claimed. Existing local ADC configuration located outside Git; local test-account token verification and authenticated Garden access now pass.
- Resource improvement: live before/after idle/navigation/background/memory comparison pending; no improvement claim. Resource lifecycle fixtures pass.
- Validation: 66 focused runtime/Garden/application tests, mobile typecheck and web export passed. Native verification pending. Local API :3107, petalpal_dev connectivity, test-account sign-in and Events panel return verified; remaining authenticated smoke pending.
- No runtime improvement claim or performance-patch commit/push; the resource patch remains outside this verification's completed integration corrections.

## Verified Integration Corrections
- Event save now reconciles through the canonical owner Garden API, including an already-completed Event whose POST Flower omits `sourceEvent`. Cards use backend secondary labels; Primary selection, emotion inference and idempotency remain unchanged. Existing terminal-status polling still refreshes canonical data.
- Image 401 root cause: the backend `img` can be emoji (for example `🌷`), which the mobile adapter incorrectly converted into an API path. The adapter now rejects non-image artwork URLs; cards render the supplied emoji directly and detail uses existing bundled artwork. Garden's existing placeholder stays unchanged. Real image URLs/paths retain their existing handling; no tokens in URLs or auth middleware changes.
- HUD layout: fixed 60px cells, with the safe baseline's 68.5px Events cell, and a fixed single-line status area. At 730 × 664 all ten cell rectangles and icon rectangles exactly match d267. Existing integration colors retained; Garden geometry, bridges, paths, framing, camera, scale and artwork unchanged.
- Local AI: existing repository Worker runs with `wrangler dev` on loopback `127.0.0.1:8787`, exposing `/v1/event-emotion`; backend :3107 uses that local URL and only localhost `petalpal_dev`. The existing gitignored development token is copied privately into ignored `cloudflare-worker/.env.local` as `RENDER_SHARED_SECRET`; existing machine Wrangler OAuth supplies the intended Workers AI binding. No production Worker deployment, database or user-setting changes. Because this macOS version cannot run current workerd, local dev runs in the existing Colima environment with official ARM64 Node 24 Debian, a default-handler-only temporary entry inside the container, and the standard CA certificate bundle. Repository Worker/model/prompt/taxonomy/filter/fallback code is unchanged; the AI binding performs authorized development inference remotely.
- Validation: 65 focused application/Garden/detail tests, mobile typecheck, web export and source/export secret scans passed. Fixture coverage verifies completed Event secondaries, a POST Flower missing `sourceEvent`, automatic card reconciliation and consistent later Garden refresh. Live local save created a Tulip with preserved `FIRE_BLOOM`, automatically read 25 canonical flowers, rendered backend emoji artwork with zero 401 console errors, and displayed existing backend secondary `fear` consistently. Reload/refresh retained all 25 flowers; login, session reload, logout and signed-out reload passed; anonymous `/session` remained 401. Fresh live validation now passes: exactly one disposable Expo Event retained selected `FIRE_BLOOM`, provider attempted = true, `SUCCESS`, Product-18-valid `fear, disappointment`, no Primary-redundant labels, and the identical canonical Flower/card labels appeared automatically without Refresh flowers. Garden retained all 25 original flowers (26 with the disposable flower), artwork had zero 401 errors, and reload preserved the final labels. The existing owner-scoped Event deletion safely removed only the disposable Event/Flower after a zero-report-evidence check, restoring all 25 original flowers. Focused recheck: 65 mobile application/Garden/detail checks plus 16 Event/secondary-selector checks passed; prior mobile typecheck/web export remained valid because mobile source did not change during this environment-only validation. Staged privacy/secret scan passed with zero actual credential matches; local configuration/runtime artifacts are excluded from Git.
