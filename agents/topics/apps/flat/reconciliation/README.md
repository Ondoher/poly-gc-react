# Reconciliation Lane

This document is not a historical log. Keep it limited to the active
reconciliation lane, current source pointers, and open Milestone 5 intent.
Older experimental notes live under [Archive](archive/README.md).

## Current Purpose

Reconciliation is reopened for Milestone 5: external boundary radiance for
visible outside-atmosphere bodies.

The current proof exists because the production `flat32` star diagnostic
showed that captured display-style star meshes can remain visible at San Jose
solar noon even after substantial brightness reduction. Tuning captured scene
RGB is not the accepted fix.

## Current Contract Intent

- Add an `ExternalBoundaryRadiance` role sampled along the camera ray.
- Compose visible outside-atmosphere radiance as
  `pathRadiance + viewTransmittance * celestialRadiance`.
- Use that same path for visible stars, Moon, planets, and Sun disks.
- Keep those visible bodies out of the incident-radiance/L2 cache.
- Let a light source provide a companion visible-disk boundary-radiance
  provider, starting with the Sun disk, while preserving one canonical set of
  source facts.
- Keep optional Moon/starfield atmosphere illumination as a later
  source/cache concern.
- Keep decorative or fallback backgrounds separate from physical celestial
  radiance.

## Minimal Bootstrap

After [Active Topic](../../../active-topic.md), load this README and only:

- [Status](status.md)
- [POC Current State](../../../../../scripts/flat/reconciliation/POC/CURRENT_STATE.md)

That is enough to resume here with minimal context.

Status and current-state docs are current snapshots, not running histories.
Use `tmp/atmosphere/reconciliation/running-log.md` for lightweight chronology
and numbered records under `tmp/atmosphere/reconciliation/NNN-*` for durable
evidence.

## Open When Needed

- Milestone 5 starting design:
  [milestone-5-boundary-radiance-design.md](milestone-5-boundary-radiance-design.md)
- Milestone 5 proceed plan, the primary plan for next work:
  [milestone-5-boundary-radiance-plan.md](milestone-5-boundary-radiance-plan.md)
- Current fact ledger:
  [unsourced-and-partially-sourced-facts.md](unsourced-and-partially-sourced-facts.md)
- Experimental lane rules:
  [experimental-guidelines.md](experimental-guidelines.md)
- Reconciliation POC runners:
  [scripts/flat/reconciliation/POC/src/runners](../../../../../scripts/flat/reconciliation/POC/src/runners)
- Reconciliation browser runner:
  [scripts/flat/reconciliation/POC/browser-page/runner.js](../../../../../scripts/flat/reconciliation/POC/browser-page/runner.js)
- Reconciliation browser command channel:
  [scripts/flat/reconciliation/POC/browser-jobs/browser-command.json](../../../../../scripts/flat/reconciliation/POC/browser-jobs/browser-command.json)
- Algorithm32 production implementation:
  [shared/algorithm32/production/README.md](../../../../../shared/algorithm32/production/README.md)
- flat32 diagnostic app context:
  [src/flat32/index.js](../../../../../src/flat32/index.js)
- Archive index: [archive/README.md](archive/README.md)

## Active Roots

- Documentation: `agents/topics/apps/flat/reconciliation/`
- POC implementation: `scripts/flat/reconciliation/POC/`
- Fresh Milestone 5 records: `tmp/atmosphere/reconciliation/NNN-*`
- Optional running log: `tmp/atmosphere/reconciliation/running-log.md`
- Preserved Mark I records: `tmp/atmosphere/reconciliation_mark_i/`
- Production destination after acceptance: `shared/algorithm32/production/`

## Archive Boundary

The previous long experimental notes have moved to
`agents/topics/apps/flat/reconciliation/archive/` with `mark-i-*` names. Load
them only when specific historical evidence is needed. They are not part of
the normal focused reload set.
