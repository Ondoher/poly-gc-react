import { readFileSync } from 'node:fs';

import { SpectralCalculator } from '../SpectralCalculator.js';

const analyticInvariants = JSON.parse(readFileSync(
	new URL('../../fixtures/analytic-invariants.json', import.meta.url),
	'utf8',
));

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

describe('SpectralCalculator', () => {
	it('builds endpoint/trapezoid path integration points', () => {
		const calculator = new SpectralCalculator();
		const points = calculator.buildEndpointTrapezoidPathIntegrationPoints({
			ray: {
				origin: [0, 0, 0],
				direction: [0, 0, 1],
			},
			startDistanceMeters: 2,
			endDistanceMeters: 10,
		}, 4);

		expect(points).toEqual([
			{ pointIndex: 0, distanceAlongRayMeters: 2, intervalLengthFromPreviousMeters: 0, trapezoidWeight: 0.5, measureMeters: 1 },
			{ pointIndex: 1, distanceAlongRayMeters: 4, intervalLengthFromPreviousMeters: 2, trapezoidWeight: 1, measureMeters: 2 },
			{ pointIndex: 2, distanceAlongRayMeters: 6, intervalLengthFromPreviousMeters: 2, trapezoidWeight: 1, measureMeters: 2 },
			{ pointIndex: 3, distanceAlongRayMeters: 8, intervalLengthFromPreviousMeters: 2, trapezoidWeight: 1, measureMeters: 2 },
			{ pointIndex: 4, distanceAlongRayMeters: 10, intervalLengthFromPreviousMeters: 2, trapezoidWeight: 0.5, measureMeters: 1 },
		]);
	});

	it('computes vacuum source transmittance from the analytic fixture', () => {
		const fixture = findAnalyticRow('transmittance.vacuum.finite-path');
		const calculator = new SpectralCalculator();

		// Source: analytic-invariants row transmittance.vacuum.finite-path; PBRT Transmittance. [1]
		const transmittance = calculator.computeSourceTransmittance([
			fixture.expected.opticalDepth.value,
		]);

		expect(transmittance).toEqual([fixture.expected.transmittance.value]);
	});

	it('computes multi-wavelength trapezoid segment transmittance from the analytic fixture', () => {
		const fixture = findAnalyticRow('transmittance.homogeneous.multi-wavelength');
		const calculator = new SpectralCalculator();
		const extinction = fixture.input.extinctionCoefficient.map((entry) => entry.value);

		// Source: analytic-invariants row transmittance.homogeneous.multi-wavelength; PBRT Transmittance and Volume Scattering Processes. [1][2]
		const transmittance = calculator.computeTrapezoidSegmentTransmittance(
			extinction,
			extinction,
			fixture.input.distance.value,
		);

		expectArrayCloseTo(
			transmittance,
			fixture.expected.transmittance.value,
			fixture.tolerance.transmittance.value,
		);
	});

	it('computes direct in-scattering from the one-sample analytic fixture', () => {
		const fixture = findAnalyticRow('in-scattering.one-sample.scalar-product');
		const calculator = new SpectralCalculator();
		const scattering = calculator.computeDirectScattering(
			[fixture.input.scatteringCoefficient.value],
			[0],
			fixture.input.phase.value,
			0,
		);

		// Source: analytic-invariants row in-scattering.one-sample.scalar-product; PBRT Volume Scattering Processes and Phase Functions. [2][3]
		const directInScattering = calculator.computeDirectInScattering(
			[fixture.input.viewTransmittance],
			[fixture.input.sourceTransmittance],
			[fixture.input.incidentSpectralRadiance],
			scattering,
			fixture.input.stepLength.value,
		);

		expectArrayCloseTo(
			directInScattering,
			[fixture.expected.spectralRadiance.value],
			fixture.tolerance.spectralRadiance.value,
		);
	});

	it('computes collapsed incident in-scattering from the one-sample analytic fixture', () => {
		const fixture = findAnalyticRow('in-scattering.incident-radiance.one-sample-product');
		const calculator = new SpectralCalculator();

		// Source: analytic-invariants row in-scattering.incident-radiance.one-sample-product; PBRT Volume Scattering Processes. [2]
		const incidentInScattering = calculator.computeCollapsedIncidentInScattering(
			[fixture.input.viewTransmittance],
			[fixture.input.incidentSpectralRadiance],
			[fixture.input.scatteringCoefficient.value],
			fixture.input.stepLength.value,
		);

		expectArrayCloseTo(
			incidentInScattering,
			[fixture.expected.spectralRadiance.value],
			fixture.tolerance.spectralRadiance.value,
		);
	});
});
