# PetalPal — Workflow Routing (Quick Guide)

**Purpose:** Choose the smallest necessary tests and release lane. This document does not authorize execution.

Canonical procedure: [`INTEGRATION_DEPLOYMENT.md`](../../INTEGRATION_DEPLOYMENT.md).

Read [`WARNING.md`](../../WARNING.md), [`AGENTS.md`](../../AGENTS.md) and [`CLAUDE.md`](../../CLAUDE.md) first. They remain authoritative.

Use [`.claude/context/project-state.md`](../../.claude/context/project-state.md) for current progress. Stop if instructions conflict.

## 1. What changed?

| Change | Appropriate lane | Avoid |
|---|---|---|
| Docs only / no meaningful change | Relevant documentation or CI check; no deploy | Rebuilding Web or Render |
| Expo Web UI, Garden/Fairy, Web assets, CSP, browser voice | Targeted Web tests; Cloudflare TEST Web release if requested | Automatically redeploying Render |
| API, Auth, Socket.IO, security, AI worker, Weekly/Monthly server logic | Targeted backend/security tests; Render TEST release if needed | Assuming a Web build updates the API |
| Web and API contract together | Coordinated compatible releases and relevant E2E | Independent uncoordinated rollout |
| Prisma schema/migration | Review SQL, isolated DB tests, separately approved database lane, then compatible API | Implicitly running migrations |
| Native-only iOS/Android | Native build, device and Store checks | Assuming Cloudflare publishes mobile apps |
| Provider settings, credentials, DNS, Access, environments | Separate high-risk approval | Bundling with routine deploy |

### Architecture

- Cloudflare hosts the Web frontend.
- Render hosts the Node.js/Express Backend API.
- Prisma PostgreSQL provides separate persistent storage.
- Firebase provides authentication and identity.
- TEST uses `petalpal-web-integration`, `petalpal-backend-test`, independent TEST Firebase and TEST database.
- Production uses `petalpal-web-production` and `PetalPal_v2`.

Cloudflare Access protects the Web entry, not direct Render API requests. Backend authentication and owner isolation remain mandatory.

## 2. TEST Web release

Run only when a TEST Web release is needed.

### Preflight

Verify the exact `main` SHA, affected files, deployed baselines and existing successful CI evidence.

Reuse valid artifacts when supported. Do not rebuild unnecessarily.

### Build

Workflow: `.github/workflows/cloudflare-web-build.yml`

- Branch: `main`
- `integration_config=true`
- `production_config=false`
- Builds and tests the frontend without deployment.
- Record Run ID, complete SHA, Artifact ID, SHA-256 digest, expiration and conclusion.
- If the build fails, stop.

### Deploy

Workflow: `.github/workflows/cloudflare-integration-deploy.yml`

- Phase: `deploy`
- Use the verified Artifact ID, Digest and Source SHA.
- Deploy only `petalpal-web-integration`.
- Keep public routes/domains disabled.
- Validate artifact provenance.
- If failure or uncertainty occurs, stop. Never blindly retry.

### Activate

Same workflow with `phase=activate`.

- Reuse the same approved Artifact ID, Digest and Source SHA.
- Verify Worker-level Cloudflare Access rejects unauthorized traffic.
- Activate only the protected TEST workers.dev endpoint.
- If protection cannot be confirmed, stop and preserve or restore private access under the existing workflow safeguards.

### E2E

Workflow: `.github/workflows/integration-e2e.yml`

Run only when relevant or for formal TEST acceptance.

Validate:
- TEST Firebase login
- Authentication and owner isolation
- CORS
- Socket.IO
- Frontend/backend integration

Use an existing verified TEST identity. Never automatically provision accounts.

E2E success does not prove all application features or live AI behavior.

**Build, Deploy, Activate and E2E each require separate explicit task-specific approval under CLAUDE.md.**

Respect GitHub environment reviewer gates.

## 3. Render Backend

Deploy Render only when backend-relevant code or configuration changes require it.

- Backend API, authentication, Socket.IO and AI server logic may require Render TEST deployment.
- A Cloudflare Web deployment never updates Render automatically.
- GitHub `main` is not proof of the currently deployed Render revision.
- Use relevant backend/security tests and `test-backend-smoke.yml` when useful.
- Follow the Render section of `INTEGRATION_DEPLOYMENT.md`.
- Do not redeploy an unchanged backend without a specific reason.

## 4. Database

Prisma migrations require separate approval.

- Verify exact database identity and isolation.
- Review migration SQL and compatibility.
- Run isolated migration tests when relevant.
- Do not assume TEST and Production share the same database.
- Do not use `npm start` as a read-only check; it may run `prisma migrate deploy`.
- Never execute production database migrations without explicit authorization.

## 5. AI Weekly / Monthly Reports

A successful Web Build or E2E run does not mean Weekly/Monthly AI is activated.

- Verify which report features are implemented, default OFF, tested or deployed.
- Do not activate new AI provider routes or feature flags automatically.
- Never perform paid inference without separately approved scope and budget.
- TEST report acceptance must independently verify trigger, generation, persistence and owner-only readback.
- Preserve AI Consent, source ownership, deletion fences, job idempotency, evidence grounding and cost controls.
- Do not treat synthetic test results as real provider acceptance.

## 6. Production

Production is a separate release lane.

- Requires exact source SHA and artifact verification.
- Requires explicit owner approval and existing reviewer gates.
- Never reuse TEST artifacts, credentials, Firebase resources or databases.
- Never modify DNS, Cloudflare Access, Render credentials or production settings as part of routine TEST development.
- Never expose a private Worker publicly without separate authorization.

## 7. Token and Workflow Efficiency

- Prefer targeted Graphify queries and relevant file reads.
- Avoid entire-repository audits for ordinary changes.
- Run impact-based tests only.
- Reuse accepted CI evidence for equivalent relevant source/configuration.
- Reuse matching verified artifacts within their validity window.
- Do not rebuild unchanged components.
- Do not rerun successful E2E unless relevant behavior/configuration changed or acceptance specifically requires it.
- Never automatically retry failed or ambiguous deployments.
- Do not invent extra Workflow stages.

## 8. Git and Approval Rules

- Claude may edit code, run authorized local tests, prepare changes and create authorized local commits under CLAUDE.md.
- The owner personally performs Git Push, PR publication and Merge.
- Never push, force-push, create or modify PRs, merge or publish remotely.
- GitHub Actions execution is prohibited by default.
- TEST workflows require exact task-specific authorization for each phase.
- Provider configuration, production changes, database migrations and paid AI require separate authorization.
- Preserve `WARNING.md`, `AGENTS.md`, `SECURITY.md` and all existing security safeguards.

For meaningful security changes, review and update `SECURITY.md` as required. Update `MANUAL_SECURITY_CHECKLIST.md` only for genuine provider/manual actions or status changes. Preserve historical and superseded evidence.

## 9. Evidence and Final Reporting

Keep these evidence levels separate:

- Local tests passed
- GitHub CI passed
- TEST deployed and activated
- Production deployed and verified
- Public release accepted

Never assume one proves another.

For each task, report concisely:

1. Area changed.
2. Necessary release lane, if any.
3. Existing evidence reused.
4. Verified results and outstanding blockers.
5. Smallest next action requiring approval.

Do not proceed to another release phase without its required authorization.
