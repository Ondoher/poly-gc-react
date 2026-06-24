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
not a replacement for the spherical endpoint. Local Sun behavior, changing Sun
configuration, app texture rebuilds, clouds, and production integration remain
later model and product layers unless the user explicitly redirects to one of
them.

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

## Fresh-Agent Starting Procedure

On bootstrap or after compaction for this task:

1. Load `agents/topics/active-topic.md`.
2. Load `agents/topics/apps/flat/README.md` only through its current-task
   routing note.
3. Load `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/README.md`.
4. Load this document.
5. Load `algorithm32-shader-lab-plan.md` only when browser harness or prior
   shader-lab detail is needed.
6. Inspect `scripts/flat/algorithm32-shader-lab/README.md` and the shader-lab
   scripts before editing.

Do not reopen the closed environment-object numbered experiment lane or older
Flat atmosphere implementation docs unless the user explicitly asks for that
history.

## Current Next Iteration

Continue objective shader parity by removing the remaining experimental bridge
around scene-input transfer.

The direct radiance math is accepted for the fixed spherical, distant-Sun
Algorithm32 profile on the simple scene: selected-pixel second-order parity is
accepted in `041` through `045`, analytic full-image second-order parity is
accepted in `048`, JS Raycaster scene-input parity is accepted in `051`,
GPU-rendered scene-input parity is accepted in `053`, and direct GPU texture
scene-input parity is accepted in `054`. The next serious iteration should
turn this experimental proof into a production-style depth/material texture
contract or a Three-owned atmosphere composition pass that avoids private
texture-handle coupling. Keep using the user-owned watch loop for browser
artifacts. Do not launch Chrome from the agent tool path unless the user
explicitly asks to test that path again.

Performance benchmark scaffolding now exists as `browser-shader-benchmark`,
but performance work is currently parked while the design discussion moves to
configurable flat-earth local Sun support. Accepted smoke artifact
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
flat-earth local Sun, with user-facing latitude, altitude, radius/size, and
brightness/luminosity. Treat those values as explicit flat-model hypothesis
parameters. The default Sun motion should use a solar-day period around the
configured projected latitude ring; sidereal rotation stays reserved for the
star dome or an explicit advanced option. Older Flat POC/status notes already
identified `config.sun.lat`, `config.sun.altitudeKm`, and
`config.sun.radiusKm` as first false-Sun controls, and the older rejected
reference docs record secondary claim breadcrumbs such as a small local Sun
around `32 mi` across and `3000 mi` above Earth. Those older docs are useful
for provenance and UI intent, not as physics authority. The implementation
recommendation is direct, first-order, selected-pixel flat local-Sun parity
before second-order caches, LUTs, reduced channels, or performance tuning.
