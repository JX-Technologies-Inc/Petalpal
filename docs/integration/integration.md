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

## Skia Lifecycle Fix
- Safe lifecycle checkpoint on `integration/mobile-backend-test`: Web pictures, paint/path/shader/filter handles, decoded images, replaced surfaces/contexts and registrations release correctly. Root unmount stops its animation mapper before image disposal; retired Garden IDs reject late picture submissions. Mounted/blurred Garden and unrelated canvases remain intact.
- Five verified logout/login cycles: CanvasKit heap stayed ~647.125 MiB; each mounted Garden held 106 images and one picture. Final settled logout released all images/pictures/deferred entries/surfaces/GPU cache. No current-document runtime errors; Jinyin artwork, coordinates, framing and HUD unchanged.
- 41 focused Garden/resource tests, mobile typecheck, Web export and privacy scan passed; profiling instrumentation excluded. Native verification and genuine browser-hidden measurement remain pending. This checkpoint is separate from further steady-state memory work.

## Verified Integration Corrections
- Event save now reconciles through the canonical owner Garden API, including an already-completed Event whose POST Flower omits `sourceEvent`. Cards use backend secondary labels; Primary selection, emotion inference and idempotency remain unchanged. Existing terminal-status polling still refreshes canonical data.
- Image 401 root cause: the backend `img` can be emoji (for example `🌷`), which the mobile adapter incorrectly converted into an API path. The adapter now rejects non-image artwork URLs; cards render the supplied emoji directly and detail uses existing bundled artwork. Garden's existing placeholder stays unchanged. Real image URLs/paths retain their existing handling; no tokens in URLs or auth middleware changes.
- HUD layout: fixed 60px cells, with the safe baseline's 68.5px Events cell, and a fixed single-line status area. At 730 × 664 all ten cell rectangles and icon rectangles exactly match d267. Existing integration colors retained; Garden geometry, bridges, paths, framing, camera, scale and artwork unchanged.
- Local AI: existing repository Worker runs with `wrangler dev` on loopback `127.0.0.1:8787`, exposing `/v1/event-emotion`; backend :3107 uses that local URL and only localhost `petalpal_dev`. The existing gitignored development token is copied privately into ignored `cloudflare-worker/.env.local` as `RENDER_SHARED_SECRET`; existing machine Wrangler OAuth supplies the intended Workers AI binding. No production Worker deployment, database or user-setting changes. Because this macOS version cannot run current workerd, local dev runs in the existing Colima environment with official ARM64 Node 24 Debian, a default-handler-only temporary entry inside the container, and the standard CA certificate bundle. Repository Worker/model/prompt/taxonomy/filter/fallback code is unchanged; the AI binding performs authorized development inference remotely.
- Validation: 65 focused application/Garden/detail tests, mobile typecheck, web export and source/export secret scans passed. Fixture coverage verifies completed Event secondaries, a POST Flower missing `sourceEvent`, automatic card reconciliation and consistent later Garden refresh. Live local save created a Tulip with preserved `FIRE_BLOOM`, automatically read 25 canonical flowers, rendered backend emoji artwork with zero 401 console errors, and displayed existing backend secondary `fear` consistently. Reload/refresh retained all 25 flowers; login, session reload, logout and signed-out reload passed; anonymous `/session` remained 401. Fresh live validation now passes: exactly one disposable Expo Event retained selected `FIRE_BLOOM`, provider attempted = true, `SUCCESS`, Product-18-valid `fear, disappointment`, no Primary-redundant labels, and the identical canonical Flower/card labels appeared automatically without Refresh flowers. Garden retained all 25 original flowers (26 with the disposable flower), artwork had zero 401 errors, and reload preserved the final labels. The existing owner-scoped Event deletion safely removed only the disposable Event/Flower after a zero-report-evidence check, restoring all 25 original flowers. Focused recheck: 65 mobile application/Garden/detail checks plus 16 Event/secondary-selector checks passed; prior mobile typecheck/web export remained valid because mobile source did not change during this environment-only validation. Staged privacy/secret scan passed with zero actual credential matches; local configuration/runtime artifacts are excluded from Git.

## 8 GB Runtime Budget
- Actual host: 8 GiB. Process physical footprints are approximate; renderer + Metro/preview + local backend is the app estimate. Shared browser GPU and the existing ~4,109 MiB Colima VM are reported separately, not attributed exclusively to PetalPal. Local backend/database/model/auth behavior is unchanged.
- Before: long-lived Garden renderer ~2,867 MiB, app estimate ~3,499 MiB, with CanvasKit allocation aborts. A fresh session grew from ~1,536 to ~1,885 MiB over several minutes; five feature cycles reached ~2,118 MiB app estimate. Memory pressure was elevated and system swap ~11.6–12.3 GiB.
- Runtime artwork: 99 unique decoded images, estimated ~552 MiB RGBA; duplicate decoding adds only ~0.2 MiB. The ten largest loaded layers are 2400 × 1800 transparent world-aligned infrastructure PNGs, ~16.48 MiB each. Maximum supported display at the tested 730 × 664 viewport/3× zoom is 2190 × 1643 CSS pixels (4380 × 3285 at DPR 2). Preserve originals/full registration; no downsampling, backing-scale, culling, geometry or artwork changes. Canvas backing itself is only ~7.4 MiB.
- Retained surface/context/registry cleanup and inactive/background animation gating. Added Garden picture retirement/view unregistering, and a Web-only ownership shim for the pinned Skia 2.6.2 temporary paint/path/shader/filter handles. Replaced Paint refs are retired after successful assign/reset; live JS owners retain their native handles and GC releases unreachable owners. Native Skia is untouched.
- Cache trials: 384/512/576 MiB caused texture thrashing (~5.5/10.4/11.9 fps, shared GPU CPU ~75–85%). 608 MiB is the lowest tested stable cap (~26–27 fps, ~581 MiB actual cache, ~587 MiB after pans); 640 MiB provided no visible advantage. Cache limits are demand-filled ceilings.
- Five feature cycles and five History route exits/returns passed; original 25 backend flowers remained. Route inactivity reduced actual GPU cache to ~6 MiB, renderer CPU to ~4.6%, and shared GPU footprint from ~958 to ~277 MiB. Slow/larger pans and immediate direction reversals produced no current-page CanvasKit/image-401 errors.
- Visual comparison at 730 × 664 preserves bridges, paths, islands, framing, landmarks, artwork and HUD dimensions/positions. Animated pixels naturally vary. AppState/Fish pause/resume/cleanup is covered by fixtures; genuine browser-hidden measurement is unavailable in the current in-app browser (its DOM visibility remains visible when the surface is hidden), so it is not claimed as a live pass.
- Completed prior idle test: CanvasKit heap ~647 MiB for six minutes, renderer ~993–999 MiB, app estimate ~1,404–1,419 MiB; final three idle windows stayed green while system swap fell ~12,518→12,446 MiB. Local production app estimate ~956–964 MiB (preview server ~18.5 MiB versus Metro ~234 MiB), renderer ~759–767 MiB. Existing __DEV__ guards omit bridge/infrastructure layers in production, so the full reduction is not a visual-equivalent tooling comparison.
- Unmount/login blocker fixed: Skia's asynchronous root teardown submitted a final picture into `deferedPictures` after Garden unregistering, while its animation mapper could still replay. Retired Garden IDs now reject late pictures; root teardown stops the pinned Web mapper and releases unique drawn image handles only after successful reconciler unmount. Mounted/blurred Garden and unrelated canvases remain untouched. Five corrected logout/login cycles kept the heap exactly ~647.125 MiB and 106 mounted images, with zero current-document errors. Final settled logout: zero images/pictures/deferred entries/surfaces/GPU cache; one unused image can briefly await normal GC.
- Validation: 41 focused tests, mobile typecheck, Web export and source/export privacy scan passed. Profiling instrumentation removed; authenticated clean preview restored. Lifecycle checkpoint is authorized independently of the pending genuine hidden-tab measurement; further steady-state reduction is evaluated separately. Native relevance: CanvasKit/handle/view/root cleanup is Web-only; AppState/callback cleanup is cross-platform and still needs native runtime verification.
