# Environment Experiment Preflight Spec

This document records the preflight decisions for the cleanroom
environment-object experiment lane.

It supports:

- [Environment Object Color Prompt](environment-object-color-prompt.md)
- [Environment Experiment Run Shape](environment-experiment-run-shape.md)
- [Objective Success Criteria](objective-success-criteria.md)

## Starting Point

Use all active constants and assumptions from cleanroom experiment 032 as the
starting point for `001-transfer-baseline`.

This includes:

- spherical Earth atmosphere geometry;
- no ozone;
- no ground coupling;
- no direct solar-disc camera radiance;
- Bruneton 2016 aerosol constants;
- 15 centered wavelength samples from `360 nm` to `830 nm`;
- full-sphere Fibonacci second-order path radiance;
- distant directional Sun source;
- spectral radiance as the transport endpoint;
- CIE/linear-sRGB/PNG output only as a post-transport display consumer.

The implementation may copy or factor only from:

```text
scripts/flat/experimental/bruneton-start-fresh.js
```

The implementation must not replace experiment 032 constants with convenient
new defaults unless the replacement is explicitly source-backed or labeled as
an algorithmic stress decision.

Reference:

- [Experiment 032 Algorithm](experiment-032-algorithm.md)

## Unit And Scale Conventions

Every generated artifact must state units beside each numeric array or scalar.
Use these conventions for the first baseline:

- wavelengths: `nm`;
- geometry distances, radii, heights, and segment lengths: `m`;
- angles in inputs and reports: `deg`, with internal trigonometry allowed to
  use `rad`;
- optical depth: dimensionless;
- transmittance: dimensionless;
- atmospheric path radiance: the spectral radiance scale produced by the
  experiment 032 cleanroom transport path;
- synthetic object radiance: algorithmic unit spectral-radiance scale unless a
  later run adopts physical radiance units;
- display previews: post-transport CIE/linear-sRGB/PNG values with the display
  mapping recorded separately from spectral transport.

The first synthetic object spectra are intentionally not measured material
spectra and should never be reported as reflectance. They are caller-provided
spectral radiance arrays used to stress the atmosphere transfer equation.

## Artifact Numbering And Resume Policy

The output root is fixed:

```text
tmp/atmosphere/cleanroom_environment/
```

Before each run, inspect existing `NNN-*` artifact folders under that root.
The next artifact number is `max(existing NNN) + 1`. If no numbered artifacts
exist, the first artifact is:

```text
001-transfer-baseline
```

Never overwrite an existing numbered artifact. If a run must be repeated after
a failure or crash, create the next numbered folder with the same or updated
step label and mark the previous artifact as `rejected` or `superseded` in
both its `state-goal.md` and the root `running-log.md`.

Append a "started" entry to the root running log before long computation when
possible, then update that entry with completion status, what changed, what
was learned, and the next step. This makes crashes and context compaction
recoverable.

## Baseline Case Matrix

`001-transfer-baseline` should produce the full cross product:

```text
2 Sun cases * 7 distances * 6 object spectra = 84 transfer cases
```

The baseline also needs focused diagnostics:

- segment-composition diagnostics for both Sun cases at `1 km`, `20 km`, and
  `100 km`;
- linearly composed final-radiance checks for all six object spectra using the
  same split-segment transfer packets;
- explicit linearity checks for these object-spectrum pairs:
  `neutral_high - neutral_unit`, `red_step - blue_step`, and
  `green_peak - neutral_unit`.

These diagnostic selections are algorithmic. They cover near, middle, and long
finite segments without turning the first run into an exhaustive combinatorial
search.

Segment-composition diagnostics must compare equivalent numerical partitions:
if each half segment uses `N` view intervals, the full-segment diagnostic should
use `2N` view intervals over the whole distance. Comparing a full segment with
`N` intervals against two half segments with `N + N` total intervals measures
quadrature convergence, not the transfer-composition identity.

## Baseline Sun Cases

The baseline must include the sunrise/sunset low-Sun case and the highest-Sun
case from the Bruneton four-skydome Figure 1 layout:

| Case id | Figure row | Zenith | Altitude | Role |
| --- | --- | --- | --- | --- |
| `figure1-06h00-z87` | `06h00` | `87 deg` | `3 deg` | sunrise/sunset stress case |
| `figure1-13h15-z21` | `13h15` | `21 deg` | `69 deg` | highest-Sun stress case |

If the implementation uses Figure 1 red-cross azimuths, use the experiment 032
azimuth measurements and keep them labeled as algorithmic measurements from
external Figure 1 tiles:

| Case id | Azimuth |
| --- | --- |
| `figure1-06h00-z87` | `-25.83454348280912 deg` |
| `figure1-13h15-z21` | `85.31410016049729 deg` |

The intermediate Figure 1 rows, `10h15 / 41 deg` and `11h15 / 31 deg`, are
optional follow-up cases for denser Sun-position coverage.

Reference:

- [Experiment 032 Algorithm](experiment-032-algorithm.md#figure-1-scene-constants)

## Algorithmic Stress Defaults

When a choice is not source-backed, choose the option most likely to stress the
transport system while keeping the proof interpretable.

### Distances

Use:

```text
0 m, 100 m, 1 km, 5 km, 20 km, 50 km, 100 km
```

Reasons:

- `0 m` proves identity behavior;
- `100 m` and `1 km` show near-field transfer should remain close to source
  object radiance;
- `5 km` starts stressing low-altitude optical depth;
- `20 km`, `50 km`, and `100 km` stress long finite object paths and path
  radiance dominance.

These distances are algorithmic stress inputs, not measured scene distances.

### Target Placement

Use a local ENU test frame with a ground observer:

```js
camera.originMetersENU = [0, 0, 2]
camera.forwardMetersENU = [1, 0, 0]
camera.upMetersENU = [0, 0, 1]
```

For nonzero distances, place target-card centers on the camera forward axis:

```js
target.centerMetersENU = [distanceMeters, 0, 2]
target.normalMetersENU = [-1, 0, 0]
```

The `0 m` case is a synthetic zero-length transfer packet, not a physical
card.

For nonzero target cards, use:

```js
target.widthMeters = 1
target.heightMeters = 1
```

Card width and height are visualization metadata only in the baseline. The
pass/fail checks use center-ray transfer packets, so physical target size,
edge rays, angular size, and raster visibility are not part of
`001-transfer-baseline`.

The long-distance cards are finite object endpoints for transfer stress. They
are not a claim about ground-anchored visibility over a curved Earth. Flat
ground-anchored long sightlines belong in the later flat-Earth follow-up.

### Object Spectra

Use synthetic spectral radiance inputs for `001-transfer-baseline`. They are
algorithmic stress spectra, not material reflectance datasets.

For each wavelength sample `lambda_nm`, define:

```text
black(lambda) = 0
neutral_unit(lambda) = 1
neutral_high(lambda) = 10
blue_step(lambda) = lambda <= 501 ? 1 : 0.05
triangle(lambda, center, half_width) =
  max(0, 1 - abs(lambda - center) / half_width)
lower_right_forest_green(lambda) =
  0.3
  + 0.2 * triangle(lambda, 501, 55)
  + 0.35 * triangle(lambda, 532.333333333333, 65)
  + 0.08 * triangle(lambda, 657.666666666667, 90)
green_peak(lambda) = 0.02 * lower_right_forest_green(lambda)
red_step(lambda) = lambda >= 626.333333333333 ? 1 : 0.05
```

Reasons:

- black isolates path radiance;
- neutral unit provides a simple baseline;
- neutral high stresses dynamic range and display preview handling;
- blue/red steps stress wavelength-dependent transmittance;
- green peak adds a user-directed dark forest-green color target, based on the
  lower-right foliage in the supplied reference image and encoded as
  approximately `30/58/32` before atmosphere in the artifact display preview.

Note: artifacts through `021-scene-gallery` used the earlier
`max(0.05, 1 - abs(lambda - 563.666666666667) / 120)` formula. That broad
yellow-green spectrum was superseded by the 532 nm display-green stress input
in `022` through `027`, then by a foreground-olive target in `028` through
`033`. The current lower-right forest-green formula above starts at `034` and
remains algorithmic, not a measured vegetation reflectance spectrum.

The numeric scale is an algorithmic unit-radiance scale unless a later
artifact adopts physical radiance units.

### Numerical Controls

Use the experiment 032 numerical controls for the first baseline unless the
implementation discovers a direct incompatibility with finite segments:

- view-ray scattering intervals: `20`;
- sample-to-Sun transmittance intervals: `10`;
- second-order incoming directions: `17`;
- second-order incident altitude bins: `24`.

The convergence follow-up should stress these by increasing selected counts,
starting with a `2x` multiplier.

For `002-transfer-convergence`, rerun the identical baseline input scene with
these first high-sample controls:

- view-ray scattering intervals: `40`;
- sample-to-Sun transmittance intervals: `20`;
- second-order incoming directions: `34`;
- second-order incident altitude bins: `48`.

The `40`, `20`, `34`, and `48` values are algorithmic `2x` stress controls,
not source-backed atmosphere constants. The second-order angular weight must
be recomputed as `4 * pi / N` for the active direction count.

Implementation outcome:

- `003-transfer-baseline` passed the hard transfer identities with the original
  `20/10/17/24` controls.
- `004-transfer-convergence` showed the original baseline did not satisfy the
  algorithmic `5x` convergence-margin gate; its minimum margin was
  `3.0292958740138496`.
- `005-transfer-refined-baseline` promoted `40/20/34/48` to the accepted
  refined baseline.
- `006-transfer-refined-convergence` compared that refined baseline against
  `80/40/68/96` and passed all criteria with minimum convergence margin
  `6.4074899093834174`.
- The broader follow-up experiment set also reached success:
  `011-lambertian-surface-lighting` passed `8/8` criteria,
  `012-local-sun-follow-up` passed `8/8` criteria, and
  `013-flat-long-sightline-follow-up` passed `9/9` criteria.
- `014-scene-gallery` through `017-scene-gallery` are accepted but superseded
  display iterations for the all-phases visual-output requirement.
- `018-scene-gallery` is an accepted neutral-object perspective scene
  iteration, superseded by `019`.
- `019-scene-gallery` is an accepted source-colored perspective scene
  iteration, superseded by the multicolor scene-display request.
- `020-scene-gallery` is an accepted multicolor scene-output proof, superseded
  by `021` because the first multicolor layout read more like adjacent front
  cards than separated object sets.
- `021-scene-gallery` closes the user's red/blue/green all-phases visual-output
  request. It passed `7/7` criteria, read accepted artifacts `006`, `011`,
  `012`, and `013`, selected `282` recorded spectral cases, sampled `1280` sky
  blocks and `2400` ground-atmosphere blocks through the cleanroom spectral
  kernels, rendered red, blue, and green recorded object-spectrum stacks in
  each scene/source view, and generated one perspective scene preview per
  phase plus `scene-gallery.png`.
- `022-transfer-refined-baseline` through `027-scene-gallery` reran the
  source artifacts and scene gallery after replacing the algorithmic synthetic
  green spectrum with the 532 nm display-green stress input. `023`, `024`,
  `025`, and `026` are accepted source artifacts with `0` failures and `0`
  unresolved criteria, superseded by the foreground-olive branch. `027`
  passed `7/7` criteria, reads `023` through `026`, selected `282` recorded
  spectral cases, sampled `1280` sky blocks and `2400` ground-atmosphere
  blocks, and renders red, blue, and visibly green recorded object-spectrum
  stacks in each scene/source view.
- `028-transfer-refined-baseline` through `033-scene-gallery` reran the source
  artifacts and scene gallery after replacing the 532 nm display-green stress
  input with the foreground-olive green target. `029`, `030`, `031`, and `032`
  are accepted source artifacts with `0` failures and `0` unresolved criteria,
  superseded by the lower-right forest-green branch. `033` passed `7/7`
  criteria, reads `029` through `032`, selected `282` recorded spectral cases,
  sampled `1280` sky blocks and `2400` ground-atmosphere blocks, and renders
  red, blue, and muted foreground-olive green recorded object-spectrum stacks
  in each scene/source view.
- `034-transfer-refined-baseline` through `039-scene-gallery` reran the source
  artifacts and scene gallery after replacing the foreground-olive target with
  the lower-right forest-green target. `035`, `036`, `037`, and `038` are
  accepted current source artifacts with `0` failures and `0` unresolved
  criteria. `039` passed `7/7` criteria, reads `035` through `038`, selected
  `282` recorded spectral cases, sampled `1280` sky blocks and `2400`
  ground-atmosphere blocks, and renders red, blue, and dark forest-green
  recorded object-spectrum stacks in each scene/source view.
- `040-scene-gallery` reran only the scene gallery after changing the
  algorithmic preview sky/ground sample block size from `24 px` to `8 px`.
  `040` is the current scene artifact; it passed `7/7` criteria, reads `035`
  through `038`, selected `282` recorded spectral cases, sampled `11040` sky
  blocks and `21600` ground-atmosphere blocks, and keeps the lower-right
  forest-green object spectra from `039`.

## Input Shape Requirements

The input shape can evolve with the experiments, but every run must include an
audit trail and references.

`inputs.json` should include:

```js
{
  schemaVersion,
  runId,
  stateGoal,
  sourceBoundary,
  atmosphereProfile,
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

Required audit fields:

- `sourceBoundary`: records that only the cleanroom script is allowed as local
  code input.
- `algorithmicStressDecisions`: records choices such as synthetic spectra,
  target placement, distances, and preview layout.
- `references`: maps every source-backed equation, constant, and assumption to
  an external reference or to the experiment 032 citation record.

## CLI Requirements

The new experiment may use the cleanroom script's CLI shape as a guide for its
own CLI.

Reference local guide:

```text
scripts/flat/experimental/bruneton-start-fresh.js
```

Recommended entry point:

```text
scripts/flat/atmosphere-environment/run.js
```

Recommended command shape:

```text
node scripts/flat/atmosphere-environment/run.js --step=transfer-baseline
```

CLI requirements:

- support a `--step=<step-id>` argument;
- default to `transfer-baseline` if `--step` is omitted and no numbered
  artifacts exist;
- keep an internal step registry with stable step ids, labels, titles, and
  status/default metadata;
- validate unknown step ids and report the valid step ids;
- after `001-transfer-baseline`, defaulting without `--step` should select the
  next recommended incomplete step from the latest artifact's `state-goal.md`
  or the root `running-log.md`;
- create a new sortable numbered artifact folder for each run instead of
  overwriting an existing numbered artifact;
- use folder names in the form `NNN-step-label`;
- write the executed command to `provenance.json` and the artifact-local
  `run.log`;
- update the root `running-log.md` after every numbered iteration;
- keep the output root fixed at
  `tmp/atmosphere/cleanroom_environment/` unless a later explicit requirement
  changes it.

Suggested initial step ids:

| Step id | Artifact label | Purpose |
| --- | --- | --- |
| `transfer-baseline` | `transfer-baseline` | Produce `001-transfer-baseline`. |
| `transfer-convergence` | `transfer-convergence` | Produce the convergence follow-up after baseline. |
| `lambertian-surface-lighting` | `lambertian-surface-lighting` | Optional surface-lighting follow-up. |
| `local-sun-follow-up` | `local-sun-follow-up` | Optional finite-source follow-up. |
| `flat-long-sightline-follow-up` | `flat-long-sightline-follow-up` | Optional flat-geometry follow-up. |
| `scene-gallery` | `scene-gallery` | Generate the all-phases scene previews from accepted artifacts. |

The CLI shape is an implementation convention derived from the cleanroom
script, not a physics source. Any additional flags are algorithmic
implementation choices and must be documented in `inputs.json` and
`provenance.json`.

## Output Shape Requirements

Each numbered artifact should contain:

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

The final `scene-gallery` artifact also contains:

```text
scene-data.json
scene-preview-transfer.png
scene-preview-lambertian.png
scene-preview-local-sun.png
scene-preview-flat-long-sightline.png
scene-gallery.png
```

The output root should contain the canonical running log:

```text
tmp/atmosphere/cleanroom_environment/running-log.md
```

### Audit Trail

`provenance.json` should record:

- script path;
- command;
- artifact folder;
- generated file list;
- next-artifact-number decision;
- source boundary;
- run start and completion timestamps when available;
- status: `accepted`, `rejected`, `superseded`, or `blocked`;
- link or anchor to the relevant `running-log.md` entry;
- script snapshot path or file hashes.

`equations-and-constants.json` should record:

- every active equation;
- every active constant;
- every algorithmic decision;
- reference IDs for source-backed choices;
- explicit `algorithmic` status for unsourced stress choices;
- references and algorithmic-decision arrays that can be inspected without
  reading prose reports.

`criteria-results.json` should record:

- each objective criterion;
- status: `pass`, `fail`, `unresolved`, or `not-applicable`;
- tolerance;
- measured error or effect size;
- source-backed or algorithmic status.

Criterion status meanings:

- `pass`: the criterion was evaluated and satisfies its stated threshold;
- `fail`: the criterion was evaluated and violates its stated threshold;
- `unresolved`: the criterion produced data, but the effect is below the
  convergence/error threshold or the needed convergence run has not happened;
- `not-applicable`: the criterion is outside the current step's scope.

### Display And Contact-Sheet Policy

The contact sheet must be derived only from `transfer-cases.json`; it must not
use a separate hidden render path.

Use a single fixed display mapping for all swatches in one artifact. Record
that mapping in `inputs.json` and `equations-and-constants.json`. The default
preview mapping for the baseline is the experiment 032 post-transport path:
CIE XYZ, linear sRGB, clamp negative channels to zero for PNG encoding, and
the Bruneton Figure 1 display transform `1 - exp(-k * linear_srgb)` with
`k = 1 / (5 * 683)`. This is a display consumer only.

Do not normalize per swatch or per row. If the fixed mapping clips or leaves a
case too dark to inspect, report the clipped channel counts and optionally add
a secondary `contact-sheet-autoexposure.png` using one artifact-wide exposure
chosen from the recorded data. That secondary exposure is an algorithmic
visualization aid and cannot satisfy any spectral criterion.

Organize the baseline contact sheet as blocks by Sun case and object spectrum,
with distance rows inside each block and these four columns:

1. source object radiance with no atmosphere;
2. `T_view * L_object`;
3. `L_path`;
4. `T_view * L_object + L_path`.

## Running Log Requirement

Every numbered iteration must update:

```text
tmp/atmosphere/cleanroom_environment/running-log.md
```

The log should be append-only and should include one entry per numbered
artifact. Each entry should record:

```text
## 001-transfer-baseline

State goal:
What it is doing:
Inputs and assumptions changed:
Commands run:
What it learned:
Accepted/rejected/superseded/blocked:
Next:
```

The running log is the canonical cross-artifact narrative for context
compaction and agent bootstraps. Individual artifact `report.md` files can
summarize the same result, but the chronological lane history belongs in the
root running log.

## First State Goal

Use this state goal for the first implementation pass:

```text
Produce a complete 001-transfer-baseline artifact using experiment 032
constants and assumptions, the low-Sun and highest-Sun Bruneton Figure 1 cases,
algorithmic stress spectra, and long finite target distances. The artifact
passes the spectral transport identity checks or documents the smallest
remaining blocker and the next numbered iteration needed to resolve it.
```
