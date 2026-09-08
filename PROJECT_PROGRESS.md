# Project Progress

Last updated: 2026-09-08
Current phase: Month 1 — P0 implementation complete/frozen; remaining P1 in progress

## DONE

- Fairy onboarding state/progress persistence and ordered onboarding events.
- Daily check-in with optional Journal; no-Journal path avoids AI.
- Prisma/PostgreSQL core schema and versioned migrations.
- Firebase ID-token verification, verified-email session creation, and owner guard.
- Render remains the core Node/Express backend; Cloudflare Workers AI is the external inference layer.
- Deterministic Flower Engine, structured Worker JSON, AI timeout/fallback.
- Transactional daily check-in/Journal/emotion/Flower creation with daily uniqueness.
- Flower placement model and persistence.
- Secret hygiene: local `.env` is ignored and removed from Git tracking.
- Database credential rotation completed: Render uses the new Prisma Postgres connection string and old connection strings are revoked.
- Month 1 security baseline: Firebase authentication covers private/business HTTP and socket entry points; owner-scoped private resources reject cross-user access; request bodies and sensitive text fields have server-side bounds; Auth/general/AI rate limits are active; external AI has an abort timeout and deterministic Daily Grow fallback; client errors and server logs are sanitized; environment-specific Firebase configuration is no longer hardcoded.
- Security regression coverage includes missing-token `401`, cross-user private-resource `403`, limit overflow `429`, malformed/oversized requests, real external-AI timeout behavior, transactional fallback consistency, and non-disclosure of internal error details.
- Cloudflare Worker dry-run passed, its shared secret was synchronized with Render, and the updated Worker was deployed successfully.
- Latest backend changes are pushed to GitHub; Render deployed successfully with no pending Prisma migrations, and the service is Live.
- All eight canonical Primary Bloom inputs normalize and validate consistently; legacy mood compatibility is preserved.
- Owner reads preserve Journal-linked Flower data; social garden reads use an explicit safe Flower allowlist.
- Production Cloudflare secondary-emotion output uses the shared 21-label contract; legacy five-label output is limited to primary fallback routing.
- All eight canonical Primary Blooms use explicit pools containing only existing approved species; canonical generation no longer uses a shared fallback.
- Route-level Month 1 vertical slice covers Mood/Journal, AI success/fallback, canonical Flower generation, transaction/idempotency, privacy, safe errors, and persisted reload.
- Web prototype now submits canonical Primary Bloom codes, restores Garden/Daily Grow state from `/session`, renders backend Flower placement, and handles duplicate Grow responses.
- Test deployments can explicitly set `DAILY_GROW_LIMIT_ENABLED=false` for repeated Daily Grow; production remains one-per-day when true or unset.
- `/session` exposes the non-secret Daily Grow limit state so the web test client keeps its form available when the limit is disabled.
- Owner Flower details expose stored secondary-emotion validation metadata; social Garden responses continue to exclude Journal and ML fields.
- ML validation data retrieval: `Journal` + `EmotionResult` + `DailyCheckIn` + `Flower` are linked through the existing Daily Grow relations and can later be joined/exported as journal text, Primary Bloom, secondary emotions, intensity, confidence, timestamp, and flower/result IDs. Purpose: private in-domain ML evaluation/error analysis only; not automatic training data.
- Backend suite: 74/74 passing, including database-restart persistence and Month 1 security regressions.
- OpenAPI covers all 34 production REST operations; `/api-docs/` Swagger UI is integrated and verified.

## IN PROGRESS

- Month 1 overall remains in progress while the remaining P1 work is completed.
- Remaining implementation-independent P1: full i18n/localization support and Fairy contextual interaction behavior.
- AI Fairy Response, Personalized Fairy Reflection, and the associated Prompt Engineering scope remain Month 1 P1. Their implementation will resume after the current ML/Gemini/evaluation track establishes the updated AI architecture.
- The ML/Gemini evaluation track continues independently and does not reopen the completed P0 implementation scope.
- Multi-instance rate-limit storage and broader production security infrastructure remain explicitly deferred.

## NEXT

- Keep Month 1 P0 implementation frozen unless a regression or acceptance-critical defect is found.
- Complete i18n/localization and define/implement Fairy contextual interactions.
- After the ML/Gemini/evaluation direction is settled, redefine and complete AI Fairy Response, Personalized Fairy Reflection, and Prompt Engineering against the new AI architecture.

## BLOCKED

- Production use of Candidate C-Lite remains explicitly out of scope pending an integration decision.

## Month 1 P0/P1 Status

- Month 1 P0: 28/28 DONE. P0 implementation is temporarily closed/frozen.
- Month 1 overall: IN PROGRESS until the remaining applicable P1 work is complete.
- P1 DONE: OpenAPI; Fairy Runtime State Machine; Time-based State Transitions; Fairy State Persistence; Garden Region & Historical Traceability.
- P1 remaining: i18n / Localization; Fairy Contextual Interaction; AI Fairy Response; Personalized Fairy Reflection; redefined Prompt Engineering.
- P1 superseded implementation detail: the original Fast / Low-cost LLM proposal. Do not add a separate low-cost LLM solely to reproduce the old roadmap; any future model choice should follow the updated AI architecture.

## Important Architecture Decisions

- Render owns the REST API and PostgreSQL writes; Cloudflare Workers AI is inference-only.
- User-selected Primary Bloom is authoritative; AI may add only secondary emotions.
- Daily Grow must complete through deterministic fallback when AI is unavailable.
- RAG, embeddings generation/search, long-term memory, Pomodoro, reconciliation, and R2 are not Month 1 work.
- Candidate C-Lite/21-label ML remains experimental and disconnected from production.

## Last Audit Summary

- Final validation: `npm run check` passed (Backend 74/74, Frontend 30/30, lint, production build, Prisma validation, and syntax checks); the post-dependency-update focused security suite passed 5/5.
- Dependency audit: non-breaking remediation upgraded `qs` to 6.16.0; 10 transitive advisories remain (4 high, 6 moderate) in Prisma CLI/Firebase Admin dependency trees, with npm offering only breaking forced downgrades. No `--force` change was applied.
- Git secret scan: no live-looking secret in the current tracked tree; `.env` is untracked and ignored. Historical findings are the Firebase Web public key and an already-rotated/revoked database URL documented below.
- Knowledge graph: `graphify update .` completed; graph rebuilt to 1,419 nodes and 1,956 edges.
- Blockers: no Month 1 internal-beta implementation blocker; remaining dependency advisories require compatible upstream releases or a separately tested dependency migration.
- P0 status: 28/28 DONE; implementation is temporarily closed/frozen while Month 1 continues through the remaining P1 work.
- Basic rate limiting is complete for the single-instance Month 1 deployment; shared multi-instance storage remains deferred in `FUTURE_TODO.md`.
- Secret audit closed: `.env` remains local/ignored, Render was redeployed with a new database credential, and old Prisma connection strings were revoked.
- Canonical Bloom input mismatch resolved; 19 focused Daily Grow/Flower tests pass.
- Private Journal/social Flower boundary resolved; 5 focused serializer/auth tests pass.
- Production secondary-emotion taxonomy aligned; 28 focused routing/Worker/selector/Flower tests pass.
- Canonical species pools completed; 22 focused Primary/Flower/selector tests pass.
- Core HTTP vertical slice locked down; 6 focused route/persistence tests pass.
- Lightweight web production-test client aligned with the Month 1 Daily Grow contract; focused frontend tests, lint, and production build pass.
