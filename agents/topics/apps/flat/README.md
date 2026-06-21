# Flat App

Deployable Flat app documentation for the false-sky / sky-comparison project.

## Documents

- [Status](status.md)
- [POC Prompt](prompt.md)
- [ProjectionModel API Draft](projection-model-api.md)
- [Atmosphere Design](atmosphere-design.md)
- [Atmosphere Reset Research](plans/atmosphere_reset/research.md)
- [Atmosphere Reset Design](plans/atmosphere_reset/design.md)
- [Multiple-Scattering Reference Design](plans/atmosphere_reset/multiple_scattering_design.md)
- [Multiple-Scattering Plan](plans/atmosphere_reset/multiple_scattering_plan.md)
- [Reference README](plans/atmosphere_reset/reference/README.md)
- [Reference Stage Contracts](plans/atmosphere_reset/reference/stage_contracts.md)
- [Reference Code Design](plans/atmosphere_reset/reference/code_design.md)
- [Reference Test Design](plans/atmosphere_reset/reference/test_design.md)
- [Reference Test Plan](plans/atmosphere_reset/reference/test_plan.md)
- [Reference Plan](plans/atmosphere_reset/reference/plan.md)
- [Reference Status](plans/atmosphere_reset/reference/status.md)
- [Atmosphere Reset Plan](plans/atmosphere_reset/plan.md)
- [Atmosphere Rejected Ideas](atmosphere-rejected.md)
- [Terrain Data Options](terrain-data-options.md)
- [Plans](plans/README.md)
- [Decisions](decisions/README.md)

## Current Shape

Flat is a Polylith REMVC app with active `flat-simulation` and
`globe-simulation` page features. The flat-simulation feature owns the
counterfactual flat-model sky. The globe-simulation feature is the new
correct-geometry Sun/atmosphere calibration path.

Current implementation focus:

- The default route is `/flat/flat-simulation`.
- The globe-simulation shell is registered at `/flat/globe-simulation`.
- The default observer is San Jose, CA at `100 ft` elevation, using the
  observer/root camera. The north-pole bird's-eye camera remains an inspection
  preset, not the active default.
- The flat simulation renders projected Earth context, a hidden sky dome,
  stars/constellation overlays, a visible animated finite false sun, synthetic
  red mountain rectangles, a local floor patch, and a depth-aware atmosphere
  composer.
- The atmosphere composer is the active flat-simulation atmosphere owner. It renders solid
  scene color/depth offscreen, reconstructs camera rays, applies optical
  depth/transmittance and sun-driven Rayleigh/Mie single scattering, includes
  short sample-to-sun transmittance, and composites
  `sceneColor * transmittance + inScatteredLight`.
- The globe-simulation feature renders a real Three/R3F spherical calibration
  scene anchored on San Jose, with Sun-only celestial scope, fixed solar-noon
  Sun/Earth positioning, `23.43928 deg` Earth axial tilt, date-derived
  sidereal rotation, a standing-height camera above the `100 ft` San Jose
  surface point, a fixed calibration timestamp of
  `2026-06-13T13:07:44-07:00`, `spherical-shell` atmosphere geometry, a
  featureless matte green globe surface, shared synthetic red mountain markers,
  the 50 brightest northern-celestial-hemisphere stars from the shared POC star
  fixture with magnitude-derived relative flux, and pointer/touch look-around
  controls that rotate the standing camera in place.
- Globe atmosphere integration has reached Phase 4.4. The atmosphere source
  uses physical top-of-atmosphere solar irradiance, the globe surface and
  synthetic marker faces render as Lambertian radiometric surfaces, the solid
  render target stores linear half-float color, and the composer tone-maps the
  combined surface radiance plus atmospheric in-scattering through the shared
  display bridge.
- The earlier translucent visual atmosphere shell is intentionally removed so
  blue sky must come from the composer scattering pass. The current visual
  problem is not basic plumbing: the globe sky remains muted blue-gray, the
  horizon can look brown, and red marker surfaces can become pink where
  atmosphere airlight is added over them. The next atmosphere work should
  diagnose the spherical shader/display calibration before returning to flat
  tuning.
- Floor end-state: floor/terrain should be a lit physical surface whose albedo
  reacts to scene light sources first, then fades through the same atmosphere
  composer as mountains and other objects.
- Terrain is intentionally deferred until the fixed daytime sky calibration is
  understandable.

Key continuation docs:

- [Status](status.md): detailed current implementation history and next tasks.
- [Atmosphere Design](atmosphere-design.md): current atmosphere/light
  contract.
- [Atmosphere Reset Research](plans/atmosphere_reset/research.md): reset research note for the
  physical-constants-first atmosphere model, including physical properties,
  equations, simplifications, references, and pixel-color flow.
- [Atmosphere Reset Design](plans/atmosphere_reset/design.md): reset
  implementation contracts for the script-owned reference module, globe and flat
  model adapters, diagnostics, and shader parity boundary.
- [Multiple-Scattering Plan](plans/atmosphere_reset/multiple_scattering_plan.md):
  current comparison-first path for model-family reports, external numeric
  artifacts, and a sidecar order-by-order reference before any canonical
  higher-order transport change.
- [Reference Code Design](plans/atmosphere_reset/reference/code_design.md):
  focused contract for the slow spectral CPU truth engine.
- [Reference Stage Contracts](plans/atmosphere_reset/reference/stage_contracts.md):
  canonical packet input/output contracts for each CPU reference pipeline
  stage.
- [Reference Test Design](plans/atmosphere_reset/reference/test_design.md):
  high-level stage test matrix for the slow spectral CPU truth engine.
- [Reference Test Plan](plans/atmosphere_reset/reference/test_plan.md):
  actionable stage-test sequence and current fixture-backed test batches.
- [Reference Plan](plans/atmosphere_reset/reference/plan.md):
  focused script implementation plan for the slow spectral CPU truth engine.
- [Reference Status](plans/atmosphere_reset/reference/status.md): current
  status and next documentation step for the CPU truth engine.
- [Atmosphere Reset Plan](plans/atmosphere_reset/plan.md): test-first CPU
  spectral truth-oracle plan for globe and flat/local-Sun atmosphere tests.
- [Atmosphere Rejected Ideas](atmosphere-rejected.md): atmosphere approaches
  that should not be revisited during tuning.
- [Reality-Aligned Daytime Atmosphere Plan](plans/reality-aligned-daytime-atmosphere-plan.md):
  flat-model atmosphere comparison context.
- [Spherical Sun Atmosphere Plan](plans/spherical-sun-atmosphere-plan.md):
  globe-simulation calibration plan.
- [Terrain Data Options](terrain-data-options.md): terrain provider choice and
  first-pass terrain integration plan for after sky calibration.
