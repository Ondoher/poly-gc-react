# Algorithm32 Production Design

Status: design stage only. No production implementation has been promoted into
`shared/algorithm32/` outside the preserved `POC` bundle yet.

This document defines the current production shape to build next. The API
design should be derived from [Algorithm32 Requirements](requirements.md)
before production names or packet shapes are frozen. Source-mining catalogs
and POC evidence remain supporting inputs, not the main design surface.
The current caller-facing API sketch is
[Algorithm32 Primary Facade API Draft](api-facade-draft.md).

## Design Goal

Create a stable production Algorithm32 module under:

```text
shared/algorithm32/
```

The production module should satisfy the accepted requirements by delivering a
usable shader/runtime atmosphere pass for the app render path. That shader
should support both spherical distant-Sun atmosphere rendering and flat local
point-Sun atmosphere rendering, including the accepted local second-order
incident-cache contract. CPU/oracle tools, cache builders, and validation
harnesses are support surfaces for proving and feeding the shader, not the
end-user product surface. Shader texture/cache builders are internal resource
preparation support and may share mechanics with the CPU reference path; they
are not part of the primary consumer facade.

## Production Inputs

- `shared/algorithm32/POC/` is the preserved implementation source to promote
  from, not the final production boundary.
- `scripts/flat/local-second-order/page/local-second-order.js` and
  `scripts/flat/local-second-order/page/subjective-scenes.js` remain
  implementation evidence for the latest live-scene shader wrapper behavior.
  They import the preserved POC `Algorithm32AtmospherePass` instead of carrying
  a separate shader copy, but they still own the accepted cache-texture
  creation, source-matrix pass setup, source-driven scene lighting, render
  scale/antialias review controls, and renderer diagnostics until those
  responsibilities are promoted.
- [External Reference Log](external-reference-log.md),
  [Fixture Sources](fixture-sources.md), and
  [Reference Fixtures Evidence](evidence/reference-fixtures/README.md) are
  source-mining inputs for external provenance, constants, and validation
  fixture rationale.
- Cleanroom, shader-lab, local-second-order, and numbered artifact docs are
  background evidence. Load them only when the task needs experiment history,
  parity evidence, accepted artifact details, cache behavior, or POC source.
- Remaining work is production design and promotion, not more POC iteration by
  default.

## Production Boundaries

`shared/algorithm32/` should become the only production implementation owner
for Algorithm32 atmosphere behavior. It should not import from
`shared/algorithm32/POC/` once a promoted module exists.

The assumed public shape is a configured facade instance, created once per
independent simulation window. The facade contains the validated Algorithm32
configuration and coordinates two internal implementation classes: an
algorithm/reference implementation for evaluation, texture/cache construction,
and validation support, and a shader implementation for runtime Three/WebGL
setup and rendering. Both implementations share a private core for transport,
input validation, spectral math, cache descriptors, and packing rules. Shared
core state should be pure, stateless, immutable, or explicitly instance-bound
so multiple simulation windows can run side by side without global mutable
configuration or resource leakage.

The current POC and latest experimental-lane audit add these external API
requirements:

- The normal renderer input is a live Three scene rendered into color and
  depth textures, followed by an Algorithm32 fullscreen shader pass. Scene
  packets and Raycaster captures are validation/oracle inputs only.
- The facade must reduce caller domain knowledge by owning or exposing
  source-driven synchronization for scene lights and atmosphere uniforms, plus
  geometry-driven camera/world/depth/no-hit sky policy.
- The runtime adapter must expose capability diagnostics and fail loudly for
  unsupported WebGL/Three features, accidental software-renderer fallback,
  unsupported source/geometry/scattering combinations, and missing or stale
  local second-order cache resources.
- Local second-order rendering requires an explicit validated incident-cache
  texture/descriptor; it must not silently fall back to first-order when the
  requested second-order feature set cannot be satisfied.
- CPU soft-shader scene packets, selected-pixel readbacks, image-delta
  summaries, and postprocess-versus-integrated galleries remain validation
  surfaces, not normal app render input.

Planned module boundaries should follow the ownership domains in the
requirements. Each boundary should be implementable and testable as a mostly
self-contained code surface with explicit interfaces to adjacent boundaries:

- `api-contract`: public interface definitions, version markers,
  serialization contracts, validation metadata requirements, interface
  encapsulation rules, and the public error taxonomy. This boundary owns the
  API surface that the other modules implement against.
- `input-contracts`: the three algorithm input abstractions: Sun, atmosphere
  composition, and geometry. Sun covers distant directional Sun and flat local
  finite Sun. Atmosphere composition covers spectral channels, scattering,
  extinction, absorption, density profiles, phase parameters, and provenance.
  Geometry covers spherical atmosphere geometry and flat z-up atmosphere
  geometry. This boundary must publish the public API interfaces for those
  inputs and for the combined algorithm-input packet. Each input interface owns
  its domain's external state: Sun-related, composition-related, and
  geometry-related details stay behind resolvers or factories unless
  explicitly exposed by the corresponding public interface or its public
  input/resolver types.
- `calibration`: local-Sun clock synchronization and source-power calibration
  helpers that derive a resolved public `Sun` input from
  user-understandable normalized location/date/time-zone/view context.
- `transport`: CPU reference support for validation, diagnostics, cache
  construction, shader texture building, optical-depth/transmittance helpers,
  and first-order and second-order path radiance. This boundary owns the
  shared transport core used by both per-path evaluation and texture building.
- `local-incident-cache`: local direct incident-field oracle, cache config,
  Sun-subpoint local radial/tangential/up frame transforms, cache keying,
  fail-loud stale/mismatch behavior, and GPU packing metadata.
- `texture-builder`: explicit precompute APIs that build, key, pack, and
  describe shader textures from the same public Sun, atmosphere-composition,
  geometry, and execution-configuration facts used by CPU reference and cache
  support. This boundary is a separate public surface from per-path
  evaluation; it shares the transport core but owns grid traversal, packing,
  descriptors, and cache validation.
- `runtime-shader`: the production shader/runtime surface, including the
  first Three adapter/pass, shader packet adapter, WebGL texture upload policy,
  uniform mapping, source/geometry/light synchronization, live scene
  color/depth composition, capability diagnostics, and debug mode mapping.
- `display`: spectral-to-output-color conversion, including CIE/XYZ/RGB
  mapping, display color space, exposure, tone mapping, and debug-display
  policy. Display conversion must not change the Sun, atmosphere composition,
  geometry, or transport facts. This boundary must publish the public display
  conversion interface separately from the algorithm-input interfaces.
- `validation`: deterministic smoke/parity helpers that prove promoted modules
  still match accepted POC evidence without generating new numbered artifacts.

The flat app owns user/session context: current view location, date/time,
time-zone selection, geocoding, terrain asset policy, and camera choreography.
Algorithm32 owns pure Sun, atmosphere composition, geometry, calibration,
execution configuration, transport, cache, shader texture building, display
conversion, adapter, and validation contracts.
Calibration helpers may compute deterministic solar-zenith and local-source
synchronization values from a normalized app-provided context packet, but
Algorithm32 must not own or persist the app's live UI state.
Local Sun configuration and calibration state must not influence transport,
texture building, cache sampling, or runtime shader behavior except by
resolving to the public Sun interface.

## Local Sun Calibration UX

The local Sun should use calibration as the normal setup path instead of asking
users for a raw brightness, luminosity, irradiance, or reference-distance
value. External physical units would be technically honest but poor UX for the
flat/local model, because most users do not have an intuitive feel for them and
the local model has no natural external clock reference.

Default UX:

```text
Use current view location
Use current date
Synchronize on solar zenith
Recalibrate
```

Basic user-authored local Sun settings should stay small:

- Sun altitude;
- Sun diameter;
- northern latitude limit;
- southern latitude limit.

Location/date should usually come from the current simulation context, with
overrides available when needed. Orbit direction and period are standardized
model behavior, not user-entered fields: clockwise, one orbit per solar day.

The basic flow is:

1. Use the current view location and current date by default. Allow explicit
   location/date overrides.
2. Compute standard-model solar zenith for that normalized location/date/time
   context. In ordinary UI language this is solar noon, the time when the
   standard Sun is highest.
3. Resolve the local-model closest approach for the same normalized context.
4. Synchronize clocks by aligning local closest approach with standard solar
   zenith.
5. Calibrate the local Sun's internal source power so closest approach matches
   the standard Sun's reference illumination at solar zenith.
6. Store the derived clock offset and derived source power as calibration
   results. Users can recalibrate at any time when normalized location, date,
   time-zone, or view context changes.

The user-facing story should be:

```text
Calibrate the local Sun by synchronizing closest approach with solar zenith.
```

After calibration, the UI should report the anchor rather than expose the raw
derived scalar:

```text
Calibrated to solar zenith
San Jose, CA
June 21, 2026
Standard solar noon: 1:09 PM
Local closest approach: synced
```

The app may also show derived display values after the location, clock, and
latitude model resolve. One useful value is the local Sun's instantaneous
orbital speed. This value should be evaluated from the current simulation time,
not treated as a daily constant, because the annual latitude migration changes
the orbit radius continuously.

```text
orbitRadiusNmi(t) = (90 - resolvedLatitudeDeg(t)) * 60
tangentialOrbitSpeed(t) = 2 * pi * orbitRadius(t) / 24 hours
```

If the UI chooses to display total spiral-path speed instead of tangential
orbit speed, include the slow radial term from latitude migration:

```text
totalPathSpeed(t) = sqrt(tangentialOrbitSpeed(t)^2 + radialSpeed(t)^2)
```

For the accepted San Jose summer-solstice calibration instant on
`2026-06-21`, the resolved latitude is approximately `23.5 deg N`, so the
tangential display value is approximately:

```text
Current orbital speed: 1,045 knots / 1,202 mph / 1,935 km/h
```

This is a derived explanatory value, not a configuration input.

The production API should expose calibration methods, not just source factory
methods. Proposed method responsibilities:

- accept normalized app-provided location/date/time-zone context without
  owning app UI state;
- compute the standard solar-zenith time for that normalized context;
- resolve the local Sun closest-approach phase for that normalized context;
- derive the clock offset that aligns closest approach to solar zenith;
- derive the local source-power scalar needed to match the standard solar
  zenith illumination;
- return a serializable calibration packet containing user inputs, derived
  values, assumptions, and versioned formulas;
- rebuild a resolved local Sun value that conforms to the public Sun interface
  at any requested view time.

Calibration packets and local Sun configuration are not main-algorithm inputs.
The main algorithm consumes only Sun, atmosphere composition, and geometry
interfaces, so local Sun details must be normalized into the public Sun
interface before transport, texture building, cache sampling, or shader
runtime execution.

The public Sun, atmosphere composition, and geometry interfaces, plus their
public input/resolver types, are the only external surfaces for their domains.
Any local orbit, calibration, composition preset, coefficient derivation,
geometry factory, scene-adapter, provenance, or source-factory detail not
present on the relevant public interface stays private to its owner domain.

Normal configuration should not include a brightness slider after calibration,
because it would undermine the promise that the local Sun is matched to the
standard Sun at solar zenith. If an artistic override is needed later, expose it
as render exposure or display tone mapping, not as source brightness.

## Non-Goals

- Do not add production code during this design stage.
- Do not preserve legacy aliases unless a migration bridge is explicitly
  requested.
- Do not make production consumers import from `shared/algorithm32/POC/`.
- Do not make generated artifacts, live runner state, selected UI state, or
  cache sidecars canonical sources of production facts.
- Do not make production design docs carry numbered artifact history. Keep
  that in experiment evidence, status/task trackers, or explicit evidence
  folders.
- Do not expose local Sun brightness as a primary basic-user setting once
  solar-zenith calibration exists; brightness/source power is derived
  calibration state.
- Do not fold terrain asset conversion, star-field display tuning, local solar
  disc rendering, ground bounce, or spotlight/cone source behavior into the
  first production Algorithm32 contract.

## Design Decisions

- The accepted local incident cache is keyed by public Sun, atmosphere
  composition, and geometry interface values, execution configuration, `z`,
  `rho`, incoming direction set, wavelength grid, and packing version.
- Local incoming directions use the Sun-subpoint local radial/tangential/up
  frame, not raw world coordinates.
- Cache lookup must fail loudly on Sun mismatch, invalid position, stale key,
  or missing sample.
- GPU packing may begin with the accepted `rgba-3d-texture-v1` layout:
  `rho` on X, `z` on Y, and
  `incomingDirectionIndex * spectralGroupCount + spectralGroupIndex` on Z.
  A 2D atlas fallback is an open device-support decision, not a reason to keep
  the cache contract ambiguous.
- Spherical distant and flat local Sun models share the same Algorithm32
  transport shape. Differences belong in Sun, atmosphere-composition, and
  geometry contracts plus Sun sampling, not in duplicated render pipelines.
- Per-path evaluation and texture/cache building should remain separate
  implementation responsibilities over a shared transport core. Per-path
  evaluation may remain public for CPU/reference consumers. Texture/cache
  building should stay implementation-owned behind awaited shader setup and
  awaited shader-handle config updates unless a concrete tooling consumer
  justifies a later narrow API.
- Do not make callers mix `EvaluationRequest` responsibilities with texture
  build-domain, packing, descriptor, upload, or cache responsibilities in one
  request shape or lifecycle.
- Internal texture builders may generate evaluation contexts or call shared
  lower-level transport functions directly for performance, but their internal
  requests must not extend or masquerade as `EvaluationRequest`.
- The production API can assume a simple object facade over two internal
  implementation classes and a shared private core. The facade is constructed
  with public Algorithm32 configuration, one facade instance maps to one
  independent simulation window or render context, and facade instance state
  owns configuration, validators, shader bindings, cache descriptors, and
  disposal scope. The algorithm implementation owns CPU/reference evaluation,
  explicit texture/cache builds, and diagnostics. The shader implementation
  owns Three/WebGL setup, runtime uniforms/textures, frame rendering, resize,
  and GPU disposal. The shared core owns reusable transport/math/packing
  primitives without becoming a global mutable singleton.
- The current public facade draft keeps the main class intentionally small:
  `constructor`, `getConfig`, `setConfig`, `setupShader`, `evaluate`,
  `getDiagnostics`, and `dispose`. The normal
  shader path is `await setupShader(...)`, which installs/prepares the runtime
  Three composer integration and returns a handle for config updates,
  scene/camera replacement, debug views, diagnostics, and disposal.
- The normal production render path is not packet replay. It is:
  `Three scene + camera -> scene color render target + DepthTexture ->
  Algorithm32 fullscreen ShaderMaterial -> output target or screen`.
  Raycaster/JSON scene packets remain CPU soft-shader validation artifacts and
  should not be required by normal app rendering.
- The normal consumer path should likely be the runtime shader facade if
  Algorithm32 ships the production renderer adapter. Awaited setup,
  composer-pass installation, awaited config updates, scene/camera replacement,
  debug views, diagnostics, and disposal are consumer-facing handle lifecycle
  operations. Texture/cache preparation must be explicit as awaited
  setup/update work outside the render frame, but not exposed as a primary
  app-consumer method.
- A candidate runtime adapter entry point is
  `await algorithm32.setupShader({ THREE, composer, scene, camera })`.
  `THREE` means the caller-provided Three module/namespace when Algorithm32
  should avoid owning a separate Three instance; if the package imports
  `three` as a peer dependency, the public call can omit that argument. The
  composer is required. Algorithm32 should install its pass into the existing
  composer so the app continues to call `composer.render()`.
  This is a method on the configured facade, not the core Algorithm32
  configuration surface. It should return a handle that owns
  `ShaderMaterial`, fullscreen-pass/render-target setup, uniform and texture
  binding, composer pass lifecycle, and dispose lifecycle. Awaited
  `setupShader` and awaited handle config updates own normal resource
  preparation, so app callers do not need a separate `prepareResources`
  checklist. Public Sun, atmosphere-composition, geometry, execution, display,
  and texture packets update the handle as uniforms/textures. The API goal is to
  reduce caller decisions and operations: the caller should not need to choose
  material flags, fullscreen geometry, render-target/depth setup, texture
  upload policy, uniform mapping, pass ordering, composer-pass wiring, resize
  propagation, or disposal details. It should also reduce the domain knowledge
  required of the caller: shader packing, spectral grouping,
  local incident-cache layout,
  source-path distinctions, debug uniform conventions, and other
  Algorithm32-specific binding details belong inside the adapter and public
  packet contracts. Long-running texture/cache generation must be explicit as
  awaited setup or awaited config/resource update work, and must not be
  discovered by the first frame render.
- The returned shader handle should converge on a compact lifecycle:
  awaited setup, awaited handle `setConfig`, scene/camera replacement,
  debug-view updates, diagnostics, and `dispose`. Advanced/internal
  operations may still include resource preparation, prebuilt artifact
  binding, composer-pass construction, source-light synchronization, and
  low-level frame-pass rendering, but those should not be normal caller
  obligations. Exact names are not frozen. The app should install or call this
  through its existing composer, not create a second frame loop for
  Algorithm32 and not use a raw-renderer-only production integration.
- Source and geometry adapters are part of the runtime shader product. The
  same public Sun input should drive compatible Three scene lighting and
  atmosphere uniforms, while the public geometry input drives camera/world
  transforms, depth interpretation, top-altitude, and no-hit sky ray policy.
  The caller may opt into app-owned lights later, but should not have to know
  Algorithm32-specific source-to-light mapping to get a correct default.
- Runtime preflight must report renderer capability and active resource
  diagnostics, including software-renderer fallback, depth/3D texture support,
  local incident-cache descriptor compatibility, selected debug view, and
  unsupported source/geometry/scattering combinations.
- Requested local second-order mode must validate the local incident cache
  texture/descriptor before rendering. Missing, stale, mismatched, or
  device-unsupported cache resources are setup/binding errors, not silent
  first-order fallbacks.
- The Three adapter call surface is distinct from Algorithm32 configuration.
  The adapter should wrap the Three calls needed to install and run the
  shader: `new THREE.WebGLRenderTarget(width, height, options)`, assignment of
  `renderTarget.depthTexture = new THREE.DepthTexture(width, height, type)`,
  `new THREE.ShaderMaterial({ glslVersion, uniforms, vertexShader,
  fragmentShader, ...flags })`, `new THREE.Scene()`,
  `new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)`,
  `new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)`,
  `passScene.add(fullscreenQuad)`, `renderer.getRenderTarget()`,
  `renderer.setRenderTarget(targetOrNull)`, `renderer.clear(true, true, true)`,
  `renderer.render(scene, camera)`, `renderTarget.setSize(width, height)`,
  uniform `.copy()`, `.set()`, or `.fromArray()` updates, and `dispose()` on
  owned geometries, materials, textures, and render targets. If the adapter
  uploads prepared 3D cache artifacts, it should wrap
  `new THREE.Data3DTexture(data, width, height, depth)` plus format/type/
  filtering/wrap/`needsUpdate` setup.
- `evaluate` remains the consumer-facing CPU/reference/offline per-path
  transport method. Texture/cache build operations are internal resource
  preparation behind awaited shader setup and awaited shader-handle config
  updates. Local Sun calibration/resolution and calibration replay/invalidation
  belong to the upstream local Sun configuration layer; the main facade
  receives the configured public `Sun`.
- Other operation families are support tiers, not guaranteed main-facade
  calls. Packet construction/preflight is useful when consumers build public
  packets outside the facade, but the primary facade should validate
  internally instead of exposing a normal app-facing `validate()` method.
  Texture descriptor/cache-key validation is implementation-owned unless a
  later tooling API has a concrete external consumer. Spectral display
  conversion is public for CPU/reference/offline consumers or renderer
  adapters that need conversion outside the production shader path.
  Validation/parity helpers, CPU
  soft-shader scene packets, selected-pixel readbacks, image deltas, and
  postprocess-versus-integrated galleries are dev/test support APIs, not
  normal production runtime calls.
- POC export verification supports this split: source-contract modules expose
  packet factories, CPU modules expose trace/postprocess/display-preview
  helpers, local-second-order modules expose cache build/key/pack/frame
  helpers, and the Three POC exposes the atmosphere-pass lifecycle. Production
  should promote the consumer-level operations and keep lower-level helpers
  private or dev/test scoped unless a specific consumer need appears.
- The latest local-second-order script lane is not a separate shader
  implementation: it imports the POC shader and render helpers from
  `shared/algorithm32/POC/`. The reusable pixel-path responsibilities now in
  the POC bundle are the shader class/GLSL, accepted local finite-Sun source
  resolver, packed local cache payload to `Data3DTexture`, star-field display
  payload normalization, and live Three scene-color/depth to Algorithm32
  display-pass setup. The script lane still owns browser harness,
  terrain/gallery composition, hardware renderer diagnostics, render
  scaling/antialiasing controls, and remaining source-driven
  `PointLight`/`DirectionalLight` review plumbing. Production promotion should
  start from the POC helpers for display-pass behavior and mine the script lane
  only for app-wrapper concerns that still affect rendered pixels.
- Shared private operations should be transport and contract primitives:
  validation/canonicalization, fingerprints, geometry path resolution,
  atmosphere sampling, Sun/source sampling, optical-depth/transmittance,
  phase functions, scattering integrands, incident-field hooks, spectral math,
  unit conversion, and deterministic diagnostics/errors.
- Per-path evaluation uniquely owns `EvaluationRequest`, single-ray/segment
  path resolution, optional surface-radiance composition, and per-path output.
  Internal texture/cache building uniquely owns build request state, texture
  kind, sampled build domains, grid traversal, chunking/progress, packing,
  descriptors, cache keys, stale-key checks, and packed payload output.
- Local Sun configuration and calibration affect the main Algorithm32
  algorithm only through the resolved public Sun interface. No transport,
  texture-builder, cache, runtime-shader, display, or validation API should
  require local configuration fields, orbit parameters, calibration internals,
  private provenance, or source-factory details unless they are defined by the
  public Sun interface or its public input/resolver types.
- The same encapsulation rule applies to atmosphere composition and geometry.
  No transport, texture-builder, cache, runtime-shader, display, or validation
  API should require composition preset internals, coefficient derivation
  internals, geometry factory details, scene-adapter state, private
  provenance, or other non-interface fields unless they are defined by the
  corresponding public interface or public input/resolver types.
- Local Sun clock sync should default to solar-zenith calibration: standard
  solar noon for the location/date is aligned with the local model's closest
  approach. The resulting clock offset and source power are derived state.
- Optional visible star/celestial point-source rendering remains a display or
  future source-extension decision, not an atmosphere-composition input. If it
  is promoted, it must be explicit about top-of-atmosphere radiance,
  transmittance, apparent-magnitude/catalog mapping, and whether it lights
  scene geometry.

## Promotion Sequence

1. Accept the ownership-domain requirements: API contract/governance,
   algorithm input interfaces, local Sun calibration, execution configuration,
   transport kernel, shader texture/cache builder, runtime shader product,
   display conversion, validation, and non-goals.
2. Freeze the production API design: module names, exports, public interface
   definitions, type docs, packet schemas, cache key fields, and fail-loud
   error behavior.
3. Design the local-Sun calibration API and packet schema before exposing app
   UX/config, so the app can offer recalibration without making brightness a
   user-authored canonical fact.
4. Promote Sun, atmosphere-composition, geometry, and execution-configuration
   contracts from `POC` into production modules.
5. Promote CPU transport and soft-shader/oracle helpers as validation,
   diagnostic, and cache-support surfaces, preserving parity against accepted
   POC evidence.
6. Promote local incident-cache contracts, direct oracle, cache builder, frame
   transforms, keying, and packing metadata.
7. Promote internal shader texture/cache builders that share CPU/reference
   mechanics but run as explicit awaited setup/update actions outside the
   render frame.
8. Promote the Three adapter/pass as the usable shader product after the
   CPU/cache support boundary is stable.
9. Wire flat app integration to production modules only after validation proves
   the promoted modules match the accepted POC behavior.

## Open Design Questions

- Should production GPU storage require WebGL2 `Data3DTexture`, or should a 2D
  atlas fallback be designed before implementation?
- Which cache resolutions are production defaults versus validation fixtures?
- What is the public error taxonomy for invalid Sun, atmosphere composition,
  geometry, cache, and display packets?
- What display conversion policy belongs in Algorithm32 versus app
  presentation state?
- Which parity fixtures become checked-in stable data, and which remain
  regenerated validation outputs?
- How should production expose debug views without making experiment-only modes
  part of the stable API?
- What exact normalized location/date/time-zone context packet should
  Algorithm32 calibration helpers accept from app-owned services?
- What non-app tooling consumers, if any, justify a separate texture-artifact
  API after the runtime shader facade owns resource preparation?
- Should `setupShader` receive the scene at setup time for source-light
  installation, or should scene binding stay mutable through handle
  `setScene` and composer/framework integration?
- Which runtime capability diagnostics should be stable public API versus
  dev-only diagnostics?
- Should optional star/celestial point-source display ship in the first
  production shader facade, or remain a later display/source extension?
