import DistantSunIncidentRadianceCache from './DistantSunIncidentRadianceCache.js';
import {
	CANONICAL_SPECTRAL_CHANNELS,
	RUNTIME_NUMERICAL_CONTROLS,
} from '../constants/Algorithm32CanonicalData.js';
import VectorMath from '../utils/VectorMath.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;

/**
 * Own direct lighting and incident-cache creation for a distant sun source.
 */
export class DistantSunLightSource {
	/**
	 * Create a distant sun light source.
	 *
	 * @param {DistantSunLightSourceConfig} configuration - Supplies source
	 * direction, spectral channels, apparent size metadata, and cache policy.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('DistantSunLightSource configuration is required.');
		}

		const {
			directionToLight,
			spectralChannels,
			angularRadiusRadians,
			cacheAltitudeBinCount = RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			cacheDirectionCount = RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount,
			cacheBoundaryAltitudeMeters = 2,
		} = configuration;

		assertSpectralChannels(spectralChannels, 'DistantSunLightSource');

		if (!Number.isFinite(angularRadiusRadians) || angularRadiusRadians < 0) {
			throw new TypeError('DistantSunLightSource angularRadiusRadians must be finite and non-negative.');
		}

		if (!Number.isInteger(cacheAltitudeBinCount) || cacheAltitudeBinCount < 1) {
			throw new RangeError('DistantSunLightSource cacheAltitudeBinCount must be a positive integer.');
		}

		if (!Number.isInteger(cacheDirectionCount) || cacheDirectionCount < 1) {
			throw new RangeError('DistantSunLightSource cacheDirectionCount must be a positive integer.');
		}

		if (!Number.isFinite(cacheBoundaryAltitudeMeters) || cacheBoundaryAltitudeMeters < 0) {
			throw new TypeError('DistantSunLightSource cacheBoundaryAltitudeMeters must be finite and non-negative.');
		}

		this._configuration = Object.freeze({
			directionToLight: normalizeDirection(directionToLight, 'directionToLight'),
			spectralChannels: freezeSpectralChannels(spectralChannels),
			angularRadiusRadians,
			cacheAltitudeBinCount,
			cacheDirectionCount,
			cacheBoundaryAltitudeMeters,
		});
	}

	/**
	 * Return the immutable source configuration snapshot.
	 *
	 * @returns {DistantSunLightSourceConfig} The source configuration.
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
		return 'distant-sun';
	}

	/**
	 * Return a serializable source descriptor.
	 *
	 * @returns {object} The source descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'distant-sun-light-source',
			sourceKey: 'distant-sun',
			directionToLight: this._configuration.directionToLight,
			angularRadiusRadians: this._configuration.angularRadiusRadians,
			spectralChannelCount: this._configuration.spectralChannels.length,
			incidentRadianceCachePolicy: Object.freeze({
				altitudeBinCount: this._configuration.cacheAltitudeBinCount,
				directionCount: this._configuration.cacheDirectionCount,
				boundaryAltitudeMeters: this._configuration.cacheBoundaryAltitudeMeters,
				boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
			}),
		});
	}

	/**
	 * Create a distant incident-radiance cache.
	 *
	 * @param {object} request - Supplies geometry radii and spectral basis.
	 * @returns {IncidentRadianceCache} The incident-radiance cache.
	 */
	createIncidentRadianceCache(request = {}) {
		const {
			bottomRadiusMeters,
			topRadiusMeters,
			spectralBasis,
			boundaryAltitudeMeters,
		} = request;

		return new DistantSunIncidentRadianceCache({
			sourceKey: 'distant-sun',
			bottomRadiusMeters,
			topRadiusMeters,
			altitudeBinCount: this._configuration.cacheAltitudeBinCount,
			directionCount: this._configuration.cacheDirectionCount,
			directionToLight: this._configuration.directionToLight,
			spectralBasis,
			boundaryAltitudeMeters: boundaryAltitudeMeters
				?? this._configuration.cacheBoundaryAltitudeMeters,
		});
	}

	/**
	 * Sample direct source lighting at a transport point.
	 *
	 * @returns {DirectLightingSample} The direct lighting sample.
	 */
	sampleDirectLighting() {
		return Object.freeze({
			incidentRadiance: Object.freeze(
				this._configuration.spectralChannels.map((channel) => channel.solarIrradiance),
			),
			directionToLight: this._configuration.directionToLight,
			metadata: Object.freeze({
				directionFromSource: Object.freeze(VectorMath.scale(this._configuration.directionToLight, -1)),
				angularRadiusRadians: this._configuration.angularRadiusRadians,
			}),
		});
	}

	/**
	 * Resolve the source path limit for a directional source.
	 *
	 * @returns {SourcePathLimit} The source path limit.
	 */
	resolveSourcePathLimit() {
		return Object.freeze({
			maxDistanceMeters: null,
			reason: 'distant-source-to-atmosphere-boundary',
		});
	}

	/**
	 * Create the light-source-owned distant sun shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} Return the light-source shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the light-source-owned distant sun shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the light-source contribution.
	 */
	_createShaderContribution(descriptor) {
		const facts = resolveDistantLightFacts(descriptor);

		return shaderContribution({
			id: 'light-distant-sun',
			owner: 'lightSource',
			descriptorFingerprint: descriptor.lightSource.fingerprint,
			compatibilityTags: descriptor.lightSource.compatibilityTags,
			provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
			requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
			uniforms: Object.freeze([
				shaderUniform('uDistantSunDirection', 'vec3', 'lightSource.direction', facts.directionToLight),
			]),
			functions: Object.freeze([
				shaderBlock('light-source-constants', 'declareConstants', 0, `const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
				shaderBlock('light-source-helper', 'sampleLightSource', 0, `SpectralValue sampleDirectRadiance(vec3 positionMeters) {
	SpectralValue sourceTransmittance = sourcePathTransmittance(positionMeters, normalize(uDistantSunDirection));
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = LIGHT_SOURCE_SOLAR_IRRADIANCE[channelIndex] * sourceTransmittance.c[channelIndex];
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
 * Assert source spectral channels.
 *
 * @param {unknown} spectralChannels - Supplies candidate channels.
 * @param {string} owner - Supplies the owner label.
 * @returns {void}
 */
function assertSpectralChannels(spectralChannels, owner) {
	if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
		throw new TypeError(`${owner} requires spectral channels.`);
	}

	for (const channel of spectralChannels) {
		if (!Number.isFinite(channel?.solarIrradiance)) {
			throw new TypeError(`${owner} spectral channels require finite solarIrradiance values.`);
		}
	}
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
 * Normalize distant source descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {{ readonly directionToLight: readonly number[] }} Return normalized light facts.
 */
function resolveDistantLightFacts(descriptor) {
	const facts = descriptor?.lightSource?.facts ?? {};
	const directionToLight = facts.directionToLight ?? facts.direction ?? [0, 0, 1];

	if (!descriptor?.lightSource) {
		throw new TypeError('DistantSunLightSource shader contribution requires a light-source descriptor.');
	}

	if (!Array.isArray(directionToLight) || directionToLight.length !== 3 || !directionToLight.every(Number.isFinite)) {
		throw new TypeError('DistantSunLightSource shader contribution requires directionToLight.');
	}

	return Object.freeze({
		directionToLight: Object.freeze([...directionToLight]),
	});
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
 * Create one shader uniform descriptor.
 *
 * @param {string} name - Supplies GLSL uniform name.
 * @param {string} type - Supplies GLSL uniform type.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {unknown} [defaultValue] - Supplies optional default value.
 * @returns {ShaderUniformDescriptor} Return uniform descriptor.
 */
function shaderUniform(name, type, valueKey, defaultValue) {
	const descriptor = { name, type, valueKey };

	if (arguments.length >= 4) {
		descriptor.defaultValue = defaultValue;
	}

	return Object.freeze(descriptor);
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

export default DistantSunLightSource;
