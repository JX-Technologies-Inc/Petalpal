# PetalPal Mobile Backend Integration

## Visual Baseline
- Jinyin UI safe baseline: `d26700d08b22ec264622c646671b16c9488f7bc2`.
- Garden presentation frozen; Garden components, root screen, bootstrap, HUD and existing navigation are unchanged from the safe version.
- Local and origin `backup/jinyin-ui-before-motion` and peeled `jinyin-ui-safe-v1` still resolve to the safe commit.

## Branch
- `integration/mobile-backend-test`; base: `d26700d08b22ec264622c646671b16c9488f7bc2`.
- Push to origin only. Keep main and `integration/frontend-v1` history intact.

## Working Backend Features
REAL = connected and testable; PREVIEW = existing backend but incomplete mobile workflow; COMING SOON = backend/product not ready; MISSING BACKEND CONTRACT = required behavior lacks a safe public contract. These are integration capabilities, not live health checks. Frozen HUD badges retain their safe-version labels.

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
- Production guard disables QA requests; browser verification of the production export returns to Garden without displaying QA. Existing `/journal`, `/garden-history` and `/feature/*` temporary screens remain unchanged.
- Local frontend: `http://localhost:8107/`; QA: `http://localhost:8107/dev/backend-qa`; API: `http://localhost:3107`. Backend database is localhost `petalpal_dev`.

- Validation: 150 focused Auth/Event/Garden/flower-detail/QA tests passed; mobile typecheck and web export passed. Browser comparison of clean d267 and this branch at 319 × 664 preserved framing/HUD/artwork; Garden/root/bootstrap have zero diff from d267.
- Live local flow: A Event save/read → Primary preserved and backend Secondary returned → Garden/reload; A logout → disposable B registration/verification/profile → zero B flowers/Events after reload → B logout → A data restored. B's request for A's private Event returned 404; public Garden stripped private source metadata. Placement/cache account switching and late responses passed focused tests.
- Synthetic Event/flower removed through the existing owner-scoped repository deletion path; original flower preserved. A has no historical/Daily flowers in the current dataset, so historical retention/rendering is validated by focused fixtures rather than a live historical sample.
- The single disposable B account and local profile were safely removed using the existing E2E cleanup helpers after exact email/UID and zero-content/relationship checks; original A data remained intact. Temporary credentials were kept mode-600 in the gitignored E2E env file, then removed after cleanup. Registration recovered from a transient connection error without creating another account. No production user was modified.
- Expo dev server uses CI mode: restart after source changes.

## Remaining Backend/Mobile Integration
- Daily input/onboarding; profile/avatar and consent mutations; friend requests/lifecycle and visits.
- General realtime invalidation; Fairy/Memory workflow; report discovery and Monthly generation contract.
- Cross-device Expo placement writes remain unapproved; fallback layouts remain device-local previews.

## Rules
- Jinyin UI frozen; no Garden performance refactor, canvas/DPR/camera/Skia/cache/animation changes.
- React is a behavior reference only; backend identity, privacy, consent, emotion and canonical flowers are authoritative.
- Temporary plain screens are allowed; services → controller/hook → screen. No fake backend actions.
- Local development tests only; credentials stay in gitignored local files. No production deployment, main merge, personal push, history rewrite or safe-ref modification.

## Next Feature
Daily Check-in: connect the existing owner-scoped submission/onboarding contract to a minimal separate screen. Do not implement in this run.
