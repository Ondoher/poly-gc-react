# Reconciliation Shader Design

Status: first-pass shader architecture design. This document defines how a GPU
shader product should be assembled from the accepted CPU/reference contracts
without moving transport ownership into renderer code.

## Table Of Contents

- [Orientation](#orientation)
  - [Purpose](#purpose)
  - [Design Scope](#design-scope)
  - [Design Commitments](#design-commitments)
  - [Shader Lifecycle Vocabulary](#shader-lifecycle-vocabulary)
- [Responsibility Model](#responsibility-model)
  - [Ownership Boundaries](#ownership-boundaries)
  - [Contribution And Binding Ownership Matrix](#contribution-and-binding-ownership-matrix)
  - [Responsibility Dependencies](#responsibility-dependencies)
- [Shader Product Assembly](#shader-product-assembly)
  - [Shader Setup Flow](#shader-setup-flow)
  - [Partial Shader Assemblies](#partial-shader-assemblies)
  - [Contribution Contract And Composition Rules](#contribution-contract-and-composition-rules)
  - [Shader Symbol Inventory](#shader-symbol-inventory)
  - [Shader Builder Shape](#shader-builder-shape)
  - [Initial Implementation Inventory](#initial-implementation-inventory)
- [Runtime Data And Binding](#runtime-data-and-binding)
  - [Runtime Shader Bindings](#runtime-shader-bindings)
  - [Binding Contract And Value Resolution](#binding-contract-and-value-resolution)
  - [Texture Inventory](#texture-inventory)
  - [Cache Texture And Access Assembly](#cache-texture-and-access-assembly)
  - [Cache Texture Lifecycle](#cache-texture-lifecycle)
  - [GPU Resource Preparation](#gpu-resource-preparation)
- [Lifecycle Operations](#lifecycle-operations)
  - [Setup Lifecycle](#setup-lifecycle)
  - [Runtime Quality Policy](#runtime-quality-policy)
  - [Configuration Update Lifecycle](#configuration-update-lifecycle)
  - [Runtime Render Flow](#runtime-render-flow)
  - [Pass Installation](#pass-installation)
  - [Descriptor Compatibility And Invalidation](#descriptor-compatibility-and-invalidation)
  - [Disposal And Lifecycle Cleanup](#disposal-and-lifecycle-cleanup)
- [Integration And Policy](#integration-and-policy)
  - [ThreeGateway Scene Synchronization](#threegateway-scene-synchronization)
  - [Hit Data Itemization And Routing](#hit-data-itemization-and-routing)
  - [CPU Postprocess Shader](#cpu-postprocess-shader)
  - [Shader Test Boundary](#shader-test-boundary)
  - [GPU Validation Scene Set](#gpu-validation-scene-set)
  - [Runtime Capability Model](#runtime-capability-model)
  - [Display And Composition Policy](#display-and-composition-policy)
  - [Diagnostics And Reports](#diagnostics-and-reports)
  - [Validation Policy](#validation-policy)
  - [Open Decisions](#open-decisions)
  - [Focused Design Backlog](#focused-design-backlog)

## Orientation

### Purpose


The GPU path should implement the accepted CPU reference behavior, not become
a second algorithm. Its primary purpose is to transform rendered scene pixels
into correctly atmosphere-modified output pixels. The shader may use
GPU-oriented packing, precision choices, branching choices, or resource
layouts, but each shortcut must be named, bounded, and tested against the CPU
reference for the same source, geometry, atmosphere, cache, spectral, and
display descriptors.

The design should support one source/geometry/cache profile at a time without
hard-coding the concrete profile into the shader builder. Implementation plans
choose which profile to build first; this document defines the reusable
contracts that make those choices installable and comparable.

### Design Scope


This design covers:

- assembled GPU shader products for an accepted Algorithm32 configuration;
- abstraction-owned shader contributions and runtime bindings;
- cache texture creation and cache lookup integration;
- integrated Three scene postprocess shape: live scene color plus live depth
  into an Algorithm32 atmosphere fullscreen pass;
- capability diagnostics needed to choose shader variants and GPU resources.

The focused test design lives in
[Shader Test Design](shader-test-design.md). This shader design describes how
the shader product is assembled and installed; the test design describes what
pixel transformations the installed shader must prove.

This design does not decide:

- which source/geometry/cache profile an implementation plan builds first;
- production app display policy beyond an explicit shader display mode;
- new Algorithm32 equations or physical calibration values;
- direct solar-disc camera radiance, ground bounce, reflective dome behavior,
  or other transport features not accepted by the CPU reference path.

### Design Commitments


- CPU transport remains the reference source for Algorithm32 behavior. Shader
  implementation must be descriptor-compatible with that source.
- The shader consumes descriptors, uniforms, textures, and generated source
  strings assembled from the same logical configuration used by the CPU path.
- Shader setup uses the same light source, geometry, atmosphere, incident
  radiance cache/sampler, general calculator, and color/display boundaries.
- The installable shader is assembled from abstraction-owned partial shader
  assemblies. `ShaderBuilder` coordinates, validates, assembles, binds, and
  installs those contributions; it does not rewrite their domain logic.
- Shader compilation/assembly and shader binding are separate responsibilities.
  Contributions declare what the shader needs; bindings provide and update the
  runtime values the installed shader consumes.
- Validation baselines must use validated public surfaces directly. CPU
  postprocess calls public `evaluate(...)`; setup/configuration uses already
  implemented configuration endpoints; color/display uses the existing
  Bruneton-based dome rendering adapter outside Algorithm32 transport. Do not
  call lower-level algorithm, calculator, cache, geometry, source, or
  atmosphere internals, and do not reimplement, copy, derive, or approximate
  baseline behavior in runner, adapter, comparison, or shader-support code.
- New GPU GLSL is the implementation under test, not a validation baseline.
  Any shader-specific expression must be traceable to an abstraction-owned
  contribution and compared against the direct validated baseline.
- Cache building remains source/cache/coordinator owned. For shader use, the
  cache creates its GPU cache texture through a small texture builder service
  and contributes the matching access code; shader infrastructure only binds
  and installs that cache-owned output.
- Display conversion remains outside CPU transport. The GPU path may execute a
  display conversion stage because it must produce visible pixels.
- Browser and GPU capability facts influence whether a shader product can be
  installed with the requested resource policy.

### Shader Lifecycle Vocabulary


Use these three lifecycle phases consistently:

- Setup time: the awaited operation that creates or rebuilds the installable
  shader product. It canonicalizes descriptors, gathers partial shader
  assemblies, validates compatibility, compiles/links GLSL, creates GPU
  resources, asks caches to build or bind cache textures, creates the active
  binder, and installs the pass/material. Setup time may be slow and must
  happen outside frame rendering.
- Configuration-update time: an explicit awaited update after accepted
  Algorithm32 configuration, shader policy, cache texture or cache data, geometry, light
  source, atmosphere, or display-conversion descriptors change. It may reuse
  the existing shader when fingerprints remain compatible, or rebuild/rebind
  resources when descriptors changed. It still happens outside frame rendering.
- Frame/runtime time: the repeated render-loop phase after setup is complete.
  It updates only live frame values, such as camera matrices, scene color,
  depth textures, viewport size, render target size, pixel ratio, and selected
  debug-view state. Frame/runtime time must not discover missing cache builds,
  compile new shader variants, or perform long-running resource preparation.

Binding descriptors use the corresponding update frequencies:

```text
setup
config
frame
```

Those names should be treated as lifecycle labels, not informal timing hints.
Anything marked `frame` must be cheap and safe inside the render loop.
Anything that can compile, allocate large resources, build caches, upload
large textures, or fail because a descriptor is stale belongs in setup or
configuration-update time.

## Responsibility Model

### Ownership Boundaries


`ShaderBuilder` owns GPU implementation mechanics:

- GLSL source assembly;
- contribution compatibility validation;
- shader defines and feature switches;
- binding-map creation and uniform/texture application;
- runtime installation and pass integration;
- GPU resource preparation and lifecycle cleanup;
- runtime capability preflight;
- descriptor compatibility and invalidation decisions;
- render target allocation, resize, and disposal;
- material/pass creation;
- browser/GPU capability hooks.

`ShaderBuilder` does not own:

- physical constants or atmosphere coefficients;
- geometry coordinate decisions;
- light-source calibration, source position, or source radiance;
- incident-radiance cache coordinate loops or generated cache values;
- CPU reference transport;
- external verification policy for shader output.

Shared build logic owns descriptor construction and validation. It can produce
plain shader descriptors, typed arrays, fingerprints, and source operation
descriptors. It should not create Three/WebGL
resources.

### Contribution And Binding Ownership Matrix


Each abstraction should separately own the shader-facing facts it builds or
provides, the source assemblies it emits, and the binding values it can supply
at setup/config/frame time. The builder may assemble, validate, pack, bind,
and install, but it should not become the owner of geometry, light,
atmosphere, cache, transport, or display facts.

#### Geometry

Geometry builds/provides:

- geometry descriptor fingerprints and compatibility tags;
- geometry mode facts such as `geometry:spherical-earth` or `geometry:flat`;
- ray/path coordinate-space definitions;
- path-bound and boundary classification descriptors;
- cache-access coordinate descriptors derived from geometry-owned coordinates.

Geometry emits source assemblies for:

- view-ray reconstruction from camera/depth/screen inputs;
- world/model/source coordinate transforms;
- atmosphere path and path-bound resolution;
- cache-access coordinate construction from path-integration-point facts;
- no-hit, top-boundary, ground-hit, and finite-domain classification helpers.

Geometry owns binding values for:

- geometry descriptor fingerprints;
- camera/view/projection matrices when geometry participates in ray
  reconstruction;
- inverse matrices used by shader ray reconstruction;
- camera near/far and depth interpretation parameters;
- geometry constants such as radii, origin transforms, or flat-domain
  descriptors;
- viewport/render-size values only when they affect geometry-owned ray math.

Geometry must not provide light-source radiance, atmosphere coefficients,
cache texture handles, or display conversion values.

#### Light Source

Light source builds/provides:

- source descriptor fingerprints and compatibility tags;
- source mode facts such as `light:distant-source` or `light:local-source`;
- source direction, source-relative position, distance, and angular/source
  extent descriptors;
- source radiance or incident-radiance scale descriptors;
- required incident-cache family declaration.

Light source emits source assemblies for:

- direct source sampling;
- source direction or source-relative position interpretation;
- source radiance and angular/source-extent semantics;
- source-path limit semantics;
- source visibility/light-sampling helpers.

Light source owns binding values for:

- source descriptor fingerprints;
- source direction, position, distance, or source-relative frame facts;
- source spectral radiance or incident-radiance scale;
- angular radius/source extent values;
- source mode defines when they do not require a separate contribution;
- source-driven scene-light parameters, in predefined Algorithm32/source
  units, only through the scene builder or scene synchronization boundary.

Light source may create the concrete cache family, but after creation the
cache owns cache coordinates, generated values, lookup code, cache texture
shape, and cache texture creation.

#### Atmosphere

Atmosphere builds/provides:

- atmosphere descriptor fingerprints and compatibility tags;
- atmosphere mode facts such as `atmosphere:canonical-step032`;
- medium-domain descriptors;
- density/profile descriptors;
- spectral coefficient descriptors;
- phase-function descriptors.

Atmosphere emits source assemblies for:

- medium density/profile sampling;
- scattering, absorption, and extinction coefficient lookup;
- phase-function evaluation;
- atmosphere-coordinate interpretation;
- medium sample packet construction.

Atmosphere owns binding values for:

- atmosphere descriptor fingerprints;
- bottom/top radius or altitude bounds when those are atmosphere/profile facts;
- density-profile parameters and scale heights;
- spectral scattering/absorption/extinction coefficients;
- phase-function constants;
- atmosphere-domain values consumed by geometry or transport contributions.

Atmosphere must not clip rays by itself when geometry owns the ray/path
intersection, and it must not own source radiance, cache texture handles, or
display exposure.

#### Incident Radiance Cache

Incident radiance cache builds/provides:

- cache descriptor fingerprints and compatibility tags;
- cache mode facts such as `cache:null`, `cache:distant-l2`, or
  `cache:local-l2`;
- cache logical dimensions and axis/order descriptors;
- lookup policy descriptors;
- cache texture shape, packing, format, and sampler policy;
- generated cache value version facts.

Incident radiance cache emits source assemblies for:

- incident-radiance lookup;
- cache coordinate mapping from geometry-provided cache-access facts;
- cache miss/default policy;
- texture/sampler declarations required by the cache texture shape;
- texture unpacking code that matches the cache texture packing.

Incident radiance cache owns binding values for:

- cache descriptor fingerprints;
- prepared incident-radiance texture handles or accepted null texture values;
- cache dimensions, axis order, scale/offset, and lookup policy;
- interpolation or nearest-neighbor policy;
- generated cache value version and compatibility tags;
- cache miss/fallback controls.

The cache must not decide source radiance, geometry ray bounds, atmosphere
coefficients, or non-cache GPU resources. Cache texture format, packing, and
upload data belong to the cache; `TextureBuilder` only materializes the
cache's requested texture.

#### Spectral Calculator / Transport

The calculator or transport operation descriptor builds/provides:

- transport descriptor fingerprints and compatibility tags;
- transport mode facts such as `transport:algorithm32-step032`;
- accepted operation ordering;
- loop-control descriptors tied to Algorithm32 numerical policy;
- optional incident-cache participation policy.

The calculator or transport operation descriptor emits source assemblies for:

- canonical operation ordering;
- path-radiance accumulation structure;
- transmittance and in-scattering equation helper blocks;
- required hook slots such as geometry path resolution, atmosphere sampling,
  light sampling, and optional cache lookup.

Transport owns binding values only when they are execution/numerical controls:

- path sample counts;
- source-path sample counts;
- selected integration rule tags;
- spectral channel count or loop bounds when not already supplied by the
  spectral basis descriptor;
- debug flags that alter transport diagnostics without changing domain facts.

Transport must not provide geometry transforms, light-source facts,
atmosphere coefficients, cache texture handles, or display conversion values.

#### Color / Display

Color or display conversion builds/provides:

- display descriptor fingerprints and compatibility tags;
- display mode facts such as `display:shader-output` or `display:app-hdr`;
- spectral-to-display descriptor values;
- output encoding and tone/exposure policy descriptors;
- shader-output descriptor values.

Color or display conversion emits source assemblies for:

- spectral-to-display conversion;
- exposure, tone mapping, white balance, output encoding, and debug display
  modes;
- scene color plus atmosphere composition when that policy is display-owned.

Color/display owns binding values for:

- display descriptor fingerprints;
- exposure and tone-map parameters;
- spectral-to-display matrix, weights, or lookup payloads;
- output encoding/gamma flags;
- debug display mode values;
- shader display constants.

Color/display must not affect CPU transport, source radiometry, atmosphere
profile coefficients, geometry path bounds, or cache lookup coordinates.

#### Three Gateway

`ThreeGateway` owns the API boundary between Three/WebGL/browser execution and
the Algorithm32 runtime products. It supplies render-environment facts and
runtime handles to shader setup without owning Algorithm32 physical model
facts.

`ThreeGateway` builds/provides:

- runtime descriptor fingerprints and compatibility tags;
- pass mode descriptors;
- render target, viewport, and pixel-ratio descriptors;
- scene color/depth target descriptors;
- diagnostic-output descriptors.

`ThreeGateway` emits source assemblies only for runtime scaffolding:

- pass-through vertex shader support;
- fullscreen quad varyings;
- scene color/depth texture declarations when not owned by geometry/display;
- diagnostic-output hooks that are purely runtime/debug scaffolding.

`ThreeGateway` owns binding values for:

- scene color target;
- depth texture target;
- render target and viewport size;
- device pixel ratio;
- frame index or time only when explicitly needed;
- browser/GPU capability-derived flags;
- pass mode and active debug-view plumbing;
- material/pass target handles.

`ThreeGateway` must not own physical facts. It supplies the live render
surface, browser/GPU facts, pass targets, and current frame data that other
contributions consume.

### Responsibility Dependencies


The shader product has a dependency chain. The exact implementation can split
or combine classes while it is small, but the ordering should stay stable.

Setup-time dependencies:

```text
canonical configuration/context
  -> runtime capability model
  -> abstraction descriptors and fingerprints
  -> cache build/bind readiness
  -> partial shader assemblies
  -> contribution compatibility validation
  -> shader source assembly and compile/link
  -> GPU resource preparation
  -> runtime binding map
  -> pass installation
  -> setup diagnostics
  -> frame rendering allowed
```

Configuration-update dependencies:

```text
accepted next configuration/descriptors
  -> descriptor compatibility and invalidation decision
  -> reuse, rebind, rebuild, or reject
  -> cache texture refresh and non-cache resource refresh if required
  -> binding map refresh
  -> pass/resource diagnostics refresh
  -> frame rendering resumes
```

Frame/runtime dependencies:

```text
installed pass is valid
  -> frame values are available
  -> binder applies frame values
  -> composer invokes installed pass
  -> shader samples bound resources
  -> display/composition writes output
```

The dependency rules are:

- Capability facts come before final resource policy, shader variant selection,
  and texture packing. A device that cannot support the requested resources
  should reject at setup/configuration-update time.
- Canonical descriptors come before partial assemblies. Contributions must
  describe the active light source, geometry, atmosphere, cache, calculator,
  and display policy, not private model internals.
- Cache build or bind readiness comes before cache texture creation. A cache
  texture cannot be created or bound until the selected cache has compatible
  generated values or an accepted null/empty policy.
- Partial assemblies come before shader source assembly. The builder should
  assemble the shader from owner-provided snippets and hooks rather than
  branching across concrete domain implementations.
- Contribution compatibility validation comes before GLSL compilation.
  Descriptor mismatches, duplicate symbols, missing hooks, incompatible cache
  modes, and unsupported contribution combinations should fail as domain
  errors before compiler errors.
- GPU resource preparation comes after capability and descriptor validation.
  Cache textures are created by the cache through `TextureBuilder`; the
  resource preparer owns the remaining render targets, depth textures, and
  non-cache GPU resources.
- Binding map creation comes after contributions and resources are known. The
  binder needs declared requirements plus actual material/uniform/texture
  targets.
- Pass installation comes after a compiled shader, prepared resources, and an
  initialized binder exist. The app composer should not receive a half-valid
  Algorithm32 pass.
- Frame/runtime updates come last. They may update cheap live values only and
  must assume setup/configuration validation already succeeded.
- Diagnostics are emitted at every boundary. They do not block ordering unless
  a required diagnostic packet is missing for an accepted evidence claim.

## Shader Product Assembly

### Shader Setup Flow


The expected setup pipeline is:

```text
configuration inputs
  -> canonical CPU/reference context
  -> shader descriptor builder
  -> abstraction-owned partial shader assemblies
  -> descriptor compatibility checks and fingerprints
  -> cache build or cache binding descriptors
  -> shader descriptor and resource formation
  -> shader binding-map creation
  -> ShaderBuilder resource creation
  -> setup diagnostics
```

The shader descriptor should include:

- spectral basis and channel order;
- atmosphere profile constants and unit conventions;
- geometry mode and ray reconstruction policy;
- light-source mode and source facts;
- execution controls such as sample counts and integration rule;
- incident-radiance cache mode, dimensions, lookup policy, and data
  semantics;
- display conversion mode used by the shader output;
- shader precision, texture format, and feature defines;
- fingerprints for all above inputs.

Descriptor construction should fail loudly when a required value is absent or
when descriptors are incompatible. Runtime rendering should log unexpected
boundary conditions and continue only when the failure policy says a bounded
empty/zero contribution is acceptable.

### Partial Shader Assemblies


The installable shader should be built from partial assemblies contributed by
the same abstractions that feed CPU transport. This keeps the shader modular
without letting the shader builder learn private geometry, atmosphere, light,
cache, or display rules.

Each contribution is descriptor-backed and fingerprinted. For the first
implementation, a contribution should include only named provided/required capabilities,
defines, uniform/texture descriptors, GLSL source blocks, main-hook source
blocks, binding requirements, and optional diagnostics. Contributions should
be plain assembly objects returned by the owning abstraction, not separate
assembly classes and not live Three/WebGL resources. The compact record shape
is defined in [Contribution Contract And Composition Rules](#contribution-contract-and-composition-rules).
If an abstraction has multiple internal assembly choices, that abstraction
classifies/selects the correct assembly object for the active descriptor.
`ShaderBuilder` should not manage cross-owner variant selection; it receives
the owner-selected assembly objects, validates their symbols and compatibility,
and assembles them.

The abstraction contributions should line up this way:

- `LightSourceModel`: source mode defines, source facts/uniforms, source
  sampling GLSL, source path limit semantics, and required incident-cache
  family.
- `GeometryModel`: ray reconstruction policy, world/model/source coordinate
  transforms, path-bound resolution GLSL, depth interpretation, and geometry
  uniforms.
- `AtmosphereModel`: density/coefficient sampling GLSL, phase functions,
  atmosphere constants, and medium-domain descriptors.
- `IncidentRadianceCache`: lookup GLSL, cache coordinate mapping, payload
  descriptor, texture/sampler declarations, dimensions, and miss/fallback
  policy.
- `SpectralCalculator` or transport operation descriptor: canonical operation
  ordering, named equation helpers, spectral accumulation vocabulary, and
  loop-control descriptors.
- `Color` / display conversion: spectral-to-display GLSL, exposure/tone/debug
  display uniforms, and display output packing.

The shader builder assembles named slots in a deterministic order:

```text
precision/header
defines
uniform declarations
texture declarations
type/struct declarations
geometry functions
atmosphere functions
light-source functions
cache lookup functions
transport/equation functions
display conversion functions
main hooks
main()
```

The builder should reject duplicate provided capability names, missing
required names, incompatible descriptor fingerprints, mismatched spectral
channel layouts, or cache/source combinations that cannot be bound. This
validation happens before shader compilation so failures are domain diagnostics
first and GLSL compiler errors only second.

Partial assemblies do not remove the need for an integrated shader design. The
builder still owns the final source shape, resource binding, pass lifecycle,
and diagnostics. The difference is that the final shader is composed from
owner-provided pieces instead of a monolithic builder that hard-codes every
source/geometry/cache combination.

### Contribution Contract And Composition Rules


The contribution contract is the seam between domain-owned shader knowledge
and the final installable shader. It should be strict enough that invalid
combinations fail before GLSL compilation, but small enough that each
abstraction can contribute only the shader facts it owns.

Contributions should be plain data records with source text fragments and
metadata. They should not hold live GPU objects, Three objects, closures that
reach into private model state, or mutable setup state. Any complex contribution
shape belongs in `shader/types.d.ts`.

The first implementation should start with a compact record:

```ts
type ShaderContribution = {
    id: string;
    owner: "lightSource" | "geometry" | "atmosphere" | "cache" | "calculator" | "color" | "runtime";
    descriptorFingerprint: string;
    compatibilityTags: readonly string[];
    provides: readonly string[];
    requires: readonly string[];
    defines: readonly string[];
    uniforms: readonly ShaderUniformDescriptor[];
    textures: readonly ShaderTextureDescriptor[];
    functions: readonly ShaderSourceBlock[];
    mainHooks: readonly ShaderSourceBlock[];
    bindingRequirements: readonly ShaderBindingRequirement[];
    diagnostics?: ShaderContributionDiagnostics;
};

type ShaderSourceBlock = {
    id: string;
    slot: string;
    order: number;
    code: string;
};
```

The contribution registry built during setup should answer four questions:

```text
Which named capabilities are provided?
Which named capabilities are required?
Which bindings must exist at setup, config, or frame time?
Which descriptors and compatibility tags make this contribution valid?
```

Initial composition rules:

- `provides` names are globally unique unless the contribution explicitly
  declares an accepted replacement in a later design revision. For now,
  accidental duplicate provided names reject the assembly.
- Every `requires` name must appear in another contribution's `provides` list,
  or in a known runtime/system provider list such as `runtime.depthTexture`.
- Contributions should depend on named capabilities, not on concrete class
  names. For example, transport can require
  `geometry.resolveViewRay`, not `SphericalEarthGeometry`.
- Owner responsibilities remain intact. Geometry contributions provide spatial
  transforms and ray/path facts; atmosphere contributions provide medium
  sampling and phase facts; light-source contributions provide lighting facts;
  cache contributions provide incident-radiance lookup; calculator/transport
  contributions provide operation ordering; color contributions provide
  display conversion.
- A contribution may require another owner, but it must not implement that
  owner's work as a fallback. If cache lookup needs a geometry-owned cache
  coordinate function, the cache contribution declares that requirement.
- `mainHooks` are ordered only inside named string slots. The builder owns the
  final `main()` skeleton and invokes slots such as ray reconstruction, path
  resolution, transport evaluation, scene composition, and final encoding.
- `functions` should be GLSL helper blocks whenever possible. Runtime data
  enters through binding requirements, not through string interpolation of ad
  hoc constants.
- Compatibility tags should be domain-level facts, such as
  `geometry:spherical-earth`, `light:distant-source`, `cache:distant-l2`, or
  `spectral:step032-15-channel`. They should not encode private implementation
  paths.
- Descriptor fingerprints bind the contribution to the CPU/reference
  descriptor that produced it. A contribution whose fingerprint does not match
  the active descriptor is stale and must be rejected or regenerated.
- GLSL source assembly is deterministic: sort contributions by owner group,
  then source blocks by declared slot/order, then by stable `id` where order is
  otherwise equal. Deterministic ordering makes source hashes and diagnostics
  useful.
- The builder emits a composition report before compile/link. That report
  should list accepted contributions, rejected contributions, provided
  names, resolved requirements, unresolved requirements, collision checks,
  binding requirements, compatibility tags, and source hashes.
- Do not introduce richer `ShaderSymbol`, `ShaderDependency`,
  `ShaderFunctionContribution`, or `ShaderMainHook` objects until the compact
  record becomes ambiguous in real implementation. Those richer types remain
  the likely production direction, not the initial implementation starting
  point.

The compact `provides` and `requires` strings are normalized into the shader
symbol inventory during validation. Assemblies do not need rich symbol objects,
but the builder should still maintain a structured inventory for diagnostics.

Useful first-pass hook slots:

```text
declareTypes
declareConstants
declareHelpers
reconstructRay
resolvePathBounds
sampleAtmosphere
sampleLightSource
lookupIncidentRadiance
evaluateTransport
composeSceneColor
encodeOutput
diagnosticOutput
```

These hook names are intentionally operation-oriented. They give the builder a
stable assembly skeleton without asking it to know which concrete geometry,
source, atmosphere, or cache implementation is active.

Examples:

```text
Spherical geometry contribution:
  provides geometry.reconstructViewRay
  provides geometry.resolveAtmospherePath
  requires runtime.depthTexture
  requires runtime.inverseProjectionMatrix

Distant light contribution:
  provides light.sampleDirectRadiance
  provides light.sourceDirection
  requires atmosphere.sourcePathTransmittance helper

Distant L2 cache contribution:
  provides cache.lookupIncidentRadiance
  requires geometry.cacheAccessCoordinate
  requires cache.incidentRadianceTexture binding

Transport contribution:
  provides transport.evaluatePathRadiance
  requires geometry.resolveAtmospherePath
  requires atmosphere.sampleMedium
  requires light.sampleDirectRadiance
  optionally requires cache.lookupIncidentRadiance
```

A simple concrete assembly example is spherical geometry view-ray
reconstruction. Geometry owns the capability, but it still declares the frame
values and runtime texture it needs:

```js
const sphericalGeometryContribution = {
    id: "geometry.spherical.view-ray",
    owner: "geometry",
    descriptorFingerprint: "geometry:spherical-earth:step032:abc123",
    compatibilityTags: [
        "geometry:spherical-earth",
        "ray-reconstruction:depth-buffer"
    ],

    provides: [
        "geometry.reconstructViewRay"
    ],

    requires: [
        "runtime.uv",
        "runtime.depthTexture",
        "geometry.inverseProjectionMatrix",
        "geometry.inverseViewMatrix",
        "geometry.cameraWorldPosition"
    ],

    defines: [],

    uniforms: [
        {
            name: "uInverseProjectionMatrix",
            type: "mat4",
            valueKey: "geometry.inverseProjectionMatrix"
        },
        {
            name: "uInverseViewMatrix",
            type: "mat4",
            valueKey: "geometry.inverseViewMatrix"
        },
        {
            name: "uCameraWorldPosition",
            type: "vec3",
            valueKey: "geometry.cameraWorldPosition"
        }
    ],

    textures: [
        {
            name: "uDepthTexture",
            type: "sampler2D",
            valueKey: "runtime.depthTexture"
        }
    ],

    functions: [
        {
            id: "geometry.reconstructViewRay.function",
            slot: "geometryFunctions",
            order: 10,
            code: `
vec3 reconstructViewPosition(vec2 uv, float depth) {
    vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    vec4 view = uInverseProjectionMatrix * clip;
    return view.xyz / view.w;
}

Ray reconstructViewRay(vec2 uv) {
    float depth = texture(uDepthTexture, uv).r;
    vec3 viewPosition = reconstructViewPosition(uv, depth);
    vec3 worldDirection = normalize((uInverseViewMatrix * vec4(viewPosition, 0.0)).xyz);
    return Ray(uCameraWorldPosition, worldDirection);
}
`
        }
    ],

    mainHooks: [
        {
            id: "geometry.reconstructViewRay.main",
            slot: "reconstructRay",
            order: 10,
            code: `
Ray viewRay = reconstructViewRay(vUv);
`
        }
    ],

    bindingRequirements: [
        {
            id: "geometry.inverseProjectionMatrix",
            owner: "geometry",
            kind: "uniform",
            updateFrequency: "frame",
            targetName: "uInverseProjectionMatrix",
            valueKey: "geometry.inverseProjectionMatrix",
            valueType: "mat4",
            required: true
        },
        {
            id: "geometry.inverseViewMatrix",
            owner: "geometry",
            kind: "uniform",
            updateFrequency: "frame",
            targetName: "uInverseViewMatrix",
            valueKey: "geometry.inverseViewMatrix",
            valueType: "mat4",
            required: true
        },
        {
            id: "geometry.cameraWorldPosition",
            owner: "geometry",
            kind: "uniform",
            updateFrequency: "frame",
            targetName: "uCameraWorldPosition",
            valueKey: "geometry.cameraWorldPosition",
            valueType: "vec3",
            required: true
        },
        {
            id: "runtime.depthTexture",
            owner: "runtime",
            kind: "texture",
            updateFrequency: "frame",
            targetName: "uDepthTexture",
            valueKey: "runtime.depthTexture",
            valueType: "sampler2D",
            required: true
        }
    ]
};
```

That assembly provides one capability, requires named runtime and geometry
values, emits helper GLSL plus one `reconstructRay` hook, and declares every
binding the binder must satisfy. If the contribution forgot
`geometry.cameraWorldPosition`, the assembly validator should catch the
missing required value before GLSL compilation.

The optional cache dependency deserves special handling. The transport
contribution can support a null/absent incident-radiance path, but the selected
cache mode must be explicit in the descriptor. A missing cache contribution is
valid only when the active descriptor says the incident cache mode is `null` or
the selected algorithm variant excludes incident sampling. It must not happen
because a cache failed to build or bind.

Rejected composition examples:

- `geometry:spherical-earth` contribution with `cache:local-flat-l2` unless a
  bridge contribution explicitly provides the required cache access mapping.
- Two owners both providing `sampleAtmosphere`.
- A cache contribution requiring `sampler3D` when the runtime capability model
  rejected 3D textures and no accepted atlas fallback contribution exists.
- A light-source contribution whose descriptor fingerprint was produced for a
  different source position or radiance packet.
- A display contribution whose spectral-channel descriptor does not match the
  transport contribution's spectral output.

### Shader Symbol Inventory


The shader builder should keep an inventory of symbols required by the main
shader skeleton and symbols provided by assemblies. This gives useful
diagnostics without forcing each contribution to carry a rich dependency model.

The compact contribution record remains:

```text
provides: readonly string[]
requires: readonly string[]
```

The builder normalizes those strings into an inventory:

```ts
type ShaderSymbolKind =
    "function" |
    "uniform" |
    "texture" |
    "hook" |
    "define" |
    "type" |
    "capability";

type ShaderRequiredSymbol = {
    name: string;
    kind: ShaderSymbolKind;
    requiredBy: string;
    optional?: boolean;
};

type ShaderProvidedSymbol = {
    name: string;
    kind: ShaderSymbolKind;
    providedBy: string;
};

type ShaderSymbolInventory = {
    required: readonly ShaderRequiredSymbol[];
    provided: readonly ShaderProvidedSymbol[];
};
```

The main shader skeleton declares its required symbols independently of the
assemblies:

```js
const mainShaderRequirements = [
    { name: "type.Ray", kind: "type", requiredBy: "main" },
    { name: "geometry.reconstructViewRay", kind: "function", requiredBy: "main" },
    { name: "geometry.resolvePathBounds", kind: "function", requiredBy: "main" },
    { name: "atmosphere.sampleMedium", kind: "function", requiredBy: "main" },
    { name: "light.sampleDirectRadiance", kind: "function", requiredBy: "main" },
    { name: "transport.evaluatePathRadiance", kind: "function", requiredBy: "main" },
    { name: "display.composeOutput", kind: "function", requiredBy: "main" }
];
```

Assembly `provides` values are normalized by convention. Initially, prefix
rules are enough:

```text
type.* -> type
geometry.* -> function or capability, depending on declaration site
atmosphere.* -> function or capability
light.* -> function or capability
cache.* -> function or capability
transport.* -> function or capability
display.* -> function or capability
u* uniform descriptor names -> uniform
texture descriptor names -> texture
hook slot ids -> hook
define names -> define
```

The inventory validation should run before source assembly:

```text
collect main shader required symbols
collect contribution required symbols
collect contribution provided symbols
collect binding-provided uniforms/textures/defines
  -> required symbol missing: error
  -> required symbol provided more than once: error unless explicitly allowed
  -> provided symbol not required: warning
  -> optional required symbol missing: warning or accepted null policy
  -> duplicate unused provided symbol: warning first, error if it creates GLSL collision risk
```

This inventory is also where the builder can produce a human-readable
composition report:

```text
required:
  geometry.reconstructViewRay <- provided by geometry.spherical.view-ray
  atmosphere.sampleMedium <- provided by atmosphere.step032.medium
  cache.lookupIncidentRadiance <- optional, absent by descriptor cache:null

unused provided:
  geometry.debugClassifyBoundary <- provided by geometry.spherical.debug

missing:
  display.composeOutput <- no provider
```

The warning on unused provided symbols is intentional. A contribution may
temporarily provide a debug helper or future hook that is not used by the main
shader. That should be visible but not necessarily fatal. Missing required
symbols should be fatal before GLSL compilation. Duplicate providers are also
fatal unless an assembly slot explicitly allows multiple providers.

### Shader Builder Shape


The first implementation should keep the builder narrow:

```text
ShaderDescriptorBuilder
Algorithm32ShaderAssembler
TextureBuilder
ShaderBinder
ShaderPassInstaller
ShaderResourcePreparer
ShaderCapabilityReporter
ShaderCompatibilityValidator
ShaderSceneAdapter
ShaderDiagnosticsReporter
```

The descriptor builder creates plain descriptors and fingerprints. The generic
assembler consumes those descriptors plus the abstraction-owned shader
contributions and produces a runnable GPU pass source without naming concrete
source/geometry profiles. `TextureBuilder` is a small mechanical
helper used by cache implementations when they create cache textures from
cache-owned dimensions and data.
`ShaderBinder` owns the active runtime binding map and applies setup,
configuration, and per-frame values to the installed pass. Diagnostics
reporters serialize capability, compile/link, resource, binding, and
selected-pixel facts into setup diagnostics.
Installation, resource preparation, capability reporting, compatibility
validation, and scene adaptation may start as small collaborators or methods
inside the first builder, but the design treats them as separate
responsibility domains so they can split into one-class modules as soon as
they gain real behavior.
New source/geometry/cache profiles should be sibling descriptor/contribution
sets, not branchy extensions that make one profile-specific builder carry
another profile's assumptions.

### Initial Implementation Inventory


These files/classes are the initial implementation inventory implied by the
shader design. Planning documents can reference this inventory when assigning
work, but schedule, sequencing, goals, and verification policy live outside
this design.

- `scripts/flat/reconciliation/POC/src/shader/types.d.ts`
- `scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderDescriptorBuilder.js`
- `scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js`
- `scripts/flat/reconciliation/POC/src/shader/Algorithm32ShaderAssembler.js`
- `scripts/flat/reconciliation/POC/src/shader/TextureBuilder.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderBinder.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderPassInstaller.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderResourcePreparer.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderCapabilityReporter.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderCompatibilityValidator.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderSceneAdapter.js`
- `scripts/flat/reconciliation/POC/src/shader/ShaderDiagnosticsReporter.js`
- `scripts/flat/reconciliation/POC/src/soft-shader/types.d.ts`
- `scripts/flat/reconciliation/POC/src/soft-shader/CpuPostprocessSoftShader.js`
- `scripts/flat/reconciliation/POC/src/scenes/types.d.ts`
- `scripts/flat/reconciliation/POC/src/scenes/shader-scene-inventory.json`
- `scripts/flat/reconciliation/POC/src/scenes/ShaderSceneRegistry.js`
- `scripts/flat/reconciliation/POC/src/comparison/types.d.ts`
- `scripts/flat/reconciliation/POC/src/comparison/ShaderObjectiveComparator.js`
- `scripts/flat/reconciliation/POC/src/browser/types.d.ts`
- `scripts/flat/reconciliation/POC/src/browser/BrowserShaderJobRunner.js`

The exact file list can change during implementation, but complex descriptors,
records, and shader output packets must live in ambient `types.d.ts` files and
runtime classes should stay one class per file with a single default export.
Ambient type declarations are folder-local: each folder owns a `types.d.ts`
for its complex packets rather than relying on one central shader type file.

The CPU postprocess soft-shader lives in a folder parallel to the GPU shader
folder. In this inventory, `soft-shader/` is the CPU-side sibling to
`shader/`, while `comparison/` owns comparison logic and `browser/` owns
browser-runner job helpers.

Scene descriptors are identified through an inventory string. The inventory may
be a JSON file because it can carry useful metadata about each scene, but that
string is expected to become the locator for executable/code scene modules as
the implementation grows. JSON inventory data names and classifies scenes; code
modules provide scene construction when behavior is needed.

## Runtime Data And Binding

### Runtime Shader Bindings


Shader assembly answers which program should exist. Shader binding answers
which live runtime values that program receives and how those values are kept
current.

Partial shader assemblies declare binding requirements. The shader builder
creates the material/pass/resources and constructs an active `ShaderBinder`.
The binder owns the runtime binding map and applies values to the installed
shader. It is not merely a serialized plan; it may call Three/WebGL update
methods such as uniform `.copy()`, `.set()`, `.fromArray()`, texture
assignment, sampler setup, and resource refresh.

The compact binding requirement shape is defined in
[Binding Contract And Value Resolution](#binding-contract-and-value-resolution).
The important design point is that contributions declare requirements, owner
value providers supply values, and the binder turns resolved values into
active material/pass/resource updates.

The binder should be able to validate, apply, update, and report diagnostics
for the active binding map. It should reject missing values, stale descriptor
fingerprints, unsupported texture formats, mismatched spectral layouts,
required-but-unbound cache textures, and runtime values whose update frequency
does not match their owner.

Typical bindings by owner:

- `GeometryModel`: camera matrices, inverse projection/view matrices, viewport
  size, depth texture, camera near/far, geometry mode uniforms, world/model
  transforms, and ray reconstruction inputs.
- `LightSourceModel`: source direction or position, source radiance/spectral
  scale, angular radius/source extent, source mode flags, and source path
  facts that are fixed for the installed configuration.
- `AtmosphereModel`: bottom/top radii or altitude bounds, density parameters,
  scale heights, scattering/absorption coefficients, phase-function constants,
  and medium-domain facts.
- `IncidentRadianceCache`: incident-radiance texture handles, cache
  dimensions, lookup scale/offset values, interpolation or nearest-neighbor
  policy, cache descriptor fingerprint/version, and miss/fallback controls.
- `Color` / display conversion: exposure, tone-map mode, spectral-to-display
  matrix or channel weights, output encoding, and debug display mode.
- `ThreeGateway`: scene color texture, depth texture, render target size, pixel
  ratio, pass mode, frame index when needed, and browser capability-derived
  flags.

Bindings have different lifetimes:

```text
setup:
  atmosphere coefficients
  spectral basis
  cache texture dimensions
  shader mode defines

config:
  light-source descriptor
  geometry descriptor
  cache texture or cache data
  display conversion descriptor

frame:
  camera matrices
  scene color texture
  depth texture
  viewport/render size
```

The binder is the right home for this lifecycle because it prevents domain
abstractions from touching WebGL and prevents the shader builder from becoming
scattered one-off uniform-setting code. Contributions declare what is needed;
the binder provides the actual values to the installed shader.

### Binding Contract And Value Resolution


The initial binding contract should stay as small as the compact contribution
contract. A contribution declares that the installed shader needs a value. The
binder resolves that requirement from a value provider and applies it to the
actual Three/WebGL target.

First-pass binding requirement:

```ts
type ShaderBindingRequirement = {
    id: string;
    owner: "lightSource" | "geometry" | "atmosphere" | "cache" | "color" | "runtime";
    kind: "uniform" | "texture" | "define" | "frameValue";
    updateFrequency: "setup" | "config" | "frame";
    targetName: string;
    valueKey: string;
    valueType: string;
    required: boolean;
    descriptorFingerprint?: string;
};
```

The resolution path is:

```text
ShaderBindingRequirement.valueKey
  -> ShaderBindingValueProvider
  -> ShaderBindingValue
  -> ShaderBinder.apply(...)
  -> installed material/pass/resource target
```

For the first implementation, a value provider can be a simple owner-keyed
packet:

```ts
type ShaderBindingValueProvider = {
    owner: string;
    descriptorFingerprint: string;
    values: Readonly<Record<string, ShaderBindingValue>>;
};

type ShaderBindingValue = {
    valueType: string;
    updateFrequency: "setup" | "config" | "frame";
    value: unknown;
};
```

Value providers should be created by the same owner that declares or owns the
facts:

- `GeometryModel`: geometry descriptor values and frame camera/depth values.
- `LightSourceModel`: source direction/position/radiance values.
- `AtmosphereModel`: medium/profile coefficients and phase constants.
- `IncidentRadianceCache`: texture handles, dimensions, lookup metadata, and
  cache descriptor values.
- `Color`: display conversion, exposure, tone, encoding, and debug values.
- `ThreeGateway`: scene color/depth targets, viewport, pixel ratio, frame index,
  and capability-derived values.

The binder should resolve requirements in this order:

```text
collect contribution binding requirements
  -> collect owner value providers
  -> verify provider descriptor fingerprints
  -> resolve required value keys
  -> verify kind/valueType/updateFrequency
  -> create active binding entries
  -> apply setup bindings
  -> apply config bindings when descriptors change
  -> apply frame bindings during render
```

Missing required values reject setup or configuration update. Missing optional
values use only an explicit default/null policy declared by the binding
requirement or owning contribution. The binder must not silently invent
physics, cache, geometry, or display values.

Texture bindings are different from uniform bindings:

- a texture binding requires a prepared GPU resource or accepted null texture;
- texture dimensions and descriptor fingerprints are part of compatibility;
- texture upload/rebuild belongs to resource preparation, not binding;
- binding assigns the prepared texture to the material/pass and reports the
  active texture descriptor.

Define bindings are setup/config values, not frame values. If a define changes,
the shader variant may need to be rebuilt. The binder can report the requested
change, but the compatibility/invalidation layer decides whether to reuse,
rebind, rebuild, or reject.

Frame bindings must be cheap and local:

- camera/view/projection matrices;
- scene color target;
- depth texture target;
- viewport/render target size;
- pixel ratio;
- selected debug value when it does not require a new shader variant.

Frame bindings must not:

- build or rebuild caches;
- allocate large textures or render targets;
- compile or link shader programs;
- upload large cache value arrays;
- change descriptor fingerprints;
- discover that a required setup/config binding is absent.

The binding report should include:

- every requirement and whether it resolved;
- the provider owner and descriptor fingerprint used for each value;
- setup/config/frame grouping;
- missing optional values and selected defaults;
- stale fingerprints;
- texture descriptor summaries;
- any rejected frame-only update that tried to perform setup/config work.

Binding fingerprints must include a stable hash used for compatibility and
reuse decisions. Human-readable JSON snapshots can be added later as diagnostic
support, but they are not required for the first shader POC.

### Texture Inventory


This inventory names the texture resources the installed shader product may
consume or create. It records what each texture means and which abstraction
owns that meaning. Cache textures are created by the cache through
`TextureBuilder`; non-cache GPU object creation remains a
`ShaderResourcePreparer` concern, and sampler assignment belongs to
`ShaderBinder`.

| Texture | Required | Meaning | Meaning Owner | GPU Resource Owner | Binding Owner |
| --- | --- | --- | --- | --- | --- |
| Scene color texture | Required for integrated scene composition | The rendered Three scene color before the Algorithm32 atmosphere pass is applied. | `ThreeGateway` / app render pipeline | `ThreeGateway` when app-supplied; `ShaderResourcePreparer` only for shader-owned intermediate targets | `ShaderBinder` |
| Depth texture | Required when ray reconstruction depends on scene depth | Per-pixel scene depth used to reconstruct view rays and determine where atmosphere composition begins or ends. | `ThreeGateway` supplies the texture; `GeometryModel` owns depth interpretation and ray reconstruction semantics | `ThreeGateway` when app-supplied; `ShaderResourcePreparer` only for shader-owned depth targets | `ShaderBinder` |
| Incident-radiance cache texture | Required when the selected algorithm variant uses incident-radiance cache sampling | GPU representation of `IncidentRadianceCache` values, dimensions, coordinate semantics, spectral layout, and lookup policy. | `IncidentRadianceCache` | `IncidentRadianceCache`, using `TextureBuilder` | `ShaderBinder` |
| Display lookup texture | Conditional | Optional lookup payload for spectral-to-display, tone, exposure, or output encoding policy when that policy is texture-backed. | Color/display owner | `ShaderResourcePreparer` | `ShaderBinder` |
| Atmosphere lookup texture | Conditional | Optional precomputed atmosphere/profile lookup payload if a concrete atmosphere contribution chooses a texture-backed representation. | `AtmosphereModel` | `ShaderResourcePreparer` | `ShaderBinder` |
| Final/render target texture | Required when the shader owns an intermediate or final pass target | The pass output target used by the composer after atmosphere composition. This is a render pipeline resource, not Algorithm32 physical data. | `ThreeGateway` / pass installation policy | `ShaderResourcePreparer` for shader-owned targets; app otherwise | `ShaderPassInstaller` / `ShaderBinder` where uniforms are involved |

The incident-radiance cache texture is the only texture currently given a
dedicated lifecycle below because it is an alternate GPU representation of a
domain cache. Scene color, depth, final targets, and optional display/profile
lookup textures are still important, but they are pass, geometry, display, or
atmosphere resources rather than cache representations.

### Cache Texture And Access Assembly


The shader consumes incident radiance through cache-owned texture and access
assembly. The cache remains the source-shaped owner of:

- coordinate generator;
- coordinate keying;
- generated value storage;
- CPU sampler;
- logical dimensions and lookup metadata;
- cache texture creation through `TextureBuilder`;
- cache-owned shader contribution for texture declarations, unpacking, lookup
  code, coordinate requirements, and binding requirements.

The cache owns cache texture and access assembly because those two facts must
not drift apart. The shape of the cache determines:

- sampler type;
- texture dimensions and packing;
- spectral channel unpacking;
- interpolation, clamp, and miss behavior;
- GLSL lookup function;
- required geometry/source coordinate mapping.

The cache is its own abstraction. The light source may create the concrete
cache family, but the cache contribution is not a hidden light-source detail
and not a shader-builder decision. The shader builder consumes the cache's
texture handle, binding requirement, and access contribution, validates them
against the selected light-source and geometry descriptors, and assembles the
provided code into the final shader.

Each cache texture should preserve the accepted CPU configuration and lookup
semantics for its active cache family. Alternative texture packings, such as a
2D atlas or 3D texture, are cache implementation policies. If a packing
changes, the cache must also provide matching access assembly.

### Cache Texture Lifecycle


A cache texture is the GPU representation of an `IncidentRadianceCache`. It is
not an independent source of truth. The cache owns coordinate meaning,
dimensions, generated values, units, channel layout, lookup semantics, and
descriptor fingerprints. The texture exists only so the shader can sample that
logical cache on the GPU.

Cache texture ownership rules:

- `IncidentRadianceCache` owns the logical cache descriptor, generated values,
  lookup metadata, cache texture construction call, shader lookup
  contribution, and sampler requirements;
- `TextureBuilder` is a small mechanical helper that creates a GPU texture
  representation from dimensions, required dimensionality, sampler policy, and
  data supplied by the cache. It may choose the concrete available format,
  packing, texture kind, or atlas shape needed for runtime capabilities, but
  it must return the low-level texture access contribution required to read
  that representation correctly. That contribution may be a generated global
  helper function, including a helper generated for one specific texture
  instance when packing, atlas placement, channel layout, sampler binding, or
  dimensionality requires it. The access contribution must report the function
  name/call target that the cache-owned lookup assembly calls with resolved
  indexes;
- `IncidentRadianceCache` chooses when to create, refresh, reuse, or reject
  the concrete GPU cache texture because only the cache knows whether the
  texture still represents its current values and shape;
- `ShaderBinder` binds the prepared cache texture to the cache sampler uniform;
- the installed shader handle owns and disposes cache textures created for that
  handle;
- if the logical cache is stale, the cache texture is stale.

Setup-time cache texture flow:

```text
IncidentRadianceCache descriptor + values
  -> cache calls TextureBuilder with dimensions, dimensionality, sampler policy, data
  -> cache-owned GPU texture plus TextureBuilder low-level access contribution
  -> cache contribution texture requirement
  -> capability and descriptor validation
  -> ShaderBinder applies cache sampler binding
  -> installed handle records cache texture ownership
```

During setup:

- light source may create or name the concrete cache family, but the cache owns
  the generated values and cache texture creation;
- cache contributes coordinate semantics, logical dimensions, spectral channel
  layout, units, lookup policy, miss/fallback policy, descriptor fingerprints,
  and sampler requirements;
- geometry contributes any cache-access coordinate mapping required by the
  cache lookup contribution;
- `ShaderCompatibilityValidator` checks that cache texture requirements match
  the active source, geometry, atmosphere, spectral basis, cache descriptor,
  packing policy, and runtime capabilities;
- cache calls `TextureBuilder` to create the selected `DataTexture`,
  `Data3DTexture`, or atlas texture using dimensions and data the cache owns;
- `TextureBuilder` returns the concrete texture handle, format/packing facts,
  and low-level access contribution for the chosen representation, usually a
  generated global fetch helper function, including the function name/call
  target to invoke for that representation. The helper may be specific to the
  created texture when the chosen packing/layout requires a texture-specific
  function;
- cache calls or composes the `TextureBuilder` access helper from its
  cache-owned lookup assembly, adding coordinate semantics, index resolution,
  bounds/miss behavior, units, and logical lookup function names;
- `ShaderBinder` assigns the prepared cache texture to the shader sampler used
  by cache lookup code.

Configuration-update cache texture flow:

```text
next cache descriptor + values
  -> cache texture compatibility classification
  -> cache reuses, refreshes upload, recreates texture through TextureBuilder, or rejects
  -> update cache sampler binding
  -> update installed handle ownership records
```

During configuration update:

- descriptor-identical cache textures may be reused;
- same texture shape/format/packing with changed generated values may refresh
  upload in place when the cache chooses that policy and Three/WebGL permits
  it;
- cache dimension, spectral layout, texture kind, packing policy, coordinate
  mapping, source, geometry, atmosphere, or spectral-basis changes require
  cache texture recreation, and may require shader source rebuild when lookup
  declarations or `TextureBuilder` low-level access contribution change;
- incompatible cache fingerprints reject the update before mutating the prior
  valid cache texture state.

Frame-time cache texture flow:

```text
installed cache texture binding
  -> shader cache lookup samples already-valid texture
```

Frame/runtime work must not build caches, allocate cache textures, upload large
cache value arrays, change cache texture kind/format, or discover missing cache
textures. Cache texture changes are setup/configuration-update work.

Disposal cache texture flow:

```text
installed handle disposal
  -> dispose owned cache textures
  -> invalidate cache texture binding/resource records
```

Disposal must follow explicit ownership:

- cache textures created by the cache through `TextureBuilder` for the
  installed handle are owned by that handle and disposed with it;
- replaced cache textures are disposed only after the replacement handle or
  refreshed resource is accepted;
- failed setup/configuration updates dispose any newly created cache textures
  before returning rejection diagnostics;
- disposing a GPU cache texture does not dispose or invalidate the logical
  `IncidentRadianceCache`; it only removes that installed shader handle's GPU
  representation.

### GPU Resource Preparation


GPU resource preparation creates resources before rendering. It may happen at
setup time or configuration-update time, but not as surprise work in the frame
loop.

This domain owns:

- `WebGLRenderTarget` creation and reuse;
- depth texture creation and type selection;
- non-cache `DataTexture` and `Data3DTexture` creation;
- sampler/filter/wrap/format/type policy;
- GPU upload and `needsUpdate` handling;
- resource reuse versus rebuild decisions;
- diagnostic resources used by setup validation.

Resource preparation is not binding. It creates or updates the texture; the
binder assigns the texture to the shader and keeps the binding map current.

## Lifecycle Operations

### Setup Lifecycle


Setup is the awaited operation that turns an accepted Algorithm32 context and a
runtime attachment request into an installed, frame-ready shader product. It
must finish all slow, failure-prone, and descriptor-sensitive work before the
render loop is allowed to depend on the pass.

Setup inputs:

- accepted Algorithm32 configuration/context;
- active light source, geometry, atmosphere, cache policy, transport, spectral
  basis, and display/composition descriptors;
- runtime attachment request, such as Three namespace, composer, scene,
  camera, renderer-compatible surface, and pass insertion policy;
- browser/GPU capability query surface;
- optional prebuilt or already-generated cache values/textures;
- debug mode requested by the application.

Setup outputs:

- installed composer/pass/material or a rejected setup result;
- compiled/link-validated shader source and source hashes;
- active shader contribution list and symbol inventory;
- prepared GPU resources;
- active binding map with setup/config/frame groups;
- runtime capability report;
- compatibility/invalidation baseline;
- setup diagnostics suitable for a setup report.

The setup lifecycle should run in owner-centered order. `ShaderBuilder`
coordinates the lifecycle, but each abstraction owns the facts, source
fragments, texture resources, and binding values in its domain.

| Order | Coordinating Owner | Responsibility |
| --- | --- | --- |
| 1 | `ShaderBuilder` | Accept the setup request, create a setup diagnostic envelope, and validate that the request names the required runtime attachment and Algorithm32 context. |
| 2 | CPU/reference setup | Snapshot canonical descriptors for the active spectral basis, execution controls, light source, geometry, atmosphere, cache policy, calculator policy, and display/composition policy. These descriptors are the source of truth for later fingerprints. |
| 3 | `ThreeGateway` | Query browser/GPU capabilities and report WebGL version, precision, texture, render target, and extension support before any contribution chooses a shader variant or texture packing. |
| 4 | Light source | Name or create the concrete incident-radiance cache family required by the active source model, contribute source facts, source-radiance bindings, source sampling assemblies, and any source-path limit semantics. |
| 5 | Incident radiance cache | Validate cache readiness against the active descriptors, build its cache texture through `TextureBuilder`, contribute matching lookup/access assemblies, and declare texture/sampler binding requirements. |
| 6 | Geometry | Contribute coordinate systems, world/view/source transforms, ray reconstruction policy, atmosphere/path-bound resolution, cache-access coordinate mapping, and geometry-owned binding requirements. |
| 7 | Atmosphere | Contribute medium/profile constants, density and coefficient sampling assemblies, phase functions, transmittance helpers, and atmosphere-owned binding requirements. |
| 8 | Spectral calculator / transport | Contribute the operation-order assembly for path radiance evaluation, spectral accumulation vocabulary, loop controls, and required capabilities from geometry, atmosphere, light source, and cache. |
| 9 | Color/display | Contribute shader display conversion, scene/atmosphere composition policy, output encoding, debug display hooks, and display-owned binding requirements. |
| 10 | `ShaderBuilder` | Build the shader symbol inventory from the main skeleton plus all contributed `provides` and `requires` entries. |
| 11 | `ShaderCompatibilityValidator` | Validate descriptor fingerprints, compatibility tags, duplicate provided symbols, missing required symbols, cache/source/geometry compatibility, and declared binding requirements before GLSL assembly. |
| 12 | `ShaderBuilder` | Assemble deterministic GLSL from accepted contributions and the main skeleton, then compile/link and record shader diagnostics. |
| 13 | `ShaderResourcePreparer` | Prepare non-cache GPU resources such as render targets and depth textures; cache textures are created by the cache through `TextureBuilder`. |
| 14 | Owners plus `ShaderBinder` | Ask each owner for setup/config/frame value providers, build the binding map, and apply setup bindings to the compiled material/pass/resources. |
| 15 | `ShaderPassInstaller` | Install or replace the pass in the runtime attachment, wire scene color/depth/final targets, and establish resize/disposal hooks. |
| 16 | `ShaderDiagnosticsReporter` | Emit setup diagnostics, source hashes, contribution inventory, binding inventory, capability facts, resource summaries, and mark frame rendering allowed. |

Owner calls during setup should stay narrow:

- light source does not pack cache textures or reconstruct camera rays;
- geometry does not decide atmosphere profile or source radiance;
- atmosphere does not own source position, cache coordinate loops, or display
  conversion;
- cache does not build its values during frame/runtime work and does not
  decide the light-source family that created it;
- calculator/transport does not know concrete source, geometry, atmosphere, or
  cache classes;
- color/display does not feed display policy back into CPU transport;
- `ThreeGateway` does not own physical facts;
- shader builder coordinates all calls and owns assembly, validation,
  resources, binding, installation, diagnostics, and cleanup on failure.

Setup failure behavior:

- configuration or descriptor mismatch: reject before asking for GLSL source
  where possible;
- missing required shader symbol: reject before GLSL compilation;
- unused provided symbol: warn unless it risks a GLSL collision;
- cache not built or descriptor-mismatched: reject unless active descriptor
  explicitly selects `cache:null`;
- unsupported capability: reject unless an accepted fallback contribution and
  resource policy are available;
- compile/link error: reject with source hashes, contribution list, and logs;
- resource allocation/upload failure: reject and dispose any resources created
  during the failed setup, including cache textures created through
  `TextureBuilder`;
- pass installation failure: reject and dispose any owned pass/material/target
  resources.

After setup succeeds, frame/runtime code may assume:

- descriptors and fingerprints are compatible;
- required symbols are present;
- required setup/config bindings are resolved;
- required GPU resources exist and are bound;
- the pass is installed and ready for frame rendering.

This is a hard phase boundary. Any work classified as setup/configuration,
including cache construction or selection, cache texture creation/upload,
descriptor compatibility checks, resource allocation, binding-map creation,
material construction, and pass installation, must complete before the
Algorithm32 shader pass is rendered. The shader pass render operation consumes
that prepared state. During a render it may refresh frame inputs that are
intrinsic to the current composer invocation, such as the scene-color read
buffer, camera/frame uniforms, or already prepared frame textures, but it must
not build caches, choose cache artifacts, repack cache textures, validate a new
Algorithm32 configuration, or install/rebuild the pass.

Within the per-pixel shader body, the Algorithm32 portion is limited to the
GPU equivalent of one `evaluate(...)` call for that pixel. Inputs are the
already prepared ray/scene-hit facts, configuration descriptors, bindings, and
incident-radiance support. The evaluate-equivalent returns spectral transport
results; endpoint hit color, tone/display conversion, and final RGBA encoding
remain separate post-evaluate composition/display work and must not feed back
into transport, cache setup, scene lighting, or configuration decisions.

The current full distant/spherical GPU shader is the `ideal` GPU shader
profile. It is the quality/reference implementation for the POC, not the place
to hide performance shortcuts. Reduced-cost experiments should use separate
quality profiles or a separate optimized contribution factory/implementation,
then compare against `ideal` outputs. A candidate may change numerical
controls, cache dimensions, packing, lookup strategy, render resolution, or
reuse policy only through setup/configuration descriptors and explicit
comparison records.

### Runtime Quality Policy


The production-facing quality policy should be hybrid. User preference chooses
the allowed quality envelope, while the runtime may adapt inside that envelope
when measured frame cost shows sustained pressure. `Auto` is the default
policy because it can preserve quality on capable hardware and step down when
the full frame budget is threatened.

Quality policy presets should be expressed as policy data, not shader
branches:

| Preference | Starting tier | Allowed range | Intended behavior |
| --- | --- | --- | --- |
| `auto` | `balanced-cache-interp` | `fast` through `ideal` | Default. Adapt to frame budget with hysteresis. |
| `quality` | `balanced-cache-interp` or `ideal` | `balanced-cache-interp` through `ideal` | Prefer visual quality; adapt downward only under sustained pressure. |
| `balanced` | `balanced-cache-interp` | `balanced-cache-interp` | Stable default when the user does not want runtime changes. |
| `performance` | `fast` | `fast` through `balanced-cache-interp` | Prefer responsiveness; never jump to `ideal` automatically. |
| `reference` | `ideal` | `ideal` | Pin the reference shader for diagnostics and comparison records. |

The preferred first production candidate is `balanced-cache-interp`: records
`429`, `431`, `445`, and `446` keep it as the best serious quality candidate,
while record `447` shows that steady-state timing at `1024 x 768` is still
fractional in the current benchmark. `ideal` remains the reference/high-quality
profile. `fast` is a pressure fallback, not the default quality target, because
the current diff records show visible risk. `draft` is a diagnostic/preview
profile and should not be part of normal automatic adaptation unless a product
mode explicitly accepts its quality loss.

Runtime adaptation must not violate the setup/frame boundary. A frame may
select among already installed, descriptor-compatible, warmed shader handles,
but it must not compile, rebuild, build caches, repack cache textures, or
upload new cache resources during the Algorithm32 pass. If the runtime needs a
tier that is not already prepared, it schedules setup/configuration-update work
outside frame rendering and keeps the prior valid tier active until the new
tier is accepted.

The adaptive controller should use whole-frame timing, not only shader-pass
timing, because app responsiveness depends on the complete render loop. Shader
diagnostic timings remain useful for attribution, but the decision to step down
or step up should be based on a rolling frame-time window against the active
target frame budget. The controller should:

- step down only after sustained over-budget frames, such as `10-20`
  consecutive or windowed bad frames;
- step up only after a longer stable under-budget window;
- apply hysteresis and a cooldown after every tier change to avoid flapping;
- change by one tier at a time unless the app enters an explicit emergency
  mode;
- record the reason, timing window, previous tier, next tier, and user
  preference for every automatic change.

Warmup and pipeline creation are a first-class part of this policy. Record
`447` shows first warmup frames around `50 ms` for `ideal` and about
`1.5-6.2 s` for several candidate shaders, even though steady-state timings
were fractional. Therefore setup should prebuild and prewarm the tiers allowed
by the user preference where memory and startup policy permit. A tier that has
not been warmed should not be selected automatically in the middle of
interaction unless the runtime first accepts the risk or the app can mask the
transition.

The runtime quality state should be reported as ordinary diagnostics:
preference, active tier, allowed tier range, target frame budget, rolling
timing summary, warmup status per tier, automatic switch history, and any
rejected tier changes. These diagnostics are runtime policy facts; they must
not feed into Algorithm32 transport or display/color composition.

### Configuration Update Lifecycle


Configuration update is the awaited operation that reconciles an already
installed shader handle with a new accepted Algorithm32 configuration or
shader policy. It produces either the same handle with updated bindings, a
rebuilt replacement handle, or a rejected update that leaves the prior valid
handle intact unless disposal was explicitly requested.

Configuration update inputs:

- the active installed shader handle;
- accepted next Algorithm32 configuration/context;
- next light source, geometry, atmosphere, cache policy, transport, spectral
  basis, and display/composition descriptors;
- optional next cache values/textures or cache readiness descriptors;
- current `ThreeGateway` attachment and capability facts.

Configuration update outputs:

- reused, rebound, rebuilt, or rejected installed shader handle;
- updated descriptor fingerprints and compatibility baseline when accepted;
- updated GPU resources when rebuild is required;
- updated binding map and applied config bindings when compatible;
- configuration-update diagnostics.

The configuration lifecycle should run in owner-centered order:

| Order | Coordinating Owner | Responsibility |
| --- | --- | --- |
| 1 | Installed shader handle | Accept the update request, freeze frame rendering for the handle while the update is pending, and retain the prior valid state until the update is accepted. |
| 2 | CPU/reference setup | Snapshot next canonical descriptors for the active spectral basis, execution controls, light source, geometry, atmosphere, cache policy, calculator policy, and display/composition policy. |
| 3 | `ThreeGateway` | Confirm the runtime attachment and browser/GPU capabilities are still valid for the requested resource policy, or report capability changes that force rebuild/rejection. |
| 4 | Light source | Report whether source descriptors, source bindings, source assemblies, or required cache family changed. |
| 5 | Incident radiance cache | Validate next cache readiness, descriptor compatibility, texture shape/packing requirements, and whether its existing cache texture can be reused, refreshed, recreated through `TextureBuilder`, or rejected. |
| 6 | Geometry | Report whether coordinate systems, ray reconstruction policy, path-bound logic, cache-access mapping, or geometry bindings changed. |
| 7 | Atmosphere | Report whether medium/profile descriptors, coefficient sampling, phase functions, or atmosphere bindings changed. |
| 8 | Spectral calculator / transport | Report whether operation order, loop controls, spectral accumulation vocabulary, or required capabilities changed. |
| 9 | Color/display | Report whether display conversion, composition policy, output encoding, debug display policy, or display bindings changed. |
| 10 | `ShaderCompatibilityValidator` | Classify the update as reuse, rebind, resource refresh, source rebuild, full rebuild, or reject based on descriptor fingerprints, compatibility tags, resource requirements, and binding requirements. |
| 11 | `ShaderResourcePreparer` | Refresh or rebuild only non-cache GPU resources required by the compatibility decision. Cache texture refresh/rebuild is performed by the cache through `TextureBuilder`. |
| 12 | `ShaderBuilder` | Reassemble/recompile only when the compatibility decision requires source rebuild; otherwise keep the installed shader source/material. |
| 13 | `ShaderBinder` | Rebuild or refresh the binding map as needed and apply config bindings outside frame rendering. |
| 14 | `ShaderPassInstaller` | Replace the installed pass only when rebuild requires a new pass/material or render-target topology. |
| 15 | `ShaderDiagnosticsReporter` | Emit update diagnostics and mark the handle ready for frame rendering, or report rejection while keeping the previous valid handle active. |

Full shader rebuild is required only when a configuration change affects the
assembled shader itself: owner-provided source, hook ordering, defines,
provided/required symbols, texture access declarations, precision policy,
render-target topology, or other material/pass source shape. Changes that flow
only through existing bindings should use rebind, uniform refresh, texture
refresh, or resource refresh without reassembling/recompiling the shader.
Those rebind/refresh operations are still configuration-update work: they must
finish before the next shader pass render that depends on them.

Owner calls during configuration update should stay narrow:

- model owners report descriptor and binding changes; they do not mutate the
  installed Three pass directly;
- cache reports logical compatibility and owns any cache texture reuse,
  refresh, or rebuild through `TextureBuilder`;
- resource preparation changes non-cache GPU resources only after compatibility
  classification;
- binding applies `config` values only after required resources exist;
- frame updates stay paused or use the prior valid handle until the update is
  accepted.

### Runtime Render Flow


The integrated render flow should use the same production shape for each
supported source/geometry profile:

```text
Three scene render
  -> color target
  -> depth target
  -> Algorithm32 atmosphere pass
  -> final display target
```

The atmosphere pass reconstructs the view ray from camera, depth, and viewport
inputs. It then evaluates the shader implementation of the CPU reference
transport for that ray and combines the spectral atmosphere result with the
scene color according to the selected display/composition policy.

Depth/ray reconstruction and atmosphere transport must be diagnosable
separately. A selected-pixel diagnostic should be able to report at least the
reconstructed ray, resolved path bounds, source direction, selected sample
count, cache lookup mode, spectral output, display output, and any boundary
flags.

### Pass Installation


Runtime installation decides where the assembled shader lives in the render
pipeline. It is distinct from binding: binding puts values into uniforms and
textures, while installation creates and attaches the pass that will consume
those values.

This domain owns:

- composer pass insertion or replacement policy;
- scene color render target wiring;
- depth texture setup and attachment;
- fullscreen quad, pass scene, and pass camera setup;
- `ShaderMaterial` attachment to the fullscreen pass;
- render target sequencing for scene color, depth, atmosphere, and final
  output;
- resize propagation from composer/renderer to owned targets;
- pass-level debug-view switching when it affects render sequencing.

The normal production shape is an app-owned composer that continues to render
normally after setup. Algorithm32 installs its pass into that composer and the
app does not call an Algorithm32-specific per-frame render method.

### Descriptor Compatibility And Invalidation


The installed shader is valid only while its descriptors, resources, and
bindings match the active configuration. Compatibility and invalidation should
be explicit so `frame` work can assume the installed pass is ready.

This domain owns:

- descriptor fingerprints and config versions;
- shader contribution compatibility;
- cache descriptor compatibility;
- display descriptor compatibility;
- resource stale checks;
- reuse, rebind, rebuild, or reject decisions;
- fail-loud errors for unsupported combinations.

At setup time, compatibility determines whether the shader can be installed.
At configuration-update time, compatibility determines whether the existing
pass can be reused, rebound, or rebuilt. At frame time, compatibility should
already be satisfied.

### Disposal And Lifecycle Cleanup


The shader product owns resources that must be disposed deterministically.
Cleanup should be part of the installed handle lifecycle, not a caller-owned
checklist of internal objects.

This domain owns:

- disposing owned geometries, materials, textures, render targets, and pass
  scenes;
- unregistering or removing composer passes when the handle is disposed;
- invalidating binding maps and resource descriptors after disposal;
- making post-disposal public operations fail loudly;
- avoiding disposal of app-owned renderer, composer, scene, camera, or
  externally supplied textures unless ownership was explicitly transferred.

## Integration And Policy

### ThreeGateway Scene Synchronization


The production docs treat source and geometry adapters as part of the runtime
shader product. The same accepted light-source and geometry facts should drive
both atmosphere uniforms and the Three scene defaults needed for coherent
visual output.

This domain owns:

- source-driven `DirectionalLight` or `PointLight` synchronization when the
  scene builder has requested scene lighting;
- source direction/position agreement between Three lighting and atmosphere
  shader bindings;
- source color/intensity display policy for scene lights, using lighting
  parameters supplied by Algorithm32/source configuration in predefined units;
- scene replacement and camera replacement handling;
- geometry/depth interpretation needed by the pass;
- opt-out hooks for app-owned lighting when supported.

Scene-light synchronization is display/product behavior, not Algorithm32
radiometry. It should not feed back into CPU transport or source calibration.
The scene builder decides whether scene lighting is included. `ThreeGateway`
does not own default light creation or physical light facts; it synchronizes
requested app/scene-builder light handles to the Algorithm32/source-provided
direction, position, color, and intensity parameters.

The current local/flat POC uses a source-owned scene-light adapter for this
handoff. The scene builder resolves source placement through geometry, then
passes Three constructors, observer/source scene positions, the
geometry-resolved `SourceRelativePosition`, optional shadow-frame settings,
and an endpoint-scene light-scale policy to
`LightSourceModel.createThreeLightingObjects(...)`. The light source returns
Three light objects, optional shadow/target scene objects, and bounded metadata
such as `lightingPolicy`, `shadowPolicy`, `observerIncidentScale`,
`endpointSceneIncidentScale`, source direction in scene/model frames, and the
selected endpoint-light scale policy. This adapter is part of integration
capture: it affects the pre-shader scene color that later becomes endpoint
color. It does not supply radiance to `evaluate(...)`, does not build or bind
incident-radiance caches, and does not change the spectral source facts used
by Algorithm32 transport.

For local sources, the adapter may use a `PointLight` when only endpoint scene
shading is needed, and may use a compact `DirectionalLight` plus target object
when Three shadow maps are requested. That directional shadow light uses the
resolved local source direction for renderer shadows; it is a renderer/shadow
camera approximation, not a claim that the finite local source became a
distant physical source. Shadows imply endpoint scene shading because the
captured scene color must contain the shadowed material color before the
Algorithm32 postprocess pass composes atmosphere over it.

Geometry owns scene endpoint surfaces that represent geometry/domain
boundaries. When a Three scene needs a ground, dome, map edge, or other
geometry-defined endpoint, the scene builder should ask the active geometry
model for Three endpoint objects instead of recreating that boundary from
parallel scene math. The geometry may provide separate renderable and raycast
objects: a visual object for preview/ordinary Three rendering, and an exact
raycast object whose `raycast(...)` implementation matches the geometry
model's mathematical boundary. This keeps scene capture, `evaluate(...)`
ray-length resolution, and shader endpoint composition aligned at tangent
cases such as ground-level spherical horizons.

Unsupported Three camera, depth, or render-target configurations are
configuration errors and should fail loudly before rendering. They indicate a
poorly designed test or unsupported integration contract, not a degraded mode
to compare. Unexpected runtime camera/depth/readback conditions should emit
bounded diagnostics and continue rendering with the configured safe behavior
when possible.

### Hit Data Itemization And Routing


Hit data is not a single packet with one owner. It is scene-derived
information that must be split by meaning before it crosses into Algorithm32
or postprocess composition. Scene descriptors may declare and validate how
scene facts map to owners/routes, but that routing metadata is configuration,
not data passed into `evaluate(...)`. The scene-input adapter or GPU pass may
observe many hit facts, but each accepted fact must compile into one typed
domain field:

- geometry-owned spatial facts enter `evaluate(...)` and are used only for
  ray segmentation, clipping, endpoint classification, and future source-path
  occlusion;
- endpoint contribution facts are ignored by the Algorithm32 transport input
  and handled after `evaluate(...)`; when physical endpoint contribution is
  needed, a composition/color policy must resolve endpoint spectral radiance
  outside transport before final radiance-to-display conversion;
- display-domain RGB is allowed only as a diagnostic/fixture policy and must
  not be treated as physical radiance by the color adapter;
- every color conversion belongs to the color abstraction, including
  spectral-to-display, display/linear RGB handling, RGB-to-spectrum inverse
  fitting, tone mapping, encoding, and color-space diagnostics;
- RGB, scene color, material color, albedo color, and other display-domain
  color values must never enter `evaluate(...)`;
- facts without a descriptor-declared owner are rejected during setup or
  scene-input validation;
- for scene-hit handling, `evaluate(...)` receives typed spatial/domain
  contribution fields such as scene intersection context or ray distance, not
  caller-supplied owner/route labels, not RGB/display color, and not endpoint
  spectral contribution data;
- transport does not branch on scene-object hits directly. An optional finite
  scene-object intersection distance is only an additional candidate
  termination; when it is absent, geometry uses its existing atmosphere,
  ground, and domain-boundary logic to resolve the ray.

For geometry-owned boundaries represented in Three, the hit producer should be
owned by geometry too. A triangle mesh is acceptable as a visual preview, but
objective scene capture should use a geometry-owned raycast object when a mesh
approximation can disagree with the mathematical boundary. Record
`210-m3-geometry-owned-three-spherical-ground-object` demonstrates this for a
spherical ground endpoint: the visible object is still a Three scene object,
but the raycast hit comes from the spherical geometry's exact boundary rather
than from finite mesh triangles.

First-pass hit-data inventory:

| Hit datum | Meaning | Units / frame | Owner / route | Handling |
| --- | --- | --- | --- | --- |
| Hit present/absent state | Whether the scene ray reached a surface before the far policy. | Boolean / scene input. | Scene-input adapter validates; geometry receives only the spatial consequence. | Present hit creates a finite scene-intersection contribution that acts as an optional early termination candidate; absent hit leaves geometry to resolve atmosphere exit, ground, and domain limits from its normal model data. |
| Hit distance / depth | Distance from view origin to the first scene surface, or encoded depth to reconstruct it. | Meters along view ray after depth linearization; camera/view frame before conversion. | Geometry through `evaluate(...)`. | Used to cap the view `RaySegment` before transport so `L_path` and `T_view` are computed only between the viewer and object; invalid or out-of-range values are rejected or logged according to runtime boundary policy. |
| Ray parameter | Normalized or renderer-native position along the view ray. | Dimensionless renderer value. | Scene-input adapter only. | Converted to meters before entering `evaluate(...)`; renderer-native value should not reach geometry. |
| Hit position | Reconstructed position of the scene surface. | World coordinates, or geometry coordinates after explicit conversion. | Geometry through `evaluate(...)` when needed for validation/segmentation. | Must agree with hit distance and ray direction within tolerance; otherwise reject/log the hit contribution. |
| Surface normal | Surface orientation at the hit. | Unit vector in world or scene frame. | Endpoint contribution policy, not geometry. | May be used by a material/spectral endpoint policy; not used to determine view-ray length. |
| Object id / material id | Stable identifier for the hit object or material. | Opaque id from scene descriptor or render pass. | Endpoint contribution policy. | May resolve a spectral material record or emitted-radiance record; not passed to geometry. |
| Opacity / alpha | Whether the endpoint is opaque, transparent, or partially contributing. | Dimensionless `[0, 1]`, display/material policy frame. | Endpoint contribution policy. | POC should start with opaque or rejected. Partial transparency needs a named spectral policy before it can affect composition. |
| Captured RGB / albedo | Display-domain scene color or material color sampled from the rendered scene. | Explicit color space required, usually display or linear RGB. | Color abstraction diagnostic policy or RGB-to-spectrum experiment input outside `evaluate(...)`. | RGB must never enter `evaluate(...)`. Do not ask the Bruneton color adapter to interpret RGB as radiance. Bruneton supports physical radiance composition, but does not provide a policy for turning arbitrary renderer RGB into surface radiance; any such conversion needs a named color/material policy. |
| Emitted radiance | Surface light emitted toward the camera. | Spectral radiance in Algorithm32 spectral basis, or source color plus named conversion policy. | Endpoint contribution policy, then final composition. | Preferred endpoint input when available because it already matches the spectral transport domain. |
| Reflected radiance policy | How surface lighting/reflection becomes endpoint radiance before atmosphere is applied. | Policy id plus required inputs. | Endpoint contribution policy. | Must produce spectral endpoint radiance before `endpointRadiance * T_view + L_path`; renderer RGB reflection is diagnostic only unless converted. |
| Spectral reference id | Reference to a material/spectrum/radiance fixture. | Opaque id resolving to Algorithm32 spectral basis. | Endpoint contribution policy. | Best objective-test path: resolves deterministic spectral endpoint radiance for CPU/GPU comparison. |
| Endpoint spectral radiance | Radiance leaving the endpoint toward the observer before view atmosphere. | Algorithm32 spectral radiance basis. | Final composition boundary. | Composed with evaluator output as `endpointRadiance * T_view + L_path`. |
| Confidence / provenance flags | Whether hit facts come from depth, analytic fixture, ID buffer, CPU scene descriptor, or fallback. | Enum/flags. | Diagnostics and validation. | Included in reports; may reject low-confidence facts for objective scenes. |
| Invalid or out-of-range depth | Depth value cannot produce a trusted hit. | Renderer/depth policy. | Scene-input adapter / diagnostics. | Log and continue with the affected pixel classified as `invalid`; omit the scene-hit contribution and do not silently convert it into a far hit. |
| Atmosphere-exit / no-hit classification | Geometry resolved no finite surface endpoint before leaving the atmosphere/domain. | Geometry evaluation result. | Geometry through `evaluate(...)`; final composition boundary consumes absence of endpoint. | Endpoint radiance is zero/absent; this is the same composition equation, not a separate sky branch. |

First GPU implementation policy:

- `surface`, `atmosphereExit`/no-hit, and `invalid` are required endpoint
  distinctions.
- `domainBoundary` may be reported as a geometry diagnostic or resolved class
  when the geometry model naturally produces it, but the first GPU milestone
  does not need separate rendering behavior for ground/domain boundaries
  unless a scene gives that boundary endpoint radiance.
- Standard renderer depth is the only accepted depth input for the first
  implementation. Logarithmic depth and reversed-Z cameras are rejected during
  setup/configuration until their reconstruction formulas are explicitly
  implemented and validated.

Resolved transport boundary: endpoint radiance/color is post-transport
composition, not an input to atmospheric evaluation, but optional scene-object
intersection distance is an atmospheric-evaluation input owned by geometry.
Geometry already has enough information to resolve rays without an early
scene-object termination, using its atmosphere, ground, and domain-boundary
rules. When a finite opaque scene hit is present, it becomes an additional
termination candidate and must cap the geometry-resolved view ray before
transport is evaluated. That makes `evaluate(...)` return `L_path` and
`T_view` for the medium between the viewer and the object, not for the sky,
far plane, atmosphere exit, or some later domain boundary. If the finite
endpoint contributes light, composition uses
`endpointRadiance * T_view + L_path` after evaluation and before final display
conversion. Bruneton supports this radiance-composition shape through aerial
perspective and ground rendering, but he handles endpoint contribution as
physical radiance/irradiance/reflectance, not as arbitrary renderer RGB.

Settled first implementation policy: opaque matte color is interpreted as
Lambertian albedo. This is the narrow bridge Bruneton's demo code uses for
simple scene objects: a color-like albedo multiplies sun plus sky irradiance
to produce outgoing endpoint radiance, then atmosphere is applied on the view
path. The policy equation is:

```txt
endpointRadiance = linearMatteAlbedo * surfaceIrradiance / PI
surfaceIrradiance = directSunIrradiance + skyIrradiance
finalRadiance = L_path + endpointRadiance * T_view
finalRgb = colorAdapter.toDisplay(finalRadiance)
```

This policy is intentionally limited. It assumes an opaque diffuse surface,
requires a surface normal and a resolved surface irradiance estimate, and does
not represent specular reflection, metalness, roughness, texture sampling,
subsurface/translucent transmission, emissive material, or arbitrary Three.js
PBR behavior. It should be named and reported as a matte/Lambertian endpoint
policy, not as general RGB-to-spectrum reconstruction. This is sufficient for
the first CPU soft-shader and GPU validation implementation goal.

Non-blocking follow-up: inventory how endpoint radiance could be introduced
for richer Three.js materials after the matte policy. The preferred physical
path is authored or resolved spectral endpoint radiance. If the only available
scene fact is renderer RGB, the color abstraction must either keep it
diagnostic/display-domain only or apply an explicit RGB-to-spectrum/material
policy outside `evaluate(...)` before composition. This is the part Bruneton
does not settle at the RGB material level. The follow-up is interesting for
production design, but unnecessary for progress on the first implementation.

If the scene begins with RGB, the scene contract must name whether that RGB is
only diagnostic display color, a material lookup key, or input to an explicit
RGB-to-spectrum reconstruction policy. That conversion is an
outside-evaluation color-abstraction policy; RGB is never part of the
`evaluate(...)` request. The validated Bruneton-based color adapter remains
the spectral-to-display adapter for Algorithm32 output. If RGB-to-spectrum
reconstruction is accepted, it is also owned by the color abstraction. Prefer
an inverse-fit policy against that validated adapter: find a constrained
Algorithm32 spectral radiance vector whose forward conversion through the same
Bruneton-based adapter reproduces the target color within tolerance. This is
not a true inverse, because spectral-to-color conversion loses information;
the fitted spectrum must record its constraint model, error, and diagnostic
status. The color adapter should not silently interpret RGB as physical
radiance without that explicit inverse-fit policy. The inverse-fit experiment
gate is only needed if the spectral-endpoint path is selected for RGB-derived
endpoint data.

Mined soft-shader evidence:

- The current CPU soft-shader sends only geometric hit facts into the transport
  trace for hit pixels: hit present/absent state, ray, camera position, and hit
  distance. Scene RGB, material id, surface normal, and endpoint color are not
  used to resolve the path segment.
- Hit-pixel color is handled after the transfer is computed. The
  `spectrum-id-reference-radiance` policy resolves a fixture spectrum,
  computes object radiance, composes it with spectral transmittance and path
  radiance, then converts the final spectrum to display output.
- The `captured-rgba8-display-domain` policy is display-space postprocess:
  captured scene RGB is multiplied by band-averaged transmittance and added to
  displayed path radiance. It is diagnostic/preview behavior, not spectral
  endpoint reconstruction and not `evaluate(...)` input.
- This evidence favors the geometry-only hit-input path for the first
  reconciliation soft-shader contract. Endpoint spectral radiance remains an
  outside-transport composition input. RGB-to-spectrum inverse fitting should
  stay deferred unless a later production requirement needs RGB-derived
  endpoint spectra.

Objective endpoint-introduction evidence still needed:

- Build controlled scenes that vary endpoint contribution independently from
  geometry: black/white/gray fixtures, saturated spectral fixtures, captured
  RGB fixtures, near/far hit distances, and sky/no-hit controls.
- Measure whether endpoint contribution changes are visible and numerically
  separable from path radiance and transmittance. Selected-pixel diagnostics
  should report `L_path`, `T_view`, endpoint contribution before composition,
  final output, and deltas against endpoint-disabled controls.
- Acceptance should decide how the first contract introduces endpoint
  radiance after transport: canonical spectral fixture endpoint radiance,
  diagnostic display-domain RGB composition, or no endpoint contribution for
  the first GPU validation target. It should not promote RGB-derived spectra
  or inverse fitting unless measured scenes specifically require that path.
- The experiment must specifically test whether RGB scene color can remain a
  diagnostic/display-domain postprocess, or whether the target scenes require
  a physical endpoint spectral radiance policy before final radiance-to-display
  conversion.

Objective endpoint scenes should use a small canonical spectral fixture table
rather than ad hoc per-scene spectra or renderer-material-id lookup. The table
is owned by the endpoint/color testing boundary and each row must provide
explicit per-channel values over the active Algorithm32 spectral basis from
`CANONICAL_SPECTRAL_CHANNELS`. Scene descriptors reference a
`spectralReferenceId`; they may scale or position a fixture, but they should
not author arbitrary wavelength values inline unless the run is explicitly
adding a new fixture with provenance. This keeps expected values inspectable
across wavelengths, makes selected-pixel comparisons independent from Three.js
material lookup behavior, and matches the older shader-lab diagnostic pattern
where `spectrumId` selected deterministic object radiance curves. Material-id
resolution can be layered later as a production scene/material policy, but it
is not the objective-test source of truth.

Initial fixture rows should cover expectations that differ by wavelength:
zero/black, neutral low/medium/high constant radiance, red-biased,
green-peaked, blue-biased, and at least one broad warm/ground-like spectrum.
The existing shader-lab red/green/blue/ground `objectRadianceAtWavelength`
curves are useful seed evidence, while the reconciliation implementation
should store fixture values in a canonical POC fixture module and ambient
types rather than reusing historical functions. Verification should compare
`endpointRadiance`, `T_view`, `L_path`, and
`endpointRadiance * T_view + L_path` per spectral channel before the validated
Bruneton-based display adapter runs, then separately compare the displayed
RGB/RGBA result. The rendered-pixel check is required: each objective fixture
scene must carry enough selected-pixel or controlled-region expectations to
prove the fixture's spectral values came through lookup, composition,
spectral-to-display conversion, tone mapping, encoding, and readback into the
final pixels. For deterministic objective scenes, the expected display pixel
should be computed from the same canonical fixture spectrum and the same
validated Bruneton-based color adapter used by the CPU baseline, then compared
against CPU soft-shader pixels and GPU shader pixels within the recorded
display/readback tolerance.

Research precheck before experimentation:

- Treat Bruneton 2017 and the accepted Step 032 Bruneton-based color adapter as
  the primary authority for the computer-science/rendering side of this
  question, because this lane already relies on that work as its validated
  baseline. Bruneton documents spectral radiance being converted to
  RGB/luminance through CIE-style conversion, and its reference path compares
  GPU approximations against full spectral CPU rendering. His aerial
  perspective and ground rendering path also support composing endpoint
  radiance with atmospheric transmittance after atmospheric transport and
  before final display conversion.
- Bruneton does not settle arbitrary RGB scene-material ingestion. He handles
  endpoint contribution at the physical radiance/irradiance/reflectance level,
  not by accepting renderer RGB as atmospheric input or by defining a general
  RGB-to-spectrum material policy.
- Use broader color-science references mainly for whether RGB can uniquely
  determine a spectrum. Metamerism and RGB-to-hyperspectral reconstruction
  literature make this underdetermined without priors, so RGB-derived endpoint
  spectra should require either a named policy with constraints or no
  production claim.
- If research resolves the fork strongly enough, record the evidence and do
  not require Stage 3.1.0a experiments for the current contract. If the
  research leaves uncertainty about visible contribution strength, post-spectral
  composition adequacy, or endpoint fixture behavior, run Stage 3.1.0a.
- Research references should be recorded in the numbered record or design note,
  including: Bruneton's 2017 implementation documentation; CIE/colorimetry or
  metamerism references; RGB-to-spectral reconstruction survey material when
  considering inverse fitting.

Experimental data to collect:

- Hit classification per selected pixel: hit/no-hit, hit distance meters,
  reconstructed hit position when available, endpoint class, and any invalid
  depth/out-of-range status.
- Endpoint fixture values before composition: `spectralReferenceId`, canonical
  spectral fixture radiance over `CANONICAL_SPECTRAL_CHANNELS`, captured RGB
  values for diagnostic cases, disabled-endpoint value, and the measured
  endpoint-only contribution.
- Transfer data from the evaluator: path radiance by spectral channel
  (`L_path`), view transmittance by spectral channel (`T_view`), and any
  reduced RGB/display transmittance used by diagnostic display-space policies.
- Final composition data: endpoint-disabled output, endpoint-enabled output,
  endpoint-only contribution, post-spectral color-composed output, final
  spectral radiance when available, final display RGB/RGBA, and selected-pixel
  or controlled-region deltas between enabled and disabled controls.
- Rendered-pixel fixture propagation data: selected-pixel or controlled-region
  expected display RGB/RGBA derived from the canonical fixture spectrum,
  observed CPU soft-shader RGB/RGBA, observed GPU shader RGB/RGBA when
  available, and deltas proving the fixture values survived through display
  conversion, tone mapping, encoding, and readback.
- Visibility metrics: max/mean/percentile absolute display deltas, selected
  pixel contrast ratios, monotonicity across near/far hit distances, and
  whether saturated fixtures remain separable after atmosphere.
- Classification result per scene: geometry-only hit input sufficient,
  canonical fixture spectral endpoint radiance sufficient for objective
  scenes, captured RGB diagnostic only, RGB-to-spectrum/material policy
  required, no endpoint contribution for first validation target, inconclusive,
  or rejected due to invalid setup/data.

Record metadata still needs scene descriptors, tested claims, selected pixel
ids, source/geometry/atmosphere/cache descriptors, command/provenance,
adapter/display constants identity, numeric tolerances, known limitations, and
`run.log`, but those are not experimental measurements.

### CPU Postprocess Shader


The CPU postprocess shader is the CPU-side reference shape for applying
Algorithm32 atmosphere to already-rendered scene inputs. It is not the CPU
reference transport itself and it is not part of the installed GPU shader
lifecycle. It consumes scene/evaluation inputs and exercises the same
composition shape the postprocess GPU path must implement, using the
reconciliation CPU `evaluate(...)` operation established by the completed CPU
work. It must not
call `SpectralCalculator`, geometry, atmosphere, light-source, cache, or other
algorithm internals independently, and it must not call or recreate the old
shader-lab transport as an approximation.

Reference implementation trail:

- `shared/algorithm32/POC/cpu/soft-shader.js` exports
  `postprocessSceneInput(...)` as the current shared POC implementation.
- `scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js`
  remains a compatibility entry point from the shader-lab lane.
- `scripts/flat/algorithm32-shader-lab/shader-soft-shader-runway.js` and
  `scripts/flat/algorithm32-shader-lab/subjective-soft-vs-gpu-source-scenes.js`
  show the shader-lab scene-input/postprocess usage.
- The `scripts/flat/local-second-order/` lane reuses the same
  `postprocessSceneInput(...)` path with local second-order incident field
  support.

Those references define scene-input and composition lineage only. The
reconciliation implementation must route every per-pixel atmosphere
calculation through the current POC `evaluate(...)` operation:

```text
scene input
  -> CPU postprocess shader creates an evaluate request from scene facts
  -> evaluate(...) resolves geometry, atmosphere, source, cache, and transport
  -> CPU postprocess shader composes endpoint radiance with evaluate output
```

That means distant/spherical pixels use the accepted distant source,
spherical geometry, atmosphere, and distant incident-radiance cache behavior
from the CPU reference work. Local/flat pixels use the local source, flat
geometry, observer-centered finite-dome ray exits, and local cache/support
contracts from the CPU local/flat work. The CPU postprocess shader may choose
which active configuration to bind from the scene input descriptor, but it
does not supply substitute transport equations, direct calculator calls, cache
samples, source falloff, ray limits, or atmosphere exits.

Executable profile support follows milestone needs. The first soft-shader pass
may implement only the profiles needed by the active milestone, starting with
distant/spherical for M3. Scene-input types and descriptors should still be
able to represent later local/flat rows, but local/flat runtime execution is
not required until a local/flat milestone needs it.

The CPU postprocess shader consumes a plain scene input, not Three objects
and not a shader output packet. The scene input provides:

- image dimensions;
- camera position;
- per-pixel ray directions;
- per-pixel spatial endpoint or scene-intersection facts, such as finite scene
  hit distance, atmosphere exit, object/surface id, or an equivalent
  scene-intersection provider that geometry can query through `evaluate(...)`;
- optional per-pixel endpoint surface/color/material facts when the selected
  scene-color policy needs them. These are consumed by the color abstraction
  to produce spectral endpoint radiance only if the spectral-endpoint path is
  selected, or by postprocess only for explicitly diagnostic display-space
  composition;
- source descriptor;
- geometry descriptor;
- selected diagnostic pixels when requested.

Scene input source support follows [Shader Test Design](shader-test-design.md).
The soft-shader should support the input source required by each accepted test
scene before that scene is used for GPU comparison. Start with deterministic
authored descriptors or serialized JSON fixtures when they satisfy the
objective scenes. Add Three captures when a test scene needs renderer-derived
color, depth, or camera facts, or when validating the `ThreeGateway` path. Do
not support both JSON fixtures and Three captures merely for symmetry; support
both when the required scene set needs both.

Scene input facts that can affect Algorithm32 should be treated as additive
domain inputs, not as soft-shader-owned branches. Descriptor/setup
configuration validates which owner each scene fact belongs to. The
soft-shader then translates validated scene input into typed fields: spatial
hit facts become scene-intersection context for geometry through
`evaluate(...)`. Endpoint surface/color/material facts are optional and become
color-abstraction inputs only if the selected design path requires endpoint
spectral radiance before composition; otherwise they remain postprocess or
display-only data. Later any explicitly designed source, atmosphere, or cache
facts become their own typed request/configuration fields. Postprocess may
orchestrate composition, but it does not own color conversion. The runtime
request must not carry caller-supplied owner/route labels.

For each pixel, it resolves only the scene-to-evaluation request data needed
by the public evaluator, including any scene intersection context that geometry
needs for ray segmentation, calls `evaluate(...)`, and composes spectral
endpoint radiance with evaluated path radiance and evaluated transmittance
before display conversion:

```text
final = endpointRadiance * T_view + L_path
```

Here `L_path` is path-added spectral radiance, `T_view` is view-path
spectral transmittance, and `endpointRadiance` is spectral endpoint radiance
computed outside `evaluate(...)`. `endpointRadiance` is zero or absent when
geometry resolves the ray as leaving the atmosphere without a surface
endpoint. This is not a separate sky transport branch; it is the same
composition equation with no surface contribution.

Current POC scene-color inputs use the local-second-order
`captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy` policy as
the canonical diagnostic hit-color mechanism. That policy is display-owned:
captured scene RGB remains outside `evaluate(...)`, is inverse-tone-mapped
into the accepted Figure 1 pre-tone-map scale, multiplied by RGB bands derived
from spectral view transmittance, added to the path radiance converted to
linear sRGB, and tone-mapped once to final RGB. Record `214` is retained only
as a spectrum-fixture routing diagnostic, and record `215` is a superseded
matte/RGB-to-spectrum detour for this lane. Records `218` and `219` lock the
current contract, and record `220` proves the scaled planet scene with green
boxes now follows it. RGB scene color never enters `evaluate(...)`, and
`spectrum-id-reference-radiance` must not be used as evidence for renderer
hit-color handling.

Scene intersections are spatial inputs, not color/display inputs. They enter
through `evaluate(...)` and are consumed by geometry when resolving the view
ray segment and, when supported, source/light path occlusion. The CPU
postprocess shader may carry endpoint surface/color/material facts beside
those spatial facts. Those endpoint contribution facts go to the color/display
or postprocess composition boundary to produce endpoint radiance for final
composition, but they must not be passed to geometry or used to decide ray
segmentation.

The CPU postprocess shader may select a configured evaluation context whose
setup includes incident-radiance support, such as local second-order behavior.
That support is bound through the normal evaluator/setup path; the
postprocess shader does not receive cache internals, call the sampler
directly, or own cache construction.

Diagnostics must stay bounded. The default diagnostic shape is selected-pixel
packets plus aggregate counters and summary metrics. Controlled-region
summaries are allowed when the scene is designed around a region. A
problem-focused diagnostic mode may request extra samples, controlled regions,
or targeted buffers only when it names the problem being investigated and
bounds the amount of emitted data. The CPU postprocess shader must not emit
one full diagnostic packet per rendered pixel.

The design rule is that the CPU postprocess shader must remain a thin
scene-input adapter over `evaluate(...)`. It should not copy Algorithm32 equations,
create Three resources, sample the live scene graph, own source-light
synchronization, decide scene capture policy, call lower-level calculator,
geometry, atmosphere, light-source, or cache methods directly, or use legacy
POC shortcuts when the current CPU path has a resolved abstraction. Those
responsibilities belong to the CPU reference implementation, abstraction
owners, `ThreeGateway`, and the caller that provides the scene input.

Deferred optimization: CPU postprocess/reference rendering is eligible for
worker parallelism because each pixel ray can be evaluated independently once
the scene input, cache data, and Algorithm32 configuration are fixed. A future
implementation may split an image into row bands or tiles across Node
`worker_threads` or browser Web Workers, construct or reuse one evaluator per
worker, and stitch returned RGBA/spectral slices into the final artifact.
Messages should be tile-sized rather than per-ray, and shared inputs should be
immutable typed arrays or worker-local copies. This is a performance-only
optimization for CPU baseline generation; it must not change `evaluate(...)`
semantics, shader comparison tolerances, or the installed GPU shader design.

### Shader Test Boundary

The shader test plan is a separate design artifact:
[Shader Test Design](shader-test-design.md).

That document owns:

- objective scene families;
- canonical spectral fixture scene requirements;
- scene construction rules;
- fixture-to-pixel propagation checks;
- selected-pixel and controlled-region diagnostic expectations;
- rendered-pixel acceptance and failure classification.

This shader design owns the shader product contract, assembly, bindings,
lifecycles, and integration boundaries. A shader implementation is not
accepted because internal spectral packets look plausible. Objective tests
must prove the installed shader modifies rendered pixels correctly, with
spectral diagnostics serving as failure explanation and traceability.

### GPU Validation Scene Set

The GPU validation scene set is one reusable descriptor inventory consumed by
both CPU soft-shader runs and GPU shader runs. The CPU and GPU paths must not
maintain separate scene lists. The primary gate is each implementation passing
the objective scene's expected pixel or controlled-region claims; comparison
between CPU soft-shader and GPU shader outputs is secondary consistency and
mismatch-classification evidence.

The inventory separates objective scenes from subjective review scenes:

- Objective scenes test measured claims and expected pixel transformations.
  They should start with no-atmosphere passthrough, sky/no-hit, finite opaque
  endpoint, depth reconstruction, contribution-routing rejection,
  cache-on/cache-off, and selected-pixel distant/spherical parity.
- Subjective scenes are for plausibility and regression review only. They do
  not become parity targets and do not replace objective evidence.

Ad hoc subjective scenes requested during review are record/status artifacts,
not shader design surface. They may use the shared scene construction path and
the same CPU/GPU shader inputs, but their specific locations, camera choices,
objects, colors, and review compositions should not be added to the design
inventory unless they are explicitly promoted to reusable fixtures.

Scene descriptors identify selected pixels, controlled regions, expected facts,
comparison intent, readback format, and setup-time ownership/routing
expectations. Numeric tolerances are owned by
[Shader Test Design](shader-test-design.md), not by individual scene
descriptors, and should be justified from human vision limitations.

Objective scene size should follow a themed-composite rule. Group related
checks into one readable scene when that amortizes long CPU soft-shader runs;
split a scene when additional checks would make the artifact, selected pixels,
or diagnostic regions too cluttered to understand.

The must-carry subjective lineage for the first GPU review gallery is the
Southern France mesh family using the accepted OBJ diffuse terrain backend.
Start with the accepted no-shadows Southern France OBJ diffuse source-matrix
rows `070` through `073`. Keep this lineage no-shadow only: the mesh already
has baked shadow/detail and is not constructed well enough for shadow
validation, so shadow-enabled variants are intentionally excluded. Preserve the
fitted local-angle rows `077` through `079`, shader-only local vertical stack
`080`, and optional star-field stack `086` as local/flat follow-on review
scenes unless a nearer GPU review need pulls them forward.

### Local/Flat Follow-On Boundary


The M3 shader contract should anticipate local/flat through abstraction
boundaries, cache ownership, and contribution assembly shape, but it should
not add unused local/flat shader branches to the distant/spherical shader
source unless a shared contract requires them.

Descriptor/schema validation should test only mandatory contract facts and
accept those facts from any abstraction. It should not reject a descriptor just
because its concrete source/geometry/profile is local/flat when the descriptor
provides the mandatory facts for the current operation. Unsupported optional
facts can be classified as unsupported by the selected implementation profile,
but they should not become broad concrete-type gates.

Local cache texture ownership rules are settled now so later local/flat GPU
work can implement them rather than redesign them. Finite dome and
atmosphere-exit behavior remain geometry-owned contribution responsibilities
for the local/flat profile. There is no required design ordering between
validating finite-dome GPU behavior and local-source cache textures; run
whichever gives useful evidence first once the local source path exists.

The first local/flat subjective GPU smoke scene is user-selected at execution
time. The design preserves the known local-second-order subjective review
lineage, but it does not preselect one local/flat scene as a standing first
smoke gate.

### Runtime Capability Model


The shader product needs a runtime capability model before it decides which
resources, shader variants, and fallback/error policies are valid.

This domain owns:

- WebGL version and GLSL version facts;
- float/HDR texture and render target support;
- depth texture support;
- 3D texture support;
- precision limits and selected precision policy;
- max texture sizes, layer counts, and uniform/vector limits;
- vendor/renderer/browser diagnostics;
- software-renderer or fallback detection;
- unsupported-mode rejection.

Capabilities can influence partial assembly selection, texture packing,
render target formats, debug modes, and whether a requested cache/source
combination is installable. Capability failures should be setup/configuration
errors, not frame-time surprises.

### Display And Composition Policy


The GPU shader path must produce visible pixels, so it needs a display and
composition policy adjacent to spectral transport. This does not move display
conversion into CPU transport.

This domain owns:

- scene color plus atmosphere composition;
- zero-density scene-color passthrough;
- spectral-to-display conversion;
- exposure, tone mapping, and output encoding;
- debug display modes;
- shader output display conversion.

The display policy should be explicit enough that shader output is stable and
reproducible for the active descriptor. Longer-term app display policy remains
a separate production/display decision.

Algorithm32 output remains spectral until the display/composition boundary.
The CPU soft-shader and GPU shader must use the validated Bruneton-based color
adapter directly for spectral-to-display conversion in baselines, GPU
comparison expectations, and rendered-pixel fixture propagation. Endpoint
spectral radiance, when available, is composed with path spectral radiance
before display conversion.

The installed GPU shader's primary operational output is display RGB/RGBA
written to the active Three render target or canvas. This is rooted in Three
shader semantics: a `ShaderMaterial` is GLSL run by `WebGLRenderer`, the
fragment shader defines each rendered fragment's color, and
`WebGLRenderer.render(...)` writes to the active render target or canvas.
Spectral or diagnostic buffers are secondary validation/debug outputs produced
only by explicit debug or validation passes.

Captured RGB composition is not a physical/default shader policy and must
never enter `evaluate(...)`. Any conversion between captured RGB and spectral
endpoint radiance belongs to the color abstraction. Endpoint RGB diagnostic
composition is not retained as a shader-owned per-pixel diagnostic; any
endpoint-RGB comparison belongs to the test runner, compares rendered display
output only, and must not claim spectral parity. Pixel-level comparison
decisions are made by the test runner using selected pixels, controlled
regions, readbacks, and aggregate metrics from the shader test design.

Exposure/debug modes are not part of first shader operation unless a specific
validation or product need arises. Runner-side visualization controls are the
default home for those concerns. Every comparison record should still record
the display constants and adapter identity it used.

### Diagnostics And Reports


Each shader setup report should include:

- input descriptor fingerprints;
- shader source or source hashes;
- defines, precision policy, texture formats, and texture dimensions;
- active binding map, update frequencies, and bound descriptor fingerprints;
- compatibility/invalidation decisions and stale-resource checks;
- pass installation, render target, resource preparation, and disposal
  summaries;
- display/composition mode and scene-adapter/source-light state;
- WebGL vendor, renderer, version, precision, limits, and extensions;
- browser name/version, device pixel ratio, and render target sizes;
- shader compile/link logs;
- shortcut registry entries for any shader deviation from CPU operation order
  or value representation;
- final acceptance, rejection, or unresolved classification.

Reports should distinguish implementation differences from algorithm changes.
If a setup problem is caused by packing, precision, interpolation, operation
order, color conversion, or browser capability, it is a shader implementation
finding, not a change to Algorithm32.

### Validation Policy


Recommended shader validation gates:

1. Runtime capabilities are recorded before selecting resource policy, shader
   variants, or cache texture packing.
2. Descriptor snapshots are deterministic and match CPU configuration
   fingerprints.
3. Cache readiness and descriptor compatibility are validated before cache
   texture creation or non-cache resource preparation.
4. Shader compile/link succeeds after contribution compatibility validation.
5. No-atmosphere passthrough reproduces the scene color target.
6. Depth/ray reconstruction selected-pixel diagnostics match CPU geometry
   expectations.
7. Shader output packets expose descriptor values and selected diagnostics
   that can be compared against CPU descriptor/evaluation facts.
8. Setup diagnostics classify every rejected descriptor, capability, resource,
   binding, or compile/link condition.

Objective verification uses scene claims as the primary gate. Both the CPU
soft-shader and GPU shader run against the same objective tests; comparison
between their outputs is secondary consistency and mismatch-classification
evidence.

GPU numeric tolerances are explicit and perception-grounded. Exact match is
reserved for CPU-only artifacts, deterministic descriptor snapshots, and other
non-browser/reference outputs. Browser/GPU rendered artifacts should not have a
default exact pixel-match gate; they pass by satisfying the objective scene's
human-visual-perception-grounded tolerance. A later GPU test may declare an
exact gate only if it first proves the browser, renderer, render target,
packing, readback, and encoding path are deterministic enough for that claim.

Image-level acceptance selects the metric needed by the objective claim:
selected-pixel deltas for targeted facts, controlled-region deltas for local
patterns, whole-image metrics for full-frame claims, or a documented
combination. Max absolute error, RMSE, percentile thresholds, and
selected-pixel parity are tools selected by the test design, not universal
gates.

Contribution-routing probes should be setup-level tests that fail before
rendering if ownership is wrong. Objective failure classes should distinguish
descriptor mismatch, depth/ray reconstruction, cache lookup, transport math,
display conversion, precision/packing, and browser capability.

### Browser Runner Boundary


Browser execution, screenshots, readbacks, and artifact persistence remain
runner concerns rather than shader operation concerns. The runner protocol
should follow the local-Sun experiment model: a long-running watcher monitors
for a JSON job file to open, executes that job, and writes outputs back to the
numbered experiment folder. A local HTTP control channel is not part of the
first protocol.

Each browser-run job folder should include the immutable input snapshot,
capability report, criteria results, output artifacts, and a progress log that
is updated while the browser work runs. Liveness should be judged from that
progress logging file: a slow shader compile or long render remains alive if
progress/heartbeat records continue to advance, while a dead browser/process
is detected by stalled progress beyond the runner's configured timeout window.

Comparison work may use in-memory buffers, including raw readback buffers when
available and useful. Artifact persistence is stricter: every retained visual
artifact should be saved as a PNG file so experiment records stay reviewable
without replaying the browser run.

The browser page should use native ES modules and import maps while that stays
simple. If module resolution, vendor imports, or page-only dependency wiring
starts making the watcher carry bundler-like behavior, a lightweight Rollup
build is allowed for the browser page. That build output remains page-owned:
the watcher should only serve or load the requested page, execute its declared
entrypoint, mirror progress, and persist requested artifacts.

### Open Decisions


- HDR/float policy: texture formats, render target formats, and fallback
  behavior on unsupported hardware.
- Depth precision policy: standard depth is the first accepted input, while
  logarithmic depth and reversed-Z are setup/configuration rejections until a
  later pass explicitly implements and validates them. Remaining work is to
  document near/far ranges and exact standard-depth linearization.
- Display implementation shape: settled for the POC as
  `color/BrunetonColorDisplayModel.js`, an implementation of
  `ColorDisplayModel` using `FIGURE1_DISPLAY_CONSTANTS` and the accepted
  Step 032 CIE/tone-map path. `Figure1SkyDomeRenderer` consumes that model as
  an artifact renderer. The CPU soft-shader and GPU shader should use the
  color model boundary without reimplementing, deriving a parallel policy, or
  making display conversion transport-owned.
- Shortcut registry shape: where named shader shortcuts are declared, how they
  are fingerprinted, and how evidence links to them.
- Whether the first validation target should be descriptor-only or an
  end-to-end minimal passthrough before full Algorithm32 transport.

### Focused Design Backlog


Remove items from this list as focused design passes resolve them.

All currently identified focused design backlog items are resolved. Add new
items here only when implementation reveals a focused design gap that should be
settled before more code is written.
