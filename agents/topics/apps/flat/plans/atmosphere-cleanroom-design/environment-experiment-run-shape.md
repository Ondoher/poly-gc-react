# Environment Experiment Run Shape

This document proposes how the cleanroom environment-object experiments should
run, what their inputs and outputs should be, and how the 3D environment should
be modeled.

It supports:

- [Environment Object Color Prompt](environment-object-color-prompt.md)
- [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)
- [Object Transport Experiment Plan](object-transport-experiment-plan.md)
- [Objective Success Criteria](objective-success-criteria.md)

## Run Sequence

Use numbered artifact folders under:

```text
tmp/atmosphere/cleanroom_environment/
```

This lane is self-guided and iterative. After implementation starts, a later
agent must be able to resume from this document, the prompt, the active-topic
reload list, the script folder, and the latest numbered artifact. Continue
iterations until a stated goal is reached, a dead end is documented, or the
user interrupts.

Recommended first sequence:

1. `001-transfer-baseline`
   - Purpose: prove finite object transfer with caller-provided spectral object
     radiance.
   - Source model: distant directional Sun from experiment 032.
   - Geometry model: spherical Earth atmosphere from experiment 032.
   - Surface lighting: none; object radiance is an input.
2. `002-transfer-convergence`
   - Purpose: repeat the same scene with higher numerical sample counts and
     report convergence deltas for the objective criteria.
   - Changes: double selected view, Sun-transmittance, second-order direction,
     and altitude-cache counts: `40`, `20`, `34`, and `48`.
3. `003-lambertian-surface-lighting`
   - Purpose: add a separately reported Lambertian surface-lighting path.
   - Changes: compute object radiance from reflectance, Sun irradiance,
     incidence, and object-to-Sun transmittance.
4. `004-local-sun-follow-up`
   - Purpose: test non-parallel source rays and inverse-square receiver
     irradiance falloff.
   - Changes: replace the distant directional Sun with a finite source
     position.
5. `005-flat-long-sightline-follow-up`
   - Purpose: test a flat-Earth long-line-of-sight geometry.
   - Changes: replace spherical atmosphere geometry with a labeled
     plane-parallel or flat-slab geometry.
6. `scene-gallery`
   - Purpose: generate visible scene previews for every completed phase from
     accepted spectral artifacts.
   - Changes: no physics inputs change; this is a display-only artifact that
     reads accepted transfer data and writes per-phase scene PNGs plus a
     combined gallery.

Only `001-transfer-baseline` is required for the first implementation pass.
The other entries are follow-up experiments.

Actual transfer-proof outcome:

- `003-transfer-baseline` is the accepted original-control baseline after a
  segment-composition diagnostic fix.
- `004-transfer-convergence` rejected the original `20/10/17/24` numerical
  baseline for the selected `5x` convergence-margin gate.
- `005-transfer-refined-baseline` is the accepted refined baseline using
  `40/20/34/48`.
- `006-transfer-refined-convergence` is the accepted convergence proof using
  `80/40/68/96` against `005`; it passed all `15` criteria with `0` failures
  and `0` unresolved checks.
- `011-lambertian-surface-lighting` is the accepted surface-lighting proof;
  it passed `8` criteria with `0` failures and `0` unresolved checks.
- `012-local-sun-follow-up` is the accepted finite-source proof; it passed `8`
  criteria with `0` failures and `0` unresolved checks.
- `013-flat-long-sightline-follow-up` is the accepted flat-slab long-path
  proof; it passed `9` criteria with `0` failures and `0` unresolved checks.
- `014-scene-gallery` through `017-scene-gallery` are accepted but superseded
  scene-display iterations.
- `018-scene-gallery` is an accepted neutral-object perspective scene
  iteration, superseded by `019`.
- `019-scene-gallery` is an accepted source-colored perspective scene
  iteration, superseded by the multicolor scene-display request.
- `020-scene-gallery` is an accepted multicolor scene-output proof, superseded
  by `021` because the first multicolor layout read more like adjacent front
  cards than separated object sets.
- `021-scene-gallery` is the accepted all-phases multicolor scene-output
  proof; it read accepted artifacts `006`, `011`, `012`, and `013`, selected
  `282` recorded spectral cases, sampled `1280` sky blocks and `2400`
  ground-atmosphere blocks through the cleanroom spectral kernels, rendered
  red, blue, and green recorded object-spectrum stacks in each scene/source
  view, generated one perspective scene preview per phase plus
  `scene-gallery.png`, and passed `7` criteria with `0` failures and `0`
  unresolved checks.
- `022-transfer-refined-baseline` through `027-scene-gallery` reran the
  source artifacts and scene gallery after replacing the algorithmic synthetic
  green spectrum with a 532 nm display-green stress input. `023`, `024`,
  `025`, and `026` are accepted source artifacts with `0` failures and `0`
  unresolved criteria, superseded by the foreground-olive branch. `027`
  reads `023` through `026`, renders red, blue, and visibly green recorded
  object-spectrum stacks in each scene/source view, and passed `7` criteria
  with `0` failures and `0` unresolved checks.
- `028-transfer-refined-baseline` through `033-scene-gallery` reran the source
  artifacts and scene gallery after replacing the 532 nm display-green stress
  input with a user-directed foreground-olive green target. `029`, `030`,
  `031`, and `032` are accepted source artifacts with `0` failures and `0`
  unresolved criteria, superseded by the lower-right forest-green branch.
  `033` reads `029` through `032`, renders red, blue, and muted
  foreground-olive green recorded object-spectrum stacks in each scene/source
  view, and passed `7` criteria with `0` failures and `0` unresolved checks.
- `034-transfer-refined-baseline` through `039-scene-gallery` reran the source
  artifacts and scene gallery after replacing the foreground-olive target with
  a user-directed lower-right forest-green target. `035`, `036`, `037`, and
  `038` are accepted current source artifacts with `0` failures and `0`
  unresolved criteria. `039` reads `035` through `038`, renders red, blue, and
  dark forest-green recorded object-spectrum stacks in each scene/source view,
  and passed `7` criteria with `0` failures and `0` unresolved checks.
- `040-scene-gallery` reran only the scene gallery after changing the
  algorithmic preview sky/ground sample block size from `24 px` to `8 px`.
  `040` is the current scene artifact; it reads `035` through `038`, samples
  `11040` sky blocks and `21600` ground-atmosphere blocks, keeps the
  lower-right forest-green object spectra, and passed `7` criteria with `0`
  failures and `0` unresolved checks.
- The earlier `007` artifact is a retained partial crash artifact, and
  `008` through `010` are accepted but superseded by the clean report reruns
  `011` through `013`.

Run labels, exact folder names after `001`, sample-count multipliers, target
counts, and image sizes are algorithmic decisions unless replaced by sourced
requirements.

The CLI should follow the cleanroom script's `--step=<step-id>` pattern. The
recommended first command is:

```text
node scripts/flat/atmosphere-environment/run.js --step=transfer-baseline
```

See [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md#cli-requirements).

If `--step` is omitted before any numbered artifacts exist, the CLI should run
`transfer-baseline`. After that, omission should follow the next recommended
step recorded by the latest artifact's `state-goal.md` or the root
`running-log.md`. This defaulting behavior is an algorithmic workflow choice,
not a physics source.

## Continuation State

Every artifact should include enough state for restart:

```text
state-goal.md
inputs.json
provenance.json
equations-and-constants.json
transfer-cases.json
criteria-results.json
report.md
run.log
script-snapshot.js or script-snapshot/
```

The output root must also contain the canonical append-only running log:

```text
running-log.md
```

`state-goal.md` should state:

- the goal for the numbered artifact;
- what would count as success;
- what was attempted;
- accepted/rejected/superseded status;
- next numbered artifact to run if the goal is not reached.

The `report.md` can include the same information, but `state-goal.md` gives a
small restart target for context compaction and bootstrap.

Stop conditions:

- the current state goal is reached and documented;
- the lane hits a dead end that cannot be resolved without user input or an
  external-state change;
- the user interrupts, pauses, or redirects the work.

Do not stop merely because one artifact fails if the next diagnostic step is
clear.

## Baseline Inputs

Each run should write its resolved inputs to `inputs.json`.

Suggested schema:

```js
{
  schemaVersion,
  runId,
  stateGoal,
  scriptVersion,
  sourceBoundary,
  atmosphereProfileId,
  geometryProfile,
  sourceProfile,
  spectralGrid,
  numericalControls,
  camera,
  sunCases,
  environmentTargets,
  objectSpectra,
  outputProducts,
  algorithmicStressDecisions,
  references
}
```

### Atmosphere Profile

For `001-transfer-baseline`, use the experiment 032 profile:

- no ozone;
- no ground coupling;
- no direct solar-disc camera term;
- Bruneton 2016 aerosol constants;
- 15 centered wavelength samples from `360 nm` to `830 nm`;
- full-sphere Fibonacci second-order path radiance;
- spectral endpoint before display conversion.

References:

- [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)
- [Experiment 032 Algorithm](experiment-032-algorithm.md)
- [Bruneton 2017 atmospheric functions](https://raw.githubusercontent.com/ebruneton/precomputed_atmospheric_scattering/master/atmosphere/functions.glsl)
- [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336)

### Geometry Profile

For `001-transfer-baseline`:

```js
{
  id: "spherical-earth-ground-observer",
  coordinateFrame: "local-tangent-east-north-up",
  bottomRadiusMeters,
  topRadiusMeters,
  observerHeightMeters
}
```

The coordinate frame is algorithmic: local tangent ENU keeps target placement
and view directions easy to inspect. Conversion to the spherical radius vector
uses the same spherical atmosphere constants as experiment 032.

### Source Profile

For `001-transfer-baseline`:

```js
{
  id: "bruneton-figure1-directional-sun",
  type: "directional",
  sunCases: [
    "figure1-06h00-z87",
    "figure1-13h15-z21"
  ]
}
```

The two required Sun cases are the sunrise/sunset row and the highest-Sun row
from Bruneton's four-skydome Figure 1 layout. Any red-cross-derived azimuths
are algorithmic measurements from extracted external Figure 1 tiles.

### Camera

Use one camera origin at observer height and a deterministic forward direction
for the baseline:

```js
{
  id: "ground-camera",
  originMetersENU: [0, 0, 2],
  forwardMetersENU: [1, 0, 0],
  upMetersENU: [0, 0, 1]
}
```

This camera is an algorithmic test harness, not a claim about a real camera.
The first proof should sample explicit object-center rays rather than depend
on a raster camera model.

### Environment Targets

Model the baseline environment as rows of small target cards centered at known
distances in front of the camera:

```js
{
  id,
  shape: "spectral-card",
  centerMetersENU,
  normalMetersENU,
  widthMeters,
  heightMeters,
  distanceMeters,
  objectSpectrumId
}
```

For `001-transfer-baseline`, cards do not need to be physically shaded. They
are finite object endpoints with caller-provided spectral radiance. Width,
height, row spacing, and visual layout are algorithmic because the pass/fail
checks use center rays and spectral packets, not object silhouettes.

Recommended baseline arrangement:

- two Sun cases;
- seven object distances;
- six object spectra;
- one repeated block per Sun case and object spectrum;
- one row per object distance inside each block;
- each card center lies on the camera forward axis at the recorded distance.

The environment can optionally include a simple preview image, but the preview
is derived from the transfer data.

The baseline should therefore produce `84` primary transfer cases before
diagnostic split-segment packets.

### Object Spectra

For `001-transfer-baseline`, use synthetic spectra:

- black;
- neutral constant;
- high neutral constant for dynamic-range stress;
- red-biased;
- green-biased;
- blue-biased.

These are algorithmic test inputs. A later validation pass can replace or add
sourced measured material reflectance/radiance spectra.

Use the first formulas from
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md).

## 3D Environment Model

The baseline 3D environment is a minimal ray-test scene, not a full renderer.

It should contain:

- a camera point;
- a local ENU coordinate frame;
- a spherical atmosphere profile;
- a distant Sun direction per Sun case;
- target cards with known 3D centers and normals;
- one center ray from the camera to each target card;
- optional edge/corner rays only for visual previews or later spatial checks.

This is enough to prove finite object transfer because the atmosphere solver
only needs the camera-to-target segment, the Sun/source state, and the
spectral object radiance. Full mesh rasterization, occlusion, shadows, BRDFs,
textures, and perspective camera sampling should wait until after the transfer
baseline succeeds.

References:

- Bruneton's demo composes finite object/ground radiance with
  `GetSkyRadianceToPoint` transmittance and in-scatter:
  [Bruneton 2017 demo shader](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl).
- PBRT separates geometric scenes, cameras, lights, spectra, and light
  transport; that supports keeping the first experiment as explicit scene
  data plus sampled rays rather than as hidden image-only rendering:
  [PBRT 4e, Point Lights](https://pbr-book.org/4ed/Light_Sources/Point_Lights).

## Baseline Processing

For each Sun case, object spectrum, and target distance:

1. Resolve the target center point.
2. Build the camera-to-target segment.
3. Compute `T_view(lambda)` over that finite segment.
4. Compute `L_path(lambda)` over that finite segment using the experiment 032
   density, transmittance, phase, and path-radiance kernels.
5. Compose:

   ```text
   attenuatedObject(lambda) = T_view(lambda) * L_object(lambda)
   final(lambda) = attenuatedObject(lambda) + L_path(lambda)
   ```

6. Record all spectral arrays before display conversion.
7. Generate display previews only from recorded spectral arrays.
8. Run the objective criteria from
   [Objective Success Criteria](objective-success-criteria.md).

## Baseline Outputs

Each artifact folder should contain:

```text
state-goal.md
inputs.json
provenance.json
equations-and-constants.json
transfer-cases.json
criteria-results.json
report.md
contact-sheet.png
run.log
script-snapshot.js or script-snapshot/
```

The output root should contain:

```text
running-log.md
```

Optional but useful:

```text
scene-preview.png
spectral-plots/
tables/
contact-sheet-autoexposure.png
```

Final scene-output artifact:

```text
scene-data.json
scene-preview-transfer.png
scene-preview-lambertian.png
scene-preview-local-sun.png
scene-preview-flat-long-sightline.png
scene-gallery.png
```

### `transfer-cases.json`

Each case should include:

```js
{
  caseId,
  wavelengthsNm,
  sunCase,
  geometryProfileId,
  sourceProfileId,
  camera,
  target,
  segment: {
    originMeters,
    targetMeters,
    lengthMeters,
    directionMeters
  },
  objectSpectrumId,
  objectRadianceByWavelength,
  opticalDepthByWavelength,
  transmittanceByWavelength,
  pathRadianceByWavelength,
  attenuatedObjectRadianceByWavelength,
  finalRadianceByWavelength,
  components: {
    firstOrderPathRadianceByWavelength,
    secondOrderPathRadianceByWavelength
  },
  displayPreview,
  diagnostics
}
```

### `criteria-results.json`

Record one machine-readable result per criterion:

```js
{
  criterionId,
  status,
  tolerance,
  measuredError,
  sourceOrStatus,
  cases,
  notes
}
```

`sourceOrStatus` should identify whether the criterion is reference-backed or
algorithmic.

Allowed `status` values are `pass`, `fail`, `unresolved`, and
`not-applicable`; their meanings are defined in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md#audit-trail).

### `contact-sheet.png`

The baseline contact sheet should be a report aid with columns:

1. source object radiance with no atmosphere;
2. `T_view * L_object`;
3. `L_path`;
4. `T_view * L_object + L_path`.

Rows should cover Sun case, distance, and object spectrum. The contact sheet
must be generated from `transfer-cases.json`, not from a separate hidden render
path.

Use one fixed display mapping across the whole contact sheet. Do not normalize
per swatch or per row. If a secondary auto-exposure image is created for human
inspection, label it display-only and keep the primary spectral criteria tied
to `transfer-cases.json`.

## Follow-Up Experiment Inputs And Outputs

Follow-up experiments should reuse the same artifact shape and add only the
fields needed by the changed model.

### Local Sun Follow-Up

Additional inputs:

```js
{
  sourceProfile: {
    id: "local-point-sun",
    type: "point",
    positionMetersENU,
    spectralRadiantIntensityByWavelength,
    referenceDistanceMeters,
    normalizationPolicy
  }
}
```

Additional outputs:

- source distance for each surface point and scattering sample;
- local source direction for each sampled point;
- pre-atmosphere source irradiance or radiance contribution;
- source-to-sample transmittance;
- angular spread of source directions across the scene.

Reference: [PBRT 4e, Point Lights](https://pbr-book.org/4ed/Light_Sources/Point_Lights).

### Flat Long-Sightline Follow-Up

Additional inputs:

```js
{
  geometryProfile: {
    id: "flat-slab",
    coordinateFrame: "flat-east-north-up",
    groundHeightMeters: 0,
    topAtmosphereHeightMeters,
    densityHeightPolicy
  },
  distancesMeters
}
```

Additional outputs:

- per-sample altitude;
- optical depth and `log(T)`;
- spherical-vs-flat geometry profile comparison packets when applicable;
- long-distance finite object transfer cases.

References:

- [IPRT Phase A](https://arxiv.org/abs/1901.01813)
- [Stamnes et al. 1988 DISORT abstract](https://opg.optica.org/ao/abstract.cfm?uri=ao-27-12-2502)

## Non-Goals For The First Run

The first baseline should not:

- implement a full raster renderer;
- include local Sun source falloff;
- include flat-Earth long-line-of-sight geometry;
- infer object spectra from RGB;
- add Lambertian surface lighting unless the caller-radiance transfer proof is
  already complete;
- use display images as the source of truth.
