# Atmosphere Design

This document describes the current shared atmosphere model for the flat app's
atmosphere consumers, including `flat-simulation` and `globe-simulation`.

Atmosphere physics lives in shared framework-free code. Scene features resolve
observer, geometry, projection, and light-source assumptions into plain data.
Renderers consume that data to compose solid scene color with atmospheric
transmittance and in-scattered light.

Rejected atmosphere approaches live in [Atmosphere Rejected Ideas](atmosphere-rejected.md).

## Current Architecture

`src/flat/shared/Atmosphere.js` owns:

- atmosphere profile normalization
- flat-slab and spherical-shell altitude frames
- altitude, density, and optical-depth sampling
- transmittance conversion
- atmosphere-exit sampling
- Rayleigh and Mie scattering coefficients
- Rayleigh and Henyey-Greenstein Mie phase functions
- sample-to-light transmittance and shadow checks
- CPU-side single-scattering sampling
- shader-uniform-ready atmosphere data

`src/flat/shared/Sun.js` owns:

- directional and point light-source state
- resolved direction or position
- source color and intensity
- `solarIrradianceScale` for flat-simulation and legacy compatibility paths
- directional angular radius
- point-source physical radius
- apparent angular size from an observer or sample point
- shader-uniform-ready sun data

`src/flat/shared/math-primitives.js` owns the stateless vector, number, and
RGB helpers shared by the atmosphere and sun models.

`src/flat/shared/consts.js` owns shared atmosphere and sun constants. Shared
classes should export behavior, not duplicate canonical constants.

## Composition Contract

The current atmosphere renderer uses the same composition rule for sky and
solid scene pixels:

```text
finalPixel =
  sceneColor * cameraToSceneTransmittance
  + cameraRayInScattering
```

Solid pixels integrate atmosphere from the camera to the reconstructed depth.
No-depth sky pixels integrate to a renderer-provided background atmosphere
distance. Usage differences enter through named scene, frame, light, and
renderer settings rather than hidden shader branches.

## Ownership

Scene and light state own:

- selected time
- selected observer location
- geometry/model assumptions
- initial sun anchor
- sun motion model
- sun latitude, elevation, radius, or directional pose assumptions
- resolved sun direction or position
- light color and intensity
- source-radiance or source-irradiance assumptions

Atmosphere owns:

- altitude and density by frame
- extinction by wavelength
- optical depth and transmittance
- Rayleigh and Mie phase functions
- single-scattering integration along a view ray
- shadow tests against the atmosphere frame

Renderer owns:

- solid scene color and depth inputs
- per-pixel ray reconstruction
- background/no-depth integration caps
- sample-to-sun transmittance approximations used by real-time shaders
- renderer unit bridges
- display and material exposure controls
- nonphysical guide-overlay visibility

## Current Consumers

`flat-simulation` uses `FlatAtmosphereComposer` as the active atmosphere
renderer. It renders the solid false scene into color/depth textures,
reconstructs camera rays, integrates Rayleigh/Mie in-scattering from
`scene.lighting.atmosphereSun`, applies camera-ray transmittance, and composites
the result with the solid scene.

`flat-simulation` links the rendered false sun, `scene.lighting.sun`, and
`scene.lighting.atmosphereSun` to the same resolved `scene.sun` object. The
solid-scene facet uses the local point sun for floor, mountain, and object
lighting. The atmosphere facet uses the same resolved position, radius,
apparent size, and motion, plus the sun body's atmosphere radiance fields.

`globe-simulation` provides the spherical Three/R3F calibration scene. It
exposes a San Jose observer, fixed solar-noon Sun/Earth positioning for
`2026-06-13T13:07:44-07:00`, Earth axial tilt, date-derived sidereal rotation,
a `spherical-shell` atmosphere frame, and a featureless matte green globe
surface. The camera is at standing height above the San Jose `100 ft` surface
point, starts looking toward the Sun, and supports pointer/touch look-around
controls in the local San Jose frame. It reuses the
shared synthetic red mountain marker source from the flat simulation, projects
those markers by spherical bearing/distance on the San Jose surface, and
renders them as radius-sampled curved red faces. The marker faces start
`0.02 km` below the mathematical globe surface before rising through it; this
is a contact/depth stabilization inset so the marker bottom edge does not fight
the globe surface depth buffer. It also renders the 50 brightest
northern-celestial-hemisphere stars from the shared POC star fixture as a
daytime visibility calibration layer.

`GlobeAtmosphereComposer` renders the globe solid scene into color/depth
textures and applies the first spherical single-scattering composition pass.
It reconstructs sky rays from the camera basis, integrates solid pixels to the
depth hit, integrates no-depth sky pixels to the spherical atmosphere shell
exit, computes altitude as
`length(samplePosition - planetCenter) - planetRadiusKm`, and composes
radiometric solid-scene color attenuated by view transmittance plus radiometric
atmospheric in-scattering. The current shader is an initial real-time
calibration pass with 32 view samples and an air-mass-style sample-to-sun
transmittance approximation, not final photometric calibration. The combined
radiometric result then passes through the shared radiometric display bridge.
Runtime captures after Phase 4.4 show the star probe pixels sampling sky color,
but the sky remains muted blue-gray, the horizon can appear brown, and red
marker faces can become pink where atmosphere airlight overlays their surface
radiance. Those are the current calibration targets.

Shared observer-relative object placement lives in
`src/flat/shared/observer-relative-placement.js`. Placement frames describe the
active surface, not the observer eye position; returned object centers are
offset from the resolved surface point by half their height so placed objects
contact the flat or spherical surface.

## Parameter Catalog

This catalog lists current atmosphere, light, and renderer parameters. Some are
physical inputs. Some are explicit renderer or geometry abstractions. Some are
calibration bridges that should remain named honestly until replaced by a more
physical source model.

Atmosphere profile parameters:

- `id`: profile identifier.
- `topAltitudeKm`: atmosphere integration ceiling.
- `seaLevelDensityKgM3`: density normalization at ground level.
- `rayleighScaleHeightKm`: molecular density falloff height.
- `aerosolScaleHeightKm`: aerosol/Mie density falloff height.
- `aerosolOpticalDepth550nm`: aerosol optical depth at `550 nm`.
- `aerosolSingleScatteringAlbedo`: aerosol scattering fraction versus
  absorption.
- `aerosolAngstromExponent`: aerosol wavelength dependence.
- `rayleighBetaKm`: per-channel Rayleigh scattering coefficient.
- `mieBetaKm`: current/compatibility per-channel Mie coefficient.
- `mieStrength`: legacy Mie contribution scale.
- `mieExtinctionBetaKm`: derived or explicit per-channel aerosol extinction.
- `mieScatteringBetaKm`: derived or explicit aerosol scattering component.
- `mieAbsorptionBetaKm`: derived aerosol absorption component.
- `mieAnisotropy`: Henyey-Greenstein forward-scattering parameter.
- `airlightColor`: legacy/display-oriented atmosphere color hint.
- `maxAirlight`: legacy/display-oriented airlight clamp.
- `integrationSteps`: default CPU/profile integration step count.

Atmosphere frame parameters:

- `frame.kind`: `flat-slab` or `spherical-shell`.
- `frame.origin`: flat-slab origin.
- `frame.up`: flat-slab vertical direction.
- `frame.planetCenter`: spherical-shell planet center.
- `frame.planetRadiusKm`: spherical-shell ground radius.

Sampling and integration parameters:

- `steps`: per-call view-ray optical-depth/scattering sample count.
- `lightSteps`: per-call sample-to-light transmittance sample count.
- `maxLightDistanceKm`: per-call cap for sample-to-light integration.
- `light`: explicit scattering light override.
- `sun`: legacy name for the scattering light override.

Sun and light-source parameters:

- `kind`: `directional` or `point`.
- `direction`: world-space direction for directional sunlight.
- `position`: world-space position for point sunlight.
- `radiusKm`: physical/source radius.
- `distanceKm`: observer/sample-to-source distance where resolved.
- `angularRadiusRad`: fixed apparent angular radius for directional sources.
- `apparentAngularRadiusRad`: resolved point-source apparent angular radius.
- `apparentAngularDiameterRad`: resolved point-source apparent angular diameter.
- `color`: RGB source color.
- `intensity`: generic scene-light strength.
- `solarIrradianceScale`: flat-simulation and compatibility atmosphere
  source-strength bridge.
- `anchor`: assumption/status record for the chosen source.

Current globe solar-source note fields:

- `source.model`: currently `approximate-real-solar-system`.
- `source.totalSolarIrradianceWm2`: total solar irradiance at one astronomical
  unit.
- `source.colorTemperatureK`: blackbody/color-temperature approximation.
- `source.targetDirectNormalIrradianceWm2AtReferencePoint`: reference daylight
  target for comparison.
- `source.astronomicalUnitKm`: reference distance for total solar irradiance.
- `source.diffuseSkyIrradianceLossFraction`: first approximation for how much
  removed direct irradiance is treated as diffuse sky irradiance.
- `source.rendererIrradianceReferenceWm2`: temporary renderer bridge reference
  that now seeds the globe display scale as
  `1 / rendererIrradianceReferenceWm2`.
- `source.rendererBridge`: names the temporary bridge and marks it for removal
  after the display and surface-lighting pipeline is fully radiometric.

Current globe solar irradiance probes:

- `sun.irradiance.topOfAtmosphereIrradianceWm2`: distance-adjusted solar
  irradiance at the top of the atmosphere.
- `sun.irradiance.directNormalIrradianceAtObserverWm2`: direct irradiance at the
  observer after current atmosphere transmittance.
- `sun.irradiance.directHorizontalIrradianceAtObserverWm2`: direct irradiance on
  a horizontal surface at the observer.
- `sun.irradiance.estimatedDiffuseSkyIrradianceWm2`: first diffuse-sky
  irradiance estimate.
- `sun.irradiance.relativeAirMass`: Kasten-Young relative air mass estimate.
- `sun.irradiance.visibleTransmittance`: luminance-weighted direct-sun
  transmittance.
- `sun.irradiance.transmittance`: per-channel direct-sun transmittance.
- `sun.irradiance.opticalDepth`: per-channel direct-sun optical depth.
- `sun.irradiance.renderer.atmosphereSourceScale`: legacy compatibility probe
  equal to
  `topOfAtmosphereIrradianceWm2 / rendererIrradianceReferenceWm2`. The globe
  composer no longer consumes it as the atmosphere source term.

Current globe display settings:

- `display.model`: currently `radiometric-display-v1`.
- `display.radiometricToSceneRgbScale`: converts atmosphere radiometric output
  into scene-linear display RGB. The current globe default is
  `1 / source.rendererIrradianceReferenceWm2`.
- `display.exposure`: display/viewer exposure multiplier.
- `display.toneMapping`: display curve, currently `reinhard` for the globe
  calibration scene.

Current flat local-sun radiance bridge:

- `falseSunRadiance.model`: currently `point-inverse-square-reference`.
- `falseSunRadiance.referenceDistanceKm`: distance where local point-source
  intensity is interpreted as the configured radiance reference value.
- `falseSunRadiance.distanceFalloff`: whether inverse-square falloff is applied.

Current renderer and composition parameters:

- `enabled`: atmosphere composition toggle.
- `model`: atmosphere renderer/model contract name.
- `rendering.status`: current renderer status label.
- `rendering.target`: intended composition target.
- `debugMode`: `none`, `ray-length`, `optical-depth`, `scattering`, or
  `phase-angle`.
- `backgroundAtmosphereViewDistanceKm`: no-depth sky integration cap.
- `flatSlabHorizonViewDistanceFactor`: flat-slab near-horizon path-length
  taper.
- `sampleToSunTransmittanceModel`: `none`, `light-march`, or `air-mass`.
- `sampleToSunTransmittanceSteps`: light-march step count.
- `threeLightUnitScale`: bridge into Three.js light units.
- `skyDiffuseIrradianceScale`: current diffuse-sky illumination approximation
  for lit solid materials.
- `starExposure`: renderer/material exposure for star points before atmosphere
  composition.
- `constellationOverlayExposure`: nonphysical guide-overlay visibility.

Surface and terrain lighting inputs:

- `floorAlbedo`: local floor reflectance.
- map or terrain texture albedo: content-derived surface reflectance.
- surface normal: direct-light incidence direction.
- direct irradiance terms: sunlight reaching the surface from the resolved
  source and transmittance.
- diffuse sky irradiance terms: currently approximated by
  `skyDiffuseIrradianceScale`.

## Current Defaults

`STANDARD_EARTH_ATMOSPHERE`:

```js
{
	id: 'earth-standard',
	topAltitudeKm: 100,
	seaLevelDensityKgM3: 1.225,
	rayleighScaleHeightKm: 8.5,
	aerosolScaleHeightKm: 1.2,
	aerosolOpticalDepth550nm: 0.12,
	aerosolSingleScatteringAlbedo: 0.95,
	aerosolAngstromExponent: 1.3,
	rayleighBetaKm: { r: 0.005802, g: 0.013558, b: 0.0331 },
	mieBetaKm: { r: 0.003996, g: 0.003996, b: 0.003996 },
	mieStrength: 0.35,
	mieAnisotropy: 0.8,
	airlightColor: '#9fc7ff',
	maxAirlight: 0.85,
	integrationSteps: 16,
}
```

`CLEAR_DAY_EARTH_ATMOSPHERE` is the active flat/globe calibration profile. It
inherits the standard profile and currently overrides:

```js
{
	id: 'earth-clear-day',
	rayleighScaleHeightKm: 8.0,
	aerosolOpticalDepth550nm: 0.08,
	aerosolSingleScatteringAlbedo: 0.95,
	aerosolAngstromExponent: 1.3,
}
```

`STANDARD_SUN`:

```js
{
	kind: 'directional',
	direction: { x: 0, y: 1, z: 0 },
	color: { r: 1, g: 0.96, b: 0.88 },
	intensity: 1,
	solarIrradianceScale: 1,
	angularRadiusRad: 0.00465,
	radiusKm: 696340,
	anchor: { kind: 'known-value', status: 'open' },
}
```

`flat-simulation` atmosphere rendering:

```js
{
	enabled: true,
	model: 'shared-atmosphere',
	frame: FLAT_ATMOSPHERE_FRAME,
	profile: CLEAR_DAY_EARTH_ATMOSPHERE,
	rendering: {
		status: 'depth-aware-composer-clear-day-atmosphere',
		target: 'depth-aware-composition',
		debugMode: 'none',
		falseSunRadiance: {
			model: 'point-inverse-square-reference',
			referenceDistanceKm: 4800,
			distanceFalloff: true,
		},
		threeLightUnitScale: 0.04,
		skyDiffuseIrradianceScale: 0.35,
		sampleToSunTransmittanceModel: 'air-mass',
		sampleToSunTransmittanceSteps: 4,
		backgroundAtmosphereViewDistanceKm: 100,
		flatSlabHorizonViewDistanceFactor: 0.25,
		starExposure: 0.02,
		constellationOverlayExposure: 0.04,
	},
}
```

`flat-simulation` false sun:

```js
{
	id: 'false-sun',
	kind: 'surface-altitude-sun',
	lat: 24,
	lon: 58.1137,
	altitudeKm: 3000 * KM_PER_MILE,
	radiusKm: (32 * KM_PER_MILE) / 2,
	light: {
		kind: 'point',
		color: { r: 1, g: 0.82, b: 0.55 },
		intensity: 64,
	},
	atmosphere: {
		color: { r: 1, g: 0.98, b: 0.95 },
		intensity: 1,
		solarIrradianceScale: 58,
	},
}
```

`globe-simulation` solar-source notes:

```js
{
	model: 'approximate-real-solar-system',
	totalSolarIrradianceWm2: 1361,
	colorTemperatureK: 5778,
	targetDirectNormalIrradianceWm2AtReferencePoint: 1000,
	astronomicalUnitKm: 149597870.7,
	diffuseSkyIrradianceLossFraction: 0.5,
	rendererIrradianceReferenceWm2: 340.25,
	rendererBridge: {
		model: 'temporary-irradiance-to-scattering-source-scale',
		status: 'replace-with-display-exposure-in-phase-4',
	},
}
```

`globe-simulation` display bridge:

```js
{
	model: 'radiometric-display-v1',
	radiometricToSceneRgbScale: 1 / 340.25,
	exposure: 1,
	toneMapping: 'reinhard',
}
```

## Current Scattering Calculation

For each view-ray atmosphere sample:

```text
samplePosition = cameraOrigin + viewDirection * sampleDistance
rayleighDensity = exp(-altitudeKm / rayleighScaleHeightKm)
aerosolDensity = exp(-altitudeKm / aerosolScaleHeightKm)
viewTransmittance = exp(-cameraToSampleOpticalDepth)
lightTransmittance = sampleToLightTransmittance(samplePosition, light)
cosTheta = dot(viewDirectionFromSampleToCamera, sampleToLightDirection)
```

Rayleigh phase:

```text
rayleighPhase(cosTheta) =
  3 / (16 * pi) * (1 + cosTheta^2)
```

Mie phase:

```text
miePhase(cosTheta, g) =
  (1 - g^2)
  / (4 * pi * (1 + g^2 - 2 * g * cosTheta)^(3 / 2))
```

Current flat/legacy source term:

```text
sourceRgb = light.color * light.solarIrradianceScale
```

Current globe atmosphere source term:

```text
sourceRgb =
  sun.color
  * sun.irradiance.topOfAtmosphereIrradianceWm2
```

For point sunlight with the current flat local-sun bridge:

```text
if falseSunRadiance.distanceFalloff:
  sourceRgb *= (falseSunRadiance.referenceDistanceKm / sampleToSunDistanceKm)^2
```

Per-sample in-scattering contribution:

```text
scatteringRgb =
  sourceRgb
  * lightTransmittance
  * (
      rayleighBetaKm * rayleighDensity * rayleighPhase
      + mieScatteringBetaKm * aerosolDensity * miePhase
    )

cameraContributionRgb =
  scatteringRgb
  * viewTransmittance
  * stepDistanceKm
```

The accumulated view-ray result is:

```text
inScatteredLight = sum(cameraContributionRgb)
sceneTransmittance = exp(-cameraToSceneOpticalDepth)
```

In the current globe shader, the globe surface and synthetic mountain marker
faces are already written to the solid-scene target as radiance:

```text
surfaceRadiance =
  albedoRgb
  * (
      directNormalIrradianceAtObserverWm2
      * max(dot(surfaceNormal, sampleToSunDirection), 0)
      + estimatedDiffuseSkyIrradianceWm2
    )
  / pi
```

The current globe display boundary is:

```text
finalRadiometric =
  sceneRadiance * sceneTransmittance
  + inScatteredLight

finalPixel =
  toneMap(
    finalRadiometric
    * display.radiometricToSceneRgbScale
    * display.exposure
  )
```

The globe solid-scene target uses linear half-float color so surface radiance
can exceed display white before the final display mapping.

## Current Transmittance Approximations

CPU atmosphere sampling can march sample-to-light paths through the selected
frame. The current real-time flat-simulation shader uses the `air-mass`
sample-to-sun approximation by default:

```text
verticalOpticalDepth = opticalDepthFromSampleAltitudeToAtmosphereTop
airMass = 1 / max(dot(sampleToSunDirection, frameUp), minimumSunLift)
sampleToSunOpticalDepth = verticalOpticalDepth * airMass
sampleToSunTransmittance = exp(-sampleToSunOpticalDepth)
```

The shader still supports `sampleToSunTransmittanceModel: 'light-march'` with
`sampleToSunTransmittanceSteps`, and `none` for diagnostic comparison.

For flat-slab no-depth sky pixels:

```text
skyDistance = backgroundAtmosphereViewDistanceKm
nearHorizonSkyDistance =
  backgroundAtmosphereViewDistanceKm * flatSlabHorizonViewDistanceFactor
```

The flat-slab horizon factor is a renderer/geometry abstraction, not a physical
atmosphere profile value.

## Surface Illumination

Flat-simulation lit solid materials currently receive:

- direct local sunlight through `scene.lighting.sun`
- point-source inverse-square falloff when the local false-sun bridge is active
- a Three.js light-unit conversion through `threeLightUnitScale`
- broad diffuse skylight approximation through `skyDiffuseIrradianceScale`

The local observer floor uses a scrub/ground albedo of `[0.15, 0.18, 0.11]`.
The global projected Earth map samples raster color as albedo. Both are meant
to be lit surfaces that then pass through atmosphere composition.

Globe-simulation lit surface markers currently receive:

- direct solar irradiance from
  `sun.irradiance.directNormalIrradianceAtObserverWm2`
- estimated diffuse sky irradiance from
  `sun.irradiance.estimatedDiffuseSkyIrradianceWm2`
- matte Lambertian albedo from the globe surface or marker color
- final display mapping only after atmosphere transmittance and in-scattering
  have been applied
- a `0.02 km` lower-edge visual inset for marker faces so the rendered marker
  contact line is not coplanar with the rendered globe mesh

## Celestial Objects

Stars, constellation guide overlays, and the visible sun body are ordinary scene
objects in the depth-aware composer. Their rendered colors pass through the
same composition rule as terrain and other objects.

Current daytime visibility controls:

- `starExposure: 0.02`
- `constellationOverlayExposure: 0.04`

These are renderer/material controls applied before atmosphere composition.
Constellation lines are guide overlays, not physical light sources.

## Current Calibration Stance

The flat model defaults should use Earth-like physical values wherever the
model claims to share real-world physics: atmosphere composition, aerosol
profile, solar spectrum notes, surface albedo, and daylight irradiance targets.

The false-model assumptions should remain explicit: flat surface geometry,
finite local sun position/path, configured false sun radius, and configured
false sun distance. The spherical/correct-geometry model is the calibration
target for atmosphere tuning; the flat model should reuse the same named
physical inputs and reveal geometry-driven consequences.

## Current Gaps

- `solarIrradianceScale` remains a flat-simulation and compatibility
  source-strength bridge. `globe-simulation` no longer consumes it in the
  atmosphere shader source term, but the legacy derived probe still exists
  until downstream consumers stop depending on it.
- `threeLightUnitScale` is a renderer unit bridge into Three.js lighting.
- `skyDiffuseIrradianceScale` approximates diffuse sky irradiance but is not
  yet computed from the atmosphere model.
- `falseSunRadiance` is a local finite-source inspection bridge, not a fully
  calibrated physical false-sun energy model.
- `globe-simulation` has the first spherical atmosphere rendering path,
  physical irradiance probes, and radiometric globe surface/marker lighting,
  but sky color is still muted blue-gray, the horizon can look brown, and red
  markers can shift toward pink under atmosphere airlight. The next calibration
  should diagnose the spherical shader/display path, especially Rayleigh/Mie
  balance, phase-angle convention, horizon path length, and tone mapping.
- Star brightness in the globe view still uses a renderer point-size/exposure
  path rather than a shared photometric-to-display path.
