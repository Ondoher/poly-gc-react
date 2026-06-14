# CPU Spectral Reference Integrator Design

This document designs the slow truth engine for the atmosphere reset. It is a
focused companion to the project-level [Atmosphere Reset Design](design.md).

## Purpose

The CPU spectral reference integrator answers one question:

```text
Given a world model, atmosphere model, solar source, observer, and camera ray,
what spectral radiance reaches the camera?
```

It should be slow, explicit, deterministic, and heavily diagnosed. It is not
the production renderer. It is the reference that production shaders, display
bridges, and shortcuts must be compared against.

The first implementation should live under:

```text
scripts/flat/atmosphere-reference/
```

This keeps the truth engine outside app runtime code while we are still
validating contracts. Later, proven pure helpers can be promoted into
`src/flat/shared` if app reuse becomes necessary.

## Non-Goals

- It is not optimized for frame-rate rendering.
- It does not own React, Three.js, render targets, or browser capture.
- It does not tune screenshots.
- It does not hide missing physics behind display multipliers.
- It does not implement multiple scattering in the first pass.

## Inputs

The integrator takes an immutable request object:

```text
{
  model,
  observer,
  ray,
  wavelengthsNm,
  numerical,
  output
}
```

Where:

- `model.world` answers surface/altitude/up questions.
- `model.atmosphere` answers volume, density, extinction, and scattering
  questions.
- `model.solarSource` answers distant-Sun or local finite-Sun source questions.
- `model.surface` answers material reflection for surface hits.
- `observer.positionKm` is the camera origin in model coordinates.
- `ray.direction` is normalized.
- `wavelengthsNm` is the spectral sample grid.
- `numerical` contains only approximation controls.
- `output` selects diagnostics and optional display conversion details.

## Model Interface

The integrator must depend on behavior, not world type names.

```text
world.altitudeAt(positionKm) -> km
world.upAt(positionKm) -> unit vector
world.intersectSurface(ray) -> hit | null
world.surfaceNormalAt(hit) -> unit vector

atmosphere.intersect(ray) -> { tMinKm, tMaxKm } | null
atmosphere.contains(positionKm) -> boolean
atmosphere.densityAt(positionKm, species) -> unitless density
atmosphere.extinctionAt(positionKm, wavelengthNm) -> extinction coefficients
atmosphere.scatteringAt(positionKm, wavelengthNm) -> scattering coefficients

solarSource.samplesAt(positionKm, wavelengthNm, numerical) -> source samples
solarSource.transmittanceSegment(samplePositionKm, sourceSample) -> optional

surface.radianceAt(hit, wavelengthNm, lighting) -> spectral radiance
```

The globe adapter and flat/local-Sun adapter implement these interfaces. The
integrator should not contain `if globe` or `if flat` branches.

## Units

Public quantities use these units:

- position/distance: kilometers
- wavelength: nanometers
- spectral radiance: `W / m2 / sr / nm`
- spectral irradiance: `W / m2 / nm`
- extinction/scattering: `1 / km`
- optical depth: unitless
- transmittance: unitless `[0, 1]`

Internal helper names should carry units where ambiguity is likely, such as
`distanceKm`, `wavelengthNm`, and `spectralRadianceWm2SrNm`.

## Numerical Controls

Numerical controls are not physical constants. They should be grouped and
reported separately:

```text
{
  viewSteps,
  sunTransmittanceSteps,
  diffuseSkyHemisphereSamples,
  finiteSunSamples,
  minStepKm,
  maxStepKm,
  integrationMethod
}
```

Initial defaults:

- fixed midpoint integration for view rays
- fixed midpoint integration for sample-to-source transmittance
- single directional sample for distant Sun
- small-disk approximation for local finite Sun
- hemisphere diffuse sky disabled until direct/single scattering is trusted

## Output

The integrator returns a diagnostic result:

```text
{
  wavelengthsNm,
  spectralRadiance,
  xyz,
  linearRgb,
  components: {
    surfaceRadiance,
    directSurfaceRadiance,
    diffuseSurfaceRadiance,
    rayleighInScattering,
    mieInScattering,
    absorberLoss
  },
  opticalDepth: {
    viewByWavelength,
    sunByWavelength,
    rayleighViewByWavelength,
    mieViewByWavelength,
    absorberViewByWavelength
  },
  transmittance: {
    viewByWavelength,
    sunByWavelength
  },
  geometry: {
    viewDistanceKm,
    atmosphereEntryKm,
    atmosphereExitKm,
    surfaceHit,
    sampleCount,
    sunSamples,
    scatteringAngles
  },
  numerical
}
```

`linearRgb` should be a derived convenience output from the spectral result.
The spectral radiance and diagnostics are the source of truth.

## Algorithm

For one ray:

1. Normalize and validate the request.
2. Intersect the ray with the active atmosphere volume.
3. Intersect the ray with the active surface.
4. Choose the view integration end:
   - surface hit distance if the surface is inside the atmosphere segment
   - atmosphere exit distance for sky rays
5. Initialize spectral accumulators for each wavelength.
6. March along the view ray using the selected numerical method.
7. At each view sample:
   - compute altitude and densities
   - compute local extinction and scattering coefficients
   - update or compute camera-to-sample optical depth
   - request solar-source samples for this position and wavelength
   - integrate sample-to-source optical depth for each source sample
   - compute source transmittance
   - compute Rayleigh and Mie phase terms
   - accumulate in-scattered spectral radiance
8. If the ray hits a surface:
   - compute direct irradiance from the same solar source and transmittance
   - compute diffuse sky irradiance only when that subsystem is enabled
   - ask the surface model for reflected spectral radiance
   - attenuate surface radiance by camera-to-surface transmittance
9. Sum surface radiance and in-scattered radiance.
10. Convert spectral radiance to CIE XYZ.
11. Convert XYZ to linear RGB.
12. Return radiance, color, diagnostics, and numerical metadata.

## Transmittance

Optical depth:

```text
tau(lambda) = integral beta_t(position, lambda) ds
```

Transmittance:

```text
T(lambda) = exp(-tau(lambda))
```

The integrator should expose both optical depth and transmittance. Tests should
cover vacuum, homogeneous media, exponential slab analytic cases, and split-ray
multiplicativity.

## Single Scattering

Initial reference scattering:

```text
dL(lambda) =
  T_view(lambda)
  * [
      beta_R_sca(position, lambda) * P_R(cosTheta)
      + beta_M_sca(position, lambda) * P_M(cosTheta)
    ]
  * source(lambda)
  * T_source(lambda)
  * ds
```

For a distant Sun, `source(lambda)` is directional spectral irradiance at the
top of the atmosphere. For a local finite Sun, source contribution comes from
spectral radiance times the Sun's solid angle, with optional finite-disk
sampling later.

## Surface Contribution

For the first pass, surface reflection is Lambertian:

```text
L_surface(lambda) =
  albedo(lambda) / pi
  * (E_direct(lambda) * max(dot(normal, sunDirection), 0)
     + E_diffuse_sky(lambda))
```

`E_diffuse_sky` must eventually come from hemisphere integration of sky
radiance. A fixed fraction of removed direct sunlight is not part of the
reference design.

## Spectral To Color

The integrator converts spectral radiance to CIE XYZ:

```text
X = integral L(lambda) * x_bar(lambda) d_lambda
Y = integral L(lambda) * y_bar(lambda) d_lambda
Z = integral L(lambda) * z_bar(lambda) d_lambda
```

Then XYZ converts to linear RGB. Tone mapping, exposure, white balance, and
display transforms should be separate camera/display choices, not hidden inside
the atmosphere reference.

## Error Handling

Fail loudly for:

- missing model interfaces
- non-normalized ray direction beyond tolerance
- negative wavelength
- unsorted wavelength grid
- negative extinction/scattering coefficients
- atmosphere paths with infinite length and no named boundary
- local Sun requests where observer/sample lies inside the Sun radius
- invalid transmittance outside `[0, 1]` after numerical tolerance

## Test-First Contract

Before implementing each subsystem, write its tests:

- `analytic`: closed-form expected value
- `invariant`: physics property
- `reference-data`: external source comparison
- `cross-model`: globe and flat produce same result under same local
  conditions
- `shader-parity`: shader compared with trusted CPU reference

Shader parity comes last. The CPU reference must first pass analytic and
invariant tests for the quantity being compared.

## First Test Fixtures

Start with small fixtures that have known answers:

- Vacuum: all optical depths zero, all transmittance one.
- Homogeneous medium: `T = exp(-beta * distance)`.
- Exponential slab: vertical optical depth
  `beta0 * H * (1 - exp(-H_top / H))`.
- Phase normalization: Rayleigh and Mie integrate to one over solid angle.
- Zero source: no in-scattering.
- Zero scattering: no in-scattering.
- Black Lambertian surface: zero reflected surface radiance.
- Uniform sky radiance: hemisphere irradiance equals `pi * L`.
- Local Sun small-disk limit: solid angle approaches `pi * (R / d)^2`.

## Shader Parity Interface

The browser/shader side should expose deterministic probe rays in model
coordinates:

- ray origin
- ray direction
- surface/depth hit if applicable
- scene atmosphere/source settings
- shader linear RGB result before display tone mapping when possible

The parity harness compares those against CPU outputs with named tolerances.
It should store the CPU diagnostics beside any screenshot/capture so failures
explain themselves.

## Relationship To Current Code

This module may mine ideas from `src/flat/shared/Atmosphere.js`, but it should
not preserve its RGB transport assumptions or display bridge. Current shader
code is an approximation target to test after the reference exists.

The first implementation should be separate enough that deleting or rewriting
the current atmosphere composer would not delete the reference truth engine.
The current iteration is useful for architecture and naming clues, but the
script reference should be free to start fresh and clean up previous decisions.
