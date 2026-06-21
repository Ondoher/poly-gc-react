# Atmosphere Reset Plan

Goal: build a small, slow, explicit CPU spectral reference integrator that can
answer "what radiance should this camera ray receive?" for both the real globe
calibration model and the proposed flat-world/local-Sun model. This reference
becomes the truth oracle for shader work: the shader may be faster and more
approximate, but it should agree with the reference within named tolerances.

This plan executes the reset described in [Research](research.md) using the
contracts in [Design](design.md) and the focused
[Reference Code Design](reference/code_design.md).
The script-level implementation sequence for that reference lives in
[Reference Plan](reference/plan.md), with stage expectations in
[Reference Test Design](reference/test_design.md).

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
  + globe geometry / WGS84 ellipsoid-relative atmosphere / distant Sun
  = real Earth calibration result

same spectral scattering integrator
  + flat geometry / slab or dome / local finite Sun
  = counterfactual model consequence
```

If the flat model looks unlike the globe model, that is an output to inspect,
not a problem to tune away.

Multiple scattering is closed as the active output-fidelity follow-up. Keep
the sidecar and no-op contracts for isolation and future reference, but do not
spend more time tuning the current multiple-scattering field grid before the
larger model-ingredient tasks in the focused reference plan. Use
[Multiple-Scattering Reference Design](multiple_scattering_design.md) for the
design rationale and [Multiple-Scattering Plan](multiple_scattering_plan.md)
for closeout/history: the investigation showed that generic higher-order
scattering is not enough to explain the muted daylight, low contrast, and
brown horizon. Bruneton tables remain validation and shader-architecture
precedents for the spherical Earth-like subset, while flat-world/local-Sun
approximation tables will likely need to be generated from project-owned
reference runs with explicit geometry, source, atmosphere, and finite-boundary
metadata.

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
   - Preferred folder: `scripts/flat/atmosphere/reference`.
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

## Current Next Focus

General comparison goal: move each identified reference weakness toward the
methods, data, and assumptions used by Bruneton's clear-sky model comparison
before judging the remaining gap. This means treating Bruneton-method parity
as the first model-output target, not tuning the pipeline directly toward
photographs or isolated visual preferences.

The active output-impact implementation queue now lives in
[Reference Plan](reference/plan.md#current-next-focus-output-impact-reference-work)
because the first follow-up items are script/reference-runner model and
artifact changes. This plan keeps the broader reset direction and composition
context.

## Composition Context

The color/display bridge is now strong enough for current reference-proof
work: official CIE colorimetry, named wavelength grids, sourced ASTM G-173
solar input, provenance, and PNG/PPM artifacts are in place. Recent sunset
comparisons changed only incrementally when improving color integration and
solar spectrum input, so the next meaningful fidelity pass should improve the
atmospheric composition/model inputs rather than adding more color plumbing.

The focused composition roadmap now lives in
[Atmosphere Composition Plan](composition/plan.md). Its top-level improvements
are Rayleigh model, ozone absorption, aerosol/Mie model, species diagnostics,
atmosphere profile, and comparison artifacts. The composition plan now owns the
detailed Rayleigh implementation checklist: source-data confirmation, pinned
quantity choice, Bucholtz extraction/provenance, named policies, tests, and
preview-vs-Bucholtz comparison artifacts. Rayleigh substeps 1-7 are now
complete under `scripts/flat/atmosphere/composition/` and
`scripts/flat/atmosphere/run-reference-probe.js`. The default remains
`rayleigh-lambda4-preview`; `bucholtz-standard-air` is selected explicitly for
review runs.

Composition checkpoint:

1. Close the Rayleigh model first, because it is the first item in the
   atmosphere-composition fidelity list.
   - Done: fetched/extracted clean Bucholtz 1995 Rayleigh data, using
     visible-band volume-scattering coefficients/cross sections that can
     directly replace the current `lambda^-4` preview scaling.
   - Done: stored a small local data artifact with DOI/source URL, table
     locator, extraction notes, units, and pinned rows.
   - Done: added tests for table/provenance shape, pinned visible rows, policy
     scaling behavior, and loud failure on malformed data.
   - Done: implemented a named `bucholtz-standard-air` Rayleigh policy beside
     the current preview policy. The preview remains the default until the
     comparison artifact is reviewed.
2. Add the minimal policy scaffold needed to compare that Rayleigh change.
   Done: start with `rayleigh-lambda4-preview`, `bucholtz-standard-air`, and
   the existing `earth-like-sky-preview` atmosphere composition. Broader
   aerosol variants can follow after the Rayleigh source path is reviewed.
3. Add diagnostics that break output down by atmospheric species and policy.
   The first useful report should make it clear how much Rayleigh, aerosol/Mie,
   ozone absorption, source transmittance, and view transmittance contributed
   to each sunset patch.
4. Use the named policies to generate sunset comparison artifacts:
   done for current preview Rayleigh vs Bucholtz Rayleigh at
   `tmp/atmosphere-rayleigh-comparison/`, then Rayleigh-only vs
   Rayleigh+aerosol, current ozone approximation vs no ozone, low/medium/high
   aerosol optical depth, and different aerosol phase `g` values.
5. After the Rayleigh path is proven, proceed through the rest of the
   atmosphere-composition list: sourced ozone cross sections/profile, named
   aerosol/Mie presets, atmosphere-profile improvements, and broader comparison
   artifacts.
6. If this checklist grows past a short implementation note, split it into a
   focused atmosphere-composition plan folder under
   `agents/topics/apps/flat/plans/atmosphere_reset/`.

## Proposed Module Shape

```text
scripts/flat/atmosphere/reference/
  spectral-grid.js
  colorimetry.js
  radiometry.js
  atmosphere-profile.js
  CpuSpectralReferenceIntegrator.js
  pipeline-stages.js
  types.d.ts
  geometry/
    spherical-world.js
    flat-world.js
  sources/
    distant-sun.js
    local-finite-sun.js
  surfaces/
    lambertian-surface.js
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

The Phase 6A globe benchmark implementation should answer these with WGS84
world math. Earlier analytic fixtures may still use a spherical Earth model
when that gives closed-form geometry expectations. The flat implementation can
answer them with a plane/disk, slab/dome, and local finite Sun. The integrator
should not know which one it is using.

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
- Keep [Reference Code Design](reference/code_design.md)
  as the focused solver contract.
- Keep [Reference Plan](reference/plan.md)
  as the focused script implementation checklist.
- Include the CLI runner in the focused reference work so named probes and JSON
  config runs exist before shader parity.
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
- Implement WGS84 world geometry before Phase 6A benchmark use:
  - geodetic observer placement uses EPSG 7030 semi-major axis and inverse
    flattening
  - altitude is ellipsoidal height above the WGS84 surface
  - up is the local ellipsoid-normal / ENU up direction
  - surface and atmosphere intersections report ellipsoid-relative boundary
    metadata
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

## Phase 6A: Benchmark Worlds, Cameras, And CLI Evidence

Status: planned.

Goal: turn the trusted transport core into repeatable visual and numeric
benchmarks before shader parity. This phase assembles model adapters, camera
definitions, probe rays, post-pipeline color conversion, and CLI artifacts. It
does not tune the shader and does not add browser dependencies to the
reference.

Current scope: prove the reference. Phase 6A should make the CPU reference
easy to run, inspect, and compare through deterministic benchmark scenarios and
CLI artifacts. Three.js camera poses, shader ray reconstruction, shader uniform
packing, floor texture UVs, and sky-dome endpoint projections are downstream
parity work, not implementation targets for this slice.

Near-term priority is deliberately lighter than the full transform roadmap:
produce image pixels from reference output correctly, and make the atmosphere
inputs Earth-like enough that those pixels are meaningful. A minimal
observer/ray adapter is sufficient for now when it can aim the first sky
patches and record diagnostics. Do not spend this slice building app-facing
coordinate infrastructure beyond what the benchmark scenarios need.

Tasks:

- Add reusable model adapters:
  - `earth.globe.clearDay`
  - `earth.globe.vacuum`
  - `flat.appDefaults.localSun`
  - `flat.hypothesis.localPatch`
  - `flat.vacuum`
- Add camera/probe scenario JSON separate from stage expectation fixtures.
  Stage fixtures remain the equation/contract oracle; benchmark scenarios
  assemble worlds and views for visual review.
- Add a camera adapter that can materialize named view directions into model
  rays:
  - zenith
  - horizon by azimuth/elevation
  - toward Sun / near Sun
  - surface target / marker target
- Keep the camera adapter outside the transport stages. It should convert
  benchmark camera/view definitions into `observer.positionKm` and normalized
  `ray.direction`, plus diagnostics describing the resolved local frame,
  camera basis, FOV/aspect, probe id, target/source ids, and warnings.
- Implement the first camera algorithm as a minimal plain pinhole ray generator:
  geodetic or flat observer resolution, local east/north/up basis, azimuth and
  elevation direction selection, `towardSun` and target views, and NDC samples
  from vertical FOV/aspect.
- Implement the coordinate/transform core from the design: geodetic
  coordinates for permanent facts, observer-relative coordinates for
  subjective/view-local intent, and future Three/app scene coordinates only as
  generated render endpoints. Treat ECEF, ENU, flat projection, object-local,
  view, clip/NDC, framebuffer UV, and texture UV as operational bridge spaces
  with diagnostics, but implement only the reference-proof transforms needed
  to emit CPU trace requests now.
- Design and implement the camera-bridge first slice of the transform core
  before implementing the camera bridge itself. The first slice should provide
  WGS84 datum/height/geodetic/ECEF/ENU transforms, one named
  ECEF-as-reference-globe-frame adapter, flat north-pole azimuthal equidistant projection,
  flat local-frame resolution, observer and target resolution,
  azimuth/elevation and `towardSun` directions, plumb-aligned pinhole basis
  construction, NDC ray generation, provenance metadata, and deterministic
  cache-key fields.
- Keep the full design transform inventory as a destination map, but implement
  only the reference-proof subset now. Three.js camera poses, shader
  reconstruction/uniform packing, current app floor texture UV inversion,
  celestial sky-dome projection, and app-specific axis-map variants are
  deferred until reference scenarios are trusted enough to become parity
  targets.
- Allow deterministic precompute/cache for repeated coordinate bridge
  calculations such as WGS84 derived constants, ECEF/ENU bases, flat projection
  results, target resolution, camera bases, and NDC ray grids. Cache keys must
  include the canonical inputs and frame metadata, and cached values must
  remain generated artifacts rather than scenario sources of truth. Object
  transforms and shader uniform matrices are later cache candidates after app
  and shader endpoint adapters exist.
- Encode hand-authored benchmark targets as geodetic anchors by default:
  latitude, longitude, and `elevationKmMsl`. Allow
  `distanceFromEarthCenterKm` only as an explicit alternate datum for
  geocentric/shell-like probes, and reject targets that mix both height
  datums. Prefer absolute anchors over observer-relative bearing/range because
  they make it easier to change observer locations and rerun the same
  benchmark intent in another city or model.
- For flat-world hypothesis runs, adapt geodetic target anchors through the
  north-pole-centered azimuthal equidistant projection unless a later scenario
  explicitly declares another projection. Map `elevationKmMsl` to height along
  the flat world's local `up`.
- Use fixture-owned marker surfaces for visible/hittable markers such as
  `marker.red`, with the fixture owning anchor, shape, size, normal, material,
  and hit ids.
- Feed the camera algorithm with referenced data:
  EPSG 7030 WGS84 semi-major axis and inverse flattening for first globe
  benchmarks, San Jose default observer coordinates, the benchmark world's
  declared flat axes and lateral boundary metadata, the selected source
  adapter's Sun direction or finite Sun position, and the review artifact
  FOV/aspect/grid settings.
- Add canonical post-pipeline display consumers:
  - spectral radiance to CIE XYZ
  - XYZ to linear sRGB
  - display RGB conversion for image pixels with explicit clamp/gamma/output
    encoding policy
  - optional fixed exposure for visual artifacts, outside the physical
    transport stages
- Add a small image artifact writer that converts benchmark probe grids or sky
  patches into deterministic pixels. The image writer consumes completed
  reference output plus display settings; it must not feed exposure, clamping,
  gamma, or image scaling back into transport diagnostics.
- Tighten the first accurate atmosphere model before chasing renderer parity:
  WGS84 globe geometry, ellipsoid-relative clear-air height, real-Sun spectral
  irradiance, Rayleigh coefficients from a sourced model, named aerosol/Mie
  defaults, optional ozone as a named variant, and diagnostics for every model
  assumption that is still approximate.
- Extend the CLI to run benchmark scenario files and probe subsets, producing:
  - deterministic JSON diagnostics
  - Markdown review reports
  - SVG or PNG visual artifacts for sky patches, gradients, and swatches
  - compact terminal summaries for iteration
- Add benchmark metadata:
  - scenario id, world-set id, camera id, probe id, source date/time if any
  - physical/hypothesis labels
  - warnings for flat lateral-boundary dependencies, direct-light
    unavailability, missing colorimetry data, or display-only exposure
- Add subjective review notes to generated reports without letting them become
  test oracles. Visual review should explain what looked plausible or wrong and
  point to physical/configuration changes to try next.

First benchmark probes:

- `midday.zenith`
- `midday.sideSky`
- `midday.horizon`
- `sunset.horizon`
- `towardSun.nearDisk`
- `midnight.zenith`
- `surface.nearGround`
- `surface.farGround`
- `marker.red`

Tests:

- Scenario loader rejects unknown world/camera/probe ids.
- Scenario loader materializes stable observer/ray data from camera-relative
  definitions.
- Coordinate-role tests prove that permanent target fixtures persist as
  geodetic anchors, observer-relative probes resolve through the selected
  local frame, and generated reference endpoints are emitted with frame
  metadata. App scene endpoints are deferred from this test slice.
- First-slice transform-core tests cover WGS84 derived constants,
  geodetic-to-ECEF pinned rows, ENU orthonormality, first ECEF-as-reference-globe
  frame metadata, flat north-pole azimuthal equidistant projection,
  observer/target resolution, `towardSun` source directions, pinhole basis/NDC
  rays, plumb-aligned zero roll, missing-`rollDeg` defaulting to `0`,
  clockwise clock-angle roll, and deterministic cache-key changes before the
  camera bridge consumes those transforms.
- Derived-transform cache tests prove that cache keys change when observer,
  target, projection, datum, time, lens, orientation, or frame metadata changes;
  cache hits reproduce the same generated transforms; and cached diagnostics do
  not replace source geodetic target or camera facts.
- Reference-proof scope tests prove the benchmark world/camera/transform
  modules have no React, Three.js, DOM, renderer, shader, or browser-capture
  dependency.
- Globe camera tests cover local east/north/up basis construction, including
  orthonormality and a pinned San Jose observer row.
- Flat camera tests prove that the adapter uses the world-declared local frame
  rather than hidden globe/geodetic assumptions.
- Azimuth/elevation tests pin north, east, and zenith directions; pinhole tests
  pin center and symmetric NDC rays.
- `towardSun` camera tests use the selected source adapter and report direct
  light unavailability instead of inventing fallback illumination.
- Target tests prove geodetic `elevationKmMsl` anchors materialize in WGS84
  globe worlds and in flat worlds through the default north-pole-centered
  azimuthal equidistant projection.
- Target validation rejects mixed `elevationKmMsl` and
  `distanceFromEarthCenterKm` datums.
- Marker-surface tests prove that colored/hittable markers are fixture-owned
  surfaces, not loose camera look points with duplicated material facts.
- Globe benchmark scenarios use the WGS84-world/distant-Sun adapter and
  preserve ellipsoid-relative boundary diagnostics.
- Flat benchmark scenarios use the flat-world/local-Sun adapter and expose any
  named lateral boundary or no-direct-light dependency.
- Post-pipeline color conversion is deterministic and does not feed exposure
  or tone mapping back into physical radiance.
- Image artifact tests prove known linear RGB/display RGB values map to
  expected pixel bytes and that display clamping/gamma/exposure choices do not
  mutate reference radiance, XYZ, or linear RGB diagnostics.
- Atmosphere-model tests prove sourced Earth-like defaults are selected by
  named world sets and that any missing aerosol/ozone/geoid assumptions are
  explicit diagnostics rather than hidden tuning knobs.
- CLI benchmark runs write JSON, Markdown, and visual artifacts with stable
  scenario/probe ids and diagnostic summaries.
- A vacuum benchmark gives black sky and predictable direct surface response.
- The first Earth-like daytime sky benchmark produces nonzero sky radiance and
  reports component diagnostics, without treating the subjective color as a
  physical known answer.

Open questions before implementation:

- Which CIE table source and redistribution path becomes canonical for checked
  benchmark artifacts?
- Which wavelength grid is the first benchmark default: `380-780 nm / 10 nm`,
  `380-780 nm / 20 nm`, or a smaller selected visible grid?
- Should the first benchmark use blackbody-shaped Sun samples or imported
  spectral irradiance data?
- Which clear-day aerosol/Mie coefficients and phase parameter should be the
  benchmark default?
- Is approximate Chappuis-band ozone part of the first benchmark world, or a
  named optional world variant?
- Which exact pixel artifact format should be first for review: dependency-free
  PPM, SVG rectangles, PNG through an existing dependency, or all of the above
  as layered outputs?
- What output encoding policy should convert display RGB to pixels: linear
  bytes for numeric inspection, sRGB gamma-encoded bytes for visual inspection,
  or both with clear labels?
- What exact globe camera/date/time should be the first canonical Earth
  daylight scene?
- What exact `frameId` values and metadata fields should identify the first
  globe and flat reference model-frame adapters?
- Which `verticalFovDeg`, aspect, and NDC patch layout should become the first
  committed benchmark artifact convention?
- After CPU reference camera benchmarks are trusted, which deferred
  browser/Three.js parity row should pin the same clockwise clock-angle
  `rollDeg` convention?
- Should Phase 6A introduce a real geoid/terrain sea-level datum, or keep the
  explicit `wgs84-ellipsoid-as-msl` approximation until terrain data enters the
  benchmark harness?
- What flat lateral boundary should `flat.hypothesis.localPatch` use, and is
  it a slab, dome, cylinder, or named local patch?
- Should `flat.appDefaults.localSun` be a compatibility benchmark only, or can
  it also seed a physically labeled hypothesis variant?
- What fixed exposure or tone-map policy makes visual artifacts inspectable
  while keeping physical radiance diagnostics unchanged?
- Which generated artifacts should be checked in, and which should stay under
  `tmp/` as reproducible evidence?

## Phase 7: Shader Parity Harness

Status: planned.

Prerequisite: Phase 6A benchmark world and camera harness has at least one
globe sky, one globe surface, one flat sky, and one flat surface scenario with
deterministic JSON and visual artifacts.

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

1. Create `scripts/flat/atmosphere/reference` and empty test fixtures.
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
14. Write Phase 6A benchmark world, camera, scenario-loader, and post-pipeline
    color/report tests.
15. Implement Phase 6A until the CLI can generate deterministic benchmark
    JSON, Markdown, and visual artifacts for globe and flat scenarios.
16. Write Phase 7 shader-parity probes using the trusted CPU reference and
    benchmark scenarios.
17. Implement shader/debug hooks until parity is measurable.
18. Decide whether shader parity and approximation work now needs a dedicated
    shader-specific design document.
19. Use the reference output to decide which current shader/display bridges to
    replace first.

## Acceptance Criteria

- The CPU reference can compute one globe sky ray, one globe surface ray, one
  flat sky ray, and one flat surface ray from physical inputs.
- The same integrator code runs for globe and flat configurations.
- The reference output includes spectral radiance, XYZ, linear RGB, and optical
  diagnostics.
- The CLI can generate deterministic benchmark JSON, Markdown, and visual
  artifacts for named globe and flat world/camera/probe scenarios.
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
- [Reference Code Design](reference/code_design.md)
- [Reference Test Design](reference/test_design.md)
- [Reference Plan](reference/plan.md)
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
