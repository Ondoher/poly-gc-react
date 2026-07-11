import { RUNTIME_NUMERICAL_CONTROLS } from '../constants/Algorithm32CanonicalData.js';

const MAIN_SYMBOLS = Object.freeze([
	'runtime.initialState',
	'geometry.reconstructViewRay',
	'geometry.resolveAtmospherePath',
	'atmosphere.sampleMedium',
	'light.sampleDirectRadiance',
	'cache.lookupIncidentRadiance',
	'transport.evaluatePathRadiance',
	'color.composeSceneColor',
	'color.encodeOutput',
]);

/**
 * Implement the core Algorithm32 transport shader contribution for a descriptor.
 */
export class Algorithm32Transport {
	/**
	 * Return symbols needed by the complete Algorithm32 shader main path.
	 *
	 * @returns {readonly string[]} Return required shader symbols.
	 */
	mainRequiredShaderSymbols() {
		return MAIN_SYMBOLS;
	}

	/**
	 * Create the transport-owned shader contribution for the active geometry.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the transport contribution.
	 */
	createShaderContribution(request) {
		const descriptor = request?.descriptor;
		const geometryKind = descriptor?.geometry?.facts?.kind;

		if (geometryKind === 'flat-earth-geometry') {
			return this._createLocalFlatShaderContribution(descriptor);
		}

		if (geometryKind === 'spherical-earth-geometry') {
			return this._createDistantSphericalShaderContribution(descriptor);
		}

		throw new TypeError(`Algorithm32 transport does not support geometry kind ${geometryKind ?? '<missing>'}.`);
	}

	/**
	 * Create the transport-owned distant spherical shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the transport contribution.
	 */
	_createDistantSphericalShaderContribution(descriptor) {
		const facts = resolveTransportFacts(descriptor);
		const pathSampleHelper = transportPathSampleHelper(facts.pathSampleDistribution?.kind ?? 'uniform-distance');

		return shaderContribution({
			id: 'transport-algorithm32',
			owner: 'transport',
			descriptorFingerprint: descriptor.transport.fingerprint,
			compatibilityTags: descriptor.transport.compatibilityTags,
			provides: Object.freeze(['transport.evaluatePathRadiance']),
			requires: Object.freeze([
				'atmosphere.sampleMedium',
				'light.sampleDirectRadiance',
				'cache.lookupIncidentRadiance',
			]),
			functions: Object.freeze([
				shaderBlock('transport-constants', 'declareConstants', 0, `const int TRANSPORT_PATH_INTERVAL_COUNT = ${facts.pathIntervalCount};
const int SOURCE_TRANSMITTANCE_INTERVAL_COUNT = ${facts.sourceTransmittanceIntervalCount};`),
				shaderBlock('transport-evaluate-helper', 'evaluateTransport', 0, `SpectralValue directScatteringForDirection(MediumSample medium, vec3 viewDirection, vec3 incomingDirection) {
	float mu = clamp(dot(normalize(viewDirection), normalize(incomingDirection)), -1.0, 1.0);
	float rayleighPhase = 0.05968310366 * (1.0 + mu * mu);
	float mieG = ATMOSPHERE_MIE_PHASE_FUNCTION_G;
	float mieK = (3.0 / 25.1327412287) * ((1.0 - mieG * mieG) / (2.0 + mieG * mieG));
	float mieDenominator = max(1.0 + mieG * mieG - 2.0 * mieG * mu, 0.000001);
	float miePhase = (mieK * (1.0 + mu * mu)) / pow(mieDenominator, 1.5);
	SpectralValue scattering;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		scattering.c[channelIndex] = medium.rayleighScattering.c[channelIndex] * rayleighPhase
			+ medium.mieScattering.c[channelIndex] * miePhase;
	}
	return scattering;
}

SpectralValue computeTrapezoidSegmentTransmittance(MediumSample previousMedium, MediumSample currentMedium, float intervalLengthMeters) {
	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(
			-0.5
			* (previousMedium.extinction.c[channelIndex] + currentMedium.extinction.c[channelIndex])
			* intervalLengthMeters
		);
	}
	return transmittance;
}

${pathSampleHelper}

void evaluatePathRadiance(inout ShaderState state) {
	if (!state.bounds.valid) {
		state.pathRadiance = zeroSpectral();
		state.transmittance = oneSpectral();
		return;
	}
	SpectralValue viewTransmittance = oneSpectral();
	SpectralValue radiance = zeroSpectral();
	MediumSample previousMedium;
	bool hasPreviousMedium = false;
	float previousDistanceMeters = state.bounds.startDistanceMeters;

	for (int pointIndex = 0; pointIndex <= TRANSPORT_PATH_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = pathSampleDistanceForIndex(state, pointIndex);
		vec3 positionMeters = state.ray.originMeters + state.ray.direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(positionMeters);

		if (hasPreviousMedium) {
			float segmentLengthMeters = max(distanceMeters - previousDistanceMeters, 0.0);
			SpectralValue segmentTransmittance =
				computeTrapezoidSegmentTransmittance(previousMedium, medium, segmentLengthMeters);
			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				viewTransmittance.c[channelIndex] *= segmentTransmittance.c[channelIndex];
			}
		}

		SpectralValue directRadiance = sampleDirectRadiance(positionMeters);
		SpectralValue directScattering = directScatteringForDirection(
			medium,
			state.ray.direction,
			normalize(uDistantSunDirection)
		);
		float measureMeters = pathSampleMeasureMeters(state, pointIndex);

		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
				* directRadiance.c[channelIndex]
				* directScattering.c[channelIndex]
				* measureMeters;
		}

		for (int directionIndex = 0; directionIndex < CACHE_INCIDENT_DIRECTION_COUNT; directionIndex += 1) {
			vec3 incomingDirection = sunOrientedIncidentDirection(directionIndex);
			SpectralValue incidentRadiance = lookupIncidentRadiance(positionMeters, directionIndex);
			SpectralValue incidentScattering = directScatteringForDirection(
				medium,
				state.ray.direction,
				incomingDirection
			);

			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
					* incidentRadiance.c[channelIndex]
					* incidentScattering.c[channelIndex]
					* CACHE_INCIDENT_DIRECTION_WEIGHT
					* measureMeters;
			}
		}

		previousMedium = medium;
		previousDistanceMeters = distanceMeters;
		hasPreviousMedium = true;
	}
	state.transmittance = viewTransmittance;
	state.pathRadiance = radiance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('transport-main-evaluate', 'evaluateTransport', 0, 'evaluatePathRadiance(state);'),
			]),
		});
	}

	/**
	 * Create the transport-owned local flat shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the transport contribution.
	 */
	_createLocalFlatShaderContribution(descriptor) {
		const facts = resolveTransportFacts(descriptor);
		const pathSampleHelper = transportPathSampleHelper(facts.pathSampleDistribution?.kind ?? 'uniform-distance');

		return shaderContribution({
			id: 'transport-algorithm32-local-flat',
			owner: 'transport',
			descriptorFingerprint: descriptor.transport.fingerprint,
			compatibilityTags: descriptor.transport.compatibilityTags,
			provides: Object.freeze(['transport.evaluatePathRadiance']),
			requires: Object.freeze([
				'atmosphere.sampleMedium',
				'light.sampleDirectRadiance',
				'cache.lookupIncidentRadiance',
			]),
			functions: Object.freeze([
				shaderBlock('transport-constants', 'declareConstants', 0, `const int TRANSPORT_PATH_INTERVAL_COUNT = ${facts.pathIntervalCount};
const int SOURCE_TRANSMITTANCE_INTERVAL_COUNT = ${facts.sourceTransmittanceIntervalCount};`),
				shaderBlock('transport-evaluate-helper', 'evaluateTransport', 0, `SpectralValue directScatteringForDirection(MediumSample medium, vec3 viewDirection, vec3 incomingDirection) {
	float mu = clamp(dot(normalize(viewDirection), normalize(incomingDirection)), -1.0, 1.0);
	float rayleighPhase = 0.05968310366 * (1.0 + mu * mu);
	float mieG = ATMOSPHERE_MIE_PHASE_FUNCTION_G;
	float mieK = (3.0 / 25.1327412287) * ((1.0 - mieG * mieG) / (2.0 + mieG * mieG));
	float mieDenominator = max(1.0 + mieG * mieG - 2.0 * mieG * mu, 0.000001);
	float miePhase = (mieK * (1.0 + mu * mu)) / pow(mieDenominator, 1.5);
	SpectralValue scattering;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		scattering.c[channelIndex] = medium.rayleighScattering.c[channelIndex] * rayleighPhase
			+ medium.mieScattering.c[channelIndex] * miePhase;
	}
	return scattering;
}

SpectralValue computeTrapezoidSegmentTransmittance(MediumSample previousMedium, MediumSample currentMedium, float intervalLengthMeters) {
	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(
			-0.5
			* (previousMedium.extinction.c[channelIndex] + currentMedium.extinction.c[channelIndex])
			* intervalLengthMeters
		);
	}
	return transmittance;
}

${pathSampleHelper}

void evaluatePathRadiance(inout ShaderState state) {
	if (!state.bounds.valid) {
		state.pathRadiance = zeroSpectral();
		state.transmittance = oneSpectral();
		return;
	}
	SpectralValue viewTransmittance = oneSpectral();
	SpectralValue radiance = zeroSpectral();
	MediumSample previousMedium;
	bool hasPreviousMedium = false;
	float previousDistanceMeters = state.bounds.startDistanceMeters;

	for (int pointIndex = 0; pointIndex <= TRANSPORT_PATH_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = pathSampleDistanceForIndex(state, pointIndex);
		vec3 positionMeters = state.ray.originMeters + state.ray.direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(positionMeters);

		if (hasPreviousMedium) {
			float segmentLengthMeters = max(distanceMeters - previousDistanceMeters, 0.0);
			SpectralValue segmentTransmittance =
				computeTrapezoidSegmentTransmittance(previousMedium, medium, segmentLengthMeters);
			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				viewTransmittance.c[channelIndex] *= segmentTransmittance.c[channelIndex];
			}
		}

		SpectralValue directRadiance = sampleDirectRadiance(positionMeters);
		SpectralValue directScattering = directScatteringForDirection(
			medium,
			state.ray.direction,
			directionToLight(positionMeters)
		);
		float measureMeters = pathSampleMeasureMeters(state, pointIndex);

		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
				* directRadiance.c[channelIndex]
				* directScattering.c[channelIndex]
				* measureMeters;
		}

		for (int directionIndex = 0; directionIndex < LOCAL_CACHE_DIRECTION_COUNT; directionIndex += 1) {
			vec3 incomingDirection = localIncidentDirection(directionIndex);
			SpectralValue incidentRadiance = lookupIncidentRadiance(positionMeters, directionIndex);
			SpectralValue incidentScattering = directScatteringForDirection(
				medium,
				state.ray.direction,
				incomingDirection
			);

			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
					* incidentRadiance.c[channelIndex]
					* incidentScattering.c[channelIndex]
					* LOCAL_CACHE_INCIDENT_DIRECTION_WEIGHT
					* measureMeters;
			}
		}

		previousMedium = medium;
		previousDistanceMeters = distanceMeters;
		hasPreviousMedium = true;
	}
	state.transmittance = viewTransmittance;
	state.pathRadiance = radiance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('transport-main-evaluate', 'evaluateTransport', 0, 'evaluatePathRadiance(state);'),
			]),
		});
	}
}

/**
 * Build the path-sampling GLSL helper.
 *
 * @param {string} kind - Supplies the path-sampling policy kind.
 * @returns {string} Return GLSL source.
 */
function transportPathSampleHelper(kind) {
	if (kind === 'tangent-density-adaptive-v1' || kind === 'tangent-density-adaptive-soft-v1') {
		const adaptiveBlend = kind === 'tangent-density-adaptive-soft-v1' ? '0.35' : '1.0';
		return `float pathSampleFraction(ShaderState state, float uniformFraction) {
	float startDistanceMeters = state.bounds.startDistanceMeters;
	float endDistanceMeters = state.bounds.endDistanceMeters;
	float pathLengthMeters = max(endDistanceMeters - startDistanceMeters, 0.0);
	if (pathLengthMeters <= 0.0) {
		return 0.0;
	}

	float tangentDistanceMeters = clamp(
		-dot(state.ray.originMeters, state.ray.direction),
		startDistanceMeters,
		endDistanceMeters
	);
	float tangentFraction = clamp(
		(tangentDistanceMeters - startDistanceMeters) / pathLengthMeters,
		0.0,
		1.0
	);
	bool hasInteriorTangent = tangentFraction > 0.08 && tangentFraction < 0.92;
	float adaptiveFraction = uniformFraction;

	if (hasInteriorTangent) {
		if (uniformFraction <= tangentFraction) {
			float localFraction = uniformFraction / max(tangentFraction, 0.0001);
			float warpedLocal = 1.0 - pow(1.0 - localFraction, 2.0);
			adaptiveFraction = tangentFraction * warpedLocal;
		} else {
			float remainingFraction = max(1.0 - tangentFraction, 0.0001);
			float localFraction = (uniformFraction - tangentFraction) / remainingFraction;
			float warpedLocal = pow(localFraction, 2.0);
			adaptiveFraction = tangentFraction + remainingFraction * warpedLocal;
		}
	} else {
		adaptiveFraction = pow(uniformFraction, 1.75);
	}

	return mix(uniformFraction, adaptiveFraction, ${adaptiveBlend});
}

float pathSampleDistanceForIndex(ShaderState state, int pointIndex) {
	float uniformFraction = float(pointIndex) / float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	float sampleFraction = pathSampleFraction(state, clamp(uniformFraction, 0.0, 1.0));
	return mix(state.bounds.startDistanceMeters, state.bounds.endDistanceMeters, sampleFraction);
}

float pathSampleMeasureMeters(ShaderState state, int pointIndex) {
	float previousDistanceMeters = pointIndex > 0
		? pathSampleDistanceForIndex(state, pointIndex - 1)
		: pathSampleDistanceForIndex(state, pointIndex);
	float nextDistanceMeters = pointIndex < TRANSPORT_PATH_INTERVAL_COUNT
		? pathSampleDistanceForIndex(state, pointIndex + 1)
		: pathSampleDistanceForIndex(state, pointIndex);
	return max(0.0, 0.5 * (nextDistanceMeters - previousDistanceMeters));
}`;
	}

	return `float pathSampleDistanceForIndex(ShaderState state, int pointIndex) {
	float uniformFraction = float(pointIndex) / float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	return mix(
		state.bounds.startDistanceMeters,
		state.bounds.endDistanceMeters,
		clamp(uniformFraction, 0.0, 1.0)
	);
}

float pathSampleMeasureMeters(ShaderState state, int pointIndex) {
	float stepMeters = max(state.bounds.endDistanceMeters - state.bounds.startDistanceMeters, 0.0)
		/ float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	return ((pointIndex == 0 || pointIndex == TRANSPORT_PATH_INTERVAL_COUNT) ? 0.5 : 1.0)
		* stepMeters;
}`;
}

/**
 * Normalize transport descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized transport facts.
 */
function resolveTransportFacts(descriptor) {
	const facts = descriptor?.transport?.facts ?? {};
	const execution = facts.execution ?? facts;
	const geometryFacts = descriptor?.geometry?.facts ?? {};
	const pathIntervalCount = execution.pathIntervalCount
		?? RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount;
	const sourceTransmittanceIntervalCount = execution.sourceTransmittanceIntervalCount
		?? geometryFacts.sourceTransmittanceIntervalCount
		?? RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount;

	if (!descriptor?.transport) {
		throw new TypeError('Algorithm32 transport shader contribution requires a transport descriptor.');
	}

	assertPositiveInteger(pathIntervalCount, 'pathIntervalCount');
	assertPositiveInteger(sourceTransmittanceIntervalCount, 'sourceTransmittanceIntervalCount');

	return Object.freeze({
		pathIntervalCount,
		sourceTransmittanceIntervalCount,
		pathSampleDistribution: execution.pathSampleDistribution,
	});
}

/**
 * Assert a positive integer.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {string} label - Supplies label.
 * @returns {void}
 */
function assertPositiveInteger(value, label) {
	if (!Number.isInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive integer.`);
	}
}

/**
 * Create one contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function shaderContribution(configuration) {
	return Object.freeze({
		defines: Object.freeze([]),
		uniforms: Object.freeze([]),
		textures: Object.freeze([]),
		functions: Object.freeze([]),
		mainHooks: Object.freeze([]),
		bindingRequirements: Object.freeze([]),
		diagnostics: null,
		...configuration,
	});
}

/**
 * Create one shader source block.
 *
 * @param {string} id - Supplies block id.
 * @param {ShaderSourceSlot} slot - Supplies assembly slot.
 * @param {number} order - Supplies slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function shaderBlock(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

export default Algorithm32Transport;
