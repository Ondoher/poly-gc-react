# Algorithm32 Production

This folder owns the production Algorithm32 implementation. It currently holds
the test lane, public/API scaffolds, models, utilities, fixtures, and initial
tested CPU/reference helper implementations. Additional production algorithm
code should be added only after the corresponding design/API step is accepted.

The preserved POC implementation at `shared/algorithm32/POC/` is reference
material for promotion and parity checks. Production modules in this folder
should not import from `POC` as runtime dependencies.

## Current Handoff

The freshest operational evidence is the accepted local-second-order POC
lineage under `scripts/flat/local-second-order/` and
`shared/algorithm32/POC/local-second-order/`, plus the preserved CPU,
source-contract, and Three shader-lab modules in `shared/algorithm32/POC/`.
Current production design treats endpoint/trapezoid transport as the latest
shader-lineage evidence; older midpoint cleanroom fixtures remain stage
evidence only.

`IncidentRadianceCache` is owned by the concrete light-source implementation
behind `LightSourceModel.sampleIncidentRadiance(...)`. The generic `Reference`
executor does not receive or own a separate cache dependency. Geometry owns ray
distance, clipping, boundary, and altitude policy; atmosphere owns medium
coefficients and phase facts; transport execution coordinates plain packets
and applies the selected integration rule.

The mined POC constant inventory and unresolved promotion questions are in the
topic design doc:
`agents/topics/apps/flat/algorithm32/production-design.md#latest-poc-constant-inventory`.

## Facade

`Algorithm32.js` defines the primary production facade skeleton. It currently
records the accepted constructor and public method surface with JSDoc but does
not implement behavior yet.

## Implementation Classes

Implementation collaborators live under `implementation/`. The initial
scaffolds are `Reference`, which will run CPU/reference Algorithm32 evaluations,
and `ShaderBuilder`, which will build runtime shader artifacts for facade
attachment to a Three composer. Implementation-only complex packet shapes live
in `implementation/types.d.ts`. `Reference.evaluate(...)` now contains the
cited top-level volume-transport orchestration and private helper stubs; the
transport helper implementations are still pending. The focused implementation
plan for those helpers lives in
`implementation/reference_plan.md` and proceeds from least-dependent private
helpers toward the composed `evaluate(...)` method. Unit tests for
`evaluate(...)` itself should wait until its private dependencies have real
behavior. `Reference._createTransportState(...)` and
`Reference._createEvaluationResult(...)` are the first implemented leaf
helpers; they initialize the bookkeeping state for spectral radiance and
transmittance and package the final transport state as a public spectral result
snapshot. `Reference` keeps helper methods before the public
`evaluate(...)` method so method dependencies appear before the method that
composes them.
Higher-order incident radiance is requested through
`LightSourceModel.sampleIncidentRadiance(...)`, so the generic reference
executor does not own a separate incident-radiance cache dependency.
`Reference._computeSegmentTransmittance(...)` now computes per-channel
Beer-Lambert attenuation from sampled extinction and path weight.
`Reference._integratePathSample(...)` now returns an immutable next transport
state by adding direct plus incident in-scattering and attenuating the running
view transmittance.
`Reference._computeDirectInScattering(...)` and
`Reference._computeIncidentInScattering(...)` now compute fixture-backed
one-sample in-scattering products. Incident in-scattering consumes an
`IncidentRadianceSample` already sampled by the light-source model boundary.

## Models

Shared configuration/facts models live under `models/`. `SharedModel`
aggregates the facade-owned light-source, atmosphere, geometry, and spectral component
models. It accepts the caller-provided light source, atmosphere, and geometry
implementations plus the accepted spectral basis, then constructs the
facade-owned `SpectralModel`. `SpectralModel` owns the active spectral basis,
channel shape, fingerprint, and version, and it provides basis replacement,
wavelength lookup, descriptor snapshots, and alignment queries. Model-only
complex packet shapes live in `models/types.d.ts`.

## Utilities

Generic pure numeric utilities live under `utils/`. The initial utility objects
are `ScalarMath`, `AngleMath`, `DistanceMath`, `WavelengthMath`, `VectorMath`,
`ArrayMath`, and `SampleMath`. They are domain-agnostic, deterministic helpers
with call-local options and no hidden mutable state. Utility-only complex option types live in
`utils/types.d.ts`. `utils/MathUtils.js` re-exports the utility objects by name
for convenient grouped imports.

## Test Lane

Run the production unit-test lane with:

```text
npm run test:algorithm32:production
```

Specs live near the code they exercise in local `_tests/` folders and use
Jasmine directly through `spec/support/jasmine-algorithm32-production.json`.
Each class should have a class-named spec file beside its implementation
folder, such as `models/_tests/SpectralModel.spec.js`.

Physical and algorithm expectation data should live in checked-in JSON fixture
ledgers, not inline spec literals. Each fixture row should carry stable ids,
citations, assumptions, input packets, expected data, tolerance metadata, and
an independence note. Fixture citations use the same AMA-style numbered
entries in `references.md` and bracket citation tokens used by production
code comments. Fixture rows may include a compact shared reference
pointer object that identifies the numbered reference plus a precise section,
equation, figure, table, row, page, local artifact path, or other locator.
The first production fixture ledger is
`fixtures/analytic-invariants.json`; it promotes externally backed analytic
rows from the rejected reference fixture file and omits rows whose only
citations were local app or stage specs. Its shape is guarded by
`_tests/fixtures.spec.js`, including a check that bracket citation numbers
match the row's compact reference pointer numbers and that superscript
citations are not used.
Prefer actual source data,
authoritative tables, published examples, or external-tool artifacts over
reference calculations when such data exists. Physics and algorithm tests
should cover sourced extents that cap or bound the calculation domain, not only
central happy paths. Those extents may be physics-based, such as an optical
wavelength range, a valid coefficient domain, a vacuum/no-medium limit, a
zero-length or zero-weight path, or a monotonic transport limit. They may also
be operational, such as JavaScript number precision, representable finite
values, or floating-point resolution. Physics extents must come from external
references, empirical sources, published algorithm papers, source-backed
fixture rows, or accepted reference-log entries; operational extents may cite
the relevant language/runtime specification. Practical caps are acceptable when
the cap and its reason come from the cited source, such as a Bruneton-style
paper or empirical dataset, instead of from an invented local rationale. Do not
choose extent values as arbitrary convenient numbers. Before production specs consume
a fixture family, add a fixture validation spec following the precedent from
`scripts/flat/atmosphere_rejected/reference/_tests/expectation-fixtures.spec.js`
and `test-expectations.js`. Inline expectations are reserved for bookkeeping,
API shape, validation plumbing, and other non-physics behavior.

## Source References

External physics and algorithm references belong in `references.md` using
AMA-style numbered entries. Code comments, JSDoc comments, and JSON fixture
text fields should cite those entries with bracketed reference numbers,
preceded by a short description of the data, formula, algorithm decision, or
algorithm variation being cited. Use ASCII tokens such as `[1]`, `[2]`, and
`[1][2]`, not Unicode superscripts, Markdown footnotes, or HTML citation
markup.

References are required for Algorithm32 physics and algorithm decisions,
meaningful algorithm variations, test fixtures, and non-fixture algorithm
tests. They are not required for API-shape compliance, validation plumbing,
guardrail mechanics, architectural choices, module boundaries, file placement,
JSDoc style, or incidental platform/data-structure limitations. If a test
intentionally enforces operational extents caused by a language or platform
limit, cite the relevant language/runtime specification.

When a citation needs more precision than the numbered AMA entry, use the
shared `Algorithm32ProductionReferencePointer` shape to identify the reference
number plus a section, equation, figure, table, row, page, local artifact path,
or other locator.

## Types And JSDoc

Complex packet, fixture, registry, and API shapes belong in ambient `.d.ts`
files with property-level documentation. Shared scaffold registry types live
in `types.d.ts`. Primary single-interface model contracts live under
`types/` with PascalCase filenames that match the interface name, such as
`LightSourceModel.d.ts`, `AtmosphereModel.d.ts`, and `GeometryModel.d.ts`. The
caller-provided color conversion interface lives in `types/Color.d.ts` because
display conversion is adjacent to Algorithm32 core output rather than a shared
model owned by the facade. Supporting request, sample, and descriptor types
for those interfaces live in `types/types.d.ts` so the primary interface files
stay focused. Inside the
Algorithm32 production package, type names should not repeat the redundant
`Algorithm32` prefix unless a cross-package collision or existing scaffold
contract requires it. Consumer-provided model interfaces receive plain data
contracts such as `SpectralBasis`; they must not depend on internal
Algorithm32 model objects. Durable public/configuration types carry units as
data rather than property-name suffixes: `SpectralBasis` owns the ordered
`wavelengths` list of unit-bearing `Wavelength` packets as the canonical
spectral channel source; `channelCount` is derived by `SpectralModel` and
descriptors instead of repeated in the basis input.
Unit utility constructors use `in<Unit>(value)` names, and unit conversions use
`to<Unit>(unitValue)` names that accept unit-bearing packets.
Unit utility objects may also expose small packet-in/packet-out operators such
as `add`, `subtract`, and `scale` for one-line calculations; hot loops should
still canonicalize once to plain scalar values.
JavaScript classes, methods, functions, and
non-trivial properties should use JSDoc with explicit types. Function and
method JSDoc must document parameters and return results. Parameter tags use a
hyphen after the parameter name, such as `@param request - ...`. When the
return shape is complex, explain the important returned fields in the
description and keep the `@returns` text concise.

## Class State

Private methods and properties use a leading underscore, such as `_config`.
Publicly readable properties should expose getters. Use setters only for direct
assignment with no processing; use explicit methods when setting a value needs
validation, normalization, cache invalidation, derived-state updates, resource
work, or other processing.
