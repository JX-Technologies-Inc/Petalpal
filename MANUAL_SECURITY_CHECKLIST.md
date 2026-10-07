# Manual Security Checklist

Provider and production-control-plane actions only. Never record passwords,
tokens, keys, credential-bearing URLs, or full secret fingerprints here.

Last reconciled: 2026-10-07. Existing checked provider evidence is retained; production exact-code rollout/migration verification and the scoped read-only shared-ledger follow-up below add new evidence. Deployment presence is distinct from live runtime/provider certification.

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
- [ ] Finish authenticated private-cache/CDN verification. Production root/static 200 and anonymous AI 401 at exact clean revision 219b7ef contain all required security headers; the temporary marker is absent; private 401 is no-store and root retains public caching. Status: `PASS FOR INSPECTED HEADERS/ANONYMOUS NO-STORE; PARTIAL FOR AUTHENTICATED/CDN`; see 2026-10-07 marker evidence below.
- [ ] Verify operational alerts with available provider access. Render has default failure notifications, no explicit HTTP health-check path and paid-compute restrictions for application metrics. Dedicated DB/job/spend alerts remain unverified; Cloudflare requires authenticator MFA before current Worker/queue/alert/retention metadata can be inspected. Status: `PARTIAL / PLAN-LIMITED WHERE APPLICABLE`; no paid feature or alert was configured.

Existing Firebase/Socket runtime, retention/residency, backup/client-copy and database privilege checks remain open. Distributed Socket enforcement is absent from the inspected deployed server/package path; one-instance topology is not distributed enforcement evidence. No destructive or paid smoke test was performed.

Migration gate follow-up (2026-10-06): **SAFE TO DEPLOY for the migration gate**. Four-migration isolated PostgreSQL 16 upgrade via Prisma migrate deploy PASS; legacy rows/defaults/FK/unique constraints, new Journal/cover behavior and inspected old/new code flows PASS; second migrate deploy clean. Baseline and final schema comparisons retain the same pre-existing EventMemoryEmbedding.updatedAt default mismatch, so strict full-schema equivalence is not certified. See SECURITY.md for the four exact migration names and per-migration lock/rollback risks.

- [x] Approved production read-only migration precheck PASS: one Direct pg session confirmed default_transaction_read_only=on before SELECT/SHOW. PostgreSQL 17.2; latest successful `202609280001_multi_profile_event_memory_embeddings`; all four targets pending, no failed/incomplete migrations, matching applied checksums and valid prerequisites/order. No target-schema conflict; pending additions/defaults and nullable relaxation are compatible. Touched tables under 107 KB; full statistics visibility, zero >60-second transactions, zero blocked sessions and no other-session target-table locks at observation. Existing EventMemoryEmbedding.updatedAt CURRENT_TIMESTAMP default difference is unrelated/non-blocking; no new target-migration drift. Status: `PASS FOR POINT-IN-TIME PRECHECK ONLY`; at precheck time no migrations applied, deployment performed, private rows returned or production data modified. Subsequent rollout/postcheck passed as recorded below; locks may change.

Approved rollout/postcheck PASS (2026-10-06): Render Deploy succeeded/Live, active service commit `68dfd98da5b98de06005bcba8a724b7d0156ec3a`. Normal startup applied Daily Flower, Garden privacy, standalone Journal and Journal cover migrations; independent production read-only postcheck confirms all successful, latest `202610020002_private_journal_cover`, no failed/incomplete migration. Root HTTP 200 and anonymous AI reports HTTP 401 PASS for response/auth boundary only. Exact code proves consent lifecycle, durable cost gate, report fencing and Socket hardening are deployed; no unsafe/paid/user-mutating smoke test performed. The earlier private-cache/web-header omissions are superseded by final clean verification below; at that rollout, shared-primary/policy and multi-instance runtime certification, live Firebase propagation, distributed Socket, billing/retention/residency, backup/client-copy, grant/credential and monitoring limitations remain open. No provider configuration change or intentional production data change outside approved migrations.

### Production shared-ledger follow-up — 2026-10-06

- [x] Confirm deployed backend policy/order and durable ledger shape. Current Render has one instance/autoscaling off; no daily quota override keys or linked environment groups, so exact deployed gate defaults apply consistently to its HTTP/in-process executor. Same imported Prisma singleton serves those reservation paths. Read-only Direct SQL confirms permanent AuditEvent storage, valid primary key/required columns and zero current cost reservations. Backend retrieval/narrative/embedding/emotion/speech reserve before provider calls. Status: `PASS FOR INSPECTED BACKEND POLICY/DEPLOYED ORDER/STORAGE`; no live paid call or reservation race exercised.
- [ ] Establish current Cloudflare Queue/reconciler/executor destinations and all paid callers, compare runtime/inspection primary and identity without disclosing credentials, and confirm any other executor's policy. Cloudflare control plane requires authentication; a separate c-lite benchmark appears in Render inventory. Status: `NOT VERIFIED`; repo dispatcher intent and one Prisma singleton do not prove all production callers/shared-primary identity.
- [ ] Verify actual runtime ledger privileges and external retention. Inspection identity can SELECT/INSERT/DELETE/TRUNCATE and execute the advisory-lock function, but runtime identity equivalence is unproven. No owner FK, table trigger, pg_cron or targeted application reservation-pruning path was observed; external/operator cleanup remains unverified. Status: `PARTIAL / NOT VERIFIED`; retain AuditEvent Level 2 and direct credential/provider bypass limitations.

Overall certification `PARTIAL`; deployed fail-closed controls present, not live outage/quota/provider certification. Defaults are intentional and not a failure. One inspected application instance; multi-instance live certification NOT VERIFIED. No paid AI, production mutation or provider configuration change. Existing billing/retention/residency, Firebase/Socket, cache/headers, credential/grant, backup/client-copy and monitoring checks remain open.


### Targeted caller/runtime continuation — 2026-10-06

- [x] Classify inspected paths: Render backend/in-process executor reserves/checks and invokes inference; Worker inference invokes AI without DB access; Queue delegates opaque IDs to backend execution; reconciliation Cron discovers/enqueues IDs without direct provider calls or tombstone pruning. Source equivalence across application revision/HEAD checked only for these Worker/benchmark files. Separately deployed Worker version is unverified.
- [x] Inspect c-lite without invoking it: separate deployed Image web service/public address; no configured environment variables, secret files or linked groups. Source is local ONNX, outside customer integration, manual POST /benchmark and default startup run; no paid-provider/DB client. Deployed image contents/baked credentials, external scheduling and actual HTTP reachability remain unverified. Paid-quota bypass absent in inspected source; runtime bypass risk NOT VERIFIED.
- [ ] Obtain live Cloudflare metadata: dashboard requires sign-in; existing Wrangler credential returns HTTP 403 for read-only account metadata. Actual Worker callers/version, Queue/Cron configuration and executor destination remain NOT VERIFIED; Queue gating PARTIAL based on source. Worker DB access is unnecessary if all normal traffic reserves at backend first.
- [ ] Establish all reservation-capable components share the production PostgreSQL primary and verify Render runtime identity/primary without disclosing connection values: NOT VERIFIED. Prior single-Prisma backend evidence retained; no DB checks repeated. Runtime least-privilege grants PARTIAL; no grant changes.
- [ ] Exclude active external reservation-tombstone pruning: PARTIAL; inspected Queue/Cron contains none, accepted backend evidence retained, live external inventory unavailable.
- [x] Record current one-instance/autoscaling-off topology from accepted evidence. Multi-instance certification NOT VERIFIED and N/A for current topology; verify before scaling. Overall shared-ledger certification PARTIAL.

No production data/config/provider changes, tests, benchmark invocation or paid AI calls. Only the two security documents edited; recovery stash retained. Next blocker: authenticated read-only Cloudflare topology/caller metadata and safe runtime DB identity/primary comparison.


### Read-only Cloudflare topology audit attempt — 2026-10-06

**Certification remains PARTIAL.** The authorized Keychain lookup for service `PetalPal Cloudflare Readonly Audit` returned no nonempty credential (exit status 0, empty output); the exact-service fallback also returned no credential. No credential value was printed, logged or persisted. No authenticated Cloudflare inventory could be obtained. This does not establish token validity, scope or live component topology.

Live versions/bindings/callers of `petalpal-ai-dispatch-production` and `petalpal-emotion-ai`, producers/consumers of `petalpal-ai-jobs-production`, active reconciliation/cleanup triggers and other production AI callers remain NOT VERIFIED. Previously inspected source delegation to the gated Render executor, inference-only Worker design and local-ONNX c-lite isolation evidence are retained without repeating code/test/DB/Render checks. Queue gating and c-lite deployed-image isolation remain PARTIAL; same-ledger requirement and normal production gate bypass remain NOT VERIFIED; tombstone retention remains PARTIAL. Pure inference/transport Workers do not need PostgreSQL access when the Render executor reserves before provider calls; the live destination must still be established.

Next blocker: make a nonempty temporary read-only credential retrievable by the current macOS user, then obtain authenticated Worker/Queue/Cron metadata and executor destination. No external configuration, production data, provider, deployment or secret changes were made. Only the two security documents were edited; recovery stash retained.


### Authenticated Cloudflare retry — 2026-10-06

The temporary Keychain credential is now nonempty and Cloudflare token verification succeeds with status `active`. The earlier empty-credential blocker is resolved. Account discovery (`GET /accounts`) returns HTTP 403 / error 9109; targeted local deployment metadata supplies no account ID. No account-scoped Worker/Queue/Cron inventory was reached, so this denial does not establish whether those read permissions work when the correct account ID is supplied. The non-secret PetalPal Cloudflare account ID has been requested; no permission expansion is required merely to bypass account discovery.

Certification remains PARTIAL. Active production AI caller/binding inventory, Queue producers/consumers, reconciliation/cleanup triggers and executor destination remain NOT VERIFIED. Prior source-only Queue gating and c-lite isolation are retained as PARTIAL; same-ledger requirement/normal production bypass remain NOT VERIFIED and tombstone retention remains PARTIAL. No repo analysis, tests, deployment/Render/DB checks or paid AI calls were repeated. No token value was printed or persisted; no production configuration/data changed. Only these security documents were updated.

Next blocker: supply the non-secret Cloudflare account ID, then retry account-scoped read-only topology endpoints with the existing active token.


### Account-scoped Cloudflare retry — 2026-10-06

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


### HTTP middleware marker diagnosis — 2026-10-07

**Production security headers PASS; anonymous private no-store PASS.** Diagnostic commit `688a5f2110f19be57526a09d9609cfe3996caac1` adds only static X-PetalPal-HTTP-Security: v1 at entry to the existing middleware and two response-marker assertions. Security policy, CSP, auth and cache logic are unchanged. Six targeted HTTP-security tests PASS; diff --check PASS. Normal push and Render specific-commit deployment completed; the exact revision is Deploy succeeded|Live (2m50s).

Fresh cache-busted/no-cache anonymous HTTPS GET / returns 200 and GET /ai/reports returns 401. Both contain marker v1, HSTS max-age=15552000, CSP including frame-ancestors none, nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin and an application request ID. Root retains public, max-age=0; private 401 returns Cache-Control: no-store. These observations supersede the earlier HTTP acceptance failure for the current serving revision.

**Case D: prior live observation was stale/old-deployment evidence relative to the now-serving controls.** The marker proves current middleware execution. The specific earlier mechanism (old artifact/runtime versus cached/stale response) remains unproven; no policy correction or downstream configuration change was needed. No further implementation change followed the result, and no diagnostic endpoint was added.

Authenticated private-route runtime caching remains NOT VERIFIED; no authenticated user data or safe session was used. CDN/cross-user leakage and Calendar/history wire minimization remain separate open items, as do existing unrelated security limitations. No paid inference, production data/configuration/grant changes or new migration requirement. Recovery stash and unrelated files preserved. Only these two docs were updated after the marker diagnosis PASS; that diagnosis task created no docs commit. Final cleanup/documentation is recorded below.


### Final clean production HTTP security verification — 2026-10-07

**PASS for security headers, anonymous private no-store and intentional public/static caching.** Cleanup commit `219b7ef09ab74c3f781b013f307ee8f2f62f6632` removes only X-PetalPal-HTTP-Security: v1 and its two test assertions; HSTS/CSP/nosniff/frame/referrer and cache policy are unchanged. Six targeted HTTP-security/cache tests PASS without the marker; diff --check PASS. Branch remains integration/mobile-backend-test; normal cleanup push completed. Render Manual Deploy → specific commit reports this exact SHA Deploy succeeded|Live (2m35s).

Fresh cache-busted HTTPS requests with Cache-Control: no-cache observe: root / = 200, /favicon.svg = 200, anonymous /ai/reports = 401. All three retain HSTS max-age=15552000, CSP including frame-ancestors none, X-Content-Type-Options nosniff, X-Frame-Options DENY and Referrer-Policy strict-origin-when-cross-origin. Diagnostic marker is absent on all three. Private AI 401 returns Cache-Control: no-store; root/favicon retain public, max-age=0. The temporary marker diagnosis is complete and the clean production implementation passes. Earlier FAIL observations were stale/earlier-deployment observations and are superseded; the specific earlier staleness mechanism is not claimed proven.

**Remaining scoped limits:** authenticated owner-private no-store runtime check NOT VERIFIED because no existing safe test session was available; no production user/session state was created or private data accessed. Accepted authenticated fixture regressions remain valid. CDN/cross-user leakage is not certified from these request samples. DELTA-P2-4 Calendar/history wire-data minimization remains open; no payload/API redesign occurred. Runtime DB least privilege, future multi-instance verification and unrelated Firebase/Socket/provider/backup/monitoring limitations remain separate.

No paid AI, production-data or provider/configuration/grant changes; no schema/migration changes or new migration requirement. Recovery stash and unrelated files preserved. Final documentation reconciles the prior uncommitted marker-PASS evidence and clean deployment; only SECURITY.md and MANUAL_SECURITY_CHECKLIST.md belong in the documentation commit.
