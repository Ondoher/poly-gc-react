# Reconciliation Parameter Ledger Shape

Status: Milestone 1 baseline ledger populated for the pre-artifact
distant/spherical POC.

This file records the human-readable ledger shape and the current accepted
baseline groups. The executable ledger for M1 records is emitted by
`src/provenance/buildParameterLedger.js`.

Each retained value should be classified as one of:

- `external-source`
- `source-backed-derivation`
- `accepted-experiment-decision`
- `authored-model-config`
- `display-fixture`
- `unresolved`

Each row should record:

- id
- owner
- value or descriptor
- units or semantic kind
- provenance classification
- source or accepted-decision reference
- verification status
- notes

## Current Baseline Groups

| Group | Owner | Classification | Status | Notes |
| --- | --- | --- | --- | --- |
| Canonical atmosphere radii, scale heights, Rayleigh coefficient, aerosol coefficients, and no-ozone policy | atmosphere | accepted-experiment-decision / display-fixture | accepted | Sourced through Algorithm32 conclusions and retained Step 032 baseline notes. |
| 15-channel centered spectral basis and solar irradiance samples | spectralBasis / lightSource | source-backed-derivation / accepted-experiment-decision | accepted | Shared by atmosphere, light source, calculator, cache, and later artifact rendering. |
| Distant Sun angular radius and direction-only source semantics | lightSource | accepted-experiment-decision | accepted | The concrete distant source uses direction and source-path limit packets rather than evaluator branches. |
| Runtime, validation, and Step 032 artifact numerical controls | executionControls | accepted-experiment-decision | accepted | M1 pre-artifact runners use the Step 032 controls where artifact-parity setup is being exercised. |
| Figure 1 display/render constants | artifactDisplay / artifactRender | source-backed-derivation / accepted-experiment-decision | accepted for artifact use only | These remain outside CPU transport and are not used before Subgoal 1.5 artifact generation. |
