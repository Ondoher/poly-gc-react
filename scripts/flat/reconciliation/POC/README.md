# Algorithm32 Reconciliation POC

Status: Milestone 1 complete through Subgoal 1.4; stopped before Subgoal 1.5
artifact generation.

This is the mutable reconciliation POC for Algorithm32. It is not a numbered
experiment lane; the source here will be updated in place. Numbered records
under `tmp/atmosphere/reconciliation/NNN-*` begin once substantive verification
or parity evidence starts.

## Scope

- Keep this POC self-owned. Historical POC and experiment code may be mined or
  ported with provenance, but this tree must not runtime-import, symlink, or
  re-export old experiment code where it currently lives.
- Keep complex shapes in the owning `types.d.ts` file and reference them from
  JavaScript with JSDoc.
- Keep a compact code reference trail. Implementation files should use a
  file-level `References:` comment for the relevant design section, action-plan
  stage, numbered record, source audit, or external source. The chosen scheme
  is a resolvable inline trail, not `[n]` citations against a separate index.
  Detailed trails still belong in records/provenance.
- Runtime class files contain one class and default-export that class.
- Abstraction contracts live as ambient `interface` declarations plus
  validation; do not add empty runtime base classes just to represent
  interfaces. Use regular interface method signatures for behavior members,
  not properties with function types. Plain value packets and descriptors can
  remain `type` aliases.

## Current Scaffold

- `src/index.js` exposes the importable scaffold surface.
- `src/types.d.ts` owns shared value packets.
- Module-local `types.d.ts` files own boundary-specific packets.
- `src/evaluation/SpectralReferenceEvaluator.js` owns the spectral-only main
  evaluator over abstract contracts.
- `src/calculator/SpectralCalculator.js` owns the shared calculator loop and
  low-level transport helpers.
- `src/atmosphere/CanonicalAtmosphere.js`,
  `src/geometry/SphericalEarthGeometry.js`, and
  `src/light/DistantSunLightSource.js` are the concrete M1 model classes.
- `src/incident-radiance/DistantSunIncidentRadianceCache.js` is the concrete
  distant L2 cache.
- `src/provenance/buildParameterLedger.js` emits the M1 parameter ledger.
- `src/outputs/types.d.ts` and `src/comparison/types.d.ts` own
  post-transport output/comparison packet homes.
- `src/setup/buildIncidentRadianceCache.js` owns the cache-build coordinator
  shell.
- `src/runners/smoke.js` is the lightweight M0 verification runner.
- `src/runners/contractProbe.js` is the M1 Subgoal 1.0 abstraction-closure
  verification runner.
- `src/runners/m1ParameterProvenance.js`,
  `src/runners/m1TransportHelperInvariants.js`,
  `src/runners/m1ConcreteDistantSpherical.js`, and
  `src/runners/m1DistantL2Cache.js` are the accepted M1 pre-artifact
  experiment runners.

## Record Process

Milestone 0 does not require a formal numbered record. When substantive
verification begins, create the next `tmp/atmosphere/reconciliation/NNN-*`
folder and include the normal record files: `state-goal.md`, `inputs.json`,
`command.json`, `result.json`, `provenance.json`,
`equations-and-constants.json`, `criteria-results.json`, `diagnostics.json` or
`diagnostics/`, `report.md`, and `run.log`.
