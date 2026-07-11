# Reconciliation Status

This document is not a historical log. Keep it limited to current state,
current open items, and the next verification target. Historical decisions
belong in numbered records and archived
[Conclusions](archive/conclusions.md).

## Status-Doc Rule

- This document is a current-state snapshot, not a running history.
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
  experiment.
- Active lane: `scripts/flat/reconciliation/POC/` plus
  `agents/topics/apps/flat/reconciliation/`.
- Production destination: `shared/algorithm32/production/` after a numbered
  reconciliation record accepts the visibility/composition contract.
- Production handoff state: the production `flat32` star diagnostic showed
  that captured display-style scene RGB remains visible at San Jose solar noon
  after substantial brightness reduction. Tuning captured scene RGB is not the
  accepted fix.
- Starting-point design and proceed-plan docs now live in
  [milestone-5-boundary-radiance-design.md](milestone-5-boundary-radiance-design.md)
  and
  [milestone-5-boundary-radiance-plan.md](milestone-5-boundary-radiance-plan.md).
- Additional information: reconciliation runner and experiment scripts live
  under `scripts/flat/reconciliation/POC/src/runners/`, with browser execution
  support in `scripts/flat/reconciliation/POC/browser-page/runner.js` and
  `scripts/flat/reconciliation/POC/browser-jobs/browser-command.json`.
  Production implementation context is `shared/algorithm32/production/`, and
  the diagnostic app context is `src/flat32/index.js`.
- Experimental lane rules and script pointers are maintained in
  [experimental-guidelines.md](experimental-guidelines.md).

## Current Contract Intent

- Add an `ExternalBoundaryRadiance` role sampled along the camera ray.
- Compose visible outside-atmosphere radiance as
  `pathRadiance + viewTransmittance * celestialRadiance`.
- Treat visible stars, Moon, planets, and Sun disks as external boundary
  radiance, not as incident-radiance/L2 cache samples.
- Include a source-provided companion boundary-radiance provider for the
  visible Sun disk so the source owns one canonical set of source facts while
  exposing both illumination and camera-ray visibility roles.
- Keep optional Moon/starfield sky illumination through atmosphere
  source/cache support as a later concern.
- Keep decorative or fallback display backgrounds separate from physical
  celestial radiance.

## Artifact State

- The previous `tmp/atmosphere/reconciliation/` record set is preserved at
  `tmp/atmosphere/reconciliation_mark_i/`.
- Running chronology, if needed, belongs in
  `tmp/atmosphere/reconciliation/running-log.md`.
- New Milestone 5 records should be written under a fresh
  `tmp/atmosphere/reconciliation/NNN-*` root.
- The preserved Mark I artifact archive is evidence only; do not runtime-link
  active POC code to it.
- Old experimental documentation has moved to
  `agents/topics/apps/flat/reconciliation/archive/` with `mark-i-*` names.
  It is archive/provenance material, not part of the focused reload set.

## Open Items

- Define the source-owned visible-emitter descriptor for the Sun disk.
- Implement the boundary-radiance sampling/composition proof in the
  reconciliation POC.
- Prove that daytime stars are attenuated by the same path that allows bright
  bodies, such as the future Moon, to remain visible when their radiance and
  angular footprint justify it.
- Decide the first proof shape: CPU/reference-only, CPU postprocess, or
  browser/GPU comparison. The promotion target still needs CPU/GPU parity.
- Create the first fresh Milestone 5 numbered record under
  `tmp/atmosphere/reconciliation/NNN-*`.

## Verification

- No Milestone 5 artifact has been accepted yet.
- No tests were run for this documentation-only status refresh.
