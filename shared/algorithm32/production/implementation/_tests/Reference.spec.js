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
	it('keeps the CPU/reference orchestration surface documented', () => {
		const source = readReferenceSource();
		const localTypes = readImplementationTypes();

		// Reason: Reference remains the top-level CPU/reference boundary while SpectralCalculator owns reusable radiance math.
		// Source: Algorithm32 Production Implementation Plan, Milestone 3.
		expect(source).toContain('export class Reference');
		expect(source).toContain('constructor(dependencies)');
		expect(source).toContain('get model()');
		expect(source).toContain('get calculator()');
		expect(source).toContain('evaluate(request = {})');
		expect(source).toContain('resolveViewRaySegment');
		expect(source).toContain('buildEndpointTrapezoidPathIntegrationPoints');
		expect(source).toContain('computeRadiance');
		expect(source).toContain('_resolveIncidentRadianceSampling');
		expect(source).not.toContain('resolveRayDistance');
		expect(source).not.toContain('_sampleIncidentRadiance');
		expect(localTypes).toContain('type ReferenceDependencies');
		expect(localTypes).toContain('type SpectralCalculatorDependencies');
		expect(localTypes).toContain('type PathIntegrationPoint');
		expect(localTypes).toContain('type PathRadiance');
	});

	it('delegates evaluation through geometry, path integration, and calculator radiance', () => {
		const viewRaySegment = {
			ray: {
				origin: [0, 0, 0],
				direction: [0, 0, 1],
			},
			startDistanceMeters: 0,
			endDistanceMeters: 10,
		};
		const pathIntegrationPoints = Object.freeze([{ pointIndex: 0 }]);
		const incidentRadianceSampling = {
			cacheDescriptor: { cacheKind: 'none', sourceKey: 'test', version: 1 },
			incidentRadianceSampler: () => [],
		};
		const geometry = {
			resolveViewRaySegment: jasmine.createSpy('resolveViewRaySegment').and.returnValue(viewRaySegment),
		};
		const calculator = {
			buildEndpointTrapezoidPathIntegrationPoints: jasmine.createSpy('buildEndpointTrapezoidPathIntegrationPoints')
				.and.returnValue(pathIntegrationPoints),
			computeRadiance: jasmine.createSpy('computeRadiance').and.returnValue({
				inScattered: [0.25],
				transmittance: [0.75],
			}),
		};
		const reference = new Reference({
			model: { geometry },
			calculator,
			executionControls: { pathIntervalCount: 4 },
			incidentRadianceSampling,
		});

		const result = reference.evaluate({ viewRayRequest: { id: 'ray' } });

		expect(geometry.resolveViewRaySegment).toHaveBeenCalledWith({ id: 'ray' });
		expect(calculator.buildEndpointTrapezoidPathIntegrationPoints).toHaveBeenCalledWith(viewRaySegment, 4);
		expect(calculator.computeRadiance).toHaveBeenCalledWith(
			viewRaySegment,
			pathIntegrationPoints,
			{ incidentRadianceSampling },
		);
		expect(result).toEqual({
			pathRadiance: [0.25],
			transmittance: [0.75],
			viewRaySegment,
			pathIntegrationPoints,
		});
	});

	it('lets an explicit null request disable the configured incident sampler', () => {
		const defaultIncidentRadianceSampling = {
			cacheDescriptor: { cacheKind: 'local', sourceKey: 'configured', version: 1 },
			incidentRadianceSampler: () => [],
		};
		const calculator = {
			buildEndpointTrapezoidPathIntegrationPoints: () => [],
			computeRadiance: jasmine.createSpy('computeRadiance').and.returnValue({
				inScattered: [0],
				transmittance: [1],
			}),
		};
		const reference = new Reference({
			model: {
				geometry: {
					resolveViewRaySegment: () => ({
						ray: { origin: [0, 0, 0], direction: [0, 0, 1] },
						startDistanceMeters: 0,
						endDistanceMeters: 0,
					}),
				},
			},
			calculator,
			incidentRadianceSampling: defaultIncidentRadianceSampling,
		});

		reference.evaluate({ incidentRadianceSampling: null });

		expect(calculator.computeRadiance.calls.mostRecent().args[2]).toEqual({
			incidentRadianceSampling: null,
		});
	});
});
