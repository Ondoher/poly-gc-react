# Active Topic

Current active topic: `algorithm32/reconciliation`

Parent app/topic: `flat`

## Current Focus

Reconciliation experimental lane for Algorithm32 under:

```text
agents/topics/apps/flat/reconciliation/
```

This is an experimental-lane planning and evidence topic. Its immediate job is
to reconcile the accepted Algorithm32 evidence into a fully sourced CPU
reference target, a later GPU shader target, and a complete data-flow contract.
Do not promote new API surface, runtime implementation, ambient types, scaffold
tests, or production behavior into `shared/algorithm32/production/` from this
topic unless the user explicitly asks for production scaffold work or the
reconciliation lane closes an accepted interface decision.

The lane-owned locations are:

```text
agents/topics/apps/flat/reconciliation/
scripts/flat/reconciliation/POC/
tmp/atmosphere/reconciliation/NNN-*
```

This lane is different from earlier cumulative rerunnable experiment lanes:
`scripts/flat/reconciliation/POC/` is the living implementation. Milestone 0
is scaffold preparation, not a formal experiment, and is accepted when the
mutable skeleton exists. Numbered records under
`tmp/atmosphere/reconciliation/` preserve what changed, when, why, what was
checked, and which facts/references/artifacts were produced once substantive
verification begins. Mutable current-state notes are still expected in
parallel. This active-topic file, the reconciliation README/status docs, and
eventually a POC `CURRENT_STATE.md` should summarize the current architecture,
parity status, active blockers, latest accepted record, and next actions while
the numbered records preserve history.
Historical POC and experiment code may be mined, copied, or ported into the
new POC with provenance, but the reconciliation POC must not import, symlink,
re-export, or otherwise runtime-link to old code where it currently lives.

The future production implementation destination remains
`shared/algorithm32/production/`, but that folder is supporting context for
this topic, not the active work surface.

## New Agent Quick Start

- Active work is Milestone 0 scaffold preparation for the mutable POC under
  `scripts/flat/reconciliation/POC/`. Production runtime/API/code is out of
  scope unless the user explicitly asks to promote an accepted decision.
- The immediate continuation path is:
  1. read the minimal reload sources below;
  2. follow the M0 scaffold inventory in
     `algorithm32-abstraction-design.md#m0-scaffold-inventory`;
  3. create/update `scripts/flat/reconciliation/POC/CURRENT_STATE.md`;
  4. run lightweight import/smoke checks only.
- Milestone 0 is accepted when the scaffold exists. Do not create a formal
  numbered record unless the work becomes substantive verification.
- Treat accepted Step 032 as the authoritative pure Algorithm32 baseline.
  Reconciliation should produce a sourced CPU reference first, then a GPU
  shader validated against that CPU reference. The hard artifact rule is
  matching the accepted Bruneton start-fresh Experiment 32 / Step 032 sky
  dome/four-view artifacts; other artifact or evidence gaps are recorded
  unless they block the current verification claim.
- Current abstraction split is light/source, geometry, atmosphere, incident
  radiance cache/support, and color/display, with Algorithm32 transport
  coordinating the spectral calculation. Color/display remains outside CPU
  transport.
- Complex POC types must have named ambient declarations in an owning
  `types.d.ts` file, and JavaScript implementation code must use JSDoc to
  record those types at parameters, returns, properties, callbacks, and handoff
  values. Runtime class modules use one file per class with that class as the
  single default export; required complex types stay in `types.d.ts`.
- Geometry owns spatial interpretation: observer/light placement resolution,
  atmosphere coordinates and paths, source-relative positions, clipping, and
  cache-coordinate mapping. Light source supplies lighting facts from resolved
  source-relative facts. Atmosphere supplies medium, phase, and optical-depth
  facts.
- Incident radiance cache/support owns generated-field descriptors, bindings,
  compatibility validation, sampling, variants, and returned
  `IncidentRadianceSample` packets. Cache building is a setup/build
  coordination across light source, geometry, atmosphere, and
  the general calculator.
- Immediate next deliverables are the parameter/provenance ledger, exact
  data-flow contract, and mutable POC spine. First numbered evidence records
  start when substantive verification begins after the scaffold exists.
  The current milestone order is recorded in the reconciliation action plan:
  Milestone 0 preparation, then CPU distant-sun spherical-earth against
  accepted Bruneton Step 032 sky dome/four-view visuals, CPU local-sun
  flat-earth against accepted atmosflat32 Step 018 visuals, GPU distant-sun
  spherical-earth against the CPU reference through browser-run jobs, and GPU
  local-sun flat-earth informed by shader-lab plus local-second-order evidence.
  The browser watcher may be designed and implemented before Milestone 3, but
  the long-lived browser process itself is a user-run step when sandbox
  restrictions prevent the agent from launching or controlling the browser.

## Reload Sources

Load only these docs to continue the current M0 scaffold work:

- [Reconciliation Lane](apps/flat/reconciliation/README.md)
- [Reconciliation Action Plan](apps/flat/reconciliation/action-plan.md)
- [Algorithm32 Abstraction Design](apps/flat/reconciliation/algorithm32-abstraction-design.md)
- [Reconciliation Experimental Guidelines](apps/flat/reconciliation/experimental-guidelines.md)

Those four documents contain the current plan, the M0 file/class/type
inventory, the type/module rules, and the artifact policy.

Load these only when the task needs their specific evidence:

- [Algorithm32 Status](apps/flat/algorithm32/status.md)
- [Algorithm32 Conclusions](apps/flat/algorithm32/conclusions.md)
- [Bruneton Start-Fresh Source Audit](apps/flat/reconciliation/bruneton-start-fresh-source-audit.md)
- [Post-Step032 Product Facts Audit](apps/flat/reconciliation/post-step032-lane-source-audit.md)
- [Local Sun Flat Geometry Fact Inventory](apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md)
- [Unsourced And Partially Sourced Facts](apps/flat/reconciliation/unsourced-and-partially-sourced-facts.md)

Load these production docs only as supporting context when the task needs the
future promotion boundary or existing scaffold shape:

- [Algorithm32 Production Documentation](apps/flat/algorithm32/README.md)
- [Algorithm32 Requirements](apps/flat/algorithm32/requirements.md)
- [Algorithm32 Production Design](apps/flat/algorithm32/production-design.md)
- [Algorithm32 Primary Facade API Draft](apps/flat/algorithm32/api-facade-draft.md)

Use broader flat docs only when the task needs current app status or historical
experiment evidence. The sections below are supporting historical/context
notes; the quick start and minimal reload sources above are sufficient for
fresh-agent M0 scaffold continuation.

## Current Checkpoint

- Active scope: plan and run the `reconciliation` experimental lane. Work in
  the lane docs, reconciliation scripts, and reconciliation output artifacts.
  Treat production scaffold/API/code changes as out of scope unless the user
  explicitly asks for them.
- The lane must first produce a reference-backed CPU Algorithm32 design and
  experimental target, then a GPU shader target validated against that CPU
  reference.
- The GPU shader may take named implementation shortcuts relative to the CPU
  reference, but only when they are tolerance-bounded and tested against the
  baseline-faithful CPU reference. Shader shortcuts do not redefine Algorithm32.
- The initial implementation ships one atmosphere profile: the accepted
  Algorithm32 canonical profile. Alternate profiles are future named
  extensions.
- Every promoted constant needs per-value provenance: external source,
  source-backed derivation, or accepted Algorithm32 experiment/decision.
- The lane is not complete until the shape and flow of all data is known and
  documented across configuration, light/source, geometry, atmosphere,
  incident radiance cache/support, Algorithm32 transport, shader resources,
  spectral output, diagnostics, and external color/display conversion.
- Complex shape documentation is part of that contract: packets, descriptors,
  requests, samples, callbacks, handles, diagnostics, shader payloads, cache
  keys, and persisted artifact shapes live in ambient `types.d.ts` files, with
  JS implementation files referencing those names through JSDoc. Runtime class
  files should contain one class and default-export only that class.
- Light/source, geometry, atmosphere, and optional incident radiance
  cache/support feed Algorithm32 transport. Color is a published boundary
  outside the algorithm itself. The CPU reference transport should not depend
  on color, but the later GPU shader build will need the color/display
  interface for renderable output.
- Reconciliation must preserve the accepted Algorithm32 transport algorithm
  while sharpening its production abstractions. Geometry owns observer/light
  placement resolution, model-space meaning, source-relative positions,
  geometry clipping, and source-relative cache-coordinate mapping. Light
  source owns lighting facts such as spectrum, radiometry, angular extent,
  falloff, calibration, distance-use treatment for geometry-measured source
  distance, source path limits, and the source-declared incident cache family.
  Atmosphere owns medium and phase facts. Incident radiance cache/support is
  now a fifth abstraction interface that owns generated incident-field
  descriptors, bindings, variants, lookup/sampling policy, and returned
  `IncidentRadianceSample` facts. Transport consumes those packets and must not
  derive light-source distance or interpret geometry coordinates. The
  abstraction design now has a dedicated
  `Algorithm` section for the owner-query `evaluate(...)` Markdown algorithm,
  listing only calculation-consumed outputs with function-style owner-query
  notation, bold variable names, and plain Markdown calculations using
  `<sub>`/`<sup>` tags where subscript or exponent notation helps. The
  algorithm now explicitly surfaces `AtmosphereCoordinate`,
  `SourceRelativePosition`, light-source-owned `sourcePathLimit`, and
  geometry-owned `sourceAtmospherePath` handoffs to reduce cross-interface
  leakage; the coordinate-space section now names `AtmospherePath` as the
  geometry-owned path transform into atmosphere coordinates plus segment
  measures. The cache design now treats `IncidentRadianceCache` as a
  coordinated generated incident-radiance field: the light source creates the
  concrete source-shaped cache, the cache owns its logical coordinate
  generator/keying/generated values, and a generic setup/build coordinator
  passes each cache-owned coordinate back to the cache with geometry,
  atmosphere, light source, and the general calculator.
  Geometry maps both cache build coordinates and runtime path
  samples into the same source/atmosphere-relative cache-access domain, and
  setup validates the built cache against active context descriptors before
  evaluation receives operation-ready incident radiance sampling.
  The general calculator, provisionally `SpectralCalculator`,
  subsumes the old radiance-port idea and owns the reusable readable
  `computeRadiance(...)` loop used by both primary evaluation and cache
  generation. It is configured with geometry, atmosphere, light source,
  spectral basis, and execution controls; `computeRadiance(...)` receives the
  resolved `RaySegment`, the prebuilt `PathIntegrationPoint[]` value packet, and optional
  operation-specific `IncidentRadianceSampling`. Cache generation omits that
  optional value.
  `computeRadiance(...)` returns `PathRadiance`: `inScattered` plus final
  `transmittance`; `inScattered` is path-added spectral radiance,
  with "in" meaning light scattered into the evaluated ray, `transmittance` is
  the dimensionless surviving endpoint multiplier, cache builds store
  first-order `inScattered`, and endpoint composition remains explicit. Both fields use the shared `SpectralValue`
  type; the field/parameter name carries physical meaning and units.
  Higher-order field preparation can happen during setup/cache building, but
  higher-order contribution is still sampled and weighted inside each
  path-integration-point loop.
  The public operation is `incidentRadianceSampler(cacheAccess)`,
  where `cacheAccess` is a geometry-resolved packet derived from the current
  path-integration-point facts and consumed by the bound support. Configuration-time variants
  are `null`, `distant`, and `local`; the null variant skips cache lookup and
  contributes zero incident in-scattering. Separate artifacts are optional
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
  explicit and fixtureable. Path integration point construction can live on the calculator
  because it creates endpoint/trapezoid `PathIntegrationPoint[]` value objects from a
  geometry-resolved `RaySegment` and interval count, with no geometry,
  atmosphere, light, or cache queries. Each point is defined by
  `distanceAlongRayMeters` within the owning segment plus integration weights;
  `measureMeters` is the effective path length represented by that point.
  Model-space position is derived from the segment ray when needed. The coarse
  transport split is now
  `viewRaySegment = geometry.resolveViewRaySegment(...)`, then
  `pathIntegrationPoints = calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`,
  then `pathRadiance = calculator.computeRadiance(viewRaySegment, pathIntegrationPoints,
  incidentRadianceSampling)`. Its helper methods must not own the cache
  coordinate loop, setup lifecycle, or
  shader resources. The cache-build method surface is now explicit:
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
  coordinate-systems section for configuration, model, ray/path,
  observer-local sky, source-relative, cache, shader input, and display/color
  spaces plus their transforms. The source-relative position synthesis now
  covers both distant and local Sun: geometry resolves `SourceRelativePosition`
  as only direction from source plus `distanceFromSourceMeters` when geometry
  has a finite placement; optional source-relative frame facts, geometry
  boundary context, and descriptor-driven cache coordinates are adjacent
  contracts, not fields on that position. The coordinate zero/source origin
  must be explicit in placement
  descriptors: finite sources use a geometry-resolved source anchor, while
  source orientation can also be geometry-resolved into the source-relative
  frame when relevant, and directional sources declare no finite origin and use
  `distanceFromSourceMeters = null`. The light source interprets that position
  into incoming direction, distance-use treatment, angular extent, falloff,
  spectral scale, and source path limit. Distant cache indexing collapses to
  altitude/incoming direction/spectrum, while local finite indexing also needs
  source-relative radial distance.
- The initial production atmosphere coordinate is altitude-only vertical
  stratification: reconciliation should require a geometry-owned resolver,
  provisionally `GeometryModel.resolveAtmosphereCoordinate(...)`, that maps
  model-space positions to `altitudeMeters`. Atmosphere samples
  density/coefficient profiles from that resolved coordinate. Earth/geographic
  coordinates, ocean/land selectors, season, weather, and regional aerosol
  families are later profile-selector extensions, not first-pass transport
  requirements.
- The reconciliation lane must recreate the objective and subjective artifact
  families from `scripts/flat/local-second-order/`, including criteria JSON,
  diagnostics/reports, browser captures, source matrices, and review galleries.
- Optional further validation can add a real-Sun-matched local-source
  comparison on spherical geometry: configure a finite local Sun to match the
  resolved distant/real Sun at a reference view point, then compare outputs and
  diagnostics on the same geometry as limiting-case/source-geometry-separation
  evidence rather than external validation of local-Sun physics. This tests an
  explicit source/geometry handoff, not geometry-blind lighting: record frame,
  resolved positions, distances, apparent size, path clipping, falloff inputs,
  and calibration state. If the local source cannot run without flat geometry,
  classify whether the gap is missing source config, missing geometry fact,
  coordinator data flow, or improper coupling.
- The local Sun / flat-geometry inventory separates source-backed
  sub-equations from artificial false-Sun model parameters, long-sightline
  geometry policies, local L2 cache execution choices, and display fixtures.
  Promote this family only as a named Algorithm32 extension profile unless
  reconciliation replaces individual facts with fully sourced production
  parameters.
- Use the unsourced/partially sourced fact ledger as the action checklist for
  `parameters.md`: each row must be sourced, accepted, relabeled as authored
  configuration, rerun under reconciliation, or explicitly excluded before
  production promotion.
- Use `agents/topics/apps/flat/algorithm32/status.md` as the concise current
  handoff, `agents/topics/apps/flat/algorithm32/conclusions.md` for the
  detailed sourced conclusions, and
  `agents/topics/apps/flat/reconciliation/README.md` for the expanded
  reconciliation lane plan. Use
  `agents/topics/apps/flat/reconciliation/experimental-guidelines.md` as the
  operating rulebook for reconciliation artifacts and criteria.

## Scope Boundary

- This active topic is the reconciliation lane. Default actions are
  documentation, design-contract clarification, source/provenance audit,
  experiment planning, and future reconciliation script/artifact work.
- Do not edit `shared/algorithm32/production/`, production ambient types,
  scaffold specs, or runtime code while working this topic unless the user
  explicitly redirects to production implementation or asks to promote an
  accepted reconciliation decision.
- Provisional names such as
  `GeometryModel.resolveAtmosphereCoordinate(...)` are lane design candidates.
  Keep them in reconciliation/design docs until accepted for production.
- Production docs may be read to understand the future promotion boundary, but
  they are not the active work surface for this lane.

## Supporting Production Context

The notes below describe existing production-design context and historical
handoff details. They are supporting context for reconciliation, not permission
to modify production scaffold or runtime files from this active topic.

- Algorithm32 should become the production owner for the usable
  shader/runtime atmosphere pass. Sun, atmosphere composition, geometry,
  execution configuration, calibration, IncidentRadianceCache, internal shader
  texture/cache builders, display conversion, Three adapter behavior, CPU
  reference code, and validation helpers support that shader product. The core
  transport fact providers are light/source, atmosphere, geometry, and optional
  incident radiance support; color/display is adjacent output conversion.
  Numerical controls are execution configuration, not a peer domain model.
  Per-path evaluation and shader texture/cache building should be separate
  implementation responsibilities that consume the same facade-owned shared
  configuration/facts model.
  CPU/reference evaluation may remain public; texture/cache building is
  implementation-owned behind awaited shader setup and awaited shader-handle
  config updates. Runtime shader behavior belongs to facade configuration,
  likely `Algorithm32Config.shader`, not just the one-time Three setup request:
  shader mode, debug view, cache/resource policy, capability failure policy,
  and render-target/HDR/depth policy are updateable configuration. The Three
  setup request supplies app-owned attachment handles such as composer, scene,
  camera, renderer-compatible surface, and pass insertion location. The current
  assumed public shape is
  a configured Algorithm32 facade object constructed once per independent
  simulation window. It coordinates two internal implementation classes: a
  CPU/reference algorithm execution class for evaluation and texture/cache
  work, and a runtime shader builder. The facade creates a
  shared configuration/facts model from validated config and passes that model
  reference to both implementation classes.
  Instance state owns configuration, validation state, the shared model,
  shader bindings, cache descriptors, GPU resources, and disposal scope; the
  shared model must not become a global mutable singleton. The current
  POC/lane audit adds that
  normal runtime input is a live Three scene rendered to scene-color plus
  depth textures and then composed by an Algorithm32 fullscreen pass;
  JSON/Raycaster scene packets are validation-only. The facade should own or
  expose source-driven Three lighting synchronization,
  geometry/camera/depth policy, runtime capability diagnostics, stable debug
  views, and fail-loud local second-order cache binding. Latest POC
  consolidation: the shared shader class/GLSL,
  accepted local finite-Sun source resolver, IncidentRadianceCache
  `Data3DTexture` upload, and live Three scene-color/depth to Algorithm32
  display-pass wrapper are in `shared/algorithm32/POC/`. The
  `scripts/flat/local-second-order/page/` lane still owns browser harness,
  terrain/gallery composition, renderer diagnostics, render-scale/antialias
  controls, and remaining source-light review plumbing. The shared model
  provides canonical facts and descriptors; per-path evaluation owns
  `EvaluationRequest` and single-path output, while internal texture/cache
  building owns build request state, grid traversal, packing, descriptors,
  cache keys, and packed payload output. Local Sun calibration/resolution and calibration
  replay/invalidation belong to the upstream local Sun configuration layer;
  the main Algorithm32 facade receives the configured public `Sun`. From the
  API consumer point of view, the normal product path should likely be the
  runtime shader facade: build the runtime shader from packaged shader source
  and shared-model descriptors plus configured shader runtime policy, attach
  the resulting pass to the caller's composer, explicitly prepare/rebuild
  required textures outside the render frame behind awaited setup/config
  updates, update config/display state, render through the composer, and
  dispose. Per-path evaluation remains
  the CPU/reference/offline consumer method. Texture artifact building and
  validation are implementation-owned unless a later non-app tooling consumer
  justifies a narrow API. Packet construction/preflight, display conversion,
  and validation/parity helpers are support tiers with narrower consumers.
  The Three adapter call surface is
  distinct from Algorithm32 configuration: it wraps render-target, depth
  texture, ShaderMaterial, fullscreen quad, renderer target/render/clear,
  uniform update, texture upload, resize, and dispose calls. The candidate
  consumer-facing Three adapter method is
  `await algorithm32.setupShader({ THREE, composer, scene, camera })`;
  it receives the caller's existing Three composer pipeline, prepares and
  installs the runtime integration, returns a handle that owns the
  `ShaderMaterial`/fullscreen-pass lifecycle, and receives Algorithm32 inputs
  as uniforms/textures. The composer is required; Algorithm32 installs into
  the existing composer so the app keeps calling `composer.render()`. Its
  purpose is to reduce caller decisions and operations around
  Three-specific material, target/depth, upload, pass order, resize, and
  disposal details, and to reduce caller dependence on Algorithm32-specific
  shader/cache/spectral binding knowledge. Long work remains explicit because
  setup/config updates are awaited outside the frame render. Requested local
  second-order shader mode must validate its incident-cache texture/descriptor
  before rendering and must not silently fall back to first-order if the
  resource is missing or mismatched.
  The core
  abstractions should be public Algorithm32 API interfaces, not private factory
  packet conventions. The requirements are organized by implementable
  ownership domains, so API design should preserve those self-contained code
  seams.
- The current public facade draft is documented in
  `apps/flat/algorithm32/api-facade-draft.md`. It keeps the configured facade
  to `constructor`, `config` getter, `setConfig`, awaited `setupShader`,
  `evaluate`, `getDiagnostics`, and `dispose`.
  `setupShader` returns the handle that owns runtime Three resources, normal
  resource preparation, composer integration, diagnostics, and disposal.
  Algorithm32 should be installed into the app's existing composer or
  composer-compatible framework render hook; it should not require a second
  animation loop, raw-renderer-only production path, or separate normal-path
  resource-preparation checklist.
- Local Sun setup should default to calibration, not a brightness knob.
  User view latitude, longitude, local time, and altitude are authored
  configuration and may supply app context and comparison inputs, but the flat
  model has no independent real-time standard. Select a named calibration
  reference event, align local closest approach to that event, derive the
  clock offset and source power, and allow recalibration at any time.
- Local Sun configuration/calibration must influence the main Algorithm32
  algorithm only by resolving to the public Sun interface. Public interfaces
  are encapsulation boundaries; for Sun, atmosphere composition, and geometry,
  nothing outside the corresponding public interface and public input/resolver
  types may leak into transport, shader texture builders, caches, runtime
  shader APIs, display, validation, cache keys, descriptors, uniforms,
  fixtures, or generated artifacts.
- Basic user-authored local Sun settings should stay limited to altitude,
  diameter, northern latitude limit, and southern latitude limit. The default
  altitude, size, and latitude migration are source-recovery tasks for the
  steel-man profile; source brightness and real-time synchronization are
  calibration outputs, not user-entered physical constants.
- User view placement is configured separately from local Sun parameters:
  latitude, longitude, local time, and view altitude are Algorithm32
  configuration. The app may derive or default altitude upstream, but
  Algorithm32 should receive the configured value. Do not promote historical
  San Jose fixture elevation or `[0, 0, 2]` observer height as production
  defaults.
- Orbit direction and period are standardized model behavior, not user-entered
  fields. Resolved orbital speed may be shown as an instantaneous derived
  display value for the current simulation time and location.
- Brightness/source power is derived calibration state. Any later visual
  adjustment should be exposure or tone mapping, not source brightness.
- Production Algorithm32 must not promote any physics decision, algorithm,
  numeric value, default, spectral shape, or algorithm-test expectation unless
  it is backed by an external reference, source-backed fixture, or explicitly
  accepted reference log entry. POC behavior is implementation evidence only;
  unsourced POC tuning values are rejected as production physics facts.
  Production code now uses AMA-style numbered references in
  `shared/algorithm32/production/references.md`, with bracket citation tokens
  in code comments, JSDoc comments, and JSON fixture text fields preceded by a
  short description of the cited data, formula, algorithm decision, or
  variation. Use ASCII tokens such as `[1]`, `[2]`, `[1][2]`, and `[10][11]`,
  not Unicode superscripts, Markdown footnotes, or HTML citation markup.
  Citations are required for
  the algorithm as a whole, meaningful variations, test fixtures, and
  non-fixture algorithm tests, but not for API compliance, validation plumbing,
  guardrails, architectural choices, module boundaries, placement/JSDoc
  conventions, or incidental platform/data-structure limitations. If a test
  intentionally enforces operational extents caused by a language or platform
  limit, such as JavaScript number precision or floating-point resolution, cite
  the relevant language/runtime specification. When a citation needs a precise
  locator beyond the numbered AMA
  entry, use the shared `Algorithm32ProductionReferencePointer` shape to name
  the reference number plus section, equation, figure, table, row, page, local
  artifact path, or other locator.
- Initial production scaffold now exists under
  `shared/algorithm32/production/`: `Algorithm32.js` as the documented primary
  facade skeleton, a focused Jasmine lane,
  `types.d.ts` ambient type home, `types/LightSourceModel.d.ts`,
  `types/AtmosphereModel.d.ts`, `types/GeometryModel.d.ts`,
  `types/Color.d.ts`, `types/types.d.ts`, `implementation/Reference.js`,
  `implementation/ShaderBuilder.js`, `implementation/types.d.ts`,
  `models/SharedModel.js`, `models/SpectralModel.js`, `models/types.d.ts`,
  `references.md`, scaffold guardrail specs, utility specs,
  model specs, and the first production analytic fixture ledger
  `fixtures/analytic-invariants.json`.
  `implementation/` is the home for implementation classes and starts with the
  CPU/reference algorithm execution collaborator `Reference` plus the runtime
  shader artifact builder `ShaderBuilder`; implementation-only complex packet
  shapes live in its local `types.d.ts`. The private helper implementation
  sequence for `Reference` is tracked in
  `shared/algorithm32/production/implementation/reference_plan.md`, proceeding
  from least-dependent helper leaves toward `evaluate(...)`; top-level
  `evaluate(...)` unit tests should wait until its composed dependencies have
  real behavior. `Reference._createTransportState(...)` is now implemented as
  bookkeeping only, initializing spectral radiance to zero and spectral
  transmittance to one for the active channel count, with a focused helper
  spec. `Reference._createEvaluationResult(...)` is implemented as
  bookkeeping only, snapshotting final transport-state radiance into the legacy
  `pathRadiance` field and final transmittance as the public spectral
  evaluation result. The reconciliation design now names that radiance
  component `PathRadiance.inScattered`.
  Production physical and algorithm expectations must be fixture-backed JSON
  ledgers with stable row ids, production citations, assumptions, inputs,
  expected data, tolerances, and independence notes. Fixture citations use the
  same AMA-style numbered entries in
  `shared/algorithm32/production/references.md` and bracket citation tokens
  used by production code comments. Fixture rows may carry
  compact shared reference pointer objects for source locators such as
  sections, equations, figures, tables, rows, pages, or local artifact paths.
  Fixture validation now requires bracket citation numbers to match each row's
  compact reference pointer numbers and rejects superscript citations.
  The first production ledger promotes externally backed analytic invariant
  rows from the rejected reference fixture file and intentionally omits rows
  whose only citations were local app/stage specs.
  Prefer actual source data, authoritative tables, published examples, or
  external-tool artifacts over reference calculations when possible. Physics
  and algorithm tests should cover sourced extents that cap or bound the
  calculation domain, not only central happy paths. Those extents may be
  physics-based, such as optical wavelength ranges, valid coefficient domains,
  vacuum/no-medium limits, zero-length or zero-weight paths, or monotonic
  transport limits. They may also be operational, such as JavaScript number
  precision, representable finite values, or floating-point resolution.
  Physics extents must be backed by references, empirical sources, published
  algorithm papers, source-backed fixture rows, or accepted reference-log
  entries; operational extents may cite the relevant language/runtime
  specification. Practical caps are acceptable when the cap and its reason come
  from the cited source, such as a Bruneton-style paper or empirical dataset,
  instead of from an invented local rationale. Do not choose extent values as
  arbitrary convenient numbers. Add a
  fixture validation spec before consuming a fixture family.
  Inline spec literals are reserved for bookkeeping, API shape, validation
  plumbing, and other non-physics behavior.
  `Reference.evaluate(...)` now carries
  the cited top-level volume-transport orchestration using standard
  transmittance and in-scattering language, with private helper stubs for the
  unimplemented physics steps and PBRT reference citations in
  `shared/algorithm32/production/references.md`. `models/` is the home for shared
  configuration/facts model classes and now starts with `SharedModel` as the
  aggregate model plus implemented `SpectralModel` as the spectral component
  model. `SharedModel` accepts caller-provided light source, atmosphere, and
  geometry implementations plus the accepted spectral basis, then constructs the
  facade-owned `SpectralModel`; `SpectralModel` owns copied spectral basis data, channel count,
  fingerprint, version, basis replacement, descriptor snapshots, wavelength
  lookup, and vector/basis alignment queries. Model-only complex packet shapes
  live in `models/types.d.ts`. `types/Color.d.ts` defines the
  caller-provided spectral-to-display color conversion interface; it is
  adjacent to Algorithm32 core output and not part of the facade-owned shared
  model. Primary single-interface ambient type files use PascalCase
  names matching the interface name, omit the redundant `Algorithm32` package
  prefix, and keep supporting request/sample/descriptor shapes in
  `types/types.d.ts`. Consumer-provided model interfaces receive plain data
  contracts such as `SpectralBasis`, not internal Algorithm32 model objects.
  `SpectralBasis` owns only the ordered unit-bearing `wavelengths` list; `channelCount`
  is derived by `SpectralModel` and descriptor snapshots so the wavelength list
  remains the single source of truth for spectral channel shape.
  Function and method JSDoc documents parameters and returns; parameter tags
  use a hyphen after the name, and complex return details belong in the
  description instead of the `@returns` text. Private class methods and
  properties use a leading underscore. Public readable properties expose
  getters. Setters are used only for direct assignment with no processing;
  processed changes use explicit methods instead. The scaffold guardrails now
  also reject the inherited flat-app local source tint identifiers and the
  unsourced `{ r: 1, g: 0.98, b: 0.95 }` tint value from production
  source/type/reference files, so the shader-lab tint contamination cannot
  quietly enter production Algorithm32. Generic production code now uses
  light-source terminology; solar-specific language is reserved for concrete
  light-source implementations and is guarded out of the core facade, shared
  model, algorithm/reference execution, shader builder, generic types, and
  generic utilities.
  `Reference._computeSegmentTransmittance(...)` now computes per-channel
  Beer-Lambert attenuation from sampled extinction and path weight, and
  `Reference._integratePathSample(...)` now returns an immutable next transport
  state by adding direct plus incident in-scattering and attenuating
  transmittance. Fixture-backed specs cover vacuum transmittance,
  multi-wavelength Beer-Lambert transmittance, and split-path transmittance
  multiplication. Fixture-backed specs now cover
  `Reference._computeDirectInScattering(...)` and
  `Reference._computeIncidentInScattering(...)`; the incident row records that
  `IncidentRadianceSample` is already sampled/collapsed before the reference
  helper consumes it. Reconciliation now assigns that sampling boundary to
  incident radiance cache/support rather than to light source alone.
  Current verification command is
  `npm run test:algorithm32:production`; latest focused run covers 38 specs
  with 0 failures.
  Class-specific specs now live in local `_tests` folders beside the class and
  use `ClassName.spec.js` filenames; Jasmine discovers production specs with
  `**/_tests/**/*.spec.?(m)js`.
- Latest local-second-order POC mining should be treated as the freshest
  operational evidence. It leaves the following current handoff facts:
  endpoint/trapezoid transport is the accepted shader-lineage evidence, while
  midpoint fixtures are cleanroom/stage evidence only; the POC emitted
  source-path descriptors from light-source samples, but reconciliation should
  promote the cleaner boundary where geometry resolves source-relative
  coordinates, boundary context, clipping, and altitude while light-source
  implementations consume those coordinates to supply lighting facts,
  including distance-use treatment and source path limits. Geometry then
  resolves the clipped source path for transmittance. Atmosphere owns
  coefficients, and transport execution applies the integration rule;
  `IncidentRadianceCache` is a coordinated generated incident-radiance field:
  the light source creates the concrete source-shaped cache; the cache owns its
  logical coordinate generator, generated values, descriptor, binding contract,
  and runtime sampling operation; and the generic setup/build coordinator
  passes each cache-owned coordinate back to the cache with geometry,
  atmosphere, light source, and the general calculator.
  Setup must bind the built cache/support object to the active
  light/geometry/atmosphere/spectral/execution context before evaluation
  receives operation-ready incident radiance support. Optional generated
  artifacts are persistence, diagnostic, or shader-packing outputs rather than
  required runtime objects. Shader setup consumes the same logical cache
  through cache-exposed shader payload descriptors; `ShaderBuilder` owns the
  actual GPU texture/resource creation and binding. The cache is not a loose
  runtime choice and is not owned by the generic `Reference` executor or shared
  model. The mined constant
  inventory and known unresolved constant issues are recorded in
  `apps/flat/algorithm32/production-design.md`.
- `apps/flat/algorithm32/production-design.md` now separates the
  validation/error handling class from the shared configuration/facts model. The
  validation/error class owns config acceptance, canonical snapshots,
  fingerprints, compatibility checks, structured Algorithm32 errors,
  descriptor/cache validation, runtime capability pass/fail policy,
  validation-scene packets, and deterministic diagnostic summaries. The
  current core responsibility split is: algorithm configuration facts,
  validation/error handling, and algorithm execution for one specific input.
  The shared model is about canonical configuration facts and descriptors
  beneath the algorithm. The shared model is a canonical configuration
  aggregate whose component model properties are limited to light source,
  atmosphere medium, geometry, and spectral. Light source, atmosphere, and
  geometry are canonical views over consumer-provided `LightSourceModel`,
  `AtmosphereComposition`, and `Geometry`; spectral is the canonical spectral
  basis/shape derived from configuration. The one-evaluation sequence diagram
  talks directly to the consumer-provided light source, atmosphere, and
  geometry component models instead
  of showing the aggregate as a separate runtime actor.
  Interface boundary rule: consumer-provided model interfaces must not receive
  peer model implementations as request data. Hot-path calls pass only direct
  data needed to answer the request, such as positions, directions, spectral
  basis, or previously sampled plain result packets. Build/setup compatibility
  may use immutable descriptors, fingerprints, versions, and narrow plain data
  packets from peer models, but not peer model objects. One model does not call
  another model directly; Reference, ShaderBuilder, facade, or a dedicated
  coordinator asks one model for facts and passes plain results onward. Broad
  `context` request objects are a design smell and should be split into
  explicit owned facts, descriptors, or coordinator-managed setup state.
  The spectral component model is likely `model.spectral`; it owns the active
  unit-bearing `wavelengths` channel set, spectral basis shape, alignment checks,
  descriptor snapshots, basis replacement, wavelength lookup, versioning, and
  fingerprinting. It does not produce RGB/XYZ/display colors, shader/cache
  packing descriptors, or per-evaluation radiance/transmittance work vectors.
  Algorithm execution receives `EvaluationRequest` as a one-call request
  packet, not a durable model. The transport path is a resolved per-run
  path/integration artifact, not a model, because it has no durable identity
  or lifecycle beyond the execution that produced it.
  The POC hit-vs-sky distance distinction is now documented as geometry-owned:
  `EvaluationRequest` carries ray facts plus optional
  `suppliedDistanceMeters`, and `GeometryModel.resolveRayDistance(...)`
  absorbs the branch between the POC
  `traceSegmentForThreeHit(...)`/`hitDistanceMeters` path and the
  `traceSkyForThreeRay(...)`/`distanceToSkyBoundary(...)` path. Algorithm
  execution integrates the resolved distance rather than branching on renderer
  path semantics. If `suppliedDistanceMeters` is omitted, geometry decides how
  to handle the unbounded case from its configured boundaries.
  `ResolvedRayDistance` is intentionally kept to execution data only: the
  resolved finite `distanceMeters`. Clipping reasons, entry/exit facts,
  ground-hit or sky-exit status, surface-hit details, raw intersections, and
  boundary metadata are diagnostics and should be addressed in a separate
  holistic diagnostics design rather than being carried by the hot-path result.
  `production-design.md` now includes a compact `Reference.evaluate`
  pseudocode definition immediately before the one-evaluation Mermaid sequence:
  get model facts, resolve ray distance, prepare spectral results, query
  setup-bound incident-radiance support, walk samples, gather model facts,
  accumulate direct and incident/higher-order scattering, and assemble
  spectral output.
  The same section now records POC-derived unit/coefficient facts: spatial
  transport is in meters, local Sun size/reference-distance fields use
  explicitly named kilometers, spectral channel identity uses nanometers,
  coefficient formulas convert wavelengths to micrometers, atmosphere sampling
  returns scalar density facts, and finite local source scaling uses
  `referenceSpectralIncidentScale`, `distanceFalloffScale`, `incidentScale`,
  and `spectralIncidentScaleByWavelength`. The POC RGB-style local
  `sourceColor` default and rough channel grouping are not source-backed and
  must not be promoted as production source physics. The runner trail shows
  the tint already existed as flat-app configuration
  `DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color = { r: 1, g: 0.98, b: 0.95 }`
  before the Algorithm32 local-source/shader-lab work; the retired
  reality-aligned daytime-atmosphere plan records the flat-app intent as a
  daylight-white atmosphere Sun distinct from the orange visible false Sun and
  records `58` as the selected linked-radiance sweep value, but it does not
  externally source the exact tint values. The later Algorithm32 local-source
  path pulled that app-facing color into `atmosflat32`, adapted it into the
  local source, and mapped it to spectral channels with rough wavelength
  thresholds. The `algorithm32_shader_lab` branch carried that behavior
  forward through accepted `atmosflat32/018` parity and shader-packet
  propagation, but the later local-sun-second-order lane reverted it in
  accepted artifact `095-local-source-neutral-white-stack` by using neutral
  white source scale. Treat the old tint/grouping as stale POC residue and
  guard it out of production. Any spectral variation in source scale requires
  a backed spectral model.
  A new local-lane diagnostic runner,
  `scripts/flat/local-second-order/local-source-neutral-spectrum-comparison.js`,
  now reproduces the accepted Southern France local-source integrated-shader
  vertical stack and rerenders it with
  `payload.sourceColorOverride = { r: 1, g: 1, b: 1 }` to measure the actual
  output effect of removing the inherited app RGB source tint. This is the
  current local-lane reversal evidence, not a new physical spectrum contract.
  It requires the user-owned watcher
  `node scripts/flat/local-second-order/harness.js --watch` and writes a
  numbered comparison artifact with both browser-run links, side-by-side
  output, diff image, criteria, report, and run log.
  The same design section now records required object-shape identifiers whose
  final names are local API language rather than obvious standardized domain
  terms: ray distance request labels, geometry distance result fields, source sample
  scale fields, atmosphere medium scalar field names, phase sample fields,
  IncidentRadianceCache indexing/packing fields, spectral array shape fields,
  and descriptor/provenance/diagnostic identifiers.
  Incoming radiance is requested through setup-bound incident radiance support;
  setup must first bind any generated `IncidentRadianceCache` to the active
  context descriptors. The cache is named for spectral radiance arriving at a
  sample point from incoming directions, and callers do not select or override
  arbitrary cache artifacts during evaluation. IncidentRadianceCache may carry
  L2/local incident radiance data, fixture tables, calculator evaluation
  strategies, sampled direction state, weights, spectral alignment,
  provenance, or sample caches.
  Runtime shader
  builder collaborators such as the shader source composer,
  IncidentRadianceCache assembler, texture/cache packing assembler, shader binder, runtime
  attachment model, and runtime capability model also live outside the shared
  aggregate. IncidentRadianceCache and texture/cache packing
  responsibilities are assemblers, not peer models: they consume shared facts
  and cache/resource inputs to produce shader-facing artifacts. Shader binding
  is handled by an active shader binder, not by a peer model; the binder
  updates/provides runtime information available to the running shader by
  assigning current uniforms, samplers, textures, render targets,
  display-conversion resources, debug state, and frame/config values to the
  shader's binding slots. Its output is live applied runtime state plus
  binding diagnostics or update status, while its internal binding map records
  names, slots, resource ids, descriptor versions, update categories, and
  compatibility labels. Runtime attachment is a model when it owns the related
  Three/composer facts: composer, scene, camera, renderer context, pass
  insertion, resize state, render targets, and disposal scope, plus mutation
  methods for scene/camera replacement, resize, target refresh, and disposal.
  Runtime capability is also a model: it owns probed renderer/device
  capability facts and the selected legal feature path.
  Display conversion is supplied as a caller-provided shader descriptor
  through shader setup or the shader handle by an adjacent display-conversion
  consumer; it is not part of `Algorithm32Config` or the shared model.
  Algorithm execution consumes those abstractions through explicit
  samples/descriptors and owns only computed spectral results plus transient
  calculation state for the run.
  Facade reconfiguration updates the shared model by replacement or versioned
  canonical snapshots so the CPU/reference algorithm execution class and
  runtime shader builder pick up compatible changes at operation
  boundaries and can fail/restart/rebuild on incompatible model versions.
  Workflow/facade code, texture/cache build workflows, runtime shader builder,
  Three/runtime adapter behavior, display conversion, validation/error
  handling, and generally useful pure math
  are outside the shared model; pure math remains separated into generic
  utility objects under `shared/algorithm32/production/utils/`: `ScalarMath`,
  `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`, `ArrayMath`, and `SampleMath`, with
  `MathUtils.js` re-exporting those objects by name for grouped imports. Unit
  utilities use `in<Unit>` constructors and `to<Unit>` conversions for
  unit-bearing packets; they may also expose packet-in/packet-out operators
  such as `add`, `subtract`, and `scale` for one-line work, while expensive
  loops should canonicalize once to plain scalars.
  Concrete GPU packing layouts, packed payload construction, `Data3DTexture`
  creation, and any 2D-atlas fallback belong to the runtime shader builder,
  not the CPU reference implementation and not the shared model. It explicitly
  does not own validation/error policy, raw
  Three resources, facade lifecycle, local Sun calibration, app state, display
  conversion, generic pure math helpers, or future specific public Sun
  implementation classes. Display conversion is now an adjacent consumer class
  outside the Algorithm32 facade border: Algorithm32 core output is spectral
  or spectral-group radiance and transmittance, while a separate
  `Algorithm32DisplayConversion`-style class consumes that output for RGB,
  exposure, tone mapping, debug-color mapping, and optional display-only
  celestial/star extensions.

## Evidence Boundary

Cleanroom, shader-lab, local-second-order, and numbered artifact docs are
background evidence, not the active topic entry path. Load them only when the
user asks about experiment history, accepted artifact details, parity evidence,
cache behavior, or POC implementation source.

The local Sun second-order experimental lane is closed as accepted POC
evidence. Its implementation bundle is preserved under:

```text
shared/algorithm32/POC/
```

Do not document live runner state. Inspect heartbeat/process state at execution
time only when a task explicitly requires it.

When a cleanroom, shader-lab, or local-second-order decision becomes production
policy, promote the durable contract into the Algorithm32 production docs
instead of making future agents mine experiment logs.

Current-state documentation is the default. Do not carry historical narrative
forward in Algorithm32 production docs except when writing an experiment
evidence source, an intentional status/task tracker, or a clearly marked
archive.
