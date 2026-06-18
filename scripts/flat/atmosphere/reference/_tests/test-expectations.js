import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

export const EXPECTATION_FIXTURES_DIRECTORY = path.resolve(
	// Reason: all expectation-ledger fixtures live beside the implemented stage specs they exercise.
	// Source: Reference Test Design, Expected Value Policy; fixture rows are the oracle ledger.
	TEST_DIRECTORY,
	'../stages/_tests/fixtures',
);

export const ANALYTIC_INVARIANTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'analytic-invariants.json',
);

export const RAY_PATH_CONTRACTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'ray-path-contracts.json',
);

export const VIEW_SAMPLES_CONTRACTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'view-samples-contracts.json',
);

export const MEDIUM_CONTRACTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'medium-contracts.json',
);

export const VIEW_OPTICAL_DEPTH_HARDENING_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'view-optical-depth-hardening.json',
);

export const SOLAR_TRANSMITTANCE_CONTRACTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'solar-transmittance-contracts.json',
);

export const DIFFUSE_SKY_AIRLIGHT_CONTRACTS_EXPECTATION_PATH = path.resolve(
	EXPECTATION_FIXTURES_DIRECTORY,
	'diffuse-sky-airlight-contracts.json',
);

export function loadExpectationFixture(
	fixturePath = ANALYTIC_INVARIANTS_EXPECTATION_PATH,
) {
	// Reason: fixture files are canonical structured oracle data, so tests should load JSON directly.
	// Source: Reference Test Design, Expected Value Policy; no generated or implicit expected data.
	return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

export function loadAnalyticInvariantExpectations() {
	// Reason: analytic invariant specs keep their original fixture family behind a named loader.
	// Source: Reference Test Design, Fixture And Reference Intake.
	return loadExpectationFixture(ANALYTIC_INVARIANTS_EXPECTATION_PATH);
}

export function loadAllExpectationFixtures() {
	// Reason: global fixture validation must discover every expectation ledger file, not a curated subset.
	// Source: Reference Test Plan, fixture and reference intake.
	return fs.readdirSync(EXPECTATION_FIXTURES_DIRECTORY)
		.filter((fileName) => fileName.endsWith('.json'))
		.sort()
		.map((fileName) => {
			const fixturePath = path.join(EXPECTATION_FIXTURES_DIRECTORY, fileName);
			return {
				fileName,
				fixturePath,
				fixture: loadExpectationFixture(fixturePath),
			};
		});
}

export function indexExpectationsById(expectationsOrFixture) {
	const expectations = Array.isArray(expectationsOrFixture)
		? expectationsOrFixture
		: expectationsOrFixture?.expectations;

	if (!Array.isArray(expectations)) {
		// Reason: expectation fixtures are tables of independently justified oracle rows.
		// Source: Reference Test Design, Expected Value Policy; fixtures expose an expectations array.
		throw new Error('Expectation fixture must provide an expectations array');
	}

	const byId = new Map();

	for (const expectation of expectations) {
		if (!expectation?.id) {
			// Reason: rows need stable ids so tests and reports can cite the exact oracle used.
			// Source: Reference Plan, Phase 0.5 expectation ledger entries.
			throw new Error('Expectation row is missing id');
		}

		if (byId.has(expectation.id)) {
			// Reason: duplicate ids make expected-value provenance ambiguous.
			// Source: local fixture schema policy derived from the expectation ledger contract.
			throw new Error(`Duplicate expectation id: ${expectation.id}`);
		}

		byId.set(expectation.id, expectation);
	}

	return byId;
}

export function loadAnalyticInvariantExpectationsById() {
	// Reason: specs cite stable row ids instead of depending on fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadAnalyticInvariantExpectations());
}

export function loadRayPathContractExpectations() {
	// Reason: resolveRayPath tests own a named fixture family for ray-segment and boundary contracts.
	// Source: Reference Test Plan, resolveRayPath current batch.
	return loadExpectationFixture(RAY_PATH_CONTRACTS_EXPECTATION_PATH);
}

export function loadViewSamplesContractExpectations() {
	// Reason: sampleViewPath tests own a named fixture family for midpoint sample contracts.
	// Source: Reference Test Plan, sampleViewPath fixture-backed behavior.
	return loadExpectationFixture(VIEW_SAMPLES_CONTRACTS_EXPECTATION_PATH);
}

export function loadMediumContractExpectations() {
	// Reason: evaluateMedium tests own a named fixture family for medium coefficient contracts.
	// Source: Reference Test Plan, evaluateMedium fixture-backed behavior.
	return loadExpectationFixture(MEDIUM_CONTRACTS_EXPECTATION_PATH);
}

export function loadViewOpticalDepthHardeningExpectations() {
	// Reason: integrateViewOpticalDepth hardening rows are a named fixture family with stricter metadata checks.
	// Source: Reference Test Plan, integrateViewOpticalDepth follow-up audit.
	return loadExpectationFixture(VIEW_OPTICAL_DEPTH_HARDENING_EXPECTATION_PATH);
}

export function loadSolarTransmittanceContractExpectations() {
	// Reason: integrateSolarTransmittance tests own a named fixture family for source-path transport contracts.
	// Source: Reference Test Plan, integrateSolarTransmittance current batch.
	return loadExpectationFixture(SOLAR_TRANSMITTANCE_CONTRACTS_EXPECTATION_PATH);
}

export function loadDiffuseSkyAirlightContractExpectations() {
	// Reason: integrateDiffuseSkyAirlight tests own a named fixture family for the stage contract.
	// Source: Sun Visual Plan, Horizon-Row Diagnostic Result; fixture rows are the oracle ledger.
	return loadExpectationFixture(DIFFUSE_SKY_AIRLIGHT_CONTRACTS_EXPECTATION_PATH);
}

export function loadRayPathContractExpectationsById() {
	// Reason: specs cite stable ray-path row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadRayPathContractExpectations());
}

export function loadViewSamplesContractExpectationsById() {
	// Reason: specs cite stable view-sample row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadViewSamplesContractExpectations());
}

export function loadMediumContractExpectationsById() {
	// Reason: specs cite stable medium row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadMediumContractExpectations());
}

export function loadViewOpticalDepthHardeningExpectationsById() {
	// Reason: specs cite stable optical-depth row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadViewOpticalDepthHardeningExpectations());
}

export function loadSolarTransmittanceContractExpectationsById() {
	// Reason: specs cite stable solar-transmittance row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadSolarTransmittanceContractExpectations());
}

export function loadDiffuseSkyAirlightContractExpectationsById() {
	// Reason: specs cite stable diffuse-sky-airlight row ids rather than fixture row order.
	// Source: Reference Test Design, Expected Value Policy.
	return indexExpectationsById(loadDiffuseSkyAirlightContractExpectations());
}

export function getRayPathContractExpectation(expectationId) {
	const expectation = loadRayPathContractExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, resolveRayPath current batch.
		throw new Error(`Unknown ray-path contract expectation: ${expectationId}`);
	}

	return expectation;
}

export function getViewSamplesContractExpectation(expectationId) {
	const expectation = loadViewSamplesContractExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, sampleViewPath fixture-backed behavior.
		throw new Error(`Unknown view-samples contract expectation: ${expectationId}`);
	}

	return expectation;
}

export function getMediumContractExpectation(expectationId) {
	const expectation = loadMediumContractExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, evaluateMedium fixture-backed behavior.
		throw new Error(`Unknown medium contract expectation: ${expectationId}`);
	}

	return expectation;
}

export function getViewOpticalDepthHardeningExpectation(expectationId) {
	const expectation = loadViewOpticalDepthHardeningExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, integrateViewOpticalDepth follow-up audit.
		throw new Error(`Unknown view optical-depth hardening expectation: ${expectationId}`);
	}

	return expectation;
}

export function getSolarTransmittanceContractExpectation(expectationId) {
	const expectation = loadSolarTransmittanceContractExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, integrateSolarTransmittance current batch.
		throw new Error(`Unknown solar-transmittance contract expectation: ${expectationId}`);
	}

	return expectation;
}

export function getDiffuseSkyAirlightContractExpectation(expectationId) {
	const expectation = loadDiffuseSkyAirlightContractExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Plan, diffuse-sky-airlight fixture batch.
		throw new Error(`Unknown diffuse-sky-airlight contract expectation: ${expectationId}`);
	}

	return expectation;
}

export function getAnalyticInvariantExpectation(expectationId) {
	const expectation = loadAnalyticInvariantExpectationsById().get(expectationId);

	if (!expectation) {
		// Reason: tests should fail loudly when they cite an oracle that is not in the ledger.
		// Source: Reference Test Design, Expected Value Policy; expected data must be pinned and locatable.
		throw new Error(`Unknown analytic invariant expectation: ${expectationId}`);
	}

	return expectation;
}

export function getExpectedDatum(expectation, quantityKey) {
	const datum = expectation?.expected?.[quantityKey];

	if (!datum || typeof datum !== 'object' || !('value' in datum)) {
		// Reason: every quantity-specific expectation must carry an explicit numeric value.
		// Source: Reference Test Design, Expected Value Policy; no implicit expected data.
		throw new Error(`${expectation?.id ?? 'expectation'} is missing expected.${quantityKey}.value`);
	}

	return datum;
}

export function getToleranceRule(expectation, quantityKey) {
	const tolerance = expectation?.tolerance?.[quantityKey];

	if (!tolerance || typeof tolerance !== 'object') {
		// Reason: every expected datum needs a stated comparison rule.
		// Source: Reference Test Design, Expectation Intake Checklist; tolerance is required.
		throw new Error(`${expectation?.id ?? 'expectation'} is missing tolerance.${quantityKey}`);
	}

	return tolerance;
}

export function expectNumberToMatchTolerance(
	actualValue,
	expectedValue,
	tolerance,
	label = 'value',
) {
	if (tolerance.mode === 'exact') {
		// Reason: exact mode means the fixture value is the complete comparison rule.
		// Source: local tolerance helper contract.
		expect(actualValue).withContext(label).toBe(expectedValue);
		return;
	}

	if (tolerance.mode === 'absolute') {
		expectFiniteToleranceValue(tolerance.value, label);
		// Reason: absolute tolerance compares error in the same units as the expected datum.
		// Source: Reference Test Design, tolerance checklist item.
		expect(Math.abs(actualValue - expectedValue))
			.withContext(`${label} absolute error`)
			.toBeLessThanOrEqual(tolerance.value);
		return;
	}

	if (tolerance.mode === 'relative') {
		expectFiniteToleranceValue(tolerance.value, label);
		const scale = Math.max(Math.abs(expectedValue), Number.EPSILON);

		// Reason: relative tolerance compares fractional error while guarding a zero expected value.
		// Source: local tolerance helper contract for dimensionless comparison scale.
		expect(Math.abs(actualValue - expectedValue) / scale)
			.withContext(`${label} relative error`)
			.toBeLessThanOrEqual(tolerance.value);
		return;
	}

	// Reason: unsupported tolerance modes would make pass/fail semantics unclear.
	// Source: Reference Test Design, Expected Value Policy; comparison rules are enumerated.
	throw new Error(`${label} has unsupported tolerance mode: ${tolerance.mode}`);
}

export function expectExpectationValue(actualValue, expectation, quantityKey) {
	const expectedDatum = getExpectedDatum(expectation, quantityKey);
	const tolerance = getToleranceRule(expectation, quantityKey);

	expectValueToMatchTolerance(
		actualValue,
		expectedDatum.value,
		tolerance,
		`${expectation.id}.${quantityKey}`,
	);
}

export function expectValueToMatchTolerance(
	actualValue,
	expectedValue,
	tolerance,
	label = 'value',
) {
	if (Array.isArray(expectedValue)) {
		// Reason: spectral and sample-aligned fixture expectations are arrays, but each entry
		// still uses the same tolerance rule for the same physical quantity.
		// Source: Reference Test Design, Expected Value Policy; arrays must stay wavelength/sample aligned.
		expect(Array.isArray(actualValue)).withContext(label).toBeTrue();
		if (!Array.isArray(actualValue)) {
			return;
		}
		expect(actualValue.length).withContext(`${label} length`).toBe(expectedValue.length);

		for (const [index, expectedEntry] of expectedValue.entries()) {
			expectValueToMatchTolerance(
				actualValue[index],
				expectedEntry,
				tolerance,
				`${label}[${index}]`,
			);
		}

		return;
	}

	expectNumberToMatchTolerance(actualValue, expectedValue, tolerance, label);
}

function expectFiniteToleranceValue(value, label) {
	if (!Number.isFinite(value) || value < 0) {
		// Reason: tolerance is an error bound and therefore cannot be negative or non-finite.
		// Source: Reference Test Design, tolerance checklist item.
		throw new Error(`${label} tolerance value must be a nonnegative finite number`);
	}
}
