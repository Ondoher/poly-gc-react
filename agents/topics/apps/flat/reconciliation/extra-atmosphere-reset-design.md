# Extra-Atmosphere Reset Design

Status: governing design for the Phase 6 extra-atmosphere source-model reset.
The reset plan owns current execution progress and the active record.

This document is current architecture, not chronology. Execution history lives
in `tmp/atmosphere/reconciliation/running-log.md`; durable evidence lives in
immutable numbered directories under `tmp/atmosphere/reconciliation/NNN-*`.

This is a scoped reset. It preserves the accepted Algorithm32 atmosphere,
ephemeris, geometry, depth, and continuous boundary-transport physics while
replacing the universal pixel-level celestial-radiance packet and every
prototype brightness calibration built on it.

## Authority And Scope

This document owns the replacement architecture and the line between preserved
and reset behavior. [Extra-Atmosphere Reset Plan](extra-atmosphere-reset-plan.md)
owns execution order and phase exits. [Extra-Atmosphere Objects](extra-atmosphere-objects.md)
owns the object-specific research inventory, maturity, physical gates, and
candidate reference sources.

This document is the sole governing celestial source/raster architecture for
the reset. Detailed mechanical evidence remains in immutable numbered records;
it is not reconstructed in an earlier design document. The accepted
Algorithm32 atmosphere contract remains owned by the
[Algorithm32 Production Design](../algorithm32/production-design.md).

Immediate scope:

- reality-configured globe Sun and Moon;
- calibrated catalog stars and explicitly synthetic Flat32 diagnostics;
- the CPU soft-shader/reference path;
- San Jose and Union Glacier Flat32 scene fixtures after isolated proofs pass.

Deferred scope:

- fictional flat Moon and eclipse bodies;
- Milky Way, zodiacal light, and other diffuse celestial fields;
- Moon/star illumination of the atmosphere, terrain, or scene;
- assembled visible-celestial GPU/browser raster and composition;
- production acquisition and object-specific Moon/star radiometry beyond the
  accepted generic typed/CPU seam and canonical Sun owner;
- human-eye or camera visibility claims beyond physical source transport.

## Why The Reset Is Necessary

The current POC models every visible celestial object as a per-camera-ray,
coverage-resolved `celestialRadiance` array. That representation is usable for
a resolved extended direction, but it is not the physical source quantity for
an unresolved star.

An unresolved point source owns spectral irradiance integrated over its angular
delta. Atmospheric transmittance and geometric visibility apply at the exact
source direction; a camera, ideal reconstruction response, or display kernel
then distributes the transmitted point flux across pixels. Applying each
neighboring pixel's transmittance to an already spread footprint changes the
physical ordering.

The old packet also uses one scalar `coverage` for geometric occupancy, energy
weighting, and opaque compositing. Those are different concepts:

- geometric visibility determines whether a direction is blocked;
- extended-source integration measures angular area within a pixel;
- point-response weight distributes a conserved point flux;
- opacity determines whether a nearer body masks a farther direction.

Fixed solid angle, authored star disks, and source-only exposure cannot
conserve magnitude-derived point-source flux. Further tuning cannot repair the
quantity mismatch.

## Reset Boundary

| Surface | Decision | Qualification |
| --- | --- | --- |
| Algorithm32 atmosphere density, scattering, cache, and transport | Preserve and freeze | This reset does not reinterpret a celestial-source failure as an atmosphere failure. |
| Continuous external-boundary transport | Preserve | `L_out(lambda, omega) = L_path(lambda, omega) + T(lambda, omega) L_boundary(lambda, omega)` remains the physical directional law. |
| Canonical Algorithm32 spectral basis and Color boundary | Preserve | The runtime basis has 15 spectral-density samples with represented wavelength-bin widths; Color remains the single post-composition display owner. |
| Globe ephemeris, returned-epoch validation, observer transforms, physical Moon geometry, depth, horizon, and scene occlusion | Preserve | These mechanics remain independent of source calibration. |
| Source-owned Sun facts and companion visible-body concept | Preserve | One source owns direction, angular size, and solar spectrum; a visible-disk adapter must not duplicate them. |
| Real Flat32 scene snapshot and location-owned schedules | Preserve as test fixtures | They validate the result; they do not calibrate celestial brightness. |
| `ExternalBoundaryRadianceSample` as the universal source/pixel contract | Refocus | Directional extended-radiance sampling may survive with typed physical units; point irradiance must use a separate post-transport accumulator. |
| `celestialRadiance-is-pixel-coverage-resolved` policy | Replace | Pixel integration becomes an explicit renderer operation with separate point and extended paths. |
| Scalar candidate `coverage` used for energy and opacity | Replace | Visibility, extended angular measure, point-response weight, and opacity receive separate contracts. |
| Magnitude-scaled solar spectrum, fixed solid angle, authored star disks, and star-only exposure | Reject | These quantities supply no forward calibration. |
| Neutral Moon spectral albedo `0.12` as physical calibration | Reject | It may remain only in an explicitly analytic or presentation fixture. |
| Current celestial GPU slice and subjective visibility gates | Pause | GPU parity follows accepted CPU source/raster physics; visual review cannot accept source radiometry. |

Existing record directories remain immutable. Retained POC modules remain
evidence after replacement acceptance, but they do not constrain the accepted
contract and will not receive compatibility aliases.

## Abandoned Approaches And Why

`Abandoned` means an approach must not appear in the active reset path, as a
fallback, or behind a compatibility alias. Its records and code may remain as
immutable evidence until cleanup, but acceptance of the replacement does not
carry the old behavior forward.

| Abandoned approach | Why it was abandoned | Governing evidence or consequence |
| --- | --- | --- |
| Captured, authored, or precomposed RGB as celestial source radiometry | RGB is already display-dependent and cannot own top-of-atmosphere spectral quantity, atmosphere ordering, or flux conservation. | Celestial bodies remain spectral until Color. Decorative backgrounds and ordinary scene endpoints stay explicitly separate. |
| One universal per-camera-ray, coverage-resolved `ExternalBoundaryRadianceSample` for points and extended bodies | A point source is an angular delta owning irradiance, not radiance sampled independently by neighboring destination rays. | The directional lane remains only for extended radiance; points use an exact-source post-transport accumulator. |
| Generic candidate alpha composition using `remaining * coverage` | It conflates angular occupancy, opacity, and energy distribution. Opaque point stars can suppress other additive stars, and partial coverage is resolved before actual angular visibility integration. | Replace it with per-direction extended visibility and exact-center point visibility. Coverage becomes a derived extended diagnostic. |
| Treating point-response weight as geometric coverage or opacity | A normalized response distributes already visible point flux; it is neither a source fact nor an occluding area. | Point weights live only in derived raster diagnostics. Geometry owns blockers; point emitters always add. |
| Fixed or viewport-wide pixel solid angle | Perspective pixel solid angle varies with camera, pixel, FOV, resolution, and field position. | Exact corner-ray `Omega_i` replaces it. |
| Authored star angular disks, top hats, and Flat32 point sizes as physical footprints | Those are display/raster controls, not stellar angular diameters, and their area changes integrated flux. | Source irradiance and a normalized point response replace them. |
| Scaling the solar spectrum uniformly by visual magnitude | A magnitude constrains flux in a named passband; it does not make every star share the solar SED or determine spectral color. | Real stars require a flux-calibrated spectrum or a declared SED normalized through a sourced passband. Synthetic stars require an explicit SED/flux policy. |
| Star-only exposure, inverse-display calibration, and brightness sweeps | Source-specific display gain changes physical flux and can make the same star both reviewable at night and incorrectly visible at noon. | The source owns flux; one global display transform follows full composition. |
| Independent per-pixel or row-streamed point rendering | A point response must normalize and distribute one source measure across every affected pixel and row. Independent destination pixels cannot own that conservation. | Replace the current row-isolated path with a full-frame or equivalently bounded tile-with-halo HDR accumulator. |
| Applying destination-pixel transmittance after point spreading | Atmospheric visibility/transmittance belongs to the exact source direction and precedes an optical/reconstruction response. Neighboring-pixel transmittance changes the transported point flux; preattenuating and then using the old composer can also apply transmittance twice. | Exact source-center visibility and `T_lambda(omega_s)` are evaluated once; only transmitted irradiance is spread. Path radiance is never spread. |
| Treating point stars as opaque candidates | Point emitters do not consume pixel area or occlude one another. | Multiple stars add linearly. Opaque Moon, globe, terrain, and scene geometry may block their exact source directions. |
| Neutral display-derived Moon albedo `0.12` as physical lunar radiometry | It has no sourced spectral BRDF/photometric behavior, no accepted Sun-at-Moon irradiance contract, and no independent phase/distance calibration. | Globe ephemeris and phase geometry survive; radiometry is replaced by a sourced lunar model. Neutral Lambert behavior is allowed only as a labeled analytic fixture. |
| Center-sample Moon shading followed by a scalar partial-pixel coverage multiplier as the final integration model | It can undersample the limb/terminator and does not guarantee resolved-to-collapsed disk-flux conservation. | Replace it with conservative extended angular integration and an accepted collapsed-disk limit. |
| Moving the Moon to satisfy an astronomical or daytime-visibility gate | An artificial direction breaks the ephemeris claim even when distance, phase, and angular size are retained. | Artificial placement remains presentation-only. Astronomical acceptance always uses actual returned-epoch geometry. |
| Nonblack pixels, local byte contrast, noon burial, or human review as physical-radiometry proof | Reviewability can detect output but cannot establish SI source quantity, conservative rasterization, complete sky background, or an observer response. | Physical and observational statuses remain separate. |
| Using real Flat32 scenes to tune source brightness | Scene content, schedule, occlusion, and display make failures hard to assign and encourage compensating scalars. | Isolated quantity/conservation/transport phases now accept the source first. San Jose and Union Glacier are validation fixtures only. |
| Treating the current celestial GPU slice as the forward implementation baseline | It proves assembled-atmosphere and geometry mechanics but carries pre-reset source, coverage, point-footprint, and display assumptions. | GPU work is rebuilt only after CPU reset acceptance. GPU atmosphere independence survives; the celestial source/raster slice does not. |
| Preserving old source/raster behavior through aliases, fallback packets, or dual contracts | A migration bridge would keep two owners for quantity, coverage, exposure, and display behavior and allow rejected constants to return silently. | Once replacement phases pass, active POC consumers move to the new contract together and stale consumers fail loudly. |

### Preserved Rather Than Abandoned

The reset explicitly retains:

- Algorithm32 atmosphere coefficients, cache construction, path radiance, and
  transmittance math;
- the continuous directional boundary-transport law;
- the canonical 15-center spectral basis, with its missing quantity/bin facts
  restored by a typed wrapper;
- globe ephemeris, returned-epoch provenance, observer transforms, Moon/Sun
  geometry, finite depth, horizon, and scene occlusion;
- source-owned Sun identity and companion visible-disk ownership;
- the Flat32 scene snapshot and location-owned schedule as validation input;
- immutable numbered records as qualified evidence.

### Deferred Rather Than Abandoned

The fictional flat Moon, lunar texture, eclipse dark body, diffuse celestial
fields, Moon/star illumination of atmosphere or scene, a calibrated
human/camera observer, and assembled visible-celestial GPU/browser work remain
possible later work. The selected typed/CPU production seam and canonical Sun
owner are accepted; only the pre-reset celestial GPU implementation is
abandoned as a future GPU baseline.

## Governing Physical Model

### Continuous directional transport

For an extended source direction `omega`:

```text
L_out(lambda, omega) = L_path(lambda, omega)
                     + V(omega) T(lambda, omega) L_extended(lambda, omega)
```

`V` is geometric visibility. Algorithm32 owns `L_path` and `T`; the celestial
source owns the top-of-atmosphere boundary quantity.

### Pixel-integrated transport

For pixel angular domain `P_i` with exact solid angle `Omega_i`, the physical
target is:

```text
L_pixel(lambda, i)
  = (1 / Omega_i) integral over P_i of
      [L_path(lambda, omega)
       + T(lambda, omega) sum_j V_j(omega) L_extended_j(lambda, omega)] dOmega

    + (1 / Omega_i) sum_s
      [V_s T(lambda, omega_s) F_s(lambda) p_i,s]
```

where:

- `F_s(lambda)` is point-source spectral irradiance;
- `omega_s` is the exact source direction;
- `p_i,s` is the fraction of transmitted point flux assigned to pixel `i`;
- `p_i,s >= 0` and `sum_on_frame p_i,s + p_off_raster,s = 1` over the full
  modeled response;
- point-source response is normalized per wavelength if it is chromatic.

This equation preserves the continuous atmosphere law but replaces the old
assumption that every discrete pixel can use its own view transmittance times a
pre-spread, coverage-resolved star radiance.

The initial CPU implementation may approximate the extended and path integrals
with center samples or bounded quadrature, but the approximation, weights, and
convergence residual must be explicit. Point-source visibility and
transmittance always use the exact source direction before response spreading.

## Canonical Source Contract

The reset uses one discriminated external-source contract. The accepted POC
and production file/class names follow repository placement and naming
conventions while preserving the ownership described below.

```text
ExternalCelestialSource
  id
  geometry
  spectralMeasure
  provenance

spectralMeasure =
  PointSpectralIrradianceDensity
  | ExtendedSpectralRadianceDensity
```

The discriminated source contract is a common registry/ownership shape, not a
requirement that both measures use one execution packet. Dispatch is explicit:

- extended measures enter a directional boundary-radiance integrator;
- point measures enter a frame-aware post-transport point accumulator.

Do not add a `kind` switch to the old per-camera-ray packet and then force both
branches through destination-ray transmittance.

### Point spectral measure

`PointSpectralIrradianceDensity` owns:

- 15-channel top-of-atmosphere spectral irradiance density;
- units `W m^-2 nm^-1`;
- active spectral-basis fingerprint;
- source spectrum, catalog/passband, normalization, and uncertainty
  provenance.

The paired source geometry owns exact observer/time direction and finite or
infinite depth. The measure does not own direction, occlusion, pixel solid
angle, PSF size, display exposure, tone mapping, or atmospheric transmittance.

### Extended spectral measure

`ExtendedSpectralRadianceDensity` owns a radiance sampler evaluated from a
geometry-resolved direction/surface sample:

- units `W m^-2 sr^-1 nm^-1`;
- active spectral-basis fingerprint;
- material, illumination, BRDF/emission, and uncertainty provenance.

The paired source geometry owns angular support, depth, opacity, pose, and
intersections. The measure does not own geometry or pixel coverage. The pixel
integrator derives angular overlap from the runtime camera and source geometry.

### Typed spectrum wrapper

No bare numeric array may cross the new source boundary. A reset source packet
must name:

- quantity: spectral irradiance density or spectral radiance density;
- units;
- ordered wavelength centers and represented bin widths;
- values;
- basis and source fingerprints;
- provenance and uncertainty status.

The POC adapter may validate and unwrap values when calling the frozen
Algorithm32 numerical path, whose internal `SpectralValue` remains an aligned
array. Unit information must remain available in diagnostics and records.

## Spectral Basis And Binning

The reset uses the accepted Algorithm32 runtime basis rather than inventing a
new celestial grid:

- 15 centered samples from `360 nm` to `830 nm`;
- represented bin width `31.333333333333332 nm`;
- canonical solar rows interpreted as center-interpolated extraterrestrial
  spectral irradiance densities in `W m^-2 nm^-1`;
- other source/channel values interpreted as bin-average spectral densities;
- Color multiplies spectral radiance density by the represented bin width when
  integrating against the CIE color-matching functions.

High-resolution source data is conservatively converted to channel density:

```text
channelDensity = integral over channel bin of sourceDensity dLambda
                 / channelBinWidth
```

The record retains the raw source, unit conversion, interpolation/integration
method, out-of-range policy, bin bounds, and numerical reference. A source may
not silently mix bin-integrated `W m^-2` values with density
`W m^-2 nm^-1` values.

The existing canonical solar rows remain the accepted atmosphere/light-source
input. The visible Sun audit must make their unit/provenance wrapper explicit;
it must not recalibrate or fork the atmosphere's solar owner.

As a reset invariant, midpoint integration of the 15 accepted solar density
samples over the represented `360..830 nm` band is approximately
`739.5836758 W m^-2`. This is a bounded-band check, not total solar irradiance.

Selected production ownership now encodes this meaning through the accepted
typed source/basis wrapper: ordered centers, widths, bounds, quadrature, units,
source values, and provenance participate in compatibility fingerprints while
the aligned internal `SpectralValue` transport math remains unchanged.

## Runtime Responsibilities

### Celestial state and geometry

The state/geometry layer owns:

- observer-independent world state where the body is physical;
- observer/time-derived direction, distance, angular support, and pose;
- finite ray depth or infinite-direction semantics;
- horizon, terrain, scene, and body/body intersection facts;
- actual versus artificial placement status.

It does not own source power, pixel response, display values, or atmosphere
coefficients.

### Visibility resolver

The replacement visibility resolver operates on directions and depths, not on
brightness-weighted coverage:

- opaque finite bodies mask farther angular sources at each sampled direction;
- scene geometry and the globe mask external sources;
- multiple point sources add and never consume a shared `remaining` coverage;
- a point source is either visible or blocked at its exact center direction;
- diffuse and other additive fields combine unless an opaque nearer body masks
  their direction;
- deterministic IDs and diagnostics resolve otherwise identical inputs, but
  body-class priority is not a substitute for physical depth.

### Extended boundary-radiance integrator

The existing `ExternalBoundaryRadiance` concept may be narrowed to extended
directional radiance. An `ExtendedBoundaryRadianceIntegrator`-style owner
derives:

- exact perspective-pixel solid angle from corner rays;
- extended angular quadrature and physical coverage;
- resolved-to-collapsed disk convergence;
- pre-display pixel-average spectral radiance and conservation diagnostics.

It samples visibility and boundary radiance at actual quadrature directions,
then uses the corresponding directional Algorithm32 transmittance. The old
scalar `remaining * coverage` compositor is replaced by visibility resolution
inside angular quadrature; a coverage summary may be emitted afterward as a
diagnostic.

### Point-source accumulator

A separate frame-aware `PointSourceAccumulator`-style owner derives:

- exact source-center globe/Moon/scene visibility;
- exact source-direction transmittance;
- transmitted spectral irradiance `F_lambda T_lambda`;
- normalized per-pixel response weights;
- exact destination-pixel solid angles;
- modeled support/tail policy and explicit off-raster loss;
- a spectral-radiance contribution accumulated across the HDR frame.

The current independent per-destination-pixel renderer and row-at-a-time scene
feed cannot own this operation because they cannot normalize and distribute one
source measure over all affected pixels. The point accumulator runs after the
base per-pixel atmosphere/endpoint evaluation and before the one display pass.

Geometric coverage belongs only to extended/angular integration. Point weight
belongs only to the normalized point response. Point sources never consume an
opaque `remaining` fraction.

### Atmosphere sampler

The integrator requests frozen Algorithm32 outputs at the directions required
by the measure:

- pixel/path directions for path radiance and extended sources;
- exact point-source directions for point transmittance;
- no atmosphere result is uploaded from CPU as a later GPU answer.

The reset may need a POC-local batch/directional sampling adapter around the
existing CPU evaluator. It must not modify atmosphere equations or source
caches.

### Frame composition

The CPU frame composer first retains the base per-pixel atmosphere/endpoint
result, then adds:

```text
pixel path radiance
+ transmitted extended-source pixel radiance
+ transmitted point-source pixel radiance
```

The result remains a 15-channel spectral-radiance density until the global
Color/display boundary. No celestial source converts itself to RGB.

This reset does not pretend an ordinary captured/material scene endpoint is
spectral radiance. Path plus extended plus point celestial contributions form
the spectral layer supplied to Color; any existing scene-endpoint RGB remains a
separate explicitly labeled Color input. Color performs their one global
display composition. A point response overlapping a scene pixel therefore
stays spectral until that boundary and is not routed through captured scene
RGB.

A visible point source may have a post-transport response overlap a destination
pixel whose camera ray hits the Moon or scene geometry. That is distinct from
source visibility: if the exact source-center ray is blocked, the accumulator
adds nothing; if it is visible, its normalized optical/reconstruction response
may cross an image-space silhouette. The response model must declare this
ordering.

## Current POC Disposition

| Current surface | Reset disposition |
| --- | --- |
| `SpectralReferenceEvaluator` and `SpectralCalculator` | Preserve unchanged as the CPU atmosphere/path/transmittance engine. Call them for destination directions and exact point-source directions. |
| `ExternalBoundaryRadiance` role | Narrow to typed extended directional radiance; remove point-source ownership and prototype unit claims. |
| `ExternalCelestialDepthResolver` | Preserve finite/infinite geometry lessons, replace scalar coverage/opacity brightness compositing with direction/depth visibility resolution. |
| `CpuPostprocessSoftShader` | Refactor from a purely independent-pixel celestial composer into base spectral-frame evaluation plus extended integration, point accumulation, and one final display pass. |
| `Flat32CpuSoftShaderSceneRenderer` | Preserve camera/scene/schedule adaptation; replace viewport-wide approximate pixel radius and row-isolated star spreading with exact frame/corner-ray facts. |
| Current star providers/runners | Exclude from the active source/raster path; do not port fixed solid angle, top-hat disks, solar SED scaling, or source-only exposure. |
| Sun/Moon providers | Preserve source/geometry ownership; replace prototype source units and coverage integration with typed radiometry and conservative extended sampling. |

## Source Ownership

| Source | Canonical owner | Reset output | Prohibited shortcut |
| --- | --- | --- | --- |
| Real distant Sun | Existing Sun light source and returned-epoch geometry | Extended disk radiance derived from the owner's spectral irradiance and normalized disk/limb profile | Duplicate solar spectrum or Sun-only gain |
| Globe Moon | Shared globe ephemeris/body state plus lunar radiometry provider | Finite extended reflected spectral radiance from canonical Sun illumination and sourced lunar model | Neutral RGB/albedo treated as physical truth, moved Moon for acceptance |
| Real star | Versioned catalog/state plus stellar radiometry provider | Point spectral irradiance density | Solar SED scaled by visual magnitude, authored angular disk, fixed pixel solid angle |
| Flat32 synthetic star | Hashed scene fixture plus declared synthetic SED/flux policy | Point irradiance only if a physical quantity is explicitly assigned; otherwise diagnostic-only | Calling authored `sceneRgb`, radius, or A-H level a physical star |
| Configured local Sun | Local source state with declared radius, power, distance law, and intent | Finite extended radiance | Implicit real-Sun claim or brightness slider |
| Planet/diffuse field | Later body or map owner | Extended radiance or conservative point collapse | Reusing star footprint policy or decorative background RGB |

The Sun's atmosphere-illumination role and visible-disk role share source facts.
The Moon and stars remain visible-boundary sources only during this reset; their
future illumination of atmosphere or scene is a separate design.

One immutable quantity-bearing solar packet feeds CPU atmosphere illumination,
visible-disk derivation, and any eventual GPU bindings. Its spectral values,
basis, units, quadrature, and provenance participate in descriptor identity.
The accepted production implementation rejects the prior configured-CPU versus
hardcoded-shader split and binds both sides to the same packet fingerprint.

### Lunar calibration policy

The first calibrated globe-Moon source uses the versioned executable LIME
contract as its central disk-integrated model: LIME-TBX `v1.4.1`, coefficient
set `20251010_v1`, ASD `v2.0.0`, native coefficient/covariance row order,
nearest signed integer ASD phase, release linear residual interpolation, and
the release CIMEL response-correction sign. The release changelog's paired
coordinate/coefficient swap and output-preservation statement resolves the
ATBD table-label conflict without permuting the retained payload.

Coefficient and ASD wavelength/phase correlation propagate jointly into the
canonical channels. Quadratic/cubic interpolation and the opposite ATBD
response-correction sign are coherent model-form populations, not alternate
runtime owners. The LIME TSIS standard remains calibration provenance; an
exact solar-weighted transfer produces effective canonical-Sun reflectance so
the existing canonical Sun packet remains the sole runtime solar owner.

XA-G09 uses the 2022 NIST Air-LUSI disk-integrated irradiance as the decisive
direct SI-traceable reference wherever its measured wavelength support fully
covers a canonical bin. The first canonical bin is outside that complete
support and therefore uses published ROLO 311g only as a separately labeled,
qualified model-reference supplement. Neither source supplies a resolved
lunar texture, BRDF field, Earthshine, or eclipse model.

The first ER6 transport bridge evaluates the accepted LIME `calibratedRuntime`
central branch from an integrity-checked returned-epoch physical state and the
one canonical Sun packet. It converts disk-integrated irradiance to a uniform
finite angular disk with `L_lambda = E_lambda / (pi sin(alpha)^2)`. This is a
flux-conserving transport surrogate, not a resolved lunar albedo or BRDF claim.
Its finite depth is observer-to-body-center; near-Moon contact or overlap needs
future per-sample surface-intersection depth and is explicitly outside ER6.

### Independent Sun and Sirius calibration policy

The canonical ASTM-derived 15-channel Sun packet remains the sole runtime
solar owner. XA-G09 compares only its exact `360..830 nm` represented integral
with the independently versioned TSIS-1 HSRS v2 spectrum. Published HSRS
standard uncertainty is integrated as fully correlated for a conservative
bound. Per-channel ASTM/HSRS differences remain diagnostic because the runtime
packet uses accepted center interpolation; they do not create a second solar
packet or recalibrate individual channels.

The CALSPEC `sirius_stis_005` packet remains the sole Sirius source owner. Its
absolute scale is compared with Rieke et al. (2023) through two predeclared
operators: an exact `554.5..557.0 nm` visible-window average against the
published `555.75 nm` anchor, and an unweighted log-space continuum power-law
fit over `2.00..2.31 micrometers`, excluding `2.14..2.18 micrometers`, against
the independently radiometric MSX-transferred `2.1603 micrometer` anchor. This
accepts absolute scale only; it does not independently validate every
canonical Sirius channel.

## Point Response And Occlusion

The first response is an ideal, deterministic, normalized renderer response.
It is not automatically a human-eye, atmospheric-seeing, diffraction, bloom,
or display-glare model.

Required behavior:

- response parameters and angular/sensor interpretation are named;
- `p_i >= 0`; the modeled full response sums to one and computational kernel
  truncation has an explicit tail policy;
- on-frame weights plus reported off-raster response sum to one;
- image-edge clipping is never renormalized: on-frame weight plus recorded
  off-raster loss equals the full response;
- chromatic response normalizes independently per channel;
- resolution and FOV changes do not change total accounted source flux;
- the exact star direction is tested against Moon, globe, and scene occlusion
  before spreading;
- an unoccluded star's optical response may overlap a Moon or scene-object
  image after spreading, while an occulted star contributes no flux;
- multiple stars add linearly even when their responses overlap.

Atmospheric seeing or scattering belongs in the atmosphere/propagation model if
later required. Display bloom belongs after physical radiance and must not feed
back into source flux.

## Extended-Source Integration

For a uniform Sun disk with angular radius `alpha`, the visible-disk adapter
must recover the source irradiance:

```text
E_lambda = pi L_lambda sin(alpha)^2
```

A limb-darkened profile must be normalized to the same disk-integrated source
irradiance. The globe Moon instead derives outgoing radiance from incident
solar irradiance, surface normal, geometry, and a sourced spectral
BRDF/photometric model. Both resolved and collapsed paths must converge to the
same disk-integrated flux.

Angular supersampling is numerical integration, not a source-brightness knob.
Coverage is applied exactly once through the angular integral.

## Display And Observer Boundary

The accepted Color abstraction remains the sole display owner. It consumes the
fully composed spectral-radiance density and owns CIE/XYZ/RGB conversion,
global exposure or comparison scale, tone mapping, output color space, and
output transfer.

Current production captured-scene composition is an RGB endpoint proxy, not a
physical celestial-boundary seam. Reset CPU work composes sky and celestial
spectral density before calling Color. It may reuse Color's midpoint CIE/XYZ/
linear-sRGB conversion and Figure-1 tone map globally, but the Figure-1 scale
is a comparison display, not a calibrated eye or camera. Any sRGB/OETF review
encoding remains separately named.

Every record retains pre-display HDR/spectral output. A review transform may be
used only when:

- it is global across sky, Sun, Moon, stars, and scene;
- its complete descriptor/fingerprint is retained;
- canonical numerical output remains available;
- it is not interpreted as source or visibility calibration.

Physical source-to-pixel transport does not require a human observer model.
Naked-eye or camera visibility additionally requires a named observer,
adaptation/exposure, optics, display luminance/dynamic range, and independently
bounded local sky background. That is a separate claim layer.

The active Phase-6 reset claim ends at retained pre-display spectral-radiance
density. Record 059 selects no naked-eye, camera, automated-reviewability,
numerical-detection, or observational-visibility claim. Algorithm32 direct-
solar path radiance is not relabeled as a complete local sky background.
Observer/background validation and XA-R11 therefore remain out of scope/
deferred without changing physical source flux or atmosphere constants.

## Diagnostics And Fail-Loud Rules

Every physical pixel/source record retains:

- source identity, measure kind, units, values, uncertainties, and data hashes;
- basis fingerprint, wavelength centers, bin widths, and resampling method;
- exact source and pixel directions, corner rays, and `Omega_i`;
- point-response kind, support, parameters, per-channel weights, and
  normalization residual;
- extended quadrature directions, weights, angular support, and coverage;
- visibility/occluder/depth result before response spreading;
- source-direction or quadrature-direction transmittance;
- input and reconstructed per-channel flux with residuals;
- path, extended, point, final pre-display, and display values separately;
- atmosphere, geometry, source, camera, integrator, and display fingerprints.

The implementation fails loudly on quantity/unit/basis mismatch, missing
provenance, negative spectra or response weights, non-normalized point support,
duplicate source IDs, invalid geometry, or attempts to pass display RGB as
celestial radiometry.

## POC And Promotion Boundary

Reset evidence implementation remains under `scripts/flat/reconciliation/POC/`
and uses fresh immutable records. `src/flat32/` remains a reference input;
accepted production behavior is copied into `shared/algorithm32/production/`
without a runtime dependency on the POC or `tmp`.

The accepted isolated reset implementation consists of
`TransportedPointSourceAccumulator`, `TransportedExtendedSourceIntegrator`,
`ExactDirectionalVisibilityResolver`, `FrozenAtmosphereSpectralFrameEvaluator`,
`PhysicalSpectralFrameComposer`, the canonical solar illumination/disk pair,
and their typed source packets. It uses one conservative directional extended
path with no collapsed optimization and composes path, transported endpoint,
extended, and point radiance before one display pass. Record 050 owns its
accepted evidence; these POC classes remain experimental inputs to ER6, not a
production runtime dependency.

The accepted replacement follows these promotion rules:

- remove superseded POC source/raster behavior rather than preserve aliases;
- keep immutable numbered records as durable evidence;
- promote only the smallest accepted contracts into production ownership;
- rerun CPU convergence before GPU work;
- build GPU parity from accepted source measures and integration, never from
  old review constants. The existing GPU still owns base atmosphere path
  evaluation; a successor may upload only the separately identified fully
  transported celestial addend, not a replacement CPU atmosphere frame.

Execution status is owned by the reset plan. Record 067 reports a selected
promotion execution after the accepted CPU work, but its proof omitted the
production unit-packet rule and the user later rolled back the implementation.
It establishes neither current production ownership nor successor acceptance.

### Selected successor production scope

The selected successor is the smaller additive seam owned by
[CelestialContributionCache Design](../algorithm32/celestial-contribution-cache-design.md).
That production document is the single owner of field measures,
camera-independence, visibility/depth policy, point response, resource
qualification, invalidation, failure behavior, scope, and proof requirements.

This reset design remains the accepted CPU behavior/evidence input. It does not
freeze the successor's physical layout or API and must not be used as a runtime
dependency. The production cache design preserves the existing Algorithm32
facade and base atmosphere/Color path, distinguishes optional-disabled zero
from configured-invalid failure, and requires a fresh applicable GPU/browser
proof.
