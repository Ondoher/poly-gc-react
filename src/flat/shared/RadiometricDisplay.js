import {
	clamp,
	cloneRgb,
	finiteNumber,
	rgbFrom,
	scaleRgb,
} from './math-primitives.js';

const DEFAULT_DISPLAY_CONFIG = Object.freeze({
	model: 'radiometric-display-v1',
	radiometricToSceneRgbScale: 1,
	exposure: 1,
	toneMapping: 'linear-clamp',
});

/**
 * Create normalized radiometric display settings.
 *
 * This model is the renderer/display boundary. Inputs to
 * `mapRadianceToDisplayRgb()` should be radiometric or relative-radiometric
 * RGB values; this config decides how those values become display RGB.
 *
 * @param {Partial<FlatRadiometricDisplayConfig> | null | undefined} config - Override display settings.
 * @returns {Readonly<FlatRadiometricDisplayConfig>} Normalized display settings.
 */
export function createRadiometricDisplayConfig(config = {}) {
	const toneMapping = config?.toneMapping || DEFAULT_DISPLAY_CONFIG.toneMapping;

	if (!['linear-clamp', 'reinhard'].includes(toneMapping)) {
		throw new Error(`Unknown radiometric display tone mapping "${toneMapping}".`);
	}

	return Object.freeze({
		model: config?.model || DEFAULT_DISPLAY_CONFIG.model,
		radiometricToSceneRgbScale: Math.max(
			0,
			finiteNumber(
				config?.radiometricToSceneRgbScale,
				DEFAULT_DISPLAY_CONFIG.radiometricToSceneRgbScale,
			),
		),
		exposure: Math.max(
			0,
			finiteNumber(config?.exposure, DEFAULT_DISPLAY_CONFIG.exposure),
		),
		toneMapping,
	});
}

/**
 * Apply the selected tone-mapping curve to one linear channel.
 *
 * @param {number} value - Provide an exposed scene-linear channel.
 * @param {FlatRadiometricDisplayToneMapping} toneMapping - Select the display curve.
 * @returns {number} Display-normalized channel in `[0, 1]`.
 */
function toneMapChannel(value, toneMapping) {
	const finiteValue = Math.max(0, finiteNumber(value, 0));

	if (toneMapping === 'reinhard') {
		return finiteValue / (1 + finiteValue);
	}

	return clamp(finiteValue, 0, 1);
}

/**
 * Map radiometric RGB into display-normalized RGB.
 *
 * @param {FlatRgbColorInput | null | undefined} rgbRadiance - Provide radiometric or relative-radiometric RGB.
 * @param {Partial<FlatRadiometricDisplayConfig> | null | undefined} config - Provide display settings.
 * @returns {Readonly<FlatRgbColor>} Display-normalized RGB in `[0, 1]`.
 */
export function mapRadianceToDisplayRgb(rgbRadiance, config = {}) {
	const displayConfig = createRadiometricDisplayConfig(config);
	const radiance = rgbFrom(rgbRadiance, { r: 0, g: 0, b: 0 });
	const exposed = scaleRgb(
		radiance,
		displayConfig.radiometricToSceneRgbScale * displayConfig.exposure,
	);

	return cloneRgb({
		r: toneMapChannel(exposed.r, displayConfig.toneMapping),
		g: toneMapChannel(exposed.g, displayConfig.toneMapping),
		b: toneMapChannel(exposed.b, displayConfig.toneMapping),
	});
}
