# Flat

This topic tracks notes for a new project named `flat`.

## Current State

Canonical atmosphere status now lives in
[Algorithm32 Canonical Reference](plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md).
Production Algorithm32 documentation belongs under
[Algorithm32 Production Documentation](algorithm32/README.md), and the shared
production implementation belongs under `shared/algorithm32/`.
Production Algorithm32 is currently in design stage only; the requirements
entry point is [Algorithm32 Requirements](algorithm32/requirements.md), and the
design entry point is [Algorithm32 Production Design](algorithm32/production-design.md).
The primary public facade draft is
[Algorithm32 Primary Facade API Draft](algorithm32/api-facade-draft.md).
Current primary facade methods are `constructor`, `getConfig`, `setConfig`,
awaited `setupShader`, `evaluate`, `getDiagnostics`, and `dispose`;
`buildTexture` and `validate` are not primary app-facing methods.
No implementation has been promoted into `shared/algorithm32/` outside the
preserved `POC` bundle yet. The production deliverable is the usable shader
runtime path; CPU reference code is support for validation, internal shader
texture/cache building, cache construction, diagnostics, and future tests.
The requirements are now divided into ownership domains that can become
self-contained code surfaces: API contract/governance, algorithm input
interfaces, local Sun configuration/calibration, execution configuration,
transport kernel/reference support, shader texture/cache builder, runtime
shader product, display conversion, and validation.
The core abstractions are required to be public interfaces in the Algorithm32
API itself, with display conversion kept separate from the three algorithm
input interfaces. Numerical controls are now classified as execution
configuration, not a fourth algorithm input abstraction. Per-path evaluation
and shader texture/cache building are now separated as implementation
responsibilities that share a transport core. CPU/reference evaluation may
remain public; texture/cache building is implementation-owned behind awaited
shader setup and awaited shader-handle config updates. Shared private
operations are transport and contract primitives. The current assumed
public shape is a configured Algorithm32 facade object constructed once per
independent simulation window. It coordinates two internal implementation
classes, one for algorithm/reference and texture/cache work and one for
runtime shader/Three work, both sharing a private transport/core layer.
Instance state owns configuration, validation state, shader bindings, cache
descriptors, GPU resources, and disposal scope; the shared core must not
become a global mutable singleton. The current POC/lane audit adds that normal
runtime input is a live Three scene rendered to scene-color plus depth textures
and then composed by an Algorithm32 fullscreen pass; JSON/Raycaster scene
packets are validation-only. The facade should own or expose source-driven
Three lighting synchronization, geometry/camera/depth policy, runtime
capability diagnostics, stable debug views, and fail-loud local second-order
cache binding. Latest script-lane audit: the shared shader class/GLSL is in the
POC, but accepted live-scene wrapper behavior still lives in
`scripts/flat/local-second-order/page/`, including cache `Data3DTexture`
creation, source-matrix setup, source-driven lights, render diagnostics,
render-scale/antialias policy, and cleanup. Evaluation uniquely owns
`EvaluationRequest` and single-path output, while internal texture/cache
building owns build request state, grid traversal, packing, descriptors, cache
keys, and packed payload output. Local Sun calibration/resolution and
calibration replay/invalidation are upstream local Sun configuration
operations; the main Algorithm32 facade receives the configured public `Sun`.
From the API consumer point of view, the normal product path should likely be
the runtime shader facade if Algorithm32 ships the production shader adapter:
construct the pass, explicitly prepare/rebuild required textures outside the
render frame behind awaited setup/config updates, update config/display state,
render through the composer, and dispose. Per-path evaluation remains the
CPU/reference/offline consumer method. Texture artifact building and validation
are implementation-owned unless a later non-app tooling consumer justifies a
narrow API. Packet construction/preflight, display conversion, and
validation/parity helpers are support tiers with narrower consumers. The Three
adapter call surface is distinct from
Algorithm32 configuration: it wraps render-target, depth texture,
ShaderMaterial, fullscreen quad, renderer target/render/clear, uniform update,
texture upload, resize, and dispose calls. The candidate consumer-facing Three
adapter method is
`await algorithm32.setupShader({ THREE, composer, scene, camera })`;
it receives the caller's existing Three composer pipeline, prepares and installs
the runtime integration, returns a handle that owns the
`ShaderMaterial`/fullscreen-pass lifecycle, and receives Algorithm32 inputs as
uniforms/textures. The composer is required; Algorithm32 installs into the
existing composer so the app keeps calling `composer.render()`. Its purpose is
to reduce caller decisions and operations around Three-specific material,
target/depth, upload, pass order, resize, and disposal details, and to reduce
caller dependence on Algorithm32-specific shader/cache/spectral binding
knowledge. Long work remains explicit because setup/config updates are
awaited outside the frame render. Requested local second-order shader mode
must validate its incident-cache texture/descriptor before rendering and must
not silently fall back to first-order if the resource is missing or
mismatched.
POC export verification supports this
split: source-contract factories, CPU trace/postprocess/display-preview
helpers, local cache build/key/pack/frame helpers, and the Three pass lifecycle
all exist in the preserved POC bundle, but not all should be normal production
consumer calls.
Local Sun configuration/calibration is now explicitly upstream-only: it may
resolve a public Sun input, but transport, shader texture building, cache, and
runtime shader surfaces must not consume local configuration fields directly.
The latest API-boundary rule is that public interfaces are strict
encapsulation boundaries. For Sun, atmosphere composition, and geometry,
private configuration, calibration, orbit, profile/preset, coefficient
derivation, geometry factory, scene-adapter, provenance, and source-factory
details flow outward only when they are defined by the corresponding public
interface or public input/resolver types.
The local Sun UX notes now keep user-authored setup to altitude, diameter, and
latitude limits, treat orbit direction/period as standardized model behavior,
and allow instantaneous resolved orbital speed to appear as a derived display
value rather than a configuration input.
Algorithm32 now carries imported source-mining catalogs for external
references and fixture provenance under `agents/topics/apps/flat/algorithm32/`:
`external-reference-log.md`, `fixture-sources.md`, and copied referenced JSON
fixtures under `evidence/reference-fixtures/`.
The production design doc now treats those catalogs as supporting inputs,
keeps numbered artifact details out of the main design surface, and clarifies
that calibration helpers consume normalized app-provided context rather than
owning live app UI state.
The local Sun second-order POC lane is closed as accepted evidence for the
production design pivot. Its accepted work starts from the pure importable
bundle under `shared/algorithm32/POC/`, where the original non-shader
`bruneton-start-fresh` base algorithm is preserved as a pared-down POC module
and the accepted copied runners have been reduced to CPU transport, CPU
soft-shader, flat/local source, and Three-native pass modules with
compatibility re-export shims. These clean POC modules are the tested basis
for the production Algorithm32 implementation and should be promoted into
`shared/algorithm32/` after validation. The local second-order plan now starts
with shared-module parity validation against original runners or accepted
evidence before implementing the local incident-field/cache work, and it now
includes lane-specific guidance mined from other cleanroom experiment lanes:
append-only artifacts, state-goal/running-log continuity, provenance and units,
objective criteria before subjective images, fail-loud source/cache behavior,
direct-trace or CPU-soft-shader oracle ordering, and shared source
configuration for Three lighting plus Algorithm32 scattering. Its script lane
is `scripts/flat/local-second-order/`, and browser artifacts go under
`tmp/atmosphere/local-second-order/`; the long-lived browser harness is
`node scripts/flat/local-second-order/harness.js --watch`. Experiment work goes
through the user-owned command file at
`tmp/atmosphere/local-second-order/browser-command.json`; do not document live
watcher state, and inspect heartbeat/process state at execution time when that
matters. The shared import smoke proof has passed, and the initial browser smoke
artifact
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/` is accepted. It
proved page load, WebGL2 availability, PNG capture, criteria output,
provenance/state-goal output, and running-log continuity. Fatal page crashes,
closed pages, protocol disconnect-style errors, unexpected harness-side
command errors, and plain browser-side evaluation errors such as missing
helper `ReferenceError`s are intended to become rejected artifacts instead of
stopping the watch loop. Browser evaluation timeouts must additionally force
page/browser recovery, because artifact `068` showed timed-out WebGL work can
continue consuming CPU. Local second-order lane execution is accepted through
Milestone 12. Accepted artifacts `003` through `009`, `011`, and `012` cover
original base parity, CPU transport parity, CPU soft-shader parity, flat/local
source parity, static Three pass parity, shared POC closeout, the local direct
incident-field oracle, the local `z/rho/incomingDirection/wavelength` cache,
and CPU soft-shader local L2. `010-local-cache-shape` was rejected because it
proved world-space incoming directions are insufficient for a `z/rho` cache;
the accepted `011` artifact records the corrected Sun-subpoint local
radial/tangential/up incoming-direction frame. `013-three-integrated-gpu-local-l2-blocked`
is superseded by accepted browser artifacts `018` and `019`, formal Milestone
10 artifact `020-three-integrated-gpu-local-l2`, Milestone 11 artifact
`021-objective-subjective-local-l2-matrix`, and Milestone 12 artifact
`022-promotion-notes`. The Three pass now exposes
`flat-local-second-order-atmosphere`, uploads the local incident cache as a
Three `Data3DTexture`, and samples the cache in GLSL using the same
Sun-subpoint local radial/tangential/up direction frame as the CPU cache.
Milestone 11 selected CPU/GPU center diagnostics matched within `0` RGB bytes
for closest and `2` RGB bytes for local `90`.
The current local subjective evidence also includes accepted artifact
`093-southern-france-obj-diffuse-high-local-distant-solstice-time-pai`, a
summer-solstice (`2026-06-21`) vertical stack pairing each flat local Sun
integrated-shader row with a spherical distant Sun integrated-shader row at the
same modeled local solar time and identical camera pose/direction. Row headers
show `13:09`, `16:09`, `19:09`, `22:09`, and `01:09 +1d`; each image label
includes the modeled Sun sky position as azimuth and altitude in degrees.
`093` passed `60/60` criteria with no page errors. `090` is superseded because
it forced civil `12:00` as solar noon and lacked those labels; rejected `089`
is superseded by the corrected camera-match criterion.
The follow-up opposite daylight stack is accepted at
`092-southern-france-obj-diffuse-high-distant-local-solstice-daylight`. It
computes San Jose solar noon on `2026-06-21` as the local transit/highest-Sun
anchor at `13:09`, maps that instant to flat local closest approach, and
spreads five rows evenly from sunrise to sunset: `05:47`, `09:28`, `13:09`,
`16:50`, and `20:31`. Each row renders spherical distant on the left and flat
local on the right with the same camera pose/direction, yawed toward the
spherical distant sunset bearing. Each image label includes the modeled Sun
sky position as azimuth and altitude in degrees. `092` passed `60/60` criteria
with no page errors; `091` is superseded because it lacked those labels.
Older atmosphere reset, Bruneton/skydome, spherical-sun, reality-aligned, and
visual-baseline material referenced in this historical status file has been
retired under [Retired Atmosphere Material](plans/retired/README.md).

Algorithm32 shader status:

- Current task: execute the Algorithm32 shader iteration ladder. Iteration 1,
  Browser Three Scene Baseline, is accepted. The agent-launched
  browser-control branch is rejected, but the user-owned manual Puppeteer
  harness launch works. The accepted manual artifact is
  `tmp/atmosphere/algorithm32_shader_lab/018-browser-three-baseline/`, produced
  by `harness.js --once` with no page errors and a `629 ms` harness duration.
  The accepted watch-mode reload proof is
  `tmp/atmosphere/algorithm32_shader_lab/020-browser-three-baseline-watch-reload-check/`.
  Iteration 2 is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/021-browser-ray-depth-diagnostics/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/022-browser-ray-depth-diagnostics-comparison/`.
  Iteration 3 is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/025-browser-atmosphere-components/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/026-browser-atmosphere-components-shader-comparison/`.
  Browser JS and Node atmosphere components matched with max transmittance
  delta `1.1102230246251565e-16`; the WebGL2 diagnostic shader readback
  matched browser JS with max shader transmittance delta
  `0.000007160129086525302`. Iteration 4.1 is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/027-browser-direct-radiance/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/028-browser-direct-radiance-comparison/`.
  One-wavelength 532 nm first-order selected-pixel radiance agrees across
  browser JS, independent Node recomputation, and WebGL2 shader readback.
  Iteration 4.2 is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/030-browser-direct-radiance-spectral/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/031-browser-direct-radiance-spectral-comparison/`.
  All 15 Algorithm32 first-order spectral channels agree across browser JS,
  independent Node recomputation, and WebGL2 shader readback for selected
  pixels. Full-image first-order shader composition on the simple browser
  scene is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/032-browser-first-order-image/`.
  The objective simple-scene image pair `038` measures the first-order shader
  against full CPU Algorithm32 reference `037` and records the expected missing
  second-order gap. The first-order isolation pair `040` measures the same
  shader class against CPU first-order reference `039` and shows near-exact
  agreement. Selected-pixel second-order diagnostics are accepted in `041`
  through `045`, and full-image second-order simple-scene parity is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/048-browser-second-order-image/`.
  Scene-input second-order parity is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/051-browser-scene-input-second-order-image/`
  using a per-pixel browser JS Three Raycaster distance/spectrum texture, and
  by
  `tmp/atmosphere/algorithm32_shader_lab/053-browser-gpu-scene-input-second-order-image/`
  using a GPU-rendered scene-input target through a readback/upload bridge.
  Artifact `052` is rejected because the scene background was written into sky
  pixels before the background-clear fix. Direct GPU texture scene-input parity
  is accepted by
  `tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image/`,
  which binds the Three render-target texture directly into the atmosphere pass
  without scene-input readback/upload for shader input.
  Shader benchmark mode now exists as `browser-shader-benchmark`.
  `tmp/atmosphere/algorithm32_shader_lab/067-browser-shader-benchmark/`
  is an accepted smoke artifact proving the mode returns structured timing
  diagnostics, but this Chromium/WebGL backend did not expose
  `EXT_disjoint_timer_query_webgl2`, so it does not contain isolated GPU pass
  timing. `069-browser-shader-benchmark` used aggressive batching and is only
  a cautionary artifact; the benchmark defaults now yield between samples, use
  small sample counts, and keep `gl.finish()` fallback timing opt-in. Resume
  performance work from
  `tmp/atmosphere/algorithm32_shader_lab/browser-shader-benchmark-command.json`
  and use a dedicated user-owned browser/harness process or exact process
  ownership. Do not clean up benchmark runs by killing generic `chrome`
  processes.
  Current subjective mountain progress snapshots are accepted by
  `tmp/atmosphere/algorithm32_shader_lab/049-browser-mountain-second-order-front-high-sun/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/050-browser-mountain-second-order-sunset-behind-camera/`;
  each contains a `side-by-side.png` beside CPU Algorithm32 references from
  `033` and `034`. Those comparisons are only for progress visibility. The
  flat-earth visibility offshoot is accepted by artifacts `056`, `062`, and
  `065` under `tmp/atmosphere/algorithm32_shader_lab/`: `056` records the
  original cannot-see threshold, `062` records inverse visibility-loss
  milestones, and `065` records the high-resolution visual gallery. Production
  flat shader design differences are now documented in
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/production-flat-shader-differences.md`.
  Next spherical shader work remains moving the browser atmosphere pass from
  hard-coded analytic intersections to a production-style depth/material
  texture contract or Three-owned composition pass.
- The runnable plan is
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`.
  The broader harness/background plan is
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`.
- The accepted spherical shader endpoint is still `054`. The flat-earth
  visibility work is a documented user-directed offshoot, not a replacement
  for the spherical endpoint. Local Sun behavior, changing Sun configuration,
  clouds, app texture rebuilds, and production integration remain deferred
  unless explicitly redirected.
- The reusable Algorithm32 module remains the end product of the cleanroom
  "reference" effort.
- "Reference" now means reusable Algorithm32 direct trace APIs,
  cache-builder APIs, profile/preset data, and shader parity fixtures. It does
  not mean a separate final renderer, a permanent script-only pipeline, or a
  revival of the rejected one-stage-per-calculation reference pipeline.
- Algorithm32 is the shorthand for the final cleanroom algorithm from
  experiment 032:
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/`.
  The baseline uses no ozone, no ground coupling, no direct solar-disc camera
  radiance, Bruneton 2016 aerosol constants, 15-sample CIE conversion,
  full-sphere Fibonacci second-order scattering, and display-only
  `k = 1 / (5 * 683)` for Figure 1 comparison output.
- The active interface workbench is
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-module-design.md`.
  It drafts APIs for `createAlgorithm32Profile`, `traceSkyRay`,
  `traceAtmosphereSegment`, `applyAtmosphereToObjectRadiance`,
  `buildAtmosphereCache`, and `compareShaderSample`.
- The active framing document is
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md`.
  It records that Algorithm32 should validate the shader/cache path and may
  supply promoted kernels for app-side flat/local-Sun texture rebuilds.
- `scripts/flat/algorithm32-shader-lab/` now exists as an experimental
  Puppeteer shader-lab scaffold. Its first purpose is only to prove a
  long-running browser harness can load a local page, reload on command, return
  useful browser-side JSON, and save artifacts under
  `tmp/atmosphere/algorithm32_shader_lab/`. It is not production code and does
  not require a test suite.
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`
  records the planned build-up from this browser-control smoke loop to
  Node/Three CPU Algorithm32 reference rendering, geometry validation,
  shared browser/Three shader adapters, and shader parity runs.
- `scripts/flat/algorithm32-shader-lab/node-three-reference.js` now implements
  the first Node/Three CPU reference runner. It creates a Three camera, three
  spectral card meshes, and a diagnostic ground plane, uses
  `Raycaster.setFromCamera()` for rays/hits, maps those rays into Algorithm32
  local coordinates, and traces Algorithm32 sky/object spectral packets without
  Chromium.
- The object-color experiment is closed. Its closeout is
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-object-color-closeout.md`;
  the final accepted scene artifact is
  `tmp/atmosphere/cleanroom_environment/040-scene-gallery/scene-gallery.png`.
  Do not continue generating numbered environment-object artifacts unless the
  user explicitly asks for a new diagnostic.
- The cleanroom docs to load for fresh/compacted agents are listed in
  `agents/topics/active-topic.md` and routed through
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/README.md`.
- Older Flat atmosphere docs, rejected pipeline code, previous skydome
  worklogs, and generated local skydome artifacts are out of scope unless the
  user explicitly asks for source-audit, historical-reference, or
  architecture-comparison work.
- External sources remain the authority for equations, constants, expected
  colors, and visual targets. Older local project code/docs are not authority
  for Algorithm32 physics or display choices.
- Do not delete any file that is not tracked by Git; this includes
  scratch/generated/downloaded files and numbered artifact folders.
- Latest shader-lab scaffold verification: `node --check
  scripts/flat/algorithm32-shader-lab/harness.js`, `node
  scripts/flat/algorithm32-shader-lab/harness.js --help`, and `node
  scripts/flat/algorithm32-shader-lab/harness.js --once` passed. The browser
  smoke artifact is
  `tmp/atmosphere/algorithm32_shader_lab/002-smoke-reload/`; it reported page
  reload count `2`, WebGL 2 via SwiftShader, canvas pixel samples, screenshot
  output, and no page errors.
- Latest Node/Three Algorithm32 verification: `node --check
  scripts/flat/algorithm32-shader-lab/node-three-reference.js` and `node
  scripts/flat/algorithm32-shader-lab/node-three-reference.js` passed. The
  accepted artifact is
  `tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/`
  with `11` passing criteria, `0` failing, `0` unresolved. It includes
  `reference-image.png`, `object-mask.png`, `geometry-diagnostics.json`,
  `transport-diagnostics.json`, `criteria-results.json`, and source/reference
  metadata.
- Latest generated shader-lab scene request: `node
  scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  sunset-floor --width 320 --height 180 --label sunset-floor` produced
  `tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/` with `7` passing
  criteria, `0` failing, `0` unresolved. It contains no card objects, uses the
  low-Sun Figure 1 case, renders a grass-green floor, and computes the
  sky/floor through Algorithm32 spectral transport. Artifact
  `004-sunset-floor` is rejected because the first synthetic floor spectrum
  clipped red and green together and read as yellow.
- Latest less-zoom follow-up: `node
  scripts/flat/algorithm32-shader-lab/node-three-reference.js --scene
  sunset-floor --sunset-framing less-zoom --width 320 --height 180 --label
  sunset-floor-less-zoom` produced
  `tmp/atmosphere/algorithm32_shader_lab/006-sunset-floor-less-zoom/` with
  `8` passing criteria, `0` failing, `0` unresolved. It keeps the no-object
  grass-floor sunset scene but uses a `92 deg` vertical FOV so the composition
  is less zoomed.
- Subjective mountain scene references are paused for now:
  `tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/`
  and
  `tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/`.
  They have `0` formal criteria by design and should be used for visual
  progress only, not objective shader acceptance. A fresh
  CPU-only forward rerun exists at
  `tmp/atmosphere/algorithm32_shader_lab/029-mountain-ridges-framed-large/`,
  and the current second-order shader-path progress snapshots are `049` and
  `050`, paired with CPU Algorithm32 references `033` and `034`. Do not
  generate more
  CPU-only subjective mountain reruns unless explicitly requested.
- Latest browser-control update: artifacts `014` and `015` remain rejected
  records of the failed agent-launched Karma fallback, but artifact `018`
  proves the existing Puppeteer harness works when the user launches it
  manually. It supersedes `017`; diagnostic card pixels are computed by
  projecting each card's Three world position, and all three card samples hit
  their intended objects. Artifact `020` proves the persistent `--watch` loop:
  editing the watched command file produced a fresh accepted artifact with
  pageLoadCount `3` and stable selected-pixel diagnostics.
- Latest ray/depth update: artifact `021` returned browser-selected camera
  rays and equivalent hit distances through the watch loop. Artifact `022`
  independently rebuilt the same scene in Node/Three and matched all selected
  rays, classifications, hit objects, card projected sample pixels, and finite
  hit distances with `7` passing criteria, `0` failing, and `0` unresolved.
- Latest atmosphere-component update: artifact `025` returned selected-pixel
  path length, altitude range, optical lengths, optical depth, transmittance,
  and WebGL2 diagnostic shader readback through the watch loop. Artifact `026`
  compared those outputs against independent Node recomputation and passed
  `10` criteria, with `0` failing and `0` unresolved.
- Latest direct-radiance update: artifact `027` returned first-order 532 nm
  Rayleigh, Mie, path, object-transmitted, and final radiance diagnostics,
  plus WebGL2 shader readback, through the watch loop. Artifact `028` compared
  those outputs against independent Node recomputation and passed `10`
  criteria, with `0` failing and `0` unresolved. Artifact `030` then returned
  the same first-order diagnostics for all `15` Algorithm32 spectral channels;
  artifact `031` compared those outputs against independent Node recomputation
  and passed `9` criteria, with `0` failing and `0` unresolved. Artifact `032`
  proves the current first-order shader can render a full simple-scene image.
  Artifact `038` pairs that shader against full CPU Algorithm32 reference `037`
  and reports display-space `maxAbsRgbDelta = 38` and `meanAbsRgbDelta =
  11.354444444444445`, with the missing second-order shader contribution named
  as the known solver difference. Artifact `040` pairs the shader against CPU
  first-order reference `039` and reports `maxAbsRgbDelta = 1` and
  `meanAbsRgbDelta = 0.0015277777777777779`, proving first-order image parity.
  Artifacts `041` through `045` prove selected-pixel second-order radiance
  parity, and artifact `048` proves full-image second-order parity for the
  analytic simple scene with display-space `maxAbsRgbDelta = 1` and
  `meanAbsRgbDelta = 0.0017824074074074075` against CPU Algorithm32 reference
  `037`. Artifact `051` proves the same shader can consume per-pixel Three
  Raycaster scene input with the same image diff as `048`; artifact `053`
  proves a GPU-rendered scene-input target can feed the shader with selected
  pixels within `1` encoded RGB and image diff `meanAbsRgbDelta =
  0.8947337962962963` against `037`, with remaining movement classified as
  edge/rasterization placement. Artifact `054` proves the GPU scene-input
  texture can be bound directly into the experimental atmosphere pass without
  the readback/upload bridge, with the same selected-pixel and image-diff
  behavior as `053`. Artifacts `049` and `050` prove the current
  second-order shader path can produce the subjective mountain progress views
  with Algorithm32 reference images beside them.

Atmosphere reset note:

- Multiple-scattering plan phases 1-5 now have first CLI/report scaffolding
  and a computed order-by-order prototype sidecar.
  `run-reference-probe.js` attaches `baselineFreeze` metadata to sky-patch and
  sky-dome outputs, computes skydome model-output metrics such as warm area,
  non-blue area, horizon-ring luminance/chroma, zenith-to-horizon contrast,
  and Sun-neighborhood warm fraction, imports explicit external spectral
  radiance JSON via `--external-radiance <path>`, and exposes an opt-in
  `--multiple-scattering-reference sidecar-contract` field that is explicitly
  `not-computed`. The new opt-in
  `--multiple-scattering-reference order-by-order-grid` mode computes a
  sidecar-only order-1/order-2 diagnostic for selected sky-patch/skydome
  samples without modifying the rendered single-scattering radiance. It now
  accepts `--multiple-scattering-targets diagnostic|dome-rings` and
  `--multiple-scattering-angular-samples <count>` so transport evidence can be
  densified independently from rendered image resolution. The first coarse
  sky-dome prototype lives at
  `tmp/atmosphere-multi-scatter/002-order-by-order-grid-prototype/`; its
  Markdown/JSON report shows an averaged order-2 fraction of about `12.88%`
  with `8` incoming angular samples, `3` camera-ray path samples, and
  `2` incoming-ray path samples. The new dome-ring runs live at
  `tmp/atmosphere-multi-scatter/003-dome-rings-order2-angular8/` and
  `tmp/atmosphere-multi-scatter/004-dome-rings-order2-angular32/`; they sample
  `132` skydome target rays and report order-2 fractions of about `11.66%`
  and `11.32%`, with only about `3.38%` aggregate order-2 energy delta between
  angular `8` and `32`. The explicit display-comparison report is
  `tmp/atmosphere-multi-scatter/005-dome-rings-l1-vs-l1plusl2-angular32/`;
  it adds `L1` versus `L1+L2` swatches and reports about `10.05%` average
  linear-luminance lift across the `132` targets, with canonical rendered
  radiance still unchanged. Phase 6 has now started with
  `--multiple-scattering-max-order 3`; the first convergence artifact is
  `tmp/atmosphere-multi-scatter/006-phase6-order3-convergence-diagnostic/`.
  It reports order energies `L1 = 0.3762`, `L2 = 0.0556`, `L3 = 0.0105`, and
  last-order fraction about `2.38%`, so the prototype is not yet converged
  against the `1%` threshold. Follow-up sweep artifacts
  `tmp/atmosphere-multi-scatter/007-phase6-order4-convergence-angular4/`,
  `tmp/atmosphere-multi-scatter/008-phase6-order4-convergence-angular8/`,
  and `tmp/atmosphere-multi-scatter/009-phase6-order3-convergence-angular16/`
  show the diagnostic series converging by order 4 at angular `8` with
  order-4 fraction about `0.58%`, while order 3 remains above threshold at
  angular `16` with order-3 fraction about `2.09%`. Practical conclusion:
  use order-4-or-converged higher-order radiance for the next comparison, but
  build an image-level cached/iterative sidecar field or table-shaped
  reference rather than recursively tracing every pixel. That next step now
  has a first prototype:
  `tmp/atmosphere-multi-scatter/010-iterative-field-grid-image-comparison/`.
  The new `--multiple-scattering-reference iterative-field-grid` mode is
  skydome-only and sidecar-only; the first run uses `5` altitude layers,
  `16` field directions, max order `4`, nearest-neighbor lookup, and emits
  Markdown/JSON comparison panels for `L1`, `L1+L2`, `L1+L2+L3`, and
  `L1+L2+L3+L4`. It converges with last-order fraction about `0.51%`.
  A current canonical skydome snapshot now lives at
  `tmp/atmosphere-multi-scatter/012-current-skydome-snapshot/`; it renders the
  four Bruneton-style time rows at `128 px` with the current single-scattering
  pipeline, `12/2` sampling, ASTM G-173, Bucholtz Rayleigh, Brion ozone,
  U.S. Standard Atmosphere density, Kider-fit aerosol, and exponential
  exposure `8`. The image confirms the current visual state: midday panels
  remain muted blue-gray and the fisheye limb/horizon remains brown/gold.
  A follow-up sidecar visual set was generated at
  `tmp/atmosphere-multi-scatter/013-sidecar-skydome-visual-set/` after adding
  `--multiple-scattering-image-dir <path>`. That option writes PNG-only
  iterative-field sidecar artifacts plus a compact README without full
  per-pixel JSON. The `128 px` contact sheet
  `images/sidecar-skydome-set.png` shows the canonical baseline beside
  field `L1`, `L1+L2`, `L1+L2+L3`, and `L1+L2+L3+L4` columns. It also exposes
  the current sidecar limitation clearly: with `16` Fibonacci directions and
  nearest-neighbor lookup, the sidecar skydomes are visibly faceted and are
  useful as progress evidence, not yet as a smooth image-quality prediction.
  Phase 6 L1 reconstruction metrics now make that limitation numeric:
  `014-phase6-l1-reconstruction-nearest`, `015-phase6-l1-reconstruction-weighted`,
  `016-phase6-l1-reconstruction-weighted-angular32`, and
  `017-phase6-l1-reconstruction-weighted-angular64` compare cached-field `L1`
  against direct single scattering over `132` dome-ring targets. Weighted
  interpolation plus `64` directions improves aggregate mean spectral-energy
  error to about `21.85%`, but the `85 deg` view-zenith horizon ring remains
  about `57.95%` wrong. Phase 7 has now implemented weighted field-direction
  samples plus explicit field-grid controls:
  `--multiple-scattering-field-direction-basis fibonacci|horizon-sun` and
  `--multiple-scattering-field-altitude-grid default|lower-atmosphere`.
  Artifacts `018` through `023` show that the angular basis was the immediate
  cached-field blocker. The control run `018` keeps the Fibonacci-64 result at
  about `21.85%` mean L1 error and `57.95%` horizon-ring error. The best
  current run, `022-phase7-horizon-sun128-default-altitude`, uses a requested
  budget of `128` directions, resolves to `156` solid-angle-weighted
  horizon/sun-relative directions, and reports about `4.49%` aggregate mean
  L1 error, `11.65%` max error, `7.53%` at `75 deg`, and `8.80%` at
  `85 deg`, while remaining converged by order 4. The lower-atmosphere
  altitude grid did not move the current ground-observer L1 metric because
  altitude `0 km` is an exact layer in both grids; altitude choices need a
  path-sampled L1 diagnostic before they count as `L2+` promotion evidence.
  Recommendation: use the `022` horizon/sun field as the next sidecar
  skydome-image candidate, keep weighted interpolation and order-4 convergence,
  and do not promote multiple scattering into canonical radiance yet. Phase 8
  generated that image-level candidate at
  `tmp/atmosphere-multi-scatter/024-phase8-horizon-sun128-sidecar-skydomes/`
  and recorded the interpretation at
  `tmp/atmosphere-multi-scatter/025-phase8-conclusion/`. The result does not
  validate the current field-only sidecar: cached field `L1` does not visually
  track canonical direct `L1` across the full `128 px` fisheye dome, and the
  higher-order movement from field `L1` to field `L1..L4` is modest compared
  with that first-order image mismatch. The next implementation should render
  `direct L1 + cached L2+` and add a dense image-level L1 reconstruction gate
  before any image-level sidecar conclusion counts. Phase 9 now does that:
  `026-phase9-direct-l1-plus-residual-skydomes` renders direct canonical
  `L1` plus cached `L2+` residual panels, and
  `027-phase9-conclusion` records the interpretation. The residual-only
  higher-order terms move the image only modestly: daylight horizon luminance
  rises by roughly four percent in the sampled rows, horizon/zenith ratios
  nudge upward, and non-blue/warm affected fractions often decrease rather
  than producing richer model-reference skies. Dense cached-`L1` image
  reconstruction remains poor, confirming field-only skydomes should not drive
  conclusions. Recommendation: stop treating missing high-order atmospheric
  scattering as the single dominant cause; keep the residual sidecar, and move
  next to a model-ingredient audit covering aerosol optical depth/SSA,
  wavelength dependence, Mie phase policy, surface/ocean bounce, display and
  exposure calibration, and atmosphere/profile assumptions. That audit now
  lives at `tmp/atmosphere-multi-scatter/028-model-family-delta-audit/`. It
  compares the Bruneton 2016 model family against the current pipeline and
  narrows the next phase to model-ingredient ablations: horizon-safe
  source-path sampling, Cornette-Shanks aerosol phase versus the current
  Henyey-Greenstein phase, a named no-visible-air-absorption/no-ozone paper
  contract, and ground/surface bounce into sky in-scattering. Its coarse
  Figure 1 image metrics also show the current daylight skydome has lower
  disk contrast than every extracted paper-model column, while the Phase 9
  residual only modestly improves contrast. The CLI now has an explicit
  `--multiple-scattering-reference none` mode for these Phase 10 isolation
  comparisons; it attaches a zero-radiance `disabled-no-op` sidecar, keeps
  rendered radiance unchanged, and rejects solver/field/image sidecar controls
  so disabled multiple scattering is visible in artifacts without doing any of
  the expensive work. Multiple scattering is now closed as an active
  output-fidelity investigation. The successor output-impact tasks now live in
  [Reference Plan](plans/retired/atmosphere_reset/reference/plan.md#current-next-focus-output-impact-reference-work)
  instead of this multiple-scattering status note. General direction for those
  tasks: close identified model weaknesses by moving the reference runner
  toward Bruneton's documented methods, data, and comparison assumptions one
  isolated delta at a time. Task 1 is now implemented and verified. The
  reference runner has named aerosol phase policies, aerosol scalar presets
  resolve a `defaultPhasePolicyId`, `evaluateScatteringPhase` supports
  `cornette-shanks`, shared phase math is used by the stage and runner
  diagnostics, `--aerosol-phase-policy` selects HG or Cornette-Shanks controls,
  and JSON/Markdown reports expose the resolved `aerosolPhasePolicy`.
  Verification: `npm run test:scripts:flat` passed with 378 specs and
  0 failures after the Task 1 implementation, and `git diff --check` passed
  after the documentation checkpoint. The first phase-only artifact
  lives at `tmp/atmosphere/bruneton/001-aerosol-phase-policy/` with HG control
  and Cornette-Shanks JSON/PNG/Markdown/progress-log outputs, `manifest.json`,
  `comparison.md`, and combined `progress.log`. Cornette-Shanks moved the
  daylight metrics only modestly, so aerosol phase shape alone is not the
  dominant fix for the muted/brown daylight result.
  Task 2 sampling-convergence artifacts now live at
  `tmp/atmosphere/bruneton/003-sampling-convergence/`. Holding physics fixed,
  the `36 px` sweep through `12/2`, `24/4`, `48/8`, and `96/16`, plus a
  `48 px` low-vs-high confirmation, shows sampling is a major contributor to
  the daylight brown outer ring: the three daylight rows fall from about
  `6-8%` warm/non-blue affected area at `12/2` to near-zero by `96/16`. The
  dawn/low-Sun row becomes more broadly warm at higher sampling, but the large
  soft sunset/orange affected area remains unsolved. Task 2 is now closed out
  in code: the reference runner accepts
  `--sampling-profile fast-preview|paper-comparison|horizon-safe`, rejects
  mixing a named profile with raw `--view-steps` or
  `--sun-transmittance-steps`, records the resolved profile in JSON,
  Markdown, summaries, progress events, sky-patch metadata, sky-dome panel
  metadata, and baseline-freeze metadata, and defaults Bruneton-style
  `--sky-dome-grid` renders to `paper-comparison` (`96/16`). `fast-preview`
  remains the explicit `12/2` preview/ablation lane, and `horizon-safe` is the
  slower `128/32` low-elevation diagnostic lane. Raw numeric sampling remains
  available only as recorded `custom-explicit` experiment metadata.
  A `72 px` side-by-side comparison for visual review now lives at
  `tmp/atmosphere/bruneton/004-72px-current-vs-control/`, with the original
  Task 1 HG `12/2` stack beside a fresh current-state Cornette-Shanks `96/16`
  stack in `control-vs-current-d72.png`.
  The follow-up isolation artifact
  `tmp/atmosphere/bruneton/005-hg-high-sampling-isolation/` fills the missing
  high-sampling HG quadrant and confirms the main visible change is sampling,
  not phase model: under HG alone, `96/16` removes the daylight warm/non-blue
  ring and expands the low-Sun warm area from about `9.7%` to about `20.0%`,
  while HG-to-CS phase effects remain small at both sampling levels.
  Verification: `npm run test:scripts:flat` passed with 382 specs and
  0 failures after adding the sampling-profile contract and metadata/report
  tests.
  Task 3 is now implemented and experimentally closed. The new
  `bruneton-2016-no-visible-absorption` policy is a named zero-cross-section
  ozone/visible-absorber policy passed through the existing `--ozone-policy`
  CLI path into normal `atmosphere.mediumAt` composition, so the transport
  stages do not branch. The artifact
  `tmp/atmosphere/bruneton/006-no-visible-absorption/` compares Brion ozone
  control against no-visible absorption at `36 px`, `paper-comparison`
  sampling, Bruneton/Kider aerosol, Cornette-Shanks phase, Bucholtz Rayleigh,
  ASTM G-173, U.S. Standard Atmosphere density, exponential tone map, and
  explicit multiple-scattering no-op. Result: removing visible ozone
  absorption is visually meaningful for the low-Sun row, raising warm area
  from about `19.9%` to `30.2%` and horizon warm area from `75%` to `100%`;
  daylight rows mostly show small luminance lifts and little to no warm-area
  change. It should be used for Bruneton-method parity, but it does not solve
  the missing broad soft sunset/orange affected area by itself.
  Verification: `npm run test:scripts:flat` passed with 384 specs and
  0 failures after adding the Task 3 no-visible-absorption policy and
  artifact comparison; `git diff --check` also passed.
  A display-only parity audit now lives at
  `tmp/atmosphere/bruneton/007-display-parity-audit/`. The new
  `scripts/flat/atmosphere_rejected/display-parity-audit.js` diagnostic compares fixed
  spectra, fixed linear-RGB probes, and Task 3 saved radiance samples from
  `006-no-visible-absorption/summary.json` through the existing CIE,
  exponential tone-map, exposure, and byte-encoding path without re-running
  atmosphere transport. The color module also exposes an unnormalized CIE XYZ
  diagnostic path beside the current equal-energy normalized path. Result:
  raw CIE XYZ carries about `106.96x` more Y scale than the normalized path on
  these samples; normalized `exposure=1` to `8` changes mean display-linear
  luminance by about `0.171`; raw-vs-normalized output at exposure `8` still
  has about `0.540` mean encoded RGB delta. Display scale must be pinned before
  paper-PNG parity conclusions, but this is a perceived contrast/saturation
  concern rather than the likely cause of the brown horizon geometry or missing
  broad sunset/aureole area. Verification:
  `npm run test:scripts:flat` passed with 389 specs and 0 failures after the
  audit and raw-XYZ diagnostic tests.
  The sky-dome CLI now supports `--dome-sample-mask full|horizon-ring`; the
  `horizon-ring` option traces only fisheye radius `>= 0.88`, marks skipped
  interior pixels explicitly, excludes them from skydome metrics, and reports
  sampled/skipped counts in progress and artifact metadata. A perimeter-focused
  aerosol/Mie audit now lives at
  `tmp/atmosphere/bruneton/008-aerosol-mie-parity-audit/`. It found the
  Bruneton/Kider aerosol coefficients match the Angstrom/SSA/scale-height
  contract to about `3.68e-13` max relative error, sea-level `550 nm` aerosol
  scattering is about `3.75x` Rayleigh scattering, and the Cornette-Shanks
  phase convention is strongly forward-scattering. Named aerosol policies can
  move the horizon ring, but the current evidence points toward
  parameter/environment choice or missing surface/ground coupling rather than a
  missing basic Mie coefficient or phase algorithm. Verification:
  `npm run test:scripts:flat` passed with 395 specs and 0 failures after the
  mask and aerosol/Mie audit tests.
  A weakness factor audit now lives at
  `tmp/atmosphere/bruneton/009-weakness-factor-audit/`. It found the weakest
  current contract is source quadrature: a one-source controlled sample returns
  about `0.31831` radiance, while two half-weight source samples and a
  one-source-plus-zero-weight-extra case both return about `0.63662`; expected
  weighted ratio is `1.0`, actual ratio is `2.0`. This means
  `sourceSample.weight` and `solidAngleSr` are preserved but not applied by
  single-scattering accumulation, so finite-Sun/aureole sampling cannot be
  trusted yet. The same audit found aerosol policy is responsive but not
  decisive, and surface-coupling proxies only improve the daylight perimeter
  when the injected secondary light is strongly blue-biased. Recommendation:
  fix source quadrature/finite solar-source handling first, rerun the
  sunset/aureole comparison with real weighted source samples, then implement a
  physical surface/ground secondary-source experiment. Verification:
  `npm run test:scripts:flat` passed with 398 specs and 0 failures after the
  weakness factor audit tests; `git diff --check` also passed.
  The focused output-impact queue now lives in
  [Reference Plan](plans/retired/atmosphere_reset/reference/plan.md#current-next-focus-output-impact-reference-work):
  Tasks 4-6 now pin the source-weight transport contract, apply source
  weighting in single-scattering accumulation, and add explicit directional
  versus finite-disc solar-source modes. Task 7 is complete, and Task 8 is
  next: test a physical surface/ground secondary-source experiment. The
  paper-panel comparison metrics/contact-sheet and manifest-cleanup tasks now
  follow those physics-contract steps.
  Tasks 4, 5, and 6 are complete: the reference contracts and fixtures require
  `integrateSingleScattering` to consume finite nonnegative
  `sourceSample.weight` values, with `solidAngleSr` kept as provenance, and
  production now requires that weight at solar-transmittance handoff and
  applies it during single-scattering accumulation. The weakness-factor audit
  now reports `source-sample-weight-applied`, with split-weight and
  zero-weight-extra ratios near `1.0`. The reference runner now accepts
  `--solar-source directional-sun|finite-sun-disc`, accepts
  `--finite-sun-samples <count>` only for `finite-sun-disc`, emits weighted
  deterministic finite-disc source samples when selected, and records source
  mode, sample count, solar angular radius, and weight sum in JSON and
  Markdown. Verification: `npm run test:scripts:flat` passed with
  `405 specs, 0 failures`.
  Task 7 artifacts now live under
  `tmp/atmosphere/bruneton/010-finite-sun-source-weighting/`, with
  file-directed runs, logs, `summary.json`, `manifest.json`, and
  `comparison.md`. The sweep includes a `36 px` directional control, fair
  full-frame `12 px` directional/finite-5/finite-9 comparisons, and fair
  `24 px` horizon-ring directional/finite-5/finite-9 comparisons. Result:
  finite solar-disc source sampling is effectively a no-op at image-metric
  level; low-Sun warm area, horizon warm fraction, Sun-neighborhood warm
  fraction, and the rough warm-radius proxy do not move, and the largest
  recorded metric delta is about `0.00050047`. Conclusion: finite solar-source
  angular extent is not the main cause of the too-small sunset/orange affected
  area.
  New Bruneton output-impact experiment artifacts should live under
  `tmp/atmosphere/bruneton/` with sortable numbered folders. Historical
  multiple-scattering artifacts remain under `tmp/atmosphere-multi-scatter/`;
  the first smoke run is
  `tmp/atmosphere-multi-scatter/001-phase1-4-diagnostic-smoke/`, containing
  `skydome-smoke.png`, `skydome-smoke.md`, `skydome-smoke.json`,
  `skydome-smoke.progress.log`, and the zero-radiance external fixture.
  Verification: `npm run test:scripts:flat` passed with 364 specs and
  0 failures after the Phase 9 residual-panel and dense image-gate update.
- [Multiple-Scattering Plan](plans/retired/atmosphere_reset/multiple_scattering_plan.md)
  now records the closed comparison-first investigation, diagnostic sidecar
  contracts, no-op isolation mode, and evidence trail. The active successor
  queue lives in the focused
  [Reference Plan](plans/retired/atmosphere_reset/reference/plan.md#current-next-focus-output-impact-reference-work).
- The multiple-scattering/table-generation design now records the distinction
  between Bruneton-style tables and project-owned tables. Bruneton remains a
  useful spherical Earth-like validation and shader-architecture precedent,
  but flat-world/local-Sun approximation tables will likely need to be
  generated from our own reference runs with explicit geometry, atmosphere,
  source, optical-depth, and finite-boundary metadata.
- The June 2026 midday-horizon review now treats the Lopes/Fernandes 2014
  atmospheric-scattering survey as a model-ladder reference. The user-provided
  screenshot maps to the paper's O'Neal clear-sky example, so the current
  muted blue-gray output is plausibly an older single-scattering/optimized
  real-time look rather than a finished photographic target. The next
  reference step is a comparison lane across O'Neal/Nishita-class baseline,
  Preetham or Hosek-Wilkie analytic sky, Bruneton-style multiple scattering,
  and later libRadtran/DISORT artifacts before further haze-proxy tuning.
- The immediate comparison target is model-output matching rather than
  reality matching. A local source index and extracted model-image gallery now
  lives at `tmp/atmosphere-model-output-gallery/README.md`; the primary
  comparison source is Bruneton 2016's eight clear-sky-model skydome grid.
- The reference CLI now has a `--sky-dome-grid` mode for a Bruneton Figure 1
  style comparison column. It renders the listed time rows `06h00 / 87 deg`,
  `10h15 / 41 deg`, `11h15 / 31 deg`, and `13h15 / 21 deg`, marks the Sun
  direction with a red cross, and writes PNG/PPM/SVG/Markdown with
  progress-log support. The first paper-resolution, paper-oriented artifact is
  `tmp/atmosphere-model-output-gallery/ours-bruneton-figure1-skydome-256-preview20-v12-s2-exponential-paper-orientation.png`
  with Markdown/progress-log siblings. Full diagnostic JSON is intentionally
  omitted at `256 px` because it would be extremely large. It uses the new
  `bruneton-2016-kider-fit` aerosol preset (`tau550 ~= 0.0645`, Angstrom
  alpha `0.8`, single-scattering albedo `0.8`, scale height `1.2 km`, and
  asymmetry `g = 0.7`) plus Bucholtz Rayleigh, ASTM G-173 solar spectrum,
  Brion ozone, U.S. Standard Atmosphere density, exponential display exposure
  `8`, and 12/2 transport samples. The output is structurally comparable to
  the paper grid but still dim/desaturated versus the richer published model
  panels.
- A historical pass over `tmp/atmosphere-images` separated two regressions:
  the daylight horizon browning is already present in the single-scattering
  midday-horizon frames around `036`/`040`, while the later overall contrast
  loss begins with the haze-lift/diffuse-airlight approximation around `044`
  and `047` and is carried forward into `054`, `056`, `057`, `059`, and `060`.

Reference integrator update:

- The focused CPU spectral reference lane now has green direct stage coverage
  through all canonical transport stages, ending at `composeSpectralRadiance`.
- Current completed canonical stages:
  `validateRequest`, `resolveRayPath`, `sampleViewPath`, `evaluateMedium`,
  `integrateViewOpticalDepth`, `integrateSolarTransmittance`,
  `evaluateScatteringPhase`, `integrateSingleScattering`,
  `resolveSurfaceRadiance`, and `composeSpectralRadiance`.
- The diffuse-sky-airlight/haze-lift approximation has been backed out of the
  canonical pipeline and CLI. It is no longer a stage, packet component,
  display-side comparison mode, or compatibility fallback. The old review
  artifacts remain useful as historical evidence only:
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.png`,
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.md`,
  and
  `tmp/atmosphere-diffuse-sky-airlight-stack/sky-patches-full-stack-132x84-fov72.json`.
  Verification: `npm run test:scripts:flat` passed with 352 specs and
  0 failures after the removal.
  Center swatches from that run: midday zenith `#798bad`, midday horizon
  `#caccbc`, sunset horizon `#e59963`.
- The first reference probe runner now exists at
  `scripts/flat/atmosphere_rejected/run-reference-probe.js`. It runs
  controlled built-in smoke probes through the canonical stage sequence and can
  emit deterministic JSON, Markdown, and SVG visual evidence.
- [Reference Stage Contracts](plans/retired/atmosphere_reset/reference/stage_contracts.md)
  is now the canonical input/output contract for each CPU reference pipeline
  stage. It defines downstream-needed packet shapes, ownership, units, and
  known alignment follow-ups for code and tests.
- The controlled visual evidence artifacts were generated at
  `tmp/flat-reference-visual-evidence/result.json`,
  `tmp/flat-reference-visual-evidence/report.md`, and
  `tmp/flat-reference-visual-evidence/visual.svg`. These are transport/report
  smoke evidence, not final physical globe/flat adapter evidence; swatches use
  a debug `650/550/450 nm -> R/G/B` mapping until CIE colorimetry exists.
- The no-celestial sky-patch evidence artifacts were generated at
  `tmp/flat-reference-sky-patches/result.json`,
  `tmp/flat-reference-sky-patches/report.md`, and
  `tmp/flat-reference-sky-patches/sky-patches.svg`. The current preview renders
  midday zenith, midnight zenith, and low-sun horizon views from shared
  Earth-like parameters, Rayleigh phase, Henyey-Greenstein aerosol phase, a
  `380-780 nm` / `20 nm` grid, official CIE 1931 2-degree table-backed XYZ to
  sRGB display, and approximate `300 DU` Chappuis-band ozone absorption.
  Current center swatches: midday zenith `#8b9cbd`, midnight zenith `#000000`,
  sunset horizon `#f28000`.
- The flat finite-Sun light-extent artifacts were generated at
  `tmp/flat-light-extent/result.json`, `tmp/flat-light-extent/report.md`, and
  `tmp/flat-light-extent/light-extent.svg`. This probe loads named scenarios
  from `scripts/flat/atmosphere_rejected/data/reference/light-extent-scenarios.json`, treats
  thresholds as loss fractions in `[0, 1)`, integrates straight source-path
  Beer-Lambert attenuation, applies finite solar-disk solid-angle falloff, and
  reports whether useful-light loss or pure opacity limits each scenario first.
  User-facing `sun.brightnessScale` and `sun.elevationDeg` controls are now
  explicit in the scenario schema; brightness scales absolute irradiance while
  elevation changes the dense-air path geometry. `sun.directLightAvailable`
  distinguishes real no-direct-light cases from still-lit app false-Sun poses.
  Named absolute effective-irradiance floors now tie the diagnostic back to
  calculated app/default quantities: `app.flatDefaults.midday`,
  `app.flatDefaults.midnight`, `realSun.sanJose.midday`, and
  `realSun.sanJose.midnight`.
- The latest focused verification recorded in the reference docs is
  `npm run test:scripts:flat` passing with 279 specs and 0 failures after
  closing the current reference-integrator-only testing boundary. The
  integrator facade now rejects loose custom stage registries and unresolved
  name-only probes, and the obsolete placeholder-stage fallback has been
  removed.
- The atmosphere reset design now identifies the next implementation layer:
  benchmark worlds, cameras, and CLI evidence. This layer should add reusable
  globe/flat model adapters, camera-relative probe definitions, canonical
  post-pipeline color/display consumers, and benchmark scenario files so the
  CLI can generate deterministic JSON, Markdown, and visual artifacts before
  shader parity begins.
- The camera part of that layer is now designed as a pre-transport pinhole ray
  adapter. It resolves WGS84 geodetic globe observers or explicit flat
  observers, local east/north/up frames, azimuth/elevation, `towardSun`,
  target, and NDC views into `observer.positionKm` and normalized
  `ray.direction`, with diagnostics for basis vectors, FOV/aspect,
  source/target ids, and warnings. PBRT's camera interface is the camera-to-ray
  precedent, EPSG 7030 supplies the WGS84 ellipsoid constants, and ESA
  Navipedia's ECEF/ENU transform is the globe local-frame reference.
  Hand-authored benchmark targets default to geodetic latitude/longitude plus
  `elevationKmMsl` so changing observer locations does not require rewriting
  observer-relative offsets; flat hypothesis runs adapt those anchors through
  the north-pole-centered azimuthal equidistant projection; and
  colored/hittable markers such as `marker.red` are fixture-owned surfaces
  rather than loose points with duplicated material facts. Coordinate ownership
  is now explicit for the benchmark layer: geodetic coordinates own permanent
  facts, observer-relative coordinates own subjective/view-local intent, and
  Three/app scene coordinates are future generated render endpoints for object
  and camera placement, shader uniforms, and browser parity. Repeated coordinate
  bridge transforms may be precomputed or cached as generated artifacts when
  their keys include the canonical source inputs and frame metadata; cached
  transforms must not replace source geodetic, observer, or target facts. The
  atmosphere reset design now treats coordinate spaces and transforms as core
  shared functionality and lists the transform roadmap end to end:
  WGS84/geodetic/ECEF/ENU, flat projection, camera/view rays, source geometry,
  fixture placement, and later Three.js camera state, shader reconstruction,
  floor texture sampling, and sky-dome endpoint projections. Current work is
  scoped to proving the CPU reference, so app/browser/shader endpoint adapters
  remain deferred. Before implementing the camera bridge, the next
  implementation slice is the reusable transform-core subset that the camera
  needs: WGS84 datum/height/geodetic/ECEF/ENU, first
  ECEF-to-globe model adapter, flat north-pole azimuthal equidistant
  projection, flat local frames, observer/target/source direction resolution,
  plumb-aligned pinhole basis/NDC rays, provenance metadata, and deterministic
  cache-key fields. `rollDeg = 0` now means image vertical is parallel to the
  local plumb line, and roll degrees increase clockwise in the image plane
  with `0` at plumb-up/12 o'clock; missing `rollDeg` defaults to that normal
  unrolled state.
- Scope correction: current atmosphere-reset work is proving the reference,
  not designing app integration. Phase 6A now stops at CPU trace requests,
  deterministic JSON/Markdown/visual CLI artifacts, and the first-slice
  transform/camera helpers needed to feed them. Three.js, shader, floor
  texture, sky-dome, and app-specific endpoint rows remain deferred parity
  roadmap. Verification: `git diff --check` passed, and the
  trailing-whitespace scan across the updated docs returned no matches.
- Scope refinement: the immediate reference-proof work is now framed around
  two concrete outputs: convert reference results into deterministic image
  pixels, and make the first Earth-like atmosphere model accurate enough that
  those pixels are meaningful. Camera/coordinate work stays intentionally
  small for now: enough to aim midday, midnight, and sunset sky patches and
  report observer/ray diagnostics, not enough to become app renderer
  infrastructure.
- Minimal color consumer package is implemented beside the reference package:
  `scripts/flat/atmosphere_rejected/color/spectral-color.js` now loads and validates
  the official CIE 1931 2-degree color matching table, linearly interpolates
  within the published `360-830 nm` range, contributes zero outside that range,
  exposes `spectralRadianceToXyz` and `spectralRadianceToLinearSrgb` as the
  domain API, preserves unclamped out-of-gamut linear RGB, records color
  provenance, and keeps the analytic approximation as a named preview/fallback
  path. `scripts/flat/atmosphere_rejected/color/pixel-output.js` converts post-pipeline
  linear sRGB into deterministic pixel packets, supports explicit `srgb` or
  `linear` byte encoding, applies display exposure only after physical color is
  complete, records clamping metadata, preserves source diagnostics, builds
  row-major pixel images, and can emit dependency-free PPM plus PNG artifacts
  from the same pixel packets. Color/pixel packets now carry CMF,
  interpolation, integration, RGB matrix, output color space, encoding,
  exposure, alpha, clamped-channel, and source-provenance diagnostics for the
  current benchmark path.
  The reference package index does not export color helpers; color remains a
  consumer of completed pipeline output, not part of transport. The color
  fidelity roadmap now lives in
  `agents/topics/apps/flat/plans/retired/atmosphere_reset/color/plan.md`.
- Official CIE 1931 2-degree color matching data is now stored under
  `scripts/flat/atmosphere_rejected/data/color/`: the raw CSV, publisher metadata JSON,
  and local README record the DOI/source, `360-830 nm` range, `1 nm` spacing,
  `471` rows, and verified MD5 `17cca777db64b17170f06f67ce9d3ab7`. Ingestion
  and parsing are now implemented in `spectral-color.js`.
- The pixel bridge is now plugged into the reference CLI. For sky-patch runs,
  `--image <path>.ppm|.png` writes through the sibling `color`
  post-pipeline pixel bridge, while other image extensions keep the existing
  SVG path. Sky-patch runs accept `--color preview-cie|official-cie`,
  `--encoding srgb|linear`, and `--exposure <scale>`. Sky-patch JSON now
  includes `pixelImage` packets so generated bytes remain traceable to
  diagnostics.
  Generated proof artifact:
  `tmp/atmosphere-reference-sky-patches.png` with companion Markdown/JSON from
  `run-reference-probe.js --sky-patches --patch midday.zenith,sunset.horizon,midnight.zenith`;
  the CLI summary reported midday `#8b9cbd`, sunset `#f28000`, and midnight
  `#000000`. Verification after official CIE ingestion and CLI wiring:
  `npm run test:scripts:flat` passed with 301 specs and 0 failures, including
  `scripts/flat/atmosphere_rejected/color/_tests`, after adding spectral-to-linear-sRGB
  domain API coverage, pixel provenance, CLI color/display flags, and PNG
  output; `git diff --check` passed.
- Sky-patch wavelength-grid controls are implemented:
  `--wavelength-grid preview-20nm|benchmark-5nm|cie-1nm`. The default remains
  `preview-20nm` (`380-780 nm / 20 nm`, `21` samples); `benchmark-5nm`
  provides `380-780 nm / 5 nm`, `81` samples; and `cie-1nm` exposes the full
  official CIE `360-830 nm / 1 nm`, `471` sample domain for spot checks. The
  `benchmark-5nm` proof command generated
  `tmp/atmosphere-reference-sky-patches-5nm.png` plus Markdown/JSON with
  centers midday `#8b9cbd`, sunset `#f18000`, and midnight `#000000`.
  `npm run test:scripts:flat` passed with 302 specs and 0 failures after this
  change.
- The color plan still records the next output-fidelity roadmap: sourced solar
  spectra, better absorber spectra, display/tone-mapping policies,
  white-balance diagnostics, per-pixel supersampling, CIE-table-aligned
  workflows, and comparison artifacts.
- Sourced solar-spectrum controls are implemented for sky patches:
  `--solar-spectrum blackbody-5778k|astm-g173`. The ASTM path reads
  `ASTMG173.csv` directly from
  `scripts/flat/atmosphere_rejected/data/color/astm-g173/astmg173.zip`, uses the
  Gueymard 2002 extraterrestrial `Etr W*m-2*nm-1` column, and records source
  provenance in JSON/Markdown. A `benchmark-5nm` comparison generated
  `tmp/atmosphere-reference-sky-patches-5nm-blackbody.png` with centers
  midday `#8b9cbd`, sunset `#f18000`, midnight `#000000`, and
  `tmp/atmosphere-reference-sky-patches-5nm-astm-g173.png` with centers
  midday `#889cbe`, sunset `#ef8000`, midnight `#000000`.
  `npm run test:scripts:flat` passed with 308 specs and 0 failures after this
  change.
- Direction update: color/output improvements are now considered sufficient
  for the current proof loop. The next fidelity focus is sourced atmospheric
  composition: Rayleigh coefficient model, ozone absorber policy, aerosol/Mie
  policy, and species/profile provenance in diagnostics. This is recorded in
  the new
  [Atmosphere Composition Plan](plans/retired/atmosphere_reset/composition/plan.md);
  remaining color follow-ups stay lower priority until the atmosphere model
  improves.
- The atmosphere reset plan now clarifies that the immediate composition
  implementation step is the first item from the fidelity list: close the
  Rayleigh model with clean Bucholtz 1995 data/provenance, tests, and a named
  `bucholtz-standard-air` policy. Minimal policy scaffolding should support
  comparing preview Rayleigh against Bucholtz Rayleigh; broader aerosol/ozone
  policy work follows after that path is proven. If the checklist grows, it
  now lives in the focused atmosphere-composition plan folder.
- The atmosphere composition plan now includes the detailed Rayleigh substeps:
  confirm clean source data, choose the pinned coefficient/cross-section or
  optical-depth artifact, record Bucholtz extraction/provenance, implement
  named preview and `bucholtz-standard-air` policies, add focused tests, and
  generate preview-vs-Bucholtz sunset comparison artifacts.
- Rayleigh substeps 1-4 are complete for the composition source-data slice.
  The new composition-owned folder
  `scripts/flat/atmosphere_rejected/composition/` contains a curated Bucholtz 1995
  standard-air Rayleigh artifact at
  `scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json`,
  with Table 2 pinned volume-scattering coefficient rows, Table 3 formula
  constants, selected Table 4 optical-depth validation rows, and source-data
  specs wired into the flat script Jasmine lane. The selected primary quantity
  is the local standard-air volume-scattering coefficient in `1/km`; optical
  depth remains secondary validation data for named atmosphere columns.
  `npm run test:scripts:flat` passed with 313 specs and 0 failures after the
  composition source-data artifact and spec were added.
- The script-side atmosphere packages are now consolidated under one
  `scripts/flat/atmosphere_rejected/` folder with `reference`, `color`, and
  `composition` child folders. The flat script Jasmine config now discovers
  specs from that shared parent, and the reference CLI imports color helpers
  from the sibling `color` folder.
- The CLI is now atmosphere-owned at
  `scripts/flat/atmosphere_rejected/run-reference-probe.js` instead of living under the
  reference package. Shared source artifacts and scenario inputs now live under
  `scripts/flat/atmosphere_rejected/data/`, with `data/color`, `data/composition`, and
  `data/reference` subfolders. `npm run test:scripts:flat` passed with 313
  specs and 0 failures after the CLI and data moves.
- Rayleigh implementation substeps 5-7 are complete. The composition package
  now provides `rayleigh-policy.js` with `rayleigh-lambda4-preview` as the
  unchanged default/control and `bucholtz-standard-air` as an explicit sourced
  policy using the local Bucholtz 1995 artifact. The atmosphere CLI accepts
  `--rayleigh-policy` and `--patch-size WIDTHxHEIGHT`, and sky-patch
  JSON/Markdown include the selected policy and pixel dimensions.
  Preview-vs-Bucholtz `sunset.horizon` artifacts were generated at
  `tmp/atmosphere-rayleigh-comparison/` with `benchmark-5nm` plus
  `astm-g173`: preview center `#ef8000`, Bucholtz center `#ff9c00`.
  Larger `132x84` review PNGs were generated without full JSON output:
  preview center `#ee8300`, Bucholtz center `#ff9f12`.
  Exposure-check variants for the Bucholtz sunset show the same physical
  radiance at display exposure `2` (`#c3730a`) and `3` (`#ea8b0e`), confirming
  that the default exposure `4` red-clips the display channel and can make the
  patch read too yellow/green.
  The color output bridge now exposes `--tone-map clip|preserve-hue`;
  `preserve-hue` prevents channel-by-channel red clipping by scaling exposed
  display-linear RGB together. The generated Bucholtz `132x84` preserve-hue
  artifact has center `#ff9811` with unchanged physical linear RGB.
  `npm run test:scripts:flat` passed with 322 specs and 0 failures after the
  tone-map option, patch-size option, policy helper, CLI wiring, focused tests,
  and artifacts.
- The next atmosphere-composition slice is complete for sourced ozone
  cross sections. MPI-Mainz/Brion 1998 `295 K` ozone data is stored at
  `scripts/flat/atmosphere_rejected/data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt`
  with metadata, checksum, pinned rows, and focused source-data tests.
  `scripts/flat/atmosphere_rejected/composition/ozone-policy.js` now provides
  `preview-chappuis` as the unchanged default/control and
  `brion-1998-ozone-295k` as the sourced table-backed policy. The atmosphere
  CLI accepts `--ozone-policy`, reports the selected policy in JSON/Markdown,
  and generated the Brion sunset comparison artifact at
  `tmp/atmosphere-rayleigh-comparison/sunset-bucholtz-brion-ozone-132x84-preserve-hue.png`.
  In that fixed Bucholtz/ASTM/preserve-hue probe, the center shifted subtly
  from preview ozone `#ff9811` to Brion ozone `#ff990f`; the remaining ozone
  follow-up is a sourced vertical profile/column policy. `npm run
  test:scripts:flat` passed with 332 specs and 0 failures after this slice.
- The rest of the first atmosphere-composition comparison pass is implemented.
  `scripts/flat/atmosphere_rejected/composition/aerosol-policy.js` adds named
  aerosol/Mie policies: `rayleigh-only`, `preview-earthlike-aerosol`,
  `clear-maritime`, `clear-continental`, and `hazy-continental`, backed by
  the local preset artifact at
  `scripts/flat/atmosphere_rejected/data/composition/aerosol/aerosol-presets.json`.
  `scripts/flat/atmosphere_rejected/composition/profile-policy.js` adds
  `preview-exponential-8km` and
  `us-standard-atmosphere-1976-density`, backed by the U.S. Standard
  Atmosphere 1976 density artifact at
  `scripts/flat/atmosphere_rejected/data/composition/profile/us-standard-atmosphere-1976-density.json`.
  The atmosphere CLI now accepts `--aerosol-policy` and
  `--molecular-profile`, reports those policies in JSON/Markdown, and includes
  center-sample species optical-depth diagnostics. Visual comparisons were
  generated under `tmp/atmosphere-composition-comparison/`; the embedded
  review summary is
  `tmp/atmosphere-composition-comparison/README.md`. Initial read: aerosol is
  the strongest lever so far; `clear-maritime` gives the best current orange
  sunset target, while `hazy-continental` is a darker/browner stress case.
  `npm run test:scripts:flat` passed with 341 specs and 0 failures after this
  slice.
- The sky-patch CLI now accepts `--fov-y-deg <degrees>` for visual review
  without changing built-in scene defaults. Wider `72 deg` FOV sunset and
  best-current three-patch images were generated in
  `tmp/atmosphere-composition-comparison/` and embedded in that folder's
  `README.md`. `npm run test:scripts:flat` passed with 341 specs and
  0 failures after the FOV override.
- The reference folder now has a focused
  [Sun Visual Plan](plans/retired/atmosphere_reset/sun/sun_visual_plan.md) for
  the missing visual sun stack: finite solar disk, near-sun angular
  resolution, improved aerosol phase behavior, direct solar radiance, disk
  occlusion, multiple scattering, camera/display response, and lower-frame
  surface context. The recommended next slice is a diagnostic sun/aureole
  visual mode so disk geometry and near-sun diagnostics can be tested before
  heavier bloom, terrain, or multiple-scattering work.
- The diagnostic sun/aureole visual mode is now implemented as
  `--sun-visual none|diagnostic` for sky-patch CLI runs. It creates stacked
  diagnostic image panels for sky-only, angular-distance heatmap, disk mask,
  direct-disk approximation, and sky-plus-disk approximation while keeping the
  canonical transport result unchanged. A new `sunset.sun` patch provides a
  tight sun-centered crop. Generated artifacts and an embedded summary live in
  `tmp/atmosphere-sun-diagnostic/`. The wide `72 deg` horizon diagnostic had
  no disk-hit pixels; the tight sun-centered diagnostic had `24 / 11088`
  disk-hit pixels. The reports now include fixed angular bucket rows around
  the sun, averaging sky radiance, direct-disk approximation, sky-plus-disk,
  view transmittance, and Rayleigh/Mie/ozone optical depth for `0-0.25`,
  `0.25-0.5`, `0.5-1`, `1-2`, `2-5`, and `5-10 deg`. The tight crop shows
  direct-disk contribution only in the innermost bucket, while the wide
  horizon context remains sky scattering without disk pixels. The documented
  result is now sorted by contributor: aerosol/Mie is the largest physical
  lever, Rayleigh is second, ozone is smaller but nonzero, and the largest
  visual gap is still the missing rendered sun-disk/aureole/glare stack in the
  wide sunset evidence. The
  [Sun Visual Plan](plans/retired/atmosphere_reset/sun/sun_visual_plan.md)
  now records diagnostic follow-ups: optical-depth validity classes, aerosol
  sensitivity grids, improved aerosol phase data, separated extinction versus
  radiance-contribution reporting, external comparison references, and
  explicit high-tau labeling for sunset horizon. `npm run test:scripts:flat`
  passed with 342 specs and 0 failures after this implementation.
- Sun diagnostics have been extended from geometry-only reporting into
  high-tau validity and contribution diagnostics. The sky-patch reports now
  classify total optical depth, label high-tau buckets, and report
  per-species single-scattered radiance beside per-species optical depth. New
  diagnostic aerosol variants were added for lower AOD, lower/higher
  Henyey-Greenstein `g`, and shallow/deep aerosol scale-height sensitivity.
  Generated artifacts and findings live in
  `tmp/atmosphere-sun-diagnostic/README.md`. Current read: the wide
  `sunset.horizon` center is already a `single-scattering warning`, near-sun
  buckets are `extreme horizon path` regions, Mie dominates both opacity and
  red/green radiance in the baseline `5-10 deg` bucket, and `g` is the
  strongest tested visual lever.
- The sky-patch CLI now includes `midday.horizon`, a low-elevation clear-day
  companion to `midday.zenith`. The latest full-stack artifact was generated
  at `tmp/atmosphere-sun-diagnostic/midday-horizon-latest-stack.png` with
  companion Markdown, using ASTM G-173, Bucholtz Rayleigh, clear-maritime
  aerosol, Brion ozone, U.S. Standard Atmosphere density, `benchmark-5nm`, and
  preserve-hue tone mapping. Center swatch: `#a4a791`; center radiance samples:
  `440nm:0.0357`, `560nm:0.0467`, `660nm:0.036`.
- Sun-plan focus reset: the next atmosphere/sun implementation target is now
  `midday.horizon` before further sunset tuning. It remains in the sun topic
  because the failure is causally related to sunset: both are low-elevation,
  high-optical-depth views where single scattering does not yet produce the
  expected pale haze/glow. Midday horizon is the cleaner first benchmark
  because it removes sunset-specific confounders such as low solar elevation,
  visible disk/aureole placement, red/orange expectations, and stronger
  display-response ambiguity.
- Midday-horizon diagnostics now report scattering angle, per-species phase
  values, path altitude distribution, single-scattering budget factors,
  missing-light estimate, and disabled completeness terms. Current finding:
  `midday.horizon` is high tau but has weak Mie phase for its geometry
  (`109.8424 deg`, Mie/Rayleigh phase ratio `0.4617` at `560 nm`), while
  `midday.zenith` is moderate tau with much stronger Mie phase
  (`164.0355 deg`, ratio `7.3865`). The horizon budget peaks at `2.2726 km`
  altitude and is flagged `multiple-scattering-likely`; surface bounce,
  clouds, terrain/ocean reflection, and multiple scattering remain disabled.
- [Sun Visual Plan](plans/retired/atmosphere_reset/sun/sun_visual_plan.md) records the
  midday-horizon roadmap and the model-family comparison context. The previous
  haze-lift proxy branch has been backed out; future work should compare the
  single-scattering baseline against Bruneton/libRadtran-style references and
  move toward a real multiple-scattering/table path instead of another
  display-side or packet fallback.
- A focused `midday.horizon` aerosol sensitivity pass was generated under
  `tmp/atmosphere-sun-diagnostic/` and recorded in both the artifact summary
  and the sun plan. Holding the latest stack fixed, `rayleigh-only` is palest
  at `#afbdaa`, lower AOD is `#aab19a`, baseline `clear-maritime` is
  `#a4a58b`, `clear-continental` is darker/browner at `#9e926d`, and
  `hazy-continental` becomes an `extreme horizon path` at `#775b2e`. All
  useful variants remain high-tau and continue to report
  `multiple-scattering-likely`. Current recommendation: do not solve
  midday-horizon haze by tuning aerosol, color defaults, or haze proxies.
- Historical haze-lift artifacts remain in `tmp/atmosphere-haze-lift-diagnostic/`,
  `tmp/atmosphere-updated-pipeline-sky-patches/`, and
  `tmp/atmosphere-diffuse-sky-airlight-stack/`. They showed that the proxy
  brightened the horizon but also introduced broad contrast loss and
  gray/beige daylight color. The implementation has now been removed from the
  canonical stage registry, CLI, packet shape, composition output, tests, and
  docs contracts.
- Going forward, routine sky-patch experiments should omit
  `midnight.zenith` until celestial objects, airglow, moonlight, or another
  nighttime source is added. The CLI default sky-patch set is now
  `midday.zenith`, `midday.horizon`, and `sunset.horizon`; `midnight.zenith`
  remains available as an explicit no-celestial control.
- Midday-horizon row diagnostics now separate sky rows from below-horizon
  surface hits. Focused artifacts live in `tmp/atmosphere-horizon-profile/`.
  The `88x56` latest-stack profile shows row `35` is still sky at
  `0.4613 deg`, while row `36` is a black surface hit at `-0.009 deg`.
  The true sky row also still dips: clear-maritime haze `0.02` has the last
  sky row at `0.606` of peak sky luminance, while Rayleigh-only stays at
  `0.996`. Recommendation recorded in the sun plan: do not keep tuning
  proxies; use the model gallery and a stronger multiple-scattering/table
  reference to decide the next transport model. Treat ocean/ground lower-frame
  context as a separate follow-up.
- Latest visual assessment: the aerosol-aware full-stack output is still far
  from the user-provided real midday sky photo. The latest PNGs are
  `tmp/atmosphere-images/059_atmosphere-diffuse-sky-airlight-stack-sky-patches-full-stack-132x84-aerosol-aware.png`
  and
  `tmp/atmosphere-images/060_atmosphere-diffuse-sky-airlight-stack-midday-horizon-full-stack-132x168-aerosol-aware.png`.
  They prove the removed proxy was being consumed, but they did not
  match the photographic target: upper sky is too desaturated and gray-blue,
  the horizon trends beige/tan rather than pale cyan-white, and the daylight
  gradient was not the clean saturated-blue-to-light-horizon gradient in the
  reference. Current status: the proxy is removed; visual fidelity still needs
  a better transport reference.
- First follow-up from that photo review: sky-patch reference sampling can now
  trade speed for accuracy. The CLI accepts `--view-steps <count>` and
  `--sun-transmittance-steps <count>`, reports the resolved per-patch numerical
  sampling, and has `--progress` stderr logging plus `--progress-log <path>`
  file logging for long artifact runs. The
  sky-patch defaults are now `64` view-ray midpoint samples plus `16`
  source-path midpoint samples; `sunset.horizon` keeps the same view count but
  uses `32` source-path samples because its grazing source path is more
  sensitive. A full `132x84` sourced-stack comparison was generated at
  `tmp/atmosphere-finer-sampling-sky-patches/sky-patches-full-stack-132x84-finer-defaults-progress.png`
  with Markdown/JSON/log siblings. Center swatches: `midday.zenith #c6cede`,
  `midday.horizon #dce0db`, `sunset.horizon #cf946b`. This confirms the
  denser reference path is live, but it is not an accepted visual baseline.
  Verified with `npm run test:scripts:flat` passing 354 specs and 0 failures.
- A panned-up companion patch, `midday.horizonSky`, now keeps the midday
  horizon near the lower frame edge instead of spending most pixels below the
  horizon. Full `132x84` sourced-stack output was generated at
  `tmp/atmosphere-finer-sampling-sky-patches/midday-horizon-sky-frame-132x84-finer-defaults.png`
  with Markdown/JSON/progress-log siblings. It used the same `64/16`
  numerical sampling as that historical run. The report shows
  `81/84` center-column rows are sky, center `#96abc2`, top row `#8297b6`,
  nearest sky-horizon row `#f7e0cd`, and first surface row `81` at
  `-0.2503 deg`. This improves the comparison framing, but the upper sky is
  still muted relative to the user photo. Verified with
  `npm run test:scripts:flat` passing 356 specs and 0 failures.
- The `midday.horizonTallSky` scene is implemented and covered by tests for a
  future taller artifact. It centers a `54 degree` vertical FOV at
  `25 degrees` elevation so the comparison can include more upper sky with the
  horizon low in frame. No full `132x168` image has been generated for that
  scene yet. Last observed verification after adding it:
  `npm run test:scripts:flat` passed with 357 specs and 0 failures.
- Flat-geometry impact is now recorded in the sun plan. The same
  multiple-scattering/diffuse-airlight change must be bounded for flat
  near-parallel rays because optical depth can keep accumulating in dense air.
  Follow-ups: add flat horizon-profile diagnostics, extend light-extent into
  visibility-depth classification, define flat-ray asymptotic/termination
  behavior, and calibrate any flat approximation against a finite-slab or
  stronger radiative-transfer reference where possible.
- A future
  [Multiple-Scattering Reference Design](plans/retired/atmosphere_reset/multiple_scattering_design.md)
  now exists. It is the preferred direction after backing out the
  diffuse-airlight proxy: build or source a real higher-order transport
  reference instead of accumulating compensatory approximations.
- Follow-up: model full flat-world lit-terrain visibility depth by combining
  finite/distant Sun falloff, source-to-terrain/source-to-air transmittance,
  terrain-to-camera transmittance, in-scattered airlight, and terrain contrast.
  The current light-extent probe covers only the source-path classification
  part of that problem. If the model says distant terrain detail is
  functionally unrecoverable, a named low-detail visual proxy may be
  acceptable, but it should be reported as a visibility-threshold approximation
  rather than hidden ambient light.

## Bootstrap Handoff

Current focus: physical atmosphere reset for the globe calibration path and the
flat-world/local-Sun comparison model.

Current known-good state:

- The route `/flat/globe-simulation` renders a San Jose surface-camera
  spherical scene pinned to solar noon at `2026-06-13T13:07:44-07:00`.
- Globe atmosphere integration Phases 1 through 4.4 are implemented.
- The atmosphere source uses physical top-of-atmosphere solar irradiance.
- The globe surface and synthetic red marker faces write Lambertian
  radiometric surface radiance into a linear half-float solid render target.
- `GlobeAtmosphereComposer` combines radiometric surface radiance with
  radiometric in-scattering, then applies the shared display bridge once.
- Selected bright-star probe pixels now sample sky color in the latest capture,
  but star brightness still needs a named photometric bridge.

Current visual problems:

- The sky is muted blue-gray rather than clear daylight blue.
- The horizon can become brown at some viewing angles.
- Red marker faces can darken near their lower contact line and become pinker
  higher up as atmosphere airlight is added over red surface radiance.
- A `0.02 km` visual inset now starts marker faces just below the mathematical
  globe surface to reduce bottom-edge depth fighting; this is not an
  atmosphere parameter.

Recommended next step:

- Treat the current globe atmosphere code as mineable context for a reset, not
  as the target architecture. The new research baseline is
  [Atmosphere Reset Research](plans/retired/atmosphere_reset/research.md): a
  physical-constants-first model that starts with a CPU spectral reference
  integrator, explicit CIE/display conversion, documented environmental inputs,
  and swappable world-geometry / solar-source properties before returning to
  shader tuning. The implementation contract is
  [Atmosphere Reset Design](plans/retired/atmosphere_reset/design.md), and the
  CPU solver contract is
  [Reference Code Design](plans/retired/atmosphere_reset/reference/code_design.md).
  The canonical stage packet contract is
  [Reference Stage Contracts](plans/retired/atmosphere_reset/reference/stage_contracts.md).
  The stage-level test matrix is
  [Reference Test Design](plans/retired/atmosphere_reset/reference/test_design.md).
  The actionable stage-test sequence is
  [Reference Test Plan](plans/retired/atmosphere_reset/reference/test_plan.md).
  Source-to-decision traceability lives in
  [Reference Decision Log](plans/retired/atmosphere_reset/reference/references.md).
  The focused script checklist is
  [Reference Plan](plans/retired/atmosphere_reset/reference/plan.md),
  with current reference status in
  [Reference Status](plans/retired/atmosphere_reset/reference/status.md),
  and the broader reset checklist is
  [Atmosphere Reset Plan](plans/retired/atmosphere_reset/plan.md),
  which adapts external test patterns from Bruneton/PBRT into local
  known-answer tests before shader parity. This plan should be executed
  test-first: write the analytic/invariant/reference-data tests for each phase,
  confirm they fail for missing behavior, then implement the reference code
  under `scripts/flat/atmosphere_rejected/reference` until they pass. The current
  implementation should be treated as architecture and naming material to mine,
  not as a compatibility constraint. After the stage API and stage tests are
  stable, the reference should include a CLI runner for named probes, JSON
  config inputs, stage-limited diagnostics, and
  deterministic JSON output, borrowing style from the existing flat capture and
  asset-pipeline scripts. Markdown reports should be the first human-facing
  output format, with optional linked SVG/PNG artifacts for swatches, curves,
  and later sky maps. The reset design now defines canonical pipeline stage ids
  for the CPU API, CLI `--stage` diagnostics, tests, reports, and later shader
  approximation design. Each stage should be independently runnable through
  `CpuSpectralReferenceIntegrator.runStage` with declared
  `requires`/`provides` metadata, so tests can execute one stage at a time and
  `traceRay` can be verified as the composition of the same public stages.
  `pipeline-stages.js` remains the declarative stage registry and now includes
  each stage's `StageClass` constructor. Each canonical physical stage lives
  behind a focused helper class under
  `scripts/flat/atmosphere_rejected/reference/stages` with the shared helper signature
  `run(packet) -> packet`; `descriptor` and integrator `context` are supplied
  at construction. Class files default-export their class and export nothing
  else; package barrels may re-export those defaults for public API convenience.
  `runStage(stageId, packet)` remains the public stage API and the authority
  for integrator stage specs. Pair that with a matching test split: focused stage specs in
  `scripts/flat/atmosphere_rejected/reference/stages/_tests` own public packet
  input/output behavior, while helper specs own internal algorithm and
  edge-case tests when needed. JSON config/schema validation is deferred until
  the CLI run-definition shape stabilizes; when added, it should use a
  standard JSON validation framework with explicit schemas rather than a
  hand-written schema system, including tests that inputs accept only a given
  list of properties. Scattering phase
  evaluation is split from single-scattering accumulation so angle and
  phase-function tests can run independently. The initial
  `scripts/flat/atmosphere_rejected/reference` scaffold and focused
  `npm run test:scripts:flat` Jasmine lane now exist; the later physical stage
  behaviors are still placeholders pending test-first implementation.
  The pipeline scaffold specs are organized with one `describe` block per
  canonical stage and an `Integration` block for composition behavior.
  Physical behavior should now be implemented one stage at a time: write the
  next stage's unit tests first, confirm they fail against placeholder/missing
  behavior, implement that stage, rerun `npm run test:scripts:flat`, then move
  to the next canonical stage. Stage tests must be domain-first: expected
  results come from physics, math, public API contracts, analytic known
  answers, invariants, or pinned external reference data, not from current code
  shape or helper behavior. Expected values should be pinned directly as
  literals, authoritative table rows, standard metadata, or reviewed
  generated artifacts from an independent external source whenever practical;
  do not justify one new local implementation with another new local
  implementation. Every expected datum that enters a spec or fixture must carry
  a nearby derivation note naming the equation, table, metadata field, external
  tool/config, or provenance record well enough for a reviewer to locate it.
  In specs this is usually a comment; in JSON fixtures, use the canonical
  `reference` object with `id`, `kind`, `title`, `url` or `path`, `locator`,
  and `derivationSummary`, plus `expected.<quantity>.derivation` for exact
  value arithmetic. The reference test design now also includes
  reference-mined verification ranges for transport invariants, solar-source
  sanity, ASTM G-173 AM1.5, U.S. Standard Atmosphere checkpoints, CIE color
  conversion, Rayleigh wavelength behavior, and Bruneton-style discipline.
  The next test-plan stage after `validateRequest` is the analytic invariant
  spine: toy fixtures for vacuum, zero-length paths, homogeneous media, split
  paths, isotropic phase, one-sample scattering, and Lambertian surfaces before
  importing external reference tables or broad sky-color comparisons. Start
  that stage with an expectation ledger recording quantity, source class,
  source, assumptions, pinned expected value, derivation note, tolerance, and
  independence review note for each test. The reference decision log now owns
  that intake workflow, derivation-note seeds, and the first analytic
  expectation batch. The first encoded fixture now lives at
  `scripts/flat/atmosphere_rejected/reference/fixtures/expectations/analytic-invariants.json`
  with eight hand-derived analytic expectations and canonical `reference`
  provenance. Physics-backed rows now use external PBRT references for
  transmittance, phase, volume-scattering in-scattering, and diffuse
  reflection; local code design is used only as the specialization/context,
  not the physics authority. The first fixture-to-test helper now lives at
  `scripts/flat/atmosphere_rejected/reference/_tests/test-expectations.js`; it loads the
  analytic fixture, indexes expectations by `id`, and centralizes exact,
  absolute, and relative tolerance assertions. The fixture-shape spec now
  validates required provenance and derivation fields, and rejects
  physics-backed expectation rows that lack an external canonical reference.
  The current goal is to fill out validation tests only; physical stage
  implementation is deferred until those validation tests are reviewed.
  `scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js` now
  validates the analytic fixture shape and helper behavior. Correction: the
  first pipeline stage is `validateRequest`, so its pending shells were
  replaced with real domain tests before implementation, those tests were
  observed failing, and `validateRequest` has now been implemented. The
  focused lane passes with 81 specs and 0 failures after hardening the
  `validateRequest` tests and moving display/report consumers out of the
  canonical transport stage registry. A validation-test review found five grounding issues
  to close before moving to optical depth. Addressed: near-zero ray rejection
  is covered in the `validateRequest` stage tests; flat-model coverage proves
  interface compatibility without relying on `geometryKind` by using a model
  fixture created without that property; request-level physical coefficient
  extras are accepted as inputs without changing contracted output fields; and
  placeholder scaffold assertions are documented as scaffold/API coverage, not
  physical validation coverage. The review also identified useful additional hardening coverage.
  Addressed: fuller observer/ray vector shape cases, a valid
  single-wavelength-grid case, missing model owner object cases, known
  numerical-control string rejection, positive integer sample-count controls,
  display/report consumer extra-field tolerance, and integrator-default model,
  numerical-control, and wavelength-grid non-mutation coverage.
  Display/reporting consumer controls are tolerated as unrelated input extras
  because color conversion and report shaping consume pipeline results after
  transport. Generic allowed-property validation is deferred to a future
  standard JSON schema layer. Zero distance controls are valid, negative
  distance controls reject, and `minStepKm > maxStepKm` rejects.
  `integrationMethod` accepted names belong to the future integration-method
  registry/implementation, not to a duplicated hardcoded `validateRequest`
  allow-list. If the registry is the single source of truth, `validateRequest`
  may use it to validate input. Unknown numerical keys are not rejected, but
  are dropped from `validatedRequest.numerical` so later stages only see owned
  controls. Next, add
  `integrateViewOpticalDepth` validation tests that consume the analytic
  fixture, confirm they fail against placeholder behavior, and stop for review
  before implementing optical-depth behavior. Pending
  `integrateViewOpticalDepth` shells now exist for the four analytic fixture
  expectations plus empty path output, schema alignment, monotonic
  accumulation, multi-wavelength independence, species summation, and
  negative-extinction rejection. The reference plan now tracks the next fixture
  rows for those shells: empty explicit output, two-sample monotonic
  accumulation, multi-wavelength homogeneous transport, multi-species
  summation, and negative-extinction rejection. It also lists the required
  references for each fixture row, separating PBRT physics sources from local
  packet-schema/error-contract design sources. The plan also tracks
  expected-input extremes for optical depth: optically thin/thick transport,
  long-path low-extinction versus short-path high-extinction equivalence, and
  max supported wavelength/species/sample counts. This has been corrected to be
  data/reference based rather than arbitrary: use CIE/ASTM dataset ranges,
  PDAS/U.S. Standard Atmosphere table extents, ASTM AM1.5 reference
  conditions, selected clear-air coefficient models, primary-audited air-mass
  formulas, and convergence studies rather than made-up stress numbers. Those
  references have begun to be sourced: NLR `ASTMG173.csv` is pinned at `2002`
  rows from `280-4000 nm`, Kasten and Young 1989 supplies the near-horizon
  optical-air-mass row `38.0868`, and Bucholtz 1995 supplies Rayleigh optical
  depth candidates for standard atmospheres; visible-band Rayleigh literals
  still need clean table extraction before becoming fixtures. The flat/local-Sun
  path also now explicitly tracks the large-lateral-atmosphere problem: a flat
  horizontal slab ray needs a named finite side boundary, and large flat-world
  extent should produce large optical depth through the normal path-integral
  math rather than through a special tuning constant. The current
  fixture-source inventory now lives at
  [Reference Fixture Sources](plans/retired/atmosphere_reset/reference/fixture_sources.md).
  It records which expected-data sources are ready, partially ready, or not
  ready. The analytic invariant fixture has been expanded to 16 rows, adding
  empty-path explicit output, two-sample monotonic accumulation,
  multi-wavelength homogeneous transport, multi-species summation, and
  negative-extinction rejection for the next `integrateViewOpticalDepth` test
  pass. A coverage reevaluation added weighted sample integration,
  coefficient/wavelength shape rejection, and invalid sample-weight rejection,
  so we now have enough for that analytic stage pass. We still do not have
  enough for a full Earth clear-air spectral transmittance fixture because
  aerosol/Mie, ozone, water vapor, and visible-band Rayleigh extraction/model
  choices remain open. The next-phase `integrateViewOpticalDepth` tests now
  live in
  `scripts/flat/atmosphere_rejected/reference/stages/_tests/IntegrateViewOpticalDepthStage.spec.js`
  and pass against `IntegrateViewOpticalDepthStage`. The first
  `resolveRayPath` fixture-backed batch and recommended hardening batch are
  also implemented and pass against `ResolveRayPathStage`; the focused lane
  reported 127 specs, 0 failures, and no pending specs before the next red
  step. The `sampleViewPath` fixture-backed tests now load
  `view-samples-contracts.json` through the shared expectation helper and
  compare empty paths, zero-length paths, midpoint samples, weight sums,
  ordered distances, diagnostic preservation, invalid segment distances,
  invalid `viewSteps`, and metadata directly against fixture rows.
  `SampleViewPathStage` implements fixed midpoint sampling, no-sample
  empty/zero-length paths, metadata, segment validation, and positive-integer
  `viewSteps` validation. Segment length reconciliation now lives in the
  shared `normalizeRayPathSegment` utility instead of the stage. The next
  active stage is `evaluateMedium`. During this phase, each physical stage's direct
  `runStage(stageId, packet)` tests are the authority; integration tests
  remain composition/API checks until the stages they compose have isolated
  known-answer coverage.
  `EvaluateMediumStage` spec now contains 26 pending skeletons covering
  controlled model samples, sample positions, wavelength alignment, species
  diagnostics, altitude/density diagnostics, vacuum/outside-atmosphere
  behavior, invalid coefficient/density data, and deferred sourced Earth
  atmosphere checkpoints and composition coverage. The focused lane passes
  with 173 specs, 0 failures, and 26 pending specs. The `evaluateMedium`
  sourcing pass now favors data
  references over algorithmic generation for real Earth/profile rows: PDAS
  U.S. Standard Atmosphere table rows, backed by the NASA NTRS 1976 standard
  record, are identified for `0 km`, `80 km`, and `85 km`
  density/profile checkpoints; official CIE metadata is identified for
  visible-grid alignment. Exact standard dry-air composition fractions and
  their supported altitude range still need primary/standards extraction before
  becoming fixture literals. Real coefficient fixtures remain deferred until a
  Rayleigh/aerosol/absorber source decision is made.
  The current
  `validateRequest` expected values now carry inline source/derivation comments
  that point to the reference code design and test design rather than inventing
  unsourced values.
  In this context, `validateRequest` validation means checking physical-unit
  sanity, model-interface requirements, and numerical-control limits. Later
  stages validate computed values against physical equations, analytic
  invariants, independent fixtures, or convergence limits. Each validation
  limitation in the current red tests now has a nearby reason comment
  explaining why that limitation exists.
  For any code or test backed by a physical property, include a source
  reference plus a short description of what the source supports. The current
  ray-origin/ray-direction validation cites PBRT v4 Rays for ray semantics;
  local policies such as near-zero thresholds and model-owned coefficient
  placement are described as project/API decisions rather than external
  physics facts. Every test expectation and code validation check should carry
  a nearby reason comment; physical reasons cite an external source, and local
  API/schema reasons cite the reference design/test design. Implemented
  algorithm steps also need source breadcrumbs, not only rejection branches:
  path selection, optical-depth accumulation, species summation, and
  Beer-Lambert conversion should cite the supporting source, fixture row, or
  local design contract near the code. Secondary sources can be used as
  stepping stones, but before a source-backed value or claim becomes
  package-facing we should chase down a primary source, reinforce the secondary
  source with one, or explicitly retain the secondary source with a stated
  limitation.
  Keep the reference decision log current whenever a consulted source changes a
  value range, fixture, invariant, model assumption, or review checklist.
  Treat the reference as a potential future standalone package: keep the core
  framework-free, plain-data based, externally justified, browser-free, and
  compatible with a later SemVer public API. Current package-shape precedent
  includes libRadtran, SMARTS, Bruneton's CPU-reference validation path, and
  Semantic Versioning.
  Internal math helpers are provisional while contracts settle; validated
  external libraries can replace them later when provenance, standards
  alignment, licensing, maintenance, and replacement tests justify it. Use
  narrow wrappers and keep domain tests as the authority, not the library's
  current output.
  `CpuSpectralReferenceIntegrator.js` now follows
  class file naming conventions and `types.d.ts` defines ambient JSDoc
  contracts for the reference API shell. The shell currently covers
  `mergeRequest`, `resolveProbeRequest`, `createInitialPacket`, `runStage`,
  `runUntil`, `traceRay`, and `traceProbe`.
  The design docs now include a deferred physical-effects ledger note: before
  treating the pipeline design as complete, explicitly list omitted
  nontrivial physics such as refraction, their likely impact, why each is
  deferred, where each would enter the pipeline, and what reference/test
  evidence would be needed.
  `utils.js` now exports `normalizeVector3`, which implements reusable
  finite-vector validation and unit-vector canonicalization, and
  `normalizeRayPathSegment`, which centralizes finite segment validation and
  endpoint/length reconciliation. Both have dedicated utility tests; stage
  expectations should still be stated from the physical/API domain first.
  `validateRequest` now uses `normalizeVector3` as an implementation detail
  while owning the domain rule that ray input is a finite nonzero orientation
  vector and validated output is a unit direction.
  Keep code files generally below 1000 lines. Keep `pipeline-stages.spec.js`
  focused on registry behavior; adjacent producer/consumer checks belong in
  `pipeline-handoffs.spec.js`, and full public `traceRay` physical acceptance
  fixtures belong in `trace-ray.integration.spec.js`. Real fixture-backed
  stage behavior should move into focused stage specs under `stages/_tests`.
  Each canonical physical stage now has a focused helper class, with helper
  internals covered by matching helper specs when needed. The
  `IntegrateViewOpticalDepthStage` tests now follow the focused stage-spec
  split.
  The shader can later fuse those stages
  into a one-pixel ray march with per-sample atmosphere/source evaluation and
  accumulated radiance, swapping spectral diagnostics for RGB approximations,
  lookup tables, and fused math only after parity probes exist.
  Clouds remain out of the first reset, but the design now preserves a path for
  them as future participating-medium species with spatial density,
  extinction, scattering, phase functions, and diagnostics instead of a display
  overlay.
  The research note also includes the proposed
  flat-world/local-Sun variant as a separate physical configuration that should
  reuse the same scattering math while changing surface geometry, atmosphere
  volume, altitude/density rules, solar source geometry, and occlusion/boundary
  rules. A shader-specific design document is intentionally deferred until the
  CPU reference is trusted and shader parity work needs dedicated approximation
  contracts. If continuing the current path temporarily, use the
  [Spherical Sun Atmosphere Plan](plans/retired/spherical-sun-atmosphere-plan.md)
  Phase 4.6 diagnostics before changing physical coefficients: confirm the
  Rayleigh phase angle sign convention, compare Rayleigh-only and Mie-only
  captures, and isolate whether the brown horizon comes from aerosol/Mie
  weighting, path length, tone mapping, or composition over red surfaces.

Recent verification:

- `npm run test:scripts:flat` passed with 86 specs and 0 failures after making
  the stage request transport-focused, deferring generic allowed-property
  validation, verifying integrator default model non-mutation, accepting zero
  distance step controls while rejecting negative ones and inverted min/max
  ranges, dropping unknown numerical keys from validated controls, and keeping
  display/report consumers out of canonical stage output.
- `git diff --check` passed after the transport-only request and
  post-pipeline consumer-boundary updates.
- `npm run test:scripts:flat` passed with 120 specs, 0 failures, and
  13 pending resolve-ray-path shells after moving canonical stages behind
  helper classes and moving stage-specific specs under
  `scripts/flat/atmosphere_rejected/reference/stages/_tests`.
- Class files in `scripts/flat/atmosphere_rejected/reference` now default-export their
  class and export nothing else. The export-contract scan found no lingering
  named class exports or stage-class named imports, and `git diff --check`
  passed.
- The first `resolveRayPath` fixture-backed tests were wired and observed
  failing against placeholder behavior, then implemented. The focused flat
  script lane then passed with 120 specs, 0 failures, and no pending specs.
- `types.d.ts` now provides concrete IntelliSense contracts for transport rays,
  model-returned atmosphere intervals, surface hits, ray-path output, and the
  model modules. `ResolveRayPathStage` narrows `validatedRequest` before model
  calls, and implemented algorithm branches now cite their supporting
  ray-domain, transmittance, and local model-interface sources.
- `resolveRayPath` boundary precedence is now documented in
  [Reference Code Design](plans/retired/atmosphere_reset/reference/code_design.md):
  later surface hits are ignored, exact entry surface hits produce empty paths,
  exact exit surface hits use surface precedence with atmosphere metadata,
  non-finite surface-hit distances reject, negative surface hits are ignored as
  behind-observer, malformed finite atmosphere intervals reject, and model calls
  receive the validated transport ray. The focused flat script lane now passes
  with 127 specs, 0 failures, and no pending specs.
- The starting `resolveRayPath` inventory now has JSON expectation data in
  `scripts/flat/atmosphere_rejected/reference/fixtures/expectations/ray-path-contracts.json`,
  following the existing provenance shape. JS test helpers may adapt fixture
  rows into controlled model interfaces, but expected path distances, boundary
  reasons, empty-path flags, and expected errors live in data.
- The `resolveRayPath` coverage inventory has been rechecked against expected
  extremes by intent. It now distinguishes inside-volume negative entry
  clipping, intervals entirely behind the observer, zero-length boundary paths,
  surface-before-entry occlusion, inverted intervals, non-finite intervals,
  unbounded flat paths, and source-backed/model-hypothesis finite boundaries.
- Those `resolveRayPath` intents are now real fixture-backed tests in
  `scripts/flat/atmosphere_rejected/reference/stages/_tests/ResolveRayPathStage.spec.js`
  and pass against `ResolveRayPathStage`.
- The `resolveRayPath` fixture rows now live in
  `scripts/flat/atmosphere_rejected/reference/fixtures/expectations/ray-path-contracts.json`
  with controlled inputs, expected outputs/errors, canonical `reference`
  properties, supporting references, and provenance notes.
- Fixture validation now scans every expectation JSON file and requires every
  row to carry a canonical `reference` object, including local design-contract
  rows.
- [Reference Decision Log](plans/retired/atmosphere_reset/reference/references.md) now
  maps each planned `resolveRayPath` row to its supporting references: PBRT
  Rays, PBRT Transmittance, Bruneton reference-testing discipline, local
  code/test design. Geometry-derived atmosphere-top conventions such as FAI
  `100 km` are outside this stage batch.
  It also explicitly identifies the referenced extremes: forward-ray lower
  bound, empty forward segment, zero-length segment, ordered finite interval
  requirement, surface-before-entry ordering, finite flat lateral path,
  and unbounded flat horizontal path.
  - `npm run test:ui:flat`
  - `npm run build`
- `git diff --check`
- Runtime capture:
  `tmp/globe-phase-4-4-surface-radiance-rebuilt/phase-4-4-surface-radiance-rebuilt`

Bootstrap snapshot for the current continuation:

- Active features: `src/flat/features/flat-simulation` and
  `src/flat/features/globe-simulation`.
- Default route: `/flat/flat-simulation`. The globe-simulation calibration
  shell is registered at `/flat/globe-simulation`.
- Default observer: San Jose, CA (`37.3382`, `-121.8863`) at `100 ft`
  elevation, using the San Jose/root observer camera. The north-pole
  bird's-eye camera remains a named inspection preset, not the default.
- Renderer state: `FlatAtmosphereComposer` is the single active atmosphere
  owner. It renders solid scene color/depth, reconstructs camera rays, applies
  camera-ray transmittance, sun-driven Rayleigh/Mie in-scattering, local
  point-sun radiance, background sky distance caps, and air-mass sample-to-sun
  transmittance. Old `AltitudeHaze` and `FlatAtmosphere.jsx` paths are gone.
- Lighting state: the rendered false sun, `scene.lighting.sun`, and
  `scene.lighting.atmosphereSun` are linked to the same resolved
  false-model sun body. Solid-scene lighting uses the sun body's local point
  light facet, while atmosphere scattering uses the same resolved position,
  radius, apparent size, and motion plus the sun body's
  `scene.sun.atmosphere` radiance facet. That atmosphere facet now uses
  explicit `solarIrradianceScale: 58` as the selected daylight calibration value,
  keeping generic light `intensity: 1` separate from the source strength that
  drives Rayleigh/Mie in-scattering. Daytime celestial material visibility is
  now controlled by renderer-owned `starExposure: 0.02` and
  `constellationOverlayExposure: 0.04`, which dim stars/guide overlays before
  the atmosphere composer rather than adding object-specific shader branches.
  Empty-sky/background atmosphere rays now use
  `backgroundAtmosphereViewDistanceKm: 100` and
  `flatSlabHorizonViewDistanceFactor: 0.25`. The earlier separate
  `solar-daylight-analog` atmosphere source and URL inspection mode have been
  superseded by the linked-sun contract. Flat has a registry-backed
  `animation-loop` service that owns simulated time, starts its interval from
  `ready()`, and publishes named solar/sidereal rotation angles for
  framework-neutral subscribers. React components access app services through
  the `FlatProvider`/`FlatContext` pair. Scene playback is currently fixed at
  the solar-day angle where the rotating false sun is closest to the San Jose
  observer, so daytime sky-color tuning has a stable calibration pose. The
  false sun is the only direct local light for lit solid floor/mountain
  materials, and `skyDiffuseIrradianceScale: 0.35` approximates broad diffuse
  skylight on faces not aimed at the finite sun.
- Floor target: floor/terrain should be a real lit surface first, then pass
  through the atmosphere composer so it fades with camera distance.
- Current local terrain is fake: 22 deterministic red rectangular mountain
  prisms. One stray near-field marker sits `0.5 miles` away at `22.5 degrees`
  bearing, offset from the first `1 mile` north marker, and the remaining 21
  markers form an observer-relative spiral from `1` to `101 miles`, adding a
  new `2000 ft` marker every `5 miles`. The bearing cycle uses the eight
  compass directions and shifts by `10 degrees` after each full turn so distant
  markers are less hidden behind nearer ones. The marker source rules now live
  in `src/flat/shared/mountain-simulation.js`; `flat-simulation` projects them
  onto the flat local scene, and `globe-simulation` projects them onto the San
  Jose spherical surface. Observer-relative object placement now goes through
  `src/flat/shared/observer-relative-placement.js`, whose frames describe the
  active surface rather than the observer eye position so placed objects contact
  the flat ground plane or spherical surface.
- A fresh sphere-placement primitive now lives in
  `src/flat/shared/sphere-object-placement.js`. It places a rigid object center
  on the radial line through a selected sphere surface normal, aligns local
  object height to that normal, and supports surface-mounted placement where a
  flat bottom footprint is sunk enough that no sampled bottom corner hovers
  above the spherical surface. The next globe marker implementation should
  replace the current visual mountain path with this primitive rather than
  patching the plane-like renderer further.
- A geometry-dispatch placement helper now lives in
  `src/flat/shared/object-placement.js`. Callers pass a geometry descriptor and
  selected surface position; the helper delegates to the flat-plane or sphere
  placement rule and fails loudly for unsupported geometry.
- Synthetic mountain placement now uses the geometry-dispatch helper in both
  `flat-simulation` and `globe-simulation`. The globe model still computes the
  observer-relative spherical bearing/distance surface point first, then hands
  the actual object placement to the shared sphere rule. Globe tests now sample
  mountain bottom corners to verify the flat footprint is sunk enough that no
  sampled bottom corner hovers above the Earth sphere.
- Globe surface rendering currently has a temporary diagnostic tessellation
  increase (`1536 x 768` sphere segments) to test whether the apparent mountain
  hover is caused by the visible globe mesh being too coarse relative to the
  mathematical sphere used for placement. If the gap changes, replace this with
  a local high-resolution spherical surface patch around the observer rather
  than keeping a globally dense sphere as the permanent solution.
- Globe atmosphere integration Phase 1 is implemented. The globe feature now
  has `src/flat/features/globe-simulation/components/atmosphere-uniforms.js`,
  which adapts the scene's spherical-shell atmosphere frame, clear-day
  atmosphere profile, and date-derived real Sun into shader/uniform values for
  the future composer. Tests cover spherical frame export, real Sun point-light
  export from the camera reference point, and loud failure for non-spherical
  frames.
- Globe atmosphere integration Phase 2 established the offscreen solid-scene
  render target and depth texture plumbing. The earlier translucent
  `AtmosphereShell` placeholder has been removed from the globe render path so
  blue sky cannot be supplied by fake shell geometry. That plumbing is now used
  by the Phase 3 spherical composition shader. Verification for the plumbing
  step: `npm run test:ui:flat` and `npm run build` passed.
- Globe daytime star visibility calibration is set up. `GlobeSimulationSceneModel`
  now uses the same `POC_STARS` source as the flat simulation, selects the 50
  brightest records with northern celestial declination, converts their J2000
  RA/Dec into the globe scene frame, and stores brightness as
  `relativeFlux = 10 ^ (-0.4 * magnitude)`. `GlobeSkyScene` renders them as
  small non-depth-writing points so the future atmosphere composition pass can
  prove the daylight sky overwhelms star radiance rather than manually hiding
  stars. Latest verification: `npm run test:ui:flat` and `npm run build`
  passed.
- Globe atmosphere integration Phase 3 has an initial implementation plus the
  first physical solar-source probes.
  `GlobeAtmosphereComposer` now replaces the pass-through fragment shader with
  spherical single scattering. It reconstructs sky rays from the camera basis
  (`forward`, `right`, `up`, field of view, and aspect) after the inverse
  projection path produced broken sky intersections, uses the spherical shell
  exit for no-depth sky pixels, uses depth hits for solid pixels, computes
  altitude as `length(samplePosition - planetCenter) - planetRadiusKm`, applies
  Rayleigh/Mie extinction and in-scattering, checks spherical Earth occlusion
  toward the Sun, and composites
  `sceneColor * cameraToSceneTransmittance + cameraRayInScattering`. This is
  the first real globe atmosphere pass, not final photometric calibration; it
  uses 32 view samples and an air-mass-style sample-to-sun transmittance
  approximation. `GlobeSimulationSceneModel` now computes physical solar
  irradiance probes from the scene Sun distance, current clear-day atmosphere,
  and San Jose solar altitude. For fixed solar-noon
  `2026-06-13T13:07:44-07:00`, the first probe values are approximately:
  top-of-atmosphere irradiance `1319.5 W/m2`, direct normal irradiance
  `1101.7 W/m2`, direct horizontal irradiance `1068.6 W/m2`, diffuse sky
  estimate `105.6 W/m2`, relative air mass `1.03`, and luminance-weighted
  transmittance `0.835`.
- Globe atmosphere integration Phase 4.1, 4.2, and 4.4 are implemented for the
  source/display boundary. `src/flat/shared/RadiometricDisplay.js` owns the
  framework-free display config and mapping helper. `GlobeSimulationSceneModel`
  exposes normalized `scene.display` settings separately from atmosphere and
  solar probes, and the globe diagnostics panel reports display model,
  exposure, tone mapping, and radiometric scale. `GlobeAtmosphereComposer` no
  longer uses `sunSolarIrradianceScale` as the globe atmosphere shader source
  strength; it consumes `sunTopOfAtmosphereIrradianceWm2` and applies
  `radiometricToSceneRgbScale * exposure` plus tone mapping to atmospheric
  in-scattering. The old
  `topOfAtmosphereIrradianceWm2 / rendererIrradianceReferenceWm2` value
  remains as a legacy diagnostic/compatibility probe, and the default globe
  display scale is now `1 / rendererIrradianceReferenceWm2`. The globe surface
  and synthetic mountain marker faces now render with a Lambertian radiometric
  shader using albedo, direct normal solar irradiance, surface-normal
  incidence, and estimated diffuse sky irradiance. The globe solid-scene target
  stores linear half-float color, and `GlobeAtmosphereComposer` now composes
  radiometric solid-scene color plus radiometric atmosphere in-scattering
  before applying the shared display bridge once. The old Three.js
  ambient/directional lighting path is no longer used for globe surface or
  marker brightness. Latest verification: `npm run test:ui:flat` passed with
  109 specs, `npm run build` passed, `git diff --check` passed for touched
  files, and runtime capture passed at
  `tmp/globe-phase-4-4-surface-radiance-rebuilt/phase-4-4-surface-radiance-rebuilt`.
  The capture shows star probe pixels sampling sky color rather than bright
  star pixels, but the sky remains muted blue-gray and needs further
  atmosphere/display calibration.
- Globe marker contact rendering has a small visual inset fix. The radius-
  sampled mountain marker faces now start `0.02 km` below the mathematical
  globe surface before rising through it, so the contact line does not share
  the exact same depth as the rendered globe surface. This is a rendering
  contact/depth stabilization step, not an atmosphere tuning value. Verification:
  `npm run test:ui:flat`, `npm run build`, and `git diff --check` passed.
- Globe simulation runtime time pin is corrected. The tests had already used
  the San Jose solar-noon calibration timestamp
  `2026-06-13T13:07:44-07:00`, but the rendered route was still constructing
  `GlobeSimulationSceneModel` without a time override, so the page used the
  current system timestamp. `DEFAULT_GLOBE_TIME` now lives in globe constants,
  `DEFAULT_GLOBE_CONFIG.time` uses it, and the model constructor falls back to
  that fixed value instead of `new Date().toISOString()`. A scene-model test
  now confirms the no-argument default scene resolves to
  `2026-06-13T20:07:44.000Z` with high solar-noon Sun altitude. Verification:
  `npm run test:ui:flat` passed with 109 specs and `npm run build` passed.
- Terrain is intentionally deferred for now. The active atmosphere focus is now
  the
  [Spherical Sun Atmosphere Plan](plans/retired/spherical-sun-atmosphere-plan.md):
  integrate the shared depth-aware atmosphere model into the current
  `globe-simulation` view using the spherical-shell frame, real Sun state, high
  tessellation globe surface, and grounded synthetic red mountain markers before
  further tuning the flat-model atmosphere. The earlier
  [Reality-Aligned Daytime Atmosphere Plan](plans/retired/reality-aligned-daytime-atmosphere-plan.md):
  remains the flat-model comparison context for bluer daylight, real-world
  analogs, named renderer controls, daylight airlight, and synthetic mountain
  replacement.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) is now a current-state reference
  only: shared architecture, current consumers, parameter catalog, active
  defaults, current scattering math, and known gaps. Historical phase logs and
  superseded implementation notes have been removed from that design doc.
  Rejected ideas that should not be revisited are tracked separately in
  [Atmosphere Rejected Ideas](plans/retired/flat-root/atmosphere-rejected.md).
- The first globe-simulation feature is implemented as a sibling flat-app page
  feature, not a separate app. `src/flat/features/globe-simulation` registers the
  `globe-simulation` page, owns its controller/view/component/CSS/model/test
  files, and renders a real Three/R3F spherical scene anchored on the San Jose
  observer with only the Sun in celestial scope. The scene defaults to the
  fixed San Jose solar-noon calibration timestamp
  `2026-06-13T13:07:44-07:00`, places Earth at the origin, places the Sun at an
  approximate date-derived AU-scale position, orients Earth with `23.43928 deg`
  axial tilt and date-derived sidereal rotation, places the San Jose surface
  point at `100 ft` elevation, and places the camera at standing eye height
  above that surface point looking toward the Sun. Pointer/touch drag rotates
  the standing camera in place around the local San Jose east/north/up frame so
  the viewer can look around without orbiting away from the surface. It keeps a
  featureless matte green globe surface plus the shared 22 red synthetic
  mountain markers and the selected 50-star daytime visibility layer. The
  earlier translucent visual atmosphere shell has been removed; the globe sky
  should remain a plain background until the composer scattering shader creates
  atmospheric color. Globe markers are projected by bearing/distance along the
  local spherical surface. To avoid misleading long prism depth artifacts from
  a surface camera, the renderer draws each marker as a radius-sampled curved
  red face whose bottom vertices lie on the globe surface at the requested
  near-edge distance and whose top vertices extend `2000 ft` along the
  corresponding local surface normals.

The first app outline has been scaffolded as a Polylith REMVC app alongside
the existing deployed apps.

The first proof of concept should develop only the outline of the false
simulation. The standard sky viewer remains part of the broader product idea,
but it is not in initial POC scope.

`flat` is set up using the pipeline app as the local structural model: a small
`main` bootstrap, an app-shell feature, and separate removable page/view
features.

The app's core idea is to create two different views of the night sky:

- a standard sky viewer
- a hypothetical sky viewer based on intentionally incorrect assumptions

The broader flat app should also include a flat apparent-position mode: keep
the flat scene/floor presentation, but position celestial objects from their
real apparent azimuth/altitude relative to the selected observer and time. That
mode is a comparison bridge between the standard sky viewer and the fully
false celestial projection.

The broad false-model outline is:

- treat Earth as an azimuthal equidistant projection centered on the north pole
- treat the sky as a similar projection of the celestial sphere
- project that sky onto the underside of a half sphere sitting on top of the
  Earth projection

## Architecture Context

Use the architecture topic as the primary setup context:

- registry-centered REMVC is the target application shape
- React is presentation, not the whole view layer
- models own data access, transport, persistence, or domain interaction
- services expose app-facing capabilities over models and internals
- controllers own user-facing flow and orchestration
- app builds are explicit Polylith build definitions
- feature inclusion and runtime side-effect activation are separate concerns
- feature-local assets that must ship should live under the relevant
  `assets/...` paths and be copied by build configuration

If `flat` becomes a simple app shell at first, it can stay small. As it grows,
prefer services and registry-located dependencies over cross-feature imports or
React components reaching into models directly.

Use the pipeline app as the closest implementation precedent:

- `src/pipeline/index.js` imports Polylith feature/config side effects,
  services, models, and `main`, then starts the registry
- `src/pipeline/main` owns application startup and React root bootstrap only
- `src/pipeline/features/app` owns the visible shell, navigation, route/page
  mounting, and page registration behavior
- each page/review feature owns its controller, view service, React
  components, styles, assets, and workflow
- `builds/pipeline.json` explicitly defines the app source, template, copied
  CSS/resources, router, and included feature list

## Notes

- New project will live alongside existing apps because this repo is what gets
  deployed.
- `flat` is organized as a Polylith REMVC app, not as an ad hoc React page.
- Each major view should exist as its own feature. The first feature-level view
  is `flat-simulation`; the standard sky-viewer view remains later scope.
- The pipeline app is the model for app shape, shell/page boundaries,
  page/view registration, and build-file feature inclusion.
- The product compares a standard night-sky view against a second night-sky
  view generated from incorrect assumptions.
- A later flat apparent-position mode should render celestial objects inside
  the flat scene from their real observer-relative apparent positions, rather
  than from the false north-celestial-pole projection.
- The first POC should focus on the flat simulation only.
- The first POC should start with San Jose, CA as the default/root location:
  latitude `37.3382`, longitude `-121.8863`.
- The first POC render target is the sky at midnight at the start of May 22,
  2026 for San Jose local time: `2026-05-22T00:00:00-07:00`.
- The incorrect-assumption model starts from a north-pole-centered azimuthal
  equidistant Earth projection, a similar projection of the celestial sphere,
  and a sky dome rendered as the underside of a half sphere over the projected
  Earth.
- Exact geometry, coordinate mapping, observer position behavior, and rendering
  controls still need to be defined before implementation starts.
- Three.js is the expected renderer for the POC.
- Initial app outline implementation has started.

## Implementation Status

Implemented:

- `src/flat/index.js` starts the registry through Polylith feature/config side
  effects, shared services/models, and `main`.
- `src/flat/main` now follows the pipeline-style controller/view bootstrap.
- `src/flat/services` provides `app-pages`, `views`, and `url` services.
- `src/flat/features/app` owns the app shell and page mounting.
- `src/flat/features/flat-simulation` registers the first feature page and
  renders the Phase 1 Three.js false-sky scene.
- `server/flat/index.js` serves the app index for clean `/flat/*` routes.
- `builds/flat.json` includes the app router and feature list.
- `polylith.json` includes the `flat` app name.
- `src/flat/test.js` and `src/flat/shared/_tests` provide the app-local
  Polylith/Karma unit test entry.
- `karma.flat.conf.cjs` runs only the flat test bundle so stale or unrelated
  app test bundles do not affect `npm run test:ui:flat`.
- `src/flat/shared/projection` now contains the plain reusable
  `ProjectionModel` class plus the first flat-simulation projection classes:
  `NorthPoleAzimuthalEquidistantEarthProjection`,
  `NorthCelestialPoleAzimuthalEquidistantProjection`, and
  `UpperHemisphereRadialLiftProjection`.
- `src/flat/shared/Atmosphere.js` defines the first shared, framework-free
  atmosphere model for both flat-simulation rendering and a later
  globe/spherical renderer. It owns the standard Earth profile
  constants, sea-level density, exponential Rayleigh/aerosol density falloff,
  flat-slab and spherical-shell altitude frames, finite segment/ray sampling,
  atmosphere-exit sampling, optical-depth/transmittance output, and plain
  shader-uniform data.
- Future atmosphere scattering should continue to take explicit light/sun
  state from the scene model rather than deriving its own sun position
  internally. The visible false sun and atmosphere scattering source are now
  distinct scene-light contracts; their anchors should eventually come from
  known, user-visible assumptions. A future control panel should expose
  assumptions such as sun position, motion model, distance, size, and
  atmosphere-light mode instead of burying them in the atmosphere renderer.
  Visible sun rendering may also need a later accuracy pass so disk brightness,
  color, glare, apparent size, and atmospheric attenuation can derive from the
  same radiance/transmittance model used for sky scattering.
- Future atmosphere profile work should also consider refractive index /
  refractivity as a separate physical property from scattering. Refraction can
  bend apparent sun/star positions near the horizon, lift objects relative to
  the geometric horizon, and affect sunrise/sunset timing.
- Focused atmosphere design notes now live in
  [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md). The intended next model is
  explicit-light single scattering: scene-level sun/light assumptions resolve
  to directional or point light state, and `Atmosphere` integrates camera to
  sample and sample to light transmittance with Rayleigh/Mie phase functions
  and flat/spherical shadow tests.
- `src/flat/shared/Sun.js` defines the shared light-source class for
  atmosphere work. It supports directional and point sun models, normalized
  sample-to-light direction, finite point-light distance, explicit open anchor
  state, and plain shader uniforms. `Atmosphere` now accepts a `Sun` instance
  or sun config, exposes Rayleigh/Mie phase helpers, computes sample-to-light
  transmittance, checks flat and spherical shadows, and can sample CPU-side
  single scattering along a view ray.
- `src/flat/shared/math-primitives.js` owns the stateless numeric, vector, and
  RGB helpers shared by `Atmosphere` and `Sun`. Atmosphere-specific helpers now
  live as static `Atmosphere` methods, keeping `Atmosphere.js` class-owned
  while avoiding duplicated math utilities.
- `src/flat/shared/consts.js` owns exported atmosphere/sun constants, and
  `src/flat/features/flat-simulation/models/consts.js` owns flat-simulation
  scene defaults. Class implementation files now export only their class:
  `Atmosphere.js`, `Sun.js`, and `FlatSimulationSceneModel.js` no longer
  export constants or secondary named symbols.
- `src/flat/shared/types.d.ts` and
  `src/flat/features/flat-simulation/models/types.d.ts` now define ambient
  JSDoc types for shared atmosphere/sun/math contracts and flat-simulation
  scene/sun contracts. Newly added atmosphere, sun, math helper, scene-model,
  and first-class sun-rendering code now uses those types in JSDoc.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) now includes a concrete renderer
  integration plan: add a shared runtime sun resolver, make `SunBody` consume
  it, add an atmosphere-uniform adapter, wire a first light-aware atmosphere
  material, test the resolver/adapter, then promote to depth-aware
  composition.
- `src/flat/features/flat-simulation/models/sun-animation.js` now owns the
  first concrete atmosphere-integration step: resolving the animated
  false-model sun at render time. `resolveAnimatedSun()` updates the visible
  sun position, compatibility object position, point-light position/direction,
  light distance, and apparent angular size together without mutating the
  scene-model sun.
- `SunBody` now renders from `resolveAnimatedSun()` on the shared React Three
  Fiber clock instead of using its former local rotating group path. The
  visible sun completes one full rotation over its configured display duration,
  matching the timing convention used by the other animated scene objects and
  preparing the same resolved sun state for future atmosphere uniforms.
- `src/flat/shared/projection/PocStars.js` contains a compact Phase 1 real
  bright-star fixture with 129 named stars, J2000 RA/Dec, visual magnitude, and
  source tags.
- `src/flat/shared/projection/PocConstellations.js` defines red asterism
  overlays for the Big Dipper, Little Dipper, Orion, and the Southern Cross.
- `src/flat/features/flat-simulation/models/FlatSimulationSceneModel.js`
  creates the plain scene view model for San Jose at the Phase 1 midnight
  timestamp.
- `src/flat/features/flat-simulation/components/FlatSkyScene.jsx` renders the
  first Three.js scene from the plain scene view model: projected Earth disc
  context and star points on the hidden dome surface, viewed from the projected
  San Jose observer position. Canvas drag rotates the fixed observer camera so
  the viewer can look around without leaving the observer point.
- The scene model now formalizes the visible false-model sun instead of hiding
  it as a generic orange reference object. `DEFAULT_FLAT_SIMULATION_SUN` is
  the canonical source for the 32-mile-diameter body centered 3000 miles above
  a date-resolved annual latitude ring. The default latitude rule is
  `annual-tropic-migration`, moving between `23.5 deg N` and `23.5 deg S`
  over the year, while the daily animation completes one rotation around the
  projection center every simulated 24 hours. The scene derives both
  `scene.sun` and the renderable `scene.objects` sun sphere from that source.
- The false-model sun also derives `scene.lighting.sun` as a point-light state
  using the shared `Sun` class, so future atmosphere scattering can consume the
  same object that the renderer shows. Its visible body still animates around
  the simulation origin on the date-resolved projected latitude ring as a
  solar-day body, using a 24-hour simulated circuit compressed into a
  40-second visible loop.
- The visible false-model sun is now rendered through first-class `scene.sun`
  state rather than only through the generic object loop. Its render contract
  keeps the body visible and sizes it from physical `radiusKm`; observer-to-sun
  distance derives `scene.sun.apparent` and the matching apparent angular
  radius/diameter on `scene.lighting.sun`.
- The first planned false-sun controls are latitude rule, elevation above the
  projected floor, and physical radius. The scene model supports these as
  `config.sun.latitude`, `config.sun.altitudeKm`, and `config.sun.radiusKm`,
  and changing them updates the rendered body, apparent size, and point-light
  state from the same source.
- The dome star points animate around the same vertical axis on a sidereal-day
  period. With the solar day set to 40 seconds, the sidereal loop takes about
  `39.8908` seconds.
- The Big Dipper, Little Dipper, Orion, and Southern Cross are rendered as red
  line overlays on the dome. The overlay rotates with the same sidereal period
  as the star points.
- The old `AltitudeHaze` transparent shader shell has been removed from the
  flat-simulation renderer. `scene.atmosphere` now exposes an enabled shared
  atmosphere configuration with the flat-slab frame and standard Earth
  profile, consumed by the depth-aware composer.
- `src/flat/features/flat-simulation/components/atmosphere-uniforms.js` now
  adapts shared `Atmosphere` state and explicit scene sunlight into
  Three/R3F-style uniform objects. It flattens the atmosphere frame for shader
  use and keeps mutable sun uniforms stable so the atmosphere pass can update
  from `scene.lighting.atmosphereSun`.
- The superseded `src/flat/features/flat-simulation/components/FlatAtmosphere.jsx`
  shell fallback has been removed. The composer is the single active
  flat-simulation atmosphere owner.
- `src/flat/features/flat-simulation/components/FlatAtmosphereComposer.jsx`
  owns the depth-aware composition pass. It renders the solid false scene into
  an offscreen `WebGLRenderTarget` with `DepthTexture`, then draws a fullscreen
  shader over that result. The active shader applies camera-ray optical depth,
  transmittance, atmosphere-sun-driven Rayleigh/Mie in-scattering, optional
  false point-sun radiance bridging, bounded background atmosphere view
  distance, and air-mass sample-to-sun transmittance with a short light-march
  comparison path. `FlatSkyScene.jsx` keeps camera/look controls separate from
  the solid render contents so floor, mountains, stars, constellations, and the
  visible sun flow through the composer.
- The flat-simulation Earth floor now uses the app-wide copied raster
  `src/flat/assets/images/natural-earth-2-50m.jpg`, generated from Natural
  Earth's public-domain "Natural Earth II with Shaded Relief and Water" 1:50m
  GeoTIFF. The runtime JPG is a downsampled equirectangular source image, not a
  preprojected polar poster. The floor shader performs the inverse
  north-pole-centered azimuthal-equidistant lookup per fragment, converting
  floor x/y position back to longitude/latitude before sampling the raster.
  This makes the floor georeferenced to the same projection math that places
  the San Jose observer.
- The Earth and dome projection-to-Three convention now maps projected
  north-pole AE `y` to world `+z`. The floor shader compensates for the
  rotated plane mesh during inverse texture lookup, so the San Jose observer
  remains georeferenced while Florida lands to the observer-camera east/right
  when the default view looks north toward the projection center.
- The default San Jose/root observer elevation is now `100 ft` (`30.48 m`).
  This is stored on the root location, projected to observer scene height
  `0.03048 km`, and used directly by the default camera with no extra
  high-altitude inspection offset.
- The flat-simulation scene now includes a deterministic synthetic local
  mountain calibration set: one stray near-field red prism at `0.5 miles` and
  `22.5 degrees` bearing, followed by a 21-marker observer-relative spiral from
  `1` to `101 miles` with one new marker every `5 miles`. Each prism is
  `2000 ft` tall, its width is `5x` height, and its length/depth is `10x`
  height. Spiral bearings step through north, northeast, east, southeast,
  south, southwest, west, and northwest; each completed eight-marker turn
  rotates the next turn by `10 degrees` so distant markers are less hidden by
  nearer ones. This is temporary POC terrain evidence, not real DEM terrain.
- The default view is back at the San Jose/root observer point. The temporary
  floor-inspection camera has been removed from the default scene model, though
  `camera` remains an optional scene override for future debugging.
- The temporary orthographic floor-inspection view is now configured through
  the actual React Three Fiber camera with canvas-aspect-aware projection
  bounds. The base-disc shader also respects `atmosphere.enabled` so disabling
  haze removes haze-color blending from the floor.
- The floor inspection base mesh now uses a subdivided plane with a circular
  fragment discard instead of `circleGeometry`, after a diagonal cutoff hinted
  at a circle-triangle/UV rendering artifact. The temporary orthographic
  inspection camera was replaced with a regular perspective camera below the
  dome/star layer after the cutoff persisted.
- Borrowed the immediately useful atmosphere-pipeline idea from the
  `leoawen/volumetric_cloud_atmosphere_scattering` reference: keep solid-world
  floor rendering separate from atmosphere composition. The generated Earth
  texture now carries its own transparent outside-disc alpha and renders with a
  plain `meshBasicMaterial`; haze remains only in the separate atmosphere
  overlay path.
- The observer view includes subtle Earth-surface scale cues: range rings and
  radial bearing lines centered on the projected observer position. These are
  presentation aids only; the hidden sky-dome projection remains the source of
  star positions.
- The dome surface remains hidden, but visible celestial latitude/parallel
  guide rings are drawn around the dome every 10 degrees.
- The sky projection uses the full north-to-south celestial-pole domain:
  `0°` angular distance from the north celestial pole is the projection
  center/top above the simulation origin/projected north pole, not above the
  observer. `180°` is the south celestial pole on the outer horizon/rim.
- Stars are rendered as Three.js points at their projected 3D dome positions,
  with perspective size attenuation enabled. The current point size is
  intentionally exaggerated in kilometer units so distant point sources remain
  visible during the POC.
- Dome latitude guide rings are now sampled celestial declination parallels,
  not manually sized torus shortcuts. Each guide line samples right ascension
  around a fixed declination, then uses the same
  `NorthCelestialPoleAzimuthalEquidistantProjection` and
  `UpperHemisphereRadialLiftProjection` chain as stars before rendering the
  result as line segments on the hidden dome surface.
- The dome lift still maps projected angular ratio to hemisphere polar angle:
  `surfaceRadius = domeRadius * sin(ratio * pi / 2)`. This keeps the full
  north-to-south celestial pole domain while making the visible guide spacing
  come from projected latitude/declination lines rather than independent
  display radii.
- The Phase 1 false geometry now uses kilometer-scale coordinates. The Earth
  projection uses mean Earth radius `6371.0088 km`; the projected pole-to-pole
  Earth disc and hidden dome radius are both `20015.114442035923 km`.
- `src/flat/templates/index.html` includes `<base href="/flat/">` so clean
  deep routes load built app modules and CSS from the flat app root.

Verified:

- `node --check` passed for the new non-JSX controllers, services, views, and
  server router.
- `npx polylith build flat` passed and copied feature CSS into `dist/flat`.
- `npx polylith test flat` passed for the initial app-local spec setup.
- `npm run test:ui:flat` passed after adding the flat-specific Karma config.
- `npm run test:ui:flat` passed after adding `ProjectionModel` specs for
  registration, missing projection errors, San Jose root context, observer
  projection, north celestial pole mapping, and celestial equator mapping.
- `npm run test:ui:flat` passed after adding projection-specific invariant
  specs for the Earth, celestial, and sky-surface projection classes.
- `npm run test:ui:flat` passed after adding POC star fixture and
  flat-simulation scene model specs.
- `npx polylith build flat` passed after adding the first Three.js scene.
- Browser checks for `/flat/flat-simulation` passed on desktop `1280x800` and
  mobile `390x844`: San Jose/time text was present, no page errors were
  reported, the canvas was nonblank, and mobile width had no horizontal
  overflow.
- Browser checks passed again after changing the scene to observer point of
  view and removing the visible dome mesh.
- Browser drag checks passed on desktop and mobile after adding fixed-position
  look-around controls: screenshots changed after simulated drags and no page
  errors were reported.
- Browser checks passed after adding observer-rooted scale cues and lowering
  the initial gaze to include more projected ground/horizon context.
- `npm run test:ui:flat` passed after replacing the tiny star fixture with the
  larger named bright-star subset. Browser checks passed on desktop and mobile,
  and drag still changed the rendered view.
- `npm run test:ui:flat` and `npx polylith build flat` passed after expanding
  the Phase 1 named-star fixture from 73 to 123 records.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  visible high-altitude sphere that later became the formal false-model sun.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  separate solar-day orange sphere animation and sidereal dome-star animation.
- `npm run test:ui:flat` passed after replacing the generic orange reference
  sphere source with `DEFAULT_FLAT_SIMULATION_SUN`, deriving `scene.sun`,
  deriving a visible sun sphere in `scene.objects`, and exposing
  `scene.lighting.sun` as a point-light state from the shared `Sun` class.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving sun
  rendering to the first-class `scene.sun` path and adding tests that tie
  rendered radius, observer distance, apparent angular size, and point-light
  state together.
- `npm run test:ui:flat` passed after adding regression coverage for
  configurable false-sun latitude, elevation, and radius.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding
  ambient `types.d.ts` contracts and JSDoc coverage for the newly added
  atmosphere, sun, math helper, flat-simulation scene-model, and sun-rendering
  code.
- `npm run test:ui:flat` and `npx polylith build flat` passed after removing
  the old `AltitudeHaze` shader shell and replacing the legacy haze scene
  settings with the shared-atmosphere placeholder.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding
  the runtime animated-sun resolver and focused specs for disabled sun
  handling, zero-time identity, quarter-cycle rotation, updated light/apparent
  fields, observer inference, and non-mutation.
- `npm run test:ui:flat` and `npx polylith build flat` passed after changing
  `SunBody` to use `resolveAnimatedSun()` for its current position instead of
  its own rotating group animation.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding red
  constellation overlays and the missing Little Dipper/Southern Cross fixture
  stars.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  altitude-sensitive haze approximation.
- `npm run test:ui:flat` and `npx polylith build flat` passed after setting
  the low-altitude haze saturation distance to roughly 300 miles.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  generated Earth projection texture to the base disc.
- `npm run test:ui:flat` and `npx polylith build flat` passed after toning down
  the generated texture and making distant base-disc detail fade into haze.
- `npm run test:ui:flat` and `npx polylith build flat` passed after disabling
  haze and moving the camera below Polaris for floor inspection.
- `npm run test:ui:flat` and `npx polylith build flat` passed after widening
  the orthographic inspection view and increasing temporary map contrast.
- `npm run test:ui:flat` and `npx polylith build flat` passed after fixing the
  floor-inspection camera setup and the base-disc haze toggle.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving the
  temporary floor-inspection camera below the dome star layer.
- `npm run test:ui:flat` and `npx polylith build flat` passed after replacing
  the base circle mesh with a shader-clipped plane.
- `npm run test:ui:flat` and `npx polylith build flat` passed after switching
  the temporary floor-inspection camera back to perspective mode below the
  dome/star layer.
- `npm run test:ui:flat` and `npx polylith build flat` passed after separating
  floor rendering from atmosphere composition and simplifying the Earth floor
  material.
- `npm run test:ui:flat` and `npx polylith build flat` passed after restoring
  the default San Jose observer camera.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding
  temporary floor texture calibration marks.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving the
  false geometry from toy scene units to kilometer scale. Desktop and mobile
  Puppeteer checks stayed nonblank, error-free, and responsive to drag.
- Desktop and mobile Puppeteer checks passed after swapping the dome guide
  lines to 10-degree latitude rings.
- Desktop and mobile Puppeteer checks passed after enabling perspective size
  attenuation for dome-embedded star points.
- Desktop and mobile Puppeteer checks passed after reducing star world size and
  replacing latitude line segments with physical guide rings.
- `npm run test:ui:flat`, `npx polylith build flat`, and desktop/mobile
  Puppeteer checks passed after correcting the dome lift to use hemisphere
  polar angle.
- `npm run test:ui:flat`, `npm run build`, and `git diff --check` passed after
  changing dome guide rings from manually sized torus meshes to sampled
  celestial latitude/declination parallels projected through the same
  projection chain as stars.
- The first attempted surface-balance correction used a solid-only compositor
  scale and unlit red mountain markers; that was rejected as an unphysical
  display adjustment. The corrected direction is to keep the generic
  `sceneColor * transmittance + inScatteredLight` composition equation and tune
  real-world-facing inputs instead: local surface albedo and aerosol/Mie haze.
- `npm run test:ui:flat`, `npm run build`, and `git diff --check` passed after
  replacing the old random-looking synthetic mountain field with the
  deterministic 21-marker spiral calibration rig. The captured fixed daytime
  baseline
  [phase-5-physical-surface-skylight-spiral-mountains](plans/retired/baselines/daytime-atmosphere/phase-5-physical-surface-skylight-spiral-mountains/README.md)
  recorded upper sky `[61, 131, 255]`, center sky `[84, 175, 255]`, horizon
  `[115, 231, 255]`, mountain band `[161, 230, 245]`, local floor
  `[86, 85, 38]`, and star probes `[82, 172, 255]`.
- Follow-up near-field marker verification: `npm run test:ui:flat`,
  `git diff --check`, and
  `npm run capture:flat-atmosphere -- --label phase-5-physical-surface-skylight-spiral-mountains-stray-half-mile`
  passed after adding the explicit `0.5 mile` stray mountain. The capture
  samples stayed stable: upper sky `[61, 131, 255]`, center sky
  `[84, 175, 255]`, horizon `[115, 231, 255]`, mountain band
  `[161, 230, 245]`, local floor `[86, 85, 38]`, and star probes
  `[82, 172, 255]`.
- Follow-up offset verification: `npm run test:ui:flat`, `git diff --check`,
  and
  `npm run capture:flat-atmosphere -- --label phase-5-physical-surface-skylight-spiral-mountains-stray-half-mile-offset`
  passed after moving the half-mile stray marker to `22.5 degrees` bearing so
  it is not collinear with the `1 mile` north spiral marker. Capture samples
  stayed stable.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) now records the idealized
  single-scattering radiance equation and follow-up simplifications that derive
  lower-level shader values from physical quantities: aerosol optical depth,
  single-scattering albedo, Angstrom exponent, air mass, average-density view
  transmittance, diffuse sky irradiance ratio, and fixed Earth Rayleigh
  coefficients. It also includes an explicit simplified renderer calculation:
  derive Mie extinction/scattering/absorption from AOD and albedo, approximate
  sun transmittance from vertical optical depth and air mass, then compute a
  midpoint or short camera-ray-march approximation for surface and sky pixels.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) now also records the magic-number
  audit and mitigation direction for the active daylight controls:
  `solarIrradianceScale` is an interim source-radiance calibration bridge,
  `threeLightUnitScale` is a Three.js unit bridge, `skyDiffuseIrradianceScale`
  is a temporary diffuse-sky irradiance approximation, `starExposure` should
  move toward apparent-magnitude/luminance inputs, `constellationOverlayExposure`
  is a UI overlay brightness control, and the flat-slab horizon/background
  factors are renderer path-length approximations until the false-world
  geometry has a better physical contract.
- The `solarIrradianceScale` note now includes the idealized local-sun
  replacement calculation: user-configurable sun position, radius, source model,
  luminosity or blackbody temperature, target irradiance at a reference
  distance, brightness scale, geometric inverse-square falloff, sun-to-sample
  transmittance, scattering source radiance, and surface-energy delivery. The
  intended direction is to make `solarIrradianceScale` a derived renderer value
  or remove it once physical source and display-exposure inputs are separated.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  shared `Atmosphere` module and tests for the standard Earth profile, real
  density falloff, flat/spherical altitude frames, low-altitude optical-depth
  integration, spherical atmosphere exit distance, and plain shader uniforms.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  shared `Sun` class and extending `Atmosphere` into a light-aware class
  implementation with Rayleigh/Mie phase functions, sample-to-light
  transmittance, flat-slab shadow checks, single-scattering integration, and
  shader uniforms that include sun state.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving
  shared stateless math utilities into `src/flat/shared/math-primitives.js` and
  moving Atmosphere-specific helper behavior into static `Atmosphere` methods.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving
  exported constants out of class implementation files into `consts.js` modules
  and updating consumers to import defaults/settings from those constant
  owners.
- `npm run test:ui:flat` and `npx polylith build flat` passed after changing
  the default observer camera to the elevated floor-context view. A desktop
  canvas screenshot confirmed the floor now shows readable ocean/land/graticule
  map detail instead of a uniform green surface.
- `npm run test:ui:flat` and `npx polylith build flat` passed after replacing
  the hand-oriented polar JPG with a downsampled Natural Earth II
  equirectangular raster and inverse-projection shader sampling. Browser
  screenshots confirmed the first Natural Earth pass had the latitude axis
  inverted, showing Antarctica at the projection center; after flipping the
  sampled equirectangular `v` coordinate, the floor center and observer view
  showed the Arctic/North America side as expected.
- `npm run test:ui:flat` and `npx polylith build flat` passed after correcting
  the floor shader's longitude axis under the prior world-z convention. The
  inverse
  equirectangular lookup now maps San Jose back to roughly `-121.8863Â°`
  longitude instead of the Atlantic-side `-58Â°` result from the previous
  sign convention. A desktop browser screenshot confirmed the observer view is
  now on the North America/Pacific-coast side.

- `npm run test:ui:flat` and `npx polylith build flat` passed after fixing the
  projection-to-world handedness. The scene model now includes a regression
  check that Florida lies on the camera-right/east side of San Jose when the
  observer looks north toward the projection center. A desktop browser
  screenshot for `/flat/flat-simulation` showed a nonblank render with North
  America/Arctic floor context after the shader/world-axis correction.
- Historical verification: `npm run test:ui:flat`, `npx polylith build flat`,
  and `git diff --check` passed after setting the default observer elevation to
  `100 ft` and adding the earlier deterministic 200-rectangle synthetic
  mountain simulation. The current mountain calibration rig is the later
  half-mile stray marker plus 21-marker spiral described above.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after adding the first `FlatAtmosphere` light-aware shell shader and
  enabling the shared atmosphere pass by default. A Puppeteer smoke check was
  attempted afterward, but `http://localhost:3000/flat/flat-simulation`
  refused the connection because the local server was not running.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after adding the first `FlatAtmosphereComposer` depth-aware
  composition pass. A local server probe still failed because
  `http://localhost:3000/flat/flat-simulation` was not running.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after stabilizing the first composer response to a live black-sky,
  rectangle-face flashing, and ground-popping report. The shader now clamps
  background/grazing view rays to a bounded atmosphere distance instead of the
  camera far plane, uses a higher-precision depth texture, restores the prior
  render target after the offscreen solid render, and avoids direct depth
  texture image-size mutation on resize.
- `npm run test:ui:flat` and `npx polylith build flat` passed after a second
  compositor stabilization pass. Background/no-depth pixels now receive a small
  sun-lift-aware sky airlight floor so the sky no longer depends entirely on
  the under-tuned first scattering result. The giant Earth floor now renders
  color-only in the solid pass, while local mountains/objects remain the
  depth-bearing geometry, to avoid horizon-scale floor depth instability while
  turning from a 100 ft observer elevation.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding a
  temporary observer-local floor patch. The patch is a stable 320 km plane
  centered below the observer at ground `y = 0`, drawn before mountains, and
  depth-bearing so the compositor treats it as solid ground instead of
  background sky. The projection-sized Earth disc remains unsuitable as
  depth-bearing near-field floor geometry.
- `npm run test:ui:flat` and `npx polylith build flat` passed after replacing
  the temporary distance-blend solid haze with the first
  `Atmosphere.sampleSegment()`-equivalent compositor path. Solid pixels now use
  integrated optical depth for transmittance and add tinted segment airlight
  from lost average transmittance.
- `npm run test:ui:flat` and `npx polylith build flat` passed after replacing
  the bright false-sky no-depth fallback with the normal sun-scattering
  integration path. Background/no-depth pixels now integrate optical depth and
  single scattering to atmosphere exit like other camera rays; only a tiny
  emergency sky floor remains to prevent total black if the scattering result
  underflows.
- The attempted `scene.atmosphere.rendering.skyExposure` display multiplier was
  backed out. The current black physically integrated sky should be
  investigated as missing or blocked in-scattered sunlight rather than solved
  by making the final background contribution brighter after the fact. The
  leading suspects are flat-ground shadow tests, false point-sun brightness and
  distance assumptions, mismatch between visible and shader sun state,
  background ray length, over-strong sample-to-light attenuation, uncalibrated
  physical coefficients against false-world scale, and color/tone handling of
  low nonzero scattering values.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after making local false-sun brightness explicit with
  `FALSE_SUN_LIGHT_INTENSITY = 64`. The false sun remains a nearby point light
  so local-sun implications remain visible, while its source strength is high
  enough to test whether the atmosphere can scatter it noticeably. This is a
  scene/light assumption, not a compositor exposure multiplier.
- `FlatAtmosphereComposer` now has temporary background-pixel debug rendering.
  `diagnostics` produced a uniformly red sky, `unattenuated-scattering`
  still produced black, `scattering-inputs` produced a uniformly yellow sky,
  and `view-path` also produced uniform yellow. Yellow in `view-path` means
  the background ray reaches its max sky distance and view transmittance stays
  high while optical depth remains visually low. `scattering-source` then
  produced uniform black, meaning the raw source term is not visible at the
  current probe scale. `scattering-factors` produced pink, which confirms the
  shader receives sun intensity, sun color, and scattering coefficient
  uniforms. `scattering-source` stayed black even at diagnostic scale `5000`,
  so `scattering-angles` was added. It produced yellow, confirming valid
  light/view angle samples and active Rayleigh phase. The composer now uses
  finite-safe source accumulation and safe point-sun normalization so one
  invalid sample cannot poison the source or real scattering sums.
  `scattering-source` still stayed black. The first `scattering-components`
  probe also stayed black because it only accumulated component values after
  the final scattering product was already valid. It now reports density,
  phase, and coefficient-light strength from the valid angle samples; that
  produced magenta, confirming density and coefficient-light are visible while
  the source accumulation still does not show. The default is now
  `scattering-sanity`, which shows final valid scattering sample ratio in red,
  reconstructed scalar source in green, and accumulated source vector strength
  in blue. After `scattering-sanity` produced black, the compositor stopped
  using an all-or-nothing finite-scattering guard and now sanitizes the
  scattering vector per channel before accumulating it. `scattering-sanity`
  then produced red, showing the samples are valid while the source magnitude
  remains below the visible debug range. A single global source gain of `5000`
  made the solid ground white while the sky stayed black, proving that solid
  pixels and no-depth sky pixels need separate diagnosis. The composer now
  exposes `solidScatteringSourceGain`, `skyScatteringSourceGain`, and
  `skyLightTransmittanceFloor`. Defaults are solid gain `1`, sky gain `5000`,
  and sky light-transmittance floor `0.05`, with `backgroundDebugMode: 'none'`
  so the real no-depth scattering path is visible without bleaching the
  surface.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) now includes the idealized
  per-pixel single-scattering algorithm to rebuild toward: depth-aware camera
  rays, camera-to-sample transmittance, sample-to-sun transmittance,
  Rayleigh/Mie phase terms, and final composition as
  `sceneColor * sceneTransmittance + inScatteredLight` for solid pixels or
  `inScatteredLight` for sky pixels. The note also records that the nested
  sample-to-light march is the expensive reference path and should be
  approximated in staged real-time passes.
- [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md) now also includes the reset
  compositor rebuild plan. The plan keeps the current composer plumbing,
  animated sun resolver, and uniform adapter, but replaces the fragment shader
  core in stages: stripped composer shell, optical depth only, unshadowed
  single scattering, simple light visibility, approximate sample-to-sun
  transmittance, performance scaling, and minimal debug modes.
- Reset compositor step 1 is implemented. `FlatAtmosphereComposer` is back to
  a pass-through composer shell that still renders the solid scene through the
  offscreen color/depth target, reconstructs world position and camera-ray
  length, keeps animated sun uniform updates alive, and supports only a
  minimal debug surface. The nested background diagnostic ladder, emergency
  sky fallback, and active solid/sky gain/transmittance-floor knobs have been
  removed from the composer shader and default atmosphere rendering contract.
- Reset step 1 verification: `npx polylith build flat`, `npm run test:ui:flat`,
  and `git diff --check` passed. A stale unused shader helper initially caused
  undeclared atmosphere coefficient uniforms in the fragment shader; those
  helpers were removed so the pass-through compositor shell no longer
  references optical-depth/scattering uniforms before reset step 2 adds them
  back deliberately.
- Reset compositor step 2 is implemented. The composer now integrates
	optical-depth-only camera-ray extinction with 8 view samples and applies
	`sceneColor * sceneTransmittance` for both solid-depth and no-depth pixels.
	Empty sky remains dark because no in-scattered light exists yet. This is a
	generic composition rule, not a star-specific exception. Stars,
	constellations, and the visible sun body remain ordinary 3D scene objects in
	the composer; stellar light-source behavior will be revisited after the
	sun-driven scattering path is working. It adds `debugMode: 'optical-depth'`,
	which shows average optical depth in red, average transmittance in green,
	and solid-depth mask in blue.
	`DEFAULT_ATMOSPHERE.rendering.status` is now
	`depth-aware-composer-optical-depth`.
- Reset step 2 verification: `npx polylith build flat`, `npm run test:ui:flat`,
	and `git diff --check` passed after adding optical-depth-only attenuation.
- Reset step 2 background-radiance fix verification: `npx polylith build flat`,
  `npm run test:ui:flat`, and `git diff --check` passed after changing no-depth
  pixels from forced black to `sceneColor * sceneTransmittance`.
- Reset compositor step 3 is implemented. At that point, the composer
	accumulated unshadowed Rayleigh/Mie single scattering along the camera ray
	from the resolved animated false sun and composited all pixels as
	`sceneColor * sceneTransmittance + inScatteredLight`. The shader uses the
	existing sun uniforms (`sunKindId`, direction/position, color, and
	intensity), adds `atmosphereMieAnisotropy`, and exposes
	`debugMode: 'scattering'` to view raw accumulated in-scattered light. Rays
	now integrate to the nearer of scene depth and the atmosphere boundary, so
	ordinary objects outside the air volume do not create extra atmospheric path
	length through vacuum. `DEFAULT_ATMOSPHERE.rendering.status` is now
	`depth-aware-composer-unshadowed-scattering`.
- Reset step 3 verification: `npx polylith build flat`, `npm run test:ui:flat`,
	and `git diff --check` passed after adding unshadowed single scattering.
- Reset step 3 browser check: `https://localhost/flat/flat-simulation`
	loaded over the local self-signed HTTPS server, the canvas mounted at
	`1192x643`, and no WebGL/shader compile errors were reported. Console output
	still included the existing invalid `user-scalable=false` viewport warning
	and one non-shader `404`.
- Reset step 3 black-sky follow-up is fixed. Browser pixel sampling showed
  no-depth sky pixels were correctly classified as background, but exact
  far-plane reconstruction collapsed their ray direction downward with the
  current `near = 0.0001` / `far = 50000` camera range. Background rays now
  reconstruct direction from finite depth `0.999` before integrating to
  atmosphere exit. Final sampled sky pixels are now nonblack:
  top-center `[100, 185, 255]`, center `[198, 255, 255]`, and horizon
  `[255, 255, 255]`; the horizon is visibly saturated and should be tuned
  after the next correctness pass.
- `phase-angle` debug mode is available but no longer active by default. It
  visualizes the light/view phase term before the next correctness step: red
  is `cosTheta` remapped to `0..1`, green is scaled Rayleigh phase, and blue
  is scaled Mie forward-scattering phase.
- `phase-angle` browser verification passed on the local self-signed HTTPS
  page. Pixel samples taken ten seconds apart changed with the animated sun
  uniform: top-center moved from `[243, 222, 26]` to `[203, 164, 4]`, center
  from `[252, 237, 89]` to `[185, 146, 2]`, and upper-right from
  `[211, 174, 5]` to `[131, 122, 1]`. This confirms the phase diagnostic is
  using the moving sun/light state rather than a frozen screen-space pattern.
  The default `debugMode` is back to `none` so the scene renders the actual
  single-scattering composition path.
- Reset compositor step 4 is implemented. Each atmosphere sample now checks
  whether the sample-to-sun ray intersects the flat ground plane before
  reaching the point sun, or before leaving the atmosphere for a directional
  sun. Blocked samples contribute no direct sun scattering. With the current
  false-model point sun staying above the ground plane, this gate is expected
  to be mostly inert: a straight segment from air above the plane to a sun
  above the plane does not cross the plane. The step is still useful as the
  structural visibility hook for later below-horizon/directional cases and
  terrain/occluder work, but it should not be expected to create day/night
  darkening in the current setup.
  `DEFAULT_ATMOSPHERE.rendering.status` is now
  `depth-aware-composer-light-visibility`.
- Reset step 4 verification: `npx polylith build flat` and
  `npm run test:ui:flat` passed. Browser verification on
  `https://localhost/flat/flat-simulation` reported no WebGL/shader compile
  errors, with sampled colors still nonblack in the active composition path:
  top-center `[115, 211, 255]`, center `[248, 255, 255]`, horizon
  `[255, 255, 255]`, and ground `[195, 186, 128]`.
- Local false-sun radiance calibration is now explicit. The composer resolves
  source radiance per atmosphere sample with `sunRadianceAt()`: directional
  atmosphere suns use `sunColor * solarIrradianceScale`, while point suns can
  use inverse-square distance falloff against the configured false-sun radiance
  reference distance. Phase 1 superseded the original flat fields with
  `falseSunRadiance.model: 'point-inverse-square-reference'`,
  `falseSunRadiance.referenceDistanceKm: 4800`, and
  `falseSunRadiance.distanceFalloff: true`; the rendering status is now
  `depth-aware-composer-split-atmosphere-sun`.
- Local-sun radiance verification: `npx polylith build flat` and
  `npm run test:ui:flat` passed. Browser verification on the local HTTPS page
  reported no shader/WebGL compile errors. Samples ten seconds apart showed
  the sky brightening as the animated sun/distance term changed: top-center
  `[14, 27, 38]` to `[28, 52, 76]`, center `[36, 61, 78]` to
  `[55, 95, 123]`, and horizon `[100, 135, 113]` to `[144, 204, 175]`;
  the sampled ground stayed `[193, 183, 123]`.
- Solid scene lighting now uses the same local-sun radiance assumption. The
  solid render subtree includes an animated `SunSceneLight` point light whose
  intensity uses the same point inverse-square reference-distance model, scaled
  into Three.js light units by `threeLightUnitScale: 0.04`.
  Synthetic mountains and generic solid objects use Lambert shading so the sun
  can brighten their albedo. Stars, constellation lines, rings, and the
  visible sun body remain unlit/basic evidence overlays.
- The global projected Earth map and the local observer floor now use explicit
  sun-lit floor shaders instead of self-lit/basic texture output or generic
  Lambert floor lighting. Both floors treat their color/texture as albedo and
  compute per-fragment direct light from the resolved animated sun:
  Lambert/up-normal response, point-sun inverse-square falloff against the
  configured reference distance, sun color/intensity, and
  `threeLightUnitScale`. This is the intended path for the future
  bird's-eye map view: the map can be dark except where the false sun lights
  it, and the local San Jose floor follows the same rule.
- The local observer floor now uses a darker scrub/ground albedo
  `[0.15, 0.18, 0.11]` instead of the earlier overly bright yellow-green
  placeholder. The clear-day atmosphere preset now derives aerosol/Mie
  extinction and scattering from `aerosolOpticalDepth550nm: 0.08`,
  `aerosolSingleScatteringAlbedo: 0.95`, and
  `aerosolAngstromExponent: 1.3` so distant solid surfaces retain more of
  their albedo before terrain replaces the synthetic rectangles. Lit solid
  materials also receive a first-order diffuse skylight approximation through
  `skyDiffuseIrradianceScale: 0.35`, representing broad sky irradiance on
  faces that are not directly aimed at the finite false sun.
- The floor end-state is documented as a physically participating surface:
  map/terrain albedo should react to scene light sources first, then pass
  through the depth-aware atmosphere composer so it fades with distance through
  camera-to-floor transmittance and camera-ray in-scattering. Bird's-eye and
  local views should share that same lighting and atmosphere rule.
- The normal observer simulation path no longer includes generic ambient fill
  light. The sun is the only direct local light source for
  floor/mountain/object materials, and `skyDiffuseIrradianceScale: 0.35`
  approximates broad diffuse skylight.
  The global projected Earth-disc shader is rendered behind the local observer
  floor so it no longer overlays the local lit floor in the eye-height view.
- Solid-light verification: `npx polylith build flat`, `npm run test:ui:flat`,
  and `git diff --check` passed. Browser verification reported no shader/WebGL
  errors. Ten-second samples showed the sky, local ground, and mountain band
  brightening together as the sun approached: ground `[2, 2, 1]` to
  `[8, 11, 3]`, mountain band `[80, 116, 108]` to `[119, 178, 169]`, and
  sky-center `[36, 61, 78]` to `[55, 95, 123]`.
- `SunSceneLight` now uses Three.js inverse-square point-light decay
  (`decay={2}`) instead of uniform no-decay lighting. This makes the solid
  scene light truly local to the finite false sun, but the current scale is
  now extremely dim at scene distances: browser samples showed ground staying
  near black (`[0, 0, 1]` to `[0, 1, 1]`) and the sampled mountain band mostly
  changing through atmosphere/airlight (`[33, 47, 57]` to `[33, 60, 83]`).
  This confirms the no-decay path was a major reason far-sun objects were too
  visible, and the next calibration should choose whether to raise
  `threeLightUnitScale`, change the light-unit bridge, or avoid double
  distance falloff between the JS light and shader radiance model.
- Background/no-depth sky no longer uses the same long flat-slab horizon
  distance as solid-depth pixels. Solid pixels still integrate to the
  reconstructed object/floor depth, but empty sky pixels are capped by
  `backgroundAtmosphereViewDistanceKm` (`100 km` by default) so the background
  color is not dominated by an artificial near-horizontal path through
  hundreds of kilometers of low-altitude air. Near-horizontal empty-sky rays
  additionally taper to `flatSlabHorizonViewDistanceFactor: 0.25` of that cap,
  so the flat-slab horizon does not become a fake glow band. Browser
  verification showed the former yellow-white horizon band reduced below
  mid-sky brightness and shifting blueward instead of yellow: horizon
  `[31, 44, 54]` to `[31, 55, 77]`, with no shader/WebGL errors.
- Approximate sample-to-sun transmittance is implemented in the compositor.
  The active default is `sampleToSunTransmittanceModel: 'air-mass'`, which
  estimates vertical optical depth above each atmosphere sample and scales it
  by the sample-to-sun air mass. The earlier short march remains available as
  `sampleToSunTransmittanceModel: 'light-march'` with
  `sampleToSunTransmittanceSteps` (`4` by default) for comparison. Browser
  verification of the earlier light-march pass reported no shader/WebGL
  errors; samples showed the sky slightly darker and more filtered while
  preserving sun-motion response: sky-center `[31, 43, 43]` to `[37, 63, 76]`,
  horizon `[28, 36, 33]` to `[29, 48, 56]`, and ground near black.
- Reality-aligned atmosphere Phase 1 is implemented, with a later correction
  to the light-source ownership. The scene model exposes
  `scene.lighting.atmosphereSun` as its own renderer-facing light state, but
  that state is now derived from the same resolved `scene.sun` object as the
  rendered sun body and `scene.lighting.sun`.
  Renderer-only controls have been renamed to
  `falseSunRadiance.referenceDistanceKm`,
  `falseSunRadiance.distanceFalloff`, `threeLightUnitScale`,
  `backgroundAtmosphereViewDistanceKm`, and
  `flatSlabHorizonViewDistanceFactor`. Verification:
  `npm run test:ui:flat` passed.
- Added `scripts/flat/capture-atmosphere-baseline.js` and
  `npm run capture:flat-atmosphere` to capture repeatable daytime atmosphere
  screenshots and named RGB samples through Puppeteer plus Sharp. The Phase 1
  baseline is saved under
  [phase-1 baseline](plans/retired/baselines/daytime-atmosphere/phase-1/README.md), using
  `https://localhost/flat/flat-simulation`, viewport `1192x643`, and canvas
  `1138x487`. The captured samples had no console/page errors and showed the
  current sky is still near-black/dark-blue: upper sky `[2, 4, 8]`, center sky
  `[2, 4, 8]`, horizon `[1, 3, 6]`, mountain band `[84, 85, 48]`, and local
  floor `[255, 254, 110]`.
- Reality-aligned atmosphere Phase 2 is implemented. `src/flat/shared/consts.js`
  now exports `CLEAR_DAY_EARTH_ATMOSPHERE` with id `earth-clear-day`,
  Rayleigh scale height `8.0 km`, aerosol scale height `1.2 km`, the standard
  Earth Rayleigh beta coefficients, aerosol optical depth `0.08` at `550 nm`,
  aerosol single-scattering albedo `0.95`, Angstrom exponent `1.3`, and
  `mieAnisotropy: 0.8`. The generic `STANDARD_EARTH_ATMOSPHERE` remains as
  the hazier `earth-standard` profile with aerosol optical depth `0.12` at
  `550 nm`; the flat-simulation default now opts into the clear-day profile.
  Phase 2
  capture output is saved under
  [phase-2-clear-day baseline](plans/retired/baselines/daytime-atmosphere/phase-2-clear-day/README.md).
  Compared with Phase 1, the sky stayed very dark rather than becoming a
  believable daytime sky: upper sky `[1, 4, 7]`, center sky `[2, 4, 7]`,
  horizon `[1, 3, 6]`, mountain band `[84, 86, 49]`, and local floor
  `[255, 254, 110]`. This confirms the next pass should tune named
  light/radiance/exposure controls instead of treating Rayleigh coefficients
  as color grading knobs. Verification: `npm run test:ui:flat`,
  `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-2-clear-day` passed.
- Solar irradiance source calibration is implemented. `src/flat/shared/Sun.js`
  now carries `solarIrradianceScale` through config, state, and shader uniform
  output, and both the CPU atmosphere sampler and `FlatAtmosphereComposer`
  use `sunColor * solarIrradianceScale` for atmosphere source radiance instead
  of reusing generic `sunIntensity`. The flat-simulation sun body's
  atmosphere facet keeps `intensity: 1` and initially used
  `solarIrradianceScale: 50` as the first daylight calibration value. The
  [phase-2-solar-irradiance-50 baseline](plans/retired/baselines/daytime-atmosphere/phase-2-solar-irradiance-50/README.md)
  captured a much bluer sky: upper sky `[72, 154, 255]`, center sky
  `[81, 169, 255]`, horizon `[57, 119, 224]`, mountain band
  `[111, 142, 186]`, local floor `[255, 255, 114]`, and star probes
  `[80, 169, 255]`. This confirms the next pass can focus on whether actual
  star/constellation materials need named exposure tuning rather than trying
  to brighten the final sky with a display multiplier.
- Daytime star/external-source visibility Phase 3 is implemented. The
  `FlatSkyScene` star renderer now scales point radiance by
  `scene.atmosphere.rendering.starExposure`, and constellation guide lines use
  `scene.atmosphere.rendering.constellationOverlayExposure` for overlay
  opacity. The defaults are `0.02` and `0.04`, respectively. The
  [phase-3-star-exposure baseline](plans/retired/baselines/daytime-atmosphere/phase-3-star-exposure/README.md)
  kept the same daylight sky samples as the solar-irradiance capture while
  visual inspection showed the previously obvious white star points and red
  constellation overlay no longer apparent in the fixed San Jose daytime
  screenshot. Verification: `npm run test:ui:flat`, `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-3-star-exposure` passed.
- Flat-slab background distance Phase 4 is implemented. The default renderer
  controls are now `backgroundAtmosphereViewDistanceKm: 100` and
  `flatSlabHorizonViewDistanceFactor: 0.25`, with matching composer fallback
  constants if a scene override omits those fields. The
  [phase-4-background-distance-100-horizon-025 baseline](plans/retired/baselines/daytime-atmosphere/phase-4-background-distance-100-horizon-025/README.md)
  kept upper sky blue at `[72, 154, 255]`, lifted center sky to
  `[91, 190, 255]`, lifted the horizon to `[108, 215, 255]`, and did not
  visually clip the horizon to white or yellow. The mountain band became much
  more airlit at `[156, 227, 254]`, so future terrain work should revisit
  solid-surface exposure/depth cues with real geometry. Verification:
  `npm run test:ui:flat`, `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-4-background-distance-100-horizon-025`
  passed.
- Reality-aligned atmosphere Phase 5 is implemented, then corrected by linking
  the atmosphere source to the rendered false sun as the active contract. The
  [phase-5-visible-false-sun-atmosphere baseline](plans/retired/baselines/daytime-atmosphere/phase-5-visible-false-sun-atmosphere/README.md)
  remains as historical comparison evidence: it captured upper sky
  `[53, 95, 131]`, center sky `[73, 126, 162]`, horizon
  `[100, 167, 196]`, mountain band `[154, 202, 197]`, local floor
  `[255, 255, 112]`, and star probes `[71, 124, 161]`. The follow-up
  correction removes the controller query mode and derives
  `scene.lighting.atmosphereSun` from the resolved `scene.sun` via
  `resolveAnimatedAtmosphereSun()`. `FlatAtmosphereComposer` now updates
  atmosphere uniforms from that same resolver each animation-loop frame, so
  the rendered sun body, solid-scene point light, and atmospheric point source
  stay synchronized. The active linked-sun capture is saved at
  [phase-5-linked-visible-sun-atmosphere baseline](plans/retired/baselines/daytime-atmosphere/phase-5-linked-visible-sun-atmosphere/README.md):
  upper sky `[53, 114, 226]`, center sky `[73, 151, 255]`, horizon
  `[100, 199, 255]`, mountain band `[154, 223, 253]`, local floor
  `[255, 255, 114]`, and star probes `[71, 148, 255]`. Verification:
  `npm run test:ui:flat`, `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-5-linked-visible-sun-atmosphere`
  passed.
- Linked-sun radiance sweep is implemented. Captures for
  `solarIrradianceScale` `58`, `60`, and `65` showed that `65` clipped the
  horizon/mountain band to cyan-white and `60` remained close to clipping.
  The selected linked-sun default is `58`, captured at
  [phase-5-linked-visible-sun-irradiance-58 baseline](plans/retired/baselines/daytime-atmosphere/phase-5-linked-visible-sun-irradiance-58/README.md):
  upper sky `[61, 132, 255]`, center sky `[84, 175, 255]`, horizon
  `[116, 231, 255]`, mountain band `[165, 244, 255]`, local floor
  `[255, 255, 114]`, and star probes `[82, 172, 255]`. It is brighter than
  the linked `50` baseline while preserving the one-object sun contract and
  keeping daytime stars hidden.
- The default camera is back at the San Jose observer/root view
  (`scene.camera` is `null`, so `ObserverLookCamera` uses the projected
  observer position and look controls). `DEFAULT_NORTH_POLE_UNDER_DOME_CAMERA`
  remains available as a named inspection preset for the bird's-eye map view,
  but it is not active by default.
- San Jose observer camera verification: `npm run test:ui:flat`,
  `npx polylith build flat`, and `git diff --check` passed.
- Sun-lit floor shader verification: `npx polylith build flat`,
  `npm run test:ui:flat`, and `git diff --check` passed. Browser verification
  on the local HTTPS page reported a nonblank canvas and no shader/WebGL
  errors.
- The solar/sidereal scene rotation speed is now quartered from the previous
	loop: solar-day display duration is `40 seconds`, and the derived sidereal
	display duration is about `39.8908 seconds`.
- Flat now registers an app-level `animation-loop` Polylith service. It owns
  playback mode, cycle timing, a ready-time interval, simulated elapsed time, and
  framework-neutral `frame` events with named `solarDayRad` and `siderealDayRad`
  rotation angles. The solar-day display duration controls the real-to-simulated
  speed; the sidereal cycle uses the same simulated timeline with its shorter
  day length. The root flat app matches the Music Notebook provider pattern: it
  subscribes app services from the registry, builds a `FlatProvider` context
  value, and lets React presentation code read shared services through
  `FlatContext`. Sun body position, solid-scene light, floor light uniforms,
  atmosphere uniforms, star rotation, constellation rotation, and generic
  latitude-ring animation now consume the same service frame.
  `FlatSimulationSceneModel` currently publishes fixed playback at the
  closest-sun-to-San-Jose solar angle for stable daytime sky-color calibration.
  Verification: `npm run test:ui:flat` and `npm run build` passed.

Next:

- Continue
  [Spherical Sun Atmosphere Plan](plans/retired/spherical-sun-atmosphere-plan.md) with
  Phase 4.5 or 4.6. Phase 4.4 has put globe surface albedo and marker lighting
  on the radiometric path, removing the main mixed-unit solid-surface
  composition issue. The remaining visible problems are that the globe sky is
  still muted blue-gray rather than clear daylight blue, and star brightness
  still lacks a named photometric radiance bridge even though the current
  daytime capture no longer shows bright star pixels at the probe points.
- Keep
  [Reality-Aligned Daytime Atmosphere Plan](plans/retired/reality-aligned-daytime-atmosphere-plan.md)
  as the flat-model comparison context.
- Phase 0: mostly complete. Fixed San Jose daytime browser baseline samples
  are captured in
  [phase-1 baseline](plans/retired/baselines/daytime-atmosphere/phase-1/README.md);
  remaining Phase 0 work is only to record any extra profile/star-material
  values needed during Phase 2 comparison.
- Phase 1: complete, with ownership corrected later. Visible false-sun
  evidence, solid-scene light, and atmosphere scattering are distinct
  renderer-facing facets, but they are linked to the same `scene.sun` object.
- Phase 2: complete. The Earth-like clear-day atmosphere preset is active for
  flat simulation, but browser capture shows it does not by itself brighten
  the fixed daytime sky enough.
- Phase 2.5: complete. `solarIrradianceScale` now drives the atmosphere source
  and the fixed daytime capture reads as blue daylight, with star-probe pixels
  resolving to sky blue. The linked-sun default has since been tuned to `58`.
- Phase 3: complete. Actual daytime star/constellation artifacts are hidden by
  named `starExposure` and `constellationOverlayExposure` renderer controls
  while preserving the generic atmosphere composition rule.
- Phase 4: complete. Background/no-depth sky uses a `100 km` distance cap and
  a `0.25` flat-slab horizon factor, producing a brighter cyan horizon without
  white/yellow clipping.
- Phase 5: complete with correction. Point false-sun scattering was compared
  with the old directional atmosphere-sun default; the active contract now
  links atmosphere scattering to the rendered false sun instead of keeping a
  separate directional source or URL inspection mode.
- After sky calibration, return to coarse real local terrain for San Jose:
  Mapzen Terrain Tiles Terrarium PNGs, generated/cached local height-grid
  asset, observer-relative ENU kilometers, and one depth-bearing terrain mesh
  through the current sun/atmosphere composer.
- Add package-shaped projection/math helpers outside React and Three.js.
- Add city/observer selection using the SAT city picker as the precedent.
- Add static star data selection and preprocessing.

## POC Scope

- Render the outline of the flat simulation in Three.js.
- Build the POC inside the REMVC/Polylith app structure rather than as
  disposable standalone code.
- Represent the projected Earth plane/disc using an azimuthal equidistant
  projection centered on the north pole.
- Represent the false sky as the underside of a half-sphere dome above that
  projection.
- Defer the standard sky viewer until after the flat-simulation outline is
  understandable.
- Defer the flat apparent-position mode until after the first flat-simulation
  outline is understandable. That later mode should reuse the flat scene
  presentation while using real local azimuth/altitude for celestial-object
  placement relative to the observer.
- Use fixed celestial-object data for the first POC. Ignore planets and the
  moon initially; fold them in later through a separate ephemeris/data-source
  decision.
- Track the first render goal in
  [Flat POC Phase 1 Plan](plans/poc-phase-1-plan.md).

## POC Development Breakdown

Recommended implementation order:

1. Scaffold the `flat` Polylith app.
   - Add `src/flat/index.js`, `src/flat/main`, `src/flat/features/app`,
     `src/flat/features/flat-simulation`, `src/flat/services`,
     `src/flat/models`, `src/flat/assets`, and `src/flat/templates`.
   - Add `builds/flat.json` and include the app in Polylith configuration.
   - Mirror the pipeline app shape: app index starts the registry, `main`
     mounts React, `features/app` owns shell/navigation, and
     `flat-simulation` owns its view workflow.
2. Build the app shell.
   - Keep the first shell minimal: title/header, page region, and one
     registered page for the flat simulation.
   - Add shared `app-pages`, `views`, and `url` services only if the first POC
     needs route/page registration. Otherwise create the structure in a way
     that can grow into those services without changing feature ownership.
3. Prepare static star data.
   - Choose a license-compatible catalog source, probably Hipparcos, Yale
     Bright Star Catalog, or a clearly attributed IAU-named-star subset for the
     first POC.
   - Add a script that converts the source catalog into a small app-facing JSON
     asset with stable fields such as id, display name, right ascension,
     declination, magnitude, color/spectral hint if available, and source id.
   - Apply a magnitude cutoff so the POC renders hundreds or low thousands of
     stars rather than the full catalog.
4. Define false-model geometry helpers.
   - Implement azimuthal equidistant projection helpers for Earth coordinates.
   - Implement celestial coordinate conversion from right ascension/declination
     into the false sky projection.
   - Define how projected celestial coordinates map onto the underside of the
     half-sphere dome.
   - Keep this math outside React and outside Three.js object construction so
     it can be tested separately.
   - Keep the math local if it remains straightforward. If it becomes complex,
     consider a small focused npm module with minimal dependency weight rather
     than a broad astronomy stack.
   - Keep the math package-shaped: framework-free, deterministic, documented,
     and isolated enough that it could later become a reusable package
     published separately.
   - Shape the math API around swappable projection/model choices so the
     renderer can change projections without rewriting scene code.
   - Use `ProjectionModel` as the preferred utility class name. It should own
     math for Earth projection, celestial projection, and sky-surface mapping,
     with Earth and celestial projections independently configurable.
   - Implement `ProjectionModel` as a plain reusable class under
     `src/flat/shared/projection`, not as a Polylith registry-backed model
     service.
   - Root all calculations at a source latitude/longitude, normally the
     selected observer city or manual observer coordinate.
   - Avoid switch statements for supported projections. Projection
     implementations should register/install themselves by role, and
     `ProjectionModel` should resolve the configured projection ids from those
     registries.
5. Build the Three.js scene component.
   - Render an Earth projection disc/plane as context, keep the sky dome as a
     hidden projection surface, and render star points from the observer's
     projected point of view.
   - Include enough ground/horizon context to communicate false-world scale
     from the observer view.
   - Use stable scene sizing and responsive canvas layout.
   - Keep inspection controls observer-rooted: drag should rotate the fixed
     camera rather than orbiting around the model.
6. Connect REMVC boundaries.
   - The flat-simulation controller owns page lifecycle and high-level state.
   - The flat-simulation view service translates controller state into React
     props and callbacks.
   - React owns presentation and forwards user intent to the view service.
   - Static data loading should live in a model/service boundary, not directly
     in the Three.js component.
7. Add focused controls.
   - For the first POC, controls should expose only what helps inspect the
     false model: observer/projected location, time or sidereal offset if
     needed, dome visibility, Earth grid visibility, and star magnitude limit.
   - Use the SAT app's city-picking mechanism as the model for choosing
     observer latitude/longitude.
   - Defer standard sky comparison controls until the standard viewer feature
     exists.
8. Verify.
   - Run syntax checks for non-JSX services/controllers/models.
   - Run the Polylith build for JSX/build registration.
   - Use browser/screenshot checks for the Three.js canvas: nonblank render,
     correctly framed dome/disc, visible star points, and responsive layout.

POC success means the false model is visible, inspectable, and architecturally
placed in the eventual app structure, even if the exact scientific/counterfactual
mapping is still evolving.

## City Picking

Use the SAT app's city selection as the local precedent for observer
latitude/longitude picking.

Current SAT shape:

- `scripts/sat/build-city-index.js` reads the npm `cities.json` package and
  writes a compact generated index to `src/sat/assets/data/cities.json`.
- `builds/sat.json` copies that generated JSON to
  `dist/sat/assets/data/cities.json`.
- `src/sat/main/App.jsx` fetches `assets/data/cities.json`, expands compact
  records into city labels, and implements typeahead plus manual latitude and
  longitude entry.

For `flat`, avoid depending directly on SAT internals. Preferred options:

- promote the city index generation and typeahead/picker presentation into a
  shared location if both apps will keep using it
- or generate/copy a `flat`-owned city index using the same source package and
  algorithm for the first POC, then promote after reuse settles

The `flat` flat-simulation feature should consume a selected observer record
as `{ name, country, admin1, lat, lon }` and let its projection model decide
how that observer maps onto the false Earth/sky geometry.

## Candidate Celestial Data Sources

Initial preference:

- Use a static star catalog snapshot that can be checked into the repo or
  transformed into a generated asset with clear attribution.
- For first POC rendering, favor bright/naked-eye stars or a magnitude-limited
  subset rather than a huge all-sky catalog.
- Treat planets and the moon as future dynamic ephemeris work, not part of the
  first static-star data decision.
- The app code's standard target license is MIT. Prefer source data whose
  license can sit cleanly beside MIT code without adding surprising
  redistribution obligations.

Options to evaluate:

- Hipparcos / Hipparcos 2: good canonical basis for bright stars, position,
  parallax, proper motion, and magnitude; suitable for a magnitude-limited POC.
- HYG Database: convenient combined CSV with names/designations and useful
  fields for app work, but current versions are CC BY-SA 4.0. That may be
  usable as a separately attributed data asset, but it is not the same as
  MIT-compatible source code and may add share-alike obligations for adapted
  catalog data.
- Yale Bright Star Catalog: small naked-eye-star catalog, useful if the first
  POC only needs visible stars and familiar designations.
- Gaia DR3: very complete and no-key accessible through archives, but likely
  too large and operationally heavy for the first POC unless reduced offline.
- IAU constellation boundary data: useful later for standard-sky labels or
  overlays; not needed for the first flat-simulation outline.
- IAU named-star catalog: useful for a human-readable named-star subset with
  RA/Dec and visual magnitude fields. The current Phase 1 fixture uses this
  shape as a compact checked-in bridge, but a generated asset with explicit
  attribution should replace it before the catalog becomes canonical.
- OpenNGC: useful later for galaxies, clusters, and nebulae; not required for
  first star-only POC.

## Future Terrain / Local Horizon Data

Future consideration: use topographic/elevation data around the selected
observer to simulate the local surface and horizon mask. This is not part of
the first flat-simulation POC.

Focused terrain source notes now live in
[Terrain Data Options](terrain-data-options.md).

The same terrain/topographic source could later help show expected land
features for both simulations. In the standard view it can represent nearby
real terrain around the observer. In the flat simulation it can help visualize
what landforms or surface features the projected model predicts should appear
around the viewer.

Promising sources:

- Mapzen Terrain Tiles: best first prototype provider because the data is
  already global and tile-shaped.
- Copernicus DEM: strong global 30m/90m candidate with attribution
  obligations.
- NASA SRTM / NASADEM: useful near-global baseline and fallback.
- NOAA ETOPO / GEBCO: useful coarse global relief or bathymetry context, not
  detailed local terrain.
- USGS 3DEP: optional U.S. quality upgrade, especially for San Jose, but not
  the default terrain contract because the app needs global city/lat-lon
  coverage.
- Natural Earth: public-domain coarse map context, useful for broad land/water
  or coastline context, not detailed enough for a viewer-local horizon.

Likely implementation shape:

- fetch or pre-process a DEM tile/window around the observer
- convert nearby lat/lon/elevation samples into local ENU offsets
- build a simplified Three.js terrain mesh around the observer
- derive a horizon profile by azimuth, storing the maximum elevation angle of
  terrain in each direction
- use that horizon profile to occlude stars near the apparent horizon

Keep terrain optional and separate from the first star/dome projection model.

## Atmosphere Rendering References

The active design note is [Atmosphere Design](plans/retired/flat-root/atmosphere-design.md).

Future reference for improving the haze/atmosphere layer:

- `leoawen/volumetric_cloud_atmosphere_scattering`:
  https://github.com/leoawen/volumetric_cloud_atmosphere_scattering
- Live demo:
  https://leoawen.github.io/volumetric_cloud_atmosphere_scattering/
- MIT license:
  https://raw.githubusercontent.com/leoawen/volumetric_cloud_atmosphere_scattering/main/LICENSE

Useful ideas to revisit:

- separate solid-world rendering from atmosphere/cloud composition
- render scene/depth first, then apply atmosphere as a post/full-screen pass
- compute atmosphere from camera ray and depth instead of per-mesh material
  hacks
- keep volumetric clouds, TAA, god rays, and floating-origin complexity out of
  the current POC unless they become directly necessary

## Open Questions

- What is the user-facing purpose of `flat`?
- How exactly should positions on the azimuthal equidistant Earth projection
  map to observer viewpoint under the sky dome?
- What known starting value should anchor the initial flat-simulation sun
  position before the future assumptions control panel can set it directly?
- Which later sun assumptions should the control panel expose after latitude,
  elevation, and radius: longitude/azimuth, motion period, light strength, or
  color?
- Should visible sun rendering be upgraded later to use the atmosphere
  radiance/transmittance model for disk brightness, color, glare, and
  attenuation?
- Should the atmosphere profile add refractive-index or refractivity fields for
  future apparent-position and horizon-bending corrections?
- Should the SAT city picker be promoted into shared app code immediately, or
  copied/adapted into `flat` first and shared after the second use case is
  stable?
- How should celestial coordinates be projected onto the underside of the half
  sphere?
- Is the projection/coordinate math simple enough to keep local, or does a
  small focused npm module reduce risk without adding much dependency cruft?
- Which math helpers should be designed as a future standalone package API
  rather than app-private implementation details?
- What projection/model interface should the renderer consume so alternate
  false-model projections can be swapped in later?
- What named Earth projections and celestial projections should
  `ProjectionModel` support first?
- Does the false model preserve real star catalog data and only alter the
  projection, or does it also alter motion, distance, visibility, or timing?
- Should the flat apparent-position mode share the same sky-surface renderer
  as the false projection, or have a separate local-horizontal sky-surface
  mapping optimized for true observer-relative azimuth/altitude?
- Which static star catalog should become the canonical POC input, and what
  magnitude cutoff should the app render?
- Should the canonical POC dataset avoid CC BY-SA sources so the shipped app
  and bundled data remain simpler to redistribute under an MIT-code project?
- For future terrain, should `flat` prefer U.S.-high-resolution 3DEP first, a
  global SRTM/NASADEM baseline first, or an abstraction that can swap DEM
  providers by observer location?
- Should the two sky views be shown side by side, toggled, overlaid, or used in
  a guided comparison flow?
- What date/time, observer location, and viewing direction controls should the
  standard sky viewer support?
- What URL/app route should it own?
- Should it be a standalone app like `src/sat`, a feature inside an existing
  app, or a shared capability surfaced by more than one app?
- What data, persistence, or backend routes will it need?
- What assets, if any, must ship in `dist`?

## Related Architecture Paths

- [Flat POC Prompt](prompt.md)
- [Flat POC Phase 1 Plan](plans/poc-phase-1-plan.md)
- [Spherical Sun Atmosphere Plan](plans/retired/spherical-sun-atmosphere-plan.md)
- [Reality-Aligned Daytime Atmosphere Plan](plans/retired/reality-aligned-daytime-atmosphere-plan.md)
- [ProjectionModel API Draft](projection-model-api.md)
- [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/standards/architecture/overview.md)
- [Architecture Topic](/c:/dev/poly-gc-react/agents/topics/standards/architecture/README.md)
- [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/standards/architecture/remvc.md)
- [Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/standards/architecture/feature-mechanics.md)
- [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/standards/architecture/build-and-assets.md)
- [Pipeline App Topic](/c:/dev/poly-gc-react/agents/topics/products/asset-pipeline-3d/pipeline-app/README.md)
- [Pipeline App Source](/c:/dev/poly-gc-react/src/pipeline)
- [Pipeline Build Definition](/c:/dev/poly-gc-react/builds/pipeline.json)
- [SAT App Topic](/c:/dev/poly-gc-react/agents/topics/apps/sat/README.md)
- [SAT City Index Script](/c:/dev/poly-gc-react/scripts/sat/build-city-index.js)
- [SAT Main App](/c:/dev/poly-gc-react/src/sat/main/App.jsx)
