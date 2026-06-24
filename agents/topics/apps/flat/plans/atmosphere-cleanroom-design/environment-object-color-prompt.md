# Environment Object Color Prompt

## Goal

Create a cleanroom experimental script lane that demonstrates how the
atmosphere changes the color of environment objects based on Sun position and
distance to the object.

This is not a production pipeline task. The goal is to prove the design
concept before generating the new pipeline.

This is a self-guided iterative experiment lane. After implementation starts,
continue creating numbered artifacts and updating the relevant docs through
context compaction and agent bootstraps. Stop only when a stated goal is
reached, a real dead end is documented, or the user interrupts or redirects
the work.

Use or modify the cleanroom experiment 032 approach as the starting point, but
write the new experiment under:

```text
scripts/flat/atmosphere-environment/
```

The first script should be self-contained and should create artifacts under:

```text
tmp/atmosphere/cleanroom_environment/
```

The script may use the cleanroom CLI as a guide for its own CLI. Start with
the command shape documented in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md#cli-requirements):

```text
node scripts/flat/atmosphere-environment/run.js --step=transfer-baseline
```

Each run must create a new sortable numeric folder, for example:

```text
tmp/atmosphere/cleanroom_environment/001-transfer-baseline/
```

## Strict Source Rules

- All equations, constants, approximations, display choices, object spectra,
  scene controls, and numerical controls need references or must be explicitly
  labeled as algorithmic decisions.
- The only local code that may be referenced is the cleanroom script:
  `scripts/flat/experimental/bruneton-start-fresh.js`.
- The cleanroom script's CLI shape may be used as a local implementation guide
  for this lane's CLI, but not as an authority for new physics.
- Do not inspect, import, cite, or derive from the rejected pipeline under
  `scripts/flat/atmosphere_rejected/`.
- Do not inspect, import, cite, or derive from older local atmosphere code,
  older local docs, previous local implementation logs, or prior generated
  local images as technical authority.
- Existing cleanroom design docs may be used as prompt/routing context, but the
  experiment implementation must cite direct external sources or the cleanroom
  script's own source-citation records for technical claims.
- Unit tests are not required for this experimental code.

## Iteration Contract

Each implementation pass must define a state goal before running, for example:

```text
Reach a passing 001-transfer-baseline artifact that proves finite object
transfer using spectral caller-provided object radiance.
```

Work one numbered artifact at a time. Each artifact must either:

- pass its stated goal;
- fail with a documented reason and a next iteration plan; or
- document a dead end that prevents meaningful progress without user input or
  an external-state change.

After each numbered artifact:

- write or update `report.md`;
- record accepted/rejected/superseded status;
- update the cleanroom worklog/status docs with what changed, what was
  verified, and what remains next;
- keep enough inputs, provenance, and script snapshot or script version data
  that a later agent can resume after context compaction.

When practical, append a started entry to the root `running-log.md` before a
long run and update the same entry after the run completes. A failed or crashed
artifact should remain visible in the numbered sequence and be marked
`rejected` or `superseded`; do not overwrite it.

Do not stop at a proposal once implementation starts. Continue through
implementation, artifact generation, verification, and documentation until the
state goal is reached, a dead end is documented, or the user interrupts.

Allowed local context:

- `scripts/flat/experimental/bruneton-start-fresh.js`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-color-transport.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-transport-experiment-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/objective-success-criteria.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-preflight-spec.md`

## Core Demonstration

The experiment must demonstrate finite-segment aerial perspective for object
color:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

Where:

- `L_object(lambda)` is caller-owned object spectral radiance before the
  atmosphere view path.
- `T_view(lambda)` is spectral transmittance from object to camera.
- `L_path(lambda)` is atmospheric path radiance added along the finite segment.

The atmosphere owns `T_view(lambda)` and `L_path(lambda)`. The object/material
side owns `L_object(lambda)`.

## Starting Atmosphere Profile

Begin with the experiment 032 profile unless a source-backed change is made and
recorded:

- no ozone;
- no ground coupling;
- no direct solar-disc camera term;
- Bruneton 2016 aerosol constants;
- 15 centered wavelength samples from `360 nm` to `830 nm`;
- full-sphere Fibonacci second-order path radiance;
- spectral endpoint before display conversion.

For the first implementation pass, use all active experiment 032 constants and
assumptions as specified in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md).

The baseline should keep Bruneton's distant directional Sun source. Do not mix
local-Sun behavior or flat-Earth long-line-of-sight geometry into the first
baseline unless the artifact labels them as separate variants.

The script may copy or factor cleanroom kernels from
`scripts/flat/experimental/bruneton-start-fresh.js`. Any copied section should
preserve the source-citation trail in the generated artifact.

## Follow-Up Source And Geometry Experiments

Keep the first artifact focused on the baseline finite object-transfer proof.
The following are candidate follow-up experiments, not requirements for
`001-transfer-baseline`:

1. **Local Sun source:** replace the distant parallel Sun with a finite
   position source. For each scattering sample and surface point, compute the
   local direction to the source and a source-strength term with inverse-square
   receiver irradiance falloff. Record this as source irradiance/radiance
   input, not as atmospheric attenuation. The visible result may be described
   as luminance or brightness drop-off, but the recorded physical quantity must
   be spectral irradiance or spectral radiance source contribution.
2. **Flat-Earth long line of sight:** replace the spherical atmosphere
   geometry with a labeled plane-parallel or flat-slab geometry. Long
   horizontal and shallow-angle object rays should remain finite object
   segments over the flat plane instead of being truncated by spherical-Earth
   curvature.

References and objective checks for these variants are defined in
[Objective Success Criteria](objective-success-criteria.md). Local Sun
position, emitted power/intensity, flat-atmosphere height, and long-distance
sample sets are algorithmic unless sourced in the artifact.

## Scenes

See [Environment Experiment Run Shape](environment-experiment-run-shape.md)
and [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)
for the proposed run sequence, inputs, outputs, minimal 3D scene model,
stress defaults, and audit-trail requirements.

Use at least two Sun-position cases:

- sunrise/sunset low Sun: Figure 1 `06h00 / 87 deg` row;
- highest Sun from the four-skydome figure: Figure 1 `13h15 / 21 deg` row.

The Figure 1 row choices are source-backed by Bruneton 2016. If the script uses
the red-cross-derived azimuths from experiment 032, label those azimuths as
algorithmic measurements from extracted external Figure 1 tiles.

Use several object distances, with these as the first algorithmic set unless
replaced by a sourced scene design:

```text
0 m, 100 m, 1 km, 5 km, 20 km, 50 km, 100 km
```

## Object Inputs

Use simple synthetic object spectra for the first proof:

- black: zero radiance;
- neutral: constant spectral radiance;
- high neutral: constant high spectral radiance for dynamic-range stress;
- red-biased spectrum;
- green-biased spectrum;
- blue-biased spectrum.

The first formulas are specified in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md).
These spectra are algorithmic test inputs unless replaced by externally sourced
material reflectance or radiance spectra. Label them that way in every report.

Avoid hidden RGB grading. If an RGB display image is produced, it must be a
post-transport visualization of recorded spectral values.

## Required Outputs

Every numeric artifact folder must contain:

- `state-goal.md`;
- `inputs.json`;
- `provenance.json`;
- `equations-and-constants.json`;
- machine-readable transfer data for every Sun case, object spectrum, and
  distance;
- `criteria-results.json`;
- `report.md`;
- `run.log`;
- `script-snapshot.js` or `script-snapshot/`;
- a contact sheet or PNG visualization with columns for:
  1. source object radiance with no atmosphere;
  2. `T_view * L_object`;
  3. `L_path`;
  4. `T_view * L_object + L_path`.

For every case, record:

```js
{
  wavelengthsNm,
  sunCase,
  distanceMeters,
  objectSpectrumId,
  objectRadianceByWavelength,
  transmittanceByWavelength,
  pathRadianceByWavelength,
  attenuatedObjectRadianceByWavelength,
  finalRadianceByWavelength,
  displayPreview,
  diagnostics
}
```

Every recorded spectral array must state whether it is dimensionless, optical
depth, algorithmic unit radiance, or source-backed spectral radiance. The first
baseline should produce `84` primary transfer cases: `2` Sun cases, `7`
distances, and `6` object spectra.

`displayPreview` may contain CIE XYZ, linear sRGB, and encoded PNG/swatch
values, but display data must not replace the spectral data.

The output root must also contain the canonical append-only running log:

```text
tmp/atmosphere/cleanroom_environment/running-log.md
```

Each numbered iteration must update the running log with what it is doing,
what changed, what it learned, the artifact status, and the next step.

## Success Criteria

See [Objective Success Criteria](objective-success-criteria.md) for the
reference-backed criteria tiers and threshold policy. The summary below is the
minimum checklist for the first artifact.

The run succeeds only if the report demonstrates all of the following with
numbers and visual artifacts:

- **Zero-distance identity:** at `0 m`, `T_view(lambda)` is approximately `1`,
  `L_path(lambda)` is approximately `0`, and final radiance matches object
  radiance within a stated numerical tolerance.
- **Black-object path proof:** for a black object,
  `finalRadianceByWavelength == pathRadianceByWavelength` within tolerance at
  every distance and Sun case.
- **Linearity proof:** for two objects at the same distance and Sun case, the
  final-radiance difference equals
  `T_view(lambda) * difference(objectRadianceByWavelength)` within tolerance.
- **Segment-composition proof:** splitting an object-to-camera segment into
  two subsegments composes to the same full-segment transfer within tolerance:
  `T_full = T_1 * T_2` and
  `L_path_full = L_path_1 + T_1 * L_path_2`.
- **Distance proof:** for the same object and Sun case, increasing distance
  reduces object contrast through decreasing transmittance and increases or
  changes the relative influence of path radiance.
- **Sun-position proof:** low-Sun and high-Sun cases produce measurably
  different path radiance and final object color for the same object and
  distance.
- **Spectral proof:** all core comparisons are made on spectral arrays before
  CIE/RGB display conversion.
- **Display-boundary proof:** CIE/RGB/PNG output is generated only as a
  post-transport consumer and is not used as a hidden fit.
- **No-sky-only proof:** the report includes finite object targets at multiple
  distances, not only skydome images.

Suggested numerical tolerances for the first implementation, algorithmic until
validated by convergence runs:

- exact algebraic identities from the same computed arrays:
  `1e-10` absolute or `1e-8` relative;
- zero-distance transfer with a zero-length segment:
  `1e-12` absolute for path radiance and transmittance error;
- display preview comparisons:
  no hard pass/fail unless the spectral checks pass first.

Where possible, demonstration effects should exceed the measured
higher-sampling convergence delta by a recorded margin instead of relying on a
fixed magic threshold.

## Suggested First Artifact

Create:

```text
001-transfer-baseline
```

It should render/report the transfer equation using caller-provided synthetic
object radiance only. Do not add Lambertian surface lighting to
`001-transfer-baseline`; that belongs in the later
`003-lambertian-surface-lighting` follow-up after the transfer baseline and
convergence pass.

The first run should use the fixed case matrix, artifact numbering, unit
conventions, status vocabulary, and display/contact-sheet policy defined in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md).
Convergence-dependent claims may remain `unresolved` in `001` as long as the
report points to `002-transfer-convergence` and the hard spectral identities
are evaluated.

The first report should answer:

1. Does object color change with distance through spectral transmittance?
2. Does atmospheric path radiance visibly haze/tint distant objects?
3. Does changing Sun position change the path radiance and therefore final
   apparent object color?
4. Are all proof checks made on spectral data before display conversion?

State goal for the first self-guided iteration:

```text
Produce a complete 001-transfer-baseline artifact whose spectral criteria
results pass or whose report identifies the smallest remaining blocker and
the next numbered iteration needed to resolve it.
```

## Later Optional Step

After the transfer baseline succeeds, add a sourced Lambertian surface-lighting
variant:

```text
L_surface(lambda) =
  reflectance(lambda) / pi * E_direct(lambda)
```

Keep sky irradiance as a separate optional subsystem. Do not silently mix
hemispherical sky lighting into the view-path transfer proof.
