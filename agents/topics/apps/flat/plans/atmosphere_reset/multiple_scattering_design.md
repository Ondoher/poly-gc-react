# Multiple-Scattering Reference Design

## Status

Potential future work.

Do not start this path only because one benchmark looks imperfect. Use it if
the single-scattering reference plus explicit approximation stages keep
accumulating compensatory terms until the model boundary becomes hard to trust.
The current near-term path remains:

- keep `integrateSingleScattering` as the direct first-order transport term
- rename/evolve the current diffuse-airlight approximation into
  `integrateDiffuseSkyAirlight`
- keep that diffuse-airlight term separate, bounded, diagnostic, and calibrated
  against stronger reference evidence

If `integrateDiffuseSkyAirlight` needs too many special cases for aerosol
regime, horizon rows, flat geometry, surface bounce, or sky-direction coupling,
promote a slow multiple-scattering reference mode rather than continuing to
patch the approximation.

## Purpose

The current reference answers the first-order question:

```text
sun -> atmosphere sample -> camera
```

A multiple-scattering reference would answer the higher-order question:

```text
sun -> sample A -> sample B -> camera
sun -> sky diffuse field -> sample -> camera
sun -> ground/ocean/cloud -> atmosphere -> camera
```

The goal would not be real-time rendering. The goal would be a slow,
source-backed truth-ish benchmark that can:

- validate high optical-depth horizon rows
- calibrate `integrateDiffuseSkyAirlight`
- expose where single scattering is only qualitative
- separate atmosphere transport errors from color/display or lower-frame
  surface-context errors
- provide future shader/app parity targets

## Physics Basis

Single scattering is valid when the direct source contribution dominates and
the probability of additional scattering is low enough to ignore. Near the
horizon, especially with aerosols, optical depth can become high:

- view transmittance can be low
- source transmittance can be low
- aerosol extinction can remove direct single-scattered light
- real air still receives diffuse illumination from other sky directions
- that diffuse illumination can scatter again into the camera

External references supporting this direction:

- Bruneton 2016 compares graphics clear-sky models with measurements and
  libRadtran, and frames accuracy around how many physical simplifications are
  retained or removed:
  `https://arxiv.org/abs/1612.04336`
- libRadtran treats direct and diffuse solar radiation separately, supports
  radiance by view direction, aerosol configuration, surface albedo/BRDF, and
  radiative-transfer equation solvers such as DISORT:
  `https://www.libradtran.org/doku.php?id=basic_usage`
- DISORT-style solvers are explicitly built for multiple-scattering
  radiative-transfer problems in layered media. Use libRadtran/DISORT as the
  preferred external calibration target before claiming Earth-truth behavior.

## Candidate Algorithms

### Order-By-Order Reference

Compute scattering orders iteratively:

```text
L0 = direct solar illumination reaching each atmospheric cell
L1 = direct single scattering into each sampled direction
L2 = scattering of L1 into each sampled direction
L3 = scattering of L2 into each sampled direction
...
```

Stop when the new order contributes less than a configured fraction of the
accumulated result, or when a configured maximum order is reached.

Pros:

- deterministic
- easy to report contribution by order
- directly explains convergence
- useful for calibrating an approximation stage

Cons:

- needs a spatial/angular grid
- expensive across wavelengths
- requires careful interpolation and boundary handling

### Monte Carlo / Path-Traced Reference

Trace many random scattering paths through the medium and estimate radiance
statistically.

Pros:

- conceptually close to physical light transport
- can support complex geometry and phase functions
- naturally handles many scattering orders

Cons:

- noisy
- slow
- harder to make deterministic without careful seeded sampling
- less pleasant as a red/green fixture source unless sample counts are high

### External-Solver Calibration

Use libRadtran/DISORT or a similar solver as an external reference for a small
set of fixed scenarios.

Pros:

- strongest near-term source backing
- avoids inventing a second local solver before we know what accuracy we need
- good for calibrating `integrateDiffuseSkyAirlight`

Cons:

- operational dependency or offline artifact workflow
- geometry/features may not match every flat-world hypothesis directly
- requires careful scenario translation and provenance

### Project-Specific Table Generation

Generate lookup artifacts from this project's own CPU reference or later
multiple-scattering reference, then use them as shader/app approximation data.

This path is separate from adopting Bruneton's precomputed tables directly.
Bruneton-style tables are valuable validation and shader-architecture
precedents for spherical, bounded, Earth-like atmospheres, but they are not a
natural source of flat-world approximation data. The table values depend on
the geometry, atmosphere profile, aerosol assumptions, ground albedo,
wavelength/luminance conversion, texture parameterization, and precompute
method used to generate them.

For the flat-world/local-Sun hypotheses, project-owned tables may need keys
that Bruneton tables do not cover:

- geometry kind, such as WGS84 globe, north-pole azimuthal-equidistant flat
  world, finite slab, dome, cylinder, or bounded local patch
- observer height and local frame
- ray elevation/azimuth or view angle relative to plumb
- Sun distance, direction, angular radius, and source-path transmittance
- atmosphere profile, aerosol policy, and optical-depth regime
- visibility/detail thresholds or asymptotic veil classifications for
  functionally opaque flat paths

Recommended validation order:

1. Generate project-owned spherical Earth-like tables from the CPU reference.
2. Compare the spherical subset against Bruneton-style behavior and, ideally,
   libRadtran/DISORT artifacts.
3. Only after that, generate flat-model tables with explicit hypothesis labels,
   finite-boundary metadata, and qualitative warnings for extreme optical
   depths.
4. Use generated flat tables as shader/app approximation inputs, not as
   independent physical truth unless they have their own external validation.

## Proposed Local Shape

If implemented locally, keep it out of the normal fast stage sequence at first.
Treat it as an offline benchmark mode:

```text
single-scattering pipeline result
slow multiple-scattering reference result
fast diffuse-sky-airlight approximation result
comparison report
```

Possible public/script API:

```text
run-reference-probe --multiple-scattering-reference
run-reference-probe --compare-diffuse-sky-airlight
```

Possible output packet:

```js
multipleScatteringReference: {
  mode: 'order-by-order-grid',
  radianceByWavelength,
  orders: [
    { order: 1, radianceByWavelength },
    { order: 2, radianceByWavelength },
    { order: 3, radianceByWavelength }
  ],
  convergence: {
    thresholdFraction,
    maxOrder,
    lastOrderFraction,
    converged
  },
  diagnostics: {
    tauRegime,
    geometryKind,
    angularSampleCount,
    altitudeLayerCount,
    calibrationReference,
    warnings
  }
}
```

Do not merge this output into `spectralRadiance.finalByWavelength` until its
contract and calibration are reviewed. Early reports should compare it against
single scattering and `integrateDiffuseSkyAirlight` side by side.

## Relationship To `integrateDiffuseSkyAirlight`

`integrateDiffuseSkyAirlight` should remain the practical approximation stage.
The multiple-scattering reference would exist to calibrate or replace that
approximation when needed.

Use this relationship:

- `integrateSingleScattering`: direct first-order scattering only
- `integrateDiffuseSkyAirlight`: bounded practical approximation for missing
  diffuse/higher-order atmospheric radiance
- `multipleScatteringReference`: slow diagnostic/reference mode used to
  validate the approximation, not always part of the canonical render path

If the approximation becomes small and well calibrated, keep it. If it grows
into many unrelated fixes, replace it with a better approximation derived from
the multiple-scattering reference or promote the reference for benchmark-only
truth artifacts.

## Flat Geometry Concerns

Flat geometry is the strongest reason to keep this design available. A
near-parallel flat ray can remain in dense air far longer than a spherical
Earth horizon ray. A naive diffuse-airlight approximation could add brightness
indefinitely and produce a glowing wall instead of an opaque veil.

A multiple-scattering reference or external finite-slab calibration should help
define:

- how radiance approaches an asymptotic veil color
- when terrain contrast becomes unrecoverable
- when direct sunlight is functionally gone along the source path
- how to terminate or classify extreme flat paths
- which parts of the output are visual proxies rather than recoverable detail

## Entry Criteria

Start this work if at least one of these becomes true:

- `integrateDiffuseSkyAirlight` needs multiple independent knobs to fit one
  benchmark family.
- High-tau horizon rows remain visibly wrong after aerosol-aware bounded
  airlight and lower-frame surface context are separated.
- Flat-geometry visibility-depth claims require stronger evidence than the
  current light-extent and horizon-profile probes.
- Shader parity needs a higher-confidence benchmark for horizon haze than the
  approximate stage can provide.
- External libRadtran/DISORT comparison artifacts reveal a systematic bias
  that cannot be corrected with a simple bounded approximation.

## First Implementation Slice

If this path opens, start with the smallest useful benchmark:

1. Select two globe scenarios:
   - `midday.zenith`
   - `midday.horizon`
2. Select one flat finite-slab scenario with a declared maximum path length.
3. Use the existing sourced composition stack:
   - Bucholtz Rayleigh
   - Brion ozone
   - named aerosol policy
   - U.S. Standard Atmosphere molecular profile where applicable
4. Generate or import an external libRadtran/DISORT comparison artifact.
5. Add a local comparison report before implementing a local solver.
6. Only then decide whether to implement order-by-order local scattering,
   Monte Carlo reference tracing, or keep using external artifacts.

## Open Questions

- Should the first reference be external-only, local-only, or external-first
  with a local solver later?
- What angular and altitude grid is enough for horizon-row convergence?
- How should flat finite-slab calibration map onto the north-pole-centered
  azimuthal equidistant flat-world hypothesis?
- What convergence threshold is meaningful for visual benchmarks?
- Should surface/ocean bounce enter this reference immediately or stay as a
  separately compared term?
- How should the reference report distinguish diffuse sky airlight from direct
  disk/aureole/glare and from display bloom?
