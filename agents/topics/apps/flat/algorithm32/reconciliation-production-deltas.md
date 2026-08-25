# Reconciliation To Production Deltas

Status: ER0 through ER8 remain accepted CPU evidence. The user rolled back the
record-067 promotion, so no promoted celestial implementation currently
exists. The selected delta is a camera-independent, ray-queryable cache of
already atmosphere-transported celestial contributions.

The applicable external research, retained source identities, evidence claim
boundaries, and promotion routing have been mined into the local
[CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md).
Reconciliation remains the immutable audit source, not the routine cache
handoff.

This document owns the current gap between accepted reconciliation behavior
and production. Chronology and exact evidence remain in the reconciliation log
and immutable numbered records.

## Production Shape Constraint

Retain `Algorithm32`, `Reference`, `SpectralCalculator`, `ShaderBuilder`,
`ShaderRuntimePass`, configured source/atmosphere/geometry/spectral owners,
incident-radiance caches, scene capture, and Color. The new cache extends this
shape without a runtime dependency on reconciliation code or records.

## Accepted Reconciliation Input

- Record `033`: typed point irradiance and extended radiance.
- Record `034`: normalized point response, exact pixel solid angle,
  conservation, and off-raster accounting.
- Record `040`: conservative extended angular integration.
- Records `049` and `050`: bounded Moon/Sun/Sirius references and exact
  source-to-pixel transport.
- Records `054` and `056`: exact acquisition and eight-case real-scene CPU
  validation.
- Record `059`: pre-display physical claim only.
- Record `065`: CPU convergence and POC cleanup.

Record `067` describes a rolled-back, unit-boundary-nonconforming attempt and
cannot accept this successor.

## Selected Next Delta

[CelestialContributionCache Design](celestial-contribution-cache-design.md)
owns the selected contract and requirements ledger.
[CelestialContributionCache Implementation Plan](celestial-contribution-cache-plan.md)
owns their closure order. This tracker owns only the current production gap
inventory and closure state:

| Area | Current production gap | Required closure |
| --- | --- | --- |
| Canonical celestial sources | No optional provider supplies physical visible Sun/Moon/star point or extended measures to production. | Select the smallest configured provider seam; keep visible Sun facts derived from the canonical Sun owner and keep source facts out of shader policy/setup payloads. |
| Field qualification | No accepted coordinate reduction, interpolation error bound, resource layout, or performance budget exists. | Qualify distant/spherical and local/flat candidates before freezing an implementation layout. |
| Cache builder/artifact | No `CelestialContributionCache`, descriptor, payload, deterministic key, or production builder exists. | Add the derived immutable artifact without reconciliation runtime imports or duplicate canonical facts. |
| Resource lifecycle | `ShaderBuilder` supports incident-cache resources only. | Add a separate celestial build/resource namespace, validation, atomic replacement, context restoration, and disposal. |
| Shader state/order | Runtime has `pathRadiance`, `transmittance`, and scene display state only. | Add zero-initialized `celestialRadiance` after base transport and before Color. |
| Live extended query | No footprint integration or celestial depth/opacity path exists. | Implement the qualified cache query, partial support, foreground depth, and selected celestial ordering policy. |
| Live point query | No exact-source projection/visibility, normalized response, or pixel-solid-angle conversion exists. | Select and prove the response/frame preparation and exact-source occlusion path without making response policy a transported-field dependency. |
| Validation | No production fixtures, cache parity, GPU query parity, or browser proof exists. | Promote durable oracle fixtures and satisfy `CCC-R01` through `CCC-R15` in a fresh proof. |
| Reference/evidence promotion | Cache-applicable research and record claim boundaries are localized in the dossier, but selected rows are not yet canonical production references, evidence, or fixtures. | After Gate A and Contract Gate B, execute E0/E1: promote only the selected external rows, first-party claims, and fixture bytes into production homes with hashes and claim limits preserved. |

## Not Yet Implemented

Production has no contribution-field builder, descriptor, payload, binding,
query contribution, `celestialRadiance` state, or parity proof. Documentation
is not acceptance.

## Exit Criteria

1. Every gap in the table has a production owner and passing focused tests.
2. The cache design's qualification gate passes for each claimed family.
3. `CCC-R01` through `CCC-R15` are satisfied without runtime POC imports.
4. Every shipped external fact has a numbered production reference and every
   accepted experimental claim has named production evidence; no runtime or
   production fixture needs the dossier or reconciliation path to interpret
   it.
5. Optional disabled behavior preserves current output; configured invalid
   behavior fails at the required lifecycle boundary.
6. A fresh record runs current production tests and applicable
   visible-celestial GPU/browser parity. Record 067 is not reused.
