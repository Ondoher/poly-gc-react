import LocalSunIncidentRadianceCache from './LocalSunIncidentRadianceCache.js';
import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/Algorithm32CanonicalData.js';
import VectorMath from '../utils/VectorMath.js';
import WavelengthMath from '../utils/WavelengthMath.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;

/**
 * Own direct lighting and incident-cache creation for a finite local sun source.
 */
export class LocalSunLightSource {
	/**
	 * Create a local sun light source.
	 *
	 * @param {LocalSunLightSourceConfig} configuration - Supplies source key,
	 * spectral channels, finite-source scale, and cache policy.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('LocalSunLightSource configuration is required.');
		}

		const {
			sourceKey,
			spectralChannels,
			referenceDistanceMeters,
			referenceSpectralIncidentScale,
			radiusMeters,
			distanceFalloff = true,
			cacheZBinsMeters = [0],
			cacheRhoBinsMeters = [0],
			cacheDirectionCount = 1,
		} = configuration;

		if (!sourceKey || typeof sourceKey !== 'string') {
			throw new TypeError('LocalSunLightSource requires sourceKey.');
		}

		assertSpectralChannels(spectralChannels);

		if (![referenceDistanceMeters, referenceSpectralIncidentScale, radiusMeters].every(Number.isFinite)) {
			throw new TypeError('LocalSunLightSource distance, scale, and radius must be finite.');
		}

		if (referenceDistanceMeters <= 0 || referenceSpectralIncidentScale < 0 || radiusMeters < 0) {
			throw new RangeError('LocalSunLightSource distance, scale, and radius must be in valid ranges.');
		}

		if (!isFiniteNumberArray(cacheZBinsMeters) || !isFiniteNumberArray(cacheRhoBinsMeters)) {
			throw new TypeError('LocalSunLightSource cache z/rho bins must be finite arrays.');
		}

		if (!Number.isInteger(cacheDirectionCount) || cacheDirectionCount < 1) {
			throw new RangeError('LocalSunLightSource cacheDirectionCount must be a positive integer.');
		}

		this._configuration = Object.freeze({
			sourceKey,
			spectralChannels: freezeSpectralChannels(spectralChannels),
			referenceDistanceMeters,
			referenceSpectralIncidentScale,
			radiusMeters,
			distanceFalloff,
			cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
			cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
			cacheDirectionCount,
		});
	}

	/**
	 * Return the immutable source configuration snapshot.
	 *
	 * @returns {LocalSunLightSourceConfig} The source configuration.
	 */
	get configuration() {
		return this._configuration;
	}

	/**
	 * Identify this configured source model instance for compatibility.
	 *
	 * @returns {string} The source id.
	 */
	get id() {
		return this._configuration.sourceKey;
	}

	/**
	 * Return a serializable source descriptor.
	 *
	 * @returns {object} The source descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'local-sun-light-source',
			sourceKey: this._configuration.sourceKey,
			referenceDistanceMeters: this._configuration.referenceDistanceMeters,
			referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
			radiusMeters: this._configuration.radiusMeters,
			distanceFalloff: this._configuration.distanceFalloff,
			spectralChannelCount: this._configuration.spectralChannels.length,
			incidentRadianceCachePolicy: Object.freeze({
				zBinCount: this._configuration.cacheZBinsMeters.length,
				rhoBinCount: this._configuration.cacheRhoBinsMeters.length,
				directionCount: this._configuration.cacheDirectionCount,
				lookupPolicy: 'nearest-neighbor-poc-grid',
			}),
		});
	}

	/**
	 * Create a local incident-radiance cache.
	 *
	 * @param {object} [request] - Supplies optional spectral basis override.
	 * @returns {IncidentRadianceCache} The incident-radiance cache.
	 */
	createIncidentRadianceCache(request = {}) {
		const spectralBasis = request.spectralBasis ?? createSpectralBasisFromChannels(
			this._configuration.spectralChannels,
		);

		return new LocalSunIncidentRadianceCache({
			sourceKey: this._configuration.sourceKey,
			zBinsMeters: this._configuration.cacheZBinsMeters,
			rhoBinsMeters: this._configuration.cacheRhoBinsMeters,
			directionCount: this._configuration.cacheDirectionCount,
			spectralBasis,
		});
	}

	/**
	 * Sample direct lighting from the finite source.
	 *
	 * @param {object} [request] - Supplies source-relative sample facts.
	 * @returns {DirectLightingSample} The direct lighting sample.
	 */
	sampleDirectLighting(request = {}) {
		const sourceRelativePosition = request.sourceRelativePosition;

		if (!sourceRelativePosition) {
			throw new TypeError('LocalSunLightSource.sampleDirectLighting requires sourceRelativePosition.');
		}

		const distanceFromSourceMeters = sourceRelativePosition.distanceFromSourceMeters;
		const directionToLight = normalizeDirection(
			sourceRelativePosition.directionToSource ?? [0, 0, 1],
			'sourceRelativePosition.directionToSource',
		);
		const safeDistanceMeters = Math.max(
			this._configuration.radiusMeters,
			Number.isFinite(distanceFromSourceMeters)
				? distanceFromSourceMeters
				: this._configuration.referenceDistanceMeters,
		);
		const falloffScale = this._configuration.distanceFalloff
			? (this._configuration.referenceDistanceMeters / safeDistanceMeters) ** 2
			: 1;
		const incidentScale = this._configuration.referenceSpectralIncidentScale * falloffScale;
		const incidentRadiance = this._configuration.spectralChannels.map((channel) =>
			channel.solarIrradiance * incidentScale);

		return Object.freeze({
			incidentRadiance: Object.freeze(incidentRadiance),
			directionToLight,
			metadata: Object.freeze({
				sourceKey: this._configuration.sourceKey,
				distanceFromSourceMeters,
				safeDistanceMeters,
				radiusMeters: this._configuration.radiusMeters,
				referenceDistanceMeters: this._configuration.referenceDistanceMeters,
				referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
				falloffScale,
				incidentScale,
				distanceClampedToRadius: safeDistanceMeters !== distanceFromSourceMeters,
				spectralScaleKind: 'neutral-no-tint',
			}),
		});
	}

	/**
	 * Resolve the finite source path limit for one sample.
	 *
	 * @param {object} [request] - Supplies source-relative sample facts.
	 * @returns {SourcePathLimit} The source path limit.
	 */
	resolveSourcePathLimit(request = {}) {
		const distance = request.sourceRelativePosition?.distanceFromSourceMeters;

		return Object.freeze({
			maxDistanceMeters: Number.isFinite(distance) ? Math.max(0, distance) : null,
			reason: 'finite-local-source-distance',
		});
	}

	/**
	 * Create the light-source-owned local sun shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} Return the light-source shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the light-source-owned local sun shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the light-source contribution.
	 */
	_createShaderContribution(descriptor) {
		const facts = resolveLocalLightFacts(descriptor);
		const falloffExpression = facts.distanceFalloff
			? 'pow(LOCAL_LIGHT_REFERENCE_DISTANCE_METERS / safeDistanceMeters, 2.0)'
			: '1.0';

		return shaderContribution({
			id: 'light-local-sun',
			owner: 'lightSource',
			descriptorFingerprint: descriptor.lightSource.fingerprint,
			compatibilityTags: descriptor.lightSource.compatibilityTags,
			provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
			requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
			functions: Object.freeze([
				shaderBlock('light-source-constants', 'declareConstants', 0, `const vec3 LOCAL_LIGHT_SOURCE_POSITION_METERS = ${formatVec3(facts.sourcePositionMeters)};
const float LOCAL_LIGHT_REFERENCE_DISTANCE_METERS = ${formatFloat(facts.referenceDistanceMeters)};
const float LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE = ${formatFloat(facts.referenceSpectralIncidentScale)};
const float LOCAL_LIGHT_RADIUS_METERS = ${formatFloat(facts.radiusMeters)};
const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
				shaderBlock('light-source-helper', 'sampleLightSource', 0, `vec3 directionToLight(vec3 positionMeters) {
	return normalize(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);
}

SpectralValue sampleDirectRadiance(vec3 positionMeters) {
	vec3 direction = directionToLight(positionMeters);
	float distanceMeters = length(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);
	float safeDistanceMeters = max(LOCAL_LIGHT_RADIUS_METERS, max(distanceMeters, 0.0));
	float falloffScale = ${falloffExpression};
	float incidentScale = LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE * falloffScale;
	SpectralValue sourceTransmittance = sourcePathTransmittance(positionMeters, direction);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = LIGHT_SOURCE_SOLAR_IRRADIANCE[channelIndex]
			* incidentScale
			* sourceTransmittance.c[channelIndex];
	}
	return radiance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('light-main-direct', 'sampleLightSource', 0, 'state.lightRadiance = sampleDirectRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
			]),
		});
	}
}

/**
 * Create a production spectral basis from source spectral channels.
 *
 * @param {readonly SpectralChannelConstant[]} spectralChannels - Supplies
 * spectral channels.
 * @returns {SpectralBasis} The production spectral basis.
 */
function createSpectralBasisFromChannels(spectralChannels) {
	return Object.freeze({
		wavelengths: Object.freeze(spectralChannels.map((channel) => {
			WavelengthMath.assertWavelength(channel?.wavelength, 'spectral channel wavelength');

			return Object.freeze({
				value: channel.wavelength.value,
				units: channel.wavelength.units,
			});
		})),
	});
}

/**
 * Freeze spectral channel inputs.
 *
 * @param {readonly SpectralChannelConstant[]} spectralChannels - Supplies
 * spectral channels.
 * @returns {readonly SpectralChannelConstant[]} Frozen channels.
 */
function freezeSpectralChannels(spectralChannels) {
	return Object.freeze(spectralChannels.map((channel) => Object.freeze({ ...channel })));
}

/**
 * Assert local source spectral channels.
 *
 * @param {unknown} spectralChannels - Supplies candidate channels.
 * @returns {void}
 */
function assertSpectralChannels(spectralChannels) {
	if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
		throw new TypeError('LocalSunLightSource requires spectral channels.');
	}

	for (const channel of spectralChannels) {
		if (!Number.isFinite(channel?.solarIrradiance)) {
			throw new TypeError('LocalSunLightSource spectral channels require finite solarIrradiance values.');
		}
	}
}

/**
 * Check for a finite numeric array.
 *
 * @param {unknown} values - Supplies candidate values.
 * @returns {boolean} True when all values are finite numbers.
 */
function isFiniteNumberArray(values) {
	return Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
}

/**
 * Normalize a non-zero direction.
 *
 * @param {unknown} direction - Supplies the direction candidate.
 * @param {string} label - Supplies the error label.
 * @returns {UnitVector3} The normalized direction.
 */
function normalizeDirection(direction, label) {
	if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
		throw new TypeError(`${label} must be a finite three-component vector.`);
	}

	if (VectorMath.length(direction) <= Number.EPSILON) {
		throw new RangeError(`${label} must be non-zero.`);
	}

	return Object.freeze(VectorMath.normalize(direction));
}

/**
 * Normalize local source descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {object} Return normalized light facts.
 */
function resolveLocalLightFacts(descriptor) {
	const lightFacts = descriptor?.lightSource?.facts ?? {};
	const geometryFacts = descriptor?.geometry?.facts ?? {};
	const facts = {
		...lightFacts,
		sourcePositionMeters: lightFacts.sourcePositionMeters ?? geometryFacts.sourcePositionMeters,
	};

	if (!descriptor?.lightSource) {
		throw new TypeError('LocalSunLightSource shader contribution requires a light-source descriptor.');
	}

	for (const field of ['referenceDistanceMeters', 'referenceSpectralIncidentScale', 'radiusMeters']) {
		if (!Number.isFinite(facts[field])) {
			throw new TypeError(`LocalSunLightSource shader contribution requires ${field}.`);
		}
	}

	if (!Array.isArray(facts.sourcePositionMeters) || facts.sourcePositionMeters.length !== 3) {
		throw new TypeError('LocalSunLightSource shader contribution requires sourcePositionMeters.');
	}

	return facts;
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

/**
 * Format one number for GLSL output.
 *
 * @param {number} value - Supplies the value.
 * @returns {string} Return formatted GLSL number text.
 */
function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

/**
 * Format numeric array entries for GLSL output.
 *
 * @param {readonly number[]} values - Supplies values.
 * @returns {string} Return formatted entries.
 */
function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

/**
 * Format a GLSL vec3.
 *
 * @param {readonly number[]} values - Supplies vector values.
 * @returns {string} Return formatted vector source.
 */
function formatVec3(values) {
	return `vec3(${formatFloatArray(values)})`;
}

export default LocalSunLightSource;
