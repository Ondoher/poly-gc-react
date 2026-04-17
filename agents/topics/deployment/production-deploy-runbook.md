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

Those files are untracked on the server and should remain there. Do not delete them during a deploy.

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

Current deploy flow:

```bash
source ~/.nvm/nvm.sh
cd ~/poly-gc-react
git status -sb
git pull
npm install
npm run build
pm2 restart poly-gc --update-env
```

Equivalent scripted path from the repo:

```bash
bash ./scripts/deploy/production-deploy.sh
```

Notes:

- `npm install` is included so deploys stay safe when dependencies change.
- `npm run build` is required before restart because production serves the built bundles under `dist/`.
- `pm2 restart poly-gc --update-env` matches the live process name and refreshes environment usage.
- The deploy helper script assumes:
  - app name: `poly-gc`
  - repo dir: `~/poly-gc-react`
  - `nvm` at `~/.nvm`
- You can override those with:
  - `APP_NAME`
  - `APP_DIR`
  - `NVM_DIR`
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

- load `https://apps.uber-geek.com`
- load the Mahjongg screen
- hard refresh if a browser cache is suspected after a JS/CSS bundle change
- verify a fresh board starts
- verify restart, undo, redo, hint, and feedback/help entry points still open

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
- Because the deploy flow is `git pull`, avoid overwriting the server-local untracked production files.
- If `git pull` ever reports local changes or merge conflicts, stop and inspect before forcing anything.
