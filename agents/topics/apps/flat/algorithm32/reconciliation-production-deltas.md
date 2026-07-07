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

Type definitions should follow the reconciliation POC type shapes by default
because most production implementation code will be lifted from that code base.
Keep production unit-bearing packet boundaries where units matter, such as
distance.

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

- `Algorithm32.js`: primary facade class shape only; methods are documented
  stubs.
- `implementation/Reference.js`: CPU/reference orchestration skeleton with
  several implemented leaf helpers and several unimplemented owner-query
  helpers.
- `implementation/ShaderBuilder.js`: documented runtime shader builder
  skeleton only.
- `models/SharedModel.js`: aggregate over `lightSource`, `atmosphere`,
  `geometry`, and `SpectralModel`.
- `models/SpectralModel.js`: implemented spectral basis model and descriptor.
- `types/LightSourceModel.d.ts`, `AtmosphereModel.d.ts`,
  `GeometryModel.d.ts`, `Color.d.ts`, and `types/types.d.ts`: first public
  interface/type surface.
- `utils/`: generic scalar, angle, distance, wavelength, vector, array, and
  sample helpers.
- Production tests currently guard scaffold shape, references, type homes,
  `SharedModel`, `SpectralModel`, and selected `Reference` helper invariants.

The production scaffold does not yet contain concrete source, atmosphere,
geometry, incident-cache, shader assembly, Three integration, runtime
capability, or display-conversion implementations.

## Reconciliation Target Snapshot

The reconciliation design has a more concrete architecture:

- `SpectralReferenceEvaluator` coordinates one evaluation.
- `SpectralCalculator` owns endpoint/trapezoid path integration and reusable
  radiance calculations.
- Geometry owns view-ray segments, atmosphere coordinates, atmosphere paths,
  source-relative positions, cache access, scene/model coordinate conversion,
  and endpoint objects.
- Light sources own direct lighting, source path limits, incident-cache
  family creation, and optional source-driven Three lighting.
- Atmosphere owns medium sampling, optical-depth integration over
  geometry-built paths, and separate Rayleigh/Mie phase samples.
- Incident-radiance support is prepared outside evaluation, then supplied as
  operation-ready `IncidentRadianceSampling` with an
  `incidentRadianceSampler(cacheAccess)` callback.
- Caches own their coordinate domains, generated values, sampler creation, and
  shader payload/access contribution.
- Shader assembly uses abstraction-owned contributions, descriptors, binding
  requirements, `TextureBuilder`, compatibility validation, setup/config/frame
  lifecycles, and a Three/composer integration layer.
- CPU soft-shader and GPU shader consume the same scene-input contract:
  renderer-produced scene color plus explicit hit/depth/object state, then
  endpoint composition outside transport.

## Delta Matrix

| Area | Reconciliation target | Current production state | Gap to resolve |
| --- | --- | --- | --- |
| Facade lifecycle | Facade owns validated config, shared model, CPU/reference evaluator, shader builder, disposal, and awaited shader setup/update. Diagnostics are a later concern. | `Algorithm32` exposes the intended methods but stores no config, creates no model, and delegates to nothing. | Implement facade state, validation, shared-model construction, `Reference`/shader builder wiring, and disposed-state failures while keeping the production facade shape as the primary API. Leave `getDiagnostics`/diagnostic schemas deferred. |
| Core CPU object split | `SpectralReferenceEvaluator` handles orchestration; `SpectralCalculator` owns reusable radiance math and endpoint/trapezoid integration. | `Reference` combines orchestration and helper leaves. There is no production `SpectralCalculator`. | Keep production `Reference` as the top-level CPU/reference implementation shape. Add/adapt an internal `SpectralCalculator` and reconciled owner-query flow beneath it instead of renaming the production boundary to the POC class. |
| Evaluation request/response | Evaluation returns spectral output plus resolved `viewRaySegment`, `pathIntegrationPoints`, and `PathRadiance`. Diagnostic traces remain deferred. | `EvaluationRequest` is origin/direction/supplied distance. `EvaluationResult` is only `pathRadiance` and `transmittance`. | Define production result tiers: public minimal spectral result and internal resolved-path artifacts. Avoid mixing renderer/display facts or diagnostic envelopes into `evaluate(...)`. |
| Geometry interface | Requires `resolveViewRaySegment`, `resolveAtmosphereCoordinate`, `resolveAtmospherePath`, `resolveSourceRelativePosition`, `resolveCacheAccess`, optional scene/model mapping, and endpoint object creation. | `GeometryModel` has `describe`, `getFrameDescriptor`, and `resolveRayDistance` only. | Replace or extend `resolveRayDistance` into the reconciliation geometry contract. Move altitude and source/cache coordinate ownership fully into geometry. |
| Atmosphere interface | `sampleMedium(AtmosphereCoordinate)`, `integrateOpticalDepth(AtmospherePath)`, `samplePhase(...)` returning separate Rayleigh/Mie phase facts. | `sampleMedium(request)` receives position, altitude, spectral basis. `samplePhase(...)` returns one scalar `value`. | Introduce `AtmosphereCoordinate`, `AtmospherePath`, optical-depth integration, and separate Rayleigh/Mie phase fields. Remove atmosphere dependence on raw geometry position for first-profile transport. |
| Light-source interface | `sampleDirectLighting`, `resolveSourcePathLimit`, `describeIncidentRadianceCache`, `createIncidentRadianceCache`, optional `createThreeLightingObjects`. | `LightSourceModel` has `sampleRadiance` and `sampleIncidentRadiance`. | Rename/split direct lighting from incident radiance. Move runtime incident sampling out of the generic light-source per-sample API and into setup-bound incident support. Add source-owned path-limit and cache-family methods. |
| Incident radiance | Setup builds a concrete cache and passes operation-ready `IncidentRadianceSampling`; sampler returns directional samples with incoming direction, radiance, and weight. | `IncidentRadianceSample` is only spectral radiance; `Reference` asks `lightSource.sampleIncidentRadiance(...)` per path sample. No production cache/sampler interface exists. | Add `IncidentRadianceCache`, `IncidentRadianceSampler`, `IncidentRadianceSampling`, cache descriptor, cache build coordinator, and directional incident sample packets. Update transport to use geometry-resolved `CacheAccess`. |
| Cache ownership | Concrete cache owns coordinates, generated values, sampler, shader payload, texture/access contribution. Build coordinator passes geometry, atmosphere, light source, and calculator into cache-owned coordinates. | Production docs say cache is behind light source, but no cache classes, descriptors, shader payloads, or build coordinator exist. | Promote cache contracts and coordinator. Keep generic evaluator unaware of concrete cache internals. Fail loudly on missing/stale cache where shader mode requires one. |
| Transport integration rule | Endpoint/trapezoid path points; segment transmittance uses previous/current extinction over interval length; source path transmittance comes from atmosphere optical depth over a geometry-resolved source path. | `Reference._computeSegmentTransmittance(...)` uses one medium sample and weight. `_createPathSamples`, `_sampleMedium`, `_sampleRadiance`, `_samplePhase`, and `_computeSourceTransmittance` are stubs. | Rework path sampling and transmittance to the reconciliation endpoint/trapezoid model. Add source-path integration through geometry and atmosphere before direct in-scattering. |
| Direct scattering | Light source supplies incident radiance and direction. Atmosphere supplies separate Rayleigh/Mie phase. Calculator combines Rayleigh/Mie scattering coefficients with phase values. | `Reference._computeDirectInScattering(...)` multiplies one scalar `phaseSample.value` by one `mediumSample.scatteringCoefficient`. | Split Rayleigh/Mie coefficients and phase fields or define an explicit combined scattering packet with provenance. Reconciliation currently favors separate values. |
| Type definitions and units | Reconciliation type shapes are the default promotion target because most implementation code will be lifted from the reconciliation POC. Unit-sensitive boundaries can retain production unit-bearing packets. | Production types currently use explicit unit-bearing packets for facts such as distance and wavelength. Reconciliation hot paths often use canonical scalar values, including `wavelengthsNanometers`. | Follow reconciliation types unless units matter. Keep production unit-bearing distance boundaries, and use narrow adapters/descriptors where reconciliation hot-path scalars meet production unit-bearing API packets. |
| Spectral shape | Reconciliation hot path uses canonical scalar spectral arrays over `wavelengthsNanometers`; production design prefers durable unit-bearing `Wavelength` packets at boundaries. | `SpectralModel` uses `SpectralBasis.wavelengths` with unit-bearing packets and derives channel count/fingerprint. | Keep production durable unit-bearing boundary, but add canonical hot-path scalar descriptors/adapters so reconciliation code can be promoted without duplicating spectral ownership. |
| Concrete models | Reconciliation has `CanonicalAtmosphere`, `DistantSunLightSource`, `LocalSunLightSource`, `SphericalEarthGeometry`, `FlatEarthGeometry`, and incident caches. | Production has only consumer-provided model interfaces and no concrete model implementations. | Decide first promotion slice: likely canonical atmosphere, spherical/distant baseline, then flat/local and local cache. Each concrete model needs production type files, specs, references, and descriptors. |
| Shader assembly | `Algorithm32ShaderAssembler`, descriptor builders, contribution factories, `TextureBuilder`, compatibility validation, cache-owned texture/access payloads, and quality profiles. | `ShaderBuilder` is a stub with `build`, `refreshConfig`, and `dispose`. | Keep production `ShaderBuilder` as the top-level runtime shader implementation shape. Define reconciled collaborators and internal classes beneath it, then promote contribution/binding descriptor types before GLSL code. |
| Runtime Three integration | Awaited setup installs a composer pass, manages scene color and hit/depth/object inputs, updates frame values only during render, and owns pass lifecycle. Stable capability diagnostics remain deferred. | `ShaderSetupRequest` accepts `composer`, optional `scene`, `camera`, `renderer`; no pass, target, depth, hit-state, capability, or binding lifecycle exists. | Design production attachment model, renderer-generated hit/depth/object pass, pass insertion policy, resize/dispose behavior, and basic fail-loud capability/resource errors. Defer capability diagnostics taxonomy. |
| Failure policy | Config/setup operations fail loudly; per-frame runtime failures log and continue where possible. | Production scaffold has no implemented failure policy. | Make constructor, `setConfig`, `setupShader`, awaited handle config updates, and resource build/bind setup throw or reject on invalid state. Make live render/runtime callbacks log failures and continue using last valid state, no-op, or fallback path where possible. |
| Scene input contract | CPU soft-shader and GPU shader consume the same constructed scene input. Hit state is explicit: scene hit, ground hit, sky/no-hit, invalid/missing. | Production evaluation accepts optional supplied distance only. No scene-input packets, hit classes, object/material ids, or CPU soft-shader contract exist. | Add validation/oracle-only scene input packets separate from normal renderer path. Keep renderer RGB/material ids out of `evaluate(...)`. |
| Endpoint display composition | Endpoint scene color/radiance composition belongs outside transport: `endpoint * T_view + L_path`. GPU path performs display conversion because it outputs pixels. | `Color` interface exists separately, but facade/handle do not accept display descriptors and `ShaderHandle` lacks `setDisplayConversion`. | Define display conversion descriptor and handle update path. Decide endpoint color policy for captured scene color versus spectral material fixtures. |
| Source-driven Three lighting | Light source can create/synchronize renderer-light objects, including shadow/fill policy, while transport stays independent. | Production has no Three lighting adapter or source-light sync surface. | Add source-owned renderer-light adapter contract under shader/runtime integration, not core transport. |
| Diagnostics/errors | Reconciliation has explicit invalid/missing/stale/capability concepts and records diagnostics in setup/runtime/validation contexts. | Production has no public error taxonomy, `getDiagnostics` implementation, runtime capability model, or diagnostics schema. | Deferred. Implement only the basic fail-loud setup/resource errors needed for the promoted runtime path; do not add stable diagnostics packets, diagnostic envelopes, or per-helper callbacks in the first slice. |
| Validation | Reconciliation has exact Step 032 CPU evidence, local/flat method-confidence records, shader descriptor/assembly/browser records, CPU soft-shader and GPU parity records. | Production tests are scaffold and analytic-helper tests; no production parity tests consume reconciliation records. | Add production parity fixtures or focused tests in slices. Use reconciliation records as supporting material, not runtime dependencies. |
| Documentation boundary | Reconciliation docs/code/records remain supporting promotion material; older pre-reconciliation lanes are archive-only. | Production docs now state this boundary, but no delta tracker existed before this file. | Keep this file updated after each design or implementation step. Remove resolved rows or mark them accepted with the commit/record/test evidence. |

## Immediate Resolution Order

1. Keep the production top-level shape fixed: `Algorithm32`, the production
   dependency aggregate, `Reference`, and `ShaderBuilder` are the primary API
   boundary. Promote reconciled collaborators beneath those classes.
2. Update production public interfaces and `types/types.d.ts` from the
   reconciliation type shapes by default, retaining production unit-bearing
   packets where units matter.
3. Update production public interfaces and `types/types.d.ts` for the five
   reconciliation boundaries: geometry, light source, atmosphere, incident
   radiance, and display.
4. Promote or adapt `SpectralCalculator` and endpoint/trapezoid
   path-integration tests before wiring the composed `evaluate(...)`.
5. Promote the canonical atmosphere and spherical/distant source/geometry
   baseline, then prove CPU parity against the accepted reconciliation Step
   032 evidence.
6. Promote incident-radiance cache contracts and the cache build coordinator,
   including cache descriptors, sampler callbacks, cache access, and shader
   payload descriptors.
7. Refactor `Reference.evaluate(...)` to the reconciliation owner-query flow:
   geometry resolves view ray segment and cache/source coordinates;
   atmosphere samples medium and integrates optical depth; light source
   supplies direct lighting and source path limits; calculator computes
   radiance.
8. Define production shader descriptor/contribution/binding types, then build
   `ShaderBuilder` around abstraction-owned contributions and cache-owned
   texture/access payloads.
9. Design the Three runtime attachment model and renderer-generated
   hit/depth/object pass before implementing the app-facing `setupShader`.
10. Add validation slices as each contract is promoted. Keep tests focused:
   interface guardrails first, then calculator invariants, then CPU parity,
   then shader descriptor/assembly, then selected-pixel/image parity.

Diagnostics are not part of this immediate resolution order beyond basic
fail-loud validation and setup/resource errors.

Failure policy is part of every promoted boundary: fail loudly before or
during setup/configuration, then log and continue during live runtime frames.

## Open Resolution Questions
- Should `resolveRayDistance` be removed in favor of
  `resolveViewRaySegment`, or retained as a helper behind the geometry
  implementation boundary?
- What is the exact production packet name for operation-ready incident
  radiance support: `IncidentRadianceSampling`, `IncidentRadianceSupport`, or
  another name?
- Which display-conversion descriptor belongs on `setupShader` and shader
  handle updates, and which display settings remain app presentation state?
- Which reconciliation records become checked-in production fixtures, and
  which remain external evidence referenced by docs/status?
- Which shader resource target is first: WebGL2 `Data3DTexture` only, or a
  required 2D atlas fallback before initial production integration?

## Resolved Or Already Aligned

- Production already has a facade-shaped `Algorithm32` API surface matching
  the broad draft, though it is not implemented.
- Production `Algorithm32`, dependency aggregate, `Reference`, and
  `ShaderBuilder` remain the primary top-level API/implementation shape; the
  reconciliation POC drives the internal abstractions and data flow beneath
  those boundaries.
- Production type definitions should follow reconciliation type shapes by
  default, with production unit-bearing packet boundaries retained for
  unit-sensitive facts such as distance.
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
