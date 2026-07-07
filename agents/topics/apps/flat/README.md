# Flat App

Deployable Flat app documentation for the false-sky / sky-comparison project.

## Current Active Task

Active bootstrap record: Algorithm32 production shader/runtime implementation.
Use this README only as a routing marker. A new or compacted agent should start
with the Algorithm32 production handoff, then load the reconciliation
conclusions as implementation guidance:

- [Algorithm32 Production Documentation](algorithm32/README.md)
- [Algorithm32 Status](algorithm32/status.md)
- [Algorithm32 Requirements](algorithm32/requirements.md)
- [Algorithm32 Production Design](algorithm32/production-design.md)
- [Algorithm32 Primary Facade API Draft](algorithm32/api-facade-draft.md)
- [Reconciliation To Production Deltas](algorithm32/reconciliation-production-deltas.md)
- [Reconciliation Conclusions](reconciliation/conclusions.md)
- [Unsourced And Partially Sourced Facts](reconciliation/unsourced-and-partially-sourced-facts.md)

Production placement: `agents/topics/apps/flat/algorithm32/` owns production
Algorithm32 documentation, and `shared/algorithm32/production/` owns the
shared production implementation. The reconciliation POC conclusions are the
consolidated implementation guide; production work should now implement the
runtime shader / Three composer path in `shared/algorithm32/production/`
using those accepted contracts. The reconciliation topic, reconciliation POC
code, and reconciliation experiment records remain relevant supporting
material; older pre-reconciliation scattered lanes are no longer production
implementation references.
Both use the Southern France diffuse backend, WebGL antialiasing, and
`renderScale: 2`; `060` disables `Algorithm32AtmospherePass` for direct
comparison. Shadow-map visual follow-up `061` enables real Three shadows with
`enableShadows: true` and `shadowMapSize: 4096`; it shows live terrain shadows
layered over baked diffuse texture shadows. Close-camera follow-up `062`/`063`
uses the new `cameraOverride.cameraGroundClearanceMeters` payload to place the
camera near the terrain surface and compare shadows on/off from the same view.
Receive-only follow-up `064` adds `shadowPolicy: "receive-only"` and proves
the shingle-like bands are terrain self-shadowing: it is byte-identical to the
no-shadow close render while the full cast+receive render has the bands.
High-altitude follow-up `065` repeats the receive-only policy from the original
high camera and is also byte-identical to the no-shadow high render.
The requested four subjective no-shadows with/without full-shader comparison
is accepted as split one-case browser artifacts `070` through `073`. Each
artifact places raw Three scene color without the full Algorithm32 atmosphere
shader on the left and the integrated shader result on the right, using
`southern-france-obj-diffuse`, WebGL antialiasing, `renderScale: 2`, and Three
shadows disabled. All four passed `10/10` criteria with hardware WebGL through
the NVIDIA/ANGLE D3D11 renderer; the local rows used
`flat-local-second-order-atmosphere` with `315` local incident-cache entries.
Partial artifacts `066`, `067`, and `069` are command-only, and rejected
artifact `068` records the timeout failure that led to the split-command path.
Follow-up fitted local-angle views are accepted as `077` through `079`: local
`180`, local `90`, and local `135` degree orbit rows, all aimed with the same
yaw-only camera rotation toward the local Sun bearing at `180` degrees while
preserving the accepted high Southern France look-at elevation. The
local-180-facing terrain fit rotates and widens the staged OBJ footprint so the
finite mesh stays under the visible frame on the right edge. All three passed
`10/10` criteria with hardware WebGL and `flat-local-second-order-atmosphere`.
Earlier artifacts `074` through `076` are superseded by this terrain-fit
rerender.
New artifact `080` is accepted as the shader-only vertical local stack:
local closest, local `45`, local `90`, local `135`, and local `180`, all
looking toward the local `180` degree Sun bearing with the fitted terrain
footprint. It passed `30/30` criteria with hardware WebGL; the gallery is
`960 x 3010` and contains only integrated Algorithm32 shader rows.
New artifact `086` is accepted as the same shader-only vertical stack with
optional real-magnitude procedural point stars enabled in the integrated
shader display config. Stars are sky-ray-only top-of-atmosphere radiance,
divided by pixel solid angle, attenuated by view transmittance, and composed
before the shared tone map; they do not light the terrain. Diagnostics record
`starField.enabled: true`, `intensity: 1`, `density: 1.15`, and
`pointSize: 1.15` for all five `flat-local-second-order-atmosphere` rows.
The contribution is effectively below current fixed-exposure PNG visibility.
Earlier visible-star artifacts `082` through `085` are superseded calibration
attempts; `081` is failure evidence for the temporary GLSL brace error.
See the local lane README and runner README before issuing new browser
commands.

Do not load the older Flat status/design/plan links below, the detailed
shader-lab plan, production flat shader notes, closed object-color docs,
rejected atmosphere pipeline, `atmosflat32` local-Sun docs, or historical
artifacts unless the prompt or user explicitly asks.

Current shader-lab endpoint:
`tmp/atmosphere/algorithm32_shader_lab/226-three-native-production-shape-review/`
is accepted as the current Three-native production-shape endpoint. It records
the live Three render path: scene color render target plus depth texture into
`Algorithm32AtmospherePass`. The objective live-pass parity evidence is
`tmp/atmosphere/algorithm32_shader_lab/224-three-native-live-pass-soft-shader-matrix/`.
`193-soft-shader-capability-parity-matrix` remains accepted as the corrected
packet-based soft-shader/GPU parity endpoint, but it is not the current
integration target. The older `054-browser-gpu-direct-scene-input-second-order-image`
remains accepted only as the prior fixed spherical distant-Sun browser shader
endpoint.

The CPU source-contract runway is accepted through Milestone 12:
`071-cpu-source-contract-distant-sun`, `074-cpu-source-contract-distant-sun-matrix`,
`075-cpu-local-source-first-order-diagnostics`, and
`076-cpu-source-contract-shader-packet`, plus
`078-cpu-local-source-integrated-render`. The `076` packet round-trip
preserved the Milestone 8 distant-Sun raw image, selected diagnostics, and
source-sample trace exactly, and the local packet marks local second-order
cache, direct local solar-disc camera radiance, and local ground bounce as
unsupported or deferred. `078` proves the CPU image renderer now uses the
flat/local point Sun in the first-order scattering integral while the default
spherical distant-Sun control still matches `037` exactly. Milestone 13 is
accepted by `080-browser-lit-scene-input-capture` and
`081-browser-lit-scene-input-cpu-postprocessor`: the browser captured
unlit/material-control and lit/shadow scene packets, then the CPU
postprocessor ran Algorithm32 over those packets pixel by pixel. The required
old-renderer validation passed byte-for-byte (`maxAbsRgbDelta = 0`), and the
zero-density scene-color passthrough also had `maxAbsDelta = 0`. Milestone 14
is accepted by `083-cpu-soft-shader-unlit-parity-matrix`: three unlit cases
matched the original CPU renderer exactly (`maxAbsRgbDelta = 0` for every
case), including full Algorithm32, first-order isolation, and sunset floor.
Milestone 15 is accepted by `084-cpu-soft-shader-lit-scene-matrix`: the lit
packet kept exact zero-density passthrough, replaced sky with Algorithm32
radiance, preserved shadow/lit separation after atmosphere, and produced
finite RGBA over all pixels. Milestone 16 is accepted by
`085-browser-source-light-coupling` and
`086-cpu-source-light-coupling-validation`: the distant Sun packet now drives
both Algorithm32 and the Three `DirectionalLight`, direction agreement is
`3.46944695195361e-18`, no default-Sun fallback was used, zero-density
passthrough stayed exact, and shadow/lit separation survived the postprocess.
Milestone 17 is accepted by browser captures `087` through `090` and
aggregate artifact `091-cpu-distant-sun-position-matrix`: high, low,
synthetic side, and synthetic behind-camera distant Sun cases passed `39/39`,
and packet-supplied synthetic Sun cases now drive Algorithm32 without a
default high-Sun fallback. Milestone 18 is accepted by
`093-cpu-local-sun-soft-shader-source-matrix`: local offsets `0`, `45`, `90`,
`135`, and `180` degrees all resolved as `packet-supplied-flat-local-point-sun`,
matched the original CPU local renderer exactly, and passed finite-source
trace checks. Milestone 19 is accepted by
`094-cpu-unified-source-driven-soft-shader-matrix`: distant high, distant low,
and the five local offsets all reprocessed through the same
`postprocessSceneInput` CPU soft-shader kernel and passed `56/56` criteria.
Milestones 20 through 29 are accepted by `162`, `167`, `171`, `172`, `174`,
`176`, `177`, `185`, `192`, and `193`, with browser evidence in `166`, `169`,
`170`, `173`, `175`, `180` through `184`, and `187` through `191`. The
accepted shader runway froze the GPU packet inventory, proved exact
no-atmosphere passthrough, made distant Sun uniforms packet-driven, matched
distant high/low CPU soft-shader output with `maxAbsRgbDelta = 1`, preserved
lit Three scene shadows through shader composition, matched local
closest/`90` first-order selected diagnostics with max RGB delta `0`, and
then closed local full-image parity. Milestone 27 accepted local spectrum-mode
full-image parity for offsets `0`, `45`, `90`, `135`, and `180` degrees with
`33/33` criteria. Milestone 28 accepted local scene-color-composition parity
for the same five offsets with `33/33` criteria. Milestone 29 accepted the
corrected capability matrix with `6/6` criteria.
Subjective Three-light source inspection is accepted by
`104-three-lit-subjective-source-scenes`, superseding `099` because the first
local `90` degree view pointed away from the mountain composition. Distant
midday and distant sunset use source-driven white Three `DirectionalLight`,
while local closest approach and local `90` degree orbit use source-driven
white Three `PointLight` at the configured flat/local Sun position before
Algorithm32 postprocessing. Treat `104` as visual inspection only, not an
objective shader milestone.
The CPU/browser postprocessor runway and POC browser shader runway are
complete through Milestone 29, and the Three-native atmosphere-pass runway is
complete through Milestone 38. Use
`226-three-native-production-shape-review` as the current shader-lab endpoint
and `224-three-native-live-pass-soft-shader-matrix` as the current objective
live-pass parity evidence. Milestones 30 through 38 turned the packet-based
GPU proof into a Three-native `Algorithm32AtmospherePass` that runs in a live
Three render loop over scene color and depth render targets. Normal rendering
does not depend on JSON scene packets; packets are validation/oracle artifacts
only. Evidence: `218` pass shell, `212` depth-to-ray reconstruction, `216`
distant first-order atmosphere, `217` live camera controls, `220` flat/local
first-order atmosphere, `222` unified source/geometry adapter switching,
`224` live-pass-vs-soft-shader matrix, `225` scenario/debug controls, and
`226` production-shape review. Remaining physics work beyond the current CPU
soft shader includes local second-order cache support, direct local
solar-disc camera radiance, local ground bounce, Mars/non-Earth presets, and
HDR/float transport policy. The next implementation step is production
promotion of the accepted pass shape into the official Algorithm32
implementation. For the local-second-order lane, keep using the user-owned
watch harness for browser artifacts. Do not use direct one-shot
`harness.js --once` commands for this lane. The harness recovery path and
hardware-WebGL launch default are patched; browser validation should continue
through the watcher contract without documenting live process state.

Visual-only artifact
`227-postprocess-gpu-vs-integrated-shader-subjective-scenes` compares the
packet/postprocess GPU shader against the integrated Three-native shader for
distant midday, distant sunset behind camera, local closest, and local `90`;
it is inspection material, not a new objective acceptance milestone.

Recent background only: the `atmosflat32` source-abstraction POC is accepted at
`019` for default distant-Sun parity and `018` for first-order flat/local
rotation skydomes. Reload it only when work returns to configurable local Sun
behavior.

## Documents

The documents below are navigation only. For Algorithm32 production
implementation, use [Reconciliation Conclusions](reconciliation/conclusions.md)
as the primary reference, with the reconciliation topic/code/experiments as
supporting material. Treat older pre-reconciliation lanes as archive material.

- [Status](status.md)
- [POC Prompt](prompt.md)
- [ProjectionModel API Draft](projection-model-api.md)
- [Algorithm32 Production Documentation](algorithm32/README.md)
- [Algorithm32 Status](algorithm32/status.md)
- [Reconciliation Lane](reconciliation/README.md)
- [Reconciliation Experimental Guidelines](reconciliation/experimental-guidelines.md)
- [Atmosphere Cleanroom Design](plans/atmosphere-cleanroom-design/README.md)
- [Experiment 032 Algorithm](plans/atmosphere-cleanroom-design/experiment-032-algorithm.md)
- [Object Color Transport](plans/atmosphere-cleanroom-design/object-color-transport.md)
- [Reference To Shader Goal](plans/atmosphere-cleanroom-design/reference-to-shader-goal.md)
- [Algorithm32 Module Design](plans/atmosphere-cleanroom-design/algorithm32-module-design.md)
- [Algorithm32 Canonical Reference](plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md)
- [Algorithm32 Shader Iteration Plan](plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md)
- [Algorithm32 Shader Lab Plan](plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md)
- [Production Flat Shader Differences](plans/atmosphere-cleanroom-design/production-flat-shader-differences.md)
- [Object Transport Experiment Plan](plans/atmosphere-cleanroom-design/object-transport-experiment-plan.md)
- [Environment Object Color Closeout](plans/atmosphere-cleanroom-design/environment-object-color-closeout.md)
- [Environment Object Color Prompt](plans/atmosphere-cleanroom-design/environment-object-color-prompt.md)
- [Objective Success Criteria](plans/atmosphere-cleanroom-design/objective-success-criteria.md)
- [Environment Experiment Run Shape](plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md)
- [Environment Experiment Preflight Spec](plans/atmosphere-cleanroom-design/environment-experiment-preflight-spec.md)
- [Retired Atmosphere Material](plans/retired/README.md)
- [Terrain Data Options](terrain-data-options.md)
- [Plans](plans/README.md)
- [Decisions](decisions/README.md)

## Current Shape

Flat is a Polylith REMVC app with active `flat-simulation` and
`globe-simulation` page features. The flat-simulation feature owns the
counterfactual flat-model sky. The globe-simulation feature is the new
correct-geometry Sun/atmosphere calibration path.

Current implementation focus:

- The default route is `/flat/flat-simulation`.
- The globe-simulation shell is registered at `/flat/globe-simulation`.
- The default observer is San Jose, CA at `100 ft` elevation, using the
  observer/root camera. The north-pole bird's-eye camera remains an inspection
  preset, not the active default.
- The flat simulation renders projected Earth context, a hidden sky dome,
  stars/constellation overlays, a visible animated finite false sun, synthetic
  red mountain rectangles, a local floor patch, and a depth-aware atmosphere
  composer.
- The flat false Sun is a 32-mile-diameter local finite source at roughly
  `3000 mi` altitude. Its default latitude is date-resolved by the
  `annual-tropic-migration` rule, moving between the Tropic of Cancer and the
  Tropic of Capricorn over the year, while the solar-day animation rotates the
  selected latitude ring once per simulated 24 hours.
- The atmosphere composer is the active flat-simulation atmosphere owner. It renders solid
  scene color/depth offscreen, reconstructs camera rays, applies optical
  depth/transmittance and sun-driven Rayleigh/Mie single scattering, includes
  short sample-to-sun transmittance, and composites
  `sceneColor * transmittance + inScatteredLight`.
- The globe-simulation feature renders a real Three/R3F spherical calibration
  scene anchored on San Jose, with Sun-only celestial scope, fixed solar-noon
  Sun/Earth positioning, `23.43928 deg` Earth axial tilt, date-derived
  sidereal rotation, a standing-height camera above the `100 ft` San Jose
  surface point, a fixed calibration timestamp of
  `2026-06-13T13:07:44-07:00`, `spherical-shell` atmosphere geometry, a
  featureless matte green globe surface, shared synthetic red mountain markers,
  the 50 brightest northern-celestial-hemisphere stars from the shared POC star
  fixture with magnitude-derived relative flux, and pointer/touch look-around
  controls that rotate the standing camera in place.
- Globe atmosphere integration has reached Phase 4.4. The atmosphere source
  uses physical top-of-atmosphere solar irradiance, the globe surface and
  synthetic marker faces render as Lambertian radiometric surfaces, the solid
  render target stores linear half-float color, and the composer tone-maps the
  combined surface radiance plus atmospheric in-scattering through the shared
  display bridge.
- The earlier translucent visual atmosphere shell is intentionally removed so
  blue sky must come from the composer scattering pass. The current visual
  problem is not basic plumbing: the globe sky remains muted blue-gray, the
  horizon can look brown, and red marker surfaces can become pink where
  atmosphere airlight is added over them. The next atmosphere work should
  diagnose the spherical shader/display calibration before returning to flat
  tuning.
- Floor end-state: floor/terrain should be a lit physical surface whose albedo
  reacts to scene light sources first, then fades through the same atmosphere
  composer as mountains and other objects.
- Terrain is intentionally deferred until the fixed daytime sky calibration is
  understandable.

Key continuation docs:

- [Status](status.md): detailed current implementation history and next tasks.
- [Algorithm32 Status](algorithm32/status.md):
  concise current handoff for Algorithm32 production shader/runtime work.
- [Algorithm32 Production Documentation](algorithm32/README.md):
  production documentation home for the official Algorithm32 module, whose
  implementation lives in `shared/algorithm32/production/`.
- [Reconciliation Conclusions](reconciliation/conclusions.md):
  consolidated implementation reference for the production Algorithm32
  reference/shader work.
- [Reconciliation To Production Deltas](algorithm32/reconciliation-production-deltas.md):
  working tracker for architecture/API differences between reconciliation and
  production.
- [Unsourced And Partially Sourced Facts](reconciliation/unsourced-and-partially-sourced-facts.md):
  provenance-gap ledger only, not an implementation reference.
- [Terrain Data Options](terrain-data-options.md): terrain provider choice and
  first-pass terrain integration plan for after sky calibration.
