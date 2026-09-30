# Frontend V1 integration review

Date: 2026-09-29 (America/Vancouver)

## Scope and branches

Production continues to serve `client/`; the user explicitly chose to retain `mobile/` as a separate prototype.

- Main baseline: `bd4697180871e96f8d277f4f413a9e3c064eff84` (local main, origin/main, personal/main).
- Frontend source: `origin/frontend-V1`, `280b6d759fd92bfadc82f6d7b57ceb7b84c75d4b`.
- Integration: `integration/frontend-v1`, based on current origin/main; normal merge, no rebase.
- Main worktree: `/Users/xingranma/Desktop/PetalPal_JX` (filesystem displays Petalpal_JX).
- Integration worktree: `/Users/xingranma/Desktop/PetalPal_JX-integration`.

## Merge and fixes

Five conflicts resolved: `.gitignore`, `client/src/Garden/GardenScene.jsx`, its test, `prisma/schema.prisma`, `server.js`. Combined ignore rules and Prisma relations; retained main's Event/AI imports, private/social garden serialization and emotion modifiers; added V1 Support state and tests. No unresolved conflicts.

The incoming Support helper returned raw Flower relations including Journal content to visitors. Visitor detail and Support responses now use main's social allowlist. Owner detail retains private Journal access. Broadcasts contain neither private content nor a different viewer's Support state. Garden responses retain viewer-specific Support state after privacy filtering. Preserved main's avatar size validation and safe error logging. Added privacy tests and enabled pgvector in the incoming PGlite test fixture so migrations run against current main.

## Findings

| Area | Status | Finding | Fix / remaining work |
|---|---|---|---|
| API | Integrated for live client | Existing same-origin paths are retained. Added authenticated GET /users/:userId/flowers/:flowerId; POST support returns authoritative count/state and is idempotent per viewer/flower/local day. | Preserved main validation; privacy allowlist applied. Prototype has only partial social API wiring. |
| Auth | Live client preserved; prototype incomplete | Live client obtains refreshed Firebase ID tokens and sends Bearer headers; session, login/logout and unauthorized handling remain. Prototype reads petalPalAccessToken, but configureFlowerSession has no app caller or login flow. | No backend auth redesign. Prototype needs an actual refreshed-token/session provider before promotion. |
| Event creation | Backend preserved; prototype not connected | POST /events retains inference, transaction/persistence and durable AiJob dispatch; EmotionLab uses it. Live daily bloom is the separate private-Journal flow. Prototype Journal lists SAMPLE_ENTRIES and plants locally. | No mock path introduced into live client or backend. Do not treat prototype planting as saved Event creation. |
| Emotion | Live semantics preserved | Product-18 selection and Primary redundancy rules remain in main helpers. Prototype moods such as Grateful/Contemplative are sample labels, not canonical Primary values. | Retained authoritative Primary and ordered 0–2 secondary output. Prototype requires canonical backend records before promotion. |
| Flower rendering | Live semantics preserved; prototype static | Main species stays Primary-selected; secondary #1 controls accent/default effect and #2 may supply effect. Kept existing client modifier tests. Prototype samples assign species explicitly and compositions have empty secondary arrays. | Combined main modifier rendering with V1 Support UI. Prototype needs adapters for backend species/modifiers. |
| Consent/privacy | Regression fixed | Incoming visitor flower detail included private Journal content. Main AI consent, owner-scoped Event memory and revocation protections remain. Social actions do not enqueue AI jobs. | Visitor detail/support/garden and broadcasts filter private relations/text; regression tests added. |
| RAG/Fairy | Backend real; V1 surface absent | Main EventMemory/BGE/pgvector and Fairy runtime remain. Live onboarding/progression APIs remain; no V1 memory-retrieval UI found. | Preserved backend. No invented retrieval API or Journal-memory ingestion. |
| Weekly Garden | V1 not implemented | Backend has durable weekly report trigger/read endpoints; no prototype weekly report API surface found. | Future UI integration using existing contract. |
| Monthly Bouquet | V1 not implemented | Prototype monthly growth is geometric garden expansion, not an AI Bouquet report. | Do not present geometric growth as backend memory/RAG output. |
| Monthly Reflection | V1 not implemented | No corresponding V1 API surface found. | No API invented. |
| Async states | Backend preserved; V1 AI UX absent | AiJob → Cloudflare Queue → private executor → runJob → EventMemory → BGE → pgvector remains. Social detail has loading/error/retry states; prototype has no Event job polling. | No synchronous AI completion assumption added. Pending/refetch/retry UI needed before V1 Event integration. |
| Environment | Scan passed | Prototype uses EXPO_PUBLIC_API_BASE_URL; live client uses VITE_API_BASE_URL and public Firebase config. No added private credentials or dataset files detected. | No .env copied; generated builds and dependencies excluded. |
| Routing/deployment | Live deployment preserved | Root build still builds client/dist, Express serves public assets/client output and SPA fallback. Prototype Expo web export builds separately and is not served by Render. | Kept client live per user decision. No production prototype/mock route enabled. |

## Files changed

Incoming merge includes 846 Resources files, 783 mobile files plus the added CSS declarations, 18 client files, 44 existing docs additions, implementation documentation, ignore rules, Support migration/schema, server/helper and tests. These are tracked source-branch assets, not local research files.

- Frontend: V1 `mobile/` app/assets/tests; `client/` flower Support/detail behavior, styling and public garden assets.
- Backend: `server.js`, `lib/flower-support.js`, `lib/garden-response.js`; Prisma Flower/VisitRecord relations and daily Support migration.
- Shared contracts: backend flower Support/detail response and viewer Support state; no new shared-contract package.
- Tests/config: client GardenScene tests, backend Support persistence/privacy and garden privacy tests, `mobile/src/css.d.ts`, combined `.gitignore`.

## Validation

- Client production build: PASS.
- Client ESLint: PASS.
- Client tests: 50/50 PASS.
- Focused backend run: 60/60 PASS (auth, Event, async dispatch/routes, emotion, flower, privacy/social and semantic retrieval).
- Follow-up backend run after final validation/logging changes: 22/22 PASS (Support persistence/privacy, garden responses and HTTP security inventory/matrix).
- Prisma schema validation and generation: PASS; server syntax: PASS.
- Expo web export: PASS. Native iOS/Android device builds not run.
- Prototype TypeScript: PASS after adding CSS module/import declarations.
- Prototype flower-detail tests: 20/20 PASS.
- Prototype mask refinement: 57/57 assertions PASS.
- Full prototype npm test: FAIL because output/planting-mask-checkpoints/20260928-approved/browser-planting-storage.json is absent from the published branch. It reaches the approved-mask checkpoint audit after earlier planting assertions. No checkpoint fabricated or test disabled.
- Prototype lint: unavailable in CI because eslint/eslint-config-expo are absent from its lockfile; The configured Expo lint command fails with Cannot find module eslint. No auto-install or lockfile rewrite performed.
- Existing incoming documentation/source has whitespace warnings; left unrelated formatting intact.
- Secret/privacy scan: exact staged text/diff reviewed; no added secrets, .env content, raw user Event/Journal data, reviewer/annotation datasets detected. Journal sample records and test fixtures are explicitly synthetic/sample data. This is a pattern/file review, not a guarantee about all historical commits or binary assets.
- graphify update unavailable: executable and integration graph absent. Main graph/research files untouched.
- No live production, real credentials, Cloudflare Queue, Render executor, or external BGE calls exercised. Focused tests exercise contracts with test doubles/disposable PGlite.

## Readiness

NEEDS INTEGRATION FIXES

The live client/backend merge passes focused checks. The separate prototype retains sample data and incomplete auth/Event/report wiring and its full test command depends on an unpublished checkpoint. Keep it separate until those gaps are resolved. This branch is for review; main was not merged or modified.
