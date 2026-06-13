# Flat Atmosphere Design

This note tracks the intended atmosphere model for the Flat app and future
spherical/standard view. The implementation should stay reusable: atmosphere
physics belongs in shared framework-free code, while the scene model resolves
observer, projection, and light-source assumptions.

## Current State

`src/flat/shared/Atmosphere.js` currently owns a standard Earth atmosphere
profile, density falloff, flat-slab and spherical-shell altitude frames,
optical-depth sampling, transmittance, atmosphere-exit sampling, and plain
shader uniform output. It now also owns CPU-side single-scattering sampling
against an explicit `Sun` instance/config: Rayleigh and Mie phase functions,
sample-to-light transmittance, flat/spherical shadow checks, and accumulated
RGB in-scattered light along a view ray.

`src/flat/shared/Sun.js` owns resolved light-source state. It supports
directional sunlight for distant sun behavior and point sunlight for the
nearby false-model sun body. It also derives apparent angular size from the
observer/sample position for point-light bodies. The initial anchor remains
explicit and open.

`src/flat/shared/math-primitives.js` owns the stateless number, vector, and RGB
helpers shared by `Atmosphere` and `Sun`. Atmosphere-specific helpers such as
profile/frame normalization, empty sample creation, transmittance conversion,
and spherical intersection solving are static `Atmosphere` methods rather than
module-level utility functions.

`src/flat/shared/consts.js` owns atmosphere and sun constants used outside the
class implementations. `Atmosphere.js` and `Sun.js` should export only their
class implementations.

The old false-simulation `AltitudeHaze` shader shell has been removed. The
default renderer now uses `FalseAtmosphereComposer`: a depth-aware composition
pass that renders the solid false scene into color/depth textures, reconstructs
per-pixel camera rays, and applies the shared atmosphere/sun uniform contract
in a fullscreen shader.

## Ownership

Atmosphere should not decide where the sun is.

Scene/light state should own:

- selected time
- selected observer location
- false-model assumptions
- initial sun anchor
- sun motion model
- sun latitude, elevation, and radius assumptions
- resolved sun direction or position
- light color and intensity

Atmosphere should own:

- altitude and density by frame
- extinction by wavelength
- optical depth and transmittance
- Rayleigh and Mie phase functions
- single-scattering integration along a view ray
- shadow tests against the atmosphere frame

Renderer should own:

- passing camera ray/depth/light uniforms to shaders
- composing solid-world rendering and atmosphere/airlight
- using the same scene-level light state for terrain, objects, and sky effects

## Scene Light Contract

The scene model should expose a resolved light state. The control panel can
later change the assumptions that produce this state without changing
atmosphere integration code.

Directional light is the default physical shape for distant sunlight:

```js
scene.lighting.sun = {
	kind: 'directional',
	direction: { x: 0, y: 1, z: 0 },
	color: { r: 1, g: 0.96, b: 0.88 },
	intensity: 1,
	angularRadiusRad: 0.00465,
	anchor: {
		kind: 'known-value',
		status: 'open',
	},
};
```

Point light should also be supported for the false model if the sun becomes a
nearby configurable body:

```js
scene.lighting.sun = {
	kind: 'point',
	position: { x: 0, y: 4800, z: 0 },
	radiusKm: 25.75,
	distanceKm: 6000,
	apparentAngularRadiusRad: 0.00429,
	apparentAngularDiameterRad: 0.00858,
	color: { r: 1, g: 0.96, b: 0.88 },
	intensity: 1,
	anchor: {
		kind: 'known-value',
		status: 'open',
	},
};
```

The initial sun anchor remains deliberately open. It should eventually be a
known user-visible assumption rather than a hidden constant.

The false simulation already has a visible sun body. Its canonical source is
`DEFAULT_FALSE_SIMULATION_SUN` in
`src/flat/features/false-simulation/models/consts.js`. The scene model derives
both `scene.sun` for the visible/orbital body and `scene.lighting.sun` for the
point-light state consumed by atmosphere work. The renderable sphere in
`scene.objects` is a compatibility view derived from `scene.sun.object`, not
the owning sun definition. The sun body must remain rendered because its
position and apparent size are user-facing simulation evidence, not decorative
debug geometry. The physical `radiusKm` and observer-to-sun distance define
the apparent angular radius/diameter exposed on `scene.sun.apparent` and
`scene.lighting.sun`. The first planned control-panel assumptions for this
body are sun latitude, elevation above the projected floor, and physical
radius; the scene model already accepts those through `config.sun.lat`,
`config.sun.altitudeKm`, and `config.sun.radiusKm`.

The first local-sun brightness assumption is now explicit:
`FALSE_SUN_LIGHT_INTENSITY = 64`. This keeps the false sun as a nearby point
light so local-sun implications remain visible, but gives the atmosphere enough
source light to produce noticeable scattering. This is a scene/light
assumption, not a compositor exposure multiplier, and should eventually become
a control-panel setting alongside position and size.

## Single-Scattering Model

The atmosphere should add a method shaped like:

```js
sampleSingleScatteringRay(origin, viewDirection, distanceKm, {
	light,
	steps: 24,
	lightSteps: 8,
});
```

The method integrates along the camera/view ray:

```text
camera -> atmospheric sample -> light source
```

For each sample along the view ray:

1. Compute altitude and density at the sample point.
2. Compute transmittance from camera to sample.
3. Compute transmittance from sample toward the light.
4. Compute the scattering angle between the view ray and light ray.
5. Apply Rayleigh and Mie phase functions.
6. Accumulate in-scattered light for RGB output.

The conceptual contribution per sample is:

```text
viewTransmittance
  * lightTransmittance
  * density
  * phase(scatteringAngle)
  * lightColor
  * lightIntensity
  * stepDistance
```

This is the missing piece in simple haze. It lets the same density field render
differently depending on sun angle, time, and false-model assumptions.

## Phase Functions

Use separate Rayleigh and Mie phase terms.

Rayleigh should be symmetric and wavelength-sensitive:

```text
rayleighPhase(cosTheta) = 3 / (16 * pi) * (1 + cosTheta^2)
```

Mie should model stronger forward scattering near the sun. A
Henyey-Greenstein phase function is a good first pass:

```text
miePhase(cosTheta, g) =
  (1 - g^2) / (4 * pi * (1 + g^2 - 2 * g * cosTheta)^(3/2))
```

`g` should be configurable through the atmosphere profile, likely around
`0.75` to `0.85` for aerosol-forward scattering.

## Shadow Tests

Direct sunlight should be blocked if the sample-to-light ray hits the ground or
planet before leaving the atmosphere.

For spherical view:

```text
sample -> sun ray intersects planet sphere = sample is in shadow
```

For flat false simulation:

```text
sample -> sun ray intersects the ground plane before exiting atmosphere =
sample is in shadow
```

This is required for night, sunset, twilight, and Earth-shadow behavior.

## Flat And Spherical Frames

The same atmosphere API should support both frames:

- `flat-slab`: false-simulation atmosphere above projected ground.
- `spherical-shell`: standard sky atmosphere around a spherical planet.

The light input should already be in scene/world coordinates. Converting from
time, lat/lon, or false-model assumptions into that world-space light belongs
to scene/projection/light helpers, not `Atmosphere`.

For flat false simulation, the scene can derive local basis vectors from the
projection model:

```text
worldSunDirection =
  east * localEastVector
  + north * localNorthVector
  + up * { x: 0, y: 1, z: 0 }
```

For spherical view, the scene can derive ENU from the observer and planet
center:

```text
up = normalize(observerPosition - planetCenter)
east = normalize(cross(globalNorth, up))
north = cross(up, east)
```

## Shader Direction

The shared `Atmosphere` model should expose plain data and math contracts. The
renderer can later implement the same single-scattering integration in GLSL as
a post/full-screen pass or atmosphere material.

Preferred render pipeline:

1. Render solid world/depth.
2. For each pixel, reconstruct the camera ray and scene depth.
3. Integrate atmosphere from camera to scene depth or atmosphere exit.
4. Add in-scattered light and apply transmittance to the solid color.

This keeps floor/terrain/object rendering separate from atmosphere composition.

## Simulation Integration Plan

The immediate flat integration should tie atmosphere and sun together through
the scene view model and renderer, not by letting the shader invent a light.

Data flow:

```text
DEFAULT_FALSE_SIMULATION_SUN
  -> FalseSimulationSceneModel.projectSun()
  -> scene.sun and scene.lighting.sun
  -> shared Sun/Atmosphere uniform data
  -> false-simulation atmosphere shader
```

`scene.sun` remains the first-class visible body. `scene.lighting.sun` remains
the light contract that atmosphere sampling consumes. The rendered body and the
atmosphere uniforms must use the same resolved sun position each frame.

The current renderer animates the visible sun by rotating a Three.js group. The
atmosphere pass cannot use the static initial `scene.lighting.sun.position`
while the visible body moves. The next implementation should introduce one
runtime sun resolver, for example:

```text
resolveAnimatedSun(scene.sun, elapsedSeconds)
```

That resolver should derive the current sun position from `scene.sun.position`
and `scene.sun.animation`. The sun mesh and atmosphere uniforms should both
consume that resolved position. For the current solar-day fixed-latitude model,
the resolver can rotate the initial projected sun position around the world
`y` axis by the animation cycle ratio.

Flat first pass:

1. Add an atmosphere material that mirrors
   `Atmosphere.sampleSingleScatteringRay` in GLSL.
2. Build uniforms from `new Atmosphere({ frame, profile, sun })`, using a
   flat-slab frame with ground at `y = 0` and up `{ x: 0, y: 1, z: 0 }`.
3. Update point-sun uniforms each frame from the same animated sun position
   used by the visible `SunBody`.
4. In the shader, integrate camera-to-sample transmittance, sample-to-sun
   transmittance, Rayleigh/Mie phase functions, and flat ground shadowing.
5. Keep this as a shell-based first pass only long enough to validate the
   light-aware look. The more correct render path is still a depth-aware
   full-screen atmosphere composition pass after solid-world rendering.

Spherical/standard view later uses the same `Atmosphere` and `Sun` classes but
switches the frame to `spherical-shell` and resolves the sun as either a
directional light or real ephemeris-derived distant sun state.

## Concrete Implementation Plan

This is the next implementation sequence for plugging the shared atmosphere
and sun into the false-simulation renderer.

### 1. Add One Runtime Sun Resolver

Create a small helper owned by the false-simulation feature, likely:

```text
src/flat/features/false-simulation/models/sun-animation.js
```

Responsibilities:

- export `resolveAnimatedSun(sceneSun, elapsedSeconds)`
- support `solar-day-fixed-latitude-rotation`
- return a new sun view model with current `position`, `object.position`,
  `light.position`, `light.direction`, `light.distanceKm`, and apparent-size
  fields all updated together
- keep null/disabled sun handling explicit

The current animation can rotate the initial projected sun position around the
world `y` axis by:

```text
angle = (elapsedSeconds % displayDurationSeconds) / displayDurationSeconds
  * 2 * pi
```

The resolver becomes the only place that knows how sun animation changes the
current scene/light position.

### 2. Make Sun Rendering Use The Resolver

Update `src/flat/features/false-simulation/components/FalseSkyScene.jsx` so
the visible `SunBody` uses the resolver instead of a local rotating group.

The renderer should pass the resolved sun body to the mesh and should not keep
a separate animation path for `scene.sun.object`. Generic
`AnimatedFixedLatitudeObject` can remain for non-sun objects if needed, but
the sun path must be first-class because atmosphere depends on it.

Acceptance criteria:

- the visible sun still moves on the same solar-day loop as scene rotation
- `SunBody` and atmosphere uniforms can receive the same resolved sun object
- no code path rotates the visible sun without also updating light state

### 3. Add An Atmosphere Uniform Adapter

Create a renderer adapter, likely:

```text
src/flat/features/false-simulation/components/atmosphere-uniforms.js
```

Responsibilities:

- accept `scene.atmosphere`, resolved `scene.sun.light`, and any renderer
  scale/color tuning
- construct `new Atmosphere({ frame, profile, sun })`
- call `createShaderUniforms()`
- convert plain arrays/objects into stable React Three Fiber uniform objects
- expose mutable sun uniforms that can update every frame without remounting
  the material

This adapter is renderer-owned because Three uniform object shape is a render
concern. The shared `Atmosphere` and `Sun` classes stay framework-free.

Acceptance criteria:

- adapter does not duplicate atmosphere constants
- adapter does not own sun position math
- adapter output can be unit tested without mounting a canvas where practical

### 4. Add A First Light-Aware Atmosphere Material

Add a replacement atmosphere component in the renderer, likely:

```text
src/flat/features/false-simulation/components/FalseAtmosphere.jsx
```

or keep it local to `FalseSkyScene.jsx` initially if the first pass is still
small.

The first shader can be a shell-based validation pass. It should mirror the
CPU model closely enough to validate the look:

- flat-slab altitude from world `y`
- exponential Rayleigh and aerosol density
- per-channel extinction/transmittance
- point-sun direction from sample position to resolved sun position
- sample-to-sun transmittance
- Rayleigh and Henyey-Greenstein Mie phase functions
- flat ground-plane shadowing when the sample-to-sun ray intersects `y = 0`

The shell pass is acceptable only as the first visual integration because it is
fast to wire and inspect. It should not reintroduce the removed old linear haze
contract.

Acceptance criteria:

- changing sun latitude/elevation/radius changes the visible scattering
- moving the animated sun changes scattering in sync with the rendered sun
- atmosphere is visibly directional, not just distance opacity
- disabling `scene.atmosphere.enabled` removes the pass

### 5. Add Focused Tests

Add tests before broad visual tuning:

- `sun-animation` tests:
  - elapsed `0` returns the original projected sun position
  - quarter/half cycle positions rotate predictably around world `y`
  - light direction/distance/apparent size update with position
- atmosphere uniform adapter tests:
  - uses `scene.atmosphere.profile` and `scene.atmosphere.frame`
  - uses the resolved animated sun, not the initial sun
  - exposes sun position/radius/color/intensity uniforms
- renderer source tests or focused grep-style regression:
  - no `AltitudeHaze`
  - no `fullOpacityDistanceKm`, `seaLevelDensity`, or old linear haze uniforms
    in the false-simulation renderer

Run `npm run test:ui:flat` and `npx polylith build flat` after each coherent
slice. Browser screenshot checks should be added once the first shader renders.

### 6. Promote To Depth-Aware Composition

After the shell pass proves the sun/scattering behavior, replace or augment it
with the preferred render pipeline:

1. render solid floor, stars, sun, terrain, and objects
2. reconstruct per-pixel camera rays and depth
3. integrate atmosphere from camera to scene depth or atmosphere exit
4. composite transmittance and in-scattered light over the solid color

This is the path needed for terrain and object occlusion to look coherent.
The shell pass is a stepping stone, not the target architecture.

Concrete next steps for this promotion:

1. Create `FalseAtmosphereComposer`, likely under
   `src/flat/features/false-simulation/components/FalseAtmosphereComposer.jsx`.
   It should own an offscreen `WebGLRenderTarget` with a `DepthTexture`, resize
   it with the canvas, and render the solid false-simulation scene into that
   target before the final screen pass.
2. Split the current scene contents into a reusable solid-scene component so
   the composer can render floor, scale cues, mountains, stars, constellations,
   and the visible sun into the offscreen target without also drawing the old
   shell atmosphere. The camera/look controls should remain outside the solid
   render subtree.
3. Add a fullscreen composition shader that receives:
   - `sceneColorTexture`
   - `sceneDepthTexture`
   - camera projection/inverse projection matrices
   - camera world matrix or camera position
   - viewport resolution
   - atmosphere uniforms from `atmosphere-uniforms.js`
   - resolved animated sun uniforms from `resolveAnimatedSun()`
4. In the fullscreen shader, reconstruct the world position for each pixel
   from depth. For background pixels with no solid depth, use atmosphere-exit
   distance along the camera ray. For solid pixels, integrate only from the
   camera to the reconstructed solid surface.
5. Composite with:

   ```glsl
   finalColor = sceneColor * transmittance + inScatteredLight;
   ```

   This is what makes daylight and haze attenuate stars, mountains, floor, and
   the sun consistently instead of letting stars draw over the atmosphere.
6. Keep the current `FalseAtmosphere` shell as a temporary fallback or debug
   comparison only while the composer is being validated. Once the composer is
   stable, remove or disable the shell path so there is one atmosphere render
   owner.
7. Add focused tests around the composer helpers where practical:
   - render-target/depth-texture creation options
   - uniform adapter reuse with the resolved animated sun
   - no old `AltitudeHaze` or linear haze uniforms
   - scene atmosphere disabling bypasses the composition pass
8. Browser-check `/flat/false-simulation` after the composer is wired:
   - no WebGL/shader console errors
   - nonblank canvas on desktop and mobile
   - stars visibly dim when the sun/airlight is high
   - nearby mountains remain clearer than distant mountains
   - disabling atmosphere returns the raw solid scene

## Implementation Plan

Completed:

- Added `src/flat/features/false-simulation/models/sun-animation.js` with
  `resolveAnimatedSun(sceneSun, elapsedSeconds, options)`. It resolves the
  current solar-day fixed-latitude sun position, updates `scene.sun.position`,
  `scene.sun.object.position`, `scene.sun.light.position`, light
  direction/distance, and apparent angular size together, and can infer the
  observer position from the initial point-light state.
- Updated `SunBody` in
  `src/flat/features/false-simulation/components/FalseSkyScene.jsx` to render
  the first-class sun body from `resolveAnimatedSun()` on the same React Three
  Fiber clock used by the rest of the scene animation. The visible sun now
  completes one full rotation over its configured display duration without a
  separate rotating-group light path.
- Added `src/flat/shared/Sun.js` with directional and point sun support,
  normalized sample-to-light direction, finite point-light distance, explicit
  open anchor state, and plain shader uniforms.
- Added `src/flat/shared/math-primitives.js` for shared stateless vector, RGB,
  and numeric helpers used by `Atmosphere` and `Sun`.
- Added `src/flat/shared/consts.js` for exported atmosphere/sun constants so
  class implementation files export only their classes.
- Moved Atmosphere-specific helper behavior into static `Atmosphere` methods
  so `Atmosphere.js` is class-owned rather than a class plus loose utilities.
- Formalized the false-simulation visible sun as
  `DEFAULT_FALSE_SIMULATION_SUN`, deriving `scene.sun`, `scene.lighting.sun`,
  and the renderer-compatible sun sphere from one source.
- Made the rendered sun body a first-class scene contract. The React renderer
  consumes `scene.sun` directly, while the derived sphere remains in
  `scene.objects` only for compatibility with generic object consumers.
- Added observer-relative apparent angular radius/diameter for the false-model
  sun body from the same physical radius and position used by the point light.
- Added regression coverage that false-sun latitude, elevation, and physical
  radius can be varied through scene configuration and still drive the rendered
  body, apparent size, and point-light state together.
- Added `src/flat/features/false-simulation/components/atmosphere-uniforms.js`
  as the renderer-owned adapter from shared `Atmosphere`/resolved `Sun` state
  to Three/R3F-style uniform objects. It flattens atmosphere frame data for
  shader use and updates sun position/color/radius/intensity uniforms in place
  from the same animated sun resolver used by `SunBody`.
- Added `src/flat/features/false-simulation/components/FalseAtmosphere.jsx`
  as the first light-aware shell pass. It mirrors the shared single-scattering
  model in GLSL for a flat-slab atmosphere, samples camera-to-air and
  sample-to-sun transmittance, uses Rayleigh/Mie phase terms, performs flat
  ground-shadow checks, and updates sun uniforms each frame from the same
  resolved animated sun used by the visible `SunBody`.
- Added `src/flat/features/false-simulation/components/FalseAtmosphereComposer.jsx`
  as the first depth-aware composition pass. It renders solid scene contents
  through a portal into an offscreen `WebGLRenderTarget` with `DepthTexture`,
  then draws a fullscreen shader that samples scene color/depth, reconstructs
  per-pixel world position, integrates atmosphere from the camera to the solid
  surface or atmosphere exit, and composites
  `sceneColor * transmittance + inScatteredLight`.
- Stabilized the first composer after a live black-sky/ground-popping report:
  background and grazing rays now clamp to a bounded atmosphere view distance
  instead of integrating out to the camera far plane, the depth texture uses a
  higher-precision unsigned integer format, render-target restore is explicit,
  and resize handling no longer mutates the depth texture image dimensions
  directly.
- Added a second compositor stabilization pass after the sky remained black
  and the floor still popped while turning. Background/no-depth pixels now get
  a small sun-lift-aware sky airlight floor so the atmosphere pass does not
  collapse to the black clear color while scattering is under-tuned. The giant
  projected Earth floor now renders color-only in the solid pass
  (`depthWrite=false`, `depthTest=false`), leaving local mountains/objects as
  the depth-bearing geometry until floor depth can be represented by a more
  stable local terrain/depth strategy.
- Added a temporary observer-local floor patch after the projection-sized floor
  still disappeared from the eye-height composed view. The patch is a stable
  320 km plane centered below the observer at ground `y = 0`, drawn before
  mountains, and now depth-bearing so the compositor treats it as solid ground
  instead of background sky. It is intended only to keep the POC grounded until
  real local terrain or a stable local floor-depth mesh replaces it.
- Replaced the temporary distance-blend solid haze with the first
  `Atmosphere.sampleSegment()`-equivalent shader path. The composer now uses
  integrated optical depth for solid-pixel transmittance and adds tinted
  segment airlight from lost average transmittance:
  `(1 - averageTransmittance) * atmosphereMaxAirlight * atmosphereAirlightRgb`.
- Replaced the bright false-sky no-depth fallback with the normal
  sun-scattering path. Background/no-depth pixels now integrate optical depth
  and single scattering to atmosphere exit like other camera rays; only a tiny
  emergency sky floor remains to prevent total black if the scattering result
  underflows.
- Backed out the attempted `scene.atmosphere.rendering.skyExposure` display
  multiplier. A black sky should be investigated as missing or blocked
  in-scattered sunlight, not solved by making the final background contribution
  brighter after the fact.
- Added temporary background-pixel debug rendering to
  `FalseAtmosphereComposer`. `backgroundDebugMode: 'diagnostics'` produced a
  uniformly red sky, meaning background atmosphere samples were mostly
  unshadowed but sample-to-sun transmittance and final scattering were near
  zero. `unattenuated-scattering` then still produced a black sky, while
  `scattering-inputs` produced a uniformly yellow sky, meaning the background
  ray is sampling atmosphere and density while the phase/scattering side
  remains weak. `view-path` also produced uniform yellow, meaning the
  background ray reaches its max sky distance and view transmittance remains
  high while optical depth remains visually low. `scattering-source` then
  produced uniform black, meaning the raw source term is not visible at the
  current probe scale. `scattering-factors` produced pink, confirming the
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
  and sky light-transmittance floor `0.05`, with
  `backgroundDebugMode: 'none'` so the real no-depth scattering path is
  visible without bleaching the surface. This is source-term and
  sample-to-light-path calibration for the physically shaped point-sun
  scattering path, not the rejected final-display `skyExposure` multiplier.
  The alternate
  `scattering` mode shows fully attenuated in-scattered light, `diagnostics`
  shows unshadowed sample ratio in red, average sample-to-light transmittance
  in green, and scattering strength in blue, and `unattenuated-scattering`
  bypasses only sample-to-light transmittance. `scattering-inputs` shows
  atmosphere sample ratio in red, average density in green, and phase strength
  in blue. `view-path` shows normalized ray distance in red, average view
  transmittance in green, average optical depth in blue, and
  `scattering-source` shows the averaged raw source term before attenuation or
  exposure. `scattering-factors` shows the basic light/coefficient uniforms,
  `scattering-components` splits the three source-term multipliers, and
  `scattering-sanity` compares the reconstructed source with the accumulated
  source vector. These are investigation tools, not the final sky renderer.
- Current most likely factors for the black physically integrated sky:
  1. sample-to-sun rays are being marked shadowed too often by the flat ground
     intersection test
  2. the nearby point-sun assumptions make the sun effectively too dim or too
     distance-sensitive for atmospheric scattering; first pass under test is
     explicit false-sun light intensity `64`
  3. the visible false sun may be below, near, or inconsistently related to the
     atmosphere samples for much of its animated cycle
  4. the shader point-sun light direction or distance may not match the
     resolved visible sun state
  5. background ray length may be clamped too short for enough scattering, or
     too long and over-extinguishing near-horizon paths
  6. sample-to-light transmittance may be over-attenuating the already small
     scattering contribution
  7. Rayleigh/Mie coefficients are physically sized, but the false-world sun
     and scene scale are not calibrated to physical solar irradiance
  8. the render target or tone/color-space path may be hiding low but nonzero
     scattering values
- Split `FalseSkyScene.jsx` so camera/look controls remain in the main scene
  while floor, scale cues, mountains, dome rings, stars, constellations, and
  the visible sun are rendered as solid scene contents through the composer.
- Captured the renderer integration plan for tying the visible animated
  `scene.sun`, `scene.lighting.sun`, and shared `Atmosphere` uniforms together.
- Removed the old false-simulation `AltitudeHaze` shader shell and replaced
  the legacy scene atmosphere settings with a shared-atmosphere placeholder.
- Added focused resolver tests for disabled sun handling, zero-time identity,
  quarter-cycle rotation, updated light/apparent fields, observer inference,
  and non-mutation of the scene-model sun.
- Added light input normalization to `src/flat/shared/Atmosphere.js` through
  `Sun` instances/configs.
- Added Rayleigh and Mie phase helpers with tests.
- Added sample-to-light transmittance and shadow tests for flat and spherical
  atmosphere frames.
- Added `sampleSingleScatteringRay` with deterministic CPU tests.

Next:

1. Browser-check the real composer path with separated solid/sky source gains
   and `skyLightTransmittanceFloor: 0.05`. Confirm whether sky scattering is
   now visible without whitening the ground.
2. Browser-check the stabilized `FalseAtmosphereComposer` pass once the local
   flat server is running: verify no shader/WebGL console errors, visible
   observer-local floor, no floor popping while turning, and distance
   attenuation on mountains.
3. Replace the temporary observer-local floor patch with a local terrain mesh
   or other stable near-observer floor depth representation.
4. Decide whether the old shell component should remain as a debug fallback or
   be removed.

## Open Questions

- What known value anchors the initial false-simulation sun position?
- Does the false model use a distant directional sun first, or a nearby finite
  point/area sun first?
- Which later sun assumptions should the control panel expose after latitude,
  elevation, and radius: longitude/azimuth, motion period, light strength, or
  color?
- Should twilight prioritize physical plausibility or visual legibility for
  the POC?
- Should the first shader be a post/depth pass, or an atmosphere shell fed by
  the new shared uniforms?
