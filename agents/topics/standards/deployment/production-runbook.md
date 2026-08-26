# Production Deploy Runbook

Use this for the current live Mahjongg server deploy flow.

Current verified server shape:

- host: `apps.uber-geek.com`
- ssh user: `codex`
- app directory: `/home/codex/poly-gc-react`
- process manager: `pm2`
- pm2 app name: `poly-gc`
- node runtime: `nvm`-managed Node `v24.14.1`

Important server-local files in the repo working tree:

- `ecosystem.config.cjs`
- `polylith.prod.json`

Those files are untracked on the server and should remain there. Do not delete
them during a deploy.

Production uses `NODE_ENV=prod`, so Polylith shallow-overlays the server-local
`polylith.prod.json` over `polylith.json`. The production `apps` list should
intentionally be limited to `gc` and `sat`:

```json
{
  "apps": [
    {
      "name": "gc",
      "filename": "gc.json",
      "code": false,
      "default": true
    },
    {
      "name": "sat",
      "filename": "sat.json",
      "code": false,
      "default": false
    }
  ]
}
```

The same server-local file may also hold production certificate configuration.
Because the overlay is shallow, top-level keys such as `apps` and `https`
replace the matching values from `polylith.json` completely.

## Login

From this workspace, the current access path uses the key in `security/`:

```powershell
& 'C:\Program Files\PuTTY\plink.exe' `
  -hostkey "ssh-ed25519 255 SHA256:nfqyGr3k03/6xc+xSOR6ir+lN3s6YRXkcZ+Vk9ZoWaE" `
  -i 'c:\dev\poly-gc-react\security\codex.apps.uber-geek.com.private.ppk' `
  codex@apps.uber-geek.com
```

## Prepare Shell

After login, load the `nvm` environment before using `node`, `npm`, or `pm2`:

```bash
source ~/.nvm/nvm.sh
```

## Deploy

The repository helper is the canonical deploy flow:

```bash
source ~/.nvm/nvm.sh
cd ~/poly-gc-react
bash ./scripts/deploy/production-deploy.sh
```

The helper:

- refuses to pull over tracked working-tree or index changes while preserving
  ignored server-local production files;
- pulls the main repository with fast-forward-only behavior;
- synchronizes and checks out every submodule at the gitlink pinned by the
  main release;
- installs root dependencies and installs each direct deployed app with
  `npm ci` from its committed lockfile;
- sets `NODE_ENV=prod`, `GC_ENV=prod`, and
  `NODE_OPTIONS=--max-old-space-size=4096`;
- removes the complete generated `dist` tree before the production `--all`
  build, preventing removed or excluded apps from remaining public;
- builds the production overlay's resident GC and SAT apps plus discovered
  Naginator;
- restarts `poly-gc`, waits up to 30 seconds for GC, and runs positive and
  negative HTTP smoke checks; and
- prints PM2 status and recent logs.

The root repository intentionally uses `npm install --include=dev` because its
lockfile is ignored and its Polylith build tooling is a development dependency.
Naginator has its own committed lockfile and uses `npm ci --include=dev`.

Helper defaults:

- The deploy helper script assumes:
  - app name: `poly-gc`
  - repo dir: `~/poly-gc-react`
  - `nvm` at `~/.nvm`
- You can override those with:
  - `APP_NAME`
  - `APP_DIR`
  - `NVM_DIR`
  - `BASE_URL`
- The live process currently runs from:
  - cwd: `/home/codex/poly-gc-react`
  - script: `npm start`
  - env: `NODE_ENV=prod`, `GC_ENV=prod`

## Verify

Recommended verification immediately after deploy:

```bash
source ~/.nvm/nvm.sh
cd ~/poly-gc-react
pm2 list
pm2 describe poly-gc
pm2 logs poly-gc --lines 100
```

Then smoke test the site in a browser:

- load `https://apps.uber-geek.com/gc`
- load the Mahjongg screen
- load `https://apps.uber-geek.com/sat`
- load `https://apps.uber-geek.com/nag/`
- load `https://apps.uber-geek.com/nag/notification-test` directly
- verify the Naginator manifest and service worker load beneath `/nag/`
- verify `https://apps.uber-geek.com/nag/api/notifications/vapid-public-key`
  returns JSON without exposing the private key
- verify `https://apps.uber-geek.com/pipeline` returns 404
- verify `https://apps.uber-geek.com/3d-poc` returns 404
- verify `https://apps.uber-geek.com/simple-test` returns 404
- hard refresh if a browser cache is suspected after a JS/CSS bundle change
- verify a fresh board starts
- verify restart, undo, redo, hint, and feedback/help entry points still open

The automated checks prove composition and configuration, not Web Push delivery.
After the first deployment, install `/nag/` from Safari on the target iPhone,
schedule the 30-second notification, leave and lock the device, open the
notification, and acknowledge it in the reopened PWA.

## Rollback

The main commit and its Naginator gitlink are one release. Record the current
main revision before deploying. To restore a prior release that still includes
Naginator:

```bash
source ~/.nvm/nvm.sh
cd ~/poly-gc-react
git switch --detach <previous-main-revision>
git submodule sync --recursive
git submodule update --init --recursive
npm install --include=dev
npm --prefix deployed-apps/naginator ci --include=dev
export NODE_ENV=prod
export GC_ENV=prod
export NODE_OPTIONS=--max-old-space-size=4096
rm -rf -- "$PWD/dist"
npm run build
pm2 restart poly-gc --update-env
```

If rolling back to a revision from before Naginator was present, run
`git submodule deinit -f --all` before switching revisions, confirm that
`deployed-apps/naginator` is gone afterward, and omit its `npm ci` command.
Removing the complete `dist` tree ensures `/nag/` cannot survive that rollback
as stale static output. Run the same resident-app and absent-route checks after
rollback. Return the checkout to `main` deliberately before the next normal
pull deployment.

## Logs

Current PM2 logs:

- out: `/home/codex/.pm2/logs/poly-gc-out.log`
- error: `/home/codex/.pm2/logs/poly-gc-error.log`

## PM2 Startup

The live PM2 process is present and running. The startup command reported by PM2 is:

```bash
sudo env PATH=$PATH:/home/codex/.nvm/versions/node/v24.14.1/bin pm2 startup systemd -u codex --hp /home/codex
```

Run that if startup-on-reboot needs to be re-established or repaired.

## Current Caveats

- The repo remote on the server is HTTPS GitHub:
  - `https://github.com/Ondoher/poly-gc-react.git`
- The Naginator submodule also uses a public HTTPS GitHub remote, so the server
  does not require a separate SSH deploy key for the current repository.
- Because the deploy flow is `git pull`, avoid overwriting the server-local untracked production files.
- If `git pull` ever reports local changes or merge conflicts, stop and inspect before forcing anything.
