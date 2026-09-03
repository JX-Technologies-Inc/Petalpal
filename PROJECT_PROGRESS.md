# Project Progress

Last updated: 2026-09-03
Current phase: Month 1 — Backend/AI MVP, P0 closure

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
- All eight canonical Primary Bloom inputs normalize and validate consistently; legacy mood compatibility is preserved.
- Owner reads preserve Journal-linked Flower data; social garden reads use an explicit safe Flower allowlist.
- Production Cloudflare secondary-emotion output uses the shared 21-label contract; legacy five-label output is limited to primary fallback routing.
- All eight canonical Primary Blooms use explicit pools containing only existing approved species; canonical generation no longer uses a shared fallback.
- Route-level Month 1 vertical slice covers Mood/Journal, AI success/fallback, canonical Flower generation, transaction/idempotency, privacy, safe errors, and persisted reload.
- Backend suite: 42/42 passing, including database-restart persistence.

## IN PROGRESS

- Auth/ownership, validation, error handling, pooling, profile/locale, deletion, and lifelong-history support exist only partially.

## NEXT

- Select the next remaining P0 gap explicitly; the original five-task vertical-slice closure sequence is complete.

## BLOCKED

- Database credential rotation requires manual action at the database provider and Render.
- Production use of Candidate C-Lite remains explicitly out of scope pending an integration decision.

## P0 Completion Estimate

- Overall: 78%
- Backend: 80%
- AI: 90%
- Database: 75%
- Integration/testing: 80%

## Important Architecture Decisions

- Render owns the REST API and PostgreSQL writes; Cloudflare Workers AI is inference-only.
- User-selected Primary Bloom is authoritative; AI may add only secondary emotions.
- Daily Grow must complete through deterministic fallback when AI is unavailable.
- RAG, embeddings generation/search, long-term memory, Pomodoro, reconciliation, and R2 are not Month 1 work.
- Candidate C-Lite/21-label ML remains experimental and disconnected from production.

## Last Audit Summary

- P0 status: 12 DONE, 14 PARTIAL, 2 NOT STARTED; no implementation blocker beyond the noted product/integration decisions.
- NOT STARTED: pgvector extension migration; basic rate limiting.
- Secret audit: `.env` is no longer tracked and remains local; the exposed `DATABASE_URL` must be rotated because it exists in Git history.
- Canonical Bloom input mismatch resolved; 19 focused Daily Grow/Flower tests pass.
- Private Journal/social Flower boundary resolved; 5 focused serializer/auth tests pass.
- Production secondary-emotion taxonomy aligned; 28 focused routing/Worker/selector/Flower tests pass.
- Canonical species pools completed; 22 focused Primary/Flower/selector tests pass.
- Core HTTP vertical slice locked down; 6 focused route/persistence tests pass.
