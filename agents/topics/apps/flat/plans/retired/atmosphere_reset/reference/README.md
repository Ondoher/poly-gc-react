# Atmosphere Reference

This folder contains the focused design notes for the CPU spectral atmosphere
reference integrator.

The reference integrator is the slow, explicit truth engine for the atmosphere
reset. Its job is to answer:

```text
Given a world model, atmosphere model, solar source, observer, and camera ray,
what spectral radiance reaches the camera?
```

It is not the production shader, not a browser renderer, and not a tuning
surface for screenshots. It exists so the project can plug in documented
physical properties, run known-answer tests, inspect diagnostics, and later
compare shader approximations against a trusted result.

Treat the reference as a potential future standalone package. While it remains
inside this repo, the core should stay framework-free, plain-data based,
externally justified, and testable without a browser so later extraction is a
promotion step rather than a rewrite.

## Contents

- [Stage Contracts](stage_contracts.md): canonical input/output packet
  contracts for every reference pipeline stage. Code, tests, fixtures, reports,
  and shader-parity notes should target these contracts.
- [Code Design](code_design.md): API shape, pipeline stages, packet flow,
  model interfaces, implementation rationale, units, and error handling.
- [Test Design](test_design.md): high-level test matrix for each canonical
  stage, including parameter combinations and expected results.
- [Test Plan](test_plan.md): actionable test sequence, current stage batch,
  hardening follow-ups, and verification loop.
- [Reference Decision Log](references.md): references consulted, decisions
  they informed, assumptions, limits, and open reference needs.
- [Fixture Sources](fixture_sources.md): fixture-readiness inventory showing
  what source data is ready, partially ready, or deficient.
- [Plan](plan.md): implementation checklist for
  `scripts/flat/atmosphere_rejected/reference`.
- [Status](status.md): current decisions and next documentation step.
- `scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/analytic-invariants.json`:
  first JSON expectation ledger for the analytic invariant spine.

## Current Direction

The immediate design focus is the stage API:

- every canonical stage is independently runnable through
  `CpuSpectralReferenceIntegrator.runStage`
- every stage descriptor declares `id`, `requires`, and `provides`, mirroring
  the top-level requirements in [Stage Contracts](stage_contracts.md)
- runtime stage behavior lives in `CpuSpectralReferenceIntegrator`, while
  `pipeline-stages.js` stays declarative metadata
- [Stage Contracts](stage_contracts.md) is the single source of truth for
  nested packet shapes and stage handoff ownership
- `traceRay` composes the same public stages used by tests
- phase evaluation is separate from single-scattering accumulation
- constants, fixtures, and package-shape decisions are justified in the
  reference decision log
- CLI and shader design are deferred until the stage API and tests are stable

The current script scaffold lives at `scripts/flat/atmosphere_rejected/reference`.
Run its focused Jasmine lane with:

```text
npm run test:scripts:flat
```

The broader project context lives one level up:

- [Research](../research.md): physical model, equations, simplifications, and
  external references.
- [Design](../design.md): project-level reset design and shader boundary.
- [Plan](../plan.md): broader atmosphere reset checklist.
