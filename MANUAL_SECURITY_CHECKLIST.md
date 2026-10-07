# Manual Security Checklist

Provider and production-control-plane actions only. Never record passwords,
tokens, keys, credential-bearing URLs, or full secret fingerprints here.

Last reconciled: 2026-10-06. Existing checked provider evidence is retained; this documentation update performed no new provider or deployment verification.

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

## 3. Render

- [x] Review environment secrets. Evidence: production secrets confirmed as Render environment variables; no unexpected Secret Files. Status: `PASS`
- [ ] Verify no historical `DATABASE_URL` remains. Evidence: provider-side secret review without recording values. Status: `ACTION REQUIRED`
- [x] Verify `/api-docs/` is not explicitly enabled in production unless intentional. Evidence: `API_DOCS_ENABLED=true` absent from production environment. Status: `PASS`
- [x] Review members and permissions. Evidence: no unexpected workspace team member found. Status: `PASS`
- [x] Verify production/development separation. Evidence: current production configuration reviewed; no additional workspace finding recorded. Status: `PASS`
- [ ] Configure relevant Render monitoring, alerting, and retention where available. Evidence: non-secret configuration summary. Status: `PARTIAL / PLAN-LIMITED`

## 4. Cloudflare

- [x] Verify the current Worker shared secret. Evidence: synchronized Worker/backend contract verified without recording values. Status: `PASS`
- [x] Verify Render backend and Worker use the synchronized current secret. Evidence: deployment configuration and runtime contract confirmed without values. Status: `PASS`
- [ ] Rotate the Worker shared secret if uncertain. Evidence: rotation timestamp and deployment confirmation. Status: `NOT CHECKED`
- [x] Review account members and MFA. Evidence: one intended human member; 2FA active. Status: `PASS`
- [x] Review Worker logs, errors, timeouts, and AI usage monitoring. Evidence: Workers Logs, invocation logs, and persistence enabled; live invocation observed; traces intentionally disabled. Status: `PASS`
- [x] Review production/development separation. Evidence: Worker identity and account configuration reviewed. Status: `PASS`

## 5. Firebase / Google

- [x] Review Firebase Admin credential inventory. Evidence: two service accounts reviewed; active Admin key inventory recorded without key material. Status: `PASS`
- [x] Remove unused service-account keys. Evidence: old Firebase Admin key revoked/removed; Gemini service account had zero keys. Status: `PASS`
- [x] Verify MFA/passkey protection on administrator accounts. Evidence: Firebase project administrator review completed. Status: `PASS`
- [x] Review project members and permissions. Evidence: only intended Firebase human member found. Status: `PASS`
- [x] Verify Firebase Web config is treated as public, not secret. Evidence: configuration classification review. Status: `PASS`
- [ ] Review authentication abuse and security visibility where available. Evidence: non-secret monitoring configuration summary. Status: `ACTION REQUIRED`

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

Canonical findings/actions: [Feature Security Delta Review](SECURITY.md#2026-10-feature-security-delta-review). These are pending checks, not deployment attestations; prior PASS evidence is not refreshed by this code review.

- [ ] Verify exported web/native production preview/test-route behavior, intentional Fairy alias, release flags, approved Firebase domains and deep-link redirects. Evidence: release artifact route/negative-link matrix. Status: `NOT VERIFIED`
- [ ] Confirm native Firebase persistence/backup policy; evaluate App Check/device attestation rollout and server enforcement for HTTP/Socket abuse signals. Evidence: SDK/provider configuration and replay negatives. Status: `NOT VERIFIED`; existing authentication still required.
- [ ] Verify production Render/PostgreSQL pool limits, statement/query deadlines, worker concurrency, lease/inference duration alerts and AI spend thresholds. Evidence: non-secret configuration plus isolated load metrics. Status: `NOT VERIFIED / PLAN-LIMITED WHERE APPLICABLE`
- [ ] Verify shared paid-AI enforcement at the backend/executor before retrieval, narrative, remote embedding, Event emotion/preview and speech calls; the inference Worker does not independently implement the PostgreSQL gate. Verify private-route cache bypass and hosted-web CSP/HSTS/nosniff/frame protection separately. Evidence: non-secret deployed boundary/header/cache checks. Status: `NOT VERIFIED`
- [ ] Verify paid-AI gate deployment: all Render/worker instances use the same PostgreSQL primary and identical server-side `AI_*_DAILY_LIMIT` / `AI_*_DAILY_CALL_LIMIT` values; runtime roles may reserve/read but cannot erase the durable AI-cost ledger. Verify deployed multi-instance duplicate/reclaim/quota behavior, reservation-before-provider failures and fail-closed DB/config outages without using private production data; verify provider account-wide billing ceilings/alerts separately, since application call ceilings are not currency limits and do not cover direct credential use. Confirm retention does not prune operation tombstones or reset usage. Document controlled recovery for an ambiguous paid attempt: do not delete reservations to replay inference; crashes can leave reports unavailable without provider idempotency/durable results. Evidence: non-secret policy/grant review and test outcomes only. Status: `NOT VERIFIED`
- [ ] Reconfirm Workers AI/embedding/report inference retention, logs, subprocessors and residency against the new selected-Event evidence data flow; use existing §7 provider records rather than recording private examples. Status: `NOT VERIFIED FOR NEW FLOW`; exact retention remains unspecified unless newly evidenced.

- [ ] Verify deployed Firebase disabled/revoked/expired-session propagation, idle Socket eviction and privacy/unfriend/account-delete revocation; confirm single-instance/adapter assumptions and process-local movement/control budgets match deployment. Evidence: non-secret authorized/revoked delivery and normal-cadence outcomes. Status: `NOT VERIFIED`; distributed Socket revocation is not implemented/certified.
- [x] Retain the 2026-09-29 production Queue cutover evidence. Evidence: [LONG_TERM_AI.md — Production Queue cutover and observation](LONG_TERM_AI.md#production-queue-cutover-and-observation--2026-09-29) records private authenticated execution, opaque IDs, duplicate/revoke/reconciliation and owner-scoped embedding/retrieval smoke. Status: `PASS FOR RECORDED SCOPE`; not evidence for later October fences/quotas.
- [ ] Complete the recorded Queue observation and deployment verification of October report-final-write fencing/shared AI limits. Verify worker/backend policy alignment, active production reconciler and disabled staging Cron; monitor backlog/lease/attempt/cost alerts and sufficient-evidence report-provider behavior. Evidence: non-secret operational outcomes only. Status: `NOT VERIFIED`; no new provider action performed during reconciliation.

- [ ] Verify deployed consent-revocation lifecycle: disabling AI memory prerequisites denies private memory/report reads and atomically clears owner-derived memories/vectors/evidence/reports while retaining source Events and non-AI data; verify late-worker/epoch/regrant behavior, required runtime deletion privileges and failure rollback. Confirm existing backup/provider/log retention and client-cache erasure policies separately; application cleanup does not erase historical external copies. Evidence: non-secret deployment outcomes and role/policy review, without private content. Status: `PASS FOR EXACT-CODE DEPLOYMENT PRESENCE`; production runtime revocation/privilege/retention checks remain `NOT VERIFIED`. DELTA-P1-1 records 18 independent isolated PostgreSQL cases PASS (four connections), including observed lock waits, cleanup rollback and stale-worker/read denial. This does not verify deployed runtime-role privileges, providers, backups or client copies.


### Production/deployment observations — 2026-10-06

- [x] Identify live backend revision/topology. Historical pre-rollout evidence: authenticated Render PetalPal_v2 metadata showed `3fef15d474ebe0d56c2406dba1a9dd894a8cc2a0`, `main`, pinned deployment with auto-deploy disabled, one Free instance and autoscaling off. Status: `PASS FOR INVENTORY ONLY`; the later verified rollout below supersedes this revision. See the corresponding SECURITY.md observations.
- [x] Complete production migration precheck and exact-code rollout. Status: `PASS FOR DEPLOYMENT PRESENCE`; Render live revision is `68dfd98da5b98de06005bcba8a724b7d0156ec3a`, with all four migrations successfully applied by normal startup and confirmed through read-only SQL. Consent/cost/report-fence/Socket modules are deployed; runtime race/provider certification remains separate.
- [ ] Verify production AI policy/shared ledger and staging separation. Environment names were inspected without values: existing database/dispatch/executor/Worker keys are present, daily quota keys absent, no linked environment groups. Status: `NOT VERIFIED`; quota syntax/effective policy, shared primary, reservation/tombstone behavior and runtime privileges were not certified.
- [ ] Resolve/reverify deployed private caching and web headers. Anonymous root is 200 HTML/public max-age=0; two private AI GET routes return 401 without Cache-Control. Those responses lack HSTS, nosniff, frame protection, CSP and Referrer-Policy. Status: `PARTIAL`; authenticated response/CDN behavior and other hosting surfaces remain unverified.
- [ ] Verify operational alerts with available provider access. Render has default failure notifications, no explicit HTTP health-check path and paid-compute restrictions for application metrics. Dedicated DB/job/spend alerts remain unverified; Cloudflare requires authenticator MFA before current Worker/queue/alert/retention metadata can be inspected. Status: `PARTIAL / PLAN-LIMITED WHERE APPLICABLE`; no paid feature or alert was configured.

Existing Firebase/Socket runtime, retention/residency, backup/client-copy and database privilege checks remain open. Distributed Socket enforcement is absent from the inspected deployed server/package path; one-instance topology is not distributed enforcement evidence. No destructive or paid smoke test was performed.

Migration gate follow-up (2026-10-06): **SAFE TO DEPLOY for the migration gate**. Four-migration isolated PostgreSQL 16 upgrade via Prisma migrate deploy PASS; legacy rows/defaults/FK/unique constraints, new Journal/cover behavior and inspected old/new code flows PASS; second migrate deploy clean. Baseline and final schema comparisons retain the same pre-existing EventMemoryEmbedding.updatedAt default mismatch, so strict full-schema equivalence is not certified. See SECURITY.md for the four exact migration names and per-migration lock/rollback risks.

- [x] Approved production read-only migration precheck PASS: one Direct pg session confirmed default_transaction_read_only=on before SELECT/SHOW. PostgreSQL 17.2; latest successful `202609280001_multi_profile_event_memory_embeddings`; all four targets pending, no failed/incomplete migrations, matching applied checksums and valid prerequisites/order. No target-schema conflict; pending additions/defaults and nullable relaxation are compatible. Touched tables under 107 KB; full statistics visibility, zero >60-second transactions, zero blocked sessions and no other-session target-table locks at observation. Existing EventMemoryEmbedding.updatedAt CURRENT_TIMESTAMP default difference is unrelated/non-blocking; no new target-migration drift. Status: `PASS FOR POINT-IN-TIME PRECHECK ONLY`; at precheck time no migrations applied, deployment performed, private rows returned or production data modified. Subsequent rollout/postcheck passed as recorded below; locks may change.

Approved rollout/postcheck PASS (2026-10-06): Render Deploy succeeded/Live, active service commit `68dfd98da5b98de06005bcba8a724b7d0156ec3a`. Normal startup applied Daily Flower, Garden privacy, standalone Journal and Journal cover migrations; independent production read-only postcheck confirms all successful, latest `202610020002_private_journal_cover`, no failed/incomplete migration. Root HTTP 200 and anonymous AI reports HTTP 401 PASS for response/auth boundary only. Exact code proves consent lifecycle, durable cost gate, report fencing and Socket hardening are deployed; no unsafe/paid/user-mutating smoke test performed. Private-cache/web-header omissions, shared-primary/policy and multi-instance runtime certification, live Firebase propagation, distributed Socket, billing/retention/residency, backup/client-copy, grant/credential and monitoring limitations remain open. No provider configuration change or intentional production data change outside approved migrations.
