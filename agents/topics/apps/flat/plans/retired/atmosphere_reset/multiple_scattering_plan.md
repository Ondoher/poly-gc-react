# Multiple-Scattering Plan

## Status

Status: closed as an active output-fidelity track. Phases 1-9 produced useful
diagnostics, but they did not identify multiple scattering as the dominant
cause of the current muted daylight / brown-horizon output. Keep the
sidecar/no-op contracts for isolation and future reference, but do not spend
more time tuning the current multiple-scattering field grid before the
output-impact reference tasks in
[Reference Plan](reference/plan.md#current-next-focus-output-impact-reference-work).

Phases 1-5 have first CLI/report scaffolding and a computed prototype
sidecar:

- sky-patch and sky-dome results carry `baselineFreeze` metadata
- skydome panels report display-encoded model-output metrics before the Sun
  marker overlay
- `--external-radiance <path>` imports explicit spectral-radiance JSON
  artifacts and compares matched diagnostic samples
- `--multiple-scattering-reference sidecar-contract` attaches an explicit
  non-computed sidecar contract without changing
  `spectralRadiance.finalByWavelength`
- `--multiple-scattering-reference order-by-order-grid` computes a
  diagnostic order-1/order-2 sidecar over selected sky-patch/skydome samples.
  It keeps the rendered single-scattering radiance unchanged and reports
  convergence/order fractions in JSON and Markdown. The sidecar also reports
  display-only `L1` versus `L1+L2` swatches using the same color/tone/exposure
  policy as the source run.
- `--multiple-scattering-targets diagnostic|dome-rings` controls whether the
  sidecar samples only rendered diagnostic rays or a denser skydome ring grid.
- `--multiple-scattering-angular-samples <count>` controls the sidecar
  incoming angular quadrature count.
- `--multiple-scattering-max-order <2|3|4>` controls the prototype sidecar
  convergence order.
- `--multiple-scattering-reference iterative-field-grid` builds a small
  cached iterative field sidecar for skydome rows. It uses selectable
  altitude grids, selectable Fibonacci or sun-relative horizon-dense direction
  bases, nearest or weighted lookup, and emits diagnostic image-level
  comparison panels without replacing canonical skydome pixels.
- `--multiple-scattering-reference none` now attaches an explicit
  zero-radiance no-op sidecar. It keeps rendered radiance unchanged, rejects
  solver/field/image sidecar options, and exists to isolate larger
  model-ingredient problems from any multiple-scattering contribution.

Smoke/prototype artifacts:

- `tmp/atmosphere-multi-scatter/001-phase1-4-diagnostic-smoke/`
- `tmp/atmosphere-multi-scatter/002-order-by-order-grid-prototype/`
- `tmp/atmosphere-multi-scatter/003-dome-rings-order2-angular8/`
- `tmp/atmosphere-multi-scatter/004-dome-rings-order2-angular32/`
- `tmp/atmosphere-multi-scatter/005-dome-rings-l1-vs-l1plusl2-angular32/`
- `tmp/atmosphere-multi-scatter/006-phase6-order3-convergence-diagnostic/`
- `tmp/atmosphere-multi-scatter/007-phase6-order4-convergence-angular4/`
- `tmp/atmosphere-multi-scatter/008-phase6-order4-convergence-angular8/`
- `tmp/atmosphere-multi-scatter/009-phase6-order3-convergence-angular16/`
- `tmp/atmosphere-multi-scatter/010-iterative-field-grid-image-comparison/`
- `tmp/atmosphere-multi-scatter/012-current-skydome-snapshot/`
- `tmp/atmosphere-multi-scatter/013-sidecar-skydome-visual-set/`
- `tmp/atmosphere-multi-scatter/014-phase6-l1-reconstruction-nearest/`
- `tmp/atmosphere-multi-scatter/015-phase6-l1-reconstruction-weighted/`
- `tmp/atmosphere-multi-scatter/016-phase6-l1-reconstruction-weighted-angular32/`
- `tmp/atmosphere-multi-scatter/017-phase6-l1-reconstruction-weighted-angular64/`
- `tmp/atmosphere-multi-scatter/018-phase7-control-fibonacci64-default-altitude/`
- `tmp/atmosphere-multi-scatter/019-phase7-horizon-sun64-default-altitude/`
- `tmp/atmosphere-multi-scatter/020-phase7-fibonacci64-lower-altitude/`
- `tmp/atmosphere-multi-scatter/021-phase7-horizon-sun64-lower-altitude/`
- `tmp/atmosphere-multi-scatter/022-phase7-horizon-sun128-default-altitude/`
- `tmp/atmosphere-multi-scatter/023-phase7-ablation-summary/`
- `tmp/atmosphere-multi-scatter/024-phase8-horizon-sun128-sidecar-skydomes/`
- `tmp/atmosphere-multi-scatter/025-phase8-conclusion/`
- `tmp/atmosphere-multi-scatter/026-phase9-direct-l1-plus-residual-skydomes/`
- `tmp/atmosphere-multi-scatter/027-phase9-conclusion/`
- `tmp/atmosphere-multi-scatter/028-model-family-delta-audit/`

Current visual snapshot:

- `012-current-skydome-snapshot/current-skydome-128.png` is a current
  canonical single-scattering skydome grid for the four Bruneton-style time
  rows. It uses `128 px` panels, `12/2` sampling, ASTM G-173, Bucholtz
  Rayleigh, Brion ozone, U.S. Standard Atmosphere density, Kider-fit aerosol,
  exponential tone mapping, and exposure `8`.
- The snapshot visually confirms the active baseline issue: daytime dome
  centers are muted blue-gray and the horizon/lower fisheye limb remains
  brown/gold.
- `013-sidecar-skydome-visual-set/images/sidecar-skydome-set.png` is the
  first PNG-only skydome visual set from the iterative-field sidecar. It was
  produced with `--multiple-scattering-image-dir`, `128 px` panels, angular
  samples `16`, and max order `4`. It places canonical baseline, field `L1`,
  `L1+L2`, `L1+L2+L3`, and `L1+L2+L3+L4` columns side by side. The current
  sidecar visual is strongly faceted because field lookup is still
  nearest-neighbor over a sparse Fibonacci direction set.

Phase 6 L1 reconstruction checkpoint:

- `--multiple-scattering-field-interpolation nearest|weighted` is implemented
  for `iterative-field-grid`, and the sidecar now reports cached-field `L1`
  reconstruction metrics over the `132` dome-ring targets.
- Nearest lookup with `16` directions reports mean `L1` spectral-energy error
  about `44.76%`, max `248.61%`, and near-horizon (`85 deg` view zenith) mean
  about `69.01%`.
- Weighted lookup improves the field but does not make it trustworthy:
  `16` directions reports mean `35.67%`, `32` directions reports mean
  `29.45%`, and `64` directions reports mean `21.85%`.
- The high-horizon error does not converge away with more Fibonacci
  directions: at `85 deg` view zenith the mean error remains about
  `60.40%`, `61.03%`, and `57.95%` for weighted `16`, `32`, and `64`
  directions respectively.
- Conclusion: Phase 6 should not promote the current cached field or use it
  for final sky-dome judgment. The order series converges, but the field
  representation is not yet accurate in the high-airmass horizon regime.

Phase 7 horizon-resolved field-grid checkpoint:

- `--multiple-scattering-field-direction-basis fibonacci|horizon-sun` and
  `--multiple-scattering-field-altitude-grid default|lower-atmosphere` are now
  implemented for `iterative-field-grid`. Biased direction samples carry
  explicit solid-angle weights; diagnostics report requested/resolved
  direction count, basis, altitude grid, and weight-sum error.
- The control run `018` reproduces the weighted Fibonacci-64 result in the
  current code: mean L1 spectral-energy error about `21.85%`, max `69.54%`,
  and `85 deg` horizon-ring mean `57.95%`, with order-4 last fraction about
  `0.434%`.
- The first horizon/sun basis run `019` shows the angular-basis hypothesis is
  correct for the horizon: the `85 deg` ring drops to about `8.80%`, though
  the `60` and `75 deg` rings regress because the `64` requested budget
  resolves to a horizon-heavy `104` direction grid.
- The lower-atmosphere altitude ablations `020` and `021` do not change the
  current ground-observer L1 reconstruction metric. That metric samples
  altitude `0 km`, which is already an exact layer in both altitude grids, so
  this is not evidence that altitude resolution is irrelevant for `L2+`.
- The denser horizon/sun run `022` is the current best candidate. It uses a
  requested budget of `128` directions, resolves to `156` weighted directions,
  and reports mean L1 error about `4.49%`, max `11.65%`, `60 deg` mean about
  `0.00%`, `75 deg` mean about `7.53%`, and `85 deg` mean about `8.80%`.
  It remains converged by order 4 with last-order fraction about `0.486%`.
- Conclusion: the Phase 7 blocker was angular field representation. Use the
  `horizon-sun` direction basis with requested angular budget `128` as the
  next image-level sidecar candidate. Keep weighted interpolation and the
  order-4 convergence gate. Add a path-sampled L1 reconstruction diagnostic
  before treating lower-atmosphere altitude-grid choices as promotion
  evidence.

Phase 8 image-level sidecar checkpoint:

- `024-phase8-horizon-sun128-sidecar-skydomes` generated the first `128 px`
  PNG sidecar skydome set from the Phase 7 `horizon-sun` field. It writes a
  compact `images/README.md` metric report beside the PNGs instead of relying
  on a giant per-pixel JSON dump. The run completed and converged with
  order-4 last fraction about `0.4862%`.
- The result does not validate the current image-level sidecar field. The
  contact sheet shows that field `L1` does not visually track the canonical
  direct `L1` baseline across the full fisheye dome; the field columns are
  faceted blue disks with a tan/yellow limb. Most of the visual difference is
  between canonical direct `L1` and cached field `L1`, not between field `L1`
  and field `L1..L4`.
- The higher-order increment after cached `L1` is modest. For example,
  `10h15 / 41 deg` moves from field `L1` horizon/zenith luminance ratio
  about `1.9563` to field `L1..L4` about `1.9793`; `13h15 / 21 deg` moves
  from about `1.7179` to `1.7583`. This is not the transformation needed to
  explain the poor canonical sky image.
- Conclusion: Phase 7's 132-ray L1 reconstruction gate was useful but too
  sparse for image-level trust. Do not promote the current field-only skydome
  sidecar. The next implementation should render `direct L1 + cached L2+`
  instead of replacing `L1` with a cached lookup, and add a dense image-level
  L1 reconstruction gate over the full fisheye image or a much denser
  stratified image sample.

Phase 9 residual-only sidecar checkpoint:

- The sidecar image builder now emits hybrid residual panels:
  `Direct L1 + Field L2..L2`, `Direct L1 + Field L2..L3`, and
  `Direct L1 + Field L2..L4`. It also reports a dense full-image cached-`L1`
  reconstruction gate by radius band in the compact image README.
- `026-phase9-direct-l1-plus-residual-skydomes` generated a `72 px`
  image-level artifact with the Phase 7 `horizon-sun` field, requested
  angular budget `128`, resolved directions `156`, weighted lookup, default
  altitude grid, and max order `4`. It converged with order-4 last fraction
  about `0.4862%`.
- The residual-only result moves the image only modestly. For `10h15 / 41 deg`,
  horizon luminance rises from about `0.5941` to `0.6175` and the
  horizon/zenith luminance ratio from about `1.3095` to `1.3438`. For
  `13h15 / 21 deg`, horizon luminance rises from about `0.5635` to `0.5871`
  and horizon/zenith ratio from about `0.9194` to `0.9531`. These are useful
  airlight lifts, not a transformation toward the richer reference domes.
- The dense image-level cached-`L1` gate confirms field-only sidecar images
  are not trustworthy: mean cached-`L1` image error remains about `44-47%` for
  daylight rows and about `108%` for the low-Sun row, with large radius-band
  errors. Residual panels avoid this by keeping canonical direct `L1` as the
  image base.
- Conclusion: missing high-order atmospheric scattering is not sufficient by
  itself to explain the muted daylight and brown-horizon problem. Keep the
  residual sidecar as evidence, but the next phase should audit model
  ingredients: aerosol optical depth and single-scattering albedo, Mie phase
  policy, ground/ocean/surface bounce, display/exposure calibration, and
  atmosphere/profile or solar-spectrum assumptions.

Phase 10 model-family audit checkpoint:

- `028-model-family-delta-audit` compares the current pipeline against the
  eight Bruneton 2016 graphics models and libRadtran. The scalar
  `bruneton-2016-kider-fit` aerosol preset matches the paper's fitted
  first-order parameters reasonably well (`alpha = 0.8`, `beta = 0.04`
  mapped to `AOD550 ~= 0.0645`, SSA `0.8`, scale height `1.2 km`, `g = 0.7`),
  but the pipeline does not match the paper's model ingredients: the current
  aerosol phase is Henyey-Greenstein rather than Cornette-Shanks, the local
  Figure 1 artifact uses only `2` source-path samples despite extreme horizon
  optical depth, the pipeline includes Brion ozone while the paper fit assumes
  no air-molecule absorption in the visible, and sky in-scattering has no
  ground/surface bounce.
- The coarse local image metrics show the current daylight skydome has lower
  disk contrast than every extracted paper-model column in the same Figure 1
  rows. The Phase 9 direct-`L1` plus cached-`L2+` residual increases contrast
  modestly but does not move the visual result into a Bruneton/Elek/libRadtran
  family.
- Conclusion: the next phase should be model-ingredient ablation, not more
  generic multiple-scattering grid tuning. The sorted output-impact task list
  now lives in [Reference Plan](reference/plan.md#current-next-focus-output-impact-reference-work).
- Follow-up implementation: the CLI now supports
  `--multiple-scattering-reference none` as an explicit no-op mode. It stamps
  a sidecar with `status: disabled-no-op`, `plannedSolver: none`, and
  zero-valued `radianceByWavelength`, while rejecting solver, field-grid, and
  sidecar-image controls. Use it for Phase 10 comparisons where multiple
  scattering should be visible as disabled rather than merely omitted.

Verification:

- `npm run test:scripts:flat` passed with 364 specs and 0 failures after the
  Phase 9 residual-panel and dense image-gate update.
- `npm run test:scripts:flat` passed with 366 specs and 0 failures after
  adding the explicit `--multiple-scattering-reference none` no-op mode.

## Closeout

Multiple scattering was investigated as a possible single dominant cause of
the sky-fidelity problem. The conclusion is that the current high-order
sidecar is useful diagnostic evidence, but not the next output lever.

Closed findings:

- Generic higher-order scattering is not enough to explain the muted daylight,
  low contrast, and brown horizon.
- The field-grid path is too expensive and too indirect to keep improving
  while larger model-ingredient mismatches remain.
- `--multiple-scattering-reference none` is the active isolation switch for
  runs that should show multiple scattering as explicitly disabled.
- `order-by-order-grid` and `iterative-field-grid` remain diagnostic sidecars,
  not promotion candidates.

Successor work now lives in the output-impact task list in
[Reference Plan](reference/plan.md#current-next-focus-output-impact-reference-work).
This file keeps multiple-scattering evidence and closeout notes only.

## Guardrails

- Keep `integrateSingleScattering` as the direct first-order term.
- Keep the removed haze-lift/diffuse-airlight proxy out of the canonical
  pipeline and out of CLI fallback behavior.
- Do not merge higher-order output into
  `spectralRadiance.finalByWavelength` until the contract and calibration have
  been reviewed.
- Treat paper RGB images as visual comparison evidence, not numeric radiance
  truth.
- Prefer artifact files named on the CLI for generated outputs; progress should
  go to an explicit progress-log file for long runs.
- Write new experiment artifacts under `tmp/atmosphere-multi-scatter/`. Each
  experiment gets a new folder with a leading sortable numeric prefix, such as
  `001-freeze-single-scattering-baseline/` or
  `002-model-output-metrics/`.
- Tests and reports should verify the current contract fields that exist, not
  stale fields from older experiments.

## Phase 1: Freeze The Single-Scattering Baseline

Generate a fixed current-baseline artifact set without retuning parameters
between comparisons.

Baseline scenarios:

- `midday.zenith`
- `midday.horizon`
- `midday.horizonSky`
- `sunset.horizon`
- Bruneton Figure 1 skydome rows:
  - `06h00 / 87 deg`
  - `10h15 / 41 deg`
  - `11h15 / 31 deg`
  - `13h15 / 21 deg`

Required metadata:

- wavelength grid
- solar spectrum
- Rayleigh policy
- aerosol policy
- ozone policy
- molecular profile
- tone map and exposure
- view sample count
- solar transmittance sample count
- dome orientation and Sun marker convention

Deliverables:

- PNG comparison images
- Markdown reports
- optional JSON diagnostics only at sizes where the file remains practical
- progress-log files for long runs

## Phase 2: Add A Model-Output Comparison Report

Add a report lane that compares our generated skydomes and sky patches against
known model-family artifacts before implementing local higher-order transport.

First visual source:

- Bruneton 2016 clear-sky model gallery extracted under
  `tmp/atmosphere-model-output-gallery/bruneton-2016-clear-sky-models/`

Comparison metrics:

- warm affected area inside the fisheye disk
- non-blue affected area inside the fisheye disk
- bright warm affected area
- horizon-ring luminance and chroma
- zenith-to-horizon chroma gradient
- Sun-neighborhood falloff by angular band
- image contrast and luminance range
- orientation-normalized side-by-side strips

Initial expectation from the June 2026 dome comparison:

- Our `06h00 / 87 deg` sunset dome has a much smaller affected area than the
  paper row.
- Our warm/non-blue region is localized near the lower-right limb and near-sun
  path.
- Bruneton/libRadtran-like outputs spread low-Sun influence over a larger
  angular region.

This phase should classify which model family our output currently resembles.
It should not tune the renderer to the paper screenshots directly.

## Phase 3: Import External Numeric Reference Artifacts

Add support for comparing our spectral results against external radiance
artifacts saved as explicit files. Do not require a live external solver in the
normal test or report path.

Proposed artifact shape:

```js
{
  scenarioId: 'midday.horizon',
  source: {
    model: 'libRadtran-DISORT',
    version: '...',
    configuration: {}
  },
  wavelengthsNm: [380, 400, 420],
  samples: [
    {
      viewZenithDeg: 86,
      viewAzimuthRelativeToSunDeg: 0,
      spectralRadiance: []
    }
  ]
}
```

Comparison questions:

- Is the error mostly luminance?
- Is the error mostly chromaticity?
- Is the error mostly angular spread?
- Does the bias grow with optical depth?
- Does the bias change between zenith, horizon, and low-Sun dome rows?

Preferred external sources:

- Bruneton-style spherical Earth-like multiple-scattering artifacts for model
  behavior and table/precompute precedent.
- libRadtran/DISORT artifacts for high-confidence radiative-transfer checks.

## Phase 4: Define A Sidecar Multiple-Scattering Reference Contract

Introduce higher-order reference output as a sidecar, not as a replacement for
the canonical final radiance.

Proposed packet/report shape:

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
    maxOrder,
    thresholdFraction,
    lastOrderFraction,
    converged
  },
  diagnostics: {
    geometryKind,
    tauRegime,
    angularSampleCount,
    altitudeLayerCount,
    calibrationReference,
    warnings: []
  }
}
```

Report comparisons should show:

- single scattering only
- single plus second order
- single plus third order
- external/model-family reference when available

## Phase 5: Implement A Minimal Order-By-Order Grid

Start with the smallest useful local reference, not a full production
precompute system.

Current implementation checkpoint:

- `run-reference-probe.js` supports
  `--multiple-scattering-reference order-by-order-grid`.
- The prototype is sidecar-only and does not modify the canonical
  `spectralRadiance.finalByWavelength`/rendered image output.
- Default target mode `diagnostic` computes sky-dome zenith and horizon-edge
  samples for each Bruneton time row, or sky-patch diagnostic samples for
  selected patches.
- Target mode `dome-rings` computes `132` skydome samples:
  `4` time rows times `1` zenith plus `4` view-zenith rings
  (`30`, `60`, `75`, `85` degrees) times `8` sun-relative azimuths
  (`0` through `315` degrees every `45` degrees).
- The first pass uses `preview-20nm`, max order `2`, `3` camera-ray path
  samples, `2` incoming-ray path samples, and `1` solar-transmittance sample.
  Incoming angular samples are controlled by
  `--multiple-scattering-angular-samples`.
- The prototype artifact
  `tmp/atmosphere-multi-scatter/002-order-by-order-grid-prototype/` includes
  `skydome-order-grid-smoke.png`, `.md`, `.json`, and `.progress.log`.
  In that run, the averaged order-2 fraction is about `12.88%`, with the
  coarse grid not yet converged against the `1%` threshold.
- The dome-ring artifacts compare angular quadrature sensitivity:
  `003-dome-rings-order2-angular8` reports `132` targets, order-2 fraction
  about `11.66%`, and order-2 energy `0.0503`; `004-dome-rings-order2-angular32`
  reports the same targets, order-2 fraction about `11.32%`, and order-2
  energy `0.0487`. The angular-8 versus angular-32 aggregate order-2 energy
  delta is about `3.38%`, so the coarse angular estimate is not wildly
  unstable, while the missing order-2 term remains materially above the `1%`
  convergence threshold.
- The display-comparison artifact
  `005-dome-rings-l1-vs-l1plusl2-angular32` adds sidecar swatches for
  computed `L1` and `L1+L2` on the same `132` dome-ring rays. The averaged
  linear-luminance lift is about `10.05%` across those targets, with sampled
  lifts ranging from about `5.93%` to `13.20%`. This is diagnostic display
  evidence only; canonical rendered radiance is still unchanged.

Initial scope:

- globe geometry only
- spherical Earth-like atmosphere subset
- `preview-20nm` wavelength grid first
- fixed aerosol/Rayleigh/ozone policies from the current comparison stack
- a small altitude grid with denser layers near ground
- a coarse angular sky grid sufficient for horizon and low-Sun diagnostics

Conceptual order computation:

```text
L1 = direct solar illumination scattered once into sampled directions
L2 = L1 sky radiance scattered again into sampled directions
L3 = L2 sky radiance scattered again into sampled directions
...
```

Implementation steps:

1. Build atmosphere grid cells by altitude/layer and angular direction.
2. Precompute per-cell density, extinction, scattering, and absorption by
   wavelength.
3. Precompute direct solar transmittance to each grid cell.
4. Precompute or cache transmittance between grid cells/directions as needed.
5. Precompute phase-function values between incoming and outgoing directions.
6. Compute first-order sky radiance field from direct solar illumination.
7. Iteratively scatter the previous order's sky field into the next order.
8. Stop at `maxOrder` or when the new order falls below
   `thresholdFraction` of the accumulated result.
9. Evaluate selected camera rays by sampling the higher-order field along the
   current view path.
10. Emit order-by-order diagnostics and comparison images.

This is intentionally separate from adopting Bruneton lookup tables directly.
Project-owned tables may come later, after the spherical subset has been
compared against Bruneton/libRadtran-style behavior.

## Phase 6: Evaluate Before Promotion

Promote nothing into the canonical pipeline until the comparison report shows
which term explains the observed failures.

Current implementation checkpoint:

- `run-reference-probe.js` supports
  `--multiple-scattering-max-order 3` for the `order-by-order-grid` sidecar.
- Order 3 is computed by scattering the order-2 incoming field into the target
  ray; the implementation is bounded to max order `3` for this prototype.
- The first Phase 6 artifact is
  `tmp/atmosphere-multi-scatter/006-phase6-order3-convergence-diagnostic/`.
  It uses diagnostic sky-dome targets, angular samples `8`, `preview-20nm`,
  and max order `3`.
- That run reports order energies `L1 = 0.3762`, `L2 = 0.0556`, and
  `L3 = 0.0105`, with last-order fraction about `2.38%`. It is still above
  the `1%` threshold, so the prototype is not converged at order 3.
- The same run shows linear-luminance lift from `L1` to accumulated
  `L1+L2+L3` ranging from about `7.38%` to `17.64%` across the diagnostic
  targets. This remains display evidence only; canonical rendered radiance is
  unchanged.
- The bounded order-4 sweep gives the first useful stopping-shape evidence:
  `007-phase6-order4-convergence-angular4` converges with order-4 fraction
  about `0.62%`, but angular `4` underestimates the order-2 and total energy
  relative to angular `8`. `008-phase6-order4-convergence-angular8` converges
  with order-4 fraction about `0.58%`, order energies `L1 = 0.3762`,
  `L2 = 0.0556`, `L3 = 0.0105`, `L4 = 0.0026`, and average linear-luminance
  lift about `13.06%`.
- `009-phase6-order3-convergence-angular16` confirms the order-3 term remains
  above the threshold at higher angular sampling: order-3 fraction is about
  `2.09%`, so order 3 alone is not a safe stopping point.
- Practical conclusion: the diagnostic series plausibly converges by order 4
  for the sampled Bruneton-style clear-sky targets, but recursive per-ray
  tracing is already expensive enough that the next implementation should be
  an image-level comparison built from a cached/iterative sidecar field or
  table-shaped reference, not naive order recursion for every pixel.
- The first cached/iterative sidecar field is implemented as
  `--multiple-scattering-reference iterative-field-grid`. It is skydome-only,
  sidecar-only, low resolution, and uses nearest-neighbor lookup over altitude
  and direction. The first artifact is
  `tmp/atmosphere-multi-scatter/010-iterative-field-grid-image-comparison/`.
  That run uses `5` altitude layers, `16` field directions, max order `4`,
  and emits Markdown/JSON comparison panels for `L1`, `L1+L2`, `L1+L2+L3`,
  and `L1+L2+L3+L4` for each Bruneton row.
- The cached field converges in that run with last-order fraction about
  `0.51%`. Average field order energies are `L1 = 0.2815`, `L2 = 0.0465`,
  `L3 = 0.0088`, and `L4 = 0.0017`. This validates the next architecture
  direction: image-level comparison should use a cached/iterative field, then
  improve interpolation/grid quality, rather than scaling recursive ray
  diagnostics to every pixel.
- The `014` through `017` L1 reconstruction diagnostics show that the current
  field representation is still not accurate enough for promotion. Weighted
  interpolation and angular densification improve zenith/mid-sky reconstruction
  substantially, but near-horizon reconstruction remains poor: the weighted
  `64`-direction field still has about `57.95%` mean spectral-energy error at
  `85 deg` view zenith. This isolates the next blocker as field-grid design,
  especially horizon/high-airmass direction and altitude resolution, not order
  convergence.

Promotion criteria:

- `midday.horizon` moves away from brown/olive toward a source-backed pale
  haze direction without flattening `midday.zenith`.
- Sunset dome affected area increases toward the selected model-family target
  without adding an unstructured full-frame wash.
- Order-by-order contributions converge or report non-convergence clearly.
- The change separates transport effects from display/tone-map effects.
- The comparison explains contrast changes rather than merely accepting them.

Possible outcomes:

- Keep the local order-by-order solver as an offline reference only.
- Generate project-owned tables from the validated reference.
- Derive a bounded practical approximation from the reference.
- Use external artifacts only for calibration if local higher-order transport
  proves too costly for the current need.

## Phase 7: Horizon-Resolved Field Grid

Do not promote multiple scattering into the canonical radiance pipeline yet.
This phase replaces the generic Fibonacci/nearest prototype with a field grid
designed for the high-airmass sky cases that are failing.

Implemented scope:

1. Keep the order-4 convergence criterion from Phase 6.
2. Replace the field direction basis with a sky/sun-relative basis that is
   dense near the horizon and near the solar/anti-solar azimuths, while still
   covering the full sphere for incoming radiance.
3. Add more altitude layers near the observer and lower atmosphere, for
   example sub-kilometer layers before the existing `0, 1, 3, 8, 20 km`
   structure.
4. Keep weighted interpolation, but validate it against L1 reconstruction
   before interpreting `L2+`.
5. Set a promotion gate: the field must reconstruct L1 to roughly single-digit
   mean error outside the extreme horizon, and the horizon ring must improve
   by a large factor from the current roughly `58%` error before image-level
   higher-order conclusions are trusted.

Phase 7 result:

- The `horizon-sun` basis with requested angular budget `128` is the first
  cached field that passes the existing ground-observer L1 reconstruction
  gate: aggregate mean error about `4.49%`, max about `11.65%`, and
  `85 deg` horizon-ring mean about `8.80%`.
- The lower-atmosphere altitude grid did not affect the current L1 gate,
  because that gate samples altitude `0 km`; evaluate altitude with a
  path-sampled reconstruction diagnostic before making it part of promotion.
- The expected Phase 7 output remains a reference/diagnostic table, not a
  production shader table. The next step may use the `022` field to generate
  image-level sidecar domes, but canonical promotion still requires reviewing
  the image-level result and any altitude/path diagnostic needed for `L2+`.

## Phase 8: Image-Level Sidecar Evaluation

Phase 8 used the best Phase 7 field to generate a `128 px` sidecar skydome
set with baseline, field `L1`, and accumulated field `L1..L4` columns.

Result:

- The generated sidecar image set is
  `tmp/atmosphere-multi-scatter/024-phase8-horizon-sun128-sidecar-skydomes/`.
- The interpretation artifact is
  `tmp/atmosphere-multi-scatter/025-phase8-conclusion/`.
- The sidecar run converged by order 4, but the image-level result is not
  usable as a model-quality conclusion because cached field `L1` does not
  reproduce the canonical direct `L1` skydome image.
- The observed higher-order increment from field `L1` to field `L1..L4` is
  small compared with the mismatch introduced by using cached field `L1` as
  the first-order image term.

Recommendation:

- Do not promote the current field-only sidecar.
- Next render contract should keep canonical direct `L1` as the first-order
  image term and add cached higher-order residuals:
  `direct L1 + cached L2 + cached L3 + cached L4`.
- Add a dense image-level L1 reconstruction gate before trusting field-only
  skydome images. The old 132-ray gate is not enough; it missed visible
  full-dome interpolation failure.

## Phase 9: Residual-Only Higher-Order Evaluation

Phase 9 keeps direct canonical `L1` as the image base and adds cached
higher-order residuals:

```text
direct L1 + cached L2 + cached L3 + cached L4
```

Result:

- The generated artifact is
  `tmp/atmosphere-multi-scatter/026-phase9-direct-l1-plus-residual-skydomes/`.
- The interpretation artifact is
  `tmp/atmosphere-multi-scatter/027-phase9-conclusion/`.
- The residual-only panels are visually close to the canonical baseline. They
  add a small horizon/airlight lift, but they do not create the missing rich
  blue daylight or broad warm sunset affected area.
- Dense cached-`L1` image reconstruction remains poor, which confirms
  field-only skydomes should not be used for model-quality conclusions.

Recommendation:

- Stop treating missing high-order atmospheric scattering as the single
  dominant cause.
- Keep residual-only multiple scattering as a sidecar/reference term.
- Close out the current multiple-scattering field-grid investigation and move
  to the sorted output-impact task list in
  [Reference Plan](reference/plan.md#current-next-focus-output-impact-reference-work).

## Flat-Geometry Follow-Up

Only after the spherical subset is understandable, extend the reference toward
flat-world/local-Sun cases.

Flat-specific requirements:

- finite path boundaries for near-parallel dense-air rays
- explicit optical-depth regime classification
- asymptotic veil/airlight behavior instead of unbounded brightening
- recoverable-detail and terrain-contrast classification
- source-path transmittance and finite/local Sun metadata

Flat geometry is the reason this plan must remain bounded and diagnostic. A
flat near-horizon ray can remain in dense air much longer than a globe horizon
ray, so a naive diffuse fill would become a glowing wall instead of a physical
visibility limit.
