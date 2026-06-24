# Experiment 032 Algorithm

This document records the cleanroom algorithm used by experiment 032,
`figure1-four-view-source-k-no-ground-baseline`.

Primary local evidence:

- `scripts/flat/experimental/bruneton-start-fresh.js`
- `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/provenance.json`
- `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/equations-and-constants.json`
- `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/notes.md`

Experiment 032 is the current Figure 1 visual handoff candidate. It renders
four Bruneton Figure 1 skydome rows using the step 031 no-ground spectral
transport path, but replaces the fitted display scalar with Bruneton's
comparison-source value:

```text
k = 1 / (5 * 683) = 0.00029282576866764275
```

The atmospheric endpoint is still spectral sky radiance. CIE conversion,
linear sRGB conversion, the Figure 1 tone map, and PNG writing are display
consumers layered after transport.

## Source Boundary

The experiment did not use older project atmosphere code, older local docs, or
prior local rendered artifacts as authority for equations, constants, expected
colors, or target appearance. External primary material was the authority:
Bruneton source code, the Bruneton 2016 comparison paper/source bundle, CIE
colorimetry tables as carried by Bruneton source, and Gonzalez's Fibonacci
sphere paper.

Local generated files under `tmp/atmosphere/bruneton_start_fresh/032-.../` are
evidence for what experiment 032 ran. They are not independent physics sources.

## Algorithm

For each of the four Figure 1 scenes, experiment 032 renders a `320 x 320`
transparent PNG with a circular equidistant fisheye sky dome.

For each pixel inside the sky circle:

1. Convert pixel radius to view zenith angle with the equidistant fisheye
   mapping.
2. Build a unit view ray from zenith angle and image azimuth.
3. Place the observer at `bottomRadiusMeters + observerHeightMeters`.
4. Intersect the view ray with the top atmosphere sphere.
5. March from observer to top-atmosphere exit with trapezoidal weights.
   A view sample is one numerical integration point on that pixel's camera
   ray, at a distance between the observer and the atmosphere exit. It
   represents the local air state for a small segment of the view path: density,
   optical depth accumulated up to that point, source transmittance from that
   point toward the Sun, and the radiance contribution from scattering at that
   point. The sample's trapezoidal weight determines how much that local
   contribution counts in the path integral. It is not a separate pixel,
   wavelength, or source direction.
6. At each view sample:
   - evaluate Rayleigh and Mie exponential density;
   - compute cumulative observer-to-sample optical lengths;
   - integrate sample-to-Sun optical lengths;
   - compute Beer-Lambert view and Sun transmittance;
   - accumulate first-order Rayleigh and Mie sky radiance;
   - accumulate an approximate second-order term from cached first-order
     incident sky radiance over full-sphere Fibonacci directions.
7. Sum first-order and second-order sky radiance by wavelength.
8. Do not add direct solar-disc radiance to the camera pass.
9. Convert spectral radiance to CIE XYZ and then linear sRGB for the comparison
   image.
10. Apply Bruneton's comparison-source Figure 1 tone map.

The generated PNGs are display artifacts. The design endpoint to carry forward
is the spectral radiance packet plus diagnostics.

## Equations

### Fisheye View Ray

```text
rho = sqrt((x - center)^2 + (y - center)^2) / skyRadius
theta = rho * pi / 2
azimuth = atan2(-(y - center), x - center)
view = normalize([
  sin(theta) * cos(azimuth),
  sin(theta) * sin(azimuth),
  cos(theta)
])
```

Reference: `fisheye-equidistant-projection`.

Status: visualization algorithm. It determines how the skydome is sampled for
comparison images, not atmosphere physics.

### Sun Direction

```text
sunAltitude = 90 deg - sourceSunZenith
sun = normalize([
  cos(sunAltitude) * cos(sunAzimuth),
  cos(sunAltitude) * sin(sunAzimuth),
  sin(sunAltitude)
])
```

Reference: `bruneton-2016-figure1-four-view-layout` for row labels and red
cross source tiles. The azimuths are measured from extracted external Figure 1
tiles and are algorithmic measurements, not published atmosphere constants.

### Top Atmosphere Boundary

```text
mu = dot(origin, view) / length(origin)
d_top = -r * mu + sqrt(r^2 * (mu^2 - 1) + r_top^2)
```

Reference: `bruneton-functions-glsl`.

### Density Profiles

```text
rho_R(h) = exp(-max(0, h) / H_R)
rho_M(h) = exp(-max(0, h) / H_M)
rho_O3(h) = 0
```

References: `bruneton-demo-constants` for Rayleigh/Mie exponential scale
heights; `bruneton-2016-no-ozone-comparison-policy` for ozone omission.

### Scattering And Extinction Coefficients

```text
lambda_um = lambda_nm * 1e-3
beta_R(lambda) = rayleighCoefficientScale * lambda_um^-4
beta_M_ext(lambda) = mieAngstromBeta / H_M * lambda_um^-mieAngstromAlpha
beta_M_sca(lambda) = beta_M_ext(lambda) * mieSingleScatteringAlbedo
beta_O3(lambda) = 0
```

References: `bruneton-demo-constants` for the Rayleigh law shape and Mie
Angstrom formula; `bruneton-2016-clear-sky-parameters` for experiment 032's
active aerosol constants; `bruneton-2016-no-ozone-comparison-policy` for
`beta_O3 = 0`.

### Optical Length And Transmittance

Optical lengths are integrated with trapezoidal weights:

```text
L_R = integral rho_R(h(s)) ds
L_M = integral rho_M(h(s)) ds
L_O3 = integral rho_O3(h(s)) ds

tau(lambda) =
  beta_R(lambda) * L_R +
  beta_M_ext(lambda) * L_M +
  beta_O3(lambda) * L_O3

T(lambda) = exp(-tau(lambda))
```

Reference: `bruneton-functions-glsl`.

Numerical sample counts in experiment 032 are algorithmic choices:
`20` view-ray scattering intervals and `10` sample-to-Sun transmittance
intervals.

### Phase Functions

```text
P_R(nu) = 3 / (16 * pi) * (1 + nu^2)

P_M(g, nu) =
  3 / (8 * pi) *
  (1 - g^2) / (2 + g^2) *
  (1 + nu^2) / (1 + g^2 - 2 * g * nu)^1.5
```

Reference: `bruneton-single-scattering`.

### First-Order Sky Radiance

```text
dL_1(lambda) =
  T_view(lambda) *
  T_sun(lambda) *
  E_sun(lambda) *
  (
    rho_R(h) * beta_R(lambda) * P_R(dot(view, sun)) +
    rho_M(h) * beta_M_sca(lambda) * P_M(g, dot(view, sun))
  ) *
  ds
```

Reference: `bruneton-single-scattering`.

### Second-Order Sky Radiance

Experiment 032 adds an approximate second-order term at each primary view-ray
sample:

```text
dL_2(lambda) =
  T_view(lambda) *
  integral_S2(
    L_1(lambda, omega_i) *
    (
      rho_R(h) * beta_R(lambda) * P_R(dot(view, omega_i)) +
      rho_M(h) * beta_M_sca(lambda) * P_M(g, dot(view, omega_i))
    )
    d omega_i
  ) *
  ds
```

The integral over incoming directions is approximated with a full-sphere
Fibonacci lattice:

```text
integral_S2 f(omega) d omega ~= (4 * pi / N) * sum_i f(omega_i)
```

References: `bruneton-2016-nishita96-double-scattering` for the need to
integrate incoming directions for double scattering, and
`gonzalez-2009-fibonacci-sphere-lattice` for the nearly equal-area Fibonacci
sphere sampling idea.

Algorithmic decisions: `N = 17`, `4 * pi / 17 = 0.7391982714328925 sr`, and
the cache that stores incident first-order sky radiance by scene, incoming
direction, and `24` altitude bins. Experiment 032 does not use the later
`mu_s` or incoming-view `mu` cache bins.

### Direct Solar Radiance Separation

The source direct-sun radiance equation is:

```text
L_sun(lambda) = E_sun(lambda) / (pi * alpha_s^2)
```

Reference: `bruneton-rendering-sky`.

Experiment 032 intentionally does not add this direct solar-disc radiance to
the camera pass. Direct sunlight remains the incident source for scattering.
The omission is part of the Figure 1 target contract because the external
tiles mark Sun direction with a red cross rather than representing the solar
disc as a camera-radiance pixel.

References: `bruneton-2016-figure1-sky-radiance-target` and
`bruneton-rendering-sky`.

### Spectral To Display Color

For comparison PNGs, the post-transport display consumer computes:

```text
X = 683 * sum_i CIE_x(lambda_i) * L(lambda_i) * delta_lambda
Y = 683 * sum_i CIE_y(lambda_i) * L(lambda_i) * delta_lambda
Z = 683 * sum_i CIE_z(lambda_i) * L(lambda_i) * delta_lambda

linear_sRGB = XYZ_TO_SRGB * [X, Y, Z]
display = 1 - exp(-k * max(0, linear_sRGB))
k = 1 / (5 * 683)
```

References: `bruneton-color-constants`, `bruneton-2016-figure1-display-transform`,
and `bruneton-2016-comparison-source-tone-map`.

The `5` in `k` is not an atmospheric measurement. It comes from Bruneton's
comparison source tone-mapping implementation. The `683` value is the maximum
luminous efficacy constant carried by Bruneton's color constants.

## Active Constants

### Scene And Projection Constants

| Constant | Value | Source or status |
| --- | --- | --- |
| Image size | `320 x 320` pixels | Algorithmic artifact size. |
| Sky radius | `150.4` pixels, `0.47 * imageSize` | Algorithmic margin to keep the circle inside the PNG. |
| Pixel center | `(319 / 2, 319 / 2) = (159.5, 159.5)` | Algorithmic image-center convention. |
| Fisheye maximum zenith | `pi / 2` | Equidistant upper-hemisphere skydome mapping; visualization only. |
| Outside-sky alpha | transparent | Algorithmic PNG convention. |

### Figure 1 Scene Constants

| Scene | Source row | Zenith | Altitude | Red-cross center | Azimuth | Source or status |
| --- | --- | --- | --- | --- | --- | --- |
| `figure1-06h00-z87` | `06h00` | `87 deg` | `3 deg` | `[238, 181]` in `35-Im6.png` | `-25.83454348280912 deg` | Row label from Bruneton Figure 1; azimuth measured from extracted external tile. |
| `figure1-10h15-z41` | `10h15` | `41 deg` | `49 deg` | `[184, 118]` in `06-Im15.png` | `9.544525565558136 deg` | Row label from Bruneton Figure 1; azimuth measured from extracted external tile. |
| `figure1-11h15-z31` | `11h15` | `31 deg` | `59 deg` | `[168, 111]` in `17-Im25.png` | `22.166345822082455 deg` | Row label from Bruneton Figure 1; azimuth measured from extracted external tile. |
| `figure1-13h15-z21` | `13h15` | `21 deg` | `69 deg` | `[130, 97]` in `28-Im35.png` | `85.31410016049729 deg` | Row label from Bruneton Figure 1; azimuth measured from extracted external tile. |

References: `bruneton-2016-figure1-four-view-layout`.

### Atmosphere And Aerosol Constants

| Constant | Value | Source or status |
| --- | --- | --- |
| Bottom radius | `6360000 m` | `bruneton-demo-constants`. |
| Top radius | `6420000 m` | `bruneton-demo-constants`. |
| Observer height | `2 m` | Algorithmic observer placement for ground-level sky comparison. |
| Rayleigh scale height | `8000 m` | `bruneton-demo-constants`. |
| Mie scale height | `1200 m` | `bruneton-demo-constants`. |
| Rayleigh coefficient scale | `1.24062e-6` | `bruneton-demo-constants`. |
| Active aerosol Angstrom alpha | `0.8` | `bruneton-2016-clear-sky-parameters`. |
| Active aerosol Angstrom beta | `0.04` | `bruneton-2016-clear-sky-parameters`. |
| Active aerosol single-scattering albedo | `0.8` | `bruneton-2016-clear-sky-parameters`. |
| Active Mie phase `g` | `0.7` | `bruneton-2016-clear-sky-parameters`. |
| Ozone absorption | `0` | `bruneton-2016-no-ozone-comparison-policy`. |

### Spectral Constants

Experiment 032 uses `15` centered wavelength samples between `360 nm` and
`830 nm`, with `delta_lambda = 31.333333333333 nm`.

The 15-sample count is an algorithmic decision inherited from Bruneton's
precomputed illuminance mode, not the Bruneton 2016 paper's 40-wavelength
comparison run. Solar irradiance values are interpolated from Bruneton's
48-sample ASTM G-173 ETR table.

| Wavelength nm | Solar irradiance |
| --- | --- |
| `375.666666666667` | `1.068866666667` |
| `407.000000000000` | `1.729673000000` |
| `438.333333333333` | `1.862071666667` |
| `469.666666666667` | `2.022063333333` |
| `501.000000000000` | `1.908154000000` |
| `532.333333333333` | `1.883391000000` |
| `563.666666666667` | `1.834246666667` |
| `595.000000000000` | `1.767440000000` |
| `626.333333333333` | `1.659520000000` |
| `657.666666666667` | `1.548102333333` |
| `689.000000000000` | `1.450780000000` |
| `720.333333333333` | `1.340960333333` |
| `751.666666666667` | `1.262433333333` |
| `783.000000000000` | `1.175208000000` |
| `814.333333333333` | `1.090824000000` |

References: `bruneton-demo-constants` for the 48 solar samples and
`bruneton-radiance-to-luminance` for Bruneton's spectral/CIE integration
strategy.

### Numerical Transport Constants

| Constant | Value | Source or status |
| --- | --- | --- |
| View-ray scattering intervals | `20` | Algorithmic quadrature decision. |
| Sample-to-Sun transmittance intervals | `10` | Algorithmic quadrature decision. |
| Second-order incoming directions | `17` | Algorithmic choice to use a small full-sphere Fibonacci set. |
| Second-order angular weight | `4 * pi / 17 = 0.7391982714328925 sr` | Derived from full-sphere quadrature. |
| Second-order incident altitude bins | `24` | Algorithmic cache approximation. |
| Second-order incident `mu_s` bins | inactive | Later experiment path only. |
| Second-order incident incoming-`mu` bins | inactive | Later experiment path only. |

References: `bruneton-2016-nishita96-double-scattering` and
`gonzalez-2009-fibonacci-sphere-lattice` for the need for incoming-direction
integration and the sampling family. The exact `17` and `24` values are
experiment choices.

### Display Constants

| Constant | Value | Source or status |
| --- | --- | --- |
| CIE color matching functions | CIE 1931 2-degree table | `bruneton-color-constants`. |
| XYZ to linear sRGB matrix | `[3.2406, -1.5372, -0.4986; -0.9689, 1.8758, 0.0415; 0.0557, -0.204, 1.057]` | `bruneton-color-constants`. |
| Maximum luminous efficacy | `683` | `bruneton-color-constants`. |
| Comparison tone-map scale | `5` | `bruneton-2016-comparison-source-tone-map`. |
| Source-derived `k` | `1 / (5 * 683) = 0.00029282576866764275` | Derived from `bruneton-2016-comparison-source-tone-map` and `bruneton-color-constants`. |
| White point | `[1, 1, 1]` | Algorithmic omission of Bruneton demo white balance for Figure 1 comparison. |
| Demo gamma | omitted | Algorithmic omission; Figure 1 path uses `1 - exp(-kL)`. |

## Constants Present But Inactive In Experiment 032

The artifact's `constants.atmosphere` object carries defaults and prior-step
knobs from the shared experiment script. These are not active in experiment 032:

| Constant or group | Value | Why inactive |
| --- | --- | --- |
| Demo aerosol defaults | alpha `0`, beta `0.005328`, single-scattering albedo `0.9`, `g = 0.8` | Replaced by Bruneton 2016 aerosol constants. |
| Three-wavelength RGB radiance path | `680 nm`, `550 nm`, `440 nm` | Replaced by 15-sample spectral CIE conversion. |
| Approximate radiance-to-luminance powers | sky `-3`, Sun `0` | Only for Bruneton's three-wavelength approximation; step 032 integrates spectral radiance through CIE directly. |
| Sun angular radius | `0.004675 rad` | Direct solar-disc camera radiance is omitted. |
| Diagnostic wavelength | `0.55 um` | Used by earlier transmittance diagnostics, not the step 032 spectral transport. |
| Default optical-length sample count | `96` | Earlier diagnostic path; radiance path uses the explicit `20` view intervals and `10` Sun intervals above. |
| Demo exposure scalar | `displayExposure = 10`, `luminanceExposureScale = 1e-5`, product `0.0001` | Recorded as metadata but not used to compute step 032 `k`. |
| Fitted tone-map constants | `0.0002454`, `2.454`, `2.672406` | Replaced by source-derived `k`. |
| Ozone constants | `300 DU`, `2.687e20 molecules/m2`, `15000 m`, ozone cross sections | Ozone disabled by the paper comparison policy. |
| Multiple-scattering proxy | `1.5` | Replaced by explicit second-order scattering approximation. |
| Earlier second-order count | `8` | Replaced by `17` full-sphere Fibonacci directions. |
| Later cache bins | `5` Sun-`mu` bins and `5` incoming-`mu` bins | Added only in later experiments; step 032 uses altitude-only incident cache. |
| Ground constants | albedo `0.1`, `8` bounce directions, `24` altitude bins, `8` ground transmittance samples, `8` sky-irradiance directions | Ground coupling is off. |
| Solar-disc pixel filter | `7 x 7` | Pixel-filtered direct Sun was a rejected earlier path; direct solar-disc camera radiance is off. |
| 40-wavelength paper evaluation | `40` wavelengths, `360-830 nm` | Relevant to experiments 023-027; step 032 uses the 15-sample path. |

## External Reference IDs

The IDs below match `equations-and-constants.json`.

| ID | Reference | Used for |
| --- | --- | --- |
| `bruneton-functions-glsl` | [Bruneton 2017 `functions.glsl`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L41-L53) | Boundary distance, optical-length integration, Beer-Lambert transmittance. |
| `bruneton-demo-constants` | [Bruneton 2017 `demo.cc`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L12-L20) | Earth radii, density scale heights, Rayleigh law, Mie Angstrom formula, solar irradiance table. |
| `bruneton-single-scattering` | [Bruneton 2017 `functions.glsl`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L82-L109) | Single-scattering integral and phase functions. |
| `bruneton-rendering-sky` | [Bruneton 2017 `functions.glsl`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl#L234-L241) | Direct solar radiance equation and render-time separation. |
| `bruneton-model-wavelengths` | [Bruneton 2017 `model.h`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/model.h#L53-L60) | Inactive three-wavelength RGB radiance-channel constants. |
| `bruneton-radiance-to-luminance` | [Bruneton 2017 `model.cc`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/model.cc#L29-L41) | CIE integration strategy and centered spectral samples in precomputed illuminance mode. |
| `bruneton-color-constants` | [Bruneton 2017 `constants.h`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/constants.h) | CIE table, XYZ-to-sRGB matrix, maximum luminous efficacy. |
| `bruneton-2016-clear-sky-parameters` | [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336) | Aerosol alpha, beta, single-scattering albedo, and `g`. |
| `bruneton-2016-no-ozone-comparison-policy` | [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336) | No-ozone comparison policy. |
| `bruneton-2016-nishita96-double-scattering` | [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336) | Incoming-direction integration requirement for double scattering and diagnosis of undersampling. |
| `bruneton-2016-figure1-sky-radiance-target` | [Bruneton 2016 Figure 1](https://arxiv.org/abs/1612.04336) | Treat red cross as Sun direction marker and omit direct solar-disc camera radiance. |
| `bruneton-2016-figure1-display-transform` | [Bruneton 2016 Figure 1 caption](https://arxiv.org/abs/1612.04336) | CIE-convolved spectral radiance, XYZ-to-linear-sRGB conversion, `1 - exp(-kL)` display form. |
| `bruneton-2016-comparison-source-tone-map` | [Bruneton comparison source `comparisons.cc`](https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/comparisons.cc#L148-L153) | `5 * MaxLuminousEfficacy` tone-map denominator and source-derived `k`. |
| `bruneton-2016-figure1-four-view-layout` | [Bruneton 2016 Figure 1](https://arxiv.org/abs/1612.04336) | Four row labels, source zenith angles, and external extracted tile mapping. |
| `bruneton-2016-40-wavelength-evaluation` | [Bruneton 2016 clear-sky comparison paper](https://arxiv.org/abs/1612.04336) | Inactive comparison reference showing the paper's 40-wavelength setup. |
| `bruneton-ozone-absorption` | [Bruneton 2017 `demo.cc`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc#L14-L20) | Inactive ozone constants carried by the script. |
| `bruneton-ground-reflection` | [Bruneton 2017 demo ground reflection](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.glsl#L345-L369) | Inactive ground-coupling constants carried by the script. |
| `gonzalez-2009-fibonacci-sphere-lattice` | [Gonzalez 2009 Fibonacci sphere lattice](https://arxiv.org/abs/0912.4540) | Nearly equal-area full-sphere quadrature direction family. |
| `fisheye-equidistant-projection` | [Fisheye mapping reference](https://en.wikipedia.org/wiki/Fisheye_lens#Mapping_function) | Visualization-only equidistant fisheye mapping. Replace with a primary optics source before treating it as production optics authority. |

## Production Carry-Forward

Carry forward these parts:

- spectral transport endpoint;
- no-ozone Figure 1 comparison profile;
- Bruneton 2016 aerosol constants for this profile;
- full-sphere second-order scattering as an explicit source-backed requirement;
- source-derived Figure 1 display `k` as a comparison/display consumer;
- explicit diagnostics for direct-sun omission, ground omission, spectral grid,
  sample counts, and second-order approximation.

Do not carry forward these as physics truths:

- `320 px`, `0.47` sky radius, and transparent outside-circle pixels;
- exact `20`, `10`, `17`, and `24` numerical controls without convergence
  tests;
- red-cross-derived azimuths except for recreating the Figure 1 comparison;
- the 15-wavelength grid as the final production spectral grid;
- source-derived `k` as a transport constant.
