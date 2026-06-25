# Active Topic

Current active topic: `flat`

Current focus: the Algorithm32 shader lab under
`scripts/flat/algorithm32-shader-lab/`, specifically the accepted
Three-native `Algorithm32AtmospherePass` POC and the next production-promotion
step. The configurable flat/local Sun `atmosflat32` POC is accepted as the
source of local-Sun placement and brightness calibration for the current CPU
and shader integration.

Canonical current reference:
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`.
Load this first for the current Algorithm32 steps, source/geometry
abstractions, accepted endpoint status, open issues, and production followups.

Current shader-lab endpoint:
`226-three-native-production-shape-review` is accepted as the current
shader-lab endpoint. It closes Milestones 30 through 38, the Three-native
atmosphere-pass runway. `224-three-native-live-pass-soft-shader-matrix` is the
current objective live-pass parity evidence, comparing the live
`Algorithm32AtmospherePass` against the CPU soft-shader oracle for distant
midday, distant sunset behind camera, local closest approach, and local
`90` degree orbit. `193-soft-shader-capability-parity-matrix` remains the
corrected packet-based soft-shader parity endpoint, and
`054-browser-gpu-direct-scene-input-second-order-image` remains only the prior
fixed spherical distant-Sun browser shader endpoint.

Accepted Three-native runway: `218` proves the pass shell and identity
passthrough, `212` proves depth-to-ray reconstruction from a Three
`DepthTexture`, `216` proves distant first-order atmosphere in the live pass,
`217` proves live camera controls, `220` proves flat/local first-order
atmosphere, `222` proves unified source/geometry adapter switching, `224`
proves the live-pass-vs-soft-shader matrix, `225` proves interactive
scenario/debug controls, and `226` records the production-shape review. The
normal render path is live Three scene color plus depth render targets into a
Three fullscreen atmosphere pass. JSON scene packets remain validation/oracle
artifacts only; do not revive packet replay, standalone raw-WebGL artifact
renderers, or per-material atmosphere duplication as the main implementation
path.

Current source-contract status: the CPU-only runway is accepted through
Milestone 12. `071-cpu-source-contract-distant-sun` proved default spherical
`distant-directional-sun` parity against `037`; `074-cpu-source-contract-distant-sun-matrix`
accepted the distant-Sun matrix; `075-cpu-local-source-first-order-diagnostics`
accepted the flat/local point-Sun source diagnostics against `atmosflat32`
artifact `018`; and `076-cpu-source-contract-shader-packet` accepted the pure
JSON shader-input packet dry run. The `076` distant packet rehydrated into the
CPU renderer with exact raw image, selected diagnostics, and source-sample
trace parity against Milestone 8. The local packet explicitly marks local
second-order cache, direct local solar-disc camera radiance, and local ground
bounce as unsupported/deferred. `078-cpu-local-source-integrated-render`
accepted the next CPU milestone: the default spherical distant-Sun renderer
still matches `037` exactly, while the flat/local point Sun now drives the CPU
image renderer's first-order scattering integral with per-sample source
direction, distance falloff, spectral incident scale, source-path
transmittance, and phase. Its local images are
`local-source-closest-day.png` and `local-source-090deg-rise-sunset.png`.
Visual-only subjective source gallery `079-cpu-source-subjective-gallery`
renders the same fixed card scene with first-order CPU Algorithm32 for distant
high Sun, distant low Sun, and local flat-Sun orbit offsets `0`, `45`, `90`,
`135`, and `180` degrees. Treat `079` as inspection imagery, not a new physics
acceptance gate.

Milestone 13 status: accepted by
`080-browser-lit-scene-input-capture` and
`081-browser-lit-scene-input-cpu-postprocessor`. The browser capture used the
current user-owned `harness.js --watch` loop without relaunch and wrote
unlit/material-control plus lit/shadow scene packets. The CPU postprocessor
then ran Algorithm32 pixel-for-pixel over the captured packets as
`sceneColor * T_view + L_path` for the lit path, with an unlit old-renderer
control. Acceptance evidence: browser capture `4/4`, CPU postprocessor `5/5`,
unlit original-renderer comparison `maxAbsRgbDelta = 0`, zero-density
scene-color passthrough `maxAbsDelta = 0`, and lit shadow/lit ground luminance
delta `49.0064`.

Milestone 14 status: accepted by
`083-cpu-soft-shader-unlit-parity-matrix`. Rejected diagnostic `082` had exact
image parity but failed selected-pixel bookkeeping after a generic center
sample overwrote one original selected diagnostic. Accepted `083` ran
`simple-card-algorithm32`, `simple-card-first-order`, and
`sunset-floor-algorithm32`. Aggregate criteria passed `4/4`; every case passed
`5/5`; every image comparison had `maxAbsRgbDelta = 0`, `meanAbsRgbDelta = 0`,
`p95 = 0`, and `p99 = 0`; selected transfer max delta was `0` for both
simple-card cases and `2.710505431213761e-20` for sunset floor.

Milestone 15 status: accepted by
`084-cpu-soft-shader-lit-scene-matrix`. It reused accepted browser capture
`080` without relaunch. Criteria passed `6/6`: browser capture accepted, lit
packet coverage accepted (`6513` sky, `7887` hit), zero-density passthrough
exact (`maxAbsDelta = 0`), post-atmosphere shadow/lit separation preserved
(`49.0064` before atmosphere and `58.7244` after), sky replacement confirmed
for `upper-sky` (`rgbDelta = 33` from browser scene background), and all
`14400` postprocess pixels finite (`minByte = 28`, `maxByte = 249`).

Milestone 16 status: accepted by
`085-browser-source-light-coupling` and
`086-cpu-source-light-coupling-validation`. The browser capture used the
running user-owned harness with `sourceLightMode = distant-directional-sun`
and `sunCase = figure1-13h15-z21`; the CPU validation passed `8/8` criteria.
The source packet and scene light agreed within
`3.46944695195361e-18`, no default-Sun fallback was used, the calibration
scalar and Three directional intensity were both `2.4`, zero-density
passthrough stayed exact, and shadow/lit separation increased from `67.7216`
before atmosphere to `81.58` after postprocess.

Milestone 17 status: accepted by browser captures `087` through `090` and
aggregate artifact `091-cpu-distant-sun-position-matrix`. The matrix passed
`39/39` criteria for high, low, synthetic side, and synthetic behind-camera
distant Sun cases. Direction agreement stayed within `1.11022302462516e-16`,
max source-direction separation was `94.60340177177892` degrees,
brightest-ground luminance range was `48.22419999999999`,
representative-sky postprocess luminance range was `107.84859999999999`, and
post-atmosphere shadow-delta range was `92.43560000000002`. The CPU
postprocessor now resolves packet-supplied distant Sun altitude/azimuth into
Algorithm32 instead of silently falling back to the high-Sun default.

Milestone 18 status: accepted by
`093-cpu-local-sun-soft-shader-source-matrix`. Superseded diagnostic `092`
also passed, but `093` reports aggregate plus nested case criteria together.
The accepted run passed `57/57`: aggregate `7/7`, distant control `5/5`, and
each local offset case `9/9`. Local offsets `0`, `45`, `90`, `135`, and
`180` degrees all resolved as `packet-supplied-flat-local-point-sun`, matched
the original CPU local renderer exactly (`maxAbsRgbDelta = 0`,
selected-transfer delta `0`), and kept finite source traces. Source distance
increased from `5050.674 km` to `14050.170 km`, incident scale decreased from
`1` to `0.12922172063575063`, and mean observer source transmittance
decreased from `0.6591758563136678` to `0.33942635285309136`.

Milestone 19 status: accepted by
`094-cpu-unified-source-driven-soft-shader-matrix`. The unified matrix passed
`56/56`: aggregate `7/7`, and each of seven cases `7/7`. It reprocessed
distant high and distant low browser lit/shadow packets plus local flat-Sun
offsets `0`, `45`, `90`, `135`, and `180` degrees through the same
`postprocessSceneInput` CPU soft-shader kernel. Distant cases retained the
source-driven Three `DirectionalLight` adapter and canonical Sun resolution;
local cases used CPU-synthesized unlit scene packets, resolved as
`packet-supplied-flat-local-point-sun`, and explicitly recorded
`none-local-unlit-packet` as the local scene-light adapter. No-atmosphere
passthrough was exact (`maxAbsDelta = 0`) for every case.

Milestones 20 through 29 status: accepted by `162`, `167`, `171`, `172`,
`174`, `176`, `177`, `185`, `192`, and `193`, with browser evidence in `166`,
`169`, `170`, `173`, `175`, `180` through `184`, and `187` through `191`.
The accepted shader runway froze the GPU oracle/packet inventory, proved exact
no-atmosphere packet passthrough, made distant Sun uniforms packet-driven,
matched distant high/low GPU output against the CPU soft shader with
full-image `maxAbsRgbDelta = 1`, preserved lit Three scene shadows through
shader composition, matched local closest/`90` first-order finite-source
selected diagnostics with max selected RGB delta `0`, then closed the local
full-image gap. Milestone 27 accepted local offsets `0`, `45`, `90`, `135`,
and `180` degrees in spectrum mode with `33/33` criteria, full-image
`maxAbsRgbDelta = 1`, p99 `0`, and selected delta `0`. Milestone 28 accepted
the same five local offsets in scene-color-composition mode with `33/33`
criteria, full-image `maxAbsRgbDelta = 1`, p99 `1`, and selected delta `0` or
`1`. Milestone 29 accepted the corrected capability matrix with `6/6`
criteria. Superseded diagnostic `168` is incomplete because nested
child-process harness spawning failed with `spawn EPERM`; reruns should use
direct shell-level `harness.js --once` commands or existing browser artifacts.

Current next iteration: the CPU/browser postprocessor runway and POC browser
shader runway are complete through Milestone 29, and the Three-native
atmosphere-pass runway is complete through Milestone 38. Treat
`226-three-native-production-shape-review` as the current shader-lab endpoint,
`224-three-native-live-pass-soft-shader-matrix` as the current objective
live-pass parity evidence, `094` as the unified source-driven CPU oracle, and
`054` only as the prior fixed distant-Sun browser shader endpoint. The next
implementation step is production promotion of the accepted
`Algorithm32AtmospherePass` shape, source/geometry config contract, source
light adapters, depth/render-target lifecycle, debug views, and validation
hooks into the official Algorithm32 implementation. Remaining physics/model
work beyond the current CPU soft shader still includes local second-order
cache support, direct local solar-disc camera radiance, local ground bounce,
Mars/non-Earth presets, and HDR/float transport policy. Subjective Three-light
local-source inspection is accepted in `104-three-lit-subjective-source-scenes`,
superseding `099` because the first local `90` degree view pointed the camera
away from the mountain composition. Distant midday and distant sunset use
white Three `DirectionalLight`, local closest and local `90` degree orbit use
white Three `PointLight`, and all four images are postprocessed through
Algorithm32. Treat `104` as visual evidence only. Its local PointLight
disables Three distance decay and scales intensity by the accepted observer
incident scale; Algorithm32 still samples the true finite flat/local Sun
position, distance, and source-path transmittance.
The shared soft-shader contract now resolves packet row order, hit-mask
meaning, distance units, current RGBA8 display-domain POC limits,
source-packet ownership, no-default-Sun fallback behavior, and the
DirectionalLight/source-vector sign convention requirement. Do not launch
Chrome from the agent path unless explicitly asked.
Visual-only artifact `194-subjective-soft-vs-gpu-source-scenes` provides
side-by-side CPU soft-shader and earlier packet-based GPU shader subjective
scenes for distant midday, distant sunset behind camera, local closest, and
local `90`. It is useful inspection material, but it still replays captured
scene packets and is superseded by the accepted Three-native pass runway for
integration evidence.
Visual-only artifact
`227-postprocess-gpu-vs-integrated-shader-subjective-scenes` provides the
direct postprocess-GPU-vs-integrated-shader comparison for the same four
scenarios. It writes `postprocess-vs-integrated-gallery.png`, per-case
postprocess GPU shader PNGs, per-case integrated Three-native shader PNGs,
diffs, and side-by-side panels. The extraction passed `5/5` generation
criteria; its deltas are inspection data, not a new parity gate.

Performance status: benchmarking exists but is parked. Accepted smoke artifact
`067-browser-shader-benchmark` proves the page returns structured benchmark
diagnostics for the current second-order GPU-direct scene-input pass, but the
current Chromium/WebGL backend did not expose
`EXT_disjoint_timer_query_webgl2`, so no isolated GPU timing baseline exists.
Artifact `069-browser-shader-benchmark` used aggressive batching and is
cautionary only. If performance resumes, use the conservative
`browser-shader-benchmark-command.json` and a dedicated user-owned
harness/browser process.

Browser-process status: use the user-owned `harness.js --watch` loop for
browser artifacts. Do not launch Chrome from the agent tool path unless the
user explicitly asks, and do not clean up by killing generic Chrome processes.
Before triggering a run, read
`tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json` and write the
command to the heartbeat-reported `commandPath`. In the current session, that
path is
`tmp/atmosphere/algorithm32_shader_lab/browser-three-baseline-command.json`.
The harness now supports `--page-timeout-ms`, defaults to `300000 ms`, and the
current running heartbeat records `pageTimeoutMs: 300000`.
The detailed subjective mountain generator now emits one continuous indexed
heightfield mesh for valley plus mountains, generated from
`src/gc/utils/random.js`. The older independent terrain bands are disabled
because they could create visible gaps between strips. Accepted single-mesh
subjective artifact `157-three-lit-detailed-subjective-source-scenes`
supersedes `119`, `124`, `129`, `137`, rejected diagnostic `147`, and `152`;
it passed `3/3` aggregate criteria and all four cases passed `4/4`. It uses a
single darker uniform forest-green terrain mesh, an elevated detailed-scene
camera at `6200 m` looking nearly level across the terrain, and a broad
scene-bottom ground plane at `y = 0` so rays beyond the finite mountain mesh
hit ground instead of being classified as sky. The original
`sky-and-hit-selected-samples` criterion was kept intact; `147` failed because
the selected diagnostics all hit terrain, while `152` restored both sky and
hit selected samples by camera placement, and `157` adds the missing distant
bottom-ground surface. Treat `157` as the current visual baseline, with
remaining tuning focused on camera/material/detail rather than separate
terrain bands or weakened criteria.

Recent background handoff: the `atmosflat32` source-abstraction experiment is
successful through default distant-Sun regression `019` and local-source
rotation skydomes `018`. Docs were updated in
`experiment-032-algorithm.md` and related design notes, but those files are not
part of shader-lab bootstrap unless requested.

## Bootstrap Override

For the current task, this compact section is the authoritative bootstrap. A
new or compacted agent should load only the files named here after the shared
AGENTS bootstrap files, and only the source-contract sections in those files.
The older detailed artifact history later in this file is background only; do
not reload it unless the prompt or user explicitly asks for it.

Minimal source-contract reload path:

1. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`
   - Treat this as the current source of truth for Algorithm32 steps,
     abstractions, end states, production requirements, open issues, and
     immediate production followups.
2. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
   - Read the accepted `Milestone 8` through `Milestone 13` summary.
   - Read `Shared Soft-Shader Contract`, the accepted `Milestone 14` through
     `Milestone 19` soft-shader runway, and the accepted `Milestone 20`
     through `Milestone 29` shader/soft-shader parity runway.
   - Read the accepted `Milestone 30` through `Milestone 38`
     Three-native atmosphere-pass runway.
   - Read `Current Next Iteration`.
3. `scripts/flat/algorithm32-shader-lab/README.md`
   - Read the source-contract artifact block beginning with
     `The accepted CPU source-contract runway is`.
   - Use the command section only when a command shape is needed.

Optional only if the implementation needs adapter framework background:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`.

Current first target:
the accepted CPU local-source integrated render is
`078-cpu-local-source-integrated-render`, and the accepted CPU
software-shader/browser scene-input bridge is
`081-browser-lit-scene-input-cpu-postprocessor`. Milestones 14 through 19 are
accepted by `083`, `084`, `085`, `086`, `091`, `093`, and `094`, with browser
evidence for Milestone 17 in `087` through `090`. Milestones 20 through 29
are accepted by `162`, `167`, `171`, `172`, `174`, `176`, `177`, `185`,
`192`, and `193`, with browser evidence in `166`, `169`, `170`, `173`, `175`,
`180` through `184`, and `187` through `191`. Milestones 30 through 38 are
accepted by `218`, `212`, `216`, `217`, `220`, `222`, `224`, `225`, and
`226`; the current shader-lab endpoint is
`226-three-native-production-shape-review`. The next documented target is
production promotion of the accepted Three-native `Algorithm32AtmospherePass`
shape. Do not keep extending packet-replay shader artifacts as the main
implementation path. Subjective local browser PointLight inspection is
recorded in `104`, detailed subjective terrain/ground inspection is recorded
in `157`, CPU-soft-vs-packet-GPU visual comparison is recorded in `194`, and
postprocess-GPU-vs-integrated-shader visual comparison is recorded in `227`,
but none of these are objective shader acceptance milestones. If the user asks for more CPU
local-source work, use
`scripts/flat/algorithm32-shader-lab/cpu-local-source-integrated-render.js`.

Do not load the `atmosflat32` prompt/artifacts, production flat shader notes,
object-color closeout, module design, old atmosphere reset/rejected docs,
historical artifact logs, browser benchmark command JSON, or the accepted
`054` endpoint artifact during bootstrap unless the user explicitly asks. The
source-contract sections already name the required artifacts, command seeds,
and deferred references.

Minimal bootstrap ends here. Continue below only for explicitly requested
historical context.

## Historical Background - Not Bootstrap Context

Historical shader-lab note: move from analytic simple-scene shader parity to real
Three scene integration, using shared depth/material or object-hit inputs
instead of hard-coded analytic intersections. The analytic full-image
second-order Algorithm32 shader path is accepted for the simple browser card
scene in
`tmp/atmosphere/algorithm32_shader_lab/048-browser-second-order-image/`. It
uses the same 15-channel spectral profile and the same altitude/direction
second-order incident-sky cache proven by selected-pixel diagnostics. Its
selected display pixels match CPU Algorithm32 exactly at encoded RGB
(`maxSelectedRgbDelta = 0`), and its side-by-side pairing against
`037-algorithm32-simple-card-reference` records display-space
`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0017824074074074075`,
`p95PixelMaxAbsRgbDelta = 0`, and `p99PixelMaxAbsRgbDelta = 0`. The first
scene-input objective rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/051-browser-scene-input-second-order-image/`:
the shader consumes a per-pixel Three Raycaster distance/spectrum texture,
selected pixels match CPU Algorithm32 with `maxSelectedRgbDelta = 0`, and the
side-by-side pairing against `037` matches `048`'s image diff. The first GPU
scene-input rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/053-browser-gpu-scene-input-second-order-image/`:
a GPU render target writes per-fragment distance/spectrum/hit flag, then the
experimental raw WebGL atmosphere pass consumes that texture after readback and
upload. It has selected-pixel `maxSelectedRgbDelta = 1`; image diff against
`037` is `maxAbsRgbDelta = 182`, `meanAbsRgbDelta = 0.8947337962962963`,
`p95PixelMaxAbsRgbDelta = 4`, and `p99PixelMaxAbsRgbDelta = 21`, classified as
edge/rasterization placement rather than radiance drift. The direct GPU texture
rung is accepted in
`tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image/`:
it binds the Three GPU render-target texture directly into the experimental
raw WebGL atmosphere pass with no scene-input readback/upload used for shader
input, selected-pixel `maxSelectedRgbDelta = 1`, and the same image diff as
`053`. This is the accepted shader-lab endpoint for fixed spherical,
distant-Sun Algorithm32 over a browser-rendered Three scene input. A
performance-measurement scaffold now exists, but no reliable isolated GPU
timing baseline exists yet because the local Chromium/WebGL backend did not
expose `EXT_disjoint_timer_query_webgl2`; use `067` only as a smoke proof and
`069` only as a cautionary aggressive-batching artifact. The earlier
first-order objective gap remains documented in `038`, and first-order
isolation remains documented in `040`. Subjective second-order mountain
progress images are accepted in `049` and `050`; they are visual review
artifacts only, not objective pass/fail gates. The flat-earth visibility
offshoot is accepted in
`tmp/atmosphere/algorithm32_shader_lab/056-browser-flat-earth-visibility-search/`:
with a flat slab, standard Algorithm32 Rayleigh/Mie constants, first-order
scattering, a `10 km x 10 km` matte black vertical card, a `2 m` camera height,
`24 deg` vertical FOV, and display criterion `maxAbsRgbDelta <= 1`, the closest
non-appearing distance is `1,926.774 km`. The card still covered `2` search
pixels at that threshold; zero-pixel disappearance occurred later in the sweep.
Visibility-loss milestones are accepted in
`tmp/atmosphere/algorithm32_shader_lab/062-browser-flat-earth-visibility-search/`:
using the same target and defining `100%` as cannot see, the distances are
`50% lost = 21.480 km`, `75% lost = 601.563 km`, `80% lost = 776.563 km`,
`90% lost = 1,228.125 km`, `95% lost = 1,543.750 km`, and `100% lost/cannot
see = 1,926.774 km`. `055` is rejected because the first bracket search
skipped the configured max distance, `057` is rejected because a `100 km`-wide
stress card was still visible at the `3,000 km` cap, `058` is the wide-target
diff/mask diagnostic, `059` is an incomplete over-expensive watch run, `060` is
superseded because it drew the milestone table but did not serialize it into
diagnostics, and `061` is an incomplete run from a screenshot-label helper
error. High-resolution visual inspection of the milestone distances is
accepted in
`tmp/atmosphere/algorithm32_shader_lab/065-browser-flat-earth-visibility-search/`,
using the native `canvas-image.png`; it supersedes `064`, where the gallery
content was accidentally laid out using stale canvas dimensions. Iteration 1 is
accepted by
`tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/`. Watch
reload is accepted by
`tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
Iteration 2 is accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/021-browser-ray-depth-diagnostics/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/022-browser-ray-depth-diagnostics-comparison/`.
The comparison passed `7/7` criteria with zero ray-origin delta, zero ray-
direction angle, zero finite-hit-distance delta, and zero classification
mismatches. Iteration 3 is accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/025-browser-atmosphere-components/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/026-browser-atmosphere-components-shader-comparison/`.
The comparison passed `10/10` criteria; browser JS and Node atmosphere
components matched with max transmittance delta `1.1102230246251565e-16`, and
the WebGL2 diagnostic shader readback matched the JS component packet with max
shader transmittance delta `0.000007160129086525302`. Iteration 4.1 is
accepted by browser artifact
`tmp/atmosphere/algorithm32_shader_lab/027-browser-direct-radiance/` and
comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/028-browser-direct-radiance-comparison/`.
It passed `10/10` criteria for one-wavelength first-order 532 nm direct
radiance: JS/Node path and final radiance deltas were `0`, shader max path and
final radiance deltas were `2.0880918986942998e-7`, and the artifact
explicitly records that full spectral conversion and Algorithm32 second-order
approximation are still deferred. Iteration 4.2 is accepted by browser
artifact
`tmp/atmosphere/algorithm32_shader_lab/030-browser-direct-radiance-spectral/`
and comparison artifact
`tmp/atmosphere/algorithm32_shader_lab/031-browser-direct-radiance-spectral-comparison/`.
It passed `9/9` criteria for 5 selected pixels x 15 Algorithm32 wavelengths:
JS/Node max path radiance delta `3.469446951953614e-18`, max final radiance
delta `1.3877787807814457e-17`, shader max path radiance delta
`6.091299753485657e-7`, and shader max final radiance delta
`9.326382049076876e-7`. Iteration 5.1 is accepted by
`tmp/atmosphere/algorithm32_shader_lab/032-browser-first-order-image/`, proving
the simple browser scene can be rendered as a full first-order 15-channel
spectral shader image. Subjective Iteration 7 is accepted by `033` through
`036`, producing CPU Algorithm32 reference images and browser shader
side-by-side images for the forward high-Sun and low-Sun-behind-camera
mountain views.

## Starting Status

- Documentation is ready under
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/`.
- Fresh agents should treat
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
  as the current iteration workbench.
- Fresh agents should treat
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md`
  as the framing document for what "reference" means now: reusable Algorithm32
  module plus cache-building and shader-validation surfaces, not a separate
  renderer or revival of the rejected stage pipeline.
- Algorithm32 is the shorthand for the final cleanroom algorithm from
  experiment 032. It remains the direct-trace oracle for shader/cache
  validation and may also supply promoted kernels for app texture rebuilds.
- The environment-object color closeout is:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md`.
- The closed experiment implementation folder contains the self-contained
  runner:
  `scripts/flat/atmosphere-environment/`.
- The output root is:
  `tmp/atmosphere/cleanroom_environment/`.
- The shader-lab output root is:
  `tmp/atmosphere/algorithm32_shader_lab/`.
- Historical shader-lab browser-control status:
  Agent-launched browser starts remain unreliable in this session, but the
  user-owned manual harness launch works. Rejected artifacts `014` and `015`
  record the failed Karma fallback attempts. Accepted artifact `018` records a
  successful manual Puppeteer `--once` browser baseline run with no page errors
  and a `629 ms` harness duration. It supersedes `017` because the projected
  card-center samples now hit all three intended card objects. Accepted
  artifact `020` records a successful user-owned `--watch` reload: the command
  file change was observed, the page load count advanced to `3`, and a fresh
  accepted artifact was written. Fresh agents should use the user-owned watch
  process for browser experiments rather than launching Chrome from the agent
  tool path.
- Historical shader-lab ray/depth status:
  Iteration 2 is accepted. The browser watch run
  `021-browser-ray-depth-diagnostics` returned selected camera rays and
  equivalent hit distances. The Node comparison run
  `022-browser-ray-depth-diagnostics-comparison` independently reconstructed
  the same Three scene and matched all selected rays, hit objects, and finite
  distances exactly within the recorded tolerances.
- Historical shader-lab atmosphere-component status:
  Iteration 3 is accepted. The browser watch run
  `025-browser-atmosphere-components` returned selected-pixel path length,
  altitude range, optical lengths, optical depth, transmittance, and WebGL2
  diagnostic shader readback. The comparison run
  `026-browser-atmosphere-components-shader-comparison` passed `10` criteria,
  with `0` failures and `0` unresolved.
- Historical shader-lab direct-radiance and image status:
  Iteration 4.1 is accepted. The browser watch run
  `027-browser-direct-radiance` returned first-order 532 nm Rayleigh, Mie,
  path, object-transmitted, and final radiance diagnostics, plus WebGL2 shader
  readback. The comparison run `028-browser-direct-radiance-comparison` passed
  `10` criteria, with `0` failures and `0` unresolved. Iteration 4.2 is also
  accepted. The browser watch run `030-browser-direct-radiance-spectral`
  returned 15-channel first-order spectral radiance diagnostics for selected
  sky/object/ground pixels, plus WebGL2 shader readback. The comparison run
  `031-browser-direct-radiance-spectral-comparison` passed `9` criteria, with
  `0` failures and `0` unresolved. Iteration 5.1 is accepted by
  `032-browser-first-order-image`: the simple browser scene now renders
  through the full-image first-order 15-channel spectral shader path, with
  selected display pixels matching the browser JS spectral preview. Objective
  image parity is now accepted through the full Algorithm32 second-order image
  path. `038` records the earlier first-order shader gap against full CPU
  Algorithm32 (`maxAbsRgbDelta = 38`, `meanAbsRgbDelta =
  11.354444444444445`), and `040` proves first-order-only parity
  (`maxAbsRgbDelta = 1`, `meanAbsRgbDelta = 0.0015277777777777779`). The
  selected-pixel second-order shader diagnostics are accepted in `041` through
  `045`. The full-image second-order simple-scene artifact `048` pairs against
  CPU Algorithm32 reference `037` and records `maxAbsRgbDelta = 1`,
  `meanAbsRgbDelta = 0.0017824074074074075`, `p95PixelMaxAbsRgbDelta = 0`,
  and `p99PixelMaxAbsRgbDelta = 0`, with both sides including the current
  Algorithm32 second-order approximation. Historical subjective mountain shader
  images are accepted in `049` and `050` with paired CPU Algorithm32 references
  from `033` and `034`; these remain visual progress snapshots only.
- Historical subjective-scene clarification:
  The current subjective mountain artifacts `049` and `050` are visual review
  artifacts only, not physics approval gates. They compare the CPU Algorithm32
  mountain references against the current second-order browser shader path
  using analytic procedural mountain intersections. Do not tune or accept the
  shader from these subjective scenes unless the user explicitly asks for that
  visual work.
- Historical shader-lab bootstrap result:
  `scripts/flat/algorithm32-shader-lab/node-three-reference.js` has been
  implemented and verified with `node --check` and a full run. The accepted
  artifact is
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  with `11` passing criteria, `0` failing, and `0` unresolved. It proves
  Three camera rays and Raycaster hits can drive Algorithm32 sky/object
  transfer packets before the browser shader adapter exists.
- Latest shader-lab generated scene request:
  `tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/` is accepted with
  `7` passing criteria, `0` failing, and `0` unresolved. It was generated by
  `node scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  sunset-floor --width 320 --height 180 --label sunset-floor` and contains a
  grass-green floor, no card objects, and a low-Sun Algorithm32 sunset sky.
  `004-sunset-floor` is rejected because the first floor spectrum clipped to
  yellow.
- Latest less-zoom follow-up:
  `tmp/atmosphere/algorithm32_shader_lab/006-sunset-floor-less-zoom/` is
  accepted with `8` passing criteria, `0` failing, and `0` unresolved. It uses
  the same no-object grass-floor sunset scene with `--sunset-framing
  less-zoom`, a `92 deg` vertical FOV, and the low-Sun Algorithm32 sky.
- Latest subjective shader-lab scene:
  `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`
  is the latest CPU-only mountain-range preview. It was generated by `node
  scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  mountain-ridges --width 480 --height 270 --label
  mountain-ridges-framed-large`, uses procedural layered ridge silhouettes and
  a valley floor through the Three raycast plus Algorithm32 sky/object
  transfer path, and intentionally has `0` formal criteria because it is a
  subjective composition scene. It is not a shader-path render. The older
  `012-mountain-ridges-framed-large` remains the previous CPU-only reference;
  artifacts `007` through `011` are superseded mountain-layout iterations.
- Latest alternate subjective shader-lab mountain view:
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`
  uses the same procedural ridge layout with `--mountain-view
  sunset-behind-camera`, the low-Sun `figure1-06h00-z87` case, and a camera
  orientation with the Sun behind the viewer. It intentionally has `0` formal
  criteria because it is subjective composition output.
- Generated artifacts:
  - `001-transfer-baseline`: rejected; the split-segment diagnostic compared
    different full-vs-split quadrature partitions.
  - `002-transfer-convergence`: rejected; confirmed the same diagnostic issue
    shrank under doubled sampling but still failed the gate.
  - `003-transfer-baseline`: accepted baseline after the diagnostic fix, but
    still required convergence-margin proof.
  - `004-transfer-convergence`: rejected; the original `20/10/17/24`
    numerical baseline did not meet the `5x` convergence-margin gate.
  - `005-transfer-refined-baseline`: accepted current refined baseline using
    `40/20/34/48` numerical controls.
  - `006-transfer-refined-convergence`: accepted final convergence proof using
    `80/40/68/96` controls against `005`, with `15` passing criteria, `0`
    failing, `0` unresolved, and minimum convergence margin
    `6.4074899093834174`.
  - `007-lambertian-surface-lighting`: partial crash artifact; report writing
    failed after criteria generation.
  - `008-lambertian-surface-lighting`, `009-local-sun-follow-up`, and
    `010-flat-long-sightline-follow-up`: accepted, but superseded by clean
    reruns after report prose was improved.
  - `011-lambertian-surface-lighting`: accepted final Lambertian proof with
    `8` passing criteria, `0` failing, `0` unresolved.
  - `012-local-sun-follow-up`: accepted final local finite-source proof with
    `8` passing criteria, `0` failing, `0` unresolved.
  - `013-flat-long-sightline-follow-up`: accepted final flat long-sightline
    proof with `9` passing criteria, `0` failing, `0` unresolved.
  - `014-scene-gallery` through `017-scene-gallery`: accepted but superseded
    scene-display iterations. `014` proved image generation but used a
    non-algorithmic illustrative sky; `015` and later moved the sky and
    ground-atmosphere context to cleanroom spectral atmosphere sampling; `017`
    still clustered the distance cards too tightly.
  - `018-scene-gallery`: accepted perspective scene-output proof with `6`
    passing criteria, `0` failing, `0` unresolved; superseded by `019` for the
    requested source-color selection.
  - `019-scene-gallery`: accepted source-colored scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by the
    multicolor scene-display request.
  - `020-scene-gallery`: accepted multicolor scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by `021` because
    the first multicolor layout read more like adjacent front cards than
    separated object sets.
  - `021-scene-gallery`: accepted multicolor scene-output proof with `7`
    passing criteria, `0` failing, `0` unresolved; superseded by the green
    spectrum correction because the previous broad green peak displayed
    yellow-green/yellow.
  - `022-transfer-refined-baseline`: accepted green-spectrum replacement
    baseline with `14` passing criteria, `0` failing, `1` unresolved
    convergence criterion. It changes only the algorithmic synthetic green
    spectrum, from the previous yellow-green broad peak to a 532 nm display-
    green stress peak.
  - `023-transfer-refined-convergence`: accepted green-corrected transfer
    convergence proof with `15` passing criteria, `0` failing, `0`
    unresolved; superseded by the foreground-olive green request.
  - `024-lambertian-surface-lighting`: accepted green-corrected Lambertian
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `025-local-sun-follow-up`: accepted green-corrected local finite-source
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `026-flat-long-sightline-follow-up`: accepted green-corrected flat
    long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `027-scene-gallery`: accepted green-corrected multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by the foreground-olive green request.
  - `028-transfer-refined-baseline`: accepted foreground-olive green baseline
    with `14` passing criteria, `0` failing, `1` unresolved convergence
    criterion. It changes only the algorithmic synthetic green spectrum to a
    user-directed muted foreground color target, encoded as `79/96/32` before
    atmosphere in the display preview.
  - `029-transfer-refined-convergence`: accepted foreground-olive
    transfer convergence proof with `15` passing criteria, `0` failing, `0`
    unresolved; superseded by the lower-right forest-green request.
  - `030-lambertian-surface-lighting`: accepted foreground-olive Lambertian
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `031-local-sun-follow-up`: accepted foreground-olive local finite-source
    proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `032-flat-long-sightline-follow-up`: accepted foreground-olive flat
    long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `033-scene-gallery`: accepted foreground-olive multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by the lower-right forest-green request.
  - `034-transfer-refined-baseline`: accepted lower-right forest-green
    baseline with `14` passing criteria, `0` failing, `1` unresolved
    convergence criterion. It changes only the algorithmic synthetic green
    spectrum to a user-directed dark forest color target from the lower-right
    foliage reference, encoded as `30/58/32` before atmosphere in the display
    preview.
  - `035-transfer-refined-convergence`: accepted final lower-right
    forest-green transfer convergence proof with `15` passing criteria, `0`
    failing, `0` unresolved.
  - `036-lambertian-surface-lighting`: accepted lower-right forest-green
    Lambertian proof with `8` passing criteria, `0` failing, `0` unresolved.
  - `037-local-sun-follow-up`: accepted lower-right forest-green local
    finite-source proof with `8` passing criteria, `0` failing, `0`
    unresolved.
  - `038-flat-long-sightline-follow-up`: accepted lower-right forest-green
    flat long-sightline proof with `9` passing criteria, `0` failing, `0`
    unresolved.
  - `039-scene-gallery`: accepted lower-right forest-green multicolor
    scene-output proof with `7` passing criteria, `0` failing, `0`
    unresolved; superseded by `040` for the 8 px scene-background sampling
    request.
  - `040-scene-gallery`: accepted final high-resolution scene-output proof
    with `7` passing criteria, `0` failing, `0` unresolved. It reads accepted
    artifacts `035`, `036`, `037`, and `038`; changes only the algorithmic
    scene preview sky/ground block sampling from `24 px` to `8 px`; samples
    `11040` sky blocks and `21600` ground-atmosphere blocks; renders red,
    blue, and dark forest-green recorded object-spectrum stacks in each
    scene/source view; and generates `scene-preview-transfer.png`,
    `scene-preview-lambertian.png`, `scene-preview-local-sun.png`,
    `scene-preview-flat-long-sightline.png`, and `scene-gallery.png`.
- The full environment-object experiment state goal has been reached,
  including generated scenes for every phase. Do not continue generating
  numbered experiment artifacts unless the user explicitly asks for a new
  diagnostic.
- The first artifact must use the locked baseline matrix: `2` Sun cases, `7`
  distances, and `6` synthetic object spectra, for `84` primary transfer
  cases before diagnostics.
- Artifact numbering is append-only under
  `tmp/atmosphere/cleanroom_environment/`; choose `max(existing NNN) + 1` and
  never overwrite an existing numbered folder.
- Every numbered artifact must include `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`, `transfer-cases.json`,
  `criteria-results.json`, `report.md`, `contact-sheet.png`, `run.log`, and a
  script snapshot or script-snapshot folder.
- The implemented runner step ids are `transfer-baseline`,
  `transfer-convergence`, `transfer-refined-baseline`,
  `transfer-refined-convergence`, `lambertian-surface-lighting`,
  `local-sun-follow-up`, `flat-long-sightline-follow-up`, and
  `scene-gallery`.

- The successful refined baseline and convergence pass used all active
  constants and assumptions from cleanroom experiment 032, including no ozone,
  no ground coupling, no direct solar-disc camera radiance, Bruneton 2016
  aerosol constants, the 15-sample spectral grid, full-sphere Fibonacci
  second-order path radiance, and the distant directional Sun.
- The successful artifacts include the Bruneton Figure 1 sunrise/sunset
  low-Sun case `figure1-06h00-z87` and the highest-Sun case
  `figure1-13h15-z21`.
- The successful artifacts use algorithmic stress defaults for distances,
  target cards, and synthetic spectra as defined in the preflight spec.

## Archived Atmosflat32 Bootstrap - Inactive

The following reload sources were for the previous `atmosflat32` local-source
POC lane. They are retained only as historical context; do not use them for
the current shader-lab bootstrap unless the user returns to configurable
flat/local Sun behavior.

- [Atmosflat32 Source Abstraction Prompt](apps/flat/plans/atmosphere-cleanroom-design/atmosflat32-source-abstraction-prompt.md)
- [Experiment 032 Algorithm](apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md)
