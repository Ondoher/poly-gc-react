import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	expectExpectationValue,
	getAnalyticInvariantExpectation,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference ResolveSurfaceRadianceStage', function() {
	function runResolveSurfaceRadiance(packet = createSurfacePacket()) {
		return createReferenceIntegrator().runStage('resolveSurfaceRadiance', packet);
	}

	function createSurfacePacket({ albedo = 1, viewTransmittance = 1 } = {}) {
		const surfaceHit = {
			distanceKm: 10,
			positionKm: [0, 0, 10],
			normal: [0, 0, -1],
			boundaryReason: 'fixture-surface',
		};

		return {
			validatedRequest: {
				model: {
					world: {
						surfaceNormalAt() {
							return [0, 0, -1];
						},
					},
					surface: {
						radianceAt(hit, wavelengthNm, lighting) {
							const direct = lighting.directIrradianceByWavelength[0];
							const cosine = lighting.directCosTheta;
							return [albedo * direct * cosine / Math.PI];
						},
					},
				},
				wavelengthsNm: [550],
			},
			rayPath: {
				isEmpty: false,
				viewSegment: { startKm: 0, endKm: 10, lengthKm: 10 },
				surfaceHit,
			},
			viewOpticalDepth: {
				pathEnd: {
					viewTransmittanceByWavelength: [viewTransmittance],
				},
			},
			solarTransmittance: {
				surfacePoint: {
					distanceFromObserverKm: 10,
					positionKm: [0, 0, 10],
					surfaceHit,
					sourceSamples: [
						{
							sourceSampleIndex: 0,
							sourceSampleId: 'normal-source',
							direction: [0, 0, -1],
							sourceTransmittanceByWavelength: [1],
							sourceSpectrum: {
								kind: 'spectral-irradiance',
								valuesByWavelength: [Math.PI],
								units: 'fixture irradiance units',
								derivation: 'Lambertian fixture E = pi',
							},
						},
					],
				},
				samples: [],
				metadata: { sampleCount: 0, sourceSampleCount: 1, includesSurfacePoint: true },
			},
			stageHistory: [],
		};
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; descriptors declare ids, prerequisites, and provides.
		expectStageDescriptor('resolveSurfaceRadiance');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const packet = createSurfacePacket();
		const result = runResolveSurfaceRadiance(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['resolveSurfaceRadiance']);
		expect(packet.surfaceRadiance).toBeUndefined();
		expect(result.surfaceRadiance).toEqual(jasmine.any(Object));
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('resolveSurfaceRadiance');
	});

	it('resolves black Lambertian direct-normal radiance', function() {
		const expectation = getAnalyticInvariantExpectation(
			'surface.lambertian.black-direct-normal',
		);

		const result = runResolveSurfaceRadiance(createSurfacePacket({ albedo: 0 }));

		// Reason: the fixture pins the black Lambertian closed form.
		// Source: analytic-invariants row surface.lambertian.black-direct-normal.
		expectExpectationValue(
			result.surfaceRadiance.surfaceLeavingRadianceByWavelength[0],
			expectation,
			'surfaceLeavingRadiance',
		);
		expectExpectationValue(
			result.surfaceRadiance.viewAttenuatedRadianceByWavelength[0],
			expectation,
			'cameraVisibleSurfaceRadiance',
		);
	});

	it('resolves white Lambertian direct-normal radiance', function() {
		const expectation = getAnalyticInvariantExpectation(
			'surface.lambertian.white-direct-normal-equals-one',
		);

		const result = runResolveSurfaceRadiance();

		// Reason: the fixture pins the white Lambertian E/pi normalization case.
		// Source: analytic-invariants row surface.lambertian.white-direct-normal-equals-one.
		expectExpectationValue(
			result.surfaceRadiance.surfaceLeavingRadianceByWavelength[0],
			expectation,
			'surfaceLeavingRadiance',
		);
		expectExpectationValue(
			result.surfaceRadiance.viewAttenuatedRadianceByWavelength[0],
			expectation,
			'cameraVisibleSurfaceRadiance',
		);
	});

	it('returns zero surface radiance when the ray has no surface hit', function() {
		const packet = createSurfacePacket();
		packet.rayPath.surfaceHit = null;
		packet.solarTransmittance.surfacePoint = undefined;
		packet.solarTransmittance.metadata.includesSurfacePoint = false;

		const result = runResolveSurfaceRadiance(packet);

		// Reason: no selected visible surface hit means there is no surface contribution to compose.
		// Source: Stage Contracts, resolveSurfaceRadiance no-hit output shape.
		expect(result.surfaceRadiance.hit).toBeNull();
		expect(result.surfaceRadiance.viewAttenuatedRadianceByWavelength).toEqual([0]);
	});
});
