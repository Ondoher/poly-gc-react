# Objective Success Criteria

This document defines objective success criteria for the cleanroom
environment-object color experiment.

It supports:

- [Environment Object Color Prompt](environment-object-color-prompt.md)
- [Object Transport Experiment Plan](object-transport-experiment-plan.md)

## Scope

The experiment can have objective success criteria without having a measured
real-world object-at-distance benchmark. The first proof should validate the
transport equation, finite-segment behavior, and spectral endpoint. It should
not claim absolute real-world visual accuracy for a specific outdoor scene
until a sourced measurement target is added.

Therefore, success is split into four tiers:

1. hard transport identities;
2. objective demonstration checks;
3. convergence-backed numerical thresholds;
4. display-only perceptual checks.

## Result Status Vocabulary

Each machine-readable criterion result must use one of these statuses:

- `pass`: the criterion was evaluated and satisfies its stated threshold;
- `fail`: the criterion was evaluated and violates its stated threshold;
- `unresolved`: the criterion produced data, but the effect is smaller than
  the current convergence/error threshold or the needed convergence run has
  not happened yet;
- `not-applicable`: the criterion is outside the current step's scope.

For `001-transfer-baseline`, Tier 1 hard identities should usually be `pass`
or `fail`. Tier 2 demonstration checks may be `pass` when the measured effect
is far above algebraic tolerances, but convergence-sensitive claims should be
allowed to remain `unresolved` until `002-transfer-convergence` measures
sample-count deltas.

## Recommended Metrics

Reports should compute scalar summaries from spectral arrays so effect sizes
are inspectable without relying on PNGs:

- `maxAbsSpectralError`;
- `meanAbsSpectralError`;
- `relativeL2SpectralError`;
- `meanTransmittance`;
- `minTransmittance`;
- `meanPathRadianceFraction = mean(L_path / max(finalRadiance, epsilon))`;
- `meanAbsoluteSpectralContrast` between selected object-spectrum pairs.

The first `epsilon` used for ratios is an algorithmic numerical guard and must
be recorded in `equations-and-constants.json`. Use ratio metrics only as
diagnostics when denominators are near zero; do not let them override direct
array identities.

## Tier 1: Hard Transport Identities

These checks are pass/fail on spectral arrays before display conversion.

For each wavelength:

```text
L_camera(lambda) =
  T_view(lambda) * L_object(lambda) +
  L_path(lambda)
```

Pass criteria:

- **Composition identity:** stored final spectral radiance equals
  `T_view * L_object + L_path`.
- **Zero-distance identity:** for a zero-length segment, `T_view = 1`,
  `L_path = 0`, and final radiance equals object radiance.
- **Black-object identity:** for `L_object = 0`, final radiance equals
  `L_path`.
- **Linearity identity:** for two object spectra `A` and `B` at the same
  Sun case and distance:

  ```text
  final(A) - final(B) = T_view * (A - B)
  ```

- **Segment composition identity:** if a segment is split into camera-to-mid
  and mid-to-object parts, with `1` nearer the camera and `2` nearer the
  object:

  ```text
  T_full = T_1 * T_2
  L_path_full = L_path_1 + T_1 * L_path_2
  ```

  This is the finite-segment version of applying the same transfer operator in
  two steps from object to camera.

  The diagnostic must compare equivalent quadrature partitions. For example,
  if each half segment uses `N` view intervals, the full segment should use
  `2N` view intervals for this identity check. A full `N`-interval integral
  compared with two `N`-interval half integrals is a convergence comparison,
  not a pure composition comparison.
- **Transmittance bounds:** `0 <= T_view(lambda) <= 1`.
- **Nonnegative optical depth:** `tau(lambda) >= 0`.
- **Beer-Lambert identity:** `T_view(lambda) = exp(-tau(lambda))`.
- **Finite nonnegative radiance:** all recorded spectral radiance values are
  finite and nonnegative, except for explicitly labeled diagnostic deltas.

References:

- Bruneton's finite-object demo calls `GetSkyRadianceToPoint` to obtain
  finite-segment in-scatter and transmittance, then composes object and ground
  radiance as radiance times transmittance plus in-scatter:
  [Bruneton 2017 demo shader](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl).
- Bruneton's atmospheric functions define optical-length integration,
  Beer-Lambert transmittance, and single-scattering accumulation:
  [Bruneton 2017 atmospheric functions](https://raw.githubusercontent.com/ebruneton/precomputed_atmospheric_scattering/master/atmosphere/functions.glsl).

## Tier 2: Objective Demonstration Checks

These checks prove that the experiment demonstrates environment-object color
transport, not only sky coloring.

Pass criteria:

- **Distance response:** for a fixed Sun case and object spectrum, longer
  finite segments must change the final spectral radiance. The report must
  show the object term `T_view * L_object` and path term `L_path` separately.
- **Contrast loss:** for two nonblack object spectra at the same Sun case and
  distance, the spectral difference after transport must equal the source
  difference multiplied by transmittance. The report should also show a scalar
  contrast metric, such as mean absolute spectral difference, decreasing with
  distance.
- **Path-radiance influence:** for at least one nonzero distance, the report
  must show `L_path` contributing a measurable fraction of final radiance.
- **Sun-position response:** low-Sun and high-Sun cases must produce different
  `L_path` arrays and different final radiance arrays for the same object and
  distance.
- **Spectral response:** all checks above must be made on wavelength-indexed
  arrays before CIE XYZ, sRGB, tone mapping, or PNG writing.
- **No hidden RGB grading:** RGB values may summarize the spectral result, but
  no RGB-side correction, tint, exposure fit, or color grade may be used to
  satisfy transport checks.
- **No-sky-only proof:** the artifact must include finite object endpoints at
  multiple distances. A skydome or atmosphere-boundary ray alone is not a pass.

References:

- Bruneton 2016 compares clear-sky models using spectral radiance converted
  through CIE color matching functions and display mapping; this supports the
  spectral-first boundary used by experiment 032:
  [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336).
- Bruneton's demo keeps finite-object/ground radiance separate from
  atmosphere transmittance and in-scatter until the final composition step:
  [Bruneton 2017 demo shader](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl).

## Tier 3: Convergence-Backed Thresholds

Avoid treating arbitrary tolerances as physics constants. The preferred
threshold policy is:

1. run the baseline sample counts;
2. run a higher-sample convergence variant;
3. compute the spectral difference between baseline and higher-sample outputs;
4. require each claimed demonstration effect to be larger than the measured
   numerical convergence error by a recorded margin.

Suggested first convergence checks:

- double view-ray scattering intervals;
- double sample-to-Sun transmittance intervals;
- double second-order incoming directions, if second-order path radiance is
  included;
- optionally compare 15 centered wavelengths against the Bruneton 2016
  40-wavelength comparison setup for display-facing deltas.

Suggested algorithmic thresholds until convergence data exists:

- exact identities computed from the same stored arrays:
  `1e-10` absolute or `1e-8` relative;
- zero-length transfer:
  `1e-12` absolute for `abs(1 - T_view)` and `abs(L_path)`;
- demonstration effects:
  effect magnitude must exceed `5x` the relevant convergence delta, or the
  report must label the effect as not yet resolved.

These numbers are algorithmic quality gates, not atmospheric measurements.
They must be recorded as such in `equations-and-constants.json` and
`report.md`.

References:

- Bruneton 2016 diagnoses clear-sky model differences and notes that
  undersampling incoming directions is a failure mode for double scattering:
  [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336).
- Gonzalez describes the Fibonacci sphere family used as a near equal-area
  direction set for the full-sphere approximation:
  [Gonzalez 2009 Fibonacci sphere lattice](https://arxiv.org/abs/0912.4540).

## Tier 4: Display-Only Perceptual Checks

Display output is useful for review but cannot be the primary success measure.
The first experiment should use display checks only after spectral checks pass.

Acceptable display checks:

- CIE XYZ generated from the recorded spectral radiance arrays;
- linear sRGB generated from XYZ;
- optional encoded PNG/contact sheet generated from linear sRGB;
- optional CIE Lab or CIEDE2000 color-difference summaries for human-facing
  review.

Display checks must not:

- replace spectral pass/fail checks;
- introduce hidden RGB tints, white balance fits, or exposure fitting;
- use the Bruneton Figure 1 display scalar `k` as an atmosphere constant.

References:

- CIE 1931 2-degree color matching functions:
  [CIE dataset](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer).
- ASTM G173 solar spectral irradiance reference used by Bruneton's source data
  trail:
  [ASTM G173](https://www.astm.org/g0173-03r20.html).
- CIEDE2000 implementation notes and test data for optional display-difference
  summaries:
  [Sharma CIEDE2000 resources](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/).

## Follow-Up Source And Geometry Experiment Criteria

The baseline object-transfer proof should use Bruneton's distant directional
Sun and spherical atmosphere profile. The local-Sun and flat-Earth cases should
be separate follow-up experiments because they change the source model and
geometry model. They are not required for the first baseline artifact.

### Local Sun Follow-Up

The local Sun follow-up replaces the constant parallel Sun direction with a
finite source position.

Required recorded quantities:

- source position;
- source spectral radiant intensity or spectral radiant flux;
- direction from each scattering sample or surface point to the source;
- distance from that point to the source;
- source irradiance or source radiance contribution before atmospheric
  transmittance;
- source-to-sample or source-to-surface atmospheric transmittance.

Pass criteria:

- **Nonparallel direction proof:** the source direction must vary across
  distant object points or along a long view ray. The report must include the
  angular spread in degrees.
- **Inverse-square proof:** with atmosphere disabled or with a recorded
  pre-atmosphere source term, receiver irradiance must follow the expected
  distance-squared ratio:

  ```text
  E_1 / E_2 = distance_2^2 / distance_1^2
  ```

- **Directional-source limit:** when the local source distance is made very
  large while keeping the receiver irradiance normalized at the observer, the
  local-source result should converge toward the distant directional-Sun
  baseline. The convergence tolerance is algorithmic until measured.
- **Transport separation:** inverse-square source falloff and atmospheric
  transmittance must be reported separately. Do not hide source falloff inside
  extinction or optical depth.
- **Phase-angle update:** scattering phase functions must use the local
  source direction at each scattering sample, not a global Sun direction.

References:

- PBRT's point-light source model treats point lights as delta-position
  sources, computes the direction from receiver to light, and divides spectral
  intensity by squared distance:
  [PBRT 4e, Point Lights](https://pbr-book.org/4ed/Light_Sources/Point_Lights).
- Bruneton's spherical baseline uses a directional Sun source; the local Sun
  is therefore a separate model variant, not a parameter tweak:
  [Bruneton 2017 atmospheric functions](https://raw.githubusercontent.com/ebruneton/precomputed_atmospheric_scattering/master/atmosphere/functions.glsl).

Terminology note: the modeled distance falloff is receiver irradiance from a
finite source. Display luminance or apparent brightness can fall as a result,
but luminance should not be used as the source-term unit unless a later
extended-source radiometry model is explicitly defined.

### Flat-Earth Long-Line-Of-Sight Follow-Up

The flat-Earth long-line-of-sight follow-up replaces spherical Earth geometry
with a labeled plane-parallel or flat-slab atmosphere.

Required recorded quantities:

- geometry id, for example `spherical-earth` or `flat-slab`;
- altitude coordinate definition;
- ground plane and top-atmosphere plane height;
- camera point, object point, and segment length;
- per-sample altitude along the segment;
- optical depth and `log(T)` as well as `T`, so very long paths do not hide
  numerical underflow.

Pass criteria:

- **Flat geometry proof:** for a horizontal same-altitude ray in a homogeneous
  horizontal atmosphere, sample altitude must remain constant along the
  segment.
- **Linear optical-depth proof:** for a horizontal same-altitude segment in
  the flat-slab exponential atmosphere, the density is constant along the
  segment, so optical depth must grow linearly with distance:

  ```text
  tau(D_1 + D_2) = tau(D_1) + tau(D_2)
  T(D_1 + D_2) = T(D_1) * T(D_2)
  ```

- **Long-distance proof:** the artifact must include at least one line of
  sight longer than the spherical-baseline near-horizon comparison distance.
  The exact distance set is algorithmic until sourced.
- **Geometry separation:** spherical-Earth and flat-slab results must be
  recorded as different geometry profiles. Do not combine curvature effects
  and flat-slab assumptions inside one unlabeled run.
- **Finite-object proof:** long flat-slab rays must still use finite object
  endpoints and the object-transfer composition equation, not only sky rays.

References:

- Plane-parallel geometry is a standard radiative-transfer test geometry; the
  IPRT Phase A intercomparison uses one-dimensional plane-parallel model
  geometry for its benchmark scenarios:
  [IPRT Phase A](https://arxiv.org/abs/1901.01813).
- DISORT is a standard discrete-ordinate solver for plane-parallel layered
  media:
  [Stamnes et al. 1988 DISORT abstract](https://opg.optica.org/ao/abstract.cfm?uri=ao-27-12-2502).

## What Is Not Yet Objective

The current experiment does not yet have a sourced measured benchmark for:

- a known material spectrum;
- at a known distance;
- under a measured aerosol/meteorological state;
- with a measured Sun position and observer geometry;
- producing a measured target spectral radiance at the camera.

Without that dataset, the experiment can objectively prove that the cleanroom
transport behaves correctly and is useful for object coloration, but it cannot
objectively prove absolute real-world color accuracy for a specific outdoor
scene.

Adding such a validation target should be a later experiment. It would require
sourced material reflectance or emitted radiance, measured atmosphere/aerosol
conditions, camera geometry, and spectral or calibrated color measurements.
