# Reconciliation Action Plan

Status: living milestone plan for the mutable reconciliation POC lane.

This plan orders the work for the Algorithm32 reconciliation POC. It can be
modified during execution as the POC teaches us more. When the plan changes,
update this document and the current-state notes. Milestone 0 scaffold work
does not need a formal numbered experiment record; acceptance is that the
usable skeleton exists. Once substantive verification begins, numbered records
under `tmp/atmosphere/reconciliation/NNN-*` preserve what actually happened,
when, why, what changed, and what evidence was produced.

The living implementation belongs under `scripts/flat/reconciliation/POC/`.
Verification should prefer objective standards: deterministic comparisons,
hard invariants, source-backed calculations, image metrics, selected-pixel
parity, descriptor equality, and fail-loud diagnostics. Subjective review is
allowed only when the record labels it as display/review evidence.
Each stage's `Files/classes` line names the expected file or class ownership
at planning granularity; it should guide implementation without becoming a
detailed function list.
POC class names only need to be clear working names, not production-final API
names. Keep one-file-per-class/default-export ownership, but do not block
milestone work on naming polish that can happen during promotion.
Implementation files touched by a stage should keep a compact file-level
reference trail that points to the relevant design section, action-plan stage,
numbered record, source audit, or external source. The chosen scheme is a
resolvable inline trail, not `[n]` citations against a separate index. Detailed
source trails stay in numbered records and provenance artifacts.
Record artifact and evidence gaps unless they are egregious. The hard artifact
rule for this lane is matching the sky dome/four-view artifacts created by the
Bruneton start-fresh Experiment 32 / Step 032 baseline under
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
Other missing diagnostics, criteria files, or historical convenience artifacts
are findings unless they make the current milestone's verification claim
impossible.

## Milestone 0: Preparation

Current status: complete. The mutable scaffold exists under
`scripts/flat/reconciliation/POC/`, `CURRENT_STATE.md` records the scaffold
state, and the smoke runner passed with five endpoint/trapezoid integration
points plus one generic cache-build coordinate.

Goal: prepare the lane so POC work can proceed without losing history or
blurring the architecture boundaries. Milestone 0 is accepted by the existence
of the mutable skeleton. An imperfect skeleton can be iterated in later
milestones; it should not be blocked on formal experiment artifacts.

Primary work:

- Create the mutable POC root at `scripts/flat/reconciliation/POC/`.
- Add a POC current-state note once the POC root exists.
- Follow the
  [M0 Scaffold Inventory](algorithm32-abstraction-design.md#m0-scaffold-inventory)
  for the initial file/class/type list and for items intentionally saved for
  later milestones.
- Confirm the initial file/module layout for the five-interface architecture:
  light/source, geometry, atmosphere, incident radiance cache/sampler, and
  color/display, with transport/calculation as coordinator.
- Create the ambient `types.d.ts` home for complex POC types and require code
  to reference those named types with JSDoc.
- Declare abstraction contracts as ambient `interface`s, not `type` aliases.
  Keep plain value packets, descriptors, records, and tuple aliases as
  `type`s where that better reflects data shape.
- Use regular interface method signatures for abstraction behavior members,
  not properties with function types. Callable callback interfaces may use call
  signatures.
- Use one runtime file per class, with the class as that file's single default
  export. Required complex types go in the owning `types.d.ts` file.
- Inventory comparison or guidance targets for all four milestones. Step 032
  is the hard exact-match target for M1; Step 018 is guidance/diagnostic
  material for M2.
- Define record-template and running-log expectations for later substantive
  verification records, without requiring a Milestone 0 record.
- Identify the browser job-watch requirement for GPU milestones.

### Major Subgoals And Primary Stages

#### Subgoal 0.1: Lane Skeleton And Record Process

- Stage 0.1.1: Create the mutable POC root and current-state note.
  - Code: create `scripts/flat/reconciliation/POC/`, add a POC
    `CURRENT_STATE.md`, and add a minimal directory layout for source,
    runners, browser jobs, records, and shared utilities.
  - Files/classes: add `POC/README.md`, `POC/CURRENT_STATE.md`,
    `POC/src/index.js`, and the directory/file skeleton named in the
    design doc inventory; no domain classes should do real physics yet.
  - References: `README.md`, `experimental-guidelines.md`, and
    `agents/topics/active-topic.md`.
  - Verification: confirm the root exists, the current-state note names the
    active milestone and the absence of a formal Milestone 0 record if none
    exists, and `git diff --check` passes.

- Stage 0.1.2: Define the later numbered-record shape.
  - Code: document or stub the first record template and running-log
    expectations that will be used once parity runs or substantive verification
    begin. Do not require a formal `tmp/atmosphere/reconciliation/NNN-*`
    folder for scaffold-only Milestone 0 work.
  - Files/classes: update `POC/README.md` and `POC/CURRENT_STATE.md` with the
    future record template and running-log convention; create helper files
    only if they remove immediate scaffold friction.
  - References: the numbered-record contract in `experimental-guidelines.md`.
  - Verification: the skeleton can be accepted without a numbered record, and
    the first later numbered record still has a clear contract to follow.

- Stage 0.1.3: Add optional record-writing helpers.
  - Code: add small helpers only where they reduce friction for writing
    `inputs.json`, `provenance.json`, `criteria-results.json`,
    `diagnostics.json`, and `equations-and-constants.json`.
  - Files/classes: optionally add `POC/src/records/types.d.ts` and a small
    record-writing utility module; keep any class one-file/one-default-export
    and avoid committing to a full artifact framework in M0.
  - References: `experimental-guidelines.md` and accepted historical records
    under `tmp/atmosphere/local-second-order/`.
  - Verification: if helpers are added during Milestone 0, run only lightweight
    schema or dry-write checks. Helper absence does not block skeleton
    acceptance.

#### Subgoal 0.2: Architecture Skeleton

- Stage 0.2.1: Create the five-interface POC module map.
  - Code: create first-pass modules for light/source, geometry, atmosphere,
    incident radiance cache/sampler, color/display, and shared spectral
    calculation/transport coordination. Add ambient `types.d.ts` files at the
    owning shared or module-local boundaries for complex packets, descriptors,
    callbacks, records, and handles. Abstraction contracts in those files
    should be `interface`s; carried data packets can remain `type`s. Any
    runtime class added during scaffold work gets its own file and is that
    file's single default export.
  - Files/classes: add `src/types.d.ts`; module-local `types.d.ts` files under
    `calculator/`, `geometry/`, `atmosphere/`, `light/`,
    `incident-radiance/`, `color/`, and `setup/`; add `SpectralCalculator.js`,
    the two error class files, `validateModelSet.js`,
    `buildIncidentRadianceCache.js`, `noIncidentRadiance.js`, and
    `runners/smoke.js` as thin shells.
  - References:
    [M0 Scaffold Inventory](algorithm32-abstraction-design.md#m0-scaffold-inventory),
    `algorithm32-abstraction-design.md`, and the architecture overview loaded
    from the active topic bootstrap.
  - Verification: import the module map from a smoke runner, confirm no module
    owns peer-model private state, and record intentionally deferred
    interfaces in `CURRENT_STATE.md`. Confirm complex type names have an
    ambient declaration home before implementation code consumes them, and
    class files follow the one-class default-export rule.

- Stage 0.2.2: Add the core value packets.
  - Code: add ambient type definitions for `Ray`, `RaySegment`,
    `PathIntegrationPoint`, `PathRadiance`, `SpectralValue`, and the
    operation-ready incident-radiance sampler callback shape. Implementation
    files should use JSDoc to record those types at parameters, returns,
    fields, callbacks, and local handoff values instead of leaving object
    shapes implicit.
  - Files/classes: update `src/types.d.ts` for shared value packets; update
    `calculator/types.d.ts` and `incident-radiance/types.d.ts` for calculator
    and sampler shapes; add JSDoc references in `SpectralCalculator.js`,
    `buildIncidentRadianceCache.js`, `noIncidentRadiance.js`, and
    `runners/smoke.js`.
  - References: `algorithm32-abstraction-design.md`.
  - Verification: run a small smoke script that constructs valid packets and
    checks invariants: unit direction, finite ray bounds, monotonic
    `distanceAlongRayMeters`, nonnegative `measureMeters`, and spectral channel
    alignment. Spot-check that the consumed complex packet shapes are named in
    `types.d.ts` and referenced by JSDoc in code.

- Stage 0.2.3: Add fail-loud unsupported-combination checks.
  - Code: add validation helpers for source/geometry/cache combinations so
    unsupported configurations reject instead of falling back to distant Sun,
    no cache, stale cache, or first-order-only behavior.
  - Files/classes: update `validation/validateModelSet.js`,
    `errors/ReconciliationConfigurationError.js`, and
    `errors/UnsupportedCombinationError.js`; add validation request/result
    packets to the nearest owning `types.d.ts` files.
  - References: `post-step032-lane-source-audit.md`,
    `unsourced-and-partially-sourced-facts.md`, and `experimental-guidelines.md`.
  - Verification: run rejected configuration probes and record structured
    errors for unsupported source/cache/geometry pairings.

- Stage 0.2.4: Enforce historical-code mining boundary.
  - Code: add a POC convention or lightweight scan that allows reading,
    mining, copying, and porting historical POC code with provenance, but
    rejects runtime imports, symlinks, re-exports, or other links to old code
    in place.
  - Files/classes: add a lightweight validation script or utility under
    `POC/src/validation/` and document the rule in `POC/README.md`; no runtime
    domain class should depend on preserved experiment paths.
  - References: `experimental-guidelines.md`, preserved code under
    `shared/algorithm32/POC/`, historical scripts under
    `scripts/flat/algorithm32-shader-lab/`, `scripts/flat/atmosflat32/`, and
    `scripts/flat/local-second-order/`.
  - Verification: scan `scripts/flat/reconciliation/POC/` for imports or
    path-based runtime references to preserved POC bundles and historical
    experiment scripts; any hit is either removed or recorded as a rejected
    M0 check.

#### Subgoal 0.3: Evidence Target And Provenance Inventory

- Stage 0.3.1: Inventory target artifact roots.
  - Code: add an inventory runner or manual record that lists the four target
    roots, required files, image names, criteria files, diagnostics, and any
    missing data.
  - Files/classes: add an optional `POC/src/runners/inventoryTargets.js` or
    record the paths directly in `POC/CURRENT_STATE.md`; use this only to list
    target roots and gaps, not to create a formal M0 artifact.
  - References:
    `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`,
    `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`,
    `tmp/atmosphere/algorithm32_shader_lab/`, and
    `tmp/atmosphere/local-second-order/`.
  - Verification: record target paths and any obvious gaps in current-state
    notes or the scaffold docs. A numbered inventory record is optional in
    Milestone 0. Missing non-hard evidence is recorded as a gap; missing or
    unusable Step 032 sky dome/four-view target artifacts is egregious and
    blocks the hard Milestone 1 gate.

- Stage 0.3.2: Seed the parameter and provenance ledger.
  - Code: add the first ledger shape for equations, constants, spectral basis,
    numerical controls, source model parameters, geometry policy, cache policy,
    and display/comparison policy.
  - Files/classes: add a lightweight ledger shape in `POC/src/provenance/` or
    `POC/parameters.md` if needed by the scaffold; defer populated
    `equations-and-constants.json` contents to Milestone 1.
  - References: `agents/topics/apps/flat/algorithm32/conclusions.md`,
    `bruneton-start-fresh-source-audit.md`,
    `local-sun-flat-geometry-fact-inventory.md`, and
    `unsourced-and-partially-sourced-facts.md`.
  - Verification: the ledger shape exists and can express provenance classes.
    Full scalar classification is a Milestone 1 precondition, not a Milestone
    0 acceptance blocker.

#### Subgoal 0.4: Browser Job-Watch Preparation

- Stage 0.4.1: Define or implement the browser job protocol and watcher.
  - Code: define JSON job request/result shapes for long-running browser
    renders, including job id, scene id, config digest, input snapshot path,
    output paths, timeout/progress policy, browser diagnostics, and result
    status. Follow the local-Sun experiment model: the user-run watcher opens
    JSON job files, writes progress while work runs, and saves retained visual
    artifacts as PNG files. The watcher can be implemented any time before
    Milestone 3, but browser execution is a user-run step because of sandbox
    constraints.
  - Files/classes: add browser job request/result types to
    `POC/src/browser/types.d.ts`; if implemented early, add
    `browser/BrowserShaderJobRunner.js` as a single default-export
    watcher/runner class and a non-browser dry-run utility.
  - References: `scripts/flat/algorithm32-shader-lab/harness.js`,
    `scripts/flat/local-second-order/harness.js`, and browser rules in
    `experimental-guidelines.md`.
  - Verification: verify schema and non-browser dry-run behavior locally where
    possible. Full accepted/rejected browser-job verification requires the user
    to run the watcher and should be captured in a later numbered record.

- Stage 0.4.2: Identify GPU capability diagnostics.
  - Code: define the WebGL/browser capability packet that GPU milestones must
    capture.
  - Files/classes: add `BrowserCapabilityPacket` and related diagnostics
    packets to `browser/types.d.ts` or `shader/types.d.ts` according to the
    owning boundary; defer the concrete
    browser capability reporter class until the watcher exists.
  - References: shader-lab records under
    `tmp/atmosphere/algorithm32_shader_lab/` and local-second-order browser
    records.
  - Verification: the capability packet records vendor/renderer/version,
    precision, extension availability, texture limits, and browser/user-agent
    facts needed to interpret GPU image differences.

Exit criteria:

- The POC has a writable root, current-state note, and minimal module
  skeleton, including ambient `types.d.ts` homes for complex POC value
  packets, JSDoc references from code, and one-file-per-class default exports
  for runtime classes. No formal numbered experiment record is required for
  Milestone 0.
- The four target artifact roots are named, and gaps are recorded unless they
  are egregious blockers for the current verification claim.
- The initial action plan, README, status, and active-topic notes agree on the
  lane process.

## Milestone 1: Full CPU Algorithm32, Distant Sun, Spherical Earth

Current status: complete. Record
`tmp/atmosphere/reconciliation/016-step032-full-image-comparison` generated all
four full-size 320px Figure 1 sky-dome artifacts through the cache-backed CPU
reference and matched the accepted Step 032 decoded RGBA targets exactly.

Goal: produce the full CPU Algorithm32 reference for the distant Sun and
spherical Earth baseline, including the L2 incident-radiance cache build,
binding, and sampling path, against the accepted Bruneton start-fresh
Experiment 32 / Step 032 sky dome baseline:
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
This is the lane's hard artifact rule. Milestone 1 must also complete the
core abstraction shape: the main algorithm produces spectral data only and
must not assume a distant light source, spherical geometry, the canonical
atmosphere profile, absent L2 incident radiance, rendering, or color conversion.
The distant-sun/spherical-Earth implementation is the first concrete
implementation pair for those abstractions, not a special case baked into the
transport core.

Primary work:

- Build the complete CPU reference Algorithm32 POC spine for spherical
  geometry, distant light source, atmosphere, spectral calculation, L2
  incident-radiance cache, and adjacent display/comparison output.
- Finish the five-interface abstraction contract across light/source,
  geometry, atmosphere, incident radiance cache/sampler, and color/display so
  later concrete implementations can plug into the same CPU algorithm.
- Build, validate, bind, and consume the distant-source L2 incident-radiance
  cache through the generic cache builder and `IncidentRadianceSampling`
  callback contract.
- Build the L2 cache path incrementally inside Milestone 1: descriptors and
  storage first, then build/bind, then runtime sampling and selected-term
  diagnostics.
- Keep rendering and color conversion outside the main algorithm. CPU
  transport returns spectral outputs; comparison image generation consumes
  those outputs as an adjacent output step.
- Preserve the accepted Algorithm32 endpoint/trapezoid path rule.
- Keep active baseline constants in one POC module so atmosphere,
  artifact-rendering code, source setup, and the primary runner consume the
  same atmosphere profile, spectral basis, display policy, Figure 1 scenes,
  and numerical controls.
- Record equations, constants, spectral basis, numerical controls, and source
  trails used by the run.
- Generate comparable four-view outputs and diagnostics.
- Compare against the accepted Step 032 visual artifacts with explicit
  exact-match criteria; this parity gate requires the complete CPU Algorithm32
  path, not a first-order-only slice.
- Leave Milestone 2 as an implementation milestone for local light source and
  flat geometry on the already-established abstraction surface, except for
  defects discovered during that implementation.

M1 record strategy:

- Keep the `NNN-*` prefixed record-folder convention. Milestone 1 should use
  multiple focused numbered records, not one giant record.
- Required M1 evidence anchors are parameter/provenance extraction, transport
  helper invariants, concrete distant/spherical CPU execution, and Step 032
  image comparison.
- Parameter/provenance records should classify constants, equations,
  numerical controls, spectral basis, source facts, display/rendering facts,
  and unresolved provenance before those values become accepted runtime facts.
- Transport helper invariant records should verify the reusable calculator
  helper surface and inner-loop identities independently from final image
  parity.
- Concrete distant/spherical execution records should cover spherical
  geometry, distant source, canonical atmosphere, distant L2 cache
  build/bind/sample behavior, selected-ray diagnostics, and spectral outputs.
  Cache descriptor, build, binding, and runtime-consumption stages may be
  split into smaller prefixed records when useful.
- Step 032 image-comparison records should focus on the ported renderer,
  output artifacts, and exact decoded RGBA parity against the four accepted
  PNGs. They should consume earlier evidence rather than replacing it.
- A later M1 closeout record may summarize accepted evidence, but it should
  not be the only record that proves the milestone.
- Every CLI-launched experiment run is its own experiment and gets its own
  fresh `NNN-*` folder, including reruns with the same script/options.
  Ordinary verification commands run while preparing or closing a record are
  logged inside that record rather than creating additional folders.

### Major Subgoals And Primary Stages

#### Subgoal 1.0: Abstraction Closure

Current status: complete in
`tmp/atmosphere/reconciliation/001-abstraction-closure-contract`, with the
interface-declaration refinement recorded in
`tmp/atmosphere/reconciliation/002-interface-contract-declarations` and the
method-signature refinement recorded in
`tmp/atmosphere/reconciliation/003-interface-method-signatures`. The mutable
POC now has a spectral-only `SpectralReferenceEvaluator`, tightened ambient
interface contracts, post-transport output/comparison type homes, and a
contract probe showing non-spherical/non-distant mock collaborators can run
through the evaluator without rendering/color dependencies. Subgoal 1.1 is
next.

- Stage 1.0.1: Freeze the concrete-independent CPU contracts.
  - Code: finalize the CPU-facing contracts for light/source, geometry,
    atmosphere, incident radiance sampling, spectral calculation, and
    output handoff. The calculator and setup code should receive explicit
    value packets and interface instances, never concrete distant/spherical
    implementation details.
  - Files/classes: update `src/types.d.ts`, `geometry/types.d.ts`,
    `light/types.d.ts`, `atmosphere/types.d.ts`,
    `incident-radiance/types.d.ts`, `setup/types.d.ts`,
    `calculator/types.d.ts`, and new `evaluation/types.d.ts`; add
    `evaluation/SpectralReferenceEvaluator.js` as the spectral-only main
    algorithm coordinator; update `SpectralCalculator.js`,
    `buildIncidentRadianceCache.js`, `src/index.js`, and validation helpers as
    needed. `SpectralReferenceEvaluator` should coordinate abstract model
    calls and spectral packets only, with no concrete source/geometry imports.
  - References: `algorithm32-abstraction-design.md` and
    `experimental-guidelines.md`.
  - Verification: add smoke or focused probes with mock model
    implementations that are not named spherical/distant, proving the main
    algorithm talks only through the abstract contracts and fails loudly when
    required contract methods or descriptors are missing.

- Stage 1.0.2: Separate spectral transport from rendering and color.
  - Code: keep Algorithm32 evaluation and `SpectralCalculator` outputs as
    spectral packets such as `PathRadiance` and final spectral output. Put
    image writing, Figure 1 display conversion, and visual comparison in
    artifact-rendering, output, comparison, or runner modules that consume
    spectral data after transport is complete. The M1 Figure 1 conversion is
    artifact code executed by the experiment runner, not a concrete
    `ColorDisplayModel` implementation.
  - Files/classes: update `src/types.d.ts` and the M1 output/comparison or
    artifact-rendering modules; add `outputs/types.d.ts`,
    `comparison/types.d.ts`, and post-transport artifact-rendering classes
    only when the first image comparison needs them. Do not add color/display
    dependencies to `SpectralCalculator.js` or
    `evaluation/SpectralReferenceEvaluator.js`; update `color/types.d.ts` only
    if a later shader/display boundary actually needs a contract change.
  - References: color/display boundary rules in
    `algorithm32-abstraction-design.md` and this action plan.
  - Verification: import/dependency checks or targeted probes show the main
    algorithm and calculator can run without rendering or color modules; image
    generation requires spectral output as input.

- Stage 1.0.3: Prove Milestone 2 can be additive.
  - Code: before closing M1, exercise the contracts with placeholder or mock
    non-distant/non-spherical implementations enough to prove local source
    and flat geometry should be concrete class work rather than a core
    algorithm rewrite.
  - Files/classes: update `validation/validateModelSet.js`, `runners/smoke.js`,
    add `runners/contractProbe.js` if the smoke runner becomes too broad, and
    update `evaluation/SpectralReferenceEvaluator.js` only through its abstract
    contracts; do not add real `LocalSunLightSource` or `FlatEarthGeometry`
    behavior until Milestone 2.
  - References: M2 stages in this plan and interface ownership rules in
    `algorithm32-abstraction-design.md`.
  - Verification: record a contract-coverage check in a focused M1 numbered
    record. Any required change to transport signatures for local/flat support
    is a Milestone 1 abstraction blocker unless it is clearly a defect fix.

#### Subgoal 1.1: CPU Reference Transport Spine

Current status: complete in
`tmp/atmosphere/reconciliation/012-transport-helper-invariants`, with the
parameter/provenance prerequisite in
`tmp/atmosphere/reconciliation/011-parameter-provenance-extraction`.

- Stage 1.1.1: Implement the spectral calculator loop.
  - Code: implement `buildEndpointTrapezoidPathIntegrationPoints(...)` and
    `computeRadiance(...)` for a `RaySegment`, with direct in-scattering,
    source transmittance, optional incident-radiance sampling when a bound
    `IncidentRadianceSampling` value is supplied, and `PathRadiance` output.
  - Files/classes: update `calculator/SpectralCalculator.js`,
    `calculator/types.d.ts`, `src/types.d.ts`, and
    `evaluation/SpectralReferenceEvaluator.js`; keep the readable radiance loop
    in `SpectralCalculator` while the evaluator owns the per-ray orchestration
    over abstract model interfaces.
  - References: `algorithm32-abstraction-design.md`,
    `bruneton-start-fresh-source-audit.md`, and accepted Step 032 evidence.
  - Verification: hard invariants for monotonic integration points, finite
    spectral values, transmittance in `[0, 1]`, zero-medium passthrough, and no
    incident-radiance recursion during cache-generation runs.

- Stage 1.1.2: Implement equation helpers.
  - Code: add low-level helpers for optical depth, Beer-Lambert transmittance,
    phase-weighted direct scattering, direct in-scattering,
    phase-weighted incident in-scattering, directional incident-sample
    reduction, and endpoint/background composition.
  - Files/classes: update `calculator/SpectralCalculator.js` and, only if the
    helper surface becomes too crowded, add one calculation-focused helper
    class file under `calculator/` with matching ambient types.
  - References: source-backed equation notes in
    `agents/topics/apps/flat/algorithm32/conclusions.md` and
    `bruneton-start-fresh-source-audit.md`.
  - Verification: compare helper diagnostics against source-backed identities
    and accepted Step 032 numerical records where available.

#### Subgoal 1.2: Spherical Geometry And Distant Light Source

Current status: complete for selected-ray pre-artifact execution in
`tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run`.

- Stage 1.2.1: Implement spherical geometry.
  - Code: add spherical Earth geometry for view-ray segment resolution,
    altitude coordinate resolution, atmosphere-boundary clipping, and
    source-path atmosphere path creation.
  - Files/classes: add `geometry/SphericalEarthGeometry.js` as the concrete
    geometry class for this milestone, update `geometry/types.d.ts` for any
    spherical descriptors or diagnostics it owns, and export it from
    `src/index.js`. Do not change evaluator/calculator public signatures for
    spherical-only needs.
  - References: Step 032 audit, Algorithm32 conclusions, and spherical
    geometry requirements in `algorithm32-abstraction-design.md`.
  - Verification: objective checks for ray-sphere boundary distances, altitude
    monotonicity, finite segment bounds, and deterministic `AtmospherePath`
    samples.

- Stage 1.2.2: Implement distant Sun.
  - Code: add distant light-source model with direction-only source-relative
    position, no finite distance falloff, source radiance facts, and
    source-path limit semantics.
  - Files/classes: add `light/DistantSunLightSource.js` as the concrete
    light-source class, update `light/types.d.ts` for distant-source
    descriptors and diagnostics, and export it from `src/index.js`. Do not add
    distant-source branches to `SpectralReferenceEvaluator` or
    `SpectralCalculator`.
  - References: `post-step032-lane-source-audit.md`,
    `bruneton-start-fresh-source-audit.md`, and Step 032 source/light facts.
  - Verification: compare direction packets and source facts against accepted
    Step 032 diagnostics or regenerated deterministic diagnostics; fail if
    finite-source fields leak into distant-source transport.

#### Subgoal 1.3: Atmosphere Profile And Provenance

Current status: complete for the pre-artifact M1 run in
`tmp/atmosphere/reconciliation/011-parameter-provenance-extraction` and
`tmp/atmosphere/reconciliation/013-concrete-distant-spherical-run`.

- Stage 1.3.0: Centralize active baseline constants.
  - Code: add shared constant packets for the canonical atmosphere profile,
    distant-source constants, active Step 032 spectral channels, Figure 1
    display policy, Figure 1 scene/render constants, and runtime/reference
    numerical controls. These constants are the only POC source of those values
    for atmosphere, artifact-rendering code, light-source setup, and the
    primary M1 runner.
  - Files/classes: add `constants/consts.js` and `constants/types.d.ts`,
    export the constants from `src/index.js`, and update `runners/smoke.js`
    to assert the key constants are importable and aligned. Do not duplicate
    these values in future `CanonicalAtmosphere`, artifact-renderer, or
    primary runner modules.
  - References: `agents/topics/apps/flat/algorithm32/conclusions.md`,
    `bruneton-start-fresh-source-audit.md`, and Step 032 artifact constants.
  - Verification: smoke runner imports the constants and checks the active
    atmosphere values, 15-channel spectral basis, source-derived Figure 1 `k`,
    four scenes, tile size, and runtime/default numerical controls.

- Stage 1.3.1: Implement the canonical atmosphere profile.
  - Code: add density/profile sampling, Rayleigh/Mie/absorption coefficients,
    phase evaluation, extinction/scattering samples, and optical-depth
    integration over geometry-resolved `AtmospherePath`.
  - Files/classes: add `atmosphere/CanonicalAtmosphere.js` and update
    `atmosphere/types.d.ts` for profile descriptors, medium samples, and
    optical-depth diagnostics; export it from `src/index.js`. The atmosphere is
    a concrete provider behind `AtmosphereModel`, not a calculator dependency
    by name. It should consume `CANONICAL_ATMOSPHERE_CONSTANTS` and
    `CANONICAL_SPECTRAL_CHANNELS` instead of carrying private copies.
  - References: Step 032 audit, Algorithm32 conclusions, and source trails
    recorded in `bruneton-start-fresh-source-audit.md`.
  - Verification: objective checks for nonnegative coefficients, extinction
    greater than or equal to scattering where applicable, optical-depth
    monotonicity with path length, and transmittance bounds.

- Stage 1.3.2: Write run provenance.
  - Code: emit `equations-and-constants.json`, `provenance.json`, and
    diagnostics for the exact CPU distant/spherical run.
  - Files/classes: add provenance writer utilities under `provenance/` and
    record outputs under the relevant numbered record once M1 verification
    starts; update `provenance/types.d.ts`, `src/types.d.ts`, and
    `parameters.md` for emitted provenance packet shapes. Add
    `provenance/ProvenanceLedgerWriter.js` only if a class removes real
    repetition; otherwise use a small function module.
  - References: `experimental-guidelines.md` and the Step 032
    `criteria-results.json` or report files when present.
  - Verification: every emitted equation/constant has a source classification,
    and unresolved facts block acceptance rather than silently passing.

#### Subgoal 1.4: Distant L2 Incident-Radiance Cache

Current status: complete in
`tmp/atmosphere/reconciliation/014-distant-l2-cache-build-bind-sample`.

This subgoal can be built incrementally. The cache descriptor/storage work may
land before the full build coordinator, and the build coordinator may land
before runtime L2 contribution is accepted, as long as every partial state is
fail-loud and cannot be mistaken for Step 032 parity.

- Stage 1.4.1: Implement distant cache descriptors and storage.
  - Code: add the source-created distant incident-radiance cache family:
    descriptor, coordinate generator, key/fingerprint data, generated-value
    storage, binding validation, sampler creation, and shader-payload
    descriptor export.
  - Files/classes: add `incident-radiance/DistantSunIncidentRadianceCache.js`,
    update `incident-radiance/types.d.ts`, `light/types.d.ts`,
    `geometry/types.d.ts`, `setup/types.d.ts`, and `src/index.js`; update
    `light/DistantSunLightSource.js` so it describes and creates the distant
    cache without making the evaluator source-specific.
  - References: cache-builder sections in
    `algorithm32-abstraction-design.md`, Step 032 evidence, and
    `bruneton-start-fresh-source-audit.md`.
  - Verification: descriptor snapshots include source, geometry, atmosphere,
    spectral-basis, numerical-control, and cache-resolution dependencies;
    cache keys reject stale or mismatched contexts; generated storage aligns
    with the active spectral basis.

- Stage 1.4.2: Build and bind through the generic coordinator.
  - Code: complete `buildIncidentRadianceCache(...)` so setup asks the light
    source to create the cache, loops over cache-owned coordinates, asks
    geometry for representative build rays and cache-access facts, calls the
    shared calculator with incident sampling disabled for cache generation,
    stores `PathRadiance.inScattered`, validates the completed cache against
    active descriptors, and returns an operation-ready
    `IncidentRadianceSampling` value.
  - Files/classes: update `setup/buildIncidentRadianceCache.js`,
    `setup/types.d.ts`, `calculator/SpectralCalculator.js`,
    `incident-radiance/DistantSunIncidentRadianceCache.js`,
    `geometry/SphericalEarthGeometry.js`, and
    `evaluation/SpectralReferenceEvaluator.js` only where evaluator setup needs
    to receive the bound sampler.
  - References: `algorithm32-abstraction-design.md`,
    `experimental-guidelines.md`, and local-second-order cache-loop evidence as
    process support only.
  - Verification: direct/oracle cache-value checks, nonzero L2 contribution
    where expected, zero contribution for explicit no-sampling configuration,
    fail-loud mismatch rejection, and no recursive cache sampling while cache
    values are being generated.

- Stage 1.4.3: Consume L2 in the primary CPU evaluation.
  - Code: update the primary evaluation flow so each path integration point
    resolves cache access through geometry when `IncidentRadianceSampling` is
    present, calls the bound sampler, and includes the returned directional or
    collapsed incident radiance in the calculator's in-scattering reduction.
  - Files/classes: update `evaluation/SpectralReferenceEvaluator.js`,
    `calculator/SpectralCalculator.js`, `calculator/types.d.ts`,
    `incident-radiance/types.d.ts`, and `geometry/types.d.ts`; no concrete
    distant-source or spherical-geometry branch should appear in the evaluator
    or calculator.
  - References: `algorithm32-abstraction-design.md`,
    `bruneton-start-fresh-source-audit.md`, and Step 032 parity records.
  - Verification: selected-ray diagnostics show direct and L2 terms separately,
    total spectral output remains finite and nonnegative, and disabling the
    explicit no-sampling variant changes only the incident-radiance term.

#### Subgoal 1.5: Four-View CPU Baseline Comparison

Current status: complete. Record
`tmp/atmosphere/reconciliation/015-first-sky-dome-artifacts` produced the
first four reduced-size 96px sky-dome PNG artifacts through the POC renderer.
That record proves artifact generation only. Record
`tmp/atmosphere/reconciliation/016-step032-full-image-comparison` then
generated the full-size, distant-L2-backed four-view artifacts and matched the
accepted Step 032 decoded RGBA targets exactly.

- Stage 1.5.1: Generate comparable CPU images.
  - Code: add artifact-rendering code for the four Figure 1 baseline views,
    including the Figure 1 display conversion needed only for comparison
    artifacts. This conversion is executed by the experiment runner after
    spectral transport. Port the accepted Bruneton start-fresh runner's
    rendering path for projection, sky-disc masking, display conversion,
    byte packing, and PNG writing so the new artifacts are rendered apples to
    apples. Adapt only the call that obtains per-pixel spectral transport data
    from the new POC evaluator/calculator/cache path.
  - Files/classes: add a CPU Figure 1 artifact renderer under
    `outputs/`. Current implementation uses
    `outputs/Figure1SkyDomeRenderer.js`, `outputs/pngWriter.js`,
    `outputs/types.d.ts`, `runners/m1FirstSkyDomeArtifacts.js`, and
    `src/index.js`. Keep display conversion outside CPU transport and outside
    `evaluation/SpectralReferenceEvaluator.js`; the artifact renderer may
    invoke the validated conversion for Step 032 parity, but the conversion
    policy remains color-abstraction work.
  - References: the four accepted PNG targets named in
    `experimental-guidelines.md` under the Step 032 baseline root, plus the
    accepted Step 032 renderer snapshot and Bruneton runner rendering path
    copied into the reconciliation POC with provenance.
  - Verification: produce deterministic output dimensions, metadata, and
    images for the same four view configurations, using the ported renderer
    path rather than a new renderer with similar-looking behavior. Record 015
    accepted the reduced-size first-artifact version of this stage, and record
    016 accepted the full-size parity-producing version.

- Stage 1.5.2: Compare against accepted artifacts.
  - Code: add exact image comparison and diagnostics reporting for dimensions,
    decoded RGBA byte equality, max absolute RGBA delta, mismatched byte count,
    mismatched pixel count, optional first-mismatch coordinates, and selected
    ray/pixel diagnostics. RMSE or mean delta can be reported for failure
    classification, but they are not acceptance criteria.
  - Files/classes: add an image comparison class or utility under
    `comparison/`, such as `comparison/ImageComparison.js`, plus
    comparison-result and selected-pixel diagnostic types in
    `comparison/types.d.ts`; add or update an M1 runner such as
    `runners/milestone1DistantSpherical.js` to write comparison artifacts into
    the Step 032 image-comparison numbered record.
  - References: Step 032 accepted artifacts and comparison policy in
    `experimental-guidelines.md`.
  - Verification: exact match is required for each accepted Step 032 target:
    same dimensions, same decoded RGBA bytes, `maxAbsRgbaDelta = 0`,
    `mismatchedByteCount = 0`, and `mismatchedPixelCount = 0`. Any mismatch is
    a failed M1 parity artifact and must be classified as transport, source,
    geometry, display, encoding, renderer-port, or artifact-tool error before
    continuing. Other artifact gaps are recorded unless they prevent that
    exact-match decision. Record 016 accepted this stage with
    `maxAbsRgbaDelta = 0`, `mismatchedByteCount = 0`, and
    `mismatchedPixelCount = 0` for all four targets.

Exit criteria:

- The full CPU abstraction contract is in place. Core transport,
  `SpectralCalculator`, cache-build setup, and validation carry no assumption
  that the light source is distant, the geometry is spherical, the atmosphere
  is canonical, L2 incident sampling is absent, or color/display is available.
- The full CPU Algorithm32 path is implemented for the distant/spherical
  baseline, including direct transport, L2 incident-radiance cache
  construction, cache binding, runtime cache access, incident sampling, and
  selected-term diagnostics.
- The main algorithm emits spectral data only. Rendering, image writing,
  display conversion, and color mapping live outside transport and consume the
  spectral outputs as a post step.
- CPU reference output exactly matches the accepted distant-sun spherical sky
  dome/four-view baseline as decoded RGBA bytes. This is the hard artifact
  gate for the lane; non-egregious supporting gaps are recorded separately.
- Numbered records capture code/config changes, inputs, facts, references,
  diagnostics, comparison artifacts, and result status at the granularity of
  the evidence being claimed. M1 should have separate accepted records, or
  explicit failed/superseded records, for parameter/provenance extraction,
  transport helper invariants, concrete distant/spherical execution, and Step
  032 image comparison.
- The M1 closeout records that Milestone 2 should add concrete
  `LocalSunLightSource` and `FlatEarthGeometry` implementations through the
  existing abstraction surface. Any later need to reshape the core algorithm is
  treated as an M1 abstraction miss or a separately justified defect fix.
- Current-state notes identify the accepted CPU distant/spherical baseline or
  the remaining blocker.

## Milestone 2: CPU Local Sun, Flat Earth

Goal: produce a confidence-backed CPU local Sun and flat Earth implementation
on the Milestone 1 abstraction surface. The atmosflat32 Step 018 sky-dome
artifacts under
`tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes` are historical
guide images and diagnostic comparison material, not a canonical exact-match
target. Milestone 2 acceptance comes from confidence in the methods:
classified facts, explicit artificial-model boundaries, analytic geometry,
transport invariants, source/cache handoff diagnostics, convergence where
needed, and explainable image behavior.

Current status: complete. Record `050-m2-closeout` accepts Milestone 2 as a
CPU local/flat method-confidence POC milestone and classifies remaining
limitations outside the M2 acceptance claim. Records
`025-m2-flat-geometry-profile` through
`030-m2-local-flat-assets-quick-rerun` add flat geometry, local Sun source,
optional local cache, basic local/flat CPU transport, pre-asset diagnostics,
and local/flat diagnostic PNG assets. Follow-up records through
`039-m2-warning-fix-six-column-stack` diagnose/fix coordinate warnings and
show the warning fix did not change saved pixels. Record
`040-m2-observer-centered-dome-local-flat-assets` implements the
observer-centered finite-dome skydome profile and regenerates the five
full-size local/flat PNGs; record
`041-m2-observer-centered-dome-side-by-side-stack` creates the requested
two-column atmosflat/new stack with no diff. Records 042 through 049 add the
observer-dome diff stack, additional latitude/time subjective inspection
sets, polar GMT sweeps, and the Union Glacier Final Experiment review sweep.
Subgoal 2.6 is complete in record `050-m2-closeout`.

Primary work:

- M2 started by carrying forward the existing local Sun / flat-geometry
  reference gap analysis into record
  `tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward`. Do not
  repeat source-mining work that is already captured in
  `local-sun-flat-geometry-fact-inventory.md`,
  `unsourced-and-partially-sourced-facts.md`, and
  `post-step032-lane-source-audit.md`; cite those findings through
  [M2 Calibration And Evidence Plan](m2-calibration-and-evidence-plan.md), then
  focus new work only on unresolved rows or code-specific proof.
  Every encountered local-source, flat-geometry, cache, display, or
  calibration fact must be called out in a record before it is used as an
  acceptance fact.
  Flat geometry has its own unresolved reference surface, not merely a
  coordinate role beneath the local light source: observer altitude/defaulting,
  flat projection/radius, finite dome/domain extent, long-sightline policy, and
  clipping diagnostics. The atmosphere/profile owns medium properties and
  altitude-based density lookup, while geometry consumes active spatial
  boundaries to calculate ray exits. The finite flat-world atmosphere extent is
  a geometry-owned spherical dome domain with an explicit center policy. For
  M2 skydome inspection, the center should be observer-centric, with the dome
  axis through the observer footprint, and the radius-like input should be the
  furthest observer view-ray extent. The dome sphere center/radius are derived
  from that extent, observer altitude, and dome apex height. Geometry then
  resolves each view-ray extent from geometry boundary candidates, not from a
  scalar no-hit distance. Those candidates include ground/surface hits,
  supplied atmosphere/profile top exits, spherical dome exits, optional radial
  map-extent exits, supplied scene/hit/max distance, and source-owned path
  limits for source-transmittance paths. For spherical candidates, use
  `Q = O - S`, `b = dot(Q, d)`, `c = dot(Q, Q) - R^2`, and
  roots `-b +/- sqrt(b^2 - c)`; the observer-centered dome uses the
  observer-inside exit root `tDome = -b + sqrt(b^2 - c)`. In skydome
  zenith-angle terms, `tDome(theta) = -h * cos(theta) + sqrt(R^2 - h^2 *
  sin(theta)^2)`, with `h = oz - centerZ`, `tZenith = H - oz`, and
  `tHorizon = D`. Flat ground/top planes use
  `tPlane = (k - dot(n, O)) / dot(n, d)`; map extents use the horizontal
  ray-circle quadratic. A map-centered dome is a separate full-world profile.
  The dome truncates the existing
  atmosphere composition; it does not compress or rescale altitude-based
  density, scattering, or absorption profiles near the edge. Any future
  compressed atmosphere is a
  separate 3D medium/composition profile, not a one-dimensional altitude
  adjustment. Renderer/view no-hit sky caps are interim diagnostics only, not
  final atmosphere extent. Record 018 closes the projection choice/source portion of that surface; record 019 corrects
  atmosphere-boundary ownership; the numeric Earth-radius source remains open.
  Reflective dome properties are a future named extension, not an M2
  requirement. If pursued, the dome becomes an optical boundary/material with
  explicit reflected/transmitted radiance behavior.
- Add flat geometry and finite local light-source implementations to the CPU
  POC through the abstraction surface completed in Milestone 1.
- Implement the geometry-to-light source handoffs for source-relative position,
  source path limits, source atmosphere paths, and cache-access coordinates as
  needed.
- Reuse the Milestone 1 Algorithm32 transport and L2 cache lifecycle. Local
  source-specific cache descriptors or concrete cache classes may be added as
  part of the local light-source implementation, but the generic builder,
  evaluator, calculator loop, and incident-sampling contract should not be
  reworked for Milestone 2.
- Treat any required change to the main algorithm, calculator signatures, or
  boundary ownership as a likely Milestone 1 abstraction gap unless the change
  is clearly a defect fix.
- Reconcile artificial/local model facts separately from externally sourced
  physics facts.
- Resolve or classify the incomplete local reference rows before calling the
  milestone done: source-backed, accepted artificial model behavior,
  fixture/display policy, deferred, or unresolved and therefore not promoted.
- Reprove calibration-backed behavior in the reconciliation POC code. Any
  value or method previously accepted because of calibration, such as local
  source brightness/scale, closest-approach normalization, source-time anchor,
  or derived incident scale, is only evidence seed material until the new code
  reruns the calibration and records diagnostics.
- Track both calibration reproof and still-needed external evidence outside
  this action plan in
  [M2 Calibration And Evidence Plan](m2-calibration-and-evidence-plan.md), so
  closeout has an explicit checklist rather than relying on prose scattered
  through records.
- Verify local-sun behavior in parts where a single physical validation claim
  is inappropriate.
- Run pre-asset experiments after the basic local/flat implementation is
  plugged in and before generating real skydome or comparison assets. These
  experiments choose or bound numerical controls, runtime boundary behavior,
  observer-centered dome exits, any interim no-hit caps, and cache/source/geometry
  handoffs.
- Generate comparable skydome outputs and diagnostics as method-inspection
  artifacts, not canonical acceptance images. Once the observer-centered dome
  ray-extent calculation is active, the images are expected to differ from
  atmosflat Step 018, so visual review is subjective error-spotting supported
  by selected-ray diagnostics rather than pixel parity.

### Major Subgoals And Primary Stages

#### Subgoal 2.0: Existing Local Reference Gap Carry-Forward

- Stage 2.0.1: Normalize the existing Milestone 2 fact/gap analysis.
  - Code: carry the existing local-source and flat-geometry gap analysis into
    a machine-readable or record-local ledger that lists each fact consumed by
    Milestone 2, its owner, units, role, current support, gap state, and
    required resolution before milestone closeout. This is a consolidation of
    already-completed analysis, not a fresh source-mining pass.
  - Files/classes: update provenance/ledger artifacts under the active M2
    record and update
    `agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md`
    if the carry-forward exposes missing tracker rows. Update
    `POC/parameters.md` only if the living parameter ledger needs new local
    rows. Add no runtime domain classes in this stage.
  - References: `local-sun-flat-geometry-fact-inventory.md`,
    `unsourced-and-partially-sourced-facts.md`,
    `post-step032-lane-source-audit.md`, and atmosflat32 Step 018 guide
    artifacts.
  - Verification: the record cites the existing analysis rows instead of
    repeating them, explicitly naming incomplete flat-geometry rows such as
    flat atmosphere/profile top boundary, finite dome/domain atmosphere exit,
    interim no-hit sky-ray cap, round-equivalent skydome cap,
    observer altitude/defaulting, projection radius, and long-sightline
    policy; and local-source/cache rows such as configurable false-Sun
    altitude/size, configurable longitude/phase, default provenance,
    brightness/calibration, annual latitude migration, local cache
    bins/direction counts, lookup policy, and stale RGB tint. Sun size and
    placement are valid authored configuration; exact defaults need provenance
    or profile-policy classification.

- Stage 2.0.2: Decide first implementation defaults without pretending they
  are final sources.
  - Code: choose the M2 POC defaults needed to run a Step 018 guided
    recreation, while marking each as source-backed, accepted experiment,
    artificial model configuration, fixture/display policy, or unresolved.
  - Files/classes: update the active M2 record, `POC/CURRENT_STATE.md`, and
    any local constants/types touched by the implementation. Keep default
    packets in ambient `types.d.ts` declarations and JSDoc them where used.
  - References: the M2 fact/gap ledger plus the historical implementation
    paths named by that ledger.
  - Verification: no local/flat runner can claim milestone acceptance unless
    its consumed facts appear in the ledger and unresolved rows are excluded
    from promotion claims.

- Stage 2.0.3: Update the external calibration/evidence tracker.
  - Code: update the separate M2 tracker with every calibration-backed
    behavior that needs reconciliation-code proof and every external-evidence
    or model-policy item that needs a closeout path. Do not inherit calibrated
    resolved values directly from atmosflat32, shader-lab, or
    local-second-order records.
  - Files/classes: update
    `agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md`,
    the active M2 record, and `POC/CURRENT_STATE.md`; add no runtime domain
    classes in this stage.
  - References: calibration rows and external-evidence rows in
    `local-sun-flat-geometry-fact-inventory.md`,
    `unsourced-and-partially-sourced-facts.md`, and the M2 tracker.
  - Verification: the tracker has separate calibration-reproof and
    external-evidence sections, and every listed item has a planned proof,
    classification, deferral, or exclusion from milestone acceptance.

#### Subgoal 2.1: Flat Geometry Profile

- Stage 2.1.1: Implement flat atmosphere geometry.
  - Code: add flat z-up geometry for altitude from `z`, ground plane,
    view-ray segment limits, source-path clipping, representative cache-build
    ray limits, and supplied scene/hit/max-distance clipping against active
    geometry and atmosphere/profile domain boundaries. Implement the geometry
    ray-length resolver as candidate-distance selection: ground/top plane
    intersections, spherical dome intersections, optional radial map-extent
    intersections, supplied max distance, and source-owned path limits. When
    the finite flat-world domain is active, geometry intersects rays against
    the spherical dome whose apex is the configured dome height and whose
    center policy is declared by the profile. Use an observer-centered dome
    for the M2 skydome-inspection profile, configured by
    `maxObserverViewRayExtentMeters` and derived sphere center/radius; resolve
    each view-ray extent by ray-sphere intersection and terminate at the
    nearest positive ground/profile/dome/map/supplied-distance hit. Source
    atmosphere paths use the same candidate math, but a ground hit before the
    source/domain exit returns a blocked path. Keep map-centered dome behavior
    as a separate explicit profile. Do not let flat geometry choose
    `topAltitudeMeters`,
    density-profile values, or any compression/remapping of the atmosphere
    composition; a compressed atmosphere would be a separate 3D atmosphere
    profile.
  - Files/classes: add `geometry/FlatEarthGeometry.js` and extend
    `geometry/types.d.ts` with flat-geometry, finite-domain descriptors, and
    diagnostics; export it from `src/index.js`. Do not change
    `evaluation/SpectralReferenceEvaluator.js` or `SpectralCalculator.js`
    public signatures just to support flat geometry.
  - References: `local-sun-flat-geometry-fact-inventory.md`,
    `post-step032-lane-source-audit.md`, and atmosflat32 Step 018 guide
    artifacts.
  - Verification: analytic ray-plane, ray-slab, ray-sphere, and horizontal
    ray-circle checks for supplied atmosphere-domain, ground,
    observer-centered dome, map extent, supplied max-distance, and source-path
    limit candidates. Confirm `tZenith = H - oz`, `tHorizon = D`, smooth
    near-rim extent changes, deterministic nearest-candidate selection,
    deterministic source-path blocked/exit/source-limit states, cache-build
    representative ray bounds, and altitude coordinate equality with
    `position.z`.

- Stage 2.1.2: Emit geometry diagnostics.
  - Code: record view segment bounds, source path bounds, clipping reason,
    candidate boundary distances, selected boundary reason, blocked path
    reason, source-relative position inputs, and cache-access inputs where
    relevant.
  - Files/classes: add or update a geometry diagnostics writer under
    `diagnostics/` or `geometry/`; keep diagnostic packet shapes in the owning
    `types.d.ts`.
  - References: geometry ownership rules in `algorithm32-abstraction-design.md`
    and local-source rows in `unsourced-and-partially-sourced-facts.md`.
  - Verification: diagnostics show geometry owns coordinate conversion and the
    light source never interprets raw flat coordinates.

#### Subgoal 2.2: Local Sun Source Model

- Stage 2.2.1: Implement local-source configuration and resolver.
  - Code: add the finite local source profile: position, radius, reference
    distance, inverse-square/reference falloff, spectral incident scale, and
    source path limit semantics.
  - Files/classes: add `light/LocalSunLightSource.js` and update
    `light/types.d.ts` for local-source configuration, resolved lighting facts,
    falloff inputs, and calibration diagnostics; export it from `src/index.js`.
    Do not add local-source branches to the main evaluator or calculator.
  - References: `local-sun-flat-geometry-fact-inventory.md`,
    `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`, and
    historical POC sources named in the inventory.
  - Verification: compare generated local-source packets to Step 018
    diagnostics where useful, treating them as guide evidence only; otherwise
    record source-relative direction, distance, falloff, and calibration
    calculations in a numbered record.

- Stage 2.2.2: Separate artificial model facts from source-backed facts.
  - Code: mark local-source defaults, false-Sun placement, calibration, long
    sky-ray policy, and display fixtures in the ledger.
  - Files/classes: update provenance/ledger files such as `parameters.md`,
    `equations-and-constants.json`, and provenance diagnostics; add a small
    fact-classification utility only if repeated classification logic appears.
  - References: `local-sun-flat-geometry-fact-inventory.md` and
    `unsourced-and-partially-sourced-facts.md`.
  - Verification: acceptance requires every local fact to be classified as
    source-backed, accepted artificial-model behavior, fixture/display policy,
    or unresolved.

- Stage 2.2.3: Reprove local-source calibration in the new code.
  - Code: add a focused calibration runner or diagnostics path that recomputes
    the selected local-source calibration from canonical M2 inputs: source
    placement, observer/reference event, measured distance, falloff,
    target/reference incident scale, and resulting spectral incident scale.
  - Files/classes: add a local calibration runner under `runners/`, update
    `light/types.d.ts` or provenance types for calibration diagnostics if
    needed, and keep resolved calibration outputs out of static constants.
  - References: the M2 fact/gap ledger, local-source calibration rows in
    `local-sun-flat-geometry-fact-inventory.md`, and the historical records
    cited by those rows.
  - Verification: the new runner emits the recomputed calibration values and
    either accepts them under the selected M2 calibration rule or classifies
    the drift. Historical calibration outputs are comparison inputs, not proof
    by themselves.

#### Subgoal 2.3: Basic Local/Flat CPU Wiring

- Stage 2.3.1: Run local-source CPU transport.
  - Code: wire flat geometry and local source through the same
    `SpectralCalculator` path used by Milestone 1.
  - Files/classes: add or update a local/flat CPU runner under `runners/`;
    reuse `FlatEarthGeometry`, `LocalSunLightSource`, `CanonicalAtmosphere`,
    `SpectralReferenceEvaluator`, and `SpectralCalculator` rather than adding
    a separate algorithm class or changing the evaluator/calculator public
    signatures.
  - References: `algorithm32-abstraction-design.md`, atmosflat32 Step 018
    guide artifacts, and `post-step032-lane-source-audit.md`.
  - Verification: objective checks for finite radiance, transmittance bounds,
    direction sign conventions, source-path transmittance behavior, and no
    silent distant-source fallback.

#### Subgoal 2.4: Pre-Asset Local/Flat Experiments

This subgoal is a gate before real asset generation. It runs after the basic
flat geometry and local light source can execute through CPU transport, but
before generating skydome/image artifacts. Its purpose is to select or bound
the outcome-moving execution policies so image generation is inspection and
evidence, not the first validation of hidden assumptions.

- Stage 2.4.1: Run flat/local path-integration convergence sweeps.
  - Code: add a focused convergence runner that evaluates selected hard
    flat/local rays across multiple path-interval and
    source-transmittance-interval packets, seeded from the existing
    Algorithm32 runtime/validation controls. Keep the current
    endpoint/trapezoid spacing as the default spacing rule unless the record
    explicitly tests and accepts another rule. If the runner tests a
    negligible-contribution cutoff caused by source falloff, source
    transmittance, view transmittance, density, or any other integrand factor,
    record it as a transport/execution approximation. It must not change the
    geometry-resolved ray length or source-path boundary descriptors.
  - Files/classes: add a local convergence runner under `runners/`, such as
    `m2FlatLocalPathConvergence.js`; update diagnostics types or writer
    helpers only as needed to record spectral deltas, path bounds,
    source-path clipping state, and runtime-boundary diagnostics. Do not
    change `SpectralCalculator` public signatures unless a convergence record
    proves the existing path schedule is inadequate.
  - References: `base-005` in
    `unsourced-and-partially-sourced-facts.md`, the convergence plan in
    `m2-calibration-and-evidence-plan.md`, and record
    `023-m2-path-integration-convergence-plan`.
  - Verification: compare each candidate packet against a higher-resolution
    reference packet using max absolute and relative spectral radiance and
    transmittance deltas. Include low-altitude near-horizon rays, rays that
    exit through the observer-centered dome boundary, historical no-hit capped
    diagnostics, toward-source and away-source rays, source-path top/ground
    clipping cases, near-top-boundary rays, and cache-domain-edge samples.
    Promote only the smallest runtime packet with a named tolerance and a
    validation/reference packet with visible headroom.

- Stage 2.4.2: Run geometry ray-length and long-sightline convergence.
  - Code: add or extend a convergence runner that compares representative sky
    rays and source paths across finite-domain policies: supplied flat
    top/ground planes, observer-centered spherical dome, optional radial map
    extent, map-centered dome as an explicit alternate profile, source-owned
    finite path limits, supplied scene/hit/max distances, historical
    round-equivalent caps, and any scalar no-hit caps retained only as
    diagnostics. The accepted M2 skydome path should treat the
    observer-centered dome as geometry-owned atmosphere exit, with no scalar
    cap participating in source paths, cache bounds, or final atmosphere
    extent. Distant-source paths have no finite source-distance candidate; they
    end at the active medium/domain exit unless an explicitly named transport
    contribution cutoff is being tested outside geometry. Record each
    candidate distance and the selected boundary reason.
    Record the derived per-ray extent from `tDome = -b + sqrt(b^2 - c)` and,
    for renderer diagnostics, the equivalent zenith-angle extent
    `tDome(theta) = -h * cos(theta) + sqrt(R^2 - h^2 * sin(theta)^2)`.
  - Files/classes: add a focused finite-domain/cutoff runner under `runners/`
    or extend the path-convergence runner with a clearly separated mode;
    update diagnostics types only as needed for finite-domain descriptor, dome
    height, `maxObserverViewRayExtentMeters`, derived sphere center/radius,
    plane candidates, sphere candidates, map-extent candidates, source-limit
    candidates, supplied max-distance candidates, selected exit reason, cap
    distance when a diagnostic cap is tested, ray kind, spectral deltas,
    rendered-display deltas if used, and runtime-boundary diagnostics.
  - References: records `020-m2-cutoff-tolerance-justification`,
    `022-m2-general-runtime-boundary-policy`, `023-m2-path-integration-convergence-plan`,
    and the blue-ring diagnostics from records `037` through `039`; rows
    `ext-003`, `ext-015`, and `ext-018` in
    `m2-calibration-and-evidence-plan.md`.
  - Verification: compare spectral radiance/transmittance across increasing
    diagnostic caps, supplied boundary candidates, source-path limits, map
    extents, and the derived observer-centered dome exit, especially
    near-horizon rays around the previously observed sharp rim transition and
    source paths near ground/top/dome exits. Confirm nearest-candidate
    selection is deterministic and the extent progression is smooth from
    zenith to horizon except at real geometry boundaries. Confirm any
    falloff/transmittance/density-based contribution cutoff is reported as a
    separate execution approximation and does not alter geometry candidate
    distances. Select any display or diagnostic cutoff tolerance from spectral
    convergence first, with human-visibility/display checks only as secondary
    support after display assumptions are named.

- Stage 2.4.3: Run coordinate handoff and runtime-boundary diagnostics.
  - Code: add selected-ray diagnostics that prove geometry produces the
    atmosphere, source-relative, source-path, and cache-access facts needed by
    the active light source/cache without exposing raw flat coordinates to the
    light source or transport.
  - Files/classes: add or update diagnostics helpers under `geometry/`,
    `incident-radiance/`, or `runners/`; keep complex packets in ambient
    `types.d.ts` files. Add the bounded runtime diagnostics sink if it is not
    already present.
  - References: records `019-m2-atmosphere-boundary-ownership`,
    `021-m2-poc-runtime-boundary-diagnostics`, and
    `022-m2-general-runtime-boundary-policy`; rows `ext-011`, `ext-014`, and
    `ext-015` in `m2-calibration-and-evidence-plan.md`.
  - Verification: setup incompatibilities fail before the run; unexpected
    per-sample boundary conditions log bounded diagnostics and return safe
    operation-specific contributions. Diagnostics show coordinate ownership
    and enough facts to reproduce failures.

- Stage 2.4.4: Run local cache direct/oracle and edge checks if local L2 is
  enabled before asset generation.
  - Code: build the local incident-radiance cache through the generic
    coordinator, compare sampled/cache values to direct/oracle calculations at
    representative and edge coordinates, and classify any cache misses or
    descriptor gaps before image generation.
  - Files/classes: add `LocalSunIncidentRadianceCache.js` only when the local
    cache family is implemented; add a focused cache runner under `runners/`;
    update incident-radiance diagnostics types for descriptor fingerprints,
    cache domain, edge coordinate, lookup policy, and sampled deltas.
  - References: rows `ext-012`, `cache-001` through `cache-005`,
    `post-step032-lane-source-audit.md`, and the cache-builder sections of
    `algorithm32-abstraction-design.md`.
  - Verification: cache setup descriptor mismatches reject before the run;
    runtime misses use the bounded diagnostic policy; accepted cache
    coordinates match direct/oracle calculations within a named tolerance or
    are explicitly classified before asset generation starts.

#### Subgoal 2.5: Local/Flat Asset Generation And Diagnostics

- Stage 2.5.1: Generate rotation skydome diagnostic comparisons.
  - Code: generate comparable skydome outputs for the Step 018 rotation views
    and write image metrics plus selected-ray diagnostics. Once the
    observer-centered dome ray-extent rule replaces the scalar cap, generated
    artifacts are expected to differ from atmosflat Step 018. The images are
    subjective viewing aids for spotting possible model or computation errors,
    not canonical exact-match artifacts.
  - Files/classes: add a Step 018 skydome renderer/output class under
    `outputs/`, such as `outputs/Step018SkydomeImageWriter.js`, and reuse the
    image comparison module; update output and comparison types for local/flat
    scene descriptors without adding display/color work to transport.
  - References:
    `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes` and
    `scripts/flat/atmosflat32/`.
  - Verification: use image metrics to locate and explain differences rather
    than as an exact acceptance gate. Split verification into objective
    packet/math checks, selected-ray diagnostics, convergence or sensitivity
    checks where relevant, deterministic image-regression guidance, and
    labeled subjective review. Subjective review should look for signs of
    model/computation error such as abrupt rim bands, asymmetric artifacts
    unexplained by source placement, discontinuities between neighboring rays,
    or impossible source-direction behavior.

- Stage 2.5.2: Generate San Jose-longitude summer-solstice latitude skydomes.
  - Code: add a second local/flat skydome scene set without replacing the
    Step 018 rotation set. Use the same longitude as the San Jose fixture,
    observer latitudes `80N`, `30N`, equator, `30S`, and `80S`, and the
    closest false-Sun approach on summer solstice for each sky dome. Resolve
    the source latitude through the documented `annual-tropic-migration`
    setup at `2026-06-21T12:00:00-07:00` before applying the
    closest-horizontal-approach rotation. Calibrate brightness once at the
    same latitude as the resolved source latitude, using the San Jose
    longitude as the reference meridian, and reuse that one calibration for
    all five sky dome images. This set has no Step 018 guide images and is
    subjective model-inspection material.
  - Files/classes: update `constants/consts.js` and `constants/types.d.ts`
    with a named scene set such as
    `san-jose-longitude-summer-solstice-latitude-sweep`; update
    `runners/m2LocalFlatAssets.js` so the current Step 018 rotation set
    remains the default while the new set can be selected with
    `--scene-set san-jose-longitude-summer-solstice-latitude-sweep`.
  - References: M2 local/flat scene configuration rows in
    `local-sun-flat-geometry-fact-inventory.md`, especially view placement,
    north-polar AEQD projection, annual tropic-migration false-Sun latitude,
    summer-solstice date resolution, subsolar/source-latitude brightness
    calibration, and closest-approach calibration. This is a subjective review
    set, not a new external validation target.
  - Verification: before rendering, verify the scene set exports five scenes,
    includes the requested latitudes and San Jose longitude, resolves the
    source latitude to `23.5 deg N` through the migration model for the
    summer-solstice date, calibrates brightness once at that `23.5N`
    reference latitude, reuses the resulting reference spectral incident scale
    for all five scenes, and does not request guide-image comparison. When
    rendered, each CLI invocation still gets its own fresh numbered record
    folder and live `run.log` progress.
  - Current record: rendered in
    `tmp/atmosphere/reconciliation/043-m2-summer-solstice-latitude-skydomes`
    as five full-size 320px PNGs with no guide-image comparison target.

- Stage 2.5.3: Generate synchronized-noon flat/spherical latitude skydomes.
  - Code: add a reusable north-up scene set using the same San Jose longitude
    and observer latitudes as Stage 2.5.2, but render every row at the same
    synchronized solar-noon time by placing the source subpoint longitude on
    the common meridian. Reuse the same source-latitude brightness
    calibration. Render both the finite local-source flat skydome and the
    matching distant-source spherical skydome for each observer latitude, then
    build a final two-column stack with flat on the left and spherical on the
    right.
  - Files/classes: update `constants/consts.js` and `constants/types.d.ts`
    with the named scene set
    `san-jose-longitude-summer-solstice-synchronized-noon-latitude-sweep`,
    including spherical comparison fields and explicit north-up metadata; add
    `runners/m2SynchronizedNoonFlatSphericalSkydomes.js` to render the paired
    images and stack.
  - References: Stage 2.5.2, record
    `043-m2-summer-solstice-latitude-skydomes`, north-polar AEQD projection
    and local frame facts in `local-sun-flat-geometry-fact-inventory.md`, and
    the source-latitude brightness calibration tracked in
    `m2-calibration-and-evidence-plan.md`.
  - Verification: before rendering, verify the set exports five scenes with
    latitudes `80N`, `30N`, equator, `30S`, and `80S`, a single San Jose
    longitude, a single source subpoint longitude equal to that longitude, a
    source latitude of `23.5N`, shared calibration scale, `skyOrientation:
    north-up`, and `horizontalFrame: observer-local-east-north-up`. During
    rendering, write live `run.log` row progress, assert all ten source PNGs
    and the final stack are nonempty, and preserve visual inspection notes
    such as the expected dark spherical 80S row when the distant Sun is below
    the spherical horizon.
  - Current record: rendered in
    `tmp/atmosphere/reconciliation/044-m2-synchronized-noon-flat-spherical-skydomes`
    as five full-size flat PNGs, five full-size spherical PNGs, and
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

- Stage 2.5.4: Generate Greenwich-noon flat/spherical latitude skydomes.
  - Code: add a Greenwich-noon synchronized-clock comparison variant so the
    observer/render longitude remains San Jose, but the render time is
    synchronized to solar noon at longitude `0`. This moves the source
    subpoint off the San Jose meridian and prevents the Sun from appearing
    only straight north/south in the north-up skydome. Render both flat and
    spherical skydomes, and label each image in the stack with the Sun
    azimuth and altitude.
    This was temporarily the reusable default and is superseded by Stage
    2.5.5.
  - Files/classes: update `constants/consts.js` with the named scene set
    `san-jose-longitude-summer-solstice-greenwich-noon-latitude-sweep`; update
    `runners/m2SynchronizedNoonFlatSphericalSkydomes.js` so this scene set is
    available as a synchronized-clock option and was temporarily the default,
    so spherical direction uses the configured subsolar longitude, and so the
    stack SVG labels every flat and spherical source image with Sun azimuth
    clockwise from north plus altitude above the horizon.
  - References: Stage 2.5.3, record
    `044-m2-synchronized-noon-flat-spherical-skydomes`, north-polar AEQD local
    east/north/up frame facts, and the user request to synchronize the clock
    at longitude `0` while keeping the render longitude at San Jose.
  - Verification: before rendering, verify the set exports five scenes with
    San Jose observer longitude, source subpoint longitude `0`, source
    latitude `23.5N`, shared brightness calibration, north-up orientation, and
    non-meridian flat Sun azimuths. During rendering, write live `run.log`
    row progress, assert all ten source PNGs and the final stack are nonempty,
    and assert each stacked image has an azimuth/altitude caption. Visual
    inspection should confirm the Sun is off the vertical meridian and that
    dark spherical rows correspond to below-horizon distant-source altitudes.
  - Current record: rendered in
    `tmp/atmosphere/reconciliation/045-m2-greenwich-noon-flat-spherical-skydomes`
    as five full-size flat PNGs, five full-size spherical PNGs, and the
    captioned two-column stack
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

- Stage 2.5.5: Generate 45-degree-east-noon flat/spherical latitude skydomes.
  - Code: add a second off-meridian synchronized-clock scene set where the
    observer/render longitude remains San Jose (`-121.8863`), but the
    synchronized solar-noon/source-subpoint longitude is 45 degrees east at
    `-76.8863`. Make this set the reusable default so the Sun is off the
    image's north/south meridian while the spherical distant Sun remains
    above the horizon through the `30S` row.
  - Files/classes: update `constants/consts.js` with
    `M2_LOCAL_FLAT_45_DEGREE_EAST_SOLAR_NOON_LONGITUDE_DEGREES`, the generated
    scene list, and the named scene set
    `san-jose-longitude-summer-solstice-45east-noon-latitude-sweep`; update
    `runners/m2SynchronizedNoonFlatSphericalSkydomes.js` so this scene set is
    the default.
  - References: Stage 2.5.4, the offset sweep showing 45 degrees east keeps
    the spherical Sun above the horizon through `30S`, and the user request
    to set that longitude for the reusable set.
  - Verification: before rendering, verify the set exports five scenes with
    San Jose observer longitude, source subpoint longitude `-76.8863`, source
    latitude `23.5N`, shared brightness calibration, north-up orientation,
    and off-meridian Sun captions. During rendering, write live `run.log`
    row progress, assert all ten source PNGs and the final stack are nonempty,
    and visually inspect that the Sun is off vertical and `30S` is lit in the
    spherical column.
  - Current record: rendered in
    `tmp/atmosphere/reconciliation/046-m2-45east-noon-flat-spherical-skydomes`
    as five full-size flat PNGs, five full-size spherical PNGs, and the
    captioned two-column stack
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`.

- Stage 2.5.6: Generate North Pole GMT four-hour flat/spherical skydomes.
  - Code: add a synchronized-clock time-sweep scene family. The first rendered
    set uses latitude `90N`, longitude `0`, date `2026-06-21`, UTC rows every
    four hours from `00:00 GMT` through `20:00 GMT`, and source subpoint
    longitude derived by `12:00 GMT -> 0` with `15 deg/hour` rotation. The
    follow-up rendered set uses latitude `90S`, longitude `0`, date
    `2025-12-21`, with the same UTC row cadence.
  - Files/classes: update `constants/types.d.ts` with optional time-sweep
    metadata fields; update `constants/consts.js` with polar render
    constants, the North/South GMT four-hour scene sets, synchronized-clock
    calibration helpers, and the UTC-hour source-longitude conversion; update
    `runners/m2SynchronizedNoonFlatSphericalSkydomes.js` so synchronized-clock
    scene sets can have arbitrary row counts and optional time row labels.
  - References: Stage 2.5.5, the local solar-noon-at-source-latitude
    calibration policy, and the user requests for the North Pole June 21 2026
    GMT sweep plus the South Pole winter 2025 variant.
  - Verification: before rendering, verify the North set exports six scenes
    with observer `90N/0`, source latitude `23.5N`, source longitudes `180`,
    `120`, `60`, `0`, `-60`, and `-120`, shared source-latitude brightness
    calibration, north-up orientation, and time row labels. Verify the South
    set exports the same UTC cadence for `90S/0` on `2025-12-21`. During
    rendering, write live `run.log` progress, assert all twelve source PNGs
    and the final stack are nonempty, and visually inspect that the Sun
    rotates around the stack with time labels and azimuth/altitude captions.
  - Current records: North Pole rendered in
    `tmp/atmosphere/reconciliation/047-m2-north-pole-summer-solstice-gmt-sweep`
    as six full-size flat PNGs, six full-size spherical PNGs, and the
    captioned two-column stack
    `artifacts/flat-spherical-synchronized-noon-north-up-stack.png`; South
    Pole rendered in
    `tmp/atmosphere/reconciliation/048-m2-south-pole-winter-solstice-gmt-sweep`
    with the same artifact shape.

#### Subgoal 2.6: Local CPU Record Closeout

Current status: complete in
`tmp/atmosphere/reconciliation/050-m2-closeout`.

- Stage 2.6.1: Record partial verification.
  - Code: write a numbered record with component-by-component pass/fail status
    for geometry, source packets, transport, display conversion, and images.
  - Files/classes: update record-writing utilities and the M2 numbered record
    files; no new domain class should be introduced solely for reporting.
  - References: `experimental-guidelines.md` validation tiers and local-source
    evidence rows in `post-step032-lane-source-audit.md`.
  - Verification: no local/flat acceptance claim is broader than its evidence.

- Stage 2.6.2: Update current-state notes.
  - Code: update the POC `CURRENT_STATE.md`, reconciliation `status.md`,
    README handoff links as needed, and the running log.
  - Files/classes: update `POC/CURRENT_STATE.md`,
    `agents/topics/apps/flat/reconciliation/status.md`,
    `agents/topics/apps/flat/reconciliation/README.md`, and relevant status
    docs; create no runtime classes.
  - References: the latest numbered Milestone 2 record.
  - Verification: current-state notes identify accepted local/flat pieces,
    unresolved facts, and the next GPU prerequisites.

Exit criteria:

- Status: satisfied for the Milestone 2 POC by record `050-m2-closeout`.
  Remaining production/shader requirements are tracked outside the M2
  acceptance claim.
- CPU reference local/flat behavior passes the method-confidence record:
  geometry, source, atmosphere, cache, and transport handoffs are explicit,
  bounded, and verified. Any remaining scalar no-hit cap is classified as a
  diagnostic/display policy, while the model atmosphere exit is the finite
  observer-centered dome geometry for skydome inspection, or another explicit
  finite-domain profile when selected. Reflective dome behavior remains a
  future extension, not part of M2 local/flat acceptance. Step 018 sky-dome
  images may guide subjective visual review, but once ray-extent exits replace
  scalar caps they are not expected to match and are not exact-match criteria.
- Verification records distinguish source-backed equations, accepted
  artificial-model decisions, subjective visual acceptance, and unresolved
  source gaps.
- Every local-source and flat-geometry reference gap encountered during M2 is
  resolved, deliberately classified as model/display/fixture policy, or
  explicitly left unresolved with no milestone acceptance claim depending on
  it.
- Current-state notes identify which local/flat pieces are accepted and which
  remain open for production/shader work.

## Milestone 3: GPU Distant Sun, Spherical Earth

Goal: produce integrated GPU shader parity for spherical Earth and distant Sun
against the settled objective scene claims, with CPU soft-shader and GPU shader
runs sharing the same scene inventory. CPU-vs-GPU comparison is secondary
consistency and mismatch-classification evidence.

Primary work:

- Treat validated CPU/display behavior as callable baseline, not material to
  reimplement. M3 adapters, runners, descriptors, and comparison helpers may
  use only public `evaluate(...)`, already implemented configuration
  endpoints, and the validated Bruneton-based dome rendering color adapter for
  baseline work. They must not call lower-level algorithm, calculator, cache,
  geometry, source, or atmosphere internals, and they must not recreate
  copied, derived, or approximate baseline behavior. New GPU GLSL is the
  implementation under test; it must not become the CPU/reference baseline.
- Build the CPU postprocess soft-shader first. It must consume scene inputs
  and compose all pixels as `endpointRadiance * T_view + L_path`, where
  geometry decides whether the resolved ray endpoint has surface radiance or
  exits the atmosphere with no endpoint contribution. All atmosphere
  calculation must route through the public reconciliation `evaluate(...)`
  operation. The soft-shader must not call `SpectralCalculator`, geometry,
  atmosphere, light-source, cache, or other algorithm internals independently.
  Shader output packets are outputs for comparison and diagnostics, not the
  CPU soft-shader input contract. Shader-lab and local-second-order code are
  references for scene-input and composition shape, not substitute transport
  implementations.
- Design the GPU validation scene set immediately after the CPU soft-shader
  scene-input contract. The scene inventory must include objective/hypothesis
  scenes with specific expected facts, and separate subjective review scenes
  for plausibility inspection. Both categories should be reusable by CPU
  postprocess and GPU shader runs. Objective tests are the primary gate for
  both implementations and should be grouped into themed composite scenes where
  one long CPU soft-shader run can prove multiple related facts without making
  the artifact too cluttered to understand.
  Subjective review scenes should borrow the
  latest accepted local-second-order Southern France mesh lineage. The first
  GPU review gallery must carry the accepted no-shadows Southern France OBJ
  diffuse source-matrix rows `070` through `073`. The Southern France mesh
  lineage is no-shadow only because the mesh already contains baked
  shadow/detail and is not built well enough for shadow validation. Preserve
  the fitted
  local-angle rows `077` through `079`, local vertical stack `080`, and
  optional star-field stack `086` as local/flat follow-on review scenes unless
  a nearer GPU review need pulls them forward.
- Build the shader path from the CPU reference contracts: descriptors, shader
  source assembly, uniforms, textures, cache-owned texture/access assembly,
  display conversion, and
  diagnostics. Use the implementation inventory in
  `shader-design.md#initial-implementation-inventory` as the design-side
  reference for planned files/classes.
- Implement or adapt a long-running browser process following the local-Sun
  experiment model: it watches for JSON job files to open, writes an updating
  progress log for liveness, may compare in-memory buffers, and saves every
  retained visual artifact as a PNG file.
- Recreate the useful shader-lab style execution shape, but make the objective
  scene claims the primary gate for both CPU soft-shader and GPU shader runs.
  Comparing those two outputs is secondary consistency evidence.
- Record WebGL/browser capabilities, shader defines, packed payload metadata,
  precision policy, and image comparison criteria.

### Major Subgoals And Primary Stages

#### Subgoal 3.1: CPU Postprocess Soft-Shader

Current status: Stages 3.1.0 through 3.1.2 are complete. The CPU
postprocess soft-shader contract and implementation now exist under
`soft-shader/`, with spectral-to-display conversion owned by the
`ColorDisplayModel` implementation under `color/`. The next planned Stage
3.1 work is Stage 3.1.3, building the Three scene bridge for
shader-lab/local-second-order scene setup lineage.

- Stage 3.1.0: Itemize hit data ownership before coding the scene-input
  contract.
  - Code: no runtime transport code yet. Maintain the actual itemization and
    routing contract in
    `shader-design.md#hit-data-itemization-and-routing`. That design section
    must completely itemize every hit-related datum that can enter the CPU
    soft-shader or GPU shader path, name its units and coordinate frame,
    declare the owning abstraction or boundary in descriptor/setup
    configuration, and state whether the adapter turns it into typed
    `evaluate(...)` request data, consumes it in geometry,
    color/display/postprocess composition, or rejects it. The itemization must
    cover at least: hit present/absent state, hit distance/depth,
    world/geometry-space hit position, ray parameter, surface normal if
    available, object/material id, opacity/alpha, captured RGB/albedo,
    emitted radiance, reflected radiance policy, matte/Lambertian albedo
    policy, spectral reference id,
    confidence/provenance flags, invalid/out-of-range depth, and atmosphere
    exit/no-hit classification. Record matte/Lambertian color as the settled
    first POC endpoint policy: linear matte albedo modulates surface
    irradiance as `albedo * irradiance / PI`, then composes after
    `evaluate(...)` as `endpointRadiance * T_view + L_path`. Record the hard
    boundary that RGB,
    scene color, material color, and other display-domain color values must
    never enter `evaluate(...)`. Record the matching ownership rule that every
    color conversion belongs to the color abstraction, including
    RGB-to-spectrum inverse fitting, spectral-to-display conversion, tone
    mapping, encoding, and color-space diagnostics. Record the follow-up
    inventory of Three.js surface facts as non-blocking for the first
    implementation, including material color, texture/vertex albedo, normal,
    roughness, metalness, emissive color/intensity, opacity, alpha-test state,
    light maps or baked illumination, shadowing, environment reflection, and
    object/material id; classify each as physical input, diagnostic data, or
    renderer-specific approximation with an owning abstraction. Mine the current soft-shader
    implementation as reference evidence: it sends hit mask and hit distance
    into transport, then applies either spectral fixture composition or
    captured-RGB display postprocess after transfer computation.
  - Files/classes: update `shader-design.md` as the canonical design home for
    the hit-data inventory and ownership table, update
    `algorithm32-abstraction-design.md` if the `evaluate(...)` request or
    geometry handoff contract changes, and add or update ambient POC
    `types.d.ts` names only if the design pass settles a concrete packet
    shape. Do not add shader/soft-shader runtime code until the ownership
    table is accepted.
  - References: `shader-design.md#cpu-postprocess-shader`,
    `algorithm32-abstraction-design.md` scene-intersection handoff notes,
    shader-lab scene-input references, local-second-order scene-input
    references, and the current Bruneton-based color adapter trail for
    display-only conversion.
  - Verification: the design pass is accepted only when every hit datum has
    exactly one owner or is explicitly rejected, no datum is implicitly handled
    by generic transport, geometry receives only spatial/occlusion facts,
    color abstraction receives any endpoint facts that require color
    conversion only through a named endpoint policy. The accepted first
    implementation conclusion is geometry-only `evaluate(...)` input with
    display-owned captured scene-color endpoint composition after transport.
    Postprocess receives captured hit color beside the spatial hit facts for
    this diagnostic scene-color path; only ray and finite hit distance enter
    `evaluate(...)`.
    Objective scenes resolve endpoint spectral radiance from a small canonical
    fixture table keyed by `spectralReferenceId`; direct per-scene spectral
    authoring is only for adding or diagnosing a fixture, and material-id
    lookup is a later production policy. Physical matte/Lambertian endpoint
    radiance remains a separate named policy, not the current hit-color
    mechanism. For scene-hit
    handling, `evaluate(...)` receives only typed spatial/domain fields such as
    scene-intersection context or ray distance, never endpoint spectral
    contribution, caller-visible owner/route metadata, or RGB/display color.
    The
    spectral-vs-RGB conversion decision is recorded with the validation
    evidence needed before implementation.

- Temporary divergence 3.D1: introduce endpoint contribution into the
  local-second-order sunrise-to-sunset subjective scene path.
  - Code: update the installed local-second-order GPU shader path so scene
    color is composed before tone mapping. The current divergence uses
    captured scene color as an endpoint-radiance proxy by applying the inverse
    of the installed shader tone map, then composing:
    `skyLinearSrgb + sceneEndpointLinearSrgb * transmittanceRgb`, followed by
    the existing tone map. For the current reconciliation CPU hit-color task,
    this local-second-order behavior is the canonical diagnostic scene-color
    mechanism to mirror outside `evaluate(...)`; it is not an RGB-to-spectrum
    endpoint-radiance reconstruction. The first direct
    `0..1` captured-linear proxy render looked overly blue; preserve it as
    record `096-*` evidence. The inverse-tone-map same-scene rerun is record
    `097-*` and looked much more plausible in review. Keep this in the
    local-second-order experimental lane or a clearly labeled reconciliation
    divergence record; records `218` through `220` now mirror this behavior
    in the POC CPU soft-shader path.
  - Files/classes: mine and update only the current subjective scene/compositor
    path under `scripts/flat/local-second-order/` or the equivalent latest
    copied reconciliation experiment harness. Add a numbered output record
    with `run.log`, scene descriptors, selected settings, and rendered PNGs.
  - References: latest accepted local-second-order subjective scene records,
    `shader-design.md#hit-data-itemization-and-routing`, and the matte
    endpoint policy documented in this action plan.
  - Verification: produce the updated
    `with-shader-distant-local-sunrise-sunset-side-by-side` subjective scene
    image for review using only the installed GPU shader. This is the
    artifact-092 lineage: spherical distant Sun on the left, flat local Sun on
    the right, and five daylight rows from sunrise to sunset. Label the output
    as visual/plausibility evidence only, and record whether the endpoint
    proxy makes scene-object color contribution more visible. Record `097-*`
    is the current plausible visual-review result. A closer-camera diagnostic
    remains optional follow-up evidence, but it should be separate from the
    apples-to-apples proxy rerun. This divergence is not required for progress
    on the first reconciliation implementation, but it can inform scene
    selection and diagnostics.

- Stage 3.1.0a: Objectively test endpoint contribution strength only if
  matte/Lambertian evidence is insufficient.
  - Code: start with a research precheck before writing an experiment runner.
    Treat Bruneton 2017 and the accepted Step 032 Bruneton-based color adapter
    as the primary authority for the computer-science/rendering side of
    endpoint radiance composition: `endpointRadiance * T_view + L_path`, then
    final radiance-to-display conversion. Bruneton handles this at the
    physical radiance/irradiance/reflectance level; he does not define a
    policy for arbitrary renderer RGB material ingestion. Use broader
    color-science references mainly to determine whether RGB-derived endpoint
    spectra are underdetermined without priors. The current scene-color
    implementation goal is already covered by the local-second-order captured
    scene-color composition path; physical matte/Lambertian endpoint color is
    a separate named policy. If spectral endpoint evidence becomes necessary, add
    a CPU-only numbered experiment runner that uses the current soft-shader
    lineage to compare controlled hit scenes with endpoint contribution
    enabled, disabled, and varied. Start with a canonical spectral fixture
    table keyed by `spectralReferenceId`: zero/black, neutral
    low/medium/high, red-biased, green-peaked, blue-biased, and a broad
    warm/ground-like fixture. Historical shader-lab red/green/blue/ground
    curves can seed expectations, but the reconciliation POC should store
    fixture values explicitly over `CANONICAL_SPECTRAL_CHANNELS` rather than
    importing old functions. Add captured RGB fixtures only as diagnostic
    comparison cases, plus near/far hit distances and matching sky/no-hit
    controls. The experiment must
    specifically determine whether the matte/Lambertian policy is sufficient
    or whether canonical spectral fixtures, RGB-to-spectrum/material, or
    diagnostic display-domain endpoint policies are needed.
  - Files/classes: add the runner under `POC/src/runners/` or
    `POC/src/comparison/` only when ready to execute; emit selected-pixel
    diagnostics and comparison summaries into a numbered record folder with
    `run.log`. Do not add RGB-to-spectrum inverse fitting here unless Stage
    3.1.0b is also active.
  - Experimental data to collect: hit/no-hit classification, hit distance
    meters, reconstructed hit position when available, endpoint class,
    `spectralReferenceId`, invalid depth/out-of-range status, captured RGB
    values for diagnostic cases, canonical fixture spectral radiance,
    disabled-endpoint value, endpoint-only contribution, evaluator path
    radiance by spectral channel, evaluator view transmittance by spectral
    channel, any diagnostic display-space transmittance reduction,
    endpoint-disabled output, endpoint-enabled output, post-spectral
    color-composed output, final spectral radiance when available, final
    display RGB/RGBA, expected rendered-pixel RGB/RGBA derived from the
    canonical fixture spectrum through the validated Bruneton-based color
    adapter, observed CPU soft-shader RGB/RGBA, observed GPU shader RGB/RGBA
    when available, per-channel and selected-pixel or controlled-region deltas
    between enabled and disabled controls, max/mean/percentile display deltas,
    selected-pixel contrast ratios, monotonicity across near/far hit distances,
    saturated-fixture separability after atmosphere, fixture-to-rendered-pixel
    propagation status, and scene classification result.
  - Record metadata: scene descriptor id, tested claim, surface policy,
    source/geometry/atmosphere/cache descriptors, camera/ray setup, selected
    pixel ids, command/provenance, adapter/display constants identity, numeric
    tolerances, known limitations, and `run.log` progress.
  - References: `shader-design.md#hit-data-itemization-and-routing`,
    `shared/algorithm32/POC/cpu/soft-shader.js`,
    `scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js`,
    local-second-order subjective scene notes that raised the concern,
    Bruneton 2017 implementation documentation and the accepted Step 032
    color-adapter trail as the primary rendering references, plus
    CIE/colorimetry or metamerism references and RGB-to-spectral reconstruction
    survey material only if inverse fitting remains under consideration.
  - Verification: selected-pixel diagnostics must report path radiance,
    view-path transmittance, endpoint contribution before composition, final
    output, deltas against endpoint-disabled controls, and a rendered-pixel
    propagation check proving the canonical fixture's expected spectral values
    produced the expected display pixels after color conversion, tone mapping,
    encoding, and readback. The record should classify whether geometry-only
    hit input is sufficient for the first contract, whether matte/Lambertian
    endpoint radiance is sufficient, whether canonical fixture spectral
    endpoint radiance is sufficient for objective scenes, whether captured RGB
    contribution remains diagnostic only, and whether any RGB-to-spectrum
    policy must be designed. If the stage is unnecessary for the current
    captured scene-color implementation, verification is the recorded evidence
    trail plus the explicit no-experiment-needed classification.

- Stage 3.1.0b: Experimentally select inverse-fit RGB-to-spectrum constraints
  for the matte material-color endpoint path.
  - Prerequisite: the scene-input contract must keep RGB/display color outside
    `evaluate(...)` and route renderer material color through the color
    abstraction as a post-transport endpoint policy. Stage 3.1.0a does not
    need to reopen the geometry-only hit-input decision before this runs.
  - Code: add or reuse a numbered experiment runner when validating the
    color-abstraction policy. The experiment should use the
    validated Bruneton-based spectral-to-display adapter as the forward
    function, generate candidate endpoint spectra from target RGB/display
    colors, forward-convert those spectra back through the adapter, and report
    reconstruction error, spectral shape, energy behavior, and stability. This
    is a color-abstraction experiment, not a soft-shader or transport
    experiment. Each CLI run is a separate numbered experiment folder with its
    own inputs, diagnostics, criteria, and `run.log`.
  - Files/classes: add a focused runner under `POC/src/runners/` or
    `POC/src/comparison/` only when this experiment is ready to run; reuse the
    existing color adapter directly and avoid adding runtime soft-shader or GPU
    code. Add ambient type names only for experiment packets that will become
    candidate production contracts.
  - References: `shader-design.md#hit-data-itemization-and-routing`,
    `shader-design.md#display-and-composition-policy`, the current
    Bruneton-based color adapter trail, and accepted Step 032 display
    rendering records.
  - Verification: the record must compare candidate fit policies such as
    nonnegative channels only, nonnegative plus smoothness, energy-bounded fit,
    material-prior fit, and fixture-table fit where applicable. Acceptance for
    the design step is not visual preference; it is a documented policy choice
    with reconstruction error thresholds, rejected color cases, stability
    diagnostics, and a clear statement of whether the policy is acceptable for
    objective tests, subjective previews, production endpoints, or none.

- Stage 3.1.1: Define the scene-input adapter contract.
  - Code: add CPU postprocess scene-input/request/result types, scene-color
    policy names, selected-pixel diagnostics, aggregate counters, bounded
    problem-focused diagnostic modes, and source/geometry descriptor handoff
    fields. Include scene intersection facts or a scene-intersection
    provider shape that `evaluate(...)` can pass to geometry for view-ray
    segmentation and, later, source/light path occlusion. Include endpoint
    surface/color/material contribution facts as a separate post-transport
    handoff to the endpoint/color policy: canonical spectral fixture endpoint
    radiance for objective scenes, matte/Lambertian albedo-to-radiance,
    RGB-to-spectrum/material conversion when explicitly selected, or
    diagnostic display-space composition only when the scene contract selects
    that diagnostic path.
    Record the general rule
    that scene-derived effects are owner-routed by descriptor/setup
    configuration, then compiled by the adapter into typed request fields or
    composition inputs. `evaluate(...)` should not receive caller-supplied
    owner/route labels or RGB/display color, and transport should not branch
    on scene effects. The
    diagnostic contract must not emit full per-rendered-pixel packets; use
    selected-pixel packets, aggregates, and explicitly bounded probes when
    investigating a specific problem. The
    input format should be compatible with the shader-lab
    `postprocessSceneInput(...)` shape, but owned by the reconciliation POC.
    Keep shader output packet shapes out of this input contract; they are
    produced by the shader/comparison path for diagnostics and parity.
    Soft-shader executable profile support follows milestone needs: first pass
    should implement the active milestone profile, starting with
    distant/spherical for M3, while preserving typed descriptor space for later
    local/flat rows. Scene input source support follows
    `shader-test-design.md`: implement authored descriptors, serialized JSON
    fixtures, Three captures, or both according to what the accepted test
    scenes require before GPU objective runs depend on those scenes.
  - Files/classes: add `soft-shader/types.d.ts` and one default-export class
    such as `soft-shader/CpuPostprocessSoftShader.js` in a folder parallel to
    the GPU shader folder. Add comparison helpers under `comparison/` only for
    comparison logic, not for the soft-shader implementation itself.
  - References: `shader-design.md#cpu-postprocess-shader`,
    `shared/algorithm32/POC/cpu/soft-shader.js`,
    `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-iteration-plan.md#shared-soft-shader-contract`,
    and `agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md#milestone-3-cpu-soft-shader-module-parity`.
  - Verification: a scene-input-contract probe validates required fields,
    units, endpoint classification, scene-intersection handoff, scene-color
    policy, and diagnostic output shape without invoking GPU/browser code.
    It must prove that scene-intersection context is an additive evaluation
    parameter: absent context preserves existing no-hit behavior, present
    context is passed to geometry, endpoint surface/color/material facts are
    passed only to the composition/color boundary, no RGB/display color is
    present anywhere in the `evaluate(...)` request, and endpoint
    radiance/color is not part of the geometry handoff. Diagnostics are
    accepted only if their output is bounded: selected pixels, aggregate
    counters, summary metrics, controlled-region summaries, or explicitly
    requested targeted probes. The probe should fail any scene-derived
    contribution that has no declared owning abstraction. It should also prove
    the first implemented scene-input source matches the requirements of the
    accepted `shader-test-design.md` objective scenes, without requiring both
    JSON fixtures and Three captures until the scene set needs both.

- Stage 3.1.2: Implement the CPU soft-shader against the reconciliation CPU
  path.
  - Code: for each scene-input pixel, create the evaluation request from scene
    facts, call the public reconciliation `evaluate(...)` operation, and
    compose `endpointRadiance * T_view + L_path` from the evaluated spectral
    output. Do not call `SpectralCalculator`, geometry, atmosphere,
    light-source, cache, the old shader-lab transport, copied Algorithm32
    equation code, or legacy source/ray/cache shortcuts directly. Scene
    intersection facts are passed through the evaluation request so geometry
    resolves segmentation; endpoint surface/color/material facts stay outside
    geometry and are used only through the color/display or postprocess
    composition path.
  - Files/classes: add/update the CPU postprocess soft-shader class, add any
    narrow scene-input adapter helper, and invoke the existing M1/M2
    evaluator instead of adding duplicate transport code.
  - References: accepted M1 CPU distant/spherical records, accepted M2
    local/flat records, `shader-design.md#cpu-postprocess-shader`, and the
    current POC `CURRENT_STATE.md`.
  - Verification: deterministic CPU-only smoke inputs cover atmosphere-exit
    endpoints, finite surface endpoints, and the active milestone profile,
    starting with distant/spherical for M3. Diagnostics prove `evaluate(...)`
    was used and no lower-level algorithm internals were called by the
    soft-shader. Include at least one scene-object hit that shortens the
    geometry-resolved view segment through `evaluate(...)` and one matching
    no-hit case proving the additive parameter does not alter baseline sky
    rays. Verify diagnostics stay bounded and do not emit per-rendered-pixel
    packets. Local/flat execution is required when a local/flat milestone
    needs it; before then, descriptor/type support is sufficient.

- Stage 3.1.3: Build the Three scene bridge for shader-lab/local-second-order
  scene setup lineage.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge` for the
    Node-only Raycaster bridge and first controlled scene probe. Browser/GPU
    render-target scene input remains later shader-runner work.
  - Code: add a Three scene bridge that recreates or directly bridges the same
    representative scene setup lineage used by shader-lab and
    local-second-order, then captures the scene facts needed by the
    reconciliation CPU soft-shader. The bridge should derive camera/ray facts,
    selected pixels, hit/no-hit state, hit distance or depth, and endpoint
    classification from the Three scene setup, then convert those facts into
    `SoftShaderScenePixelInput`. Captured RGB/display facts may be retained as
    diagnostic or endpoint-policy evidence, but must not enter `evaluate(...)`.
    The goal is apples-to-apples scene setup and input fact comparison, not
    copying old transport results or treating historical shader output as
    truth.
  - Files/classes: add `three/types.d.ts` and a default-export bridge/gateway
    class such as `three/ThreeGateway.js` or
    `three/ThreeSceneSoftShaderBridge.js`; add a focused runner under
    `runners/` that builds the bridged scene, selects representative pixels,
    feeds them through `CpuPostprocessSoftShader`, and writes criteria/report
    records. Add comparison helpers only if the bridge logic would otherwise
    become hard to read.
  - References: shader-lab `094-cpu-unified-source-driven-soft-shader-matrix`,
    local-second-order `012-cpu-soft-shader-local-l2`,
    shader-lab/local-second-order Three scene setup code and subjective scene
    setup records,
    `post-step032-lane-source-audit.md`, and
    `shader-design.md#cpu-postprocess-shader`.
  - Verification: numbered record writes the bridged Three scene setup facts,
    selected-pixel scene inputs, captured hit/no-hit and depth facts,
    soft-shader diagnostics, finite output checks, and intentional difference
    classifications. It must prove finite hits become geometry-facing
    termination data, no-hit pixels remain no-hit, RGB/display facts stay out
    of `evaluate(...)`, diagnostics stay bounded, and the same scene setup
    lineage can be carried forward before the GPU validation scene inventory is
    built.

#### Subgoal 3.2: GPU Validation Scene Set

- Stage 3.2.1: Define reusable scene descriptors.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/059-m3-shader-scene-registry` for the seed
    inventory/registry. The accepted Node bridge row and planned objective
    rows `obj-001` through `obj-014` are listed, and every final numeric RGBA
    value is explicitly pending external fixture or external-source-backed
    record materialization.
  - Code: add scene descriptor types for validation scenes consumed by both
    the CPU postprocess soft-shader and GPU shader runner. The descriptors
    should name camera, viewport, source config, geometry config, atmosphere
    config, scene-color policy, selected pixels, expected diagnostic bands,
    data-source/provenance ids, extent coverage tags, expected display-pixel
    claims, and optional display fixtures such as stars. Keep rendered images
    and browser capture policy out of the descriptor itself. Use
    `shader-test-design.md` as the scene-construction target: objective
    descriptors must be built around deterministic pixel transformation, not
    only internal spectral packet checks.
  - Files/classes: add or update scene descriptor types in
    `scenes/types.d.ts`; add a JSON inventory such as
    `scenes/shader-scene-inventory.json` whose scene id strings carry useful
    metadata, objective test ids, provenance ids, selected-pixel ids, and
    extent tags, and can later resolve to code scene modules; add one
    default-export scene registry or scene-set class such as
    `scenes/ShaderSceneRegistry.js`. Scene descriptor code belongs under
    `scenes/`, while comparison logic remains under `comparison/`.
  - References: `shader-design.md#cpu-postprocess-shader`,
    `shader-test-design.md`,
    `scripts/flat/algorithm32-shader-lab/subjective-soft-vs-gpu-source-scenes.js`,
    `scripts/flat/local-second-order/page/subjective-scenes.js`, and
    local-second-order README/current notes for accepted subjective scenes.
  - Verification: descriptor-only probe lists every scene, confirms stable
    ids, validates required CPU/GPU inputs, confirms every objective scene has
    a data-source/provenance id and expected display-pixel claim, and rejects
    any scene that depends on live browser state before execution.

- Stage 3.2.2: Define objective and hypothesis-testing scenes.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/061-m3-objective-scene-criteria`. Every
    objective inventory row now carries explicit criteria naming the claim,
    measurement, owner, failure classification, and whether it is required
    before GPU objective runs. Final numeric RGBA values remain pending
    external fixture or external-source-backed record materialization.
  - Code: add scene descriptors whose purpose is to prove specific facts or
    isolate specific hypotheses before subjective review. Each scene should
    name the tested claim, the measured values, the expected invariant or
    tolerance, and the failure classification path. Start with distant/spherical
    scenes for M3 facts such as no-atmosphere passthrough, atmosphere-exit
    endpoint composition, finite surface endpoint composition, depth and
    endpoint-distance reconstruction, scene-intersection handoff through
    `evaluate(...)` into geometry, endpoint radiance remaining outside
    segmentation, source direction synchronization, horizon and high-altitude
    ray behavior, cache-on/cache-off contribution checks, and selected-pixel
    agreement with expected objective scene claims. Group related checks into
    themed composite scenes when one readable artifact can prove multiple
    facts and amortize CPU soft-shader time; split them when the output or
    diagnostics become cluttered. Each objective scene must specify how to
    build the scene, what pixels or controlled regions should change, and what
    rendered-pixel result proves the claim. The first inventory should cover
    the explicit test ids in `shader-test-design.md`: zero-atmosphere
    passthrough, display-adapter propagation, sky/no-hit atmosphere exit,
    finite endpoint near/mid/far, invalid depth log-and-continue,
    scene-intersection routing, spectral fixture wavelength bands, spectral
    basis extents, cache off/on contribution, cache boundary/miss behavior,
    horizon long paths, high-altitude atmosphere boundary, and retained PNG
    artifact/readback policy.
  - Files/classes: update the validation scene-set class, add objective scene
    criteria types, add the explicit objective inventory rows to
    `scenes/shader-scene-inventory.json`, and add any small deterministic
    fixture-scene descriptors needed to avoid relying on subjective terrain
    assets for fact checks. Add reconciliation-owned canonical spectral
    fixture data before any historical shader-lab endpoint curve becomes a
    gate.
  - References: M1 distant/spherical accepted records, shader-lab scene-input
    parity records, `shader-design.md#cpu-postprocess-shader`,
    `shader-test-design.md`, and `experimental-guidelines.md` for
    criteria/tolerance policy; `agents/topics/apps/flat/algorithm32/fixture-sources.md`
    for CIE, ASTM, U.S. Standard Atmosphere, Bucholtz, and controlled
    ray-path fixture provenance; and `agents/topics/apps/flat/algorithm32/conclusions.md`
    for the accepted 15-channel basis and Step 032 display trail.
  - Verification: scene inventory report lists every objective scene with its
    hypothesis, expected measurement, owner, data-source/provenance id,
    selected pixels or controlled regions, extent coverage, active milestone
    use, and whether it is required before GPU objective runs. The
    scene-intersection objective
    scenes must classify the additive parameter as validated only if no-hit
    rays match the old baseline, finite-hit rays clip at the geometry-resolved
    hit distance, endpoint color/material changes only postprocess
    composition, endpoint contribution facts are never visible to geometry,
    and canonical spectral fixture expectations are shown to propagate into
    rendered CPU/GPU pixels at selected pixels or controlled regions.

- Stage 3.2.3: Borrow and normalize subjective review scene lineage.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/062-m3-scene-set-completion`. The
    inventory records active first GPU review Southern France no-shadow rows
    `070` through `073`, deferred local/flat follow-on rows `077` through
    `080` and `086`, and an explicit exclusion for shadow-enabled Southern
    France variants.
  - Code: port the accepted subjective scene families as descriptors, not as
    runtime links to old lanes. These are for human plausibility review and
    regression galleries, not primary proof of physical or algorithmic facts.
    Start with the shader-lab subjective source cases needed for visual
    continuity, then add the must-carry local-second-order Southern France
    mesh subjective scenes. The first GPU review gallery carries the
    no-shadows Southern France OBJ diffuse source-matrix rows `070` through
    `073`. Treat the Southern France mesh lineage as no-shadow only; shadowed
    variants are intentionally excluded because baked mesh shadows would make
    shadow validation ambiguous. Preserve the fitted local-angle rows `077`
    through `079`, shader-only local vertical stack `080`, and optional
    star-field stack `086` as local/flat follow-on review scenes unless a
    nearer GPU review need pulls them forward.
  - Files/classes: update the validation scene-set class and any fixture
    constants or asset references needed to recreate the scenes inside the
    reconciliation POC.
  - References: local-second-order README accepted artifact notes for
    `070`-`073`, `077`-`080`, and `086`; shader-lab records
    `224-three-native-live-pass-soft-shader-matrix`,
    `227-postprocess-gpu-vs-integrated-shader-subjective-scenes`, and
    `shader-test-design.md#subjective-review-scenes`.
  - Verification: scene inventory report records Southern France mesh rows
    `070` through `073` as active for the first M3 visual review, records
    rows `077` through `079`, `080`, and optional `086` as deferred local/flat
    follow-on review scenes, records shadow-enabled Southern France variants
    as intentionally excluded, and records which historical subjective scenes
    are intentionally not carried forward. Reports must label these as
    subjective/plausibility scenes.

- Stage 3.2.4: Generate CPU soft-shader objective outputs for the scene set.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/062-m3-scene-set-completion`. The
    CPU-only scene-set completion probe generated provisional selected-pixel
    CPU soft-shader outputs for objective scenes with selected pixels and
    recorded zero expectation failures. Final numeric RGBA gates remain
    pending external fixture or external-source-backed record materialization.
  - Code: run or synthesize scene inputs for the initial validation scenes
    and process them through the CPU postprocess soft-shader from Subgoal 3.1.
    This creates CPU-side expected-output evidence for the same objective
    scene claims the GPU shader will run. Soft-shader-vs-GPU comparison is
    secondary consistency evidence; the primary gate is each implementation
    satisfying the objective scene claims. The input source is chosen by
    `shader-test-design.md`: authored deterministic descriptors or serialized
    JSON fixtures for analytic/objective scenes when sufficient, and Three
    captures when the scene family requires renderer-derived facts or
    validates `ThreeGateway`.
  - Files/classes: add a CPU-only objective-scene runner under `runners/`,
    using scene descriptors from `scenes/`, the CPU soft-shader from
    `soft-shader/`, and comparison/report helpers from `comparison/`.
  - References: accepted CPU soft-shader scene-input behavior in shader-lab
    `094-cpu-unified-source-driven-soft-shader-matrix`, local-second-order
    subjective-scene records, and `shader-design.md#cpu-postprocess-shader`.
  - Verification: numbered record writes scene descriptors, scene inputs, CPU
    soft-shader outputs, selected-pixel diagnostics, finite checks, and scene
    inventory classification before any GPU shader comparison is attempted.
    For fixture scenes, the CPU objective-output record must include expected
    rendered-pixel RGB/RGBA derived from the fixture spectrum through the
    validated Bruneton-based color adapter and compare it to the actual CPU
    soft-shader pixels.

#### Subgoal 3.3: Shader Contract And Source Assembly

- Stage 3.3.1: Build shader descriptors from CPU contracts.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/063-m3-shader-descriptor`. The descriptor
    probe built deterministic setup/config descriptors from the CPU constants
    and recorded zero expectation failures.
  - Code: add shader-facing descriptors for spectral basis, atmosphere
    profile, distant source, geometry mode, numerical controls, uniforms,
    defines, and display conversion.
  - Files/classes: add `shader/types.d.ts` and a shader descriptor builder
    class under `shader/`, using the inventory name
    `shader/DistantSphericalShaderDescriptorBuilder.js` unless implementation
    reveals a better concrete class name. Keep descriptor construction
    separate from GLSL source assembly.
  - References: `algorithm32-abstraction-design.md`,
    `shader-design.md`,
    `agents/topics/apps/flat/algorithm32/production-design.md`, and
    shader-lab records such as `224-three-native-live-pass-soft-shader-matrix`
    and `226-three-native-production-shape-review`.
  - Verification: descriptor snapshots are deterministic and match CPU
    configuration fingerprints.

- Stage 3.3.2: Assemble the distant/spherical GLSL path.
  - Current status: complete in
    `tmp/atmosphere/reconciliation/064-m3-shader-assembly`. The first pass
    source assembly is generic: concrete distant/spherical behavior is
    expressed by owner contributions, while `Algorithm32ShaderAssembler`
    validates symbols and assembles deterministic GLSL without naming the
    concrete profile.
  - Code: add shader source assembly for distant-source spherical transport,
    depth/ray reconstruction, atmosphere evaluation, cache lookup/access, and
    display conversion. The assembler remains contribution-driven so
    local/flat follow-on work should be implemented by the owning abstractions
    rather than by editing the assembler.
  - Files/classes: add `shader/Algorithm32ShaderAssembler.js`,
    `shader/DistantSphericalShaderContributionFactory.js`,
    `shader/ShaderCompatibilityValidator.js`, `shader/TextureBuilder.js`, and
    any GLSL source modules under `shader/` or a `shader/sources/` subfolder
    when source fragments stop fitting cleanly in owner contribution records;
    update `shader/types.d.ts` instead of embedding complex payload shapes in
    source assembly files. Use `shader/ShaderBinder.js`,
    `shader/ShaderPassInstaller.js`, `shader/ShaderResourcePreparer.js`,
    `shader/ShaderCapabilityReporter.js`,
    `shader/ShaderSceneAdapter.js`, and
    `shader/ShaderDiagnosticsReporter.js` as separate classes when their
    behavior is nontrivial.
  - References: `scripts/flat/algorithm32-shader-lab/`,
    `shared/algorithm32/POC/three/shader-lab-page.js`,
    `shader-design.md`, and Milestone 1 CPU contracts.
  - Verification: no-atmosphere passthrough, descriptor/symbol/binding
    diagnostics, selected shader diagnostics, and objective scene selected-pixel
    or controlled-region claims. CPU/GPU selected-pixel comparison is
    secondary consistency evidence.

#### Subgoal 3.4: Browser Job Watcher

- Stage 3.4.1: Implement the watcher.
  - Current status: implementation complete in
    `tmp/atmosphere/reconciliation/065-m3-browser-watcher-dry-run`. The
    non-browser dry-run verified JSON command normalization, output-root
    creation, `progress.json` liveness output, and `latest.json` writing.
    User-run browser operation uses
    `node scripts/flat/reconciliation/POC/src/runners/browserShaderWatcher.js --watch`.
  - Code: add a long-running browser process following the local-Sun
    experiment model: it watches for JSON job files to open, executes
    scenarios, captures canvases/readbacks, writes JSON results, and updates a
    progress log while work is running. The user runs this process for browser
    access. A local HTTP control channel is out of scope for the first
    protocol.
  - Files/classes: add `browser/types.d.ts` and
    `browser/BrowserShaderJobRunner.js` as the watcher/runner class named by
    the shader-design inventory, a JSON job command directory under the POC
    root, and a non-browser dry-run runner.
  - References: `scripts/flat/algorithm32-shader-lab/harness.js`,
    `tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json`, and
    browser-run rules in `experimental-guidelines.md` and
    `shader-design.md`.
  - Verification: non-browser dry-run checks can run locally; accepted browser
    job, rejected timeout job, rejected browser-crash job, and progress-log
    freshness/liveness checks require a user-run watcher and numbered evidence
    record. Long shader compilation or rendering is considered alive when the
    progress log continues to advance.

- Stage 3.4.2: Record hardware/browser diagnostics.
  - Current status: implementation complete in
    `tmp/atmosphere/reconciliation/066-m3-browser-diagnostics-readiness`.
    The browser page and watcher are wired to emit WebGL vendor/renderer,
    precision, extension, shader compile/link, readback, PNG, and progress
    diagnostics. Actual browser diagnostic values require a user-run watcher
    job.
  - Code: capture WebGL vendor/renderer/version, precision, extensions,
    canvas size, pixel ratio, shader compile/link diagnostics, readback format,
    and artifact output metadata.
  - Files/classes: add a browser capability reporter class or watcher-owned
    diagnostics module and update browser/shader diagnostics types; write
    diagnostics into GPU numbered records.
  - References: shader-lab and local-second-order browser records.
  - Verification: every GPU record includes diagnostics, progress log, and PNG
    artifacts for retained visuals, or is rejected as incomplete. Comparisons
    may use in-memory buffers; persisted visual artifacts are PNGs.

#### Subgoal 3.5: Integrated GPU Distant/Spherical Parity

- Stage 3.5.1: Build the integrated scene comparison.
  - Code: render a Three-generated scene through the GPU atmosphere pass and
    generate the corresponding CPU postprocess objective output through the CPU
    soft-shader delivered in Subgoal 3.1, using the validation scene set
    delivered in Subgoal 3.2. This keeps the useful shader-lab execution shape
    without using the old adapted shader-lab reference as authority. The
    primary gate is that each implementation satisfies the objective scene
    claims; CPU-vs-GPU comparison is secondary consistency evidence.
  - Files/classes: add a GPU parity runner under `runners/`, an integrated
    objective comparison class under `comparison/`, and reuse the
    `soft-shader/`, `browser/`, `scenes/`, and `shader/` classes.
  - References: shader-lab `214-216-three-native-distant-first-order-atmosphere`,
    `223-224-three-native-live-pass-soft-shader-matrix`, and
    `227-postprocess-gpu-vs-integrated-shader-subjective-scenes`. Keep this
    comparison machinery in the experiment-runner layer, outside
    `shader-design.md`.
  - Verification: selected pixels, controlled regions, or whole-image metrics
    are chosen by each objective scene claim. Both CPU soft-shader and GPU
    shader outputs must satisfy the objective expectations within
    human-visual-perception-grounded tolerances defined in
    `shader-test-design.md`; CPU-vs-GPU comparison is secondary consistency
    evidence and mismatch classification.

- Stage 3.5.2: Classify shader differences.
  - Code: emit comparison diagnostics for texture/uniform packets, shader
    precision, operation-order differences, display conversion, and PNG/canvas
    encoding.
  - Files/classes: add a shader difference classifier class or comparison
    utility and comparison diagnostics types; keep classification output in
    record diagnostics rather than shader runtime state.
  - References: mismatch categories in `experimental-guidelines.md`.
  - Verification: every failure is classified before continuing to Milestone 4.

Current Subgoal 3.5 repair queue status before exit:

- Resolved in records `314` through `324`: the browser GPU placeholder
  incident-radiance binding was replaced with a real distant/spherical
  cache-backed `rgba32f` texture payload. `TextureBuilder`, the distant cache,
  browser binding, and diagnostics now expose uploadable cache values, texture
  dimensions, sampler policy, spectral grouping, and access metadata instead
  of a constant `3d-constant-rgba8` texture.
- Resolved: GPU incident-radiance lookup now follows the CPU Algorithm32 cache
  access shape for the distant/spherical path. The shader resolves an altitude
  bin from the sample position, iterates the cache-owned sun-oriented incident
  direction sequence, applies the cache direction weight, and unpacks the
  canonical spectral channel layout from the cache payload.
- Resolved: the RGB transport shortcut was removed from accepted M3
  distant/spherical parity evidence. The generated shader uses the canonical
  15-channel spectral basis for direct solar irradiance, incident radiance,
  source/path transmittance, and accumulated path radiance.
- Resolved: the GPU view-path integration rule now matches the accepted CPU
  endpoint/trapezoid Algorithm32 rule instead of the old midpoint shader loop.
- Resolved: the color contract remains canonical. In the generated GPU
  shader, only ray/spatial facts and finite hit distance enter the atmosphere
  transport stages; spectral path radiance and transmittance come out;
  rendered scene hit color is applied afterward by the display/postprocess
  composition formula. This mirrors the CPU public `evaluate(...)` boundary
  without implying that the GPU shader literally calls `evaluate(...)`.
  Ground exists for light/blocking and endpoint distance, not as an
  atmosphere-transport color source.
- Resolved for the objective browser path: retained M3 GPU records now gate on
  cache payload diagnostics in addition to compile/link, visible output, and
  PNG persistence. The accepted planet-scene and integrated-objective watcher
  records report the real `rgba32f` incident-radiance payload.
- Resolved for the subjective command producers without adding subjective
  review evidence: solar-noon and daylight-stack commands now emit the same
  packed cache payload shape. The daylight-stack browser path binds a
  row-specific cache payload for each row's sun direction, and the old
  browser CPU side-by-side RGB approximation now fails loudly instead of
  producing non-parity evidence.
- Resolved in records `327` through `329`: the planet-scene cache payload was
  structurally present but all zero because the cache-coordinate inverse
  mapping used the old default `+Z` radial-up frame while the planet/Three
  scene rays, camera, and Sun direction use Algorithm32 model `+X` as radial
  up. The fix is on the geometry side: `SphericalEarthGeometry` now owns the
  observer-local scene-frame mapping and maps both Three scene capture
  points/directions and cache-owned build coordinates into the same
  model-space frame. The generated shader geometry contribution now reads the
  observer-local frame from descriptor-owned geometry facts instead of using a
  hard-coded swizzle. The repaired cache-enabled CPU scene has `13125`
  nonzero packed cache floats, and the cache-on/no-cache decoded comparison
  differs in all `8160` pixels. Record `330` confirms the original M1 `+Z`
  spherical cache probe still accepts with positive incident radiance.
- Resolved in records `334` and `332`: the CPU planet scene and browser
  shader planet scene no longer carry separate lighting/color constants or
  ground color policies. Shared facts live in
  `scenes/planetSphereSceneFacts.js`, are imported by the CPU runner and
  browser command producer, and are passed to the browser page as
  `payload.planetSceneFacts`. The old CPU-only procedural ground pattern was
  removed from the refreshed CPU diagnostic. The browser page now uses the
  payload facts for pre-shader scene color, ground/box Lambert materials,
  ambient/directional lighting, ground sphere segments, and diagnostics.
  Record `331` accepted mechanically but is superseded for raw/color evidence:
  its Node-side Lambert-style byte multiplier saturated ground hits to white,
  making the raw CPU scene appear to have no ground. Record `334` removes that
  pseudo-lighting from CPU raycaster hit-color capture, adds a
  `raw-scene-ground-color-present` criterion, and accepts with `3891` exact
  shared ground-color pixels. These records align scene facts and hit counts,
  but final visual CPU/GPU parity still needs a CPU comparison path that
  consumes browser-captured scene color/depth/hit textures directly.
- Resolved in records `335` and `336`: planet scene construction now has an
  explicit constructed-scene boundary. The canonical scene definition is a
  scene name plus object-name list, backed by an object-name to
  renderer-function map instead of scattered construction code. The light
  source is modeled as a scene object, each green box is a separate scene
  object, and the spherical ground remains geometry-owned outside the object
  list. The CPU raw renderer/soft shader and browser GPU capture both consume
  an already constructed scene. Browser records `342` and `344` confirm the
  object renderer contract after tightening it so object color and light
  intensities are owned by registered renderer functions/constants rather than
  passed as input data. Watcher artifact `343` confirms the constructed scene
  reaches the shader path with ground plus four box meshes and the expected
  light objects. Direct browser record `344` confirms the non-shader path also
  uses the constructed scene after record `338` exposed stale shader-only
  wrapper criteria.
- Remaining broader gate: final objective RGB fixture materialization and
  numeric image/selected-pixel comparisons are still the next M3 validation
  work before promotion beyond distant/spherical parity repair evidence.

Exit criteria:

- CPU postprocess soft-shader exists as a CPU-only deliverable, consumes
  reconciliation-owned scene inputs, uses the public `evaluate(...)`
  operation for atmosphere calculation, and records scene-input/composition
  compatibility with shader-lab/local-second-order lineage.
- GPU validation scene set exists as a reusable descriptor inventory with CPU
  soft-shader objective outputs, active M3 distant/spherical objective/hypothesis
  scenes, subjective review scenes borrowed from the latest local-second-order
  accepted lineage, deferred local/flat scenes, and explicit exclusions.
- GPU distant/spherical output satisfies the objective scene claims within
  tolerances defined in `shader-test-design.md`, or every mismatch is
  classified. CPU-vs-GPU output comparison is included as secondary evidence.
- Browser job watcher behavior follows the thin JSON-job/progress-log/PNG-artifact
  protocol and is documented and recoverable after failed or timed-out jobs:
  commands name the page, entrypoint, captures, and payload job type, while the
  browser page reports progress and requests artifact persistence through the
  host API instead of making the watcher interpret shader-specific results.
- Numbered records include visual outputs, selected-pixel or image metrics,
  diagnostics, and source/implementation notes.

## Milestone 4: GPU Local Sun, Flat Earth

Goal: produce integrated GPU shader parity for local Sun and flat Earth,
informed by the shader-lab implementation and the local-second-order lane.

Primary work:

- Add local-source shader support, cache-owned texture generation, and lookup logic
  for the flat/local configuration.
- Reuse the CPU cache-generation behavior established in Milestone 1 and any
  local cache family added in Milestone 2; Milestone 4 owns cache texture
  creation through the cache, cache access assembly, binding, and shader
  parity rather than the core Algorithm32 L2 cache lifecycle.
- Recreate required local-second-order objective checks and subjective/review
  galleries under the reconciliation record root.
- Capture terrain/skydome/browser outputs, shader diagnostics, cache keys,
  direction-frame conventions, and source/geometry handoff facts.

User-requested subjective scenes created while inspecting local/flat behavior
are not design fixtures or acceptance gates by default. Keep those scene
records in the numbered artifact log, `CURRENT_STATE.md`, and topic status.
Only promote a subjective scene into this milestone plan when the user
explicitly chooses it as a reusable validation/review fixture or when it
captures a durable contract that objective tests need.

Current status before formal M4 GPU implementation:

- Ahead/prepared: the browser-integrated CPU composer can run the
  `flat-earth` / `local-sun` profile through public
  `SpectralReferenceEvaluator.evaluate(...)`, with geometry-owned flat ground,
  scene-hit endpoint composition, and local L2 cache binding.
- Ahead/prepared: local Sun degree inputs are treated as
  `degreesFromClosestApproach`, so source position, apparent sky placement,
  endpoint lighting direction, shadow direction, and transport source facts
  are derived from the same resolved local-source state.
- Ahead/prepared: local-source-owned Three endpoint lighting and optional
  shadow objects exist for subjective scene-color capture through the optional
  `LightSourceModel.createThreeLightingObjects(...)` integration adapter. This
  remains endpoint scene shading outside Algorithm32 transport; it is not
  source radiance pre-scaling inside `evaluate(...)`.
- Complete/prepared: record
  `534-m4-local-cache-texture-prep` accepts the M4.1 local cache texture-prep
  probe. The local L2 cache builds `315 / 315` coordinates/values, emits a
  deterministic packed `rgba32f` 3D shader payload
  `incident-radiance-local-l2` with dimensions `9 x 7 x 20` and `5040`
  upload floats, carries z/rho/direction/spectral-group lookup metadata, and
  proves runtime cache access still flows through geometry-resolved
  `local-source-z-rho` packets.
- Complete/prepared: record
  `535-m4-local-gpu-cache-texture-lookup` accepts M4.2 local GPU cache
  texture materialization and shader lookup. The browser WebGL2 path uploads
  the real `incident-radiance-local-l2` payload as a `9 x 7 x 20`
  `rgba32f` 3D texture with `5040` floats, compiles the local/flat shader
  contribution set, binds the local cache sampler, and reads back the packed
  z/rho/direction/spectral-group texel through GLSL with expected RGBA
  `[128, 182, 204, 255]`.
- Complete/prepared: records
  `536-m4-flat-geometry-gpu-selected-ray-parity` and
  `537-m4-local-flat-gpu-integrated-selected-pixel-parity` accept M4.3.1.
  Record `536` proves local/flat GPU selected-ray parity against
  `FlatEarthGeometry` for browser ray reconstruction, scene-hit termination,
  ground/top/observer-dome path bounds, and z/rho cache access coordinates.
  Record `537` runs the same constructed local-flat scene through integrated
  CPU and GPU composer backends, both using the local L2 cache contract, and
  matches selected browser readbacks with max byte delta `1`.
- Not complete: M4.3.2 required review galleries, any remaining
  local-second-order evidence recreation beyond the M4.3.1 objective records,
  and final M4 closeout remain open.

### Major Subgoals And Primary Stages

#### Subgoal 4.1: Local Cache Texture Prep

Current status: accepted in
`tmp/atmosphere/reconciliation/534-m4-local-cache-texture-prep`. Record `533`
is preserved as a rejected probe-criterion bug; record `534` is the accepted
evidence for cache descriptor, shader payload, TextureBuilder request, and
geometry-resolved runtime cache access. Browser/GPU upload and GLSL lookup are
M4.2 work.

- Stage 4.1.1: Adapt local cache descriptors for shader texture creation.
  - Code: consume the local cache descriptors, coordinate generators, cache
    keys, source/atmosphere-relative access packets, and generated-value
    storage produced through the Milestone 1/Milestone 2 CPU cache contract,
    then add cache-owned texture creation and access-assembly metadata needed
    for GPU sampling.
  - Files/classes: add or update `shader/types.d.ts`, `shader/TextureBuilder.js`,
    `incident-radiance/LocalSunIncidentRadianceCache.js`, and
    `incident-radiance/types.d.ts` only if local CPU work has not already
    exposed the required cache shape/access surface.
  - References: `algorithm32-abstraction-design.md`,
    `local-sun-flat-geometry-fact-inventory.md`,
    `tmp/atmosphere/local-second-order/009-local-incident-field-oracle`, and
    `tmp/atmosphere/local-second-order/011-local-cache-shape`.
  - Verification: cache key equality, coordinate bounds checks, descriptor
    fingerprint checks, and fail-loud rejection for mismatched geometry/source
    context.

- Stage 4.1.2: Verify the CPU cache contract before cache texture creation.
  - Code: run the already-established cache-build coordinator over the
    local/flat cache family, compare generated values against direct/oracle
    checks, and emit descriptor diagnostics that cache texture creation can use.
    Do not add a second cache-build coordinator in the shader milestone.
  - Files/classes: update local cache diagnostics, cache texture/access types,
    and focused runners under `runners/`; avoid public-signature changes in
    `setup/buildIncidentRadianceCache.js`, `SpectralReferenceEvaluator`, or
    `SpectralCalculator` unless a defect in the Milestone 1 cache contract is
    found and recorded.
  - References: cache-builder design in `algorithm32-abstraction-design.md`,
    `tmp/atmosphere/local-second-order/012-cpu-soft-shader-local-l2`, and
    `shared/algorithm32/POC/local-second-order/`.
  - Verification: direct/oracle incident-field comparison, nonzero local L2
    where expected, zero contribution where geometry/source visibility blocks
    it, and no cache recursion.

#### Subgoal 4.2: Local GPU Cache Texture And Shader Lookup

Current status: accepted in
`tmp/atmosphere/reconciliation/535-m4-local-gpu-cache-texture-lookup`.
Record `535` is the M4.2 evidence for browser/GPU texture upload, binding,
local/flat descriptor and contribution assembly, and GLSL lookup of the
cache-owned `z-rho-bin-all-directions` payload. It includes initial
flat-geometry shader contribution coverage sufficient for assembly/compile and
cache-coordinate lookup diagnostics; selected-ray/path-bound parity and
integrated selected-pixel parity are now accepted as M4.3.1 records `536` and
`537`.

- Stage 4.2.1: Build local cache textures for GPU.
  - Code: make the local cache call `TextureBuilder` with its dimensions,
    data, texture kind, sampler policy, spectral grouping, direction-index
    metadata, and matching shader access assembly.
  - Files/classes: update `incident-radiance/LocalSunIncidentRadianceCache.js`,
    `incident-radiance/types.d.ts`, `shader/TextureBuilder.js`, and
    `shader/types.d.ts`; keep Three texture creation out of the CPU calculator
    and out of a generic shader-side packer.
  - References:
    `tmp/atmosphere/local-second-order/020-three-integrated-gpu-local-l2`,
    `local-sun-flat-geometry-fact-inventory.md`, and Three `Data3DTexture`
    usage in the historical POC.
  - Verification: CPU pack/unpack roundtrip inside the cache, texture dimension
    checks, descriptor equality, WebGL2 `Data3DTexture` upload diagnostics, and
    sampled cache value parity at named coordinates.

- Stage 4.2.2: Add the flat-geometry GPU contribution.
  - Code: implement the flat-geometry shader contribution that reconstructs
    browser camera rays into the flat model frame, resolves path bounds from
    explicit scene-hit distance plus flat ground/top/sky limits, samples
    atmosphere by flat altitude, and resolves geometry-owned z/rho cache
    coordinates for local incident-radiance lookup. Keep this separate from
    light-source radiometry: geometry converts positions and cache coordinates;
    the light source supplies source direction, distance/scale, and source
    path behavior.
  - Files/classes: add or update `LocalFlatShaderDescriptorBuilder`,
    `LocalFlatShaderContributionFactory`, browser runtime diagnostics, and
    descriptor facts sourced from `FlatEarthGeometry` / the local-flat runtime
    config. Do not add flat-geometry branches to the distant/spherical shader
    class.
  - References: `FlatEarthGeometry`, `algorithm32-abstraction-design.md`
    geometry ownership sections, `shader-design.md` contribution ownership
    rules, and accepted CPU flat/local records beginning at `456`.
  - Verification: shader assembly must compile with flat geometry symbols,
    no sentinels or tolerance-as-signal behavior, and cache-coordinate lookup
    must consume geometry-owned z/rho facts. Record `535` covers compile and
    diagnostic cache lookup; record `536` accepts full selected-ray/path-bound
    parity against CPU `FlatEarthGeometry`, including observer-dome clipping
    and scene-hit termination.

- Stage 4.2.3: Integrate local-source shader lookup.
  - Code: add local-source shader uniforms, source-relative direction frame,
    cache lookup, phase weighting, and scene/display composition.
  - Files/classes: add or update a local/flat shader builder class and GLSL
    sources; extend shader descriptors and browser diagnostics without adding
    local-source branching to the distant/spherical shader class.
  - References: shader-lab local records
    `219-220-three-native-flat-local-first-order-atmosphere`,
    `179-185-local-sun-full-image-shader-parity`, and local-second-order
    records `020` and `021`.
  - Verification: local shader compile/link, source-direction sign convention
    checks, local cache texel readback through GLSL, and no cache-packing
    drift. Record `537` accepts integrated CPU/GPU selected-pixel parity for
    the constructed local-flat scene with max byte delta `1`; cache/no-cache
    comparison and broader browser image metrics remain M4.3 evidence
    recreation/closeout work if needed.

#### Subgoal 4.3: Local/Flat Integrated Evidence Recreation

- Stage 4.3.1: Recreate required objective records.
  - Current status: accepted for the flat-geometry selected-ray parity and
    integrated local-flat CPU/GPU selected-pixel parity slice in records
    `tmp/atmosphere/reconciliation/536-m4-flat-geometry-gpu-selected-ray-parity`
    and
    `tmp/atmosphere/reconciliation/537-m4-local-flat-gpu-integrated-selected-pixel-parity`.
  - Code: first prove flat-geometry GPU selected-ray parity against
    `FlatEarthGeometry` for ray reconstruction, scene hit termination,
    ground/top/observer-dome limits, atmosphere altitude coordinates, and
    z/rho cache access. Then add runners for any remaining module/reference
    parity, cache shape/key checks, CPU soft-shader local L2, GPU integrated
    local L2, and CPU/GPU selected-pixel parity records not already covered by
    `536`/`537`.
  - Files/classes: add focused objective runner modules under `runners/` and
    reuse comparison, cache, shader, and browser classes; write recreated
    objective evidence into numbered records.
  - References: `tmp/atmosphere/local-second-order/009-*`, `011-*`, `012-*`,
    `020-*`, `021-*`, and `022-*`.
  - Verification: each recreated objective record has `criteria-results.json`,
    diagnostics, comparison outputs, and explicit pass/fail status.

- Stage 4.3.2: Recreate required review galleries.
  - Code: add browser/gallery runners for first-order versus second-order,
    terrain and Southern France captures, with/without shader source matrices,
    local-vs-distant time-aligned galleries, and neutral-spectrum comparison.
  - Files/classes: add review/gallery runner modules under `runners/` and
    browser scene descriptor types; reuse the browser watcher and shader
    builders instead of creating gallery-specific transport classes.
  - References: `tmp/atmosphere/local-second-order/030-*`, `088-*`, `092-*`,
    `093-*`, `095-local-source-neutral-white-stack`, and
    `scripts/flat/local-second-order/README.md`.
  - Verification: objective image metrics where deterministic targets exist;
    otherwise labeled subjective/review records with scene configuration,
    browser diagnostics, and acceptance notes.

#### Subgoal 4.4: Final Local/GPU Closeout

- Stage 4.4.1: Classify promotion readiness.
  - Code: update current-state notes with accepted local/flat shader state,
    unresolved source gaps, deferred display fixtures, and production blockers.
  - Files/classes: update `POC/CURRENT_STATE.md`,
    `agents/topics/apps/flat/reconciliation/status.md`,
    `agents/topics/apps/flat/reconciliation/README.md`, and
    provenance/ledger notes; create no new runtime classes for closeout
    classification.
  - References: latest Milestone 4 records,
    `unsourced-and-partially-sourced-facts.md`, and
    `agents/topics/apps/flat/algorithm32/production-design.md`.
  - Verification: every production-candidate behavior has a source or accepted
    decision trail, and every unresolved item is explicitly non-promoted.

- Stage 4.4.2: Close the milestone record.
  - Code: write the final numbered record for Milestone 4 with canonical
    evidence links, result summary, known gaps, and next production-promotion
    recommendations.
  - Files/classes: write final numbered record files and update the running
    log; keep runtime code unchanged unless closeout exposes a real defect.
  - References: all accepted Milestone 4 numbered records and the final POC
    `CURRENT_STATE.md`.
  - Verification: the record names canonical evidence for CPU local/flat, GPU
    local/flat, browser capabilities, cache descriptors, cache textures/access code, and
    subjective/review outputs.

Exit criteria:

- GPU local/flat output matches the accepted local-source behavior within
  recorded criteria, or every mismatch is classified.
- Required objective and subjective/review evidence from shader-lab and
  local-second-order is recreated or explicitly scoped out.
- Current-state notes identify the final accepted local/flat shader state,
  remaining production-promotion blockers, and canonical evidence records.
