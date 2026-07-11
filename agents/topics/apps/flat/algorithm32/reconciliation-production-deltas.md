# Reconciliation To Production Deltas

Status: working resolution tracker.

This document records how the accepted reconciliation design differs from the
current production Algorithm32 scaffold. Use it to plan promotion work before
changing production APIs or shader/runtime code.

## Accepted Production Shape Constraint

The production top-level API shape remains the primary boundary for promotion:
the `Algorithm32` facade, the production dependency aggregate, and the
top-level `Reference` and `ShaderBuilder` implementation classes stay as the
production shape. The new details, collaborators, data packets, and ownership
abstractions should align with the reconciliation POC beneath that shape.

Use the reconciliation POC for all production implementation details unless
there is an explicit recorded production conflict. Current recorded
conflicts/exceptions are the retained top-level production shape, explicit
unit-bearing boundaries for convertible quantities, deferred diagnostics, and
the config/setup-vs-runtime failure policy.

Type definitions and property names should use the reconciliation POC shapes
and names because most production implementation code will be lifted from that
code base. Rename only when a POC name is actively misleading in the production
contract, and document the one-to-one mapping. Any quantity that can be
represented in different units through conversion must use an explicit
unit-bearing packet at durable/API boundaries; avoid implicit unit scalar
types there.

Diagnostics remain deferred. The first production lift should implement only
the basic fail-loud validation and setup/resource errors needed for the
runtime path. Do not add diagnostic envelopes, per-helper callbacks, or a
stable public diagnostics taxonomy until the holistic diagnostics design is
accepted.

Failure policy: fail loudly on configuration and setup surfaces, including
constructor validation, `setConfig`, `setupShader`, awaited handle config
updates, and resource build/bind setup. Once the runtime render path is live,
log runtime failures and continue with the last valid state, no-op, or
fallback path when possible.

The reconciliation conclusions are the primary design driver. The
reconciliation topic, POC code, and experiment records remain relevant
supporting material:

```text
agents/topics/apps/flat/reconciliation/
scripts/flat/reconciliation/POC/
tmp/atmosphere/reconciliation/
```

Older pre-reconciliation cleanroom, shader-lab, local-second-order,
`shared/algorithm32/POC/`, source-contract, and scattered experiment lanes are
archive-only for this comparison unless the user explicitly asks for
historical analysis.

## Current Production Snapshot

Production currently has a scaffold under:

```text
shared/algorithm32/production/
```

Implemented or partially implemented production pieces:

- `Algorithm32.js`: primary facade lifecycle with config validation, versioned
  shared-model construction, `Reference`/`ShaderBuilder` wiring, config
  replacement, delegated `evaluate`, awaited `setupShader`, shader handle
  config refresh, and disposed-state failures.
- `implementation/Reference.js`: CPU/reference orchestration over
  `resolveViewRaySegment`, endpoint/trapezoid path points,
  `SpectralCalculator.computeRadiance(...)`, and
  request/default/null `IncidentRadianceSampling` precedence.
- `implementation/SpectralCalculator.js`: common internal endpoint/trapezoid
  path integration and radiance math collaborator promoted from the
  reconciliation shape.
- `implementation/buildIncidentRadianceCache.js` and
  `implementation/noIncidentRadiance.js`: first setup-bound incident-radiance
  support utilities.
- `light-sources/DistantSunIncidentRadianceCache.js` and
  `light-sources/LocalSunIncidentRadianceCache.js`: first source-owned
  concrete incident-radiance cache families with coordinate generation,
  value storage, CPU samplers, and shader payload descriptors.
- `light-sources/DistantSunLightSource.js` and
  `light-sources/LocalSunLightSource.js`: first concrete light-source
  implementations for direct lighting, source-path limits, cache policy, and
  cache creation. The created cache supplies cache descriptors, and the sources
  now create source-owned Three renderer-light helpers through
  `addSceneLighting(...)`.
- `atmospheres/CanonicalAtmosphere.js`: first concrete atmosphere model for
  medium sampling, optical-depth integration, and Rayleigh/Mie phase sampling.
- `geometries/SphericalEarthGeometry.js` and `geometries/FlatEarthGeometry.js`:
  first concrete geometry models for view-ray segments, atmosphere paths,
  source-relative coordinates, cache access, cache-build rays, and
  geometry-owned Three ground endpoint helpers through
  `createThreeEndpointObjects(...)`.
- `implementation/ShaderBuilder.js`: fail-loud setup attachment validation,
  shader descriptor synthesis, owner contribution collection, compatibility
  validation, deterministic GLSL assembly, cache texture resource preparation,
  runtime binding, Three-compatible pass installation for assembled setups,
  live-frame failure logging, and cleanup.
- `models/SharedModel.js`: aggregate over `lightSource`, `atmosphere`,
  `geometry`, and `SpectralModel`.
- `models/SpectralModel.js`: implemented spectral basis model and descriptor.
- `types/LightSourceModel.d.ts`, `AtmosphereModel.d.ts`,
  `GeometryModel.d.ts`, `Color.d.ts`, and `types/types.d.ts`: first public
  interface/type surface aligned to the reconciled geometry, atmosphere,
  source, incident-radiance, color, execution, shader setup, and shader handle
  packet names.
- `utils/`: generic scalar, angle, distance, wavelength, vector, array, and
  sample helpers.
- Production tests currently guard scaffold shape, references, type homes,
  stale contract removal, facade lifecycle, `SharedModel`, `SpectralModel`,
  `SpectralCalculator`, `Reference` orchestration, `ShaderBuilder`, shader
  descriptor/assembly/resource/pass helpers, and the incident-radiance cache
  coordinator, concrete distant/local cache families, concrete distant/local
  light-source implementations, canonical atmosphere, spherical/flat geometry
  models, canonical data, concrete Color/display conversion, concrete
  geometry, atmosphere, light-source, source-created cache, and core transport
  owner contributions, including distant spherical/local flat assembly
  coverage, required binding validation, and cache descriptor/payload
  validation, plus real flat/globe app `EffectComposer`/`RenderPass`
  integration with geometry-ground scene input tagging at
  `metersPerSceneUnit = 1000`, explicit globe model-space scene-frame mapping,
  and geometry-owned local scene-depth caps.
  Verification:
  182 specs, 0 failures via
  `npm run test:algorithm32:production`.

The production scaffold now contains generic shader assembly, cache texture
resource binding, Three-compatible pass installation mechanics, concrete
Color/display conversion, builder-owned runtime contribution, and owner-local
contributions for the distant spherical and local flat paths. The old
aggregate profile and shader contribution factories are quarantined under
`shared/algorithm32/production/quarantine/` for later deletion. Missing Color
configuration fails loudly instead of using a default output contribution. It
now contains reusable renderer-produced depth/hit capture through the
composer-compatible `SceneInputCapture` pass, including opt-out visibility
filtering for decorative app meshes during capture. The spherical geometry
shader contribution supports both reconciliation-style observer-local scene
frames and app-style planet-centered model-space scene frames; the globe app
bridge selects model-space and uses a local horizon/object depth cap rather
than the globe camera's star-scale far plane. It does not yet contain real app
browser readback parity fixtures for the promoted ray-length scene input path
or runtime capability taxonomy.

## Reconciliation Target Snapshot

The reconciliation design has a more concrete architecture:

- `SpectralReferenceEvaluator` coordinates one evaluation.
- `SpectralCalculator` owns endpoint/trapezoid path integration and reusable
  radiance calculations. In production it is a common internal
  utility/collaborator consumed by both `Reference` evaluation and
  incident-radiance cache building, not a `Reference`-owned private helper and
  not a primary public facade API.
- Geometry owns view-ray segments, atmosphere coordinates, atmosphere paths,
  source-relative positions, cache access, scene/model coordinate conversion,
  and endpoint objects.
- Light sources own direct lighting, source path limits, incident-cache
  family creation, and optional source-driven Three lighting.
- Atmosphere owns medium sampling, optical-depth integration over
  geometry-built paths, and separate Rayleigh/Mie phase samples.
- Incident-radiance support is prepared outside evaluation, then supplied as
  operation-ready `IncidentRadianceSampling` with an
  `incidentRadianceSampler(cacheAccess)` callback. The POC name carries into
  production. For CPU/reference evaluation it can be configured as the default
  on the evaluator/`Reference`, and a per-evaluation request
  `incidentRadianceSampling` property overrides that default, including
  explicit `null` to disable sampling for one evaluation. Durable facade config
  stores incident-radiance policy/intent, not the callback packet itself;
  shader setup/handle state owns the GPU resource equivalent.
- Caches own their coordinate domains, generated values, sampler creation, and
  shader payload/access contribution.
- Shader assembly uses abstraction-owned contributions for specific
  atmosphere, geometry, source, cache, and display behavior. `ShaderBuilder`
  owns the remaining mechanical shader work: source assembly, compatibility
  checks, `TextureBuilder`, texture/resource preparation, bindings,
  pass/material installation, setup/config/frame lifecycles, cleanup, and the
  Three/composer integration layer.
- GPU shader consumes renderer-produced scene color plus explicit
  ray-length/depth and hit-mask state. The Algorithm32 transport algorithm
  uses ray length and hit mask for path bounds; final Color/display
  composition uses the renderer-produced scene color for the hit pixel when it
  combines endpoint color with path radiance/transmittance. It does not need
  shader-facing object/material IDs; renderer object/material appearance
  remains in scene color, and endpoint policy stays with geometry plus
  Color/display composition.
  CPU/reference validation may use equivalent selected-ray or fixture inputs
  as an oracle; no separate CPU-side render surface is promoted.

## Delta Matrix

| Area | Reconciliation target | Current production state | Gap to resolve |
| --- | --- | --- | --- |
| Promotion authority | POC details are production details unless an explicit recorded production conflict says otherwise. | Production design still contains older scaffold-era alternatives and open questions. | Update the design doc to remove scaffold-era alternatives where the POC is clear. Keep only explicit recorded exceptions: top-level production shape, unit-bearing boundaries, deferred diagnostics, and failure policy. |
| Facade lifecycle | Facade owns validated config, shared model, CPU/reference evaluator, shader builder, disposal, and awaited shader setup/update. Diagnostics are a later concern. | First slice implemented facade-owned config/version snapshots, shared-model construction, `Reference`/`ShaderBuilder` wiring, awaited shader setup handles, config replacement, and disposed-state failures. `getDiagnostics` remains reserved/deferred. | Continue from the implemented facade lifecycle into real shader resources, handle refresh behavior, and setup/runtime failure handling without adding a stable diagnostics schema yet. |
| Core CPU object split | `SpectralReferenceEvaluator` handles orchestration; `SpectralCalculator` owns reusable radiance math and endpoint/trapezoid integration, and cache setup also consumes the calculator. | First slice keeps production `Reference` as orchestration and promotes `SpectralCalculator` as the common radiance/integration collaborator. Cache setup utilities consume the calculator. | Extend calculator-backed coverage as concrete atmosphere/source/geometry/cache models are promoted. Keep `Reference` as the production CPU boundary rather than renaming it to the POC evaluator class. |
| Evaluation request/response | Evaluation returns spectral output plus resolved `viewRaySegment`, `pathIntegrationPoints`, and `PathRadiance`. Diagnostic traces remain deferred. | First slice types and implementation return `pathRadiance`, `transmittance`, resolved `viewRaySegment`, and `pathIntegrationPoints`; incident sampling follows POC request/config/null precedence. | Add parity fixtures and concrete-model coverage. Keep renderer/display facts and diagnostic envelopes out of `evaluate(...)`. |
| Geometry interface | Requires `resolveViewRaySegment`, `resolveAtmosphereCoordinate`, `resolveAtmospherePath`, `resolveSourceRelativePosition`, `resolveCacheAccess`, optional scene/model mapping, endpoint object creation, and geometry-owned scene-depth cap resolution. | First slice replaced the public geometry contract and promoted `SphericalEarthGeometry`/`FlatEarthGeometry` core models with view-ray segments, atmosphere paths, source-relative coordinates, cache access, cache-build rays, observer-local scene mapping, explicit spherical model-space scene mapping for planet-centered Three scenes, geometry-owned Three endpoint objects through `createThreeEndpointObjects(...)`, and default capture caps through `resolveSceneDepthMaxMeters(...)`. | Continue parity coverage over the promoted concrete geometry models and scene-input capture path. |
| Atmosphere interface | `sampleMedium(AtmosphereCoordinate)`, `integrateOpticalDepth(AtmospherePath)`, `samplePhase(...)` returning separate Rayleigh/Mie phase facts. | First slice promoted `CanonicalAtmosphere` with `sampleMedium(AtmosphereCoordinate)`, `integrateOpticalDepth(AtmospherePath)`, and separate Rayleigh/Mie phase facts. | Add production parity fixtures for canonical atmosphere constants and selected-ray transport. Keep alternate atmosphere profiles as future named extensions. |
| Light-source interface | `sampleDirectLighting`, `resolveSourcePathLimit`, `createIncidentRadianceCache`, optional `addSceneLighting`. | First slice replaced the scaffold light-source contract and promoted `DistantSunLightSource`/`LocalSunLightSource` for direct lighting, source path limits, cache policy, cache creation, and source-owned Three lighting objects through `addSceneLighting(...)`. The source-created cache direction is accepted so source and cache can share private details, while cache descriptors come from the cache instance. | Keep runtime incident sampling out of the generic per-sample light-source API. Do not add app-configured standalone cache construction to the facade. Add source-light synchronization coverage where real app integration needs it. |
| Incident radiance | Setup builds a source-created concrete cache and passes operation-ready `IncidentRadianceSampling`; sampler returns directional samples with incoming direction, radiance, and weight. CPU/reference evaluation uses POC precedence: request property, including explicit `null`, then configured default, then no incident sampling. | First slice added `IncidentRadianceCache`, `IncidentRadianceSampler`, `IncidentRadianceSampling`, cache descriptors, directional incident sample packets, `noIncidentRadiance`, a cache build coordinator, concrete distant/local cache families, and `Reference` precedence matching the POC. Shader setup now asks the configured light source to create/build the cache, uses the cache-owned descriptor in shader descriptor synthesis, collects the cache-owned shader contribution, binds the cache shader payload as a Three texture resource, and validates descriptor/payload compatibility before resource creation. | Promote durable incident-radiance intent/policy in config and stricter stale/key mismatch validation while keeping operation-ready CPU sampling in setup/reference state and GPU resources in shader handle setup state. Cache creation remains light-source-owned. |
| Cache ownership | Light source creates the concrete cache family so source/cache internals can align. Concrete cache owns coordinates, generated values, sampler, shader payload, texture/access contribution, and descriptor facts. Build coordinator passes geometry, atmosphere, light source, and the shared calculator utility into cache-owned coordinates. | First slice has generic cache contracts, `buildIncidentRadianceCache(...)`, source-owned `DistantSunIncidentRadianceCache`/`LocalSunIncidentRadianceCache`, and concrete light-source factories around them under `light-sources/`. They generate coordinates, store values, create CPU samplers, emit cache descriptors and packed shader payload descriptors from one layout, validate descriptor/payload compatibility during setup, and now provide cache-owned shader contributions collected by automatic shader setup. | Strengthen stale/key mismatch validation. Keep generic evaluator unaware of concrete cache internals. Fail loudly on missing/stale cache where shader mode requires one. |
| Transport integration rule | Endpoint/trapezoid path points; segment transmittance uses previous/current extinction over interval length; source path transmittance comes from atmosphere optical depth over a geometry-resolved source path. | First slice moved endpoint/trapezoid path points, segment transmittance, source transmittance, direct scattering, and incident accumulation into `SpectralCalculator`; `Reference` orchestrates through geometry/atmosphere/source contracts. | Add concrete-model and parity fixtures for promoted transport. Continue using geometry-resolved source/cache paths before direct and incident in-scattering. |
| Direct scattering | Light source supplies incident radiance and direction. Atmosphere supplies separate Rayleigh/Mie phase. Calculator combines Rayleigh/Mie scattering coefficients with phase values. | First slice calculator supports separate Rayleigh/Mie coefficient and phase fields, and `CanonicalAtmosphere` now supplies those phase values and medium coefficients. | Record parity evidence for separate Rayleigh/Mie transport using concrete models. |
| Type definitions, names, and units | Reconciliation type shapes and property names are the promotion target because most implementation code will be lifted from the reconciliation POC. Convertible quantities use explicit unit-bearing packets at durable/API boundaries. | Production types use explicit unit-bearing packets for wavelength facts and plural unit strings for the generic unit helpers. Reconciliation hot-path scalar names are not accepted as active spectral boundary packets. Some non-spectral concrete configuration fields still use meter/radian suffixes and remain a broader API cleanup. | Continue using reconciliation types and property names unless a POC name is actively misleading in the production contract. Replace remaining implicit-unit scalar configuration fields with explicit unit-bearing packets at durable/API boundaries for convertible quantities, and use narrow private adapters where hot-path scalar values are needed. |
| Spectral shape | Reconciliation hot path uses canonical scalar spectral arrays over `wavelengthsNanometers`; production durable/API boundaries require explicit `Wavelength` packets because wavelength can be converted across units. | `SpectralModel` uses `SpectralBasis.wavelengths` with plural-unit `Wavelength` packets and derives channel count/fingerprint. Canonical spectral channels now expose unit-neutral `wavelength` and `wavelengthBinWidth` packets. | Keep production durable unit-bearing boundary. Use private conversion locals for scalar nanometers/micrometers where promoted calculations need them, not public `wavelengthsNanometers` descriptors. |
| Concrete models | Reconciliation has `CanonicalAtmosphere`, `DistantSunLightSource`, `LocalSunLightSource`, `SphericalEarthGeometry`, `FlatEarthGeometry`, and incident caches. | Production now has core concrete atmosphere, light-source, geometry, incident-cache, canonical-data, Color/display, owner-provided geometry, atmosphere, light-source, source-created cache, core transport shader contributions, geometry-owned Three endpoint objects, and source-owned Three lighting objects with local specs. The former aggregate profile factories are quarantine-only archival files. | Add parity fixtures over the concrete model sets and browser scene-input path. |
| Shader assembly | Specific abstraction interfaces own their shader contributions and cache/source/geometry/atmosphere semantics; generic assembly validates symbols, orders fragments, emits GLSL, prepares textures/resources, binds runtime values, installs passes/materials, and manages lifecycle cleanup. | Generic production mechanics are now promoted under `ShaderBuilder`: descriptor synthesis, optional owner contribution providers, automatic configured-model assembly, source-created cache building/payload binding, `Algorithm32Transport` contribution collection, symbol validation, deterministic assembly, builder-owned runtime contribution, required Color-owned output contribution, cache texture resource preparation, required binding validation, cache descriptor/payload validation, reusable scene depth/hit capture, binding, pass installation, and cleanup. | Continue capability/resource polish without moving domain semantics into `ShaderBuilder`. Defer browser parity fixtures for scene color, ray-length/depth capture, hit mask, and selected-pixel output until real app integration provides stable composer readback surfaces. |
| Runtime Three integration | Awaited setup installs composer passes, manages scene color and hit/depth inputs, updates frame values only during render, and owns pass lifecycle. Stable capability diagnostics remain deferred. | Assembled setups can install a Three-compatible `SceneInputCapture` pass before the fullscreen Algorithm32 shader pass, bind composer scene color during the fullscreen pass render for final Color/display composition, create reusable renderer-produced scene depth/hit textures through `SceneInputCapture`, prepare cache texture resources, and dispose/remove owned runtime resources through the handle. Shader-facing object/material ID textures are intentionally not required for the atmosphere algorithm. Real app resize/browser-readback parity and capability checks remain pending. | Promote pass insertion policy beyond append and basic fail-loud capability/resource errors. Defer selected-pixel/readback parity to real app integration. Defer capability diagnostics taxonomy. |
| Failure policy | Config/setup operations fail loudly; per-frame runtime failures log and continue where possible. | First slice implements fail-loud config validation, setup attachment validation, handle/facade disposed failures, debug-view rejection, shader validation/resource setup failures, and non-fatal live pass render logging. | Keep setup/config/resource build failures loud. Extend live render fallback behavior as concrete runtime inputs and profile GLSL are promoted. |
| Scene input contract | GPU shader consumes renderer-produced scene color plus explicit ray-length/depth and hit-mask state. CPU/reference validation may use equivalent selected-ray or fixture inputs. Hit state is explicit: scene hit versus sky/no-hit; the transport algorithm needs ray length and hit mask, while final Color/display composition also needs hit-pixel scene color. Ground/scene endpoint meaning comes from geometry and Color/display policy, not shader-facing object/material IDs. | Production runtime now creates scene color/depth/hit inputs for the shader path. Production evaluation accepts optional supplied distance only; no renderer scene-input packet is part of `evaluate(...)`. | Add validation/oracle-only selected-ray or fixture inputs separate from the normal renderer path. Keep renderer RGB/material IDs out of `evaluate(...)`, and do not create a separate CPU-side render surface. |
| Endpoint display composition | Endpoint scene color/radiance composition belongs outside transport: `endpoint * T_view + L_path`. GPU path performs display conversion because it outputs pixels. | `Color` is promoted as the display-conversion owner through `BrunetonColorDisplayModel`, CPU conversion, descriptor/fingerprint output, and a Color-owned shader contribution consumed by assembled profile shaders. POC endpoint radiance and camera-distance scales are intentionally excluded as unjustified diagnostic/display tuning residue. | Keep endpoint color policy as renderer/display composition, not transport. Prove renderer capture and Color composition with browser/readback parity during real app integration. Do not promote `runtime.endpointRadianceScale` or `runtime.endpointCameraDistanceScale.*` without a new explicit app/Color policy rationale. |
| Source-driven Three lighting | Light source can create/synchronize renderer-light objects, including shadow/fill policy, while transport stays independent. | Production light sources now create renderer-light objects through `addSceneLighting(...)`: distant sources return directional lights plus targets with optional ambient/shadows, and local finite sources return ambient plus point or directional shadow lights with optional endpoint fill helpers. | Add source-light synchronization coverage where real app integration needs runtime source updates; keep the lighting adapter under source/runtime integration, not core transport. |
| Diagnostics/errors | Reconciliation has explicit invalid/missing/stale/capability concepts and records diagnostics in setup/runtime/validation contexts. | Production has no public error taxonomy, `getDiagnostics` implementation, runtime capability model, or diagnostics schema. | Deferred. Implement only the basic fail-loud setup/resource errors needed for the promoted runtime path; do not add stable diagnostics packets, diagnostic envelopes, or per-helper callbacks in the first slice. |
| Validation | Reconciliation has exact Step 032 CPU evidence, local/flat method-confidence records, shader descriptor/assembly/browser records, and GPU-vs-reference parity evidence. | Production tests are scaffold and analytic-helper tests; no production parity tests consume reconciliation records. | Add production parity fixtures or focused tests in slices. Use reconciliation records as supporting material, not runtime dependencies, and do not promote the POC postprocess validation harness. |
| Documentation boundary | Reconciliation docs/code/records remain supporting promotion material; older pre-reconciliation lanes are archive-only. | Production docs now state this boundary, but no delta tracker existed before this file. | Keep this file updated after each design or implementation step. Remove resolved rows or mark them accepted with the commit/record/test evidence. |

## Immediate Resolution Order

1. Keep the production top-level shape fixed: `Algorithm32`, the production
   dependency aggregate, `Reference`, and `ShaderBuilder` are the primary API
   boundary. Promote reconciled collaborators beneath those classes.
2. Remove production-design alternatives where the reconciliation POC already
   gives a non-conflicting detail. Treat POC behavior, packet names, property
   names, ownership, and method flow as accepted production detail.
3. Update production public interfaces and `types/types.d.ts` from the
   reconciliation type shapes and property names, replacing implicit-unit
   scalar fields with explicit unit-bearing packets at durable/API boundaries
   for convertible quantities and renaming only misleading POC names.
4. Update production public interfaces and `types/types.d.ts` for the five
   reconciliation boundaries: geometry, light source, atmosphere, incident
   radiance, and display.
5. Promote `SpectralCalculator` as a common internal utility for both
   `Reference` evaluation and incident-radiance cache building, plus its
   endpoint/trapezoid path-integration tests, before wiring the composed
   `evaluate(...)`.
6. Promote the canonical atmosphere and spherical/distant source/geometry
   baseline, then prove CPU parity against the accepted reconciliation Step
   032 evidence.
7. Promote incident-radiance cache contracts and the cache build coordinator,
   including cache-owned descriptors, sampler callbacks, cache access, and
   shader payload descriptors.
8. Refactor `Reference.evaluate(...)` to the reconciliation owner-query flow:
   geometry resolves view ray segment and cache/source coordinates;
   atmosphere samples medium and integrates optical depth; light source
   supplies direct lighting and source path limits; calculator computes
   radiance.
9. Define production shader descriptor/contribution/binding types, then build
   `ShaderBuilder` around abstraction-owned contributions while keeping the
   remaining mechanical source assembly, compatibility checks,
   texture/resource preparation, bindings, pass/material installation, frame
   updates, and cleanup inside the `ShaderBuilder` domain.
10. Continue the Three runtime attachment/resource polish from the promoted
   `SceneInputCapture` and `setupShader` path. Do not add shader-facing
   object/material ID textures unless a later shader behavior requires
   semantic per-pixel labels; the current atmosphere algorithm needs ray
   length, hit mask, and renderer scene color for final Color/display
   composition.
11. Add validation slices as each contract is promoted. Keep tests focused:
   interface guardrails first, then calculator invariants, then CPU parity,
   then shader descriptor/assembly, then selected-pixel/image parity.

Diagnostics are not part of this immediate resolution order beyond basic
fail-loud validation and setup/resource errors.

Failure policy is part of every promoted boundary: fail loudly before or
during setup/configuration, then log and continue during live runtime frames.

## Open Resolution Questions

None currently blocking the first production contract pass.

## Resolved Or Already Aligned

- Production already has a facade-shaped `Algorithm32` API surface matching
  the broad draft, though it is not implemented.
- Production `Algorithm32`, dependency aggregate, `Reference`, and
  `ShaderBuilder` remain the primary top-level API/implementation shape; the
  reconciliation POC drives the internal abstractions and data flow beneath
  those boundaries.
- Reconciliation POC details are the default production details unless an
  explicit recorded production conflict says otherwise.
- `SpectralCalculator` is resolved as a common internal utility/collaborator
  consumed by both `Reference` and incident-radiance cache building; it is not
  `Reference`-owned-only and is not a primary public facade API.
- Shader assembly ownership is resolved: abstraction interfaces own their
  specific shader contributions and semantics, while `ShaderBuilder` owns the
  remaining mechanical shader assembly, resource, binding, runtime, and
  cleanup lifecycle.
- Cache descriptor ownership is resolved: the light source creates the
  concrete cache, and the cache supplies descriptor facts and shader payload
  descriptors from the same layout. `ShaderBuilder` validates those facts
  against supplied cache texture payloads before resource creation.
- Texture artifact API is resolved for first production: do not expose a
  separate public texture-artifact import/export API. `ShaderBuilder` and the
  shader handle own awaited runtime texture/cache preparation; serializable
  descriptors and packed payloads remain internal/test support unless a later
  concrete non-app tooling consumer requires a narrow public artifact surface.
- Shader scene binding is resolved: `setupShader` receives live Three
  attachment handles, including scene, composer, and camera, as setup-time
  attachment state. Scene binding is not durable Algorithm32 configuration and
  is not normal mutable shader-handle state. Moving an installed pass to
  another scene/composer/camera should use explicit teardown/re-setup unless a
  later framework integration need justifies a narrow rebind operation.
- Operation-ready incident-radiance support uses the POC
  `IncidentRadianceSampling` name. It lives as setup/reference state for CPU
  evaluation, not durable public facade config. CPU evaluation precedence is
  per-request property first, including explicit `null`, then the configured
  `Reference` default, then no incident sampling. Shader setup/handle state
  owns the GPU resource equivalent.
- First shader resource target is resolved: assume WebGL2/Three
  `Data3DTexture` for incident-radiance cache resources in the initial
  production integration. A 2D atlas fallback is a later compatibility
  extension only if target devices require it.
- Cache spatial resolution is resolved: incident-radiance `z`/`rho`
  dimensions are derived from geometry/cache-domain descriptors, not global
  fixed defaults. Geometry owns source-relative coordinate mapping, domain
  ranges, binning policy, and resolution descriptors used by cache keys and
  shader texture dimensions. Fixed dimensions remain valid for validation
  fixtures or named local-domain quality presets. Incoming direction counts
  remain execution/source-sampling policy, and spectral groups remain
  spectral-model/packing policy.
- GPU-vs-reference tolerance policy is resolved from reconciliation evidence:
  selected-pixel comparisons against `Reference` plus `Color` use evidence
  `gpu-selected-rgba-byte-parity`, with max absolute RGB byte delta `3` for
  deterministic 8-bit display readbacks and exact alpha unless a scene
  declares alpha-composition behavior. Whole-image and controlled-region
  quality claims use scene-owned thresholds and report evidence
  `gpu-perceptual-quality-metrics`, including exact byte metrics, Rec.709
  luma/weighted-RGB proxy metrics, and CIEDE2000-style residual diffs with
  `1.0 Delta E 2000` as a review threshold.
- POC endpoint display scales are resolved as intentionally excluded from
  production. `runtime.endpointRadianceScale` and
  `runtime.endpointCameraDistanceScale.*` were visual diagnostic/tuning
  controls applied only to endpoint scene color, and must not become
  production Algorithm32 parity requirements or hidden Color policy.
- Debug views are resolved as deferred diagnostics: experiment/dev debug modes
  must not become first-production runtime shader API until a later diagnostics
  design accepts them.
- Star/celestial point-source display is resolved as app scene ownership:
  visible stars are handled outside the Algorithm32 shader as part of the
  scene, not as first-production shader facade features, hidden shader
  constants, atmosphere inputs, or Color extensions.
- Display conversion ownership is resolved: use the production `Color`
  abstraction. Color owns the Bruneton-backed spectral-to-display conversion,
  output color-space/tone-map/exposure policy, CPU `convert(...)` support, and
  shader-facing descriptors emitted through `describe()` or a promoted
  Color-owned descriptor. Do not introduce a separate
  `Algorithm32DisplayConversion` owner.
- Validation fixture policy is resolved: fixtures are unit-test artifacts and
  stay in checked-in production fixture ledgers beside the tests that consume
  them. Third-party source citations use the main production reference file,
  `shared/algorithm32/production/references.md`, and the same bracket-citation
  rules as production code. First-pass internal experiment references also use
  `shared/algorithm32/production/references.md`: add a short code and brief
  description, then cite it as `(script <code>)` until exact script, record,
  artifact, criterion, and run id locators are collected in
  `shared/algorithm32/production/evidence.md`. Raw reconciliation records
  remain generated evidence unless promoted into a cited production fixture, a
  formal reference-backed fixture source, a short-code internal experiment
  reference, or an accepted evidence entry.
- Production type definitions and property names should use reconciliation POC
  shapes/names. Convertible quantities use explicit unit-bearing packets at
  durable/API boundaries rather than implicit-unit scalar types. Renames are
  allowed only when a POC name is actively misleading and the mapping is
  documented.
- Production public geometry uses the reconciliation
  `resolveViewRaySegment(...)` contract. The older scaffold
  `resolveRayDistance(...)` may survive only as a private geometry helper.
- Diagnostics and public error taxonomy are deferred. The immediate promotion
  should avoid diagnostic result envelopes and scattered instrumentation.
- Failure policy is resolved: fail loudly on config/setup, log and continue on
  live runtime frame failures where possible.
- Production already has `SharedModel` and `SpectralModel` as facade-owned
  configuration/facts scaffolding.
- Production already keeps color/display outside CPU transport.
- Production already has guardrails against runtime imports from
  `shared/algorithm32/POC/`.
- Production already has generic math utilities that can support promoted
  code, though reconciliation vector helpers still need careful adaptation.
