# CelestialContributionCache Implementation Plan

Status: active companion plan; research inventory complete, qualification
measurements not started.

This document owns the ordered work, gates, and progress state for implementing
the optional production `CelestialContributionCache`. The canonical physical,
ownership, runtime, invalidation, and acceptance contract remains
[CelestialContributionCache Design](celestial-contribution-cache-design.md).
The broader Algorithm32 roadmap remains
[Algorithm32 Production Implementation Plan](implementation-plan.md).
The cache-local external-source research, exact retained identities, claim
boundaries, and first-party oracle routing are in the
[CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md).
Routine plan execution uses that dossier; reconciliation records are opened
only to audit or extract an exact listed artifact.

[Algorithm32 Status](status.md) owns concise current production state and the
immediate handoff. [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
owns the current gap inventory and closure state. This plan owns only the
cache-specific sequence, checklists, expected artifacts, gates, and checked
progress. Accepted qualification decisions must update the design; completed
implementation work and verification must update status rather than remaining
plan-only facts.

Record `067` describes a rolled-back production attempt. It is historical
evidence only and cannot satisfy any gate in this plan.

## Objective

Extend the existing production Algorithm32 shader/runtime with a bounded,
camera-independent cache of already atmosphere-transported direct celestial
contributions:

- extended sources return complete 15-channel transported spectral radiance;
- point sources return complete 15-channel transported spectral irradiance;
- current camera/raster state queries and applies those values without
  rebuilding the field; and
- `pathRadiance + celestialRadiance` reaches the existing Color owner exactly
  once.

Completion means every claimed source/geometry family passes the design's
qualification envelope and requirements `CCC-R01` through `CCC-R15`, current
output remains unchanged when the optional cache is disabled, and a fresh
numbered production record accepts applicable GPU/browser parity.

## Current Baseline

- Production implementation truth is `shared/algorithm32/production/`.
- Existing topology remains `Algorithm32`, `SharedModel`, `Reference`,
  `SpectralCalculator`, `ShaderBuilder`, `SceneInputCapture`,
  `ShaderRuntimePass`, configured physical owners, incident-radiance caches,
  and Color.
- [Algorithm32 Status](status.md) owns the current verified production, build,
  and app-integration baselines used when this plan executes.
- The cache design, runtime-input inventory, preferred coordinate candidates,
  and optional per-frame preparation shader are documented.
- The cache-local reference/evidence dossier has mined the applicable
  reconciliation research, added the missing primary pixel-solid-angle and
  official WebGL capability sources, and separated externally sourced facts,
  accepted first-party oracles, and unproved cache hypotheses.
- No qualification measurements, production cache contract, builder, payload,
  resource, shader contribution, transient preparation pass, or parity proof
  exists.

## Current Phase

The plan is at A0, the common qualification harness and report schema. The
source/evidence inventory portion of A0 is complete. The immediate next action
is to freeze shared oracle samples, measurements, and predeclared
error/resource budgets so the spherical, flat, and point-query pipeline lanes
can run in parallel. Phases B through G remain blocked by Qualification Gate A;
this is not authorization to add production cache or shader modules.

## Planning Rules

- Do not write production cache or shader code before Qualification Gate A
  passes for at least one bounded family.
- Treat candidate coordinates as hypotheses until CPU-oracle error, resource,
  and runtime measurements accept them.
- Keep source selection discrete and non-interpolated. Only the declared
  continuous coordinates participate in interpolation.
- Query direct celestial contribution at the receiver position, never at an
  atmosphere march point or renderer endpoint.
- Keep point irradiance and extended radiance discriminated through contracts,
  storage, lookup, and tests.
- Cache final transported contribution. Any internal factorization remains
  cache-owned and must reconstruct the same logical value before returning it.
- Keep camera, projection, viewport, response, footprint, scene depth, and
  per-frame prepared packets out of cache identity.
- Extend the current facade, configured owners, builder, runtime pass, and
  Color order. Do not introduce a parallel renderer architecture.
- Production may use accepted reconciliation behavior as an oracle but must
  not runtime-import reconciliation POC code, records, or `tmp` artifacts.
- During qualification, read only the immutable records listed in the local
  reference/evidence dossier and preserve each record's stated claim boundary.
  Production fixture promotion is not a prerequisite for a nonproduction
  qualification probe.
- Every external fact used by a selected family must name a `CCC-XR-*` dossier
  row. Every first-party oracle must name a `CCC-EV-*` row. Cache coordinates,
  interpolation, packing, and performance cite new measurements rather than
  being mislabeled as reconciliation or external facts.
- After Qualification Gate A and Contract Gate B, promote only the references,
  evidence claims, and fixture bytes required by the selected first matrix.
  Production reference/evidence registries then become canonical.
- Update this plan's checkboxes and current decisions as work completes. Put
  chronology only in the topic's designated log or immutable proof records.

## Dependency And Parallel Work Shape

```text
A0 oracle/source inventory + common harness and budgets
    |
    +-- A1 distant/spherical coordinate/value probe --------+
    +-- A2 local/flat coordinate/value/dome probe -----------+
    +-- A3 point pipeline/visibility feasibility -------------+
                                                            v
                                             A4 provisional family,
                                             source-bound, and layout matrix
                                                            |
                                                            v
                                             A5 measured direct-vs-prepared
                                             lookup using provisional layouts
                                                            |
                                                            v
                                             A6 freeze Qualification Gate A
                                                            |
                                                            v
                                                   B production contracts
                                                     |              |
                                                     v              v
                                             C builder work      E0 selected
                                                               oracle/reference
                                                               promotion
                                                     |              |
                                                     +------v-------+
                                                       Builder Gate C
                                                            |
                                             +--------------+-------------+
                                             v                            v
                                      D GPU resources             E1 runtime/scene
                                                                    fixtures
                                             +--------------v-------------+
                                                            |
                                                            v
                                                    F runtime integration
                                                            |
                                                            v
                                                     G fresh proof
```

Lanes A1, A2, and A3 may run in parallel after A0 freezes common
measurements. A5 waits for A4 because real lookup cost depends on provisional
source bounds, packing, texture kind, and lookup count. E0 promotion may run
alongside CPU builder work after contracts are stable, but Builder Gate C
waits for it. E1 may run alongside GPU resource work after the CPU artifact is
stable. Runtime integration waits for both a validated GPU resource layout and
its applicable E1 fixtures.

## Phase A: Representation Qualification

Goal: prove a practical physical index, complete logical value, and production
calculation for every family considered for the first implementation.

### A0. Common qualification harness

- [x] Mine the applicable reconciliation research into the cache-local
  [reference/evidence dossier](celestial-contribution-cache-references.md),
  including exact external identities, claim boundaries, retained audit paths,
  and unresolved cache-specific gaps.
- [ ] Define a production-shaped, non-runtime probe request using immutable
  source, atmosphere, geometry-domain, spectral-basis, build-visibility, and
  numerical-policy snapshots.
- [ ] Freeze an oracle manifest that names the exact `CCC-EV-*` record,
  artifact, claim, units, and checksum used by each comparison. Qualification
  may read those immutable records directly and must not wait for production
  fixture promotion.
- [ ] Define common receiver/source samples, including representative interior
  positions and dense boundary cases.
- [ ] Define CPU-oracle comparisons against accepted point and extended
  behavior while preserving these boundaries:
  - `CCC-EV-033` for measure typing and source packets;
  - `CCC-EV-034` for point response and exact pixel solid angle;
  - `CCC-EV-040` for extended integration;
  - `CCC-EV-049` for disk-integrated Moon calibration only;
  - `CCC-EV-050` for exact-source/per-direction transport and composition;
  - `CCC-EV-054` for returned-epoch globe geometry only;
  - `CCC-EV-056` for the bounded eight-case physical scene matrix;
  - `CCC-EV-059` for the pre-display claim boundary; and
  - `CCC-EV-065` for CPU/source-integration convergence, not contribution-
    cache evidence.
- [ ] Define one report schema containing:
  - logical and physical coordinate dimensions;
  - source/profile limits;
  - sample counts and interpolation method;
  - maximum, percentile, and representative spectral error;
  - build time and peak CPU memory;
  - packed bytes, upload time, and GPU memory;
  - WebGL2 resource count, dimensions, formats, filtering/renderability, and
    actual queried `MAX_TEXTURE_SIZE`, `MAX_3D_TEXTURE_SIZE`,
    `MAX_ARRAY_TEXTURE_LAYERS`, `MAX_TEXTURE_IMAGE_UNITS`,
    `MAX_COMBINED_TEXTURE_IMAGE_UNITS`, `MAX_DRAW_BUFFERS`,
    `MAX_COLOR_ATTACHMENTS`, and `MAX_FRAGMENT_UNIFORM_VECTORS` under
    `CCC-XR-WEBGL-01` through `CCC-XR-WEBGL-04`;
  - lookup count and measured frame cost; and
  - source/atmosphere update cost.
- [ ] Define the GPU measurement method, including timer-query availability,
  disjoint-result rejection, warmup, sample count, percentile reporting, and a
  declared fallback when `EXT_disjoint_timer_query_webgl2` is unavailable.
- [ ] Predeclare error and performance budgets as experiment criteria rather
  than silently accepting whatever the probe produces.

A0 references: `CCC-XR-RAD-01`, `CCC-XR-RAD-02`, `CCC-XR-TRN-01`,
`CCC-XR-WEBGL-01`, and `CCC-XR-WEBGL-04`, plus only the `CCC-EV-*` claims
listed above.

### A1. Distant source with spherical geometry

Candidate continuous coordinates:

```text
h = length(receiver) - bottomRadius
mu = dot(normalize(receiver), sourcewardDirection)
```

- [ ] Probe extended radiance with
  `sourceSelector + (h, mu_query)` for uniform Sun/Moon-style disks.
- [ ] Probe point irradiance with
  `sourceSelector + (h, mu_exactSource)` for accepted point-star cases.
- [ ] Evaluate uniform and supported radial source profiles without turning
  angular support into an interpolated transport boundary.
- [ ] Classify planet intersection analytically before interpolation.
- [ ] Measure uniform, nonuniform, and horizon-adapted `mu` sampling near
  tangent paths.
- [ ] Compare linear, log-domain, or other justified value interpolation while
  preserving a logical final transported contribution.
- [ ] Reject any representation that blends blocked and visible samples,
  silently clamps receiver altitude, or depends on longitude, camera pose, or
  viewport pixels under the declared spherical symmetry.

A1 deliverable: a report recommending or rejecting a bounded spherical point
and/or extended representation, including exact coordinate maps and budgets.
`CCC-XR-ATM-01` is architecture precedent only; it does not prove `(h, mu)`.
Use `CCC-XR-TRN-01`, the source rows selected for the probe, and
`CCC-EV-034`, `CCC-EV-040`, `CCC-EV-049`, `CCC-EV-050`, `CCC-EV-056`, and
`CCC-EV-065` only within their dossier claims.

### A2. Local source with flat geometry

Candidate point coordinates:

```text
z = receiver.z
rho = length(receiver.xy - sourceSubpoint.xy)
```

Candidate extra-atmosphere extended coordinates:

```text
z = receiver.z
mu = sourcewardDirection.z
```

- [ ] Probe finite point irradiance with
  `sourceSelector + (z, rho)`, including exact distance law and source depth.
- [ ] Probe uniform extra-atmosphere extended radiance with
  `sourceSelector + (z, mu_query)` only under a plane-parallel physical
  top-atmosphere boundary.
- [ ] Measure a center-path small-disk approximation separately, including
  across-disk and near-horizon error; do not treat it as the exact default.
- [ ] Exercise `rho = 0`, source-radius/falloff transitions, ground/top
  boundaries, horizon, domain edges, and any coordinate seams.
- [ ] Replace nearest/clamped incident-cache assumptions with bracketing,
  discontinuity-aware interpolation and explicit out-of-domain behavior.
- [ ] Resolve the current fixed `observerCenteredDome` for direct celestial
  transport by testing:
  1. dome retained only as a view-ray safety cap while direct celestial
     transport uses the physical top-atmosphere plane;
  2. a receiver-relative direct-celestial dome; and
  3. fixed-dome transport with the additional dimensions it requires.
- [ ] Prefer the first dome policy only if physical-oracle and production-shaped
  results accept it; do not change existing base view-ray behavior as an
  incidental cache implementation detail.
- [ ] If no finite flat point source owns compatible physical intensity/power,
  spectrum, distance, and units, record the coordinate result as mechanics
  only and exclude that source/family from the production matrix. Do not turn
  the unsourced configured local Sun into a physical source.

A2 deliverable: a report recommending or rejecting finite-point and
extra-atmosphere-extended flat representations plus one explicit dome policy.
Use `CCC-XR-TRN-01`, conditionally `CCC-XR-LIGHT-01`, `CCC-EV-034`,
`CCC-EV-040`, `CCC-EV-050`, and `CCC-EV-LOCAL-L2` as precedent only. No cited
source proves `(z, rho)` or `(z, mu)`.

### A3. Point-query pipeline and visibility feasibility

Test the proposed seam without assuming a cache texture kind, packing, or real
lookup cost:

```text
bounded direct fragment lookup

versus

SceneInputCapture
    -> source-sized transient query preparation shader
    -> ShaderRuntimePass response evaluation
```

- [ ] Select representative synthetic source bounds and response footprints
  without treating that bound as the final capacity.
- [ ] Prototype a tiny source-sized target with fixture spectral groups plus
  current projection/depth/visibility metadata, checking
  `CCC-XR-WEBGL-02` and the selected r180 Three target behavior.
- [ ] Prove the pass can carry one exact-source query result to every response
  pixel rather than deriving transport from each destination response ray.
- [ ] Compare exact-source foreground-depth lookup, a source-visibility
  prepass, analytic visibility, and any explicitly bounded approximation.
- [ ] Confirm that each main fragment still evaluates only its own normalized
  response and exact pixel solid angle; the preparation shader never scatters
  writes to neighboring pixels.
- [ ] Prove pass ordering, resize, camera/projection refresh, context loss, and
  cleanup behavior without creating a transported-field generation.
- [ ] Reject target formats that are not preflighted for renderability and
  framebuffer completeness.

A3 deliverable: a correctness/visibility seam and feasible target-format set.
It does not choose direct versus prepared lookup. Use `CCC-XR-GEO-01`,
`CCC-XR-CAM-01`, the WebGL/Three dossier rows, and `CCC-EV-034`,
`CCC-EV-050`, and `CCC-EV-056`.

### A4. Freeze a provisional family and layout matrix

- [ ] Review A1, A2, and A3 together rather than accepting each in isolation.
- [ ] Select provisional source/geometry pairings and an explicit maximum
  point-source bound.
- [ ] Select provisional continuous coordinates, discrete source selection,
  domain,
  resolution policy, interpolation, discontinuity classification, and
  out-of-domain behavior for each accepted family.
- [ ] Select a provisional logical value kind, 15-channel packing, texture
  kind/count, source/profile limits, dome policy, and performance/error
  budgets sufficient for real lookup measurements.
- [ ] Keep rejected or unsupported source families out of the provisional
  matrix even if their coordinate mechanics appeared promising.

A4 does not pass Qualification Gate A. It supplies the concrete layouts needed
to measure the runtime strategy.

### A5. Direct-versus-prepared lookup measurement

- [ ] Measure bounded direct main-fragment lookups using the A4 source bound,
  packing, texture kinds, interpolation, and representative response support.
- [ ] Measure the A3 preparation seam using those same provisional cache
  resources and source cases.
- [ ] Report cache texture reads, preparation target bytes and writes, pass
  count, source-count scaling, CPU submission cost, valid GPU time, and total
  representative frame cost.
- [ ] Confirm both strategies return identical exact-source irradiance and
  leave normalized response and exact pixel-solid-angle evaluation in each
  destination fragment.
- [ ] Record direct lookup, preparation, or a measured fixed threshold as the
  recommendation; do not add an unbounded runtime heuristic.

A5 deliverable: a runtime-strategy recommendation and measured capability
envelope tied to the provisional A4 layouts.

### A6. Freeze the first supported matrix

- [ ] Review A1 through A5 together.
- [ ] Freeze the exact initial source/geometry pairings.
- [ ] Freeze continuous coordinates, discrete source selection, domain,
  resolution policy, interpolation, discontinuity classification, and
  out-of-domain behavior for each accepted family.
- [ ] Freeze logical value kind, 15-channel packing, texture resources,
  source/profile limits, point-query strategy, dome policy, and
  performance/error budgets.
- [ ] Record rejected representations and the measurements that rejected them.
- [ ] Freeze the exact `CCC-XR-*` and `CCC-EV-*` rows that Contract B and E0
  must promote for the selected matrix.

Qualification Gate A passes only when at least one family has a complete,
bounded, measured representation. Failure stops production implementation and
reopens the architecture; it does not authorize a raw five-dimensional field,
viewport cache, or camera-dependent rebuild.

## Phase B: Contracts And Canonical Source Seam

Goal: define the smallest additive production contract around the accepted
representation without duplicating canonical facts.

- [ ] Select the minimal optional configured celestial-source provider beside
  the existing physical owners.
- [ ] Limit that provider to the A6 matrix and the exact external identities in
  its selected `CCC-XR-*` rows. Unsupported source categories fail rather than
  inheriting a nearby spectrum, magnitude, or placement policy.
- [ ] Derive visible Sun facts from the same canonical solar facts as the
  illumination owner; do not create a second solar spectrum.
- [ ] Define discriminated point-irradiance and extended-radiance source packets
  with unit-bearing durable boundaries.
- [ ] Define `CelestialContributionCache`, immutable descriptor, payload family,
  builder request/result, generation identity, dependency fingerprints,
  checksums, provenance, and failure rules.
- [ ] Define geometry-owned coordinate mapping and validity packets for every
  accepted family.
- [ ] Define source metadata for placement, support, profile, depth, opacity,
  and discrete resource selection without repeating it at every sample.
- [ ] Define runtime compatibility separately from physical-field identity;
  point response and transient preparation policy must not invalidate the
  transported field.
- [ ] Define optional-disabled exact zero and configured-invalid loud failure.
- [ ] Define provenance pointers so the eventual descriptor references
  production numbered sources and named evidence after E0, never a dossier id
  or `tmp` path as runtime authority.
- [ ] Add contract and negative tests for `CCC-R01` through `CCC-R14` before GPU
  binding work begins.

Contract Gate B passes when fakes can exercise all accepted source/geometry
families, owner boundaries are unambiguous, and no API requires callers to
construct cache textures or shader source.

Phase B uses the source, placement, radiometry, and transport rows selected in
A6 plus `CCC-EV-033`, `CCC-EV-049`, `CCC-EV-050`, and conditionally
`CCC-EV-054`. It must preserve every source's dossier non-claim.

## Phase C: CPU Builder And Immutable Artifact

Goal: build and query the accepted logical fields through production owners and
shared transport primitives.

- [ ] Implement `buildCelestialContributionCache(...)` asynchronously behind
  awaited setup/update boundaries.
- [ ] Capture and validate immutable narrow owner snapshots.
- [ ] Traverse only qualified coordinates and stable build visibility.
- [ ] Calculate point irradiance and extended radiance with exact-source
  atmosphere transport and all 15 canonical channels.
- [ ] Reuse production transport primitives; do not independently reimplement
  Beer-Lambert transport or wrap every sample in a frame workflow. Cite the
  numbered production entries promoted from `CCC-XR-TRN-01` and
  `CCC-XR-TRN-02`.
- [ ] Emit final typed arrays directly where practical and measure redundant
  complete-payload copies.
- [ ] Implement CPU lookup/interpolation with explicit boundary classification,
  validity, and out-of-domain failure behavior.
- [ ] Produce deterministic descriptors, dependency fingerprints, generation
  ids, checksums, byte counts, and provenance.
- [ ] Add builder, interpolation, finite-distance, support/profile,
  invalidation, determinism, and all-channel tests.

Builder Gate C passes when CPU cache queries meet the frozen oracle/error
budgets and an immutable generation can be audited without becoming another
canonical source of truth. C implementation may proceed alongside E0, but the
gate cannot pass until E0 has promoted every external source, evidence claim,
and fixture row used by those tests.

## Phase D: GPU Resources And Lifecycle

Goal: install the accepted payload through the existing `ShaderBuilder`
resource lifecycle.

- [ ] Add a `celestialContribution.*` descriptor, payload, binding, and shader
  namespace separate from incident-radiance `cache.*` state.
- [ ] Preflight texture count, dimensions, format, precision, filtering, and
  source capacity before resource creation using actual WebGL2 capability
  queries, selected extension checks, and framebuffer completeness where
  applicable.
- [ ] Pack and upload all 15 channels according to the qualified layout.
- [ ] Validate descriptor/payload lengths, channel order, checksums, generation
  compatibility, and required bindings.
- [ ] Prepare complete successor resources before atomic installation.
- [ ] Preserve the previous committed generation after an awaited replacement
  failure.
- [ ] Recreate GPU resources after context restoration when the immutable CPU
  payload remains valid.
- [ ] Dispose cache and transient-preparation resources through the existing
  handle lifecycle.
- [ ] Add capability, packing, stale-generation, replacement, restoration,
  disabled-zero, configured-invalid, and disposal tests.

Resource Gate D passes when CPU values and packed GPU lookups agree across all
15 channels within the frozen packing tolerance. Cite the numbered production
entries promoted from `CCC-XR-WEBGL-01` through `CCC-XR-WEBGL-04` and the
exact selected r180 Three source; existing production reference `[5]` is not
sufficient for an array texture or render target merely because it documents
`Data3DTexture`.

## Phase E: References, Oracle Fixtures, And Evidence Promotion

Goal: make accepted reconciliation behavior durable production evidence before
builder or runtime claims depend on it.

### E0. Selected source and core-oracle promotion

E0 starts after Contract Gate B, runs alongside Phase C, and must finish before
Builder Gate C passes.

- [ ] Promote only the A6-selected `CCC-XR-*` rows into AMA-numbered entries in
  `shared/algorithm32/production/references.md`, preserving exact version,
  locator, quantity, role, and non-claim.
- [ ] Pin the exact selected Three r180 source instead of retaining mutable
  `master` when production reference `[5]` is applicable; add separate entries
  only for other selected Three resources.
- [ ] Promote the minimum accepted claims from `CCC-EV-033`, `CCC-EV-034`,
  `CCC-EV-040`, `CCC-EV-049`, `CCC-EV-050`, and conditionally `CCC-EV-054`
  into named entries in
  `shared/algorithm32/production/evidence.md`.
- [ ] Promote only the selected raw or reduced source payloads and oracle rows
  to their production fixture homes, recheck hashes, and preserve the original
  source identity. Retained reconciliation bytes remain immutable audit
  evidence; the promoted path is the sole production fixture owner.
- [ ] Give every core row canonical units, assumptions, expected values,
  tolerance, independence note, numbered reference, and named evidence
  pointer.
- [ ] Add fixture-ledger validation before builder specs consume new rows.

E0 Gate passes when every external fact and first-party oracle used by Builder
Gate C has canonical production provenance and no production artifact needs a
reconciliation path to interpret it.

### E1. Runtime, scene, and readback fixture promotion

E1 starts after Builder Gate C, runs alongside Phase D, and must finish before
Runtime Gate F passes.

- [ ] Promote point, extended, Sun-disk, uniform-Moon, point-star, overlap,
  foreground visibility, celestial depth, and camera-motion fixture rows as
  required by the accepted first matrix.
- [ ] Promote only the applicable claims from `CCC-EV-054`, `CCC-EV-056`,
  `CCC-EV-059`, and `CCC-EV-065`; retain record 054's geometry-only, record 059's pre-display, and
  record 065's non-cache claim boundaries.
- [ ] Give every runtime row canonical units, assumptions, expected values,
  tolerance, independence note, numbered reference, and named evidence
  pointer.
- [ ] Add fixture-ledger validation before runtime/resource specs consume new
  rows.
- [ ] Retain exact source-to-pixel, normalized response, off-raster,
  conservative footprint, real-scene, and convergence provenance.
- [ ] Route display readback through the existing
  `gpu-selected-rgba-byte-parity` production evidence policy, then require a
  fresh cache-specific record rather than inheriting prior acceptance.
- [ ] Do not cite record `067` as acceptance for the successor design.

E1 Gate passes when every production oracle used by resource or runtime tests
has durable provenance and validated tolerance metadata.

## Phase F: Runtime Query And Composition

Goal: add cached direct celestial contribution through the smallest existing
shader seam.

Prerequisites: Resource Gate D and the applicable E1 Gate both pass.

- [ ] Add zero-initialized `state.celestialRadiance`.
- [ ] Add a deterministic shader hook after base `evaluateTransport` and before
  Color composition.
- [ ] Implement geometry-owned coordinate mapping and cache-owned lookups for
  each accepted family.
- [ ] Extended sources:
  - classify support analytically;
  - reconstruct center and required footprint directions;
  - perform qualified conservative footprint integration;
  - use matched or accepted bounded foreground-depth sampling; and
  - add transported radiance directly without a second transmittance.
- [ ] Point sources:
  - query transported irradiance at the exact source direction;
  - resolve exact-source foreground and celestial visibility before spreading;
  - project through current camera state;
  - evaluate normalized response, exact pixel solid angle, and off-raster
    accounting; and
  - add `E_point * p_i / Omega_i` to affected fragments.
- [ ] Implement bounded direct fragment lookup first when Gate A selected it.
- [ ] Implement the optional source-sized preparation shader only when Gate A
  selected it for performance or exact-source visibility.
- [ ] Keep extended directional lookup and partial foreground coverage in the
  main fragment even when point preparation is enabled.
- [ ] Make out-of-domain queries log once per bounded event and contribute zero
  until an explicit awaited domain replacement succeeds.
- [ ] Prove camera, projection, viewport, pixel ratio, point response, and scene
  depth changes update live or transient state without rebuilding the field.
- [ ] Make Color consume `pathRadiance + celestialRadiance` exactly once while
  preserving existing scene composition.

Phase F cites the promoted forms of `CCC-XR-RAD-01`, `CCC-XR-RAD-02`,
`CCC-XR-GEO-01`, and `CCC-XR-CAM-01` plus the selected point, extended,
transport, depth, scene, and
claim-boundary evidence. The bilinear response remains a declared local policy
accepted by evidence, not a physical-PSF citation.

Runtime Gate F passes when point, extended, overlap, visibility, response,
camera-motion, disabled-cache, and no-second-transmittance tests pass in the
production shader assembly and runtime lifecycle.

## Phase G: Production Proof And Handoff

Goal: accept the implemented slice with layered CPU, GPU, and browser evidence.

- [ ] Prove direct physical oracle -> CPU cache query parity.
- [ ] Prove CPU cache query -> packed GPU cache query parity before Color.
- [ ] Prove spectral addition order and all-channel single application.
- [ ] Prove selected-pixel display output against `Reference` plus Color.
- [ ] Exercise camera translation, rotation, FOV, resize, and pixel-ratio
  changes without cache identity changes.
- [ ] Exercise source, atmosphere, geometry/domain, build visibility, spectral
  basis, builder, and representation invalidation.
- [ ] Run `npm run test:algorithm32:production`.
- [ ] Run `npm run build`.
- [ ] Run the selected Algorithm32 app-integration lane.
- [ ] Run applicable visible-celestial GPU/browser parity, including XA-G12.
- [ ] Write a fresh numbered record with exact commands, hashes, artifacts,
  criteria, and results. Never amend or reuse record `067`.
- [ ] Audit that every shipped external fact has a numbered production
  reference, every experimental tolerance/decision has named production
  evidence, and no production descriptor, fixture, test, or runtime module
  depends on a dossier id or reconciliation path.
- [ ] Refresh status, design, integration, requirements, API, evidence, and
  handoff documents to describe only the implemented current state.

Production Gate G passes only when requirements `CCC-R01` through `CCC-R15`
and every accepted family budget pass, optional-disabled output matches the
current baseline, and the fresh record accepts applicable browser parity.

## Progress Tracker

- [x] Canonical family name selected: `CelestialContributionCache`.
- [x] Camera-independent logical field and composition contract documented.
- [x] Runtime-available query state documented.
- [x] Preferred spherical, flat-point, and flat-extended qualification
  candidates documented.
- [x] Optional source-sized per-frame preparation shader documented as
  transient state.
- [x] Cache-local external-reference, first-party-evidence, claim-boundary, and
  phase-routing dossier completed.
- [ ] Qualification Gate A passed.
- [ ] Contract Gate B passed.
- [ ] E0 core reference/oracle promotion passed.
- [ ] Builder Gate C passed.
- [ ] Resource Gate D passed.
- [ ] E1 runtime/scene evidence promotion passed.
- [ ] Runtime Gate F passed.
- [ ] Production Gate G passed.

## Explicitly Deferred

The design's selected first-slice scope and exclusions are canonical; this plan
does not duplicate that list. No phase may absorb a deferred feature merely to
make an accepted family work. The explicit delivery reminder is that textured
3D Moon work begins only after the uniform extended-source path is accepted.
Deferred work does not weaken the direct-visible source requirements for the
first supported matrix.

## Related Authority

- [CelestialContributionCache Design](celestial-contribution-cache-design.md)
  owns the cache contract and open design decisions.
- [CelestialContributionCache Reference And Evidence Dossier](celestial-contribution-cache-references.md)
  owns the cache-local research inventory, exact retained source identities,
  claim boundaries, and promotion crosswalk until selected rows move to the
  production registries.
- [Algorithm32 Status](status.md) owns concise current state and immediate next
  action.
- [Reconciliation To Production Deltas](reconciliation-production-deltas.md)
  owns the remaining production gaps.
- [Algorithm32 Production Implementation Plan](implementation-plan.md) owns
  the surrounding production roadmap and points to this companion plan for
  Milestone 9.
- `shared/algorithm32/production/references.md` and `evidence.md` become the
  canonical implementation citations after E0/E1 promotion. Reconciliation
  records remain immutable audit inputs, not routine planning or runtime
  authority.
