# Reconciliation POC Current State

This document is not a historical log. Keep it limited to the current POC
state, current open items, and the next verification target. Historical
evidence belongs in numbered records and
`agents/topics/apps/flat/reconciliation/archive/conclusions.md`.

## Current-State Rule

- This document is the current POC snapshot, not a running history.
- Replace stale facts when the current state changes instead of appending
  chronology.
- Keep only current state, active open items, the next verification target,
  required pointers, and current artifact/log locations.
- Keep lightweight chronology in
  `tmp/atmosphere/reconciliation/running-log.md` when a chronological note is
  useful.
- Keep durable evidence in numbered records under
  `tmp/atmosphere/reconciliation/NNN-*`.

## Current State

- Status: reopened for Milestone 5, a focused external-boundary-radiance
  proof.
- Active implementation root: `scripts/flat/reconciliation/POC/`.
- Active documentation root: `agents/topics/apps/flat/reconciliation/`.
- Starting-point design:
  `agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md`.
- Proceed plan:
  `agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-plan.md`.
- Additional information:
  runner and experiment scripts live under
  `scripts/flat/reconciliation/POC/src/runners/`, with browser execution
  support in `scripts/flat/reconciliation/POC/browser-page/runner.js` and
  `scripts/flat/reconciliation/POC/browser-jobs/browser-command.json`.
  Production implementation context is `shared/algorithm32/production/`, and
  diagnostic app context is `src/flat32/index.js`.
- Experimental lane rules:
  `agents/topics/apps/flat/reconciliation/experimental-guidelines.md`.
- Production destination: `shared/algorithm32/production/` after a numbered
  reconciliation record accepts the contract.
- Motivation: production `flat32` diagnostics showed captured display-style
  star meshes remain visible at San Jose solar noon after substantial
  brightness reduction, so captured scene RGB tuning is not the accepted
  visibility model.

## Current Contract Intent

- Add an `ExternalBoundaryRadiance` role sampled along the camera ray.
- Compose visible outside-atmosphere radiance as
  `pathRadiance + viewTransmittance * celestialRadiance`.
- Use the same boundary-radiance path for stars, Moon, planets, and Sun disks.
- Keep those visible bodies out of the incident-radiance/L2 cache.
- Add a source-owned companion visible-disk provider for the Sun so one
  source owns the canonical source facts while exposing both atmosphere
  illumination and camera-ray visibility roles.
- Leave optional atmosphere illumination from Moon or starfield radiance to a
  later source/cache design.
- Keep decorative or fallback background color separate from physical
  outside-atmosphere radiance.

## Artifact State

- The previous `tmp/atmosphere/reconciliation/` artifacts are preserved at
  `tmp/atmosphere/reconciliation_mark_i/`.
- Running chronology, if needed, belongs in
  `tmp/atmosphere/reconciliation/running-log.md`.
- Fresh Milestone 5 records should use a new
  `tmp/atmosphere/reconciliation/NNN-*` root.
- The Mark I folder is evidence/archive material only. Do not import or
  runtime-link active POC code from it.
- Old experimental documentation is archived under
  `agents/topics/apps/flat/reconciliation/archive/` with `mark-i-*` names.

## Open Items

- Define the visible-emitter descriptor owned by light sources.
- Prototype the external boundary-radiance sampler and composition point.
- Include a Sun disk provider created from the light source.
- Run a focused proof that attenuates daytime stars while preserving the
  ability for high-radiance bodies such as the future Moon to remain visible.
- Record the first accepted Milestone 5 proof under the fresh reconciliation
  artifact root.

## Verification

- No Milestone 5 proof record has been accepted yet.
- No tests were run for this documentation-only refresh.
