# PetalPal Mobile Backend Integration

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

- Earlier integration checkpoint: 150 focused Auth/Event/Garden/flower-detail/QA tests, typecheck and Web export passed; same-viewport comparison with d267 preserved framing/HUD/artwork. Current rendering behavior and validation are recorded below.
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
- Jinyin visuals and product geometry are frozen. Web lifecycle, cache and physical render-quality optimizations must obey Garden Rendering & Adaptive Quality below.
- React is a behavior reference only; backend identity, privacy, consent, emotion and canonical flowers are authoritative.
- Temporary feature panels are allowed; services → controller/hook → screen. No fake backend actions.
- Local development tests only; credentials stay in gitignored local files. No production deployment, main merge, personal push, history rewrite or safe-ref modification.

## Next Feature
Daily Check-in: connect the existing owner-scoped submission/onboarding contract to a minimal separate screen. Do not implement in this run.

## Verified Integration Corrections
- Event save now reconciles through the canonical owner Garden API, including an already-completed Event whose POST Flower omits `sourceEvent`. Cards use backend secondary labels; Primary selection, emotion inference and idempotency remain unchanged. Existing terminal-status polling still refreshes canonical data.
- Image 401 root cause: the backend `img` can be emoji (for example `🌷`), which the mobile adapter incorrectly converted into an API path. The adapter now rejects non-image artwork URLs; cards render the supplied emoji directly and detail uses existing bundled artwork. Garden's existing placeholder stays unchanged. Real image URLs/paths retain their existing handling; no tokens in URLs or auth middleware changes.
- HUD layout: fixed 60px cells, with the safe baseline's 68.5px Events cell, and a fixed single-line status area. At 730 × 664 all ten cell rectangles and icon rectangles exactly match d267. Existing integration colors retained; Garden geometry, bridges, paths, framing, camera, scale and artwork unchanged.
- Local AI: existing repository Worker runs with `wrangler dev` on loopback `127.0.0.1:8787`, exposing `/v1/event-emotion`; backend :3107 uses that local URL and only localhost `petalpal_dev`. The existing gitignored development token is copied privately into ignored `cloudflare-worker/.env.local` as `RENDER_SHARED_SECRET`; existing machine Wrangler OAuth supplies the intended Workers AI binding. No production Worker deployment, database or user-setting changes. Because this macOS version cannot run current workerd, local dev runs in the existing Colima environment with official ARM64 Node 24 Debian, a default-handler-only temporary entry inside the container, and the standard CA certificate bundle. Repository Worker/model/prompt/taxonomy/filter/fallback code is unchanged; the AI binding performs authorized development inference remotely.
- Validation: 65 focused application/Garden/detail tests, mobile typecheck, web export and source/export secret scans passed. Fixture coverage verifies completed Event secondaries, a POST Flower missing `sourceEvent`, automatic card reconciliation and consistent later Garden refresh. Live local save created a Tulip with preserved `FIRE_BLOOM`, automatically read 25 canonical flowers, rendered backend emoji artwork with zero 401 console errors, and displayed existing backend secondary `fear` consistently. Reload/refresh retained all 25 flowers; login, session reload, logout and signed-out reload passed; anonymous `/session` remained 401. Fresh live validation now passes: exactly one disposable Expo Event retained selected `FIRE_BLOOM`, provider attempted = true, `SUCCESS`, Product-18-valid `fear, disappointment`, no Primary-redundant labels, and the identical canonical Flower/card labels appeared automatically without Refresh flowers. Garden retained all 25 original flowers (26 with the disposable flower), artwork had zero 401 errors, and reload preserved the final labels. The existing owner-scoped Event deletion safely removed only the disposable Event/Flower after a zero-report-evidence check, restoring all 25 original flowers. Focused recheck: 65 mobile application/Garden/detail checks plus 16 Event/secondary-selector checks passed; prior mobile typecheck/web export remained valid because mobile source did not change during this environment-only validation. Staged privacy/secret scan passed with zero actual credential matches; local configuration/runtime artifacts are excluded from Git.

## Garden Rendering & Adaptive Quality

### Visual baseline
- Jinyin's Garden composition, artwork and layout are authoritative and visually frozen. Safe visual reference: `d26700d08b22ec264622c646671b16c9488f7bc2`.
- Performance work must not change bridges, paths, islands, logical coordinates, world scale, camera/framing, HUD placement, artwork or Garden geometry.
- Runtime transparent-padding crops preserve original visible source pixels, registration and draw order. Original artwork remains untouched; there is no asset downsampling.

### Resource lifecycle
- Phase A (`f5e49b4`) fixed Skia Web resource lifecycle leaks: replaced pictures, paint/path/shader/filter handles, images, surfaces/contexts and registrations are disposed correctly; late unmount submissions cannot resurrect resources.
- Settled Garden unmount/logout reaches **0 images, 0 pictures, 0 deferred resources, 0 surfaces and 0 GPU cache**. Repeated logout/login cycles no longer continuously increase heap.
- Inactive Web Garden releases its GPU surface while retaining canonical Garden state; the verified texture-cache ceiling remains 384 MiB.

### Memory optimization
- Phase B (`3e60ef2`) losslessly cropped 17 full-world transparent runtime layers without changing visible artwork. Their decoded RGBA allocation fell from ~280.16 to ~6.11 MiB.
- Previous stable CanvasKit heap: ~647.125 MiB. Conservative optimized warmed budget: ~382.375 MiB — a **~40.9% reduction**.
- Later adaptive-quality validation observed ~318.6 MiB across five warmed logout/login cycles. Use **~382 MiB as the conservative planning budget** unless newer measurements supersede it; the smaller observation does not establish a universal budget.

### Adaptive rendering quality
- Commit `0156732`: quality affects **physical Web raster/backing resolution only**; logical Garden coordinates and composition remain unchanged. The Web renderer follows live DPR rather than capturing it only at module import. The original blur report was not reproduced; lossless crops were ruled out as a resolution loss.

| Mode | Backing/detail | Behavior |
|---|---|---|
| HIGH | ~2–3× | Reference/Jinyin-quality output; passed the 2× raster-equivalence/reference-detail check |
| BALANCED | ~1.5–2× | Visually close to HIGH; identical backing at the validated DPR-2 viewport |
| PERFORMANCE | ~1–1.25× | Visibly softer; intended for sustained constrained-load situations |
| AUTO | Starts BALANCED | Upgrades with sustained smooth headroom; downgrades with sustained slow frames |

- Web ceilings: HIGH/BALANCED/PERFORMANCE use 8/4/2 million backing pixels and a 4096-pixel maximum texture dimension; large viewports may therefore render below the nominal scale ranges. All tiers retain the same artwork, effects and sampling.
- AUTO uses local-only DPR/viewport pixels, optional core/device-memory hints and runtime frame/draw timing. Cooldown/hysteresis prevent rapid switching; no tier switch occurs during active gestures. On the 8 GB Mac, AUTO selected BALANCED in quieter conditions and PERFORMANCE under sustained load.
- Development-only URL override: `http://localhost:8107/?gardenQuality=AUTO` (replace AUTO with HIGH, BALANCED or PERFORMANCE). No hardware telemetry or production settings panel.
- Web raster/cache decisions do not apply to native iOS/Android, which retain upstream Canvas and original artwork.

### Important implementation rule
DPR, canvas backing resolution, CanvasKit cache, physical raster size and adaptive quality tier must never affect Garden coordinates, camera/world scale, bridges, paths, islands, flower positions, visible framing or HUD positions. Performance/render-quality logic must remain separate from product geometry.

### Current status
- **Jinyin visual parity: PASS. Original artwork: preserved. Resource leak: fixed. Adaptive quality: ready.**
- 8 GB Mac: materially improved, but still constrained by total development-environment memory; shared Colima/browser usage and system Memory Pressure are not Garden-only measurements. Lower raster quality does not guarantee 60 fps.
- Latest completed validation: 58 focused Garden/resource/artwork/quality checks, mobile typecheck, production Web export and source/export/staged privacy scans passed. Five warmed cycles reached zero resources after settled logout; pan/reversals retained artwork, all 25 backend flowers and HUD placement. Profiling hooks are excluded.
- Native iOS/Android performance still requires real-device verification. Genuine browser-hidden measurement also remains pending; suspend/resume behavior has focused fixture coverage.

## Latest Relevant Commits
- `f5e49b4` — Skia Web lifecycle/resource cleanup
- `3e60ef2` — steady-state Garden memory reduction
- `0156732` — adaptive Garden render quality
