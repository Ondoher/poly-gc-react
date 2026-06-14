# Flat POC Phase 1 Plan

Phase 1 goal: render the flat-simulation sky for San Jose, CA at midnight
local time at the start of May 22, 2026.

```text
root: San Jose, CA
lat: 37.3382
lon: -121.8863
elevation: 100 ft / 30.48 m
time: 2026-05-22T00:00:00-07:00
```

The target is a static, inspectable Three.js scene. Do not add city picking,
catalog ingestion, planets, the moon, terrain, or the standard sky viewer in
this phase.

Also defer the later flat apparent-position mode in this phase. That mode will
keep the flat scene presentation while positioning celestial objects from their
real apparent azimuth/altitude relative to the observer and time.

## Progress Checklist

- [x] Scaffold `flat` as a Polylith REMVC app.
- [x] Add app shell feature and first `flat-simulation` feature boundary.
- [x] Add clean `/flat/*` server route fallback.
- [x] Verify `npx polylith build flat`.
- [x] Set up app-local Polylith/Karma unit test entry.
- [x] Add flat-specific Karma config for `tests/flat.js`.
- [x] Create app-local projection math module.
- [x] Implement `ProjectionModel` registration and composition.
- [x] Implement the first Earth projection:
  `north-pole-azimuthal-equidistant`.
- [x] Implement the first celestial projection:
  `north-celestial-pole-azimuthal-equidistant`.
- [x] Implement the first sky-surface projection:
  `upper-hemisphere-radial-lift`.
- [x] Add a compact real bright-star POC fixture.
- [x] Project fixture stars through `ProjectionModel`.
- [x] Replace the flat-simulation placeholder with a Three.js scene component.
- [x] Render projected Earth disc/plane.
- [x] Project stars to a hidden sky-dome surface.
- [x] Draw concentric sky latitude rings every 10 degrees to the horizon/rim.
- [x] Render star points on the dome underside.
- [x] Render from the San Jose/root observer point of view.
- [x] Add observer-rooted Earth-surface scale cues.
- [x] Add minimal scene look-around controls for observer inspection.
- [x] Add focused math checks or a small verification script.
- [x] Verify `node --check` for new non-JSX math/controller files.
- [x] Verify `npm run test:ui:flat` after real projection specs are added.
- [x] Verify `npx polylith build flat`.
- [x] Browser-check `/flat/flat-simulation` for nonblank scene, hidden dome,
  visible Earth/sky context, visible star points, and stable responsive layout.

## Implementation Shape

Recommended files:

```text
src/flat/shared/projection/
  ProjectionModel.js
  index.js
  earth/
    NorthPoleAzimuthalEquidistantEarthProjection.js
  celestial/
    NorthCelestialPoleAzimuthalEquidistantProjection.js
  sky-surface/
    UpperHemisphereRadialLiftProjection.js
```

Possible POC fixture location:

```text
src/flat/shared/projection/poc-stars.js
```

or, if it should ship as a copied asset immediately:

```text
src/flat/assets/data/poc-stars.json
```

For Phase 1, a shared projection-local fixture is acceptable because the goal
is rendering the projection, not catalog/data-pipeline design. The current
fixture is a compact set of 123 named bright stars with J2000 RA/Dec and visual
magnitude fields. It should be replaced by a generated catalog asset once the
canonical catalog source and attribution/licensing approach are selected.

## ProjectionModel Phase 1 API

Implement the smallest useful subset of the draft API:

- `constructor(options)`
- `setRoot(root)`
- `getRoot()`
- `setTime(time)`
- `getTime()`
- `projectEarthPoint(point)`
- `projectObserver(observer?)`
- `projectCelestialPoint(point)`
- `projectSkyToSurface(projectedPoint)`
- `projectStar(star)`
- `projectStars(stars)`
- `describe()`

Projection implementations should register by role. Avoid switch statements in
`ProjectionModel` for supported projections.

## Static POC Configuration

Use this as the initial flat-simulation config:

```js
{
	root: {
		id: 'san-jose-ca-us',
		name: 'San Jose',
		admin1: 'CA',
		country: 'US',
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 30.48,
	},
	time: '2026-05-22T00:00:00-07:00',
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
	options: {
		meanEarthRadiusKm: 6371.0088,
		earthProjectionRadiusKm: 20015.114442035923,
		domeRadiusKm: 20015.114442035923,
		referenceRightAscensionDeg: 0,
	},
}
```

## Scene Output Contract

The flat-simulation page should derive a plain scene view model before passing
data to Three.js:

```js
{
	root: {
		id: 'san-jose-ca-us',
		name: 'San Jose',
		admin1: 'CA',
		country: 'US',
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 30.48,
	},
	time: '2026-05-22T00:00:00-07:00',
	model: {
		id: 'flat-poc-flat-simulation',
		earthProjection: 'north-pole-azimuthal-equidistant',
		celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
		skySurfaceProjection: 'upper-hemisphere-radial-lift',
		options: {
			meanEarthRadiusKm: 6371.0088,
			earthProjectionRadiusKm: 20015.114442035923,
			domeRadiusKm: 20015.114442035923,
			referenceRightAscensionDeg: 0,
		},
	},
	observer: {
		kind: 'observer',
		position: {
			x: -4972.091350763685,
			y: 0,
			z: 3093.205046526761,
		},
		visible: true,
	},
	earth: {
		radiusKm: 20015.114442035923,
	},
	dome: {
		radiusKm: 20015.114442035923,
	},
	atmosphere: {
		enabled: false,
		model: 'shared-atmosphere',
		frame: {
			kind: 'flat-slab',
			origin: { x: 0, y: 0, z: 0 },
			up: { x: 0, y: 1, z: 0 },
		},
		profile: {
			id: 'earth-standard',
			topAltitudeKm: 100,
			// Standard Earth atmosphere profile fields from shared consts.
		},
		rendering: {
			status: 'pending-light-aware-shader',
			target: 'depth-aware-composition',
		},
	},
	stars: [
		// 129 projected named bright-star records in the current fixture.
		{
			kind: 'star',
			id: 'HIP 677',
			name: 'Alpheratz',
			position: {
				x: 247.8178274114148,
				y: 18834.367117038513,
				z: -6768.309076337344,
			},
			visible: true,
			source: {
				raDeg: 2.096916,
				decDeg: 29.090431,
				magnitude: 2.07,
				source: 'iau-bright-named-j2000',
			},
		},
		// ...
	],
	constellations: [
		{
			id: 'big-dipper',
			name: 'Big Dipper',
			color: '#ff3030',
			segments: [
				// Projected red line segments between fixture stars.
			],
		},
		// Little Dipper, Orion, Southern Cross.
	],
	sun: {
		kind: 'sun',
		id: 'false-sun',
		name: 'False model sun',
		position: {
			// Projected latitude 24 at the longitude opposite the observer,
			// plus 3000 miles altitude.
			x: 6231.424469927028,
			y: 4828.032,
			z: 3876.6531541034733,
		},
		radiusKm: 25.749504,
		visible: true,
		rendering: {
			renderBody: true,
			sizeModel: 'physical-radius-km',
			apparentSizeSource: 'observer-position-and-body-radius',
		},
		apparent: {
			distanceKm: 14050.18089116235,
			angularRadiusRad: 0.0018326823415099843,
			angularDiameterRad: 0.0036653646830199687,
			source: 'observer-position-and-body-radius',
		},
		object: {
			kind: 'sphere',
			role: 'sun',
			id: 'false-sun',
			name: 'False model sun',
			// Same position/radius/source/style/animation as this sun.
		},
		light: {
			kind: 'point',
			position: {
				x: 6231.424469927028,
				y: 4828.032,
				z: 3876.6531541034733,
			},
			radiusKm: 25.749504,
			distanceKm: 14050.18089116235,
			apparentAngularRadiusRad: 0.0018326823415099843,
			apparentAngularDiameterRad: 0.0036653646830199687,
			color: { r: 1, g: 0.82, b: 0.55 },
			intensity: 1,
			anchor: {
				kind: 'flat-simulation-visible-sun',
				status: 'open',
			},
		},
		animation: {
			type: 'solar-day-fixed-latitude-rotation',
			simulatedDurationHours: 24,
			displayDurationSeconds: 10,
		},
		source: {
			lat: 24,
			lon: 58.1137,
			altitudeKm: 4828.032,
			diameterKm: 51.499008,
		},
	},
	lighting: {
		sun: {
			// Derived from sun.light.
		},
	},
	objects: [
		{
			kind: 'box',
			role: 'mountain-simulation',
			id: 'mountain-rectangle-1',
			name: 'Mountain rectangle 1',
			position: {
				// Observer-relative placement in the distance/bearing spiral.
			},
			size: {
				// Height is 2000 feet; width is 5x height and
				// length/depth is 10x height.
			},
			rotationYRad: 0,
			visible: true,
			style: {
				color: '#ff0000',
			},
			source: {
				heightFeet: 2000,
				distanceMiles: 0.5,
				bearingDeg: 22.5,
				role: 'stray-near-field-calibration',
			},
		},
		// 21 more deterministic synthetic mountain spiral markers from
		// 1 to 101 miles.
		{
			kind: 'sphere',
			role: 'sun',
			id: 'false-sun',
			name: 'False model sun',
			position: {
				// Derived from sun.object for renderer compatibility.
				x: 6231.424469927028,
				y: 4828.032,
				z: 3876.6531541034733,
			},
			radiusKm: 25.749504,
			visible: true,
			style: {
				color: '#ff8a1f',
			},
			rendering: {
				renderBody: true,
				sizeModel: 'physical-radius-km',
				apparentSizeSource: 'observer-position-and-body-radius',
			},
			apparent: {
				distanceKm: 14050.18089116235,
				angularRadiusRad: 0.0018326823415099843,
				angularDiameterRad: 0.0036653646830199687,
				source: 'observer-position-and-body-radius',
			},
			animation: {
				type: 'solar-day-fixed-latitude-rotation',
				simulatedDurationHours: 24,
				displayDurationSeconds: 10,
			},
			source: {
				lat: 24,
				lon: 58.1137,
				altitudeKm: 4828.032,
				diameterKm: 51.499008,
			},
		},
	],
	animation: {
		solarDay: {
			simulatedDurationHours: 24,
			displayDurationSeconds: 10,
		},
		siderealDay: {
			simulatedDurationHours: 23.9344696,
			displayDurationSeconds: 9.972695666666667,
		},
	},
}
```

The Three.js component consumes this scene view model and should not know how to
run projections itself.

The current local terrain pass is intentionally synthetic: the model generates
one stray near-field red prism at `0.5 miles` and `22.5 degrees` bearing, plus
21 deterministic observer-relative red rectangular prisms in a spiral from `1`
to `101 miles`, with one new marker every `5 miles`. Each marker is
`2000 feet` tall; width is `5x` height and length/depth is `10x` height. The
bearing sequence cycles through north, northeast, east, southeast, south,
southwest, west, and northwest, then shifts the next eight-marker turn by
`10 degrees` so distant markers are less hidden behind nearer ones. This is a
visual simulation aid until real DEM terrain is connected.

## Verification Notes

Math checks should confirm:

- San Jose/root projects to finite Earth coordinates.
- Projection-specific expectations are justified through mathematical
  invariants from each projection definition: poles, equator, projection edge,
  reference meridian/RA rotation, dome top/rim, sphere membership, and
  out-of-domain visibility.
- North celestial pole maps to the dome center/top under the first celestial
  projection.
- Celestial equator maps to the expected projected radius.
- Every POC fixture star returns finite `position.x`, `position.y`, and
  `position.z`.
- Projected star visibility is explicit even when all fixture stars are
  rendered.

Browser check should confirm:

- `/flat/flat-simulation` loads.
- The scene is nonblank.
- The scene renders from the observer's projected point of view.
- The sky dome surface is not visibly rendered.
- Star points are visible.
- The root/time are visible in page text or state for debugging.
- Layout is stable on desktop and mobile widths.

Latest browser check:

- Added `<base href="/flat/">` to the flat HTML template so deep routes load
  built scripts and styles from the app root instead of falling through to the
  route fallback as HTML.
- Fixed `FlatSkyScene` OrbitControls setup so the control target is assigned
  through `Vector3.set(...)` instead of replacing the target with an array.
- Puppeteer desktop check at `1280x800` confirmed San Jose/time text, no page
  errors, a `1192 x 644` canvas screenshot, and nonblank visible pixels.
- Puppeteer mobile check at `390x844` confirmed San Jose/time text, no page
  errors, no horizontal overflow, a `336 x 637` canvas screenshot, and nonblank
  visible pixels.
- Changed the scene camera to render from the projected San Jose observer
  position and removed the visible dome mesh/observer marker from the scene.
- Puppeteer observer-POV checks passed on desktop `1280x800` and mobile
  `390x844`: San Jose/time text was present, no page errors were reported, the
  canvas was nonblank, and mobile width had no horizontal overflow.
- Added drag-to-look controls on the Three.js canvas. The camera remains fixed
  at the projected observer position while pointer movement changes yaw/pitch.
- Puppeteer drag checks passed on desktop and mobile: the canvas remained
  nonblank, no page errors were reported, and screenshot pixels changed after
  simulated drags.
- Added subtle range rings and radial bearing lines on the projected Earth
  surface, centered at the observer, to make the false world scale easier to
  perceive from the observer point of view.
- Lowered the initial observer camera target so the starting view includes more
  projected ground/horizon context instead of immediately looking high into the
  sky.
- Replaced the original 18-star sample with a compact real named bright-star
  subset tagged as `iau-bright-named-j2000`.
- Added fixture tests requiring 120+ stars, finite projection fields, stable
  unique ids, and source tagging.
- Puppeteer desktop and mobile checks passed after the larger star subset; both
  views stayed nonblank and drag still changed the rendered view.
- Converted flat-simulation geometry from toy scene units to kilometer-scale
  coordinates. The Earth projection now uses mean Earth radius
  `6371.0088 km`; the projected Earth disc and hidden dome radius are both
  `20015.114442035923 km`.
- Updated renderer camera near/far planes, observer eye height, star point
  attenuation, and range-ring distances for kilometer-scale coordinates.
- `npm run test:ui:flat`, `npx polylith build flat`, and desktop/mobile
  Puppeteer checks passed after the scale conversion.
- Swapped the visible dome guide lines to projection-correct latitude rings:
  every 10 degrees of angular distance from the north celestial pole, forming
  concentric circles out to the horizon/rim while the dome surface stays hidden.
- These rings use the full false celestial projection domain: `0°` angular
  distance from the north celestial pole is the center/top above the simulation
  origin/projected north pole, not above the observer. `180°` angular distance
  is the south celestial pole on the outer horizon/rim.
- Desktop/mobile Puppeteer checks passed after correcting the dome latitude
  rings; both views stayed nonblank and drag still changed the rendered view.
- Changed star rendering to use dome-embedded Three.js point positions with
  perspective size attenuation enabled. The point size is intentionally
  inflated in kilometer units so distant point sources remain visible for this
  POC.
- Desktop/mobile Puppeteer checks passed after enabling star size attenuation;
  stars stayed visible and drag still changed the rendered view.
- Reduced the perspective-attenuated star world size from `850 km` to
  `120 km` after the first pass read too large.
- Replaced screen-space dome latitude line segments with thin physical torus
  rings so the guide thickness and placement participate in the camera
  perspective.
- Desktop/mobile Puppeteer checks passed after the smaller stars and physical
  latitude rings.
- Corrected the dome lift so projected angular ratio maps to dome polar angle:
  `surfaceRadius = domeRadius * sin(ratio * pi / 2)`. This keeps `0°` at the
  dome top and `180°` at the horizon/rim while making latitude ring radii
  converge toward the horizon.
- Updated sky-surface and `ProjectionModel` tests for the new halfway case:
  the celestial equator now lands at a 45-degree dome polar angle, with
  horizontal radius and height both `domeRadius / sqrt(2)`.
- Expanded the Phase 1 named-star fixture from 73 to 123 records while keeping
  the existing fixture contract: stable ids, display names, J2000 RA/Dec,
  visual magnitude, and `iau-bright-named-j2000` source tags.
- `npm run test:ui:flat` and `npx polylith build flat` passed after the
  fixture expansion.
- Added missing asterism stars for the Little Dipper and Southern Cross, bringing
  the Phase 1 fixture to 129 stars. Asterism-only additions are tagged
  `poc-asterism-j2000`.
- Added red constellation overlays for the Big Dipper, Little Dipper, Orion,
  and Southern Cross. The scene model projects the line segments from fixture
  stars and fails loudly if an overlay references a missing star.
- The red constellation overlays rotate with the same sidereal-day animation as
  the dome star points.
- Added a first-pass altitude-sensitive haze shell. The shader analytically
  integrates a linear atmospheric density gradient along the view ray:
  sea-level density at the projected ground plane and zero density at the
  Karman line (`100 km`).
- Dense sea-level haze reaches full opacity over roughly 300 miles of
  integrated optical path.
- Added an in-browser generated azimuthal equidistant Earth texture to the
  base disc. It draws ocean shading, projected graticule lines, and coarse
  hand-drawn land silhouettes as temporary orientation detail.
- Removed the temporary Antarctic annulus from the generated texture after it
  read as a large green circle, toned down the land colors, and changed the
  base disc to fade distant texture into haze using the same linear atmosphere
  optical-depth approximation.
- Temporarily disabled haze and moved the camera 500 miles below the projected
  Polaris point, looking at the projection center, for floor texture inspection.
- Widened the orthographic inspection view and boosted temporary map contrast:
  darker ocean, brighter land, stronger graticule, and a stronger rim.
- Fixed the temporary orthographic floor-inspection camera to configure the
  actual React Three Fiber camera with canvas-aspect-aware bounds. Also fixed
  the base-disc shader so `atmosphere.enabled: false` disables haze-color
  blending on the floor.
- Moved the temporary floor-inspection camera below the dome star layer: 500
  miles above the floor under the projected Polaris point, still looking at the
  projection center.
- Replaced the base `circleGeometry` with a subdivided plane and circular
  fragment discard after a diagonal cutoff suggested a circle-triangle/UV
  rendering artifact. The temporary orthographic inspection camera was replaced
  with a regular perspective camera below the dome/star layer after the cutoff
  persisted.
- Brought over the immediately useful rendering-pipeline idea from the
  `leoawen/volumetric_cloud_atmosphere_scattering` reference: keep solid-world
  rendering separate from atmosphere composition. The generated Earth texture
  now includes transparent outside-disc alpha and renders with a plain
  `meshBasicMaterial`; haze stays in the separate atmosphere overlay path.
- Added temporary magenta/cyan floor texture calibration cross marks and set
  the floor material to disable fog, tone mapping, and depth writes so the
  generated texture path is easier to verify from the observer view.
- Restored the default camera to the San Jose/root observer point. The
  temporary floor-inspection camera is no longer included in the default scene
  model, though `camera` remains an optional scene override for future
  debugging.
- Added the high-altitude visible sphere that later became the formal
  false-model sun: 32 miles in diameter, centered 3000 miles above projected
  latitude `24` at the longitude opposite the observer.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding
  that initial visible solar body.
- The former orange reference sphere is now formalized as the false-model sun:
  `DEFAULT_FLAT_SIMULATION_SUN` derives `scene.sun`, a visible sun sphere in
  `scene.objects`, and `scene.lighting.sun` point-light state.
- The renderer now consumes `scene.sun` directly for the visible body because
  the sun's position and apparent angular size are simulation evidence, not
  optional decoration. The generic `scene.objects` entry remains a derived
  compatibility view.
- The first planned controls for the false-model sun are latitude, elevation
  above the projected floor, and physical radius. The scene model already
  accepts those as `config.sun.lat`, `config.sun.altitudeKm`, and
  `config.sun.radiusKm`; the rendered body, apparent size, and point-light
  state are all derived from those values.
- Animated the false-model sun around the simulation origin at fixed
  projected latitude as a solar-day body, compressing a 24-hour circuit into a
  40-second loop.
- Added a separate sidereal-day animation for the dome star points. With the
  solar day set to 40 seconds, the sidereal star loop takes about `39.8908`
  seconds.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  separate solar/sidereal animation periods.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  constellation overlays.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  haze approximation.
- `npm run test:ui:flat` and `npx polylith build flat` passed after tuning the
  haze saturation distance to roughly 300 miles.
- The old first-pass haze shell was later removed. The scene now carries a
  disabled shared-atmosphere placeholder until the light-aware atmosphere
  renderer is implemented.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  generated Earth projection base texture.
- `npm run test:ui:flat` and `npx polylith build flat` passed after tuning the
  generated base texture and adding atmospheric fade to the base-disc material.
- `npm run test:ui:flat` and `npx polylith build flat` passed after the
  temporary floor-inspection camera/haze setup.
- `npm run test:ui:flat` and `npx polylith build flat` passed after widening
  the map inspection view and increasing temporary texture contrast.
- `npm run test:ui:flat` and `npx polylith build flat` passed after the camera
  setup and floor haze-toggle fixes.
- `npm run test:ui:flat` and `npx polylith build flat` passed after moving the
  floor-inspection camera below the dome star layer.
- `npm run test:ui:flat` and `npx polylith build flat` passed after replacing
  the base circle mesh with a shader-clipped plane.
- `npm run test:ui:flat` and `npx polylith build flat` passed after switching
  the temporary floor-inspection camera back to perspective mode below the
  dome/star layer.
- `npm run test:ui:flat` and `npx polylith build flat` passed after separating
  the Earth floor material from atmosphere composition.
- `npm run test:ui:flat` and `npx polylith build flat` passed after restoring
  the default San Jose observer camera.
- `npm run test:ui:flat` and `npx polylith build flat` passed after adding the
  temporary floor texture calibration marks.
