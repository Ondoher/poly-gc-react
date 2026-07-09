import VectorMath from '../utils/VectorMath.js';
import WavelengthMath from '../utils/WavelengthMath.js';
import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/Algorithm32CanonicalData.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;

/**
 * Own the canonical atmosphere profile used by Algorithm32 transport.
 */
export class CanonicalAtmosphere {
	/**
	 * Create a canonical atmosphere from sourced constants and spectral
	 * channels.
	 *
	 * @param {CanonicalAtmosphereConfig} configuration - Supplies atmosphere
	 * constants and spectral channels.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('CanonicalAtmosphere configuration is required.');
		}

		const { constants, spectralChannels } = configuration;

		assertConstants(constants);
		assertSpectralChannels(spectralChannels);

		this._constants = Object.freeze({ ...constants });
		this._spectralChannels = Object.freeze(spectralChannels.map((channel) => Object.freeze({ ...channel })));
	}

	/**
	 * Return the immutable atmosphere constants.
	 *
	 * @returns {CanonicalAtmosphereConstants} The constants.
	 */
	get constants() {
		return this._constants;
	}

	/**
	 * Return the immutable spectral channels.
	 *
	 * @returns {readonly SpectralChannelConstant[]} The spectral channels.
	 */
	get spectralChannels() {
		return this._spectralChannels;
	}

	/**
	 * Identify this configured atmosphere model instance for compatibility.
	 *
	 * @returns {string} The atmosphere id.
	 */
	get id() {
		return 'canonical-atmosphere';
	}

	/**
	 * Return a serializable atmosphere descriptor.
	 *
	 * @returns {object} The atmosphere descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'canonical-atmosphere',
			spectralChannelCount: this._spectralChannels.length,
			constants: this._constants,
		});
	}

	/**
	 * Create the atmosphere-owned shader contribution for the descriptor geometry.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} The atmosphere shader contribution.
	 */
	createShaderContribution(request) {
		if (request?.descriptor?.geometry?.facts?.kind === 'flat-earth-geometry') {
			return this._createFlatShaderContribution(request.descriptor);
		}

		return this._createSphericalShaderContribution(request?.descriptor);
	}

	/**
	 * Create the atmosphere-owned spherical shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the atmosphere contribution.
	 */
	_createSphericalShaderContribution(descriptor) {
		const facts = resolveAtmosphereShaderFacts(descriptor, 'CanonicalAtmosphere spherical shader contribution');

		return shaderContribution({
			id: 'atmosphere-canonical',
			owner: 'atmosphere',
			descriptorFingerprint: descriptor.atmosphere.fingerprint,
			compatibilityTags: descriptor.atmosphere.compatibilityTags,
			provides: Object.freeze(['atmosphere.sampleMedium', 'atmosphere.sourcePathTransmittance']),
			requires: Object.freeze([]),
			functions: Object.freeze([
				shaderBlock('atmosphere-constants', 'declareConstants', 0, atmosphereConstantsBlock(facts)),
				shaderBlock('atmosphere-sample-medium', 'sampleAtmosphere', 0, `MediumSample sampleAtmosphere(vec3 positionMeters) {
	float altitudeMeters = max(0.0, length(positionMeters) - GEOMETRY_BOTTOM_RADIUS_METERS);
	float rayleighDensity = exp(-altitudeMeters / ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity = exp(-altitudeMeters / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS);
	MediumSample medium;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		float wavelengthMicrometers = ATMOSPHERE_WAVELENGTH_MICROMETERS[channelIndex];
		float rayleighScattering = ATMOSPHERE_RAYLEIGH_COEFFICIENT_SCALE
			* pow(wavelengthMicrometers, -4.0)
			* rayleighDensity;
		float mieExtinction = (ATMOSPHERE_MIE_ANGSTROM_BETA / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS)
			* pow(wavelengthMicrometers, -ATMOSPHERE_MIE_ANGSTROM_ALPHA)
			* mieDensity;
		float mieScattering = mieExtinction * ATMOSPHERE_MIE_SINGLE_SCATTERING_ALBEDO;
		medium.rayleighScattering.c[channelIndex] = rayleighScattering;
		medium.mieScattering.c[channelIndex] = mieScattering;
		medium.scattering.c[channelIndex] = rayleighScattering + mieScattering;
		medium.extinction.c[channelIndex] = rayleighScattering + mieExtinction;
	}
	return medium;
}

SpectralValue sourcePathTransmittance(vec3 positionMeters, vec3 sourceDirection) {
	vec3 direction = normalize(sourceDirection);
	float radius = length(positionMeters);
	float mu = dot(positionMeters, direction) / max(radius, 1.0);
	float groundDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_BOTTOM_RADIUS_METERS * GEOMETRY_BOTTOM_RADIUS_METERS;
	if (mu < 0.0 && groundDiscriminant >= 0.0) {
		float groundDistance = -radius * mu - sqrt(groundDiscriminant);
		if (groundDistance > 0.0) {
			return zeroSpectral();
		}
	}

	float topDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_TOP_RADIUS_METERS * GEOMETRY_TOP_RADIUS_METERS;
	if (topDiscriminant < 0.0) {
		return zeroSpectral();
	}

	float endDistanceMeters = max(0.0, -radius * mu + sqrt(topDiscriminant));
	float stepMeters = endDistanceMeters / float(SOURCE_TRANSMITTANCE_INTERVAL_COUNT);
	SpectralValue opticalDepth = zeroSpectral();

	for (int pointIndex = 0; pointIndex <= SOURCE_TRANSMITTANCE_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = float(pointIndex) * stepMeters;
		vec3 samplePosition = positionMeters + direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(samplePosition);
		float weight = (pointIndex == 0 || pointIndex == SOURCE_TRANSMITTANCE_INTERVAL_COUNT) ? 0.5 : 1.0;
		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			opticalDepth.c[channelIndex] += medium.extinction.c[channelIndex] * stepMeters * weight;
		}
	}

	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(-opticalDepth.c[channelIndex]);
	}
	return transmittance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('atmosphere-main-sample', 'sampleAtmosphere', 0, 'state.medium = sampleAtmosphere(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
			]),
		});
	}

	/**
	 * Create the atmosphere-owned flat shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the atmosphere contribution.
	 */
	_createFlatShaderContribution(descriptor) {
		const facts = resolveAtmosphereShaderFacts(descriptor, 'CanonicalAtmosphere flat shader contribution');

		return shaderContribution({
			id: 'atmosphere-canonical-flat-altitude',
			owner: 'atmosphere',
			descriptorFingerprint: descriptor.atmosphere.fingerprint,
			compatibilityTags: descriptor.atmosphere.compatibilityTags,
			provides: Object.freeze(['atmosphere.sampleMedium', 'atmosphere.sourcePathTransmittance']),
			requires: Object.freeze([]),
			functions: Object.freeze([
				shaderBlock('atmosphere-constants', 'declareConstants', 0, atmosphereConstantsBlock(facts)),
				shaderBlock('atmosphere-sample-medium', 'sampleAtmosphere', 0, `MediumSample sampleAtmosphere(vec3 positionMeters) {
	float altitudeMeters = clamp(positionMeters.z, 0.0, GEOMETRY_TOP_ALTITUDE_METERS);
	float rayleighDensity = exp(-altitudeMeters / ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity = exp(-altitudeMeters / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS);
	MediumSample medium;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		float wavelengthMicrometers = ATMOSPHERE_WAVELENGTH_MICROMETERS[channelIndex];
		float rayleighScattering = ATMOSPHERE_RAYLEIGH_COEFFICIENT_SCALE
			* pow(wavelengthMicrometers, -4.0)
			* rayleighDensity;
		float mieExtinction = (ATMOSPHERE_MIE_ANGSTROM_BETA / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS)
			* pow(wavelengthMicrometers, -ATMOSPHERE_MIE_ANGSTROM_ALPHA)
			* mieDensity;
		float mieScattering = mieExtinction * ATMOSPHERE_MIE_SINGLE_SCATTERING_ALBEDO;
		medium.rayleighScattering.c[channelIndex] = rayleighScattering;
		medium.mieScattering.c[channelIndex] = mieScattering;
		medium.scattering.c[channelIndex] = rayleighScattering + mieScattering;
		medium.extinction.c[channelIndex] = rayleighScattering + mieExtinction;
	}
	return medium;
}

SpectralValue sourcePathTransmittance(vec3 positionMeters, vec3 sourceDirection) {
	vec3 direction = normalize(sourceDirection);
	float sourceDistanceMeters = length(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);

	if (direction.z < -0.000001) {
		float groundDistanceMeters = (0.0 - positionMeters.z) / direction.z;
		if (groundDistanceMeters >= 0.0 && groundDistanceMeters < sourceDistanceMeters) {
			return zeroSpectral();
		}
	}

	float endDistanceMeters = sourceDistanceMeters;
	if (direction.z > 0.000001) {
		float topDistanceMeters = (GEOMETRY_TOP_ALTITUDE_METERS - positionMeters.z) / direction.z;
		if (topDistanceMeters >= 0.0) {
			endDistanceMeters = min(endDistanceMeters, topDistanceMeters);
		}
	}
	float domeDistanceMeters = 0.0;
	if (observerDomeBoundaryDistance(positionMeters, direction, domeDistanceMeters)) {
		endDistanceMeters = min(endDistanceMeters, domeDistanceMeters);
	}

	float stepMeters = max(endDistanceMeters, 0.0) / float(SOURCE_TRANSMITTANCE_INTERVAL_COUNT);
	SpectralValue opticalDepth = zeroSpectral();

	for (int pointIndex = 0; pointIndex <= SOURCE_TRANSMITTANCE_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = float(pointIndex) * stepMeters;
		vec3 samplePosition = positionMeters + direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(samplePosition);
		float weight = (pointIndex == 0 || pointIndex == SOURCE_TRANSMITTANCE_INTERVAL_COUNT) ? 0.5 : 1.0;
		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			opticalDepth.c[channelIndex] += medium.extinction.c[channelIndex] * stepMeters * weight;
		}
	}

	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(-opticalDepth.c[channelIndex]);
	}
	return transmittance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('atmosphere-main-sample', 'sampleAtmosphere', 0, 'state.medium = sampleAtmosphere(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
			]),
		});
	}

	/**
	 * Sample wavelength-aligned medium coefficients at a geometry-resolved
	 * atmosphere coordinate.
	 *
	 * @param {AtmosphereCoordinate} coordinate - Supplies the atmosphere
	 * coordinate.
	 * @returns {AtmosphereSample} The sampled medium coefficients.
	 */
	sampleMedium(coordinate) {
		const altitudeMeters = coordinate?.altitudeMeters;

		if (!Number.isFinite(altitudeMeters)) {
			throw new TypeError('AtmosphereCoordinate.altitudeMeters must be finite.');
		}

		// Exponential density profiles are standard atmosphere profile terms
		// used with wavelength-dependent scattering coefficients. [2]
		const density = Object.freeze({
			rayleigh: exponentialDensity(altitudeMeters, this._constants.rayleighScaleHeightMeters),
			mie: exponentialDensity(altitudeMeters, this._constants.mieScaleHeightMeters),
			absorption: 0,
		});
		const rayleighScattering = this._spectralChannels.map((channel) =>
			density.rayleigh * this.rayleighScatteringCoefficientAt(wavelengthNanometersForChannel(channel)));
		const mieExtinction = this._spectralChannels.map((channel) =>
			density.mie * this.mieExtinctionCoefficientAt(wavelengthNanometersForChannel(channel)));
		const mieScattering = mieExtinction.map((value) => value * this._constants.mieSingleScatteringAlbedo);
		const absorption = this._spectralChannels.map(() => 0);
		const extinction = rayleighScattering.map((value, index) =>
			value + mieExtinction[index] + absorption[index]);
		const scattering = rayleighScattering.map((value, index) => value + mieScattering[index]);

		return Object.freeze({
			extinction: Object.freeze(extinction),
			scattering: Object.freeze(scattering),
			rayleighScattering: Object.freeze(rayleighScattering),
			mieScattering: Object.freeze(mieScattering),
			mieExtinction: Object.freeze(mieExtinction),
			absorption: Object.freeze(absorption),
			density,
		});
	}

	/**
	 * Integrate optical depth and transmittance over a geometry-built
	 * atmosphere path.
	 *
	 * @param {AtmospherePath} path - Supplies path samples.
	 * @returns {OpticalDepthSample} The optical-depth sample.
	 */
	integrateOpticalDepth(path) {
		const zero = this._zero();

		if (path?.blockedByGround) {
			return Object.freeze({
				opticalDepth: Object.freeze(this._spectralChannels.map(() => Number.POSITIVE_INFINITY)),
				transmittance: zero,
			});
		}

		const samples = path?.samples;

		if (!Array.isArray(samples)) {
			throw new TypeError('AtmospherePath.samples are required for optical-depth integration.');
		}

		const opticalDepth = this._zeroMutable();

		for (const sample of samples) {
			const medium = this.sampleMedium(sample.atmosphereCoordinate);
			const measureMeters = sample.measureMeters;

			if (!Number.isFinite(measureMeters)) {
				throw new TypeError('AtmospherePath sample measureMeters must be finite.');
			}

			for (let index = 0; index < opticalDepth.length; index += 1) {
				opticalDepth[index] += medium.extinction[index] * measureMeters;
			}
		}

		// Optical depth drives Beer-Lambert transmittance channel by channel. [1]
		return Object.freeze({
			opticalDepth: Object.freeze(opticalDepth),
			transmittance: Object.freeze(opticalDepth.map((value) => Math.exp(-value))),
		});
	}

	/**
	 * Sample Rayleigh and Mie phase functions for a pair of directions.
	 *
	 * @param {object} [request] - Supplies view and incoming directions.
	 * @returns {PhaseSample} The phase sample.
	 */
	samplePhase(request = {}) {
		const { viewDirection, incomingDirection } = request;

		assertDirection(viewDirection, 'viewDirection');
		assertDirection(incomingDirection, 'incomingDirection');

		const nu = Math.max(-1, Math.min(1, VectorMath.dot(viewDirection, incomingDirection)));
		const rayleighPhase = rayleighPhaseFunction(nu);
		const miePhase = miePhaseFunction(this._constants.miePhaseFunctionG, nu);
		const phase = this._spectralChannels.map(() => rayleighPhase + miePhase);

		return Object.freeze({
			phase: Object.freeze(phase),
			rayleighPhase,
			miePhase,
		});
	}

	/**
	 * Return Rayleigh scattering coefficient for a wavelength.
	 *
	 * @param {number} wavelengthNanometers - Supplies wavelength in nanometers.
	 * @returns {number} The Rayleigh scattering coefficient.
	 */
	rayleighScatteringCoefficientAt(wavelengthNanometers) {
		assertPositiveFinite(wavelengthNanometers, 'wavelengthNanometers');

		const wavelengthMicrometers = wavelengthNanometers / 1000;

		return this._constants.rayleighCoefficientScale * wavelengthMicrometers ** -4;
	}

	/**
	 * Return Mie extinction coefficient for a wavelength.
	 *
	 * @param {number} wavelengthNanometers - Supplies wavelength in nanometers.
	 * @returns {number} The Mie extinction coefficient.
	 */
	mieExtinctionCoefficientAt(wavelengthNanometers) {
		assertPositiveFinite(wavelengthNanometers, 'wavelengthNanometers');

		const wavelengthMicrometers = wavelengthNanometers / 1000;

		return (
			(this._constants.mieAngstromBeta / this._constants.mieScaleHeightMeters)
			* wavelengthMicrometers ** -this._constants.mieAngstromAlpha
		);
	}

	_zero() {
		return Object.freeze(this._spectralChannels.map(() => 0));
	}

	_zeroMutable() {
		return this._spectralChannels.map(() => 0);
	}
}

/**
 * Exponential density profile for an altitude and scale height.
 *
 * @param {number} altitudeMeters - Supplies altitude in meters.
 * @param {number} scaleHeightMeters - Supplies scale height in meters.
 * @returns {number} The density scale.
 */
function exponentialDensity(altitudeMeters, scaleHeightMeters) {
	return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

/**
 * Rayleigh phase function. [3]
 *
 * @param {number} nu - Supplies the direction cosine.
 * @returns {number} The Rayleigh phase value.
 */
function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

/**
 * Cornette-Shanks-style Mie phase function used by the POC. [3]
 *
 * @param {number} g - Supplies phase asymmetry.
 * @param {number} nu - Supplies the direction cosine.
 * @returns {number} The Mie phase value.
 */
function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));
	const denominator = Math.max(1 + g * g - 2 * g * nu, Number.EPSILON);

	return (k * (1 + nu * nu)) / denominator ** 1.5;
}

/**
 * Resolve a channel wavelength in nanometers.
 *
 * @param {SpectralChannelConstant} channel - Supplies the channel.
 * @returns {number} Wavelength in nanometers.
 */
function wavelengthNanometersForChannel(channel) {
	try {
		return WavelengthMath.toNanometers(channel?.wavelength);
	} catch (error) {
		throw new TypeError('CanonicalAtmosphere spectral channels require a wavelength packet.');
	}
}

/**
 * Assert atmosphere constants.
 *
 * @param {unknown} constants - Supplies candidate constants.
 * @returns {void}
 */
function assertConstants(constants) {
	if (!constants || typeof constants !== 'object') {
		throw new TypeError('CanonicalAtmosphere requires constants.');
	}

	for (const field of [
		'rayleighScaleHeightMeters',
		'mieScaleHeightMeters',
		'rayleighCoefficientScale',
		'mieAngstromAlpha',
		'mieAngstromBeta',
		'mieSingleScatteringAlbedo',
		'miePhaseFunctionG',
	]) {
		if (!Number.isFinite(constants[field])) {
			throw new TypeError(`CanonicalAtmosphere constants.${field} must be finite.`);
		}
	}

	assertPositiveFinite(constants.rayleighScaleHeightMeters, 'rayleighScaleHeightMeters');
	assertPositiveFinite(constants.mieScaleHeightMeters, 'mieScaleHeightMeters');
}

/**
 * Assert source spectral channels.
 *
 * @param {unknown} spectralChannels - Supplies candidate channels.
 * @returns {void}
 */
function assertSpectralChannels(spectralChannels) {
	if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
		throw new TypeError('CanonicalAtmosphere requires spectral channels.');
	}

	for (const channel of spectralChannels) {
		wavelengthNanometersForChannel(channel);
	}
}

/**
 * Assert a positive finite value.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {string} label - Supplies the error label.
 * @returns {void}
 */
function assertPositiveFinite(value, label) {
	if (!Number.isFinite(value) || value <= 0) {
		throw new RangeError(`${label} must be positive and finite.`);
	}
}

/**
 * Assert a finite three-component direction.
 *
 * @param {unknown} direction - Supplies the candidate direction.
 * @param {string} label - Supplies the error label.
 * @returns {void}
 */
function assertDirection(direction, label) {
	if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
		throw new TypeError(`samplePhase requires finite ${label}.`);
	}
}

/**
 * Normalize atmosphere descriptor facts for shader contribution creation.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {string} label - Supplies the error label.
 * @returns {CanonicalAtmosphereConstants} Return normalized constants.
 */
function resolveAtmosphereShaderFacts(descriptor, label) {
	const facts = descriptor?.atmosphere?.facts ?? {};
	const constants = facts.constants ?? facts;

	if (!descriptor?.atmosphere) {
		throw new TypeError(`${label} requires an atmosphere descriptor.`);
	}

	for (const field of [
		'rayleighScaleHeightMeters',
		'mieScaleHeightMeters',
		'rayleighCoefficientScale',
		'mieAngstromAlpha',
		'mieAngstromBeta',
		'mieSingleScatteringAlbedo',
		'miePhaseFunctionG',
	]) {
		if (!Number.isFinite(constants[field])) {
			throw new TypeError(`${label} requires ${field}.`);
		}
	}

	return constants;
}

/**
 * Create the shared atmosphere constant GLSL block.
 *
 * @param {CanonicalAtmosphereConstants} facts - Supplies atmosphere constants.
 * @returns {string} Return GLSL source.
 */
function atmosphereConstantsBlock(facts) {
	return `const float ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS = ${formatFloat(facts.rayleighScaleHeightMeters)};
const float ATMOSPHERE_MIE_SCALE_HEIGHT_METERS = ${formatFloat(facts.mieScaleHeightMeters)};
const float ATMOSPHERE_RAYLEIGH_COEFFICIENT_SCALE = ${formatFloat(facts.rayleighCoefficientScale)};
const float ATMOSPHERE_MIE_ANGSTROM_ALPHA = ${formatFloat(facts.mieAngstromAlpha)};
const float ATMOSPHERE_MIE_ANGSTROM_BETA = ${formatFloat(facts.mieAngstromBeta)};
const float ATMOSPHERE_MIE_SINGLE_SCATTERING_ALBEDO = ${formatFloat(facts.mieSingleScatteringAlbedo)};
const float ATMOSPHERE_MIE_PHASE_FUNCTION_G = ${formatFloat(facts.miePhaseFunctionG)};
const float ATMOSPHERE_WAVELENGTH_MICROMETERS[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => WavelengthMath.toMicrometers(channel.wavelength)))});`;
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

export default CanonicalAtmosphere;
