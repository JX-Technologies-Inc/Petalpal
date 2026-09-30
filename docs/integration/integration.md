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
- Lifecycle checkpoint `f5e49b4` (pushed to `origin/integration/mobile-backend-test`): Web pictures, paint/path/shader/filter handles, decoded images, replaced surfaces/contexts and registrations release correctly. Root unmount stops its animation mapper before image disposal; retired Garden IDs reject late picture submissions. Mounted/blurred Garden and unrelated canvases remain intact.
- Five verified logout/login cycles: CanvasKit heap stayed ~647.125 MiB; each mounted Garden held 106 images and one picture. Final settled logout released all images/pictures/deferred entries/surfaces/GPU cache. No current-document runtime errors; Jinyin artwork, coordinates, framing and HUD unchanged.
- 41 focused Garden/resource tests, mobile typecheck, Web export and privacy scan passed; profiling instrumentation excluded. Native verification and genuine browser-hidden measurement remain pending. This checkpoint is separate from further steady-state memory work.

## Verified Integration Corrections
- Event save now reconciles through the canonical owner Garden API, including an already-completed Event whose POST Flower omits `sourceEvent`. Cards use backend secondary labels; Primary selection, emotion inference and idempotency remain unchanged. Existing terminal-status polling still refreshes canonical data.
- Image 401 root cause: the backend `img` can be emoji (for example `🌷`), which the mobile adapter incorrectly converted into an API path. The adapter now rejects non-image artwork URLs; cards render the supplied emoji directly and detail uses existing bundled artwork. Garden's existing placeholder stays unchanged. Real image URLs/paths retain their existing handling; no tokens in URLs or auth middleware changes.
- HUD layout: fixed 60px cells, with the safe baseline's 68.5px Events cell, and a fixed single-line status area. At 730 × 664 all ten cell rectangles and icon rectangles exactly match d267. Existing integration colors retained; Garden geometry, bridges, paths, framing, camera, scale and artwork unchanged.
- Local AI: existing repository Worker runs with `wrangler dev` on loopback `127.0.0.1:8787`, exposing `/v1/event-emotion`; backend :3107 uses that local URL and only localhost `petalpal_dev`. The existing gitignored development token is copied privately into ignored `cloudflare-worker/.env.local` as `RENDER_SHARED_SECRET`; existing machine Wrangler OAuth supplies the intended Workers AI binding. No production Worker deployment, database or user-setting changes. Because this macOS version cannot run current workerd, local dev runs in the existing Colima environment with official ARM64 Node 24 Debian, a default-handler-only temporary entry inside the container, and the standard CA certificate bundle. Repository Worker/model/prompt/taxonomy/filter/fallback code is unchanged; the AI binding performs authorized development inference remotely.
- Validation: 65 focused application/Garden/detail tests, mobile typecheck, web export and source/export secret scans passed. Fixture coverage verifies completed Event secondaries, a POST Flower missing `sourceEvent`, automatic card reconciliation and consistent later Garden refresh. Live local save created a Tulip with preserved `FIRE_BLOOM`, automatically read 25 canonical flowers, rendered backend emoji artwork with zero 401 console errors, and displayed existing backend secondary `fear` consistently. Reload/refresh retained all 25 flowers; login, session reload, logout and signed-out reload passed; anonymous `/session` remained 401. Fresh live validation now passes: exactly one disposable Expo Event retained selected `FIRE_BLOOM`, provider attempted = true, `SUCCESS`, Product-18-valid `fear, disappointment`, no Primary-redundant labels, and the identical canonical Flower/card labels appeared automatically without Refresh flowers. Garden retained all 25 original flowers (26 with the disposable flower), artwork had zero 401 errors, and reload preserved the final labels. The existing owner-scoped Event deletion safely removed only the disposable Event/Flower after a zero-report-evidence check, restoring all 25 original flowers. Focused recheck: 65 mobile application/Garden/detail checks plus 16 Event/secondary-selector checks passed; prior mobile typecheck/web export remained valid because mobile source did not change during this environment-only validation. Staged privacy/secret scan passed with zero actual credential matches; local configuration/runtime artifacts are excluded from Git.

## 8 GB Runtime Budget
- Web-only runtime copies trim transparent padding from 17 full-world PNGs, preserving every RGBA source pixel, an eight-pixel transparent sampling margin (the already-empty layer becomes one transparent pixel), original registration and draw order. Originals/native imports remain intact. No downsampling, camera/world/layout/HUD/effect changes, backing-scale changes or culling. Regenerate copies with `node mobile/scripts/buildGardenRuntimeArtwork.mjs`; focused tests verify source pixels, outside alpha, pan/zoom/DPR registration and actual CanvasKit linear sampling.
- Those layers fall from ~280.16 to ~6.11 MiB decoded RGBA; all loaded artwork falls from ~551.8 to ~277.8 MiB (106 handles/99 unique assets, only ~0.2 MiB duplicated). Original cache trials at 384/512/576 MiB thrashed because the old working set was larger. The reduced working set uses a 384 MiB demand-filled ceiling; actual cache ~284–285 MiB during idle/pans, ~6 MiB on route inactivity, zero on unmount. Garden still retains all 25 backend flowers.
- Stable Phase A baseline: CanvasKit 647.125 MiB for six minutes, renderer ~993–999 MiB, shared GPU ~929–938 MiB; five logout/login cycles had no heap growth. Fresh pre-copy control: renderer 1081 MiB, shared GPU 1020 MiB; CPU ~86%/~36% of one core. Post-copy initial heap 318.625 MiB expanded once to 382.375 MiB after repeated mounts, then held for five warmed mounts and the final idle observations (382.375 MiB, 40.91% below 647.125 MiB). Renderer measured ~840 MiB and shared GPU ~596 MiB in the final sampled idle window; CPU ~100%/~24% of one core while animations continued. No CPU-reduction claim. Host is 8 GiB; existing ~4109 MiB Colima VM and shared browser GPU are separate from app attribution. System swap/Memory Pressure are host-wide, not exclusively PetalPal.
- Seven logout/login cycles preserved 106 images and one picture mounted; settled unmount reached zero images/pictures/deferred entries/surfaces/GPU cache (one unused image may wait briefly for normal GC). Five History exits/returns and Events/Profile/Settings overlays retained the 25 backend flowers. Slow/fast pan and immediate reversal passed without missing art or sustained texture thrashing; current-document runtime errors: zero. Same-viewport visual sanity and CanvasKit sampling tests preserve bridges, paths/islands, framing, HUD and original pixels. Host pressure remained elevated in the last sampled window; system swap fluctuated rather than providing an app-specific improvement claim.
- Final validation: 45 focused Garden/resource/artwork tests and mobile typecheck passed; production Web export succeeded with profiling instrumentation excluded. Current Web runtime errors: zero. Source/export/staged secret/privacy scan passed with zero secret matches, private-key blocks, JWT values or profiling imports. Native runtime and genuine hidden-tab measurement remain pending.
- Image reuse would save only ~0.2 MiB. Heavy images already mount with Garden; lazy loading/culling would risk pan pop-in. Existing native pools/ownership cleanup retained. Canvas backing remains 1460×1328 (~7.4 MiB) at 730×664/DPR 2. Genuine browser-hidden measurement remains unavailable: hiding the IAB surface leaves DOM visibility visible; AppState/Fish gating is fixture-tested, not claimed as a live hidden-tab pass.

Largest remaining loaded assets (paths relative to `mobile/assets/garden/`; RGBA excludes GPU copies). Maximum display below is CSS at 730×664, 3× zoom; DPR 2 doubles both dimensions. These eager Garden layers are not always on-screen during pan; deferring them requires separate pop-in verification. Preserve full-resolution source pixels; only transparent padding is eligible for lossless runtime trimming.

| Asset | Source pixels | File KiB | RGBA MiB | Max display CSS | Always visible / lazy now / safe reduction |
| --- | --- | ---: | ---: | --- | --- |
| `bridges/approved-circulation/main-road-connected.png` | 680×2950 | 1596.8 | 7.65 | 621×2692 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/tree-base.png` | 1448×1086 | 2357.1 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/canopy-overlay.png` | 1448×1086 | 1470.8 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/wisteria-overlay.png` | 1448×1086 | 852.2 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/mailbox.png` | 1448×1086 | 71.5 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/warmlight.png` | 1448×1086 | 461.6 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/treehouse/foreground-overlay.png` | 1448×1086 | 517.2 | 6.00 | 859×644 | No / No / transparent trim only; not downsampled |
| `landmarks/tea-set/left-chair-base.png` | 1536×1024 | 1123.6 | 6.00 | 231×154 | No / No / transparent trim only; not downsampled |
| `landmarks/tea-set/right-chair-base.png` | 1536×1024 | 1377.4 | 6.00 | 185×123 | No / No / transparent trim only; not downsampled |
| `landmarks/tea-set/tea-table.png` | 1024×1536 | 2275.5 | 6.00 | 89×134 | No / No / transparent trim only; not downsampled |
