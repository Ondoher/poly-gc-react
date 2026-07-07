# Reconciliation POC Current State

Status: the reconciliation POC is now considered exhausted as an
evidence-generating lane. Final architectural and technical decisions are
captured in `agents/topics/apps/flat/reconciliation/conclusions.md`,
including the separate Three integration lessons. Milestone 2 is closed.
Record `050-m2-closeout` accepts M2 as a CPU
local/flat method-confidence POC milestone and leaves production/shader
limitations explicitly outside the M2 acceptance claim. The CPU
distant-Sun/spherical-Earth reference still matches the accepted Step 032
four-view sky-dome artifacts exactly. M2 now has
concrete `FlatEarthGeometry`, `LocalSunLightSource`, and optional
`LocalSunIncidentRadianceCache` implementations on the Milestone 1 evaluator,
calculator, and cache-builder contracts. Records 025 through 030 verify flat
geometry, local source calibration/source packets, basic local/flat CPU
transport, pre-asset convergence/cap/cache diagnostics, and local/flat PNG
asset generation. Records 031 and 032 preserve rejected stack-comparison
attempts, and record 033 creates the requested full-size three-column stack:
atmosflat Step 018 guide imagery on the left, reconciliation M2 imagery in the
middle, and a 3x visual absolute-difference column on the right. Records 034
through 037 diagnose and fix the M2 flat coordinate warnings: source paths
starting infinitesimally above the supplied top boundary now clip at the
boundary instead of sampling toward the finite local source. Records 038 and
039 regenerate the full-size local/flat domes after that fix and create the
requested six-column comparison stack; the record 029 vs latest pixel diff is
zero for all five scenes. Record 040 implements the observer-centered finite
dome in `FlatEarthGeometry` and regenerates the five full-size local/flat
Step 018-rotation skydomes with the scalar cap demoted to a legacy fallback.
Record 041 creates the requested two-column stack with atmosflat Step 018 on
the left and the new observer-dome reconciliation domes on the right, with no
diff column. Record 042 adds the requested third-column absolute diff x3 stack
for atmosflat versus the latest observer-dome skydomes. Step 018 atmosflat
images remain diagnostic guide imagery, not
exact-match canon. Record 043 renders the additional subjective skydome scene
set:
`san-jose-longitude-summer-solstice-latitude-sweep`, with observer latitudes
`80N`, `30N`, equator, `30S`, and `80S` at the San Jose longitude and closest
false-Sun approach on summer solstice. The source latitude is resolved from
the documented `annual-tropic-migration` model at
`2026-06-21T12:00:00-07:00`, currently `23.5 deg N`, before closest-approach
rotation. Its brightness calibration is now anchored once at that same
`23.5N` source latitude and San Jose longitude, representing the local
solar-noon/subsolar reference event; the resulting reference spectral incident
scale is reused for all five latitude-sweep skydomes. This set has no Step
018 guide-image parity target. Record 044 adds the reusable
`san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep` set and
renders a north-up flat/spherical comparison stack. It uses the same observer
latitudes and San Jose longitude, keeps every row at the same synchronized
solar-noon time by setting the source subpoint longitude to the common
longitude, reuses the same source-latitude brightness calibration, and maps
the scene frame to `x=east`, `y=north`, `z=up` so north is up in every
source image. The final stack is
`tmp/atmosphere/reconciliation/044-m2-synchronized-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
Record 045 adds the Greenwich-noon reusable comparison variant
`san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`: the
observer/render longitude remains San Jose, but the render clock is
synchronized to solar noon at longitude `0`, so the source subpoint longitude
is `0` for every row and the Sun is no longer on the image's north/south
meridian. Its final stack adds per-image Sun captions showing compass azimuth
and altitude:
`tmp/atmosphere/reconciliation/045-m2-greenwich-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
Record 046 supersedes record 045 as the runner's reusable default by selecting
`san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`. The
observer/render longitude remains San Jose (`-121.8863`), but the synchronized
solar-noon/source-subpoint longitude is `-76.8863`, exactly 45 degrees east
of San Jose. This keeps the Sun off the north/south meridian while leaving
the spherical distant Sun above the horizon through the `30S` row. Its final
captioned stack is
`tmp/atmosphere/reconciliation/046-m2-45east-noon-flat-spherical-skydomes/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
Record 047 adds the requested North Pole GMT clock sweep:
`north-pole-summer-solstice-2026-gmt-4hour-sweep`. It renders at latitude
`90N`, longitude `0`, sea-level elevation, on `2026-06-21`, every four hours
from `00:00 GMT` through `20:00 GMT`. The source subpoint longitude is derived
from the clock with `12:00 GMT -> 0` and `15 deg/hour`; the source latitude is
`23.5N`. Record 047's
final stack is
`tmp/atmosphere/reconciliation/047-m2-north-pole-summer-solstice-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
Record 048 renders the South Pole winter-solstice counterpart:
`south-pole-winter-solstice-2025-gmt-4hour-sweep`. It renders at latitude
`90S`, longitude `0`, sea-level elevation, on `2025-12-21`, every four hours
from `00:00 GMT` through `20:00 GMT`. The source latitude is about
`23.4995S`, and the same UTC source-longitude cadence is used. Record 048's
final stack is
`tmp/atmosphere/reconciliation/048-m2-south-pole-winter-solstice-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
Record 049 renders the Union Glacier Final Experiment review set:
`union-glacier-final-experiment-2024-dec15-gmt-4hour-sweep`. It renders at
latitude `-79.768036`, longitude `-83.261666`, elevation `700 m`, on
`2024-12-15`, every four hours from `00:00 GMT` through `20:00 GMT`.
Brightness is calibrated at `2024-12-15T12:00:00Z` directly under the migrated
source latitude on longitude `0`, sea-level elevation. The source latitude
resolves to about `23.4258S`, with
`referenceSpectralIncidentScale = 1.0117141056`. The shell command timed out
after printing an accepted result, but all record criteria are accepted and
all PNGs were written. Record 049's final stack is
`tmp/atmosphere/reconciliation/049-m2-union-glacier-final-experiment-gmt-sweep/artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

Working calibration-policy note: local-source brightness calibration should
probably default to local solar noon at the source latitude. After that source
power is derived, other observer latitude/time rows should use clock
synchronization or orbit offsets rather than recalibrating brightness per
observer. Production should replace the current POC's dimensionless
`referenceSpectralIncidentScale` bridge with a unit-bearing radiometric source
calibration: choose target sea-level direct normal irradiance directly under
the finite Sun at the calibration event, account for source-path transmittance
and apparent solid angle/finite-source geometry, and solve for fixed source
spectral radiance or power for the configured Sun altitude/size. Calculate or
invalidate that derived value when relevant user/profile configuration changes,
then consume it as resolved source configuration.

Latest accepted Southern France subjective shader record:
`tmp/atmosphere/reconciliation/142-m3-subjective-southern-france-daylight-stack`.

Records `101-m3-subjective-southern-france-solar-noon` and
`102-m3-subjective-southern-france-solar-noon` are superseded for camera
framing: they used the early low Southern France ridge-view camera rather than
the later accepted high review camera. Records
`103-m3-subjective-southern-france-high-camera-solar-noon` and
`104-m3-subjective-southern-france-solar-noon` rerender the same solar-noon
request with the accepted high Southern France camera profile from the
local-second-order review lineage: camera `[0, 6200, 15800]`, look-at
`[0, 4200, -56000]`, vertical FOV `62`. The render interprets "today" as
`2026-07-04`, uses the no-shadow Southern France OBJ lineage as a
geometry-only matte terrain fixture, and uses an approximate review-fixture
location of `44N`, `6E` at solar noon on the local meridian. Record `103` is
the submitter-side record; record `104` is the browser artifact folder with
`canvas-image.png`, `screenshot.png`, selected-pixel readback, shader
diagnostics, and scene diagnostics. The browser run accepted all criteria,
with Sun altitude about `68.88 deg`, azimuth `180 deg`, no shader compile/link
errors, `meshCount = 208`, and three distinct selected readbacks. This is
subjective review evidence, not an externally sourced numeric parity gate.

Records `105-m3-subjective-southern-france-daylight-stack` through
`114-m3-subjective-southern-france-daylight-stack` iterate the requested
Southern France sunrise-to-sunset subjective gallery through the assembled
distant/spherical browser shader. Records `105/106` first loaded all 28
diffuse TGA textures but used a small `480 x 1350` stack and did not yet match
the local-second-order `097` left-column composition. Records `107/108` copied
the accepted `097` sunset-yawed camera/look-at and yaw-aligned wider terrain
fit. Records `109/110` copied the `097` row output size (`960 x 540`), 2x
internal render/downsample behavior, local-solar-noon clock (`13:09`), row
times (`05:47`, `09:28`, `13:09`, `16:50`, `20:31`), solar declination seed,
and scene directional-light intensity. Records `111/112` are the current best
close-match result: copied `097` framing, diffuse textured terrain, five
stacked `960 x 540` rows, dark orange sunrise/sunset rows, and comparison
artifacts against the cropped `097` left-column target under
`tmp/atmosphere/reconciliation/112-m3-subjective-southern-france-daylight-stack/comparison/`.
Record `113/114` is preserved as a rejected/rolled-back final tuning attempt.
Remaining differences are color/transport behavior, especially cyan/gray sky
balance and endpoint terrain brightness; scene composition and copied
parameters are now close enough for the current POC subjective review target.
Record `115/116` adds the requested no-mesh diagnostic variant with the same
camera, shader parameters, Sun times, and an ocean-colored floor. The sunset
comparison against local-second-order record `096` and reconciliation record
`114` is retained under
`tmp/atmosphere/reconciliation/116-m3-subjective-southern-france-daylight-stack/diagnostic/`.
The weak sunset gradient remains without the Southern France mesh, and the
diagnostics still report full-frame endpoint hits (`hitFraction = 1`) for all
rows. This rules out terrain mesh occlusion as the primary explanation for
the missing 096-style sky gradient. The next implementation diagnosis should
target scene-depth/no-hit classification, background/floor endpoint routing,
or sky-path composition rather than further scene/camera/mesh tuning.

Records `127` through `142` diagnose and correct that endpoint classification
path. The root issue was not the terrain mesh: the browser scene used a flat
catch floor during a distant/spherical shader pass, and the depth texture used
a one-channel no-hit sentinel that collided with color-managed readback values.
The current browser scene now builds the helper floor as an observer-local
spherical Earth mesh centered one Earth radius below the camera tangent point,
and the depth texture uses grayscale for real early scene hits and magenta for
no-hit pixels. The assembled shader uses that chroma distinction: an early
scene hit terminates the normal ray segment length calculation; otherwise
geometry resolves the ray to atmosphere exit. Record `140` verifies the
no-mesh ocean diagnostic now reports about `46%` early scene hits and `54%`
no-hit/atmosphere-exit pixels. Record `142` applies the same fix to the full
Southern France diffuse stack, reports about `48%` early scene hits and `52%`
no-hit/atmosphere-exit pixels, keeps all 28 diffuse textures loaded, and
restores a strong warm sunrise/sunset horizon gradient. Treat record `142` as
the current subjective review artifact; it is still not an objective numeric
shader parity gate.

Current long-runner behavior: future image/scanning experiment runners should
create `<record>/run.log` before expensive work begins and append live progress
while they run. `Figure1SkyDomeRenderer` now accepts an optional progress
callback and emits started, row-complete, PNG-write-started, and completed
events from inside the image loop; the main M1/M2 sky-dome runners, stack
comparison diff loop, and coordinate-warning full scan append those events to
`run.log`.

## Last Completed Milestone

Milestone 2: CPU local Sun and flat Earth method-confidence POC on the
Milestone 1 abstraction surface. Record `050-m2-closeout` closes it.

## Active Milestone

No further reconciliation POC milestone is active. The POC is closed for
conclusions rather than more review tuning. M4.1, M4.2, and M4.3.1 are
accepted in records `534`, `535`, `536`, and `537`; later review records remain
subjective evidence and implementation-learning context. The earlier M3 shader
design context remains relevant because
the local/flat GPU work uses the same composer, contribution assembly, cache
texture, hit-distance, endpoint-color, and watcher architecture. The current
shader design lives in
`agents/topics/apps/flat/reconciliation/shader-design.md`: it is an operation
design covering setup/config/runtime lifecycles, abstraction-owned shader
contributions, cache-owned texture/access assembly through `TextureBuilder`,
bindings, symbol inventory, `ThreeGateway`, pass installation, invalidation,
diagnostics, and the CPU postprocess shader scene-input contract. Browser watcher,
screenshot/capture, image comparison, parity tolerance, and comparison records
stay in the action plan and experiment-runner layer. M3 baseline rule: do not
reimplement validated behavior in adapters, runners, comparisons, or
shader-support helpers. Use only public `evaluate(...)`, already implemented
configuration endpoints, and the validated Bruneton-based dome rendering color
adapter for baseline work. Do not call lower-level algorithm, calculator,
cache, geometry, source, or atmosphere internals. New GPU GLSL is the
implementation under test, not the CPU/reference baseline. The first concrete
M3 deliverables are the CPU postprocess soft-shader and reusable GPU
validation scene set. The soft-shader must call the public reconciliation
`evaluate(...)` operation, not call `SpectralCalculator`, geometry,
atmosphere, light-source, cache, or other algorithm internals independently,
and compose as `endpointRadiance * T_view + L_path` from evaluation output and
scene-input endpoint radiance. The M3 hit-data itemization design step is
complete in `shader-design.md#hit-data-itemization-and-routing`: every
hit-related datum is named, assigned an owner/route, and split between
geometry-owned spatial input and post-transport endpoint contribution. The
objective-scene path is a canonical spectral fixture table keyed by
`spectralReferenceId`, with explicit values over
`CANONICAL_SPECTRAL_CHANNELS`; direct per-scene spectral authoring is only for
adding or diagnosing fixtures with provenance, and renderer material-id lookup
is deferred as a later production/material policy. Renderer RGB-derived
material color needs a separate color/material policy. If an RGB-derived
spectral endpoint path is selected,
the preferred RGB-to-spectrum direction is an inverse fit against the
validated Bruneton-based spectral-to-display adapter, with explicit
constraints and error reporting because the conversion is lossy and
non-unique. Stage 3.1.0b runs focused inverse-fit experiments only if
RGB-derived endpoint spectra are needed. RGB/display color must never enter
`evaluate(...)`. All color
conversion, including RGB-to-spectrum inverse fitting, belongs to the color
abstraction. Mining the current soft-shader favors geometry-only hit input for
the first contract: hit mask/distance drive transport, while spectrum-id
fixtures and captured RGB are post-transfer composition policies. The current
practical bridge for renderer hit color is the local-second-order captured
scene-color policy. The installed local-second-order GPU shader composes
captured scene color as an inverse-tone-mapped endpoint proxy before tone
mapping instead of adding tone-mapped scene RGB after atmosphere display
conversion. For the reconciliation CPU color task, this is the canonical
diagnostic scene-color mechanism to mirror outside `evaluate(...)`, not an
RGB-to-spectrum or matte/Lambertian endpoint-radiance reconstruction. The first
`captured-linear-scene-color` proxy render in record
`096-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset` looked
overly blue, likely because captured `0..1` scene color was too small in the
shader's pre-tone-map scale. Camera distance remains a plausible separate
contributor, but the same-scene inverse-tone-map proxy rerun, record
`097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset`, looked
much more plausible in review. Treat `097` as the current `3.D1`
visual/plausibility result for
`with-shader-distant-local-sunrise-sunset-side-by-side`, the artifact-092
lineage with spherical distant Sun on the left, flat local Sun on the right,
and sunrise-to-sunset daylight rows. This remains review evidence and should
not be treated as a new reconciliation milestone gate. Records `218` through
`220` now mirror this behavior in the CPU postprocess soft-shader path. The
active design thread is again the Milestone 3 shader design. Hit-data
ownership and the CPU postprocess soft-shader contract are settled, and the
GPU validation scene-set design questions are closed into
`shader-design.md#gpu-validation-scene-set` and `shader-test-design.md`. The
ThreeGateway design questions are also closed into
`shader-design.md#threegateway-scene-synchronization`. Endpoint/depth
semantics are also settled in `shader-design.md#hit-data-itemization-and-routing`.
Shader contribution assembly is settled in
`shader-design.md#partial-shader-assemblies`. Cache texture and lookup are
settled in `shader-design.md#cache-texture-and-access-assembly` and
`shader-design.md#cache-texture-lifecycle`. Binding lifecycle is settled in
`shader-design.md#binding-contract-and-value-resolution`. The focused shader
design backlog is currently empty; implementation work can begin turning the
settled CPU soft-shader and validation scene-set contracts into types, probes,
and code.
For cache textures, do not require one first texture format. `TextureBuilder`
may choose the available texture format/packing/kind for the requested
dimensions, but must return the matching low-level access contribution,
commonly a generated global fetch helper function with its function name/call
target. The helper may be generated for a specific texture instance when
packing/layout/sampler facts require it; the cache owns semantic lookup and
CPU baseline comparison.
Cache miss diagnostics are POC debug/validation-only and bounded, such as
selected-pixel GPU diagnostic passes or aggregate counters. Production
diagnostics are deferred until there is a holistic diagnostics plan.
Binding lifecycle first design assumes one camera/pass per frame. Multi-view
can be modeled later as repeated pass invocations with distinct frame
bindings.
Binding lifecycle rebuild policy: full shader rebuild happens only when a
change affects shader assembly/source/material shape. Existing binding value
changes refresh uniforms, textures, or resources without recompile.
Binding fingerprints require a stable hash for compatibility and reuse
decisions. Human-readable JSON snapshots are deferred diagnostic support.
Display/composition policy now treats the installed GPU shader's primary
operational output as display RGB/RGBA written to the active Three render
target or canvas. Spectral or diagnostic buffers are optional
validation/debug outputs, not the shader product output. This is rooted in
Three shader semantics: fragment shaders define per-fragment color in the
`WebGLRenderer` render pipeline.
Endpoint RGB diagnostic composition is not retained as a shader-owned
per-pixel diagnostic. Any endpoint-RGB comparison belongs to the test runner,
compares rendered display output only, and must not claim spectral parity.
Exposure/debug modes are not part of first shader operation unless a specific
validation or product need arises. Runner-side visualization controls are the
default home for those concerns.
First-pass browser/GPU numeric tolerance for secondary CPU-vs-GPU comparison
should be grounded in human visual perception. The shader test design owns the
specific threshold and evidence.
Image-level acceptance metrics are selected by objective test need: specific
pixels, controlled regions, whole-image metrics, or a documented combination.
Both soft-shader and GPU shader runs are gated against the same objective scene
claims; soft-vs-GPU comparison is secondary evidence.
Browser/GPU rendered artifacts do not get a default exact pixel-match gate.
Exact match is reserved for CPU-only artifacts, deterministic descriptor
snapshots, and other non-browser/reference outputs unless a later GPU test
proves the whole browser/render-target/readback path is deterministic enough
for an exact claim.
Browser runner protocol follows the local-Sun experiment model: a long-running
watcher monitors for JSON job files to open. Liveness is judged from an
updating progress log. Comparisons may use in-memory buffers, but all retained
visual artifacts should be saved as PNG files.
Local/flat GPU follow-on is anticipated through abstraction boundaries, cache
ownership, and contribution assembly shape, without unused local/flat branches
in the distant/spherical shader. Descriptor/schema validation tests only
mandatory contract facts and accepts them from any abstraction; optional
unsupported facts are profile-specific unsupported classifications rather than
concrete-type gates. The first local/flat subjective smoke scene is
user-selected when requested, and finite-dome versus local-cache validation has
no required ordering.
Implementation inventory decisions are settled: the CPU postprocess
soft-shader lives in `soft-shader/`, parallel to the GPU `shader/` folder;
scene ids live in a JSON inventory that can carry metadata and later resolve
to code modules; every implementation folder owns its own `types.d.ts`.
`action-plan.md` Milestone 3 now matches the settled shader design: objective
scene claims are the primary gate for both CPU soft-shader and GPU shader
runs, CPU-vs-GPU comparison is secondary evidence, browser work follows the
JSON-job/progress-log/PNG-artifact protocol, and planned files follow the
`soft-shader/`, `shader/`, `scenes/`, `comparison/`, and `browser/` folder
split.
`shader-test-design.md` now defines the first objective test inventory,
data-source/provenance table, and extent coverage matrix. Objective shader
scenes must prove rendered screen pixels or controlled pixel regions, not just
spectral packets or CPU-vs-GPU agreement. Each objective scene should name its
test id, selected pixels or regions, expected display-pixel claim, extent
coverage, and source/fixture provenance. The current local evidence trail
includes Step 032 display constants, the validated `BrunetonColorDisplayModel`
color adapter, `Figure1SkyDomeRenderer` artifact output evidence, CIE 1931
2-degree CMFs, ASTM G-173, U.S. Standard Atmosphere profile rows, Bucholtz
Rayleigh rows, controlled ray-path fixtures, and mined shader-lab endpoint
spectra as seed material until reconciliation-owned fixtures are materialized.
Stage 3.1.1 is complete in
`tmp/atmosphere/reconciliation/055-m3-ambient-types-cleanup-scene-input-contract`
after the ambient type-file cleanup. The original acceptance record is
`tmp/atmosphere/reconciliation/051-m3-soft-shader-scene-input-contract`.
The new `soft-shader/types.d.ts` owns the CPU postprocess scene-input packet
names, and `soft-shader/SoftShaderSceneInputAdapter.js` prepares selected
scene pixels into geometry-facing `SpectralEvaluationRequest` values plus
separate endpoint contribution data. The accepted probe verifies that finite
scene hits become `viewRayRequest.endDistanceMeters`, no-hit and invalid
intersections do not create hit caps, endpoint contribution does not enter
`evaluate(...)`, RGB/display fields are rejected before evaluate request
construction, and non-opaque endpoints are rejected.
Stage 3.1.2 is complete in
`tmp/atmosphere/reconciliation/056-m3-ambient-types-cleanup-soft-shader`
after the ambient type-file cleanup. The previous color-boundary acceptance
record is
`tmp/atmosphere/reconciliation/054-m3-cpu-soft-shader-color-model-rerun`.
The earlier `052-m3-cpu-postprocess-soft-shader` run was superseded by the
color-boundary correction. The new `soft-shader/CpuPostprocessSoftShader.js`
uses the public evaluator surface, composes finite opaque endpoints as
`endpointRadiance * T_view + L_path`, leaves no-hit sky pixels as `L_path`,
and writes bounded selected-pixel plus aggregate diagnostics. Step 032
spectral-to-display conversion now lives in
`color/BrunetonColorDisplayModel.js`, an implementation of the expanded
`ColorDisplayModel` contract; `Figure1SkyDomeRenderer` consumes that color
model instead of owning conversion code.
All POC `types.d.ts` files under `scripts/flat/reconciliation/POC/src/` are
now standard ambient declaration files with no `export {}`, imports, or
`declare global` wrappers, matching the production implementation
`types.d.ts` style that VS Code can pick up directly.
The color-display implementation formerly named `Figure1ColorDisplayModel` is
now `BrunetonColorDisplayModel`, verified in
`tmp/atmosphere/reconciliation/057-m3-bruneton-color-display-model-rename`.
The Figure 1 name remains only on the artifact renderer and constants that are
actually Figure 1 specific.
Stage 3.1.3 is complete in
`tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge`. The new
`three/ThreeSceneSoftShaderBridge.js` captures selected pixels from a
Node-only Three scene using `PerspectiveCamera` and `Raycaster`, applies the
shader-lab coordinate convention `Three [x, y, z] -> Algorithm32 [east=x,
north=-z, up=y]`, and emits `SoftShaderScenePixelInput` packets. The first
controlled scene lives in `scenes/createShaderLabReferenceScene.js` and
contains one sky/no-hit selected pixel, one fixture-card hit, and one
ground-plane hit. The record verifies finite positive hit distances,
normalized output rays, no supplied hit distance for the sky pixel, public
`evaluate(...)` use through `CpuPostprocessSoftShader`, endpoint fixture ids
kept out of `evaluate(...)`, and finite soft-shader display output. This
bridge does not require a browser or WebGL render target; browser/GPU scene
input textures remain later shader-runner work.
Stage 3.2.1 is complete in
`tmp/atmosphere/reconciliation/059-m3-shader-scene-registry`. The new
`scenes/shader-scene-inventory.json` seeds the validation inventory with the
accepted Node bridge row plus the planned objective rows `obj-001` through
`obj-014` from `shader-test-design.md`. `scenes/ShaderSceneRegistry.js`
validates stable scene ids, objective test ids, provenance ids, extent tags,
selected pixel or controlled-region targets, expected display-pixel claims,
and absence of live-browser descriptor requirements. All seed rows
intentionally mark final numeric RGBA values as `pending-external-source`:
those values must later be materialized from external fixtures or
external-source-backed accepted records before any row becomes a final numeric
pixel gate. Do not invent final RGBA acceptance values from local
implementation code.
Record `tmp/atmosphere/reconciliation/060-m3-sourced-values-inventory`
captures the first source hunt for those pending expected values. Source-backed
numeric inputs are already available for CIE 1931 2-degree color matching,
ASTM G-173 solar spectrum ingestion, U.S. Standard Atmosphere 1976 density
checkpoints, and Bucholtz 1995 standard-air Rayleigh coefficients. Final
screen-pixel RGBA values are not directly available in those references; they
must be materialized as derived reconciliation-owned fixtures through public
`evaluate(...)`, the selected scene fixture data, and
`BrunetonColorDisplayModel`.
Stage 3.2.2 is complete in
`tmp/atmosphere/reconciliation/061-m3-objective-scene-criteria`.
`ShaderValidationObjectiveCriterion` is now part of the ambient scene types,
`ShaderSceneRegistry` validates objective criteria, and every objective row in
`scenes/shader-scene-inventory.json` names its claim, measurement, owner,
failure classification, and whether it gates GPU objective runs. The accepted
Node bridge row remains non-gating review/bridge evidence; all planned
`obj-001` through `obj-014` rows gate GPU objective runs. The probe accepted
10 criteria and still reports all rows as pending final externally sourced
numeric RGBA materialization.
Subgoal 3.2 is complete in
`tmp/atmosphere/reconciliation/062-m3-scene-set-completion`.
`scenes/shader-scene-inventory.json` now carries subjective lineage rows for
the active first GPU review Southern France no-shadow records `070` through
`073`, deferred local/flat follow-on records `077` through `080` and `086`,
and an explicit exclusion for Southern France shadowed variants. The new
`m3SceneSetCompletionProbe` generated provisional CPU soft-shader selected-
pixel outputs for every objective scene with selected pixels, recorded zero
expectation failures, and kept final numeric RGBA gates pending external
fixture or external-source-backed record materialization.
Subgoal 3.3 is complete in
`tmp/atmosphere/reconciliation/063-m3-shader-descriptor` and
`tmp/atmosphere/reconciliation/064-m3-shader-assembly`.
The POC now has a deterministic distant/spherical shader descriptor builder,
a generic `Algorithm32ShaderAssembler`, `ShaderCompatibilityValidator`,
`DistantSphericalShaderContributionFactory`, and a mechanical
`TextureBuilder`. Concrete distant/spherical behavior is supplied by owner
contributions; the assembler only validates symbols, orders fragments, and
emits GLSL. Local/flat GPU follow-on should add proper abstraction-owned
contributions and cache texture/access behavior without changing assembler
control flow. Record `064` accepted with zero failures and one allowed
unused-symbol warning for `light.sourceDirection`.
Subgoal 3.4 implementation is complete in
`tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run` and
`tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness`.
The POC now has `browser/BrowserShaderJobRunner.js`,
`browser/types.d.ts`, `runners/browserShaderWatcher.js`, an owned browser
page under `browser-page/`, and a JSON command file under `browser-jobs/`.
The dry-run record verifies command/progress/latest-file behavior without
launching Chromium. The diagnostics-readiness record verifies the browser page
and runner are wired for WebGL identity, precision/extensions, shader
compile/link logs, readback, PNG artifacts, timeout recovery, and progress
logging. Real browser execution is intentionally a user-run step:
`node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch`.
The first user-run watcher evidence is accepted in
`tmp/atmosphere/reconciliation/068-m3-browser-watcher-user-run-evidence`,
which snapshots `tmp/atmosphere/reconciliation/browser/001-capability-smoke`.
That browser run accepted with no page/fatal errors, WebGL2 on
`ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)`,
high-float precision `23`, clean shader compile/link logs, three selected
pixel readbacks, and screenshot/canvas PNG artifacts. Record
`067-m3-browser-watcher-user-run-evidence` is a rejected probe-shape attempt
caused by reading the wrong diagnostics file shape.
The watcher now echoes startup details, job transitions, completion status,
output paths, and periodic heartbeat status to the terminal in addition to
writing the canonical liveness packet at
`tmp/atmosphere/reconciliation/progress.json` for future runs.
Record `tmp/atmosphere/reconciliation/069-m3-browser-command-done-guard`
verifies that the watched command file now carries `status: "done"` and
completion metadata after the accepted run. Fresh watcher starts skip `done`
commands until the command file is replaced or edited back to a pending job.
Record `tmp/atmosphere/reconciliation/070-m3-browser-output-root-alignment`
changes the default watcher output root to `tmp/atmosphere/reconciliation`,
so future browser jobs produce normal `NNN-*` folders alongside the rest of
the lane records. The older `tmp/atmosphere/reconciliation/browser/001-*`
through `003-*` folders are legacy watcher output from before this correction.
Subgoal 3.5 has its first browser smoke evidence in
`tmp/atmosphere/reconciliation/071-m3-assembled-shader-browser-smoke` and
`tmp/atmosphere/reconciliation/072-assembled-distant-spherical-smoke`.
Record `071` submitted the current assembled distant/spherical Algorithm32
fragment shader through the user-run watcher and accepted all eight submitter
criteria. Record `072` is the browser-side artifact folder: WebGL2 context
was available, the assembled fragment source was present, vertex/fragment
compile and link logs were clean, three selected pixels were read back, both
PNG artifacts were written, and no page/fatal errors were reported. This is a
compile/link/readback smoke, not objective scene parity; the selected
readbacks were `[0, 0, 0, 255]`, so no rendered-pixel physics claim is made
from this run. The next 3.5 work is the real integrated objective scene
comparison using the validation scene set and CPU soft-shader outputs.
Records `073-m3-assembled-shader-visible-smoke` and
`074-assembled-distant-spherical-smoke` supersede that first black-smoke
diagnostic by using visible-range diagnostic browser bindings only. The
assembled shader source hash stayed
`693c3608dbc4377ec3793381cb44a43c04fe87560bb5ec61a65dd87ed5ef2901`; the
browser page now checks that at least one selected pixel is non-black. Record
`074` accepted 10/10 browser criteria with selected readbacks
`[174, 174, 174, 255]`, `[255, 255, 255, 255]`, and `[6, 6, 6, 255]`, and
wrote visible PNG artifacts. This remains compile/link/readback plumbing
evidence only, not objective scene parity or final rendering behavior.
Records `075-m3-integrated-objective-scene-comparison` and
`076-m3-integrated-objective-scene` add the first Subgoal 3.5.1 integrated
objective-scene browser run. The runner uses the accepted
`shader-lab-node-controlled-reference` scene from record `058`, passes its
Three camera inverse projection/view matrices and selected-pixel coordinates
to the browser job, and records CPU soft-shader selected-pixel output beside
GPU selected-pixel readback. The browser job accepted 12/12 criteria:
objective scene id, camera matrix bindings, assembled shader compile/link,
selected-pixel readback, visible output, and PNG artifacts. This is still not
parity: the GPU selected pixels were all `[179, 179, 179, 255]`, while the
CPU bridge distinguishes sky/card/ground pixels. The recorded implementation
gap is that the assembled shader still has only uniform
`uSceneTerminationMeters`; per-pixel depth/scene-hit termination and endpoint
composition must be integrated before objective scene parity can be claimed.
Records `077` through `086` iterate that shader path to the current accepted
selected-pixel result. Record `078` proves per-pixel depth termination reaches
the shader, separating sky/card/ground readbacks. Record `082` is a
high-gain diagnostic proving endpoint scale affects hit pixels. The root
cause of the remaining grayscale hit output was a browser harness texture
binding-order bug: while constructing the depth texture, the code temporarily
overwrote texture unit 0, so `uSceneColorTexture` sampled the depth texture.
Record `084` fixes texture creation/binding order and shows colored endpoint
contribution. Record `085-m3-integrated-scene-selected-pixel-parity` plus
browser artifact `086-m3-integrated-objective-scene` is the current accepted
POC gate: selected GPU pixels match CPU soft-shader byte RGBA within max
absolute delta `3` for the accepted Node/Three controlled scene. The selected
comparisons are sky CPU `[3, 2, 2, 255]` vs GPU `[5, 5, 5, 255]` with max
delta `3`, card CPU `[13, 10, 10, 255]` vs GPU `[13, 11, 9, 255]` with max
delta `1`, and ground CPU `[8, 6, 6, 255]` vs GPU `[9, 7, 5, 255]` with max
delta `1`. This remains a POC selected-pixel gate; final objective-scene
numeric RGBA gates still need external fixture or external-source-backed
materialization before final M3 parity closeout.
Records `087` through `092` correct the next integration gap: the browser PNG
must be a real Three scene render passing through the installed shader, not the
tiny synthetic fixture canvas from records `077` through `086`. Records
`087/088` and `089/090` are rejected import-path attempts while the already
running watcher could not load all local Three module files. The accepted path
copies `three.module.js` and `three.core.js` into
`browser-page/vendor/` for the current static server and also teaches
`BrowserShaderJobRunner` to serve the local Three module from `node_modules`
for future watcher restarts. Record
`091-m3-real-browser-three-scene-three-core` submits the first
`assembled-three-scene-comparison` command, and browser artifact
`092-m3-integrated-objective-scene` accepts the real browser Three path. The
browser now renders a 320x180 controlled Three scene into a render target,
builds a matching per-pixel hit-distance texture with `THREE.Raycaster`, binds
those full-scene textures into the assembled Algorithm32 shader, and writes a
scene-shaped `canvas-image.png` showing the ground plane, centered card, and
sky/background after shader composition. Selected readbacks are sky
`[4, 4, 4, 255]`, card `[13, 11, 9, 255]`, and ground
`[9, 7, 5, 255]`. This is the first real Three integration image, but it is
still a controlled POC scene and not the final external-fixture-backed M3
numeric parity gate.
Records `093` through `100` iterate that real scene until all visible pieces
are in place. Record `093/094` replaces equal-channel atmosphere shortcuts
with RGB-channel Rayleigh/Mie coefficients derived from the documented
Bruneton-style `lambda^-4` Rayleigh law and raises endpoint scale enough to
show object color; it exposes a hard vertical sky split. Record `095/096`
fixes the ray-frame mapping by converting browser Three scene directions into
the spherical observer-local frame (`scene X = east`, `scene Y = up`,
`scene -Z = north`), producing a coherent horizon/sky frame. Record `097/098`
replaces the one-midpoint view-medium shortcut with a 40-sample view-path loop,
so dense lower-atmosphere contribution reaches upward sky rays and produces a
continuous blue sky. Record `099-m3-real-three-scene-endpoint-exposure` plus
browser artifact `100-m3-integrated-objective-scene` tunes endpoint exposure so
the retained PNG shows all controlled-scene parts at once: blue sky, horizon
gradient, ground plane, centered card, per-pixel hit termination, and endpoint
scene color composition. Selected readbacks are sky `[112, 180, 231, 255]`,
card `[91, 80, 68, 255]`, and ground `[68, 53, 40, 255]`. This is the current
best real Three integration artifact.
For shader contribution assembly, first POC assemblies are plain objects
returned by the owning abstractions, not separate assembly classes per owner.
Unused provided symbols are warnings, including objective GPU runs; missing
required symbols and duplicate providers are setup failures unless explicitly
allowed.
For that active endpoint/depth pass, invalid depth in objective scenes follows
the log-and-continue rule: classify affected pixels as `invalid`, omit their
scene-hit contribution, and keep the run alive.
Bruneton 2017 and the
accepted Step 032 Bruneton-based color
adapter remain the primary authority for physical endpoint radiance
composition; broader color-science sources are reserved mainly for inverse
RGB-to-spectrum ambiguity.
The objective fixture tests must prove fixture values reach the rendered
pixels, not only the intermediate spectral packets. Each fixture scene should
compare fixture lookup, pre-display composed spectrum, expected display
RGB/RGBA produced by the validated Bruneton-based color adapter, and observed
CPU/GPU rendered pixels at selected pixels or controlled regions.
`agents/topics/apps/flat/reconciliation/shader-test-design.md` is now the
focused test-design home for these requirements. It defines the objective
scene families, how scenes are built, canonical fixture scene rules,
fixture-to-pixel propagation, diagnostics, and rendered-pixel acceptance.
The CPU postprocess soft-shader contract design questions are complete and
have been removed from the focused shader-design backlog. Its conclusions now
live in `shader-design.md#cpu-postprocess-shader`: baseline access is fixed to
`evaluate(...)`, implemented configuration endpoints, and the validated color
adapter; shader output packet shape belongs to shader/comparison diagnostics,
not the CPU soft-shader input contract; executable profile support follows
milestone needs; diagnostics are selected/aggregate/bounded-probe only, never
per rendered pixel; and scene input source support follows
`shader-test-design.md`. The GPU validation scene-set questions are complete
and now live in `shader-design.md#gpu-validation-scene-set` and
`shader-test-design.md`: objective/subjective scene separation, the
no-shadow-only Southern France review lineage, shared test-design tolerance
ownership, and themed composite objective scenes. Endpoint/depth semantics are
also settled in `shader-design.md#hit-data-itemization-and-routing`; the first
remaining shader-design backlog item is now Objective GPU verification
criteria.
Scene-object intersections are now classified as
geometry-boundary spatial inputs: scene inputs may carry finite hit facts or a
scene-intersection provider into `evaluate(...)`; geometry uses that context
for ray segmentation and future source/light path occlusion, while endpoint
radiance remains outside geometry for postprocess composition. That context is
optional: when no early scene-object termination is supplied, geometry already
has enough information to resolve the ray from its atmosphere, ground, and
domain-boundary rules. This is an additive Algorithm32 evaluation parameter,
but M3 must validate it before promotion: no-hit rays preserve baseline
behavior, finite scene hits shorten only geometry-resolved segments, and
endpoint radiance/color never feeds geometry or transport. This ray
termination is required for correct
scene-object color: `T_view` and `L_path` must be computed for the
viewer-to-object path before composition uses
`endpointRadiance * T_view + L_path`. The same contract is now mirrored in the production
Algorithm32 design. If a scene hit contributes color, material, or surface
radiance, that endpoint contribution travels beside the spatial hit facts but
goes to the color/display or postprocess composition boundary; geometry
receives only spatial hit context for segment length and occlusion. General M3
rule: scene-derived effects that affect Algorithm32 are routed by
descriptor/setup configuration and compiled by the adapter into typed request
or composition fields. `evaluate(...)` must not receive caller-supplied
owner/route labels or RGB/display color; contributions without a
descriptor-declared owner should be rejected by setup or scene-input
validation. The scene set must produce CPU soft-shader objective outputs and
GPU shader outputs against the same objective scene claims; CPU-vs-GPU
comparison is secondary evidence. The scene set must separate objective
hypothesis/fact scenes from subjective plausibility-review scenes. Subjective
review should borrow the latest accepted local-second-order scene lineage.
Shader-lab and
local-second-order code are
scene-input/composition/scene references only. M2 background:
Subgoal 2.0 is complete in
`tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`. The
projection decision is recorded in
`tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`: use
north-polar azimuthal equidistant for flat geometry, source projection facts to
PROJ, and keep the exact Earth-radius value as source-precision pending. The
atmosphere-boundary ownership correction is recorded in
`tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`: flat
geometry may calculate ray exits against a supplied atmosphere/profile domain,
but it must not choose `topAltitudeMeters`. Cutoff tolerance guidance is
recorded in `tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification`.
POC runtime boundary diagnostics are recorded in
`tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics`: a
valid setup binding must exist before rendering, but per-sample unexpected
cache misses or out-of-domain accesses should return a safe empty/zero
contribution and log bounded diagnostics instead of aborting a long render.
That policy is generalized in
`tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy` to any
unexpected per-sample runtime boundary condition, including ray/source-path
bounds, atmosphere-domain misses, cache misses, out-of-domain coordinates, or
non-finite path/access facts. Flat/local path integration controls are planned
for experimental selection in
`tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan`: seed
from accepted Algorithm32 packets, sweep hard flat/local rays, and promote
runtime/validation packets only from convergence diagnostics. Record
`tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate` makes these
experiments a specific M2 subgoal before real asset generation: path
integration convergence, geometry ray-length candidate-selection checks
including observer-centered dome exit and any interim no-hit cutoff
convergence,
coordinate handoff/runtime-boundary diagnostics, and local cache direct/oracle
edge checks if local L2 is enabled. The
atmosflat32 Step 018 sky-dome artifacts are guide images and diagnostic
comparison material, not canonical exact-match targets. Do not reshape the
main evaluator/calculator/cache lifecycle for Milestone 2 unless a defect is
found and recorded.

Subgoals 2.1 through 2.5 are now run:
`025-m2-flat-geometry-profile` accepted analytic flat geometry and z/rho cache
access checks; `026-m2-local-sun-source` accepted local source packet,
inverse-square falloff, closest-approach calibration, and neutral/no-tint
spectral behavior; `027-m2-local-flat-cpu` accepted selected local/flat
spectral CPU rays; `028-m2-pre-asset-experiments` accepted the pre-asset gate
run, including local cache direct/oracle matching for the selected cache point
with 315 built coordinates; `029-m2-local-flat-assets` generated and retained
five full-size 320px diagnostic PNGs, and `030-m2-local-flat-assets-quick-rerun`
generated five reduced-size PNGs as a clean CLI rerun. `031` and `032` are
rejected stack-comparison attempts; `033-m2-local-flat-stack-comparison`
generated the accepted three-column comparison stack from the record 029
full-size PNGs. `034` is a rejected selected-ray coordinate-warning probe,
`035` diagnoses the warnings as source-path samples launched from a view ray
endpoint at `100000.00000000001` meters, `036` is the interrupted slow
post-fix scan, and `037` verifies the boundary-tolerance fix with zero
reproduced out-of-domain events at the known trigger pixel. `038` regenerates
the five full-size local/flat PNGs with the fix in place. `039` creates the
six-column stack in the requested order: atmosflat, record 029, atmosflat vs
029 diff, latest domes, atmosflat vs latest diff, and 029 vs latest diff. The
029 vs latest max absolute RGBA delta is 0 for all five scenes. `040`
implements the observer-centered finite-dome geometry profile with
`apexAltitudeMeters: 60000` and
`maxObserverViewRayExtentMeters: 875656.6450361694`, deriving a sphere center
at `[0, 0, -6360000]` and radius `6420000`; it regenerates the five full-size
320px local/flat PNGs and records max Step 018 guide delta 41. Its shell
wrapper timed out after the accepted result and artifacts were written. `041`
creates the requested 804x1728 two-column stack with atmosflat guide imagery
beside the new observer-centered finite-dome imagery and no diff column. `042`
creates the requested 1144x1728 three-column stack with atmosflat, latest
observer-dome imagery, and absolute diff x3; per-row max absolute RGBA deltas
are 13, 18, 29, 38, and 41. `043` renders the five additional
San-Jose-longitude summer-solstice latitude skydomes at 80N, 30N, equator,
30S, and 80S; this set has no guide-image comparison target. `044` defines
and renders the synchronized-noon north-up variant of that latitude sweep,
including five flat finite-source PNGs, five matching spherical distant-source
PNGs, and a final two-column flat-left/spherical-right stack. `045` adds
the Greenwich-noon clock variant while keeping the render
longitude at San Jose, adds per-image Sun azimuth/altitude captions, and
renders a fresh flat-left/spherical-right stack. `046` makes the reusable
default a 45-degree-east solar-noon clock at source longitude `-76.8863`,
keeps the Sun off the vertical meridian, keeps the spherical Sun above the
horizon through `30S`, and renders a fresh captioned flat-left/spherical-right
stack. `047` defines and renders the North Pole summer-solstice 2026 GMT
four-hour sweep. `048` renders the South Pole winter-solstice 2025
counterpart as six captioned flat/spherical rows. No record
promotes final local/flat numerical controls or exact Step 018 image parity.

Milestone 1 populated the parameter/provenance ledger,
implemented the `SpectralCalculator.computeRadiance(...)` loop and helper
invariants, added concrete `CanonicalAtmosphere`, `SphericalEarthGeometry`,
and `DistantSunLightSource` implementations, and built/bound/sampled the
distant L2 incident-radiance cache through the generic coordinator. Record
`tmp/atmosphere/reconciliation/016-step032-full-image-comparison` generated all
four full-size 320px Figure 1 sky-dome PNGs with the cache-backed CPU path,
retained them under the record `artifacts/` folder, and matched the accepted
Step 032 decoded RGBA targets exactly.

Subgoal 1.0 added `evaluation/SpectralReferenceEvaluator.js` as the
spectral-only main algorithm coordinator, tightened the ambient contracts, and
kept rendering, comparison, and color output outside transport.
The abstraction contracts now use ambient `interface` declarations; value
packets and descriptors remain `type` aliases where appropriate. Interface
behavior members now use regular method signatures rather than properties with
function types. These refinements are recorded in
`tmp/atmosphere/reconciliation/002-interface-contract-declarations` and
`tmp/atmosphere/reconciliation/003-interface-method-signatures`. The expanded
Milestone 1 scope is recorded in
`tmp/atmosphere/reconciliation/004-milestone1-full-algorithm32-scope`.
The shared constants decision and module are recorded in
`tmp/atmosphere/reconciliation/005-shared-baseline-constants`.
The M1 artifact-display conversion ownership decision is recorded in
`tmp/atmosphere/reconciliation/006-artifact-renderer-display-conversion`.
The exact-match and renderer-port decision is recorded in
`tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity`.
The POC class naming decision is recorded in
`tmp/atmosphere/reconciliation/008-poc-clear-class-names`.
The M1 record-granularity decision is recorded in
`tmp/atmosphere/reconciliation/009-m1-granular-record-strategy`.
The CLI experiment-run record rule is recorded in
`tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule`.
The M1 parameter/provenance extraction is recorded in
`tmp/atmosphere/reconciliation/011-parameter-provenance-extraction`.
The M1 transport helper invariants are recorded in
`tmp/atmosphere/reconciliation/012-transport-helper-invariants`.
The concrete distant/spherical CPU selected-ray run is recorded in
`tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run`.
The distant L2 cache build/bind/sample run is recorded in
`tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample`.
The first reduced-size sky-dome artifact run is recorded in
`tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts`.
The full-size Step 032 image-comparison run is recorded in
`tmp/atmosphere/reconciliation/016-step032-full-image-comparison`.
The M2 reference-gap carry-forward and tracker snapshot is recorded in
`tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`.
The M2 north-polar azimuthal-equidistant projection source decision is recorded
in `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`.
The M2 atmosphere-boundary ownership correction is recorded in
`tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`.
The M2 cutoff-tolerance justification guidance is recorded in
`tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification`.
The M2 POC runtime boundary diagnostics policy is recorded in
`tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics`.
The M2 generalized runtime-boundary policy is recorded in
`tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy`.
The M2 path-integration convergence plan is recorded in
`tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan`.
The M2 pre-asset experiment gate is recorded in
`tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate`.
The code reference-trail rule is active: implementation files should keep
compact file-level `References:` comments that are directly resolvable later.
The chosen scheme is a good-enough inline trail, not `[n]` citations against a
separate reference index. Detailed source trails stay in numbered records and
provenance artifacts.

## Scaffold Contents

- `src/index.js`: importable scaffold surface.
- `src/types.d.ts`: shared ambient value packets.
- `src/evaluation/SpectralReferenceEvaluator.js`: spectral-only main
  evaluator over abstract model contracts.
- `src/evaluation/types.d.ts`: evaluator request/output/config packets.
- `src/calculator/SpectralCalculator.js`: shared calculator shell with the
  endpoint/trapezoid path-integration-point helper, radiance loop, and
  calculation helpers.
- `src/atmosphere/CanonicalAtmosphere.js`: canonical atmosphere profile.
- `src/geometry/SphericalEarthGeometry.js`: spherical Earth geometry,
  including a POC Three endpoint factory for geometry-owned spherical ground
  objects.
- `src/geometry/FlatEarthGeometry.js`: M2 flat z-up geometry with supplied
  top-altitude clipping, observer-centered finite-dome ray exits, legacy
  view-ray cap fallback handling, local source-relative packets, z/rho cache
  access, and bounded runtime diagnostics.
- `src/light/DistantSunLightSource.js`: distant Sun light-source model.
- `src/light/LocalSunLightSource.js`: M2 finite local-source model using
  geometry-owned source-relative packets, neutral spectral scale, finite source
  path limits, and local cache creation.
- `src/incident-radiance/DistantSunIncidentRadianceCache.js`: distant L2
  incident-radiance cache.
- `src/incident-radiance/LocalSunIncidentRadianceCache.js`: M2 local z/rho
  incident-radiance cache with cache-owned coordinate generation and
  nearest-neighbor sampler.
- `src/math/vector.js`: small vector utility module.
- `src/provenance/buildParameterLedger.js`: M1 parameter ledger emitter.
- `src/provenance/types.d.ts`: parameter ledger entry declarations.
- `src/constants/consts.js`: shared active-baseline constants for atmosphere,
  artifact rendering, source setup, Figure 1 scenes/rendering, and numerical
  controls.
- `src/constants/types.d.ts`: ambient constant packet declarations.
- `src/outputs/types.d.ts`: post-transport spectral image output packet home.
- `src/outputs/Figure1SkyDomeRenderer.js`: Figure 1 sky-dome artifact
  renderer with fisheye projection, display conversion, byte packing, PNG
  output, and optional row-level render progress callbacks for live runner
  logs.
- `src/outputs/Step018SkydomeImageWriter.js`: local/flat diagnostic skydome
  writer that reuses the spectral renderer path outside transport.
- `src/outputs/pngWriter.js`: raw RGBA PNG writer used by the artifact
  renderer.
- `src/comparison/types.d.ts`: post-transport image comparison packet home.
- `src/comparison/ImageComparison.js`: decoded RGBA image comparison class for
  exact Step 032 parity.
- `src/three/ExactSphereGroundObject.js`: Three `Object3D` with exact
  ray/sphere `raycast(...)` for geometry-owned spherical ground endpoint
  capture.
- `src/setup/buildIncidentRadianceCache.js`: generic cache-build coordinator
  shell.
- `src/incident-radiance/noIncidentRadiance.js`: canonical omitted-cache
  support value.
- `src/validation/validateModelSet.js`: fail-loud required-method validation.
- `src/validation/validateNoHistoricalRuntimeLinks.js`: guardrail scan for
  runtime links to preserved historical code locations.
- `src/runners/smoke.js`: lightweight import and invariant check.
- `src/runners/contractProbe.js`: M1 Subgoal 1.0 abstraction-closure probe.
- `src/runners/m1ParameterProvenance.js`: record 011 experiment runner.
- `src/runners/m1TransportHelperInvariants.js`: record 012 experiment runner.
- `src/runners/m1ConcreteDistantSpherical.js`: record 013 experiment runner.
- `src/runners/m1DistantL2Cache.js`: record 014 experiment runner.
- `src/runners/m1FirstSkyDomeArtifacts.js`: record 015 first sky-dome
  artifact runner; appends live per-scene and per-render-row progress for
  future runs.
- `src/runners/m1Step032ImageComparison.js`: record 016 full-size Step 032
  image comparison runner; appends live per-scene, per-render-row, and
  comparison progress for future runs.
- `src/runners/createM1Models.js`: shared concrete M1 setup helper.
- `src/runners/createM2Models.js`: shared concrete M2 local/flat setup helper.
- `src/runners/m2FlatGeometryProfile.js`: record 025 flat geometry runner.
- `src/runners/m2LocalSunSource.js`: record 026 local source runner.
- `src/runners/m2LocalFlatCpu.js`: record 027 local/flat CPU runner.
- `src/runners/m2PreAssetExperiments.js`: record 028 pre-asset experiment
  gate runner.
- `src/runners/m2LocalFlatAssets.js`: records 029, 030, 038, and 040
  local/flat
  diagnostic asset runner; appends live per-scene, per-render-row, and
  guide-comparison progress for future runs. It defaults to the Step 018
  rotation scene set and can render the additional subjective summer-solstice
  latitude set with
  `--scene-set san-jose-longitude-summer-solstice-latitude-sweep`.
- `src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js`: records 044
  through 048 synchronized-clock latitude/time-sweep renderer; renders
  reusable north-up flat/spherical scene sets, saves flat PNGs, spherical
  PNGs, and a flat-left/spherical-right stack while logging per-row render
  progress. Record 046 makes the default scene set the 45-degree-east clock
  variant; record 047 adds optional time row labels for GMT clock sweeps.
- `src/runners/m2LocalFlatStackComparison.js`: records 031 through 033
  and 042 local/flat diagnostic stack-comparison runner; appends diff-loop
  and composite progress for future runs.
- `src/runners/m2LocalFlatWarningFixStackComparison.js`: record 039
  six-column post-warning-fix diagnostic stack runner.
- `src/runners/m2LocalFlatGuideSideBySideStack.js`: record 041 two-column
  atmosflat/new diagnostic stack runner without a diff column.
- `src/runners/m2CoordinateWarningProbe.js`: records 034 through 037
  coordinate-warning diagnostic and fix-check runner; appends selected-ray,
  targeted-trigger, and full-pixel-scan progress for future runs.
- `src/runners/recordWriter.js`: experiment record writer helper, including
  `appendRunLog(...)` for live progress logs.

## Target Roots

All target roots were present when Milestone 0 scaffold work started:

- `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`
- `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`
- `tmp/atmosphere/algorithm32_shader_lab`
- `tmp/atmosphere/local-second-order`

The Step 032 Bruneton start-fresh sky dome/four-view root is the hard artifact
target for Milestone 1. The comparison criterion is exact decoded RGBA match
against all four accepted PNGs: same dimensions, `maxAbsRgbaDelta = 0`,
`mismatchedByteCount = 0`, and `mismatchedPixelCount = 0`. The M1 artifact
renderer should port the accepted Bruneton start-fresh runner rendering path
for projection, sky-disc masking, display conversion, byte packing, and PNG
writing, adapting only the spectral transport data source to the new POC path.

## Deferred Work

- Add concrete flat geometry and local light-source classes in Milestone 2,
  reusing the Milestone 1 evaluator/calculator/cache lifecycle. Start with
  Subgoal 2.1 flat geometry; Subgoal 2.0 planning/evidence carry-forward is
  complete.
- Add local/flat artifact rendering and diagnostic comparison against
  atmosflat32 Step 018 guide artifacts. These images help inspect behavior,
  but Milestone 2 acceptance comes from method confidence rather than exact
  pixel parity with those historical sky domes.
- Add shader classes in their planned milestones. Cache textures are owned by
  the incident-radiance cache and created through `TextureBuilder`; browser
  watcher/capture code belongs to the experiment-runner side, not the shader
  operation design.
- Refine class names during production promotion only when a clearer accepted
  API name is worth the churn.

## Verification

- `node scripts/flat/reconciliation/POC/src/runners/contractProbe.js`
  - status: pass
  - output kind: spectral
  - path integration point count: 3
  - incomplete model contract rejected: true
- `node scripts/flat/reconciliation/POC/src/runners/smoke.js`
  - status: pass
  - integration point count: 5
  - cache build coordinate count: 1
  - shared constants imported and checked: true
- `node scripts/flat/reconciliation/POC/src/runners/m1ParameterProvenance.js --record tmp/atmosphere/reconciliation/011-parameter-provenance-extraction`
  - status: accepted
  - ledger entry count: 18
  - unresolved entry count: 0
- `node scripts/flat/reconciliation/POC/src/runners/m1TransportHelperInvariants.js --record tmp/atmosphere/reconciliation/012-transport-helper-invariants`
  - status: accepted
  - invariant count: 6
  - integration point count: 5
- `node scripts/flat/reconciliation/POC/src/runners/m1ConcreteDistantSpherical.js --record tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run`
  - status: accepted
  - selected scene/ray diagnostic count: 8
- `node scripts/flat/reconciliation/POC/src/runners/m1DistantL2Cache.js --record tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample`
  - status: accepted
  - cache coordinate count: 408
  - mean incident delta: 0.003669424537625155
- `node scripts/flat/reconciliation/POC/src/runners/m1FirstSkyDomeArtifacts.js --record tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts --size 96`
  - status: accepted
  - artifact count: 4
  - size: 96x96
  - cache mode: none
  - exact Step 032 parity: unresolved
- `node scripts/flat/reconciliation/POC/src/runners/m1Step032ImageComparison.js --record tmp/atmosphere/reconciliation/016-step032-full-image-comparison --size 320`
  - status: accepted
  - artifact count: 4
  - size: 320x320
  - cache mode: distant L2
  - exact match count: 4
  - max absolute RGBA delta: 0
  - mismatched byte count: 0
  - mismatched pixel count: 0
- `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`
  - status: accepted
  - runtime domain code changed: false
  - calibration tracker item count: 6
  - external evidence tracker item count: 13
  - initial implementation default count: 13
  - Step 018 canonical acceptance target: false
- `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`
  - status: accepted
  - runtime domain code changed: false
  - projection choice: north-polar azimuthal equidistant
  - projection source: PROJ `+proj=aeqd`
  - Earth radius source precision: pending
- `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`
  - status: accepted
  - runtime domain code changed: false
  - atmosphere/profile owns top altitude: true
  - geometry calculates ray exits against supplied domain boundaries: true
  - no-hit sky cap owner: renderer/view-ray policy
- `tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification`
  - status: accepted
  - runtime domain code changed: false
  - spectral convergence remains primary: true
  - human visibility is secondary display support: true
- `tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics`
  - status: accepted
  - runtime domain code changed: false
  - setup incompatibilities fail before render: true
  - per-sample runtime boundary misses degrade with diagnostics: true
- `tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy`
  - status: accepted
  - runtime domain code changed: false
  - cache-specific policy generalized to all unexpected runtime boundaries:
    true
- `tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan`
  - status: accepted
  - runtime domain code changed: false
  - path integration controls selected by future convergence experiments: true
- `tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate`
  - status: accepted
  - runtime domain code changed: false
  - pre-asset experiment subgoal added before real asset generation: true
- `node scripts/flat/reconciliation/POC/src/runners/m2FlatGeometryProfile.js --record tmp/atmosphere/reconciliation/025-m2-flat-geometry-profile`
  - status: accepted
  - selected scene: `san-jose-000deg-closest`
  - runtime diagnostic count: 1
  - flat altitude, ground/top/view cap, source-relative, source path, and
    z/rho cache-access checks passed
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalSunSource.js --record tmp/atmosphere/reconciliation/026-m2-local-sun-source`
  - status: accepted
  - diagnostic scene count: 5
  - closest incident scale: `1.0000000000000002`
  - neutral/no-tint spectral scaling verified
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatCpu.js --record tmp/atmosphere/reconciliation/027-m2-local-flat-cpu`
  - status: accepted
  - selected scene/ray diagnostic count: 9
  - no image artifacts generated
- `node scripts/flat/reconciliation/POC/src/runners/m2PreAssetExperiments.js --record tmp/atmosphere/reconciliation/028-m2-pre-asset-experiments`
  - status: accepted
  - path convergence row count: 12
  - no-hit cap row count: 5
  - local cache coordinate count: 315
  - selected local cache direct/oracle max absolute delta: 0
  - final local/flat numerical controls promoted: false
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record tmp/atmosphere/reconciliation/029-m2-local-flat-assets --size 320`
  - record status: accepted
  - shell status: timed out after accepted result and artifacts were written
  - artifact count: 5 full-size 320px PNGs retained under `artifacts/`
  - exact Step 018 guide match count: 0
  - max absolute RGBA delta against guide images: 91
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record tmp/atmosphere/reconciliation/030-m2-local-flat-assets-quick-rerun --size 96`
  - status: accepted
  - artifact count: 5 reduced-size PNGs retained under `artifacts/`
  - exact Step 018 guide match count: 0
  - max absolute RGBA delta against guide images: 255
  - latest clean CLI completion before Subgoal 2.6
- `tmp/atmosphere/reconciliation/031-m2-local-flat-stack-comparison`
  - status: rejected
  - attempted stack-comparison record remained incomplete
  - artifact count: 0
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatStackComparison.js --record tmp/atmosphere/reconciliation/032-m2-local-flat-stack-comparison --source-record tmp/atmosphere/reconciliation/029-m2-local-flat-assets`
  - status: rejected
  - failure: raw RGBA diff buffers were passed to `sharp.composite` without
    raw image metadata
  - artifact count: 0
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatStackComparison.js --record tmp/atmosphere/reconciliation/033-m2-local-flat-stack-comparison --source-record tmp/atmosphere/reconciliation/029-m2-local-flat-assets`
  - status: accepted
  - artifact: `artifacts/local-flat-skydome-side-by-side-stack.png`
  - dimensions: 1144x1728
  - rows: 5 full-size 320px rotation skydomes
  - columns: atmosflat Step 018 guide, reconciliation M2, absolute diff x3
- `node --check scripts/flat/reconciliation/POC/src/runners/m2LocalFlatStackComparison.js`
  - status: pass
- `tmp/atmosphere/reconciliation/034-m2-coordinate-warning-diagnostics`
  - status: rejected
  - selected rim/horizon ray probe did not reproduce record 029 coordinate
    warnings
- `node scripts/flat/reconciliation/POC/src/runners/m2CoordinateWarningProbe.js --record tmp/atmosphere/reconciliation/035-m2-coordinate-warning-diagnostics`
  - status: accepted
  - reproduced out-of-domain coordinate event count: 60
  - all reproduced events came from `resolveAtmospherePath(...)`
  - first trigger: pixel `x=141, y=16`, view ray endpoint at the 100000 m top
    boundary, source-path start altitude `100000.00000000001`
- `tmp/atmosphere/reconciliation/036-m2-coordinate-warning-fix-check`
  - status: rejected
  - interrupted full-skydome no-warning scan after the boundary fix
- `node scripts/flat/reconciliation/POC/src/runners/m2CoordinateWarningProbe.js --record tmp/atmosphere/reconciliation/037-m2-coordinate-warning-fix-check --expect-no-warnings`
  - status: accepted
  - reproduced out-of-domain coordinate event count: 0
  - verified the known trigger pixel and selected rim/horizon rays across all
    five M2 local/flat scenes
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets --size 320`
  - status: accepted
  - artifact count: 5 full-size 320px PNGs retained under `artifacts/`
  - exact Step 018 guide match count: 0
  - max absolute RGBA delta against guide images: 91
  - live progress logged to `run.log` from inside the render loop
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatWarningFixStackComparison.js --record tmp/atmosphere/reconciliation/039-m2-warning-fix-six-column-stack --baseline-record tmp/atmosphere/reconciliation/029-m2-local-flat-assets --latest-record tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets`
  - status: accepted
  - artifact: `artifacts/local-flat-warning-fix-six-column-stack.png`
  - dimensions: 2164x1728
  - rows: 5 full-size 320px rotation skydomes
  - columns: atmosflat, 029, diff atmosflat/029, latest, diff
    atmosflat/latest, diff 029/latest
  - record 029 vs latest max absolute RGBA delta: 0 for all five rows
  - visual inspection confirmed the requested column order
- M2 observer-centered finite-dome geometry probe
  - status: pass
  - checked: record 040 seed descriptor derives
    `sphereCenterMeters: [0, 0, -6360000]` and
    `sphereRadiusMeters: 6420000`
  - zenith view-ray end distance: `59998`
  - horizon view-ray end distance: `875656.6450361694`
  - downward ground view-ray end distance: `2`
  - legacy scalar cap retained only as fallback seed:
    `sceneSkyRayLimitMeters: 1926774`
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record tmp/atmosphere/reconciliation/040-m2-observer-centered-dome-local-flat-assets --size 320 --scene-set step018-rotation`
  - record status: accepted
  - shell status: timed out after accepted result and all artifacts were
    written
  - artifact count: 5 full-size 320px PNGs retained under `artifacts/`
  - exact Step 018 guide match count: 0
  - max absolute RGBA delta against guide images: 41
  - live progress logged to `run.log` from inside the render loop
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatGuideSideBySideStack.js --record tmp/atmosphere/reconciliation/041-m2-observer-centered-dome-side-by-side-stack --source-record tmp/atmosphere/reconciliation/040-m2-observer-centered-dome-local-flat-assets`
  - status: accepted
  - artifact: `artifacts/local-flat-observer-dome-side-by-side-stack.png`
  - dimensions: 804x1728
  - rows: 5 full-size 320px rotation skydomes
  - columns: atmosflat Step 018 guide, observer-centered finite-dome
    reconciliation POC
  - diff column: omitted by request
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatStackComparison.js --record tmp/atmosphere/reconciliation/042-m2-observer-centered-dome-diff-stack --source-record tmp/atmosphere/reconciliation/040-m2-observer-centered-dome-local-flat-assets`
  - status: accepted
  - artifact: `artifacts/local-flat-skydome-side-by-side-stack.png`
  - dimensions: 1144x1728
  - rows: 5 full-size 320px rotation skydomes
  - columns: atmosflat Step 018 guide, observer-centered finite-dome
    reconciliation POC, absolute diff x3
  - per-row max absolute RGBA delta: `13`, `18`, `29`, `38`, `41`
- `node scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js --record tmp/atmosphere/reconciliation/043-m2-summer-solstice-latitude-skydomes --size 320 --scene-set san-jose-longitude-summer-solstice-latitude-sweep`
  - status: accepted
  - artifact count: 5 full-size 320px PNGs retained under `artifacts/`
  - guide comparison: not applicable for this subjective scene set
  - rendered files:
    `flat-app-skydome-summer-solstice-080n-closest.png`,
    `flat-app-skydome-summer-solstice-030n-closest.png`,
    `flat-app-skydome-summer-solstice-equator-closest.png`,
    `flat-app-skydome-summer-solstice-030s-closest.png`,
    `flat-app-skydome-summer-solstice-080s-closest.png`
- `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record tmp/atmosphere/reconciliation/044-m2-synchronized-noon-flat-spherical-skydomes --size 320`
  - status: accepted
  - artifact count: 11 full-size PNGs retained under `artifacts/`
  - final stack:
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`
  - rows: observer latitudes `80N`, `30N`, equator, `30S`, and `80S`
  - columns: flat finite local-source rendering on the left, spherical
    distant-source rendering on the right
  - orientation: north-up for all source images, using `x=east`, `y=north`,
    `z=up`
  - timing: every row shares the same summer-solstice synchronized solar-noon
    source longitude at San Jose longitude; brightness uses the same
    source-latitude calibration as record 043
  - notable expected behavior: the 80S spherical row is dark because the
    distant Sun is below the spherical horizon at northern summer solar noon,
    while the finite flat source remains above the flat horizon
- `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record tmp/atmosphere/reconciliation/045-m2-greenwich-noon-flat-spherical-skydomes --size 320`
  - status: accepted
  - artifact count: 11 full-size PNGs retained under `artifacts/`
  - scene set:
    `san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`
  - final stack:
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`
  - rows: observer latitudes `80N`, `30N`, equator, `30S`, and `80S`
  - columns: flat finite local-source rendering on the left, spherical
    distant-source rendering on the right
  - orientation: north-up for all source images, using `x=east`, `y=north`,
    `z=up`
  - timing: observer/render longitude remains San Jose (`-121.8863`), while
    the synchronized solar-noon/source-subpoint longitude is `0`
  - labels: every stacked image includes Sun azimuth clockwise from north and
    altitude above the horizon
  - notable expected behavior: only the 80N spherical row is lit; the other
    spherical rows are dark because the distant Sun is below the spherical
    horizon at the Greenwich-noon render time, while the finite flat source
    remains above the flat horizon for all rows
- `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record tmp/atmosphere/reconciliation/046-m2-45east-noon-flat-spherical-skydomes --size 320`
  - status: accepted
  - artifact count: 11 full-size PNGs retained under `artifacts/`
  - scene set:
    `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`
  - final stack:
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`
  - rows: observer latitudes `80N`, `30N`, equator, `30S`, and `80S`
  - columns: flat finite local-source rendering on the left, spherical
    distant-source rendering on the right
  - orientation: north-up for all source images, using `x=east`, `y=north`,
    `z=up`
  - timing: observer/render longitude remains San Jose (`-121.8863`), while
    the synchronized solar-noon/source-subpoint longitude is `-76.8863`
  - labels: every stacked image includes Sun azimuth clockwise from north and
    altitude above the horizon
  - notable expected behavior: the spherical Sun is above the horizon through
    `30S`; the `80S` spherical row is dark because the distant Sun is still
    below the spherical horizon at northern-summer 45-degree-east-noon
- `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record tmp/atmosphere/reconciliation/047-m2-north-pole-summer-solstice-gmt-sweep --size 320 --scene-set north-pole-summer-solstice-2026-gmt-4hour-sweep`
  - status: accepted
  - artifact count: 13 full-size PNGs retained under `artifacts/`
  - scene set: `north-pole-summer-solstice-2026-gmt-4hour-sweep`
  - final stack:
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`
  - rows: `00:00 GMT`, `04:00 GMT`, `08:00 GMT`, `12:00 GMT`, `16:00 GMT`,
    and `20:00 GMT`
  - columns: flat finite local-source rendering on the left, spherical
    distant-source rendering on the right
  - render location: latitude `90N`, longitude `0`, sea-level elevation
  - source/time sync: date `2026-06-21`; source latitude `23.5N`; source
    longitudes `180`, `120`, `60`, `0`, `-60`, and `-120`
  - labels: every stacked image includes Sun azimuth clockwise from north and
    altitude above the horizon; stack row labels show UTC time
  - notable expected behavior: the spherical distant Sun altitude stays
    `23.5 deg` for all rows, while azimuth rotates every four hours
- `node scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js --record tmp/atmosphere/reconciliation/048-m2-south-pole-winter-solstice-gmt-sweep --size 320 --scene-set south-pole-winter-solstice-2025-gmt-4hour-sweep`
  - status: accepted
  - artifact count: 13 full-size PNGs retained under `artifacts/`
  - scene set: `south-pole-winter-solstice-2025-gmt-4hour-sweep`
  - final stack:
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`
  - rows: `00:00 GMT`, `04:00 GMT`, `08:00 GMT`, `12:00 GMT`, `16:00 GMT`,
    and `20:00 GMT`
  - columns: flat finite local-source rendering on the left, spherical
    distant-source rendering on the right
  - render location: latitude `90S`, longitude `0`, sea-level elevation
  - source/time sync: date `2025-12-21`; source latitude about `23.4995S`;
    source longitudes `180`, `120`, `60`, `0`, `-60`, and `-120`
  - labels: every stacked image includes Sun azimuth clockwise from north and
    altitude above the horizon; stack row labels show UTC time
  - notable expected behavior: the spherical distant Sun altitude stays about
    `23.5 deg` for all rows, while the flat local-source altitude ranges from
    about `8.4 deg` to `33.1 deg`
- `node --check scripts/flat/reconciliation/POC/src/runners/m2CoordinateWarningProbe.js`
  - status: pass
- `node --check scripts/flat/reconciliation/POC/src/runners/m2LocalFlatWarningFixStackComparison.js`
  - status: pass
- `node --check scripts/flat/reconciliation/POC/src/constants/consts.js`
  - status: pass
  - checked: additional closest-approach, synchronized-noon, Greenwich-noon,
    45-degree-east-noon, North Pole summer-solstice GMT, and deferred South
    Pole winter-solstice GMT scene set constants
- `node --check scripts/flat/reconciliation/POC/src/runners/m2SynchronizedNoonFlatSphericalSkydomes.js`
  - status: pass
  - checked: north-up synchronized-clock flat/spherical skydome runner with
    per-image Sun captions
- `node --check scripts/flat/reconciliation/POC/src/runners/m2LocalFlatAssets.js`
  - status: pass
  - checked: selectable scene-set rendering path
- `node --check scripts/flat/reconciliation/POC/src/runners/createM2Models.js`
  - status: pass
  - checked: scene-set summary export
- `node --input-type=module -e "import { M2_LOCAL_FLAT_SEED_CONSTANTS } from './scripts/flat/reconciliation/POC/src/index.js'; const set = M2_LOCAL_FLAT_SEED_CONSTANTS.sceneSets['san-jose-longitude-summer-solstice-latitude-sweep']; const c = set.sourceBrightnessCalibration; console.log(JSON.stringify({id:set.id,count:set.scenes.length,guide:set.guideComparisonAvailable,latitudes:set.scenes.map(s=>s.observerLatitudeDegrees),longitudes:[...new Set(set.scenes.map(s=>s.observerLongitudeDegrees))],sourceLatitudes:[...new Set(set.scenes.map(s=>s.sourceSubpointLatitudeDegrees))],sourceLatitudeModel:set.scenes[0].sourceLatitudeModel.type,sourceLatitudeResolvedAt:set.scenes[0].sourceLatitudeResolvedAt,calibrationLatitude:c.calibrationObserverLatitudeDegrees,calibrationFalloff:c.calibrationDistanceFalloffScale,calibrationReferenceScale:c.referenceSpectralIncidentScale,sceneReferenceScales:[...new Set(set.scenes.map(s=>s.referenceSpectralIncidentScale))]}));"`
  - status: pass
  - scene set: `san-jose-longitude-summer-solstice-latitude-sweep`
  - scene count: 5
  - guide comparison available: false
  - observer latitudes: `80`, `30`, `0`, `-30`, `-80`
  - observer longitudes: all `-121.8863`
  - source latitude model: `annual-tropic-migration`
  - source latitude resolved at: `2026-06-21T12:00:00-07:00`
  - resolved source latitude: `23.5`
  - source brightness calibration latitude: `23.5`
  - source brightness calibration falloff: `0.988434006056616`
  - source brightness calibration reference spectral incident scale:
    `1.0117013314723224`
  - all latitude-sweep scenes reuse that same reference spectral incident
    scale
- Model-level probe for the summer-solstice latitude sweep
  - status: pass
  - checked: `createM2LocalFlatModels(scene)` passes each scene's shared
    calibration reference scale into `LocalSunLightSource`
  - max absolute incident-scale reconstruction delta: below
    `3e-16`
- Metadata probe for the synchronized-noon flat/spherical latitude sweep
  - status: pass
  - scene set:
    `san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep`
  - scene count: 5
  - guide comparison available: false
  - observer latitudes: `80`, `30`, `0`, `-30`, `-80`
  - observer longitudes: all `-121.8863`
  - source subpoint longitudes: all `-121.8863`
  - resolved source latitude: `23.5`
  - sky orientation: `north-up`
  - horizontal frame: `observer-local-east-north-up`
  - spherical altitudes: `33.5`, `83.50000000000003`, `66.5`,
    `36.500000000000014`, `-13.499999999999991`
  - source brightness calibration latitude: `23.5`
  - source brightness calibration reference spectral incident scale:
    `1.0117013314723224`
  - all synchronized-noon scenes reuse that same reference spectral incident
    scale
- Metadata probe for the Greenwich-noon flat/spherical latitude sweep
  - status: pass
  - scene set:
    `san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`
  - scene count: 5
  - guide comparison available: false
  - observer latitudes: `80`, `30`, `0`, `-30`, `-80`
  - observer longitudes: all `-121.8863`
  - source subpoint longitudes: all `0`
  - resolved source latitude: `23.5`
  - sky orientation: `north-up`
  - horizontal frame: `observer-local-east-north-up`
  - flat Sun altitudes: `30.99261096837451`, `21.429765359143534`,
    `17.551478275720857`, `14.735745258874633`, `11.53445321602069`
  - flat Sun compass azimuths: `51.367652520406736`,
    `30.69214123725761`, `24.28772030096043`, `20.00103434972638`,
    `15.390510507986287`
  - spherical Sun altitudes: `17.973188369576345`,
    `-12.717757795814325`, `-28.974710147802988`,
    `-38.23567688368328`, `-28.47729297202286`
  - source brightness calibration latitude: `23.5`
  - source brightness calibration reference spectral incident scale:
    `1.0117013314723224`
  - all Greenwich-noon scenes reuse that same reference spectral incident
    scale
- Metadata probe for the 45-degree-east-noon flat/spherical latitude sweep
  - status: pass
  - scene set:
    `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`
  - scene count: 5
  - guide comparison available: false
  - observer latitudes: `80`, `30`, `0`, `-30`, `-80`
  - observer longitudes: all `-121.8863`
  - source subpoint longitudes: all `-76.8863`
  - resolved source latitude: `23.5`
  - sky orientation: `north-up`
  - horizontal frame: `observer-local-east-north-up`
  - flat Sun altitudes: `35.9605005151886`, `41.67206420471804`,
    `34.27751304505264`, `26.571256714233247`, `18.251562412903716`
  - flat Sun compass azimuths: `128.21464267613658`,
    `74.5714446783316`, `47.57352342924705`, `32.79549350708514`,
    `20.925245893884732`
  - spherical Sun altitudes: `30.350934901349895`,
    `49.548624071928`, `40.42554749577483`, `21.23584521822135`,
    `-16.265420003087502`
  - source brightness calibration latitude: `23.5`
  - source brightness calibration reference spectral incident scale:
    `1.0117013314723224`
  - all 45-degree-east-noon scenes reuse that same reference spectral incident
    scale
- Metadata probe for the North Pole summer-solstice GMT four-hour sweep
  - status: pass
  - scene set: `north-pole-summer-solstice-2026-gmt-4hour-sweep`
  - scene count: 6
  - guide comparison available: false
  - observer latitude/longitude: all `90`, `0`
  - render times: `2026-06-21T00:00:00Z`, `2026-06-21T04:00:00Z`,
    `2026-06-21T08:00:00Z`, `2026-06-21T12:00:00Z`,
    `2026-06-21T16:00:00Z`, `2026-06-21T20:00:00Z`
  - source subpoint latitude: all `23.5`
  - source subpoint longitudes: `180`, `120`, `60`, `0`, `-60`, `-120`
  - flat Sun altitude: `33.141501266231884` for every row
  - spherical Sun altitude: `23.5` for every row, within floating-point
    precision
  - source brightness calibration latitude/longitude: `23.5`, `0`
  - source brightness calibration reference spectral incident scale:
    `1.0117141056`
- Metadata probe for the South Pole winter-solstice GMT four-hour sweep
  - status: pass
  - scene set: `south-pole-winter-solstice-2025-gmt-4hour-sweep`
  - scene count: 6
  - guide comparison available: false
  - observer latitude/longitude: all `-90`, `0`
  - render times: `2025-12-21T00:00:00Z`, `2025-12-21T04:00:00Z`,
    `2025-12-21T08:00:00Z`, `2025-12-21T12:00:00Z`,
    `2025-12-21T16:00:00Z`, `2025-12-21T20:00:00Z`
  - source subpoint latitude: all about `-23.499500789885328`
  - source subpoint longitudes: `180`, `120`, `60`, `0`, `-60`, `-120`
  - source brightness calibration latitude/longitude:
    `-23.499500789885328`, `0`
  - source brightness calibration reference spectral incident scale:
    `1.0117141056`
- `node --check scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js`
  - status: pass
- `node --check scripts/flat/reconciliation/POC/src/outputs/pngWriter.js`
  - status: pass
- `node --check scripts/flat/reconciliation/POC/src/outputs/Figure1SkyDomeRenderer.js`
  - status: pass
- `node --check` for live progress logging files
  - status: pass
  - checked: `recordWriter.js`, `Figure1SkyDomeRenderer.js`,
    `Step018SkydomeImageWriter.js`, `m1FirstSkyDomeArtifacts.js`,
    `m1Step032ImageComparison.js`, `m2LocalFlatAssets.js`,
    `m2LocalFlatStackComparison.js`, `m2CoordinateWarningProbe.js`, and
    later `m2SynchronizedNoonFlatSphericalSkydomes.js`
- Direct renderer progress smoke
  - status: pass
  - scratch root: `tmp/reconciliation-progress-log-smoke`
  - observed `run.log` events: `started`, `row-complete` at `4/16`, `8/16`,
    `12/16`, `16/16`, `png-write-started`, and `completed`
- `node --check scripts/flat/reconciliation/POC/src/runners/m1FirstSkyDomeArtifacts.js`
  - status: pass
- `node --check` for M2 source files and runners
  - status: pass
  - checked: `FlatEarthGeometry.js`, `LocalSunLightSource.js`,
    `LocalSunIncidentRadianceCache.js`, `Step018SkydomeImageWriter.js`,
    `constants/consts.js`, `createM2Models.js`, `m2FlatGeometryProfile.js`,
    `m2LocalFlatAssets.js`, and
    `m2LocalFlatGuideSideBySideStack.js`; later focused checks also cover
    `m2SynchronizedNoonFlatSphericalSkydomes.js`
- `node scripts/flat/reconciliation/POC/src/validation/validateNoHistoricalRuntimeLinks.js`
  - status: pass
- POC source indentation normalization
  - status: pass
  - scope: `scripts/flat/reconciliation/POC/src/**/*.js` and `*.d.ts`
  - rule: 4-space code indentation, no leading tab characters, normal JSDoc
    star alignment
- `git diff --check`
  - status: pass
- JSON validation for
  `tmp/atmosphere/reconciliation/001-abstraction-closure-contract/*.json` and
  `tmp/atmosphere/reconciliation/002-interface-contract-declarations/*.json`
  and `tmp/atmosphere/reconciliation/003-interface-method-signatures/*.json`
  and `tmp/atmosphere/reconciliation/004-milestone1-full-algorithm32-scope/*.json`
  and `tmp/atmosphere/reconciliation/005-shared-baseline-constants/*.json`
  and `tmp/atmosphere/reconciliation/006-artifact-renderer-display-conversion/*.json`
  and `tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity/*.json`
  and `tmp/atmosphere/reconciliation/008-poc-clear-class-names/*.json`
  and `tmp/atmosphere/reconciliation/009-m1-granular-record-strategy/*.json`
  and `tmp/atmosphere/reconciliation/010-cli-experiment-run-record-rule/*.json`
  and `tmp/atmosphere/reconciliation/011-parameter-provenance-extraction/*.json`
  and `tmp/atmosphere/reconciliation/012-transport-helper-invariants/*.json`
  and `tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run/*.json`
  and `tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample/*.json`
  and `tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts/*.json`
  and `tmp/atmosphere/reconciliation/016-step032-full-image-comparison/*.json`
  and `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward/*.json`
  and `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision/*.json`
  and `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership/*.json`
  and `tmp/atmosphere/reconciliation/020-m2-cutoff-tolerance-justification/*.json`
  and `tmp/atmosphere/reconciliation/021-m2-poc-runtime-boundary-diagnostics/*.json`
  and `tmp/atmosphere/reconciliation/022-m2-general-runtime-boundary-policy/*.json`
  and `tmp/atmosphere/reconciliation/023-m2-path-integration-convergence-plan/*.json`
  and `tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate/*.json`
  and `tmp/atmosphere/reconciliation/025-m2-flat-geometry-profile/*.json`
  and `tmp/atmosphere/reconciliation/026-m2-local-sun-source/*.json`
  and `tmp/atmosphere/reconciliation/027-m2-local-flat-cpu/*.json`
  and `tmp/atmosphere/reconciliation/028-m2-pre-asset-experiments/*.json`
  and `tmp/atmosphere/reconciliation/029-m2-local-flat-assets/*.json`
  and `tmp/atmosphere/reconciliation/030-m2-local-flat-assets-quick-rerun/*.json`
  and `tmp/atmosphere/reconciliation/031-m2-local-flat-stack-comparison/*.json`
  and `tmp/atmosphere/reconciliation/032-m2-local-flat-stack-comparison/*.json`
  and `tmp/atmosphere/reconciliation/033-m2-local-flat-stack-comparison/*.json`
  and `tmp/atmosphere/reconciliation/034-m2-coordinate-warning-diagnostics/*.json`
  and `tmp/atmosphere/reconciliation/035-m2-coordinate-warning-diagnostics/*.json`
  and `tmp/atmosphere/reconciliation/036-m2-coordinate-warning-fix-check/*.json`
  and `tmp/atmosphere/reconciliation/037-m2-coordinate-warning-fix-check/*.json`
  and `tmp/atmosphere/reconciliation/038-m2-warning-fix-local-flat-assets/*.json`
  and `tmp/atmosphere/reconciliation/039-m2-warning-fix-six-column-stack/*.json`
  and `tmp/atmosphere/reconciliation/040-m2-observer-centered-dome-local-flat-assets/*.json`
  and `tmp/atmosphere/reconciliation/041-m2-observer-centered-dome-side-by-side-stack/*.json`
  and `tmp/atmosphere/reconciliation/042-m2-observer-centered-dome-diff-stack/*.json`
  and `tmp/atmosphere/reconciliation/043-m2-summer-solstice-latitude-skydomes/*.json`
  and `tmp/atmosphere/reconciliation/044-m2-synchronized-noon-flat-spherical-skydomes/*.json`
  and `tmp/atmosphere/reconciliation/045-m2-greenwich-noon-flat-spherical-skydomes/*.json`
  and `tmp/atmosphere/reconciliation/046-m2-45east-noon-flat-spherical-skydomes/*.json`
  and `tmp/atmosphere/reconciliation/047-m2-north-pole-summer-solstice-gmt-sweep/*.json`
  and `tmp/atmosphere/reconciliation/048-m2-south-pole-winter-solstice-gmt-sweep/*.json`
  - status: pass
  - parsed JSON file count: 301

## Next Step

Milestone 4.3.1 is closed by records
`536-m4-flat-geometry-gpu-selected-ray-parity` and
`537-m4-local-flat-gpu-integrated-selected-pixel-parity`. The next default
work is M4.3.2: recreate the required local/flat review galleries, then move
to M4.4 local/GPU closeout classification. Keep browser watcher and comparison
mechanics in the action plan / experiment-runner layer. Do not make
`ThreeGateway` own image capture: screenshots and image artifacts are runner
outputs, while other useful operational information flows through bounded
diagnostics, capability packets, setup reports, or selected shader diagnostic
outputs. Do not make `ThreeGateway` own default scene lighting: scene builders
decide whether lighting is included, Algorithm32/source configuration supplies
lighting parameters in predefined units, and `ThreeGateway` synchronizes those
values onto requested Three light handles. Do not treat M2 closeout as
production local/flat promotion: final
local/flat numerical controls, local cache defaults, exact Step 018 image
parity, default false-Sun source provenance, unit-bearing local-source
radiometric calibration, map/world-centered in-world edge-domain behavior, and
reflective dome optical behavior remain outside the M2 acceptance claim.
Records 040 through 049 add the observer-centered dome implementation and
additional inspection imagery, including the north-up synchronized-noon
flat/spherical stack, the Greenwich-noon captioned variant, the
45-degree-east-noon default, the North/South Pole GMT sweeps, and the Union
Glacier Final Experiment GMT sweep. They still do not promote production
local/flat status or exact Step 018 image parity.
Record 028 provides convergence/cap/cache diagnostics but deliberately leaves
final control promotion unresolved. Record 029 contains the full-size 320px
diagnostic PNGs despite the shell timeout, record 030 is the clean reduced-size
asset rerun, record 033 contains the full-size three-column diagnostic
comparison stack, record 037 fixes the previously observed coordinate warning,
record 038 regenerates the fixed full-size local/flat sky-dome assets, and
record 039 shows the fix produces zero decoded RGBA delta from record 029.
Record 040 replaces the skydome scalar-cap path with an observer-centered
finite-dome geometry profile and regenerates the full-size local/flat
Step 018-rotation images; record 041 creates the requested no-diff side-by-side
stack. The follow-up blue-ring diagnosis found that the sharp outer ring
aligned with the scalar no-hit cap transition rather than the coordinate
warning. The current implementation no longer tunes that scalar cap as final
physics for the M2 skydome profile: view/source rays resolve against
ground/top/dome candidates, and the observer-centered dome uses ray-sphere
intersection from the derived center/radius. More generally, flat geometry
should continue toward candidate-distance selection across ground/top planes,
dome spheres, optional radial map extents, supplied scene/hit/max distances,
and source-owned path limits. Map-centered dome behavior remains a separate
full-world profile. The new dome images are subjective
model-inspection/error-spotting artifacts backed by selected-ray diagnostics,
not Step 018 parity targets. Atmosphere may continue sampling density by
altitude inside that domain until a richer medium profile is introduced. The
dome truncates the existing atmosphere composition; it does not compress or
rescale density, scattering, or absorption profiles near the finite-domain
edge. A compressed-atmosphere follow-up would require a separate 3D
medium/composition model, not a one-dimensional altitude adjustment.
Reflective dome properties are another future extension: they would make the
dome an optical boundary/material, not just the current geometry exit.
Track the in-world finite-domain edge-view case as `ext-025`: current
observer-centered skydomes are diagnostic only and are not acceptance evidence
for final user-location shader behavior near a map/domain edge. A user near
the southern finite-domain boundary should use actual map/world-centered
geometry; south-facing near-horizontal rays should exit almost immediately and
show little atmospheric in-scattering, while upward south rays lengthen
gradually.

The additional subjective scene set
`san-jose-longitude-summer-solstice-latitude-sweep` is now rendered in
record `043-m2-summer-solstice-latitude-skydomes`. It keeps the San Jose
longitude, uses observer latitudes `80N`, `30N`, equator, `30S`, and `80S`,
and uses closest false-Sun approach on summer solstice. The source latitude is
resolved through the documented `annual-tropic-migration` setup at
`2026-06-21T12:00:00-07:00` before closest-approach rotation. Brightness is
calibrated once at the same `23.5N` source latitude and reused across all five
skydomes. This set has no guide-image parity target.

The reusable synchronized-noon variant
`san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep` is
rendered in record
`044-m2-synchronized-noon-flat-spherical-skydomes`. It uses the same latitude
list and brightness calibration as record 043, but every row is rendered at
the same synchronized solar-noon time by placing the source subpoint at the
common San Jose longitude. It also converts north-polar AEQD scene positions
into an observer-local east/north/up frame so source PNGs are north-up. The
record writes five flat PNGs, five spherical PNGs, and the final
flat-left/spherical-right stack
`artifacts/flat-spherical-synchronized-noon-north-up-stack.png`. This remains
subjective model-inspection evidence, not an exact parity target.

The reusable 45-degree-east-noon variant
`san-jose-longitude-summer-solstice-45east-noon-latitude-sweep` is rendered in
record `046-m2-45east-noon-flat-spherical-skydomes` and is now the default
scene set for `m2SynchronizedNoonFlatSphericalSkydomes.js`. It keeps the
observer/render longitude at San Jose (`-121.8863`) and synchronizes the clock
to solar noon at `-76.8863`, 45 degrees east of San Jose. This preserves an
off-meridian Sun while keeping the spherical distant Sun above the horizon
through the `30S` row. It writes five flat PNGs, five spherical PNGs, and the
captioned final stack
`artifacts/flat-spherical-synchronized-noon-north-up-stack.png`. This remains
subjective model-inspection evidence, not an exact parity target.

The polar GMT clock-sweep variants
`north-pole-summer-solstice-2026-gmt-4hour-sweep` is rendered in record
`047-m2-north-pole-summer-solstice-gmt-sweep`. It uses render location
`90N`, longitude `0`, sea-level elevation, date `2026-06-21`, and UTC rows
every four hours from `00:00 GMT` through `20:00 GMT`. The synchronized source
longitudes are `180`, `120`, `60`, `0`, `-60`, and `-120`, with source
latitude `23.5N`. It writes six flat PNGs, six spherical PNGs, and the
captioned final stack
`artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.
`south-pole-winter-solstice-2025-gmt-4hour-sweep` is rendered in record
`048-m2-south-pole-winter-solstice-gmt-sweep`. It uses render location `90S`,
longitude `0`, sea-level elevation, date `2025-12-21`, and the same UTC row
cadence and source-longitude rule, with source latitude about `23.4995S`.
It also writes six flat PNGs, six spherical PNGs, and the captioned final
stack `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`. These
remain subjective model-inspection evidence, not exact parity targets.

The Milestone 1 CPU distant/spherical path is accepted and should remain the
regression oracle for later changes.
Important M2 gap families include flat-geometry facts such as flat top
boundary handoff, no-hit sky-ray cap, round-equivalent skydome cap, finite
observer-centered dome view-domain, observer altitude/defaulting, projection
radius/source precision, long-sightline policy, and ground/top clipping
diagnostics; and local-source/cache facts such as false-Sun
altitude/size, longitude/phase, brightness/calibration, annual latitude
migration, local cache bins/direction counts, lookup policy, and stale RGB
tint. False-Sun size and placement are authored profile configuration; only
their exact defaults need source recovery or explicit profile-policy
classification. The remaining items must be resolved, classified as
model/display/fixture policy, deferred, or left unresolved without depending
on them for milestone acceptance.
Anything whose prior support is calibration-based must be reproven by the new
reconciliation POC code before it can support M2 acceptance. Historical
calibration outputs are comparison inputs, not proof by themselves.
Keep using `NNN-*` prefixed record folders. Every CLI-launched artifact or
comparison runner invocation gets its own fresh folder.
When a reconciliation experiment runner is invoked from the CLI, create a
fresh `NNN-*` folder for that invocation, including reruns. Supporting
verification commands remain logged inside the active record.
Use clear POC class names and keep moving; do not pause Milestone 2 for
production-final naming unless a name actively hides ownership.
Future atmosphere, artifact-rendering, light-source setup, and primary-runner
code should import shared constants rather than copying accepted values.

## Current M3 Shader Diagnostic State

The current object/ground layout diagnostics are records
`192-m3-raw-scene-low-camera-green-boxes` and
`193-m3-raw-scene-no-ground-object-green-boxes`. Record `192` renders the
low-camera, solar-noon, near/far green-box scene without
`CpuPostprocessSoftShader`, without `evaluate(...)`, and without any GPU
shader. The raw output `raw-scene.png` directly colors sky, ground, and green
boxes from the same analytic intersections used by the CPU reference scene.
Record `193` reruns that raw scene with the ground/ocean object removed; its
output shows only sky plus green boxes, confirming the prior raw ground region
comes from the explicit ground object/intersection and not from a hidden
background or shader path.
The visual difference also shows that the current diagnostic ground object is
geometrically wrong for this scene: in record `192` it reads as a broad green
rectangular overlay that cuts off the bottoms of the green boxes, while record
`193` removes that occluding slab. Do not tune color, atmosphere, or shader
composition around that fixture as though it were valid ground; replace the
ground fixture with a world-space surface that behaves like terrain or omit it
when testing object endpoints.

Records `194-m3-planet-sphere-ground-scene` and
`195-m3-planet-sphere-ground-scene` start that replacement from a clean
browser Three scene. Record `194` is the submitter; record `195` is the
watcher artifact. The new command type `browser-planet-sphere-scene` renders
only one mesh, a scaled planet-size sphere, with no terrain, boxes,
Algorithm32 transport, or assembled shader. It uses `bottomRadiusMeters =
6360000`, `scaleDenominator = 1000`, and `observerAltitudeMeters = 6200`,
so the sphere radius is `6360` scene units and the observer is `6.2` scene
units above the tangent point. The resulting image reads as a sphere-derived
curved horizon, not as the rectangular overlay from record `192`; treat it as
the clean baseline for rebuilding the ground object.

Records `196/197` rerun the single-sphere diagnostic at
`observerAltitudeMeters = 2`. That first near-zero render flattened the
horizon but exposed a scale-compensation bug: the camera near plane remained
`0.01` scene units, equal to `10 m` at `scaleDenominator = 1000`, while the
observer was only `2 m` above the sphere. This clipped the immediate
foreground and made the sphere appear as a thin band with sky below it. Records
`198/199` fix the diagnostic near plane with
`near = max(0.000001, min(0.01, observerAltitudeSceneUnits * 0.1))`; at
`2 m` observer altitude this becomes `0.0002` scene units, or `0.2 m`. Record
`199-m3-planet-sphere-ground-scene/canvas-image.png` is the corrected near-zero
baseline: the horizon is nearly flat and the lower foreground is filled by the
sphere.

Shader mode for this clean sphere scene is now wired but still needs a fresh
browser watcher run after the stale command is cleared. `m3PlanetSphereGroundScene.js`
accepts `--with-shader --solar-noon` and submits an
`assembled-three-scene-comparison` with `sceneKind: "planet-sphere-ground"`.
The browser page captures the one-sphere scene into scene color/depth textures,
uses analytic ray-sphere intersection for depth, and converts scene-unit hit
distances to Algorithm32 meters before encoding the depth texture. The
Algorithm32 camera binding is `[bottomRadiusMeters + observerAltitudeMeters,
0, 0]`, matching the scene sphere centered at `[0, -bottomRadiusSceneUnits,
0]` under the shader's `[scene.y, scene.x, -scene.z]` direction conversion.
Record `200/201` is rejected as the stale pre-analytic-depth attempt; the
watched command was marked `done` so a watcher restart will not rerun it.
Records `202/203` are the first accepted shader-mode run of that clean sphere
scene after the analytic-depth replacement. The submitter record is
`202-m3-planet-sphere-ground-shader-solar-noon-analytic-depth`; the browser
artifact is `203-m3-planet-sphere-ground-shader-scene/canvas-image.png`. The
diagnostics confirm one scene mesh, `metersPerSceneUnit = 1000`, scene sphere
center `[0, -6360, 0]`, Algorithm32 camera binding `[6360002, 0, 0]`,
analytic sphere-intersection depth encoded in Algorithm32 meters, and accepted
shader compile/link. The image shows the expected near-zero flat horizon and
atmospheric sky gradient, but the shader-composed ground is visibly speckled.
Treat the geometry alignment as broadly working and the speckled ground as the
next shader/input diagnostic issue.

Records `208/209` correct the CPU proof path for this clean sphere scene.
Record `208` replaces the previous parallel analytic scene model in
`m3CpuPlanetSphereGroundScene.js` with an actual Node Three scene: one scaled
planet-size `THREE.Mesh`, a `THREE.PerspectiveCamera`, and full-frame
`THREE.Raycaster` capture. It writes both raw and CPU soft-shader PNGs but is
rejected because the runner overwrote aggregate hit/no-hit diagnostics per row.
Record `209-m3-cpu-three-spherical-ground-object` fixes that accounting and is
accepted. It renders `120 x 68 = 8160` pixels through
`CpuPostprocessSoftShader` and public `SpectralReferenceEvaluator.evaluate(...)`,
with `3890` Three-scene sphere-hit pixels, `4270` no-hit sky pixels, no
invalid pixels, no warnings, and no errors. Hit distances come from the Three
raycaster, then convert from scaled scene units to Algorithm32 meters. The
retained artifact
`tmp/atmosphere/reconciliation/209-m3-cpu-three-spherical-ground-object/cpu-soft-shader-spherical-ground-object.png`
is the current accepted proof that the CPU soft shader operates on Three scene
data for a spherical ground object instead of on an independent analytic
stand-in.

Record `210-m3-geometry-owned-three-spherical-ground-object` supersedes record
`209` for the clean spherical ground CPU proof. It adds
`ExactSphereGroundObject`, a Three `Object3D` with a custom `raycast(...)`
method for exact ray/sphere intersection, and
`SphericalEarthGeometry.createThreeEndpointObjects(...)`, which returns a
visual sphere mesh plus an exact raycast endpoint object owned by geometry.
The runner now uses the same `SphericalEarthGeometry` instance to produce the
Three endpoint objects and to execute public `evaluate(...)`. This removes the
ground-level horizon mismatch where finite triangle-mesh raycasting missed
the visual sphere while Algorithm32's mathematical sphere clipped the ray to
ground. Record `210` reports `4080` geometry-owned sphere-hit pixels, `4080`
no-hit sky pixels, no invalid pixels, no warnings, and no errors; the center
horizon pixel changes from the record `209` black no-hit output to an ordinary
endpoint hit `[117, 114, 66, 255]`. The retained CPU PNG no longer has the
black strip. It is not a long-distance ground-fading proof because exact
ground-hit distances in this near-ground frame only range from about `3.92 m`
to `315.57 m`.
Records `211` through `214` raise the default camera altitude for this runner
to `202 m` and add two ordinary Three green diagnostic boxes to the same
geometry-owned spherical ground scene. Record `214` fixes endpoint routing so
hit objects supply their own `userData.spectralReferenceId` instead of every
hit using the ground fixture. It remains useful as a spectrum-fixture routing
diagnostic, but it is superseded for material-color proof because the visible
green boxes came from object-specific spectral fixtures rather than actual
Three material color.

Record `215-m3-matte-lambertian-three-color-202m` is now a superseded detour
for this scene. It proved that the runner still sent only ray plus finite
scene-hit distance into public `evaluate(...)`, but its
`matte-lambertian-linear-srgb` endpoint contribution did not match the
documented local-second-order hit-color behavior. Diagnostic records
`216-m3-current-cpu-matte-lambertian-diagnostic` and
`217-m3-current-cpu-matte-lambertian-120x68` confirmed the current source was
still using the matte path; at the comparison size, green-box CPU pixels
averaged about `[75.9, 159.2, 121.1, 255]`.

Records `218` through `220` restore the intended hit-color contract. Record
`218-m3-soft-shader-captured-scene-color-contract` verifies that captured
scene color is accepted only as a named post-transport endpoint contribution
and remains outside `evaluationRequest`. Record
`219-m3-cpu-postprocess-captured-scene-color-contract` verifies that captured
hit color does not fabricate spectral endpoint radiance: `evaluate(...)`
returns spectral path radiance/transmittance, then the display/color layer
combines that result with hit color. Record
`220-m3-captured-scene-color-green-boxes-120x68` is the accepted hit-color
scene proof. It uses the local-second-order
`captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy` policy
for all hit pixels, reports `4129` hit pixels, `4031` no-hit sky pixels,
`30` near-box hits, `25` distant-box hits, and `4074` spherical-ground hits,
with no invalid pixels, warnings, or errors. Green-box CPU pixels average
`[68.1, 153.3, 114.8, 255]`, so the boxes now remain green after CPU
postprocess composition. Do not pass RGB/display color into `evaluate(...)`,
and do not use `spectralReferenceId` shortcuts as proof of renderer hit-color
handling.

Record `221-m3-captured-scene-color-green-boxes-320x180` is the requested
180-line render of the same current CPU scene. It accepted all criteria with
`28866` hit pixels, `28734` no-hit sky pixels, no invalid pixels, no warnings,
and no errors. Green-box CPU pixels average `[67.3, 152.3, 113.3, 255]`; the
retained CPU PNG is
`tmp/atmosphere/reconciliation/221-m3-captured-scene-color-green-boxes-320x180/cpu-soft-shader-spherical-ground-object.png`.

Record `222-m3-captured-scene-color-green-boxes-2m-320x180` rerenders that
same CPU scene at `320 x 180` with `--observer-altitude-meters 2`. It accepted
all criteria with `29234` hit pixels, `28366` no-hit sky pixels, no invalid
pixels, no warnings, and no errors. Hit distances range from about `3.90 m` to
`36738.38 m`, with average hit distance about `307.44 m`; green-box CPU pixels
average `[66.6, 150.1, 110.2, 255]`. The retained CPU PNG is
`tmp/atmosphere/reconciliation/222-m3-captured-scene-color-green-boxes-2m-320x180/cpu-soft-shader-spherical-ground-object.png`.

Record `223-m3-cache-backed-cpu-green-boxes-2m-120x68` restores the full
Algorithm32 CPU scene path for sky/horizon judgment. The runner now builds the
distant L2 incident-radiance cache by default and passes the resulting
`incidentRadianceSampling` into public `SpectralReferenceEvaluator.evaluate(...)`;
`--no-incident-cache` is only a stripped diagnostic option. The captured
hit-color policy is unchanged: only ray plus finite hit distance enter
`evaluate(...)`, while captured scene display color is composed after spectral
path radiance/transmittance in the display/color layer. The cache-backed
`120 x 68`, 2 m run accepted all criteria with `4140` hit pixels, `4020`
no-hit sky pixels, no invalid pixels, no warnings, no errors, incident cache
mode `distant-l2`, `1632` cache coordinates, shader payload dimensions
`48 x 34 x 15`, and green-box CPU average `[66.38, 150.35, 110.15, 255]`.
Records `220` through `222` remain useful for the hit-color contract and the
requested 180-line/2 m diagnostic renders, but `223` supersedes them when
comparing the scene sky against the cache-backed Algorithm32 sky-dome path.

Record `225-m3-shader-ground-boundary-depth-tie-contract` fixes the shader-side
scene endpoint / ground boundary tie. The browser shader receives RGB24-packed
scene depth; with `sceneDepthMaxMeters = 150000`, one encoded depth quantum is
about `0.009 m`. The previous `0.001 m` tie tolerance meant a real scene
endpoint decoded a few millimeters beyond the analytic ground could fall
through to `hasGroundEndpoint`, where the current scene binds black
`uGroundRadianceRgb`. `DistantSphericalShaderContributionFactory` now uses
`max(uSceneDepthMaxMeters / 16777214.0, 0.001)` for scene-endpoint ties, so a
scene endpoint that quantizes to the ground boundary remains a scene endpoint.
The fix does not pass color into transport; the transport length still clamps
to the geometry boundary and scene color remains a post-transport color-layer
input.

Record `228-m3-planet-sphere-ground-shader-depth-tie-2m-120x68` is the browser
smoke evidence for that shader tie patch. The first attempted browser run
(`226`) rejected before shader execution because the planet-sphere capture
referenced a missing browser helper,
`applyBackgroundColorMaskToDepthBytes(...)`. Restoring that helper lets the
capture mask background-colored depth pixels back to the magenta no-hit
sentinel before shader input. The rerun accepted all criteria, wrote the
canvas at
`tmp/atmosphere/reconciliation/229-m3-planet-sphere-ground-shader-scene/canvas-image.png`,
and used shader source hash
`639721530553fdb649f907316e55b30296d0404ba238d1e0de925f79cac64677`.

Records `230` through `233` move the cache/boundary fix to the source instead
of relying on the shader tie symptom. The distant incident-radiance cache now
declares `boundaryAltitudeMeters: 2` and uses altitude bin zero as an explicit
minimum in-atmosphere sample. `SphericalEarthGeometry.resolveCacheAccess(...)`
clamps runtime cache queries at or below the ground boundary to that same `2 m`
effective altitude before selecting a cache bin, while preserving the original
requested altitude in metadata. Record
`230-m1-distant-cache-boundary-source-policy` accepted with `408` M1 cache
coordinates, `17` boundary incident-direction samples, and positive selected
zenith L2 contribution.

Record `231-m3-shader-cache-sample-position-boundary-source` updates the
assembled distant/spherical shader to ask the cache from the actual transport
sample position. The generated shader computes
`lightSourceRelativeCacheCoordinate(vec3 positionMeters)` from sample altitude,
clamps that altitude to `GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS`, and calls
`lookupIncidentRadiance(positionMeters, state.ray.direction)` inside the
transport loop. The old one-cache-lookup-per-pixel shortcut from view
direction/path length is rejected by the probe. The accepted shader source hash
is `2241b0d82ea92d29cf6ae15a23271e83f001b51dd33d55fa319756b75042f044`.

Record `232-m3-cache-boundary-source-cpu-green-boxes-2m-120x68` reruns the CPU
green-box scene after the source-owned boundary fix. It accepted all criteria
with `1632` cache coordinates, boundary cache altitude `2 m`, `4140` hit
pixels, `4020` no-hit sky pixels, no invalid pixels, warnings, or errors, and
green-box CPU average `[66.38, 150.35, 110.15, 255]`. Record
`233-m3-cache-boundary-source-shader-2m-120x68` reruns the browser shader smoke
with the new shader source hash and writes
`tmp/atmosphere/reconciliation/234-m3-planet-sphere-ground-shader-scene/canvas-image.png`.
The current visual is still a tiny diagnostic shader frame, but cache boundary
handling is now owned by geometry/cache data and per-sample cache lookup rather
than by caller-side workarounds.

Records `235-m3-explicit-scene-hit-mask-shader-contract` and
`236-m3-explicit-scene-hit-mask-shader-2m-120x68` supersede the current
depth-tie and magenta/no-hit browser mechanism from records `225` and `228`.
The assembled shader now treats scene depth as packed finite distance only and
uses `uSceneHitTexture` as the explicit endpoint signal. `resolveAtmospherePath`
receives `bool hasSceneEndpoint`; it no longer derives scene endpoint ownership
from encoded depth color or a quantization tolerance. The runtime descriptor
names the policy as `explicit-hit-mask-plus-opaque-hit-distance`. The browser
runner now builds scene depth and scene hit textures from the same per-pixel
`THREE.Raycaster` results, counts hit/no-hit pixels from the mask, and feeds
that same mask into the browser-side CPU mirror. Record `235` accepted shader
source hash
`3f2547da129abe62749bbb7b9b3cbc056ca9129478a4e177bcb05c26bdecd220`; record
`236` accepted the `120 x 68`, 2 m browser shader smoke and wrote
`tmp/atmosphere/reconciliation/237-m3-planet-sphere-ground-shader-scene/canvas-image.png`
with `3960` hit pixels and `4200` no-hit pixels from the explicit mask.

Records `238` through `253` correct the browser/CPU planet-ground
color scene. Record `238` made the browser capture use one raycaster hit as
the source for scene hit distance, explicit hit mask, and captured display
color; this removed the black horizon line, but the diagnostic boxes were
still kilometers away and read as horizon protrusions. Record `241` moved the
boxes closer but visual review showed their bases were still hidden by the
spherical ground limb. Records `242` and `243` introduced the visible
hit-point-derived ground pattern and proved the black horizon line was gone,
but they used a `2 m` observer and only two close boxes. Records `245` and
`246` raised the observer to `500 m` and added four green diagnostic boxes.
Record `250` then rendered a `320 x 180` shader-only visual diagnostic at
`1500 m` to review the still-curved-looking horizon/pattern read. Records
`255` through `262` increased the ground visual mesh from the old `256 x 128`
browser sphere and `128 x 64` CPU geometry default to a shared `512 x 256`
diagnostic sphere; ray hits still use the exact sphere object, so this only
changes the visible/rendered ground mesh density. Records `261` and `262` are
the accepted pre-lighting CPU/browser pair: the scene defaults use a `1500 m`
observer altitude, four green diagnostic boxes from foreground to farther
ground, the denser `512 x 256` ground visual mesh, and the same visible
hit-point-derived ground pattern. Record
`261-m3-1500m-dense-ground-sphere-cpu-120x68` writes raw and CPU soft-shader
PNGs and records geometry endpoint metadata with `widthSegments: 512` and
`heightSegments: 256`. Record
`262-m3-1500m-dense-ground-sphere-shader-120x68` writes
`tmp/atmosphere/reconciliation/263-m3-planet-sphere-ground-shader-scene/canvas-image.png`;
CPU and browser diagnostics both report `3837` ground hits, `49` near-box
hits, `62` middle-box hits, `30` far-box hits, `20` very-far-box hits, and an
accepted `ground-color-varies-from-hit-geometry` criterion. Color remains
outside public `evaluate(...)`; these changes affect only scene capture and
post-transport endpoint composition inputs.

Record `280` is preserved as a rejected transition run after moving toward
lit scene color; it failed only the old all-four-boxes-visible criterion.
Record `282-m3-lit-three-render-color-depth-only-ground-shader-640x360`
introduced the lit Three `WebGLRenderTarget` scene-color source, but its
depth-only ground made ground pixels sample sky-clear color. Records `284`
and `286` tried a black/no-color clear for that depth-only ground path and
were user-rejected because midday ground became too dark. Record
`288-m3-150m-lit-three-render-color-shader-640x360` lowered the default
observer elevation to `150 m` but still used the depth-only ground color path.

Record `302-m3-150m-colored-ground-mesh-exact-ground-hit-shader-640x360`
superseded those planet-sphere ground/color records by restoring a visible
`MeshLambertMaterial` ground mesh that wrote rendered color into
`uSceneColorTexture`, but it still kept a separate exact spherical raycast
object as the ground hit-distance and hit-mask authority. Records `304` and
`307` tried to make the visible mesh own those facts through per-pixel mesh
raycasts, but that path was too slow at `640 x 360`. Records `308/309` and
`310/311` introduced a rendered distance pass from the visible meshes, then
showed that the pass must not include the background because every background
pixel became a hit. Record
`312-m3-150m-rendered-distance-no-background-hit-mask-shader-640x360` is the
current accepted hit/color alignment record: the distance pass clears
background to `null`, the same visible meshes own rendered scene color, hit
distance, and explicit hit mask, and the exact sphere is no longer the ground
hit authority for this browser scene. The accepted browser artifact is
`tmp/atmosphere/reconciliation/313-m3-planet-sphere-ground-shader-scene/`,
including `pre-shader-scene-color.png` and `canvas-image.png`.
Diagnostics report `groundColorPolicy: visible mesh writes rendered scene
color and owns ground hit distance and hit mask through rendered distance
pass`, `128283` hit pixels, `102117` no-hit pixels, `109110` ground hits,
`12790` near-box hits, `5139` middle-box hits, and `1244` very-far-box hits.
The public `evaluate(...)` contract remains unchanged: only ray facts plus
finite hit distance enter transport, and rendered hit color is composed after
spectral path radiance/transmittance is evaluated.

Records `268` and `270` are newer GPU-only visual diagnostics for the apparent
horizon/ground curvature question, not accepted CPU/GPU contract records. The
camera look target was corrected from `[0, 0, -horizonDistance]` to the actual
spherical tangent point; at `4500 m` that point is about `[0, -4.4968,
-239.1220]` scene units with a line-of-sight horizon distance of about
`239.29 km`. Record `268` rerenders the `4500 m`, `640 x 360` shader view
with that corrected target. Record `270` lowers the same GPU-only diagnostic
to `150 m`, where `observerAltitudeSceneUnits` is `0.15` and horizon distance
is about `43.68 km`. Both records wrote useful images but rejected the
all-boxes-visible criterion because the existing diagnostic boxes no longer
all contribute pixels in those framings. The similar curve read at `150 m` and
`4500 m` points away from simple altitude scaling and toward another
projection, FOV, or diagnostic ground-pattern cause.

Records `272` and `274` add a GPU-only `--ground-display-mode solid`
diagnostic that keeps the same ray/hit shader path but removes the
hit-point-derived `60 m` checker and `140 m` depth band from captured ground
color. Both records intentionally reject the ground-color-variation criterion,
but their images show the bowl-like ground read is much weaker with solid
ground. The remaining small horizon sag is consistent with the wide-FOV
spherical limb, while the pronounced curved-ground impression is mainly a
diagnostic pattern/projection artifact.

Record `276` raises the solid-ground GPU-only diagnostic to `6000 m` and adds
`horizon-trace-overlay.png`, a mathematical overlay of the projected spherical
horizon tangent line. Diagnostics confirm the altitude is scaled to `6` scene
units with a horizon distance of about `276.33 km`. The trace measures the
horizon at pixel `y=180` near center and `y=186` at both image edges in the
`640 x 360`, `62 deg` vertical-FOV frame, confirming a definite `6 px`
projected horizon sag in the current camera projection.

Record `278` changes the planet-sphere diagnostic default to a more typical
`35 deg` vertical FOV, while adding a `--vertical-fov-degrees` override for
future comparisons. The `6000 m`, `640 x 360`, solid-ground shader diagnostic
now reports `verticalFovDegrees: 35`, and the horizon trace measures pixel
`y=180` near center and `y=184` at both image edges, reducing edge sag from
`6 px` to `4 px`. The accepted `261/262` CPU/GPU color-contract pair predates
this FOV default change; rerun that pair before treating `35 deg` as refreshed
accepted contract evidence rather than visual diagnostic evidence.

The Three scene now contains a ground mesh shaped from the active
Algorithm32 spherical geometry/camera transform. The CPU analytic ocean hit in
`m3CanonicalCpuGpuOceanComparison.js` uses the same center, so ground is a
normal scene endpoint instead of an invisible geometry-boundary color path.
The shader still keeps geometry boundary clipping as a guard, but the intended
happy path is `Three ground mesh hit -> scene endpoint hit color plus
spectral path/transmittance -> display RGB`.

Near ground hits in the RGBA8 depth texture can encode to byte `0`; the shader
had been treated as no finite endpoint. Record `175/176` fixed that specific
GPU scene-hit-zero case, but later ground-boundary fallback-color work
(`177/178` and `179/180`) is not retained as design because it made ground a
special color path. The generic rule remains: a rendered scene-object hit
supplies endpoint color/material plus hit distance; geometry/domain exits
without a scene hit do not add surface color.

Record `187` confirms the CPU reference endpoint composition is not a flat
matte bypass. The upper ground row varies left/center/right as
`[73, 129, 110, 255]`, `[80, 131, 110, 255]`,
`[71, 128, 110, 255]`; the middle row varies only slightly; the lower row is
effectively uniform at `[69, 128, 111, 255]` for this low-contrast ocean
fixture. Therefore a fully uniform or dark/speckled GPU ground should be
diagnosed in GPU shader/input/depth handling, not in the CPU reference
composition model.

Records `188` through `191` add green diagnostic boxes to the CPU reference
scene, lower the camera, switch the diagnostic to solar noon, and add
foreground plus distant boxes. They remain CPU-reference renders through
`evaluate(...)`, but the composed output is visually color-washed and does not
clearly read as raw terrain. Record `192` is the no-shader control for that
same layout; it shows earth-colored ground plus green boxes. Record `193`
removes the ground object from that same raw control and leaves only sky plus
green boxes. Together they show the cyan/mask-like look is introduced by the
diagnostic endpoint/display/transport path rather than by the raw scene
geometry or a hidden background fill. More specifically, record `192` shows
the current diagnostic ground object behaves like an occluding rectangular
slab, cutting off box bottoms; it is not a valid terrain/floor fixture. The
new planet-sphere-only browser diagnostics in records `194/195` and the
near-zero corrected records `198/199` are the clean starting point for
rebuilding the ground fixture. The current box center samples land near the
horizon/ground edge and are not quantitative box-face evidence.

Future optimization note: fresh CPU baseline renders are slow and can be
parallelized later by tiling rows across Node `worker_threads` or browser Web
Workers. Each worker should run the same public `evaluate(...)` path against
immutable scene/config/cache inputs and return image slices for stitching.
This is only a CPU reference/soft-shader throughput improvement, not a change
to the Algorithm32 contract or GPU shader semantics.

Records `314` through `324` repair the distant/spherical GPU parity
mismatches that had been queued before Subgoal 3.5 exit. The browser GPU path
now binds a real packed `rgba32f` distant L2 incident-radiance cache payload
instead of the old constant placeholder texture. The generated shader unpacks
the canonical 15-channel spectral cache, iterates the cache-owned
sun-oriented incident-direction sequence with the cache direction weight, uses
spectral direct/incident/path radiance and transmittance, and applies the CPU
endpoint/trapezoid view-path rule. Captured scene RGB remains outside
the generated shader's atmosphere transport stages: only ray facts and finite
endpoint distance enter transport, then spectral output plus captured scene
color are composed in the display step. This mirrors the CPU public
`evaluate(...)` boundary; the GPU shader does not literally call
`evaluate(...)`. Record `314` and rerun `320` accept the shader assembly probe with the
same source hash, record `315` accepts the cache payload pack, and watcher
records `317` and `319` confirm objective browser binding of the real
`rgba32f` incident-radiance payload for the planet scene and integrated
objective scene. Records `321/322` and `323/324` rerun the integrated
objective scene and planet-scene browser paths after removing the old browser
CPU side-by-side RGB approximation; both remain accepted. Subjective command
producers now emit the same packed cache payload shape, with row-specific
payloads for daylight-stack sun directions, but subjective review renders were
intentionally not rerun in this checkpoint.

Records `325` and `326` diagnosed a dark near-horizon CPU/GPU planet-scene
band but initially showed cache-enabled and `--no-incident-cache` CPU renders
matching byte-for-byte. That equality was a broken-cache symptom: the active
planet-scene distant L2 payload contained only zero radiance because the cache
representative model-space position used the old default `+Z` radial-up frame
while the planet scene, captured rays, camera position, and Sun direction use
model `+X` as radial up. Records `327` through `329` repair the geometry-owned
frame mapping. `SphericalEarthGeometry` now owns `observerUpDirection`,
`observerLocalSceneFrame`, and observer-local scene point/direction mapping
methods; the CPU planet scene asks geometry to map Three ray origins,
directions, hit points, and normals into model space. Distant cache coordinate
enumeration/storage remains cache-owned, but geometry maps cache coordinates
back to representative model-space rays in the same frame. The shader geometry
descriptor now carries the `+X/+Y/-Z` observer-local scene frame and generated
GLSL reconstructs model-space rays from descriptor-owned frame constants.
Record `327` accepted the cache-enabled `120 x 68`, `150 m`, `35 deg` CPU
scene with `1632` cache coordinates, `13125` nonzero packed cache floats, and
max packed radiance `0.21923798368243805`; record `328` accepted the matching
no-cache run; the decoded comparison in record `327` reports all `8160`
pixels differ, max byte delta `55`. Records `327/328` are cache-frame
diagnostic evidence only; they still used the older standalone CPU
scene-color policy and are superseded for planet-scene color/lighting inputs
by records `331/332`. Record `329` accepted shader assembly with
source hash `6d26d5863dc87d13340ce87df92c6a670dce429f638d6ad3f09226bf3cfea768`.
Record `330` reruns the M1 distant L2 cache probe and confirms the default
`+Z` spherical baseline still contributes positive incident radiance with
`408` cache coordinates and mean incident delta `0.004288843904891116`.

Records `334` and `332` refresh the planet-scene CPU/GPU inputs after finding
that the CPU runner and browser shader path still used different scene color
facts. Shared planet scene facts now live in
`scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneFacts.js`:
display colors, `visible-mesh-lambert-scene-color`, ambient light `1.1`,
directional light `4.0`, ground sphere segments `512 x 256`, and endpoint
radiance scale `5200`. The CPU runner imports those facts and removes the old
procedural ground pattern. The browser command producer sends the same facts
as `payload.planetSceneFacts`, and the browser page consumes them for the
pre-shader scene color render, ground/box materials, lighting, and diagnostics.
Record `331` accepted mechanically but is superseded for raw/color evidence:
its Node-side Lambert-style byte multiplier saturated ground hits to white, so
`raw-spherical-ground-object-scene.png` appeared to have no ground despite
`3891` ground intersections. Record `334` removes that pseudo-lighting from
the CPU raycaster hit-color capture, uses shared material display colors
directly, adds a `raw-scene-ground-color-present` criterion, and accepts with
`3891` exact shared ground-color pixels. Record `332` accepted the matching
browser shader job and watcher artifact `333` wrote `canvas-image.png` plus
`pre-shader-scene-color.png`. The current CPU/browser records report the same
object hit counts. Treat the CPU image as a transport/cache diagnostic until a
CPU path consumes the browser-captured scene color/depth/hit textures
directly.

Records `335` and `336` add the constructed-scene boundary requested after
the CPU/GPU scene mismatch. At that point `planetSphereSceneDefinition.js`
defined the now-superseded `planet-sphere-ground-solar-noon` scene as a name
plus object list:
`distant-sun-light`, `near-green-box`, `middle-green-box`, `far-green-box`,
and `very-far-green-box`. The spherical ground is explicitly geometry-owned
and is not part of the scene object list. Both CPU and browser construction
use an object-name to renderer-function map; each renderer produces one stable
object from the shared scene facts plus scene context, and unknown object
names fail at construction. The CPU raw renderer/soft shader and browser GPU
capture now consume already constructed scene objects instead of constructing
their own variants. CPU record `335` accepted with visible ground/boxes.
Shader record `342` and direct browser record `344` are the current browser
evidence after tightening the contract so object color and light intensities
are owned by registered object renderer functions/constants, not passed as
renderer input data. Watcher artifacts `343` and `345` accepted. Record `338`
is retained as stale-criteria evidence after the direct path initially
rendered correctly but failed shader-only wrapper checks.

Records `349`, `366`, `367`, and `380/381` complete the current
low-elevation ground-hit authority fix. Scene hits now own ray termination:
finite constructed-scene hits provide the typed spatial endpoint distance for
transport, while no-hit pixels do not receive a hidden analytic ground
endpoint. The browser shader path now builds scene color, depth, and hit-mask
textures from constructed-scene raycast endpoints, including a geometry-owned
exact spherical ground raycast object; the visible ground mesh is visual only.
Endpoint color remains outside `evaluate(...)` and is composed after spectral
transport. Browser artifact `381` accepted at `320 x 180`, `150 m`, and
`35 deg` with hit counts matching CPU raw-only record `388`: `32165` total hit pixels,
`25435` no-hit pixels, `27361` ground hits, `3225` near-box hits, `1285`
middle-box hits, and `294` very-far-box hits. The rejected dense-mesh
diagnostic `354/355` confirmed the issue was tied to the visible mesh/raster
edge, but the segment increase was not kept; scene facts remain at `512 x 256`
ground mesh segments.

Records `379` through `389` make base-scene identity explicit across separate
lit and unlit scene presets. `planetSphereSceneDefinition.js` now owns
`planet-sphere-ground-solar-noon-unlit` and
`planet-sphere-ground-solar-noon-lit`. The unlit preset excludes
`distant-sun-light` and uses `lightingPolicy: unlit-endpoint-color`; the lit
preset includes `distant-sun-light` and uses
`lightingPolicy: directional-light-from-distant-sun`. The same scene
definition owns each green-box object's `centerXZ` and `sizeSceneUnits`; CPU
and browser renderers consume those scene-definition object specs rather than
duplicating placement constants. The browser fallback copy of those specs was
removed, so the browser path consumes object specs from the command payload
and fails if required specs are missing. CPU raw-only records make base-scene
checks cheap: `388` is the current unlit CPU base scene and `384` is the lit
CPU base scene. Browser artifacts `381` and `386` are the matching unlit/lit
pre-shader captures. Parity records `389` and `387` accept exact decoded RGBA
parity for unlit and lit respectively: `maxAbsRgbaDelta: 0`,
`mismatchedPixelCount: 0`, with matching scene-definition object specs and
hit classifications. Record `371` intentionally runs the parity gate against
old browser artifact `347` and rejects it with `maxAbsRgbaDelta: 124` and
`32165` mismatched pixels. Treat `347` as superseded browser
lit/rendered-distance base-scene evidence, not as a valid CPU/GPU shader
comparison baseline.

Records `390` through `393` update browser artifact ownership so submitter
records no longer require a second watcher artifact folder. Browser commands
may now carry `artifactRunDirectory`; the watcher writes canvas/screenshot
artifacts directly into that already-created experiment record and namespaces
its browser-owned metadata as `browser-*` files so submitter-owned
`report.md`, `criteria-results.json`, `diagnostics.json`, and `run.log` stay
at the top level. Record `390` rejected only because the already-running
watcher process still used the old command normalizer and created stale
artifact folder `391`. After restarting the watcher, record `392` accepted a
direct unlit browser scene in one folder, and record `393` accepted the
matching shader-mode smoke with both `canvas-image.png` and
`pre-shader-scene-color.png` in the same record directory.

Records `394` through `398` add the first explicit planet-scene shadow policy.
`planetSphereSceneDefinition.js` now carries `shadowPolicy` beside
`lightingPolicy`, and the planet scene runners expose distinct
`--allow-shading` and `--with-shadows` options. Shadows imply shading: an
effective shadowed scene adds the `distant-sun-light`, uses
`lightingPolicy: directional-light-from-distant-sun`, and uses
`shadowPolicy: raycast-shadows-from-distant-sun`. Existing unlit/lit presets
remain shadow-disabled unless the shadow option or shadowed preset is used.
The CPU raycaster capture and browser constructed-scene endpoint-color
resolver both apply shadows outside `evaluate(...)` by casting a light ray
from the hit point toward the distant Sun and removing the direct Lambert term
when another scene object blocks it. Browser direct rendering also enables
Three shadow maps for this policy. Record `394` accepts the CPU raw shadow
smoke, record `395` accepts the direct browser shadow smoke, and record `396`
accepts shader mode with one shadowed hit pixel reported in the constructed
scene endpoint-color diagnostics.
Records `394` and `396` accepted mechanically but are superseded for visual
color evidence: the first CPU/browser manual endpoint resolver treated renderer
light intensities as display-byte multipliers, saturating lit ground to white.
Records `397` and `398` replace that with a normalized endpoint-light factor:
scene light intensities still control relative shading, but the final
display-color multiplier is bounded so fully lit material remains recognizable
and shadowed material darkens. Record `397` is the current CPU raw shadow
smoke, and record `398` is the current browser shader shadow smoke.

Records `399` through `405` move the planet-sphere shader path to the intended
browser runtime shape: a constructed Three scene is rendered through an
`EffectComposer`, then either an Algorithm32 GPU pass or an Algorithm32 CPU
pass consumes the same composer runtime input. The shared input contract is
the composer `RenderPass` scene color, constructed-scene raycaster distance
texture, explicit hit-mask texture, camera inverse matrices, camera world
position, distant Sun direction, scene depth bounds, and the packed distant L2
incident-radiance texture payload. Record `399` rejected only because the
existing runner criterion still expected the older constructed-raycast color
source and the first `ShaderMaterial` fullscreen vertex shader collided with
Three's injected attributes. Record `400` is the accepted GPU
EffectComposer-pass smoke at `120 x 68`. Record `401` is the accepted CPU
EffectComposer-pass smoke at `60 x 34`; it evaluates all `2040` pixels through
public `SpectralReferenceEvaluator.evaluate(...)`, uses the same packed GPU
cache payload through a browser CPU sampler, and applies captured scene color
only through the canonical post-transport endpoint proxy. This supersedes the
old standalone CPU planet soft-shader path as the parity architecture for the
planet scene. Record `402` reruns the GPU backend at the same `60 x 34`
viewport as record `401` and accepts with no browser console/page errors,
leaving numeric CPU/GPU image comparison as the next gate rather than a
separate-scene setup problem. Record `403` adds live progress reporting for
the browser integrated CPU composer pass. Records `404` and `405` then thin
the watcher boundary: browser commands name a page and entrypoint, route job
selection through `payload.jobType`, and let the page report progress and
request artifact persistence through `window.shaderHost`. The watcher no
longer parses CPU-specific console progress or infers shader image outputs
from result fields; it loads the requested page, calls the entrypoint, mirrors
host progress into `progress.json`, and saves requested artifacts. Record
`405` is the accepted verification smoke at `60 x 34`, with empty browser
console diagnostics, saved artifacts for `canvas-image.png`,
`pre-shader-scene-color.png`, `selected-pixels.json`,
`browser-diagnostics.json`, and `screenshot.png`, and submitter progress from
`0/34` through `34/34`.

Record `406` accepts the `320 x 180` GPU composer render for the shadowed
planet-sphere ground scene after the watcher restart. It verifies the retained
image artifact layout change: the browser page writes
`images/canvas-image.png` and `images/pre-shader-scene-color.png`, watcher
screenshot capture writes `images/screenshot.png`, and JSON artifacts such as
`selected-pixels.json` and `browser-diagnostics.json` remain at the experiment
root. Records `407` and `408` then render the
halfway-between-noon-and-sunset Sun sample and expose that Three's cast shadow
is misplaced when the DirectionalLight shadow camera uses the planet-radius
light distance and far plane. Record `409` verifies the first light-side fix:
the distant Sun scene object keeps the same Sun direction but centers the
shadow camera on the local green-box field and uses a local shadow
frustum/depth range. Records `411` and `412` fix the remaining receiver-side
artifact by replacing the visible global `SphereGeometry` shadow receiver with
a local spherical ground patch whose vertices are sampled from the same
analytic scaled-sphere surface used to place the boxes. The exact geometry
raycast ground still owns hit distance and hit mask. Record `412` is the
current accepted `320 x 180` GPU composer render for the midpoint Sun sample,
with the foreground cast shadow attached to the local ground receiver. The
effective scene is `planet-sphere-ground-solar-noon-unlit-shadowed`, with
`lightingPolicy: directional-light-from-distant-sun`,
`shadowPolicy: raycast-shadows-from-distant-sun`, shader backend `gpu`, and
all submitter criteria accepted. The GPU composer diagnostics still do not
report a shadowed-hit pixel count for that path, even though the shadow policy
is enabled.

Record `413` adds and renders the `sunset` Sun sample for the same shadowed
planet scene. The sample is defined as 15 minutes before apparent sunset so
the Sun remains above the local ground; diagnostics report altitude about
`1.76` degrees and azimuth about `298.58` degrees. The accepted GPU composer
artifact is
`tmp/atmosphere/reconciliation/413-m3-gpu-shadowed-planet-scene-sunset-320x180/images/canvas-image.png`;
the matching pre-shader scene color is under the same record's `images/`
folder. Browser console/page/fatal errors were empty.

Current shader lifecycle decision: setup/configuration is a strict pre-render
phase for the Algorithm32 shader pass. Cache construction or selection,
packed-cache texture creation/upload, descriptor compatibility checks,
resource allocation, binding-map creation, material construction, and pass
installation must finish before the pass is rendered. The pass may consume
prepared frame inputs such as the composer read buffer, camera/frame uniforms,
and already prepared textures, but it must not build caches, choose cache
artifacts, repack cache textures, validate a new configuration, or rebuild the
installed pass during render. Per pixel, the Algorithm32 shader body should do
only the GPU equivalent of `evaluate(...)`: consume prepared ray/scene-hit
facts plus bound incident-radiance support, produce spectral transport output,
and leave endpoint hit color plus final display/RGBA encoding to the separate
post-evaluate composition/display boundary.

Records `415` through `419` establish the first GPU shader quality-profile
evaluation. The current full distant/spherical GPU shader is named
`ideal` and remains the POC quality/reference shader. Reduced-cost work should
branch through explicit profiles or a separate optimized shader
implementation, then compare against `ideal`. The first comparison uses the
same `320 x 180` midpoint-Sun shadowed planet scene: `balanced` costs about
`50%` of ideal by the dominant loop estimate and is visually close
(`maxAbsRgbaDelta: 26`, `meanAbsRgbaDelta: 2.6953`, `rmseRgbaDelta: 4.1248`);
`fast` costs about `26%` and remains coherent but visibly shifts the horizon
and ground (`maxAbsRgbaDelta: 50`, `meanAbsRgbaDelta: 6.3313`);
`draft` costs about `9%` and is retained as a lower-bound diagnostic. The
comparison record is
`tmp/atmosphere/reconciliation/419-m3-gpu-quality-profile-comparison-320x180/`.

Records `420` through `426` test smarter sample placement and cache
interpolation as setup/config-owned quality profiles. `adaptive-balanced` and
`adaptive-balanced-soft` redistribute view-path samples with non-uniform
trapezoid weights, clustering around the tangent point for horizon rays and
toward the camera otherwise. Both accepted, but both were worse than uniform
`balanced` on the current scene (`adaptive-balanced` mean byte delta about
`4.07`, `adaptive-balanced-soft` about `3.22`, versus `balanced` about
`2.70`). `balanced-cache-interp` adds linear interpolation between
incident-radiance cache altitude bins and is the best candidate so far:
mean byte delta about `2.61`, RMSE about `4.03`, and max byte delta `26`
against `ideal`. `fast-cache-interp` was slightly worse than `fast`, so the
low-count profile's dominant error is probably not cache altitude snapping.
Comparison record:
`tmp/atmosphere/reconciliation/426-m3-gpu-quality-cache-interp-comparison-320x180/`.

Record `427` adds human-eye-sensitivity proxy metrics to the quality-profile
comparison: Rec.709 display-luma delta and weighted RGB delta over the rendered
display bytes. These proxy metrics are tuning signals, not replacements for
exact RGBA byte regression checks or a future CIE color-difference model. They
preserve the current ranking: `balanced-cache-interp` remains the best
candidate with mean luma delta about `3.39` and luma RMSE about `4.48`, while
regular `balanced` reports about `3.50` and `4.61`. `fast` has mean luma delta
about `8.49`, confirming that its visible drift lands in perceptually
sensitive brightness changes. The profile comparison runner now writes a
plain-language `Conclusions` section above the metric table, calling out the
best candidate, the small benefit from balanced cache-altitude interpolation,
the failed adaptive sampling candidates, and the risk of the fast/draft
profiles.

Record `428` creates a stacked composite review image from the record `427`
comparison. Each candidate row is `ideal | candidate | diff x4`, with the
profile id, estimated work ratio, mean byte delta, and mean luma delta in the
row caption. The composite artifact is
`tmp/atmosphere/reconciliation/428-m3-gpu-quality-candidate-composite-320x180/images/quality-candidates-ideal-candidate-diff.png`.

Records `429` and `430` add a detectable residual visual-diff path. The
comparison runner still writes the exact absolute byte diff, but now also
converts display-byte RGB to Lab, computes a CIEDE2000-style proxy, subtracts a
`1.0 Delta E 2000` just-noticeable threshold, and visualizes only the residual.
This is only a POC review aid because real detectability depends on display,
viewing distance, adaptation, and spatial masking. The current run still favors
`balanced-cache-interp`: detectable pixels are about `56.3%` with mean
residual Delta E about `0.525`, compared with regular `balanced` at about
`58.6%` and `0.554`. The detectable-diff composite artifact is
`tmp/atmosphere/reconciliation/430-m3-gpu-quality-detectable-diff-composite-320x180/images/quality-candidates-ideal-candidate-detectable-diff.png`.

Record `431` creates the combined review composite from record `429`, arranged
as `ideal | candidate | diff x4 | perceptual diff`. The far-right column is the
detectable residual diff, while the third column preserves the raw absolute
byte diff for direct audit. The composite artifact is
`tmp/atmosphere/reconciliation/431-m3-gpu-quality-diff-and-perceptual-diff-composite-320x180/images/quality-candidates-ideal-candidate-diff-perceptual-diff.png`.

Records `432` and `433` add browser-side GPU performance measurement for every
shader quality profile. The benchmark submits one watcher job containing all
profile shader/cache payloads, constructs the scene once in the browser, and
measures `100` steady-state EffectComposer renders per profile with
`performance.now()` and `gl.finish()`. The measured loop disables diagnostic
scene-color readback and yields `10 ms` every `5` measured runs, with `50 ms`
between profiles, so the test does not monopolize the machine. Record `433` is
the current performance record because it also reports setup duration and
warmup render summaries separately from steady-state frame time. At
`320 x 180`, `ideal` averaged about `0.469 ms`; `balanced-cache-interp`
averaged about `0.278 ms` (`1.69x` faster than ideal) and remains the best
quality/performance candidate from the current evidence. Warmup max values can
still spike independently of steady-state frame mean (`balanced` about
`161 ms`, `ideal` about `59 ms`), likely reflecting shader compile/JIT or GPU
pipeline creation. Report:
`tmp/atmosphere/reconciliation/433-m3-gpu-quality-performance-benchmark-setup-warmup-320x180/report.md`.

Records `434` through `437` replace the green-only planet diagnostic boxes
with scene-owned color boxes that cover a wider endpoint-color range for diff
review. The default planet scene now lists red, two greens, yellow, blue, cyan,
and magenta diagnostic boxes, each with `displayRgba` and a spectral-coverage
hint in `planetSphereSceneDefinition.js`; browser fallback specs mirror those
values. Records `434` through `436` were placement iterations that did not yet
produce all expected color hits, especially magenta. Record `437` is the
accepted GPU composer verification after moving magenta into a visible gap and
tightening the runner criteria so every scene-listed diagnostic color box must
have raycast hit pixels and color extents. The accepted hit counts are red
`3625`, near green `1444`, middle green `1285`, yellow `438`, blue `1213`,
cyan `330`, and magenta `562`. This does not change Algorithm32 transport:
only ray and hit-distance facts enter `evaluate(...)`; captured endpoint color
is still composed afterward by the display/color boundary.

Records `438` through `446` run the quality-profile diffs on that broader
colored scene. Records `438` through `444` rerender `balanced`,
`balanced-cache-interp`, `adaptive-balanced`, `adaptive-balanced-soft`,
`fast`, `fast-cache-interp`, and `draft` against the same scene/camera/Sun
setup as ideal record `437`. Record `445` accepts the absolute and detectable
residual diff comparison; record `446` accepts the four-column composite:
`ideal | candidate | diff x4 | perceptual diff`. The colored scene does not
change the current tuning conclusion. `balanced-cache-interp` remains the best
serious candidate at about `50.2%` of ideal work, with max byte delta `24`,
mean byte delta `2.6715`, mean luma delta `3.4994`, detectable pixels about
`56.0%`, and mean residual Delta E `0.5276`. The composite image is
`tmp/atmosphere/reconciliation/446-m3-gpu-colored-quality-diff-and-perceptual-diff-composite-320x180/images/quality-candidates-ideal-candidate-diff-perceptual-diff.png`.

Record `447` reruns the shader quality performance benchmark at `1024 x 768`,
closer to an app-scale viewport, on the same broader-color shadowed planet
scene. It keeps `100` measured runs/profile, `5` warmups/profile,
`performance.now()`, `gl.finish()`, disabled diagnostic readbacks inside the
measured loop, and `10 ms` yields every `5` measured runs. The browser reports
the intended `786432` pixel runtime input and accepts all criteria. The
steady-state means remain fractional on the RTX 2060 browser run: `ideal`
`0.3990 ms`, `balanced` `0.2710 ms`, `balanced-cache-interp` `0.2900 ms`,
`adaptive-balanced-soft` `0.2070 ms`, `fast` `0.2100 ms`,
`fast-cache-interp` `0.2520 ms`, and `draft` `0.2310 ms`. Treat those
absolute values with timer/granularity caution; the stronger signal is
warmup/pipeline creation, where first warmup frames spiked from about `50 ms`
for `ideal` up to about `1.5-6.2 s` for several candidate shaders. The
performance report is
`tmp/atmosphere/reconciliation/447-m3-gpu-quality-performance-benchmark-setup-warmup-1024x768/report.md`.

The runtime quality policy is now documented in
`agents/topics/apps/flat/reconciliation/shader-design.md#runtime-quality-policy`.
The intended production shape is hybrid: user preference sets the allowed tier
range, `auto` is the default, and runtime adaptation can move one tier at a
time only after sustained frame-budget pressure or a longer stable
under-budget window. Tier changes must choose among already installed and
warmed shader handles, or schedule setup/configuration work outside frame
rendering while the previous valid tier stays active. Current evidence keeps
`balanced-cache-interp` as the preferred first production candidate; `ideal`
is reference/high-quality, `fast` is a pressure fallback, and `draft` is
diagnostic/preview only. Record `447` makes prewarming important because
first-use shader/pipeline cost can dominate even when steady-state timing is
fractional.

CPU/GPU ideal visual parity for the planet scene must use only the integrated
browser constructed-scene path:
`m3PlanetSphereGroundScene --with-shader --shader-backend cpu|gpu`. The older
Node CPU planet renderer is not a valid substitute for this comparison because
it owns separate scene construction. Record `448` is a rejected pre-fix CPU
integrated `456 x 256` attempt: the browser CPU shader was still advancing
rows, but the submitter and browser wrapper had fixed wall-clock timeouts. The
runner, browser wrapper, and CPU composer pass now use progress/inactivity
semantics. CPU composer progress reports at least every `5 s` while rows
advance, and timeouts now fire only after the timeout window passes without
fresh watcher/page progress. The user-run watcher must be restarted before the
next CPU integrated render so it loads the browser wrapper/page changes.

Records `451` through `454` complete the requested CPU/GPU ideal `256 px`
comparison using only that integrated browser path. Record `451` is the CPU
integrated ideal render at `456 x 256` for the broader-color shadowed
midpoint-Sun scene; it accepted after about `1571 s`. Record `452` is the
matching GPU ideal render. Record `454` is the accepted comparison and
composite record, with the composite at
`tmp/atmosphere/reconciliation/454-m3-cpu-gpu-ideal-comparison-456x256/images/cpu-gpu-ideal-diff-x4.png`.
The diff treats GPU ideal as expected and CPU integrated as actual. Metrics:
max RGBA byte delta `1`, mean RGBA byte delta `0.0219`, mean display-luma byte
delta `0.0294`, and `9861` mismatched pixels out of `116736`. Record `453`
was a rejected comparison-runner initialization bug before `454` accepted.

Milestone 4 status classification: the implementation is ahead of the written
M4 plan only in pre-GPU local/flat support and subjective review tooling. The
prepared pieces are browser-integrated CPU composer support for `flat-earth` /
`local-sun`, geometry-owned flat ground and scene-frame conversion, local L2
cache binding, local Sun `degreesFromClosestApproach` source-phase semantics,
source-owned endpoint Three lighting through the optional
`LightSourceModel.createThreeLightingObjects(...)` integration adapter,
optional source-owned shadows, and user-requested local/flat subjective review
renders. The design now records that this adapter is renderer
integration/display capture: geometry maps model/source positions into
observer-local Three scene coordinates, the light source creates endpoint scene
lights/shadow helpers plus metadata, and the resulting shaded scene color is
composed after `evaluate(...)`. These are M4 preparation and defect-finding
context. Record `534-m4-local-cache-texture-prep` now accepts M4.1 local cache
texture prep: the local L2 cache builds `315 / 315` coordinates/values, emits
a deterministic packed `rgba32f` 3D shader payload
`incident-radiance-local-l2` with texture dimensions `9 x 7 x 20` and `5040`
upload floats, records z/rho/direction/spectral-group lookup metadata, proves
`TextureBuilder` can materialize the cache request, and verifies runtime cache
access is still geometry-resolved through `local-source-z-rho` packets. Record
`533` is preserved as a rejected probe-criterion bug before `534` accepted.
Record `535-m4-local-gpu-cache-texture-lookup` now accepts M4.2 local GPU
cache texture and shader lookup: the browser WebGL2 path uploads the real
`incident-radiance-local-l2` payload as a `9 x 7 x 20` `rgba32f` 3D texture
with `5040` floats, compiles the local/flat shader descriptor/contribution
set, binds the local cache sampler, and verifies GLSL lookup by matching the
expected packed-cache texel readback `[128, 182, 204, 255]`. Records
`536-m4-flat-geometry-gpu-selected-ray-parity` and
`537-m4-local-flat-gpu-integrated-selected-pixel-parity` now accept M4.3.1.
Record `536` proves selected-ray/path-bound parity against CPU
`FlatEarthGeometry`, including browser ray reconstruction, scene-hit
termination, ground/top/observer-dome clipping, and z/rho cache access.
Record `537` runs the same constructed local-flat scene through integrated CPU
and GPU composer backends with the local L2 cache contract and matches
selected browser readbacks with max byte delta `1`. Still open M4 work begins
at M4.3.2: required review galleries, any remaining local-second-order
evidence recreation beyond the accepted objective records, and final
local/GPU closeout.

M4.3.2 GPU review-gallery recreation has started with the Union Glacier Camp
`2021-12-14` five-row phase stack. Records `538` through `542` render the
same reference-box landscape through the integrated GPU local/flat shader for
local Sun offsets `180`, `135`, `90`, `45`, and `0` degrees from closest
approach, using scene set `union-glacier-camp-2021-dec14-degree-offsets`,
`228 x 128`, `150 m` camera height, `800 m` look distance, `272.67 m`
look-at height, and camera aimed toward the closest-approach direction. All
five row records accepted with the GPU composer backend and local L2 texture.
Record
`543-m4-gpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128`
composites the rows into
`images/union-glacier-2021-dec14-gpu-reference-boxes-phase-stack-180-to-000.png`.
Records `544` through `548` repeat the same GPU Union Glacier phase rows after
adding a centered Denali-scale review box with front face at `200 km`, height
`6.2 km`, width `50 km`, and depth `100 km`. The box is named
`local-flat-denali-200km-6p2kmx50kmx100km-orange-box`; subpixel hit capture is
enabled for this far review object so visible far geometry contributes a
scene-hit termination. Record
`549-m4-gpu-union-glacier-2021-dec14-denali-200km-phase-stack-180-to-000-228x128`
composites those five accepted rows into
`images/union-glacier-2021-dec14-gpu-denali-200km-phase-stack-180-to-000.png`.

Flat/local integrated CPU verification: record
`456-m3-cpu-integrated-flat-local-sun-96x54` accepts a browser integrated CPU
EffectComposer smoke for flat geometry with a local Sun. The browser integrated
CPU composer path now accepts explicit `geometryKind` and `lightSourceKind`
runtime fields. The default remains distant/spherical, while `flat-earth`
plus `local-sun` constructs `FlatEarthGeometry`, `LocalSunLightSource`,
`CanonicalAtmosphere`, `SpectralCalculator`, and `SpectralReferenceEvaluator`
in the browser CPU composer and runs direct local-source transport through
public `evaluate(...)`. `FlatEarthGeometry` now owns a flat Three ground
endpoint factory plus the scene-frame conversion that maps Three scene
directions as `[scene.x, -scene.z, scene.y]` into flat model coordinates.
Record `456` verifies the `flat-earth / local-sun` contract, geometry-owned
ground, hit/no-hit pixels, local flat box and ground hits, positive selected
path radiance, and saved `images/canvas-image.png` plus
`images/pre-shader-scene-color.png`. It reported hit counts
`local-flat-geometry-ground: 2555`, `local-flat-near-green-box: 90`, and
`local-flat-far-blue-box: 56`, with selected `pathRadianceMean` values
positive for ground, box, and sky samples. Record `455` was a rejected
submitter-criterion typo before `456` accepted.

Record `458-m3-cpu-integrated-flat-local-sun-l2-more-boxes-96x54` supersedes
`456` as the current flat/local integrated CPU smoke because it explicitly
builds and binds the local L2 incident-radiance cache in CPU setup before
rendering. It reports incident cache mode `local-l2-cache-sampler`,
coordinate/value count `315 / 315`, and positive selected-pixel
`incidentInScatteringMean` for ground, box, and sky samples. The local-flat
diagnostic scene now includes three farther boxes, with accepted hit counts:
ground `2555`, near green `90`, far blue `56`, mid yellow `53`, very far
magenta `29`, and far cyan `60`. Record `457` rejected only because two new
far boxes were hidden behind nearer boxes at `96 x 54`; record `458` separates
their angular placement and verifies every diagnostic box has raycast hit
pixels.

Records `459` through `464` are the current flat/local endpoint-visibility
diagnostic sequence. The scene now uses a distance ladder for the diagnostic
boxes and selects CPU diagnostics from actual raycast object-hit pixels
instead of three fixed screen positions. The CPU selected-pixel packets
include captured scene RGBA, final output RGBA, byte delta,
display-composition details, and decoded hit distance. Record `459` first
isolated the original symptom: endpoint hits were already being composed, but
the previous selected object/ground distances were too short to move visibly.
Record `460` fixed the ground visual input to use explicit display RGBA, so
the selected pre-shader ground pixel became `[86,105,66]` instead of the
earlier dark linearized value.

Record
`464-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-final-160x90`
accepts the current flat/local endpoint-color setup, and record
`465-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-final-320x180`
rerenders it at doubled review resolution. The setup scales the Three scene
like the planet path (`1000 m/scene-unit`), spaces the boxes from about
`12 km` through `58 km`, and sets `sceneDepthMaxMeters` to the flat geometry
sky-ray limit (`1926774 m`). The raycast capture now limits hits to the
representable scene-depth range before writing the hit mask; record `464`
reports `nearMaxDepthHitBucket: 0`. Record `465` accepts the unlit
`320 x 180` review render. Record
`466-m3-cpu-integrated-flat-local-sun-planet-scale-high-observer-shaded-320x180`
turns on Three Lambert shading on the flat ground visual mesh and every
diagnostic box, adds a DirectionalLight from the resolved local Sun direction
plus ambient fill, and leaves that lighting entirely in the captured composer
RenderPass scene color. Record
`467-m3-cpu-integrated-flat-local-sun-planet-scale-150m-shaded-320x180`
lowers the observer/camera height to `150 m` (`0.15` scene units). Record
`468-m3-cpu-integrated-flat-local-sun-planet-scale-150m-close-boxes-shaded-320x180`
adds close red, orange, and white diagnostic boxes at roughly `0.9 km`,
`1.8 km`, and `3.5 km` in front of the camera. Record
`469-m3-cpu-integrated-flat-local-sun-planet-scale-150m-rotated-close-boxes-shaded-320x180`
rotates the diagnostic boxes so their faces are no longer square to the
camera: close red `18 deg`, close orange `-24 deg`, close white `31 deg`,
near green `-16 deg`, far blue `22 deg`, mid yellow `-12 deg`, far cyan
`17 deg`, and far magenta `-20 deg`. Record
`470-m3-cpu-integrated-flat-local-sun-source-driven-light-rotated-close-boxes-480x270`
supersedes `469` as the current flat/local visual review artifact. It raises
the image size by 50% to `480 x 270` and replaces the hardcoded
DirectionalLight endpoint-scene light with the older shader-lab-style
source-driven local PointLight policy: white point light at the configured
local source position, `decay = 0`, intensity `2.4 * observerIncidentScale`,
and low ambient fill. The source distance/falloff is folded into
`observerIncidentScale` for endpoint scene brightness while Algorithm32 still
samples the true finite source through the flat/local evaluator. The
integrated CPU pass still feeds only flat/local ray and hit-distance facts
into `SpectralReferenceEvaluator.evaluate`, with lit endpoint color composed
after spectral transport. Record `470` accepted with local L2 still bound
(`315 / 315` cache values), every listed diagnostic box hit, selected ground
hit distance about `333 m`, `observerIncidentScale` about `1.00006`, and
point-light intensity about `2.40013`.

Record
`471-m3-cpu-integrated-flat-local-sun-source-owned-three-light-smoke-160x90`
keeps the same visual policy but fixes the abstraction boundary: conversion
from local Sun configuration/source-relative facts into Three scene lights now
lives on `LocalSunLightSource.createThreeLightingObjects(...)`. The browser
scene runner asks `FlatEarthGeometry` for the model-position-to-observer-local
Three scene placement and source-relative packet, then asks the light source
for the ambient fill plus source-driven `PointLight`. The runner no longer
duplicates source falloff or incident-scale math. Record `471` accepted at
`160 x 90`, reports lighting owner `LocalSunLightSource`, keeps the local L2
cache bound (`315 / 315` cache values), and verifies all diagnostic boxes plus
ground hits.

Record
`473-m3-cpu-integrated-flat-local-sun-wide-box-layout-480x270` first spread
the same diagnostic boxes across the available horizontal field of view while
preserving the distance ladder, colors, Lambert endpoint materials,
source-owned Three light conversion, and integrated CPU shader path. The close
boxes sat on opposite sides of the frame, and the farther blue/cyan/magenta/
yellow boxes alternated across the left and right field instead of stacking
near image center. Record `472` accepted that layout as a `160 x 90` smoke;
record `473` accepted at `480 x 270`, kept local L2 bound (`315 / 315` cache
values), and reported hit pixels for every listed diagnostic box plus the
geometry-owned flat ground.
Record
`475-m3-cpu-integrated-flat-local-sun-even-box-layout-480x270` supersedes that
as the current layout record after the side-cluster gap diagnosis. It changes
only the diagnostic box horizontal placement: selected object hits now span
the `480`-wide frame at about x=`31`, `91`, `134`, `183`, `239`, `288`, `342`,
and `383`, so the view has left, middle, and right coverage instead of two
side clusters. Record `474` accepted the same layout as a `160 x 90` smoke,
and record `475` accepts at `480 x 270` with local L2 still bound
(`315 / 315` cache values), hit pixels for every diagnostic box, and the same
integrated CPU shader path.
Record
`477-m3-cpu-integrated-flat-local-sun-shadows-480x270` supersedes `475` as
the current flat/local visual record. It turns on source-owned Three shadows:
`LocalSunLightSource.createThreeLightingObjects(...)` now returns a
source-driven directional shadow light when shadows are enabled, using the
local source direction and `observerIncidentScale` for endpoint scene
brightness while Algorithm32 still samples the true finite local source. The
flat scene renderer enables Three shadow maps, the diagnostic boxes cast and
receive shadows, and the geometry-owned flat ground visual mesh receives
shadows. The shadow frame is computed from the diagnostic box bounds, with a
`2048` shadow map in record `477`. The record accepts at `480 x 270`, keeps
local L2 bound (`315 / 315` cache values), reports hit pixels for every
diagnostic box, and adds the `local-flat-shadows-enabled` acceptance
criterion. Render-quality diagnostics now distinguish Three-side antialiasing
and MSAA-capable composer targets from the still single-center-sample
raycast hit mask, which remains the main source of visible stair-stepping at
this review resolution.

Local Sun degree-language clarification: a local Sun degree request means
`degreesFromClosestApproach`, the number of degrees the configured finite local
Sun has moved along its local orbit from closest approach. It is not an
apparent sky-altitude/elevation angle. Source position, apparent
altitude/azimuth, lighting direction, and shadow direction should be derived
from that resolved orbit state.

Record
`478-m3-cpu-integrated-flat-local-sun-045deg-shadows-480x270` renders the same
integrated CPU flat/local shadow scene at `480 x 270` with scene seed
`san-jose-045deg-from-closest`, i.e. `45` degrees from closest approach along
the local Sun orbit rather than a `45` degree apparent elevation. It accepts
with the integrated CPU EffectComposer path, `flat-earth / local-sun`,
`local-l2-cache-sampler` (`315 / 315` cache values), source-owned Three
shadows, and hit pixels for every diagnostic box plus the geometry-owned flat
ground. The primary artifact is
`tmp/atmosphere/reconciliation/478-m3-cpu-integrated-flat-local-sun-045deg-shadows-480x270/images/canvas-image.png`.

Record
`479-m3-cpu-integrated-flat-local-sun-045deg-contact-shadows-480x270`
rerenders the same `45` degrees-from-closest scene after removing the local
flat shadow-map `normalBias`. The previous value was `0.02` scene units, which
equals `20 m` at the current `1000 m / scene unit` scale and could create
shadow peter-panning. The diagnostic boxes are not floating: each box center
height equals half its box height, so each bottom face is at scene `y = 0`,
and the geometry-owned flat visual/raycast ground is also scene `y = 0`.
Record `479` accepts with `normalBias: 0`, source-owned Three shadows, local
L2 bound (`315 / 315` cache values), and hit pixels for every diagnostic box.
The primary artifact is
`tmp/atmosphere/reconciliation/479-m3-cpu-integrated-flat-local-sun-045deg-contact-shadows-480x270/images/canvas-image.png`.

Record
`480-m3-cpu-integrated-flat-local-sun-045deg-compact-shadow-camera-480x270`
supersedes `479` for the current shadow-contact review. It keeps the same
`san-jose-045deg-from-closest` scene and `normalBias: 0`, but changes the
source-owned directional shadow camera to a compact scene-object frame:
`lightDistanceSceneUnits = shadowFrame.extentSceneUnits * 4` and
`cameraFar = shadowFrame.extentSceneUnits * 8`. This avoids placing the
DirectionalLight shadow camera at the finite local Sun's kilometer-scale scene
distance when Three only needs the light direction for directional shadows.
Record `480` accepts at `480 x 270` with source-owned Three shadows, local L2
bound (`315 / 315` cache values), and hit pixels for every diagnostic box plus
the geometry-owned flat ground. The primary artifact is
`tmp/atmosphere/reconciliation/480-m3-cpu-integrated-flat-local-sun-045deg-compact-shadow-camera-480x270/images/canvas-image.png`.

Local-second-order lighting parity check: the old local runner's flat local
source endpoint light used a white `PointLight` with `decay = 0`, intensity
`2.4 * observerIncidentScale`, and low ambient fill. Its source-contract math
computes `observerIncidentScale` as
`referenceSpectralIncidentScale * (referenceDistance / distance)^2`. The
current reconciliation `LocalSunLightSource.sampleDirectLighting(...)` matches
that math exactly for the current `150 m` / `san-jose-045deg-from-closest`
input: both paths report distance `7119112.070777757 m`, falloff
`0.45460144854799356`, incident scale `0.5033233098516792`, and endpoint
light intensity `1.20797594364403`. The remaining endpoint-lighting difference
is the Three light object used when shadows are enabled: local-second-order
kept the local Sun as a `PointLight`, while the current reconciliation shadow
path uses a compact `DirectionalLight` for shadow-map control. The dark 45
degree review image is therefore not evidence of source-scale drift; if it
needs correction, treat it as endpoint Three lighting/shadow policy, not an
`evaluate(...)` or spectral-transport change.

Record
`482-m3-cpu-integrated-flat-local-sun-045deg-shaded-no-shadows-240x135`
renders the requested smaller diagnostic with source-owned shading enabled and
Three shadows disabled. The submitter now accepts `--shadows-enabled false`,
and the browser-side criterion now expects `shadows-disabled` when that payload
is supplied. Record `481` rendered the same image but was rejected only because
the browser acceptance criterion still hardcoded shadows-on. Record `482`
accepts with integrated CPU `evaluate(...)`, flat/local input, local L2 cache
bound (`315 / 315` cache values), every diagnostic box hit, and
`sceneLighting.lightingPolicy: source-driven-flat-local-point-light`. The
no-shadow scene lighting reports ambient `0.04`,
`observerIncidentScale = 0.5033233098516792`, `falloffScale =
0.45460144854799356`, `pointLightIntensity = 1.20797594364403`, and
`shadowPolicy: shadows-disabled`. The pre-shader image remains dark, matching
the shadowed image's baseline darkness closely enough to rule out the
DirectionalLight shadow branch as the primary cause.

Record
`483-m3-cpu-integrated-flat-local-sun-090deg-shadows-480x270` renders the
larger requested `480 x 270` integrated CPU flat/local scene using
`san-jose-090deg-from-closest`, i.e. `90` degrees along the local Sun orbit
from closest approach. It accepts with source-owned Three shadows, local L2
bound (`315 / 315` cache values), every diagnostic box hit, and the same
integrated CPU `evaluate(...)` path. The source-owned endpoint lighting reports
the expected lower `90`-degree orbit scale: `pointLightIntensity =
0.5492917826134377`. The primary artifact is
`tmp/atmosphere/reconciliation/483-m3-cpu-integrated-flat-local-sun-090deg-shadows-480x270/images/canvas-image.png`;
the raw endpoint scene is
`tmp/atmosphere/reconciliation/483-m3-cpu-integrated-flat-local-sun-090deg-shadows-480x270/images/pre-shader-scene-color.png`.

Record
`484-m3-cpu-integrated-flat-local-sun-090deg-fixed-endpoint-light-240x135`
updates the source-owned Three endpoint lighting policy: the local Sun still
provides direction for Lambert endpoint shading and shadows, and still reports
`observerIncidentScale` for Algorithm32 transport diagnostics, but the
captured endpoint scene no longer multiplies its Three light intensity by that
scale. This avoids pre-dimming the hit color before the CPU shader applies the
source-dependent spectral transport. The fixed endpoint light uses
`endpointSceneIncidentScale = 1` and `pointLightIntensity = 2.4`; the record's
diagnostics still report the local-source transport scale separately
(`observerIncidentScale = 0.22887157608893238`, `falloffScale =
0.2067167325354977`). Record `484` accepts at `240 x 135` with scene seed
`san-jose-090deg-from-closest`, source-owned Three shadows, local L2 bound
(`315 / 315` cache values), and every diagnostic box hit. Primary artifact:
`tmp/atmosphere/reconciliation/484-m3-cpu-integrated-flat-local-sun-090deg-fixed-endpoint-light-240x135/images/canvas-image.png`.

Records
`485-m3-cpu-integrated-flat-local-sun-135deg-fixed-endpoint-light-240x135`
and
`486-m3-cpu-integrated-flat-local-sun-180deg-fixed-endpoint-light-240x135`
render the requested small review images for `135` and `180` degrees from
closest approach. Both use the fixed endpoint-light policy from record `484`,
source-owned Three shadows, integrated CPU `evaluate(...)`, and local L2
cache binding (`315 / 315` cache values). Both accepted with every diagnostic
box hit. Record `485` reports `endpointSceneIncidentScale = 1`,
`pointLightIntensity = 2.4`, and transport-only `observerIncidentScale =
0.14811017678417482`; record `486` reports the same endpoint scene light scale
with transport-only `observerIncidentScale = 0.1292226561015886`. Primary
artifacts:
`tmp/atmosphere/reconciliation/485-m3-cpu-integrated-flat-local-sun-135deg-fixed-endpoint-light-240x135/images/canvas-image.png`
and
`tmp/atmosphere/reconciliation/486-m3-cpu-integrated-flat-local-sun-180deg-fixed-endpoint-light-240x135/images/canvas-image.png`.

Records
`487-m3-cpu-integrated-flat-local-sun-000deg-tilted-up-fixed-endpoint-light-240x135`
through
`491-m3-cpu-integrated-flat-local-sun-180deg-tilted-up-fixed-endpoint-light-240x135`
rerender the same five local Sun phase samples (`0`, `45`, `90`, `135`, and
`180` degrees from closest approach) after tilting the review camera upward.
The camera remains at `150 m`, with an explicit look-at target `250 m` high
and `800 m` out, reducing unused foreground and showing more sky while keeping
the same fixed endpoint-light policy, source-owned shadows, integrated CPU
shader path, and local L2 cache binding. Record
`492-m3-cpu-integrated-flat-local-sun-tilted-up-phase-stack-240x135` creates
the requested single stacked review image, ordered top-to-bottom as `0`, `45`,
`90`, `135`, and `180`:
`tmp/atmosphere/reconciliation/492-m3-cpu-integrated-flat-local-sun-tilted-up-phase-stack-240x135/images/local-sun-tilted-up-phase-stack.png`.

Records
`493-m3-cpu-integrated-flat-local-sun-000deg-tilted-up-source-scaled-light-240x135`
through
`497-m3-cpu-integrated-flat-local-sun-180deg-tilted-up-source-scaled-light-240x135`
rerun that same tilted-up five-phase set with the local endpoint light scale
turned back on through `endpointSceneLightScalePolicy =
observer-incident-scale`. This makes the source-owned Three light intensity
track the local Sun observer incident scale again while preserving the same
integrated CPU shader path, camera, shadows, and local L2 cache binding. The
recorded endpoint scales/intensities are approximately `1.000056 / 2.400134`,
`0.503323 / 1.207976`, `0.228872 / 0.549292`, `0.148110 / 0.355464`, and
`0.129223 / 0.310134` for `0`, `45`, `90`, `135`, and `180` degrees from
closest approach. Record
`498-m3-cpu-integrated-flat-local-sun-tilted-up-source-scaled-light-phase-stack-240x135`
writes the matching stack:
`tmp/atmosphere/reconciliation/498-m3-cpu-integrated-flat-local-sun-tilted-up-source-scaled-light-phase-stack-240x135/images/local-sun-tilted-up-source-scaled-light-phase-stack.png`.

Records
`499-m3-cpu-integrated-flat-local-sun-180deg-camera-toward-180sun-source-scaled-light-240x135`
through
`503-m3-cpu-integrated-flat-local-sun-135deg-camera-toward-180sun-source-scaled-light-240x135`
keep the source-scaled endpoint light, `150 m` camera height, `250 m`
look-at height, `800 m` look-at distance, and source-owned shadows, but rotate
the camera toward the `180`-degree local Sun source direction. The runner now
supports this through `--look-toward-scene-index 4`, which resolves the
look-at x/z target from the canonical local-flat source coordinates instead
of a hand-entered camera yaw. Because the original diagnostic boxes can move
out of frame when the camera turns, the browser and runner acceptance criteria
now use a payload-provided minimum diagnostic-box hit count; this review set
uses `3`. The scene also adds deterministic camera-forward review boxes
(`cameraForwardReviewBoxes = true`) so the sunward framing retains foreground
objects. Record
`504-m3-cpu-integrated-flat-local-sun-camera-toward-180sun-source-scaled-light-phase-stack-240x135`
writes the requested stack in phase order `0`, `45`, `90`, `135`, `180`:
`tmp/atmosphere/reconciliation/504-m3-cpu-integrated-flat-local-sun-camera-toward-180sun-source-scaled-light-phase-stack-240x135/images/local-sun-camera-toward-180sun-source-scaled-light-phase-stack.png`.

Record
`505-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-flat-ground-240x135`
adds the requested flat-ground ocean-colored scene. It uses closest-approach
local Sun (`scene-index 0`), points the camera toward that same source
direction (`look-toward-scene-index 0`), keeps the `150 m` camera height,
`250 m` look-at height, `800 m` look-at distance, `240 x 135` viewport,
integrated CPU shader path, source-scaled endpoint light, and local L2 cache
binding. The geometry-owned flat ground endpoint color is
`groundDisplayRgba = [69, 128, 111, 255]`, matching the earlier diagnostic
ocean matte color, and diagnostic boxes are disabled for this scene. Primary
artifact:
`tmp/atmosphere/reconciliation/505-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-flat-ground-240x135/images/canvas-image.png`.

Record
`507-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-240x135`
tries the Three.js `Water` addon for the same closest-approach, camera-toward-
sun ocean scene. The visible ground is a Water.js mesh using the same ocean
color `[69, 128, 111, 255]` and a deterministic procedural normal texture,
while hit depth and ray termination still come from the geometry-owned exact
flat ground raycast. The runner keeps the integrated browser CPU shader,
source-scaled endpoint light, local L2 cache, `150 m` camera height, `250 m`
look-at height, `800 m` look-at distance, `240 x 135` viewport, and diagnostic
boxes disabled. Record `506` exposed a diagnostics serialization bug because
the browser result attempted to return the Water mesh object graph; the scene
summary now records only JSON-safe Water material facts. Record `507` accepts
with `flat-earth / local-sun`, `SpectralReferenceEvaluator.evaluate`, local L2
cache binding (`315 / 315` values), and ground-only hit pixels. Primary
artifact:
`tmp/atmosphere/reconciliation/507-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-240x135/images/canvas-image.png`.
The pre-shader and shader images both show a right-edge Water.js visual
artifact, so treat this as a POC water trial rather than production water
behavior.

Record
`508-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-1m-240x135`
rerenders the Water.js POC scene with the camera lowered to `1 m` above the
flat ground. To isolate height from pitch, the look target was lowered by the
same `149 m` offset (`101 m` look-at height over the same `800 m` look-at
distance), preserving the previous upward pitch. The browser job accepted and
wrote both images, with the same right-edge Water.js visual artifact already
present in the pre-shader capture. The submitter record is rejected only by
`selected-hit-pixel-atmosphere-delta-present`: the selected ground hit is
about `4.6 m` away, so hit-pixel spectral transport is recorded and positive
but rounds to `0` RGBA byte delta. Primary artifact:
`tmp/atmosphere/reconciliation/508-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-water-js-ground-1m-240x135/images/canvas-image.png`.

Record
`509-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-matte-ground-150m-240x135`
retires the Water.js quick-test path from the active renderer and returns the
current ocean scene to geometry-owned Lambert matte ground. The ocean color is
kept as `groundDisplayRgba = [69, 128, 111, 255]`, the camera is back at
`150 m`, and the scene otherwise matches the previous closest-approach
camera-toward-sun setup: `250 m` look-at height, `800 m` look-at distance,
source-scaled endpoint light, integrated CPU shader path, local L2 cache, and
diagnostic boxes disabled. The browser result accepts with `flat-earth /
local-sun`, `SpectralReferenceEvaluator.evaluate`, local L2 cache binding
(`315 / 315` values), and ground hit distances from about `571 m` to
`48.7 km`. Primary artifact:
`tmp/atmosphere/reconciliation/509-m3-cpu-integrated-flat-local-sun-000deg-camera-toward-sun-ocean-matte-ground-150m-240x135/images/canvas-image.png`.

Record
`511-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-500m-box-240x135`
adds a single far-horizon review box to the current ocean matte baseline. The
box is `500 m` tall, `1 km x 1 km` in footprint, grounded on the flat plane,
and placed `160 km` along the camera/source-facing direction. Diagnostic boxes
remain disabled. Record `510` tried the same setup with a `300 m` tall box and
was superseded because the object was visible in the pre-shader image but the
single center-ray hit mask missed it. The far-review-box path now enables a
small subpixel raycast sample grid and prefers non-ground hits when a subpixel
sample catches the review object. Record `511` accepts with the review box
hit at about `159.5 km` (`2` hit pixels), local L2 cache binding (`315 / 315`
values), and selected-pixel transmittance mean about `0.00136`, producing the
expected heavy atmospheric fade. Primary artifact:
`tmp/atmosphere/reconciliation/511-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-500m-box-240x135/images/canvas-image.png`.

Record
`512-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-20kmx100kmx100km-box-240x135`
supersedes record `511` for far-horizon review visibility. The review box is
now `20 km` tall and `100 km x 100 km` wide/deep, with its near/front face
placed at about `160 km` along the camera/source-facing direction and its
center at about `210 km` because of the `100 km` depth. The same 150 m ocean
matte camera and source-scaled local-Sun setup is used, with diagnostic boxes
disabled and the optional far-review-box subpixel hit/depth capture enabled.
Record `512` accepts with `2154` review-box hit pixels; the box hit distances
range from about `160.0 km` to `168.6 km`. The selected review-box pixel has
transmittance mean about `0.00101`, so the pre-shader dark-orange object is
heavily fogged in the CPU shader output. Primary artifact:
`tmp/atmosphere/reconciliation/512-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-20kmx100kmx100km-box-240x135/images/canvas-image.png`.

Record
`513-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-240x135`
supersedes record `512` for the current Denali-height far-horizon review. The
review box is now `6.2 km` tall while keeping the `100 km x 100 km` footprint,
with its near/front face at about `160 km` and center at about `210 km`. The
same `150 m` ocean matte camera, closest-approach local Sun, source-scaled
endpoint light, disabled diagnostic boxes, and optional far-review-box
subpixel hit/depth capture are used. Record `513` accepts with `726`
review-box hit pixels; the box hit distances range from about `160.0 km` to
`167.7 km`. The selected review-box pixel has transmittance mean about
`0.00101`, so the pre-shader dark-orange horizon bar is heavily fogged in the
CPU shader output. Primary artifact:
`tmp/atmosphere/reconciliation/513-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-240x135/images/canvas-image.png`.

Record
`514-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-455x256`
rerenders the same current flat/local ocean scene at `256` image lines
(`455 x 256`). This is still the flat-earth/local-Sun scene, not the
spherical/globe renderer: the scene id is
`local-flat-ground-san-jose-000deg-closest`, with the same `150 m` camera,
ocean matte ground, closest-approach local Sun, and Denali-height
`6.2 km x 100 km x 100 km` box whose near/front face is `160 km` away. Record
`514` accepts with `2535` review-box hit pixels, local L2 cache binding
(`315 / 315` values), and box hit distances from about `160.0 km` to
`167.7 km`. Primary artifact:
`tmp/atmosphere/reconciliation/514-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-160km-6p2kmx100kmx100km-box-455x256/images/canvas-image.png`.

Record
`515-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-228x128`
updates the current flat/local far-horizon review object layout and renders it
at `128` image lines (`228 x 128`). The previous single centered
`6.2 km x 100 km x 100 km` box is replaced by two grounded
`6.2 km x 50 km x 100 km` orange review boxes. The left box has near/front
face distance `160 km` and lateral offset `-35 km`; the right box has
near/front face distance `240 km` and lateral offset `+35 km`, treating
"further back by half" as `50%` farther than `160 km`. Diagnostic boxes remain
disabled. Record `515` accepts with both review boxes hit: `368` left-box hit
pixels and `174` right-box hit pixels. The left box hit distances range from
about `160.3 km` to `225.9 km`; the right box hit distances range from about
`240.2 km` to `317.9 km`. Primary artifact:
`tmp/atmosphere/reconciliation/515-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-228x128/images/canvas-image.png`.

Record
`516-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-455x256`
rerenders the same two-box flat/local far-horizon review layout at `256`
image lines (`455 x 256`). The scene remains flat-earth/local-Sun with the
same ocean matte ground, `150 m` camera, disabled diagnostic boxes, left
`6.2 km x 50 km x 100 km` box at `160 km` near/front face and `-35 km`
lateral offset, and right matching box at `240 km` near/front face and
`+35 km` lateral offset. Record `516` accepts with both review boxes hit:
`1350` left-box hit pixels and `624` right-box hit pixels. The left box hit
distances range from about `160.3 km` to `251.3 km`; the right box hit
distances range from about `240.2 km` to `331.4 km`. Primary artifact:
`tmp/atmosphere/reconciliation/516-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-455x256/images/canvas-image.png`.

Record
`517-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-180deg-228x128`
rerenders the same two-box flat/local ocean scene at `128` image lines with
the local Sun moved to `180` degrees from closest approach. The camera remains
aimed along the closest-approach scene direction (`look-toward-scene-index 0`)
so this isolates the Sun phase change from the current object/camera layout.
The scene seed is `san-jose-180deg-from-closest`, and the endpoint light
diagnostics report `observerIncidentScale = 0.1292226561015886` and
`pointLightIntensity = 0.3101343746438126`. Record `517` accepts with both
review boxes hit: `368` left-box hit pixels and `174` right-box hit pixels,
matching the `128`-line geometry coverage from record `515`. Primary artifact:
`tmp/atmosphere/reconciliation/517-m3-cpu-integrated-flat-local-sun-ocean-matte-150m-two-denali-review-boxes-180deg-228x128/images/canvas-image.png`.

Record
`518-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-180deg-228x128`
rerenders record `517` with the camera elevation raised from `150 m` to
`500 m`. To preserve the same camera pitch, the look target was raised by the
same `350 m`, from `250 m` to `600 m`, over the same `800 m` look-at distance.
The scene seed remains `san-jose-180deg-from-closest`, the camera remains
aimed along the closest-approach scene direction, and the two Denali-height
review boxes keep the same front-face distances and lateral offsets. Record
`518` accepts with both review boxes hit: `367` left-box hit pixels and `173`
right-box hit pixels. Ground hit distances shift upward with the raised
camera, from about `566 m-49.6 km` in record `517` to about `1.89 km-165.5 km`
in record `518`. Primary artifact:
`tmp/atmosphere/reconciliation/518-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-180deg-228x128/images/canvas-image.png`.

Record
`519-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-228x128`
switches the current integrated flat/local review default from the historical
Step018/summer-derived degree seeds to
`san-jose-winter-solstice-2025-degree-offsets`. The new current review set uses
San Jose local noon on `2025-12-21T12:00:00-08:00`; the existing
annual-tropic-migration model resolves the source subpoint latitude to about
`23.4995S`. The rendered row uses the `180` degree offset from closest
approach while keeping the raised `500 m` camera, `600 m` look target, ocean
matte ground, two Denali-height review boxes, source-scaled endpoint light,
source-owned shadows, integrated CPU shader path, and local L2 cache binding.
At this winter-solstice 180-degree state, the resolved source altitude is about
`14.64 deg`, source azimuth is about `58.11 deg`, and the transport incident
scale at the observer is about `0.1894`. Record `519` accepts with both review
boxes hit: `367` left-box pixels and `173` right-box pixels. Primary artifact:
`tmp/atmosphere/reconciliation/519-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-228x128/images/canvas-image.png`.

Record
`520-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128`
renders the same winter-solstice 2025 two-box ocean-ground scene as record
`519`, but points the camera toward the recomputed winter `180` degree local
Sun direction with `look-toward-scene-index 4`. The scene seed remains
`san-jose-winter-solstice-2025-180deg-from-closest`, using
`2025-12-21T12:00:00-08:00`, source subpoint latitude about `23.4995S`, source
altitude about `14.64 deg`, source azimuth about `58.11 deg`, and observer
transport incident scale about `0.1894`. Record `520` accepts at `228 x 128`
with local L2 cache binding, source-owned shadows, both review boxes hit
(`367` left-box pixels and `173` right-box pixels), and the expected warmer
sunward horizon/box output. Primary artifact:
`tmp/atmosphere/reconciliation/520-m3-cpu-integrated-flat-local-sun-ocean-matte-500m-two-denali-review-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128/images/canvas-image.png`.

Record
`521-m3-cpu-integrated-flat-local-sun-ground-many-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128`
corrects that review back to the normal green ground / many-box fixture rather
than the ocean matte far-horizon two-box scene. It keeps the winter-solstice
2025 `180` degree scene seed and points the camera toward the recomputed
winter `180` source direction. The render uses the default ground display
RGBA `[86, 105, 66, 255]`, diagnostic boxes enabled, camera-forward review
boxes enabled for the turned camera, far-horizon review boxes disabled,
`150 m` camera height, `250 m` look target, source-scaled endpoint light,
source-owned shadows, integrated CPU shader path, and local L2 cache binding.
Record `521` accepts at `228 x 128`; five non-ground boxes are hit in frame:
the near green box, very-far magenta box, and the three sunward
near/mid/far review boxes. Primary artifact:
`tmp/atmosphere/reconciliation/521-m3-cpu-integrated-flat-local-sun-ground-many-boxes-winter-solstice-2025-180deg-camera-toward-180-228x128/images/canvas-image.png`.

Future follow-up note: visible Sun disk / direct solar-disc camera radiance is
recorded for later as `future-004` in the reconciliation gap ledger and in the
abstraction design's saved-for-later list. The intended direction is a
source-owned visible-emitter endpoint composed after `evaluate(...)`, not a
normal Three scene mesh captured as hit color. Distant Sun visibility should
use angular-radius coverage; local Sun visibility should use source
ray-sphere intersection; existing scene hit/depth facts should occlude it.
The expected composition remains `sourceEndpointRadiance * T_view + L_path`.
Open work includes spectral source-radiance calibration from irradiance and
solid angle, subpixel coverage for tiny disks, CPU/GPU parity, and display
policy for saturation/tone mapping.

Record
`522-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-plain-ground-camera-at-sun-228x128`
adds the requested Union Glacier Camp scene for `2021-12-14`. The constants now
include two reusable Union Glacier 2021 scene sets: the initially requested
longitude-0 synchronized solar-noon set, and the rendered
`union-glacier-camp-2021-dec14-far-side-orbit` set. Record `522` uses the
far-side set: the local Sun latitude is interpreted as the real-world
subsolar latitude for `2021-12-14` at longitude-0 solar noon, approximated by
the current annual-tropic-migration resolver at about `23.3477S`; closest
approach is aligned for Union Glacier Camp (`79.768036S`, `83.261666W`,
elevation `700 m`), and the source is placed at the `180` degree far-side
orbit offset. The
resolved source subpoint longitude is about `96.7383E`, source altitude about
`8.72 deg`, source azimuth about `96.74 deg`, observer distance about
`31,849 km`, and observer incident scale about `0.0618`. The camera points
toward that source azimuth with pitch derived from the source altitude
(`150 m` camera, `800 m` look distance, `272.67 m` look-at height). Terrain
features are disabled: diagnostic boxes, camera-forward boxes, and far-horizon
review boxes are all off, so only the geometry-owned flat ground is hit.
Record `522` accepts at `228 x 128` with local L2 cache binding and writes:
`tmp/atmosphere/reconciliation/522-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-plain-ground-camera-at-sun-228x128/images/canvas-image.png`.

Record
`524-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-reference-boxes-accepted-camera-at-sun-228x128`
adds grounded reference boxes to the same Union Glacier Camp far-side source
view. Record `523` produced the intended visual but was rejected by the
diagnostic-box acceptance criterion because the first submission did not enable
the diagnostic-box flag; record `524` reruns the same camera/source setup with
diagnostic boxes and camera-forward review boxes enabled. The camera remains
pointed at the far-side source azimuth with the `150 m` camera, `800 m`
look distance, and `272.67 m` look-at height derived from the `8.72 deg`
source altitude. Record `524` accepts at `228 x 128` with local L2 cache
binding, source-owned shadows, and three visible/reference box hits:
`local-flat-sunward-near-yellow-box` (`470` pixels,
about `1.52-1.69 km`), `local-flat-sunward-mid-white-box` (`496` pixels,
about `3.41-3.82 km`), and `local-flat-sunward-far-orange-box`
(`188` pixels, about `7.76-8.60 km`). Primary artifact:
`tmp/atmosphere/reconciliation/524-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-far-side-orbit-reference-boxes-accepted-camera-at-sun-228x128/images/canvas-image.png`.

Record
`526-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-closest-approach-reference-boxes-current-camera-228x128`
adds a reusable
`union-glacier-camp-2021-dec14-closest-approach` scene set and rerenders the
same Union Glacier reference-box landscape with the source moved from the
`180` degree far-side offset to the `0` degree closest-approach position.
The closest source resolves to the same azimuth direction (`96.74 deg`) but
much higher altitude (`37.58 deg`) and observer incident scale `1.0`. Record
`525` first pointed the camera directly at that higher source and produced an
all-sky no-hit frame, so record `526` keeps the current landscape framing from
record `524` (`150 m` camera, `800 m` look distance, `272.67 m` look-at
height) while changing only the source scene. Record `526` accepts at
`228 x 128` with local L2 cache binding, source-owned shadows, and the same
three reference-box hit counts as record `524`: near `470` pixels, mid `496`
pixels, and far `188` pixels. Primary artifact:
`tmp/atmosphere/reconciliation/526-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-closest-approach-reference-boxes-current-camera-228x128/images/canvas-image.png`.

Records `527` through `531` render the requested Union Glacier Camp
`2021-12-14` degree sequence from `180` down to `0` degrees from closest
approach, every `45` degrees. They use the new
`union-glacier-camp-2021-dec14-degree-offsets` scene set, keep the same
landscape framing as record `526` (`150 m` camera, `800 m` look distance,
`272.67 m` look-at height, camera aimed toward the closest-approach scene),
and keep diagnostic boxes, camera-forward review boxes, source-owned shadows,
the integrated CPU shader path, and local L2 cache binding enabled. Record
`532-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128`
composites the five accepted row images into one labeled vertical stack,
ordered top-to-bottom `180`, `135`, `90`, `45`, `0` degrees. Primary stack
artifact:
`tmp/atmosphere/reconciliation/532-m3-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-reference-boxes-phase-stack-180-to-000.png`.

The Union Glacier stack and the recent Denali/ocean/local-flat review scenes
are user-requested subjective inspection artifacts. They are useful for
spotting behavior and preserving discussion context, but their specific
locations, cameras, object layouts, colors, and composites are not design
fixtures or milestone acceptance gates unless explicitly promoted later.

Endpoint scene lighting policy note: the transport-neutral policy formerly
named `fixed-review-light-intensity` is now `endpoint-material-shading` and is
the default in the local-flat runner and light-source abstraction. This policy
lets Three lighting encode endpoint material color, Lambert shading, and
shadows without scaling the captured hit color by local Sun incident scale;
Algorithm32 then applies finite-source and atmospheric transport. The
`observer-incident-scale` policy remains only as an explicit comparison/review
mode for source-scaled endpoint lighting and should not be mixed into CPU/GPU
parity comparisons unless both sides use it deliberately.

Records `550` through `554` rerender the Union Glacier Camp `2021-12-14`
`180`, `135`, `90`, `45`, and `0` degree CPU rows with
`endpointSceneLightScalePolicy = endpoint-material-shading`, matching the
transport-neutral endpoint-light contract used by the GPU review stack. All
five rows accepted at `228 x 128` with diagnostic boxes, camera-forward review
boxes, source-owned shadows, the integrated CPU composer shader path, and
local L2 cache binding. Record
`555-m4-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-endpoint-material-shading-phase-stack-180-to-000-228x128`
composites those rows into the corrected CPU stack:
`tmp/atmosphere/reconciliation/555-m4-cpu-integrated-flat-local-sun-union-glacier-2021-dec14-endpoint-material-shading-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-cpu-endpoint-material-shading-phase-stack-180-to-000.png`.

The Denali-sized review box was moved from the camera-forward centerline to a
`100 km` camera-right lateral offset so it no longer hides between the
foreground reference boxes. Record `556` preserves the first corrected-CPU
Denali row before the offset change. Records `557` through `561` render the
right-offset Denali CPU rows for `180`, `135`, `90`, `45`, and `0` degrees,
and record
`562-m4-cpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128`
writes the CPU stack:
`tmp/atmosphere/reconciliation/562-m4-cpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-cpu-denali-200km-right-offset-phase-stack-180-to-000.png`.
Records `563` through `567` rerender the matching GPU rows with the same
right-offset Denali scene, and record
`568-m4-gpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128`
writes the GPU stack:
`tmp/atmosphere/reconciliation/568-m4-gpu-union-glacier-2021-dec14-denali-200km-right-offset-phase-stack-180-to-000-228x128/images/union-glacier-2021-dec14-gpu-denali-200km-right-offset-phase-stack-180-to-000.png`.
Pre-shader scene-color comparison for CPU records `557-561` against GPU
records `563-567` reports max byte delta `0` and `0 / 29184` differing pixels
for every phase, so any remaining image differences are shader-output
differences, not constructed-scene differences.

Record `570-m4-cpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-no-antialias-nearest-output-228x128`
adds the first Option 1 silhouette diagnostic. The local-flat runner now
accepts `--no-antialias`, which passes `antialias: false` to the browser scene
payload, forces the composer render target to `0` samples, and uses nearest
filtering for the CPU output texture copy. Record `570` accepted with
`rendererAntialias = false`, `renderTargetSampleCount = 0`,
`renderTargetSamples = disabled-single-sample-composer-target`, and
`cpuOutputTextureFilter = nearest-display-copy`. The result removes the soft
MSAA/linear-copy component of the bright silhouette fringe, but still leaves a
hard single-pixel stair-step at some box edges, so AA mismatch is confirmed as
a contributor rather than the full explanation.

Record
`571-m4-gpu-union-glacier-2021-dec14-000deg-denali-200km-right-offset-path-only-228x128`
adds the first GPU-only path-radiance diagnostic. `--endpoint-radiance-scale`
now controls captured endpoint-color contribution in both assembled GPU shader
composition and the CPU soft-shader composition path; record `571` renders
only the GPU backend with `endpointRadianceScale = 0`. Scene hits still
terminate view rays, but endpoint hit color is multiplied out, so the retained
image shows the shader's path-radiance contribution over object/ground/sky
ray lengths. The primary output is:
`tmp/atmosphere/reconciliation/571-m4-gpu-union-glacier-2021-dec14-000deg-denali-200km-right-offset-path-only-228x128/images/canvas-image.png`.

Record
`572-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-path-only-228x128`
adds the matching GPU-only path-radiance diagnostic for the `180` degree
Union Glacier row. It uses the same right-offset Denali scene, GPU backend,
source-owned shadows, local L2 cache binding, and `endpointRadianceScale = 0`
composition behavior as record `571`, but selects scene index `4`
(`180` degrees from closest approach). The render accepted; scene hits still
terminate rays while endpoint hit color is removed from the final composition.
The primary output is:
`tmp/atmosphere/reconciliation/572-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-path-only-228x128/images/canvas-image.png`.

Endpoint indirect lighting contract update: local-flat box placement can now
declare participation in a named endpoint indirect
approximation. The camera-forward review-box generator marks its three
foreground/reference boxes as participants; the renderer computes a local fill
anchor from those box placements and passes that packet into
`LocalSunLightSource.createThreeLightingObjects(...)`. The light source then
adds a non-shadow-casting PointLight named as a
`vacuum-endpoint-indirect-approximation`, with intensity derived from the
transport-neutral endpoint direct-light calibration. This stays outside
`evaluate(...)` and affects only the
captured endpoint scene color. Record
`573-m4-gpu-union-glacier-2021-dec14-180deg-denali-200km-right-offset-endpoint-indirect-fill-smoke-228x128`
preserves the first implementation attempt, where legacy diagnostic boxes also
participated and pulled the fill anchor toward the hidden wide diagnostic
layout. Record
`574-m4-gpu-union-glacier-2021-dec14-180deg-review-box-cluster-endpoint-indirect-fill-228x128`
tightens the contract so only the three camera-forward review boxes
participate, but it accidentally left the antialiasing/MSAA review path on.
Record
`575-m4-gpu-union-glacier-2021-dec14-180deg-review-box-cluster-endpoint-indirect-fill-no-antialias-228x128`
fixes the antialiasing regression but remains visually ineffective because the
fill is weak and centered inside the cluster; the near review box only reaches
pre-shader max RGB `[13, 16, 10]`. Record
`576-m4-gpu-union-glacier-2021-dec14-180deg-review-box-camera-side-endpoint-indirect-fill-no-antialias-228x128`
proved a camera-side local point fill can move the foreground out of
silhouette, but it also created a noticeable local lighting patch on the
ground. Record
`577-m4-gpu-union-glacier-2021-dec14-180deg-general-ambient-endpoint-fill-r025-no-antialias-228x128`
therefore supersedes the point-fill approach for now. The endpoint indirect
approximation is now `general-ambient-fill`: a source-owned scene-wide ambient
term derived from the transport-neutral endpoint direct-light calibration by
`--endpoint-ambient-fill-ratio`. Record `577` uses ratio `0.25`, producing fill
intensity `0.6`, total ambient intensity `0.64`, and direct endpoint light
intensity `2.4`; render quality still records `rendererAntialias = false`,
`renderTargetSampleCount = 0`, and `cpuOutputTextureFilter =
nearest-display-copy`. The near review box pre-shader range becomes min/max
RGB `[26, 19, 6]` / `[46, 36, 21]`, confirming visible non-silhouette endpoint
color without a local ground glow patch. Primary output:
`tmp/atmosphere/reconciliation/577-m4-gpu-union-glacier-2021-dec14-180deg-general-ambient-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.

Record
`578-m4-gpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128`
adds the requested weak directional-fill option. The selectable endpoint fill
policy now supports `general-ambient-fill` and `opposite-directional-fill`
through `--endpoint-fill-policy`; both use `--endpoint-ambient-fill-ratio` as
their transport-neutral endpoint fill ratio. The opposite-directional policy
adds a non-shadow-casting DirectionalLight from the anti-Sun horizontal
direction while preserving the Sun altitude magnitude, so the source-owned
direct light still casts shadows and Algorithm32 remains unchanged. Record
`578` uses ratio `0.25`, producing directional fill intensity `0.6`; base
ambient stays `0.04` instead of being raised to `0.64`. Render quality remains
single-sample (`rendererAntialias = false`, `renderTargetSampleCount = 0`,
`cpuOutputTextureFilter = nearest-display-copy`). The near review box
pre-shader range becomes min/max RGB `[12, 10, 2]` / `[44, 35, 10]`, while the
ground minimum stays near the old silhouette value at `[4, 4, 3]`, avoiding
the broad ambient ground lift from record `577`. Primary output:
`tmp/atmosphere/reconciliation/578-m4-gpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.

Record
`579-m4-cpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128`
rerenders the same scene and endpoint fill policy through the integrated CPU
composer shader. It changes only `shaderBackend` from `gpu` to `cpu` relative
to record `578`, while keeping no-antialias/single-sample rendering,
source-owned shadows, local L2 cache binding, the right-offset Denali review
box, and the opposite-directional endpoint fill ratio `0.25`. The record
accepts with the same hit counts as `578`: `8747` ground pixels, `486` near
yellow box pixels, `541` mid white box pixels, `210` far orange box pixels,
and `288` Denali box pixels. Primary output:
`tmp/atmosphere/reconciliation/579-m4-cpu-union-glacier-2021-dec14-180deg-opposite-directional-endpoint-fill-r025-no-antialias-228x128/images/canvas-image.png`.

Renderer-distance scene-hit capture probe: the local-flat integrated runner
now accepts `--scene-depth-capture-policy renderer-distance` as an opt-in
alternative to the default `raycaster` capture. The browser path uses an
existing hidden `ShaderMaterial` override pass: it renders the same scene and
camera into an offscreen target, each winning fragment writes packed
camera-to-fragment distance, and clear/no-fragment pixels remain no-hit. This
changes only the `sceneDepthBytes` / `sceneHitBytes` source consumed by the
Algorithm32 composer; scene color still comes from the normal composer
`RenderPass`, and object-name/count diagnostics still use the existing
raycaster diagnostic path. Record
`580-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-opposite-fill-no-antialias-228x128`
rerenders record `578` with this renderer-distance capture policy, no
antialiasing, source-owned shadows, local L2 cache binding, right-offset
Denali, and `opposite-directional-fill` ratio `0.25`. It accepts with
`sceneDepthCapturePolicy = renderer-distance`; shader-input hit pixels drop
from record `578`'s `10272` to `10081`, consistent with removing some
raycaster/raster silhouette disagreement. Primary output:
`tmp/atmosphere/reconciliation/580-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-opposite-fill-no-antialias-228x128/images/canvas-image.png`.

Endpoint camera-distance composition option: the integrated CPU/GPU composer
now accepts `--endpoint-camera-distance-scale-policy reverse-square` with
`--endpoint-camera-distance-reference-meters`,
`--endpoint-camera-distance-min-scale`, and
`--endpoint-camera-distance-max-scale`. This is a POC-only post-transport
endpoint composition boost:
`endpointScale = 1 + clamp((hitDistance / referenceDistance)^2, min, max)`.
It adds brightness to the captured endpoint scene-color term after Algorithm32
spectral transport; it does not enter `evaluate(...)`, does not change sky path
radiance, and does not change Three scene materials. When enabled by the
local-flat runner, endpoint indirect fill is suppressed so this non-directional
distance proxy does not pair with the current reverse-facing
`opposite-directional-fill` light. Syntax checks passed for the browser
composer, runner, local/distant shader contribution factories, and CPU soft
shader after this wiring.

Record
`581-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
rerenders the most recent Union Glacier GPU scene with
`--endpoint-camera-distance-scale-policy reverse-square`, reference distance
`200000 m`, min scale `0.05`, max scale `1`, renderer-distance scene-hit
capture, no antialiasing, source-owned shadows, and the same right-offset
Denali/review-box layout as record `580`. The runner accepted with
`effectiveEndpointIndirectFillEnabled = false` and
`endpointIndirectFillSuppressedByCameraDistanceScale = true`, so the
reverse-square endpoint composition proxy did not stack with
`opposite-directional-fill`. Shader-input hit pixels remain `10081`, matching
record `580`; object hit counts remain `8747` ground, `486` near yellow,
`541` mid white, `210` far orange, and `288` Denali. Primary output:
`tmp/atmosphere/reconciliation/581-m4-gpu-union-glacier-2021-dec14-180deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`582-m4-gpu-union-glacier-2021-dec14-090deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
renders the same GPU/review layout at `90` degrees from closest approach
(`sceneIndex = 2`). It keeps renderer-distance hit/depth capture, no
antialiasing, endpoint camera-distance scale `reverse-square`, reference
`200000 m`, min `0.05`, max `1`, source-owned shadows, and the same
right-offset Denali/review-box layout. It accepts with endpoint indirect fill
suppressed, source altitude `12.006470321633222 deg`, azimuth
`63.00878956315418 deg`, incident scale `0.11636135496061355`, and the same
`10081` shader-input hit pixels / object-hit counts as record `581`. Primary
output:
`tmp/atmosphere/reconciliation/582-m4-gpu-union-glacier-2021-dec14-090deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`583-m4-gpu-union-glacier-2021-dec14-045deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
renders the same GPU/review layout at `45` degrees from closest approach
(`sceneIndex = 1`). It keeps renderer-distance hit/depth capture, no
antialiasing, endpoint camera-distance scale `reverse-square`, reference
`200000 m`, min `0.05`, max `1`, source-owned shadows, and endpoint indirect
fill suppressed. It accepts with source altitude `19.853746253559972 deg`,
azimuth `54.93114692079673 deg`, incident scale `0.3101537614110556`, and the
same `10081` shader-input hit pixels / object-hit counts as records `581` and
`582`. Primary output:
`tmp/atmosphere/reconciliation/583-m4-gpu-union-glacier-2021-dec14-045deg-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`584-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
renders the San Jose winter-solstice review scene with the source at `90`
degrees from closest approach (`sceneIndex = 2`) while the camera looks toward
the `180` degree scene direction (`lookTowardSceneIndex = 4`). It keeps the
current GPU/review setup: renderer-distance hit/depth capture, no antialiasing,
endpoint camera-distance scale `reverse-square`, reference `200000 m`, min
`0.05`, max `1`, source-owned shadows, right-offset Denali/review-box layout,
and endpoint indirect fill suppressed. It accepts with source altitude
`19.13760122098663 deg`, azimuth `-6.995817502567756 deg`, incident scale
`0.31848646265063413`, `10319` shader-input hit pixels, and additional visible
diagnostic boxes because the camera is now aimed away from the active source
row. Primary output:
`tmp/atmosphere/reconciliation/584-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`585-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128`
renders the same San Jose winter-solstice review framing with the source at
closest approach (`sceneIndex = 0`) while the camera still looks toward the
`180` degree scene direction (`lookTowardSceneIndex = 4`). It keeps the same
GPU renderer-distance/no-antialias reverse-square endpoint-distance setup and
endpoint indirect fill suppression as record `584`. It accepts with source
altitude `35.51503446712982 deg`, azimuth `-121.88630000000002 deg`,
incident scale `1`, `10319` shader-input hit pixels, and the same object-hit
counts as record `584`. Primary output:
`tmp/atmosphere/reconciliation/585-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`586-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128`
rerenders record `585` with `endpointCameraDistanceScale.policy = none`. This
corrects the too-blue review result from record `585`: the reverse-square
endpoint distance option had clamped near ground/box endpoint color to its
minimum `0.05` scale, leaving atmospheric path radiance to dominate nearby
endpoint pixels. Record `586` keeps closest-approach source, camera looking
toward `180`, renderer-distance hit/depth capture, no antialiasing,
source-owned shadows, and the same San Jose review geometry. Endpoint indirect
fill is active again as `opposite-directional-fill` with intensity `0.6`, and
the record accepts with the same `10319` shader-input hit pixels and object-hit
counts as `585`. Treat `586`, not `585`, as the intended closest/San-Jose
look-180 review artifact unless explicitly testing the endpoint distance scale.
Primary output:
`tmp/atmosphere/reconciliation/586-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`587-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
fixes the reverse-square endpoint camera-distance option so it adds brightness
instead of setting/replacing endpoint brightness. The CPU and GPU composition
paths now use `1 + clamp((hitDistance / referenceDistance)^2, min, max)` for
the endpoint multiplier. The record rerenders the same closest/San-Jose
look-180 setup as `585` with reverse-square enabled, renderer-distance
hit/depth capture, no antialiasing, source-owned shadows, and endpoint
indirect fill suppressed. It accepts with the same `10319` shader-input hit
pixels and object-hit counts as `585`/`586`; generated GLSL contains
`endpointCameraDistanceBoostScale(...)` and applies the boost as an additive
factor above the normal endpoint contribution. Primary output:
`tmp/atmosphere/reconciliation/587-m4-gpu-san-jose-2025-winter-000deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.

Record
`588-m4-gpu-san-jose-2025-winter-180deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
rerenders the San Jose winter-solstice `180` degree row with both source and
camera aimed at `san-jose-winter-solstice-2025-180deg-from-closest`
(`sceneIndex = 4`, `lookTowardSceneIndex = 4`). It keeps renderer-distance
hit/depth capture, no antialiasing, source-owned shadows, and the corrected
additive reverse-square endpoint-distance composition option. It accepts with
source altitude `14.644366689327432 deg`, azimuth `58.11369999999999 deg`,
incident scale `0.18940463789109677`, endpoint indirect fill suppressed by
the active endpoint-distance option, and `10319` shader-input hit pixels.
Primary output:
`tmp/atmosphere/reconciliation/588-m4-gpu-san-jose-2025-winter-180deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.

Record
`589-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128`
rerenders the San Jose winter-solstice `90` degree row with the camera still
aimed at the `180` degree scene direction (`sceneIndex = 2`,
`lookTowardSceneIndex = 4`). It keeps renderer-distance hit/depth capture, no
antialiasing, source-owned shadows, and the corrected additive reverse-square
endpoint-distance composition option. It accepts with source altitude
`19.13760122098663 deg`, azimuth `-6.995817502567756 deg`, incident scale
`0.31848646265063413`, endpoint indirect fill suppressed by the active
endpoint-distance option, and `10319` shader-input hit pixels. Primary output:
`tmp/atmosphere/reconciliation/589-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-endpoint-distance-additive-no-antialias-228x128/images/canvas-image.png`.

Record
`590-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128`
rerenders record `589` with the new endpoint camera-distance/backlight option
disabled (`endpointCameraDistanceScale.policy = none`). The older
`opposite-directional-fill` endpoint fill is active again at ratio `0.25`
(`intensity = 0.6`), so this record is the comparison artifact for the
pre-distance-boost lighting path. It accepts with the same `90` degree source,
camera aimed at `180`, source altitude `19.13760122098663 deg`, azimuth
`-6.995817502567756 deg`, incident scale `0.31848646265063413`, and `10319`
shader-input hit pixels. Primary output:
`tmp/atmosphere/reconciliation/590-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

The local Sun endpoint lighting ambient floor is now lower: `LocalSunLightSource`
defaults `request.ambientIntensity` to `0.01` instead of `0.04`. This keeps the
endpoint scene lighting owned by the light-source abstraction while reducing the
pre-shader ambient wash that made near-object shadows barely visible.

Record
`591-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-endpoint-distance-scale-no-antialias-228x128`
rerenders record `590` after the ambient-floor reduction. It keeps the `90`
degree source, camera aimed toward `180`, renderer-distance hit/depth capture,
no antialiasing, `endpointCameraDistanceScale.policy = none`, and the older
`opposite-directional-fill` endpoint fill. It accepts with
`baseAmbientIntensity = 0.01`, `ambientIntensity = 0.01`, endpoint fill
intensity `0.6`, and `10319` shader-input hit pixels. Primary output:
`tmp/atmosphere/reconciliation/591-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Record
`592-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-fill-no-endpoint-distance-scale-no-antialias-228x128`
rerenders the same `90` degree San Jose comparison with endpoint indirect fill
disabled. This isolates the source-owned directional shadow light plus the new
low ambient floor. It accepts with `baseAmbientIntensity = 0.01`,
`ambientIntensity = 0.01`, `endpointIndirectFill = {"enabled":false,"policy":"none"}`,
and `10319` shader-input hit pixels. Primary output:
`tmp/atmosphere/reconciliation/592-m4-gpu-san-jose-2025-winter-090deg-looking-180-renderer-distance-depth-low-ambient-no-fill-no-endpoint-distance-scale-no-antialias-228x128/images/canvas-image.png`.

Records `593` through `597` rerender the Union Glacier Camp `2021-12-14`
phase rows through the integrated GPU local/flat shader at `456 x 256`. The
rows use scene set `union-glacier-camp-2021-dec14-degree-offsets`, source
offsets `180`, `135`, `90`, `45`, and `0` degrees from closest approach,
camera aimed toward closest approach (`lookTowardSceneIndex = 0`), renderer
distance hit/depth capture, no antialiasing, source-owned shadows, the
current low local-Sun ambient floor, the corrected additive reverse-square
endpoint-distance option, camera-forward reference boxes, and the Denali review
box. Record
`598-m4-gpu-union-glacier-2021-dec14-current-lighting-phase-stack-180-to-000-456x256`
composites the five accepted rows into a `502 x 1280` stack:
`tmp/atmosphere/reconciliation/598-m4-gpu-union-glacier-2021-dec14-current-lighting-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-current-lighting-phase-stack-180-to-000-456x256.png`.

Records `599` through `603` rerender the same `456 x 256` Union Glacier GPU
rows with the opposite-direction endpoint backlight active
(`endpointFillPolicy = opposite-directional-fill`,
`endpointCameraDistanceScale.policy = none`). This keeps the new low local-Sun
ambient floor and source-owned shadows, but disables the endpoint-distance
boost so the backlight is not suppressed. Record
`604-m4-gpu-union-glacier-2021-dec14-opposite-backlight-phase-stack-180-to-000-456x256`
composites the five accepted rows into a `502 x 1280` stack:
`tmp/atmosphere/reconciliation/604-m4-gpu-union-glacier-2021-dec14-opposite-backlight-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-opposite-backlight-phase-stack-180-to-000-456x256.png`.

The local Sun endpoint scene ambient approximation now preserves color before
the atmosphere shader by scaling the ambient floor by the light reaching the
observer: `ambientIntensity = baseAmbientIntensity * observerIncidentScale`
before optional endpoint fill. The default `baseAmbientIntensity` is now
`1.00`, raised from `0.04` and then `0.20` after the closest-approach Union
Glacier review still left endpoint boxes subjectively black.
Record `605` was a transient rejected browser-session closure while testing an
abandoned source-direction point-fill experiment; records `606` through `610`
accepted that experiment but it did not materially improve the review image.
Records `611` through `615` supersede it by rendering the Union Glacier GPU
rows with the observer-scaled ambient approximation, endpoint indirect fill
disabled, and endpoint-distance scaling disabled. Record
`616-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-phase-stack-180-to-000-456x256`
composites the five accepted rows into a `502 x 1280` stack:
`tmp/atmosphere/reconciliation/616-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-phase-stack-180-to-000-456x256.png`.
Record
`617-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r020-456x256`
rerenders the closest-approach Union Glacier GPU row with the raised
observer-scaled ambient default, renderer-distance hit/depth capture, no
antialiasing, source-owned shadows, endpoint indirect fill disabled, and
endpoint-distance scaling disabled. It accepts with source altitude
`37.57684752736655 deg`, azimuth `96.73833400000002 deg`,
`observerIncidentScale = 1.0000228033251901`, `baseAmbientIntensity = 0.2`,
`ambientIntensity = 0.20000456066503802`, and `40580` hit pixels. Primary
output:
`tmp/atmosphere/reconciliation/617-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r020-456x256/images/canvas-image.png`.
Record
`618-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r100-456x256`
rerenders the same closest-approach GPU row with `baseAmbientIntensity = 1.0`.
It accepts with `observerIncidentScale = 1.0000228033251901`,
`ambientIntensity = 1.0000228033251901`, and `40580` hit pixels. The
pre-shader capture now preserves recognizable endpoint colors for the yellow,
white, and orange review boxes, though the final shader output remains hazy
and muted by atmospheric composition. Primary output:
`tmp/atmosphere/reconciliation/618-m4-gpu-union-glacier-2021-dec14-000deg-observer-scaled-ambient-r100-456x256/images/canvas-image.png`.
Records `620` through `623` render the matching `180`, `135`, `90`, and `45`
degree GPU rows with the same `baseAmbientIntensity = 1.0` observer-scaled
ambient setup, renderer-distance hit/depth capture, no antialiasing,
source-owned shadows, endpoint indirect fill disabled, and endpoint-distance
scaling disabled. Record
`624-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256`
composites those four rows plus the accepted `0` degree row from record `618`
into the requested five-row stack. Primary output:
`tmp/atmosphere/reconciliation/624-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-phase-stack-180-to-000-456x256.png`.
Records `625` through `629` rerender the same five GPU phase rows at
`912 x 512`, preserving the `baseAmbientIntensity = 1.0` observer-scaled
ambient setup and all other review settings from record `624`. Record
`630-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512`
composites those rows into the higher-resolution POC review stack
(`958 x 2560`, including labels). Primary output:
`tmp/atmosphere/reconciliation/630-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-phase-stack-180-to-000-912x512.png`.
Records `631` through `635` rerender the same five GPU phase rows with the
observer/camera elevation lowered from `150 m` to `5 m`, keeping the
`912 x 512` row size, `baseAmbientIntensity = 1.0`, renderer-distance
hit/depth capture, no antialiasing, source-owned shadows, endpoint indirect
fill disabled, and endpoint-distance scaling disabled. Record
`636-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512`
composites those rows into the low-camera POC review stack (`958 x 2560`,
including labels). Primary output:
`tmp/atmosphere/reconciliation/636-m4-gpu-union-glacier-2021-dec14-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-observer-scaled-ambient-r100-5m-phase-stack-180-to-000-912x512.png`.

The spherical distant-Sun planet scene runner now has an explicit Union Glacier
clocked sample mode:
`--sun-sample union-glacier-2021-dec14-solar-noon-offset
--sun-clock-offset-degrees N`. The `0` degree row is anchored to real local
solar noon at Union Glacier Camp on `2021-12-14`; positive degree offsets
advance local solar time by four minutes per degree. This replaces the earlier
raw-vector-only spherical comparison attempt, because a raw direction did not
preserve the clock/date contract needed to compare against the flat/local
phase rows.

Local Sun synchronization policy note: `real-subsolar-longitude0-noon` is the
default policy for real-world-correspondence local/flat review scenes unless a
scene/profile explicitly selects another named policy. Under that policy, the
finite local Sun latitude is derived from the date's real-world subsolar
latitude: the latitude where the real Sun is directly overhead at solar noon
on longitude `0`. The local source clock is synchronized to that date-derived
longitude-0 noon anchor; closest approach and positive degree offsets are then
phase/time offsets from that synchronized state. Scene location/date remain
inputs, while source latitude is derived metadata for scenes selecting this
policy.

The spherical review scene preset
`planet-sphere-union-review-shadowed` adds the same review-box family to the
scaled planet-size spherical-ground scene: near yellow, mid white, far orange,
and the right-offset Denali-scale orange box. The browser scene object map now
registers those object names, and the planet box helper accepts scalar or
`[width,height,depth]` scene-unit sizes so the Denali-scale box can match the
flat/local review dimensions.

Records `637` and `638` are preserved rejected attempts from missing browser
scene-object registration/name-table wiring. Record `639` accepted a
raw-direction `0` degree spherical row but is superseded by the clocked sample
path. Records `641`, `642`, and `643` are rejected concurrent submissions
through the single watcher command file; they were rerun sequentially as
accepted records `645`, `646`, and `647`.

Accepted clock-synced spherical/distant GPU rows are:
`640` (`0` degree solar-noon row), `645` (`45`), `646` (`90`), `647` (`135`),
and `644` (`180`). They use `planet-sphere-union-review-shadowed`,
`912 x 512`, `5 m` observer altitude, `45` degree FOV, solid spherical ground,
shading and shadows enabled, the integrated GPU distant/spherical shader, and
the Union Glacier `2021-12-14` real-solar-noon clock anchor. Record
`648-m4-gpu-spherical-distant-union-review-solar-noon-clock-phase-stack-180-to-000-912x512`
composites the accepted rows into the requested five-row stack. Primary
output:
`tmp/atmosphere/reconciliation/648-m4-gpu-spherical-distant-union-review-solar-noon-clock-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-spherical-distant-solar-noon-clock-phase-stack-180-to-000-912x512.png`.

The distant/spherical endpoint scene lighting no longer applies the POC
ambient compensation used in record `648`. `PLANET_SCENE_AMBIENT_LIGHT_INTENSITY`
is now `0`, the distant-Sun scene object installs only the directional light
and its target, and `planetSceneEndpointLightFactor(...)` normalizes against
the directional light only. This keeps directional shading/shadows while
removing the ambient wash from distant-Sun spherical review captures.

Records `649` through `653` rerender the same clock-synced Union Glacier
spherical/distant GPU rows with no distant ambient compensation. Record `654`
is a rejected stack attempt caused by an overlong output path failing before
the `images` output could be written. Record
`655-m4-gpu-spherical-distant-no-ambient-stack-912x512` uses the accepted rows
and a shorter output path to write the current five-row stack. Primary output:
`tmp/atmosphere/reconciliation/655-m4-gpu-spherical-distant-no-ambient-stack-912x512/images/union-glacier-spherical-distant-no-ambient-stack-912x512.png`.

The spherical review scene set now also includes
`planet-sphere-union-review-unlit`, which uses the same Union Glacier review
boxes but omits the distant-Sun light object, uses
`lightingPolicy = unlit-endpoint-color`, and disables shadows. Records `656`
through `660` rerender the clock-synced spherical/distant GPU rows against
that unlit endpoint scene. Record
`661-m4-gpu-spherical-distant-unlit-stack-912x512` composites them into the
current no-shading/no-shadow comparison stack. Primary output:
`tmp/atmosphere/reconciliation/661-m4-gpu-spherical-distant-unlit-stack-912x512/images/union-glacier-spherical-distant-unlit-stack-912x512.png`.
The comparison shows the spherical/distant washout is not only the Three
ambient/directional endpoint scene lighting; even with MeshBasic/raw endpoint
colors and no scene shadows, the final shader-composed result remains heavily
brightened in most rows.

Record
`662-m4-gpu-spherical-distant-unlit-endpoint-scale-1-000deg-5m-912x512`
rerenders the unlit `0` degree row with `endpointRadianceScale = 1` instead
of the spherical default `5200`. This confirms the reverse-square/backlight
distance boost is not the active washout source: the shader still compiles the
generic `endpointCameraDistanceBoostScale(...)` helper, but the runtime policy
is `none`, making that boost `0` and the endpoint distance multiplier `1`.
The active whitening factor is the final composition term
`endpointLinearSrgb * transmittanceRgb * uEndpointRadianceScale`, where
`uEndpointRadianceScale` was still `5200` for records `648`, `649`-`653`, and
`656`-`660`. Primary output:
`tmp/atmosphere/reconciliation/662-m4-gpu-spherical-distant-unlit-endpoint-scale-1-000deg-5m-912x512/images/canvas-image.png`.

The Union Glacier spherical review presets now include a close single-story
building reference box named `union-review-close-single-story-building-box`.
It is currently a blue field-building/module reference approximately
`14 m x 6 m x 10 m`, centered at scene coordinates `[-0.012, -0.03]` km,
placing it about `30 m` from the camera and left of center. This replaces the
earlier long-building interpretation after the visual reference image showed a
closer blue camp module. It is included in both
`planet-sphere-union-review-shadowed`
and `planet-sphere-union-review-unlit`, and the browser scene-object registry
now registers that object name. Record
`663-m4-gpu-spherical-distant-unlit-close-building-scale-1-000deg-5m-912x512`
renders the earlier `0.5 km` placement. Record
`664-m4-gpu-spherical-distant-unlit-close-building-10m-scale-1-000deg-5m-912x512`
is preserved as a rejected visual attempt: moving the same building to about
`10 m` made it fill/occlude the frame and broke the expected ground/box hit
criteria. Record
`665-m4-gpu-spherical-distant-unlit-close-building-100m-scale-1-000deg-5m-912x512`
renders the intermediate `100 m` placement and accepts. Record
`666-m4-gpu-spherical-distant-unlit-blue-cabin-30m-scale-1-000deg-5m-912x512`
renders the right-of-center blue module placement. It is visually useful but rejected
by the legacy all-diagnostic-box criteria because the close cabin occludes the
far-right Denali-scale object; the browser job, canvas, ground, cabin, near
yellow, mid white, and far orange hits all rendered. Record
`667-m4-gpu-spherical-distant-unlit-blue-cabin-left-30m-scale-1-000deg-5m-912x512`
shifts the blue module to the left while keeping the same scale and distance;
it accepts with ground, cabin, near yellow, mid white, far orange, and
Denali-scale hits all present. Primary current output:
`tmp/atmosphere/reconciliation/667-m4-gpu-spherical-distant-unlit-blue-cabin-left-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
Record
`668-m4-gpu-spherical-distant-shadowed-blue-cabin-left-30m-scale-1-000deg-5m-912x512`
rerenders that same left-shifted cabin scene with distant-Sun endpoint
directional lighting and raycast shadows enabled; it accepts with the same
object hit counts as record `667`. Primary shadowed output:
`tmp/atmosphere/reconciliation/668-m4-gpu-spherical-distant-shadowed-blue-cabin-left-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
Record
`669-m4-gpu-spherical-distant-shadowed-blue-cabin-left-fill-r025-30m-scale-1-000deg-5m-912x512`
supersedes `668` for shadowed review after adding a distant-Sun endpoint
material-fill `AmbientLight` at `25%` of the directional key light. This is a
pre-shader material color preservation step only: it keeps shadowed surfaces
from collapsing to black before Algorithm32 composes endpoint color after
transport. The record accepts with the same object hit counts as `667` and
`668`. Primary current shadowed output:
`tmp/atmosphere/reconciliation/669-m4-gpu-spherical-distant-shadowed-blue-cabin-left-fill-r025-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
Records `670` through `674` diagnose why that shadowed review still looked
flat. The shadow frame was incorrectly derived from every object spec in the
shared table, including inactive legacy boxes, and the Denali-scale reference
was also too large/far to share one useful shadow-map frame with the close
module. The browser scene now sizes the distant-Sun shadow frame from active
scene objects only, and the Denali-scale reference remains visible and
raycastable outside the camera-local shadow frame. The endpoint material fill
is reduced to `10%` of the directional
key light to preserve color without flattening shading. Record
`673-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-45deg-5m-912x512`
is the readable side-light control with visible diagonal ground shadowing.
Record
`674-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-000deg-5m-912x512`
rerenders the original `0` degree view; because the camera is pointed almost
toward the Sun, shadows project mostly in screen depth and read as a broad
foreground band rather than long sideways shadows. Primary current shadowed
output:
`tmp/atmosphere/reconciliation/674-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-000deg-5m-912x512/images/canvas-image.png`.
Readable `45` degree shadow-control output:
`tmp/atmosphere/reconciliation/673-m4-gpu-spherical-distant-shadowed-blue-cabin-left-active-shadow-frame-fill-r010-45deg-5m-912x512/images/canvas-image.png`.
Follow-up implementation replaces the temporary Denali-specific exclusion
marker with a per-box `shadowRegion` option. The close cabin, near yellow,
mid white, and far orange review boxes are assigned `camera-local`; the
Denali-scale reference is assigned `distant-reference`. The current POC uses
the `camera-local` region to size the single high-detail review shadow frame,
while all objects remain visible and raycastable. Record
`675-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r010-000deg-5m-912x512`
rerenders the original `0` degree view through that per-box `shadowRegion`
implementation and accepts with the same visible/raycast hit set. Primary
current shadow-region output:
`tmp/atmosphere/reconciliation/675-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r010-000deg-5m-912x512/images/canvas-image.png`.
Record
`676-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-000deg-5m-912x512`
restores the `25%` endpoint material fill from record `671` while keeping the
per-box `shadowRegion` implementation. Record
`677-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-45deg-5m-912x512`
is the apples-to-apples successor to `671`: same `45` degree Sun offset and
`25%` material fill, but with the new `shadowRegion` box option. Primary
current color-preserving shadow-region output:
`tmp/atmosphere/reconciliation/677-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-45deg-5m-912x512/images/canvas-image.png`.
Records
`678-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-090deg-5m-912x512`
and
`679-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-135deg-5m-912x512`
rerender the same scene with later Union Glacier solar-noon clock offsets to
avoid the awkward camera-facing `0` degree Sun placement. Both keep identical
object hit coverage. The `90` degree row has Sun altitude/azimuth
`22.890431330327957 / 265.6291059864785`; the `135` degree row has
`15.87812592663214 / 222.4769102423786`. The current preferred composition is
the `135` degree row because it keeps endpoint color while making object faces
and ground shadow direction read more clearly:
`tmp/atmosphere/reconciliation/679-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-135deg-5m-912x512/images/canvas-image.png`.
Record
`680-m4-gpu-spherical-distant-shadowed-blue-cabin-left-mid-distance-cyan-shadow-region-r025-135deg-5m-912x512`
is preserved as a rejected wiring attempt: the submitter-side scene definition
included a new Union cyan review box, but the browser-side scene object
renderer map did not yet register that object name. Record
`681-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-r025-135deg-5m-912x512`
accepted after registering the object, but its `60 km` cyan reference sat too
close behind the white box to read cleanly. Record
`682-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-right-r025-135deg-5m-912x512`
is the current preferred spherical/distant Union review image: it adds
`union-review-distant-cyan-box`, a `6 km x 5 km x 6 km` cyan reference centered
at `[18, -60]` scene km with `shadowRegion = distant-reference`. The accepted
render keeps the `135` degree Sun offset and `25%` endpoint material fill,
reports `3978` hit pixels for the distant cyan box, and provides a separate
hazy reference behind the nearer yellow/white boxes:
`tmp/atmosphere/reconciliation/682-m4-gpu-spherical-distant-shadowed-blue-cabin-left-distant-cyan-right-r025-135deg-5m-912x512/images/canvas-image.png`.
Records `683`, `684`, `685`, and `686` render the matching `180`, `90`, `45`,
and `0` degree rows for that same scene. Together with record `682` for
`135` degrees, they preserve the clock-sync contract:
`--sun-sample union-glacier-2021-dec14-solar-noon-offset`, where the `0`
degree row is real local solar noon at Union Glacier on `2021-12-14` and the
positive degree offsets advance the clock by four minutes per degree. Record
`687-m4-gpu-spherical-distant-union-review-distant-cyan-clock-synced-phase-stack-180-to-000-912x512`
stacks those five accepted GPU rows in `180, 135, 90, 45, 0` order. Primary
current full stack:
`tmp/atmosphere/reconciliation/687-m4-gpu-spherical-distant-union-review-distant-cyan-clock-synced-phase-stack-180-to-000-912x512/images/union-glacier-2021-dec14-gpu-spherical-distant-distant-cyan-clock-synced-stack-180-to-000-912x512.png`.
Matching `0` degree shadow-region output:
`tmp/atmosphere/reconciliation/676-m4-gpu-spherical-distant-shadowed-blue-cabin-left-shadow-region-r025-000deg-5m-912x512/images/canvas-image.png`.
Earlier right-of-center `30 m` output:
`tmp/atmosphere/reconciliation/666-m4-gpu-spherical-distant-unlit-blue-cabin-30m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
Earlier `100 m` output:
`tmp/atmosphere/reconciliation/665-m4-gpu-spherical-distant-unlit-close-building-100m-scale-1-000deg-5m-912x512/images/canvas-image.png`.
Earlier `0.5 km` output:
`tmp/atmosphere/reconciliation/663-m4-gpu-spherical-distant-unlit-close-building-scale-1-000deg-5m-912x512/images/canvas-image.png`.
