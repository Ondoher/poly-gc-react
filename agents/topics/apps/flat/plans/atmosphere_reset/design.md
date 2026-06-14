# Atmosphere Reset Design

This design turns the atmosphere reset research into an implementation shape.
The companion documents are:

- [Research](research.md): physical model, equations, simplifications, and
  references.
- [CPU Spectral Reference Integrator Design](cpu-spectral-reference-integrator-design.md):
  focused contract for the slow CPU truth engine.
- [Plan](plan.md): test-first implementation sequence.

## Design Goal

Build a framework-free physical atmosphere reference module that can compute a
camera ray's spectral radiance for both:

- a real globe model: spherical Earth, spherical-shell atmosphere, distant Sun
- a counterfactual flat model: flat surface/disk, slab/dome/local atmosphere,
  local finite Sun

The scattering equation should be shared. The world geometry, atmosphere
volume, density field, source geometry, and boundary/occlusion rules should be
swappable physical properties.

## Ownership Boundary

The reset reference implementation should initially live under `scripts/flat`:

```text
scripts/flat/atmosphere-reference/
```

It must not depend on React, Three.js, browser canvas state, render targets, or
shader implementation details. Treat it as a script-owned laboratory and truth
oracle, not app runtime code. If pieces later need to be reused by the app,
promote the small pure modules deliberately into `src/flat/shared` after their
contracts are proven by tests.

The design has three layers:

1. Physical data and utilities:
   - wavelength grids
   - solar spectra
   - CIE color matching
   - spectral interpolation/integration
   - radiometric helpers
2. Model contracts:
   - world geometry
   - atmosphere volume/profile
   - solar source
   - surface reflection
3. Reference solver:
   - optical depth
   - transmittance
   - single scattering
   - surface radiance
   - spectral to XYZ to linear RGB conversion
   - diagnostics

## Module Layout

Preferred first layout:

```text
scripts/flat/atmosphere-reference/
  spectral-grid.js
  colorimetry.js
  radiometry.js
  atmosphere-profile.js
  reference-integrator.js
  diagnostics.js
  geometry/
    spherical-world.js
    flat-world.js
  sources/
    distant-sun.js
    local-finite-sun.js
  surfaces/
    lambertian-surface.js
  index.js
  _tests/
```

The names can shift during implementation if local conventions suggest a
better split, but the dependency direction should not: low-level physical data
and math should not import feature models or shaders. Script fixtures may adapt
current app data into reference inputs, but the solver itself should remain
plain JavaScript.

## Units

Use explicit unit conventions at every public boundary:

- distance: kilometers
- wavelength: nanometers
- spectral radiance: `W / m2 / sr / nm`
- spectral irradiance: `W / m2 / nm`
- extinction/scattering coefficient: `1 / km`
- optical depth: unitless
- transmittance: unitless `[0, 1]`
- CIE XYZ and linear RGB: display-facing numeric values after spectral
  integration

JavaScript will not enforce dimensions at compile time, so the reference
module should compensate with clear names, test fixtures, and debug validation.

## Core Contracts

The reference integrator should consume model objects. It should not branch on
`globe` or `flat` internally.

```text
world.altitudeAt(positionKm) -> km
world.upAt(positionKm) -> unit vector
world.intersectSurface(ray) -> hit | null
world.surfaceNormalAt(hit) -> unit vector

atmosphere.intersect(ray) -> { tMinKm, tMaxKm } | null
atmosphere.densityAt(positionKm, species) -> unitless density
atmosphere.extinctionAt(positionKm, wavelengthNm) -> 1/km
atmosphere.scatteringAt(positionKm, wavelengthNm) -> species coefficients

solarSource.samplesAt(positionKm, wavelengthNm) -> sun samples
sun sample:
  direction
  spectralRadiance or spectralIrradiance
  solidAngle
  visibility

surface.radianceAt(hit, wavelengthNm, lighting) -> W / m2 / sr / nm
```

These contracts are the design feature that keeps the flat comparison honest.
The real globe and proposed flat model can use the same solver because they
answer the same questions differently.

## Globe Model

The globe fixture should start with:

```text
surface: sphere(center, R_earth)
atmosphere: spherical shell(R_earth, R_earth + H_top)
altitude: length(position - center) - R_earth
up: normalize(position - center)
source: distant Sun with spectral irradiance at 1 AU
occlusion: solid Earth blocks sample-to-Sun rays
```

The distant Sun source may use a single directional sample for atmosphere
scattering at first. Solar disk rendering can be angular/radiance based later.

## Flat Model

The flat fixture should start with:

```text
surface: plane or finite disk
atmosphere: slab, dome, finite cylinder, or named local patch
altitude: vertical height above the plane
up: constant vertical unless terrain overrides it
source: finite local Sun with position, radius, spectral radiance, and motion
occlusion: explicit boundary, disk edge, dome, terrain, or no-occlusion rule
```

Flat-model-only values such as local Sun height, local Sun radius, disk edge,
dome height, and no-occlusion rules are hypothesis parameters. They are allowed
only when named as proposed physical assumptions.

## Spectral Pipeline

The reference path is:

```text
spectral source
  -> spectral optical depth/transmittance
  -> spectral in-scattering and surface radiance
  -> CIE XYZ
  -> linear RGB
  -> optional exposure/tone mapping outside the physical reference
```

RGB is not a physics transport domain. Any RGB shader approximation must be
compared against this spectral reference.

## Reference Integrator

The focused integrator contract lives in
[CPU Spectral Reference Integrator Design](cpu-spectral-reference-integrator-design.md).
This section is the project-level summary.

For one ray:

1. Intersect the active atmosphere volume.
2. Intersect the active surface model.
3. Choose the integration segment from camera to surface hit or atmosphere
   boundary.
4. For each wavelength:
   - integrate camera-ray optical depth
   - sample density and extinction by altitude/position
   - sample the active solar source from each point
   - compute sample-to-source transmittance
   - apply Rayleigh and Mie phase functions
   - accumulate in-scattered radiance
5. If the ray hits a surface:
   - compute direct source irradiance
   - compute diffuse sky irradiance by hemisphere integration
   - compute Lambertian or configured surface radiance
   - attenuate surface radiance by view transmittance
6. Convert the final spectral radiance to XYZ and linear RGB.
7. Return diagnostics.

## Diagnostics Contract

The return value should include enough information to explain the pixel:

```text
{
  wavelengthsNm,
  spectralRadiance,
  xyz,
  linearRgb,
  components: {
    surfaceRadiance,
    rayleighInScattering,
    mieInScattering,
    absorptionLoss,
    directSolarIrradiance,
    diffuseSkyIrradiance
  },
  opticalDepth: {
    view,
    sun,
    rayleighView,
    mieView,
    absorberView
  },
  geometry: {
    viewDistanceKm,
    atmosphereDistanceKm,
    surfaceHit,
    sunSamples,
    scatteringAngles
  }
}
```

Diagnostics are not optional decoration. They are how we prevent muted
blue-gray skies, brown horizons, and pink marker airlight from being solved by
guessing at constants.

## Test-First Design

This module should be built test-first. For each physical subsystem:

1. Write the fixture.
2. Write analytic, invariant, reference-data, or cross-model tests.
3. Confirm the tests fail for missing behavior.
4. Implement until they pass.
5. Add diagnostics.
6. Only then compare shader output.

Shader parity tests should be last in the chain. They are meaningful only after
the CPU reference has earned trust with known-answer tests.

## Shader Boundary

The shader is allowed to be approximate. The CPU reference is allowed to be
slow. The comparison contract should be:

```text
CPU spectral reference -> expected physical radiance/color
GPU shader -> fast approximation
parity harness -> named per-probe tolerance
```

Tolerances should be strict for vacuum/transmittance-only cases, moderate for
clear-sky single scattering, and looser near the horizon or in Mie-heavy paths.

A shader-specific design document is intentionally deferred. Create it later
only after the CPU spectral reference integrator has passing known-answer tests
and the project is ready to specify GPU approximation choices, shader parity
probes, tolerance budgets, and browser capture/debug hooks.

## Migration From Current Code

Current useful material to mine:

- `src/flat/shared/Atmosphere.js`: existing profile validation, density,
  phase-function, optical-depth, and frame ideas.
- `src/flat/shared/consts.js`: Earth radius and current atmosphere presets.
- `src/flat/features/globe-simulation/models/consts.js`: astronomical unit,
  solar radius, axial tilt, default solar source values.
- `src/flat/features/globe-simulation/components/GlobeAtmosphereComposer.jsx`:
  shader approximation to test against, not the source of truth.
- `src/flat/shared/RadiometricDisplay.js`: current display bridge to replace
  with explicit spectral-to-color and display choices.

Use the architecture of the current iteration as raw material, not as a
compatibility constraint. The first script implementation can start fresh,
borrow names and shapes that still make sense, and cleanly reject prior
mixed-unit bridges. Do not preserve compatibility aliases if a contract
changes. New physical contracts should replace old mixed-unit bridges across
code, tests, fixtures, and docs.

## Non-Goals

- No clouds in the first reset.
- No weather system in the first reset.
- No terrain dependency for the first reference integrator.
- No multiple scattering until single scattering and diagnostics are trusted.
- No shader-driven truth. The shader follows the reference, not the reverse.

## Open Design Decisions

- First canonical solar spectrum source and redistribution/attribution path.
- First canonical wavelength grid for tests versus browser parity.
- Whether ozone belongs in Phase 1 or after single-scattering parity.
- Whether the first flat atmosphere is a slab, dome, finite cylinder, or local
  computational patch.
- Whether local Sun source calibration starts from target DNI, target spectral
  radiance, or target apparent angular size plus DNI.
- When shader parity work begins, whether it needs its own shader-specific
  design document.
