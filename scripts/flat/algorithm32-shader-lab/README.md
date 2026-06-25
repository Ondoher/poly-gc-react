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
Milestone 13 is accepted in `080-browser-lit-scene-input-capture` and
`081-browser-lit-scene-input-cpu-postprocessor`: the existing watch harness
captured unlit and lit/shadow browser scene-input packets, and the CPU
software-shader postprocessor reproduced the original unlit CPU renderer with
`maxAbsRgbDelta = 0` before rendering the lit/shadow packet.

## Commands

Run one smoke pass and exit:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --once
```

Run a long-lived harness that watches a command file:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --watch
```

The harness defaults to a `300000 ms` browser navigation/evaluation timeout so
heavier subjective captures, such as detailed mountain Raycaster packets, can
finish without relaunching with special flags. Override it when needed:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --watch --page-timeout-ms 420000
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
When a user-owned harness is already running with an explicit `--command`
argument, read:

```text
tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json
```

and write the command to its `commandPath` instead of assuming the default
`command.json`. In the current lab session, that path is:

```text
tmp/atmosphere/algorithm32_shader_lab/browser-three-baseline-command.json
```

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

The accepted CPU source-contract runway is:

```text
tmp/atmosphere/algorithm32_shader_lab/071-cpu-source-contract-distant-sun/
tmp/atmosphere/algorithm32_shader_lab/074-cpu-source-contract-distant-sun-matrix/
tmp/atmosphere/algorithm32_shader_lab/075-cpu-local-source-first-order-diagnostics/
tmp/atmosphere/algorithm32_shader_lab/076-cpu-source-contract-shader-packet/
tmp/atmosphere/algorithm32_shader_lab/078-cpu-local-source-integrated-render/
```

`071` routes `node-three-reference.js` through the source/geometry abstraction
for the default spherical `distant-directional-sun` and proves exact parity
against `037-algorithm32-simple-card-reference`. `074` runs the CPU distant-Sun
matrix as one aggregate artifact with nested `cases/` folders; the nested
folders are supporting evidence inside `074`, not top-level experiment
replacements. `075` validates the flat/local point-Sun source diagnostics
against accepted `atmosflat32` artifact `018` for the required `0`, `90`, and
`180` degree offsets. `076` writes pure JSON distant and local source packets;
the distant packet rehydrates into the CPU renderer with exact raw image,
selected diagnostics, and source-sample trace parity against Milestone 8. The
local packet marks local second-order cache, direct local solar-disc camera
radiance, and local ground bounce as unsupported or deferred. `078` reruns the
default spherical distant-Sun control and preserves exact parity against
`037-algorithm32-simple-card-reference`, then renders flat/local point-Sun CPU
images through the same `node-three-reference.js` image path. The closest/day
image is `local-source-closest-day.png`; the `90` degree orbit-offset
rise/sunset image is `local-source-090deg-rise-sunset.png`. Local first-order
scattering now samples source direction, source distance/falloff, spectral
incident scale, source-path transmittance, and phase per view-path sample. The
flat scene no-hit sky ray limit is explicit configuration seeded by accepted
visibility artifact `062` (`1,926.774 km` by default), not an Algorithm32
atmosphere constant and not the older atmosflat skydome cap.

CPU source-contract commands:

```text
node scripts/flat/algorithm32-shader-lab/node-three-reference.js --width 240 --height 120 --label cpu-source-contract-distant-sun --compare-reference tmp/atmosphere/algorithm32_shader_lab/037-algorithm32-simple-card-reference
node scripts/flat/algorithm32-shader-lab/cpu-source-contract-regression-matrix.js
node scripts/flat/algorithm32-shader-lab/cpu-local-source-first-order-diagnostics.js
node scripts/flat/algorithm32-shader-lab/cpu-source-contract-shader-packet.js
node scripts/flat/algorithm32-shader-lab/cpu-local-source-integrated-render.js
node scripts/flat/algorithm32-shader-lab/cpu-source-subjective-gallery.js
```

These CPU runners now execute without per-command escalation. The matrix
runner calls the shared CPU reference code in-process rather than spawning
child Node processes.

Milestone 13, Browser Lit Scene Input CPU Postprocessor, is accepted:

```text
tmp/atmosphere/algorithm32_shader_lab/080-browser-lit-scene-input-capture/
tmp/atmosphere/algorithm32_shader_lab/081-browser-lit-scene-input-cpu-postprocessor/
```

`080` used the currently running user-owned `harness.js --watch` process with
no relaunch. It captured a small browser scene-input packet for both
`unlit-material-control` and `lit-shadow-scene` through existing harness
outputs (`diagnostics.json`, `selected-pixels.json`, and `canvas-image.png`).
It passed `4/4` browser criteria and found a lit/shadow ground luminance delta
of `49.0064`.

`081` runs CPU Algorithm32 over the browser packet pixel by pixel. The unlit
control compares the original `node-three-reference.js` renderer against the
new CPU postprocessor with no Three lighting or shadows; it passed
byte-for-byte with `maxAbsRgbDelta = 0` and `meanAbsRgbDelta = 0`. The
zero-density scene-color passthrough also passed with `maxAbsDelta = 0`, and
the lit postprocess produced finite RGBA over all `14400` pixels. The lit RGB
composition is a first-POC display-domain pass over RGBA8 scene color; binary
or HDR packet output remains deferred unless precision becomes the blocker.

Milestone 14 is accepted in
`083-cpu-soft-shader-unlit-parity-matrix`. It ran the CPU soft-shader unlit
parity matrix for `simple-card-algorithm32`, `simple-card-first-order`, and
`sunset-floor-algorithm32`; aggregate criteria passed `4/4`, every case
passed `5/5`, and every old-renderer/soft-shader image comparison had
`maxAbsRgbDelta = 0`. Rejected diagnostic `082` had exact image parity but
failed selected-pixel bookkeeping before the selected-sample overwrite was
fixed.

Milestone 15 is accepted in `084-cpu-soft-shader-lit-scene-matrix`. It reused
browser capture `080` and passed `6/6` criteria: lit packet coverage,
zero-density scene-color passthrough with `maxAbsDelta = 0`, sky replacement,
post-atmosphere shadow/lit separation (`58.7244` luminance delta), and finite
RGBA over all `14400` pixels.

Milestone 16 is accepted in `085-browser-source-light-coupling` and
`086-cpu-source-light-coupling-validation`. The accepted browser packet uses
`sourceLightMode = distant-directional-sun` for `figure1-13h15-z21`, and the
CPU validation passed `8/8`: source/light direction delta
`3.46944695195361e-18`, no default-Sun fallback, calibration scalar and
directional intensity both `2.4`, exact zero-density passthrough, and
postprocess shadow/lit separation preserved.

Milestone 17 is accepted in browser captures `087` through `090` and aggregate
CPU artifact `091-cpu-distant-sun-position-matrix`. It passed `39/39`
criteria across high, low, synthetic side, and synthetic behind-camera distant
Sun cases. The CPU postprocessor now resolves packet-supplied distant Sun
altitude/azimuth into Algorithm32, so synthetic Sun packets no longer fall
back to the high-Sun default.

Milestone 18 is accepted in
`093-cpu-local-sun-soft-shader-source-matrix`. It passed `57/57` criteria:
aggregate `7/7`, distant control `5/5`, and each local offset case `9/9`.
Local offsets `0`, `45`, `90`, `135`, and `180` degrees all resolved as
`packet-supplied-flat-local-point-sun`, matched the original CPU local
renderer exactly, and preserved finite source traces.

Milestone 19 is accepted in
`094-cpu-unified-source-driven-soft-shader-matrix`. It passed `56/56`
criteria across distant high, distant low, and local `0`, `45`, `90`, `135`,
and `180` degree cases, all reprocessed through the same
`postprocessSceneInput` CPU soft-shader kernel. Distant cases use browser
lit/shadow packets and the source-driven `DirectionalLight`; local cases use
CPU-synthesized unlit packets and explicitly defer browser point-light/proxy
behavior.

Milestones 20 through 29 are accepted, with current endpoint
`193-soft-shader-capability-parity-matrix`. The accepted shader runway is:

```text
tmp/atmosphere/algorithm32_shader_lab/162-shader-oracle-packet-inventory/
tmp/atmosphere/algorithm32_shader_lab/167-gpu-packet-input-parity-no-atmosphere-passthrough/
tmp/atmosphere/algorithm32_shader_lab/171-packet-driven-distant-sun-shader/
tmp/atmosphere/algorithm32_shader_lab/172-distant-soft-shader-gpu-parity/
tmp/atmosphere/algorithm32_shader_lab/174-lit-scene-shader-composition/
tmp/atmosphere/algorithm32_shader_lab/176-local-sun-first-order-shader/
tmp/atmosphere/algorithm32_shader_lab/177-unified-source-driven-shader-matrix/
tmp/atmosphere/algorithm32_shader_lab/185-local-sun-full-image-shader-parity/
tmp/atmosphere/algorithm32_shader_lab/192-local-sun-scene-color-composition-parity/
tmp/atmosphere/algorithm32_shader_lab/193-soft-shader-capability-parity-matrix/
```

Browser evidence for those milestones includes
`166-browser-soft-shader-packet-passthrough`,
`169-browser-packet-driven-distant-sun-shader-distant-high`,
`170-browser-packet-driven-distant-sun-shader-distant-low`,
`173-browser-lit-scene-soft-shader-composition`, and
`175-browser-local-sun-first-order-diagnostics`, plus local full-image browser
runs `180` through `184` and local scene-color-composition browser runs `187`
through `191`. `167` records exact no-atmosphere scene-color passthrough
(`maxAbsDelta = 0`). `172` records full-image distant high/low CPU-vs-GPU
parity with `maxAbsRgbDelta = 1`, mean delta `0.0013020833333333333`, and p99
`0` for both cases. `174` records lit Three scene composition with exact
no-atmosphere passthrough, preserved shadow separation, and sky replacement.
`176` records local closest and local `90` degree first-order finite-source
diagnostics with max selected RGB delta `0`. `177` aggregates the distant,
lit-composition, and local diagnostic evidence into the first unified
source-driven shader matrix and passed `7/7`, but its local coverage was
selected diagnostics only. `185` closes local full-image spectrum-mode parity
for offsets `0`, `45`, `90`, `135`, and `180` degrees with `33/33` criteria,
full-image `maxAbsRgbDelta = 1`, p99 `0`, and selected delta `0`. `192`
closes local scene-color-composition parity for the same five offsets with
`33/33` criteria, full-image `maxAbsRgbDelta = 1`, p99 `1`, and selected
delta `0` or `1`. `193` aggregates `172`, `174`, `185`, and `192` into the
corrected soft-shader capability parity matrix and passed `6/6`.

Superseded diagnostic `168-packet-driven-distant-sun-shader` is incomplete
because nested child-process harness spawning failed with `spawn EPERM`.
Rerun browser evidence with the direct shell-level harness command instead:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --once --command tmp/atmosphere/algorithm32_shader_lab/<command-file>.json --page-timeout-ms 300000
```

Remaining deferred work is explicit and beyond the current CPU soft-shader
capability: local second-order cache support, direct local solar-disc camera
radiance, local ground bounce, HDR/binary packet transport, and production
promotion into the official Algorithm32 implementation.

The Three-native atmosphere-pass runway is accepted through Milestone 38. It
turns the packet-based GPU proof into the actual target POC: a live Three
scene with camera controls, Three lights/shadows, scene color and depth render
targets, and a Three-native `Algorithm32AtmospherePass` fullscreen shader
that colors the final view. JSON scene packets are validation/oracle artifacts
only; the normal render input is Three-owned render targets and live
camera/source/geometry uniforms. Evidence chain: `218` pass shell and
identity passthrough, `212` depth-to-ray reconstruction, `216` distant
first-order atmosphere, `217` live camera controls, `220` flat/local
first-order atmosphere, `222` unified source/geometry adapter switching,
`224` live-pass-vs-soft-shader matrix, `225` scenario/debug controls, and
`226` production-shape review. Use `226-three-native-production-shape-review`
as the current shader-lab endpoint and `224` as the current objective
live-pass parity evidence.

Subjective Three-light source scenes are accepted in
`104-three-lit-subjective-source-scenes`, superseding `099` because the first
local `90` degree view pointed away from the mountain composition. They render
the mountain scene in the browser with real white Three lights first, then
apply the CPU Algorithm32 postprocess over the captured scene color. The four
requested views are distant midday, distant sunset behind camera, local
closest approach, and local `90` degree orbit. Distant cases use source-driven
Three `DirectionalLight`; local cases use source-driven Three `PointLight` at
the configured flat/local Sun position. For the local subjective scene,
PointLight decay is disabled and intensity is scaled by the accepted observer
incident scale; Algorithm32 atmospheric transport still samples the true
finite local source position, distance/falloff, and source-path transmittance.
Treat `104` as visual inspection, not an objective shader acceptance
milestone.

The next subjective-detail runner is
`cpu-three-lit-subjective-source-scenes.js` with default label
`three-lit-detailed-subjective-source-scenes`. It builds a deterministic
`mountain-detail-v1` scene spec from `src/gc/utils/random.js`, sends that spec
to the browser, renders vertex-colored terrain meshes with real Three lights,
and postprocesses the captured scene through Algorithm32. Restart the harness
after the `--page-timeout-ms` change if its heartbeat does not record
`pageTimeoutMs: 300000`; the current user-owned process records the larger
timeout and can run the detailed `480 x 270` gallery.
The current detailed terrain generator uses one continuous indexed heightfield
mesh for the valley and mountains. It intentionally disables the older
independent terrain bands because those separate strips could leave visible
gaps at their boundaries.
Accepted single-mesh subjective artifact:
`157-three-lit-detailed-subjective-source-scenes`, superseding `119`, `124`,
`129`, `137`, rejected diagnostic `147`, and `152`. It passed `3/3` aggregate
criteria and all four cases passed `4/4`. The scene is gap-free, uses a single
darker uniform forest-green terrain mesh, raises the detailed-scene camera to
`6200 m`, and keeps the original `sky-and-hit-selected-samples` criterion
intact. `147` is rejected because all selected diagnostics hit terrain; `152`
fixes that by camera placement, not by changing criteria. `157` adds a broad
scene-bottom ground plane at `y = 0` so rays beyond the finite mountain mesh
hit ground instead of being rendered as sky. Future subjective tuning should
start from `157` and focus on camera/material/detail rather than returning to
independent terrain strips or weakening validation criteria.
Visual-only artifact `194-subjective-soft-vs-gpu-source-scenes` adds
side-by-side CPU soft-shader and current GPU shader subjective outputs for
distant midday, distant sunset behind camera, local closest, and local `90`.
It is useful inspection material, but it still replays captured scene packets
and is superseded by the accepted Three-native pass runway for integration
evidence.
Visual-only artifact
`227-postprocess-gpu-vs-integrated-shader-subjective-scenes` adds the direct
comparison requested after the Three-native pass runway: the existing
packet/postprocess GPU shader on the left and the integrated Three-native
`Algorithm32AtmospherePass` shader on the right for distant midday, distant
sunset behind camera, local closest, and local `90`. It writes
`postprocess-vs-integrated-gallery.png`, per-case postprocess GPU PNGs,
per-case integrated shader PNGs, diffs, and side-by-side panels. The run
passed `5/5` generation criteria; recorded deltas are for inspection, not a
new parity gate.

Terrain package reconnaissance for fixing subjective mountain gaps:
`three.terrain.js` is the best near-term fit for the lab because it generates
real Three mesh geometry from procedural terrain methods, supports ES module
imports, and only requires `three >=0.160.0`, while this repo currently uses
`three@0.180.0`. `@interverse/three-terrain-lod` is more suitable for a later
terrain subsystem or app scene because it brings quadtree LOD, edge skirts,
heightmap editing, and collision data, but its current peer dependency is
`three >=0.183.0` and shader/LOD displacement would need care so CPU
Raycaster packets match what the browser renders. `fractal-terrain-generator`
is an old diamond-square height-array utility and is better treated as an
algorithm reference than a dependency. `three-geo` is useful later for real
DEM/satellite terrain experiments, but it depends on geospatial tile services
and is not a good offline deterministic subjective-scene source.

The CPU/browser postprocessor runway is complete through Milestone 19, the
browser shader/soft-shader parity runway is complete through Milestone 29, and
the Three-native atmosphere-pass runway is complete through Milestone 38. Use
`226` as the current shader-lab endpoint, `224` as the current objective
live-pass parity evidence, `094` as the unified source-driven CPU oracle, and
`054` only as the prior fixed distant-Sun browser shader endpoint. The shared
packet contract is documented in `Shared
Soft-Shader Contract` in the iteration plan: scene packets feed the CPU soft
shader and the GPU postprocess shader through the same conceptual input shape.
That section also resolves the current packet defaults: top-left row-major
arrays, meter distances, `hitMask` semantics, RGBA8 display-domain POC limits,
source-packet ownership, and the required source/light direction convention
note. For Three-native work, use scene packets only for validation and keep the
normal render path as a Three-native atmosphere pass over live scene color and
depth render targets. Subjective artifacts `157`, `194`, and `227` are
visual-only context, not objective shader acceptance gates. This remains POC lab work in
`scripts/flat/algorithm32-shader-lab/`; the next step is production promotion
of the accepted pass shape, not another packet replay milestone.

Milestone 13 browser command seed:

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

Milestone 13 CPU command shape:

```text
node scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js --browser-run tmp/atmosphere/algorithm32_shader_lab/<NNN-browser-lit-scene-input-capture> --label browser-lit-scene-input-cpu-postprocessor
```

Accepted Milestone 13 CPU command:

```text
node scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js --browser-run tmp/atmosphere/algorithm32_shader_lab/080-browser-lit-scene-input-capture --label browser-lit-scene-input-cpu-postprocessor
```

The latest visual-only source gallery is:

```text
tmp/atmosphere/algorithm32_shader_lab/079-cpu-source-subjective-gallery/
```

It writes `subjective-gallery.png` plus individual panels for first-order
distant high Sun, distant low Sun, and flat/local Sun orbit offsets `0`, `45`,
`90`, `135`, and `180` degrees. It is for subjective inspection only; objective
CPU local-source integration remains accepted by `078`.

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

The source-contract, CPU-postprocessor, and POC browser-shader implementation
loop is documented as accepted Milestones 8 through 29 in:

```text
agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md
```
