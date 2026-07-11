import { FIGURE1_DISPLAY_CONSTANTS, CANONICAL_SPECTRAL_CHANNELS } from '../constants/Algorithm32CanonicalData.js';
import ScalarMath from '../utils/ScalarMath.js';
import WavelengthMath from '../utils/WavelengthMath.js';
import { stableHash } from '../shader/stableHash.js';

/**
 * Source: reconciliation POC display model and shader contribution
 * (script a32-poc-color-032).
 */

/**
 * Convert Algorithm32 spectral output through the accepted Figure 1 display
 * adapter.
 */
export class BrunetonColorDisplayModel {
	/**
	 * Create the display model.
	 *
	 * @param {{ readonly displayConstants?: Figure1DisplayConstants }} [configuration] - Supplies optional display constants.
	 */
	constructor(configuration = {}) {
		this._displayConstants = freezeDisplayConstants(configuration.displayConstants ?? FIGURE1_DISPLAY_CONSTANTS);
		this._spectralReflectanceCache = new Map();
		this._linearSrgbBasisMatrix = null;
	}

	/**
	 * Identify this configured color conversion instance.
	 *
	 * @returns {string} Return the color conversion id.
	 */
	get id() {
		return 'bruneton-figure1-display';
	}

	/**
	 * Return the immutable display constants.
	 *
	 * @returns {Figure1DisplayConstants} Return the display constants.
	 */
	get displayConstants() {
		return this._displayConstants;
	}

	/**
	 * Describe the configured display conversion.
	 *
	 * @returns {DisplayConversionDescriptor} Return the display conversion descriptor.
	 */
	describeDisplayConversion() {
		return Object.freeze({
			conversionKind: this._displayConstants.conversionKind,
			outputColorSpace: this._displayConstants.outputColorSpace,
			toneMapping: 'paper-figure1-exponential',
			metadata: Object.freeze({
				maxLuminousEfficacyLumensPerWatt: this._displayConstants.maxLuminousEfficacyLumensPerWatt,
				paperFigure1ToneMapK: this._displayConstants.paperFigure1ToneMapK,
				demoGammaPowerOmitted: this._displayConstants.demoGammaPowerOmitted,
				demoWhitePointOmitted: this._displayConstants.demoWhitePointOmitted,
			}),
		});
	}

	/**
	 * Return a serializable Color descriptor for compatibility checks.
	 *
	 * @returns {ColorDescriptor} Return the configured color descriptor.
	 */
	describe() {
		const displayConversion = this.describeDisplayConversion();
		const body = Object.freeze({
			kind: 'algorithm32-color',
			id: this.id,
			colorSpace: displayConversion.outputColorSpace,
			conversionKind: displayConversion.conversionKind,
			displayConversion,
		});

		return Object.freeze({
			...body,
			fingerprint: stableHash(body),
		});
	}

	/**
	 * Convert spectral radiance into display-facing color channels.
	 *
	 * @param {ColorConversionRequest} request - Supplies the spectral sample and active basis.
	 * @returns {ColorSample} Return the converted display color sample.
	 */
	convert(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Color conversion request is required.');
		}

		assertSpectralValue(request.spectralRadiance, 'spectralRadiance');
		assertSpectralBasisAligned(request.spectral);

		return Object.freeze({
			channels: this.radianceToDisplayRgb(request.spectralRadiance),
			colorSpace: this._displayConstants.outputColorSpace,
		});
	}

	/**
	 * Convert spectral radiance into display RGB through the accepted adapter.
	 *
	 * @param {SpectralValue} radiance - Supplies spectral radiance on the canonical basis.
	 * @returns {readonly [number, number, number]} Return display RGB.
	 */
	radianceToDisplayRgb(radiance) {
		return this.linearSrgbToDisplayRgb(this.radianceToLinearSrgb(radiance));
	}

	/**
	 * Apply the accepted Figure 1 exponential tone map.
	 *
	 * @param {readonly [number, number, number]} linearSrgb - Supplies linear sRGB values.
	 * @returns {readonly [number, number, number]} Return display RGB values.
	 */
	linearSrgbToDisplayRgb(linearSrgb) {
		assertRgbTriplet(linearSrgb, 'linearSrgbToDisplayRgb');

		return Object.freeze(linearSrgb.map((value) =>
			ScalarMath.clamp(
				1 - Math.exp(-Math.max(0, value) * this._displayConstants.paperFigure1ToneMapK),
				0,
				1,
			)));
	}

	/**
	 * Convert renderer-captured linear sRGB scene color into display RGB before
	 * applying the Figure 1 inverse tone-map bridge.
	 *
	 * @param {readonly [number, number, number]} linearSrgb - Supplies renderer linear sRGB.
	 * @returns {readonly [number, number, number]} Return display-encoded RGB.
	 */
	rendererLinearSrgbToDisplayRgb(linearSrgb) {
		assertRgbTriplet(linearSrgb, 'rendererLinearSrgbToDisplayRgb');

		return Object.freeze(linearSrgb.map(linearSrgbChannelToDisplayRgb));
	}

	/**
	 * Invert the accepted Figure 1 exponential tone map for scene endpoint
	 * composition.
	 *
	 * @param {readonly [number, number, number]} displayRgb - Supplies display RGB values.
	 * @returns {readonly [number, number, number]} Return linear sRGB proxy values.
	 */
	displayRgbToLinearSrgb(displayRgb) {
		assertRgbTriplet(displayRgb, 'displayRgbToLinearSrgb');

		return Object.freeze(displayRgb.map((value) => {
			const clamped = ScalarMath.clamp(value, 0, 0.999999);

			return -Math.log(1 - clamped) / this._displayConstants.paperFigure1ToneMapK;
		}));
	}

	/**
	 * Collapse spectral view transmittance into the RGB bands used by the
	 * display compositor.
	 *
	 * @param {SpectralValue} transmittance - Supplies canonical spectral transmittance.
	 * @returns {readonly [number, number, number]} Return RGB transmittance bands.
	 */
	spectralTransmittanceToRgbBands(transmittance) {
		assertSpectralValue(transmittance, 'transmittance');

		const red = average(transmittance.slice(8));
		const green = average(transmittance.slice(4, 9));
		const blue = average(transmittance.slice(0, 5));

		return Object.freeze([red, green, blue]);
	}

	/**
	 * Compose spectral path radiance over the captured scene color in linear
	 * sRGB, mirroring the runtime shader compositor.
	 *
	 * @param {SceneDisplayCompositionRequest} request - Supplies path and scene color facts.
	 * @returns {readonly [number, number, number]} Return composed linear sRGB.
	 */
	composeSceneLinearSrgb(request) {
		if (!request || typeof request !== 'object') {
			throw new TypeError('Scene display composition request is required.');
		}

		assertSpectralValue(request.pathRadiance, 'pathRadiance');
		assertSpectralValue(request.transmittance, 'transmittance');
		assertRgbTriplet(request.sceneDisplayRgb, 'sceneDisplayRgb');

		const pathLinearSrgb = this.radianceToLinearSrgb(request.pathRadiance);
		const sceneDisplayRgb = request.sceneColorSpace === 'linear-srgb'
			? this.rendererLinearSrgbToDisplayRgb(request.sceneDisplayRgb)
			: request.sceneDisplayRgb;
		const sceneLinearSrgb = this.displayRgbToLinearSrgb(sceneDisplayRgb);
		const transmittanceRgb = this.spectralTransmittanceToRgbBands(request.transmittance);
		const sceneTransmittanceRgb = request.applySceneTransmittance === false
			? Object.freeze([1, 1, 1])
			: transmittanceRgb;

		return Object.freeze(pathLinearSrgb.map((value, index) =>
			value + sceneLinearSrgb[index] * sceneTransmittanceRgb[index]));
	}

	/**
	 * Compose spectral path radiance over the captured scene color and encode it
	 * through the accepted display adapter.
	 *
	 * @param {SceneDisplayCompositionRequest} request - Supplies path and scene color facts.
	 * @returns {readonly [number, number, number]} Return composed display RGB.
	 */
	composeSceneDisplayRgb(request) {
		return this.linearSrgbToDisplayRgb(this.composeSceneLinearSrgb(request));
	}

	/**
	 * Convert spectral radiance to linear sRGB through the accepted CIE table.
	 *
	 * @param {SpectralValue} radiance - Supplies spectral radiance on the canonical basis.
	 * @returns {readonly [number, number, number]} Return linear sRGB values.
	 */
	radianceToLinearSrgb(radiance) {
		assertSpectralValue(radiance, 'radiance');

		let x = 0;
		let y = 0;
		let z = 0;

		for (let channelIndex = 0; channelIndex < CANONICAL_SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const channel = CANONICAL_SPECTRAL_CHANNELS[channelIndex];
			const channelRadiance = radiance[channelIndex];
			const wavelengthNanometers = WavelengthMath.toNanometers(channel.wavelength);
			const deltaNanometers = WavelengthMath.toNanometers(channel.wavelengthBinWidth);

			x += cieColorMatchingValue(wavelengthNanometers, 1) * channelRadiance * deltaNanometers;
			y += cieColorMatchingValue(wavelengthNanometers, 2) * channelRadiance * deltaNanometers;
			z += cieColorMatchingValue(wavelengthNanometers, 3) * channelRadiance * deltaNanometers;
		}

		const matrix = this._displayConstants.xyzToLinearSrgbMatrix;
		const efficacy = this._displayConstants.maxLuminousEfficacyLumensPerWatt;

		return Object.freeze([
			efficacy * (matrix[0][0] * x + matrix[0][1] * y + matrix[0][2] * z),
			efficacy * (matrix[1][0] * x + matrix[1][1] * y + matrix[1][2] * z),
			efficacy * (matrix[2][0] * x + matrix[2][1] * y + matrix[2][2] * z),
		]);
	}

	/**
	 * Fit a linear sRGB matte albedo into canonical spectral reflectance.
	 *
	 * @param {readonly [number, number, number]} linearSrgbAlbedo - Supplies a linear sRGB matte albedo.
	 * @returns {SpectralValue} Return fitted spectral reflectance.
	 */
	linearSrgbAlbedoToSpectralReflectance(linearSrgbAlbedo) {
		assertRgbTriplet(linearSrgbAlbedo, 'linearSrgbAlbedoToSpectralReflectance');

		const target = Object.freeze(linearSrgbAlbedo.map((value) => ScalarMath.clamp(value, 0, 1)));
		const cacheKey = target.map((value) => value.toFixed(6)).join(',');
		const cached = this._spectralReflectanceCache.get(cacheKey);

		if (cached) {
			return cached;
		}

		const matrix = this._linearSrgbBasisMatrix ?? this._buildNormalizedLinearSrgbBasisMatrix();
		this._linearSrgbBasisMatrix = matrix;

		const reflectance = Array.from({ length: CANONICAL_SPECTRAL_CHANNELS.length }, () =>
			(target[0] + target[1] + target[2]) / 3);
		const smoothnessWeight = 0.015;
		const energyWeight = 0.0005;
		const stepSize = 0.08;

		for (let iteration = 0; iteration < 800; iteration += 1) {
			const predicted = multiplyMatrixVector(matrix, reflectance);
			const error = [
				predicted[0] - target[0],
				predicted[1] - target[1],
				predicted[2] - target[2],
			];
			const gradient = Array.from({ length: reflectance.length }, (_, index) =>
				2 * (
					matrix[0][index] * error[0]
					+ matrix[1][index] * error[1]
					+ matrix[2][index] * error[2]
				) + 2 * energyWeight * reflectance[index]);

			for (let index = 1; index < reflectance.length - 1; index += 1) {
				gradient[index] += 2 * smoothnessWeight
					* (2 * reflectance[index] - reflectance[index - 1] - reflectance[index + 1]);
			}

			for (let index = 0; index < reflectance.length; index += 1) {
				reflectance[index] = ScalarMath.clamp(reflectance[index] - stepSize * gradient[index], 0, 1);
			}
		}

		const spectralReflectance = Object.freeze(reflectance);
		this._spectralReflectanceCache.set(cacheKey, spectralReflectance);

		return spectralReflectance;
	}

	/**
	 * Create a Color-owned shader contribution for the active descriptor.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} Return the display-conversion shader contribution.
	 */
	createShaderContribution(request) {
		const descriptor = request?.descriptor;

		if (!descriptor?.color) {
			throw new TypeError('BrunetonColorDisplayModel shader contribution requires a color descriptor.');
		}

		const channelCount = descriptor.spectralBasis?.facts?.channelCount
			?? descriptor.spectralBasis?.facts?.channels?.length
			?? descriptor.spectralBasis?.facts?.wavelengths?.length;

		if (channelCount !== CANONICAL_SPECTRAL_CHANNELS.length) {
			throw new RangeError('BrunetonColorDisplayModel shader contribution requires the canonical spectral channel count.');
		}

		return contribution({
			id: 'color-bruneton-figure1-display',
			owner: 'color',
			descriptorFingerprint: descriptor.color.fingerprint,
			compatibilityTags: descriptor.color.compatibilityTags,
			provides: Object.freeze([
				'color.composeSceneColor',
				'color.encodeOutput',
			]),
			requires: Object.freeze([
				'runtime.initialState',
				'transport.evaluatePathRadiance',
			]),
			functions: Object.freeze([
				block('color-display-constants', 'declareConstants', 0, displayConstantsBlock(this._displayConstants)),
				block('color-compose-helper', 'composeSceneColor', 0, displayComposeBlock()),
				block('color-encode-helper', 'encodeOutput', 0, displayEncodeBlock()),
			]),
			mainHooks: Object.freeze([
				block('color-main-compose', 'composeSceneColor', 0, 'state.outputRgba = encodeDisplayOutput(composeSceneLinearSrgb(state));'),
				block('color-main-output', 'encodeOutput', 0, 'outColor = state.outputRgba;'),
			]),
			diagnostics: Object.freeze({
				mode: this.id,
				spectralChannelCount: CANONICAL_SPECTRAL_CHANNELS.length,
			}),
		});
	}

	/**
	 * Build the normalized fitting matrix used by albedo conversion.
	 *
	 * @returns {readonly (readonly number[])[]} Return the normalized basis matrix.
	 */
	_buildNormalizedLinearSrgbBasisMatrix() {
		const rows = [[], [], []];
		const whiteResponse = this.radianceToLinearSrgb(
			CANONICAL_SPECTRAL_CHANNELS.map(() => 1),
		).map((value) => Math.max(Math.abs(value), Number.EPSILON));

		for (let channelIndex = 0; channelIndex < CANONICAL_SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const basis = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => index === channelIndex ? 1 : 0);
			const linear = this.radianceToLinearSrgb(basis);

			rows[0].push(linear[0] / whiteResponse[0]);
			rows[1].push(linear[1] / whiteResponse[1]);
			rows[2].push(linear[2] / whiteResponse[2]);
		}

		return Object.freeze(rows.map((row) => Object.freeze(row)));
	}
}

/**
 * Multiply a matrix by a vector.
 *
 * @param {readonly (readonly number[])[]} matrix - Supplies matrix rows.
 * @param {readonly number[]} vector - Supplies the vector.
 * @returns {readonly number[]} Return the product.
 */
function multiplyMatrixVector(matrix, vector) {
	return Object.freeze(matrix.map((row) =>
		row.reduce((sum, value, index) => sum + value * vector[index], 0)));
}

/**
 * Average numeric values.
 *
 * @param {readonly number[]} values - Supplies values to average.
 * @returns {number} Return the average.
 */
function average(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Apply the standard sRGB display transfer to one linear channel.
 *
 * @param {number} value - Supplies a linear channel.
 * @returns {number} Return display-encoded channel.
 */
function linearSrgbChannelToDisplayRgb(value) {
	const clamped = ScalarMath.clamp(value, 0, 1);

	if (clamped <= 0.0031308) {
		return clamped * 12.92;
	}

	return 1.055 * (clamped ** (1 / 2.4)) - 0.055;
}

/**
 * Assert a finite RGB triplet.
 *
 * @param {unknown} value - Supplies the candidate.
 * @param {string} fieldName - Supplies the caller field name.
 * @returns {void}
 */
function assertRgbTriplet(value, fieldName) {
	if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
		throw new TypeError(`${fieldName} requires a finite RGB triplet.`);
	}
}

/**
 * Assert a spectral vector on the canonical display basis.
 *
 * @param {unknown} value - Supplies the candidate.
 * @param {string} fieldName - Supplies the caller field name.
 * @returns {void}
 */
function assertSpectralValue(value, fieldName) {
	if (
		!Array.isArray(value)
		|| value.length !== CANONICAL_SPECTRAL_CHANNELS.length
		|| !value.every(Number.isFinite)
	) {
		throw new TypeError(`${fieldName} requires a finite spectral value on the canonical basis.`);
	}
}

/**
 * Assert that a facade spectral basis matches the canonical display basis.
 *
 * @param {unknown} spectral - Supplies the candidate spectral basis.
 * @returns {void}
 */
function assertSpectralBasisAligned(spectral) {
	if (!spectral || !Array.isArray(spectral.wavelengths)) {
		throw new TypeError('Color conversion request requires a spectral basis.');
	}

	if (spectral.wavelengths.length !== CANONICAL_SPECTRAL_CHANNELS.length) {
		throw new RangeError('Color conversion spectral basis must match the canonical channel count.');
	}

	for (let index = 0; index < CANONICAL_SPECTRAL_CHANNELS.length; index += 1) {
		const wavelength = spectral.wavelengths[index];
		const expected = WavelengthMath.toNanometers(CANONICAL_SPECTRAL_CHANNELS[index].wavelength);

		if (wavelength?.units !== 'nanometers' || !ScalarMath.nearlyEqual(wavelength.value, expected, { epsilon: 1e-12 })) {
			throw new RangeError('Color conversion spectral basis must match the canonical wavelengths.');
		}
	}
}

/**
 * Return an interpolated CIE color matching value.
 *
 * @param {number} wavelength - Supplies the wavelength in nanometers.
 * @param {number} component - Supplies the component index.
 * @returns {number} Return the interpolated matching value.
 */
function cieColorMatchingValue(wavelength, component) {
	if (wavelength <= 360 || wavelength >= 830) {
		return 0;
	}

	for (let index = 0; index < CIE_2_DEG_COLOR_MATCHING_FUNCTIONS.length - 1; index += 1) {
		const current = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS[index];
		const next = CIE_2_DEG_COLOR_MATCHING_FUNCTIONS[index + 1];

		if (wavelength >= current[0] && wavelength <= next[0]) {
			const t = (wavelength - current[0]) / (next[0] - current[0]);

			return current[component] * (1 - t) + next[component] * t;
		}
	}

	return 0;
}

/**
 * Create one shader contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return the contribution.
 */
function contribution(configuration) {
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
 * Create one source block.
 *
 * @param {string} id - Supplies the block id.
 * @param {ShaderSourceSlot} slot - Supplies the assembly slot.
 * @param {number} order - Supplies the slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function block(id, slot, order, code) {
	return Object.freeze({
		id,
		slot,
		order,
		code,
	});
}

/**
 * Build the display constant GLSL block.
 *
 * @param {Figure1DisplayConstants} displayConstants - Supplies display constants.
 * @returns {string} Return GLSL source.
 */
function displayConstantsBlock(displayConstants) {
	return `const float DISPLAY_TONE_MAP_K = ${formatFloat(displayConstants.paperFigure1ToneMapK)};
const float DISPLAY_LINEAR_SRGB_R_BY_CHANNEL[${CANONICAL_SPECTRAL_CHANNELS.length}] = float[${CANONICAL_SPECTRAL_CHANNELS.length}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.r)});
const float DISPLAY_LINEAR_SRGB_G_BY_CHANNEL[${CANONICAL_SPECTRAL_CHANNELS.length}] = float[${CANONICAL_SPECTRAL_CHANNELS.length}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.g)});
const float DISPLAY_LINEAR_SRGB_B_BY_CHANNEL[${CANONICAL_SPECTRAL_CHANNELS.length}] = float[${CANONICAL_SPECTRAL_CHANNELS.length}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.b)});`;
}

/**
 * Build the display composition GLSL block.
 *
 * @returns {string} Return GLSL source.
 */
function displayComposeBlock() {
	return `vec3 spectralRadianceToLinearSrgb(SpectralValue radiance) {
	vec3 linearSrgb = vec3(0.0);
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		linearSrgb.r += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_R_BY_CHANNEL[channelIndex];
		linearSrgb.g += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_G_BY_CHANNEL[channelIndex];
		linearSrgb.b += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_B_BY_CHANNEL[channelIndex];
	}
	return linearSrgb;
}

vec3 spectralTransmittanceToRgbBands(SpectralValue transmittance) {
	float red = 0.0;
	for (int channelIndex = 8; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		red += transmittance.c[channelIndex];
	}
	float green = 0.0;
	for (int channelIndex = 4; channelIndex < 9; channelIndex += 1) {
		green += transmittance.c[channelIndex];
	}
	float blue = 0.0;
	for (int channelIndex = 0; channelIndex < 5; channelIndex += 1) {
		blue += transmittance.c[channelIndex];
	}
	return vec3(red / 7.0, green / 5.0, blue / 5.0);
}

vec3 displayRgbToLinearSrgb(vec3 displayRgb) {
	vec3 clamped = clamp(displayRgb, vec3(0.0), vec3(0.999999));
	return -log(vec3(1.0) - clamped) / DISPLAY_TONE_MAP_K;
}

float rendererLinearSrgbChannelToDisplayRgb(float value) {
	float clamped = clamp(value, 0.0, 1.0);
	if (clamped <= 0.0031308) {
		return clamped * 12.92;
	}
	return 1.055 * pow(clamped, 1.0 / 2.4) - 0.055;
}

vec3 rendererLinearSrgbToDisplayRgb(vec3 linearSrgb) {
	return vec3(
		rendererLinearSrgbChannelToDisplayRgb(linearSrgb.r),
		rendererLinearSrgbChannelToDisplayRgb(linearSrgb.g),
		rendererLinearSrgbChannelToDisplayRgb(linearSrgb.b)
	);
}

bool shouldApplySceneTransmittance(ShaderState state) {
	return state.bounds.hasSceneEndpoint
		&& state.bounds.endpointDistanceMeters <= state.bounds.endDistanceMeters + 0.001;
}

vec3 composeSceneLinearSrgb(ShaderState state) {
	vec3 pathLinearSrgb = spectralRadianceToLinearSrgb(state.pathRadiance);
	vec3 sceneDisplayRgb = rendererLinearSrgbToDisplayRgb(state.sceneDisplayRgb);
	vec3 sceneLinearSrgb = displayRgbToLinearSrgb(sceneDisplayRgb);
	vec3 transmittanceRgb = spectralTransmittanceToRgbBands(state.transmittance);
	vec3 sceneTransmittanceRgb = shouldApplySceneTransmittance(state) ? transmittanceRgb : vec3(1.0);
	return pathLinearSrgb + sceneLinearSrgb * sceneTransmittanceRgb;
}`;
}

/**
 * Build the display output encoding GLSL block.
 *
 * @returns {string} Return GLSL source.
 */
function displayEncodeBlock() {
	return `vec4 encodeDisplayOutput(vec3 linearSrgb) {
	vec3 mapped = clamp(vec3(1.0) - exp(-max(linearSrgb, vec3(0.0)) * DISPLAY_TONE_MAP_K), vec3(0.0), vec3(1.0));
	return vec4(mapped, 1.0);
}`;
}

/**
 * Format one number for deterministic GLSL output.
 *
 * @param {number} value - Supplies the numeric value.
 * @returns {string} Return formatted GLSL number text.
 */
function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

/**
 * Format an array for deterministic GLSL output.
 *
 * @param {readonly number[]} values - Supplies values to format.
 * @returns {string} Return formatted GLSL array entries.
 */
function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

/**
 * Build linear-sRGB channel weights for shader spectral conversion.
 *
 * @returns {{ readonly r: readonly number[], readonly g: readonly number[], readonly b: readonly number[] }} Return row weights.
 */
function buildDisplayLinearSrgbByChannel() {
	const displayModel = new BrunetonColorDisplayModel({
		displayConstants: FIGURE1_DISPLAY_CONSTANTS,
	});
	const rows = {
		r: [],
		g: [],
		b: [],
	};

	for (let channelIndex = 0; channelIndex < CANONICAL_SPECTRAL_CHANNELS.length; channelIndex += 1) {
		const basis = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => index === channelIndex ? 1 : 0);
		const linearSrgb = displayModel.radianceToLinearSrgb(basis);

		rows.r.push(linearSrgb[0]);
		rows.g.push(linearSrgb[1]);
		rows.b.push(linearSrgb[2]);
	}

	return Object.freeze({
		r: Object.freeze(rows.r),
		g: Object.freeze(rows.g),
		b: Object.freeze(rows.b),
	});
}

/**
 * Freeze a display-constant packet.
 *
 * @param {Figure1DisplayConstants} constants - Supplies display constants.
 * @returns {Figure1DisplayConstants} Return frozen display constants.
 */
function freezeDisplayConstants(constants) {
	return Object.freeze({
		...constants,
		xyzToLinearSrgbMatrix: Object.freeze(constants.xyzToLinearSrgbMatrix.map((row) =>
			Object.freeze([...row]))),
	});
}

const CIE_2_DEG_COLOR_MATCHING_FUNCTIONS = Object.freeze([
	Object.freeze([360, 0.0001299, 0.000003917, 0.0006061]),
	Object.freeze([365, 0.0002321, 0.000006965, 0.001086]),
	Object.freeze([370, 0.0004149, 0.00001239, 0.001946]),
	Object.freeze([375, 0.0007416, 0.00002202, 0.003486]),
	Object.freeze([380, 0.001368, 0.000039, 0.006450001]),
	Object.freeze([385, 0.002236, 0.000064, 0.01054999]),
	Object.freeze([390, 0.004243, 0.00012, 0.02005001]),
	Object.freeze([395, 0.00765, 0.000217, 0.03621]),
	Object.freeze([400, 0.01431, 0.000396, 0.06785001]),
	Object.freeze([405, 0.02319, 0.00064, 0.1102]),
	Object.freeze([410, 0.04351, 0.00121, 0.2074]),
	Object.freeze([415, 0.07763, 0.00218, 0.3713]),
	Object.freeze([420, 0.13438, 0.004, 0.6456]),
	Object.freeze([425, 0.21477, 0.0073, 1.0390501]),
	Object.freeze([430, 0.2839, 0.0116, 1.3856]),
	Object.freeze([435, 0.3285, 0.01684, 1.62296]),
	Object.freeze([440, 0.34828, 0.023, 1.74706]),
	Object.freeze([445, 0.34806, 0.0298, 1.7826]),
	Object.freeze([450, 0.3362, 0.038, 1.77211]),
	Object.freeze([455, 0.3187, 0.048, 1.7441]),
	Object.freeze([460, 0.2908, 0.06, 1.6692]),
	Object.freeze([465, 0.2511, 0.0739, 1.5281]),
	Object.freeze([470, 0.19536, 0.09098, 1.28764]),
	Object.freeze([475, 0.1421, 0.1126, 1.0419]),
	Object.freeze([480, 0.09564, 0.13902, 0.8129501]),
	Object.freeze([485, 0.05795001, 0.1693, 0.6162]),
	Object.freeze([490, 0.03201, 0.20802, 0.46518]),
	Object.freeze([495, 0.0147, 0.2586, 0.3533]),
	Object.freeze([500, 0.0049, 0.323, 0.272]),
	Object.freeze([505, 0.0024, 0.4073, 0.2123]),
	Object.freeze([510, 0.0093, 0.503, 0.1582]),
	Object.freeze([515, 0.0291, 0.6082, 0.1117]),
	Object.freeze([520, 0.06327, 0.71, 0.07824999]),
	Object.freeze([525, 0.1096, 0.7932, 0.05725001]),
	Object.freeze([530, 0.1655, 0.862, 0.04216]),
	Object.freeze([535, 0.2257499, 0.9148501, 0.02984]),
	Object.freeze([540, 0.2904, 0.954, 0.0203]),
	Object.freeze([545, 0.3597, 0.9803, 0.0134]),
	Object.freeze([550, 0.4334499, 0.9949501, 0.008749999]),
	Object.freeze([555, 0.5120501, 1, 0.005749999]),
	Object.freeze([560, 0.5945, 0.995, 0.0039]),
	Object.freeze([565, 0.6784, 0.9786, 0.002749999]),
	Object.freeze([570, 0.7621, 0.952, 0.0021]),
	Object.freeze([575, 0.8425, 0.9154, 0.0018]),
	Object.freeze([580, 0.9163, 0.87, 0.001650001]),
	Object.freeze([585, 0.9786, 0.8163, 0.0014]),
	Object.freeze([590, 1.0263, 0.757, 0.0011]),
	Object.freeze([595, 1.0567, 0.6949, 0.001]),
	Object.freeze([600, 1.0622, 0.631, 0.0008]),
	Object.freeze([605, 1.0456, 0.5668, 0.0006]),
	Object.freeze([610, 1.0026, 0.503, 0.00034]),
	Object.freeze([615, 0.9384, 0.4412, 0.00024]),
	Object.freeze([620, 0.8544499, 0.381, 0.00019]),
	Object.freeze([625, 0.7514, 0.321, 0.0001]),
	Object.freeze([630, 0.6424, 0.265, 0.00004999999]),
	Object.freeze([635, 0.5419, 0.217, 0.00003]),
	Object.freeze([640, 0.4479, 0.175, 0.00002]),
	Object.freeze([645, 0.3608, 0.1382, 0.00001]),
	Object.freeze([650, 0.2835, 0.107, 0]),
	Object.freeze([655, 0.2187, 0.0816, 0]),
	Object.freeze([660, 0.1649, 0.061, 0]),
	Object.freeze([665, 0.1212, 0.04458, 0]),
	Object.freeze([670, 0.0874, 0.032, 0]),
	Object.freeze([675, 0.0636, 0.0232, 0]),
	Object.freeze([680, 0.04677, 0.017, 0]),
	Object.freeze([685, 0.0329, 0.01192, 0]),
	Object.freeze([690, 0.0227, 0.00821, 0]),
	Object.freeze([695, 0.01584, 0.005723, 0]),
	Object.freeze([700, 0.01135916, 0.004102, 0]),
	Object.freeze([705, 0.008110916, 0.002929, 0]),
	Object.freeze([710, 0.005790346, 0.002091, 0]),
	Object.freeze([715, 0.004109457, 0.001484, 0]),
	Object.freeze([720, 0.002899327, 0.001047, 0]),
	Object.freeze([725, 0.00204919, 0.00074, 0]),
	Object.freeze([730, 0.001439971, 0.00052, 0]),
	Object.freeze([735, 0.0009999493, 0.0003611, 0]),
	Object.freeze([740, 0.0006900786, 0.0002492, 0]),
	Object.freeze([745, 0.0004760213, 0.0001719, 0]),
	Object.freeze([750, 0.0003323011, 0.00012, 0]),
	Object.freeze([755, 0.0002348261, 0.0000848, 0]),
	Object.freeze([760, 0.0001661505, 0.00006, 0]),
	Object.freeze([765, 0.000117413, 0.0000424, 0]),
	Object.freeze([770, 0.00008307527, 0.00003, 0]),
	Object.freeze([775, 0.00005870652, 0.0000212, 0]),
	Object.freeze([780, 0.00004150994, 0.00001499, 0]),
	Object.freeze([785, 0.00002935326, 0.0000106, 0]),
	Object.freeze([790, 0.00002067383, 0.0000074657, 0]),
	Object.freeze([795, 0.00001455977, 0.0000052578, 0]),
	Object.freeze([800, 0.00001025398, 0.0000037029, 0]),
	Object.freeze([805, 0.000007221456, 0.0000026078, 0]),
	Object.freeze([810, 0.000005085868, 0.0000018366, 0]),
	Object.freeze([815, 0.000003581652, 0.0000012934, 0]),
	Object.freeze([820, 0.000002522525, 0.00000091093, 0]),
	Object.freeze([825, 0.000001776509, 0.00000064153, 0]),
	Object.freeze([830, 0.000001251141, 0.00000045181, 0]),
]);

const DISPLAY_LINEAR_SRGB_BY_CHANNEL = buildDisplayLinearSrgbByChannel();

export default BrunetonColorDisplayModel;
