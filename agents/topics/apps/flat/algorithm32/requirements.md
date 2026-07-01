# Algorithm32 Requirements

Status: design stage. These requirements define what the production
Algorithm32 module must provide before the public API is frozen.

The API design should be derived from this document. POC modules and the
latest local Sun experiments are evidence inputs, not production contracts by
themselves.

## Requirement Principles

- Algorithm32's ultimate production output is a usable shader/runtime
  atmosphere pass for the app render path.
- Algorithm32 must become a shared production module under
  `shared/algorithm32/production/`.
- The reconciliation gate must first produce a reference-backed CPU
  implementation of Algorithm32, then a GPU shader implementation validated
  against that CPU reference. CPU/reference code remains a support surface for
  validation, shader texture building, cache construction, diagnostics, and
  future test needs; it is not the end-user product surface.
- Production consumers must not import from `shared/algorithm32/POC/` after a
  behavior has been promoted.
- The module should expose pure, deterministic helpers and serializable packets
  wherever practical.
- Public packets must use explicit units in field names or schema docs.
- No production decision, algorithm, numeric value, default, spectral shape, or
  validation expectation may be promoted unless it is backed by an external
  reference, source-backed fixture, or explicitly accepted reference log entry.
  POC behavior is implementation evidence only; unsourced POC tuning values do
  not become production physics facts.
- Derived constants are valid when their formula and every input constant can
  be traced to a published paper/source implementation, source-backed fixture,
  or accepted reference-log entry. The derivation must be documented at the
  promotion site so the stored scalar is reproducible.
- The baseline Earth/Figure-1 profile uses the accepted Algorithm32 constants
  as canon. Every promoted constant must carry per-value provenance: an
  external source, a source-backed derivation, or an accepted Algorithm32
  experiment/decision. Values whose pedigree is not yet recovered remain
  pending evidence.
- The initial implementation ships with one atmosphere profile: the accepted
  Algorithm32 canonical profile. Alternate atmosphere profiles may be added
  later as explicit named extensions, but they are not first-implementation
  defaults or open decisions.
- Public interfaces are hard encapsulation boundaries. Outside a public
  interface and that interface's public input/resolver types, no private
  fields or derived state may leak into other domains.
- Each algorithm input domain owns its own external surface. Sun, atmosphere
  composition, and geometry consumers may depend only on the corresponding
  public interface and that interface's public input/resolver types.
- Color/display conversion is a public boundary outside Algorithm32 transport.
  It may consume spectral outputs from the CPU reference or GPU shader, but it
  must not become a fourth algorithm input to transport. CPU reference
  transport must run without it; the later GPU shader builder/runtime will use
  the color/display interface to produce renderable output after transport.
- Numerical controls are execution configuration, not a fourth algorithm input
  abstraction. They may affect precision, performance, cache validity, and
  generated texture compatibility, but they must not own physical/domain facts.
- Generated artifacts, cache sidecars, runner heartbeat state, and selected UI
  state must not become canonical sources of production facts.
- Invalid, stale, mismatched, or unsupported inputs should fail loudly at the
  owning boundary.

## Ownership Domains

Requirements are divided by product/code ownership domain. Each domain should
be implementable as a mostly self-contained module surface with explicit
interfaces to the adjacent domains:

- API contract and governance: `A32-API-001` through `A32-API-004`.
- Algorithm input interfaces: `A32-INP-001` through `A32-INP-003`.
- Local Sun configuration and calibration: `A32-CAL-001` through
  `A32-CAL-005`.
- Execution configuration: `A32-CFG-001`.
- Pure math utility namespace: `A32-MTH-001`.
- Transport kernel and reference support: `A32-TRN-001` through
  `A32-TRN-003`.
- Shader texture and cache builder: `A32-TEX-001` through `A32-TEX-005`.
- Runtime shader product: `A32-RUN-001` through `A32-RUN-005`.
- Display conversion: `A32-DSP-001`.
- Validation: `A32-VAL-001` through `A32-VAL-003`.

## API Contract And Governance Domain

### A32-API-001 Production Module Boundary

Algorithm32 must own the reusable atmosphere/Sun behavior needed to produce
the production shader/runtime atmosphere pass. App integrations, CPU oracle
tools, shader texture builders, cache builders, and validation harnesses are
support surfaces around that shader product.

The module must provide stable boundaries for:

- sun, atmosphere composition, and geometry input contracts;
- local Sun calibration;
- incoming-radiance and local cache behavior;
- internal shader resource builders;
- Three/WebGL adapter behavior;
- spectral-to-display-color conversion;
- generally useful pure math utilities;
- CPU/reference transport for testing and cache support;
- deterministic validation helpers.

The flat app owns live user/session context: current view location, date/time,
time zone, geocoding, terrain asset selection, camera choreography, and UI
state.

Local Sun configuration and calibration must not become alternate inputs to the
main Algorithm32 transport, texture-builder, cache, or runtime shader
surfaces. Those surfaces receive a resolved object through the standard public
`Sun` input interface.

### A32-API-002 Public API Interface Definitions

The production API must define the core abstractions as public interfaces
inside the API itself, not only as prose, private object shapes, or experiment
packet conventions.

The API must publish named interfaces for:

- Sun input;
- atmosphere composition input;
- geometry input;
- the combined algorithm-input packet made from those three inputs;
- execution configuration for numerical, integration, cache, texture, and
  diagnostic controls;
- shader runtime configuration for runtime pass behavior, selected shader mode,
  debug view, cache/resource policy, capability policy, and render-target
  policy;
- spectral display conversion;
- shader texture descriptors;
- calibration packets;
- validation/error results.

The three algorithm input interfaces must remain separate from display
conversion. Display interfaces may consume spectral outputs from transport or
shader execution, but they must not be treated as algorithm inputs. The public
color/display surface exists to keep display conversion out of Algorithm32
transport while still making the output boundary testable and reusable by the
later GPU shader path.

Execution configuration must also remain separate from the three algorithm
input interfaces. It controls how an evaluation is approximated, cached,
packed, or diagnosed; it does not define the modeled Sun, atmosphere
composition, or geometry. Shader runtime configuration is also part of
`Algorithm32Config`, but it controls runtime shader behavior rather than
physical facts. It is updateable configuration, not a one-time setup request.

Interface ownership is strict: if a value is not part of a public interface or
that interface's public input/resolver type, it must not leak into consumers,
cache keys, shader descriptors, uniforms, validation fixtures, or generated
artifacts.

Factories may create interface-conforming packets, but downstream runtime,
texture builder, CPU reference, validation, and runtime shader builder code
must depend on the public interfaces rather than on factory-private return
shapes.

Each public interface must define enough contract metadata for validation,
serialization, cache keying, shader binding, and compatibility checks. In this
JavaScript codebase, the accepted implementation form may be JSDoc typedefs,
`types.d.ts`, or another repo-standard public type surface, but ownership must
live with the Algorithm32 API.

### A32-API-003 Error Taxonomy

The production API must define a public error taxonomy for invalid Sun
packets, invalid atmosphere composition packets, invalid geometry packets,
invalid calibration context, unsupported feature combinations, cache-key
mismatch, stale cache data, invalid shader texture descriptor, and unsupported
GPU packing.

### A32-API-004 Public Facade With Private Resource Builders

The production API must expose a compact configured facade for composer shader
setup and lifecycle. Per-path evaluation may remain public for CPU/reference
and validation consumers. Shader texture/cache building must remain a separate
implementation domain that consumes the facade-owned shared model, but it
should not be a primary external consumer API.

The per-path evaluator owns `EvaluationRequest` handling and returns spectral
transport output for one path or segment. Internal resource builders own
texture/cache build requests, sampled build domains, grid traversal, packing,
descriptors, upload metadata, and cache-key validation.

The two surfaces share the facade-owned configuration/facts model: Sun/source
facts, atmosphere facts, geometry facts, and wavelength-aware spectral
descriptors. They may also call the separate validation/error and pure math
API namespace, while owning their own execution/resource work.

The public facade should not expose a general `buildTexture` method. Awaited
`setupShader` and awaited shader-handle config updates should own normal
resource preparation. Any future tool/debug API for texture artifacts must be
a narrower non-primary support surface with a specific consumer need.

The assumed production API shape is an object facade constructed with a
configuration packet. The app may create one facade instance per simulation
window so configuration, validation state, shader bindings, cache descriptors,
and GPU resources stay instance-scoped instead of global. The facade owns the
shared configuration/facts model created from the validated public
configuration. It may own two internal implementation objects, one
CPU/reference algorithm execution class for evaluation and texture/cache work
and one runtime shader builder, and both should receive a
reference to the facade-owned shared model instead of duplicating configuration
interpretation. The shared model should use immutable snapshots or explicit
facade-local versions so multiple facade instances can coexist safely.

Runtime shader behavior must live in facade configuration, likely
`Algorithm32Config.shader`, rather than in the Three setup request. Runtime
configuration includes selected shader mode, debug view, cache/resource
policy, capability failure policy, and render-target/HDR/depth policy.
The Three setup request supplies app-owned attachment handles such as composer,
scene, camera, renderer-compatible surface, and pass insertion location; it
must not become an alternate runtime configuration packet.

Facade reconfiguration must update the shared model through replacement or
versioned canonical snapshots. CPU/reference operations, texture/cache builds,
and shader resource updates should capture the model version they run against
and fail/restart or rebuild/rebind when the facade replaces incompatible model
facts.

Core responsibility terminology:

- algorithm configuration facts:
  durable facts and typed abstractions consumed by the Algorithm32 algorithm:
  Sun/source, atmosphere medium, geometry, spectral basis, and execution
  settings. These facts live below the algorithm itself and are owned by their
  subordinate abstractions;
- validation/error handling:
  the separate owner for accepting or rejecting configuration facts, requests,
  descriptors, runtime capabilities, and cache compatibility. It does not own
  physics facts and does not execute the algorithm;
- algorithm execution:
  running the Algorithm32 calculations for one specific input/request. It
  consumes validated configuration abstractions, asks them for typed data,
  computes spectral transmittance/radiance results, and owns only computed
  results plus transient calculation state for that run;
- workflows, builders, and adapters:
  higher-level consumers around the core, including the CPU/reference
  algorithm execution class, texture/cache build workflow, runtime shader
  builder, Three/runtime adapter behavior, facade, display conversion, and
  pure math namespace.

The API must not require callers to know or mix `EvaluationRequest`
responsibilities with texture grid, packing, descriptor, cache, or upload
responsibilities in one request shape or lifecycle.

Internal texture/cache builders may generate evaluation contexts or call
lower-level transport functions directly for performance, but their internal
requests must not extend or masquerade as `EvaluationRequest`.

The shared aggregate model must be limited to canonical shared configuration
views needed by both CPU/reference algorithm execution and the runtime shader
implementation. The aggregate model may provide narrow
data-access or descriptor-derivation methods, but its primary shared value is
canonical configuration shape rather than algorithm behavior. The current
shared component models are:

- source model: public `Sun` data, resolved source samples, source path
  policy, incident spectral scale, and local-versus-distant source behavior;
- atmosphere medium model: public atmosphere composition data, density/profile
  samples, spectral coefficients, absorption/scattering coefficients, and
  phase parameters;
- geometry model: public geometry data, model-space frame and path
  descriptors, altitude, boundary clipping, sky-ray policy, and numeric
  Three-to-Algorithm transforms;
- spectral model: wavelength grid, spectral channel shape, wavelength
  traversal, and wavelength-aware spectral operations.

These component models may share public types, immutable descriptors, and
sample/result packet shapes, but typed domain data remains owned by the
component model that defines the fact. Algorithm execution consumes component
models through explicit samples/descriptors; the shared aggregate model does
not execute the Algorithm32 algorithm, and sibling component models must not
reach into each other's internals.

Public input validation, canonicalization, compatibility fingerprints,
deterministic error construction, diagnostic normalization, generic pure math,
display conversion, and concrete GPU texture packing belong to separate
owners.

Model-like objects that are specific to one top implementation domain must not
be promoted into the shared aggregate model. CPU/reference algorithm execution
receives an `EvaluationRequest` as a one-call request packet, not a durable
model. It may produce a transport path as a resolved per-run path/integration
artifact, but the transport path is not a model because it has no durable
identity or lifecycle beyond the execution that produced it.
Second-order incoming radiance must be supplied through
`LightSourceModel.sampleIncidentRadiance(...)`, not by a caller-provided
provider interface. A concrete light-source implementation may own an internal
`IncidentRadianceCache` behind that public boundary. That cache may privately
own L2/local incident radiance data, fixture tables, oracle-evaluation
strategies, sampled direction state, quadrature weights, spectral alignment,
provenance, or sample caches.
The runtime shader builder may own a runtime capability model if that object
owns mutable capability state. IncidentRadianceCache and
texture/cache packing responsibilities are assemblers: they consume validated
shared-model facts, cache policy, descriptors, capability facts, and samples
to produce shader-facing cache, layout, payload, and upload artifacts. The
runtime shader builder should also create a shader source composer and shader
binder. The shader source composer assembles final GLSL source and binding
requirements from packaged shader modules, shared descriptors, runtime config,
capability facts, cache/packing artifacts, debug mode, and the caller-provided
display conversion shader descriptor. The shader binder is not a model: it is
the active object that applies and updates shader bindings on Three
shader/runtime objects. Its output is live applied runtime state, including
current uniform, sampler, texture, render-target, debug, display-conversion,
and frame/config values assigned to shader slots, plus binding diagnostics or
update status. It may keep an internal shader binding map for binding facts
such as uniform/sampler names, slots, resource ids, descriptor versions,
update categories, and compatibility labels. Runtime attachment should be a
runtime attachment model when it owns the related Three/composer facts:
composer, scene, camera, renderer context, render targets, pass insertion,
resize state, and disposal scope, along with mutation methods for replacing
scene/camera, updating size, refreshing color/depth targets, and disposing
owned resources. These shader-specific collaborators consume the shared
aggregate model but are not shared configuration components.

The spectral component model must expose the canonical spectral basis as an
aggregate-model property, likely `model.spectral`. Its inputs are the
validated active `wavelengthsNm` or equivalent spectral channel set,
spectral-basis provenance, and shape requirements from wavelength-aligned
source spectra, atmosphere coefficients, incident-radiance caches,
and Algorithm32 outputs. Its properties should include `wavelengthsNm`,
`wavelengthUnit`, `channelCount`, spectral vector/radiance/transmittance/
coefficient shapes, and a serializable descriptor. Its methods should cover
wavelength/channel lookup, creation of radiance/transmittance/coefficient
vectors, alignment checks, active-channel iteration, descriptor generation,
and fingerprinting. It must not produce RGB/XYZ/display colors; that
conversion belongs to an adjacent display-conversion consumer outside the
Algorithm32 facade boundary. It must not own shader/cache packing; that
belongs to the runtime shader builder.

Per-path evaluation unique operations include:

- accepting and validating `EvaluationRequest`;
- resolving one ray or segment for sky, object, transmittance, or diagnostic
  evaluation;
- composing supplied surface radiance as
  `surfaceRadiance * viewTransmittance + pathRadiance`;
- returning per-path spectral output and per-path diagnostics.

Internal shader texture/cache-building unique operations include:

- accepting and validating internal texture/cache build requests;
- owning texture kind, sampled build domain, grid traversal, chunking, and
  progress/cancellation policy;
- generating internal sample/evaluation contexts without exposing them as
  public `EvaluationRequest` packets;
- owning texture packing, coordinate-to-texel mapping, descriptors, upload
  metadata, cache keys, stale-key checks, and packed payload output.

## Algorithm Input Interfaces Domain

### A32-INP-001 Sun Input Models

Algorithm32 must support at least two Sun input families through a shared Sun
contract:

- spherical distant directional Sun;
- flat local finite Sun.

The distant Sun must expose an infinite-distance source sample with a
direction vector, solar irradiance table, spectral incident scale, and a
transmittance path to the spherical top-atmosphere boundary.

The local Sun must expose a finite-distance source sample with source
position, direction from sample point, distance, angular radius,
inverse-square reference-distance scaling, spectral incident scale, source
color, and a finite transmittance path through the flat atmosphere.

The local Sun family is part of the standard `Sun` input interface. Local Sun
configuration, orbit settings, and calibration packets are upstream resolver
state and must not be required by consumers of the `Sun` input.

For the Sun domain specifically, the public `Sun` interface and its public Sun
input/resolver interfaces are the only external surface for Sun-related state.
Local Sun orbit, configuration, calibration, and provenance details may exist
behind resolvers or factories, but transport, texture builders, caches, runtime
shaders, display conversion, and validation must not require fields outside the
public Sun interface.

### A32-INP-002 Atmosphere Composition Models

Algorithm32 must model atmosphere composition as a first-class algorithm
domain, separate from the Sun and geometry. The initial public implementation
ships only the accepted Algorithm32 canonical atmosphere profile; alternate
profile selection is a future extension.

The atmosphere composition packet must define the medium being integrated:

- spectral wavelength grid or spectral channel set;
- Rayleigh scattering coefficients or density/scattering profile;
- aerosol/Mie scattering and extinction coefficients or profile;
- absorption coefficients or profile;
- density falloff/scale-height behavior for each active component;
- phase-function parameters;
- any composition-level provenance and formula/profile version.

Atmosphere composition packets must be visible to validation, shader texture
building, cache keying, and runtime shader builder binding. They must not be
inferred from generated artifacts or hidden shader constants.

For the atmosphere composition domain, the public atmosphere composition
interface and its public input/resolver interfaces are the only external
surface for composition-related state. Private preset recipes, profile
builders, coefficient derivation internals, provenance details, and source
fixture metadata may exist behind resolvers or factories, but transport,
texture builders, caches, runtime shaders, display conversion, and validation
must not require fields outside the public atmosphere composition interface.

### A32-INP-003 Geometry Models

Algorithm32 must expose geometry as a first-class algorithm input and support
at least two geometry families:

- spherical atmosphere geometry with bottom/top radii and observer height;
- flat z-up atmosphere geometry with an observer position, ground plane,
  atmosphere top altitude, and optional scene sky-ray limit.

Geometry packets must make altitude policy, source-path policy, and atmosphere
boundary behavior explicit.

For the geometry domain, the public geometry interface and its public
input/resolver interfaces are the only external surface for geometry-related
state. Private projection helpers, scene adapters, terrain/view context,
geometry factories, and derivation internals may exist behind resolvers or
factories, but transport, texture builders, caches, runtime shaders, display
conversion, and validation must not require fields outside the public geometry
interface.

## Local Sun Configuration And Calibration Domain

### A32-CAL-001 Normalized App Context

Algorithm32 calibration and Sun-resolution helpers must accept normalized
app-provided context instead of reading app state directly.

That context must be sufficient to resolve:

- observer latitude, longitude, and elevation;
- working date and time-zone basis;
- local civil-time or simulation-time anchor;
- app-selected local Sun user settings;
- any app-provided standard solar-position data if the app chooses to supply
  it instead of asking Algorithm32 to compute it.

Algorithm32 may compute deterministic derived values from that packet, but it
must not persist or own the app's live context.

### A32-CAL-002 User-Authored Local Sun Settings

The basic user-authored local Sun settings must stay limited to:

- Sun altitude;
- Sun diameter;
- northern latitude limit;
- southern latitude limit.

Location, date, time, and time zone normally come from app context. Orbit
direction, orbit period, orbit rate, and brightness/source power are not basic
user-entered settings.

### A32-CAL-003 Standardized Local Sun Orbit

The local Sun resolver must implement the standardized model behavior:

- annual latitude migration between the configured north/south latitude limits;
- clockwise daily orbit;
- one full orbit per solar day;
- positive local orbit offsets move forward in local solar time;
- default tropic limits of `23.5 deg N` and `23.5 deg S`;
- default altitude of `3000 miles`;
- default diameter of `32 miles`.

The resolver must return the source position, current latitude, local sky
azimuth/altitude, local solar time label or minutes, and enough provenance to
explain the resolved state.

Instantaneous orbital speed is a derived display value, not a configuration
input. If exposed, it must be computed for the resolved time rather than
treated as a daily constant.

### A32-CAL-004 Solar-Zenith Calibration

Local Sun setup must support calibration as the normal path instead of asking
for a brightness setting.

Calibration must:

- accept normalized location/date/time-zone context and local Sun user
  settings;
- compute or consume the standard-model solar-noon anchor for that context,
  meaning the local date/location time of maximum solar altitude;
- resolve local closest approach for the same context;
- derive the clock offset that aligns local closest approach with solar
  noon;
- derive local source power so local closest approach matches the standard Sun
  illumination target at the solar-noon anchor;
- return a serializable calibration packet with user inputs, derived values,
  formula versions, assumptions, and provenance;
- rebuild a resolved local Sun value that conforms to the public `Sun` input
  interface for any requested simulation time.

The user-facing story is synchronization on solar zenith/solar noon. The raw
derived source-power scalar is internal calibration state.

The calibration packet is not a main-algorithm input. Its only route into the
transport, texture-builder, cache, or runtime shader domains is through the
resolved public `Sun` input it produces.

### A32-CAL-005 Calibration Reuse And Recalibration

The calibration packet must be stable enough for the app to store and reuse,
and explicit enough for the app to detect when recalibration is needed.

The app must be able to recalibrate when normalized location, date, time zone,
or local Sun user settings change.

Post-calibration visual adjustment, if needed later, should be represented as
render exposure or display tone mapping rather than source brightness.

## Execution Configuration Domain

### A32-CFG-001 Numerical And Runtime Configuration

Algorithm32 must expose numerical controls as execution configuration, not as
algorithm input abstractions.

Execution configuration may include:

- integration sample counts and step policy;
- precision/performance quality presets;
- numerical tolerances and termination limits;
- cache and texture resolution;
- spectral packing/grouping choices for runtime upload;
- diagnostic and validation detail level.

Execution configuration must be serializable and versioned when it affects
cache keys, generated texture descriptors, validation fixtures, or shader
compatibility. It must not duplicate, override, or become an alternate owner
for facts owned by the public Sun, atmosphere composition, geometry, or display
conversion interfaces.

## Pure Math Utility Namespace Domain

### A32-MTH-001 Generally Useful Pure Math Namespace

Algorithm32 may export a generally useful pure math API namespace alongside
the facade, but it must stay separate from the shared model. The namespace
should have explicit namespace designators. The current concrete production
utility objects are `ScalarMath`, `UnitMath`, `VectorMath`, `ArrayMath`, and
`SampleMath`, with `MathUtils.js` as the named re-export entry point.

The pure math namespace may own deterministic, side-effect-free helpers for:

- scalar operations such as clamping, finite-number checks, tolerant equality,
  range checks, interpolation, and stable numeric formatting;
- angle and unit conversion such as degrees/radians,
  meters/kilometers, miles/kilometers, and generic angle wrapping;
- plain vector tuple operations such as add/subtract/scale, dot, cross,
  length, distance, normalize, and finite/normalized tuple checks;
- generic numeric-array helpers such as fixed-length zero arrays,
  element-wise add/multiply, mean, weighted sum, and mapping helpers;
- generic sample-domain helpers such as nearest-sample lookup, padded samples,
  monotonic traversal, and stable sample signatures.

The pure math namespace must not depend on Sun, atmosphere composition, geometry,
wavelength grids, spectral radiance, transmittance, phase functions, cache
`z`/`rho`, source-frame transforms, shader packing, display conversion, or the
validation/error taxonomy. Helpers that need those domain concepts belong to
the owning Algorithm32 class or module instead.

## Transport Kernel And Reference Domain

### A32-TRN-001 CPU Reference Support

Algorithm32 must include a deterministic CPU/reference transport path for
validation, shader texture building, cache construction, diagnostics, and
future test needs.

The CPU path must support:

- explicit execution configuration for numerical controls/integration settings;
- path radiance along a view segment;
- optical-length and transmittance spectra;
- sample-to-source transmittance for distant and finite sources;
- first-order scattering;
- second-order scattering through light-source-owned incident radiance support,
  which may use `IncidentRadianceCache` behind the light-source boundary;
- object/surface radiance composition where the app supplies the captured
  surface radiance input.

The CPU path is not the production render product. It may be slower than the
shader path, but it must terminate predictably under explicit numerical
execution configuration. Internal shader texture/cache builders may share
these mechanics, but they must be explicit awaited setup/update work rather
than hidden render-frame work.

### A32-TRN-002 Shared Transport Shape

Spherical distant and flat local Sun models must share the same transport
shape wherever possible. Differences should live in Sun samples, atmosphere
composition packets, geometry packets, and source-path policies rather than
duplicated render pipelines.

The shared transport shape should be represented by public model facts and
descriptors that both the per-path evaluator and texture builders can consume
without either public surface owning the other. Any low-level physics
primitives should remain subordinate implementation details, not the shared
API namespace.

### A32-TRN-003 Incident Radiance Cache

Algorithm execution must query `LightSourceModel.sampleIncidentRadiance(...)`
for scattering work that needs already-arriving spectral radiance, including
second-order work. A concrete light-source implementation may answer that
method from an internal `IncidentRadianceCache`.

The cache must be able to sample:

```text
L1_incident = lightSource.sampleIncidentRadiance(position, incomingDirection, spectralBasis)
```

For flat local Sun second-order work, the accepted cache lookup domain is:

```text
z, rho, incomingDirection, wavelength
```

where `rho` is horizontal distance from the local Sun subpoint and incoming
directions use the Sun-subpoint local radial/tangential/up frame.

## Shader Texture And Cache Builder Domain

### A32-TEX-001 Direct Incoming Radiance Oracle

Algorithm32 must provide a direct local first-order incoming-radiance oracle
that can compute local Sun incoming spectra at arbitrary valid flat-atmosphere
positions and incoming directions.

The oracle must reject invalid positions and non-normalized directions, and it
must return zero incident radiance for directions that hit the flat ground
before reaching the sky/source path.

### A32-TEX-002 Grid Cache Contract

Algorithm32 must provide an IncidentRadianceCache contract for concrete
light-source implementations keyed by:

- public light-source identity/configuration, atmosphere composition, and
  geometry interface values;
- execution configuration;
- `z` bins;
- `rho` bins;
- incoming-direction set;
- wavelength grid;
- packing version.

Cache sampling must fail loudly for light-source mismatch, invalid position,
out-of-range `rho`, stale key, missing sample, or invalid incoming direction.

### A32-TEX-003 Local Direction Frame

Local cache directions must use the Sun-subpoint local radial/tangential/up
frame. Production cache APIs must expose transforms between local-frame and
world-frame directions so CPU and GPU paths cannot silently drift apart.

### A32-TEX-004 GPU Packing Metadata

Algorithm32 must describe cache packing as data, not hidden shader knowledge.

The first production packing may begin with the accepted
`rgba-3d-texture-v1` layout:

```text
X = rho bin
Y = z bin
Z = incomingDirectionIndex * spectralGroupCount + spectralGroupIndex
RGBA = spectral channel group
```

The API must leave room for a future 2D atlas fallback without changing the
logical cache contract.

### A32-TEX-005 Internal Shader Resource Building

Algorithm32 must include implementation-owned builders for the textures and
caches required by the production shader. These builders are linked to the
CPU/reference support surface because they consume the same shared model facts
and must stay compatible with incoming-radiance sampling, binning, packing,
validation, and provenance contracts.

Texture/cache builders must run as explicit awaited setup or update work owned
by `setupShader` and the shader handle. They must not run implicitly inside
the render frame.

Texture builders consume the same shared model as the per-path evaluator, but
they are not the same API surface. They own grid traversal, build-domain
sampling, packing, texture descriptors, and cache validation.

Internal builder inputs and outputs must be versioned and keyed by the same
canonical facts that affect shader sampling:

- public `Sun` interface values, including resolved public Sun input when a
  time-varying or calibrated Sun is involved;
- public atmosphere composition and geometry interface values;
- execution configuration;
- cache or texture resolution;
- direction sets and bin definitions;
- wavelength grid and spectral packing;
- packing version and target texture layout.

Internal builder outputs must include the packed texture payload or uploadable
texture data, plus a serializable descriptor that the runtime shader builder
can validate before binding. The descriptor must identify dimensions, bin domains,
spectral groups, packing policy, Sun/atmosphere-composition/geometry
fingerprints, and any unsupported target-device requirements.

The runtime facade must keep this behind awaited shader setup and awaited
shader-handle config updates. If implementation-owned persistence or cache
reuse provides prebuilt artifacts, the adapter must validate descriptors,
cache keys, dimensions, packing version, source key, wavelength grid,
direction set, and target-device compatibility before binding them.

## Runtime Shader Product Domain

### A32-RUN-001 Usable Production Shader

Algorithm32 must provide a usable production shader/runtime pass for app
rendering. The first production target is a Three/WebGL adapter that maps Sun,
atmosphere composition, geometry, execution configuration, display, and cache
packets into shader uniforms and textures.

Runtime shader uniforms, descriptors, and texture bindings must be derived from
public interfaces. The adapter must not expose or require private Sun,
atmosphere composition, or geometry fields outside the corresponding public
interface and public input/resolver types.

The Three adapter must own the actual Three integration calls. At minimum, the
adapter call shape includes creating render targets and depth textures,
creating a fullscreen shader material and quad, rendering the app scene into a
scene-color/depth target, rendering the fullscreen atmosphere pass, resizing
owned targets/uniforms, and disposing owned Three resources. Algorithm32 input
configuration decides uniform values and textures; it is separate from the
Three methods used to install and run the pass.

The shader path must support:

- distant directional atmosphere pass;
- flat local first-order atmosphere pass;
- flat local second-order atmosphere pass using IncidentRadianceCache;
- debug-view mapping for transmittance, path radiance, flat ray direction, and
  flat source direction;
- deterministic texture upload metadata for shader-built textures and
  IncidentRadianceCache artifacts.

Experiment-only gallery controls and artifact generation must not become part
of the stable adapter API.

### A32-RUN-002 Runtime Frame Budget

The integrated shader path is the primary production render path and must be
designed as a bounded real-time render path. It must not perform unbounded CPU
work, retry loops, cache builds, or minutes of work per frame.

Long-running CPU reference work, shader texture building, and cache
construction must be explicit awaited setup/update or validation actions
outside the render frame. Runtime composer passes must consume already-resolved
packets and already-built cache textures.

### A32-RUN-003 Live Three Input And Adapter Lifecycle

The normal production render input must be a live Three scene rendered to a
scene-color texture and depth texture, followed by an Algorithm32 fullscreen
shader pass in the same renderer context.

JSON scene packets, Raycaster captures, and full per-pixel scene-input packets
are validation/oracle artifacts only. They may support CPU soft-shader
comparisons, but they must not become the normal production render input.

The runtime shader attachment lifecycle should be compact from the caller's
point of view:

```text
shader = await algorithm32.setupShader({ composer, scene, camera, ... })
composer.render()
await shader.setConfig(nextConfig)
shader.dispose()
```

Exact names remain unfrozen, but the facade and its runtime shader builder
must own awaited resource preparation, render-target/depth creation,
fullscreen pass setup, scene capture, atmosphere composition, camera-uniform
updates, output-target restoration, composer-pass wiring, resize propagation,
and resource disposal.
The caller should not need to duplicate per-object atmosphere materials, run a
standalone raw-WebGL atmosphere renderer, call separate resource-preparation
methods in the normal path, use a raw-renderer-only integration, or create a
second animation loop. The frame entry point must be installed in the app's
existing postprocess composer or composer-compatible framework render hook.

### A32-RUN-004 Source, Geometry, And Scene-Light Synchronization

The runtime shader builder must provide source and geometry binding facts
derived from the public Sun and geometry interfaces.

The same public Sun value must drive atmosphere uniforms and any source-driven
Three lighting helper the adapter provides. For a distant directional Sun, the
adapter must know how to map the public source to compatible directional scene
lighting and shader source uniforms. For a flat local finite Sun, the adapter
must know how to map the public source to compatible local scene lighting or
an explicit app-light synchronization hook while the shader still samples the
true finite source.

The public geometry value must drive camera/world conversion, atmosphere
boundary behavior, flat top-altitude policy, no-hit sky ray distance, and
depth interpretation. Depth near/far planes, depth precision policy, render
target color-space/HDR policy, flat sky ray limit, and debug-view selection
must be explicit configuration or validated derived state rather than hidden
shader constants.

### A32-RUN-005 Runtime Capabilities, Debug Views, And Fail-Loud Binding

The runtime shader builder must validate runtime capabilities before use. At minimum,
it must detect and report unsupported WebGL/Three features required by the
selected configuration, including depth texture support, WebGL2 or equivalent
3D texture support when local second-order cache textures are selected, float
texture/render-target requirements when production HDR transport is selected,
and unsupported source/geometry/scattering combinations.

Runtime diagnostics should expose enough information for the app or developer
tools to detect software-renderer fallbacks, renderer capability mismatches,
active texture/cache descriptors, selected debug view, pass mode or feature
set, and coarse pass timing when available.

The runtime shader builder and returned handle must not silently fall back from
local second-order to first-order when an IncidentRadianceCache resource is
missing, stale, mismatched, or unsupported. It may render an explicitly
configured first-order mode, but a requested second-order mode must fail
loudly at setup/resource-binding time.

Stable debug views should cover at least final color, scene color, depth,
transmittance, and path radiance. Additional source/ray/cache diagnostic views
may be dev/test scoped until their production UX is accepted.

## Display Conversion Domain

### A32-DSP-001 Spectral Display Conversion

Display conversion must stay separate from the three algorithm inputs and
outside the Algorithm32 facade boundary. The transport and shader core produce
spectral or spectral-group radiance and transmittance as Algorithm32's core
output; display code turns those spectral values into output colors.

The display layer must be a separate consumer class or module, such as a
hypothetical `Algorithm32DisplayConversion`, that provides a versioned mapping
from spectral information to output color, including any chosen CIE/XYZ/RGB
conversion, display color space, exposure, and tone mapping policy. It may
consume the spectral component model or a spectral descriptor for wavelength
alignment, but it must treat Algorithm32 spectral radiance/transmittance as
input data.

Display settings and debug views must not change Sun input, atmosphere
composition input, geometry input, calibrated source power, cache keys, or
transport facts. They must not become facade-owned state. A future physical
star/celestial source model would need its own validated Sun/source-family
contract before it becomes Algorithm32 core behavior.

Optional visible star or celestial point-source display, if promoted from the
POC, must be an explicit display/celestial-source extension rather than a
hidden shader constant. It must state whether it contributes only visible
top-of-atmosphere radiance, whether it is attenuated by view transmittance,
whether it lights scene geometry, and how apparent magnitude or catalog data
maps to spectral radiance.

## Validation Domain

### A32-VAL-001 POC Promotion Validation

Production promotion must prove that each promoted behavior still matches the
accepted POC behavior it replaces.

Validation must cover:

- Sun, atmosphere composition, and geometry packet creation and sampling;
- distant CPU path radiance;
- flat/local single-scattering;
- CPU soft-shader packet execution;
- local direct incoming-radiance sampling;
- IncidentRadianceCache sampling and packing;
- shader texture builder keying and descriptor validation;
- Three adapter importability and packet-to-uniform mapping;
- latest local-second-order script-lane runtime wrapper behavior until it is
  promoted: `Data3DTexture` construction from packed cache payloads,
  source-matrix pass configuration, source-driven Three light synchronization,
  renderer capability diagnostics, render-scale/antialias review policy, and
  local second-order live-scene cache binding.

### A32-VAL-002 Parity And Fixture Strategy

Validation helpers must be deterministic and source-backed. External reference
logs and fixture evidence may support validation rationale, but generated
artifacts must not become canonical facts.

Stable fixtures should include enough provenance to explain constants,
formulas, and tolerances. Stale or ambiguous fixture inputs should fail
loudly.

### A32-VAL-003 Runtime Shader Validation Surface

Production validation may keep a CPU soft-shader scene-packet surface for
oracle comparisons. That surface is a dev/test contract, separate from the
normal runtime shader facade.

The validation packet may include scene color, depth or hit distance, hit
mask, material/spectrum ids, ray directions, camera, source, and geometry, but
it must be labeled as validation input and must not become the production
renderer architecture.

Runtime shader validation should cover live pass versus CPU soft-shader
selected-pixel checks, image delta summaries, source/geometry family coverage,
postprocess-versus-integrated visual comparisons, capability diagnostics, and
local-cache binding checks. The validation API may expose diagnostics and
readback helpers, but those helpers are not normal consumer render methods.

## API Design Implications

The API should be organized around the shader product and its support surfaces
before implementation starts:

- public interfaces for Sun input, atmosphere composition input, geometry
  input, algorithm input packets, execution configuration, display conversion,
  shader texture descriptors, calibration packets, and validation/error
  results;
- Sun, atmosphere composition, and geometry packet factories plus validators;
- local Sun orbit resolver and calibration solver;
- calibration packet serializer/replayer;
- direct incoming-radiance and local cache builder/sampler;
- pure math namespace for generic scalar, vector, unit-conversion,
  numeric-array, and sample/padding helpers;
- per-path evaluator surface and internal shader texture/cache builders that
  consume the facade-owned shared model;
- internal shader texture builders;
- cache packing descriptors and texture upload helpers;
- Three adapter/pass factory, source/geometry/light adapters, uniform mapper,
  and runtime capability diagnostics;
- CPU transport/oracle functions for tests, diagnostics, texture building, and
  cache support;
- validation smoke/parity helpers.

Consumer-facing API inventory to evaluate before freezing exact names:

The current concrete sketch for this inventory is
[Algorithm32 Primary Facade API Draft](api-facade-draft.md). The inventory
below remains the requirements view; the draft is the provisional
caller-facing TypeScript-shaped surface.

- Configured Algorithm32 facade instance:
  construct one object per independent simulation window from public Sun,
  atmosphere-composition, geometry, execution configuration, and shader
  runtime configuration. This
  facade reduces caller decisions by coordinating the CPU/reference algorithm
  execution class, runtime shader builder, validation, internal
  resource builders, and shared model. It must not store app-owned live
  context such as UI selection or runner state.
- Main runtime shader facade, if Algorithm32 ships the production shader
  adapter: construct the runtime pass from configured public inputs and
  execution plus shader runtime configuration; explicitly prepare or rebuild
  required shader textures outside the render frame behind awaited setup or
  awaited handle config updates; update configured inputs and consume any
  external display-conversion descriptor supplied through shader setup or the
  shader handle when screen output needs color mapping;
  synchronize source-driven scene lighting or provide an explicit app-light
  synchronization hook; resize; render a live Three scene through color/depth
  capture and fullscreen atmosphere composition; and dispose resources.
- Candidate Three runtime shader attachment method:
  `await algorithm32.setupShader({ THREE, composer, scene, camera })`,
  or the same shape without `THREE` if Algorithm32 imports `three` as a peer
  dependency. The composer is required. This method receives the caller's
  Three composer pipeline, asks the runtime shader builder to build the shader
  machinery using the facade's validated configuration, and installs the
  resulting pass. It returns a handle that owns
  `ShaderMaterial`, fullscreen-pass/render-target setup, uniform and texture
  binding, composer pass invocation, and dispose lifecycle. Awaited setup and
  awaited handle config updates own normal resource preparation so the caller
  does not need a separate
  `prepareResources` step. Algorithm32 input packets are applied to that
  handle as uniforms/textures; they are not the same thing as the Three setup
  arguments. The purpose of this shape is to
  reduce the number of Three-specific decisions and operations the caller must
  make: material flags, fullscreen geometry, render-target/depth setup,
  texture upload policy, uniform mapping, pass ordering, resize propagation,
  and disposal should be adapter-owned. It should also reduce the extra domain
  knowledge required from callers: shader packing, spectral grouping, local
  IncidentRadianceCache layout, source-path distinctions, debug uniform conventions,
  and other Algorithm32-specific binding details should stay behind the
  adapter and public packet interfaces. Long-running texture/cache builds must
  still remain explicit awaited setup/update work outside the render frame.
- Runtime shader capability and debug facade:
  preflight the selected renderer/configuration, expose hardware/software
  renderer and feature diagnostics, validate IncidentRadianceCache texture
  compatibility, select stable debug views, and fail loudly for unsupported
  source/geometry/scattering combinations.
- CPU/reference/offline facade:
  evaluate one path from configured public inputs plus `EvaluationRequest`
  when a CPU/reference/offline consumer needs spectral transport output.
- Public packet construction and preflight:
  factories, validators, canonicalizers, and fingerprints for public Sun,
  atmosphere composition, geometry, execution configuration, display
  conversion, and combined input when consumers need to
  construct or inspect packets outside the main facade. The main facade should
  still validate internally so direct preflight calls are optional.
- Display support:
  spectral-to-display conversion only for CPU/reference/offline consumers or
  renderer adapters that need RGB conversion outside the production shader
  path.
- Validation support:
  fixture checks, promoted POC parity, live-pass/CPU soft-shader parity,
  scene-packet oracle comparisons, shader readback probes, and diagnostic
  helpers as dev/test APIs only.

Local Sun calibration/resolution, calibration packet replay, and calibration
invalidation belong to the upstream local Sun configuration API. They may live
near Algorithm32 code, but they are not part of the main Algorithm32 consumer
facade because the main facade receives the already configured public `Sun`.

POC verification notes:

- Source/geometry POC exports packet factories and summaries; production should
  promote public packet construction/preflight without exposing factory-private
  shapes.
- CPU POC exports sky/segment trace functions, scene postprocessing, spectral
  display preview, and many low-level math helpers; production should expose
  generally useful pure math helpers through the pure math API namespace, expose
  only per-path evaluation and optional CPU/offline display conversion to
  normal consumers, and keep Algorithm32-specific transport helpers private or
  dev/test scoped.
- Local second-order POC exports cache config, build, key, packing, frame
  transform, and sampling helpers; production should promote build/pack/key
  behavior behind awaited shader setup/config updates, with lower-level helpers
  private or dev/test scoped.
- Three POC exports `Algorithm32AtmospherePass` with constructor, config,
  resize, scene render, atmosphere render, and dispose lifecycle methods; if
  Algorithm32 ships the renderer adapter, these lifecycle operations are
  consumer-facing adapter API. Readback helpers remain diagnostic/dev support.
- Current production-shape evidence keeps the live Three render-target plus
  `DepthTexture` path, source/geometry configuration adapters, source-driven
  Three lighting, and the CPU soft-shader oracle workflow. It discards packet
  replay as the normal renderer architecture, standalone raw-WebGL renderers
  as the target integration, and per-object atmosphere material duplication.
- Local second-order POC evidence adds a hard runtime requirement for
  fail-loud cache binding: `flat-local-second-order-atmosphere` must consume a
  validated IncidentRadianceCache texture/descriptor and must not silently
  degrade to first-order when that resource is missing or mismatched.
- The preserved POC contains the shared `Algorithm32AtmospherePass` shader
  class, GLSL body, pass modes, cache uniforms, star-field uniforms, and local
  cache builder/packing helpers. The latest live-scene wrapper behavior still
  lives in `scripts/flat/local-second-order/page/local-second-order.js` and
  `scripts/flat/local-second-order/page/subjective-scenes.js`, which import
  that POC pass and build/bind cache textures, lights, render-scale controls,
  and diagnostics around it. Production promotion must mine those script-lane
  wrappers before freezing the shader facade.
- The latest shader/lane evidence also promotes runtime capability diagnostics
  as an external support surface, because accidental software WebGL fallback
  can make a valid shader path appear to be a CPU-bound loop.

Runtime shader setup owns texture/cache preparation for app consumers. Any
runtime texture preparation must be explicit, awaitable/cancellable where
appropriate, and outside the render frame; composer pass rendering must not
hide long-running texture build work. A later texture-artifact API should be
introduced only if a concrete non-app tooling consumer requires it.

Not every family must become a separate public class or a main-facade method.
A compact facade is acceptable when the API remains small, but each outward
operation must have a clear owner, request/output contract, validation path,
failure behavior, and intended consumer tier.

Do not freeze individual function names until these families and packet shapes
are accepted.

## Explicit Non-Requirements For The First Production Contract

- Terrain asset conversion.
- App camera choreography.
- Live runner/watch state.
- Numbered artifact generation.
- Local visible solar-disc rendering.
- Ground bounce.
- Spotlight/cone source behavior.
- User-facing brightness as a primary local Sun setting after calibration.

## Open Requirements Questions

- What exact normalized context packet should calibration accept from the flat
  app?
- What non-app tooling consumers, if any, justify a separate texture-artifact
  API after the runtime shader facade owns resource preparation?
- Should the first production adapter require WebGL2 `Data3DTexture`, or must
  a 2D atlas fallback ship with the initial API?
- Which cache resolutions are production defaults versus validation fixtures?
- What tolerance policy should govern CPU/GPU image or pixel parity?
- What spectral-to-color display conversion controls, if any, should be part
  of Algorithm32 rather than app presentation state?
