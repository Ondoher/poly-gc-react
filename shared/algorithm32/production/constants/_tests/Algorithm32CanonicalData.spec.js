import {
	CANONICAL_ATMOSPHERE_CONSTANTS,
	CANONICAL_SPECTRAL_BASIS,
	CANONICAL_SPECTRAL_CHANNELS,
	FIGURE1_DISPLAY_CONSTANTS,
	RUNTIME_NUMERICAL_CONTROLS,
	STEP032_ARTIFACT_NUMERICAL_CONTROLS,
	VALIDATION_NUMERICAL_CONTROLS,
} from '../Algorithm32CanonicalData.js';

describe('Algorithm32 canonical data', () => {
	it('promotes the accepted canonical atmosphere constants', () => {
		expect(CANONICAL_ATMOSPHERE_CONSTANTS).toEqual(jasmine.objectContaining({
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
		}));
	});

	it('promotes the accepted canonical spectral channels', () => {
		expect(CANONICAL_SPECTRAL_CHANNELS.length).toBe(15);
		expect(CANONICAL_SPECTRAL_CHANNELS[0]).toEqual({
			name: 'lambda-376',
			wavelength: {
				value: 375.6666666666667,
				units: 'nanometers',
			},
			solarIrradiance: 1.0688666666666664,
			wavelengthBinWidth: {
				value: 31.333333333333332,
				units: 'nanometers',
			},
		});
		expect(CANONICAL_SPECTRAL_CHANNELS[14]).toEqual({
			name: 'lambda-814',
			wavelength: {
				value: 814.3333333333333,
				units: 'nanometers',
			},
			solarIrradiance: 1.090824,
			wavelengthBinWidth: {
				value: 31.333333333333332,
				units: 'nanometers',
			},
		});
	});

	it('derives the unit-bearing facade spectral basis from the channel centers', () => {
		expect(CANONICAL_SPECTRAL_BASIS.wavelengths.length).toBe(15);
		expect(CANONICAL_SPECTRAL_BASIS.wavelengths[0]).toEqual({
			value: 375.6666666666667,
			units: 'nanometers',
		});
		expect(CANONICAL_SPECTRAL_BASIS.wavelengths[14]).toEqual({
			value: 814.3333333333333,
			units: 'nanometers',
		});
	});

	it('promotes the accepted Figure 1 display constants', () => {
		expect(FIGURE1_DISPLAY_CONSTANTS).toEqual(jasmine.objectContaining({
			conversionKind: 'cie-xyz-to-linear-srgb-paper-figure1-tone-map',
			outputColorSpace: 'linear-srgb',
			maxLuminousEfficacyLumensPerWatt: 683,
			brunetonComparisonToneMapExposureScale: 5,
			paperFigure1ToneMapK: 1 / (5 * 683),
			demoGammaPowerOmitted: true,
			demoWhitePointOmitted: true,
		}));
		expect(FIGURE1_DISPLAY_CONSTANTS.xyzToLinearSrgbMatrix[0])
			.toEqual([3.2406, -1.5372, -0.4986]);
	});

	it('promotes the accepted runtime numerical controls', () => {
		expect(RUNTIME_NUMERICAL_CONTROLS).toEqual({
			pathIntervalCount: 40,
			sourceTransmittanceIntervalCount: 20,
			incidentDirectionCount: 34,
			incidentAltitudeBinCount: 48,
		});
		expect(VALIDATION_NUMERICAL_CONTROLS).toEqual({
			pathIntervalCount: 80,
			sourceTransmittanceIntervalCount: 40,
			incidentDirectionCount: 68,
			incidentAltitudeBinCount: 96,
		});
		expect(STEP032_ARTIFACT_NUMERICAL_CONTROLS).toEqual({
			pathIntervalCount: 20,
			sourceTransmittanceIntervalCount: 10,
			incidentDirectionCount: 17,
			incidentAltitudeBinCount: 24,
		});
	});
});
