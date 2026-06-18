import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	expectExpectationValue,
	getAnalyticInvariantExpectation,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference EvaluateScatteringPhaseStage', function() {
	function runEvaluateScatteringPhase(packet = createScatteringPhasePacket()) {
		return createReferenceIntegrator().runStage('evaluateScatteringPhase', packet);
	}

	function createScatteringPhasePacket({
		phaseKind = 'isotropic',
		phaseParameters = {},
		rayDirection = [0, 0, 1],
		sourceDirections = [
			[0, 0, 1],
			[1, 0, 0],
			[0, 0, -1],
		],
	} = {}) {
		return {
			validatedRequest: {
				ray: { direction: rayDirection },
				wavelengthsNm: [550],
			},
			mediumSamples: [
				{
					sampleIndex: 0,
					species: [
						{
							name: 'test-isotropic',
							phase: { kind: phaseKind, parameters: phaseParameters },
							scatteringByWavelength: [0.1],
							extinctionByWavelength: [0.1],
							absorptionByWavelength: [0],
							derivation: 'test-species',
						},
					],
				},
			],
			solarTransmittance: {
				samples: [
					{
						sampleIndex: 0,
						sourceSamples: sourceDirections.map((direction, sourceSampleIndex) => ({
							sourceSampleIndex,
							sourceSampleId: `source-${sourceSampleIndex}`,
							direction,
							visible: true,
							sourceTransmittanceByWavelength: [1],
							sourceSpectrum: {
								kind: 'spectral-radiance',
								valuesByWavelength: [1],
								units: 'fixture radiance units',
								derivation: 'test source spectrum',
							},
						})),
					},
				],
				metadata: {
					sampleCount: 1,
					sourceSampleCount: sourceDirections.length,
					includesSurfacePoint: false,
				},
			},
			stageHistory: [],
		};
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; descriptors declare ids, prerequisites, and provides.
		expectStageDescriptor('evaluateScatteringPhase');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const packet = createScatteringPhasePacket();
		const result = runEvaluateScatteringPhase(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['evaluateScatteringPhase']);
		expect(packet.scatteringPhase).toBeUndefined();
		// Reason: downstream single-scattering consumes a real phase packet, not placeholder data.
		// Source: Stage Contracts, evaluateScatteringPhase output shape.
		expect(result.scatteringPhase).toEqual(jasmine.any(Object));
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('evaluateScatteringPhase');
	});

	it('evaluates isotropic phase values independent of scattering angle', function() {
		const expectation = getAnalyticInvariantExpectation(
			'phase.isotropic.constant-over-solid-angle',
		);

		const result = runEvaluateScatteringPhase();
		const sourceSamples = result.scatteringPhase.samples[0].sourceSamples;

		// Reason: the fixture pins the normalized isotropic phase value.
		// Source: analytic-invariants row phase.isotropic.constant-over-solid-angle.
		for (const sourceSample of sourceSamples) {
			expectExpectationValue(
				sourceSample.species[0].phaseByWavelength[0],
				expectation,
				'phaseSrInverse',
			);
		}
	});

	it('evaluates Rayleigh phase with the expected symmetric angular shape', function() {
		const result = runEvaluateScatteringPhase(createScatteringPhasePacket({
			phaseKind: 'rayleigh',
		}));
		const sourceSamples = result.scatteringPhase.samples[0].sourceSamples;

		// Reason: the normalized Rayleigh phase is 3/(16*pi)*(1+cos^2 theta), so
		// forward/backward are symmetric and side scattering is half that value.
		// Source: Reference Test Plan, Rayleigh phase formula and normalization.
		expect(sourceSamples[0].species[0].phaseByWavelength[0])
			.toBeCloseTo(3 / (8 * Math.PI), 12);
		expect(sourceSamples[1].species[0].phaseByWavelength[0])
			.toBeCloseTo(3 / (16 * Math.PI), 12);
		expect(sourceSamples[2].species[0].phaseByWavelength[0])
			.toBeCloseTo(3 / (8 * Math.PI), 12);
	});

	it('evaluates positive-g Henyey-Greenstein as forward aerosol scattering', function() {
		const result = runEvaluateScatteringPhase(createScatteringPhasePacket({
			phaseKind: 'henyey-greenstein',
			phaseParameters: { g: 0.8 },
		}));
		const phaseValues = result.scatteringPhase.samples[0].sourceSamples
			.map((sourceSample) => sourceSample.species[0].phaseByWavelength[0]);

		// Reason: with this stage's source-to-camera convention, the source sample
		// with cosTheta -1 is the physically forward aerosol-scattering direction.
		// Source: Reference Test Plan, Henyey-Greenstein/Mie phase formula.
		expect(phaseValues[0]).toBeGreaterThan(phaseValues[1]);
		expect(phaseValues[1]).toBeGreaterThan(phaseValues[2]);
	});

	it('records the local scattering-angle convention for source samples', function() {
		const result = runEvaluateScatteringPhase();
		const sourceSamples = result.scatteringPhase.samples[0].sourceSamples;

		// Reason: phase diagnostics must make the local sign convention explicit.
		// Source: Stage Contracts, evaluateScatteringPhase ownership; cosTheta is
		// dot(sourceDirectionFromSample, directionFromSampleToCamera).
		expect(sourceSamples.map((sourceSample) => sourceSample.cosTheta))
			.toEqual([-1, 0, 1]);
		expect(sourceSamples.map((sourceSample) => sourceSample.scatteringAngleRad))
			.toEqual([Math.PI, Math.PI / 2, 0]);
		expect(result.scatteringPhase.metadata.convention)
			.toContain('directionFromSampleToCamera');
	});

	it('returns explicit empty phase samples when no medium samples are present', function() {
		const result = runEvaluateScatteringPhase({
			validatedRequest: {
				ray: { direction: [0, 0, 1] },
				wavelengthsNm: [550],
			},
			mediumSamples: [],
			solarTransmittance: {
				samples: [],
				metadata: {
					sampleCount: 0,
					sourceSampleCount: 0,
					includesSurfacePoint: false,
				},
			},
			stageHistory: [],
		});

		// Reason: no medium sample means no scattering event where a phase term applies.
		// Source: Stage Contracts, evaluateScatteringPhase output shape; phase samples align to medium samples.
		expect(result.scatteringPhase.samples).toEqual([]);
		expect(result.scatteringPhase.metadata.sampleCount).toBe(0);
		expect(result.scatteringPhase.metadata.sourceSampleCount).toBe(0);
	});

	it('rejects unsupported phase kinds instead of inventing parameters', function() {
		// Reason: phase-function parameters are model-owned, and this stage only owns implemented phase formulas.
		// Source: Stage Contracts, evaluateScatteringPhase ownership; unsupported phase kinds should fail loudly.
		expect(() => runEvaluateScatteringPhase(createScatteringPhasePacket({
			phaseKind: 'unknown-phase',
		}))).toThrowError(/evaluateScatteringPhase.*unknown-phase/);
	});
});
