import {
	CANONICAL_STAGE_IDS,
	CpuSpectralReferenceIntegrator,
} from '../index.js';

export const STAGE_CONTRACTS = Object.freeze({
	// Reason: shared specs need one local mirror of the public stage registry contract.
	// Source: Reference Code Design, Canonical Pipeline Stages; Stage Contracts owns per-stage requires/provides.
	validateRequest: {
		requires: ['request'],
		provides: ['validatedRequest'],
		packet: { request: { ray: {} }, stageHistory: [] },
	},
	resolveRayPath: {
		requires: ['validatedRequest'],
		provides: ['rayPath'],
		packet: { validatedRequest: {}, stageHistory: [] },
	},
	sampleViewPath: {
		requires: ['validatedRequest', 'rayPath'],
		provides: ['viewSamples', 'viewSampleMetadata'],
		packet: {
			validatedRequest: { numerical: { viewSteps: 1 } },
			rayPath: {
				isEmpty: false,
				viewSegment: { startKm: 0, endKm: 1, lengthKm: 1 },
			},
			stageHistory: [],
		},
	},
	evaluateMedium: {
		requires: ['validatedRequest', 'viewSamples'],
		provides: ['mediumSamples'],
		packet: {
			validatedRequest: {
				model: createModelBundle(),
				observer: { positionKm: [0, 0, 0] },
				ray: { direction: [0, 1, 0] },
				wavelengthsNm: [550],
				numerical: {},
			},
			viewSamples: [],
			stageHistory: [],
		},
	},
	integrateViewOpticalDepth: {
		requires: ['validatedRequest', 'mediumSamples'],
		provides: ['viewOpticalDepth'],
		packet: {
			validatedRequest: { wavelengthsNm: [550] },
			mediumSamples: [],
			stageHistory: [],
		},
	},
	integrateSolarTransmittance: {
		requires: ['validatedRequest', 'mediumSamples', 'rayPath'],
		provides: ['solarTransmittance'],
		packet: {
			validatedRequest: {
				model: createModelBundle(),
				wavelengthsNm: [550],
				numerical: { sunTransmittanceSteps: 1 },
			},
			mediumSamples: [],
			rayPath: {
				isEmpty: true,
				viewSegment: { startKm: 0, endKm: 0, lengthKm: 0 },
				surfaceHit: null,
			},
			stageHistory: [],
		},
	},
	evaluateScatteringPhase: {
		requires: ['validatedRequest', 'mediumSamples', 'solarTransmittance'],
		provides: ['scatteringPhase'],
		packet: {
			validatedRequest: { ray: { direction: [0, 1, 0] }, wavelengthsNm: [550] },
			mediumSamples: [],
			solarTransmittance: { samples: [], metadata: { sampleCount: 0, sourceSampleCount: 0, includesSurfacePoint: false } },
			stageHistory: [],
		},
	},
	integrateSingleScattering: {
		requires: ['validatedRequest', 'mediumSamples', 'viewOpticalDepth', 'solarTransmittance', 'scatteringPhase'],
		provides: ['singleScattering'],
		packet: {
			validatedRequest: { wavelengthsNm: [550] },
			mediumSamples: [],
			viewOpticalDepth: {},
			solarTransmittance: { samples: [], metadata: { sampleCount: 0, sourceSampleCount: 0, includesSurfacePoint: false } },
			scatteringPhase: { samples: [], metadata: { convention: 'test' } },
			stageHistory: [],
		},
	},
	integrateDiffuseSkyAirlight: {
		requires: ['validatedRequest', 'viewOpticalDepth', 'solarTransmittance', 'singleScattering'],
		provides: ['diffuseSkyAirlight'],
		packet: {
			validatedRequest: { wavelengthsNm: [550], numerical: { diffuseSkyAirlightStrength: 0.02 } },
			viewOpticalDepth: {
				pathEnd: {
					cumulativeOpticalDepthByWavelength: [6],
					viewTransmittanceByWavelength: [0.0024787521766663585],
					speciesOpticalDepth: {
						mie: {
							cumulativeOpticalDepthByWavelength: [4],
						},
					},
				},
			},
			solarTransmittance: {
				samples: [
					{
						sampleIndex: 0,
						sourceSamples: [
							{
								sourceSampleIndex: 0,
								sourceSampleId: 'test-source',
								visible: true,
								sourceSpectrum: {
									kind: 'spectral-irradiance',
									valuesByWavelength: [1],
									units: 'W m-2 nm-1',
									derivation: 'test source',
								},
							},
						],
					},
				],
			},
			singleScattering: {
				inScatteredRadianceByWavelength: [0.1],
			},
			stageHistory: [],
		},
	},
	resolveSurfaceRadiance: {
		requires: ['validatedRequest', 'rayPath', 'viewOpticalDepth', 'solarTransmittance'],
		provides: ['surfaceRadiance'],
		packet: {
			validatedRequest: { model: {}, wavelengthsNm: [550] },
			rayPath: {
				isEmpty: true,
				viewSegment: { startKm: 0, endKm: 0, lengthKm: 0 },
				surfaceHit: null,
			},
			viewOpticalDepth: {},
			solarTransmittance: { samples: [], metadata: { sampleCount: 0, sourceSampleCount: 0, includesSurfacePoint: false } },
			stageHistory: [],
		},
	},
	composeSpectralRadiance: {
		requires: ['validatedRequest', 'singleScattering', 'surfaceRadiance'],
		provides: ['spectralRadiance'],
		packet: {
			validatedRequest: { wavelengthsNm: [550] },
			singleScattering: {},
			surfaceRadiance: {},
			stageHistory: [],
		},
	},
});

export const BASIC_TRACE_REQUEST = Object.freeze({
	// Reason: integration helpers need a minimal physically admissible request that exercises the public pipeline.
	// Source: Reference Code Design, Inputs; model, observer, ray, wavelengthsNm, and numerical controls form the request envelope.
	model: createModelBundle(),
	observer: { positionKm: [0, 0, 0] },
	ray: { direction: [0, 1, 0] },
	wavelengthsNm: [500],
	numerical: { viewSteps: 1 },
});

export const REQUIRED_MODEL_METHODS = Object.freeze({
	// Reason: tests validate model capability boundaries instead of branching on globe/flat model type.
	// Source: Reference Code Design, Model Interface.
	world: Object.freeze([
		'altitudeAt',
		'upAt',
		'intersectSurface',
		'surfaceNormalAt',
	]),
	atmosphere: Object.freeze([
		'intersect',
		'contains',
		'mediumAt',
		'densityAt',
		'extinctionAt',
		'scatteringAt',
	]),
	solarSource: Object.freeze(['samplesAt', 'transmittanceSegment']),
	surface: Object.freeze(['radianceAt']),
});

export function createModelBundle({
	geometryKind = 'globe',
	includeGeometryKind = true,
	id = `${geometryKind}-test-model`,
} = {}) {
	// Reason: shared model fixtures expose the minimum model-interface surface needed by implemented stages.
	// Source: Reference Code Design, Model Interface; physical constants are simple test defaults,
	// with Earth mean radius from IAU 2015 B3 and atmosphere top from the FAI/Karman-line convention.
	const model = {
		id,
		physicalConstants: {
			planetRadiusKm: geometryKind === 'globe' ? 6371.0088 : undefined,
			atmosphereTopKm: 100,
		},
		world: {
			altitudeAt() {
				return 0;
			},
			upAt() {
				return [0, 1, 0];
			},
			intersectSurface() {
				return null;
			},
			surfaceNormalAt() {
				return [0, 1, 0];
			},
		},
		atmosphere: {
			intersect() {
				return { tMinKm: 0, tMaxKm: 1 };
			},
			contains() {
				return true;
			},
			mediumAt(positionKm, { wavelengthsNm = [500] } = {}) {
				const zeroes = wavelengthsNm.map(() => 0);

				// Reason: the shared integration fixture is a composition scaffold, not an Earth model.
				// Source: Reference Code Design, evaluateMedium vacuum/zero coefficient output contract.
				return {
					coefficients: {
						extinctionByWavelength: [...zeroes],
						scatteringByWavelength: [...zeroes],
						absorptionByWavelength: [...zeroes],
					},
				};
			},
			densityAt() {
				return 1;
			},
			extinctionAt() {
				return [0];
			},
			scatteringAt() {
				return { rayleigh: [0], mie: [0] };
			},
		},
		solarSource: {
			samplesAt() {
				return [];
			},
			transmittanceSegment() {
				return { visible: true, samples: [] };
			},
		},
		surface: {
			radianceAt() {
				return [0];
			},
		},
	};

	if (includeGeometryKind) {
		// Reason: some tests prove implementations should rely on model methods rather than geometryKind.
		// Source: Reference Code Design, Model Interface; flat interface fixture omits this legacy tag.
		model.geometryKind = geometryKind;
	}

	return model;
}

export function createFlatInterfaceModelBundle() {
	// Reason: flat-model tests need a model that satisfies the interface without exposing a type tag.
	// Source: Reference Code Design, Model Interface.
	return createModelBundle({
		geometryKind: 'flat',
		includeGeometryKind: false,
		id: 'flat-interface-test-model',
	});
}

export function createValidTraceRequest(overrides = {}) {
	// Reason: validateRequest specs need a canonical valid input envelope with localized override hooks.
	// Source: Reference Test Design, validateRequest; defaults exercise ray normalization and spectral grid validation.
	return {
		model: overrides.model ?? createModelBundle(),
		observer: overrides.observer ?? { positionKm: [0, 0, 0] },
		ray: overrides.ray ?? { direction: [0, 2, 0] },
		wavelengthsNm: overrides.wavelengthsNm ?? [450, 550, 650],
		numerical: overrides.numerical ?? {
			viewSteps: 4,
			sunTransmittanceSteps: 2,
		},
		...overrides.extraFields,
	};
}

export function createReferenceIntegrator(options) {
	// Reason: shared specs should instantiate the same public integrator class that production callers use.
	// Source: Reference Code Design, Public API Shape.
	return new CpuSpectralReferenceIntegrator(options);
}

export function canonicalStageIds() {
	// Reason: callers receive a copy so tests cannot mutate the canonical registry list.
	// Source: Reference Code Design, Canonical Pipeline Stages.
	return [...CANONICAL_STAGE_IDS];
}

export function clonePacket(packet) {
	// Reason: stage-run helpers compare packet transforms without sharing mutable nested state.
	// Source: Reference Code Design, packet stage transform contract.
	return structuredClone(packet);
}

export function expectStageDescriptor(stageId) {
	const integrator = createReferenceIntegrator();
	const expected = STAGE_CONTRACTS[stageId];
	const stage = integrator.getStage(stageId);

	// Reason: stage descriptors are the public API for running and testing stages independently.
	// Source: Reference Code Design, Canonical Pipeline Stages; descriptors declare id/requires/provides.
	expect(stage.id).toBe(stageId);
	expect(stage.requires).toEqual(expected.requires);
	expect(stage.provides).toEqual(expected.provides);
	// Reason: descriptors now bind public stage ids to their helper class constructors.
	// Source: Reference Code Design, helper-class stage policy.
	expect(typeof stage.StageClass).toBe('function');
}

export function expectStagePrerequisiteFailure(stageId) {
	const integrator = createReferenceIntegrator();
	const [missingField] = STAGE_CONTRACTS[stageId].requires;

	// Reason: stages should fail loudly when called without declared prerequisites.
	// Source: Reference Code Design, Error Handling; missing packet fields are contract errors.
	expect(() => integrator.runStage(stageId, { stageHistory: [] })).toThrowError(
		new RegExp(`${stageId} requires ${missingField}`),
	);
}

export function manuallyRunUntil(integrator, stageId, request = BASIC_TRACE_REQUEST) {
	let packet = integrator.createInitialPacket(request);

	for (const candidateStageId of integrator.listStages()) {
		packet = integrator.runStage(candidateStageId, packet);
		if (candidateStageId === stageId) {
			return packet;
		}
	}

	// Reason: manual composition helper should fail when the test requests a non-canonical stage id.
	// Source: local test helper contract aligned with Reference Code Design stage ids.
	throw new Error(`Unknown test stage: ${stageId}`);
}
