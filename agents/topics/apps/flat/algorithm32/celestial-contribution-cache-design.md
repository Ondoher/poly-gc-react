# CelestialContributionCache Design

Status: selected production architecture, not implemented or accepted.

This document is the canonical design owner for the optional
`CelestialContributionCache` extension to production Algorithm32. Current
implementation truth remains `shared/algorithm32/production/`. Accepted
reconciliation records provide behavioral oracles, not runtime dependencies or
a class-for-class implementation plan.

Record `067` describes a rolled-back production attempt. It does not establish
current production ownership and cannot accept this design. Implementation
requires a fresh production proof with applicable GPU/browser parity.

The [CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md)
contains the cache-local external-source research, exact retained identities,
first-party oracle claim boundaries, and promotion crosswalk mined from
reconciliation. It supplies provenance input to this contract without making
reconciliation or the dossier a runtime dependency.

## Decision Summary

`CelestialContributionCache` is the canonical family name.

The cache is an immutable, camera-independent, ray-queryable generation of
already atmosphere-transported direct visible celestial contributions over a
bounded geometry-owned domain. It carries two physically distinct measures:

- transported spectral radiance for extended sources; and
- transported spectral irradiance for point sources, together with the source
  placement needed for live projection.

The existing shader evaluates its normal atmosphere path first. It then queries
the cache with current geometry position, direction, pixel footprint, and
foreground depth, converts point irradiance into pixel radiance when needed,
adds the result to a separate `celestialRadiance` spectral term, and sends
`pathRadiance + celestialRadiance` through the existing Color path exactly
once.

The cache is not:

- a viewport image or final-pixel frame;
- canonical source, atmosphere, geometry, or spectral state;
- renderer scene RGB;
- atmosphere path radiance;
- an incident-radiance/L2 cache used to illuminate the atmosphere; or
- a display, exposure, glare, or observer-response result.

The runtime seam is intentionally small. Cache construction is not assumed to
be small: its coordinate reduction, interpolation, packing, build cost, memory,
and update cost must pass the qualification gates in this document before the
design can be implemented as a production resource.

## Three Required Decisions

Every supported cache family must answer three questions independently. A
family is not implementable until all three answers are explicit and proved.

| Question | Selected logical contract | Remaining family-specific decision |
| --- | --- | --- |
| How is the cache indexed? | An extended query identifies a source, receiver position, and incoming direction. A point query identifies a source and receiver position; its exact direction is derived from source placement. | Reduce those logical coordinates to a bounded physical index, interpolation neighborhood, and out-of-domain policy for each supported source/geometry family. |
| What is stored at one logical index? | One complete canonical 15-channel spectrum: transported spectral radiance for an extended entry or transported spectral irradiance for a point entry. Source placement, support, depth, opacity, and layout remain entry metadata rather than repeated sample values. | Select precision, packing, payload grouping, and whether an equivalent factorization reconstructs the logical spectrum from multiple cache-owned resources. |
| How is that value calculated? | Combine the canonical source measure with exact-source atmosphere transport and the selected build-time visibility, channel by channel, using production geometry/atmosphere/source owners and shared transport primitives. | Freeze numerical controls, visibility policy, sampling traversal, interpolation-error bound, provenance, and update cost for the family. |

`lambda` appears in the physical equations because each channel is calculated
separately, but wavelength is not part of the logical lookup API. One logical
lookup returns the complete spectral vector. GPU packing may require four RGBA
groups for 15 channels; that is a physical resource detail beneath the lookup.

The runtime-facing logical operations are therefore equivalent to:

```text
lookupExtended(sourceId, receiverPosition, incomingDirection)
    -> 15-channel transported spectral radiance

lookupPoint(sourceId, receiverPosition)
    -> 15-channel transported spectral irradiance
```

These are semantic operations, not frozen public method signatures. Geometry
owns conversion from the current model/camera receiver position and direction
to each family's physical index and interpolation weights.

## Requirements Ledger

| Id | Requirement |
| --- | --- |
| `CCC-R01` | Cache identity and payload contain no camera pose, camera orientation, projection, FOV, viewport, pixel ratio, or pixel coordinates. |
| `CCC-R02` | The cache is derived resource state and never becomes a second canonical owner of source, atmosphere, geometry, spectral, or Color facts. |
| `CCC-R03` | Extended radiance and point irradiance remain separate typed measures through build, storage, validation, and lookup. |
| `CCC-R04` | Cache queries return already atmosphere-transported contributions; the caller never applies atmosphere transmittance again. |
| `CCC-R05` | Point transport uses the exact source direction before any camera response spreads the contribution across pixels. Destination-ray transmittance never attenuates those response pixels. |
| `CCC-R06` | Current renderer scene depth and hit state remain live foreground-visibility inputs and do not invalidate the cache. |
| `CCC-R07` | Point response remains normalized, uses exact current pixel solid angle, preserves off-raster loss, and never renormalizes surviving edge pixels. |
| `CCC-R08` | Extended sources integrate the current pixel footprint, including partial support and directional variation. |
| `CCC-R09` | Visible contributions add spectrally; nearer opaque finite celestial support can suppress farther celestial support according to the selected depth/visibility policy. |
| `CCC-R10` | Runtime retains a separate zero-initialized `celestialRadiance` value and adds it to `pathRadiance` before the sole Color conversion. |
| `CCC-R11` | An optional disabled cache is exact additive zero. A configured but missing, stale, malformed, or incompatible cache fails during setup or awaited replacement. |
| `CCC-R12` | Each supported source/geometry family declares a bounded coordinate mapping, interpolation policy, error bound, and capability envelope. Unsupported families fail rather than using a generalized fallback. |
| `CCC-R13` | Durable boundaries use unit-bearing packets and the canonical spectral-density basis. Private validated hot paths may use canonical scalars. |
| `CCC-R14` | Production contains no runtime imports from reconciliation POC code, records, or `tmp` artifacts. |
| `CCC-R15` | Acceptance requires CPU-oracle parity, cache/resource tests, all-channel GPU parity, and a fresh applicable browser proof. |

## Selected First-Slice Scope

The first production slice is limited to the existing Algorithm32 geometry
families and the accepted reconciliation source measures:

- distant-source/spherical-geometry domain;
- local-source/flat-geometry domain;
- ideal point sources represented by spectral irradiance;
- uniform or source-profiled extended disks represented by directional
  spectral radiance; and
- direct visible source contribution only.

This scope is intended to cover a physical Sun disk, accepted point-star cases,
and a uniform extended Moon disk when their canonical source facts are supplied.
The exact first source roster and supported source/geometry pairing table must
be frozen during the qualification step; a source category is not supported
merely because it fits the logical equations.

The first slice does not include:

- arbitrary source plugins or unrestricted source/geometry combinations;
- live CALSPEC, LIME, Horizons, ephemeris, or other acquisition;
- Moon, star, or diffuse-field illumination of the atmosphere, terrain, or
  renderer scene;
- observer adaptation, detection, glare, bloom, or camera-response simulation;
- Earthshine, eclipses, planets, or diffuse celestial fields;
- a textured 3D Moon; or
- final display values in the cache.

## Physical Measures

Let:

- `s` identify one celestial source;
- `x` be the receiver/query position in the geometry-owned cache domain;
- `omega` be an incoming celestial direction at `x`;
- `lambda` identify a channel in the canonical spectral-density basis;
- `T_atmosphere` be exact atmosphere transmittance from `x` toward the source
  boundary along the specified source direction; and
- `V_build` be only the stable visibility selected for cache construction.

`x` is not an atmosphere ray-march sample and is not an unconverted Three
world position. Runtime first maps the current camera/model receiver position
through the configured geometry owner into the cache's declared coordinates.

### Extended sources

The logical extended-source field is:

```text
C_ext,s(x, omega, lambda)
  = V_build,s(x, omega)
    * T_atmosphere(x, omega, lambda)
    * L_source,s(x, omega, lambda)
```

`C_ext` is spectral radiance density and is zero outside the source's angular
support. A distant uniform Sun disk can make `L_source` independent of `x`;
the general logical contract does not assume that all finite extended sources
have that property.

At runtime, the pixel receives the accepted conservative integration of
`C_ext` over its current angular footprint. The cache never stores a
camera-specific preintegrated pixel.

### Point sources

The logical point-source field is:

```text
E_point,s(x, lambda)
  = V_build,s(x)
    * T_exactSource(x, s, lambda)
    * F_source,s(x, lambda)
```

`E_point` is spectral irradiance density. `F_source,s` is explicitly allowed to
depend on `x`; finite sources can have a distance law. An infinite source may
define an `x`-independent incident measure.

Each point entry also retains exactly one placement form:

- finite world position, from which runtime derives current direction and
  depth; or
- infinite world direction.

For pixel `i`, runtime converts the queried irradiance to radiance using the
accepted point response:

```text
L_point,s,i(lambda) = E_point,s(x, lambda) * p_s,i / Omega_i
```

`p_s,i` is the normalized response mass assigned to the current pixel and
`Omega_i` is that pixel's exact current solid angle. The conservation rule is:

```text
sum(p_on_raster) + p_off_raster = 1
```

No image-edge renormalization is permitted.

### Pixel spectral composition

The logical runtime result is:

```text
celestialRadiance
  = sum(integrated extended contributions)
    + sum(point irradiance * response / pixel solid angle)

Color input spectral radiance
  = pathRadiance + celestialRadiance
```

The existing captured-scene composition and Color-owned display conversion
remain in their current order. Cached celestial values do not pass through the
existing view-transmittance value a second time.

## Runtime-Available Query State

Production Algorithm32 reconstructs one model-space view ray per fullscreen
fragment after scene input capture. At the celestial contribution seam, the
runtime already has the following information:

| Runtime fact | Use in the contribution path | Persistent field index? |
| --- | --- | --- |
| `state.ray.originMeters` | Receiver position in geometry-owned model meters. It is common to every fragment in one frame. | Yes. This is the spatial query position. |
| `state.ray.direction` | Current normalized center-pixel view direction. Extended footprint directions are reconstructed separately from UV, projection, and viewport state. | Yes for an extended center query. Separately reconstructed footprint directions index their own samples. It is not the transport direction for a spread point-response pixel. |
| Configured finite source position or infinite source direction | Derives the exact point-source direction and depth and selects a source payload or layer. | Yes. Source identity selects the resource; exact direction participates in the reduced coordinate. |
| `state.uv`, viewport pixels, inverse projection, and inverse view | Reconstruct pixel-center/corner rays, pixel footprint, and exact pixel solid angle. They also support live source projection when paired with the selected projection packet. | No. These are transient raster inputs. |
| Scene depth, scene hit state, and resolved path bounds | Gate foreground visibility and identify the current rendered endpoint. Existing depth describes the destination pixel ray, not automatically the exact point-source direction. | No. Renderer scene state remains live. |
| `state.pathRadiance` and `state.transmittance` | Existing atmosphere result available before Color. | No. The cache result neither indexes nor mutates these values. |

The direct celestial receiver is `state.ray.originMeters`. It is not an
atmosphere march point, `state.bounds.endDistanceMeters`, or a renderer
surface endpoint. Querying the direct-visible contribution at march points
would instead model celestial illumination of the atmosphere and would
double-count the direct receiver contribution.

The logical `sourceId` becomes a stable dense source index, resource selection,
or array layer in a physical GPU representation. A shader never hashes a
source string or treats source ordering as mutable canonical state.

## Recommended Physical Index Candidates

The following reductions are the preferred starting points for qualification.
They are candidates, not accepted layouts. Each remains subject to measured
interpolation error, discontinuity behavior, build cost, memory, upload cost,
and frame cost.

### Distant source with spherical geometry

For receiver position `x`, bottom radius `R`, and queried sourceward direction
`omega`:

```text
h = length(x) - R
n = normalize(x)
mu = dot(n, omega)
```

The preferred physical coordinates are:

```text
extended: sourceSelector + (h, mu_query)
point:    sourceSelector + (h, mu_exactSource)
```

For a radially symmetric atmosphere, source-path transport depends on receiver
radius and the local-zenith direction cosine. Receiver longitude,
latitude, world azimuth, camera orientation, FOV, viewport, and pixel
coordinates are not field dimensions.

`sourceSelector` is a discrete, non-interpolated selection. Qualification may
map it to a separate resource, dense source index, or array layer without
changing the continuous `(h, mu)` coordinate contract.

For an extended source, `omega` is the current center or footprint-quadrature
direction and the lookup returns transported spectral radiance. Angular disk
support remains an analytic live test against the source center and angular
radius. A uniform profile needs no additional transport dimension. A radial
profile may use a small cache-owned profile coordinate or proved factorization
without changing the logical transported-radiance result.

For a point source, `omega` is the exact direction derived from source
placement and the lookup returns transported spectral irradiance. Every
destination pixel covered by the normalized response uses that same exact-
source query. Indexing point transport by each response pixel's ray would give
different atmosphere transport to neighboring response pixels and violate
flux conservation.

Planet/horizon intersection should be classified analytically before field
interpolation. Blocked and unblocked samples must not blend across the horizon.
A horizon-adapted or nonuniform `mu` sampling policy is a qualification
candidate because transport changes rapidly near tangent paths.

### Finite point source with flat geometry

For a fixed source subpoint `S_sub` and receiver `x`, the preferred point
coordinates are:

```text
z = x.z
rho = length(x.xy - S_sub.xy)

point: sourceSelector + (z, rho)
```

Under a horizontally homogeneous flat atmosphere, a fixed source height, and
axisymmetric build visibility, `z` and `rho` determine source distance, exact
source direction, inverse-square scaling, atmosphere transport, and stable
geometry visibility. The value is one complete transported spectral-
irradiance vector. Runtime still derives the three-dimensional source direction
and depth from the configured source position for projection and visibility.

The existing local incident-radiance cache's `z`/`rho` idea is useful evidence
for the coordinate mapping, but its nearest/clamped lookup, domain, payload,
and namespace are not the celestial contract. The contribution cache requires
bracketing interpolation, explicit validity, and zero plus a bounded runtime
diagnostic outside its declared domain.

### Extended source with flat geometry

For a genuinely extra-atmosphere disk above a plane-parallel atmosphere, the
preferred candidate is:

```text
z = x.z
mu = omega.z

extended: sourceSelector + (z, mu_query)
```

Transport to the physical top-atmosphere plane then depends on altitude and
ray elevation rather than horizontal receiver position or azimuth. Uniform
disks fit directly. A radial source profile adds a normalized disk-radius
factor only when its spectral/profile contract requires it.

This reduction is not automatically valid for the existing finite local Sun.
Finite endpoint distance, changing apparent support, source-surface structure,
or asymmetric build visibility can require `rho` and additional angular
coordinates. A center-path small-disk approximation may be measured, including
near-horizon and across-disk error, but it is not the default exact contract.

### Initial physical payload direction

A practical first probe uses two-dimensional continuous resources with source
selection and four RGBA spectral groups as discrete layers. One logical lookup
still returns all 15 channels. The exact `sampler2DArray`, `sampler3D`, multiple-
texture, precision, filtering, and packing choice remains a measured resource
decision.

Raw `(x, y, z, worldDirection)` dense fields, receiver cubemaps, and viewport
images are rejected as first-slice candidates. They discard the selected
geometry symmetries, explode dimensionality, or introduce camera-dependent
pixels.

### Flat observer-dome qualification blocker

The current flat production path can include a fixed `observerCenteredDome`,
and current source-path transport clips against that dome. Because its center
is tied to the configured observer rather than every live translated receiver,
including it in direct celestial transport breaks both compact `z`/`rho` and
`z`/`mu` reductions under camera translation.

The flat qualification probe must therefore select and prove one policy:

1. treat the artificial dome as a view-ray safety boundary and use the
   physical top-atmosphere plane for direct celestial transport;
2. define a receiver-relative direct-celestial dome policy; or
3. retain the fixed dome and add the required dome-relative spatial dimensions.

The first option is the preferred candidate because it leaves the existing
view-ray cap in place while avoiding a nonphysical boundary in the new direct
celestial path. It is not accepted until CPU-oracle and production-shaped
measurements prove the resulting contract.

## Optional Per-Frame Query Preparation Shader

A small camera-dependent preparation shader is an allowed transient query
stage, not a cache generation. A working internal name is
`CelestialQueryPreparationPass`; the public or internal class name is not
frozen.

Its production order would be:

```text
RenderPass -> SceneInputCapture
    -> optional source-sized celestial query preparation
    -> existing Algorithm32 ShaderRuntimePass
```

For a bounded point-source roster, the preparation stage may render a tiny
source-sized floating-point target. For each source it can:

1. derive the contribution-cache index from the current receiver position and
   exact source direction;
2. fetch the complete transported irradiance spectrum;
3. consume or create current projected source position/depth metadata;
4. resolve the selected exact-source foreground-visibility method using the
   captured scene inputs; and
5. write packed spectral groups plus the transient projection/visibility
   metadata needed by the main pass.

The main fragment shader then reads the prepared point packet, evaluates the
normalized response and exact pixel solid angle for its own pixel, and adds
`E_point * p_i / Omega_i` to `celestialRadiance`. A fragment only writes its own
pixel; the preparation pass does not scatter writes into response neighbors.

Extended-source direction and foreground coverage still vary across a pixel
footprint. Preparation may supply receiver interpolation coordinates, source
placement, and shared projection facts, but the main fragment shader retains
the final directional cache query, footprint integration, and matched live
visibility work.

All fragments share the same receiver origin. Even without a separate pass,
the runtime should calculate receiver-only coordinates and interpolation
weights once per frame where practical. A point-source cache query is also
constant across all response pixels in that frame. The implementation may
start with bounded redundant fragment lookups and add the preparation pass only
when measurement shows it is useful or exact-source visibility needs the seam.

Camera, projection, viewport, response, and foreground-scene changes rerun or
refresh this transient preparation state. They never rebuild the transported
field. WebGL2 fragment rendering to a small target is sufficient; the design
does not require a compute-shader API.

## Architecture Placement

```text
canonical source facts ───────┐
canonical atmosphere facts ──┼─> CelestialContributionCache builder
canonical geometry domain ───┤       + production transport primitives
canonical spectral basis ────┘
                                      |
                                      v
                           immutable cache generation
                           descriptor + derived payloads
                                      |
                                      v
ShaderBuilder: validate -> prepare GPU resources -> bind -> atomically replace
                                      |
                                      v
       optional transient point-source query preparation
                                      |
                                      v
ShaderRuntimePass: current rays + footprint + foreground depth
                                      |
                                      v
                    pathRadiance + celestialRadiance
                                      |
                                      v
                               existing Color
```

This is an additive resource path under the current `Algorithm32` facade and
`ShaderBuilder` lifecycle. It does not replace `SharedModel`, `Reference`,
`SpectralCalculator`, `Algorithm32Transport`, `SceneInputCapture`, existing
incident-radiance caches, `ShaderRuntimePass`, or Color.

The builder uses production owner contracts and shared transport primitives.
It must not reimplement Beer-Lambert transport independently and must not invoke
the reconciliation runtime. `Reference` remains the CPU/reference oracle;
cache construction may use the common `SpectralCalculator` and narrower owner
operations rather than wrapping every cache coordinate in a complete
`Reference.evaluate()` frame workflow.

## Ownership

| Owner | Responsibility |
| --- | --- |
| Canonical celestial source owners | Measure kind, source identity, spectrum, magnitude, finite position or infinite direction, angular support, radiance profile, opacity, and source provenance. |
| Atmosphere owner | Optical state and the transport primitives used during cache construction. It does not own celestial source magnitude or the cache lifecycle. |
| Geometry owner | Model frame, bounded cache domain, source-relative coordinate mapping, atmosphere boundaries, geometry-body visibility, and mapping between live positions and cache coordinates. |
| Spectral owner | Canonical channel basis, density interpretation, channel count, and compatibility fingerprint. |
| Cache builder | Validate narrow owner packets, traverse supported domains, evaluate exact-source transport, enforce build visibility policy, measure error, and produce one immutable cache generation. |
| `CelestialContributionCache` | Own the derived descriptor, generation identity, logical fields, packed payloads, query metadata, and cache-owned shader contribution. |
| `ShaderBuilder` | Coordinate awaited build or bind, validate descriptor/payload compatibility, create GPU resources, assemble contribution ordering, atomically replace generations, and dispose resources. |
| Optional per-frame query preparation | Query point fields at the current receiver, prepare projected source/visibility packets, and publish only transient source-sized GPU state. It does not own or rebuild transported fields. |
| `ShaderRuntimePass` and cache-owned GLSL | Map current rays to cache coordinates, query fields, evaluate current footprint/response and foreground depth, and populate `celestialRadiance`. |
| Runtime attachment | Supply camera matrices, camera/model position, viewport, pixel ratio, scene color, scene depth, and hit state. |
| Color | Convert `pathRadiance + celestialRadiance` into display output and compose the captured scene according to the existing contract. |
| App | Supply configured canonical owners, renderer/composer attachment, scene content, camera controls, and explicit awaited configuration changes. It does not pack cache textures or author cache GLSL. |

The visible Sun role must derive from the same canonical solar facts used by
the configured Sun illumination owner. It must not introduce a second solar
spectrum. Moon and star facts likewise need one canonical source owner before
cache construction; the cache retains fingerprints and derived values, not a
second mutable source configuration.

## Logical Cache Contract

The selected family names are:

```text
CelestialContributionCache
CelestialContributionCacheDescriptor
CelestialContributionCachePayload
buildCelestialContributionCache(...)
celestialContributionCache
```

The future class file follows the repository class convention and should be
named `CelestialContributionCache.js`. Exact directory placement is selected
during implementation after the production architecture review; it must not be
placed under an incident-radiance cache family.

The descriptor is an immutable compatibility and provenance packet. Its
logical sections are:

| Section | Required contents |
| --- | --- |
| Identity | Cache kind, schema version, builder version, generation id, and deterministic payload checksum. |
| Dependencies | Canonical source-set, atmosphere, geometry, spectral-basis, build-visibility, numerical-policy, and field-representation fingerprints. |
| Domain | Geometry frame, coordinate axes, bounded ranges, sampling locations, resolution, interpolation policy, boundary policy, and coordinate-mapping version. |
| Sources | Stable source ids, point/extended measure kinds, placement form, support/depth/opacity metadata, and field/payload references. |
| Spectral | Basis fingerprint, density interpretation, channel order, channel count, and packing groups. |
| Payload | Logical field kinds, typed-array ownership, physical resource dimensions, precision, format, filtering, addressing, and byte counts. |
| Runtime compatibility | Cache-query contract version, celestial-depth policy, and point/extended shader feature requirements. Point-response parameters are not transported-field dependencies. |
| Provenance | Production reference/evidence pointers and builder inputs sufficient to audit the generated values without making the descriptor a second canonical source. |

The cache may emit multiple payloads. `CelestialContributionCachePayload` is a
family name, not a promise that the whole logical field fits in one texture.
Payloads must be created directly as their final typed arrays where practical;
the builder must avoid redundant complete-payload copies.

The cache should follow the useful existing incident-cache artifact pattern:
it owns its descriptor, shader payload descriptors, and cache-specific shader
contribution, while `ShaderBuilder` owns generic GPU resource creation and
lifecycle. The celestial descriptor and resource namespace remain separate
from the existing incident-radiance `cache` descriptor and bindings.

## Field Representation And Qualification Gate

The logical contract does not select a dense tensor layout.

A generic extended field has three receiver-position dimensions, two direction
dimensions, spectral channels, and a source dimension. WebGL2 has no native
five-dimensional texture. A generic allocation of
`C_ext(x, omega, lambda)` is therefore not an acceptable implementation plan.

Each supported source/geometry family must document a symmetry, source-relative
coordinate mapping, separable factorization, sparse representation, or bounded
set of resources that makes its field practical. A cache-owned query may
reconstruct an already transported contribution from cache-owned factors, but
the logical query result remains `C_ext` or `E_point`; callers never combine it
with the base atmosphere transmittance.

Interpolation must be discontinuity-aware. It may not leak nonzero values
across source-support, horizon, occultation, domain, pole, or coordinate-seam
boundaries, and runtime may not apply angular support coverage a second time if
the selected representation already includes that integral factor.

Candidate reductions require proof rather than assumption:

- spherical symmetry may reduce receiver position and ray direction to
  altitude/radius and angular relations;
- the local flat source-relative frame may reduce receiver position to
  altitude and horizontal distance from a source subpoint; and
- uniform or low-parameter source profiles may be stored separately from a
  transported field when the reconstruction is mathematically equivalent.

Asymmetric baked occlusion, arbitrary source profiles, animated source state,
or unrestricted finite geometry can destroy those reductions. The first slice
must reject a family when its declared factorization does not fit the measured
capability envelope.

Before production implementation, a qualification probe must report for every
selected family:

1. logical and physical coordinate dimensions;
2. source count and supported profile kinds;
3. sample counts and interpolation policy;
4. maximum and representative interpolation error against the CPU oracle;
5. CPU build time and peak memory;
6. packed byte count, upload time, and GPU memory;
7. WebGL2 texture count, dimensions, formats, and capability limits;
8. shader lookup count and representative frame cost; and
9. update cost when a source or atmosphere dependency changes.

No viewport-sized 15-channel final-frame texture is an acceptable substitute.
If no selected family passes qualification, the implementation stops and the
architecture is revisited rather than silently becoming camera-dependent.

## Cache Construction

The cache is built asynchronously during awaited shader setup or awaited
configuration replacement, never inside a render frame.

The construction sequence is:

1. Capture immutable narrow descriptors from canonical source, atmosphere,
   geometry, spectral, build-visibility, and numerical-policy owners.
2. Validate units, measure kinds, spectral alignment, source placement,
   supported source/geometry pairing, and domain bounds.
3. Select the already-qualified coordinate mapping and field representation.
4. Traverse the declared receiver and direction domains.
5. Resolve stable geometry/body visibility according to the declared build
   visibility policy.
6. Evaluate atmosphere transport toward each extended direction or exact point
   source direction.
7. Form transported extended radiance or point irradiance without any display
   conversion or camera response.
8. Validate finite/nonnegative values, spectral shape, domain coverage,
   interpolation error, and applicable conservation invariants.
9. Pack the final typed payloads and construct their immutable descriptor,
   fingerprints, checksums, and provenance.
10. Return a complete generation for `ShaderBuilder` validation and atomic GPU
    resource installation.

Finite point-source incident measure must be evaluated at each receiver
position when its distance law requires it. Treating it as one constant
`F_source(lambda)` is valid only for a source contract that explicitly defines
that invariant.

The first slice treats source position, source direction, source spectrum, and
source profile as generation dependencies. Animated Sun or Moon state can
therefore be expensive: an app must perform an explicit awaited update when
that state changes. A later source-relative parameterization may reduce those
rebuilds only after separate dimensionality and parity proof.

## Runtime Query

### Common order

For each fragment, runtime performs this order:

```text
reconstruct current camera/model ray and read foreground scene depth
    -> evaluate existing Algorithm32 pathRadiance and transmittance
    -> initialize celestialRadiance to zero
    -> query/integrate CelestialContributionCache
    -> add surviving direct celestial contributions to celestialRadiance
    -> Color converts pathRadiance + celestialRadiance
    -> existing captured-scene composition/output
```

The contribution slot follows base atmosphere transport and precedes Color.
It does not modify the meanings of `pathRadiance` or `transmittance`.

### Extended-source query

Runtime:

1. maps the current camera/model origin and each selected pixel-footprint
   direction into the entry's declared field coordinates;
2. samples the cache-owned transported radiance representation;
3. evaluates partial angular support and directional profile through the
   declared conservative quadrature;
4. resolves the source boundary depth or infinity policy;
5. rejects a nearer foreground renderer hit;
6. applies celestial depth/opacity ordering for overlapping configured sources;
   and
7. adds the integrated spectral radiance directly.

Runtime does not multiply this result by `state.transmittance`.

One center-depth comparison is not automatically sufficient for a partially
covered disk whose footprint crosses foreground geometry. Each selected family
must qualify its live subpixel-depth policy, such as matched quadrature,
conservative masking, multisampling, or an explicitly bounded approximation.

### Point-source query

Runtime:

1. derives exact current source direction and depth from finite world position,
   or uses the entry's infinite world direction;
2. maps the current camera/model origin into the point field and queries
   transported irradiance;
3. rejects exact-source foreground and nearer opaque celestial occlusion;
4. projects the exact source through the current camera;
5. computes the accepted normalized pixel response and exact `Omega_i`;
6. accounts for off-raster response without redistributing it; and
7. adds `E_point * p_i / Omega_i` to affected pixels.

Exact-source foreground visibility gates the point contribution before response
spreading. Runtime must not test each destination response pixel as though its
center ray were the source ray. Current screen depth may be insufficient for an
exact subpixel source direction, so the first slice must select and prove a
projected-depth lookup, source-visibility prepass, analytic query, or explicitly
bounded approximation.

The accepted response may be implemented with analytically normalized shader
evaluation or with the optional source-sized preparation shader defined above.
That choice remains open and must match reconciliation conservation behavior.
Prepared point packets are transient query/projection data, not new cache
generations and not wrappers that call `Reference.evaluate()` for every frame
pixel.

Point-response kernel parameters, FOV, viewport, and pixel ratio are live
raster policy. They may update uniforms or require a shader-material refresh,
but they do not invalidate `E_point`.

The selected point-response contract must also freeze supported projection
kinds, pixel-center convention, clipping convention, and exact corner-ray
calculation for `Omega_i`. Multiple point sources require a measured fixed
source bound or transient acceleration; they do not authorize an unbounded
per-fragment loop.

## Visibility And Depth

Visibility is split by ownership:

- geometry/body visibility selected as part of the field representation is
  included in `V_build` and its fingerprint;
- foreground renderer scene depth and hit state are always live inputs;
- finite celestial entries provide current-query depth/support/opacity facts so
  a nearer opaque body can suppress a farther source; and
- the descriptor states whether any additional celestial mutual visibility is
  built into the field or resolved by the runtime depth policy.

The first implementation must select one deterministic policy per supported
family. It may not bake an asymmetric occluder while claiming a symmetry that
ignores that occluder's state. Changing any visibility state included in
`V_build` invalidates the transported field; changing ordinary renderer scene
geometry or depth does not.

Overlapping transparent or non-occluding contributions add spectrally. Opaque
support suppresses only contributions behind it; it does not erase atmosphere
path radiance accumulated in front of the body.

## Camera Independence

Camera translation, rotation, FOV, projection, viewport size, and pixel ratio
change live query and raster state only. They can change:

- geometry-domain query position;
- current ray and footprint directions;
- finite-source direction and depth;
- point-source projected center and response weights;
- pixel solid angle;
- off-raster response mass; and
- foreground depth comparisons.

They do not mutate or replace a cache generation while the query origin remains
inside its declared spatial domain.

An enabled per-frame preparation pass reruns or refreshes its tiny transient
output after these changes. That work is a cache query and raster-state update,
not cache construction.

Initial setup rejects a camera origin outside the configured domain. If a live
camera later leaves the domain, runtime must not clamp or extrapolate silently
and must not build inside the frame. It logs a bounded runtime failure and uses
zero celestial contribution for the invalid query until an explicit awaited
domain replacement succeeds. Existing atmosphere and scene rendering continue.

## Lifecycle And Invalidation

One cache generation is immutable. `ShaderBuilder` prepares a successor
generation and its GPU resources completely before atomically installing it.
An awaited update failure leaves the previously committed configuration and
generation active; a stale generation is never sampled under newly committed
canonical facts.

| Change | Transported field | GPU resource/material action |
| --- | --- | --- |
| Source list, measure, spectrum, magnitude, finite position, infinite direction, angular support, or radiance profile | Rebuild affected generation or qualified subresource. | Replace affected payloads and bindings atomically. |
| Atmosphere optical state, profile, or boundary | Rebuild. | Replace affected payloads. |
| Geometry family, frame, domain, coordinate mapping, discretization, or build visibility | Rebuild. | Replace payloads and coordinate bindings. |
| Spectral basis or channel order | Rebuild. | Replace payloads and shader compatibility state. |
| Builder algorithm, numerical policy, interpolation, or field representation | Rebuild. | Replace generation and applicable material state. |
| Packing, precision, or physical texture layout only | Repack from retained validated logical data when supported; otherwise rebuild. | Replace GPU resources. |
| Camera pose/orientation or query ray | No rebuild. | Update live bindings and refresh transient preparation when enabled. |
| Projection, FOV, viewport, resize, or pixel ratio | No rebuild. | Update live bindings and point-response/footprint or transient preparation state. |
| Foreground renderer scene color, depth, hit state, or ordinary scene geometry | No rebuild. | Use current scene inputs and refresh prepared visibility when enabled. |
| Point-response kernel parameters | No transported-field rebuild. | Update runtime policy, uniforms, or material as required. |
| Color, exposure, tone mapping, or display output | No rebuild. | Color-owned update only. |
| WebGL context restoration | No physics rebuild when the immutable CPU payload remains valid. | Recreate and rebind GPU resources. |

The descriptor and key include only facts that affect the transported field or
its representation. Runtime point-response parameters may have a compatibility
version, but they are not physical-field dependencies.

## Shader And Facade Integration

The main facade method set remains unchanged. The cache uses existing awaited
`setupShader(...)`, awaited handle configuration replacement, frame binding,
and disposal lifecycle.

No caller-facing cache API is frozen yet. The eventual configuration must be
additive and must not make the app construct texture layouts or shader source.
The exact provider/policy field is selected only after the qualification probe
establishes the supported resource families.

Internally, `ShaderBuilder` gains a separate celestial build/resource slot. It
must not overload the existing incident-radiance `cacheBuild`, descriptor
section, payload kinds, value keys, or compatibility tags. Cache-owned
descriptor and binding keys use a distinct `celestialContribution.*`
namespace. Cache-owned shader contribution ordering is:

```text
runtime initial state
    -> geometry/source/atmosphere contributions
    -> Algorithm32 base transport
    -> CelestialContributionCache contribution
    -> Color contribution
```

The cache object may follow the existing generated-cache pattern by exposing
an immutable descriptor, one or more shader payloads, and one cache-owned
shader contribution. Exact method names beyond the selected family names are
implementation decisions.

## Failure Policy

Configuration, setup, and awaited replacement fail loudly for:

- invalid or implicit units at durable boundaries;
- point/extended measure confusion;
- spectral-basis or channel-order mismatch;
- unsupported source/geometry combinations;
- unqualified field representations;
- malformed or uncovered domains;
- non-finite, negative where prohibited, incomplete, or incorrectly sized
  payloads;
- stale dependency fingerprints or checksums;
- unsupported texture dimensions, counts, formats, precision, or filtering;
- configured but missing cache artifacts; and
- shader contribution or binding incompatibility.

An intentionally absent or disabled optional cache is exact additive zero and
preserves current output. This is not a fallback for a configured cache that
failed to build.

After successful setup, live failures follow the existing runtime policy:
log and continue safely. Out-of-domain or invalid queries contribute zero for
the affected celestial term; they never sample a stale or clamped value.

The implementation must not fall back to authored RGB stars, captured meshes,
legacy aliases, destination-ray transmittance, or an incident-radiance cache.

## Verification And Acceptance

### Contract and builder tests

- Descriptor schema, unit packets, measure separation, fingerprints, hashes,
  and deterministic generation.
- Coordinate-domain bounds, mapping, sampling locations, interpolation, and
  explicit out-of-domain behavior.
- Point finite-distance law and infinite-direction cases.
- Extended support/profile sampling and zero outside support.
- Stable visibility policy and invalidation.
- All 15 channels, channel order, packing groups, typed-array ownership, and
  payload length.
- No redundant full-payload copies in the measured build path.

### Resource and lifecycle tests

- Capability preflight before resource creation.
- Descriptor/payload compatibility and stale-generation rejection.
- Atomic replacement and disposal.
- Failed awaited replacement retains the previous committed state.
- Context restoration reuploads a still-valid immutable payload.
- Optional disabled cache is exact zero; configured missing cache fails.

### Runtime behavior tests

- Contribution slot follows base transport and precedes Color.
- Cached values are added exactly once with no transmittance multiplication.
- Extended partial-pixel integration, limb/profile variation, and foreground
  depth.
- Point exact-direction transport, normalized response, exact pixel solid
  angle, subpixel movement, off-raster loss, and frame-edge conservation.
- Camera translation, rotation, FOV, resize, and pixel-ratio changes leave the
  cache identity unchanged while producing the correct live query result.
- Point-response policy changes do not rebuild transported fields.
- Source, atmosphere, geometry/domain, build visibility, basis, and builder
  changes invalidate the correct generation.
- Additive overlap and nearer opaque celestial occlusion.
- Sun-disk, point-star, uniform-Moon, and accepted mixed-source scenes.
- Current Algorithm32 output is unchanged when the optional cache is disabled.

### Parity and qualification

- CPU cache queries match the accepted reconciliation point and extended
  oracles within predeclared field/interpolation tolerances.
- GPU cache queries match the CPU cache query before display conversion.
- Selected-pixel display output matches `Reference` plus Color under the
  accepted production readback tolerance.
- Memory, build time, upload time, resource count, and shader frame cost are
  reported for each supported family.
- The complete production test lane, build, selected app-integration lane, and
  applicable visible-celestial GPU/browser proof pass.

Records `034`, `040`, `050`, `056`, and `065` supply relevant conservation,
physical transport, real-scene, and convergence oracles after durable
production fixture/evidence promotion. XA-G12 is applicable to the new shader
path. A fresh numbered record must accept the implementation; record `067` is
never amended or reused.

The dossier additionally identifies the applicable third-party radiometry,
source-data, placement, WebGL2, and version-pinned Three references and the
claims they do not support. Cache coordinate reduction, interpolation,
precision, packing, and preparation-pass performance remain qualification
results rather than externally sourced facts.

## Textured 3D Moon Follow-Up

A textured 3D Moon is an explicit successor after the uniform extended-source
path is proved. It remains within the direct celestial contribution boundary,
but it adds a finite spherical surface query:

```text
current ray
    -> ray/sphere intersection
    -> surface coordinates + normal + depth
    -> calibrated spectral surface contribution
    -> atmosphere-transported cache query
    -> opacity/occlusion ordering
```

A physical implementation requires calibrated spectral lunar radiometry or
spectral reflectance plus a canonical illuminating source and accepted BRDF.
An authored RGB texture is presentation input, not physical spectral data.

Camera movement changes sphere intersection and cache queries without itself
invalidating the field. Moon position, geometry, orientation, illumination,
surface radiometry, or any visibility included in the field invalidates the
affected generation. Earthshine, eclipses, and unresolved lunar acquisition
remain separate follow-ups.

## Open Decisions

The following decisions are intentionally not hidden by the cache name:

1. Exact first source roster and source/geometry pairing matrix.
2. Qualified coordinate reduction for distant/spherical fields.
3. Qualified coordinate reduction for local/flat fields.
4. Dense, separable, sparse, per-source, or aggregated physical resources for
   each field family.
5. Cache resolution, adaptive sampling, interpolation, and accepted error
   budgets.
6. CPU, worker, compute-like GPU, or mixed construction path.
7. GPU texture kinds, counts, formats, filtering, precision, and maximum source
   capacity.
8. Exact point-response, projection, pixel-center, solid-angle, source-bound,
   exact-source visibility, direct-query versus optional source-sized
   preparation-pass implementation, transient payload, and pass ordering.
9. Exact celestial mutual-depth/visibility and extended subpixel foreground
   policy per selected family.
10. Whole-generation versus qualified per-source subresource replacement.
11. Runtime configuration/provider packet and internal module placement.
12. Flat direct-celestial treatment of the fixed observer-centered dome.
13. Performance budgets that determine whether the design is viable.

These decisions must be resolved by bounded prototypes and production-shaped
measurements. They do not authorize a viewport-dependent cache, a second
atmosphere application, or a generalized plugin layer.

## Related Authority

- [Algorithm32 Status](status.md) owns current implementation status and the
  immediate next action.
- [Algorithm32 Production Design](production-design.md) owns the surrounding
  production architecture.
- [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
  owns the remaining promotion gaps.
- [CelestialContributionCache Implementation Plan](celestial-contribution-cache-plan.md)
  owns cache-specific qualification, implementation, proof order, expected
  artifacts, gates, and checked progress.
- [CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md)
  owns the cache-local source inventory, exact retained identities, claim
  boundaries, and reference/evidence promotion crosswalk.
- [Algorithm32 Implementation Plan](implementation-plan.md) owns the broader
  production milestone sequence and delegates its cache milestone to the
  companion plan.
- [Reconciliation Conclusions](../reconciliation/conclusions.md) and accepted
  numbered records own the CPU behavior/evidence input.
