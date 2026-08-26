# Deployable Apps Deployment Update

## Objective

Keep production deployment orchestration in `poly-gc-react` while allowing
apps developed in separate repositories to be deployed through the same
Polylith server. Naginator is the first real deployed app.

## Current Decisions

- `poly-gc-react` remains the deployment repository and owns the production
  release composition.
- Separately owned app repositories should be pinned beneath `deployed-apps/`;
  a Git submodule is the preferred first approach because its gitlink gives the
  deployment repository one exact app revision to release and roll back.
- The root Polylith configuration discovers direct app children beneath
  `deployed-apps/`.
- Production master apps initialize before discovered apps. Polylith now
  specifically enforces that ordering.
- The CLI supplies a registry as the fourth router-entry parameter. Use of that
  registry is intentional rather than a consequence of module resolution.
- The composing root configures an optional `deployment.setup` module. Polylith
  invokes it once and awaits it before any app router initializes. The setup
  module owns shared-service registration and the shared registry lifecycle.
- This deployment's setup registers and starts the shared config service. GC
  attaches the ready shared registry and consumes config without owning its
  registration or lifecycle.
- Naginator retrieves the attached `shared` registry and consumes `config`
  without deciding who must create it. The combined deployment host registers
  production config; Naginator's standalone development host registers
  development config.
- The deployment host's ignored configuration owns Naginator's `nag.mongo` and
  `nag.webPush` settings. Local composition reuses Naginator's stable
  development VAPID pair; production has a separately generated server-local
  pair and does not expose or commit its private key.
- The temporary `simple-test-app` has been removed from source and generated
  output. Naginator is now the only discovered deployment app.

## Possible Future Direction

This repository may eventually become only the main deployment point, with GC
moved to its own repository and composed as another deployed app. This is a
future direction rather than a committed near-term migration.

The current work should preserve that option:

- Deployed apps should depend on shared service names and contracts, not on GC
  as a repository or module-resolution owner.
- The deployment host publishes `config`. Consumers depend on that shared
  service contract without encoding knowledge of GC or its repository.
- Before GC itself moves out, shared infrastructure bootstrap must move into
  the dedicated deployment-host entry point. That host code registers
  production services without pretending to be an application.
- The final deployment repository would own Polylith composition, production
  environment setup, shared infrastructure bootstrap, release pins, build
  output, and PM2 operations. Product UI and domain code would live in the
  deployed app repositories.

Do not move GC until the host-owned bootstrap can provide its current shared
services without importing GC application code. The Naginator deployment is a
useful first proof of this boundary.

## Host Bootstrap Contract

Polylith supports one optional server-root deployment setup module, separate
from every resident or discovered app router. Its narrow responsibility is to
register and start host-owned services on the CLI-created shared registry.

The root config declares it as:

```json
{
    "deployment": {
        "setup": "server/setup-deployment.js"
    }
}
```

The module contract is:

```js
export default async function setupDeployment({
    sharedRegistry,
    serverRoot,
    config,
}) {
    new ConfigService(sharedRegistry);
    await sharedRegistry.start();
}
```

The startup sequence is:

1. Create the shared registry.
2. Load and invoke the composing root's setup module exactly once.
3. Let setup register services, run the shared lifecycle, and resolve only when
   shared services are ready.
4. Initialize resident app routers in declaration order.
5. Initialize discovered app routers in discovery order.

App entry points still receive the shared registry as their fourth parameter
so they can deliberately attach it to their own registry. Apps consume shared
services; they do not start the shared registry or own its lifecycle.

Host selection replaces application-level environment fallback. When
Naginator runs alone, Polylith invokes Naginator's development host bootstrap.
When Naginator is discovered by this deployment repository, Polylith invokes
only this repository's host bootstrap. Naginator's application services follow
the same unconditional config lookup in both cases and fail loudly if the
selected host did not satisfy the contract.

If setup is configured but missing, invalid, or rejected, deployment startup
fails. A discovered app's own setup entry is ignored by the composing root and
is used only when that app runs as the standalone root.

## Recommended Deployment Shape

The Naginator repository is pinned at `deployed-apps/naginator` as a Git
submodule using its public HTTPS remote. The current pin is
`cae4ceb37ede69f047396ea237caa4f148da1112`. A release of this repository
selects a Naginator release by committing the desired submodule revision.

This is intentionally a **pull deployment model**. For simplicity, the
deployment repository knows every deployed app, pins its source revision, and
pulls that source into the composed checkout. Adding or advancing a deployed
app therefore requires a release change in this repository even when the app
is developed elsewhere.

The production sequence should become:

1. Pull the main repository with fast-forward-only behavior.
2. Synchronize and update submodules recursively to their committed revisions.
3. Install the main repository dependencies.
4. Install each deployed app's dependencies from its own lockfile.
5. Set `NODE_ENV=prod` and the required Node heap option.
6. Build the production master apps and all intentionally discovered apps.
7. Restart the existing `poly-gc` PM2 process with its updated environment.
8. Smoke-test GC, SAT, Naginator, logs, and routes that must remain absent.

Naginator should retain its own dependency ownership. Installing within its
submodule also permits it to have its own physical `@polylith/core`; its entry
point deliberately attaches the fourth registry parameter, so separate Node
module singletons are supported.

## Deferred Push Model

The system may later move to a push deployment model in which each app owns its
release trigger and delivers an immutable app revision or artifact to the
deployment host. That would remove the requirement for this repository to pin
and pull every app source repository.

The deployment host would still retain platform authority: it must authenticate
the publisher, validate the app identity and mount, stage and verify the
artifact, activate it atomically, retain rollback data, and restart or reload
the composed process safely. App ownership of deployment should not imply
uncontrolled mutation of the live checkout.

This push model is deferred. The near-term submodule-based pull model is chosen
because its release composition and rollback point are visible in one main
repository commit. The Polylith discovery, initialization-order, and shared
registry contracts should remain usable under either delivery model.

### Deferred Secret Provisioning

Application source delivery and secret delivery are separate channels. A
deployed app may eventually own an authenticated out-of-band process that
provisions or rotates its deployment secrets, but secrets must never be placed
in the app repository, submodule revision, build output, or release artifact.

Until that process exists, the deployment operator provisions app secrets in
the host's ignored server-local configuration. A future mechanism must scope
write authority to the app's owned configuration namespace, avoid returning or
logging secret values, validate the resulting configuration before activation,
and support deliberate rotation and recovery.

## Required Updates

- Commit and push the composed release containing Naginator pin `cae4ceb`.
- Run the production helper and verify the updated Naginator deployment.
- Complete the installed, suspended-iPhone Web Push round trip on the deployed
  `/nag/` origin.

## Release And Rollback Contract

The main repository commit and its submodule gitlink together define a release.
Rollback should restore the prior main repository revision, update submodules
to the restored gitlinks, reinstall dependencies when necessary, rebuild, and
restart PM2. Avoid a deploy-time clone of an unpinned branch because that would
make the released Naginator revision independent of the main release commit.

## Risks To Resolve

- Discovery treats every qualifying direct child beneath `deployed-apps/` as a
  deployment candidate. Test fixtures must not live in the production
  discovery root.
- The server-local `polylith.prod.json` is untracked and shallowly overlays the
  root configuration. Its local `apps` list should continue to name only the
  master apps; Naginator must have one owner through discovery rather than a
  duplicate local entry.
- Discovered app configuration currently comes from the app's base
  `polylith.json`; it should therefore remain deployment-neutral unless
  Polylith later adds discovered-app environment overlays.
- The root lockfile is ignored, so the deployment helper uses
  `npm install --include=dev` there. Naginator carries its own committed
  lockfile and is installed independently with `npm ci --include=dev`.
- Building directly into the live `dist` directory is not atomic. A later
  hardening pass may stage and swap build output, but that is not required to
  introduce the first deployed app.

## Current Status

- [x] Polylith discovers multiple repository apps.
- [x] Master apps initialize before discovered apps.
- [x] The shared registry is explicitly passed to router entry points.
- [x] Registry `attach` and `getAttached` behavior was validated locally.
- [x] Polylith supports and awaits the composing root's optional
  `deployment.setup` before any app router.
- [x] This repository configures `server/setup-deployment.js`, which registers
  host-owned `config` and starts the shared registry.
- [x] GC no longer registers or starts shared deployment services.
- [x] GC has no local config implementation or declaration; its feedback
  service resolves config through the local registry's `shared` attachment.
- [x] The temporary `simple-test-app` source and stale `dist/simple-test`
  output were removed; its route now returns HTTP 404.
- [x] Local Polylith npm links were removed and published version 1.2.1 is
  installed for all six Polylith packages. A full build and live shared-config
  and GC route checks passed against the installed release.
- [x] The Naginator notification POC is committed and published for pinning.
- [x] Ignored development and production host configuration now supplies the
  complete Naginator Mongo and VAPID contract. Both VAPID pairs were validated;
  production generated its key material directly on the server.
- [x] Naginator is pinned at published commit `b27b151` under
  `deployed-apps/naginator`, and its dependencies install from its committed
  lockfile.
- [x] The composed `--all` build produced `dist/nag`. Live checks passed for
  `/nag/`, its deep link, manifest, service worker, shared-config VAPID route,
  GC, and the absent simple-test route.
- [x] The production helper now performs fast-forward pulls, pinned submodule
  checkout, root and deployed-app installs, explicit production environment
  selection, full generated-output cleanup, composed `--all` build, PM2
  restart, readiness waiting, and positive/negative HTTP smoke checks. Its Bash
  syntax passes.
- [x] The production runbook documents the canonical deploy helper, Naginator
  checks, device acceptance test, and submodule-aware rollback.
- [x] Main release `801cae0`, with Naginator pinned at `b27b151`, was deployed
  successfully. The production helper completed dependency installation,
  composed build, PM2 restart, positive-route checks, and retired-route 404
  checks. Independent verification confirmed the revisions, Node v24.14.1,
  online `poly-gc` process, route results, and an 87-character public VAPID
  key response without exposing private key material.
- [x] Main release `3bc4f24`, with Naginator advanced to `36aaa89`, was deployed
  successfully. Before release, its exact lockfile install, 90 client tests,
  24 server tests, and the root composed build passed. Production independently
  verified the root and app revisions, online PM2 process, expected route
  statuses, retired-route 404s, and valid public VAPID response shape.
- [x] The next Naginator pin was advanced locally to `cae4ceb`. Its 92 client
  tests, 24 server tests, and the root composed build completed successfully;
  package, lockfile, and Polylith configuration were unchanged.
- [ ] Commit and push the root release containing Naginator `cae4ceb`, then run
  the production helper and repeat the production smoke checks.
- [ ] Complete the installed, suspended-iPhone Web Push round trip on the
  deployed `/nag/` origin.
- [ ] Later, evaluate extracting shared bootstrap from GC before making GC a
  deployed app.
- [ ] Later, evaluate an authenticated, artifact-based push deployment
  protocol after the pull model is operational.
- [ ] Later, design authenticated out-of-band secret provisioning so an app
  can manage only its owned deployment namespace without putting secrets in
  source or release artifacts.

## Minimal Reload Sources

- `scripts/deploy/production-deploy.sh`
- `agents/topics/standards/deployment/production-runbook.md`
- `package.json`
- `polylith.json`
- `server/setup-deployment.js`
- `server/services/config.js`
- `server/gc/routing/main-router.js`
- `server/gc/features/feedback.js`
