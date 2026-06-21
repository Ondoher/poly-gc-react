import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	expectExpectationValue,
	getAnalyticInvariantExpectation,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference IntegrateSingleScatteringStage', function() {
	function runIntegrateSingleScattering(packet = createSingleScatteringPacket()) {
		return createReferenceIntegrator().runStage('integrateSingleScattering', packet);
	}

	function createSingleScatteringPacket() {
		return {
			validatedRequest: { wavelengthsNm: [550] },
			mediumSamples: [
				{
					sampleIndex: 0,
					weightKm: 2,
					species: [
						{
							name: 'rayleigh',
							scatteringByWavelength: [0.2],
						},
					],
				},
			],
			viewOpticalDepth: {
				samples: [
					{
						sampleIndex: 0,
						viewTransmittanceByWavelength: [0.5],
					},
				],
			},
			solarTransmittance: {
				samples: [
					{
						sampleIndex: 0,
						sourceSamples: [
							{
								sourceSampleIndex: 0,
								sourceSampleId: 'fixture-source',
								weight: 1,
								sourceTransmittanceByWavelength: [0.8],
								sourceSpectrum: {
									kind: 'spectral-irradiance',
									valuesByWavelength: [4],
									units: 'fixture radiance units',
									derivation: 'analytic scalar product fixture',
								},
							},
						],
					},
				],
				metadata: {
					sampleCount: 1,
					sourceSampleCount: 1,
					includesSurfacePoint: false,
				},
			},
			scatteringPhase: {
				samples: [
					{
						sampleIndex: 0,
						sourceSamples: [
							{
								sourceSampleIndex: 0,
								sourceSampleId: 'fixture-source',
								species: [
									{
										name: 'rayleigh',
										phaseKind: 'fixture',
										parameters: {},
										phaseByWavelength: [0.25],
									},
								],
							},
						],
					},
				],
				metadata: { convention: 'fixture' },
			},
			stageHistory: [],
		};
	}

	function replaceSourceSamples(packet, sourceSamples) {
		packet.solarTransmittance.samples[0].sourceSamples = sourceSamples.map((sourceSample) => ({
			sourceSampleIndex: sourceSample.sourceSampleIndex,
			sourceSampleId: sourceSample.sourceSampleId,
			weight: sourceSample.weight,
			sourceTransmittanceByWavelength: [0.8],
			sourceSpectrum: {
				kind: 'spectral-irradiance',
				valuesByWavelength: [4],
				units: 'fixture radiance units',
				derivation: 'analytic weighted source quadrature fixture',
			},
		}));
		packet.scatteringPhase.samples[0].sourceSamples = sourceSamples.map((sourceSample) => ({
			sourceSampleIndex: sourceSample.sourceSampleIndex,
			sourceSampleId: sourceSample.sourceSampleId,
			species: [
				{
					name: 'rayleigh',
					phaseKind: 'fixture',
					parameters: {},
					phaseByWavelength: [sourceSample.phaseSrInverse ?? 0.25],
				},
			],
		}));
		packet.solarTransmittance.metadata.sourceSampleCount = sourceSamples.length;
	}

	function sourceWeightErrorRegex(expectation) {
		return new RegExp(expectation.expectedError.messageIncludes
			.map((messagePart) => messagePart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('.*'));
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; descriptors declare ids, prerequisites, and provides.
		expectStageDescriptor('integrateSingleScattering');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const packet = createSingleScatteringPacket();
		const result = runIntegrateSingleScattering(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['integrateSingleScattering']);
		expect(packet.singleScattering).toBeUndefined();
		expect(result.singleScattering).toEqual(jasmine.any(Object));
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('integrateSingleScattering');
	});

	it('integrates one single-scattering sample as the sourced scalar product', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.one-sample.scalar-product',
		);

		const result = runIntegrateSingleScattering();

		// Reason: the fixture pins the one-sample PBRT in-scattering specialization.
		// Source: analytic-invariants row single-scattering.one-sample.scalar-product.
		expectExpectationValue(
			result.singleScattering.inScatteredRadianceByWavelength[0],
			expectation,
			'spectralRadiance',
		);
		expect(result.singleScattering.components.bySpecies.rayleigh.radianceByWavelength[0])
			.toBeCloseTo(0.16, 12);
	});

	it('applies source quadrature weights to split source samples', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.source-weight.two-half-samples',
		);
		const packet = createSingleScatteringPacket();

		replaceSourceSamples(packet, [
			{ sourceSampleIndex: 0, sourceSampleId: 'half-source-a', weight: 0.5 },
			{ sourceSampleIndex: 1, sourceSampleId: 'half-source-b', weight: 0.5 },
		]);
		const result = runIntegrateSingleScattering(packet);

		// Reason: finite-source quadrature represents one source integral as weighted samples.
		// Source: analytic-invariants row single-scattering.source-weight.two-half-samples.
		expectExpectationValue(
			result.singleScattering.inScatteredRadianceByWavelength[0],
			expectation,
			'spectralRadiance',
		);
	});

	it('ignores zero-weight source samples during accumulation', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.source-weight.zero-extra-sample',
		);
		const packet = createSingleScatteringPacket();

		replaceSourceSamples(packet, [
			{ sourceSampleIndex: 0, sourceSampleId: 'weighted-source', weight: 1 },
			{ sourceSampleIndex: 1, sourceSampleId: 'zero-source', weight: 0 },
		]);
		const result = runIntegrateSingleScattering(packet);

		// Reason: a zero-weight source sample has no measure in the source quadrature.
		// Source: analytic-invariants row single-scattering.source-weight.zero-extra-sample.
		expectExpectationValue(
			result.singleScattering.inScatteredRadianceByWavelength[0],
			expectation,
			'spectralRadiance',
		);
	});

	it('sums differently angled source samples by source weight', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.source-weight.weighted-phase-sum',
		);
		const packet = createSingleScatteringPacket();

		replaceSourceSamples(packet, [
			{
				sourceSampleIndex: 0,
				sourceSampleId: 'low-phase-source',
				weight: 0.25,
				phaseSrInverse: 0.25,
			},
			{
				sourceSampleIndex: 1,
				sourceSampleId: 'high-phase-source',
				weight: 0.75,
				phaseSrInverse: 0.5,
			},
		]);
		const result = runIntegrateSingleScattering(packet);

		// Reason: the source-direction integral is linear in each source's phase and quadrature weight.
		// Source: analytic-invariants row single-scattering.source-weight.weighted-phase-sum.
		expectExpectationValue(
			result.singleScattering.inScatteredRadianceByWavelength[0],
			expectation,
			'spectralRadiance',
		);
	});

	it('rejects missing source quadrature weights', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.source-weight.missing-rejects',
		);
		const packet = createSingleScatteringPacket();

		delete packet.solarTransmittance.samples[0].sourceSamples[0].weight;

		// Reason: source weights are now required transport multipliers, not optional metadata.
		// Source: analytic-invariants row single-scattering.source-weight.missing-rejects.
		expect(() => runIntegrateSingleScattering(packet))
			.toThrowError(RangeError, sourceWeightErrorRegex(expectation));
	});

	it('rejects invalid source quadrature weights', function() {
		const expectation = getAnalyticInvariantExpectation(
			'single-scattering.source-weight.invalid-rejects',
		);
		const expectedMessage = sourceWeightErrorRegex(expectation);

		for (const invalidWeight of [-0.5, Infinity]) {
			const packet = createSingleScatteringPacket();
			packet.solarTransmittance.samples[0].sourceSamples[0].weight = invalidWeight;

			// Reason: source quadrature measure cannot be negative or non-finite.
			// Source: analytic-invariants row single-scattering.source-weight.invalid-rejects.
			expect(() => runIntegrateSingleScattering(packet))
				.withContext(`source weight ${invalidWeight}`)
				.toThrowError(RangeError, expectedMessage);
		}
	});

	it('returns explicit zero output for an empty medium path', function() {
		const result = runIntegrateSingleScattering({
			validatedRequest: { wavelengthsNm: [550] },
			mediumSamples: [],
			viewOpticalDepth: { samples: [] },
			solarTransmittance: {
				samples: [],
				metadata: { sampleCount: 0, sourceSampleCount: 0, includesSurfacePoint: false },
			},
			scatteringPhase: { samples: [], metadata: { convention: 'fixture' } },
			stageHistory: [],
		});

		// Reason: no medium samples means no in-scattering events along the view path.
		// Source: Stage Contracts, integrateSingleScattering consumes mediumSamples.
		expect(result.singleScattering.samples).toEqual([]);
		expect(result.singleScattering.inScatteredRadianceByWavelength).toEqual([0]);
	});

	it('rejects negative source terms before accumulation', function() {
		const packet = createSingleScatteringPacket();
		packet.solarTransmittance.samples[0].sourceSamples[0].sourceSpectrum.valuesByWavelength = [-1];

		// Reason: physical radiance and irradiance terms are nonnegative; this stage should not repair them by clamping.
		// Source: Stage Contracts, compose/single-scattering nonnegative component policy.
		expect(() => runIntegrateSingleScattering(packet))
			.toThrowError(/integrateSingleScattering.*sourceSpectrum/);
	});
});
