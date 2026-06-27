# Multiple-Scattering Reference Design

## Status

Active calibration candidate after the midday horizon review.

Do not jump straight into a full local multiple-scattering solver only because
one benchmark looks imperfect. The immediate shift is narrower: add an
external/model-ladder comparison lane before adding more compensatory haze
rules. Use the current pipeline to reproduce or compare against known model
families, then decide whether the local implementation needs an order-by-order
reference, imported external artifacts, or a better bounded approximation.

The current near-term path is now:

- keep `integrateSingleScattering` as the direct first-order transport term
- keep removed haze/diffuse-airlight proxies out of the canonical pipeline
- compare the single-scattering baseline against model-family references
- build or source a real higher-order transport reference before adding new
  compensating terms

The implementation sequence for that path now lives in
[Multiple-Scattering Plan](multiple_scattering_plan.md). Keep this document as
the design rationale and the plan as the actionable checklist.

The backed-out diffuse-airlight proxy crossed the warning line: it improved
some horizon numbers but cost too much contrast and pushed daylight toward
gray/beige. Do not revive it as a fallback path. Use this design to define the
next source-backed transport reference instead.

The June 2026 midday-horizon review is the first concrete warning that the
current path is approaching that boundary. Finer sampling and panned-up framing
improved the diagnostic view, but the upper sky remains muted and the
bounded haze lift bleaches the dome. A Lopes/Fernandes atmospheric-scattering
survey screenshot that visually resembles the current output maps to the
O'Neal clear-sky model family, while the same survey shows richer Bruneton
clear-sky output produced with multiple-scattering precomputation. Treat that
as evidence that the current result is plausible for an older simplified
model, not evidence that it is close enough to the photographic target.

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
- calibrate any future practical approximation from a stronger reference
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

- Lopes and Fernandes, "Atmospheric Scattering - State of the Art", provides
  a compact model ladder from Klassen and Nishita through Preetham, O'Neal,
  Schafhitzel, and Bruneton. The useful lesson for this project is not the
  image pixels themselves, but the distinction between single-scattering
  real-time approximations and later multiple-scattering/precomputed models:
  `https://repositorium.uminho.pt/server/api/core/bitstreams/00ac3a4f-ceb0-4d07-9694-0a78ac47d1e0/content`
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

### Survey-Derived Calibration Ladder

Use the Lopes/Fernandes survey as a practical ladder for reference comparison:

1. Keep the current direct single-scattering path as the O'Neal/Nishita-class
   baseline. Its muted blue-gray horizon result is a known simplified-model
   look, so it should be labeled as a baseline rather than tuned into the
   final answer.
2. Add an analytic sky-model comparison, preferably Preetham and then
   Hosek-Wilkie, as cheap external behavior checks. These models are not the
   target transport architecture, but they provide useful expected gradients,
   turbidity sensitivity, and ground-albedo handling.
3. Compare the same camera/sun scenarios against a Bruneton-style
   multiple-scattering implementation or published/reference artifacts for the
   spherical Earth-like subset.
4. Use libRadtran/DISORT artifacts for a smaller number of high-confidence
   radiance checks once the scenario translation is explicit.
5. Only after those comparisons decide whether to implement a local
   order-by-order grid, keep an external-artifact workflow, or derive a new
   practical approximation from the reference.

Borrow implementation ideas from the survey's progression without copying
code: precompute optical depth by altitude/view angle, separate view and source
transmittance tables, compare single-scattering and multiple-scattering
orders side by side, and keep the table keys tied to physical configuration
metadata.

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
- good for calibrating any future practical approximation from a stronger
  reference

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
comparison report
```

Possible public/script API:

```text
run-reference-probe --multiple-scattering-reference
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
the single-scattering baseline side by side.

## Relationship To Removed Haze-Lift Proxy

The removed diffuse-airlight/haze-lift proxy should not remain the practical
approximation stage. It is useful only as historical evidence that ad hoc
horizon brightening can trade one artifact for another.

Use this relationship:

- `integrateSingleScattering`: direct first-order scattering only
- `multipleScatteringReference`: slow diagnostic/reference mode used to
  validate whether a future practical approximation is justified

If a future approximation is added, derive it from the reference and make it a
new current contract. Do not reintroduce the old proxy as a compatibility mode
or display fallback.

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

- The single-scattering baseline cannot match a selected benchmark family
  without higher-order transport.
- High-tau horizon rows remain visibly wrong after aerosol-aware bounded
  airlight and lower-frame surface context are separated.
- Flat-geometry visibility-depth claims require stronger evidence than the
  current light-extent and horizon-profile probes.
- Shader parity needs a higher-confidence benchmark for horizon haze than the
  approximate stage can provide.
- External libRadtran/DISORT comparison artifacts reveal a systematic bias
  that cannot be corrected with a simple bounded approximation.

## First Implementation Slice

This path is now open for comparison work, not for an immediate broad solver.
Start with the smallest useful benchmark:

1. Select two globe scenarios:
   - `midday.zenith`
   - `midday.horizon`
2. Add the panned-up review scenario:
   - `midday.horizonSky` or `midday.horizonTallSky`
3. Select one flat finite-slab scenario with a declared maximum path length.
4. Use the existing sourced composition stack:
   - Bucholtz Rayleigh
   - Brion ozone
   - named aerosol policy
   - U.S. Standard Atmosphere molecular profile where applicable
5. Generate or import at least one external/model-family comparison artifact:
   - O'Neal/Nishita-class single scattering if reproduced locally
   - Preetham or Hosek-Wilkie analytic sky for a fast gradient sanity check
   - Bruneton-style multiple scattering for the spherical Earth-like subset
   - libRadtran/DISORT for high-confidence radiance checks
6. Add a local comparison report before implementing a local solver.
7. Only then decide whether to implement order-by-order local scattering,
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
