# Atmosphere Reference Tests

This folder contains non-browser Jasmine specs for
`scripts/flat/atmosphere/reference`.

Run the focused lane with:

```text
npm run test:scripts:flat
```

The broader scripts lane also discovers these specs:

```text
npm run test:scripts
```

Keep specs close to the script code they exercise. The focused Jasmine config
discovers `*.spec.js` and `*.spec.mjs` files under
`scripts/flat/atmosphere/reference`.

The reference integrator test split is now active:

- `_tests/pipeline-stages.spec.js` owns registry mechanics only.
- `_tests/CpuSpectralReferenceIntegrator.spec.js` owns facade behavior.
- `_tests/pipeline-handoffs.spec.js` owns adjacent packet compatibility.
- `_tests/trace-ray.integration.spec.js` owns full `traceRay` known-answer
  fixtures.
- `stages/_tests/*Stage.spec.js` owns direct stage behavior.

Do not add new stage behavior shells to `pipeline-stages.spec.js`; put them in
the focused stage spec or in the handoff/integration spec that owns the
question.

Keep shared stage contracts, fixture packets, and reusable expectations in
`test-pipeline-stages.js` so the focused specs stay organized.

Use `test-expectations.js` for checked-in expectation fixtures. It loads
`stages/_tests/fixtures/analytic-invariants.json`, indexes rows by `id`, and
applies each row's tolerance rule so specs do not duplicate tolerance logic.

Use `expectation-fixtures.spec.js` to validate expectation fixture shape before
stage specs consume the data.

Every expected literal, fixture row, generated fixture output, checksum, or
sample expectation must have a nearby derivation note. Use a spec comment for
inline expectations. For JSON fixtures, make the provenance part of the data
itself. Each expectation row should use a canonical `reference` object with
`id`, `kind`, `title`, `url` or `path`, `locator`, and `derivationSummary`.
Keep exact value arithmetic beside the value as
`expected.<quantity>.derivation`. Keep it short, but name the equation,
reference section, table row, metadata field, external tool/config, or
provenance record well enough for a reviewer to locate the expectation.

Every test expectation and code validation check should also say why it exists.
When the reason is physical, cite an external source such as PBRT, CIE, PDAS,
ASTM/NREL, IAU, SMARTS, or libRadtran. When the reason is local API or schema
policy, cite the reference design/test design rather than presenting the rule
as physics.

Give exported utilities their own focused specs instead of burying them inside
stage tests. For example, vector normalization behavior belongs in
`utils.spec.js`; `validateRequest` should test the domain contract that a
finite nonzero ray orientation becomes a canonical unit direction.

Keep code files generally below 1000 lines. Spec files have a little wiggle
room, but split by ownership before a spec becomes hard to review.
