# Flat

This topic tracks notes for a new project named `flat`.

## Current State

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
  is `false-simulation`; the standard sky-viewer view remains later scope.
- The pipeline app is the model for app shape, shell/page boundaries,
  page/view registration, and build-file feature inclusion.
- The product compares a standard night-sky view against a second night-sky
  view generated from incorrect assumptions.
- A later flat apparent-position mode should render celestial objects inside
  the flat scene from their real observer-relative apparent positions, rather
  than from the false north-celestial-pole projection.
- The first POC should focus on the false simulation only.
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
- `src/flat/features/false-simulation` registers the first feature page and
  renders the Phase 1 Three.js false-sky scene.
- `server/flat/index.js` serves the app index for clean `/flat/*` routes.
- `builds/flat.json` includes the app router and feature list.
- `polylith.json` includes the `flat` app name.
- `src/flat/test.js` and `src/flat/shared/_tests` provide the app-local
  Polylith/Karma unit test entry.
- `karma.flat.conf.cjs` runs only the flat test bundle so stale or unrelated
  app test bundles do not affect `npm run test:ui:flat`.
- `src/flat/shared/projection` now contains the plain reusable
  `ProjectionModel` class plus the first false-simulation projection classes:
  `NorthPoleAzimuthalEquidistantEarthProjection`,
  `NorthCelestialPoleAzimuthalEquidistantProjection`, and
  `UpperHemisphereRadialLiftProjection`.
- `src/flat/shared/Atmosphere.js` defines the first shared, framework-free
  atmosphere model for both flat false-simulation rendering and a later
  spherical/standard-sky renderer. It owns the standard Earth profile
  constants, sea-level density, exponential Rayleigh/aerosol density falloff,
  flat-slab and spherical-shell altitude frames, finite segment/ray sampling,
  atmosphere-exit sampling, optical-depth/transmittance output, and plain
  shader-uniform data.
- Future atmosphere scattering should take an explicit light/sun state from
  the scene model rather than deriving its own sun position internally. The
  initial sun anchor must come from a known, user-visible assumption, but that
  anchor choice remains open. A future control panel should expose assumptions
  such as sun position, motion model, distance, and size instead of burying
  them in the atmosphere renderer.
- Focused atmosphere design notes now live in
  [Atmosphere Design](atmosphere-design.md). The intended next model is
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
  `src/flat/features/false-simulation/models/consts.js` owns false-simulation
  scene defaults. Class implementation files now export only their class:
  `Atmosphere.js`, `Sun.js`, and `FalseSimulationSceneModel.js` no longer
  export constants or secondary named symbols.
- `src/flat/shared/types.d.ts` and
  `src/flat/features/false-simulation/models/types.d.ts` now define ambient
  JSDoc types for shared atmosphere/sun/math contracts and false-simulation
  scene/sun contracts. Newly added atmosphere, sun, math helper, scene-model,
  and first-class sun-rendering code now uses those types in JSDoc.
- [Atmosphere Design](atmosphere-design.md) now includes a concrete renderer
  integration plan: add a shared runtime sun resolver, make `SunBody` consume
  it, add an atmosphere-uniform adapter, wire a first light-aware atmosphere
  material, test the resolver/adapter, then promote to depth-aware
  composition.
- `src/flat/features/false-simulation/models/sun-animation.js` now owns the
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
- `src/flat/features/false-simulation/models/FalseSimulationSceneModel.js`
  creates the plain scene view model for San Jose at the Phase 1 midnight
  timestamp.
- `src/flat/features/false-simulation/components/FalseSkyScene.jsx` renders the
  first Three.js scene from the plain scene view model: projected Earth disc
  context and star points on the hidden dome surface, viewed from the projected
  San Jose observer position. Canvas drag rotates the fixed observer camera so
  the viewer can look around without leaving the observer point.
- The scene model now formalizes the visible false-model sun instead of hiding
  it as a generic orange reference object. `DEFAULT_FALSE_SIMULATION_SUN` is
  the canonical source for the 32-mile-diameter body centered 3000 miles above
  projected latitude `24` at the longitude opposite the observer. The scene
  derives both `scene.sun` and the renderable `scene.objects` sun sphere from
  that source.
- The false-model sun also derives `scene.lighting.sun` as a point-light state
  using the shared `Sun` class, so future atmosphere scattering can consume the
  same object that the renderer shows. Its visible body still animates around
  the simulation origin at fixed projected latitude as a solar-day body, using
  a 24-hour simulated circuit compressed into a 40-second visible loop.
- The visible false-model sun is now rendered through first-class `scene.sun`
  state rather than only through the generic object loop. Its render contract
  keeps the body visible and sizes it from physical `radiusKm`; observer-to-sun
  distance derives `scene.sun.apparent` and the matching apparent angular
  radius/diameter on `scene.lighting.sun`.
- The first planned false-sun controls are latitude, elevation above the
  projected floor, and physical radius. The scene model already supports these
  as `config.sun.lat`, `config.sun.altitudeKm`, and `config.sun.radiusKm`, and
  changing them updates the rendered body, apparent size, and point-light
  state from the same source.
- The dome star points animate around the same vertical axis on a sidereal-day
  period. With the solar day set to 40 seconds, the sidereal loop takes about
  `39.8908` seconds.
- The Big Dipper, Little Dipper, Orion, and Southern Cross are rendered as red
  line overlays on the dome. The overlay rotates with the same sidereal period
  as the star points.
- The old `AltitudeHaze` transparent shader shell has been removed from the
  false-simulation renderer. `scene.atmosphere` now exposes a disabled
  shared-atmosphere placeholder with the flat-slab frame and standard Earth
  profile; no visual atmosphere pass renders until the new light-aware shared
  atmosphere shader is implemented.
- `src/flat/features/false-simulation/components/atmosphere-uniforms.js` now
  adapts shared `Atmosphere` state and the resolved animated sun light into
  Three/R3F-style uniform objects. It flattens the atmosphere frame for shader
  use and keeps mutable sun uniforms stable so a future `useFrame()` atmosphere
  pass can update from the same animated sun state as the visible `SunBody`.
- `src/flat/features/false-simulation/components/FalseAtmosphere.jsx` renders
  the first light-aware atmosphere shell. It consumes the shared atmosphere
  uniforms, updates from the animated sun each frame, and performs a flat-slab
  Rayleigh/Mie single-scattering approximation in GLSL. It is now superseded
  by the composer path for default rendering, but can remain temporarily as a
  debug fallback while the depth-aware pass is validated.
- `src/flat/features/false-simulation/components/FalseAtmosphereComposer.jsx`
  now owns the first depth-aware composition pass. It renders the solid false
  scene into an offscreen `WebGLRenderTarget` with `DepthTexture`, then draws a
  fullscreen shader that samples scene color/depth, reconstructs world
  position, integrates the flat-slab atmosphere to the solid surface or
  atmosphere exit, and composites
  `sceneColor * transmittance + inScatteredLight`. `FalseSkyScene.jsx` now
  splits camera/look controls from the solid render contents so floor,
  mountains, stars, constellations, and the visible sun flow through the
  composer.
- The false-simulation Earth floor now uses the app-wide copied raster
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
- The false-simulation scene now includes a deterministic synthetic local
  mountain pass: 200 observer-relative rectangular prisms between `1` and
  `100 miles` from the observer, with heights from `500` to `3000 feet`. The
  prisms are currently all red so distance haze can be judged against one
  baseline color. Each prism derives its footprint from height: width is `5x`
  height and length/depth is `10x` height. Generation uses the existing shared
  `src/gc/utils/random.js` deterministic `Random` module while restoring the
  previous seed afterward. This is temporary POC terrain evidence, not real DEM
  terrain.
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
- The dome surface remains hidden, but visible latitude/parallel guide rings
  are drawn around the dome every 10 degrees.
- The sky projection uses the full north-to-south celestial-pole domain:
  `0°` angular distance from the north celestial pole is the projection
  center/top above the simulation origin/projected north pole, not above the
  observer. `180°` is the south celestial pole on the outer horizon/rim.
- Stars are rendered as Three.js points at their projected 3D dome positions,
  with perspective size attenuation enabled. The current point size is
  intentionally exaggerated in kilometer units so distant point sources remain
  visible during the POC.
- Dome latitude guide rings are physical thin torus meshes rather than
  screen-space lines, so their thickness and spacing participate in camera
  perspective.
- The dome lift maps projected angular ratio to hemisphere polar angle:
  `surfaceRadius = domeRadius * sin(ratio * pi / 2)`. This keeps the full
  north-to-south celestial pole domain while making latitude ring radii
  converge toward the horizon/rim.
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
  false-simulation scene model specs.
- `npx polylith build flat` passed after adding the first Three.js scene.
- Browser checks for `/flat/false-simulation` passed on desktop `1280x800` and
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
  sphere source with `DEFAULT_FALSE_SIMULATION_SUN`, deriving `scene.sun`,
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
  atmosphere, sun, math helper, false-simulation scene-model, and sun-rendering
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
  screenshot for `/flat/false-simulation` showed a nonblank render with North
  America/Arctic floor context after the shader/world-axis correction.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after setting the default observer elevation to `100 ft` and adding
  the deterministic 200-rectangle synthetic mountain simulation between `1` and
  `100 miles` from the observer.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after adding the first `FalseAtmosphere` light-aware shell shader and
  enabling the shared atmosphere pass by default. A Puppeteer smoke check was
  attempted afterward, but `http://localhost:3000/flat/false-simulation`
  refused the connection because the local server was not running.
- `npm run test:ui:flat`, `npx polylith build flat`, and `git diff --check`
  passed after adding the first `FalseAtmosphereComposer` depth-aware
  composition pass. A local server probe still failed because
  `http://localhost:3000/flat/false-simulation` was not running.
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
- `FalseAtmosphereComposer` now has temporary background-pixel debug rendering.
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
- The solar/sidereal scene rotation speed is now quartered from the previous
  loop: solar-day display duration is `40 seconds`, and the derived sidereal
  display duration is about `39.8908 seconds`.

Next:

- Browser-check the real composer path with separated solid/sky source gains
  and `skyLightTransmittanceFloor: 0.05`. Confirm whether sky scattering is
  now visible without whitening the ground.
- Browser-check the stabilized `FalseAtmosphereComposer` pass once the local
  flat server is running. Confirm no shader/WebGL console errors, visible
  observer-local floor, no floor popping while turning, star attenuation
  through atmosphere transmittance, and stronger haze on distant mountains than
  nearby mountains.
- Replace the temporary observer-local floor patch with local terrain or a
  stable near-observer floor depth representation before treating the floor
  contract as final.
- Decide whether to keep `FalseAtmosphere.jsx` as a temporary debug fallback
  or remove the shell path now that the composer owns atmosphere rendering.
- Add package-shaped projection/math helpers outside React and Three.js.
- Add city/observer selection using the SAT city picker as the precedent.
- Add static star data selection and preprocessing.

## POC Scope

- Render the outline of the false simulation in Three.js.
- Build the POC inside the REMVC/Polylith app structure rather than as
  disposable standalone code.
- Represent the projected Earth plane/disc using an azimuthal equidistant
  projection centered on the north pole.
- Represent the false sky as the underside of a half-sphere dome above that
  projection.
- Defer the standard sky viewer until after the false-simulation outline is
  understandable.
- Defer the flat apparent-position mode until after the first false-simulation
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
     `src/flat/features/false-simulation`, `src/flat/services`,
     `src/flat/models`, `src/flat/assets`, and `src/flat/templates`.
   - Add `builds/flat.json` and include the app in Polylith configuration.
   - Mirror the pipeline app shape: app index starts the registry, `main`
     mounts React, `features/app` owns shell/navigation, and
     `false-simulation` owns its view workflow.
2. Build the app shell.
   - Keep the first shell minimal: title/header, page region, and one
     registered page for the false simulation.
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
   - The false-simulation controller owns page lifecycle and high-level state.
   - The false-simulation view service translates controller state into React
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

The `flat` false-simulation feature should consume a selected observer record
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
  overlays; not needed for the first false-simulation outline.
- IAU named-star catalog: useful for a human-readable named-star subset with
  RA/Dec and visual magnitude fields. The current Phase 1 fixture uses this
  shape as a compact checked-in bridge, but a generated asset with explicit
  attribution should replace it before the catalog becomes canonical.
- OpenNGC: useful later for galaxies, clusters, and nebulae; not required for
  first star-only POC.

## Future Terrain / Local Horizon Data

Future consideration: use topographic/elevation data around the selected
observer to simulate the local surface and horizon mask. This is not part of
the first false-simulation POC.

Focused terrain source notes now live in
[Terrain Data Options](terrain-data-options.md).

The same terrain/topographic source could later help show expected land
features for both simulations. In the standard view it can represent nearby
real terrain around the observer. In the false simulation it can help visualize
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

The active design note is [Atmosphere Design](atmosphere-design.md).

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
- What known starting value should anchor the initial false-simulation sun
  position before the future assumptions control panel can set it directly?
- Which later sun assumptions should the control panel expose after latitude,
  elevation, and radius: longitude/azimuth, motion period, light strength, or
  color?
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
