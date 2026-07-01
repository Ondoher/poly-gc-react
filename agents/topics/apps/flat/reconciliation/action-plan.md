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
Record artifact and evidence gaps unless they are egregious. The hard artifact
rule for this lane is matching the sky dome/four-view artifacts created by the
Bruneton start-fresh Experiment 32 / Step 032 baseline under
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
Other missing diagnostics, criteria files, or historical convenience artifacts
are findings unless they make the current milestone's verification claim
impossible.

## Milestone 0: Preparation

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
- Use one runtime file per class, with the class as that file's single default
  export. Required complex types go in the owning `types.d.ts` file.
- Inventory comparison targets for all four parity milestones.
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
    callbacks, records, and handles. Any runtime class added during scaffold
    work gets its own file and is that file's single default export.
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
  - Code: define job request/result JSON shapes for long-running browser
    renders, including job id, scenario, config digest, output paths, timeout,
    browser diagnostics, and result status. The watcher can be implemented any
    time before Milestone 3, but browser execution is a user-run step because
    of sandbox constraints.
  - Files/classes: add browser-job request/result types to a future
    `POC/src/browser-jobs/types.d.ts` or `setup/types.d.ts`; if implemented
    early, add `BrowserJobWatcher.js` as a single default-export class and a
    non-browser dry-run utility.
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
    packets to the browser-job or shader `types.d.ts`; defer the concrete
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

## Milestone 1: CPU Distant Sun, Spherical Earth

Goal: produce CPU reference parity for distant Sun and spherical Earth against
the accepted Bruneton start-fresh Experiment 32 / Step 032 sky dome baseline:
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
This is the lane's hard artifact rule.

Primary work:

- Build the CPU reference POC spine for spherical geometry, distant light
  source, atmosphere, spectral calculation, and display/comparison output.
- Preserve the accepted Algorithm32 endpoint/trapezoid path rule.
- Record equations, constants, spectral basis, numerical controls, and source
  trails used by the run.
- Generate comparable four-view outputs and diagnostics.
- Compare against the accepted Step 032 visual artifacts with explicit
  criteria.

### Major Subgoals And Primary Stages

#### Subgoal 1.1: CPU Reference Transport Spine

- Stage 1.1.1: Implement the spectral calculator loop.
  - Code: implement `buildEndpointTrapezoidPathIntegrationPoints(...)` and
    `computeRadiance(...)` for a `RaySegment`, with direct in-scattering,
    source transmittance, optional incident sampling omitted, and
    `PathRadiance` output.
  - Files/classes: update `calculator/SpectralCalculator.js`,
    `calculator/types.d.ts`, and `src/types.d.ts`; keep the readable transport
    loop in `SpectralCalculator` rather than spreading it across model
    classes.
  - References: `algorithm32-abstraction-design.md`,
    `bruneton-start-fresh-source-audit.md`, and accepted Step 032 evidence.
  - Verification: hard invariants for monotonic integration points, finite
    spectral values, transmittance in `[0, 1]`, zero-medium passthrough, and no
    incident-radiance recursion during first-order cache-free runs.

- Stage 1.1.2: Implement equation helpers.
  - Code: add low-level helpers for optical depth, Beer-Lambert transmittance,
    phase-weighted direct scattering, direct in-scattering, and
    endpoint/background composition.
  - Files/classes: update `calculator/SpectralCalculator.js` and, only if the
    helper surface becomes too crowded, add one calculation-focused helper
    class file under `calculator/` with matching ambient types.
  - References: source-backed equation notes in
    `agents/topics/apps/flat/algorithm32/conclusions.md` and
    `bruneton-start-fresh-source-audit.md`.
  - Verification: compare helper diagnostics against source-backed identities
    and accepted Step 032 numerical records where available.

#### Subgoal 1.2: Spherical Geometry And Distant Light Source

- Stage 1.2.1: Implement spherical geometry.
  - Code: add spherical Earth geometry for view-ray segment resolution,
    altitude coordinate resolution, atmosphere-boundary clipping, and
    source-path atmosphere path creation.
  - Files/classes: add `geometry/SphericalEarthGeometry.js` as the concrete
    geometry class for this milestone and update `geometry/types.d.ts` for any
    spherical descriptors or diagnostics it owns.
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
    light-source class and update `light/types.d.ts` for distant-source
    descriptors and diagnostics.
  - References: `post-step032-lane-source-audit.md`,
    `bruneton-start-fresh-source-audit.md`, and Step 032 source/light facts.
  - Verification: compare direction packets and source facts against accepted
    Step 032 diagnostics or regenerated deterministic diagnostics; fail if
    finite-source fields leak into distant-source transport.

#### Subgoal 1.3: Atmosphere Profile And Provenance

- Stage 1.3.1: Implement the canonical atmosphere profile.
  - Code: add density/profile sampling, Rayleigh/Mie/absorption coefficients,
    phase evaluation, extinction/scattering samples, and optical-depth
    integration over geometry-resolved `AtmospherePath`.
  - Files/classes: add `atmosphere/CanonicalAtmosphere.js` and update
    `atmosphere/types.d.ts` for profile descriptors, medium samples, and
    optical-depth diagnostics.
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
    starts; update `provenance/types.d.ts` or `src/types.d.ts` for emitted
    provenance packet shapes.
  - References: `experimental-guidelines.md` and the Step 032
    `criteria-results.json` or report files when present.
  - Verification: every emitted equation/constant has a source classification,
    and unresolved facts block acceptance rather than silently passing.

#### Subgoal 1.4: Four-View CPU Baseline Comparison

- Stage 1.4.1: Generate comparable CPU images.
  - Code: add a CPU renderer or image writer for the four Figure 1 baseline
    views, including display conversion needed only for comparison output.
  - Files/classes: add a CPU Figure 1 renderer/image-writer class under a
    `rendering/` or `outputs/` module, plus display-output packet types in the
    owning `types.d.ts`; keep color/display conversion outside CPU transport.
  - References: the four accepted PNG targets named in
    `experimental-guidelines.md` under the Step 032 baseline root.
  - Verification: produce deterministic output dimensions, metadata, and
    images for the same four view configurations.

- Stage 1.4.2: Compare against accepted artifacts.
  - Code: add image-diff and diagnostics reporting for max delta, mean delta,
    RMSE, optional histogram summaries, and selected ray/pixel diagnostics.
  - Files/classes: add an image comparison class or utility under
    `comparison/`, plus comparison-result and selected-pixel diagnostic types;
    write comparison artifacts into the numbered M1 record.
  - References: Step 032 accepted artifacts and comparison policy in
    `experimental-guidelines.md`.
  - Verification: pass accepted thresholds when available; otherwise record
    thresholds before evaluation and classify any mismatch as transport,
    source, geometry, display, encoding, or artifact-tool error. The hard
    artifact decision is whether the generated CPU output matches the accepted
    Step 032 sky dome/four-view artifacts; other artifact gaps are recorded
    unless they prevent that decision.

Exit criteria:

- CPU reference output matches the accepted distant-sun spherical sky
  dome/four-view baseline within recorded criteria. This is the hard artifact
  gate for the lane; non-egregious supporting gaps are recorded separately.
- A numbered record captures code/config changes, inputs, facts, references,
  diagnostics, comparison artifacts, and result status.
- Current-state notes identify the accepted CPU distant/spherical baseline or
  the remaining blocker.

## Milestone 2: CPU Local Sun, Flat Earth

Goal: produce CPU reference parity for local Sun and flat Earth against the
accepted atmosflat32 artifacts:
`tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`.

Primary work:

- Add flat geometry and finite local light-source support to the CPU POC.
- Implement the geometry-to-light source handoffs for source-relative position,
  source path limits, source atmosphere paths, and cache-access coordinates as
  needed.
- Reconcile artificial/local model facts separately from externally sourced
  physics facts.
- Verify local-sun behavior in parts where a single physical validation claim
  is inappropriate.
- Generate comparable skydome outputs and diagnostics.

### Major Subgoals And Primary Stages

#### Subgoal 2.1: Flat Geometry Profile

- Stage 2.1.1: Implement flat atmosphere geometry.
  - Code: add flat z-up geometry for altitude from `z`, ground plane, top
    boundary, view-ray segment limits, and source-path clipping.
  - Files/classes: add `geometry/FlatEarthGeometry.js` and extend
    `geometry/types.d.ts` with flat-geometry descriptors and diagnostics.
  - References: `local-sun-flat-geometry-fact-inventory.md`,
    `post-step032-lane-source-audit.md`, and accepted atmosflat32 Step 018
    artifacts.
  - Verification: analytic ray-plane and ray-slab checks for top/ground
    intersections, deterministic source-path failure states, and altitude
    coordinate equality with `position.z`.

- Stage 2.1.2: Emit geometry diagnostics.
  - Code: record view segment bounds, source path bounds, clipping reason,
    source-relative position inputs, and cache-access inputs where relevant.
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
    falloff inputs, and calibration diagnostics.
  - References: `local-sun-flat-geometry-fact-inventory.md`,
    `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes`, and
    historical POC sources named in the inventory.
  - Verification: compare generated local-source packets to accepted Step 018
    diagnostics where available; otherwise record source-relative direction,
    distance, falloff, and calibration calculations in a numbered record.

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

#### Subgoal 2.3: Local/Flat CPU Parity

- Stage 2.3.1: Run local-source CPU transport.
  - Code: wire flat geometry and local source through the same
    `SpectralCalculator` path used by Milestone 1.
  - Files/classes: add or update a local/flat CPU runner under `runners/`;
    reuse `FlatEarthGeometry`, `LocalSunLightSource`, `CanonicalAtmosphere`,
    and `SpectralCalculator` rather than adding a separate algorithm class.
  - References: `algorithm32-abstraction-design.md`, atmosflat32 Step 018, and
    `post-step032-lane-source-audit.md`.
  - Verification: objective checks for finite radiance, transmittance bounds,
    direction sign conventions, source-path transmittance behavior, and no
    silent distant-source fallback.

- Stage 2.3.2: Generate rotation skydome comparisons.
  - Code: generate comparable skydome outputs for the accepted Step 018
    rotation views and write image metrics plus selected-ray diagnostics.
  - Files/classes: add a Step 018 skydome renderer/output class under
    `rendering/` and reuse the image comparison module; update output and
    comparison types for local/flat scene descriptors.
  - References:
    `tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes` and
    `scripts/flat/atmosflat32/`.
  - Verification: use accepted criteria where present. If the original
    acceptance was subjective, split verification into objective packet/math
    checks, deterministic image regression, and labeled subjective review.

#### Subgoal 2.4: Local CPU Record Closeout

- Stage 2.4.1: Record partial verification.
  - Code: write a numbered record with component-by-component pass/fail status
    for geometry, source packets, transport, display conversion, and images.
  - Files/classes: update record-writing utilities and the M2 numbered record
    files; no new domain class should be introduced solely for reporting.
  - References: `experimental-guidelines.md` validation tiers and local-source
    evidence rows in `post-step032-lane-source-audit.md`.
  - Verification: no local/flat acceptance claim is broader than its evidence.

- Stage 2.4.2: Update current-state notes.
  - Code: update the POC `CURRENT_STATE.md`, README/status handoff as needed,
    and the running log.
  - Files/classes: update `POC/CURRENT_STATE.md`,
    `agents/topics/apps/flat/reconciliation/README.md`, and relevant status
    docs; create no runtime classes.
  - References: the latest numbered Milestone 2 record.
  - Verification: current-state notes identify accepted local/flat pieces,
    unresolved facts, and the next GPU prerequisites.

Exit criteria:

- CPU reference local/flat output matches the accepted atmosflat32 Step 018
  behavior within recorded criteria, or every mismatch is classified.
- Verification records distinguish source-backed equations, accepted
  artificial-model decisions, subjective visual acceptance, and unresolved
  source gaps.
- Current-state notes identify which local/flat pieces are accepted and which
  remain open.

## Milestone 3: GPU Distant Sun, Spherical Earth

Goal: produce integrated GPU shader parity for spherical Earth and distant Sun
against the CPU reference.

Primary work:

- Build the shader path from the CPU reference contracts: descriptors, shader
  source assembly, uniforms, textures, cache payloads, display conversion, and
  diagnostics.
- Implement or adapt a long-running browser process that watches for job
  updates and returns render/canvas results.
- Recreate the shader-lab style comparison: Three-generated scene plus
  Algorithm32 GPU shader output compared to CPU/reference output.
- Record WebGL/browser capabilities, shader defines, packed payload metadata,
  precision policy, and image comparison criteria.

### Major Subgoals And Primary Stages

#### Subgoal 3.1: Shader Contract And Payloads

- Stage 3.1.1: Build shader descriptors from CPU contracts.
  - Code: add shader-facing descriptors for spectral basis, atmosphere
    profile, distant source, geometry mode, numerical controls, uniforms,
    defines, and display conversion.
  - Files/classes: add `shader/types.d.ts` and a shader descriptor builder
    class under `shader/`; keep descriptor construction separate from GLSL
    source assembly.
  - References: `algorithm32-abstraction-design.md`,
    `agents/topics/apps/flat/algorithm32/production-design.md`, and
    shader-lab records such as `224-three-native-live-pass-soft-shader-matrix`
    and `226-three-native-production-shape-review`.
  - Verification: descriptor snapshots are deterministic and match CPU
    configuration fingerprints.

- Stage 3.1.2: Assemble the distant/spherical GLSL path.
  - Code: add shader source assembly for distant-source spherical transport,
    depth/ray reconstruction, atmosphere evaluation, and display conversion.
  - Files/classes: add a distant/spherical shader builder class under
    `shader/` and GLSL source files under a shader source folder; update
    shader descriptor types instead of embedding complex payload shapes in
    source assembly files.
  - References: `scripts/flat/algorithm32-shader-lab/`,
    `shared/algorithm32/POC/three/shader-lab-page.js`, and Milestone 1 CPU
    contracts.
  - Verification: no-atmosphere passthrough, packet-input parity, selected
    shader diagnostics, and CPU/GPU selected-pixel comparison.

#### Subgoal 3.2: Browser Job Watcher

- Stage 3.2.1: Implement the watcher.
  - Code: add a long-running browser process that watches job files, executes
    scenarios, captures canvases, writes JSON results, and keeps a heartbeat,
    unless it was already implemented during Milestone 0 or another earlier
    step. The user runs this process for browser access.
  - Files/classes: add `browser/BrowserJobWatcher.js` as the watcher class,
    browser job request/result types, a job command directory under the POC
    root, and a non-browser dry-run runner.
  - References: `scripts/flat/algorithm32-shader-lab/harness.js`,
    `tmp/atmosphere/algorithm32_shader_lab/harness-heartbeat.json`, and
    browser-run rules in `experimental-guidelines.md`.
  - Verification: non-browser dry-run checks can run locally; accepted browser
    job, rejected timeout job, rejected browser-crash job, and heartbeat
    freshness check require a user-run watcher and numbered evidence record.

- Stage 3.2.2: Record hardware/browser diagnostics.
  - Code: capture WebGL vendor/renderer/version, precision, extensions,
    canvas size, pixel ratio, and shader compile/link diagnostics.
  - Files/classes: add a browser capability reporter class or watcher-owned
    diagnostics module and update browser/shader diagnostics types; write
    diagnostics into GPU numbered records.
  - References: shader-lab and local-second-order browser records.
  - Verification: every GPU record includes diagnostics or is rejected as
    incomplete.

#### Subgoal 3.3: Integrated GPU Distant/Spherical Parity

- Stage 3.3.1: Build the integrated scene comparison.
  - Code: render a Three-generated scene through the GPU atmosphere pass and
    generate the corresponding CPU/reference or soft-shader comparison output.
  - Files/classes: add a GPU parity runner under `runners/`, an integrated
    scene comparison class under `comparison/` or `rendering/`, and reuse the
    browser watcher plus shader builder classes.
  - References: shader-lab `214-216-three-native-distant-first-order-atmosphere`,
    `223-224-three-native-live-pass-soft-shader-matrix`, and
    `227-postprocess-gpu-vs-integrated-shader-subjective-scenes`.
  - Verification: selected pixels and image metrics compare GPU output to the
    CPU reference within recorded browser/GPU tolerances.

- Stage 3.3.2: Classify shader differences.
  - Code: emit comparison diagnostics for texture/uniform packets, shader
    precision, operation-order differences, display conversion, and PNG/canvas
    encoding.
  - Files/classes: add a shader difference classifier class or comparison
    utility and comparison diagnostics types; keep classification output in
    record diagnostics rather than shader runtime state.
  - References: mismatch categories in `experimental-guidelines.md`.
  - Verification: every failure is classified before continuing to Milestone 4.

Exit criteria:

- GPU distant/spherical output matches CPU reference within recorded shader
  parity tolerances, or every mismatch is classified.
- Browser job watcher behavior is documented and recoverable after failed or
  timed-out jobs.
- Numbered records include visual outputs, selected-pixel or image metrics,
  diagnostics, and source/implementation notes.

## Milestone 4: GPU Local Sun, Flat Earth

Goal: produce integrated GPU shader parity for local Sun and flat Earth,
informed by the shader-lab implementation and the local-second-order lane.

Primary work:

- Add local-source shader support, cache payload generation, and lookup logic
  for the flat/local configuration.
- Reconcile cache-generation behavior across geometry, atmosphere, light
  source, and the shared spectral calculator.
- Recreate required local-second-order objective checks and subjective/review
  galleries under the reconciliation record root.
- Capture terrain/skydome/browser outputs, shader diagnostics, cache keys,
  direction-frame conventions, and source/geometry handoff facts.

### Major Subgoals And Primary Stages

#### Subgoal 4.1: Local Incident Cache Build Path

- Stage 4.1.1: Implement local cache descriptors and coordinates.
  - Code: add source-created local cache descriptors, coordinate generators,
    cache keys, source/atmosphere-relative access packets, and generated-value
    storage.
  - Files/classes: add `incident-radiance/LocalSunIncidentRadianceCache.js`
    as the concrete cache class and update `incident-radiance/types.d.ts` for
    cache descriptors, build coordinates, access packets, keys, and generated
    value storage.
  - References: `algorithm32-abstraction-design.md`,
    `local-sun-flat-geometry-fact-inventory.md`,
    `tmp/atmosphere/local-second-order/009-local-incident-field-oracle`, and
    `tmp/atmosphere/local-second-order/011-local-cache-shape`.
  - Verification: cache key equality, coordinate bounds checks, descriptor
    fingerprint checks, and fail-loud rejection for mismatched geometry/source
    context.

- Stage 4.1.2: Coordinate cache building through the shared calculator.
  - Code: add the cache-build coordinator that loops cache-owned coordinates,
    asks geometry for representative rays/access facts, calls the shared
    calculator with incident sampling omitted, and stores
    `PathRadiance.inScattered`.
  - Files/classes: update `setup/buildIncidentRadianceCache.js`,
    `setup/types.d.ts`, `calculator/SpectralCalculator.js`, and local cache
    classes; do not move the cache coordinate loop into the main evaluation
    algorithm.
  - References: cache-builder design in `algorithm32-abstraction-design.md`,
    `tmp/atmosphere/local-second-order/012-cpu-soft-shader-local-l2`, and
    `shared/algorithm32/POC/local-second-order/`.
  - Verification: direct/oracle incident-field comparison, nonzero local L2
    where expected, zero contribution where geometry/source visibility blocks
    it, and no cache recursion.

#### Subgoal 4.2: Local GPU Cache Payload And Shader Lookup

- Stage 4.2.1: Pack local cache payloads for GPU.
  - Code: add shader payload export, texture packing, lookup descriptors,
    spectral grouping, direction-index metadata, and CPU-side unpack
    diagnostics.
  - Files/classes: add a local cache payload packer class under `shader/` or
    `incident-radiance/`, update shader payload types, and keep Three texture
    creation in shader-facing code rather than the CPU calculator.
  - References:
    `tmp/atmosphere/local-second-order/020-three-integrated-gpu-local-l2`,
    `local-sun-flat-geometry-fact-inventory.md`, and Three `Data3DTexture`
    usage in the historical POC.
  - Verification: CPU pack/unpack roundtrip, texture dimension checks,
    descriptor equality, and sampled cache value parity at named coordinates.

- Stage 4.2.2: Integrate local-source shader lookup.
  - Code: add local-source shader uniforms, source-relative direction frame,
    cache lookup, phase weighting, and scene/display composition.
  - Files/classes: add or update a local/flat shader builder class and GLSL
    sources; extend shader descriptors and browser diagnostics without adding
    local-source branching to the distant/spherical shader class.
  - References: shader-lab local records
    `219-220-three-native-flat-local-first-order-atmosphere`,
    `179-185-local-sun-full-image-shader-parity`, and local-second-order
    records `020` and `021`.
  - Verification: CPU/GPU selected-pixel parity, source-direction sign
    convention checks, cache/no-cache comparison, and browser image metrics.

#### Subgoal 4.3: Local/Flat Integrated Evidence Recreation

- Stage 4.3.1: Recreate required objective records.
  - Code: add runners for module/reference parity, cache shape/key checks,
    CPU soft-shader local L2, GPU integrated local L2, and CPU/GPU
    selected-pixel parity.
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
  - Files/classes: update `POC/CURRENT_STATE.md`, reconciliation README/status
    docs, and provenance/ledger notes; create no new runtime classes for
    closeout classification.
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
    local/flat, browser capabilities, cache descriptors, shader payloads, and
    subjective/review outputs.

Exit criteria:

- GPU local/flat output matches the accepted local-source behavior within
  recorded criteria, or every mismatch is classified.
- Required objective and subjective/review evidence from shader-lab and
  local-second-order is recreated or explicitly scoped out.
- Current-state notes identify the final accepted local/flat shader state,
  remaining production-promotion blockers, and canonical evidence records.
