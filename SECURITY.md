# PetalPal Security

## Security Status

Last updated: 2026-09-14

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
| Socket handshake/user/garden/movement | Token auth; user room is token-derived; garden is currently social | `server.js:79-188` |

Legacy authentication endpoints return `410`: `/register`, `/login`,
`/auth/email-code/request`, `/auth/email-code/verify`,
`/legacy-register-disabled`, and `/legacy-login-disabled`.

## 🔴 P0 — Critical / Launch Blockers

Each row preserves the canonical project name exactly. Evidence is limited to
what was inspected or tested; “manual” means platform/account action remains.

| Canonical item | Status | Evidence / finding / next action |
| --- | --- | --- |
| Secrets Management & Leakage Prevention | 🟡 PARTIAL | `.gitignore` excludes `.env`; no current tracked live-looking credential was found. History contains a public Firebase web config and a database URL finding documented as rotated/revoked in `PROJECT_PROGRESS.md`, not independently verified here. Run GitHub Secret Scanning/history scan; inventory and rotate platform secrets manually. |
| Production Control-Plane Account Security | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Enable passkeys/strong MFA, least privilege, member cleanup, and no shared accounts for GitHub, Render, Cloudflare, Firebase, and Google. |
| API Authorization / IDOR / BOLA | 🟡 PARTIAL | Firebase UID mapping, `requireOwnUser`, owner-scoped private queries, and social serialization exist. Evidence: `lib/auth.js`, `test/back/auth.test.js`, `security-baseline.test.js`, `garden-response.test.js`, `flower-social-mutations.test.js`. Complete the full User A→User B negative matrix. |
| Privilege Escalation / Mass Assignment | 🟡 PARTIAL | Mutators select explicit fields and derive owner/entitlement/AI state server-side; `lastEvent` tampering is tested. Add all-endpoint rejection/ignore tests for role/admin/isAdmin/vip/premium/owner/ownerId/userId. |
| Client Token Storage & Leakage Prevention | ✅ TESTED | ID tokens are no longer persisted in localStorage; API/Socket use current Firebase session tokens. `client/src/api.js`, `client/src/App.jsx`, `client/src/Auth/firebaseSession.js`, and client tests are evidence. Native secure storage/crash-report behavior remains deployment-specific. |
| Service-to-Service Authentication | ✅ TESTED | Backend sends Worker bearer from environment only; Worker rejects callers before AI and validates input/output. Evidence: `lib/emotion-classifier.js`, `cloudflare-worker/src/index.js`, `test/back/cloudflare-emotion-worker.test.js`. Rotate and verify production secret manually; consider short-lived credentials. |
| AI Cost & Resource Abuse Protection | 🟡 PARTIAL | Authenticated-user AI limiter, Daily Grow uniqueness, 2,000-char input bound, timeout, and deterministic fallback exist. Durable daily/action quotas, global budget, provider ceiling, and multi-instance shutdown are absent. |
| Multi-Dimensional Abuse Prevention | 🟡 PARTIAL | Current controls combine user-keyed AI/general limits and IP-keyed auth limits. No durable account+IP+action+global signal or registration anomaly detection. |
| Trusted Proxy / Client IP Configuration | ✅ TESTED | Express `trust proxy` defaults false; explicit hop/address configuration is validated in `lib/security-config.js` and `test/back/security-config.test.js`. Verify the Render/Cloudflare chain manually before enabling a value. |
| Request Size / JSON Body Bomb | ✅ TESTED | 32 KB Express JSON limit, bounded fields, 20-level depth, 1,000 object keys, and 1,000-item arrays. Evidence: `lib/http-errors.js`, `lib/daily-flower-input.js`, `test/back/security-baseline.test.js`. |
| Sensitive Logging & Observability Security | 🟡 PARTIAL | `logServerError` and Worker logs omit exception text, stacks, bearer-like values, and journal text; tests prove it. Remaining raw timing/socket logs, retention, and third-party telemetry need production audit. |
| Debug / Admin / Internal Endpoint Exposure | 🟡 PARTIAL | No debug/admin/metrics route found; legacy auth is 410. `/api-docs/` is mounted before auth and is public; approve it or gate/disable it in production. |
| Software Supply-Chain Security | 🟡 PARTIAL | Root/client lockfiles exist. `npm audit --omit=dev` on 2026-09-14 reported 10 transitive advisories: 4 high, 6 moderate, 0 critical. Add Dependabot/Renovate, SBOM, lifecycle review, and remediation SLA. |
| CI/CD & Release Security | 🟡 PARTIAL | No GitHub Actions workflow was found, so no CI permission/deploy evidence exists. Add least privilege, pinned trusted actions, protected main, review/status gates, and protected credentials; branch/deploy settings are manual. |
| Production / Development Environment Isolation | 🟡 PARTIAL | Public Vite config and server-only Admin/Worker values are separated in `.env.example`; separate production/dev projects, DBs, storage, Worker secrets, and AI keys are not proved. Verify manually. |
| Database Network Isolation & Least Privilege | 🔒 BLOCKED / MANUAL ACTION REQUIRED | Prisma uses `DATABASE_URL`; repo cannot prove TLS/network exposure, runtime DB role, or migration/admin separation. Restrict network and use separate least-privilege roles. |
| Backup, Restore & Ransomware Resilience | 🔒 BLOCKED / MANUAL ACTION REQUIRED | No real encrypted backup/restore-drill artifact was found. Configure retention, encryption, isolated credentials, and restore to isolated test storage; record non-secret evidence. |
| Security Monitoring & Anomaly Detection | ⬜ TODO | Responses/logging cover basic 401/403/429/5xx behavior, but no durable alerts for auth failures, read volume, AI spend, or DB failures were found. |
| Tamper-Resistant Security Audit Logging | ⬜ TODO | No append-only/access-separated trail for auth failures, admin/deploy/config changes, authorization failures, or sensitive mutations was found. |
| Incident Response Runbook | ✅ IMPLEMENTED | Runbook is below and covers containment, disable/revoke, rotate, investigate, recover, verify, notify, and each named compromise scenario. No timed exercise was performed. |
| Systematic Threat Modeling | ✅ IMPLEMENTED | Trust-boundary/data-flow model and matrix are above. Formal review/sign-off remains outstanding. |
| Security Regression & Business Logic Test Suite | 🟡 PARTIAL | Existing tests cover missing token, owner checks, malformed/oversized input, rate limits, Worker auth/output, logging, and fallbacks. Replay, expired-token integration, complete mass assignment, forged-owner, and true 20-request race tests remain. |
| LLM Trust Boundary & Prompt Injection Defense | 🟡 PARTIAL | Journal is user content; Worker has inference-only capability; model output is schema-validated and cannot directly authorize/set owner/VIP. Add explicit prompt-injection tests and reauthorize future tools server-side. |
| LLM Secret Leakage Prevention | ✅ TESTED | Credentials remain in Worker/backend environment and are not model messages; Worker tests prove secret/provider/input details are not logged or returned. Production/provider retention needs manual review. |
| AI Memory / RAG Tenant Isolation | ⚪ NOT APPLICABLE | No production memory, embedding, or RAG retrieval path exists. Trigger: adding memory/Vectorize/retrieval; then bind every record to owner and add User A→User B tests. |
| Sensitive Data Classification & Minimization | ✅ IMPLEMENTED | Classification policy is below; cross-system retention/deletion is not yet verified. |
| AI Provider Data Exposure | 🟡 PARTIAL | Worker receives only required text; API does not send UID/email/Authorization/DB credentials/unrelated profile data. Provider retention/training/DPA settings require manual confirmation. |

## 🟠 P1 — High Priority

| Canonical item | Status | Evidence / finding / next action |
| --- | --- | --- |
| Credential Stuffing / Brute Force | 🟡 PARTIAL | Firebase handles authentication and auth limiting is IP-keyed. Verify Firebase anti-abuse and high-risk re-auth manually. |
| Account Enumeration | ⬜ TODO | Uniform login/register/reset behavior has not been tested; Firebase and session setup responses need review. |
| Account & Session Lifecycle Security | ⬜ TODO | No complete reset/change-email/logout/delete/revoke matrix or rapid session invalidation policy found. |
| SQL / ORM Logic Injection | ✅ TESTED | Structured Prisma filters and one parameterized tagged advisory-lock query; no unsafe raw SQL helper found. Add dedicated filter-injection negatives. |
| API Flood / DoS | 🟡 PARTIAL | In-process general/AI limits and body bounds exist; route-specific concurrency, universal timeouts, and shared enforcement are missing. |
| Database Connection Exhaustion | 🟡 PARTIAL | Prisma PostgreSQL pool exists; query timeouts, concurrency controls, and pool monitoring are not evidenced. |
| Race Conditions | 🟡 PARTIAL | Daily uniqueness and transactions/advisory locks exist; required 20-concurrent-request test was not run. |
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
| WebSocket / Socket.IO Authorization | 🟡 PARTIAL | Handshake/user-room auth exists; garden rooms are social/public. Private rooms require ownership/message limits. |
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
