#!/usr/bin/env bash
# OFFLINE-only zh-Hans Weekly/Monthly acceptance on a throwaway local PostgreSQL container.
# No credentials, no Claude/Gateway calls (mocked responses). The only network access is a one-time
# Docker image pull if the image is missing. Removes only the container this script created.
set -u
NAME=petalpal-zh-acceptance-offline
LABEL="petalpal.acceptance=offline-$$"
IMAGE=pgvector/pgvector:pg16
PORT=55432   # fixed: the runner refuses any other port
DB_USER=acceptance
DB_PASS=acceptance-local-only
DB=petalpal_acceptance_offline_test
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CREATED=0
FAILS=0
RESULTS=()
LOGDIR="$(mktemp -d -t petalpal-zh-acceptance)"

say() { printf '%s\n' "$*"; }
stop() { say "STOP: $*"; exit 2; }
cleanup() {
  if [ "$CREATED" = 1 ]; then
    id="$(docker ps -aq --filter "name=^/${NAME}$" --filter "label=${LABEL}")"
    [ -n "$id" ] && docker rm -f "$id" >/dev/null 2>&1 && say "Cleanup: removed container ${NAME} (tmpfs data discarded)"
  fi
  rm -rf "$LOGDIR"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Clean environment: no inherited secrets, .env, Render or provider variables reach any child process.
clean() { env -i PATH="$PATH" HOME="$HOME" NODE_ENV=test DEV_DATABASE_URL="$URL" "$@"; }
step() {
  label="$1"; log="$LOGDIR/$2.log"; shift 2
  say ""; say "== ${label}"
  if "$@" >"$log" 2>&1; then RESULTS+=("PASS  ${label}"); tail -n "${TAIL:-0}" "$log"
  else RESULTS+=("FAIL  ${label}"); FAILS=$((FAILS + 1)); tail -n 30 "$log"; fi
}

# ---- Preflight (stop safely; never touch anything that already exists) ----
cd "$ROOT" || stop "repository not found"
[ "$(git branch --show-current)" = "test/zh-report-acceptance" ] || stop "not on branch test/zh-report-acceptance"
[ -f scripts/zh-report-acceptance.mjs ] || stop "acceptance runner missing"
[ -x node_modules/.bin/prisma ] || stop "dependencies missing (not reinstalling automatically)"
[ -d generated/prisma ] || stop "Prisma Client not generated"
[ -e .env ] && stop ".env present in repo; move it away first"
docker info >/dev/null 2>&1 || stop "Docker is not running"
[ -n "$(docker ps -aq --filter "name=^/${NAME}$")" ] && stop "container ${NAME} already exists; leaving it untouched"
[ -n "$(docker ps -q --filter "publish=${PORT}")" ] && stop "a Docker container already publishes port ${PORT}"
lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1 && stop "port ${PORT} is already in use"

# ---- Disposable PostgreSQL (loopback only, data in tmpfs, no volume) ----
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  say "Pulling ${IMAGE} (one-time, ~150 MB)..."
  docker pull -q "$IMAGE" >/dev/null || stop "image pull failed"
fi
docker run -d --rm --name "$NAME" --label "$LABEL" \
  -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASS" -e POSTGRES_DB="$DB" \
  -p "127.0.0.1:${PORT}:5432" --tmpfs /var/lib/postgresql/data "$IMAGE" >/dev/null || stop "container start failed"
CREATED=1
URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PORT}/${DB}"
say "Started disposable PostgreSQL ${NAME} on 127.0.0.1:${PORT} (database ${DB})"
ready=0
for _ in $(seq 1 60); do
  if docker exec -e PGPASSWORD="$DB_PASS" "$NAME" psql -h 127.0.0.1 -U "$DB_USER" -d "$DB" -tAc 'select 1' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[ "$ready" = 1 ] || stop "PostgreSQL did not become ready"

# ---- Tests ----
TAIL=3 step "Prisma migrations on disposable database (real schema)" migrate clean node_modules/.bin/prisma migrate deploy
TAIL=10 step "PGlite suites: sonnet-weekly + opus-monthly (mocked Gateway)" pglite \
  clean node --test test/back/sonnet-weekly.test.js test/back/opus-monthly.test.js
if [ "$FAILS" = 0 ] || [ "${RESULTS[0]}" = "PASS  Prisma migrations on disposable database (real schema)" ]; then
  TAIL=200 step "zh-Hans acceptance runner: offline (mocked Gateway, real PostgreSQL)" runner \
    clean node scripts/zh-report-acceptance.mjs offline
else
  RESULTS+=("SKIP  zh-Hans acceptance runner (migrations failed)"); FAILS=$((FAILS + 1))
fi

say ""; say "==== SUMMARY ===="
for line in "${RESULTS[@]}"; do say "$line"; done
if [ "$FAILS" = 0 ]; then say "OFFLINE ACCEPTANCE: PASS (no real Claude calls, no credentials used)"; exit 0; fi
say "OFFLINE ACCEPTANCE: FAIL (${FAILS} step(s))"; exit 1
