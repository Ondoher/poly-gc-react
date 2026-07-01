# Algorithm32 Abstraction Design

Status: reconciliation design target. This document records the abstraction
shape that reconciliation should test and promote before production
implementation freezes public packet names.

## Table Of Contents

- [Purpose](#purpose)
- [Boundary Summary](#boundary-summary)
- [Current Design Commitments](#current-design-commitments)
- [Configuration Facts](#configuration-facts)
- [Abstraction Reference](#abstraction-reference)
  - [Light Source](#light-source)
  - [Geometry](#geometry)
  - [Atmosphere](#atmosphere)
  - [Incident Radiance Cache / Sampler](#incident-radiance-cache--sampler)
  - [General Calculator](#general-calculator)
  - [Shared CPU/Shader Build Logic](#shared-cpushader-build-logic)
  - [Calculation Helper Methods](#calculation-helper-methods)
  - [Color](#color)
- [Ray And Path Points](#ray-and-path-points)
- [Coordinate Systems And Transforms](#coordinate-systems-and-transforms)
- [Transport Responsibilities](#transport-responsibilities)
- [Algorithm](#algorithm)
  - [evaluate(request)](#evaluaterequest)
- [How It Fits Together](#how-it-fits-together)
  - [Configuration](#configuration)
  - [Cache Building](#cache-building)
  - [Cache Binding And Runtime Lookup](#cache-binding-and-runtime-lookup)
  - [Shader Cache Texture Building](#shader-cache-texture-building)
  - [Incident-Radiance Cache Interface Variants](#incident-radiance-cache-interface-variants)
  - [Evaluate Sample Loop](#evaluate-sample-loop)
- [Source-Relative Coordinates](#source-relative-coordinates)
  - [Source-Relative Indexing](#source-relative-indexing)
- [Bidirectional Mapping](#bidirectional-mapping)
- [Distant Sun As A Simplified Finite Source](#distant-sun-as-a-simplified-finite-source)
- [IncidentRadianceCache](#incidentradiancecache)
- [Validation Enabled By This Design](#validation-enabled-by-this-design)
- [Reconciliation Deliverables](#reconciliation-deliverables)
- [Open Naming Questions](#open-naming-questions)

## Purpose

One goal of reconciliation is to flesh out the Algorithm32 abstractions so
they match the production boundaries while keeping the core transport
algorithm intact.

The core algorithm remains:

```text
resolve one view ray
sample points along the resolved path
gather geometry, atmosphere, and light facts at each point
integrate spectral in-scattering and transmittance
return spectral radiance/transmittance
```

Reconciliation should change how facts cross subsystem boundaries, not quietly
change the accepted Algorithm32 transport equations, constants, or numerical
controls. Any algorithmic deviation from the accepted baseline still requires
source support or explicit accepted-experiment support.

## Boundary Summary

Use this working split:

```text
Geometry supplies spatial relation facts.
Atmosphere supplies medium facts.
Light source supplies lighting facts.
Incident radiance cache/sampler supplies optional generated incoming-radiance facts.
Transport combines them.
Color/display converts the spectral result outside CPU transport.
```

The important correction from the POC lineage is that a light source should
not be asked to interpret raw geometry coordinates. A finite local source in
the POC often computed source-to-point relations inside the source object.
That mixes geometry placement with lighting. Reconciliation should make the
spatial relation an explicit geometry-owned handoff packet.

## Current Design Commitments

These points are the current handoff for a new agent. Exact type and method
names remain provisional unless called out as accepted elsewhere, but these
ownership rules should not be reopened without a new design decision:

- Keep the accepted Algorithm32 transport algorithm intact. Reconciliation
  changes packet boundaries, provenance, and validation, not the baseline
  equations or constants.
- Use five abstraction interfaces: light/source, geometry, atmosphere,
  incident radiance cache/sampler, and color/display. Transport is the
  coordinator/integrator, not a sixth model domain.
- Color/display is outside CPU transport. The CPU reference returns spectral
  radiance/transmittance; display conversion is needed later for GPU output.
- Geometry owns all spatial interpretation. It converts authored placement and
  model-space positions into `AtmosphereCoordinate`, `AtmospherePath`,
  `SourceRelativePosition`, clipping/path facts, and source-relative/cache
  coordinates.
- `SourceRelativePosition` is the light-source-facing spatial relation:
  direction from source plus `distanceFromSourceMeters` when a finite
  placement exists. Frame descriptors, orientation, cache coordinates, and
  diagnostics are adjacent contracts, not hidden fields the light source
  derives from raw geometry coordinates.
- Atmosphere initially consumes altitude-only `AtmosphereCoordinate` values
  for vertical stratification. Geographic, ocean/land, seasonal, weather, or
  regional aerosol dimensions are later profile-selector extensions.
- Incident radiance cache/sampler answers one runtime question: what spectral
  radiance arrives at this path integration point from an incoming direction or collapsed
  direction set? Runtime access is a callback, not a separate support
  interface.
  Cache construction is a coordinated setup/build workflow across light
  source, geometry, atmosphere, and the general calculator.
- Source-shaped caches are created by the light source, such as
  `lightSource.createIncidentRadianceCache(...) -> LocalSunIncidentRadianceCache`, but the
  returned cache must not build values from light-source private knowledge
  alone. The concrete cache owns its logical cache coordinates and generator;
  a setup/build coordinator owns lifecycle and progress; geometry maps between
  model-space samples and source/atmosphere-relative cache coordinates; the
  general calculator computes the values.
- Runtime `evaluate(...)` receives an operation-ready incident radiance
  sampler callback plus validated cache-access metadata.
  It must not select cache artifacts, know cache family/shape, or construct
  raw cache/source-local lookup coordinates. It may ask geometry for the
  cache-access packet required by the bound sampler.

## Configuration Facts

Observer placement and light placement are both configuration inputs to the
model. They are not transport-owned facts.

Configuration includes:

- observer/view placement, such as latitude, longitude, local time, altitude,
  camera pose, or already resolved model-space origin and direction;
- light placement, such as distant directional Sun placement, finite local Sun
  placement, false-Sun orbit/profile placement, or future finite
  astronomical placement;
- light radiometry, such as spectrum, source power, angular extent policy,
  calibration state, and falloff policy;
- atmosphere composition;
- geometry profile and frame;
- spectral basis;
- execution/numerical controls;
- incident-radiance cache/sampler policy, such as null, distant, or local;
- shader/cache/display policy.

Geometry resolves observer and light placement configuration into its own
model-space frame. Light source consumes the resolved relation and supplies
radiometric facts. An incident-radiance sampler callback is selected and bound
during setup when higher-order incident radiance is enabled. Transport
consumes only the resolved packets needed for one evaluation.

## Abstraction Reference

These sections are the stable reference target for the five production
interface boundaries plus the algorithm-owned callback ports/classes needed to
coordinate them. Flow-specific sections later in this document can focus on one
handoff, such as `SourceRelativePosition` or cache construction, without
redefining these ownership rules.

### Light Source

The light source supplies lighting facts. Given a resolved
`SourceRelativePosition` and a spectral basis, it answers what light is
available from that emitter.

Light source owns:

- light identity and descriptor fields needed for compatibility and cache
  keys;
- source spectrum or spectral radiance/irradiance model;
- source power or calibration-derived scale;
- angular extent / emitting-area policy;
- interpretation of `SourceRelativePosition` as finite distance,
  directional-infinite distance, or another source distance model;
- finite-distance falloff policy when configured;
- distant/directional simplification policy when configured;
- source-side incident-radiance cache family and shape for the source class,
  including whether the source uses a distant, local/finite, or other cache
  domain;
- factory behavior for concrete source-shaped cache implementations, such as
  returning a local-Sun cache object whose descriptor, coordinate generator,
  keying, and lookup policy match the light-source cache family;
- available-light facts used to build higher-order incident-radiance caches.

Light source does not own:

- flat or spherical coordinate interpretation;
- observer placement;
- map projection, ephemeris, orbit, or local-time-to-position logic unless
  those are explicitly part of a concrete upstream placement resolver;
- atmosphere coefficients, density, extinction, absorption, or phase
  functions;
- raw path clipping through atmosphere or ground, except for source-owned
  path-limit semantics such as finite source distance or directional-infinite
  behavior;
- geometry's mapping from model-space positions/directions into the
  source-declared cache domain;
- complete incident-radiance field value ownership; even when the light source
  creates the concrete cache object, generated values are a joint result of
  available source light, atmosphere medium facts, geometry mapping, and
  transport integration;
- display RGB conversion.

The public-facing shape should move toward:

```text
LightSource.sampleLighting({
  lightCoordinates,
  spectralBasis,
  calibrationState
}) -> LightingFacts
```

Exact names remain open, but the ownership rule is not: the light source
receives resolved spatial relation facts rather than peer geometry objects or
uninterpreted raw coordinates.

### Geometry

Geometry owns spatial meaning. It must be able to answer the spatial
questions needed by transport, light-source radiometry, cache building, and
diagnostics without exposing raw internal assumptions to peer models.

Geometry owns:

- model-space frame and coordinate conventions;
- observer/view placement resolution into model-space ray origin and
  direction;
- light placement resolution into the same geometry-owned frame;
- finite view-ray distance resolution;
- `AtmosphereCoordinate` resolution from model-space positions, initially
  altitude-only vertical stratification;
- `AtmospherePath` resolution from geometry-owned paths into atmosphere
  coordinates plus segment measures for optical-depth integration;
- local frame facts;
- atmosphere-boundary, surface, top, ground, and clipping rules;
- source-path boundary/clipping resolution once a light source supplies
  direction and any source-owned path limit;
- observer-to-source diagnostic relation;
- path-point `SourceRelativePosition` relation;
- mapping between model-space positions/directions and cache access
  coordinates where a cache uses source-relative or atmosphere-relative
  domains;
- build-context mapping from cache-owned logical coordinates back to exact or
  representative model-space positions, directions, paths, and
  `AtmosphereCoordinate` values for cache generation.

Geometry may know a light's placement in its own coordinate system. For flat
geometry that may be a finite `[x, y, z]` position. For spherical geometry it
may be a finite planet-centered position, a resolved astronomical position, or
a directional approximation. The light source does not interpret those raw
coordinates.

The required atmosphere-coordinate capability is provisionally:

```ts
geometry.resolveAtmosphereCoordinate({ position }) -> AtmosphereCoordinate
```

For the first production profile, this maps a model-space position to
`altitudeMeters`. Flat geometry may use `position.z`; spherical geometry may
use `length(position) - bottomRadiusMeters`. The atmosphere model consumes the
resolved coordinate and does not derive altitude from model-space coordinates.

### Atmosphere

Atmosphere supplies medium facts. It owns:

- density/profile sampling;
- wavelength-aligned Rayleigh, aerosol/Mie, and absorption coefficients;
- extinction/scattering/absorption samples;
- optical-depth integration over geometry-resolved `AtmospherePath` samples;
- atmosphere-side medium facts used to build higher-order incident-radiance
  fields from available source light;
- phase-function parameters and phase evaluation if phase remains
  atmosphere-owned in the final interface;
- atmosphere-profile provenance.

The atmosphere does not decide where the light is, where the observer is, how
to clip paths, or how to convert raw model-space positions into altitude. It
receives geometry-resolved `AtmosphereCoordinate` samples, or an
`AtmospherePath` made from those coordinates plus segment measures, and returns
medium facts or optical depth.

For the first production profile, atmosphere should be treated as a vertically
stratified medium. Its core coordinate is altitude:

```ts
type AtmosphereCoordinate = {
  altitudeMeters: number;
}
```

Geometry maps its active model-space position into that coordinate. Flat
geometry may resolve altitude from `position.z`; spherical geometry may
resolve altitude from radius minus bottom radius. Atmosphere then samples the
same stratified profile from the resulting altitude, without knowing which
geometry produced it.

Optical-depth queries use the path form of that same coordinate boundary:

```ts
type AtmospherePathSample = {
  atmosphereCoordinate: AtmosphereCoordinate;
  segmentLengthMeters: number;
}

type AtmospherePath = {
  samples: AtmospherePathSample[];
}
```

Geometry builds this path from its model-space path, clipping, and sampling
rules. Atmosphere integrates extinction over the supplied atmosphere
coordinates and segment lengths; it does not inspect model-space positions.

Earth/geographic selectors such as latitude, longitude, ocean/land class,
season, weather cell, or regional aerosol family are valid later refinements.
They should extend the coordinate as profile selectors, not replace altitude
as the vertical sampling axis:

```ts
type FutureAtmosphereCoordinate = {
  altitudeMeters: number;
  profileSelector?: AtmosphereProfileSelector;
}
```

Reconciliation should not require those extra dimensions for the initial
CPU/reference implementation or the first GPU shader. Add them only when a
named atmosphere profile needs horizontal or temporal variation.

This remains a reconciliation-lane contract until the interface is accepted.
Do not update the production scaffold just to reserve this method name; promote
the API only after the experimental lane has validated the data flow.

### Incident Radiance Cache / Sampler

Incident radiance cache/sampler supplies optional higher-order incoming
radiance facts. It answers one transport-facing question: at this
atmosphere-relative and source-relative sample location, how much spectral
radiance is arriving from this incoming direction or collapsed direction set?

It is a fifth interface boundary because the cache shape is source-dependent,
the values are atmosphere/transport-derived, and runtime lookup needs
geometry-owned coordinate mapping. Treat it as a generated-field interface,
not as a private storage detail of light source, atmosphere, geometry, or
transport.

Cache construction is not owned by the cache alone. It is a
setup-time coordination between light source, geometry, atmosphere, and the
general calculator. The cache owns the generated-field contract: descriptor,
generated values, compatibility validation, sampler creation, optional
shader-payload description, and returned incident-radiance packet shape.

Incident radiance cache/sampler owns:

- the common sampling callback:
  `incidentRadianceSampler(cacheAccess) -> IncidentRadianceSamples`;
- configuration-time states: no incident sampling, `distant`, and `local`;
- cache family/shape descriptors selected from the source-declared cache
  domain;
- cache-owned logical coordinate descriptors, coordinate generators, and keying
  rules for the configured cache domain;
- generated-value descriptors, binding contracts, compatibility fingerprints,
  value units, interpolation/quantization policy, and optional persistence or
  packing policy;
- logical payload iteration/readback needed by shader texture builders and
  diagnostics;
- direction-set descriptors, quadrature weights, output direction frame, and
  incoming-direction enumeration when using directional incident sampling;
- cache lookup from a geometry-resolved cache-access packet using the
  setup-bound source/cache descriptors;
- null/no-op sampler semantics when incident sampling is disabled.

Incident radiance cache/sampler consumes:

- available source light and a source-created concrete cache implementation,
  such as a local-Sun or distant-source cache;
- geometry-resolved cache-access packets containing only lookup facts that the
  active cache can reconstruct from runtime path integration points;
- setup-bound geometry-owned mapping between model-space path facts and the
  selected source/atmosphere-relative cache domain;
- coordinated build outputs generated from the active light-source,
  geometry, atmosphere, spectral-basis, and transport/execution descriptors.

Incident radiance cache/sampler returns:

- `IncidentRadianceSamples`, containing spectral radiance arriving at the
  current path integration point from the requested incoming direction or collapsed
  direction set, plus any direction/weight data needed by transport. Returned
  directions must be expressed in the same geometry-resolved direction frame as
  the evaluated **viewDirection**, so transport and atmosphere can use them for
  phase-angle calculations without interpreting flat or spherical coordinates.

Incident radiance cache/sampler does not own:

- source radiometry, source placement, angular extent, falloff, or direct
  lighting facts;
- raw flat/spherical coordinate interpretation or path clipping;
- the primary first-order transport routine used to generate cache values;
- hidden direction-frame assumptions such as flat z-up, spherical radial-up, or
  source-local axes unless those assumptions are declared by the bound
  direction-frame descriptor and resolved before returning to transport;
- atmosphere coefficients, density profiles, optical-depth equations, or
  phase functions;
- cache-build orchestration; the setup/build coordinator calls light source,
  geometry, atmosphere, and the general calculator to produce the generated
  field;
- the transport equations that build the cache or consume the returned
  incident radiance. Cache generation should call the general calculator with
  the null incident sampler, rather than duplicating first-order radiance code
  inside a concrete cache;
- color/display conversion.

The cache/sampler boundary is coordinated by build provenance but singular by
runtime question. Its generated values must be bound during setup before
`evaluate(...)` can sample them. Binding produces a plain
`IncidentRadianceSampler` callback and the cache-access metadata geometry
needs for lookup. A failed binding is an error or disabled capability; the
`null` variant is the explicit configuration that installs a no-op sampler and
contributes zero incident in-scattering. The caller does not supply
cache-family, cache-shape, source-kind, or raw cache-coordinate fields. A
separate artifact may exist for persistence, diagnostics, or shader packing,
but it is not required for the runtime operation when the cache instance owns
the generated values.

### General Calculator

The general calculator, provisionally `SpectralCalculator`, is
an algorithm-owned reusable calculation object, not an independent physical
domain interface. It subsumes the earlier standalone radiance-port idea: cache
building, primary CPU evaluation, validation tools, and shader descriptor
formation all talk to the same calculator vocabulary instead of a separate
port.

The reusable unit is the radiance loop itself, not an opaque helper hidden
under the algorithm. `computeRadiance(...)` should be written as the readable
Algorithm32 flow over an already-built path-integration-point schedule: loop
over integration points, query geometry, atmosphere, light source, and optional
incident sampling, then update transport state. The primary evaluator and the
cache builder both call that same method with different path inputs,
path-integration-point schedules, and incident-sampling policy.

`SpectralCalculator` should be constructed with the stable calculation
configuration: geometry, atmosphere, light source, spectral basis, and default
execution controls. Those are not low-level `computeRadiance(...)` parameters.
They are the calculator's operating context for all radiance calculations made
against the same accepted configuration snapshot.

The calculator exists so cache building and validation tools can calculate a
spectral radiance value without copying first-order transport equations into
concrete cache classes. It should not grow separate lifecycle, state, or
domain ownership from the CPU reference.

At the broadest level, the split is:

```text
viewRaySegment = geometry.resolveViewRaySegment(...)
pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
  viewRaySegment,
  pathIntervalCount)
pathRadiance = calculator.computeRadiance(
  viewRaySegment,
  pathIntegrationPoints,
  incidentRadianceSampling)
```

`geometry.resolveViewRaySegment(...)` owns the spatial side of the view ray:
finite view-path bounds and model-space origin/direction. It does not sample
atmosphere, ask the light source for radiance, compute transport, or precompute
every point-to-source atmosphere path. Source paths and cache-access packets are
resolved lazily from the current path integration point and light-source facts
during the radiance loop.

`calculator.buildEndpointTrapezoidPathIntegrationPoints(...)` is a pure value helper. It
turns the geometry-resolved view `RaySegment` into the endpoint/trapezoid
`PathIntegrationPoint[]` value schedule selected by canonical Algorithm32. It does not
query geometry, atmosphere, light source, or cache state.

`calculator.computeRadiance(...)` owns the spectral transport calculation over
that schedule: it walks `PathIntegrationPoint[]`, asks its configured
geometry/atmosphere/light-source interfaces for their owned facts, optionally
calls the supplied incident-radiance sampler, and accumulates spectral
radiance/transmittance.

The cache-builder operation is a constrained use of that same calculator path:

```text
Primary evaluation:
  viewRaySegment = geometry.resolveViewRaySegment(evaluationRay)
  pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
    viewRaySegment,
    pathIntervalCount)
  pathRadiance = calculator.computeRadiance(
    viewRaySegment,
    pathIntegrationPoints,
    incidentRadianceSampling)

Cache generation:
  viewRaySegment = geometry.resolveViewRaySegment(representativeIncidentRay)
  pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
    viewRaySegment,
    pathIntervalCount)
  pathRadiance = calculator.computeRadiance(viewRaySegment, pathIntegrationPoints)

Shared transport calculation:
  calculator.computeRadiance(
    viewRaySegment,
    pathIntegrationPoints[, incidentRadianceSampling])
    -> PathRadiance
```

Cache generation omits incident-radiance sampling so the calculation does not
recurse into the cache it is building. The readable Algorithm32 transport story
belongs in this calculator method rather than in concrete geometry,
light-source, atmosphere, or cache classes. The calculator may create
path-integration-point value packets, but it does not own source placement,
source-relative coordinates, atmosphere coordinates, cache indexing, generated
cache storage, shader texture upload, or display conversion.

The formerly explicit calculation arguments split this way:

- `IncidentRadianceSampling` is optional per-operation higher-order
  incoming-radiance access. When present, it pairs the cache-access metadata
  geometry needs with the plain callback that samples incident radiance. When
  omitted, the loop skips cache-access resolution and uses an empty incident
  sample set. This replaces both null support objects and mandatory no-op
  callbacks.
- `IncidentRadianceSampler` is the callback inside that optional value. It is
  the operation-ready function over the optional incident-radiance cache/field,
  not the cache builder and not a sixth physical model. Its only runtime job is
  to answer `incidentRadianceSampler(cacheAccess)`. Fixture or validation
  callbacks may return controlled samples without a generated cache. Preparing
  or building the field can be a setup step, but consuming its contribution is
  part of the per-sample radiance integral, not a final post step after path
  radiance is already accumulated.
- `SpectralBasis` is stable calculator configuration. It defines the ordered
  wavelength/channel basis and therefore the shape of every spectral value
  returned by the calculator.
- `Algorithm32ExecutionControls` are stable calculator configuration for the
  selected numerical policy: fixed endpoint/trapezoid path interval counts,
  source-path optical-depth interval counts, direction-set choices,
  tolerances, and related controls. If a
  validation or cache-build run needs different controls, create/configure a
  calculator for that run rather than passing a broad controls object through
  every helper call.

`PathRadiance` is the domain value produced by `computeRadiance(...)` and the
abstract output of `evaluate(...)` before endpoint or display composition. It
contains the atmosphere-added in-scattered radiance along the resolved path and
the final path transmittance:

```ts
type PathRadiance = {
  inScattered: SpectralValue;
  transmittance: SpectralValue;
};
```

`inScattered` is spectral radiance added by the atmosphere along the path:
direct light scattered into the view ray plus any optional incident/higher-order
in-scattering sampled at the path integration points. The "in" is the standard
in-scattering direction distinction: this field is light scattered into the
evaluated ray, while extinction/out-scattering is represented by
`transmittance`. `transmittance` is the dimensionless per-channel survival
multiplier left after extinction along the view path. These fields are not
added to each other; they combine only when an endpoint/background radiance is
present.

`SpectralValue` is the shared type for wavelength/channel-aligned scalar values
in the active `SpectralBasis`. Its JavaScript representation can be an ordered
number array; units, dimensionality, and physical meaning come from the field or parameter name,
such as `sourceRadiance`, `viewTransmittance`, `sourceOpticalDepth`, or
`rayleighScatteringCoefficient`.

A cache build that needs first-order incident sky radiance stores `inScattered`
from a first-order `computeRadiance(...)` run. Endpoint composition remains
explicit:
`pathRadiance.inScattered + pathRadiance.transmittance * endpointRadiance`.

The radiance/transmittance split is source-backed at the equation level:
optical depth integrates extinction along a path, transmittance is
Beer-Lambert attenuation `exp(-opticalDepth)`, and in-scattered radiance is
accumulated from source or incident radiance weighted by current view
transmittance, source or incident visibility, scattering coefficients, phase,
and sample measure. The canonical Algorithm32 transport lineage uses fixed
endpoint/trapezoid path sampling for view-path and source-path optical-depth
integration; sample counts, cache grid shape, and local finite-source
coordinate choices remain Algorithm32 configuration/evidence decisions, not
external physics constants.

### Shared CPU/Shader Build Logic

The CPU reference and shader builder need shared setup/build logic, not a
single shared runtime executor. The CPU reference runs the transport in
JavaScript. The shader path assembles most runtime transport logic into GLSL.
The shared layer should therefore own the contracts, descriptors, cache
machinery, payload formation, and validation that both paths need before either
runtime executes.

Shared CPU/shader setup logic should include:

- canonical configuration/context construction, including normalized light,
  geometry, atmosphere, spectral, execution, cache, shader, and display
  descriptors;
- descriptor fingerprints and compatibility validation for light radiometry,
  geometry mapping, atmosphere profile, spectral basis, execution controls,
  cache policy, and shader packing policy;
- spectral-basis utilities, wavelength/channel ordering, spectral-channel
  allocation/alignment checks, and unit-bearing scalar/array helpers used by
  build-time code;
- numerical-control descriptors for fixed endpoint/trapezoid path sampling,
  direction sets, interpolation/quantization policies, and cache resolution;
- the general calculator used by the CPU reference/evaluation class, cache
  generation, CPU reference tests, and shader-parity descriptors, including
  its readable `computeRadiance(...)` loop and lower-level named equation
  helpers;
- the cache-build coordinator that calls
  `lightSource.createIncidentRadianceCache(...)`,
  iterates cache-owned coordinates, passes each coordinate back to the cache
  with geometry/atmosphere/light/calculator dependencies, and
  records build diagnostics;
- concrete `IncidentRadianceCache` families such as null, distant, and local,
  including coordinate generators, keys, descriptors, generated-value storage,
  CPU sampling, and shader-payload export;
- cache-access contracts that let geometry resolve runtime path integration points into
  the cache domain used by both CPU support sampling and shader lookup code;
- cache shader-payload formation: typed arrays, logical dimensions, value
  semantics, coordinate mapping metadata, and lookup descriptors;
- provenance, diagnostics, criteria hooks, and fail-loud validation shared by
  CPU reference artifacts and shader resource setup.

Shared logic should not include:

- GPU resource creation, texture upload, sampler/uniform assignment, material
  mutation, resize, or disposal; those belong to `ShaderBuilder` and shader
  binding;
- shader runtime evaluation in JavaScript just to mirror GLSL;
- raw peer-interface calls hidden inside models; the coordinator, CPU
  reference, shader builder, or a narrow build helper asks one owner for facts
  and passes plain packets onward;
- display conversion inside CPU transport.

Equation parity between CPU and shader should be kept through named operation
descriptors, fixtures, and tests. Some implementation exists twice because
the CPU reference is JavaScript and the runtime shader is GLSL; that is
acceptable when both implementations are selected by the same descriptor and
validated against the same evidence.

### Calculation Helper Methods

The general calculator, provisionally `SpectralCalculator`, owns
the reusable readable radiance loop plus lower-level calculation methods.
`computeRadiance(...)` should show the Algorithm32 story in order: path
samples, medium sample, direct light query, source-path transmittance, direct
in-scattering, incident in-scattering, and transport-state update.

The lower-level helper methods exist to keep named equation terms,
spectral-channel math, and fixture-backed calculations in one place. Pure
equation helpers should receive plain packets, vectors, scalars, and
descriptors that have already been resolved by the coordinating calculator
loop.

Helper methods should take explicit calculation parameters, not broad request
objects. Request objects are appropriate at orchestration boundaries where
lifecycle, validation, diagnostics, cancellation, or compatibility metadata
matter. The calculation helper sits below that level; its signatures should
make the equation inputs visible.

Convenience inner loops are allowed when they make a low-level calculation
clearer, such as looping over spectral channels or reducing directional
incident samples. These inner-loop helpers may take explicit raw inputs plus
the exact interface instance needed for the loop, and may call that interface
directly. For example, a directional incident helper may accept
`atmosphere` and call `atmosphere.samplePhase(...)` for each incoming
direction. Such a method is treated as one named atomic action by the calling
algorithm: it reduces its explicit inputs to a single returned value packet,
such as one `SpectralValue`. It should not emit partial lifecycle
state, mutate caches, or become a multi-step workflow. Those loops are not the
primary purpose of the lower-level helper methods. Those helper methods must
not own the main path-integration-point loop, the cache coordinate loop, setup lifecycle,
cache binding, or shader resource creation.

Path integration point construction can live on `SpectralCalculator` because
it creates plain `PathIntegrationPoint` value objects. Geometry still resolves
the ray, finite path bounds, and coordinate meaning; the calculator helper only
partitions the finite interval according to Algorithm32's fixed
endpoint/trapezoid rule. Do not pass a separate rule parameter into the
canonical helper; alternate path integration belongs in a named experiment or
validation comparison, not the base Algorithm32 method surface.

A first-pass calculator method surface should keep one readable radiance loop
plus small equation-shaped helpers:

Moving stable collaborators into `SpectralCalculatorConfiguration` only
shrinks orchestration method signatures. It must not collapse the lower-level
helper surface. Equation helpers still take explicit raw calculation inputs and
return one value packet so they remain fixtureable, shader-descriptor-friendly,
and readable in isolation.

```ts
type SpectralCalculatorConfiguration = {
  geometry: GeometryModel;
  atmosphere: AtmosphereModel;
  lightSource: LightSourceModel;
  spectralBasis: SpectralBasis;
  executionControls: Algorithm32ExecutionControls;
};

class SpectralCalculator {
  constructor(configuration: SpectralCalculatorConfiguration);

  buildEndpointTrapezoidPathIntegrationPoints(
    viewRaySegment: RaySegment,
    pathIntervalCount: number):
    readonly PathIntegrationPoint[];

  computeRadiance(
    viewRaySegment: RaySegment,
    pathIntegrationPoints: readonly PathIntegrationPoint[],
    incidentRadianceSampling?: IncidentRadianceSampling):
    PathRadiance;

  computeSourceTransmittance(
    sourceOpticalDepth: SpectralValue):
    SpectralValue;

  computeTrapezoidSegmentTransmittance(
    previousTotalExtinctionCoefficient: SpectralValue,
    currentTotalExtinctionCoefficient: SpectralValue,
    intervalLengthMeters: number):
    SpectralValue;

  computeDirectScattering(
    rayleighScatteringCoefficient: SpectralValue,
    mieScatteringCoefficient: SpectralValue,
    rayleighPhase: number,
    miePhase: number):
    SpectralValue;

  computeDirectInScattering(
    viewTransmittance: SpectralValue,
    sourceTransmittance: SpectralValue,
    sourceRadiance: SpectralValue,
    directScatteringCoefficient: SpectralValue,
    measureMeters: number):
    SpectralValue;

  computeCollapsedIncidentInScattering(
    viewTransmittance: SpectralValue,
    collapsedIncidentRadiance: SpectralValue,
    totalScatteringCoefficient: SpectralValue,
    measureMeters: number):
    SpectralValue;

  computeDirectionalIncidentInScattering(
    viewTransmittance: SpectralValue,
    incidentRadianceByDirection: readonly SpectralValue[],
    incidentScatteringCoefficientByDirection: readonly SpectralValue[],
    directionWeights: readonly number[],
    measureMeters: number):
    SpectralValue;

  computeDirectionalIncidentInScatteringFromSamples(
    viewDirection: UnitVector3,
    directionalIncidentSamples: readonly DirectionalIncidentRadianceSample[],
    atmosphere: AtmosphereModel,
    rayleighScatteringCoefficient: SpectralValue,
    mieScatteringCoefficient: SpectralValue,
    viewTransmittance: SpectralValue,
    measureMeters: number):
    SpectralValue;

  updateTransportState(
    previousState: TransportState,
    directInScattering: SpectralValue,
    incidentInScattering: SpectralValue,
    viewOpticalDepth: SpectralValue,
    viewTransmittance: SpectralValue):
    TransportState;

  describeShaderOperations(
    incidentCacheDescriptor: IncidentRadianceCacheDescriptor):
    ShaderOperationDescriptor;
}
```

The primary evaluator and cache builder call
`calculator.buildEndpointTrapezoidPathIntegrationPoints(...)` before
`calculator.computeRadiance(...)`. The calculator method uses these lower-level
helpers while remaining readable as a whole algorithm. No separate radiance port
or first-order radiance method is needed; first-order cache generation is
`computeRadiance(...)` with incident sampling omitted. The shader descriptor
method exposes the calculation vocabulary needed for GLSL assembly; it does not
run shader transport in JavaScript. Small inner-loop helpers are the exception
to the pure-equation shape: they may call explicitly passed interfaces when the
whole loop is a named atomic calculation that returns one value packet.

Do not split owner queries into hidden model-to-model calls while extracting
helpers. Geometry, light source, atmosphere, incident cache/sampler, and color
remain separate interfaces; `computeRadiance(...)` coordinates the main story,
and the lower-level helpers own only calculation terms and local atomic
calculation loops.

### Color

Color/display supplies display-facing conversion facts outside CPU transport.
It consumes spectral Algorithm32 output and produces renderable or reviewable
values.

Color owns:

- spectral-to-display conversion, such as CIE integration, XYZ, sRGB, or a
  production display basis selected later;
- exposure, tone mapping, white balance, gamma/encoding, and debug display
  modes;
- GPU shader display-conversion descriptors needed to turn spectral transport
  output into renderable output;
- comparison-display policy for artifacts that intentionally reproduce a
  reference image family.

Color does not own:

- atmosphere coefficients or density profiles;
- light-source radiometry or calibration;
- incident-radiance cache values, optional artifacts, bindings, lookup
  coordinates, or sampling policy;
- geometry placement, path clipping, `SourceRelativePosition`, or
  source-relative cache coordinates;
- transport integration, transmittance, or in-scattering equations.

The CPU reference should define the color boundary but should not require
color conversion to execute spectral transport. The GPU shader phase needs the
color/display interface because it must render visible output.

## Type And JSDoc Contract

The reconciliation POC is JavaScript, but complex shapes must not be left to
implementation inference. Any complex type used by the POC must have a named
ambient declaration in an owning `types.d.ts` file, and implementation code
must use JSDoc to record where that type is consumed or produced.

Complex types include value packets, descriptors, requests, samples,
callbacks, handles, diagnostics, generated records, shader payloads, cache
keys, and persisted artifact shapes. Primitive local scalars do not need
ambient declarations. Cross-module shapes should live in the shared/root
ambient type home; implementation-only shapes should live in the owning
module's local `types.d.ts`.

The TypeScript-like blocks in this design document are design sketches. When
implemented, their shapes should be represented by ambient declarations such
as `Ray`, `RaySegment`, `PathIntegrationPoint`, `PathRadiance`,
`IncidentRadianceSampling`, and cache descriptor/access packets, with code
using JSDoc `@param`, `@returns`, `@type`, or callback annotations to reference
those names. When a shape changes, update the ambient type and its JSDoc use
sites in the same implementation step.

Runtime class modules should use one file per class, with that class as the
file's single default export. Required complex types stay in the owning
`types.d.ts` file rather than being defined inline in the class file. Interface
contracts are ambient types plus validation/fail-loud setup behavior; do not
add empty abstract runtime base classes just to stand in for interfaces.

## M0 Scaffold Inventory

Milestone 0 should create a thin, importable skeleton rather than a finished
transport implementation. The scaffold starts with these files:

```text
scripts/flat/reconciliation/POC/
  CURRENT_STATE.md
  README.md
  src/
    index.js
    types.d.ts
    errors/
      ReconciliationConfigurationError.js
      UnsupportedCombinationError.js
    validation/
      validateModelSet.js
    calculator/
      types.d.ts
      SpectralCalculator.js
    geometry/
      types.d.ts
    atmosphere/
      types.d.ts
    light/
      types.d.ts
    incident-radiance/
      types.d.ts
      noIncidentRadiance.js
    color/
      types.d.ts
    setup/
      types.d.ts
      buildIncidentRadianceCache.js
    runners/
      smoke.js
```

Initial ambient shared types in `src/types.d.ts`:

- `Position`
- `UnitVector3`
- `SpectralValue`
- `SpectralBasis`
- `Ray`
- `RaySegment`
- `PathIntegrationPoint`
- `PathRadiance`
- `ExecutionControls`

Initial module-local ambient types:

- `calculator/types.d.ts`: `SpectralCalculatorConfig`,
  `ComputeRadianceOptions`.
- `geometry/types.d.ts`: `GeometryModel`, `AtmosphereCoordinate`,
  `AtmospherePath`, `SourceRelativePosition`, `CacheAccess`.
- `atmosphere/types.d.ts`: `AtmosphereModel`, `MediumSample`,
  `OpticalDepthSample`, `PhaseSample`.
- `light/types.d.ts`: `LightSourceModel`, `DirectLightingSample`,
  `SourcePathLimit`, `IncidentRadianceCacheDescriptor`.
- `incident-radiance/types.d.ts`: `IncidentRadianceCache`,
  `IncidentRadianceSampling`, `IncidentRadianceSampler`,
  `IncidentRadianceSample`, `CacheBuildCoordinate`,
  `CacheShaderPayloadDescriptor`.
- `color/types.d.ts`: `ColorDisplayModel`, `DisplayConversionDescriptor`.
- `setup/types.d.ts`: cache-build coordinator request, result, and
  diagnostics packets as needed by the scaffold.

Initial runtime classes and functions:

- `SpectralCalculator.js`: default-exports `SpectralCalculator`; starts with
  `buildEndpointTrapezoidPathIntegrationPoints(...)` and a fail-loud or very
  thin `computeRadiance(...)` shell.
- `ReconciliationConfigurationError.js`: default-exports
  `ReconciliationConfigurationError`.
- `UnsupportedCombinationError.js`: default-exports
  `UnsupportedCombinationError`.
- `validateModelSet.js`: utility function module for fail-loud required-method
  checks.
- `buildIncidentRadianceCache.js`: utility function module for the generic
  cache-build coordinator shell.
- `noIncidentRadiance.js`: utility function or value module for the canonical
  omitted-cache/null-support helper.
- `smoke.js`: scaffold smoke runner that imports the module map and constructs
  the core value packets.

Do not build empty runtime base classes for `GeometryModel`,
`AtmosphereModel`, `LightSourceModel`, or `ColorDisplayModel` in M0. Those are
ambient interface contracts plus validation checks.

Saved for later:

- Milestone 1: `SphericalEarthGeometry`, `DistantSunLightSource`,
  `CanonicalAtmosphere`, real `SpectralCalculator` radiance math, Step 032
  figure/skydome renderer, image comparison tools, and populated
  parameter/provenance ledger contents.
- Milestone 2: `FlatEarthGeometry`, `LocalSunLightSource`, local-source
  calibration/falloff resolver, and Step 018 skydome comparison.
- Milestone 3: `ShaderBuilder`, GLSL assembly, browser watcher implementation
  if not done earlier, GPU diagnostic packets, and distant/spherical shader
  parity runner.
- Milestone 4: `LocalSunIncidentRadianceCache`, distant incident-radiance cache
  only if needed by higher-order distant work, cache texture packing,
  `Data3DTexture`/shader payload upload, local/flat GPU integrated parity, and
  local-second-order review galleries.

## Ray And Path Points

`Ray` captures the repeated origin/direction pair used by the view path and
representative cache-build paths:

```ts
type Ray = {
  origin: Position;
  direction: UnitVector3;
};
```

`origin` is the starting point of the evaluated ray. In normal use it is
geometry-derived or geometry-normalized before transport sees it. `direction`
is unit length and expressed in the same geometry-owned model-space frame as
`origin`.

The finite transport interval should not be folded into `Ray` itself. A ray is
the coordinate line; a `RaySegment` is the geometry-resolved piece of that ray
that transport integrates:

```ts
type RaySegment = {
  ray: Ray;
  startDistanceMeters: number;
  endDistanceMeters: number;
};
```

The evaluated path point is abstractly:

```text
pathPoint = ray.origin + ray.direction * distanceAlongRay
```

That point is expressed in the active geometry's model-space frame. It is not
intrinsically latitude/longitude, flat map meters, altitude, or
planet-centered position. Geometry gives the coordinate meaning.

`PathIntegrationPoint` is a value object produced from a `RaySegment`. It is not a
geometry path, atmosphere path, medium sample, light-source sample, or
transport state. Its location is canonically defined as a scalar distance on
the owning ray segment. The packet also carries the measures needed to weight
that point:

```ts
type PathIntegrationPoint = {
  pointIndex: number;
  distanceAlongRayMeters: number;
  intervalLengthFromPreviousMeters: number;
  trapezoidWeight: number;
  measureMeters: number;
};
```

In this name, "integration point" means a quadrature evaluation point for the
continuous path integral over the resolved ray segment. The path domain being
discretized is distance along the ray. `distanceAlongRayMeters` is the ray
parameter in meters and must fall within the owning `RaySegment` bounds. The
model-space `pointPosition` used by geometry queries is derived as
`ray.origin + ray.direction * distanceAlongRayMeters`; it is not an independent
field on the integration point.

At each derived `pointPosition`, the radiance loop asks geometry, atmosphere,
light source, and optional incident radiance sampling for the physical facts
needed to evaluate the integrand. Those queried facts are not stored in
`PathIntegrationPoint`.

`intervalLengthFromPreviousMeters` is the distance between this integration
point and the previous integration point:
`distanceAlongRayMeters - previous.distanceAlongRayMeters`. The first point
uses `0`. This value is used for cumulative trapezoid optical-depth updates
with the previous integration point's extinction.
`measureMeters` is the point's effective integration length, the path-length
measure used to turn the integrand evaluated at this point into that point's
radiance contribution. It is not the point's distance from the previous point.
For the fixed uniform endpoint/trapezoid rule, if
`intervalLengthMeters = (segment.endDistanceMeters - segment.startDistanceMeters) /
pathIntervalCount`, then the first and last points use
`measureMeters = 0.5 * intervalLengthMeters`, while interior points use
`measureMeters = intervalLengthMeters`. The ray origin and direction are not
duplicated onto every `PathIntegrationPoint`; they come from the owning
`RaySegment`.

Most packets should be immutable handoff objects produced by one stage and
consumed by another. `TransportState` is the accumulator-like exception, and
even it should be treated as an immutable state transition:

```text
previous TransportState + point contribution -> next TransportState
```

## Coordinate Systems And Transforms

Reconciliation needs explicit coordinate ownership because Algorithm32 has to
support flat and spherical geometry without letting light sources, caches, or
transport code silently assume one model-space convention.

The governing rule is:

- Geometry owns every spatial coordinate interpretation and every spatial
  transform.
- Transport may carry coordinates and derived relation packets, but it may not
  infer distances, altitude, clipping, or local frames from raw coordinate
  components.
- Light sources consume geometry-resolved source-relative relations and produce
  lighting facts.
- Atmosphere consumes geometry-resolved `AtmosphereCoordinate` and
  `AtmospherePath` facts, then returns atmospheric coefficients or optical
  depth.
- Incident radiance cache/sampler consumes geometry-resolved cache-access
  packets and returns optional incoming spectral radiance facts.
- Color consumes completed spectral/radiance output outside the core transport
  algorithm.

Coordinate spaces:

- Authored configuration space: user/app inputs such as observer latitude,
  longitude, local time, altitude, camera pose, and source placement. These are
  durable configuration facts, not transport coordinates. The app may own how a
  UI gathers them, but geometry owns converting them into model-space placement
  facts.
- Geometry model space: the internal world/model coordinate frame used by a
  geometry implementation. Flat geometry may use a local Cartesian convention;
  spherical geometry may use a planet-centered or local-tangent convention. The
  `Position` packet can carry this coordinate, but only the owning geometry may
  define what its three components mean.
- Atmosphere coordinate space: the coordinate facts needed to sample an
  atmosphere profile. For the first production profile this is altitude-only
  stratification: `altitudeMeters`. Geometry resolves altitude from its
  model-space position; atmosphere uses altitude to sample density and
  wavelength-aligned coefficients. Later Earth/geographic refinements may add
  profile selectors such as latitude, longitude, surface class, season, or
  weather cell, but those are additional selectors around the same vertical
  stratification model.
- Atmosphere path space: a path already converted into atmosphere-owned
  sampling inputs. Each sample has an `AtmosphereCoordinate` plus a segment
  measure such as `segmentLengthMeters`. Geometry constructs this path from a
  model-space ray or source path after applying boundary/clipping rules.
  Atmosphere integrates optical depth over this path without interpreting the
  original model-space positions.
- Ray/path parameter space: the camera ray represented by an `origin`, a view
  direction, and a scalar distance parameter. The evaluate loop samples this
  path to produce path points. Transport uses the scalar path length for
  integration; geometry interprets each path point.
- Light placement space: the source placement configuration after geometry has
  resolved it into the geometry's own coordinate system or into a direction
  coordinate. A finite local source can have a model-space position. A distant
  sun can be represented as a constant direction; the light source owns whether
  that direction is treated as directional-infinite light.
- Observer-local sky space: derived observer-relative facts such as azimuth,
  altitude, local up/north/east basis, and observer-to-source distance. These
  are useful for UI, diagnostics, and source configuration. The observer's view
  direction is not needed to resolve where the source is relative to the
  observer; it matters later when transport evaluates the angle between the view
  ray and incoming light.
- Path-point source-relative space: the relation from a sampled path point to a
  light source. This is the main geometry-to-light-source interface. The raw
  `SourceRelativePosition` is only direction from source plus measured distance
  from source when finite placement exists. Source-relative frame facts,
  geometry boundary context, and cache coordinates are separate adjacent
  contracts. Distance-use treatment, angular extent, source radiometry, and
  directional-infinite policy are light-source interpretations of that
  position.
- Incident-radiance lookup space: the internal joined lookup coordinate used by
  a bound `IncidentRadianceCache`. The caller does not construct this
  coordinate. The evaluator asks geometry to derive it from caller-visible
  path-integration-point facts using the bound support/cache descriptor. Internally it joins
  atmosphere-relative and source-relative views:
  source-relative coordinates answer where the point is relative to the light
  domain, while atmosphere coordinates answer where the point is in the medium
  domain. A concrete cache descriptor decides which reduced components it
  keeps, such as altitude only, source-relative radial distance, incoming
  direction bin, or spectral channel.
- Cache coordinate space: a storage and lookup domain for derived tables such
  as an `IncidentRadianceCache`. This space may be reduced, symmetric, or
  representative instead of identical to geometry model space. Its descriptor
  must define axes, units, origin/reference, direction frame, distance metric,
  finite/infinite-source policy, and whether inverse mapping is exact or
  representative.
- Shader/screen/depth space: the GPU starts from screen coordinates, depth, and
  camera matrices. An adapter and the geometry abstraction convert those inputs
  into the same model-space ray shape used by the CPU reference before
  Algorithm32 transport begins.
- Display/color space: the color interface maps spectral/radiance results to
  display output after transport. It is not a spatial coordinate system, but it
  should remain separate because shader integration will need a color boundary.

Required transform flow:

- Configuration to model placement: app/source/observer configuration is
  resolved by geometry into model-space observer placement, source placement, or
  directional source coordinate.
- Camera placement to ray: geometry converts observer placement and camera/view
  configuration into a model-space ray origin and direction.
- Ray to path point: transport advances along the ray by scalar path distance.
  Geometry interprets the resulting path point when atmosphere coordinate,
  local frame, boundary, or source relation facts are needed.
- Path point to atmosphere coordinate: geometry resolves `AtmosphereCoordinate`
  from the path point. For the first profile that coordinate is
  `altitudeMeters`. Atmosphere converts that coordinate into density,
  scattering, absorption, and transmittance inputs.
- Model/source path to atmosphere path: geometry converts any path requiring
  optical-depth integration into `AtmospherePath` samples. This is the path
  form of `AtmosphereCoordinate`: geometry owns source/view path clipping,
  model-space sample placement, and segment lengths; atmosphere owns
  extinction integration over the supplied atmosphere coordinates and segment
  measures.
- Path point to source-relative position: geometry combines a path point with
  source placement facts to produce the `SourceRelativePosition` consumed by
  the light source.
- Source-relative position to lighting facts: the light source interprets
  that position and returns source-owned lighting facts such as direction,
  distance-use treatment, angular extent, spectral scale, and source path
  limit.
- Lighting facts to clipped source path: geometry combines the light-source
  direction/path-limit facts with geometry boundary rules to produce the
  `AtmospherePath` used for source-path transmittance integration.
- Model-space relation to incident cache lookup: at runtime, the evaluator
  asks geometry to turn caller-visible path-integration-point facts into the cache-access
  packet consumed by the bound support. The cache coordinate may be a reduced
  join of `SourceRelativePosition`, `AtmosphereCoordinate`, incoming direction,
  and spectral basis, but that reduced shape is hidden behind the support
  interface.
- Cache coordinate to representative model sample: during cache construction,
  geometry maps each cache coordinate back to an exact or representative
  model-space sample so the same atmosphere and source-path code can build the
  table.
- Transport output to color: the final spectral/radiance result crosses into
  the color interface for display conversion.

Any coordinate system that crosses an abstraction boundary must have a
descriptor. The descriptor should name the owning subsystem, axes, units,
origin/reference, direction convention, coordinate units, and whether reverse
mapping is exact or representative. Source-owned distance behavior and
finite/infinite lighting semantics belong in the light-source descriptor. This
is especially important for caches because a cache can be correct for one
geometry/source/atmosphere configuration and invalid for another.

In coordinate terms, a distant sun can consume a `SourceRelativePosition` with
a constant incoming direction and `distanceFromSourceMeters = null`, then
return directional-infinite lighting facts. A local sun can consume a
`SourceRelativePosition` that expresses the sampled point relative to a finite
source placement and return finite distance treatment, direction, falloff, and
angular extent. Geometry owns producing the position; the light source owns
interpreting it as lighting.

## Transport Responsibilities

Transport is the Algorithm32 integrator. It should not derive light distance,
source placement, map projection, observer coordinates, or atmosphere
composition.

Transport owns:

- one-evaluation orchestration;
- path-point traversal;
- optical-depth and transmittance integration rule;
- direct in-scattering accumulation;
- higher-order incident-radiance accumulation;
- transient `TransportState`;
- spectral result assembly.

Transport consumes:

- geometry-resolved view path and light relation facts;
- atmosphere medium and phase facts;
- light-source lighting facts;
- incident-radiance samples returned by the incident radiance sampler
  callback.

## Algorithm

Algorithm32's CPU/reference `evaluate(...)` delegates the per-ray transport
work to the general calculator. It coordinates the five abstraction
interfaces and integrates spectral radiance/transmittance along one resolved
view path. It should consume a stable model/configuration snapshot plus
transient operation packets. It should not build durable resources, derive
source placement, interpret raw geometry coordinates as lighting facts, or
perform display conversion.

At the outer level:

```text
viewRaySegment = geometry.resolveViewRaySegment(...)
pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
  viewRaySegment,
  pathIntervalCount)
pathRadiance = calculator.computeRadiance(
  viewRaySegment,
  pathIntegrationPoints,
  incidentRadianceSampling)
```

High-level `evaluate(...)` overview, expressed as the entity being queried,
the output that is consumed by a calculation, and the calculation that uses
that output. Inputs and request packet shapes are intentionally omitted here.

### evaluate(request)

The reference algorithm first asks geometry for **viewRaySegment**, then builds
the fixed endpoint/trapezoid **pathIntegrationPoints**, then asks the general
calculator to compute radiance from that segment and those integration points. The detailed
`computeRadiance(...)` expansion is a per-ray spectral transport loop. Each
step names the queried entity and only the returned output that is used by a
later calculation. Variable names are bolded in prose; calculations use plain
Markdown plus `<sub>` and `<sup>` tags so the typography stays consistent
while exponents and indexed terms still read like math.
Query steps use function-style notation, with intentionally sparse arguments,
to show which owner is being queried.

**Setup**

1. **viewRaySegment** = geometry.resolveViewRaySegment(...)

2. The resolved ray segment supplies the geometry/model-space **ray** plus
   finite start/end distances and any path-domain facts needed by later
   geometry resolvers.

   - **viewDirection** = **viewRaySegment.ray.direction**

3. **pathIntegrationPoints** =
   calculator.buildEndpointTrapezoidPathIntegrationPoints(
   **viewRaySegment**, **pathIntervalCount**)

   This uses Algorithm32's fixed endpoint/trapezoid rule: for
   **pathIntervalCount** intervals, it produces **pathIntervalCount + 1**
   endpoint integration points. Each integration point supplies **pointIndex**,
   **distanceAlongRay**, **measure**, **intervalLengthFromPrevious**, and
   **trapezoidWeight**. Endpoint integration points have half weight; interior
   integration points have full weight.

   Calculation: approximate the continuous path as a sum of point
   contributions: **pathIntegral** is approximately
   &sum;<sub>points</sub>(**pointContribution** &middot; **measure**).

4. Initialize spectral transport state:

   - **inScattered** = 0
   - **viewOpticalDepth** = 0
   - **viewTransmittance** = 1

**Loop Through Integration Points**

For each integration point in **pathIntegrationPoints**:

1. **pointPosition** =
   **viewRaySegment.ray.origin** + **viewRaySegment.ray.direction** &middot;
   **distanceAlongRay**

2. **atmosphereCoordinate** =
   geometry.resolveAtmosphereCoordinate(**pointPosition**)

3. **rayleighScattering**, **mieScattering**, **totalScattering**,
   **totalExtinction** = atmosphere.sampleMedium(**atmosphereCoordinate**)

   Calculation: **totalScattering** = **rayleighScattering** +
   **mieScattering**.

4. Update cumulative view optical depth and view transmittance.

   If this is the first endpoint sample:

   - **viewOpticalDepth** = 0
   - **viewTransmittance** = 1

   Otherwise:

   - **viewOpticalDepthDelta** =
     0.5 &middot; (**previousTotalExtinction** +
     **totalExtinction**) &middot; **intervalLengthFromPrevious**
   - **viewOpticalDepth** = **viewOpticalDepth** +
     **viewOpticalDepthDelta**
   - **viewTransmittance** =
     e<sup>-<strong>viewOpticalDepth</strong></sup>

5. **sourceRelativePosition** =
   geometry.resolveSourceRelativePosition(**pointPosition**)

6. **directionToSource**, **sourceRadiance**, **sourcePathLimit** =
   lightSource.sampleDirectLighting(**sourceRelativePosition**)

7. **sourceAtmospherePath** =
   geometry.resolveSourceAtmospherePath(**pointPosition**,
   **directionToSource**, **sourcePathLimit**)

   This path is already in the atmosphere sampling domain: atmosphere
   coordinates plus segment measures, not raw model-space coordinates.

8. **sourceOpticalDepth** =
   atmosphere.integrateOpticalDepth(**sourceAtmospherePath**)

9. **rayleighPhase**, **miePhase** = atmosphere.samplePhase(**viewDirection**,
   **directionToSource**)

10. Calculate source transmittance.

   - **sourceTransmittance** =
     e<sup>-<strong>sourceOpticalDepth</strong></sup>

11. Calculate phase-weighted direct scattering.

   - **directScattering** = (**rayleighScattering** &middot;
     **rayleighPhase**) + (**mieScattering** &middot; **miePhase**)

12. Calculate direct in-scattering.

   This is the current view-path survival, source-path survival, source
   radiance, phase-weighted scattering, and trapezoid integration measure:

   - **directInScattering** = **viewTransmittance** &middot;
     **sourceTransmittance** &middot; **sourceRadiance** &middot;
     **directScattering** &middot; **measure**

13. Calculate incident in-scattering.

    Incident queries use optional **incidentRadianceSampling** created
    during setup from available source light, atmosphere facts, geometry
    mapping, transport integration, the source-declared cache shape, and a
    validated cache binding. The evaluator starts with geometry model-space
    point facts, then asks geometry for the cache-access packet required by the
    cache binding. The caller does not supply cache shape, source kind,
    source placement, or raw cache lookup coordinates.

    This remains inside the path-integration-point loop because the incident
    contribution is weighted by the current point's **viewTransmittance**,
    **totalScattering**, phase terms, **measure**, and geometry-resolved
    cache access. A cache may precompute the incoming-radiance field, but the
    path integral still queries and weights that field at each path integration
    point.

    If **incidentRadianceSampling** is omitted:

    - **incidentSamples** = empty

    If **incidentRadianceSampling** is present:

    - **incidentRadianceCacheAccess** =
      geometry.resolveIncidentRadianceCacheAccess(**pointPosition**,
      **atmosphereCoordinate**, **incidentRadianceSampling.cacheBinding**)

    - **incidentSamples** =
      **incidentRadianceSampling.sampler**(**incidentRadianceCacheAccess**)

    If **incidentSamples** is empty:

    - **incidentInScattering** = 0

    If **incidentSamples** contains a collapsed sample:

    - **incidentRadiance** = **incidentSamples**.collapsedRadiance

    - **incidentInScattering** = **viewTransmittance** &middot;
      **incidentRadiance** &middot; **totalScattering** &middot;
      **measure**

    If **incidentSamples** contains directional samples, loop over each sample
    **k**:

    - **incomingDirection[k]**, **incidentRadiance[k]**,
      **directionWeight[k]** = **incidentSamples**.directionalSample(**k**)

    The returned **incomingDirection[k]** uses the same geometry-resolved
    direction frame as **viewDirection**. It is not a raw cache/source-local
    direction.

    - **rayleighPhase[k]**, **miePhase[k]** =
      atmosphere.samplePhase(**viewDirection**, **incomingDirection[k]**)

    - **incidentScattering**<sub><strong>k</strong></sub> =
      (**rayleighScattering** &middot;
      **rayleighPhase**<sub><strong>k</strong></sub>) +
      (**mieScattering** &middot; **miePhase**<sub><strong>k</strong></sub>)
    - **weightedIncident** =
      &sum;<sub><strong>k</strong></sub>(**incidentRadiance**<sub><strong>k</strong></sub>
      &middot; **incidentScattering**<sub><strong>k</strong></sub> &middot;
      **directionWeight**<sub><strong>k</strong></sub>)
    - **incidentInScattering** = **viewTransmittance** &middot;
      **measure** &middot; **weightedIncident**

14. Accumulate the point contribution into in-scattered path radiance.

    - **inScattered** = **inScattered** + **directInScattering** +
      **incidentInScattering**

15. Store **totalExtinction** as **previousTotalExtinction** for the next
    endpoint integration point's trapezoid optical-depth update.

**Return**

Return **PathRadiance** with **inScattered** and final
**viewTransmittance** as **transmittance**.

RGB/XYZ/tone mapping/display conversion happens after spectral transport,
outside **evaluate(...)**.

Configuration packets, source-relative positions, calibration state,
distance-use policies, source path limits, angular extent, cache descriptors,
and other handoff details still exist, but this overview intentionally omits
them unless an owner has collapsed them into a calculation-consumed output such
as **viewDistance**, **atmosphereCoordinate**, **sourceRelativePosition**,
**directionToSource**, **sourcePathLimit**, **sourceAtmospherePath**,
**sourceRadiance**, **incidentRadianceSampling**, **incidentRadiance**,
**rayleighScattering**, **mieScattering**, **totalScattering**,
**totalExtinction**, **rayleighPhase**, **miePhase**, or
**sourceOpticalDepth**.

The important boundary is that **evaluate(...)** coordinates owners, but does
not invent their facts. Geometry gives positions, distances, local frames, and
path geometry, including `AtmospherePath` samples for optical-depth
integration. Light source interprets `SourceRelativePosition` into lighting
and source-path limits. Atmosphere gives medium, phase, and optical depth over
geometry-resolved `AtmospherePath` samples. Transport integrates the returned
facts. Color consumes the final spectral output outside the algorithm.

## How It Fits Together

The five abstraction interfaces meet in three different workflows. The same
ownership rules apply in each workflow, but the object lifetimes are
different.

### Configuration

Configuration is where durable authored and selected facts enter the system.
It is not the hot transport loop.

```text
Algorithm32Config
  -> validated shared configuration/facts model
  -> descriptors, fingerprints, and operation-ready component views
```

Configuration supplies:

- observer/view placement config, or already resolved model-space ray facts;
- light placement config;
- light radiometry/calibration config;
- incident-radiance cache/sampler config;
- geometry profile and frame policy;
- atmosphere composition/profile;
- spectral basis;
- execution controls;
- shader/cache/display policy.

During config acceptance or setup, geometry should resolve or be able to
resolve observer and light placement into its model-space frame. Light source
should receive only its own radiometry/config plus later resolved
`SourceRelativePosition` values and related source-frame descriptors.
Atmosphere should receive only profile and medium configuration.
Incident radiance cache/sampler setup should receive only cache selection,
descriptors, optional persistence/packing inputs, and operation-ready
lookup/sampling resources.
Color/display should receive only display-conversion configuration or shader
descriptors.

Compatibility descriptors and fingerprints are created here or during setup.
They are what later cache builders and shader binders use to fail loudly when
a resource was built for a different light, geometry, atmosphere, spectral
basis, or execution-control packet.

### Cache Building

Cache building is a coordinated setup/resource workflow. The cache does not
build itself from private knowledge, and no single physical
domain owns the generated incident field. The light source creates the
source-shaped cache implementation, for example
`lightSource.createIncidentRadianceCache(...) -> LocalSunIncidentRadianceCache`, because the
cache family is source-specific. That cache still builds values only through a
generic setup/build coordinator that combines light-source, geometry,
atmosphere, and general-calculator answers through explicit descriptors and
build requests.

The concrete cache owns the loop by exposing a coordinate generator. The
generated coordinates are cache-owned logical cell addresses, not model-space
positions. For a local source, the coordinate is the join of the lookup facts
that will also be available at runtime:

```ts
type LocalSunIncidentRadianceCoordinate = {
  altitudeBinIndex: number;
  altitudeMeters: number;
  radialBinIndex: number;
  radialDistanceMeters: number;
  incomingDirectionIndex: number;
  incomingDirectionInSourceFrame: UnitVector3;
}
```

The generic coordinator treats those coordinates as opaque. It gets a
coordinate from `cache.coordinates()`, gives it back to the same cache along
with the required peer interfaces, and lets the cache ask geometry for the
build context:

```text
cache = lightSource.createIncidentRadianceCache(cachePolicy)

for coordinate in cache.coordinates():
  cache.addCoordinateToCache({
    coordinate,
    geometry,
    atmosphere,
    lightSource,
    calculator
  })
```

For a local source, `cache.coordinates()` loops over the configured source and
atmosphere-relative domain:

```text
for altitudeBin in cache.descriptor.altitudeBins
  for radialBin in cache.descriptor.radialBins
    for incomingDirection in cache.descriptor.incomingDirectionsInSourceFrame
      yield LocalSunIncidentRadianceCoordinate
```

The loop bounds are descriptor/configuration facts, not discovered from the
view loop. A cache may only loop over coordinates that the runtime access path
can later reconstruct. For local finite-source support, that means
`altitudeMeters`, source-relative `radialDistanceMeters`, and a source-frame
incoming-direction bin. For distant support, the source-relative radial axis is
absent, so the coordinate normally reduces to altitude plus incoming direction.
Spectral channels are descriptor facts for the stored value; the first CPU
cache shape stores one wavelength-aligned spectral value per coordinate
rather than making wavelength an outer loop.

The minimum method surface for cache building is:

```ts
interface IncidentRadianceCacheBuildCoordinator {
  buildIncidentRadianceCache(request: IncidentRadianceCacheBuildRequest):
    IncidentRadianceCacheBuildResult;
}

interface LightSourceModel {
  describeIncidentRadianceCache(request: IncidentRadianceCacheShapeRequest):
    SourceIncidentRadianceCacheDescriptor | null;

  createIncidentRadianceCache(request: IncidentRadianceCacheCreateRequest):
    IncidentRadianceCache;
}

interface IncidentRadianceCache {
  readonly descriptor: IncidentRadianceCacheDescriptor;

  coordinates(): Iterable<IncidentRadianceCacheCoordinate>;

  addCoordinateToCache(request: IncidentRadianceCacheCoordinateBuildRequest):
    IncidentRadianceCacheEntry;

  createIncidentRadianceSampler(request: IncidentRadianceCacheBindRequest):
    IncidentRadianceSampler;

  createShaderPayload(request: IncidentRadianceCacheShaderPayloadRequest):
    IncidentRadianceCacheShaderPayload;
}

type IncidentRadianceSampler = (
  cacheAccess: IncidentRadianceCacheAccess
) => IncidentRadianceSamples;

type IncidentRadianceSampling = {
  cacheBinding: IncidentRadianceCacheBinding;
  sampler: IncidentRadianceSampler;
};

interface GeometryModel {
  resolveViewRaySegment(request: ViewRaySegmentRequest):
    RaySegment;

  describeIncidentRadianceCacheMapping(request:
    IncidentRadianceCacheMappingDescriptorRequest):
    GeometryIncidentRadianceCacheMappingDescriptor;

  resolveIncidentRadianceBuildContext(request:
    IncidentRadianceBuildContextRequest):
    IncidentRadianceBuildContext;

  resolveIncidentRadianceCacheAccess(request:
    IncidentRadianceCacheAccessRequest):
    IncidentRadianceCacheAccess;
}

interface AtmosphereModel {
  describeIncidentRadianceCacheDependencies(request:
    IncidentRadianceCacheAtmosphereDescriptorRequest):
    AtmosphereIncidentRadianceCacheDescriptor;
}

interface ShaderBuilder {
  buildIncidentRadianceCacheTexture(
    payload: IncidentRadianceCacheShaderPayload):
    IncidentRadianceCacheShaderResource;
}
```

The coordinator owns the lifecycle: collect descriptors, validate
compatibility, ask the light source for the source-shaped cache, iterate
`cache.coordinates()`, and pass each coordinate back to
`cache.addCoordinateToCache(...)`. It may track progress, cancellation,
diagnostics, and persistence, but it does not know local or distant cache axes.

The cache owns coordinate enumeration, keying, generated-value storage, CPU
sampling, creation of an `IncidentRadianceSampler` callback, and
shader-payload export. It does not own geometry mapping or first-order
radiance physics. Geometry owns
both directions of the cache coordinate bridge: build coordinates become
representative model-space/ray/path facts through
`resolveIncidentRadianceBuildContext(...)`, while runtime path integration points become
`IncidentRadianceCacheAccess` packets through
`resolveIncidentRadianceCacheAccess(...)`.

`describeIncidentRadianceCacheMapping(...)` and
`describeIncidentRadianceCacheDependencies(...)` are setup-time descriptor
methods. They let the coordinator validate a cache against the active geometry
and atmosphere before generating values or accepting a persisted payload.

The local cache method that fills one coordinate is conceptually:

```text
LocalSunCache.addCoordinateToCache(coordinate, geometry, atmosphere,
  lightSource, calculator):
    buildContext = geometry.resolveIncidentRadianceBuildContext({
      cacheDescriptor,
      sourceDescriptor,
      atmosphereCoordinate: { altitudeMeters: coordinate.altitudeMeters },
      sourceRelativeCoordinate: {
        radialDistanceMeters: coordinate.radialDistanceMeters
      },
      incomingDirectionInSourceFrame:
        coordinate.incomingDirectionInSourceFrame
    })

    viewRaySegment = geometry.resolveViewRaySegment(
      buildContext.representativeIncidentRay)

    pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(
      viewRaySegment,
      pathIntervalCount)

    pathRadiance = calculator.computeRadiance(
      viewRaySegment,
      pathIntegrationPoints)

    cache.store(keyForCoordinate(coordinate), pathRadiance.inScattered)
```

`calculator.computeRadiance(...)` is the same algorithm-owned
transport calculation used by the primary evaluation path, run with
incident-radiance sampling omitted so cache generation does not recurse into
itself. Concrete caches must not duplicate first-order radiance physics.

For local second-order, the conceptual build flow is:

```text
source-created cache + cache/sampler descriptor
  -> cache generator yields source/atmosphere-relative build coordinates
  -> geometry maps build coordinates to representative model-space
     positions/directions and AtmospherePath facts
  -> calculator creates the endpoint/trapezoid PathIntegrationPoint values
  -> light source supplies available-light/direct-lighting facts
  -> atmosphere samples medium, phase, and optical depth from AtmospherePath
  -> general calculator integrates first-order incident radiance for the build
     sample with the null incident sampler
  -> cache stores incident radiance in the declared cache domain
```

The resulting `IncidentRadianceCache` is a coordinated generated
incident-radiance field. The light source owns the available-light model and
creates the concrete cache family: distant, local/finite, collapsed,
directional, or another source-specific cache domain. Atmosphere and
transport own the medium and integration work that produce the cached
incident-radiance values. Geometry owns the mapping between model-space
samples, source-relative/cache coordinates, and atmosphere paths. The concrete
cache owns the generated values, descriptor, compatibility contract, and later
sampling operation. A separate cache artifact is optional persistence,
diagnostic, or shader-packing output; it is not required as a runtime object
when the cache instance itself stores the generated values. Runtime exposes
the result through an incident-radiance sampler callback, but only after setup
has created a validated cache binding. The cache descriptor must include:

- light placement and radiometry identity;
- source-declared cache family/shape identity;
- geometry profile, frame, path policy, `SourceRelativePosition` mapping
  identity, and source-relative cache-coordinate mapping identity;
- atmosphere profile identity;
- spectral basis;
- execution controls and numerical samples;
- cache coordinate domain, resolution, direction set, and packing version;
- whether reverse source-relative mapping is exact, representative, or
  diagnostic-only.

This keeps cache storage ergonomic while preventing stale or spatially
incompatible resources from masquerading as valid lighting facts.

### Cache Binding And Runtime Lookup

The generated cache and the request that uses it must be connected by an
explicit binding step. A persisted cache artifact, packed
texture, or diagnostic payload is not directly usable just because it exists on
disk or has a matching display name. The light source first declares the
incident-radiance cache shape that its current available-light model
requires, then creates the concrete cache implementation for that shape. Setup
builds or accepts the cache, validates its descriptor against both the
source-declared shape and the current configuration, and may hand
`evaluate(...)` an optional `IncidentRadianceSampling` value containing an
operation-ready `IncidentRadianceSampler` callback plus the validated
cache-access metadata geometry needs.

The cache descriptor should include:

- semantic kind, such as second-order incident radiance;
- source-declared cache family/shape identity;
- dependency fingerprints for light placement/radiometry, geometry frame and
  mapping policy, atmosphere profile, spectral basis, and execution controls;
- source-relative cache-coordinate descriptor;
- direction-set descriptor and quadrature/weight policy;
- spectral channel descriptor, plus packing descriptor only when an artifact
  or GPU texture is emitted;
- value units and normalization semantics;
- build recipe version and tolerance policy.

When incident sampling is enabled, the evaluation context should include a
matching cache binding, not just a path or cache id. The binding points at the
operation-ready cache descriptor used by the sampler callback; artifact
identity is optional metadata:

```ts
type IncidentRadianceCacheBinding = {
  artifactId?: string;
  semanticKind: "secondOrderIncidentRadiance";
  sourceDeclaredCacheFamilyKey: string;
  dependencyFingerprint: string;
  coordinateDescriptor: SourceRelativeIndexDescriptor;
  directionSetDescriptor: string;
  spectralBasisDescriptor: string;
  valueSemantics: string;
}
```

Setup creates the optional sampling value only after descriptor validation
succeeds:

```text
source-declared incident-radiance cache shape
  + Algorithm32Context descriptors
  + source-created IncidentRadianceCache descriptor
  -> validate dependency fingerprints and lookup semantics
  -> IncidentRadianceCacheBinding
  + IncidentRadianceSampler
  -> optional IncidentRadianceSampling
```

Runtime lookup then uses that optional value only when it is present:

```text
path point + AtmosphereCoordinate
  -> evaluator asks geometry for an IncidentRadianceCacheAccess packet
  -> incidentRadianceSampler validates the access packet against its descriptor
  -> incidentRadianceSampler quantizes/samples generated values and direction set
  -> incident radiance samples returned to transport
```

This is the missing bridge between generation and use: cache generation
declares the source-shaped cache domain, coordinate domain, and dependencies;
setup proves the current request context matches that declaration; runtime only
asks geometry for a cache-access packet and then invokes the already-bound
sampler callback for incident radiance. If validation fails, the sampler must be
disabled, rebuilt, or rejected loudly. It must not silently fall back to a
visually plausible but mismatched cache. The cache-access packet is technically
the join of the path integration point's source-relative and atmosphere-relative
coordinates, plus incoming direction and spectral channel when the cache
descriptor keeps those axes, but it is produced by geometry and consumed by
the sampler callback. Transport coordinates the request; it does not index the
cache from raw model-space coordinates.

### Shader Cache Texture Building

The GPU shader path uses the same logical `IncidentRadianceCache`, but the
texture resource is a shader-builder output. The cache must expose enough
source-shaped payload information for a texture builder to pack the values
without reinterpreting local or distant cache coordinates. The shader builder
must own GPU formats, capability decisions, texture allocation, upload,
sampler/uniform/define binding, resize/dispose lifecycle, and any 3D-texture
versus atlas fallback.

The intended handoff is:

```text
bound IncidentRadianceCache
  -> cache creates or exposes a shader payload descriptor from its logical
     values and coordinate mapping
  -> ShaderBuilder packs/uploads the payload into GPU textures/resources
  -> shader binding receives texture handles plus the cache lookup descriptor
```

Conceptually:

```text
payload = cache.createShaderPayload({
  packingPolicy,
  spectralBasis,
  shaderCapabilities
})

shaderResource = shaderBuilder.buildIncidentRadianceCacheTexture(payload)
```

`createShaderPayload(...)` is source/cache-family aware because local and
distant caches can have different logical axes and lookup descriptors. It
should return typed array payloads, dimensions, coordinate mapping metadata,
value semantics, and shader lookup descriptors. It should not create
`Data3DTexture`, WebGL resources, Three objects, uniforms, or shader material
state. If shader setup needs a different packing layout, it requests a new
payload from the same built cache or asks the setup coordinator to rebuild the
cache; it does not recompute radiance inside the shader builder.

### Incident-Radiance Cache Interface Variants

Reconciliation should define one incident-radiance sampler callback type with
cache-backed variants. The selected light source declares which cache family it
needs when higher-order incident radiance is enabled, setup validates or builds
the matching cache object, and `evaluate(...)` receives optional incident
sampling through a common operation:

```text
incidentRadianceSampler(cacheAccess)
  -> IncidentRadianceSamples
```

When incident sampling is present, the caller-facing request to the bound
callback is intentionally a
geometry-resolved cache-access packet, not raw model-space position. The
evaluator owns the flow: it starts with current path integration point position and
`AtmosphereCoordinate`, asks geometry to resolve the cache access required by
the bound cache descriptor, then passes that packet to
`incidentRadianceSampler(...)`. The bound callback closes over the
distant/local cache variant, source-declared cache family, direction-set
enumeration, quantization/interpolation policy, and generated values.

The first reconciliation states are:

- No incident sampling: selected when higher-order incident radiance is
  disabled. No callback is supplied, no cache lookup occurs, and incident
  in-scattering receives an empty sample set. This is the explicit first-order
  path, not an implicit failure to bind a cache.
- Distant source incident cache: selected when the configured light source uses
  a directional-infinite/distant cache family. Its lookup is a reduced join
  that can keep atmosphere-relative position, usually altitude, incoming
  direction, and spectral channel while source-relative position is constant or
  descriptor-implied.
- Local source incident cache: selected when the configured light source uses a
  finite/local cache family. Its lookup keeps atmosphere-relative position
  plus source-relative position components such as distance from source,
  radial distance from source subpoint/axis, source-relative direction frame,
  incoming direction, and spectral channel as required by the descriptor.

The cache-backed variants answer the same question: what spectral radiance is arriving at
this path integration point from this incoming direction or collapsed direction set? The
variant changes the cache domain, not the transport meaning of the returned
value, and the caller does not know which cache domain was selected.

Configuration/setup chooses the variant:

```text
light source configuration
  -> source-declared incident cache family: none | distant | local
  -> source-created cache and descriptor validation/build when the family is
     not none
  -> optional IncidentRadianceSampling
  -> evaluate(...) invokes the callback only when present
```

Future source families can add variants, but reconciliation should start with
only no incident sampling plus distant and local cache-backed families unless
evidence requires another shape.

### Evaluate Sample Loop

`evaluate(...)` is the hot per-ray transport workflow. It should consume
prepared configuration facts and small operation packets; it should not build
durable resources or reinterpret model configuration.

The intended loop is:

```text
EvaluationRequest
  -> geometry resolves finite view-ray distance
  -> calculator creates PathIntegrationPoint values
  -> for each path integration point:
       geometry resolves AtmosphereCoordinate/frame facts
       atmosphere samples medium from AtmosphereCoordinate
       geometry resolves SourceRelativePosition
       light source samples direct lighting facts
       geometry resolves sourceAtmospherePath from light direction/path limit
       atmosphere integrates source optical depth from sourceAtmospherePath
       atmosphere samples phase
       optional incidentRadianceSampling returns incoming radiance samples
       transport updates TransportState
  -> PathRadiance
```

The loop may pass the current path point position around, but the position is
only a coordinate in the active geometry frame. Geometry interprets it.
Transport does not derive light distance. Geometry measures source-relative
coordinate distance when the active placement has one. Light source may use or
ignore that measured coordinate distance, but it does not interpret raw flat
or spherical model coordinates. Atmosphere does not derive altitude from raw
model coordinates; it samples from geometry-owned `AtmosphereCoordinate`
values and integrates optical depth over geometry-owned `AtmospherePath`
samples. For the first production profile, the coordinate inside those path
samples is `altitudeMeters`.

Incident radiance sampling is an operation-ready callback created during setup.
The light source owns the cache shape; the cache choice has already been
validated against the current geometry, atmosphere, light, spectral basis, and
execution-control descriptors. Runtime samples only produce lookup coordinates
inside that bound cache domain and pass them to the callback.

Color/display is absent from the CPU reference loop. It consumes the final
spectral output later. In the GPU shader path, display conversion is bound as
an adjacent shader/display workflow after or around spectral transport, not as
an input to the physics of the sample loop.

## Source-Relative Coordinates

Reconciliation should define a geometry-owned source-relative position that
every supported geometry can resolve. The goal is not to preserve the current
POC source classes. The goal is to preserve the data access they proved the
algorithm needs.

The distant and local implementations imply the same core relation:

- Geometry must express the evaluated position as `SourceRelativePosition`:
  direction from source plus finite metric distance when finite placement
  exists.
- The base coordinate can be a source-centered ray: direction from the source
  toward the evaluated point, plus finite metric distance when the geometry has
  a finite source placement.
- Distant sources can consume the same shape with a constant direction and no
  finite metric distance.
- Local finite sources can consume the source-centered direction and finite
  distance coordinate, then choose whether that distance affects falloff,
  angular size, source path limits, or other lighting behavior.
- Source-path transmittance is a two-stage handoff: the light source returns
  direction and source-owned path-limit semantics; geometry then clips that
  path against atmosphere, ground, and model boundaries.
- Incident-radiance caches need an indexable source-relative cache coordinate,
  not just the direct-light position/direction.

Base source-relative position:

```ts
type SourceRelativePosition = {
  directionFromSource: UnitVector3;
  distanceFromSourceMeters: number | null;
}
```

Required fields:

- `directionFromSource`: unit vector from the light-source origin or directional
  proxy toward the evaluated point.
- `distanceFromSourceMeters`: measured coordinate distance from the source
  origin to the evaluated point when the active geometry has a finite source
  placement; otherwise `null`.

That is intentionally the whole coordinate. Adjacent facts belong to adjacent
contracts:

- the model-space evaluated point is the caller's path point or observer
  position, not part of `SourceRelativePosition`;
- source origin, orientation, and basis belong to source placement/frame
  descriptors resolved by geometry;
- atmosphere, ground, and model-boundary clipping facts belong to source-path
  relation queries;
- cache bins belong to descriptor-driven index coordinates, not to the raw
  source-relative position.

No `kind` discriminator is needed while this remains the single canonical
source-relative position shape. Variant/version information belongs in the
geometry/source/cache descriptor if a later implementation genuinely needs
multiple position families.

The coordinate zero must be explicit. For a finite source, geometry resolves a
source-relative origin/anchor in model space, and `directionFromSource` plus
`distanceFromSourceMeters` are measured from that zero:

```text
sourceOrigin = geometry-resolved source anchor
directionFromSource = normalize(referencePosition - sourceOrigin)
distanceFromSourceMeters = length(referencePosition - sourceOrigin)
```

The origin/anchor role is part of the placement contract. For a spherical or
point-like source it may be the nominal source center. For a conical source it
may be the cone apex or nominal emitter center. For an area source it may be a
representative center used for this coordinate, while the light source still
owns the emitting-area interpretation. Geometry and light source must agree on
that role through descriptors.

For a distant directional source, there is no useful finite zero inside the
modeled geometry. The descriptor should say that the source has no finite
source-relative origin, and `distanceFromSourceMeters` should be `null`.

`directionFromSource` points from the source toward the evaluated point. The
incoming light direction used by transport is the opposite direction, returned
by the light source as `SourceLightingFacts.directionToSource`.

`distanceFromSourceMeters` is a geometry-owned coordinate measurement. When
the source placement is finite in the active geometry, geometry should provide
the measured distance. When the source placement is purely directional or has
no meaningful finite metric distance in the active geometry, the value is
`null`. This value is not itself a lighting rule. The light source decides
whether to use the measured coordinate distance, ignore it for a
directional-infinite approximation, or apply another source-specific distance
treatment.

The light-source-owned lighting facts should carry distance-use treatment, not
the geometry-owned distance measurement itself:

```ts
type SourceLightingFacts = {
  directionToSource: UnitVector3;
  distanceTreatment: SourceDistanceTreatment;
  angularRadius?: Angle;
  spectralIncidentScale: SpectralScale;
  sourcePathLimit: SourcePathLimit;
}

type SourceDistanceTreatment =
  | { policy: "use-coordinate-distance" }
  | { policy: "ignore-coordinate-distance"; approximation: "directional-infinite" }
  | { policy: "custom"; label: string };
```

The direct in-scattering multiply consumes only the resolved incoming light
value, the resolved source-path transmittance, atmosphere scattering/phase,
view transmittance, and sample weight. `directionToSource` feeds phase and the
source-path query. `sourcePathLimit` feeds the geometry clipping query.
Distance treatment, falloff, calibration, and angular-radius facts are
light-source derivation or diagnostic facts unless a named finite-disk/source
area approximation explicitly consumes them.

The clipped path relation is resolved after the light source supplies its
direction and source-owned path limit:

```ts
type SourcePathRelation = {
  origin: ModelPosition;
  direction: UnitVector3;
  integrationDistance?: Distance;
  boundaryPolicy?: string;
  clippedByAtmosphereBoundary?: boolean;
  occludedByGround?: boolean;
}
```

The light source computes its lighting facts from the geometry-owned
source-relative position:

- finite-source falloff from `distanceFromSourceMeters` when the light source
  chooses `use-coordinate-distance`;
- finite apparent angular radius from source distance plus source-owned
  physical radius;
- distant or finite incident spectral scale from source-owned radiometry and
  calibration;
- direct-radiance lookup and incident-radiance sampling using the same
  coordinate convention.

A conical light source uses the same source-relative position. Geometry can also
resolve source orientation into the same source-relative frame. In that case
the geometry-owned placement/frame facts include the cone axis or source-local
orientation basis, while the light source owns what that orientation means for
illumination.

Geometry-owned spatial facts for a conical source can include:

- source origin/anchor, such as cone apex or nominal emitter center;
- source cone axis in the active source-relative frame;
- optional source-local basis if the source needs more than one axis.

Light-source-owned cone facts include:

- inner/outer cone angle or aperture;
- edge falloff/softness policy;
- maximum range or whether to use coordinate distance;
- spectral/radiometric scale inside the cone.

The source can test whether the evaluated point is inside the cone with a dot
product:

```text
cosTheta = dot(directionFromSource, coneAxisFromSource)
inside cone when cosTheta >= cos(outerHalfAngle)
```

Then it can use `cosTheta`, cone softness, and `distanceFromSourceMeters` to
produce lighting facts. Transport still receives the same kind of output:
`directionToSource`, spectral scale, distance-use treatment, angular extent if
relevant, and source path limit.

Observer diagnostics may extend this with observer-local facts:

```ts
type ObserverSourcePosition = SourceRelativePosition & {
  azimuth?: Angle;
  altitude?: Angle;
  localFrame?: {
    up: UnitVector3;
    north?: UnitVector3;
    east?: UnitVector3;
  };
}
```

Per-path transport uses the same idea at each integration point:

```text
path point position + configured light placement
  -> geometry resolves SourceRelativePosition
  -> light source resolves SourceLightingFacts
  -> geometry resolves clipped SourcePathRelation when transmittance needs it
```

The view direction does not determine where the light is relative to the
observer. Observer-to-light relation depends on observer position, light
placement, and geometry. View direction still matters later for phase/scatter
angle:

```text
view direction vs SourceLightingFacts.directionToSource -> phase input
```

### Source-Relative Indexing

Direct lighting should not require an index. It should receive the exact
`SourceRelativePosition` plus light-source-owned lighting facts for each path
point. Indexing becomes necessary for incident-radiance caches and GPU packing.

The distant implementation currently indexes second-order incident radiance by:

- source/cache key;
- altitude bin;
- incoming-direction bin;
- wavelength or spectral channel.

That works because the distant source coordinate has a constant source direction
and the spherical atmosphere cache uses altitude symmetry instead of storing
full model-space position.

The local implementation currently indexes second-order incident radiance by:

- source/cache key;
- altitude `z` bin;
- horizontal distance `rho` from the source subpoint/source axis;
- incoming-direction bin in a source-relative radial/tangential/up frame;
- wavelength or packed spectral group.

That works because `SourceRelativePosition` varies with position, but the
accepted cache collapses horizontal position into a representative
source-centered radial cache coordinate.

The reconciliation cache coordinate should therefore be descriptor-driven:

```ts
type SourceRelativeIndexCoordinates = {
  altitudeMeters?: number;
  radialDistanceMeters?: number;
  directionInSourceFrame?: UnitVector3;
  incomingDirection?: UnitVector3;
  spectralChannelIndex?: number;
}
```

The descriptor, not the raw coordinate, defines how these values become cache
indices:

```ts
type SourceRelativeIndexDescriptor = {
  sourcePlacementKey: string;
  geometryFrameKey: string;
  positionAxes: string[];
  directionFrame: string;
  quantizationPolicy: string;
  inverseMappingPolicy: "exact" | "representative" | "diagnostic-only";
}
```

Required lookup/build flows:

```text
runtime lookup:
  model-space path point + incoming direction
    -> geometry resolves SourceRelativePosition
    -> geometry maps relation to SourceRelativeIndexCoordinates
    -> cache descriptor quantizes coordinates to bins

cache build:
  cache bin coordinate
    -> geometry maps to exact or representative model-space point/direction
    -> transport computes incident radiance
```

For the accepted local cache, the representative inverse mapping is:

```text
rho,z,directionIndex
  -> position at source x/y plus rho, altitude z
  -> incoming direction from source-relative radial/tangential/up frame
```

For the accepted distant cache, the representative inverse mapping is:

```text
altitude,directionIndex
  -> spherical atmosphere position at that altitude
  -> incoming direction from the source-direction-oriented sampling frame
```

The important design point is that both caches are indexed by a
geometry-owned source-relative coordinate system, even though the distant case
collapses most spatial variation and the local case needs an additional radial
coordinate.

## Bidirectional Mapping

For cache construction and diagnostics, geometry should expose or support
mapping between model-space positions and source-relative cache coordinates:

```text
model position/direction -> SourceRelativePosition and optional cache coordinates
source-relative cache coordinate -> model position/direction
```

The exact method names are open, but the capability should be explicit:

```ts
geometry.toSourceRelativePosition({ modelPosition, lightPlacement })

geometry.fromSourceRelativeCacheCoordinates({ sourceCacheCoordinates, lightPlacement })
```

This lets reconciliation run both workflows:

```text
runtime lookup:
  model-space path point
    -> geometry maps to SourceRelativePosition and cache coordinate
    -> sample incident-radiance cache

cache build:
  source-relative grid coordinate
    -> geometry maps to representative model-space point
    -> general calculator computes cached radiance
```

Some mappings may be reduced or symmetry-based rather than fully invertible.
For those, the descriptor must state whether reverse mapping is exact,
representative, or diagnostic-only.

## Distant Sun As A Simplified Finite Source

Reconciliation should consider distant Sun as a special case or limiting
approximation of the general finite-source light-source interpretation.

Geometry can supply a finite-source coordinate such as:

```text
directionFromSource = normalize(pathPoint - sourcePosition)
distanceFromSource = length(pathPoint - sourcePosition)
```

The light source interprets that coordinate as:

```text
directionToSource = -directionFromSource
distanceTreatment = use-coordinate-distance
angularRadius = atan(sourceRadius / distanceFromSource)
incident scale may use inverse-square falloff
source path limit = finite distance to source
```

Distant/directional simplification:

```text
source coordinate is a constant direction, or nearly constant over the scene
light source ignores coordinate distance and returns directional-infinite behavior
angular radius is fixed or externally configured
source path limit asks geometry to integrate to the atmosphere boundary
incident radiance uses constant-radiance or externally sourced solar scale
inverse-square variation across the atmosphere/view is ignored
```

This framing keeps future Mars work clean: the Sun is technically finite, but
the implementation may choose a directional-infinite approximation when the
source is far enough relative to the modeled atmosphere. That choice becomes
an explicit light-source approximation policy plus a geometry-owned coordinate
mapping, rather than a separate architecture.

## IncidentRadianceCache

`IncidentRadianceCache` is a coordinated generated incident-radiance field. It is
source-shaped because local and distant sources can need different cache
domains, but its values are the result of available source light moving through
an atmosphere under a geometry and numerical transport policy.

Cache construction is coordinated by setup/build code. The light source
creates the concrete source-shaped cache implementation, and that cache exposes
a generator over its configured logical coordinates. The physical and numerical
facts that make those coordinates meaningful come from:

- light placement and radiometry;
- geometry frame, path rules, `SourceRelativePosition` mapping, and
  source-relative cache-coordinate mapping;
- atmosphere composition and medium facts;
- spectral basis;
- execution/numerical controls;
- cache resolution and packing policy.

The cache/sampler contract owns the generated values and binding contract
after that coordinated build has produced them. A separate cache artifact may
exist for persistence, diagnostics, or GPU packing, but it is not required for
runtime operation when the cache instance owns the generated values. The cache
should not be treated as the component that independently knows how to derive
light placement, atmosphere paths, optical depth, or transport integration.
Those values are calculated through the general calculator.

Runtime transport performs an incident-radiance sampling operation:

```text
incidentRadianceSampler(cacheAccess)
  -> IncidentRadianceSamples
```

The `incidentRadianceSampler(...)` input is the geometry-resolved `cacheAccess`
packet for the bound cache, not a raw model-space sample position. The returned
`IncidentRadianceSamples` packet is spectral radiance arriving at the current path
sample from the requested incoming direction or collapsed direction set, plus
any direction/weight data needed by transport. That callback is produced from
the source-declared cache family/shape, atmosphere/transport build recipe,
geometry mapping, and an `IncidentRadianceCacheBinding` created during setup.
If the optional `IncidentRadianceSampling` value is absent, no generated values
are sampled and incident radiance contributes an empty sample set. The initial
cache-backed variants are distant and local.
Runtime does not select a generated cache directly, does not pass a source
kind, and does not construct cache lookup coordinates. For cache-backed
variants, transport starts from current path-integration-point facts such as model-space
position and atmosphere coordinate, asks geometry to resolve the matching
source/atmosphere-relative cache-access packet, then passes that packet to the
bound sampler. The sampler validates and samples its generated
values using that cache-access packet and returns any direction/weight samples
transport needs.

For the shader path, the same logical cache can also expose a shader payload
descriptor over its generated values. The cache is allowed to be family-aware
when linearizing local or distant axes, but actual texture creation and binding
belong to `ShaderBuilder`.

Cache descriptors, cache keys, diagnostics, and validation must include the
geometry and atmosphere dependencies. Otherwise a stale or spatially
incompatible cache can look like a valid light-source fact.

The cache may store entries in source-relative coordinates. For the accepted
flat local POC, that was:

```text
z = altitude above flat ground
rho = horizontal distance from local Sun subpoint
incomingDirection = direction in radial/tangential/up source-subpoint frame
wavelength = spectral group/channel
```

Production should generalize the idea without hard-coding flat assumptions.
The cache descriptor must define exactly how geometry maps runtime sample
facts into the cache-access coordinate consumed by the bound support, because
fields such as `z`, `rho`, or `direction` have no safe meaning without their
mapping rules.

## Validation Enabled By This Design

The source-position and cache-coordinate mappings enable a useful optional
reconciliation diagnostic:

```text
configure canonical distant Sun
geometry resolves observer-source coordinate
light source resolves observer-source lighting facts
configure finite/local light to match that observer-relative result
run both on the same geometry/atmosphere/spectral controls
compare CPU/GPU outputs and diagnostics
```

The finite/local source should match the distant source as closely as the
chosen approximation permits:

- same observer-relative direction, azimuth, and altitude;
- same apparent angular radius or solid angle target;
- matched spectral incident scale or calibration target at the observer;
- same atmosphere and numerical controls;
- explicit path and falloff policies.

This does not externally validate local-Sun physics. It tests separation:

- can finite-source radiometry run on a geometry other than flat;
- can geometry provide the required `SourceRelativePosition`;
- can the finite source collapse toward the distant source under matched
  configuration;
- are flat-only assumptions leaking into light source, cache, shader, or
  transport code.

Failures should be classified as calibration mismatch, geometry mapping gap,
source-path policy mismatch, non-negligible finite-distance effect,
flat-specific cache coordinate leak, shader shortcut divergence, or another
named boundary failure.

## Reconciliation Deliverables

Before production promotion, reconciliation should produce:

- accepted names and packet shapes for model-space positions, path points,
  `AtmosphereCoordinate`, `SourceRelativePosition`, observer-source
  diagnostics, lighting facts, resolved source paths, cache coordinates, and
  cache descriptors;
- accepted optional `IncidentRadianceSampling` value with no-sampling,
  `distant`, and `local` states;
- accepted cache-builder protocol where light sources create concrete
  source-shaped caches, concrete caches expose coordinate generators and
  keying, and the setup/build coordinator remains generic over cache-owned
  coordinates;
- fixtures proving geometry can resolve model-space positions to
  `AtmosphereCoordinate`, `SourceRelativePosition`, and cache coordinates, and
  where required map cache coordinates back to exact or representative
  model-space positions;
- fixtures proving cache build coordinates are also reconstructible runtime
  lookup coordinates, so a cache cannot build over axes that are unavailable
  to cache access;
- tests proving transport does not compute light distance or interpret
  geometry coordinates;
- tests proving concrete caches use the general calculator to build stored
  values instead of duplicating first-order radiance code;
- tests proving shader cache texture builders consume cache shader payloads and
  descriptors instead of recomputing radiance or reinterpreting local/distant
  cache coordinates;
- tests proving light-source calls do not receive peer geometry or atmosphere
  model objects;
- cache descriptor validation that fails loudly on mismatched geometry,
  atmosphere, light placement/radiometry, spectral basis, execution controls,
  or packing;
- cache binding tests proving a generated cache cannot be sampled until setup
  validates it against the active Algorithm32 context and hands evaluation an
  operation-ready incident radiance sampler callback plus cache-access
  metadata;
- optional distant-as-local validation artifacts under
  `tmp/atmosphere/reconciliation/`.

## Open Naming Questions

- Should the direct light-source method be `sampleRadiance`,
  `sampleLighting`, or `sampleLightContribution` once geometry supplies
  `SourceRelativePosition`?
- Should the minimal direction/distance coordinate keep the provisional
  `SourceRelativePosition` name, or become `SourceRelativePoint`,
  `ResolvedSourcePosition`, or another production API name?
- Should observer diagnostics extend `SourceRelativePosition`, or should
  observer-source sky facts be a separate diagnostic packet?
- Which mappings are required to be exact inverses, and which may be
  reduced/representative cache-domain mappings?
