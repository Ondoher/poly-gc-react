# Atmosflat32 Source Abstraction Prompt

## Goal

Maintain a focused Algorithm32 experimental lane that routes Sun/source
behavior through source-sampling objects while keeping Algorithm32 centered on
atmospheric transport. The lane began by refactoring the existing distant
directional Sun path without changing the named step-032 sky-dome output, then
extended the same source-sample boundary to a finite flat local point Sun for
first-order sky radiance.

The default `distant-directional-sun` path is the regression oracle for every
local-source change. It must continue to reproduce the accepted experiment 032
/ Figure 1 sky domes exactly or within the documented image tolerance after
any source-interface work.

Use the new script folder:

```text
scripts/flat/atmosflat32/
```

Use the new append-only artifact root:

```text
tmp/atmosphere/atmosflat32/
```

This is not a continuation of the original `bruneton_start_fresh` numbered
experiment lane. Borrow only the sky-dome generation mechanics needed to prove
no behavior change, especially Figure 1 dome sampling, Algorithm32 transport
kernels, display conversion, and comparison packaging from:

```text
scripts/flat/experimental/bruneton-start-fresh.js
```

Treat the borrowed dome renderer as a fixture/generator for this new
source-abstraction lane, not as a reason to inherit old exploratory step
switches, rejected branches, or broad report baggage.

This lane is Node/script work only for the current milestones. Do not use the
`algorithm32-shader-lab` browser watcher for these artifacts; shader/browser
validation starts later.

## Current Accepted State

Milestone 0, the original no-behavior-change source abstraction, is accepted
by:

```text
tmp/atmosphere/atmosflat32/002-distant-source-abstraction-baseline/
```

The accepted command was:

```text
node scripts/flat/atmosflat32/run.js --step=distant-source-abstraction-baseline
```

The latest distant-Sun regression after the renderer-scoped flat sky
ray-limit/source-configuration cleanup is accepted by:

```text
tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/
```

Both artifacts route the default `distant-directional-sun` as a runtime source
object/configuration while preserving Algorithm32's experiment-032 behavior.
The latest regression records `9` passing criteria, exact PNG byte parity
against the four step-032 reference domes, and zero selected-ray deltas for
radiance, second-order contribution, and direct Sun transmittance. Treat `019`
as the current default-source regression target, `017` as the calibrated
observer-sky regression, `015` as the artificial-cap regression, `013` as the
post-flat-slab regression, `009` as the first post-local-source regression,
and `002` as the original handoff proof.

Latest local-source placement diagnostic:

```text
tmp/atmosphere/atmosflat32/005-flat-app-closest-san-jose-position/
```

This accepted artifact uses the app only as the configuration source for San
Jose and the default false Sun. Projection, closest approach, source direction,
finite distance, and apparent size are computed independently in the
`atmosflat32` runner. It records a `flat-local-point-sun` source positioned at
closest horizontal approach to San Jose (`distanceKm =
5050.674164842701`) with `10` passing criteria, plus
`flat-app-closest-position-map.png` and `flat-app-closest-sky-marker.png`.
Treat it as a source-placement fixture only; it is not local Sun Algorithm32
scattering validation.

Latest rotation observer sky artifact:

```text
tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/
```

This accepted artifact uses the same app-config `flat-local-point-sun`
placement and independently generates five pure observer angular sky PNGs at
offsets from closest San Jose approach: `0`, `45`, `90`, `135`, and `180`
degrees. It records `13` passing criteria. These images use the same fisheye
image loop as the round Algorithm32 distant-Sun domes. Flat/local transport
uses an `atmosphereGeometry` configuration for flat z altitude/density,
source kind/sample kind, finite-distance policy, and source-path
transmittance. The round-equivalent artificial cap is a separate skydome
renderer `skyViewRayLengthLimit` centered at `[0, 0, -6360000]` meters with
radius `6420000` meters and observer-level footprint radius
`875.656645 km`. That ray length limit is only for observer angular sky
rendering; it must not cap scene-renderer rays or source transmittance.
Source transmittance uses the configured flat top atmosphere plane and finite
source distance. Diagnostic source markers are recorded in JSON but not
painted into the PNGs.
The `flat-local-point-sun` source sample treats each source-to-sample distance
as the configured finite local Sun distance and applies the app-config
`point-inverse-square-reference` radiance rule:
`incidentScale = intensity * solarIrradianceScale * (referenceDistanceKm / distanceKm)^2`.
For transport, brightness is calibrated so closest approach receives `1x`
distant-Sun incident scale. That replaces the app's raw
`solarIrradianceScale: 58` and closest incident scale `52.38558099674243` with
calibrated transport `solarIrradianceScale: 1.1071748923354825`; the
180-degree case still has incident scale `0.12922172063575063` and remains lit
because the source is above the flat horizon (`20.10 deg`). Direct solar-disc
camera radiance, ground bounce, and local-source second-order cache behavior
remain explicitly deferred. `018` supersedes `016`, which used the cap more
ambiguously in source transmittance; `014` used the raw app brightness scale
and diagnostic overlays; `012` used the old flat-slab/background-distance cap;
`010` routed the local source through the round/spherical geometry path. `011`
is rejected because it paired the flat source with the old spherical observer
origin. `008` proved source-sample distance/falloff diagnostics but did not
run the scattering transport path.

## Minimal Bootstrap

If this file was loaded after a fresh bootstrap or context compaction, this
prompt and `experiment-032-algorithm.md` are the minimal working context. Do
not load shader-lab plans, production flat shader notes, object-color closeout
docs, rejected atmosphere docs, or old artifact histories unless a specific
implementation question requires them.

## POC Boundary

This lane is for proof-of-concept experiments, not production/shared app code.
Do not spend implementation time productionizing APIs, moving code into app
modules, or writing unit tests for this lane. Validate with append-only
artifacts, criteria files, image comparisons, and selected-ray diagnostics.
If a later milestone explicitly promotes code out of `scripts/flat/atmosflat32/`,
the production test strategy can be decided then.

Prefer a self-contained Node implementation using existing workspace
dependencies. If a new external package is considered, record the reason in
the artifact report before using it.

Long-term aspiration: this source/geometry/profile separation should not rule
out future non-Earth atmosphere scenes, including a hypothetical Mars scene.
That is not a current implementation target for `atmosflat32`; do not add Mars
constants, validation claims, or UI behavior here. The useful constraint now
is architectural: keep planet-specific facts such as body radius, gravity-era
assumptions if any, density profile, aerosol/species coefficients, surface
altitude model, and source configuration in explicit profile/geometry/source
records instead of hard-coding them into the transport loop.

## Baseline Target

Use this document as the written contract for the pre-refactor algorithm:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md
```

Use this artifact as the visual target:

```text
tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/
```

The four reference dome PNGs are:

- `figure1-06h00-z87-figure1-four-view-source-k-no-ground.png`;
- `figure1-10h15-z41-figure1-four-view-source-k-no-ground.png`;
- `figure1-11h15-z31-figure1-four-view-source-k-no-ground.png`;
- `figure1-13h15-z21-figure1-four-view-source-k-no-ground.png`.

The step-032 artifact does not contain the newer `result.json` or
`criteria-results.json` files. Do not treat their absence as a blocker. For
numeric diagnostics, run the copied pre-abstraction path and the new
source-adapter path in the new `atmosflat32` runner and compare those two paths
inside the same artifact.

## First State Goal - Accepted

Reach an accepted numbered artifact proving:

```text
Algorithm32 source abstraction + default distant directional Sun
matches the named step-032 / Figure 1 sky-dome output.
```

The new code should introduce a source-sampling interface equivalent to:

```js
sourceSamplesAt(position, geometry) -> [
  {
    kind: "distant-directional-sun",
    direction,
    distance: Infinity,
    spectralIncidentScaleByWavelength,
    visibilityPath: "to-atmosphere-boundary",
    diagnostics
  }
]
```

The renderer should receive a Sun configuration object or source adapter
instead of reading Sun state from module-level globals. This does not need to
be a plain data-only object at runtime; it may own canonicalized inputs and
methods such as `sourceSamplesAt(position, geometry)`. For the first
milestone, the serializable inputs needed to recreate that object are
deliberately small:

```js
{
  kind: "distant-directional-sun",
  sceneKey,
  direction,
  spectralIrradianceByWavelength
}
```

`sceneKey` is one of the four Figure 1 scene keys recorded in
`experiment-032-algorithm.md`. Do not add UI configuration or flat/local Sun
parameters yet.

Artifact files such as `command.json`, `result.json`, diagnostics, and
provenance must still record plain JSON data sufficient to recreate the runtime
Sun object. Keep behavior in code and reproducible inputs in artifacts.

Design bias: keep Algorithm32 thin. Do not pile source-specific branches into
the transport loops when the difference can live in the Sun/source object,
geometry helper, or cache-plan adapter. Algorithm32 should consume a small
source-sample contract and preserve the existing transport math; the source
object should own source direction, distance, falloff, source visibility path,
and any source-specific derived values.
This keeps Algorithm32 focused on light-source interaction with the atmosphere:
optical depth, transmittance, phase functions, and scattered radiance from the
incident light field supplied by the source object.

For this milestone, `position` is the existing experiment-032 Earth-centered
meter-space sample position, `direction` is a unit vector from the sample
toward the source, and the adapter returns exactly one sample. In JavaScript,
use `Number.POSITIVE_INFINITY` for the distant source distance. In JSON output,
do not serialize JavaScript `Infinity`; write a stable field such as
`distanceKind: "infinite"`.

For this first milestone, the adapter must preserve:

- the existing constant Sun direction per Figure 1 scene;
- the experiment-032 15-channel spectral solar irradiance values;
- the experiment-032 sample-to-top-atmosphere transmittance meaning;
- the no-direct-solar-disc camera-radiance policy;
- the experiment-032 second-order distant-Sun cache behavior;
- the display-only CIE/sRGB/Figure 1 tone-map boundary.

## First-Milestone Non-Goals

These were non-goals for the first accepted no-behavior-change milestone:

- `local-point-sun`;
- flat local Sun;
- configurable latitude/altitude/radius/brightness;
- visible Sun body rendering;
- new second-order cache designs;
- shader code;
- app integration;
- performance optimization.

The local-source items above are no longer general lane non-goals. They became
eligible after the default distant-Sun abstraction was proven unchanged.
Visible Sun body rendering, local-source second-order caches, shader code, app
integration, and performance optimization remain deferred.

## Current Local-Source Goal - Accepted

The accepted local-source milestone proves:

```text
Algorithm32 source abstraction + flat local point Sun
drives first-order angular sky scattering for configured finite source distance.
```

The implementation keeps the app as configuration only. The POC runner owns the
flat projection, closest San Jose approach, orbit offsets, transport-space
source placement, source-to-sample distance, inverse-square incident-scale
falloff, and source-path transmittance.

Deferred flat-model claim: some flat-Earth descriptions also assert that the
local Sun behaves like a flashlight or spotlight, limiting angular spread
instead of emitting like an omnidirectional sphere. Treat this as a separate
source emission profile, not an atmosphere change and not a display darkening
shortcut. If explored, the source object should own parameters such as beam
axis, cone half-angle, edge softness/falloff, spectral scaling, and whether
energy is conserved within the beam or simply clipped by the hypothesis. Each
source sample would multiply incident radiance by that angular emission
profile based on the direction from the source to the atmosphere sample.
Algorithm32 should continue to transport the resulting incident light field
through the atmosphere without knowing why the source emitted less light in a
given direction.

Future flashlight-source design notes:

- Add a serializable `angularEmissionProfile` on the finite local Sun source.
  Start with `kind: "omnidirectional"` and `kind: "spotlight"` rather than
  folding this into the existing inverse-square distance falloff.
- For `spotlight`, record at least: `beamAxisPolicy`, resolved `beamAxis`,
  `coneHalfAngleDegrees`, `edgeSoftnessDegrees`, `falloff`, `spectralScale`,
  and `energyPolicy`.
- `beamAxisPolicy` is a major model decision. Candidate policies include
  fixed configured vector, point at flat origin/center, point at the
  sub-source point on the flat plane, or point at the current observer for a
  diagnostic-only stress case. Do not hide this choice in code.
- `energyPolicy` is also a major model decision. Candidate policies are
  `peak-fixed`, where narrowing the cone only discards off-axis light, and
  `power-conserving`, where narrowing the cone increases in-cone intensity to
  preserve total emitted power. The first is simpler for claim emulation; the
  second is a different physical hypothesis and must be explicit.
- Source sampling should compute the direction from the source to the
  atmosphere sample, the angle to the resolved beam axis, an
  `angularEmissionScale`, and then multiply that into
  `spectralIncidentScaleByWavelength` alongside distance falloff and color.
- Useful first falloff modes are `hard-cutoff`, `smoothstep-edge`, and
  `cosine-power`. Record the chosen mode and parameters in diagnostics.
- Each source sample diagnostic should include `beamAxis`,
  `emissionAngleDegrees`, `coneHalfAngleDegrees`, `edgeSoftnessDegrees`,
  `angularEmissionScale`, `falloff`, `energyPolicy`, and whether the sample is
  inside the cone, in the soft edge, or outside.
- Validation should be artifact-based: prove omnidirectional output is
  unchanged, cone-center samples stay bright, outside-cone samples go dark or
  fall off as configured, edge softness is monotonic, distant-Sun regression
  remains exact, and the same source config reproduces the same images.
- Shader/cache follow-up: if source samples are computed analytically in the
  shader, port the same angular scale function to GLSL. If using lookup
  textures, include all angular-emission fields in the cache key and expect
  source irradiance to vary with sample position beyond inverse-square
  distance.

For this accepted milestone, the local source adapter must preserve:

- finite, position-dependent source direction;
- configured source-to-sample distance in meters/kilometers;
- app-config `point-inverse-square-reference` incident-scale falloff;
- future source-owned angular emission falloff, if a flashlight/spotlight Sun
  variant is enabled;
- source-path transmittance from the atmosphere sample toward the finite
  source;
- display conversion as a post-transport consumer;
- explicit deferral of direct solar-disc camera radiance, ground bounce, and
  local-source second-order cache behavior.

## Source Rules

- All equations, constants, approximations, display choices, and validation
  criteria need direct external sources or must be explicitly labeled as
  algorithmic decisions.
- The only local implementation code that may be borrowed for the first lane is
  `scripts/flat/experimental/bruneton-start-fresh.js`, and only for the
  existing Algorithm32 dome-generation mechanics.
- Existing cleanroom docs are routing and design context. They are not
  independent physics authorities.
- Do not use old Flat atmosphere code, the rejected atmosphere pipeline, older
  skydome logs, previous local rendered images, or local summaries as
  authority for equations, constants, expected colors, or visual targets.
- The accepted experiment 032 artifact may be used as the pre-refactor
  behavior target for this no-behavior-change check.
- Unit tests are not required for this experimental lane.

## Iteration Contract

Use the recent shader-lab artifact style, plus the small restart aids from the
environment-object experiment lane. Keep these files lightweight; they are POC
artifact records, not production test scaffolding.

Every run should create a new sortable numbered folder:

```text
tmp/atmosphere/atmosflat32/NNN-<label>/
```

The output folder is append-only. The original cleaned default-source handoff
artifact is:

```text
tmp/atmosphere/atmosflat32/002-distant-source-abstraction-baseline/
```

The current default-source regression and local first-order handoff artifacts
are:

```text
tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/
tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/
```

Never overwrite a prior numbered artifact. If a run fails, keep the artifact
folder and mark it rejected or incomplete in its report.

File deletion safety rule: do not delete untracked files, numbered artifact
folders, downloaded/source files, scratch outputs, logs, or JSON reports. If a
step needs to undo or supersede earlier POC work, prefer writing a new
numbered artifact or editing tracked docs/code. Before deleting any file for
this lane, verify it is tracked by Git; if it is untracked, leave it in place.

Each non-scaffolding artifact should include:

- `state-goal.md`;
- `inputs.json`;
- `command.json`;
- `result.json`;
- `criteria-results.json`;
- `report.md`;
- `run.log`;
- `provenance.json`;
- `equations-and-constants.json`;
- generated sky-dome images;
- reference/generated comparison images or summaries;
- selected-pixel or selected-ray spectral diagnostics;
- script snapshot or enough version/provenance detail to reproduce the run.

The output root should contain an append-only lane log:

```text
tmp/atmosphere/atmosflat32/running-log.md
```

Append one short entry per numbered artifact with status, what changed, what
was learned, and the next suggested step. When practical, write a started entry
before a long run and complete it afterward so crashes are recoverable.

Missing files are acceptable for early scaffolding only when `report.md` or
`result.json` says why they are absent.

For the first accepted artifact, require the core files above, the four
generated PNG domes, the four reference-vs-generated comparison summaries, and
selected-ray diagnostics. It is fine to skip a separate command-file watcher
input; the artifact-local `command.json` is the record of the command/config
that ran.

`state-goal.md` should state the artifact goal, success criteria, attempted
change, status, and next artifact to run if the goal is not reached.

`inputs.json` should record resolved, serializable inputs with units or
semantic kind beside every numeric scalar or array. A compact first schema is:

```js
{
  schemaVersion,
  runId,
  stateGoal,
  sourceBoundary,
  algorithm32Profile,
  sourceConfig,
  spectralGrid,
  numericalControls,
  figure1Scenes,
  outputProducts,
  references
}
```

`criteria-results.json` should use these statuses:

- `pass`: evaluated and satisfied its threshold;
- `fail`: evaluated and violated its threshold;
- `unresolved`: produced data, but the next diagnostic or convergence run is
  needed before judging it;
- `not-applicable`: outside the current step's scope.

Each criterion entry should include the criterion id, status, tolerance,
measured error or effect size, affected scenes/rays/files, and whether the
criterion is source-backed or algorithmic.

Display images, contact sheets, plots, and comparison overlays are report aids.
They must be derived from the same recorded transport/display outputs used by
the criteria, not from a separate hidden render path. If a secondary
auto-exposed or normalized image is useful for human inspection, label it
display-only and do not use it to satisfy acceptance criteria.

Short-lived scalar proxies or visual approximations are allowed only as
diagnostics for future work. They must be labeled as such, recorded as
algorithmic decisions, and must not be accepted as the source-abstraction
solution.

After an accepted milestone or a documented dead end, update:

- this prompt if the working contract changes;
- `algorithm32-module-design.md`;
- `algorithm32-shader-iteration-plan.md`;
- `reference-to-shader-goal.md`;
- `active-topic.md` when the active handoff changes.

## Acceptance Criteria For First Milestone

The first accepted source-abstraction artifact should prove:

- source abstraction is enabled and used by the sky-radiance path;
- only the `distant-directional-sun` adapter is active;
- all four Figure 1 / experiment 032 sky domes are generated at `320 x 320`;
- generated domes match the four named step-032 reference PNGs exactly, or
  within a documented encoded-image tolerance of `maxAbsRgbDelta <= 1` for RGB
  channels, with alpha unchanged;
- selected spectral radiance diagnostics match the copied pre-abstraction path
  exactly when operation order is preserved, or within `maxAbs <= 1e-12` and
  `maxRel <= 1e-10` when a harmless call-boundary change changes floating
  operation order;
- no-direct-solar-disc camera radiance is still omitted;
- experiment-032 sample-to-Sun transmittance is unchanged;
- experiment-032 second-order distant-Sun cache behavior is unchanged;
- display conversion remains a post-transport consumer.

For relative spectral-radiance checks, apply the relative bound only when the
pre-abstraction reference value has absolute value greater than `1e-12`;
otherwise the absolute bound decides the check.

Use these selected diagnostic rays for every Figure 1 scene:

- zenith: `viewZenithDeg = 0`, `viewAzimuthDeg = 0`;
- near-horizon toward the Sun: `viewZenithDeg = 85`,
  `viewAzimuthDeg = scene.sunAzimuthDeg`;
- near-horizon opposite the Sun: `viewZenithDeg = 85`,
  `viewAzimuthDeg = scene.sunAzimuthDeg + 180`.

If the first implementation cannot match exactly, classify the mismatch before
continuing:

- source adapter data mismatch;
- sample-to-Sun transmittance mismatch;
- second-order cache key or lookup mismatch;
- floating operation order change;
- display conversion or PNG encoding difference;
- artifact-comparison tooling error.

This default-source gate is satisfied by `002` and was revalidated after
local-source integration by `009`, after the old flat-slab handoff by `013`,
after the shared angular image loop / artificial-cap correction by `015`, and
after the calibrated observer-sky change by `017`, and after the renderer-
scoped flat sky ray-limit/source-configuration cleanup by `019`.
Keep rerunning the default-source regression after source-interface changes.

## Extended-Model Testing Strategy

After Algorithm32 has proven that Sun configuration can be routed through the
source abstraction with the default `distant-directional-sun` output unchanged,
use the same lane to add objective tests for the extended local-source model.
The current local-source observer sky evidence is accepted by `018`,
superseding `016` and the earlier `010`, `012`, and `014` local-source image
artifacts.
Generated sky images should remain only one part of the evidence.

Organize later validation around three layers:

- regression and parity tests: default distant-Sun sky-dome image parity,
  selected-ray spectral radiance parity, transmittance/cache parity,
  second-order cache lookup parity, and CPU-vs-shader parity once the model
  reaches GLSL;
- mathematical and model-contract tests: local source direction varies with
  sample position, configured distance/brightness falloff follows the selected
  rule, source altitude and latitude/time change the source location
  monotonically or circularly as configured, atmosphere path length affects
  optical depth/transmittance, zero-density and black-source cases collapse to
  their expected limits, far-away local Sun approaches the distant-Sun result,
  vanishing source radius approaches point-source behavior, and symmetric
  configurations produce symmetric diagnostics;
- numerical and rendering tests: convergence with increasing ray-march sample
  counts, CPU reference versus shader texture-lookup comparisons, cache
  interpolation error bounds, selected pixel/ray diagnostics across known
  observer positions, image diff summaries with numeric max/mean error, and
  same-config reproducibility checks.

The local flat-Sun model is not expected to have an objective real-world
reference target. Treat distant Sun behavior as the physical/reference
validation path; treat local flat-Sun behavior as internal consistency,
limiting-case, and implementation-parity validation.

## Suggested Implementation Shape

Start with a self-contained runner such as:

```text
node scripts/flat/atmosflat32/run.js --step=distant-source-abstraction-baseline
```

This direct Node command remains the default distant-source regression command.
The current local-source angular sky command is:

```text
node scripts/flat/atmosflat32/run.js --step=flat-app-rotation-skydomes
```

A watched command JSON can be added later if iteration becomes annoying, but it
is not needed to accept these milestones.

Use a small internal step registry with stable step ids, labels, and status
metadata. The runner should validate unknown `--step` values and print the
valid step ids. If `--step` is omitted and no numbered artifacts exist, default
to `distant-source-abstraction-baseline`; later omitted-step behavior can
follow the latest `state-goal.md` or `running-log.md`.

The first implementation can copy/factor the minimum needed Algorithm32 dome
generation code into `scripts/flat/atmosflat32/`. Keep the source adapter small
and explicit:

```js
createDistantDirectionalSunSource({
  sunDirection,
  spectralIrradianceByWavelength
})
```

Then route first-order and second-order scattering through the source sample
instead of reading a global `sunRay` directly. Preserve behavior first; cleanup
and module packaging can follow after acceptance.

## Future Milestones After Acceptance

After the accepted `019`/`018` state:

1. Add selected-pixel parity fixtures around the finite local-source interface.
2. Add convergence and limiting-case diagnostics for local source distance,
   falloff, black-source/zero-density behavior, and far-away-local-Sun
   behavior.
3. Define cache plans through `describeCachePlan()` for distant and local
   sources without forcing one texture layout.
4. Move first-order local-source behavior into shader parity.
5. Design and validate any local-source second-order cache only after the
   first-order CPU/shader path is stable.
