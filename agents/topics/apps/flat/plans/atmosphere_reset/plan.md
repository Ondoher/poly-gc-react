# Atmosphere Reset Plan

Goal: build a small, slow, explicit CPU spectral reference integrator that can
answer "what radiance should this camera ray receive?" for both the real globe
calibration model and the proposed flat-world/local-Sun model. This reference
becomes the truth oracle for shader work: the shader may be faster and more
approximate, but it should agree with the reference within named tolerances.

This plan executes the reset described in [Research](research.md) using the
contracts in [Design](design.md) and the focused
[CPU Spectral Reference Integrator Design](cpu-spectral-reference-integrator-design.md).

## Stance

This is a reference implementation, not a production renderer. Prefer clarity,
diagnostics, unit discipline, and testability over speed. Do not copy external
code into the project. Mine Bruneton, PBRT, libRadtran, SMARTS, and related
references for equations, expected invariants, and test structure, then write
our own JavaScript implementation in the shape of this app.

Use a test-first workflow for this module. For each phase, write the
known-answer tests and fixtures before implementing the code they exercise. It
is acceptable for the tests to fail at first; that failure is the checklist.
Do not trust a new physical calculation until it has at least one analytic,
reference-data, or invariant test explaining the expected result.

The key design choice is to separate the light-transport math from the world
model:

```text
same spectral scattering integrator
  + globe geometry / spherical shell / distant Sun
  = real Earth calibration result

same spectral scattering integrator
  + flat geometry / slab or dome / local finite Sun
  = counterfactual model consequence
```

If the flat model looks unlike the globe model, that is an output to inspect,
not a problem to tune away.

## External Test Patterns To Adapt

Bruneton's 2017 implementation is the closest precedent. Its docs describe a
CPU full-spectral double-precision reference used to compare GPU
approximations, plus unit tests for dimensional homogeneity and atmospheric
functions. The applicable test ideas are:

- Compare GPU/approximate outputs against CPU full-spectral reference outputs.
- Test atmosphere boundary distances.
- Test whether near-horizon rays intersect the ground.
- Test density-profile evaluation.
- Test optical length and transmittance in analytically solvable cases.
- Test texture/LUT encode-decode parity if we later introduce lookup tables.
- Test single-scattering integrands in cases with known closed-form behavior.
- Test phase-function normalization by numerical integration over the sphere.
- Test compute-vs-sampled lookup parity for scattering and irradiance.
- Test multiple modes: spectral radiance, luminance conversion, constant
  albedo, spectral albedo, normal Sun, and sunset/low-Sun geometry.

PBRT contributes general participating-media invariants:

- Transmittance is always in `[0, 1]`.
- Vacuum transmittance is `1`.
- Homogeneous-medium transmittance follows Beer-Lambert:
  `T = exp(-sigma_t * d)`.
- Transmittance is multiplicative along points on a ray:
  `T(a,c) = T(a,b) * T(b,c)`.
- Phase functions should be normalized over solid angle.

SMARTS, libRadtran, ASTM G-173, and NREL/NLR reference spectra should be used
as benchmark data sources and sanity checks for solar spectra, AM1.5 direct
normal/global spectra, and clear-sky irradiance ranges. They are not a good
shape for app-internal rendering code.

## Test-First Rule

This is the one part of the project where TDD should be the default. The
reference integrator exists to create known answers; if we implement it first
and only inspect screenshots afterward, it can quietly become another tuning
layer. The order for each phase should be:

1. Write the fixture.
2. Write the known-answer or invariant tests.
3. Run the tests and confirm they fail for missing behavior, not for malformed
   test setup.
4. Implement the smallest reference code that satisfies the tests.
5. Add diagnostics needed to explain the result.
6. Only then compare shader/browser output against the reference.

Every test should state what kind of expectation it represents:

- `analytic`: closed-form answer, such as Beer-Lambert transmittance.
- `invariant`: physics property, such as transmittance staying in `[0, 1]`.
- `reference-data`: comparison against a named external data source.
- `cross-model`: same local conditions across globe and flat configurations.
- `shader-parity`: GPU approximation compared with CPU reference output.

Do not add shader-parity tests until the underlying CPU known-answer tests for
that quantity are already passing. Shader parity is only meaningful if the
CPU reference has earned trust first.

## Deliverables

1. A framework-free reference module under `scripts/flat`.
   - Preferred folder: `scripts/flat/atmosphere-reference`.
   - No React, Three.js, browser canvas, or shader dependency.
   - Plain deterministic functions/classes that can run in unit tests.
   - Promote pieces into `src/flat/shared` only later, after their contracts are
     proven and app-runtime reuse is clearly needed.
2. Data tables or generated assets for:
   - wavelength samples
   - solar spectrum
   - CIE 1931 color-matching functions
   - optional ozone cross-section/profile later
3. A model contract for:
   - world geometry
   - atmosphere volume
   - solar source
   - surface reflection
   - camera/observer ray
4. A CPU integrator that returns:
   - spectral radiance by wavelength
   - CIE XYZ
   - linear RGB
   - optical-depth diagnostics
   - per-component radiance diagnostics
5. A test suite that locks down known answers before shader work depends on
   the reference.
   - Tests should be written first for each phase.
   - Each expected value should be classified as analytic, invariant,
     reference-data, cross-model, or shader-parity.
6. A shader-parity harness that compares selected GPU/browser rays against the
   CPU reference.

## Proposed Module Shape

```text
scripts/flat/atmosphere-reference/
  spectral-grid.js
  colorimetry.js
  radiometry.js
  atmosphere-profile.js
  geometry/
    spherical-world.js
    flat-world.js
  sources/
    distant-sun.js
    local-finite-sun.js
  surfaces/
    lambertian-surface.js
  reference-integrator.js
  diagnostics.js
  index.js
  _tests/
```

This can be adjusted to local naming conventions during implementation, but
keep the ownership boundary: the reference integrator should be a shared
framework-free package-shaped module.

## Core Interfaces

The integrator should consume a model object rather than branching on
`globe`/`flat` internally.

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

The globe implementation can answer these with spherical Earth math. The flat
implementation can answer them with a plane/disk, slab/dome, and local finite
Sun. The integrator should not know which one it is using.

## Output Contract

Reference calls should return a rich diagnostic object, not just RGB:

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

Diagnostics are part of the product. They let us answer why a pixel is blue,
gray, brown, pink, black, or clipped.

## Phase 0: Lock The Spec

Status: planned.

Tasks:

- Keep [Research](research.md) as the model note.
- Keep [Design](design.md) as the implementation contract.
- Keep [CPU Spectral Reference Integrator Design](cpu-spectral-reference-integrator-design.md)
  as the focused solver contract.
- Treat this plan as the implementation checklist.
- Create empty/failing test files for the first two phases before writing
  implementation code.
- Decide the first wavelength grid:
  - recommended debug grid: `360-830 nm` at `10 nm` intervals
  - recommended fast grid: `15-31` selected visible samples
- Decide first solar spectrum source:
  - use a NREL/NLR or ASTM G-173-derived table where redistribution is
    acceptable, or a generated local source with clear attribution
  - keep blackbody only as a fallback sanity fixture, not the canonical Sun
- Decide first color conversion:
  - CIE 1931 2-degree observer
  - linear sRGB output
  - no tone mapping inside the reference unless explicitly requested

Exit criteria:

- The spec names every required input and output.
- The first test fixture values are fixed.
- Any data-table source and license/attribution obligation is recorded.
- The first test skeletons exist and fail only because the reference module is
  not implemented yet.

## Phase 1: Units, Spectra, And Color

Status: planned.

Tasks:

- Create wavelength-grid helpers.
- Create spectral sample arrays and interpolation helpers.
- Create CIE XYZ integration.
- Create XYZ-to-linear-sRGB conversion.
- Create a lightweight runtime unit convention:
  - distances in kilometers at the public app boundary
  - spectral radiance in `W / m2 / sr / nm`
  - spectral irradiance in `W / m2 / nm`
  - extinction/scattering in `1/km`
- Add debug assertions for invalid dimensional combinations where practical.

Tests:

- Wavelength grids are sorted, non-empty, and inside the visible range.
- Interpolation returns exact values at sample wavelengths.
- CIE integration of zero spectrum returns zero XYZ/RGB.
- Flat equal-energy spectrum produces finite positive XYZ.
- Linear RGB conversion preserves zero and does not silently clamp negatives;
  clamping/tone mapping belongs later.
- Solar spectrum integrated over the selected grid is within an expected broad
  range for visible irradiance.

Known answers:

- `XYZ(0 spectrum) = (0, 0, 0)`.
- Equal-energy visible light should be neutral-ish after color conversion, not
  saturated red/green/blue.
- RGB transport is not allowed in this layer.

## Phase 2: Geometry And Source Contracts

Status: planned.

Tasks:

- Implement spherical world geometry:
  - altitude is `length(position - center) - radius`
  - up is normalized radial direction
  - surface hit is ray-sphere intersection
  - atmosphere hit is ray-sphere-shell intersection
- Implement flat world geometry:
  - altitude is vertical `z` or selected local-up coordinate
  - up is constant unless terrain overrides it
  - surface hit is ray-plane or ray-disk intersection
  - atmosphere hit is slab/dome/cylinder intersection
- Implement distant Sun source:
  - direction plus top-of-atmosphere spectral irradiance
  - optional solar angular radius for disk rendering/diagnostics
- Implement local finite Sun source:
  - position, radius, spectral radiance, motion hook
  - solid-angle calculation
  - small-disk approximation first, sampled disk later

Tests adapted from Bruneton-style geometry checks:

- Spherical upward ray from surface exits after `topAltitudeKm`.
- Spherical tangent/horizon threshold classifies just-above-horizon and
  just-below-horizon rays correctly.
- Spherical ray below horizon intersects the ground.
- Flat vertical ray exits slab after `topAltitudeKm`.
- Flat slanted ray through slab exits after `topAltitudeKm / cosZenith` when
  `cosZenith > 0`.
- Flat horizontal ray requires an explicit finite boundary; no hidden infinite
  path is allowed.
- Local Sun solid angle matches:
  `Omega = 2*pi*(1 - sqrt(d^2 - R^2)/d)`.
- Small-disk local Sun solid angle approaches `pi*(R/d)^2`.

Known answers:

- Globe horizon cosine at radius `r` is
  `-sqrt(1 - (R_earth / r)^2)` when measured against local up.
- A slab without a horizontal boundary has an infinite horizontal path; if the
  implementation returns a finite distance, that distance must come from a
  named model boundary.
- Matching real solar angular radius means
  `R_sun_local / d_reference ~= 0.00465`.

## Phase 3: Density, Optical Depth, And Transmittance

Status: planned.

Tasks:

- Implement density profiles:
  - exponential Rayleigh
  - exponential aerosol
  - optional piecewise/layer profile
  - optional ozone profile later
- Implement optical-depth integration along arbitrary model rays.
- Implement transmittance as `exp(-opticalDepth)`.
- Return optical-depth diagnostics per species and wavelength.

Tests adapted from Bruneton/PBRT:

- Density at altitude `0` is `1` for normalized profiles.
- Exponential density at one scale height is `exp(-1)`.
- Density above top atmosphere is zero.
- Homogeneous medium optical depth equals `beta * distance`.
- Homogeneous transmittance equals `exp(-beta * distance)`.
- Vacuum transmittance equals `1`.
- Transmittance stays in `[0, 1]`.
- Transmittance is multiplicative along split ray segments.
- Blue Rayleigh optical depth is greater than green, and green greater than
  red, for the same path.
- Slab vertical exponential optical depth matches the analytic integral:
  `beta0 * H * (1 - exp(-H_top / H))`.
- Slab slanted exponential optical depth scales by `1 / cosZenith` while the
  ray remains inside the slab.

Known answers:

- Increasing path length or extinction cannot increase transmittance.
- Shorter visible wavelengths should attenuate more strongly under Rayleigh
  scattering.

## Phase 4: Phase Functions And Single Scattering

Status: planned.

Tasks:

- Implement Rayleigh phase function.
- Implement Henyey-Greenstein or Cornette-Shanks Mie phase function.
- Implement single-scattering integral along the camera ray:

  ```text
  L += T_view * beta_s * phase * source * T_sun * ds
  ```

- Split Rayleigh and Mie contributions in diagnostics.
- For the local Sun, start with small-disk approximation, then add optional
  finite-disk sampling.

Tests adapted from Bruneton/PBRT:

- Rayleigh phase is symmetric: `P(mu) == P(-mu)`.
- Rayleigh and Mie phase functions numerically integrate to `1` over the
  sphere.
- Positive-`g` Mie is forward scattering:
  `P(1) > P(0) > P(-1)`.
- A zero solar source produces zero in-scattering.
- A zero scattering coefficient produces zero in-scattering.
- Rayleigh-only noon sky from a ground observer is blue after spectral-to-RGB
  conversion.
- Single-scattering integrand in a homogeneous medium matches a closed-form or
  high-resolution numeric reference.
- Reversing the phase-angle sign changes Mie behavior in expected ways; lock
  the chosen convention with tests.

Known answers:

- Rayleigh-only clear sky should produce more blue-channel radiance than red
  for typical side-sky directions.
- Aerosols should add less saturated, more forward-concentrated light.

## Phase 5: Surface Lighting And Diffuse Sky Irradiance

Status: planned.

Tasks:

- Implement Lambertian surface radiance:

  ```text
  L_surface = albedo / pi * (E_direct * cosTheta + E_diffuse_sky)
  ```

- Compute direct solar irradiance from the same source/transmittance model.
- Compute diffuse sky irradiance by hemisphere integration over sky radiance.
- Keep surface albedo spectral-capable, with constant-albedo fixtures first.

Tests:

- Black albedo returns zero reflected surface radiance.
- White Lambertian direct response scales with `cosTheta`.
- Surface with Sun below the local horizon receives no direct irradiance.
- Uniform sky radiance `L` over a hemisphere produces irradiance `pi * L`.
- Diffuse sky irradiance is non-negative and increases when scattering
  coefficients increase within reasonable clear-sky ranges.
- Globe and flat surfaces with identical local normal/source direction and
  no atmosphere produce the same direct Lambertian radiance.

Known answers:

- The current "removed direct sunlight times fixed fraction" diffuse estimate
  should fail replacement tests because it is not hemisphere integration.

## Phase 6: Flat World / Local Sun Consequence Tests

Status: planned.

Tasks:

- Add a named flat-world fixture:
  - plane or finite disk surface
  - slab or dome atmosphere
  - local finite Sun with reference-position calibration
- Add calibration helper:

  ```text
  choose L_sun(lambda) such that
  E_target(lambda) = L_sun(lambda) * Omega_reference * T_reference(lambda)
  ```

- Add diagnostics showing how local Sun irradiance changes with observer
  position.

Tests:

- At the reference observer, local Sun apparent angular radius matches the
  configured target.
- At the reference observer, direct normal irradiance matches the configured
  target after atmospheric transmittance.
- With equal transmittance and incidence, moving twice as far from the same
  local Sun reduces direct irradiance by about `4x` under the small-disk
  approximation.
- Flat slab horizon rays accumulate much larger optical depth than vertical
  rays when a finite boundary is far away.
- Changing only geometry/source from globe to flat changes path diagnostics
  without changing Rayleigh/Mie coefficients.
- The integrator reports whether a result depends on a flat boundary/dome/disk
  edge instead of silently hiding that dependency.

Known answers:

- A local Sun cannot have real-Sun angular size and real-Sun direct irradiance
  everywhere on a large flat plane unless extra physical assumptions are added.
- That mismatch is a model consequence to expose.

## Phase 7: Shader Parity Harness

Status: planned.

Tasks:

- Add deterministic probe rays:
  - zenith sky
  - side sky at about `90 deg` scattering angle
  - near-horizon sky
  - toward-Sun sky
  - surface hit at known distance
  - red diagnostic marker hit
- For each probe, compute CPU reference diagnostics.
- Add a shader/debug path that can render or read the corresponding shader
  output for the same ray.
- Compare:
  - linear RGB after the same display conversion
  - view optical depth
  - in-scattering component when available
  - surface transmittance when available

Tests adapted from Bruneton model comparison:

- CPU spectral reference vs shader RGB should be within a named tolerance for
  each probe.
- Looser tolerance is allowed for horizon rays and Mie-heavy rays.
- Tighter tolerance is expected for transmittance-only and vacuum cases.
- Track max relative error and mean relative error, not only pass/fail.
- Store per-probe diagnostic JSON with captures so future regressions are
  explainable.

Known answers:

- If shader output is muted blue-gray while CPU reference is saturated daylight
  blue, the bug is likely display mapping, spectral approximation, or shader
  scattering math, not the atmosphere constants.

## Phase 8: Replace Current Tuning Bridges

Status: planned.

Tasks:

- Replace `rendererIrradianceReferenceWm2` display scaling with explicit
  spectral radiance -> XYZ -> linear RGB -> exposure/tone mapping.
- Replace diffuse-sky fixed fraction with hemisphere-integrated sky irradiance.
- Replace local/visible Sun emissive hacks with angular/radiance-based solar
  disk handling.
- Keep current shader paths only as temporary compatibility until parity tests
  pass.
- Update captures to use direction/probe metadata instead of only fixed screen
  coordinates.

Tests:

- Removing display magic does not change physical radiance diagnostics.
- Exposure/tone mapping changes display output only after physical radiance is
  computed.
- Diffuse sky irradiance is traceable to sky radiance samples.
- Sun disk brightness is traceable to spectral radiance and angular size.

## Test-First Implementation Order

1. Create `scripts/flat/atmosphere-reference` and empty test fixtures.
2. Write Phase 1 tests for spectral grids, interpolation, CIE conversion, and
   zero/equal-energy spectra. Confirm they fail for missing implementation.
3. Implement the Phase 1 code until those tests pass.
4. Write Phase 2 geometry/source tests for globe, flat, distant Sun, and local
   finite Sun. Confirm they fail for missing implementation.
5. Implement the Phase 2 code until those tests pass.
6. Write Phase 3 optical-depth/transmittance analytic tests.
7. Implement the Phase 3 code until those tests pass.
8. Write Phase 4 phase-function and single-scattering invariant tests.
9. Implement the Phase 4 code until those tests pass.
10. Write Phase 5 surface/direct/diffuse irradiance tests.
11. Implement the Phase 5 code until those tests pass.
12. Write Phase 6 local-Sun calibration and flat-world consequence tests.
13. Implement the Phase 6 code until those tests pass.
14. Write Phase 7 shader-parity probes using the trusted CPU reference.
15. Implement shader/debug hooks until parity is measurable.
16. Decide whether shader parity and approximation work now needs a dedicated
    shader-specific design document.
17. Use the reference output to decide which current shader/display bridges to
    replace first.

## Acceptance Criteria

- The CPU reference can compute one globe sky ray, one globe surface ray, one
  flat sky ray, and one flat surface ray from physical inputs.
- The same integrator code runs for globe and flat configurations.
- The reference output includes spectral radiance, XYZ, linear RGB, and optical
  diagnostics.
- Each implementation phase begins with failing known-answer tests.
- The test suite includes analytic known-answer tests before any shader parity
  test is trusted.
- The current globe shader has at least five deterministic probe comparisons
  against the CPU reference.
- No new magic display or atmosphere constants are introduced without being
  labeled as hypothesis parameters, numerical controls, or camera/display
  choices.

## References

- [Research](research.md)
- [Design](design.md)
- Bruneton, "Precomputed Atmospheric Scattering: a New Implementation":
  https://ebruneton.github.io/precomputed_atmospheric_scattering/
- Bruneton GitHub repository:
  https://github.com/ebruneton/precomputed_atmospheric_scattering
- PBRT v4, Transmittance:
  https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance
- PBRT v4, Phase Functions:
  https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions
- libRadtran:
  https://www.libradtran.org/doku.php
- NREL/NLR solar spectra:
  https://www.nlr.gov/grid/solar-resource/spectra
- CIE 1931 2-degree color-matching functions:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
