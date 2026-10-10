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
| Start command | Image default `npm start` = `prisma migrate deploy` then `node server.js`; runs migrations **only against the isolated test DB** set below |
| Health check path | Leave blank (port check). The backend-only image has no unauthenticated 2xx route; adding one is out of scope |
| Plan / region | Free/existing no-cost tier only; same region as the test DB |
| Pre-deploy command, disks, custom domains, previews | None |

## Environment (names only; values are human-entered, never in Git/chat/logs)

| Variable | Test-service value / source |
| --- | --- |
| `NODE_ENV` | `production` (non-production refuses any non-local database) |
| `DATABASE_URL` | Isolated test PostgreSQL. Must not share host+database or credentials with production |
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

## Frontend pairing (follow-up before real-auth testing)

`scripts/build-cloudflare-web.mjs` and `deploy/cloudflare/worker.js` hard-code the
production API origin `https://petalpal-v2.onrender.com` and production Firebase
auth domain in `EXPO_PUBLIC_API_BASE_URL` and the CSP. Once the test service URL
exists, a separate change must make the API origin and Firebase auth domain
build/deploy inputs (keeping current values as the production default) so the
protected Cloudflare preview can target this service and the test Firebase project.

## Validation after a human creates it

1. Deploy exactly the approved commit; confirm the build used `Dockerfile.backend`
   and that migrations ran only on the test DB.
2. Anonymous `/session` → `401` + `no-store`; disallowed `Origin` → `403`;
   allowed-origin preflight → `204` with exact `Access-Control-Allow-Origin`.
3. With a test-project identity only: sign-in/session, owner isolation, Socket.IO
   polling → WebSocket upgrade, direct WebSocket and token-refresh reconnect,
   from both the protected Cloudflare preview and a native Expo test build.
4. Rollback = suspend/delete the test service and test DB; production unaffected.
