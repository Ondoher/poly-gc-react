# Reference Test Plan

This document is the actionable test plan for the CPU spectral atmosphere
reference integrator. It sits between [Test Design](test_design.md), which
defines the stage-level matrix and domain rationale, and [Plan](plan.md), which
tracks implementation work for the package.

## Purpose

Keep the test sequence explicit enough that each stage can move through a
test-first loop without losing the domain intent. The detailed execution
runbook below is the authority for moving a stage from `pending` to
`complete`.

The focused command is:

```text
npm run test:scripts:flat
```

## Test Rules

- Stage tests are the authority for physical behavior right now.
- Integration tests may check composition, packet flow, and stage history, but
  they do not prove physical correctness until the composed stages have isolated
  known-answer coverage.
- Integration tests must also validate adjacent stage output expectations
  against the next stage's input expectations: packet field names, array/object
  shapes, units, distance semantics, and diagnostic identifiers should line up
  in at least one real producer-to-consumer path.
- When such a mismatch is found, update the canonical packet contract instead
  of adapting to both shapes. Favor the data form most useful to downstream
  stages, keep one source of truth, and carry cheap derived values only when
  they reduce real downstream ambiguity or model re-querying.
- Tests must express domain expectations, not implementation shape.
- Expected values should come from physics, math, public API contracts,
  analytic known answers, invariants, or pinned external/reference fixture
  data.
- Do not justify one new local implementation with another new local
  implementation.
- Every expected datum needs a nearby derivation note. In JSON fixtures, use
  the canonical `reference` object and `expected.<quantity>.derivation` fields.
- JSON fixture rows must carry enough metadata to justify fixture-backed
  assertions without extra test comments: stable id, stage, quantity,
  sourceClass, canonical reference, assumptions, inputs, expected output or
  expectedError, per-datum units or semantic kind, derivation/provenance,
  tolerance or explicit structural comparison policy, and an independence
  note.
- Direct assertions that do not compare against fixture-owned expected values
  need a nearby reason/source comment. This includes stage descriptor checks,
  prerequisite failures, helper behavior, stage history, input immutability,
  adapter call shapes, metadata counts, and packet-shape assertions.
- Implemented algorithm steps need source breadcrumbs too, not only error
  cases. Cite the equation, source section, fixture row, or local design
  contract that justifies the positive computation or selection rule.
- Each meaningful code branch needs a reason/source breadcrumb when it becomes
  implemented behavior: positive paths, default/fallback paths, validation
  rejects, optional-field handling, ownership choices, numerical tolerances,
  rounding policies, and packet-preservation choices.
- Tests may assert that required fields are present. Do not assert that a field
  is absent unless the field is mutually exclusive with another accepted field.
  Prefer positive output-contract assertions over "no extra field" shape checks.
- Geometry-derived values belong in geometry/model-helper tests. A stage such
  as `resolveRayPath` should test how it consumes model-returned data, not how
  a model computed that data.
- Physical behavior proceeds in canonical pipeline order unless the user
  explicitly scopes an exception.

## Stage Status Values

Use these values for the current state of each canonical stage:

| Status | Meaning |
| --- | --- |
| `pending` | Not started. |
| `identified` | Tests or test scope has been identified. |
| `skeleton` | Test cases are defined and pending in the spec file. |
| `fixtures` | Fixtures have been created and sourced. |
| `tests` | Tests have been created and are failing. |
| `coded` | Code has been written and is not yet green. |
| `complete` | Code has been written and all tests are green. |

If a completed stage later needs follow-up work, keep the main stage status
separate from the follow-up. Add a `Follow-Up` section under that stage, record
notes, and move the follow-up through the same status sequence according to the
real work completed. For example, a follow-up with sourced fixture rows but no
active failing tests is `fixtures`, not `pending`.

## Stage Execution Runbook

Use this sequence for each canonical stage or stage follow-up. A fresh agent
should be able to execute the stage by following these steps in order.

### 1. Move From `pending` To `identified`

Start from the next canonical stage in [Current Stage Order](#current-stage-order)
unless the user explicitly scopes a follow-up or exception.

Do the identification work before creating or editing tests:

- Read [Code Design](code_design.md), [Test Design](test_design.md), the
  canonical [Stage Contracts](stage_contracts.md), the current stage helper,
  the existing stage spec, and relevant fixture files.
- Define exactly what this stage owns. Name the packet fields it consumes, the
  packet fields it produces, and any computations that belong to later stages.
- Choose the output shape that is most useful downstream. Keep one source of
  truth for each fact, and avoid compatibility aliases unless the user
  explicitly asks for a migration bridge.
- List representative positive cases for normal behavior.
- List positive extremes: edge valid cases that should be accepted. Use
  sourced physical/data bounds when the case represents Earth atmosphere,
  standard spectral data, air mass, solar data, or another real quantity. Use
  explicitly named local API/model hypotheses when the case is a design
  boundary rather than a physical fact.
- List negative extremes: just-outside, malformed, contradictory, or invalid
  cases that this stage should reject. Pair these with the corresponding
  positive extremes wherever possible.
- For every planned expected value, identify whether it will come from an
  authoritative table, metadata/checksum, analytic invariant, external-tool
  artifact, or local API/schema contract.
- Record blocked source needs rather than inventing values. If a physical
  extreme has no defensible source yet, mark it as blocked or defer it to a
  later fixture family.
- Update this document and [Status](status.md) with the stage status
  `identified`, the planned case inventory, the source needs, and any blocked
  items.

Do not advance beyond `identified` until normal cases, positive extremes,
negative extremes, and source needs are visible in the docs.

### 2. Move From `identified` To `skeleton`

Create pending test shells that preserve the identified intent:

- Put the shells in the focused stage spec under
  `scripts/flat/atmosphere_rejected/reference/stages/_tests`.
- Use one `describe` for each stage, and a nested `describe` for a follow-up
  batch when the main stage is already complete.
- Name each pending `it` from the domain expectation, not the expected helper
  implementation.
- Keep the skeleton list complete enough that context compaction will not lose
  the planned normal, positive-extreme, and negative-extreme coverage.
- Do not add assertions yet unless the expected data is already available and
  the user has asked to proceed directly to active tests.
- Update [Status](status.md) and this document to `skeleton`.

### 3. Move From `skeleton` To `fixtures`

Create sourced fixture rows before active tests whenever expected data needs
reviewable provenance:

- Add rows under
  `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures`.
- Include a stable `id`, `stage`, quantity under test, `sourceClass`,
  canonical `reference`, assumptions, inputs, expected output or
  `expectedError`, tolerance for expected data, and an independence note.
- Put derivation notes beside the expected values, not only in prose docs.
  Every expected datum needs `value`, `units` or a semantic kind, and
  `derivation`. Numeric expected data needs an exact/absolute/relative
  tolerance rule. Nonnumeric expected data needs an explicit datum-level or
  file-level structural comparison policy.
- Expected-error rows need an error type, message-context fragments, a
  derivation/provenance note, and an independence note just like value rows.
- Physics/math rows must cite external sources. API/schema rows may cite local
  design docs, but those docs must explain the owning rationale.
- Favor data sources over algorithms for real-world expected data. Use table
  rows, dataset metadata, checksums, or external-tool artifacts before local
  generated values.
- Use analytic fixtures for closed-form toy domains such as Beer-Lambert,
  zero path, homogeneous media, isotropic phase, and Lambertian surfaces.
- If a value is a local API/schema contract, cite [Code Design](code_design.md)
  or [Test Design](test_design.md) and make clear it is not a physical
  constant.
- Do not test field absence unless the field is mutually exclusive with
  another accepted field. It is fine to test required fields are present.
- Run the focused fixture validation through `npm run test:scripts:flat`. At
  this status, only fixture-envelope validation should need to pass; stage
  behavior tests may still be pending.
- Update fixture source readiness in [Fixture Sources](fixture_sources.md) and
  reference decisions in [Reference Decision Log](references.md) when a source
  changes a value range, assumption, or fixture decision.
- Update [Status](status.md) and this document to `fixtures`.

### 4. Move From `fixtures` To `tests`

Wire the fixture rows into active failing tests:

- Replace the pending shells with active tests that compare input to expected
  output.
- Test input-to-output behavior for the stage under test only. Do not prove a
  geometry/model helper inside a transport-stage test.
- Assertions that directly compare fixture expectation values can rely on the
  fixture derivation. Any additional assertion that is not directly explained
  by the fixture must include a nearby reason and source comment.
- Shared helpers introduced for a fixture-backed test must also have source
  breadcrumbs when they enforce API shape, normalize fixture data, choose
  tolerance behavior, or materialize encoded non-JSON values such as `NaN` or
  `Infinity`.
- Test required output fields by presence/value. Do not assert ordinary field
  absence unless mutually exclusive fields make absence part of the domain
  contract.
- Code should validate the consumed input shape while tolerating unrelated
  extra fields. Code may require field absence when the input contract defines
  mutually exclusive alternatives. Tests may provide extra input fields, then
  assert the contracted output fields and values for the stage under test.
- Include both positive and negative extreme tests from the identified
  inventory, unless a case was explicitly blocked for lack of source data.
- Run `npm run test:scripts:flat` and confirm the new tests fail for the
  expected missing behavior or placeholder behavior. If they fail because the
  fixture is malformed or the test contradicts the stated domain rule, fix the
  test or fixture before coding.
- Update [Status](status.md) and this document to `tests`, recording the red
  failures clearly enough that the next agent knows what implementation work is
  required.

### 5. Move From `tests` To `coded`

Implement the smallest stage behavior that addresses the red tests:

- Edit only the stage/helper code and narrowly required shared utilities or
  ambient types.
- Follow existing packet shapes and helper patterns before inventing new
  abstractions.
- Each implemented algorithm branch or validation decision needs a nearby
  source breadcrumb. Use external physics/math references for physical
  equations and local design docs for API/schema decisions.
- Breadcrumb comments should explain why the branch exists and what source
  owns it. Cover positive computations, validation/error branches, no-op or
  empty-output branches, default behavior, optional-field behavior, model-call
  ownership, packet mutation/immutability choices, and numerical tolerances or
  rounding.
- Do not leave source rationale only in code comments. If the branch adds or
  clarifies a policy, add the policy to the owning source/design document
  before marking the stage complete.
- Keep validation at the stage boundary for values the stage consumes. Prefer
  concrete JSDoc types for expected packet shapes, and use runtime checks for
  finite values, nonnegative coefficients, spectral-array alignment, and other
  domain constraints.
- If a code decision changes a stage input/output contract, update
  [Stage Contracts](stage_contracts.md) before or with the implementation.
  Update [Code Design](code_design.md) when the rationale, model interface, or
  algorithm decision also changes.
- Run `npm run test:scripts:flat`. If tests are still red after code has been
  written, the status is `coded`. Record the remaining failures in
  [Status](status.md).

### 6. Move From `coded` To `complete`

Close the stage only after implementation and documentation are both green:

- Run `npm run test:scripts:flat` and verify 0 failures.
- Run `git diff --check`.
- Update [Status](status.md) with what changed, what was verified, and what
  remains next.
- Update this document with the completed batch state and any final fixture
  notes.
- Update [Reference Decision Log](references.md), [Fixture Sources](fixture_sources.md),
  [Stage Contracts](stage_contracts.md), and [Code Design](code_design.md) if
  implementation changed a source, fixture assumption, API shape, stage
  contract, or algorithm decision.
- Before closing, audit the stage code, direct spec, shared helper changes,
  fixtures, fixture validator coverage, and source/design docs against the
  traceability rules above. A stage is not complete while a known branch,
  direct assertion, helper policy, fixture datum, or source/design rationale is
  missing its breadcrumb.
- If new work is discovered but not required to complete the current batch,
  add a follow-up section with status `pending`, notes, and source needs. Do
  not leave the main stage half-complete because optional follow-up work exists.

The stage is `complete` only when the code has been written, the focused tests
are green, and the relevant docs reflect the current state.

## Current Stage Order

| Order | Stage | Status | Notes |
| --- | --- | --- | --- |
| 1 | `validateRequest` | `complete` | Implemented with direct stage tests. |
| 2 | `resolveRayPath` | `complete` | Current fixture-backed and hardening batches are green. |
| 3 | `sampleViewPath` | `complete` | Current midpoint-sampling fixture-backed batch is green. |
| 4 | `evaluateMedium` | `complete` | Current contract and follow-up extreme batches are green. |
| 5 | `integrateViewOpticalDepth` | `complete` | Main analytic/toy-domain direct stage tests are green; adjacent packet compatibility now lives in the integration handoff spec. |
| 6 | `integrateSolarTransmittance` | `complete` | Controlled source-path and contract-alignment batches are green. |
| Follow-up | implemented-stage source-breadcrumb audit | `complete` | Completed before stage 7; future stages must preserve these standards through the [Stage Execution Runbook](#stage-execution-runbook). |
| 7 | `evaluateScatteringPhase` | `complete` | Explicit isotropic, Rayleigh, and Henyey-Greenstein phase behavior, angle diagnostics, empty output, and unsupported phase-kind rejection are green. |
| 8 | `integrateSingleScattering` | `complete` | One-sample product, empty output, and negative source-term rejection are green. |
| 9 | `resolveSurfaceRadiance` | `complete` | Black/white Lambertian controlled-model rows and no-hit output are green. |
| 10 | `composeSpectralRadiance` | `complete` | Wavelength-by-wavelength component summation, bright unclamped output, and negative rejection are green. |

All canonical transport stages now have direct stage implementations for their
first sourced or API-contract batch. The completed implemented-stage
source-breadcrumb audit remains captured as future-stage traceability
requirements in the [Stage Execution Runbook](#stage-execution-runbook).

## Test File Ownership

Keep the flat-reference specs split by ownership so integration work does not
hide registry or facade behavior:

- `_tests/pipeline-stages.spec.js`
  - Owns stage-registry mechanics only: canonical order, stage descriptors,
    `StageClass` availability, unknown stage ids, and prerequisite helper
    behavior.
  - Do not add integrator facade API coverage here.
- `_tests/CpuSpectralReferenceIntegrator.spec.js`
  - Owns the integrator facade contract: construction/configuration, request
    merging, initial packet creation, stage lookup/dispatch through the facade,
    partial pipeline execution, full `traceRay` orchestration, probe
    resolution, reuse/immutability, custom stage harness behavior, and public
    result-boundary decisions.
  - This file should stay focused on integrator API behavior, not full
    physical acceptance fixtures.
- `_tests/pipeline-handoffs.spec.js`
  - Owns adjacent producer/consumer packet compatibility. Examples:
    `sampleViewPath -> evaluateMedium`, `evaluateMedium ->
    integrateViewOpticalDepth`, `integrateSolarTransmittance ->
    evaluateScatteringPhase`, and `resolveSurfaceRadiance ->
    composeSpectralRadiance`.
  - These tests use controlled adapters and short partial or full runs to prove
    field names, units, diagnostics, and array shapes line up between stages.
- `_tests/trace-ray.integration.spec.js`
  - Owns full end-to-end `traceRay` acceptance fixtures now that the canonical
    stages and integrator public result contract are implemented.
  - This file owns final `spectralRadiance`, component diagnostics, and stable
    public result shape for complete-pipeline fixtures.

`pipeline-stages.spec.js` now keeps registry coverage only. The former scaffold
handoff regression has moved to `pipeline-handoffs.spec.js`, which also covers
source-data, phase, surface, and composition handoffs. Full physical trace-ray
acceptance fixtures live in `trace-ray.integration.spec.js`.

`_tests/CpuSpectralReferenceIntegrator.spec.js` owns executable facade-domain
coverage for the domains below. Facade-owned cases have been extracted from
`pipeline-stages.spec.js`; full physical trace-ray acceptance fixtures stay in
`trace-ray.integration.spec.js`.

### `CpuSpectralReferenceIntegrator` Test Domains

Cover these domains in `_tests/CpuSpectralReferenceIntegrator.spec.js`:

- Construction and configuration: default context storage, model/wavelength/
  numerical defaults, internal custom stage-list harness behavior, and loud
  rejection of non-array, duplicate-id, or helper-less custom stage descriptors.
- Request merging: request values override integrator defaults, numerical
  controls merge shallowly, and request objects are not mutated.
- Initial packet creation: canonical packet envelope, request/model/observer/
  ray/wavelength/numerical fields, and empty `stageHistory`.
- Stage lookup and dispatch: `getStage`, `listStages`, `runStage`, unknown
  stage errors, missing prerequisite errors, and helper dispatch from
  descriptor `StageClass`.
- Partial pipeline execution: `runUntil(stageId, request)`, exact stage-history
  prefix, stop-at-stage behavior, and unknown target stage errors.
- Full ray tracing orchestration: `traceRay(request)` composes all configured
  stages in order and returns the full public diagnostic packet shape.
- Probe resolution: `resolveProbeRequest`, inline probe pass-through, nested
  `probe.request`, scalar/name-only probe rejection until a named registry
  exists, and `traceProbe` using the same pipeline as `traceRay`.
- Immutability and reuse: reusable integrator defaults are not mutated,
  input requests/probes are not mutated, and repeated runs do not leak packet
  state.
- Custom stage harness behavior: test-supplied stages can replace canonical
  stages for internal harness tests, helper instances receive
  descriptor/context, and execution uses the configured order. This is not an
  official public package/API contract.
- Public result boundary: `traceRay` returns the full internal packet, including
  public diagnostic `stageHistory`. Keep full physical acceptance assertions out
  of this facade spec.

## Implemented-Stage Source Breadcrumb Audit

Follow-up status: `complete`.

This audit applies the existing traceability rule to all completed stages,
their tests, their shared helpers, and their fixture rows. The full deficiency
list and remediation sequence live in
[Plan](plan.md#immediate-remediation-implemented-stage-source-breadcrumb-audit).

Progress:

- `EvaluateMediumStage.js` branch and algorithm breadcrumbs are `verified`.
  Source rationale now lives in
  [Reference Decision Log](references.md#evaluatemedium-implementation-branch-source-map),
  production comments were added near the branch choices, and
  `npm run test:scripts:flat` plus `git diff --check` passed.
- `EvaluateMediumStage.js` numerical-policy breadcrumbs are `verified`.
  Duplicate-sum tolerance and significant-digit rounding now have named
  production/test constants, design rationale in
  [Code Design](code_design.md#evaluatemedium-contract-notes), source mapping in
  [Reference Decision Log](references.md#evaluatemedium-numerical-policy-source-map),
  and passing `npm run test:scripts:flat` plus `git diff --check`.
- `IntegrateSolarTransmittanceStage.js` branch and algorithm breadcrumbs are
  `verified`. Source rationale now lives in
  [Reference Decision Log](references.md#integratesolartransmittance-implementation-branch-source-map),
  production comments were added near source sampling, surface-point,
  visibility, metadata, spectrum, direction, and Beer-Lambert branch choices,
  and `npm run test:scripts:flat` plus `git diff --check` passed.
- `ValidateRequestStage.js` branch and algorithm breadcrumbs are `verified`.
  Source rationale now lives in
  [Reference Decision Log](references.md#validaterequest-implementation-branch-source-map),
  production comments were added near model-interface, vector, wavelength-grid,
  numerical-control, tolerated-extra, canonical-output, and immutability
  choices, and `npm run test:scripts:flat` plus `git diff --check` passed.
- `ResolveRayPathStage.js` branch and algorithm breadcrumbs are `verified`.
  Source rationale now lives in
  [Reference Decision Log](references.md#resolveraypath-implementation-branch-source-map),
  production comments were added near model-call ownership, ray-domain
  ordering, empty-path output, surface precedence, unbounded flat-path
  rejection, zero-length output, and metadata preservation choices, and
  `npm run test:scripts:flat` plus `git diff --check` passed.
- `SampleViewPathStage.js` branch and algorithm breadcrumbs are `verified`.
  Source rationale now lives in
  [Reference Decision Log](references.md#sampleviewpath-implementation-branch-source-map),
  production comments were added near segment validation, empty/zero-length
  paths, midpoint sample construction, view-step validation, metadata, and
  packet-preservation choices, and `npm run test:scripts:flat` plus
  `git diff --check` passed.
- `IntegrateViewOpticalDepthStage.js` branch and algorithm breadcrumbs are
  `verified`. Source rationale now lives in
  [Reference Decision Log](references.md#integrateviewopticaldepth-implementation-branch-source-map),
  production comments were added near wavelength ownership, empty transport,
  sample weights, species accumulation, path-end semantics, transmittance, and
  packet-output choices, and `npm run test:scripts:flat` plus
  `git diff --check` passed.
- The remaining single-file spec and fixture tracker rows are `verified` for
  `IntegrateViewOpticalDepthStage.spec.js`,
  `IntegrateSolarTransmittanceStage.spec.js`, `EvaluateMediumStage.spec.js`,
  `expectation-fixtures.spec.js`, `ray-path-contracts.json`,
  `solar-transmittance-contracts.json`, and
  `view-optical-depth-hardening.json`. Source rationale now lives in
  [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps)
  and
  [Reference Decision Log](references.md#expectation-fixturesspecjs-validation-source-map).
  Fixture validation now enforces expected datum units, derivation, numeric
  tolerance, and nonnumeric comparison policy across all expectation fixture
  files. `npm run test:scripts:flat` passed with 217 specs and 0 failures, and
  `git diff --check` passed.

Completed work order:

1. Find sourced justification for each identified gap.
2. Update the related source/design docs before changing annotations.
3. Annotate code, tests, and fixtures; expand fixture validation so every
   implemented-stage fixture row carries reference, derivation/provenance,
   units or semantic comparison policy, and independence metadata.
4. Verify with `npm run test:scripts:flat` and `git diff --check`, then resume
   `evaluateScatteringPhase`.

## `evaluateScatteringPhase` Current Batch

Status: complete.

Goal: replace placeholder behavior with direct stage tests and implementation
for the first sourced phase fixture.

Completed coverage:

- Direct stage descriptor and prerequisite checks.
- Direct stage packet transform semantics: real `scatteringPhase`, stage
  history, and no input mutation.
- Isotropic phase values from
  `analytic-invariants.json` row
  `phase.isotropic.constant-over-solid-angle`.
- Rayleigh phase shape for `cosTheta = -1, 0, 1`.
- Positive-`g` Henyey-Greenstein forward-scattering ordering under the stage's
  recorded local sign convention.
- Local angle convention diagnostics for `cosTheta = -1, 0, 1`.
- Explicit empty output when no medium samples exist.
- Loud rejection for unsupported phase kinds.

Source and contract status:

- [Stage Contracts](stage_contracts.md#evaluatescatteringphase) now records
  metadata counts and the implemented `isotropic`, `rayleigh`, and
  `henyey-greenstein` phase kinds.
- [Reference Decision Log](references.md#evaluatescatteringphase-implementation-branch-source-map)
  records implementation branch rationale.

Remaining future phase work:

- Fuller Rayleigh normalization coverage.
- Henyey-Greenstein/Mie `g` bounds and normalization coverage.
- Cloud/tabulated phase functions if that model is later selected.

### Task 1 Follow-Up: Bruneton Aerosol Phase Policy And Cornette-Shanks

Status: complete.

Goal: make the first output-impact implementation step a source-backed,
phase-only Bruneton-method delta instead of another visual tuning pass.

Pinned source facts:

- Bruneton 2016 clear-sky model comparison uses a wavelength-independent
  Cornette-Shanks aerosol phase function with `g = 0.7`.
- The same comparison uses aerosol scale height `1.2 km`, single-scattering
  albedo `0.8`, and Angstrom aerosol optical depth
  `beta * lambda_um^-alpha` with `alpha = 0.8` and `beta = 0.04`.
- In the current local aerosol scalar schema,
  `beta = 0.04` maps to `aod550 = 0.0645312146448`.
- Under this stage's recorded convention, aerosol phase formulas use
  `mu = -cosTheta`.

Pinned phase fixture targets for `g = 0.7`:

| Stage `cosTheta` | Phase `mu` | Henyey-Greenstein | Cornette-Shanks | CS / HG |
| --- | --- | --- | --- | --- |
| `-1` | `1` | `1.50313001809` | `1.81100002180` | `1.20481927711` |
| `0` | `0` | `0.0223141788394` | `0.0134422764093` | `0.602409638554` |
| `1` | `-1` | `0.00826063718470` | `0.00995257492133` | `1.20481927711` |

Implemented coverage:

- Phase helper or stage test evaluates `cornette-shanks` exactly at
  `cosTheta = -1, 0, 1` for `g = 0.7`.
- `cornette-shanks` `g` validation rejects non-finite values and values
  outside `(-1, 1)`.
- Existing Henyey-Greenstein fixture values remain available as the explicit
  same-scalar control.
- Aerosol scalar preset data resolves a `defaultPhasePolicyId`; phase function
  kind and `g` live in the named phase-policy artifact.
- Aerosol phase policy data validates known `kind`, finite `parameters.g`,
  provenance, and ids.
- `bruneton-2016-kider-fit` resolves to
  `bruneton-2016-cornette-shanks-g070` by default, while
  `bruneton-2016-hg-g070-control` remains selectable as an explicit control.
- CLI accepts `--aerosol-phase-policy <id>`, rejects unknown ids loudly, and
  reports the resolved `aerosolPhasePolicy` in JSON and Markdown outputs.

Source and contract status:

- [Reference Decision Log](references.md#bruneton-a-qualitative-and-quantitative-evaluation-of-8-clear-sky-models)
  pins the paper/source-code facts, formula, local schema mapping, and local
  sign-convention interpretation.
- [Stage Contracts](stage_contracts.md#evaluatescatteringphase) records the
  implemented `cornette-shanks` phase kind and phase-policy ownership split.

Implementation status:

- `aerosol-phase-contracts.json` pins the Cornette-Shanks, same-scalar
  Henyey-Greenstein, and invalid-`g` oracle rows with reference objects,
  derivations, tolerances, and independence notes.
- `EvaluateScatteringPhaseStage.spec.js` now cites those fixture rows for the
  same-scalar HG control, Cornette-Shanks values, and Cornette-Shanks `g`
  rejection.
- `aerosol-phase-policy.spec.js` expects the new phase-policy module/data
  contract, including Bruneton CS, Bruneton HG control, validation, and unknown
  id rejection.
- `aerosol-policy.spec.js` expects scalar aerosol presets to expose
  `defaultPhasePolicyId` and keeps the Bruneton scalar preset pinned to
  `aod550 = 0.0645312146448`.
- `run-reference-probe.spec.js` expects `--aerosol-phase-policy`, unknown
  phase-policy rejection, resolved `aerosolPhasePolicy` metadata, Markdown
  report exposure, and same-scalar HG-versus-CS selection with multiple
  scattering disabled.
- The reference runner now resolves named aerosol phase policies, uses
  Cornette-Shanks by default for `bruneton-2016-kider-fit`, keeps the
  same-scalar Henyey-Greenstein policy as an explicit control, and emits the
  resolved `aerosolPhasePolicy` in JSON and Markdown reports.
- Verification: `npm run test:scripts:flat` passed with 378 specs and
  0 failures after the Task 1 implementation.
- Verification: `git diff --check` passed after the Task 1 documentation
  checkpoint.
- Artifact: the first phase-only comparison lives at
  `tmp/atmosphere/bruneton/001-aerosol-phase-policy/` with HG control and
  Cornette-Shanks JSON/PNG/Markdown/progress-log outputs, `manifest.json`,
  `comparison.md`, and combined `progress.log`.

### Task 3 Follow-Up: Bruneton No Visible Absorption Policy

Status: complete.

Goal: make the Bruneton 2016 no-visible-air-absorption comparison assumption
an explicit named composition policy instead of a hidden toggle or transport
branch.

Pinned source fact:

- Bruneton 2016 clear-sky model comparison assumes no visible air-molecule
  absorption. Locally, the output-impact comparison represents that assumption
  as a zero-cross-section ozone/visible-absorber policy selected through the
  existing ozone policy contract.

Implemented coverage:

- `ozone-policy.spec.js` expects
  `bruneton-2016-no-visible-absorption` to resolve as a named policy with
  zero cross sections and provenance tied to the Bruneton 2016 comparison
  contract.
- `run-reference-probe.spec.js` expects the runner to accept the policy through
  `--ozone-policy`, expose the resolved policy in JSON/Markdown metadata, and
  produce zero ozone optical depth in a rendered diagnostic sample.
- [Reference Decision Log](references.md#bruneton-a-qualitative-and-quantitative-evaluation-of-8-clear-sky-models)
  records the paper comparison assumption and the local zero-cross-section
  policy interpretation.

Artifact:

- `tmp/atmosphere/bruneton/006-no-visible-absorption/` compares Brion ozone
  control against `bruneton-2016-no-visible-absorption` with all other
  Bruneton-method comparison inputs fixed. The policy is visually meaningful
  for the low-Sun row, but it does not solve the missing broad soft
  sunset/orange affected area by itself.
- Verification: `npm run test:scripts:flat` passed with 384 specs and
  0 failures after the Task 3 implementation; `git diff --check` also passed.

### Output-Impact Diagnostic CLIs

Status: complete.

Goal: keep non-transport comparison/audit tooling test-backed while the
Bruneton output-impact work narrows likely causes for the brown horizon and
small sunset/aureole area.

Implemented coverage:

- `display-parity-audit.spec.js` expects the display-only audit to run from
  file-directed options, write deterministic JSON/Markdown/PPM/PNG/manifest
  artifacts, and compare normalized versus unnormalized CIE/display paths
  without re-running atmosphere transport.
- `run-reference-probe.spec.js` expects `--dome-sample-mask horizon-ring` to
  select a sky-dome perimeter-only diagnostic render, reject unknown mask ids,
  mark skipped interior pixels in provenance, exclude skipped pixels from
  skydome metrics, and report sampled/skipped counts.
- `aerosol-mie-parity-audit.spec.js` expects the aerosol/Mie audit to verify
  Bruneton/Kider coefficient parity through the live policy helpers, record
  Rayleigh/Mie and Cornette-Shanks phase diagnostics, keep the image sweep
  opt-in, and parse file-directed experiment options including the dome sample
  mask.
- `weakness-factor-audit.spec.js` expects the controlled source-quadrature
  diagnostic to expose the current missing source-weight application:
  split half-weight samples and a zero-weight extra sample both double the
  one-source result. It also expects the audit to support cheap non-transport
  runs and file-directed options.
- Verification: `npm run test:scripts:flat` passed with 398 specs and
  0 failures after the sky-dome sample mask, aerosol/Mie audit, and weakness
  factor audit tests.

### Source Weighting And Finite Solar Source Follow-Up

Status: complete.

Goal: convert the weakness-factor audit's source-quadrature finding into a
test-first transport fix, then add a named finite solar-source comparison mode
that can be trusted for sunset/aureole evidence.

Planned Task 4 source-weight contract tests:

- `integrateSingleScattering` keeps the one-source directional-sun baseline
  unchanged when the source sample has `weight: 1`.
- Two otherwise identical source samples with `weight: 0.5` each produce the
  same radiance as the one-source baseline.
- A zero-weight extra source sample does not change the one-source baseline.
- Differently angled source samples accumulate by their individual weights and
  phase values.
- Missing, negative, or non-finite source weights reject loudly at the
  consuming boundary under the current contract.

Task 4 red-test checkpoint:

- `analytic-invariants.json` now contains fixture-backed source-weight rows:
  `single-scattering.source-weight.two-half-samples`,
  `single-scattering.source-weight.zero-extra-sample`,
  `single-scattering.source-weight.weighted-phase-sum`,
  `single-scattering.source-weight.missing-rejects`, and
  `single-scattering.source-weight.invalid-rejects`.
- `IntegrateSingleScatteringStage.spec.js` now marks the old one-source
  baseline with explicit `weight: 1` and adds active tests for split weights,
  zero-weight samples, weighted phase/source sums, missing weights, and
  invalid weights.
- Red verification before implementation: `npm run test:scripts:flat` failed
  with `403 specs, 5 failures`. The failures were the intended Task 4
  failures: source weights were not multiplied into the radiance contribution,
  missing weights did not throw, and negative/non-finite weights did not throw.
- Task 5 implementation is now green: `IntegrateSingleScatteringStage` requires
  finite nonnegative `sourceSample.weight` values, multiplies each
  source-sample contribution by the weight, and the weakness-factor audit now
  reports `source-sample-weight-applied` with split-weight and
  zero-weight-extra ratios near `1.0`.
- `IntegrateSolarTransmittanceStage` also rejects source samples without
  finite nonnegative `weight` before emitting the downstream handoff.
- Verification: `npm run test:scripts:flat` passed with
  `403 specs, 0 failures`.

Task 5 implementation verification:

- `weakness-factor-audit.spec.js` changed from expecting the historical `2.0`
  split-source ratio to expecting weighted ratios near `1.0`.
- One-sample source behavior remains explicit through `weight: 1`; no fallback
  default was added inside `integrateSingleScattering`.
- Source adapters must provide the current required `weight` field.

Task 6 finite-source implementation checkpoint:

- `directional-sun` produces exactly one source sample with `weight: 1`.
- `finite-sun-disc` produces the requested deterministic sample count with
  finite nonnegative weights whose sum is `1`.
- Every finite-disc direction lies inside the configured solar angular radius.
- The runner accepts the named source mode and sample count, rejects unknown
  modes and invalid counts, and reports source mode, sample count, angular
  radius, weight sum, and `solidAngleSr` provenance in JSON and Markdown.
- Low and higher finite-disc sample counts can be compared in the
  `tmp/atmosphere/bruneton/010-finite-sun-source-weighting/` artifact before
  using the result as sunset/aureole evidence.
- Implementation is green. `run-reference-probe.js` now accepts
  `--solar-source directional-sun|finite-sun-disc`; `--finite-sun-samples`
  is valid only with `--solar-source finite-sun-disc`. The sky-patch,
  sky-dome, and multiple-scattering sidecar model paths all resolve the same
  source-sampling metadata.
- The finite-disc adapter emits deterministic equal-area spiral samples across
  the apparent solar disc with equal source-integral weights summing to `1`.
  `solidAngleSr` is recorded per sample as provenance and remains outside the
  transport multiplier under the current source-energy convention.
- JSON and Markdown outputs expose source mode, sample count, solar angular
  radius, weight sum, and source quadrature diagnostics from the actual
  `solarTransmittance` packet consumed by the transport stages.
- Verification: `npm run test:scripts:flat` passed with `405 specs, 0
  failures` after adding the CLI, metadata, and finite-source diagnostics
  coverage.

Source and fixture notes:

- Expected weighted-sum values can use analytic one-sample scalar fixtures from
  the existing single-scattering test family plus local API-contract fixture
  rows for required source-sample weights.
- Any finite-disc angular sampling fixture must identify whether it is a local
  deterministic quadrature policy or a sourced physical solar-angular-radius
  fact. Do not justify new expected directions by duplicating the same
  production sampler in the test.
- Update [Stage Contracts](stage_contracts.md), [Code Design](code_design.md),
  and [Reference Decision Log](references.md) before moving this follow-up
  past `identified` if the weight field becomes required in a stage packet or
  source adapter contract.

## Final Transport Stage Batch

Status: complete.

Goal: replace placeholders for `integrateSingleScattering`,
`resolveSurfaceRadiance`, and `composeSpectralRadiance` with first
fixture-backed or API-contract implementations.

Completed coverage:

- `integrateSingleScattering`
  - direct stage descriptor, prerequisite, packet-transform checks
  - one-sample PBRT in-scattering scalar product from
    `analytic-invariants.json`
  - explicit zero output for empty medium paths
  - negative source-term rejection
- `resolveSurfaceRadiance`
  - direct stage descriptor, prerequisite, packet-transform checks
  - black and white Lambertian controlled-model rows from
    `analytic-invariants.json`
  - explicit zero output when no surface hit is selected
- `composeSpectralRadiance`
  - direct stage descriptor, prerequisite, packet-transform checks
  - wavelength-by-wavelength in-scattered plus surface component sum
  - bright unclamped radiance
  - negative component rejection

Source and contract status:

- [Stage Contracts](stage_contracts.md) already owns the packet shape and
  ownership boundaries for the three stages.
- [Reference Decision Log](references.md#final-transport-stage-implementation-source-maps)
  records branch rationale for the first implementations.

## `resolveRayPath` Current Batch

Status: complete.

Goal: turn the former pending shells into real direct stage tests backed by
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/ray-path-contracts.json`.

Ready fixture rows:

- `ray-path.atmosphere.inside-exits-top`
- `ray-path.surface-hit.clips-atmosphere-segment`
- `ray-path.surface-hit.before-atmosphere-entry-empty`
- `ray-path.atmosphere.miss-empty-path`
- `ray-path.atmosphere.outside-entry-to-exit`
- `ray-path.atmosphere.forward-clips-negative-entry`
- `ray-path.atmosphere.behind-observer-empty-path`
- `ray-path.atmosphere.zero-length-boundary-path`
- `ray-path.atmosphere.inverted-intersection-rejects`
- `ray-path.atmosphere.nonfinite-intersection-rejects`
- `ray-path.flat.named-lateral-boundary`
- `ray-path.flat.unbounded-horizontal-rejects`
- `ray-path.boundary-metadata.preserved`

Completed test work:

1. Added a fixture helper that loads `ray-path-contracts.json`.
2. Added a tiny controlled model adapter for fixture-owned atmosphere and surface
   returns.
3. Replaced the 13 pending shells in
   `scripts/flat/atmosphere_rejected/reference/stages/_tests/ResolveRayPathStage.spec.js`
   with real input-to-output assertions.
4. Confirmed those tests failed against placeholder behavior.
5. Implemented `ResolveRayPathStage.run(packet)`.
6. Reran `npm run test:scripts:flat`.

Out of scope for this batch:

- spherical ray/shell intersection math
- flat slab intersection math
- Earth radius or atmosphere-top conventions
- arbitrary large-distance flat-world extremes

Those belong in later geometry/model-helper fixtures with their own sourced
constants and derivations.

## `resolveRayPath` Hardening Follow-Up

Status: complete for the current recommended batch.

The second fixture/test batch pins boundary and malformed-return hardening:

- Surface hit after atmosphere exit: does not shorten the atmosphere segment
  and is not carried in `rayPath.surfaceHit`.
- Surface hit exactly at atmosphere entry: returns an explicit empty path with
  `boundaryReason: "surface-at-atmosphere-entry"`.
- Surface hit exactly at atmosphere exit: uses surface-hit boundary precedence
  and preserves atmosphere-exit diagnostics in metadata.
- Invalid surface-hit distances: non-finite `surfaceHit.tKm` rejects; negative
  `surfaceHit.tKm` is ignored as behind-observer.
- Malformed atmosphere returns: reject missing `tMinKm` or `tMaxKm` unless the
  row explicitly uses the `unbounded: true` marker.
- Model-call contract: verify `resolveRayPath` calls the atmosphere and surface
  intersection interfaces with the validated observer origin and unit ray
  direction shape expected by the model contract.

Each hardening case now has fixture data in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/ray-path-contracts.json`.
Boundary precedence choices are local API decisions, so their `reference`
points to [Code Design](code_design.md), with PBRT ray semantics used where
ray-parameter ordering is the supporting concept.

## Next Stage Seeds

After `resolveRayPath`, proceed in canonical order.

### `sampleViewPath`

Status: complete for the current fixture-backed batch.

Initial test intents:

- empty ray path produces no samples or explicit zero-weight samples according
  to the chosen packet contract
- midpoint samples lie inside the selected segment
- sample weights sum to path length
- zero-length path does not invent distance
- invalid negative path length rejects
- configured sample count controls sample count once the numerical policy is
  owned by this stage

Planned fixture rows:

- `view-samples.empty-path.no-samples`
- `view-samples.zero-length.no-samples`
- `view-samples.midpoint.one-step-0-to-10`
- `view-samples.midpoint.two-steps-0-to-10`
- `view-samples.midpoint.two-steps-2-to-12`
- `view-samples.midpoint.weights-sum-to-length`
- `view-samples.midpoint.monotonic-sample-order`
- `view-samples.ray-path-diagnostics.preserved`
- `view-samples.invalid.negative-length-rejects`
- `view-samples.invalid.inconsistent-length-rejects`
- `view-samples.invalid.nonfinite-distance-rejects`
- `view-samples.invalid.view-steps-rejects`
- `view-samples.midpoint.integration-metadata`

The corresponding fixture-backed specs now live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/SampleViewPathStage.spec.js`.
The fixture rows now live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-samples-contracts.json`.
The direct stage tests load those rows through
`scripts/flat/atmosphere_rejected/reference/_tests/test-expectations.js`, materialize
non-finite JSON sentinel values only inside the test adapter, and compare the
stage packet output to pinned expected rows. `SampleViewPathStage` now
implements the fixed midpoint sampler, empty/zero-length no-sample policy,
metadata output, shared `normalizeRayPathSegment` segment validation, and
positive-integer `viewSteps` validation. The focused lane is green after the
red step.

Reference checklist for planned fixture rows:

| Fixture row id | Expected source support | Local contract support | Notes |
| --- | --- | --- | --- |
| `view-samples.empty-path.no-samples` | PBRT Transmittance for finite point-to-point transport and zero path contribution. | [Code Design](code_design.md), `sampleViewPath` consumes `rayPath` and provides `viewSamples`. | Empty atmosphere transport should not invent samples or distance. |
| `view-samples.zero-length.no-samples` | PBRT Transmittance for point-to-itself / zero-distance transport. | [Code Design](code_design.md), no-epsilon distance policy from `resolveRayPath` boundary precedence. | Zero length is valid but has no integration measure. |
| `view-samples.midpoint.one-step-0-to-10` | Midpoint/quadrature reference for evaluating at the subinterval midpoint with weight equal to interval width. | [Code Design](code_design.md), fixed midpoint integration for view rays. | Expected center `5 km`, weight `10 km`. |
| `view-samples.midpoint.two-steps-0-to-10` | Midpoint/quadrature reference for composite midpoint rule over equal subintervals. | [Code Design](code_design.md), deterministic samples for the selected view path. | Expected centers `2.5 km`, `7.5 km`; weights `5 km`. |
| `view-samples.midpoint.two-steps-2-to-12` | Midpoint/quadrature reference for applying midpoint rule on a nonzero-start interval. | [Code Design](code_design.md), distances remain measured from observer along the selected ray. | Expected centers `4.5 km`, `9.5 km`; weights `5 km`. |
| `view-samples.midpoint.weights-sum-to-length` | Composite midpoint/quadrature rule: subinterval widths partition the interval. | [Code Design](code_design.md), sample weights are path-distance weights consumed by optical-depth integration. | Sum of weights must equal `rayPath.viewSegment.lengthKm`. |
| `view-samples.midpoint.monotonic-sample-order` | Composite midpoint rule over ordered subintervals. | [Code Design](code_design.md), downstream stages consume samples in camera-ray order. | Sample distances should strictly increase for positive-length paths. |
| `view-samples.ray-path-diagnostics.preserved` | No external physics needed beyond the selected segment; diagnostics are local API evidence. | [Code Design](code_design.md), packet transform contract and `resolveRayPath` diagnostics. | `sampleViewPath` must not mutate or reinterpret boundary diagnostics. |
| `view-samples.invalid.negative-length-rejects` | PBRT Rays / Transmittance for finite ordered forward distances. | [Code Design](code_design.md), Error Handling and packet prerequisite validation. | Negative length cannot represent a finite forward integration segment. |
| `view-samples.invalid.inconsistent-length-rejects` | PBRT Rays for ordered endpoints; midpoint rule assumes a coherent interval width. | [Code Design](code_design.md), packet data must fail loudly when contradictory. | `lengthKm` must equal `endKm - startKm` under exact controlled fixtures. |
| `view-samples.invalid.nonfinite-distance-rejects` | PBRT Transmittance for finite path distance in optical-depth integration. | [Code Design](code_design.md), Error Handling for finite path data. | Non-finite start/end/length reject before sampling. |
| `view-samples.invalid.view-steps-rejects` | Numerical-method convention: sample count is a positive integer partition count. | [Code Design](code_design.md), Numerical Controls. | Direct stage tests protect crafted packets even though `validateRequest` checks normal requests. |
| `view-samples.midpoint.integration-metadata` | Midpoint/quadrature reference for the named method. | [Code Design](code_design.md), fixed midpoint integration and diagnostics/reportability. | Output should identify the midpoint method used by this stage. |

Candidate external midpoint references:

- General numerical integration/quadrature descriptions: integration as
  weighted sums of integrand evaluations, with method-specific points and
  weights.
- Midpoint rule references: one interval uses the center point
  `(a + b) / 2` with width `(b - a)`; composite midpoint partitions the
  interval and applies the same rule to each subinterval.
- Later, before package publication, consider replacing secondary web sources
  with a primary or textbook-grade numerical analysis citation.

### `evaluateMedium`

Status: first fixture-backed batch implemented and green.

Scope: `evaluateMedium` tests only the packet it is expected to output for the
expected range of valid and invalid inputs. It does not prove that a profile
adapter correctly implements the U.S. Standard Atmosphere, CIE, Rayleigh, Mie,
ozone, or water-vapor physics. Sourced profile/composition/grid rows may be used
as representative input fixtures so the stage sees realistic low/high density,
composition, and wavelength-grid shapes, but the oracle remains the stage
contract: preserve model-owned diagnostics, align arrays, derive/sum
coefficients, emit vacuum, and reject invalid model data.

Initial test intents:

- vacuum coefficients are zero
- homogeneous medium returns the supplied extinction/scattering values
- multi-wavelength arrays align with `wavelengthsNm`
- species diagnostics preserve model-owned species names
- negative coefficients reject where the medium stage owns coefficient intake
- altitude diagnostics are derived once from `model.world.altitudeAt`, while
  density/profile diagnostics are copied from model-owned atmosphere/profile
  returns rather than recomputed downstream

Planned controlled-model fixture rows:

| Fixture row id | Test expectation | Fixture/source status |
| --- | --- | --- |
| `medium.empty-view-samples.no-medium-samples` | Empty `viewSamples` produces `mediumSamples: []` and no model coefficient calls. | Local packet contract; ready after output shape is pinned. |
| `medium.position.single-sample-from-observer-ray` | Position equals `observer.positionKm + ray.direction * distanceFromObserverKm`. | PBRT ray equation plus local validated-ray contract; controlled fixture ready. |
| `medium.position.multiple-samples-ordered` | Each sample is evaluated once in view-sample order. | Local packet/order contract; controlled fixture ready. |
| `medium.model-call.wavelength-grid` | Model coefficient calls receive the active wavelength grid or exact wavelength sequence chosen by the API. | Needs final model-call API shape before fixture encoding. |
| `medium.sample-fields.preserved` | `sampleIndex`, distance, weight, interval start/end, and integration method are copied to each `mediumSample`. | Local packet transform contract; ready after output shape is pinned. |
| `medium.vacuum.zero-coefficients` | Vacuum emits zero extinction/scattering/absorption arrays aligned to `wavelengthsNm`. | PBRT medium coefficient vocabulary plus local vacuum contract; controlled fixture ready. |
| `medium.homogeneous.single-wavelength` | One-wavelength homogeneous coefficients exactly match model-owned returns. | Controlled model-return fixture; ready. |
| `medium.homogeneous.multi-wavelength` | Multi-wavelength coefficient arrays preserve `wavelengthsNm` order and length. | Local spectral-array contract; ready. |
| `medium.species.diagnostics-preserved` | Species names and per-species arrays are preserved without renaming or dropping. | Local model-interface contract; ready. |
| `medium.species.total-extinction-sum` | Total extinction equals wavelength-wise species extinction sum when species are the finest available source. | PBRT additive extinction reasoning; output precedence now pinned in [Code Design](code_design.md). |
| `medium.coefficients.absorption-scattering-extinction-consistency` | Extinction equals absorption plus scattering when extinction is derived, and direct extinction totals must validate against that sum when both are present. | PBRT coefficient definitions; output precedence now pinned in [Code Design](code_design.md). |
| `medium.diagnostics.altitude-from-world` | `altitudeKm` equals `model.world.altitudeAt(positionKm)`. | Local model-interface contract; controlled fixture ready. |
| `medium.diagnostics.density-from-atmosphere` | Density diagnostics equal atmosphere/profile model returns and preserve species context when the model supplies density/profile data. | Local model-interface contract; `mediumSample.profile` shape now pinned in [Code Design](code_design.md). |
| `medium.outside-atmosphere.vacuum` | `contains(positionKm) === false` produces explicit vacuum coefficients. | Local atmosphere-volume contract; ready after vacuum output shape is pinned. |
| `medium.invalid.negative-extinction-rejects` | Negative extinction throws loudly; no clamping. | PBRT nonnegative extinction coefficient definition; ready. |
| `medium.invalid.negative-scattering-rejects` | Negative scattering throws loudly; no clamping. | PBRT nonnegative scattering coefficient definition; ready. |
| `medium.invalid.negative-absorption-rejects` | Negative absorption throws loudly; no clamping. | PBRT nonnegative absorption coefficient definition; ready. |
| `medium.invalid.nonfinite-coefficients-reject` | `NaN`, `Infinity`, and `-Infinity` coefficient values throw loudly. | Local finite-number transport contract; ready. |
| `medium.invalid.wavelength-shape-rejects` | Missing, scalar, too-short, or too-long arrays reject instead of broadcast/truncate/pad. | Local spectral-array contract; ready. |
| `medium.invalid.density-rejects` | Negative or non-finite density diagnostics reject when density/profile data is present. | Local profile contract plus hard nonnegative invariant; `mediumSample.profile` shape now pinned in [Code Design](code_design.md). |

Planned expected-range fixture rows:

| Fixture row id | Test expectation | Source status |
| --- | --- | --- |
| `medium.earth-profile.sea-level-density-checkpoint` | The stage preserves dense near-surface profile diagnostics supplied by the model. | Ready as a representative input row from PDAS/NASA-backed U.S. Standard Atmosphere data. |
| `medium.earth-profile.high-altitude-density-checkpoint` | The stage preserves low-density high-altitude profile diagnostics supplied by the model. | Ready as a representative input row from PDAS/NASA-backed U.S. Standard Atmosphere data. |
| `medium.earth-profile.upper-supported-density-checkpoint` | The stage preserves near-boundary low-density profile diagnostics supplied by the model. | Ready as a representative input row from PDAS/NASA-backed U.S. Standard Atmosphere data. |
| `medium.earth-composition.standard-dry-air-major-fractions` | The stage preserves model-supplied standard dry-air composition diagnostics, including the listed residual. | Ready from NASA U.S. Standard Atmosphere 1976 Table 3 dry-air fractional-volume composition. |
| `medium.earth-composition.homosphere-consistency` | The stage preserves repeated model-supplied composition diagnostics across profile checkpoints. | Ready as a stage packet/output consistency row; do not assert thermospheric composition stability. |
| `medium.earth-profile.visible-wavelength-grid-alignment` | The stage keeps coefficient arrays aligned over the selected visible wavelength-grid shape. | Ready as an array-shape stress row using CIE grid metadata; not a coefficient-value oracle. |

Sourced data candidates for later fixture rows:

| Fixture row id | Candidate expected data | Source status |
| --- | --- | --- |
| `medium.earth-profile.sea-level-density-checkpoint` | `z = 0 km`, `H = 0.0 km`, `T = 288.150 K`, `p = 1.0132E+05 Pa`, `rho = 1.2250E+00 kg/m3`, `rho/rho0 = 1.0000E+00`. | Data row from PDAS U.S. Standard Atmosphere 1976 big table; NASA NTRS record `19770009539` identifies the official U.S. Standard Atmosphere 1976 source. Ready after output shape is pinned. |
| `medium.earth-profile.high-altitude-density-checkpoint` | `z = 80 km`, `H = 79.0 km`, `T = 198.639 K`, `p = 1.0525E+00 Pa`, `rho = 1.8458E-05 kg/m3`, `rho/rho0 = 1.5068E-05`. | Data row from PDAS U.S. Standard Atmosphere 1976 big table. Ready after output shape is pinned; use table data rather than a local generated atmosphere formula. |
| `medium.earth-profile.upper-supported-density-checkpoint` | Candidate row: `z = 85 km`, `H = 83.9 km`, `T = 188.893 K`, `p = 4.4568E-01 Pa`, `rho = 8.2195E-06 kg/m3`, `rho/rho0 = 6.7098E-06`. | Data row from PDAS U.S. Standard Atmosphere 1976 big table. Ready as an accessible near-boundary table row after output shape is pinned; audit the original PDF table before package-facing publication. |
| `medium.earth-composition.standard-dry-air-major-fractions` | Table 3 dry-air fractional-volume rows: `N2 0.78084`, `O2 0.209476`, `Ar 0.00934`, `CO2 0.000314`, `Ne 0.00001818`, `He 0.00000524`, `Kr 0.00000114`, `Xe 0.000000087`, `CH4 0.000002`, `H2 0.00000005`; listed-fraction sum `0.999996697`; residual `0.000003303`. | NASA NTRS U.S. Standard Atmosphere 1976 PDF, Table 3, printed page 3. Ready for fixture encoding with per-value derivation notes. |
| `medium.earth-composition.homosphere-consistency` | Same selected Table 3 dry-air composition at the table-backed `0 km`, `80 km`, and `85 km` profile checkpoints when the adapter declares it is using fixed standard dry air. | NASA Table 3 supplies the composition; NASA Table 4 supplies lower-profile reference levels to the `84.8520 km` geopotential boundary / about `86 km` geometric support. Ready only as an adapter contract, not as a claim that real upper-atmosphere composition is constant. |
| `medium.earth-profile.visible-wavelength-grid-alignment` | CIE official `360-830 nm`, `1 nm` grid, `471` rows, md5 `17cca777db64b17170f06f67ce9d3ab7`. | Official CIE dataset DOI `10.25039/CIE.DS.xvudnb9b`. Ready for grid-alignment metadata; not a medium coefficient table. |

The corresponding direct stage tests now live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/EvaluateMediumStage.spec.js`.
Those shells have now been replaced by real fixture-backed specs, with fixture
rows in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/medium-contracts.json`.
The first red run failed because `EvaluateMediumStage` still returned placeholder
`mediumSamples` and did not call the controlled medium model. The implementation
now makes those rows green while keeping the batch scoped to this stage's output
contract for the expected input range. Real coefficient-model correctness
remains deferred to coefficient adapter/model tests.

Follow-up extremes batch:

Status: complete for the current fixture-backed batch.

After the first fixture-backed `evaluateMedium` contract batch was green, a
second direct stage-test batch was added for sourced or explicitly justified
extremes. These tests still check only `evaluateMedium` output behavior, not
adapter/model truth. Each extreme is justified as one of:

- a published table boundary or checkpoint, such as lower-profile atmosphere
  rows near `0 km` and the supported upper checkpoint;
- a standard dataset extent, such as the selected visible wavelength-grid
  length and endpoints;
- a hard physical invariant, such as zero/vacuum coefficients or nonnegative
  finite density/coefficient data;
- a local model-hypothesis boundary recorded as such, not disguised as a
  physical Earth constant.

Completed follow-up rows:

| Fixture row id | Extreme under test | Expected stage behavior |
| --- | --- | --- |
| `medium.extreme.profile.dense-near-surface` | Highest-density sourced lower-profile checkpoint selected for this stage. | Preserve profile diagnostics and coefficient arrays without rescaling/clamping. |
| `medium.extreme.profile.low-density-upper-supported` | Low-density sourced upper-supported checkpoint selected for this stage. | Preserve very small positive density and related diagnostics. |
| `medium.extreme.profile.invalid-density-boundaries` | Invalid density diagnostics paired with the sourced profile-boundary rows. | Reject negative and non-finite density before downstream reporting. |
| `medium.extreme.profile.zero-density-vacuum` | Vacuum/no-medium sample, a hard invariant rather than an atmosphere table row. | Emit explicit zero coefficient arrays aligned to `wavelengthsNm`. |
| `medium.extreme.profile.vacuum-contradictory-coefficients-rejects` | Contradictory model state claiming vacuum while reporting nonzero coefficients. | Reject loudly instead of silently zeroing or preserving contradictory values. |
| `medium.extreme.wavelength-grid.visible-full-range` | Selected visible grid endpoint/count stress row. | Preserve wavelength-indexed coefficient order and reject any shape mismatch. |
| `medium.extreme.wavelength-grid.visible-full-range-mismatch-rejects` | Coefficient arrays just outside the selected visible-grid count, plus scalar collapse. | Reject arrays that do not align one-to-one with the CIE-backed `471` sample grid. |
| `medium.extreme.composition.listed-standard-residual` | Standard dry-air listed fractions plus residual. | Preserve listed composition rows and residual; do not normalize them to exactly `1`. |
| `medium.extreme.composition.invalid-fraction-boundaries` | Invalid composition diagnostics paired with the standard dry-air residual row. | Reject negative, non-finite, greater-than-one, negative-residual, and inconsistent residual-accounting inputs. |
| `medium.extreme.coefficient.zero-and-positive-finite` | Zero and small positive finite coefficient arrays. | Accept valid nonnegative finite arrays and preserve/derive totals. |
| `medium.extreme.coefficient.invalid-boundaries` | Negative and non-finite coefficient values. | Reject loudly without clamping, padding, or silently dropping values. |

Positive/negative pairing audit:

| Extreme family | Positive side | Negative side |
| --- | --- | --- |
| Profile density range | `dense-near-surface`, `low-density-upper-supported` preserve sourced positive finite table rows. | `invalid-density-boundaries` rejects negative, `NaN`, and infinite density diagnostics. |
| Vacuum/no-medium | `zero-density-vacuum` emits wavelength-aligned zero coefficients. | `vacuum-contradictory-coefficients-rejects` rejects a vacuum flag paired with nonzero coefficients. |
| Visible wavelength grid | `visible-full-range` preserves the full CIE-backed `471` sample grid shape. | `visible-full-range-mismatch-rejects` rejects `470`, `472`, and scalar-collapsed coefficient shapes. |
| Composition residual | `listed-standard-residual` preserves NASA Table 3 fractions, listed sum, and residual without normalizing. | `invalid-fraction-boundaries` rejects invalid composition diagnostics because the stage owns validation of consumed profile inputs. |
| Coefficients | `zero-and-positive-finite` accepts zero and controlled positive finite arrays. | `invalid-boundaries` rejects negative and non-finite coefficients. |

Fixture/test status: rows for these eleven follow-up extremes now live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/medium-contracts.json`
with canonical references and derivation notes. The specs are wired as real
direct stage tests in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/EvaluateMediumStage.spec.js`.
The first wired run failed on contradictory vacuum coefficients and invalid
composition diagnostics; `EvaluateMediumStage` now implements those validation
paths.

## `integrateViewOpticalDepth` Follow-Up Audit

Follow-up status: `complete`.

Notes: this follow-up is queued before or alongside the next stage. The
sourced fixture rows now live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`
and validate through the global fixture envelope checks. The former pending
Jasmine shells in `IntegrateViewOpticalDepthStage.spec.js` are now active
tests and green.

Issues to address:

- Path-end distance validation: a concrete supplied final `intervalEndKm` must
  be finite for downstream path-end diagnostics. An omitted or `undefined`
  `intervalEndKm` may fall back to the final sample distance; a non-finite
  supplied value rejects.
- Downstream packet ownership: document and test which fields later stages use
  for wavelength order, sample weights, interval endpoints, and optical-depth
  diagnostics. Keep `validatedRequest.wavelengthsNm` as the wavelength source
  of truth and test required output diagnostics by presence/value rather than
  asserting ordinary fields are absent.
- Species diagnostic semantics: current species optical-depth diagnostics are
  cumulative through each sample. Keep that meaning explicit through positive
  cumulative-value checks.
- Sourced expected extremes: the current green batch is analytic/toy-domain.
  The hardening fixture file now records full CIE/ASTM wavelength-grid stress,
  Kasten and Young air-mass rows, Bucholtz Rayleigh optical-depth rows, flat
  large-lateral-boundary transport, and convergence/sample-count provenance
  gates. Do not invent limits; source or declare each boundary. The
  convergence positive row remains intentionally blocked until an independent
  convergence artifact exists.
- Stage boundary with solar transport: keep camera-view optical depth separate
  from source-path transmittance. `integrateSolarTransmittance` owns solar
  visibility and sample-to-source path attenuation.

Active spec inventory:

| Test intent | Positive case | Negative case |
| --- | --- | --- |
| Path-end distance | Accept a finite final `intervalEndKm` as the canonical `viewOpticalDepth.pathEnd.distanceFromObserverKm`. | Reject a supplied non-finite final `intervalEndKm`. |
| Downstream packet ownership | Keep sample weights and interval endpoints owned by `mediumSamples`; `viewOpticalDepth` carries required transport diagnostics. | No absence-style negative row in this batch. |
| Species diagnostic semantics | Report per-species optical depth as cumulative through each sample. | No absence-style negative row in this batch. |
| CIE visible-grid extreme | Accept the sourced CIE `360-830 nm`, `1 nm`, `471`-sample grid when coefficient arrays align one-to-one. | Reject scalar, short, or long coefficient arrays against that sourced grid. |
| ASTM G-173 solar-grid extreme | Accept the sourced ASTM G-173 wavelength grid when coefficient arrays align one-to-one. | Reject coefficient arrays that cannot align to the nonuniform ASTM grid. |
| Clear-air Rayleigh optical-depth extreme | Match a sourced optically thin/thick Rayleigh row after the coefficient model is pinned. | Reject or defer any clear-air optical-depth extreme fixture whose source, atmosphere, coefficient model, or wavelength assumptions are not pinned. |
| Near-horizon / AM1.5 slant-path extreme | Match a sourced near-horizon or AM1.5 slant-path fixture after the path approximation is declared. | Reject arbitrary unsourced slant-path multipliers or near-horizon path lengths. |
| Flat large-lateral-boundary extreme | Match finite named flat lateral-boundary homogeneous transport with `tau = sigma_t * lateralDistance`. | Reject fixtures that hide an unbounded flat path as a numerical integration cap. |
| Selected-model species count | Accept the selected clear-air model species set and preserve per-species totals. | Reject species-extreme fixtures with mismatched wavelength arrays. |
| Convergence/sample-count extreme | Match the convergence-study sample-count fixture for the selected reference profile. | Reject max-sample-count fixtures chosen without convergence evidence. |

Fixture row file:

- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/view-optical-depth-hardening.json`
  contains the row-level references, assumptions, expected data or expected
  errors, and derivation notes for the active hardening inventory above.

## Post-Pipeline Diagnostic: Flat Light Extent

Status: initial source-path classifier implemented.

The flat/local-Sun terrain-visibility follow-up is broader than one canonical
pipeline stage, so the first implementation lives in the probe runner instead
of a stage spec. `run-reference-probe.js --light-extent` reads named scenario
sets from
`scripts/flat/atmosphere_rejected/data/reference/light-extent-scenarios.json`, integrates a
straight source path through a simple flat atmosphere profile, applies finite
solar-disk solid-angle falloff, and reports where configurable loss-fraction
thresholds are crossed.

Current scope:

- Classifies source-path optical depth with Beer-Lambert transmittance.
- Classifies finite-Sun useful-light falloff using relative effective
  irradiance from source solid angle times source-path transmittance.
- Exposes the first user-control bridge as `sun.brightnessScale` for absolute
  effective irradiance and `sun.elevationDeg` for source-path angle above the
  flat horizon, plus `sun.directLightAvailable` for no-direct-source cases.
- Supports named absolute `floors.effectiveIrradiance` rows as calculated
  engineering anchors. These floors are reported separately from
  relative-loss crossings and are not perceptual visibility thresholds.
- Emits deterministic JSON, Markdown, SVG, and terminal summaries.
- Uses thresholds in `[0, 1)`, where values close to `1` mean almost nothing
  remains and exact `1` is invalid because exponential transmittance reaches
  zero only asymptotically.

Brightness note: the current threshold crossings are relative-loss crossings,
so changing `sun.brightnessScale` scales `effectiveIrradiance` but does not
move `usefulLightLossFraction` or opacity crossing distances. That is
intentional for source-path classification. Full terrain visibility needs a
later absolute brightness, exposure, or contrast floor before user brightness
can alter the visible-detail distance.

Calculated floor sets:

- `app.flatDefaults.midday` uses the current app false-Sun closest pose:
  `solarIrradianceScale 58`, source radius `25.749504 km`, source distance
  `5050.674164842701 km`, and elevation `72.9232574407232 deg`. Its floor is
  `app.flatDefaults.onePermilleMiddayEffective`, with value
  `0.000004736087535019212 app-effective-source-units`.
- `app.flatDefaults.midnight` uses the current app false-Sun opposite pose:
  source distance `14050.170417417787 km` and elevation
  `20.0979340875104 deg`. It intentionally uses the same app-midday floor so
  the opposite pose can be compared to the current app baseline. This is not a
  no-direct-light night in the current app geometry.
- `realSun.sanJose.midday` uses the app globe-simulation San Jose solar-noon
  defaults: Earth-Sun distance `151931630.50436023 km`, solar radius
  `696340 km`, elevation `75.90639477250807 deg`, and
  top-of-atmosphere irradiance `1319.5095932262168 W/m2`. Its floor is
  `1.3195095932262169 W/m2`.
- `realSun.sanJose.midnight` keeps the real-Sun top-of-atmosphere source
  value for the midnight date-derived distance, but sets
  `directLightAvailable: false` because the Sun is below the local globe
  horizon at elevation `-29.393749946395037 deg`. Its floor is
  `1.319379996648256 W/m2` and is crossed at the start of the path.

Configuration-time app integration note: the probe is plausible to incorporate
into the running application as a debounced configuration calculation, not as a
render-loop calculation. A future browser-safe kernel or adapter can run when
Sun/atmosphere controls change, cache results by physical configuration, and
publish useful-light extent, opacity extent, and sampled curves for renderer or
terrain-LOD inputs. Characterization sweeps should come first if we need a
stronger model of elevation and brightness-floor relationships before wiring
UI behavior.

Out of scope for this first classifier:

- terrain albedo and surface normals;
- camera-to-terrain view transmittance;
- source-to-air sample transmittance for in-scattering;
- haze/background contrast;
- a decision about whether to render distant terrain detail physically or use
  a named low-detail approximation.

Active spec inventory:

| Test intent | Coverage |
| --- | --- |
| CLI parsing | `--light-set` and `--light-config` imply `--light-extent` and select named scenarios. |
| Scenario run | The default close-horizontal dense-air set crosses both useful-light and opacity thresholds, with useful light limiting first. |
| App-linked floors | The app flat midday and opposite false-Sun sets load from the named scenario file, keep their calculated elevations, and cross the app-midday effective-irradiance floor. |
| Real-Sun floors | The real-Sun San Jose midday set stays above the `0.1%` top-of-atmosphere floor across the sampled span, while the real-Sun midnight set has direct light unavailable and is already below its floor at path start. |
| Evidence output | Markdown, SVG, and summary output identify the light-extent run and selected scenario. |

## `integrateSolarTransmittance` Current Batch

Status: `complete`.

Goal: give each evaluated view sample one or more model-owned solar-source
samples, ask the model for each source-path transport segment, and integrate
source-to-sample optical depth without smuggling geometry into this stage.

Stage scope:

- Consumes `validatedRequest`, `mediumSamples`, and `rayPath`.
- Calls `solarSource.samplesAt(positionKm, undefined, numerical)` for each
  medium sample position and selected surface point.
- Calls `solarSource.transmittanceSegment(positionKm, sourceSample, {
  wavelengthsNm, mediumSample, numerical })` for each returned source sample.
- Calls `solarSource.transmittanceSegment(surfacePositionKm, sourceSample, {
  wavelengthsNm, surfacePoint, numerical })` when `rayPath.surfaceHit` selects
  a visible surface point.
- Produces `solarTransmittance.samples[].sourceSamples[]` with source-sample
  identity, direction, source spectrum, weight/solid-angle metadata when
  supplied, visibility, source-path length, optical depth, and transmittance
  arrays.
- Produces optional `solarTransmittance.surfacePoint` source samples for later
  direct surface irradiance when a selected surface hit is visible.
- Integrates only model-returned source-path segment samples. Spherical Earth
  occlusion, flat slab exit, local-Sun disk geometry, and source-path
  intersection math belong to solar-source/model-helper tests.

Completed fixture rows:

| Fixture row id | Coverage |
| --- | --- |
| `solar-transmittance.empty-medium-samples.no-output` | Empty input medium samples produce an explicit empty solar-transmittance packet. |
| `solar-transmittance.vacuum.directional-unity` | Visible vacuum source path gives `tau = 0` and `T = 1`. |
| `solar-transmittance.homogeneous.beer-lambert` | Homogeneous source-path segment gives `tau = sigma_t * distance` and `T = exp(-tau)`. |
| `solar-transmittance.homogeneous.multi-wavelength` | Each wavelength integrates independently with no scalar collapse. |
| `solar-transmittance.source-samples.preserve-metadata` | Source sample id, direction, weight, and solid angle are preserved for later scattering and surface stages. |
| `solar-transmittance.visibility.occluded-zero` | A model-declared occluded source sample remains visible `false` and contributes zero source transmittance. |
| `solar-transmittance.invalid.negative-extinction-rejects` | Negative source-path extinction rejects at this stage boundary. |
| `solar-transmittance.invalid.wavelength-shape-rejects` | Source-path coefficient arrays must align one-to-one with `validatedRequest.wavelengthsNm`. |
| `solar-transmittance.invalid.nonfinite-weight-rejects` | Non-finite source-path integration weights reject loudly. |
| `solar-transmittance.surface-point.visible-surface` | A visible selected surface hit gets source transmittance and source spectrum for later surface radiance. |
| `solar-transmittance.visible-grid.cie-full-range-aligns` | The CIE-backed `360-830 nm`, `1 nm`, `471`-row visible grid is accepted when coefficient arrays align. |

Positive/negative pairing audit:

| Extreme family | Positive side | Negative side |
| --- | --- | --- |
| Empty/vacuum path | Empty medium sample output and visible vacuum source path. | No negative counterpart needed for empty input; malformed prerequisites are covered by the stage descriptor and direct missing-prerequisite spec. |
| Homogeneous transport | Single-wavelength and multi-wavelength Beer-Lambert source-path rows. | Negative extinction rejects; non-finite source-path weight rejects. |
| Wavelength-grid shape | CIE full visible grid aligns with matching coefficient arrays. | Shape mismatch rejects rather than broadcasting, truncating, or padding. |
| Source visibility | Visible source samples preserve transmittance and metadata. | Occluded source samples emit zero source transmittance without redoing geometry. |
| Surface point handoff | Selected visible surface hits emit `solarTransmittance.surfacePoint`. | Missing surface hits omit that optional handoff and set `includesSurfacePoint: false`. |

Source support:

- PBRT Transmittance supplies optical depth and Beer-Lambert source-path
  transport.
- PBRT Volume Scattering Processes supplies nonnegative attenuation-coefficient
  semantics.
- Official CIE 1931 metadata supplies the selected visible-grid stress row.
- [Code Design](code_design.md) supplies the local packet/API contract:
  `integrateSolarTransmittance` consumes model-owned source samples and
  source-path segments rather than performing geometry itself.

Fixture/test status: rows for this batch live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/solar-transmittance-contracts.json`.
The active direct specs live in
`scripts/flat/atmosphere_rejected/reference/stages/_tests/IntegrateSolarTransmittanceStage.spec.js`.
The stage implementation has source breadcrumbs for Beer-Lambert accumulation,
nonnegative coefficient validation, source visibility handling, and local
packet-shape decisions.

Canonical contract alignment:

- [Stage Contracts](stage_contracts.md#integratesolartransmittance) defines
  the downstream handoff target for this stage. Code, ambient types, fixtures,
  descriptor prerequisites/provides, and direct tests now cover the source
  spectrum, source direction, optional surface point, `rayPath` prerequisite,
  and metadata handoff required before downstream radiance stages consume
  `solarTransmittance`.

## Fixture And Reference Intake

For each new fixture row, record:

- stable `id`
- `stage`
- quantity under test
- source class
- canonical `reference`
- supporting references when useful
- assumptions and units
- input packet or controlled model returns
- expected output or `expectedError`
- tolerance, when numeric comparisons are not exact
- independence note explaining why the expectation does not come from the
  implementation under test

Use [Fixture Sources](fixture_sources.md) to decide whether a fixture source is
ready. Update [Reference Decision Log](references.md) whenever a source changes
a value range, fixture, invariant, model assumption, or review checklist.

## Verification Record

Latest focused test state:

- `npm run test:scripts:flat` passes with 279 specs and 0 failures after the
  reference-integrator-only closure pass. `CpuSpectralReferenceIntegrator`
  now rejects non-array custom stage lists, duplicate custom stage ids,
  descriptors without `StageClass`, scalar probes, and name-only probes before
  a named probe registry exists. The obsolete placeholder-stage fallback was
  removed, and the local test README now reflects the active split between
  registry, facade, handoff, trace integration, and direct stage specs.
- `npm run test:scripts:flat` passes with 274 specs and 0 failures after adding
  app-linked and real-Sun light-extent floor coverage. The CLI helper specs now
  cover light scenario flag parsing, a named close-horizontal dense-air run
  that crosses useful light before near-opacity, app flat default floor rows,
  real-Sun San Jose floor rows, and Markdown/SVG/summary evidence output. The
  generated evidence command writes JSON, Markdown, and SVG artifacts under
  `tmp/flat-light-extent/`.
- `npm run test:scripts:flat` passes with 269 specs and 0 failures after
  splitting integration coverage into `pipeline-handoffs.spec.js` and
  `trace-ray.integration.spec.js`. The handoff spec now covers
  `sampleViewPath -> evaluateMedium -> integrateViewOpticalDepth`,
  `integrateSolarTransmittance -> evaluateScatteringPhase`, and
  scattering/surface composition packet alignment. The full trace spec now
  covers vacuum black output, one-sample homogeneous isotropic sky scattering,
  and Lambertian surface radiance attenuated by the view atmosphere.
- The earlier `npm run test:scripts:flat` run with 264 specs and 0 failures
  remains covered for `run-reference-probe.js`, focused CLI helper specs,
  lightweight Rayleigh and Henyey-Greenstein phase checks, and the controlled
  plus Earth-like sky-patch visual-evidence artifact generation paths. The
  sky-patch path uses a `380-780 nm` / `20 nm` grid, analytic CIE-style display
  conversion, and approximate Chappuis-band ozone absorption. The generated
  evidence commands write JSON, Markdown, and SVG artifacts under
  `tmp/flat-reference-visual-evidence/` and
  `tmp/flat-reference-sky-patches/`.
- `npm run test:scripts:flat` passes with 257 specs and 0 failures after
  replacing the `_tests/CpuSpectralReferenceIntegrator.spec.js` domain scaffold
  with executable facade-contract coverage.
- The earlier final transport stage batch for `integrateSingleScattering`,
  `resolveSurfaceRadiance`, and `composeSpectralRadiance` remains covered.
- The earlier first `evaluateScatteringPhase` implementation batch remains
  covered.
- `evaluateScatteringPhase` now has direct tests and implementation for
  explicit isotropic phase metadata, Rayleigh phase shape,
  Henyey-Greenstein forward-scattering ordering, local angle diagnostics,
  empty output, and unsupported phase-kind rejection.
- The earlier stage-implementation instruction update that carries the
  source-breadcrumb standards into future stage work remains covered.
- The earlier final source/design documentation consistency pass for the
  implemented-stage source-breadcrumb audit remains covered.
- The earlier remaining fixture-file metadata sweep for
  `analytic-invariants.json`, `medium-contracts.json`, and
  `view-samples-contracts.json` remains covered.
- The earlier shared utility breadcrumb pass for `_tests/test-pipeline-stages.js`,
  `_tests/test-expectations.js`, `_tests/utils.spec.js`, and
  `_tests/pipeline-stages.spec.js` remains covered.
- The earlier three-spec assertion breadcrumb pass for
  `ValidateRequestStage.spec.js`, `ResolveRayPathStage.spec.js`, and
  `SampleViewPathStage.spec.js` remains covered.
- The earlier `integrateSolarTransmittance` contract-alignment pass through
  ambient types, code, fixtures, and direct tests remains covered, including
  the input-shape policy update that tolerates unrelated extra fields while
  asserting contracted output fields and values.
- The hardening fixture rows still validate through the global fixture
  envelope checks.
- Endpoint validation implementation note: `undefined` means no endpoint was
  supplied by this packet shape, while `NaN`/`Infinity` are supplied non-finite
  values and reject.
- The integration coverage includes real adjacent handoff regressions for
  view sample/medium/optical-depth fields, source transmittance to phase data,
  and scattering/surface composition components. It also includes full
  `traceRay` known-answer fixtures for vacuum, homogeneous isotropic sky
  scattering, and Lambertian surface attenuation.
- `evaluateMedium` now has direct boundary coverage for rejecting non-finite
  `world.altitudeAt` returns before altitude is carried downstream.
- `integrateViewOpticalDepth` now has a regression that rejects parallel
  wavelength ownership by reading only `validatedRequest.wavelengthsNm`, even
  when a stale top-level `packet.wavelengthsNm` is present.
- `git diff --check` passed after adding the integrator spec domain scaffold.

Update [Status](status.md) after each red-to-green loop with what changed, what
was verified, and what remains next.
