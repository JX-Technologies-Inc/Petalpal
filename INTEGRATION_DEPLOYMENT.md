# PetalPal — Deployment & Integration SOP

**Status:** Canonical working procedure for branch integration and **private** deployments.

**Last reconciled:** 2026-10-11 (America/Vancouver). **Repository:** `JX-Technologies-Inc/Petalpal`.

**Scope:** Web (Cloudflare Workers), API (Render), Prisma Postgres, Firebase, and isolated integration.

**Safety:** This document is **not** permission to merge, deploy, migrate, change credentials, alter DNS/Access, or launch publicly.

> **Fast-path rule:** Identify the branch and deployed baseline → classify the diff → run only relevant tests → prepare one pinned release → obtain one approval covering the explicitly scoped actions → deploy only the affected component → verify it → record the result. **No unrelated changes, no repeat audits, no blind retries.**
>
> **Reality check:** A playbook reduces avoidable errors; it cannot guarantee a zero-defect deployment. On missing critical evidence, fail closed and ask for the **single smallest** unavoidable decision, not a new project-wide investigation.

## 0. Fast start — what the operator and agent do

**When a teammate pushes a branch:** Give Codex the branch/PR name and say: *“Follow `INTEGRATION_DEPLOYMENT.md`. Compare it with current `main`, integrate only the still-missing changes in an isolated worktree, run the impact-based tests, and prepare a PR. Do not deploy or merge without approval.”*

**When the owner asks to publish:** Give the reviewed PR/merged SHA and say: *“Follow `INTEGRATION_DEPLOYMENT.md`. Deploy only the affected component from this exact SHA; reuse existing CI artifacts when valid; stop at the required approval; then verify the live outcome. Do not repeat unchanged infrastructure checks.”*

**Do not start with a full audit.** First consult the latest release record, `WARNING.md`, relevant current code/workflows, and the **actual deployed** version; otherwise inspect only the new change. Keep a short report, not a new runbook.

### Decide the release lane immediately

| Change detected | What to do | What **not** to deploy |
|---|---|---|
| Docs / comments only | PR + docs checks; **no release** | Cloudflare / Render / DB |
| Expo Web/UI/assets/CSP/voice browser code | Cloudflare Web lane (§4) | Render / Prisma |
| API, Socket.IO, backend auth/security, server code | Render API lane (§5) | Cloudflare unless the public API contract requires it |
| Mobile-only/native behavior | Mobile QA/release separately; iPhone checks only when relevant | Cloudflare / Render unless dependency requires them |
| Prisma migrations/schema or database contract | Explicit database lane (§6) before compatible API release | Any implicit `npm start` migration |
| Provider env, secrets, Firebase project, DNS, Access, domains | Separate **high-risk configuration** change (§7) | Routine feature release bundling |
| Cross-layer breaking change | Coordinated release with explicit backward compatibility/order | Independent uncoordinated deploys |
| No net change against target | **Stop; nothing to merge or deploy** | Everything |

## 1. Environment map (source configuration and recorded operator evidence; not a fresh provider audit)

| Layer | **Production** | **Integration / TEST** |
|---|---|---|
| User-facing Web | `https://app.jastrevia.com` | Separate private integration Worker; **not** the production URL |
| Cloudflare Worker | `petalpal-web-production` | `petalpal-web-integration` |
| Web → API origin | `https://petalpal-v2.onrender.com` | `https://petalpal-backend-test.onrender.com` |
| Render service | `PetalPal_v2`, ID `srv-d983eguq1p3s73fnk1m0` | `petalpal-backend-test` |
| Persistent business storage | **Prisma Postgres** through production Render `DATABASE_URL`; app uses Prisma ORM | A separately provisioned **Prisma Postgres** resource, historically named `petalpal_integration` |
| Firebase | Production project `petalpal-b212c` | Separate project `petalpal-integration-test` |
| Protected access | Worker-level Cloudflare Access, private reviewer-only | Worker-level Access; preserve its own test-only guardrails |
| CORS | Exact allowed-origin list includes `https://app.jastrevia.com` and previously allowed Render origin | Test origins only; never add production origin to TEST |
| Startup | Owner-confirmed saved Docker Command `node server.js`, Pre-Deploy blank; Auto-Deploy off independently observed in the preceding read-only release review | `/bin/sh /app/scripts/start-integration-backend.sh`, `WORKDIR /app`; guard before `npm start` (confirm deployed version) |

**Important distinctions:** Render hosts the Node/Express API; it is **not** the Prisma Postgres database provider. Browser API calls normally go directly to the Render origin; the Cloudflare Worker serves the web shell/static assets and enforces web response policy. **Cloudflare Access protects the Web entry, not the direct public Render API**: the backend must independently enforce Firebase token checks, owner-scoped authorization, CORS/Socket origins and rate limits. Frontend success alone does **not** prove API access or database persistence. The two Prisma connection strings may both display `db.prisma.io:5432/postgres`; hostname/path **cannot prove resource identity**.

**Recorded checkpoint, not a permanent live assertion:**

- **Web-only follow-ups, 2026-10-18 UTC (current Web state):** four mobile-only releases, no API/DB change, each with `production_config` (artifact name `expo-web-production-<sha>`), first-attempt runs only, all success. PR #87 (`65d2e568e3ed7be1b3d5183288274e6e07a32179`, canvas sizing with existing sign-in, loading screen, lossless WebP terrain, keep-warm source): build [39098659621](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39098659621) artifact `12125523577` `sha256:378cf27b4a7c4c72b88305c3a5fa062de5deafef3daab5337ea791756efa12f7`; upload [39099000288](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39099000288) version `22bd6cef-e65f-441c-a893-48c33e03de5d`; activation [39099184698](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39099184698) at 100%. PR #88 (`eed01e3e0de158c281a31140ad6966c9c208699f`, load progress/failure reasons, 30 s overlay cap): build [39101141372](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39101141372) artifact `12125679554` `sha256:7f8e17e602a37bd5721204f26ba6ad7ae6e76ea275bc5d358e11bc1707564bbf`; upload [39101382370](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39101382370) version `b1e71d18-3957-456d-8339-2498aa177255`; activation [39101685512](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39101685512) at 100%. PR #89 (`a10a5f54dfd2a785d1affe63c29e27553d024455`, iOS Safari `Symbol.dispose` polyfill before Skia loads): build [39103290224](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39103290224) artifact `12126902989` `sha256:f1a2e273b794e2ffbf8ee027887ddfb895109259d846b3851ba681f3d8f16bb6`; upload [39105003328](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39105003328) version `125ea877-7b6a-43c9-a650-ca2147be9c2e`; activation [39105194429](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39105194429) at 100%. PR #90 (`3bf7652796167c0ab31c365c882623a60f9047d9`, camera always covers the screen, partner water material): build [39107499325](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39107499325) artifact `12129112068` `sha256:3c15e3a241168231122d87c6c0761027b78f68e9ad717569a2d195562b9287b6`; upload [39107842561](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39107842561) version `417ca56c-3af3-42d7-b4f2-bbf094ff0cd0`; activation [39108016713](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39108016713) at 100%. `app.jastrevia.com` still returns 302 to Cloudflare Access (rechecked 2026-10-18). Owner reported on 2026-10-18 that the #90 Garden (full-screen camera, water material, dragging) works on their phone; this is an owner report, not measured FPS/thermal evidence. Keep-warm: the owner reports deploying Worker `petalpal-keepwarm` from `deploy/cloudflare-keepwarm` with wrangler (cron `*/10 0-7,14-23 * * *` UTC, anonymous GET of the production `/healthz`, expected 401); its schedule and runs are **not independently verified**. Policy URLs are still unset in the build. Recovery remains forward-fix only.
- **Web-only follow-up, 2026-10-17:** PR #85 (`e7c01f5c54a2c4cbca9ea5c1cac8a03b13f2b53c`, compact sign-in privacy/terms links; mobile-only change, no API/DB change). An accidental `integration_config` build (run 39090260145) was discarded; production build run [39090928732](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39090928732) artifact `12123021484` `sha256:e939be3160eaf4efff5a7fb95a27d0f7d4d7030688bed2450d3e34e17ee6c43f`; upload [39093088415](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39093088415) version `f05b918a-47e0-45c6-ac8f-3703ba19766c`; activation [39093277336](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39093277336) at 100%. Access redirect still enforced. Policy URLs (`EXPO_PUBLIC_PRIVACY_POLICY_URL`/`TERMS_URL`/`DELETION_URL`) are not yet set in the build, so the links show the awaiting-publication notice.
- **Coordinated production release, 2026-10-17 (supersedes the Web/Render checkpoints below for current state):** source `c9bb959d3717d081e5eddb0aa9dea35c702ea337` (PR #84 merge). Owner-run manual `pg_dump` backups before and after suspending `PetalPal_v2` (28 table-data entries each, stored owner-only off-repo). `PetalPal_v2` suspended; migrations `202610150001`–`202610150005` applied once from a clean checkout at that SHA over the **direct** (non-pooled) host; trigger `User_deleted_identity_guard` and constraint `AiConsent_disclosure_grant_guard` verified present. Render could not deploy while suspended, so the service was resumed (old `0b44ac7` briefly ran against the migrated schema) and the first `c9bb959d` build with root `./Dockerfile` failed (build OOM >8 GB in the Expo export stage). **Render Dockerfile Path changed to `./Dockerfile.backend`** (owner, provider setting); Docker Command remains `node server.js`, Pre-Deploy blank, Auto-Deploy off. That build went Live at `c9bb959d`; `petalpal-v2.onrender.com/` now returns 500 by design (no bundled web shell; Web is Cloudflare). Anonymous postflight PASS: auth-denied 401, forged token 401, CORS allow `app.jastrevia.com` / deny other origin 403, Socket.IO polling foreign origin 403 (Engine.IO `allowRequest` P2 now deployed), HSTS/CSP/nosniff/DENY/no-store present. Web: build run [39087830834](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39087830834) artifact `12121671877` `sha256:234100ce770d53dffc9d1140d88a1c16acf695bd177e2c21ea54124cf91080f7`; upload [39088132413](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39088132413) version `9437bf24-428a-40e6-ab70-1ec6929470b6`; activation [39088338347](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/39088338347) at 100%. `app.jastrevia.com` still redirects to Cloudflare Access. Production `AI_ASYNC_EXECUTION_MODE=cloudflare_queue` (pre-existing); Gateway calls require explicit USD limit variables and fail closed without them. Authenticated functional acceptance is **NOT VERIFIED**. Recovery: no Render Rollback and no previous Web version (incompatible with the migrated schema/new API); forward-fix only.
- Web: PR #32 CSP/voice fix; production source `738b7e968d7eabc7ff69afd82722ab85f4b820bf`; build/upload/activation runs `38190197395`, `38193423470`, `38193789359` are independently confirmed completed/success at that SHA through GitHub metadata; the supplied checkpoint reports Worker version `fe0b6405-6ed0-46ae-9c61-0667ed8b4f4d` at 100%. **Live transcription acceptance is not established by these run statuses**. Verified run metadata: [build](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38190197395), [upload](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38193423470), [activation](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38193789359). Version/allocation and current provider Access/domain configuration are recorded/owner-reported, not freshly verified by this SOP review.
- Render: last reported Live `dep-db6mdjid0e5s73as3l8g` (2026-10-12, owner-reported), source `0b44ac74baa9f433a3dc11e4d3e0a6aa1715ccb3` from release branch `release/render-voice-blob-csp-49ea26a`: previous Live source `49ea26a6bd9867d5b2c65ca56b4d3e917c5d24a3` (`dep-db62bi2jnfac73c5oieg`) plus only Render CSP `connect-src blob:`, so §5 notes about `49ea26a6` still apply. **Not** necessarily `main`. The owner reports an earlier configuration-only change built a different source from the originally intended `1f8d0f98`; never rely on an assumed “existing build” without verifying the actual deployment.
- Current `main` when last checked: `738b7e968d7eabc7ff69afd82722ab85f4b820bf`. Check it again, as teammates may push or merge.
- Historical first-launch redirect **fallback** Worker version `e7947f5a-9eca-4fb1-b830-05e956a2cd7d`; **not** a substitute for a known-good full application rollback or for database/config restoration. Confirm availability before relying on it.
- Owner-supplied limited Journal evidence (not re-inspected here): synthetic `JP-01` reportedly existed in the operator-selected original Prisma resource and did **not** exist in checked `petalpal_integration`; that report supports only that record’s location among those two checked resources, **not** the exact live Render binding or universal isolation. Never repeat the write merely to re-prove it.

## 2. Hard constraints, source of truth and approval boundaries

1. **No unauthorized changes:** A branch push, a green test, a successful upload, approval for a different scope, or this SOP **never by itself** authorizes a new merge, production deploy, rollback, migration, provider change, secret change, DB write, or public launch.
   Existing explicit authorization remains valid for the same actions and scope; do not ask again at each step. One consolidated request may list the exact merge/build/upload/activation actions, while mandatory GitHub environment reviewer gates still apply separately. A new target, migration, config change, retry or public exposure needs its own authorization. Local inspection, documentation, code preparation and isolated synthetic tests may proceed within the requested scope. Publishing a branch or PR must be within the user-authorized scope.
2. **Provenance before action:** Record target service, exact full source SHA, current deployed SHA/version, workflow/build or artifact ID and digest, config changes, tested diff and approved scope. **GitHub `main` ≠ Render Live ≠ Cloudflare active Worker**.
3. **Environment separation:** Production Render/Firebase/Prisma/AI secrets never enter integration. Verify integration environment flags, test Firebase ID, database marker and separate DB identity before hosted writes. **Never bypass the marker** with plain `node server.js` in TEST. TEST uses `PETALPAL_ENVIRONMENT=integration`, `NODE_ENV=production`, its own `DATABASE_URL` and explicit non-production Firebase service-account binding; production leaves `PETALPAL_ENVIRONMENT` unset (the guard does not accept a `production` value). TEST AI execution remains `manual`, all three daily call limits `0`, with production AI/job credential routes absent.
4. **Secrets stay secret:** Follow `WARNING.md`. Never open secret-bearing provider pages via automation; never copy `.env`, `DATABASE_URL`, tokens, cookies, request headers, user records, raw SQL data, credentials or private screenshots into prompts, console output, commits, CI, artifacts or logs. Use nonsecret statuses/IDs only. Do not copy production credentials to local fixtures.
5. **Database migrations are a separate release:** `package.json` currently defines `npm start` as `npx prisma migrate deploy && node server.js`, while the owner-confirmed Render saved override is `node server.js`. Do not silently switch back to `npm start`, use a Docker default that executes migrations, or run schema changes automatically. A future intentional migration needs separate approval and trusted runner.
6. **Preserve security + UX:** Never weaken Cloudflare Access, authentication, owner scoping, AI consent, Socket.IO authorization, HTTP/CSP policy, or response caching. For Garden/Fairy preserve native/web image quality, DPR/FPS, animation/interaction, input latency and cached static rendering. No “fix” by silently downgrading fidelity.
7. **No blind retries:** An ambiguous save, deployment or migration is **not** automatically retried. Before any rollback/recovery, confirm exact effect, blast radius, artifact/source, **saved-vs-live configuration** and startup override. Do not assume Render’s ordinary Rollback restores a safe startup configuration.
8. **Stop on unauthorized scope drift:** Unexpected Docker rebuild, wrong SHA, CI artifact mismatch, changed database/Firebase binding, route/domain/Access change, unknown migration or unexpected production data write are stop conditions. Read-only diagnostics are allowed; mutating remediation needs approval.
9. **Evidence with boundaries:** Local PASS ≠ hosted TEST PASS ≠ private production PASS ≠ public launch. Do not mark unobserved tests successful. Earlier accepted checks are reusable **only for the same relevant source/config/environment** (byte-equivalent relevant inputs may support reuse across documentation-only SHA changes); record a delta rather than rerunning full suites.
10. **Documentation minimalism:** For material security changes inspect and update `SECURITY.md`. Update `MANUAL_SECURITY_CHECKLIST.md` **only** for genuine new provider/manual actions or status changes. Preserve historical/superseded entries and avoid unrelated edits to `MOBILE.md`, README or other files.

**GitHub branch-protection reality (historical evidence, no new ruleset audit here):** Do not assume the `main` ruleset enforces required reviews/checks merely because a ruleset exists; previous repository evidence flagged ineffective branch conditions. Verify enforcement before relying on it, and require an explicit owner review even if GitHub allows an unreviewed merge. GitHub environment reviewer gates protect release jobs, **not** necessarily the merge itself.

**Precedence on conflict:** System/developer instructions and the user's explicit authorized scope govern the task; `WARNING.md` takes precedence over this SOP for privacy and credential safety. Required provider controls must be respected. Current verified code/workflows establish what is executable; this SOP supersedes conflicting historical runbook assumptions and does not override security rules. If documented instructions do not match the live implementation, **stop the affected action**, fix this playbook as a reviewed documentation change, and do not silently improvise.

## 3. Safe teammate-branch integration — no release implied

**Goal:** Bring only the teammate’s genuinely new work into an integration PR without destroying local or remote work.

### 3.1 One read-only snapshot (do not repeat when unchanged)

- Resolve exact repo, branch/PR, source SHA, destination `main` SHA; note PR merge status and whether commits or equivalent changes are already present. A GitHub branch can remain after merge. Check current worktree state and untracked files **before** any operation.
- Use a **separate `git worktree` or clean clone** based on reviewed `origin/main`; do **not** mutate a dirty developer workspace. Never `reset --hard`, `git clean -fd`, force-push, overwrite assets or delete containers. Preserve ignored `.env` and local Docker/Colima resources.
- Compare merge-base and **both directions** of commit and code delta; a branch 200 commits behind main is not 200 new changes. Detect cherry-picked/equivalent patches.

Repository inspection example (`git fetch` updates local metadata, not GitHub branches; replace literal branch name; do not paste untrusted branch names into shell commands unsafely):

```bash
git status --short --branch
git fetch origin
git rev-parse origin/main
git merge-base origin/main "origin/<branch>"
git log --left-right --cherry-mark --oneline origin/main..."origin/<branch>"
git diff --name-status origin/main..."origin/<branch>"
git diff --stat origin/main..."origin/<branch>"
git diff --name-status origin/main "origin/<branch>"
```

`--cherry-mark` helps identify equivalent commit patches; the three-dot diff shows branch work since the merge-base, while the final two-tip diff also reveals newer target changes that must be preserved. Review behavior when patch equivalence is inconclusive. Fetch only the needed refs where practical; do not prune or delete branches as part of routine preparation. Snapshot once per source SHA; refresh only if a branch actually moved.

### 3.2 Integration steps

1. First read root `WARNING.md`, this SOP and applicable `AGENTS.md` instructions. Classify changed files and dependency direction: native only, Expo Web, Garden/Fairy, backend, database, security, deploy/CI or docs. Produce a 5-line **change impact summary**, not a 30-page audit.
2. Choose the **smallest safe integration method**: current PR to `main` when it is current/clean; otherwise make a new integration branch from `main` and carefully cherry-pick/reimplement reviewed changes. Do not wholesale merge old branches or bring back superseded code.
3. Preserve both contributors’ intended changes; resolve conflict **by behavior**, not line count. Never accept an entire old file wholesale when the new main includes unrelated fixes. Flag unreviewed decisions instead of inventing functionality.
4. Run **impact-based tests once** (§3.4). Add regression tests only for genuine behavior changes. Check lockfile changes and generated/binary assets by intent.
5. Review final diff **against main**, including unexpected environment, secret, database, visual-quality and auth changes. If only docs changed, stop before deployment.
6. Prepare one PR, publishing it only within authorized scope, with exact source/target SHA, delta, test results, migration impact, deployment lane, rollback impact and remaining warnings. **Do not merge** until authorized and required CI/review checks pass. CI passing is not permission to deploy.

### 3.3 Existing isolated integration lane

Pre-merge feature branches use local synthetic tests and applicable PR CI. The current Cloudflare integration deploy gate requires an artifact from a successful `main` build; it is not a branch-preview deploy tool. Do not bypass its main/source/content guards to test an unmerged branch.

After an authorized merge, reuse a matching successful integration artifact or dispatch `.github/workflows/cloudflare-web-build.yml` with `integration_config=true`, `production_config=false` at the intended main SHA. The protected environment is `petalpal-web-build-integration`; record the actual run source, artifact ID/digest and expiry. The source/export guard pins TEST Firebase and API identifiers. With explicitly authorized hosted testing, use `.github/workflows/cloudflare-integration-deploy.yml`, environment `petalpal-web-integration-deploy`, exact artifact inputs and phases `deploy` then `activate`. `deploy` uploads and deploys the TEST Worker with hostnames disabled; `activate` verifies that exact artifact, enables its workers.dev host only behind existing Worker-level Access, and disables it again if cookie-free protection checks fail. Production stays untouched; do not recreate Access or re-provision resources as a routine step.

Use `.github/workflows/test-backend-smoke.yml` for bounded anonymous TEST checks and `.github/workflows/integration-e2e.yml` for TEST Firebase sign-in, owner boundaries, CORS and real Socket transports only when relevant source/config changed. The E2E workflow requires main, the integration build environment and an existing verified TEST identity/profile; it uses `deferProfileCreation` and creates no app records. It is not production functional/AI acceptance. The separate `.github/workflows/integration-test-identity.yml` provisions TEST identity/profile data and requires explicit authorization; never run it merely because E2E lacks an identity.

### 3.4 Test selection (do not run every suite after every edit)

| Changed files or behavior | Minimum relevant validation |
|---|---|
| Expo Web/UI/CSP/browser voice | Changed-scope mobile TypeScript check per `MOBILE.md` (there is no `typecheck` npm script) + changed-feature tests + `npm run test:hosting -- --production-artifact` when the existing verified export is in `mobile/dist` and hosting dependencies/Chromium are installed; this flag skips synthetic-preview checks and does not itself prove production provenance. Reuse the build workflow's completed hosting/content tests; no second export merely to run them |
| Backend auth/REST/Socket/security | Targeted Node tests plus `npm run test:security:ci` / security workflow if backend boundary changed; include allowed/denied origins, direct WebSocket admission, owner scope and anonymous auth denial |
| Garden/Fairy visuals/performance | Relevant garden tests + targeted visual comparison; no DPR, image-quality, frame-rate, or animation degradation for a purported performance fix |
| DB migrations/schema | Schema validation; review exact migration SQL, migration history and client compatibility; no production connection or migration during routine CI |
| Integration guard/env | `test/back/integration-environment.test.js`, `test/back/integration-startup.test.js`, and, when marker/Prisma behavior changes, `test/back/integration-marker.postgres.test.js` through the disposable pgvector PostgreSQL workflow; TEST-only credentials and database identity checked before hosted writes |
| Documentation only | Link/format/references as appropriate; no app build or deployment |

**Existing CI constraint:** `.github/workflows/security-regression.yml` runs for PRs to main without a documentation-only path filter; its Expo job builds a synthetic export. A docs-only PR may therefore trigger existing CI after an authorized push. Do not duplicate that build locally or change CI merely to add this SOP. CI uses Node `24.7.0`; backend Docker uses the Node 24 major.

**Evidence reuse rule:** If PR CI already ran the same tests against the same SHA (or verified equivalent relevant source) with the same relevant build flags and dependency lockfiles, link the successful run instead of rerunning. Rerun only when source/config/dependencies differ, an environment actually drifted or a known regression appears. Age alone does not require replaying accepted checks; label historical provider evidence and perform only the needed live acceptance. Never use synthetic test output as production acceptance.

## 4. Cloudflare **Web-only** release — existing protected workflow

**Source of truth:** `.github/workflows/cloudflare-web-build.yml`, `.github/workflows/cloudflare-production-deploy.yml`, `scripts/cloudflare-production-deploy.mjs`, `deploy/cloudflare/wrangler.production.jsonc`, `deploy/cloudflare/hosting-config.js`.

**Required invariant (provider bindings reuse the latest attested evidence; Wrangler does not verify live Access/domain state):** Production Worker `petalpal-web-production`, custom domain `app.jastrevia.com`, Worker-level Access on **all traffic**, exact-email reviewer policy, `workers_dev=false`, `preview_urls=false`, no Worker routes, existing DNS unchanged. The **Custom Domain is a separate provider binding**; `routes=[]` in Wrangler is expected and does not mean the custom domain is absent. Do not modify any of these during routine releases. Current infrastructure is not audited from scratch for each Web patch; check focused live behavior and investigate only an observed drift.

1. **Pinned merged SHA:** Confirm approved PR merged into `main` and choose its exact source. A newer main alone does not invalidate an existing artifact: the deploy workflow compares its listed Worker/hosting/config/lockfile paths with `source_sha`, and the artifact guard verifies its successful main build. Reuse only when those gates and the relevant tested inputs still match. Rebuild once only for an affected source/config/dependency change, provenance mismatch or expiry. Never substitute a different artifact silently.
2. **Build only if a valid matching artifact is unavailable:** Manually dispatch **Build Cloudflare Expo artifact (no deployment)** on `main`, `production_config=true`, `integration_config=false`. Protected build environment: `petalpal-web-build-production`. Its successful test/content gates create `expo-web-production-<sha>` artifact (7-day retention). The build workflow has no `source_sha` input: dispatch on main when it resolves to the intended source, then verify the actual run `head_sha` and checkout before using the artifact. Stop on mismatch. Record source SHA, build run, artifact **ID**, actual artifact **ZIP digest `sha256:`** and expiry. The workflow installs isolated dependencies, generates Prisma (no connection/migration), exports once and runs hosting/content checks; reuse their evidence. Never use a synthetic/integration export.
3. **Upload:** Manually dispatch **Production web Worker release** with `phase=upload-app`, exact `source_sha`, `artifact_id`, `artifact_digest`, `version_id` empty. The job on `main` requires environment `petalpal-web-production-deploy` approval. The action verifies successful main-build provenance, digest, production-only Firebase/API markers and Worker source match. **Upload does not deploy.** Record upload run + returned Worker version UUID.
4. **Activate:** Dispatch `phase=activate-app` **once**, using the same SHA/artifact ID/digest and exactly the version uploaded in step 3. Obtain a **separate** required-reviewer approval. The workflow checks version annotations and requests 100% allocation. Do not infer independent Cloudflare read-back from GitHub success.
5. **Live bounded smoke and identity read-back:** Read back active Worker deployment/version metadata through an authorized metadata-only method and confirm the intended version; an upload annotation check is not post-deploy read-back. Check `https://app.jastrevia.com` remains protected; test only affected functionality plus entry page, production CSP/assets and intended API origin. Use a previously authorized private session; if absent, mark authenticated tests **NOT VERIFIED**, not FAIL. No Event/Journal/AI writes without separate approval. Cloudflare DNS resolver cache issues do **not** justify re-uploading the Worker.
6. **Record:** Version/run IDs, real production PASS/FAIL/NOT VERIFIED, known-good previous app version, recovery limits. No repeat fallback upload, no implicit DNS/Access or Render change.

**Cloudflare fallback reality:** The original fallback `e7947f5a-...` is a **redirect-only first-launch fallback**, not a complete prior app. A routine release should separately retain/verify its **previous known-good application version** and provenance. The existing `rollback` workflow specifically validates the first-launch fallback annotation; it is **not** a general-purpose previous-app rollback. Never claim full rollback readiness from the existence of that fallback alone. Any restoration of a prior app version needs a supported, audited path and **separate approval**.

**Release example (historical, DO NOT replay):** PR #32 → `738b7e96` → build run `38190197395`, artifact `11721182841` → upload run `38193423470`, version `fe0b6405-6ed0-46ae-9c61-0667ed8b4f4d` → activation run `38193789359`.

## 5. Render **Backend-only** release — resolve the real known trap

**Existing service:** `PetalPal_v2` / `srv-d983eguq1p3s73fnk1m0`; production API `https://petalpal-v2.onrender.com`. Root `./Dockerfile` presently **builds Expo Web in an image stage** then copies `mobile/dist` into runtime `/app/client/dist`. The separate `./Dockerfile.backend` is designed for backend-only builds but is **not automatically production-ready**: verify required web/routes/assets and non-secret credential-binding attestations before any authorized Dockerfile-path change. Do not assume a Cloudflare-hosted frontend makes Render’s bundled web assets entirely unused.

**Owner-reported prior incident:** A requested configuration-only Render release unintentionally ran a complete build and deployed SHA `49ea26a6` rather than approved `1f8d0f98`. It nevertheless passed HTTP/CORS checks; do not use a successful health check to excuse a source mismatch. `Build not found` was observed in Render UI; neither the exact retained image nor an in-place image patch route is guaranteed.

**Mandatory release procedure:**

1. **Scope and pin.** Take changes from the approved reviewed main/release SHA. Identify backend changes since **actual production SHA**, including security, Node dependencies, environment handling and API compatibility. Do not merge the old production-based `release/backend-security-origin-20261011` wholesale back into main: its P2 `allowRequest` behavior is already in main.
2. **Choose build method before touching Render.** Prefer a reproducible, supported **new backend build** at the pinned SHA, first validated in isolated tests. Do not assume “Save and deploy” is an immutable old-image deploy. Do not pursue unavailable-image recovery or unsupported in-place image modification as the routine path. Use a supported reproducible build from the verified source; current no-rebuild/no-deploy instructions remain in effect until a release is separately authorized. If a Dockerfile change is necessary, treat it as a reviewed separate release change, **not** an ad hoc production setting edit.
3. **Verify compatibility.** Confirm runtime Dockerfile/ENTRYPOINT/CMD/workdir, Prisma generation, needed server files/static resources, Firebase project, API origin/CORS and Socket.IO, no changed DB schema without an approved migration. If a new backend-only image drops routes/assets, adjust and test the compatibility contract **before** production.
4. **Integration gate.** Test with `petalpal-backend-test` and the separate test Prisma/Firebase resources if hosted rehearsal is relevant. Its Docker command uses the guarded startup script; **never set plain `node server.js` on TEST**, because it can skip its DB marker check. Hosted TEST deployment/config changes still require approval; local isolated validation may suffice for narrow fixes.
5. **Preflight one page.** Record exact SHA/image identity, service/region, Dockerfile path, startup override, saved-vs-live environment differences or explicitly **unknown** risk, migrations, recovery, tests. For routine code changes do not ask for complete infrastructure re-verification. For changes touching provider config/database identity/secret files, the related assurance is a required gate, not an optional guess.
6. **Approval and deploy once.** Get explicit owner authorization for exact commit/build, target and configuration. Keep production **Docker Command `node server.js`**, Pre-Deploy blank and Auto-Deploy disabled unless separately reviewed. A root image may default to `npm start` and thus run Prisma migrations; verify the **effective** override before deployment and a trusted sanitized startup PASS/FAIL or non-secret runtime metadata after. No implicit migration. For a Git-backed release, select the explicitly verified full SHA with Render's supported Deploy a specific commit flow (or API `commitId`); do not use Deploy latest or a settings save to select the release. For an already supported image-backed service, use a verified immutable digest. Do not assume in-place conversion of the existing service is supported. Never use the source from a newer failed deployment by accident. See [Render deployment methods](https://render.com/docs/deploys) and [Docker startup overrides](https://render.com/docs/docker).
7. **Postflight.** Verify actual deployed SHA/build and any unexpected rebuild, readiness, sanitized startup/error status, absence of unintended migration execution, exact CORS allow and deny, auth denial, authorized DB read (if an existing authorized identity is available), and necessary API/Web compatibility. If an authenticated session is unavailable, report `NOT VERIFIED` and **do not create a test account as a hidden prerequisite**.
8. **Failure handling.** Preserve existing healthy deployment when possible; if release already changed runtime, stop automatic retries and assess impact. A Render rollback may restore an older Docker command and **re-enable Prisma migration**; design a migration-free recovery separately and obtain scoped approval. [Render rollback documentation](https://render.com/docs/rollbacks) confirms that the target deployment's Docker command is reused. Do not use an unverified DB backup as a blanket justification to proceed.

**Deferred P2:** The last verified production Render source `49ea26a6` lacks Engine.IO `allowRequest` origin admission for new connections; main contains the equivalent check. Preserved candidate `83c1a145e2982dff18e5bdbca33b66422aba55e5` had 78 local PASS and is ready for inclusion in the next controlled backend production release; deployment is deferred. The candidate stays preserved locally and must not be merged directly into main. No migration is required for this patch; no further unavailable-image investigation or deployment preparation is required for it now. Not a confirmed auth bypass; no need for a dedicated risky release solely because of this P2 maintenance item.

## 6. Prisma Postgres — migrations, backup, identity and persistence

**Runtime:** `lib/prisma.js` constructs the Prisma client from `DATABASE_URL` in production; the Prisma provider is **Prisma Postgres**, independent of Render hosting. The production and integration resources are separate **by design**, not fully verified live bindings. `db.prisma.io/postgres` is not unique. Schema usually `public`; verify the actual schema on the selected resource before any separately authorized SQL. Code selects the correct environment URL; it cannot independently prove a provider resource ID.

**Integration marker is a guard, not resource provenance:** `petalpal_environment.marker` is outside Prisma's `public` schema. The guard verifies a single `integration` row; it may create the marker in a new empty DB or move a valid legacy `public._petalpal_environment` table. Therefore `node lib/integration-environment.js` is not a read-only identity probe. Reuse the trusted TEST-resource binding attestation as well as the marker; an empty DB or shared Prisma hostname cannot establish provider identity. The exact hosted TEST startup is `/bin/sh /app/scripts/start-integration-backend.sh` with `WORKDIR /app`: guard, then `exec npm start` (migration, then server). A TEST deploy authorizes only its expressly reviewed marker/migration effects; never start it as a routine diagnostic. `integration-marker-postgres.yml` may run migrations only on its disposable CI service, not provider databases.

**Standard non-migration release:** No direct DB action when API code is schema-compatible and migration files/schema are unchanged. Validate the shared client/config and API contract. Do not make repeated test Journal entries just to prove a stable environment.

**When migration files/schema change:** Freeze application release until the exact intended Prisma **resource ID + schema + live binding** are verified without exposing credentials. Inspect SQL for destructive/backfill behavior, permissions, owner privacy and old/new app compatibility; confirm a **current usable backup and recovery route** based on data importance. Get separate, scoped approval. Use trusted, authorized execution against that resource only, once; record migration IDs/outcomes; validate startup with `node server.js` and live query afterward. Never `db push`, `migrate reset`, `migrate resolve` or auto-run Prisma Migrate against production as a shortcut.

**Owner-supplied limited data evidence (no database inspection in this SOP review):** The supplied document reports that operator SQL confirmed synthetic Journal `JP-01` exists in selected original Prisma resource but not in checked `petalpal_integration`. This is owner-reported evidence for that record's observed location and Journal UI persistence, **not** proof that all user data and all deployments are isolated. Do not reinterpret an SQL error as `false`. No application-data dump or raw connection URL in any audit.

## 7. Provider/security configuration changes — separate from releases

DNS/Nameserver, domain/route, Cloudflare Access, Firebase settings, secrets, Render environment groups/files, database identity, CORS or API-token permissions are **high-risk separate scopes**. Before any change: establish exact account/resource, desired before/after diff, impact on company website/email, saved-vs-live configuration when applicable, approved manual action, live verification and recovery. Do **not** mix with feature PRs.

**Owner-reported topology, not re-audited here:** `jastrevia.com` is registered at Namecheap but currently uses Cloudflare full DNS; the supplied checkpoint reports an 11-record DNS cutover validated with Netlify/company mail still resolving. `app.jastrevia.com` is a Cloudflare Worker Custom Domain behind Access. Never repeat the full DNS migration or change Namecheap nameservers for a regular feature release.

**Open public-launch items ≠ daily-test blockers:** Historical exposed DB credential retirement, precise live DB bindings, final user isolation/Firebase/private acceptance, production rollback/recovery evidence, and explicit public GO. Track them once in security documentation, not as repeated sign-in requests for every CSP change. If a particular release actually changes the related secret, database, auth boundary or provider binding, its appropriate security gate becomes mandatory.

## 8. Troubleshooting decision tree — one cause at a time

| Symptom | First isolate (read-only) | Avoid |
|---|---|---|
| `DNS_PROBE_FINISHED_NXDOMAIN` | Authoritative Cloudflare NS vs public resolvers vs local/network resolver; allow stale negative-cache expiry | No Worker redeploy, no manual CNAME for Worker Custom Domain |
| Cloudflare Access login page | Expected for private site; verify authorized email session | No Access bypass or broad Allow |
| HTML loads but APIs fail | Distinguish browser CSP, browser Origin/CORS, API 401/403/5xx, Render Free cold start, Firebase/auth, actual network error | No blind Render redeploy |
| Browser voice `Failed to fetch` | Recording Blob `blob:` fetch vs CSP `connect-src`, then transcription API; verify real draft update without saving Event | No disabling CSP or guessing Events database issue |
| Render `Failed deploy` yet API works | Check **actual Live deployment**, not last failed attempt | No “Deploy latest” or automatic rollback |
| New Render release wrong SHA / full rebuild | Stop changes, inspect deployment source/build and diff, verify CORS/auth/migration impact | No repeat deployment before diagnosis |
| Journal visible after reopen | Confirm authorized backend GET or trusted DB read if needed | No asserting full persistence/isolation from UI cache alone |
| Integration test unexpected success against production | Stop immediately; inspect identity guard, resource markers, Firebase/CORS bindings | No synthetic writes until fixed |
| API response/security regression | Run focused check for changed route and auth/CORS; compare with pinned last-good SHA | No full security audit when unaffected |

**DNS cache exception:** A resolver returning stale NXDOMAIN while authoritative Cloudflare and major public resolvers are correct is a **client/network cache** issue. Wait for TTL or use a trusted alternate network; changing Mac system DNS is optional, temporary and requires approval and a safe restore, **not** a provider deployment.

## 9. Release gates and definition of done

**Fast path — all of these must be true:** Known target+SHA; scope classified; no high-risk configuration/migration surprises; relevant tests passed on exact code; previous evidence reused appropriately; explicit action approval; artifact/build verified; deployment once; postflight outcome recorded. If any critical gate fails, stop the action and ask **one bounded question** with exact evidence needed.

**Required release record (copy/paste; one screen):**

```text
PR/feature, owner:               ______
Change type:                     docs | web | backend | DB | mobile | coordinated
Baseline:                        main SHA __; actual live SHA/version __
Candidate:                       reviewed SHA __; immutable artifact/build __; digest __
Impact:                          files/functions __; migration/config: none | reviewed | BLOCKED
Tests:                           link + PASS/FAIL; reused evidence if same inputs
Integration:                     PASS | not required | NOT VERIFIED + why
Approval:                        action + scope + approver + link
Execution:                       one run/deploy ID; actual source/version; no retry
Live verification:               requested behavior + security regression PASS/FAIL/NOT VERIFIED
Recovery:                        previous app version/config; independently verified or LIMITED
Docs:                            SECURITY.md change or none; checklist only actual provider/manual delta
Outstanding items:               new blockers ONLY (reference known items; don't restate audits)
```

**Documentation/integration-only done =** reviewed minimal diff, appropriate local/CI evidence and explicit publication/merge status; no deployment is required unless requested. Deferred preparation is done when the owner accepts that disposition and the tested candidate/evidence are preserved.

**Deployment done =** the **requested changed behavior** works in the intended deployed environment, actual deployment ID and version/source match approved inputs, its relevant safety invariants hold, and any unverified condition is explicit. **Deployment not verified =** only uploaded, PR merged, local tests passed, homepage HTTP 200, or release workflow succeeded without relevant live behavior checks. If live functional testing needs a separate authorized identity or production write, finish the deploy record as `DEPLOYED / FUNCTIONAL ACCEPTANCE PENDING` rather than claiming verified functionality.

## 10. Next-release responsibilities and minimal agent handoff

- **Codex/agent:** read `WARNING.md` and this SOP; fetch minimal source/deployed snapshot; resolve change diff; execute safe local work; reuse existing CI; prepare and use exact artifact/release IDs; avoid repeating account setup/audits; prepare one consolidated approval request for the explicitly listed release actions, honor existing authorization and mandatory reviewer gates, and ask again only for new scope; perform bounded postflight; preserve history.
- **Owner:** supply branch/PR and approve only the exact reviewed merge and provider release action when required; enter provider secrets **only in trusted UI**, never share values. Approval of one action does not imply future release, migration or public-launch approval.
- **Teammate:** publish feature branch/PR with description, test evidence and changed surfaces; no production credentials, force-push to main, unreviewed migration or implicit deployment.
- **Future security changes:** the minimal relevant regression and security docs are mandatory; `MANUAL_SECURITY_CHECKLIST.md` gets a change only for genuine external/manual status. Keep accepted iPhone DELTA-P2-2 isolated test evidence; do not claim it means Web or production Firebase storage acceptance.

**Single-sentence handoff:** *“Follow `INTEGRATION_DEPLOYMENT.md` and `WARNING.md`; integrate `<branch/PR>` safely against current main, preserve existing behavior and environment isolation, run only impact-specific tests, and prepare/deploy only the affected service after the exact required approval. Don't repeat previously completed audits.”*

---

**This SOP standardizes decisions and execution; it is not a certification that all current services, provider settings or test environments remain correct forever.**
