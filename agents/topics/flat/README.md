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
- The scene model includes an orange altitude reference sphere: 32 miles in
  diameter, centered 3000 miles above projected latitude `24` at the longitude
  opposite the observer. It renders as a real Three.js sphere so perspective
  handles its apparent size and placement.
- The orange reference sphere animates around the simulation origin at the same
  projected latitude as a solar-day body, using a 24-hour simulated circuit
  compressed into a 10-second visible loop.
- The dome star points animate around the same vertical axis on a sidereal-day
  period. With the solar day set to 10 seconds, the sidereal loop takes about
  `9.9727` seconds.
- The Big Dipper, Little Dipper, Orion, and Southern Cross are rendered as red
  line overlays on the dome. The overlay rotates with the same sidereal period
  as the star points.
- The scene includes a first-pass atmosphere haze approximation rendered as a
  transparent shader shell inside the dome. The shader analytically integrates
  a simple linear atmosphere density gradient along the view ray: sea-level
  density at the projected ground plane, falling to zero at the Karman line
  (`100 km`). Dense sea-level haze reaches full opacity over roughly 300 miles
  of integrated optical path.
- The projected Earth base disc now uses an in-browser generated azimuthal
  equidistant texture: ocean shading, a latitude/longitude graticule, and rough
  hand-drawn land silhouettes for orientation. This is temporary visual context
  until a real projected map dataset/asset is selected. The temporary
  Antarctic annulus was removed after reading visually as a large green circle,
  and the base disc now fades distant surface texture through the same linear
  atmosphere optical-depth approximation.
- The default view is back at the San Jose/root observer point. The temporary
  floor-inspection camera has been removed from the default scene model, though
  `camera` remains an optional scene override for future debugging.
- The generated map texture remains temporarily high contrast: darker ocean,
  brighter land, stronger graticule, and a stronger rim.
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
- Temporary floor texture diagnostic: the generated Earth texture now includes
  bright magenta/cyan calibration cross marks, and the floor material disables
  fog, tone mapping, and depth writes so the texture path is easier to verify
  from the observer view.
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
  orange altitude reference sphere.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  separate solar-day orange sphere animation and sidereal dome-star animation.
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

Next:

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
- Use fixed celestial-object data for the first POC. Ignore planets and the
  moon initially; fold them in later through a separate ephemeris/data-source
  decision.
- Track the first render goal in
  [Flat POC Phase 1 Plan](poc-phase-1-plan.md).

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

The same terrain/topographic source could later help show expected land
features for both simulations. In the standard view it can represent nearby
real terrain around the observer. In the false simulation it can help visualize
what landforms or surface features the projected model predicts should appear
around the viewer.

Promising sources:

- USGS 3DEP: best first choice for U.S. locations, public domain, high
  resolution, and available as DEM products and lidar/source elevation data.
- NASA SRTM / NASADEM: useful near-global baseline, especially for a coarse
  local horizon or terrain mesh. Good fallback when U.S.-only 3DEP coverage is
  not enough.
- Copernicus DEM: global 30m/90m products are worth evaluating for non-U.S.
  coverage, but license/attribution terms should be reviewed before bundling.
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

- [Flat POC Prompt](/c:/dev/poly-gc-react/agents/topics/flat/prompt.md)
- [Flat POC Phase 1 Plan](/c:/dev/poly-gc-react/agents/topics/flat/poc-phase-1-plan.md)
- [ProjectionModel API Draft](/c:/dev/poly-gc-react/agents/topics/flat/projection-model-api.md)
- [Architecture Overview](/c:/dev/poly-gc-react/agents/topics/architecture/architecture-overview.md)
- [Architecture Topic](/c:/dev/poly-gc-react/agents/topics/architecture/README.md)
- [REMVC Architecture](/c:/dev/poly-gc-react/agents/topics/architecture/remvc-architecture.md)
- [Feature Mechanics](/c:/dev/poly-gc-react/agents/topics/architecture/feature-mechanics.md)
- [Build And Asset Flow](/c:/dev/poly-gc-react/agents/topics/architecture/build-and-assets.md)
- [Pipeline App Topic](/c:/dev/poly-gc-react/agents/topics/pipeline-app/README.md)
- [Pipeline App Source](/c:/dev/poly-gc-react/src/pipeline)
- [Pipeline Build Definition](/c:/dev/poly-gc-react/builds/pipeline.json)
- [SAT App Topic](/c:/dev/poly-gc-react/agents/topics/sat-app/README.md)
- [SAT City Index Script](/c:/dev/poly-gc-react/scripts/sat/build-city-index.js)
- [SAT Main App](/c:/dev/poly-gc-react/src/sat/main/App.jsx)
