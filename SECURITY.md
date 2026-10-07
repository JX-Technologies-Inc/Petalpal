# PetalPal Security

## Security Status

Last updated: 2026-10-06

This file is the canonical implementation record for **PetalPal Security
Threat Model & Remediation Backlog — v2**. Every P0/P1/P2 item is retained as
an independent entry; no item has been deleted, merged, or reprioritized.
`✅ VERIFIED` requires explicit evidence for the stated completion criterion;
none is claimed by this audit.

| Priority | ✅ VERIFIED | ✅ TESTED | ✅ IMPLEMENTED | 🟡 PARTIAL | 🔒 MANUAL | ⬜ TODO | ⚪ N/A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 0 | 5 | 3 | 13 | 3 | 2 | 1 |
| P1 | 0 | 3 | 1 | 8 | 5 | 6 | 0 |
| P2 | 0 | 0 | 0 | 5 | 2 | 2 | 8 |

## Architecture / Trust Boundaries

```text
Mobile/Web App
    │ Firebase ID token
    ▼
Firebase Authentication
    │ verified claims + server UID mapping
    ▼
PetalPal Node.js / Express API
    │ Prisma / server-side ownership checks
    ▼
PostgreSQL

Backend ── server-only credential ──▶ Cloudflare Worker / AI inference
                                      │ Worker AI binding
                                      ▼
                                  AI provider

GitHub ──▶ GitHub Actions / release controls ──▶ Render ──▶ Production API
   │                                             │
   └── repository/deploy secrets                ├── Firebase Admin
                                                ├── Cloudflare
                                                ├── Storage
                                                └── Monitoring / Logging
```

The client is untrusted. Firebase is the identity boundary; the API is the
authorization, validation, and data-minimization boundary; the Worker is an
inference-only boundary. GitHub, Actions, Render, Firebase, Cloudflare,
storage, logging, database networking, and provider billing are operational
boundaries whose console settings cannot be proved from this repository.

## Authorization Matrix

`A` = Firebase-authenticated. `O` = authenticated owner. `S` = intentionally
social/public data, still behind authentication. Client `userId`, owner,
entitlement, and model fields are not trusted.

| Method/resource | Access rule | Evidence |
| --- | --- | --- |
| GET `/users`, `/users/search` | A; public summaries; bounded result sets | `server.js:584-655` |
| GET `/users/:userId` | A; public summary; own friend IDs only | `server.js:657-684` |
| GET `/users/:userId/friends` | A + O | `requireOwnUser`, `server.js:686-720` |
| GET `/users/:userId/garden` | A + S; private journal/AI only for O | `getGardenResponse`, `server.js:722-736` |
| POST `/auth/session` | Verified Firebase identity; profile fields selected | `server.js:738-843` |
| GET `/session`, check-ins, Fairy, AI consent, subscription | A + O derived from token | `server.js:1225-1551` |
| PUT profile/avatar/Fairy/AI consent | A + O; fields validated/allowlisted | `server.js:1166-1217`, `1436-1539` |
| PUT Fairy active | A; Fairy ownership query required | `server.js:1338-1367` |
| POST reports | A; reporter comes from `req.auth.userId` | `server.js:1553-1605` |
| POST friend request/remove | A; actor comes from `req.auth.userId` | `server.js:1612-1802`, `2075-2112` |
| GET/POST friend requests | A; list is O; accept/reject requires receiver | `server.js:1804-2073` |
| POST flowers / analyze mood | A + O; own consent and data path | `server.js:2114-2387`, `2988-3031` |
| GET/POST social flower support/message | A + S; target owner + resource are queried | `server.js:2389-2647` |
| DELETE flower/account | A + O; owned resources only | `server.js:2650-2696`, `3033-3086` |
| POST visit/move/leave | A; visitor identity is token-derived | `server.js:2698-2986` |
| Socket handshake/user/garden/movement | Token auth; user room and movement actor are token-derived; garden is intentionally social | `server.js:79-188`, `test/back/security-p0-socket.test.js` |

Legacy authentication endpoints return `410`: `/register`, `/login`,
`/auth/email-code/request`, `/auth/email-code/verify`,
`/legacy-register-disabled`, and `/legacy-login-disabled`.

## 🔴 P0 — Critical / Launch Blockers

Each row preserves the canonical project name exactly. Evidence is limited to
what was inspected or tested; “manual” means platform/account action remains.

| Canonical item | Status | Evidence / finding / next action |
| --- | --- | --- |
| Secrets Management & Leakage Prevention | 🟡 PARTIAL | Current tracked live-secret findings: 0. Historical Firebase Web config is public client configuration; a historical `DATABASE_URL` exists in Git history, while current source no longer references that credential. `.env` is ignored and `.env.example` contains safe placeholders/public configuration only. Current provider-side configuration was reviewed, but revocation of the historical database credential is not independently verified; repository evidence therefore remains partial. |
| Production Control-Plane Account Security | 🟡 PARTIAL | GitHub, Cloudflare, Firebase/Google account and access reviews are PASS. Render monitoring remains PARTIAL / PLAN-LIMITED; no paid upgrade is required for P0 closure. |
| API Authorization / IDOR / BOLA | 🟡 PARTIAL | HTTP mutation inventory is complete at 21 authenticated routes with explicit source/test disposition in `test/back/security-p0-http-coverage.test.js`; prior runtime User A→B coverage includes profile, AI consent, Fairy state, friends/requests, subscription, reports, flowers, and garden privacy. Socket.IO authorization matrix remains incomplete, so the canonical item stays partial. |
| Privilege Escalation / Mass Assignment | 🟡 PARTIAL | HTTP mutation inventory and server-controlled identity/entitlement source guards cover all 21 authenticated mutating routes; runtime forged-field tests cover profile/Fairy/AI consent, friends/requests, subscription, reports, and flowers. Socket.IO and broader field-by-field runtime mutation coverage remain outside this batch; status stays partial. |
| Client Token Storage & Leakage Prevention | ✅ TESTED | ID tokens are no longer persisted in localStorage; API/Socket use current Firebase session tokens. `client/src/api.js`, `client/src/App.jsx`, `client/src/Auth/firebaseSession.js`, and client tests are evidence. Native secure storage/crash-report behavior remains deployment-specific. |
| Service-to-Service Authentication | ✅ TESTED | Backend sends Worker bearer from environment only; Worker rejects callers before AI and validates input/output. Evidence: `lib/emotion-classifier.js`, `cloudflare-worker/src/index.js`, `test/back/cloudflare-emotion-worker.test.js`. Rotate and verify production secret manually; consider short-lived credentials. |
| AI Cost & Resource Abuse Protection | 🟡 PARTIAL | Authenticated-user AI limiter, Daily Grow uniqueness, 2,000-char input bound, timeout, and deterministic fallback exist. Sequential replay and a true 20-concurrent-request Daily Grow runtime test pass in the local test harness; durable daily/action quotas, global budget, provider ceiling, and multi-instance shutdown are absent. |
| Multi-Dimensional Abuse Prevention | 🟡 PARTIAL | Current controls combine user-keyed AI/general limits and IP-keyed auth limits. No durable account+IP+action+global signal or registration anomaly detection. |
| Trusted Proxy / Client IP Configuration | ✅ TESTED | Express `trust proxy` defaults false; explicit hop/address configuration is validated in `lib/security-config.js` and `test/back/security-config.test.js`. Verify the Render/Cloudflare chain manually before enabling a value. |
| Request Size / JSON Body Bomb | ✅ TESTED | 32 KB Express JSON limit, bounded fields, 20-level depth, 1,000 object keys, and 1,000-item arrays. Evidence: `lib/http-errors.js`, `lib/daily-flower-input.js`, `test/back/security-baseline.test.js`. |
| Sensitive Logging & Observability Security | 🟡 PARTIAL | `logServerError` and structured security events omit exception text, stacks, bearer-like values, and journal text; tests prove it. Workers Logs are enabled with invocation logs and persistence; Free-plan log retention is documented as 3 days. Remaining raw timing/socket logs, retention scope, and third-party telemetry need production audit. |
| Debug / Admin / Internal Endpoint Exposure | 🟡 PARTIAL | No debug/admin/metrics route found; legacy auth is 410. `/api-docs/` is mounted before auth and is public in development; added `apiDocsEnabled()` production fail-closed gate (`API_DOCS_ENABLED=true` is required to expose it), with unit evidence in `test/back/security-p0-matrix.test.js`. Production deployment configuration still requires verification. |
| Software Supply-Chain Security | 🟡 PARTIAL | Root/client lockfiles exist. `npm audit --omit=dev` on 2026-09-14 reported 10 transitive advisories: 4 high, 6 moderate, 0 critical. Add Dependabot/Renovate, SBOM, lifecycle review, and remediation SLA. |
| CI/CD & Release Security | 🟡 PARTIAL | No GitHub Actions workflow was found, so no CI permission/deploy evidence exists. Add least privilege, pinned trusted actions, protected main, review/status gates, and protected credentials; branch/deploy settings are manual. |
| Production / Development Environment Isolation | 🟡 PARTIAL | Public Vite config and server-only Admin/Worker values are separated in `.env.example`; separate production/dev projects, DBs, storage, Worker secrets, and AI keys are not proved. Verify manually. |
| Database Network Isolation & Least Privilege | 🟡 PARTIAL | Prisma uses `DATABASE_URL`; no separate migration credential is configured, so runtime/migration currently share the credential. `AuditEvent` Level 1 application-side create-only implementation and real local PostgreSQL validation are PASS. Level 2 is **PROVIDER-LIMITED / NOT VERIFIED**: current environment cannot verify production PostgreSQL role/grant capabilities, and Prisma pooled/direct URLs from one credential pair do not create role separation by themselves. This is not a repo P0 blocker; verify provider role/grant support and configure separate roles manually. |
| Backup, Restore & Ransomware Resilience | 🟡 PARTIAL | Backup existence and isolated restore drill are PASS. Provider-specific retention, encryption, and access-restriction metadata remain not independently verified. This is retained as provider-limited follow-up, not a repo P0 blocker. |
| Security Monitoring & Anomaly Detection | 🟡 PARTIAL | Server-generated `X-Request-ID` correlation and allowlisted structured events cover authentication failures, owner authorization denials, rate-limit violations, and audit-write fallback signals; durable cross-instance aggregation, alert thresholds/routing, private-read/AI-spend/Worker/DB signals, and provider configuration remain. |
| Tamper-Resistant Security Audit Logging | 🟡 PARTIAL | `LEVEL_1`: durable selected `AuditEvent` persistence and application create-only repository are implemented and real local PostgreSQL validation is PASS. `LEVEL_2` is **PROVIDER-LIMITED / NOT VERIFIED**: DB-enforced runtime/migration role separation and INSERT-only grants remain unverified; do not claim INSERT-only grants or ALTER/DROP protection were verified. |
| Incident Response Runbook | ✅ IMPLEMENTED | Runbook is below and covers containment, disable/revoke, rotate, investigate, recover, verify, notify, and each named compromise scenario. No timed exercise was performed. |
| Systematic Threat Modeling | ✅ IMPLEMENTED | Trust-boundary/data-flow model and matrix are above. Formal review/sign-off remains outstanding. |
| Security Regression & Business Logic Test Suite | 🟡 PARTIAL | Existing tests cover missing token, owner checks, malformed/oversized input, rate limits, Worker auth/output, logging, and fallbacks. Structured-event redaction, bounds, correlation, and failure isolation are covered by `test/back/security-events.test.js`; HTTP/Socket authorization and Daily Grow race evidence remain covered by their dedicated tests. Production alerting, durable audit persistence, real Firebase E2E, and production concurrency verification remain. |
| LLM Trust Boundary & Prompt Injection Defense | 🟡 PARTIAL | Current inference-only boundary is tested with malicious user inputs and malicious model outputs: Worker schema validation rejects unsupported labels, extra fields, nested control objects, and out-of-range values; backend sends only text and does not expose authorization/ownership fields. Future AI tools/RAG remain feature-triggered and would require server-side reauthorization. |
| LLM Secret Leakage Prevention | ✅ TESTED | Credentials remain in Worker/backend environment and are not model messages; Worker tests prove secret/provider/input details are not logged or returned. Cloudflare Workers AI Customer Content handling documents no model training or service improvement without explicit consent; applicable DPA terms are documented. Exact ordinary inference retention remains unspecified. |
| AI Memory / RAG Tenant Isolation | 🟡 PARTIAL | Daily Grow Journal text never enters emotion or long-term AI; the authenticated Event API derives owner from verified Firebase identity. Composite owner FKs protect EventMemory, evidence, reports, and Event jobs; owner-scoped route/DB negatives pass. `AiEvidence` is canonical, Event deletion removes citing reports, and report regeneration replaces evidence atomically. DB-backed jobs have versioned idempotency, guarded transitions, lease recovery, and `SKIP LOCKED` claim tests. Production embeddings/vector retrieval and external-vector deletion do not exist; PostgreSQL-specific trigger/concurrency behavior still requires validation on the production PostgreSQL version. |
| Sensitive Data Classification & Minimization | ✅ IMPLEMENTED | Classification policy is below; cross-system retention/deletion is not yet verified. |
| AI Provider Data Exposure | 🟡 PARTIAL | Worker receives only required text; API does not send UID/email/Authorization/DB credentials/unrelated profile data. Workers AI Customer Content includes inputs/prompts, outputs, embeddings, and training data; Cloudflare states it is not used to train Workers AI models or improve Cloudflare/third-party services without explicit consent: PASS. Customer DPA v6.4 (effective 2026-04-03) applies where Cloudflare acts as processor/subprocessor and limits processing to service provision without marketing/advertising use: PASS. Official documentation does not specify a general retention period for ordinary inference prompts/outputs; storage may occur when R2, KV, Durable Objects, or Vectorize is specifically used: PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED. Published subprocessors include US and England operations; Canada-only or single-region processing is not configured or verified: NOT VERIFIED / OPTIONAL HARDENING. |

## 🟠 P1 — High Priority

| Canonical item | Status | Evidence / finding / next action |
| --- | --- | --- |
| Credential Stuffing / Brute Force | 🟡 PARTIAL | Firebase handles authentication and auth limiting is IP-keyed. Verify Firebase anti-abuse and high-risk re-auth manually. |
| Account Enumeration | ⬜ TODO | Uniform login/register/reset behavior has not been tested; Firebase and session setup responses need review. |
| Account & Session Lifecycle Security | ⬜ TODO | No complete reset/change-email/logout/delete/revoke matrix or rapid session invalidation policy found. |
| SQL / ORM Logic Injection | ✅ TESTED | Structured Prisma filters and one parameterized tagged advisory-lock query; no unsafe raw SQL helper found. Add dedicated filter-injection negatives. |
| API Flood / DoS | 🟡 PARTIAL | Socket payload/action/user/inflight bounds and shared paid-AI call ceilings are TESTED (DELTA-P1-3/4). General HTTP limits remain process-local; historical queue/aggregate bounds and deployment capacity/deadlines remain incomplete. |
| Database Connection Exhaustion | 🟡 PARTIAL | Prisma PostgreSQL pool exists; query timeouts, concurrency controls, and pool monitoring are not evidenced. |
| Race Conditions | 🟡 PARTIAL | Existing Daily Grow 20-request evidence retained; production/multi-instance verification remains. DELTA-P1-2 report final-write source/consent-epoch/lease fencing now has deterministic + in-memory PostgreSQL SQL coverage; independent PostgreSQL concurrency not verified. |
| XSS / HTML / URL Injection | 🟡 PARTIAL | React escapes text and no raw HTML feature was found; no explicit sanitizer or URL-scheme allowlist for future WebView/link rendering. |
| CORS Misconfiguration | ✅ TESTED | Explicit `CORS_ALLOWED_ORIGINS` allowlist protects HTTP and Socket.IO; evidence: `lib/security-config.js`, `server.js`, `test/back/security-config.test.js`. Production origin list requires review. |
| Cache / CDN Cross-User Leakage | 🟡 PARTIAL | Worker uses no-store; private API/CDN end-to-end `Cache-Control` audit and replay test remain. |
| DNS / Domain Account Hijacking | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Enable registrar/Cloudflare MFA, restrict DNS members, and enable DNSSEC where supported. |
| Malicious Model Output / AI JSON Injection | ✅ TESTED | Worker schema/enum/bounds/additional-property validation and backend normalization/fallback are tested. |
| Cloud Configuration Review | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Review Render/Firebase/Cloudflare/storage public access, service accounts, and wildcard permissions in consoles. |
| SAST / Static Security Analysis | ⬜ TODO | No CodeQL/Semgrep or equivalent PR-blocking scan found. |
| DAST / API Fuzzing | ⬜ TODO | No staging fuzz/security-scan job or release gate found. |
| Runtime Security Headers | ⬜ TODO | No CSP/HSTS/nosniff/frame-protection policy found; add and test headers for hosted web surface. |
| Encryption at Rest & Key Scope | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Verify PostgreSQL/object storage/snapshot/backup encryption and least-privilege keys. |
| Developer Endpoint / Device Compromise | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Require OS updates, passkeys, disk encryption, reduced local production secrets, and tested revoke/recovery. |
| App Reverse Engineering | ✅ IMPLEMENTED | Client bundle, endpoints, Firebase web config, and UI rules are treated as public; authorization is backend-only. |
| App Attestation / Direct API Automation | ⬜ TODO | Firebase App Check/device attestation is not configured; evaluate as an abuse signal, never as sole authorization. |
| Prototype Pollution / Unsafe Object Merge | 🟡 PARTIAL | No untrusted deep merge found; body complexity is bounded and fields are selected. Add global schema/unknown-field and `__proto__` tests. |
| Privacy API Enumeration | 🟡 PARTIAL | Search/list/friends/visit responses are authenticated and bounded; pagination, policy, and read-volume anomaly detection remain. |
| External Security Review | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Commission scoped independent pentest/bug-bounty review and remediate high/critical findings before release. |

## 🟡 P2 — Medium / Feature-Triggered Hardening

| Canonical item | Status | Evidence / trigger |
| --- | --- | --- |
| SSRF | ⚪ NOT APPLICABLE | No user-influenced server URL fetch. Trigger: URL preview, AI fetch, or import. |
| Path Traversal | ⚪ NOT APPLICABLE | No filesystem-path upload/download API. Trigger: file/object retrieval. |
| Malicious File Upload | ⚪ NOT APPLICABLE | No binary upload; avatar is a bounded string. Trigger: attachments/uploads. |
| Regex DoS / Event Loop Blocking | 🟡 PARTIAL | Only bounded simple ID regexes; audit future custom patterns. |
| Slow Query / Expensive Search | 🟡 PARTIAL | Bounded `take` values and user timeline indexes exist; timeouts/pagination/result policy incomplete. |
| Indirect Prompt Injection | ⚪ NOT APPLICABLE | No external retrieval. Trigger: web/search/RAG content in context. |
| RAG Poisoning / Source Integrity | ⚪ NOT APPLICABLE | No shared knowledge base. Trigger: shared retrieval/persistent knowledge. |
| Scraping / Bot Management / WAF | 🔒 BLOCKED / MANUAL ACTION REQUIRED | App limits exist; Cloudflare WAF/managed rules/bot signals are not verified. |
| Push Notification Privacy | ⚪ NOT APPLICABLE | No push feature. Trigger: locked-device notifications. |
| Root / Jailbroken Device Risk | 🟡 PARTIAL | Firebase owns token lifecycle and web client no longer uses localStorage for ID tokens; native secure storage/risk signals are future work. |
| Payment / Subscription Forgery | ⚪ NOT APPLICABLE | No payment/receipt/webhook activation; current entitlement is read-only. |
| Deep Link / Firebase Action-Link Hijacking | 🟡 PARTIAL | Passwordless callback uses current origin `/finish-sign-in`; approved-domain/universal-link and hostile-redirect tests remain. |
| WebSocket / Socket.IO Authorization | 🟡 PARTIAL | Current identity/privacy checks at joins, actions and recipient delivery; bilateral revocation, paused-work fencing and flood bounds pass deterministic HTTP/Socket runtime tests (DELTA-P1-3). Real Firebase propagation/latency and distributed deployment remain unverified. |
| Webhook Forgery / Replay | ⚪ NOT APPLICABLE | No external webhook. Trigger: payment/store webhook. |
| Attack Surface Monitoring | ⬜ TODO | No scheduled domain/service/port/public-endpoint inventory found. |
| Honeytokens / Canary Secrets | ⬜ TODO | No canary or alert sink found; design only after alerting exists. |
| Periodic Pentest | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Re-test after auth/RAG/payment/major architecture changes and add to release policy. |

## Incident Response

Target: first containment actions within 30–60 minutes, followed by evidence
preservation, recovery, verification, and legally required notification.

1. **Contain:** declare the incident, record UTC scope/timestamps, pause the
   affected deployment or AI capability, block abusive traffic, and preserve
   immutable logs. Do not copy secrets or journal content into chat channels.
2. **Disable/revoke:** disable compromised GitHub/Render/Cloudflare/Firebase
   accounts, revoke tokens/sessions, remove exposed members, and isolate the
   Worker/API/database path.
3. **Rotate:** rotate Firebase Admin, database, Worker, deploy, and other
   affected credentials in platform secret stores. Do not assume rotation.
4. **Investigate:** determine initial access, affected identities/resources,
   unauthorized reads/writes, AI spend, persistence, and available logs.
5. **Recover:** restore only a verified clean backup into isolation first;
   patch the entry point; redeploy from a reviewed ref; verify migrations,
   ownership, secret loading, and monitoring.
6. **Verify:** run auth, BOLA, secret/logging, body-limit, Worker-auth, and
   regression tests; review platform access; obtain independent review for
   high-impact incidents.
7. **Notify:** involve the incident owner, providers, legal/privacy lead, and
   affected users/regulators when required. Record decisions and owners.

Scenario-specific first actions:

- **Credential leak:** revoke/rotate the exact credential, search current and
  historical logs, identify access, and invalidate dependent sessions.
- **GitHub compromise:** suspend account/token, review commits/workflows,
  protect main, invalidate deploy credentials, and redeploy a reviewed ref.
- **Firebase compromise:** restrict the account, rotate Admin keys, review
  Auth activity, and force risk-based reauthentication.
- **Cloudflare/Worker compromise:** pause/restrict the Worker, rotate the
  server-to-Worker credential, review routes/secrets/AI spend, and redeploy.
- **Database compromise:** isolate network access, revoke runtime credentials,
  preserve evidence, assess reads/changes, and restore/repair after integrity
  review.
- **User-data exposure:** stop the flow, identify users/fields, prevent more
  disclosure, preserve evidence, and follow approved privacy notification.

## Sensitive Data Classification & Minimization

| Class | Data | Handling rule |
| --- | --- | --- |
| Public | Flower display metadata, public profile name/avatar, approved social messages, Firebase web config | Client-visible only when product-approved; still validate and omit internal fields. |
| Internal | Firebase UID mapping, account IDs, model/version metadata, hashed AI input, error codes, aggregate metrics | Backend/platform access; minimize retention; never use as client authorization. |
| Private | Email, friend/request relationships, visit history, subscription state, user Fairy/check-in metadata | Authenticated responses with server-side ownership/relationship checks. |
| Highly Sensitive | Journal/emotion content, AI input/output derived from private content, ID tokens, service credentials, DB URLs, private keys, raw security evidence | Approved protected systems only; no unnecessary logs/analytics/model context; explicit retention and rotation. |

Journal and emotion are Private/Highly Sensitive depending on whether raw
content or derived inference is involved. Tokens and credentials never enter
model context or this file. Firebase UID is Internal unless intentionally
exposed as a public product identifier. Backups inherit the most sensitive
class they contain.

## Advanced Security Items

These eight items are additional review items supplied with the backlog. They
do not replace or merge any P0/P1/P2 item.

1. **Hardware-key / Passkey 级管理员保护** — 🔒 BLOCKED / MANUAL ACTION
   REQUIRED: enable and test passkeys/security keys for production admins.
2. **Account recovery 安全** — 🔒 BLOCKED / MANUAL ACTION REQUIRED: review
   recovery, MFA reset, support override, identity proofing, and bypass tests.
3. **Short-lived service credentials / workload identity** — 🟡 PARTIAL:
   Worker bearer is server-only but static; evaluate short-lived signed
   requests or workload identity.
4. **Production admin access isolation** — 🔒 BLOCKED / MANUAL ACTION REQUIRED:
   separate deploy, migration, Firebase, and Cloudflare roles; prohibit shared
   accounts and require audited elevation.
5. **Database second-layer tenant isolation / PostgreSQL RLS feasibility** —
   🟡 PARTIAL: application ownership checks exist; RLS feasibility and policy
   design are not implemented or verified.
6. **Outbound egress restriction + data-exfiltration detection** — ⬜ TODO:
   define allowed API/Worker egress and alert on anomalous destination/volume.
7. **Production / backup credential isolation** — 🔒 BLOCKED / MANUAL ACTION
   REQUIRED: separate principals, storage, and recovery paths; test that app
   compromise cannot read/delete backups.
8. **真正的 independent red-team / pentest** — 🔒 BLOCKED / MANUAL ACTION
   REQUIRED: commission independent scoped testing and track high/critical
   remediation to closure.

## New Findings / Proposed Additions

No new risk is inserted into the canonical backlog by this audit. The public
`/api-docs/` observation is recorded under the existing canonical
**Debug / Admin / Internal Endpoint Exposure** item rather than duplicated.

## Final Security P0 Closure Summary

Repo Security P0 code work is **COMPLETE**. There is no remaining repo-level
P0 blocker. Unresolved items are provider/manual or optional compliance
hardening and do not change repo-complete status.

Provider/manual unresolved items:

- Historical `DATABASE_URL` revocation proof remains **ACTION REQUIRED / UNCERTAIN** because the old endpoint was unreachable; neither revoked nor still-valid is claimed.
- Database runtime/migration role separation and grants remain **PROVIDER-LIMITED / NOT VERIFIED**. AuditEvent Level 2 is not a repo P0 blocker.

Optional/compliance hardening:

- Clarify exact Workers AI inference retention duration.
- Define regional/data-residency requirements if PetalPal later needs them.
- Retain plan-limited provider controls as **PARTIAL / PROVIDER-LIMITED**; no plan upgrade is a P0 requirement.

Security P0 may be treated as repo-complete while the unresolved provider items
remain documented.

## Final Global Security P0 Checkpoint

- Repository P0 code status: **PASS**. HTTP/Socket authorization, mass-assignment protection, Daily Grow replay/race handling, structured logging, correlation/spoof resistance, prompt-injection/model-output regression, secret scan, and AuditEvent Level 1 are complete.
- GitHub: **PASS**. Render: **PARTIAL / PLAN-LIMITED**. Cloudflare: **PASS**. Firebase/Google: **PASS**. Backup/restore: **PARTIAL**; backup existence and isolated restore drill PASS, while provider retention/encryption/access metadata remain incomplete.
- Workers AI data handling and DPA: **PASS**. Workers AI inference retention: **PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED**. Data residency: **NOT VERIFIED / OPTIONAL HARDENING**.
- AuditEvent Level 2: **PROVIDER-LIMITED / NOT VERIFIED**. Historical `DATABASE_URL`: **ACTION REQUIRED / UNCERTAIN**.
- True remaining repo P0 blockers: **NONE**. Remaining items are provider/manual unresolved work or optional compliance hardening, not repo P0 blockers.
- Final classification: **P0 CLOSED WITH DOCUMENTED LIMITATIONS**.

## 2026-10 Feature Security Delta Review

| ID / priority | Finding and evidence | Exact next code/test action |
| --- | --- | --- |
| DELTA-P1-2 | **TESTED follow-up: atomic report final-write fencing implemented (2026-10-06).** `lib/report-write-fence.js` locks the consent epoch, current RUNNING claim (owner/type/period/version + worker/attempt/claim timestamp + live DB-clock lease), source Events/memories and owner period settings. Current/prior-period source snapshots and selected evidence are rechecked; report/evidence writes and guarded SUCCEEDED completion share one transaction. Final lease expiry rolls everything back. `lib/ai-events.js` takes the same owner/source locks before report discovery/deletion; worker heartbeat/failure/cancellation also carry claim generation. No schema migration, provider call or local DB/container change. | **98 unique scoped tests PASS; 33 added tests.** `test/back/report-worker.test.js` covers Weekly/Monthly revoke/regrant, deletion/revision/ineligibility/period changes, expired/reclaimed/same-ID leases, competing paused workers, rollback, retry/replay and forged owners. `test/back/report-write-fence.test.js` executes fence SQL in fresh in-memory PGlite tables and checks DB-clock expiry/atomic rollback and delete-lock ordering. AI foundation/lifecycle, async dispatch, Event/private report routes and account deletion regressions pass; changed JS syntax/diff checks pass. **Not VERIFIED:** no isolated `REAL_POSTGRES_DATABASE_URL` configured; independent-connection PostgreSQL contention, deployed triggers and deadlock/retry behavior remain untested. Next: run those isolated interleavings without accessing development/production data. |
| DELTA-P1-3 | **TESTED follow-up: realtime revocation and flood fencing implemented (2026-10-06).** `lib/auth.js` retains private token context and revalidates Firebase identity/current profile for actions and delivery; no completed authorization cache. `lib/socket-security.js` rechecks Garden privacy/confirmed friendship for sender and each recipient. `server.js` wraps privacy OFF, bilateral unfriend and account deletion in pending-revocation gates and socket generations, evicting rooms/disconnecting users before and after mutation; paused/stale joins or movements cannot restore revoked access. Idle sessions recheck every 5 seconds; reconnect uses fresh authentication. JSON-only packets are capped at 8 KiB; movement schema is capped at 2 KiB with finite/bounded coordinates and token-derived actor/display identity. | **43 scoped tests PASS, including 22 new realtime cases.** `test/back/realtime-security.test.js` uses actual ephemeral HTTP/Socket.IO WebSocket and polling transports with deterministic Prisma/Firebase stubs: authorized/forged/cross-owner joins/actions, privacy/unfriend revoke and revoke→regrant paused joins, paused movement/session revocation, latest-join ordering, revoked private recipients, idle/account deletion/reconnect, malformed/oversized/binary payloads, flood/reconnect/shared-user/concurrency bounds. All 60 movement actions/events at 60 Hz pass. Movement buckets: 90/s per socket (burst 90), 180/s per user (burst 180); control per action: 5/s (burst 10), user 10/s (burst 20); total packet and inflight/connection bounds also apply. Existing auth/config/HTTP limiter/account/Garden/Socket/Flower social regressions pass; stale social transaction fixture corrected to remain DB-free. **Not VERIFIED:** live Firebase disabled/revoked/expired-token propagation and movement latency remain untested; in-flight verification is coalesced, already-sent frames cannot be recalled. Budgets/revocation generations are process-local; remote adapter snapshots fail closed, and shared-store/distributed delivery is not implemented or certified. No migrations, local DB/provider calls or capacity claim. |
| DELTA-P1-4 | **TESTED follow-up: shared AI call ceilings and durable non-replay reservations (2026-10-06).** `lib/ai-cost-gate.js` uses the existing non-cascading `AuditEvent` table, its primary key and one short PostgreSQL transaction advisory lock shared by all instances. It checks the current owner and, for job work, active memory consent/current RUNNING claim generation/live DB-clock lease; atomically checks UTC-day owner/action/global/provider allowances and commits a reservation before external work. Logical owner/action/period-or-resource/version reservations survive retry, reclaim, midnight, job deletion and account deletion; no failure refunds. Reports reserve an upper bound of two calls (one retrieval + one narrative); production narrative attempts remain one. Remote embedding, Event emotion/preview and speech each reserve one call. Existing unique job create-or-return, SKIP LOCKED/leases, report final-write fences and finalized replay remain; worker failures persist/log only safe codes/messages. | **125 scoped tests PASS; 13 added tests.** `test/back/ai-cost-gate.test.js` executes actual SQL in fresh in-memory PGlite tables: duplicate/concurrent triggers and reservations, independent gate objects sharing one ledger, per-user/action isolation, global/provider bounds, retry/reclaim/deletion/midnight, expired/forged claims, consent denial, missing owners, zero/invalid configuration, DB fail-closed, paid embedding/speech preflight and failure redaction. Worker/route regressions cover normal reports, safe pre-inference retry, finalized replay, blocked competing/ambiguous inference, atomic report rollback/final fences and Event save without paid work on quota denial; auth/Socket/dispatch/HTTP limiter tests pass. **Not VERIFIED:** no isolated independent-connection PostgreSQL or live-provider calls; PGlite serializes transactions. Counters bound server-authorized external call attempts, not currency or provider-internal retries/direct credential use. All instances must share the same PostgreSQL primary and policy; ledger rows must not be pruned/reset to re-enable old operations. A crash/timeout or persistence failure after reservation can leave a report unavailable: automatic inference replay is deliberately blocked; safe recovery needs provider idempotency or durable results. Historical queue/period aggregate bounds and production pool/query deadlines remain separate unfinished controls; general HTTP limits remain process-local. No schema change/migration, environment file, provider plan/billing or local DB/container change. |

AI cost gate defaults (UTC-day windows, server-only): `AI_USER_DAILY_CALL_LIMIT=300`, `AI_GLOBAL_DAILY_CALL_LIMIT=10000`, `AI_PROVIDER_DAILY_CALL_LIMIT=10000`; `AI_WEEKLY_REPORT_DAILY_LIMIT=4`, `AI_MONTHLY_REPORT_DAILY_LIMIT=2`, `AI_EMBEDDING_GENERATION_DAILY_LIMIT=200`, `AI_EVENT_EMOTION_DAILY_LIMIT=100`, `AI_SPEECH_TRANSCRIPTION_DAILY_LIMIT=20`. Action limits count logical reservations; user/global/provider limits count reserved maximum external calls (reports 2, other actions 1). Nonnegative integers up to 1000000 only; zero disables that allowance and malformed configuration fails closed. Rejected reservations do not consume quota; attempted/ambiguous reservations remain charged. No input text, audio, model result, secret or provider credential is stored in this ledger.
