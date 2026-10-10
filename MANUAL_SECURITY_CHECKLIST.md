# Manual Security Checklist

## Logging-only production verification — 2026-10-08

- [x] **Homepage availability USER-CONFIRMED PASS (subsequent evidence):** user confirms the production homepage opens successfully on the accepted logging deployment. Supersedes the open user-observed availability requirement only; prior agent transport failure remains historical, no new automated root/header test performed, and production logging redaction remains UNKNOWN.
- [x] Render safe deployment metadata: PetalPal_v2 / `srv-d983eguq1p3s73fnk1m0`, Live deployment `dep-db468kbbc2fs73ap2t70`, exact approved source `1f8d0f98fb16b9553ae03c474f5952c808928e48`. Earlier unconfirmed-submission evidence is historical; no deployment action performed in this acceptance task.
- [x] Startup USER-CONFIRMED PASS: 25 migrations found, none pending; listening on port 10000; Mood model loaded; no confirmed startup failure. No independent log inspection.
- [x] Anonymous /session?view=metadata and invalid-synthetic-bearer /ai/reports returned 401, exact generic error bodies and expected HSTS/CSP/frame/nosniff/referrer/no-store headers. Sanitized request correlations/time are retained in SECURITY.md.
- [ ] Root GET result UNKNOWN: transport attempt produced no HTTP response; no retry. Three authorized request attempts exhausted.
- [ ] LOG REDACTION ACCEPTANCE UNKNOWN: safe request-correlated sanitized verification unavailable; no raw logs accessed. Root liveness and production logging privacy require further bounded evidence; no full P0 certification.

Credential recovery confirmation and historical uncertainties/counts preserved. Accepted CI/build/migration/schema evidence reused; no provider settings, secrets, production SQL/manual migrations or mobile operations changed. Only this new verification checkpoint is intended for the scoped commit; earlier uncommitted evidence preserved.

## Authorized logging deployment attempt — 2026-10-08

- [x] Safe Render deployment metadata confirms PetalPal_v2 / `srv-d983eguq1p3s73fnk1m0`, Live `dep-db4578flot8c73frlk1g` at `d510b1ff97902704721060b4c1261657be3e4b76`, with auto-deploy disabled. Exact candidate branch/scope and rollback reference PASS; existing accepted evidence reused.
- [ ] Approved `1f8d0f98fb16b9553ae03c474f5952c808928e48` selected and Deploy Commit clicked once. Returned immediately to deployment list to avoid logs; refreshed list contains no candidate deployment and still reports the baseline Live. Submission outcome UNKNOWN; deployment BLOCKED, no retry/rollback. No confirmed Render build failure claimed.
- [ ] Candidate startup/migration verification and all three production GET checks NOT RUN because candidate Live was not established. LOG REDACTION ACCEPTANCE: UNKNOWN; no logs retrieved.
- [ ] Obtain sanitized confirmation whether Render accepted the attempted submission; fresh explicit authorization required before any retry. Preserve working replacement credential. Previous rollback SHA: `d510b1ff97902704721060b4c1261657be3e4b76`, separately approved only.

Replacement functionality remains USER-CONFIRMED PASS; old-key retirement/exposed-key deletion are UNKNOWN under the later retirement assessment. Historical trace retention/misuse uncertainty remains. No secret-bearing pages, credentials, provider settings, SQL/manual migrations or unrelated changes accessed or modified. Historical evidence and canonical counts preserved.

## Firebase credential recovery — historical confirmation, 2026-10-08

- [x] User confirms replacement Firebase Admin credential works in production.
- [ ] Current exposed-key deletion UNKNOWN. Earlier user-confirmed deletion is retained as historical evidence, superseded by the later report of two older keys still listed without safe exposed-key mapping; see the retirement assessment below.
- [x] Sanitized user evidence confirms Render Live source `d510b1f` (recorded exact baseline `d510b1ff97902704721060b4c1261657be3e4b76`), 25 migrations found and none pending. No independent provider/credential/schema access performed.
- [ ] Prior tool-trace/downstream retention and unauthorized historical use remain UNKNOWN; no erasure, absence of misuse or full incident certification claimed. Historical database-credential revocation remains separate.
- [ ] Exact logging candidate `1f8d0f98fb16b9553ae03c474f5952c808928e48` is READY FOR APPROVAL on existing accepted CI/build/schema/configuration evidence, with no additional release-specific predeployment evidence blocker identified. Fresh separate deployment approval and subsequent bounded sanitized runtime/log-redaction acceptance remain required. Preserve the replacement credential even if a code rollback is separately approved. No deployment authorized or performed.

This supersedes earlier credential-recovery OPEN/BLOCKED checkpoints only within the user-confirmed scope. All historical evidence and canonical counts remain; no provider mutation, credential inspection, repeated CI/build/migration test or mobile operational change.

### Credential-recovery checkpoint — 2026-10-08

- [ ] User reports replacement Firebase Admin credential created and Render update started. New-key runtime acceptance and exposed-key revocation remain UNCONFIRMED; incident OPEN and production releases BLOCKED. Obtain only sanitized human/provider confirmation of acceptance, revocation and exact live revision. Do not inspect either key or reopen the incident trace. This supersedes no historical evidence and grants no credential/provider/deployment authorization.

Provider and production-control-plane actions only. Never record passwords,
tokens, keys, credential-bearing URLs, or full secret fingerprints here.

Last reconciled: 2026-10-08. Existing checked provider evidence is retained; production exact-code rollout/migration verification and the scoped read-only shared-ledger follow-up below add new evidence. Deployment presence is distinct from live runtime/provider certification.


## Current accepted production/manual evidence — reconciled 2026-10-08

- Shared ledger: **PASS FOR CURRENT PRODUCTION TOPOLOGY**; authenticated Cloudflare Worker/Queue/Cron inventory available, normal customer bypass absent, Queue/executor gating and same-ledger requirement PASS, c-lite outside normal flow, active-path tombstone retention PASS. One Render instance, autoscaling off. Multi-instance certification, runtime grants and provider billing/currency protection remain unverified.
- Production HSTS/CSP/frame-ancestors/nosniff/X-Frame-Options/Referrer-Policy and anonymous private no-store PASS on observed paths. Two manual authenticated `/session` requests: no-store/CF DYNAMIC, no Age reuse/HIT observed. Global CDN/cross-account and unrelated routes remain unverified.
- Manual authenticated `/session?view=metadata`: HTTP 200, required metadata present, sensitive fields absent, no-store PASS, CF DYNAMIC for that response. Owner Garden metadata and Calendar/history/navigation runtime remain NOT VERIFIED on the Expo/mobile consumer.
- Preview route policy/aliases: repository tests PASS; exported Expo/native release-artifact verification remains open under the existing manual item. RAG grounding and request-object hardening are code/deployment evidence in SECURITY.md, not new provider/manual requirements.
- Current accepted backend revision `d510b1ff97902704721060b4c1261657be3e4b76` is Live (2026-10-08, Render dep-db40qshsrm7s73agbdn0): startup found 25 migrations with no pending changes; HTTP liveness, observed security headers/private no-store and anonymous authorization rejection PASS. Prior `db933de78a91ba505b06016db716bbf710530d7f`, older `8c3500116acc8a9ba0ee0e03dbd5cdc6b6e33316` and initial four-migration rollout evidence remain historical. Only three safe anonymous GETs were used; authenticated production behavior is not certified.
- Atomic social fix `d510b1ff97902704721060b4c1261657be3e4b76` is now deployed for exact-code presence. Historical pre-release state was pushed, NOT deployed; accepted 34 independent PostgreSQL concurrency tests, 14 affected regressions and previous 102-request social DAST PASS were reused. Authenticated production Flower/privacy/Garden and concurrent behavior remain NOT VERIFIED; require separately authorized isolated acceptance. Rollback to db933de requires further approval and restores the old social race.
- CodeQL Default remains active; Advanced cutover is deferred. Preserve existing main JS/TS/Python scanning and keep `PETALPAL_CODEQL_ADVANCED` unset/false; integration coverage/results remain unverified.

## 1. Database / Prisma provider

- [ ] Verify the historical `DATABASE_URL` credential is revoked. Evidence: provider confirmation or non-secret credential status. Status: `ACTION REQUIRED`
- [x] Confirm the current Render `DATABASE_URL` differs from the historical credential. Evidence: provider-side comparison result without recording values. Status: `PASS`
- [ ] If revocation cannot be confirmed, rotate the current database credential. Evidence: rotation timestamp and deployment confirmation, without secret values. Status: `ACTION REQUIRED`
- [ ] AuditEvent Level 2: separate migration/admin and runtime database roles. Evidence: non-secret role/grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`; current runtime and migration share `DATABASE_URL`, and a pooled/direct URL pair alone does not create role separation.
- [ ] AuditEvent Level 2: grant the runtime role AuditEvent INSERT-only access. Evidence: non-secret grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`; INSERT-only grants were not verified.
- [ ] AuditEvent Level 2: revoke AuditEvent UPDATE, DELETE, and TRUNCATE privileges. Evidence: non-secret grant review. Status: `PROVIDER-LIMITED / NOT VERIFIED`
- [ ] AuditEvent Level 2: ensure the runtime role cannot ALTER, DROP, or grant database privileges. Evidence: non-secret role-capability review. Status: `PROVIDER-LIMITED / NOT VERIFIED`

## 2. GitHub

- [x] Enable or check MFA/passkey protection. Evidence: both repositories and account checked; MFA/passkey complete. Status: `PASS`
- [x] Review organization and repository members. Evidence: dated review of both repositories; no unexpected collaborator found. Status: `PASS`
- [x] Remove unnecessary access. Evidence: review found no unnecessary access; intended permissions retained. Status: `PASS`
- [x] Check Secret Scanning. Evidence: Secret Protection enabled in both repositories. Status: `PASS`
- [x] Check Push Protection. Evidence: Push Protection enabled in both repositories. Status: `PASS`
- [x] Review PAT and deploy credentials. Evidence: credential review completed; no further non-secret action recorded. Status: `PASS`
- [x] Verify branch and release protection if applicable. Evidence: repository security controls reviewed; no additional finding recorded. Status: `PASS`

- [ ] Advanced cutover is DEFERRED: keep Default active and `PETALPAL_CODEQL_ADVANCED` unset/false. Do not perform the following historical/conditional instructions without a separately authorized no-gap transition plan. Previously recorded UI sequence: origin Settings → Advanced Security → Code scanning → CodeQL analysis → Switch to advanced / disable default setup; then Settings → Secrets and variables → Actions → Variables: set `PETALPAL_CODEQL_ADVANCED=true`. Do not enable the variable while managed default setup is active. Existing managed main scan (run 37264614823) passed JS/TS/Python; new scoped integration workflow has only local syntax/config validation. Status: `PARTIAL / ADVANCED DEFERRED`; no settings changed in this reconciliation.
- [ ] Current action is read-only verification of managed Default results on main/integration; no switch, variable or protection change. Deferred Advanced validation, only after an authorized cutover: push a relevant source/config change on integration and verify “PetalPal static security” → “CodeQL JS/TS” completes and uploads results; inspect Security → Code scanning findings and classify severity/reachability without silent suppression. Validate a relevant PR after the workflow is present on its target branch. Only after proven runs, consider a required check; no branch-protection change is authorized here. Status: `NOT VERIFIED`; finding count/severity unknown for integration.

### Security regression CI / production release gate — 2026-10-08

- [x] Repository automation prepared and locally validated: `.github/workflows/security-regression.yml` runs the isolated backend baseline for integration pushes and PRs targeting integration/main; contents:read only, pinned official actions, no provider secrets or deployment. Existing CodeQL Default/Advanced guard and branch protection are unchanged. Status: `LOCAL CONFIG PASS`; this is not a GitHub runtime or release approval.
- [x] Exact CI commit runtime observed: [run 37866127057](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/37866127057) completed successfully on `01ac98bda9d4ec2320d9b1c344217feb3dd12424`; all baseline steps succeeded. Status: `GITHUB REGRESSION PASS FOR THIS SHA`, superseding the commit-preparation NOT VERIFIED checkpoint. This SHA is not nominated for production. Future release candidates require their own exact-SHA result. Manual dispatch requires the workflow on the default branch; no merge/settings change was made to force dispatch. The initially uncommitted post-push evidence is preserved with the CI reliability checkpoint.
- [ ] New coverage candidate c3726a29d06ff8557a42809eb3a4417486bfe10e: [run 37866923724](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/37866923724) failed on the newly selected realtime privacy fixture (500 vs 200); Journal step did not execute. Status: `NEW COVERAGE BLOCKED / REMOTE FAILURE`, not PASS. Prior 01ac98b/run 37866127057 remains accepted. No GitHub/provider/settings change is required by the diagnosed mock-adapter correction; post-push failure evidence remains uncommitted.
- [ ] PR execution remains `NOT VERIFIED`: read-only API found zero pull_request runs for this workflow; file exists on integration but returns 404 on main. Observe the next legitimate integration/main-target PR and record its actual event/SHA/conclusion. Do not create a test-only PR, change settings/protection or merge solely to obtain evidence. Push run 37866127057 remains separately accepted.
- [ ] Complete all six production release evidence gates in SECURITY.md, including the exact scope/rollback/schema review and outstanding Prisma capacity/proxy/latency/monitoring evidence, then obtain separate approval for the exact deployment and non-destructive smoke plan. Current DB readiness remains 1/4 and `SAFE TO DEPLOY: NO`; CI success never grants deployment approval. External-provider/native/destructive/load acceptance stays separately opt-in.

## 3. Render

- [x] Review environment secrets. Evidence: production secrets confirmed as Render environment variables; no unexpected Secret Files. Status: `PASS`
- [ ] Verify no historical `DATABASE_URL` remains. Evidence: provider-side secret review without recording values. Status: `ACTION REQUIRED`
- [x] Verify `/api-docs/` is not explicitly enabled in production unless intentional. Evidence: `API_DOCS_ENABLED=true` absent from production environment. Status: `PASS`
- [x] Review members and permissions. Evidence: no unexpected workspace team member found. Status: `PASS`
- [x] Verify production/development separation. Evidence: current production configuration reviewed; no additional workspace finding recorded. Status: `PASS`
- [ ] Configure relevant Render monitoring, alerting, and retention where available. Evidence: non-secret configuration summary. Status: `PARTIAL / PLAN-LIMITED`
- [ ] Verify deployed auth proxy topology and effective `TRUST_PROXY`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_AUTH_ACCOUNT_MAX` and `RATE_LIMIT_WINDOW_MS`; use isolated IPv6/shared-NAT/concurrency checks to validate fair temporary throttling. Confirm singleton/restart limits or a shared store before scaling. Status: `NOT VERIFIED FOR NEW AUTH LIMITS`; local tests do not certify deployed configuration.

## 4. Cloudflare

- [x] Verify the current Worker shared secret. Evidence: synchronized Worker/backend contract verified without recording values. Status: `PASS`
- [x] Verify Render backend and Worker use the synchronized current secret. Evidence: deployment configuration and runtime contract confirmed without values. Status: `PASS`
- [ ] Rotate the Worker shared secret if uncertain. Evidence: rotation timestamp and deployment confirmation. Status: `NOT CHECKED`
- [x] Review account members and MFA. Evidence: one intended human member; 2FA active. Status: `PASS`
- [x] Review Worker logs, errors, timeouts, and AI usage monitoring. Evidence: Workers Logs, invocation logs, and persistence enabled; live invocation observed; traces intentionally disabled. Status: `PASS`
- [x] Review production/development separation. Evidence: Worker identity and account configuration reviewed. Status: `PASS`

## 5. Firebase / Google

- [x] Review Firebase Admin credential inventory. Evidence: two service accounts reviewed; active Admin key inventory recorded without key material. Status: `PASS`
- [ ] Remove unused service-account keys. Historical evidence stated an old Admin key revoked/removed and zero Gemini keys; that does not identify the subsequently reported August 25 / September 25 keys still listed. Current enabled/use states and exposed-key mapping UNKNOWN; retirement OPEN. Status: `PARTIAL`
- [x] Verify MFA/passkey protection on administrator accounts. Evidence: Firebase project administrator review completed. Status: `PASS`
- [x] Review project members and permissions. Evidence: only intended Firebase human member found. Status: `PASS`
- [x] Verify Firebase Web config is treated as public, not secret. Evidence: configuration classification review. Status: `PASS`
- [x] Confirm production Firebase Email Enumeration Protection is enabled. Evidence: user-observed Firebase Console screenshot, 2026-10-08. Status: `USER-OBSERVED PASS — SETTING ONLY`; no agent Console access or setting change. Direct signup `EMAIL_EXISTS` and signup success/failure differences remain; live login/reset/signup behavior is not verified. Account Enumeration remains `PARTIAL`.
- [ ] Review authentication abuse and security visibility where available. Evidence: non-secret monitoring configuration summary. Status: `ACTION REQUIRED`
- [ ] Credential stuffing: verify effective Firebase password/signup quotas, quota overrides, abuse/throttling metrics and alerts, legitimate recovery and high-risk re-auth in an authorized isolated environment. Published signup limit is 100 accounts/hour/IP; project-specific and distributed protection are not verified. Status: `NOT VERIFIED`; no live attempts or provider changes authorized by this record.
- [ ] Evaluate Identity Platform eligibility and App Check/reCAPTCHA email-password enforcement for all shipped web/native clients, with isolated missing/invalid-token negatives and legitimate sign-in/signup recovery. Current production Console shows initial “Get started” onboarding, with no registered app or Authentication enforcement status visible (USER-OBSERVED, 2026-10-08): App Check is not yet configured based on this UI evidence; enforcement is not verified. Defer App Check setup until Expo/native release compatibility is validated; do not start onboarding or change settings. Record audit versus enforcement mode, client compatibility and cost before any separately authorized rollout. Status: `NOT VERIFIED`; client integration alone is not provider enforcement.

- [ ] Verify shipped account-deletion recent-login rejection and explicit sign-out/sign-in recovery in a separately authorized isolated environment. Local claim/route/mobile tests PASS for the five-minute verified `auth_time` gate; Admin deletion has no client recent-login guard. Status: `RELEASE / PROVIDER ACCEPTANCE NOT VERIFIED`; no production deletion or native scenario rerun authorized here.

## 6. Backup / Restore

- [x] Verify database backups exist. Evidence: automated backup status `COMPLETED`. Status: `PASS`
- [ ] Verify encryption and retention where supported. Evidence: non-secret provider settings. Status: `PARTIAL / NOT FULLY VERIFIED`
- [ ] Verify backup credentials and access are appropriately restricted. Evidence: non-secret access review. Status: `PARTIAL / NOT FULLY VERIFIED`
- [x] Perform an isolated restore drill before launch. Evidence: restored to new isolated database; production was not overwritten; schema/data verified; temporary database deleted. Status: `PASS`
- [x] Record only non-secret evidence. Evidence: checklist review contains no credentials or secret values. Status: `PASS`

## 7. AI provider / data handling

- [x] Verify Workers AI Customer Content training/data-use policy. Evidence: Cloudflare states Customer Content is not used to train Workers AI models or improve Cloudflare/third-party services without explicit consent. Status: `PASS`
- [x] Verify applicable Cloudflare DPA. Evidence: Customer DPA v6.4 effective 2026-04-03; processor/subprocessor terms limit processing to service provision and prohibit marketing/advertising use of personal data. Status: `PASS`
- [ ] Record ordinary Workers AI inference retention. Evidence: official documentation does not specify a general retention period for ordinary prompts/outputs; Customer Content may be stored when a Cloudflare storage service is specifically used. Status: `PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED`
- [ ] Verify data residency and subprocessors. Evidence: published subprocessors include US and England operations; no Canada-only or single-region guarantee is configured. Status: `NOT VERIFIED / OPTIONAL HARDENING`
- [x] Verify Workers Logs configuration. Evidence: Workers Logs, invocation logs, and persistence enabled; live invocation observed; traces intentionally disabled; Free-plan retention documented as 3 days. Status: `PASS`
- [ ] Do not place private configuration values in this checklist. Evidence: final checklist review. Status: `NOT CHECKED / PASS / ACTION REQUIRED`

## 8. Final Security P0 closure

Historical 2026-09-16 repository P0 closure: `COMPLETE WITH DOCUMENTED LIMITATIONS`. No new P0 identified in the reviewed delta; current feature P1/P2 and deployment checks remain open. This is not current release approval.

Provider/manual unresolved:

- Historical `DATABASE_URL` revocation proof: `ACTION REQUIRED / UNCERTAIN`; the old endpoint was unreachable, so neither revoked nor still-valid is claimed.
- Database runtime/migration role separation and grants: `PROVIDER-LIMITED / NOT VERIFIED`; AuditEvent Level 2 is not a repo P0 blocker.

Optional/compliance hardening:

- Exact Workers AI inference retention duration remains unspecified.
- Regional/data-residency requirements remain optional unless PetalPal later requires them.
- Plan-limited provider controls remain `PARTIAL / PROVIDER-LIMITED`; no plan upgrade is a P0 requirement.

## 9. Final global checkpoint

- Historical repository P0 checkpoint: `PASS (2026-09-16 scope)`; no new P0 identified in the reviewed delta. October report/Socket/AI-cost fixes are locally `TESTED`, not newly production/provider verified.
- GitHub: `PASS`; Render: `PARTIAL / PLAN-LIMITED`; Cloudflare: `PASS`; Firebase/Google: `PASS`.
- Backup/restore: `PARTIAL` (backup existence and isolated restore drill PASS; provider retention/encryption/access metadata not fully verified).
- Workers AI data handling/DPA: `PASS`; inference retention: `PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED`; data residency: `NOT VERIFIED / OPTIONAL HARDENING`.
- AuditEvent Level 1: `PASS`; Level 2: `PROVIDER-LIMITED / NOT VERIFIED`.
- Historical `DATABASE_URL`: `ACTION REQUIRED / UNCERTAIN`.
- Final Security P0 classification: `P0 CLOSED WITH DOCUMENTED LIMITATIONS`.

## 10. 2026-10 feature release provider checks

Canonical findings/actions: [Feature Security Delta Review](SECURITY.md#2026-10-feature-security-delta-review). Checked items below include already-recorded production evidence; unchecked items preserve remaining scopes. No provider/production check was repeated by this documentation reconciliation.

- [ ] Verify exported web/native production preview/test-route behavior, intentional Fairy alias, release flags, approved Firebase domains and deep-link redirects. Evidence: release artifact route/negative-link matrix. Status: `RELEASE ARTIFACT NOT VERIFIED`; DELTA-P2-3 centralized production policy/direct-path denial and intentional Fairy alias code/test PASS. Backend rollout is not Expo release evidence
- [ ] Verify the intended shipped iOS Firebase credential persistence/backup policy. Source review confirms Firebase JS 12.19.0 with AsyncStorage 2.2.0 file persistence and default exclusion request; effective release file-protection/exclusion, iCloud/encrypted/unencrypted backup inclusion and restore/new-device transfer remain `PARTIAL / NOT PHYSICALLY VERIFIED`. Retain safe status/presence only, never auth files or a full backup. Separately evaluate App Check/device attestation enforcement/replay negatives; attestation is an abuse control, not credential encryption or user authorization. No provider/backup/device action was performed by the source review.
- [ ] Verify production Prisma Postgres database/proxy connection allowance, shared usage and migration/deploy-overlap headroom against 10 connections per backend/worker process; verify startup timeout-option support and existing cold acquisition/report/job query/lock latency against candidate `0ffdd3e` (2s acquisition, 10s statements, 1.5s locks; unchanged 2s maxWait / 5s interactive timeout). Verify pool active/idle/waiting metrics, exhaustion/timeout counters and alerts, worker concurrency, lease/inference duration alerts and AI spend thresholds. Evidence: non-secret read-only provider configuration and existing telemetry; isolated 5/5 resource tests do not establish production capacity. Current Render Free compute exposes network metrics but restricts CPU/memory metrics; no provider upgrade/change was made. Status: `NOT VERIFIED / PLAN-LIMITED WHERE APPLICABLE`; DB resource release readiness is **NO**, candidate NOT deployed. See SECURITY.md DB Resource Release Readiness. New application counters have 4/4 isolated tests PASS, NOT deployed: after a separately approved safe release, verify authorized collection/retention/routing of `security_metrics` snapshots, per-process cumulative deltas/reset handling, and alerts chosen from evidenced workloads. This is not production monitoring verification or permission to deploy/change providers.
- [x] Shared paid-AI backend/executor reservation boundary: `PASS FOR CURRENT PRODUCTION TOPOLOGY`. Accepted deployed ordering and live Cloudflare inventory establish no normal customer bypass, Queue/executor gating PASS and one shared ledger. Inference Worker needs no PostgreSQL access; production is one Render instance, autoscaling off.
- [x] Current reservation topology uses the same production PostgreSQL ledger and consistent code-default quota policy; inspected active paths retain reservation tombstones. Status: `PASS FOR CURRENT PRODUCTION TOPOLOGY` only.
- [ ] Before scaling, certify multi-instance duplicate/reclaim/quota/runtime outage behavior. Runtime least-privilege/ledger-erasure grants and provider billing/currency ceilings/alerts remain unverified. Preserve reservations after ambiguous paid attempts; recovery/replay availability remains separate. Status: `NOT VERIFIED`; application call ceilings do not cover direct credential use or certify account-wide currency spend.
- [ ] Reconfirm Workers AI/embedding/report inference retention, logs, subprocessors and residency against the new selected-Event evidence data flow; use existing §7 provider records rather than recording private examples. Status: `NOT VERIFIED FOR NEW FLOW`; exact retention remains unspecified unless newly evidenced.

- [ ] Verify deployed Firebase disabled/revoked/expired-session propagation, idle Socket eviction and privacy/unfriend/account-delete revocation; confirm single-instance/adapter assumptions and process-local movement/control budgets match deployment. Evidence: non-secret authorized/revoked delivery and normal-cadence outcomes. Status: `NOT VERIFIED`; distributed Socket revocation is not implemented/certified.
- [x] Retain the 2026-09-29 production Queue cutover evidence. Evidence: [LONG_TERM_AI.md — Production Queue cutover and observation](LONG_TERM_AI.md#production-queue-cutover-and-observation--2026-09-29) records private authenticated execution, opaque IDs, duplicate/revoke/reconciliation and owner-scoped embedding/retrieval smoke. Status: `PASS FOR RECORDED SCOPE`; not evidence for later October fences/quotas.
- [x] Live Cloudflare Worker/Queue/Cron inventory, production reconciler, disabled staging Cron and gated executor destination established; October report/cost code deployment presence PASS. Status: `PASS FOR RECORDED TOPOLOGY/DEPLOYMENT SCOPE`.
- [ ] Complete broader operational observation: backlog/lease/attempt/cost alerts, capacity and sufficient-evidence report-provider behavior. Status: `NOT VERIFIED`; local tests/exact deployment are not live model acceptance.

- [ ] Verify deployed consent-revocation lifecycle: disabling AI memory prerequisites denies private memory/report reads and atomically clears owner-derived memories/vectors/evidence/reports while retaining source Events and non-AI data; verify late-worker/epoch/regrant behavior, required runtime deletion privileges and failure rollback. Confirm existing backup/provider/log retention and client-cache erasure policies separately; application cleanup does not erase historical external copies. Evidence: non-secret deployment outcomes and role/policy review, without private content. Status: `PASS FOR EXACT-CODE DEPLOYMENT PRESENCE`; production runtime revocation/privilege/retention checks remain `NOT VERIFIED`. DELTA-P1-1 records 18 independent isolated PostgreSQL cases PASS (four connections), including observed lock waits, cleanup rollback and stale-worker/read denial. This does not verify deployed runtime-role privileges, providers, backups or client copies.


### Production/deployment observations — 2026-10-06

- [x] Identify live backend revision/topology. Historical pre-rollout evidence: authenticated Render PetalPal_v2 metadata showed `3fef15d474ebe0d56c2406dba1a9dd894a8cc2a0`, `main`, pinned deployment with auto-deploy disabled, one Free instance and autoscaling off. Status: `PASS FOR INVENTORY ONLY`; the later verified rollout below supersedes this revision. See the corresponding SECURITY.md observations.
- [x] Complete production migration precheck and exact-code rollout. Status: `PASS FOR DEPLOYMENT PRESENCE`; Initial verified rollout revision was `68dfd98da5b98de06005bcba8a724b7d0156ec3a`, with all four migrations successfully applied by normal startup and confirmed through read-only SQL. Consent/cost/report-fence/Socket modules are deployed; runtime race/provider certification remains separate. Historical later backend Live revision was `8c3500116acc8a9ba0ee0e03dbd5cdc6b6e33316` with HTTP liveness 200, later superseded by `db933de78a91ba505b06016db716bbf710530d7f`, then current `d510b1ff97902704721060b4c1261657be3e4b76` (25 migrations found, no pending changes; anonymous acceptance PASS). Authenticated production social behavior remains NOT VERIFIED; this reconciliation repeated no checks.
- [x] Production AI policy/shared ledger and staging topology separation: accepted one-instance code-default quota policy plus later authenticated Cloudflare inventory. Normal path bypass: no; Queue/executor gating and same-ledger requirement PASS; inspected active tombstone retention PASS. Runtime grants, future scaling and external direct credentials remain separate.
- [ ] Finish broader private-cache/CDN verification. Clean production headers/anonymous no-store PASS. User-reported manual authenticated GET /session HTTP 200: two fresh requests both Cache-Control no-store, CF-Cache-Status DYNAMIC, no Age and distinct CF-Ray; security headers retained. Status: `PASS FOR /session NO-STORE/OBSERVED REPEATS; PARTIAL FOR GLOBAL CDN/CROSS-ACCOUNT`; report-list and cross-account runtime checks remain unverified.
- [ ] Verify operational alerts with available provider access. Render has default failure notifications, no explicit HTTP health-check path and paid-compute restrictions for application metrics. Dedicated DB/job/spend alerts remain unverified; later authenticated Cloudflare Worker/Queue/Cron metadata is accessible and verified; alert/retention configuration remains unverified. Status: `PARTIAL / PLAN-LIMITED WHERE APPLICABLE`; no paid feature or alert was configured.

Existing Firebase/Socket runtime, retention/residency, backup/client-copy and database privilege checks remain open. Distributed Socket enforcement is absent from the inspected deployed server/package path; one-instance topology is not distributed enforcement evidence. No destructive or paid smoke test was performed.

Migration gate follow-up (2026-10-06): **SAFE TO DEPLOY for the migration gate**. Four-migration isolated PostgreSQL 16 upgrade via Prisma migrate deploy PASS; legacy rows/defaults/FK/unique constraints, new Journal/cover behavior and inspected old/new code flows PASS; second migrate deploy clean. Baseline and final schema comparisons retain the same pre-existing EventMemoryEmbedding.updatedAt default mismatch, so strict full-schema equivalence is not certified. See SECURITY.md for the four exact migration names and per-migration lock/rollback risks.

- [x] Approved production read-only migration precheck PASS: one Direct pg session confirmed default_transaction_read_only=on before SELECT/SHOW. PostgreSQL 17.2; latest successful `202609280001_multi_profile_event_memory_embeddings`; all four targets pending, no failed/incomplete migrations, matching applied checksums and valid prerequisites/order. No target-schema conflict; pending additions/defaults and nullable relaxation are compatible. Touched tables under 107 KB; full statistics visibility, zero >60-second transactions, zero blocked sessions and no other-session target-table locks at observation. Existing EventMemoryEmbedding.updatedAt CURRENT_TIMESTAMP default difference is unrelated/non-blocking; no new target-migration drift. Status: `PASS FOR POINT-IN-TIME PRECHECK ONLY`; at precheck time no migrations applied, deployment performed, private rows returned or production data modified. Subsequent rollout/postcheck passed as recorded below; locks may change.

Approved rollout/postcheck PASS (2026-10-06): Render Deploy succeeded/Live, active service commit `68dfd98da5b98de06005bcba8a724b7d0156ec3a`. Normal startup applied Daily Flower, Garden privacy, standalone Journal and Journal cover migrations; independent production read-only postcheck confirms all successful, latest `202610020002_private_journal_cover`, no failed/incomplete migration. Root HTTP 200 and anonymous AI reports HTTP 401 PASS for response/auth boundary only. Exact code proves consent lifecycle, durable cost gate, report fencing and Socket hardening are deployed; no unsafe/paid/user-mutating smoke test performed. The earlier private-cache/web-header omissions are superseded by final clean verification below; at that rollout, shared-primary/policy and multi-instance runtime certification, live Firebase propagation, distributed Socket, billing/retention/residency, backup/client-copy, grant/credential and monitoring limitations remain open. No provider configuration change or intentional production data change outside approved migrations.

### Production shared-ledger follow-up — 2026-10-06 (historical; superseded by live certification on 2026-10-07)

- [x] Confirm deployed backend policy/order and durable ledger shape. Current Render has one instance/autoscaling off; no daily quota override keys or linked environment groups, so exact deployed gate defaults apply consistently to its HTTP/in-process executor. Same imported Prisma singleton serves those reservation paths. Read-only Direct SQL confirms permanent AuditEvent storage, valid primary key/required columns and zero current cost reservations. Backend retrieval/narrative/embedding/emotion/speech reserve before provider calls. Status: `PASS FOR INSPECTED BACKEND POLICY/DEPLOYED ORDER/STORAGE`; no live paid call or reservation race exercised.
- [ ] Establish current Cloudflare Queue/reconciler/executor destinations and all paid callers, compare runtime/inspection primary and identity without disclosing credentials, and confirm any other executor's policy. Cloudflare control plane requires authentication; a separate c-lite benchmark appears in Render inventory. Status: `NOT VERIFIED`; repo dispatcher intent and one Prisma singleton do not prove all production callers/shared-primary identity.
- [ ] Verify actual runtime ledger privileges and external retention. Inspection identity can SELECT/INSERT/DELETE/TRUNCATE and execute the advisory-lock function, but runtime identity equivalence is unproven. No owner FK, table trigger, pg_cron or targeted application reservation-pruning path was observed; external/operator cleanup remains unverified. Status: `PARTIAL / NOT VERIFIED`; retain AuditEvent Level 2 and direct credential/provider bypass limitations.

Overall certification `PARTIAL`; deployed fail-closed controls present, not live outage/quota/provider certification. Defaults are intentional and not a failure. One inspected application instance; multi-instance live certification NOT VERIFIED. No paid AI, production mutation or provider configuration change. Existing billing/retention/residency, Firebase/Socket, cache/headers, credential/grant, backup/client-copy and monitoring checks remain open.


### Targeted caller/runtime continuation — 2026-10-06 (historical; superseded by live certification on 2026-10-07)

- [x] Classify inspected paths: Render backend/in-process executor reserves/checks and invokes inference; Worker inference invokes AI without DB access; Queue delegates opaque IDs to backend execution; reconciliation Cron discovers/enqueues IDs without direct provider calls or tombstone pruning. Source equivalence across application revision/HEAD checked only for these Worker/benchmark files. Separately deployed Worker version is unverified.
- [x] Inspect c-lite without invoking it: separate deployed Image web service/public address; no configured environment variables, secret files or linked groups. Source is local ONNX, outside customer integration, manual POST /benchmark and default startup run; no paid-provider/DB client. Deployed image contents/baked credentials, external scheduling and actual HTTP reachability remain unverified. Paid-quota bypass absent in inspected source; runtime bypass risk NOT VERIFIED.
- [ ] Obtain live Cloudflare metadata: dashboard requires sign-in; existing Wrangler credential returns HTTP 403 for read-only account metadata. Actual Worker callers/version, Queue/Cron configuration and executor destination remain NOT VERIFIED; Queue gating PARTIAL based on source. Worker DB access is unnecessary if all normal traffic reserves at backend first.
- [ ] Establish all reservation-capable components share the production PostgreSQL primary and verify Render runtime identity/primary without disclosing connection values: NOT VERIFIED. Prior single-Prisma backend evidence retained; no DB checks repeated. Runtime least-privilege grants PARTIAL; no grant changes.
- [ ] Exclude active external reservation-tombstone pruning: PARTIAL; inspected Queue/Cron contains none, accepted backend evidence retained, live external inventory unavailable.
- [x] Record current one-instance/autoscaling-off topology from accepted evidence. Multi-instance certification NOT VERIFIED and N/A for current topology; verify before scaling. Overall shared-ledger certification PARTIAL.

No production data/config/provider changes, tests, benchmark invocation or paid AI calls. Only the two security documents edited; recovery stash retained. Next blocker: authenticated read-only Cloudflare topology/caller metadata and safe runtime DB identity/primary comparison.


### Read-only Cloudflare topology audit attempt — 2026-10-06 (historical; superseded by live certification on 2026-10-07)

**Certification remains PARTIAL.** The authorized Keychain lookup for service `PetalPal Cloudflare Readonly Audit` returned no nonempty credential (exit status 0, empty output); the exact-service fallback also returned no credential. No credential value was printed, logged or persisted. No authenticated Cloudflare inventory could be obtained. This does not establish token validity, scope or live component topology.

Live versions/bindings/callers of `petalpal-ai-dispatch-production` and `petalpal-emotion-ai`, producers/consumers of `petalpal-ai-jobs-production`, active reconciliation/cleanup triggers and other production AI callers remain NOT VERIFIED. Previously inspected source delegation to the gated Render executor, inference-only Worker design and local-ONNX c-lite isolation evidence are retained without repeating code/test/DB/Render checks. Queue gating and c-lite deployed-image isolation remain PARTIAL; same-ledger requirement and normal production gate bypass remain NOT VERIFIED; tombstone retention remains PARTIAL. Pure inference/transport Workers do not need PostgreSQL access when the Render executor reserves before provider calls; the live destination must still be established.

Next blocker: make a nonempty temporary read-only credential retrievable by the current macOS user, then obtain authenticated Worker/Queue/Cron metadata and executor destination. No external configuration, production data, provider, deployment or secret changes were made. Only the two security documents were edited; recovery stash retained.


### Authenticated Cloudflare retry — 2026-10-06 (historical; superseded by live certification on 2026-10-07)

The temporary Keychain credential is now nonempty and Cloudflare token verification succeeds with status `active`. The earlier empty-credential blocker is resolved. Account discovery (`GET /accounts`) returns HTTP 403 / error 9109; targeted local deployment metadata supplies no account ID. No account-scoped Worker/Queue/Cron inventory was reached, so this denial does not establish whether those read permissions work when the correct account ID is supplied. The non-secret PetalPal Cloudflare account ID has been requested; no permission expansion is required merely to bypass account discovery.

Certification remains PARTIAL. Active production AI caller/binding inventory, Queue producers/consumers, reconciliation/cleanup triggers and executor destination remain NOT VERIFIED. Prior source-only Queue gating and c-lite isolation are retained as PARTIAL; same-ledger requirement/normal production bypass remain NOT VERIFIED and tombstone retention remains PARTIAL. No repo analysis, tests, deployment/Render/DB checks or paid AI calls were repeated. No token value was printed or persisted; no production configuration/data changed. Only these security documents were updated.

Next blocker: supply the non-secret Cloudflare account ID, then retry account-scoped read-only topology endpoints with the existing active token.


### Account-scoped Cloudflare retry — 2026-10-06 (historical; superseded by live certification on 2026-10-07)

The supplied account ID resolves the account-discovery prerequisite. Using the nonempty temporary Keychain credential, account-scoped Worker inventory and Queue inventory both return HTTP 401. Direct settings reads for `petalpal-ai-dispatch-production` and `petalpal-emotion-ai` also return HTTP 401 / Cloudflare error 10000. Token verification concurrently succeeds with status `active`: token validity is established, but authorization to the supplied account's topology metadata is not. No token value was printed or persisted, and permissions/configuration were not changed.

**Shared-ledger certification remains PARTIAL.** No live Worker/Queue topology metadata was returned; production callers/bindings, Queue consumers/producers, Cron/cleanup inventory and executor destination remain NOT VERIFIED. Prior source evidence is unchanged: Render backend/executor reserves; inference Worker invokes Workers AI; source Queue delegates to backend. Queue gating, c-lite deployed-image isolation and tombstone retention remain PARTIAL; normal production bypass and same-ledger requirement remain NOT VERIFIED. No repo analysis, tests, deployment checks, Render/DB checks or paid inference were repeated. Only the two security documents were updated.

**Next blocker:** an existing read-only credential authorized to read Worker/Queue/Cron metadata for the supplied account, or correction of the account/credential pairing. The agent made no token-permission or production configuration changes. The earlier missing account ID and empty credential blockers are resolved.


### Live Cloudflare shared-ledger certification — 2026-10-07

**Decision: PASS FOR CURRENT PRODUCTION TOPOLOGY.** This supersedes the earlier Cloudflare-access/topology PARTIAL decisions. Read-only authenticated account-scoped metadata and live deployed Worker source are now accessible. Accepted backend rollout, reservation-before-provider, policy, durable ledger and single-instance evidence were not repeated. No paid inference, tests, Render/DB checks or production changes occurred.

| Live component | PostgreSQL reservation capability | Paid-provider capability | Production boundary |
| --- | --- | --- | --- |
| Render backend / in-process job executor | Create/check via accepted shared Prisma ledger | Invokes inference Worker | Sole reservation-capable production executor |
| petalpal-emotion-ai | Neither; no DB/Hyperdrive binding | Workers AI binding present | Fetch-only; live source denies inference unless server bearer matches configured RENDER_SHARED_SECRET; no Cron/Queue |
| petalpal-ai-dispatch-production | Neither directly | No active AI binding; no inference shared secret | Queue and Cron delegate to the existing gated Render backend |
| petalpal-ai-jobs-production | Neither | Neither | Sole listed producer and consumer are production dispatcher |
| petalpal-ai-dispatch-staging / staging Queue | Neither directly | No AI binding | Separate staging Queue; no active Cron; outside normal production flow |
| c-lite benchmark | Neither in accepted inspected source | No Cloudflare Worker/provider binding in this account inventory | Separate local-ONNX benchmark, outside normal customer integration; accepted startup/manual behavior retained |

**Live topology PASS:** the account Worker inventory contains exactly the production dispatcher, staging dispatcher and inference Worker. Queue inventory is complete (two queues, one page): production Queue producer/consumer both use petalpal-ai-dispatch-production; consumer batch size 1, concurrency 1, three retries. Staging Queue uses only staging dispatcher. Production reconciliation has one active */20 * * * * Cron; inference and staging Workers have no Cron schedules. No additional Cloudflare Worker AI caller or c-lite Worker is listed.

**Queue/executor gating PASS:** production dispatcher binds only its dispatch/executor secrets, executor URL and production Queue. Its live configured HTTPS executor exactly matches the previously inspected production Render deployment target (comparison only; no URL recorded). Live Queue source sends opaque job IDs to authenticated /internal/ai-jobs/{jobId}/execute; Cron only discovers /internal/ai-jobs/dispatchable and enqueues IDs. Neither Queue nor Cron directly invokes AI or accesses PostgreSQL. Although the dispatcher bundle retains inference code, missing AI and inference bearer-secret bindings make that code unavailable as a production paid-provider path.

**Normal customer bypass: NO in the inspected current topology. Same-ledger requirement: PASS.** Accepted normal backend paths reserve before invoking the inference Worker, and all live Queue work returns to that same gated backend/in-process executor. Only that backend creates/checks reservations; pure inference/transport Workers do not need DB access. The inference Worker requires its server-only bearer before provider invocation. Direct invocation by a bearer/provider-credential holder remains a credential-access boundary outside normal customer flow; this certification does not claim a cryptographic reservation proof at the inference endpoint.

**c-lite production isolation PASS for normal customer flow:** accepted separate Render/local-ONNX benchmark evidence plus complete Cloudflare inventory shows no c-lite Worker, provider binding, Queue or Cron integration. Accepted startup/manual benchmark triggering is not a customer production paid-AI path. Deployed benchmark image equivalence/baked credentials and external manual/operator scheduling remain unverified; no benchmark was invoked or re-inspected.

**Tombstone retention PASS for active inspected application/Cloudflare cleanup paths:** the only active Cloudflare Cron performs job discovery/enqueue, with no reservation/tombstone deletion. Queue execution uses backend gating; accepted backend no-pruning evidence remains. This does not certify operator deletion prevention, external retention policies or least-privilege grants.

**Limits retained:** exact Render-runtime-to-inspection DB identity/primary equivalence remains NOT VERIFIED; runtime least-privilege grants remain PARTIAL. Same-ledger PASS concerns the sole reservation-capable production execution boundary, not a new SQL identity/grant check. Accepted current topology is one Render instance/autoscaling off. Multi-instance live certification remains NOT VERIFIED and N/A for current topology; verify before scaling. Broader security/provider issues retain their existing statuses.

Only SECURITY.md and MANUAL_SECURITY_CHECKLIST.md changed. No token value was printed/persisted; no provider/configuration/secret/grant/deployment/production-data changes. Recovery stash retained. Next blocker for this topology certification: none; future scaling and independent runtime identity/grant verification remain separate follow-ups.


### Initial HTTP header/private cache hardening — 2026-10-07 (historical; superseded)

**Historical initial observation: implementation PASS; HTTP acceptance FAIL (superseded by the later marker diagnosis and final clean verification below).** Implementation commit `afa26ab20c9b775f1e0c7dd3e491ac952edf7f31` contains only server middleware/Socket.IO header integration, reusable lib/http-security.js and three targeted test files. Branch remains integration/mobile-backend-test; normal push completed. No schema/migrations, auth/CORS semantics, response payloads, provider settings, credentials or grants changed. Existing recovery stash/unrelated untracked files preserved.

**Policy:** nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin centrally; production CSP uses frame-ancestors none, object-src none, same-origin bundled scripts/assets/API, exact Firebase Auth API/iframe and Google API script origins, explicit same-host wss for Socket.IO. No wildcard or unsafe-eval; production bundle scan found no eval/new Function use. React inline styles require style-src unsafe-inline; scripts do not allow unsafe-inline. Local imagery/data/blob and the specific Google avatar origin are allowed; fonts remain local. Current Docker frontend build supplies only the Firebase API-key argument, with inspected default project/auth domain and same-origin API/socket fallbacks. CSP/HSTS are not enforced in dev. Production HSTS max-age=15552000 requires a secure socket/request or Render's HTTPS ingress signal with RENDER=true; Express trust-proxy is not broadened. No includeSubDomains/preload for this shared hosting domain.

**Private caching:** no-store applied before origin rejection, JSON parsing, authentication and rate limits for API/private namespaces, including dotted/case-insensitive IDs, session, owner Garden/Journal, consent/subscription, memories/report discovery/detail, speech, service job paths and the auth callback. Public root/static assets retain normal public caching. Socket.IO transport receives the same security policies plus no-store without changing auth/CORS/transport controls. Calendar/history still receives owner-authorized Garden/Journal content needed by legacy flows; wire minimization remains open and is not claimed fixed.

**Targeted verification PASS:** 18 tests across http-security, ai-event.route, daily-grow.route, cors-preflight and security-config suites; the six middleware/transport tests rerun after host/classification refinements pass. Actual authenticated fixture responses (including session/private memory/report) assert no-store; anonymous 401, CORS 403, allowed preflight, public/static caching, production/dev HSTS, Firebase/WebSocket CSP and Socket.IO polling are covered. Syntax checks for server/helper/new test and git diff --check pass. No broad/mobile/Fairy or production DB tests run.

**Deployment evidence:** normal Render Manual Deploy → specific commit selected exactly `afa26ab20c9b775f1e0c7dd3e491ac952edf7f31`; deployment reports Deploy succeeded|Live (5m17s), and service Last successfully deployed commit resolves to that exact SHA. Auto-deploy remains disabled; configured root Dockerfile/build context match the inspected entry point. The task introduces/requires no migration; normal npm startup retains the existing migrate-deploy command. No production DB verification or user-data mutation was performed.

**Historical HTTP acceptance FAIL (superseded):** after the initial rollout, safe anonymous HTTPS GET root returns 200/public max-age=0; /ai/reports returns 401 without Cache-Control; /favicon.svg returns 200/public max-age=0. All omit HSTS, CSP, nosniff, frame protection and Referrer-Policy. A second cache-busted/no-cache request set and an independent curl root check reproduce the omissions; sampled CF cache status is DYNAMIC (not proof of general CDN policy). Responses include the existing X-Request-ID but not the new controls. Initial rollout requests timed out; subsequent requests succeeded with the above failures. No safe existing authenticated production session was available; authenticated runtime no-store is NOT VERIFIED, and no session/user state was created. Exact deployed revision is established by Render metadata; HTTP serving behavior is inconsistent with the locally tested committed middleware and was not certified as repaired at that observation; later marker and clean-revision verification PASS.

**Historical blocker, now resolved:** the initial runtime/header discrepancy is superseded by the marker and clean-revision production PASS evidence below. No repeat deployment/restart, environment/configuration change or speculative implementation patch was made after the failed acceptance checks. CDN/cross-user leakage, authenticated runtime caching, wire minimization, Firebase revoke propagation, distributed Socket, provider retention/residency, backups/client copies, runtime DB least privilege, monitoring/alerts and advanced hardening remain scoped open items. Existing shared-ledger topology certification is retained.


### HTTP middleware marker diagnosis — 2026-10-07 (historical; temporary marker removed in clean deployment)

**Production security headers PASS; anonymous private no-store PASS.** Diagnostic commit `688a5f2110f19be57526a09d9609cfe3996caac1` adds only static X-PetalPal-HTTP-Security: v1 at entry to the existing middleware and two response-marker assertions. Security policy, CSP, auth and cache logic are unchanged. Six targeted HTTP-security tests PASS; diff --check PASS. Normal push and Render specific-commit deployment completed; the exact revision is Deploy succeeded|Live (2m50s).

Fresh cache-busted/no-cache anonymous HTTPS GET / returns 200 and GET /ai/reports returns 401. Both contain marker v1, HSTS max-age=15552000, CSP including frame-ancestors none, nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin and an application request ID. Root retains public, max-age=0; private 401 returns Cache-Control: no-store. These observations supersede the earlier HTTP acceptance failure for the current serving revision.

**Case D: prior live observation was stale/old-deployment evidence relative to the now-serving controls.** The marker proves current middleware execution. The specific earlier mechanism (old artifact/runtime versus cached/stale response) remains unproven; no policy correction or downstream configuration change was needed. No further implementation change followed the result, and no diagnostic endpoint was added.

Historical marker-diagnosis limitation (superseded for `/session` by the manual evidence below): authenticated private-route runtime caching was NOT VERIFIED; no authenticated user data or safe session was used at that time. CDN/cross-user leakage and Calendar/history wire minimization remain separate open items, as do existing unrelated security limitations. No paid inference, production data/configuration/grant changes or new migration requirement. Recovery stash and unrelated files preserved. Only these two docs were updated after the marker diagnosis PASS; that diagnosis task created no docs commit. Final cleanup/documentation is recorded below.


### Final clean production HTTP security verification — 2026-10-07

**PASS for security headers, anonymous private no-store and intentional public/static caching.** Cleanup commit `219b7ef09ab74c3f781b013f307ee8f2f62f6632` removes only X-PetalPal-HTTP-Security: v1 and its two test assertions; HSTS/CSP/nosniff/frame/referrer and cache policy are unchanged. Six targeted HTTP-security/cache tests PASS without the marker; diff --check PASS. Branch remains integration/mobile-backend-test; normal cleanup push completed. Render Manual Deploy → specific commit reports this exact SHA Deploy succeeded|Live (2m35s).

Fresh cache-busted HTTPS requests with Cache-Control: no-cache observe: root / = 200, /favicon.svg = 200, anonymous /ai/reports = 401. All three retain HSTS max-age=15552000, CSP including frame-ancestors none, X-Content-Type-Options nosniff, X-Frame-Options DENY and Referrer-Policy strict-origin-when-cross-origin. Diagnostic marker is absent on all three. Private AI 401 returns Cache-Control: no-store; root/favicon retain public, max-age=0. The temporary marker diagnosis is complete and the clean production implementation passes. Earlier FAIL observations were stale/earlier-deployment observations and are superseded; the specific earlier staleness mechanism is not claimed proven.

**Historical limits at this clean-header verification (superseded for /session by later manual evidence):** authenticated owner-private no-store was then NOT VERIFIED because no existing safe test session was available; no production user/session state was created or private data accessed. Accepted authenticated fixture regressions remain valid. CDN/cross-user leakage is not certified from these request samples. DELTA-P2-4 Calendar/history wire-data minimization remains open; no payload/API redesign occurred. Runtime DB least privilege, future multi-instance verification and unrelated Firebase/Socket/provider/backup/monitoring limitations remain separate.

No paid AI, production-data or provider/configuration/grant changes; no schema/migration changes or new migration requirement. Recovery stash and unrelated files preserved. Final documentation reconciles the prior uncommitted marker-PASS evidence and clean deployment; only SECURITY.md and MANUAL_SECURITY_CHECKLIST.md belong in the documentation commit.


### Authenticated private-cache runtime follow-up — 2026-10-07 (historical; /session blocker superseded by manual evidence)

**BLOCKED — MANUAL SESSION REQUIRED.** No existing safe authenticated production test session was available: no open application browser session, no local .env.auth-e2e.local test credential file and no configured auth-test credential/token/session in the process or inspected local .env key names. No credential values were printed. The existing central private no-store implementation and prior scoped production anonymous/header PASS evidence are retained; anonymous 401 was not reused as authenticated evidence and already completed verification was not repeated.

Authenticated routes checked: none. Authenticated Cache-Control no-store, repeated-request cache behavior, CDN/proxy HIT status, CF-Cache-Status, Age/reuse and cross-account runtime isolation remain NOT VERIFIED. No second safe test account/session was available. Global CDN behavior is not certified; missing session evidence is not an observed caching defect or proof that provider configuration must change.

No authenticated production request, private response body read, account creation, user/session mutation, paid AI, implementation/test change, deployment or provider configuration change occurred. No tests run. Only SECURITY.md and MANUAL_SECURITY_CHECKLIST.md updated; diff --check performed, no staging/commit/push. Recovery stash retained. DELTA-P2-4 Calendar/history wire-data minimization remains separate.

Next blocker: provide an existing safe test account/session through the normal authenticated test workflow, with credentials handled in-process rather than pasted into chat. Then perform two header-only requests to a read-only owner-private GET route (prefer consent/settings or report discovery; avoid /session's existing upsert), and optionally test a second existing safe account. No new production account/state is authorized by this follow-up.


### Manual authenticated production cache evidence — 2026-10-07

**Authenticated private-route no-store PASS; repeated-request cache behavior PASS for GET /session only.** Evidence is the user's completed manual production observation, recorded without repeating tests or repo analysis: two fresh authenticated GET /session requests returned HTTP 200, each with Cache-Control: no-store and CF-Cache-Status: DYNAMIC. Neither had an Age header; CF-Ray values were distinct, and production security headers remained present. No tokens, cookies, IDs or private response bodies are recorded.

**CDN/shared-cache HIT observed: no. Age reuse: none observed.** These are scoped observations from two requests, not proof of global CDN policy or origin execution on every request. Distinct CF-Ray values identify separate edge requests; they do not prove cross-account isolation. Cross-account cache isolation remains NOT VERIFIED. /ai/reports authenticated cache behavior and other routes were not supplied as evidence. Earlier manual-session blockers and /session runtime NOT VERIFIED statements are superseded for this route by this evidence.

**Historical pre-minimization note (superseded by DELTA-P2-4 implementation/session evidence below):** Global CDN/provider rule coverage and cross-account behavior remain separate limitations. DELTA-P2-4 Calendar/history wire-data minimization remained open at this earlier step; no payload/API or implementation change had yet occurred. Only SECURITY.md and MANUAL_SECURITY_CHECKLIST.md updated, no test/production request repeated and no staging/commit/push.

### DELTA-P2-4 owner metadata minimization — 2026-10-07

Implementation `187701de1fd810127b4b25b998af3a23bf0c8a3c`: owner Garden placements/history request `/users/:userId/garden?view=metadata`; mobile session hydration and flower-session identity request `/session?view=metadata`. Verified-token ownership is enforced; forged owner/extra parameters are rejected. Explicit Prisma projections and serializer allowlists exclude raw Journal/Event text, AI evidence/intensity/confidence, messages, generation seeds, full check-in/Garden relations and account IDs. History retains consumed flower display fields/secondary label strings, dates and navigation IDs; session retains profile/onboarding/check-in identity and status. Metadata reads do not create Garden/Fairy state. Existing full-detail and social responses remain intact.

Targeted regressions PASS: 20 test executions covering metadata exclusion/authorization/no-store, Garden serialization, saved report discovery, affected Daily Grow/legacy session/Garden behavior, calendar dates and mobile adapters/session callers. Changed JavaScript/TypeScript syntax and diff checks PASS. Central private-cache middleware remains in use; public/static cache policy unchanged.

Exact implementation `187701de1fd810127b4b25b998af3a23bf0c8a3c` confirmed Deploy succeeded / Live on Render; deployment presence PASS. Manual authenticated `/session?view=metadata` production shape/no-store PASS is recorded below. Owner Garden metadata shape/cache acceptance and Calendar/history screen/navigation runtime remain NOT VERIFIED on the Expo/mobile consumer. Existing user-supplied authenticated legacy `/session` cache evidence remains PASS for those two observations only. Global CDN rules, other authenticated routes and cross-account isolation remain NOT VERIFIED. Previous DELTA-P2-4 open-wire statements are superseded for these implemented mobile metadata paths; no claim covers every private endpoint or other clients. No DB/schema/migration change, paid AI, production user mutation or provider configuration change. Recovery stash retained.

- [ ] With an existing safe authenticated session, inspect metadata response keys only for both metadata modes: HTTP 200, no-store, required IDs/dates/display fields, absent raw text/private inference/details. Do not log private values.
- [ ] Check owner Calendar/history navigation and full-detail screen behavior with that session; retain separate cross-account/CDN acceptance limits.

### Manual production session metadata evidence — 2026-10-07

User-reported authenticated `GET /session?view=metadata`: HTTP 200, `Cache-Control: no-store` PASS, required session metadata present. Raw Journal text, AI inference/evidence and private messages absent; no unnecessary internal/account IDs observed. `CF-Cache-Status: DYNAMIC` observed for this response only. Production metadata-shape verification PASS for this session metadata route; its earlier runtime NOT VERIFIED status is superseded by this evidence. No response values, credentials or private content recorded; no requests or tests repeated.

Owner Garden `GET /users/:userId/garden?view=metadata` production shape/cache acceptance, Calendar/history screen loading and intended-item navigation remain NOT VERIFIED. Overall DELTA-P2-4 production acceptance remains PARTIAL. Global CDN behavior, cross-account cache isolation and unrelated routes remain unverified. No production data modified; no implementation/configuration change. Documentation only; not staged, committed or pushed.


### Isolated native-security provider/access readiness — 2026-10-07

**Isolated provider/account preparation PASS; intended-device readiness PARTIAL.** The user provided an authorized test-project Admin credential through the existing owner-only/Git-ignored mechanism. Exact `petalpal-native-security-test` project/type checks, live Admin/Auth reads, enabled Email/Password provider and registered client-app field provenance PASS. A/B/C were provisioned only in that project and mapped to empty profiles/gardens in the dedicated isolated PostgreSQL DB. Saved credential authentication/test token identity and HTTPS backend session/metadata linkage PASS for all three; no private fixtures and C remains undeleted. No production Firebase account/credential inventory, project membership, MFA, key revocation, production DB/provider configuration or billing action was changed.

Temporary isolated HTTPS and separate Expo 8108 are active; Mac TLS and effective isolated client/backend configuration PASS. Intended iPhone/network anonymous health is **NOT CHECKED**, per the user's reply; see MOBILE.md N for the single remaining check and current endpoint. This is new test-project access/provisioning/readiness evidence, not native persistence/backup/attestation, production auth/cache/CDN or seven-scenario acceptance. All seven scenarios remain NOT EXECUTED; test failure/hold/sentinel hooks remain unarmed. Historical production/manual statuses and SECURITY canonical counts are unchanged.


### Isolated intended-iPhone HTTPS readiness confirmation — 2026-10-07

**USER-OBSERVED PASS:** the user confirms all three isolated health fields match and there is no certificate warning on the intended iPhone/network. This supersedes the preceding NOT CHECKED phone-transport status and closes the final environment-preparation gate: **environment READY**. Anonymous Mac HTTPS identity/session-401 and listener rechecks PASS; no credentials/account actions or tests repeated. Seven native lifecycle scenarios, native persistence/backup/attestation and production/provider acceptance remain NOT VERIFIED; storage fault/hold/sentinel hooks remain unarmed. No production configuration/data mutation or service restart. Canonical SECURITY statuses/counts unchanged; current workflow in MOBILE.md N.

## HISTORICAL / SUPERSEDED — Isolated native scenario-1 incident follow-up — 2026-10-07

**Historical record only:** this incident follow-up and the automated workflow/Scenario-1 failure entries below are superseded by persisted Scenario-1 logout witness PASS and isolated physical-iPhone scenarios 1–7 PASS. Only authorized disposable C was deleted; A/B were preserved, failure injection was disarmed and production was untouched. Original evidence, checkbox states and point-in-time instructions are retained; no crash/sysdiagnose investigation or rerun remains active.

- [ ] Retrieve read-only iPhone diagnostic evidence for the USER-OBSERVED runtime/DevTools disconnect after the exact-A scenario-1 runner invocation: matching Expo Go/Exponent crash or JetsamEvent report timestamp, exception/termination type/reason and top crashed-thread function names. Do not record account/device identifiers, credentials or private payload. Apple reference: https://developer.apple.com/documentation/xcode/acquiring-crash-reports-and-diagnostic-logs.
- Current state: isolated 8108 alone reopened; USER-OBSERVED signed-out cache snapshot has zero durable keys/records and no memory cache, ready/successful startup cleanup, no pending erasure, fault null and hold false. Startup cleanup prevents treating this as proof of the original logout result. Scenario 1 remains INCONCLUSIVE / POSSIBLE RUNTIME FAILURE; no native acceptance/status upgrade.
- Keep signed out; do not rerun the runner or advance to scenario 2/C deletion while the incident is unresolved. C deletion was not attempted; other scenarios remain unexecuted. No provider/platform storage/backup verification status changed. This new manual follow-up is limited to the actual native runtime interruption; prior provider evidence and limitations are retained.

Follow-up result: the user checked and found no matching Expo Go/Exponent/JetsamEvent report; timestamp, termination metadata and crashed-thread functions are unavailable. Report absence is not a PASS. Clarify only the destination screen already observed at disconnect; do not reproduce the incident or advance to C deletion while this diagnosis is pending.

Incident clarification — 2026-10-07: iPhone Home Screen appeared and Expo Go exited (USER-OBSERVED); cause remains F / insufficient evidence. Next manual diagnostic: capture iPhone sysdiagnose using https://developer.apple.com/bug-reporting/profiles-and-logs/ while staying signed out, without reproducing logout. Inspect only a retained incident-time Expo Go/Exponent process-exit record; report timestamp and termination reason/subsystem only. Do not upload the full archive/private identifiers. No native security/platform verification status changes; C and later scenarios remain untouched.


## HISTORICAL / SUPERSEDED — Automated isolated native workflow replaces incident follow-up — 2026-10-07

The user closes historical crash investigation and authorizes a separate automated test-only run. The preceding sysdiagnose/crash follow-up is no longer an active task; no retained sysdiagnose finding has been supplied. Historical scenario 1 remains INCONCLUSIVE / F: insufficient evidence. This is a workflow change, not native/provider acceptance; prior evidence and canonical counts are preserved.

- [ ] Open isolated Expo 8108, sign in as saved isolated A once, and tap **Run native security verification** once (MOBILE.md P). The persistent test screen executes/resumes all seven scenarios, including authorized normal product deletion of disposable isolated C only. If the app closes, reopen 8108; no repeated DevTools pasting is needed.
- [ ] Read only the sanitized final on-device scenario statuses. FAIL/BLOCKED stops without destructive retry. Startup cleanup is not logout proof; absent C without its original local cleanup checkpoint is not a PASS. Do not substitute A/B or recreate C to continue.

Nineteen targeted mocked harness/bridge tests and changed-scope type/syntax checks PASS; live isolated HTTPS bridge denies anonymous access with no-store. The seven new physical-device scenarios remain unexecuted, C is not deleted, fault injection is prepared/unarmed, and production/provider/platform storage/backup verification statuses are unchanged. One initial A sign-in is required to authorize safe access to saved test credentials. The planned app reload resumes automatically; the only manual recovery action is reopening isolated 8108. No production request/data/configuration change, stash/ref change or commit/push.


### HISTORICAL / SUPERSEDED — Automated Scenario-1 phone result — 2026-10-07

The user reports the first automated isolated-phone run ended **Scenario 1 FAIL** after `ready`, the one-record fixture, and `logout-pending`; no `logout-completed` checkpoint was recorded. Scenarios 2–7 did not start; A/B/C were not deleted and C remains untouched. The failure row contained synthetic empty defaults and did not preserve the failed native-state subproperty. This is a real manual runtime result, not a provider-status change.

A focused native-adapter regression reproduces a harness timing race when Firebase's sign-out observer queues a second placement-scope cleanup before the original logout witness inspects state. It leaves storage unready, cleanup result unset and erasure pending during that inspection. The harness now waits boundedly for native cleanup quiescence inside the original logout callback and records only allowlisted failed checks. Product logout/cache behavior is unchanged. Classification B is most likely; the phone's exact failed subproperty remains unavailable. The historical DevTools exit remains INCONCLUSIVE and was not reinvestigated.

One isolated-button action is prepared for a Scenario-1-only rerun. It uses a separate sanitized journal, terminates after Scenario 1, and cannot start scenario 2 or delete C. It has not been triggered. Seven directly relevant tests and changed-scope TypeScript checks PASS. No provider/manual verification or canonical security status/count changed.

### Identified Scenario-1 physical acceptance — 2026-10-07

- [x] USER-OBSERVED isolated 8108 generation-1 Scenario-1 PASS, independently verified by the agent from the persisted native journal. Its sequence includes preparing, ready, one-record fixture, logout-pending, clean logout-completed, verification and PASS. The logout callback's witness precedes verification/PASS; startup cannot supply it. Final PASS timestamp: 2026-10-08T04:39:18.659Z.
- Historical manual INCONCLUSIVE and original automated FAIL remain retained as superseded evidence; they are not retrospectively upgraded.
- [ ] Scenarios 2–7: newly authorized for automatic sequential continuation, with deletion of only isolated disposable C. They remain unstarted at this entry because native authorization handoff is blocked by the connection. A/B/C are preserved so far; production untouched. Reopening/keeping isolated 8108 awake is the only connection-recovery action; no Scenario-1 rerun or manual DevTools JavaScript is required.

This is native Scenario-1 runtime acceptance only. Provider configuration, Firebase SDK credential-store/backup/root/release claims and canonical security counts are unchanged.

### Isolated physical continuation acceptance — 2026-10-07

- [x] Scenario 2: persisted native account-delete erasure PASS, including clean original logout witness and remote-deleted before PASS (2026-10-08T06:19:13.698Z). Only disposable isolated C was deleted; provider and database independently confirm its absence.
- [x] Scenario 3: persisted A → B isolation PASS (06:19:15.762Z).
- [x] Scenario 4: persisted late-write fencing PASS (06:19:16.901Z).
- [x] A and B independently confirmed present in the isolated provider and database after C deletion.
- [ ] Scenarios 5–7 remain unaccepted. Original Scenario 5 BLOCKED after planned reload/service authorization invalidation is retained. Separate 5–7 recovery is active; native Expo bootstrap failure currently prevents reading its result.

Earlier entries describe their historical point in time and remain unchanged. Production/provider configuration and canonical counts are unchanged. No Scenario-1 rerun or C recreation/repeated deletion is authorized by recovery.

### Remaining physical acceptance completed — 2026-10-07

- [x] Scenario 5 reload persistence: persisted recovery PASS at 2026-10-08T06:32:31.817Z, with original pre-reload logout witness and independent durable first-startup pre-cleanup observation true. Original blocked attempt remains historical.
- [x] Scenario 6 global preference preservation: original logout witness retains the preference; test preference subsequently removed; PASS at 06:32:33.416Z.
- [x] Scenario 7 storage-failure fail-closed: failure-observed → failure-safe → recovered → PASS at 06:32:35.270Z. Final native inspection independently confirms fault injection disarmed, no held write and clean durable/memory caches.
- [x] Final isolated provider/database checks: A/B present in both, disposable C absent in both. No production activity.

Together with accepted Scenario 1 and scenarios 2–4 above, all seven isolated Expo Go physical-runtime scenarios PASS. The user fully closed/reopened Expo Go to restore missing native modules; saved recovery resumed without manual JavaScript/account switching or repeated deletion. Earlier snapshots remain historical. Secure credential-store, backup/root and production-release claims remain open; canonical security counts are unchanged.

### Native Firebase credential review: remaining manual gate — 2026-10-07

Source/package review establishes the JS-SDK/AsyncStorage mechanism and intended default exclusion, not an observed backup or restore. The unchecked release/platform item above is narrowed accordingly; no provider setting, device backup, restore or migration was verified/changed. Before claiming release acceptance, verify effective compiled storage/Info.plist and actual file protection/exclusion, then isolated iCloud/local backup and new-device behavior. Historical pre-logout copies may retain refresh credentials; app sign-out cannot erase those copies or revoke every provider session. Keep only sanitized status evidence. Existing 7/7 PetalPal-owned cache acceptance, C deletion, A/B preservation and prior provider evidence remain unchanged.


## Logging-only candidate read-only preflight — 2026-10-08

- [x] Current Render metadata/settings: PetalPal_v2 Live is exact `d510b1ff97902704721060b4c1261657be3e4b76` (dep-db40qshsrm7s73agbdn0); Docker/Free, source main, root default, ./Dockerfile/context ., no Docker Command override, auto-deploy Off and PR previews Off. Environment names inspected only; no values revealed or controls changed. PASS for provider metadata, not DB/runtime readiness.
- [ ] After separate exact-candidate deployment approval: perform only the three synthetic anonymous/read-only GETs and scoped application-log check defined in SECURITY.md's Logging-only production preflight. Capture X-Request-ID/status/no-store and redaction pass/fail metadata; no real token/account/private content, writes or paid AI. UNKNOWN if logs/correlation unavailable; request a rollback decision on regression. NOT EXECUTED. Current secret/config equivalence and DB schema drift remain unverified; SAFE TO DEPLOY remains NO.

### Final logging-only attestation clarification — 2026-10-08

- [x] Relevant Render configuration comparison PASS: production mode, service-account JSON shape and configured/credential project equality checked only in memory; no linked environment groups. Values were not recorded; masking restored. Supersedes the earlier masked-value limitation only within this scope; no provider settings changed.
- [ ] Predeployment: obtain dated non-secret read-only production migration history (applied names/checksums, no failed/unfinished migrations) and schema compatibility/drift status for the unchanged candidate. Existing authorized connection unavailable; no retry or speculative connection. READY FOR DEPLOYMENT APPROVAL remains NO.
- [ ] Postdeployment only: retain the existing three-request synthetic logging acceptance plan, to execute after separately approved exact-candidate deployment. Production observations are not required before deployment; this acceptance is still mandatory afterward. No deployment or request executed.


### Logging-only migration evidence supplied by user — 2026-10-08

- [x] User-observed: Render/Console connection URL match and Prisma Studio aggregates 25 total/completed, 0 unfinished/rolled back. No secret values recorded; database identity not independently verified.
- [ ] Return the four sanitized columns from SECURITY.md's minimum SELECT-only migration query through the existing authorized Console: migration_name, checksum, completed, rolled_back (all rows), plus observation date. Candidate expected 25-name/SHA-256 manifest prepared; current production comparison remains UNKNOWN.
- [ ] Actual production schema drift remains UNKNOWN without a current read-only schema/catalog comparison. Migration ledger equality alone is insufficient. Unchanged candidate/deployed source contracts PASS; no new database access, migration or provider action. Separate release approval and existing postdeployment logging acceptance remain required.


### User-observed production migration fingerprint — 2026-10-08

- [x] Exact candidate `1f8d0f98fb16b9553ae03c474f5952c808928e48` migration fingerprint comparison PASS: 25 migrations, local `94ad63fffa56c1c0e38db364b44ab88e`, user-observed production `94ad63fffa56c1c0e38db364b44ab88e`. Original-byte SHA-256 per SQL file, ascending names, newline-joined `name:checksum` without trailing newline, then MD5. User reports URL equality and 25 completed / 0 unfinished / 0 rolled back; production identity not independently verified.
- [ ] Current production schema drift/compatibility remains UNKNOWN without independent read-only schema/catalog evidence; matching migration history alone cannot certify it. No release approval or provider action; preserve separate postdeployment logging acceptance.


### Authorized logging-only deployment stopped — 2026-10-08

- [x] Fresh read-only Render target/live SHA and recorded deployment settings precheck matched the approved service and prior production `d510b1ff97902704721060b4c1261657be3e4b76`; dedicated candidate branch resolves to approved `1f8d0f98fb16b9553ae03c474f5952c808928e48`. No settings modified.
- [ ] Deployment not triggered: a browser DOM snapshot exposed Firebase service-account JSON/private key despite restored visual masking. Agent stopped and closed the tab; do not copy secret material. Separately authorize provider credential rotation/revocation and configuration revalidation before resuming deployment. No provider credential changes performed.
- [ ] Candidate startup/migration and three-request production/logging acceptance not executed; operational redaction UNKNOWN. No rollback/redeploy/retry or commit/push. Prior known-good production SHA retained; historical and canonical statuses/counts unchanged.


### Firebase snapshot exposure containment status — 2026-10-08

- [x] Full private-key serialization confirmed in the existing agent tool output and this task's local session record via shape-only checks; no raw values returned. Local session access restricted to its owner; history retained. Scoped changed-doc/owned-release-artifact checks found no separate plaintext credential artifact or incident commit. Secret UI remains closed; no provider action performed.
- [ ] REQUIRED human/provider action: securely replace Render's Firebase Admin credential and revoke the exposed IAM service-account key; revalidate production configuration/authentication before resuming deployment. Never paste credentials into chat or expose them to snapshots. Rotation/revocation not performed or verified.
- [ ] Existing local trace still contains the credential; remote retention/additional copies UNKNOWN. Use supported retention/redaction controls if needed, preserving sanitized audit evidence. No erasure claim; cleanup alone does not substitute for revocation. Deployment remains blocked; previous production SHA unchanged.

## Firebase old-key retirement — status correction, 2026-10-08

- [x] October 8 replacement created, Render updated and production authentication working: USER-CONFIRMED only; no new deployment/authentication test.
- [ ] August 25 key: user reports still listed; enabled/disabled state, remaining consumers and deletion NOT VERIFIED.
- [ ] September 25 key: user reports still listed; enabled/disabled state, remaining consumers and deletion NOT VERIFIED.
- [ ] Exact exposed-key identity UNKNOWN. Earlier deletion/unused-key PASS is historical, not current closure; key age and working Render login cannot resolve the mapping.
- [ ] Human-only: attest consumers/replacement coverage using non-secret metadata; prioritize any safely identified compromised key, otherwise a confirmed migrated/unused key (August 25 then September 25 only if equally established). Disable one, verify fresh authenticated operation and relevant job/cache cycles, delete when no longer needed, repeat. Preserve the October 8 key/service account. Do not re-enable a suspected compromised key to recover a consumer. Follow SECURITY.md's scoped sequence and official references; do not share key identifiers, fingerprints, credentials or raw logs.
- [ ] Prior trace retention and unauthorized historical use remain UNKNOWN. No trace reopened or evidence erased.

Existing inventory/attestations and canonical counts retained. No provider action or status independently verified, credential read, production mutation, repeated test, commit or push. MOBILE.md unchanged.

### Old-key Active-status clarification — 2026-10-08

- [ ] User now explicitly reports both older Firebase Admin keys (August 25 and September 25) **Active**. This supersedes the preceding UNKNOWN-enabled-state entries, not their history. Neither retirement nor exact compromised-key identity/revocation is verified; prior deletion PASS is superseded.
- [x] October 8 replacement functionality remains USER-CONFIRMED PASS only.
- [ ] Production-release approval remains blocked on human-only retirement confirmation; credential-free candidate CI may proceed. Keep the existing retirement procedure, never inspect keys/trace, and do not disable/delete anything in this task.

No independent provider observation or mutation, test rerun, changed mobile procedure or canonical-count change. Routine CI results are recorded only in SECURITY.md.

### Firebase old-key retirement — latest user confirmation, 2026-10-08

- [x] August 25 old key **DELETED** — USER-CONFIRMED provider evidence only.
- [x] September 25 old key **DELETED** — USER-CONFIRMED provider evidence only.
- [x] October 8 replacement **RETAINED** — explicitly USER-CONFIRMED; retention is not independent proof of enabled state or current functionality.
- [ ] Current production credential readiness **UNKNOWN**: authentication previously worked with the replacement, but the user explicitly reports it has not been retested after old-key deletion.
- [ ] Exact exposed-key identity, historical unauthorized use and prior tool-trace retention remain **UNKNOWN**. No investigation repeated; no trace or credential inspected.

This supersedes the preceding Active/open-retirement statuses without erasing their historical scope. Both dated keys' retirement is now user-confirmed complete; no independent provider verification or agent key action occurred. The user additionally reports intended Firebase Web App/project binding and deployed API/Socket configuration NOT YET VERIFIED; intended origin is `https://petalpal-v2.onrender.com`, with same-origin routing SOURCE-LEVEL PASS only. Production approval remains open for these distinct gates. Canonical counts unchanged.

### Post-retirement production sign-in — USER-CONFIRMED PASS, 2026-10-08

- [x] After deleting the August 25 and September 25 keys and retaining the October 8 replacement, the user signed in to `https://petalpal-v2.onrender.com/` and entered the existing Garden. **Current deployed production authentication PASS — user-confirmed only**, superseding the preceding not-retested/UNKNOWN status. No independent provider or fresh credential-acquisition verification.
- [ ] Undeployed unified Expo Web candidate Firebase/public API/Socket binding remains NOT VERIFIED; this confirmation does not close that separate gate.
- [ ] Historical exposure records, exact exposed-key identity uncertainty, unauthorized historical use and prior trace-retention uncertainty remain unchanged. No credential inspection, repeated investigation, provider mutation or changed canonical counts.

### Corrected local Garden preview — user visual recovery confirmation, 2026-10-08

- [x] **USER-CONFIRMED:** successful sign-in to the corrected synthetic preview and restoration of previously missing Garden artwork and overall appearance, with artwork fix `57bc31c`. Applies only to the inspected local preview; no independent production/provider or full visual/performance verification is inferred.
- [ ] Matched-reference performance parity remains **PARTIAL**. Candidate production Firebase/public build binding remains **UNKNOWN**. Prior provider/authentication and exposure records remain unchanged.


## 2026-10-09 — Cloudflare frontend migration: new human gates, none performed

- [ ] Separately approve publishing the local migration branch and staging a dedicated protected preview Worker; no existing AI Worker may be reused.
- [ ] Configure the manual build environment with the existing public Firebase Web App settings and required reviewers. Never provide Admin credentials to the frontend build.
- [ ] Confirm an exact compatible Live backend revision; prepare the externally built transition image retaining its frontend before real-auth preview. Do not assume the old Live backend supports the new UI.
- [ ] Separately approve the exact preview Firebase Authorized Domain and Render CORS origin while preserving existing entries; validate email-verification return behavior and a fresh browser sign-in.
- [ ] Human-check Garden/flowers, Fairy, Calendar, Bookhouse/Journal, navigation, login/logout and Socket reconnect through the real provider edge.
- [ ] Separately approve app.jastrevia.com DNS/custom-domain and Firebase/CORS changes; retain jastrevia.com, Render traffic and AI Workers. No redirect or automatic production deployment.
- [ ] Approve the disposition of old-origin users and an independent frontend/backend rollback before selecting the backend-only image on Render.

Procedure and limitations: `docs/cloudflare-web-migration.md`. No checklist item
above is satisfied by the synthetic local tests. Existing Firebase attestations
are retained, not replaced; no provider settings, credentials or private logs read.

### Static-only preview clarification — 2026-10-09

- [ ] Approve a dedicated static-only preview upload/resource separately; use
  `wrangler.preview.jsonc`, the synthetic artifact and reviewer-only Access before
  enabling a URL. Keep alternate/version URLs disabled. This stage needs **no**
  production Firebase Authorized Domain, Render CORS, DNS or real credentials.
- [ ] Restore retained-image readability on an isolated healthy Docker host under
  separate human maintenance authorization; preserve existing containers/recovery
  state. Then validate runtime and transition frontend retention before Render
  cutover. Current image inspection still fails despite restored disk capacity.
- [ ] Real-auth preview still requires the earlier compatibility, exact-origin and
  human login/Garden gates. Keep Render web/login until replacement activation
  and approved old-origin traffic disposition; backend-only Render is last.

Exact local/offline and separately approved provider steps are in
`docs/cloudflare-web-migration.md`. No provider/manual item was performed here.

### Protected synthetic staging authorization — 2026-10-09

- [x] User approved one new `petalpal-expo-synthetic-9a9d57d` Worker, scoped Access
  and one upload; only `xma38@jastrevia.com` may be an Access reviewer.
- [x] Non-secret CLI metadata identifies the existing administrator's single
  account `6007e20c3aa7e88753689744021afb00`, confirms the three protected AI
  Workers there, and returns not-found for the new staging name.
- [ ] Human with Access-management permissions must complete and verify the
  exact-host/all-path policy. Current CLI scopes do not advertise that capability;
  no Access connector is available. Do not include the administrator email.
- [ ] Worker creation/upload, URL enablement, anonymous asset denial and authorized
  synthetic Garden edge checks are NOT PERFORMED. Follow the latest runbook's
  disabled-at-creation sequence; keep all viewing URLs disabled until verified.

No additional deployment approval is requested. Existing production resources,
Firebase, DNS, Render and Docker remain unchanged; no staging URL exists yet.

### Protected preview now uploaded — 2026-10-09

- [x] Human reports Worker creation, all-traffic Access for only
  `xma38@jastrevia.com`, OTP/Hello World PASS, preview URLs OFF, no custom domains.
- [x] Authorized single synthetic upload activated; anonymous HTML/deep link/JS/
  Garden image/WASM/fixture script independently confirmed Access-protected (302).
- [x] 2026-10-09: reviewer reports “Garden opens successfully” after the requested
  Access/synthetic sign-in flow — USER-CONFIRMED PASS, closing the prior pending item.
  Use only the public synthetic fixture; never share OTPs, cookies or tokens.

URL and version/deployment evidence are recorded in the migration runbook. This
supersedes prior not-created/not-uploaded status without changing historical scope.

### Storage recovery and backend transition gates — 2026-10-09

- [ ] Separately approve maintenance quiescence/Colima shutdown and adequate
  external recovery storage; human verifies a consistent cold copy before any
  offline filesystem repair or restart. Current guest ext4 metadata records EIO.
- [ ] After safe recovery, validate retained backend/transition container runtime.
- [ ] Identify the actual Live Render frontend artifact and supported delivery
  mechanism for the existing service; retain login/web in the transition image.
- [ ] Verify no pending migrations and existing provider readiness without values;
  approve exact rollout/rollback artifacts separately. Real CORS/Firebase/Socket
  integration and old-origin disposition precede backend-only deployment.

These gates are unperformed. No stop, repair, DB/provider change or deployment
occurred; previous synthetic staging confirmations remain valid in their scope.

### Parallel backend-only test service — 2026-10-10

Owner decision supersedes the in-place `Dockerfile.transition` items above for
`PetalPal_v2` (retained as history); that service and its Vite frontend stay unchanged.

- [ ] Confirm `PetalPal_v2` Auto-Deploy is OFF or not tracking `main`, and that no
  Render/Cloudflare GitHub integration deploys on `main` pushes (GitHub cannot show hooks).
- [ ] Make "Protect main" target `main` (it currently matches no branch) and require
  the PetalPal security regression checks before merging.
- [ ] Provision an isolated test PostgreSQL and isolated test Firebase project; create
  `petalpal-backend-test` per `docs/render-backend-test-service.md`. No production
  credentials, Worker tokens or database may be reused.

### Isolated integration environment — consolidated human actions, 2026-10-10

Nothing below has been performed. Details: `docs/render-backend-test-service.md`.
Cost shown is what each item can add; confirm current plan pricing before approving.

- [ ] **Firebase (test):** create a separate test project (Spark/free) with Email/Password auth, a Web App and a service-account key. Enter the key only in the Render dashboard; never in Git, chat or logs. Add the Cloudflare test origin to Authorized Domains once known.
- [ ] **PostgreSQL (test):** create a separate database named with `integration` or `test`. Cost: a free tier if the provider offers one, otherwise a small paid instance (needs approval).
- [ ] **Render (test):** one new Web Service from `Dockerfile.backend`, Auto-Deploy OFF, Docker command override and environment variables exactly as in the doc. Cost: free instance (sleeps, cold starts) or the smallest paid instance (approval needed). Reuse nothing from `PetalPal_v2`.
- [ ] **Cloudflare (test):** one Worker `petalpal-web-integration` (free plan) behind reviewer-only Access with the URL disabled until verified, deployed with the two `--var` values. Set GitHub environment `petalpal-web-build-integration` (variable `CLOUDFLARE_API_ORIGIN`, four public `EXPO_PUBLIC_FIREBASE_*` secrets of the TEST Web App), then run the manual build workflow with `integration_config`.
- [ ] **Approve** the exact commit/branch for the test service, then run the real-auth REST/Socket checks with a test identity.
- [ ] Carried over, unchanged: confirm credential recovery (exposed Firebase key revoked) and the production `TRUST_PROXY` value.

### Render TEST provider status observed — 2026-10-09

This supplements the historical not-created preparation records above.

- [x] Existing `petalpal-backend-test` (`srv-db4q7bflk1mc73fkuf90`) is present on Render: Docker Free, `JX-Technologies-Inc/Petalpal`, `main`, `./Dockerfile.backend`. Its first deploy `dep-db4q7bnlk1mc73fkugc0` failed with exit 127 at commit `de2a83e8284181111c0c9fa3434f8a107be5b760`.
- [x] Owner reports dedicated Firebase `petalpal-integration-test`, Prisma Postgres resource `petalpal_integration`, and TEST Auto-Deploy OFF. Resource creation attestation is preserved separately from service credential-binding verification.
- [ ] Confirm TEST credential bindings and actual configured environment-variable names without values or credential-page snapshots. Do not use database emptiness as resource identity proof.
- [ ] Save the corrected TEST Docker Command only after isolation verification; perform at most the one authorized controlled redeploy, then verify migrations, readiness, isolated auth and safe HTTP responses. No configuration save, redeploy or database operation occurred in this task.

### TEST credential bindings personally verified — 2026-10-09

- [x] Owner personally confirms TEST database and Firebase credential bindings: PASS, with no secret values shared. In this task's scope these bind `petalpal-backend-test` to Prisma `petalpal_integration` and Firebase `petalpal-integration-test`. This closes the binding-attestation part of the previous open item; actual environment-name inventory is not newly asserted.
- [ ] After the startup-script PR and required CI pass, verify deployment-trigger safety and select a commit containing the script before any TEST redeploy. Use `/bin/sh /app/scripts/start-integration-backend.sh`. No new Render or database action performed.

### TEST redeploy gate after handoff — 2026-10-10

- [ ] Owner directly reconfirms (secret-free PASS/FAIL) that `petalpal-backend-test`'s `DATABASE_URL` is the direct string generated from Prisma `petalpal_integration` and its `FIREBASE_SERVICE_ACCOUNT_JSON` belongs to `petalpal-integration-test`. The earlier recorded attestation was relayed by the previous agent and is not relied on.
- [ ] Then replace the TEST Docker Command with `/bin/sh /app/scripts/start-integration-backend.sh` and run one manual deploy of the merged `main` commit. Auto-Deploy stays OFF.

### TEST deploy — the one remaining owner action (2026-10-10)

The agent has no Render access, so the authorized single deploy must be started by the owner:
- [ ] In `petalpal-backend-test` → Settings, replace Docker Command with `/bin/sh /app/scripts/start-integration-backend.sh` and save. If Render does not start a deploy by itself, use Manual Deploy → "Deploy a specific commit" → `612e8335ad14c5229a8c335b3d233780488989b2` once. Do not start a second deploy if one is already running. Afterwards tell the agent; it runs `test-backend-smoke.yml` and reviews sanitized results. Saving this command is the owner's reconfirmation that the TEST service's credential bindings (recorded above) are unchanged.
