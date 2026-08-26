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
- The temporary `simple-test-app` proved the registry contract and must be
  removed before the next commit so it cannot be discovered in production.

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

Place the Naginator repository at `deployed-apps/naginator` as a pinned Git
submodule. A release of this repository then selects a Naginator release by
committing the desired submodule revision.

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

## Required Updates

- Add Naginator as a pinned submodule under `deployed-apps/`.
- Add submodule synchronization and checkout to the production deploy script.
- Install deployed-app dependencies before building.
- Make the deploy script explicitly set the production environment. The
  current helper does not set `NODE_ENV=prod`, although the runbook does.
- Reconcile the current build mismatch: the helper builds `--all`, while the
  manual runbook builds only SAT. The simplest reliable contract is a
  production `--all` build after discovery contains only intentional apps.
- Clean an app's `dist/<mount>` destination before rebuilding it and remove the
  destination when undeploying it, because the static server can otherwise
  expose stale output.
- Add Naginator smoke checks and rollback instructions to the production
  runbook.
- Ensure the production server has Git credentials for the Naginator
  repository if it is private.
- Keep this repository on the published Polylith release containing registry
  attachment, deployment setup, and enforced master-before-discovered
  initialization. Version 1.2.1 is the first consumed release with the final
  contracts.

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
- The root lockfile is currently ignored and the deploy uses `npm install`.
  Naginator should at least carry a committed lockfile and use `npm ci` for its
  independently owned dependencies.
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
- [x] GC-to-simple-test config sharing returned HTTP 200 in a live local test.
- [ ] Remove `simple-test-app` before the next commit.
- [x] Local Polylith npm links were removed and published version 1.2.1 is
  installed for all six Polylith packages. A full build and live shared-config
  and GC route checks passed against the installed release.
- [ ] Add the Naginator repository at a pinned revision.
- [ ] Update and verify the production deployment workflow.
- [ ] Later, evaluate extracting shared bootstrap from GC before making GC a
  deployed app.
- [ ] Later, evaluate an authenticated, artifact-based push deployment
  protocol after the pull model is operational.

## Minimal Reload Sources

- `scripts/deploy/production-deploy.sh`
- `agents/topics/standards/deployment/production-runbook.md`
- `package.json`
- `polylith.json`
- `server/setup-deployment.js`
- `server/services/config.js`
- `server/gc/routing/main-router.js`
- `server/gc/features/feedback.js`
