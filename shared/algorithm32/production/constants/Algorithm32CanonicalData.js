/**
 * Source: reconciliation POC canonical constants (script a32-poc-color-032).
 */

/**
 * Store the accepted canonical atmosphere constants.
 *
 * @type {CanonicalAtmosphereConstants}
 */
export const CANONICAL_ATMOSPHERE_CONSTANTS = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 0.00000124062,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
	ozoneAbsorptionEnabled: false,
});

/**
 * Store the accepted canonical spectral channels.
 *
 * @type {readonly SpectralChannelConstant[]}
 */
export const CANONICAL_SPECTRAL_CHANNELS = Object.freeze([
	freezeSpectralChannel('lambda-376', 375.6666666666667, 1.0688666666666664),
	freezeSpectralChannel('lambda-407', 407, 1.729673),
	freezeSpectralChannel('lambda-438', 438.3333333333333, 1.8620716666666661),
	freezeSpectralChannel('lambda-470', 469.66666666666663, 2.0220633333333335),
	freezeSpectralChannel('lambda-501', 501, 1.9081540000000001),
	freezeSpectralChannel('lambda-532', 532.3333333333333, 1.8833910000000003),
	freezeSpectralChannel('lambda-564', 563.6666666666666, 1.8342466666666666),
	freezeSpectralChannel('lambda-595', 595, 1.7674400000000001),
	freezeSpectralChannel('lambda-626', 626.3333333333333, 1.65952),
	freezeSpectralChannel('lambda-658', 657.6666666666666, 1.548102333333333),
	freezeSpectralChannel('lambda-689', 689, 1.45078),
	freezeSpectralChannel('lambda-720', 720.3333333333333, 1.3409603333333335),
	freezeSpectralChannel('lambda-752', 751.6666666666666, 1.2624333333333335),
	freezeSpectralChannel('lambda-783', 783, 1.175208),
	freezeSpectralChannel('lambda-814', 814.3333333333333, 1.090824),
]);

/**
 * Store the facade-facing unit-bearing spectral basis derived from the
 * accepted canonical channels.
 *
 * @type {SpectralBasis}
 */
export const CANONICAL_SPECTRAL_BASIS = Object.freeze({
	wavelengths: Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.wavelength)),
});

/**
 * Store the accepted display-conversion constants for the Figure 1 adapter.
 *
 * @type {Figure1DisplayConstants}
 */
export const FIGURE1_DISPLAY_CONSTANTS = Object.freeze({
	conversionKind: 'cie-xyz-to-linear-srgb-paper-figure1-tone-map',
	outputColorSpace: 'linear-srgb',
	maxLuminousEfficacyLumensPerWatt: 683,
	brunetonComparisonToneMapExposureScale: 5,
	paperFigure1ToneMapK: 1 / (5 * 683),
	xyzToLinearSrgbMatrix: Object.freeze([
		Object.freeze([3.2406, -1.5372, -0.4986]),
		Object.freeze([-0.9689, 1.8758, 0.0415]),
		Object.freeze([0.0557, -0.204, 1.057]),
	]),
	demoGammaPowerOmitted: true,
	demoWhitePointOmitted: true,
});

/**
 * Store the accepted runtime numerical controls.
 *
 * @type {Algorithm32NumericalControls}
 */
export const RUNTIME_NUMERICAL_CONTROLS = Object.freeze({
	pathIntervalCount: 40,
	sourceTransmittanceIntervalCount: 20,
	incidentDirectionCount: 34,
	incidentAltitudeBinCount: 48,
});

/**
 * Store the accepted validation numerical controls.
 *
 * @type {Algorithm32NumericalControls}
 */
export const VALIDATION_NUMERICAL_CONTROLS = Object.freeze({
	pathIntervalCount: 80,
	sourceTransmittanceIntervalCount: 40,
	incidentDirectionCount: 68,
	incidentAltitudeBinCount: 96,
});

/**
 * Store the accepted Step 032 artifact numerical controls.
 *
 * @type {Algorithm32NumericalControls}
 */
export const STEP032_ARTIFACT_NUMERICAL_CONTROLS = Object.freeze({
	pathIntervalCount: 20,
	sourceTransmittanceIntervalCount: 10,
	incidentDirectionCount: 17,
	incidentAltitudeBinCount: 24,
});

/**
 * Create one immutable canonical spectral channel.
 *
 * @param {string} name - Supplies the accepted channel name.
 * @param {number} wavelengthValue - Supplies the channel center wavelength.
 * @param {number} solarIrradiance - Supplies the channel irradiance.
 * @returns {SpectralChannelConstant} Return the frozen channel constant.
 */
function freezeSpectralChannel(name, wavelengthValue, solarIrradiance) {
	return Object.freeze({
		name,
		wavelength: Object.freeze({
			value: wavelengthValue,
			units: 'nanometers',
		}),
		solarIrradiance,
		wavelengthBinWidth: Object.freeze({
			value: 31.333333333333332,
			units: 'nanometers',
		}),
	});
}
