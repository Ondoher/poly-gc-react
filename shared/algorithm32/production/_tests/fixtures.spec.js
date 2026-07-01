import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const productionRootPath = path.resolve(path.dirname(currentFilePath), '..');
const analyticFixturePath = 'fixtures/analytic-invariants.json';
const legacyReferenceFields = ['kind', 'title', 'url', 'path', 'derivationSummary'];
const allowedReferenceNumbers = new Set([1, 2, 3, 4]);

/**
 * Read a production JSON fixture.
 *
 * @param {string} relativePath - Locate the fixture relative to the production package root.
 * @returns {unknown} Return the parsed JSON fixture.
 */
function readProductionJson(relativePath) {
	const fullPath = path.join(productionRootPath, relativePath);

	return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

/**
 * Check whether a value is a plain object.
 *
 * @param {unknown} value - Store the value to check.
 * @returns {boolean} Return true when the value is a non-array object.
 */
function isPlainObject(value) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check whether text includes a bracketed reference number.
 *
 * @param {string} text - Store the text to inspect.
 * @returns {boolean} Return true when the text carries an inline bracket citation.
 */
function hasBracketCitation(text) {
	return /\[\d+\]/u.test(text);
}

/**
 * Extract each bracketed citation group.
 *
 * @param {string} text - Store the citation text to inspect.
 * @returns {{ value: string, index: number }[]} Return ordered citation groups and their offsets.
 */
function getBracketCitationGroups(text) {
	return [...text.matchAll(/\[(\d+)\]/gu)]
		.map((match) => ({
			value: match[1],
			index: match.index,
		}));
}

/**
 * Extract unique numbered references cited with bracket citations.
 *
 * @param {string} text - Store the citation text to inspect.
 * @returns {number[]} Return sorted unique reference numbers.
 */
function getBracketReferenceNumbers(text) {
	const referenceNumbers = getBracketCitationGroups(text)
		.map((group) => Number(group.value));

	return [...new Set(referenceNumbers)].sort((left, right) => left - right);
}

/**
 * Assert that no superscript citation digits remain in fixture text.
 *
 * @param {string} text - Store the citation text to inspect.
 * @returns {void}
 */
function expectNoSuperscriptCitations(text) {
	expect(text).not.toMatch(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/u);
}

/**
 * Return sorted unique reference numbers from one row's pointer objects.
 *
 * @param {readonly Algorithm32ProductionReferencePointer[]} pointers - Supplies row reference pointers.
 * @returns {number[]} Return sorted unique pointer reference numbers.
 */
function getPointerReferenceNumbers(pointers) {
	return [...new Set(pointers.map((pointer) => pointer.referenceNumber))]
		.sort((left, right) => left - right);
}

/**
 * Assert that a reference pointer follows the current compact production shape.
 *
 * @param {unknown} pointer - Store the reference pointer to validate.
 * @returns {void}
 */
function expectReferencePointer(pointer) {
	expect(isPlainObject(pointer)).toBe(true);
	expect(pointer.referenceNumber).toEqual(jasmine.any(Number));
	expect(allowedReferenceNumbers.has(pointer.referenceNumber)).toBe(true);

	for (const legacyField of legacyReferenceFields) {
		expect(Object.hasOwn(pointer, legacyField)).toBe(false);
	}
}

/**
 * Assert that one fixture row has the current production row envelope.
 *
 * @param {unknown} row - Store the fixture row to validate.
 * @returns {void}
 */
function expectFixtureRow(row) {
	expect(isPlainObject(row)).toBe(true);
	expect(row.id).toEqual(jasmine.any(String));
	expect(row.id).toMatch(/^[a-z0-9]+(?:[-.][a-z0-9]+)+$/);
	expect(row.area).toEqual(jasmine.any(String));
	expect(row.quantity).toEqual(jasmine.any(String));
	expect(row.citation).toEqual(jasmine.any(String));
	expect(hasBracketCitation(row.citation)).toBe(true);
	expectNoSuperscriptCitations(row.citation);
	expect(row.references).toEqual(jasmine.any(Array));
	expect(row.references.length).toBeGreaterThan(0);
	expect(getBracketReferenceNumbers(row.citation)).toEqual(getPointerReferenceNumbers(row.references));
	expect(isPlainObject(row.assumptions)).toBe(true);
	expect(isPlainObject(row.input)).toBe(true);
	expect(row.independence).toEqual(jasmine.any(String));

	for (const pointer of row.references) {
		expectReferencePointer(pointer);
	}

	if (row.expected !== undefined) {
		expect(isPlainObject(row.expected)).toBe(true);
		expect(Object.keys(row.expected).length).toBeGreaterThan(0);
	}

	if (row.expectedError !== undefined) {
		expect(isPlainObject(row.expectedError)).toBe(true);
		expect(row.expectedError.derivation).toEqual(jasmine.any(String));
	}
}

/**
 * Assert that the promoted analytic fixture uses the production citation shape.
 *
 * @returns {void}
 */
function expectAnalyticInvariantFixture() {
	const fixture = readProductionJson(analyticFixturePath);

	expect(fixture).toEqual(jasmine.objectContaining({
		kind: 'algorithm32-production-fixture-ledger',
		id: 'analytic-invariants',
		status: 'draft',
		sourcePath: 'scripts/flat/atmosphere_rejected/reference/stages/_tests/fixtures/analytic-invariants.json',
		rows: jasmine.any(Array),
	}));
	expect(fixture.rows.length).toBeGreaterThan(0);
	expect(fixture.rows.some((row) => row.id === 'phase.isotropic.constant-over-solid-angle')).toBe(true);
	expect(fixture.rows.some((row) => row.id === 'in-scattering.one-sample.scalar-product')).toBe(true);
	expect(fixture.rows.some((row) => row.id === 'surface.lambertian.white-direct-normal-equals-one')).toBe(true);

	for (const row of fixture.rows) {
		expectFixtureRow(row);
	}
}

/**
 * Assert that old app-spec-only citations were not promoted into production rows.
 *
 * @returns {void}
 */
function expectNoAppSpecOnlyReferences() {
	const fixture = readProductionJson(analyticFixturePath);
	const serializedRows = JSON.stringify(fixture.rows);

	expect(serializedRows).not.toContain('local-design-doc');
	expect(serializedRows).not.toContain('Reference Code Design');
	expect(serializedRows).not.toContain('Reference Stage Contracts');
	expect(serializedRows).not.toContain('stage_contracts.md');
	expect(serializedRows).not.toContain('code_design.md');
}

/**
 * Register fixture-shape specs.
 *
 * @returns {void}
 */
function registerFixtureSpecs() {
	it('keeps analytic invariant rows in the production fixture shape', expectAnalyticInvariantFixture);
	it('does not promote app-spec-only citations into production fixtures', expectNoAppSpecOnlyReferences);
}

describe('Algorithm32 production fixtures', registerFixtureSpecs);
