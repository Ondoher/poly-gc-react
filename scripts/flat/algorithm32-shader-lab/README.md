# Algorithm32 Shader Lab

This folder is the experimental Algorithm32 shader lab. It now has two proven
bootstrap layers:

- a browser-control smoke harness for long-running Puppeteer reload loops;
- a Node/Three CPU reference runner that drives Algorithm32 from Three camera
  rays and Raycaster hits without launching Chromium.

The Node/Three layer is the current oracle bootstrap for shader work. It proves
that scene geometry can feed Algorithm32 directly before any shader adapter
exists.

## Current Iteration

The immediate plan is:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md
```

Iteration 1, Browser Three Scene Baseline, is accepted. The agent-launched
browser-control branch is blocked, but the user-owned manual Puppeteer harness
launch works. The latest accepted manual browser baseline is
`018-browser-three-baseline`, produced by `harness.js --once` in `629 ms`.
The user-owned watch loop is also accepted in
`020-browser-three-baseline-watch-reload-check`: editing the watched command
file reloaded the page and wrote a fresh artifact. Iteration 2 is accepted in
`021-browser-ray-depth-diagnostics` and
`022-browser-ray-depth-diagnostics-comparison`; selected browser rays and hit
distances match the independent Node/Three reconstruction exactly within the
recorded tolerances. Iteration 3 is accepted in
`025-browser-atmosphere-components` and
`026-browser-atmosphere-components-shader-comparison`; selected-pixel
atmosphere components match the Node reference, and the WebGL2 diagnostic
shader readback matches browser JS within the recorded tolerances. Iteration
4.1 is accepted in `027-browser-direct-radiance` and
`028-browser-direct-radiance-comparison`; one-wavelength 532 nm first-order
selected-pixel radiance matches the independent Node reference and WebGL2
shader readback. Iteration 4.2 is accepted in
`030-browser-direct-radiance-spectral` and
`031-browser-direct-radiance-spectral-comparison`; all 15 Algorithm32
first-order spectral channels match the independent Node reference and WebGL2
shader readback for selected pixels. `032-browser-first-order-image` accepts
the first full-image 15-channel first-order shader pass for the simple browser
scene. Objective pairing `038-browser-first-order-image-objective-simple-scene`
compares that shader class against full CPU Algorithm32 reference `037` and
records the expected missing second-order contribution. First-order isolation
pairing `040-browser-first-order-image-first-order-isolation` compares against
CPU first-order reference `039` and shows near-exact agreement, so the current
full-image shader is first-order-correct. `048-browser-second-order-image`
accepts the full-image second-order shader path on the analytic simple scene
against CPU Algorithm32 reference `037`.
`051-browser-scene-input-second-order-image` accepts the same shader consuming
a per-pixel browser JS Three Raycaster distance/spectrum texture instead of
shader-local analytic intersections.
`053-browser-gpu-scene-input-second-order-image` accepts a GPU-rendered
scene-input target feeding the atmosphere shader through a readback/upload
bridge. `054-browser-gpu-direct-scene-input-second-order-image` accepts direct
binding of that GPU render-target texture into the experimental atmosphere pass
without scene-input readback/upload for shader input. Current subjective
progress snapshots
`049-browser-mountain-second-order-front-high-sun` and
`050-browser-mountain-second-order-sunset-behind-camera` render the mountain
pair through the second-order shader path and include `side-by-side.png` beside
CPU Algorithm32 references from `033` and `034`. Those mountain comparisons
are for progress visibility only, not objective shader acceptance.
The latest flat-earth visibility offshoot is accepted in
`056-browser-flat-earth-visibility-search`: with standard Algorithm32
atmosphere constants, flat-slab geometry, first-order scattering, a `10 km x
10 km` matte black card, `2 m` camera height, `24 deg` vertical FOV, and
`maxAbsRgbDelta <= 1` as the display criterion, the closest non-appearing
distance is `1,926.774 km`. `055` is rejected due to a bracketing bug, and
`057` is rejected because a `100 km`-wide stress card remained visible at the
`3,000 km` cap. Visibility-loss milestones for the original `10 km x 10 km`
target are accepted in `062-browser-flat-earth-visibility-search`: `50% lost =
21.480 km`, `75% lost = 601.563 km`, `80% lost = 776.563 km`, `90% lost =
1,228.125 km`, `95% lost = 1,543.750 km`, and `100% lost/cannot see =
1,926.774 km`.
Shader performance benchmark mode now exists as
`browser-shader-benchmark`. Smoke artifact `067-browser-shader-benchmark`
proved the mode returns structured benchmark diagnostics, but Chromium's
WebGL backend in this session did not expose
`EXT_disjoint_timer_query_webgl2`, so no isolated GPU pass time was captured.
Artifact `069-browser-shader-benchmark` used aggressive batching and should be
treated as a cautionary artifact only; it led to conservative benchmark
defaults, an async yield between samples, and no `gl.finish()` fallback unless
explicitly requested.

## Commands

Run one smoke pass and exit:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --once
```

Run a long-lived harness that watches a command file:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --watch
```

Run the shader benchmark smoke command:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --once --command tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json
```

Benchmark mode is intentionally conservative by default:

- `warmupFrames`: `3`;
- `measuredFrames`: `10`;
- `drawsPerSample`: `3`;
- `sampleDelayMs`: `16`;
- `includeFinishFallback`: `false`.

Use a dedicated browser process for heavier runs. Do not clean up benchmark
runs by killing generic `chrome` processes; that can close unrelated user
browser windows.

Run the bounded Karma fallback for the browser baseline:

```text
node .\node_modules\karma\bin\karma start scripts\flat\algorithm32-shader-lab\karma-browser-baseline.conf.cjs
```

This command is rejected in this session after artifacts `014` and `015`; keep
it for code reference, not as the next blind retry path.

Run the Node/Three CPU Algorithm32 reference:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js
```

Render the no-object sunset floor scene:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene sunset-floor --width 320 --height 180 --label sunset-floor
```

Render the less-zoom sunset floor scene:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene sunset-floor --sunset-framing less-zoom --width 320 --height 180 --label sunset-floor-less-zoom
```

Render the subjective mountain-ridge scene:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene mountain-ridges --width 480 --height 270 --label mountain-ridges-framed-large
```

Render the mountain-ridge scene with the low-Sun sunset case behind the camera:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene mountain-ridges --mountain-view sunset-behind-camera --width 480 --height 270 --label mountain-ridges-sunset-behind-camera
```

Package a browser shader image with an existing CPU Algorithm32 reference image:

```text
node scripts/flat/algorithm32-shader-lab/browser-shader-side-by-side.js --reference-run <reference-artifact-folder> --shader-run <shader-artifact-folder>
```

Default outputs are written under:

```text
tmp/atmosphere/algorithm32_shader_lab/
```

In watch mode, edit or replace:

```text
tmp/atmosphere/algorithm32_shader_lab/command.json
```

Each command change reloads the page and writes a new numbered run folder.

The accepted Node/Three reference artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/
```

It contains `reference-image.png`, `object-mask.png`, geometry diagnostics,
transport diagnostics, source references, and `criteria-results.json`.

The accepted sunset floor scene artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/
```

It uses the low-Sun Figure 1 case, contains no card objects, renders a
grass-green floor, and computes the sky/floor through the Algorithm32 spectral
transport path. Artifact `004-sunset-floor` is rejected because the first
synthetic floor spectrum clipped red and green together, reading yellow instead
of grass green.

The current less-zoom version requested after `005` is:

```text
tmp/atmosphere/algorithm32_shader_lab/006-sunset-floor-less-zoom/
```

It keeps the same no-object floor/sky scene but uses a `92 deg` vertical FOV
instead of the balanced framing.

The current subjective mountain-range scene is:

```text
tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/
```

It uses procedural layered ridge silhouettes and a valley floor through the
same Three raycast plus Algorithm32 sky/object transfer path. It is a CPU-only
Algorithm32 reference preview, not a shader-path render. Artifacts `007`
through `012` are older or superseded forward mountain iterations. This scene
is intentionally subjective and has `0` formal criteria; acceptance means the
preview artifact rendered successfully.

The current alternate sunset-behind-camera mountain view is:

```text
tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/
```

It uses the same procedural ridge layout with `--mountain-view
sunset-behind-camera`, switches to the low-Sun `figure1-06h00-z87` case, and
orients the camera so the Sun direction is behind the viewer. Like `012`, it
is subjective and has `0` formal criteria by design.

Latest user clarification: mountain shader/reference comparisons are only for
seeing progress. Do not tune or accept the shader based on those subjective
views; continue the objective shader parity ladder.

The current rejected browser-control artifacts are:

```text
tmp/atmosphere/algorithm32_shader_lab/014-browser-three-baseline-karma/
tmp/atmosphere/algorithm32_shader_lab/015-browser-three-baseline-karma/
```

`014` failed before browser launch with `spawn EPERM`. `015` exceeded the
45 second outer timeout after browser-launch permission was granted and did not
produce browser diagnostics.

The current accepted manual browser-control artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/
```

It proved the existing harness works when the user launches it manually. It
supersedes `017` because the projected card-center samples hit all three
intended card objects.

The current accepted watch-mode reload artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/
```

It proves the user-owned persistent runner observes command-file edits, reloads
the open browser page, and writes fresh accepted artifacts.

The current accepted ray/depth comparison artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/022-browser-ray-depth-diagnostics-comparison/
```

It proves browser-selected rays and hit distances match the independent
Node/Three scene for the simple diagnostic scene.

The current accepted atmosphere-component shader comparison artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/026-browser-atmosphere-components-shader-comparison/
```

It proves browser JS atmosphere components, Node recomputation, and WebGL2
diagnostic shader readback agree for selected sky, object, and ground pixels.

The current accepted one-wavelength direct-radiance shader comparison artifact
is:

```text
tmp/atmosphere/algorithm32_shader_lab/028-browser-direct-radiance-comparison/
```

It proves first-order Rayleigh, Mie, path, object-transmitted, and final
radiance at 532.333333333333 nm agree across browser JS, independent Node
recomputation, and WebGL2 shader readback for selected pixels. It deliberately
does not claim full spectral, second-order, or image-level Algorithm32 parity.

The current accepted full-spectral direct-radiance shader comparison artifact
is:

```text
tmp/atmosphere/algorithm32_shader_lab/031-browser-direct-radiance-spectral-comparison/
```

It proves first-order spectral radiance across all 15 Algorithm32 wavelengths
for selected pixels. It still does not claim second-order or image-level
Algorithm32 parity.

The current accepted full-image first-order shader artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/032-browser-first-order-image/
```

It renders the simple browser card scene through the 15-channel first-order
shader path and checks selected display pixels against the browser JS spectral
preview.

The current objective full Algorithm32 image pairing is:

```text
tmp/atmosphere/algorithm32_shader_lab/038-browser-first-order-image-objective-simple-scene/
```

It pairs browser first-order shader output against CPU Algorithm32 reference
`037-algorithm32-simple-card-reference` and records the missing second-order
shader contribution as the known solver difference. The display-space diff is
`maxAbsRgbDelta = 38`, `meanAbsRgbDelta = 11.354444444444445`,
`p95PixelMaxAbsRgbDelta = 33`, and `p99PixelMaxAbsRgbDelta = 35`.

The current first-order isolation pairing is:

```text
tmp/atmosphere/algorithm32_shader_lab/040-browser-first-order-image-first-order-isolation/
```

It pairs browser first-order shader output against CPU first-order reference
`039-algorithm32-first-order-simple-card-reference`. The display-space diff is
`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0015277777777777779`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`, proving the
current full-image shader path is first-order-correct.

The current accepted full-image second-order simple-scene pairing is:

```text
tmp/atmosphere/algorithm32_shader_lab/048-browser-second-order-image/
```

It pairs browser second-order shader output against CPU Algorithm32 reference
`037-algorithm32-simple-card-reference`. The display-space diff is
`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0017824074074074075`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`, proving the
current direct shader path is Algorithm32-correct for the analytic simple
scene.

The current accepted scene-input second-order simple-scene pairings are:

```text
tmp/atmosphere/algorithm32_shader_lab/051-browser-scene-input-second-order-image/
tmp/atmosphere/algorithm32_shader_lab/053-browser-gpu-scene-input-second-order-image/
```

`051` consumes a browser JS Three Raycaster texture with per-pixel distance,
numeric spectrum id, and hit flag. It matches CPU Algorithm32 reference `037`
with display-space `maxAbsRgbDelta = 1`, `meanAbsRgbDelta =
0.0017824074074074075`, `p95PixelMaxAbsRgbDelta = 0`, and
`p99PixelMaxAbsRgbDelta = 0`.

`053` consumes the same scene-input contract generated by a GPU render target,
then read back and uploaded into the experimental raw WebGL atmosphere pass.
It fixes rejected artifact `052`, where the scene background was accidentally
encoded into sky pixels. `053` has selected-pixel `maxSelectedRgbDelta = 1`.
Its image diff against `037` is `maxAbsRgbDelta = 182`, `meanAbsRgbDelta =
0.8947337962962963`, `p95PixelMaxAbsRgbDelta = 4`, and
`p99PixelMaxAbsRgbDelta = 21`, which is currently classified as edge and
rasterization placement movement rather than atmosphere-radiance drift.

`054` uses the same GPU render target as `053` but binds the Three WebGL
texture directly into the experimental raw WebGL atmosphere pass through a
private Three texture handle. It does not use scene-input readback/upload for
shader input. It has selected-pixel `maxSelectedRgbDelta = 1` and the same
image diff against `037` as `053`.

The accepted flat-earth visibility-search artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/
```

It renders a contact-sheet screenshot and records the binary-search diagnostics
for the closest distance where the object-present render is display-
indistinguishable from the no-object render under the recorded inputs. The
accepted threshold is `1,926.774 km`; the object still covers `2` search pixels
at that threshold, while zero-pixel disappearance occurs later in the sweep.
The rejected companion artifacts are:

```text
tmp/atmosphere/algorithm32_shader_lab/055-browser-flat-earth-visibility-search/
tmp/atmosphere/algorithm32_shader_lab/057-browser-flat-earth-visibility-search/
tmp/atmosphere/algorithm32_shader_lab/058-browser-flat-earth-visibility-search/
```

`055` used the same physical target but skipped the configured max-distance
bracket before the fix. `057` widens the target to `100 km` while keeping the
same `10 km` height and remains visible at `3,000 km`, which documents that
the non-appearance distance is target/render specific. `058` reruns the same
wide-target case with diagnostic `Diff x24` and `Object mask` panels because
the normal RGB composite makes the few remaining object pixels almost
impossible to see by eye.

The accepted milestone-threshold artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/
```

It interprets the requested percentages as visibility lost, so `95%` means
`5%` visible and `100%` means cannot see. It supersedes `060`, which drew the
thresholds on the screenshot but did not serialize them into diagnostics.
`059` is an incomplete over-expensive watch run, and `061` is an incomplete run
from a screenshot-label helper error.

The accepted high-resolution visual inspection gallery is:

```text
tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/canvas-image.png
```

It renders each milestone as full normal scene, zoomed normal crop, amplified
`Diff x24` crop, and object-mask crop. Use `canvas-image.png` rather than
`screenshot.png`; the harness now saves native canvas PNGs when the browser
result includes an image data URL. Artifact `064` is superseded because the
first gallery used stale canvas dimensions and placed the content too small in
the upper-left corner.

The older first-order subjective shader progress artifacts are:

```text
tmp/atmosphere/algorithm32_shader_lab/035-browser-mountain-shader-front-high-sun/
tmp/atmosphere/algorithm32_shader_lab/036-browser-mountain-shader-sunset-behind-camera/
```

Each contains `algorithm32-reference-image.png`, `shader-image.png`, and
`side-by-side.png`. The reference side is the CPU Algorithm32 Node/Three path
from artifacts `033` and `034`; the shader side is first-order only.

The current second-order subjective shader progress artifacts are:

```text
tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/
tmp/atmosphere/algorithm32_shader_lab/050-browser-mountain-second-order-sunset-behind-camera/
```

Each contains `algorithm32-reference-image.png`, `shader-image.png`,
`side-by-side.png`, `diff-image.png`, and
`shader-reference-comparison.json`. These are visual review artifacts only.
The front high-Sun view records display-space `maxAbsRgbDelta = 53`,
`meanAbsRgbDelta = 0.012150205761316873`, `p95PixelMaxAbsRgbDelta = 0`, and
`p99PixelMaxAbsRgbDelta = 0`. The sunset-behind-camera view records
`maxAbsRgbDelta = 27`, `meanAbsRgbDelta = 0.0033024691358024692`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`.

## Design Direction

The lab should grow in layers:

1. Browser-control smoke loop: reload page, return JSON, capture screenshot.
2. Node/Three CPU geometry reference: camera rays and raycaster hits without
   Chromium. Status: accepted in artifact `003`.
3. Browser/Three scene pipeline: shared color/depth inputs and shader adapter
   interface.
4. Raw or near-raw Algorithm32 validation path.
5. Experimental shader variants measured against the Algorithm32 reference.

The harness should stay responsible for browser lifecycle, command dispatch,
capture, and artifact writing. The page should stay responsible for browser-side
rendering and shader diagnostics.

The full current plan is documented in:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md
```

The broader harness/background plan is:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md
```
