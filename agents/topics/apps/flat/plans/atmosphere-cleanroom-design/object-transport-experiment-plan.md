# Object Transport Experiment Plan

This plan starts a new cleanroom experimental lane to prove that the atmosphere
model is useful for environment-object color, not only sky color.

## Goal

Use the experiment 032 atmosphere profile and kernels to prove finite-segment
object transport before designing the production pipeline.

Implementation prompt:

- [Environment Object Color Prompt](environment-object-color-prompt.md)
- [Objective Success Criteria](objective-success-criteria.md)
- [Environment Experiment Run Shape](environment-experiment-run-shape.md)
- [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)

The experiment should demonstrate:

- spectral view transmittance from object to camera;
- spectral in-scattered path radiance along that finite segment;
- composition of caller-owned object radiance with atmospheric transfer;
- visible object color changes with distance, Sun angle, and object spectrum;
- separation between the spectral transport endpoint and display conversion.

Operating mode: this is a self-guided numbered experiment lane. After
implementation starts, continue through artifacts, verification, and doc
updates until a stated state goal is reached, a real dead end is documented, or
the user interrupts.

Core equation:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

## Starting Point

Use experiment 032 as the source-backed transport baseline:

- no ozone;
- no ground coupling;
- no direct solar-disc camera term;
- Bruneton 2016 aerosol constants;
- 15 centered wavelength samples from `360 nm` to `830 nm`;
- full-sphere Fibonacci second-order path radiance;
- post-transport CIE/linear-sRGB/Figure 1 `k` display only for visualization.

For the first implementation pass, use all active experiment 032 constants and
assumptions. The preflight decisions for Sun cases, stress spectra, distances,
input/output shapes, audit trail, references, and running log are in
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md).

Do not add more visual-fit iterations to the closed skydome lane. Create the
new object-transport scripts under:

```text
scripts/flat/atmosphere-environment/
```

Each run should write a new sortable numeric artifact folder under:

```text
tmp/atmosphere/cleanroom_environment/
```

The implementation can copy or factor only from
`scripts/flat/experimental/bruneton-start-fresh.js`. The new lane should own
its own artifact folders and reports.

The new lane may also use the cleanroom script's CLI pattern as a guide:

```text
node scripts/flat/atmosphere-environment/run.js --step=transfer-baseline
```

Use a `--step=<step-id>` registry, validate unknown step ids, and write each
run to a fresh numbered artifact folder.

## Source Boundary

Equations and physical constants remain externally sourced. Experiment 032's
design doc identifies the sources for the active atmosphere profile:

- [Experiment 032 Algorithm](experiment-032-algorithm.md)
- [Object Color Transport](object-color-transport.md)

New numerical controls in this lane are algorithmic unless backed by an
external reference. Mark them that way in each artifact report.

## Phase 1: Transfer Baseline

Implement a finite camera-to-target segment using the same density,
coefficient, optical-depth, phase, and path-radiance kernels as experiment 032.

For each target point, output:

```js
{
  wavelengthsNm,
  distanceMeters,
  viewDirection,
  sunDirection,
  transmittanceByWavelength,
  pathRadianceByWavelength,
  components: {
    firstOrderPathRadianceByWavelength,
    secondOrderPathRadianceByWavelength
  }
}
```

Use simple synthetic object spectra to isolate atmospheric transfer:

- black: zero radiance;
- neutral white/gray: constant spectral radiance;
- red-biased, green-biased, and blue-biased spectra.

These object spectra are algorithmic test inputs, not measured material
reflectance datasets.

Recommended distances, all algorithmic until a convergence or scene source
replaces them:

```text
0 m, 100 m, 1 km, 5 km, 20 km, 50 km, 100 km
```

Use at least two Sun cases:

- sunrise/sunset low Sun from the Figure 1 `06h00 / 87 deg` row;
- highest Sun from the four-skydome Figure 1 set, the `13h15 / 21 deg` row.

## Phase 2: Composition Proof

For each object spectrum and distance, produce four displayed swatches:

1. source object radiance with no atmosphere;
2. `T_view * L_object`;
3. `L_path`;
4. `T_view * L_object + L_path`.

Also write JSON arrays for the spectral values before display. The swatches are
review aids; the JSON spectral packets are the proof artifacts.

Expected invariants:

- At `0 m`, `T_view` is approximately `1`, `L_path` is approximately `0`, and
  final radiance matches object radiance.
- For a black object, final radiance equals path radiance.
- Difference between two object outputs at the same distance equals
  `T_view * difference(objectRadiance)`.
- Splitting a segment and recomposing the two subsegments gives the same
  transfer as the full segment:
  `T_full = T_1 * T_2` and
  `L_path_full = L_path_1 + T_1 * L_path_2`.
- Increasing distance reduces object contrast and adds sky-colored path
  radiance.
- A long finite segment with zero object radiance approaches the corresponding
  sky-ray path-radiance behavior for the same direction.

## Phase 3: Surface Lighting Variant

After the transfer-only proof, add an optional Lambertian surface-lighting
variant:

```text
E_direct(lambda) =
  E_sun(lambda) * max(0, dot(normal, sun)) * T_surface_to_sun(lambda)

L_surface(lambda) =
  reflectance(lambda) / pi * E_direct(lambda)
```

Keep sky irradiance as an explicit optional term. Do not silently fold
hemispherical sky illumination into the view-path transfer.

This phase proves the atmosphere can support environment objects that are lit
by the same Sun source, while still keeping material/BRDF ownership separate
from atmosphere transport.

## Follow-Up Experiments: Local Sun And Flat Geometry

After the baseline transfer proof, consider two separate follow-up experiment
tracks:

- local Sun source with non-parallel source rays, inverse-square receiver
  irradiance falloff, local source-to-sample transmittance, and scattering
  phase angles evaluated against the local source direction;
- flat-Earth long-line-of-sight geometry using a labeled plane-parallel or
  flat-slab atmosphere, long finite object segments, and explicit comparison
  against the spherical baseline.

Keep these as named follow-up experiments rather than hidden options in the
baseline run. Local Sun parameters, flat-atmosphere height, and distance sets
are algorithmic unless backed by an external source. See
[Objective Success Criteria](objective-success-criteria.md#follow-up-source-and-geometry-experiment-criteria).

## Reports And Images

Each numbered artifact should contain:

- `state-goal.md`;
- `inputs.json`;
- `provenance.json`;
- `equations-and-constants.json`;
- transfer JSON for every scene/object/distance;
- `criteria-results.json`;
- a Markdown report;
- `run.log`;
- `script-snapshot.js` or `script-snapshot/`;
- a contact sheet with source, attenuated, path, and final columns;
- optional spectral plots or compact CSV tables.

The output root should also contain an append-only `running-log.md` updated by
every numbered iteration with what the iteration is doing and what it learned.

Contact sheets should include at least:

- low-Sun and high-Sun rows;
- multiple distances;
- black, neutral, red, green, and blue object spectra;
- labels for algorithmic controls and source-backed constants.

For the first baseline, use the fixed `84` primary case matrix from
[Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md#baseline-case-matrix).

## Success Criteria

The experiment is successful when it shows, without hidden RGB grading, that:

- object appearance is computed by spectral transfer plus path radiance;
- sky rendering is just the no-surface endpoint case;
- the same source-backed atmosphere profile can produce both sky radiance and
  finite object-ray color changes;
- display conversion remains a caller/post-pipeline consumer;
- the production pipeline needs an atmospheric transfer API, not just a sky
  image API.

## Open Decisions

- Whether to factor reusable kernels after the first self-contained
  environment-object baseline succeeds.
- Whether to source real material reflectance spectra for a later object-color
  validation pass.

Resolved for `001-transfer-baseline`: keep the first proof purely
caller-radiance based. Lambertian surface lighting starts no earlier than the
`003-lambertian-surface-lighting` follow-up.
