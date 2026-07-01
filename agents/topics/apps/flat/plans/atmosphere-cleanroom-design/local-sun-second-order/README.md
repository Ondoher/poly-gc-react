# Local Sun Second-Order POC

Status: experimental POC lane closed for the production Algorithm32 design
pivot. The lane remains accepted evidence, not the production module boundary.
POC evidence is accepted through Milestone 12, with the initial Milestone 13
`three.terrain.js` integrated-shader spike accepted for distant midday and the
Rocky Land asset-heightmap backend accepted at
`047-rocky-land-heightmap-integrated-distant-midday-v3`. The Southern France
Blender OBJ terrain runway is accepted through Milestone 16:
`048-southern-france-obj-geometry-distant-midday` proves geometry placement,
and `049-southern-france-obj-diffuse-distant-midday` proves diffuse texture
color/detail through the integrated distant-midday pass. The current
review-quality subjective pair is `059` with the atmosphere shader enabled and
`060` with the same scene rendered shader-off plus a side-by-side comparison.
The no-shadows four-case with/without full-shader matrix is accepted as split
one-case artifacts `070` through `073`. The fitted local-angle extension is
accepted as `077` through `079`, adding local `135` and local `180` and
rerendering local `90` with yaw aimed toward the local `180` degree Sun
bearing plus a yaw-aligned wider Southern France OBJ footprint fit. Earlier
artifacts `074` through `076` are superseded because the original finite mesh
footprint exposed the catch plane on the right edge of the 180-facing view.
Shader-only vertical local stack artifact `080` is also accepted for local
closest, `45`, `90`, `135`, and `180`, all looking toward the local `180`
degree Sun bearing with the integrated Algorithm32 shader.
After the false-Sun source correction, the browser page derives local Sun
positions from the flat app's annual tropic-migration latitude model instead
of a baked fixed-`24 deg N` table: the configured date resolves the Sun
latitude, the north-pole azimuthal-equidistant ring is rotated to the
requested clockwise forward-time offset from closest San Jose approach, and
closest approach is recalibrated to unit Algorithm32 incident scale.
The accepted regenerated forward-time rerender is
`088-southern-france-obj-diffuse-high-local-stack-toward-180sun-fit-w`, with
`30/30` passing criteria, no page errors, and rows for local closest, `45`,
`90`, `135`, and `180` forward-time degrees.
The accepted summer-solstice local-vs-spherical time-aligned rerender is
`093-southern-france-obj-diffuse-high-local-distant-solstice-time-pai`, with
`60/60` passing criteria, no page errors, and local solar times rendered in
the row headers. It uses `2026-06-21`, computes San Jose solar noon as local
transit/highest Sun at `13:09`, treats flat local closest as spherical solar
noon, advances later rows by the same forward-time degrees, and renders the
flat local Sun on the left beside a spherical distant Sun at the same synced
solar time with the same camera pose/direction on the right. Each image label
includes the modeled Sun sky position as azimuth and altitude in degrees.
Artifact `090` is superseded because it forced civil `12:00` as solar noon and
lacked those labels; rejected artifact `089` is superseded because only the
first camera-match criterion looked for a matrix field omitted by the
lightweight coverage summary.
The accepted opposite daylight comparison is
`092-southern-france-obj-diffuse-high-distant-local-solstice-daylight`, with
`60/60` passing criteria and no page errors. Solar noon is used only as the
clock-sync anchor, computed for San Jose on `2026-06-21` as local transit at
`13:09`; the five rows are evenly spaced from sunrise to sunset at `05:47`,
`09:28`, `13:09`, `16:50`, and `20:31`. The spherical distant integrated-shader
image is on the left, the flat local integrated-shader image is on the right,
and the camera yaw is centered on the distant sunset bearing. Each image label
includes the modeled Sun sky position as azimuth and altitude in degrees.
Artifact `091` is superseded by `092` because it lacked those sky-position
labels.
The production design pivot supersedes remaining POC terrain closeout as an
active blocker. Terrain evidence remains useful subjective context, but
production Algorithm32 design now lives under
`agents/topics/apps/flat/algorithm32/`, starting with
`production-design.md`.
Milestone 0 is complete: the accepted POC
implementation bundle is centralized under `shared/algorithm32/POC/`, the
copied runners have been reduced to pure importable modules, and the bundle
passes the import/execution smoke proof. Milestones 1 through 6 validate
that those shared modules still match the original runners or the checked-in
evidence registry before local second-order work begins at Milestone 7. This is
cleanroom/shader-lab-adjacent experimental planning, not production
Algorithm32 documentation. The lane browser harness is implemented under
`scripts/flat/local-second-order/`. The harness timeout recovery path is fixed,
and the local harness defaults to hardware WebGL instead of forced SwiftShader
software rendering. Do not track whether the watcher is currently running in
documentation; inspect heartbeat/process state at execution time. The initial
browser smoke artifact
`tmp/atmosphere/local-second-order/001-browser-runner-smoke/` is accepted.
The lane runner accepted CPU/local-cache proof through Milestone 12:
`003` through `009`, `011`, `012`, and `020` through `022` are accepted.
Rejected diagnostics `010` and blocked artifact `013` remain useful history:
`010` proved raw world-direction caching was wrong, and `013` recorded the
old absence of a Three integrated local L2 cache path before it was fixed.

This folder tracks the completed local Sun second-order scattering experiment.
It is evidence for production Algorithm32 design, not the home of production
contracts.

The reusable accepted POC implementations for this lane are centralized under:

```text
shared/algorithm32/POC/
```

Use those modules for new local second-order experiments instead of mining the
old runners directly. They are the clean POC basis that will be tested and
promoted into production Algorithm32 code once the lane closes. The
second-order cache implementation should remain outside the primary
Algorithm32 algorithms and feed them through the incident-field abstraction.
The reusable POC bundle now owns the actual local second-order display-path
helpers: accepted local finite-Sun source resolution,
`Data3DTexture` cache upload, star-field display payload normalization, and
the live Three scene-color/depth to Algorithm32 display-pass wrapper. The
script lane remains the browser harness and terrain/gallery review shell.

The first experiment loop must validate the shared modules themselves:

- original `bruneton-start-fresh` base algorithm parity;
- CPU transport parity;
- CPU soft-shader parity;
- flat/local source parity;
- Three integrated pass parity.

Preflight state before Milestone 1:

```text
node shared/algorithm32/POC/validate-poc-imports.js
tmp/atmosphere/local-second-order/001-browser-runner-smoke/
```

The shared import smoke proof has passed, and the listed browser smoke
artifact is accepted. Do not run manual one-shot harness commands for this
lane. Use `tmp/atmosphere/local-second-order/browser-command.json` and the
watcher contract for browser commands. New browser artifacts should record
WebGL renderer diagnostics so accidental SwiftShader fallback is visible.

The experiment plan also carries lane-specific guidance mined from the other
cleanroom lanes. New agents should treat that section as the operating
discipline for this lane: append-only numbered artifacts, state-goal and
running-log continuity, source/provenance records, objective criteria before
subjective images, distant-control parity before local changes, fail-loud
source/cache behavior, direct-trace or CPU-soft-shader oracle ordering, and
shared source configuration for Three lighting plus Algorithm32 scattering.

## Documents

- [Experiment Plan](experiment-plan.md) - one-loop POC plan starting with
  shared-module extraction parity, then local second-order Algorithm32 proof,
  CPU soft-shader proof, integrated GPU shader proof, objective scene
  measurements, and subjective galleries.
- [Scattering Notes](scattering-notes.md) - discussion notes for the
  second-order incident-field abstraction, local cache dimensions, direction
  signs, CPU/GPU cache storage, and cache-building strategy.

## Placement

- Script lane: `scripts/flat/local-second-order/`.
- Artifact root: `tmp/atmosphere/local-second-order/`.
- Centralized POC implementation inputs: `shared/algorithm32/POC/`.
- This folder is the documentation tracker for that POC lane.
- Production Algorithm32 documentation belongs under
  `agents/topics/apps/flat/algorithm32/` only after contracts are implemented,
  validated, and promoted.

The script lane includes a browser harness for later integrated-shader checks:

```text
node scripts/flat/local-second-order/harness.js --watch
```

Default browser command and heartbeat files:

```text
tmp/atmosphere/local-second-order/browser-command.json
tmp/atmosphere/local-second-order/harness-heartbeat.json
```

Runner contract: the lane must not use duplicate browser processes or manual
`--once` runs for experiment work. Browser commands should be issued as
watcher commands, and live runner state should be determined from the process
and heartbeat state at execution time rather than from documentation.

Milestones that say "accepted evidence" mean the checked-in evidence under
`agents/topics/apps/flat/plans/atmosphere-cleanroom-design/evidence/current/`,
not uncopied temp folders.

## Current Run Notes

- `002-original-base-algorithm-parity` was rejected only because the initial
  criterion expected the later CPU incident-field name instead of the base
  module's `bruneton-start-fresh-altitude-incident-field` name.
- `010-local-cache-shape` was a useful rejected artifact: it showed that a
  local `z/rho` cache cannot use raw world-space incoming directions. The
  accepted shape in `011-local-cache-shape` stores incoming directions in the
  Sun-subpoint local radial/tangential/up frame.
- `012-cpu-soft-shader-local-l2` accepted the CPU matrix for distant midday,
  distant sunset behind camera, local closest, and local `90` degree cases.
- `018-three-integrated-local-l2-probe` accepted the live Three integrated
  local closest source using the packed local cache. The browser shader ray
  and source debug samples agreed within `1` RGB byte, and local L2 changed
  the image with max RGB delta `35`.
- `019-three-integrated-local-l2-probe` accepted the same path for local
  `90` degrees, with max RGB delta `127`.
- `020-three-integrated-gpu-local-l2` formally accepted Milestone 10:
  `flat-local-second-order-atmosphere` mode, `Data3DTexture` packing,
  closest/local90 browser artifacts, distant mode still exposed, and no
  silent first-order fallback.
- `021-objective-subjective-local-l2-matrix` accepted Milestone 11. CPU/GPU
  center selected diagnostics matched with max RGB delta `0` for closest and
  `2` for local `90`; the artifact also copies the CPU control and local GPU
  review images under its `images/` folder.
- `022-promotion-notes` accepted Milestone 12 and points production agents to
  `agents/topics/apps/flat/algorithm32/README.md` for the promotion contract
  and open followups.
- `030-subjective-l2-cache-comparison` is the corrected subjective follow-up
  artifact for first-order versus second-order/cache side-by-side review. It
  regenerates the four shader-lab subjective scenes in the local lane, uses
  `src/gc/utils/random.js` for the accepted `mountain-detail-v1` terrain spec,
  and writes `subjective-l2-cache-comparison-gallery.png`. Treat
  `025-subjective-l2-cache-comparison` as superseded because its fallback
  terrain generator used a different RNG and changed the silhouette.
- The local lane now includes
  `scripts/flat/local-second-order/local-source-neutral-spectrum-comparison.js`
  for the source-tint reversal diagnostic. With the user-owned watcher running
  (`node scripts/flat/local-second-order/harness.js --watch`), the runner
  renders the accepted Southern France local-source integrated-shader vertical
  stack, rerenders the same stack with
  `payload.sourceColorOverride = { r: 1, g: 1, b: 1 }`, and writes a
  reproducible artifact with both browser-run links, side-by-side output, diff
  image, criteria, and report. This is a diagnostic for the inherited
  flat-app RGB source tint only; it is not a new Algorithm32 physics contract.
- Milestone 13 initial spike is accepted by
  `037-three-terrain-integrated-distant-midday`. It installs and imports
  `three.terrain.js`, adds the optional `three-terrain-js` terrain backend,
  wraps package `Math.random` with the lane deterministic LCG, preserves the
  broad far-ground catch surface, and renders a distant-midday scene through
  the integrated `Algorithm32AtmospherePass` using
  `distant-first-order-atmosphere`. Criteria passed `10/10`; the output image
  is `canvas-image.png`. Partial folder `035` is superseded by the fix that
  replaced full-pixel package-terrain raycasting with a sparse coverage
  summary for integrated-shader-only spikes. The full four-case package-terrain
  soft-shader/L2 gallery remains optional follow-up work, not yet completed.
- `040-three-terrain-integrated-distant-midday-wide-v3-480` accepted a
  pulled-back wider-FOV package-terrain view using `TerrainNS.PerlinLayers`,
  `ridge-valley-v2` after shaping, height/slope vertex colors, and
  `cameraProfile: three-terrain-ridge-valley-wide`; criteria passed `10/10`.
  It made the scene more landscape-like but put the camera at `10500 m`, which
  visibly exposed the spherical-atmosphere horizon curvature.
- `041-three-terrain-integrated-distant-midday-low-camera` accepted the same
  package terrain with the camera lowered to `[0, 1200, 5200]`, looking toward
  `[0, 1550, -36000]` at `58 deg` FOV. Criteria passed `10/10`; hit distances
  moved to `2.6-15.9 km`, removing the aircraft-altitude horizon issue. The
  image still reads as too smooth/flat, so future subjective terrain work
  should add actual foreground/midground detail, texture/scatter, or stronger
  silhouettes instead of relying only on a different height generator.
- `042-three-terrain-integrated-distant-midday-detail-v4` is the current
  accepted package-terrain detail update. It keeps the low camera from `041`,
  adds a repeated deterministic surface texture and a merged detail mesh with
  `180` outcrops (`1,137` triangles) to the same `three-terrain-js` scene, and
  renders through the integrated distant-midday pass. Criteria passed `10/10`;
  the image no longer reads as only two flat bands, although further natural
  terrain work would need foreground/midground silhouettes or richer material
  treatment.
- `044-three-terrain-integrated-distant-midday-ridge-lines-v6` is the current
  accepted package-terrain reference. It raises the camera to
  `[0, 4200, 9800]`, looks toward `[0, 3900, -52000]`, widens FOV to `62 deg`,
  strengthens the raised ridge-line strips, and keeps the `180` outcrops plus
  deterministic surface texture. Criteria passed `10/10`; diagnostics record
  `14` ridge-line strips, `180` outcrops, and a merged detail mesh with
  `2,680` triangles. This view better sees beyond the foreground ridge while
  staying below the previous `10500 m` aircraft-style horizon view.
- `047-rocky-land-heightmap-integrated-distant-midday-v3` is the current
  accepted asset-backed terrain option. It uses
  `payload.terrainBackend: "rocky-land-heightmap"` on the existing
  `three-terrain-integrated-distant-midday` command, reads the CC0 Rocky Land
  and Rivers height map copied under
  `scripts/flat/local-second-order/page/assets/rocky-land-and-rivers/`, and
  samples it into one ordinary Three `BufferGeometry` so scene color, depth,
  raycasting, and the integrated `Algorithm32AtmospherePass` all use the same
  path as the package terrain spike. The accepted run passed `11/11` criteria
  with `36,864` vertices and `72,962` triangles, including a selected sparse
  hit on `rocky-land-and-rivers-heightmap-terrain`; image:
  `tmp/atmosphere/local-second-order/047-rocky-land-heightmap-integrated-distant-midday-v3/canvas-image.png`.
  `045-rocky-land-heightmap-integrated-distant-midday` is superseded because
  the first camera/extent setup still let foreground rays hit the simple catch
  plane before the asset mesh; `046` is superseded by the same image with the
  stronger terrain-mesh-hit criterion.
- Next documented terrain work is Milestones 14 through 18 in
  `experiment-plan.md`. The source asset is
  `Designs/landscapes/uploads_files_2061262_Mountain+Range+in+Southern+France_Blender_OBJ.zip`.
  Local inspection found the same OBJ geometry as the 3D Coat zip but with
  complete Blender material references: `268,472` vertices, `122,937`
  triangle faces, `28` materials, and `0` missing referenced textures. The
  runway intentionally starts with geometry-only loading before diffuse
  textures, then runs the four subjective source cases and records a terrain
  backend recommendation. Do not change Algorithm32 or the local second-order
  cache for this terrain work.
- `048-southern-france-obj-geometry-distant-midday` is the first accepted
  Southern France visual. It stages only `Mountain Range in Southern France.obj`
  and `.mtl` under
  `scripts/flat/local-second-order/page/assets/southern-france-blender-obj/`,
  uses `payload.terrainBackend: "southern-france-obj-geometry"`, remaps the
  source Z-up mesh into the lane Y-up scene, and renders through the integrated
  `distant-first-order-atmosphere` pass. Criteria passed `11/11`, including
  selected sparse hits on `southern-france-obj-terrain-*` meshes; image:
  `tmp/atmosphere/local-second-order/048-southern-france-obj-geometry-distant-midday/canvas-image.png`.
  This is geometry-only with one matte material.
- `049-southern-france-obj-diffuse-distant-midday` is the first accepted
  diffuse-textured Southern France visual and supersedes `048` for subjective
  color/detail review. It stages the `28` diffuse TGA maps under the lane page
  assets, loads them with Three `TGALoader`, assigns per-material matte
  `MeshStandardMaterial` instances to the `207` runtime OBJ meshes, records
  `0` fallback material ids, and renders through the same integrated
  `distant-first-order-atmosphere` pass. Criteria passed `11/11`, page errors
  were `0`, and runtime was about `16.4 s`; image:
  `tmp/atmosphere/local-second-order/049-southern-france-obj-diffuse-distant-midday/canvas-image.png`.
  The later four-case source matrix uses `southern-france-obj-diffuse` and is
  accepted as split artifacts `070` through `073` without changing
  Algorithm32.
- `050-southern-france-obj-diffuse-distant-midday-2x` and
  `053-southern-france-obj-diffuse-shader-off-2x` are the current black
  terrain dot/line diagnostics. `050` reran the integrated atmosphere view at
  `960x540`, and the marks persisted. `053` added a lightweight
  `disableAtmospherePass` switch to the existing sparse terrain command and
  rendered `scene-only-no-atmosphere`; the marks still appear before
  Algorithm32/depth composition. This rules against the atmosphere shader
  leaving some pixels uncolored. For this OBJ diffuse backend, procedural
  vertex colors are not active; material color comes from the matched diffuse
  TGA maps. Partial folders `051` and `052` were superseded attempts that used
  the heavier full scene-packet capture path and should not be used as visual
  evidence.
- `054-southern-france-obj-mesh-only-white-shader-off-2x` is the current
  strongest black-dot isolation diagnostic. It renders the same Southern
  France OBJ geometry backend with the bottom catch plane removed, the
  atmosphere pass disabled, and one unlit white `MeshBasicMaterial` applied to
  the unchanged `207` runtime OBJ meshes. Criteria passed `11/11`; image stats
  were `minByte: 135`, `maxByte: 255`, and the black dots/lines were not
  visible. This rules against the OBJ geometry alone as the source. Next
  material-path diagnostics should reintroduce exactly one factor at a time:
  catch plane, `MeshStandardMaterial` lighting/normals, then diffuse textures.
- `055-southern-france-obj-mesh-only-white-standard-shader-off-2x` reintroduced
  exactly one factor after `054`: a lit white `MeshStandardMaterial`, still
  with no textures, no vertex colors, no bottom catch plane, and no atmosphere
  pass. Criteria passed `11/11`, but the black dots/lines returned visually
  and image stats dropped from `054`'s `minByte: 135` to `minByte: 38`. Treat
  the current lead suspect as normals/lighting under `MeshStandardMaterial`.
  Texture maps and catch-plane depth fighting are no longer needed to produce
  the symptom.
- `056-southern-france-obj-white-standard-full-ambient-shader-off-2x` keeps the
  `055` lit white `MeshStandardMaterial` but raises ambient fill to `1`.
  Criteria passed `11/11`; image stats returned to `minByte: 135`,
  `maxByte: 255`, and the black marks were suppressed. Current diagnosis:
  the recurring dots/lines are low-fill standard-material lighting/normal
  darkness, not missing shader output or texture-only artifacts. Future scene
  work should use a more realistic fill/hemisphere/skylight policy or inspect
  normals before judging terrain materials.
- `057-southern-france-obj-white-standard-ambient-only-shader-off-2x` disables
  the source `DirectionalLight` while keeping full ambient and the same white
  `MeshStandardMaterial`. It passed `11/11`, rendered the terrain as uniform
  gray, and the dot/line pattern disappeared. This confirms the artifact is
  caused by source-light direction interacting with the OBJ normals/facets,
  not by ambient-only standard material. The next useful diagnostic is a normal
  visualization or flat/original/recomputed normal comparison.
- `058-southern-france-obj-white-standard-aa-downsample-shader-off` keeps the
  `055` lighting/material conditions that produce the dark facets, but renders
  at `1920x1080` with WebGL antialiasing and downsamples to a `960x540` review
  image. It passed `11/11`; `minByte` remains `38`, so the dark lighting
  details still exist, but visually they read as terrain detail instead of
  harsh single-pixel defects. Use supersampled/antialiased review renders for
  subjective terrain images when directional terrain lighting is active.
  Accepted conclusion: the dark dots were undersampled real terrain lighting
  detail from source-lit OBJ facets/normals. The issue was presentation
  quality, not missing shader output, texture failure, vertex-color leakage,
  or catch-plane z-fighting.
- `059-southern-france-obj-diffuse-aa-downsample-atmosphere` restores the full
  diffuse-textured Southern France path after the diagnostics: matched diffuse
  TGA maps, source `DirectionalLight`, integrated
  `distant-first-order-atmosphere`, WebGL antialiasing, and `renderScale: 2`
  downsampled from `1920x1080` to `960x540`. Criteria passed `11/11`, page
  errors were `0`, material fallbacks were `0`, and runtime was about
  `36.7 s`. This is the review-quality Southern France diffuse terrain
  reference used before the accepted split four-case source matrix.
- `060-southern-france-obj-diffuse-aa-downsample-shader-off` is the paired
  shader-off comparison for `059`: same terrain, camera, source light,
  diffuse backend, WebGL antialiasing, and `renderScale: 2`, but with
  `Algorithm32AtmospherePass` disabled. Criteria passed `11/11`, page errors
  were `0`, and runtime was about `11.6 s`. Side-by-side review image:
  `tmp/atmosphere/local-second-order/060-southern-france-obj-diffuse-aa-downsample-shader-off/with-without-shader-comparison.png`.
- `061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows` turns on
  real Three shadow maps for the same shader-on review scene with payload
  `enableShadows: true` and `shadowMapSize: 4096`. Criteria passed `12/12`,
  including `three-shadow-maps-enabled`; diagnostics record a directional
  shadow map and `208` scene meshes casting/receiving shadows. Side-by-side
  shadow comparison:
  `tmp/atmosphere/local-second-order/061-southern-france-obj-diffuse-aa-downsample-atmosphere-shadows/with-without-three-shadows-comparison.png`.
  The result is much darker because live shadows layer over shadow-like detail
  already baked into the diffuse texture.
- `062-southern-france-obj-diffuse-close-terrain-atmosphere-shadows` and
  `063-southern-france-obj-diffuse-close-terrain-atmosphere-no-shadows` add a
  close-to-surface diagnostic camera. The lane page now supports a
  `cameraOverride` payload with terrain-following clearance fields. The
  accepted close view raycast the terrain at the camera x/z, found terrain
  height `2707.6099179376324 m`, and placed the camera at
  `[0, 3157.6099179376324, 15800]` with `450 m` clearance. `062` passed
  `12/12` with shadows on; `063` passed `11/11` with shadows off. Comparison:
  `tmp/atmosphere/local-second-order/063-southern-france-obj-diffuse-close-terrain-atmosphere-no-shadows/close-terrain-with-without-shadows-comparison.png`.
  The close view shows OBJ stepping/striping and baked texture shadowing are
  visible before live shadows, while Three shadow maps make them harsher.
- `064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec` uses
  the same close camera with `enableShadows: true` and
  `shadowPolicy: "receive-only"`. Terrain meshes receive shadows but do not
  cast them. Criteria passed `12/12`; diagnostics record
  `castShadowMeshCount: 0` and `receiveShadowMeshCount: 208`. The output is
  byte-for-byte identical to the no-shadow `063` image, with
  `maxAbsByteDelta: 0`, while full cast+receive `062` has the dark shingle
  bands. Comparison:
  `tmp/atmosphere/local-second-order/064-southern-france-obj-diffuse-close-terrain-atmosphere-shadows-rec/close-terrain-shadow-policy-comparison.png`.
  Conclusion: the shingle bands are terrain self-shadowing/shadow-map acne
  from the OBJ mesh, not Algorithm32 atmosphere and not baked texture alone.
- `065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec`
  repeats the receive-only shadow policy at the original high Southern France
  camera `[0, 6200, 15800]`. Criteria passed `12/12`; diagnostics again
  record `castShadowMeshCount: 0` and `receiveShadowMeshCount: 208`. The high
  receive-only image is byte-for-byte identical to high no-shadows `059`
  (`maxAbsByteDelta: 0`). Comparison:
  `tmp/atmosphere/local-second-order/065-southern-france-obj-diffuse-high-altitude-atmosphere-shadows-rec/high-altitude-shadow-policy-comparison.png`.
- Current subjective request is accepted as no-shadows split one-case
  with/without full-shader artifacts for the same high Southern France diffuse
  terrain view. `070` is distant midday, `071` is distant sunset behind
  camera, `072` is local closest, and `073` is local `90`; each row compares
  raw Three scene color without the full Algorithm32 atmosphere shader against
  the same scene rendered with the full integrated Algorithm32 shader. All
  four passed `10/10` criteria using hardware WebGL through the NVIDIA/ANGLE
  D3D11 renderer. Local rows used `flat-local-second-order-atmosphere` with
  `315` local incident-cache entries. Partial artifacts `066`, `067`, and
  `069` contain only `command.json`; `068` is a rejected timeout artifact with
  WebGL `ReadPixels`/Vulkan wait warnings. The harness now treats browser
  evaluation timeouts as page/browser recovery failures, skips post-timeout
  screenshot/canvas work, and no longer forces SwiftShader software GL by
  default. The page matrix renderer builds each case scene once and reuses it
  for the raw/shader columns; split one-case commands validate only their
  requested rows and record WebGL renderer diagnostics.
- Follow-up fitted local-angle subjective views are accepted as artifacts
  `077` through `079`. They rerender local `90` and add local `135` and local
  `180` degree orbit rows. All three use the same no-shadows Southern France
  diffuse terrain side-by-side format and `flat-local-second-order-atmosphere`.
  Their camera policy preserves the accepted high camera position, FOV, and
  look-at elevation while rotating only yaw toward the local Sun bearing at
  `180` degrees. The local-180-facing terrain fit rotates and widens the
  staged OBJ footprint so the finite mesh remains under the visible frame
  instead of exposing the catch plane on the right edge. Each passed `10/10`
  criteria with hardware NVIDIA/ANGLE WebGL; the shared center coverage ray is
  `[0.8591988702281546, -0.028950139421190506, -0.5108220735502298]`. Earlier
  artifacts `074` through `076` are superseded by this fit.
- Shader-only local vertical stack artifact `080` is accepted. It stacks
  integrated Algorithm32 shader images only for local closest, local `45`,
  local `90`, local `135`, and local `180`, all looking toward the local
  `180` degree Sun bearing and using the fitted Southern France OBJ footprint.
  The local `45` source uses accepted atmosflat evidence position
  `[-2175398.8819482913, 4758279.812089166, 4828003.52]` with observer
  incident scale `0.5033091181134656`. The gallery is `960 x 3010`, criteria
  passed `30/30`, and diagnostics record hardware NVIDIA/ANGLE WebGL plus
  `flat-local-second-order-atmosphere` for every row.
- Shader-only local vertical stack artifact `086` is accepted as the same
  view stack with optional procedural apparent-magnitude point sources enabled
  in the integrated shader display config. Stars are sky-ray-only
  top-of-atmosphere radiance, divided by pixel solid angle, attenuated by view
  transmittance, and composed before the shared tone map; they do not light the
  terrain. The command used `starField.enabled: true`, `intensity: 1`,
  `density: 1.15`, and `pointSize: 1.15`; diagnostics record those settings
  for every `flat-local-second-order-atmosphere` row. In the current
  fixed-exposure PNG, the real-magnitude star contribution is sub-perceptual,
  changing only `2` to `4` sampled sky pixels per local band by at most one
  byte relative to `080`. Rejected artifact `081` is failure evidence for the
  temporary GLSL brace error. Artifacts `082` through `085` are superseded
  star-visibility calibration attempts.
