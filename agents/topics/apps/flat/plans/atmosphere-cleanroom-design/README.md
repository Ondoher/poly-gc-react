# Atmosphere Cleanroom Design

This folder is the documentation home for the new atmosphere reset design that
will supersede the rejected reference pipeline.

## Scope

- Incorporate the completed Bruneton start-fresh evidence lane into a new
  design rather than continuing numbered fresh-lane visual iterations by
  default.
- Treat step 032,
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`,
  as the current Figure 1 visual handoff candidate.
- Use `scripts/flat/experimental/bruneton-start-fresh.js` as the cleanroom
  experimental implementation record.
- Use `scripts/flat/atmosphere_rejected/` only for architecture comparison and
  integration mapping while it is temporarily retained for reference.

## Starting Status

Current task: execute the Algorithm32 shader iteration ladder. Iteration 1,
Browser Three Scene Baseline, is accepted. Agent-launched browser control is
rejected in this session, but the user manually ran the Puppeteer `--once`
harness and produced accepted artifact
`tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/` in
`629 ms`. The user also ran the persistent `--watch` harness; editing the
watched command file produced accepted reload artifact
`tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
Iteration 2 is accepted by `021-browser-ray-depth-diagnostics` and
`022-browser-ray-depth-diagnostics-comparison`. Iteration 3 is accepted by
`025-browser-atmosphere-components` and
`026-browser-atmosphere-components-shader-comparison`; browser JS atmosphere
components, Node recomputation, and WebGL2 diagnostic shader readback agree
for selected sky, object, and ground pixels. Iteration 4.1 is accepted by
`027-browser-direct-radiance` and
`028-browser-direct-radiance-comparison`; one-wavelength 532 nm first-order
selected-pixel radiance agrees across browser JS, independent Node
recomputation, and WebGL2 shader readback. Iteration 4.2 is accepted by
`030-browser-direct-radiance-spectral` and
`031-browser-direct-radiance-spectral-comparison`; all 15 Algorithm32
first-order spectral channels agree across browser JS, independent Node
recomputation, and WebGL2 shader readback for selected pixels. Iteration 5.1
is accepted by `032-browser-first-order-image`, proving full-image
first-order shader composition on the simple browser scene. Selected-pixel
second-order diagnostics are accepted in `041` through `045`, and full-image
second-order simple-scene parity is accepted by
`048-browser-second-order-image` against CPU Algorithm32 reference `037`.
Scene-input second-order parity is accepted by `051`, which feeds the shader
from a per-pixel browser JS Three Raycaster distance/spectrum texture, and
`053`, which feeds the shader from a GPU-rendered scene-input target through a
readback/upload bridge. `052` is rejected because the scene background was
incorrectly encoded as sky hits before the background-clear fix. Direct GPU
texture scene-input parity is accepted by `054`, which binds the Three render
target texture directly into the experimental atmosphere pass without
scene-input readback/upload for shader input.
Shader benchmark mode now exists as `browser-shader-benchmark`. Accepted smoke
artifact `tmp/atmosphere/algorithm32_shader_lab/067-browser-shader-benchmark/`
proves the mode can return structured timing diagnostics for the current
second-order GPU-direct scene-input atmosphere pass. The current Chromium
WebGL backend did not expose `EXT_disjoint_timer_query_webgl2`, so `067` does
not provide isolated GPU pass time. `069-browser-shader-benchmark` is only a
cautionary aggressive-batching artifact; benchmark defaults now use small
sample counts, yield between samples, and keep `gl.finish()` fallback timing
opt-in. Performance work is currently parked while the working discussion
moves to configurable flat-earth local Sun support. If performance resumes
later, use
`tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json`
from a dedicated user-owned browser/harness process or exact process
ownership. Do not clean up benchmark runs by killing generic `chrome`
processes.
The latest user-directed flat-earth visibility offshoot is accepted in
`tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/`.
It keeps the standard Algorithm32 atmosphere constants but uses flat-slab
geometry and first-order scattering to binary-search the nearest distance where
an object-present render no longer differs from the no-object render by more
than `1` encoded RGB value. With the recorded `10 km x 10 km` matte black
vertical card, `2 m` camera height, and `24 deg` vertical FOV, that distance is
`1,926.774 km`. `055` is rejected because the first bracketing run skipped the
configured max distance; `057` is rejected because a `100 km`-wide stress card
remained visible at the `3,000 km` cap, showing the result depends on physical
target dimensions and image resolution.
Visibility-loss milestones for the original target are accepted in
`tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/`.
The user clarified that `100%` means cannot see, so the requested milestones
are percent lost rather than percent retained. The accepted distances are
`50% lost = 21.480 km`, `75% lost = 601.563 km`, `80% lost = 776.563 km`,
`90% lost = 1,228.125 km`, `95% lost = 1,543.750 km`, and
`100% lost/cannot see = 1,926.774 km`. `059` is incomplete, `060` is
superseded because it did not serialize the milestone table into diagnostics,
and `061` is incomplete from a screenshot-label helper error.
High-resolution visual inspection of those milestone distances is accepted in
`tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/`;
use its native `canvas-image.png` for inspection. It supersedes `064`, whose
gallery content was laid out too small because of stale canvas dimensions.
Current subjective progress snapshots `049` and `050` render the mountain pair
through the current second-order shader path with CPU Algorithm32 reference
images beside them, but those comparisons are only for visual progress. The
next objective shader work is formalizing the production depth/material texture
contract or replacing the private-handle proof with a Three-owned composition
pass, unless the active branch is the new configurable flat-earth local Sun
work recorded in
[Production Flat Shader Differences](production-flat-shader-differences.md).

The reusable Algorithm32 module remains the end product of the cleanroom
"reference" effort, but the next practical work is shader validation. The
accepted spherical shader endpoint is still `054`; the flat-earth visibility
work is a documented experimental offshoot requested by the user, not a
replacement for the spherical shader endpoint. The current flat-production
design discussion targets a configurable local Sun whose latitude, altitude,
radius/size, and brightness/luminosity are explicit flat-model hypothesis
parameters, with time-of-day motion using a solar-day period by default.
Sidereal rotation remains the star-dome period or an explicit advanced option.
The environment-object color experiment is closed and should be treated as a
handoff proof, not an active artifact-generation lane.

Start here after context compaction or a fresh agent bootstrap:

1. [Environment Object Color Closeout](environment-object-color-closeout.md)
2. [Object Color Transport](object-color-transport.md)
3. [Experiment 032 Algorithm](experiment-032-algorithm.md)
4. [Reference To Shader Goal](reference-to-shader-goal.md)
5. [Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md)
6. [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md)
7. [Production Flat Shader Differences](production-flat-shader-differences.md),
   only when production flat-geometry shader support is in scope
8. [Algorithm32 Module Design](algorithm32-module-design.md), only when
   reusable module interface detail is needed
9. [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md),
   only when closed artifact detail is needed
10. [Environment Experiment Run Shape](environment-experiment-run-shape.md),
   only when closed artifact detail is needed
11. [Objective Success Criteria](objective-success-criteria.md), only when
    closed criterion detail is needed
12. [Object Transport Experiment Plan](object-transport-experiment-plan.md),
    only when historical experiment planning detail is needed
13. [Environment Object Color Prompt](environment-object-color-prompt.md), only
    when historical implementation-prompt detail is needed

Implementation state:

- `scripts/flat/algorithm32-shader-lab/` exists as an experimental shader-lab
  workbench. The earlier Puppeteer smoke artifact validated a browser reload
  loop, and `018-browser-three-baseline` validates the browser baseline when
  the user launches the harness manually. `020-browser-three-baseline-watch-reload-check`
  validates command-file reloads through the persistent watch loop.
  Agent-launched browser starts remain unreliable in this session.
  `node-three-reference.js` validates the first Node/Three CPU
  reference path: Three camera rays and Raycaster hits can drive Algorithm32
  sky/object spectral transfer packets without Chromium. The accepted artifact
  is
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  with `11` passing criteria, `0` failing, and `0` unresolved. It is not
  production code and does not require unit tests. See
  [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md).
- The immediate shader iteration plan is
  [Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md).
  Its current next iteration is real Three scene-input integration for the
  browser atmosphere pass. The first useful browser baseline artifact is
  accepted as `018`, watch-mode reload is
  accepted as `020`, browser ray/depth parity is accepted as `022`, and
  atmosphere-component plus WebGL2 diagnostic shader parity is accepted as
  `026`. One-wavelength first-order direct radiance is accepted as `028`, and
  15-channel first-order selected-pixel spectral radiance is accepted as `031`.
  Full-image first-order shader composition is accepted as `032`; the objective
  full Algorithm32 pairing `038` shows the expected missing second-order gap
  against CPU reference `037`, while first-order isolation pairing `040` shows
  the browser shader is first-order-correct against CPU first-order reference
  `039`. Selected-pixel second-order diagnostics are accepted in `041` through
  `045`, full-image second-order simple-scene parity is accepted as `048`, JS
  Raycaster scene-input parity is accepted as `051`, GPU scene-input parity is
  accepted as `053`, and direct GPU texture scene-input parity is accepted as
  `054`.
  Current subjective mountain shader progress snapshots with Algorithm32
  references are accepted as `049` and `050` for progress visibility only. Use
  the user-owned watch loop for further browser runs.
- The current optional subjective shader-lab mountain scene is
  `tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/`.
  It uses `node-three-reference.js --scene mountain-ridges` with procedural
  layered ridges and a valley floor through the same Three raycast plus
  Algorithm32 sky/object transfer path. It intentionally has `0` formal
  criteria because it is a visual composition target; `007` through `011` are
  superseded mountain-layout iterations.
- The alternate mountain view requested with the sunset behind the camera is
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`.
  It uses `--mountain-view sunset-behind-camera`, the low-Sun
  `figure1-06h00-z87` case, and the same subjective `0`-criteria policy.
- The current shader-path subjective mountain progress snapshots are
  `tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/050-browser-mountain-second-order-sunset-behind-camera/`.
  Each contains `side-by-side.png` for human progress review only. The CPU
  Algorithm32 references are `033` and `034`; the shader side uses the current
  second-order browser shader path with analytic procedural mountain
  intersections.
- `scripts/flat/atmosphere-environment/run.js` exists and owns the current
  self-contained experiment runner.
- `tmp/atmosphere/cleanroom_environment/` contains the current numbered
  artifact history and append-only `running-log.md`.
- `001-transfer-baseline` and `002-transfer-convergence` are rejected
  diagnostics. They exposed a segment-composition diagnostic bug: the full
  segment and two half segments used different quadrature partitions.
- `003-transfer-baseline` is accepted after the diagnostic fix, but its
  original `20/10/17/24` numerical controls did not meet the `5x`
  convergence-margin gate.
- `004-transfer-convergence` is rejected because the original baseline's
  minimum effect-to-convergence margin was `3.0292958740138496`.
- `005-transfer-refined-baseline` is the accepted current refined baseline
  using `40/20/34/48` numerical controls.
- `006-transfer-refined-convergence` is the accepted final convergence proof
  using `80/40/68/96` controls against `005`, with `15` passing criteria, `0`
  failing, `0` unresolved, and minimum convergence margin
  `6.4074899093834174`.
- `007-lambertian-surface-lighting` is a partial crash artifact caused by a
  report-writing bug after criteria generation.
- `008-lambertian-surface-lighting`, `009-local-sun-follow-up`, and
  `010-flat-long-sightline-follow-up` are accepted but superseded by cleaner
  final report reruns.
- `011-lambertian-surface-lighting` is the accepted final Lambertian
  surface-lighting proof with `8` passing criteria, `0` failing, `0`
  unresolved.
- `012-local-sun-follow-up` is the accepted final local finite-source proof
  with `8` passing criteria, `0` failing, `0` unresolved.
- `013-flat-long-sightline-follow-up` is the accepted final flat long-line-of-
  sight proof with `9` passing criteria, `0` failing, `0` unresolved.
- `014-scene-gallery` through `017-scene-gallery` are accepted but superseded
  scene-display iterations. `014` proved image generation but used a
  non-algorithmic illustrative sky; `015` and later moved the sky and
  ground-atmosphere context to cleanroom spectral atmosphere sampling; `017`
  still clustered the distance cards too tightly.
- `018-scene-gallery` is an accepted perspective scene-output proof with `6`
  passing criteria, `0` failing, `0` unresolved; it is superseded by `019` for
  the requested source-color selection.
- `019-scene-gallery` is an accepted source-colored scene-output proof with
  `7` passing criteria, `0` failing, `0` unresolved; it is superseded by the
  multicolor scene-display request.
- `020-scene-gallery` is an accepted multicolor scene-output proof with `7`
  passing criteria, `0` failing, `0` unresolved; it is superseded by `021`
  because the first multicolor layout read more like adjacent front cards than
  separated object sets.
- `021-scene-gallery` is an accepted multicolor scene-output proof with `7`
  passing criteria, `0` failing, `0` unresolved; it is superseded by the green
  spectrum correction because the previous broad green peak displayed
  yellow-green/yellow.
- `022-transfer-refined-baseline` is an accepted green-spectrum replacement
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum, from
  the previous yellow-green broad peak to a 532 nm display-green stress peak.
- `023-transfer-refined-convergence` is an accepted green-corrected transfer
  convergence proof with `15` passing criteria, `0` failing, `0` unresolved;
  it is superseded by the foreground-olive green request.
- `024-lambertian-surface-lighting` is the accepted green-corrected Lambertian
  proof with `8` passing criteria, `0` failing, `0` unresolved.
- `025-local-sun-follow-up` is the accepted green-corrected local finite-source
  proof with `8` passing criteria, `0` failing, `0` unresolved.
- `026-flat-long-sightline-follow-up` is the accepted green-corrected flat
  long-line-of-sight proof with `9` passing criteria, `0` failing, `0`
  unresolved.
- `027-scene-gallery` is an accepted green-corrected multicolor scene-output
  proof with `7` passing criteria, `0` failing, `0` unresolved; it is
  superseded by the foreground-olive green request.
- `028-transfer-refined-baseline` is an accepted foreground-olive green
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum to a
  user-directed muted foreground color target, encoded as `79/96/32` before
  atmosphere in the display preview.
- `029-transfer-refined-convergence` is an accepted foreground-olive transfer
  convergence proof with `15` passing criteria, `0` failing, `0` unresolved;
  it is superseded by the lower-right forest-green request.
- `030-lambertian-surface-lighting` is the accepted foreground-olive
  Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
- `031-local-sun-follow-up` is the accepted foreground-olive local
  finite-source proof with `8` passing criteria, `0` failing, `0` unresolved.
- `032-flat-long-sightline-follow-up` is the accepted foreground-olive flat
  long-line-of-sight proof with `9` passing criteria, `0` failing, `0`
  unresolved.
- `033-scene-gallery` is an accepted foreground-olive multicolor
  scene-output proof with `7` passing criteria, `0` failing, `0` unresolved.
  It is superseded by the lower-right forest-green request.
- `034-transfer-refined-baseline` is an accepted lower-right forest-green
  baseline with `14` passing criteria, `0` failing, `1` unresolved convergence
  criterion. It changes only the algorithmic synthetic green spectrum to a
  user-directed dark forest color target from the lower-right foliage
  reference, encoded as `30/58/32` before atmosphere in the display preview.
- `035-transfer-refined-convergence` is the accepted final lower-right
  forest-green transfer convergence proof with `15` passing criteria, `0`
  failing, `0` unresolved.
- `036-lambertian-surface-lighting` is the accepted lower-right forest-green
  Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
- `037-local-sun-follow-up` is the accepted lower-right forest-green local
  finite-source proof with `8` passing criteria, `0` failing, `0` unresolved.
- `038-flat-long-sightline-follow-up` is the accepted lower-right
  forest-green flat long-line-of-sight proof with `9` passing criteria, `0`
  failing, `0` unresolved.
- `039-scene-gallery` is an accepted lower-right forest-green
  multicolor scene-output proof with `7` passing criteria, `0` failing, `0`
  unresolved; it is superseded by `040` for the 8 px scene-background sampling
  request.
- `040-scene-gallery` is the accepted final high-resolution scene-output proof
  with `7` passing criteria, `0` failing, `0` unresolved. It reads accepted
  artifacts `035`, `036`, `037`, and `038`; changes only the algorithmic scene
  preview sky/ground block sampling from `24 px` to `8 px`; samples `11040`
  sky blocks and `21600` ground-atmosphere blocks; renders red, blue, and dark
  forest-green recorded object-spectrum stacks in each scene/source view; and
  generates `scene-preview-transfer.png`, `scene-preview-lambertian.png`,
  `scene-preview-local-sun.png`, `scene-preview-flat-long-sightline.png`, and
  `scene-gallery.png`.
- The successful refined baseline uses `84` primary transfer cases: `2` Sun
  cases, `7` distances, and `6` synthetic object spectra.
- Artifact numbering is append-only. Use `max(existing NNN) + 1`; never
  overwrite a numbered folder.
- Every artifact must include `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`, `transfer-cases.json`,
  `criteria-results.json`, `report.md`, `contact-sheet.png`, `run.log`, and
  a script snapshot or script-snapshot folder.
- The full experiment state goal has been reached, including generated scenes
  for every phase. Do not continue generating numbered experiment artifacts
  unless the user explicitly asks for a new diagnostic.

Use only `scripts/flat/experimental/bruneton-start-fresh.js` as the local
code/CLI guide. Do not load older Flat atmosphere docs, rejected pipeline code,
or previous skydome logs unless the user explicitly asks for source-audit or
architecture-comparison work.

## Endpoint Principle

The cleanroom transport pipeline should end at spectral radiance, not display
RGB. The canonical physical output should include the wavelength grid,
final spectral radiance by wavelength, and component diagnostics such as
in-scattered sky radiance, optional separated direct solar-disc radiance,
surface radiance, and higher-order scattering terms when enabled.

CIE XYZ conversion, linear RGB conversion, exposure, the Bruneton Figure 1
`k` tone-map, white balance, PNG writing, and report swatches are post-pipeline
consumer choices. They may be provided as reusable caller APIs, but they should
not feed back into transport stages or become the physical endpoint.

This fits the step 032 evidence: the comparison image is produced by taking
spectral sky radiance through CIE/linear-sRGB and then applying Bruneton's
source-backed Figure 1 display scalar `k = 1 / (5 * 683)`. That `k` belongs to
the comparison/display layer, not the atmospheric transport result.

## Architecture Shape

A literal calculation pipeline is still valid at the major contract boundaries,
but the rejected design's one-stage-per-calculation shape should not be copied
as the core architecture.

Use a coarse transport pipeline:

1. Validate and canonicalize the scene, source, geometry, spectral grid, and
   numerical controls.
2. Resolve the camera ray's atmosphere/surface path.
3. Solve spectral transport for that ray or pixel batch.
4. Return a spectral radiance packet plus diagnostics.
5. Let post-pipeline consumers perform colorimetry, display mapping, reporting,
   and image writing.

Inside the transport solver, use small source-backed kernels rather than packet
stages for every formula: density profiles, extinction/scattering coefficients,
phase functions, optical-depth integration, Beer-Lambert transmittance,
single-scattering accumulation, second-order incident-radiance lookup, and
optional surface/boundary radiance. These kernels should be pure and directly
testable, but they can be composed inside loops, caches, and iterative
radiance-field solvers where the physics requires coupling.

This shape better matches the cleanroom evidence. Step 032's important
transport behavior is not a flat left-to-right list of independent operations;
it includes a primary camera-ray integral plus a full-sphere second-order
incident-radiance approximation. Forcing that into many append-only packet
stages would either duplicate facts, expose implementation caches as public
contract, or hide the real solver inside one nominal stage anyway.

Keep the rejected pipeline's useful lessons: explicit units, immutable inputs,
single ownership of canonical facts, named diagnostics, and a clear public
spectral endpoint. Drop the rigid requirement that each physical subcalculation
must be its own public pipeline stage.

## Reference To Shader Goal

The cleanroom reference project is a means to the production atmosphere shader,
not the final renderer. Its job is to provide source-backed spectral transport
results, diagnostics, cache-builder contracts, and parity artifacts that let a
shader use cheaper runtime forms without losing the physical contract.

The end product of what this work has called the reference is the reusable
Algorithm32 module: direct trace APIs, cache-builder APIs, profile/preset data,
and shader parity fixtures. A script runner, report generator, or PNG gallery
can consume that module, but it is not the durable product by itself.

The production shader may use precomputed textures, reduced channel counts,
depth-buffer aerial perspective, lower resolution passes, and configuration
caches. Those approximations must be documented and compared against the
reference rather than hidden as display or tint adjustments.

If Flat must rebuild source-dependent textures from an application
configuration dialog, experiment 032 logic may need to be promoted into
application-reachable code. Promote reusable source-backed transport kernels
and cache-builder contracts rather than copying the experimental script
wholesale.

See [Reference To Shader Goal](reference-to-shader-goal.md) for the end-state
contract, cache strategy, flat/local-Sun rebuild expectations, and future cloud
insertion point.

See [Algorithm32 Module Design](algorithm32-module-design.md) for the reusable
module boundary and draft interfaces for direct traces, object transfer,
cache building, app presets, and shader parity.

## Object Color Requirement

The production design must treat object color transport as first-class, not as
a side effect of sky rendering. A sky dome is the no-surface case. A visible
object requires finite-segment aerial perspective:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

The atmosphere solver owns `T_view(lambda)` and `L_path(lambda)`. The caller or
surface subsystem owns `L_object(lambda)`. See
[Object Color Transport](object-color-transport.md) for the API shape,
spectral/RGB boundary, and test requirements.

The finite-object contract has been proven in the separate experimental lane.
See [Environment Object Color Closeout](environment-object-color-closeout.md)
for the final artifacts, results, and production carry-forward notes. The
original experiment plan remains in
[Object Transport Experiment Plan](object-transport-experiment-plan.md) and
[Environment Object Color Prompt](environment-object-color-prompt.md). The
objective pass/fail criteria live in
[Objective Success Criteria](objective-success-criteria.md).

## Source Boundary

External papers, standards, datasets, and third-party source code are the
authority for equations, constants, approximations, display policy, expected
colors, and visual targets. Already-downloaded external files are allowed only
when read and cited directly as external primary material.

Previous local project code, older local documentation, rejected reference
pipeline code, previous local artifacts, and local summaries of external
sources are not authority for physics, color, sampling, display constants, or
target appearance.

## Current Design Inputs

- Step 032 uses no ground coupling, no direct solar-disc camera term, no ozone,
  Bruneton 2016 aerosol constants, 15-sample CIE conversion, full-sphere
  Fibonacci second-order scattering, and `k = 1 / (5 * 683)`.
- [Experiment 032 Algorithm](experiment-032-algorithm.md) records the step 032
  algorithm, equations, active constants, inactive script-carried constants,
  external references, and algorithmic choices.
- [Object Color Transport](object-color-transport.md) records the finite-ray
  object/aerial-perspective contract needed to make the atmosphere useful for
  environment objects, not only sky color.
- [Environment Object Color Closeout](environment-object-color-closeout.md)
  records the accepted final artifacts, validated criteria, unchanged
  atmosphere-equation boundary, production carry-forward contracts, and
  experimental caveats from the object-color lane.
- [Reference To Shader Goal](reference-to-shader-goal.md) records that the
  reference project's end goal is to enable the production atmosphere shader,
  including cache-builder contracts, shader parity, flat/local-Sun rebuild
  behavior, and future cloud insertion.
- [Algorithm32 Module Design](algorithm32-module-design.md) records the working
  interface design for packaging Algorithm32 as reusable code for direct
  reference traces, app cache rebuilds, atmosphere presets, and shader
  validation.
- [Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md) records how the
  experimental Puppeteer/Three harness should build from browser-control smoke
  tests to Node/Three CPU Algorithm32 reference images and shader parity runs.
- [Production Flat Shader Differences](production-flat-shader-differences.md)
  records the concrete production shader changes needed for flat geometry:
  altitude, boundaries, optical-length path geometry, Sun transmittance, cache
  coordinates, diagnostics, and validation.
- [Object Transport Experiment Plan](object-transport-experiment-plan.md)
  records the closed experimental lane that proved finite-segment object
  transfer before generating the production pipeline.
- [Environment Object Color Prompt](environment-object-color-prompt.md) is the
  closed implementation prompt for the environment-object color proof under
  `scripts/flat/atmosphere-environment/`, with outputs under
  `tmp/atmosphere/cleanroom_environment/`.
- [Objective Success Criteria](objective-success-criteria.md) defines the
  reference-backed transport identities, objective demonstration checks,
  convergence policy, display-only review checks, and follow-up experiment
  criteria for local-Sun and flat-Earth long-line-of-sight variants.
- [Environment Experiment Run Shape](environment-experiment-run-shape.md)
  defines the proposed run sequence, resolved inputs, artifact outputs, and
  minimal 3D ray-test environment for the cleanroom object-color experiments.
  It also defines the self-guided iteration contract: numbered artifacts should
  continue through verification and documentation until a state goal is
  reached, a dead end is documented, or the user interrupts.
- [Environment Experiment Preflight Spec](environment-experiment-preflight-spec.md)
  locks the first-run decisions: use all active experiment 032 constants and
  assumptions, include the Bruneton Figure 1 sunrise/sunset and highest-Sun
  cases, use algorithmic stress spectra/distances/target placement, include
  the `84`-case baseline matrix, fixed unit conventions, append-only artifact
  numbering, explicit criterion statuses, audit-trail references in inputs and
  outputs, use the cleanroom script's `--step=<step-id>` CLI pattern as the
  local CLI guide, and update the root running log for every numbered
  iteration.
- Step 031 remains the prior fitted-k four-row artifact.
- Step 029 remains the prior simplified fitted-k anchor.
- Step 030 remains direct-ground equivalence evidence.

Future docs in this folder should define the reset architecture, stage
contracts, source-backed constants, display policy, cache-builder contracts,
shader parity checks, and the handoff path from the experimental script into
production shader code.
