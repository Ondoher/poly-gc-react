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
