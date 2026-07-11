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
 * Store production shader quality profiles promoted from the reconciliation
 * performance benchmark lane.
 *
 * @type {readonly ShaderQualityProfile[]}
 */
export const SHADER_QUALITY_PROFILES = Object.freeze([
	freezeQualityProfile({
		id: 'ideal',
		label: 'Ideal',
		role: 'reference',
		numericalControls: RUNTIME_NUMERICAL_CONTROLS,
		notes: 'Full current Algorithm32 runtime controls.',
	}),
	freezeQualityProfile({
		id: 'balanced',
		label: 'Balanced',
		role: 'candidate',
		numericalControls: {
			pathIntervalCount: 28,
			sourceTransmittanceIntervalCount: 14,
			incidentDirectionCount: 24,
			incidentAltitudeBinCount: 36,
		},
		notes: 'Reduced dominant transport and incident-cache loop counts.',
	}),
	freezeQualityProfile({
		id: 'balanced-cache-interp',
		label: 'Balanced Cache Interp',
		role: 'candidate',
		numericalControls: {
			pathIntervalCount: 28,
			sourceTransmittanceIntervalCount: 14,
			incidentDirectionCount: 24,
			incidentAltitudeBinCount: 36,
		},
		cacheOptimization: Object.freeze({
			altitudeLookup: Object.freeze({
				kind: 'linear-altitude-v1',
			}),
		}),
		notes: 'Balanced counts with linear interpolation between distant incident-cache altitude bins.',
	}),
	freezeQualityProfile({
		id: 'adaptive-balanced',
		label: 'Adaptive Balanced',
		role: 'candidate',
		numericalControls: {
			pathIntervalCount: 28,
			sourceTransmittanceIntervalCount: 14,
			incidentDirectionCount: 24,
			incidentAltitudeBinCount: 36,
		},
		transportOptimization: Object.freeze({
			pathSampleDistribution: Object.freeze({
				kind: 'tangent-density-adaptive-v1',
			}),
		}),
		notes: 'Balanced counts with tangent/density-adaptive view-path samples.',
	}),
	freezeQualityProfile({
		id: 'adaptive-balanced-soft',
		label: 'Soft Adaptive Balanced',
		role: 'candidate',
		numericalControls: {
			pathIntervalCount: 28,
			sourceTransmittanceIntervalCount: 14,
			incidentDirectionCount: 24,
			incidentAltitudeBinCount: 36,
		},
		transportOptimization: Object.freeze({
			pathSampleDistribution: Object.freeze({
				kind: 'tangent-density-adaptive-soft-v1',
			}),
		}),
		notes: 'Balanced counts with a softer blend toward tangent/density-adaptive samples.',
	}),
	freezeQualityProfile({
		id: 'fast',
		label: 'Fast',
		role: 'candidate',
		numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
		notes: 'Aggressive Step032 runtime controls.',
	}),
	freezeQualityProfile({
		id: 'fast-cache-interp',
		label: 'Fast Cache Interp',
		role: 'candidate',
		numericalControls: STEP032_ARTIFACT_NUMERICAL_CONTROLS,
		cacheOptimization: Object.freeze({
			altitudeLookup: Object.freeze({
				kind: 'linear-altitude-v1',
			}),
		}),
		notes: 'Fast counts with linear interpolation between distant incident-cache altitude bins.',
	}),
	freezeQualityProfile({
		id: 'draft',
		label: 'Draft',
		role: 'candidate',
		numericalControls: {
			pathIntervalCount: 12,
			sourceTransmittanceIntervalCount: 6,
			incidentDirectionCount: 9,
			incidentAltitudeBinCount: 16,
		},
		notes: 'Very low-cost diagnostic runtime controls.',
	}),
]);

/**
 * Resolve a production shader quality profile by id.
 *
 * @param {string} profileId - Supplies the requested profile id.
 * @returns {ShaderQualityProfile} Return the profile.
 */
export function shaderQualityProfileById(profileId) {
	const profile = SHADER_QUALITY_PROFILES.find((entry) => entry.id === profileId);

	if (!profile) {
		throw new Error(`Unknown shader quality profile: ${profileId}`);
	}

	return profile;
}

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

/**
 * Freeze a shader quality profile and attach its work estimate.
 *
 * @param {object} profile - Supplies profile fields.
 * @returns {ShaderQualityProfile} Return the frozen profile.
 */
function freezeQualityProfile(profile) {
	const numericalControls = Object.freeze({ ...profile.numericalControls });
	const workEstimate = estimateShaderQualityWork(numericalControls);
	const idealWork = estimateShaderQualityWork(RUNTIME_NUMERICAL_CONTROLS);

	return Object.freeze({
		...profile,
		numericalControls,
		workEstimate,
		estimatedWorkRatioToIdeal: workEstimate.totalDominantSpectralSteps
			/ idealWork.totalDominantSpectralSteps,
		transportOptimization: profile.transportOptimization ?? null,
		cacheOptimization: profile.cacheOptimization ?? null,
	});
}

/**
 * Estimate the dominant per-pixel spectral loop work for one profile.
 *
 * @param {Algorithm32NumericalControls} controls - Supplies numerical controls.
 * @returns {ShaderQualityWorkEstimate} Return work estimate.
 */
function estimateShaderQualityWork(controls) {
	const pathPointCount = controls.pathIntervalCount + 1;
	const sourceTransmittancePointCount = controls.sourceTransmittanceIntervalCount + 1;
	const spectralChannelCount = CANONICAL_SPECTRAL_CHANNELS.length;
	const incidentSpectralSteps = pathPointCount
		* controls.incidentDirectionCount
		* spectralChannelCount;
	const sourceTransmittanceSpectralSteps = pathPointCount
		* sourceTransmittancePointCount
		* spectralChannelCount;
	const totalDominantSpectralSteps = incidentSpectralSteps + sourceTransmittanceSpectralSteps;

	return Object.freeze({
		pathPointCount,
		sourceTransmittancePointCount,
		spectralChannelCount,
		incidentDirectionCount: controls.incidentDirectionCount,
		incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
		incidentSpectralSteps,
		sourceTransmittanceSpectralSteps,
		totalDominantSpectralSteps,
	});
}
