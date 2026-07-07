# Algorithm32 Status

Current status: production shader/runtime implementation is the active
handoff after the reconciliation POC. The POC conclusions are now the
consolidated implementation driver for the production reference/shader path,
including the adjusted primary abstractions and ownership boundaries. The
production scaffold exists under `shared/algorithm32/production/`; the next
work is to implement the usable runtime shader / Three composer path from the
accepted production contracts.

## Current Checkpoint

- The reconciliation POC is the consolidated production implementation guide.
  Its production-facing handoff is
  [Reconciliation Conclusions](../reconciliation/conclusions.md). Production
  implementation should promote those contracts into
  `shared/algorithm32/production/` without runtime-linking to reconciliation
  POC or experiment code. Remaining provenance gaps live in
  [Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md).
- The reconciliation topic, reconciliation POC code, and reconciliation
  experiment records remain relevant supporting implementation material:
  `agents/topics/apps/flat/reconciliation/`,
  `scripts/flat/reconciliation/POC/`, and
  `tmp/atmosphere/reconciliation/`.
- Older pre-reconciliation cleanroom, shader-lab, local-second-order,
  `shared/algorithm32/POC/`, source-contract, and scattered experiment lanes
  are no longer production implementation references. Treat them as archival
  unless the user explicitly asks for historical archaeology.
- Production shader work should proceed in `shared/algorithm32/production/`
  using [Reconciliation Conclusions](../reconciliation/conclusions.md) first,
  [Reconciliation To Production Deltas](reconciliation-production-deltas.md),
  [Algorithm32 Requirements](requirements.md),
  [Algorithm32 Production Design](production-design.md), and
  [Algorithm32 Primary Facade API Draft](api-facade-draft.md). The immediate
  implementation direction is the runtime shader builder / Three composer pass
  with prepared cache textures, renderer-generated scene color plus
  hit/depth/object inputs, display composition, and fail-loud setup/resource
  validation.
- Design decision: keep the production top-level API/implementation shape as
  primary. `Algorithm32`, the production dependency aggregate, `Reference`,
  and `ShaderBuilder` stay in place; reconciliation POC details and ownership
  abstractions are promoted beneath those boundaries.
- Design decision: production type definitions should follow reconciliation
  POC type shapes by default because most implementation code will be lifted
  from that code base. Keep production unit-bearing packet boundaries where
  units matter, such as distance.
- Design decision: diagnostics remain deferred. First promotion should avoid
  diagnostic envelopes, per-helper callbacks, and stable public diagnostics
  taxonomy; implement only the basic fail-loud validation/setup/resource
  errors needed for the runtime path.
- Design decision: fail loudly on configuration and setup surfaces, including
  constructor validation, `setConfig`, `setupShader`, awaited handle config
  updates, and resource build/bind setup. Once the runtime render path is
  live, log runtime failures and continue with the last valid state, no-op, or
  fallback path when possible.
- The old reconciliation gate produced the following durable baseline:
  Milestone 1 is
  complete under `scripts/flat/reconciliation/POC/`: the CPU Algorithm32
  distant-Sun/spherical-Earth path, canonical atmosphere, distant light source,
  spherical geometry, distant L2 incident-radiance cache build/bind/sample
  path, Figure 1 renderer, and exact decoded RGBA Step 032 image comparison
  are implemented and accepted. Record
  `tmp/atmosphere/reconciliation/016-step032-full-image-comparison` generated
  the four full-size cache-backed sky-dome PNGs and matched all accepted Step
  032 targets exactly. The main algorithm produces spectral data only and does
  not assume distant light, spherical geometry, a specific atmosphere
  implementation, absent L2 incident sampling, rendering, or color conversion.
- Reconciliation Milestone 2 later closed as local/flat method-confidence
  evidence. Earlier M2 records include: record
  `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward` completed
  Subgoal 2.0 by carrying forward the existing local Sun / flat geometry gap
  analysis, snapshotting the separate M2 calibration/evidence tracker,
  classifying Step 018 atmosflat sky domes as guide imagery only, and
  classifying first implementation defaults as seed choices rather than final
  production constants. Record
  `tmp/atmosphere/reconciliation/018-m2-north-polar-aeqd-source-decision`
  settles the flat projection choice as north-polar azimuthal equidistant,
  sources the projection facts to PROJ, and leaves the exact Earth-radius value
  as source-precision pending. Record
  `tmp/atmosphere/reconciliation/019-m2-atmosphere-boundary-ownership`
  corrects top-boundary ownership: atmosphere/profile supplies medium-domain
  limits, geometry computes ray exits against those supplied limits, and
  renderer/view policy owns no-hit sky caps. Records
  `tmp/atmosphere/reconciliation/025-m2-flat-geometry-profile` through
  `tmp/atmosphere/reconciliation/030-m2-local-flat-assets-quick-rerun`
  implement and verify flat geometry, local Sun packets/calibration, basic
  local/flat CPU transport, the pre-asset diagnostic gate, and local/flat PNG
  assets. The next reconciliation POC task is Subgoal 2.6 closeout; do not
  promote final local/flat numerical controls or exact Step 018 parity from
  records 025 through 030 alone.
- The initial implementation ships one atmosphere profile: the accepted
  Algorithm32 canonical profile. Alternate atmosphere profiles are future
  named extensions, not first-implementation defaults.
- Every promoted constant needs per-value provenance: an external source, a
  source-backed derivation, or an accepted Algorithm32 experiment/decision.
- The Bruneton start-fresh source audit found no active retained Step 032
  pure-algorithm ingredient with neither an external reference nor accepted
  experimental support. Treat the accepted Step 032 result as the
  authoritative pure Algorithm32 baseline for reconciliation intake; the
  remaining work is final-ledger provenance precision and evidence reruns
  under finalized parameters.
- Reconciliation artifact gaps are recorded unless they are egregious. The
  hard artifact rule is matching the accepted Bruneton start-fresh Experiment
  32 / Step 032 sky dome/four-view artifacts by exact decoded RGBA parity;
  other missing diagnostics or criteria files are findings unless they block
  the current verification claim.
- Future atmosphere experimental lanes should use Step 032 as their baseline
  comparison anchor. Any deviation from it must be named, justified by source
  or accepted experiment, and measured; unjustified drift is not promotable.
- Shader-lab evidence primarily justifies the shader implementation by matching
  shader output to an Algorithm32-backed CPU reference. It does not independently
  justify Algorithm32 physics. Reconciliation must prove the CPU reference
  stayed baseline-faithful before using it as the shader oracle.
- The GPU shader may take implementation shortcuts relative to the CPU
  reference for performance, packing, precision, interpolation, branching, or
  cache use. Those shortcuts are promotable only when named, bounded by
  tolerances, and tested against the baseline-faithful CPU reference; they do
  not redefine Algorithm32.
- The final accepted Algorithm32 visual baseline was selected by subjective
  review among source-backed candidates. That selection is part of the
  evidence trail, but retained equations, constants, approximations, and
  display choices still need explicit source trails before promotion.
- The reconciliation interface split is now light/source, geometry,
  atmosphere, incident radiance cache/sampler, and color. Light/source,
  geometry, atmosphere, and optional incident radiance sampler callbacks feed
  Algorithm32 transport. Color is a published display boundary outside the
  algorithm itself. It is not required to execute the CPU reference transport,
  but the later GPU shader phase will need the color/display interface to
  build the renderable output path. Milestone 1 must make this split real in
  code and implement the complete CPU Algorithm32 path with L2 incident
  radiance; because it succeeded, Milestone 2 is primarily adding concrete
  `FlatEarthGeometry` and `LocalSunLightSource` implementations on that
  existing algorithm/cache lifecycle, starting with flat geometry. Numerical
  controls are execution configuration.
- Reconciliation POC complex types must have named ambient declarations in an
  owning `types.d.ts` file, and JavaScript implementation code must use JSDoc
  to record where those types are consumed or produced. This applies to value
  packets, descriptors, requests, samples, callbacks, handles, diagnostics,
  shader payloads, cache keys, and persisted artifact shapes. Runtime class
  modules use one file per class with that class as the single default export;
  required complex types stay in `types.d.ts`.
  POC class names may be clear working names rather than production-final API
  names; promotion can refine names if the accepted architecture benefits.
- The reconciliation POC now has a shared constants module at
  `scripts/flat/reconciliation/POC/src/constants/consts.js`, with ambient
  constant packet declarations in `constants/types.d.ts`. Atmosphere,
  artifact-rendering, source setup, and primary runner work should consume
  those canonical atmosphere, spectral-channel, Figure 1 display/render/scene,
  and numerical-control packets rather than copying Step 032 values. This is
  recorded in
  `tmp/atmosphere/reconciliation/005-shared-baseline-constants`.
- The M1 Figure 1 display conversion can be implemented in artifact-rendering
  code executed by the experiment runner. It should not be placed inside CPU
  transport, and it does not require a concrete `ColorDisplayModel`
  implementation for M1. This is recorded in
  `tmp/atmosphere/reconciliation/006-artifact-renderer-display-conversion`.
- The M1 artifact renderer should port the accepted Bruneton start-fresh
  rendering path for projection, sky-disc masking, display conversion, byte
  packing, and PNG writing, adapting only the spectral transport source to the
  new POC evaluator/calculator/cache path. Step 032 artifact acceptance is
  exact decoded RGBA match across all four accepted PNG targets, with
  `maxAbsRgbaDelta = 0`, `mismatchedByteCount = 0`, and
  `mismatchedPixelCount = 0`. This is recorded in
  `tmp/atmosphere/reconciliation/007-exact-step032-renderer-parity`.
- Reconciliation should preserve the accepted Algorithm32 transport algorithm
  while sharpening the abstractions: geometry owns observer/light placement
  resolution, model-space meaning, source-relative positions, geometry
  clipping, and source-relative cache-coordinate mapping; light source owns
  lighting facts such as spectrum, radiometry, angular extent, falloff,
  calibration, distance-use treatment for geometry-measured source distance,
  source path limits, and the source-declared incident cache family; atmosphere
  owns medium and phase facts; incident radiance cache/sampler owns generated
  incident-field descriptors, bindings, cache variants, lookup policy, the
  runtime `IncidentRadianceSampler` callback, and returned
  `IncidentRadianceSamples` facts; transport consumes these packets and
  must not derive light-source distance or interpret geometry coordinates. The reconciliation abstraction
  design now includes a dedicated `Algorithm` section for the owner-query
  `evaluate(...)` Markdown algorithm, listing only calculation-consumed outputs
  with function-style owner-query notation, bold variable names, and plain
  Markdown calculations using `<sub>`/`<sup>` tags where subscript or exponent
  notation helps. The algorithm now explicitly surfaces
  `AtmosphereCoordinate`, `SourceRelativePosition`, light-source-owned
  `sourcePathLimit`, and geometry-owned `sourceAtmospherePath` handoffs to
  reduce cross-interface leakage; the coordinate-space section now names
  `AtmospherePath` as the geometry-owned path transform into atmosphere
  coordinates plus segment measures. The cache design now treats
  `IncidentRadianceCache` as a coordinated generated incident-radiance field:
  the light source creates the concrete source-shaped cache, the cache owns its
  logical coordinate generator/keying/generated values, and a generic
  setup/build coordinator passes each cache-owned coordinate back to the cache
  with geometry, atmosphere, light source, and the general calculator.
  Geometry maps both cache build
  coordinates and runtime path integration points into the same source/atmosphere-relative
  cache-access domain, and setup validates the built cache against active
  context descriptors before evaluation receives optional
  `IncidentRadianceSampling`. When present, that value contains the
  operation-ready `IncidentRadianceSampler` callback plus cache-access
  metadata; when omitted, no cache lookup occurs and incident in-scattering
  sees an empty sample set. The general calculator, provisionally
  `SpectralCalculator`, subsumes the old radiance-port idea and
  owns the reusable readable `computeRadiance(...)` loop used by both primary
  evaluation and cache generation. It is configured with geometry, atmosphere,
  light source, spectral basis, and execution controls; `computeRadiance(...)`
  receives the resolved `RaySegment`, the prebuilt `PathIntegrationPoint[]` value packet, and
  optional operation-specific `IncidentRadianceSampling`. Cache generation omits that
  optional value.
  `computeRadiance(...)` returns `PathRadiance`: `inScattered` plus final
  `transmittance`; `inScattered` is path-added spectral radiance,
  with "in" meaning light scattered into the evaluated ray, `transmittance` is
  the dimensionless surviving endpoint multiplier, cache builds store
  first-order `inScattered`, and endpoint composition remains explicit. Both fields use the shared `SpectralValue`
  type; the field/parameter name carries physical meaning and units. The
  source-backed portion is the optical-depth/Beer-Lambert transmittance and
  volume in-scattering equation family; cache shapes, sample counts,
  direction-set choices, and finite-source bounds remain Algorithm32
  evidence/configuration decisions rather than external constants. The
  canonical path rule is fixed endpoint/trapezoid. Higher-order field
  preparation can happen during setup/cache building, but higher-order
  contribution is still sampled and weighted inside each path-integration-point loop. The
  public operation is `incidentRadianceSampler(cacheAccess)`, where
  `cacheAccess` is a geometry-resolved packet derived from the current sample
  facts and consumed by the bound callback when incident sampling is present.
  Configuration-time states are no incident sampling, `distant`, and `local`.
  Separate artifacts are optional
  persistence, diagnostic, or shader-packing outputs, not required runtime
  objects. Shader setup uses the same logical cache through cache-exposed
  shader payload descriptors, while `ShaderBuilder` owns GPU texture creation,
  upload, binding, and fallback policy. Shared CPU/shader logic is limited to
  setup/build contracts and utilities: canonical descriptors, fingerprints,
  spectral/channel helpers, numerical-control descriptors, cache-build
  coordination, concrete cache families, cache-access contracts,
  shader-payload formation, diagnostics, provenance, and fail-loud validation.
  CPU transport remains JavaScript, while shader runtime transport is assembled
  into GLSL and validated by descriptor-backed parity tests. The shared
  `SpectralCalculator` general calculator owns the reusable
  readable radiance loop for both primary evaluation and cache generation,
  while its lower-level helper methods own named equation terms,
  spectral-channel math, fixture-backed calculations, and small convenience
  loops such as spectral-channel or directional-sample reductions. Helper
  methods take explicit calculation parameters instead of broad request
  objects. Atomic inner-loop helpers reduce explicit inputs to one returned
  value packet, such as one `SpectralValue`. They may also take the
  exact interface instance they need, such as atmosphere phase sampling for a
  directional incident loop, and call it directly inside that named
  calculation. Moving stable collaborators into calculator configuration
  shrinks orchestration signatures only; the lower-level helper surface remains
  explicit and fixtureable. Path integration point construction can live on the
  calculator because it creates endpoint/trapezoid `PathIntegrationPoint[]` value objects
  from a geometry-resolved `RaySegment` and interval count, with no geometry,
  atmosphere, light, or cache queries. Each point is defined by
  `distanceAlongRayMeters` within the owning segment plus integration weights;
  `measureMeters` is the effective path length represented by that point.
  Model-space position is derived from the segment ray when needed. The coarse
  transport split is now:

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

  Its helper methods must not own the cache coordinate loop, setup lifecycle,
  or shader resources. The cache-build method surface is now explicit:
  coordinator
  `buildIncidentRadianceCache(...)`; light source
  `describeIncidentRadianceCache(...)` and
  `createIncidentRadianceCache(...)`; cache `coordinates()`,
  `addCoordinateToCache(...)`, `createIncidentRadianceSampler(...)`,
  and `createShaderPayload(...)`; sampler callback
  `incidentRadianceSampler(cacheAccess)`;
  geometry
  `resolveViewRaySegment(...)` plus cache mapping/build/access resolvers; atmosphere
  cache-dependency descriptors;
  `calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`;
  `calculator.computeRadiance(...)`; and
  `ShaderBuilder.buildIncidentRadianceCacheTexture(...)`. The design also has a
  coordinate-systems reference covering
  configuration, model, ray/path, observer-local sky, source-relative, cache,
  shader input, and display/color spaces. The current source/light audit
  synthesizes distant and local Sun requirements into a geometry-owned
  `SourceRelativePosition` plus descriptor-driven cache indexing:
  `SourceRelativePosition` itself is only direction from source plus
  `distanceFromSourceMeters` when geometry has a finite placement. The
  coordinate zero/source origin must be explicit in the placement descriptors:
  finite sources use a geometry-resolved source anchor, source orientation can
  also be geometry-resolved into the source-relative frame when relevant, and
  directional sources declare no finite origin and use
  `distanceFromSourceMeters = null`.
  Distant caches collapse to source key, altitude, incoming direction, and
  spectrum; local finite caches additionally need source-relative radial
  distance from the source subpoint/axis.
- The initial production atmosphere coordinate is altitude-only vertical
  stratification: reconciliation should require a geometry-owned resolver,
  provisionally `GeometryModel.resolveAtmosphereCoordinate(...)`, that maps
  model-space positions to `altitudeMeters`. Atmosphere samples
  density/coefficient profiles from that resolved coordinate. Earth/geographic
  coordinates, ocean/land selectors, season, weather, and regional aerosol
  families are later profile-selector extensions, not first-pass transport
  requirements.
- The active runtime spectral basis is the 15-channel centered grid. The
  40-wavelength path remains a source-backed validation/reference mode.
- Runtime/default numerical controls are currently `40/20/34/48`; the
  validation/reference controls are `80/40/68/96`. Their support is
  experimental convergence evidence, not external physics validation.
- Local second-order artifacts must be recreated during reconciliation,
  including both objective criteria artifacts and subjective/review galleries
  from the historical `scripts/flat/local-second-order/` lane.
- Optional further validation: run a real-Sun-matched local-source comparison
  on spherical geometry, where a finite local Sun is configured to match the
  resolved distant/real Sun at a reference view point, then compare outputs and
  diagnostics on the same geometry. Treat this as limiting-case/source-
  geometry-separation evidence, not as external validation of local-Sun
  physics. The experiment should record the explicit handoff facts between
  geometry and source, because light amount legitimately depends on resolved
  position, distance, apparent size, path clipping, falloff inputs, and
  calibration state. If it cannot run without flat geometry, classify the gap
  as missing source config, missing geometry fact, coordinator data-flow gap,
  or improper coupling.
- The post-Step032 product facts audit should be used for
  reverse-chronological provenance checks across atmosflat, shader-lab, and
  local second-order. It tracks pure facts that drove the final product;
  generated artifacts are evidence handles, not facts to promote. Local Sun
  implementation has the largest source gaps: cache behavior is accepted
  experimental evidence, while source placement, calibration, terrain, stars,
  and time-sync displays need source/model decisions before promotion. The
  old inherited local-source tint was reverted in accepted artifact
  `095-local-source-neutral-white-stack`; treat any remaining tint fallback as
  stale POC residue, not an active local-lane fact.
- The local Sun / flat-geometry fact inventory now isolates the artificial
  false-Sun, flat z-up, long-sightline, and local L2 cache facts. Some
  sub-equations are source-backed candidates, but the combined model is not
  externally validated as real-world physics and must be promoted only as a
  named Algorithm32 extension profile. It now also records legacy flat
  projection provenance showing the north-polar azimuthal-equidistant choice
  as intentional app/model lineage rather than an accidental implementation
  value, with record 018 sourcing the projection identity/parameters to PROJ.
- Local Sun reconciliation must distinguish authored/user configuration from
  the source-backed or accepted facts that act on it. Default false-Sun
  altitude, size, and annual latitude migration are source-recovery profile
  defaults that remain user-configurable. False-Sun brightness/source power,
  raw brightness scale, and real-time synchronization have no identified
  source or independent time standard in the flat model; they belong behind a
  named calibration algorithm and reference event. Projection math, solid
  angle, inverse-square falloff, transmittance, and calibration equations are
  the supportable algorithms that transform configuration into derived source
  packets and diagnostics.
- View placement is also configuration: Algorithm32 receives latitude,
  longitude, local time, and view altitude. How the app derives or defaults
  altitude is separate upstream policy, so historical San Jose/elevation and
  `[0, 0, 2]` observer values remain fixtures unless explicitly passed as
  config.
- The app purpose is to steel-man the flat Earth model and let users adjust
  model parameters to inspect real-world consequences. Configurability is
  therefore intentional product behavior. The reconciliation task is to name
  the authored profile controls, source the algorithms that act on them, and
  expose consequences honestly rather than treating every false-world default
  as a failed real-world constant.
- The reconciliation source-gap ledger is now the single actionable list for
  unsourced, partially sourced, model-only, experiment-backed, and
  display-fixture facts. Use it to drive `parameters.md` and do not promote a
  row until its listed action is resolved or it is explicitly excluded.

## Reference Boundary

The reconciliation POC is complete enough to act as the production
implementation source through
[Reconciliation Conclusions](../reconciliation/conclusions.md), with the
reconciliation topic, code, and experiment records available as supporting
implementation material. Relevant reconciliation sources are:

- `agents/topics/apps/flat/reconciliation/`
- `scripts/flat/reconciliation/POC/`
- `tmp/atmosphere/reconciliation/`

Do not use older pre-reconciliation cleanroom, shader-lab,
local-second-order, `shared/algorithm32/POC/`, source-contract, or scattered
experiment lanes as production references unless the user explicitly asks for
historical analysis.

Use [Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md)
only as the actionable provenance-gap ledger. When it requires a citation or
source pointer, use external reference/provenance catalogs for that specific
gap; do not reopen old implementation lanes as design authority.

## Reload Order

For a new or compacted agent, bootstrap normally from
[Active Topic](../../../active-topic.md). If reading this file standalone,
load only the production implementation handoff:

1. [Active Topic](../../../active-topic.md)
2. [Reconciliation Conclusions](../reconciliation/conclusions.md)
3. [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
4. [Reconciliation Lane](../reconciliation/README.md)
5. [Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md)
6. [Algorithm32 Production Documentation](README.md)
7. [Algorithm32 Requirements](requirements.md)
8. [Algorithm32 Production Design](production-design.md)
9. [Algorithm32 Primary Facade API Draft](api-facade-draft.md)
10. `shared/algorithm32/production/implementation/reference_plan.md`

Inspect `scripts/flat/reconciliation/POC/` and
`tmp/atmosphere/reconciliation/` when implementation work needs concrete code
or experiment detail from the reconciliation handoff.

Historical pre-reconciliation cleanroom, shader-lab, local-second-order,
`shared/algorithm32/POC/`, source-contract, and scattered experiment artifacts
are archive-only for this topic.

## Current Open Work

- Resolve the architecture/API gaps tracked in
  [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
  before changing production contracts.
- Promote reconciled internals without renaming the top-level production
  facade, dependency aggregate, `Reference`, or `ShaderBuilder` boundaries.
- Promote type definitions from the reconciliation POC by default, while
  retaining production unit-bearing packets for unit-sensitive facts such as
  distance.
- Promote the reconciliation conclusions into
  `shared/algorithm32/production/` as the production CPU/reference and shader
  implementation.
- Build the runtime shader builder / Three composer pass with prepared cache
  textures, renderer-generated scene color plus hit/depth/object inputs,
  display composition, and fail-loud setup/resource validation.
- Apply the failure policy across promoted code: fail loudly on config/setup;
  log and continue on live runtime failures where possible.
- Keep the production facade aligned with [Algorithm32 Primary Facade API Draft](api-facade-draft.md):
  `constructor`, `config`, `setConfig`, awaited `setupShader`, `evaluate`,
  deferred `getDiagnostics`, and `dispose`.
- Resolve any remaining source/provenance gaps only through
  [Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md)
  and targeted external/provenance references.
- Update production status/design docs after implementation steps with what
  changed, what was verified, and what remains.
