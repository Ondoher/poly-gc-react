# Production Code Architecture And POC Review

Date: July 9, 2026

Scope: this review compares the current production code under
`shared/algorithm32/production/` with the Algorithm32 production design docs
and the accepted reconciliation POC under
`scripts/flat/reconciliation/POC/src/`. It is a static implementation review,
not a new parity run.

## Summary

The CPU/reference side fits the current design well. `Reference` and
`SpectralCalculator` preserve the reconciliation owner-query transport shape:
geometry resolves the view ray, the calculator builds endpoint/trapezoid
samples, source/geometry/atmosphere owners provide the physical facts, and
optional `IncidentRadianceSampling` is supplied per operation. The concrete
atmosphere, geometry, source, and cache families also look like faithful POC
promotions in the areas already implemented.

The shader/runtime side now fits the intended ownership split at the setup
assembly boundary. Given a configured model whose abstraction instances expose
shader hooks, `ShaderBuilder` can synthesize the descriptor, ask the light
source to create the source-owned cache, build that cache, collect
geometry/atmosphere/light/cache/Color contributions from their owners, add the
core transport contribution, prepare the cache texture resource, and install a
composer pass. Explicit low-level descriptor/contribution fixtures still work
as test support.

The remaining product/runtime gaps are no longer about whether the facade can
reach assembly, whether required bindings fail loudly, or whether cache
descriptor facts and uploaded payloads share one owner. They are about
deferred browser/readback parity for the ray-length scene input path,
wavelength unit spelling, and real app integration proof.

Treat the unresolved findings below as blockers before claiming full
production shader/runtime correctness against the reconciliation POC; the
browser/readback blocker is intentionally assigned to real app integration.

## Current Implemented State

- `Algorithm32.setupShader(...)` delegates to `ShaderBuilder.build(...)` with
  the setup request and facade config
  (`shared/algorithm32/production/Algorithm32.js:103`).
- `ShaderBuilder._createBuildContext(...)` now creates automatic setup context
  when low-level assembly inputs are absent and the configured model exposes
  the required owner shader hooks
  (`shared/algorithm32/production/implementation/ShaderBuilder.js:252`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:291`).
- During that automatic path, `ShaderBuilder` asks the configured light source
  to create the incident-radiance cache, builds it with `SpectralCalculator`
  and `buildIncidentRadianceCache(...)`, and exposes the cache build on the
  shader build result
  (`shared/algorithm32/production/implementation/ShaderBuilder.js:306`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:144`).
- Cache instances now provide their own shader payload and shader contribution
  surfaces
  (`shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js:186`,
  `shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js:242`,
  `shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js:193`,
  `shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js:253`).
- Cache instances now also supply the cache descriptor used during descriptor
  synthesis, while light sources only create the concrete cache family and
  advertise policy-level cache intent
  (`shared/algorithm32/production/light-sources/DistantSunIncidentRadianceCache.js:69`,
  `shared/algorithm32/production/light-sources/LocalSunIncidentRadianceCache.js:56`,
  `shared/algorithm32/production/light-sources/DistantSunLightSource.js:88`,
  `shared/algorithm32/production/light-sources/LocalSunLightSource.js:99`).
- `ShaderBuilder._collectContributions(...)` now collects owner-provided
  contributions from geometry, atmosphere, light source, source-created cache,
  the core transport provider, and Color
  (`shared/algorithm32/production/implementation/ShaderBuilder.js:366`).
- `Algorithm32Transport` owns the core transport main-symbol inventory and
  dispatches transport shader contribution creation by active geometry
  descriptor
  (`shared/algorithm32/production/transport/Algorithm32Transport.js`).
- `ShaderBuilder` owns the mechanical runtime initial-state shader
  contribution and no longer delegates that to a shader-folder factory
  (`shared/algorithm32/production/implementation/ShaderBuilder.js`).
- Geometry, atmosphere, light-source, incident-cache, and transport shader
  helper code has moved out of the old aggregate profile files into
  owner-local private methods or file-local helpers. The old aggregate and
  shader contribution factories now live only under
  `shared/algorithm32/production/quarantine/` for later deletion.
- `ShaderBuilder` now validates required binding availability before creating
  the runtime pass: required binding values must be non-nullish, while
  required uniforms may also be satisfied by owner-provided uniform defaults
  (`shared/algorithm32/production/implementation/ShaderBuilder.js:475`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:558`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:572`).
- `ShaderBuilder` validates cache-owned descriptor facts against supplied
  cache texture payload descriptors before resource creation and pass
  installation
  (`shared/algorithm32/production/implementation/ShaderBuilder.js:471`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:590`,
  `shared/algorithm32/production/implementation/ShaderBuilder.js:781`).
- `SceneInputCapture` now promotes the POC browser-page renderer-distance
  capture into a reusable composer-compatible production pass: it renders the
  live Three scene with override materials into packed depth and explicit
  hit-mask render targets, then exposes those textures as runtime binding
  values
  (`shared/algorithm32/production/implementation/SceneInputCapture.js`).
- `ShaderBuilder` creates `SceneInputCapture` when an installed assembled
  runtime shader needs `runtime.sceneDepthTexture` or
  `runtime.sceneHitTexture` and no caller-supplied binding exists, then
  installs that capture pass before the fullscreen Algorithm32 pass; those
  bindings now fail loudly before pass installation if capture cannot be
  created
  (`shared/algorithm32/production/implementation/ShaderBuilder.js`).
- `ShaderRuntimePass.render(...)` consumes the preceding capture pass textures
  by binding `uSceneDepthTexture` and `uSceneHitTexture`, and continues to
  bind composer scene color from the read buffer
  (`shared/algorithm32/production/implementation/ShaderRuntimePass.js`).

## Findings

### High: Ray-length scene input parity is deferred to app integration

Evidence:

- Production now creates renderer-produced depth and hit-mask textures through
  `SceneInputCapture`; the depth texture encodes ray length normalized by
  `sceneDepthMaxMeters`, and geometry shader contributions decode it back to
  meters before resolving path bounds.
- The POC browser-page harness also collects object-hit counts and object
  diagnostics through its Raycaster capture path, but those are parity/debug
  facts rather than inputs the atmosphere shader needs
  (`scripts/flat/reconciliation/POC/browser-page/runner.js:4469`).
- Production has not yet promoted browser/readback parity fixtures proving
  the new reusable capture path against `Reference` plus `Color`; that proof
  should wait for real app composer integration so readback covers the actual
  scene color, capture, and output surfaces.

Design impact:

The accepted runtime architecture is a live Three scene rendered into
scene-color plus explicit ray-length/depth and hit-mask state, followed by an
Algorithm32 fullscreen pass. The Algorithm32 transport path does not require
object/material IDs or hit-pixel color; it needs the ray length and hit mask.
The final Color/display composition does need the renderer-produced scene
color for the hit pixel so it can combine endpoint color with atmospheric
path radiance/transmittance. Production still needs parity evidence for the
promoted ray-length capture, scene-color composition, and final selected
pixels, but that evidence is an integration gate rather than a setup-assembly
design blocker.

POC correctness impact:

The POC shader factories sample the same scene color/depth/hit textures and
the browser parity probes provide those buffers before comparing selected
pixels (`scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js:85`,
`scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js:158`,
`scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js:81`,
`scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js:154`).
The promoted production capture pass mirrors the POC browser-page
renderer-distance path, not the Raycaster diagnostic object inventory.

Recommended resolution:

Defer browser/readback parity coverage until real app composer integration can
exercise scene color, reusable ray-length/depth and hit capture,
geometry-decoded path bounds, and selected-pixel output through the production
render loop. The decision is now recorded that production does not need a
shader-facing object/material ID texture for the atmosphere algorithm; the
final Color/display path still consumes renderer-produced scene color.

### Resolved: POC endpoint display scales are intentionally excluded

Evidence:

- The POC factories include endpoint radiance scale and camera-distance scale
  uniforms
  (`scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js:91`,
  `scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js:87`).
- Their display composition applies those knobs only to endpoint scene color:
  `endpointLinearSrgb * transmittanceRgb * uEndpointRadianceScale *
  endpointCameraDistanceScale`
  (`scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js:754`,
  `scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js:766`).
- The camera-distance scale computes a squared distance boost over an arbitrary
  reference distance, then clamps it between caller-provided min/max values
  (`scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js:735`,
  `scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js:747`).
- The POC browser/runner paths use values such as `5200`, `1500`, `1`, or `0`
  for `endpointRadianceScale`, which identifies the controls as visual
  diagnostic/tuning residue rather than sourced transport or Color facts
  (`scripts/flat/reconciliation/POC/src/scenes/planetSphereSceneFacts.js:19`,
  `scripts/flat/reconciliation/POC/src/runners/m3SubjectiveSouthernFranceDaylightStack.js:277`,
  `scripts/flat/reconciliation/POC/src/runners/m4FlatGeometryGpuSelectedRayParityProbe.js:527`).

Production decision:

Do not promote `runtime.endpointRadianceScale` or
`runtime.endpointCameraDistanceScale.*` into production. The production
composition remains the physically interpretable display form:
`skyLinearSrgb + endpointLinearSrgb * transmittanceRgb`. Any future artistic
or application display controls must be introduced as explicit app/Color
policy with source or product rationale, not as hidden Algorithm32 parity
requirements.

POC correctness impact:

Production parity targets must exclude POC records that depend on endpoint
radiance or camera-distance boost tuning, or normalize those controls to their
neutral behavior before comparison.

### Resolved: Spectral wavelength unit spelling was inconsistent across promoted code

Evidence:

- Production `WavelengthUnits` now declares plural `"nanometers"` and
  `"micrometers"` only.
- Canonical spectral channels now expose `wavelength` and
  `wavelengthBinWidth` unit-bearing packets instead of
  `wavelengthNanometers` and `wavelengthBinWidthNanometers`.
- `Algorithm32`, `SpectralModel`, and `WavelengthMath` fail loudly when a
  wavelength packet uses singular or unknown unit spellings.
- Active source/cache/calculator boundaries no longer accept
  `wavelengthsNanometers`; hot-path scalar nanometer names remain only as
  local derived values after packet validation.

Design impact:

The design requires explicit unit-bearing packets at durable/API boundaries.
This is now implemented for promoted wavelength packets. Existing
unit-suffixed meter/radian transport names are still treated as canonicalized
internal scalar facts unless they are exposed as durable configuration fields
in a later API cleanup.

Resolution:

Use plural unit strings in unit-bearing packets and keep wavelength property
names unit-neutral at active durable/configuration boundaries.

## What Fits

- The production `Reference`/`SpectralCalculator` flow is architecturally
  aligned with the reconciliation owner-query algorithm and keeps CPU work in
  the validation/oracle role.
- The concrete source, atmosphere, geometry, and cache families are broadly
  faithful POC promotions for the implemented first slice.
- The shader assembler, compatibility validator, texture builder, automatic
  configured-model contribution collection, source-created cache path, core
  transport provider, and runtime pass installation machinery are structurally
  consistent with the POC for the implemented setup slice.
- The former dual-purpose distant spherical and local flat aggregate shader
  factories are quarantine-only archival files; active geometry, atmosphere,
  light-source, source-created cache, and core transport contribution code now
  lives with the relevant owner implementations.
- Cache descriptor facts and texture payload facts now come from the cache
  layout and are checked together before binding resources.
- `BrunetonColorDisplayModel` correctly moves display conversion into the
  Color/display owner instead of leaving it as a `Reference` concern.

## Recommended Resolution Order

1. Carry browser/readback parity into the real app integration gate for
   renderer-produced scene color, ray-length/depth capture, hit mask, and
   selected-pixel output.
2. Continue the broader unit-neutral configuration migration for non-spectral
   distance and angle configuration fields when those APIs are next touched.
