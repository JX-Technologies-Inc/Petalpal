# Parallel Render backend-only test service — prepared, NOT created

Status 2026-10-10: configuration only. No Render service, database, Firebase
project, secret, DNS or Cloudflare resource has been created or changed.

## Boundary

- Existing `PetalPal_v2` (`srv-d983eguq1p3s73fnk1m0`, last recorded Live
  `1f8d0f98`) and its Vite frontend stay unchanged: no setting, env var, branch,
  Dockerfile, deploy, restart or CORS edit. `Dockerfile.transition` is no longer
  the planned path (retained only as history).
- The new service is a separate Render Web Service using `Dockerfile.backend`
  (API + Socket.IO only, no `client/dist`) against an isolated test database and
  an isolated test Firebase project. It never receives production credentials.
- Deliberately not a `render.yaml`: a Blueprint file in the repo could be synced
  by provider automation. Settings are entered manually by a human.

## Service settings

| Setting | Value |
| --- | --- |
| Type / runtime | Web Service, Docker |
| Name | `petalpal-backend-test` (any name not used by production) |
| Repository / branch | `JX-Technologies-Inc/Petalpal`, a dedicated test branch (e.g. `render/backend-test`) pointing at the approved merged commit — not `main` |
| Auto-Deploy | OFF (manual deploys of an exact commit only) |
| Dockerfile path / context | `./Dockerfile.backend` / `.` (context allowlist: `Dockerfile.backend.dockerignore`; image COPYs are explicit either way) |
| Docker command (start override) | `sh -c "node lib/integration-environment.js && npm start"`. The guard runs **before** `prisma migrate deploy`, so a mis-set environment stops the deploy before any database is touched; `npm start` then migrates **only the isolated test DB**. `server.js` re-checks the same guard at startup |
| Health check path | Leave blank (port check). The backend-only image has no unauthenticated 2xx route; adding one is out of scope |
| Plan / region | Free/existing no-cost tier only; same region as the test DB |
| Pre-deploy command, disks, custom domains, previews | None |

## Environment (names only; values are human-entered, never in Git/chat/logs)

| Variable | Test-service value / source |
| --- | --- |
| `PETALPAL_ENVIRONMENT` | `integration` (enables the fail-closed isolation guard in `lib/integration-environment.js`; any other value also fails) |
| `NODE_ENV` | `production` (non-production refuses any non-local database) |
| `DATABASE_URL` | Isolated test PostgreSQL. Guard requires the database name to contain an `integration` or `test` token (e.g. `petalpal_integration`); the human must also ensure it shares no host credentials with production |
| `FIREBASE_PROJECT_ID` | Isolated test Firebase project ID. **Required**: unset defaults to the production project |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Admin key of that isolated test project only |
| `CORS_ALLOWED_ORIGINS` | Exact test frontend origin(s) plus this service's own `https://<name>.onrender.com` (React Native WebSocket handshakes send the target origin). No production origins needed |
| `TRUST_PROXY` | Same non-secret value as production's verified setting; `1` is an UNVERIFIED Render-hop assumption (open checklist item on proxy topology) |
| `API_DOCS_ENABLED` | `false` |
| `AI_ASYNC_EXECUTION_MODE` | `manual` |
| `AI_USER_DAILY_CALL_LIMIT`, `AI_GLOBAL_DAILY_CALL_LIMIT`, `AI_PROVIDER_DAILY_CALL_LIMIT` | `0` (fail-closed kill switch; Daily Grow uses deterministic fallback) |
| `DAILY_GROW_LIMIT_ENABLED` | `false` optional, for repeated synthetic Daily Grow |
| `CLOUDFLARE_WORKER_AI_URL`/`_TOKEN`, `AI_JOB_DISPATCH_URL`/`_TOKEN`, `AI_JOB_EXECUTOR_TOKEN`, `FIREBASE_CLIENT_EMAIL`/`_PRIVATE_KEY`, `GOOGLE_APPLICATION_CREDENTIALS` | Unset. Never copy production AI Worker or job tokens |

`RENDER=true` and `PORT` are provided by Render.

## Isolation matrix

| Surface | Production | Integration (this plan) | Enforced by |
| --- | --- | --- | --- |
| Firebase | `petalpal-b212c` | separate test project, own Admin key and Web App | guard: explicit project ≠ production, service-account `project_id` must match, ambient credential variables unset; build: refuses production project/auth domain/app ID |
| PostgreSQL | production Prisma Postgres | separate test DB named `…integration…`/`…test…` | guard (name token, `DEV_DATABASE_URL` unset); human provisioning |
| REST + CORS | `petalpal-v2.onrender.com` | `petalpal-backend-test` origin only | guard: HTTPS exact origins, no production origins, own `RENDER_EXTERNAL_URL` must be listed; Worker CSP and build refuse the production API origin |
| Socket.IO | same origin as REST | same test origin | `allowRequest` uses the CORS list; CSP `wss://` derived from the API origin |
| AI | Cloudflare Workers AI + job dispatch | none | guard: `manual` mode, all three daily budgets `0`, Worker/job URLs and tokens must be unset |

## Frontend pairing (implemented, not deployed)

- `scripts/build-cloudflare-web.mjs --integration` exports Expo Web with
  `EXPO_PUBLIC_API_BASE_URL=$CLOUDFLARE_API_ORIGIN` and the test Firebase Web App
  settings; it refuses a missing/HTTP/production API origin and the production
  Firebase project, auth domain or app ID. Default and `--synthetic` builds are unchanged.
- `deploy/cloudflare/wrangler.integration.jsonc` is a separate Worker
  (`petalpal-web-integration`) with `PETALPAL_ENVIRONMENT=integration`. Its CSP is
  built from `API_ORIGIN` and `FIREBASE_AUTH_DOMAIN`, supplied at deploy time; it
  answers 503 if they are missing or production. With no variables set,
  `worker.js` keeps the exact production policy; `wrangler.jsonc` and
  `wrangler.preview.jsonc` (protected synthetic preview) are untouched.
- Manual workflow `cloudflare-web-build.yml` gained `integration_config`: environment
  `petalpal-web-build-integration` (variable `CLOUDFLARE_API_ORIGIN`; the four public
  `EXPO_PUBLIC_FIREBASE_*` secrets of the TEST Web App). It uploads an artifact only.
- Human deploy (after approvals): from `deploy/cloudflare`,
  `wrangler deploy -c wrangler.integration.jsonc --var API_ORIGIN:https://<test-backend> --var FIREBASE_AUTH_DOMAIN:<test-project>.firebaseapp.com`,
  keep the URL disabled behind reviewer-only Cloudflare Access, and add that origin to
  the backend's `CORS_ALLOWED_ORIGINS` and the test Firebase Authorized Domains.

## Validation after a human creates it

1. Deploy exactly the approved commit; confirm the build used `Dockerfile.backend`
   and that migrations ran only on the test DB.
2. Anonymous `/session` → `401` + `no-store`; disallowed `Origin` → `403`;
   allowed-origin preflight → `204` with exact `Access-Control-Allow-Origin`.
3. With a test-project identity only: sign-in/session, owner isolation, Socket.IO
   polling → WebSocket upgrade, direct WebSocket and token-refresh reconnect,
   from both the protected Cloudflare preview and a native Expo test build.
4. Rollback = suspend/delete the test service and test DB; production unaffected.
