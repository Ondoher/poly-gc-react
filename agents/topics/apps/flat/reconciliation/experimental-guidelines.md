# Reconciliation Experimental Guidelines

Status: active guidelines for the planned reconciliation lane.

These guidelines govern the mutable reconciliation POC and its numbered
evidence records under:

- `scripts/flat/reconciliation/POC/`
- `tmp/atmosphere/reconciliation/`
- `agents/topics/apps/flat/reconciliation/`

They are mined from the accepted local-second-order lane, the Bruneton
start-fresh clean-room lane, and the atmosflat32 source-abstraction lane.
Those older lanes remain evidence and process sources; this document is the
current operating guide for reconciliation.

## Source Authority

- Every promoted equation, constant, approximation, display choice, and
  validation expectation must have an explicit source trail.
- Valid authority is an external source, a source-backed derivation, or an
  accepted Algorithm32 experiment/decision. Local POC code is implementation
  evidence, not automatic physics authority.
- Historical POC code may be read, mined, copied, or ported into the
  reconciliation POC with provenance. The reconciliation POC must not import,
  symlink, require, re-export, or otherwise runtime-link to old code where it
  currently lives, including preserved POC bundles and earlier experiment
  scripts.
- Subjective review may select the accepted Algorithm32 baseline among
  source-backed candidates and may explain why a sourced option was retained
  or omitted. It does not justify unsourced equations, constants, or hidden
  display tuning.
- The accepted Step 032 result is the firm baseline for future atmosphere
  experimental lanes. A later lane may intentionally deviate from it only when
  the artifact names the changed equation, constant, approximation, display
  choice, or data-flow contract; records the source, derivation, or accepted
  experimental reason; and evaluates the effect against the baseline.
  Unrecorded or unjustified drift from Step 032 is a failed artifact, not a
  new default.
- Old local renders, logs, summaries, rejected atmosphere code, and older docs
  are not sources for constants, expected colors, visual targets, or
  algorithmic truth unless the reconciliation artifact explicitly identifies
  them as accepted Algorithm32 evidence.
- If an already-downloaded file is used as an external source, the artifact
  report must explain why it is primary/external material rather than a local
  summary or prior implementation.
- Bootstrap and README files are routing aids. They may identify where
  evidence lives, but they are not independent physics authorities.
- Short-lived scalar proxies and visual approximations are allowed only as
  diagnostics. They must be labeled as such and replaced by sourced transport,
  source, geometry, cache, or display decisions before promotion.

## POC And Record Contract

- Reconciliation is a full mutable POC lane, not a cumulative sequence of
  self-contained rerunnable experiments. The living implementation belongs
  under `scripts/flat/reconciliation/POC/`.
- Milestone 0 is scaffold preparation, not a formal experiment. It can be
  accepted when the mutable skeleton exists, even if that skeleton is imperfect
  and will be iterated later. Use current-state notes for Milestone 0 handoff;
  do not require a numbered record for scaffold-only work.
- Preserve work history through numbered record folders under
  `tmp/atmosphere/reconciliation/`. Each significant run, checkpoint, parity
  target, rejected attempt, or design-verification step gets a new `NNN-*`
  folder after scaffold preparation. Inspect existing `NNN-*` folders and
  choose `max(existing NNN) + 1`.
- Numbered folders are the audit trail of what changed, when, why, what was
  checked, and what evidence or references were found. They may describe a
  mutable POC state instead of containing a fully rerunnable standalone
  experiment.
- Once a numbered folder exists, do not rewrite it into a different result,
  rename it to hide a failed attempt, or reuse its number for a later run. If a
  run is wrong, failed, or superseded, keep that folder as evidence and create
  the next `NNN-*` folder.
- Every numbered folder must declare its state goal before the run or
  checkpoint and end as `accepted`, `rejected`, `superseded`, or `blocked`.
- Rejected and superseded records stay visible. Do not delete them after a
  later record succeeds.
- Do not delete untracked files, numbered artifact folders, downloaded/source
  files, scratch outputs, logs, or JSON reports. If work must be undone, prefer
  a new numbered record or a tracked-doc/code edit.
- The artifact root must contain an append-only `running-log.md` with a short
  entry per numbered record: status, what changed, what was learned, and the
  next suggested step.
- When practical, write a started log entry before a long run and complete it
  afterward so crashes are recoverable.
- Mutable current-state notes are encouraged in parallel with numbered
  records. They may live in reconciliation topic docs, status docs, or a POC
  `CURRENT_STATE.md` once the POC root exists. These notes should summarize
  the current architecture, parity status, active blockers, latest accepted
  record, and next actions. They may be rewritten as the POC changes, but they
  must not replace numbered records or erase rejected/superseded history.

Each non-scaffolding numbered record should include:

- `state-goal.md`
- `inputs.json`
- `command.json`
- `result.json`
- `provenance.json`
- `equations-and-constants.json`
- `criteria-results.json`
- `diagnostics.json` or `diagnostics/`
- `report.md`
- `run.log`
- rendered images, plots, or comparisons only when they are part of that
  record's evidence

Missing files are acceptable for early scaffolding only when `report.md` or
`result.json` says why they are absent.
Record artifact and evidence gaps unless they are egregious. Egregious gaps
are gaps that remove the accepted hard target or make the current milestone's
verification claim impossible. The hard artifact rule for this lane is that
Milestone 1 must match the sky dome/four-view artifacts created by the
Bruneton start-fresh Experiment 32 / Step 032 baseline under
`tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline`.
Other missing diagnostics, criteria files, galleries, or historical
convenience artifacts are recorded findings unless they block that hard claim
or the specific milestone claim being made.

## Ambient Type Contract

- Any complex POC type must have a named ambient declaration in an owning
  `types.d.ts` file before implementation code relies on the shape.
- Complex types include object packets, descriptors, requests, samples,
  callbacks, handles, diagnostics, generated records, shader payloads, cache
  keys, and persisted artifact shapes. Primitive local scalars do not need
  ambient declarations.
- Use the nearest clear owner for the ambient declaration: shared cross-module
  packets in a shared/root `types.d.ts`, and implementation-only or
  module-private complex packets in that module's local `types.d.ts`.
- JavaScript implementation files should use JSDoc to record those ambient
  types at parameters, returns, properties, callback signatures, and important
  local handoff values. Do not leave reusable object shapes to be inferred
  from ad hoc object literals.
- If a complex shape changes, update its ambient declaration and the JSDoc use
  sites in the same implementation step. Let stale consumers fail loudly
  rather than preserving shadow aliases.

## Runtime Module Contract

- Runtime class modules should use one file per class, with that class as the
  file's single default export.
- Runtime class files should not define reusable complex type shapes inline.
  Required complex types belong in the owning `types.d.ts` file, and the class
  file should reference them with JSDoc.
- Do not create abstract runtime base classes just to represent interfaces.
  Interface contracts live in ambient types and are enforced by validation,
  smoke checks, and fail-loud setup behavior.
- Small stateless utility modules may export functions when a class would add
  no lifecycle or ownership value, but if a module defines a class, that class
  is the only export.

## Inputs And Provenance

- `inputs.json` must record resolved, serializable inputs with units or
  semantic kind beside numeric scalars and arrays.
- Runtime objects may carry behavior, but artifacts, reports, cache keys, and
  diagnostics must serialize the canonical input data needed to reproduce that
  behavior.
- Each run must record enough inputs, provenance, criteria, diagnostics, and
  implementation version data that a compacted agent can understand what was
  tested without rereading temporary scripts.
- Record script entry point, command options, source fixture paths, relevant
  production/POC module paths, and the reason each evidence source is allowed.
- Machine-readable constants and equations belong in
  `equations-and-constants.json`; human explanation belongs in `report.md`.

## Criteria And Validation Tiers

Use four validation tiers:

1. Hard identities and invariants.
2. Objective demonstration checks.
3. Convergence-backed numerical thresholds.
4. Display-only subjective checks.

Hard checks include composition identities, finite and nonnegative radiance
where expected, transmittance bounds, source-kind ownership, cache-key
ownership, no-atmosphere passthrough, and accepted distant-control parity.

Objective demonstration checks include source direction/distance/incident
scale changing with source configuration, local second-order being nonzero and
attributable, and CPU/GPU diagnostics agreeing on the same configured sample.

Convergence checks compare a direct/oracle calculation against the
approximation being tested. Arbitrary thresholds are experiment thresholds,
not physics constants.

Images can play two roles. They are subjective review evidence when a human is
judging appearance. They are objective regression evidence when the artifact
defines a deterministic image-generation path, names the comparison target,
and evaluates machine-readable criteria such as byte equality, max/mean RGB
delta, RMSE, or another recorded image metric. A visual comparison sheet can
therefore prove "we maintained the same Algorithm32 result" for a scoped
baseline, even if that accepted baseline was originally selected by
subjective review among source-backed candidates. It does not prove physics
correctness unless the target and criteria are source-backed for that claim,
and it does not make unsourced retained ingredients promotable.

Criterion statuses are:

- `pass`: evaluated and within the stated threshold.
- `fail`: evaluated and outside the stated threshold.
- `unresolved`: data exists, but a needed convergence, diagnostic, or
  classification run has not happened.
- `not-applicable`: outside the current artifact scope.

Each criterion entry should include the criterion id, status, tolerance,
measured error or effect size, affected scenes/rays/files, and whether the
criterion is source-backed, algorithmic, or a display/review check.

## Tolerance Policy

- Use an accepted evidence artifact's own `criteria-results.json` thresholds
  when they exist.
- If a new extraction, reference, cache, or shader-parity tolerance is needed,
  record it in `equations-and-constants.json` and `report.md` before
  evaluating the result.
- Do not loosen a threshold to make an artifact pass.
- If copied evidence lacks enough data for a claimed pass, mark the criterion
  `unresolved` or generate a fresh reconciliation artifact.
- When a mismatch appears, classify it before continuing. Useful categories
  include source-adapter data mismatch, transmittance mismatch, cache-key or
  lookup mismatch, floating operation-order change, display conversion or PNG
  encoding difference, shader precision/packing difference, and artifact-tool
  error.

Useful default gates when no better accepted criterion exists:

- normalized direction component max absolute delta: `<= 1e-12`
- unit-vector angle delta: `<= 1e-9 deg`
- scalar source/config values: exact JSON equality unless the value is a
  floating result of the extracted algorithm
- floating radiance/transmittance diagnostics: absolute delta `<= 1e-12` or
  relative delta `<= 1e-9`, whichever is less strict near zero
- CPU display RGBA byte parity: exact unless comparing against a browser/GPU
  render path
- browser/GPU display RGBA byte parity: `maxAbsRgbDelta <= 1` only when the
  artifact explicitly names browser/GPU parity

## CPU Reference Before GPU

- Build and trust the CPU reference before accepting cache or shader
  approximations.
- Direct trace or direct/oracle transport is the first authority for new
  transport behavior.
- Cache builders, shader sampling, and packed texture lookup are optimized
  approximations. Compare them back to the direct/oracle path or accepted CPU
  reference.
- Preserve an accepted distant-Sun regression oracle when changing source,
  geometry, cache, display, or shader boundaries.
- Local flat-Sun behavior does not have an objective real-world validation
  target. Treat it as internal consistency, limiting-case, and
  implementation-parity validation, with distant-Sun behavior carrying the
  physical/reference validation path.
- An optional real-Sun-matched local-source experiment may compare a finite
  local Sun against the distant/real-Sun source path on the same canonical
  spherical geometry by configuring the local source to match apparent
  direction, angular size, incident spectral scale or calibration target,
  atmosphere profile, numerical controls, and view configuration at a
  reference point. Classify this as limiting-case/source-geometry-separation
  evidence. It can reveal implementation drift, geometry-driven divergence, or
  improper coupling between local-source and flat-geometry code, but it does
  not turn the local Sun model into an external real-world validation target.
  Record the explicit source/geometry handoff facts used to make the match:
  frame, observer/root position, resolved source position, distances, angular
  size or solid angle, source-path clipping, falloff inputs, calibration
  reference event, and spectral incident scale.

## Source, Geometry, And Cache Rules

- Keep the Algorithm32 transport accumulator source-neutral.
- Source-specific behavior belongs in source objects, geometry helpers,
  incident-field implementations, cache-plan adapters, or shader-resource
  builders.
- Source/geometry separation does not mean a light source is geometry-blind.
  Light amount may depend on geometry-resolved position, distance, apparent
  size, and path facts. The rule is that those facts cross the boundary as
  explicit request data or resolved descriptors, not as hidden access to a
  geometry model's private state.
- Missing or unsupported source/geometry/cache combinations must fail loudly.
  Do not fall back to default high Sun, distant cache, first-order-only local
  source, stale cache, or no-cache behavior when an artifact requests more.
- Cache keys must include every source, geometry, profile, spectral,
  numerical, cache-resolution, and packing input that can change the stored
  incident field.
- A stale cache must be rejected or explicitly superseded.
- Define the logical cache contract before choosing GPU texture packing.
- Source path transmittance, source distance, and source falloff must be
  separate diagnostics. Do not hide them inside extinction, exposure, or RGB
  tuning.
- Geometry owns path endpoints, hit distance, ray limits, and boundary policy.
  Renderer-only sky caps or scene limits must not leak into source
  transmittance unless the geometry contract explicitly says so.

## Scene, Shader, And Lighting Rules

- CPU reference, CPU soft-shader tools, and GPU shader code must consume the
  same logical inputs where they overlap: scene color, depth or hit distance,
  hit mask, camera/ray data, geometry configuration, source configuration,
  cache configuration, numerical policy, display policy, and diagnostics
  policy.
- JSON scene packets are oracle/debug artifacts. The production-shaped GPU
  target is the Three-native atmosphere pass over live scene color and depth
  render targets.
- Three lighting and Algorithm32 scattering must be driven by the same source
  configuration. Three light transforms can render surfaces, but they must not
  replace the configured source position, distance, falloff, or source-path
  transmittance used by Algorithm32 transport.
- Prove no-atmosphere passthrough and unlit parity before lit/shadow
  composition.
- Selected diagnostics and full-image diffs both matter. Selected diagnostics
  explain the path; full-image deltas prove the shader is not only correct at
  handpicked pixels.
- GPU/browser artifacts must record WebGL vendor/renderer diagnostics so
  software fallback is visible.

## Browser Harness Rules

- Browser watchers may be implemented before the GPU milestones, but running
  the long-lived browser process is a user-run step when sandbox restrictions
  prevent the agent from launching or controlling the browser directly.
- Use a watcher only when the artifact needs a long-lived browser. Do not
  create duplicate watchers for one lane.
- Do not document live watcher state. Inspect heartbeat/process state at
  execution time.
- Browser commands should go through the lane command file when a watcher is
  active.
- Page crashes, closed pages, Puppeteer disconnects, unexpected harness
  errors, and browser-side evaluation errors must produce rejected artifacts
  instead of silently stopping the lane.
- Browser evaluation timeouts are recovery-required. Do not keep taking
  screenshots or reading canvases from a page that may still be doing WebGL
  work after the timeout.
- Hardware WebGL is the normal integrated-shader path. Use SwiftShader or other
  software fallback only for explicit fallback diagnostics.

## Display And Reporting Rules

- Spectral or transport-domain values are the proof. PNGs, contact sheets,
  plots, comparison overlays, and galleries are review aids generated from
  recorded data.
- Those same PNGs, contact sheets, plots, comparison overlays, and galleries
  may also be objective regression evidence when the artifact records a stable
  target and evaluates numeric criteria against it. In that case, the report
  must name the scoped claim, such as "matches accepted Algorithm32 Figure 1
  baseline" or "preserves shader-off passthrough", rather than implying broad
  physical validation.
- Display images must be derived from the same recorded transport/display
  outputs used by the criteria. Do not use a hidden render path to satisfy
  acceptance criteria.
- Use one fixed display mapping for comparable images inside a single
  artifact.
- If an auto-exposed, normalized, or alternate tone-map image is useful for
  human inspection, label it display-only.
- Do not use hidden RGB grading, image-space darkening, per-case exposure, or
  per-case tone-map changes to make results look plausible.
- Color/display conversion is outside CPU transport, but the GPU shader phase
  needs the color/display interface to produce renderable output.
- Review-quality terrain imagery may use antialiasing/supersampling when
  judging directional-light terrain detail. Objective low-cost renders remain
  acceptable when pixel-level presentation is not under review.
- The Bruneton start-fresh Step 032 artifact is an example of this dual use.
  The external Bruneton comparison sheet documents where the Figure 1 visual
  target came from, but reconciliation regression should compare against the
  accepted generated Experiment 32 outputs, not directly against the external
  paper tiles. The primary image targets are:
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/figure1-06h00-z87-figure1-four-view-source-k-no-ground.png`,
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/figure1-10h15-z41-figure1-four-view-source-k-no-ground.png`,
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/figure1-11h15-z31-figure1-four-view-source-k-no-ground.png`,
  and
  `tmp/atmosphere/bruneton_start_fresh/032-figure1-four-view-source-k-no-ground-baseline/figure1-13h15-z21-figure1-four-view-source-k-no-ground.png`.
  A reconciliation artifact may also compare generated contact sheets, but the
  scoped claim is "maintains the accepted Experiment 32 Algorithm32 baseline,"
  with the external Bruneton images retained as source/provenance context.
  This Step 032 sky dome/four-view match is the lane's hard artifact rule.
  The original acceptance of this visual baseline was subjective; the
  reconciliation task is to preserve that accepted result and verify that the
  retained algorithms, constants, and display choices still carry explicit
  source trails.

## Closeout Rules

- After an accepted milestone, update the relevant reconciliation and
  Algorithm32 docs with what changed, what was verified, and what remains.
- After a documented dead end, record why it failed and what diagnostic or
  design decision follows.
- Promote only accepted, source-backed contracts into production docs/code.
- Keep one canonical owner for each production fact. Do not duplicate constants
  or ownership facts across manifests, sidecars, docs, and generated artifacts
  unless one is explicitly the canonical source and the others are derived
  reports.

## Source Notes

Mined source docs:

- [Local Sun Second-Order Experiment Plan](../plans/atmosphere-cleanroom-design/local-sun-second-order/experiment-plan.md)
- [Bruneton Start-Fresh Prompt](../plans/atmosphere-cleanroom-design/legacy-reference-docs/plans/bruneton-start-fresh-prompt.md)
- [Atmosflat32 Source Abstraction Prompt](../plans/atmosphere-cleanroom-design/atmosflat32-source-abstraction-prompt.md)
