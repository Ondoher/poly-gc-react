# Active Topic

Current active topic: `flat/reconciliation`

Parent app/topic: `flat`

## Current Focus

This file is not a historical log. Keep it limited to the current active
lane, current open items, and the smallest focused reload set needed for the
next agent.

Official active lane: Algorithm32 visibility work has moved back to the
reconciliation experimental lane.

Immediate goal: Milestone 5, external boundary radiance and source-provided
visible disks.

Topic README: [Reconciliation Lane](apps/flat/reconciliation/README.md)

## Fresh Agent Route

For a compacted or resumed agent, restart here before continuing work.

1. Load this file from `AGENTS.md`.
2. Load [Reconciliation Lane](apps/flat/reconciliation/README.md).
3. Load only the two files under `Minimal Reload Sources`.
4. Do not load archive, production, app, runner, or old experiment files unless
   the current task asks for them or the focused docs say they are needed.
5. Announce `flat/reconciliation`, Milestone 5 external boundary radiance.

## Current Intent

- Prototype an `ExternalBoundaryRadiance` path sampled along the camera ray.
- Compose visible outside-atmosphere radiance as
  `pathRadiance + viewTransmittance * celestialRadiance`.
- Include a source-provided companion boundary-radiance object. The
  Sun/light source remains the canonical owner of source facts while exposing
  both atmosphere illumination and visible Sun disk roles.
- Keep visible stars, Moon, planets, and Sun disks out of the
  incident-radiance/L2 cache. Optional sky illumination from Moon or starfield
  radiance is a later source/cache concern.
- Keep decorative or fallback display backgrounds separate from physical
  celestial boundary radiance.
- Preserve the production `flat32` diagnostic conclusion: captured
  display-style star meshes still survive San Jose solar noon after
  substantial brightness reduction, so tuning captured scene RGB is not the
  accepted fix.
- Keep multi-source atmosphere illumination as a future idea for
  Tatooine-style worlds through a later `LightSourceSet` /
  `AtmosphereIlluminationSet`; visible disks would still use the external
  boundary-radiance path.

## Artifact Note

- The previous `tmp/atmosphere/reconciliation/` artifact set is preserved at
  `tmp/atmosphere/reconciliation_mark_i/`.
- New Milestone 5 proof work should write fresh numbered records under a new
  `tmp/atmosphere/reconciliation/NNN-*` root.
- Do not link runtime POC code to the preserved Mark I artifact archive.
- Old experimental documentation has moved to
  `agents/topics/apps/flat/reconciliation/archive/` with `mark-i-*` names.
  Load it only for specific historical evidence or provenance.

## Minimal Reload Sources

- [Reconciliation Status](apps/flat/reconciliation/status.md)
- [Reconciliation POC Current State](../../scripts/flat/reconciliation/POC/CURRENT_STATE.md)

## Open When Needed

- [Milestone 5 Boundary Radiance Design](apps/flat/reconciliation/milestone-5-boundary-radiance-design.md)
- [Milestone 5 Boundary Radiance Plan](apps/flat/reconciliation/milestone-5-boundary-radiance-plan.md)
- [Reconciliation Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md)
- [Reconciliation Experimental Guidelines](apps/flat/reconciliation/experimental-guidelines.md)
- [Reconciliation POC Runners](../../scripts/flat/reconciliation/POC/src/runners)
- [Reconciliation Browser Runner](../../scripts/flat/reconciliation/POC/browser-page/runner.js)
- [Reconciliation Browser Command](../../scripts/flat/reconciliation/POC/browser-jobs/browser-command.json)
- [Algorithm32 Production Status](apps/flat/algorithm32/status.md)
- [Algorithm32 Production Implementation](../../shared/algorithm32/production/README.md)
- [flat32 Diagnostic App](../../src/flat32/index.js)
- [Reconciliation Archive](apps/flat/reconciliation/archive/README.md)

## Active Rules

- Current proof work belongs in `scripts/flat/reconciliation/POC/` and
  `agents/topics/apps/flat/reconciliation/`. Production remains the promotion
  destination after a numbered reconciliation record accepts the contract.
- Treat [Archived Reconciliation Conclusions](apps/flat/reconciliation/archive/conclusions.md)
  as historical background, not the active status log.
- Use [Reconciliation To Production Deltas](apps/flat/algorithm32/reconciliation-production-deltas.md)
  only when a production promotion/API conflict needs resolution.
- Keep unresolved source/provenance work tracked through
  [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md).
- Keep status/current-state docs as current snapshots. Use
  `tmp/atmosphere/reconciliation/running-log.md` for lightweight chronology
  and `tmp/atmosphere/reconciliation/NNN-*` records for durable evidence.
- Do not runtime-link production code to reconciliation POC or experiment
  code. Promote accepted behavior and contracts into
  `shared/algorithm32/production/`.
