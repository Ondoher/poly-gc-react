# ProjectionModel API Draft

This is a first-pass API contract for the math layer used by both the standard
sky simulation and the flat/false simulation.

The API should stay framework-free and renderer-independent. It returns plain
data objects, not React components, DOM nodes, or Three.js classes.

## Goals

- Support both real and flat/false simulations.
- Keep Earth projection, celestial projection, and sky-surface mapping
  independently configurable.
- Let rendering code ask for derived positions without knowing which projection
  model is active.
- Let projection implementations install/register themselves instead of adding
  switch statements for every supported projection.
- Root all calculations at a source latitude/longitude, usually the selected
  observer location.
- Support a flat apparent-position mode where celestial objects are placed in
  the flat scene from their real observer-relative apparent azimuth/altitude,
  rather than from the intentionally false celestial projection.
- Keep the math isolated enough to become a standalone reusable package later.
- Preserve source coordinates in results for debugging and inspection.

## Naming

Preferred class name:

```js
ProjectionModel
```

The class represents a configured projection contract, not a scene engine.
Although it is called a model, it is not a Polylith-style registry-backed
model service. Implement it as a plain reusable class under
`src/flat/shared/projection`.

`ProjectionModel` should not contain a switch statement for each supported
projection. It should resolve named projection implementations from registries.

## Projection Registration

Use small projection implementation objects that install themselves into a
registry. Keep separate registries for each projection role so an Earth
projection cannot be accidentally used as a sky-surface mapping.

Conceptual shape:

```js
ProjectionModel.registerEarthProjection(northPoleAzimuthalEquidistantEarth());
ProjectionModel.registerCelestialProjection(northCelestialPoleAzimuthalEquidistantSky());
ProjectionModel.registerSkySurfaceProjection(upperHemisphereRadialLiftSurface());
```

Each projection implementation declares an id and calculation methods:

```js
const projection = {
	id: 'north-pole-azimuthal-equidistant',
	role: 'earth',
	project(point, context) {
		return {
			projected: { x: 0, y: 0, radius: 0, theta: 0 },
			visible: true,
			metadata: {},
		};
	},
};
```

Suggested roles:

- `earth`
- `celestial`
- `sky-surface`

`ProjectionModel` constructor resolves the named implementations:

```js
class ProjectionModel {
	constructor(options) {
		this.earthProjection = ProjectionModel.earthProjections.get(options.earthProjection);
		this.celestialProjection = ProjectionModel.celestialProjections.get(options.celestialProjection);
		this.skySurfaceProjection = ProjectionModel.skySurfaceProjections.get(options.skySurfaceProjection);
	}
}
```

The implementation should fail loudly when a requested projection id is not
registered.

```js
new ProjectionModel({
	earthProjection: 'missing-projection',
});
// throws: Unknown earth projection "missing-projection".
```

This keeps new projections additive:

```text
add projection implementation file
-> export/install it through a projection package/index
-> use its id in ProjectionModel config
```

No existing `ProjectionModel` dispatch code should need to change when a new
projection is added.

## Constructor

```js
const model = new ProjectionModel({
	id: 'flat-north-pole-dome',
	root: {
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 0,
	},
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
	units: 'km',
	options: {
		meanEarthRadiusKm: 6371.0088,
		earthProjectionRadiusKm: 20015.114442035923,
		domeRadiusKm: 20015.114442035923,
		referenceRightAscensionDeg: 0,
		referenceTime: '2026-05-22T00:00:00-07:00',
	},
});
```

For a standard/real view:

```js
const model = new ProjectionModel({
	id: 'standard-local-horizon',
	root: {
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 0,
	},
	earthProjection: 'wgs84',
	celestialProjection: 'local-horizontal',
	skySurfaceProjection: 'unit-sky-dome',
	options: {
		referenceTime: '2026-05-22T00:00:00-07:00',
	},
});
```

## Core Input Types

```js
const observer = {
	id: 'san-jose-ca-us',
	name: 'San Jose',
	country: 'US',
	admin1: 'CA',
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 0,
};

const star = {
	id: 'HIP 32349',
	name: 'Sirius',
	raDeg: 101.287,
	decDeg: -16.716,
	magnitude: -1.46,
	source: 'hipparcos',
};
```

## Root Context

All calculations are rooted at a source latitude/longitude. In the app this is
normally the selected observer city or manual observer coordinates.

The root does not have to mean the same thing for every projection:

- standard/real simulations use it as the observer location for local horizon
  and sky calculations
- flat/false simulations use it as the viewer's source location on the
  projected Earth model
- future terrain calculations can use it as the center of the local terrain
  window and horizon profile

Constructor config should accept `root`, and the model should expose explicit
root setters/getters:

```js
model.setRoot({
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 0,
});

const root = model.getRoot();
```

Projection implementations receive the root through their context object:

```js
const context = {
	root: model.getRoot(),
	time: model.getTime(),
	options: model.getOptions(),
};
```

## Core Methods

### `setRoot(root)`

Set the source latitude/longitude used as the root for all calculations.

```js
model.setRoot(observer);
```

Returns the model instance so calls can chain.

### `getRoot()`

Return the current root/source location.

```js
const root = model.getRoot();
```

### `setObserver(observer)`

Alias or convenience method for `setRoot(observer)`. This name is useful in UI
code, but projection math should treat the value as the root context.

### `setTime(time)`

Set the time or time-like rotation state used by projections that need it.

```js
model.setTime(new Date('2026-05-22T00:00:00-07:00'));
```

For false simulations, this may only update a reference rotation such as
`referenceRightAscensionDeg`.

The first POC default is midnight at the start of May 22, 2026 for San Jose,
CA local time:

```text
2026-05-22T00:00:00-07:00
```

### `projectEarthPoint(point)`

Project a latitude/longitude point into model coordinates.

```js
const result = model.projectEarthPoint({
	lat: 51.5074,
	lon: -0.1278,
	elevationMeters: 0,
});
```

Returns:

```js
{
	kind: 'earth-point',
	position: { x: 0, y: 0, z: 0 },
	projected: { x: 0, y: 0, radius: 0, theta: 0 },
	visible: true,
	source: { lat: 51.5074, lon: -0.1278, elevationMeters: 0 },
	metadata: {}
}
```

### `projectObserver(observer?)`

Project the active observer or a provided observer.

```js
const observerResult = model.projectObserver();
```

Returns the same shape as `projectEarthPoint`, with `kind: 'observer'`.

When no observer is passed, this projects the current root.

### `projectCelestialPoint(point)`

Project right ascension/declination into the configured celestial projection.

```js
const result = model.projectCelestialPoint({
	raDeg: 101.287,
	decDeg: -16.716,
});
```

Returns:

```js
{
	kind: 'celestial-point',
	projected: { x: 0, y: 0, radius: 0, theta: 0 },
	horizontal: { azimuthDeg: 0, altitudeDeg: 0 },
	visible: true,
	source: { raDeg: 101.287, decDeg: -16.716 },
	metadata: {}
}
```

`horizontal` may be `null` for projection models that do not compute local
altitude/azimuth. When computed, it should be rooted at `model.getRoot()`.

### `projectSkyToSurface(projectedPoint)`

Map a projected celestial point onto the configured sky surface.

```js
const surfacePoint = model.projectSkyToSurface(result.projected);
```

Returns:

```js
{
	kind: 'sky-surface-point',
	position: { x: 0, y: 0, z: 0 },
	normal: { x: 0, y: -1, z: 0 },
	visible: true,
	metadata: {}
}
```

### `projectStar(star)`

Project a star from catalog coordinates through the celestial projection and
sky-surface mapping.

```js
const result = model.projectStar(star);
```

Returns:

```js
{
	kind: 'star',
	id: 'HIP 32349',
	name: 'Sirius',
	position: { x: 0, y: 0, z: 0 },
	projected: { x: 0, y: 0, radius: 0, theta: 0 },
	horizontal: { azimuthDeg: 0, altitudeDeg: 0 },
	visible: true,
	style: {
		size: 1,
		brightness: 1,
		color: '#ffffff',
	},
	source: {
		raDeg: 101.287,
		decDeg: -16.716,
		magnitude: -1.46,
		source: 'hipparcos',
	},
	metadata: {}
}
```

### `projectStars(stars)`

Project a list of stars.

```js
const starResults = model.projectStars(stars);
```

Returns an array of `projectStar` results.

### `describe()`

Return a serializable description of the configured model.

```js
const description = model.describe();
```

Returns:

```js
{
	id: 'flat-north-pole-dome',
	root: { lat: 37.3382, lon: -121.8863, elevationMeters: 0 },
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
	options: {}
}
```

## Projection Names

Initial names:

- `wgs84`
- `north-pole-azimuthal-equidistant`
- `local-horizontal`
- `north-celestial-pole-azimuthal-equidistant`
- `unit-sky-dome`
- `upper-hemisphere-radial-lift`

These names should be treated as public API once implementation stabilizes.

## Suggested File Shape

For an app-local first pass:

```text
src/flat/shared/projection/
  ProjectionModel.js
  index.js
  earth/
    north-pole-azimuthal-equidistant.js
    wgs84.js
  celestial/
    local-horizontal.js
    north-celestial-pole-azimuthal-equidistant.js
  sky-surface/
    unit-sky-dome.js
    upper-hemisphere-radial-lift.js
```

`index.js` owns installing the built-in projections:

```js
import ProjectionModel from './ProjectionModel.js';
import { northPoleAzimuthalEquidistantEarth } from './earth/north-pole-azimuthal-equidistant.js';

ProjectionModel.registerEarthProjection(northPoleAzimuthalEquidistantEarth());

export { ProjectionModel };
```

If this becomes a separate package, the same install pattern can become the
package entrypoint.

## Standard Simulation Shape

The standard simulation can use:

```js
new ProjectionModel({
	root: observer,
	earthProjection: 'wgs84',
	celestialProjection: 'local-horizontal',
	skySurfaceProjection: 'unit-sky-dome',
});
```

This model should eventually compute real local azimuth/altitude from observer,
time, and RA/Dec, then map visible sky objects to a local sky dome.

## Flat Apparent-Position Shape

A later flat mode should keep the flat scene/floor presentation while placing
celestial objects from their real apparent positions relative to the selected
observer and time:

```js
new ProjectionModel({
	root: observer,
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'local-horizontal',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
});
```

This mode should compute true local azimuth/altitude from each object's
catalog/ephemeris coordinates, then map that apparent position into the flat
scene. It is not the same as the first false simulation: the floor and scene
presentation remain flat, but celestial-object placement is anchored to what
the observer would actually see in the sky.

## Flat / False Simulation Shape

The first false simulation can use:

```js
new ProjectionModel({
	root: observer,
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
});
```

This model should project Earth and the celestial sphere through separate
azimuthal equidistant projections, then map the projected sky onto the underside
of a half-sphere dome.

The first POC target is to render the sky for San Jose, CA at midnight local
time on May 22, 2026.

## Open Design Points

- Whether `ProjectionModel` should be mutable with `setObserver()` /
  `setTime()` or immutable with `.withObserver()` / `.withTime()`.
- Whether constructor config should accept registered projection ids only, or
  also accept direct projection objects for tests and experiments.
- How much standard-sky astronomy math belongs in this package versus a later
  optional dependency.
- How to represent objects that fall outside a projection domain.
- How to expose terrain/local horizon data later without making it mandatory
  for the first POC.
- What sky-surface mapping best fits flat apparent-position mode once real
  local azimuth/altitude is available.
