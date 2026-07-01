# Reference Private Method Implementation Plan

This plan records the accepted next steps for implementing the private helper
methods behind `Reference.evaluate(...)`. The goal is to keep `evaluate(...)`
easy to read while each helper owns one clear transport concern.

## Implementation Order

Implement private helpers from least-dependent leaves upward. Unit tests for
the top-level `evaluate(...)` method should wait until the helpers it composes
have real behavior; before then, tests should focus only on completed leaf
helpers or accepted type/contract guardrails.

1. Implement scalar, array, and packet leaf helpers first.
   - `_createTransportState(...)` should create zero radiance and unit
     transmittance arrays for the active channel count.
   - `_createEvaluationResult(...)` should return the final spectral radiance
     and transmittance packets without display conversion.
   - Any small private array helpers introduced while implementing the physics
     should be pure and should prefer existing generic utilities when they fit.

2. Implement transmittance and state-transition leaves.
   - Done: `_computeSegmentTransmittance(...)` computes attenuation across the
     current view-path segment.
   - Done: `_integratePathSample(...)` is a pure state transition that returns
     a new transport state whose radiance includes direct plus incident
     in-scattering and whose transmittance has been attenuated by the current
     segment.
   - Done: fixture-backed specs cover vacuum segment transmittance,
     multi-wavelength Beer-Lambert segment transmittance, and split-path
     transmittance multiplication.
   - Keep Beer-Lambert and optical-depth comments cited against the production
     reference registry.

3. Implement direct and incident scattering leaves.
   - Done: `_computeDirectInScattering(...)` combines medium scattering facts,
     phase facts, direct radiance, source transmittance, view transmittance,
     and integration weight.
   - Done: `_computeIncidentInScattering(...)` combines medium scattering
     facts, sampled incident radiance, view transmittance, and integration
     weight.
   - Done: fixture-backed specs cover both helpers. Direct in-scattering uses
     the promoted
     `in-scattering.one-sample.scalar-product` row. Incident in-scattering
     uses `in-scattering.incident-radiance.one-sample-product`, which records
     that `IncidentRadianceSample` is already sampled/collapsed by the
     light-source model boundary, so this helper applies scattering, view
     transmittance, and integration weight rather than phase/direction
     integration.

4. Implement request-shaping helpers.
   - `_createRayDistanceRequest(...)` should copy the ray facts needed by
     `GeometryModel.resolveRayDistance(...)` without adding geometry policy.
   - Keep this helper free of model calls so geometry remains the owner of ray
     distance policy.

5. Implement `_createPathSamples(...)`.
   - Canonicalize the resolved distance to hot-path scalar values before the
     loop.
   - Keep each sample packet small: position, direction facts needed by model
     calls, and integration weight.
   - The latest accepted local-second-order lineage still uses endpoint
     samples with trapezoid weights in the CPU/shader transport path. The
     rejected cleanroom reference stage used fixed composite midpoint samples,
     but that appears to be a staging/fixture branch rather than the newest
     accepted shader parity path.
   - Do not promote either sampling rule until the production execution
     contract chooses between the accepted local-second-order transport
     lineage and the rejected cleanroom midpoint staging lineage. The selected
     rule needs a production citation or accepted local fixture/provenance note.
   - Production still needs an accepted name and owner for the execution
     sample-count control before `_createPathSamples(...)` can be finished.

6. Implement model-owned sampling helpers.
   - `_sampleMedium(...)` delegates atmosphere facts to `this.model.atmosphere`
     after geometry has supplied the altitude for the path sample. The POC
     derives altitude from geometry/world shape, and the rejected cleanroom
     implementation makes `world.altitudeAt(...)` the only geometric altitude
     source. Production therefore needs a geometry-owned altitude resolver or
     altitude-bearing path sample before this helper can be implemented.
   - `_sampleRadiance(...)` delegates direct light-source facts to
     `this.model.lightSource`.
   - `_sampleIncidentRadiance(...)` delegates higher-order incident radiance to
     `this.model.lightSource.sampleIncidentRadiance(...)`; the reference
     executor must not own a separate incident-radiance cache dependency. Any
     cache used to answer the request belongs to the concrete light-source
     implementation behind that public boundary.
   - `_samplePhase(...)` delegates phase-function facts to the atmosphere or
     the owner selected by the accepted public interface.

7. Implement source-path transmittance after sampling contracts exist.
   - `_computeSourceTransmittance(...)` computes attenuation from the current
     path sample toward the light source.
   - The POC computes this inside CPU transport by clipping the
     sample-to-source segment against flat or spherical geometry and then
     integrating optical depth along that segment.
   - The source-contract POC has each light-source sample return a
     `transmittancePath` descriptor. For a finite local source that descriptor
     carries direction and finite distance; for a distant source it carries the
     direction and top-atmosphere path kind. This supports hiding the
     light-source-specific source-path shape behind `LightSourceModel`.
   - The latest local-second-order shader then applies flat-geometry clipping
     and trapezoid optical-depth integration over that source path. This means
     light source owns the source-path descriptor, geometry owns clipping and
     boundary policy, atmosphere owns extinction, and the transport executor
     owns the selected quadrature/integration rule.
   - This helper remains blocked until the accepted source-path packet shape
     says how `RadianceSample` exposes its source-path descriptor and how
     geometry is asked to clip/resolve that descriptor without receiving the
     light-source implementation object.

8. Wire and test `evaluate(...)` last.
   - Once every private dependency has real behavior, make `evaluate(...)` the
     readable composition layer over those helpers.
   - Use constructor-level model stubs for geometry, atmosphere, light source,
     and spectral facts.
   - Test helper call sequencing through `evaluate(...)` without reaching into
     peer model internals.
   - Add cited fixture-backed expectations before asserting physics values.

## Fixture Policy

- Keep physical and algorithm expectation data in JSON fixtures rather than
  inline spec literals.
- Each fixture should be a reviewable expectation ledger with stable row ids,
  row-level citations, assumptions, inputs, expected data, tolerance rules, and
  independence notes.
- Fixture citations use the same standard as production code: AMA-style
  numbered entries in `shared/algorithm32/production/references.md` and
  bracket citation tokens in fixture text fields, such as `[1]`, `[2]`, or
  `[1][2]`. Keep source locators, table rows, equations, or provenance notes
  as metadata, but do not replace the production citation registry with a
  separate fixture-local reference object standard.
- Prefer fixtures that cite actual source data, authoritative tables, published
  examples, or external-tool artifacts. Hand-derived reference calculations are
  acceptable only when they are the clearest source-backed analytic invariant.
- Tests should cover sourced extents that cap or bound the calculation domain,
  not only central happy paths. Those extents may be physics-based, such as an
  optical wavelength range, a valid coefficient domain, a vacuum/no-medium
  limit, a zero-length or zero-weight path, or a monotonic transport limit.
  They may also be operational, such as JavaScript number precision,
  representable finite values, or floating-point resolution. Physics extents
  must be backed by references, empirical sources, published algorithm papers,
  source-backed fixture rows, or accepted reference-log entries; operational
  extents may cite the relevant language/runtime specification. Practical caps
  are acceptable when the cap and its reason come from the cited source, such
  as a Bruneton-style paper or empirical dataset, instead of from an invented
  local rationale. Do not choose extent values as arbitrary convenient numbers.
- Add a fixture validation spec before production specs consume a fixture
  family. Use the rejected implementation's
  `scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js`
  and `test-expectations.js` pattern as the precedent.
- Inline expectations are limited to bookkeeping, API shape, validation
  plumbing, and other non-physics behavior.

## Implementation Constraints

- Keep public model interfaces isolated: a model call may receive plain request
  data, descriptors, or previously sampled packets, but not peer model objects.
- Keep diagnostics out of the hot path until the separate diagnostics strategy
  is accepted.
- Do not introduce display/RGB conversion in `Reference`; Algorithm32 core
  output remains spectral.
- Do not import from `shared/algorithm32/POC/` at runtime.
- Do not promote POC numeric values, sampling rules, tolerances, or algorithm
  variants without an external reference, source-backed fixture, or accepted
  production reference note.
