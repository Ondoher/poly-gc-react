# Algorithm32 Production Documentation

This folder is the documentation home for the production Algorithm32 module.

Current status: production Algorithm32 is in design stage with scaffold plus
initial tested CPU/reference helper implementations.
The local second-order experimental lane is closed as accepted evidence, but
no production algorithm/runtime implementation has been promoted outside the
preserved `POC` bundle yet. The production code root is
`shared/algorithm32/production/`, which currently contains the Jasmine test
lane, AMA reference registry, ambient `types.d.ts` homes, initial
consumer-provided `LightSourceModel`, `AtmosphereModel`, `GeometryModel`, and `Color`
interface files, initial `Reference` and `ShaderBuilder` implementation class
scaffolds, the initial `SharedModel` aggregate model, the implemented
`SpectralModel` component model, and scaffold/model guardrail specs. The
`Reference` class now includes the cited top-level `evaluate` orchestration,
several implemented leaf/private helper methods, and remaining unimplemented
private helper stubs for the transport steps. The
production deliverable is a usable
shader/runtime atmosphere pass; CPU reference code is support for validation,
internal shader texture building, cache construction, diagnostics, and future
tests.
The three algorithm input abstractions are Sun, atmosphere composition, and
geometry. Algorithm32 core output is spectral or spectral-group radiance and
transmittance; display conversion is a separate class that consumes spectral
output when a renderer or offline tool needs RGB, exposure, tone mapping, or
debug-color mapping. Those abstractions should be defined as public
interfaces in the Algorithm32 API itself, not only as implementation-private
packet shapes.
The initial implementation ships one atmosphere profile: the accepted
Algorithm32 canonical profile. Alternate atmosphere profiles are future named
extensions, not first-implementation defaults. Every promoted constant needs
per-value provenance: an external source, a source-backed derivation, or an
accepted Algorithm32 experiment/decision.
Numerical controls are execution configuration, not a fourth algorithm input
abstraction.
Per-path CPU/reference algorithm execution and shader resource building are
separate implementation responsibilities that consume the same facade-owned
shared configuration/facts model. CPU/reference evaluation may remain public
for validation and tooling consumers. Shader texture/cache building is
internal resource preparation behind awaited shader setup and awaited
shader-handle config updates.
Runtime shader behavior is part of facade configuration, likely
`Algorithm32Config.shader`, not just setup-time data. It owns choices such as
shader mode, debug view, cache/resource policy, capability failure policy, and
render-target/HDR/depth policy. The Three setup request supplies attachment
handles such as composer, scene, and camera.
The current assumed API shape is a configured Algorithm32 facade instance, one
per independent simulation window, coordinating a CPU/reference algorithm
execution class and a runtime shader builder over a
facade-owned shared configuration/facts model.
The private helper implementation sequence for the CPU/reference execution
class is now recorded in
`shared/algorithm32/production/implementation/reference_plan.md`.
The Algorithm32 algorithm means the specified atmospheric transport steps and
calculations; the CPU/reference algorithm execution class runs CPU/reference
operations using those calculations.
Algorithm configuration facts are owned by source, atmosphere, geometry, and
spectral component models; algorithm execution consumes those facts for one
specific input and returns spectral transport results.
The facade creates the shared configuration/facts model from validated config
and passes that model reference to the CPU/reference algorithm execution class
and the runtime shader builder. Config replacement updates
the shared model by replacement or versioned canonical snapshots so consumers
pick up compatible changes at operation boundaries.
Generally useful scalar, angle, distance, wavelength, vector, numeric-array, and sample
helpers are a separate pure math API namespace rather than shared model methods;
the current concrete files are `ScalarMath`, `AngleMath`, `DistanceMath`,
`WavelengthMath`, `VectorMath`, `ArrayMath`, and `SampleMath` under `shared/algorithm32/production/utils/`,
with `MathUtils.js` re-exporting those objects by name for grouped imports.
The normal renderer input is a live Three scene rendered into color/depth
targets, then composed by an Algorithm32 fullscreen shader pass. JSON scene
packets and Raycaster captures are validation/oracle inputs only. The facade
should own or expose source-driven scene-light synchronization, geometry/depth
policy, runtime capability diagnostics, and fail-loud local-cache binding so
callers do not need Algorithm32 shader/cache domain knowledge.
The production runtime shader integration should require a composer-style
Three render pipeline. Algorithm32 setup asks its runtime shader builder to
build the runtime shader from packaged shader source, the shared model, and
the configured shader runtime policy, installs the resulting pass into the
caller's existing composer, and the app continues to invoke that composer in
its normal frame loop.
The current primary facade draft is
[Algorithm32 Primary Facade API Draft](api-facade-draft.md). It defines the
provisional caller-facing class, returned shader handle, minimal Three
integration path, configuration boundary, and explicit exclusions. The current
primary facade surface is `constructor`, `config` getter, `setConfig`, awaited
`setupShader`, `evaluate`, `getDiagnostics`, and `dispose`; `buildTexture`
and `validate` are not primary app-facing methods.
Local Sun configuration and calibration must resolve to the public Sun
interface before reaching transport, texture building, cache, or runtime
shader code. For Sun, atmosphere composition, and geometry, anything not
defined by the corresponding public interface or public input/resolver types
stays private to that owner domain.

## Current Handoff

The latest operational source to mine is the accepted local-second-order POC
lineage:

- `scripts/flat/local-second-order/`
- `shared/algorithm32/POC/local-second-order/`
- `shared/algorithm32/POC/three/shader-lab-page.js`
- `shared/algorithm32/POC/cpu/algorithm32-transport.js`
- `shared/algorithm32/POC/source-contract/`

Current mined conclusions:

- [Algorithm32 Conclusions](conclusions.md) consolidates the accepted
  Algorithm32 transport steps, source/geometry/atmosphere/color ownership
  split, data flow, active constants, source references, rejected residues, and
  unresolved production choices.
- The latest accepted shader lineage uses endpoint/trapezoid transport for
  view-path and source-path optical-depth integration. Older midpoint
  cleanroom fixtures remain useful fixture/stage evidence, but they are not
  the current production default.
- The POC source-contract lineage emitted source-path descriptors from
  light-source samples, but reconciliation should promote the cleaner
  production boundary recorded in
  [Algorithm32 Abstraction Design](../reconciliation/algorithm32-abstraction-design.md):
  geometry resolves source-relative coordinates, boundary context, clipping,
  cache coordinates, and altitude policy; light source consumes those spatial
  coordinates and supplies lighting facts, including source-owned distance
  semantics and source path limits; geometry then resolves clipped source
  paths for transmittance; atmosphere owns sampled medium coefficients;
  transport coordinates plain packets and applies the integration rule.
- `IncidentRadianceCache` is owned by a concrete light-source implementation
  behind `LightSourceModel.sampleIncidentRadiance(...)`. It is not a shared
  aggregate model, generic `Reference` dependency, or caller-provided provider.
- The latest mined POC constant inventory is recorded in
  [Algorithm32 Production Design](production-design.md#latest-poc-constant-inventory).
  Constants are grouped by whether they are reference-backed, accepted POC
  operational values, app/legacy contamination, or unresolved production
  questions.
- The next experimental follow-up is the `reconciliation` lane described in
  [Algorithm32 Conclusions](conclusions.md#follow-up-reconciliation-lane):
  produce a reference-backed CPU Algorithm32 implementation, then a GPU shader
  implementation validated against the CPU reference. It must also assemble
  the finalized, fully sourced initial parameter ledger, document the shape
  and flow of all data across light/source, geometry, atmosphere,
  Algorithm32 transport, cache/shader resources, diagnostics, and external
  color/display conversion, then rerun the accepted Algorithm32 tests before
  promotion. Color stays outside CPU transport, but the later GPU shader build
  needs the color/display interface for renderable output. That lane should
  also recreate the objective and subjective
  artifact families from
  `scripts/flat/local-second-order/`, including milestone criteria artifacts,
  browser harness captures, source-matrix galleries, and subjective review
  images.

The implementation lives in:

```text
shared/algorithm32/production/
```

The cleanroom experiment and shader-lab docs remain the evidence and design
history for the production build. Use them as inputs, then promote durable
contracts here as the official production documentation.

## Current Authority

- [Algorithm32 Status](status.md) is the concise current handoff for the
  design checkpoint, reconciliation gate, reload order, and next work.
- [Algorithm32 Requirements](requirements.md) is the current requirements
  entry point. It divides requirements into implementable ownership domains;
  define and accept this layer before freezing production API names or packet
  shapes.
- [Algorithm32 Conclusions](conclusions.md) is the current source-mined
  consolidation of accepted Algorithm32 behavior, constants, external
  references, rejected experiment residue, and unresolved choices.
- [Algorithm32 Production Design](production-design.md) records the
  design-stage module boundaries, local Sun solar-zenith calibration UX/API
  notes, non-goals, promotion sequence, and open questions needed to satisfy
  the requirements.
- [Algorithm32 Primary Facade API Draft](api-facade-draft.md) is the current
  design draft for the main configured facade class and the runtime shader
  handle it returns.
- [Algorithm32 Canonical Reference](../plans/atmosphere-cleanroom-design/algorithm32-canonical-reference.md)
  is the current source of truth for accepted Algorithm32 behavior, endpoints,
  abstractions, open issues, and production followups.
- [Algorithm32 Module Design](../plans/atmosphere-cleanroom-design/algorithm32-module-design.md)
  is the current working design for module boundaries and API shape.
- [Algorithm32 Shader Iteration Plan](../plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md)
  records accepted shader-lab milestones and parity evidence.

## Source Mining

These catalogs are available when production Algorithm32 needs external
reference provenance, source-backed constants, or validation-fixture rationale.
They are not default reload sources.

- [External Reference Log](external-reference-log.md): imported external
  source and decision catalog from the retired atmosphere reference lane.
- [Fixture Sources](fixture-sources.md): imported fixture-readiness inventory
  for source-backed validation data.
- [Reference Fixtures Evidence](evidence/reference-fixtures/README.md):
  copied JSON expectation fixtures with embedded reference objects and
  derivation notes.

## Test Scaffold

Production Algorithm32 has a focused direct-Jasmine lane:

```text
npm run test:algorithm32:production
```

The current scaffold specs live in package-level and class-local `_tests/`
folders under `shared/algorithm32/production/`. Jasmine discovers them through
`**/_tests/**/*.spec.?(m)js`. Package-level specs verify the production source
registry fixture, the ambient type homes, the consumer-provided interface files,
and the rule that production implementation JavaScript must not import from
`shared/algorithm32/POC/` as a runtime dependency. Package-level fixture specs
also validate the production analytic invariant ledger shape and ensure
app-spec-only citations were not promoted; bracket citation numbers must
match each row's compact reference pointer numbers, and superscript citations
must not be used. Class-specific specs live beside their classes
with class-name files, such as
`models/_tests/SpectralModel.spec.js`, and guard the facade, implementation
collaborators, `SpectralModel`, and `SharedModel`. The latest focused lane
covers 38 specs with 0 failures, including fixture-backed coverage for
`Reference` segment transmittance, transport state transition, direct
in-scattering, and incident in-scattering helpers.

## Production Split

- `agents/topics/apps/flat/algorithm32/`: production documentation for the
  official Algorithm32 module.
- `shared/algorithm32/production/`: production implementation code for the
  usable shader/runtime atmosphere pass, plus supporting cache builders,
  shader texture builders, validation/oracle tools, and diagnostics. Initial
  implementation collaborators live under `implementation/`; shared
  configuration/facts models live under `models/`, starting with
  the `SharedModel` aggregate model and the implemented `SpectralModel`;
  generic pure numeric utilities live under `utils/`, starting with
  `ScalarMath`, `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`, `ArrayMath`, and `SampleMath`.
  Production analytic fixtures now start under `fixtures/` with
  `analytic-invariants.json`, normalized to AMA numbered references and
  compact reference pointer objects.
- `shared/algorithm32/POC/`: centralized POC implementation bundle, including
  a pared-down module for the original non-shader `bruneton-start-fresh` base
  algorithm, pure-module extraction of accepted later POCs, and compatibility
  shims for old runner filenames. These clean, tested POC modules are the
  starting basis for production code. Use them as the promotion source, but do
  not treat the `POC` folder itself as the production module boundary.
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/`: cleanroom and
  shader-lab evidence/design history, not the final production-doc home.
- `scripts/flat/algorithm32-shader-lab/`: POC experiment lane, not production
  code.

## POC Evidence

The local Sun second-order experimental lane is now closed as evidence for the
production-design pivot. Its tracker remains:

- [Local Sun Second-Order POC](../plans/atmosphere-cleanroom-design/local-sun-second-order/README.md)

The currently preserved POC implementation bundle is:

- `shared/algorithm32/POC/`

The preserved POC bundle contains the shared Three shader class and GLSL used
by the latest local lane. It now also contains the accepted local finite-Sun
source resolver, the local incident-cache `Data3DTexture` upload helper, and
the live Three scene-color/depth to Algorithm32 display-pass wrapper:

- `shared/algorithm32/POC/local-second-order/local-sun-source.js`
- `shared/algorithm32/POC/three/local-second-order-renderer.js`

The script lane still owns browser harness, terrain/gallery composition,
renderer diagnostics, render-scale/antialias controls, and remaining
source-light review plumbing:

- `scripts/flat/local-second-order/page/local-second-order.js`
- `scripts/flat/local-second-order/page/subjective-scenes.js`

Those scripts import the POC shader/render helpers; they do not carry a
separate shader body or local incident-cache texture builder.

The local Sun second-order POC lane has now moved past the original
`013-three-integrated-gpu-local-l2-blocked` stop point. The reusable cache
implementation lives in `shared/algorithm32/POC/local-second-order/local-cache.js`.
It preserves the accepted `IncidentRadianceCache` shape:

```text
L1_incident = incomingRadiance.sample(position, incomingDirection, wavelength)
cache lookup = z, rho, incomingDirection, wavelength
```

Production Algorithm32 should expose second-order incoming radiance through
`LightSourceModel.sampleIncidentRadiance(...)`. Specific light-source
implementations may use `IncidentRadianceCache` internally when second-order
transport is active. The cache is named for what it stores: spectral radiance
arriving at a sample point from an incoming direction. It is not a caller
option or separate provider; tests and validation may fixture or inspect the
cache implementation through internal seams without changing the public
algorithm API.

For local Sun caches, `rho` is horizontal distance from the local Sun
subpoint on the flat plane. Incoming direction is stored in the Sun-subpoint
local radial/tangential/up frame, not raw world coordinates. Cache keys must
include public Sun, atmosphere composition, and geometry interface values,
execution configuration, cache resolution, incoming-direction set, wavelength
grid, and packing version.

The Three POC pass now exposes `flat-local-second-order-atmosphere`. Its
accepted browser POC uploads IncidentRadianceCache as a WebGL2/Three
`Data3DTexture` with `rho` on X, `z` on Y, and
`directionIndex * spectralGroupCount + spectralGroupIndex` on Z. The 15
Algorithm32 spectral channels are packed into four RGBA groups:
`0..3`, `4..7`, `8..11`, and `12..14` plus padding. The shader reconstructs
the flat camera ray, converts each incoming direction to the same
Sun-subpoint local radial/tangential/up frame, samples the packed cache, and
feeds that `L1_incident` into the same second-order accumulation shape as the
CPU soft shader.

The current production-shape evidence keeps the Three-native render path:

```text
Three scene + camera
  -> scene color render target + DepthTexture
  -> Algorithm32 fullscreen ShaderMaterial
  -> output target or screen
```

It also keeps source/geometry adapters and CPU soft-shader validation. It
discards packet replay as the normal renderer architecture, standalone raw
WebGL renderers as the target integration, and per-object atmosphere material
duplication as the primary app strategy.

The refined POC soft shader remains evidence, not a production class. Its
hit-vs-sky branch is promoted into geometry-owned ray-path resolution:
`EvaluationRequest` carries ray facts and, when already bounded by a surface
hit, a `distanceMeters` endpoint. `GeometryModel.resolveRayPath(...)` owns the
distinction between the POC `traceSegmentForThreeHit(...)`/`hitDistanceMeters`
path and the `traceSkyForThreeRay(...)`/`distanceToSkyBoundary(...)` path, so
CPU/reference algorithm execution only integrates the resolved distance.

Accepted POC evidence in `tmp/atmosphere/local-second-order/`:

- `011-local-cache-shape`: accepted the local frame cache shape after
  rejecting raw world direction caching in `010`.
- `012-cpu-soft-shader-local-l2`: accepted CPU first-plus-second-order local
  closest and local 90 degree cases, with distant controls carried in the same
  matrix.
- `018-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local closest.
- `019-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local 90 degrees.

Open design followups before production promotion:

- promote the POC cache helper into a production
  `shared/algorithm32/production/` module with typed source/cache config
  contracts;
- replace the probe-scene validation with full-scene CPU/GPU image parity
  against the production scene renderer and stable camera controls;
- decide whether production GPU storage stays `Data3DTexture` or needs a 2D
  atlas fallback for target devices;
- add cache invalidation and stale-key failure behavior at the production
  cache manager boundary;
- keep local direct solar-disc radiance, local ground bounce, and cone/flashlight
  source behavior as separate future source models.

## Promotion Rule

When a cleanroom or shader-lab design decision becomes production policy,
promote the corresponding clean POC module/contract into
`shared/algorithm32/production/` and summarize the durable contract here
instead of making production agents mine the experiment lane. Keep only one
canonical owner for each production fact.
