# Algorithm32 Conclusions

Status: pre-reconciliation consolidation, retained for historical context.
For production promotion, use
[Reconciliation Conclusions](../reconciliation/conclusions.md) and
[Reconciliation To Production Deltas](reconciliation-production-deltas.md) as
the current authority. Where this file conflicts with the reconciliation POC,
the reconciliation POC wins unless an explicit production exception is
recorded.

This document treats local POC files as evidence, not production authority.
Source-backed physics and API contracts should move into the production model;
experiment knobs stay labeled until they have convergence or reference backing.
For the baseline Earth/Figure-1 profile, the canonical constants are the
accepted Algorithm32 constants. Every promoted constant should carry per-value
provenance: an external source, a source-backed derivation, or an accepted
Algorithm32 experiment/decision. Values whose pedigree is not yet recovered
remain pending evidence.

The final Algorithm32 visual baseline was accepted by subjective review after
multiple source-backed candidates were tested. That review can explain why a
sourced option was retained or left out, but it does not by itself validate
unsourced constants, equations, or hidden display tuning.

## Evidence Trail

Local sources used:

- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/bruneton-start-fresh-prompt.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-module-design.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/object-color-transport.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/production-flat-shader-differences.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/reference-to-shader-goal.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/environment-experiment-run-shape.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/objective-success-criteria.md`
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/*`
- `tmp/atmosphere/bruneton_start_fresh/021-paper-figure1-fitted-tone-map-baseline/notes.md`
- `tmp/atmosphere/bruneton_start_fresh/022-figure1-sun-zenith-baseline/notes.md`
- `tmp/atmosphere/bruneton_start_fresh/023-paper-40-wavelength-baseline/notes.md`
- `tmp/atmosphere/bruneton_start_fresh/023-paper-40-wavelength-baseline/equations-and-constants.json`
- `tmp/atmosphere/bruneton_start_fresh/024-paper-40-wavelength-refit-tone-map-baseline/notes.md`
- `tmp/atmosphere/bruneton_start_fresh/024-paper-40-wavelength-refit-tone-map-baseline/equations-and-constants.json`
- `tmp/atmosphere/cleanroom_environment/005-transfer-refined-baseline/*`
- `tmp/atmosphere/cleanroom_environment/006-transfer-refined-convergence/*`
- `shared/algorithm32/POC/*`
- `shared/algorithm32/production/*`
- `agents/topics/apps/flat/algorithm32/external-reference-log.md`
- `agents/topics/apps/flat/algorithm32/fixture-sources.md`

External anchors used:

- [Bruneton and Neyret 2008, Precomputed Atmospheric Scattering](https://hal.inria.fr/inria-00288758/en)
- [Bruneton 2017 implementation, `functions.glsl`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl)
- [Bruneton 2017 implementation, `demo.cc`](https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc)
- [Bruneton 2016 clear-sky model evaluation](https://arxiv.org/abs/1612.04336)
- [Bruneton clear-sky comparison source, `comparisons.cc`](https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/comparisons.cc)
- [PBRT v4, Transmittance](https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance)
- [PBRT v4, Volume Scattering Processes](https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes)
- [PBRT v4, Phase Functions](https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions)
- [CIE 1931 2-degree colour matching functions dataset](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer), DOI `10.25039/CIE.DS.xvudnb9b`
- [ASTM G173-03(2020)](https://store.astm.org/g0173-03r20.html), DOI `10.1520/G0173-03R20`
- [Gonzalez 2010 Fibonacci lattice paper](https://www.scirp.org/journal/paperinformation?paperid=532)
- [NASA/TMBWG Turbulence Modeling Resource](https://tmbwg.github.io/turbmodels/),
  for the verification/validation distinction and use of grid convergence
  studies as implementation-verification evidence.
- [Pereira et al. 2022, Verification and Validation for Scale-Resolving
  Simulations](https://arxiv.org/abs/2103.09899), for refinement studies as a
  way to separate numerical and modeling errors when reference data are
  unavailable.

## Core Conclusion

Algorithm32 is a spectral clear-air volume transport algorithm. Its core output
is spectral path radiance plus spectral view transmittance for a finite camera
ray segment. Color conversion, tone mapping, stars, debug colors, object
materials, and Three lights are consumers or adapters; they are not the
transport algorithm.

The durable production split is:

- Light/Sun source owns spectral lighting facts, source radiometry, and the
  source-declared incident-radiance support family/shape.
- Geometry owns coordinate frames, altitude, ray endpoints, and boundary
  distances.
- Atmosphere owns vertically stratified medium profiles, sampled from a
  geometry-resolved atmosphere coordinate. For the initial production profile,
  that coordinate is `altitudeMeters`; geographic selectors are later
  refinements.
- Incident radiance cache/support owns optional generated incoming-radiance
  field descriptors, artifact bindings, validated runtime sampling, and
  returned incident-radiance packets. Its build values are coordinated across
  light source, geometry, atmosphere, and transport/oracle calculations.
- Color owns spectral-to-display conversion after transport.

## High-Level Algorithm Steps

1. Build an evaluation request from the renderer or CPU caller: camera origin,
   normalized view direction, optional caller-supplied hit distance, spectral
   basis, and the configured light source, geometry, and atmosphere models.
2. Ask geometry for the finite integration distance. For object/terrain hits,
   the renderer may supply this distance. Otherwise geometry resolves the
   sky/top/ground terminator for its model.
3. Create view-path samples from the camera origin to the resolved distance.
   The accepted POC uses uniform trapezoidal samples.
4. For each path sample, ask geometry for atmosphere-coordinate/frame facts,
   then ask atmosphere for density and wavelength-aligned medium coefficients.
   For the initial production profile, the atmosphere coordinate is
   altitude-only: `altitudeMeters`.
5. Integrate observer-to-sample optical lengths and convert them to view
   transmittance with Beer-Lambert attenuation.
6. Ask geometry for `SourceRelativePosition` at the path point:
   direction from source plus measured distance from source when finite
   placement exists. Optional local frame facts, boundary context, and
   cache-coordinate inputs are separate adjacent geometry outputs when needed.
7. Ask the light source for lighting facts from that position:
   incoming direction, distance-use treatment, source path limit, spectral
   source radiance or incident scale, source-specific falloff, angular extent
   interpretation, and
   calibration-derived scale.
8. Resolve clipped source-path transmittance through geometry and atmosphere.
   Distant Sun asks geometry to integrate to the atmosphere boundary; local Sun
   supplies a finite source path limit that geometry may still clip by
   atmosphere, ground, or model boundaries.
9. Ask atmosphere for Rayleigh and aerosol phase values for the outgoing view
   direction and incoming source direction.
10. Add first-order in-scattering:
   `dL1 = T_view * T_source * L_source * (rho_R * beta_R * P_R + rho_M * beta_M_sca * P_M) * ds`.
11. If an incident-radiance model is configured, integrate higher-order
    incoming sky radiance over directions:
    `dL2 = T_view * integral(L_i(omega_i) * (rho_R * beta_R * P_R + rho_M * beta_M_sca * P_M) d_omega) * ds`.
    The local POC approximates the integral with full-sphere directions and a
    cached incident-radiance grid.
12. Return spectral `pathRadiance` and spectral `transmittance`.
13. For finite object rays, the caller composes
    `L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)`.
    Sky rays return path radiance only.
14. Color/display code converts spectral radiance to XYZ, linear sRGB, and any
    app-selected tone map. The Figure 1 comparison display transform is a
    display consumer, not a transport constant.

## Subsystem Responsibilities

### Light / Sun Source

Owns:

- Source identity and serializable descriptor for compatibility and cache keys.
- Distant/directional simplification and finite-source lighting semantics.
- The lighting-fact packet shape and radiometric interpretation:
  spectral source radiance or incident scale, source-specific falloff,
  apparent extent policy, and calibration.
- Consumption of explicit geometry-owned or coordinator-resolved
  `SourceRelativePosition` values. The light source interprets those positions
  into incoming direction, distance-use treatment, source path limits,
  falloff, angular extent, and lighting facts.
- The source-declared higher-order incident-radiance support family/shape,
  including whether the source needs no support, distant support, local/finite
  support, collapsed support, directional support, or another source-specific
  domain.
- Available-light facts used by a setup/build coordinator when it generates
  incident-radiance support.
- Local source calibration such as inverse-square falloff and reference
  distance when those are explicitly chosen.

Does not own:

- Atmosphere coefficients or phase functions.
- Camera ray endpoints or geometry clipping.
- Hidden access to geometry internals. Required frame, position, coordinate,
  boundary, or clipping facts must cross as explicit request data or resolved
  descriptors.
- Geometry-owned Sun/source placement. If a geometry profile owns the resolved
  Sun position, the light source consumes that position as input rather than
  recomputing or overriding it.
- Source-relative cache coordinate mapping. Geometry owns how model-space
  positions/directions map into and out of source-relative cache coordinates.
- Complete incident-radiance cache/support ownership. Generated values are a
  coordinated result of available light, geometry mapping, atmosphere medium
  facts, and transport/oracle integration.
- Display RGB tint, tone mapping, or debug colors.
- Three `DirectionalLight` / `PointLight` state. Those are scene adapters.

Current scaffold/interface note:

- `LightSourceModel.describe()`
- `LightSourceModel.sampleRadiance(request)`
- The scaffold/POC lineage may still expose incident-radiance sampling as a
  light-source method. Treat that as migration residue. Reconciliation should
  move that runtime question to setup-bound incident radiance cache/support:
  operation-ready `IncidentRadianceSampling` with
  `incidentRadianceSampler(cacheAccess)`.

Important conclusion: the inherited POC `sourceColor = { r: 1, g: 0.98, b:
0.95 }` and rough wavelength band tinting were reverted in the latest
local-sun-second-order diagnostic, `095-local-source-neutral-white-stack`,
which rerendered the accepted local-source stack with neutral white source
scale. The old tint/grouping is stale fixture residue and must not be promoted
as production physics.

### Geometry

Owns:

- Geometry kind: spherical shell or flat z-up slab.
- Frame descriptor and coordinate conventions.
- Altitude definition: `length(position) - bottomRadiusMeters` for spherical,
  `position.z` for flat.
- `AtmosphereCoordinate` resolution from model-space positions. For the
  initial production profile this is `altitudeMeters`; atmosphere consumes the
  resolved coordinate rather than interpreting raw geometry coordinates.
- Finite ray distance resolution: top atmosphere sphere, flat top plane,
  ground/terrain, caller-supplied scene hit, or explicit sky cap.
- Source-path geometry and clipping for transmittance requests after the light
  source supplies incoming direction and path-limit semantics.
- `SourceRelativePosition` for observer/source and path-point/source
  relations: direction from source plus measured distance from source when
  finite placement exists. Source-frame facts, local frame facts, boundary
  context, cache coordinate inputs, and clipping states are adjacent geometry
  contracts rather than fields on the position.
- Bidirectional or representative mapping between model-space
  positions/directions and source-relative cache coordinates.
- Resolved Sun/source position when placement is part of the selected
  world/frame/time model, such as a flat-world projection or a spherical
  geometry ephemeris adapter. The light source still owns what that positioned
  source emits and how radiance/incident scale is interpreted.

Does not own:

- Source brightness or spectrum.
- Atmosphere density constants.
- Object material radiance.
- Color conversion.

Current production interface:

- `GeometryModel.describe()`
- `GeometryModel.getFrameDescriptor()`
- `GeometryModel.resolveRayDistance(request)`

Required reconciliation target:

- Add or otherwise provide a geometry-owned atmosphere-coordinate resolver,
  provisionally `GeometryModel.resolveAtmosphereCoordinate(request)`, before
  implementing `_sampleMedium(...)`.

Important conclusion: the flat sky cap and sky-ray distance limit are renderer
or geometry policy, not atmosphere constants.

### Atmosphere

Owns:

- Rayleigh, aerosol/Mie, and absorption density profiles.
- The initial atmosphere coordinate: altitude-only vertical stratification
  resolved by geometry as `altitudeMeters`.
- Wavelength-aligned extinction, scattering, and absorption coefficients.
- Phase functions for direction pairs.
- Profile descriptors and compatibility facts for cache keys.
- No-ozone vs ozone-enabled profile policy.
- Future profile selectors such as latitude, longitude, ocean/land class,
  season, weather cell, or regional aerosol family when a named atmosphere
  profile explicitly needs them.

Does not own:

- Sun position, Sun distance, or inverse-square falloff.
- Camera segment endpoints.
- Spectral-to-RGB conversion.
- Object albedo/material ownership.

Current production interface:

- `AtmosphereModel.describe()`
- `AtmosphereModel.sampleMedium(request)`
- `AtmosphereModel.samplePhase(request)`

Important conclusion: the accepted Figure 1 baseline uses no ozone because the
comparison profile did, not because ozone is physically absent.

Important conclusion: first production should keep atmosphere as vertically
stratified by altitude. Geographic/Earth-base coordinates can be added later
as selectors that choose or blend profile families, without changing the core
transport contract.

### Incident Radiance Cache / Support

Owns:

- Optional generated incoming-radiance field descriptors, artifact bindings,
  compatibility fingerprints, value semantics, packing policy, and sampling
  variants such as null, distant, or local.
- Runtime sampling operation:
  `IncidentRadianceSampling.incidentRadianceSampler(cacheAccess)`.
- Returned `IncidentRadianceSample` packets: spectral radiance arriving at the
  current path sample from a collapsed direction set or explicit incoming
  directions, plus any direction/weight data transport needs.
- Internal cache lookup construction from caller-visible sample facts using
  setup-bound light/source, geometry, atmosphere, spectral, execution, and
  cache descriptors.
- Null/no-op behavior when incident support is disabled.

Does not own:

- Light-source radiometry, placement, angular extent, falloff, or direct
  lighting facts.
- Raw geometry interpretation, source placement, altitude derivation, or path
  clipping.
- Atmosphere coefficients, density profiles, optical-depth equations, or
  phase functions.
- The full cache-build workflow by itself. Cache construction is a
  setup/build coordination across light source, geometry, atmosphere, and
  transport/oracle answers.
- Color/display conversion.

Important conclusion: cache/support is source-shaped and
atmosphere/transport-derived, but it answers one runtime question for
transport: how much spectral radiance is arriving at the current sample from
the configured incoming direction set. The caller should not know cache
family, source kind, raw source-local coordinates, or texture/packing shape.

### Color

Owns:

- Conversion from spectral transport output to display-facing values.
- CIE integration, XYZ-to-linear-sRGB matrix, tone mapping, exposure, white
  balance, gamma/encoding, and debug display modes.
- Figure 1 comparison display settings when reproducing the Bruneton target.

Does not own:

- Transport coefficients.
- Light source radiance.
- Cache keys for physical transport, except where display policy is explicitly
  part of a rendered artifact fingerprint.

Current production interface:

- `Color.describe()`
- `Color.convert(request)`

Important conclusion: display constants such as `k = 1 / (5 * 683)` are
comparison/display choices. They must not leak into transport profiles.

## Data Flow

Production-shaped data flow:

1. `Algorithm32Config`
   contains `lightSource`, `atmosphere`, `geometry`, `spectral`, optional
   incident-radiance support/cache policy, and optional shader/display adapter
   descriptors.
2. `SharedModel`
   aggregates the source, atmosphere, geometry, and spectral model.
3. `SpectralModel`
   owns the canonical wavelength basis and derives channel count/fingerprint.
4. `EvaluationRequest`
   carries ray origin, ray direction, optional supplied distance, and any
   caller context.
5. `GeometryModel.resolveRayDistance`
   returns a finite distance only. Diagnostics and clipping explanation belong
   to a tracing/observation API, not the transport hot path.
6. `PathSample[]`
   contains sample position, path distance, integration weight, view direction,
   and geometry-owned path facts.
7. Geometry atmosphere-coordinate resolver
   maps each path sample position to `AtmosphereCoordinate`. Provisionally this
   may be `GeometryModel.resolveAtmosphereCoordinate(...)`. For the initial
   production profile this is altitude-only: `altitudeMeters`.
8. `AtmosphereModel.sampleMedium`
   consumes `AtmosphereCoordinate` and returns density plus wavelength-aligned `extinctionCoefficient`,
   `scatteringCoefficient`, and `absorptionCoefficient`.
9. Geometry source-relative position resolver
   returns `SourceRelativePosition`: direction from source plus measured
   distance from source when finite placement exists. Local frame facts,
   boundary context, and cache-coordinate inputs are separate adjacent
   geometry outputs when needed.
10. `LightSourceModel.sampleRadiance`
   consumes `SourceRelativePosition` and returns lighting facts
   such as incoming direction, distance-use treatment, source path limit,
   spectral radiance or incident scale, falloff scale, angular extent
   interpretation, and calibration-derived scale. The
   current scaffold still carries some POC-era placement fields on
   `RadianceSample`; reconciliation should split those into geometry-owned
   positions and light-source-owned lighting packets.
11. `AtmosphereModel.samplePhase`
   returns phase values for direct and incident directions.
12. Setup-bound `IncidentRadianceSampling.incidentRadianceSampler`
    returns higher-order incident radiance samples, or a zero/empty policy when
    disabled. The caller supplies only current sample facts, such as sample
    position and `AtmosphereCoordinate`; the bound support owns cache variant,
    descriptor validation, and internal lookup construction.
13. `TransportState`
    accumulates spectral path radiance and multiplies spectral transmittance
    along the segment.
14. `EvaluationResult`
    returns spectral `pathRadiance`, spectral `transmittance`, and optional
    diagnostics.
15. `Color.convert`
    consumes the spectral result and produces display-facing RGB/debug values.

Accepted POC processing details:

- View-path and source-path optical lengths are trapezoidal numerical
  integrals of normalized density along the segment.
- Spherical top-boundary distance follows Bruneton's quadratic:
  `d_top = -r * mu + sqrt(r^2 * (mu^2 - 1) + topRadius^2)`.
- Density functions are exponential:
  `rho_R(h) = exp(-max(0, h) / H_R)` and
  `rho_M(h) = exp(-max(0, h) / H_M)`.
- Per-channel optical depth is:
  `tau = beta_R * L_R + beta_M_ext * L_M + beta_abs * L_abs`.
- Transmittance is:
  `T = exp(-tau)`.
- Rayleigh scattering is:
  `beta_R(lambda_um) = rayleighCoefficientScale * lambda_um^-4`.
- Aerosol/Mie extinction is:
  `beta_M_ext(lambda_um) = mieAngstromBeta / mieScaleHeightMeters * lambda_um^-mieAngstromAlpha`.
- Aerosol/Mie scattering is:
  `beta_M_sca = beta_M_ext * mieSingleScatteringAlbedo`.
- Rayleigh phase is:
  `P_R(nu) = 3 / (16 * pi) * (1 + nu^2)`.
- Accepted aerosol phase is Cornette-Shanks:
  `P_M(nu) = 3 / (8 * pi) * (1 - g^2) / (2 + g^2) * (1 + nu^2) / (1 + g^2 - 2 * g * nu)^1.5`.
- The local second-order POC uses full-sphere Fibonacci-style directions and
  uniform angular weight `4 * pi / N`.

## Constants

### Algorithm32 Canonical Atmosphere Constants

The production baseline should use this table as the Algorithm32 canonical
atmosphere constant set. The POC may mirror these values, but the POC is not
the authority for them. Every value must keep its own source trail or accepted
Algorithm32 decision before it can become production behavior.

| Constant | Value | Current status | Source trail |
| --- | ---: | --- | --- |
| Bottom planet radius | `6360000 m` | Algorithm32 canonical baseline | Bruneton `demo.cc`. |
| Top atmosphere radius | `6420000 m` | Algorithm32 canonical baseline | Bruneton `demo.cc`. |
| Rayleigh scale height | `8000 m` | Algorithm32 canonical baseline | Bruneton `demo.cc`. |
| Mie/aerosol scale height | `1200 m` | Algorithm32 canonical baseline | Bruneton `demo.cc`; Bruneton 2016 aerosol comparison. |
| Rayleigh coefficient scale | `1.24062e-6` | Algorithm32 canonical baseline | Bruneton `demo.cc`, with wavelength in micrometers and lambda^-4 law. |
| Aerosol Angstrom alpha | `0.8` | Algorithm32 canonical Figure 1 clear-sky fit | Bruneton 2016 clear-sky comparison fit; replaces original demo `0`. |
| Aerosol Angstrom beta | `0.04` | Algorithm32 canonical Figure 1 clear-sky fit | Bruneton 2016 clear-sky comparison fit; replaces original demo `5.328e-3`. |
| Aerosol single-scattering albedo | `0.8` | Algorithm32 canonical Figure 1 clear-sky fit | Bruneton 2016 clear-sky comparison fit; replaces original demo `0.9`. |
| Aerosol phase `g` | `0.7` | Algorithm32 canonical Figure 1 clear-sky fit | Bruneton 2016 clear-sky comparison fit; replaces original demo `0.8`. |
| Ozone absorption | `0` | Algorithm32 canonical Figure 1 comparison policy | No-ozone comparison policy; not a general Earth profile. |

Comparison setup value, not an atmosphere constant:

| Constant | Value | Current status | Source trail |
| --- | ---: | --- | --- |
| Observer height | `2 m` | Active Figure 1/POC observer placement | Cleanroom comparison setup; not a Bruneton atmosphere constant. |

### Spectral Basis And Display Constants

| Constant | Value | Current status | Source trail |
| --- | ---: | --- | --- |
| Spectral range | `360 nm` to `830 nm` | Active POC channel range | Bruneton color/CIE range; CIE 1931 dataset covers this range. |
| Channel count | `15` | Active Algorithm32/POC basis | Sourceable to Bruneton's precomputed illuminance mode: the demo passes `15`, and the model generates centered samples over `360 nm` to `830 nm`. The 40-wavelength paper-comparison path is separately sourceable and was tested as evidence, but not promoted as the accepted visual baseline. |
| Channel bin width | `(830 - 360) / 15 = 31.333333333333 nm` | Active POC | Derived from active spectral basis. |
| Maximum luminous efficacy | `683 lm/W` | Active display conversion | CIE photometry convention; Bruneton comparison source uses it. |
| XYZ-to-linear-sRGB matrix | `[3.2406, -1.5372, -0.4986; -0.9689, 1.8758, 0.0415; 0.0557, -0.204, 1.057]` | Active POC display | Bruneton color constants / standard sRGB matrix. |
| Figure 1 tone-map scale | `5` | Active comparison display only | Bruneton clear-sky comparison source. |
| Figure 1 `k` | `1 / (5 * 683) = 0.00029282576866764276` | Active comparison display only | Derived from comparison source and luminous efficacy. |

Derived constant trace for Figure 1 `k`:

- Bruneton's clear-sky comparison source computes the Figure 1 tone map as
  `1 - exp(-rgb / c)`.
- That source sets `c = 5.0 * MaxLuminousEfficacy *
  watt_per_square_meter_per_sr`.
- Bruneton's color constants and the standard photometric convention define
  `MaxLuminousEfficacy = 683`.
- Algorithm32 stores the reciprocal scalar because its display code applies
  `1 - exp(-k * linearSrgbLuminanceScaledValue)`.
- Therefore `k = 1 / (5 * 683) = 0.00029282576866764276`.

This is a valid derived constant because both the formula and its inputs are
traceable to published Bruneton material and the referenced photometric
constant. It remains scoped to the Bruneton Figure 1 comparison display policy;
it is not an atmosphere transport coefficient.

15-vs-40 spectral-grid evidence:

- Both candidate grids are sourceable, but from different Bruneton contexts.
  The `15` grid traces to Bruneton's 2017 implementation: the demo passes
  `15` for precomputed luminance/illuminance mode, and the model's
  precomputed-illuminance path derives centered wavelengths between `360 nm`
  and `830 nm` from `num_precomputed_wavelengths`.
- Experiment 032 records the active `15` centered wavelength samples from
  `360 nm` to `830 nm` and repeats that this count is inherited from
  Bruneton's precomputed illuminance mode, not from the Bruneton 2016 paper's
  40-wavelength comparison run.
- The `40` grid traces to the Bruneton 2016 clear-sky evaluation paper, which
  says its comparison runs use the same `40` wavelengths between `360 nm` and
  `830 nm` as the Kider measurement set.
- The same Bruneton 2016 paper reports, for RGB rendering, that its tests did
  not show significant differences between `n_lambda = 40`, `15`, `11`, or
  `8`. That is the source to cite for the limited-significance claim about
  spectral sample count in Bruneton-family RGB rendering. It supports treating
  15 as display-facing reasonable, but it is not a blanket convergence proof
  for every production spectral output.
- Step 022 identified the 40-wavelength paper comparison as the next
  source-based target because the script still used 15 samples.
- Step 023 implemented the paper's 40 centered wavelengths. Its review says
  the visual change from step 022 was small and that spectral sample count was
  not the main remaining mismatch. It says the next correction should move to
  transport/irradiance physics rather than increasing wavelength count further.
- Step 024 refit the single global tone-map scalar after switching to 40
  wavelengths. Its recorded target-fit RMSE changed from `0.14241668763076523`
  on the prior fitted path to `0.1401976612070572`, with sunset RMSE
  `0.11115123773917923` and midday RMSE `0.16419101740364553`. The note calls
  this a modest global-fit improvement but not a satisfactory result and not a
  visual improvement over step 021.
- Step 021, a 15-sample path, remained the closest visual match by user review
  after steps 022-027. The later 40-wavelength, scene-angle, ground, and
  transport-coordinate steps were retained as useful evidence rather than as
  visual improvements. This review selected the accepted visual baseline
  among source-backed variants; the retained ingredients still need their own
  source trail.

Resolved decision: Algorithm32 uses the 15-channel centered grid as the
Bruneton-family runtime/default spectral basis. The 40-wavelength paper setup
is retained as a source-backed validation/reference mode, not as the active
runtime basis. Future non-Bruneton physical spectral-output profiles may define
their own source-backed basis, but that is an extension decision rather than an
open question for the current Algorithm32 baseline.

Active 15-channel table from `shared/algorithm32/POC/cpu/algorithm32-transport.js`:

| Index | Wavelength nm | Solar irradiance | CIE x | CIE y | CIE z |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | `375.666666666667` | `1.068866666667` | `0.00082512` | `0.000024284` | `0.00388120013333` |
| 1 | `407` | `1.729673` | `0.031318` | `0.000868` | `0.14908` |
| 2 | `438.333333333333` | `1.862071666667` | `0.341686666667` | `0.0209466666667` | `1.70569333333` |
| 3 | `469.666666666667` | `2.022063333333` | `0.199076` | `0.0898413333333` | `1.30367066667` |
| 4 | `501` | `1.908154` | `0.0044` | `0.33986` | `0.26006` |
| 5 | `532.333333333333` | `1.883391` | `0.19361662` | `0.88666338` | `0.0364106666667` |
| 6 | `563.666666666667` | `1.834246666667` | `0.656026666667` | `0.982973333333` | `0.00305666593333` |
| 7 | `595` | `1.76744` | `1.0567` | `0.6949` | `0.001` |
| 8 | `626.333333333333` | `1.65952` | `0.722333333333` | `0.306066666667` | `0.000086666664` |
| 9 | `657.666666666667` | `1.548102333333` | `0.190006666667` | `0.0706133333333` | `0` |
| 10 | `689` | `1.45078` | `0.02474` | `0.008952` | `0` |
| 11 | `720.333333333333` | `1.340960333333` | `0.0028426512` | `0.00102653333333` | `0` |
| 12 | `751.666666666667` | `1.262433333333` | `0.000299809433333` | `0.000108266666667` | `0` |
| 13 | `783` | `1.175208` | `0.000034215932` | `0.000012356` | `0` |
| 14 | `814.333333333333` | `1.090824` | `0.00000378221413333` | `0.00000136582666667` | `0` |

The solar values trace back through the Bruneton demo's ASTM G-173 ETR table
and the experiment-032 15-bin resampling. The CIE values trace back through
Bruneton color constants and the CIE 1931 2-degree observer data.

### Numerical Sampling Controls

These are numerical integration and approximation controls, not atmosphere
constants. Their exact values are supported by accepted local convergence
experiments, not by an external paper prescribing those counts.
The experiment uses Algorithm32 itself at two sample-count levels to find a
practical diminishing-returns point: the runtime/default controls are accepted
when doubling them changes the generated spectral transfer outputs by much
less than the effects the test is meant to demonstrate.

Justification type: numerical verification / refinement evidence. Comparing
Algorithm32 to a higher-sample Algorithm32 run is justified only because the
test holds the model equations, constants, spectral basis, Sun cases, object
inputs, and distances fixed while changing the quadrature/sample resolution.
That isolates discretization and sampling error for this finite-object case
matrix. The same evidence does not validate the physical atmosphere model, does
not prove parity with Bruneton output, and does not prove absolute real-world
sky or object color accuracy. In other words, it tests the numerical precision
of evaluating the selected model under specific conditions; if the selected
physics is wrong, both the runtime/default and doubled-count runs can converge
to the wrong physical answer. Physical correctness claims need external
reference outputs, measured data, or separate source-backed fixtures.

| Control | Runtime/default | Validation/reference | Role |
| --- | ---: | ---: | --- |
| `viewRayScatteringIntervals` | `40` | `80` | View/camera-ray scattering integration intervals. |
| `sampleToSunTransmittanceIntervals` | `20` | `40` | Transmittance intervals from each path sample toward the source. |
| `secondOrderIncomingDirections` | `34` | `68` | Incoming-direction quadrature for second-order/incident radiance. |
| `secondOrderIncidentAltitudeBins` | `48` | `96` | Altitude bins for the second-order incident-radiance approximation. |
| Second-order angular weight | `4 * pi / 34 = 0.36959913571644626 sr` | `4 * pi / 68 = 0.18479956785822313 sr` | Derived uniform solid-angle weight for the incoming-direction quadrature. |

Convergence experiment description:

- Scope: finite object-transfer transport over `84` matched cases:
  `2` Figure 1 Sun cases, `7` distances, and `6` synthetic object spectra.
  The endpoint is spectral radiance by wavelength; CIE, sRGB, tone mapping,
  PNG output, and contact sheets are display consumers.
- Baseline data provenance: the convergence baseline is not an external
  measured dataset. It is the generated
  `tmp/atmosphere/cleanroom_environment/005-transfer-refined-baseline/transfer-cases.json`
  artifact, produced by the same runner from fixed inputs and the
  runtime/default `40/20/34/48` numerical controls. The `006` validation run
  regenerates the same `84` cases with `80/40/68/96` controls, loads the
  accepted `005` artifact as `convergenceReferenceArtifact`, matches cases by
  Sun case, target distance, and object-spectrum id, and compares spectral
  arrays for transmittance, path radiance, final radiance, and attenuated
  object radiance. This is a convergence/diminishing-returns comparison for
  our implementation, not a fit to an external reference output.
- Method justification: the comparison is a standard refinement-style
  verification move, not a data-source substitution. It can say the selected
  runtime/default sample counts are close enough to the doubled counts for the
  covered equations and case matrix. It cannot say the selected equations,
  source model, aerosol profile, or synthetic scene are correct in nature.
- Input provenance: the atmosphere constants, spectral grid, source irradiance,
  Figure 1 Sun cases, phase/scattering formulas, and display comparison policy
  trace to Bruneton/CIE/ASTM sources listed in the artifact references. The
  object spectra and distance set are local algorithmic stress inputs:
  synthetic unit spectral-radiance arrays and distances
  `0`, `100`, `1000`, `5000`, `20000`, `50000`, and `100000 m`.
- Synthetic-case rationale: the object spectra stress the transfer equation
  without claiming material-reflectance truth. `black` isolates path radiance,
  `neutral_unit` supplies the baseline object signal, `neutral_high` tests
  linear scaling, `blue_step` and `red_step` test wavelength-dependent
  attenuation across separated spectral bands, and `green_peak` tests a
  middle-spectrum shaped signal. The distance set covers zero-length identity,
  near-field transfer, mid-distance transfer, and long finite-path extinction
  stress.
- Expected-value derivation: expected values are derived from the transport
  identities, not copied from measured data. The checks recompute
  `L_final(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)`,
  require zero-length paths to produce `T = 1` and `L_path = 0`, require black
  objects to produce `L_final = L_path`, require object-spectrum differences to
  propagate as `T_view * delta(L_object)`, require split segments to recompose
  as `T_full = T_1 * T_2` and
  `L_path_full = L_path_1 + T_1 * L_path_2`, and require stored
  transmittance to equal `exp(-opticalDepth)`. The distance and Sun-position
  checks are effect demonstrations; their correctness threshold is that the
  measured effect exceeds the high-sample convergence delta by the configured
  margin.
- Quality gate: demonstration effects must exceed `5x` the relevant
  convergence delta, per `objective-success-criteria.md`.
- `005-transfer-refined-baseline` is the accepted runtime/default baseline
  using `40/20/34/48`.
- `006-transfer-refined-convergence` is the accepted validation/reference run
  using `80/40/68/96` against `005-transfer-refined-baseline` over `84`
  matched cases. It passed all `15` criteria with `0` failures, `0`
  unresolved checks, and minimum convergence margin `6.4074899093834174`.

Resolved decision: for the current Bruneton-family CPU/reference transfer
baseline, Algorithm32 should promote `40/20/34/48` as the runtime/default
numerical-control packet and retain `80/40/68/96` as the convergence
validation/reference packet.

### Figure 1 Scene Constants

These are comparison-scene constants, not general Algorithm32 defaults.

| Scene | Time label | Sun zenith | Sun altitude | Sun azimuth |
| --- | --- | ---: | ---: | ---: |
| `figure1-06h00-z87` | `06h00` | `87 deg` | `3 deg` | `-25.83454348280912 deg` |
| `figure1-10h15-z41` | `10h15` | `41 deg` | `49 deg` | `9.544525565558136 deg` |
| `figure1-11h15-z31` | `11h15` | `31 deg` | `59 deg` | `22.166345822082455 deg` |
| `figure1-13h15-z21` | `13h15` | `21 deg` | `69 deg` | `85.31410016049729 deg` |

Other Figure 1 render constants from experiment 032:

- Output size: `320 x 320`.
- Equidistant fisheye sky radius: `0.47 * size = 150.4 px`.
- Center: `159.5, 159.5`.
- Max view zenith: `pi / 2`.
- Outside-sky pixels: transparent.
- Direct solar-disc camera radiance: omitted for the Figure 1 target.

### Flat / Local Sun POC Constants

These constants document the local-Sun multi-scattering lane. They are not
source-backed Earth-atmosphere facts and should not become production defaults
without a separate design decision.

| Constant | Value | Current status |
| --- | ---: | --- |
| Flat sky ray limit | `1926774 m` | POC renderer/geometry policy from accepted artifact 062. |
| Flat sky ray limit policy | `accepted-062-flat-visibility-100-percent-lost-poc-default` | POC label. |
| Local cache kind | `local-z-rho-direction-wavelength-grid` | POC cache layout. |
| Local cache packing | `rgba-3d-texture-v1` | POC shader texture layout. |
| Local cache `zMeters` | `[2, 1000, 5000, 15000, 45000]` | POC nearest-neighbor grid. |
| Local cache `rhoMeters` | `[0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000]` | POC nearest-neighbor grid. |
| Local cache direction count | `9` default cache build, `34` runtime/default incident integration, `68` validation/reference incident integration | Cache/transport mismatch to resolve before cache descriptor promotion. |
| Spectral groups | `[0..3]`, `[4..7]`, `[8..11]`, `[12..14]` | POC RGBA packing groups. |
| Incoming direction frame | `sun-subpoint-local-radial-tangential-up` | POC source-relative frame. |
| User view latitude/longitude/local time | User supplied | Production view-placement configuration. |
| View altitude | App/user supplied | Production view-placement configuration; app derivation/defaulting is outside Algorithm32. |
| Local simulation root fixture | San Jose, `lat 37.3382`, `lon -121.8863`, `elevation 30.48 m` | Historical POC app preset, not a production constant. |
| Default simulation time fixture | `2026-05-22T00:00:00-07:00` | Historical POC app preset, not a production time standard. |
| Summer-solstice time fixture | `2026-06-21T12:00:00-07:00` | Historical POC review fixture. |
| Mean Earth radius | `6371.0088 km` | POC mapping helper. |
| False Sun north/south latitude limits | `23.5 deg`, `-23.5 deg` | Source-recovery default migration config. |
| False Sun solstice day | `172` | Source-recovery default migration config; exact resolver remains model behavior. |
| False Sun period | `365.2422 days` | Source-recovery default migration config. |
| False Sun longitude/phase | `58.1137 deg` | POC local-source phase/placement; no external source found so far. |
| False Sun altitude | `3000 mi = 4828.032 km` | Source-recovery default geometry config. |
| False Sun radius | `16 mi = 25.749504 km` | Source-recovery default source-size config. |
| False Sun reference distance | `4800 km` | POC calibration configuration; no external source found so far. |
| Target incident scale at closest | `1` | POC calibration target/reference-event configuration. |
| Raw source brightness scale | `solarIrradianceScale: 58` | POC app-fixture brightness; not externally sourced. |

The default altitude, size, and annual latitude migration rows are
source-recovery tasks for the steel-man flat-world profile, not confirmed
unsourced constants. They may be carried forward only as sourced,
user-configurable profile defaults.

Production view placement is authored configuration: the user can position the
view by latitude, longitude, local time, and altitude. How the app derives or
defaults altitude is a separate upstream policy. Historical values such as San
Jose elevation and the flat scene `[0, 0, 2]` observer height remain fixtures
unless the app intentionally passes them as configuration.

The local clock uses a NOAA-style equation-of-time approximation for comparison
labels, but the flat model has no independent real-time standard. Real-time
synchronization, source brightness/power, reference distance, and target
incident scale therefore belong behind an explicit calibration algorithm and
named reference event; they should not be promoted as real-world constants.

### Inactive Or Rejected Constants

Do not promote these as production facts unless a new decision reactivates
them:

- Original Bruneton demo aerosol defaults:
  `mieAngstromAlpha = 0`, `mieAngstromBeta = 5.328e-3`,
  `mieSingleScatteringAlbedo = 0.9`, `miePhaseFunctionG = 0.8`.
- Original demo Sun angular radius:
  `0.00935 / 2 = 0.004675 rad`.
- Original demo ground albedo:
  `0.1`.
- Original demo exposure/luminance display path:
  exposure `10`, luminance scale `1e-5`, white-balance option.
- Fitted experiment tone-map values:
  `0.0002454`, `2.454`, `2.672406`.
- Earlier second-order direction count:
  `8`.
- 40-wavelength comparison/evaluation path.
  This is source-backed in Bruneton's paper as an evaluation strategy, but it
  is retained as a validation/reference mode rather than the active runtime
  basis.
- Direct solar-disc camera radiance for Figure 1.
  Bruneton rendering code supports Sun-disc radiance, but the accepted Figure 1
  Algorithm32 comparison omits it.
- Star-field visual magnitude constants in the shader lab.
  These are display-layer POC effects, not Algorithm32 transport.

## Production Carry-Forward

Carry forward now:

- The source/geometry/atmosphere/color split.
- Spectral transport as the core result.
- Source-sample abstraction for distant and local lights.
- Geometry-owned ray endpoint resolution.
- Atmosphere-owned coefficients and phase functions.
- Object composition equation:
  `L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)`.
- Source-backed Figure 1 display `k` only as a comparison color policy.
- One initial atmosphere profile: the Algorithm32 canonical baseline in this
  document. Alternate atmosphere profiles are future extensions, not first
  implementation choices.
- Experiment-backed runtime/default numerical controls:
  `40/20/34/48`, with `80/40/68/96` retained as convergence
  validation/reference controls.
- Failure-loud behavior for missing local incident cache in shader mode, rather
  than silent fallback.

Do not carry forward as physics truths:

- The flat sky cap as an atmosphere fact.
- Stale local Sun RGB tint or rough RGB-to-spectral grouping from earlier POC
  paths. The latest local-sun-second-order evidence reverted it to neutral
  white source scale in artifact `095-local-source-neutral-white-stack`.
- Local Sun altitude, size, or latitude migration as unsourced scientific
  truths; they may carry only as sourced, user-configurable steel-man profile
  defaults.
- Local Sun longitude/phase, reference distance, target scale,
  brightness/source power, or real-time synchronization as real-world
  constants.
- Historical view fixtures such as San Jose coordinates, fixture dates, or
  `[0, 0, 2]` observer height as production defaults. View latitude,
  longitude, local time, and altitude are Algorithm32 configuration; app-side
  derivation/defaulting of altitude is a separate concern.
- Figure 1 fisheye size/layout except for comparison reproduction.
- The active 15-channel basis as a universal grid for future non-Bruneton
  spectral-output profiles.

## Follow-Up: Reconciliation Lane

Create a new experimental lane named `reconciliation` before promoting the
initial production implementation. Its purpose is to turn the accepted
Algorithm32 evidence into a reference-backed CPU implementation, a GPU shader
that implements that CPU reference, and a final contract for every data shape
and data handoff in the algorithm.

Expanded lane plan:
[Reconciliation Lane](../reconciliation/README.md).

End goals:

1. Build the new CPU reference for Algorithm32 under
   `shared/algorithm32/production/`. It must use reference-backed algorithms,
   reference-backed or explicitly accepted constants, and clean separation
   between the five reconciliation boundaries. Light/source, geometry,
   atmosphere, and optional incident radiance cache/support feed Algorithm32
   transport. Color is outside the algorithm itself; the CPU reference should
   define that boundary but does not need color to execute spectral transport.
2. Build the GPU shader implementation against the CPU reference. The shader
   must implement the same Algorithm32 data flow and equations, with any
   texture packing, precision, cache layout, branch, or approximation
   difference tested against the CPU reference or documented as an explicit
   implementation decision. This later shader phase needs the color/display
   interface for display conversion, tone mapping, comparison, and debug-color
   output after spectral transport.
3. Close the lane with the exact shape and flow of all data known and
   documented: configuration, resolved model facts, spectral basis, ray/path
   requests, source samples, geometry intersections, medium samples, transport
   state, incident-radiance cache/support descriptors and bindings, shader
   textures/uniforms, spectral outputs, diagnostics, and color/display
   requests.

Scope for the reconciliation lane:

- Build a single canonical parameter ledger for the initial Algorithm32
  atmosphere profile, light/source model, geometry policy, spectral basis,
  numerical controls, and display/comparison policy.
- Require every promoted constant in that ledger to carry per-value
  provenance: external source, source-backed derivation, or accepted
  Algorithm32 experiment/decision.
- For decisions made by subjective Algorithm32 review, record the candidate
  set, the retained/omitted decision, and the source trail for every retained
  equation, constant, approximation, and display choice. Subjective acceptance
  can choose the accepted baseline; it cannot promote unsourced ingredients.
- Keep alternate atmosphere profiles out of the initial run. Bucholtz
  Rayleigh, ozone-bearing profiles, and alternate aerosol presets remain
  future named-profile extensions unless a new explicit decision changes the
  first-implementation scope.
- Rerun the accepted Algorithm32 transport tests using the finalized parameter
  ledger: high-level transport, finite object composition, convergence-backed
  numerical controls, local-source behavior, second-order incident radiance,
  GPU-vs-reference parity, and display-boundary checks.
- Define and test the final data contract across the five reconciliation
  boundaries. Algorithm32 transport may depend on light/source, geometry,
  atmosphere, and optional incident radiance cache/support interfaces; color
  remains outside the transport algorithm. The CPU reference defines the
  color/display boundary, and the later GPU shader path consumes it for
  display conversion after spectral transport.
- Recreate the local second-order script-lane artifact families under the
  reconciled parameters. The source lane is `scripts/flat/local-second-order/`
  and the historical artifact root is `tmp/atmosphere/local-second-order/`.
  Include the machine-checkable milestone artifacts from `run-milestones.js`
  and the browser/gallery artifacts produced through the harness and follow-up
  runners.
- Classify artifacts by evidence type. Objective artifacts include module
  parity, incident-radiance oracle checks, cache-shape checks, historical CPU
  shader local L2 evidence, integrated GPU local L2, GPU-vs-reference selected-pixel parity,
  criteria/results JSON, diagnostics, and reports. Subjective/review artifacts
  include first-order versus second-order galleries, terrain and Southern
  France OBJ browser captures, with/without shader source matrices, local-vs-
  distant time-aligned galleries, local-source neutral-spectrum comparisons,
  and optional star/sky review galleries.
- Optionally add a real-Sun-matched local-source comparison on spherical
  geometry. For one or more configured view lat/lon/local-time/altitude cases,
  resolve the distant/real-Sun source state under the canonical spherical
  geometry, then configure a finite local Sun on that same geometry to match
  the same apparent direction, angular size, incident spectral scale or
  calibration target, and atmosphere/numerical controls at the reference view
  point as closely as the local-source model permits. Record the explicit
  source/geometry handoff facts that make the match possible: geometry frame,
  observer/root position, resolved source position, sample-to-source
  distances, angular size or solid angle, source-path clipping descriptor,
  finite-source falloff inputs, calibration reference event, and spectral
  incident scale. Compare outputs and diagnostics against the distant-source
  path as a limiting-case/source-geometry-separation check, not as external
  validation of the local-Sun model. If the local source cannot run on
  spherical geometry, first classify whether the missing dependency is source
  configuration, geometry resolver output, coordinator data flow, or improper
  coupling before promotion.
- Keep subjective artifacts reproducible and criteria-wrapped. A visual
  comparison artifact can also become objective regression evidence when it
  has a deterministic target and machine-readable image criteria, such as the
  Bruneton start-fresh Figure 1 generated Step 032 image set. The external
  Bruneton comparison sheet documents where the target came from; the
  reconciliation regression should compare against the accepted generated
  Experiment 32 Algorithm32 artifacts. Treat that as evidence for the scoped
  claim that Algorithm32 preserved the accepted visual baseline, not as
  physics validation by visual preference alone. The accepted visual baseline
  itself was chosen by subjective review among source-backed candidates; the
  reconciliation lane must preserve that selection history while verifying
  that every retained ingredient is sourced or explicitly accepted.
- Verify the five reconciliation boundaries under the reconciled parameter
  set: light/source, geometry, atmosphere, incident radiance cache/support, and
  color, with color kept outside the Algorithm32 transport core.
- Treat failed or unclear provenance as a reconciliation finding, not as a
  silent replacement opportunity. Either recover the trace, record an
  Algorithm32 decision, or leave the value out of the promoted initial profile.

Expected outputs:

- A reference-backed CPU implementation of Algorithm32 in the production
  module, with tests for the cited algorithms, constants, ownership
  boundaries, and accepted Algorithm32 decisions.
- A GPU shader implementation that is validated against the CPU reference,
  with explicit tolerances and documented precision/packing/cache decisions.
- A data-flow contract that names every request, sample, descriptor,
  cache/support binding, cache payload, shader binding, result, and diagnostic
  object, and identifies which boundary owns it.
- `parameters.md` or equivalent ledger listing every promoted constant,
  derived value, formula, owner subsystem, and source trail.
- Machine-readable `equations-and-constants.json` for the reconciled run.
- Reconciliation test artifacts and reports showing what was rerun, what
  passed, what changed from earlier experiments, and what remains blocked.
- An artifact manifest that lists each recreated local-second-order artifact,
  its command/script origin, objective-or-subjective evidence type, pass/fail
  criteria summary, rendered image outputs, and superseded/rejected history
  when relevant.
- Updated conclusions/production docs after the lane closes, with obsolete
  experiment wording removed.

## Future Profile Extensions

The first implementation ships with one Algorithm32 canonical atmosphere
profile. Future work may add alternate atmosphere profiles, but those
alternates must be explicit named profiles rather than silent replacements for
the initial baseline. Candidate future profile choices include:

- Bucholtz 1995 standard-air Rayleigh coefficients instead of Algorithm32's
  canonical `rayleighCoefficientScale * lambda_um^-4` Rayleigh law.
- A source-backed ozone absorption model with an explicit vertical density or
  column policy instead of the initial no-ozone profile.
- Additional aerosol presets separate from the Algorithm32 canonical
  Bruneton-2016 clear-sky aerosol fit.

## Open Questions

1. Local Sun spectrum:
   recreate the accepted `095` neutral-white reversal, keep stale inherited
   RGB tint fallbacks out, then choose between neutral scaling,
   source-backed spectral emission, or an explicit art-directed app source.
2. Local Sun default geometry provenance:
   recover the sources for default false-Sun altitude, size, and latitude
   migration, then store them as user-configurable steel-man profile defaults
   with units, ranges, and diagnostics.
3. Local Sun calibration:
   define the reference event that calibrates source brightness/source power
   and the flat-model time anchor. Choose between preserving the POC
   unit-incident-scale rule and promoting the cleaner
   radiance/solid-angle/transmittance calibration.
4. Optional real-Sun-matched local-source separation diagnostic:
   decide whether to run a finite local-Sun case configured to match the
   resolved distant/real Sun at the reference view point on the same spherical
   geometry, then compare outputs as a limiting-case/source-geometry-
   separation check. This test should also define the explicit geometry facts
   passed into source evaluation, because finite-source light amount properly
   depends on resolved position, distance, apparent size, path clipping, and
   calibration state.
5. View placement:
   define the public view configuration for latitude, longitude, and local
   time, plus view altitude. Separately define the app boundary for deriving
   or defaulting altitude before it is passed into Algorithm32.
6. Local second-order cache:
   choose between the current `z/rho/direction/wavelength` nearest-neighbor
   grid, a higher-dimensional source-aware cache, or runtime/direct
   integration for reference validation.
7. Local cache direction count:
   resolve the `9`-direction cache default, experiment-backed `34`-direction
   runtime/default control, and `68`-direction validation/reference control
   before productionizing cache descriptors.
8. Flat horizon/endpoints:
   choose a source-backed policy for near-horizontal flat rays: finite sky cap,
   optical saturation distance, top-plane only, or app-provided scene boundary.
9. Display:
   keep Bruneton Figure 1 `k` only for comparison, and define an app HDR/tone
   mapping policy separately.
10. Direct Sun disc:
   decide whether it belongs to light-source rendering, color/display, or a
   separate visible-emitter pass. It should not be silently mixed into sky
   path radiance.
11. Ground bounce:
   choose whether ground irradiance/reflection enters the first production
   contract or remains a later atmosphere/surface extension.
12. Shader resource contract:
   initial production target for local second-order caches is WebGL2
   `Data3DTexture`; 2D atlas fallback is a later compatibility extension only
   if target devices require it. Float texture requirements and failure
   behavior still need implementation-level validation.
13. Validation fixtures:
    decide which external source is the acceptance target for the initial
    profile and any future named profiles: Bruneton Figure 1, Bruneton spectral
    errors, libRadtran/SMARTS, or measured sky data.
