# Flat POC Implementation Prompt

Build the first proof of concept for `flat`, a new Polylith REMVC app in this
repo.

## Goal

Create the outline of the false night-sky simulation only. Do not build the
standard sky viewer yet.

The broader product will eventually compare:

- a standard night-sky viewer
- a hypothetical night-sky viewer based on intentionally incorrect assumptions

The first POC should make the false model visible, inspectable, and placed in
the eventual app architecture.

Use [Flat POC Phase 1 Plan](poc-phase-1-plan.md) as the current progress
checklist for the first render goal.

Phase 1 render target:

```text
root: San Jose, CA
lat: 37.3382
lon: -121.8863
time: 2026-05-22T00:00:00-07:00
```

Keep Phase 1 static. Do not add city picking, full catalog ingestion, planets,
the moon, terrain, or the standard sky viewer until the false-simulation scene
is rendering and inspectable.

## False Model

The false simulation is based on these assumptions:

- Earth is treated as an azimuthal equidistant projection centered on the north
  pole.
- The sky is treated as a similar projection of the celestial sphere.
- The projected sky is placed onto the underside of a half-sphere dome that
  sits on top of the projected Earth.

The exact observer mapping, celestial coordinate mapping, and time/motion model
are still open design details. Keep those decisions isolated in projection
helpers/models so they can evolve.

## Architecture

Set `flat` up as a proper Polylith REMVC app, not as an ad hoc React page.

Use the pipeline app as the local model:

- app `index.js` imports Polylith feature/config side effects, services,
  models, and `main`, then starts the registry
- `main` owns application startup and React root bootstrap only
- `features/app` owns the visible shell, navigation, route/page mounting, and
  page registration behavior
- each major view exists as its own removable feature
- controllers talk to registered view services
- React is presentation and forwards user intent to the view service
- app and feature build files explicitly define copied CSS/resources and
  included features

Expected initial structure:

```text
src/flat/
  index.js
  main/
  features/
    app/
    false-simulation/
  services/
  models/
  assets/
  templates/
builds/flat.json
```

The first feature-level view is `false-simulation`. The later standard sky
viewer should become a separate feature.

## Rendering

Use Three.js for the false-simulation POC.

Render at least:

- the projected Earth disc/plane
- north-pole-centered grid or reference rings
- a half-sphere sky dome
- stars placed on the underside of the dome
- enough camera/orbit controls to inspect the model

Keep the Three.js scene component focused on presentation. Projection math and
data loading should live outside the React/Three.js component.

For Phase 1, derive a plain scene view model before rendering:

```js
{
	root: {
		id: 'san-jose-ca-us',
		name: 'San Jose',
		admin1: 'CA',
		country: 'US',
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 0,
	},
	time: '2026-05-22T00:00:00-07:00',
	model: {
		id: 'flat-poc-false-simulation',
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
	earth: { radiusKm: 20015.114442035923 },
	dome: { radiusKm: 20015.114442035923 },
	stars: [
		// 73 projected named bright-star records in the current fixture.
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
}
```

The Three.js scene should consume this view model and should not run projection
math itself.

## Data

Use fixed celestial-object data for the first POC.

- Ignore planets and the moon initially.
- Fold planets and the moon in later through a separate ephemeris/data-source
  decision.
- Prefer a static star catalog snapshot that can be checked into the repo or
  transformed into a generated asset with clear attribution.
- Prefer data whose license sits cleanly beside MIT-licensed app code.
- For the POC, use a magnitude-limited subset rather than a huge all-sky
  catalog.
- For Phase 1, a compact checked-in real bright-star fixture is acceptable.
  Full catalog ingestion can wait until the projection and rendering path is
  visible.

Candidate catalog direction:

- Hipparcos / Hipparcos 2 is the preferred starting point for cleaner
  provenance and permissive/public-data use.
- HYG is convenient, but current versions are CC BY-SA 4.0 and may add
  attribution/share-alike obligations for adapted catalog data.
- Yale Bright Star Catalog may be enough if the POC only needs naked-eye
  stars.
- Gaia DR3 is likely too large/heavy for the first POC unless reduced offline.

Transform catalog input into app-facing records such as:

```json
{
  "id": "HIP 32349",
  "name": "Sirius",
  "raDeg": 101.287,
  "decDeg": -16.716,
  "magnitude": -1.46,
  "source": "hipparcos"
}
```

## Future Terrain / Local Surface Data

Terrain/topographic data is a future consideration, not part of the first POC.

Potential uses:

- simulate local terrain around the observer
- derive a local horizon mask for star visibility near the horizon
- show expected nearby land features in the standard simulation
- show the landforms or surface features the false projected model predicts
  around the viewer

Candidate data sources to evaluate later:

- USGS 3DEP for high-resolution public-domain U.S. elevation data
- NASA SRTM / NASADEM for broad near-global elevation coverage
- Copernicus DEM for global 30m/90m coverage, pending license review
- Natural Earth for coarse public-domain map context, not detailed local
  horizon geometry

Keep this separate from the first star/dome projection model.

## Observer Location

Use the SAT app's city-picking mechanism as the precedent for choosing
observer latitude/longitude.

Current SAT pattern:

- `scripts/sat/build-city-index.js` reads the npm `cities.json` package.
- It writes compact records to `src/sat/assets/data/cities.json`.
- `builds/sat.json` copies that data to `dist/sat/assets/data/cities.json`.
- SAT fetches `assets/data/cities.json` at runtime and provides typeahead plus
  manual latitude/longitude entry.

For `flat`, do not directly couple to SAT internals. Either:

- promote reusable city index generation and city picker presentation into a
  shared location, or
- generate a `flat`-owned city index using the same source package and promote
  later after the reuse shape is stable.

The false-simulation feature should consume a selected observer record shaped
like:

```json
{
  "name": "London",
  "country": "GB",
  "admin1": "England",
  "lat": 51.5074,
  "lon": -0.1278
}
```

## Projection Helpers

Keep false-model math in testable helpers/models.

Use [ProjectionModel API Draft](projection-model-api.md) as the current
first-pass API contract for both the standard and flat/false simulations.

Although `ProjectionModel` is called a model, it is not a Polylith-style model
service. Implement it as a plain reusable utility/domain class under
`src/flat/shared/projection`.

Default to local implementation when the required math is simple enough. If the
math becomes more complex, consider a small focused npm module with minimal
transitive dependencies. Avoid pulling in a broad astronomy framework for the
first POC unless the scope clearly requires it.

Design the math with a stretch goal in mind: it may become a reusable package
published separately from this app. Keep it framework-free, deterministic,
well-documented, and isolated from React, Three.js, DOM APIs, and app services.
Prefer clear input/output data objects over hidden global state.

Shape the API so projection/model choices are swappable. The rendering code
should ask a projection model for derived positions instead of hard-coding one
azimuthal/dome mapping. That keeps the first false model replaceable and makes
it possible to add alternate projections or comparison models later without
rewriting the Three.js scene.

Avoid switch statements for supported projections. Projection implementations
should register/install themselves by role, and `ProjectionModel` should resolve
named Earth, celestial, and sky-surface projection implementations from those
registries.

Preferred utility class name: `ProjectionModel`.

`ProjectionModel` should represent the math contract, not rendering or app
flow. It can own projections for Earth coordinates, celestial coordinates, and
the mapping from projected sky coordinates onto a dome or other renderable
surface. Keep Earth and celestial projection choices independently specified so
the app can later combine different Earth and sky projection assumptions.

All calculations should be rooted at a source latitude/longitude. In the app
this is normally the selected observer city or manual observer coordinate. Both
real and flat/false projections should receive that root in their calculation
context.

Start POC development with San Jose, CA as the default root:

```js
{ lat: 37.3382, lon: -121.8863, name: 'San Jose', admin1: 'CA', country: 'US' }
```

The first POC render target is the sky at midnight at the start of May 22,
2026 for San Jose local time:

```text
2026-05-22T00:00:00-07:00
```

Example shape:

```js
const model = new ProjectionModel({
	root: { lat: 37.3382, lon: -121.8863, elevationMeters: 0 },
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
	options: {
		meanEarthRadiusKm: 6371.0088,
		earthProjectionRadiusKm: 20015.114442035923,
		domeRadiusKm: 20015.114442035923,
		referenceTime: '2026-05-22T00:00:00-07:00',
	},
});
```

Needed helpers:

- latitude/longitude to azimuthal equidistant Earth x/y
- right ascension/declination to false celestial projection x/y
- projected celestial x/y to a point on the underside of the sky dome
- magnitude to star size/brightness

These helpers should not depend on React or Three.js.

### False Celestial Projection Math

Use a north-celestial-pole-centered azimuthal equidistant projection as the
initial POC convention.

For a star with right ascension `raDeg` and declination `decDeg`:

```text
ra = radians(raDeg)
dec = radians(decDeg)
ra0 = radians(referenceRightAscensionDeg)

theta = ra - ra0
c = pi / 2 - dec
rho = skyProjectionScale * c

x = rho * sin(theta)
y = rho * cos(theta)
```

Where:

- `c` is angular distance from the north celestial pole
- `rho` is projected distance from the dome centerline
- `ra0` is the reference meridian/rotation of the false sky, and can later be
  driven by time or a manual rotation control
- north celestial pole maps to `rho = 0`
- celestial equator maps to `rho = skyProjectionScale * pi / 2`
- south celestial pole maps to `rho = skyProjectionScale * pi`

For the first POC, scale the projected sky disc onto the dome by choosing a
maximum angular radius:

```text
cMax = pi
r = domeRadiusKm * clamp(c / cMax, 0, 1)
```

Then lift the projected point onto the underside of an upper hemisphere:

```text
ux = sin(theta)
uy = cos(theta)

domeX = r * ux
domeZ = -r * uy
domeY = sqrt(domeRadiusKm^2 - r^2)
```

In Three.js this point is placed on the upper hemisphere surface; rendering the
inside/underside is a material/camera concern. If the full celestial sphere
being squeezed into one hemisphere is too visually compressed, use
`cMax = pi / 2` to put only the north celestial hemisphere on the dome and
treat southern declinations as outside/edge cases for the first POC.

## Controls

Start with focused controls only:

- city/observer picker
- manual latitude/longitude fallback
- magnitude limit
- dome opacity or wireframe toggle
- Earth grid toggle
- observer marker toggle

Defer standard-sky comparison controls until the standard viewer feature
exists.

## Verification

Run focused syntax checks for non-JSX implementation files, then run the app
build for JSX/build registration.

Use the app-local test entry for projection/unit specs:

```text
npm run test:ui:flat
```

or the build-only test bundle smoke check:

```text
npx polylith test flat
```

`npm run test:ui:flat` uses `karma.flat.conf.cjs`, which loads only the flat
test bundle at `tests/flat.js`.

Use browser or screenshot checks for the Three.js canvas:

- render is nonblank
- Earth disc and sky dome are visible and framed
- star points are visible
- controls update the scene
- layout works at desktop and mobile sizes

## Documentation

After implementation steps, update `agents/topics/flat/README.md` with:

- what changed
- what was verified
- what remains next

Keep stale future/planned wording out of the topic docs once features become
current behavior.
