# Algorithm32 Reconciliation POC

This README owns implementation routing for the active reconciliation POC. It
does not own project status or attempt history.

## Current Purpose

The observer-independent Phase 6 CPU source-model reset is complete. The
selected ER9 production promotion was executed in record
`067-er9-production-promotion-proof`, which reports 23/23 criteria, 268/268
production Jasmine specs, and 2/2 application syntax checks. A later audit
found that its durable unit-suffixed scalar properties violate the governing
production unit-packet rule, so production conformance remains open. Record
066 remains an
immutable invalid infrastructure attempt that stopped before production tests
began.

Production now owns the selected typed source/spectral-basis packets, CPU
raster/visibility/point/extended/frame seam, and one canonical Sun packet
shared by distant-Sun CPU illumination, descriptor/shader binding, and the
visible uniform disk. The POC remains an evidence and experimental lane;
production has no runtime dependency on it or on reconciliation records. The
promoted implementation is unit-contract-nonconforming and is not an
unqualified accepted production boundary.
Assembled visible-celestial GPU/browser rendering was not selected, and XA-G12
is not applicable to that unselected slice. The canonical checkpoint is the
[topic status](../../../../agents/topics/apps/flat/reconciliation/status.md),
and checked phase progress is in the
[reset plan](../../../../agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md).

Post-reset record `068-post-reset-eight-subjective-scene-renders` uses the
accepted ER6 CPU renderer without the browser watcher. It retains eight
512x384 review PNGs plus one montage, accepts its mechanical capture boundary
8/8, and leaves human review and observational visibility unclaimed.

Record 069 retains the invalid high-resolution full-diagnostic attempt. Record
070 accepts the explicit `compact-review` renderer output, 8/8, at 384x288
native physical resolution with 768x576 review PNGs. Compact-review evaluates
the same source, geometry, visibility, atmosphere, transport, composition, and
display path while returning display pixels instead of the prohibitively large
per-pixel spectral evidence tree.

Record 071 adds an explicit controlled-presentation adapter to compact-review
output. It preserves the physical Moon and CALSPEC Sirius packets but labels
their camera directions nonastronomical, and returns exact Moon-free and
Sirius-free display counterfactuals. The paired noon/night runner uses one
scene-wide upper-sky exposure per complete scene, never a body-specific gain.
Its 10/10 automated result shows the Moon and no Sirius residual by day, and
both by night; it makes no real-world visibility or physical-geometry claim.

## Architecture Boundaries

- Keep the POC self-owned under `scripts/flat/reconciliation/POC/`. Do not
  runtime-import, symlink, or re-export Flat32, production, archive, or external
  experiment code.
- Treat Algorithm32 atmosphere transport and composition as frozen inputs.
- Preserve continuous directional composition in the canonical 15-channel
  spectral-density basis:

  ```text
  pathRadiance + viewTransmittance * boundaryRadiance
  ```

- Extended sources own directional spectral radiance and use conservative
  angular integration at physical source directions.
- Point sources own spectral irradiance, use exact-source visibility and
  transmittance, and enter a separate normalized frame-aware point response.
- Keep source magnitude separate from geometry, coverage, opacity, response,
  atmosphere, and display. Do not restore fixed solid-angle divisors, authored
  physical star disks, source-only exposure, generic scalar coverage/opacity
  brightness, compatibility aliases, or legacy fallbacks.
- Keep visible celestial sources out of the incident-radiance/L2 cache.
  Optional atmosphere illumination by them is a separate concern.
- Retain one canonical owner for every physical source fact. In particular,
  reference solar models must not become shadow runtime owners beside the
  canonical Sun packet.
- Apply one global color/display transform only after full physical spectral
  composition. Do not use source-specific visibility tuning.
- Production owns only the accepted copied/adapted typed and CPU seam plus the
  canonical Sun migration. Do not introduce a runtime dependency in either
  direction between production and this POC.
- Keep assembled visible-celestial GPU/browser raster and composition outside
  the accepted promotion boundary. Existing GPU atmosphere evaluation remains
  independent and must not consume CPU atmosphere answers.

## Active Module Routing

- `src/runners/er9ProductionPromotionProof.js`: sealed record-067 production
  promotion proof; do not execute it again.
- `src/runners/er5LunarPhaseCalibration.js`: sealed record-048 runner and
  lunar calibration criteria; do not rerun it.
- `src/runners/er5LunarPhysicalReferenceCalibration.js`: sealed record-049
  physical-reference runner; do not execute it again.
- `src/runners/recordWriter.js`: fresh-record validation and artifact writing.
- `src/external-celestial-sources/LimeCalibrationFixtureReader.js`: verified
  NetCDF-4/HDF5 and release-entry reader.
- `src/external-celestial-sources/LimeCoefficientModel.js`: coefficient,
  covariance, spectral-interpolation, canonical-binning, distance, and
  ambiguity evaluation.
- `src/external-celestial-sources/LimeSpectralUncertaintyPropagator.js`:
  correlated coefficient/ASD and model-form propagation into canonical
  reflectance and exact solar-weighted lunar irradiance.
- `src/external-celestial-sources/AirLusiCalibrationFixtureReader.js` and
  `Rolo311gReferenceModel.js`: independent measured and qualified model
  references for the record-049 XA-G09 gate.
- `src/external-celestial-sources/`: typed spectral packets, canonical basis,
  CALSPEC Sirius, canonical Sun wrapper, source readers, binning, fixture
  manifest, and pinned physical fixtures.
- `src/external-celestial-sources/fixtures/README.md`: fixture identities,
  versions, hashes, and provenance.
- `src/camera/`: exact perspective raster and pixel solid-angle facts.
- `src/point-source-raster/`: normalized point response and point-source
  rasterization.
- `src/extended-source-integration/`: conservative disk/body quadrature and
  extended-source integration.
- `src/directional-visibility/`: exact direction/depth visibility resolution.
- `src/physical-frame/`: accepted frozen-atmosphere frame evaluation and
  physical spectral-frame composition.
- `src/atmosphere/`: frozen CPU atmosphere evaluator. Existing soft-shader
  composition is not the reset full-frame contract; ER4C owns its replacement.
- `src/globe-moon/` and `src/moon-phase/`: globe-Moon state and phase mechanics
  available to the physical Moon source model.
- `src/index.js`: importable POC surface. Add accepted public modules here only
  when the active contract requires them.
- `browser-page/`, `src/browser/`, `src/shader/`, and `src/three/`: retained
  historical browser/GPU integration surfaces; assembled visible-celestial
  GPU/browser promotion remains unselected.

ER8 removed the coverage-resolved v1 boundary/candidate renderer islands and
their reset-invalid calibration and display paths. Do not restore them as a
compatibility path.

## Useful Commands

From the repository root, syntax-check the sealed proof runner with:

```powershell
node --check scripts/flat/reconciliation/POC/src/runners/er9ProductionPromotionProof.js
```

Do not execute any sealed numbered-record runner, including records 048, 049,
and 067. Any later substantive attempt must use a new runner and the next fresh
record number after its scope and criteria are complete.

Use `npm run build` for the repository build smoke check and `git diff --check`
for whitespace validation. Assume the normal watcher/server is already
running; do not start duplicates.

## Evidence And Log Ownership

- [Topic status](../../../../agents/topics/apps/flat/reconciliation/status.md)
  owns the present-state snapshot.
- [Reset plan](../../../../agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md)
  owns checked progress and phase order.
- `tmp/atmosphere/reconciliation/running-log.md` owns lightweight chronology.
- `tmp/atmosphere/reconciliation/NNN-*` owns detailed evidence.
- This README owns POC implementation routing only.

Every substantive attempt uses the next unused direct child of
`tmp/atmosphere/reconciliation/`. Numbered records are immutable, including
rejected, invalid, crashed, or superseded attempts. Never rerun into or edit an
existing record. Use `recordWriter.js` to fail if a target already exists and
follow the current record schema defined by the reset plan and experimental
guidelines.

Keep complex owned shapes in the relevant `types.d.ts` file and reference them
from JavaScript with JSDoc. Runtime class files contain one class and
default-export it; ambient interfaces represent contracts without empty
runtime base classes.
