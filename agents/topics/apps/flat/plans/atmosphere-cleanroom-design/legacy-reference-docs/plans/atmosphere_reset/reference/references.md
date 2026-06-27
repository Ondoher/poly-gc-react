# Reference Decision Log

This is the running list of external references consulted for the CPU spectral
atmosphere reference integrator and the decisions or test expectations they
inform.

Use this document as a traceability log. The goal is not to collect links for
their own sake; the goal is to know why a domain expectation, physical range,
test fixture, or implementation constraint exists.

## Log Rules

- Add a reference when it changes a design decision, test expectation, value
  range, fixture, or implementation review checklist.
- Record the decision in domain terms, not code terms.
- Separate hard invariants from plausibility ranges and reference-data
  fixtures.
- For code checks as well as tests, record whether the reason is an external
  physics/math constraint or a local API/schema policy. Physics-backed checks
  need an external source; local policies should cite the project design or
  fixture schema instead of being presented as physics.
- For expected-input extremes, prefer source data over sourced algorithms.
  Use authoritative dataset ranges, table extents, specified reference
  conditions, selected model species lists, or convergence evidence. Do not
  invent "large enough" or "small enough" limits without a source-backed
  boundary or explicit local numerical policy.
- For proposed flat-world geometry, distinguish external Earth-atmosphere data
  from hypothesis parameters. A flat disk radius, dome wall, finite patch, or
  local-Sun height can be a fixture input only when named as a model assumption
  with provenance or an explicit hypothesis label. Do not hide those values as
  numerical integration caps.
- Include the assumptions needed before a value from the reference can be used
  as an expected value.
- For expected values, record the quantity, source class, source citation or
  tool version, assumptions, pinned value or fixture path, tolerance, and why
  the expectation is independent of the implementation.
- Every JSON expectation row must have a canonical `reference` object with
  `id`, `kind`, `title`, `url` or `path`, `locator`, and
  `derivationSummary`. This applies even when the row is backed by a local
  design contract. In that case the local design document is the immediate
  reference, and the design document must carry the deeper rationale for the
  constraint.
- Every expected datum that enters a spec or fixture must have a nearby
  derivation note. In specs this should usually be a comment; in JSON fixtures,
  store it as part of the data itself. Exact value arithmetic can live beside
  each value as `expected.<quantity>.derivation`. The note can be brief, but it
  must identify the equation, table, metadata field, external tool/config, or
  provenance record well enough for a reviewer to locate the expectation.
- Mark preliminary references as preliminary when they are useful for direction
  but should later be replaced or reinforced by a more authoritative source.
- Mark secondary sources when they are used as stepping stones. Before a
  source-backed value or claim becomes package-facing, audit whether a primary
  source should replace or reinforce the secondary source.
- Generated expected fixtures are acceptable when they come from an independent
  external source, such as a standards dataset, published tool, or separately
  validated radiative-transfer package. Record source version, input config,
  command, output artifact, and provenance.
- For external library candidates, record the library source, purpose,
  validation basis, license, redistribution constraints, version policy,
  wrapper boundary, and the domain tests used to approve or reject it.
- Do not copy source code from external projects; mine equations, invariants,
  constants, fixtures, and verification discipline.

## Expected-Value Intake Workflow

Use this workflow before a pending test shell becomes a real validation test.

1. Identify the quantity being checked.
2. Classify the source:
   - `hand-derived analytic`
   - `authoritative table`
   - `metadata/checksum`
   - `published example`
   - `external-tool fixture`
3. Record the source: citation, URL, DOI, tool name/version, or standard.
4. Record the assumptions: units, geometry, wavelength grid, atmosphere
   profile, source model, surface model, numerical method, and sign convention.
5. Pin the expected value: literal, checked fixture row, checksum, or fixture
   artifact path.
6. Write the derivation note that will sit next to the expected literal,
   fixture row, generated fixture output, checksum, or sample expectation.
   Use a spec comment for inline expectations. For JSON fixtures, use the
   canonical `reference` object for source context and
   `expected.<quantity>.derivation` for exact value arithmetic.
7. Record the tolerance rule.
8. Add a review note explaining why the expected value is independent of this
   implementation.

Do not compute an expected value by calling the production helper under test or
by writing a second new local implementation. If an expected table is generated,
it must come from an independent external source and be checked in with
provenance.

## Current Expectation Batch

These are the first expected values to use while filling the analytic invariant
spine. They are intentionally tiny hand-derived cases, not Earth atmosphere or
sky-color comparisons.

Encoded fixture artifact:
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/analytic-invariants.json`.
Its rows use the canonical JSON `reference` object with `id`, `kind`, `title`,
`url` or `path`, `locator`, and `derivationSummary` fields.
The current artifact contains 16 analytic/error-contract rows.

| Test area | Source class | Source | Assumptions | Pinned expectation |
| --- | --- | --- | --- | --- |
| Vacuum transmittance | hand-derived analytic | PBRT transmittance invariant | no extinction, any finite distance | `tau = 0`, `T = 1` |
| Zero-length transmittance | hand-derived analytic | PBRT optical-depth path integral | nonzero extinction, `d = 0 km` | `tau = 0`, `T = 1` |
| Homogeneous transmittance | hand-derived analytic | PBRT Beer-Lambert equation | `sigma_t = 0.2 / km`, `d = 3 km` | `tau = 0.6`, `T = 0.5488116360940264` |
| Split-path transmittance | hand-derived analytic | PBRT multiplicativity invariant | `tau_ab = 0.2`, `tau_bc = 0.4` | `T_ac = 0.5488116360940264` |
| Empty transport path | hand-derived analytic/API schema | PBRT path integral plus local packet schema | no samples, `d = 0 km`, `wavelengthsNm = [550]` | explicit `sampleCount = 0`, `tau = [0]`, `T = [1]` |
| Two-sample monotonic transport | hand-derived analytic | PBRT optical-depth integral and Beer-Lambert equation | `sigma_t = 0.2 / km`, intervals `[1.5, 1.5] km` | checkpoints `[1.5, 3] km`, `tau = [0.3, 0.6]`, `T = [0.7408182206817179, 0.5488116360940264]` |
| Multi-wavelength homogeneous transport | hand-derived analytic | PBRT wavelength-varying medium properties and Beer-Lambert equation | `sigma_t = [0.1, 0.2] / km`, `d = 3 km`, wavelengths `[450, 650] nm` | `tau = [0.3, 0.6]`, `T = [0.7408182206817179, 0.5488116360940264]` |
| Multi-species homogeneous transport | hand-derived analytic | PBRT extinction/attenuation definition plus local species diagnostics schema | Rayleigh `0.1 / km`, Mie `0.2 / km`, `d = 3 km`, `wavelengthsNm = [550]` | species `tau = [0.3]` and `[0.6]`, total `tau = [0.9]`, `T = [0.4065696597405991]` |
| Negative extinction rejection | invariant/error contract | PBRT nonnegative attenuation rates plus local loud-failure policy | Rayleigh `sigma_t = [-0.1] / km`, `wavelengthsNm = [550]` | `RangeError` with message context for negative extinction, species, and wavelength |
| Weighted sampled transport | hand-derived analytic | PBRT optical-depth path integral plus local sample-weight packet contract | sample weights `[0.25, 0.75, 2] km`, sample extinction `[[0.4], [0.2], [0.1]] / km` | `tau = [0.45]`, `T = [0.6376281516217733]` |
| Coefficient/wavelength shape rejection | local API/schema contract | local spectral-array API contract | wavelengths `[450, 650] nm`, Rayleigh extinction `[0.1] / km` | `RangeError` naming species, extinction, and `wavelengthsNm` |
| Invalid sample-weight rejection | invariant/error contract | PBRT path-distance integral plus local stage contract | sample weights `[1, -0.5] km`, extinction `[[0.2], [0.2]] / km` | `RangeError` naming sample weight and negativity |
| Isotropic phase | hand-derived analytic | PBRT phase-function definition | phase independent of direction | `1 / (4 * pi) = 0.07957747154594767` |
| One-sample scattering | hand-derived analytic | PBRT volume-scattering in-scattering, specialized by [Code Design](code_design.md) | `T_view = 0.5`, `beta_sca = 0.2`, `phase = 0.25`, `source = 4`, `T_source = 0.8`, `ds = 2` | contribution `0.16` |
| Black Lambertian | hand-derived analytic | PBRT diffuse reflection, specialized by [Code Design](code_design.md) | albedo `0` | `L = 0` |
| White Lambertian | hand-derived analytic | PBRT diffuse reflection, specialized by [Code Design](code_design.md) | albedo `1`, direct irradiance `E = pi`, normal incidence | `L = 1` before view attenuation |

## Removed Diffuse Sky Airlight Fixture Batch

Historical encoded fixture artifact:
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/diffuse-sky-airlight-contracts.json`.

This batch belonged to the removed airlight approximation stage,
`integrateDiffuseSkyAirlight`. It is retained here only as historical context
for why that proxy was backed out. It is not part of the current reference
contract.

| Fixture row | Source class | Source basis | Assumptions | Pinned expectation |
| --- | --- | --- | --- | --- |
| `diffuse-sky-airlight.low-tau.no-lift` | hand-derived analytic | PBRT volume transport order plus libRadtran direct/diffuse component precedent | `maxVisibleTau = 0.4`, `strength = 0.02`, `activation = smoothstep(1, 8, maxTau)`, new numerical key `diffuseSkyAirlightStrength` | mode `aerosol-aware-lost-transmittance-haze-lift`, activation `0`, sky airlight `[0, 0]`, rendered `[0.1, 0.2]` |
| `diffuse-sky-airlight.high-tau.lost-transmittance` | hand-derived analytic | PBRT volume transport order, Beer-Lambert view transmittance, Bruneton/libRadtran calibration discipline | `maxVisibleTau = 6`, `strength = 0.02`, source `[2, 1]`, view transmittance `[exp(-6), exp(-2)]`, no aerosol species depth | mode `aerosol-aware-lost-transmittance-haze-lift`, activation `275/343`, sky airlight `[0.031990477335442184, 0.01386488612885898]`, rendered `[0.1319904773354422, 0.21386488612885898]`, diagnostic contract object |
| `diffuse-sky-airlight.high-tau.aerosol-aware` | hand-derived analytic | PBRT volume transport order, PBRT Beer-Lambert transmittance, Bruneton/libRadtran calibration discipline, local bounded flat-geometry policy | same high-tau row plus Mie tau `[4, 1]`; aerosol participation `mieTau / totalTau * (1 - exp(-mieTau))`; neutral mix cap `0.6`; gain `1 + 1.5 * participation` | aerosol saturation `[0.9816843611112658, 0.6321205588285577]`, aerosol participation `[0.6544562407408439, 0.31606027941427883]`, sky airlight `[0.05388577434411065, 0.023667930940134668]`, rendered `[0.15388577434411066, 0.22366793094013468]` |
| `diffuse-sky-airlight.aerosol-diagnostics` | invariant/error contract | libRadtran aerosol/radiance/RTE boundary plus Bruneton aerosol-complexity discussion | fixture species tau: Rayleigh `[3, 1]`, Mie `[4, 2]`, ozone `[0.2, 0.1]`, total tau `[7.2, 3.1]` | aerosol tau `[4, 2]`, aerosol fractions `[4/7.2, 2/3.1]`, max aerosol tau `4`, tau regime `single-scattering-warning`, flat policy `bounded-asymptotic-required` |

Current implementation status: removed from stage registry, packet types,
fixtures, direct specs, composition, and CLI comparison modes.

Derivation-note seeds to carry into specs or fixtures:

- Vacuum transmittance:
  `Expected: PBRT transmittance invariant; sigma_t = 0 gives tau = 0 and T = 1.`
- Zero-length transmittance:
  `Expected: PBRT optical-depth path integral; path length 0 gives tau = 0 and T = 1 even with nonzero sigma_t.`
- Homogeneous transmittance:
  `Expected: PBRT homogeneous Beer-Lambert; tau = 0.2 * 3 = 0.6, T = exp(-0.6).`
- Split-path transmittance:
  `Expected: PBRT transmittance multiplicativity; tau_ab + tau_bc = 0.6, so T_ac = exp(-0.6).`
- Empty transport path:
  `Expected: PBRT optical-depth path integral over no segment gives tau = 0 and T = 1; local packet schema keeps explicit empty sample arrays and path-end totals.`
- Two-sample monotonic transport:
  `Expected: PBRT homogeneous Beer-Lambert at cumulative checkpoints; tau = 0.2 * [1.5, 3] = [0.3, 0.6], T = exp(-tau).`
- Multi-wavelength homogeneous transport:
  `Expected: PBRT wavelength-indexed extinction; tau(lambda) = [0.1, 0.2] * 3 = [0.3, 0.6], T(lambda) = exp(-tau(lambda)).`
- Multi-species homogeneous transport:
  `Expected: PBRT extinction contributors add; tau_R = 0.1 * 3 = 0.3, tau_M = 0.2 * 3 = 0.6, tau_total = 0.9, T = exp(-0.9).`
- Negative extinction rejection:
  `Expected: PBRT attenuation coefficients are nonnegative rates; negative rayleigh extinction at 550 nm is invalid model data and should raise the named local error.`
- Weighted sampled transport:
  `Expected: PBRT path integral over sampled piecewise-constant intervals; tau = 0.4 * 0.25 + 0.2 * 0.75 + 0.1 * 2 = 0.45, T = exp(-0.45).`
- Coefficient/wavelength shape rejection:
  `Expected: local spectral-array contract; one coefficient cannot define two wavelength samples without an explicit interpolation or broadcast policy.`
- Invalid sample-weight rejection:
  `Expected: PBRT optical-depth integral uses ds as path distance; negative sample weight would subtract optical depth and should raise the named local error.`
- Isotropic phase:
  `Expected: PBRT phase-function definition; isotropic p = 1 / (4 * pi).`
- One-sample scattering:
  `Expected: PBRT in-scattering source function specialized by reference code design; contribution is T_view * beta_sca * phase * source * T_source * ds = 0.16.`
- Black Lambertian:
  `Expected: PBRT diffuse reflection f = R / pi specialized to direct irradiance; albedo 0 makes reflected radiance 0.`
- White Lambertian:
  `Expected: PBRT diffuse reflection f = R / pi specialized to direct irradiance; albedo 1, E = pi, cosTheta = 1 gives L = E / pi = 1.`

## Consulted References

### Bruneton, Precomputed Atmospheric Scattering: A New Implementation

Link: https://ebruneton.github.io/precomputed_atmospheric_scattering/

Consulted for:

- CPU reference discipline for validating shader/scattering math.
- Warning signs in atmosphere implementations: ad-hoc constants, unphysical
  solar spectra, direct display of radiance without colorimetric conversion,
  and missing tests.
- Full spectral CPU renderings as a trusted comparison target for GPU
  approximations.

Decisions:

- Build a slow CPU spectral reference before tuning the shader.
- Keep solar spectrum configurable and physical, not a constant RGB or
  arbitrary scalar.
- Convert spectral radiance through explicit CIE/XYZ/display consumer APIs.
- Treat dimensional consistency and unit-bearing names as part of the review
  checklist.
- Avoid planet- or coordinate-map-specific constants unless they are explicit
  model properties.

Assumptions and limits:

- We are not copying Bruneton code.
- Bruneton is a verification and architecture precedent; our pipeline remains
  stage-testable and JSON/CLI friendly for this project.

Status:

- Reflected in [Code Design](code_design.md), [Test Design](test_design.md),
  and the reference-mined verification ranges.
- Also supports the `resolveRayPath` testing discipline: use isolated runtime
  tests for stage behavior, avoid ad-hoc constants, and keep geometry/model
  parameters explicit instead of burying them in shader or integrator code.

### Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models

Links:

- Paper: https://arxiv.org/abs/1612.04336
- Source repository: https://github.com/ebruneton/clear-sky-models
- Source constants:
  https://raw.githubusercontent.com/ebruneton/clear-sky-models/master/atmosphere/atmosphere.h
- Source formula:
  https://raw.githubusercontent.com/ebruneton/clear-sky-models/master/atmosphere/atmosphere.cc

Consulted for:

- The model-comparison assumptions behind the Bruneton 2016 sky-dome tables.
- Aerosol/Mie scalar parameters used in the paper comparison.
- The normalized Cornette-Shanks aerosol phase function used by the reference
  implementation.
- The Task 3 `bruneton-2016-no-visible-absorption` policy, which represents
  the paper comparison's no visible air-molecule absorption assumption as a
  named zero-cross-section absorber policy.
- Figure 1 display-chain notes for later image-level comparison: spectral
  radiance, CIE color matching, XYZ to linear sRGB, and exponential tone
  mapping.

Pinned source facts:

- The paper's comparison setup assumes no visible air-molecule absorption, a
  wavelength-independent aerosol phase function, Lambertian ground, fixed
  grass spectral albedo, aerosol scale height `1.2 km`, aerosol
  single-scattering albedo `0.8`, Angstrom aerosol optical depth
  `beta * lambda_um^-alpha`, and Cornette-Shanks phase parameter `g`.
- The selected aerosol values are `alpha = 0.8`, `beta = 0.04`, and `g = 0.7`.
  The source implementation constants match these values.
- In the local `aod550` schema, the paper's `beta = 0.04` maps to
  `0.04 * 0.55^-0.8 = 0.0645312146448`, matching the existing
  `bruneton-2016-kider-fit` scalar preset.
- Sea-level aerosol extinction for that schema is
  `aod(lambda) / 1.2 km`; sea-level aerosol scattering is extinction times
  the source-backed single-scattering albedo `0.8`.
- The source implementation's normalized Cornette-Shanks phase is:
  `P_CS(mu, g) = 3 / (8 * pi) * (1 - g^2) / (2 + g^2) * (1 + mu^2) / (1 + g^2 - 2 * g * mu)^(3/2)`.
- Under the current `evaluateScatteringPhase` convention,
  `cosTheta = dot(sourceDirectionFromSample, directionFromSampleToCamera)`.
  The aerosol phase's physical incoming/outgoing cosine is interpreted as
  `mu = -cosTheta`, matching the current Henyey-Greenstein implementation
  convention.
- For `g = 0.7`, the source-pinned fixture targets are:
  `P_CS(mu = 1) = 1.81100002180`,
  `P_CS(mu = 0) = 0.0134422764093`, and
  `P_CS(mu = -1) = 0.00995257492133`.

Decisions:

- Treat Cornette-Shanks as the paper-aligned aerosol phase for the
  `bruneton-2016-kider-fit` comparison.
- Keep Henyey-Greenstein as an explicit same-scalar control policy rather than
  as the implicit Bruneton/Kider aerosol behavior.
- Isolate the first output-impact comparison to phase shape only: hold AOD,
  Angstrom exponent, single-scattering albedo, scale height, sampling,
  wavelength grid, geometry, Sun rows, display policy, and multiple-scattering
  mode fixed.

Assumptions and limits:

- We are not copying Bruneton code. The paper and source implementation are
  used to pin the public formula, constants, units, and comparison contract.
- The image table is a model-family comparison target, not proof that the
  model matches photographs. It should guide Bruneton-method parity before
  photographic tuning.

Status:

- Implemented in Output-Impact Task 1. The source-backed facts now drive named
  aerosol phase policies, Cornette-Shanks support in
  `evaluateScatteringPhase`, the same-scalar Henyey-Greenstein control, and
  the first phase-only comparison artifact under
  `tmp/atmosphere/bruneton/001-aerosol-phase-policy/`.

### Homolya, WebGL Atmosphere Shader Observable Notebook

Link: https://observablehq.com/@mateh/webgl-atmosphere-shader

Consulted for:

- A practical browser/Three.js wrapper around a Bruneton-style precomputed
  atmosphere shader.
- Future shader-mining ideas: full-screen atmosphere pass, separate
  transmittance/scattering/irradiance lookup textures, packed 3D scattering
  data, finite solar disk composition, and tone-mapping placement.

Decisions:

- Keep this notebook as a future shader-parity reference, not as source-backed
  physical fixture data for the CPU reference.
- Do not depend on the live Observable notebook or its Skypack/module
  packaging; mine structure and implementation ideas only.
- Treat the bundled lookup-table artifacts as implementation examples unless
  their generation process, version, units, atmosphere configuration, license,
  and validation provenance are independently pinned.

Assumptions and limits:

- The notebook is client-rendered and depends on Observable file attachments,
  older Skypack imports, and WebGL2/integer texture behavior that may be
  brittle in modern browsers.
- It cites Bruneton's implementation as its atmosphere basis, but it is not the
  primary physics or validation source for this project.

Status:

- Retained for later shader design and GPU approximation review.
- Not approved as an expected-value fixture source for
  `integrateDiffuseSkyAirlight` or other CPU reference approximation tests.

### PBRT v4, Transmittance

Link: https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance

Consulted for:

- Beam transmittance and optical-depth definitions.
- Beer-Lambert closed form for homogeneous media.
- Transmittance invariants.

Decisions:

- Represent optical depth as `tau(lambda) = integral sigma_t ds`.
- Represent transmittance as `T(lambda) = exp(-tau(lambda))`.
- Enforce `T` in `[0, 1]` for physically valid transport.
- Use vacuum and zero-length paths as exact `tau = 0`, `T = 1` cases.
- Use multiplicativity, `T(a,c) = T(a,b) * T(b,c)`, as a core invariant.
- Use homogeneous media as closed-form stage tests before inhomogeneous
  numerical tests.

Assumptions and limits:

- PBRT uses rendering notation and some direction conventions that must be
  mapped explicitly to this integrator's ray/source conventions.

Status:

- Reflected in the `integrateViewOpticalDepth` and
  `integrateSolarTransmittance` test matrix.

### PBRT v4, Rays

Link: https://www.pbr-book.org/4ed/Geometry_and_Transformations/Rays

Consulted for:

- Ray origin and direction semantics.
- Parametric ray evaluation as a point plus distance-like parameter times a
  direction vector.
- Finite-origin and finite-direction validation expectations.

Decisions:

- Treat `observer.positionKm` as the ray origin in model kilometers.
- Treat `ray.direction` as an orientation vector, not a physical magnitude.
- Canonicalize a valid direction to unit length so downstream view-path
  parameters and sample distances remain in kilometers.
- Reject missing, non-3-vector, non-finite, zero, or near-zero directions
  before transport stages run because they do not define a stable ray
  orientation.

Assumptions and limits:

- PBRT's ray definition is geometry/rendering notation, not an atmosphere model.
  It supports our request-shape and ray-domain validation, but it does not
  provide atmosphere coefficients, optical-depth values, or sky-color
  expectations.
- The near-zero threshold is a numerical stability policy for this integrator's
  unit-vector canonicalization; PBRT supplies the ray semantics, while the
  exact threshold remains a local API contract.

Status:

- Reflected in `validateRequest` tests and runtime comments for
  `observer.positionKm` and `ray.direction`.

### PBRT v4, Camera Interface

Link: https://www.pbr-book.org/4ed/Cameras_and_Film/Camera_Interface

Consulted for:

- Camera-to-ray separation: the camera generates rays while the integrator
  computes radiance along those rays.
- Projective camera precedent for resolving image/sample coordinates into ray
  origins and directions.
- Keeping film/display concerns separate from transport.

Decisions:

- Treat benchmark cameras as pre-transport adapters that materialize
  `observer.positionKm` and normalized `ray.direction`.
- Keep camera/display decisions out of canonical transport stages.
- Start Phase 6A with a deterministic pinhole camera adapter: local basis,
  FOV/aspect, and NDC sample coordinates.
- Emit camera diagnostics so shader/browser parity can later prove it is using
  the same camera origin, basis, and ray directions.

Assumptions and limits:

- PBRT supplies rendering architecture and ray-generation precedent, not this
  project's globe/flat coordinate conventions or atmosphere values.
- We are not copying PBRT code. The project owns its JSON schema, model-axis
  mapping, and diagnostic field names.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#camera-adapter-design)
  and the Phase 6A benchmark camera plan.

### EPSG Dataset, WGS 84 Ellipsoid

Link: https://epsg.org/ellipsoid_7030/WGS-84.html

Consulted for:

- Canonical WGS84 reference ellipsoid constants for globe benchmark camera and
  world adapters.
- Avoiding a mean-radius spherical intermediate for the Earth-calibration
  benchmark path.

Decisions:

- Phase 6A globe benchmarks should use WGS84 from the start.
- Canonical constants are EPSG 7030 semi-major axis `6378137 m` and inverse
  flattening `298.257223563`. Convert the semi-major axis to
  `6378.137 km` at the reference module boundary.
- Derive flattening, semi-minor axis, eccentricity, and top-atmosphere
  ellipsoid axes from those canonical constants instead of duplicating them as
  independent source-of-truth values.
- Keep the app's mean Earth radius `6371.0088 km` only for controlled
  spherical fixtures, older app-context notes, or explicitly named comparison
  scenarios.

Assumptions and limits:

- EPSG 7030 defines the reference ellipsoid constants. It does not define this
  project's atmosphere top, source model, shader axes, or benchmark exposure
  policy.
- The first WGS84 benchmark can still use simplified clear-air atmosphere
  profiles, but their altitude must be ellipsoid-relative and reported as such.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#camera-adapter-design),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  and the Phase 6A globe camera/world adapter plan.

### Benchmark Target Encoding And Flat Projection Policy

Source: local design decision recorded in
[Atmosphere Reset Design](../design.md#camera-adapter-design) and existing
flat app projection direction in [Flat Status](../../status.md#poc-scope).

Consulted for:

- Keeping benchmark target authoring readable across globe and flat worlds.
- Avoiding direct model-space coordinates as the default hand-authored target
  format.
- Declaring how flat hypothesis runs adapt Earth latitude/longitude anchors.

Decisions:

- Hand-authored benchmark targets default to geodetic latitude/longitude plus
  `elevationKmMsl`.
- Absolute geodetic anchors are preferred over persisted observer-relative
  bearing/range because they make location changes and globe/flat comparisons
  easier to review.
- `distanceFromEarthCenterKm` is an explicit alternate datum for
  geocentric/shell-like probes and must not be mixed with `elevationKmMsl`.
- Flat-world hypothesis runs adapt geodetic target anchors through the
  north-pole-centered azimuthal equidistant projection unless a scenario later
  declares another projection.
- Visible/hittable markers, such as `marker.red`, should be fixture-owned
  surfaces so anchor, shape, normal, material, and hit ids have one source of
  truth.

Assumptions and limits:

- `elevationKmMsl` names the benchmark intent: height above the sea-level
  reference surface. If Phase 6A does not include a geoid or terrain source,
  the WGS84 adapter may use the WGS84 ellipsoid as an explicit temporary
  sea-level approximation and must report that datum in diagnostics.
- The north-pole-centered azimuthal equidistant projection is the current flat
  hypothesis projection, not an Earth-validation model.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#camera-adapter-design),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  and the camera/status docs.

### Benchmark Coordinate System Roles

Source: local design decision recorded in
[Atmosphere Reset Design](../design.md#coordinate-spaces-and-transform-core).

Consulted for:

- Separating permanent location facts from observer-local intent and generated
  render endpoints.
- Deciding which coordinate spaces should be persisted in benchmark scenarios
  versus emitted as diagnostics.
- Preventing app scene coordinates, shader coordinates, and geodetic
  coordinates from becoming parallel sources of truth.

Decisions:

- Permanent benchmark facts use geodetic coordinates.
- Subjective/view-local intent uses observer-relative coordinates.
- Three/app scene coordinates are future generated render endpoints for object
  placement, camera placement, shader uniforms, and browser capture parity.
  The current reference-proof slice stops at CPU reference model coordinates,
  rays, and diagnostics.
- WGS84 ECEF, ENU, flat projection coordinates, object-local coordinates, view
  space, clip/NDC, framebuffer UV, and texture UV are operational bridge
  spaces, not durable benchmark ownership formats.
- Coordinate bridges should emit frame metadata: `frameId`, source frame,
  target frame, datum, projection id when applicable, handedness, and basis
  vectors.

Assumptions and limits:

- This is a local architecture policy rather than an external physics
  reference. EPSG/Navipedia still own the WGS84/ENU math references; this entry
  owns how the project uses those frames.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#coordinate-spaces-and-transform-core),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  and the reference transform/camera contracts.

### Derived Transform Cache Policy

Source: local design decision recorded in
[Atmosphere Reset Design](../design.md#derived-transform-precompute-and-cache-policy).

Consulted for:

- Deciding whether repeated world/camera/target transform calculations can be
  precomputed during benchmark configuration.
- Keeping generated bridge transforms reproducible without turning them into
  parallel sources of truth.
- Defining cache-key and diagnostic expectations for later app/shader endpoint
  adapters.

Decisions:

- Deterministic coordinate bridge outputs may be precomputed or cached when
  they are derived from canonical inputs.
- Good candidates include WGS84 derived constants, ECEF/ENU origins and bases,
  flat azimuthal-equidistant projection results, target resolution, camera
  basis vectors, and NDC ray grids for the current reference-proof slice.
  Object placement transforms and shader uniform matrices are later cache
  candidates after app and shader endpoint adapters exist.
- Cache keys must include all source inputs that can change the result,
  including world-set id, source and target frames, datum or height datum,
  projection id/options, WGS84 constant version, observer and target anchors,
  time or solar-ephemeris inputs when applicable, lens FOV/aspect/NDC grid,
  orientation/roll, and flat projection or boundary settings.
- Cache consumers should fail loudly on `frameId` or key mismatches and
  recompute when canonical inputs change.
- Cached values may appear in diagnostics or temporary runtime artifacts with
  provenance. They should not be persisted in scenario JSON as source facts.

Assumptions and limits:

- Rounded diagnostic values are for reports only and must not feed back into
  transport physics.
- If a later app runtime cache stores generated transforms for performance, the
  scenario and benchmark fixtures still own only the canonical inputs.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#derived-transform-precompute-and-cache-policy),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  [Reference Code Design](code_design.md#benchmark-camera-adapter-contract),
  and the status docs.

### Transform Core First Slice

Source: local design decision recorded in
[Atmosphere Reset Design](../design.md#camera-bridge-first-slice).

Consulted for:

- Scoping the shared transform system before the benchmark camera bridge is
  implemented.
- Separating camera-specific behavior from reusable coordinate, projection,
  frame, provenance, and cache-key helpers.
- Deciding which transform inventory rows are needed now and which remain
  later endpoint/parity work.

Decisions:

- Implement the first transform core under
  `scripts/flat/atmosphere_rejected/reference/transforms` until the contracts are
  proven.
- Keep the first API plain-data and named-transform based rather than a general
  graph solver.
- Build only the transforms needed for the camera bridge first: WGS84
  datum/height/geodetic/ECEF/ENU, first ECEF-to-globe model adapter, flat
  north-pole azimuthal equidistant projection, flat local-frame resolution,
  observer/target resolution, source direction resolution, plumb-aligned
  camera basis, NDC rays, provenance metadata, and deterministic cache-key
  fields.
- End the current implementation slice at CPU reference trace requests,
  deterministic JSON diagnostics, and CLI visual artifacts. Do not implement
  Three.js camera construction, app object mutation, shader uniform packing,
  browser ray reconstruction, floor texture UVs, or sky-dome projections as
  part of the reference proof.
- Define `rollDeg = 0` as image vertical parallel to the local plumb line.
  Implement that by projecting local `up` onto the image plane perpendicular to
  `forward`; roll degrees increase clockwise in the image plane with `0` at
  plumb-up/12 o'clock.
- Treat missing `rollDeg` as the normal default camera state. It resolves to
  `0`, produces the same basis as explicit `rollDeg: 0`, and records that the
  value was defaulted in diagnostics.
- Defer inverse ECEF diagnostics, real geoid/terrain conversion, Three.js
  object mutation, shader reconstruction, floor UV inversion, celestial/sky
  projections, source-path transport, and full fixture mesh generation.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#camera-bridge-first-slice),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  and [Reference Code Design](code_design.md#benchmark-camera-adapter-contract).

### Reference Proof Output And Atmosphere Priority

Source: local scope decision recorded in
[Atmosphere Reset Design](../design.md#benchmark-harness-overview).

Consulted for:

- Keeping Phase 6A centered on proof artifacts rather than app integration.
- Deciding how much camera/coordinate work is needed before visual review.
- Separating physical radiance diagnostics from display/image output choices.

Decisions:

- The current proof slice has two primary implementation targets: a trustworthy
  atmosphere model and a deterministic reference-output-to-pixels path.
- The pixel path is a post-pipeline consumer. It may apply display/exposure,
  clamping, gamma, and image encoding only after spectral radiance, XYZ, and
  linear RGB diagnostics are complete.
- First visual artifacts should be deterministic benchmark images or swatches
  whose pixels can be traced back to scenario id, probe id, display policy, and
  transport diagnostics.
- The atmosphere model should move toward Earth-like inputs first: WGS84,
  ellipsoid-relative altitude, real-Sun spectral irradiance, sourced Rayleigh
  coefficients, named aerosol/Mie defaults, and optional absorber/ozone
  variants.
- Camera and coordinate work should stay minimal until those two targets are
  working. A simple pinhole adapter, or explicit low-level rays for analytic
  probes, is enough when it can aim the first sky patches and record
  diagnostics.

Assumptions and limits:

- This decision does not remove the transform roadmap. It says the roadmap is
  not the next proof bottleneck.
- This decision does not make visual pixels the source of truth. JSON transport
  diagnostics remain canonical; pixels make the reference inspectable.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#benchmark-harness-overview),
  [Atmosphere Reset Plan](../plan.md#phase-6a-benchmark-worlds-cameras-and-cli-evidence),
  and [Reference Code Design](code_design.md#cli-shape).

### ESA Navipedia, Transformations Between ECEF And ENU Coordinates

Link: https://gssc.esa.int/navipedia/index.php/Transformations_between_ECEF_and_ENU_coordinates

Consulted for:

- The local east/north/up basis from latitude and longitude.
- Grounding globe-camera azimuth/elevation views in a standard geodetic frame
  before mapping into project model axes.

Decisions:

- Use an ECEF/ENU-derived local frame for globe benchmark cameras.
- Define benchmark azimuth clockwise from local north and elevation from the
  local horizon.
- Keep the project-axis mapping as a named adapter step with tests, because
  canonical ECEF axes and app model axes are not automatically identical.

Assumptions and limits:

- The first benchmark camera uses WGS84 ellipsoidal coordinates for observer
  placement and ENU basis construction.
- Navipedia supplies the local-frame transform. EPSG 7030 supplies the WGS84
  ellipsoid constants.

Status:

- Reflected in [Atmosphere Reset Design](../design.md#camera-adapter-design)
  and the Phase 6A globe camera test plan.

### `validateRequest` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/ValidateRequestStage.js`

Consulted for:

- Source breadcrumbs for request-envelope validation, canonicalization, and
  request-to-packet ownership decisions.

Decisions:

- `validateRequest` is the only stage that accepts the merged user/default
  request envelope. It validates the fields later physical stages consume and
  emits one canonical `validatedRequest` packet field.
- The model bundle owns behavior modules and physical constants. This stage
  checks that required owner modules expose the methods downstream stages call,
  but it preserves the model object instead of copying or rewriting model
  facts.
- `observer.positionKm` must be a finite 3-vector in model kilometers because
  later geometry and ray evaluation use it as the PBRT ray origin.
- `ray.direction` is a finite nonzero orientation vector and is normalized to a
  unit vector. The input magnitude is not physical input; unit length keeps
  downstream ray parameters and sample distances in kilometers.
- `wavelengthsNm` is the canonical spectral grid. The stage requires a
  nonempty strictly increasing array of positive finite nanometer values and
  preserves that order for wavelength-indexed arrays downstream. Single
  wavelength grids remain valid for analytic fixtures.
- Numerical controls are calculation settings, not physical constants. Known
  numeric controls must be finite nonnegative numbers, sample-count controls
  must be positive integers, and `maxStepKm` must be greater than or equal to
  `minStepKm`.
- Unknown numerical keys are dropped from `validatedRequest.numerical` so later
  stages only see the current numerical-control contract. Rejection of unknown
  request properties belongs to a future schema layer, not this stage.
- Extra request fields, including display/report fields and physical
  coefficient shadow fields, are tolerated as input but do not appear in the
  contracted `validatedRequest` output. Physical coefficients remain
  model-owned.
- The stage appends only its own stage id to `stageHistory` and leaves the
  original request/model/default objects unmutated.

Source support:

- PBRT v4 Rays supplies origin/direction vocabulary and the ray equation that
  motivates finite ray data and direction normalization.
- [Stage Contracts](stage_contracts.md#validaterequest) supplies the
  `validateRequest` input/output packet contract, tolerated-extra policy,
  numerical-control filtering, and downstream ownership.
- [Code Design](code_design.md#inputs) supplies the request shape, model
  interface ownership, physical-constant ownership, and separation between
  numerical controls and physics.
- The direct `ValidateRequestStage` specs provide fixture-backed API-shape
  coverage for valid requests, invalid vectors/grids/controls, model-interface
  checks, tolerated extras, and immutability.

Status:

- Branch/source remediation completed for `ValidateRequestStage.js`.

### PBRT v4, Phase Functions

Link: https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions

Consulted for:

- Phase-function normalization and reciprocity.
- Isotropic phase value.
- Henyey-Greenstein parameter range and behavior.
- Direction-convention warning for incident/outgoing vectors.

Decisions:

- Phase functions must integrate to one over solid angle.
- Isotropic phase value is `1 / (4 * pi)`.
- Henyey-Greenstein `g` must be inside `(-1, 1)`.
- `g = 0` should produce isotropic scattering.
- Scattering-angle sign and direction conventions must be documented in
  diagnostics.
- Keep `evaluateScatteringPhase` separate from
  `integrateSingleScattering` so angle and phase-function tests can run
  independently.

Assumptions and limits:

- PBRT's phase convention is not automatically our convention. Tests must make
  this integrator's convention explicit.

Status:

- Reflected in the canonical stage split and `evaluateScatteringPhase` tests.

### PBRT v4, Volume Scattering Processes

Link: https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes

Consulted for:

- Physical absorption, emission, out-scattering, and in-scattering process
  definitions.
- Scattering coefficient as probability per unit distance.
- In-scattering as incident radiance integrated against a phase function and
  scattering/attenuation terms.

Decisions:

- The first one-sample single-scattering fixture is a deliberately collapsed
  specialization of the in-scattering source term: one wavelength, one source
  sample, one view sample, one phase value, one source transmittance, and one
  step length.
- The expected contribution is the product of the named factors in that
  specialization, with no hidden color constants or display scaling.
- Any future full single-scattering tests must keep the source term,
  scattering coefficient, phase value, source transmittance, view
  transmittance, and step length separately visible in diagnostics.

Assumptions and limits:

- PBRT's chapter gives the physical in-scattering structure. Our one-sample
  fixture is a local analytic simplification chosen to make the arithmetic
  reviewable.
- The fixture uses "fixture radiance units" until the solar source and spectral
  radiance units are fully pinned for a real clear-sky run.

Status:

- Reflected in `analytic-invariants.json` for
  `single-scattering.one-sample.scalar-product`.

### PBRT v4, Diffuse Reflection

Link: https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection

Consulted for:

- Lambertian diffuse BRDF normalization.
- The `R / pi` factor that makes integrated hemispherical reflectance equal to
  reflectance `R`.
- The direct-illumination specialization used by the first surface fixtures.

Decisions:

- The first surface fixtures use a Lambertian model with leaving radiance
  `L = albedo * E * max(cosTheta, 0) / pi` before view attenuation.
- Black Lambertian direct illumination with albedo `0` returns `0`.
- White Lambertian normal-incidence direct illumination with albedo `1` and
  `E = pi` returns `1` before view attenuation.
- Surface albedo is spectral/model data, not RGB display color.

Assumptions and limits:

- PBRT's Lambertian BRDF is the external physics/reference source. Our
  direct-irradiance formula is the local reference design's first surface
  specialization.
- Specular, retroreflective, textured, and bidirectional surface effects remain
  out of the first reference pass.

Status:

- Reflected in `analytic-invariants.json` for the black and white Lambertian
  surface expectations.

### NREL/NLR ASTM G-173 AM1.5 Reference Spectra

Link: https://www.nlr.gov/grid/solar-resource/spectra-am1.5

Consulted for:

- Standard AM1.5 spectral irradiance fixture.
- Required environmental assumptions for using the reference spectra.
- Table column meanings and units.

Decisions:

- Use ASTM G-173 only as a pinned reference-data fixture when matching its
  assumptions.
- Do not treat G-173 as a generic clear-sky expectation.
- Record G-173 assumptions before using it in tests:
  absolute air mass `1.5`, solar zenith `48.19 deg`, surface tilt `37 deg`,
  1976 U.S. Standard Atmosphere, rural aerosol loading, Angstrom turbidity
  `0.084` at `500 nm`, water vapor column `1.42 cm`, ozone column `0.34 cm`,
  and light-soil spectral albedo.
- Treat table values as spectral irradiance in `W / m2 / nm`.
- The inspected NLR compressed data file contains `ASTMG173.csv` with `2002`
  spectral rows from `280 nm` through `4000 nm`. The grid is nonuniform:
  `0.5 nm` spacing through `400 nm`, `1 nm` spacing through `1700 nm`,
  transition rows at `1702`, `1705`, and `1710 nm`, then `5 nm` spacing
  through `4000 nm`.
- Local downloaded CSV provenance:
  `md5 95924ae078f81db8095621554b2b88b4`,
  `sha256 b48a6635ce398f7e0fa392150d68b5793ed7f2a65d9e2406bec7e6be9fb20954`.
- Selected row checks from the inspected CSV:
  `280.0 nm -> Etr 8.2000e-02, global tilt 4.7309e-23, direct+circumsolar 2.5361e-26`;
  `550.0 nm -> Etr 1.8630, global tilt 1.5399, direct+circumsolar 1.3648`;
  `4000.0 nm -> Etr 8.6800e-03, global tilt 7.1043e-03, direct+circumsolar 7.1199e-03`.

Assumptions and limits:

- A run must reproduce the G-173 setup before its direct normal or global tilted
  spectra become expected values.
- The data-file checks above are table-ingestion fixtures and spectral-source
  sanity checks. They are not by themselves optical-depth expectations for our
  view-path integrator.

Status:

- Reflected in `Reference-Mined Verification Ranges` in
  [Test Design](test_design.md).

### CIE 1931 2-Degree Color-Matching Functions

Link: https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer

Consulted for:

- Official spectral-to-XYZ fixture data.
- Dataset range, increment, metadata checksum, and validation rows.

Decisions:

- Use the official CIE table for exact spectral-to-XYZ tests.
- Adopt the table's `360-830 nm`, `1 nm` grid for full-table fixtures.
- Use linear interpolation only when explicitly supported by the stage.
- Use zero extrapolation outside `360-830 nm` only if the stage explicitly
  adopts that CIE metadata policy.
- Use the metadata checksum and validation sums as data-ingestion tests.

Assumptions and limits:

- The CIE table validates color conversion, not atmospheric transport.
- Any XYZ normalization constant must be a named design choice, not hidden in
  the integration code.

Status:

- Reserved for post-pipeline color-conversion consumer tests and verification
  ranges.

### Sky-Patch Preview Color And Ozone Upgrade

Implementation file:
`scripts/flat/atmosphere_rejected/run-reference-probe.js`

Consulted for:

- Preview spectral-to-display conversion for generated sky-patch artifacts.
- Preview visible ozone absorption shape for low-Sun paths.

Decisions:

- The sky-patch runner now uses a `380-780 nm` / `20 nm` grid for visual
  evidence instead of the older three debug wavelengths.
- Display conversion uses the Wyman/Sloan/Shirley analytic approximation to
  CIE 1931 XYZ and the standard XYZ-to-linear-sRGB matrix. This is a preview
  display bridge, not the package-level official-table CIE colorimetry module.
- The solar source uses a `5778 K` Planck-shape spectrum normalized to
  `1.87 W m-2 nm-1` at `550 nm`.
- Ozone is represented as an absorption-only species with an approximate
  `300 DU` column, a Gaussian layer centered at `25 km`, and two broad
  Chappuis-band lobes near the published `575 nm` and `603 nm` maxima. This is
  meant to shape dusk colors plausibly, not to serve as an ozone fixture oracle.

Source support:

- [CIE 1931 2-degree dataset](https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer)
  remains the official table source for future exact colorimetry tests.
- Wyman, Sloan, and Shirley, "Simple Analytic Approximations to the CIE XYZ
  Color Matching Functions", JCGT 2013, supplies the preview CMF formula.
- Brion et al., "Absorption Spectra Measurements for the Ozone Molecule in the
  350-830 nm Region", plus the summarized Chappuis-band maxima, supports the
  preview lobe placement and peak cross-section scale.

Assumptions and limits:

- The preview normalizes XYZ by the integrated Y response so exposure remains a
  report/display control rather than a physical radiance scale.
- The official CIE CSV, a selected ozone cross-section table, and a stronger
  solar spectrum source remain required before these values become test
  fixtures.

Status:

- Used by the generated sky-patch artifacts in
  `tmp/flat-reference-sky-patches/`.

### PDAS, U.S. Standard Atmosphere 1976

Link: https://www.pdas.com/atmos.html

Consulted for:

- U.S. Standard Atmosphere definition and sample table checkpoints.
- Sea-level pressure, temperature, density, layer lapse rates, and atmosphere
  table extent.

Decisions:

- Use U.S. Standard Atmosphere 1976 as the Earth-like clear-air profile fixture.
- Use sea-level pressure `101325 N/m2`, sea-level temperature `288.15 K`, and
  sea-level density `1.225 kg/m3` as known fixture values.
- Use table checkpoints such as `0 km`, `10 km`, `20 km`, and `86 km` for
  profile tests.
- Keep atmosphere-profile choice as model data, not an integrator constant.

Assumptions and limits:

- PDAS cites the U.S. Government standard and provides convenient accessible
  tables. If we later need formal standard text, pin the U.S. Government
  publication as the final citation.

Status:

- Reflected in verification ranges and future `evaluateMedium` fixture design.
- For `resolveRayPath`, PDAS supports atmosphere/profile domain extents such as
  lower-atmosphere `0-86 km` table coverage and extended table coverage through
  `1000 km`. It does not by itself define the transport segment for a ray; that
  remains a model boundary choice.

### FAI ICARE, 100 km Altitude Boundary For Astronautics

Link: https://www.fai.org/page/icare-boundary

Consulted for:

- A source-backed conventional `100 km` altitude boundary candidate.
- Distinguishing a named model boundary from a physical claim that the
  atmosphere abruptly ends.

Decisions:

- `100 km` may be used as an explicitly named `atmosphereTopKm` fixture input
  for Earth-like demonstration geometry.
- Do not present `100 km` as a physical atmosphere cutoff. It is a conventional
  aeronautics/astronautics boundary useful for a model configuration.
- `resolveRayPath` tests should name boundary provenance when they use this
  value.

Assumptions and limits:

- The source is about astronautic record classification, not radiative
  transfer or density profiles.
- For density/profile tests, prefer U.S. Standard Atmosphere, NRLMSISE, or a
  selected atmosphere model source rather than the Karman-line convention.

Status:

- Reflected in [Fixture Sources](fixture_sources.md) as a ready conventional
  top-boundary source, with the limitation that it is not a physical
  density-zero altitude.

### ResolveRayPath Controlled Segment Fixtures

Link: [Code Design](code_design.md)

Consulted for:

- Local API/schema authority for `resolveRayPath` packet shape and model
  boundary ownership.
- The decision that stage tests should be isolated and can provide prerequisite
  packet fields directly.

Decisions:

- The first `resolveRayPath` fixture rows should be JSON expectation data,
  not JS helper-owned oracles.
- For stage-selection tests, fixture rows should pin model-returned atmosphere
  intersection distances, surface-hit distances, lateral-boundary distances,
  boundary labels, empty-path flags, and expected errors.
- JS helpers may adapt fixture rows into controlled model interfaces, but the
  expected `rayPath` values and derivation notes live in data.
- Real ray/sphere or ray/slab intersection math should be tested later in
  geometry-helper specs, with source-backed radius/top-boundary inputs and
  derivation notes.

Row-level source map for the planned `resolveRayPath` fixture rows:

| Planned row | Expectation being justified | Source support | Input-value status |
| --- | --- | --- | --- |
| `ray-path.atmosphere.inside-exits-top` | If the model returns a forward atmosphere interval and no nearer boundary, the view segment is that interval. | PBRT Rays for `r(t) = o + t d` with forward ray parameter `t >= 0`; local Code Design/Test Design for `resolveRayPath` selecting model-returned atmosphere intervals. | Controlled fixture distances such as `0 -> 10 km` are not physical constants; they are stage-contract inputs. |
| `ray-path.surface-hit.clips-atmosphere-segment` | A nearer opaque surface hit terminates the camera transport segment before atmosphere exit. | PBRT Rays for comparing hit/interval distances along the same ray parameter; PBRT Transmittance for transport between two points over a finite segment; local stage contract for surface-hit clipping. | Surface distance such as `4 km` is controlled fixture data, not a sourced terrain/planet value. |
| `ray-path.surface-hit.before-atmosphere-entry-empty` | A surface hit before atmosphere entry prevents integrating atmosphere behind that surface. | PBRT Rays for ordered forward distances; local model-interface contract for surface hit ownership and atmosphere-entry selection. | Controlled distances such as surface `2 km` and atmosphere entry `5 km` only encode ordering. |
| `ray-path.atmosphere.miss-empty-path` | Missing atmosphere intersection produces an explicit empty path rather than an invented fallback distance. | Local Code Design/Test Design for explicit packet outputs and loud/no-hidden-fallback policy; Bruneton testing discipline against ad-hoc constants. | `null` atmosphere intersection is controlled fixture data. |
| `ray-path.atmosphere.outside-entry-to-exit` | When the observer is outside the atmosphere, transport starts at the positive entry distance and ends at exit. | PBRT Rays for positive ray parameter distances; local stage contract for model-owned interval selection. | Controlled interval such as `2 -> 12 km` only encodes outside-entry ordering. |
| `ray-path.atmosphere.forward-clips-negative-entry` | An interval that crosses the observer clips to `0` and keeps the forward portion. | PBRT Rays for the ray domain `0 <= t < infinity`; local stage contract for clipping model intervals to the camera ray's forward domain. | Negative entry and positive exit values are controlled ray-domain cases, not physical altitudes. |
| `ray-path.atmosphere.behind-observer-empty-path` | An interval entirely at negative ray distances contributes no forward transport. | PBRT Rays for the semi-infinite forward ray domain; local stage contract for explicit empty path output. | Controlled negative interval only encodes "behind observer." |
| `ray-path.atmosphere.zero-length-boundary-path` | A zero-length finite interval remains zero-length and preserves boundary metadata; no epsilon path is invented. | PBRT Rays and PBRT Transmittance for point-to-itself/zero-distance semantics; local diagnostic contract for boundary metadata. | `0 -> 0 km` is a stage-contract boundary case. |
| `ray-path.atmosphere.inverted-intersection-rejects` | Inverted intervals reject because they cannot define an ordered path segment. | Local model-interface contract; PBRT Rays provides the ordered parametric distance vocabulary. | Controlled invalid ordering, not an external physical value. |
| `ray-path.atmosphere.nonfinite-intersection-rejects` | Non-finite interval distances reject before transport integration. | PBRT Transmittance defines finite point-to-point distance in the optical-depth integral; local numerical/API contract requires finite distances. | `Infinity`, `-Infinity`, and `NaN` are error-contract inputs. |
| `ray-path.flat.named-lateral-boundary` | A finite flat lateral boundary is accepted and named as the path terminator. | Local flat-model contract; Bruneton anti-ad-hoc-constant/testing discipline supports making model boundaries explicit; PBRT Transmittance explains that finite path length later drives optical depth. | Distance such as `25 km` is a named model/hypothesis fixture value, not an Earth constant or hidden clamp. |
| `ray-path.flat.unbounded-horizontal-rejects` | An unbounded flat horizontal path rejects before integration. | PBRT Transmittance requires a finite integration distance for fixtureable optical depth; local flat-model contract says infinite slab paths need named lateral boundaries. | Unbounded marker is error-contract input. |
| `ray-path.boundary-metadata.preserved` | Model-owned boundary id/label/metadata travels into diagnostics unchanged. | Local diagnostics/API contract; Bruneton CPU-reference discipline supports keeping comparison diagnostics explicit. | Metadata values are controlled fixture labels. |
| `ray-path.surface-hit.after-atmosphere-exit-ignored` | A surface hit beyond atmosphere exit does not shorten or annotate the atmosphere transport segment. | PBRT Rays for ordered ray distances; local `resolveRayPath` boundary-precedence contract for keeping this stage focused on atmosphere transport. | Controlled surface distance `20 km` only encodes "after exit." |
| `ray-path.surface-hit.at-atmosphere-entry-empty` | A surface hit exactly at positive atmosphere entry produces an explicit empty path without epsilon distance. | PBRT Transmittance for zero-distance semantics; local boundary-precedence contract for opaque-surface handling. | Controlled coincident distance `5 km` encodes an equality boundary case. |
| `ray-path.surface-hit.at-atmosphere-exit-surface-precedence` | A surface hit exactly at atmosphere exit uses surface-hit precedence while preserving atmosphere-exit diagnostics in metadata. | PBRT Rays for coincident ray parameters; local diagnostic-precedence contract for the chosen label and metadata shape. | Controlled coincident distance `10 km` encodes equality; the precedence label is local API policy. |
| `ray-path.surface-hit.nonfinite-distance-rejects` | A present surface hit with non-finite `tKm` rejects before ordering. | PBRT Rays for finite ordered ray parameters; local model-interface contract for present hit data. | `Infinity` and `NaN` are error-contract inputs. |
| `ray-path.surface-hit.negative-distance-ignored` | A negative surface-hit distance is behind the observer and does not affect forward atmosphere transport. | PBRT Rays for the forward domain `0 <= t < infinity`; local boundary-precedence contract for ignoring behind-observer surface hits. | Controlled negative distance only encodes "behind observer." |
| `ray-path.atmosphere.malformed-finite-interval-rejects` | A finite atmosphere interval missing `tMinKm` or `tMaxKm` rejects unless it uses the explicit unbounded marker. | PBRT Transmittance for finite point-to-point transport; local model-interface contract for interval schema. | Missing fields are error-contract inputs. |
| `ray-path.model-call.validated-transport-ray` | `resolveRayPath` passes the validated observer origin and normalized ray direction to model-owned intersection methods. | PBRT Rays for origin/direction vocabulary; local model-interface contract for the exact `{ originKm, direction }` shape. | The ray values are fixture-owned API-shape data, not physical constants. |

Identifiable extremes for the planned `resolveRayPath` rows:

| Extreme intent | Planned row(s) | Reference authority | What is referenced |
| --- | --- | --- | --- |
| Forward ray lower bound at the observer | `ray-path.atmosphere.forward-clips-negative-entry`, `ray-path.atmosphere.behind-observer-empty-path` | PBRT v4 Rays plus local kilometer/unit-vector convention | PBRT defines rays over the semi-infinite domain `0 <= t < infinity`; local design maps validated unit direction plus kilometer coordinates to kilometer distances. |
| Empty forward transport segment | `ray-path.atmosphere.miss-empty-path`, `ray-path.atmosphere.behind-observer-empty-path`, `ray-path.surface-hit.before-atmosphere-entry-empty` | PBRT Rays plus local packet contract | PBRT supplies the forward-ray domain; local design requires explicit empty path output rather than hidden max-distance or fallback behavior. |
| Zero-length finite segment | `ray-path.atmosphere.zero-length-boundary-path` | PBRT v4 Rays and PBRT v4 Transmittance plus local no-epsilon policy | PBRT supports evaluating points along a ray and transmittance from a point to itself; local design forbids inventing a minimum path length. |
| Ordered finite interval requirement | `ray-path.atmosphere.inverted-intersection-rejects`, `ray-path.atmosphere.nonfinite-intersection-rejects` | PBRT Rays for ordered ray parameters, PBRT Transmittance for finite distance integrals, and local model-interface contract | Intersections must produce ordered finite distances before they can define transport; non-finite or inverted intervals are invalid model returns. |
| Surface before atmosphere entry | `ray-path.surface-hit.before-atmosphere-entry-empty` | PBRT Rays plus local world/surface ownership contract | Ordered ray distances decide which event occurs first; the local model contract treats an opaque surface before atmosphere entry as blocking that later atmosphere segment. |
| Surface after atmosphere exit | `ray-path.surface-hit.after-atmosphere-exit-ignored` | PBRT Rays plus local atmosphere-transport scope | Ordered ray distances show the surface is later than atmosphere exit; local design says `resolveRayPath` does not carry unrelated future surface hits. |
| Surface exactly at atmosphere entry | `ray-path.surface-hit.at-atmosphere-entry-empty` | PBRT Transmittance zero-distance semantics plus local opaque-surface precedence | The equality case has no positive atmosphere distance to integrate and must not create an epsilon path. |
| Surface exactly at atmosphere exit | `ray-path.surface-hit.at-atmosphere-exit-surface-precedence` | PBRT Rays coincident ray-parameter semantics plus local diagnostic precedence | The same endpoint can be both atmosphere exit and surface hit; local design chooses surface-hit as visible boundary and preserves atmosphere metadata. |
| Surface-hit distance validity | `ray-path.surface-hit.nonfinite-distance-rejects`, `ray-path.surface-hit.negative-distance-ignored` | PBRT Rays plus local model-hit contract | Present surface hits need finite `tKm`; negative hits are behind the observer and ignored for forward transport. |
| Malformed finite interval schema | `ray-path.atmosphere.malformed-finite-interval-rejects` | PBRT Transmittance finite segment requirement plus local model-interface schema | Finite intervals need both endpoints; only explicit `unbounded: true` enters the unbounded flat-path error branch. |
| Model-call API shape | `ray-path.model-call.validated-transport-ray` | PBRT Rays plus local model-interface contract | The tested object shape is local API policy; references only justify origin/direction as ray inputs. |
| Finite flat lateral path | `ray-path.flat.named-lateral-boundary` | Local flat-model hypothesis contract plus Bruneton anti-ad-hoc-constant discipline and PBRT Transmittance | A flat lateral distance is referenced only as a named model boundary/hypothesis; later optical depth uses finite path length through PBRT transmittance math. |
| Unbounded flat horizontal path | `ray-path.flat.unbounded-horizontal-rejects` | Local flat-model contract plus PBRT Transmittance finite integration distance | An infinite slab path has no finite optical-depth segment for the reference fixture, so it must fail until a named finite boundary is supplied. |

Assumptions and limits:

- These fixtures validate `resolveRayPath` decision logic, not the correctness
  of a geometry helper's intersection algorithm.
- Source class should be `local API/schema contract` for this stage batch.
  Geometry-derived physical or conventional values, such as Earth radius,
  atmosphere-top altitude, ray/sphere intersections, or flat slab intersections,
  belong in geometry/model fixture batches before they become model-returned
  inputs consumed by `resolveRayPath`.

Status:

- Reflected in [Test Design](test_design.md), [Plan](plan.md), and
  [Fixture Sources](fixture_sources.md).

### `resolveRayPath` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/ResolveRayPathStage.js`

Consulted for:

- Source breadcrumbs for runtime ray-path ordering, clipping, empty-path, and
  boundary-precedence branches.

Decisions:

- The stage consumes `validatedRequest` only and passes the validated observer
  origin plus normalized ray direction to model-owned atmosphere and surface
  intersection methods. Geometry math stays in model adapters.
- A `null` or `undefined` atmosphere intersection is an explicit empty
  `atmosphere-miss` path, not a hidden fallback distance.
- An explicit `unbounded: true` atmosphere intersection rejects because flat
  horizontal/slab paths need a finite named lateral boundary before optical
  depth can be integrated.
- Finite atmosphere intervals must have finite ordered `tMinKm <= tMaxKm`.
  Intervals entirely behind the observer produce an empty forward path, and
  intervals crossing the observer clip to `startKm = 0`.
- Surface hits are compared by the same ray parameter. A surface before
  atmosphere entry or exactly at positive atmosphere entry blocks the
  atmosphere segment. A surface inside the interval clips the end point. A
  surface exactly at atmosphere exit gets visible-surface precedence while
  preserving atmosphere-exit diagnostics in metadata. A surface after
  atmosphere exit, or behind the observer, is not carried as a selected
  surface endpoint.
- Zero-length finite segments are valid explicit outputs. The stage does not
  invent epsilon path length.
- Boundary reason/id and model metadata are diagnostic facts and should be
  preserved only when they belong to the selected endpoint or coincident
  endpoint diagnostics.

Source support:

- PBRT v4 Rays supplies parametric ray distance ordering and the forward-ray
  domain used by clipping and behind-observer handling.
- PBRT v4 Transmittance supplies the finite point-to-point transport basis and
  zero-distance transport semantics used by later stages.
- [Stage Contracts](stage_contracts.md#resolveraypath) supplies ownership,
  output shape, surface-hit carry rules, flat unbounded-path rejection, and
  downstream diagnostics.
- [Code Design](code_design.md#model-interface) supplies the model-owned
  geometry boundary and the no-hidden-flat-clamp policy.
- `ray-path-contracts.json` supplies row-level provenance for controlled
  interval, surface ordering, flat-boundary, malformed-return, and
  model-call-shape fixtures.

Status:

- Branch/source remediation completed for `ResolveRayPathStage.js`.

### `sampleViewPath` Planned Fixture References

Consulted for:

- The next canonical stage after `resolveRayPath`.
- Reference support needed before turning pending `sampleViewPath` skeletons
  into fixture-backed tests.

Decisions:

- The first `sampleViewPath` implementation will use fixed midpoint sampling
  for view rays, matching [Code Design](code_design.md), Numerical Controls.
- Expected sample centers and weights should be fixture data, not generated by
  the implementation under test.
- Midpoint-rule rows need a numerical integration/quadrature reference.
- Empty, zero-length, invalid-distance, diagnostic-preservation, and packet
  shape rows are local API/schema contracts, with PBRT ray/transmittance
  support where finite ordered path distances matter.

Candidate external references:

- PBRT v4, Geometry and Transformations / Rays:
  https://www.pbr-book.org/4ed/Geometry_and_Transformations/Rays
- PBRT v4, Volume Scattering / Transmittance:
  https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance
- Numerical integration overview, midpoint/rectangle rule:
  https://en.wikipedia.org/wiki/Numerical_integration
- Talvila and Wiersma, "Simple derivation of basic quadrature formulas":
  https://arxiv.org/abs/1202.0249

Row-level source map for planned `sampleViewPath` fixture rows:

| Planned row | Expectation being justified | Source support | Input-value status |
| --- | --- | --- | --- |
| `view-samples.empty-path.no-samples` | Empty atmosphere paths produce no samples. | PBRT Transmittance for zero path contribution; local packet contract for representing no samples as `[]`. | Empty path flag and zero segment are fixture-owned stage-contract inputs. |
| `view-samples.zero-length.no-samples` | Zero-length boundary paths produce no distance samples and no epsilon path. | PBRT Transmittance for point-to-itself transport; local no-epsilon policy from `resolveRayPath`. | Zero length is a boundary case, not a physical atmosphere thickness. |
| `view-samples.midpoint.one-step-0-to-10` | One midpoint sample over `0..10 km` has center `5 km` and weight `10 km`. | Numerical integration midpoint rule; local units/packet contract. | Distances are controlled interval data chosen for exact arithmetic. |
| `view-samples.midpoint.two-steps-0-to-10` | Two equal midpoint samples over `0..10 km` have centers `2.5`, `7.5` and weights `5`, `5`. | Composite midpoint rule over equal subintervals; local sample packet shape. | Controlled interval chosen for exact arithmetic. |
| `view-samples.midpoint.two-steps-2-to-12` | Nonzero-start intervals use observer-ray distances, giving centers `4.5`, `9.5`. | Composite midpoint rule; local convention that distances remain along the original camera ray. | Controlled interval chosen to prove start offset handling. |
| `view-samples.midpoint.weights-sum-to-length` | Sample weights partition the path length. | Composite midpoint/quadrature weights; local optical-depth stage consumes `weightKm` as `ds`. | Controlled path length; no physical constant. |
| `view-samples.midpoint.monotonic-sample-order` | Sample distances increase in camera-ray order. | Ordered subintervals in composite midpoint rule; PBRT Rays for ordered ray parameter. | Ordering invariant, not a sourced numeric value. |
| `view-samples.ray-path-diagnostics.preserved` | Sampling leaves `rayPath` diagnostics unchanged. | Local packet-transform and diagnostics contract. | No external numeric data needed. |
| `view-samples.invalid.negative-length-rejects` | Negative path length rejects. | PBRT Rays and Transmittance require ordered finite path distances; local packet validation. | Error-contract input. |
| `view-samples.invalid.inconsistent-length-rejects` | Contradictory `start/end/length` rejects. | PBRT Rays for interval endpoints; midpoint rule requires a coherent interval width; local loud-failure policy. | Error-contract input. |
| `view-samples.invalid.nonfinite-distance-rejects` | Non-finite start/end/length rejects. | PBRT Transmittance for finite path distance; local finite-distance policy. | Error-contract input. |
| `view-samples.invalid.view-steps-rejects` | `viewSteps` must be a positive finite integer. | Numerical integration partition count convention; local Numerical Controls. | Error-contract input for direct stage packets. |
| `view-samples.midpoint.integration-metadata` | Output records midpoint integration metadata. | Numerical integration midpoint rule for method name; local diagnostics/reportability contract. | Metadata label is local API policy. |

Assumptions and limits:

- Web midpoint-rule sources are acceptable for the next internal fixture pass,
  but before package-facing publication we should prefer a primary or
  textbook-grade numerical analysis source.
- Numeric intervals such as `0..10 km` are controlled fixture inputs chosen for
  exact arithmetic. They are not physical constants or atmosphere extents.
- These fixtures validate sample construction from a selected path, not medium
  evaluation, geometry intersections, or optical-depth correctness.

### `sampleViewPath` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/SampleViewPathStage.js`

Consulted for:

- Source breadcrumbs for view-path sampling, empty-path handling, numerical
  control validation, and sampling metadata branches.

Decisions:

- The stage consumes `rayPath.viewSegment` from `resolveRayPath` and
  `validatedRequest.numerical` from `validateRequest`. It does not re-resolve
  geometry or consult model adapters.
- `normalizeRayPathSegment` owns finite, nonnegative, internally consistent
  segment validation for `startKm`, `endKm`, and `lengthKm`.
- Empty paths and zero-length paths produce `viewSamples: []` with explicit
  metadata. The stage does not create epsilon samples for zero path measure.
- The first implementation uses fixed composite midpoint sampling. It divides
  the selected segment into equal subintervals, places each sample at the
  subinterval center, records the subinterval width as `weightKm`, and carries
  interval endpoints for downstream path-end diagnostics.
- `viewSteps` comes from `validatedRequest.numerical`; missing `viewSteps`
  defaults to `1` for nonempty paths. Supplied values must be finite positive
  integers because they choose a discrete partition count.
- Sampling metadata records the selected method, emitted sample count, and
  selected path length for diagnostics. It is local packet metadata, not a
  physical quantity.
- The stage preserves `rayPath` and the rest of the packet while appending only
  its own stage id.

Source support:

- PBRT v4 Rays supplies ordered ray-parameter distances along the selected
  camera ray.
- PBRT v4 Transmittance supplies the zero-distance/no-measure reasoning for
  empty and zero-length paths.
- Midpoint-rule references in the planned fixture map supply the composite
  midpoint placement and weight policy.
- [Stage Contracts](stage_contracts.md#sampleviewpath) supplies input/output
  shape, empty-path policy, metadata ownership, and downstream handoff.
- `view-samples-contracts.json` supplies row-level provenance for controlled
  midpoint, empty path, invalid segment, invalid view-step, and metadata cases.

Status:

- Branch/source remediation completed for `SampleViewPathStage.js`.

### `evaluateMedium` Planned Fixture References

Consulted for:

- The next canonical stage after `sampleViewPath`.
- Reference support needed before turning pending `evaluateMedium` skeletons
  into fixture-backed tests.
- Data-first sources for Earth profile and visible-grid rows.

Decisions:

- Controlled `evaluateMedium` fixtures should use fixture-owned model returns
  for packet flow, sample position, coefficient shape, species preservation,
  and invalid model-data rejection.
- Expected-range inputs that use Earth atmosphere/profile values should be
  pinned from table or dataset rows before algorithms. Do not generate density,
  pressure, temperature, or grid extents from a new local implementation when
  an authoritative or auditable table row exists.
- `evaluateMedium` validation covers stage output for expected input ranges,
  not Earth-model truth. Sourced rows provide dense near-surface,
  low-density high-altitude, near-boundary, dry-air composition, and visible
  grid input shapes. Adapter/model correctness belongs in separate
  adapter/model tests.
- PBRT supplies coefficient semantics and nonnegative physical constraints.
  It does not supply Earth density or atmospheric coefficient table values.
- U.S. Standard Atmosphere rows are ready for density/profile diagnostics, but
  not for clear-air spectral extinction until a Rayleigh/aerosol/absorber model
  is selected.
- U.S. Standard Atmosphere 1976 Table 3 is the preferred first composition
  source because it belongs to the same standard as the profile table. Its
  dry-air fractional-volume rows are ready for `evaluateMedium` composition
  fixtures.
- The composition-consistency fixture should be scoped as an adapter contract:
  when the selected Earth profile adapter declares fixed U.S. Standard
  Atmosphere dry air, `evaluateMedium` must preserve that composition at the
  sourced profile checkpoints. Do not generalize this into a claim that real
  upper-atmosphere composition is constant.
- CIE data is ready for visible-grid alignment metadata, not for atmosphere
  coefficients.
- G-173/SMARTS remains a later clear-sky spectral comparison source because it
  includes atmosphere, aerosol, water vapor, ozone, surface albedo, and solar
  geometry assumptions that the first medium stage will not yet reproduce.

Candidate external references:

- PBRT v4, Geometry and Transformations / Rays:
  https://www.pbr-book.org/4ed/Geometry_and_Transformations/Rays
- PBRT v4, Volume Scattering Processes:
  https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes
- NASA NTRS, U.S. Standard Atmosphere, 1976:
  https://ntrs.nasa.gov/citations/19770009539
- PDAS U.S. Standard Atmosphere 1976 big tables:
  https://www.pdas.com/bigtables.html
- CIE 1931 colour-matching functions, 2 degree observer:
  https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer
- NLR/NREL Reference Air Mass 1.5 Spectra:
  https://www.nlr.gov/grid/solar-resource/spectra-am1.5
- NLR/NREL SMARTS:
  https://www.nlr.gov/grid/solar-resource/smarts

Data-first candidates for `evaluateMedium` fixture rows:

| Candidate row | Data source | Pinned data to use | Fixture status |
| --- | --- | --- | --- |
| `medium.earth-profile.sea-level-density-checkpoint` | PDAS Table 1 SI row at geometric altitude `0 km`, backed by NASA NTRS U.S. Standard Atmosphere 1976 record. | Input diagnostics: `Z = 0 km`, `H = 0.0 km`, `T = 288.150 K`, `p = 1.0132E+05 Pa`, `rho = 1.2250E+00 kg/m3`, `rho/rho0 = 1.0000E+00`. | Ready as dense near-surface input range coverage; expected output is preservation. |
| `medium.earth-profile.high-altitude-density-checkpoint` | PDAS Table 1 SI row at geometric altitude `80 km`, backed by NASA NTRS U.S. Standard Atmosphere 1976 record. | Input diagnostics: `Z = 80 km`, `H = 79.0 km`, `T = 198.639 K`, `p = 1.0525E+00 Pa`, `rho = 1.8458E-05 kg/m3`, `rho/rho0 = 1.5068E-05`. | Ready as low-density input range coverage; expected output is preservation. |
| `medium.earth-profile.upper-supported-density-checkpoint` | PDAS Table 1 SI row at geometric altitude `85 km`, backed by NASA NTRS U.S. Standard Atmosphere 1976 record. | Input diagnostics: `Z = 85 km`, `H = 83.9 km`, `T = 188.893 K`, `p = 4.4568E-01 Pa`, `rho = 8.2195E-06 kg/m3`, `rho/rho0 = 6.7098E-06`. | Ready as near-boundary input range coverage; expected output is preservation. |
| `medium.earth-composition.standard-dry-air-major-fractions` | NASA NTRS U.S. Standard Atmosphere 1976 PDF, Table 3, printed page 3. | Input diagnostics: `N2 0.78084`, `O2 0.209476`, `Ar 0.00934`, `CO2 0.000314`, `Ne 0.00001818`, `He 0.00000524`, `Kr 0.00000114`, `Xe 0.000000087`, `CH4 0.000002`, `H2 0.00000005`; listed-fraction sum `0.999996697`; residual `0.000003303`. | Ready as composition payload coverage; expected output is preservation. |
| `medium.earth-composition.homosphere-consistency` | NASA Table 3 composition reused as selected model input across profile checkpoints. | The controlled model supplies the same Table 3 dry-air composition at the sourced `0 km`, `80 km`, and `85 km` checkpoints. | Ready as stage packet/output consistency. This is not a real thermosphere-composition fixture. |
| `medium.earth-profile.visible-wavelength-grid-alignment` | Official CIE 1931 2-degree CMF dataset. | Input grid shape: `360-830 nm`, `1 nm` steps, `471` rows, md5 `17cca777db64b17170f06f67ce9d3ab7`, DOI `10.25039/CIE.DS.xvudnb9b`. | Ready for array-shape range coverage only; not a coefficient-value oracle. |

Row-level source map for planned controlled `evaluateMedium` fixture rows:

| Planned row | Expectation being justified | Source support | Input-value status |
| --- | --- | --- | --- |
| `medium.empty-view-samples.no-medium-samples` | Empty sample list produces no medium samples. | Local packet contract; PBRT transmittance/path-integral intuition for no path contribution. | Controlled fixture input, no Earth data. |
| `medium.position.single-sample-from-observer-ray` | Sample position is `origin + distance * direction`. | PBRT Rays equation `r(t) = o + t*d`; local validated unit-direction policy. | Controlled arithmetic input, e.g. `[1,2,3] + 5*[0,1,0] = [1,7,3]`. |
| `medium.position.multiple-samples-ordered` | Samples are evaluated once in order. | Local packet order contract and `sampleViewPath` output order. | Controlled fixture input. |
| `medium.model-call.wavelength-grid` | Coefficient calls receive the active spectral grid/sequence. | Local model-interface contract; `wavelengthsNm` owns spectral-array order. | Needs final coefficient-call API shape. |
| `medium.sample-fields.preserved` | View-sample diagnostics are copied into medium samples. | Local packet transform contract. | Controlled fixture input. |
| `medium.vacuum.zero-coefficients` | Vacuum means zero medium coefficients. | PBRT medium coefficient vocabulary; local outside/no-medium contract. | Controlled fixture input. |
| `medium.homogeneous.single-wavelength` | Model-owned homogeneous coefficient values pass through. | PBRT coefficient vocabulary; local model ownership. | Controlled fixture values, not Earth constants. |
| `medium.homogeneous.multi-wavelength` | Multi-wavelength arrays preserve order and length. | Local spectral-array contract. | Controlled fixture values. |
| `medium.species.diagnostics-preserved` | Species names and diagnostics are model-owned. | Local model-interface contract; PBRT participating-media vocabulary. | Controlled species names and arrays. |
| `medium.species.total-extinction-sum` | Species extinction contributions add by wavelength. | PBRT attenuation/extinction coefficient structure. | Needs output precedence decision. |
| `medium.coefficients.absorption-scattering-extinction-consistency` | Extinction equals absorption plus scattering when this stage owns total extinction. | PBRT Volume Scattering Processes defines `sigma_t = sigma_a + sigma_s`. | Needs output precedence decision. |
| `medium.diagnostics.altitude-from-world` | Altitude comes from `world.altitudeAt`. | Local model-interface contract. | Controlled world return; the controlled `mediumAt` response does not own altitude. |
| `medium.diagnostics.density-from-atmosphere` | Density comes from atmosphere/profile methods. | Local model-interface contract; Standard Atmosphere rows later support real data. | Controlled return first; table row later. |
| `medium.outside-atmosphere.vacuum` | Outside volume becomes explicit vacuum. | Local atmosphere-volume contract; PBRT zero-coefficient behavior. | Controlled `contains(position) === false`. |
| `medium.invalid.negative-extinction-rejects` | Negative extinction rejects. | PBRT coefficients are physical reciprocal-distance rates; hard nonnegative invariant. | Error-contract input. |
| `medium.invalid.negative-scattering-rejects` | Negative scattering rejects. | PBRT scattering coefficient is a probability per unit distance; hard nonnegative invariant. | Error-contract input. |
| `medium.invalid.negative-absorption-rejects` | Negative absorption rejects. | PBRT absorption/scattering/extinction coefficient vocabulary; hard nonnegative invariant. | Error-contract input. |
| `medium.invalid.nonfinite-coefficients-reject` | Non-finite coefficients reject. | Local finite-number transport contract. | Error-contract input. |
| `medium.invalid.wavelength-shape-rejects` | Coefficient arrays must align to `wavelengthsNm`. | Local spectral-array contract. | Error-contract input. |
| `medium.invalid.density-rejects` | Density diagnostics must be finite and nonnegative. | Local profile contract plus hard nonnegative invariant; table rows provide real positive examples later. | Error-contract input. |

Follow-up extreme fixture rows now encoded in `medium-contracts.json`:

| Fixture row | Extreme being tested | Source support | Fixture note |
| --- | --- | --- | --- |
| `medium.extreme.profile.dense-near-surface` | Dense lower-atmosphere profile checkpoint. | NASA U.S. Standard Atmosphere 1976 / PDAS Table 1 SI row at `0 km`. | Uses table values `T = 288.150 K`, `p = 1.0132E+05 Pa`, `rho = 1.2250E+00 kg/m3`; coefficients stay controlled zeros because this row tests profile preservation only. |
| `medium.extreme.profile.low-density-upper-supported` | Low-density upper-supported lower-table checkpoint. | NASA U.S. Standard Atmosphere 1976 / PDAS Table 1 SI row at `85 km`. | Uses table values `T = 188.893 K`, `p = 4.4568E-01 Pa`, `rho = 8.2195E-06 kg/m3`; this is an accessible lower-profile edge row, not a claim that the atmosphere ends there. |
| `medium.extreme.profile.invalid-density-boundaries` | Negative and non-finite density diagnostics at the profile boundary family. | Local `evaluateMedium` profile contract; NASA/PDAS positive finite profile rows define the valid sourced examples. | Negative, `NaN`, and infinite density are fixture-owned invalid inputs paired with the sourced profile-positive rows. |
| `medium.extreme.profile.zero-density-vacuum` | Vacuum/no-medium coefficient boundary. | PBRT Volume Scattering Processes for zero absorption, scattering, and extinction in a nonparticipating medium. | Uses `[360, 550, 830] nm` to make wavelength alignment visible while keeping the physics invariant simple. |
| `medium.extreme.profile.vacuum-contradictory-coefficients-rejects` | Contradictory vacuum state with nonzero coefficients. | PBRT Volume Scattering Processes for the vacuum zero-coefficient invariant; local loud-failure policy for contradictory model data. | This row should fail against any implementation that silently ignores nonzero coefficients after `vacuum: true`. |
| `medium.extreme.wavelength-grid.visible-full-range` | Full selected visible-grid array shape. | Official CIE 1931 2-degree CMF metadata: `360-830 nm`, `1 nm`, `471` rows, DOI `10.25039/CIE.DS.xvudnb9b`. | Tests array length/order only; it is not an atmosphere coefficient oracle. |
| `medium.extreme.wavelength-grid.visible-full-range-mismatch-rejects` | Full-grid shape mismatch at the selected visible-grid extreme. | Local spectral-array alignment contract with CIE metadata supplying the `471` row count. | Fixture encodes `470`, `472`, and scalar-collapsed coefficient shapes as invalid cases. |
| `medium.extreme.composition.listed-standard-residual` | Dry-air composition rows plus unlisted residual. | NASA U.S. Standard Atmosphere 1976 Table 3 dry-air fractional-volume composition. | Preserves listed sum `0.999996697` and residual `0.000003303`; do not renormalize to exactly one. |
| `medium.extreme.composition.invalid-fraction-boundaries` | Invalid composition diagnostics. | Local stage-validation ownership contract with NASA Table 3 supplying the positive fractional-volume example. | Negative fractions, non-finite fractions, listed sums greater than one, negative residuals, and listed-sum/residual mismatches reject at the `evaluateMedium` boundary. |
| `medium.extreme.coefficient.zero-and-positive-finite` | Valid coefficient lower boundary and positive finite branch. | PBRT coefficient semantics: absorption, scattering, and extinction are nonnegative rates. | The positive value `1e-12 / km` is a controlled sentinel, not an Earth constant; it exercises finite nonzero intake with `sigma_t = sigma_s + sigma_a`. |
| `medium.extreme.coefficient.invalid-boundaries` | Invalid coefficient values. | PBRT nonnegative coefficient semantics plus local finite-number transport contract. | Negative, `NaN`, and `Infinity` are fixture-owned invalid inputs; expected output is a loud error, not clamping. |

Coverage note:

- The profile, vacuum, full-grid, composition, and coefficient extreme
  families now have explicit positive and negative fixture rows. This follows
  the stage-validation rule: a stage owns validation of the inputs it consumes.

Assumptions and limits:

- PDAS is an accessible table extraction for profile checkpoints; NASA NTRS is
  the authority record for U.S. Standard Atmosphere 1976. The dry-air
  composition values above were extracted from the NASA PDF Table 3, so they
  are preferable to memory or a secondary summary for this stage.
- Controlled coefficient values are deliberately toy model returns. They test
  stage behavior and validation, not atmospheric realism.
- No real Rayleigh/Mie/ozone/water-vapor coefficient fixture is ready until
  the coefficient source/model decision is made.
- Prefer data rows such as Standard Atmosphere, CIE, ASTM, Bucholtz, or
  external-tool outputs over locally regenerated formulas whenever the fixture
  is meant to represent real Earth atmosphere.

### `evaluateMedium` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/EvaluateMediumStage.js`

Consulted for:

- Source breadcrumbs for the implemented `evaluateMedium` branch and
  algorithm choices.

Decisions:

- Position evaluation uses PBRT ray semantics:
  `position = observer.positionKm + ray.direction * distanceFromObserverKm`.
  `validateRequest` owns direction canonicalization, so the sampled distance
  remains in kilometers.
- `world.altitudeAt(positionKm)` is the only source for geometric altitude.
  `atmosphere.mediumAt` does not own or override `mediumSample.altitudeKm`.
- `atmosphere.contains(positionKm, sample) === false`,
  `mediumState.contains === false`, and `mediumState.vacuum === true` produce
  explicit wavelength-aligned zero coefficient arrays. This combines the local
  atmosphere-volume contract with PBRT's nonparticipating-medium coefficient
  semantics.
- `atmosphere.mediumAt(positionKm, { wavelengthsNm, sample })` is the required
  high-level medium lookup for this stage. Missing `mediumAt` rejects instead
  of falling back to older granular helpers.
- Species coefficients, when supplied, are preserved and summed
  wavelength-by-wavelength into totals because downstream optical-depth and
  scattering stages need totals while diagnostics need species detail.
- If no species data is supplied, direct model coefficient totals may be used.
  If direct extinction is omitted but absorption and scattering are present,
  derive extinction as `sigma_t = sigma_a + sigma_s`. If both direct
  extinction and absorption/scattering are supplied, validate that they agree.
- Missing coefficients in non-vacuum medium data are treated as invalid unless
  extinction can be derived from absorption and scattering. A stage must fail
  loudly for model data it consumes but cannot interpret.
- Profile and composition diagnostics are preserved only after validating the
  exposed fields. Density must be finite and nonnegative; fractional-volume
  composition entries, listed sums, and residuals must be finite unit
  fractions and must not be silently normalized or repaired.
- Optional diagnostic fields remain optional. The stage validates fields that
  are supplied and does not invent profile, composition, species, scattering,
  or absorption diagnostics that the model did not provide.
- Coefficient arrays must align one-to-one with
  `validatedRequest.wavelengthsNm`; implicit broadcast, padding, truncation,
  or interpolation would invent model data.

Source support:

- PBRT v4 Rays supplies parametric ray evaluation.
- PBRT v4 Volume Scattering Processes supplies nonparticipating-medium,
  absorption, scattering, extinction, and nonnegative coefficient semantics.
- [Stage Contracts](stage_contracts.md#evaluatemedium) supplies packet
  ownership, required inputs, and downstream handoff shape.
- [Code Design](code_design.md#evaluatemedium-contract-notes) supplies model
  interface ownership, coefficient precedence, profile/composition validation,
  and the no-repair policy for malformed model data.
- `medium-contracts.json` supplies fixture-row provenance for controlled
  vacuum, outside-volume, coefficient, profile, composition, and shape cases.

Status:

- First remediation pass completed for branch/source breadcrumbs in
  `EvaluateMediumStage.js`. The separate numerical-policy row for duplicate
  sum tolerances and significant-digit rounding is tracked in the next source
  map below.

### `evaluateMedium` Numerical Policy Source Map

Implementation files:

- `scripts/flat/atmosphere_rejected/reference/stages/EvaluateMediumStage.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/EvaluateMediumStage.spec.js`

Consulted for:

- Source breadcrumbs for `evaluateMedium` duplicate-sum comparison tolerance
  and significant-digit rounding policy.

External specification references:

- TC39 ECMAScript, Number Type:
  https://tc39.es/ecma262/#sec-ecmascript-language-types-number-type
- TC39 ECMAScript, `Number.prototype.toPrecision`:
  https://tc39.es/ecma262/#sec-number.prototype.toprecision

Decisions:

- Treat JavaScript arithmetic in this stage as binary64 `Number` arithmetic.
  The tolerance below exists because the stage recomputes duplicate sums from
  decimal-authored fixture/model inputs and then compares those sums with
  model-supplied duplicate accounting fields.
- Use the named local constant
  `EVALUATE_MEDIUM_DUPLICATE_SUM_TOLERANCE = 1e-12` for duplicate accounting
  comparisons only. Current uses are:
  composition listed fractions not exceeding one, composition
  `listedFractionSum` matching the sum of listed fractions, composition
  `listedFractionSum + unlistedResidual` accounting for one, and direct
  extinction matching `absorption + scattering`.
- This tolerance is not a physical tolerance. It must not justify accepting
  negative coefficients, non-finite values, mismatched wavelength-array
  lengths, real atmosphere source-data error, or arbitrary fixture looseness.
- Use the named local constant
  `EVALUATE_MEDIUM_REVIEW_SIGNIFICANT_DIGITS = 15` for fixture-facing derived
  coefficient sums. The goal is deterministic, reviewable decimal output from
  simple additions without visible binary64 decimal tails.
- Mirror the same significant-digit count in the `EvaluateMediumStage` test
  adapter's position key because it is a lookup key for controlled fixture
  positions, not an independent physical assertion.
- Future source-backed Earth-atmosphere coefficient fixtures need row-level
  tolerance from their data source or convergence study rather than this local
  duplicate-sum tolerance.

Status:

- The numerical policy is documented in
  [Code Design](code_design.md#evaluatemedium-contract-notes), production and
  test literals have been replaced by named constants, and source-breadcrumb
  comments identify the policy at each use.

### Kasten And Young, Revised Optical Air Mass Tables

Link: https://doi.org/10.1364/AO.28.004735

Consulted for:

- Published low-elevation optical-air-mass table values.
- A source-backed near-horizon path-length extreme that avoids arbitrary
  "large air mass" choices.

Decisions:

- Use Table II rows as data-backed slant-path sanity fixtures after the test
  explicitly adopts the same optical-air-mass convention.
- Pin horizon elevation `0.0 deg` as relative optical air mass `38.0868` and
  absolute optical air mass `394428 kg/m2`.
- Useful additional rows for fixtures:
  `1.0 deg -> 26.2595`, `5.0 deg -> 10.3164`,
  `10.0 deg -> 5.5841`.

Assumptions and limits:

- The paper recalculates optical air masses using the ISO Standard Atmosphere
  and reports values by elevation angle. These are not generic geometric ray
  lengths for every atmosphere or flat/local-Sun configuration.
- Use these rows as external table values, not as evidence that our own path
  integrator is correct.

Status:

- Reflected in expected-input extremes and air-mass verification ranges.

### Bucholtz, Rayleigh-Scattering Calculations For The Terrestrial Atmosphere

Link: https://doi.org/10.1364/AO.34.002765

Consulted for:

- Rayleigh cross sections, volume-scattering coefficients, depolarization
  factors, and optical depths for terrestrial atmosphere models.
- Source-backed low/high molecular optical-depth fixture candidates.

Decisions:

- Prefer Bucholtz over a generic `lambda^-4` relationship when pinning numeric
  Rayleigh values.
- Use Table 2 for standard-air Rayleigh volume-scattering coefficient seeds.
  The first curated artifact pins visible blue, green, and red rows plus
  ultraviolet and near-infrared guards under
  `scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json`.
- Use Table 4 for vertical Rayleigh optical-depth rows after the atmosphere
  model is explicit. The curated artifact includes selected `1962 U.S.
  Standard` rows as secondary validation data.
- Keep the simpler `lambda^-4` relationship only as a named simplification or
  qualitative ordering check.

Assumptions and limits:

- The page's HTML table text compresses some repeated scientific-notation
  exponents. The local source artifact records the expanded exponents and
  per-row derivation notes. Future extraction changes should update that
  artifact rather than scattering literals across tests.
- Bucholtz's optical-depth rows are for named atmosphere models. A fixture must
  state whether it uses the `1962 U.S. Standard` atmosphere or another listed
  model.

Status:

- Reflected in [Test Design](test_design.md) Rayleigh verification notes and
  [Plan](plan.md) expected-input extremes.

### `integrateViewOpticalDepth` Hardening Fixture Source Map

Fixture file:
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`

Consulted for:

- Row-level provenance for the pending optical-depth hardening pass.
- Positive and negative fixture rows for expected-input extremes without
  inventing arbitrary limits.

Decisions:

- Path-end diagnostics, packet ownership, cumulative species diagnostics,
  selected-model species names, convergence gates, and solar-stage boundaries
  are local API/design contracts. Their rows cite [Code Design](code_design.md)
  or [Test Design](test_design.md) rather than pretending to be physics data.
- CIE visible-grid rows use the official CIE 1931 2-degree CMF metadata:
  `360-830 nm`, `1 nm`, `471` rows, md5
  `17cca777db64b17170f06f67ce9d3ab7`, DOI
  `10.25039/CIE.DS.xvudnb9b`.
- ASTM G-173 wavelength-grid rows use the NLR/NREL data-table provenance:
  `ASTMG173.csv`, `2002` rows, `280-4000 nm`, nonuniform spacing, and the
  inspected local checksums recorded in [Fixture Sources](fixture_sources.md).
- Bucholtz Table 4 supplies the pinned Rayleigh optical-depth table row:
  `1962 U.S. Standard`, `1.00 um`, `tau = 8.645e-3`.
- Kasten and Young Table II supplies the pinned horizon air-mass row:
  elevation `0.0 deg`, relative optical air mass `38.0868`, absolute optical
  air mass `394428 kg/m2`.
- The finite flat lateral-boundary row is an explicitly named model hypothesis
  plus PBRT transmittance math, not an Earth constant and not a hidden
  integration cap.
- The convergence/sample-count positive row remains a blocking expected-error
  row until an independent convergence artifact supplies selected profile,
  reference solution, sample-count sweep, and tolerance.

Status:

- The fixture rows validate through the global fixture-envelope specs. The
  matching `integrateViewOpticalDepth` Jasmine specs are active and green.

### `integrateViewOpticalDepth` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/IntegrateViewOpticalDepthStage.js`

Consulted for:

- Source breadcrumbs for camera-view optical-depth accumulation,
  transmittance, species diagnostics, path-end semantics, and packet ownership
  branches.

Decisions:

- The stage consumes `mediumSamples` from `evaluateMedium` and
  `validatedRequest.wavelengthsNm` from `validateRequest`. It does not consult
  stale top-level wavelength fields or re-query the model.
- Empty medium samples produce explicit empty sample diagnostics and a path-end
  optical-depth/transmittance result with zero optical depth and unit
  transmittance.
- Sample weights are finite nonnegative path-distance elements. Negative
  weights would subtract optical depth and are invalid.
- Total extinction comes from `mediumSample.coefficients.extinctionByWavelength`
  unless named `mediumSample.species` entries are present. Species entries add
  wavelength by wavelength into the total while preserving cumulative
  per-species diagnostics.
- Extinction arrays must align one-to-one with the canonical wavelength grid
  and must contain finite nonnegative values.
- Optical depth accumulates cumulatively as
  `tau(lambda) += sigma_t(lambda) * weightKm`; view transmittance is
  `T(lambda) = exp(-tau(lambda))`.
- Species diagnostics are cumulative through each sample and cloned for
  `pathEnd` output so later consumers cannot mutate the accumulator.
- `pathEnd.distanceFromObserverKm` uses the final supplied `intervalEndKm`
  when present because midpoint sample distances are integrand evaluation
  points, not the selected path endpoint. If no endpoint is supplied, the stage
  falls back to the last sample distance for compatibility with direct packets;
  a supplied non-finite endpoint rejects.
- Source-path visibility and sample-to-source transmittance remain out of
  scope for this stage and are owned by `integrateSolarTransmittance`.

Source support:

- PBRT v4 Transmittance supplies optical-depth integration,
  Beer-Lambert transmittance, and zero-distance transport invariants.
- PBRT v4 Volume Scattering Processes supplies nonnegative attenuation
  coefficient and species/additive extinction semantics.
- [Stage Contracts](stage_contracts.md#integrateviewopticaldepth) supplies
  input/output shape, wavelength ownership, cumulative species diagnostics,
  path-end diagnostics, and downstream handoff.
- [Code Design](code_design.md#integrateviewopticaldepth-contract-notes)
  supplies the path-end endpoint policy, species diagnostic semantics, and
  solar-stage boundary.
- `analytic-invariants.json` and `view-optical-depth-hardening.json` supply
  row-level provenance for vacuum/empty, homogeneous, weighted, species,
  invalid coefficient, endpoint, wavelength-grid, and boundary cases.

Status:

- Branch/source remediation completed for
  `IntegrateViewOpticalDepthStage.js`.

### `integrateSolarTransmittance` Fixture Source Map

Fixture file:
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/solar-transmittance-contracts.json`

Consulted for:

- Row-level provenance for the first solar source-path transmittance batch.
- Positive and negative source-path transport cases that do not depend on a
  new geometry implementation.
- The local boundary between solar-source model ownership and transport-stage
  integration.

Decisions:

- Source samples and source-path segments are model-owned inputs. The stage
  calls `solarSource.samplesAt` and `solarSource.transmittanceSegment`, then
  integrates the returned segment samples. It does not compute globe
  occlusion, flat slab exits, local finite-Sun disk samples, or source-path
  intersections internally.
- PBRT Transmittance supports the source-path optical-depth equation and
  Beer-Lambert closed form used by the vacuum and homogeneous rows:
  `tau(lambda) = sum sigma_t(lambda) * ds`, `T(lambda) = exp(-tau(lambda))`.
- PBRT Volume Scattering Processes supports the nonnegative finite extinction
  coefficient domain used by the negative-extinction rejection row.
- The official CIE 1931 metadata supplies the full selected visible-grid shape
  row: `360-830 nm`, `1 nm`, `471` rows. This row checks spectral-array
  alignment only; it is not a source-path coefficient-value oracle.
- Occluded source samples are represented as model-declared visibility data.
  The stage emits `visible: false` and zero source transmittance rather than
  inventing an arbitrary huge optical depth.
- Source-sample id, direction, weight, and solid angle are preserved because
  downstream scattering and surface-lighting stages need those facts without
  re-querying the source model.

Completed rows:

- `solar-transmittance.empty-medium-samples.no-output`
- `solar-transmittance.vacuum.directional-unity`
- `solar-transmittance.homogeneous.beer-lambert`
- `solar-transmittance.homogeneous.multi-wavelength`
- `solar-transmittance.source-samples.preserve-metadata`
- `solar-transmittance.visibility.occluded-zero`
- `solar-transmittance.invalid.negative-extinction-rejects`
- `solar-transmittance.invalid.wavelength-shape-rejects`
- `solar-transmittance.invalid.nonfinite-weight-rejects`
- `solar-transmittance.visible-grid.cie-full-range-aligns`

Assumptions and limits:

- These are controlled transport fixtures. They are deliberately not proof of
  a spherical or flat geometry adapter.
- Long flat/local-Sun source paths remain a model-helper responsibility: once a
  flat model returns a finite named segment, this stage should integrate it
  through the same Beer-Lambert math.
- Real Earth clear-air solar transmittance still needs a selected profile,
  Rayleigh/aerosol/absorber model, solar geometry, and preferably
  data-backed or external-tool expected outputs.

Status:

- The direct Jasmine stage specs are active and green. The implementation has
  source comments for the Beer-Lambert accumulation, nonnegative coefficient
  checks, visibility handling, and local packet-shape decisions.

### `integrateSolarTransmittance` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/IntegrateSolarTransmittanceStage.js`

Consulted for:

- Source breadcrumbs for branch and algorithm choices in the implemented
  solar source-path transmittance stage.

Decisions:

- `validatedRequest`, `mediumSamples`, and `rayPath` are required because the
  stage consumes the validated model/wavelength grid, already evaluated medium
  sample positions, and the selected surface endpoint. It does not re-run
  request validation, view sampling, medium lookup, or ray-path resolution.
- Source samples come only from `solarSource.samplesAt(positionKm, undefined,
  numerical)`. The stage preserves model-owned source identity, direction,
  spectrum, weight, and solid angle because downstream phase, scattering, and
  surface-lighting stages consume those facts.
- Source-path segments come only from
  `solarSource.transmittanceSegment(positionKm, sourceSample, query)`. The
  query carries `wavelengthsNm` plus either `mediumSample` or `surfacePoint` so
  the model can make geometry-specific visibility and path decisions.
- `rayPath.surfaceHit` is optional. When it is absent, the stage omits
  `solarTransmittance.surfacePoint` and sets `metadata.includesSurfacePoint`
  to `false`; when present, it evaluates the validated camera ray at
  `surfaceHit.tKm` and creates source samples for that selected surface point.
- A model-declared occluded source sample emits `visible: false`, zero source
  transmittance, path length `0`, and `opticalDepthByWavelength: null`. The
  stage does not replace occlusion with a large synthetic optical depth.
- Visible segments are integrated with the PBRT transmittance equation:
  `tau(lambda) = sum_i sigma_t_i(lambda) * ds_i`, then
  `T(lambda) = exp(-tau(lambda))`.
- Segment sample weights are finite nonnegative distances, and extinction
  arrays are finite nonnegative coefficient arrays aligned one-to-one with
  `validatedRequest.wavelengthsNm`.
- Source-spectrum values must be finite nonnegative arrays aligned to
  `wavelengthsNm`, and their `kind`, `units`, and `derivation` fields are
  required because downstream radiance stages need to know what source-energy
  quantity they are consuming.
- Source direction must be a finite 3-vector. This stage preserves the
  model-owned direction but does not normalize or reinterpret it; downstream
  phase-angle code owns the convention check.
- Optional source weight and solid-angle metadata remain optional, but supplied
  values must be finite and nonnegative. Missing metadata is not invented.
- `metadata.sourceSampleCount` counts all source samples emitted for medium
  samples plus optional surface-point samples so diagnostics and downstream
  consumers can confirm source-sample coverage without traversing nested
  arrays.

Source support:

- PBRT v4 Transmittance supplies optical-depth integration and Beer-Lambert
  transmittance.
- PBRT v4 Volume Scattering Processes supplies nonnegative attenuation
  coefficient semantics.
- [Stage Contracts](stage_contracts.md#integratesolartransmittance) supplies
  required inputs, optional `surfacePoint`, source-spectrum shape, visibility
  semantics, metadata, and downstream handoff.
- [Code Design](code_design.md#integratesolartransmittance-contract-notes)
  supplies the model-owned source geometry boundary and local packet/API
  ownership.
- `solar-transmittance-contracts.json` supplies fixture-row provenance for the
  controlled vacuum, homogeneous, visibility, metadata, source-spectrum,
  source-direction, surface-point, and invalid segment cases.

Status:

- Branch/source remediation completed for
  `IntegrateSolarTransmittanceStage.js`.

### Implemented Stage Spec Assertion Source Maps

Spec files:

- `scripts/flat/atmosphere_rejected/reference/stages/_tests/IntegrateViewOpticalDepthStage.spec.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/IntegrateSolarTransmittanceStage.spec.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/EvaluateMediumStage.spec.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/ValidateRequestStage.spec.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/ResolveRayPathStage.spec.js`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/SampleViewPathStage.spec.js`

Consulted for:

- Source breadcrumbs for direct assertions that are not simple fixture-value
  comparisons.

Decisions:

- Fixture-value assertions may rely on their row-level fixture provenance and
  tolerance policy.
- Stage descriptor and prerequisite-helper assertions cite the public API
  contract because they validate registry metadata and direct-stage boundary
  behavior rather than physical expected values.
- Stage-history and input-immutability assertions cite the public API contract
  that stages are independently runnable packet transforms.
- Adapter-call-shape assertions cite the relevant model-interface contract and
  prove the stage is asking the model for owned data instead of computing a
  downstream concern locally.
- Helper assertions that check arrays, required fields, model-call summaries,
  source spectra, source directions, source metadata, and surface-point handoff
  cite the stage contract or fixture row they expose.
- Test-side precision helpers cite the `evaluateMedium` numerical policy
  source map.

Source support:

- [Code Design](code_design.md#public-api-shape) supplies direct-stage runner
  and packet-transform semantics.
- [Stage Contracts](stage_contracts.md) supplies each stage's model-call,
  output-shape, metadata, and downstream-handoff expectations.
- [Reference Test Plan](test_plan.md#implemented-stage-source-breadcrumb-audit)
  supplies the assertion-breadcrumb rule and fixture-backed assertion
  exception.
- The relevant fixture files provide row-level expected-value derivations for
  fixture-backed assertions.

Status:

- Single-file spec assertion remediation completed for the six spec files
  listed above.

### Shared Test Utility Source Maps

Files:

- `scripts/flat/atmosphere_rejected/reference/_tests/test-pipeline-stages.js`
- `scripts/flat/atmosphere_rejected/reference/_tests/test-expectations.js`
- `scripts/flat/atmosphere_rejected/reference/_tests/utils.spec.js`
- `scripts/flat/atmosphere_rejected/reference/_tests/pipeline-stages.spec.js`

Consulted for:

- Source breadcrumbs for shared test helper behavior and non-fixture
  assertions used by implemented-stage tests.

Decisions:

- Stage contract helper data mirrors the public registry and stage-contract
  docs so direct stage specs can assert ids, prerequisites, provided fields,
  packet-transform behavior, and placeholder scaffolds consistently.
- Shared model/request factories use minimal valid packet data and model
  interface methods; physical defaults are test scaffolding unless a fixture
  row makes them expected values.
- Expectation-loader helpers treat JSON fixtures as the canonical expected
  value ledger, discover every fixture for global validation, index rows by
  stable ids, and fail loudly when a spec cites a missing row.
- Utility specs cover local numerical and packet-shape helper contracts;
  their direct assertions cite PBRT ray/path semantics, local tolerance policy,
  or the public packet-transform contract.
- Pipeline registry specs cover public pipeline ordering, stage class
  descriptors, direct/manual composition equivalence, initial-packet default
  merging, probe tracing, and placeholder behavior.

Source support:

- [Code Design](code_design.md#public-api-shape) supplies the public
  integrator API, stage registry, packet-transform, and default-merge
  contracts.
- [Code Design](code_design.md#model-interface) supplies the required model
  owner/method boundary.
- [Stage Contracts](stage_contracts.md) supplies per-stage requires/provides
  and output packet shape.
- [Reference Test Design](test_design.md) supplies expected-value ledger,
  tolerance, fixture id, and fixture-backed assertion policy.
- [Reference Test Plan](test_plan.md#implemented-stage-source-breadcrumb-audit)
  supplies the assertion-breadcrumb rule for shared utility files.
- PBRT ray and transmittance references support vector normalization and
  finite path-distance utility assertions.

Status:

- Shared utility assertion/source remediation completed for the four files
  listed above.

### Fixture File Metadata Sweep Source Map

Fixture files:

- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/analytic-invariants.json`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/medium-contracts.json`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-samples-contracts.json`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/ray-path-contracts.json`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/solar-transmittance-contracts.json`
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`

Consulted for:

- Row-by-row confirmation that expected fixture data has source references,
  derivation/provenance text, units or semantic kind, comparison policy, and
  independence notes.

Decisions:

- `analytic-invariants.json` has numeric scalar or numeric-array expected
  data only; those rows use per-datum units, derivations, and tolerance rules,
  so no structural comparison policy is needed for this file at present.
- `medium-contracts.json` uses file-level exact structural comparison policy
  for object, array, string, boolean, and null expected values, while numeric
  coefficient/profile values use the datum tolerance rule.
- `view-samples-contracts.json` uses file-level exact structural comparison
  policy for object, array, string, boolean, and null expected values, while
  numeric sample distances and weights use the datum tolerance rule.
- The already-remediated ray-path, solar-transmittance, and view optical-depth
  fixture files remain covered by their specific rows and by global fixture
  metadata validation.

Source support:

- [Reference Test Design](test_design.md) supplies the expected-value ledger,
  row provenance, tolerance, and independence policy.
- [Reference Test Plan](test_plan.md#implemented-stage-source-breadcrumb-audit)
  supplies the implemented-stage fixture audit rule.
- [Reference Decision Log](references.md#expectation-fixturesspecjs-validation-source-map)
  supplies the global fixture metadata validator source map.

Status:

- File-level fixture metadata sweeps completed for all implemented-stage
  fixture files.

### `evaluateScatteringPhase` Implementation Branch Source Map

Implementation file:
`scripts/flat/atmosphere_rejected/reference/stages/EvaluateScatteringPhaseStage.js`

Consulted for:

- Source breadcrumbs for scattering-angle convention, isotropic, Rayleigh, and
  Henyey-Greenstein phase evaluation, source-sample ownership, phase metadata
  ownership, and empty sample output.

Decisions:

- `evaluateScatteringPhase` consumes source directions preserved by
  `integrateSolarTransmittance`; it does not re-query solar-source geometry.
- The local cosine convention is
  `dot(sourceDirectionFromSample, directionFromSampleToCamera)`, where
  `directionFromSampleToCamera = -validatedRequest.ray.direction`.
- Implemented phase functions are explicit `isotropic`, `rayleigh`, and
  `henyey-greenstein` metadata on medium species. Species without phase
  metadata do not emit phase values, because this stage must not invent
  Rayleigh, Mie, aerosol, or cloud phase parameters.
- Isotropic phase evaluates to `1 / (4 * pi)` for every active wavelength and
  is independent of scattering angle.
- Rayleigh phase uses `3 / (16 * pi) * (1 + cosTheta^2)` under the recorded
  local cosine convention.
- Positive-`g` Henyey-Greenstein phase uses the opposite of the local
  source-to-camera cosine so physical forward aerosol scattering aligns with a
  low-Sun camera ray.
- Unsupported phase kinds fail loudly so later phase functions require
  sourced formulas, parameters, tests, and docs before use.

Source support:

- PBRT Phase Functions supplies the normalized isotropic phase value and the
  Henyey-Greenstein formula.
- [Reference Test Plan](test_plan.md#evaluatescatteringphase-current-batch)
  records the Rayleigh and Henyey-Greenstein lightweight coverage added for the
  sky-patch preview, with fuller normalization and `g` bounds left as future
  hardening.
- PBRT Rays plus [Stage Contracts](stage_contracts.md#evaluatescatteringphase)
  supply finite direction-vector and angle-diagnostic semantics.
- [Stage Contracts](stage_contracts.md#integratesolartransmittance) supplies
  upstream source-direction ownership.
- `analytic-invariants.json` row
  `phase.isotropic.constant-over-solid-angle` supplies fixture provenance for
  the first numeric phase value.

Status:

- `evaluateScatteringPhase` implementation slice completed for explicit
  isotropic phase values, Rayleigh phase shape, Henyey-Greenstein
  forward-scattering ordering, angle diagnostics, empty sample output, and
  unsupported phase-kind rejection.

### Final Transport Stage Implementation Source Maps

Implementation files:

- `scripts/flat/atmosphere_rejected/reference/stages/IntegrateSingleScatteringStage.js`
- `scripts/flat/atmosphere_rejected/reference/stages/ResolveSurfaceRadianceStage.js`
- `scripts/flat/atmosphere_rejected/reference/stages/ComposeSpectralRadianceStage.js`

Consulted for:

- Source breadcrumbs for single-scattering accumulation, model-owned surface
  radiance handoff, view attenuation, final spectral component composition,
  and nonnegative physical radiance validation.

Decisions:

- `integrateSingleScattering` consumes view transmittance, scattering
  coefficients, phase values, source spectrum, source transmittance, source
  quadrature weight, and view sample weight from upstream packets. The current
  source-weight contract specializes PBRT's incident-direction integral as a
  weighted source-sample sum:
  `T_view * beta_sca * phase * source * T_source * sourceSample.weight * ds`.
  `solidAngleSr` is preserved as source-shape provenance under this contract,
  not consumed as an additional multiplier.
- `resolveSurfaceRadiance` treats material/BRDF response as model-owned
  through `model.surface.radianceAt`, computes direct irradiance from
  `solarTransmittance.surfacePoint`, disables diffuse sky for the first slice,
  and applies view-path transmittance from `viewOpticalDepth.pathEnd`.
- `composeSpectralRadiance` sums in-scattered and view-attenuated surface
  radiance wavelength by wavelength. It does not clamp, tone-map, convert to
  CIE/linear RGB, or build reports.
- Negative radiance, irradiance, transmittance-factor, coefficient, phase, or
  path-length values reject at the stage boundary instead of being repaired by
  clamping.

Source support:

- PBRT Volume Scattering Processes supplies the single-scattering
  in-scattering product structure.
- PBRT Diffuse Reflection supplies the Lambertian fixture normalization used
  by the controlled surface-model rows.
- [Stage Contracts](stage_contracts.md#integratesinglescattering),
  [Stage Contracts](stage_contracts.md#resolvesurfaceradiance), and
  [Stage Contracts](stage_contracts.md#composespectralradiance) supply packet
  ownership, output shape, and no-display-conversion policy.
- `analytic-invariants.json` rows
  `single-scattering.one-sample.scalar-product`,
  `single-scattering.source-weight.two-half-samples`,
  `single-scattering.source-weight.zero-extra-sample`,
  `single-scattering.source-weight.weighted-phase-sum`,
  `single-scattering.source-weight.missing-rejects`,
  `single-scattering.source-weight.invalid-rejects`,
  `surface.lambertian.black-direct-normal`, and
  `surface.lambertian.white-direct-normal-equals-one` supply fixture
  provenance for the first numeric expectations.

Status:

- First implementation slices completed for the final three transport stages.

### Reference Runner Solar-Source Mode Policy

Implementation file:

- `scripts/flat/atmosphere_rejected/run-reference-probe.js`

Consulted for:

- CLI/report contract and deterministic source-sample adapter behavior for
  output-impact Task 6.

Decisions:

- `--solar-source directional-sun` is the default sky-patch and sky-dome
  adapter. It emits one source sample at the solar center direction with
  `weight: 1`.
- `--solar-source finite-sun-disc` emits deterministic equal-area samples over
  the apparent solar disc. The finite-disc weights are equal and sum to `1`,
  preserving the current source-energy convention so the experiment isolates
  angular source extent rather than total source strength.
- `--finite-sun-samples <count>` is valid only with
  `--solar-source finite-sun-disc`. This prevents a hidden switch from the
  directional control into finite-source behavior.
- `solidAngleSr` remains source-shape provenance in the emitted samples. It is
  not multiplied into transport while `sourceSpectrum` represents the current
  source-energy convention rather than radiance-per-steradian input.
- The equal-area spiral is a local quadrature policy for deterministic
  experiments. It is not a physical solar measurement. The physical solar-size
  input remains the existing runner constant for apparent solar angular
  diameter.

Source support:

- [Stage Contracts](stage_contracts.md#integratesolartransmittance) supplies
  the source-sample handoff shape, required `weight`, and current
  `solidAngleSr` provenance policy.
- [Reference Code Design](code_design.md#cli-shape) supplies the runner CLI
  ownership and deterministic artifact policy.

Status:

- Task 6 implementation is complete. `npm run test:scripts:flat` passed with
  `405 specs, 0 failures` after adding parser, metadata, and finite-disc
  source-quadrature diagnostics.

### Flat Light Extent Probe Source Map

Implementation files:

- `scripts/flat/atmosphere_rejected/reference/light-extent-probe.js`
- `scripts/flat/atmosphere_rejected/data/reference/light-extent-scenarios.json`
- `scripts/flat/atmosphere_rejected/run-reference-probe.js`

Consulted for:

- Source breadcrumbs for classifying flat finite-Sun source-path extent before
  inventing terrain-visibility shortcuts.

Decisions:

- The probe is a post-pipeline diagnostic, not a canonical transport stage. It
  classifies source-path regimes so later flat-world terrain visibility work
  can decide whether detail is recoverable or should use a named low-detail
  approximation.
- Source-path opacity is represented as Beer-Lambert transmittance:
  `T = exp(-tau)`, with `tau = integral sigma_t ds`.
- Useful source light is represented as relative effective irradiance:
  finite-source solid angle times source-path transmittance, normalized to the
  start of the sampled source path.
- User-configurable Sun brightness and elevation are explicit scenario
  properties. `sun.brightnessScale` scales absolute effective irradiance, while
  `sun.elevationDeg` controls the flat source-path angle.
  `sun.directLightAvailable` can disable direct source contribution while
  retaining the configured source brightness for diagnostics. Brightness is
  not allowed to move the current relative-loss crossing distances; a later
  terrain visibility probe must introduce an absolute brightness, exposure, or
  contrast floor before user brightness determines visible-detail distance.
- Absolute `floors.effectiveIrradiance` entries are engineering anchors that
  are calculated from named configurations and reported separately from
  relative-loss crossings. They are not perceptual visibility thresholds.
- `app.flatDefaults.onePermilleMiddayEffective` is anchored to the current
  flat app default closest false-Sun pose:
  formula `0.1% * solarIrradianceScale 58 * solidAngle(radius 25.749504 km, distance 5050.674164842701 km)`;
  value `0.000004736087535019212 app-effective-source-units`.
- `realSun.sanJose.onePermilleToaIrradiance` is anchored to the app
  globe-simulation real-Sun top-of-atmosphere irradiance at the named San Jose
  pose: `1.3195095932262169 W/m2` for solar noon and
  `1.319379996648256 W/m2` for midnight.
- The flat app opposite-pose set is intentionally not labeled as physical
  midnight. With the current app's 3000-mile-high false Sun and San Jose
  observer, the opposite pose still has direct source light at about
  `20.0979340875104 deg` above the local flat horizon. The real-Sun midnight
  set is the contrast case and marks direct light unavailable because the Sun
  is below the globe horizon.
- A finite solar disk uses the geometric solid angle
  `2 * pi * (1 - cos(alpha))`, with `sin(alpha) = radius / distance`; for
  small disks this approaches the expected inverse-square
  `pi * (radius / distance)^2` behavior.
- Thresholds are configured as loss fractions in `[0, 1)`, where values close
  to `1` mean almost nothing remains. Exact `1` is rejected because exponential
  transmittance reaches zero only at infinite optical depth.
- The initial named scenarios are model hypotheses for classification:
  horizontal dense air, shallow upward dense air, distant finite Sun, and a
  homogeneous-air control. They are not Earth validation fixtures.
- App integration, if needed, should run this as a configuration-time
  classifier. A future browser-safe kernel or adapter can debounce
  Sun/atmosphere control changes, cache by physical configuration, and pass
  derived extents or sampled curves to renderer/terrain systems. This is not a
  per-frame or per-pixel transport calculation.

Source support:

- PBRT Transmittance supplies the optical-depth and Beer-Lambert attenuation
  basis.
- [Test Design](test_design.md#flat-large-lateral-path-checks) supplies the
  local flat large-lateral-path and lit-terrain follow-up rationale.
- Solar-source sanity checks in [Test Design](test_design.md#solar-source-sanity)
  record the small finite-Sun solid-angle limit.
- `src/flat/features/flat-simulation/models/consts.js` supplies the current
  app false-Sun radius, altitude, and `solarIrradianceScale` defaults used by
  `app.flatDefaults.midday` and `app.flatDefaults.midnight`.
- `src/flat/features/globe-simulation/models/consts.js` and the globe solar
  model supply the San Jose real-Sun defaults, Earth-Sun distances,
  top-of-atmosphere irradiance values, and direct-light availability used by
  the `realSun.sanJose.*` sets.
- IAU 2015 Resolution B3 supplies the nominal total solar irradiance
  `1361 W/m2` at `1 au` used as the real-Sun source anchor in app globe
  defaults.
- Secondary flat-earth claim breadcrumbs such as
  https://en.wikipedia.org/wiki/Modern_flat_Earth_beliefs and
  https://en.wikipedia.org/wiki/Samuel_Shenton mention variants with a
  small local Sun around `32 mi` across and `3000 mi` above Earth. These are
  not scientific authorities or validation sources; they only explain why the
  current app defaults resemble a commonly repeated claim. If flat-earth claim
  variants become package-facing presets, replace or reinforce this breadcrumb
  with primary-source claim pages and keep the presets explicitly labeled as
  hypotheses.

Status:

- Initial `--light-extent` CLI mode, named JSON scenario sets, Markdown/SVG
  reports, deterministic JSON output, and focused CLI helper specs are
  implemented.
- App-linked and real-Sun calculated floor sets are implemented in
  `light-extent-scenarios.json`, covered by focused CLI helper specs, and
  regenerated in `tmp/flat-light-extent/`.

### `expectation-fixtures.spec.js` Validation Source Map

Spec file:
`scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js`

Consulted for:

- Source breadcrumbs and enforcement logic for fixture provenance,
  derivation, units, tolerance, and structural comparison metadata.

Decisions:

- Every fixture file under
  `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures` is part of the
  oracle ledger and must validate through the same envelope checks.
- Every expected datum must carry a value, units, and derivation. Numeric
  expected data also needs a matching tolerance rule. Nonnumeric expected data
  needs an explicit structural comparison policy, either on the datum or at
  fixture-file level.
- Physics-backed rows must use external references; local API/schema rows may
  cite local design docs as long as those docs own the deeper rationale.

Source support:

- [Reference Test Design](test_design.md) and
  [Reference Test Plan](test_plan.md#fixture-and-reference-intake) supply the
  fixture intake checklist.
- [Reference Decision Log](references.md#expected-value-intake-workflow)
  supplies the canonical expected-value workflow.

Status:

- Deeper expected-datum validation now applies across all expectation fixture
  files, not only `analytic-invariants.json`.

### IAU 2015 Resolution B3, Nominal Solar And Planetary Constants

Link: https://arxiv.org/abs/1510.07674

Consulted for:

- Nominal total solar irradiance as a conventional SI anchor.

Decisions:

- Use `1361 W/m2` at `1 au` as a full-spectrum Sun-like source sanity anchor.
- Do not force visible-band integrations, such as `360-830 nm`, to equal the
  full-spectrum `1361 W/m2` value.
- Treat the nominal value as a convention for source configuration, not as a
  live measurement to update during tests.

Assumptions and limits:

- The value is full-spectrum irradiance at `1 au`; it is not a spectral table
  and not a surface irradiance after atmosphere.

Status:

- Reflected in solar-source sanity checks.

### Rayleigh Scattering Relationship

Link: https://en.wikipedia.org/wiki/Rayleigh_scattering

Consulted for:

- Preliminary reminder of the `lambda^-4` wavelength relationship and
  symmetric angular behavior.

Decisions:

- Use `lambda^-4` only as a named simplification or model property.
- Relationship test seed:
  `beta_R(450 nm) / beta_R(650 nm) = (650 / 450)^4 ~= 4.35` when that
  simplification is active.
- Stronger blue than red Rayleigh in-scattering is a relationship test under
  equal source and path conditions.

Assumptions and limits:

- This is a preliminary source for relationship tests, not the final authority
  for numeric Earth atmosphere coefficients. Bucholtz is now the preferred
  source for numeric Rayleigh fixture candidates; retain this entry only as a
  breadcrumb for the common qualitative wavelength relationship.

Status:

- Reflected as relationship checks in [Test Design](test_design.md), but not as
  a numeric fixture source.

### libRadtran

Link: https://www.libradtran.org/doku.php

Consulted for:

- External precedent that radiative-transfer code can be distributed as a
  standalone package with programs, documentation, releases, and reference
  publications.
- Comparison target for later full-run validation after local analytic and
  invariant tests pass.

Decisions:

- Treat this reference integrator as a potential separable package, not just an
  app-private script.
- Keep the core library framework-free and callable without browser or renderer
  context.
- Prefer CLI/config-driven runs for reproducible validation and comparison.
- Consider libRadtran as a candidate external comparison tool after the model
  assumptions are pinned.

Assumptions and limits:

- libRadtran is a mature general radiative-transfer package, not the API shape
  we are copying.
- Its license and scope are different from this project. We mine validation
  precedent and comparison ideas, not implementation.

Status:

- Reflected in package-separable direction and open reference needs.

### NREL/NLR SMARTS

Link: https://www.nlr.gov/grid/solar-resource/smarts

Consulted for:

- External precedent for a standalone clear-sky spectral irradiance model.
- Text/config inputs and ASCII outputs as reproducibility features.
- Role in producing ASTM reference spectra.
- Clear documentation of applicable atmospheric conditions and spectral
  resolution.

Decisions:

- Keep the future CLI JSON/config-first and deterministic.
- Make run metadata and prescribed conditions explicit in outputs.
- Treat spectral irradiance and photometric outputs as separate named output
  choices, not hidden display conversions.
- Use SMARTS/G-173 as justification for publishing reproducible probe configs
  alongside outputs.

Assumptions and limits:

- SMARTS is clear-sky solar spectral irradiance, not a drop-in sky-radiance
  renderer. Use it for solar/source and reference-condition precedent.

Status:

- Reflected in CLI/report design and package-separable direction.

### Semantic Versioning 2.0.0

Link: https://semver.org/spec/v2.0.0.html

Consulted for:

- Public API and compatibility expectations for a future package.

Decisions:

- Before any publishable `1.0.0`, the public API must be clearly and precisely
  documented.
- While the API is still moving, treat the package as `0.y.z` initial
  development.
- Public API changes should be tracked separately from internal refactors.
- Package extraction should preserve deterministic tests and fixtures so
  semantic behavior changes are visible, not only signature changes.

Assumptions and limits:

- SemVer governs package compatibility, not physical correctness. Domain tests
  remain the authority for whether behavior is scientifically acceptable.

Status:

- Reflected in [Code Design](code_design.md) package-separable direction and
  [Plan](plan.md) promotion checks.

## Open Reference Needs

- Review the generated preview-vs-Bucholtz Rayleigh comparison artifacts and
  decide whether `bucholtz-standard-air` should become the default for
  Earth-like sky-patch benchmarks.
- Source-backed optical-depth extreme cases for clear air, such as low optical
  depth at longer visible wavelengths and high optical depth at shorter
  wavelengths or low solar elevation. Bucholtz and Kasten/Young now cover the
  molecular Rayleigh and air-mass pieces; aerosol presets now provide named
  scenario inputs, but full clear-air expected spectra still need an
  external-tool fixture or matching validation bundle.
- A sourced ozone vertical profile/column policy. The Brion 1998/MPI-Mainz
  cross-section dataset is now selected for spectral absorption, but the
  profile, column amount, seasonal/latitude behavior, and default policy still
  need a sourced decision before ozone becomes a full Earth clear-air
  validation input.
- External validation for the first named aerosol/Mie presets. The current
  presets provide AOD, Angstrom exponent, single-scattering albedo, scale
  height, and phase `g` for visual comparisons; they still need AERONET,
  SMARTS, libRadtran, or another matched configuration before becoming
  package-facing clear-sky truth.
- A source for physically grounded sky luminance or radiance sanity ranges
  after the clear-air profile, aerosol, observer altitude, solar zenith, and
  albedo are pinned.
- A decision on whether libRadtran or another radiative-transfer tool becomes
  the first external full-run comparison target.
- License/provenance decisions for any external data bundled in a future
  package versus loaded as user-provided fixtures.
- Candidate validated libraries for colorimetry, spectral interpolation,
  numerical quadrature, vector/matrix math, solar position, atmospheric profile
  interpolation, and radiative-transfer comparison.
- A dependency acceptance checklist covering validation evidence, maintenance,
  license compatibility, deterministic behavior, Node/package compatibility,
  wrapper boundary, and SemVer impact.
- A primary-source audit for secondary references that currently support
  package-facing physics claims, expected values, constants, or validation
  ranges. Record whether each secondary source was replaced by a primary
  source, reinforced by one, or intentionally retained with a stated limitation.
- A package README/API documentation checklist before any extracted `1.0.0`.
