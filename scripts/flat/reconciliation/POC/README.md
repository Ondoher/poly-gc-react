# Algorithm32 Reconciliation POC

This README is not a historical log. It keeps the active POC script pointers,
lane rules, and record process for the current Milestone 5 reconciliation
experiment.

## Current Purpose

The active POC task is Milestone 5: prove the external-boundary-radiance
contract for visible outside-atmosphere bodies before promoting it into
production.

Target composition:

```text
pathRadiance + viewTransmittance * celestialRadiance
```

Current design and plan:

- `agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md`
- `agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-plan.md`

## Lane Rules

- Keep this POC self-owned.
- Historical POC and experiment code may be mined or ported with provenance,
  but this tree must not runtime-import, symlink, or re-export old experiment
  code where it currently lives.
- Keep complex shapes in the owning `types.d.ts` file and reference them from
  JavaScript with JSDoc.
- Runtime class files contain one class and default-export that class.
- Abstraction contracts live as ambient `interface` declarations plus
  validation. Do not add empty runtime base classes just to represent
  interfaces.
- Use regular interface method signatures for behavior members, not properties
  with function types. Plain value packets and descriptors can remain `type`
  aliases.
- Keep active status docs as current snapshots. Use
  `tmp/atmosphere/reconciliation/running-log.md` for lightweight chronology
  and `tmp/atmosphere/reconciliation/NNN-*` records for durable evidence.

## Runner And Experiment Scripts

- `src/runners/`: reconciliation runner and experiment scripts.
- `src/runners/recordWriter.js`: numbered-record helper.
- `browser-page/runner.js`: browser/WebGL runner.
- `browser-jobs/browser-command.json`: browser command channel seed.
- `src/index.js`: importable POC surface used by runners.
- `parameters.md`: current parameter snapshot.
- `CURRENT_STATE.md`: current POC status snapshot.

## Existing POC Surface

- `src/evaluation/SpectralReferenceEvaluator.js`
- `src/calculator/SpectralCalculator.js`
- `src/atmosphere/CanonicalAtmosphere.js`
- `src/geometry/SphericalEarthGeometry.js`
- `src/geometry/FlatEarthGeometry.js`
- `src/light/DistantSunLightSource.js`
- `src/light/LocalSunLightSource.js`
- `src/incident-radiance/DistantSunIncidentRadianceCache.js`
- `src/incident-radiance/LocalSunIncidentRadianceCache.js`
- `src/color/BrunetonColorDisplayModel.js`
- `src/soft-shader/CpuPostprocessSoftShader.js`
- `src/three/ThreeSceneSoftShaderBridge.js`
- `src/shader/Algorithm32ShaderAssembler.js`
- `src/browser/BrowserShaderJobRunner.js`

## Record Process

When substantive verification begins, create the next
`tmp/atmosphere/reconciliation/NNN-*` folder and include the normal record
files:

- `state-goal.md`
- `inputs.json`
- `command.json`
- `result.json`
- `provenance.json`
- `equations-and-constants.json`
- `criteria-results.json`
- `diagnostics.json` or `diagnostics/`
- `report.md`
- `run.log`

Rejected or superseded records stay in place. Create a new numbered record for
the next attempt.
