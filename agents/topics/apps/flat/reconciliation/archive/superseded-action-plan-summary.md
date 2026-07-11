# Reconciliation Action Plan

This archived summary is superseded by the active Milestone 5 plan. Older
milestone plans live in this archive.
The primary proceed plan for the next work is
[Milestone 5 Boundary Radiance Plan](../milestone-5-boundary-radiance-plan.md).

## Milestone 5: External Boundary Radiance

Status: active focused experiment.

Goal: prove the visible outside-atmosphere composition contract before
promoting it into production.

## Primary Work

- Define an `ExternalBoundaryRadiance` role that answers what radiance arrives
  from beyond the atmosphere along the current camera ray.
- Compose that radiance as
  `pathRadiance + viewTransmittance * celestialRadiance`.
- Keep the role separate from atmosphere illumination and separate from
  incident-radiance/L2 cache sampling.
- Add a source-provided companion boundary-radiance provider for the visible
  Sun disk. The provider should read source-owned facts instead of duplicating
  position, direction, spectrum/radiance, angular size, calibration, or
  path-limit semantics.
- Demonstrate that stars, Moon, planets, and Sun disks can use the same
  camera-ray composition point with different radiance and footprint policies.
- Keep decorative/fallback backgrounds out of the physical boundary-radiance
  contract.

## Acceptance Evidence

- CPU/reference or CPU-postprocess proof for the composition formula and
  source-owned Sun disk provider.
- GPU/browser proof through the existing shader/composer architecture.
- Daytime star check: dim synthetic star radiance is buried by bright daytime
  sky path radiance without globally dimming all outside-atmosphere content.
- Bright-body check: a high-radiance body, such as the Sun disk and later Moon
  analog, remains visible through the same path when calibrated radiance and
  angular footprint justify it.
- A fresh numbered record under `tmp/atmosphere/reconciliation/NNN-*` names
  the accepted source/layer/composition contract and any rejected alternatives.

## Artifact Rule

The previous `tmp/atmosphere/reconciliation/` artifact set is preserved at
`tmp/atmosphere/reconciliation_mark_i/`. New Milestone 5 records should use
a fresh `tmp/atmosphere/reconciliation/NNN-*` root.
