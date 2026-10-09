#!/usr/bin/env bash
set -euo pipefail

# Never run this helper against the damaged local Docker/Colima VM.
if [[ ${GITHUB_ACTIONS:-} != true || ${RUNNER_ENVIRONMENT:-} != github-hosted ||
      ${RUNNER_OS:-} != Linux || ${RUNNER_ARCH:-} != X64 ||
      ${GITHUB_EVENT_NAME:-} != push || ${GITHUB_RUN_ATTEMPT:-} != 1 ||
      ${GITHUB_REF:-} != refs/heads/validation/backend-container-57f9afa ]]; then
  printf 'Refusing execution outside the approved first GitHub-hosted run.\n' >&2
  exit 64
fi
[[ $(git rev-parse HEAD) == "${GITHUB_SHA:?}" ]] || exit 65
if [[ -e .env || -e .env.local ]]; then exit 65; fi

image=petalpal-backend:synthetic-ci
builder=petalpal-backend-ci
build_status=NOT_RUN
smoke_status=NOT_RUN
memory_peak=UNKNOWN
report() {
  # cgroup v2 peak includes this dedicated BuildKit daemon and its descendants.
  # It excludes the host Docker daemon and is NOT total runner/build RAM.
  local measured
  measured=$(timeout 10s docker exec "buildx_buildkit_${builder}0" cat /sys/fs/cgroup/memory.peak 2>/dev/null) || measured=
  if [[ $measured =~ ^[1-9][0-9]*$ ]]; then memory_peak=$measured; fi
  {
    printf 'Source commit: `%s`\n\n' "$GITHUB_SHA"
    printf 'Backend linux/amd64 build: %s; synthetic container smoke: %s\n\n' "$build_status" "$smoke_status"
    printf 'BuildKit cgroup memory peak bytes: %s (excludes host Docker daemon). Total build RAM: UNKNOWN.\n\n' "$memory_peak"
    printf 'Limits: build 4 GiB / 2 CPUs / 15 min; smoke 1 GiB / 2 CPUs / 128 PIDs / 75 sec. Limits are not measurements.\n\n'
    printf 'No npm start/migrations, real Firebase, provider-edge tests, image publication or deployment.\n'
  } >> "${GITHUB_STEP_SUMMARY:?}"
}
trap report EXIT

# Fresh ephemeral runner only. No cache import/export, shared cache pruning,
# local VM access, credentials, build secrets or registry publication.
docker buildx create --name "$builder" --driver docker-container \
  --driver-opt memory=4g,memory-swap=4g,cpu-period=100000,cpu-quota=200000
build_status=FAIL
timeout --signal=TERM --kill-after=10s 15m docker buildx build \
  --builder "$builder" --platform linux/amd64 --file Dockerfile.backend \
  --tag "$image" --load --progress=plain .
build_status=PASS

smoke_status=FAIL
[[ $(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$image") == linux/amd64 ]] || exit 1
[[ $(docker image inspect --format '{{json .Config.Cmd}}' "$image") == '["npm","start"]' ]] || exit 1
timeout --signal=TERM --kill-after=10s 75s docker run --rm --pull=never \
  --name petalpal-backend-synthetic-smoke --platform linux/amd64 --network none \
  --memory=1g --memory-swap=1g --cpus=2 --pids-limit=128 --read-only \
  --user 1000:1000 --cap-drop=ALL --security-opt=no-new-privileges \
  --tmpfs /tmp:rw,nosuid,noexec,size=64m \
  -e NODE_ENV=test -e DOTENV_CONFIG_PATH=/dev/null -e DOTENV_CONFIG_QUIET=true \
  -e DEV_DATABASE_URL=postgresql://fixture:fixture@127.0.0.1:1/petalpal_test \
  -e FIREBASE_PROJECT_ID=petalpal-synthetic -e AI_ASYNC_EXECUTION_MODE=manual \
  --mount "type=bind,src=$PWD/test/back/backend-container-smoke.mjs,dst=/app/test/back/backend-container-smoke.mjs,readonly" \
  --mount "type=bind,src=$PWD/test/back/cross-origin-web.test.js,dst=/app/test/back/cross-origin-web.test.js,readonly" \
  --entrypoint node "$image" \
  --test --test-timeout=45000 /app/test/back/backend-container-smoke.mjs
smoke_status=PASS
# Runner teardown owns ephemeral resources. Never prune or remove shared storage.
