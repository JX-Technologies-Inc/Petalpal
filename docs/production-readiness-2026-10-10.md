# Production readiness — 2026-10-10

**READY FOR PRODUCTION: NO.** Preparation only; nothing in this document authorizes
production access, deployment, migrations, credential operations, DNS or spending.

## Exact source and accepted evidence

- Audited protected main: `2df65c24fdc41310d6cb515bc18a6ecf36383268`.
  This is the integration-qualified application candidate, not an approved production artifact.
  The accompanying PR adds only production build validation, an inactive hosting
  profile, tests and these records. Pin its reviewed merge SHA before building production.
- Recorded production baseline: `1f8d0f98fb16b9553ae03c474f5952c808928e48`,
  `PetalPal_v2` / `srv-d983eguq1p3s73fnk1m0`, Live deploy
  `dep-db468kbbc2fs73ap2t70`. Owner confirms the old Vite site remains served.
  Exact current provider revision and retained rollback availability are not freshly certified.
- TEST Live backend: recorded `7813e440a1d60052f71fcc59203e599d51be928b`.
  Its server, lib, Prisma, Dockerfile.backend and package/lock files are identical
  to audited main. This permits reuse of its application runtime evidence.
- [Authenticated TEST E2E 38034475861](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38034475861)
  and [anonymous smoke 38033944589](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38033944589)
  PASS at audited main. Reviewed workflow/script scope: Firebase verified password
  identity, REST session/owner boundaries, exact preview-origin CORS and Socket
  polling/upgrade/direct WebSocket. No production qualification is inferred.
- [PR #25 security + Expo 38033831358](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38033831358)
  PASS at `5466726f173806420e8e49035fac403ad30ff538`; exact-main CodeQL PASS.
  Required main rules currently enforce PRs, both checks, no deletion/force push.
- [Integration artifact build 38027815484](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38027815484)
  PASS at `521f6b54ac1bbc34177c1db98bc3bf1696d74220`; mobile application, Worker,
  hosting helper and build script at that commit match audited main. Owner confirms
  protected Integration Garden visually PASS. Keep that artifact TEST-only.
- [Backend container 38006087561](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38006087561)
  PASS is historical packaging/synthetic runtime evidence. Recorded BuildKit peak
  2,951,217,152 bytes (~2.75 GiB) excludes host Docker daemon and is not application
  runtime RAM or an exact-final-image measurement. No accepted suite was repeated.

## Compatibility and preservation contracts

| Area | Finding / release requirement |
| --- | --- |
| Database | `git diff` confirms schema, all 25 SQL migrations, lock and Prisma config identical to recorded production. Reuse accepted October 6 upgrade/postcheck and October 8 25-complete/no-pending evidence. No new migration is required by this candidate. Live drift remains unknown; no production query performed. |
| Startup | `npm start` still executes `prisma migrate deploy` before `node server.js`. It is NOT a read-only readiness check. Never invoke it against production during preparation. For a no-migration rollout, approve `node server.js` explicitly after the existing schema evidence is accepted; otherwise startup migration side effects require separate authorization. Never use the TEST startup script/marker in production. |
| Existing identities | Keep Firebase project `petalpal-b212c`, its existing Web App and production Admin binding, and the same PostgreSQL primary. Firebase UID mapping and legacy verified-email linking are unchanged. Do not export/import users or copy TEST data. A new web origin requires sign-in again; do not transfer tokens or browser storage between domains. Unsaved drafts/local-only placement state do not migrate automatically. |
| Login methods | Both shipped login UIs use password login plus verification. Vite contains unused Google/email-link helpers, but its LoginForm deliberately hides them; these are not newly promised features. Keep old verification/return URLs working during transition. If actual historical provider-only users need another flow, resolve it before retiring Vite using human/provider metadata, not user-row inspection. |
| REST | Same bearer-token protocol and owner checks. New Journal reader explicitly accepts the old complete-array response; new backend keeps that response when pagination is absent. Old backend can support the first Cloudflare frontend stage, subject to production-origin acceptance. No API proxy is needed. |
| Socket.IO | Direct Render `/socket.io/`, polling, upgrade and direct WebSocket; token auth unchanged. New backend adds origin admission. Preserve old web/native origins and Render's own origin while adding only the chosen Cloudflare origin. Keep one active backend topology: in-memory rooms, revocation and rate limits are not shared across a new fleet. |
| AI | AI modules and `cloudflare-worker` sources match recorded production. Retain existing production `cloudflare_queue`, dispatcher/executor/reconciler URLs, credentials, consent, cost budgets and shared DB ledger. TEST intentionally uses manual mode/zero budgets: TEST PASS does not certify AI inference, reports, speech, production quotas or queue operation. No backfill/model change/extra executor is part of this release. |
| Frontend build | Production build now rejects TEST/mixed project, auth-domain, Web App, malformed key and conflicting API-origin input before export. Fixed production API remains `https://petalpal-v2.onrender.com`. Key syntax cannot prove key ownership/restrictions; human binding attestation remains necessary. |
| Cloudflare | `wrangler.production.jsonc` names only `petalpal-web-production`; URLs/previews/routes are disabled, no credentials. Default CSP matches the fixed production API/Firebase domain. Never use the integration deploy workflow, integration artifact or synthetic fixture for production. |
| Feature coverage | Garden rendering + transport/auth PASS is not all-feature acceptance. Explicitly accept Journal history/create/cover, Daily Grow/Events/flowers, Fairy, Friends/visits/messages/privacy, Reflection/reports, speech, settings/consent/logout/account deletion and supported browsers. Use approved synthetic identities; destructive and paid actions need their own bounded authorization. Existing placeholders/incomplete product features are not upgraded to PASS. |

## Memory and release topology

Root `Dockerfile` now builds Expo, not Vite; prior >8 GB build OOM is owner-reported.
Do not rebuild it on production Render. `Dockerfile.backend` excludes both frontend
builds but also excludes `client/dist`: switching the existing service to it now
would remove the old website and produce 500 on web-shell routes. `/` is therefore
not a backend-only HTTP health endpoint. The current header comment that the root
Dockerfile preserves the existing frontend is inaccurate for Vite and must not guide rollout.

Recommended first stage: new Cloudflare frontend against the unchanged production
API, retaining the old Vite site and every existing API/AI endpoint. This needs no
second production backend or new paid resource. It separates frontend acceptance
from the higher-risk backend packaging change.

After frontend acceptance, update the existing backend at the same origin using
an externally built, immutable transition image: candidate backend plus the exact
retained production Vite `client/dist`, assembled with `Dockerfile.transition`.
This is a proposed later option requiring explicit approval, not a revival of the
superseded pre-integration transition authorization. First recover/verify the old
frontend artifact and supported Render delivery mechanism. No artifact is available
from this audit; no image was built/published. If those prerequisites are unavailable,
leave the old service in place. Do not substitute Expo/synthetic assets into this
rollback layer or guess that Git-backed Render can switch to image-backed in place.

A parallel production backend is not recommended as the default: it adds capacity,
DB connection and process-local Socket/rate-limit concerns, and would require a
new reviewed API build/CSP contract plus AI executor routing. Never repurpose TEST.
Backend-only removal of Vite is optional and last, after old-origin traffic and
rollback retention have a separately approved disposition.

Capacity gate: distinguish build RAM from runtime RSS. Require headroom at startup,
model load, concurrent API/Socket and bounded speech/AI operation on the chosen
plan, with no OOM/restart/pool exhaustion. Existing TEST Free liveness cannot prove
production concurrency capacity. Do not upgrade plans automatically. Preserve
single-instance assumptions; a permanent multi-instance deployment needs separate
Socket/shared-rate-limit work. Brief deploy overlap/reconnect is a release risk.

## Ordered rollout — future authorization only

1. Finish credential retirement and confirm production configuration/rollback gates
   below. Retain Auto-Deploy OFF. Freeze reviewed SHA and provider metadata; confirm
   backup retention and restore owner without reading/exporting user data.
2. After required PR checks/normal merge, use `cloudflare-web-build.yml` with only
   `production_config=true`, on the pinned merged SHA. Human populates the protected
   production build environment with the existing public Web SDK settings. No Admin
   credential enters frontend CI. Retain exact source, build run and artifact ID
   beyond the workflow's seven-day expiry; verify no TEST/fixture bindings.
3. Separately approve creating/uploading only the production web Worker, initially
   unexposed. Verify name availability and owner-only Access for every candidate
   hostname/path before enabling it. Keep version URLs and custom routes disabled.
   Upload the approved static artifact once; record version/deployment IDs. Do not
   run the TEST deploy automation or touch AI/company-site Workers.
4. Approve the exact production backend CORS addition and verify `TRUST_PROXY`.
   Preserve all current origins. A Render environment save can trigger a deploy:
   use a mechanism pinned to the current Live revision/image, never main/root
   Dockerfile/latest. Keep Firebase auth domain unchanged. Password login does not
   require adding a new Firebase Authorized Domain; OAuth or custom action-link
   changes would need a separately verified domain/configuration gate.
5. With a separately authorized production synthetic identity, accept the protected
   frontend against the current API and feature matrix below. Old Vite remains
   available. Do not claim production auth/feature PASS before this stage.
6. Approve final hostname (proposal `app.jastrevia.com`), DNS/TLS and only that
   Worker's public routing/Access transition. Do not route the company apex or
   redirect the Render API. Activate one complete version at 100%, avoiding random
   mixing of HTML/assets. Keep Vite available as the user fallback; no permanent
   redirects or old-domain retirement yet. New-origin users sign in normally.
7. Once frontend acceptance and observation pass, separately approve the compatible
   backend transition image/delivery, no-migration startup and rollback described
   above. Keep API origin and all AI Worker destinations unchanged. Validate old
   Vite and Cloudflare callers during acceptance. Retain Vite through the agreed
   rollback window (recommend at least seven days, with 24 hours stable acceptance).
8. Retire old frontend paths only in a later approved release after link/session/
   unsaved-work handling is accepted. No DB deletion, reset, copying, migration or
   credential rollback is a cleanup step.

## Health checks, go/no-go and rollback

- Public web: `/`, `/bookhouse`, `/reflection`, `/visit/<synthetic-id>` GET/HEAD
  load; actual JS/PNG and CanvasKit WASM load with correct MIME. HTML/error/private
  responses no-store; unauthorized API paths on the static Worker remain 404/405.
  Protected candidate must deny anonymous HTML AND assets before public activation.
- API synthetic probes: anonymous `/session?view=metadata` and invalid bearer 401
  with no-store; exact-origin preflight 204 and denied origin 403. These are auth
  boundary checks, not database readiness. Render HTTP health checks require 2xx/3xx;
  neither a 401 route nor backend-only `/` is suitable. Preserve existing TCP health
  until a separately reviewed readiness endpoint/configuration is available.
- Authenticated acceptance: approved identity retains the same UID-to-profile mapping,
  session 200, own Journal 200/other-owner denied, existing history complete; logout
  clears private UI/cache. Socket join, polling-to-WS, direct WS, refreshed-token
  reconnect and denied token/origin all pass. Never record token/user content.
- Product/AI: human records only PASS/FAIL for the feature matrix, expected no-consent/
  budget refusals and existing Queue/report processing. TEST zero-budget behavior
  cannot replace production AI configuration and bounded authorized acceptance.
- GO only with exact production artifact, all configuration/credential gates,
  rollback target availability, whole-feature acceptance and capacity evidence.
  Stop for wrong project/DB/API, any isolation leak, missing history, auth failure,
  broken core flow, OOM/restarts, repeated 5xx or queue/DB saturation. First 30 minutes
  of observation plus 24 hours stable use precede declaring completed cutover;
  these are proposed release criteria, not measurements or a monitoring automation.
- Frontend failure before public cutover: keep candidate unexposed; old site is
  unchanged. After cutover: activate the previous known-good production Worker
  version at 100%. On the first deployment there is NO previous web version: use
  the retained Vite URL as fallback and restore the recorded prior DNS/route only
  if that hostname previously served the old site. For a brand-new hostname, an
  approved temporary GET/HEAD redirect to the Vite site must be prepared/tested
  before opening traffic; never redirect API/Socket requests. Until available,
  first-launch same-URL rollback is an open gate, not guaranteed readiness.
- Backend failure: owner selects the recorded prior successful Render deployment
  (currently recorded `dep-db468kbbc2fs73ap2t70`, SHA `1f8d0f98...`) through Rollback,
  not Deploy latest commit. Confirm availability at approval time. Preserve the
  working replacement credentials and added compatible origins; reconcile current
  environment separately because code rollback is not a general configuration
  rollback. Verify web, synthetic session boundary and Socket reconnect afterward.
- Data rollback: none for this unchanged schema. Never restore an old DB snapshot
  merely to roll back code: that could discard writes since cutover. A backup
  restore is incident recovery with separate authorization/RPO decision. Preserve
  Firebase accounts, DB primary, AuditEvent/AiJob data and consent state throughout.
- Rollback readiness is **PARTIAL**: source compatibility proved; provider retained
  image/version, first-launch fallback, Vite artifact recovery and backup restoration
  capability have not been operationally validated. Do not promise zero downtime.

## Only essential human gates

1. Secret-free confirmation of exposed Firebase Admin key retirement and historical
   DB credential revocation; preserve the working replacement. Historical trace
   retention/misuse remains unknown; do not reread incident traces.
2. Confirm production Web App/Admin/DB/AI bindings, exact current Live/rollback
   metadata, proxy/origins, backup recoverability and capacity/plan. Accept existing
   unchanged-schema evidence; if contradictory evidence arises, stop for a separately
   scoped investigation. No new production query is requested by this audit.
3. Approve hostname/Access-to-public routing and the exact release artifacts,
   delivery/rollback sequence plus narrowly scoped acceptance identities/actions.
   No paid resources, migration, credential action or backend deletion is implied.

Provider references checked during audit: [Render deploys](https://render.com/docs/deploys),
[Render rollbacks](https://render.com/docs/rollbacks),
[Render health checks](https://render.com/docs/health-checks),
[Cloudflare version rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/),
[Firebase persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence).
