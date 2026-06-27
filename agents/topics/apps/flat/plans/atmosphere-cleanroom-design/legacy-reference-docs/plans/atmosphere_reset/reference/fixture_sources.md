# Fixture Sources

This document tracks source readiness for reference-integrator fixtures. It is
more concrete than the reference log: each row answers whether we can pin
expected data now, what fixture type it supports, and what is still deficient.

Use this as the intake checklist before adding new rows under
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures`.

## Ready Now

| Source area | Fixture use | Ready data | Source/provenance | Notes |
| --- | --- | --- | --- | --- |
| Analytic transmittance | `integrateViewOpticalDepth` unit fixtures | Vacuum, zero-length path, homogeneous Beer-Lambert, split-path multiplicativity, empty path, two-sample monotonic, multi-wavelength, multi-species sum, negative-extinction rejection, weighted piecewise-constant samples, invalid sample-weight rejection | PBRT v4 Transmittance and Volume Scattering Processes | These are toy-domain known answers. They should be implemented before Earth clear-air comparisons. |
| Controlled solar source-path transmittance | `integrateSolarTransmittance` unit fixtures | Empty medium samples, visible vacuum source path, homogeneous Beer-Lambert source path, multi-wavelength source path, source-sample metadata preservation, occluded source sample, negative extinction rejection, wavelength-shape rejection, invalid source-path weight rejection, and CIE visible-grid shape alignment | PBRT v4 Transmittance and Volume Scattering Processes; official CIE metadata for the full visible-grid shape; Reference Code Design for model-owned source samples and source-path segments | Ready and encoded in `solar-transmittance-contracts.json`. These rows test transport over model-returned source-path segments, not geometry or local-Sun sampling algorithms. |
| Spectral-array shape contract | `integrateViewOpticalDepth` error fixtures | Coefficient arrays must align to `wavelengthsNm`; mismatched arrays reject | Reference Code Design spectral pipeline and model-interface contract | Ready as an API-contract fixture, not an external physics value. |
| View optical-depth hardening rows | `integrateViewOpticalDepth` follow-up fixtures | Path-end diagnostics, packet ownership, cumulative species diagnostics, CIE and ASTM grid-alignment extremes, Bucholtz Rayleigh optical-depth table row, Kasten and Young horizon air-mass row, named flat finite lateral boundary transport, selected-model species diagnostics, and solar-stage boundary checks | Reference Code Design and Test Design for local contracts; PBRT for optical-depth/Beer-Lambert math; CIE official metadata; NLR/NREL ASTM G-173 provenance; Bucholtz 1995 Table 4; Kasten and Young 1989 Table II | Encoded in `view-optical-depth-hardening.json`, validated by fixture-envelope tests, and wired into active `IntegrateViewOpticalDepthStage` hardening specs. The convergence positive row remains a provenance gate, not sourced numeric data. |
| Analytic phase | `evaluateScatteringPhase` unit fixtures | Isotropic phase `1 / (4 * pi)` and phase integral `1` | PBRT v4 Phase Functions | Rayleigh and Henyey-Greenstein numeric phase tests can follow once the stage is reached. |
| Analytic single scattering | `integrateSingleScattering` unit fixtures | One-source scalar product, two half-weight source samples, zero-weight extra source, weighted phase/source sum, and missing/invalid source-weight rejection | PBRT v4 Volume Scattering Processes plus local stage packet contract | These are toy-domain source-quadrature known answers. They prove finite-source sampling uses explicit weights before any sunset/aureole image conclusions. |
| Analytic surface | `resolveSurfaceRadiance` unit fixtures | Black Lambertian `0`; white Lambertian with `E = pi` gives `1` before view attenuation | PBRT v4 Diffuse Reflection | These are surface-model sanity checks, not sky-color fixtures. |
| Controlled ray-path segment data | `resolveRayPath` unit fixtures | Fixture-owned atmosphere intersection distances, surface-hit distances, lateral-boundary distances, boundary labels, empty-path flags, and expected error contracts | Reference Code Design stage packet contract plus JSON expectation rows | Ready for stage-selection tests and local contract boundaries such as zero length, crossing the observer, entirely behind the observer, inverted intervals, non-finite intervals, missing intersections, surface-before-entry occlusion, and finite-vs-unbounded paths. These rows should not depend on a spherical/flat geometry helper; they test how `resolveRayPath` chooses the view segment from model-returned data. Do not use arbitrary finite distances as "extremes"; finite large-distance rows need source-backed or explicitly hypothesized model boundaries. |
| Controlled view-sample data | `sampleViewPath` unit fixtures | Empty/zero-length sample outputs, midpoint sample positions and weights, weight-sum and order invariants, diagnostic preservation, and invalid packet contracts | Reference Code Design `sampleViewPath` output contract, numerical integration midpoint-rule references, PBRT Rays/Transmittance for finite ordered path distances | Ready for stage-sampling tests. Numeric intervals such as `0..10 km` are controlled exact-arithmetic inputs, not physical atmosphere extents. |
| Controlled medium-evaluation data | `evaluateMedium` unit fixtures | Fixture-owned view samples, observer/ray inputs, world-returned altitude, model-returned density/coefficient arrays, species names, outside-atmosphere flags, derivation metadata, and invalid model-return contracts | Reference Code Design model-interface contract and `mediumSample` shape; PBRT Rays for sample position `o + t*d`; PBRT Volume Scattering Processes for absorption/scattering/extinction coefficients and nonnegativity | Ready for controlled model-return fixtures. Numeric coefficient values such as `0.1 / km` are toy model returns, not Earth atmosphere constants. |
| CIE 1931 2-degree CMFs | Colorimetry ingestion and spectral-to-XYZ fixtures | `360-830 nm`, `1 nm`, `471` rows; md5 checksum; validation sums; sample row `479 nm` | Official CIE data table and metadata, DOI `10.25039/CIE.DS.xvudnb9b` | Ready for post-pipeline color-conversion tests. Not an atmosphere transport fixture. |
| ASTM G-173 | Solar spectral table ingestion and solar-source sanity fixtures | `ASTMG173.csv`, `2002` rows, `280-4000 nm`, nonuniform spacing; local md5/sha256; selected row checks | NLR/NREL ASTM G-173 page and downloaded compressed data file | Ready for source-table ingestion and wavelength-grid alignment tests. Do not use as generic clear-sky output unless the full G-173 configuration is matched. |
| U.S. Standard Atmosphere lower table | Atmosphere-profile table fixtures | `0-86 km` lower table checkpoints, with accessible PDAS SI rows | PDAS U.S. Standard Atmosphere table, citing the U.S. Government standard | Ready for profile interpolation/checkpoint fixtures. Optical-depth expectations still need a selected coefficient model. |
| U.S. Standard Atmosphere extended table | Domain-boundary/profile fixtures | `0-1000 km` table extent and checkpoints | PDAS big tables based on U.S. Standard Atmosphere 1976 Part 4 | Usable as an accessible secondary table. Do a primary-source audit before package-facing claims. |
| Sourced Earth profile extremes | `evaluateMedium` Earth-profile fixtures | Accessible PDAS rows at `0 km`, `80 km`, and `85 km`, spanning dense sea-level air through a low-density near-boundary checkpoint in the lower table | PDAS U.S. Standard Atmosphere 1976 big table, backed by NASA NTRS record `19770009539` | Ready for Earth-profile diagnostics under the pinned `mediumSample.profile` shape. Use these as data rows, not values generated from a local standard-atmosphere formula. |
| U.S. Standard Atmosphere dry-air composition | `evaluateMedium` Earth-composition diagnostics | Table 3 dry-air fractional-volume composition: `N2 0.78084`, `O2 0.209476`, `Ar 0.00934`, `CO2 0.000314`, `Ne 0.00001818`, `He 0.00000524`, `Kr 0.00000114`, `Xe 0.000000087`, `CH4 0.000002`, `H2 0.00000005`; listed fractions sum to `0.999996697`, leaving unlisted residual `0.000003303` | NASA NTRS U.S. Standard Atmosphere 1976 PDF, Table 3, printed page 3; NTRS record `19770009539` | Ready for the `standard-dry-air-major-fractions` fixture. Assert the listed species and residual explicitly; do not require the listed rows to sum exactly to `1`. Use as a selected-standard dry-air model, not live/current CO2. |
| Coefficient boundary invariants | `evaluateMedium` coefficient-boundary fixtures | Zero coefficients, finite positive coefficient sentinels, negative coefficient rejection, and non-finite coefficient rejection | PBRT v4 Volume Scattering Processes plus local finite-number transport policy in Code Design | Ready for stage validation. The exact small positive sentinel is controlled fixture data, not an Earth coefficient; PBRT justifies the nonnegative finite coefficient domain. |
| Bucholtz Rayleigh source artifact | `atmosphere-composition` source-data tests and future `evaluateMedium` coefficient fixtures | Curated standard-air Table 2 volume-scattering coefficient rows at `200`, `450`, `550`, `650`, `800`, and `1000 nm`; Table 3 formula constants; selected 1962 U.S. Standard Table 4 optical-depth rows at `200`, `450`, `550`, `650`, and `1000 nm` | Bucholtz 1995 Applied Optics article, DOI `10.1364/AO.34.002765`; local artifact `scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json` | Ready as source data for the first named Rayleigh policy. Primary quantity is local volume-scattering coefficient in `1/km`; optical-depth rows remain secondary named-atmosphere validation data. |
| Named Rayleigh policy helper | `atmosphere-composition` policy tests and sky-patch comparison runs | `rayleigh-lambda4-preview` keeps the current lambda^-4 control behavior; `bucholtz-standard-air` evaluates Bucholtz 1995 Table 3 formula constants from the local artifact with density scaling | Bucholtz 1995 source artifact plus local preview-control contract; implementation at `scripts/flat/atmosphere_rejected/composition/rayleigh-policy.js` | Ready for explicit policy selection in the reference CLI. Default remains `rayleigh-lambda4-preview` until the preview-vs-Bucholtz comparison is reviewed. |
| Brion ozone cross-section source artifact | `atmosphere-composition` source-data tests and future ozone absorption fixtures | Raw MPI-Mainz Brion 1998 ozone cross-section table at `295 K`, `345-829 nm`, `1 nm`, `485` rows; local SHA-256; pinned visible rows at `345`, `380`, `450`, `550`, `575`, `603`, `650`, `780`, and `829 nm` | MPI-Mainz UV/VIS Spectral Atlas ozone page and Brion 1998 table; Atlas citation DOI `10.5194/essd-5-365-2013`; local artifact `scripts/flat/atmosphere_rejected/data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt` | Ready as source data for spectral ozone cross sections. This does not by itself source the vertical ozone profile, column amount, or seasonal/latitude variation. |
| Named ozone policy helper | `atmosphere-composition` policy tests and sky-patch comparison runs | `preview-chappuis` keeps the previous approximate control curve; `brion-1998-ozone-295k` reads, validates, and linearly interpolates the local Brion table, returning zero outside the table range | Brion/MPI source artifact plus local preview-control contract; implementation at `scripts/flat/atmosphere_rejected/composition/ozone-policy.js` | Ready for explicit policy selection in the reference CLI. Default remains `preview-chappuis` until sourced ozone profile/column assumptions are selected and reviewed. |
| Named aerosol preset helper | `atmosphere-composition` policy tests and sky-patch comparison runs | `rayleigh-only`, `preview-earthlike-aerosol`, `clear-maritime`, `clear-continental`, and `hazy-continental`; each scalar preset owns AOD at `550 nm`, Angstrom exponent, single-scattering albedo, aerosol scale height, and `defaultPhasePolicyId` | Angstrom optical-depth relationship, AERONET measurement/inversion precedent, SMARTS-style explicit clear-sky scenario selection, local scalar artifact `scripts/flat/atmosphere_rejected/data/composition/aerosol/aerosol-presets.json`, and phase artifact `scripts/flat/atmosphere_rejected/data/composition/aerosol/aerosol-phase-policies.json` | Ready as first comparison presets. These are scenario handles for visual sensitivity, not final global climatology or external-tool validation. Phase function kind and `g` live in the named phase-policy artifact, not scalar presets. |
| Bruneton 2016 aerosol phase policy | `evaluateScatteringPhase` and `atmosphere-composition` policy tests | Cornette-Shanks formula, `g = 0.7`, local `mu = -cosTheta` convention, and phase targets at stage `cosTheta = -1, 0, 1`: `1.81100002180`, `0.0134422764093`, `0.00995257492133`; same-scalar HG control values `1.50313001809`, `0.0223141788394`, `0.00826063718470` | Bruneton 2016 clear-sky model comparison paper plus `ebruneton/clear-sky-models` `atmosphere.h` and `atmosphere.cc`; local `evaluateScatteringPhase` convention | Encoded in `aerosol-phase-contracts.json`, `aerosol-phase-policies.json`, active phase/stage/policy/CLI tests, and the first comparison artifact. Use this as a phase-policy fixture source, not as a complete sky-color expected image; comparisons must hold aerosol scalar parameters, sampling, display, geometry, Sun rows, and multiple-scattering mode fixed. |
| U.S. Standard Atmosphere molecular density profile | `atmosphere-composition` source-data tests, profile policy tests, and sky-patch comparison runs | Density-ratio checkpoints at `0-100 km` in `5 km` steps from the PDAS U.S. Standard Atmosphere 1976 SI table; sea-level ratio `1`; selected rows such as `10 km = 0.33756` and `80 km = 0.000015068` | PDAS big table based on U.S. Standard Atmosphere 1976 Part 4, backed by NASA NTRS record `19770009539`; local artifact `scripts/flat/atmosphere_rejected/data/composition/profile/us-standard-atmosphere-1976-density.json` | Ready for molecular Rayleigh density scaling comparisons. It does not replace aerosol or ozone vertical-profile policies. |
| Karman-line top-boundary convention | Optional Earth-like atmosphere-top configuration fixture for future geometry/model tests | `100 km` altitude boundary between aeronautics and astronautics | FAI ICARE page, "100km Altitude Boundary for Astronautics" | Ready only as an explicit conventional model boundary, not as proof that the atmosphere physically ends at 100 km. Do not use it as a `resolveRayPath` stage fixture; geometry/model code should own converting this convention into returned intersections or boundaries. |
| Near-horizon air mass | Low-elevation path sanity fixtures | Horizon relative optical air mass `38.0868`; useful rows at `1 deg`, `5 deg`, `10 deg` | Kasten and Young 1989, Applied Optics, DOI `10.1364/AO.28.004735`, Table II | Ready as table rows. Use only after the test states the air-mass convention and atmosphere assumption. |
| Flat finite lateral path | Flat-world geometry/transport fixtures | Named finite side boundary plus homogeneous `tau = sigma_t * lateralDistance` | Local flat-model hypothesis plus PBRT transmittance | Not ready as a numeric extreme until a specific lateral extent is sourced or explicitly declared as a hypothesis. The lateral distance is model input, not a sourced Earth constant or numerical integration cap. |

## Partially Ready

| Source area | What we have | Deficiency | Next action |
| --- | --- | --- | --- |
| ASTM G-173 clear-sky comparison | Full spectral table and conditions are sourced. | Matching G-173 requires SMARTS assumptions: 33-layer atmosphere, aerosol, water vapor, ozone, albedo, and geometry. Our first reference stage is not that complete yet. | Use G-173 first for table ingestion and solar-source sanity. Defer full clear-sky comparison until model assumptions match. |
| Standard-atmosphere optical depth | Profile table checkpoints are ready. | Optical depth needs extinction/scattering/absorption coefficients by wavelength and species. | Combine with a selected Rayleigh/aerosol/absorber model after `evaluateMedium` is designed. |
| Earth-profile `evaluateMedium` coefficient values | CIE visible grid metadata is ready; U.S. Standard Atmosphere density checkpoints are ready; Bucholtz standard-air Rayleigh rows and named policy helper are ready; Brion ozone cross sections and named policy helper are ready; first named aerosol presets are ready. | We do not yet have a sourced ozone profile/column policy, water-vapor absorber, or external-tool clear-air validation bundle. | Use the Bucholtz policy for the first Rayleigh-only coefficient rows; use Brion only when a row explicitly owns ozone column/profile assumptions; use aerosol presets as named scenario inputs rather than global truth. |
| Earth-radius-dependent ray geometry | Candidate values include spherical Earth radius around `6371 km`, and the current app uses `6371.0088 km`. | Need primary source audit before pinning package-facing Earth-radius-dependent path lengths. Also decide whether the fixture uses mean, authalic, volumetric, equatorial, WGS84, or local geodetic radius. | Keep first `resolveRayPath` unit rows controlled by fixture data; defer real ray/sphere intersection known answers to geometry-helper tests after the radius convention is selected. |
| Ozone profile/column model | Brion 1998 spectral cross sections are ready, and the preview CLI path still uses a simple `300 DU` column/profile control. | The vertical ozone distribution and selected default column are not yet source-backed as a policy. | Pick a sourced column/profile model before using ozone as an Earth clear-air validation fixture. |

## Not Ready

| Source area | Deficiency | Needed before fixture use |
| --- | --- | --- |
| Water vapor and other molecular absorption | G-173 provides a water vapor column for its reference case, but no local absorption model is selected. | Decide whether these are deferred or included through an external tool fixture. |
| Full Earth clear-air spectral transmittance | We do not yet have a complete source-backed species/profile bundle. | Select Rayleigh, aerosol, absorber, solar geometry, observer altitude, and surface/albedo assumptions before pinning expected spectra. |
| Max species count | Depends on the selected first clear-air model. | Pin species names after the model bundle is chosen. |
| Max sample count | This is numerical convergence evidence, not a physical constant. | Run convergence study against analytic slab and/or external-tool fixtures. |
| Flat Earth lateral extent | Any disk radius, dome wall, finite patch, or local-Sun height is a proposed model assumption, not an Earth-atmosphere source value. | Record the hypothesis and provenance before using it as fixture input. |
| Ray/sphere intersection expected distances | Expected distances are geometry-derived, not directly tabulated environmental data. | Favor controlled intersection data for `resolveRayPath` stage tests. Put ray/sphere math fixtures under a future geometry-helper spec with explicit radius/top-altitude source rows and derivation notes. |
| Arbitrary "large" path values | No source-backed boundary. | Do not add as extremes. Replace with a geometry/model-owned sourced boundary such as a documented atmosphere/profile extent, Kasten-Young air-mass row, or an explicitly named flat-model hypothesis before the value is returned to `resolveRayPath`. |

## Current Fixture Files

- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/analytic-invariants.json`
  contains the current known-answer fixture rows for the analytic spine.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/ray-path-contracts.json`
  contains controlled model-returned interval rows for the `resolveRayPath`
  stage contract. These are not geometry-derived values; geometry/model tests
  remain responsible for producing real intersections and boundaries.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-samples-contracts.json`
  contains controlled `rayPath` to `viewSamples` rows for the `sampleViewPath`
  stage contract. These are not medium-evaluation or optical-depth fixtures;
  they test midpoint sample construction from an already selected path.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/medium-contracts.json`
  contains controlled `evaluateMedium` stage rows, sourced Earth-profile and
  dry-air-composition rows, CIE visible-grid shape rows, and follow-up extreme
  rows. The extreme rows now include paired positive and negative coverage for
  profile density, vacuum/coefficient consistency, full visible-grid shape,
  standard dry-air composition diagnostics, and coefficient validity. Those
  rows are wired as active `EvaluateMediumStage` tests.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`
  contains sourced and local-contract rows for the active
  `integrateViewOpticalDepth` hardening specs. It favors table/metadata rows
  over regenerated algorithms for CIE, ASTM, Bucholtz, and Kasten/Young data,
  and it explicitly marks convergence/sample-count data as blocked until an
  independent convergence artifact exists.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/solar-transmittance-contracts.json`
  contains the first `integrateSolarTransmittance` stage rows. It uses
  controlled model-owned solar-source samples and source-path segments to test
  source-path optical-depth/transmittance integration, source visibility,
  metadata preservation, and invalid source-path data without testing geometry.
## Candidate `evaluateMedium` Source Data

Controlled fixture rows should use small fixture-owned values so they test
packet/model contracts, not a new atmosphere model. The following external
sources are enough to justify the first fixture batch:

- PBRT Rays: position derivation `r(t) = o + t*d`, used for sample position
  rows such as observer `[1, 2, 3]`, unit direction `[0, 1, 0]`, and sample
  distance `5 km -> [1, 7, 3]`.
- PBRT Volume Scattering Processes: absorption coefficient `sigma_a` and
  scattering coefficient `sigma_s` are nonnegative reciprocal-distance rates;
  extinction/attenuation is `sigma_t = sigma_a + sigma_s`.
- Reference Code Design: model interfaces own altitude, density, contains, and
  coefficient returns; `evaluateMedium` copies/evaluates them rather than
  inventing geometry or physics constants.

Earth-profile candidates that are ready to pin after the output shape is
decided:

Data-first rule for this batch: when a fixture represents Earth atmosphere or a
standard spectral grid, pin table/dataset rows directly. Do not generate the
expected density, pressure, temperature, or grid extent from a new local
implementation of the standard-atmosphere equations when an authoritative or
auditable table row is available.

| Fixture need | Candidate row | Source/provenance | Status |
| --- | --- | --- | --- |
| Sea-level density checkpoint | Geometric altitude `0 km`, geopotential altitude `0.0 km`, temperature `288.150 K`, pressure `1.0132E+05 Pa`, density `1.2250E+00 kg/m3`, density ratio `1.0000E+00`. | PDAS U.S. Standard Atmosphere 1976 big table, Table 1 SI units; NASA NTRS record `19770009539` identifies the source standard as U.S. Standard Atmosphere 1976, NOAA-S/T-76-1562 / NASA-TM-X-74335. | Ready as a rounded table row. Prefer the original NASA PDF table before package-facing publication. |
| High-altitude density checkpoint | Geometric altitude `80 km`, geopotential altitude `79.0 km`, temperature `198.639 K`, pressure `1.0525E+00 Pa`, density `1.8458E-05 kg/m3`, density ratio `1.5068E-05`. | PDAS U.S. Standard Atmosphere 1976 big table, Table 1 SI units. | Ready as an accessible table row inside the lower-atmosphere profile range. |
| Upper-supported density checkpoint | Geometric altitude `85 km`, geopotential altitude `83.9 km`, temperature `188.893 K`, pressure `4.4568E-01 Pa`, density `8.2195E-06 kg/m3`, density ratio `6.7098E-06`. | PDAS U.S. Standard Atmosphere 1976 big table, Table 1 SI units. | Ready as an accessible near-edge row for the lower table. Prefer original PDF audit before package-facing publication. |
| Standard dry-air composition | NASA Table 3 fractional-volume rows: `N2 0.78084`, `O2 0.209476`, `Ar 0.00934`, `CO2 0.000314`, `Ne 0.00001818`, `He 0.00000524`, `Kr 0.00000114`, `Xe 0.000000087`, `CH4 0.000002`, `H2 0.00000005`; listed-fraction sum `0.999996697`; residual `0.000003303`. | NASA NTRS U.S. Standard Atmosphere 1976 PDF, Table 3, printed page 3. | Ready for composition diagnostics. The homosphere consistency row should be scoped to the selected dry-air adapter and profile support, not asserted as a broad thermospheric-composition claim. |
| Visible wavelength grid alignment | `360-830 nm`, `1 nm` steps, `471` rows, md5 `17cca777db64b17170f06f67ce9d3ab7`. | Official CIE 1931 colour-matching functions, 2 degree observer dataset, DOI `10.25039/CIE.DS.xvudnb9b`. | Ready for grid-shape/alignment fixtures, not as atmospheric coefficient values. |
| Full clear-sky spectral coefficient/profile fixture | G-173/SMARTS conditions include U.S. Standard Atmosphere with 33 layers, absolute air mass `1.5`, zenith `48.19 deg`, turbidity `0.084`, water vapor `1.42 cm`, ozone `0.34 cm`, light-soil albedo, and SMARTS 2.9.2. | NLR/NREL Reference Air Mass 1.5 Spectra and SMARTS pages. | Not ready for `evaluateMedium` coefficients until we implement the same atmosphere/aerosol/absorber assumptions or use SMARTS as an external generated fixture. |

The next fixture family should probably be a separate authoritative-data
fixture file for CIE and ASTM ingestion checks, rather than mixing large table
metadata into the toy analytic invariant file.
