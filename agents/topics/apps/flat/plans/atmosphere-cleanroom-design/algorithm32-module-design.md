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

## Package Shape

The implementation can start inside this repo, but should be structured as if
it could become a standalone package.

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

```js
{
  kind: "distant-directional-sun" | "local-finite-sun",
  direction,
  position,
  radiusMeters,
  spectralIrradianceByWavelength,
  spectralRadianceByWavelength,
  luminanceFalloffPolicy,
  provenance
}
```

The baseline Algorithm32 profile uses a distant directional Sun. Local finite
Sun support is a model variant and should be explicit in the `kind`.

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
