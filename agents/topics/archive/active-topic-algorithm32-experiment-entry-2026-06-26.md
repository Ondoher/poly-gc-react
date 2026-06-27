# Archived Active Topic

Archived from `agents/topics/active-topic.md` on 2026-06-26 because the active
Algorithm32 bootstrap was relaxed to production design. This file preserves the
former experiment-heavy entry as history; it is not the active topic entry
path.

# Active Topic

Current active topic: `algorithm32`

Current focus: production Algorithm32 design under
`agents/topics/apps/flat/algorithm32/`. The local Sun second-order
experimental lane under
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/`
and `scripts/flat/local-second-order/` is closed as accepted POC evidence.
This is still design stage; do not promote implementation into
`shared/algorithm32/` until the production API and module boundaries are
explicitly accepted.

Parent app/topic: `flat`.

Production destination:
`agents/topics/apps/flat/algorithm32/` is the documentation home for the
production Algorithm32 module, and `shared/algorithm32/` is where the shared
production implementation will live. Keep the cleanroom/shader-lab docs as
evidence and design history, then promote durable production contracts into
the app-side Algorithm32 documentation folder.
The current production design entry point is
`agents/topics/apps/flat/algorithm32/production-design.md`.
Current UX/config design note: local Sun setup should default to calibration,
not a brightness knob. Use current view location/current date by default,
synchronize local closest approach to standard solar zenith, derive the clock
offset and source power, and allow recalibration at any time. Orbit direction
and period are standardized model behavior, while resolved orbital speed can be
shown as an instantaneous derived display value for the current simulation time
and location.

Closed POC evidence note:
local Sun second-order scattering/cache planning is tracked under
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/`.
The accepted POC implementation bundle for that work is centralized under
`shared/algorithm32/POC/`; the copied runners have been reduced to pure
importable modules with old filename re-export shims, the original non-shader
`bruneton-start-fresh` base algorithm is preserved there as a pared-down POC
module, and the bundle passes its import/execution smoke proof. These modules
are the clean POC basis to test and promote into production Algorithm32 code.
The experimental lane is now complete enough for production design. Further
work should promote accepted contracts through the production design sequence
rather than adding new local-lane POC behavior by default.

Runner contract:
browser experiment commands for this lane go through
`scripts/flat/local-second-order/harness.js --watch` and
`tmp/atmosphere/local-second-order/browser-command.json`; do not use manual
one-shot `--once` commands for experiment work. Do not track live runner state
in documentation. Inspect the heartbeat/process state at execution time if a
task needs to know whether a watcher is live. The harness timeout/recovery path
classifies browser evaluation timeouts as recovery-required, skips
post-timeout screenshot/canvas capture, and closes the page/browser before a
later command can run. The harness does not force `--use-gl=swiftshader` by
default; integrated shader runs should use hardware WebGL when Chromium can
access it, with `--use-swiftshader` reserved for explicit fallback
diagnostics. The initial browser smoke artifact
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/` remains accepted;
it proved page load, WebGL2 availability, PNG capture, criteria output,
provenance/state-goal output, and running-log continuity.

Flat false-Sun source contract:
the flat app now resolves the false Sun's latitude from an
`annual-tropic-migration` model between `23.5 deg N` and `23.5 deg S` for the
configured date, then rotates that latitude ring once per solar day. The
local-second-order browser page derives its local Algorithm32 source positions
from that same model, treats positive requested subjective degrees as
clockwise forward solar time from closest approach, and recalibrates closest
approach to unit incident scale; the earlier fixed `24 deg N` baked source
table is superseded.
The forward-time vertical local stack is accepted at
`tmp/atmosphere/local-second-order/088-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w/`
with `30/30` criteria passing and no page errors.
The summer-solstice local-vs-spherical comparison stack is accepted at
`tmp/atmosphere/local-second-order/093-southern-france-obj-diffuse-high-local-distant-solstice-time-pai/`
with `60/60` criteria passing and no page errors. It uses working date
`2026-06-21`, computes San Jose solar noon as local transit/highest Sun at
`13:09`, aligns flat local closest approach with spherical distant solar noon,
renders local solar time in each row header (`13:09`, `16:09`, `19:09`,
`22:09`, `01:09 +1d`), and pairs each flat local integrated-shader row on the
left with a spherical distant integrated-shader row on the right using the
same camera pose/direction. Each image label includes the modeled Sun sky
position as azimuth and altitude in degrees for that source model. Artifact
`090` is superseded because it forced civil `12:00` as solar noon and lacked
the per-image azimuth/altitude labels.
The opposite daylight stack is accepted at
`tmp/atmosphere/local-second-order/092-southern-france-obj-diffuse-high-distant-local-solstice-daylight/`
with `60/60` criteria passing and no page errors. It computes solar noon as
the San Jose `2026-06-21` local transit/highest-altitude instant (`13:09`)
only to synchronize clocks: distant solar noon maps to flat local closest
approach, and the five evenly spaced sunrise-to-sunset rows use the same signed
hour-angle/time offset in both models. The rows are `05:47`, `09:28`, `13:09`,
`16:50`, and `20:31`, with spherical distant images on the left, flat local
images on the right, and camera yaw centered on the spherical distant sunset
bearing. Each image label now includes the modeled Sun sky position as
azimuth and altitude in degrees for that source model. Artifact `091` is
superseded by `092` only because it lacked those per-image azimuth/altitude
labels.

Current local-second-order milestone status:
the lane runner `node scripts/flat/local-second-order/run-milestones.js`
accepted the local Sun second-order POC through Milestone 12. Accepted
artifacts are `003` through `009`, `011`, `012`, and `020` through `022`
under `tmp/atmosphere/local-second-order/`; browser evidence artifacts `018`
and `019` are also accepted. Rejected artifact `002` recorded a stale
criterion-name mismatch, and rejected artifact `010` recorded the important
cache-frame ambiguity: a local `z/rho` cache must store `incomingDirection` in
a Sun-subpoint local radial/tangential/up frame, not raw world coordinates.
`011-local-cache-shape` fixes that and accepted with max cache-vs-direct error
`1.734723475976807e-18` absolute and `1.5929386378311196e-16` relative.
`012-cpu-soft-shader-local-l2` accepted the CPU soft-shader local L2 matrix
for distant midday, distant sunset behind camera, local closest, and local
`90` degree cases. `013-three-integrated-gpu-local-l2-blocked` is superseded:
the centralized Three pass now exposes `flat-local-second-order-atmosphere`,
uploads the local cache as a `Data3DTexture`, and samples it in GLSL using the
Sun-subpoint local radial/tangential/up frame. `020` accepted the integrated
GPU local L2 path, `021` accepted the objective/subjective matrix with
CPU/GPU selected-center deltas of `0` for closest and `2` for local `90`, and
`022` accepted production promotion notes in
`agents/topics/apps/flat/algorithm32/README.md`.

Latest local subjective comparison:
`tmp/atmosphere/local-second-order/030-subjective-l2-cache-comparison/`
renders the four shader-lab subjective source scenes from a local-lane scene
generator and writes side-by-side first-order versus second-order/cache views
at `subjective-l2-cache-comparison-gallery.png`. It is the corrected accepted
artifact for this request: the browser captures `031` through `034` use the
same elevated camera `[0, 6200, 1400]` and the same terrain spec generated by
`src/gc/utils/random.js` as shader-lab artifact `157`; distant-midday
sky/hit counts match accepted shader-lab capture `158` (`39030` sky,
`90570` hit). Earlier `025-subjective-l2-cache-comparison` is superseded
because its local browser fallback used a different LCG terrain generator and
changed the silhouette, and `024` is a rejected WebGL-context diagnostic.

Milestone 13 initial spike:
`tmp/atmosphere/local-second-order/037-three-terrain-integrated-distant-midday/`
is accepted. It proves `three.terrain.js` can be installed/imported as the
optional `three-terrain-js` terrain backend, with package `Math.random` scoped
to the lane deterministic LCG, a far-ground catch surface retained, and the
distant-midday scene rendered through the integrated
`Algorithm32AtmospherePass` in `distant-first-order-atmosphere` mode. Criteria
passed `10/10`; the image is `canvas-image.png`. Partial folder `035` is
superseded by the sparse-coverage fix because full-pixel raycasting against
the denser package terrain wedged the launcher. The full four-case
package-terrain soft-shader/L2 gallery remains optional follow-up work.
Follow-up `040-three-terrain-integrated-distant-midday-wide-v3-480` accepted a
richer `PerlinLayers`/`ridge-valley-v2`/vertex-color package preset but put the
camera at `10500 m`, which made the spherical horizon visibly curved. Current
accepted low-camera package-terrain follow-up is
`041-three-terrain-integrated-distant-midday-low-camera`, with
`cameraPositionMeters: [0, 1200, 5200]`,
`lookAtMeters: [0, 1550, -36000]`, and `verticalFovDegrees: 58`; it passed
`10/10` and writes `canvas-image.png`. It removes the aircraft-altitude horizon
issue, but still reads visually too smooth/flat. Future subjective terrain work
should add foreground/midground detail, texture/scatter, or stronger silhouettes
rather than only changing procedural height noise.
Earlier package-terrain detail reference
`042-three-terrain-integrated-distant-midday-detail-v4` kept the `041` low
camera, added a repeated deterministic surface texture, and added a merged
detail mesh with `180` outcrops (`1,137` triangles). It passed `10/10`; image:
`tmp/atmosphere/local-second-order/042-three-terrain-integrated-distant-midday-detail-v4/canvas-image.png`.
`044-three-terrain-integrated-distant-midday-ridge-lines-v6` supersedes `042`
as the current subjective terrain reference. It raises the camera to
`[0, 4200, 9800]`, looks toward `[0, 3900, -52000]`, widens FOV to `62 deg`,
and strengthens `14` raised ridge-line strips while keeping `180` outcrops and
the deterministic surface texture. Criteria passed `10/10`; image:
`tmp/atmosphere/local-second-order/044-three-terrain-integrated-distant-midday-ridge-lines-v6/canvas-image.png`.
Asset-backed terrain follow-up
`047-rocky-land-heightmap-integrated-distant-midday-v3` is accepted as the
current Rocky Land and Rivers terrain option. It uses
`payload.terrainBackend: "rocky-land-heightmap"` on the existing
`three-terrain-integrated-distant-midday` browser command, loads the CC0
`Designs/landscapes/Rocky Land and Rivers.zip` height map copied to
`scripts/flat/local-second-order/page/assets/rocky-land-and-rivers/Height Map PNG.png`,
samples it into one Three `BufferGeometry` with `36,864` vertices and `72,962`
triangles, extends the mesh under the camera, and renders through the same
integrated distant-midday Algorithm32 pass. Criteria passed `11/11`, including
a selected sparse hit on `rocky-land-and-rivers-heightmap-terrain`; image:
`tmp/atmosphere/local-second-order/047-rocky-land-heightmap-integrated-distant-midday-v3/canvas-image.png`.
`045-rocky-land-heightmap-integrated-distant-midday` is superseded because its
lower foreground still hit the simple catch plane before the asset mesh, and
`046-rocky-land-heightmap-integrated-distant-midday-v2` is superseded by the
same image with the stronger terrain-mesh-hit criterion.
Current Southern France terrain work is tracked by Milestones 14 through 18 in
the local second-order experiment plan. They integrate
`Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip`
as a terrain alternative: preflight/staging, geometry-only OBJ backend
`southern-france-obj-geometry`, diffuse-textured backend
`southern-france-obj-diffuse`, four-case subjective matrix, and terrain
backend closeout. Local inspection found the Blender OBJ package has the same
geometry as the 3D Coat package but complete material references:
`268,472` vertices, `122,937` triangle faces, `28` materials, and `0` missing
referenced textures. First visual proof is accepted at
`tmp/atmosphere/local-second-order/048-southern-france-obj-geometry-distant-midday/`.
It stages only the OBJ/MTL under
`scripts/flat/local-second-order/page/assets/southern-france-blender-obj/`,
uses the geometry-only backend, renders through the integrated distant-midday
pass, and passes `11/11` criteria with selected hits on
`southern-france-obj-terrain-*` meshes. Diffuse texture proof is accepted at
`tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/`.
It extracts the `28` diffuse TGA maps into the lane page assets, loads them in
the browser with Three `TGALoader`, assigns material-specific matte
`MeshStandardMaterial` instances for the `207` runtime OBJ meshes, records
`0` fallback materials, and passes `11/11` criteria through the integrated
distant-midday pass in about `16.4 s`. Image:
`tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/canvas-image.png`.
This is the next interesting visual result: real diffuse terrain color/detail
over the accepted OBJ geometry. Next terrain step is Milestone 17: run the
four subjective source cases with `southern-france-obj-diffuse`. This runway
must not change Algorithm32 or the local second-order cache.
Terrain dark-line diagnostic: `050-southern-france-obj-diffuse-distant-midday-2x`
accepted the same view at `960x540`; simple output resolution did not remove
the recurring black terrain dots/lines. `053-southern-france-obj-diffuse-shader-off-2x`
accepted the same view with `Algorithm32AtmospherePass` intentionally disabled
(`scene-only-no-atmosphere`), and the marks are still visible in raw Three
scene color. That makes "the atmosphere shader sometimes leaves a pixel
uncolored" unlikely for this symptom. The OBJ diffuse backend does not apply
the local procedural vertex-coloring path; it uses per-material diffuse TGA
maps. Next diagnostic, if needed, should compare textured lit materials against
unlit/basic diffuse and/or flat average material colors to separate texture
content from lighting/normal/mesh issues.
Follow-up `054-southern-france-obj-mesh-only-white-shader-off-2x` accepted a
stronger simplification: `southern-france-obj-geometry`, no bottom catch
plane, `Algorithm32AtmospherePass` disabled, and one unlit white
`MeshBasicMaterial` applied to the unchanged OBJ mesh. It passed `11/11`, had
`runtimeMeshCount: 207`, and image stats `minByte: 135`, `maxByte: 255`, with
no visible black dots/lines. This shows the artifact is not inherent to the
OBJ geometry alone; the remaining suspects are textured/lit material behavior,
normals under `MeshStandardMaterial`, or the removed catch-plane/material
interaction.
Follow-up `055-southern-france-obj-mesh-only-white-standard-shader-off-2x`
accepted the next one-factor reintroduction: same OBJ geometry, no bottom
catch plane, no textures, no vertex colors, atmosphere disabled, but a lit
white `MeshStandardMaterial`. The black dots/lines returned visually, and
image stats dropped to `minByte: 38` from `054`'s `minByte: 135`. This
narrows the issue to Three's standard material lighting/normal path for this
mesh, not textures, catch-plane depth fighting, raw geometry coverage, or the
Algorithm32 shader.
Follow-up `056-southern-france-obj-white-standard-full-ambient-shader-off-2x`
accepted the next light-isolation step: same as `055`, but ambient fill raised
to `1`. The black marks are suppressed and image stats return to
`minByte: 135`, `maxByte: 255`, close to the clean unlit `054` case. This
means the dots/lines are primarily low-fill `MeshStandardMaterial`
lighting/normal darkness: terrain faces or interpolated normals are receiving
little direct light and rendering very dark when ambient is only `0.06`.
Follow-up `057-southern-france-obj-white-standard-ambient-only-shader-off-2x`
accepted the direct source-light isolation step: same white
`MeshStandardMaterial`, no textures, no vertex colors, no catch plane, and
atmosphere disabled, but the source `DirectionalLight` is disabled and ambient
fill remains `1`. The terrain renders as uniform gray without the dot/line
pattern; selected terrain sample is `[153, 153, 153]`. This pins the visual
artifact to the source directional light interacting with OBJ normals/facets,
not ambient-only standard material, raw geometry, textures, catch plane, or
Algorithm32.
Follow-up `058-southern-france-obj-white-standard-aa-downsample-shader-off`
accepted the sampling/presentation diagnostic: same setup as `055`
(`MeshStandardMaterial` plus source `DirectionalLight`, no textures, no vertex
colors, no catch plane, atmosphere disabled), but rendered internally at
`1920x1080` with WebGL antialiasing and downsampled to `960x540`. Numeric
dark extrema remained (`minByte: 38`), so the lit facets still exist, but the
visual reads as terrain detail rather than single-pixel defects. Treat
supersampling/antialiasing as a review-quality presentation requirement, not
as a physics/model fix.
Accepted conclusion: the apparent black/dark dots were undersampled real
terrain lighting detail from the source-lit OBJ facets/normals. The low-quality
single-pixel presentation was masking terrain detail by making it look like a
defect. Do not continue treating this symptom as missing shader color,
texture failure, vertex-color leakage, or catch-plane z-fighting unless new
evidence appears.
Full textured path restored at
`059-southern-france-obj-diffuse-aa-downsample-atmosphere`: Southern France
diffuse TGA backend, source `DirectionalLight`, integrated
`distant-first-order-atmosphere` pass, `rendererAntialias: true`, and
`renderScale: 2` (`1920x1080` internal downsampled to `960x540`). Criteria
passed `11/11`, page errors were `0`, material fallbacks were `0`, and runtime
was about `36.7 s`. Image:
`tmp/atmosphere/local-second-order/059-southern-france-obj-diffuse-aa-downsample-atmosphere/canvas-image.png`.
Use this as the current subjective Southern France diffuse terrain reference
before running the four-case matrix.
Paired shader-off comparison accepted at
`060-southern-france-obj-diffuse-aa-downsample-shader-off`: same Southern
France diffuse backend, source `DirectionalLight`, `rendererAntialias: true`,
and `renderScale: 2`, but with `Algorithm32AtmospherePass` disabled. Criteria
passed `11/11`, page errors were `0`, and runtime was about `11.6 s`.
Side-by-side review image:
`tmp/atmosphere/local-second-order/060-southern-france-obj-diffuse-aa-downsample-shader-off/with-without-shader-comparison.png`.
Live Three shadow-map follow-up accepted at
`061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows`: same
Southern France diffuse backend and integrated atmosphere pass as `059`, but
with payload `enableShadows: true` and `shadowMapSize: 4096`. Criteria passed
`12/12`, including `three-shadow-maps-enabled`; diagnostics record a
directional-light shadow map and `208` scene meshes casting/receiving shadows.
The side-by-side shadow comparison is
`tmp/atmosphere/local-second-order/061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows/with-without-three-shadows-comparison.png`.
The result is much darker because live terrain shadows are now layered over
shadow-like detail already baked into the diffuse texture.
Close-camera follow-up accepted as `062` and `063`. The lane now supports a
payload `cameraOverride` with optional `cameraGroundClearanceMeters` and
`lookAtGroundClearanceMeters`; the accepted close view placed the camera
`450 m` above the raycast terrain surface at `[0, *, 15800]`, producing final
camera position `[0, 3157.6099179376324, 15800]`. `062` uses the close camera
with Three shadows on and passed `12/12`; `063` uses the same close camera
with Three shadows off and passed `11/11`. Comparison:
`tmp/atmosphere/local-second-order/063-southern-france-obj-diffuse-close-terrain-atmosphere-no-shadows/close-terrain-with-without-shadows-comparison.png`.
This view shows that the OBJ itself has stepped/striped terrain detail and
shadow-like baked texture features before live shadows; live shadow maps make
those features significantly harsher.
Receive-only shadow diagnostic accepted as
`064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec`. It
uses the same close camera and `enableShadows: true`, but payload
`shadowPolicy: "receive-only"` makes terrain meshes receive shadows without
casting them. Criteria passed `12/12`; diagnostics record
`castShadowMeshCount: 0` and `receiveShadowMeshCount: 208`. The receive-only
image is byte-for-byte identical to the no-shadows `063` image
(`maxAbsByteDelta: 0`), while the full cast+receive `062` image has the dark
shingle-like bands. Comparison:
`tmp/atmosphere/local-second-order/064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec/close-terrain-shadow-policy-comparison.png`.
Conclusion: the shingle bands are terrain self-shadowing/shadow-map acne from
the OBJ mesh, not Algorithm32 atmosphere and not baked texture alone.
High-altitude receive-only follow-up accepted as
`065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec`. It
uses the original high Southern France camera `[0, 6200, 15800]`,
`enableShadows: true`, and `shadowPolicy: "receive-only"`. Criteria passed
`12/12`; diagnostics again record `castShadowMeshCount: 0` and
`receiveShadowMeshCount: 208`. The high receive-only image is byte-for-byte
identical to high no-shadows `059` (`maxAbsByteDelta: 0`). Comparison:
`tmp/atmosphere/local-second-order/065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec/high-altitude-shadow-policy-comparison.png`.
Current subjective request status:
the requested no-shadows Southern France with/without full-shader comparison
is accepted as split one-case browser artifacts `070` through `073`. Each
artifact places raw Three scene color without the full Algorithm32 atmosphere
shader on the left and the integrated shader result on the right, using
`southern-france-obj-diffuse`, `rendererAntialias: true`, `renderScale: 2`,
and Three shadows disabled. `070` is distant midday, `071` is distant sunset
behind camera, `072` is local closest, and `073` is local `90`. All four
passed `10/10` criteria with hardware WebGL renderer
`ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)`;
the local rows used `flat-local-second-order-atmosphere` with `315` local
incident-cache entries. Partial artifacts `066`, `067`, and `069` contain
only `command.json`; `068-southern-france-obj-diffuse-high-four-case-with-without-shader`
is a rejected timeout artifact and should be used only as failure evidence.
Follow-up fitted local-angle subjective views are accepted as `077` through
`079`. They add local `135` and local `180` degree orbit views and rerender
local `90` with the same yaw-only camera policy. The camera keeps the accepted
high Southern France position/FOV and look-at elevation, but rotates
horizontally toward the local Sun bearing at `180` degrees. The local-180-facing
terrain fit rotates and widens the staged OBJ footprint so the finite mesh
does not expose the catch plane on the right edge. `077`, `078`, and `079`
all passed `10/10` criteria through hardware NVIDIA/ANGLE WebGL and used
`flat-local-second-order-atmosphere`; their center coverage rays share the
yawed direction `[0.8591988702281546, -0.028950139421190506,
-0.5108220735502298]`. Earlier artifacts `074` through `076` are superseded
because they exposed the original finite OBJ footprint in the 180-facing view.
New shader-only local stack artifact `080` is accepted. It vertically stacks
integrated-shader images only for local closest, local `45`, local `90`, local
`135`, and local `180`, with every row looking toward the local Sun bearing at
`180` degrees and using the fitted Southern France OBJ footprint. The local
`45` source uses the accepted atmosflat evidence position
`[-2175398.8819482913, 4758279.812089166, 4828003.52]` and observer incident
scale `0.5033091181134656`. Artifact `080` passed `30/30` criteria with
hardware NVIDIA/ANGLE WebGL; gallery layout is `960 x 3010`, integrated
Algorithm32 shader image only.
Star-field follow-up artifact `086` is accepted for the same shader-only
vertical local stack, but it is primarily calibration evidence rather than a
visibly starry art pass. The shared integrated shader now supports optional
procedural apparent-magnitude point sources: stars are added only on sky rays
as top-of-atmosphere radiance, divided by pixel solid angle, attenuated by the
same view transmittance used by the atmosphere path, and composed before the
shared tone map. `086` passed `30/30` criteria with hardware NVIDIA/ANGLE
WebGL and records `starField.enabled: true`, `intensity: 1`, `density: 1.15`,
and `pointSize: 1.15` for every `flat-local-second-order-atmosphere` row.
Against no-star baseline `080`, the real-magnitude contribution is
sub-perceptual in the current fixed-exposure PNG: the local sky bands changed
by at most one byte in only `2` to `4` sampled sky pixels per band. Rejected
artifact `081` is failure evidence for a temporary GLSL brace error; `082`
through `085` are superseded star-visibility calibration attempts.

Minimal reload for new or compacted agents:

1. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/README.md`
2. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md`
3. `scripts/flat/local-second-order/README.md`
4. `shared/algorithm32/POC/README.md`
5. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/README.md`

Do not reload shader-lab historical docs, retired atmosphere docs, or
`atmosflat32` source material unless a milestone explicitly needs source
details not captured in the local lane docs or checked-in evidence registry.

Canonical Algorithm32 background:
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`.
Load this only when a milestone needs the accepted Algorithm32 steps,
source/geometry abstractions, endpoint status, open issues, or production
followups beyond the local second-order lane docs.
Current copied evidence from `tmp/atmosphere` is preserved under
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/`.
Legacy non-cleanroom Flat docs with potentially useful reference/source
material are copied under
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/legacy-reference-docs/`.

Current shader-lab endpoint background:
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
`081-browser-lit-scene-input-cpu-postprocessor`. The accepted browser capture
wrote unlit/material-control plus lit/shadow scene packets. The CPU
postprocessor then ran Algorithm32 pixel-for-pixel over the captured packets as
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
`080`. Criteria passed `6/6`: browser capture accepted, lit
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
child-process harness spawning failed with `spawn EPERM`. Historical
shader-lab reruns used direct shell-level `harness.js --once` commands or
existing browser artifacts; that does not apply to the current
local-second-order lane, which is watcher-only.

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

Browser-process contract: use the user-owned `harness.js --watch` loop for
browser artifacts. Do not launch Chrome from the agent tool path unless the
user explicitly asks, and do not clean up by killing generic Chrome processes.
Before triggering a run, inspect the heartbeat/process state and write the
command to the live heartbeat-reported `commandPath`. Do not record live
process state in documentation. The harness supports `--page-timeout-ms` and
defaults to `300000 ms`.
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
AGENTS bootstrap files. The older detailed artifact history later in this file
is background only; do not reload it unless the prompt or user explicitly asks
for it.

Minimal local-second-order reload path:

1. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/README.md`
   - Treat this as the lane entrypoint and current status summary.
2. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md`
   - Use the milestone list, acceptance gates, runner contract, and reusable
     experiment discipline from this file.
3. `scripts/flat/local-second-order/README.md`
   - Use this for the active watcher contract and command JSON/heartbeat
     paths.
4. `shared/algorithm32/POC/README.md`
   - Load only when implementing or validating shared POC modules.
5. `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/README.md`
   - Load only when a milestone needs checked-in accepted evidence.

Current first target:
use the accepted local second-order POC as production-promotion input. The
shared import smoke proof is accepted, the local browser smoke artifact
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/` is accepted,
CPU/local-cache proof is accepted through `012-cpu-soft-shader-local-l2`, and
Milestones 10 through 12 are accepted by `020`, `021`, and `022`.
`013-three-integrated-gpu-local-l2-blocked` is superseded history. Browser
commands use `tmp/atmosphere/local-second-order/browser-command.json` through
the watcher contract; do not run manual one-shot harness commands for this
lane. Live runner state belongs to heartbeat/process inspection at execution
time, not to documentation.

Do not load shader-lab historical docs, `atmosflat32` prompt/artifacts,
production flat shader notes, object-color closeout, old atmosphere
reset/rejected docs, historical artifact logs, browser benchmark command JSON,
or the accepted `054` endpoint artifact during bootstrap unless the user
explicitly asks. The local lane docs and checked-in evidence registry are the
minimal context.

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
