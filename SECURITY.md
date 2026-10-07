# PetalPal Security

## Security Status

Last updated: 2026-10-06

This file is the canonical implementation record for **PetalPal Security
Threat Model & Remediation Backlog — v2**. Every P0/P1/P2 item is retained as
an independent entry; no item has been deleted, merged, or reprioritized.
`✅ VERIFIED` requires explicit evidence for the stated completion criterion;
none is newly claimed by this documentation reconciliation. Historical provider PASS evidence retains its original scope.

| Priority | ✅ VERIFIED | ✅ TESTED | ✅ IMPLEMENTED | 🟡 PARTIAL | 🔒 MANUAL | ⬜ TODO | ⚪ N/A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0 | 0 | 5 | 3 | 19 | 0 | 0 | 0 |
| P1 | 0 | 3 | 1 | 9 | 5 | 5 | 0 |
| P2 | 0 | 0 | 0 | 8 | 2 | 2 | 5 |

Counts cover canonical backlog rows only; delta findings are cross-references, not extra rows. `🔒 MANUAL` includes blocked/manual-action rows; `⚪ N/A` includes not-applicable rows.

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
| Socket handshake/user/garden/movement | Token auth; user room and movement actor are token-derived; garden access requires current privacy/friendship authorization; delivery rechecks recipients | `lib/socket-security.js`, `test/back/realtime-security.test.js` |
| POST `/events`, GET/DELETE `/events/:eventId` | A + O; actor derived from token; source lifecycle fenced | `lib/ai-events.js`, Event route tests |
| GET `/ai/memories/:memoryId`, `/ai/reports`, `/ai/reports/:reportType/:reportId` | A + O; metadata discovery and owned detail; revoked-consent read policy remains DELTA-P1-1 | AI Event/private report route tests |
| POST `/ai/reports/weekly/trigger` | A + O; versioned create-or-return; current claim/consent/source final fence and shared pre-provider quota | Report worker/fence/cost tests |
| POST `/speech/transcribe` | A; bounded audio, paid preflight and no-store response; no Event creation | Speech/cost gate tests |
| Internal AI job discovery/execution | Private service authentication; opaque job IDs; canonical owner/consent/lease checks | Async dispatch/route tests; LONG_TERM_AI.md recorded Queue cutover |

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
| API Authorization / IDOR / BOLA | 🟡 PARTIAL | Historical HTTP mutation inventory and owner/forged-field regressions retained. Current Event/memory/report paths are owner-scoped; report final writes and Socket joins/actions/recipient delivery now have explicit negative and revocation coverage (DELTA-P1-2/3). No longer missing Socket coverage. Complete current-route/Firebase E2E and independent PostgreSQL/distributed deployment validation remain; historical 21-route inventory is not a current total. |
| Privilege Escalation / Mass Assignment | 🟡 PARTIAL | HTTP allowlists and server-controlled identity/entitlement guards retained. Current report claims/evidence and Socket movement identity cannot come from client actor fields; forged/cross-owner negatives pass (DELTA-P1-2/3). Broader current field-by-field runtime coverage and live-provider verification remain. |
| Client Token Storage & Leakage Prevention | ✅ TESTED | Web ID tokens are not manually persisted in localStorage; API/Socket use current Firebase session tokens. Client tests and mobile auth/session regressions are recorded. Native Firebase uses AsyncStorage persistence; secure credential storage, backup and durable logout-cache erasure are not certified (DELTA-P2-2). |
| Service-to-Service Authentication | ✅ TESTED | Environment-only Worker bearer and fail-closed Worker input/output controls retained. Queue/private executor carries opaque job IDs; canonical owner/consent/claim checks stay on the backend (`lib/ai-async-dispatch.js`, async route/dispatch tests). The 2026-09-29 production Queue contract is recorded in LONG_TERM_AI.md; latest fences/cost controls are locally tested, not newly production-verified. Manual deployment/rotation remains separate. |
| AI Cost & Resource Abuse Protection | 🟡 PARTIAL | Daily Grow replay/20-concurrent-request evidence, input bounds, timeouts and fallback retained. Commit `8cf1a6e` adds shared PostgreSQL owner/action/day quotas, global/provider call ceilings, zero-limit shutdown, durable non-replay reservations and pre-provider gates for reports/retrieval, remote embeddings, Event emotion/preview and speech (DELTA-P1-4; 125 scoped tests PASS). These are call-attempt ceilings, not currency budgets; provider/direct-credential spend, independent-connection/deployed shared enforcement, queue/aggregate bounds and crash-after-reservation availability remain unresolved. |
| Multi-Dimensional Abuse Prevention | 🟡 PARTIAL | User/IP HTTP limits remain process-local; Socket per-socket/user/action/packet/inflight bounds are tested (DELTA-P1-3). Paid AI adds durable owner/action/global/provider allowances (DELTA-P1-4). Combined IP/account anomaly detection, registration abuse and distributed realtime enforcement remain incomplete. |
| Trusted Proxy / Client IP Configuration | ✅ TESTED | Express `trust proxy` defaults false; explicit hop/address configuration is validated in `lib/security-config.js` and `test/back/security-config.test.js`. Verify the Render/Cloudflare chain manually before enabling a value. |
| Request Size / JSON Body Bomb | ✅ TESTED | General Express JSON limit remains 32 KB with bounded fields/depth/keys/arrays. Route-specific exceptions include authenticated speech (12 MB parser, 8 MB validated audio) and bounded preview input; the generic limit is not universal. Speech signature/format/base64/size and Socket packet bounds have scoped test evidence. Production aggregate resource limits remain separate. |
| Sensitive Logging & Observability Security | 🟡 PARTIAL | Structured errors/events omit stacks, bearer-like values and private text; worker failure persistence/results/logs now allow only safe codes and generic messages (DELTA-P1-4). Workers Logs invocation/persistence and recorded 3-day Free-plan retention retained. Remaining raw timing/socket logs, third-party telemetry and deployment-wide retention/redaction need operational review. |
| Debug / Admin / Internal Endpoint Exposure | 🟡 PARTIAL | Legacy auth remains 410; API docs are development-public and production fail-closed unless explicitly enabled, with unit evidence. Manual checklist records production API_DOCS_ENABLED=true absent (PASS at that review). New mobile preview/export policy remains unresolved (DELTA-P2-3); no blanket production-exposure certification. |
| Software Supply-Chain Security | 🟡 PARTIAL | Root/client lockfiles exist. `npm audit --omit=dev` on 2026-09-14 reported 10 transitive advisories: 4 high, 6 moderate, 0 critical. Add Dependabot/Renovate, SBOM, lifecycle review, and remediation SLA. |
| CI/CD & Release Security | 🟡 PARTIAL | No GitHub Actions workflow was found, so no CI permission/deploy evidence exists. Add least privilege, pinned trusted actions, protected main, review/status gates, and protected credentials; branch/deploy settings are manual. |
| Production / Development Environment Isolation | 🟡 PARTIAL | Client/public and Admin/Worker secrets remain separated. Manual Render/Cloudflare isolation reviews are PASS for their recorded scope; LONG_TERM_AI.md records separate production Queue dispatch and disabled staging reconciliation Cron (2026-09-29). Whole-environment DB/storage/credential isolation and current release artifact settings are not inferred from those checks. |
| Database Network Isolation & Least Privilege | 🟡 PARTIAL | Prisma uses `DATABASE_URL`; no separate migration credential is configured, so runtime/migration currently share the credential. `AuditEvent` Level 1 application-side create-only implementation and real local PostgreSQL validation are PASS. Level 2 is **PROVIDER-LIMITED / NOT VERIFIED**: current environment cannot verify production PostgreSQL role/grant capabilities, and Prisma pooled/direct URLs from one credential pair do not create role separation by themselves. This is not a repo P0 blocker; verify provider role/grant support and configure separate roles manually. |
| Backup, Restore & Ransomware Resilience | 🟡 PARTIAL | Backup existence and isolated restore drill are PASS. Provider-specific retention, encryption, and access-restriction metadata remain not independently verified. This is retained as provider-limited follow-up, not a repo P0 blocker. |
| Security Monitoring & Anomaly Detection | 🟡 PARTIAL | Server-generated request IDs and redacted auth/owner/rate/audit events retained. Durable AI reservations provide shared usage accounting, not an alerting system. Existing Cloudflare invocation/AI-usage monitoring PASS evidence retained; cross-instance security aggregation, spend/lease alerts, routing and production thresholds remain operational follow-ups. |
| Tamper-Resistant Security Audit Logging | 🟡 PARTIAL | `LEVEL_1`: durable selected `AuditEvent` persistence and application create-only repository are implemented and real local PostgreSQL validation is PASS. `LEVEL_2` is **PROVIDER-LIMITED / NOT VERIFIED**: DB-enforced runtime/migration role separation and INSERT-only grants remain unverified; do not claim INSERT-only grants or ALTER/DROP protection were verified. |
| Incident Response Runbook | ✅ IMPLEMENTED | Runbook is below and covers containment, disable/revoke, rotate, investigate, recover, verify, notify, and each named compromise scenario. No timed exercise was performed. |
| Systematic Threat Modeling | ✅ IMPLEMENTED | Trust-boundary/data-flow model and matrix are above. Formal review/sign-off remains outstanding. |
| Security Regression & Business Logic Test Suite | 🟡 PARTIAL | Historical auth/body/Worker/logging/Daily Grow suites and local AuditEvent Level 1 PostgreSQL validation retained. Report fences: 98 scoped tests/33 added; realtime revocation/flood: 43 scoped tests/22 added; AI cost: 125 scoped tests/13 added (overlapping suites, not additive totals). Deterministic stubs/PGlite do not prove independent-connection contention, live Firebase propagation, production alerting or load capacity. September production Queue evidence is separately scoped in LONG_TERM_AI.md. |
| LLM Trust Boundary & Prompt Injection Defense | 🟡 PARTIAL | Inference Worker schema/enum/bounds and malicious input/output regressions retained. Active owner-private RAG uses fixed instructions, serialized evidence, bounded aggregates and citation allowlists; final persistence rechecks owner/consent/source/lease (DELTA-P1-2). Unsupported semantic claims can still pass valid citations (DELTA-P2-1); no model-grounding certification. |
| LLM Secret Leakage Prevention | ✅ TESTED | Credentials remain in Worker/backend environment and are not model messages; Worker tests prove secret/provider/input details are not logged or returned. Cloudflare Workers AI Customer Content handling documents no model training or service improvement without explicit consent; applicable DPA terms are documented. Exact ordinary inference retention remains unspecified. |
| AI Memory / RAG Tenant Isolation | 🟡 PARTIAL | Journal excluded from emotion/long-term AI; Event owner derives from Firebase identity. Composite owner FKs, owner-scoped pgvector/profile/revision/eligibility checks, canonical evidence and Event/account deletion controls exist. September production Queue/BGE/vector retrieval smoke is recorded in LONG_TERM_AI.md. Current atomic report source/consent/claim fence is tested (DELTA-P1-2); independent PostgreSQL interleavings and revoked-consent derived-data read/cleanup policy remain unresolved (DELTA-P1-1). No external vector store is introduced. |
| Sensitive Data Classification & Minimization | ✅ IMPLEMENTED | Classification policy is below; cross-system retention/deletion is not yet verified. |
| AI Provider Data Exposure | 🟡 PARTIAL | Existing Cloudflare no-training-without-consent and DPA v6.4 evidence remains PASS. Data contracts now include selected private Event evidence/bounded report aggregates, embedding inputs and request-scoped speech audio; credentials and unrelated actor/profile fields stay server-side. Speech audio is not written/logged by the handler and is cleared after provider handling. Ordinary inference retention duration remains unspecified; new-flow provider policy/logging confirmation and Canada-only/single-region guarantees are NOT VERIFIED. See manual §7/§10. |

## 🟠 P1 — High Priority

| Canonical item | Status | Evidence / finding / next action |
| --- | --- | --- |
| Credential Stuffing / Brute Force | 🟡 PARTIAL | Firebase handles authentication and auth limiting is IP-keyed. Verify Firebase anti-abuse and high-risk re-auth manually. |
| Account Enumeration | ⬜ TODO | Uniform login/register/reset behavior has not been tested; Firebase and session setup responses need review. |
| Account & Session Lifecycle Security | 🟡 PARTIAL | Owner account-delete/rollback and current Socket profile/token revalidation, idle checks and reconnect revocation are tested (DELTA-P1-3). Complete reset/change-email/logout/revoke matrix, live Firebase propagation and native durable erasure remain unverified. AI-consent derived-data cleanup/read gap remains DELTA-P1-1. |
| SQL / ORM Logic Injection | ✅ TESTED | Structured Prisma filters; new pgvector/lease SQL uses constant statements with bound parameters despite `$queryRawUnsafe` naming. Owner/profile/revision predicates reviewed in `lib/semantic-retrieval.js`; real PostgreSQL isolation matrix not rerun in this delta. |
| API Flood / DoS | 🟡 PARTIAL | Socket payload/action/user/inflight bounds and shared paid-AI call ceilings are TESTED (DELTA-P1-3/4). General HTTP limits remain process-local; historical queue/aggregate bounds and deployment capacity/deadlines remain incomplete. |
| Database Connection Exhaustion | 🟡 PARTIAL | Prisma PostgreSQL pool exists; query timeouts, concurrency controls, and pool monitoring are not evidenced. |
| Race Conditions | 🟡 PARTIAL | Daily Grow 20-request evidence retained. Report source/consent/claim/lease final fencing and shared non-replay cost reservations are tested (DELTA-P1-2/4); Socket paused-work revocation is tested (DELTA-P1-3). PGlite serializes transactions; independent PostgreSQL contention/deadlock/retry and multi-instance runtime verification remain unresolved. |
| XSS / HTML / URL Injection | 🟡 PARTIAL | React escapes text and no raw HTML feature was found; no explicit sanitizer or URL-scheme allowlist for future WebView/link rendering. |
| CORS Misconfiguration | ✅ TESTED | Explicit `CORS_ALLOWED_ORIGINS` allowlist protects HTTP and Socket.IO; evidence: `lib/security-config.js`, `server.js`, `test/back/security-config.test.js`. Production origin list requires review. |
| Cache / CDN Cross-User Leakage | 🟡 PARTIAL | Worker no-store retained; new private memory/report/Garden/session reads lack explicit application no-store and deployed CDN policy is unverified (DELTA-P2-4). |
| DNS / Domain Account Hijacking | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Enable registrar/Cloudflare MFA, restrict DNS members, and enable DNSSEC where supported. |
| Malicious Model Output / AI JSON Injection | ✅ TESTED | Worker schema/enum/bounds and backend citation allowlists tested. Syntactically valid but unsupported report claims still pass (DELTA-P2-1); do not equate citation presence with semantic grounding. |
| Cloud Configuration Review | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Existing GitHub/Render/Cloudflare/Firebase account and configuration reviews retain their recorded PASS scopes. New feature deployment policy, shared AI ledger/quotas, runtime grants, live revocation and private caching need manual checks (§10); provider/plan limitations are not blanket failures or new verification. |
| SAST / Static Security Analysis | ⬜ TODO | No CodeQL/Semgrep or equivalent PR-blocking scan found. |
| DAST / API Fuzzing | ⬜ TODO | No staging fuzz/security-scan job or release gate found. |
| Runtime Security Headers | ⬜ TODO | Hosted-web CSP/HSTS/nosniff/frame policy remains TODO; provider deployment verification belongs in the manual checklist. See DELTA-P2-4. |
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
| Malicious File Upload | 🟡 PARTIAL | Authenticated speech ingestion is now present: bounded M4A/WebM/Ogg base64/signature/size validation, request-only audio and safe output/error handling are tested (`test/back/speech-transcription.test.js`). Paid speech preflight is covered by DELTA-P1-4. No general attachment/file storage API; deployed provider handling/resource limits remain unverified. |
| Regex DoS / Event Loop Blocking | 🟡 PARTIAL | Only bounded simple ID regexes; audit future custom patterns. |
| Slow Query / Expensive Search | 🟡 PARTIAL | Bounded `take` values and user timeline indexes exist; timeouts/pagination/result policy incomplete. |
| Indirect Prompt Injection | 🟡 PARTIAL | Active private Event retrieval now crosses the report-model boundary. Fixed system instructions, serialized user evidence and citation allowlists tested; semantic unsupported-claim rejection incomplete (DELTA-P2-1). |
| RAG Poisoning / Source Integrity | 🟡 PARTIAL | Owner-private retrieval/embedding revisions and atomic report final source existence/owner/currentness/period/consent/lease checks are now tested (DELTA-P1-2). Deletion ordering and rollback tested in PGlite; independent PostgreSQL races and semantic claim correctness remain unresolved (DELTA-P2-1). |
| Scraping / Bot Management / WAF | 🔒 BLOCKED / MANUAL ACTION REQUIRED | App limits exist; Cloudflare WAF/managed rules/bot signals are not verified. |
| Push Notification Privacy | ⚪ NOT APPLICABLE | No push feature. Trigger: locked-device notifications. |
| Root / Jailbroken Device Risk | 🟡 PARTIAL | Native Firebase persistence now explicitly uses AsyncStorage (`mobile/src/services/firebase.ts`), not OS secure credential storage. Identity-scoped placement caches are cleared in memory on logout; durable cache erasure not implemented (DELTA-P2-2). |
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

Canonical backlog items remain unchanged in identity/priority. The 2026-10 delta records feature-specific findings and tested follow-ups; it does not add those findings to canonical summary counts or certify release readiness.

## Final Security P0 Closure Summary

The **2026-09-16 historical P0 closure** was repo-complete with documented limitations. This reconciliation finds no new P0 in the reviewed delta; it does not assert all current backlog rows are complete or grant release approval. New feature P1/P2 gaps and deployment checks remain below.

Provider/manual unresolved items:

- Historical `DATABASE_URL` revocation proof remains **ACTION REQUIRED / UNCERTAIN** because the old endpoint was unreachable; neither revoked nor still-valid is claimed.
- Database runtime/migration role separation and grants remain **PROVIDER-LIMITED / NOT VERIFIED**. AuditEvent Level 2 is not a repo P0 blocker.

Optional/compliance hardening:

- Clarify exact Workers AI inference retention duration.
- Define regional/data-residency requirements if PetalPal later needs them.
- Retain plan-limited provider controls as **PARTIAL / PROVIDER-LIMITED**; no plan upgrade is a P0 requirement.

Historical P0 closure is preserved; current feature readiness still depends on the unresolved delta and deployment checks.

## Final Global Security P0 Checkpoint

- Historical repository P0 checkpoint: **PASS (2026-09-16 scope)**. Existing HTTP/Daily Grow/logging/audit evidence retained. Current report-write, Socket revocation/flood and shared AI-cost follow-ups are **TESTED**, not production VERIFIED; canonical partial statuses and feature limitations remain.
- GitHub: **PASS**. Render: **PARTIAL / PLAN-LIMITED**. Cloudflare: **PASS**. Firebase/Google: **PASS**. Backup/restore: **PARTIAL**; backup existence and isolated restore drill PASS, while provider retention/encryption/access metadata remain incomplete.
- Workers AI data handling and DPA: **PASS**. Workers AI inference retention: **PARTIAL / EXACT INFERENCE RETENTION NOT SPECIFIED**. Data residency: **NOT VERIFIED / OPTIONAL HARDENING**.
- AuditEvent Level 2: **PROVIDER-LIMITED / NOT VERIFIED**. Historical `DATABASE_URL`: **ACTION REQUIRED / UNCERTAIN**.
- No new repo P0 identified in the reviewed delta. Historical P0 closure does not close current feature P1/P2 gaps or pending provider/deployment checks.
- Final classification: **P0 CLOSED WITH DOCUMENTED LIMITATIONS**.

## 2026-10 Feature Security Delta Review

Scope: Security closure `2a4eb0b` (2026-09-16) → `8cf1a6e69f9f96bbbee8310c947b045b210e8972` (2026-10-06 HEAD), plus restored feature work in `c60a90d`; branch `integration/mobile-backend-test`. Reviewed changed Calendar/mobile auth/navigation, report/AI/pgvector/consent/dispatch and Garden privacy/realtime boundaries only. No rendering/performance re-audit, implementation changes, migrations, local DB/container access, provider calls or deployment review. Historical P0 closure remains historical; this section is not a release approval.

**Result:** no new repo P0 found in this scope; 4 new/changed P1 and 4 new/changed P2 findings. P1-2/3/4 have TESTED follow-ups with explicit deployment/availability limitations; P1-1 remains open. Canonical backlog rows above point here rather than duplicating findings.

| ID / priority | Finding and evidence | Exact next code/test action |
| --- | --- | --- |
| DELTA-P1-1 | **AI consent revoke does not clean or gate all derived data.** `server.js:1741` cancels pending/running jobs but retains EventMemory, vectors, evidence and saved reports. `lib/event-memory.js:126` and private report detail reads check ownership but not current consent. Synthetic revoked-memory read confirms no consent lookup. The embedding ADR already records cleanup as a target, not implemented behavior. | Define revoke/read/retention policy; implement transactional derived-data cleanup/access gates in consent handler and repositories; add revoke→memory/report-read and regrant regressions to `test/back/ai-event.route.test.js` / `ai-foundation.test.js`. Retain source Events per agreed policy. |
| DELTA-P1-2 | **TESTED follow-up: atomic report final-write fencing implemented (2026-10-06).** `lib/report-write-fence.js` locks the consent epoch, current RUNNING claim (owner/type/period/version + worker/attempt/claim timestamp + live DB-clock lease), source Events/memories and owner period settings. Current/prior-period source snapshots and selected evidence are rechecked; report/evidence writes and guarded SUCCEEDED completion share one transaction. Final lease expiry rolls everything back. `lib/ai-events.js` takes the same owner/source locks before report discovery/deletion; worker heartbeat/failure/cancellation also carry claim generation. No schema migration, provider call or local DB/container change. | **98 unique scoped tests PASS; 33 added tests.** `test/back/report-worker.test.js` covers Weekly/Monthly revoke/regrant, deletion/revision/ineligibility/period changes, expired/reclaimed/same-ID leases, competing paused workers, rollback, retry/replay and forged owners. `test/back/report-write-fence.test.js` executes fence SQL in fresh in-memory PGlite tables and checks DB-clock expiry/atomic rollback and delete-lock ordering. AI foundation/lifecycle, async dispatch, Event/private report routes and account deletion regressions pass; changed JS syntax/diff checks pass. **Not VERIFIED:** no isolated `REAL_POSTGRES_DATABASE_URL` configured; independent-connection PostgreSQL contention, deployed triggers and deadlock/retry behavior remain untested. Next: run those isolated interleavings without accessing development/production data. |
| DELTA-P1-3 | **TESTED follow-up: realtime revocation and flood fencing implemented (2026-10-06).** `lib/auth.js` retains private token context and revalidates Firebase identity/current profile for actions and delivery; no completed authorization cache. `lib/socket-security.js` rechecks Garden privacy/confirmed friendship for sender and each recipient. `server.js` wraps privacy OFF, bilateral unfriend and account deletion in pending-revocation gates and socket generations, evicting rooms/disconnecting users before and after mutation; paused/stale joins or movements cannot restore revoked access. Idle sessions recheck every 5 seconds; reconnect uses fresh authentication. JSON-only packets are capped at 8 KiB; movement schema is capped at 2 KiB with finite/bounded coordinates and token-derived actor/display identity. | **43 scoped tests PASS, including 22 new realtime cases.** `test/back/realtime-security.test.js` uses actual ephemeral HTTP/Socket.IO WebSocket and polling transports with deterministic Prisma/Firebase stubs: authorized/forged/cross-owner joins/actions, privacy/unfriend revoke and revoke→regrant paused joins, paused movement/session revocation, latest-join ordering, revoked private recipients, idle/account deletion/reconnect, malformed/oversized/binary payloads, flood/reconnect/shared-user/concurrency bounds. All 60 movement actions/events at 60 Hz pass. Movement buckets: 90/s per socket (burst 90), 180/s per user (burst 180); control per action: 5/s (burst 10), user 10/s (burst 20); total packet and inflight/connection bounds also apply. Existing auth/config/HTTP limiter/account/Garden/Socket/Flower social regressions pass; stale social transaction fixture corrected to remain DB-free. **Not VERIFIED:** live Firebase disabled/revoked/expired-token propagation and movement latency remain untested; in-flight verification is coalesced, already-sent frames cannot be recalled. Budgets/revocation generations are process-local; remote adapter snapshots fail closed, and shared-store/distributed delivery is not implemented or certified. No migrations, local DB/provider calls or capacity claim. |
| DELTA-P1-4 | **TESTED follow-up: shared AI call ceilings and durable non-replay reservations (2026-10-06).** `lib/ai-cost-gate.js` uses the existing non-cascading `AuditEvent` table, its primary key and one short PostgreSQL transaction advisory lock shared by all instances. It checks the current owner and, for job work, active memory consent/current RUNNING claim generation/live DB-clock lease; atomically checks UTC-day owner/action/global/provider allowances and commits a reservation before external work. Logical owner/action/period-or-resource/version reservations survive retry, reclaim, midnight, job deletion and account deletion; no failure refunds. Reports reserve an upper bound of two calls (one retrieval + one narrative); production narrative attempts remain one. Remote embedding, Event emotion/preview and speech each reserve one call. Existing unique job create-or-return, SKIP LOCKED/leases, report final-write fences and finalized replay remain; worker failures persist/log only safe codes/messages. | **125 scoped tests PASS; 13 added tests.** `test/back/ai-cost-gate.test.js` executes actual SQL in fresh in-memory PGlite tables: duplicate/concurrent triggers and reservations, independent gate objects sharing one ledger, per-user/action isolation, global/provider bounds, retry/reclaim/deletion/midnight, expired/forged claims, consent denial, missing owners, zero/invalid configuration, DB fail-closed, paid embedding/speech preflight and failure redaction. Worker/route regressions cover normal reports, safe pre-inference retry, finalized replay, blocked competing/ambiguous inference, atomic report rollback/final fences and Event save without paid work on quota denial; auth/Socket/dispatch/HTTP limiter tests pass. **Not VERIFIED:** no isolated independent-connection PostgreSQL or live-provider calls; PGlite serializes transactions. Counters bound server-authorized external call attempts, not currency or provider-internal retries/direct credential use. All instances must share the same PostgreSQL primary and policy; ledger rows must not be pruned/reset to re-enable old operations. A crash/timeout or persistence failure after reservation can leave a report unavailable: automatic inference replay is deliberately blocked; safe recovery needs provider idempotency or durable results. Historical queue/period aggregate bounds and production pool/query deadlines remain separate unfinished controls; general HTTP limits remain process-local. No schema change/migration, environment file, provider plan/billing or local DB/container change. |
| DELTA-P2-1 | **RAG citation checks do not reject unsupported semantics.** Retrieved injection text remained serialized model user data below fixed system instructions in a stub Worker probe. A provider claim of 9999 Events against aggregate count 2 was nevertheless accepted when citing `eventCount`. `lib/report-narrative.js:196` validates schema/citation membership, not entailment. No cross-tenant access or live model attack success demonstrated. | Add report-specific malicious-evidence and contradictory-claim cases to `test/back/prompt-injection.security.test.js` / `report-worker.test.js`; reject verifiably false aggregate claims and define safe unsupported-claim policy. |
| DELTA-P2-2 | **Native persisted credentials / durable derived cache.** `mobile/src/services/firebase.ts:22` uses Firebase AsyncStorage persistence; secure credential persistence/backup policy needs review. Logout scopes caches to null but does not delete durable owner placement metadata (`plantingPersistence.ts`), including derived emotions. No extra manually cached ID token found. | Review native secure persistence and backup exclusions; define logout/account-delete cache-erasure policy. Extend `mobile/test/authSession.test.mjs` and storage tests for account change, late responses, persistent erase and reload. |
| DELTA-P2-3 | **Production preview-route policy incomplete.** AuthGate wraps all routes; Calendar simulation and backend QA are DEV-gated. `/garden-test` is intentionally reused for real Fairy, but `treehouse-test` / `swing-test` lack universal production redirects and remain route files. Registration/navigation choices alone are not exclusion from exported builds. No backend auth bypass found. | Define an explicit production route allowlist/alias policy; test exported web/native deep links with `__DEV__=false`. Keep real `/feature/fairy` behavior and documented intentional aliases; gate only unintended previews. |
| DELTA-P2-4 | **Calendar/history wire minimization and private caching/headers.** Mobile Garden adapter drops raw content, but `server.js:654` owner Garden and `/session` still deliver Journal content and derived inference before client filtering; required by some legacy flows, unnecessary for Calendar/history metadata. Report discovery is metadata-only; detail responses include owner-authorized evidence. Explicit no-store is absent on these new private reads; deployed CDN/security headers were not inspected. | Add a minimal owner-authorized metadata contract without breaking legacy detail features, negative wire-field tests in `garden-response.test.js` / `private-report-list.test.js`, and private-response cache/header regressions. Verify CDN/CSP/HSTS/nosniff/frame policy via manual checklist. |


AI cost gate defaults (UTC-day windows, server-only): `AI_USER_DAILY_CALL_LIMIT=300`, `AI_GLOBAL_DAILY_CALL_LIMIT=10000`, `AI_PROVIDER_DAILY_CALL_LIMIT=10000`; `AI_WEEKLY_REPORT_DAILY_LIMIT=4`, `AI_MONTHLY_REPORT_DAILY_LIMIT=2`, `AI_EMBEDDING_GENERATION_DAILY_LIMIT=200`, `AI_EVENT_EMOTION_DAILY_LIMIT=100`, `AI_SPEECH_TRANSCRIPTION_DAILY_LIMIT=20`. Action limits count logical reservations; user/global/provider limits count reserved maximum external calls (reports 2, other actions 1). Nonnegative integers up to 1000000 only; zero disables that allowance and malformed configuration fails closed. Rejected reservations do not consume quota; attempted/ambiguous reservations remain charged. No input text, audio, model result, secret or provider credential is stored in this ledger.

### Reconciled history and limits of evidence

- `2a9a9fc` (2026-09-17): owner-scoped AI foundations, evidence/jobs and Worker contracts; `4235b31` / `05c065c` (2026-09-28): consent gates and worker shutdown/heartbeat/lease renewal; `a0bc4e5`: active Cloudflare embedding profile. `LONG_TERM_AI.md` → “Production Queue cutover and observation” records the 2026-09-29 authenticated opaque-job dispatch, duplicate/revoke/reconciliation and owner-scoped BGE/pgvector production smoke. It does not verify later October fences/cost gates, full report-provider grounding or long-run capacity.
- `03e719e`, `a9efcf8`, `8cf1a6e` (2026-10-06): report final-write fencing, Socket revocation/flood bounds and shared AI-cost reservations. Their separate test totals below overlap; none is a production/provider attestation. This documentation task ran no tests or provider actions.

- Calendar `calendarToday(..., false)` ignores simulated date; UI simulation is component-local/DEV-only and never sent by reflection browsing. Server `new Date()` and owner timezone derive default today/closed periods. Weekly `localDate` is an explicit historical-period selector, not server clock override; future/open periods rejected. Monthly generation is worker/service wiring, not a new public monthly trigger. UI historical browsing is GET-only.
- Reviewed semantic SQL: owner/Event/embedding joins and consent, eligibility, locale, profile/input revision and period predicates precede `ORDER BY`/`LIMIT`; constant SQL uses bound parameters. Composite schema FKs bind owner provenance. Owner memory/report reads and forged-owner trigger inputs tested. Real pgvector/production query plans and DB races were **not** executed.
- Worker → model boundary uses bounded whitelisted aggregates/evidence, fixed system instructions, serialized user data and output schema/citation allowlists; no raw Journal, credential or actor-control fields in the tested model contract. Provider calls in this pass were stubs; semantic truth is not certified.
- Consent row locks and embedding consent-epoch/source revision checks, extraction rechecks, job claim/lease/idempotency and finalized replay are covered by unit/stub tests. Report delete/regrant/revision/expired-lease final writes now use atomic fencing with scoped test evidence in DELTA-P1-2; independent PostgreSQL interleavings remain unverified. Event deletion cascades memory/vector/evidence/jobs in schema and deletes known affected reports; account deletion stub/rollback tests pass. Real FK/concurrency execution was not repeated.
- Token-derived Socket identity, private/social serialization and owner metadata-only report discovery pass. The original failing unfriend probe is addressed by the TESTED DELTA-P1-3 controls; 43 scoped HTTP/Socket regressions cover revocation, paused work, delivery privacy and flood bounds. No real Firebase/provider or DB-based privacy suite was run; distributed enforcement remains unverified.
- **Initial feature-delta review: 125 existing scoped tests PASS** (AI foundation/lifecycle/report worker, Event/report routes, socket/prompt boundary, async dispatch, account deletion, social serialization, Calendar/reflection/mobile auth). **5 additional synthetic probes** checked revoked read, unsupported claim, missing final-write freshness, unfriend broadcast and retrieved-text placement. No real DB/provider/production verification in that feature-delta pass; no load-capacity certification. This is separate from the September production Queue smoke and DELTA-P1-4’s later 125-test run.

Feature-release gates: consent-derived-data lifecycle remains open. DELTA-P1-2 report fencing, DELTA-P1-3 realtime revocation/flood controls and DELTA-P1-4 shared paid-AI call ceilings are TESTED with the explicit PostgreSQL, live-provider, distributed-enforcement and billing/availability limits above; no capacity or currency-spend certification. Existing provider/manual uncertainties remain in [MANUAL_SECURITY_CHECKLIST.md](MANUAL_SECURITY_CHECKLIST.md). Next single task: run isolated independent-connection PostgreSQL report fence/deletion/revoke/reclaim interleavings; do not use local development or production data.
