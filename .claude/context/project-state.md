# PetalPal — Project State (onboarding snapshot, 2026-10-16)

Repo truth > docs; not a live provider audit.
Policy: [WARNING.md](../../WARNING.md), [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md) (no Git writes/PRs/deploys).

## Git
- Local `main` = `origin/main` = `1bab6796` (PR #62 Weekly Reflection merge, 2026-10-16); worktree clean apart from agent-context files.
- Open PRs (user-verified on GitHub; `gh` not installed locally): #59 and #60 remain open as original source PRs — their content is already selectively integrated via merged #61, so open ≠ unintegrated.
- Recent merges: #40–#46 (real-AI smoke, AI Gateway phase 1, Haiku Event, Sonnet Weekly, Opus Monthly), #61 release-candidate integration (App Store readiness + selected #59/#60 changes), #62 Weekly Reflection v2.
- Evidence levels are separate: local validation ≠ GitHub CI ≠ merged ≠ production-deployed.

## Architecture (verified in source)
- Backend: Node/Express `server.js` + `lib/*` on Render; Prisma Postgres; Firebase ID-token auth (`lib/auth.js`), owner-scoped private resources; Socket.IO social.
- AI: Cloudflare Workers AI / AI Gateway (`lib/ai-gateway*.js`); durable `AiJob` + Cloudflare Queue dispatch (`lib/ai-jobs.js`, `ai-async-dispatch.js`); consent gate (`ai-consent.js`, `ai-disclosure.js`).
- Memory: `Event` → `EventMemory` (`lib/event-memory.js`), BGE-small 384d pgvector, owner-scoped retrieval.
- Reports: `WeeklyReport`/`MonthlyReport`/`YearlyReport`/`AiEvidence` (migration `202609140001_ai_foundation`); Yearly is model-only.
- Mobile: Expo/React Native (`mobile/`), Skia Garden, Spine Fairy; web client in `client/`.

## Status by evidence level
- **Merged, default OFF / not cut over:** Opus Monthly (phase 4), Reflection v2 (`lib/reflection-v2.js`), Haiku/Sonnet provider routes. PR #62 Weekly candidate recorded 8/8 successful real Sonnet calls and 4/4 blind comparison wins; still default OFF and not verified as production-deployed. Monthly/Opus live evaluation still needs owner approval.
- **Merged, locally tested (per SECURITY.md 2026-10-15):** content-safety v1.2, pre-auth admission limiter, AI disclosure grant guard migration `202610150005`, social publication fixes; security runner 233/233, DAST 17/17.
- **Deployed (recorded, owner-reported):** prod Render `0b44ac74`, prod Web `738b7e96` (main ahead of both). TEST Render at `1bab6796` (`dep-db98o97f3r2c73ai7r2g`, 5 migrations, smoke 10/10). TEST Web Worker at `1bab6796`: no recorded evidence.
- **Unverified / open:** CodeQL #29/#30 High annotations need authorized disposition; production grounded-report provider smoke; MOBILE.md native-security scenarios 1–7 mostly NOT VERIFIED; report scheduling, Yearly generation, user-facing report UI not implemented.
- Experimental, not in production: Candidate C-Lite / 21-label V2 classifier.
- [PROJECT_PROGRESS.md](../../PROJECT_PROGRESS.md) is stale (2026-09-08).

## TEST vs production boundary
- Prod: `app.jastrevia.com`, Render `PetalPal_v2`, Firebase `petalpal-b212c`, startup `node server.js` (no auto-migrate).
- TEST: Worker `petalpal-web-integration`, Render `petalpal-backend-test`, Firebase `petalpal-integration-test`, separate Prisma DB, `PETALPAL_ENVIRONMENT=integration`, AI `manual` with zero call limits.
- `main` ≠ Render Live ≠ active Worker. Migrations are a separate approved release.

## Critical blockers
1. Deployment gap: main contains unreleased migrations (incl. `202610150005`) and AI features; any release needs explicit scoped approval per SOP.
2. CodeQL High findings pending disposition.
3. Weekly v2 accepted on live calls but flags OFF; no hosted TEST end-to-end report (trigger → persist → `/reflection` read). Monthly/Opus live evaluation not authorized.

## References
- Deploy SOP: [INTEGRATION_DEPLOYMENT.md](../../INTEGRATION_DEPLOYMENT.md) §1–2, §9
- AI status: [LONG_TERM_AI.md](../../LONG_TERM_AI.md) §3, §12; [docs/ai/REFLECTION_V2.md](../../docs/ai/REFLECTION_V2.md)
- Security evidence: [SECURITY.md](../../SECURITY.md) (latest sections from 2026-10-12 on); [MANUAL_SECURITY_CHECKLIST.md](../../MANUAL_SECURITY_CHECKLIST.md)
- Mobile: [MOBILE.md](../../MOBILE.md) §F, §H; Perf: [INTEGRATION_OPTIMIZATION.md](../../INTEGRATION_OPTIMIZATION.md)
- Graph: `graphify query "<symbols>"` (code-only).
