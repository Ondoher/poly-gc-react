# Unsourced And Partially Sourced Facts

This document is not a historical log. Keep only currently relevant open
facts for Milestone 5. Older ledgers live under [Archive](archive/README.md).

| Id | Area | Current fact | Status | Next action |
| --- | --- | --- | --- | --- |
| `m5-001` | Camera-ray composition | Visible outside-atmosphere bodies should compose as `pathRadiance + viewTransmittance * celestialRadiance`. | Active design target, not yet accepted by a Milestone 5 record. | Prove in CPU/reference or CPU-postprocess, then GPU/browser. |
| `m5-002` | Visible Sun disk | A light source should provide a companion boundary-radiance provider for its own visible disk while retaining canonical ownership of source facts. | Active design target. | Define the source-owned visible-emitter descriptor and first Sun disk hit/coverage policy. |
| `m5-003` | Stars/Moon/planets | Stars, Moon, planets, and Sun disks should use the same boundary-radiance composition point with different radiance and footprint policies. | Active design target. | Add proof samples for dim stars and at least one bright-body analog. |
| `m5-004` | Incident radiance / L2 | Visible stars and disks should not be folded into the incident-radiance/L2 cache. | Accepted intent for this lane, still needs proof coverage. | Keep optional Moon/starfield sky illumination as a later source/cache design. |
| `m5-005` | Backgrounds | Decorative or fallback backgrounds are not automatically physical celestial radiance. | Active separation rule. | Keep background cleanup separate from the boundary-radiance proof. |
| `m5-006` | Artifact reset | Previous reconciliation artifacts are preserved at `tmp/atmosphere/reconciliation_mark_i/`; new Milestone 5 records should use fresh `tmp/atmosphere/reconciliation/NNN-*` folders. | Documentation convention. | Create the first fresh record when proof work begins. |
