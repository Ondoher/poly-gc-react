import { readFileSync } from 'node:fs';

import { Reference } from '../Reference.js';

const analyticInvariants = JSON.parse(readFileSync(
	new URL('../../fixtures/analytic-invariants.json', import.meta.url),
	'utf8',
));

/**
 * Read the Reference implementation source.
 *
 * @returns {string} The Reference source text.
 */
function readReferenceSource() {
	return readFileSync(new URL('../Reference.js', import.meta.url), 'utf8');
}

/**
 * Read the implementation-local ambient type source.
 *
 * @returns {string} The implementation type source text.
 */
function readImplementationTypes() {
	return readFileSync(new URL('../types.d.ts', import.meta.url), 'utf8');
}

/**
 * Find one analytic fixture row by stable id.
 *
 * @param {string} id - Identifies the fixture row.
 * @returns {ProductionFixtureRow} The matching fixture row.
 */
function findAnalyticRow(id) {
	const row = analyticInvariants.rows.find((candidate) => candidate.id === id);

	if (!row) {
		throw new Error(`Missing analytic fixture row: ${id}`);
	}

	return row;
}

/**
 * Assert that numeric arrays match within an absolute tolerance.
 *
 * @param {readonly number[]} actual - Supplies the actual numeric values.
 * @param {readonly number[]} expected - Supplies the expected numeric values.
 * @param {number} tolerance - Supplies the accepted absolute tolerance.
 * @returns {void}
 */
function expectArrayCloseTo(actual, expected, tolerance) {
	expect(actual.length).toBe(expected.length);

	for (const [index, expectedValue] of expected.entries()) {
		expect(Math.abs(actual[index] - expectedValue)).toBeLessThanOrEqual(tolerance);
	}
}

describe('Reference', () => {
	let reference;

	beforeEach(() => {
		reference = new Reference({
			model: {},
		});
	});

	it('keeps the CPU/reference algorithm execution skeleton documented', () => {
		const source = readReferenceSource();
		const localTypes = readImplementationTypes();

		// Reason: each production class keeps its own local class-named spec file.
		// Source: Algorithm32 production test placement convention, 2026-06-28.
		expect(source).toContain('export class Reference');
		expect(source).toContain('constructor(dependencies)');
		expect(source).toContain('get model()');
		expect(source).toContain('evaluate(request)');
		expect(source).toContain('optical-depth and Beer-Lambert transmittance');
		expect(source).toContain('light-source incident radiance adds the higher-order');
		expect(source).toContain('sourceTransmittance');
		expect(source).toContain('incidentRadianceSample');
		expect(source).toContain('directInScattering');
		expect(source).toContain('incidentInScattering');
		expect(source).toContain('segmentTransmittance');
		expect(source).toContain('nextTransportState');
		expect(source).toContain('this._integratePathSample');
		expect(source).toContain('this._sampleIncidentRadiance');
		expect(source).toContain('this._computeIncidentInScattering');
		expect(source).not.toContain('_incidentRadianceCache');
		expect(source).not.toContain('incidentRadianceCache');
		expect(source).toContain('term. [1][2]');
		expect(source).toContain('source. [1]');
		expect(source).toContain('view path. [2]');
		expect(source).toContain('term. [2]');
		expect(source).toContain('@param {ReferenceDependencies} dependencies -');
		expect(source).toContain('@returns {EvaluationResult} The spectral evaluation result.');
		expect(localTypes).toContain('type ReferenceDependencies');
		expect(localTypes).toContain('type PathSample');
		expect(localTypes).toContain('type TransportState');
		expect(localTypes).not.toContain('type IncidentRadianceCache');
	});

	it('creates an initial transport state from channel count bookkeeping', () => {
		const transportState = reference._createTransportState(4);

		expect(transportState).toEqual({
			radiance: [0, 0, 0, 0],
			transmittance: [1, 1, 1, 1],
		});
	});

	it('creates a public evaluation result snapshot from transport state', () => {
		const transportState = {
			radiance: [0.1, 0.2, 0.3],
			transmittance: [0.9, 0.8, 0.7],
		};

		const result = reference._createEvaluationResult(transportState);

		expect(result).toEqual({
			pathRadiance: [0.1, 0.2, 0.3],
			transmittance: [0.9, 0.8, 0.7],
		});
		expect(result.pathRadiance).not.toBe(transportState.radiance);
		expect(result.transmittance).not.toBe(transportState.transmittance);
	});

	it('computes vacuum segment transmittance from the analytic fixture', () => {
		const fixture = findAnalyticRow('transmittance.vacuum.finite-path');
		const mediumSample = {
			extinctionCoefficient: fixture.input.extinctionCoefficient.map((entry) => entry.value),
			scatteringCoefficient: [0],
			absorptionCoefficient: [0],
			density: 0,
		};
		const spectral = { channelCount: 1 };

		// Source: analytic-invariants row transmittance.vacuum.finite-path; PBRT Transmittance. [1]
		const transmittance = reference._computeSegmentTransmittance(
			mediumSample,
			fixture.input.distance.value,
			spectral,
		);

		expect(transmittance).toEqual([fixture.expected.transmittance.value]);
	});

	it('computes multi-wavelength Beer-Lambert segment transmittance from the analytic fixture', () => {
		const fixture = findAnalyticRow('transmittance.homogeneous.multi-wavelength');
		const mediumSample = {
			extinctionCoefficient: fixture.input.extinctionCoefficient.map((entry) => entry.value),
			scatteringCoefficient: [0, 0],
			absorptionCoefficient: [0, 0],
			density: 1,
		};
		const spectral = { channelCount: 2 };

		// Source: analytic-invariants row transmittance.homogeneous.multi-wavelength; PBRT Transmittance and Volume Scattering Processes. [1][2]
		const transmittance = reference._computeSegmentTransmittance(
			mediumSample,
			fixture.input.distance.value,
			spectral,
		);

		expectArrayCloseTo(
			transmittance,
			fixture.expected.transmittance.value,
			fixture.tolerance.transmittance.value,
		);
	});

	it('computes direct in-scattering from the one-sample analytic fixture', () => {
		const fixture = findAnalyticRow('in-scattering.one-sample.scalar-product');
		const mediumSample = {
			extinctionCoefficient: [0],
			scatteringCoefficient: [fixture.input.scatteringCoefficient.value],
			absorptionCoefficient: [0],
			density: 1,
		};
		const phaseSample = { value: fixture.input.phase.value };
		const radianceSample = {
			spectralRadiance: [fixture.input.incidentSpectralRadiance],
		};
		const sourceTransmittance = [fixture.input.sourceTransmittance];
		const viewTransmittance = [fixture.input.viewTransmittance];

		// Source: analytic-invariants row in-scattering.one-sample.scalar-product; PBRT Volume Scattering Processes and Phase Functions. [2][3]
		const directInScattering = reference._computeDirectInScattering(
			mediumSample,
			phaseSample,
			radianceSample,
			sourceTransmittance,
			viewTransmittance,
			fixture.input.stepLength.value,
		);

		expect(directInScattering).toEqual(jasmine.any(Array));

		if (Array.isArray(directInScattering)) {
			expectArrayCloseTo(
				directInScattering,
				[fixture.expected.spectralRadiance.value],
				fixture.tolerance.spectralRadiance.value,
			);
		}
	});

	it('computes incident in-scattering from the one-sample analytic fixture', () => {
		const fixture = findAnalyticRow('in-scattering.incident-radiance.one-sample-product');
		const mediumSample = {
			extinctionCoefficient: [0],
			scatteringCoefficient: [fixture.input.scatteringCoefficient.value],
			absorptionCoefficient: [0],
			density: 1,
		};
		const incidentRadianceSample = {
			spectralRadiance: [fixture.input.incidentSpectralRadiance],
		};
		const viewTransmittance = [fixture.input.viewTransmittance];
		const spectral = { channelCount: 1 };

		// Source: analytic-invariants row in-scattering.incident-radiance.one-sample-product; PBRT Volume Scattering Processes. [2]
		const incidentInScattering = reference._computeIncidentInScattering(
			mediumSample,
			incidentRadianceSample,
			viewTransmittance,
			fixture.input.stepLength.value,
			spectral,
		);

		expect(incidentInScattering).toEqual(jasmine.any(Array));

		if (Array.isArray(incidentInScattering)) {
			expectArrayCloseTo(
				incidentInScattering,
				[fixture.expected.spectralRadiance.value],
				fixture.tolerance.spectralRadiance.value,
			);
		}
	});

	it('integrates one path sample as a pure transport state transition', () => {
		const fixture = findAnalyticRow('transmittance.split-path.multiplicative');
		const initialState = {
			radiance: [0.25],
			transmittance: [fixture.expected.segmentTransmittance.value[0]],
		};
		const directInScattering = [0.1];
		const incidentInScattering = [0.2];
		const segmentTransmittance = [fixture.expected.segmentTransmittance.value[1]];

		// Source: analytic-invariants row transmittance.split-path.multiplicative; PBRT Transmittance. [1]
		const nextState = reference._integratePathSample(
			initialState,
			directInScattering,
			incidentInScattering,
			segmentTransmittance,
		);

		expect(nextState).toEqual({
			radiance: [0.55],
			transmittance: [fixture.expected.totalTransmittance.value],
		});

		if (nextState) {
			expect(nextState).not.toBe(initialState);
			expect(nextState.radiance).not.toBe(initialState.radiance);
			expect(nextState.transmittance).not.toBe(initialState.transmittance);
		}
	});
});
