#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-poly-gc}"
APP_DIR="${APP_DIR:-$HOME/poly-gc-react}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
  echo "nvm not found at $NVM_DIR/nvm.sh" >&2
  exit 1
fi

# Load the server's Node/npm/pm2 toolchain.
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

cd "$APP_DIR"

echo "== Repo state =="
git status -sb

echo
echo "== Pull latest =="
git pull

echo
echo "== Install dependencies =="
npm install

echo
echo "== Restart PM2 app =="
pm2 restart "$APP_NAME" --update-env

echo
echo "== PM2 status =="
pm2 list

echo
echo "== Recent logs =="
pm2 logs "$APP_NAME" --lines 40 --nostream
