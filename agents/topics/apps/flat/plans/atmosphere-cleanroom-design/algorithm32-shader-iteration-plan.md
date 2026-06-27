# Algorithm32 Shader Iteration Plan

This is the immediate continuation plan for the Algorithm32 shader lab. It
turns the current reference work into a sequence of resumable iterations that
can survive context compaction and fresh-agent bootstrap.

## Current State

The subjective scene lane has produced progress snapshots, but it remains
separate from objective shader validation. The current visual reference
artifacts are:

- `tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/`
  for layered mountain aerial perspective under the high-Sun case.
- `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`
  for the same mountain layout with the low-Sun case behind the camera.
- `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`
  for the latest CPU-only forward high-Sun rerun.
- `tmp/atmosphere/algorithm32_shader_lab/033-mountain-ridges-algorithm32-front-high-sun/`
  and `034-mountain-ridges-algorithm32-sunset-behind-camera/` for the current
  CPU Algorithm32 reference images used beside shader progress snapshots.
- `tmp/atmosphere/algorithm32_shader_lab/035-browser-mountain-shader-front-high-sun/`
  and `036-browser-mountain-shader-sunset-behind-camera/` for older browser
  first-order shader images.
- `tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/`
  and `050-browser-mountain-second-order-sunset-behind-camera/` for the
  current browser second-order shader progress images. Each contains
  `side-by-side.png` with the CPU Algorithm32 reference on the left and the
  browser shader image on the right.

These scenes are subjective only. They have `0` formal criteria by design and
should not be used as shader pass/fail gates. The user clarified that these
comparisons are only for seeing progress; continue the objective shader ladder
instead of tuning subjective mountain appearance. Do not generate more CPU-only
subjective scene reruns unless the user explicitly asks.

The objective foundation is:

- `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  proves Node/Three camera rays and Raycaster hits can drive CPU Algorithm32
  sky/object transfer.
- `scripts/flat/algorithm32-shader-lab/node-three-reference.js` is the current
  CPU reference runner.
- `scripts/flat/algorithm32-shader-lab/harness.js` is the Puppeteer harness
  for a long-running browser session.

Current browser-control status:

- The Puppeteer harness branch hung before creating a numbered browser baseline
  artifact when launched by the agent.
- A bounded Karma fallback runner was added, but the two recorded attempts are
  rejected:
  `tmp/atmosphere/algorithm32_shader_lab/014-browser-three-baseline-karma/`
  failed with sandbox `spawn EPERM`, and
  `tmp/atmosphere/algorithm32_shader_lab/015-browser-three-baseline-karma/`
  exceeded the 45 second outer timeout after browser-launch permission without
  returning any browser result.
- The user manually ran the Puppeteer `--once` command outside the agent tool
  path and produced accepted artifact
  `tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/` with no
  page errors and `629 ms` harness duration.
- Artifact `018` supersedes `017`: after the projected card-center sample fix,
  the selected pixels hit sky, near-red-card, middle-green-card, far-blue-card,
  and ground, with finite ray/hit diagnostics for object and ground samples.
- The user also ran `harness.js --watch` against
  `tmp/atmosphere/algorithm32_shader_lab/browser-three-baseline-command.json`.
  Editing that command file produced accepted artifact
  `tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
  The result command id matched the edited command, pageLoadCount advanced to
  `3`, and the selected-pixel diagnostics remained stable. This is the durable
  proof that the persistent-runner reload loop works when the user owns browser
  launch.
- Iteration 2 is accepted. Browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/021-browser-ray-depth-diagnostics/`
  was produced through the user-owned watch loop. Comparison artifact
  `tmp/atmosphere/algorithm32_shader_lab/022-browser-ray-depth-diagnostics-comparison/`
  independently rebuilt the same scene in Node/Three and passed `7` criteria:
  browser artifact accepted, selected sample count, classification/hit object
  parity, ray origin parity, ray direction parity, finite hit distance parity,
  and projected card sample pixels. The measured max ray-origin delta, max
  ray-direction angle, and max finite-hit-distance delta were all `0`.
- Iteration 3 is accepted. Browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/025-browser-atmosphere-components/`
  was produced through the user-owned watch loop after adding selected-pixel
  atmosphere-component diagnostics and a WebGL2 diagnostic shader readback.
  Comparison artifact
  `tmp/atmosphere/algorithm32_shader_lab/026-browser-atmosphere-components-shader-comparison/`
  passed `10` criteria: browser artifact accepted, component coverage,
  transmittance bounds, optical-length parity, optical-depth parity,
  transmittance parity, distance-response trend, shader diagnostic availability,
  shader optical-length parity, and shader transmittance parity. Browser JS and
  Node atmosphere components matched with max transmittance delta
  `1.1102230246251565e-16`; the WebGL2 shader readback matched the browser JS
  component packet with max shader transmittance delta
  `0.000007160129086525302`, max Rayleigh optical-length delta
  `0.09760416687277029 m`, max Mie optical-length delta
  `0.3095960991740867 m`, and max path-distance delta
  `0.0080527039244771 m`.
- Iteration 4.1 is accepted as a first direct-radiance substep, not the final
  Algorithm32 shader. Browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/027-browser-direct-radiance/`
  returned selected-pixel first-order Rayleigh, Mie, path, object-transmitted,
  and final radiance at the 532.333333333333 nm diagnostic wavelength, plus
  WebGL2 shader readback. Comparison artifact
  `tmp/atmosphere/algorithm32_shader_lab/028-browser-direct-radiance-comparison/`
  passed `10` criteria with `0` failures and `0` unresolved. Browser JS and
  independent Node recomputation matched with max path and final radiance delta
  `0`; WebGL2 shader readback matched browser JS with max path and final
  radiance delta `2.0880918986942998e-7`. The artifact explicitly labels the
  deferred limitations: one wavelength only, first-order single scattering
  only, no second-order Algorithm32 approximation, and no full spectral
  CIE/display conversion.
- Iteration 4.2 is accepted as the full-spectral first-order selected-pixel
  substep. Browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/030-browser-direct-radiance-spectral/`
  returned first-order spectral radiance for 5 selected sky/object/ground
  pixels x 15 Algorithm32 wavelengths, plus WebGL2 shader readback. Comparison
  artifact
  `tmp/atmosphere/algorithm32_shader_lab/031-browser-direct-radiance-spectral-comparison/`
  passed `9` criteria with `0` failures and `0` unresolved. Browser JS and
  independent Node recomputation matched with max path radiance delta
  `3.469446951953614e-18` and max final radiance delta
  `1.3877787807814457e-17`; WebGL2 shader readback matched browser JS with max
  path radiance delta `6.091299753485657e-7` and max final radiance delta
  `9.326382049076876e-7`.
- Iteration 5.1 is accepted as the first full-image first-order shader pass.
  Browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/032-browser-first-order-image/`
  rendered the simple browser scene through the 15-channel first-order shader,
  and selected display pixels matched the browser JS spectral preview.
- Objective full-image comparison is accepted as a diagnostic split. CPU full
  Algorithm32 reference artifact
  `tmp/atmosphere/algorithm32_shader_lab/037-algorithm32-simple-card-reference/`
  paired with browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/038-browser-first-order-image-objective-simple-scene/`
  produces `algorithm32-reference-image.png`, `shader-image.png`,
  `side-by-side.png`, `diff-image.png`, and
  `shader-reference-comparison.json`. Its display-space summary is
  `maxAbsRgbDelta = 38`, `meanAbsRgbDelta = 11.354444444444445`,
  `p95PixelMaxAbsRgbDelta = 33`, and `p99PixelMaxAbsRgbDelta = 35`; the
  comparison metadata identifies the missing browser second-order contribution
  as the known solver difference.
- First-order isolation is accepted. CPU first-order reference artifact
  `tmp/atmosphere/algorithm32_shader_lab/039-algorithm32-first-order-simple-card-reference/`
  paired with browser artifact
  `tmp/atmosphere/algorithm32_shader_lab/040-browser-first-order-image-first-order-isolation/`
  produces the same side-by-side output shape. Its display-space summary is
  `maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0015277777777777779`,
  `p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`, proving the
  current full-image shader is first-order-correct and that the remaining
  objective Algorithm32 gap is the second-order approximation.
- Second-order selected-pixel parity is accepted. Browser artifacts
  `041-browser-second-order-diagnostics` and
  `044-browser-second-order-spectral-diagnostics`, plus comparison artifacts
  `042-browser-second-order-radiance-comparison` and
  `045-browser-second-order-spectral-radiance-comparison`, prove the
  Algorithm32 second-order approximation in WebGL2 selected-pixel diagnostics.
  The spectral run uses a precomputed incident-sky texture shaped as
  `15 x (17 * 24)` for wavelength, incoming direction, and altitude bins.
- Full-image second-order simple-scene parity is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/048-browser-second-order-image/`.
  It renders the analytic simple card scene through the 15-channel Algorithm32
  shader with the second-order approximation enabled. Selected display pixels
  match CPU Algorithm32 exactly at encoded RGB (`maxSelectedRgbDelta = 0`).
  Its side-by-side pairing against CPU Algorithm32 reference `037` records
  `maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0017824074074074075`,
  `p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`.
- Scene-input second-order parity is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/051-browser-scene-input-second-order-image/`.
  It removes shader-local analytic object intersections for the simple scene:
  browser JS builds a per-pixel Three Raycaster texture containing object
  distance, numeric spectrum id, and hit flag, and the atmosphere shader reads
  that texture. Selected display pixels match CPU Algorithm32 exactly
  (`maxSelectedRgbDelta = 0`), and the side-by-side pairing against `037`
  records the same near-exact image diff as `048`.
- GPU scene-input second-order parity is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/053-browser-gpu-scene-input-second-order-image/`.
  It renders a float Three GPU scene-input target with fragment distance,
  numeric spectrum id, and hit flag, then reads that target back for upload
  into the experimental raw WebGL atmosphere pass. Artifact `052` is rejected
  because the scene background was incorrectly written into sky pixels as a
  hit; `053` fixes this by disabling `scene.background` during the scene-input
  pass. Selected display pixels match within `1` encoded RGB. The image diff
  against `037` is `maxAbsRgbDelta = 182`, `meanAbsRgbDelta =
  0.8947337962962963`, `p95PixelMaxAbsRgbDelta = 4`, and
  `p99PixelMaxAbsRgbDelta = 21`; this is classified as edge/rasterization
  placement difference rather than radiance drift.
- Direct GPU scene-input second-order parity is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image/`.
  It uses the same GPU render target as `053` but binds the Three WebGL texture
  directly into the experimental raw WebGL atmosphere pass through a private
  Three texture handle; no scene-input readback/upload is used for shader
  input. Selected display pixels match within `1` encoded RGB, and the image
  diff against `037` matches `053`.
- Flat-earth visibility-search offshoot is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/`.
  It keeps the standard Algorithm32 Rayleigh/Mie constants and display bridge,
  replaces the spherical shell with flat-slab geometry, and searches for the
  closest distance where an object-present render no longer differs from the
  no-object render beyond `1` encoded RGB value. With the recorded `10 km x
  10 km` matte black vertical card, `2 m` camera height, `24 deg` vertical
  FOV, `180 x 90` search resolution, and first-order scattering only, the
  threshold is `1,926.774 km`. At that threshold the object still covers `2`
  search pixels; zero-pixel disappearance occurs later in the validation
  sweep. `055` is rejected because the first bracketing logic skipped the max
  distance. `057` is rejected because a `100 km`-wide stress card remained
  visible at the `3,000 km` cap, so physical target size and image resolution
  must be part of any future claim. `058` reruns the same wide-target case with
  diagnostic `Diff x24` and `Object mask` panels because the normal RGB
  composite makes the remaining object pixels difficult to see by eye.
  Visibility-loss milestones are accepted in
  `tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/`.
  The user clarified that the requested percentages are inverse visibility:
  `100%` means cannot see, while `95%` means `5%` visible. With the same
  `10 km x 10 km` target, the accepted distances are `50% lost = 21.480 km`,
  `75% lost = 601.563 km`, `80% lost = 776.563 km`, `90% lost =
  1,228.125 km`, `95% lost = 1,543.750 km`, and `100% lost/cannot see =
  1,926.774 km`. `059` is an incomplete over-expensive watch run, `060` is
  superseded because it did not serialize the milestone table into diagnostics,
  and `061` is an incomplete run from a screenshot-label helper error.
  High-resolution visual inspection of each milestone is accepted in
  `tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/`.
  Use `canvas-image.png`, not the viewport screenshot, because it preserves the
  native `2200 x 2000` gallery with full-scene, zoomed-normal, amplified-diff,
  and object-mask panels for each percentage. `064` is superseded because the
  first gallery laid out its content using stale canvas dimensions.
- Subjective progress artifacts `033` through `036` show the mountain pair
  through the current shader path with Algorithm32 reference images included.
  These are not objective acceptance gates. They explicitly compare the older
  first-order shader against the CPU Algorithm32 reference path, which includes
  the current second-order approximation.
- Subjective progress artifacts `049` and `050` rerender the same mountain
  pair through the current second-order browser shader path. They are accepted
  visual progress artifacts only. The front high-Sun pairing `049` records
  display-space `maxAbsRgbDelta = 53`, `meanAbsRgbDelta =
  0.012150205761316873`, `p95PixelMaxAbsRgbDelta = 0`, and
  `p99PixelMaxAbsRgbDelta = 0`; the sunset-behind-camera pairing `050` records
  `maxAbsRgbDelta = 27`, `meanAbsRgbDelta = 0.0033024691358024692`,
  `p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`. These
  numeric summaries are edge/sample-placement diagnostics for visual review,
  not objective shader acceptance gates.

## Immediate State Goal

Build the browser shader path in iterations until a fixed spherical,
distant-Sun Algorithm32 atmosphere shader can be compared against the CPU
Algorithm32 reference on the same Three-defined scenes.

The fixed spherical shader endpoint is currently accepted at `054`. The
flat-earth visibility run in `056` is a user-requested experimental offshoot,
not a replacement for the spherical endpoint. The immediate redirected work is
to integrate an Algorithm32 source/geometry contract into the shader-lab CPU
renderer first, prove the default spherical distant-Sun output is unchanged,
and only then carry that contract toward shader-side source packing. Local Sun
behavior, changing Sun configuration, app texture rebuilds, clouds, and
production integration remain later model and product layers unless the user
explicitly redirects to one of them.

## Iteration Contract

Each iteration should be independently resumable.

Every iteration should:

1. State the specific goal before changing code.
2. Reuse the existing shader-lab folder and artifact root:
   `scripts/flat/algorithm32-shader-lab/` and
   `tmp/atmosphere/algorithm32_shader_lab/`.
3. Create a new append-only numbered artifact folder; never overwrite a prior
   numbered run.
4. Write enough structured output for the next agent to continue without
   guessing: command/config, result status, screenshots or images,
   diagnostics, console/errors, timings when available, and a short report.
5. Keep objective parity criteria separate from subjective scene review.
6. Update this plan, the shader-lab README, and the active topic status after
   any accepted milestone or dead end.

An iteration may stop only when:

- the iteration goal is accepted;
- a dead end is documented with the reason and the next feasible branch; or
- the user interrupts or redirects.

## Artifact Shape

Early iterations may omit files that do not exist yet, but the target shape is:

```text
tmp/atmosphere/algorithm32_shader_lab/NNN-<label>/
  command.json
  result.json
  report.md
  run.log
  screenshot.png
  reference-image.png
  shader-image.png
  diff-image.png
  selected-pixels.json
  diagnostics.json
  console.json
  timings.json
  script-snapshot.js or script-snapshot/
```

The artifact report should say which files are intentionally absent.

## Iteration Ladder

### 1. Browser Three Scene Baseline

Goal: render the same simple Three scenes in the browser without atmosphere.

Sub-goals:

- Create a browser-side scene definition that matches the CPU runner's camera
  conventions for a simple sky/floor or card scene.
- Capture scene color and depth or an equivalent object-hit/readback surface.
- Save screenshot, selected pixels, camera matrices, and scene metadata.
- Verify no WebGL or shader compile errors.

Acceptance:

- Browser artifact renders nonblank scene color.
- Selected-pixel ray/depth metadata is available for later comparison.
- No atmosphere shader is required yet.

### 2. Browser Ray And Depth Diagnostics

Goal: prove the browser pass can reconstruct the same per-pixel ray and
finite object distance that the CPU reference uses.

Sub-goals:

- Add a diagnostic shader or JS readback mode for world ray direction.
- Add depth-to-distance reconstruction for object pixels.
- Compare selected browser pixels with CPU reference selected pixels.
- Classify mismatches as camera matrix, depth encoding, coordinate mapping, or
  scene-definition errors.

Acceptance:

- Center and edge rays match the CPU/Three reference within a documented
  tolerance.
- Object distances match the CPU Raycaster reference for selected pixels.

### 3. Shader Diagnostic Atmosphere Components

Goal: add a browser atmosphere pass that outputs debuggable intermediate
quantities before attempting final color.

Status: accepted in `025-browser-atmosphere-components` and
`026-browser-atmosphere-components-shader-comparison`.

Sub-goals:

- Implement top-atmosphere intersection for sky pixels.
- Implement finite segment length for object pixels.
- Output diagnostic images or selected-pixel arrays for distance, altitude,
  optical depth, and transmittance.
- Compare selected-pixel transmittance with CPU Algorithm32.

Acceptance:

- Shader transmittance is finite and bounded in `[0, 1]`.
- Selected-pixel transmittance matches CPU reference closely enough to move to
  radiance debugging.

### 4. First Direct Shader Radiance

Goal: implement a slow, fixed-profile, fixed-Sun shader that approximates the
Algorithm32 radiance path directly enough for low-resolution parity tests.

Status: accepted through the current direct Algorithm32 shader path. Substep
4.1 is accepted in
`027-browser-direct-radiance` and
`028-browser-direct-radiance-comparison`: one-wavelength 532 nm first-order
selected-pixel radiance parity is proven. Substep 4.2 is accepted in
`030-browser-direct-radiance-spectral` and
`031-browser-direct-radiance-spectral-comparison`: 15-channel first-order
selected-pixel spectral radiance parity is proven. Full-image first-order
rendering is accepted in `032`. Objective image comparison is classified by
`038` and `040`. Selected-pixel second-order diagnostics are accepted in `041`
through `045`, and full-image second-order simple-scene parity is accepted in
`048`.

Sub-goals:

- Use the Algorithm32 baseline constants and assumptions:
  no ozone, no ground coupling, no direct solar-disc camera radiance, distant
  directional Sun, Bruneton 2016 aerosol constants, and display-only
  `k = 1 / (5 * 683)`.
- Start with first-order sky and finite-segment object path radiance.
- Add the simplest practical version of the second-order approximation only
  after first-order diagnostics are understood.
- Keep all simplifications labeled in artifact metadata.

Acceptance:

- Shader selected pixels reproduce CPU reference trends for sky and object
  pixels.
- Differences are reported by component, not hidden with display tuning.

### 5. Objective Image Parity On Simple Scenes

Goal: compare full low-resolution shader images against CPU reference images
for objective scenes.

Status: accepted for the analytic simple scene. `032-browser-first-order-image`
proves the simple scene can render as a full first-order shader image. `038`
compares that shader class against full CPU Algorithm32 reference `037` and
records the expected missing second-order gap. `040` compares against CPU
first-order reference `039` and shows near-exact first-order agreement. The
full second-order shader image artifact `048` now compares against CPU
Algorithm32 reference `037` with near-exact display-space agreement:
`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0017824074074074075`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`. Future shader
image artifacts should continue to include an Algorithm32 or explicitly
first-order reference image when practical. The subjective mountain pair in
`035` and `036` follows this packaging rule for visual progress only, but it
was generated before the full-image second-order shader and remains a
first-order progress snapshot.

Sub-goals:

- Run sky-only, floor, and card/object scenes through both CPU reference and
  shader path.
- Generate reference image, shader image, difference image, and numeric
  summaries.
- Keep comparisons before final display when possible; otherwise label the
  display-space comparison.

Acceptance:

- Objective scenes have documented error summaries and known failure classes.
- Any accepted tolerance is explicitly recorded as an experimental threshold,
  not a physics source.

### 6. First Optimization Branch

Goal: replace one expensive direct-shader piece with a documented
approximation.

Candidate branches:

- reduced wavelength/channel policy;
- precomputed transmittance lookup;
- precomputed path-radiance lookup;
- lower-resolution atmosphere pass with depth-aware upsampling.

Sub-goals:

- Change one approximation at a time.
- Compare optimized shader against both CPU reference and the prior direct
  shader artifact.
- Record performance and error movement.

Acceptance:

- The optimization has a named approximation policy and measured error.
- Regressions are classified before continuing.

### 7. Subjective Mountain Scene Review

Goal: use the existing mountain scenes only after objective simple-scene
mechanics are working.

Current note: initial shader-path progress snapshots are accepted in `035` and
`036`, each with a `side-by-side.png` pairing. The user clarified that these
comparisons are for seeing progress only; do not use them as objective shader
acceptance criteria. The current second-order progress snapshots are accepted
in `049` and `050`, each also with a `side-by-side.png` pairing.

Sub-goals:

- Render shader output for `012` and `013` scene definitions or their browser
  equivalents.
- Produce side-by-side CPU reference and shader preview images when possible.
- Record human visual notes separately from numeric parity.

Acceptance:

- The subjective scenes help decide whether the shader feels usable, but they
  do not approve or reject the physics path by themselves.

### 8. Algorithm32 Source Contract Integration

Goal: route the shader-lab CPU Algorithm32 renderer through a source/geometry
abstraction while proving the default spherical distant-Sun output remains
unchanged.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/071-cpu-source-contract-distant-sun/`.
The default spherical `distant-directional-sun` path now routes through the
source/geometry contract and preserves the accepted `037` CPU reference output:
`reference-image.png`, selected-pixel diagnostics, geometry diagnostics,
transport diagnostics, and original criteria all match exactly.

First artifact target:

```text
tmp/atmosphere/algorithm32_shader_lab/071-cpu-source-contract-distant-sun/
```

`070-browser-flat-earth-visibility-search` already existed, so `071` was used
as the append-only target.

Implementation direction:

- Keep the work inside `scripts/flat/algorithm32-shader-lab/` as POC lab code.
- Introduce a CPU-side model shape equivalent to:
  `createAlgorithm32Model({ geometry, source, spectralProfile, numericalConfig })`.
- Start with `spherical-atmosphere-geometry` and
  `distant-directional-sun` only.
- Use the accepted `037-algorithm32-simple-card-reference` scene as the
  baseline: default `three-card-reference`, `240 x 120`, render Sun case
  `figure1-13h15-z21`, and the same synthetic object spectra.
- Let the CPU scene renderer continue to own camera rays, Three Raycaster hit
  distances, material/spectrum ids, and artifact output.
- Let Algorithm32 own view-ray integration, altitude/density, source sampling
  at atmospheric sample points, source transmittance, first-order radiance, and
  the existing distant-Sun second-order approximation.
- For the first distant-Sun adapter, the source sample should be semantically
  identical to today's hard-coded path: constant direction, infinite source
  distance, incident scale `1`, current per-wavelength solar irradiance table,
  and the existing spherical top-atmosphere source-transmittance path.
- Adapt from `atmosflat32` only at the boundary level: source object shape,
  geometry configuration pattern, finite-source concepts for later milestones,
  and the principle that renderer-only sky caps stay outside Algorithm32.
- Do not copy the `atmosflat32` CLI/artifact runner, app-config plumbing,
  calibration/debug constants, or skydome-specific ray caps into the shader
  lab CPU renderer.

Acceptance:

- The CPU renderer uses a source object/configuration path for the default
  `distant-directional-sun`.
- The output scene uses the same spherical geometry, solar irradiance table,
  source direction, display bridge, and numerical constants as the accepted
  CPU Algorithm32 reference.
- The artifact compares against
  `tmp/atmosphere/algorithm32_shader_lab/037-algorithm32-simple-card-reference/`,
  including `reference-image.png`, `selected-pixels.json`,
  `transport-diagnostics.json`, and the accepted `11`-criterion result shape.
- Deltas are exactly zero where the migration is purely structural, or any
  tiny floating-point movement is explicitly reported and justified.
- No local Sun behavior, inverse-square falloff, flat geometry, or shader-side
  source packing is enabled in this first artifact.
- The report names the next CPU-only step: broader distant-Sun contract
  regression before any shader-side implementation.

### 9. CPU Distant-Sun Contract Regression Matrix

Goal: prove the source/geometry contract remains a no-op for the existing CPU
Algorithm32 distant-Sun use cases beyond the single `037` simple-card baseline.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/074-cpu-source-contract-distant-sun-matrix/`.
This is still CPU-only and did not touch browser shader code. The aggregate
matrix uses nested per-case run folders under its `cases/` directory; those
nested folders are supporting evidence for the single `074` experiment, not
top-level experiment replacements. Superseded notes: `072` is a partial
sandbox-spawn attempt, and `073` was rejected by an older comparison policy
that treated additive sunset diagnostic metadata as transport drift.

Artifact target label:

```text
cpu-source-contract-distant-sun-matrix
```

Use the next available append-only number under
`tmp/atmosphere/algorithm32_shader_lab/`.

Implementation entry point:

```text
scripts/flat/algorithm32-shader-lab/cpu-source-contract-regression-matrix.js
```

This runner writes one aggregate artifact folder with per-case summaries and
comparisons. It invokes shared `node-three-reference.js` code in-process rather
than spawning child Node processes, so the experiment loop runs without
per-command escalation.

Required matrix cases:

- `simple-card-algorithm32`: compare against
  `tmp/atmosphere/algorithm32_shader_lab/037-algorithm32-simple-card-reference/`.
  Equivalent seed command:
  `node scripts/flat/algorithm32-shader-lab/node-three-reference.js --width 240 --height 120 --label algorithm32-simple-card-reference`.
- `simple-card-first-order`: compare against
  `tmp/atmosphere/algorithm32_shader_lab/039-algorithm32-first-order-simple-card-reference/`.
  Equivalent seed command:
  `node scripts/flat/algorithm32-shader-lab/node-three-reference.js --width 240 --height 120 --label algorithm32-first-order-simple-card-reference --scattering-order first-order`.
- `sunset-floor-algorithm32`: compare against
  `tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/`.
  Equivalent seed command:
  `node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene sunset-floor --width 320 --height 180 --label sunset-floor`.

Optional visual-only case:

- `mountain-ridges-front-high-sun`: may compare against
  `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`,
  but it has `0` formal criteria and must not gate acceptance.

Implementation direction:

- Reuse the Milestone 8 source/geometry contract and
  `distant-directional-sun` adapter.
- Keep both first-order and current distant-Sun second-order behavior exactly
  where those modes already exist.
- Record a source-sample trace for selected pixels or selected view-ray sample
  points that shows the adapter still returns constant direction, infinite
  source distance, incident scale `1`, and the current spherical
  top-atmosphere transmittance policy.
- Required artifact files: `command.json`, `matrix-cases.json`,
  `source-sample-traces.json`, `comparison-summary.json`,
  `criteria-results.json`, `report.md`, `run.log`, and either copied
  per-case output files or explicit relative links to per-case run folders.

Acceptance:

- Existing CPU outputs and selected diagnostics remain unchanged for every
  included distant-Sun scene/mode, except for explicitly reported floating
  noise.
- For the required cases, compare stable content from `reference-image.png`,
  `selected-pixels.json`, `transport-diagnostics.json`,
  `geometry-diagnostics.json`, and `criteria-results.json`. Ignore creation
  timestamps and output-folder paths when comparing JSON.
- Exact PNG byte parity and exact selected diagnostic parity are expected for
  the structural no-op path. Any tolerance-based acceptance must name the
  field, tolerance, max delta, and reason.
- No local source, flat geometry, inverse-square falloff, shader source
  packing, or browser harness work is enabled.

### 10. CPU Local-Source First-Order Diagnostics

Goal: add a finite local-source adapter to the CPU Algorithm32 contract and
validate first-order scattering diagnostics without implementing any shader
path.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/075-cpu-local-source-first-order-diagnostics/`.
The required `0`, `90`, and `180` degree local-source offsets match accepted
`atmosflat32` artifact `018` for source direction, source distance,
distance-falloff scale, incident scale, spectral incident scale, and finite
source-path policy within the documented gates. Optional `45` and `135`
degree diagnostics are included but do not gate acceptance.

Artifact target label:

```text
cpu-local-source-first-order-diagnostics
```

Use the next available append-only number under
`tmp/atmosphere/algorithm32_shader_lab/`.

Primary POC reference:

```text
tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/
```

Use `018` for source configuration, source-sample expectations, brightness
calibration, and local first-order diagnostic shape. Do not use its skydome
renderer cap as scene-renderer or Algorithm32 transport logic.

Required local-source cases:

- `san-jose-000deg-closest`
- `san-jose-090deg-from-closest`
- `san-jose-180deg-from-closest`

Reference observer values from `018` for the required local-source cases:

- `san-jose-000deg-closest`: distance `5050.674164842701 km`,
  distance-falloff scale `0.9031996723576283`, incident scale
  `1.0000000000000002`.
- `san-jose-090deg-from-closest`: distance `10557.381263312685 km`,
  distance-falloff scale `0.2067140821095606`, incident scale
  `0.22886864160388085`.
- `san-jose-180deg-from-closest`: distance `14050.17041741779 km`,
  distance-falloff scale `0.11671301573969893`, incident scale
  `0.12922172063575063`.

Optional local-source cases:

- `san-jose-045deg-from-closest`
- `san-jose-135deg-from-closest`

Implementation direction:

- Adapt `atmosflat32` only for the source/geometry boundary:
  finite source direction, source distance, incident scale, source-path
  termination, and flat/spherical geometry selection.
- Use app configuration only as configuration input when reproducing the San
  Jose flat false-Sun setup; do not treat app rendering as physics authority.
- Use the calibrated transport brightness from `018`: closest approach equals
  `1x` distant-Sun incident scale, with calibrated
  `solarIrradianceScale: 1.1071748923354825`. Preserve the app raw
  `solarIrradianceScale: 58` only as source provenance, not as transport
  brightness.
- Keep the first local-source CPU validation first-order only. Do not use the
  current distant-Sun second-order incident-sky cache for local Sun.
- Prefer selected-ray/selected-pixel diagnostics before image generation:
  source direction, distance, incident scale, source transmittance, view
  transmittance, first-order Rayleigh/Mie path radiance, and final spectral
  transfer.
- Include at least one distant-Sun control run through the same contract to
  prove the new local-source adapter did not perturb the default source. Use
  the Milestone 9 `simple-card-algorithm32` case as that control unless the
  report explains why a stricter control was used.
- Required artifact files: `command.json`, `inputs.json`,
  `local-source-diagnostics.json`, `selected-rays.json`,
  `distant-source-control.json`, `criteria-results.json`, `report.md`, and
  `run.log`.

Acceptance:

- Source sample diagnostics for the required offsets match the `018`
  reference values for source direction, source distance, distance-falloff
  scale, incident scale, and finite source-path policy. Default numeric gates:
  source-direction component max absolute delta `<= 1e-12`, distance max
  absolute delta `<= 1e-6 m`, and falloff/incident-scale max absolute delta
  `<= 1e-12`. Any relaxed tolerance must name the field, new tolerance, max
  delta, and reason.
- Incident scale follows the accepted `018` ordering:
  `0deg > 90deg > 180deg`, with closest approach equal to `1x` distant-Sun
  incident scale under the calibrated transport brightness.
- Local-source diagnostics are finite, nonnegative where expected, and
  physically attributable to the configured source distance/falloff rather
  than display tuning.
- The distant-Sun control remains unchanged from Milestones 8 and 9.
- The report explicitly labels local second-order behavior, direct solar-disc
  camera radiance, ground bounce, and shader work as deferred.

### 11. CPU Shader-Input Contract Dry Run

Goal: produce the data packet the shader will eventually consume, but stop
short of any shader implementation.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/076-cpu-source-contract-shader-packet/`.
The artifact writes pure JSON distant and local source packets. The distant
packet rehydrates into the CPU renderer through a nested run at
`076-cpu-source-contract-shader-packet/cases/001-distant-directional-sun-packet-roundtrip/`
with exact raw image, selected diagnostics, and source-sample trace parity
against Milestone 8. The local packet is emitted after accepted Milestone 10
and explicitly marks local second-order cache, direct local solar-disc camera
radiance, and local ground bounce as unsupported or deferred.

Artifact target label:

```text
cpu-source-contract-shader-packet
```

Use the next available append-only number under
`tmp/atmosphere/algorithm32_shader_lab/`.

Implementation direction:

- Serialize the CPU source/geometry/profile/numerical configuration into a
  shader-facing packet for the accepted distant-Sun contract first.
- Include explicit fields for `sourceKind`, source direction or position,
  incident scale policy, per-wavelength irradiance data, geometry kind,
  source-path transmittance policy, and second-order cache compatibility.
- For local source, include a packet shape only after Milestone 10 diagnostics
  are accepted; local second-order cache fields should be absent or explicitly
  marked unsupported.
- The packet is JSON for this milestone. It is not yet a GLSL uniform layout,
  texture upload, or browser pass.
- Required distant-Sun packet file:
  `source-contract-shader-packet.distant-directional-sun.json`.
- Optional local-source packet file, only after Milestone 10 acceptance:
  `source-contract-shader-packet.flat-local-point-sun.json`.
- Required artifact files: `command.json`, packet JSON file(s),
  `roundtrip-comparison.json`, `unsupported-feature-report.json`,
  `criteria-results.json`, `report.md`, and `run.log`.

Acceptance:

- The packet round-trips back into the CPU renderer with no distant-Sun output
  change.
- The distant-Sun packet round-trip compares against the Milestone 8 or
  Milestone 9 simple-card distant-Sun result and preserves the same stable
  `reference-image.png`, selected diagnostics, source-sample trace, and
  current second-order compatibility.
- Unsupported local-source shader features fail loudly in the packet metadata
  rather than silently falling back to distant-Sun assumptions.
- The packet is pure data: no WebGL handles, Three private texture ids,
  functions, closures, or renderer-owned state.
- The report names Milestone 13 as future work: browser-lit scene-input
  capture plus CPU Algorithm32 postprocessing before shader implementation.

### 12. CPU Local-Source Integrated Render

Goal: prove the flat/local point Sun is integrated into the CPU image renderer,
not only into source-sample diagnostics.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/`.
The artifact first reruns the default spherical distant-Sun simple-card control
and preserves exact parity against `037-algorithm32-simple-card-reference`
(`imageMaxAbsByteDelta = 0`, selected/geometry/transport/criteria JSON parity
over reference-owned fields). It then renders two first-order flat/local CPU
images through the same `node-three-reference.js` path:

- `local-source-closest-day.png`: closest San Jose approach, source distance
  `5050.674164842701 km`, observer incident scale `1`.
- `local-source-090deg-rise-sunset.png`: `90` degrees around the flat-Sun
  orbit from closest approach, source distance `10557.381263312685 km`,
  observer incident scale `0.22886864160388085`.

Implementation result:

- `node-three-reference.js` now keeps the default distant-Sun branch stable
  while evaluating finite/local sources per sample in the first-order
  scattering integral: `T_view`, `T_source`, source direction, spectral
  incident scale, phase, density, scattering coefficient, and `ds` are all
  applied at each view-path sample.
- Flat geometry now owns altitude, flat top-plane source-path termination,
  flat ground occlusion for source paths, and the scene renderer's no-hit sky
  ray limit. Spherical geometry continues to use the existing round
  top-atmosphere boundary and distant-Sun second-order cache.
- The local-source integrated render is first-order only. It records `0`
  incident-sky cache entries for local cases; local second-order cache,
  visible solar-disc camera radiance, and ground bounce remain deferred.
- The local-source placement, calibrated brightness, inverse-square falloff,
  and source color are borrowed from accepted `atmosflat32` artifact `018`.

Flat scene ray policy:

- The default flat scene no-hit sky segment length is
  `1,926,774 m` (`1,926.774 km`), seeded by accepted visibility artifact
  `062` where the recorded target/render setup reached
  `100% lost/cannot see`.
- This is a renderer-owned POC policy, not an Algorithm32 atmosphere constant
  and not the older `atmosflat32` skydome cap. Later experiments may choose a
  shorter practical cap because realistic objects can lose angular resolution
  before they fully fade from atmospheric obscuration.

Command:

```text
node scripts/flat/algorithm32-shader-lab/cpu-local-source-integrated-render.js
```

Required artifact files:

- `distant-control.json`
- `local-render-cases.json`
- `local-source-closest-day.png`
- `local-source-090deg-rise-sunset.png`
- `criteria-results.json`
- `report.md`

### Visual Source Gallery

Latest visual-only subjective artifact:
`tmp/atmosphere/algorithm32_shader_lab/079-cpu-source-subjective-gallery/`.
It uses the fixed Three card scene and first-order CPU Algorithm32 rendering
for distant high Sun, distant low Sun, and flat/local Sun orbit offsets `0`,
`45`, `90`, `135`, and `180` degrees. The contact sheet is
`subjective-gallery.png`; individual panels are also copied to the artifact
root. This is inspection imagery only and should not be treated as a physics
acceptance gate. The objective CPU local-source integration proof remains
Milestone 12 artifact `078`.

### 13. Browser Lit Scene Input CPU Postprocessor

Goal: prove the production-style composition shape in the lab before shader
implementation: Three renders the visible scene with normal materials, lights,
and shadows, then CPU Algorithm32 postprocesses that scene image pixel by
pixel as `final = sceneColor * T_view + L_path`.

This milestone is accepted. It is not the local Sun shader and it is not a
replacement for the accepted `054` browser shader endpoint. It is the bridge
that makes the CPU renderer behave like the later shader path: the browser
owns scene lighting and shadow casting; Algorithm32 owns atmospheric
transmittance and path radiance.

Status: accepted by browser capture artifact
`tmp/atmosphere/algorithm32_shader_lab/080-browser-lit-scene-input-capture/`
and CPU postprocessor artifact
`tmp/atmosphere/algorithm32_shader_lab/081-browser-lit-scene-input-cpu-postprocessor/`.
The browser run used the existing user-owned watch harness without relaunch,
captured both the `unlit-material-control` and `lit-shadow-scene` packets, and
passed `4/4` browser criteria. The lit packet contained `6513` sky pixels,
`7887` hit pixels, and a real ground shadow/lit separation with luminance
delta `49.0064`. The CPU postprocessor passed `5/5` criteria: browser capture
accepted, unlit original-renderer parity accepted with `maxAbsRgbDelta = 0`
and `meanAbsRgbDelta = 0`, zero-density scene-color passthrough accepted with
`maxAbsDelta = 0`, lit postprocess RGBA finite over `14400` pixels, and lit
selected-pixel coverage included sky plus hit pixels.

Implementation result:

- `scripts/flat/algorithm32-shader-lab/page/shader-lab.js` now has
  `browser-lit-scene-input-capture`, which emits JSON-carried scene-input
  packets through existing harness outputs.
- `scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js` reads
  a browser capture artifact, runs the original CPU renderer as a nested
  unlit control, and writes the soft-shader/postprocess outputs.
- `node-three-reference.js` now exports the minimal Algorithm32 kernels needed
  by the postprocessor; the physics path is reused rather than copied.
- The lit RGB composition remains first-POC display-domain composition over
  RGBA8 scene color. Binary/HDR browser attachments remain deferred because
  the milestone intentionally used the current running harness without a
  relaunch.

Artifact target label:

```text
browser-lit-scene-input-cpu-postprocessor
```

Use the next available append-only number under
`tmp/atmosphere/algorithm32_shader_lab/`.

Current harness route:

- Use the already-running user-owned `harness.js --watch` process. Do not
  launch a new Chrome or duplicate harness unless the user explicitly asks.
- Before triggering a run, read
  `tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json` and use its
  `commandPath`.
- In the current session, the heartbeat points at:

```text
tmp/atmosphere/algorithm32_shader_lab/browser-three-baseline-command.json
```

- Do not change `harness.js` for this milestone. Page-side changes in
  `scripts/flat/algorithm32-shader-lab/page/shader-lab.js` are picked up by
  the existing watcher because the harness reloads the page and serves JS with
  `cache-control: no-store`. Harness-side changes would require a deliberate
  relaunch, so multi-file binary artifact support is deferred.

Browser command seed:

```json
{
  "id": "browser-lit-scene-input-capture-milestone-13",
  "label": "browser-lit-scene-input-capture",
  "payload": {
    "mode": "browser-lit-scene-input-capture",
    "width": 160,
    "height": 90,
    "sceneMode": "shadow-card-floor",
    "sourceKind": "distant-directional-sun",
    "sunCase": "figure1-13h15-z21",
    "capturePacketEncoding": "diagnostics-json",
    "toneMapping": "none",
    "outputColorSpace": "rgba8-no-tonemapping-recorded",
    "includeShadowCheck": true,
    "validationModes": [
      "unlit-material-control",
      "lit-shadow-scene"
    ]
  }
}
```

Implementation direction:

- Add a browser page mode named `browser-lit-scene-input-capture` to
  `window.runShaderLabSmoke(command)`.
- Create a small deterministic Three scene with at least one lit surface, one
  shadow-casting object, and at least one sky/no-hit region. Use real Three
  lights and shadow maps, not manually darkened material colors.
- Capture a compact scene-input packet through existing harness outputs:
  `imageDataUrl` for preview and `diagnostics.json` for data. Keep the first
  resolution small enough for JSON transport, such as `160 x 90`.
- The packet must include `sceneColor`, `hitDistance`, `hitMask`, camera
  packet, source/geometry packet, capture policy, and enough selected-pixel
  diagnostics to prove the shadowed and lit regions differ before atmosphere.
- Reuse existing scene-input helpers where they fit:
  `buildSceneInputTextureData`, `buildGpuSceneInputTextureData`, camera/ray
  helpers, selected-pixel sampling, and source packet semantics from `076`.
  The missing new data is the lit Three scene color buffer.
- Add a CPU postprocessor runner that reads the accepted browser artifact,
  decodes the scene-input packet, reconstructs per-pixel camera rays, and
  composes Algorithm32 over the browser-rendered scene color.
- Include an `unlit-material-control` validation mode before accepting the lit
  scene. In this mode, the browser packet uses the same unlit/material-color
  scene-color policy as the original CPU renderer: no Three lights, no shadows,
  and no lighting-derived color changes. Run the original
  `node-three-reference.js` renderer for the same scene/source, run the new
  CPU postprocessor over the unlit packet, and compare the two. This isolates
  the soft-shader Algorithm32 composition from Three lighting and proves the
  new path preserves the old renderer when lighting is absent.
- Keep the default source for this milestone as fixed spherical
  `distant-directional-sun`. Local Sun behavior remains deferred.
- Keep this as POC lab code. Do not write production app code and do not add
  unit tests.

CPU postprocessor command shape:

```text
node scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js --browser-run tmp/atmosphere/algorithm32_shader_lab/<NNN-browser-lit-scene-input-capture> --label browser-lit-scene-input-cpu-postprocessor
```

Required browser capture artifact files:

- `command.json`
- `canvas-image.png`
- `diagnostics.json`
- `selected-pixels.json`
- `console.json`
- `timings.json`
- `report.md`

Required CPU postprocessor artifact files:

- `command.json`
- `scene-input-summary.json`
- `source-geometry-packet.json`
- `original-renderer-control-image.png`
- `unlit-control-postprocess-image.png`
- `unlit-control-comparison.json`
- `postprocess-image.png`
- `scene-color-preview.png`
- `selected-pixels.json`
- `criteria-results.json`
- `report.md`
- `run.log`

Acceptance:

- The current long-running harness produces the browser capture by editing the
  heartbeat-reported command file; no new browser launch or harness relaunch is
  required.
- The browser capture contains a nonblank lit scene image, at least one sky
  pixel, at least one object/ground hit pixel, and at least one shadowed object
  or ground region whose scene color differs from a comparable lit region.
- The captured scene-input packet is self-describing: dimensions, row order,
  color encoding, distance units, hit-mask meaning, camera matrices, source
  kind, Sun case, and known limitations are all recorded.
- The CPU postprocessor runs pixel-for-pixel over the captured packet rather
  than re-rendering object colors procedurally.
- The unlit/material-color control compares the original CPU renderer against
  the new CPU postprocessor without lighting or shadows. It must match the old
  renderer's image and selected diagnostics exactly where the packet is
  structurally equivalent, or within an explicitly recorded byte tolerance
  attributable only to packet color quantization or browser raster placement.
  This control must pass before the lit/shadow result is treated as meaningful.
- A zero-density or disabled-atmosphere check reproduces captured `sceneColor`
  exactly within recorded byte tolerance.
- Sky/no-hit pixels are produced by Algorithm32 path radiance, while hit
  pixels use `sceneColor * T_view + L_path`.
- Selected pixels include lit surface, shadowed surface, sky, and at least one
  distance-varying hit; all values are finite and bounded after display
  conversion.
- The report explicitly marks JSON packet transport and RGBA8/recorded color
  precision as first-POC limitations. Future binary/HDR packet output may
  require a deliberate harness relaunch, but it is not needed for accepting
  this milestone.

### Shared Soft-Shader Contract

Milestones 14 through 19 treat the CPU soft shader as the CPU version of the
eventual postprocess shader. The intended data flow is:

```text
Three/browser scene render -> scene packet -> CPU soft shader -> image
                                     later -> GPU shader -> image
```

The soft shader must not know about Three objects. It consumes packets, not
scene graph state. The packet inputs are:

- `sceneColor`;
- `hitDistance`;
- `hitMask`;
- material or spectrum id;
- camera/ray data;
- geometry packet;
- Sun/source packet;
- display policy.

Resolved packet defaults:

- Pixel arrays are `top-left-row-major`, matching the accepted browser packet.
- Distances are meters along the camera ray. `hitDistance = -1` is the default
  no-hit sentinel.
- `hitMask = 1` means a finite scene/raycaster hit. `hitMask = 0` means
  sky/no-hit.
- Camera rays are world-space Three directions in the packet and are converted
  into Algorithm32 coordinates only inside the shared adapter.
- The current browser packet color encoding is
  `rgba8-no-tonemapping-recorded`. This is a POC transport format, not the
  final HDR/radiometric scene-radiance contract.
- For Milestones 14 through 17, the default atmosphere geometry is the
  accepted spherical Algorithm32 geometry unless the case explicitly says
  otherwise.
- For local-Sun Milestones 18 and 19, the geometry packet must explicitly say
  flat geometry, flat atmosphere boundary, and any renderer-owned no-hit
  sky-ray length cap.

The per-pixel contract is:

```text
if sky:
  final = Algorithm32 path radiance
if hit:
  final = sceneColor * T_view + L_path
```

For unlit compatibility, `sceneColor` may be reconstructed from the
material/spectrum id when that is the cleanest way to match the old CPU
renderer exactly. For lit compatibility, `sceneColor` comes from the browser's
real scene render and the soft shader must not recompute material lighting.
Because the current browser packet is RGBA8, lit-scene composition remains a
display-domain POC until a later binary/HDR packet carries linear radiometric
surface input. The artifact must state the active `sceneColor` policy so this
does not silently masquerade as a spectral surface-radiance proof.

The source packet owns source identity and source samples:

- A distant source packet includes `sourceKind`, source direction,
  spectral irradiance or source scale, Sun case id, and any display-light
  calibration scalar.
- A local source packet includes `sourceKind`, source position, finite sample
  direction, distance/falloff policy, incident scale, source-path
  transmittance policy, flat geometry, and unsupported/deferred flags.
- No code in this runway should silently fall back to a default Sun when a
  source packet is supplied. Missing source fields should fail the run or be
  recorded as unresolved criteria.

For scene lights, use one sign convention throughout the artifacts:
Algorithm32 `sunDirection` is the normalized direction from the atmosphere
sample toward the Sun. In Three, a `DirectionalLight` shines from its position
toward its target, so the recorded Three light vector should be documented as
the light-travel direction and compared to `-sunDirection` after coordinate
conversion, or documented as the direction-to-source and compared to
`sunDirection`. The adapter must record which convention it uses.

The central design rule is unchanged across all six milestones: do not make
Algorithm32 branch into separate renderers. The renderer provides scene
inputs, the source object provides source samples, and the soft
shader/postprocess kernel stays shared.

### 14. CPU Soft-Shader Unlit Parity Matrix

Goal: turn the single Milestone 13 unlit/material-control proof into a small
matrix that demonstrates the CPU soft-shader path can replace the original CPU
renderer when no scene lighting or shadows are involved.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/083-cpu-soft-shader-unlit-parity-matrix/`.
Rejected diagnostic `082-cpu-soft-shader-unlit-parity-matrix` proved image
parity but failed selected-pixel bookkeeping after a generic `center` sample
overwrote one original selected diagnostic. `083` fixes that and accepts all
three cases: `simple-card-algorithm32`, `simple-card-first-order`, and
`sunset-floor-algorithm32`. Aggregate criteria passed `4/4`; each case passed
`5/5`. Every case had exact old-renderer/soft-shader image parity
(`maxAbsRgbDelta = 0`, `meanAbsRgbDelta = 0`, `p95 = 0`, `p99 = 0`). Selected
transport diagnostics matched with max transfer delta `0` for both simple-card
cases and `2.710505431213761e-20` for the sunset-floor case.

This milestone is still pre-shader POC lab work. It compares the original
`node-three-reference.js` renderer against a pixel-for-pixel postprocess over
scene-input packets where `sceneColor` is the material color the old renderer
would have used. Do not introduce Three lights, shadow maps, local Sun
behavior, or shader implementation in this milestone.

Recommended cases:

- `simple-card-algorithm32` with the default high distant Sun and full
  Algorithm32 second-order settings.
- The first-order-isolation simple-card case, so the postprocessor is checked
  against the known first-order objective path.
- A no-object sky/floor case such as the sunset floor, so sky-only and
  finite-ground pixels are both exercised.

Implementation direction:

- Reuse `cpu-scene-input-postprocessor.js` rather than adding another
  atmosphere integrator.
- Add matrix/case support around the existing browser packet and CPU control
  flow. Browser-captured packets are preferred where rasterization matters;
  CPU-synthesized packets may be used only as a diagnostic helper and must be
  labeled that way.
- Keep each case's source/geometry packet explicit: dimensions, ray order,
  source kind, Sun case, atmosphere geometry, scene color encoding, hit-mask
  policy, and known precision limits.
- For unlit compatibility, allow material/spectrum id reconstruction of
  `sceneColor` where that produces the exact old-renderer input.
- Write one aggregate artifact with nested `cases/` folders. The nested
  folders are supporting evidence inside the milestone artifact, not
  replacements for top-level numbered artifacts.

Acceptance:

- Each case writes original-renderer image, soft-shader image, diff image,
  selected-pixel comparison, and criteria.
- The old renderer and soft shader match exactly where both consume the same
  unquantized CPU data, or within an explicitly recorded byte tolerance caused
  only by browser RGBA8 packet quantization or browser raster placement.
- The default exact target for CPU-synthesized unlit packets is
  `maxAbsRgbDelta = 0`; browser-captured RGBA8 cases may use a small recorded
  tolerance only when the report identifies the quantization or raster cause.
- Selected transport diagnostics agree for the same rays and source packets.
- Sky/no-hit pixels and finite hit pixels are both covered by selected-pixel
  diagnostics.
- The report states that Milestone 14 proves unlit renderer equivalence only.

### 15. Distant-Sun Lit Scene Soft-Shader Matrix

Goal: exercise the soft-shader composition over real browser-rendered lighting
and shadows while keeping the Algorithm32 source fixed as the default
spherical `distant-directional-sun`.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/084-cpu-soft-shader-lit-scene-matrix/`.
It reused accepted browser capture `080` without a browser relaunch and
validated the lit/shadow half of the soft-shader contract. Criteria passed
`6/6`: browser capture accepted, lit packet coverage accepted (`6513` sky
pixels, `7887` hit pixels), zero-density RGBA8 scene-color passthrough exact
(`maxAbsDelta = 0`), post-atmosphere shadow/lit luminance separation
preserved (`49.0064` before atmosphere, `58.7244` after atmosphere), sky
sample replaced by Algorithm32 radiance (`upper-sky` RGB delta `33` from scene
background), and all `14400` postprocess pixels finite (`minByte = 28`,
`maxByte = 249`).

This milestone expands the lit half of Milestone 13. Three owns scene color,
materials, lights, and shadows; Algorithm32 owns only
`sceneColor * T_view + L_path`. The Three light direction and brightness do
not need to be generated from the Algorithm32 Sun yet; that coupling is
Milestone 16.

Implementation direction:

- Reuse the existing user-owned watch harness and the
  `browser-lit-scene-input-capture` page mode unless a specific limitation
  requires a new mode.
- Capture at least two lit/shadow layouts or one layout with enough selected
  samples to cover sky, lit ground, shadowed ground, lit object, shadowed
  object, and a distance-varying hit.
- Keep a disabled-atmosphere or zero-density pass for every lit case.
- Continue using RGBA8 JSON scene-color packets unless precision becomes the
  blocker; binary/HDR output requires an explicit harness relaunch decision.
- Treat the browser scene background as preview only. Sky/no-hit pixels must
  be identified by `hitMask = 0` and replaced by Algorithm32 sky radiance.

Acceptance:

- Zero-density composition reproduces captured browser `sceneColor` within the
  recorded packet tolerance for every case. For the current RGBA8 packet, the
  obvious target is exact byte identity unless the report records a concrete
  readback/encoding reason for a nonzero tolerance.
- Lit and shadowed regions remain distinct after atmospheric composition.
- Sky pixels come from Algorithm32 path radiance rather than scene background.
- Hit pixels use `sceneColor * T_view + L_path`.
- The postprocessor never recomputes material color procedurally for hit
  pixels; it consumes the captured scene image.
- All selected spectral and display values are finite and bounded.

### 16. Distant-Sun Scene-Light Coupling

Goal: make one distant-Sun configuration drive both Algorithm32 and the
browser scene light. This is the first step where the scene light source is
the same logical Sun as the atmosphere source.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/085-browser-source-light-coupling/`
and
`tmp/atmosphere/algorithm32_shader_lab/086-cpu-source-light-coupling-validation/`.
The browser capture used the user-owned watch harness with
`sourceLightMode = distant-directional-sun`, `sunCase =
figure1-13h15-z21`, and source-driven `DirectionalLight` setup recorded in
the scene packet. The CPU validation passed `8/8` criteria: source/light mode
is explicit, no default-Sun fallback was used, the Algorithm32 source direction
and Three light travel direction agree within `3.46944695195361e-18`, the
calibration scalar and directional light intensity are both `2.4`,
zero-density passthrough is exact (`maxAbsDelta = 0`), shadow/lit separation
is preserved (`67.7216` before atmosphere, `81.58` after), and finite
postprocess output remains bounded.

The coupling should be explicit and lab-local: Algorithm32 uses spectral
irradiance and source direction, while Three uses display-domain light color
and an intensity scalar. The scalar is a calibration bridge, not a new
atmosphere constant.

Implementation direction:

- Add a source-to-Three-light adapter for `distant-directional-sun`.
- Derive the Three `DirectionalLight` direction from the same source packet
  used by Algorithm32.
- Derive or record a display-domain light color from the source spectrum.
- Choose one deterministic brightness calibration target, such as a white or
  gray Lambertian swatch in the no-atmosphere pass under the high-Sun case.
- Default calibration target: a neutral Lambertian swatch under the high-Sun
  case should land near the existing Milestone 13 lit-scene brightness without
  clipping. Record the chosen target RGB/luminance and use that scalar for all
  other distant-Sun cases in the same run.
- Record the calibration scalar, source packet, and Three light packet in the
  artifact.

Acceptance:

- The Algorithm32 source direction and Three light direction agree in the same
  coordinate frame within the recorded tolerance.
- Shadow direction in the browser scene is consistent with the source packet.
- With atmosphere disabled, the calibrated surface brightness is stable and
  reproducible for the calibration swatch.
- With atmosphere enabled, the soft shader still satisfies the Milestone 15
  passthrough and finite-value checks.
- The artifact proves there is no silent fallback to the default Sun when a
  non-default distant-Sun source packet is supplied.

### 17. Distant-Sun Position Matrix

Goal: run the source-driven distant-Sun lighting path across multiple distant
Sun positions before introducing local Sun behavior.

Status: accepted in browser captures
`tmp/atmosphere/algorithm32_shader_lab/087-browser-distant-sun-position-matrix-high/`
through
`tmp/atmosphere/algorithm32_shader_lab/090-browser-distant-sun-position-matrix-behind/`
and aggregate CPU soft-shader artifact
`tmp/atmosphere/algorithm32_shader_lab/091-cpu-distant-sun-position-matrix/`.
The matrix passed `39/39` criteria across high, low, side, and behind-camera
distant Sun cases. High and low used the canonical Figure 1 Sun cases; side
and behind-camera used packet-supplied synthetic distant Sun objects. The CPU
postprocessor now resolves packet-supplied distant Sun altitude/azimuth into
the Algorithm32 model instead of silently falling back to the high-Sun default.
Matrix diagnostics recorded max source-direction separation
`94.60340177177892` degrees, brightest-ground luminance range
`48.22419999999999`, representative-sky postprocess luminance range
`107.84859999999999`, and post-atmosphere shadow-delta range
`92.43560000000002`. Per-case direction agreement stayed within
`1.11022302462516e-16`; the synthetic side and behind cases both resolved as
`packet-supplied-sun-case`.

Recommended cases:

- High Sun / daytime control, using the accepted high Figure 1-style source.
- Low Sun / sunrise-sunset control, using the accepted low Figure 1-style
  source.
- A side-light synthetic distant Sun to prove shadow direction and sky
  gradients move with the source.
- A behind-camera or front-camera synthetic distant Sun if needed to make the
  scene-light response obvious.

Default matrix if no narrower set is specified: high, low, side, and
behind-camera. Add front-camera only if the first four cases do not produce an
unambiguous shadow/lighting direction check.

Implementation direction:

- Use the Milestone 16 source-to-Three-light adapter for every case.
- Keep material spectra, camera, atmosphere profile, and geometry fixed except
  for the source configuration.
- Store a per-case source packet, Three light packet, selected source trace,
  scene-color preview, soft-shader image, and criteria.

Acceptance:

- Every case uses the same source packet to drive Algorithm32 and the Three
  scene light.
- Shadows, surface brightness, sky radiance, and selected source traces change
  consistently with the recorded source position.
- The Milestone 14 unlit parity checks remain available as the separate
  compatibility control; lit cases are not judged against the old renderer.
- The high-Sun control remains comparable to the accepted Milestone 13/15
  path, with differences explained only by the deliberate light-coupling
  change.

### 18. Local-Sun Soft-Shader Source Matrix

Goal: bring the accepted flat/local point-Sun source into the CPU
soft-shader/postprocessor path, still before browser shader implementation.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/093-cpu-local-sun-soft-shader-source-matrix/`.
Superseded diagnostic `092` also passed, but `093` reports aggregate plus
nested case criteria together. The accepted run passed `57/57`: aggregate
criteria `7/7`, distant control `5/5`, and each local offset case `9/9`.
The distant control matched the soft shader exactly (`maxAbsRgbDelta = 0`,
selected-transfer delta `0`). Local offsets `0`, `45`, `90`, `135`, and
`180` degrees all resolved as `packet-supplied-flat-local-point-sun` in the
postprocessor, matched the original CPU local renderer exactly
(`maxAbsRgbDelta = 0`, selected-transfer delta `0`), and kept source traces
finite. Source distance increased from `5050.674 km` at closest approach to
`14050.170 km` at `180` degrees, while incident scale decreased from `1` to
`0.12922172063575063`. Mean observer source transmittance decreased from
`0.6591758563136678` to `0.33942635285309136`. Local rendering remains
first-order only; local second-order cache, visible solar disc, ground bounce,
browser point-light proxy, and shader packing remain deferred.

Use the same local-source assumptions accepted by the shader-lab CPU and
`atmosflat32` POC work: closest approach to San Jose plus flat-Sun orbit
offsets `45`, `90`, `135`, and `180` degrees. Treat those degrees as degrees
around the flat Sun's orbit, not camera view angles.

Implementation direction:

- Reuse the local source object and source-sample semantics from Milestone 12:
  finite source direction, source distance/falloff, calibrated incident
  spectral scale, source-path transmittance, phase, and explicit flat
  atmosphere geometry.
- The `0` degree case is closest approach. The `90` degree case is the
  rise/sunset-style offset used in the accepted CPU render. Include `45`,
  `135`, and `180` degrees for the full local matrix.
- Keep the renderer-owned flat no-hit sky-ray cap explicit. It is a scene or
  skydome policy, not an Algorithm32 atmosphere constant.
- Start with the postprocessor consuming material/unlit or already-captured
  `sceneColor`, so the first local-Sun check isolates atmospheric transport.
- Mark local second-order cache, direct solar-disc camera radiance, and local
  ground bounce as deferred unless a later milestone explicitly implements
  them.

Acceptance:

- The distant-Sun control still matches the accepted source-contract control
  for the same configuration.
- Each local orbit offset writes source packet, selected source trace,
  postprocess image, selected pixels, and criteria.
- The selected traces show source direction, source distance/falloff, incident
  scale, source-path transmittance, and phase changing with orbit offset.
- Closest approach should be brightest under the accepted calibration, and
  farther orbit positions should dim according to the configured finite-source
  falloff and source-path transmittance.
- The report distinguishes natural far-source dimming from display tuning; do
  not fake brightness by post-render darkening or brightening.

### 19. Unified Source-Driven Soft-Shader Matrix

Goal: prove the soft-shader framework can treat distant and local Suns as two
source configurations inside one renderer/postprocessor contract.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/094-cpu-unified-source-driven-soft-shader-matrix/`.
The unified matrix passed `56/56`: aggregate criteria `7/7`, and each of the
seven cases `7/7`. The cases were distant high and distant low from accepted
browser lit/shadow packets `087` and `088`, plus local flat-Sun offsets `0`,
`45`, `90`, `135`, and `180` degrees from accepted local scene packets in
`093`. Every case was reprocessed through the same
`postprocessSceneInput` CPU soft-shader kernel. Distant cases retained the
source-driven Three `DirectionalLight` adapter and canonical Sun resolution;
local cases used CPU-synthesized unlit scene packets, resolved as
`packet-supplied-flat-local-point-sun`, and explicitly recorded
`none-local-unlit-packet` as the scene-light adapter. No-atmosphere
passthrough was exact (`maxAbsDelta = 0`) for every case. Local browser
point-light/proxy behavior remains a later milestone before shader-side local
scene lighting.

This is the final documented CPU/browser postprocessor milestone before
returning to browser shader implementation. It should use the same packet
shape, selected diagnostics, image outputs, and acceptance vocabulary for
distant and local source cases, even if the scene-light adapter differs
internally.

Implementation direction:

- Run at least one distant high-Sun case, one distant low-Sun case, and the
  local flat-Sun orbit offsets `0`, `45`, `90`, `135`, and `180` degrees.
- For distant Sun, use the Milestone 16 `DirectionalLight` adapter.
- For local Sun, use a finite-source scene-light adapter only if the browser
  scene can represent it honestly. A `PointLight` may be acceptable for a
  small lab scene, but very large configured distances may require a recorded
  scaled proxy or a custom diagnostic light path. Any proxy must preserve and
  report the configured source direction, distance, and brightness mapping.
- If a local `PointLight` proxy is used, keep Algorithm32 source sampling tied
  to the configured true local source, not the proxy transform.
- Keep Algorithm32 source sampling as the authority for atmospheric scattering
  in every case.

Acceptance:

- One aggregate artifact records the unified source packet schema and the
  per-case source/light packets.
- Each case writes a browser scene packet, source/geometry packet,
  soft-shader output image, selected-pixel diagnostics, no-atmosphere
  passthrough check, source-sample trace, report, and criteria.
- Distant and local cases share the same soft-shader postprocess kernel.
- Distant cases continue to satisfy the Milestone 17 checks.
- Local cases continue to satisfy the Milestone 18 checks.
- Any Three-light approximation for the local Sun is explicitly recorded as a
  scene-light adapter choice and is not allowed to alter the Algorithm32
  source-sampling result.

### 20. Shader Oracle And Packet Inventory

Goal: restart browser shader implementation by freezing the CPU soft-shader
oracle and naming the exact shader inputs before writing shader-side source
logic.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/162-shader-oracle-packet-inventory/`.
The inventory passed `4/4` criteria. It names `094` as the objective unified
source-driven CPU oracle, keeps `054` as the prior fixed spherical distant-Sun
browser endpoint, and records `157` as visual-only subjective terrain context.
It freezes the first GPU packet input set as scene color, hit distance,
hit/mask material id, ray direction, geometry uniforms, source uniforms,
atmosphere/profile constants, second-order distant-Sun cache inputs where
supported, and display-policy uniforms.

This milestone is the setup rung for matching the accepted CPU soft-shader,
not a new rendering algorithm. The objective oracle is
`tmp/atmosphere/algorithm32_shader_lab/094-cpu-unified-source-driven-soft-shader-matrix/`.
The previous browser shader endpoint is
`tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image/`,
but `054` is fixed spherical distant-Sun evidence only. Subjective artifact
`157-three-lit-detailed-subjective-source-scenes` is visual context only and
must not become a pass/fail shader gate.

Shader target formula:

```text
if sky:
  final = Algorithm32 path radiance
if hit:
  final = sceneColor * T_view + L_path
```

Required decision for this milestone:

- Treat the GPU shader as another implementation of
  `postprocessSceneInput`, not as a separate scene renderer.
- The shader does not inspect Three objects, materials, lights, or meshes.
  Three/browser scene rendering produces packet inputs; the shader consumes
  only textures and uniforms derived from those packets.
- Start with a `rayDirectionTexture` even though the shader could reconstruct
  rays from camera matrices. This removes camera-math uncertainty from the
  first parity rung. Matrix reconstruction can be a later optimization.
- If RGBA8 JSON packet transport becomes the blocker, document that and add a
  deliberate binary/HDR packet-extension milestone. Do not silently change the
  packet contract inside Milestone 20.

Acceptance:

- A short artifact or report names the oracle artifacts, the previous shader
  endpoint, and the planned GPU input packet fields.
- The report lists each input as a texture or uniform:
  `sceneColorTexture`, `hitDistanceTexture`, `hitMask/materialIdTexture`,
  `rayDirectionTexture`, geometry uniforms, source uniforms, spectral/profile
  constants or textures, second-order cache inputs where supported, and
  display-policy uniforms.
- The report explicitly states that `157` is visual-only and that Milestones
  20 through 26 use `094` and its descendants as objective CPU references.

### 21. GPU Packet Input Parity And No-Atmosphere Passthrough

Goal: prove the browser shader pass can consume the same scene packet shape as
the CPU soft-shader before adding new source behavior.

Status: accepted by browser evidence
`tmp/atmosphere/algorithm32_shader_lab/166-browser-soft-shader-packet-passthrough/`
and aggregate artifact
`tmp/atmosphere/algorithm32_shader_lab/167-gpu-packet-input-parity-no-atmosphere-passthrough/`.
The browser run passed `4/4`, the aggregate passed `4/4`, and the
no-atmosphere passthrough had `maxAbsDelta = 0`. The artifact records
top-left row-major packet ordering, meter distances, and `hitMask = 1` for a
scene hit.

Implementation direction:

- Add or extend a browser shader mode that receives the scene packet as GPU
  textures/uniforms.
- Upload `sceneColor`, `hitDistance`, `hitMask/materialId`, and
  `rayDirection` from the same browser scene packet consumed by the CPU
  postprocessor.
- Add a no-atmosphere shader mode that returns `sceneColor` exactly for every
  pixel, regardless of hit/sky classification.
- Keep this milestone independent of local Sun support, second-order cache
  changes, and visual mountain tuning.

Acceptance:

- No-atmosphere GPU output matches the scene-color packet exactly or within a
  documented byte-level texture upload/readback tolerance.
- Hit mask, material id, distance, and ray-direction selected diagnostics match
  the packet values consumed by the CPU soft-shader.
- Row order, units, and hit semantics are recorded:
  top-left row-major, meter distances, and `hitMask = 1` for a scene hit.
- No default Sun fallback is used or needed in this milestone.

### 22. Packet-Driven Distant Sun Shader

Goal: replace fixed/default distant-Sun shader assumptions with packet-driven
`distant-directional-sun` uniforms while staying on the already-supported
spherical distant-Sun geometry and cache path.

Status: accepted by browser evidence
`tmp/atmosphere/algorithm32_shader_lab/169-browser-packet-driven-distant-sun-shader-distant-high/`,
`tmp/atmosphere/algorithm32_shader_lab/170-browser-packet-driven-distant-sun-shader-distant-low/`,
and aggregate artifact
`tmp/atmosphere/algorithm32_shader_lab/171-packet-driven-distant-sun-shader/`.
The aggregate passed `5/5`. The high case used `figure1-13h15-z21` and
recorded mean luminance `130.86161914063382`; the low case used
`figure1-06h00-z87` and recorded mean luminance `73.45277162500807`.
Selected shader/source diagnostics matched the packet-driven CPU expectation
with max selected delta `0`. Superseded diagnostic `168` is incomplete and
should be ignored; it attempted to spawn the harness as a nested child process
and failed with `spawn EPERM`. Use direct shell-level `harness.js --once`
commands or existing browser artifacts for this rung.

Implementation direction:

- Consume packet source fields for `kind = distant-directional-sun`, Sun
  direction, optional altitude/azimuth provenance, spectral irradiance scale,
  and geometry kind.
- Preserve the existing fixed spherical second-order cache behavior for
  distant Sun only.
- Remove silent fallback to `figure1-13h15-z21`; missing or unsupported source
  data should fail the artifact criteria loudly.
- Keep local source packets explicitly unsupported in this milestone.

Acceptance:

- The high-Sun fixed/default case still matches the accepted `054` style
  shader endpoint within the existing shader tolerance.
- At least one low or synthetic distant-Sun packet changes the shader output
  and source diagnostics according to the packet source direction.
- Shader-selected source direction agrees with the CPU packet direction after
  the recorded Three-to-Algorithm coordinate conversion.
- The artifact states whether second-order distant-Sun cache data came from
  existing constants, generated textures, or an accepted cache artifact.

### 23. Distant Soft-Shader GPU Parity

Goal: compare the GPU shader against the CPU soft-shader for distant-Sun scene
packets using the same composition contract.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/172-distant-soft-shader-gpu-parity/`.
It passed `12/12` criteria for distant high and distant low. Both cases ran
the CPU soft-shader and the GPU shader over the same compact scene/source
packet and compared full images. Each comparison had `maxAbsRgbDelta = 1`,
`meanAbsRgbDelta = 0.0013020833333333333`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`.

Implementation direction:

- Use a compact browser scene packet first, preferably one already accepted in
  the distant CPU runway, before using subjective mountain scenes.
- Run CPU `postprocessSceneInput` and GPU shader over the same scene-color,
  hit, ray, geometry, and source packet.
- Include a first pass without Three lighting if useful to isolate atmosphere
  parity, then a distant lit/shadow packet only after unlit parity is stable.

Acceptance:

- Selected-pixel GPU/CPU deltas are within the same class of tolerance as the
  accepted fixed distant-Sun shader work, or any larger deltas are traced to
  rasterization/texture packing rather than radiance math.
- Full-image diff, selected diagnostics, packet summary, and source summary
  are written.
- Sky pixels use Algorithm32 path radiance; hit pixels use
  `sceneColor * T_view + L_path`.
- No-atmosphere passthrough remains exact or within the Milestone 21
  tolerance.

### 24. Lit Scene Shader Composition

Goal: prove the GPU shader preserves browser-rendered Three lighting and
shadows in the same way the CPU soft-shader does.

Status: accepted by browser evidence
`tmp/atmosphere/algorithm32_shader_lab/173-browser-lit-scene-soft-shader-composition/`
and aggregate artifact
`tmp/atmosphere/algorithm32_shader_lab/174-lit-scene-shader-composition/`.
The browser run passed `6/6`, the aggregate passed `5/5`, no-atmosphere
passthrough stayed exact (`maxAbsDelta = 0`), selected CPU-preview parity had
max RGB delta `1`, post-atmosphere shadow separation was `81.6522`, and sky
replacement differed from the Three clear color by max RGB delta `33`.

Implementation direction:

- Use a real Three-rendered scene-color texture with materials, white source
  light, and shadows.
- Keep Three responsible for direct surface lighting and shadow maps.
- Keep Algorithm32 responsible for atmospheric transmittance and path
  radiance.
- Do not make the atmosphere shader call or emulate Three lighting.

Acceptance:

- With atmosphere disabled, shader output reproduces the lit scene-color
  texture exactly or within the Milestone 21 tolerance.
- With atmosphere enabled, shadowed pixels remain darker than lit pixels after
  `sceneColor * T_view + L_path`.
- Sky pixels are replaced by Algorithm32 sky instead of the Three clear color.
- Selected diagnostics record pre-atmosphere scene color, transmittance,
  path-radiance preview, and final encoded color.

### 25. Local Sun First-Order Shader

Goal: add `flat-local-point-sun` support to the GPU shader for the same
first-order local-source behavior accepted in the CPU source runway.

Status: accepted by browser evidence
`tmp/atmosphere/algorithm32_shader_lab/175-browser-local-sun-first-order-diagnostics/`
and aggregate artifact
`tmp/atmosphere/algorithm32_shader_lab/176-local-sun-first-order-shader/`.
The browser diagnostic passed `11/11`, the aggregate passed `5/5`, and GPU
selected diagnostics matched the CPU local-source oracle with max selected RGB
delta `0`. Closest approach used source distance `5050674.164842701 m`,
incident scale `1.0000000000000002`, and mean luminance `198.876`; the
`90` degree orbit used source distance `10557381.263312686 m`, incident scale
`0.22886864160388085`, and mean luminance `84.23266666666665`. Local
second-order cache, direct local solar-disc camera radiance, local ground
bounce, full-image local shader output, and HDR transport remain deferred.

Implementation direction:

- Add local source uniforms/textures for configured source position, observer
  incident scale, distance falloff policy, source-path transmittance policy,
  source color or spectral incident scale, and flat geometry parameters.
- Per view-path sample, compute finite source direction, source distance,
  inverse-square falloff/incident scale, source-path transmittance, phase, and
  first-order scattering.
- Local second-order cache, direct solar-disc camera radiance, local ground
  bounce, and production LUT acceleration remain deferred unless a later
  milestone explicitly implements them.
- If the browser scene uses a `PointLight` or proxy to create surface
  lighting, record it as the scene-light adapter only. Algorithm32 source
  sampling must still use the configured true flat/local source position and
  brightness packet.

Acceptance:

- GPU selected diagnostics match the accepted CPU local source diagnostics for
  closest approach and `90` degree orbit within documented shader tolerance.
- Closest approach is brighter than `90` degrees under the accepted
  atmosflat32-derived calibration, without post-render fake brightening.
- Source distance, incident scale, source-path transmittance, and phase are
  recorded for selected samples.
- The report states that local second-order behavior is unsupported/deferred,
  not approximated by distant-Sun cache data.

### 26. Unified Source-Driven Shader Matrix

Goal: prove distant and local source families run through one GPU shader
framework and compare against the accepted CPU soft-shader oracle.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/177-unified-source-driven-shader-matrix/`.
The matrix passed `7/7` criteria and was the first unified source-driven
shader matrix endpoint.
It records distant high and distant low as full-image CPU/GPU parity cases via
`172`, lit Three scene composition via `174`, and local closest approach plus
local `90` degree orbit as first-order finite-source selected diagnostics via
`176`. Distant image comparisons retained `maxAbsRgbDelta = 1` with p99 `0`;
local selected diagnostics retained max RGB delta `0`. Remaining limitations
at this rung were explicit: local full-image shader output, local
scene-color-composition parity, local second-order cache, direct local
solar-disc camera radiance, local ground bounce, HDR transport, and production
promotion were not part of the Milestone 26 matrix. Milestones 27 through 29
supersede `177` as the current soft-shader parity endpoint.

Required cases:

- distant high Sun;
- distant low or sunset Sun;
- local closest approach;
- local `90` degree orbit;
- optional local `45`, `135`, and `180` degree orbit offsets if the first four
  cases are stable and runtime is acceptable.

Implementation direction:

- Use the same scene packet contract for all cases.
- Use source objects/packets to choose distant directional or finite local
  source sampling; do not fork into separate renderers.
- Produce side-by-side CPU/GPU images, diff images, selected diagnostics, and
  packet summaries for every case.
- Keep subjective mountain scenes as inspection material. Objective acceptance
  should be based on compact, deterministic packets first.

Acceptance:

- One aggregate artifact records all cases, their source packets, scene-light
  adapters, CPU oracle image, GPU shader image, diff image, and criteria.
- Distant cases continue to satisfy Milestone 23 and Milestone 24 checks.
- Local cases continue to satisfy Milestone 25 checks.
- The shader path fails loudly for unsupported source/geometry/cache
  combinations instead of falling back to the default distant Sun.
- The report clearly names any remaining precision, packing, second-order
  local, or HDR transport limitations before production promotion.

### 27. Local Sun Full-Image Shader Parity

Goal: close the local-source gap left by Milestone 25 by rendering complete
flat/local point-Sun images in the GPU shader and comparing them against the
CPU soft shader.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/185-local-sun-full-image-shader-parity/`.
It passed `33/33` criteria across local offsets `0`, `45`, `90`, `135`, and
`180` degrees. Every full-image GPU output matched the CPU soft-shader
spectrum-mode image with `maxAbsRgbDelta = 1` and p99 `0`; selected-pixel
max RGB delta was `0` for every case.

This milestone is required for "same capability as the current soft shader".
Milestone 25 proved selected finite-source math only; it did not prove the
shader could process every pixel in a local-source scene packet.

Implementation direction:

- Use the accepted CPU local-source matrix packet source:
  `093-cpu-local-sun-soft-shader-source-matrix`.
- Required cases are local orbit offsets `0`, `45`, `90`, `135`, and `180`
  degrees.
- Feed each case's `scene-input-packet.json` to the browser shader through the
  same packet textures used by the distant soft-shader path:
  `sceneInputTexture`, `sceneColorTexture`, and `rayDirectionTexture`.
- Use flat geometry semantics from the packet:
  `[x, y, z] -> [x, -z, y]`, `flat-z-up-atmosphere`, packet
  `topAltitudeMeters`, and packet `sceneSkyRayLimitMeters` for sky/no-hit
  rays.
- Use the local source packet exactly: finite source position, configured
  reference distance, inverse-square falloff flag, calibrated spectral
  incident scale, source color, and source-path transmittance.
- Compare against CPU `postprocessSceneInput(..., surfacePolicy:
  "spectrum-id-reference-radiance", includeSecondOrder: false)`.

Acceptance:

- All five local offsets produce browser shader images.
- Every image compares against the CPU soft-shader image with documented
  byte-level tolerance.
- Selected pixels match CPU soft-shader `postprocessRgba8` diagnostics.
- The shader uses flat/local source sampling for every pixel; no default
  distant Sun fallback is allowed.
- Local second-order cache remains explicitly unsupported because the current
  CPU soft shader is first-order for local sources.

### 28. Local Sun Scene-Color Composition Parity

Goal: prove the GPU local-source shader supports the same display-domain
composition mode as the CPU soft shader:

```text
hit: final = sceneColor * T_view + L_path
sky: final = L_path
```

This is still a packet/shader parity milestone, not a claim that real local
Three `PointLight` scene-light calibration is solved. It uses deterministic
local scene packets and their recorded `sceneColorRgba8` values.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/192-local-sun-scene-color-composition-parity/`.
It passed `33/33` criteria across local offsets `0`, `45`, `90`, `135`, and
`180` degrees. Every full-image GPU output matched the CPU soft-shader
scene-color-composition image with `maxAbsRgbDelta = 1` and p99 `1`;
selected-pixel max RGB delta was `0` or `1`.

Implementation direction:

- Reuse the same five local packets from Milestone 27.
- Run CPU `postprocessSceneInput(..., surfacePolicy:
  "captured-rgba8-display-domain", includeSecondOrder: false)`.
- Run the browser local full-image shader with `composeSceneColor = true`.
- Keep local atmosphere transport first-order and source-driven exactly as in
  Milestone 27.

Acceptance:

- All five local offsets produce browser shader images.
- Every GPU image compares against the CPU scene-color-composition soft-shader
  image with documented byte-level tolerance.
- Selected hit pixels prove `sceneColor * T_view + L_path`; selected sky
  pixels prove sky replacement with `L_path`.
- The report explicitly distinguishes this packet-composition proof from
  subjective real Three local `PointLight` scene-light inspection.

### 29. Soft-Shader Capability Parity Matrix

Goal: restate the actual parity endpoint after Milestones 27 and 28, so the
shader no longer claims local support from selected diagnostics alone.

Status: accepted in
`tmp/atmosphere/algorithm32_shader_lab/193-soft-shader-capability-parity-matrix/`.
It passed `6/6` criteria. This is the corrected current shader-lab parity
endpoint. Evidence: distant full-image parity `172`, distant lit composition
`174`, local full-image spectrum parity `185`, and local scene-color
composition parity `192`.

Required evidence:

- Distant full-image CPU/GPU soft-shader parity from Milestone 23.
- Distant lit Three scene composition from Milestone 24.
- Local full-image spectrum-mode parity from Milestone 27.
- Local full-image scene-color-composition parity from Milestone 28.

Acceptance:

- The aggregate artifact names every source family and composition mode now
  covered by GPU-vs-CPU soft-shader parity.
- The matrix covers distant high/low plus local `0`, `45`, `90`, `135`, and
  `180` degree offsets.
- Remaining deferred work is limited to capabilities beyond the current CPU
  soft shader: local second-order cache, direct local solar-disc camera
  radiance, local ground bounce, HDR/binary transport beyond the current RGBA8
  POC packet path, and production promotion.

### 30. Three-Native Atmosphere Pass Shell

Goal: start the real target POC: a shader pass used inside the normal Three.js
render loop. This milestone must move beyond the packet-file/raw-WebGL harness
shape by creating a Three-native `Algorithm32AtmospherePass` shell.

Status: accepted by `218-three-native-atmosphere-pass-shell`. This is the
first accepted milestone after the packet-based soft-shader parity endpoint
`193`.

Implementation direction:

- Add a lab-only `Algorithm32AtmospherePass` or equivalent wrapper that is
  called from a Three render loop.
- Render the Three scene into a `WebGLRenderTarget` color texture.
- Give the pass a fullscreen `ShaderMaterial` or equivalent Three-owned
  fullscreen quad. The pass may use raw WebGL only through Three-owned
  renderer context APIs; it must not be a separate standalone renderer path.
- The first shader mode is identity/passthrough:

```text
finalColor = sceneColorTexture
```

- The pass API should already accept references to the active camera and a
  configuration object for source, geometry, atmosphere, and display policy,
  even though the first implementation uses only scene color.
- Do not inject Algorithm32 code into every object material for this milestone.
  The intended POC shape is a Three-integrated fullscreen atmosphere pass over
  the rendered camera view.

Acceptance:

- The pass output matches the normal Three scene render byte-for-byte or with a
  documented one-byte framebuffer/readback tolerance.
- The pass runs from the shader-lab Three scene render loop, not from a JSON
  scene packet artifact.
- Resizing and camera movement keep the passthrough image aligned.
- The report states that this milestone proves Three integration shape only;
  no atmosphere physics is claimed yet.

### 31. Depth-To-Ray Distance Contract

Goal: replace packet `hitDistanceMeters` in the normal render path with live
Three depth. The shader must reconstruct enough per-pixel ray/distance
information from Three render targets and camera matrices to support
atmospheric transport.

Status: accepted by `212-three-native-depth-to-ray-contract`.

Implementation direction:

- Attach a `DepthTexture` to the scene render target used by
  `Algorithm32AtmospherePass`.
- Pass camera uniforms every frame: projection matrix inverse, camera matrix
  world, near/far, viewport size, and any depth packing/convention flags.
- In the shader, reconstruct:

```text
pixel -> NDC -> view/world ray
depth sample -> view/world hit position or linear hit distance
depth == clear/far -> sky/no-hit
```

- For sky/no-hit pixels, use the geometry adapter to choose the ray length:
  spherical top-atmosphere boundary for spherical geometry, or configured flat
  sky ray limit/top boundary for flat geometry.
- Use the existing Raycaster packet capture only as a validation/debug oracle,
  not as the normal input path.
- If depth precision or browser support blocks exact distance reconstruction,
  a temporary `R32F` hit-distance render target may be added as a diagnostic
  bridge, but this milestone is not accepted until the intended depth-texture
  path either works or the report records a concrete dead end and replacement
  contract.

Acceptance:

- Selected pixel depth-derived distances match Raycaster packet distances
  within documented tolerance for sky, ground, and terrain/object hits.
- Sky/hit classification matches the Raycaster packet except for explicitly
  documented silhouette/depth edge pixels.
- Camera movement, FOV changes, and resize/device-pixel-ratio changes do not
  break reconstruction.
- The report names the exact depth convention used by Three/WebGL in this POC
  and the shader formula used to linearize/reconstruct distance.

### 32. Distant Sun Atmosphere Pass

Goal: port the accepted distant directional Sun atmosphere shader behavior
into `Algorithm32AtmospherePass`.

Status: accepted by `216-three-native-distant-first-order-atmosphere`.

Implementation direction:

- Use the live scene color and depth/ray contract from Milestones 30 and 31.
- Use a single distant source config to drive both:
  - the Three `DirectionalLight`;
  - the shader's distant Sun direction and spectral source uniforms.
- Start with spherical atmosphere geometry.
- Implement the accepted composition:

```text
hit: final = sceneColor * T_view + L_path
sky: final = L_path
```

- Port the existing distant second-order incident-sky cache if it fits the
  Three pass cleanly. If second-order is deferred for this milestone, the
  report must state that the live pass is first-order and compare against the
  CPU soft shader in the same first-order mode.
- No hidden fallback to the default high Sun is allowed; the source config must
  be the only owner of Sun direction for both light and atmosphere.

Acceptance:

- Distant midday renders through the live Three-native pass and compares
  against the CPU soft shader for the same captured frame.
- Distant sunset-behind-camera renders through the same pass and compares
  against the CPU soft shader for the same captured frame.
- Three shadows remain visible after atmosphere composition.
- Selected diagnostics show the source direction used by Three lighting and
  the shader agree after coordinate conversion.

### 33. Live Scene And Camera Controls

Goal: prove the POC is a live Three view of the world, not an offline artifact
renderer with prettier packaging.

Status: accepted by `217-three-native-live-scene-camera-controls`.

Implementation direction:

- Add a shader-lab page mode with the mountain/ground scene, active camera
  controls, and the `Algorithm32AtmospherePass` in the render loop.
- Use standard Three controls suitable for the lab, such as `OrbitControls`, or
  an existing app camera-control pattern if one is already local and easy to
  reuse.
- Update atmosphere uniforms every frame from the active camera, render target,
  source config, and geometry config.
- Keep validation capture commands, but normal rendering must not require a
  JSON scene packet.

Acceptance:

- Moving the camera changes sky/object atmospheric coloring consistently.
- FOV, camera altitude, and view direction changes keep depth/ray
  reconstruction aligned.
- The page can render continuously for the accepted distant case without
  accumulating WebGL errors or stale uniforms.
- A screenshot capture path remains available for comparison artifacts.

### 34. Local Sun Atmosphere Pass

Goal: add the accepted flat/local finite Sun behavior to the Three-native pass.

Status: accepted by `220-three-native-flat-local-first-order-atmosphere`.

Implementation direction:

- Use one local source config to drive both:
  - a Three `PointLight` or explicitly documented local-light adapter;
  - shader local source uniforms.
- Use the accepted atmosflat32-derived local source calibration: local closest
  approach should match the intended high-Sun distant brightness scale without
  post-render fake brightening.
- The shader must use finite local source position, source distance, inverse
  square/falloff policy, calibrated incident scale, source-path transmittance,
  phase, and flat geometry.
- Local atmosphere remains first-order only until a later milestone explicitly
  implements a local second-order cache.
- Flat no-hit sky ray length remains renderer/view policy supplied through the
  geometry config, not an Algorithm32 atmosphere constant.

Acceptance:

- Local closest and local `90` degree orbit cases render live through the
  Three-native pass.
- Moving/changing the local source updates both Three scene lighting and
  atmospheric scattering from the same source config.
- Closest approach is brighter than `90` degrees under the accepted
  calibration unless the report identifies a physical/configured reason.
- The report explicitly states that local second-order, local solar-disc camera
  radiance, and local ground bounce remain unsupported.

### 35. Unified Source And Geometry Adapter

Goal: make the live pass configurable without separate renderers for distant
versus local Sun or spherical versus flat geometry.

Status: accepted by `222-three-native-unified-source-geometry-adapter`.

Implementation direction:

- Define the lab POC pass API around discriminated config objects:

```js
atmospherePass.setConfig({
  source,
  geometry,
  atmosphere,
  display,
});
```

- Required source configs:
  - `distant-directional-sun`;
  - `flat-local-point-sun`.
- Required geometry configs:
  - `spherical-atmosphere-geometry`;
  - `flat-z-up-atmosphere`.
- The source adapter owns conversion into both Three light settings and shader
  uniforms.
- The geometry adapter owns camera/world-to-Algorithm32 coordinate conversion,
  sky/no-hit distance policy, and all geometry-specific shader uniforms.
- Unsupported combinations must fail loudly in the lab UI/report instead of
  silently falling back to the high-Sun spherical default.

Acceptance:

- The same pass instance can switch between distant spherical and local flat
  scenarios without page reload or renderer replacement.
- Shader uniforms and Three light settings are derived from the same source
  object for every scenario.
- The report documents coordinate conventions for source direction, local
  source position, camera/world position, and depth ray reconstruction.

### 36. Live Pass Vs Soft Shader Matrix

Goal: objectively compare the actual Three-native pass against the CPU soft
shader oracle.

Status: accepted by `224-three-native-live-pass-soft-shader-matrix`.

Required cases:

- distant midday;
- distant sunset behind camera;
- local closest approach;
- local `90` degree orbit.

Implementation direction:

- For each live pass case, capture:
  - Three scene color;
  - depth or reconstructed hit-distance diagnostics;
  - final `Algorithm32AtmospherePass` output;
  - source and geometry config used for both Three and shader.
- Build the CPU soft-shader oracle from the same frame/camera/source setup.
  A Raycaster packet may be generated for validation/oracle construction, but
  the live pass must still use render targets/depth for normal rendering.
- Produce side-by-side images, diff images, selected-pixel diagnostics, and a
  matrix report.
- Separate true transport differences from expected silhouette/depth-edge
  rasterization differences.

Acceptance:

- All four cases produce live pass and CPU soft-shader outputs.
- Full-image and selected-pixel differences are within documented tolerance, or
  the report isolates discrepancies to depth/silhouette placement rather than
  source/atmosphere math.
- Distant and local cases both use the same live pass contract.
- The report states whether local cases are first-order-only and whether
  distant cases include second-order.

### 37. Scenario Controls POC

Goal: expose the controls needed to use the live atmosphere pass as an
experiment surface.

Status: accepted by `225-three-native-scenario-controls-poc`.

Implementation direction:

- Add lab controls for:
  - source family: distant or local;
  - Sun preset/position;
  - local Sun altitude/distance/brightness where applicable;
  - geometry: spherical or flat;
  - atmosphere on/off;
  - debug view: scene color, depth, transmittance, path radiance, final.
- Controls must update the same source/geometry config objects consumed by the
  Three light adapter and the shader pass.
- This remains a lab POC, not polished production UI; avoid broad app
  integration until Milestone 38.

Acceptance:

- The user can switch the four required scenarios interactively.
- The source config updates Three light and shader uniforms together.
- Debug views render without changing the underlying source/geometry config.
- Screenshot/capture commands still work for the active scenario.

### 38. Production Shape Review

Goal: decide what graduates from the lab POC into the official Algorithm32
production implementation.

Status: accepted by `226-three-native-production-shape-review`.

Review scope:

- `Algorithm32AtmospherePass` API and ownership boundaries.
- Shader module boundaries and shared GLSL kernels.
- Source adapter and geometry adapter interfaces.
- Render target/depth precision requirements.
- HDR or float texture needs beyond the current RGBA8 POC.
- Distant second-order cache promotion.
- Explicit remaining gaps: local second-order cache, direct local solar-disc
  camera radiance, local ground bounce, and Mars/non-Earth extensibility.

Acceptance:

- A concise promotion plan names files/modules to keep, rewrite, or discard.
- The plan identifies which POC assumptions are safe for production and which
  must fail loudly or become configuration.
- Normal production rendering does not depend on JSON scene packets.
- Remaining deferred physics work is documented separately from integration
  work, so local-source incompleteness does not get mistaken for a Three
  shader integration problem.

## Fresh-Agent Starting Procedure

On bootstrap or after compaction for this task:

1. Load `agents/topics/active-topic.md`.
2. Load `agents/topics/apps/flat/README.md` only through its current-task
   routing note.
3. Load `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`.
   Treat it as the current source of truth for Algorithm32 steps,
   abstractions, endpoint status, open issues, and production followups.
4. Load `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/README.md`.
5. Load this document only far enough to read the accepted Milestone 8 through
   Milestone 13 summary, `Shared Soft-Shader Contract`, the accepted Milestone
   14 through Milestone 19 soft-shader runway, the accepted Milestone 20
   through Milestone 29 shader/soft-shader parity runway, the accepted
   Milestone 30 through Milestone 38 Three-native atmosphere-pass runway, and
   `Current Next Iteration`.
6. Inspect `scripts/flat/algorithm32-shader-lab/README.md` only far enough to
   read the source-contract block beginning with
   `The accepted CPU source-contract runway is`, plus command examples if a
   command shape is needed.
7. Load `algorithm32-shader-lab-plan.md` only when adapter framework,
   browser-harness, or prior shader-lab detail is needed.

Do not reopen the closed environment-object numbered experiment lane or older
Flat atmosphere implementation docs unless the user explicitly asks for that
history.

## Current Next Iteration

The CPU local-source integration runway is accepted through `078`, the
browser-lit scene-input CPU postprocessor milestone is accepted through `081`,
and the CPU/browser soft-shader runway is accepted through `094`. The
packet-based shader runway is accepted through Milestone 29 at
`193-soft-shader-capability-parity-matrix`. The Three-native atmosphere-pass
runway is now accepted through Milestone 38: `218` proves the
`Algorithm32AtmospherePass` shell and identity passthrough, `212` proves
depth-to-ray reconstruction from a Three `DepthTexture`, `216` proves distant
first-order atmosphere in the live pass, `217` proves live camera controls,
`220` proves flat/local first-order atmosphere, `222` proves unified
source/geometry adapter switching, `224` proves the live-pass-vs-soft-shader
matrix, `225` proves interactive scenario/debug controls, and `226` records
the production-shape review. Treat
`226-three-native-production-shape-review` as the current shader-lab endpoint,
`224-three-native-live-pass-soft-shader-matrix` as the current objective
live-pass parity evidence, `094` as the unified source-driven CPU oracle, and
`054` only as the prior fixed distant-Sun browser shader endpoint.

The accepted Three-native POC turns the packet-based GPU shader proof into the
target integration shape: a Three-native `Algorithm32AtmospherePass` that
colors a live Three-rendered world with camera controls. The normal render
path is:

```text
Three scene render -> scene color render target + depth texture
Algorithm32AtmospherePass -> final view
```

JSON scene packets remain useful only for validation/oracle construction and
artifact reporting. They are not the normal input path. The shader is
integrated as a Three fullscreen pass over Three-owned render targets, not as
a detached raw-WebGL artifact renderer and not by duplicating Algorithm32
logic into every object material.

The next work is production promotion: move the accepted pass shape, source
and geometry config contract, Three light adapters, depth/render-target
lifecycle, and useful debug views out of the lab POC into the official
Algorithm32 implementation. Remaining physics/model work is deliberately
separate: local second-order cache support, direct local solar-disc camera
radiance, local ground bounce, Mars/non-Earth presets, and HDR/float transport
policy beyond the current RGBA8 POC readback. Superseded artifact `168` is
incomplete because nested child-process harness spawning failed with
`spawn EPERM`; use direct shell-level
`node scripts/flat/algorithm32-shader-lab/harness.js --once --command ...`
commands or already accepted browser artifacts for reruns.

Subjective Three-light source inspection is accepted in
`104-three-lit-subjective-source-scenes`, superseding `099` because the first
local `90` degree view pointed away from the mountain composition. It uses the
running browser harness to render the mountain scene with real white Three
lights before the CPU Algorithm32 postprocess: distant midday and distant
sunset behind camera use source-driven `DirectionalLight`, while local closest
approach and local `90` degree orbit use source-driven `PointLight` at the
configured flat/local Sun position. For local views, the PointLight disables
Three distance decay and scales intensity by the accepted observer incident
scale; Algorithm32 remains the authority for true finite source position,
source distance/falloff, and source-path transmittance. This is visual
inspection only, not a replacement for objective shader parity milestones.

The direct radiance math remains accepted for the fixed spherical, distant-Sun
Algorithm32 profile on the simple scene: selected-pixel second-order parity is
accepted in `041` through `045`, analytic full-image second-order parity is
accepted in `048`, JS Raycaster scene-input parity is accepted in `051`,
GPU-rendered scene-input parity is accepted in `053`, and direct GPU texture
scene-input parity is accepted in `054`. Treat `054` as the accepted fixed
distant-Sun shader endpoint before source-contract shader work, treat `081` as
the accepted first CPU software-shader/postprocessor oracle over browser-lit
scene input, treat
`083` as the accepted unlit parity matrix, `084` as the accepted lit/shadow
soft-shader matrix, `086` as the accepted source-to-scene-light coupling
validation, `091` as the accepted distant-Sun position matrix, `093` as the
accepted local-Sun soft-shader source matrix, `094` as the accepted unified
CPU source-driven matrix, `177` as the accepted first unified shader matrix,
and `193` as the corrected soft-shader capability parity matrix.
Keep using the user-owned watch loop for browser artifacts when its heartbeat
is current. If the heartbeat is stale or unavailable, use the already approved
direct one-shot harness command from the shell rather than launching Chrome
from nested experiment code. Do not launch Chrome from the agent tool path
unless the user explicitly asks to test that path again.

Performance benchmark scaffolding now exists as `browser-shader-benchmark`,
but performance work is currently parked unless the user explicitly resumes
it. Accepted smoke artifact
`067-browser-shader-benchmark` proves the page returns structured benchmark
diagnostics for the current second-order GPU-direct scene-input pass, but the
current Chromium/WebGL backend did not expose
`EXT_disjoint_timer_query_webgl2`, so no isolated GPU timing baseline exists.
Artifact `069-browser-shader-benchmark` used aggressive batching and should be
treated only as a cautionary artifact. If performance work resumes later, use
`tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json`,
whose defaults are intentionally conservative: small sample counts, an async
yield between samples, and no `gl.finish()` fallback unless explicitly
requested. Future browser benchmark runs must use a dedicated user-owned
harness/browser process or exact process ownership; do not clean up by killing
generic `chrome` processes.

If continuing the flat-earth visibility offshoot instead, start from accepted
artifact `062` for milestone thresholds, `065` for high-resolution milestone
inspection images, or `056` for the original cannot-see binary search. Treat
target dimensions, render resolution, camera FOV, sky path cap, and the encoded
RGB threshold as explicit inputs. The rejected `057` wide-target stress run and
diagnostic `058` show that the nearest non-appearance distance is not a single
atmosphere-only constant; it is a render-and-target-specific quantity.

If moving from the offshoot into production flat shader design, use
[Production Flat Shader Differences](production-flat-shader-differences.md) as
the contract checklist. Flat support should change geometry, path endpoints,
optical-length coordinates, Sun transmittance, and cache keys while keeping the
Algorithm32 clear-air atmosphere physics unchanged.

Current flat-production discussion: the first target is a configurable
flat-earth local Sun, with user-facing latitude model, altitude, radius/size,
and brightness/luminosity. Treat those values as explicit flat-model
hypothesis parameters. The default Sun latitude uses an annual
`annual-tropic-migration` model between `23.5 deg N` and `23.5 deg S`; the
default daily motion uses a solar-day period around the date-resolved projected
latitude ring. Sidereal rotation stays reserved for the star dome or an
explicit advanced option. Older Flat POC/status notes identified a fixed
`config.sun.lat` control; that is superseded by `config.sun.latitude` plus
`config.sun.altitudeKm` and `config.sun.radiusKm`. The older rejected
reference docs record secondary claim breadcrumbs such as a small local Sun
around `32 mi` across and `3000 mi` above Earth. Those older docs are useful
for provenance and UI intent, not as physics authority. The implementation
recommendation is direct, first-order, selected-pixel flat local-Sun parity
before second-order caches, LUTs, reduced channels, or performance tuning.

The abstraction target is a unified source-sampling contract, not separate
atmosphere algorithms for distant and local Suns. CPU Algorithm32 and the
shader should both ask the active source for incident source samples at each
atmosphere sample position. A distant Sun returns one infinite-distance
directional sample; a local Sun returns one finite-distance sample with
position-dependent direction, distance, source scale, and source-path
transmittance. The shader may use different texture/LUT adapters for distant
and local sources, but the path-radiance integrator and output contract should
stay shared. See
[Production Flat Shader Differences](production-flat-shader-differences.md)
and [Algorithm32 Module Design](algorithm32-module-design.md). Algorithm32
should own the canonical cache plan or cache texture data for a given
sun/source configuration; renderer code should upload and bind those textures
instead of inventing independent cache coordinates.

First milestone for that refactor: implement the source-sampling abstraction
with only the default `distant-directional-sun` adapter and prove there is no
behavior change. The accepted experiment 032 / Figure 1 sky-dome path had to
reproduce the current default distant-Sun output before any `local-point-sun`
or flat local-Sun adapter was added. Preserve the current spectral solar
irradiance, constant Sun direction, sample-to-top-atmosphere transmittance
meaning, no-direct-solar-disc camera policy, and second-order distant-Sun cache
behavior.

Second milestone for that refactor: add the flat local point Sun as a source
object that supplies finite, position-dependent source samples to the
Algorithm32 first-order scattering path. The app is only a configuration
source for San Jose/default false-Sun values; projection, closest approach,
transport-space source placement, distance/falloff, source-path transmittance,
and renderer-scoped skydome ray length are computed inside
`scripts/flat/atmosflat32/run.js`. The ray length limit belongs to the
skydome renderer; scene renderers should provide their own segment lengths.
The additional flat-Earth "flashlight Sun" claim should be treated as a later
source emission-profile variant: the source object would attenuate incident
light by angle from its beam axis before Algorithm32 transport, and the beam
axis, cone angle, softness/falloff, spectral scale, and energy policy would
be part of the source/cache key. Do not approximate this by post-render
darkening. First validation should prove the omnidirectional case is unchanged,
the cone center remains bright, outside-cone samples attenuate as configured,
edge softness is monotonic, and distant-Sun regression remains exact. For a
shader path, either compute the same angular emission scale analytically in
GLSL or include every angular-emission field in the source-field cache key.
Direct solar-disc camera radiance, ground bounce, local-source second-order
caches, and shader texture lookup remain deferred.

Use the recent shader-lab experimental style for this work: append-only
artifacts, structured command/config/result files, explicit criteria, reports,
and enough diagnostics for a fresh agent to continue. Do not continue the
original `bruneton_start_fresh` numbered experiment lane. Borrow only the
needed sky-dome generation mechanics from
`scripts/flat/experimental/bruneton-start-fresh.js` so the new source
abstraction can prove it still generates the accepted Algorithm32 / Figure 1
domes. Use `scripts/flat/atmosflat32/` as the script folder and
`tmp/atmosphere/atmosflat32/` as the append-only output root. The working
prompt is
[Atmosflat32 Source Abstraction Prompt](atmosflat32-source-abstraction-prompt.md).

After that first configurable-Sun/default-Sun integration is accepted, keep
developing the extended model in the same lane and expand validation beyond
subjective sky-dome review. Use the domes as visible acceptance artifacts, but
base the testing strategy on objective checks: distant-Sun regression/parity,
selected-ray spectral diagnostics, transmittance/cache parity, mathematical
contracts for local-source direction, distance/falloff, altitude/time motion,
optical-depth limits, black-source and zero-density limits, far-away-local-Sun
and point-source limiting cases, symmetry checks, convergence tests,
CPU-vs-shader parity, cache interpolation error bounds, numeric image diffs,
and same-config reproducibility. The local flat-Sun branch should be judged by
internal consistency, limiting-case behavior, and implementation parity rather
than by an external real-world reference target.

Milestone 0 status: accepted first in
`tmp/atmosphere/atmosflat32/002-distant-source-abstraction-baseline/` and
revalidated after the renderer-scoped flat sky ray-limit/source-configuration
cleanup in
`tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`. The
Node POC runner in `scripts/flat/atmosflat32/run.js` routes the default
`distant-directional-sun` through a source object/configuration path while
reproducing the four step-032 Figure 1 domes byte-for-byte. Criteria summary:
`9` pass, `0` fail, `0` unresolved; selected-ray radiance, second-order, and
direct Sun transmittance deltas are all `0`. `017` remains the previous
calibrated observer-sky regression and `015` remains the previous
artificial-cap regression.

Closest-approach local-source fixture status: accepted in
`tmp/atmosphere/atmosflat32/005-flat-app-closest-san-jose-position/`. The POC
uses the app only for San Jose/default false-Sun configuration and computes
projection, closest approach, finite source direction/distance, and apparent
size independently in `scripts/flat/atmosflat32/run.js`. It records a
`flat-local-point-sun` at San Jose closest approach with `10` passing criteria
and map/sky-marker PNGs; use it only as source-placement evidence before local
Sun scattering work.

Rotation observer sky first-order status: accepted in
`tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/`. It generated
five pure Algorithm32 flat/local first-order observer angular sky PNGs for the
same app-config local false Sun placement at offsets `0`, `45`, `90`, `135`,
and `180` degrees from closest San Jose approach. The image loop matches the
round distant-Sun dome method; transport uses observer `[0, 0, 2]` meters,
flat altitude/density on z, and local-source checks supplied by
`atmosphereGeometry` configuration. The round-equivalent artificial cap is now
a skydome-renderer `skyViewRayLengthLimit` centered at
`[0, 0, -6360000]` meters with radius `6420000` meters and observer-level
footprint radius `875.656645 km`; it is not used for source transmittance or
scene-renderer ray length. Source transmittance uses the configured flat top
atmosphere plane and finite source distance. Transport brightness is
calibrated so closest approach equals `1x` distant-Sun incident scale,
replacing raw app `solarIrradianceScale: 58` with calibrated transport
`solarIrradianceScale: 1.1071748923354825`; the 180-degree case now has
incident scale `0.12922172063575063` and remains lit because the source is
above the flat horizon. Direct solar-disc camera radiance, ground bounce, and
local-source second-order cache behavior remain deferred. `018` supersedes
`016`, `014`, `012`, and `010`.
