# Local Second-Order Browser Runner

This folder is the script lane for the local Sun second-order POC. The lane is
closed as accepted experimental evidence for the production Algorithm32 design
pivot. Keep it available for evidence replay or narrowly scoped diagnostics;
do not add new production behavior here by default.

The browser harness is intentionally separate from the shader-lab harness. It
reuses the same long-running watch pattern, but writes artifacts under the new
lane output root:

```text
tmp/atmosphere/local-second-order/
```

Watcher-only rule for this lane:

```text
Do not run the harness manually with --once for experiment work.
Use the user-owned --watch process and edit browser-command.json.
Do not record whether the watcher is currently running in documentation;
inspect heartbeat/process state at execution time.
```

Run a long-lived browser process that watches a command file:

```text
node scripts/flat/local-second-order/harness.js --watch
```

Defaults:

```text
command path: tmp/atmosphere/local-second-order/browser-command.json
heartbeat:    tmp/atmosphere/local-second-order/harness-heartbeat.json
timeout:      300000 ms
WebGL:        hardware WebGL by default; pass --use-swiftshader only for fallback diagnostics
```

Durable runner behavior: do not launch duplicate watchers and do not run
manual one-shot harness commands for experiment work. The harness
timeout/recovery path classifies browser evaluation timeouts as
recovery-required, skips post-timeout screenshot/canvas capture against the
wedged page, and closes the page/browser with a bounded wait before the next
command. The harness does not force `--use-gl=swiftshader` by default, because
that made the integrated WebGL shader run through CPU software rendering. Use
`--use-swiftshader` only when intentionally testing the fallback path.
The initial browser smoke artifact is accepted at:

```text
tmp/atmosphere/local-second-order/001-browser-runner-smoke/
```

The default `browser-smoke` command proves the browser page can load, expose
`window.runLocalSecondOrderCommand`, draw/read deterministic canvas
diagnostics, confirm WebGL2 availability, return a PNG data URL, and write a
complete numbered artifact with `state-goal.md`, `inputs.json`,
`provenance.json`, `equations-and-constants.json`, `criteria-results.json`,
`report.md`, `run.log`, screenshot, and selected-pixel diagnostics.

Fatal browser/page failures should not stop the watch loop. Page crashes,
closed pages, Puppeteer protocol disconnect-style errors, or unexpected
harness-side command errors are recorded as rejected artifacts, the heartbeat
records recovery state, and the watch loop attempts to reopen the browser page
before the next command.

Plain browser-side evaluation errors, such as a `ReferenceError` from a missing
helper function, are also caught and written as rejected artifacts. They should
not request page recovery unless Puppeteer reports a closed/disconnected
target. The page includes an intentional probe for this:

```json
{
  "id": "reference-error-probe",
  "label": "reference-error-probe",
  "type": "throw-reference-error"
}
```

Browser evaluation timeouts are a recovery-required failure. The rejected
artifact `068-southern-france-obj-diffuse-high-four-case-with-without-shader`
showed that `Browser command evaluation timed out.` can leave in-page WebGL
work consuming CPU even after the harness writes a rejected artifact. The
harness now forces page/browser recovery for that timeout class and avoids
post-timeout screenshot/canvas work.

Integrated-shader performance should be judged with hardware WebGL. The old
local harness launch forced SwiftShader (`--use-gl=swiftshader`), which routes
WebGL through CPU software rendering and can make a single high-resolution
shader frame look like a processor-eating loop. New artifacts record WebGL
vendor/renderer diagnostics so accidental software fallback is visible.

Later local second-order milestones should add browser command types behind
the same entrypoint instead of creating a second harness.

Run the CPU/local-cache milestone loop:

```text
node scripts/flat/local-second-order/run-milestones.js --from 1 --to 12
```

Current milestone status: accepted through `022-promotion-notes`. The old
blocked artifact `013-three-integrated-gpu-local-l2-blocked` is superseded by:

```text
018-three-integrated-local-l2-probe
019-three-integrated-local-l2-probe
020-three-integrated-gpu-local-l2
021-objective-subjective-local-l2-matrix
022-promotion-notes
```

The browser page now supports `three-integrated-local-l2`, which builds the
local incident cache from `shared/algorithm32/POC/local-second-order/`, uploads
it as a Three `Data3DTexture`, and renders
`flat-local-second-order-atmosphere` through the shared
`Algorithm32AtmospherePass`.
Local source-matrix rows derive their finite Sun positions from the flat app's
annual tropic-migration model: the configured scene date resolves the latitude
between `23.5 deg N` and `23.5 deg S`, the north-pole
azimuthal-equidistant latitude ring rotates clockwise by the requested local
offset, positive subjective degrees mean forward solar time from closest
approach, and the closest row is calibrated to unit Algorithm32 incident
scale.
The accepted browser artifact for this convention is:

```text
tmp/atmosphere/local-second-order/088-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w/
```

The accepted summer-solstice local-vs-spherical comparison artifact is:

```text
tmp/atmosphere/local-second-order/093-southern-france-obj-diffuse-high-local-distant-solstice-time-pai/canvas-image.png
```

It uses `payload.galleryMode:
"with-shader-local-distant-side-by-side"`, working date `2026-06-21`, and
local closest approach aligned to spherical distant solar noon. Solar noon is
computed as the San Jose local transit/highest-altitude instant (`13:09`) and
used only as the sync anchor between flat local closest approach and distant
solar noon. Each row header prints the modeled local solar time (`13:09`,
`16:09`, `19:09`, `22:09`, `01:09 +1d`). The left column is the flat local Sun
with the integrated shader; the right column is the spherical distant Sun at
the same local solar time and same camera pose/direction. Each image label
includes that image's Sun sky position as azimuth and altitude in degrees for
the source model. Artifact `093` passed `60/60` criteria; artifact `090` is
superseded because it forced civil `12:00` as solar noon and lacked those
per-image sky-position labels, and artifact `089` is superseded because only
its camera-match criterion read a matrix field that the lightweight coverage
summary does not preserve.

The accepted opposite sunrise-to-sunset comparison artifact is:

```text
tmp/atmosphere/local-second-order/092-southern-france-obj-diffuse-high-distant-local-solstice-daylight/canvas-image.png
```

It uses `payload.galleryMode:
"with-shader-distant-local-sunrise-sunset-side-by-side"`, working date
`2026-06-21`, and five evenly spaced spherical daylight samples. Solar noon is
computed as the San Jose local transit/highest-altitude instant (`13:09`) and
used only as the sync anchor between distant solar noon and flat local closest
approach. Rows render at local solar times `05:47`, `09:28`, `13:09`, `16:50`,
and `20:31`; the spherical distant image is on the left, the flat local image
is on the right, and both use the same camera pose/direction yawed toward the
spherical distant sunset bearing. Each image label includes that image's Sun
sky position as azimuth and altitude in degrees for the source model. Artifact
`092` passed `60/60` criteria; artifact `091` is superseded because it lacked
those per-image sky-position labels.

Current reconciliation divergence:

The shared installed `Algorithm32AtmospherePass` now uses endpoint composition
policy
`captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy` for hit
pixels. This inverse-tone-maps captured scene color into the shader's
pre-tone-map scale, composes it with RGB transmittance before tone mapping,
and replaces the earlier post-tone-map display RGB add. This is a
reconciliation review proxy, not the true matte
`albedo * surfaceIrradiance / PI` contract. Record
`096-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset` preserved
the first direct captured-linear proxy attempt, which looked overly blue and
almost snow-field-like. Record
`097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset` preserves
the same-scene inverse-tone-map proxy rerun, which looked much more plausible.
The rerender target was the same sunrise-to-sunset gallery mode as artifact
`092`:
`with-shader-distant-local-sunrise-sunset-side-by-side`, with spherical
distant Sun on the left and flat local Sun on the right.

Latest subjective follow-up:

```text
node scripts/flat/local-second-order/subjective-l2-cache-comparison.js
```

The accepted corrected artifact is:

```text
tmp/atmosphere/local-second-order/030-subjective-l2-cache-comparison/
```

It generates the four shader-lab subjective scenes through the local browser
command `subjective-scene-capture`, then writes first-order versus
second-order/cache side-by-side PNGs and
`subjective-l2-cache-comparison-gallery.png`. The local source scenes use the
local `z/rho/direction` incident cache; distant scenes are visual controls.
The corrected run passes the full `mountain-detail-v1` scene spec generated by
`src/gc/utils/random.js` into the browser. Earlier artifact `025` is
superseded because its fallback browser terrain generator used a different RNG
and changed the skyline.

Local source tint reversal experiment:

```text
node scripts/flat/local-second-order/harness.js --watch
node scripts/flat/local-second-order/local-source-neutral-spectrum-comparison.js
```

The watcher command must be running first. The comparison runner submits two
`three-terrain-integrated-source-matrix` browser commands through the watcher:
the accepted Southern France local-source vertical stack using the existing
app-fixture source tint, then the same stack with only
`payload.sourceColorOverride` changed to neutral white
`{ r: 1, g: 1, b: 1 }`. The runner writes a numbered artifact containing the
two browser-run links, the accepted-tint gallery, the neutral-white gallery,
a side-by-side comparison PNG, a diff image, criteria, report, and run log.
This experiment is intended to show the actual integrated-shader output effect
of removing the inherited flat-app RGB source tint from local source spectral
scale.

Milestone 13 initial spike:

`037-three-terrain-integrated-distant-midday` is accepted. It proves the
package import and a `three-terrain-js` backend can feed a live Three scene,
depth texture, and integrated `Algorithm32AtmospherePass` distant-midday image.
The command type is:

```text
three-terrain-integrated-distant-midday
```

It is intentionally lighter than the full soft-shader comparison path: it uses
a sparse coverage summary instead of a full per-pixel scene packet because the
first package attempt with full-pixel raycasting wedged the browser launcher.
The rendered image is:

```text
tmp/atmosphere/local-second-order/037-three-terrain-integrated-distant-midday/canvas-image.png
```

The full four-case package-terrain gallery from the experiment plan remains
available as follow-up work if richer subjective terrain is still desired.

Latest package-terrain follow-ups:

```text
tmp/atmosphere/local-second-order/040-three-terrain-integrated-distant-midday-wide-v3-480/canvas-image.png
tmp/atmosphere/local-second-order/041-three-terrain-integrated-distant-midday-low-camera/canvas-image.png
```

`040` used the richer package preset (`PerlinLayers`, `ridge-valley-v2`
shaping, height/slope vertex colors) plus a pulled-back wide camera, but the
camera height was `10500 m` and showed unwanted spherical-horizon curvature.
`041` lowered the same profile to `cameraPositionMeters: [0, 1200, 5200]`,
`lookAtMeters: [0, 1550, -36000]`, and `verticalFovDegrees: 58`; it accepted
with `10/10` criteria and is the current low-camera package-terrain image.
It still looks too smooth/flat, so the next useful terrain step is adding real
foreground/midground detail or textures/scatter, not just more height noise.

Current detail update:

```text
tmp/atmosphere/local-second-order/042-three-terrain-integrated-distant-midday-detail-v4/canvas-image.png
```

`042` keeps the low camera from `041`, adds a repeated deterministic surface
texture, and adds one merged detail mesh with `180` outcrops (`1,137`
triangles). It accepted with `10/10` criteria and is the current
package-terrain subjective reference.

Current raised-ridge reference:

```text
tmp/atmosphere/local-second-order/044-three-terrain-integrated-distant-midday-ridge-lines-v6/canvas-image.png
```

`044` raises the package-terrain camera to `[0, 4200, 9800]`, looks toward
`[0, 3900, -52000]`, widens FOV to `62 deg`, and strengthens the raised
ridge-line strips. It accepted with `10/10` criteria and currently supersedes
`042` for subjective terrain review.

Current asset-backed terrain option:

```text
tmp/atmosphere/local-second-order/047-rocky-land-heightmap-integrated-distant-midday-v3/canvas-image.png
```

Run it through the existing command type by setting
`payload.terrainBackend` to `rocky-land-heightmap`. The backend reads the CC0
Rocky Land and Rivers height map copied under
`scripts/flat/local-second-order/page/assets/rocky-land-and-rivers/`, samples
it into a single Three `BufferGeometry`, and renders through the same live
scene/depth `Algorithm32AtmospherePass` path as the package terrain spike.
`047` accepted with `11/11` criteria, `36,864` vertices, and `72,962`
triangles, including a selected sparse hit on the asset terrain mesh. `045` is
superseded because its lower foreground still hit the simple catch plane
before the asset mesh, and `046` is superseded by the same image with the
stronger terrain-mesh-hit criterion.

Next planned terrain runway:

The experiment plan defines Milestones 14 through 18 for the Southern France
Blender OBJ package:

```text
Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip
```

Planned backend values:

```text
southern-france-obj-geometry
southern-france-obj-diffuse
```

Start with the geometry-only backend through the existing distant-midday
command shape:

```json
{
  "type": "three-terrain-integrated-distant-midday",
  "payload": {
    "terrainBackend": "southern-france-obj-geometry",
    "terrainSeed": "southern-france-blender-obj-v1"
  }
}
```

The Blender OBJ inspection found `268,472` vertices, `122,937` triangle faces,
`28` materials, and no missing referenced texture files. Do not load all
textures first; Milestone 15 proves geometry and placement, Milestone 16 adds
diffuse texture color, Milestone 17 runs the four subjective cases, and
Milestone 18 records the terrain backend recommendation.

First Southern France visual:

```text
tmp/atmosphere/local-second-order/048-southern-france-obj-geometry-distant-midday/canvas-image.png
```

`048` accepted with `11/11` criteria using the geometry-only backend. It stages
only the OBJ and MTL under
`scripts/flat/local-second-order/page/assets/southern-france-blender-obj/`,
loads the OBJ with Three `OBJLoader`, applies a single matte material, remaps
source Z-up coordinates into the lane Y-up scene, and proves selected sparse
hits on `southern-france-obj-terrain-*` meshes.

First Southern France diffuse visual:

```text
tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/canvas-image.png
```

`049` accepted with `11/11` criteria using the `southern-france-obj-diffuse`
backend. It loads the same OBJ through `OBJLoader`, extracts and serves the
`28` diffuse TGA maps, loads them with Three `TGALoader`, assigns matched
matte materials to the `207` runtime OBJ meshes, and records no material
fallbacks or page errors. This is the first interesting visual result for
terrain color/detail before the later review-quality antialias/downsample
renders. The later no-shadows four-case source matrix uses
`payload.terrainBackend: "southern-france-obj-diffuse"` and is accepted as
split artifacts `070` through `073`.

Current black-line diagnostic:

```text
tmp/atmosphere/local-second-order/053-southern-france-obj-diffuse-shader-off-2x/canvas-image.png
```

`053` accepted with `11/11` criteria using the same terrain backend at
`960x540` with `payload.disableAtmospherePass: true`. The page records pass
mode `scene-only-no-atmosphere`, so the image is raw Three scene color with
the Algorithm32 atmosphere shader off. The recurring black terrain dots/lines
are still visible, which means this symptom is not the atmosphere shader
failing to provide color. The OBJ diffuse backend uses diffuse TGA material
maps, not the procedural vertex-color path. `051` and `052` are partial
superseded attempts that used the heavier full scene-packet capture path.

Current mesh-only isolation diagnostic:

```text
tmp/atmosphere/local-second-order/054-southern-france-obj-mesh-only-white-shader-off-2x/canvas-image.png
```

`054` accepted with `11/11` criteria using:

```json
{
  "terrainBackend": "southern-france-obj-geometry",
  "sceneSimplification": "mesh-only-white",
  "disableAtmospherePass": true
}
```

The diagnostic removes the bottom catch plane and applies a single unlit white
material to the unchanged OBJ mesh. The black dots/lines are not visible, so
future diagnostics should reintroduce scene/material factors one at a time.

Current standard-material isolation diagnostic:

```text
tmp/atmosphere/local-second-order/055-southern-france-obj-mesh-only-white-standard-shader-off-2x/canvas-image.png
```

`055` accepted with `11/11` criteria using the same mesh-only setup but with
`sceneSimplification: "mesh-only-white-standard"`. It reintroduces only a lit
white `MeshStandardMaterial`; textures, vertex colors, the bottom catch plane,
and the atmosphere pass remain disabled. The black dots/lines return in this
image, so the current lead is standard-material lighting/normals.

Current full-ambient lighting diagnostic:

```text
tmp/atmosphere/local-second-order/056-southern-france-obj-white-standard-full-ambient-shader-off-2x/canvas-image.png
```

`056` accepted with `11/11` criteria using the same setup as `055`, but with
`sceneSimplification: "mesh-only-white-standard-full-ambient"`, which raises
ambient fill to `1`. The black marks are suppressed and image stats return to
`minByte: 135`, so the current diagnosis is low-fill lighting/normal darkness
from `MeshStandardMaterial`, not missing color output.

Current source-light isolation diagnostic:

```text
tmp/atmosphere/local-second-order/057-southern-france-obj-white-standard-ambient-only-shader-off-2x/canvas-image.png
```

`057` accepted with `11/11` criteria using
`sceneSimplification: "mesh-only-white-standard-ambient-only"`. It keeps the
white `MeshStandardMaterial` and full ambient but disables the source
`DirectionalLight`. The terrain becomes uniform gray and the dot/line pattern
disappears, so the artifact requires source-light direction interacting with
the OBJ normals/facets.

Current sampling-quality diagnostic:

```text
tmp/atmosphere/local-second-order/058-southern-france-obj-white-standard-aa-downsample-shader-off/canvas-image.png
```

`058` accepted with `11/11` criteria using the same source-lit white
`MeshStandardMaterial` setup as `055`, plus `rendererAntialias: true` and
`renderScale: 2`. It renders internally at `1920x1080` and downsamples to
`960x540`. The dark facet values remain numerically present, but the image
reads as terrain detail instead of isolated pixel defects.

Accepted conclusion: the apparent dots were undersampled source-lit terrain
detail. Use `rendererAntialias: true` plus `renderScale: 2` or better for
subjective terrain review images where directional lighting is active.

Current restored full diffuse/atmosphere reference:

```text
tmp/atmosphere/local-second-order/059-southern-france-obj-diffuse-aa-downsample-atmosphere/canvas-image.png
```

`059` accepted with `11/11` criteria using `terrainBackend:
"southern-france-obj-diffuse"`, the integrated
`distant-first-order-atmosphere` pass, `rendererAntialias: true`, and
`renderScale: 2`. It restores texture work and the shader after the dot
diagnostics, with `0` page errors and `0` material fallbacks.

Paired shader-off comparison:

```text
tmp/atmosphere/local-second-order/060-southern-france-obj-diffuse-aa-downsample-shader-off/with-without-shader-comparison.png
```

`060` uses the same terrain, camera, source light, diffuse backend,
`rendererAntialias: true`, and `renderScale: 2`, but sets
`disableAtmospherePass: true`. It accepted with `11/11` criteria and `0` page
errors.

Shadow-map follow-up:

```text
tmp/atmosphere/local-second-order/061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows/with-without-three-shadows-comparison.png
```

`061` uses the same shader-on review scene as `059`, with payload
`enableShadows: true` and `shadowMapSize: 4096`. It accepted with `12/12`
criteria, including a `three-shadow-maps-enabled` check. Diagnostics record a
directional-light shadow map and `208` meshes casting/receiving shadows. This
is a visual diagnostic: the Southern France diffuse texture already contains
shadow-like baked lighting, so live Three shadows make the terrain much darker.

Close-camera shadow diagnostic:

```text
tmp/atmosphere/local-second-order/063-southern-france-obj-diffuse-close-terrain-atmosphere-no-shadows/close-terrain-with-without-shadows-comparison.png
```

`062` and `063` use the new `cameraOverride` payload to place the camera close
to the raycast terrain surface:

```json
{
  "cameraOverride": {
    "cameraPositionMeters": [0, 6200, 15800],
    "cameraGroundClearanceMeters": 450,
    "lookAtMeters": [0, 4200, -22000],
    "lookAtGroundClearanceMeters": 700,
    "verticalFovDegrees": 70
  }
}
```

The accepted camera position was `[0, 3157.6099179376324, 15800]`, `450 m`
above the local terrain height. `062` is shadows-on and accepted with `12/12`;
`063` is shadows-off and accepted with `11/11`. The comparison shows the OBJ
asset already has close-range stepping/striping and baked texture shadowing;
live shadows emphasize those artifacts.

Receive-only shadow diagnostic:

```text
tmp/atmosphere/local-second-order/064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec/close-terrain-shadow-policy-comparison.png
```

`064` uses the same close camera with `enableShadows: true` and
`shadowPolicy: "receive-only"`. The source light shadow map remains enabled,
but terrain meshes only receive shadows. It accepted with `12/12` criteria;
diagnostics record `castShadowMeshCount: 0` and `receiveShadowMeshCount: 208`.
The receive-only image is byte-identical to the no-shadow `063` image
(`maxAbsByteDelta: 0`), so the dark shingle bands in `062` are terrain
self-shadowing/shadow-map acne from cast+receive terrain shadows.

High-altitude receive-only diagnostic:

```text
tmp/atmosphere/local-second-order/065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec/high-altitude-shadow-policy-comparison.png
```

`065` repeats the receive-only policy at the original high Southern France
camera `[0, 6200, 15800]`, without `cameraOverride`. It accepted with `12/12`
criteria and is byte-identical to the high no-shadow `059` render
(`maxAbsByteDelta: 0`).

Accepted subjective source-matrix comparison:

```text
tmp/atmosphere/local-second-order/070-southern-france-obj-diffuse-high-distant-midday-with-without-sha/canvas-image.png
tmp/atmosphere/local-second-order/071-southern-france-obj-diffuse-high-distant-sunset-with-without-sha/canvas-image.png
tmp/atmosphere/local-second-order/072-southern-france-obj-diffuse-high-local-closest-with-without-shad/canvas-image.png
tmp/atmosphere/local-second-order/073-southern-france-obj-diffuse-high-local-090deg-with-without-shade/canvas-image.png
```

Each row compares raw Three scene color without the full Algorithm32 atmosphere
shader against the same scene with the full integrated Algorithm32 shader.
All four artifacts passed `10/10` criteria and recorded hardware WebGL through
the NVIDIA/ANGLE D3D11 renderer. Local rows use
`flat-local-second-order-atmosphere` with `315` local incident-cache entries.
Partial artifacts `066`, `067`, and `069` contain only `command.json`; `068`
is rejected for browser evaluation timeout with WebGL `ReadPixels`/Vulkan wait
warnings. The matrix renderer builds each case scene once and reuses it for
the raw and shader columns to avoid repeated OBJ/TGA loads. Split one-case
commands validate only the cases requested by their payload, and full-matrix
commands yield briefly between rows for diagnostics.

Accepted fitted local-angle source-matrix extension:

```text
tmp/atmosphere/local-second-order/078-southern-france-obj-diffuse-high-local-090deg-toward-180sun-fit/canvas-image.png
tmp/atmosphere/local-second-order/079-southern-france-obj-diffuse-high-local-135deg-toward-180sun-fit/canvas-image.png
tmp/atmosphere/local-second-order/077-southern-france-obj-diffuse-high-local-180deg-toward-180sun-fit/canvas-image.png
```

These rows keep the same no-shadows side-by-side format and rerender local
`90` plus new local `135` and local `180` degree orbit views. The camera
keeps the accepted high Southern France position, FOV, and look-at elevation,
but rotates yaw toward the local Sun position at `180` degrees. The fitted
rerenders rotate and widen the staged OBJ footprint for this local-180-facing
view so the finite mesh remains under the visible frame instead of exposing
the catch plane on the right edge. Artifacts `077`, `078`, and `079` all
passed `10/10` criteria, recorded hardware NVIDIA/ANGLE WebGL, and used
`flat-local-second-order-atmosphere`; their center coverage ray is
`[0.8591988702281546, -0.028950139421190506, -0.5108220735502298]`. Earlier
artifacts `074` through `076` are superseded by this terrain-fit rerender
because the 180-facing view exposed the original finite OBJ footprint before
the right edge of the frame.

Accepted shader-only local vertical stack:

```text
tmp/atmosphere/local-second-order/080-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w/canvas-image.png
```

`080` vertically stacks integrated Algorithm32 shader renders only for local
closest, local `45`, local `90`, local `135`, and local `180`. Every row uses
the yaw-only view toward the local Sun bearing at `180` degrees and the fitted
Southern France OBJ footprint. The local `45` source comes from accepted
atmosflat evidence, with Algorithm32 transport position
`[-2175398.8819482913, 4758279.812089166, 4828003.52]` and observer incident
scale `0.5033091181134656`. The artifact passed `30/30` criteria, recorded
hardware NVIDIA/ANGLE WebGL, and writes a `960 x 3010` gallery with layout
`one row per requested case; integrated Algorithm32 shader image only`.

Accepted shader-only local vertical stack with magnitude-calibrated stars:

```text
tmp/atmosphere/local-second-order/086-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w/canvas-image.png
```

`086` uses the same cases, fitted terrain, and yaw-to-local-180 view policy as
`080`, but enables the integrated shader's optional procedural
apparent-magnitude point sources through `payload.starField`. Stars are added
only on sky rays as top-of-atmosphere radiance, divided by pixel solid angle,
attenuated by view transmittance, and composed before the shared tone map; they
do not contribute to Three terrain lighting. The command used `intensity: 1`,
`density: 1.15`, and `pointSize: 1.15`; diagnostics record
`starField.enabled: true` for every `flat-local-second-order-atmosphere` row.
Artifact `086` passed `30/30` criteria with hardware NVIDIA/ANGLE WebGL. In
the current fixed-exposure PNG, the real-magnitude star contribution is
sub-perceptual: compared with no-star baseline `080`, each local sky band
changed by at most one byte in only `2` to `4` sampled sky pixels. Rejected
artifact `081` captured the temporary GLSL brace error. Artifacts `082`
through `085` are superseded star-visibility calibration attempts.
