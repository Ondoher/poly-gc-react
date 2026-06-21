# Reference Plan

This plan implements the script-owned CPU truth engine described in
[Code Design](code_design.md) and the canonical stage packet contracts in
[Stage Contracts](stage_contracts.md). It is narrower than the full
[Atmosphere Reset Plan](../plan.md): this document ends when
`scripts/flat/atmosphere/reference` can compute trusted spectral reference rays
with diagnostics. Shader parity and app integration come later. The stage-level
test matrix lives in [Test Design](test_design.md), and the actionable
test-writing sequence lives in [Test Plan](test_plan.md).

## Goal

Create a test-first, framework-free reference package under:

```text
scripts/flat/atmosphere/reference/
```

The package should compute spectral radiance, CIE XYZ, linear RGB, and
diagnostics for globe and flat/local-Sun fixtures using the same integrator.
Design it so extraction into a separately versioned package would be a later
promotion step, not a rewrite.

## Ground Rules

- Write tests first for each phase.
- Prefer analytic and invariant expectations before sampled/image expectations.
- Keep the implementation independent of React, Three.js, browser canvas, and
  shader code.
- Mine the current app architecture for useful names and model shapes, but do
  not preserve old mixed-unit or RGB-transport contracts.
- Keep all numerical controls separate from physical constants.
- For any code or test backed by a physical property, include a reference and a
  short description of what that source supports. Keep local API policies
  labeled as local policies instead of dressing them up as physics.
- Do not introduce display/exposure/tone-mapping decisions into physical
  radiance calculations.
- Keep the core framework-free and plain-data based so it can later move out of
  the app repo.
- Add every decision-shaping external source to
  [Reference Decision Log](references.md), including assumptions, limits, and
  whether the source provides hard invariants, plausibility ranges, or
  reference-data fixtures.
- Treat fixtures and CLI outputs as publishable validation evidence, with
  deterministic JSON as the canonical machine artifact and Markdown as the
  human-facing report.
- Keep internal helpers replaceable. When a validated external library has
  better provenance, standards alignment, numerical coverage, licensing, and
  maintenance, evaluate replacing the helper through a narrow wrapper after
  domain tests already define the expected behavior.

## Deliverable Shape

Initial file layout:

```text
scripts/flat/atmosphere/reference/
  index.js
  spectral-grid.js
  colorimetry.js
  radiometry.js
  atmosphere-profile.js
  CpuSpectralReferenceIntegrator.js
  pipeline-stages.js
  types.d.ts
  diagnostics.js
  geometry/
    spherical-world.js
    flat-world.js
  sources/
    distant-sun.js
    local-finite-sun.js
  surfaces/
    lambertian-surface.js
  fixtures/
    vacuum.js
    homogeneous-medium.js
    earth-clear-day.js
    flat-local-sun.js
  _tests/
```

Add small local fixtures first. Bring in external spectral data only after the
file/data-source decision is explicit.

## Test Command

Use the focused script test path:

```text
npm run test:scripts:flat
```

Do not rely on browser/UI tests for the reference package core. UI and shader
parity tests come after the CPU reference has trusted known-answer outputs.

## Current Checkpoint

The stage lifecycle has been executed through `integrateSolarTransmittance`.
Completed canonical stages are `validateRequest`, `resolveRayPath`,
`sampleViewPath`, `evaluateMedium`, `integrateViewOpticalDepth`,
`integrateSolarTransmittance`, `evaluateScatteringPhase`,
`integrateSingleScattering`, `resolveSurfaceRadiance`, and
`composeSpectralRadiance`.

Current implementation checkpoint: the diffuse-sky-airlight approximation has
been backed out of the canonical reference pipeline. The active stage order now
goes directly from `integrateSingleScattering` to `resolveSurfaceRadiance` and
then `composeSpectralRadiance`.

Latest focused verification: `npm run test:scripts:flat` passes with 279
specs and 0 failures after closing the current reference-integrator-only API
boundary. The next implementation layer is benchmark worlds, cameras, and CLI
evidence: reusable globe/flat model adapters, camera-relative probes,
post-pipeline color/display consumers, and deterministic benchmark scenario
artifacts before shader parity.

Latest focused verification: `npm run test:scripts:flat` passed with
352 specs and 0 failures after removing the diffuse-sky-airlight approximation
from the canonical stage registry, composition, CLI/reporting path, tests, and
docs contracts. The old diffuse-sky-airlight fixture/spec batch is no longer
part of the current contract.

Contract checkpoint: [Stage Contracts](stage_contracts.md) is now the canonical
input/output contract for every pipeline stage. The contract-alignment pass
has updated `pipeline-stages.js`, ambient `types.d.ts`, implemented stage code,
solar fixtures, and direct tests so downstream radiance stages have a firm
`solarTransmittance` handoff target.

## Current Next Focus: Output-Impact Reference Work

The next atmosphere work should target the reference-runner model ingredients
most likely to move rendered output. These tasks are sorted by likely effect
on sky images, not by implementation convenience.

General goal: close the identified weaknesses by moving the reference runner
toward Bruneton's documented methods, data, and comparison assumptions one
delta at a time. Each task should isolate a specific difference from the
Bruneton 2016 comparison contract, produce evidence for that difference, and
avoid tuning directly against photographs until the Bruneton-method gap is
understood.

Task 1: Split aerosol phase into a named policy and add Cornette-Shanks.

Rationale: this is the most direct mismatch between the current pipeline and
the Bruneton 2016 paper contract. The current aerosol scalar fit is close to
the paper, but the phase function is Henyey-Greenstein instead of
Cornette-Shanks. Under the Bruneton-method parity goal, Cornette-Shanks is the
paper-aligned phase behavior for the Kider-fit comparison, while
Henyey-Greenstein remains a named control. This can change horizon color,
aureole structure, and overall contrast without changing
AOD/SSA/scale-height inputs.

Concrete plan:

Preimplementation contract work:

1. Pin the Bruneton source facts before writing code:
   - exact Cornette-Shanks formula and source citation
   - Bruneton/Kider aerosol parameters this comparison is trying to match
   - which source supports each fact
   - any local interpretation notes, especially the current
     `evaluateScatteringPhase` source-to-camera `cosTheta` sign convention
2. Define the isolated Bruneton-method delta. The first comparison changes
   aerosol phase shape only; AOD, Angstrom exponent, single-scattering albedo,
   scale height, sampling, wavelength grid, display/tone policy, geometry,
   Sun rows, and multiple-scattering mode stay fixed.
3. Record the intended contracts before code:
   - no new stage; modify the existing `evaluateScatteringPhase` behavior
   - `evaluateScatteringPhase` supports `cornette-shanks`
   - aerosol scalar policy owns AOD, Angstrom exponent, single-scattering
     albedo, and scale height
   - aerosol phase policy owns `{ kind, parameters.g, provenance }`
   - `bruneton-2016-kider-fit` resolves to Cornette-Shanks by default
   - Henyey-Greenstein remains available as an explicit control policy
4. Define the CLI and metadata contract:
   - planned flag: `--aerosol-phase-policy <id>`
   - omitted flag uses the selected aerosol scalar preset's
     `defaultPhasePolicyId`
   - JSON and Markdown reports expose both `aerosolPolicy` and
     `aerosolPhasePolicy`
5. Define the test and fixture inventory before coding:
   - phase-policy data validation
   - preset-to-phase default resolution
   - Henyey-Greenstein and Cornette-Shanks numeric phase values
   - unsupported phase kind/policy rejection
   - CLI accepted/rejected phase policy ids
   - report metadata includes the resolved phase policy
   - same-scalar HG-versus-Cornette-Shanks selection
6. Define the first artifact contract before generation:
   - folder: `tmp/atmosphere/bruneton/001-aerosol-phase-policy/`
   - files: `manifest.json`, `hg-control.png`, `cornette-shanks.png`,
     `comparison.md`, and `progress.log`
   - comparison:
     `bruneton-2016-kider-fit + bruneton-2016-hg-g070-control` against
     `bruneton-2016-kider-fit + bruneton-2016-cornette-shanks-g070`
   - multiple scattering explicitly disabled/no-op
7. Update `reference/test_plan.md`, `reference/references.md`,
   `reference/stage_contracts.md`, and status docs as needed so the follow-up
   reaches at least `identified`, and reaches `fixtures` or `tests` if the
   expected numeric phase values are pinned before implementation.

Current implementation status: Task 1 is implemented and verified. The
reference runner now has named aerosol phase policies, scalar presets resolve a
`defaultPhasePolicyId`, `evaluateScatteringPhase` supports
`cornette-shanks`, phase math is centralized for the stage and reference-probe
diagnostics, `--aerosol-phase-policy` selects explicit HG/CS controls, reports
expose `aerosolPhasePolicy`, and the first phase-only artifact lives at
`tmp/atmosphere/bruneton/001-aerosol-phase-policy/`.

Implementation sequence after the contract is pinned:

1. Add an aerosol phase policy artifact at
   `scripts/flat/atmosphere/data/composition/aerosol/aerosol-phase-policies.json`.
   The phase policy owns `kind`, `parameters.g`, source/provenance, and label.
2. Keep aerosol scalar presets focused on AOD, Angstrom exponent, single
   scattering albedo, and scale height. Each preset names a
   `defaultPhasePolicyId`; phase function kind and `g` are owned by the named
   phase policy.
3. Add first phase policies for the current preview/HG behavior and the paper
   comparison behavior:
   `preview-hg-g080`, `clear-maritime-hg-g076`,
   `clear-maritime-hg-g060`, `clear-maritime-hg-g086`,
   `continental-hg-g070`, `hazy-continental-hg-g068`,
   `bruneton-2016-hg-g070-control`, and
   `bruneton-2016-cornette-shanks-g070`.
4. Add `scripts/flat/atmosphere/composition/aerosol-phase-policy.js` with
   `loadAerosolPhasePolicyData`, `aerosolPhasePolicyIds`, and
   `resolveAerosolPhasePolicy`. Validate known phase kinds, finite `g`, and
   `g` inside `(-1, 1)` for Henyey-Greenstein and Cornette-Shanks.
5. Centralize phase math in a small framework-free helper, then use it from
   both `EvaluateScatteringPhaseStage.js` and the multiple-scattering
   diagnostic evaluator in `run-reference-probe.js`. This removes the current
   duplicated Henyey-Greenstein implementation before adding Cornette-Shanks.
6. Add Cornette-Shanks with the current source-to-camera sign convention:
   `mu = -cosTheta`, then
   `P_CS(mu,g) = 3 * (1 - g^2) * (1 + mu^2) / (8 * pi * (2 + g^2) * (1 + g^2 - 2gmu)^(3/2))`.
7. In the Earth-like medium assembly path, resolve the selected aerosol phase
   policy and emit the aerosol species phase from that policy. Metadata and
   reports expose `aerosolPhasePolicy`.
8. Add `--aerosol-phase-policy <id>` to the reference runner. If omitted, use
   the selected aerosol scalar preset's `defaultPhasePolicyId`; explicit
   overrides let comparison runs hold AOD/SSA/scale height fixed while
   changing only phase shape.
9. Add focused tests for phase-policy data shape, preset-to-phase resolution,
   Cornette-Shanks phase evaluation, CLI acceptance/rejection, metadata, and
   same-scalar HG-versus-Cornette-Shanks selection.
10. Generate the first comparison under the predeclared artifact contract,
   with explicit output, report, progress-log, and manifest files.

Definition of done: the Bruneton Kider-fit comparison can use
Cornette-Shanks by explicit phase policy, current preview behavior remains an
explicit Henyey-Greenstein policy, reports identify the phase policy, and the
comparison artifact shows how much horizon color/contrast moves from phase
shape alone.

Task 2: Add named horizon-safe sampling profiles and convergence checks.

Rationale: the existing Figure 1 local artifact used only `2` source-path
steps in a high-airmass horizon regime. Before judging model ingredients,
reference runs need named profiles such as `fast-preview`, `paper-comparison`,
and `horizon-safe`, with reports showing whether key
horizon/zenith spectra and display metrics stabilize as sampling increases.

Experiment status: the sampling-convergence diagnostic pass is complete at
`tmp/atmosphere/bruneton/003-sampling-convergence/`. It held the Bruneton
Kider-fit scalar aerosol, Cornette-Shanks phase, Bucholtz Rayleigh, Brion
ozone, U.S. Standard Atmosphere density, exponential display, and disabled
multiple scattering fixed while sweeping `12/2`, `24/4`, `48/8`, and `96/16`
sampling on `36 px` domes, plus a `48 px` low-vs-high confirmation. Conclusion:
sampling is a major contributor to the daylight brown outer ring. The three
daylight rows move from about `6-8%` warm/non-blue affected area at `12/2` to
near-zero warm/non-blue area by `96/16`; the `48 px` confirmation repeats the
same direction. The dawn/low-Sun row becomes more broadly warm at higher
sampling, but still does not produce the large soft sunset/orange affected
area seen in richer model references.

Implementation status: Task 2 is closed out in the reference runner. The CLI
now accepts `--sampling-profile fast-preview|paper-comparison|horizon-safe`,
rejects mixing a named profile with raw `--view-steps` or
`--sun-transmittance-steps`, and records the resolved profile in JSON,
Markdown, summaries, progress events, sky-patch metadata, sky-dome panel
metadata, and baseline-freeze metadata. `fast-preview` is the explicit `12/2`
preview/ablation lane, `paper-comparison` is the `96/16` model-comparison lane,
and `horizon-safe` is the slower `128/32` low-elevation diagnostic lane.
Bruneton-style `--sky-dome-grid` renders now default to `paper-comparison`
instead of an unnamed numeric default; custom numeric steps remain available
only as explicitly recorded `custom-explicit` experiment metadata.

Closeout recommendation: do not draw model-family conclusions from `12/2`
artifacts. Use `paper-comparison` for ordinary Bruneton-style dome evidence,
reserve `horizon-safe` for low-elevation convergence checks, and proceed to the
remaining model-ingredient deltas for the sunset/aureole size problem.

Follow-up isolation: `tmp/atmosphere/bruneton/005-hg-high-sampling-isolation/`
fills the missing `HG 96/16` quadrant at `72 px` and compares HG/CS against
low/high sampling. It confirms the visible progress is sampling-driven:
under HG alone, moving from `12/2` to `96/16` removes the daylight warm/non-blue
ring and expands the low-Sun warm area from about `9.7%` to about `20.0%`.
HG-to-CS phase effects remain small at both sampling levels.

Verification: `npm run test:scripts:flat` passed with 382 specs and 0 failures
after adding the sampling-profile contract and report/metadata tests.

Task 3: Add a named no-visible-molecular-absorption/no-ozone paper contract.

Rationale: Bruneton 2016's fitted comparison intentionally ignored visible
air-molecule absorption, while the current local comparison uses Brion ozone.
This can shift visible spectral balance, especially in long horizon paths. It
should be an explicit paper-contract policy, not a fallback or hidden override.

Implementation status: Task 3 is implemented and experimentally closed. The
composition layer now exposes `bruneton-2016-no-visible-absorption` as a named
zero-cross-section ozone/visible-absorber policy backed by the Bruneton 2016
comparison assumption. The existing `--ozone-policy` CLI path passes it through
normal sky-model assembly into `atmosphere.mediumAt`, so `evaluateMedium`
receives zero ozone absorption without any transport-stage branch.

Experiment artifact: `tmp/atmosphere/bruneton/006-no-visible-absorption/`
compares `brion-1998-ozone-295k` against
`bruneton-2016-no-visible-absorption` at `36 px`, `paper-comparison` sampling,
Bruneton/Kider aerosol, Cornette-Shanks phase, Bucholtz Rayleigh, ASTM G-173,
U.S. Standard Atmosphere density, exponential tone map, and explicit
multiple-scattering no-op. Conclusion: removing visible ozone absorption is
visually meaningful for the low-Sun row, raising warm area from about `19.9%`
to `30.2%` and horizon warm area from `75%` to `100%`; daylight rows mostly
show small luminance lifts and little to no warm-area change. This policy is
important for Bruneton-method parity, but it still does not explain the
missing broad soft sunset/orange affected area by itself.

Verification: `npm run test:scripts:flat` passed with 384 specs and 0 failures
after adding the no-visible-absorption policy, runner metadata test, and
artifact comparison; `git diff --check` also passed.

Display-only parity audit checkpoint:

The display/color layer has a cheap diagnostic audit before paper-panel image
matching. `scripts/flat/atmosphere/display-parity-audit.js` compares fixed
spectra, fixed linear-RGB probes, and explicit saved radiance samples through
the existing CIE, exposure, exponential tone-map, and byte-encoding path
without re-running atmosphere transport. It also adds an unnormalized CIE XYZ
diagnostic path beside the current equal-energy normalized color path so the
display-scale assumption can be measured directly.

Artifact: `tmp/atmosphere/bruneton/007-display-parity-audit/` contains
`audit.json`, `audit.md`, `audit.png`, `audit.ppm`, and `manifest.json`, using
Task 3's `006-no-visible-absorption/summary.json` as the explicit
`--source-summary` input. Conclusion: raw CIE XYZ carries about `106.96x` more
Y scale than the current normalized path on the audit samples; changing
normalized exponential display exposure from `1` to `8` shifts mean
display-linear luminance by about `0.171`; and raw-vs-normalized display at
exposure `8` still differs by mean encoded RGB delta about `0.540`. Display
scale must therefore be pinned before judging paper PNG parity. This is a
perceived-contrast/saturation concern, not a likely explanation for the brown
horizon geometry or missing broad sunset/aureole area.

Verification: `npm run test:scripts:flat` passed with 389 specs and 0 failures
after adding the display parity audit and raw-XYZ diagnostic tests.

Aerosol/Mie perimeter audit checkpoint:

The reference runner now supports `--dome-sample-mask full|horizon-ring` for
`--sky-dome-grid` renders. `full` preserves the complete fisheye dome; the
`horizon-ring` mask traces only pixels at fisheye radius `>= 0.88`, writes
explicit skipped-pixel provenance for the interior, excludes skipped pixels
from skydome metrics, and emits sampled/skipped counts in JSON, Markdown, and
progress events. This is a diagnostic speedup for the current perimeter/brown
ring work, not a replacement for full-frame image conclusions.

Artifact: `tmp/atmosphere/bruneton/008-aerosol-mie-parity-audit/` contains
`audit.json`, `audit.md`, `manifest.json`, `progress.log`, and masked
`image-sweep/*.png` files. Conclusion: the Bruneton/Kider aerosol preset
matches the Angstrom beta/alpha, single-scattering albedo, and scale-height
contract to about `3.68e-13` max relative coefficient error; sea-level
`550 nm` aerosol scattering is about `3.75x` Rayleigh scattering; and the
Cornette-Shanks phase convention is strongly forward scattering with
forward/side ratio about `134.7`. Named aerosol policies do move the masked
horizon ring, especially hazy/continental variants, but the movement looks
like parameter/environment choice and possibly missing surface/ground coupling
rather than a missing basic Mie coefficient or phase algorithm.

Verification: `npm run test:scripts:flat` passed with 395 specs and 0 failures
after adding the sky-dome sample mask and aerosol/Mie parity audit tests.

Weakness factor audit checkpoint:

`scripts/flat/atmosphere/weakness-factor-audit.js` now ranks the current
suspects with a controlled source-quadrature diagnostic, a real aerosol-policy
perimeter sweep, and clearly marked display-side proxy sweeps for surface
coupling and aureole movement. The proxy sweeps are sensitivity rulers only;
they are not canonical transport and should not be promoted as model output.

Artifact: `tmp/atmosphere/bruneton/009-weakness-factor-audit/` contains
`audit.json`, `audit.md`, `manifest.json`, `progress.log`, and comparison
PNGs under `images/`. Conclusion: the weakest current contract is source
quadrature. A controlled one-source sample returns radiance about `0.31831`,
but two half-weight source samples return about `0.63662`, and adding a
zero-weight extra source also returns about `0.63662`; expected weighted ratio
is `1.0`, actual ratio is `2.0`. That means `sourceSample.weight` and
`solidAngleSr` are preserved as diagnostics but not applied by
single-scattering accumulation, so finite-Sun/aureole sampling cannot be made
trustworthy yet. Aerosol policy remains responsive but not decisive:
Rayleigh-only gives the best daylight perimeter blue dominance, while
Bruneton/Kider still trends slightly non-blue at the horizon; hazier aerosol
families worsen brown perimeter metrics. Surface-coupling proxies improve the
daylight perimeter only when the injected secondary light is strongly
blue-biased, so generic neutral/warm ground bounce is not a credible primary
fix.

Recommendation: fix source quadrature and finite solar-source handling first,
then rerun the sunset/aureole comparison with real weighted source samples.
After that, implement a physical surface/ground secondary-source experiment.
Keep aerosol parameters named and paper-aligned rather than tuning them as the
main fix.

Verification: `npm run test:scripts:flat` passed with 398 specs and 0 failures
after adding the weakness factor audit and source-quadrature diagnostic tests;
`git diff --check` also passed.

Task 4: Pin the source-weight transport contract.

Rationale: the weakness audit showed the pipeline preserves
`sourceSample.weight` and `solidAngleSr`, but `integrateSingleScattering`
currently sums source samples as if each had full weight. That makes any
finite-Sun or aureole conclusion unreliable because two half-weight samples
double the one-sample result, and a zero-weight extra sample still contributes.

Concrete plan:

1. Define the current contract as
   `contribution = T_view * sigma_s * phase * sourceRadiance * T_source * sourceSample.weight * ds`.
2. Treat `sourceSample.weight` as the transport multiplier consumed by
   `integrateSingleScattering`.
3. Keep `solidAngleSr` as diagnostic/provenance until a later source contract
   explicitly switches source spectra to radiance-per-steradian integration.
4. Require source samples entering single-scattering to carry finite,
   nonnegative weights. Do not add fallback defaults inside the scattering
   stage.
5. Add red tests for:
   - one source sample equals the current one-source baseline
   - two half-weight samples equal that baseline
   - a zero-weight extra sample leaves the baseline unchanged
   - differently angled source samples sum by their weights
   - missing or invalid weights fail loudly under the current contract

Definition of done: the controlled source-quadrature diagnostic no longer
reports a `2.0` split-sample ratio, one-sun directional runs remain unchanged,
and the stage/test docs name `sourceSample.weight` as a consumed transport
field.

Current Task 4 status: complete. Contract docs and fixture-backed red tests
were added first. The analytic fixture ledger includes split-source,
zero-weight, weighted-phase, missing-weight, and invalid-weight rows for
`integrateSingleScattering`, and those tests now pass after Task 5.

Task 5: Apply source weighting in single-scattering accumulation.

Rationale: after the contract is pinned, the current implementation needs the
smallest transport change that makes source quadrature real instead of
metadata-only.

Concrete plan:

1. Update `IntegrateSingleScatteringStage` to multiply each source-sample
   contribution by the validated source weight.
2. Preserve the existing one-sample directional-sun result by making the
   upstream source adapter provide explicit `weight: 1`.
3. Reject missing, negative, or non-finite weights at the consuming boundary.
4. Keep the implementation scoped to source-sample weighting; do not tune
   aerosol, display, exposure, or multiple-scattering behavior in this task.
5. Rerun `weakness-factor-audit.js` and confirm the controlled source
   quadrature section changes from "weight not applied" to "weight applied".

Definition of done: focused stage tests are green, the weakness audit confirms
the source-weight fix, and docs/status record that finite source sampling can
now be evaluated without the known double-counting bug.

Current Task 5 status: complete. `IntegrateSolarTransmittanceStage` now
requires source adapters to provide finite nonnegative `sourceSample.weight`
values, and `IntegrateSingleScatteringStage` multiplies each source-sample
contribution by that weight. The weakness-factor audit now reports
`source-sample-weight-applied`, with split-weight and zero-weight-extra ratios
both near `1.0`. Verification: `npm run test:scripts:flat` passed with
`403 specs, 0 failures`.

Task 6: Add an explicit finite solar-source adapter mode.

Rationale: once weighted source quadrature is real, the runner needs a named
way to compare the current point/directional Sun against a deterministic finite
solar disc without hiding source geometry in ad hoc samples.

Concrete plan:

1. Add named source modes:
   - `directional-sun`: current single source sample with `weight: 1`
   - `finite-sun-disc`: deterministic samples across the solar disc with
     normalized weights summing to `1`
2. Add CLI controls such as
   `--solar-source directional-sun|finite-sun-disc` and
   `--finite-sun-samples <count>`, with final names chosen to match the
   runner's existing option style.
3. Validate that finite-disc directions stay inside the configured solar
   angular radius.
4. Emit source-mode, sample count, angular radius, weight sum, and
   `solidAngleSr` provenance in JSON and Markdown reports.
5. Add convergence tests or diagnostics for increasing finite-disc sample
   counts before trusting low-Sun visual changes.

Definition of done: the runner can render otherwise identical skydomes with
directional and finite-disc source modes, reports expose the source mode, and
finite-disc weights are normalized by construction.

Current Task 6 status: complete. The reference runner now accepts
`--solar-source directional-sun|finite-sun-disc`; `--finite-sun-samples
<count>` is valid only for `finite-sun-disc`. Sky-patch and sky-dome model
adapters emit either one directional source sample with `weight: 1` or a
deterministic equal-area finite-disc sample set with equal weights summing to
`1`. JSON and Markdown outputs record source mode, sample count, solar angular
radius, weight sum, and source quadrature diagnostics from the actual
`solarTransmittance` packet. `solidAngleSr` remains provenance rather than a
transport multiplier. Verification: `npm run test:scripts:flat` passed with
`405 specs, 0 failures`.

Task 7: Rerun sunset/aureole evidence with weighted finite-source samples.

Rationale: the current small sunset/orange area may be partly a source
quadrature artifact. This comparison must happen only after Tasks 4-6, so the
input samples and transport accumulation are meaningful.

Concrete plan:

1. Generate a new artifact folder:
   `tmp/atmosphere/bruneton/010-finite-sun-source-weighting/`.
2. Include at least:
   - directional-sun control
   - finite-sun-disc low sample count
   - finite-sun-disc higher sample count
   - Bruneton/Kider aerosol with Cornette-Shanks phase
   - no-visible-absorption paper policy
   - `paper-comparison` sampling
   - full dome and, where useful, `horizon-ring` masked perimeter evidence
3. Compare sunset warm area, Sun-neighborhood warm area, horizon warm/non-blue
   fraction, horizon/zenith luminance, and visible aureole radius.
4. Treat the run as evidence only if the finite-source effect is stable under
   sample count increases.

Definition of done: the artifact records whether finite solar-source handling
materially changes the low-Sun/sunset neighborhood and whether it addresses
the too-small orange/aureole area.

Current Task 7 status: complete. The artifact lives at
`tmp/atmosphere/bruneton/010-finite-sun-source-weighting/` and contains
file-directed JSON, PNG, Markdown, progress logs, `summary.json`,
`manifest.json`, and `comparison.md`. The sweep includes a higher-resolution
`36 px` directional control, fair full-frame `12 px` directional/finite-5/
finite-9 comparisons, and fair `24 px` horizon-ring directional/finite-5/
finite-9 comparisons, all with paper-comparison sampling and explicit
multiple-scattering no-op. Result: finite solar-disc source sampling has
negligible image-metric effect. Low-Sun warm area, horizon warm fraction,
Sun-neighborhood warm fraction, and the rough warm-radius proxy do not move in
the fair sweeps; the largest recorded metric delta is about `0.00050047`.
Conclusion: finite solar-source angular extent is not the main cause of the
too-small sunset/orange affected area. Proceed to Task 8.

Task 8: Add a physical surface/ground secondary-source experiment.

Rationale: the aerosol/Mie and weakness audits both point at possible missing
surface/ground coupling, but display-side proxies only help when they inject
strongly blue-biased light. The next version must be a transport-side,
named-surface experiment rather than a display lift or hidden haze term.

Concrete plan:

1. Keep this behind a diagnostic experiment path until Task 7 is interpreted.
2. Add named lower-boundary/surface variants such as black, neutral
   Lambertian, ocean-like blue/cyan, warm land, and possibly later Fresnel
   ocean.
3. Feed secondary light through an explicit surface/ground source contract,
   not through display tone mapping or a diffuse-sky fallback.
4. Measure daylight horizon blue dominance, brown/non-blue horizon fraction,
   horizon saturation and luminance, sunset warm area, and Sun-neighborhood
   warm fraction.
5. Require evidence that the surface model moves the daylight perimeter in a
   physically plausible way without destroying the low-Sun result.

Definition of done: the artifact shows whether missing surface/ground coupling
is a credible next implementation target after finite source handling.

Task 9: Add paper-aligned skydome comparison metrics and contact sheets.

Rationale: this will not directly change pixels, but it will make output
movement measurable against the extracted Bruneton Figure 1 panels. Track
contrast, horizon chroma, blue-minus-warm, zenith/horizon luminance, and
Sun-neighborhood behavior, and produce comparison sheets with the paper panels
beside ours.

Task 10: Standardize experiment manifests and artifact naming.

Rationale: this should not change pixels, but it reduces experiment ambiguity.
Each numbered experiment should have a small manifest recording command,
inputs, source references, output files, progress log, and summary metrics.
Prefer compact named files such as `result.png`, `result.md`, `result.json`,
`progress.log`, and `manifest.json`, avoiding huge JSON unless explicitly
requested.

## Immediate Remediation: Implemented-Stage Source Breadcrumb Audit

Status: complete. This audit was completed before resuming
`evaluateScatteringPhase`.

Goal: every implemented-stage algorithm choice, code branch, and test assertion
must have a nearby reason and source reference. Assertions that directly compare
against fixture-owned expectations may rely on fixture provenance, but every
fixture row must then carry the relevant source reference, derivation, units or
comparison policy, and independence note. Physical claims need external
references; API/schema claims may cite local design or stage-contract docs.

Scope:

- Implemented stages: `validateRequest`, `resolveRayPath`, `sampleViewPath`,
  `evaluateMedium`, `integrateViewOpticalDepth`, and
  `integrateSolarTransmittance`.
- Direct stage specs, shared spec helpers, and package-level stage/fixture
  specs used by those implemented stages.
- Fixture files:
  `analytic-invariants.json`, `ray-path-contracts.json`,
  `view-samples-contracts.json`, `medium-contracts.json`,
  `view-optical-depth-hardening.json`, and
  `solar-transmittance-contracts.json`.

Staged remediation:

1. Find the sourced justification for every gap. Classify each item as
   physical/math, API/schema, numerical policy, or fixture comparison policy.
   Use external references for physical/math claims, local design docs for
   API/schema claims, and explicit convergence or comparison-policy evidence
   for tolerances and rounding.
2. Update the related sources documentation first:
   [Reference Decision Log](references.md), [Fixture Sources](fixture_sources.md),
   [Stage Contracts](stage_contracts.md), [Code Design](code_design.md),
   [Test Design](test_design.md), or this plan when those documents own the
   rationale.
3. Annotate code, fixtures, and tests. Add source-breadcrumb comments near
   branches and algorithm choices, add comments or fixture indirection for
   direct test assertions, and expand fixture metadata/validation so row-level
   provenance is enforceable across all implemented-stage fixtures.
4. Verify with `npm run test:scripts:flat` and `git diff --check`, then update
   [Status](status.md) and [Test Plan](test_plan.md) before resuming
   `evaluateScatteringPhase`.

Deficiency tracker:

Use these row statuses: `pending`, `sourced`, `documented`, `updated`, and
`verified`.

| Status | Area | Deficiency | Next action |
| --- | --- | --- | --- |
| `verified` | `EvaluateMediumStage.js` | Algorithm and branch breadcrumbs are incomplete. Audit every branch, including the no-medium/vacuum path, direct coefficient path, absorption-plus-scattering derivation, species summation, composition residual checks, profile/composition preservation, invalid density/coefficient/composition rejection, `world.altitudeAt` ownership, `atmosphere.mediumAt` lookup, optional or missing coefficient arrays, and validation helpers such as finite-number, unit-fraction, wavelength-shape, and extinction-consistency checks. | Completed: sourced in [Reference Decision Log](references.md#evaluatemedium-implementation-branch-source-map), annotated in `EvaluateMediumStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `EvaluateMediumStage.js` | Numerical-policy breadcrumbs are incomplete for `1e-12` comparison tolerances and `toPrecision(15)` coefficient summation/rounding. | Completed: documented in [Code Design](code_design.md#evaluatemedium-contract-notes) and [Reference Decision Log](references.md#evaluatemedium-numerical-policy-source-map), replaced raw literals with named production/test constants, annotated each use, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `IntegrateSolarTransmittanceStage.js` | Branch and algorithm breadcrumbs are incomplete around optional surface-point handling, occluded source samples, source-spectrum and source-direction validation/preservation, model-owned source-path segment selection, surface-hit source-path requests, nonnegative finite metadata, source-sample counts, and source-path Beer-Lambert integration. | Completed: sourced in [Reference Decision Log](references.md#integratesolartransmittance-implementation-branch-source-map), annotated in `IntegrateSolarTransmittanceStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ValidateRequestStage.js` | Request-validation branch breadcrumbs need a final audit, including model owner/interface checks, observer/ray vector validation, ray-direction normalization, wavelength-grid validation, numerical-control merging/filtering, tolerated extra request fields, tolerated request-level physical coefficient shadow fields without output ownership, and model/default immutability decisions. | Completed: sourced in [Reference Decision Log](references.md#validaterequest-implementation-branch-source-map), annotated in `ValidateRequestStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ResolveRayPathStage.js` | Ray-path branch breadcrumbs need a final audit, including atmosphere miss/hit handling, forward clipping of negative entries, behind-observer empty paths, zero-length boundary paths, surface-before/at/after atmosphere precedence, malformed or non-finite model intersections, flat named lateral-boundary handling, unbounded horizontal rejection, and boundary metadata preservation. | Completed: sourced in [Reference Decision Log](references.md#resolveraypath-implementation-branch-source-map), annotated in `ResolveRayPathStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `SampleViewPathStage.js` | View-sampling branch breadcrumbs need a final audit, including empty and zero-length path policy, segment distance validation, fixed midpoint placement, weight summation, sample ordering, `viewSteps` validation, integration metadata, and ray-path diagnostic preservation. | Completed: sourced in [Reference Decision Log](references.md#sampleviewpath-implementation-branch-source-map), annotated in `SampleViewPathStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `IntegrateViewOpticalDepthStage.js` | View optical-depth branch breadcrumbs need a final audit, including empty medium-sample output, sample weight and interval-end validation, wavelength ownership, coefficient-array shape checks, nonnegative finite extinction validation, cumulative total/species optical-depth accumulation, path-end fallback/endpoint semantics, transmittance conversion, and downstream packet-shape choices. | Completed: sourced in [Reference Decision Log](references.md#integrateviewopticaldepth-implementation-branch-source-map), annotated in `IntegrateViewOpticalDepthStage.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `IntegrateViewOpticalDepthStage.spec.js` | Direct assertions that are not simple fixture comparisons need reason/source comments or fixture ownership. Examples include sample-length/path-end checks, cumulative monotonicity/species checks, stale top-level wavelength ownership checks, stage-history checks, input-immutability checks, and adjacent handoff assertions. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated direct assertions in `IntegrateViewOpticalDepthStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `IntegrateSolarTransmittanceStage.spec.js` | Direct assertions need reason/source comments or fixture ownership, including model-adapter call shape expectations, direct `sourceSpectrum` comparisons, direct `sourceDirection` comparisons, direct `surfacePoint` object assertions, metadata count checks, stage-history checks, and input-immutability checks. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated direct assertions in `IntegrateSolarTransmittanceStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `EvaluateMediumStage.spec.js` | Direct helper, adapter-shape, stage-history, and array-shape assertions need audit when they are not direct fixture comparisons. Test-side numerical policy such as position-key precision needs the same source breadcrumb as production code. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated direct helper assertions in `EvaluateMediumStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ValidateRequestStage.spec.js` | Remaining direct assertions need audit when they are not fixture comparisons, especially stage descriptor/prerequisite checks, canonical output shape, stage-history, model/default immutability, model-interface assertions, tolerated-extra assertions, and invalid vector/grid/numerical-control assertions. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated remaining direct assertion helpers and stage-contract checks in `ValidateRequestStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ResolveRayPathStage.spec.js` | Remaining direct assertions need audit when they are not fixture comparisons, especially stage descriptor/prerequisite checks, model adapter call-shape assertions, rayPath object assertions, boundary metadata assertions, and input immutability/stage-history assertions. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated remaining direct error and stage-contract checks in `ResolveRayPathStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `SampleViewPathStage.spec.js` | Remaining direct assertions need audit when they are not fixture comparisons, especially stage descriptor/prerequisite checks, viewSamples shape/order assertions, metadata assertions, invalid segment/viewSteps assertions, rayPath diagnostic preservation, and stage-history/input-immutability assertions. | Completed: sourced in [Reference Decision Log](references.md#implemented-stage-spec-assertion-source-maps), annotated remaining direct helper, error, stage-history, and stage-contract checks in `SampleViewPathStage.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `_tests/test-pipeline-stages.js` | Shared stage-test helper behavior needs source breadcrumbs, including integrator construction, valid request/model factories, stage descriptor assertions, prerequisite-failure helpers, required model-interface lists, and fixture-facing physical defaults. | Completed: sourced in [Reference Decision Log](references.md#shared-test-utility-source-maps), annotated helper tables/factories and existing helper assertions, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `_tests/test-expectations.js` | Expectation-loader helper behavior needs source breadcrumbs, including fixture loading, expected-value normalization, tolerance lookup, reference/provenance assumptions, and named getter behavior for each implemented-stage fixture family. | Completed: sourced in [Reference Decision Log](references.md#shared-test-utility-source-maps), annotated fixture-loader and id-indexing helper behavior, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `_tests/utils.spec.js` | Shared utility specs need source breadcrumbs for non-fixture assertions, especially vector math, approximate comparison helpers, numerical tolerances, shape checks, and invalid-input/error assertions. | Completed: sourced in [Reference Decision Log](references.md#shared-test-utility-source-maps), confirmed direct assertions already carry reason/source comments, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `_tests/pipeline-stages.spec.js` | Pipeline-stage registry specs need source breadcrumbs for non-fixture assertions, including stage ordering, prerequisite/provided-field metadata, single-stage execution, packet immutability, and failure behavior. | Completed: sourced in [Reference Decision Log](references.md#shared-test-utility-source-maps), confirmed direct assertions already carry reason/source comments, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `expectation-fixtures.spec.js` | Deeper expected-datum validation is still centered on `analytic-invariants.json` even though every fixture row has a canonical `reference`. | Completed: sourced in [Reference Decision Log](references.md#expectation-fixturesspecjs-validation-source-map), extended validation across all expectation fixture files for units, derivation, numeric tolerance, and nonnumeric comparison policy, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ray-path-contracts.json` | Object-valued `expected.rayPath` rows lack an explicit object comparison policy or tolerance declaration. | Completed: added exact structural nonnumeric comparison policy to `ray-path-contracts.json`, enforced it through `expectation-fixtures.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `solar-transmittance-contracts.json` | Expected nonnumeric/object fields such as `visible`, `sourceSampleIds`, and `gridMetadata` lack uniform units or semantic comparison metadata. | Completed: added exact structural nonnumeric comparison policy plus semantic units for `visible`, `sourceSampleIds`, and `gridMetadata`, enforced it through `expectation-fixtures.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `view-optical-depth-hardening.json` | Expected nonnumeric/object fields such as `canonicalGeometryOwner`, `viewOpticalDepthRequiredFields`, `gridMetadata`, checksum fields, `airMassRow`, and `speciesNames` lack uniform units or semantic comparison metadata. | Completed: added exact structural nonnumeric comparison policy plus semantic units for the listed fields, enforced it through `expectation-fixtures.spec.js`, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `analytic-invariants.json` | Row-by-row fixture metadata audit is still needed for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed: sourced in [Reference Decision Log](references.md#fixture-file-metadata-sweep-source-map), confirmed the file currently has numeric scalar or numeric-array expected data only with units, derivations, tolerance rules, source references, and independence notes, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `medium-contracts.json` | Row-by-row fixture metadata audit is still needed for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed: sourced in [Reference Decision Log](references.md#fixture-file-metadata-sweep-source-map), confirmed structural expected data uses the file-level exact structural comparison policy with datum units/derivations and row independence notes, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `ray-path-contracts.json` | File-level fixture sweep for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed as part of the specific `ray-path-contracts.json` row above: added exact structural nonnumeric comparison policy, enforced fixture metadata globally, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `solar-transmittance-contracts.json` | File-level fixture sweep for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed as part of the specific `solar-transmittance-contracts.json` row above: added exact structural nonnumeric comparison policy plus semantic units for named nonnumeric expected fields, enforced fixture metadata globally, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `view-optical-depth-hardening.json` | File-level fixture sweep for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed as part of the specific `view-optical-depth-hardening.json` row above: added exact structural nonnumeric comparison policy plus semantic units for named nonnumeric expected fields, enforced fixture metadata globally, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | `view-samples-contracts.json` | Row-by-row fixture metadata audit is still needed for expected object, boolean, string, array, and checksum values, including source reference, derivation/provenance note, units or semantic kind, comparison policy, and independence note. | Completed: sourced in [Reference Decision Log](references.md#fixture-file-metadata-sweep-source-map), confirmed structural expected data uses the file-level exact structural comparison policy with datum units/derivations and row independence notes, and verified with `npm run test:scripts:flat` plus `git diff --check`. |
| `verified` | Source and design documentation | Source documentation must be current before annotations are treated as done. New or clarified sources need to land in [Reference Decision Log](references.md), [Fixture Sources](fixture_sources.md), [Stage Contracts](stage_contracts.md), [Code Design](code_design.md), or [Test Design](test_design.md) as appropriate. | Completed: audited canonical source/design docs for stale breadcrumb-remediation wording, refreshed `fixture_sources.md` and `status.md`, confirmed source maps and design ownership are current, and verified with `npm run test:scripts:flat` plus `git diff --check`. |

Exit criteria:

- No known implemented-stage branch, algorithm choice, or direct test
  assertion lacks a reason/source breadcrumb.
- Fixture validation enforces row-level provenance and comparison metadata for
  every implemented-stage fixture file, not just analytic invariants.
- Related source and design docs reflect all newly clarified policies and
  references.
- `npm run test:scripts:flat` and `git diff --check` pass.

## CLI Contract

This section is provisional until the stage API and stage test design are
stable. The CLI should be included before shader parity, but it should not drive
the first API shape.

Add the CLI as part of the reference package, not as an afterthought:

```text
scripts/flat/atmosphere/run-reference-probe.js
```

The runner accepts direct flags and JSON configs today. The next CLI extension
should add benchmark scenario files with world/camera/probe/display metadata.
Follow the local script precedents:

- `scripts/flat/atmosphere/run-reference-probe.js` for small
  explicit argument parsing, `--help`, JSON artifact output, Markdown reports,
  linked SVG artifacts, and clear failure behavior.
- `scripts/3d-assets/asset-pipeline/run-asset-pipeline.js` for `--config`
  JSON plus optional selected jobs/probes.

Initial commands:

```text
node scripts/flat/atmosphere/run-reference-probe.js --probe globe.zenith
node scripts/flat/atmosphere/run-reference-probe.js --probe flat.localSunReference --out tmp/flat-local-sun-reference.json
node scripts/flat/atmosphere/run-reference-probe.js --probe globe.zenith --report tmp/globe-zenith.md
node scripts/flat/atmosphere/run-reference-probe.js --config scripts/flat/atmosphere/reference/fixtures/runs/globe-clear-day.json
node scripts/flat/atmosphere/run-reference-probe.js --config tmp/custom-run.json --stage integrateViewOpticalDepth
node scripts/flat/atmosphere/run-reference-probe.js --benchmark scripts/flat/atmosphere/reference/benchmarks/earth-globe-clear-day-basic-sky.json --report tmp/earth-globe-clear-day-basic-sky/report.md --image tmp/earth-globe-clear-day-basic-sky/preview.svg
```

Initial flags:

- `--config <path>`
- `--probe <id>`
- `--out <path>`
- `--report <path>`
- `--image <path>`
- `--stage <id>`
- `--format json|summary`
- `--help`

The CLI should output deterministic JSON containing run metadata, selected
probes, stage, numerical controls, and full reference diagnostics.
Markdown reports should be the first human-facing output format because they
can be viewed directly in the IDE. Images are optional linked artifacts, with
SVG preferred before PNG for first-pass charts and swatches.

Treat JSON config validation as a later schema-framework decision. The first
runner can parse JSON and fail clearly on missing required fields, but should
not grow a hand-written schema system. Once the config shape stabilizes, choose
a standard JSON validation framework and make that schema the CLI/config
contract.

## Phase 0: Scaffold Failing Tests

Status: planned.

Tasks:

- Create `scripts/flat/atmosphere/reference`.
- Create placeholder module files only where needed by tests.
- Create first test files for:
  - spectral grid
  - colorimetry
  - pipeline stage registry
  - direct stage execution
  - geometry contracts
  - optical depth/transmittance
- Confirm tests fail because the implementation is missing, not because the
  test harness is malformed.

Tests to write first:

- Importing the package exposes named public functions.
- `listStages()` exposes every canonical stage id in order.
- `getStage(stageId)` exposes `requires`, `provides`, and `run`.
- `runStage(stageId, packet)` runs only that stage and fails loudly for missing
  prerequisites.
- `runUntil(stageId, request)` returns the same packet as manually composing
  stages through that id.
- Empty or unsorted wavelength grids fail loudly.
- Vacuum fixture returns zero optical depth and unit transmittance.

Exit criteria:

- The folder exists.
- The first failing tests exist.
- The failure messages describe missing behavior clearly.

## Phase 0.5: Analytic Invariant Test Spine

Status: in progress.

Purpose:

- Establish the first trusted validation layer with toy physics fixtures and
  closed-form expected values before importing external data tables or running
  broad sky-color comparisons.

Current fixture artifact:

```text
scripts/flat/atmosphere/reference/stages/_tests/fixtures/analytic-invariants.json
```

Current fixture rows:

- 16 analytic/error-contract expectations are encoded.
- The `integrateViewOpticalDepth` batch now includes vacuum, zero-length,
  homogeneous Beer-Lambert, split-path multiplicativity, empty path explicit
  output, two-sample monotonic accumulation, multi-wavelength independence,
  multi-species summation, negative-extinction rejection, weighted
  piecewise-constant sample integration, coefficient/wavelength shape
  rejection, and invalid sample-weight rejection.
- The fixture schema now supports array-valued numeric expected data and
  structured expected-error data.

Next validation-test loop:

1. Add a test helper that loads the analytic fixture, indexes expectations by
   `id`, and applies each expectation's tolerance in one place.
2. Add a fixture-shape spec that validates required provenance and derivation
   fields before any stage test consumes the data.
3. Add stage validation tests for `integrateViewOpticalDepth` expectations:
   vacuum, zero-length path, homogeneous Beer-Lambert, split-path
   multiplicativity, empty path explicit output, two-sample monotonic
   accumulation, multi-wavelength independence, multi-species summation, and
   negative-extinction rejection, weighted sample integration,
   coefficient/wavelength shape rejection, and invalid sample-weight
   rejection.
4. Confirm those tests fail against placeholder behavior, proving they are
   testing missing physical behavior rather than duplicating fixture shape.
5. Stop there until the validation tests are reviewed. Do not implement
   optical-depth behavior in this validation-test pass.

Current progress:

- Step 1 is complete:
  `scripts/flat/atmosphere/reference/_tests/test-expectations.js` loads the
  analytic fixture, indexes expectations by `id`, and centralizes exact,
  absolute, and relative tolerance checks.
- Step 2 is complete:
  `scripts/flat/atmosphere/reference/_tests/expectation-fixtures.spec.js`
  validates fixture metadata, pinned expectation ids, canonical `reference`
  objects, expected-value derivations, tolerance alignment, and helper
  tolerance behavior.
- Correction: `validateRequest` is the first pipeline stage. Its pending shells
  were replaced with real domain tests first, those tests were observed failing
  against placeholder behavior, and `validateRequest` has now been implemented.
  The focused lane now reports 81 specs and 0 failures after adding decided
  validation-hardening tests and moving display/report consumers out of the
  canonical transport stage registry.
- `validateRequest` hardening is complete for the current scope.
- Step 3 and Step 4 are complete for the `integrateViewOpticalDepth` analytic
  pass: real stage tests consume the analytic fixture from
  `scripts/flat/atmosphere/reference/stages/_tests/IntegrateViewOpticalDepthStage.spec.js`.
- The scoped `integrateViewOpticalDepth` exception is complete:
  `npm run test:scripts:flat` reported 120 specs, 0 failures, and 13 pending
  resolve-ray-path fixture shells after moving stage behavior into helper
  classes. The root `pipeline-stages.spec.js` now stays focused on registry and
  composition checks.
- `integrateViewOpticalDepth` follow-up audit items are queued before or
  alongside the next stage if one more hardening pass is warranted:
  path-end distance validation, explicit downstream packet ownership,
  cumulative versus per-interval species diagnostics, sourced expected
  extremes, and preserving the boundary between camera-view optical depth and
  solar/source transmittance.
- Pending Jasmine shells now exist for that hardening pass. The sourced
  extremes are explicitly paired as positive and negative cases: CIE visible
  grid, ASTM G-173 wavelength grid, clear-air Rayleigh optical depth,
  near-horizon/AM1.5 slant path, flat large lateral boundary, selected-model
  species count, and convergence/sample-count limits. The next step is fixture
  sourcing/encoding before any implementation changes.
- From now on, continue red-to-green loops in canonical pipeline order, and test
  each stage in isolation. The first `resolveRayPath` fixture-backed batch is
  complete, and the recommended `resolveRayPath` hardening batch is also
  complete. The next active loop is `sampleViewPath`.
- The starting `resolveRayPath` test inventory is now listed in
  [Test Design](test_design.md). It has been encoded as expectation JSON data
  in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/ray-path-contracts.json`,
  using the same provenance pattern as
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/analytic-invariants.json`.
  Specs may use small JS adapters to turn those rows into controlled model
  interfaces, but expected distances, boundary reasons, empty-path flags, and
  expected errors belong in data.
- Those `resolveRayPath` fixture rows have now been consumed by direct stage
  tests in
  `scripts/flat/atmosphere/reference/stages/_tests/ResolveRayPathStage.spec.js`,
  observed failing against placeholder behavior, and implemented in
  `scripts/flat/atmosphere/reference/stages/ResolveRayPathStage.js`.
- [Fixture Sources](fixture_sources.md) now marks controlled ray-path segment
  data as ready for `resolveRayPath` unit fixtures and marks
  Earth-radius-dependent ray geometry and atmosphere-top conventions as
  deferred to geometry/model fixture batches.

`validateRequest` hardening checklist:

- Addressed: near-zero ray-direction rejection is tested at the
  `validateRequest` stage level.
- Addressed: observer and ray vector shape cases cover wrong length, `null`,
  `Infinity`, and `NaN`.
- Addressed: known numerical number controls reject string values instead of
  coercing.
- Addressed: numerical sample-count controls reject zero and fractional values;
  `viewSteps`, `sunTransmittanceSteps`, `diffuseSkyHemisphereSamples`, and
  `finiteSunSamples` are positive integer counts.
- Addressed: all canonical request-level physical coefficient shadow fields
  are accepted as extra input fields without changing contracted output fields.
- Addressed: flat model interface coverage no longer relies on `geometryKind`.
- Addressed: single-wavelength grids such as `[550]` are valid.
- Addressed: missing model owner object cases cover `world`, `atmosphere`,
  `solarSource`, and `surface`.
- Addressed: integrator default model bundle, numerical controls, and
  wavelength grids are not mutated.
- Still open as a coverage accounting rule: keep scaffold/placeholder stage
  assertions separate from physical validation coverage.
- Addressed: unknown numerical keys are not rejected, but are dropped from the
  canonical validated numerical controls so later stages only see owned
  controls. Zero distance controls are valid, negative distance controls
  reject, and `minStepKm > maxStepKm` rejects. `integrationMethod` accepted
  names belong to the future integration-method registry/implementation, not to
  a duplicated hardcoded `validateRequest` allow-list. If the registry is the
  single source of truth, `validateRequest` may use it to validate input.
- Addressed: display/reporting consumer controls are tolerated as extra input
  fields without changing contracted output fields. Generic allowed-property
  validation is deferred to a future standard JSON schema layer instead of
  being implemented as hand-written `validateRequest` rules.
- Keep scaffold/placeholder stage assertions separate from physical validation
  coverage.

Expectation acquisition workflow:

1. Create an expectation ledger for the current test batch. This can start as
   comments in the spec, but should move to a fixture README once fixture files
   exist.
2. For each expectation, record:
   - quantity under test
   - source class: hand-derived analytic, authoritative table,
     metadata/checksum, published example, or external-tool fixture
   - source citation or tool/version
   - assumptions and units
   - pinned expected value or fixture path
   - derivation note locator for each expected datum
   - tolerance rule
   - review note explaining why it is independent of the implementation
3. Prefer hand-derived literals for the first analytic spine:
   - `exp(-0.6) = 0.5488116360940264`
   - `1 / (4 * pi) = 0.07957747154594767`
   - `E / pi` examples with simple `E` values
4. Use authoritative tables after the analytic spine:
   - CIE CSV metadata/checksum and sample rows for colorimetry
   - PDAS U.S. Standard Atmosphere rows for atmosphere profiles
5. Use independently generated external-tool fixtures only after tool
   assumptions are pinned:
   - SMARTS/NLR-style clear-sky spectral irradiance configs
   - libRadtran full-run comparison configs, if selected later
6. Check generated fixtures into the repo with their source/version, input
   config, command, output artifact, and provenance.
7. Put a short derivation note next to every expected literal, fixture row,
   generated fixture output, checksum, or sample expectation. In specs this is
   usually a comment; in JSON fixtures it should be part of the data itself.
   Use a canonical `reference` object with `id`, `kind`, `title`, `url` or
   `path`, `locator`, and `derivationSummary`, plus
   `expected.<quantity>.derivation` for exact value arithmetic. The note must
   identify the equation, table, metadata field, tool/config, or provenance
   record well enough for a reviewer to locate it.
8. Do not compute expected values by calling a production helper or a second
   new local implementation.

Tasks:

- Test each pipeline stage in isolation right now. A stage's direct
  `runStage(stageId, packet)` tests are the authority for that stage's physical
  correctness; broad pipeline composition tests remain scaffold/API checks until
  the composed stages have their own known-answer coverage.
- Proceed down the canonical pipeline order. Write and satisfy isolated tests
  for `resolveRayPath`, then `sampleViewPath`, then `evaluateMedium`.
  Downstream tests may exist early as documentation of intended behavior, but
  they do not become the active implementation target while earlier physical
  stages are still placeholders unless the user explicitly scopes an exception.
- For `resolveRayPath`, start by creating direct stage tests from the inventory
  in [Test Design](test_design.md): descriptor/prerequisite behavior, explicit
  atmosphere segment selection, surface clipping, empty path, outside-observer
  entry, inside-volume clipping, behind-observer empty intervals, zero-length
  boundary paths, surface-before-entry occlusion, invalid intersection
  rejection, flat lateral-boundary recording, unbounded horizontal rejection,
  and boundary metadata preservation.
- The corresponding expectation rows now exist as data in
  `scripts/flat/atmosphere/reference/stages/_tests/fixtures/ray-path-contracts.json`:
  `ray-path.atmosphere.inside-exits-top`,
  `ray-path.surface-hit.clips-atmosphere-segment`,
  `ray-path.surface-hit.before-atmosphere-entry-empty`,
  `ray-path.atmosphere.miss-empty-path`,
  `ray-path.atmosphere.outside-entry-to-exit`,
  `ray-path.atmosphere.forward-clips-negative-entry`,
  `ray-path.atmosphere.behind-observer-empty-path`,
  `ray-path.atmosphere.zero-length-boundary-path`,
  `ray-path.atmosphere.inverted-intersection-rejects`,
  `ray-path.atmosphere.nonfinite-intersection-rejects`,
  `ray-path.flat.named-lateral-boundary`,
  `ray-path.flat.unbounded-horizontal-rejects`, and
  `ray-path.boundary-metadata.preserved`.
- `resolveRayPath` hardening follow-up batch is complete. It pins surface hits
  after atmosphere exit, exact entry/exit equality cases, invalid surface-hit
  distances, malformed finite atmosphere interval returns, and the model-call
  transport ray contract.
- Use controlled intersection distances as fixture input data for this first
  pass. Defer ray/sphere or ray/slab intersection expected distances to
  geometry-helper tests. Geometry-derived values such as Earth radius,
  atmosphere-top altitude, ray/sphere intersections, and flat slab
  intersections should not be `resolveRayPath` expectations; this stage only
  consumes model-returned intervals and boundaries.
- Do not add arbitrary "large" finite path values as extremes. A
  `resolveRayPath` extreme must be either a stage-contract boundary
  (zero-length, missing, inverted, finite/non-finite, unbounded) or an explicit
  controlled model-returned finite boundary with provenance.
- Treat negative interval endpoints by domain intent, not by sign alone:
  intervals crossing the observer clip to `0`, intervals entirely behind the
  observer become empty forward paths, and inverted or non-finite intervals
  reject as invalid model returns.
- Add reusable fixture builders for tiny analytic domains:
  - vacuum
  - zero-length path
  - homogeneous medium
  - split path
  - isotropic phase
  - one-sample single scattering
  - black and white Lambertian surfaces
- Fill pending stage shells with input-to-expected-output tests where the
  expected output comes from a named equation or invariant.
- Pin expected outputs as literals or checked fixture rows. Do not generate
  them by calling a second new local implementation. Generated expected
  fixtures are acceptable when they come from an independent external source
  with versioned input, command, output, and provenance recorded.
- Keep `pipeline-stages.spec.js` focused on registry, scaffold, and composition
  checks. When a stage gets real fixture-backed behavior, move its public
  `runStage(stageId, packet)` tests into a focused
  `pipeline-stage-<stage-id>.spec.js` file. Each canonical physical stage
  should also move behind a focused helper class with a shared
  `run(packet) -> packet` method; helper internals can have matching helper
  specs when their algorithms deserve direct tests.
- Add short derivation comments next to expected literals, and structured
  `reference` and `expected.<quantity>.derivation` fields beside fixture rows,
  even when the equation is obvious from the test name. The note does not need
  a full citation, but it must leave a usable breadcrumb.
- Confirm each new test fails against placeholder or missing behavior before
  implementing the stage behavior it exercises.

Tests to write first:

- `sampleViewPath`: midpoint weights sum to path length.
- `evaluateMedium`: vacuum coefficients are zero; homogeneous coefficients are
  constant at every sample.
- `integrateViewOpticalDepth`: vacuum and zero-length paths give `tau = 0`,
  `T = 1`.
- `integrateViewOpticalDepth`: homogeneous Beer-Lambert gives
  `tau = sigma_t * distance` and `T = exp(-tau)`.
- `integrateViewOpticalDepth`: split-path transmittance is multiplicative.
- `integrateViewOpticalDepth`: output arrays are aligned to view samples and
  wavelengths.
- `integrateViewOpticalDepth`: multi-wavelength extinction remains independent
  per wavelength.
- `integrateViewOpticalDepth`: separate species optical depths sum into total
  optical depth.
- `integrateViewOpticalDepth`: negative extinction rejects loudly instead of
  being clamped.
- `evaluateScatteringPhase`: isotropic phase value is `1 / (4 * pi)` and the
  angle convention is explicit.
- `integrateSingleScattering`: one sample contributes
  `T_view * beta_sca * phase * source * T_source * ds`.
- `resolveSurfaceRadiance`: black Lambertian surface returns zero; white
  Lambertian normal-incidence surface returns `E / pi` before view attenuation.

First expectation ledger entries:

| Test area | Source class | Source | Pinned expectation |
| --- | --- | --- | --- |
| Vacuum transmittance | hand-derived analytic | PBRT transmittance invariant | `tau = 0`, `T = 1` |
| Zero-length transmittance | hand-derived analytic | PBRT optical-depth path integral | for nonzero extinction and `d = 0 km`: `tau = 0`, `T = 1` |
| Homogeneous transmittance | hand-derived analytic | PBRT Beer-Lambert equation | for `sigma_t = 0.2 / km`, `d = 3 km`: `tau = 0.6`, `T = 0.5488116360940264` |
| Split-path transmittance | hand-derived analytic | PBRT multiplicativity invariant | for `tau_ab = 0.2`, `tau_bc = 0.4`: `T_ac = 0.5488116360940264` |
| Isotropic phase | hand-derived analytic | PBRT phase function definition | `1 / (4 * pi) = 0.07957747154594767` |
| One-sample scattering | hand-derived analytic | PBRT volume-scattering in-scattering, specialized by code design | choose factors that multiply to a simple literal, such as `0.5 * 0.2 * 0.25 * 4 * 0.8 * 2 = 0.16` |
| Black Lambertian | hand-derived analytic | PBRT diffuse reflection, specialized by code design | `albedo = 0` -> `L = 0` |
| White Lambertian | hand-derived analytic | PBRT diffuse reflection, specialized by code design | `albedo = 1`, `E = pi`, `cosTheta = 1` -> `L = 1` |

Next fixture rows to add:

| Fixture id | Stage | Source class | Source | Purpose | Expected data to pin |
| --- | --- | --- | --- | --- | --- |
| `view-transmittance.empty-path.explicit-output` | `integrateViewOpticalDepth` | hand-derived analytic/API schema | PBRT transmittance path integral plus code design packet schema | Prove an empty transport path returns explicit zero/unit transport data rather than placeholder or undefined output. | `tau = 0`, `T = 1`, empty sample-aligned arrays, end totals present |
| `view-transmittance.homogeneous.two-sample-monotonic` | `integrateViewOpticalDepth` | hand-derived analytic | PBRT optical-depth integral and `T = exp(-tau)` | Prove cumulative optical depth increases and transmittance decreases along ordered nonnegative-extinction samples. | Per-sample `tau` and `T` values for two simple equal-length samples |
| `view-transmittance.homogeneous.multi-wavelength` | `integrateViewOpticalDepth` | hand-derived analytic | PBRT wavelength-varying medium properties and Beer-Lambert transmittance | Prove separate wavelengths keep separate extinction, optical-depth, and transmittance values. | For example `sigma_t = [0.1, 0.2] / km`, `d = 3 km`: `tau = [0.3, 0.6]`, `T = [exp(-0.3), exp(-0.6)]` |
| `view-transmittance.homogeneous.multi-species-sum` | `integrateViewOpticalDepth` | hand-derived analytic | PBRT extinction/attenuation definition plus local species diagnostics schema | Prove species optical depths add into total optical depth while remaining separately diagnosable. | For example Rayleigh `0.1 / km` plus Mie `0.2 / km` over `3 km`: species `tau = [0.3, 0.6]`, total `tau = 0.9`, `T = exp(-0.9)` |
| `view-transmittance.negative-extinction-rejects` | `integrateViewOpticalDepth` | invariant/error contract | PBRT nonnegative absorption/scattering coefficients plus reference test-design hard invariant | Prove invalid negative extinction fails loudly instead of being clamped into plausible output. | Named error expectation for the negative species/sample/wavelength |
| `view-transmittance.weighted-samples.piecewise-constant` | `integrateViewOpticalDepth` | hand-derived analytic | PBRT optical-depth path integral plus local sample-weight packet contract | Prove the stage integrates `sigma_t * ds` over supplied sample weights instead of using sample count or total distance guesses. | For sample weights `[0.25, 0.75, 2] km` and sample extinction `[[0.4], [0.2], [0.1]] / km`: `tau = [0.45]`, `T = [exp(-0.45)]` |
| `view-transmittance.coefficient-wavelength-shape-rejects` | `integrateViewOpticalDepth` | local API/schema contract | Reference code design spectral-array contract | Prove extinction arrays align exactly to `wavelengthsNm` and are not broadcast, truncated, or padded. | Named error expectation when one coefficient is supplied for two wavelengths |
| `view-transmittance.invalid-sample-weight-rejects` | `integrateViewOpticalDepth` | invariant/error contract | PBRT optical-depth path integral plus local independently-runnable stage contract | Prove directly supplied stage packets cannot integrate negative or non-finite path weights. | Named error expectation for negative sample weight |

Reference-derived expected-input extremes to track after the first fixture pass:

Do not create these as arbitrary stress limits. Each row should be created only
after the source-backed boundary or table row has been pinned in the fixture
ledger.

| Fixture id | Stage | Source class | Reference-derived extreme | Source | Expected data to extract or pin |
| --- | --- | --- | --- | --- | --- |
| `view-transmittance.visible-grid.cie-full-range` | `integrateViewOpticalDepth` | authoritative table/API schema | Full CIE 1931 2-degree visible color-matching grid: `360-830 nm`, `1 nm` steps. | CIE 1931 2-degree observer dataset metadata, DOI `10.25039/CIE.DS.xvudnb9b`; code design spectral-grid contract. | Grid length, first/last wavelength, selected checked wavelength outputs, and proof values remain wavelength-aligned. |
| `view-transmittance.solar-grid.astm-g173-range` | `integrateViewOpticalDepth` | authoritative table/API schema | Full ASTM G-173 spectral wavelength table used for solar reference spectra: `2002` data rows from `280 nm` to `4000 nm`, with nonuniform spacing. | NREL/NLR ASTM G-173 data files and table description; inspected `ASTMG173.csv` downloaded from the NLR compressed data file. | Pin first/last/count, spacing bands (`0.5 nm` through `400 nm`, `1 nm` through `1700 nm`, transition rows `1702/1705/1710 nm`, then `5 nm` through `4000 nm`), selected checked wavelength outputs, and no scalar collapse across the grid. |
| `view-transmittance.standard-atmosphere.vertical-86km` | `integrateViewOpticalDepth` | authoritative table plus analytic integration policy | Lower U.S. Standard Atmosphere table extent through `86 km`. | PDAS U.S. Standard Atmosphere Table 1, `0-86 km` in SI units; later primary-source audit against U.S. Standard Atmosphere 1976. | Vertical path length/domain endpoint, table checkpoint rows, and selected optical-depth/transmittance outputs once the clear-air coefficient model is pinned. |
| `view-transmittance.standard-atmosphere.extended-1000km` | `integrateViewOpticalDepth` | authoritative table/domain boundary | Extended U.S. Standard Atmosphere big-table domain through `1000 km`. | PDAS big tables based on U.S. Standard Atmosphere 1976 Part 4; primary-source audit before package-facing use. | Decide whether the CPU reference supports this extended domain; if yes, pin endpoint behavior and expected near-vacuum contribution above the lower atmosphere. |
| `view-transmittance.am15.slant-reference` | `integrateViewOpticalDepth` | authoritative reference condition | ASTM G-173 reference air mass `1.5` and solar zenith `48.19 deg`. | NREL/NLR ASTM G-173 specified atmospheric conditions. | Slant-path factor/geometry fixture derived from the specified zenith, with optical-depth expectations only after the atmosphere coefficient/profile model is pinned. |
| `view-transmittance.near-horizon.airmass-reference` | `integrateViewOpticalDepth` | primary published table | Near-horizon large-air-mass boundary from Kasten and Young's ISO Standard Atmosphere optical-air-mass table. | Kasten and Young, Applied Optics 28, 4735-4738 (1989), DOI `10.1364/AO.28.004735`. | Table II gives elevation `0.0 deg` relative optical air mass `38.0868` and absolute optical air mass `394428 kg/m2`; useful secondary rows include `1.0 deg -> 26.2595`, `5.0 deg -> 10.3164`, and `10.0 deg -> 5.5841`. |
| `view-transmittance.clear-air.optically-thin-red` | `integrateViewOpticalDepth` | primary published table | Low molecular/Rayleigh optical depth at longer wavelengths in a standard atmosphere. | Bucholtz, Applied Optics 34, 2765-2773 (1995), DOI `10.1364/AO.34.002765`, Table 4. | For the `1962 U.S. Standard` atmosphere, Table 4 explicitly gives Rayleigh optical depth `tau = 8.645e-3` at `1.00 um`. Use this as a long-wavelength thin-transport fixture; visible-red rows need PDF/table extraction before pinning because the HTML table compresses repeated exponents. |
| `view-transmittance.clear-air.optically-thick-blue-or-low-sun` | `integrateViewOpticalDepth` | primary published table plus primary air-mass table | High optical depth from short wavelengths and/or low elevation. | Bucholtz Table 4 for Rayleigh optical depth; Kasten and Young Table II for near-horizon air mass. | Bucholtz gives `1962 U.S. Standard` Rayleigh `tau = 7.788` at `0.20 um`; Kasten and Young gives horizon relative air mass `38.0868`. Visible-blue/low-Sun fixtures should multiply a pinned visible vertical `tau` by a pinned air-mass row only after the selected path approximation is declared. |
| `view-transmittance.flat-large-lateral-boundary` | `resolveRayPath` / `integrateViewOpticalDepth` | local geometry hypothesis plus analytic transmittance | Large flat Earth / slab atmosphere with a named lateral boundary such as disk edge, finite local patch, dome/cylinder wall, or explicit hypothesis radius. | [Code Design](code_design.md) flat lateral-boundary contract plus PBRT transmittance. Any numeric lateral extent must be a declared model parameter with provenance, not an integration cap. | Pin boundary reason, lateral distance, `tau = sigma_t * lateralDistance` for a homogeneous fixture, and `T = exp(-tau)`. Add an invalid unbounded-horizontal case that fails before integration. |
| `view-transmittance.max-species-from-selected-clear-air-model` | `integrateViewOpticalDepth` | selected model schema | Species count required by the selected first clear-air model. | Pending model decision: Rayleigh, aerosol/Mie, ozone/absorbers, clouds deferred. | Pin species names and count from the selected model, then pin species and total optical-depth expectations. |
| `view-transmittance.max-sample-count-from-convergence-study` | `integrateViewOpticalDepth` | numerical convergence evidence | Sample count high enough for the selected reference profile to converge within tolerance. | Later convergence study against analytic exponential slab and/or external-tool fixture; not a physical constant. | Pin convergence table, chosen sample count, error tolerance, and selected sample/end outputs. |

Reference checklist for the next fixture rows:

- `view-transmittance.empty-path.explicit-output`
  - PBRT v4, Volume Scattering / Transmittance:
    https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance
    Supports optical depth as a path integral and `T = exp(-tau)`.
  - [Code Design](code_design.md), Pipeline Data Packet / diagnostics shape:
    supports explicit packet fields and sample-aligned arrays.
- `view-transmittance.homogeneous.two-sample-monotonic`
  - PBRT v4, Volume Scattering / Transmittance:
    supports nonnegative optical-depth accumulation and exponential
    transmittance from cumulative `tau`.
  - [Test Design](test_design.md), Hard Invariants:
    records monotonic optical-depth and transmittance expectations.
- `view-transmittance.homogeneous.multi-wavelength`
  - PBRT v4, Volume Scattering / Transmittance:
    supports Beer-Lambert transmittance per wavelength once extinction is
    wavelength-indexed.
  - PBRT v4, Volume Scattering / Volume Scattering Processes:
    https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes
    supports that absorption and scattering properties may vary by wavelength.
  - [Code Design](code_design.md), Inputs / Units:
    supports `wavelengthsNm` as the canonical spectral grid.
- `view-transmittance.homogeneous.multi-species-sum`
  - PBRT v4, Volume Scattering / Volume Scattering Processes:
    supports extinction/attenuation as the combined effect of absorption and
    out-scattering coefficients.
  - PBRT v4, Volume Scattering / Transmittance:
    supports integrating total extinction into optical depth and
    transmittance.
  - [Code Design](code_design.md), diagnostics/species packet shape:
    supports keeping species contributions separately diagnosable while also
    producing totals.
- `view-transmittance.negative-extinction-rejects`
  - PBRT v4, Volume Scattering / Volume Scattering Processes:
    supports absorption and scattering coefficients as nonnegative rates per
    unit distance.
  - [Test Design](test_design.md), Hard Invariants and
    `integrateViewOpticalDepth` matrix:
    supports loud failure instead of clamping invalid negative extinction.
- `view-transmittance.weighted-samples.piecewise-constant`
  - PBRT v4, Volume Scattering / Transmittance:
    supports optical depth as a distance integral of extinction.
  - [Code Design](code_design.md), Pipeline Data Packet:
    supports `sampleViewPath` owning interval weights and
    `integrateViewOpticalDepth` consuming those weights.
- `view-transmittance.coefficient-wavelength-shape-rejects`
  - [Code Design](code_design.md), Inputs and Units:
    supports `wavelengthsNm` as the canonical spectral array order.
  - [Test Design](test_design.md), Domain-First Expectations:
    supports rejecting ambiguous model data instead of adapting to helper
    convenience.
- `view-transmittance.invalid-sample-weight-rejects`
  - PBRT v4, Volume Scattering / Transmittance:
    supports `ds` as a path-distance element in the optical-depth integral.
  - [Code Design](code_design.md), direct `runStage` contract:
    supports stages validating crafted packets enough to fail loudly when a
    prerequisite has invalid physical meaning.
- `view-transmittance.flat-large-lateral-boundary`
  - [Code Design](code_design.md), Model Interface and Error Handling:
    supports requiring a finite named lateral boundary for flat horizontal or
    near-horizontal paths.
  - PBRT v4, Volume Scattering / Transmittance:
    supports `tau = integral sigma_t ds` and homogeneous
    `tau = sigma_t * distance`, so a large flat lateral path becomes a large
    optical-depth fixture without introducing a magic attenuation value.

Each expected literal or fixture row from this batch must carry a nearby
derivation note when it enters a spec or fixture. Use the source column plus
the local arithmetic as the comment or data-field seed; for example,
"PBRT homogeneous Beer-Lambert: tau = 0.2 * 3 = 0.6, T = exp(-0.6)."

Known answers:

- Vacuum or zero-length transport: `tau = 0`, `T = 1`.
- Homogeneous transport: `tau = sigma_t * d`, `T = exp(-tau)`.
- Split transport: `T(a,c) = T(a,b) * T(b,c)`.
- Isotropic phase: `1 / (4 * pi) ~= 0.0795774715`.
- Single sample scattering: product of known scalar factors per wavelength.
- Lambertian reflection: `L = albedo * E * cosTheta / pi`.

Exit criteria:

- The analytic invariant tests define the domain spine for transport, phase,
  single scattering, and Lambertian surface behavior.
- Every expected datum added to a spec or fixture has a nearby derivation note
  with enough source or arithmetic detail to locate the expectation.
- No expected value is computed by calling the production helper under test or
  another new local implementation that has not itself been externally
  validated.
- Any generated expected fixture comes from an independent external source and
  records source version, input config, generation command, and provenance.
- External tables such as CIE, PDAS, ASTM G-173, SMARTS, and libRadtran remain
  deferred until the analytic spine is passing.

## Phase 1: Spectral Grid And Colorimetry

Status: planned.

Tasks:

- Implement wavelength-grid validation.
- Implement simple spectral interpolation.
- Implement spectral integration over the selected grid.
- Implement CIE XYZ integration with a tiny test fixture first.
- Implement XYZ to linear sRGB conversion.

Tests:

- Wavelength grid must be sorted, finite, positive, and non-empty.
- Interpolation returns exact values at known sample points.
- Zero spectrum integrates to zero XYZ and zero RGB.
- Constant equal-energy fixture produces finite positive XYZ.
- RGB conversion does not clamp by default.

Known answers:

- `integrate(0) = 0`.
- `XYZ(0 spectrum) = (0, 0, 0)`.

Exit criteria:

- Spectral arrays can be validated and integrated.
- Color conversion exists but does not own tone mapping.

## Phase 2: Radiometry And Phase Functions

Status: planned.

Tasks:

- Implement Beer-Lambert transmittance helper.
- Implement Rayleigh phase function.
- Implement Henyey-Greenstein Mie phase function.
- Implement basic vector helpers locally or reuse existing framework-free math
  only if it does not create runtime coupling.

Tests:

- Vacuum transmittance is `1`.
- Homogeneous transmittance is `exp(-beta * distance)`.
- Transmittance remains in `[0, 1]`.
- Rayleigh phase is symmetric.
- Rayleigh phase numerically integrates to `1` over solid angle.
- Positive-`g` Mie is forward scattering: `P(1) > P(0) > P(-1)`.
- Mie phase numerically integrates to `1` within tolerance.

Exit criteria:

- Local scattering math is test-covered before geometry enters the picture.

## Phase 3: Geometry Fixtures

Status: planned.

Tasks:

- Implement spherical world fixture.
- Implement spherical atmosphere intersection.
- Implement flat world fixture.
- Implement flat slab atmosphere intersection.
- Implement named finite-boundary behavior for flat horizontal paths.

Tests:

- Spherical altitude at radius is zero.
- Spherical upward ray exits at `topAltitudeKm`.
- Globe horizon cosine matches
  `-sqrt(1 - (R_earth / r)^2)`.
- Rays just above and below globe horizon classify differently.
- Flat vertical ray exits slab at `topAltitudeKm`.
- Flat slanted ray exits at `topAltitudeKm / cosZenith`.
- Flat horizontal ray fails unless a named finite boundary is configured.
- Flat horizontal or near-horizontal ray with a configured large lateral
  boundary reports boundary reason and lateral path length explicitly.

Exit criteria:

- The same ray/intersection vocabulary works for globe and flat fixtures.

## Phase 4: Density, Optical Depth, And Transmittance

Status: planned.

Tasks:

- Implement normalized exponential density profiles.
- Implement homogeneous-medium optical depth.
- Implement ray-marched optical depth through model atmosphere.
- Return per-wavelength and per-species optical-depth diagnostics.

Tests:

- Density at zero altitude is `1`.
- Density at one scale height is `exp(-1)`.
- Density above top atmosphere is zero.
- Homogeneous optical depth equals `beta * distance`.
- Split-ray transmittance is multiplicative.
- Exponential slab vertical optical depth matches
  `beta0 * H * (1 - exp(-H_top / H))`.
- Blue Rayleigh optical depth is greater than green; green is greater than red.

Exit criteria:

- Transmittance diagnostics are trusted for both globe and flat fixtures.

## Phase 5: Solar Sources

Status: planned.

Tasks:

- Implement distant directional Sun fixture.
- Implement local finite Sun solid-angle helper.
- Implement local finite Sun calibration helper for reference observer.
- Keep real solar spectrum data optional until source licensing/attribution is
  settled; use small deterministic spectral fixtures first.

Tests:

- Distant Sun source returns one directional source sample.
- Local Sun solid angle matches
  `2*pi*(1 - sqrt(d^2 - R^2)/d)`.
- Small-disk local Sun solid angle approaches `pi*(R/d)^2`.
- Local Sun calibration matches target direct normal irradiance at the
  reference observer in vacuum.
- Moving twice as far from a small local Sun reduces irradiance by about `4x`
  in vacuum with equal incidence.

Exit criteria:

- Distant Sun and local Sun can feed the same integrator source-sample path.

## Phase 6: Single-Scattering Integrator

Status: planned.

Tasks:

- Implement the per-ray reference integrator with fixed midpoint stepping.
- Accumulate Rayleigh and Mie in-scattering separately.
- Compute sample-to-source transmittance.
- Return diagnostic geometry and scattering-angle arrays.

Tests:

- Zero source produces zero in-scattering.
- Zero scattering produces zero in-scattering.
- Vacuum produces no in-scattering and unit transmittance.
- Increasing source strength scales in-scattering linearly in a simple fixture.
- Increasing scattering coefficient increases in-scattering in optically thin
  fixtures.
- Rayleigh-only side-sky fixture produces more blue than red after spectral
  conversion.

Exit criteria:

- One globe sky ray and one flat sky ray produce explainable spectral
  diagnostics.

## Phase 7: Surface Radiance

Status: planned.

Tasks:

- Implement Lambertian surface model.
- Compute direct source irradiance at a surface hit.
- Keep diffuse sky irradiance disabled or fixture-only until hemisphere
  integration is implemented.

Tests:

- Black albedo reflects zero radiance.
- Lambertian response scales with `cosTheta`.
- Sun below local horizon contributes no direct irradiance.
- In vacuum with identical local normal and source direction, globe and flat
  surfaces produce the same direct Lambertian radiance.

Exit criteria:

- One globe surface ray and one flat surface ray produce explainable spectral
  diagnostics.

## Phase 8: Diffuse Sky Irradiance

Status: planned.

Tasks:

- Implement deterministic hemisphere sampling.
- Integrate sky radiance over the hemisphere.
- Add diffuse component diagnostics.

Tests:

- Uniform sky radiance integrates to `pi * L`.
- Zero sky radiance gives zero diffuse irradiance.
- Diffuse irradiance is non-negative.

Exit criteria:

- The reference has a physical replacement for fixed-fraction diffuse sky.

## Phase 9: CLI Probe Runner

Status: in progress.

Current implemented slice:

- Added `scripts/flat/atmosphere/run-reference-probe.js`.
- Supports the initial documented flags:
  `--config`, `--probe`, `--out`, `--report`, `--image`, `--stage`,
  `--format json|summary`, and `--help`.
- Runs built-in controlled smoke probes through
  `CpuSpectralReferenceIntegrator` using the canonical stage sequence.
- Emits deterministic JSON with `generatedAt: null` and an explicit
  deterministic-output policy.
- Emits a Markdown report plus optional SVG visual artifact. The current SVG
  and swatches use a debug visual mapping from nearest `650/550/450 nm`
  samples to `R/G/B`; this is report evidence for transport shape, not final
  colorimetry.
- Generated first local artifacts at
  `tmp/flat-reference-visual-evidence/result.json`,
  `tmp/flat-reference-visual-evidence/report.md`, and
  `tmp/flat-reference-visual-evidence/visual.svg`.
- Added `--sky-patches` preview mode with basic camera rays, a simple
  sky-volume/source adapter, and no celestial object rendering. The first
  built-in panels are `midday.zenith`, `midnight.zenith`, and
  `sunset.horizon`.
- Current default sky-patch experiments use `midday.zenith`,
  `midday.horizon`, and `sunset.horizon`. `midnight.zenith` remains a named
  explicit control, but routine experiments should leave it out until
  nighttime light sources or celestial objects are added.
- Updated sky-patch mode to use shared Earth-like preview inputs rather than
  scene-colored shortcuts: spherical radius `6371.0088 km`, `100 km`
  atmosphere shell, `8 km` Rayleigh scale height, top-of-atmosphere solar
  spectral samples, Rayleigh phase, and Henyey-Greenstein aerosol phase with
  `g = 0.8`.
- Upgraded sky-patch display and absorber inputs: the preview now traces a
  `380-780 nm` / `20 nm` visible grid, displays through an analytic CIE 1931
  XYZ approximation to sRGB, shapes the solar spectrum from a `5778 K`
  blackbody normalized at `550 nm`, and includes an approximate `300 DU`
  Chappuis-band ozone absorption species. This is preview evidence, not yet the
  final package colorimetry module or an official-table CIE fixture.
- Generated sky-patch artifacts at
  `tmp/flat-reference-sky-patches/result.json`,
  `tmp/flat-reference-sky-patches/report.md`, and
  `tmp/flat-reference-sky-patches/sky-patches.svg`.
- Verification: `npm run test:scripts:flat` passed with 264 specs and
  0 failures after adding the runner, focused helper specs, and lightweight
  Rayleigh/Henyey-Greenstein phase-function checks.

Remaining before this phase is complete:

- Add real package-level globe and flat/local-Sun model adapters or fixtures
  instead of relying only on controlled smoke probes.
- Replace the runner-local analytic CIE display approximation with the
  package-level colorimetry module backed by the official CIE table before
  treating swatches as final display color.
- Replace the runner-local approximate ozone lobes with selected ozone
  absorption data before using ozone as a test oracle.
- Add stronger config-run acceptance once the run-definition shape stabilizes.
- Decide whether named probe fixtures live as JSON run definitions, JS model
  fixtures, or a small adapter package inside the reference folder.

Tasks:

- Add a script entry point for named probes.
- Add JSON config loading for custom runs.
- Add direct CLI parameter overrides for common probe runs.
- Output JSON diagnostics for:
  - globe zenith sky
  - globe horizon sky
  - globe surface hit
  - flat zenith sky
  - flat horizon/slab boundary ray
  - flat local-Sun reference observer
- Keep display/tone mapping out of this runner unless explicitly requested.

Tests:

- Probe runner emits deterministic JSON.
- Probe runner fails loudly for unknown probe names.
- Probe runner fails loudly for unknown CLI options.
- Probe runner can load a JSON run config.
- Probe runner can run a named probe without a config file.
- Probe runner can stop at a named stage such as `integrateViewOpticalDepth`.
- Probe runner can write a Markdown report that links to JSON output.
- Diagnostics include wavelengths, spectral radiance, XYZ, RGB, optical depth,
  transmittance, and geometry metadata.

Exit criteria:

- We can generate trusted reference outputs without opening the browser.

## Phase 10: Documentation And Promotion Check

Status: planned.

Tasks:

- Document the implemented fixture values.
- Document any external data source and attribution.
- Record tolerances used by tests.
- Add the deferred physical-effects ledger to the design docs, including
  refraction and any other omitted effect that could materially affect
  appearance, optical depth, source visibility, path length, or diagnostics.
- Confirm the public API is precise enough for a future SemVer package.
- Confirm runtime code has no React, Three.js, DOM, browser-renderer, route, or
  repo-relative-path dependency.
- Confirm package data/provenance is clear enough to publish or intentionally
  keep fixtures as opt-in external inputs.
- Audit secondary-source references before any publishable extraction. Where a
  test, fixture, constant, or package-facing claim depends on a secondary
  source, either chase down and record the primary source or explicitly mark
  the secondary source as an accepted limitation.
- Confirm the CLI exercises the same public API as library callers.
- Review internal math helpers and decide which should remain local, which
  should be wrapped around validated external libraries, and which should stay
  as test-only reference code.
- For any proposed external dependency, record the library, purpose,
  validation basis, license, version policy, wrapper boundary, and replacement
  test results in [Reference Decision Log](references.md).
- Produce a promotion note comparing the package against the external
  precedents recorded in [Reference Decision Log](references.md).
- Decide whether any pure helper deserves promotion into `src/flat/shared`.

Exit criteria:

- The reference package is stable enough to support later shader parity design.
- A future extraction path is documented, including public API, fixtures,
  provenance, validation command, and known non-goals.
- Secondary references that support package-facing physics claims have a
  documented primary-source audit outcome.
- No code is promoted into app runtime merely for convenience.

## Completion Criteria

- `scripts/flat/atmosphere/reference` exists and is test-covered.
- The same integrator handles globe and flat/local-Sun fixtures.
- The reference returns spectral radiance, XYZ, linear RGB, and diagnostics.
- Known-answer tests pass for spectral math, geometry, transmittance, phase
  functions, solar source behavior, single scattering, and surface radiance.
- CLI probes produce deterministic JSON outputs.
- Documentation captures the external justification behind constants,
  fixtures, invariants, and package-shape decisions.
- The shader-specific design remains deferred until these reference outputs are
  trusted.
