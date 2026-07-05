# Reconciliation POC Current State

Status: Milestone 2 is closed. Record `050-m2-closeout` accepts M2 as a CPU
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

Milestone 3 is the next active milestone: GPU distant Sun and spherical Earth,
using the accepted M1 CPU distant/spherical implementation as the comparison
anchor. The current shader design lives in
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

Milestone 2 is closed. The next default work is Milestone 3: GPU distant Sun,
spherical Earth, using the accepted M1 CPU distant/spherical path as the
reference. Start from the shader operation design, especially cache-owned
texture/access assembly through `TextureBuilder`, `ThreeGateway`, setup/config
lifecycles, bindings, symbol inventory, and invalidation. Keep browser watcher
and comparison mechanics in the action plan / experiment-runner layer. Do not
make `ThreeGateway` own image capture: screenshots and image artifacts are
runner outputs, while other useful operational information flows through
bounded diagnostics, capability packets, setup reports, or selected shader
diagnostic outputs. Do not make `ThreeGateway` own default scene lighting:
scene builders decide whether
lighting is included, Algorithm32/source configuration supplies lighting
parameters in predefined units, and `ThreeGateway` synchronizes those values
onto requested Three light handles. Do not treat M2 closeout as production
local/flat promotion: final
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
