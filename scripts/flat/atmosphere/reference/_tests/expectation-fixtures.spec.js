import {
	getAnalyticInvariantExpectation,
	getExpectedDatum,
	getToleranceRule,
	indexExpectationsById,
	loadAllExpectationFixtures,
	loadAnalyticInvariantExpectations,
	loadAnalyticInvariantExpectationsById,
	expectExpectationValue,
	expectNumberToMatchTolerance,
	expectValueToMatchTolerance,
} from './test-expectations.js';
import { CANONICAL_STAGE_IDS } from '../index.js';

const EXPECTED_ANALYTIC_INVARIANT_IDS = Object.freeze([
	'view-transmittance.vacuum.finite-path',
	'view-transmittance.nonvacuum.zero-length-path',
	'view-transmittance.homogeneous.beer-lambert-0p6',
	'view-transmittance.split-path.multiplicative-0p2-plus-0p4',
	'view-transmittance.empty-path.explicit-output',
	'view-transmittance.homogeneous.two-sample-monotonic',
	'view-transmittance.homogeneous.multi-wavelength',
	'view-transmittance.homogeneous.multi-species-sum',
	'view-transmittance.negative-extinction-rejects',
	'view-transmittance.weighted-samples.piecewise-constant',
	'view-transmittance.coefficient-wavelength-shape-rejects',
	'view-transmittance.invalid-sample-weight-rejects',
	'phase.isotropic.constant-over-solid-angle',
	'single-scattering.one-sample.scalar-product',
	'surface.lambertian.black-direct-normal',
	'surface.lambertian.white-direct-normal-equals-one',
]);

const SOURCE_CLASSES = Object.freeze([
	'hand-derived analytic',
	'authoritative table',
	'metadata/checksum',
	'published example',
	'external-tool fixture',
	'invariant/error contract',
	'local API/schema contract',
]);

const REFERENCE_KINDS = Object.freeze([
	'external-document',
	'local-design-doc',
	'authoritative-table',
	'external-tool',
]);

const PHYSICS_BACKED_SOURCE_CLASSES = Object.freeze([
	'hand-derived analytic',
	'authoritative table',
	'published example',
	'external-tool fixture',
	'invariant/error contract',
]);

const TOLERANCE_MODES = Object.freeze(['exact', 'absolute', 'relative']);

describe('atmosphere reference expectation fixtures', function() {
	describe('all expectation fixtures', function() {
		it('loads every expectation fixture with reviewable metadata', function() {
			const fixtureRecords = loadAllExpectationFixtures();

			// Reason: every checked-in expectation fixture is part of the oracle ledger.
			// Source: Reference Test Design, Expected Value Policy; fixture provenance is mandatory.
			expect(fixtureRecords.length).toBeGreaterThan(0);

			for (const { fileName, fixture } of fixtureRecords) {
				expect(fixture.kind).withContext(fileName).toBe('flat-atmosphere-reference-expectations');
				expectNonEmptyString(fixture.fixtureId, `${fileName}.fixtureId`);
				expect(fixture.schemaVersion).withContext(`${fileName}.schemaVersion`).toBe(1);
				expectNonEmptyString(fixture.referenceLog, `${fileName}.referenceLog`);
				expect(Array.isArray(fixture.expectations))
					.withContext(`${fileName}.expectations`)
					.toBeTrue();
				expect(fixture.expectations.length)
					.withContext(`${fileName}.expectations.length`)
					.toBeGreaterThan(0);
			}
		});

		it('requires every expectation row to have a canonical reference object', function() {
			for (const { fileName, fixture } of loadAllExpectationFixtures()) {
				for (const expectation of fixture.expectations) {
					// Reason: every oracle row, including local design-contract rows, needs a source locator.
					// Source: Reference Test Design, Expected Value Policy; design constraints are cited through local design docs.
					expectCanonicalReferenceObject(
						expectation.reference,
						`${fileName}:${expectation.id}.reference`,
					);
				}
			}
		});

		it('validates every expectation row envelope', function() {
			for (const { fileName, fixture } of loadAllExpectationFixtures()) {
				for (const expectation of fixture.expectations) {
					const label = `${fileName}:${expectation.id}`;

					// Reason: row envelopes must be consistent before stage tests consume them.
					// Source: Reference Test Design, Expectation Intake Checklist.
					expectNonEmptyString(expectation.id, `${label}.id`);
					expect(CANONICAL_STAGE_IDS).withContext(label).toContain(expectation.stage);
					expectNonEmptyString(expectation.quantity, `${label}.quantity`);
					expect(SOURCE_CLASSES).withContext(label).toContain(expectation.sourceClass);
					expectNonEmptyObject(expectation.assumptions, `${label}.assumptions`);
					expectNonEmptyObject(expectation.inputs, `${label}.inputs`);
					expectHasExpectedDataOrError(expectation);
					expectNonEmptyString(expectation.independence, `${label}.independence`);
				}
			}
		});

		it('validates every expected datum has provenance and comparison metadata', function() {
			for (const { fileName, fixture } of loadAllExpectationFixtures()) {
				for (const expectation of fixture.expectations) {
					if (!expectation.expected) {
						continue;
					}

					for (const [quantityKey, datum] of Object.entries(expectation.expected)) {
						const label = `${fileName}:${expectation.id}.expected.${quantityKey}`;

						// Reason: every fixture datum, numeric or structural, must explain
						// its units/semantic kind, derivation, and comparison policy.
						// Source: Reference Test Plan, Implemented-Stage Source Breadcrumb Audit.
						expectExpectedDatumMetadata(fixture, expectation, quantityKey, datum, label);
					}
				}
			}
		});

		it('requires physics-backed expectation rows to use an external source reference', function() {
			for (const { fileName, fixture } of loadAllExpectationFixtures()) {
				for (const expectation of fixture.expectations) {
					if (!PHYSICS_BACKED_SOURCE_CLASSES.includes(expectation.sourceClass)) {
						continue;
					}

					// Reason: physics-backed expectations must not be justified only by our local design.
					// Source: Reference Test Design, Expected Value Policy; physical properties need external support.
					expect(expectation.reference.kind)
						.withContext(`${fileName}:${expectation.id}`)
						.toBe('external-document');
					expectNonEmptyString(
						expectation.reference.url,
						`${fileName}:${expectation.id}.reference.url`,
					);
				}
			}
		});
	});

	describe('analytic invariants fixture', function() {
		it('loads the expected fixture metadata', function() {
			const fixture = loadAnalyticInvariantExpectations();

			// Reason: fixture metadata is the breadcrumb from machine data back to the reference decision log.
			// Source: Reference Test Design, Expected Value Policy; fixtures carry provenance as data.
			expect(fixture.kind).toBe('flat-atmosphere-reference-expectations');
			expect(fixture.fixtureId).toBe('analytic-invariants');
			expect(fixture.schemaVersion).toBe(1);
			expect(fixture.referenceLog).toBe(
				'agents/topics/apps/flat/plans/atmosphere_reset/reference/references.md',
			);
			expect(Array.isArray(fixture.expectations)).toBeTrue();
		});

		it('pins the current expectation ids without duplicates', function() {
			const byId = loadAnalyticInvariantExpectationsById();

			// Reason: the analytic invariant fixture is an intentionally curated first known-answer batch.
			// Source: Reference Plan, Phase 0.5 first expectation ledger entries.
			expect([...byId.keys()]).toEqual(EXPECTED_ANALYTIC_INVARIANT_IDS);
		});

		it('validates every expectation row envelope', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				// Reason: every expectation row must be reviewable without inspecting implementation code.
				// Source: Reference Test Design, Expectation Intake Checklist.
				expectNonEmptyString(expectation.id, `${expectation.id}.id`);
				expect(CANONICAL_STAGE_IDS).withContext(expectation.id).toContain(expectation.stage);
				expectNonEmptyString(expectation.quantity, `${expectation.id}.quantity`);
				expect(SOURCE_CLASSES).withContext(expectation.id).toContain(expectation.sourceClass);
				expectNonEmptyObject(expectation.assumptions, `${expectation.id}.assumptions`);
				expectNonEmptyObject(expectation.inputs, `${expectation.id}.inputs`);
				expectHasExpectedDataOrError(expectation);
				expectNonEmptyString(expectation.independence, `${expectation.id}.independence`);
			}
		});

		it('validates every canonical reference object', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				// Reason: each fixture row needs a locator to the source that justifies the expected values.
				// Source: Reference Decision Log, Expected-Value Intake Workflow.
				expectCanonicalReferenceObject(expectation.reference, `${expectation.id}.reference`);
			}
		});

		it('requires physics-backed expectation rows to use an external source reference', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				if (!PHYSICS_BACKED_SOURCE_CLASSES.includes(expectation.sourceClass)) {
					continue;
				}

				// Reason: physics-backed expectations must not be justified only by our local design.
				// Source: Reference Test Design, Expected Value Policy; physical properties need external support.
				expect(expectation.reference.kind)
					.withContext(expectation.id)
					.toBe('external-document');
				expectNonEmptyString(expectation.reference.url, `${expectation.id}.reference.url`);
			}
		});

		it('validates every expected datum has units, derivation, and tolerance', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				if (!expectation.expected) {
					continue;
				}

				for (const [quantityKey, datum] of Object.entries(expectation.expected)) {
					const label = `${expectation.id}.expected.${quantityKey}`;

					// Reason: each numeric oracle must carry units, arithmetic/provenance, and comparison limits.
					// Source: Reference Test Design, Expected Value Policy; no unexplained expected data.
					expectFiniteNumberOrArray(datum.value, `${label}.value`);
					expectNonEmptyString(datum.units, `${label}.units`);
					expectNonEmptyString(datum.derivation, `${label}.derivation`);
					expectToleranceRule(expectation, quantityKey);
				}
			}
		});

		it('validates every expected error has type, message context, and derivation', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				if (!expectation.expectedError) {
					continue;
				}

				const { expectedError } = expectation;
				const label = `${expectation.id}.expectedError`;

				// Reason: error-contract fixtures need a reviewable oracle just like numeric fixtures.
				// Source: Reference Test Design, Expected Value Policy; loud failures are expected outputs.
				expectNonEmptyString(expectedError.type, `${label}.type`);
				expect(Array.isArray(expectedError.messageIncludes))
					.withContext(`${label}.messageIncludes`)
					.toBeTrue();
				expect(expectedError.messageIncludes.length)
					.withContext(`${label}.messageIncludes.length`)
					.toBeGreaterThan(0);
				for (const [index, messagePart] of expectedError.messageIncludes.entries()) {
					expectNonEmptyString(messagePart, `${label}.messageIncludes.${index}`);
				}
				expectNonEmptyString(expectedError.derivation, `${label}.derivation`);
			}
		});

		it('keeps tolerance keys aligned with expected value keys', function() {
			const fixture = loadAnalyticInvariantExpectations();

			for (const expectation of fixture.expectations) {
				if (!expectation.expected) {
					continue;
				}

				// Reason: every expected datum needs an explicit comparison policy and no orphan tolerance.
				// Source: Reference Test Design, Expected Value Policy; tolerance belongs with expected data.
				expect(Object.keys(expectation.tolerance))
					.withContext(expectation.id)
					.toEqual(Object.keys(expectation.expected));
			}
		});
	});

	describe('expectation helper', function() {
		it('rejects duplicate expectation ids', function() {
			// Reason: expectation ids are stable handles used by tests and reports.
			// Source: Reference Plan, Phase 0.5; fixture rows are selected by id.
			expect(() => indexExpectationsById([
				{ id: 'duplicate' },
				{ id: 'duplicate' },
			])).toThrowError(/Duplicate expectation id: duplicate/);
		});

		it('retrieves expectation rows and expected data by id', function() {
			const expectation = getAnalyticInvariantExpectation(
				'view-transmittance.homogeneous.beer-lambert-0p6',
			);

			// Reason: helper lookup should expose the pinned fixture data without recomputing it.
			// Source: analytic-invariants fixture row for homogeneous Beer-Lambert tau.
			expect(getExpectedDatum(expectation, 'tau').value).toBe(0.6);
			expect(getToleranceRule(expectation, 'tau')).toEqual({
				mode: 'absolute',
				value: 1e-12,
			});
		});

		it('applies exact, absolute, and relative tolerance rules', function() {
			// Reason: tolerance modes are comparison policy, not expected-value generators.
			// Source: Reference Test Design, Expected Value Policy; tolerances live in one validation helper.
			expectNumberToMatchTolerance(1, 1, { mode: 'exact' }, 'exact fixture check');
			expectNumberToMatchTolerance(
				0.6000000000005,
				0.6,
				{ mode: 'absolute', value: 1e-12 },
				'absolute fixture check',
			);
			expectNumberToMatchTolerance(
				100.00000000005,
				100,
				{ mode: 'relative', value: 1e-12 },
				'relative fixture check',
			);
		});

		it('compares actual values against fixture expectations', function() {
			const expectation = getAnalyticInvariantExpectation(
				'view-transmittance.homogeneous.beer-lambert-0p6',
			);

			// Reason: comparisons must read the pinned fixture oracle and its tolerance rule together.
			// Source: analytic-invariants fixture row for homogeneous Beer-Lambert tau and transmittance.
			expectExpectationValue(0.6, expectation, 'tau');
			expectExpectationValue(0.5488116360940264, expectation, 'transmittance');
		});

		it('compares array values against fixture expectations', function() {
			const expectation = getAnalyticInvariantExpectation(
				'view-transmittance.homogeneous.multi-wavelength',
			);

			// Reason: spectral fixtures pin arrays, and helper comparison should preserve index alignment.
			// Source: analytic-invariants fixture row for multi-wavelength Beer-Lambert transport.
			expectValueToMatchTolerance(
				[0.3, 0.6],
				getExpectedDatum(expectation, 'tauByWavelength').value,
				getToleranceRule(expectation, 'tauByWavelength'),
				'multi-wavelength tau fixture check',
			);
		});
	});
});

function expectToleranceRule(expectation, quantityKey) {
	const tolerance = getToleranceRule(expectation, quantityKey);
	const label = `${expectation.id}.tolerance.${quantityKey}`;

	// Reason: fixture tolerances are limited to known comparison semantics.
	// Source: Reference Test Design, Expected Value Policy.
	expect(TOLERANCE_MODES).withContext(label).toContain(tolerance.mode);

	if (tolerance.mode === 'exact') {
		// Reason: exact comparisons must not carry unused numeric tolerance fields.
		// Source: local fixture schema policy for unambiguous comparisons.
		expect(Object.keys(tolerance)).withContext(label).toEqual(['mode']);
		return;
	}

	// Reason: non-exact tolerances are numeric bounds on absolute or relative error.
	// Source: Reference Test Design, tolerance checklist item.
	expect(Number.isFinite(tolerance.value)).withContext(`${label}.value`).toBeTrue();
	expect(tolerance.value).withContext(`${label}.value`).toBeGreaterThanOrEqual(0);
}

function expectExpectedDatumMetadata(fixture, expectation, quantityKey, datum, label) {
	expectNonEmptyObject(datum, label);
	expect(Object.prototype.hasOwnProperty.call(datum, 'value'))
		.withContext(`${label}.value`)
		.toBeTrue();
	expectNonEmptyString(datum.derivation, `${label}.derivation`);
	expectNonEmptyString(datum.units, `${label}.units`);

	if (isFiniteNumberOrArray(datum.value)) {
		expectToleranceRule(expectation, quantityKey);
		return;
	}

	const comparisonPolicy = datum.comparison
		?? fixture.expectedComparisonPolicy?.nonnumeric;

	// Reason: nonnumeric expected values need explicit structural comparison
	// semantics because numeric tolerance does not describe object/string/boolean checks.
	// Source: Reference Plan, fixture comparison-policy remediation rows.
	expectNonEmptyString(comparisonPolicy, `${label}.comparison`);
}

function expectCanonicalReferenceObject(reference, label) {
	expectNonEmptyObject(reference, label);
	expectNonEmptyString(reference.id, `${label}.id`);
	expect(REFERENCE_KINDS)
		.withContext(`${label}.kind`)
		.toContain(reference.kind);
	expectNonEmptyString(reference.title, `${label}.title`);
	expectNonEmptyString(reference.locator, `${label}.locator`);
	expectNonEmptyString(
		reference.derivationSummary,
		`${label}.derivationSummary`,
	);
	expect(Boolean(reference.url || reference.path))
		.withContext(`${label} url or path`)
		.toBeTrue();
}

function expectHasExpectedDataOrError(expectation) {
	const hasExpected = Boolean(expectation.expected);
	const hasExpectedError = Boolean(expectation.expectedError);

	// Reason: a fixture row must define either a numeric oracle or a loud-failure oracle, never neither.
	// Source: Reference Test Design, Expected Value Policy.
	expect(hasExpected || hasExpectedError).withContext(expectation.id).toBeTrue();
	expect(hasExpected && hasExpectedError).withContext(expectation.id).toBeFalse();

	if (hasExpected) {
		expectNonEmptyObject(expectation.expected, `${expectation.id}.expected`);
		expectNonEmptyObject(expectation.tolerance, `${expectation.id}.tolerance`);
		return;
	}

	expectNonEmptyObject(expectation.expectedError, `${expectation.id}.expectedError`);
	expect(expectation.tolerance)
		.withContext(`${expectation.id}.tolerance`)
		.toBeUndefined();
}

function expectFiniteNumberOrArray(value, label) {
	if (Array.isArray(value)) {
		expect(value.length).withContext(`${label}.length`).toBeGreaterThan(0);
		for (const [index, entry] of value.entries()) {
			expectFiniteNumberOrArray(entry, `${label}.${index}`);
		}
		return;
	}

	expect(Number.isFinite(value)).withContext(label).toBeTrue();
}

function isFiniteNumberOrArray(value) {
	if (Array.isArray(value)) {
		return value.length > 0 && value.every((entry) => isFiniteNumberOrArray(entry));
	}

	return Number.isFinite(value);
}

function expectNonEmptyObject(value, label) {
	// Reason: required fixture objects must carry structured provenance or assumptions, not placeholders.
	// Source: Reference Test Design, Expectation Intake Checklist.
	expect(value).withContext(label).toEqual(jasmine.any(Object));
	expect(Object.keys(value)).withContext(label).not.toEqual([]);
}

function expectNonEmptyString(value, label) {
	// Reason: required fixture text fields are human-review breadcrumbs.
	// Source: Reference Test Design, Expected Value Policy.
	expect(typeof value).withContext(label).toBe('string');
	expect(value.length).withContext(label).toBeGreaterThan(0);
}
