# Algorithm32 Production Documentation

This folder is the documentation home for the production Algorithm32 module.

Current status: production Algorithm32 shader/runtime work is the active
handoff after reconciliation. The production code root is
`shared/algorithm32/production/`, which currently contains the Jasmine test
lane, AMA reference registry, ambient `types.d.ts` homes, initial
consumer-provided `LightSourceModel`, `AtmosphereModel`, `GeometryModel`, and `Color`
interface files, implemented first-slice `Algorithm32` facade lifecycle,
`Reference` orchestration, `ShaderBuilder` setup validation,
`SpectralCalculator`, incident-radiance setup utilities, source-owned
distant/local light-source and incident-radiance cache families,
`CanonicalAtmosphere`, `SphericalEarthGeometry`, `FlatEarthGeometry`, the
initial `SharedModel` aggregate model, the implemented `SpectralModel`
component model, and scaffold/model guardrail specs. The
production deliverable is a usable
shader/runtime atmosphere pass; CPU reference code is support for validation,
internal shader texture building, cache construction, future diagnostics, and
tests.
Use [Reconciliation Conclusions](../reconciliation/conclusions.md) as the
primary production implementation driver from the POC. It consolidates the
accepted reference/shader path, adjusted abstraction ownership, and data-flow
contracts. The reconciliation topic, code, and experiment records remain
relevant supporting implementation material; older pre-reconciliation lanes
are replaced as implementation references. Use
[Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md)
for remaining provenance gaps.
The primary facade receives concrete configured abstraction instances at
creation time: light source, atmosphere, geometry, optional Color/display,
spectral basis, execution controls, and shader policy. Creation from app-level
description or preset objects is a later convenience layer outside the core
facade; the facade should not interpret broad profile descriptions into
domain objects. Algorithm32 core output is spectral or spectral-group radiance
and transmittance; display conversion is a separate `Color` abstraction that
consumes spectral output when a renderer or offline tool needs RGB, exposure,
tone mapping, or debug-color mapping. Those abstractions should be defined as
public interfaces in the Algorithm32 API itself, not only as
implementation-private packet shapes.
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
shader mode, cache/resource policy, capability failure policy, and
render-target/HDR/depth policy. Debug views are deferred with diagnostics and
are not first-production runtime shader API. The Three setup request supplies
attachment handles such as composer, scene, and camera. Scene binding is setup-time
attachment state; moving to another scene/composer/camera uses teardown and
re-setup unless a later framework integration need justifies a narrow rebind.
The current assumed API shape is a configured Algorithm32 facade instance, one
per independent simulation window, coordinating a CPU/reference algorithm
execution class and a runtime shader builder over a
facade-owned shared configuration/facts model.
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
policy, and fail-loud local-cache binding so callers do not need Algorithm32
shader/cache domain knowledge. Stable diagnostics remain deferred.
Live app note: the local Polylith server runs over HTTPS on port 443. Use
`https://localhost/flat/globe-simulation/` with local certificate validation
disabled for manual probes. The latest retained live artifact,
`tmp/atmosphere/app-globe-localhost-https/images/initial-page.png`, shows the
Globe Simulation page shell with an empty black render area. Do not repeat
long Puppeteer/canvas readback loops without lightweight instrumentation and
tight timeouts; the last attempt consumed excessive CPU and was killed.
Shader assembly follows the reconciliation ownership split: specific
abstraction interfaces own their shader contributions and semantic payloads,
while `ShaderBuilder` owns the mechanical source assembly, compatibility
checks, texture/resource preparation, bindings, pass/material installation,
frame/update lifecycle, and cleanup.
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
`setupShader`, `evaluate`, deferred `getDiagnostics`, and `dispose`;
`buildTexture` and `validate` are not primary app-facing methods.
The current prescriptive app integration contract is
[Algorithm32 App Integration Guide](integration.md). It covers the production
React/R3F composer path for a new app, including the reusable wrapper shipped
from `shared/algorithm32/production/react/`, geometry-owned endpoint objects,
source-owned lighting objects, app-authored solid scene inputs, binding
updates, config refresh, diagnostics, and troubleshooting.
Local Sun configuration and calibration must resolve to the public Sun
interface before reaching transport, texture building, cache, or runtime
shader code. For Sun, atmosphere composition, and geometry, anything not
defined by the corresponding public interface or public input/resolver types
stays private to that owner domain.

## Current Implementation Reference

The production implementation reference is now
[Reconciliation Conclusions](../reconciliation/conclusions.md). That document
is supported by the reconciliation topic docs, reconciliation POC code, and
reconciliation experiment records:

- `agents/topics/apps/flat/reconciliation/`
- `scripts/flat/reconciliation/POC/`
- `tmp/atmosphere/reconciliation/`

Those reconciliation materials are relevant to production promotion, but
production code must not runtime-link to them. Older pre-reconciliation
local-second-order, cleanroom, shader-lab, `shared/algorithm32/POC/`, and
source-contract lanes are no longer implementation references unless the user
explicitly asks for historical archaeology.

Use [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
as the working tracker for differences between the accepted reconciliation
architecture and the current production scaffold.
Use [Algorithm32 Implementation Plan](implementation-plan.md) as the staged
execution outline for promoting the reconciliation POC into production code,
tests, fixtures, and docs.
The production top-level API shape remains primary: `Algorithm32`, the
production dependency aggregate, `Reference`, and `ShaderBuilder` stay as the
boundary while reconciled implementation details move underneath them.
Use the reconciliation POC for all production implementation details unless
there is an explicit recorded production conflict. Current recorded
conflicts/exceptions are the retained top-level production shape,
explicit unit-bearing boundaries for convertible quantities, deferred
diagnostics, and the config/setup-vs-runtime failure policy.
Type definitions and property names should use the reconciliation POC shapes
and names because most production implementation code will be lifted from that
code base. Rename only when a POC name is actively misleading in the production
contract, and document the one-to-one mapping. Any quantity that can be
represented in different units through conversion must use an explicit
unit-bearing packet at durable/API boundaries; avoid implicit unit scalar
types there. Unit strings inside those packets use plural spellings; singular
spellings fail validation instead of being treated as aliases.
Failure policy is split by lifecycle phase: fail loudly during configuration
and setup, including constructor validation, `setConfig`, `setupShader`,
awaited handle config updates, and resource build/bind setup; once the runtime
render path is live, log runtime failures and continue with the last valid
state, no-op, or fallback path when possible.

The production implementation lives in:

```text
shared/algorithm32/production/
```

## Fresh Bootstrap Checkpoint

As of July 11, 2026, fresh agents should treat the production shader lane as an
active implementation, not a scaffold-only design topic. The promoted concrete
slice includes:

- canonical atmosphere, spectral, display, runtime, validation, and artifact
  constants in `constants/Algorithm32CanonicalData.js`;
- `BrunetonColorDisplayModel` as the concrete Color/display model, including
  CPU spectral-to-display conversion, inverse tone mapping, albedo fitting,
  and Color-owned shader contribution;
- concrete geometry, atmosphere, light-source, source-created cache, Color,
  and core transport owners now provide the distant spherical and local flat
  shader contributions through owner-local methods. Source-created incident
  caches feed automatic shader setup through cache-owned descriptors,
  contributions, and texture payloads. The old aggregate profile factories
  have been moved to `shared/algorithm32/production/quarantine/` for later
  deletion;
- `ShaderUniformDescriptor.defaultValue` support and `ShaderBuilder` binding
  of missing uniforms from descriptor defaults. Required shader bindings now
  fail loudly before pass installation when no setup/resource value or uniform
  default can satisfy them. Cache descriptor facts and cache texture payload
  facts are also validated before resource creation;
- preliminary flat-app integration now routes the flat simulation through the
  production local-source/flat-geometry Algorithm32 path and the globe
  simulation through the production distant-source/spherical-geometry path.
  The active app integrations create real Three `EffectComposer` instances,
  add `RenderPass` for the solid scene, pass those composers to
  `Algorithm32.setupShader(...)`, provide live camera
  matrix/model-position bindings, and bypass the old feature-local atmosphere
  shaders. The production React wrapper now creates and mounts the required
  geometry endpoint and source-light objects from
  `config.geometry.createThreeEndpointObjects(...)` and
  `config.lightSource.addSceneLighting(...)`; the owner-created
  flat ground and globe surface endpoint objects carry the
  `geometry-ground-boundary` tags and `metersPerSceneUnit = 1000` scale facts
  consumed by `SceneInputCapture`. This follows the reconciliation
  experimental browser runner's composer and km-to-meter scaling conventions.
  The globe app bridge
  selects the spherical geometry's `model-space` scene frame and uses a local
  horizon/object depth cap because the app scene is planet-centered/model-space,
  not the reconciliation planet runner's observer-local frame. The fullscreen
  production pass uses Three `RawShaderMaterial` for its GLSL3 shader so Three
  does not redeclare the `position` vertex attribute. This is a first
  integration pass, not correctness evidence for Algorithm32 output;
  source-light synchronization, scene-mapping polish, live app rendering, and
  browser readback/visual parity remain open. The old feature-local atmosphere
  shader components and their direct legacy spec were removed. The flat and
  globe calibration app views now default the rendered camera to 10 meters
  above modeled ground; the flat renderer now consumes
  `observer.view.cameraHeightKm` directly instead of the old altitude/1.7-meter
  fallback, starts the camera at `[0, cameraHeightKm, 0]`, and initially looks
  horizontally along `-Z` with pitch `0`. Flat live shader bindings now map the
  R3F observer-local camera position through
  `FlatEarthGeometry.mapObserverLocalScenePointToModelPosition(...)`, matching
  the flat ground basis used by the owner-created endpoint objects. Flat/globe
  scene components are minimal camera/canvas wrappers around the base composer
  instead of duplicating ground/light construction. The R3F bridge is reduced
  to the smallest production shape: it supplies renderer/camera/size to the
  class wrapper, calls the Algorithm32 frame method, and renders the wrapper's
  solid scene as fallback while setup is pending or failed.

Production geometry now also exposes `resolveSceneDepthMaxMeters(...)` for
the default scene-depth capture cap, so app setup only supplies
`sceneDepthMaxMeters` when it deliberately adds endpoint objects beyond the
geometry-owned range.

The current verification checkpoint is
`npm run test:algorithm32:production` passing 229 specs with 0 failures, plus
`npm run build` passing with the known Babel deoptimisation and existing
circular-dependency warnings. The flat app integration also passes
`npm run test:ui:flat` with 120 specs and 0 failures. The current internal short-code reference for
promoted POC constants/display/profile shader facts is
`(script a32-poc-color-032)` in
`shared/algorithm32/production/references.md`. Remaining concrete work is
resource/capability polish around the promoted path and source-light
or scene-mapping adapters where runtime integration needs them. The broader
non-spectral unit-neutral configuration migration remains a cleanup when
those APIs are next touched.
First re-check the live HTTPS app's globe/flat canvas with lightweight
instrumentation after the bare R3F bridge fallback and observer-local flat
binding fixes.
Browser/readback parity fixtures for scene color,
ray-length/depth capture, hit mask, and selected-pixel output are the next
validation layer once the preliminary real app composer bridge visibly renders.
The new `flat32` app is the current vanilla debugging baseline: it performs
the same production flat/local Algorithm32 setup directly in `src/flat32/index.js`
without React or the flat app adapter, and uses Three's built-in
`PointerLockControls` for stand-still mouse look. It is an integration
POC/reference bench for fixing the real `src/flat` app; accepted behavior
should be ported back into the real flat app integration rather than treating
`flat32` as the product surface.
The active `flat32` focus is the atmosphere/star dimming diagnostic. Synthetic
stars and the A-H ladder are captured scene inputs, while their labels are DOM
overlays outside the atmosphere pass. The latest Color/display fix prevents
view transmittance from dimming outside-atmosphere scene pixels: captured
scene color is multiplied by view transmittance only when the captured
endpoint lies inside the atmosphere path. Manual visual retest remains
pending after the passing production tests/build.
Renderer-produced depth/hit capture is now promoted as the reusable
`SceneInputCapture` composer pass that runs ahead of the Algorithm32
atmosphere pass; shader-facing object/material ID textures are intentionally
not part of the first production atmosphere algorithm contract. Final
Color/display composition still consumes renderer-produced hit-pixel scene
color when composing endpoint color with Algorithm32 path radiance and the
conditional scene transmittance owned by Color.

## Current Authority

- [Algorithm32 Status](status.md) is the concise current handoff for the
  design checkpoint, reload order, and next work.
- [Algorithm32 Requirements](requirements.md) is the current requirements
  entry point. It divides requirements into implementable ownership domains;
  define and accept this layer before freezing production API names or packet
  shapes.
- [Reconciliation Conclusions](../reconciliation/conclusions.md) is the
  current implementation authority for production reference/shader work.
- [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
  records the architecture/API gaps that must be resolved during promotion.
- [Algorithm32 Implementation Plan](implementation-plan.md) is the current
  staged execution outline for the production promotion.
- [Production Code Architecture And POC Review](production-code-architecture-poc-review.md)
  records the July 9, 2026 production-code review against the design and the
  reconciliation POC.
- [Algorithm32 Production Design](production-design.md) records the
  design-stage module boundaries, local Sun solar-zenith calibration UX/API
  notes, non-goals, promotion sequence, and open questions needed to satisfy
  the requirements.
- [Algorithm32 Primary Facade API Draft](api-facade-draft.md) is the current
  design draft for the main configured facade class and the runtime shader
  handle it returns.
- [Algorithm32 App Integration Guide](integration.md) is the prescriptive
  production integration guide for a new React/R3F app, including config
  factories, the reusable class-based Algorithm32 wrapper plus tiny R3F bridge
  shipped from `shared/algorithm32/production/react/`,
  geometry/light-source-owned scene objects, app-authored endpoints, frame
  loops, resizing, config updates, and troubleshooting.

## Provenance Only

These catalogs are available only when a named source/provenance gap requires
external reference detail. They are not implementation references and are not
default reload sources.

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
collaborators, `SpectralModel`, and `SharedModel`. The package-level scaffold
walk intentionally ignores `quarantine/` because files there are archival,
not active production implementation. The latest focused lane covers 219
specs with 0 failures, including contract-alignment guards, facade
lifecycle coverage, fixture-backed `SpectralCalculator` transport helper
coverage, `Reference` orchestration, `ShaderBuilder` setup validation,
descriptor synthesis, shader compatibility/assembly, required Color-owned
output contributions, cache texture resource preparation, Three-compatible
pass installation, reusable scene depth/hit capture, required binding
validation, cache descriptor/payload validation, the incident-radiance cache
coordinator, source-owned distant/local light-source/cache families, canonical atmosphere and
spherical/flat geometry models, concrete owner-provided geometry, atmosphere,
light-source, source-created cache, and core transport shader contributions,
canonical data constants, concrete Color display conversion, plural unit
validation for wavelength packets, and owner-path distant spherical / local
flat assembly fixtures.

## Production Split

- `agents/topics/apps/flat/algorithm32/`: production documentation for the
  official Algorithm32 module.
- `shared/algorithm32/production/`: production implementation code for the
  usable shader/runtime atmosphere pass, plus supporting cache builders,
  shader texture builders, validation/oracle tools, and diagnostics. Initial
  implementation collaborators live under `implementation/`; shared
  configuration/facts models live under `models/`, starting with
  the `SharedModel` aggregate model and the implemented `SpectralModel`;
  concrete source-owned cache families live under `light-sources/`;
  concrete atmosphere models live under `atmospheres/`; concrete geometry
  models live under `geometries/`;
  generic pure numeric utilities live under `utils/`, starting with
  `ScalarMath`, `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`, `ArrayMath`, and `SampleMath`.
  `SpectralCalculator` should be promoted as a common internal utility used by
  both `Reference` evaluation and incident-radiance cache building, not as a
  `Reference`-owned-only helper or primary public facade API.
  Production analytic fixtures now start under `fixtures/` with
  `analytic-invariants.json`, normalized to AMA numbered references and
  compact reference pointer objects.
  Validation fixtures are unit-test artifacts: keep them in checked-in
  production fixture ledgers consumed by specs. Cite third-party source rows
  through `shared/algorithm32/production/references.md`. First-pass internal
  experiment references also live in `references.md` as short codes cited with
  `(script <code>)`; later evidence collection adds exact script, record,
  artifact, criterion, and run id details to
  `shared/algorithm32/production/evidence.md`.
- `agents/topics/apps/flat/reconciliation/`,
  `scripts/flat/reconciliation/POC/`, and
  `tmp/atmosphere/reconciliation/`: the relevant reconciliation topic, code,
  and experiment records for production promotion.
- `shared/algorithm32/POC/`: pre-reconciliation archive bundle. Do not use it
  as the production promotion source.
- `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/` and
  `scripts/flat/algorithm32-shader-lab/`: pre-reconciliation archive lanes,
  not production implementation references.

## Pre-Reconciliation Archive

The local Sun second-order experimental lane is pre-reconciliation archive
material. Its tracker remains:

- [Local Sun Second-Order POC](../plans/atmosphere-cleanroom-design/local-sun-second-order/README.md)

The archived pre-reconciliation POC implementation bundle is:

- `shared/algorithm32/POC/`

The archived POC bundle contains the shared Three shader class and GLSL used
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
setup-bound `IncidentRadianceSampling`, matching the reconciliation POC. The
light source creates the appropriate cache family, the cache owns the sampler
and shader payload, and `Reference` consumes a configured default sampler
unless an evaluation request supplies an `incidentRadianceSampling` property.
That request property overrides the default, including explicit `null` for a
no-cache evaluation. The cache is named for what it stores: spectral radiance
arriving at a sample point from an incoming direction. Tests and validation may
fixture or inspect the cache implementation through internal seams without
changing the public algorithm API.

For local Sun caches, `rho` is horizontal distance from the local Sun
subpoint on the flat plane. Incoming direction is stored in the Sun-subpoint
local radial/tangential/up frame, not raw world coordinates. Cache keys must
include public Sun, atmosphere composition, and geometry interface values,
execution configuration, geometry-resolved cache-domain descriptors,
incoming-direction set, wavelength grid, and packing version. Production
`z`/`rho` resolution is derived from geometry/cache-domain descriptors; fixed
dimensions are validation fixtures or named local-domain quality presets.

The Three POC pass now exposes `flat-local-second-order-atmosphere`. Its
accepted browser POC uploads IncidentRadianceCache as a WebGL2/Three
`Data3DTexture` with `rho` on X, `z` on Y, and
`directionIndex * spectralGroupCount + spectralGroupIndex` on Z. The 15
Algorithm32 spectral channels are packed into four RGBA groups:
`0..3`, `4..7`, `8..11`, and `12..14` plus padding. The shader reconstructs
the flat camera ray, converts each incoming direction to the same
Sun-subpoint local radial/tangential/up frame, samples the packed cache, and
feeds that `L1_incident` into the same second-order accumulation shape as the
CPU/reference evaluator.

The current production-shape evidence keeps the Three-native render path:

```text
Three scene + camera
  -> scene color render target + DepthTexture
  -> Algorithm32 fullscreen RawShaderMaterial
  -> output target or screen
```

It also keeps source/geometry adapters and reference-oracle validation. It
discards the POC postprocess validation harness, packet replay as the normal
renderer architecture, standalone raw WebGL renderers as the target
integration, and per-object atmosphere material duplication as the primary app
strategy.

The refined POC postprocess validation harness remains historical evidence
only, not a production class. Its hit-vs-sky branch is promoted into
geometry-owned ray-path resolution: `EvaluationRequest` carries ray facts and,
when already bounded by a surface hit, a `distanceMeters` endpoint.
`GeometryModel.resolveRayPath(...)` owns the distinction between the POC
`traceSegmentForThreeHit(...)`/`hitDistanceMeters` path and the
`traceSkyForThreeRay(...)`/`distanceToSkyBoundary(...)` path, so CPU/reference
algorithm execution only integrates the resolved distance.

Accepted POC evidence in `tmp/atmosphere/local-second-order/`:

- `011-local-cache-shape`: accepted the local frame cache shape after
  rejecting raw world direction caching in `010`.
- Local L2 validation record: historical validation evidence for CPU
  first-plus-second-order local closest and local 90 degree cases, with
  distant controls carried in the same matrix. Do not promote the POC
  postprocess validation harness.
- `018-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local closest.
- `019-three-integrated-local-l2-probe`: accepted the integrated Three GPU
  cache path for local 90 degrees.

Open design followups before production promotion:

- promote the POC cache helper into a production
  `shared/algorithm32/production/` module with typed source/cache config
  contracts;
- replace the probe-scene validation with full-scene GPU-vs-reference image
  or selected-pixel parity against the production scene renderer and stable
  camera controls;
- keep initial production GPU storage on WebGL2/Three `Data3DTexture`;
  introduce a 2D atlas fallback later only if target devices require it;
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
