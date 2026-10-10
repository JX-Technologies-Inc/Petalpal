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
2. Stage the new isolated Worker named in the latest synthetic-preview procedure below, with no public routes first.
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

Historical signed-out-shell procedure. The synthetic-preview procedure below
supersedes its Worker name, publication prerequisite and disabled-login scope.

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

## Synthetic staging package — continuation of 9a9d57d

Starting checkpoint `9a9d57dead95ce2d42fe867ad01c548b3277de16`, tree
`0baabcceaacb535a192249b7e5f77477624150ba`, verified with a clean worktree.
The existing Expo export is reused, with no frontend rebuild or bundle editing.
The preview config now selects a separate `preview-worker.js` entry point and
proposes **`petalpal-expo-synthetic-9a9d57d`**. The name is not reserved or checked
against a provider account. If it exists, STOP; never update that Worker, even
if it appears to be staging. Never select `petalpal-emotion-ai` or another AI Worker.

The preview entry injects one same-origin script before Expo. It answers the
existing SDK's synthetic sign-in/refresh and minimal session/Garden/Journal
requests entirely in browser memory, with empty Garden/Journal fixtures. Use
`preview@example.invalid` / `preview-only` (public fixture strings, not secrets).
Real credentials must never be entered. A persistent banner labels the demo.
Reload uses the SDK's synthetic local identity; use a fresh browser profile and
discard its storage afterward. This is a read-only rendering preview, not a
backend emulator or an authorization test. All writes/AI and unknown endpoints
are rejected; no live Socket service is simulated. Cloudflare Access is the
actual reviewer access boundary, independent of the publicly forgeable fixtures.

CSP permits only same-origin connections/images plus local data/blob images;
Firebase frames remain disabled. The Worker only binds static assets: no AI,
database, service, KV, R2 or secret bindings. Normal Worker, Render, mobile source,
artwork, DPR and animation settings are unchanged. `keep_names=false` prevents
bundler helper references in the self-contained browser fixture function.

New evidence: asset-package check PASS (synthetic SDK build settings; forbidden
credential/database/log/source-map file classes, symlinks and selected credential
patterns absent). This bounded scan is not a claim to detect every possible
private string; provenance remains the accepted sanitized export and unchanged
source. Updated Chromium preview check PASS: synthetic sign-in, reload into the
actual Expo Garden, no external requests, CSP blocks raw HTTP/WS, other-owner and
privileged operations rejected, fixture responses no-store. Offline packaging
PASS. Prior routing/deep-link, JS/CSS/PNG/WASM MIME, artwork byte equality and cache
evidence reused; no accepted backend/CORS/Socket/build suites repeated.
The existing artifact workflow runs preview-fixture/package checks only for
synthetic exports. Its production-config mode explicitly passes
`--production-artifact` to retain normal static/protocol checks without running
synthetic login or the synthetic-only asset scan on public production settings.

### Minimum human-only authorization and setup

1. Approve **one new Worker + one exact-host Access application/policy + one
   upload of this reviewed local revision and retained synthetic export**, for
   named reviewers in the intended Cloudflare account. Git publication is not
   required for this local upload. No production, DNS, Firebase or Render change.
2. Human checks Workers & Pages names only: proposed name must be absent. Confirm
   the existing account workers.dev subdomain and Access availability. If Access
   is unavailable or account-wide setup is needed, stop for that separate scope;
   do not change account defaults or existing applications/Workers.
3. In a reviewed checkout without environment/dev-vars files, reuse the locked
   hosting dependencies and retained `mobile/dist`. Run the non-uploading command
   below if preparing elsewhere. Human handles Cloudflare login locally without
   sharing tokens, terminal auth output or provider secret pages.

   ```sh
   deploy/cloudflare/node_modules/.bin/wrangler deploy --dry-run --env-file /dev/null --config deploy/cloudflare/wrangler.preview.jsonc
   ```

4. Only after step 1 approval, human removes `--dry-run` for a single initial
   upload. Keep `workers_dev=false`, `preview_urls=false`, `routes=[]` and
   `STATIC_PREVIEW_ONLY=1`. Inspect identity/route/binding metadata only. No
   deployment/version/preview URL may become an unprotected alternative.
5. Before enabling traffic, configure Access for the full exact hostname
   `petalpal-expo-synthetic-9a9d57d.<existing-account-subdomain>.workers.dev`, all
   paths, with an Allow policy for explicit reviewer emails using the existing
   login method, no Everyone/Bypass policy, and default denial for others. Scope
   this to this Worker only. If protection cannot precede exposure, keep all
   URLs disabled. [Cloudflare's per-Worker Access support](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/#manage-access-to-workersdev).
6. With that policy in place, human enables only this Worker's workers.dev URL
   under Settings > Domains & Routes. Record the preview-only config change to
   `workers_dev=true` for any future upload; keep all alternate URLs disabled.
   In a fresh signed-out browser verify HTML, JS, WASM and image URLs are denied
   or challenged before sharing. Then an allowed reviewer signs into Access and
   uses only the public synthetic PetalPal fixture. No production login or data.

### Deferred compatible-Render tests

These remain separate future approvals; synthetic preview does not close them:
exact frontend-origin REST OPTIONS preflight and readable 200/401/403 with real
Firebase bearer refresh, owner isolation, no-store private/error responses,
Socket.IO polling/direct-WebSocket admission, upgrade, authenticated room joins,
reconnect with refreshed token and rejected origins/tokens through provider edges.
Real Firebase persistence/verification-return/login/logout and authenticated
Garden actions require approved test identities and the compatible transition
Render backend retaining the existing frontend. Backend-only cutover remains last.

### Separate non-destructive Docker diagnosis plan (not executed)

The retained image still has an I/O blocker; no Docker operation was repeated.
First record host/VM free blocks and inodes, Docker/Colima versions/status and
host volume health metadata using read-only commands. Then have the local owner
inspect only the affected image's containerd content/index metadata for missing
versus unreadable blobs; never inspect container environments or private logs.
Do not infer repair from free space alone. Preserve all images, volumes and VM
recovery state. If repair/export or a fresh isolated runtime is needed, obtain
separate maintenance authorization and a recovery plan first. No restart, prune,
deletion, rebuild or smoke retry is part of preview preparation.

## Authorized staging attempt — stopped before creation, 2026-10-09

User authorized only the new `petalpal-expo-synthetic-9a9d57d` Worker, exact-host
reviewer-only Access and one upload. Packaging checkpoint remains
`b46af3f8a7436665c1027ff01dbc24ad00ffd10b`, tree
`7bc76d9a8c6cd1a62241d8d320b6bd2977d11eeb`; clean at attempt start.

Read-only Wrangler metadata identified exactly one account for administrator
`maxingran630@gmail.com`: **`6007e20c3aa7e88753689744021afb00`**. Deployment metadata
for `petalpal-emotion-ai`, `petalpal-ai-dispatch-production` and
`petalpal-ai-dispatch-staging` is readable in this account. The proposed new
Worker returned Worker-not-found (10007). No existing Worker was modified.

Sole approved Access reviewer: **`xma38@jastrevia.com`**. The administrator email
must NOT be added as another reviewer. Wrangler is authenticated with Worker
permissions, but its advertised OAuth scopes contain no Access-management scope;
no Cloudflare Access connector is available. Access configuration/verification
cannot be completed through the available safe automation. No browser sign-in,
credential inspection, Worker creation, upload or URL enablement was attempted.
The public hostname remains unknown because the account subdomain was not read.

### Human-only completion using the existing administrator session

1. Select only account `6007e20c3aa7e88753689744021afb00` in Cloudflare. Confirm
   the exact new Worker name is still absent and record the existing workers.dev
   subdomain using metadata only. Do not create another account or change its
   subdomain. Ensure the human operator can manage Access applications/policies.
2. From this reviewed migration worktree, upload the retained synthetic artifact
   **once** with the existing locked CLI (no rebuild, push or secret binding):

   ```sh
   CLOUDFLARE_ACCOUNT_ID=6007e20c3aa7e88753689744021afb00 deploy/cloudflare/node_modules/.bin/wrangler deploy --env-file /dev/null --config deploy/cloudflare/wrangler.preview.jsonc
   ```

   Use only after confirming the config still has workers.dev/preview URLs OFF,
   no routes and the exact approved name. If the provider cannot guarantee no
   reachable viewing URL at creation, STOP instead. Do not retry a failed or
   ambiguous upload; inspect safe deployment metadata first.
3. Configure Access for this Worker's exact workers.dev hostname and all paths;
   allow only `xma38@jastrevia.com` using an existing supported login method.
   No administrator-email, Everyone, Bypass or account-wide rule. Keep all URLs
   disabled while verifying the hostname, policy selector and effective coverage.
4. Only after that verification, enable the one protected workers.dev URL.
   Leave version/preview/other URLs disabled. Check anonymous requests to `/`,
   `/bookhouse`, `/canvaskit.wasm`, one actual JS asset and one actual PNG cannot
   return application content. Access redirects/challenges or denials are expected.
5. Reviewer `xma38@jastrevia.com` signs into Access privately, then uses the
   public synthetic fixture to open Garden. Return only the exact protected URL
   and safe PASS/FAIL metadata; never share Access cookies, tokens or login traces.

All deployment authorization is already given; the remaining dependency is safe
human Access setup/verification. Keep the preview disabled if any gate fails.
Accepted tests remain reused; Docker and compatible-backend gates remain separate.

## Protected synthetic upload completed — 2026-10-09

Human created the exact Worker in the existing account and confirmed all-traffic
Access protection, sole reviewer `xma38@jastrevia.com`, company-email OTP/Hello
World PASS, preview URLs OFF and no custom domains. These policy/identity checks
are **human-confirmed**, not an independent Access API inspection.

Agent verified the existing Worker deployment identity in account
`6007e20c3aa7e88753689744021afb00`, unchanged preview implementation relative to
`b46af3f`, and retained synthetic artifact integrity. No Expo rebuild. Anonymous
preflight requests for HTML/deep link/actual JS/Garden PNG/WASM all redirected
to `weathered-frog-e16e.cloudflareaccess.com` with 302, without following login
redirects or retaining cookies/tokens.

**One upload** of the already packaged Worker and retained static export succeeded
via `wrangler versions upload --no-bundle`; version
`3fdcd984-8ef5-4d83-9df1-350f659b9b97`. One version activation assigned 100% traffic;
latest deployment (by creation time) `ec0e3bde-e2e5-4704-9746-6b9b7e43bac4`.
No preview URL was reported by the upload. Access policy and routing were not
changed: version upload/activation was used instead of full `wrangler deploy`
or `triggers deploy`. The checked-in profile's URL-off settings remain fail-closed;
do not use a full deploy to update this protected live preview without reconciling
its routing. No future upload is authorized by this completion record.

Protected URL: https://petalpal-expo-synthetic-9a9d57d.petalpal-jx.workers.dev/

Post-activation anonymous HTML, `/bookhouse`, actual JS, Garden PNG,
`/canvaskit.wasm` and `/__preview-fixtures.js` all returned 302 to the same Access
host: **PASS**, no application resource exposed. Authorized Garden rendering at
the provider edge remains pending reviewer confirmation; local synthetic sign-in/
Garden PASS is reused. Use only `preview@example.invalid` / `preview-only` after
the approved reviewer privately signs into Access. No credentials, private logs,
real Firebase/API/Socket/DB/AI calls, production changes or Docker operations.

**Reviewer confirmation, 2026-10-09:** user reports “Garden opens successfully”.
The pending provider-edge synthetic Garden check is now **USER-CONFIRMED PASS**.
Anonymous protection retains the independently verified PASS above. No further
upload, test or provider action performed; backend/Docker gates remain separate.

## Backend continuation: read-only storage diagnosis — 2026-10-09

Worktree `a2e8f2f` was clean at entry. No unrelated files/worktrees touched.
Protected synthetic Garden and anonymous Access PASS reused without checks.

**Confirmed blocker:** guest ext4/storage EIO, not merely a missing image tag.
Docker 29.5.2/Colima respond; two containers are running (nine total), untouched.
Host has about 15 GiB free; VM `/dev/vdb1` has about 24 GiB and 5.5 million free
inodes. This shared volume backs both Docker and containerd and is mounted rw.
The retained backend manifest
`sha256:604b2d84b3d541f4ab959924a640bb03ea75e5f329bb95f7a8b2c24a6748b437`
exists as an 856-byte regular file, but Docker open and filesystem flag lookup
return EIO. No image contents, container environments or private logs were read.

Read-only ext4 metadata reports `clean with errors`, error count 2, first error
`ext4_do_writepages`, last error `ext4_journal_check_start`, both EIO at
2026-10-09 14:29:38 PDT. `needs_recovery` alone is not diagnostic on a mounted
journaled filesystem. Host APFS data volume is writable and SMART reports
Verified; those facts do not rule out lower-level faults. Earlier host-space
exhaustion is a plausible trigger, not proven root cause. Damage extent and the
underlying host/virtual-disk cause remain UNKNOWN. No claim of PostgreSQL health.
Backend build PASS retained; backend container and transition runtime NOT READY.
Build peak memory remains UNKNOWN; VM memory allocation is not build peak RAM.

### Minimum safe recovery gate — approval required, not performed

1. Do not run more builds/smokes, prune, delete blobs/caches or perform in-place
   repair. Further build attempts cannot establish filesystem health.
2. Human approves a maintenance window explicitly covering graceful quiescence
   of the existing running containers and stopping Colima, plus a recovery-copy
   destination with adequate capacity. Preserve PostgreSQL and every volume/image.
   The host's current 15 GiB free is not a sufficient basis for assuming room for
   a safe copy of the roughly 70 GiB-used guest volume; arrange separate storage.
3. Human makes and verifies a consistent cold VM/disk recovery copy after the
   approved shutdown, without exposing credential/data contents. Preserve the
   original. Check an **unmounted copy** read-only first (`e2fsck -fn` against
   the human-identified copied ext4 partition, never the live `/dev/vdb1`).
   [e2fsck documents mounted-filesystem checks as unsafe or invalid](https://man7.org/linux/man-pages/man8/e2fsck.8.html).
4. Review the bounded filesystem result privately. Any repair, journal replay,
   VM restart or switch to a fresh isolated runtime requires its own explicit
   scope; never automatically repair/delete/reset the original. A simple restart
   is not verified recovery and can replay the journal before a backup exists.
5. After approved recovery, first establish image readability. If recoverable,
   reuse the existing image for the one bounded synthetic runtime validation
   already specified above. If irrecoverable, separately approve one clean image
   reconstruction on healthy isolated storage. Do not repeat accepted host tests.

### Smallest compatible Render transition (plan only)

1. Human verifies safe metadata for existing `PetalPal_v2`
   (`srv-d983eguq1p3s73fnk1m0`): current Live revision, repository/branch, source
   type, Auto-Deploy OFF, Docker/start/health-check settings. Do not assume the
   historical release SHA or existing service source can be changed in place.
2. Reuse `Dockerfile.transition`: layer the **currently deployed production web
   frontend artifact**, with its existing public Firebase/API binding, onto the
   reviewed compatible backend image. Pin both artifact provenance and image
   digest. The synthetic Cloudflare export must NEVER fill `client/dist` here.
   Express still serves `client/dist`; no API proxy, product UI, AI/security,
   Prisma schema, Garden quality or new service is needed for this compatibility
   layer. If that exact frontend artifact is unavailable, stop for human artifact
   recovery/build approval rather than substituting the synthetic preview.
3. Validate the assembled image's runtime and retained login/deep-link/static
   contracts on healthy isolated storage, using synthetic adapters and no DB
   migration startup. Existing build/CORS/Socket evidence is reused, not proof of
   the missing container runtime or current provider-edge compatibility.
4. Human confirms an existing-service delivery mechanism before any rollout.
   [Render documents Git-built Docker and image-backed services separately](https://render.com/docs/docker);
   [prebuilt images require linux/amd64 and retained registry artifacts](https://render.com/docs/deploying-an-image).
   Do not assume Git-to-image conversion is supported or create a replacement
   service. If necessary, separately review a minimal Git Dockerfile that only
   inherits the immutable transition image, contingent on supported registry
   access; no Expo build on Render and no registry credential inspection here.
5. Before authorizing an exact transition revision/image, human confirms existing
   Firebase Admin/Web App, DB, AI/job and registry configuration readiness without
   disclosing values. Preserve current start/health/proxy/rate-limit settings.
   `npm start` still runs `prisma migrate deploy`: require human evidence of no
   pending migration before a no-database-change rollout; otherwise stop for a
   separate migration decision. Retain a tested frontend-bearing rollback image;
   no automatic rollback or replay of migrations.
6. Only after a separately approved compatible transition is Live, authorize exact
   real-frontend CORS/Firebase domains while retaining old entries and approve
   removal of synthetic fixtures in a distinct real-integration candidate. Human
   tests real Firebase session/return/logout, REST preflight/owner/no-store and
   Socket polling/direct-WS/upgrade/token-refresh reconnect through provider edges.
   Existing Access or synthetic Garden PASS does not close these gates.
7. Activate the real Cloudflare frontend only after those gates pass; retain Render
   web/login until old-origin users/links and independent rollback are resolved.
   Backend-only Render is the final separately approved step, not this transition.

No recovery, build, container execution, database/provider change, service restart,
push, deployment or Cloudflare check performed in this continuation.

## GitHub-hosted backend container validation — prepared 2026-10-09

Local branch `validation/backend-container-57f9afa` continues migration commit
`57f9afac5c1730f354e094a99ce5623ff2f107bd`. The backend Dockerfile, context allowlist,
dependencies, application/security code, Prisma and accepted cross-origin fixture
are unchanged. Local Colima remains forbidden: confirmed ext4 EIO, no verified
independent backup. The protected synthetic Garden PASS is reused without checks.

`.github/workflows/backend-container-validation.yml` runs only on a push changing
that workflow on this exact validation branch. This is deliberate: a brand-new
[manual-dispatch workflow needs default-branch registration](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatch).
Publishing this branch is therefore also authorization for its first CI run;
there is no need to merge main or modify existing CI. Re-run attempts are refused.
No push/run has been authorized or performed. Checkout uses the event's exact SHA,
a pinned action, read-only contents permission and no persisted Git credentials.

The helper refuses local/self-hosted, non-Linux/x64, wrong-branch/event and retry
contexts before Docker access. On the fresh Ubuntu 24.04 runner it performs one
linux/amd64 build of `Dockerfile.backend`, using a dedicated BuildKit container
capped at 4 GiB/2 CPUs and a 15-minute build timeout. It performs one smoke run
with no network outside container loopback, no published ports, a read-only root,
unprivileged UID, no capabilities, 1 GiB/2 CPUs/128 PIDs, and a 75-second outer
deadline (45-second Node test deadline). The job has a 25-minute deadline.

The new container entry point checks backend/security/AI/Prisma components remain
present, Expo/client/artwork/deployment directories and Expo runtime packages are
absent, and the startup command remains unchanged. It then imports the **existing**
cross-origin test, using the image's actual server and dependencies: HTTP listening,
explicit preflight, bearer rejection/acceptance, owner isolation, no-store,
Socket.IO origin/token rejection, polling, WebSocket upgrade, acknowledgement and
refreshed-token reconnect. These origin names are fixture headers, not outbound
destinations. Firebase verification and DB reads use existing synthetic adapters;
only synthetic configuration and two read-only fixture files enter the container.
No PostgreSQL, Firebase identity, paid AI, npm start or migration execution occurs.
This closes a container runtime gap only if remote CI passes; it does not validate
normal migration/model-loader startup or production provider edges.

If readable, CI records the dedicated BuildKit cgroup's `memory.peak` in bytes,
including builder descendants but excluding the host Docker daemon. Otherwise the
value is UNKNOWN. Total build RAM remains UNKNOWN; neither the configured limits,
Docker context size nor Docker client RSS are treated as build memory measurements.
No memory measurement, image build or container smoke has happened in this task.

Local preparation validation: YAML and shell/JS syntax, exact trigger/permission
scope, resource/network controls and six refusal cases PASS. An initial shell
guard check exposed reliance on implicit `errexit`; explicit rejection now passes
all six cases before Git/Docker access. Historical tests were not repeated.

### Publication/deployment-trigger gate (still pending)

The new workflow/helper has no deploy command, provider secret, environment,
OIDC/write permission, registry push, reusable workflow or downstream trigger.
Existing local push workflows target only `integration/mobile-backend-test`;
this new branch does not match. No PR will be opened as part of publication.
This source audit cannot establish current remote/provider automation safety.
Before asking for the final push/run approval, obtain safe metadata confirming:

1. The intended repository: proposed `origin` is `JX-Technologies-Inc/Petalpal`;
   `personal` instead points to `starstarrr/PetalPal_v2`. Do not push both.
2. Render Auto-Deploy remains OFF; Render previews, Cloudflare Git builds/preview
   branches, GitHub Pages, repository/org workflows (`push`, `create`,
   `workflow_run`, `workflow_job`) and external GitHub App/webhook automation will
   not deploy or modify providers for this exact new branch/run. If any check is
   unavailable, publication remains blocked pending human metadata confirmation.
   Do not inspect webhook secret/configuration values or change provider settings.
3. Separate approval explicitly names the final candidate commit/tree, chosen
   repository, `refs/heads/validation/backend-container-57f9afa`, one non-force
   push and its single automatic CI run. No registry publication, retry or deploy.

After remote PASS, reuse the compatible transition plan above: retain the actual
production Render frontend, separately validate its assembly with this backend,
then obtain provider/configuration and exact rollout approval. Real Firebase
verification/session behavior, provider-edge REST CORS/owner/no-store and Socket
polling/direct WebSocket/upgrade/refresh reconnect remain human integration gates.
Backend-only Render cannot precede a ready real Cloudflare frontend and old-origin
cutover; the synthetic preview does not satisfy those gates.

## Architecture update — parallel backend-only Render test service (2026-10-10)

Supersedes, without deleting, "Smallest compatible Render transition", the
`Dockerfile.transition` step of "Validated cutover order" and the related
transition-image gates above. Owner decision: keep existing `PetalPal_v2` and its
production Vite frontend unchanged; add a separate backend-only Render test service
(`Dockerfile.backend`) on an isolated test database and test Firebase project.
Configuration: `docs/render-backend-test-service.md` (prepared, not created).

- Main was updated to `49ea26a6bd9867d5b2c65ca56b4d3e917c5d24a3` after the records
  above; `validation/backend-container-57f9afa` was a fast-forward of it (8 commits,
  no conflicts). Integration continues on `integration/cloudflare-render-migration`.
- Exact-branch backend CI [run 38006087561](https://github.com/JX-Technologies-Inc/Petalpal/actions/runs/38006087561)
  PASSED at `24739b8565992666b30824cd55ea47650b5ab3f5`: one linux/amd64
  `Dockerfile.backend` build and the synthetic container smoke. This closes the
  container-runtime gap blocked by the local Colima ext4 EIO; Colima stays untouched.
  The workflow's branch filter makes it inert after merge.
- Socket.IO `allowRequest` reviewed against engine.io 6.6.11: it runs for each new
  handshake (polling or direct WebSocket) and an accepted session's upgrade inherits
  it. No-Origin native polling remains allowed; React Native direct WebSocket sends
  the backend's own origin, so each backend lists its own origin in
  `CORS_ALLOWED_ORIGINS`. Comment corrected; a no-Origin native polling/upgrade/direct
  WebSocket regression was added, and the whole cross-origin fixture now runs in the
  existing PR security CI.
- Remaining order: create test DB/Firebase/service (human) → parameterize the
  Cloudflare API origin/auth domain → real-auth protected preview against the test
  service → separate decision on production frontend/backend cutover. Production
  `PetalPal_v2`, DNS and existing Workers are not part of these steps.
- Any newer migration notes that exist only on a local machine are not reflected here.
