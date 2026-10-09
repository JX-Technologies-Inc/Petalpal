# Expo Web / Render split — local candidate, 2026-10-09

No push, merge, cloud resource, deployment, DNS, Firebase, database or provider
configuration change is authorized by this document. `app.jastrevia.com` is a
proposal. The existing company site and AI Workers are outside this migration.

## Baseline and hosting decision

Candidate starts from main `49ea26a6bd9867d5b2c65ca56b4d3e917c5d24a3`, tree
`952ffb9ff59c382de6623acbcab0fec990d17a51`. Accepted CI run 37902827021,
previous linux/amd64 build, renderer recovery and human Firebase attestations
are reused. Production Docker OOM above 8 GB is user-reported; no private logs
were retrieved. Local Render Live revision is not newly verified.

Cloudflare Workers Static Assets hosts the actual `mobile/dist` Expo export.
`mobile/app.json` explicitly uses `web.output: single`. The small static-only
Worker reuses the existing product shell allowlist in `lib/web-shell.js` and
serves index.html on those deep links. Missing assets, API paths and debug routes
remain 404. Write requests receive 405. No generic proxy or backend logic exists.
The Worker applies CSP, nosniff, frame denial, HTTPS HSTS and cache policy to
every response. HTML/errors and requests with Authorization/Cookie use no-store;
public static files revalidate. WASM keeps application/wasm. No artwork,
rendering resolution, DPR, effects, FPS policy or product UI code changed.

## Direct API and Socket origin

The existing `EXPO_PUBLIC_API_BASE_URL` is compiled as
`https://petalpal-v2.onrender.com` by `scripts/build-cloudflare-web.mjs`.
REST and the existing socket.io-client both use this base. Firebase ID tokens
remain in Authorization / Socket auth payloads; there is no cross-site cookie
or new session/proxy protocol. CSP permits the exact HTTPS and WSS backend.

Actual dynamic prefixes include `/auth`, `/session`, `/users`, `/api`, `/events`,
`/ai`, `/speech`, `/friends`, `/reports`, `/visit`, `/leave`, `/analyze-mood`,
the disabled legacy login/register paths and `/internal/ai-jobs`.
Socket.IO uses its existing `/socket.io/` path, polling and WebSocket upgrade.
Direct routing preserves all of these without a fragile proxy prefix inventory.
Internal job endpoints remain service-authenticated and are never moved into
Cloudflare. The public UI `/visit/:owner` remains distinct from backend visit APIs.

Render's existing `CORS_ALLOWED_ORIGINS` must later include each approved exact
frontend origin, preserving the existing Render/native/development contracts.
Never use `*`, a workers.dev wildcard or replace the whole current list blindly.
The new Socket allowRequest check applies that same policy to direct WebSocket
handshakes; existing Firebase verification, ownership and realtime guards remain.
TRUST_PROXY, forwarded headers, rate limits and AI/DB settings are unchanged.

## Reproducible artifacts and local verification

The manually dispatched `.github/workflows/cloudflare-web-build.yml` installs
locked Expo dependencies, exports web, runs focused local hosting tests and
retains an artifact named with the exact source SHA. It has no deployment step,
cloud credentials, push trigger or provider mutation. Production public SDK
settings belong in the human-configured `petalpal-web-build-production` GitHub
environment; configure reviewers before use. Synthetic builds require no keys.

Required production frontend build settings (names only):
`EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`.
Use the existing verified Firebase Web App. The build passes only required
settings to Expo, disables dotenv/telemetry, limits build workers to two and
suppresses exporter output so values cannot be echoed. No Admin key is accepted.
Synthetic artifacts are explicitly named and are not usable production releases.

Run in a clean, isolated checkout with no environment files:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix mobile --ignore-scripts --no-audit --no-fund
npm ci --prefix deploy/cloudflare --ignore-scripts --no-audit --no-fund
NODE_ENV=test DOTENV_CONFIG_PATH=/dev/null DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test npm exec --no -- prisma generate
npm run build:cloudflare -- --synthetic
# Linux CI installs isolated Chromium; macOS tests use a fresh headless Chrome profile.
npm run test:hosting
docker build --platform linux/amd64 -f Dockerfile.backend -t petalpal-backend:reviewed-candidate .
```

Tests use synthetic token verifiers and in-memory Prisma method stubs. No
database, personal account, real Firebase login or inference is contacted.
Actual local Cloudflare/workerd and Chromium verify export delivery/CSP, MIME,
preflight and readable 200/401/403 responses. Actual Socket.IO verifies polling,
upgrade, invalid origins/tokens, acknowledgements and reconnect. AuthProvider
hydration/logout and token refresh use synthetic identities.

## Backend image and safe transition

`Dockerfile.backend` is opt-in. Its dedicated context allowlist excludes Expo,
client builds, all Garden artwork, research files and credentials. It installs
the unchanged backend dependencies and generates Prisma only using a synthetic
build URL. It preserves Node 24, OpenSSL, Firebase Admin, REST, Socket.IO, Natural
mood data, AI/job/speech code and `npm start` (Prisma migrate deploy then server).
Schema and migrations are unchanged. Research-only local ONNX assets remain
excluded; the production Cloudflare AI and Natural fallback paths are retained.

The original `Dockerfile`, `.dockerignore` and Express frontend serving remain
unchanged. Thus selecting/merging this candidate must not silently remove the
existing frontend. Do not select Dockerfile.backend on Render before cutover.

For a separately approved transition, `Dockerfile.transition` layers an approved
prebuilt `client/dist` onto an exact reviewed backend image. Build both outside
Render, then use an approved image registry/source procedure for the existing
service; review provider support/configuration before any change. The transition
image deliberately retains the frontend. Example local assembly, never a deploy:

```sh
# client/dist must contain the reviewed production Expo artifact, not a synthetic build.
docker build --platform linux/amd64 -f Dockerfile.transition \
  --build-arg BACKEND_IMAGE=petalpal-backend:reviewed-candidate \
  -t petalpal-transition:reviewed-candidate .
```

## Human-only preview, Firebase and cutover gates

1. Separately approve source publication and a preview resource. Keep production
   auto-deploy OFF. The supplied Wrangler config has workers.dev, version URLs
   and custom routes disabled; local dry-run does not create resources.
2. Stage a dedicated `petalpal-web-preview` Worker with no public routes first.
   Configure Cloudflare Access for its exact preview hostname before allowing
   preview traffic; then explicitly approve enabling that hostname. Do not attach
   this candidate to an existing AI Worker. A synthetic artifact can validate
   static delivery only and must never be promoted as a real login-capable UI.
3. Before a real-auth preview, confirm the actual Live backend contains this
   candidate's compatible unified APIs and origin checks. The old production
   revision is not assumed compatible. Deploy a separately approved transition
   image retaining the old origin's frontend before testing the new UI.
4. Human adds the exact preview origin to Render CORS while retaining all prior
   approved origins, and separately approves its hostname in Firebase Authorized
   Domains. Keep Firebase project/Web App/authDomain/Admin credentials unchanged.
   Current Expo uses email/password plus Firebase-hosted email verification, not
   OAuth redirect sign-in. Check email-template action/continue URLs manually;
   a custom continue URL must be authorized. No new custom callback is introduced.
   Browser Firebase persistence is origin-scoped: expect a fresh sign-in at the
   new hostname; never transfer tokens or local storage from Render.
5. Human verifies login, verification email return, logout/session recovery,
   Garden/flowers, Fairy, Calendar, Bookhouse/Journal, navigation, Socket reconnect,
   and deployed CSP/preflight through the actual provider edge. Cloudflare Access
   protection is separate from PetalPal authorization. Local tests do not certify
   production Firebase or objective device/FPS parity.
6. Separately approve `app.jastrevia.com`, add its exact Firebase/CORS origins and
   a dedicated Worker custom domain. Preserve `jastrevia.com` and existing AI
   routes. Review existing DNS ownership/collisions manually; do not add blanket
   zone routes or redirect old users. Promotion must name exact tested frontend
   artifact and compatible backend image revisions and remain manual.
7. Only after old-origin traffic/links have an explicitly approved disposition
   may the existing service switch to Dockerfile.backend/the backend-only image.
   Dropping old frontend serving while users still depend on it is blocked.

Frontend rollback: manually restore the prior tested frontend Worker version
and asset set while keeping compatible backend APIs. Backend rollback: separately
approve the recorded pre-migration or transition image/commit while retaining
current provider configuration. Keep the transition image/export until rollback
acceptance. Never blindly restore older environment values or run down-migrations.

## Evidence and limits

Actual synthetic export, local Cloudflare routing/assets/WASM, Chromium CORS,
Firebase-provider contracts and Socket protocols passed. Exported Garden,
Bookhouse and Reflection PNGs were compared byte-for-byte to source. Garden
visual recovery evidence is reused; device/FPS/latency parity remains PARTIAL.
Backend image build and measured resource evidence are recorded in SECURITY.md.
No cloud preview, production runtime or current Live revision is certified here.

References: [Cloudflare static routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[SPA handling](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/),
[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[Firebase authorized return domains](https://firebase.google.com/docs/auth/web/email-link-auth).


Local Docker limitation: backend-only build exited 0; the separate transition
image export failed with Docker internal I/O error (exit 100), and backend-image
smoke failed before application startup during layer extraction (exit 125).
The host subsequently reported no free disk space. Only this task's generated
transition export and backend dependencies were removed; source and the synthetic
Expo export remain. No Docker restart, shared pruning or build retry occurred.
Verify final image runtime and transition assembly on a healthy isolated Docker
host before any live rollout. Local cloud preview/provider changes remain gated.

## Continuation: isolated static preview and runtime gate (2026-10-09)

Disk capacity is now available (approximately 30 GiB host / 24 GiB Colima VM),
and Docker/Colima respond. However the retained backend image's manifest still
returns a containerd I/O error; its previously recorded config ID is unavailable.
Free space has not restored image readability. No new container smoke or build
was attempted, and no daemon/container/cache/recovery state was changed. Build
PASS is retained; container runtime remains BLOCKED. Build peak RAM is UNKNOWN.

The accepted 10 tests are reused. Two additional focused checks passed: real
Chromium Socket polling/WS upgrade/automatic refreshed-token reconnect, denied
origins/tokens and CSP enforcement; and static-preview isolation in workerd and
Chromium. The latter reused the retained Expo export without rebuilding it.
The dedicated preview profile also passed Wrangler's offline packaging dry-run;
no upload, account operation or cloud resource was performed.

### Human-only static preview procedure

This profile is for delivery/UI-shell review only; login and backend features
are deliberately unavailable. It requires no Render CORS, Firebase Authorized
Domain or DNS changes. It does not certify authenticated Garden functionality.

1. Approve source publication and creation of a dedicated preview Worker
   separately. Confirm `petalpal-web-preview` is unused or belongs only to this
   preview; never overwrite an AI or production Worker. No publication is done
   by this local preparation.
2. Use the retained synthetic `mobile/dist` from checkpoint `f81759a`, whose
   frontend source is unchanged, or the existing manually dispatched build
   workflow with `production_config=false`. Download its exact
   `expo-web-synthetic-<source SHA>` artifact into `mobile/dist` of the matching
   reviewed source checkout. Keep the run ID/source SHA with the approval.
3. Use a clean reviewed checkout without `.env*` or `.dev.vars*` files, the locked
   hosting tools and the dedicated profile. Do not copy local credential files:

   ```sh
   npm ci --prefix deploy/cloudflare --ignore-scripts --no-audit --no-fund
   # Local only, loopback and ephemeral port; no cloud resources:
   deploy/cloudflare/node_modules/.bin/wrangler dev --local --ip 127.0.0.1 --port 0 --config deploy/cloudflare/wrangler.preview.jsonc
   # Offline packaging only; no upload:
   deploy/cloudflare/node_modules/.bin/wrangler deploy --dry-run --config deploy/cloudflare/wrangler.preview.jsonc
   ```

4. After explicit resource/upload approval, a human may run the same deploy
   command without `--dry-run`. The profile retains `workers_dev=false`,
   `preview_urls=false`, no custom routes, and `STATIC_PREVIEW_ONLY=1`. Verify
   the resulting Worker identity and disabled URL settings in metadata only.
   No agent/provider credential-value access is needed.
5. In Cloudflare, configure Access to restrict the exact preview Worker hostname
   to approved reviewers before enabling any URL. Keep version/other preview
   URLs disabled; verify there is no alternate unprotected URL. If protection
   cannot be configured before exposure, stop and keep local preview only.
   Separately approve enabling that workers.dev hostname under the preview
   Worker's Settings > Domains & Routes; do not attach a custom/company domain.
   Record this as a reviewed preview-only config change so a later upload does
   not silently replace the intended URL state. Confirm an unauthenticated
   browser is challenged/denied before sharing the URL.
6. Keep `STATIC_PREVIEW_ONLY=1`. Its CSP removes Render/Firebase connections and
   Firebase frames/scripts; browser enforcement and zero provider requests were
   verified locally. Do not enter real credentials. Turning on real auth/API
   access requires a separate preview approval and the compatibility gates above.

[Cloudflare documents workers.dev exposure and Access protection here](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev).

### Validated cutover order

Static-only protected preview → restore/validate the retained backend image on
a healthy isolated Docker host → separately validate the transition image with
an approved prebuilt frontend → deploy that compatible transition release to
Render while retaining its login/web frontend → authorize exact real-auth preview
origins and test → approve/activate the replacement Cloudflare frontend → approve
the disposition of old-origin users/links → select backend-only Render last.

The unchanged original Dockerfile and prepared Dockerfile.transition preserve
the compatibility path. Neither can currently be declared deployment-ready:
transition image runtime and provider image-source compatibility still need
verification. DNS activation alone does not retire old Render login links.
Retain independent frontend and transition-backend rollback artifacts/config.

Once image readability is restored, run the existing synthetic protocol fixture
inside that retained image at most once, not another build. Example for a healthy
isolated Docker host, from this worktree:

```sh
docker run --rm --pull=never --platform linux/amd64 --network none \
  --memory=1g --memory-swap=1g --cpus=2 --pids-limit=128 --read-only \
  --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  -e NODE_ENV=test -e DOTENV_CONFIG_PATH=/dev/null -e DOTENV_CONFIG_QUIET=true \
  -e DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test \
  -e AI_ASYNC_EXECUTION_MODE=manual \
  --mount type=bind,src="$PWD/test/back/cross-origin-web.test.js",dst=/app/test/back/cross-origin-web.test.js,readonly \
  --entrypoint node petalpal-backend:cloudflare-migration \
  --test --test-timeout=45000 /app/test/back/cross-origin-web.test.js
```

This starts the image's actual Express/Socket server under synthetic identity/DB
adapters; it intentionally does not execute npm start, which would run migrations.
It proves application runtime/protocol behavior, not production DB startup or
Firebase configuration. The 1 GiB bound is a test runtime limit, not build RAM.
