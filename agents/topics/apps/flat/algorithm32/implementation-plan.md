# Algorithm32 Production Implementation Plan

This plan stages the production promotion of the reconciliation POC into
`shared/algorithm32/production/`.

The reconciliation POC is the implementation driver unless an explicit
production conflict is recorded. Current exceptions are the retained top-level
production API shape, explicit unit-bearing boundaries for convertible
quantities, deferred diagnostics, and the config/setup-vs-runtime failure
policy.

## Planning Rules

- Keep `Algorithm32`, the production dependency aggregate, `Reference`, and
  `ShaderBuilder` as the primary production boundaries.
- Promote reconciliation POC types and property names unless a name is
  actively misleading in the production contract.
- Use explicit unit-bearing packets at durable/API boundaries for any quantity
  that can be represented through unit conversion.
- Keep diagnostics, debug views, public error taxonomy, and runtime capability
  diagnostic API out of the first implementation slice.
- Fail loudly during configuration and setup. Log and continue during live
  runtime frames where a last valid state, no-op, or fallback path is
  available.
- Do not runtime-link production code to reconciliation POC or experiment code.
  Promote accepted behavior into production modules, tests, fixtures, and docs.

## Current Scaffold Touch Points

The current production scaffold is intentionally thin. The first implementation
pass should update these seams before porting large logic:

Progress update: the first implementation slice has completed the Milestone 0
contract realignment and an initial Milestone 1 lifecycle pass. `Algorithm32`
now owns validated config, versioned shared-model construction, collaborator
wiring, `evaluate`, awaited `setupShader`, shader handle config refresh, and
disposed-state failures. The public type surface removes first-slice stale
contracts (`resolveRayDistance`, direct light-source incident sampling,
runtime `debugView`, and normal handle scene/camera rebinding). `Reference`
now orchestrates through the promoted `SpectralCalculator`, and
`buildIncidentRadianceCache` plus `noIncidentRadiance` provide the first
setup-bound incident-radiance support utilities. The first concrete
source-owned cache families now live under `light-sources/` as
`DistantSunIncidentRadianceCache` and `LocalSunIncidentRadianceCache`, with
coordinate generation, CPU samplers, and shader payload descriptors.
`DistantSunLightSource` and `LocalSunLightSource` now provide concrete direct
lighting, source-path limits, cache policy, and cache creation; the POC
Three lighting adapter remains deferred. `CanonicalAtmosphere`,
`SphericalEarthGeometry`, and `FlatEarthGeometry` now provide the core
atmosphere/geometry model surfaces for `Reference` and cache building, with
Three endpoint adapters deferred. `BrunetonColorDisplayModel` now provides the
concrete Color/display conversion and shader display contribution. Shader
runtime mechanics now include
descriptor synthesis from `SharedModel`, optional owner shader contribution
providers, compatibility validation, deterministic GLSL assembly, shared
builder-owned runtime contribution, concrete geometry, atmosphere,
light-source, Color, source-created cache, and core transport owner
contributions for the distant spherical and local flat paths,
source-created incident-cache shader setup with cache-owned
descriptors, contributions, and texture payloads, a core transport
contribution provider, cache texture resource preparation, cache descriptor/payload
compatibility validation, Three
material/pass installation for assembled composer setups, reusable
scene depth/hit capture, fail-loud required binding validation before pass
installation, live-frame failure logging, and handle-owned runtime disposal.
The active flat/globe app integrations now create real Three
`EffectComposer` instances with `RenderPass` and pass those composers to
`Algorithm32.setupShader(...)`; the flat floor and globe surface sphere are
tagged as `geometry-ground-boundary` inputs at `metersPerSceneUnit = 1000`
while decorative non-input meshes are excluded from `SceneInputCapture`. The
old aggregate profile contribution
factories and the old shader contribution factories have been moved to
`shared/algorithm32/production/quarantine/` for later deletion. Missing Color
configuration now fails loudly instead of using a default output
contribution. Geometry-owned Three endpoint creation and source-owned Three
lighting creation are now promoted on the concrete spherical/flat geometries
and distant/local sources, and concrete geometries now resolve the default
scene-depth capture cap through `resolveSceneDepthMaxMeters(...)`.
Verification:
`npm run test:algorithm32:production` passes 182 specs with 0 failures.

- `Algorithm32.js` now owns first-slice config validation, shared model
  creation, collaborator wiring, shader handles, disposal, and loud lifecycle
  failures. Later passes still need fuller runtime resource invalidation,
  capability polish, and real app/browser parity over the promoted Three pass
  integration.
- `models/SharedModel.js` currently aggregates light source, atmosphere,
  geometry, and spectral facts. It needs the promoted configuration/fact shape
  required by `Reference`, incident-cache building, `ShaderBuilder`, and Color
  display conversion without duplicating durable state.
- `implementation/Reference.js` now uses reconciled geometry path resolution,
  endpoint/trapezoid path points, and setup-bound `IncidentRadianceSampling`
  precedence through `SpectralCalculator`. More transport math will move into
  the calculator as concrete models and fixtures land.
- `implementation/ShaderBuilder.js` now has setup attachment validation,
  shader descriptor synthesis, owner contribution collection, assembler and
  compatibility-validator plumbing, cache texture resource preparation,
  runtime binding with fail-loud required binding validation,
  Three-compatible pass installation, live-frame failure logging, and cleanup.
  Renderer-generated depth/hit capture now lives in the composer-compatible
  `SceneInputCapture` pass installed ahead of the Algorithm32 runtime pass. The
  path still needs resource/capability polish. Browser/readback parity
  fixtures for scene color, ray-length/depth capture, hit mask, and
  selected-pixel output are deferred until real app composer integration
  supplies stable readback surfaces. Do not add a standalone
  app-configured cache construction path; shader setup asks the configured
  light source to create the concrete cache so source/cache internals stay
  aligned.
- Production type homes now reject the scaffold-era first-slice contracts:
  `GeometryModel.resolveRayDistance`,
  `LightSourceModel.sampleIncidentRadiance`, `ShaderRuntimeConfig.debugView`,
  and mutable shader-handle `setScene`/`setCamera`.
- `SpectralCalculator` now exists in production as a common internal utility
  used by `Reference` and passed into cache construction.
- `light-sources/DistantSunIncidentRadianceCache.js` and
  `light-sources/LocalSunIncidentRadianceCache.js` now promote the POC
  source-owned cache families without moving solar-specific names into generic
  core.
- `light-sources/DistantSunLightSource.js` and
  `light-sources/LocalSunLightSource.js` now wrap those cache families with
  direct lighting and source path-limit behavior.
- `atmospheres/CanonicalAtmosphere.js`, `geometries/SphericalEarthGeometry.js`,
  and `geometries/FlatEarthGeometry.js` now promote the core concrete
  atmosphere and geometry models without the optional Three endpoint adapters.

## Slice Dependency Order

Use this order inside the milestone outline unless a testable seam demands a
smaller cut:

1. Contract/type realignment and stale scaffold removal.
2. Facade lifecycle and shared-model replacement/versioning.
3. Domain interface promotion for geometry, atmosphere, source, cache, color,
   and shader contribution descriptors.
4. `SpectralCalculator` plus CPU/reference transport.
5. Incident-radiance cache builder, sampler, descriptor, keying, and packing.
6. Shader assembly, compatibility validation, and resource binding internals.
7. Three composer integration and shader-handle lifecycle.
8. Fixture, parity, and provenance promotion.

## Milestone 0: Contract And Scaffold Alignment

Align the production scaffold with the accepted reconciliation design before
moving large behavior.

- Freeze the first-pass public facade shape around constructor, `config`,
  `setConfig`, awaited `setupShader`, `evaluate`, deferred `getDiagnostics`,
  and `dispose`.
- Map reconciliation type names and packet shapes into the production type
  homes, recording only intentional production-name deviations.
- Identify unit-bearing API adapters needed where reconciliation hot-path
  scalars meet production durable boundaries.
- Keep the remaining calibration context packet decision isolated from the
  transport/shader implementation path.
- Remove or replace first-slice scaffold contracts that conflict with accepted
  decisions: runtime `debugView`, mutable scene/camera handle setters,
  distance-only geometry resolution, and direct light-source incident sampling.

Acceptance gate:

- Production contracts describe the POC-owned details and known exceptions.
- The existing no-runtime-import guardrail remains intact.
- The only non-deferred open design decision is the normalized
  location/date/time-zone context packet for calibration helpers.

Testing criteria:

- Extend scaffold/type guard tests to catch stale first-slice contracts,
  including `debugView`, mutable scene/camera handle setters,
  `resolveRayDistance` as the public geometry boundary, and direct
  light-source incident sampling.
- Keep the production no-runtime-import guardrail for reconciliation POC and
  archived POC paths green.
- Run `npm run test:algorithm32:production` for this slice.

Reference/citation criteria:

- API-shape and ownership decisions cite topic design/delta docs in prose; they
  do not need AMA references.
- Any contract field that embeds a physical constant, algorithm formula,
  tolerance, or experimentally determined value must cite `references.md` or an
  accepted `evidence.md` entry before becoming a production fixture or code
  comment.

## Milestone 1: Facade And Shared Model Lifecycle

Make the production facade real enough to own configuration, validated shared
facts, collaborators, and disposal.

- Implement facade state, validation entry points, shared-model construction,
  config replacement, and disposed-state failures.
- Keep shared canonical facts in `SharedModel` and focused component models
  rather than duplicating state in the facade, reference, and shader builder.
- Wire `Reference` and `ShaderBuilder` beneath the facade without changing the
  top-level API shape.
- Add handle ownership rules for awaited shader setup, config refresh,
  resource refresh, resize/frame operations, and disposal without making scene
  or camera rebinding normal mutable handle state.

Acceptance gate:

- Constructor, `config`, `setConfig`, `evaluate`, `setupShader`, and `dispose`
  have coherent lifecycle behavior.
- Config/setup failures throw or reject loudly.
- Docs and tests cover lifecycle and ownership expectations.

Testing criteria:

- Add facade specs for constructor validation, immutable config snapshots,
  config version changes, collaborator replacement/refresh, evaluate
  delegation, setup rejection behavior, and disposed-state failures.
- Add shared-model specs for canonical fact ownership, descriptor snapshots,
  versioning, and absence of duplicate mutable config state.
- Use test doubles for `Reference`, `ShaderBuilder`, and consumer-provided
  models so lifecycle behavior can be proven before transport math lands.

Reference/citation criteria:

- Lifecycle mechanics, disposal, versioning, and ownership tests do not require
  AMA citations.
- Any accepted default config that carries physical meaning must identify a
  third-party reference or accepted first-party evidence entry in the fixture,
  code comment, or doc that introduces it.

## Milestone 2: Reconciled Domain Contracts

Promote the POC domain interfaces and execution packet shapes under the
production API.

- Replace scaffold geometry distance-only behavior with the reconciled
  geometry path, atmosphere coordinate/path, cache access, and source-relative
  resolution contracts.
- Split light-source direct lighting, source path limits, incident-cache
  description/creation, and optional renderer-light synchronization.
- Promote atmosphere medium sampling, optical-depth integration, and separate
  Rayleigh/Mie phase facts.
- Promote `IncidentRadianceSampling`, cache descriptors, directional incident
  samples, and source/cache setup requests as explicit contracts rather than
  hidden light-source sample calls.
- Keep `Color` as the display-conversion boundary and keep stars/celestial
  point sources as app scene content.

Acceptance gate:

- Public and internal type definitions match reconciliation names and shapes
  except for documented unit-boundary adapters.
- Domain ownership is explicit enough for `Reference`, cache building, and
  shader assembly to consume the same facts.

Testing criteria:

- Add contract specs with minimal fake light source, geometry, atmosphere,
  incident-radiance, and Color implementations that exercise accepted packet
  shapes and fail-loud setup validation.
- Add unit-boundary tests for explicit distance, angle, wavelength, and
  position packets where production adapters meet reconciliation scalar hot
  paths.
- Add negative tests for owner-boundary violations, such as geometry facts
  requested from source models or incident-cache sampling hidden behind direct
  light-source calls.

Reference/citation criteria:

- Type names, property names, and ownership placement cite the reconciliation
  POC/delta docs; no AMA reference is needed for naming alone.
- Physical equations, unit domains, spectral ranges, atmosphere/source
  coefficients, and phase-function behavior introduced by these contracts must
  cite numbered third-party references or accepted evidence pointers.
- If a value comes from reconciliation experiments rather than a third-party
  source, add or use a concise accepted `evidence.md` name before promoting it
  into fixtures or code comments.

## Milestone 3: Shared Spectral Calculator And Reference Transport

Promote `SpectralCalculator` as the common internal radiance/math collaborator
for CPU reference evaluation and cache building.

- Implement endpoint/trapezoid path integration, segment transmittance,
  source-path optical depth, direct scattering, and incident in-scattering
  using reconciled packets.
- Keep `Reference` as the production CPU/reference orchestration class rather
  than renaming the production boundary to the POC evaluator class.
- Support `IncidentRadianceSampling` precedence for CPU evaluation: request
  property, including explicit `null`, then `Reference` default, then no
  incident sampling.

Acceptance gate:

- CPU/reference selected-ray behavior matches accepted reconciliation evidence
  and production fixture expectations.
- `SpectralCalculator` is reusable by cache construction without becoming
  facade API.

Testing criteria:

- Add `SpectralCalculator` specs for Beer-Lambert transmittance,
  endpoint/trapezoid integration, source-path optical depth, Rayleigh/Mie phase
  application, direct scattering, incident scattering, vacuum/zero-length
  limits, and monotonic attenuation.
- Add `Reference` specs for reconciled path orchestration, result shape,
  request-level `IncidentRadianceSampling` override, explicit `null` override,
  configured default incident sampling, and no-incident fallback.
- Promote selected-ray fixture rows only after their source/evidence pointers
  are present and the fixture ledger has a validation spec.

Reference/citation criteria:

- Formula comments and fixture rows for transmittance, volume scattering, and
  phase functions cite the numbered production references, currently `[1]`,
  `[2]`, and `[3]` where applicable.
- Reconciliation-derived selected-ray expected values cite accepted
  first-party evidence names plus exact script, record, artifact, criterion, or
  run id.
- Do not cite the POC source file as an AMA reference; cite it only as
  first-party evidence when an accepted evidence entry exists.

## Milestone 4: Incident-Radiance Cache And Resource Preparation

Promote the local incident-radiance cache family and internal resource
preparation path.

- Add cache descriptors, cache keys, stale/mismatch validation, sampler
  contracts, and cache-owned shader payload descriptors.
- Drive `z`/`rho` spatial resolution from geometry/cache-domain descriptors.
  Keep fixed spatial dimensions for validation fixtures or named quality
  presets only.
- Use WebGL2/Three `Data3DTexture` as the first shader resource target.
- Keep texture artifact import/export private to tests and internal tooling
  unless a later concrete non-app consumer requires a public API.

Acceptance gate:

- Cache building can consume shared geometry, atmosphere, light source, and
  `SpectralCalculator` facts.
- Shader-required cache resources are prepared during awaited setup/update and
  fail loudly when missing, stale, mismatched, or unsupported.

Testing criteria:

- Add cache specs for descriptor shape, cache key ingredients, stale/mismatch
  failures, geometry-driven `z`/`rho` domains, named quality presets, sampler
  lookup behavior, directional sample packets, and no-cache behavior.
- Add packing/resource specs for spectral group layout, `Data3DTexture`
  dimensions, payload metadata, shader lookup descriptors, and setup/update
  failure cases before relying on browser readback.
- Add fixture validation for any checked-in cache samples or generated cache
  evidence consumed by tests.

Reference/citation criteria:

- Cache-coordinate shape, packing, tolerance, quality-preset, or experimentally
  selected resolution values need accepted `evidence.md` entries with exact
  script/record/run pointers before they become production defaults or
  fixtures.
- Geometry-driven domain formulas and physical scattering inputs cite numbered
  third-party references when they are source-backed formulas rather than local
  architecture decisions.
- WebGL2/Three resource limits or `Data3DTexture` capability assumptions should
  cite platform/API documentation if they become tested operational limits.

## Milestone 5: Shader Assembly And Binding

Build the runtime shader path under `ShaderBuilder`.

- Let source, atmosphere, geometry, color, and cache abstractions provide their
  specific shader contributions and semantic payload descriptors.
- Keep mechanical source assembly, compatibility checks, texture/resource
  preparation, uniforms, samplers, binding maps, pass/material installation,
  frame updates, and cleanup under `ShaderBuilder`.
- Use the `Color` abstraction or Color-owned descriptor for display conversion
  in shader setup and handle updates.

Acceptance gate:

- Shader setup produces a coherent material/pass package from the shared model
  and configured shader policy.
- Shader assembly remains free of deferred debug-view and diagnostics API
  commitments.

Testing criteria:

- Add deterministic shader-assembly specs for contribution ordering, defines,
  uniforms, sampler declarations, compatibility validation, and failure
  messages for unsupported combinations.
- Add binding specs for Color descriptors, spectral descriptors, cache payloads,
  texture slots, uniform refresh categories, and resource disposal.
- Add guard tests proving experiment-only debug views and diagnostics envelopes
  are not promoted into first-slice shader API.

Reference/citation criteria:

- Mechanical assembly, binding-map layout, and pass lifecycle choices do not
  require AMA citations.
- Shader equations and display-conversion snippets cite the same references or
  accepted evidence as the CPU/reference path and the Color abstraction.
- Any shader quality shortcut, interpolation choice, or tolerance promoted from
  experiments must cite an accepted evidence name rather than a historical POC
  file path.

## Milestone 6: Three Runtime Integration And Handle Lifecycle

Promote the usable production shader product: a Three composer pass installed
through awaited setup.

- Implement `setupShader({ THREE, composer, scene, camera, ... })` as
  setup-time attachment, including scene, composer, and camera.
- Render or consume scene color for final Color/display composition,
  ray-length/depth plus hit-mask state for Algorithm32 path bounds, fullscreen
  shader output, resize handling, frame updates, and disposal.
- Keep scene/composer/camera rebinding out of the first normal handle API;
  moving the pass uses teardown and re-setup.
- Keep runtime frame failures logged and non-fatal when the pass can continue.

Acceptance gate:

- The app can install Algorithm32 into an existing composer loop without a
  separate frame loop.
- The returned handle supports config/resource updates, resize/frame lifecycle,
  deferred diagnostics placeholder behavior, and disposal.

Testing criteria:

- Add fake-composer/fake-Three unit specs for setup-time attachment, pass
  insertion, scene/color/depth resource ownership, resize behavior, handle
  config updates, disposal, and no normal scene/camera rebinding.
- Add runtime-error tests showing setup/config errors reject loudly while live
  frame failures log and continue when a last valid state, no-op, or fallback
  path is available.
- Add browser or integration smoke coverage once the pass can render: nonblank
  output, stable resize, selected-pixel readback, and no separate app frame
  loop.

Reference/citation criteria:

- Three composer lifecycle mechanics do not need AMA physics references.
- Operational limits asserted by tests, such as WebGL2 texture support or
  renderer capability requirements, need platform/API references or accepted
  local evidence.
- Scene fixtures and readback expectations cite fixture rows, third-party
  references, or accepted evidence names according to the production fixture
  rules.

## Milestone 7: Validation, Fixtures, And Evidence

Promote validation coverage as production unit and integration tests.

- Keep fixtures with unit tests and cite fixture rows to the main production
  reference file or accepted first-party evidence names.
- Add focused parity tests for CPU/reference behavior, cache packing, shader
  descriptors, shader assembly, and GPU readbacks as the implementation lands.
- Use selected-pixel RGB byte tolerance `3` for deterministic 8-bit display
  readbacks against `Reference` plus `Color`, with alpha exact unless a scene
  declares alpha behavior.
- Use scene-owned thresholds for whole-image/region claims, reporting exact
  byte metrics, luma/weighted-RGB proxy metrics, and CIEDE2000-style residuals
  with `1.0 Delta E 2000` as the review threshold.

Acceptance gate:

- Production tests exercise promoted behavior without depending on POC runtime
  code.
- Fixture and evidence provenance follows the production reference/evidence
  citation rules.

Testing criteria:

- Add or update fixture validation specs before production specs consume a new
  fixture ledger.
- Add focused parity tests for CPU/reference, cache packing, shader
  descriptors, shader assembly, and GPU selected-pixel readback as each
  implementation slice lands.
- Keep selected-pixel display parity on `gpu-selected-rgba-byte-parity` and
  whole-image/region review on `gpu-perceptual-quality-metrics` unless a later
  accepted evidence entry supersedes them.

Reference/citation criteria:

- Every fixture row carries a citation, compact reference/evidence pointer,
  assumptions, expected values, tolerance metadata, and independence note.
- Third-party facts use numbered AMA entries from `references.md` with ASCII
  bracket citations. First-pass internal experiment references use short codes
  listed in `references.md` and cited as `(script <code>)`; later evidence
  collection adds exact script/record/artifact/run locators to `evidence.md`.
- Generated reconciliation records remain supporting material until promoted
  into checked-in fixtures, short-code internal experiment references, or
  accepted evidence entries.

## Milestone 8: First Production Cut

Consolidate the first usable shader/runtime pass.

- Verify facade lifecycle, reference transport, cache preparation, shader
  setup, Three composer integration, and validation fixtures together.
- Remove stale scaffold behavior and redundant documentation paths that imply
  older pre-reconciliation sources remain implementation references.
- Record what shipped, what was verified, and which deferred items stay out of
  scope.

Acceptance gate:

- The first production shader/runtime path is usable through the production
  facade and does not require callers to understand cache or shader internals.
- Remaining work is tracked as implementation followups or explicitly deferred
  diagnostics/display/source extensions.

Testing criteria:

- Run the full production Algorithm32 test lane and any browser/integration
  parity lane required by the shader/runtime slice.
- Verify facade lifecycle, CPU/reference selected-ray parity, cache resource
  preparation, shader setup, Three composer integration, and disposal together
  in at least one production-shaped scene.
- Confirm no production runtime imports from reconciliation POC or archived POC
  paths.

Reference/citation criteria:

- Before calling the cut complete, every shipped physics/algorithm constant,
  fixture expectation, validation tolerance, and experimentally determined
  value has either a numbered reference pointer or accepted evidence pointer.
- Status and design docs record what shipped, what tests ran, what evidence was
  accepted, and which diagnostics/display/source extensions remain deferred.
- Remove or rewrite stale docs that imply older pre-reconciliation lanes are
  implementation authority.

## Deferred From First Slice

- Public diagnostics envelopes, diagnostic registries, and stable runtime
  capability diagnostic API.
- Debug views or experiment-only visualization modes as stable shader API.
- CPU shader or POC postprocess validation harness promotion.
- Public texture artifact import/export API.
- 2D atlas fallback for incident-radiance cache textures.
- Algorithm32-owned stars or celestial point-source display.
