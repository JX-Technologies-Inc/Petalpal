# CodeQL #29 / #30 review — "Missing rate limiting" (2026-10-20)

Status: **analysis prepared; disposition is the owner's.** Nothing was dismissed, suppressed or changed in
GitHub. Evidence is from the public check-run annotations and the code on `main` `146ff23f`.

## What the alerts are

| Alert | Rule | Where it was raised (PR #60 head) | Same route on `main` `146ff23f` |
|---|---|---|---|
| #29 | `js/missing-rate-limiting` (High) — "This route handler performs authorization, but is not rate-limited." | `server.js:265` | `server.js:272` `POST /speech/transcribe` (voice input) |
| #30 | same | `server.js:268` | `server.js:275` `PUT /users/:userId/journals/:journalId/cover` (Journal cover photo) |

PR #101's CodeQL check on 2026-10-20 reported "No new alerts in code changed by this pull request", so both
are presumably still open on `main` (the alert list needs a signed-in view to confirm).

## Why CodeQL raises them

The rule only recognizes well-known rate-limit packages (such as `express-rate-limit` instances). PetalPal
uses its own limiter, `createRateLimiter` in [lib/rate-limit.js](../../lib/rate-limit.js), so CodeQL does not
see that these routes are limited.

## What actually protects the two routes

Both routes run, in this order, before any parsing, Firebase verification, database or provider work:

| Order | Middleware | Key | Default limit (env override) |
|---|---|---|---|
| 1 | `admissionRateLimit` | client IP (normalized; IPv6 /56; `TRUST_PROXY`-resolved, raw forwarding headers ignored) | 1200 / minute (`RATE_LIMIT_ADMISSION_MAX`, `_WINDOW_MS`) |
| 2 | `authenticateRequest` | — | — |
| 3 | `generalRateLimit` | signed-in user | 300 / 15 min (`RATE_LIMIT_GENERAL_MAX`, `RATE_LIMIT_WINDOW_MS`) |
| 4 | `aiRateLimit` (voice only) + `speechAdmission()` | signed-in user / global | 30 / 15 min (`RATE_LIMIT_AI_MAX`) plus concurrency bounds |

Over-limit requests get HTTP 429 with `Retry-After` and a content-free security event.

Evidence, re-run on 2026-10-20: `test/back/preauth-admission.route.test.js`, `test/back/speech-admission.test.js`
and `test/back/rate-limit.test.js` — **26/26 pass**. They show that invalid/missing tokens are throttled before
Firebase and database work, quotas survive IP rotation, forged forwarding headers cannot evade admission, and
voice work is bounded before parsing or provider reservation.

## Verdict

**False positive**: both routes are rate-limited, by a limiter CodeQL does not model.

Real limitation (not what the alert says): the limiter keeps counts in process memory, so limits are
per instance and reset on restart. That is acceptable for the current single-instance service and is already
tracked in [FUTURE_TODO.md](../../FUTURE_TODO.md) (shared store for multiple instances). Keep the production
Render service at one instance until that store exists.

Not recommended: wrapping the routes in `express-rate-limit` only to satisfy the scanner. It would change
tested behavior and add nothing.

## Owner steps

1. GitHub → **Security → Code scanning** → open alert **#29** → **Dismiss alert** → reason **False positive**,
   comment: `Rate-limited by lib/rate-limit.js createRateLimiter (admission by IP before auth, then per-user general and AI limits); CodeQL does not model the custom limiter. Tests: preauth-admission.route, speech-admission, rate-limit (26/26, 2026-10-20). See docs/release/CODEQL_29_30_REVIEW.md.`
2. Same for **#30**.
3. Confirm the production Render service runs **one instance**.
4. Tell me when done; I will record the disposition in `MANUAL_SECURITY_CHECKLIST.md` and `SECURITY.md`.
