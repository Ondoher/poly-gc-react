# Reconciliation Lane

Status: planned experimental lane. No reconciliation artifacts have been
accepted yet.

This lane expands the
[Algorithm32 conclusions follow-up](../algorithm32/conclusions.md#follow-up-reconciliation-lane)
into the working plan for the next atmosphere implementation pass. It is the
bridge between the accepted Algorithm32 experiments and production promotion
under `shared/algorithm32/production/`.

The accepted Step 032 result is the authoritative pure Algorithm32 baseline
for this lane. The Bruneton start-fresh source audit found no active retained
Step 032 pure-algorithm ingredient with neither an external reference nor
accepted experimental support. Reconciliation therefore starts from that
baseline, tightens the parameter ledger, and reruns evidence under finalized
parameters rather than rediscovering the algorithm from scratch.
This baseline also becomes the comparison anchor for future atmosphere
experimental lanes: intentional deviations must be named, justified by source
or accepted experiment, and measured against the baseline; unjustified drift
must remain rejected or unresolved rather than becoming a new default.

## Goal

Reconciliation has three concrete end results:

1. Build a new CPU reference implementation of Algorithm32 with
   reference-backed algorithms, reference-backed or explicitly accepted
   constants, and strict separation between the light/source, geometry,
   atmosphere, incident radiance cache/sampler, and color boundaries.
2. Build a GPU shader implementation that implements the CPU reference within
   documented tolerances. The shader may take named implementation shortcuts,
   but those shortcuts must be bounded and tested against the CPU reference.
3. Finish with the exact shape and flow of all data known and documented,
   including configuration, model facts, spectral basis, ray/path requests,
   source samples, geometry intersections, medium samples, transport state,
   incident-radiance cache descriptors, sampler bindings, shader
   textures/uniforms, spectral outputs, diagnostics, and color/display
   requests.

The CPU reference uses light/source, geometry, atmosphere, and optional
incident radiance sampler callbacks to execute spectral transport. The color/display
boundary is defined during the CPU reference phase but is not required to
execute CPU transport. The later GPU shader phase needs the color/display
interface to convert spectral transport output into renderable output.

## Lane Roots

- Documentation: `agents/topics/apps/flat/reconciliation/`
- Mutable POC implementation: `scripts/flat/reconciliation/POC/`
- Numbered evidence records: `tmp/atmosphere/reconciliation/NNN-*`
- Production destination: `shared/algorithm32/production/`
- Source synthesis: `agents/topics/apps/flat/algorithm32/conclusions.md`
- Historical local second-order lane:
  `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/`

Do not write new reconciliation artifacts under the historical
`tmp/atmosphere/local-second-order/` root. Recreate accepted evidence into the
new reconciliation artifact root when it becomes part of this lane.

This lane differs from the previous cumulative experiment lanes. The POC code
is a living implementation that will be updated in place under
`scripts/flat/reconciliation/POC/`. Milestone 0 is scaffold preparation, not a
formal experiment. It is accepted when the mutable skeleton exists, even if
that skeleton is imperfect and later iterated. The durable history for later
substantive verification comes from numbered record folders under
`tmp/atmosphere/reconciliation/`, one folder per significant run, parity
target, rejected attempt, or design-verification step. Those folders record
what changed, when, why, what was checked, and which facts, references, or
artifacts were produced; they do not need to be self-contained rerunnable
experiments.

Mutable current-state notes are also part of the lane. Use the topic README,
Algorithm32 status, active-topic handoff, and eventually a POC
`CURRENT_STATE.md` to summarize the current architecture, current parity
status, active blockers, latest accepted record, and next actions. These notes
may be rewritten as the living POC changes; numbered records remain the
append-only history.

Historical POC and experiment code may be mined, copied, or ported into the
new POC with provenance, but `scripts/flat/reconciliation/POC/` must own its
runtime code. Do not import, symlink, re-export, or otherwise link to preserved
POC bundles or earlier experiment scripts in place.

Artifact and evidence gaps should be recorded unless they are egregious. The
hard artifact rule for this lane is matching the sky dome/four-view artifacts
created by Bruneton start-fresh Experiment 32 / Step 032 at
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
Other missing diagnostics, criteria files, or historical convenience artifacts
are findings unless they make the current milestone's verification claim
impossible.

All complex POC types must have named ambient declarations in an owning
`types.d.ts` file, and JavaScript code must use JSDoc to record where those
types are consumed or produced. This applies to packets, descriptors,
requests, samples, callbacks, handles, diagnostics, shader payloads, cache
keys, and persisted artifact shapes. It keeps the mutable POC productizable
without later inferring type shapes from implementation object literals.
Runtime class modules use one file per class, with that class as the file's
single default export. Required complex types stay in `types.d.ts`, not inline
in class files.

Use [Experimental Guidelines](experimental-guidelines.md) as the operating
rulebook for reconciliation artifacts, criteria, provenance, tolerance policy,
browser runs, display outputs, and closeout updates.
Use [Action Plan](action-plan.md) as the living milestone order for the
mutable POC lane. It may be updated during execution as numbered records and
current-state notes reveal better sequencing.
Use [Algorithm32 Abstraction Design](algorithm32-abstraction-design.md) as the
current design target for separating geometry-owned spatial/source-relative
facts from light-source-owned lighting facts while preserving the accepted
Algorithm32 transport algorithm. It now treats incident radiance cache/sampler
as a fifth abstraction boundary for generated incoming-radiance fields, with
`null`, `distant`, and `local` cache variants selected at configuration/setup
time and runtime sampling reduced to an `IncidentRadianceSampler` callback.
It also has the coordinate-systems reference
for configuration space, geometry model space, ray/path parameter space,
observer-local sky space, source-relative space, cache space, shader inputs,
and display/color output, plus the synthesized source-relative position and
cache-indexing requirements that encompass both distant and local Sun
implementations. It also contains the owner-query `evaluate(...)` Markdown
algorithm, listing only calculation-consumed outputs with function-style
owner-query notation, bold variable names, and plain Markdown calculations
using `<sub>`/`<sup>` tags where subscript or exponent notation helps. The
source-backed portion of that loop is the optical-depth/transmittance and
volume in-scattering equation family; local cache dimensions, sample counts,
finite-source bounds, and direction-set choices remain configuration/evidence
decisions rather than external physics constants. The canonical path rule is
fixed endpoint/trapezoid. The
algorithm now explicitly surfaces `AtmosphereCoordinate`,
`SourceRelativePosition`, light-source-owned `sourcePathLimit`, and
geometry-owned `sourceAtmospherePath` handoffs to reduce cross-interface
leakage; the coordinate-space section now names `AtmospherePath` as the
geometry-owned path transform into atmosphere coordinates plus segment
measures. The cache design now treats `IncidentRadianceCache` as a coordinated
generated incident-radiance field: the light source creates the source-shaped
concrete cache, such as a local-Sun or distant-source cache. The
concrete cache owns its configured coordinate generator and keying; the
setup/build coordinator is generic and passes each cache-owned coordinate back
to the cache with geometry, atmosphere, light source, and the general
calculator.
Geometry maps cache build coordinates
and runtime path integration points into the same source/atmosphere-relative cache-access
domain, atmosphere/transport produce the radiance values, and setup validates
the built cache against active context descriptors before evaluation receives
an optional `IncidentRadianceSampling` value. When present, that value contains
the operation-ready `IncidentRadianceSampler` callback plus cache-access
metadata; when omitted, no cache lookup occurs and incident in-scattering sees
an empty sample set. The public operation is
`incidentRadianceSampler(cacheAccess)`, where `cacheAccess` is resolved by
geometry from current path-integration-point facts such as point position and
`AtmosphereCoordinate`. Shader setup uses the same logical cache through
cache-exposed shader payload descriptors, with `ShaderBuilder` owning texture
creation and binding. The design explains how coordinate spaces transform
across configuration acceptance, cache building, shader packing, and the
sample loop.
Use [Post-Step032 Product Facts Audit](post-step032-lane-source-audit.md)
to audit retained product-driving facts from atmosflat, shader-lab, and local
second-order without promoting generated artifacts as facts or reviving
superseded branches.
Use
[Local Sun Flat Geometry Fact Inventory](local-sun-flat-geometry-fact-inventory.md)
when reconciling local-source, false-Sun, flat-geometry, long-sightline, and
local L2 cache facts. It separates source-backed sub-equations from artificial
model parameters and display fixtures.
Use
[Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
as the actionable checklist for source gaps, partial provenance, model-only
configuration, experiment-backed controls, and display fixtures that must not
enter production silently.

## New Agent Handoff

Start here if picking up the lane from a compacted or fresh session:

- The immediate continuation task is Milestone 0 scaffold preparation. Read
  [Action Plan](action-plan.md), then use the
  [M0 Scaffold Inventory](algorithm32-abstraction-design.md#m0-scaffold-inventory)
  as the canonical file/class/type list.
- Create the mutable POC skeleton under `scripts/flat/reconciliation/POC/` and
  add/update `CURRENT_STATE.md`. Do not create a formal numbered record unless
  the work becomes substantive verification.
- Use [Experimental Guidelines](experimental-guidelines.md) for artifact,
  ambient type, JSDoc, and one-class-default-export rules.
- Load source audits, product-fact ledgers, and production docs only when the
  task needs their specific evidence; they are not needed just to build the M0
  skeleton.
- Scope is reconciliation planning and evidence. Do not edit production
  runtime/API/code unless the user explicitly asks to promote an accepted
  reconciliation decision.
- Step 032 from the Bruneton start-fresh lane is the authoritative pure
  Algorithm32 baseline. Reconciliation should prove that the new CPU reference
  preserves this baseline under finalized, sourced parameters before using the
  CPU reference as the shader oracle. The hard artifact gate is matching the
  accepted Step 032 sky dome/four-view artifact set; other artifact gaps are
  recorded unless they block the current verification claim.
- The active abstraction split is five interfaces plus transport:
  light/source, geometry, atmosphere, incident radiance cache/sampler, and
  color/display. Transport coordinates the spectral calculation. Color/display
  consumes spectral output outside CPU transport.
- Complex POC types belong in ambient `types.d.ts` files at their owning
  shared or module-local boundary. Implementation code should reference those
  types with JSDoc rather than relying on inferred object shapes.
- Runtime class files should define one class and default-export only that
  class. Required types live in `types.d.ts`; interface contracts should not
  be represented by empty abstract base classes.
- Geometry owns spatial interpretation, including observer/light placement
  resolution, `AtmosphereCoordinate`, `AtmospherePath`,
  `SourceRelativePosition`, clipping, and source-relative/cache coordinate
  mapping. Light source consumes resolved source-relative facts and supplies
  lighting facts. Atmosphere consumes atmosphere coordinates/paths and
  supplies medium, phase, and optical-depth facts.
- Incident radiance cache/sampler owns the generated-field descriptor,
  generated values, binding contract, compatibility validation, runtime
  `IncidentRadianceSampler` callback, and returned `IncidentRadianceSamples`
  packet. Building that field is coordinated by setup/build code across light
  source, geometry, atmosphere, and the general calculator.
- Runtime `evaluate(...)` must not know cache shape, source kind, raw
  source-local/cache coordinates, or display conversion. It asks geometry to
  resolve the bound cache's `cacheAccess` packet from current path-integration-point facts only
  when optional `IncidentRadianceSampling` is present, then invokes that
  value's `incidentRadianceSampler` callback for incident samples.
- The general calculator, provisionally `SpectralCalculator`,
  subsumes the old radiance-port idea. It is the reusable readable home of
  `computeRadiance(...)` for both primary evaluation and cache generation.
  It is configured with geometry, atmosphere, light source, spectral basis, and
  execution controls; `computeRadiance(...)` receives the resolved `RaySegment`, the
  prebuilt `PathIntegrationPoint[]` value packet, and optional operation-specific
  `IncidentRadianceSampling`. Cache generation omits that optional value rather
  than using a no-op placeholder or a separate first-order calculator.
  `computeRadiance(...)` returns `PathRadiance`: `inScattered` plus final
  `transmittance`. `inScattered` is path-added spectral radiance;
  the "in" means light scattered into the evaluated ray. `transmittance` is the
  dimensionless surviving endpoint multiplier. Cache builds store the
  first-order `inScattered` value; endpoint composition remains explicit. Both fields use the shared
  `SpectralValue` type; the field/parameter name carries physical meaning and
  units. Higher-order field preparation can happen during setup/cache building,
  but higher-order contribution is still sampled and weighted inside each
  path-integration-point loop.
  Shader building consumes the same logical cache via cache-exposed shader
  payload descriptors, while `ShaderBuilder` owns GPU texture creation,
  upload, binding, and fallback policy.
- Shared CPU/shader logic is setup/build logic: canonical descriptors,
  fingerprints, spectral/channel utilities, numerical-control descriptors,
  the cache-build coordinator, concrete incident-cache families, cache-access
  contracts, cache shader-payload formation, provenance, diagnostics, and
  fail-loud validation. CPU transport remains JavaScript, while shader runtime
  transport is assembled into GLSL and validated by descriptor-backed parity
  tests.
- The shared `SpectralCalculator` general calculator owns the
  reusable readable radiance loop for both primary evaluation and cache
  generation; its lower-level helper methods own named equation terms,
  spectral-channel math, fixture-backed calculations, and small convenience
  loops such as
  spectral-channel or directional-sample reductions. Helper methods take
  explicit calculation parameters instead of broad request objects. Atomic
  inner-loop helpers reduce explicit inputs to one returned value packet, such
  as one `SpectralValue`. They may also take the exact interface
  instance they need, such as atmosphere phase sampling for a directional
  incident loop, and call it directly inside that named calculation. Moving
  stable collaborators into calculator configuration shrinks orchestration
  signatures only; the lower-level helper surface remains explicit and
  fixtureable. Path integration point construction can live on the calculator
  because it creates endpoint/trapezoid `PathIntegrationPoint[]` value objects from a
  geometry-resolved `RaySegment` and interval count, with no geometry,
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

  The helper methods must not own the cache coordinate loop, setup lifecycle,
  or shader resources.
- The cache-build method surface is now explicit: coordinator
  `buildIncidentRadianceCache(...)`; light source
  `describeIncidentRadianceCache(...)` and
  `createIncidentRadianceCache(...)`; cache `coordinates()`,
  `addCoordinateToCache(...)`, `createIncidentRadianceSampler(...)`,
  and `createShaderPayload(...)`; sampler callback
  `incidentRadianceSampler(cacheAccess)`;
  geometry `resolveViewRaySegment(...)` plus mapping/build/access resolvers; atmosphere
  cache-dependency descriptors;
  `calculator.buildEndpointTrapezoidPathIntegrationPoints(...)`;
  `calculator.computeRadiance(...)`; and
  `ShaderBuilder.buildIncidentRadianceCacheTexture(...)`.
- The next concrete deliverables are the parameter/provenance ledger, the
  exact data-flow contract, the mutable reconciliation POC spine under
  `scripts/flat/reconciliation/POC/`, followed by the first numbered evidence
  records once substantive verification begins.
- The current living milestone plan is [Action Plan](action-plan.md):
  Milestone 0 preparation, then CPU distant/spherical, CPU local/flat, GPU
  distant/spherical, and GPU local/flat parity.

## Major POC Goals

1. CPU reference, distant Sun, spherical Earth parity against the accepted
   Bruneton start-fresh Experiment 32 / Step 032 sky dome/four-view artifacts at
   `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
   This is the lane's hard artifact rule.
2. CPU reference, local Sun, flat Earth parity against the accepted
   `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes` artifacts.
   Because this is an artificial configuration, verification may close in
   parts rather than as one physical validation claim.
3. GPU integrated shader, spherical Earth, distant Sun parity against the CPU
   reference. This requires browser execution and a long-running browser
   process that can watch for job updates.
4. GPU integrated shader, local Sun, flat Earth parity, informed by the
   shader-lab implementation and the later local-second-order lane.

Each goal's numbered records should capture code/config changes, parity
criteria, diagnostics, visual artifacts, facts, references, and any rejected or
superseded attempts.

The browser watcher can be designed and implemented before Milestone 3. Running
the long-lived browser process is a user-run step when sandbox restrictions
prevent the agent from launching or controlling the browser directly.

## Supporting Workstreams

Use [Action Plan](action-plan.md) for the living milestone plan. The sections
below are supporting workstreams that may be touched by more than one
milestone.

### Workstream: Lane Scaffold

- Create the mutable reconciliation POC root under
  `scripts/flat/reconciliation/POC/`.
- Accept Milestone 0 when the scaffold exists. Do not require a formal numbered
  experiment record for scaffold-only work.
- Include ambient `types.d.ts` files for complex POC packets, descriptors,
  callbacks, records, and handles, with implementation JSDoc referencing those
  names.
- Use one file per runtime class and make the class the file's single default
  export. Keep required complex types in the owning `types.d.ts`.
- Create the first numbered record folder under `tmp/atmosphere/reconciliation/`
  when substantive verification, parity comparison, or a rejected/accepted run
  needs durable evidence.
- Create record-writing helpers only where they reduce friction. They should
  capture the accepted record file set: `state-goal.md`, `inputs.json`,
  `provenance.json`, `equations-and-constants.json`,
  `criteria-results.json`, `diagnostics.json`, `report.md`, and `run.log`,
  but the lane does not require each record to be a standalone rerunnable
  experiment.
- Maintain an append-only `tmp/atmosphere/reconciliation/running-log.md` once
  numbered records begin.
- Follow the artifact state, criterion state, tolerance, provenance, and
  reporting rules in
  [Experimental Guidelines](experimental-guidelines.md).

### M0 Scaffold Inventory

The canonical M0 file/class/type inventory lives in
[Algorithm32 Abstraction Design](algorithm32-abstraction-design.md#m0-scaffold-inventory).
Keep the full inventory there so the design contract remains the single source
of truth; this lane README only links to it.

### Workstream: Parameter And Provenance Ledger

- Build the canonical parameter ledger for the initial Algorithm32 atmosphere
  profile, light/source model, geometry policy, spectral basis, numerical
  controls, cache policy, shader packing policy, and display/comparison
  policy.
- Require every promoted constant to carry per-value provenance: external
  source, source-backed derivation, or accepted Algorithm32
  experiment/decision.
- For choices settled by subjective Algorithm32 review, record the candidate
  set, the retained/omitted decision, and the source trail for every retained
  equation, constant, approximation, or display choice. Subjective acceptance
  can select a baseline; it cannot promote unsourced ingredients.
- Treat unclear provenance as a reconciliation finding. Recover the trace,
  record an Algorithm32 decision, or keep the value out of the promoted
  initial profile.
- Treat view latitude, longitude, local time, and view altitude as
  Algorithm32 configuration. The app's method for deriving or defaulting
  altitude is a separate upstream policy, and historical fixture heights should
  not be promoted silently.
- For local Sun work, treat default altitude, size, and annual latitude
  migration as source-recovery profile defaults. Treat source brightness/power
  and real-time synchronization as calibration outputs because the flat model
  has no independently sourced brightness or time standard.
- Keep alternate atmosphere profiles out of the initial run. Bucholtz
  Rayleigh, ozone-bearing profiles, and alternate aerosol presets remain
  future named profiles unless a later explicit decision changes the first
  implementation scope.

Expected outputs:

- `parameters.md` or equivalent.
- Machine-readable `equations-and-constants.json`.
- A source/provenance report naming unresolved constants and decisions.

### Workstream: CPU Reference

- Implement the CPU reference Algorithm32 path under
  `shared/algorithm32/production/`.
- Keep the transport core source-neutral. Light/source, geometry, atmosphere,
  and the bound incident radiance sampler provide facts and samples; transport
  coordinates the spectral calculation.
- Keep color/display outside CPU transport. The CPU reference may expose or
  test the color boundary, but spectral transport must run without color.
- Use direct general-calculator calculations before accepting cache or
  shader approximations.
- Test algorithms and constants against the parameter ledger and cited
  sources.
- Prove the CPU reference preserves the accepted Step 032/parameter-ledger
  baseline before using it as the oracle for shader parity.
- Test the ownership boundaries so implementation-private source, geometry,
  atmosphere, cache, and color state cannot leak across public interfaces.

Minimum CPU evidence:

- High-level Algorithm32 transport tests.
- Finite object composition tests.
- Convergence-backed numerical-control tests.
- Local-source behavior tests.
- Direct general-calculator incident-radiance tests.
- Second-order incident-radiance/cache tests.
- Display-boundary tests proving color is outside CPU transport.

### Workstream: Data-Flow Contract

Document the exact data objects that cross every boundary. At minimum, name
the owner, inputs, outputs, units, provenance requirements, cache-key
requirements, and failure behavior for:

Every complex data object in this contract should also exist as a named
ambient type in an owning `types.d.ts` file, with JavaScript implementation
code using JSDoc to record its use.

- Algorithm32 configuration.
- Resolved light/source model facts.
- Resolved geometry facts and ray/path requests.
- Geometry-owned `SourceRelativePosition` values, observer-source diagnostic
  facts, and source-relative cache coordinates.
- Resolved atmosphere profile and medium samples.
- Spectral basis and spectral-channel descriptors.
- Evaluation requests and transport state.
- Radiance calculator requests and `PathRadiance` values for cache generation
  and CPU reference reuse.
- Shared CPU/shader setup descriptors, fingerprints, numerical controls,
  cache-build coordinator packets, shader-payload contracts, diagnostics, and
  provenance.
- Light-source lighting fact packets and resolved light-path descriptors.
- Incident-radiance cache descriptors, sampler callbacks, sampling requests,
  generated-value payloads, and optional emitted artifact descriptors.
- Cache-build coordinator requests and cache-owned build coordinates.
- Cache shader payload descriptors, shader textures, uniforms, defines, modes,
  and debug views.
- `PathRadiance` values and diagnostics.
- Color/display conversion requests for the GPU render path.

This contract is a deliverable, not a byproduct. The GPU phase should not
start until the CPU reference data flow is stable enough to bind.

### Workstream: GPU Shader

- Build the GPU shader implementation against the CPU reference.
- Treat shader matching as implementation parity against the CPU reference, not
  as independent algorithm validation. Its force depends on the CPU reference
  already being proven baseline-faithful.
- Allow shader-specific shortcuts for performance, packing, precision,
  interpolation, branching, or cache use only when they are explicit,
  tolerance-bounded, and tested against the CPU reference.
- Keep shader texture packing, precision, branching, and approximation choices
  explicit.
- Validate selected diagnostics against the CPU reference before relying on
  images.
- Validate full-image shader output against the CPU reference where practical,
  with named tolerances.
- Use the color/display interface in this phase to turn spectral transport
  output into renderable output.
- Fail loudly when required cache, shader, color/display, or capability inputs
  are missing or mismatched. Do not silently fall back to first-order,
  distant-Sun, default-Sun, or no-cache behavior.

### Workstream: Evidence Recreation

Recreate accepted artifact families from the historical local second-order
lane under the reconciled parameters and the new artifact root. Classify each
artifact as objective, subjective/review, rejected, or superseded.

Objective artifacts to recreate:

- Module/reference parity.
- Bruneton Figure 1 accepted-baseline image regression against the generated
  Experiment 32 Step 032 outputs. The external Bruneton comparison images
  explain the source target, but the reconciliation regression target is the
  accepted generated Algorithm32 artifact set.
- Direct general-calculator incident-radiance checks.
- Cache shape and cache-key checks.
- CPU soft-shader/reference local second-order checks.
- Integrated GPU local second-order checks.
- CPU/GPU selected-pixel parity.
- Criteria/results JSON, diagnostics, and reports.

Optional further validation artifact:

- Real-Sun-matched local-source comparison on spherical geometry. For a chosen
  view latitude, longitude, local time, and altitude, resolve the reference
  distant/real Sun state under the canonical spherical geometry, then configure
  a finite local Sun on that same spherical geometry to match the same apparent
  direction, angular size, incident spectral scale or calibration target, and
  atmosphere/numerical controls at the reference view point as closely as the
  local-source model permits. Record the explicit handoff facts that make the
  match possible: geometry frame, observer/root position, local source
  position, sample-to-source distances, angular size or solid angle, source
  path and clipping descriptor, inverse-square/falloff inputs, calibration
  reference event, and spectral incident scale. Compare distant-source and
  local-source CPU/GPU outputs, selected pixels, spectra, and diagnostics.
  Treat this as a limiting-case/source-geometry-separation diagnostic, not
  proof that the local Sun model is physically valid at other view positions.
  If the local source cannot run on spherical geometry, record whether the
  missing dependency is source configuration, geometry-resolved fact,
  coordinator data flow, or improper coupling before promotion.

Subjective/review artifacts to recreate:

- First-order versus second-order/cache galleries.
- Terrain and Southern France OBJ browser captures.
- With/without shader source matrices.
- Local-vs-distant time-aligned galleries.
- Local-source neutral-spectrum comparisons.
- Optional star/sky review galleries.

Subjective/review images can also become objective regression artifacts when
the artifact defines a deterministic target and numeric image criteria. For
example, the Bruneton start-fresh Figure 1 external comparison image explains
where the target came from, but reconciliation should prove visual regression
against the accepted generated Experiment 32 Step 032 images. This kind of
evidence proves the scoped regression claim, not physics correctness by
itself. The final Algorithm32 visual result was accepted by subjective review
among source-backed candidates, so artifact reports should preserve that
selection history while separately proving that the retained algorithms,
constants, approximations, and display choices are sourced or explicitly
accepted Algorithm32 decisions.

### Workstream: Closeout

- Update Algorithm32 conclusions, requirements, production design, status, and
  active-topic handoff with the reconciled contracts.
- Promote only accepted, source-backed contracts into production docs/code.
- Record rejected/superseded decisions so future agents do not revive them.
- Leave a concise final lane closeout that names what shipped, what remains
  open, and which artifacts are the canonical evidence.

## Local Second-Order Lessons To Carry Forward

The historical local second-order lane is useful process and evidence, not the
production boundary. Carry these lessons forward:

- Use direct general-calculator transport before cache or shader
  approximation.
- Keep the incident-radiance abstraction source-neutral:
  `L1_incident = incidentField.sample(position, incomingDirection, wavelength)`.
- Keep geometry responsible for mapping model-space positions to
  `SourceRelativePosition`: direction from source plus measured source distance
  when finite placement exists. Light sources consume that position and supply
  lighting facts, including distance-use treatment for the geometry-measured
  source distance. Source-relative cache coordinates are a separate
  descriptor-driven mapping.
- Define the logical cache contract before GPU texture packing.
- For local source cache work, the accepted POC shape is
  `z/rho/incomingDirection/wavelength`, using a Sun-subpoint
  radial/tangential/up direction frame instead of raw world-space incoming
  directions.
- Source configuration belongs in cache keys, not hidden global state.
- Direction sign conventions must be explicit and consistent across source
  sampling, cache lookup, phase evaluation, shader code, and diagnostics.
- Hardware WebGL diagnostics must be recorded for GPU/browser artifacts.
- Browser evaluation timeouts require recovery. Do not keep reading canvases
  from a page that may still be doing WebGL work after the timeout.
- Review-quality terrain imagery should use antialiasing/supersampling when
  judging directional-light terrain detail.

Useful source files:

- [Algorithm32 Abstraction Design](algorithm32-abstraction-design.md)
- [Action Plan](action-plan.md)
- [Experimental Guidelines](experimental-guidelines.md)
- [Bruneton Start-Fresh Source Audit](bruneton-start-fresh-source-audit.md)
- [Post-Step032 Product Facts Audit](post-step032-lane-source-audit.md)
- [Local Sun Flat Geometry Fact Inventory](local-sun-flat-geometry-fact-inventory.md)
- [Unsourced And Partially Sourced Facts](unsourced-and-partially-sourced-facts.md)
- [Local Sun Second-Order README](../plans/atmosphere-cleanroom-design/local-sun-second-order/README.md)
- [Local Sun Second-Order Experiment Plan](../plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md)
- [Local Sun Second-Order Scattering Notes](../plans/atmosphere-cleanroom-design/local-sun-second-order/scattering-notes.md)
- `scripts/flat/local-second-order/run-milestones.js`
- `scripts/flat/local-second-order/harness.js`
- `scripts/flat/local-second-order/README.md`

## Prep Decisions

The listed prep decisions no longer block Milestone 0. Milestone 0 starts with
the mutable POC bootstrap/skeleton, accepts the skeleton by existence, and does
not require a formal numbered experiment. Record-template helpers, artifact
inventory, watcher protocol, and provenance ledger shape may be added during
M0, but imperfections there can be iterated later.

Deferred decisions:

- Constants from `conclusions.md` become a Milestone 1 provenance task. M0
  needs only a ledger shape that can classify values.
- The first CPU reference artifact proving the five-interface data flow is a
  Milestone 1 verification artifact.
- The first accepted data-contract slice for `SourceRelativePosition`,
  `AtmospherePath`, `IncidentRadianceSampler`, and
  `IncidentRadianceSamples` can evolve during M0 and is accepted through the
  later CPU reference evidence.
- Shader parity tolerances are a Milestone 3 decision.
- Mandatory versus optional local-second-order subjective artifacts are a
  Milestone 4 or closeout decision.
