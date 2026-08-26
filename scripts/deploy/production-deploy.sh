#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-poly-gc}"
APP_DIR="${APP_DIR:-$HOME/poly-gc-react}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
BASE_URL="${BASE_URL:-https://apps.uber-geek.com}"

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "nvm not found at $NVM_DIR/nvm.sh" >&2
  exit 1
fi

# Load the server's Node/npm/pm2 toolchain.
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

cd "$APP_DIR"
APP_DIR="$(pwd -P)"

check_status() {
  local expected="$1"
  local path="$2"
  local actual

  if ! actual="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "${BASE_URL}${path}")"; then
    echo "Smoke check could not reach ${BASE_URL}${path}." >&2
    return 1
  fi

  if [[ "$actual" != "$expected" ]]; then
    echo "Smoke check expected HTTP $expected from $path but received $actual." >&2
    return 1
  fi

  echo "HTTP $actual $path"
}

wait_for_server() {
  local path="/gc/"

  for _attempt in {1..30}; do
    if curl --fail --silent --output /dev/null "${BASE_URL}${path}"; then
      return 0
    fi

    sleep 1
  done

  echo "Server did not become ready at ${BASE_URL}${path}." >&2
  return 1
}

echo "== Repo state =="
git status -sb

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked deployment files are modified; refusing to pull." >&2
  exit 1
fi

echo
echo "== Pull latest =="
git pull --ff-only

echo
echo "== Update pinned deployed apps =="
git submodule sync --recursive
git submodule update --init --recursive

echo
echo "== Install deployment dependencies =="
npm install --include=dev

shopt -s nullglob
deployed_apps=("$APP_DIR"/deployed-apps/*)
shopt -u nullglob

for app_dir in "${deployed_apps[@]}"; do
  if [[ ! -f "$app_dir/package.json" ]]; then
    continue
  fi

  if [[ ! -f "$app_dir/package-lock.json" ]]; then
    echo "Deployed app is missing a lockfile: $app_dir" >&2
    exit 1
  fi

  echo "Installing $(basename "$app_dir") from its lockfile"
  npm --prefix "$app_dir" ci --include=dev
done

export NODE_ENV=prod
export GC_ENV=prod
export NODE_OPTIONS=--max-old-space-size=4096

echo
echo "== Clean generated deployment output =="
DIST_DIR="$APP_DIR/dist"
if [[ "$DIST_DIR" != "$APP_DIR/dist" || "$APP_DIR" == "/" ]]; then
  echo "Refusing to clean an unexpected deployment output path: $DIST_DIR" >&2
  exit 1
fi
rm -rf -- "$DIST_DIR"

echo
echo "== Build composed production bundles =="
npm run build

echo
echo "== Restart PM2 app =="
pm2 restart "$APP_NAME" --update-env

echo
echo "== Wait for server =="
wait_for_server

echo
echo "== Deployment smoke checks =="
check_status 200 "/gc/"
check_status 200 "/sat/"
check_status 200 "/nag/"
check_status 200 "/nag/notification-test"
check_status 200 "/nag/manifest.webmanifest"
check_status 200 "/nag/service-worker.js"
check_status 200 "/nag/api/notifications/vapid-public-key"
check_status 404 "/pipeline/"
check_status 404 "/3d-poc/"
check_status 404 "/simple-test/"

echo
echo "== PM2 status =="
pm2 list

echo
echo "== Recent logs =="
pm2 logs "$APP_NAME" --lines 40 --nostream
