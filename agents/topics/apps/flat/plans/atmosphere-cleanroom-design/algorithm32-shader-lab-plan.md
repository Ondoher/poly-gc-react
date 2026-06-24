# Algorithm32 Shader Lab Plan

This document records the planned experiment for building a shader validation
harness around Algorithm32. The goal is to converge on a production-quality
atmosphere shader while keeping Algorithm32 as the reference oracle.

This is an experimental lane. It does not require unit tests unless a later
step promotes code into production or shared package code.

Execution status: use
[Algorithm32 Shader Iteration Plan](algorithm32-shader-iteration-plan.md) as
the current runnable plan. This document remains the broader harness and design
background.

## Core Idea

Use one shared scene/render pipeline and vary only the atmosphere
implementation:

```text
Three.js scene/camera/objects
  -> shared camera rays, object hits, scene color/depth, Sun/profile config
  -> atmosphere implementation adapter
      - CPU Algorithm32 reference
      - optional raw Algorithm32-style shader
      - experimental shader variants
  -> shared composition/display/capture
  -> artifacts and comparisons
```

The strongest oracle is CPU Algorithm32 driven by the same Three.js scene
geometry, not a shader that merely tries to mimic Algorithm32. A raw
Algorithm32-style shader may still be useful as a debug adapter, but it should
not be the first source of truth.

## Browser Control Constraint

Launching Chromium may require approval, so the experiment should minimize
browser launches.

The original control idea was a long-running Puppeteer harness:

```text
start harness once
  -> launch Chromium once
  -> open local lab page
  -> watch command.json
  -> reload page or dispatch command for each experiment
  -> capture JSON, screenshots, timings, and readbacks
  -> keep browser alive until explicitly stopped
```

The current scaffold lives at:

```text
scripts/flat/algorithm32-shader-lab/
```

It supports:

```text
node scripts/flat/algorithm32-shader-lab/harness.js --once
node scripts/flat/algorithm32-shader-lab/harness.js --watch
```

The default artifact root is:

```text
tmp/atmosphere/algorithm32_shader_lab/
```

The first smoke run proved the basic browser loop only. It does not implement
Three.js, Algorithm32 transport, or shader validation yet.

Current status: do not use the agent-launched browser path as the next blind
retry. Puppeteer hung when launched by the agent, and the bounded Karma fallback
artifacts `014-browser-three-baseline-karma` and
`015-browser-three-baseline-karma` are rejected. However, the user manually ran
the Puppeteer `--once` harness outside the agent launch path and produced
accepted artifact `018-browser-three-baseline` in `629 ms`. The existing
persistent-runner design remains viable if the user owns the harness process,
especially with `--watch`. The user-owned `--watch` loop was then validated in
accepted artifact `020-browser-three-baseline-watch-reload-check`, where a
watched command-file edit reloaded the page and wrote a fresh artifact.
Browser ray/depth parity was accepted in
`022-browser-ray-depth-diagnostics-comparison`, which compared the watch-run
browser artifact `021` against an independent Node/Three reconstruction with
zero measured ray and finite-hit-distance deltas. Atmosphere-component parity
was then accepted in
`026-browser-atmosphere-components-shader-comparison`, using watch-run browser
artifact `025`; browser JS and Node optical-depth/transmittance calculations
matched, and WebGL2 diagnostic shader readback matched the browser JS component
packet within the recorded float-readback tolerances. First direct-radiance
substep 4.1 was accepted in
`028-browser-direct-radiance-comparison`, using watch-run browser artifact
`027`; first-order 532 nm Rayleigh, Mie, path, object-transmitted, and final
radiance matched independent Node recomputation exactly at JS precision, and
WebGL2 shader readback matched browser JS within the recorded float-readback
tolerances. This proves the shader can compute real first-order radiance for
selected pixels, but it is still one wavelength only and deliberately excludes
Algorithm32 second-order approximation and full spectral/display conversion.
Full first-order spectral selected-pixel parity was then accepted in
`031-browser-direct-radiance-spectral-comparison`, using watch-run browser
artifact `030`; all `15` Algorithm32 wavelengths matched independent Node
recomputation and WebGL2 shader readback within the recorded tolerances.
`032-browser-first-order-image` then accepted the first full-image 15-channel
first-order shader pass for the simple browser scene. Objective pairing
`038-browser-first-order-image-objective-simple-scene` compared that shader
class with full CPU Algorithm32 reference `037` and measured the expected
missing second-order gap. First-order isolation pairing
`040-browser-first-order-image-first-order-isolation` compared the shader with
CPU first-order reference `039` and showed near-exact agreement, proving the
current full-image shader is first-order-correct. Selected-pixel second-order
diagnostics were then accepted in `041` through `045`, and full-image
second-order simple-scene parity was accepted in
`048-browser-second-order-image` against CPU Algorithm32 reference `037`.
Scene-input parity then advanced through `051`, GPU-generated scene input in
`053`, and direct GPU texture binding in `054`, which is the current accepted
fixed spherical, distant-Sun shader-lab endpoint. A later user-directed
flat-earth visibility offshoot is accepted in
`056-browser-flat-earth-visibility-search`: using standard Algorithm32
atmosphere constants, flat-slab geometry, first-order scattering, and the
recorded `10 km x 10 km` matte black card, the closest display-
indistinguishable distance is `1,926.774 km`. Rejected companion artifacts
`055` and `057` document the bracketing bug and wider-target stress result.
Visibility-loss milestones for the same original target are accepted in
`062-browser-flat-earth-visibility-search`: `50% lost = 21.480 km`,
`75% lost = 601.563 km`, `80% lost = 776.563 km`, `90% lost = 1,228.125 km`,
`95% lost = 1,543.750 km`, and `100% lost/cannot see = 1,926.774 km`.
High-resolution milestone inspection images are accepted in
`065-browser-flat-earth-visibility-search`; inspect its native
`canvas-image.png`.
Shader performance benchmark mode now exists as `browser-shader-benchmark`.
Artifact `067-browser-shader-benchmark` is an accepted smoke proving that the
page can return structured benchmark diagnostics for the accepted second-order
GPU-direct scene-input pass. It is not a real GPU timing baseline because this
Chromium/WebGL backend did not expose `EXT_disjoint_timer_query_webgl2`.
Artifact `069-browser-shader-benchmark` used aggressive batching and should be
treated only as a cautionary artifact; benchmark defaults now use small sample
counts, yield between samples, and leave `gl.finish()` fallback timing disabled
unless explicitly requested. Future benchmark runs should use a dedicated
browser/harness process and exact process ownership; do not clean up by killing
generic `chrome` processes.
Current subjective progress snapshots
`049-browser-mountain-second-order-front-high-sun` and
`050-browser-mountain-second-order-sunset-behind-camera` render the mountain
pair through the current second-order shader path and include side-by-side CPU
Algorithm32 reference images from `033` and `034`. The user clarified that
these side-by-side mountain images are for progress visibility only. The next
serious spherical shader-lab work is formalizing a production-style
depth/material texture contract or a Three-owned composition pass; the flat
visibility branch should continue only when the user asks for that model.

## Layered Build Plan

### 1. Browser-Control Smoke Loop

Status: scaffold exists.

Purpose:

- launch Chromium through Puppeteer;
- load a local page;
- reload the page on command;
- run a browser-side function;
- return useful JSON;
- write a screenshot and result packet.

Current verified artifact:

```text
tmp/atmosphere/algorithm32_shader_lab/002-smoke-reload/
```

The verified run returned page reload count `2`, WebGL 2 through SwiftShader,
canvas pixel samples, screenshot output, and no page errors.

### 2. Node/Three CPU Geometry Reference

Status: first reference runner accepted.

Before validating shaders, prove that Three.js scene geometry can drive CPU
Algorithm32 without Chromium or WebGL.

Use Node with Three.js scene/math/raycasting:

- `Scene`;
- `PerspectiveCamera`;
- `Vector3` and matrix math;
- `Raycaster`;
- simple `Mesh` geometry such as boxes, cards, planes, and spheres;
- materials as explicit metadata for object spectra/radiance.

For each pixel or selected diagnostic sample:

```text
pixel -> NDC -> Three camera ray -> Three Raycaster hit or sky
```

Then:

```text
sky hit:
  Algorithm32 traceSkyRay(...)

object hit:
  Algorithm32 traceAtmosphereSegment(...)
  Algorithm32 applyAtmosphereToObjectRadiance(...)
```

Outputs:

- low-resolution CPU reference image;
- per-pixel or selected-pixel diagnostics;
- object mask;
- hit distances;
- camera rays;
- Algorithm32 spectral packets;
- display-consumer output.

This layer avoids Chromium entirely and validates the reference render path
before any shader exists.

Current implementation:

```text
scripts/flat/algorithm32-shader-lab/node-three-reference.js
```

Accepted artifact:

```text
tmp/atmosphere/algorithm32_shader_lab/003-node-three-algorithm32-reference/
```

That run created a Three `PerspectiveCamera`, three spectral card meshes, and a
diagnostic ground plane. It used `Raycaster.setFromCamera()` for pixel and
selected-card rays, mapped Three rays into Algorithm32 local coordinates, and
ran CPU Algorithm32 sky/object transfer packets with the experiment 032
constants. It produced `reference-image.png`, `object-mask.png`, selected
spectral diagnostics, and `criteria-results.json`.

The same runner also has a `--scene sunset-floor` mode for simple generated
scene requests. The accepted no-object grass-floor sunset artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor/
```

It uses the low-Sun Figure 1 case, contains only a grass-green floor plane and
sky, and passed `7` request-focused criteria. Artifact `004-sunset-floor` is
rejected because the first synthetic grass spectrum clipped red and green
together and read as yellow.

The current less-zoom follow-up artifact is:

```text
tmp/atmosphere/algorithm32_shader_lab/006-sunset-floor-less-zoom/
```

It keeps the same no-object grass-floor sunset scene but uses a `92 deg`
vertical FOV and passed `8` request-focused criteria.

The same runner now also has a subjective `--scene mountain-ridges` mode for
optional visual study scenes. The current mountain-range preview is:

```text
tmp/atmosphere/algorithm32_shader_lab/012-mountain-ridges-framed-large/
```

It renders procedural layered ridge silhouettes and a valley floor through the
same Three raycast plus Algorithm32 sky/object transfer path. Artifacts `007`
through `011` are superseded layout iterations. This scene deliberately has
`0` formal criteria because the request was a subjective composition target;
acceptance means the preview rendered successfully, not that a numeric visual
truth test passed.

The current alternate mountain-range view with the sunset behind the camera is:

```text
tmp/atmosphere/algorithm32_shader_lab/013-mountain-ridges-sunset-behind-camera/
```

It uses `--mountain-view sunset-behind-camera`, switches the render Sun case to
the low-Sun `figure1-06h00-z87` case, and orients the camera away from the Sun
direction so the sunset is behind the viewer. This is also a subjective scene
with `0` formal criteria by design.

### 3. Validate The Geometry-Driven Reference Method

Status: first criteria set accepted for the Node/Three runner.

The CPU reference method has four risky links:

```text
Three camera/pixel -> world ray
world ray -> scene hit/object data
hit/object data -> Algorithm32 input
Algorithm32 output -> image pixel
```

Validate each link with simple scenes.

Camera ray checks:

- center pixel points along camera forward;
- edge pixels match expected field of view;
- left/right and top/bottom rays are symmetric when the camera is symmetric;
- CPU reconstruction agrees with `Raycaster.setFromCamera()`.

Hit checks:

- plane at known distance;
- card or box at known position;
- sphere with analytic intersection;
- selected pixel hit distance agrees with expected analytic geometry;
- later, rendered depth reconstruction agrees with raycaster hit distance.

Object radiance checks:

- start with unlit emissive or constant-radiance materials;
- use explicit spectral object radiance rather than Three lighting;
- in vacuum, final object pixel equals object radiance;
- black object gives path radiance only;
- zero or tiny segment gives object radiance with negligible atmosphere.

Transport identity checks:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

Include:

- vacuum: `T = 1`, `L_path = 0`;
- black object: final equals `L_path`;
- split-segment composition;
- increasing distance produces expected contrast loss and path-radiance growth;
- sky pixels use the sky-ray path rather than object transfer.

Image assembly checks:

- object masks match raycaster geometry;
- sky/object classification is stable away from edges;
- edge pixels are either excluded from strict tests or reported separately;
- display conversion is a separate final step.

The accepted `003` criteria covered:

- manual inverse-projection rays matching Three Raycaster rays;
- analytic card-center hit distances matching Raycaster distances;
- rendered object masks containing all three diagnostic card meshes;
- finite object transfer composition
  `L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)`;
- black-object and zero-distance transfer identities;
- Beer-Lambert transmittance identity;
- finite nonnegative spectral transfer packets with transmittance in `[0, 1]`;
- positive attenuation response from nearest to farthest card;
- split-segment transfer recomposition within the finite quadrature gate;
- low-Sun versus high-Sun path-radiance response on the same Three hit path.

### 4. Browser/Three Shared Render Pipeline

After the CPU geometry-driven reference path is trusted, add a browser scene
that uses the same scene definition and camera conventions. In the current
session, the browser scene should be driven by a user-launched harness process
or another externally managed browser endpoint, not through a fresh
agent-launched Puppeteer/Karma process.

The browser pipeline should own:

- scene color/radiance target;
- depth target or object-hit equivalent;
- camera matrices and ray reconstruction;
- Sun/profile/numerical config upload;
- atmosphere pass invocation;
- composition;
- display conversion;
- capture and readback.

The atmosphere implementation should be swappable through adapters:

```js
{
  id,
  label,
  createResources(config),
  setSharedInputs(sharedInputs),
  renderAtmospherePass(targets),
  readDiagnostics()
}
```

Initial adapters:

- `cpu-reference`: not a shader; consumes Three geometry and CPU Algorithm32
  output for oracle images and selected-pixel diagnostics.
- `experimental-shader-v1`: first shader path to compare against CPU
  Algorithm32.
- optional `raw-algorithm32-shader`: slow direct shader port or debug
  implementation if useful.

All adapters should consume the same scene/camera/Sun/profile inputs and
produce comparable outputs:

```text
T_view
L_path
final radiance or documented reduced-channel/display output
diagnostics when available
```

### 5. Optional Raw Algorithm32 Shader

A raw Algorithm32-style shader is possible, but should be treated as a debug or
bridge adapter, not the primary oracle.

If implemented, validate it component-by-component:

- atmosphere boundary intersection;
- view sample placement;
- Rayleigh and Mie density;
- view optical depth and transmittance;
- sample-to-Sun transmittance;
- phase functions;
- first-order radiance;
- second-order approximation;
- spectral/display conversion.

It may be slow, low-resolution, or wavelength-pass based. It does not need to
meet production performance standards.

### 6. Experimental Shader Convergence

Once the shared pipeline and CPU reference are trustworthy, iterate on shader
designs.

Compare:

```text
CPU Algorithm32 reference image/packets
  vs
experimental shader output
```

For each run, capture:

- input config;
- shader adapter id/version;
- scene id;
- screenshot/output image;
- selected pixel readbacks;
- difference image or numeric difference summary;
- timing data;
- known approximation policy;
- failures and page/shader errors.

Possible shader strategies:

- direct low-sample ray marching;
- transmittance/path-radiance lookup textures;
- reduced spectral channels;
- RGB or XYZ cache policy;
- lower-resolution atmosphere pass with depth-aware upsampling;
- flat/local-Sun configuration caches.

## Long-Running Harness Behavior

The harness should remain responsible for:

- starting the local page server;
- launching Chromium once;
- keeping a page open;
- polling or receiving experiment commands;
- reloading or dispatching page commands;
- collecting browser console/page errors;
- reading browser result JSON;
- taking screenshots;
- writing numbered artifacts;
- writing heartbeat/latest files;
- shutting down cleanly.

The page should remain responsible for:

- creating browser-side Three/WebGL resources;
- compiling shaders;
- running shader passes;
- reading pixels or diagnostics;
- returning structured result packets to the harness.

The first implementation uses a watched command file:

```text
tmp/atmosphere/algorithm32_shader_lab/command.json
```

Future options:

- WebSocket command channel;
- HTTP control endpoint;
- dev-server route that reloads module code;
- explicit queue directory for multiple pending runs.

## Artifact Shape

Each numbered run should eventually contain:

```text
command.json
result.json
screenshot.png
console.json
timings.json
reference.png
shader.png
diff.png
selected-pixels.json
diagnostics.json
```

Not every early scaffold run needs all files. Missing files should be
intentional and recorded in `result.json`.

## Acceptance Criteria

The shader lab bootstrap is successful when:

- Puppeteer can keep one Chromium instance alive and rerun page work without
  launching a new browser per iteration;
- Node/Three can generate the same camera rays and object hits used by the
  browser scene;
- CPU Algorithm32 can render a low-resolution Three-defined scene;
- geometry/hit/radiance identities pass on simple scenes;
- the browser pipeline can render the same scene with a shader adapter;
- selected shader pixels can be compared against CPU Algorithm32 reference
  packets;
- differences are reported with enough diagnostics to classify them as shader
  bugs, cache-coordinate errors, approximation error, or display conversion
  differences.

## Open Decisions

- Whether the first real browser scene should use raw Three.js or the app's
  existing React/Three stack.
- Whether CPU reference images should be generated before shader runs, during
  the same harness run, or as separate input artifacts.
- Which first scene should be used for shader parity: sky-only, card objects at
  distance, terrain-like plane, or a combined small gallery.
- Which channel policy the first shader should target: one wavelength,
  three-wavelength RGB-like, XYZ, linear RGB, or full spectral multi-pass.
- Whether a raw Algorithm32 shader is worth building before a cache/lookup
  experimental shader.
- How strict the first shader-vs-reference tolerance should be.
