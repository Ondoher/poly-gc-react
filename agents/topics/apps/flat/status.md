# Flat

This topic tracks notes for a new project named `flat`.

## Current State

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
  [Atmosphere Reset Research](plans/atmosphere_reset/research.md): a
  physical-constants-first model that starts with a CPU spectral reference
  integrator, explicit CIE/display conversion, documented environmental inputs,
  and swappable world-geometry / solar-source properties before returning to
  shader tuning. The implementation contract is
  [Atmosphere Reset Design](plans/atmosphere_reset/design.md), and the
  CPU solver contract is
  [CPU Spectral Reference Integrator Design](plans/atmosphere_reset/cpu-spectral-reference-integrator-design.md).
  The checklist is [Atmosphere Reset Plan](plans/atmosphere_reset/plan.md),
  which adapts external test patterns from Bruneton/PBRT into local
  known-answer tests before shader parity. This plan should be executed
  test-first: write the analytic/invariant/reference-data tests for each phase,
  confirm they fail for missing behavior, then implement the reference code
  under `scripts/flat/atmosphere-reference` until they pass. The current
  implementation should be treated as architecture and naming material to mine,
  not as a compatibility constraint. The research note also includes the proposed
  flat-world/local-Sun variant as a separate physical configuration that should
  reuse the same scattering math while changing surface geometry, atmosphere
  volume, altitude/density rules, solar source geometry, and occlusion/boundary
  rules. A shader-specific design document is intentionally deferred until the
  CPU reference is trusted and shader parity work needs dedicated approximation
  contracts. If continuing the current path temporarily, use the
  [Spherical Sun Atmosphere Plan](plans/spherical-sun-atmosphere-plan.md)
  Phase 4.6 diagnostics before changing physical coefficients: confirm the
  Rayleigh phase angle sign convention, compare Rayleigh-only and Mie-only
  captures, and isolate whether the brown horizon comes from aerosol/Mie
  weighting, path length, tone mapping, or composition over red surfaces.

Recent verification:

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
  [Spherical Sun Atmosphere Plan](plans/spherical-sun-atmosphere-plan.md):
  integrate the shared depth-aware atmosphere model into the current
  `globe-simulation` view using the spherical-shell frame, real Sun state, high
  tessellation globe surface, and grounded synthetic red mountain markers before
  further tuning the flat-model atmosphere. The earlier
  [Reality-Aligned Daytime Atmosphere Plan](plans/reality-aligned-daytime-atmosphere-plan.md):
  remains the flat-model comparison context for bluer daylight, real-world
  analogs, named renderer controls, daylight airlight, and synthetic mountain
  replacement.
- [Atmosphere Design](atmosphere-design.md) is now a current-state reference
  only: shared architecture, current consumers, parameter catalog, active
  defaults, current scattering math, and known gaps. Historical phase logs and
  superseded implementation notes have been removed from that design doc.
  Rejected ideas that should not be revisited are tracked separately in
  [Atmosphere Rejected Ideas](atmosphere-rejected.md).
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
  `src/flat/features/flat-simulation/models/consts.js` owns flat-simulation
  scene defaults. Class implementation files now export only their class:
  `Atmosphere.js`, `Sun.js`, and `FlatSimulationSceneModel.js` no longer
  export constants or secondary named symbols.
- `src/flat/shared/types.d.ts` and
  `src/flat/features/flat-simulation/models/types.d.ts` now define ambient
  JSDoc types for shared atmosphere/sun/math contracts and flat-simulation
  scene/sun contracts. Newly added atmosphere, sun, math helper, scene-model,
  and first-class sun-rendering code now uses those types in JSDoc.
- [Atmosphere Design](atmosphere-design.md) now includes a concrete renderer
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
  [phase-5-physical-surface-skylight-spiral-mountains](baselines/daytime-atmosphere/phase-5-physical-surface-skylight-spiral-mountains/README.md)
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
- [Atmosphere Design](atmosphere-design.md) now records the idealized
  single-scattering radiance equation and follow-up simplifications that derive
  lower-level shader values from physical quantities: aerosol optical depth,
  single-scattering albedo, Angstrom exponent, air mass, average-density view
  transmittance, diffuse sky irradiance ratio, and fixed Earth Rayleigh
  coefficients. It also includes an explicit simplified renderer calculation:
  derive Mie extinction/scattering/absorption from AOD and albedo, approximate
  sun transmittance from vertical optical depth and air mass, then compute a
  midpoint or short camera-ray-march approximation for surface and sky pixels.
- [Atmosphere Design](atmosphere-design.md) now also records the magic-number
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
- [Atmosphere Design](atmosphere-design.md) now includes the idealized
  per-pixel single-scattering algorithm to rebuild toward: depth-aware camera
  rays, camera-to-sample transmittance, sample-to-sun transmittance,
  Rayleigh/Mie phase terms, and final composition as
  `sceneColor * sceneTransmittance + inScatteredLight` for solid pixels or
  `inScatteredLight` for sky pixels. The note also records that the nested
  sample-to-light march is the expensive reference path and should be
  approximated in staged real-time passes.
- [Atmosphere Design](atmosphere-design.md) now also includes the reset
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
  [phase-1 baseline](baselines/daytime-atmosphere/phase-1/README.md), using
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
  [phase-2-clear-day baseline](baselines/daytime-atmosphere/phase-2-clear-day/README.md).
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
  [phase-2-solar-irradiance-50 baseline](baselines/daytime-atmosphere/phase-2-solar-irradiance-50/README.md)
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
  [phase-3-star-exposure baseline](baselines/daytime-atmosphere/phase-3-star-exposure/README.md)
  kept the same daylight sky samples as the solar-irradiance capture while
  visual inspection showed the previously obvious white star points and red
  constellation overlay no longer apparent in the fixed San Jose daytime
  screenshot. Verification: `npm run test:ui:flat`, `npm run build`, and
  `npm run capture:flat-atmosphere -- --label phase-3-star-exposure` passed.
- Flat-slab background distance Phase 4 is implemented. The default renderer
  controls are now `backgroundAtmosphereViewDistanceKm: 100` and
  `flatSlabHorizonViewDistanceFactor: 0.25`, with matching composer fallback
  constants if a scene override omits those fields. The
  [phase-4-background-distance-100-horizon-025 baseline](baselines/daytime-atmosphere/phase-4-background-distance-100-horizon-025/README.md)
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
  [phase-5-visible-false-sun-atmosphere baseline](baselines/daytime-atmosphere/phase-5-visible-false-sun-atmosphere/README.md)
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
  [phase-5-linked-visible-sun-atmosphere baseline](baselines/daytime-atmosphere/phase-5-linked-visible-sun-atmosphere/README.md):
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
  [phase-5-linked-visible-sun-irradiance-58 baseline](baselines/daytime-atmosphere/phase-5-linked-visible-sun-irradiance-58/README.md):
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
  fixed-latitude animation now consume the same service frame.
  `FlatSimulationSceneModel` currently publishes fixed playback at the
  closest-sun-to-San-Jose solar angle for stable daytime sky-color calibration.
  Verification: `npm run test:ui:flat` and `npm run build` passed.

Next:

- Continue
  [Spherical Sun Atmosphere Plan](plans/spherical-sun-atmosphere-plan.md) with
  Phase 4.5 or 4.6. Phase 4.4 has put globe surface albedo and marker lighting
  on the radiometric path, removing the main mixed-unit solid-surface
  composition issue. The remaining visible problems are that the globe sky is
  still muted blue-gray rather than clear daylight blue, and star brightness
  still lacks a named photometric radiance bridge even though the current
  daytime capture no longer shows bright star pixels at the probe points.
- Keep
  [Reality-Aligned Daytime Atmosphere Plan](plans/reality-aligned-daytime-atmosphere-plan.md)
  as the flat-model comparison context.
- Phase 0: mostly complete. Fixed San Jose daytime browser baseline samples
  are captured in
  [phase-1 baseline](baselines/daytime-atmosphere/phase-1/README.md);
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
- [Spherical Sun Atmosphere Plan](plans/spherical-sun-atmosphere-plan.md)
- [Reality-Aligned Daytime Atmosphere Plan](plans/reality-aligned-daytime-atmosphere-plan.md)
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
