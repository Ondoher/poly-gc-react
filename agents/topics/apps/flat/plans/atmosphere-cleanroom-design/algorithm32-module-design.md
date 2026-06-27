# Algorithm32 Module Design

This document is the working design space for packaging Algorithm32 into
reusable code. The goal is to turn the cleanroom algorithm from experiment 032
into a module that can serve shader validation, reference artifacts, and
application-side texture/cache rebuilds.

Algorithm32 names the current cleanroom baseline recorded in
[Experiment 032 Algorithm](experiment-032-algorithm.md). The module may support
named atmosphere presets and cache-building workflows, but the baseline profile
must remain explicit and reproducible.

## Purpose

Package Algorithm32 as one source of truth for:

- direct reference traces used to validate shader and cache outputs;
- finite object-segment atmospheric transfer;
- texture/cache data generation for app and shader use;
- deterministic diagnostics and provenance for generated artifacts;
- named atmosphere presets that map app-friendly choices to explicit physical
  parameters.

The module should not recreate the retired one-stage-per-calculation public
pipeline. It should expose coarse public operations backed by small pure
transport kernels.

This module is the intended end product of the cleanroom "reference" effort.
The reference is not a separate renderer or a permanent script-only pipeline;
it is the reusable Algorithm32 module plus its cache-building and parity
surfaces.

## Non-Goals

- It is not a React, Three.js, DOM, or renderer module.
- It is not a PNG/report generator, though artifact builders may consume its
  outputs.
- It is not a screenshot-tuning layer.
- It does not hide atmosphere changes inside RGB tint, exposure, or display
  constants.
- It does not make clouds, ground coupling, local-Sun behavior, or flat
  long-sightline behavior implicit parts of the baseline profile.
- It does not implement non-Earth bodies in the current milestone.

## Long-Term Aspiration

The module should leave room for future non-Earth atmosphere scenes, including
a possible Mars scene. This is aspirational, not current scope. The practical
design pressure is to keep planet-specific facts explicit in profile,
geometry, source, and cache-plan records rather than baking Earth assumptions
into core transport loops.

A future Mars profile would need its own source-backed constants, validation
strategy, and likely different density/species/aerosol assumptions. It should
not be treated as a preset rename of the Earth baseline. The current work only
needs to preserve the boundary that would make that later profile possible.

## Package Shape

The implementation can start inside this repo, but should be structured as if
it could become a standalone package.

Production placement:

- `agents/topics/apps/flat/algorithm32/` owns production Algorithm32
  documentation.
- `shared/algorithm32/` owns the shared production implementation.
- This cleanroom design document remains the working design/evidence source
  until durable contracts are promoted into the production documentation home.

```text
algorithm32-core
  source-backed spectral transport kernels and direct trace APIs

algorithm32-profiles
  named baseline and app-facing atmosphere presets

algorithm32-cache-builder
  cache/texture generation over explicit coordinate grids

algorithm32-parity
  shader/cache comparison fixtures and error reports

app integration
  configuration UI, progress, cancellation, workers/GPU dispatch,
  texture upload, and renderer binding
```

The package names above are conceptual boundaries. The first implementation can
use local folders as long as those boundaries remain clear.

Reference artifacts, CLI reports, and experiment images should depend on these
boundaries. They should not become competing implementations of Algorithm32.

## Public API Draft

The public API should be plain-data first. These names are provisional and are
intended for discussion.

```js
createAlgorithm32Profile(profileIdOrConfig) -> Algorithm32Profile

traceSkyRay({
  profile,
  observer,
  viewDirection,
  sun,
  wavelengthsNm,
  numerical
}) -> Algorithm32SpectralRadiancePacket

traceAtmosphereSegment({
  profile,
  cameraPoint,
  targetPoint,
  sun,
  wavelengthsNm,
  numerical
}) -> Algorithm32AtmosphericTransferPacket

applyAtmosphereToObjectRadiance({
  transfer,
  objectLeavingRadianceByWavelength
}) -> Algorithm32SpectralRadiancePacket

buildAtmosphereCache({
  profile,
  geometry,
  sun,
  cacheSpec,
  wavelengthsNm,
  numerical,
  onProgress,
  signal
}) -> Algorithm32CacheBuildResult

compareShaderSample({
  reference,
  shader,
  comparisonPolicy
}) -> Algorithm32ParityResult
```

Direct tracing should be usable without a cache. Cache building should be a
consumer of the same kernels or trace functions, not a second implementation.

The cache contract should be explicit enough that callers can either ask
Algorithm32 to build texture data directly or ask it to describe the work that
another worker/GPU layer must perform:

```js
createAlgorithm32Context({
  geometry,
  atmosphereProfile,
  source,
  spectralPolicy,
  numericalPolicy
}) -> {
  traceRay,
  traceSegment,
  describeCachePlan,
  buildCache,
  validateCacheSample
}
```

`describeCachePlan()` is a first-class API. It should return the canonical
texture/cache contract for the current geometry, source, profile, spectral
policy, and numerical policy without requiring the caller to know internal
coordinate choices:

```js
{
  cacheKey,
  geometryKind,
  sourceKind,
  textures: [
    {
      id,
      dimensions,
      coordinates,
      storedQuantities,
      channelPolicy,
      units,
      interpolationPolicy,
      sourceDependencies
    }
  ],
  diagnostics
}
```

`buildCache()` can then return concrete CPU-built texture data when that is the
chosen path:

```js
{
  cacheKey,
  textures: [
    {
      id,
      width,
      height,
      depth,
      format,
      data,
      diagnostics
    }
  ]
}
```

Algorithm32 owns the cache meanings: coordinate definitions, stored physical
quantities, cache-key inputs, units, source/geometry/profile assumptions, and
validation samples. The app and renderer own scheduling, progress,
cancellation, GPU upload, texture lifetime, shader material binding, and
replacing stale caches after a configuration change.

This keeps distant and local Sun support in one interface without pretending
they share one texture layout. A spherical/distant source may describe
Bruneton-style angular lookup textures. A flat/local source may describe
view-transmittance and source-field caches keyed by flat altitude, segment
distance/end altitude, and source geometry, or may initially describe a direct
per-frame evaluation path with no cache for path radiance.

Keep the Algorithm32 core as a transport-oriented kernel. Prefer offloading
source-specific differences to Sun/source objects, geometry helpers, and
cache-plan adapters instead of adding per-source branches through the
scattering loops. The core should ask for source samples and cache lookups; it
should not own local-Sun orbit logic, inverse-distance brightness policy,
finite-source visibility rules, or texture-layout decisions beyond the common
contracts it consumes.
Algorithm32's center of gravity should remain the interaction between an
incident light field and the atmosphere: density, optical depth,
transmittance, phase functions, path radiance, and cacheable approximations of
that transport. Source objects define the light field; Algorithm32 transports
it through the atmosphere.

Flat renderer-specific ray limits should enter Algorithm32 only as the
renderer-provided view segment length for that trace. The `atmosflat32` POC now
models the round-equivalent artificial cap as `skyViewRayLengthLimit` owned by
the observer skydome renderer, while flat source transmittance uses
`atmosphereGeometry` and the configured top plane. Scene renderers should pass
their own object/scene segment lengths instead of inheriting the skydome cap.

The first implementation milestone is a no-behavior-change source abstraction.
Implement only the default `distant-directional-sun` adapter first and prove
that the accepted experiment 032 / Figure 1 sky-dome path still matches the
current Algorithm32 output before adding any local Sun adapter. This adapter
should preserve the existing constant Sun direction, infinite source distance,
spectral solar irradiance, sample-to-top-atmosphere transmittance meaning,
no-direct-solar-disc camera policy, and distant-Sun second-order cache
behavior.

This milestone should run as a new focused experimental lane, not as an
extension of the original `bruneton_start_fresh` experiment sequence that
produced Algorithm32. The new lane may borrow the sky-dome generation mechanics
from `scripts/flat/experimental/bruneton-start-fresh.js`, including the
Figure 1 dome sampling, display conversion, and comparison packaging needed to
prove no behavior change. It should not inherit the original lane's numbered
artifact history, exploratory step switches, rejected paths, or unrelated
reporting baggage. Treat the borrowed dome renderer as a fixture/generator for
the source-abstraction refactor, with scripts under
`scripts/flat/atmosflat32/` and new append-only artifacts under
`tmp/atmosphere/atmosflat32/`.

Status update: the original no-behavior-change milestone is accepted by
`tmp/atmosphere/atmosflat32/002-distant-source-abstraction-baseline/`, and the
latest regression is accepted by
`tmp/atmosphere/atmosflat32/019-distant-source-abstraction-baseline/`. The POC
runner keeps Algorithm32 behind a default `distant-directional-sun` source
object/configuration and, after adding calibrated finite local-source support,
a shared angular sky image loop, and renderer-scoped flat sky view ray limits,
still reproduces the four step-032 Figure 1 domes with exact PNG byte parity
and zero selected-ray spectral deltas. `017` remains the previous calibrated
observer-sky regression and `015` remains the previous artificial-cap
regression. Future local-source cache work should extend the source
object/cache-plan boundary from this baseline instead of adding local-Sun
branches directly through the transport loops.

The first local-source placement fixture is accepted by
`tmp/atmosphere/atmosflat32/005-flat-app-closest-san-jose-position/`. It uses
app configuration only for San Jose and the default false Sun, then derives
flat projection, closest approach, finite point-source direction/distance, and
apparent size inside the POC runner. It includes top-down map and sky-marker
PNGs. This is source-placement evidence for the source object boundary, not a
local Algorithm32 scattering acceptance.

The rotation-offset first-order observer sky fixture is accepted by
`tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes/`. It reuses the
same `flat-local-point-sun` source placement and outputs five pure Algorithm32
flat/local first-order observer angular sky PNGs at `0`, `45`, `90`, `135`,
and `180` degrees from closest San Jose approach. The image loop matches the
round distant-Sun dome method. Flat/local transport uses flat altitude/density
on z and validates source kind, source sample kind, finite-distance policy,
and visibility path from the `atmosphereGeometry` configuration. A
round-equivalent artificial cap centered at `[0, 0, -6360000]` meters with
radius `6420000` meters and observer-level footprint radius `875.656645 km`
is now recorded as a separate skydome-renderer `skyViewRayLengthLimit`; it is
not part of source transmittance or scene-renderer distance. Source
transmittance uses the configured flat top atmosphere plane and finite source
distance. Transport brightness is calibrated so closest approach equals `1x`
distant-Sun incident scale, replacing app raw `solarIrradianceScale: 58` with
calibrated transport `solarIrradianceScale: 1.1071748923354825`; 180 degrees
falls to `0.12922172063575063` and remains lit because the source stays above
the flat horizon. Direct solar-disc camera radiance, ground bounce, and
local-source second-order cache behavior remain deferred. `018` supersedes
`016`, `014`, `012`, `010`, and rejected `011`.

## Core Types

### `Algorithm32Profile`

```js
{
  id,
  label,
  algorithm: "algorithm32",
  assumptions: {
    geometryModel,
    ozonePolicy,
    groundCouplingPolicy,
    directSolarDiscCameraPolicy,
    scatteringOrders
  },
  atmosphere: {
    bottomRadiusMeters,
    topRadiusMeters,
    rayleighScaleHeightMeters,
    mieScaleHeightMeters,
    rayleighCoefficientScale,
    aerosolAngstromAlpha,
    aerosolAngstromBeta,
    aerosolSingleScatteringAlbedo,
    miePhaseG
  },
  spectral: {
    wavelengthsNm,
    solarIrradianceByWavelength,
    sourceTable,
    integrationPolicy
  },
  numericalDefaults: {
    viewSampleCount,
    sunTransmittanceSampleCount,
    secondOrderIncomingDirectionCount,
    secondOrderAltitudeBinCount
  },
  provenance: [
    {
      id,
      kind,
      locator,
      usedFor
    }
  ]
}
```

The baseline profile should reproduce experiment 032. App presets may override
atmosphere parameters through named profiles, but every override must carry
units, provenance, and cache-key participation.

### `Algorithm32Sun`

`Algorithm32Sun` names the canonical serializable Sun descriptor. The runtime
Sun configuration does not have to be data-only: it may be an object that owns
canonicalized inputs, derived values, and methods such as
`sourceSamplesAt(position, geometry)`. Persisted artifacts, cache keys, and
app configuration records should store the plain descriptor data needed to
recreate that runtime object.

```js
{
  kind: "distant-directional-sun" | "local-finite-sun",
  direction,
  position,
  radiusMeters,
  spectralIrradianceByWavelength,
  spectralRadianceByWavelength,
  luminanceFalloffPolicy,
  angularEmissionProfile,
  provenance
}
```

The baseline Algorithm32 profile uses a distant directional Sun. Local finite
Sun support is a model variant and should be explicit in the `kind`.
Some flat-model local-Sun variants may also assert a flashlight or spotlight
emission profile. Represent that as source-owned angular emission data, not as
an atmosphere branch: beam axis, cone half-angle, edge softness/falloff,
spectral scaling, and energy-conservation policy should participate in cache
keys and source samples. Algorithm32 should receive only the resulting
position-dependent incident light field and transport it through the active
atmosphere profile.

A first serializable shape can be:

```js
{
  angularEmissionProfile: {
    kind: "omnidirectional" | "spotlight",
    beamAxisPolicy:
      | "configured-vector"
      | "toward-flat-origin"
      | "toward-sub-source-point"
      | "toward-observer-diagnostic",
    beamAxis,
    coneHalfAngleDegrees,
    edgeSoftnessDegrees,
    falloff: "hard-cutoff" | "smoothstep-edge" | "cosine-power",
    cosinePower,
    spectralScale,
    energyPolicy: "peak-fixed" | "power-conserving"
  }
}
```

The source object should resolve the beam axis for each sample context,
compute the source-to-sample emission angle, and multiply an
`angularEmissionScale` into `spectralIncidentScaleByWavelength`. Diagnostics
should expose the resolved axis, angle, scale, and inside/edge/outside
classification so artifacts can distinguish source emission from atmospheric
transport.

### `Algorithm32SpectralRadiancePacket`

```js
{
  kind: "algorithm32-spectral-radiance",
  wavelengthsNm,
  radianceByWavelength,
  components: {
    firstOrderRayleighByWavelength,
    firstOrderMieByWavelength,
    secondOrderByWavelength,
    directSolarDiscByWavelength,
    surfaceViewAttenuatedByWavelength
  },
  diagnostics: {
    profileId,
    sunId,
    geometry,
    sampleCounts,
    omittedEffects,
    numericalPolicy,
    provenance
  }
}
```

Baseline sky traces should keep `directSolarDiscByWavelength` and
`surfaceViewAttenuatedByWavelength` as zero or omitted-with-diagnostic values,
because experiment 032 deliberately omits those contributions.

### `Algorithm32AtmosphericTransferPacket`

```js
{
  kind: "algorithm32-atmospheric-transfer",
  wavelengthsNm,
  segment: {
    cameraPoint,
    targetPoint,
    lengthMeters
  },
  transmittanceByWavelength,
  pathRadianceByWavelength,
  components: {
    rayleighPathRadianceByWavelength,
    miePathRadianceByWavelength,
    secondOrderPathRadianceByWavelength
  },
  diagnostics
}
```

This packet is the object-color contract. The atmosphere owns
`transmittanceByWavelength` and `pathRadianceByWavelength`; the caller owns
`objectLeavingRadianceByWavelength`.

### `Algorithm32CacheSpec`

```js
{
  id,
  kind:
    | "spherical-distant-sun-lut"
    | "flat-local-sun-config-cache"
    | "object-segment-aerial-perspective-cache",
  resolution,
  coordinates: [
    {
      name,
      range,
      mapping,
      units
    }
  ],
  storedQuantities: [
    "transmittance",
    "pathRadiance",
    "skyRadiance",
    "irradiance"
  ],
  channelPolicy,
  interpolationPolicy,
  cacheKeyPolicy
}
```

The cache spec owns texture coordinate meaning. Shader code and cache builders
must not each invent their own coordinate mapping.

Flat production shader support requires a separate flat geometry/cache
coordinate contract rather than reusing spherical Bruneton texture coordinates.
See [Production Flat Shader Differences](production-flat-shader-differences.md)
for the required flat altitude, boundary, optical-length, Sun-transmittance,
cache-key, and validation differences.

### `Algorithm32CacheBuildResult`

```js
{
  kind: "algorithm32-cache-build-result",
  profileId,
  cacheSpecId,
  cacheKey,
  textures: [
    {
      id,
      quantity,
      dimensions,
      channelPolicy,
      data,
      units
    }
  ],
  diagnostics: {
    buildTimeMs,
    sampleCounts,
    progressEvents,
    convergence,
    provenance
  }
}
```

The app may turn `textures[].data` into GPU textures. The core cache builder
should not depend on a renderer.

## Presets

From the app standpoint, users will probably select named presets rather than
raw parameters. The module should therefore separate preset identity from raw
transport code.

```js
listAlgorithm32Profiles() -> Algorithm32ProfileSummary[]
createAlgorithm32Profile("algorithm32-baseline-clear-sky")
createAlgorithm32Profile("algorithm32-hazy")
createAlgorithm32Profile("algorithm32-dusty")
```

Each preset should declare:

- user-facing label;
- parameter values and units;
- source/provenance for each value or preset family;
- which cache keys it affects;
- whether it is a baseline, app preset, diagnostic preset, or experimental
  preset.

Raw parameter editing can exist for research/debug tools, but the normal app
flow should use presets.

## Shader Validation Flow

Algorithm32 should validate the shader at three boundaries:

```text
direct trace -> cache builder -> shader sampling/composition
```

For each parity case:

1. Run a direct Algorithm32 trace for the selected sky ray or object segment.
2. Build or sample the relevant cache at the same physical coordinates.
3. Capture the shader result before final display tone mapping when possible.
4. Compare spectral values when available, otherwise compare the documented
   reduced-channel or display-space approximation.
5. Report whether differences come from cache coordinate mapping,
   interpolation, channel reduction, sample count, missing transport terms, or
   display conversion.

The direct trace is the oracle. The cache builder and shader are optimized
consumers.

## Shader Lab Scaffold

The first experimental browser scaffold lives at:

```text
scripts/flat/algorithm32-shader-lab/
```

Its initial purpose is only to prove the long-running Puppeteer control loop:
load a local page, reload it on command, collect browser-side JSON, and write a
screenshot/result artifact. It does not implement Algorithm32, Three.js scene
geometry, or production shader code yet.

The next design step is to keep the harness as the owner of browser lifecycle,
command dispatch, capture, and artifact writing, while browser pages own
rendering and shader diagnostics. Unit tests are not required for this
experimental scaffold.

The detailed build-up and validation plan lives in
[Algorithm32 Shader Lab Plan](algorithm32-shader-lab-plan.md).

## App Texture Rebuild Flow

For flat/local-Sun configurations, source-dependent textures should be rebuilt
when the user accepts a new configuration:

```text
configuration dialog
  -> canonical Algorithm32 profile + Sun config + cache spec
  -> cache key
  -> buildAtmosphereCache(...)
  -> progress/cancellation from app layer
  -> texture upload
  -> shader consumes cache
```

Rebuilds taking seconds are acceptable. Multi-second builds should expose
progress. If a newer configuration supersedes an in-progress build, the app
should cancel or discard the stale result.

## Open Interface Decisions

- Should the first implementation live under `scripts/flat`, `src/flat`, or a
  shared package-like folder?
- Should cache building run on CPU first, GPU first, or CPU reference plus GPU
  production in parallel?
- What is the first cache texture shape for flat/local-Sun aerial perspective?
- Which channel policy should the shader consume first: full spectral texture,
  three wavelength channels, XYZ, or linear RGB?
- How should finite local-Sun source samples be represented in cache keys?
- Which app presets are source-backed enough for first UI exposure?
- What is the accepted parity tolerance for shader output versus direct
  Algorithm32 traces?

## Existing Design Inputs

- [Experiment 032 Algorithm](experiment-032-algorithm.md) defines the current
  baseline algorithm, constants, equations, and algorithmic decisions.
- [Object Color Transport](object-color-transport.md) defines finite-segment
  atmospheric transfer for objects.
- [Environment Object Color Closeout](environment-object-color-closeout.md)
  records accepted object-color proof artifacts.
- [Reference To Shader Goal](reference-to-shader-goal.md) defines the
  end-state relationship between reference, cache builder, app, and shader.
- [Production Flat Shader Differences](production-flat-shader-differences.md)
  defines how the production shader/cache contract must change for flat
  geometry.
