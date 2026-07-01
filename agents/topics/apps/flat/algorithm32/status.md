# Algorithm32 Status

Current status: design and reconciliation prep. The production scaffold exists
under `shared/algorithm32/production/`, but no production shader/runtime
implementation has been promoted outside the preserved POC bundle.

## Current Checkpoint

- The next gate is a new experimental lane named `reconciliation`.
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
  32 / Step 032 sky dome/four-view artifacts; other missing diagnostics or
  criteria files are findings unless they block the current verification
  claim.
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
  build the renderable output path. Numerical controls are execution
  configuration.
- Reconciliation POC complex types must have named ambient declarations in an
  owning `types.d.ts` file, and JavaScript implementation code must use JSDoc
  to record where those types are consumed or produced. This applies to value
  packets, descriptors, requests, samples, callbacks, handles, diagnostics,
  shader payloads, cache keys, and persisted artifact shapes. Runtime class
  modules use one file per class with that class as the single default export;
  required complex types stay in `types.d.ts`.
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
  projection provenance showing the north-pole azimuthal-equidistant choice as
  intentional app/model lineage rather than an accidental implementation value.
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

## Reconciliation Lane

Create a new `reconciliation` experiment lane before production promotion.
Its job is to turn the accepted Algorithm32 evidence into two concrete
implementation targets and one complete data contract.

This lane is a mutable full-POC lane rather than the previous cumulative,
rerunnable experiment style. The living POC implementation belongs under
`scripts/flat/reconciliation/POC/`. Milestone 0 is scaffold preparation, not a
formal experiment, and is accepted when the mutable skeleton exists; an
imperfect skeleton can be iterated later. Numbered folders under
`tmp/atmosphere/reconciliation/NNN-*` are still required as the durable audit
trail once substantive verification begins: significant runs, parity targets,
rejected attempts, and design-verification steps. Each record should capture
what changed, when, why, what was checked, and which facts, references, or
artifacts were produced; it does not need to be a standalone rerunnable
experiment.
Parallel current-state notes are allowed and expected. This status file,
the reconciliation README, the active-topic handoff, and eventually a POC
`CURRENT_STATE.md` may be rewritten to reflect the current architecture,
parity status, active blockers, latest accepted record, and next actions.
They summarize the lane; numbered records preserve the history.
Historical POC and experiment code may be mined, copied, or ported into the
new POC with provenance, but the reconciliation POC must not import, symlink,
re-export, or otherwise runtime-link to old code where it currently lives.

End results:

1. A new CPU reference implementation of Algorithm32 under
   `shared/algorithm32/production/`, with reference-backed algorithms,
   reference-backed or explicitly accepted constants, and proper separation
   between the light/source, geometry, atmosphere, incident radiance
   cache/sampler, and color interfaces. The CPU reference uses light/source,
   geometry, atmosphere, and optional incident radiance sampler callbacks to run
   transport; the color boundary is defined, but color is not needed to
   execute CPU transport.
2. A GPU shader implementation that implements the CPU reference within
   documented tolerances. Shader packing, precision, cache layout, and
   approximation shortcuts must be tested against the CPU reference or recorded
   as explicit implementation decisions.
   In this phase, the shader builder/runtime uses the color/display interface
   to convert spectral transport output into renderable output.
3. A documented shape and flow for every data object that crosses the
   boundaries: configuration, resolved models, spectral basis, ray/path
   requests, source samples, geometry intersections, medium samples, transport
   state, incident-radiance cache descriptors and sampler bindings, shader
   textures/uniforms, spectral outputs, diagnostics, and color/display
   requests.

Primary outputs:

- The CPU reference implementation and tests proving its algorithms and
  constants are source-backed or accepted Algorithm32 decisions.
- The GPU shader implementation and parity artifacts proving it implements
  the CPU reference within stated tolerances.
- A data-flow contract naming each request, sample, descriptor, cache/sampler
  binding, cache payload, shader binding, result, and diagnostic object, with
  its owner boundary.
- `parameters.md` or equivalent, listing every promoted constant, derived
  value, formula, owner subsystem, and source trail.
- Machine-readable `equations-and-constants.json` for the reconciled run.
- Criteria/results artifacts and reports for the accepted transport,
  convergence, local-source, second-order, shader/CPU parity, and display
  boundary checks.
- A local-second-order artifact manifest covering command/script origin,
  objective-or-subjective evidence type, criteria summary, rendered image
  outputs, and superseded/rejected history.

Major POC parity goals:

1. CPU reference, distant Sun, spherical Earth parity against
   `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
2. CPU reference, local Sun, flat Earth parity against
   `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`, verified in
   parts where needed because the scenario is artificial.
3. GPU integrated shader, spherical Earth, distant Sun parity against the CPU
   reference, with browser-run job watching for long-running shader tests.
4. GPU integrated shader, local Sun, flat Earth parity informed by the
   shader-lab and local-second-order lanes.

The browser watcher may be designed and implemented before Milestone 3, but
the long-lived browser process itself is a user-run step when sandbox
restrictions prevent the agent from launching or controlling the browser.

Use [Reconciliation Lane](../reconciliation/README.md) as the expanded lane
plan, [Reconciliation Action Plan](../reconciliation/action-plan.md) as the
current milestone order, and
[Reconciliation Experimental Guidelines](../reconciliation/experimental-guidelines.md)
as the lane operating rulebook. The source follow-up remains in
[Algorithm32 Conclusions](conclusions.md#follow-up-reconciliation-lane).

## Evidence To Mine

- `agents/topics/apps/flat/algorithm32/conclusions.md`: consolidated
  Algorithm32 steps, subsystem responsibilities, data flow, constants,
  references, and follow-up lane.
- `agents/topics/apps/flat/reconciliation/bruneton-start-fresh-source-audit.md`:
  audit of the closed Bruneton start-fresh lane, retained Step 032 source
  trails, inactive source material, and missing provenance tasks for
  reconciliation.
- `agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md`:
  current reconciliation design target for preserving the core Algorithm32
  transport while splitting geometry-owned source-relative spatial facts from
  light-source-owned lighting facts.
- `agents/topics/apps/flat/reconciliation/post-step032-lane-source-audit.md`:
  reverse-chronological audit of retained product-driving facts from
  atmosflat, shader-lab, and local-second-order, including supported
  deviations from Step 032, evidence-only artifacts, and local Sun provenance
  gaps.
- `agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md`:
  inventory of local Sun / flat-geometry facts, support status, external source
  candidates, missing source/model-only parameters, and reconciliation tasks.
- `agents/topics/apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md`:
  single actionable source-gap ledger for unsourced, partially sourced,
  experiment-backed, model-only, and display/review fixture facts.
- `scripts/flat/reconciliation/POC/`: mutable reconciliation POC root for the
  new architecture implementation.
- `tmp/atmosphere/reconciliation/`: numbered reconciliation evidence records.
- `scripts/flat/local-second-order/`: historical local second-order runner
  lane whose objective and subjective artifact families must be recreated.
- `tmp/atmosphere/local-second-order/`: historical numbered artifact root for
  accepted and rejected local second-order outputs.
- `shared/algorithm32/POC/`: preserved POC implementation bundle and accepted
  promotion source.
- `shared/algorithm32/production/`: current production scaffold and future
  production implementation destination.

## Reload Order

For a new or compacted agent, bootstrap normally from
[Active Topic](../../../active-topic.md). If reading this file standalone,
load only the minimal current reconciliation context first:

1. [Active Topic](../../../active-topic.md)
2. [Reconciliation Lane](../reconciliation/README.md)
3. [Reconciliation Action Plan](../reconciliation/action-plan.md)
4. [Algorithm32 Abstraction Design](../reconciliation/algorithm32-abstraction-design.md)
5. [Reconciliation Experimental Guidelines](../reconciliation/experimental-guidelines.md)

Load these only when the task needs their specific evidence:

- [Bruneton Start-Fresh Source Audit](../reconciliation/bruneton-start-fresh-source-audit.md)
- [Post-Step032 Product Facts Audit](../reconciliation/post-step032-lane-source-audit.md)
- [Local Sun Flat Geometry Fact Inventory](../reconciliation/local-sun-flat-geometry-fact-inventory.md)
- [Unsourced And Partially Sourced Facts](../reconciliation/unsourced-and-partially-sourced-facts.md)
- [Algorithm32 Conclusions](conclusions.md)

Load production docs only when the task needs the future promotion boundary or
existing scaffold shape:

- [Algorithm32 Production Documentation](README.md)
- [Algorithm32 Requirements](requirements.md)
- [Algorithm32 Production Design](production-design.md)
- [Algorithm32 Primary Facade API Draft](api-facade-draft.md)
- `shared/algorithm32/production/implementation/reference_plan.md`

Historical cleanroom, shader-lab, and local-second-order plans are evidence
sources. Do not treat them as the current handoff unless the task asks for
experiment provenance or reconciliation artifacts.

## Current Open Work

- Create the mutable reconciliation POC root and current-state note. The first
  numbered evidence record under `tmp/atmosphere/reconciliation/` begins after
  scaffold preparation, when substantive verification starts. Follow the M0
  scaffold inventory in
  [Algorithm32 Abstraction Design](../reconciliation/algorithm32-abstraction-design.md#m0-scaffold-inventory).
- Produce the reference-backed CPU Algorithm32 implementation and finalized
  parameter ledger with per-value provenance.
- Produce the GPU shader implementation and parity evidence against the CPU
  reference.
- Document the final data-shape and data-flow contract across light/source,
  geometry, atmosphere, incident radiance cache/sampler, Algorithm32 transport,
  shader resources, and external color/display conversion.
- Freeze the geometry-owned `SourceRelativePosition` contract, including
  model-space to source-position mapping, separate reverse/representative
  mapping for cache construction, light-source-owned path limits,
  geometry-clipped source paths, and cache descriptor compatibility.
- Recreate accepted objective and subjective local-second-order artifact
  families under the reconciled parameters.
- Resolve the remaining cache descriptor questions before promoting local
  second-order cache resources into production.
- Update conclusions and production docs again after reconciliation closes.
