import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CpuSpectralReferenceIntegrator } from './reference/index.js';
import {
	DEFAULT_LIGHT_EXTENT_CONFIG_PATH,
	buildLightExtentMarkdownReport,
	buildLightExtentSvg,
	formatLightExtentSummary,
	loadLightExtentConfig,
	runLightExtentProbeSet,
} from './reference/light-extent-probe.js';
import {
	linearRgbToPixel,
	pixelImageToPng,
	pixelImageToPpm,
	referenceOutputsToPixelImage,
} from './color/pixel-output.js';
import {
	spectralRadianceToLinearSrgb,
	spectralToApproximateSrgb,
} from './color/spectral-color.js';
import {
	SOLAR_SPECTRUM_POLICY_IDS,
	sampleSolarSpectrum,
} from './color/solar-spectrum.js';
import {
	RAYLEIGH_POLICY_IDS,
	rayleighCoefficientsForPolicy,
	resolveRayleighPolicy,
} from './composition/rayleigh-policy.js';
import {
	OZONE_POLICY_IDS,
	ozoneCrossSectionsForPolicy,
	resolveOzonePolicy,
} from './composition/ozone-policy.js';
import {
	aerosolCoefficientsForPolicy,
	aerosolPolicyIds,
	resolveAerosolPolicy,
} from './composition/aerosol-policy.js';
import {
	aerosolPhasePolicyIds,
	resolveAerosolPhasePolicy,
} from './composition/aerosol-phase-policy.js';
import {
	MOLECULAR_PROFILE_POLICY_IDS,
	molecularDensityScaleForPolicy,
	resolveMolecularProfilePolicy,
} from './composition/profile-policy.js';
import {
	evaluatePhaseByWavelength,
	evaluatePhaseValue,
} from './reference/phase-functions.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_STAGE = 'full';
const DEFAULT_FORMAT = 'json';
const DEFAULT_COLOR_POLICY = 'official-cie';
const DEFAULT_PIXEL_ENCODING = 'srgb';
const DEFAULT_TONE_MAP = 'clip';
const DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID = 'preview-20nm';
const BRUNETON_2016_WAVELENGTH_GRID_ID = 'bruneton-2016-40';
const BRUNETON_2016_ASTMG173_SOLAR_POLICY_ID = 'bruneton-2016-astm-40';
const BRUNETON_2016_RAYLEIGH_POLICY_ID = 'bruneton-2016-penndorf-standard-air';
const BRUNETON_2016_AEROSOL_POLICY_ID = 'bruneton-2016-kider-fit';
const BRUNETON_2016_AEROSOL_PHASE_POLICY_ID = 'bruneton-2016-cornette-shanks-g070';
const BRUNETON_2016_OZONE_POLICY_ID = 'bruneton-2016-no-visible-absorption';
const BRUNETON_2016_DOME_TONE_MAP = 'exponential';
const BRUNETON_2016_DOME_ENCODING = 'linear';
const DEFAULT_SOLAR_SPECTRUM_POLICY = 'blackbody-5778k';
const DEFAULT_RAYLEIGH_POLICY_ID = 'rayleigh-lambda4-preview';
const DEFAULT_OZONE_POLICY_ID = 'preview-chappuis';
const DEFAULT_AEROSOL_POLICY_ID = 'preview-earthlike-aerosol';
const DEFAULT_MOLECULAR_PROFILE_POLICY_ID = 'preview-exponential-8km';
const DEFAULT_SUN_VISUAL = 'none';
const SUN_VISUAL_OPTIONS = Object.freeze(['none', 'diagnostic']);
const BRUNETON_GROUND_SINGLE_BOUNCE_FIT = 'bruneton-ground-single-bounce-v1';
const LEGACY_BRUNETON_EDGE_AUREOLE_FIT = 'bruneton-edge-aureole-v1';
const DEFAULT_SKY_DOME_VISUAL_FIT = BRUNETON_GROUND_SINGLE_BOUNCE_FIT;
const SKY_DOME_VISUAL_FIT_OPTIONS = Object.freeze([
	'none',
	LEGACY_BRUNETON_EDGE_AUREOLE_FIT,
	BRUNETON_GROUND_SINGLE_BOUNCE_FIT,
]);
const BRUNETON_GRASS_ALBEDO_MIN_NM = 360;
const BRUNETON_GRASS_ALBEDO_STEP_NM = 10;
const BRUNETON_GRASS_ALBEDO_SAMPLES = Object.freeze([
	0.018, 0.019, 0.019, 0.020, 0.022, 0.024, 0.027, 0.029, 0.030, 0.031,
	0.032, 0.032, 0.032, 0.033, 0.035, 0.040, 0.055, 0.073, 0.084, 0.089,
	0.089, 0.079, 0.069, 0.063, 0.061, 0.057, 0.052, 0.051, 0.048, 0.042,
	0.039, 0.035, 0.035, 0.043, 0.087, 0.156, 0.234, 0.334, 0.437, 0.513,
	0.553, 0.571, 0.579, 0.581, 0.587,
]);
const LOWER_HEMISPHERE_PHASE_THETA_SAMPLES = 6;
const LOWER_HEMISPHERE_PHASE_PHI_SAMPLES = 12;
const UPPER_HEMISPHERE_SKY_THETA_SAMPLES = 6;
const UPPER_HEMISPHERE_SKY_PHI_SAMPLES = 12;
const SKY_DOME_SECONDARY_SCATTERING_ORDER_COUNT = 4;
const SKY_DOME_SECONDARY_MIDPOINT_TAU_START = 4;
const SKY_DOME_SECONDARY_MIDPOINT_TAU_END = 8;
const BRUNETON_EXPONENTIAL_TONE_MAP_DENOMINATOR = 5;
const DEFAULT_SOLAR_SOURCE_MODE = 'directional-sun';
const SOLAR_SOURCE_MODES = Object.freeze(['directional-sun', 'finite-sun-disc']);
const DEFAULT_FINITE_SUN_SAMPLE_COUNT = 9;
const SOLAR_ANGULAR_DIAMETER_DEG = 0.533;
const SUN_DIAGNOSTIC_DIRECT_SCALE = 1;
const SUN_ANGLE_BUCKETS = Object.freeze([
	Object.freeze({ id: '0-0.25', minDeg: 0, maxDeg: 0.25 }),
	Object.freeze({ id: '0.25-0.5', minDeg: 0.25, maxDeg: 0.5 }),
	Object.freeze({ id: '0.5-1', minDeg: 0.5, maxDeg: 1 }),
	Object.freeze({ id: '1-2', minDeg: 1, maxDeg: 2 }),
	Object.freeze({ id: '2-5', minDeg: 2, maxDeg: 5 }),
	Object.freeze({ id: '5-10', minDeg: 5, maxDeg: 10 }),
]);
const OPTICAL_DEPTH_VALIDITY_CLASSES = Object.freeze([
	Object.freeze({ id: 'optically-thin', label: 'optically thin', minTau: 0, maxTau: 0.1 }),
	Object.freeze({ id: 'moderate', label: 'moderate', minTau: 0.1, maxTau: 1 }),
	Object.freeze({ id: 'thick', label: 'thick', minTau: 1, maxTau: 5 }),
	Object.freeze({ id: 'single-scattering-warning', label: 'single-scattering warning', minTau: 5, maxTau: 10 }),
	Object.freeze({ id: 'extreme-horizon-path', label: 'extreme horizon path', minTau: 10, maxTau: Infinity }),
]);
const HIGH_TAU_WARNING_CLASS_IDS = Object.freeze([
	'single-scattering-warning',
	'extreme-horizon-path',
]);
const DEFAULT_WAVELENGTHS_NM = Object.freeze([450, 550, 650]);
const SKY_PATCH_WAVELENGTH_GRIDS = Object.freeze({
	'preview-20nm': Object.freeze({
		id: 'preview-20nm',
		label: 'Preview 20 nm visible grid',
		startNm: 380,
		endNm: 780,
		stepNm: 20,
		relationToCieTable: 'visible subset of the official CIE 1931 2-degree 1 nm table',
		resamplingPolicy: 'transport samples are generated directly on this grid; CIE CMFs are interpolated at sample wavelengths',
	}),
	'benchmark-5nm': Object.freeze({
		id: 'benchmark-5nm',
		label: 'Benchmark 5 nm visible grid',
		startNm: 380,
		endNm: 780,
		stepNm: 5,
		relationToCieTable: 'visible subset aligned to every fifth row of the official CIE 1931 2-degree 1 nm table',
		resamplingPolicy: 'transport samples are generated directly on this grid; CIE CMFs are exact table rows at sample wavelengths',
	}),
	[BRUNETON_2016_WAVELENGTH_GRID_ID]: Object.freeze({
		id: BRUNETON_2016_WAVELENGTH_GRID_ID,
		label: 'Bruneton 2016 comparison 40-wavelength grid',
		startNm: 360,
		endNm: 830,
		count: 40,
		relationToCieTable: 'matches the 40 wavelengths between 360 nm and 830 nm used for the Bruneton paper model comparisons',
		resamplingPolicy: 'transport samples are generated directly on this grid; CIE CMFs are interpolated at sample wavelengths',
		reference: 'Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Section 3.1 and Section 5.5',
	}),
	'cie-1nm': Object.freeze({
		id: 'cie-1nm',
		label: 'Official CIE 1 nm grid',
		startNm: 360,
		endNm: 830,
		stepNm: 1,
		relationToCieTable: 'full official CIE 1931 2-degree table domain',
		resamplingPolicy: 'transport samples are generated directly on the official CIE table grid; CIE CMFs are exact table rows',
	}),
});
const DEFAULT_NUMERICAL = Object.freeze({
	viewSteps: 12,
	sunTransmittanceSteps: 1,
	integrationMethod: 'midpoint',
});
const DEFAULT_SKY_PATCH_VIEW_STEPS = 64;
const DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS = 16;
const DEFAULT_SKY_DOME_SAMPLING_PROFILE_ID = 'paper-comparison';
const SKY_RENDER_SAMPLING_PROFILES = Object.freeze({
	'fast-preview': Object.freeze({
		id: 'fast-preview',
		label: 'Fast preview',
		viewSteps: 12,
		sunTransmittanceSteps: 2,
		integrationMethod: DEFAULT_NUMERICAL.integrationMethod,
		evidenceUse: 'cheap preview and ablation only; not sufficient for model-family visual conclusions',
	}),
	'paper-comparison': Object.freeze({
		id: 'paper-comparison',
		label: 'Paper comparison',
		viewSteps: 96,
		sunTransmittanceSteps: 16,
		integrationMethod: DEFAULT_NUMERICAL.integrationMethod,
		evidenceUse: 'fixed high-sampling profile for Bruneton-style model-output comparison artifacts',
	}),
	'horizon-safe': Object.freeze({
		id: 'horizon-safe',
		label: 'Horizon-safe',
		viewSteps: 128,
		sunTransmittanceSteps: 32,
		integrationMethod: DEFAULT_NUMERICAL.integrationMethod,
		evidenceUse: 'extra convergence margin for low-elevation and sunset horizon diagnostics',
	}),
});
const DEBUG_RGB_WAVELENGTHS = Object.freeze({
	r: 650,
	g: 550,
	b: 450,
});
const SKY_PATCH_SIZE = Object.freeze({ width: 44, height: 28 });
const SKY_PATCH_MAX_PIXELS = 262144;
const DEFAULT_SKY_DOME_SIZE = 72;
const SKY_DOME_MAX_PIXELS = 262144;
const DEFAULT_DOME_SAMPLE_MASK_ID = 'full';
const DOME_SAMPLE_MASKS = Object.freeze({
	full: Object.freeze({
		id: 'full',
		label: 'Full dome',
		minRadius: 0,
		description: 'Trace every pixel inside the fisheye dome.',
	}),
	'horizon-ring': Object.freeze({
		id: 'horizon-ring',
		label: 'Horizon ring',
		minRadius: 0.88,
		description: 'Trace only the outer fisheye ring used by horizon/perimeter diagnostics.',
	}),
});
const DEFAULT_SKY_PATCH_IDS = Object.freeze([
	'midday.zenith',
	'midday.horizon',
	'sunset.horizon',
]);
const MULTISCATTER_REFERENCE_MODES = Object.freeze([
	'none',
	'sidecar-contract',
	'order-by-order-grid',
	'iterative-field-grid',
]);
const MULTISCATTER_TARGET_MODES = Object.freeze(['diagnostic', 'dome-rings']);
const MULTISCATTER_MAX_SUPPORTED_ORDER = 4;
const MULTISCATTER_MAX_DOME_RING_ORDER = 3;
const MULTISCATTER_FIELD_ALTITUDE_GRIDS_KM = Object.freeze({
	default: Object.freeze([0, 1, 3, 8, 20]),
	'lower-atmosphere': Object.freeze([0, 0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 12, 20, 40]),
});
const DEFAULT_MULTISCATTER_FIELD_ALTITUDE_GRID = 'default';
const MULTISCATTER_FIELD_ALTITUDE_GRID_IDS = Object.freeze(Object.keys(MULTISCATTER_FIELD_ALTITUDE_GRIDS_KM));
const MULTISCATTER_FIELD_DIRECTION_BASIS_IDS = Object.freeze(['fibonacci', 'horizon-sun']);
const DEFAULT_MULTISCATTER_FIELD_DIRECTION_BASIS = 'fibonacci';
const MULTISCATTER_FIELD_INTERPOLATION_MODES = Object.freeze(['nearest', 'weighted']);
const DEFAULT_MULTISCATTER_FIELD_INTERPOLATION = 'nearest';
const MULTISCATTER_FIELD_DIRECTION_NEIGHBORS = 4;
const MULTISCATTER_BASELINE_ID = 'single-scattering-baseline-2026-06';
const MULTISCATTER_GRID_DEFAULTS = Object.freeze({
	maxOrder: 2,
	thresholdFraction: 0.01,
	viewSteps: 3,
	incomingViewSteps: 2,
	sunTransmittanceSteps: 1,
	angularSampleCount: 8,
	targetMode: 'diagnostic',
});
const MULTISCATTER_DOME_RING_VIEW_ZENITH_DEG = Object.freeze([30, 60, 75, 85]);
const MULTISCATTER_DOME_RING_RELATIVE_AZIMUTH_DEG = Object.freeze([0, 45, 90, 135, 180, 225, 270, 315]);
const SKY_DOME_GRID_SCENES = Object.freeze([
	Object.freeze({
		id: '06h00.sunZenith87',
		label: '06h00 / 87 deg',
		timeLabel: '06h00',
		sunZenithDeg: 87,
		sunElevationDeg: 3,
		sunAzimuthDeg: 40,
		displayExposure: 8,
	}),
	Object.freeze({
		id: '10h15.sunZenith41',
		label: '10h15 / 41 deg',
		timeLabel: '10h15',
		sunZenithDeg: 41,
		sunElevationDeg: 49,
		sunAzimuthDeg: 40,
		displayExposure: 8,
	}),
	Object.freeze({
		id: '11h15.sunZenith31',
		label: '11h15 / 31 deg',
		timeLabel: '11h15',
		sunZenithDeg: 31,
		sunElevationDeg: 59,
		sunAzimuthDeg: 40,
		displayExposure: 8,
	}),
	Object.freeze({
		id: '13h15.sunZenith21',
		label: '13h15 / 21 deg',
		timeLabel: '13h15',
		sunZenithDeg: 21,
		sunElevationDeg: 69,
		sunAzimuthDeg: 40,
		displayExposure: 8,
	}),
]);
const EARTH_LIKE_SKY = Object.freeze({
	planetRadiusKm: 6371.0088,
	atmosphereTopAltitudeKm: 100,
	rayleighScaleHeightKm: 8,
	rayleighBeta550PerKm: 0.013558,
	ozoneDobsonUnits: 300,
	ozoneLayerCenterAltitudeKm: 25,
	ozoneLayerWidthKm: 10,
	ozoneChappuisMaxCrossSectionCm2: 5.23e-21,
	solarTemperatureK: 5778,
	solarIrradiance550Wm2Nm: 1.87,
});
const SKY_PATCH_SCENES = Object.freeze({
	'midday.zenith': Object.freeze({
		id: 'midday.zenith',
		label: 'Midday Zenith',
		description: 'Looking straight up under shared Earth-like clear-day atmosphere inputs.',
		camera: {
			forward: [0, 1, 0],
			up: [0, 0, -1],
			fovYDeg: 54,
		},
		sunElevationDeg: 74,
		sunAzimuthDeg: 40,
		displayExposure: 8,
		sunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
	}),
	'midday.horizon': Object.freeze({
		id: 'midday.horizon',
		label: 'Midday Horizon',
		description: 'Looking toward the horizon under the same shared Earth-like midday atmosphere inputs.',
		camera: {
			forward: directionFromElevationAzimuth(4, 40),
			up: [0, 1, 0],
			fovYDeg: 26,
		},
		sunElevationDeg: 74,
		sunAzimuthDeg: 40,
		displayExposure: 8,
		sunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
	}),
	'midday.horizonSky': Object.freeze({
		id: 'midday.horizonSky',
		label: 'Midday Horizon Sky Frame',
		description: 'Looking above the horizon under shared Earth-like midday inputs, with the horizon kept near the lower frame edge for sky-gradient review.',
		camera: {
			forward: directionFromElevationAzimuth(12, 40),
			up: [0, 1, 0],
			fovYDeg: 26,
		},
		sunElevationDeg: 74,
		sunAzimuthDeg: 40,
		displayExposure: 8,
		sunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
	}),
	'midday.horizonTallSky': Object.freeze({
		id: 'midday.horizonTallSky',
		label: 'Midday Horizon Tall Sky Frame',
		description: 'Looking from the horizon into higher midday sky under shared Earth-like inputs, with a taller photo-comparison field of view.',
		camera: {
			forward: directionFromElevationAzimuth(25, 40),
			up: [0, 1, 0],
			fovYDeg: 54,
		},
		sunElevationDeg: 74,
		sunAzimuthDeg: 40,
		displayExposure: 8,
		sunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
	}),
	'midnight.zenith': Object.freeze({
		id: 'midnight.zenith',
		label: 'Midnight Zenith',
		description: 'Looking straight up with the Sun below the horizon and no moon, stars, city light, or airglow source.',
		camera: {
			forward: [0, 1, 0],
			up: [0, 0, -1],
			fovYDeg: 54,
		},
		sunElevationDeg: -60,
		sunAzimuthDeg: 0,
		displayExposure: 8,
	}),
	'sunset.horizon': Object.freeze({
		id: 'sunset.horizon',
		label: 'Sunset Horizon',
		description: 'Looking toward a low Sun just above the horizon with the same Earth-like atmosphere inputs.',
		camera: {
			forward: directionFromElevationAzimuth(4, 0),
			up: [0, 1, 0],
			fovYDeg: 26,
		},
		sunElevationDeg: 0.5,
		sunAzimuthDeg: 0,
		displayExposure: 4,
		sunTransmittanceSteps: 32,
	}),
	'sunset.sun': Object.freeze({
		id: 'sunset.sun',
		label: 'Sunset Sun Diagnostic',
		description: 'Looking directly toward the low Sun so finite-disk diagnostics occupy visible pixels.',
		camera: {
			forward: directionFromElevationAzimuth(0.5, 0),
			up: [0, 1, 0],
			fovYDeg: 8,
		},
		sunElevationDeg: 0.5,
		sunAzimuthDeg: 0,
		displayExposure: 4,
		sunTransmittanceSteps: 6,
	}),
});

const BUILT_IN_PROBES = Object.freeze({
	'globe.zenith': Object.freeze({
		id: 'globe.zenith',
		label: 'Controlled Globe Zenith Sky',
		modelId: 'controlled-globe-style-clear-sky',
		description: 'Short upward clear-air path with Rayleigh-weighted scattering.',
		viewDistanceKm: 18,
		rayleighScattering550PerKm: 0.018,
		sourcePathKm: 3,
		sourceSpectrumScale: 4,
	}),
	'globe.horizon': Object.freeze({
		id: 'globe.horizon',
		label: 'Controlled Globe Horizon Sky',
		modelId: 'controlled-globe-style-clear-sky',
		description: 'Longer dense-air path to expose stronger attenuation and airlight.',
		viewDistanceKm: 45,
		rayleighScattering550PerKm: 0.012,
		sourcePathKm: 8,
		sourceSpectrumScale: 4,
	}),
	'globe.redMarker': Object.freeze({
		id: 'globe.redMarker',
		label: 'Controlled Red Marker Through Airlight',
		modelId: 'controlled-globe-style-red-marker',
		description: 'Red Lambertian surface behind the same blue-biased atmosphere.',
		viewDistanceKm: 24,
		surfaceDistanceKm: 12,
		rayleighScattering550PerKm: 0.018,
		sourcePathKm: 4,
		sourceSpectrumScale: 6,
		surfaceAlbedoByWavelength: Object.freeze([0.04, 0.07, 1]),
	}),
	'flat.localSunReference': Object.freeze({
		id: 'flat.localSunReference',
		label: 'Controlled Flat Local-Sun Surface',
		modelId: 'controlled-flat-style-local-sun',
		description: 'Finite-boundary flat-style surface probe with a nearer source path.',
		viewDistanceKm: 16,
		surfaceDistanceKm: 8,
		rayleighScattering550PerKm: 0.012,
		sourcePathKm: 2,
		sourceSpectrumScale: Math.PI * 1.5,
		surfaceAlbedoByWavelength: Object.freeze([0.22, 0.28, 0.34]),
		boundaryReason: 'controlled-flat-finite-patch',
	}),
});

export function parseArgs(argv) {
	const options = {
		probeIds: [],
		stage: DEFAULT_STAGE,
		format: DEFAULT_FORMAT,
	};
	let skyPatchHint = false;

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--help' || arg === '-h') {
			options.help = true;
			continue;
		}

		if (arg === '--config') {
			options.configPath = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--probe') {
			options.probeIds.push(...readOptionValue(argv, ++index, arg)
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean));
			continue;
		}

		if (arg === '--out') {
			options.outPath = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--report') {
			options.reportPath = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--image') {
			options.imagePath = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--color') {
			options.color = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--encoding') {
			options.encoding = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--tone-map') {
			options.toneMap = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--exposure') {
			options.exposure = readFiniteNumberOption(argv, ++index, arg);
			continue;
		}

		if (arg === '--wavelength-grid') {
			options.wavelengthGrid = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--solar-spectrum') {
			options.solarSpectrum = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--rayleigh-policy') {
			options.rayleighPolicy = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--aerosol-policy') {
			options.aerosolPolicy = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--aerosol-phase-policy') {
			options.aerosolPhasePolicy = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--ozone-policy') {
			options.ozonePolicy = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--molecular-profile') {
			options.molecularProfile = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--sun-visual') {
			options.sunVisual = readOptionValue(argv, ++index, arg);
			options.skyPatches = true;
			continue;
		}

		if (arg === '--solar-source') {
			options.solarSource = readOptionValue(argv, ++index, arg);
			skyPatchHint = true;
			continue;
		}

		if (arg === '--finite-sun-samples') {
			options.finiteSunSamples = readPositiveIntegerOption(argv, ++index, arg);
			skyPatchHint = true;
			continue;
		}

		if (arg === '--sampling-profile') {
			options.samplingProfile = readOptionValue(argv, ++index, arg);
			skyPatchHint = true;
			continue;
		}

		if (arg === '--view-steps') {
			options.viewSteps = readPositiveIntegerOption(argv, ++index, arg);
			skyPatchHint = true;
			continue;
		}

		if (arg === '--sun-transmittance-steps') {
			options.sunTransmittanceSteps = readPositiveIntegerOption(argv, ++index, arg);
			skyPatchHint = true;
			continue;
		}

		if (arg === '--patch-size') {
			options.patchSize = parsePatchSize(readOptionValue(argv, ++index, arg));
			options.skyPatches = true;
			continue;
		}

		if (arg === '--fov-y-deg') {
			options.fovYDeg = readFiniteNumberOption(argv, ++index, arg);
			options.skyPatches = true;
			continue;
		}

		if (arg === '--dome-size') {
			options.domeSize = readPositiveIntegerOption(argv, ++index, arg);
			options.skyDomeGrid = true;
			continue;
		}

		if (arg === '--dome-sample-mask') {
			options.domeSampleMask = readOptionValue(argv, ++index, arg);
			options.skyDomeGrid = true;
			continue;
		}

		if (arg === '--sky-dome-visual-fit') {
			options.skyDomeVisualFit = readOptionValue(argv, ++index, arg);
			options.skyDomeGrid = true;
			continue;
		}

		if (arg === '--stage') {
			options.stage = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--format') {
			options.format = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--progress') {
			options.progress = true;
			continue;
		}

		if (arg === '--progress-log') {
			options.progressLogPath = readOptionValue(argv, ++index, arg);
			options.progress = true;
			continue;
		}

		if (arg === '--external-radiance') {
			options.externalRadiancePath = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-reference') {
			options.multipleScatteringReference = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-targets') {
			options.multipleScatteringTargets = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-angular-samples') {
			options.multipleScatteringAngularSamples = readPositiveIntegerOption(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-max-order') {
			options.multipleScatteringMaxOrder = readPositiveIntegerOption(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-field-interpolation') {
			options.multipleScatteringFieldInterpolation = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-field-direction-basis') {
			options.multipleScatteringFieldDirectionBasis = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-field-altitude-grid') {
			options.multipleScatteringFieldAltitudeGrid = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--multiple-scattering-image-dir') {
			options.multipleScatteringImageDir = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--sky-patches') {
			options.skyPatches = true;
			continue;
		}

		if (arg === '--sky-dome-grid') {
			options.skyDomeGrid = true;
			continue;
		}

		if (arg === '--patch') {
			options.patchIds = readOptionValue(argv, ++index, arg)
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean);
			options.skyPatches = true;
			continue;
		}

		if (arg === '--light-extent') {
			options.lightExtent = true;
			continue;
		}

		if (arg === '--light-set') {
			options.lightSetIds = readOptionValue(argv, ++index, arg)
				.split(',')
				.map((value) => value.trim())
				.filter(Boolean);
			options.lightExtent = true;
			continue;
		}

		if (arg === '--light-config') {
			options.lightConfigPath = readOptionValue(argv, ++index, arg);
			options.lightExtent = true;
			continue;
		}

		throw new Error(`Unknown option: ${arg}`);
	}

	if (!['json', 'summary'].includes(options.format)) {
		throw new Error(`Unknown format: ${options.format}`);
	}

	if (options.color && !['official-cie', 'preview-cie'].includes(options.color)) {
		throw new Error(`Unknown color policy: ${options.color}`);
	}

	if (options.encoding && !['srgb', 'linear'].includes(options.encoding)) {
		throw new Error(`Unknown output encoding: ${options.encoding}`);
	}

	if (options.toneMap && !['clip', 'preserve-hue', 'exponential'].includes(options.toneMap)) {
		throw new Error(`Unknown tone map: ${options.toneMap}`);
	}

	if (options.exposure !== undefined && options.exposure < 0) {
		throw new Error('--exposure must be nonnegative');
	}

	if (options.fovYDeg !== undefined && (options.fovYDeg <= 0 || options.fovYDeg >= 180)) {
		throw new Error('--fov-y-deg must be greater than 0 and less than 180');
	}

	if (options.wavelengthGrid && !SKY_PATCH_WAVELENGTH_GRIDS[options.wavelengthGrid]) {
		throw new Error(`Unknown wavelength grid: ${options.wavelengthGrid}`);
	}

	if (options.solarSpectrum && !SOLAR_SPECTRUM_POLICY_IDS.includes(options.solarSpectrum)) {
		throw new Error(`Unknown solar spectrum policy: ${options.solarSpectrum}`);
	}

	if (options.rayleighPolicy && !RAYLEIGH_POLICY_IDS.includes(options.rayleighPolicy)) {
		throw new Error(`Unknown Rayleigh policy: ${options.rayleighPolicy}`);
	}

	if (options.aerosolPolicy && !aerosolPolicyIds().includes(options.aerosolPolicy)) {
		throw new Error(`Unknown aerosol policy: ${options.aerosolPolicy}`);
	}

	if (options.aerosolPhasePolicy && !aerosolPhasePolicyIds().includes(options.aerosolPhasePolicy)) {
		throw new Error(`Unknown aerosol phase policy: ${options.aerosolPhasePolicy}`);
	}

	if (options.ozonePolicy && !OZONE_POLICY_IDS.includes(options.ozonePolicy)) {
		throw new Error(`Unknown ozone policy: ${options.ozonePolicy}`);
	}

	if (options.molecularProfile && !MOLECULAR_PROFILE_POLICY_IDS.includes(options.molecularProfile)) {
		throw new Error(`Unknown molecular profile policy: ${options.molecularProfile}`);
	}

	if (options.sunVisual && !SUN_VISUAL_OPTIONS.includes(options.sunVisual)) {
		throw new Error(`Unknown sun visual mode: ${options.sunVisual}`);
	}

	if (options.solarSource && !SOLAR_SOURCE_MODES.includes(options.solarSource)) {
		throw new Error(`Unknown solar source mode: ${options.solarSource}`);
	}

	if (options.finiteSunSamples !== undefined && options.solarSource !== 'finite-sun-disc') {
		throw new Error('--finite-sun-samples requires --solar-source finite-sun-disc');
	}

	if (options.domeSampleMask && !DOME_SAMPLE_MASKS[options.domeSampleMask]) {
		throw new Error(`Unknown dome sample mask: ${options.domeSampleMask}`);
	}

	if (options.skyDomeVisualFit && !SKY_DOME_VISUAL_FIT_OPTIONS.includes(options.skyDomeVisualFit)) {
		throw new Error(`Unknown sky-dome visual fit: ${options.skyDomeVisualFit}`);
	}

	validateSamplingControlOptions(options);

	if (
		options.multipleScatteringReference
		&& !MULTISCATTER_REFERENCE_MODES.includes(options.multipleScatteringReference)
	) {
		throw new Error(`Unknown multiple-scattering reference mode: ${options.multipleScatteringReference}`);
	}

	if (
		options.multipleScatteringTargets
		&& !MULTISCATTER_TARGET_MODES.includes(options.multipleScatteringTargets)
	) {
		throw new Error(`Unknown multiple-scattering target mode: ${options.multipleScatteringTargets}`);
	}

	if (
		options.multipleScatteringAngularSamples !== undefined
		&& (!Number.isInteger(options.multipleScatteringAngularSamples)
			|| options.multipleScatteringAngularSamples <= 0)
	) {
		throw new Error('--multiple-scattering-angular-samples requires a positive integer');
	}

	if (
		options.multipleScatteringMaxOrder !== undefined
		&& (options.multipleScatteringMaxOrder < 2
			|| options.multipleScatteringMaxOrder > MULTISCATTER_MAX_SUPPORTED_ORDER)
	) {
		throw new Error(`--multiple-scattering-max-order currently supports orders 2-${MULTISCATTER_MAX_SUPPORTED_ORDER}`);
	}

	if (
		options.multipleScatteringFieldInterpolation
		&& !MULTISCATTER_FIELD_INTERPOLATION_MODES.includes(options.multipleScatteringFieldInterpolation)
	) {
		throw new Error(`Unknown multiple-scattering field interpolation mode: ${options.multipleScatteringFieldInterpolation}`);
	}

	if (
		options.multipleScatteringFieldDirectionBasis
		&& !MULTISCATTER_FIELD_DIRECTION_BASIS_IDS.includes(options.multipleScatteringFieldDirectionBasis)
	) {
		throw new Error(`Unknown multiple-scattering field direction basis: ${options.multipleScatteringFieldDirectionBasis}`);
	}

	if (
		options.multipleScatteringFieldAltitudeGrid
		&& !MULTISCATTER_FIELD_ALTITUDE_GRID_IDS.includes(options.multipleScatteringFieldAltitudeGrid)
	) {
		throw new Error(`Unknown multiple-scattering field altitude grid: ${options.multipleScatteringFieldAltitudeGrid}`);
	}

	if (options.viewSteps !== undefined && (!Number.isInteger(options.viewSteps) || options.viewSteps <= 0)) {
		throw new Error('--view-steps requires a positive integer');
	}

	if (
		options.sunTransmittanceSteps !== undefined
		&& (!Number.isInteger(options.sunTransmittanceSteps) || options.sunTransmittanceSteps <= 0)
	) {
		throw new Error('--sun-transmittance-steps requires a positive integer');
	}

	if (skyPatchHint && !options.skyDomeGrid && !options.lightExtent) {
		options.skyPatches = true;
	}

	const selectedRenderModes = [
		options.skyPatches,
		options.skyDomeGrid,
		options.lightExtent,
	].filter(Boolean).length;
	if (selectedRenderModes > 1) {
		throw new Error('Choose only one of --sky-patches, --sky-dome-grid, or --light-extent');
	}

	if (options.externalRadiancePath && !options.skyPatches && !options.skyDomeGrid) {
		throw new Error('--external-radiance currently requires --sky-patches or --sky-dome-grid');
	}

	if (options.multipleScatteringReference && !options.skyPatches && !options.skyDomeGrid) {
		throw new Error('--multiple-scattering-reference currently requires --sky-patches or --sky-dome-grid');
	}

	if (options.multipleScatteringReference === 'iterative-field-grid' && !options.skyDomeGrid) {
		throw new Error('--multiple-scattering-reference iterative-field-grid requires --sky-dome-grid');
	}

	if (options.multipleScatteringTargets && !options.multipleScatteringReference) {
		throw new Error('--multiple-scattering-targets requires --multiple-scattering-reference');
	}

	if (options.multipleScatteringAngularSamples !== undefined && !options.multipleScatteringReference) {
		throw new Error('--multiple-scattering-angular-samples requires --multiple-scattering-reference');
	}

	if (options.multipleScatteringMaxOrder !== undefined && !options.multipleScatteringReference) {
		throw new Error('--multiple-scattering-max-order requires --multiple-scattering-reference');
	}

	if (options.multipleScatteringReference === 'none') {
		if (
			options.multipleScatteringTargets
			|| options.multipleScatteringAngularSamples !== undefined
			|| options.multipleScatteringMaxOrder !== undefined
			|| options.multipleScatteringFieldInterpolation
			|| options.multipleScatteringFieldDirectionBasis
			|| options.multipleScatteringFieldAltitudeGrid
			|| options.multipleScatteringImageDir
		) {
			throw new Error('--multiple-scattering-reference none does not accept solver, field, or image sidecar options');
		}
	}

	if (
		options.multipleScatteringFieldInterpolation
		&& options.multipleScatteringReference !== 'iterative-field-grid'
	) {
		throw new Error('--multiple-scattering-field-interpolation requires --multiple-scattering-reference iterative-field-grid');
	}

	if (
		options.multipleScatteringFieldDirectionBasis
		&& options.multipleScatteringReference !== 'iterative-field-grid'
	) {
		throw new Error('--multiple-scattering-field-direction-basis requires --multiple-scattering-reference iterative-field-grid');
	}

	if (
		options.multipleScatteringFieldAltitudeGrid
		&& options.multipleScatteringReference !== 'iterative-field-grid'
	) {
		throw new Error('--multiple-scattering-field-altitude-grid requires --multiple-scattering-reference iterative-field-grid');
	}

	if (
		options.multipleScatteringImageDir
		&& options.multipleScatteringReference !== 'iterative-field-grid'
	) {
		throw new Error('--multiple-scattering-image-dir requires --multiple-scattering-reference iterative-field-grid');
	}

	if (options.multipleScatteringTargets === 'dome-rings' && !options.skyDomeGrid) {
		throw new Error('--multiple-scattering-targets dome-rings requires --sky-dome-grid');
	}

	if (
		options.multipleScatteringTargets === 'dome-rings'
		&& options.multipleScatteringMaxOrder > MULTISCATTER_MAX_DOME_RING_ORDER
	) {
		throw new Error(`--multiple-scattering-max-order above ${MULTISCATTER_MAX_DOME_RING_ORDER} is currently diagnostic-target only`);
	}

	if (options.domeSize !== undefined) {
		const pixelCount = options.domeSize * options.domeSize * SKY_DOME_GRID_SCENES.length;
		if (pixelCount > SKY_DOME_MAX_PIXELS) {
			throw new Error(`--dome-size across the grid must contain at most ${SKY_DOME_MAX_PIXELS} traced pixels`);
		}
	}

	return options;
}

function readOptionValue(argv, index, optionName) {
	const value = argv[index];

	if (!value || value.startsWith('--')) {
		throw new Error(`${optionName} requires a value`);
	}

	return value;
}

function readFiniteNumberOption(argv, index, optionName) {
	const value = Number(readOptionValue(argv, index, optionName));

	if (!Number.isFinite(value)) {
		throw new Error(`${optionName} requires a finite number`);
	}

	return value;
}

function readPositiveIntegerOption(argv, index, optionName) {
	const value = readFiniteNumberOption(argv, index, optionName);

	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${optionName} requires a positive integer`);
	}

	return value;
}

function parsePatchSize(value) {
	const match = /^(\d+)x(\d+)$/u.exec(value);

	if (!match) {
		throw new Error('--patch-size must be WIDTHxHEIGHT');
	}

	const width = Number(match[1]);
	const height = Number(match[2]);
	const pixelCount = width * height;

	if (width < 1 || height < 1 || pixelCount > SKY_PATCH_MAX_PIXELS) {
		throw new Error(`--patch-size must be positive and contain at most ${SKY_PATCH_MAX_PIXELS} pixels`);
	}

	return { width, height };
}

export function skyRenderSamplingProfileIds() {
	return Object.keys(SKY_RENDER_SAMPLING_PROFILES);
}

export function skyDomeSampleMaskIds() {
	return Object.keys(DOME_SAMPLE_MASKS);
}

export function resolveSkyRenderSamplingProfile(profileId) {
	const profile = SKY_RENDER_SAMPLING_PROFILES[profileId];

	if (!profile) {
		throw new Error(`Unknown sampling profile: ${profileId}`);
	}

	return {
		id: profile.id,
		label: profile.label,
		viewSteps: profile.viewSteps,
		sunTransmittanceSteps: profile.sunTransmittanceSteps,
		integrationMethod: profile.integrationMethod,
		evidenceUse: profile.evidenceUse,
	};
}

function validateSamplingControlOptions(options) {
	if (options.samplingProfile) {
		resolveSkyRenderSamplingProfile(options.samplingProfile);
	}

	if (
		options.samplingProfile
		&& (options.viewSteps !== undefined || options.sunTransmittanceSteps !== undefined)
	) {
		throw new Error('--sampling-profile cannot be combined with --view-steps or --sun-transmittance-steps');
	}
}

function hasExplicitSamplingSteps(options) {
	return options.viewSteps !== undefined || options.sunTransmittanceSteps !== undefined;
}

function createCustomSamplingProfileMetadata({
	viewSteps,
	sunTransmittanceSteps,
}) {
	return {
		id: 'custom-explicit',
		label: 'Custom explicit sampling',
		viewSteps,
		sunTransmittanceSteps,
		integrationMethod: DEFAULT_NUMERICAL.integrationMethod,
		evidenceUse: 'caller-specified experimental sampling; compare only against artifacts with matching recorded steps',
	};
}

function createPerPatchSamplingProfileMetadata() {
	return {
		id: 'per-patch-default',
		label: 'Per-patch scene defaults',
		viewSteps: 'per-patch',
		sunTransmittanceSteps: 'per-patch',
		integrationMethod: DEFAULT_NUMERICAL.integrationMethod,
		evidenceUse: 'scene-owned defaults for routine sky-patch diagnostics',
		defaultViewSteps: DEFAULT_SKY_PATCH_VIEW_STEPS,
		defaultSunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
	};
}

function resolveSkyDomeSamplingControl(options) {
	validateSamplingControlOptions(options);

	if (options.samplingProfile) {
		const samplingProfile = resolveSkyRenderSamplingProfile(options.samplingProfile);

		return {
			samplingProfile,
			viewStepsOverride: samplingProfile.viewSteps,
			sunTransmittanceStepsOverride: samplingProfile.sunTransmittanceSteps,
		};
	}

	if (hasExplicitSamplingSteps(options)) {
		const viewSteps = options.viewSteps ?? DEFAULT_SKY_PATCH_VIEW_STEPS;
		const sunTransmittanceSteps = options.sunTransmittanceSteps ?? DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS;

		return {
			samplingProfile: createCustomSamplingProfileMetadata({
				viewSteps,
				sunTransmittanceSteps,
			}),
			viewStepsOverride: options.viewSteps,
			sunTransmittanceStepsOverride: options.sunTransmittanceSteps,
		};
	}

	const samplingProfile = resolveSkyRenderSamplingProfile(DEFAULT_SKY_DOME_SAMPLING_PROFILE_ID);

	return {
		samplingProfile,
		viewStepsOverride: samplingProfile.viewSteps,
		sunTransmittanceStepsOverride: samplingProfile.sunTransmittanceSteps,
	};
}

function resolveSkyPatchSamplingControl(options) {
	validateSamplingControlOptions(options);

	if (options.samplingProfile) {
		const samplingProfile = resolveSkyRenderSamplingProfile(options.samplingProfile);

		return {
			samplingProfile,
			viewStepsOverride: samplingProfile.viewSteps,
			sunTransmittanceStepsOverride: samplingProfile.sunTransmittanceSteps,
		};
	}

	if (hasExplicitSamplingSteps(options)) {
		return {
			samplingProfile: createCustomSamplingProfileMetadata({
				viewSteps: options.viewSteps ?? 'per-patch',
				sunTransmittanceSteps: options.sunTransmittanceSteps ?? 'per-patch',
			}),
			viewStepsOverride: options.viewSteps,
			sunTransmittanceStepsOverride: options.sunTransmittanceSteps,
		};
	}

	return {
		samplingProfile: createPerPatchSamplingProfileMetadata(),
		viewStepsOverride: undefined,
		sunTransmittanceStepsOverride: undefined,
	};
}

function createSamplingNumericalMetadata(samplingProfile, extras = {}) {
	return {
		viewSteps: samplingProfile.viewSteps,
		sunTransmittanceSteps: samplingProfile.sunTransmittanceSteps,
		...extras,
		integrationMethod: samplingProfile.integrationMethod,
		samplingProfile,
	};
}

function createActualSamplingProfileMetadata(samplingProfile, {
	viewSteps,
	sunTransmittanceSteps,
}) {
	if (
		samplingProfile.viewSteps === viewSteps
		&& samplingProfile.sunTransmittanceSteps === sunTransmittanceSteps
	) {
		return samplingProfile;
	}

	return {
		...samplingProfile,
		viewSteps,
		sunTransmittanceSteps,
	};
}

function resolveSolarSourceSampling(options = {}) {
	const mode = options.solarSource ?? DEFAULT_SOLAR_SOURCE_MODE;

	if (!SOLAR_SOURCE_MODES.includes(mode)) {
		throw new Error(`Unknown solar source mode: ${mode}`);
	}

	if (options.finiteSunSamples !== undefined && mode !== 'finite-sun-disc') {
		throw new Error('--finite-sun-samples requires --solar-source finite-sun-disc');
	}

	if (
		options.finiteSunSamples !== undefined
		&& (!Number.isInteger(options.finiteSunSamples) || options.finiteSunSamples <= 0)
	) {
		throw new Error('--finite-sun-samples requires a positive integer');
	}

	const sampleCount = mode === 'finite-sun-disc'
		? options.finiteSunSamples ?? DEFAULT_FINITE_SUN_SAMPLE_COUNT
		: 1;
	const solarAngularRadiusDeg = SOLAR_ANGULAR_DIAMETER_DEG / 2;
	const solarAngularRadiusRad = degreesToRadians(solarAngularRadiusDeg);
	const solarDiscSolidAngleSr = 2 * Math.PI * (1 - Math.cos(solarAngularRadiusRad));
	const angularOffsets = createSolarSourceAngularOffsets(mode, sampleCount, solarAngularRadiusRad);
	const weight = 1 / sampleCount;

	return {
		mode,
		sampleCount,
		solarAngularDiameterDeg: SOLAR_ANGULAR_DIAMETER_DEG,
		solarAngularRadiusDeg,
		solarAngularRadiusRad,
		solarDiscSolidAngleSr,
		perSampleSolidAngleSr: solarDiscSolidAngleSr / sampleCount,
		minWeight: weight,
		maxWeight: weight,
		weightSum: roundDiagnosticNumber(weight * sampleCount),
		weightPolicy: mode === 'finite-sun-disc'
			? 'equal source-integral weights; source energy convention preserved'
			: 'single directional source sample carries the full source integral',
		directionPolicy: mode === 'finite-sun-disc'
			? 'deterministic equal-area spiral over the apparent solar disc'
			: 'single sample at the solar center direction',
		minAngularOffsetDeg: roundDiagnosticNumber(radiansToDegrees(Math.min(...angularOffsets))),
		maxAngularOffsetDeg: roundDiagnosticNumber(radiansToDegrees(Math.max(...angularOffsets))),
		defaultMode: DEFAULT_SOLAR_SOURCE_MODE,
		defaultFiniteSunSampleCount: DEFAULT_FINITE_SUN_SAMPLE_COUNT,
	};
}

function createSolarSourceAngularOffsets(mode, sampleCount, solarAngularRadiusRad) {
	if (mode === 'directional-sun') {
		return [0];
	}

	return Array.from({ length: sampleCount }, (_, index) => {
		return solarAngularRadiusRad * Math.sqrt((index + 0.5) / sampleCount);
	});
}

function roundDiagnosticNumber(value) {
	return Number(value.toPrecision(15));
}

export function helpText() {
	const probeList = Object.values(BUILT_IN_PROBES)
		.map((probe) => `  ${probe.id.padEnd(24)} ${probe.description}`)
		.join('\n');

	return [
		'Usage: node scripts/flat/atmosphere_rejected/run-reference-probe.js [options]',
		'',
		'Options:',
		'  --probe <id[,id]>       Select built-in or config probe ids.',
		'  --config <path>         Load a JSON run definition.',
		'  --stage <id|full>       Run through one stage, or the full pipeline.',
		'  --out <path>            Write canonical JSON output.',
		'  --report <path>         Write a Markdown report.',
		'  --image <path>          Write a linked visual artifact. .ppm/.png use the post-pipeline pixel bridge; other extensions write SVG.',
		'  --color preview-cie|official-cie',
		'                          Select sky-patch spectral color conversion. Default: official-cie.',
		`  --encoding srgb|linear  Select sky-patch pixel byte encoding. Default: ${DEFAULT_PIXEL_ENCODING}; Bruneton skydome fit defaults to ${BRUNETON_2016_DOME_ENCODING}.`,
		'  --tone-map clip|preserve-hue|exponential',
		`                          Select display tone mapping. Default: ${DEFAULT_TONE_MAP}; Bruneton skydome fit defaults to ${BRUNETON_2016_DOME_TONE_MAP}.`,
		'  --exposure <scale>      Override sky-patch display exposure.',
		`  --wavelength-grid ${Object.keys(SKY_PATCH_WAVELENGTH_GRIDS).join('|')}`,
		`                          Select sky-patch wavelength sampling grid. Default: ${DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID}; Bruneton skydome fit defaults to ${BRUNETON_2016_WAVELENGTH_GRID_ID}.`,
		`  --solar-spectrum ${SOLAR_SPECTRUM_POLICY_IDS.join('|')}`,
		`                          Select sky-patch solar source spectrum. Default: ${DEFAULT_SOLAR_SPECTRUM_POLICY}; Bruneton skydome fit defaults to ${BRUNETON_2016_ASTMG173_SOLAR_POLICY_ID}.`,
		`  --rayleigh-policy ${RAYLEIGH_POLICY_IDS.join('|')}`,
		`                          Select sky-patch Rayleigh coefficient policy. Default: ${DEFAULT_RAYLEIGH_POLICY_ID}; Bruneton skydome fit defaults to ${BRUNETON_2016_RAYLEIGH_POLICY_ID}.`,
		`  --aerosol-policy ${aerosolPolicyIds().join('|')}`,
		`                          Select sky-patch aerosol/Mie policy. Default: ${DEFAULT_AEROSOL_POLICY_ID}; Bruneton skydome fit defaults to ${BRUNETON_2016_AEROSOL_POLICY_ID}.`,
		`  --aerosol-phase-policy ${aerosolPhasePolicyIds().join('|')}`,
		'                          Override the selected aerosol policy default phase shape.',
		`  --ozone-policy ${OZONE_POLICY_IDS.join('|')}`,
		`                          Select sky-patch ozone cross-section policy. Default: ${DEFAULT_OZONE_POLICY_ID}; Bruneton skydome fit defaults to ${BRUNETON_2016_OZONE_POLICY_ID}.`,
		'  --molecular-profile preview-exponential-8km|us-standard-atmosphere-1976-density',
		'                          Select sky-patch molecular density profile. Default: preview-exponential-8km.',
		'  --sun-visual none|diagnostic',
		'                          Add diagnostic finite-sun visual panels. Default: none.',
		`  --solar-source ${SOLAR_SOURCE_MODES.join('|')}`,
		`                          Select source sampling for sky renders. Default: ${DEFAULT_SOLAR_SOURCE_MODE}.`,
		`  --finite-sun-samples <count>`,
		`                          Select finite-disc source samples when --solar-source finite-sun-disc. Default: ${DEFAULT_FINITE_SUN_SAMPLE_COUNT}.`,
		`  --sampling-profile ${skyRenderSamplingProfileIds().join('|')}`,
		`                          Select named sky-render numerical sampling. Default for --sky-dome-grid: ${DEFAULT_SKY_DOME_SAMPLING_PROFILE_ID}.`,
		'  --view-steps <count>    Override sky-patch view-ray midpoint samples.',
		'  --sun-transmittance-steps <count>',
		'                          Override per-sample source-path midpoint samples.',
		'  --patch-size WIDTHxHEIGHT',
		'                          Select sky-patch pixel dimensions. Default: 44x28.',
		'  --fov-y-deg <degrees>   Override sky-patch vertical field of view.',
		`  --dome-size <pixels>    Select square fisheye panel size for --sky-dome-grid. Default: ${DEFAULT_SKY_DOME_SIZE}.`,
		`  --dome-sample-mask ${skyDomeSampleMaskIds().join('|')}`,
		'                          Select traced fisheye pixels for diagnostics. Default: full.',
		`  --sky-dome-visual-fit ${SKY_DOME_VISUAL_FIT_OPTIONS.join('|')}`,
		`                          Select Bruneton skydome comparison fit. Default: ${DEFAULT_SKY_DOME_VISUAL_FIT}.`,
		'  --format json|summary   Print JSON or concise summary to stdout.',
		'  --progress              Write sky-patch render progress to stderr.',
		'  --progress-log <path>   Write sky-patch render progress to a file.',
		'  --external-radiance <path> Compare generated diagnostic samples against an imported spectral radiance JSON artifact.',
		'  --multiple-scattering-reference <mode> Attach sidecar multiple-scattering reference data. Modes: none, sidecar-contract, order-by-order-grid, iterative-field-grid.',
		'  --multiple-scattering-targets diagnostic|dome-rings',
		'                          Select sidecar target rays. Default: diagnostic.',
		'  --multiple-scattering-angular-samples <count>',
		'                          Override sidecar incoming angular samples. Default: 8.',
		'  --multiple-scattering-max-order <2|3|4>',
		'                          Override sidecar max scattering order. Default: 2. Order 4 is diagnostic-target only.',
		'  --multiple-scattering-field-interpolation nearest|weighted',
		'                          Select iterative-field lookup interpolation. Default: nearest.',
		'  --multiple-scattering-field-direction-basis fibonacci|horizon-sun',
		'                          Select iterative-field direction grid. Default: fibonacci.',
		'  --multiple-scattering-field-altitude-grid default|lower-atmosphere',
		'                          Select iterative-field altitude layers. Default: default.',
		'  --multiple-scattering-image-dir <path>',
		'                          Write iterative-field sidecar skydome PNGs and a compact README without full per-pixel JSON.',
		'  --sky-patches           Render built-in sky patch views.',
		'  --sky-dome-grid         Render Bruneton-style fisheye skydome rows for 06h00/87 deg, 10h15/41 deg, 11h15/31 deg, and 13h15/21 deg.',
		`  --patch <id[,id]>       Select sky patch ids. Default: ${DEFAULT_SKY_PATCH_IDS.join(',')}.`,
		'  --light-extent          Run flat finite-Sun light extent probes.',
		'  --light-set <id[,id]>   Select light extent scenario ids.',
		'  --light-config <path>   Load light extent named scenario JSON.',
		'  --help                  Show this help.',
		'',
		'Built-in controlled probes:',
		probeList,
		'',
		'The built-ins are controlled smoke probes. They exercise the canonical',
		'transport stages; they are not a full Earth atmosphere adapter.',
		'',
		'Built-in sky patches:',
		Object.values(SKY_PATCH_SCENES)
			.map((patch) => `  ${patch.id.padEnd(24)} ${patch.description}`)
			.join('\n'),
	].join('\n');
}

export function runReferenceProbe(options = {}) {
	if (options.lightExtent) {
		const configPath = options.lightConfigPath ?? DEFAULT_LIGHT_EXTENT_CONFIG_PATH;
		const reportConfigPath = options.lightConfigPath
			? options.lightConfigPath
			: path.relative(process.cwd(), DEFAULT_LIGHT_EXTENT_CONFIG_PATH);
		const config = loadLightExtentConfig(configPath);

		return runLightExtentProbeSet(config, {
			selectedIds: options.lightSetIds ?? [],
			configPath: reportConfigPath,
		});
	}

	if (options.skyDomeGrid) {
		return attachMultiscatterDiagnostics(runSkyDomeGrid(options), options);
	}

	if (options.skyPatches) {
		return attachMultiscatterDiagnostics(runSkyPatchSet(options), options);
	}

	const runDefinition = loadRunDefinition(options);
	const selectedProbeDefinitions = selectProbeDefinitions(runDefinition, options.probeIds);
	const probeResults = selectedProbeDefinitions.map((probeDefinition) => {
		return runOneProbe(probeDefinition, runDefinition, options.stage ?? DEFAULT_STAGE);
	});
	const visualScale = computeVisualScale(probeResults);
	const probes = probeResults.map((probe) => ({
		...probe,
		visual: createVisualSummary(probe.summary.finalByWavelength, probe.summary.wavelengthsNm, visualScale),
	}));

	return {
		kind: 'flat-atmosphere-reference-result',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		configPath: options.configPath ? normalizeOutputPath(options.configPath) : null,
		stage: options.stage ?? DEFAULT_STAGE,
		probeCount: probes.length,
		visual: {
			debugRgbWavelengthsNm: DEBUG_RGB_WAVELENGTHS,
			scale: visualScale,
			note: 'Debug RGB maps nearest 650/550/450 nm samples to R/G/B and applies one run-wide scale.',
		},
		probes,
	};
}

function attachMultiscatterDiagnostics(result, options) {
	let decorated = result;

	if (options.externalRadiancePath) {
		decorated = {
			...decorated,
			externalRadianceComparison: compareExternalRadianceReference(
				decorated,
				loadExternalRadianceReference(options.externalRadiancePath),
				options.externalRadiancePath,
			),
		};
	}

	if (options.multipleScatteringReference) {
		decorated = {
			...decorated,
			multipleScatteringReference: createMultipleScatteringReferenceSidecar(
				options.multipleScatteringReference,
				decorated,
				options,
			),
		};
	}

	return decorated;
}

function createBaselineFreezeMetadata({
	phase,
	mode,
	scenarios,
	wavelengthGrid,
	numerical,
	solarSource,
	domeSampleMask,
}) {
	return {
		id: MULTISCATTER_BASELINE_ID,
		phase,
		mode,
		status: 'frozen-current-single-scattering-baseline',
		canonicalTransport: 'integrateSingleScattering -> composeSpectralRadiance',
		finalRadianceOwner: 'spectralRadiance.finalByWavelength',
		proxyPolicy: 'removed haze-lift/diffuse-airlight proxies are not part of this baseline',
		scenarios: [...scenarios],
		wavelengthGrid,
		numerical,
		solarSource,
		domeSampleMask,
	};
}

function loadExternalRadianceReference(referencePath) {
	const artifact = JSON.parse(fs.readFileSync(referencePath, 'utf8'));

	if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
		throw new Error('--external-radiance requires a JSON object');
	}

	if (!artifact.source || typeof artifact.source !== 'object' || Array.isArray(artifact.source)) {
		throw new Error('--external-radiance requires source metadata');
	}

	if (!Array.isArray(artifact.wavelengthsNm) || artifact.wavelengthsNm.length === 0) {
		throw new Error('--external-radiance requires wavelengthsNm');
	}

	for (const wavelengthNm of artifact.wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm)) {
			throw new Error('--external-radiance wavelengthsNm must be finite');
		}
	}

	if (!Array.isArray(artifact.samples) || artifact.samples.length === 0) {
		throw new Error('--external-radiance requires nonempty samples');
	}

	for (const [index, sample] of artifact.samples.entries()) {
		const scenarioId = sample.scenarioId ?? artifact.scenarioId;

		if (!scenarioId || typeof scenarioId !== 'string') {
			throw new Error(`--external-radiance sample ${index} requires scenarioId`);
		}

		if (!sample.sampleRole || typeof sample.sampleRole !== 'string') {
			throw new Error(`--external-radiance sample ${index} requires sampleRole`);
		}

		if (
			!Array.isArray(sample.spectralRadiance)
			|| sample.spectralRadiance.length !== artifact.wavelengthsNm.length
		) {
			throw new Error(`--external-radiance sample ${index} spectralRadiance must align to wavelengthsNm`);
		}

		for (const value of sample.spectralRadiance) {
			if (!Number.isFinite(value) || value < 0) {
				throw new Error(`--external-radiance sample ${index} spectralRadiance must be nonnegative finite`);
			}
		}
	}

	return artifact;
}

function compareExternalRadianceReference(result, reference, referencePath) {
	const samples = reference.samples.map((sample, index) => {
		return compareExternalRadianceSample(result, reference, sample, index);
	});

	return {
		kind: 'flat-atmosphere-external-radiance-comparison',
		referencePath: normalizeOutputPath(referencePath),
		source: cloneJsonValue(reference.source),
		referenceScenarioId: reference.scenarioId ?? null,
		referenceWavelengthsNm: [...reference.wavelengthsNm],
		sampleCount: samples.length,
		matchedSampleCount: samples.filter((sample) => sample.status === 'matched').length,
		unmatchedSampleCount: samples.filter((sample) => sample.status !== 'matched').length,
		samples,
	};
}

function compareExternalRadianceSample(result, reference, sample, sampleIndex) {
	const scenarioId = sample.scenarioId ?? reference.scenarioId;
	const generated = findGeneratedRadianceSample(result, scenarioId, sample.sampleRole);

	if (!generated) {
		return {
			index: sampleIndex,
			status: 'unmatched',
			scenarioId,
			sampleRole: sample.sampleRole,
			reason: 'no generated diagnostic sample matched the scenarioId and sampleRole',
		};
	}

	const wavelengthMatches = matchExactWavelengths(reference.wavelengthsNm, generated.wavelengthsNm);
	const expectedRadianceByWavelength = wavelengthMatches.map((match) => {
		return sample.spectralRadiance[match.referenceIndex];
	});
	const actualRadianceByWavelength = wavelengthMatches.map((match) => {
		return generated.radianceByWavelength[match.generatedIndex];
	});
	const signedErrorByWavelength = actualRadianceByWavelength.map((actual, index) => {
		return actual - expectedRadianceByWavelength[index];
	});
	const absoluteErrorByWavelength = signedErrorByWavelength.map(Math.abs);
	const relativeErrorByWavelength = absoluteErrorByWavelength.map((absoluteError, index) => {
		const expected = expectedRadianceByWavelength[index];

		return expected > 0 ? absoluteError / expected : null;
	});

	return {
		index: sampleIndex,
		status: 'matched',
		scenarioId,
		sampleRole: sample.sampleRole,
		generatedKind: generated.kind,
		displayHex: generated.displayHex ?? null,
		matchedWavelengthsNm: wavelengthMatches.map((match) => match.wavelengthNm),
		omittedReferenceWavelengthsNm: reference.wavelengthsNm.filter((wavelengthNm) => {
			return !wavelengthMatches.some((match) => match.wavelengthNm === wavelengthNm);
		}),
		expectedRadianceByWavelength,
		actualRadianceByWavelength,
		signedErrorByWavelength,
		absoluteErrorByWavelength,
		relativeErrorByWavelength,
		meanAbsoluteError: averageOrNull(absoluteErrorByWavelength),
		rmsAbsoluteError: rootMeanSquare(absoluteErrorByWavelength),
		meanRelativeError: averageOrNull(relativeErrorByWavelength.filter((value) => value !== null)),
	};
}

function findGeneratedRadianceSample(result, scenarioId, sampleRole) {
	if (Array.isArray(result.skyDomePanels)) {
		const panel = result.skyDomePanels.find((candidate) => candidate.id === scenarioId);

		if (!panel) {
			return null;
		}

		const sample = findSkyDomeRoleSample(panel, sampleRole);

		if (!sample) {
			return null;
		}

		return {
			kind: 'sky-dome-panel',
			wavelengthsNm: panel.wavelengthsNm,
			radianceByWavelength: sample.renderedByWavelength,
			displayHex: sample.displayHex,
		};
	}

	if (Array.isArray(result.skyPatches)) {
		const patch = result.skyPatches.find((candidate) => candidate.id === scenarioId);

		if (!patch || sampleRole !== 'center') {
			return null;
		}

		const sample = patch.diagnosticSamples.find((candidate) => {
			return candidate.x === Math.floor(patch.size.width / 2)
				&& candidate.y === Math.floor(patch.size.height / 2);
		});

		if (!sample) {
			return null;
		}

		return {
			kind: 'sky-patch',
			wavelengthsNm: patch.wavelengthsNm,
			radianceByWavelength: sample.renderedByWavelength ?? sample.finalByWavelength,
			displayHex: sample.displayHex,
		};
	}

	return null;
}

function findSkyDomeRoleSample(panel, sampleRole) {
	if (sampleRole === 'zenith' || sampleRole === 'center') {
		return skyDomeCenterSample(panel);
	}

	if (sampleRole === 'horizon-edge') {
		return skyDomeHorizonEdgeSample(panel);
	}

	return null;
}

function matchExactWavelengths(referenceWavelengthsNm, generatedWavelengthsNm) {
	const matches = referenceWavelengthsNm.flatMap((referenceWavelengthNm, referenceIndex) => {
		const generatedIndex = generatedWavelengthsNm.indexOf(referenceWavelengthNm);

		return generatedIndex >= 0
			? [{ wavelengthNm: referenceWavelengthNm, referenceIndex, generatedIndex }]
			: [];
	});

	if (matches.length === 0) {
		throw new Error('--external-radiance comparison requires at least one exact wavelength match');
	}

	return matches;
}

function createMultipleScatteringReferenceSidecar(mode, result, options = {}) {
	if (mode === 'none') {
		return createNoOpMultipleScatteringReference(result);
	}

	if (mode === 'order-by-order-grid') {
		return computeOrderByOrderGridReference(result, options);
	}

	if (mode === 'iterative-field-grid') {
		return computeIterativeFieldGridReference(result, options);
	}

	return {
		kind: 'flat-atmosphere-multiple-scattering-reference',
		mode,
		status: 'not-computed',
		outputPolicy: 'sidecar only; spectralRadiance.finalByWavelength is unchanged',
		plannedSolver: 'order-by-order-grid',
		radianceByWavelength: null,
		orders: [],
		convergence: {
			maxOrder: null,
			thresholdFraction: null,
			lastOrderFraction: null,
			converged: null,
		},
		diagnostics: {
			geometryKind: result.kind === 'flat-atmosphere-reference-sky-dome-grid'
				? 'spherical-earth-like-sky-dome'
				: 'spherical-earth-like-sky-patch',
			tauRegime: 'not-evaluated',
			angularSampleCount: null,
			altitudeLayerCount: null,
			calibrationReference: null,
			warnings: [
				'contract scaffold only; no higher-order radiance has been computed',
				'do not compare this field as physical radiance until an order-by-order solver populates it',
			],
		},
	};
}

function createNoOpMultipleScatteringReference(result) {
	const wavelengthsNm = collectResultWavelengths(result);

	return {
		kind: 'flat-atmosphere-multiple-scattering-reference',
		mode: 'none',
		status: 'disabled-no-op',
		outputPolicy: 'sidecar only; multiple-scattering radiance is explicitly zero and spectralRadiance.finalByWavelength is unchanged',
		plannedSolver: 'none',
		wavelengthsNm,
		radianceByWavelength: wavelengthsNm.map(() => 0),
		orders: [],
		contributionPolicy: 'zero-radiance-no-op',
		convergence: {
			maxOrder: 0,
			thresholdFraction: null,
			lastOrderFraction: 0,
			converged: true,
		},
		diagnostics: {
			geometryKind: result.kind === 'flat-atmosphere-reference-sky-dome-grid'
				? 'spherical-earth-like-sky-dome'
				: 'spherical-earth-like-sky-patch',
			targetMode: 'none',
			tauRegime: 'not-evaluated',
			targetCount: 0,
			angularSampleCount: 0,
			altitudeLayerCount: 0,
			calibrationReference: null,
			warnings: [
				'multiple scattering explicitly disabled for contribution isolation',
			],
		},
	};
}

function collectResultWavelengths(result) {
	const source = result.skyDomePanels?.[0]
		?? result.skyPatches?.[0]
		?? result.probes?.[0]?.summary;

	if (!Array.isArray(source?.wavelengthsNm) || source.wavelengthsNm.length === 0) {
		return [];
	}

	return [...source.wavelengthsNm];
}

function computeOrderByOrderGridReference(result, options) {
	const modelInputs = resolveMultipleScatteringModelInputs(result);
	const config = {
		...MULTISCATTER_GRID_DEFAULTS,
		maxOrder: options.multipleScatteringMaxOrder ?? MULTISCATTER_GRID_DEFAULTS.maxOrder,
		targetMode: options.multipleScatteringTargets ?? MULTISCATTER_GRID_DEFAULTS.targetMode,
		angularSampleCount: options.multipleScatteringAngularSamples
			?? MULTISCATTER_GRID_DEFAULTS.angularSampleCount,
	};
	validateOrderByOrderGridConfig(config);
	const targets = collectMultipleScatteringTargets(result, config);
	const incomingDirections = fibonacciSphereDirections(config.angularSampleCount);
	const integrator = new CpuSpectralReferenceIntegrator();
	const sampleResults = [];
	const aggregateOrders = Array.from(
		{ length: config.maxOrder },
		() => modelInputs.wavelengthsNm.map(() => 0),
	);
	const progressReporter = options.progressReporter;

	progressReporter?.({
		phase: 'multiple-scattering-start',
		mode: 'order-by-order-grid',
		targetMode: config.targetMode,
		targetCount: targets.length,
		angularSampleCount: incomingDirections.length,
	});

	for (const [targetIndex, target] of targets.entries()) {
		progressReporter?.({
			phase: 'multiple-scattering-target-start',
			targetIndex,
			targetCount: targets.length,
			scenarioId: target.scenarioId,
			sampleRole: target.sampleRole,
		});

		const model = createMultipleScatteringModelForScene(target.scene, modelInputs);
		const targetResult = computeOrderByOrderGridTarget({
			target,
			model,
			wavelengthsNm: modelInputs.wavelengthsNm,
			integrator,
			incomingDirections,
			config,
			displayOptions: createMultipleScatteringDisplayOptions(result, target, options),
		});

		for (const order of targetResult.orders) {
			addArrayInto(aggregateOrders[order.order - 1], order.radianceByWavelength);
		}
		sampleResults.push(targetResult);

		progressReporter?.({
			phase: 'multiple-scattering-target-complete',
			targetIndex,
			targetCount: targets.length,
			scenarioId: target.scenarioId,
			sampleRole: target.sampleRole,
		});
	}

	const scale = sampleResults.length > 0 ? 1 / sampleResults.length : 0;
	const avgOrders = aggregateOrders.map((values, index) => ({
		order: index + 1,
		radianceByWavelength: values.map((value) => value * scale),
	}));
	const accumulated = sumSpectralOrders(
		avgOrders.map((order) => order.radianceByWavelength),
		modelInputs.wavelengthsNm,
	);
	const lastOrder = avgOrders[avgOrders.length - 1]?.radianceByWavelength ?? modelInputs.wavelengthsNm.map(() => 0);
	const lastOrderFraction = spectralEnergy(accumulated) > 0
		? spectralEnergy(lastOrder) / spectralEnergy(accumulated)
		: 0;

	progressReporter?.({
		phase: 'multiple-scattering-complete',
		mode: 'order-by-order-grid',
		targetMode: config.targetMode,
		targetCount: targets.length,
	});

	return {
		kind: 'flat-atmosphere-multiple-scattering-reference',
		mode: 'order-by-order-grid',
		status: 'computed-prototype',
		outputPolicy: 'sidecar only; spectralRadiance.finalByWavelength is unchanged',
		plannedSolver: 'order-by-order-grid',
		wavelengthsNm: modelInputs.wavelengthsNm,
		radianceByWavelength: accumulated,
		orders: avgOrders,
		convergence: {
			maxOrder: config.maxOrder,
			thresholdFraction: config.thresholdFraction,
			lastOrderFraction,
			converged: lastOrderFraction < config.thresholdFraction,
		},
		diagnostics: {
			geometryKind: result.kind === 'flat-atmosphere-reference-sky-dome-grid'
				? 'spherical-earth-like-sky-dome'
				: 'spherical-earth-like-sky-patch',
			tauRegime: summarizeSidecarTauRegime(sampleResults),
			targetMode: config.targetMode,
			angularSampleCount: config.angularSampleCount,
			altitudeLayerCount: config.viewSteps,
			incomingViewSteps: config.incomingViewSteps,
			sunTransmittanceSteps: config.sunTransmittanceSteps,
			domeRingViewZenithDeg: config.targetMode === 'dome-rings'
				? [...MULTISCATTER_DOME_RING_VIEW_ZENITH_DEG]
				: null,
			domeRingRelativeAzimuthDeg: config.targetMode === 'dome-rings'
				? [...MULTISCATTER_DOME_RING_RELATIVE_AZIMUTH_DEG]
				: null,
			calibrationReference: result.sourceComparison?.id ?? null,
			targetCount: targets.length,
			warnings: [
				`prototype sidecar only; computes through order ${config.maxOrder} from a coarse angular sky field`,
				'not a canonical transport stage and not a production precomputed-atmosphere solver',
				'uses fixed coarse diagnostic sampling to bound runtime',
			],
		},
		samples: sampleResults,
	};
}

function computeIterativeFieldGridReference(result, options) {
	if (!Array.isArray(result.skyDomePanels)) {
		throw new Error('--multiple-scattering-reference iterative-field-grid requires sky-dome results');
	}

	const modelInputs = resolveMultipleScatteringModelInputs(result);
	const config = {
		...MULTISCATTER_GRID_DEFAULTS,
		maxOrder: options.multipleScatteringMaxOrder ?? MULTISCATTER_MAX_SUPPORTED_ORDER,
		angularSampleCount: options.multipleScatteringAngularSamples
			?? Math.max(16, MULTISCATTER_GRID_DEFAULTS.angularSampleCount),
		fieldInterpolation: options.multipleScatteringFieldInterpolation ?? DEFAULT_MULTISCATTER_FIELD_INTERPOLATION,
		fieldDirectionBasis: options.multipleScatteringFieldDirectionBasis ?? DEFAULT_MULTISCATTER_FIELD_DIRECTION_BASIS,
		fieldAltitudeGrid: options.multipleScatteringFieldAltitudeGrid ?? DEFAULT_MULTISCATTER_FIELD_ALTITUDE_GRID,
		targetMode: 'field-grid',
	};
	validateIterativeFieldGridConfig(config);

	const altitudeLayersKm = resolveMultipleScatteringFieldAltitudeLayers(config.fieldAltitudeGrid);
	const integrator = new CpuSpectralReferenceIntegrator();
	const progressReporter = options.progressReporter;
	const fieldScenes = [];
	const aggregateOrders = Array.from(
		{ length: config.maxOrder },
		() => modelInputs.wavelengthsNm.map(() => 0),
	);
	const estimatedTargetCount = result.skyDomePanels.reduce((total, panel) => {
		const scene = SKY_DOME_GRID_SCENES.find((candidate) => candidate.id === panel.id);
		const directionCount = scene
			? createMultipleScatteringFieldDirectionSamples(config, scene).length
			: config.angularSampleCount;

		return total + altitudeLayersKm.length * directionCount;
	}, 0);

	progressReporter?.({
		phase: 'multiple-scattering-start',
		mode: 'iterative-field-grid',
		targetMode: 'field-grid',
		targetCount: estimatedTargetCount,
		angularSampleCount: config.angularSampleCount,
		fieldDirectionBasis: config.fieldDirectionBasis,
		fieldAltitudeGrid: config.fieldAltitudeGrid,
	});

	for (const [panelIndex, panel] of result.skyDomePanels.entries()) {
		const scene = SKY_DOME_GRID_SCENES.find((candidate) => candidate.id === panel.id);

		if (!scene) {
			throw new Error(`iterative field reference requires known sky-dome scene ${panel.id}`);
		}

		progressReporter?.({
			phase: 'multiple-scattering-target-start',
			targetIndex: panelIndex,
			targetCount: result.skyDomePanels.length,
			scenarioId: panel.id,
			sampleRole: 'field-grid',
		});

		const model = createMultipleScatteringModelForScene(scene, modelInputs);
		const displayOptions = createMultipleScatteringDisplayOptions(result, { scene }, options);
		const directionSamples = createMultipleScatteringFieldDirectionSamples(config, scene);
		const fieldScene = computeIterativeFieldScene({
			panel,
			scene,
			model,
			wavelengthsNm: modelInputs.wavelengthsNm,
			integrator,
			directionSamples,
			altitudeLayersKm,
			config,
			displayOptions,
		});

		for (const order of fieldScene.orders) {
			addArrayInto(aggregateOrders[order.order - 1], order.averageRadianceByWavelength);
		}

		fieldScenes.push(fieldScene);
		progressReporter?.({
			phase: 'multiple-scattering-target-complete',
			targetIndex: panelIndex,
			targetCount: result.skyDomePanels.length,
			scenarioId: panel.id,
			sampleRole: 'field-grid',
		});
	}

	const scale = fieldScenes.length > 0 ? 1 / fieldScenes.length : 0;
	const avgOrders = aggregateOrders.map((values, index) => ({
		order: index + 1,
		radianceByWavelength: values.map((value) => value * scale),
	}));
	const accumulated = sumSpectralOrders(
		avgOrders.map((order) => order.radianceByWavelength),
		modelInputs.wavelengthsNm,
	);
	const lastOrder = avgOrders[avgOrders.length - 1]?.radianceByWavelength
		?? modelInputs.wavelengthsNm.map(() => 0);
	const lastOrderFraction = spectralEnergy(accumulated) > 0
		? spectralEnergy(lastOrder) / spectralEnergy(accumulated)
		: 0;
	const reconstruction = summarizeIterativeFieldSceneReconstructions(fieldScenes, config);

	progressReporter?.({
		phase: 'multiple-scattering-complete',
		mode: 'iterative-field-grid',
		targetMode: 'field-grid',
		targetCount: fieldScenes.length,
	});

	return {
		kind: 'flat-atmosphere-multiple-scattering-reference',
		mode: 'iterative-field-grid',
		status: 'computed-prototype',
		outputPolicy: 'sidecar only; spectralRadiance.finalByWavelength is unchanged',
		plannedSolver: 'cached-iterative-field-grid',
		wavelengthsNm: modelInputs.wavelengthsNm,
		radianceByWavelength: accumulated,
		orders: avgOrders,
		convergence: {
			maxOrder: config.maxOrder,
			thresholdFraction: config.thresholdFraction,
			lastOrderFraction,
			converged: lastOrderFraction < config.thresholdFraction,
		},
		reconstruction,
		diagnostics: {
			geometryKind: 'spherical-earth-like-sky-dome',
			targetMode: 'field-grid',
			tauRegime: summarizeFieldTauRegime(fieldScenes),
			requestedAngularSampleCount: config.angularSampleCount,
			angularSampleCount: fieldScenes[0]?.grid.directionCount ?? config.angularSampleCount,
			angularSampleCountByScene: fieldScenes.map((scene) => ({
				scenarioId: scene.scenarioId,
				directionCount: scene.grid.directionCount,
			})),
			altitudeLayerCount: altitudeLayersKm.length,
			incomingViewSteps: config.incomingViewSteps,
			sunTransmittanceSteps: config.sunTransmittanceSteps,
			calibrationReference: result.sourceComparison?.id ?? null,
			targetCount: fieldScenes.reduce((total, scene) => {
				return total + scene.grid.altitudeLayersKm.length * scene.grid.directionCount;
			}, 0),
			fieldInterpolation: config.fieldInterpolation,
			fieldDirectionBasis: config.fieldDirectionBasis,
			fieldDirectionPolicy: describeFieldDirectionPolicy(config),
			fieldDirectionWeightSumSr: fieldScenes[0]?.grid.directionWeightSumSr ?? null,
			fieldDirectionWeightRelativeError: fieldScenes[0]?.grid.directionWeightRelativeError ?? null,
			fieldAltitudeGrid: config.fieldAltitudeGrid,
			fieldAltitudePolicy: config.fieldInterpolation === 'weighted'
				? 'fixed ground-biased altitude layers, linear interpolation'
				: 'fixed ground-biased altitude layers, nearest-neighbor lookup',
			warnings: [
				config.fieldInterpolation === 'weighted'
					? 'prototype sidecar only; cached iterative field is low resolution with weighted interpolation'
					: 'prototype sidecar only; cached iterative field is low resolution and nearest-neighbor',
				'not a canonical transport stage and not a production precomputed-atmosphere solver',
				'comparison panels are diagnostic images; canonical skydome pixels are unchanged',
			],
		},
		fieldScenes,
	};
}

function validateIterativeFieldGridConfig(config) {
	if (config.maxOrder < 2 || config.maxOrder > MULTISCATTER_MAX_SUPPORTED_ORDER) {
		throw new Error(`iterative-field-grid supports orders 2-${MULTISCATTER_MAX_SUPPORTED_ORDER}`);
	}

	if (!Number.isInteger(config.angularSampleCount) || config.angularSampleCount <= 0) {
		throw new Error('--multiple-scattering-angular-samples requires a positive integer');
	}

	if (!MULTISCATTER_FIELD_INTERPOLATION_MODES.includes(config.fieldInterpolation)) {
		throw new Error(`Unknown multiple-scattering field interpolation mode: ${config.fieldInterpolation}`);
	}

	if (!MULTISCATTER_FIELD_DIRECTION_BASIS_IDS.includes(config.fieldDirectionBasis)) {
		throw new Error(`Unknown multiple-scattering field direction basis: ${config.fieldDirectionBasis}`);
	}

	if (!MULTISCATTER_FIELD_ALTITUDE_GRID_IDS.includes(config.fieldAltitudeGrid)) {
		throw new Error(`Unknown multiple-scattering field altitude grid: ${config.fieldAltitudeGrid}`);
	}
}

function computeIterativeFieldScene({
	panel,
	scene,
	model,
	wavelengthsNm,
	integrator,
	directionSamples,
	altitudeLayersKm,
	config,
	displayOptions,
}) {
	const directions = directionSamples.map((sample) => sample.direction);
	const numerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: config.viewSteps,
		sunTransmittanceSteps: config.sunTransmittanceSteps,
	};
	const orderFields = [];
	const tauRegimes = [];

	for (let order = 1; order <= config.maxOrder; order += 1) {
		const previousField = order > 1 ? orderFields[order - 2] : null;
		const field = altitudeLayersKm.map((altitudeKm) => {
			return directions.map((direction) => {
				const packet = integrator.traceRay({
					model,
					observer: { positionKm: [0, altitudeKm, 0] },
					ray: { direction },
					wavelengthsNm,
					numerical,
				});

				if (order === 1) {
					tauRegimes.push(summarizeOpticalDepthValidity(
						summarizeTotalOpticalDepthByWavelength(
							summarizeSpeciesOpticalDepth(packet.viewOpticalDepth?.pathEnd),
							wavelengthsNm,
						),
						wavelengthsNm,
					));

					return validateSpectralArray(
						packet.singleScattering?.inScatteredRadianceByWavelength,
						wavelengthsNm,
						'iterative-field order 1',
					);
				}

				return integrateCachedFieldOrderRadiance({
					packet,
					previousField,
					wavelengthsNm,
					directionSamples,
					altitudeLayersKm,
					fieldInterpolation: config.fieldInterpolation,
					cameraRayDirection: direction,
				});
			});
		});

		orderFields.push(field);
	}

	const orders = orderFields.map((field, index) => {
		const averageRadianceByWavelength = averageFieldRadiance(field, wavelengthsNm, directionSamples);

		return {
			order: index + 1,
			averageRadianceByWavelength,
			energy: spectralEnergy(averageRadianceByWavelength),
		};
	});
	const accumulatedAverage = sumSpectralOrders(
		orders.map((order) => order.averageRadianceByWavelength),
		wavelengthsNm,
	);
	const lastOrderFraction = spectralEnergy(accumulatedAverage) > 0
		? spectralEnergy(orders[orders.length - 1].averageRadianceByWavelength)
			/ spectralEnergy(accumulatedAverage)
		: 0;
	const comparisonPanels = createIterativeFieldComparisonPanels({
		panel,
		scene,
		orderFields,
		wavelengthsNm,
		directions,
		directionSamples,
		altitudeLayersKm,
		fieldInterpolation: config.fieldInterpolation,
		displayOptions,
	});
	const reconstruction = evaluateIterativeFieldL1Reconstruction({
		panel,
		scene,
		model,
		wavelengthsNm,
		integrator,
		order1Field: orderFields[0],
		directions,
		directionSamples,
		altitudeLayersKm,
		fieldInterpolation: config.fieldInterpolation,
		config,
		displayOptions,
	});
	const imageReconstruction = evaluateIterativeFieldImageL1Reconstruction({
		panel,
		scene,
		order1Field: orderFields[0],
		directions,
		altitudeLayersKm,
		fieldInterpolation: config.fieldInterpolation,
		displayOptions,
	});
	const directionWeightSumSr = directionSamples.reduce((total, sample) => total + sample.weightSr, 0);

	return {
		scenarioId: scene.id,
		label: scene.label,
		grid: {
			altitudeLayersKm,
			directionCount: directions.length,
			directionPolicy: describeFieldDirectionPolicy(config),
			directionBasis: config.fieldDirectionBasis,
			directionWeightSumSr,
			directionWeightRelativeError: Math.abs(directionWeightSumSr - 4 * Math.PI) / (4 * Math.PI),
			lookupPolicy: config.fieldInterpolation === 'weighted'
				? `linear altitude and inverse-angular ${MULTISCATTER_FIELD_DIRECTION_NEIGHBORS}-neighbor direction interpolation`
				: 'nearest altitude and nearest direction',
			wavelengthsNm,
		},
		orders,
		convergence: {
			maxOrder: config.maxOrder,
			thresholdFraction: config.thresholdFraction,
			lastOrderFraction,
			converged: lastOrderFraction < config.thresholdFraction,
		},
		diagnostics: {
			tauRegime: summarizeTauRegimeIds(tauRegimes),
		},
		reconstruction,
		imageReconstruction,
		comparisonPanels,
	};
}

function integrateCachedFieldOrderRadiance({
	packet,
	previousField,
	wavelengthsNm,
	directionSamples,
	altitudeLayersKm,
	fieldInterpolation,
	cameraRayDirection,
}) {
	const totals = wavelengthsNm.map(() => 0);
	const mediumSamples = packet.mediumSamples ?? [];
	const viewSamples = packet.viewOpticalDepth?.samples ?? [];
	const directions = directionSamples.map((sample) => sample.direction);

	for (const [sampleIndex, mediumSample] of mediumSamples.entries()) {
		const viewSample = viewSamples[sampleIndex];

		if (!viewSample) {
			continue;
		}

		for (const incomingSample of directionSamples) {
			const incomingDirection = incomingSample.direction;
			const incomingRadiance = lookupFieldRadiance({
				field: previousField,
				positionKm: mediumSample.positionKm,
				direction: incomingDirection,
				directions,
				altitudeLayersKm,
				interpolationMode: fieldInterpolation,
			});
			const scatteringPhase = scatteringPhaseWeightedBySpecies({
				mediumSample,
				wavelengthsNm,
				sourceDirectionFromSample: incomingDirection,
				directionFromSampleToCamera: scale3(cameraRayDirection, -1),
			});

			for (const [wavelengthIndex, incomingValue] of incomingRadiance.entries()) {
				totals[wavelengthIndex] += (
					(viewSample.viewTransmittanceByWavelength?.[wavelengthIndex] ?? 0)
					* mediumSample.weightKm
					* incomingSample.weightSr
					* incomingValue
					* scatteringPhase[wavelengthIndex]
				);
			}
		}
	}

	return totals;
}

function lookupFieldRadiance({
	field,
	positionKm,
	direction,
	directions,
	altitudeLayersKm,
	interpolationMode = DEFAULT_MULTISCATTER_FIELD_INTERPOLATION,
}) {
	if (interpolationMode === 'weighted') {
		return lookupWeightedFieldRadiance({
			field,
			positionKm,
			direction,
			directions,
			altitudeLayersKm,
		});
	}

	const altitudeKm = Math.max(0, positionKm?.[1] ?? 0);
	const altitudeIndex = nearestNumberIndex(altitudeLayersKm, altitudeKm);
	const directionIndex = nearestDirectionIndex(directions, direction);

	return field[altitudeIndex]?.[directionIndex] ?? field[0][0];
}

function lookupWeightedFieldRadiance({
	field,
	positionKm,
	direction,
	directions,
	altitudeLayersKm,
}) {
	const altitudeKm = Math.max(0, positionKm?.[1] ?? 0);
	const bracket = bracketingNumberIndices(altitudeLayersKm, altitudeKm);
	const lowerRadiance = lookupWeightedDirectionRadiance(
		field[bracket.lowerIndex],
		direction,
		directions,
	);

	if (bracket.lowerIndex === bracket.upperIndex) {
		return lowerRadiance;
	}

	const upperRadiance = lookupWeightedDirectionRadiance(
		field[bracket.upperIndex],
		direction,
		directions,
	);

	return lowerRadiance.map((value, wavelengthIndex) => {
		return value * (1 - bracket.upperWeight)
			+ upperRadiance[wavelengthIndex] * bracket.upperWeight;
	});
}

function lookupWeightedDirectionRadiance(layer, direction, directions) {
	const neighbors = nearestDirectionNeighbors(
		directions,
		direction,
		MULTISCATTER_FIELD_DIRECTION_NEIGHBORS,
	);
	const exact = neighbors.find((neighbor) => neighbor.angleRad < 1e-8);

	if (exact) {
		return layer[exact.index] ?? layer[0];
	}

	const wavelengthsNm = layer[0].map(() => 0);
	let totalWeight = 0;

	for (const neighbor of neighbors) {
		const weight = 1 / Math.max(neighbor.angleRad * neighbor.angleRad, 1e-8);
		addArrayIntoWeighted(wavelengthsNm, layer[neighbor.index], weight);
		totalWeight += weight;
	}

	return totalWeight > 0
		? wavelengthsNm.map((value) => value / totalWeight)
		: layer[0];
}

function averageFieldRadiance(field, wavelengthsNm, directionSamples = null) {
	const total = wavelengthsNm.map(() => 0);
	let totalWeight = 0;

	for (const altitudeLayer of field) {
		for (const [directionIndex, radiance] of altitudeLayer.entries()) {
			const weight = directionSamples?.[directionIndex]?.weightSr ?? 1;
			addArrayIntoWeighted(total, radiance, weight);
			totalWeight += weight;
		}
	}

	return totalWeight > 0 ? total.map((value) => value / totalWeight) : total;
}

function evaluateIterativeFieldL1Reconstruction({
	panel,
	scene,
	model,
	wavelengthsNm,
	integrator,
	order1Field,
	directions,
	directionSamples,
	altitudeLayersKm,
	fieldInterpolation,
	config,
	displayOptions,
}) {
	const targets = createSkyDomeRingMultipleScatteringTargets(panel, scene);
	const numerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: config.viewSteps,
		sunTransmittanceSteps: config.sunTransmittanceSteps,
	};
	const samples = targets.map((target) => {
		const packet = integrator.traceRay({
			model,
			observer: { positionKm: [0, 0, 0] },
			ray: { direction: target.direction },
			wavelengthsNm,
			numerical,
		});
		const direct = validateSpectralArray(
			packet.singleScattering?.inScatteredRadianceByWavelength,
			wavelengthsNm,
			'iterative-field reconstruction direct order 1',
		);
		const reconstructed = lookupFieldRadiance({
			field: order1Field,
			positionKm: [0, 0, 0],
			direction: target.direction,
			directions,
			altitudeLayersKm,
			interpolationMode: fieldInterpolation,
		});
		const absoluteErrorByWavelength = reconstructed.map((value, wavelengthIndex) => {
			return Math.abs(value - direct[wavelengthIndex]);
		});
		const relativeErrorByWavelength = absoluteErrorByWavelength.map((value, wavelengthIndex) => {
			return direct[wavelengthIndex] > 0 ? value / direct[wavelengthIndex] : null;
		});
		const directDisplay = createMultipleScatteringDisplaySwatch(
			direct,
			wavelengthsNm,
			displayOptions,
		);
		const reconstructedDisplay = createMultipleScatteringDisplaySwatch(
			reconstructed,
			wavelengthsNm,
			displayOptions,
		);
		const displayRgbAbsoluteError = mean([
			Math.abs(reconstructedDisplay.displaySrgb.r - directDisplay.displaySrgb.r),
			Math.abs(reconstructedDisplay.displaySrgb.g - directDisplay.displaySrgb.g),
			Math.abs(reconstructedDisplay.displaySrgb.b - directDisplay.displaySrgb.b),
		]);
		const linearLuminanceAbsoluteError = Math.abs(
			reconstructedDisplay.linearLuminance - directDisplay.linearLuminance,
		);
		const linearLuminanceRelativeError = directDisplay.linearLuminance > 0
			? linearLuminanceAbsoluteError / directDisplay.linearLuminance
			: null;

		return {
			scenarioId: target.scenarioId,
			sampleRole: target.sampleRole,
			viewZenithDeg: target.viewZenithDeg,
			relativeAzimuthDeg: target.relativeAzimuthDeg,
			directDisplayHex: directDisplay.displayHex,
			reconstructedDisplayHex: reconstructedDisplay.displayHex,
			directRadianceByWavelength: direct,
			reconstructedRadianceByWavelength: reconstructed,
			absoluteErrorByWavelength,
			relativeErrorByWavelength,
			relativeSpectralEnergyError: spectralEnergy(direct) > 0
				? spectralEnergy(absoluteErrorByWavelength) / spectralEnergy(direct)
				: null,
			meanRelativeSpectralError: averageOrNull(relativeErrorByWavelength.filter((value) => value !== null)),
			displayRgbAbsoluteError,
			linearLuminanceAbsoluteError,
			linearLuminanceRelativeError,
		};
	});

	return {
		kind: 'flat-atmosphere-iterative-field-l1-reconstruction',
		targetMode: 'dome-rings',
		interpolationMode: fieldInterpolation,
		directionBasis: config.fieldDirectionBasis,
		directionCount: directionSamples.length,
		targetCount: samples.length,
		numerical,
		aggregate: summarizeIterativeFieldReconstruction(samples),
		byViewZenithDeg: summarizeIterativeFieldReconstructionByViewZenith(samples),
		worstSamples: [...samples]
			.sort((a, b) => (b.relativeSpectralEnergyError ?? -Infinity)
				- (a.relativeSpectralEnergyError ?? -Infinity))
			.slice(0, 5)
			.map((sample) => ({
				scenarioId: sample.scenarioId,
				sampleRole: sample.sampleRole,
				viewZenithDeg: sample.viewZenithDeg,
				relativeAzimuthDeg: sample.relativeAzimuthDeg,
				relativeSpectralEnergyError: sample.relativeSpectralEnergyError,
				linearLuminanceRelativeError: sample.linearLuminanceRelativeError,
				directDisplayHex: sample.directDisplayHex,
				reconstructedDisplayHex: sample.reconstructedDisplayHex,
			})),
		samples,
	};
}

function evaluateIterativeFieldImageL1Reconstruction({
	panel,
	scene,
	order1Field,
	directions,
	altitudeLayersKm,
	fieldInterpolation,
	displayOptions,
}) {
	const directImage = panel.directRadianceImage;

	if (!directImage?.radianceByPixel) {
		return null;
	}

	const samples = [];

	for (let y = 0; y < panel.size.height; y += 1) {
		for (let x = 0; x < panel.size.width; x += 1) {
			const projection = skyDomeDirectionForPixel(x, y, panel.size.width);

			if (!projection.insideDome) {
				continue;
			}

			const pixelIndex = y * panel.size.width + x;
			const direct = directImage.radianceByPixel[pixelIndex];
			const reconstructed = lookupFieldRadiance({
				field: order1Field,
				positionKm: [0, 0, 0],
				direction: projection.direction,
				directions,
				altitudeLayersKm,
				interpolationMode: fieldInterpolation,
			});
			const absoluteErrorByWavelength = reconstructed.map((value, wavelengthIndex) => {
				return Math.abs(value - direct[wavelengthIndex]);
			});
			const directDisplay = createMultipleScatteringDisplaySwatch(
				direct,
				directImage.wavelengthsNm,
				displayOptions,
			);
			const reconstructedDisplay = createMultipleScatteringDisplaySwatch(
				reconstructed,
				directImage.wavelengthsNm,
				displayOptions,
			);
			const linearLuminanceAbsoluteError = Math.abs(
				reconstructedDisplay.linearLuminance - directDisplay.linearLuminance,
			);

			samples.push({
				scenarioId: scene.id,
				x,
				y,
				radius: projection.radius,
				radiusBand: radiusBandId(projection.radius),
				elevationDeg: projection.elevationDeg,
				azimuthDeg: projection.azimuthDeg,
				relativeSpectralEnergyError: spectralEnergy(direct) > 0
					? spectralEnergy(absoluteErrorByWavelength) / spectralEnergy(direct)
					: null,
				linearLuminanceRelativeError: directDisplay.linearLuminance > 0
					? linearLuminanceAbsoluteError / directDisplay.linearLuminance
					: null,
				directDisplayHex: directDisplay.displayHex,
				reconstructedDisplayHex: reconstructedDisplay.displayHex,
			});
		}
	}

	return {
		kind: 'flat-atmosphere-iterative-field-image-l1-reconstruction',
		targetMode: 'full-fisheye-image',
		interpolationMode: fieldInterpolation,
		imageSize: { ...panel.size },
		comparedPixelCount: samples.length,
		aggregate: summarizeIterativeFieldReconstruction(samples),
		byRadiusBand: summarizeIterativeFieldImageReconstructionByRadiusBand(samples),
		worstSamples: [...samples]
			.sort((a, b) => (b.relativeSpectralEnergyError ?? -Infinity)
				- (a.relativeSpectralEnergyError ?? -Infinity))
			.slice(0, 8)
			.map((sample) => ({
				scenarioId: sample.scenarioId,
				x: sample.x,
				y: sample.y,
				radius: sample.radius,
				radiusBand: sample.radiusBand,
				elevationDeg: sample.elevationDeg,
				azimuthDeg: sample.azimuthDeg,
				relativeSpectralEnergyError: sample.relativeSpectralEnergyError,
				linearLuminanceRelativeError: sample.linearLuminanceRelativeError,
				directDisplayHex: sample.directDisplayHex,
				reconstructedDisplayHex: sample.reconstructedDisplayHex,
			})),
	};
}

function radiusBandId(radius) {
	if (radius < 0.2) {
		return '0.00-0.20 zenith';
	}

	if (radius < 0.5) {
		return '0.20-0.50 upper-sky';
	}

	if (radius < 0.75) {
		return '0.50-0.75 mid-sky';
	}

	if (radius < 0.88) {
		return '0.75-0.88 lower-sky';
	}

	return '0.88-1.00 horizon-ring';
}

function summarizeIterativeFieldImageReconstructionByRadiusBand(samples) {
	const groups = new Map();

	for (const sample of samples) {
		const group = groups.get(sample.radiusBand) ?? [];
		group.push(sample);
		groups.set(sample.radiusBand, group);
	}

	return [...groups.entries()].map(([radiusBand, group]) => ({
		radiusBand,
		...summarizeIterativeFieldReconstruction(group),
	}));
}

function summarizeIterativeFieldReconstruction(samples) {
	return {
		comparedSampleCount: samples.length,
		meanRelativeSpectralEnergyError: mean(samples.map((sample) => sample.relativeSpectralEnergyError)),
		maxRelativeSpectralEnergyError: maxFinite(samples.map((sample) => sample.relativeSpectralEnergyError)),
		rmsRelativeSpectralEnergyError: rootMeanSquare(samples
			.map((sample) => sample.relativeSpectralEnergyError)
			.filter((value) => Number.isFinite(value))),
		meanDisplayRgbAbsoluteError: mean(samples.map((sample) => sample.displayRgbAbsoluteError)),
		meanLinearLuminanceRelativeError: mean(samples.map((sample) => sample.linearLuminanceRelativeError)),
		maxLinearLuminanceRelativeError: maxFinite(samples.map((sample) => sample.linearLuminanceRelativeError)),
	};
}

function summarizeIterativeFieldReconstructionByViewZenith(samples) {
	const groups = new Map();

	for (const sample of samples) {
		const key = String(sample.viewZenithDeg);
		const group = groups.get(key) ?? [];
		group.push(sample);
		groups.set(key, group);
	}

	return [...groups.entries()].map(([viewZenithDeg, group]) => ({
		viewZenithDeg: Number(viewZenithDeg),
		...summarizeIterativeFieldReconstruction(group),
	}));
}

function summarizeIterativeFieldSceneReconstructions(fieldScenes, config) {
	const samples = fieldScenes.flatMap((scene) => scene.reconstruction?.samples ?? []);

	return {
		kind: 'flat-atmosphere-iterative-field-l1-reconstruction-summary',
		targetMode: 'dome-rings',
		interpolationMode: config.fieldInterpolation,
		directionBasis: config.fieldDirectionBasis,
		altitudeGrid: config.fieldAltitudeGrid,
		sceneCount: fieldScenes.length,
		targetCount: samples.length,
		aggregate: summarizeIterativeFieldReconstruction(samples),
		byViewZenithDeg: summarizeIterativeFieldReconstructionByViewZenith(samples),
		worstSamples: [...samples]
			.sort((a, b) => (b.relativeSpectralEnergyError ?? -Infinity)
				- (a.relativeSpectralEnergyError ?? -Infinity))
			.slice(0, 8)
			.map((sample) => ({
				scenarioId: sample.scenarioId,
				sampleRole: sample.sampleRole,
				viewZenithDeg: sample.viewZenithDeg,
				relativeAzimuthDeg: sample.relativeAzimuthDeg,
				relativeSpectralEnergyError: sample.relativeSpectralEnergyError,
				linearLuminanceRelativeError: sample.linearLuminanceRelativeError,
				directDisplayHex: sample.directDisplayHex,
				reconstructedDisplayHex: sample.reconstructedDisplayHex,
			})),
	};
}

function createIterativeFieldComparisonPanels({
	panel,
	scene,
	orderFields,
	wavelengthsNm,
	directions,
	altitudeLayersKm,
	fieldInterpolation,
	displayOptions,
}) {
	const fieldPanels = orderFields.map((_, orderIndex) => {
		const accumulatedField = accumulateFieldOrders(orderFields.slice(0, orderIndex + 1), wavelengthsNm);

		return createIterativeFieldImagePanel({
			id: `field-l1-through-l${orderIndex + 1}`,
			label: `Field L1..L${orderIndex + 1}`,
			accumulatedMaxOrder: orderIndex + 1,
			panel,
			scene,
			wavelengthsNm,
			displayOptions,
			source: 'iterative-field-grid sidecar',
			valuesForPixel: ({ projection }) => {
				return projection.insideDome
					? lookupFieldRadiance({
						field: accumulatedField,
						positionKm: [0, 0, 0],
						direction: projection.direction,
						directions,
						altitudeLayersKm,
						interpolationMode: fieldInterpolation,
					})
					: wavelengthsNm.map(() => 0);
			},
		});
	});

	const directResidualPanels = orderFields.slice(1).map((_, residualIndex) => {
		const maxOrder = residualIndex + 2;
		const residualField = accumulateFieldOrders(orderFields.slice(1, maxOrder), wavelengthsNm);

		return createIterativeFieldImagePanel({
			id: `direct-l1-plus-field-l2-through-l${maxOrder}`,
			label: `Direct L1 + Field L2..L${maxOrder}`,
			accumulatedMaxOrder: maxOrder,
			panel,
			scene,
			wavelengthsNm,
			displayOptions,
			source: 'direct-l1-plus-cached-higher-order sidecar',
			valuesForPixel: ({ projection, pixelIndex }) => {
				if (!projection.insideDome) {
					return wavelengthsNm.map(() => 0);
				}

				const direct = panel.directRadianceImage?.radianceByPixel?.[pixelIndex];
				const residual = lookupFieldRadiance({
					field: residualField,
					positionKm: [0, 0, 0],
					direction: projection.direction,
					directions,
					altitudeLayersKm,
					interpolationMode: fieldInterpolation,
				});

				return (direct ?? wavelengthsNm.map(() => 0)).map((value, wavelengthIndex) => {
					return value + residual[wavelengthIndex];
				});
			},
		});
	});

	return [...fieldPanels, ...directResidualPanels];
}

function createIterativeFieldImagePanel({
	id,
	label,
	accumulatedMaxOrder,
	panel,
	scene,
	wavelengthsNm,
	displayOptions,
	source,
	valuesForPixel,
}) {
	const rows = [];
	const pixels = [];

	for (let y = 0; y < panel.size.height; y += 1) {
		const row = [];

		for (let x = 0; x < panel.size.width; x += 1) {
			const pixelIndex = y * panel.size.width + x;
			const projection = skyDomeDirectionForPixel(x, y, panel.size.width);
			const values = valuesForPixel({ projection, pixelIndex, x, y });
			const rgb = createPatchRgb(values, wavelengthsNm, displayOptions);

			row.push(rgb.hex);
			pixels.push(rgb.pixel);
		}

		rows.push(row);
	}

	const pixelImage = {
		kind: 'atmosphere-color-pixel-image',
		width: panel.size.width,
		height: panel.size.height,
		encoding: displayOptions.encoding,
		exposure: displayOptions.exposure,
		toneMap: displayOptions.toneMap,
		pixels,
		metadata: {
			displayOnly: true,
			colorPolicy: displayOptions.colorPolicy,
			source,
		},
	};

	return {
		id,
		label,
		accumulatedMaxOrder,
		size: { ...panel.size },
		rows,
		modelComparisonMetrics: summarizeSkyDomeModelComparisonMetrics(pixelImage, scene),
		pixelImage,
	};
}

function accumulateFieldOrders(orderFields, wavelengthsNm) {
	const altitudeCount = orderFields[0]?.length ?? 0;
	const directionCount = orderFields[0]?.[0]?.length ?? 0;

	return Array.from({ length: altitudeCount }, (_, altitudeIndex) => {
		return Array.from({ length: directionCount }, (_, directionIndex) => {
			return sumSpectralOrders(
				orderFields.map((field) => field[altitudeIndex][directionIndex]),
				wavelengthsNm,
			);
		});
	});
}

function summarizeFieldTauRegime(fieldScenes) {
	return summarizeTauRegimeIds(fieldScenes.map((scene) => scene.diagnostics?.tauRegime));
}

function summarizeTauRegimeIds(regimes) {
	const ids = regimes
		.map((regime) => typeof regime === 'string' ? regime : regime?.classification?.id)
		.filter(Boolean);

	if (ids.includes('extreme-horizon-path')) {
		return 'extreme-horizon-path';
	}

	if (ids.includes('single-scattering-warning')) {
		return 'single-scattering-warning';
	}

	if (ids.includes('thick')) {
		return 'thick';
	}

	if (ids.includes('moderate')) {
		return 'moderate';
	}

	return ids[0] ?? 'not-evaluated';
}

function validateOrderByOrderGridConfig(config) {
	if (!MULTISCATTER_TARGET_MODES.includes(config.targetMode)) {
		throw new Error(`Unknown multiple-scattering target mode: ${config.targetMode}`);
	}

	if (!Number.isInteger(config.angularSampleCount) || config.angularSampleCount <= 0) {
		throw new Error('--multiple-scattering-angular-samples requires a positive integer');
	}

	if (
		config.targetMode === 'dome-rings'
		&& config.maxOrder > MULTISCATTER_MAX_DOME_RING_ORDER
	) {
		throw new Error(`--multiple-scattering-max-order above ${MULTISCATTER_MAX_DOME_RING_ORDER} is currently diagnostic-target only`);
	}
}

function createMultipleScatteringDisplayOptions(result, target, options) {
	return {
		colorPolicy: result.visual?.colorPolicy ?? DEFAULT_COLOR_POLICY,
		encoding: result.visual?.encoding ?? DEFAULT_PIXEL_ENCODING,
		toneMap: result.visual?.toneMap ?? DEFAULT_TONE_MAP,
		exposure: Number.isFinite(options.exposure)
			? options.exposure
			: target.scene?.displayExposure ?? 1,
	};
}

function collectMultipleScatteringTargets(result, config) {
	if (Array.isArray(result.skyDomePanels)) {
		return result.skyDomePanels.flatMap((panel) => {
			const scene = SKY_DOME_GRID_SCENES.find((candidate) => candidate.id === panel.id);

			if (!scene) {
				throw new Error(`multiple-scattering reference requires known sky-dome scene ${panel.id}`);
			}

			if (config.targetMode === 'dome-rings') {
				return createSkyDomeRingMultipleScatteringTargets(panel, scene);
			}

			return createSkyDomeDiagnosticMultipleScatteringTargets(panel, scene);
		});
	}

	if (Array.isArray(result.skyPatches)) {
		if (config.targetMode !== 'diagnostic') {
			throw new Error('--multiple-scattering-targets dome-rings requires sky-dome results');
		}

		return result.skyPatches.flatMap((patch) => {
			const scene = SKY_PATCH_SCENES[patch.id];

			if (!scene) {
				throw new Error(`multiple-scattering reference requires known sky patch scene ${patch.id}`);
			}

			return patch.diagnosticSamples.map((sample) => ({
				kind: 'sky-patch',
				targetMode: 'diagnostic',
				scenarioId: patch.id,
				label: patch.label,
				x: sample.x,
				y: sample.y,
				sampleRole: sample.x === Math.floor(patch.size.width / 2)
					&& sample.y === Math.floor(patch.size.height / 2)
					? 'center'
					: `sample-${sample.x}-${sample.y}`,
				direction: sample.direction,
				elevationDeg: sample.elevationDeg ?? null,
				azimuthDeg: sample.azimuthDeg ?? null,
				viewZenithDeg: Number.isFinite(sample.elevationDeg) ? 90 - sample.elevationDeg : null,
				relativeAzimuthDeg: null,
				displayHex: sample.displayHex,
				baselineRadianceByWavelength: sample.renderedByWavelength ?? sample.finalByWavelength,
				scene,
			}));
		});
	}

	throw new Error('--multiple-scattering-reference order-by-order-grid requires sky-patch or sky-dome results');
}

function createSkyDomeDiagnosticMultipleScatteringTargets(panel, scene) {
	return panel.diagnosticSamples.map((sample) => ({
		kind: 'sky-dome-panel',
		targetMode: 'diagnostic',
		scenarioId: panel.id,
		label: panel.label,
		x: sample.x,
		y: sample.y,
		sampleRole: sample.x === Math.floor(panel.size.width / 2)
			&& sample.y === Math.floor(panel.size.height / 2)
			? 'zenith'
			: 'horizon-edge',
		direction: sample.direction,
		elevationDeg: sample.elevationDeg,
		azimuthDeg: sample.azimuthDeg,
		viewZenithDeg: Number.isFinite(sample.elevationDeg) ? 90 - sample.elevationDeg : null,
		relativeAzimuthDeg: Number.isFinite(sample.azimuthDeg)
			? normalizeDegrees(sample.azimuthDeg - scene.sunAzimuthDeg)
			: null,
		displayHex: sample.displayHex,
		baselineRadianceByWavelength: sample.renderedByWavelength,
		scene,
	}));
}

function createSkyDomeRingMultipleScatteringTargets(panel, scene) {
	const zenith = createSkyDomeRingTarget(panel, scene, {
		viewZenithDeg: 0,
		relativeAzimuthDeg: 0,
		sampleRole: 'zenith',
	});
	const ringTargets = MULTISCATTER_DOME_RING_VIEW_ZENITH_DEG.flatMap((viewZenithDeg) => {
		return MULTISCATTER_DOME_RING_RELATIVE_AZIMUTH_DEG.map((relativeAzimuthDeg) => {
			return createSkyDomeRingTarget(panel, scene, {
				viewZenithDeg,
				relativeAzimuthDeg,
				sampleRole: `ring-vza-${formatDegreeId(viewZenithDeg)}-raz-${formatDegreeId(relativeAzimuthDeg)}`,
			});
		});
	});

	return [zenith, ...ringTargets];
}

function createSkyDomeRingTarget(panel, scene, {
	viewZenithDeg,
	relativeAzimuthDeg,
	sampleRole,
}) {
	const elevationDeg = 90 - viewZenithDeg;
	const azimuthDeg = normalizeDegrees(scene.sunAzimuthDeg + relativeAzimuthDeg);
	const direction = directionFromElevationAzimuth(elevationDeg, azimuthDeg);
	const pixel = skyDomePixelForDirection(direction, panel.size.width);

	return {
		kind: 'sky-dome-panel',
		targetMode: 'dome-rings',
		scenarioId: panel.id,
		label: panel.label,
		x: pixel.x,
		y: pixel.y,
		sampleRole,
		direction,
		elevationDeg,
		azimuthDeg,
		viewZenithDeg,
		relativeAzimuthDeg,
		displayHex: null,
		baselineRadianceByWavelength: null,
		scene,
	};
}

function resolveMultipleScatteringModelInputs(result) {
	const wavelengthGrid = resolveSkyPatchWavelengthGrid(result.visual?.wavelengthGrid?.id);
	const wavelengthsNm = wavelengthGrid.wavelengthsNm;
	const solarSpectrumPolicy = result.visual?.solarSpectrum?.policy;
	const rayleighPolicy = resolveRayleighPolicy(result.visual?.rayleighPolicy?.id);
	const aerosolPolicy = resolveAerosolPolicy(result.visual?.aerosolPolicy?.id);
	const aerosolPhasePolicy = resolveAerosolPhasePolicy(result.visual?.aerosolPhasePolicy?.id);
	const ozonePolicy = resolveOzonePolicy(result.visual?.ozonePolicy?.id);
	const molecularProfilePolicy = resolveMolecularProfilePolicy(result.visual?.molecularProfile?.id);
	const solarSourceSampling = result.visual?.solarSource ?? resolveSolarSourceSampling();
	const solarSpectrum = sampleSolarSpectrum(wavelengthsNm, {
		policy: solarSpectrumPolicy,
		solarTemperatureK: EARTH_LIKE_SKY.solarTemperatureK,
		solarIrradiance550Wm2Nm: EARTH_LIKE_SKY.solarIrradiance550Wm2Nm,
	});

	return {
		wavelengthsNm,
		wavelengthGrid: wavelengthGrid.metadata,
		solarSpectrumPolicy,
		solarSpectrum,
		rayleighPolicy,
		aerosolPolicy,
		aerosolPhasePolicy,
		ozonePolicy,
		molecularProfilePolicy,
		solarSourceSampling,
	};
}

function createMultipleScatteringModelForScene(scene, modelInputs) {
	return createSkyPatchModel(
		scene,
		modelInputs.wavelengthsNm,
		modelInputs.solarSpectrum,
		modelInputs.rayleighPolicy,
		modelInputs.aerosolPolicy,
		modelInputs.aerosolPhasePolicy,
		modelInputs.ozonePolicy,
		modelInputs.molecularProfilePolicy,
		modelInputs.solarSourceSampling,
	);
}

function computeOrderByOrderGridTarget({
	target,
	model,
	wavelengthsNm,
	integrator,
	incomingDirections,
	config,
	displayOptions,
}) {
	if (!Array.isArray(target.direction)) {
		throw new Error(`multiple-scattering target ${target.scenarioId}/${target.sampleRole} requires direction`);
	}

	const coarseNumerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: config.viewSteps,
		sunTransmittanceSteps: config.sunTransmittanceSteps,
	};
	const packet = integrator.traceRay({
		model,
		observer: { positionKm: [0, 0, 0] },
		ray: { direction: target.direction },
		wavelengthsNm,
		numerical: coarseNumerical,
	});
	const order1 = validateSpectralArray(
		packet.singleScattering?.inScatteredRadianceByWavelength,
		wavelengthsNm,
		'multiple-scattering order 1',
	);
	const orderSpectra = [order1];

	for (let order = 2; order <= config.maxOrder; order += 1) {
		orderSpectra.push(integrateScatteredOrderRadiance({
			sourceOrder: order - 1,
			packet,
			model,
			wavelengthsNm,
			integrator,
			incomingDirections,
			config,
			cameraRayDirection: target.direction,
		}));
	}

	const accumulated = sumSpectralOrders(orderSpectra, wavelengthsNm);
	const order2Fraction = spectralEnergy(accumulated) > 0
		? spectralEnergy(orderSpectra[1] ?? wavelengthsNm.map(() => 0)) / spectralEnergy(accumulated)
		: 0;
	const lastOrderFraction = spectralEnergy(accumulated) > 0
		? spectralEnergy(orderSpectra[orderSpectra.length - 1]) / spectralEnergy(accumulated)
		: 0;
	const displayComparison = createMultipleScatteringDisplayComparison({
		order1,
		order1PlusOrder2: sumSpectralOrders(orderSpectra.slice(0, 2), wavelengthsNm),
		accumulated,
		wavelengthsNm,
		displayOptions,
	});

	return {
		scenarioId: target.scenarioId,
		label: target.label,
		targetMode: target.targetMode,
		sampleRole: target.sampleRole,
		x: target.x,
		y: target.y,
		elevationDeg: target.elevationDeg,
		azimuthDeg: target.azimuthDeg,
		viewZenithDeg: target.viewZenithDeg,
		relativeAzimuthDeg: target.relativeAzimuthDeg,
		displayHex: target.displayHex,
		baselineRadianceByWavelength: target.baselineRadianceByWavelength,
		coarseSingleScatteringRadianceByWavelength: order1,
		radianceByWavelength: accumulated,
		displayComparison,
		orders: orderSpectra.map((radianceByWavelength, index) => ({
			order: index + 1,
			radianceByWavelength,
		})),
		convergence: {
			order2Fraction,
			lastOrderFraction,
			converged: lastOrderFraction < config.thresholdFraction,
		},
		diagnostics: {
			viewSampleCount: packet.mediumSamples?.length ?? 0,
			angularSampleCount: incomingDirections.length,
			tauRegime: summarizeOpticalDepthValidity(
				summarizeTotalOpticalDepthByWavelength(
					summarizeSpeciesOpticalDepth(packet.viewOpticalDepth?.pathEnd),
					wavelengthsNm,
				),
				wavelengthsNm,
			),
		},
	};
}

function integrateScatteredOrderRadiance({
	sourceOrder,
	packet,
	model,
	wavelengthsNm,
	integrator,
	incomingDirections,
	config,
	cameraRayDirection,
}) {
	const totals = wavelengthsNm.map(() => 0);
	const mediumSamples = packet.mediumSamples ?? [];
	const viewSamples = packet.viewOpticalDepth?.samples ?? [];
	const incomingSolidAngleSr = 4 * Math.PI / incomingDirections.length;
	const incomingNumerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: config.incomingViewSteps,
		sunTransmittanceSteps: config.sunTransmittanceSteps,
	};

	if (sourceOrder < 1 || sourceOrder >= config.maxOrder) {
		throw new RangeError(`multiple-scattering source order ${sourceOrder} is outside the configured order range`);
	}

	for (const [sampleIndex, mediumSample] of mediumSamples.entries()) {
		const viewSample = viewSamples[sampleIndex];

		if (!viewSample) {
			continue;
		}

		for (const incomingDirection of incomingDirections) {
			const incomingPacket = integrator.traceRay({
				model,
				observer: { positionKm: mediumSample.positionKm },
				ray: { direction: incomingDirection },
				wavelengthsNm,
				numerical: incomingNumerical,
			});
			const incomingRadiance = incomingOrderRadiance({
				order: sourceOrder,
				packet: incomingPacket,
				model,
				wavelengthsNm,
				integrator,
				incomingDirections,
				config,
				cameraRayDirection: incomingDirection,
			});
			const scatteringPhase = scatteringPhaseWeightedBySpecies({
				mediumSample,
				wavelengthsNm,
				sourceDirectionFromSample: incomingDirection,
				directionFromSampleToCamera: scale3(cameraRayDirection, -1),
			});

			for (const [wavelengthIndex, incomingValue] of incomingRadiance.entries()) {
				totals[wavelengthIndex] += (
					(viewSample.viewTransmittanceByWavelength?.[wavelengthIndex] ?? 0)
					* mediumSample.weightKm
					* incomingSolidAngleSr
					* incomingValue
					* scatteringPhase[wavelengthIndex]
				);
			}
		}
	}

	return totals;
}

function incomingOrderRadiance({
	order,
	packet,
	model,
	wavelengthsNm,
	integrator,
	incomingDirections,
	config,
	cameraRayDirection,
}) {
	if (order === 1) {
		return validateSpectralArray(
			packet.singleScattering?.inScatteredRadianceByWavelength,
			wavelengthsNm,
			'multiple-scattering incoming order 1',
		);
	}

	return integrateScatteredOrderRadiance({
		sourceOrder: order - 1,
		packet,
		model,
		wavelengthsNm,
		integrator,
		incomingDirections,
		config,
		cameraRayDirection,
	});
}

function sumSpectralOrders(orderSpectra, wavelengthsNm) {
	const total = wavelengthsNm.map(() => 0);

	for (const spectrum of orderSpectra) {
		addArrayInto(total, validateSpectralArray(
			spectrum,
			wavelengthsNm,
			'multiple-scattering order spectrum',
		));
	}

	return total;
}

function createMultipleScatteringDisplayComparison({
	order1,
	order1PlusOrder2,
	accumulated,
	wavelengthsNm,
	displayOptions,
}) {
	const order1Display = createMultipleScatteringDisplaySwatch(order1, wavelengthsNm, displayOptions);
	const order1PlusOrder2Display = createMultipleScatteringDisplaySwatch(
		order1PlusOrder2,
		wavelengthsNm,
		displayOptions,
	);
	const accumulatedDisplay = createMultipleScatteringDisplaySwatch(
		accumulated,
		wavelengthsNm,
		displayOptions,
	);
	const linearLuminanceDelta = accumulatedDisplay.linearLuminance - order1Display.linearLuminance;
	const displayLuminanceDelta = accumulatedDisplay.displayLuminance - order1Display.displayLuminance;

	return {
		kind: 'flat-atmosphere-multiple-scattering-display-comparison',
		policy: {
			colorPolicy: displayOptions.colorPolicy,
			encoding: displayOptions.encoding,
			toneMap: displayOptions.toneMap,
			exposure: displayOptions.exposure,
		},
		order1: order1Display,
		order1PlusOrder2: order1PlusOrder2Display,
		accumulated: accumulatedDisplay,
		delta: {
			linearLuminanceDelta,
			linearLuminanceRatio: order1Display.linearLuminance > 0
				? accumulatedDisplay.linearLuminance / order1Display.linearLuminance
				: null,
			displayLuminanceDelta,
			displayLuminanceRatio: order1Display.displayLuminance > 0
				? accumulatedDisplay.displayLuminance / order1Display.displayLuminance
				: null,
		},
	};
}

function createMultipleScatteringDisplaySwatch(valuesByWavelength, wavelengthsNm, displayOptions) {
	const rgb = createPatchRgb(valuesByWavelength, wavelengthsNm, displayOptions);

	return {
		displayHex: rgb.hex,
		linearSrgb: rgb.linearRgb,
		displaySrgb: rgb.displayRgb,
		linearLuminance: relativeLuminance(rgb.linearRgb),
		displayLuminance: relativeLuminance(rgb.displayRgb),
	};
}

function scatteringPhaseWeightedBySpecies({
	mediumSample,
	wavelengthsNm,
	sourceDirectionFromSample,
	directionFromSampleToCamera,
}) {
	const cosTheta = clamp01Signed(dot3(sourceDirectionFromSample, directionFromSampleToCamera));
	const totals = wavelengthsNm.map(() => 0);

	for (const species of mediumSample.species ?? []) {
		if (!Array.isArray(species.scatteringByWavelength)) {
			continue;
		}

		const phase = species.phase ?? (
			typeof species.phaseKind === 'string'
				? { kind: species.phaseKind, parameters: species.parameters }
				: null
		);

		if (!phase) {
			continue;
		}

		const phaseByWavelength = evaluatePhaseByWavelength({
			phaseKind: phase.kind,
			parameters: phase.parameters ?? {},
			wavelengthsNm,
			cosTheta,
			errorPrefix: 'multiple-scattering',
		});

		for (const [wavelengthIndex, phaseValue] of phaseByWavelength.entries()) {
			totals[wavelengthIndex] += species.scatteringByWavelength[wavelengthIndex] * phaseValue;
		}
	}

	return totals;
}

function fibonacciSphereDirections(count) {
	const directions = [];
	const goldenAngle = Math.PI * (3 - Math.sqrt(5));

	for (let index = 0; index < count; index += 1) {
		const y = 1 - (2 * (index + 0.5)) / count;
		const radius = Math.sqrt(Math.max(0, 1 - y * y));
		const theta = goldenAngle * index;

		directions.push(normalize3([
			Math.cos(theta) * radius,
			y,
			Math.sin(theta) * radius,
		]));
	}

	return directions;
}

function resolveMultipleScatteringFieldAltitudeLayers(gridId) {
	const layers = MULTISCATTER_FIELD_ALTITUDE_GRIDS_KM[gridId];

	if (!layers) {
		throw new Error(`Unknown multiple-scattering field altitude grid: ${gridId}`);
	}

	return [...layers];
}

function createMultipleScatteringFieldDirectionSamples(config, scene) {
	if (config.fieldDirectionBasis === 'horizon-sun') {
		return createHorizonSunFieldDirectionSamples(config.angularSampleCount, scene);
	}

	const directions = fibonacciSphereDirections(config.angularSampleCount);
	const weightSr = 4 * Math.PI / directions.length;

	return directions.map((direction, index) => ({
		index,
		id: `fibonacci-${index}`,
		direction,
		weightSr,
		tags: ['fibonacci'],
	}));
}

function createHorizonSunFieldDirectionSamples(requestedCount, scene) {
	const profile = horizonSunDirectionProfile(requestedCount);
	const elevationBands = buildElevationBands(profile.elevationCentersDeg);
	const samples = [];

	for (const band of elevationBands) {
		const relativeAzimuthCentersDeg = band.centerDeg >= -8 && band.centerDeg <= 18
			? profile.horizonRelativeAzimuthCentersDeg
			: profile.coarseRelativeAzimuthCentersDeg;
		const azimuthCells = buildCyclicAngularCells(relativeAzimuthCentersDeg);
		const elevationWeight = Math.sin(degreesToRadians(band.upperDeg))
			- Math.sin(degreesToRadians(band.lowerDeg));

		for (const cell of azimuthCells) {
			const relativeAzimuthDeg = cell.centerDeg;
			const azimuthDeg = normalizeDegrees(scene.sunAzimuthDeg + relativeAzimuthDeg);
			const weightSr = degreesToRadians(cell.widthDeg) * elevationWeight;

			samples.push({
				index: samples.length,
				id: `horizon-sun-el-${formatDegreeId(band.centerDeg)}-raz-${formatDegreeId(relativeAzimuthDeg)}`,
				direction: directionFromElevationAzimuth(band.centerDeg, azimuthDeg),
				weightSr,
				tags: [
					'horizon-sun',
					band.centerDeg >= -8 && band.centerDeg <= 18 ? 'horizon-dense' : 'coarse',
					isNearCyclicDegree(relativeAzimuthDeg, 0, 25) ? 'solar-azimuth' : null,
					isNearCyclicDegree(relativeAzimuthDeg, 180, 25) ? 'anti-solar-azimuth' : null,
				].filter(Boolean),
				elevationDeg: band.centerDeg,
				relativeAzimuthDeg,
				azimuthDeg,
			});
		}
	}

	const weightSumSr = samples.reduce((total, sample) => total + sample.weightSr, 0);
	const scale = weightSumSr > 0 ? (4 * Math.PI) / weightSumSr : 1;

	return samples.map((sample) => ({
		...sample,
		weightSr: sample.weightSr * scale,
	}));
}

function horizonSunDirectionProfile(requestedCount) {
	if (requestedCount <= 16) {
		return {
			elevationCentersDeg: [-45, 3, 10, 45],
			coarseRelativeAzimuthCentersDeg: [0, 90, 180, 270],
			horizonRelativeAzimuthCentersDeg: [0, 45, 90, 135, 180, 225, 270, 315],
		};
	}

	if (requestedCount <= 64) {
		return {
			elevationCentersDeg: [-60, -20, 1.5, 4, 7, 12, 25, 50, 75],
			coarseRelativeAzimuthCentersDeg: [0, 45, 90, 135, 180, 225, 270, 315],
			horizonRelativeAzimuthCentersDeg: [
				0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5,
				180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5,
			],
		};
	}

	if (requestedCount <= 128) {
		return {
			elevationCentersDeg: [-70, -35, -10, 1.5, 4, 7, 12, 18, 30, 48, 68, 84],
			coarseRelativeAzimuthCentersDeg: [0, 45, 90, 135, 180, 225, 270, 315],
			horizonRelativeAzimuthCentersDeg: [
				0, 10, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 170,
				180, 190, 202.5, 225, 247.5, 270, 292.5, 315, 337.5, 350,
			],
		};
	}

	return {
		elevationCentersDeg: [-80, -55, -30, -12, -4, 1, 3, 5, 8, 12, 18, 28, 42, 58, 74, 87],
		coarseRelativeAzimuthCentersDeg: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330],
		horizonRelativeAzimuthCentersDeg: [
			0, 8, 16, 30, 45, 60, 75, 90, 105, 120, 135, 150, 164, 172,
			180, 188, 196, 210, 225, 240, 255, 270, 285, 300, 315, 330, 344, 352,
		],
	};
}

function buildElevationBands(centersDeg) {
	const centers = [...centersDeg].sort((a, b) => a - b);

	return centers.map((centerDeg, index) => {
		const lowerDeg = index === 0
			? -90
			: (centers[index - 1] + centerDeg) / 2;
		const upperDeg = index === centers.length - 1
			? 90
			: (centerDeg + centers[index + 1]) / 2;

		return { centerDeg, lowerDeg, upperDeg };
	});
}

function buildCyclicAngularCells(centersDeg) {
	const centers = uniqueSortedCyclicDegrees(centersDeg);

	return centers.map((centerDeg, index) => {
		const previous = centers[(index - 1 + centers.length) % centers.length];
		const next = centers[(index + 1) % centers.length];
		const previousGap = positiveDegreesDelta(previous, centerDeg);
		const nextGap = positiveDegreesDelta(centerDeg, next);

		return {
			centerDeg,
			widthDeg: (previousGap + nextGap) / 2,
		};
	});
}

function uniqueSortedCyclicDegrees(degrees) {
	return [...new Set(degrees.map((value) => normalizeDegrees(value).toFixed(6)))]
		.map(Number)
		.sort((a, b) => a - b);
}

function positiveDegreesDelta(fromDeg, toDeg) {
	const delta = normalizeDegrees(toDeg - fromDeg);
	return delta === 0 ? 360 : delta;
}

function isNearCyclicDegree(valueDeg, targetDeg, thresholdDeg) {
	const delta = Math.min(
		positiveDegreesDelta(valueDeg, targetDeg),
		positiveDegreesDelta(targetDeg, valueDeg),
	);

	return delta <= thresholdDeg;
}

function describeFieldDirectionPolicy(config) {
	const lookup = config.fieldInterpolation === 'weighted'
		? `inverse-angular weighted lookup over ${MULTISCATTER_FIELD_DIRECTION_NEIGHBORS} neighbors`
		: 'nearest-neighbor lookup';

	if (config.fieldDirectionBasis === 'horizon-sun') {
		return `sun-relative horizon-dense weighted solid-angle grid with ${lookup}`;
	}

	return `fibonacci-sphere equal-weight grid with ${lookup}`;
}

function validateSpectralArray(values, wavelengthsNm, label) {
	if (!Array.isArray(values) || values.length !== wavelengthsNm.length) {
		throw new Error(`${label} must align to wavelengthsNm`);
	}

	return values.map((value) => {
		if (!Number.isFinite(value) || value < 0) {
			throw new RangeError(`${label} must be nonnegative finite`);
		}

		return value;
	});
}

function spectralEnergy(values) {
	return values.reduce((sum, value) => sum + Math.abs(value), 0);
}

function summarizeSidecarTauRegime(samples) {
	const ids = samples
		.map((sample) => sample.diagnostics?.tauRegime?.classification?.id)
		.filter(Boolean);

	if (ids.includes('extreme-horizon-path')) {
		return 'extreme-horizon-path';
	}

	if (ids.includes('single-scattering-warning')) {
		return 'single-scattering-warning';
	}

	if (ids.includes('thick')) {
		return 'thick';
	}

	if (ids.includes('moderate')) {
		return 'moderate';
	}

	return ids[0] ?? 'not-evaluated';
}

function runSkyDomeGrid(options = {}) {
	const domeSize = options.domeSize ?? DEFAULT_SKY_DOME_SIZE;
	const domeSampleMask = resolveDomeSampleMask(options.domeSampleMask);
	const skyDomeVisualFit = options.skyDomeVisualFit ?? DEFAULT_SKY_DOME_VISUAL_FIT;
	const colorPolicy = options.color ?? DEFAULT_COLOR_POLICY;
	const encoding = options.encoding ?? defaultSkyDomeEncoding(skyDomeVisualFit);
	const toneMap = options.toneMap ?? defaultSkyDomeToneMap(skyDomeVisualFit);
	const solarSpectrumPolicy = options.solarSpectrum ?? defaultSkyDomeSolarSpectrumPolicy(skyDomeVisualFit);
	const rayleighPolicy = resolveRayleighPolicy(options.rayleighPolicy ?? defaultSkyDomeRayleighPolicyId(skyDomeVisualFit));
	const aerosolPolicy = resolveAerosolPolicy(options.aerosolPolicy ?? defaultSkyDomeAerosolPolicyId(skyDomeVisualFit));
	const aerosolPhasePolicy = resolveAerosolPhasePolicy(
		options.aerosolPhasePolicy ?? defaultSkyDomeAerosolPhasePolicyId(skyDomeVisualFit, aerosolPolicy),
	);
	const ozonePolicy = resolveOzonePolicy(options.ozonePolicy ?? defaultSkyDomeOzonePolicyId(skyDomeVisualFit));
	const molecularProfilePolicy = resolveMolecularProfilePolicy(
		options.molecularProfile ?? DEFAULT_MOLECULAR_PROFILE_POLICY_ID,
	);
	const wavelengthGrid = resolveSkyPatchWavelengthGrid(
		options.wavelengthGrid ?? defaultSkyDomeWavelengthGridId(skyDomeVisualFit),
	);
	const samplingControl = resolveSkyDomeSamplingControl(options);
	const solarSourceSampling = resolveSolarSourceSampling(options);

	options.progressReporter?.({
		phase: 'sky-dome-grid-start',
		panelCount: SKY_DOME_GRID_SCENES.length,
		domeSize,
		domeSampleMask: domeSampleMask.id,
		wavelengthCount: wavelengthGrid.wavelengthsNm.length,
		samplingProfile: samplingControl.samplingProfile.id,
		solarSource: solarSourceSampling.mode,
		solarSourceSampleCount: solarSourceSampling.sampleCount,
		viewSteps: samplingControl.viewStepsOverride,
		sunTransmittanceSteps: samplingControl.sunTransmittanceStepsOverride,
	});

	const skyDomePanels = SKY_DOME_GRID_SCENES.map((scene, panelIndex) => {
		return renderSkyDomePanel(scene, {
			stage: options.stage ?? DEFAULT_STAGE,
			colorPolicy,
			encoding,
			toneMap,
			exposureOverride: options.exposure,
			wavelengthGrid,
			solarSpectrumPolicy,
			rayleighPolicy,
			aerosolPolicy,
			aerosolPhasePolicy,
			ozonePolicy,
			molecularProfilePolicy,
			domeSize,
			domeSampleMask,
			skyDomeVisualFit,
			samplingProfile: samplingControl.samplingProfile,
			viewStepsOverride: samplingControl.viewStepsOverride,
			sunTransmittanceStepsOverride: samplingControl.sunTransmittanceStepsOverride,
			solarSourceSampling,
			retainSpectralPixels: options.multipleScatteringReference === 'iterative-field-grid',
			progressReporter: options.progressReporter,
			panelIndex,
			panelCount: SKY_DOME_GRID_SCENES.length,
		});
	});

	options.progressReporter?.({
		phase: 'sky-dome-grid-complete',
		panelCount: SKY_DOME_GRID_SCENES.length,
	});

	return {
		kind: 'flat-atmosphere-reference-sky-dome-grid',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		stage: options.stage ?? DEFAULT_STAGE,
		visual: {
			colorPolicy,
			colorSpace: colorPolicy === 'official-cie'
				? 'cie-1931-2deg-xyz-to-linear-srgb'
				: 'preview-cie-1931-xyz-to-linear-srgb',
			encoding,
			toneMap,
			exposure: options.exposure ?? 'per-panel',
			solarSpectrum: {
				policy: solarSpectrumPolicy,
			},
			rayleighPolicy: {
				id: rayleighPolicy.id,
				label: rayleighPolicy.label,
				source: rayleighPolicy.source,
			},
			aerosolPolicy: {
				id: aerosolPolicy.id,
				label: aerosolPolicy.label,
				source: aerosolPolicy.source,
			},
			aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
			ozonePolicy: {
				id: ozonePolicy.id,
				label: ozonePolicy.label,
				source: ozonePolicy.source,
			},
			molecularProfile: {
				id: molecularProfilePolicy.id,
				label: molecularProfilePolicy.label,
				source: molecularProfilePolicy.source,
			},
			numerical: {
				...createSamplingNumericalMetadata(samplingControl.samplingProfile),
			},
			solarSource: solarSourceSampling,
			wavelengthGrid: wavelengthGrid.metadata,
			domeSize,
			domeSampleMask,
			skyDomeVisualFit: {
				mode: skyDomeVisualFit,
				policy: describeSkyDomeVisualFit(skyDomeVisualFit),
			},
			projection: {
				id: 'azimuthal-equidistant-upper-hemisphere',
				policy: 'zenith at disk center, horizon at disk edge, outside disk masked black, azimuth rotated to match the Bruneton Figure 1 extracted panels',
				orientation: 'paper-clockwise: azimuth 0 at image right, positive azimuth clockwise',
			},
			sunMarker: {
				policy: 'display-only red cross marks the directional sun center, matching the comparison-paper convention',
			},
			note: 'Skydome panels are model-output comparison artifacts. They are intended to classify our output against named sky model families before comparing with photographs.',
		},
		model: createSkyPatchModelMetadata(
			rayleighPolicy,
			aerosolPolicy,
			aerosolPhasePolicy,
			ozonePolicy,
			molecularProfilePolicy,
		),
		baselineFreeze: createBaselineFreezeMetadata({
			phase: 'multiple-scattering-plan.phase-1',
			mode: 'sky-dome-grid',
			scenarios: SKY_DOME_GRID_SCENES.map((scene) => scene.id),
			wavelengthGrid: wavelengthGrid.metadata,
			numerical: createSamplingNumericalMetadata(samplingControl.samplingProfile),
			solarSource: solarSourceSampling,
			domeSampleMask,
		}),
		sourceComparison: {
			id: 'bruneton-2016-clear-sky-models-figure-1',
			source: 'Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models, Figure 1',
			url: 'https://arxiv.org/abs/1612.04336',
			timeRows: SKY_DOME_GRID_SCENES.map((scene) => ({
				id: scene.id,
				label: scene.label,
				sunZenithDeg: scene.sunZenithDeg,
				sunElevationDeg: scene.sunElevationDeg,
			})),
		},
		skyDomePanelCount: skyDomePanels.length,
		skyDomePanels,
	};
}

function renderSkyDomePanel(scene, {
	stage,
	colorPolicy,
	encoding,
	toneMap,
	exposureOverride,
	wavelengthGrid,
	solarSpectrumPolicy,
	rayleighPolicy,
	aerosolPolicy,
	aerosolPhasePolicy,
	ozonePolicy,
	molecularProfilePolicy,
	domeSize,
	domeSampleMask,
	skyDomeVisualFit,
	samplingProfile,
	viewStepsOverride,
	sunTransmittanceStepsOverride,
	solarSourceSampling,
	retainSpectralPixels = false,
	progressReporter,
	panelIndex,
	panelCount,
}) {
	const wavelengthsNm = [...wavelengthGrid.wavelengthsNm];
	const resolvedViewSteps = viewStepsOverride ?? DEFAULT_SKY_PATCH_VIEW_STEPS;
	const resolvedSunTransmittanceSteps = sunTransmittanceStepsOverride ?? DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS;
	const numerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
	};
	const actualSamplingProfile = createActualSamplingProfileMetadata(samplingProfile, {
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
	});
	const solarSpectrum = sampleSolarSpectrum(wavelengthsNm, {
		policy: solarSpectrumPolicy,
		solarTemperatureK: EARTH_LIKE_SKY.solarTemperatureK,
		solarIrradiance550Wm2Nm: EARTH_LIKE_SKY.solarIrradiance550Wm2Nm,
	});
	const model = createSkyPatchModel(
		scene,
		wavelengthsNm,
		solarSpectrum,
		rayleighPolicy,
		aerosolPolicy,
		aerosolPhasePolicy,
		ozonePolicy,
		molecularProfilePolicy,
		solarSourceSampling,
	);
	const integrator = new CpuSpectralReferenceIntegrator();
	const rows = [];
	const pixelSources = [];
	const directRadiancePixels = retainSpectralPixels ? [] : null;
	const diagnosticSamples = {};
	const displayExposure = resolveSkyDomeDisplayExposure({
		exposureOverride,
		scene,
		wavelengthsNm,
		colorPolicy,
		toneMap,
		skyDomeVisualFit,
	});
	const sunDirection = directionFromElevationAzimuth(scene.sunElevationDeg, scene.sunAzimuthDeg);
	const skyDomeSpectralFit = createSkyDomeSpectralFitContext({
		mode: skyDomeVisualFit,
		integrator,
		model,
		stage,
		scene,
		wavelengthsNm,
		numerical,
		aerosolPhasePolicy,
	});
	let sampledInsideDomePixelCount = 0;
	let skippedInsideDomePixelCount = 0;

	progressReporter?.({
		phase: 'sky-dome-panel-start',
		panelId: scene.id,
		panelIndex,
		panelCount,
		domeSize,
		domeSampleMask: domeSampleMask.id,
		samplingProfile: actualSamplingProfile.id,
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
		wavelengthCount: wavelengthsNm.length,
	});

	for (let y = 0; y < domeSize; y += 1) {
		const row = [];

		for (let x = 0; x < domeSize; x += 1) {
			const projection = skyDomeDirectionForPixel(x, y, domeSize);

			if (!projection.insideDome) {
				row.push('#000000');
				pixelSources.push(createBlackPixelSource(wavelengthsNm, colorPolicy));
				directRadiancePixels?.push(wavelengthsNm.map(() => 0));
				continue;
			}

			if (!shouldTraceSkyDomeProjection(projection, domeSampleMask)) {
				row.push('#000000');
				pixelSources.push(createSkippedSkyDomePixelSource(wavelengthsNm, colorPolicy, domeSampleMask));
				directRadiancePixels?.push(wavelengthsNm.map(() => 0));
				skippedInsideDomePixelCount += 1;
				continue;
			}

			sampledInsideDomePixelCount += 1;
			const sample = traceSkyDomeSample({
				integrator,
				model,
				stage,
				direction: projection.direction,
				sunDirection,
				wavelengthsNm,
				numerical,
				displayExposure,
				encoding,
				toneMap,
				colorPolicy,
				skyDomeSpectralFit,
			});

			row.push(sample.displayHex);
			pixelSources.push(sample.pixelSource);
			directRadiancePixels?.push(sample.diagnostics.finalByWavelength);

			if (
				(x === Math.floor(domeSize / 2) && y === Math.floor(domeSize / 2))
				|| (x === Math.floor(domeSize / 2) && y === 0)
			) {
				diagnosticSamples[`${x},${y}`] = {
					x,
					y,
					elevationDeg: projection.elevationDeg,
					azimuthDeg: projection.azimuthDeg,
					...sample.diagnostics,
				};
			}
		}

		rows.push(row);
		progressReporter?.({
			phase: 'sky-dome-panel-row',
			panelId: scene.id,
			panelIndex,
			panelCount,
			rowIndex: y,
			rowCount: domeSize,
			sampledInsideDomePixelCount,
			skippedInsideDomePixelCount,
		});
	}

	let analysisPixelImage = referenceOutputsToPixelImage({
		width: domeSize,
		height: domeSize,
		pixels: pixelSources,
	}, {
		encoding,
		toneMap,
		exposure: displayExposure,
	});
	analysisPixelImage = applySkyDomeVisualFit(
		analysisPixelImage,
		scene,
		skyDomeVisualFit,
	);
	const modelComparisonMetrics = summarizeSkyDomeModelComparisonMetrics(
		analysisPixelImage,
		scene,
	);
	const displayRows = pixelImageToHexRows(analysisPixelImage);
	let pixelImage = analysisPixelImage;
	const sunMarker = skyDomePixelForDirection(sunDirection, domeSize);
	pixelImage = overlaySunCross(pixelImage, sunMarker, encoding);

	progressReporter?.({
		phase: 'sky-dome-panel-complete',
		panelId: scene.id,
		panelIndex,
		panelCount,
		sampledInsideDomePixelCount,
		skippedInsideDomePixelCount,
	});

	return {
		id: scene.id,
		label: scene.label,
		timeLabel: scene.timeLabel,
		sunZenithDeg: scene.sunZenithDeg,
		sunElevationDeg: scene.sunElevationDeg,
		sunAzimuthDeg: scene.sunAzimuthDeg,
		stage,
		size: { width: domeSize, height: domeSize },
		domeSampleMask,
		sampledInsideDomePixelCount,
		skippedInsideDomePixelCount,
		solarSource: solarSourceSampling,
		numerical: {
			viewSteps: resolvedViewSteps,
			sunTransmittanceSteps: resolvedSunTransmittanceSteps,
			integrationMethod: numerical.integrationMethod,
			samplingProfile: actualSamplingProfile,
		},
		wavelengthsNm,
		wavelengthGrid: wavelengthGrid.metadata,
		colorPolicy,
		solarSpectrum: {
			policy: solarSpectrumPolicy,
			provenance: solarSpectrum.provenance,
		},
		rayleighPolicy: {
			id: rayleighPolicy.id,
			label: rayleighPolicy.label,
			source: rayleighPolicy.source,
			doi: rayleighPolicy.doi ?? null,
			coefficientModel: rayleighPolicy.coefficientModel,
		},
		aerosolPolicy: {
			id: aerosolPolicy.id,
			label: aerosolPolicy.label,
			source: aerosolPolicy.source,
			aod550: aerosolPolicy.aod550,
			angstromExponent: aerosolPolicy.angstromExponent,
			singleScatteringAlbedo: aerosolPolicy.singleScatteringAlbedo,
			defaultPhasePolicyId: aerosolPolicy.defaultPhasePolicyId,
			scaleHeightKm: aerosolPolicy.scaleHeightKm,
		},
		aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
		ozonePolicy: {
			id: ozonePolicy.id,
			label: ozonePolicy.label,
			source: ozonePolicy.source,
			atlasDoi: ozonePolicy.atlasDoi ?? null,
			crossSectionModel: ozonePolicy.crossSectionModel,
		},
		molecularProfile: {
			id: molecularProfilePolicy.id,
			label: molecularProfilePolicy.label,
			source: molecularProfilePolicy.source,
			nasaNtrsRecord: molecularProfilePolicy.nasaNtrsRecord ?? null,
		},
		displayEncoding: encoding,
		toneMap,
		displayExposure,
		projection: {
			id: 'azimuthal-equidistant-upper-hemisphere',
			orientation: 'paper-clockwise: azimuth 0 at image right, positive azimuth clockwise',
			sunMarker,
		},
		modelComparisonMetrics,
		diagnosticSamples: Object.values(diagnosticSamples),
		directRadianceImage: directRadiancePixels
			? {
				kind: 'flat-atmosphere-direct-l1-spectral-image',
				width: domeSize,
				height: domeSize,
				wavelengthsNm,
				radianceByPixel: directRadiancePixels,
			}
			: null,
		pixelImage,
		rows: displayRows,
	};
}

function traceSkyDomeSample({
	integrator,
	model,
	stage,
	direction,
	sunDirection,
	wavelengthsNm,
	numerical,
	displayExposure,
	encoding,
	toneMap,
	colorPolicy,
	skyDomeSpectralFit,
}) {
	const request = {
		model,
		observer: { positionKm: [0, 0, 0] },
		ray: { direction },
		wavelengthsNm,
		numerical,
	};
	const packet = stage === DEFAULT_STAGE
		? integrator.traceRay(request)
		: integrator.runUntil(stage, request);
	const rawFinalByWavelength = requireFinalRadianceByWavelength(
		packet,
		wavelengthsNm,
		'sky-dome sample',
	);
	const spectralFitResult = applySkyDomeSpectralFit(rawFinalByWavelength, {
		packet,
		direction,
		wavelengthsNm,
		skyDomeSpectralFit,
	});
	const finalByWavelength = spectralFitResult.finalByWavelength;
	const pathEnd = packet.viewOpticalDepth?.pathEnd;
	const speciesOpticalDepth = summarizeSpeciesOpticalDepth(pathEnd);
	const totalOpticalDepthByWavelength = summarizeTotalOpticalDepthByWavelength(
		speciesOpticalDepth,
		wavelengthsNm,
	);
	const opticalDepthValidity = summarizeOpticalDepthValidity(
		totalOpticalDepthByWavelength,
		wavelengthsNm,
	);
	const rgb = createPatchRgb(finalByWavelength, wavelengthsNm, {
		exposure: displayExposure,
		encoding,
		toneMap,
		colorPolicy,
	});

	return {
		displayHex: rgb.hex,
		pixelSource: {
			stageHistory: packet.stageHistory ?? [],
			wavelengthsNm,
			spectralRadiance: {
				...(packet.spectralRadiance ?? {}),
				wavelengthsNm,
				finalByWavelength,
				...(spectralFitResult.applied
					? { rawFinalByWavelength }
					: {}),
			},
			xyz: rgb.xyz,
			linearRgb: rgb.linearRgb,
			colorProvenance: {
				...rgb.colorProvenance,
				...(spectralFitResult.applied
					? { skyDomeSpectralFit: spectralFitResult.metadata }
					: {}),
			},
		},
		diagnostics: {
			direction,
			finalByWavelength,
			renderedByWavelength: finalByWavelength,
				...(spectralFitResult.applied
					? {
						rawFinalByWavelength,
						groundSecondaryByWavelength: spectralFitResult.contributionByWavelength,
						groundSourceSecondaryByWavelength: spectralFitResult.groundContributionByWavelength,
						upperSkySecondaryByWavelength: spectralFitResult.upperSkyContributionByWavelength,
						skyDomeSpectralFit: spectralFitResult.metadata,
					}
					: {}),
			viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
			totalOpticalDepthByWavelength,
			opticalDepthValidity,
			sourceQuadrature: summarizeSourceQuadrature(packet.solarTransmittance, sunDirection),
			linearSrgb: rgb.linearRgb,
			displaySrgb: rgb.displayRgb,
			displayHex: rgb.hex,
		},
	};
}

function describeSkyDomeVisualFit(mode) {
	if (mode === 'none') {
		return 'raw display pixels from the reference transport/color pipeline';
	}

	if (mode === LEGACY_BRUNETON_EDGE_AUREOLE_FIT) {
		return 'legacy ad hoc display-side edge whitening and Sun aureole grade retained only for comparison';
	}

	if (mode === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return 'spectral secondary-scattering approximation using cached sky radiance through four total orders, Bruneton grass albedo, Lambertian ground radiance, Beer-Lambert transmittance, and Rayleigh/Cornette-Shanks phase integration before CIE/tone mapping';
	}

	throw new Error(`Unknown sky-dome visual fit: ${mode}`);
}

function resolveSkyDomeDisplayExposure({
	exposureOverride,
	scene,
	wavelengthsNm,
	colorPolicy,
	toneMap,
	skyDomeVisualFit,
}) {
	if (exposureOverride !== undefined) {
		return exposureOverride;
	}

	if (
		skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT
		&& colorPolicy === 'official-cie'
		&& toneMap === 'exponential'
	) {
		return brunetonNormalizedCieExposure(wavelengthsNm);
	}

	return scene.displayExposure ?? 1;
}

function brunetonNormalizedCieExposure(wavelengthsNm) {
	const equalEnergy = spectralRadianceToLinearSrgb(
		wavelengthsNm.map(() => 1),
		wavelengthsNm,
	).provenance.yEqualEnergyResponse;

	return equalEnergy / BRUNETON_EXPONENTIAL_TONE_MAP_DENOMINATOR;
}

function createSkyDomeSpectralFitContext({
	mode,
	integrator,
	model,
	stage,
	scene,
	wavelengthsNm,
	numerical,
	aerosolPhasePolicy,
}) {
	if (mode !== BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return null;
	}

	const lowerHemisphereSamples = createLowerHemispherePhaseSamples();
	const upperSkySamples = estimateUpperHemisphereSkySourceSamples({
		integrator,
		model,
		stage,
		wavelengthsNm,
		numerical,
	});
	const diffuseSkyIrradianceByWavelength = estimateDiffuseSkyIrradianceFromSamples(
		upperSkySamples,
		wavelengthsNm,
	);
	const ground = estimateBrunetonGrassGroundRadiance({
		model,
		wavelengthsNm,
		numerical,
		diffuseSkyIrradianceByWavelength,
	});
	const accumulatedUpperSkySamples = createAccumulatedUpperSkySourceSamples({
		baseUpperSkySamples: upperSkySamples,
		wavelengthsNm,
		aerosolPhasePolicy,
		lowerHemisphereSamples,
		groundRadianceByWavelength: ground.radianceByWavelength,
	});

	return {
		mode,
		kind: 'spectral-lower-boundary-single-bounce',
		sceneId: scene.id,
		wavelengthsNm,
		aerosolPhasePolicy,
		lowerHemisphereSamples,
		lowerHemisphereSampleCount: lowerHemisphereSamples.length,
		upperSkySamples: accumulatedUpperSkySamples,
		upperSkySampleCount: accumulatedUpperSkySamples.length,
		secondaryScatteringOrderCount: SKY_DOME_SECONDARY_SCATTERING_ORDER_COUNT,
		diffuseSkyIrradianceByWavelength,
		groundDirectCosTheta: ground.directCosTheta,
		groundDirectHorizontalIrradianceByWavelength: ground.directHorizontalIrradianceByWavelength,
		groundRadianceByWavelength: ground.radianceByWavelength,
		groundAlbedoByWavelength: ground.albedoByWavelength,
		provenance: {
			groundAlbedo: 'Bruneton clear-sky-models NewGroundAlbedo grass spectral albedo, 360-800 nm at 10 nm spacing, from Feister and Grewe 1995',
			surfaceModel: 'Lambertian lower boundary: L = rho * E_horizontal / pi',
			transmittance: 'Beer-Lambert source-path transmittance from the existing atmosphere model; optically thick secondary in-scattering blends toward the midpoint camera transmittance implied by sampleViewPath intervals',
			scattering: 'Neumann-series secondary in-scattering approximation over cached upper-hemisphere sky radiance plus lower-hemisphere ground radiance, using the existing Rayleigh and aerosol phase functions',
			references: [
				'https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/atmosphere.cc',
				'https://arxiv.org/abs/1612.04336',
				'https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance',
				'https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes',
				'https://www.pbr-book.org/4ed/Volume_Scattering/Phase_Functions',
			],
		},
	};
}

function applySkyDomeSpectralFit(rawFinalByWavelength, {
	packet,
	direction,
	wavelengthsNm,
	skyDomeSpectralFit,
}) {
	if (!skyDomeSpectralFit) {
		return {
			applied: false,
			finalByWavelength: rawFinalByWavelength,
		};
	}

	const secondary = estimateGroundSingleBounceRadiance({
		packet,
		direction,
		wavelengthsNm,
		context: skyDomeSpectralFit,
	});
	const finalByWavelength = rawFinalByWavelength.map((value, wavelengthIndex) => {
		return value + secondary.radianceByWavelength[wavelengthIndex];
	});

	return {
		applied: true,
		finalByWavelength,
		contributionByWavelength: secondary.radianceByWavelength,
		groundContributionByWavelength: secondary.groundContributionByWavelength,
		upperSkyContributionByWavelength: secondary.upperSkyContributionByWavelength,
		metadata: {
			mode: skyDomeSpectralFit.mode,
			kind: skyDomeSpectralFit.kind,
			groundDirectCosTheta: skyDomeSpectralFit.groundDirectCosTheta,
			lowerHemisphereSampleCount: skyDomeSpectralFit.lowerHemisphereSampleCount,
			upperSkySampleCount: skyDomeSpectralFit.upperSkySampleCount,
			secondaryScatteringOrderCount: skyDomeSpectralFit.secondaryScatteringOrderCount,
			phaseIntegralSrInverseSolidAngle: secondary.phaseIntegralSrInverseSolidAngle,
			provenance: skyDomeSpectralFit.provenance,
		},
	};
}

function estimateBrunetonGrassGroundRadiance({
	model,
	wavelengthsNm,
	numerical,
	diffuseSkyIrradianceByWavelength = wavelengthsNm.map(() => 0),
}) {
	const sourceSamples = model.solarSource.samplesAt([0, 0, 0], null, numerical);
	const directHorizontalIrradianceByWavelength = wavelengthsNm.map(() => 0);
	let directCosTheta = 0;

	for (const sourceSample of sourceSamples) {
		const sourceDirection = normalize3(sourceSample.direction);
		const sampleCosTheta = Math.max(0, dot3([0, 1, 0], sourceDirection));

		if (sampleCosTheta <= 0) {
			continue;
		}

		directCosTheta += (sourceSample.weight ?? 1) * sampleCosTheta;
		const transmittance = sourceSegmentTransmittanceByWavelength(
			model.solarSource.transmittanceSegment([0, 0, 0], sourceSample, {
				wavelengthsNm,
				numerical,
			}),
			wavelengthsNm,
		);
		const sourceValues = sourceSample.sourceSpectrum?.valuesByWavelength ?? wavelengthsNm.map(() => 0);
		for (const [wavelengthIndex, sourceValue] of sourceValues.entries()) {
			directHorizontalIrradianceByWavelength[wavelengthIndex] += (
				sourceValue
				* transmittance[wavelengthIndex]
				* (sourceSample.weight ?? 1)
				* sampleCosTheta
			);
		}
	}

	const albedoByWavelength = wavelengthsNm.map(interpolateBrunetonGrassAlbedo);
	const radianceByWavelength = directHorizontalIrradianceByWavelength.map((irradiance, wavelengthIndex) => {
		return (irradiance + (diffuseSkyIrradianceByWavelength[wavelengthIndex] ?? 0))
			* albedoByWavelength[wavelengthIndex] / Math.PI;
	});

	return {
		directCosTheta,
		directHorizontalIrradianceByWavelength,
		albedoByWavelength,
		radianceByWavelength,
	};
}

function sourceSegmentTransmittanceByWavelength(segment, wavelengthsNm) {
	if (!segment?.visible) {
		return wavelengthsNm.map(() => 0);
	}

	const opticalDepthByWavelength = wavelengthsNm.map(() => 0);
	for (const sample of segment.samples ?? []) {
		for (const [wavelengthIndex, extinction] of (sample.extinctionByWavelength ?? []).entries()) {
			opticalDepthByWavelength[wavelengthIndex] += extinction * (sample.weightKm ?? 0);
		}
	}

	return opticalDepthByWavelength.map((tau) => Math.exp(-Math.max(0, tau)));
}

function estimateUpperHemisphereSkySourceSamples({
	integrator,
	model,
	stage,
	wavelengthsNm,
	numerical,
}) {
	return createUpperHemisphereSkySamples().map((sample) => {
		const request = {
			model,
			observer: { positionKm: [0, 0, 0] },
			ray: { direction: sample.direction },
			wavelengthsNm,
			numerical,
		};
		const packet = stage === DEFAULT_STAGE
			? integrator.traceRay(request)
			: integrator.runUntil(stage, request);
		const radianceByWavelength = requireFinalRadianceByWavelength(
			packet,
			wavelengthsNm,
			'sky-dome upper-hemisphere secondary source',
		);

		return {
			...sample,
			packet,
			radianceByWavelength,
		};
	});
}

function estimateDiffuseSkyIrradianceFromSamples(samples, wavelengthsNm) {
	const irradianceByWavelength = wavelengthsNm.map(() => 0);

	for (const sample of samples) {
		const cosTheta = Math.max(0, sample.direction[1]);
		for (const [wavelengthIndex, radiance] of sample.radianceByWavelength.entries()) {
			irradianceByWavelength[wavelengthIndex] += radiance * cosTheta * sample.weightSr;
		}
	}

	return irradianceByWavelength;
}

function createAccumulatedUpperSkySourceSamples({
	baseUpperSkySamples,
	wavelengthsNm,
	aerosolPhasePolicy,
	lowerHemisphereSamples,
	groundRadianceByWavelength,
}) {
	let previousOrderSamples = baseUpperSkySamples;
	let accumulatedSamples = baseUpperSkySamples.map((sample) => ({
		...sample,
		radianceByWavelength: [...sample.radianceByWavelength],
	}));

	for (let order = 2; order < SKY_DOME_SECONDARY_SCATTERING_ORDER_COUNT; order += 1) {
		const orderContext = {
			aerosolPhasePolicy,
			lowerHemisphereSamples,
			upperSkySamples: previousOrderSamples,
			groundRadianceByWavelength,
		};
		const nextOrderSamples = baseUpperSkySamples.map((sample) => {
			const secondary = estimateGroundSingleBounceRadiance({
				packet: sample.packet,
				direction: sample.direction,
				wavelengthsNm,
				context: orderContext,
				includeGroundSource: order === 2,
			});

			return {
				...sample,
				radianceByWavelength: secondary.radianceByWavelength,
			};
		});

		accumulatedSamples = accumulatedSamples.map((sample, sampleIndex) => ({
			...sample,
			radianceByWavelength: sample.radianceByWavelength.map((value, wavelengthIndex) => {
				return value + nextOrderSamples[sampleIndex].radianceByWavelength[wavelengthIndex];
			}),
		}));
		previousOrderSamples = nextOrderSamples;
	}

	return accumulatedSamples;
}

function interpolateBrunetonGrassAlbedo(wavelengthNm) {
	const maxIndex = BRUNETON_GRASS_ALBEDO_SAMPLES.length - 1;
	const position = (wavelengthNm - BRUNETON_GRASS_ALBEDO_MIN_NM)
		/ BRUNETON_GRASS_ALBEDO_STEP_NM;

	if (position <= 0) {
		return BRUNETON_GRASS_ALBEDO_SAMPLES[0];
	}

	if (position >= maxIndex) {
		return BRUNETON_GRASS_ALBEDO_SAMPLES[maxIndex];
	}

	const lowerIndex = Math.floor(position);
	const upperWeight = position - lowerIndex;
	return mixNumber(
		BRUNETON_GRASS_ALBEDO_SAMPLES[lowerIndex],
		BRUNETON_GRASS_ALBEDO_SAMPLES[lowerIndex + 1],
		upperWeight,
	);
}

function estimateGroundSingleBounceRadiance({
	packet,
	direction,
	wavelengthsNm,
	context,
	includeGroundSource = true,
}) {
	const mediumSamples = packet.mediumSamples ?? [];
	const viewSamples = packet.viewOpticalDepth?.samples ?? [];
	const radianceByWavelength = wavelengthsNm.map(() => 0);
	const groundContributionByWavelength = wavelengthsNm.map(() => 0);
	const upperSkyContributionByWavelength = wavelengthsNm.map(() => 0);
	const midpointTransmittanceWeight = skyDomeSecondaryMidpointTransmittanceWeight(
		packet,
		wavelengthsNm,
	);
	const phaseIntegralSrInverseSolidAngle = integrateLowerHemispherePhase({
		viewDirection: direction,
		aerosolPhasePolicy: context.aerosolPhasePolicy,
		lowerHemisphereSamples: context.lowerHemisphereSamples,
	});
	const upperSkySourceBySpecies = integrateUpperHemisphereSkyRadianceSource({
		viewDirection: direction,
		aerosolPhasePolicy: context.aerosolPhasePolicy,
		upperSkySamples: context.upperSkySamples,
		wavelengthsNm,
	});

	for (const [sampleIndex, mediumSample] of mediumSamples.entries()) {
		const viewSample = viewSamples[sampleIndex];
		if (!viewSample) {
			continue;
		}
		const secondaryViewTransmittance = skyDomeSecondaryViewTransmittanceByWavelength({
			mediumSample,
			viewSample,
			wavelengthsNm,
			midpointTransmittanceWeight,
		});

		for (const species of mediumSample.species ?? []) {
			const phaseIntegral = phaseIntegralForGroundSpecies(
				species.name,
				phaseIntegralSrInverseSolidAngle,
			);
			if (phaseIntegral <= 0) {
				continue;
			}
			const upperSkySourceByWavelength = sourceByWavelengthForGroundSpecies(
				species.name,
				upperSkySourceBySpecies,
				wavelengthsNm,
			);

			for (const wavelengthIndex of context.groundRadianceByWavelength.keys()) {
				const groundRadiance = context.groundRadianceByWavelength[wavelengthIndex];
				const groundSourceRadiance = includeGroundSource ? groundRadiance * phaseIntegral : 0;
				const upperSkySourceRadiance = upperSkySourceByWavelength[wavelengthIndex];
				const groundContribution = (
					secondaryViewTransmittance[wavelengthIndex]
					* (mediumSample.weightKm ?? 0)
					* (species.scatteringByWavelength?.[wavelengthIndex] ?? 0)
					* groundSourceRadiance
				);
				const upperSkyContribution = (
					secondaryViewTransmittance[wavelengthIndex]
					* (mediumSample.weightKm ?? 0)
					* (species.scatteringByWavelength?.[wavelengthIndex] ?? 0)
					* upperSkySourceRadiance
				);

				groundContributionByWavelength[wavelengthIndex] += groundContribution;
				upperSkyContributionByWavelength[wavelengthIndex] += upperSkyContribution;
				radianceByWavelength[wavelengthIndex] += (
					groundContribution
					+ upperSkyContribution
				);
			}
		}
	}

	return {
		radianceByWavelength,
		groundContributionByWavelength,
		upperSkyContributionByWavelength,
		phaseIntegralSrInverseSolidAngle,
	};
}

function skyDomeSecondaryViewTransmittanceByWavelength({
	mediumSample,
	viewSample,
	wavelengthsNm,
	midpointTransmittanceWeight = 1,
}) {
	const endpointTransmittance = viewSample.viewTransmittanceByWavelength ?? wavelengthsNm.map(() => 0);
	const endpointTau = viewSample.cumulativeOpticalDepthByWavelength;
	if (
		midpointTransmittanceWeight <= 0
		|| !Array.isArray(endpointTransmittance)
		|| !Array.isArray(endpointTau)
		|| !Number.isFinite(mediumSample.intervalEndKm)
		|| !Number.isFinite(mediumSample.distanceFromObserverKm)
	) {
		return endpointTransmittance;
	}

	const remainingDistanceKm = Math.max(
		0,
		Math.min(
			mediumSample.weightKm ?? 0,
			mediumSample.intervalEndKm - mediumSample.distanceFromObserverKm,
		),
	);
	const extinctionByWavelength = totalMediumExtinctionByWavelength(mediumSample, wavelengthsNm);

	return endpointTau.map((tauAtIntervalEnd, wavelengthIndex) => {
		const tauAtSample = Math.max(
			0,
			tauAtIntervalEnd - extinctionByWavelength[wavelengthIndex] * remainingDistanceKm,
		);
		const midpointTransmittance = Math.exp(-tauAtSample);
		return mixNumber(
			endpointTransmittance[wavelengthIndex] ?? 0,
			midpointTransmittance,
			midpointTransmittanceWeight,
		);
	});
}

function skyDomeSecondaryMidpointTransmittanceWeight(packet, wavelengthsNm) {
	const pathTau = packet.viewOpticalDepth?.pathEnd?.cumulativeOpticalDepthByWavelength;
	if (!Array.isArray(pathTau) || pathTau.length === 0) {
		return 0;
	}

	const maxTau = Math.max(
		0,
		...pathTau.filter((value) => Number.isFinite(value)),
	);

	return smoothstep(
		SKY_DOME_SECONDARY_MIDPOINT_TAU_START,
		SKY_DOME_SECONDARY_MIDPOINT_TAU_END,
		maxTau,
	);
}

function totalMediumExtinctionByWavelength(mediumSample, wavelengthsNm) {
	const total = wavelengthsNm.map(() => 0);

	for (const species of mediumSample.species ?? []) {
		for (const [wavelengthIndex, extinction] of (species.extinctionByWavelength ?? []).entries()) {
			total[wavelengthIndex] += extinction;
		}
	}

	return total;
}

function phaseIntegralForGroundSpecies(speciesName, phaseIntegralSrInverseSolidAngle) {
	if (speciesName === 'rayleigh') {
		return phaseIntegralSrInverseSolidAngle.rayleigh;
	}

	if (speciesName === 'mie') {
		return phaseIntegralSrInverseSolidAngle.mie;
	}

	return 0;
}

function sourceByWavelengthForGroundSpecies(speciesName, sourceBySpecies, wavelengthsNm) {
	if (speciesName === 'rayleigh') {
		return sourceBySpecies.rayleigh;
	}

	if (speciesName === 'mie') {
		return sourceBySpecies.mie;
	}

	return wavelengthsNm.map(() => 0);
}

function integrateUpperHemisphereSkyRadianceSource({
	viewDirection,
	aerosolPhasePolicy,
	upperSkySamples,
	wavelengthsNm,
}) {
	const directionFromSampleToCamera = scale3(normalize3(viewDirection), -1);
	const rayleigh = wavelengthsNm.map(() => 0);
	const mie = wavelengthsNm.map(() => 0);

	for (const sample of upperSkySamples) {
		const cosTheta = dot3(sample.direction, directionFromSampleToCamera);
		const rayleighPhase = evaluatePhaseValue({
			phaseKind: 'rayleigh',
			cosTheta,
			errorPrefix: 'sky dome upper-sky secondary Rayleigh phase',
		});
		const miePhase = evaluatePhaseValue({
			phaseKind: aerosolPhasePolicy.kind,
			parameters: aerosolPhasePolicy.parameters,
			cosTheta,
			errorPrefix: 'sky dome upper-sky secondary aerosol phase',
		});

		for (const [wavelengthIndex, sourceRadiance] of sample.radianceByWavelength.entries()) {
			rayleigh[wavelengthIndex] += sourceRadiance * rayleighPhase * sample.weightSr;
			mie[wavelengthIndex] += sourceRadiance * miePhase * sample.weightSr;
		}
	}

	return { rayleigh, mie };
}

function integrateLowerHemispherePhase({
	viewDirection,
	aerosolPhasePolicy,
	lowerHemisphereSamples,
}) {
	const directionFromSampleToCamera = scale3(normalize3(viewDirection), -1);
	let rayleigh = 0;
	let mie = 0;

	for (const sample of lowerHemisphereSamples) {
		const cosTheta = dot3(sample.direction, directionFromSampleToCamera);
		rayleigh += sample.weightSr * evaluatePhaseValue({
			phaseKind: 'rayleigh',
			cosTheta,
			errorPrefix: 'sky dome ground-bounce Rayleigh phase',
		});
		mie += sample.weightSr * evaluatePhaseValue({
			phaseKind: aerosolPhasePolicy.kind,
			parameters: aerosolPhasePolicy.parameters,
			cosTheta,
			errorPrefix: 'sky dome ground-bounce aerosol phase',
		});
	}

	return { rayleigh, mie };
}

function createLowerHemispherePhaseSamples() {
	return createHemisphereSolidAngleSamples({
		signY: -1,
		thetaSamples: LOWER_HEMISPHERE_PHASE_THETA_SAMPLES,
		phiSamples: LOWER_HEMISPHERE_PHASE_PHI_SAMPLES,
	});
}

function createUpperHemisphereSkySamples() {
	return createHemisphereSolidAngleSamples({
		signY: 1,
		thetaSamples: UPPER_HEMISPHERE_SKY_THETA_SAMPLES,
		phiSamples: UPPER_HEMISPHERE_SKY_PHI_SAMPLES,
	});
}

function createHemisphereSolidAngleSamples({
	signY,
	thetaSamples,
	phiSamples,
}) {
	const samples = [];
	const weightSr = 2 * Math.PI / (thetaSamples * phiSamples);

	for (let muIndex = 0; muIndex < thetaSamples; muIndex += 1) {
		const mu = (muIndex + 0.5) / thetaSamples;
		const horizontal = Math.sqrt(Math.max(0, 1 - mu * mu));

		for (let phiIndex = 0; phiIndex < phiSamples; phiIndex += 1) {
			const phi = 2 * Math.PI * (phiIndex + 0.5) / phiSamples;
			samples.push({
				direction: [
					horizontal * Math.cos(phi),
					signY * mu,
					horizontal * Math.sin(phi),
				],
				weightSr,
			});
		}
	}

	return samples;
}

function summarizeSkyDomeModelComparisonMetrics(pixelImage, scene) {
	const accumulators = {
		dome: createDisplayMetricAccumulator(),
		horizonRing: createDisplayMetricAccumulator(),
		zenithDisk: createDisplayMetricAccumulator(),
		sunNeighborhood10Deg: createDisplayMetricAccumulator(),
	};
	const sunDirection = directionFromElevationAzimuth(scene.sunElevationDeg, scene.sunAzimuthDeg);
	let skippedDomePixelCount = 0;

	for (let y = 0; y < pixelImage.height; y += 1) {
		for (let x = 0; x < pixelImage.width; x += 1) {
			const projection = skyDomeDirectionForPixel(x, y, pixelImage.width);

			if (!projection.insideDome) {
				continue;
			}

			const pixel = pixelImage.pixels[y * pixelImage.width + x];

			if (isSkyDomeSampleMaskSkippedPixel(pixel)) {
				skippedDomePixelCount += 1;
				continue;
			}

			const angularDistanceFromSunDeg = radiansToDegrees(Math.acos(clamp01Signed(dot3(
				projection.direction,
				sunDirection,
			))));

			addDisplayMetricPixel(accumulators.dome, pixel);

			if (projection.radius >= 0.88) {
				addDisplayMetricPixel(accumulators.horizonRing, pixel);
			}

			if (projection.radius <= 0.2) {
				addDisplayMetricPixel(accumulators.zenithDisk, pixel);
			}

			if (angularDistanceFromSunDeg <= 10) {
				addDisplayMetricPixel(accumulators.sunNeighborhood10Deg, pixel);
			}
		}
	}

	const dome = finalizeDisplayMetricAccumulator(accumulators.dome);
	const horizonRing = finalizeDisplayMetricAccumulator(accumulators.horizonRing);
	const zenithDisk = finalizeDisplayMetricAccumulator(accumulators.zenithDisk);
	const sunNeighborhood10Deg = finalizeDisplayMetricAccumulator(accumulators.sunNeighborhood10Deg);
	const hasHorizonAndZenith = horizonRing.luminance.average !== null
		&& zenithDisk.luminance.average !== null;

	return {
		kind: 'display-encoded-fisheye-model-comparison-metrics',
		source: 'generated pixel image before display-only Sun marker overlay',
		domePixelCount: dome.pixelCount,
		sampledDomePixelCount: dome.pixelCount,
		skippedDomePixelCount,
		warmAffectedFraction: dome.warmAffectedFraction,
		brightWarmAffectedFraction: dome.brightWarmAffectedFraction,
		nonBlueAffectedFraction: dome.nonBlueAffectedFraction,
		luminance: dome.luminance,
		horizonRing,
		zenithDisk,
		sunNeighborhood10Deg,
		zenithToHorizon: {
			luminanceRatio: horizonRing.luminance.average > 0 && zenithDisk.luminance.average > 0
				? horizonRing.luminance.average / zenithDisk.luminance.average
				: null,
			saturationDelta: hasHorizonAndZenith
				? horizonRing.saturation.average - zenithDisk.saturation.average
				: null,
			valueDelta: hasHorizonAndZenith
				? horizonRing.value.average - zenithDisk.value.average
				: null,
		},
	};
}

function createDisplayMetricAccumulator() {
	return {
		pixelCount: 0,
		warmAffectedCount: 0,
		brightWarmAffectedCount: 0,
		nonBlueAffectedCount: 0,
		luminanceSum: 0,
		luminanceMin: Infinity,
		luminanceMax: -Infinity,
		saturationSum: 0,
		valueSum: 0,
	};
}

function addDisplayMetricPixel(accumulator, pixel) {
	const rgb = pixel.displayRgb ?? {
		r: pixel.bytes.r / 255,
		g: pixel.bytes.g / 255,
		b: pixel.bytes.b / 255,
	};
	const hsv = rgbToHsv(rgb);
	const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;

	accumulator.pixelCount += 1;
	accumulator.luminanceSum += luminance;
	accumulator.luminanceMin = Math.min(accumulator.luminanceMin, luminance);
	accumulator.luminanceMax = Math.max(accumulator.luminanceMax, luminance);
	accumulator.saturationSum += hsv.s;
	accumulator.valueSum += hsv.v;

	if (hsv.h >= 20 && hsv.h <= 70 && hsv.s >= 0.22 && hsv.v >= 0.18) {
		accumulator.warmAffectedCount += 1;
	}

	if (hsv.h >= 25 && hsv.h <= 65 && hsv.s >= 0.35 && hsv.v >= 0.35) {
		accumulator.brightWarmAffectedCount += 1;
	}

	if ((hsv.h < 185 || hsv.h > 260) && hsv.s >= 0.15 && hsv.v >= 0.18) {
		accumulator.nonBlueAffectedCount += 1;
	}
}

function finalizeDisplayMetricAccumulator(accumulator) {
	if (accumulator.pixelCount === 0) {
		return {
			pixelCount: 0,
			warmAffectedFraction: 0,
			brightWarmAffectedFraction: 0,
			nonBlueAffectedFraction: 0,
			luminance: { min: null, max: null, average: null, range: null },
			saturation: { average: null },
			value: { average: null },
		};
	}

	return {
		pixelCount: accumulator.pixelCount,
		warmAffectedFraction: accumulator.warmAffectedCount / accumulator.pixelCount,
		brightWarmAffectedFraction: accumulator.brightWarmAffectedCount / accumulator.pixelCount,
		nonBlueAffectedFraction: accumulator.nonBlueAffectedCount / accumulator.pixelCount,
		luminance: {
			min: accumulator.luminanceMin,
			max: accumulator.luminanceMax,
			average: accumulator.luminanceSum / accumulator.pixelCount,
			range: accumulator.luminanceMax - accumulator.luminanceMin,
		},
		saturation: {
			average: accumulator.saturationSum / accumulator.pixelCount,
		},
		value: {
			average: accumulator.valueSum / accumulator.pixelCount,
		},
	};
}

function rgbToHsv(rgb) {
	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);
	const delta = max - min;
	let h = 0;

	if (delta !== 0) {
		if (max === rgb.r) {
			h = 60 * (((rgb.g - rgb.b) / delta) % 6);
		} else if (max === rgb.g) {
			h = 60 * (((rgb.b - rgb.r) / delta) + 2);
		} else {
			h = 60 * (((rgb.r - rgb.g) / delta) + 4);
		}
	}

	return {
		h: h < 0 ? h + 360 : h,
		s: max === 0 ? 0 : delta / max,
		v: max,
	};
}

function createBlackPixelSource(wavelengthsNm, colorPolicy) {
	return {
		stageHistory: [],
		wavelengthsNm,
		spectralRadiance: {
			wavelengthsNm,
			finalByWavelength: wavelengthsNm.map(() => 0),
		},
		linearRgb: { r: 0, g: 0, b: 0 },
		colorProvenance: {
			colorPolicy,
			mask: 'outside-fisheye-sky-dome',
		},
	};
}

function resolveDomeSampleMask(maskId = DEFAULT_DOME_SAMPLE_MASK_ID) {
	const mask = DOME_SAMPLE_MASKS[maskId];

	if (!mask) {
		throw new Error(`Unknown dome sample mask: ${maskId}`);
	}

	return {
		id: mask.id,
		label: mask.label,
		minRadius: mask.minRadius,
		description: mask.description,
	};
}

function shouldTraceSkyDomeProjection(projection, domeSampleMask) {
	return projection.radius >= domeSampleMask.minRadius;
}

function createSkippedSkyDomePixelSource(wavelengthsNm, colorPolicy, domeSampleMask) {
	return {
		stageHistory: [],
		wavelengthsNm,
		spectralRadiance: {
			wavelengthsNm,
			finalByWavelength: wavelengthsNm.map(() => 0),
		},
		linearRgb: { r: 0, g: 0, b: 0 },
		colorProvenance: {
			colorPolicy,
			mask: 'dome-sample-mask-skipped',
			domeSampleMask: {
				id: domeSampleMask.id,
				minRadius: domeSampleMask.minRadius,
			},
		},
	};
}

function isSkyDomeSampleMaskSkippedPixel(pixel) {
	return pixel?.source?.colorProvenance?.mask === 'dome-sample-mask-skipped';
}

function requireFinalRadianceByWavelength(packet, wavelengthsNm, contextLabel) {
	const finalByWavelength = packet.spectralRadiance?.finalByWavelength;

	if (!Array.isArray(finalByWavelength)) {
		throw new Error(`${contextLabel} requires spectralRadiance.finalByWavelength`);
	}

	if (finalByWavelength.length !== wavelengthsNm.length) {
		throw new Error(`${contextLabel} final radiance must align to wavelengthsNm`);
	}

	return finalByWavelength;
}

function skyDomeDirectionForPixel(x, y, size) {
	const ndcX = ((x + 0.5) / size) * 2 - 1;
	const ndcY = 1 - ((y + 0.5) / size) * 2;
	const radius = Math.sqrt(ndcX * ndcX + ndcY * ndcY);

	if (radius > 1) {
		return {
			insideDome: false,
			radius,
			direction: null,
			elevationDeg: null,
			azimuthDeg: null,
		};
	}

	const zenithAngleRad = radius * Math.PI / 2;
	const elevationDeg = 90 - radiansToDegrees(zenithAngleRad);
	const azimuthDeg = radiansToDegrees(Math.atan2(-ndcY, ndcX));

	return {
		insideDome: true,
		radius,
		direction: directionFromElevationAzimuth(elevationDeg, azimuthDeg),
		elevationDeg,
		azimuthDeg,
	};
}

function skyDomePixelForDirection(direction, size) {
	const normalized = normalize3(direction);
	const elevationRad = Math.asin(clamp01Signed(normalized[1]));
	const zenithAngleRad = Math.PI / 2 - elevationRad;
	const radius = zenithAngleRad / (Math.PI / 2);
	const horizontalLength = Math.sqrt(normalized[0] * normalized[0] + normalized[2] * normalized[2]);
	const screenX = horizontalLength > 0 ? normalized[2] / horizontalLength * radius : 0;
	const screenY = horizontalLength > 0 ? -normalized[0] / horizontalLength * radius : 0;

	return {
		x: Math.round((screenX + 1) * 0.5 * (size - 1)),
		y: Math.round((1 - (screenY + 1) * 0.5) * (size - 1)),
		radius,
		insideDome: radius <= 1,
	};
}

function applySkyDomeVisualFit(pixelImage, scene, mode) {
	const resolvedMode = mode ?? DEFAULT_SKY_DOME_VISUAL_FIT;
	if (resolvedMode === 'none' || resolvedMode === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return pixelImage;
	}

	if (resolvedMode !== LEGACY_BRUNETON_EDGE_AUREOLE_FIT) {
		throw new Error(`Unknown sky-dome visual fit: ${resolvedMode}`);
	}

	const sunDirection = directionFromElevationAzimuth(scene.sunElevationDeg, scene.sunAzimuthDeg);
	const pixels = [...pixelImage.pixels];
	let affectedPixelCount = 0;

	for (let y = 0; y < pixelImage.height; y += 1) {
		for (let x = 0; x < pixelImage.width; x += 1) {
			const projection = skyDomeDirectionForPixel(x, y, pixelImage.width);

			if (!projection.insideDome) {
				continue;
			}

			const index = y * pixelImage.width + x;
			const pixel = pixels[index];

			if (isSkyDomeSampleMaskSkippedPixel(pixel)) {
				continue;
			}

			const baseRgb = displayRgbFromPixel(pixel);
			const fitted = brunetonEdgeAureoleFitRgb(baseRgb, {
				projection,
				scene,
				sunDirection,
			});

			if (fitted.amount <= 0) {
				continue;
			}

			pixels[index] = pixelWithDisplayRgb(pixel, fitted.rgb, pixelImage.encoding);
			affectedPixelCount += 1;
		}
	}

	return {
		...pixelImage,
		pixels,
		bytes: pixels.flatMap((pixel) => [
			pixel.bytes.r,
			pixel.bytes.g,
			pixel.bytes.b,
			pixel.bytes.a,
		]),
		metadata: {
			...(pixelImage.metadata ?? {}),
			skyDomeVisualFit: {
				mode: resolvedMode,
				kind: 'display-side-bruneton-edge-aureole-fit',
				target: 'Bruneton 2016 Figure 1 clear-sky model column',
				affectedPixelCount,
			},
		},
	};
}

function brunetonEdgeAureoleFitRgb(baseRgb, { projection, scene, sunDirection }) {
	const lowSun = smoothstep(22, 2, scene.sunElevationDeg);
	const edge = smoothstep(0.44, 0.98, projection.radius);
	const angleFromSunDeg = radiansToDegrees(Math.acos(clamp01Signed(dot3(
		projection.direction,
		sunDirection,
	))));
	const edgeColor = mixRgb(
		{ r: 0.96, g: 0.985, b: 1 },
		{ r: 0.82, g: 0.58, b: 0.34 },
		lowSun,
	);
	const edgeStrength = edge * mixNumber(0.8, 0.36, lowSun);
	const haloRadiusDeg = mixNumber(20, 38, lowSun);
	const coreRadiusDeg = mixNumber(5.8, 12, lowSun);
	const halo = Math.exp(-0.5 * Math.pow(angleFromSunDeg / haloRadiusDeg, 2));
	const core = Math.exp(-0.5 * Math.pow(angleFromSunDeg / coreRadiusDeg, 2));
	const haloColor = mixRgb(
		{ r: 0.92, g: 0.96, b: 1 },
		{ r: 1, g: 0.68, b: 0.18 },
		lowSun,
	);
	const coreColor = mixRgb(
		{ r: 1, g: 0.995, b: 0.9 },
		{ r: 1, g: 0.93, b: 0.42 },
		lowSun,
	);
	const haloStrength = halo * mixNumber(0.54, 0.78, lowSun);
	const coreStrength = core * mixNumber(0.78, 0.92, lowSun);
	let rgb = mixRgb(baseRgb, edgeColor, edgeStrength);
	rgb = mixRgb(rgb, haloColor, haloStrength);
	rgb = mixRgb(rgb, coreColor, coreStrength);

	return {
		rgb: clampRgb(rgb),
		amount: Math.max(edgeStrength, haloStrength, coreStrength),
	};
}

function pixelImageToHexRows(pixelImage) {
	const rows = [];

	for (let y = 0; y < pixelImage.height; y += 1) {
		const row = [];

		for (let x = 0; x < pixelImage.width; x += 1) {
			row.push(pixelImage.pixels[y * pixelImage.width + x].hex);
		}

		rows.push(row);
	}

	return rows;
}

function displayRgbFromPixel(pixel) {
	if (pixel.displayRgb) {
		return {
			r: pixel.displayRgb.r,
			g: pixel.displayRgb.g,
			b: pixel.displayRgb.b,
		};
	}

	return {
		r: (pixel.bytes?.r ?? 0) / 255,
		g: (pixel.bytes?.g ?? 0) / 255,
		b: (pixel.bytes?.b ?? 0) / 255,
	};
}

function pixelWithDisplayRgb(pixel, displayRgb, encoding) {
	const rgb = clampRgb(displayRgb);
	const bytes = displayRgbToBytes(rgb, pixel.bytes?.a ?? 255);

	return {
		...pixel,
		displayLinearRgb: displayRgbToDisplayLinearRgb(rgb, encoding),
		displayRgb: rgb,
		bytes,
		hex: displayBytesToHex(bytes),
	};
}

function displayRgbToDisplayLinearRgb(rgb, encoding) {
	if (encoding === 'linear') {
		return { ...rgb };
	}

	return {
		r: decodeSrgbChannel(rgb.r),
		g: decodeSrgbChannel(rgb.g),
		b: decodeSrgbChannel(rgb.b),
	};
}

function decodeSrgbChannel(value) {
	const channel = clamp01(value);

	if (channel <= 0.04045) {
		return channel / 12.92;
	}

	return Math.pow((channel + 0.055) / 1.055, 2.4);
}

function displayRgbToBytes(rgb, alpha = 255) {
	return {
		r: Math.round(clamp01(rgb.r) * 255),
		g: Math.round(clamp01(rgb.g) * 255),
		b: Math.round(clamp01(rgb.b) * 255),
		a: Math.round(clamp01(alpha / 255) * 255),
	};
}

function displayBytesToHex(bytes) {
	return `#${[bytes.r, bytes.g, bytes.b]
		.map((channel) => channel.toString(16).padStart(2, '0'))
		.join('')}`;
}

function mixRgb(a, b, t) {
	const amount = clamp01(t);

	return {
		r: mixNumber(a.r, b.r, amount),
		g: mixNumber(a.g, b.g, amount),
		b: mixNumber(a.b, b.b, amount),
	};
}

function mixNumber(a, b, t) {
	return a + (b - a) * clamp01(t);
}

function smoothstep(edge0, edge1, value) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function clampRgb(rgb) {
	return {
		r: clamp01(rgb.r),
		g: clamp01(rgb.g),
		b: clamp01(rgb.b),
	};
}

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function overlaySunCross(pixelImage, sunMarker, encoding) {
	if (!sunMarker?.insideDome) {
		return pixelImage;
	}

	const pixels = pixelImage.pixels.map((pixel) => ({ ...pixel, bytes: { ...pixel.bytes } }));
	const markerPixel = linearRgbToPixel({ r: 1, g: 0, b: 0 }, {
		encoding,
		exposure: 1,
		toneMap: 'clip',
	});
	const offsets = [
		[0, 0],
		[-1, 0],
		[1, 0],
		[0, -1],
		[0, 1],
		[-2, 0],
		[2, 0],
		[0, -2],
		[0, 2],
	];

	for (const [dx, dy] of offsets) {
		const x = sunMarker.x + dx;
		const y = sunMarker.y + dy;

		if (x < 0 || x >= pixelImage.width || y < 0 || y >= pixelImage.height) {
			continue;
		}

		pixels[y * pixelImage.width + x] = {
			...markerPixel,
			metadata: {
				...markerPixel.metadata,
				displayOnly: true,
				overlay: 'sun-direction-cross',
			},
		};
	}

	return {
		...pixelImage,
		pixels,
		metadata: {
			...(pixelImage.metadata ?? {}),
			sunMarkerOverlay: {
				kind: 'red-cross',
				x: sunMarker.x,
				y: sunMarker.y,
			},
		},
	};
}

function runSkyPatchSet(options = {}) {
	const colorPolicy = options.color ?? DEFAULT_COLOR_POLICY;
	const encoding = options.encoding ?? DEFAULT_PIXEL_ENCODING;
	const toneMap = options.toneMap ?? DEFAULT_TONE_MAP;
	const wavelengthGrid = resolveSkyPatchWavelengthGrid(options.wavelengthGrid);
	const solarSpectrumPolicy = options.solarSpectrum ?? DEFAULT_SOLAR_SPECTRUM_POLICY;
	const rayleighPolicy = resolveRayleighPolicy(options.rayleighPolicy ?? DEFAULT_RAYLEIGH_POLICY_ID);
	const aerosolPolicy = resolveAerosolPolicy(options.aerosolPolicy ?? DEFAULT_AEROSOL_POLICY_ID);
	const aerosolPhasePolicy = resolveAerosolPhasePolicy(
		options.aerosolPhasePolicy ?? aerosolPolicy.defaultPhasePolicyId,
	);
	const ozonePolicy = resolveOzonePolicy(options.ozonePolicy ?? DEFAULT_OZONE_POLICY_ID);
	const molecularProfilePolicy = resolveMolecularProfilePolicy(
		options.molecularProfile ?? DEFAULT_MOLECULAR_PROFILE_POLICY_ID,
	);
	const sunVisual = options.sunVisual ?? DEFAULT_SUN_VISUAL;
	const patchSize = options.patchSize ?? SKY_PATCH_SIZE;
	const selectedIds = options.patchIds?.length
		? options.patchIds
		: DEFAULT_SKY_PATCH_IDS;
	const samplingControl = resolveSkyPatchSamplingControl(options);
	const solarSourceSampling = resolveSolarSourceSampling(options);
	options.progressReporter?.({
		phase: 'sky-patches-start',
		patchCount: selectedIds.length,
		patchSize,
		wavelengthCount: wavelengthGrid.wavelengthsNm.length,
		samplingProfile: samplingControl.samplingProfile.id,
		solarSource: solarSourceSampling.mode,
		solarSourceSampleCount: solarSourceSampling.sampleCount,
	});

	const skyPatches = selectedIds.map((id, patchIndex) => {
		const scene = SKY_PATCH_SCENES[id];

		if (!scene) {
			throw new Error(`Unknown sky patch: ${id}`);
		}

		return renderSkyPatch(scene, {
			stage: options.stage ?? DEFAULT_STAGE,
			colorPolicy,
			encoding,
			toneMap,
			exposureOverride: options.exposure,
			wavelengthGrid,
			solarSpectrumPolicy,
			rayleighPolicy,
			aerosolPolicy,
			aerosolPhasePolicy,
			ozonePolicy,
			molecularProfilePolicy,
			patchSize,
			fovYDegOverride: options.fovYDeg,
			sunVisual,
			samplingProfile: samplingControl.samplingProfile,
			viewStepsOverride: samplingControl.viewStepsOverride,
			sunTransmittanceStepsOverride: samplingControl.sunTransmittanceStepsOverride,
			solarSourceSampling,
			progressReporter: options.progressReporter,
			patchIndex,
			patchCount: selectedIds.length,
		});
	});

	options.progressReporter?.({
		phase: 'sky-patches-complete',
		patchCount: selectedIds.length,
	});

	return {
		kind: 'flat-atmosphere-reference-sky-patches',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		stage: options.stage ?? DEFAULT_STAGE,
		visual: {
			colorPolicy,
			colorSpace: colorPolicy === 'official-cie'
				? 'cie-1931-2deg-xyz-to-linear-srgb'
				: 'preview-cie-1931-xyz-to-linear-srgb',
			encoding,
			toneMap,
			exposure: options.exposure ?? 'per-patch',
			solarSpectrum: {
				policy: solarSpectrumPolicy,
			},
			rayleighPolicy: {
				id: rayleighPolicy.id,
				label: rayleighPolicy.label,
				source: rayleighPolicy.source,
			},
			aerosolPolicy: {
				id: aerosolPolicy.id,
				label: aerosolPolicy.label,
				source: aerosolPolicy.source,
			},
			aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
			ozonePolicy: {
				id: ozonePolicy.id,
				label: ozonePolicy.label,
				source: ozonePolicy.source,
			},
			molecularProfile: {
				id: molecularProfilePolicy.id,
				label: molecularProfilePolicy.label,
				source: molecularProfilePolicy.source,
			},
			sunVisual: {
				mode: sunVisual,
				solarAngularDiameterDeg: SOLAR_ANGULAR_DIAMETER_DEG,
				solarAngularRadiusDeg: SOLAR_ANGULAR_DIAMETER_DEG / 2,
				directDiskScale: SUN_DIAGNOSTIC_DIRECT_SCALE,
				directDiskPolicy: sunVisual === 'diagnostic'
					? 'diagnostic approximation: solar source spectrum times view transmittance, kept separate from transport radiance'
					: 'disabled',
			},
			numerical: {
				...createSamplingNumericalMetadata(samplingControl.samplingProfile, {
					defaultViewSteps: DEFAULT_SKY_PATCH_VIEW_STEPS,
					defaultSunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
				}),
			},
			solarSource: solarSourceSampling,
			wavelengthGrid: wavelengthGrid.metadata,
			patchSize,
			note: 'Patch colors integrate the sky spectrum through the selected CIE color policy, convert XYZ to linear sRGB, then apply display-only tone mapping, exposure, and byte encoding.',
		},
		model: createSkyPatchModelMetadata(
			rayleighPolicy,
			aerosolPolicy,
			aerosolPhasePolicy,
			ozonePolicy,
			molecularProfilePolicy,
		),
		baselineFreeze: createBaselineFreezeMetadata({
			phase: 'multiple-scattering-plan.phase-1',
			mode: 'sky-patches',
			scenarios: selectedIds,
			wavelengthGrid: wavelengthGrid.metadata,
			numerical: createSamplingNumericalMetadata(samplingControl.samplingProfile, {
				defaultViewSteps: DEFAULT_SKY_PATCH_VIEW_STEPS,
				defaultSunTransmittanceSteps: DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS,
			}),
			solarSource: solarSourceSampling,
		}),
		skyPatchCount: skyPatches.length,
		skyPatches,
	};
}

function renderSkyPatch(scene, {
	stage,
	colorPolicy,
	encoding,
	toneMap,
	exposureOverride,
	wavelengthGrid,
	solarSpectrumPolicy,
	rayleighPolicy,
	aerosolPolicy,
	aerosolPhasePolicy,
	ozonePolicy,
	molecularProfilePolicy,
	patchSize,
	fovYDegOverride,
	sunVisual,
	samplingProfile,
	viewStepsOverride,
	sunTransmittanceStepsOverride,
	solarSourceSampling,
	progressReporter,
	patchIndex,
	patchCount,
}) {
	const cameraConfig = fovYDegOverride === undefined
		? scene.camera
		: { ...scene.camera, fovYDeg: fovYDegOverride };
	const wavelengthsNm = [...wavelengthGrid.wavelengthsNm];
	const resolvedViewSteps = viewStepsOverride ?? scene.viewSteps ?? DEFAULT_SKY_PATCH_VIEW_STEPS;
	const resolvedSunTransmittanceSteps = sunTransmittanceStepsOverride
		?? scene.sunTransmittanceSteps
		?? DEFAULT_SKY_PATCH_SUN_TRANSMITTANCE_STEPS;
	const numerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
	};
	const actualSamplingProfile = createActualSamplingProfileMetadata(samplingProfile, {
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
	});
	const solarSpectrum = sampleSolarSpectrum(wavelengthsNm, {
		policy: solarSpectrumPolicy,
		solarTemperatureK: EARTH_LIKE_SKY.solarTemperatureK,
		solarIrradiance550Wm2Nm: EARTH_LIKE_SKY.solarIrradiance550Wm2Nm,
	});
	const sunDirection = directionFromElevationAzimuth(
		scene.sunElevationDeg ?? 45,
		scene.sunAzimuthDeg ?? 0,
	);
	const model = createSkyPatchModel(
		scene,
		wavelengthsNm,
		solarSpectrum,
		rayleighPolicy,
		aerosolPolicy,
		aerosolPhasePolicy,
		ozonePolicy,
		molecularProfilePolicy,
		solarSourceSampling,
	);
	const integrator = new CpuSpectralReferenceIntegrator();
	const camera = createCameraBasis(cameraConfig);
	const rows = [];
	const pixelSources = [];
	const sunDiagnosticSources = sunVisual === 'diagnostic'
		? createSunDiagnosticSources(patchSize)
		: null;
	const sunAngleBucketAccumulators = sunVisual === 'diagnostic'
		? createSunAngleBucketAccumulators(wavelengthsNm)
		: null;
	const centerSamples = {};
	const centerColumnX = Math.floor(patchSize.width / 2);
	const horizonProfileSamples = [];
	let closestSunPixel = null;
	let diskHitCount = 0;
	let minAngularDistanceDeg = Infinity;
	let maxAngularDistanceDeg = 0;

	progressReporter?.({
		phase: 'patch-start',
		patchId: scene.id,
		patchLabel: scene.label,
		patchIndex,
		patchCount,
		width: patchSize.width,
		height: patchSize.height,
		samplingProfile: actualSamplingProfile.id,
		viewSteps: resolvedViewSteps,
		sunTransmittanceSteps: resolvedSunTransmittanceSteps,
		wavelengthCount: wavelengthsNm.length,
	});

	for (let y = 0; y < patchSize.height; y += 1) {
		const row = [];

		for (let x = 0; x < patchSize.width; x += 1) {
			const direction = rayForPatchPixel(camera, x, y, patchSize);
			const request = {
				model,
				observer: { positionKm: [0, 0, 0] },
				ray: { direction },
				wavelengthsNm,
				numerical,
			};
			const packet = stage === DEFAULT_STAGE
				? integrator.traceRay(request)
				: integrator.runUntil(stage, request);
			const finalByWavelength = requireFinalRadianceByWavelength(
				packet,
				wavelengthsNm,
				`sky patch ${scene.id} pixel ${x},${y}`,
			);
			const pathEnd = packet.viewOpticalDepth?.pathEnd;
			const speciesOpticalDepth = summarizeSpeciesOpticalDepth(pathEnd);
			const totalOpticalDepthByWavelength = summarizeTotalOpticalDepthByWavelength(
				speciesOpticalDepth,
				wavelengthsNm,
			);
			const opticalDepthValidity = summarizeOpticalDepthValidity(
				totalOpticalDepthByWavelength,
				wavelengthsNm,
			);
			const speciesRadianceContribution = summarizeSpeciesRadianceContribution(
				packet.singleScattering?.components?.bySpecies,
			);
			const skyCompletenessDiagnostics = summarizeSkyCompletenessDiagnostics(
				packet,
				wavelengthsNm,
			);
			const sunGeometry = createSunPixelGeometry(direction, sunDirection, packet);
			const directDiskByWavelength = createDiagnosticDirectDiskSpectrum({
				sunGeometry,
				solarSpectrum,
				viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength,
				wavelengthsNm,
			});
			const combinedByWavelength = finalByWavelength.map((value, wavelengthIndex) => {
				return value + directDiskByWavelength[wavelengthIndex];
			});
			const displayExposure = exposureOverride ?? scene.displayExposure ?? 1;
			const rgb = createPatchRgb(finalByWavelength, wavelengthsNm, {
				exposure: displayExposure,
				encoding,
				toneMap,
				colorPolicy,
			});
			const combinedRgb = sunVisual === 'diagnostic'
				? createPatchRgb(combinedByWavelength, wavelengthsNm, {
					exposure: displayExposure,
					encoding,
					toneMap,
					colorPolicy,
				})
				: null;

			row.push(rgb.hex);
			pixelSources.push({
				stageHistory: packet.stageHistory ?? [],
				wavelengthsNm,
				spectralRadiance: {
					...(packet.spectralRadiance ?? {}),
					wavelengthsNm,
					finalByWavelength,
				},
				xyz: rgb.xyz,
				linearRgb: rgb.linearRgb,
				colorProvenance: rgb.colorProvenance,
			});
			if (sunDiagnosticSources) {
				appendSunDiagnosticSources(sunDiagnosticSources, {
					sunGeometry,
					finalByWavelength,
					directDiskByWavelength,
					combinedByWavelength,
					wavelengthsNm,
					colorPolicy,
				});
				addSunAngleBucketSample(sunAngleBucketAccumulators, {
					sunGeometry,
					skyRadianceByWavelength: finalByWavelength,
					directDiskByWavelength,
					combinedByWavelength,
					viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength,
					speciesOpticalDepth,
					totalOpticalDepthByWavelength,
					speciesRadianceContribution,
				});
			}
			if (sunGeometry.intersectsSolarDisk) {
				diskHitCount += 1;
			}
			minAngularDistanceDeg = Math.min(minAngularDistanceDeg, sunGeometry.angularDistanceFromSunDeg);
			maxAngularDistanceDeg = Math.max(maxAngularDistanceDeg, sunGeometry.angularDistanceFromSunDeg);
			if (
				!closestSunPixel
				|| sunGeometry.angularDistanceFromSunDeg < closestSunPixel.angularDistanceFromSunDeg
			) {
				closestSunPixel = {
					x,
					y,
					...sunGeometry,
					displayHex: rgb.hex,
					skyRadianceByWavelength: finalByWavelength,
					renderedRadianceByWavelength: finalByWavelength,
					directDiskByWavelength,
					combinedByWavelength,
					viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
					speciesOpticalDepth,
					totalOpticalDepthByWavelength,
					opticalDepthValidity,
					speciesRadianceContribution,
					skyCompletenessDiagnostics,
					sourceQuadrature: summarizeSourceQuadrature(packet.solarTransmittance, sunDirection),
				};
			}

			if (x === centerColumnX) {
				horizonProfileSamples.push(createHorizonProfileSample({
					x,
					y,
					direction,
					packet,
					rgb,
					finalByWavelength,
					pathEnd,
					totalOpticalDepthByWavelength,
					opticalDepthValidity,
					wavelengthsNm,
				}));
			}

			if (
				(x === centerColumnX && y === Math.floor(patchSize.height / 2))
				|| (x === centerColumnX && y === 0)
				|| (x === centerColumnX && y === patchSize.height - 1)
			) {
				centerSamples[`${x},${y}`] = {
					x,
					y,
					direction,
					sun: {
						...sunGeometry,
						directDiskByWavelength,
						combinedByWavelength,
						combinedDisplayHex: combinedRgb?.hex ?? null,
					},
					finalByWavelength,
					renderedByWavelength: finalByWavelength,
					viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
					speciesOpticalDepth,
					totalOpticalDepthByWavelength,
					opticalDepthValidity,
					speciesRadianceContribution,
					skyCompletenessDiagnostics,
					sourceQuadrature: summarizeSourceQuadrature(packet.solarTransmittance, sunDirection),
					viewDistanceKm: packet.rayPath?.viewSegment?.lengthKm ?? null,
					linearSrgb: rgb.linearRgb,
					displaySrgb: rgb.displayRgb,
					pixel: {
						bytes: rgb.pixel.bytes,
						hex: rgb.pixel.hex,
						encoding: rgb.pixel.encoding,
						exposure: rgb.pixel.exposure,
						toneMap: rgb.pixel.toneMap,
						clampedChannels: rgb.pixel.metadata.clampedChannels,
						preventedClipChannels: rgb.pixel.metadata.toneMapPolicy.preventedClipChannels,
					},
					xyz: rgb.xyz,
					colorProvenance: rgb.colorProvenance,
					displayHex: rgb.hex,
					debugHex: rgb.hex,
				};
			}
		}

		rows.push(row);
		progressReporter?.({
			phase: 'patch-row',
			patchId: scene.id,
			patchIndex,
			patchCount,
			rowIndex: y,
			rowCount: patchSize.height,
		});
	}

	const sunDiagnostic = sunVisual === 'diagnostic'
		? buildSunDiagnostic({
			patchSize,
			sunDiagnosticSources,
			encoding,
			toneMap,
			displayExposure: exposureOverride ?? scene.displayExposure ?? 1,
			closestSunPixel,
			diskHitCount,
			minAngularDistanceDeg,
			maxAngularDistanceDeg,
			colorPolicy,
			wavelengthsNm,
			angleBuckets: finalizeSunAngleBuckets(sunAngleBucketAccumulators, wavelengthsNm),
		})
		: null;

	progressReporter?.({
		phase: 'patch-complete',
		patchId: scene.id,
		patchIndex,
		patchCount,
	});

	return {
		id: scene.id,
		label: scene.label,
		description: scene.description,
		stage,
		size: { ...patchSize },
		numerical: {
			viewSteps: resolvedViewSteps,
			sunTransmittanceSteps: resolvedSunTransmittanceSteps,
			integrationMethod: numerical.integrationMethod,
			samplingProfile: actualSamplingProfile,
		},
		wavelengthsNm,
		wavelengthGrid: wavelengthGrid.metadata,
		colorPolicy,
		solarSpectrum: {
			policy: solarSpectrumPolicy,
			provenance: solarSpectrum.provenance,
		},
		sunVisual: {
			mode: sunVisual,
			solarAngularDiameterDeg: SOLAR_ANGULAR_DIAMETER_DEG,
			solarAngularRadiusDeg: SOLAR_ANGULAR_DIAMETER_DEG / 2,
			diagnosticDirectScale: SUN_DIAGNOSTIC_DIRECT_SCALE,
		},
		solarSource: solarSourceSampling,
		rayleighPolicy: {
			id: rayleighPolicy.id,
			label: rayleighPolicy.label,
			source: rayleighPolicy.source,
			doi: rayleighPolicy.doi ?? null,
			coefficientModel: rayleighPolicy.coefficientModel,
		},
		aerosolPolicy: {
			id: aerosolPolicy.id,
			label: aerosolPolicy.label,
			source: aerosolPolicy.source,
			aod550: aerosolPolicy.aod550,
			angstromExponent: aerosolPolicy.angstromExponent,
			singleScatteringAlbedo: aerosolPolicy.singleScatteringAlbedo,
			defaultPhasePolicyId: aerosolPolicy.defaultPhasePolicyId,
			scaleHeightKm: aerosolPolicy.scaleHeightKm,
		},
		aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
		ozonePolicy: {
			id: ozonePolicy.id,
			label: ozonePolicy.label,
			source: ozonePolicy.source,
			atlasDoi: ozonePolicy.atlasDoi ?? null,
			crossSectionModel: ozonePolicy.crossSectionModel,
		},
		molecularProfile: {
			id: molecularProfilePolicy.id,
			label: molecularProfilePolicy.label,
			source: molecularProfilePolicy.source,
			nasaNtrsRecord: molecularProfilePolicy.nasaNtrsRecord ?? null,
		},
		displayEncoding: encoding,
		toneMap,
		displayExposure: exposureOverride ?? scene.displayExposure ?? 1,
		camera: cameraConfig,
		sun: scene.nightGlowSpectrum
			? { mode: 'controlled-night-glow' }
			: {
				elevationDeg: scene.sunElevationDeg,
				azimuthDeg: scene.sunAzimuthDeg,
			},
		diagnosticSamples: Object.values(centerSamples),
		horizonProfile: summarizeHorizonProfile(horizonProfileSamples, wavelengthsNm),
		sunDiagnostic,
		pixelImage: referenceOutputsToPixelImage({
			width: patchSize.width,
			height: patchSize.height,
			pixels: pixelSources,
		}, {
			encoding,
			toneMap,
			exposure: exposureOverride ?? scene.displayExposure ?? 1,
		}),
		rows,
	};
}

function createCameraBasis(camera) {
	const forward = normalize3(camera.forward);
	const candidateUp = normalize3(camera.up ?? [0, 1, 0]);
	const right = normalize3(cross(forward, candidateUp));
	const up = normalize3(cross(right, forward));
	const tanHalfFovY = Math.tan(degreesToRadians(camera.fovYDeg ?? 45) / 2);

	return {
		forward,
		right,
		up,
		tanHalfFovY,
	};
}

function createHorizonProfileSample({
	x,
	y,
	direction,
	packet,
	rgb,
	finalByWavelength,
	pathEnd,
	totalOpticalDepthByWavelength,
	opticalDepthValidity,
	wavelengthsNm,
}) {
	const elevationDeg = radiansToDegrees(Math.asin(clamp01Signed(direction[1])));
	const surfaceHit = packet.rayPath?.surfaceHit ?? null;
	const rayClass = surfaceHit ? 'surface-hit' : 'sky';

	return {
		x,
		y,
		elevationDeg,
		rayClass,
		surfaceHit: surfaceHit
			? {
				tKm: surfaceHit.tKm,
				boundaryReason: surfaceHit.boundaryReason ?? null,
				boundaryId: surfaceHit.boundaryId ?? null,
			}
			: null,
		displayHex: rgb.hex,
		displayLuminance: relativeLuminance(rgb.displayRgb),
		linearSrgb: rgb.linearRgb,
		linearLuminance: relativeLuminance(rgb.linearRgb),
		finalByWavelength,
		renderedByWavelength: finalByWavelength,
		viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
		totalOpticalDepthByWavelength,
		opticalDepthValidity,
		wavelengthsNm,
	};
}

function summarizeHorizonProfile(samples, wavelengthsNm) {
	const skySamples = samples.filter((sample) => sample.rayClass === 'sky');
	const surfaceSamples = samples.filter((sample) => sample.rayClass === 'surface-hit');
	const horizonSkySample = skySamples
		.filter((sample) => sample.elevationDeg >= 0)
		.sort((left, right) => left.elevationDeg - right.elevationDeg)[0]
		?? skySamples.at(-1)
		?? null;
	const lastSkyByRow = skySamples.at(-1) ?? null;
	const firstSurfaceByRow = surfaceSamples[0] ?? null;
	const topSky = skySamples.slice(0, Math.min(3, skySamples.length));
	const nearHorizonSky = skySamples
		.filter((sample) => sample.elevationDeg >= 0)
		.slice(-Math.min(3, skySamples.length));
	const topMean = mean(topSky.map((sample) => sample.linearLuminance));
	const horizonMean = mean(nearHorizonSky.map((sample) => sample.linearLuminance));
	const skyTrend = Number.isFinite(topMean) && Number.isFinite(horizonMean)
		? {
			topMeanLinearLuminance: topMean,
			nearHorizonMeanLinearLuminance: horizonMean,
			nearHorizonOverTop: topMean === 0 ? null : horizonMean / topMean,
			direction: horizonMean > topMean * 1.05
				? 'brightens-toward-horizon'
				: horizonMean < topMean * 0.95
					? 'darkens-toward-horizon'
					: 'roughly-flat',
		}
		: null;

	return {
		profileKind: 'center-column-horizon-profile',
		purpose: 'separate sky-only near-horizon gradient from below-horizon surface/placeholder pixels',
		sampleCount: samples.length,
		skySampleCount: skySamples.length,
		surfaceHitSampleCount: surfaceSamples.length,
		topRow: samples[0] ?? null,
		centerRow: samples[Math.floor(samples.length / 2)] ?? null,
		lastRow: samples.at(-1) ?? null,
		horizonSkySample,
		lastSkyByRow,
		firstSurfaceByRow,
		skyTrend,
		wavelengthsNm,
		samples,
	};
}

function relativeLuminance(rgb) {
	if (!rgb) {
		return null;
	}

	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function mean(values) {
	const finiteValues = values.filter((value) => Number.isFinite(value));

	if (finiteValues.length === 0) {
		return null;
	}

	return finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length;
}

function maxFinite(values) {
	const finiteValues = values.filter((value) => Number.isFinite(value));

	return finiteValues.length > 0 ? Math.max(...finiteValues) : null;
}

function rayForPatchPixel(camera, x, y, size) {
	const aspect = size.width / size.height;
	const ndcX = ((x + 0.5) / size.width) * 2 - 1;
	const ndcY = 1 - ((y + 0.5) / size.height) * 2;
	const horizontalScale = camera.tanHalfFovY * aspect;
	const verticalScale = camera.tanHalfFovY;

	return normalize3([
		camera.forward[0] + camera.right[0] * ndcX * horizontalScale + camera.up[0] * ndcY * verticalScale,
		camera.forward[1] + camera.right[1] * ndcX * horizontalScale + camera.up[1] * ndcY * verticalScale,
		camera.forward[2] + camera.right[2] * ndcX * horizontalScale + camera.up[2] * ndcY * verticalScale,
	]);
}

function createPatchRgb(finalByWavelength, wavelengthsNm, {
	exposure,
	encoding,
	toneMap,
	colorPolicy,
}) {
	const color = colorPolicy === 'preview-cie'
		? spectralToApproximateSrgb(finalByWavelength, wavelengthsNm)
		: spectralRadianceToLinearSrgb(finalByWavelength, wavelengthsNm);
	const linearRgb = color.linearRgb;
	const pixel = linearRgbToPixel(linearRgb, {
		encoding,
		exposure,
		toneMap,
	});

	return {
		hex: pixel.hex,
		xyz: color.xyz,
		linearRgb,
		colorProvenance: {
			colorPolicy,
			...(color.provenance ?? {
				cmf: {
					sourceId: 'preview-cie-analytic',
					title: 'Wyman Sloan Shirley analytic CIE 1931 approximation',
				},
				interpolation: 'analytic approximation at caller wavelengths',
				integration: 'trapezoidal wavelength weights over caller-provided samples',
				outputColorSpace: 'linear-srgb',
				clamping: 'preview path clamps negative linear RGB before display',
			}),
		},
		displayRgb: pixel.displayRgb,
		pixel,
	};
}

function summarizeSpeciesOpticalDepth(pathEnd) {
	if (!pathEnd?.speciesOpticalDepth) {
		return null;
	}

	return Object.fromEntries(
		Object.entries(pathEnd.speciesOpticalDepth).map(([speciesName, opticalDepth]) => [
			speciesName,
			{
				cumulativeOpticalDepthByWavelength: [
					...(opticalDepth.cumulativeOpticalDepthByWavelength ?? []),
				],
			},
		]),
	);
}

function summarizeTotalOpticalDepthByWavelength(speciesOpticalDepth, wavelengthsNm) {
	if (!speciesOpticalDepth) {
		return null;
	}

	const total = wavelengthsNm.map(() => 0);
	let hasContribution = false;

	for (const opticalDepth of Object.values(speciesOpticalDepth)) {
		const values = opticalDepth?.cumulativeOpticalDepthByWavelength;
		if (!Array.isArray(values)) {
			continue;
		}

		hasContribution = true;
		addArrayInto(total, values);
	}

	return hasContribution ? total : null;
}

function summarizeSpeciesRadianceContribution(bySpecies) {
	if (!bySpecies) {
		return null;
	}

	return Object.fromEntries(
		Object.entries(bySpecies).map(([speciesName, contribution]) => [
			speciesName,
			{
				radianceByWavelength: [...(contribution.radianceByWavelength ?? [])],
			},
		]),
	);
}

function summarizeOpticalDepthValidity(totalOpticalDepthByWavelength, wavelengthsNm) {
	if (!Array.isArray(totalOpticalDepthByWavelength)) {
		return null;
	}

	const selected = selectedSpectrumValues(totalOpticalDepthByWavelength, wavelengthsNm)
		.map(({ wavelengthNm, value }) => ({
			wavelengthNm,
			tau: value,
			classification: classifyOpticalDepth(value),
		}));
	const maxTau = Math.max(...totalOpticalDepthByWavelength);
	const maxIndex = totalOpticalDepthByWavelength.indexOf(maxTau);
	const maxClassification = classifyOpticalDepth(maxTau);

	return {
		selected,
		maxTau,
		maxWavelengthNm: wavelengthsNm[maxIndex],
		classification: maxClassification,
		highTau: HIGH_TAU_WARNING_CLASS_IDS.includes(maxClassification.id),
	};
}

function summarizeSkyCompletenessDiagnostics(packet, wavelengthsNm) {
	return {
		phase: summarizePhaseDiagnostics(packet.scatteringPhase, wavelengthsNm),
		altitude: summarizeAltitudeDistribution(packet.mediumSamples),
		singleScatteringBudget: summarizeSingleScatteringBudget(packet, wavelengthsNm),
		missingLightEstimate: estimateMissingLightRequirement(packet, wavelengthsNm),
		disabledTerms: {
			surfaceBounce: 'disabled',
			cloudContribution: 'disabled',
			terrainOceanReflection: 'disabled',
			multipleScattering: 'disabled',
		},
	};
}

function summarizePhaseDiagnostics(scatteringPhase, wavelengthsNm) {
	const sourceSamples = collectPhaseSourceSamples(scatteringPhase);
	if (sourceSamples.length === 0) {
		return null;
	}

	const wavelengthIndex = nearestWavelengthIndex(wavelengthsNm, 560);
	const angleDegValues = sourceSamples.map((sample) => radiansToDegrees(sample.scatteringAngleRad));
	const speciesPhase = {};

	for (const sourceSample of sourceSamples) {
		for (const species of sourceSample.species ?? []) {
			if (!speciesPhase[species.name]) {
				speciesPhase[species.name] = {
					phaseKind: species.phaseKind,
					values: [],
				};
			}

			speciesPhase[species.name].values.push(species.phaseByWavelength?.[wavelengthIndex] ?? 0);
		}
	}

	const avgSpeciesPhaseAt560 = Object.fromEntries(
		Object.entries(speciesPhase).map(([speciesName, entry]) => [
			speciesName,
			{
				phaseKind: entry.phaseKind,
				phaseAt560: average(entry.values),
			},
		]),
	);
	const rayleigh = avgSpeciesPhaseAt560.rayleigh?.phaseAt560;
	const mie = avgSpeciesPhaseAt560.mie?.phaseAt560;

	return {
		convention: scatteringPhase?.metadata?.convention ?? null,
		sourceSampleCount: sourceSamples.length,
		avgScatteringAngleDeg: average(angleDegValues),
		minScatteringAngleDeg: Math.min(...angleDegValues),
		maxScatteringAngleDeg: Math.max(...angleDegValues),
		avgCosTheta: average(sourceSamples.map((sample) => sample.cosTheta)),
		avgSpeciesPhaseAt560,
		mieToRayleighPhaseRatioAt560: rayleigh > 0 && mie !== undefined ? mie / rayleigh : null,
	};
}

function collectPhaseSourceSamples(scatteringPhase) {
	return (scatteringPhase?.samples ?? []).flatMap((sample) => sample.sourceSamples ?? []);
}

function summarizeSourceQuadrature(solarTransmittance, sunDirection) {
	const sourceSamples = (solarTransmittance?.samples ?? [])
		.find((sample) => (sample.sourceSamples ?? []).length > 0)
		?.sourceSamples ?? [];

	if (sourceSamples.length === 0) {
		return null;
	}

	const weights = sourceSamples.map((sample) => sample.weight).filter(Number.isFinite);
	const solidAnglesSr = sourceSamples.map((sample) => sample.solidAngleSr).filter(Number.isFinite);
	const normalizedSunDirection = normalize3(sunDirection);
	const angularOffsetsDeg = sourceSamples.map((sample) => {
		return radiansToDegrees(Math.acos(clamp01Signed(dot3(
			normalize3(sample.direction),
			normalizedSunDirection,
		))));
	});

	return {
		sourceSampleCount: sourceSamples.length,
		sourceSampleIds: sourceSamples.map((sample) => sample.sourceSampleId),
		weightSum: roundDiagnosticNumber(weights.reduce((sum, value) => sum + value, 0)),
		minWeight: roundDiagnosticNumber(Math.min(...weights)),
		maxWeight: roundDiagnosticNumber(Math.max(...weights)),
		solidAngleSrSum: solidAnglesSr.length > 0
			? roundDiagnosticNumber(solidAnglesSr.reduce((sum, value) => sum + value, 0))
			: null,
		minAngularOffsetDeg: roundDiagnosticNumber(Math.min(...angularOffsetsDeg)),
		maxAngularOffsetDeg: roundDiagnosticNumber(Math.max(...angularOffsetsDeg)),
	};
}

function summarizeAltitudeDistribution(mediumSamples) {
	if (!Array.isArray(mediumSamples) || mediumSamples.length === 0) {
		return null;
	}

	const totalWeightKm = mediumSamples.reduce((sum, sample) => sum + (sample.weightKm ?? 0), 0);
	const weightedAltitudeSum = mediumSamples.reduce((sum, sample) => {
		return sum + (sample.altitudeKm ?? 0) * (sample.weightKm ?? 0);
	}, 0);
	const altitudes = mediumSamples.map((sample) => sample.altitudeKm ?? 0);
	const fractionBelow = (thresholdKm) => totalWeightKm > 0
		? mediumSamples.reduce((sum, sample) => {
			return sum + ((sample.altitudeKm ?? 0) < thresholdKm ? sample.weightKm ?? 0 : 0);
		}, 0) / totalWeightKm
		: 0;

	return {
		sampleCount: mediumSamples.length,
		totalWeightKm,
		minAltitudeKm: Math.min(...altitudes),
		maxAltitudeKm: Math.max(...altitudes),
		weightedAverageAltitudeKm: totalWeightKm > 0 ? weightedAltitudeSum / totalWeightKm : 0,
		fractionBelow1Km: fractionBelow(1),
		fractionBelow2Km: fractionBelow(2),
		fractionBelow5Km: fractionBelow(5),
		fractionBelow10Km: fractionBelow(10),
	};
}

function summarizeSingleScatteringBudget(packet, wavelengthsNm) {
	const singleScatteringSamples = packet.singleScattering?.samples;
	if (!Array.isArray(singleScatteringSamples) || singleScatteringSamples.length === 0) {
		return null;
	}

	const wavelengthIndex = nearestWavelengthIndex(wavelengthsNm, 560);
	const sampleBudgets = singleScatteringSamples.map((sample, sampleIndex) => {
		const contributionAt560 = sample.contributionByWavelength?.[wavelengthIndex] ?? 0;
		return summarizeSingleScatteringSampleBudget(packet, sample, sampleIndex, wavelengthIndex, wavelengthsNm);
	}).filter(Boolean);
	const peak = sampleBudgets.reduce((currentPeak, sample) => {
		return !currentPeak || sample.contributionAt560 > currentPeak.contributionAt560
			? sample
			: currentPeak;
	}, null);
	const totalContributionAt560 = singleScatteringSamples.reduce((sum, sample) => {
		return sum + (sample.contributionByWavelength?.[wavelengthIndex] ?? 0);
	}, 0);

	return {
		wavelengthNm: wavelengthsNm[wavelengthIndex],
		totalContributionAt560,
		peakContributionSample: peak,
	};
}

function summarizeSingleScatteringSampleBudget(packet, scatteringSample, sampleIndex, wavelengthIndex, wavelengthsNm) {
	const mediumSample = packet.mediumSamples?.[sampleIndex];
	const viewSample = packet.viewOpticalDepth?.samples?.[sampleIndex];
	const solarSourceSample = packet.solarTransmittance?.samples?.[sampleIndex]?.sourceSamples?.[0];
	const phaseSourceSample = packet.scatteringPhase?.samples?.[sampleIndex]?.sourceSamples?.[0];

	if (!mediumSample || !viewSample || !solarSourceSample || !phaseSourceSample) {
		return null;
	}

	const species = {};
	for (const phaseSpecies of phaseSourceSample.species ?? []) {
		const mediumSpecies = (mediumSample.species ?? []).find((candidate) => {
			return candidate.name === phaseSpecies.name;
		});
		const scattering = mediumSpecies?.scatteringByWavelength?.[wavelengthIndex] ?? 0;
		const phase = phaseSpecies.phaseByWavelength?.[wavelengthIndex] ?? 0;
		const contribution = scatteringSample.sourceSamples?.[0]?.species
			?.find((candidate) => candidate.name === phaseSpecies.name)
			?.contributionByWavelength?.[wavelengthIndex] ?? 0;

		species[phaseSpecies.name] = {
			scatteringCoefficientPerKm: scattering,
			phaseSrInverse: phase,
			contributionAt560: contribution,
		};
	}

	return {
		sampleIndex: scatteringSample.sampleIndex ?? sampleIndex,
		distanceFromObserverKm: mediumSample.distanceFromObserverKm,
		altitudeKm: mediumSample.altitudeKm,
		weightKm: mediumSample.weightKm,
		contributionAt560: scatteringSample.contributionByWavelength?.[wavelengthIndex] ?? 0,
		viewTransmittanceAt560: viewSample.viewTransmittanceByWavelength?.[wavelengthIndex] ?? 0,
		sourceTransmittanceAt560: solarSourceSample.sourceTransmittanceByWavelength?.[wavelengthIndex] ?? 0,
		sourceSpectrumAt560: solarSourceSample.sourceSpectrum?.valuesByWavelength?.[wavelengthIndex] ?? 0,
		scatteringAngleDeg: radiansToDegrees(phaseSourceSample.scatteringAngleRad),
		cosTheta: phaseSourceSample.cosTheta,
		species,
		wavelengthNm: wavelengthsNm[wavelengthIndex],
	};
}

function estimateMissingLightRequirement(packet, wavelengthsNm) {
	const totalTau = summarizeTotalOpticalDepthByWavelength(
		summarizeSpeciesOpticalDepth(packet.viewOpticalDepth?.pathEnd),
		wavelengthsNm,
	);
	const validity = summarizeOpticalDepthValidity(totalTau, wavelengthsNm);
	const phase = summarizePhaseDiagnostics(packet.scatteringPhase, wavelengthsNm);

	if (!validity) {
		return null;
	}

	const likelyMultipleScattering = validity.maxTau >= 5;
	const likelyAureolePhaseSensitivity = (phase?.mieToRayleighPhaseRatioAt560 ?? 0) > 1;

	return {
		assessment: likelyMultipleScattering ? 'multiple-scattering-likely' : 'single-scattering-likely-sufficient',
		reason: likelyMultipleScattering
			? 'view max tau is in a high-tau regime; single scattering is qualitative and may miss higher-order sky radiance'
			: 'view max tau is below the high-tau warning threshold',
		likelyMultipleScattering,
		likelyAureolePhaseSensitivity,
	};
}

function average(values) {
	if (!Array.isArray(values) || values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function classifyOpticalDepth(tau) {
	if (!Number.isFinite(tau) || tau < 0) {
		return {
			id: 'invalid',
			label: 'invalid',
			minTau: null,
			maxTau: null,
		};
	}

	return OPTICAL_DEPTH_VALIDITY_CLASSES.find((candidate) => {
		return tau >= candidate.minTau && tau < candidate.maxTau;
	}) ?? OPTICAL_DEPTH_VALIDITY_CLASSES[OPTICAL_DEPTH_VALIDITY_CLASSES.length - 1];
}

function createSunDiagnosticSources(size) {
	return {
		width: size.width,
		height: size.height,
		angularDistance: [],
		diskMask: [],
		directDisk: [],
		skyPlusDisk: [],
	};
}

function appendSunDiagnosticSources(sources, {
	sunGeometry,
	finalByWavelength,
	directDiskByWavelength,
	combinedByWavelength,
	wavelengthsNm,
	colorPolicy,
}) {
	sources.angularDistance.push({
		linearRgb: sunAngleHeatmapLinearRgb(sunGeometry),
	});
	sources.diskMask.push({
		linearRgb: sunGeometry.intersectsSolarDisk
			? { r: 1, g: 1, b: 1 }
			: { r: 0, g: 0, b: 0 },
	});
	sources.directDisk.push({
		linearRgb: spectralToLinearRgbForPolicy(directDiskByWavelength, wavelengthsNm, colorPolicy),
		spectralRadiance: {
			wavelengthsNm,
			finalByWavelength: directDiskByWavelength,
		},
	});
	sources.skyPlusDisk.push({
		linearRgb: spectralToLinearRgbForPolicy(
			combinedByWavelength.length > 0 ? combinedByWavelength : finalByWavelength,
			wavelengthsNm,
			colorPolicy,
		),
		spectralRadiance: {
			wavelengthsNm,
			finalByWavelength: combinedByWavelength,
		},
	});
}

function buildSunDiagnostic({
	patchSize,
	sunDiagnosticSources,
	encoding,
	toneMap,
	displayExposure,
	closestSunPixel,
	diskHitCount,
	minAngularDistanceDeg,
	maxAngularDistanceDeg,
	colorPolicy,
	wavelengthsNm,
	angleBuckets,
}) {
	const panelOptions = {
		encoding,
		toneMap,
		exposure: displayExposure,
	};

	return {
		mode: 'diagnostic',
		solarAngularDiameterDeg: SOLAR_ANGULAR_DIAMETER_DEG,
		solarAngularRadiusDeg: SOLAR_ANGULAR_DIAMETER_DEG / 2,
		directDiskPolicy: 'diagnostic approximation: source spectrum times camera-path transmittance, separate from transport radiance',
		directDiskScale: SUN_DIAGNOSTIC_DIRECT_SCALE,
		pixelSummary: {
			diskHitCount,
			pixelCount: patchSize.width * patchSize.height,
			minAngularDistanceDeg,
			maxAngularDistanceDeg,
			closestSunPixel,
		},
		angleBuckets,
		wavelengthsNm,
		panelImages: {
			angularDistance: referenceOutputsToPixelImage({
				width: patchSize.width,
				height: patchSize.height,
				pixels: sunDiagnosticSources.angularDistance,
			}, panelOptions),
			diskMask: referenceOutputsToPixelImage({
				width: patchSize.width,
				height: patchSize.height,
				pixels: sunDiagnosticSources.diskMask,
			}, panelOptions),
			directDisk: referenceOutputsToPixelImage({
				width: patchSize.width,
				height: patchSize.height,
				pixels: sunDiagnosticSources.directDisk,
			}, panelOptions),
			skyPlusDisk: referenceOutputsToPixelImage({
				width: patchSize.width,
				height: patchSize.height,
				pixels: sunDiagnosticSources.skyPlusDisk,
			}, panelOptions),
		},
		colorPolicy,
	};
}

function createSunAngleBucketAccumulators(wavelengthsNm) {
	return SUN_ANGLE_BUCKETS.map((bucket) => ({
		...bucket,
		count: 0,
		skyRadianceByWavelength: wavelengthsNm.map(() => 0),
		directDiskByWavelength: wavelengthsNm.map(() => 0),
		combinedByWavelength: wavelengthsNm.map(() => 0),
		viewTransmittanceByWavelength: wavelengthsNm.map(() => 0),
		totalOpticalDepthByWavelength: wavelengthsNm.map(() => 0),
		speciesOpticalDepth: {},
		speciesRadianceContribution: {},
	}));
}

function addSunAngleBucketSample(buckets, {
	sunGeometry,
	skyRadianceByWavelength,
	directDiskByWavelength,
	combinedByWavelength,
	viewTransmittanceByWavelength,
	speciesOpticalDepth,
	totalOpticalDepthByWavelength,
	speciesRadianceContribution,
}) {
	const bucket = buckets.find((candidate) => {
		return sunGeometry.angularDistanceFromSunDeg >= candidate.minDeg
			&& sunGeometry.angularDistanceFromSunDeg < candidate.maxDeg;
	});

	if (!bucket) {
		return;
	}

	bucket.count += 1;
	addArrayInto(bucket.skyRadianceByWavelength, skyRadianceByWavelength);
	addArrayInto(bucket.directDiskByWavelength, directDiskByWavelength);
	addArrayInto(bucket.combinedByWavelength, combinedByWavelength);
	addArrayInto(bucket.viewTransmittanceByWavelength, viewTransmittanceByWavelength);
	addArrayInto(bucket.totalOpticalDepthByWavelength, totalOpticalDepthByWavelength);

	for (const [speciesName, opticalDepth] of Object.entries(speciesOpticalDepth ?? {})) {
		if (!bucket.speciesOpticalDepth[speciesName]) {
			bucket.speciesOpticalDepth[speciesName] = {
				cumulativeOpticalDepthByWavelength: bucket.skyRadianceByWavelength.map(() => 0),
			};
		}

		addArrayInto(
			bucket.speciesOpticalDepth[speciesName].cumulativeOpticalDepthByWavelength,
			opticalDepth.cumulativeOpticalDepthByWavelength,
		);
	}

	for (const [speciesName, contribution] of Object.entries(speciesRadianceContribution ?? {})) {
		if (!bucket.speciesRadianceContribution[speciesName]) {
			bucket.speciesRadianceContribution[speciesName] = {
				radianceByWavelength: bucket.skyRadianceByWavelength.map(() => 0),
			};
		}

		addArrayInto(
			bucket.speciesRadianceContribution[speciesName].radianceByWavelength,
			contribution.radianceByWavelength,
		);
	}
}

function finalizeSunAngleBuckets(buckets, wavelengthsNm) {
	return buckets.map((bucket) => {
		const divide = (values) => bucket.count > 0
			? values.map((value) => value / bucket.count)
			: values.map(() => 0);
		const avgTotalOpticalDepthByWavelength = divide(bucket.totalOpticalDepthByWavelength);

		return {
			id: bucket.id,
			minDeg: bucket.minDeg,
			maxDeg: bucket.maxDeg,
			count: bucket.count,
			avgSkyRadianceByWavelength: divide(bucket.skyRadianceByWavelength),
			avgDirectDiskByWavelength: divide(bucket.directDiskByWavelength),
			avgCombinedByWavelength: divide(bucket.combinedByWavelength),
			avgViewTransmittanceByWavelength: divide(bucket.viewTransmittanceByWavelength),
			avgTotalOpticalDepthByWavelength,
			opticalDepthValidity: summarizeOpticalDepthValidity(
				avgTotalOpticalDepthByWavelength,
				wavelengthsNm,
			),
			avgSpeciesOpticalDepth: Object.fromEntries(
				Object.entries(bucket.speciesOpticalDepth).map(([speciesName, opticalDepth]) => [
					speciesName,
					{
						cumulativeOpticalDepthByWavelength: divide(
							opticalDepth.cumulativeOpticalDepthByWavelength,
						),
					},
				]),
			),
			avgSpeciesRadianceContribution: Object.fromEntries(
				Object.entries(bucket.speciesRadianceContribution).map(([speciesName, contribution]) => [
					speciesName,
					{
						radianceByWavelength: divide(contribution.radianceByWavelength),
					},
				]),
			),
		};
	});
}

function addArrayInto(target, values) {
	if (!Array.isArray(values)) {
		return;
	}

	for (const [index, value] of values.entries()) {
		target[index] += value ?? 0;
	}
}

function addArrayIntoWeighted(target, values, weight) {
	if (!Array.isArray(values)) {
		return;
	}

	for (const [index, value] of values.entries()) {
		target[index] += (value ?? 0) * weight;
	}
}

function createSunPixelGeometry(viewDirection, sunDirection, packet) {
	const angularDistanceFromSunDeg = radiansToDegrees(Math.acos(clamp01Signed(dot3(
		normalize3(viewDirection),
		normalize3(sunDirection),
	))));
	const solarAngularRadiusDeg = SOLAR_ANGULAR_DIAMETER_DEG / 2;
	const intersectsSolarDisk = angularDistanceFromSunDeg <= solarAngularRadiusDeg;
	const sunOccludedByHorizon = intersectsSolarDisk && Boolean(packet.rayPath?.surfaceHit);

	return {
		angularDistanceFromSunDeg,
		solarAngularRadiusDeg,
		solarAngularDiameterDeg: SOLAR_ANGULAR_DIAMETER_DEG,
		intersectsSolarDisk,
		sunOccludedByHorizon,
	};
}

function createDiagnosticDirectDiskSpectrum({
	sunGeometry,
	solarSpectrum,
	viewTransmittanceByWavelength,
	wavelengthsNm,
}) {
	if (!sunGeometry.intersectsSolarDisk || sunGeometry.sunOccludedByHorizon) {
		return wavelengthsNm.map(() => 0);
	}

	const transmittance = Array.isArray(viewTransmittanceByWavelength)
		? viewTransmittanceByWavelength
		: wavelengthsNm.map(() => 0);

	return solarSpectrum.valuesByWavelength.map((value, wavelengthIndex) => {
		return value * (transmittance[wavelengthIndex] ?? 0) * SUN_DIAGNOSTIC_DIRECT_SCALE;
	});
}

function sunAngleHeatmapLinearRgb(sunGeometry) {
	if (sunGeometry.intersectsSolarDisk) {
		return { r: 1, g: 1, b: 1 };
	}

	const t = Math.min(sunGeometry.angularDistanceFromSunDeg / 5, 1);

	return {
		r: Math.max(0, 1 - t),
		g: Math.max(0, 1 - Math.abs(t - 0.35) * 2.4),
		b: Math.min(1, t * 1.2),
	};
}

function spectralToLinearRgbForPolicy(valuesByWavelength, wavelengthsNm, colorPolicy) {
	const color = colorPolicy === 'preview-cie'
		? spectralToApproximateSrgb(valuesByWavelength, wavelengthsNm)
		: spectralRadianceToLinearSrgb(valuesByWavelength, wavelengthsNm);

	return color.linearRgb;
}

function createEarthLikeSolarSourceSamples({
	sunDirection,
	solarSpectrum,
	solarSourceSampling,
}) {
	const directions = createSolarSourceDirections(sunDirection, solarSourceSampling);
	const weight = 1 / solarSourceSampling.sampleCount;
	const sourceSpectrum = {
		kind: 'spectral-irradiance',
		valuesByWavelength: solarSpectrum.valuesByWavelength,
		units: 'W m-2 nm-1',
		derivation: solarSpectrum.provenance.title,
		provenance: solarSpectrum.provenance,
	};

	return directions.map((entry, index) => {
		return {
			id: solarSourceSampling.mode === 'directional-sun'
				? 'earth-like-sun.center'
				: `earth-like-sun.disc.${index}`,
			direction: entry.direction,
			weight,
			solidAngleSr: solarSourceSampling.perSampleSolidAngleSr,
			sourceSpectrum,
		};
	});
}

function createSolarSourceDirections(sunDirection, solarSourceSampling) {
	const center = normalize3(sunDirection);

	if (solarSourceSampling.mode === 'directional-sun') {
		return [{
			direction: center,
			angularOffsetRad: 0,
		}];
	}

	const { tangentX, tangentY } = createSolarDiscBasis(center);
	const goldenAngleRad = Math.PI * (3 - Math.sqrt(5));

	return Array.from({ length: solarSourceSampling.sampleCount }, (_, index) => {
		const offsetRad = solarSourceSampling.solarAngularRadiusRad
			* Math.sqrt((index + 0.5) / solarSourceSampling.sampleCount);
		const azimuthRad = index * goldenAngleRad;
		const tangent = normalize3(add3(
			scale3(tangentX, Math.cos(azimuthRad)),
			scale3(tangentY, Math.sin(azimuthRad)),
		));

		return {
			direction: normalize3(add3(
				scale3(center, Math.cos(offsetRad)),
				scale3(tangent, Math.sin(offsetRad)),
			)),
			angularOffsetRad: offsetRad,
		};
	});
}

function createSolarDiscBasis(centerDirection) {
	const reference = Math.abs(dot3(centerDirection, [0, 1, 0])) > 0.9
		? [1, 0, 0]
		: [0, 1, 0];
	const tangentX = normalize3(cross(reference, centerDirection));
	const tangentY = normalize3(cross(centerDirection, tangentX));

	return { tangentX, tangentY };
}

function createSkyPatchModel(
	scene,
	wavelengthsNm,
	solarSpectrum,
	rayleighPolicy,
	aerosolPolicy,
	aerosolPhasePolicy,
	ozonePolicy,
	molecularProfilePolicy,
	solarSourceSampling = resolveSolarSourceSampling(),
) {
	const planetRadiusKm = EARTH_LIKE_SKY.planetRadiusKm;
	const atmosphereRadiusKm = planetRadiusKm + EARTH_LIKE_SKY.atmosphereTopAltitudeKm;
	const planetCenterKm = [0, -planetRadiusKm, 0];
	const sunDirection = directionFromElevationAzimuth(
		scene.sunElevationDeg ?? 45,
		scene.sunAzimuthDeg ?? 0,
	);
	const sourceSamples = createEarthLikeSolarSourceSamples({
		sunDirection,
		solarSpectrum,
		solarSourceSampling,
	});

	return {
		id: `sky-patch-${scene.id}`,
		physicalConstants: {
			planetRadiusKm,
			atmosphereTopAltitudeKm: EARTH_LIKE_SKY.atmosphereTopAltitudeKm,
			rayleighScaleHeightKm: EARTH_LIKE_SKY.rayleighScaleHeightKm,
			rayleighBeta550PerKm: EARTH_LIKE_SKY.rayleighBeta550PerKm,
			aerosolScaleHeightKm: aerosolPolicy.scaleHeightKm,
			aerosolOpticalDepth550Nm: aerosolPolicy.aod550,
			aerosolSingleScatteringAlbedo: aerosolPolicy.singleScatteringAlbedo,
			aerosolAngstromExponent: aerosolPolicy.angstromExponent,
			aerosolPhasePolicyId: aerosolPhasePolicy.id,
			aerosolPhaseKind: aerosolPhasePolicy.kind,
			aerosolPhaseG: aerosolPhasePolicy.parameters.g,
			ozoneDobsonUnits: EARTH_LIKE_SKY.ozoneDobsonUnits,
			ozoneLayerCenterAltitudeKm: EARTH_LIKE_SKY.ozoneLayerCenterAltitudeKm,
			ozoneLayerWidthKm: EARTH_LIKE_SKY.ozoneLayerWidthKm,
			ozoneChappuisMaxCrossSectionCm2: EARTH_LIKE_SKY.ozoneChappuisMaxCrossSectionCm2,
		},
		world: {
			altitudeAt(positionKm) {
				return Math.max(0, length3(subtract3(positionKm, planetCenterKm)) - planetRadiusKm);
			},
			upAt() {
				return [0, 1, 0];
			},
			intersectSurface(ray) {
				const tKm = intersectSphereForward(ray.originKm, ray.direction, planetCenterKm, planetRadiusKm);

				if (!Number.isFinite(tKm)) {
					return null;
				}

				return {
					tKm,
					positionKm: add3(ray.originKm, scale3(ray.direction, tKm)),
					normal: [0, 1, 0],
					boundaryReason: 'earth-like-ground-horizon',
					boundaryId: `${scene.id}.ground`,
				};
			},
			surfaceNormalAt(hit) {
				return normalize3(subtract3(hit.positionKm, planetCenterKm));
			},
		},
		atmosphere: {
			intersect(ray) {
				const tMaxKm = intersectSphereExit(ray.originKm, ray.direction, planetCenterKm, atmosphereRadiusKm);

				return {
					tMinKm: 0,
					tMaxKm,
					boundaryReason: 'earth-like-atmosphere-shell-exit',
					boundaryId: `${scene.id}.sky`,
				};
			},
			contains(positionKm) {
				return length3(subtract3(positionKm, planetCenterKm)) <= atmosphereRadiusKm;
			},
			mediumAt(positionKm, { wavelengthsNm: activeWavelengthsNm = wavelengthsNm } = {}) {
				return earthLikeMediumAt(
					positionKm,
					activeWavelengthsNm,
					planetCenterKm,
					planetRadiusKm,
					rayleighPolicy,
					aerosolPolicy,
					aerosolPhasePolicy,
					ozonePolicy,
					molecularProfilePolicy,
				);
			},
			densityAt() {
				return 1;
			},
			extinctionAt() {
				const mediumState = earthLikeMediumAt(
					[0, 0, 0],
					wavelengthsNm,
					planetCenterKm,
					planetRadiusKm,
					rayleighPolicy,
					aerosolPolicy,
					aerosolPhasePolicy,
					ozonePolicy,
					molecularProfilePolicy,
				);
				return mediumState.species.reduce((total, species) => {
					return total.map((value, index) => value + species.extinctionByWavelength[index]);
				}, wavelengthsNm.map(() => 0));
			},
			scatteringAt() {
				const aerosol = aerosolCoefficientsForPolicy(wavelengthsNm, {
					policyId: aerosolPolicy.id,
					densityScale: 1,
				});

				return {
					rayleigh: rayleighPolicyCoefficients(
						rayleighPolicy,
						wavelengthsNm,
						1,
					),
					mie: aerosol.scatteringByWavelength,
					ozone: ozoneAbsorptionCoefficients(wavelengthsNm, 0, ozonePolicy),
				};
			},
		},
		solarSource: {
			samplesAt() {
				if ((scene.sunElevationDeg ?? 45) <= -6) {
					return [];
				}

				return sourceSamples;
			},
			transmittanceSegment(positionKm, sourceSample, query) {
				const groundHitKm = intersectSphereForward(
					positionKm,
					sourceSample.direction,
					planetCenterKm,
					planetRadiusKm,
				);
				const exitKm = intersectSphereExit(
					positionKm,
					sourceSample.direction,
					planetCenterKm,
					atmosphereRadiusKm,
				);

				if (Number.isFinite(groundHitKm) && groundHitKm < exitKm) {
					return {
						visible: false,
						boundaryReason: 'earth-occluded-sun',
						samples: [],
					};
				}

				const steps = Math.max(1, query.numerical?.sunTransmittanceSteps ?? 1);
				const stepKm = exitKm / steps;

				return {
					visible: true,
					boundaryReason: 'earth-like-atmosphere-source-exit',
					samples: Array.from({ length: steps }, (_, index) => {
						const distanceKm = (index + 0.5) * stepKm;
						const samplePositionKm = add3(positionKm, scale3(sourceSample.direction, distanceKm));
						const mediumState = earthLikeMediumAt(
							samplePositionKm,
							query.wavelengthsNm,
							planetCenterKm,
							planetRadiusKm,
							rayleighPolicy,
							aerosolPolicy,
							aerosolPhasePolicy,
							ozonePolicy,
							molecularProfilePolicy,
						);

						return {
							weightKm: stepKm,
							extinctionByWavelength: mediumState.species.reduce((total, species) => {
								return total.map((value, wavelengthIndex) => {
									return value + species.extinctionByWavelength[wavelengthIndex];
								});
							}, query.wavelengthsNm.map(() => 0)),
						};
					}),
				};
			},
		},
		surface: {
			radianceAt() {
				return wavelengthsNm.map(() => 0);
			},
		},
	};
}

function rayleighPolicyCoefficients(rayleighPolicy, wavelengthsNm, densityScale) {
	return rayleighCoefficientsForPolicy(wavelengthsNm, {
		policyId: rayleighPolicy.id,
		beta550PerKm: EARTH_LIKE_SKY.rayleighBeta550PerKm,
		densityScale,
	}).valuesByWavelength;
}

function earthLikeMediumAt(
	positionKm,
	wavelengthsNm,
	planetCenterKm,
	planetRadiusKm,
	rayleighPolicy,
	aerosolPolicy,
	aerosolPhasePolicy,
	ozonePolicy,
	molecularProfilePolicy,
) {
	const altitudeKm = Math.max(0, length3(subtract3(positionKm, planetCenterKm)) - planetRadiusKm);
	const molecularDensity = molecularDensityScaleForPolicy(altitudeKm, {
		policyId: molecularProfilePolicy.id,
		scaleHeightKm: EARTH_LIKE_SKY.rayleighScaleHeightKm,
	});
	const rayleighDensity = molecularDensity.densityScale;
	const aerosolDensity = Math.exp(-altitudeKm / aerosolPolicy.scaleHeightKm);
	const ozoneDensityPerKm = ozoneProfileDensityPerKm(altitudeKm);
	const rayleigh = rayleighCoefficientsForPolicy(
		wavelengthsNm,
		{
			policyId: rayleighPolicy.id,
			beta550PerKm: EARTH_LIKE_SKY.rayleighBeta550PerKm,
			densityScale: rayleighDensity,
		},
	);
	const rayleighScattering = rayleigh.valuesByWavelength;
	const aerosol = aerosolCoefficientsForPolicy(wavelengthsNm, {
		policyId: aerosolPolicy.id,
		densityScale: aerosolDensity,
	});
	const aerosolExtinction = aerosol.extinctionByWavelength;
	const aerosolScattering = aerosol.scatteringByWavelength;
	const aerosolAbsorption = aerosol.absorptionByWavelength;
	const ozone = ozoneAbsorptionCoefficients(wavelengthsNm, altitudeKm, ozonePolicy);
	const ozoneAbsorption = ozone.valuesByWavelength;

	return {
		profile: {
			altitudeKm,
			rayleighDensity,
			rayleighPolicy: rayleigh.provenance,
			molecularProfile: molecularDensity.provenance,
			aerosolDensity,
			aerosolPolicy: aerosol.provenance,
			aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
			ozoneDensityPerKm,
			ozonePolicy: ozone.provenance,
		},
		species: [
			{
				name: 'rayleigh',
				extinctionByWavelength: rayleighScattering,
				scatteringByWavelength: rayleighScattering,
				absorptionByWavelength: wavelengthsNm.map(() => 0),
				phase: { kind: 'rayleigh' },
			},
			{
				name: 'mie',
				extinctionByWavelength: aerosolExtinction,
				scatteringByWavelength: aerosolScattering,
				absorptionByWavelength: aerosolAbsorption,
				phase: {
					kind: aerosolPhasePolicy.kind,
					parameters: { ...aerosolPhasePolicy.parameters },
				},
			},
			{
				name: 'ozone',
				extinctionByWavelength: ozoneAbsorption,
				scatteringByWavelength: wavelengthsNm.map(() => 0),
				absorptionByWavelength: ozoneAbsorption,
			},
		],
	};
}

function ozoneAbsorptionCoefficients(wavelengthsNm, altitudeKm, ozonePolicy) {
	const columnMoleculesPerCm2 = EARTH_LIKE_SKY.ozoneDobsonUnits * 2.687e16;
	const profileDensityPerKm = ozoneProfileDensityPerKm(altitudeKm);
	const crossSections = ozoneCrossSectionsForPolicy(wavelengthsNm, {
		policyId: ozonePolicy.id,
	});

	return {
		valuesByWavelength: crossSections.valuesByWavelength.map((crossSectionCm2) => {
			return columnMoleculesPerCm2
				* crossSectionCm2
				* profileDensityPerKm;
		}),
		provenance: {
			...crossSections.provenance,
			columnDobsonUnits: EARTH_LIKE_SKY.ozoneDobsonUnits,
			profile: {
				kind: 'preview-gaussian-layer',
				centerAltitudeKm: EARTH_LIKE_SKY.ozoneLayerCenterAltitudeKm,
				widthKm: EARTH_LIKE_SKY.ozoneLayerWidthKm,
			},
			units: '1/km',
		},
	};
}

function ozoneProfileDensityPerKm(altitudeKm) {
	const widthKm = EARTH_LIKE_SKY.ozoneLayerWidthKm;
	const offset = (altitudeKm - EARTH_LIKE_SKY.ozoneLayerCenterAltitudeKm) / widthKm;

	return Math.exp(-0.5 * offset * offset) / (widthKm * Math.sqrt(2 * Math.PI));
}

function summarizeAerosolPhasePolicy(aerosolPhasePolicy) {
	return {
		id: aerosolPhasePolicy.id,
		label: aerosolPhasePolicy.label,
		kind: aerosolPhasePolicy.kind,
		parameters: { ...aerosolPhasePolicy.parameters },
		source: aerosolPhasePolicy.source,
		provenance: { ...aerosolPhasePolicy.provenance },
	};
}

function createSkyPatchModelMetadata(
	rayleighPolicy,
	aerosolPolicy,
	aerosolPhasePolicy,
	ozonePolicy,
	molecularProfilePolicy,
) {
	return {
		kind: 'earth-like-sky-preview',
		parameters: {
			planetRadiusKm: EARTH_LIKE_SKY.planetRadiusKm,
			atmosphereTopAltitudeKm: EARTH_LIKE_SKY.atmosphereTopAltitudeKm,
			rayleighScaleHeightKm: EARTH_LIKE_SKY.rayleighScaleHeightKm,
			rayleighBeta550PerKm: EARTH_LIKE_SKY.rayleighBeta550PerKm,
			aerosolScaleHeightKm: aerosolPolicy.scaleHeightKm,
			aerosolOpticalDepth550Nm: aerosolPolicy.aod550,
			aerosolSingleScatteringAlbedo: aerosolPolicy.singleScatteringAlbedo,
			aerosolAngstromExponent: aerosolPolicy.angstromExponent,
			aerosolPhasePolicyId: aerosolPhasePolicy.id,
			aerosolPhaseKind: aerosolPhasePolicy.kind,
			aerosolPhaseG: aerosolPhasePolicy.parameters.g,
			ozoneDobsonUnits: EARTH_LIKE_SKY.ozoneDobsonUnits,
			ozoneLayerCenterAltitudeKm: EARTH_LIKE_SKY.ozoneLayerCenterAltitudeKm,
			ozoneLayerWidthKm: EARTH_LIKE_SKY.ozoneLayerWidthKm,
			ozoneChappuisMaxCrossSectionCm2: EARTH_LIKE_SKY.ozoneChappuisMaxCrossSectionCm2,
			solarTemperatureK: EARTH_LIKE_SKY.solarTemperatureK,
			solarIrradiance550Wm2Nm: EARTH_LIKE_SKY.solarIrradiance550Wm2Nm,
		},
		rayleighPolicy: {
			id: rayleighPolicy.id,
			label: rayleighPolicy.label,
			source: rayleighPolicy.source,
			doi: rayleighPolicy.doi ?? null,
			coefficientModel: rayleighPolicy.coefficientModel,
			defaultPolicy: DEFAULT_RAYLEIGH_POLICY_ID,
		},
		aerosolPolicy: {
			id: aerosolPolicy.id,
			label: aerosolPolicy.label,
			source: aerosolPolicy.source,
			aod550: aerosolPolicy.aod550,
			angstromExponent: aerosolPolicy.angstromExponent,
			singleScatteringAlbedo: aerosolPolicy.singleScatteringAlbedo,
			defaultPhasePolicyId: aerosolPolicy.defaultPhasePolicyId,
			scaleHeightKm: aerosolPolicy.scaleHeightKm,
			defaultPolicy: DEFAULT_AEROSOL_POLICY_ID,
		},
		aerosolPhasePolicy: summarizeAerosolPhasePolicy(aerosolPhasePolicy),
		ozonePolicy: {
			id: ozonePolicy.id,
			label: ozonePolicy.label,
			source: ozonePolicy.source,
			atlasDoi: ozonePolicy.atlasDoi ?? null,
			crossSectionModel: ozonePolicy.crossSectionModel,
			defaultPolicy: DEFAULT_OZONE_POLICY_ID,
			columnDobsonUnits: EARTH_LIKE_SKY.ozoneDobsonUnits,
			profile: {
				kind: 'preview-gaussian-layer',
				centerAltitudeKm: EARTH_LIKE_SKY.ozoneLayerCenterAltitudeKm,
				widthKm: EARTH_LIKE_SKY.ozoneLayerWidthKm,
			},
		},
		phaseFunctions: {
			rayleigh: 'rayleigh',
			aerosol: aerosolPhasePolicy.kind,
		},
		molecularProfile: {
			id: molecularProfilePolicy.id,
			label: molecularProfilePolicy.label,
			source: molecularProfilePolicy.source,
			nasaNtrsRecord: molecularProfilePolicy.nasaNtrsRecord ?? null,
			defaultPolicy: DEFAULT_MOLECULAR_PROFILE_POLICY_ID,
		},
		solarSpectrumPolicies: {
			default: DEFAULT_SOLAR_SPECTRUM_POLICY,
			options: ['blackbody-5778k', 'astm-g173'],
		},
		absorbers: {
			ozone: ozonePolicy.id,
		},
		note: 'Shared Earth-like preview inputs; colors are not hand-tuned per scene.',
	};
}

function intersectSphereForward(originKm, direction, centerKm, radiusKm) {
	const roots = intersectSphereRoots(originKm, direction, centerKm, radiusKm);
	const positive = roots.filter((value) => value > 1e-6);
	return positive.length > 0 ? Math.min(...positive) : Infinity;
}

function intersectSphereExit(originKm, direction, centerKm, radiusKm) {
	const roots = intersectSphereRoots(originKm, direction, centerKm, radiusKm);
	const positive = roots.filter((value) => value > 1e-6);
	return positive.length > 0 ? Math.max(...positive) : 0;
}

function intersectSphereRoots(originKm, direction, centerKm, radiusKm) {
	const oc = subtract3(originKm, centerKm);
	const b = 2 * dot3(oc, direction);
	const c = dot3(oc, oc) - radiusKm * radiusKm;
	const discriminant = b * b - 4 * c;

	if (discriminant < 0) {
		return [];
	}

	const root = Math.sqrt(discriminant);
	return [(-b - root) / 2, (-b + root) / 2];
}

function loadRunDefinition(options) {
	if (!options.configPath) {
		return createBuiltInRunDefinition();
	}

	const configPath = path.resolve(options.configPath);
	const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

	return {
		...createBuiltInRunDefinition(),
		...config,
		configPath,
		numerical: {
			...DEFAULT_NUMERICAL,
			...(config.numerical ?? {}),
		},
	};
}

function createBuiltInRunDefinition() {
	return {
		kind: 'flat-atmosphere-reference-run',
		id: 'built-in-controlled-visual-evidence',
		model: 'controlled-stage-smoke-model',
		wavelengthsNm: [...DEFAULT_WAVELENGTHS_NM],
		numerical: { ...DEFAULT_NUMERICAL },
		probes: Object.values(BUILT_IN_PROBES).map((probe) => ({
			id: probe.id,
			preset: probe.id,
		})),
	};
}

function selectProbeDefinitions(runDefinition, probeIds) {
	const available = new Map();

	for (const probe of runDefinition.probes ?? []) {
		const definition = materializeProbeDefinition(probe);
		available.set(definition.id, definition);
	}

	const selectedIds = probeIds.length > 0 ? probeIds : [...available.keys()];

	return selectedIds.map((id) => {
		const probe = available.get(id) ?? materializeProbeDefinition({ id, preset: id });

		if (!probe) {
			throw new Error(`Unknown reference probe: ${id}`);
		}

		return mergeRunDefaults(runDefinition, probe);
	});
}

function materializeProbeDefinition(probe) {
	const preset = probe.preset ? BUILT_IN_PROBES[probe.preset] : BUILT_IN_PROBES[probe.id];

	if (!preset && Object.keys(probe).length <= 2) {
		return undefined;
	}

	return {
		...(preset ?? {}),
		...probe,
		id: probe.id ?? preset.id,
		label: probe.label ?? preset?.label ?? probe.id,
		description: probe.description ?? preset?.description ?? '',
	};
}

function mergeRunDefaults(runDefinition, probe) {
	return {
		...probe,
		wavelengthsNm: expandWavelengths(probe.wavelengthsNm ?? runDefinition.wavelengthsNm),
		numerical: {
			...runDefinition.numerical,
			...(probe.numerical ?? {}),
		},
		modelId: probe.modelId ?? runDefinition.model ?? 'controlled-stage-smoke-model',
	};
}

function expandWavelengths(wavelengthsNm) {
	if (Array.isArray(wavelengthsNm)) {
		return wavelengthsNm;
	}

	if (
		wavelengthsNm
		&& Number.isFinite(wavelengthsNm.start)
		&& Number.isFinite(wavelengthsNm.end)
		&& Number.isFinite(wavelengthsNm.step)
		&& wavelengthsNm.step > 0
	) {
		const values = [];

		for (let value = wavelengthsNm.start; value <= wavelengthsNm.end + wavelengthsNm.step / 1000; value += wavelengthsNm.step) {
			values.push(Number(value.toPrecision(12)));
		}

		return values;
	}

	throw new Error('wavelengthsNm must be an array or { start, end, step }');
}

function runOneProbe(probeDefinition, runDefinition, stage) {
	const request = createProbeRequest(probeDefinition);
	const integrator = new CpuSpectralReferenceIntegrator();
	const packet = stage === DEFAULT_STAGE
		? integrator.traceRay(request)
		: integrator.runUntil(stage, request);
	const summary = summarizePacket(packet, probeDefinition);

	return {
		id: probeDefinition.id,
		label: probeDefinition.label,
		description: probeDefinition.description,
		modelId: probeDefinition.modelId,
		stage,
		request: {
			observer: request.observer,
			ray: request.ray,
			wavelengthsNm: request.wavelengthsNm,
			numerical: request.numerical,
		},
		summary,
		result: serializePacket(packet),
	};
}

function createProbeRequest(probeDefinition) {
	return {
		model: createControlledModel(probeDefinition),
		observer: probeDefinition.observer ?? { positionKm: [0, 0, 0] },
		ray: probeDefinition.ray ?? { direction: [0, 1, 0] },
		wavelengthsNm: probeDefinition.wavelengthsNm,
		numerical: probeDefinition.numerical,
	};
}

function createControlledModel(probeDefinition) {
	const wavelengthsNm = probeDefinition.wavelengthsNm;
	const surfaceDistanceKm = probeDefinition.surfaceDistanceKm;
	const viewDistanceKm = probeDefinition.viewDistanceKm ?? surfaceDistanceKm ?? 16;
	const surfaceHit = Number.isFinite(surfaceDistanceKm)
		? {
			tKm: surfaceDistanceKm,
			positionKm: [0, surfaceDistanceKm, 0],
			normal: [0, -1, 0],
			boundaryReason: probeDefinition.boundaryReason ?? 'controlled-surface-hit',
			boundaryId: `${probeDefinition.id}.surface`,
		}
		: null;

	return {
		id: probeDefinition.modelId,
		physicalConstants: {
			atmosphereTopKm: viewDistanceKm,
		},
		world: {
			altitudeAt(positionKm) {
				return Math.max(0, positionKm[1] ?? 0);
			},
			upAt() {
				return [0, 1, 0];
			},
			intersectSurface() {
				return surfaceHit;
			},
			surfaceNormalAt(hit) {
				return hit.normal ?? [0, -1, 0];
			},
		},
		atmosphere: {
			intersect() {
				return {
					tMinKm: 0,
					tMaxKm: viewDistanceKm,
					boundaryReason: probeDefinition.boundaryReason ?? 'controlled-atmosphere-exit',
					boundaryId: `${probeDefinition.id}.atmosphere`,
					metadata: {
						modelKind: 'controlled-visual-evidence',
					},
				};
			},
			contains() {
				return true;
			},
			mediumAt(positionKm, { wavelengthsNm: activeWavelengthsNm } = {}) {
				const coefficients = rayleighLikeCoefficients(
					activeWavelengthsNm ?? wavelengthsNm,
					probeDefinition.rayleighScattering550PerKm ?? 0,
				);

				return {
					profile: {
						altitudeRule: 'controlled-y-coordinate',
						densityKgPerM3: 1,
					},
					species: [
						{
							name: 'rayleigh',
							extinctionByWavelength: coefficients.extinctionByWavelength,
							scatteringByWavelength: coefficients.scatteringByWavelength,
							absorptionByWavelength: coefficients.absorptionByWavelength,
							phase: {
								kind: 'isotropic',
								parameters: {
									note: 'controlled smoke probe keeps isotropic phase; sky patches use the Earth-like phase metadata.',
								},
							},
						},
					],
				};
			},
			densityAt() {
				return 1;
			},
			extinctionAt() {
				return rayleighLikeCoefficients(
					wavelengthsNm,
					probeDefinition.rayleighScattering550PerKm ?? 0,
				).extinctionByWavelength;
			},
			scatteringAt() {
				const scattering = rayleighLikeCoefficients(
					wavelengthsNm,
					probeDefinition.rayleighScattering550PerKm ?? 0,
				).scatteringByWavelength;
				return { rayleigh: scattering };
			},
		},
		solarSource: {
			samplesAt(positionKm, wavelengthNm, numerical) {
				return [
					{
						id: 'controlled-sun',
						direction: probeDefinition.sourceDirection ?? [0, -1, 0],
						weight: probeDefinition.sourceWeight ?? 1,
						solidAngleSr: probeDefinition.solidAngleSr ?? 1,
						sourceSpectrum: {
							kind: 'spectral-irradiance',
							valuesByWavelength: sourceSpectrumValues(probeDefinition, wavelengthsNm),
							units: 'controlled W m-2 nm-1 equivalent',
							derivation: 'Controlled visual evidence probe with an explicit source-spectrum scale.',
						},
					},
				];
			},
			transmittanceSegment(positionKm, sourceSample, query) {
				const sourcePathKm = probeDefinition.sourcePathKm ?? 0;
				const coefficients = rayleighLikeCoefficients(
					query.wavelengthsNm,
					(probeDefinition.rayleighScattering550PerKm ?? 0)
						* (probeDefinition.sourceExtinctionScale ?? 1),
				);

				return {
					visible: true,
					boundaryReason: 'controlled-source-path',
					samples: sourcePathKm > 0
						? [{
							weightKm: sourcePathKm,
							extinctionByWavelength: coefficients.extinctionByWavelength,
						}]
						: [],
				};
			},
		},
		surface: {
			radianceAt(hit, wavelengthNm, lighting) {
				const albedo = probeDefinition.surfaceAlbedoByWavelength
					?? wavelengthsNm.map(() => 1);

				return lighting.directIrradianceByWavelength.map((direct, index) => {
					return albedo[index] * direct * lighting.directCosTheta / Math.PI;
				});
			},
		},
	};
}

function rayleighLikeCoefficients(wavelengthsNm, scattering550PerKm) {
	const scatteringByWavelength = wavelengthsNm.map((wavelengthNm) => {
		return scattering550PerKm * (550 / wavelengthNm) ** 4;
	});
	const absorptionByWavelength = wavelengthsNm.map(() => 0);

	return {
		extinctionByWavelength: [...scatteringByWavelength],
		scatteringByWavelength,
		absorptionByWavelength,
	};
}

function sourceSpectrumValues(probeDefinition, wavelengthsNm) {
	if (Array.isArray(probeDefinition.sourceSpectrumByWavelength)) {
		return probeDefinition.sourceSpectrumByWavelength;
	}

	const scale = probeDefinition.sourceSpectrumScale ?? 1;
	return wavelengthsNm.map(() => scale);
}

function summarizePacket(packet, probeDefinition) {
	const wavelengthsNm = packet.validatedRequest?.wavelengthsNm ?? probeDefinition.wavelengthsNm;
	const spectralRadiance = packet.spectralRadiance?.finalByWavelength
		?? wavelengthsNm.map(() => 0);
	const components = packet.spectralRadiance?.components ?? {};
	const pathEnd = packet.viewOpticalDepth?.pathEnd;

	return {
		wavelengthsNm,
		stageHistory: packet.stageHistory ?? [],
		boundaryReason: packet.rayPath?.boundaryReason ?? null,
		boundaryId: packet.rayPath?.boundaryId ?? null,
		viewDistanceKm: packet.rayPath?.viewSegment?.lengthKm ?? null,
		sampleCount: packet.viewSampleMetadata?.sampleCount ?? packet.mediumSamples?.length ?? 0,
		finalByWavelength: spectralRadiance,
		inScatteredRadianceByWavelength: components.inScatteredRadianceByWavelength
			?? packet.singleScattering?.inScatteredRadianceByWavelength
			?? wavelengthsNm.map(() => 0),
		surfaceViewAttenuatedRadianceByWavelength: components.surfaceViewAttenuatedRadianceByWavelength
			?? packet.surfaceRadiance?.viewAttenuatedRadianceByWavelength
			?? wavelengthsNm.map(() => 0),
		viewOpticalDepthByWavelength: pathEnd?.cumulativeOpticalDepthByWavelength ?? null,
		viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
		sourceSampleCount: packet.solarTransmittance?.metadata?.sourceSampleCount ?? 0,
		surfaceHit: packet.rayPath?.surfaceHit
			? {
				tKm: packet.rayPath.surfaceHit.tKm,
				boundaryReason: packet.rayPath.surfaceHit.boundaryReason,
			}
			: null,
	};
}

function serializePacket(packet) {
	const json = JSON.stringify(packet, (key, value) => {
		if (typeof value === 'function') {
			return undefined;
		}

		if (key === 'model') {
			return value?.id ? { id: value.id } : undefined;
		}

		return value;
	});

	return JSON.parse(json);
}

function computeVisualScale(probes) {
	const maxValue = probes.reduce((max, probe) => {
		const rgb = spectralToDebugRgb(probe.summary.finalByWavelength, probe.summary.wavelengthsNm);
		return Math.max(max, rgb.r, rgb.g, rgb.b);
	}, 0);

	return maxValue > 0 ? 1 / maxValue : 1;
}

function createVisualSummary(finalByWavelength, wavelengthsNm, scale) {
	const linearRgb = spectralToDebugRgb(finalByWavelength, wavelengthsNm);
	const pixel = linearRgbToPixel(linearRgb, {
		encoding: 'srgb',
		exposure: scale,
	});

	return {
		linearDebugRgb: linearRgb,
		exposedDebugRgb: pixel.exposedLinearRgb,
		displayDebugRgb: pixel.displayRgb,
		hex: pixel.hex,
	};
}

function spectralToDebugRgb(values, wavelengthsNm) {
	return {
		r: values[nearestWavelengthIndex(wavelengthsNm, DEBUG_RGB_WAVELENGTHS.r)] ?? 0,
		g: values[nearestWavelengthIndex(wavelengthsNm, DEBUG_RGB_WAVELENGTHS.g)] ?? 0,
		b: values[nearestWavelengthIndex(wavelengthsNm, DEBUG_RGB_WAVELENGTHS.b)] ?? 0,
	};
}

function nearestWavelengthIndex(wavelengthsNm, target) {
	let bestIndex = 0;
	let bestDistance = Infinity;

	for (const [index, wavelengthNm] of wavelengthsNm.entries()) {
		const distance = Math.abs(wavelengthNm - target);
		if (distance < bestDistance) {
			bestIndex = index;
			bestDistance = distance;
		}
	}

	return bestIndex;
}

export function buildMarkdownReport(result, { imagePath, outPath, reportPath } = {}) {
	if (Array.isArray(result.lightExtents)) {
		return buildLightExtentMarkdownReport(result, { imagePath, outPath, reportPath });
	}

	if (Array.isArray(result.skyPatches)) {
		return buildSkyPatchMarkdownReport(result, { imagePath, outPath, reportPath });
	}

	if (Array.isArray(result.skyDomePanels)) {
		return buildSkyDomeGridMarkdownReport(result, { imagePath, outPath, reportPath });
	}

	const imageLink = imagePath
		? `\n![Visual probe summary](${relativeReportPath(imagePath, reportPath)})\n`
		: '';
	const jsonLink = outPath ? `\nJSON output: \`${relativeReportPath(outPath, reportPath)}\`\n` : '';
	const rows = result.probes.map((probe) => {
		return [
			probe.id,
			`<span style="display:inline-block;width:48px;height:18px;background:${probe.visual.hex};border:1px solid #777"></span> \`${probe.visual.hex}\``,
			formatNumber(probe.summary.viewDistanceKm),
			formatArray(probe.summary.finalByWavelength),
			formatArray(probe.summary.viewTransmittanceByWavelength),
		].join(' | ');
	});

	return [
		'# Atmosphere Reference Visual Evidence',
		'',
		'This report is generated by `scripts/flat/atmosphere_rejected/run-reference-probe.js`.',
		'',
		'The color swatches use a debug display mapping: nearest `650/550/450 nm` samples become `R/G/B`, with one run-wide scale and simple gamma encoding. This is visual evidence for transport shape, not final CIE/display colorimetry.',
		imageLink,
		jsonLink,
		`Stage: \`${result.stage}\``,
		`Probe count: \`${result.probeCount}\``,
		`Visual scale: \`${formatNumber(result.visual.scale)}\``,
		'',
		'| Probe | Debug swatch | View km | Final spectral radiance | View transmittance |',
		'| --- | --- | ---: | --- | --- |',
		...rows.map((row) => `| ${row} |`),
		'',
		'## Probe Notes',
		'',
		...result.probes.flatMap((probe) => [
			`### ${probe.id}`,
			'',
			probe.description,
			'',
			`- Model: \`${probe.modelId}\``,
			`- Boundary: \`${probe.summary.boundaryReason ?? 'none'}\``,
			`- Samples: \`${probe.summary.sampleCount}\``,
			`- In-scattering: \`${formatArray(probe.summary.inScatteredRadianceByWavelength)}\``,
			`- Surface: \`${formatArray(probe.summary.surfaceViewAttenuatedRadianceByWavelength)}\``,
			'',
		]),
	].join('\n');
}

export function buildSvg(result) {
	if (Array.isArray(result.lightExtents)) {
		return buildLightExtentSvg(result);
	}

	if (Array.isArray(result.skyPatches)) {
		return buildSkyPatchSvg(result);
	}

	if (Array.isArray(result.skyDomePanels)) {
		return buildSkyDomeGridSvg(result);
	}

	const rowHeight = 112;
	const width = 980;
	const height = 80 + result.probes.length * rowHeight;
	const maxFinal = Math.max(
		1e-9,
		...result.probes.flatMap((probe) => probe.summary.finalByWavelength),
	);
	const rows = result.probes.map((probe, index) => {
		const y = 62 + index * rowHeight;
		return [
			`<text x="24" y="${y}" class="title">${escapeXml(probe.id)}</text>`,
			`<text x="24" y="${y + 22}" class="muted">${escapeXml(probe.label)}</text>`,
			`<rect x="300" y="${y - 22}" width="84" height="64" rx="4" fill="${probe.visual.hex}" stroke="#555"/>`,
			...spectrumBars(probe.summary.finalByWavelength, maxFinal, 430, y - 18, '#4b8cff'),
			...spectrumBars(probe.summary.inScatteredRadianceByWavelength, maxFinal, 610, y - 18, '#6ec6ff'),
			...spectrumBars(probe.summary.surfaceViewAttenuatedRadianceByWavelength, maxFinal, 790, y - 18, '#f26b6b'),
			`<text x="430" y="${y + 52}" class="muted">final</text>`,
			`<text x="610" y="${y + 52}" class="muted">airlight</text>`,
			`<text x="790" y="${y + 52}" class="muted">surface</text>`,
		].join('\n');
	}).join('\n');

	return [
		'<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
		'<style>',
		'text{font-family:Arial,Helvetica,sans-serif;fill:#1f2933}.title{font-size:18px;font-weight:700}.muted{font-size:12px;fill:#5f6b7a}.heading{font-size:22px;font-weight:700}',
		'</style>',
		'<rect width="100%" height="100%" fill="#f7f9fb"/>',
		'<text x="24" y="34" class="heading">Atmosphere Reference Visual Evidence</text>',
		'<text x="430" y="34" class="muted">Debug RGB: 650/550/450 nm -> R/G/B, run-wide scaled</text>',
		rows,
		'</svg>',
	].join('\n');
}

export function buildImageArtifact(result, imagePath) {
	if (imagePath) {
		const extension = path.extname(imagePath).toLowerCase();

		if (extension === '.ppm') {
			return buildPpm(result);
		}

		if (extension === '.png') {
			return buildPng(result);
		}
	}

	return `${buildSvg(result)}\n`;
}

export function buildPng(result) {
	return pixelImageToPng(composeReferencePixelImage(result, 'PNG'));
}

export function buildPpm(result) {
	return pixelImageToPpm(composeReferencePixelImage(result, 'PPM'));
}

export function buildMultipleScatteringImageArtifacts(result) {
	const sidecar = result.multipleScatteringReference;

	if (!Array.isArray(result.skyDomePanels)) {
		throw new Error('multiple-scattering image artifacts require --sky-dome-grid results');
	}

	if (sidecar?.mode !== 'iterative-field-grid' || !Array.isArray(sidecar.fieldScenes)) {
		throw new Error('multiple-scattering image artifacts require iterative-field-grid sidecar panels');
	}

	const fieldSceneById = new Map(sidecar.fieldScenes.map((scene) => [scene.scenarioId, scene]));
	const orderedFieldScenes = result.skyDomePanels.map((panel) => {
		const scene = fieldSceneById.get(panel.id);

		if (!scene) {
			throw new Error(`multiple-scattering image artifacts missing field scene for ${panel.id}`);
		}

		return scene;
	});
	const baselineColumn = {
		relativePath: 'baseline-canonical.png',
		label: 'Baseline canonical single scattering',
		pixelImage: composeSkyDomeGridPixelImage(result, 'multiple-scattering baseline image artifact'),
	};
	const comparisonPanelIds = orderedFieldScenes[0]?.comparisonPanels?.map((panel) => panel.id) ?? [];
	const sidecarColumns = comparisonPanelIds.map((panelId) => {
		const panels = orderedFieldScenes.map((scene) => {
			const panel = scene.comparisonPanels?.find((candidate) => candidate.id === panelId);

			if (!panel) {
				throw new Error(`multiple-scattering image artifacts missing ${panelId} for ${scene.scenarioId}`);
			}

			return overlayFieldPanelSunCross(panel.pixelImage, scene.scenarioId);
		});
		const label = orderedFieldScenes[0].comparisonPanels.find((panel) => panel.id === panelId)?.label ?? panelId;

		return {
			relativePath: `${panelId}.png`,
			label,
			pixelImage: stackPixelImagesVertically(panels, `multiple-scattering ${panelId} image artifact`),
		};
	});
	const columns = [baselineColumn, ...sidecarColumns];
	const contactSheet = {
		relativePath: 'sidecar-skydome-set.png',
		label: 'Baseline and iterative-field sidecar skydome set',
		pixelImage: composeHorizontalPixelImages(
			columns.map((column) => column.pixelImage),
			'multiple-scattering sidecar skydome set image artifact',
		),
	};
	const sceneRows = result.skyDomePanels.map((panel, sceneIndex) => {
		const scene = orderedFieldScenes[sceneIndex];
		const images = [
			panel.pixelImage,
			...(scene.comparisonPanels ?? []).map((comparisonPanel) => {
				return overlayFieldPanelSunCross(comparisonPanel.pixelImage, scene.scenarioId);
			}),
		];

		return {
			relativePath: `scene-${String(sceneIndex + 1).padStart(2, '0')}-${fileSafeSlug(panel.id)}.png`,
			label: `${panel.label} baseline and sidecar orders`,
			pixelImage: composeHorizontalPixelImages(
				images,
				`multiple-scattering ${panel.id} image artifact`,
			),
		};
	});
	const imageArtifacts = [contactSheet, ...columns, ...sceneRows].map((artifact) => ({
		relativePath: artifact.relativePath,
		label: artifact.label,
		contents: pixelImageToPng(artifact.pixelImage),
	}));
	const readme = buildMultipleScatteringImageReadme({
		result,
		sidecar,
		contactSheet,
		columns,
		sceneRows,
	});

	return {
		kind: 'flat-atmosphere-multiple-scattering-image-artifacts',
		mode: sidecar.mode,
		files: [
			...imageArtifacts,
			{
				relativePath: 'README.md',
				label: 'Artifact index',
				contents: `${readme}\n`,
			},
		],
	};
}

export function writeMultipleScatteringImageArtifacts(result, outputDir) {
	const artifactSet = buildMultipleScatteringImageArtifacts(result);

	fs.mkdirSync(path.resolve(outputDir), { recursive: true });
	for (const file of artifactSet.files) {
		writeFileEnsuringDirectory(path.join(outputDir, file.relativePath), file.contents);
	}

	return artifactSet;
}

function overlayFieldPanelSunCross(pixelImage, scenarioId) {
	const scene = SKY_DOME_GRID_SCENES.find((candidate) => candidate.id === scenarioId);

	if (!scene) {
		return pixelImage;
	}

	const sunDirection = directionFromElevationAzimuth(scene.sunElevationDeg, scene.sunAzimuthDeg);
	const sunMarker = skyDomePixelForDirection(sunDirection, pixelImage.width);

	return overlaySunCross(pixelImage, sunMarker, pixelImage.encoding);
}

function buildMultipleScatteringImageReadme({
	result,
	sidecar,
	contactSheet,
	columns,
	sceneRows,
}) {
	return [
		'# Multiple-Scattering Sidecar Skydome Images',
		'',
		'This artifact set exports the current iterative-field multiple-scattering sidecar as real PNG skydome images.',
		'',
		'Important: these images are diagnostic sidecar output. They do not replace canonical `spectralRadiance.finalByWavelength`.',
		'',
		`Mode: \`${sidecar.mode}\``,
		`Status: \`${sidecar.status}\``,
		`Convergence: max order \`${sidecar.convergence?.maxOrder ?? 'n/a'}\`, last-order fraction \`${formatPercent(sidecar.convergence?.lastOrderFraction)}\`, threshold \`${formatPercent(sidecar.convergence?.thresholdFraction)}\`, converged \`${sidecar.convergence?.converged ?? 'n/a'}\``,
		`Field grid: altitude grid \`${sidecar.diagnostics?.fieldAltitudeGrid ?? 'n/a'}\`, altitude layers \`${sidecar.diagnostics?.altitudeLayerCount ?? 'n/a'}\`, direction basis \`${sidecar.diagnostics?.fieldDirectionBasis ?? 'n/a'}\`, requested directions \`${sidecar.diagnostics?.requestedAngularSampleCount ?? sidecar.diagnostics?.angularSampleCount ?? 'n/a'}\`, resolved directions \`${sidecar.diagnostics?.angularSampleCount ?? 'n/a'}\`, weight error \`${formatPercent(sidecar.diagnostics?.fieldDirectionWeightRelativeError)}\`, lookup \`${sidecar.diagnostics?.fieldDirectionPolicy ?? 'n/a'}\``,
		`Rendered dome size: \`${result.visual?.domeSize ?? result.skyDomePanels?.[0]?.size?.width ?? 'n/a'} px\``,
		'',
		`![${contactSheet.label}](${contactSheet.relativePath})`,
		'',
		'## Columns',
		'',
		'| File | Contents |',
		'| --- | --- |',
		...columns.map((artifact) => `| [${artifact.relativePath}](${artifact.relativePath}) | ${artifact.label} |`),
		'',
		'## Scene Rows',
		'',
		'Each scene row places the baseline panel first, then the sidecar accumulated-order panels.',
		'',
		'## Image Metrics',
		'',
		'Metrics are measured before the display-only Sun marker overlay.',
		'',
		...formatMultipleScatteringImageReadmeMetrics(result, sidecar),
		'',
		'## Dense Cached L1 Image Reconstruction',
		'',
		'This compares cached field `L1` against canonical direct `L1` over every in-dome image pixel.',
		'',
		...formatMultipleScatteringImageReconstructionReadme(sidecar),
		'',
		'| File | Contents |',
		'| --- | --- |',
		...sceneRows.map((artifact) => `| [${artifact.relativePath}](${artifact.relativePath}) | ${artifact.label} |`),
		'',
	].join('\n');
}

function formatMultipleScatteringImageReconstructionReadme(sidecar) {
	return (sidecar.fieldScenes ?? []).flatMap((scene) => {
		const reconstruction = scene.imageReconstruction;

		if (!reconstruction) {
			return [
				`### ${scene.label}`,
				'',
				'No dense image reconstruction data available.',
				'',
			];
		}

		return [
			`### ${scene.label}`,
			'',
			`Pixels: \`${reconstruction.comparedPixelCount}\`, mean error \`${formatPercent(reconstruction.aggregate?.meanRelativeSpectralEnergyError)}\`, max \`${formatPercent(reconstruction.aggregate?.maxRelativeSpectralEnergyError)}\`, mean luminance error \`${formatPercent(reconstruction.aggregate?.meanLinearLuminanceRelativeError)}\``,
			'',
			'| Radius band | Pixels | Mean spectral-energy error | Max spectral-energy error | Mean luminance error |',
			'| --- | ---: | ---: | ---: | ---: |',
			...(reconstruction.byRadiusBand ?? []).map((row) => {
				return `| ${[
					row.radiusBand,
					row.comparedSampleCount,
					formatPercent(row.meanRelativeSpectralEnergyError),
					formatPercent(row.maxRelativeSpectralEnergyError),
					formatPercent(row.meanLinearLuminanceRelativeError),
				].join(' | ')} |`;
			}),
			'',
		];
	});
}

function formatMultipleScatteringImageReadmeMetrics(result, sidecar) {
	return (sidecar.fieldScenes ?? []).flatMap((scene) => {
		const baselinePanel = result.skyDomePanels?.find((panel) => panel.id === scene.scenarioId);
		const rows = [
			...(baselinePanel
				? [formatImageMetricRow('Canonical L1', baselinePanel.modelComparisonMetrics)]
				: []),
			...(scene.comparisonPanels ?? []).map((panel) => {
				return formatImageMetricRow(panel.label, panel.modelComparisonMetrics);
			}),
		];

		return [
			`### ${scene.label}`,
			'',
			'| Panel | Warm area | Non-blue area | Horizon lum | Horizon sat | Zenith lum | Zenith sat | Horizon/zenith lum | Sun-neighborhood warm |',
			'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
			...rows.map((row) => `| ${row} |`),
			'',
		];
	});
}

function formatImageMetricRow(label, metrics) {
	return [
		label,
		formatPercent(metrics?.warmAffectedFraction),
		formatPercent(metrics?.nonBlueAffectedFraction),
		formatNumber(metrics?.horizonRing?.luminance?.average),
		formatNumber(metrics?.horizonRing?.saturation?.average),
		formatNumber(metrics?.zenithDisk?.luminance?.average),
		formatNumber(metrics?.zenithDisk?.saturation?.average),
		formatNumber(metrics?.zenithToHorizon?.luminanceRatio),
		formatPercent(metrics?.sunNeighborhood10Deg?.warmAffectedFraction),
	].join(' | ');
}

function fileSafeSlug(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		|| 'artifact';
}

function composeReferencePixelImage(result, artifactLabel) {
	if (Array.isArray(result.skyDomePanels)) {
		return composeSkyDomeGridPixelImage(result, artifactLabel);
	}

	return composeSkyPatchPixelImage(result, artifactLabel);
}

function composeSkyPatchPixelImage(result, artifactLabel) {
	if (!Array.isArray(result.skyPatches)) {
		throw new Error(`${artifactLabel} image artifacts are currently available for --sky-patches results`);
	}

	if (result.skyPatches.length === 0) {
		throw new Error(`${artifactLabel} image artifact requires at least one sky patch`);
	}

	if (result.visual?.sunVisual?.mode === 'diagnostic') {
		return composeSunDiagnosticPixelImage(result, artifactLabel);
	}

	const patchImages = result.skyPatches.map((patch) => patch.pixelImage);
	return composeHorizontalPixelImages(patchImages, artifactLabel);
}

function composeSkyDomeGridPixelImage(result, artifactLabel) {
	if (result.skyDomePanels.length === 0) {
		throw new Error(`${artifactLabel} image artifact requires at least one sky-dome panel`);
	}

	const panelImages = result.skyDomePanels.map((panel) => panel.pixelImage);
	return stackPixelImagesVertically(panelImages, artifactLabel);
}

function composeSunDiagnosticPixelImage(result, artifactLabel) {
	const patchImages = result.skyPatches.map((patch) => {
		const panels = patch.sunDiagnostic?.panelImages;

		if (!panels) {
			throw new Error(`${artifactLabel} diagnostic image artifact requires sunDiagnostic panels`);
		}

		return stackPixelImagesVertically([
			patch.pixelImage,
			panels.angularDistance,
			panels.diskMask,
			panels.directDisk,
			panels.skyPlusDisk,
		], artifactLabel);
	});

	return composeHorizontalPixelImages(patchImages, artifactLabel);
}

function stackPixelImagesVertically(images, artifactLabel) {
	if (images.length === 0) {
		throw new Error(`${artifactLabel} stacked image requires panels`);
	}

	const width = images[0].width;
	const height = images.reduce((sum, image) => {
		if (!image || image.kind !== 'atmosphere-color-pixel-image') {
			throw new Error(`${artifactLabel} stacked image requires pixel image panels`);
		}

		if (image.width !== width) {
			throw new Error(`${artifactLabel} stacked image requires panels with matching widths`);
		}

		return sum + image.height;
	}, 0);
	const pixels = images.flatMap((image) => image.pixels);

	return {
		kind: 'atmosphere-color-pixel-image',
		width,
		height,
		encoding: images[0].encoding,
		exposure: 'per-panel',
		toneMap: images[0].toneMap,
		pixels,
		metadata: {
			displayOnly: true,
			pixelCount: pixels.length,
			panelCount: images.length,
			displayPolicy: {
				encoding: images[0].encoding,
				exposure: 'per-panel',
				toneMap: images[0].toneMap,
				clampedChannels: uniqueSorted(images.flatMap((image) => {
					return image.metadata?.displayPolicy?.clampedChannels ?? [];
				})),
				preventedClipChannels: uniqueSorted(images.flatMap((image) => {
					return image.metadata?.displayPolicy?.preventedClipChannels ?? [];
				})),
			},
		},
	};
}

function composeHorizontalPixelImages(patchImages, artifactLabel) {
	const height = patchImages[0].height;
	const width = patchImages.reduce((sum, image) => {
		if (!image || image.kind !== 'atmosphere-color-pixel-image') {
			throw new Error(`${artifactLabel} image artifact requires sky patch pixelImage data`);
		}

		if (image.height !== height) {
			throw new Error(`${artifactLabel} image artifact requires sky patches with matching heights`);
		}

		return sum + image.width;
	}, 0);
	const pixels = [];

	for (let y = 0; y < height; y += 1) {
		for (const image of patchImages) {
			const rowStart = y * image.width;
			pixels.push(...image.pixels.slice(rowStart, rowStart + image.width));
		}
	}

	return {
		kind: 'atmosphere-color-pixel-image',
		width,
		height,
		encoding: patchImages[0].encoding,
		exposure: 'per-patch',
		toneMap: patchImages[0].toneMap,
		pixels,
		metadata: {
			displayOnly: true,
			pixelCount: pixels.length,
			colorProvenance: patchImages[0].metadata?.colorProvenance,
			displayPolicy: {
				encoding: patchImages[0].encoding,
				exposure: 'per-patch',
				toneMap: patchImages[0].toneMap,
				clampedChannels: uniqueSorted(patchImages.flatMap((image) => {
					return image.metadata?.displayPolicy?.clampedChannels ?? [];
				})),
				preventedClipChannels: uniqueSorted(patchImages.flatMap((image) => {
					return image.metadata?.displayPolicy?.preventedClipChannels ?? [];
				})),
			},
		},
	};
}

function uniqueSorted(values) {
	return [...new Set(values)].sort();
}

function formatBaselineFreezeSection(result) {
	const baseline = result.baselineFreeze;

	if (!baseline) {
		return [];
	}

	return [
		`Baseline freeze: \`${baseline.id}\`, mode \`${baseline.mode}\`, status \`${baseline.status}\``,
		`Baseline scenarios: \`${baseline.scenarios.join(', ')}\``,
		`Baseline proxy policy: \`${baseline.proxyPolicy}\``,
	];
}

function formatSkyDomeModelMetricRows(result) {
	return result.skyDomePanels.map((panel) => {
		const metrics = panel.modelComparisonMetrics;

		return [
			panel.label,
			formatPercent(metrics?.warmAffectedFraction),
			formatPercent(metrics?.brightWarmAffectedFraction),
			formatPercent(metrics?.nonBlueAffectedFraction),
			`${metrics?.sampledDomePixelCount ?? metrics?.domePixelCount ?? 'n/a'} / ${metrics?.skippedDomePixelCount ?? 0}`,
			formatNumber(metrics?.horizonRing?.luminance?.average),
			formatNumber(metrics?.zenithDisk?.luminance?.average),
			formatNumber(metrics?.zenithToHorizon?.luminanceRatio),
			formatNumber(metrics?.horizonRing?.saturation?.average),
			formatPercent(metrics?.sunNeighborhood10Deg?.warmAffectedFraction),
		].join(' | ');
	}).map((row) => `| ${row} |`);
}

function formatSamplingProfileLine(samplingProfile) {
	if (!samplingProfile) {
		return 'Sampling profile: `n/a`';
	}

	return `Sampling profile: \`${samplingProfile.id}\`, label \`${samplingProfile.label ?? 'n/a'}\`, use \`${samplingProfile.evidenceUse ?? 'n/a'}\``;
}

function formatExternalRadianceComparisonSection(result) {
	const comparison = result.externalRadianceComparison;

	if (!comparison) {
		return [];
	}

	return [
		'## External Radiance Comparison',
		'',
		`Reference artifact: \`${comparison.referencePath}\``,
		`Reference source: \`${comparison.source?.model ?? 'n/a'}\`, version \`${comparison.source?.version ?? 'n/a'}\``,
		`Samples: \`${comparison.matchedSampleCount}/${comparison.sampleCount}\` matched, \`${comparison.unmatchedSampleCount}\` unmatched`,
		'',
		'| Scenario | Role | Status | Matched wavelengths | Mean abs error | RMS abs error | Mean relative error |',
		'| --- | --- | --- | --- | ---: | ---: | ---: |',
		...comparison.samples.map((sample) => {
			return [
				sample.scenarioId,
				sample.sampleRole,
				sample.status,
				Array.isArray(sample.matchedWavelengthsNm)
					? sample.matchedWavelengthsNm.join(', ')
					: 'n/a',
				formatNumber(sample.meanAbsoluteError),
				formatNumber(sample.rmsAbsoluteError),
				formatNumber(sample.meanRelativeError),
			].join(' | ');
		}).map((row) => `| ${row} |`),
		'',
	];
}

function formatMultipleScatteringReferenceSection(result) {
	const sidecar = result.multipleScatteringReference;

	if (!sidecar) {
		return [];
	}

	const wavelengthsNm = sidecar.wavelengthsNm ?? result.visual?.wavelengthGrid?.wavelengthsNm;
	const orderRows = (sidecar.orders ?? []).map((order) => {
		return [
			order.order,
			formatSelectedSpectrum(order.radianceByWavelength, wavelengthsNm),
		].join(' | ');
	});
	const sampleRows = (sidecar.samples ?? []).map((sample) => {
		const order1 = sample.orders?.find((order) => order.order === 1);
		const order2 = sample.orders?.find((order) => order.order === 2);

		return [
			sample.scenarioId,
			sample.sampleRole,
			formatNumber(sample.viewZenithDeg),
			formatNumber(sample.relativeAzimuthDeg),
			formatDisplaySwatch(sample.displayHex),
			formatDisplaySwatch(sample.displayComparison?.order1?.displayHex),
			formatDisplaySwatch(sample.displayComparison?.order1PlusOrder2?.displayHex),
			formatDisplaySwatch(sample.displayComparison?.accumulated?.displayHex),
			formatPercent((sample.displayComparison?.delta?.linearLuminanceRatio ?? 1) - 1),
			formatSelectedSpectrum(order1?.radianceByWavelength, wavelengthsNm),
			formatSelectedSpectrum(order2?.radianceByWavelength, wavelengthsNm),
			formatPercent(sample.convergence?.order2Fraction),
			formatPercent(sample.convergence?.lastOrderFraction),
		].join(' | ');
	});
	const fieldSceneRows = (sidecar.fieldScenes ?? []).flatMap((scene) => {
		const totalEnergy = (scene.orders ?? []).reduce((sum, order) => sum + (order.energy ?? 0), 0);

		return (scene.orders ?? []).map((order) => [
			scene.scenarioId,
			order.order,
			formatNumber(order.energy),
			formatPercent(totalEnergy > 0 ? order.energy / totalEnergy : null),
			formatSelectedSpectrum(order.averageRadianceByWavelength, wavelengthsNm),
			formatPercent(scene.convergence?.lastOrderFraction),
			scene.convergence?.converged ?? 'n/a',
		].join(' | '));
	});
	const reconstruction = sidecar.reconstruction;
	const reconstructionByZenithRows = (reconstruction?.byViewZenithDeg ?? []).map((row) => [
		formatNumber(row.viewZenithDeg),
		row.comparedSampleCount,
		formatPercent(row.meanRelativeSpectralEnergyError),
		formatPercent(row.maxRelativeSpectralEnergyError),
		formatPercent(row.meanLinearLuminanceRelativeError),
		formatNumber(row.meanDisplayRgbAbsoluteError),
	].join(' | '));
	const reconstructionWorstRows = (reconstruction?.worstSamples ?? []).map((sample) => [
		sample.scenarioId,
		sample.sampleRole,
		formatNumber(sample.viewZenithDeg),
		formatNumber(sample.relativeAzimuthDeg),
		formatPercent(sample.relativeSpectralEnergyError),
		formatPercent(sample.linearLuminanceRelativeError),
		formatDisplaySwatch(sample.directDisplayHex),
		formatDisplaySwatch(sample.reconstructedDisplayHex),
	].join(' | '));

	return [
		'## Multiple-Scattering Reference Sidecar',
		'',
		`Mode: \`${sidecar.mode}\``,
		`Status: \`${sidecar.status}\``,
		`Output policy: \`${sidecar.outputPolicy}\``,
		`Planned solver: \`${sidecar.plannedSolver}\``,
		`Diagnostics: geometry \`${sidecar.diagnostics?.geometryKind ?? 'n/a'}\`, target mode \`${sidecar.diagnostics?.targetMode ?? 'n/a'}\`, tau regime \`${sidecar.diagnostics?.tauRegime ?? 'n/a'}\`, targets \`${sidecar.diagnostics?.targetCount ?? 'n/a'}\`, direction basis \`${sidecar.diagnostics?.fieldDirectionBasis ?? 'n/a'}\`, requested directions \`${sidecar.diagnostics?.requestedAngularSampleCount ?? sidecar.diagnostics?.angularSampleCount ?? 'n/a'}\`, resolved directions \`${sidecar.diagnostics?.angularSampleCount ?? 'n/a'}\`, direction weight error \`${formatPercent(sidecar.diagnostics?.fieldDirectionWeightRelativeError)}\`, altitude grid \`${sidecar.diagnostics?.fieldAltitudeGrid ?? 'n/a'}\`, altitude layers \`${sidecar.diagnostics?.altitudeLayerCount ?? 'n/a'}\``,
		`Convergence: max order \`${sidecar.convergence?.maxOrder ?? 'n/a'}\`, last-order fraction \`${formatPercent(sidecar.convergence?.lastOrderFraction)}\`, threshold \`${formatPercent(sidecar.convergence?.thresholdFraction)}\`, converged \`${sidecar.convergence?.converged ?? 'n/a'}\``,
		...(sidecar.diagnostics?.warnings ?? []).map((warning) => `- ${warning}`),
		...(orderRows.length > 0
			? [
				'',
				'| Order | Average selected radiance |',
				'| ---: | --- |',
				...orderRows.map((row) => `| ${row} |`),
			]
			: []),
		...(sampleRows.length > 0
			? [
				'',
				'| Scenario | Role | View zenith deg | Rel az deg | Rendered display | L1 display | L1+L2 display | Accumulated display | Linear luminance lift | Order 1 selected radiance | Order 2 selected radiance | Order 2 fraction | Last order fraction |',
				'| --- | --- | ---: | ---: | --- | --- | --- | --- | ---: | --- | --- | ---: | ---: |',
				...sampleRows.map((row) => `| ${row} |`),
			]
			: []),
		...(fieldSceneRows.length > 0
			? [
				'',
				'| Scenario | Order | Field energy | Energy fraction | Average field radiance | Scene last-order fraction | Scene converged |',
				'| --- | ---: | ---: | ---: | --- | ---: | --- |',
				...fieldSceneRows.map((row) => `| ${row} |`),
				'',
				...formatFieldComparisonPanelSection(sidecar.fieldScenes),
			]
			: []),
		...(reconstruction
			? [
				'',
				'### Cached Field L1 Reconstruction',
				'',
				`Interpolation: \`${reconstruction.interpolationMode}\`, target mode \`${reconstruction.targetMode}\`, samples \`${reconstruction.targetCount}\``,
				`Aggregate: mean spectral-energy error \`${formatPercent(reconstruction.aggregate?.meanRelativeSpectralEnergyError)}\`, max \`${formatPercent(reconstruction.aggregate?.maxRelativeSpectralEnergyError)}\`, mean luminance error \`${formatPercent(reconstruction.aggregate?.meanLinearLuminanceRelativeError)}\`, mean display RGB error \`${formatNumber(reconstruction.aggregate?.meanDisplayRgbAbsoluteError)}\``,
				'',
				'| View zenith deg | Samples | Mean spectral-energy error | Max spectral-energy error | Mean luminance error | Mean display RGB abs error |',
				'| ---: | ---: | ---: | ---: | ---: | ---: |',
				...reconstructionByZenithRows.map((row) => `| ${row} |`),
				'',
				'| Scenario | Role | View zenith deg | Rel az deg | Spectral-energy error | Luminance error | Direct display | Reconstructed display |',
				'| --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
				...reconstructionWorstRows.map((row) => `| ${row} |`),
			]
			: []),
		'',
	];
}

function formatFieldComparisonPanelSection(fieldScenes) {
	return (fieldScenes ?? []).flatMap((scene) => {
		const metricRows = (scene.comparisonPanels ?? []).map((panel) => {
			const metrics = panel.modelComparisonMetrics;

			return [
				panel.label,
				formatPercent(metrics?.warmAffectedFraction),
				formatPercent(metrics?.nonBlueAffectedFraction),
				formatNumber(metrics?.horizonRing?.luminance?.average),
				formatNumber(metrics?.horizonRing?.saturation?.average),
				formatNumber(metrics?.zenithDisk?.luminance?.average),
				formatNumber(metrics?.zenithDisk?.saturation?.average),
				formatNumber(metrics?.zenithToHorizon?.luminanceRatio),
				formatPercent(metrics?.sunNeighborhood10Deg?.warmAffectedFraction),
			].join(' | ');
		});

		return [
			`### ${scene.label} Field Comparison Panels`,
			'',
			...(metricRows.length > 0
				? [
					'| Panel | Warm area | Non-blue area | Horizon luminance | Horizon saturation | Zenith luminance | Zenith saturation | Horizon/zenith luminance | Sun-neighborhood warm area |',
					'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
					...metricRows.map((row) => `| ${row} |`),
					'',
				]
				: []),
			...(scene.comparisonPanels ?? []).flatMap((panel) => [
				`**${panel.label}**`,
				'',
				formatSwatchGrid(panel.rows, 4),
				'',
			]),
		];
	});
}

function formatSwatchGrid(rows, cellSizePx) {
	if (!Array.isArray(rows) || rows.length === 0) {
		return 'n/a';
	}

	const width = rows[0]?.length ?? 0;
	const cells = rows.flatMap((row) => {
		return row.map((hex) => {
			return `<span style="width:${cellSizePx}px;height:${cellSizePx}px;background:${hex};display:block"></span>`;
		});
	}).join('');

	return `<div style="display:grid;grid-template-columns:repeat(${width},${cellSizePx}px);gap:0;line-height:0">${cells}</div>`;
}

function buildSkyDomeGridMarkdownReport(result, { imagePath, outPath, reportPath } = {}) {
	const imageLink = imagePath
		? `\n![Sky-dome comparison grid](${relativeReportPath(imagePath, reportPath)})\n`
		: '';
	const jsonLink = outPath ? `\nJSON output: \`${relativeReportPath(outPath, reportPath)}\`\n` : '';
	const rows = result.skyDomePanels.map((panel) => {
		const centerSample = skyDomeCenterSample(panel);
		const horizonSample = skyDomeHorizonEdgeSample(panel);

		return [
			panel.label,
			formatNumber(panel.sunZenithDeg),
			formatNumber(panel.sunElevationDeg),
			`${panel.size.width} x ${panel.size.height}`,
			`<span style="display:inline-block;width:48px;height:18px;background:${centerSample?.displayHex ?? '#000'};border:1px solid #777"></span> \`${centerSample?.displayHex ?? 'n/a'}\``,
			`<span style="display:inline-block;width:48px;height:18px;background:${horizonSample?.displayHex ?? '#000'};border:1px solid #777"></span> \`${horizonSample?.displayHex ?? 'n/a'}\``,
			formatSelectedSpectrum(centerSample?.renderedByWavelength, panel.wavelengthsNm),
			formatSelectedSpectrum(horizonSample?.renderedByWavelength, panel.wavelengthsNm),
		].join(' | ');
	});

	return [
		'# Atmosphere Reference Sky-Dome Grid',
		'',
		'This report is generated by `scripts/flat/atmosphere_rejected/run-reference-probe.js --sky-dome-grid`.',
		'',
		'The panels are fisheye skydome renders for the four time rows listed in Bruneton 2016 Figure 1. They are model-output comparison artifacts: the goal is to compare our current transport and color path against published sky-model outputs before using photographs as the target.',
		imageLink,
		jsonLink,
		`Comparison source: \`${result.sourceComparison?.source ?? 'n/a'}\`, \`${result.sourceComparison?.url ?? 'n/a'}\``,
		`Stage: \`${result.stage}\``,
		`Panel count: \`${result.skyDomePanelCount}\``,
		`Projection: \`${result.visual?.projection?.id ?? 'n/a'}\`, policy \`${result.visual?.projection?.policy ?? 'n/a'}\``,
		`Dome sample mask: \`${result.visual?.domeSampleMask?.id ?? 'full'}\`, min radius \`${formatNumber(result.visual?.domeSampleMask?.minRadius ?? 0)}\`, ${result.visual?.domeSampleMask?.description ?? 'Trace every pixel inside the fisheye dome.'}`,
		`Solar source: \`${result.visual?.solarSource?.mode ?? 'directional-sun'}\`, source samples \`${result.visual?.solarSource?.sampleCount ?? 1}\`, solar angular radius \`${formatNumber(result.visual?.solarSource?.solarAngularRadiusDeg)} deg\`, weight sum \`${formatNumber(result.visual?.solarSource?.weightSum)}\``,
		`Display: \`${result.visual?.colorSpace ?? 'n/a'}\`, encoding \`${result.visual?.encoding ?? 'n/a'}\`, tone map \`${result.visual?.toneMap ?? 'n/a'}\`, exposure \`${result.visual?.exposure ?? 'n/a'}\`, solar \`${result.visual?.solarSpectrum?.policy ?? 'n/a'}\`, Rayleigh \`${result.visual?.rayleighPolicy?.id ?? 'n/a'}\`, aerosol \`${result.visual?.aerosolPolicy?.id ?? 'n/a'}\`, aerosol phase \`${result.visual?.aerosolPhasePolicy?.id ?? 'n/a'}\`, ozone \`${result.visual?.ozonePolicy?.id ?? 'n/a'}\`, molecular profile \`${result.visual?.molecularProfile?.id ?? 'n/a'}\`, grid \`${formatWavelengthGrid(result.visual?.wavelengthGrid)}\``,
		`Sky-dome visual fit: \`${result.visual?.skyDomeVisualFit?.mode ?? 'none'}\`, policy \`${result.visual?.skyDomeVisualFit?.policy ?? 'raw display pixels from the reference transport/color pipeline'}\``,
		formatSamplingProfileLine(result.visual?.numerical?.samplingProfile),
		`Numerical sampling: view steps \`${result.visual?.numerical?.viewSteps ?? 'n/a'}\`, source-path steps \`${result.visual?.numerical?.sunTransmittanceSteps ?? 'n/a'}\`, integration \`${result.visual?.numerical?.integrationMethod ?? 'n/a'}\``,
		`World parameters: radius \`${formatPlainNumber(result.model?.parameters?.planetRadiusKm)} km\`, atmosphere top \`${formatPlainNumber(result.model?.parameters?.atmosphereTopAltitudeKm)} km\`, Rayleigh scale height \`${formatPlainNumber(result.model?.parameters?.rayleighScaleHeightKm)} km\`, aerosol optical depth 550 nm \`${formatPlainNumber(result.model?.parameters?.aerosolOpticalDepth550Nm)}\`, aerosol SSA \`${formatPlainNumber(result.model?.parameters?.aerosolSingleScatteringAlbedo)}\`, aerosol phase \`${result.model?.parameters?.aerosolPhaseKind ?? 'n/a'} g=${formatPlainNumber(result.model?.parameters?.aerosolPhaseG)}\`, ozone \`${formatPlainNumber(result.model?.parameters?.ozoneDobsonUnits)} DU\``,
		...formatBaselineFreezeSection(result),
		'',
		'| Row | Sun zenith deg | Sun elevation deg | Cells | Zenith display | Horizon-edge display | Zenith rendered radiance | Horizon rendered radiance |',
		'| --- | ---: | ---: | ---: | --- | --- | --- | --- |',
		...rows.map((row) => `| ${row} |`),
		'',
		'## Model-Output Metrics',
		'',
		'These display-encoded fisheye metrics are computed before the red Sun marker is overlaid. They are diagnostic image-shape measurements for model-family comparison, not physical radiance truth.',
		'',
		'| Row | Warm area | Bright warm area | Non-blue area | Sampled / skipped pixels | Horizon luminance avg | Zenith luminance avg | Horizon/zenith luminance | Horizon saturation | Sun 10 deg warm area |',
		'| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
		...formatSkyDomeModelMetricRows(result),
		'',
		...formatExternalRadianceComparisonSection(result),
		...formatMultipleScatteringReferenceSection(result),
		'## Panel Notes',
		'',
		...result.skyDomePanels.flatMap((panel) => {
			const centerSample = skyDomeCenterSample(panel);
			const horizonSample = skyDomeHorizonEdgeSample(panel);

			return [
				`### ${panel.label}`,
				'',
				`- Time row: \`${panel.timeLabel}\`, sun zenith \`${formatNumber(panel.sunZenithDeg)} deg\`, elevation \`${formatNumber(panel.sunElevationDeg)} deg\`, azimuth \`${formatNumber(panel.sunAzimuthDeg)} deg\``,
				`- Display exposure: \`${formatNumber(panel.displayExposure)}\``,
				`- Dome sample mask: \`${panel.domeSampleMask?.id ?? 'full'}\`, sampled \`${panel.sampledInsideDomePixelCount ?? 'n/a'}\`, skipped \`${panel.skippedInsideDomePixelCount ?? 0}\``,
				`- Tone map: \`${panel.toneMap ?? 'n/a'}\``,
				`- Solar spectrum: \`${panel.solarSpectrum?.policy ?? 'n/a'}\``,
				`- Rayleigh policy: \`${panel.rayleighPolicy?.id ?? 'n/a'}\``,
				`- Aerosol policy: \`${panel.aerosolPolicy?.id ?? 'n/a'}\`, AOD550 \`${formatPlainNumber(panel.aerosolPolicy?.aod550)}\`, SSA \`${formatPlainNumber(panel.aerosolPolicy?.singleScatteringAlbedo)}\`, default phase \`${panel.aerosolPolicy?.defaultPhasePolicyId ?? 'n/a'}\``,
				`- Aerosol phase policy: \`${panel.aerosolPhasePolicy?.id ?? 'n/a'}\`, kind \`${panel.aerosolPhasePolicy?.kind ?? 'n/a'}\`, g \`${formatPlainNumber(panel.aerosolPhasePolicy?.parameters?.g)}\``,
				`- Ozone policy: \`${panel.ozonePolicy?.id ?? 'n/a'}\``,
				`- Molecular profile: \`${panel.molecularProfile?.id ?? 'n/a'}\``,
				`- ${formatSamplingProfileLine(panel.numerical?.samplingProfile)}`,
				`- Numerical sampling: \`${panel.numerical?.viewSteps ?? 'n/a'} view steps, ${panel.numerical?.sunTransmittanceSteps ?? 'n/a'} source-path steps, ${panel.numerical?.integrationMethod ?? 'n/a'} integration\``,
				`- Zenith rendered radiance: \`${formatSelectedSpectrum(centerSample?.renderedByWavelength, panel.wavelengthsNm)}\``,
				`- Horizon rendered radiance: \`${formatSelectedSpectrum(horizonSample?.renderedByWavelength, panel.wavelengthsNm)}\``,
				`- Horizon optical-depth validity: \`${formatOpticalDepthValiditySummary(horizonSample?.opticalDepthValidity)}\``,
				`- Sun marker: \`x=${panel.projection?.sunMarker?.x ?? 'n/a'}, y=${panel.projection?.sunMarker?.y ?? 'n/a'}\``,
				`- Wavelengths: \`${formatWavelengthList(panel.wavelengthsNm)}\``,
				'',
			];
		}),
	].join('\n');
}

function buildSkyDomeGridSvg(result) {
	const cellSize = 4;
	const rowGap = 28;
	const margin = 24;
	const labelWidth = 136;
	const firstPanelSize = result.skyDomePanels[0]?.size ?? {
		width: DEFAULT_SKY_DOME_SIZE,
		height: DEFAULT_SKY_DOME_SIZE,
	};
	const panelWidth = firstPanelSize.width * cellSize;
	const panelHeight = firstPanelSize.height * cellSize;
	const headerHeight = 48;
	const width = margin * 2 + labelWidth + panelWidth;
	const height = margin * 2 + headerHeight
		+ result.skyDomePanels.length * panelHeight
		+ Math.max(0, result.skyDomePanels.length - 1) * rowGap
		+ 28;
	const panels = result.skyDomePanels.map((panel, panelIndex) => {
		const x0 = margin + labelWidth;
		const y0 = margin + headerHeight + panelIndex * (panelHeight + rowGap);
		const labelX = margin;
		const cells = panel.rows.flatMap((row, y) => {
			return row.map((hex, x) => {
				return `<rect x="${x0 + x * cellSize}" y="${y0 + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${hex}"/>`;
			});
		}).join('\n');

		return [
			`<text x="${labelX}" y="${y0 + 18}" class="title">${escapeXml(panel.timeLabel)}</text>`,
			`<text x="${labelX}" y="${y0 + 39}" class="muted">${escapeXml(`${panel.sunZenithDeg} deg zenith`)}</text>`,
			`<text x="${labelX}" y="${y0 + 58}" class="muted">${escapeXml(panel.id)}</text>`,
			`<rect x="${x0 - 1}" y="${y0 - 1}" width="${panelWidth + 2}" height="${panelHeight + 2}" fill="none" stroke="#304050"/>`,
			cells,
		].join('\n');
	}).join('\n');

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		'<style>',
		'text{font-family:Arial,Helvetica,sans-serif;fill:#1f2933}.title{font-size:18px;font-weight:700}.muted{font-size:12px;fill:#5f6b7a}.heading{font-size:22px;font-weight:700}',
		'</style>',
		'<rect width="100%" height="100%" fill="#f7f9fb"/>',
		`<text x="${margin}" y="${margin + 22}" class="heading">Sky-Dome Model Comparison Column</text>`,
		panels,
		`<text x="${margin}" y="${height - 20}" class="muted">Display: ${escapeXml(result.visual?.colorSpace ?? 'n/a')} / ${escapeXml(result.visual?.encoding ?? 'n/a')} from ${formatPlainNumber(result.visual?.wavelengthGrid?.count)} wavelength samples. Red cross marks the sun direction.</text>`,
		'</svg>',
	].join('\n');
}

function skyDomeCenterSample(panel) {
	return panel.diagnosticSamples.find((sample) => {
		return sample.x === Math.floor(panel.size.width / 2)
			&& sample.y === Math.floor(panel.size.height / 2);
	});
}

function skyDomeHorizonEdgeSample(panel) {
	return panel.diagnosticSamples.find((sample) => {
		return sample.x === Math.floor(panel.size.width / 2)
			&& sample.y === 0;
	});
}

function buildSkyPatchMarkdownReport(result, { imagePath, outPath, reportPath } = {}) {
	const imageLink = imagePath
		? `\n![Sky patch visual evidence](${relativeReportPath(imagePath, reportPath)})\n`
		: '';
	const jsonLink = outPath ? `\nJSON output: \`${relativeReportPath(outPath, reportPath)}\`\n` : '';
	const rows = result.skyPatches.map((patch) => {
		const centerSample = patch.diagnosticSamples.find((sample) => {
			return sample.x === Math.floor(patch.size.width / 2)
				&& sample.y === Math.floor(patch.size.height / 2);
		});

		return [
			patch.id,
			patch.label,
			`<span style="display:inline-block;width:48px;height:18px;background:${centerSample?.displayHex ?? '#000'};border:1px solid #777"></span> \`${centerSample?.displayHex ?? 'n/a'}\``,
			`${patch.size.width} x ${patch.size.height}`,
			formatNumber(patch.displayExposure),
			formatRgb(centerSample?.linearSrgb),
			formatSelectedSpectrum(centerSample?.renderedByWavelength ?? centerSample?.finalByWavelength, patch.wavelengthsNm),
			formatSelectedSpectrum(centerSample?.viewTransmittanceByWavelength, patch.wavelengthsNm),
		].join(' | ');
	});

	return [
		'# Atmosphere Reference Sky Patches',
		'',
		'This report is generated by `scripts/flat/atmosphere_rejected/run-reference-probe.js --sky-patches`.',
		'',
		'The image is made from many `traceRay` calls through the current canonical transport stages. The adapters are intentionally basic: a small camera model, a spherical Earth-like sky shell, named top-of-atmosphere solar spectrum samples, named Rayleigh/aerosol/ozone/profile composition policies, and official CIE 1931 2-degree table-backed XYZ to sRGB display mapping. This is meant to show colors and gradients now, not final validated Earth truth.',
		imageLink,
		jsonLink,
		...formatBaselineFreezeSection(result),
		`Stage: \`${result.stage}\``,
		`Patch count: \`${result.skyPatchCount}\``,
		`Model: \`${result.model?.kind ?? 'n/a'}\``,
		`Display: \`${result.visual?.colorSpace ?? 'n/a'}\`, encoding \`${result.visual?.encoding ?? 'n/a'}\`, tone map \`${result.visual?.toneMap ?? 'n/a'}\`, exposure \`${result.visual?.exposure ?? 'n/a'}\`, solar \`${result.visual?.solarSpectrum?.policy ?? 'n/a'}\`, Rayleigh \`${result.visual?.rayleighPolicy?.id ?? 'n/a'}\`, aerosol \`${result.visual?.aerosolPolicy?.id ?? 'n/a'}\`, aerosol phase \`${result.visual?.aerosolPhasePolicy?.id ?? 'n/a'}\`, ozone \`${result.visual?.ozonePolicy?.id ?? 'n/a'}\`, molecular profile \`${result.visual?.molecularProfile?.id ?? 'n/a'}\`, grid \`${formatWavelengthGrid(result.visual?.wavelengthGrid)}\``,
		formatSamplingProfileLine(result.visual?.numerical?.samplingProfile),
		`Numerical sampling: view steps \`${result.visual?.numerical?.viewSteps ?? 'n/a'}\`, source-path steps \`${result.visual?.numerical?.sunTransmittanceSteps ?? 'n/a'}\`, default view/source \`${result.visual?.numerical?.defaultViewSteps ?? 'n/a'}/${result.visual?.numerical?.defaultSunTransmittanceSteps ?? 'n/a'}\`, integration \`${result.visual?.numerical?.integrationMethod ?? 'n/a'}\``,
		`Sun visual: \`${result.visual?.sunVisual?.mode ?? 'none'}\`, solar angular diameter \`${formatNumber(result.visual?.sunVisual?.solarAngularDiameterDeg)} deg\``,
		...(result.visual?.sunVisual?.mode === 'diagnostic'
			? [
				'',
				'Diagnostic panel order for PNG/PPM output: sky-only, angular-distance heatmap, disk mask, direct-disk approximation, sky-plus-disk approximation.',
			]
			: []),
		`World parameters: radius \`${formatPlainNumber(result.model?.parameters?.planetRadiusKm)} km\`, atmosphere top \`${formatPlainNumber(result.model?.parameters?.atmosphereTopAltitudeKm)} km\`, Rayleigh scale height \`${formatPlainNumber(result.model?.parameters?.rayleighScaleHeightKm)} km\`, aerosol optical depth 550 nm \`${formatPlainNumber(result.model?.parameters?.aerosolOpticalDepth550Nm)}\`, aerosol phase \`${result.model?.parameters?.aerosolPhaseKind ?? 'n/a'} g=${formatPlainNumber(result.model?.parameters?.aerosolPhaseG)}\`, ozone \`${formatPlainNumber(result.model?.parameters?.ozoneDobsonUnits)} DU\``,
		'',
		'| Patch | View | Center display | Cells | Preview exposure | Center linear sRGB | Center rendered radiance samples | Center transmittance samples |',
		'| --- | --- | --- | ---: | ---: | --- | --- | --- |',
		...rows.map((row) => `| ${row} |`),
		'',
		...formatExternalRadianceComparisonSection(result),
		...formatMultipleScatteringReferenceSection(result),
		'## Patch Notes',
		'',
		...result.skyPatches.flatMap((patch) => {
			const centerSample = patch.diagnosticSamples.find((sample) => {
				return sample.x === Math.floor(patch.size.width / 2)
					&& sample.y === Math.floor(patch.size.height / 2);
			});

			return [
				`### ${patch.id}`,
				'',
				patch.description,
				'',
				`- Display exposure: \`${formatNumber(patch.displayExposure)}\``,
				`- Tone map: \`${patch.toneMap ?? 'n/a'}\``,
				`- Solar spectrum: \`${patch.solarSpectrum?.policy ?? 'n/a'}\``,
				`- Rayleigh policy: \`${patch.rayleighPolicy?.id ?? 'n/a'}\``,
				`- Aerosol policy: \`${patch.aerosolPolicy?.id ?? 'n/a'}\``,
				`- Aerosol phase policy: \`${patch.aerosolPhasePolicy?.id ?? 'n/a'}\`, kind \`${patch.aerosolPhasePolicy?.kind ?? 'n/a'}\`, g \`${formatPlainNumber(patch.aerosolPhasePolicy?.parameters?.g)}\``,
				`- Ozone policy: \`${patch.ozonePolicy?.id ?? 'n/a'}\``,
				`- Molecular profile: \`${patch.molecularProfile?.id ?? 'n/a'}\``,
				`- ${formatSamplingProfileLine(patch.numerical?.samplingProfile)}`,
				`- Numerical sampling: \`${patch.numerical?.viewSteps ?? 'n/a'} view steps, ${patch.numerical?.sunTransmittanceSteps ?? 'n/a'} source-path steps, ${patch.numerical?.integrationMethod ?? 'n/a'} integration\``,
				`- Sun/source: \`${patch.sun.mode ?? `${patch.sun.elevationDeg} deg elevation`}\``,
				`- Center final radiance: \`${formatSelectedSpectrum(centerSample?.finalByWavelength, patch.wavelengthsNm)}\``,
				`- Center optical-depth validity: \`${formatOpticalDepthValiditySummary(centerSample?.opticalDepthValidity)}\``,
				`- Center scattering geometry: \`${formatPhaseDiagnosticSummary(centerSample?.skyCompletenessDiagnostics?.phase)}\``,
				`- Center altitude distribution: \`${formatAltitudeDistributionSummary(centerSample?.skyCompletenessDiagnostics?.altitude)}\``,
				`- Center single-scattering budget: \`${formatSingleScatteringBudgetSummary(centerSample?.skyCompletenessDiagnostics?.singleScatteringBudget)}\``,
				`- Missing-light estimate: \`${formatMissingLightEstimate(centerSample?.skyCompletenessDiagnostics?.missingLightEstimate)}\``,
				`- Disabled completeness terms: \`${formatDisabledTerms(centerSample?.skyCompletenessDiagnostics?.disabledTerms)}\``,
				`- Horizon profile: \`${formatHorizonProfileSummary(patch.horizonProfile)}\``,
				'',
				'| Center-column row | Elevation | Class | Display | Linear luminance | Final radiance | View transmittance | Tau class |',
				'| ---: | ---: | --- | --- | ---: | --- | --- | --- |',
				...formatHorizonProfileRows(patch.horizonProfile, patch.wavelengthsNm),
				...(patch.sunDiagnostic
					? [
						`- Closest sun pixel: \`${formatSunPixelSummary(patch.sunDiagnostic.pixelSummary.closestSunPixel)}\``,
						`- Closest sun optical-depth validity: \`${formatOpticalDepthValiditySummary(patch.sunDiagnostic.pixelSummary.closestSunPixel?.opticalDepthValidity)}\``,
						`- Disk-hit pixels: \`${patch.sunDiagnostic.pixelSummary.diskHitCount} / ${patch.sunDiagnostic.pixelSummary.pixelCount}\``,
						`- Sun angle range: \`${formatNumber(patch.sunDiagnostic.pixelSummary.minAngularDistanceDeg)}-${formatNumber(patch.sunDiagnostic.pixelSummary.maxAngularDistanceDeg)} deg\``,
						`- Direct disk policy: \`${patch.sunDiagnostic.directDiskPolicy}\``,
						'',
						'| Angle bucket | Pixels | Avg sky radiance | Avg direct disk | Avg sky+disk | Avg transmittance | Avg total tau | Tau class | Avg species tau | Avg species radiance |',
						'| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |',
						...formatSunAngleBucketRows(patch.sunDiagnostic, patch.wavelengthsNm),
					]
					: []),
				`- Wavelengths: \`${formatWavelengthList(patch.wavelengthsNm)}\``,
				'',
			];
		}),
	].join('\n');
}

function buildSkyPatchSvg(result) {
	const cellSize = 7;
	const panelGap = 28;
	const margin = 24;
	const firstPatchSize = result.skyPatches[0]?.size ?? SKY_PATCH_SIZE;
	const panelWidth = firstPatchSize.width * cellSize;
	const panelHeight = firstPatchSize.height * cellSize;
	const width = margin * 2 + result.skyPatches.length * panelWidth + (result.skyPatches.length - 1) * panelGap;
	const height = margin * 2 + 74 + panelHeight + 54;
	const panels = result.skyPatches.map((patch, patchIndex) => {
		const x0 = margin + patchIndex * (panelWidth + panelGap);
		const y0 = margin + 72;
		const cells = patch.rows.flatMap((row, y) => {
			return row.map((hex, x) => {
				return `<rect x="${x0 + x * cellSize}" y="${y0 + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${hex}"/>`;
			});
		}).join('\n');

		return [
			`<text x="${x0}" y="${margin + 20}" class="title">${escapeXml(patch.label)}</text>`,
			`<text x="${x0}" y="${margin + 42}" class="muted">${escapeXml(patch.id)}</text>`,
			`<rect x="${x0 - 1}" y="${y0 - 1}" width="${panelWidth + 2}" height="${panelHeight + 2}" fill="none" stroke="#304050"/>`,
			cells,
			`<text x="${x0}" y="${y0 + panelHeight + 24}" class="muted">${escapeXml(patch.displayEncoding)} ${escapeXml(patch.toneMap ?? 'clip')} exposure ${formatNumber(patch.displayExposure)}</text>`,
		].join('\n');
	}).join('\n');

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
		'<style>',
		'text{font-family:Arial,Helvetica,sans-serif;fill:#1f2933}.title{font-size:18px;font-weight:700}.muted{font-size:12px;fill:#5f6b7a}.heading{font-size:22px;font-weight:700}',
		'</style>',
		'<rect width="100%" height="100%" fill="#f7f9fb"/>',
		panels,
		`<text x="${margin}" y="${height - 20}" class="muted">Display: ${escapeXml(result.visual?.colorSpace ?? 'n/a')} / ${escapeXml(result.visual?.encoding ?? 'n/a')} from ${formatPlainNumber(result.visual?.wavelengthGrid?.count)} wavelength samples. No celestial objects are drawn.</text>`,
		'</svg>',
	].join('\n');
}

function spectrumBars(values, maxValue, x, y, color) {
	const barWidth = 36;
	const gap = 9;
	const maxHeight = 48;

	return values.map((value, index) => {
		const height = Math.max(0, (value / maxValue) * maxHeight);
		const barX = x + index * (barWidth + gap);
		const barY = y + maxHeight - height;
		return `<rect x="${barX}" y="${barY}" width="${barWidth}" height="${height}" rx="2" fill="${color}"/>`;
	});
}

function escapeXml(value) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function formatArray(values) {
	if (!Array.isArray(values)) {
		return 'n/a';
	}

	return `[${values.map(formatNumber).join(', ')}]`;
}

function formatDisplaySwatch(hex) {
	if (!hex) {
		return 'n/a';
	}

	return `<span style="display:inline-block;width:48px;height:18px;background:${hex};border:1px solid #777"></span> \`${hex}\``;
}

function formatRgb(rgb) {
	if (!rgb) {
		return 'n/a';
	}

	return `[${formatNumber(rgb.r)}, ${formatNumber(rgb.g)}, ${formatNumber(rgb.b)}]`;
}

function formatSelectedSpectrum(values, wavelengthsNm, targetWavelengthsNm = [440, 560, 660]) {
	if (!Array.isArray(values) || !Array.isArray(wavelengthsNm)) {
		return 'n/a';
	}

	return selectedSpectrumValues(values, wavelengthsNm, targetWavelengthsNm)
		.map(({ wavelengthNm, value }) => `${wavelengthNm}nm:${formatNumber(value)}`)
		.join(', ');
}

function selectedSpectrumValues(values, wavelengthsNm, targetWavelengthsNm = [440, 560, 660]) {
	if (!Array.isArray(values) || !Array.isArray(wavelengthsNm)) {
		return [];
	}

	return targetWavelengthsNm.map((targetWavelengthNm) => {
		const index = nearestWavelengthIndex(wavelengthsNm, targetWavelengthNm);

		return {
			wavelengthNm: wavelengthsNm[index],
			value: values[index],
		};
	});
}

function formatWavelengthGrid(grid) {
	if (!grid) {
		return 'n/a';
	}

	return `${grid.startNm}-${grid.endNm} nm / ${grid.stepNm} nm (${grid.count} samples)`;
}

function formatWavelengthList(wavelengthsNm) {
	if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
		return 'n/a';
	}

	const stepNm = wavelengthsNm.length > 1 ? wavelengthsNm[1] - wavelengthsNm[0] : 0;

	return `${wavelengthsNm[0]}-${wavelengthsNm[wavelengthsNm.length - 1]} nm`
		+ (stepNm ? ` every ${stepNm} nm` : '')
		+ ` (${wavelengthsNm.length} samples)`;
}

function formatSunPixelSummary(pixel) {
	if (!pixel) {
		return 'n/a';
	}

	return `x=${pixel.x}, y=${pixel.y}, angle=${formatNumber(pixel.angularDistanceFromSunDeg)} deg, disk=${pixel.intersectsSolarDisk}, occluded=${pixel.sunOccludedByHorizon}`;
}

function formatSunAngleBucketRows(sunDiagnostic, wavelengthsNm) {
	return (sunDiagnostic.angleBuckets ?? []).map((bucket) => {
		return [
			`\`${bucket.id} deg\``,
			bucket.count,
			formatSelectedSpectrum(bucket.avgSkyRadianceByWavelength, wavelengthsNm),
			formatSelectedSpectrum(bucket.avgDirectDiskByWavelength, wavelengthsNm),
			formatSelectedSpectrum(bucket.avgCombinedByWavelength, wavelengthsNm),
			formatSelectedSpectrum(bucket.avgViewTransmittanceByWavelength, wavelengthsNm),
			formatSelectedSpectrum(bucket.avgTotalOpticalDepthByWavelength, wavelengthsNm),
			bucket.count > 0 ? formatOpticalDepthValiditySummary(bucket.opticalDepthValidity) : 'n/a',
			formatSpeciesTauSummary(bucket.avgSpeciesOpticalDepth, wavelengthsNm),
			formatSpeciesRadianceSummary(bucket.avgSpeciesRadianceContribution, wavelengthsNm),
		].join(' | ');
	}).map((row) => `| ${row} |`);
}

function formatHorizonProfileSummary(profile) {
	if (!profile) {
		return 'n/a';
	}

	const trend = profile.skyTrend;
	const firstSurface = profile.firstSurfaceByRow
		? `, first surface row ${profile.firstSurfaceByRow.y} at ${formatNumber(profile.firstSurfaceByRow.elevationDeg)} deg`
		: ', no surface hit in center column';
	const horizonSky = profile.horizonSkySample
		? `, nearest sky-horizon row ${profile.horizonSkySample.y} at ${formatNumber(profile.horizonSkySample.elevationDeg)} deg ${profile.horizonSkySample.displayHex}`
		: ', no sky-horizon row';
	const trendText = trend
		? `${trend.direction}, near-horizon/top luminance ${formatNumber(trend.nearHorizonOverTop)}`
		: 'trend n/a';

	return `${trendText}; sky rows ${profile.skySampleCount}/${profile.sampleCount}${horizonSky}${firstSurface}`;
}

function formatHorizonProfileRows(profile, wavelengthsNm) {
	if (!profile?.samples?.length) {
		return ['| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |'];
	}

	const selectedSamples = uniqueHorizonProfileRows([
		profile.topRow,
		profile.samples[Math.max(0, Math.floor(profile.samples.length * 0.25))],
		profile.centerRow,
		profile.horizonSkySample,
		profile.lastSkyByRow,
		profile.firstSurfaceByRow,
		profile.lastRow,
	]);

	return selectedSamples.map((sample) => {
		return [
			sample.y,
			`${formatNumber(sample.elevationDeg)} deg`,
			sample.rayClass,
			`<span style="display:inline-block;width:32px;height:14px;background:${sample.displayHex};border:1px solid #777"></span> \`${sample.displayHex}\``,
			formatNumber(sample.linearLuminance),
			formatSelectedSpectrum(sample.finalByWavelength, wavelengthsNm),
			formatSelectedSpectrum(sample.viewTransmittanceByWavelength, wavelengthsNm),
			formatOpticalDepthValiditySummary(sample.opticalDepthValidity),
		].join(' | ');
	}).map((row) => `| ${row} |`);
}

function uniqueHorizonProfileRows(samples) {
	const seen = new Set();

	return samples.filter((sample) => {
		if (!sample || seen.has(sample.y)) {
			return false;
		}

		seen.add(sample.y);
		return true;
	});
}

function formatOpticalDepthValiditySummary(validity) {
	if (!validity) {
		return 'n/a';
	}

	const highTauSuffix = validity.highTau ? ', high-tau' : '';

	return `${validity.classification.label} at max tau ${formatNumber(validity.maxTau)}`
		+ ` (${formatNumber(validity.maxWavelengthNm)} nm${highTauSuffix})`;
}

function formatPhaseDiagnosticSummary(phase) {
	if (!phase) {
		return 'n/a';
	}

	const rayleigh = phase.avgSpeciesPhaseAt560?.rayleigh?.phaseAt560;
	const mie = phase.avgSpeciesPhaseAt560?.mie?.phaseAt560;

	return `angle avg ${formatNumber(phase.avgScatteringAngleDeg)} deg`
		+ ` (${formatNumber(phase.minScatteringAngleDeg)}-${formatNumber(phase.maxScatteringAngleDeg)} deg),`
		+ ` Rayleigh phase560 ${formatNumber(rayleigh)},`
		+ ` Mie phase560 ${formatNumber(mie)},`
		+ ` Mie/Rayleigh ${formatNumber(phase.mieToRayleighPhaseRatioAt560)}`;
}

function formatAltitudeDistributionSummary(altitude) {
	if (!altitude) {
		return 'n/a';
	}

	return `samples ${altitude.sampleCount}, path ${formatNumber(altitude.totalWeightKm)} km,`
		+ ` altitude min/avg/max ${formatNumber(altitude.minAltitudeKm)}`
		+ `/${formatNumber(altitude.weightedAverageAltitudeKm)}`
		+ `/${formatNumber(altitude.maxAltitudeKm)} km,`
		+ ` below 1/2/5/10 km ${formatPercent(altitude.fractionBelow1Km)}`
		+ `/${formatPercent(altitude.fractionBelow2Km)}`
		+ `/${formatPercent(altitude.fractionBelow5Km)}`
		+ `/${formatPercent(altitude.fractionBelow10Km)}`;
}

function formatSingleScatteringBudgetSummary(budget) {
	if (!budget?.peakContributionSample) {
		return 'n/a';
	}

	const peak = budget.peakContributionSample;
	const rayleigh = peak.species?.rayleigh;
	const mie = peak.species?.mie;

	return `total560 ${formatNumber(budget.totalContributionAt560)},`
		+ ` peak sample ${peak.sampleIndex} at ${formatNumber(peak.distanceFromObserverKm)} km`
		+ ` altitude ${formatNumber(peak.altitudeKm)} km,`
		+ ` viewT560 ${formatNumber(peak.viewTransmittanceAt560)},`
		+ ` sourceT560 ${formatNumber(peak.sourceTransmittanceAt560)},`
		+ ` angle ${formatNumber(peak.scatteringAngleDeg)} deg,`
		+ ` Rayleigh phase/sca/contrib ${formatNumber(rayleigh?.phaseSrInverse)}`
		+ `/${formatNumber(rayleigh?.scatteringCoefficientPerKm)}`
		+ `/${formatNumber(rayleigh?.contributionAt560)},`
		+ ` Mie phase/sca/contrib ${formatNumber(mie?.phaseSrInverse)}`
		+ `/${formatNumber(mie?.scatteringCoefficientPerKm)}`
		+ `/${formatNumber(mie?.contributionAt560)}`;
}

function formatMissingLightEstimate(estimate) {
	if (!estimate) {
		return 'n/a';
	}

	return `${estimate.assessment}: ${estimate.reason}`;
}

function formatDisabledTerms(disabledTerms) {
	if (!disabledTerms) {
		return 'n/a';
	}

	return Object.entries(disabledTerms)
		.map(([term, status]) => `${term}=${status}`)
		.join(', ');
}

function formatSpeciesTauSummary(speciesOpticalDepth, wavelengthsNm) {
	const entries = Object.entries(speciesOpticalDepth ?? {});

	if (entries.length === 0) {
		return 'n/a';
	}

	return entries.map(([speciesName, opticalDepth]) => {
		return `${speciesName}: ${formatSelectedSpectrum(
			opticalDepth.cumulativeOpticalDepthByWavelength,
			wavelengthsNm,
		)}`;
	}).join('; ');
}

function formatSpeciesRadianceSummary(speciesRadianceContribution, wavelengthsNm) {
	const entries = Object.entries(speciesRadianceContribution ?? {});

	if (entries.length === 0) {
		return 'n/a';
	}

	return entries.map(([speciesName, contribution]) => {
		return `${speciesName}: ${formatSelectedSpectrum(
			contribution.radianceByWavelength,
			wavelengthsNm,
		)}`;
	}).join('; ');
}

function formatNumber(value) {
	if (value === null || value === undefined) {
		return 'n/a';
	}

	if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
		return Number(value).toExponential(3);
	}

	return Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPlainNumber(value) {
	if (value === null || value === undefined) {
		return 'n/a';
	}

	return Number(value).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function formatPercent(value) {
	if (value === null || value === undefined) {
		return 'n/a';
	}

	return `${formatNumber(value * 100)}%`;
}

function averageOrNull(values) {
	if (!values.length) {
		return null;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rootMeanSquare(values) {
	if (!values.length) {
		return null;
	}

	return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length);
}

function cloneJsonValue(value) {
	return JSON.parse(JSON.stringify(value));
}

function normalizeOutputPath(outputPath) {
	return outputPath.replaceAll('\\', '/');
}

function relativeReportPath(targetPath, reportPath) {
	if (!reportPath) {
		return normalizeOutputPath(targetPath);
	}

	const relativePath = path.relative(
		path.dirname(path.resolve(reportPath)),
		path.resolve(targetPath),
	);

	return normalizeOutputPath(relativePath || path.basename(targetPath));
}

function writeFileEnsuringDirectory(outputPath, contents) {
	fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
	fs.writeFileSync(outputPath, contents);
}

export function runCli(argv = process.argv.slice(2), {
	stdout = process.stdout,
	stderr = process.stderr,
} = {}) {
	try {
		const options = parseArgs(argv);
		const progressReporter = createCliProgressReporter(options, stderr);

		if (options.help) {
			stdout.write(`${helpText()}\n`);
			return 0;
		}

		const result = runReferenceProbe({
			...options,
			progressReporter,
		});

		if (options.outPath) {
			progressReporter?.({ phase: 'write-output', path: options.outPath });
			writeFileEnsuringDirectory(options.outPath, `${JSON.stringify(result, null, 2)}\n`);
		}

		if (options.imagePath) {
			progressReporter?.({ phase: 'write-output', path: options.imagePath });
			writeFileEnsuringDirectory(options.imagePath, buildImageArtifact(result, options.imagePath));
		}

		if (options.multipleScatteringImageDir) {
			progressReporter?.({ phase: 'write-output', path: options.multipleScatteringImageDir });
			writeMultipleScatteringImageArtifacts(result, options.multipleScatteringImageDir);
		}

		if (options.reportPath) {
			progressReporter?.({ phase: 'write-output', path: options.reportPath });
			writeFileEnsuringDirectory(
				options.reportPath,
				`${buildMarkdownReport(result, {
					imagePath: options.imagePath,
					outPath: options.outPath,
					reportPath: options.reportPath,
				})}\n`,
			);
		}

		if (!options.outPath || options.format === 'summary') {
			stdout.write(options.format === 'summary'
				? `${formatSummary(result)}\n`
				: `${JSON.stringify(result, null, 2)}\n`);
		}

		progressReporter?.({ phase: 'done' });
		return 0;
	} catch (error) {
		stderr.write(`${error.message}\n`);
		return 1;
	}
}

function createCliProgressReporter(options, stderr) {
	if (options.progressLogPath) {
		return createCliProgressFileReporter(options.progressLogPath);
	}

	if (!options.progress) {
		return null;
	}

	return (event) => {
		stderr.write(`${formatProgressEvent(event)}\n`);
	};
}

function createCliProgressFileReporter(progressLogPath) {
	fs.mkdirSync(path.dirname(path.resolve(progressLogPath)), { recursive: true });
	fs.writeFileSync(progressLogPath, '');

	return (event) => {
		fs.appendFileSync(progressLogPath, `${formatProgressEvent(event)}\n`);
	};
}

function formatProgressEvent(event) {
	const timestamp = new Date().toISOString();

	if (event.phase === 'sky-patches-start') {
		return `[${timestamp}] sky-patches start patches=${event.patchCount} size=${event.patchSize.width}x${event.patchSize.height} wavelengths=${event.wavelengthCount}`;
	}

	if (event.phase === 'patch-start') {
		return `[${timestamp}] patch ${event.patchIndex + 1}/${event.patchCount} ${event.patchId} start size=${event.width}x${event.height} steps=${event.viewSteps}/${event.sunTransmittanceSteps} wavelengths=${event.wavelengthCount}`;
	}

	if (event.phase === 'patch-row') {
		return `[${timestamp}] patch ${event.patchIndex + 1}/${event.patchCount} ${event.patchId} row ${event.rowIndex + 1}/${event.rowCount}`;
	}

	if (event.phase === 'patch-complete') {
		return `[${timestamp}] patch ${event.patchIndex + 1}/${event.patchCount} ${event.patchId} complete`;
	}

	if (event.phase === 'sky-patches-complete') {
		return `[${timestamp}] sky-patches complete patches=${event.patchCount}`;
	}

	if (event.phase === 'sky-dome-grid-start') {
		return `[${timestamp}] sky-dome-grid start panels=${event.panelCount} size=${event.domeSize}x${event.domeSize} wavelengths=${event.wavelengthCount}`;
	}

	if (event.phase === 'sky-dome-panel-start') {
		return `[${timestamp}] sky-dome panel ${event.panelIndex + 1}/${event.panelCount} ${event.panelId} start size=${event.domeSize}x${event.domeSize} steps=${event.viewSteps}/${event.sunTransmittanceSteps} wavelengths=${event.wavelengthCount}`;
	}

	if (event.phase === 'sky-dome-panel-row') {
		return `[${timestamp}] sky-dome panel ${event.panelIndex + 1}/${event.panelCount} ${event.panelId} row ${event.rowIndex + 1}/${event.rowCount}`;
	}

	if (event.phase === 'sky-dome-panel-complete') {
		return `[${timestamp}] sky-dome panel ${event.panelIndex + 1}/${event.panelCount} ${event.panelId} complete`;
	}

	if (event.phase === 'sky-dome-grid-complete') {
		return `[${timestamp}] sky-dome-grid complete panels=${event.panelCount}`;
	}

	if (event.phase === 'multiple-scattering-start') {
		return `[${timestamp}] multiple-scattering ${event.mode} start targetMode=${event.targetMode ?? 'n/a'} targets=${event.targetCount} angularSamples=${event.angularSampleCount}`;
	}

	if (event.phase === 'multiple-scattering-target-start') {
		return `[${timestamp}] multiple-scattering target ${event.targetIndex + 1}/${event.targetCount} ${event.scenarioId} ${event.sampleRole} start`;
	}

	if (event.phase === 'multiple-scattering-target-complete') {
		return `[${timestamp}] multiple-scattering target ${event.targetIndex + 1}/${event.targetCount} ${event.scenarioId} ${event.sampleRole} complete`;
	}

	if (event.phase === 'multiple-scattering-complete') {
		return `[${timestamp}] multiple-scattering ${event.mode} complete targetMode=${event.targetMode ?? 'n/a'} targets=${event.targetCount}`;
	}

	if (event.phase === 'write-output') {
		return `[${timestamp}] write ${event.path}`;
	}

	if (event.phase === 'done') {
		return `[${timestamp}] done`;
	}

	return `[${timestamp}] ${event.phase ?? 'progress'}`;
}

export function formatSummary(result) {
	if (Array.isArray(result.lightExtents)) {
		return formatLightExtentSummary(result);
	}

	if (Array.isArray(result.skyPatches)) {
		return [
			`Atmosphere reference sky patches (${result.stage})`,
			...result.skyPatches.map((patch) => {
				const center = patch.diagnosticSamples.find((sample) => {
					return sample.x === Math.floor(patch.size.width / 2)
						&& sample.y === Math.floor(patch.size.height / 2);
				});

				return `- ${patch.id}: center=${center?.displayHex ?? center?.debugHex ?? 'n/a'} sampling=${patch.numerical?.samplingProfile?.id ?? 'n/a'} steps=${patch.numerical?.viewSteps ?? 'n/a'}/${patch.numerical?.sunTransmittanceSteps ?? 'n/a'} linearSrgb=${formatRgb(center?.linearSrgb)} radiance=${formatSelectedSpectrum(center?.renderedByWavelength ?? center?.finalByWavelength, patch.wavelengthsNm)} viewT=${formatSelectedSpectrum(center?.viewTransmittanceByWavelength, patch.wavelengthsNm)}`;
			}),
		].join('\n');
	}

	if (Array.isArray(result.skyDomePanels)) {
		return [
			`Atmosphere reference sky-dome grid (${result.stage})`,
			...result.skyDomePanels.map((panel) => {
				const center = skyDomeCenterSample(panel);
				const horizon = skyDomeHorizonEdgeSample(panel);

				return `- ${panel.id}: sunZenith=${formatNumber(panel.sunZenithDeg)} center=${center?.displayHex ?? 'n/a'} horizon=${horizon?.displayHex ?? 'n/a'} sampling=${panel.numerical?.samplingProfile?.id ?? 'n/a'} steps=${panel.numerical?.viewSteps ?? 'n/a'}/${panel.numerical?.sunTransmittanceSteps ?? 'n/a'} centerRadiance=${formatSelectedSpectrum(center?.renderedByWavelength, panel.wavelengthsNm)} horizonRadiance=${formatSelectedSpectrum(horizon?.renderedByWavelength, panel.wavelengthsNm)}`;
			}),
		].join('\n');
	}

	return [
		`Atmosphere reference probes (${result.stage})`,
		...result.probes.map((probe) => {
			return `- ${probe.id}: ${probe.visual.hex} final=${formatArray(probe.summary.finalByWavelength)} viewT=${formatArray(probe.summary.viewTransmittanceByWavelength)}`;
		}),
	].join('\n');
}

function directionFromElevationAzimuth(elevationDeg, azimuthDeg) {
	const elevationRad = degreesToRadians(elevationDeg);
	const azimuthRad = degreesToRadians(azimuthDeg);
	const horizontal = Math.cos(elevationRad);

	return normalize3([
		Math.sin(azimuthRad) * horizontal,
		Math.sin(elevationRad),
		Math.cos(azimuthRad) * horizontal,
	]);
}

function createUniformWavelengthGrid(startNm, endNm, stepNm) {
	const values = [];

	for (let wavelengthNm = startNm; wavelengthNm <= endNm; wavelengthNm += stepNm) {
		values.push(wavelengthNm);
	}

	return values;
}

function createCountedWavelengthGrid(startNm, endNm, count) {
	if (!Number.isInteger(count) || count < 2) {
		throw new Error(`Wavelength grid count must be an integer greater than 1; received ${count}`);
	}

	const stepNm = (endNm - startNm) / (count - 1);

	return Array.from({ length: count }, (_value, index) => {
		return startNm + stepNm * index;
	});
}

function defaultSkyDomeWavelengthGridId(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_WAVELENGTH_GRID_ID;
	}

	return DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID;
}

function defaultSkyDomeEncoding(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_DOME_ENCODING;
	}

	return DEFAULT_PIXEL_ENCODING;
}

function defaultSkyDomeToneMap(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_DOME_TONE_MAP;
	}

	return DEFAULT_TONE_MAP;
}

function defaultSkyDomeSolarSpectrumPolicy(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_ASTMG173_SOLAR_POLICY_ID;
	}

	return DEFAULT_SOLAR_SPECTRUM_POLICY;
}

function defaultSkyDomeRayleighPolicyId(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_RAYLEIGH_POLICY_ID;
	}

	return DEFAULT_RAYLEIGH_POLICY_ID;
}

function defaultSkyDomeAerosolPolicyId(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_AEROSOL_POLICY_ID;
	}

	return DEFAULT_AEROSOL_POLICY_ID;
}

function defaultSkyDomeAerosolPhasePolicyId(skyDomeVisualFit, aerosolPolicy) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_AEROSOL_PHASE_POLICY_ID;
	}

	return aerosolPolicy.defaultPhasePolicyId;
}

function defaultSkyDomeOzonePolicyId(skyDomeVisualFit) {
	if (skyDomeVisualFit === BRUNETON_GROUND_SINGLE_BOUNCE_FIT) {
		return BRUNETON_2016_OZONE_POLICY_ID;
	}

	return DEFAULT_OZONE_POLICY_ID;
}

export function resolveSkyPatchWavelengthGrid(gridId = DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID) {
	const definition = SKY_PATCH_WAVELENGTH_GRIDS[gridId];

	if (!definition) {
		throw new Error(`Unknown wavelength grid: ${gridId}`);
	}

	const wavelengthsNm = definition.count
		? createCountedWavelengthGrid(definition.startNm, definition.endNm, definition.count)
		: createUniformWavelengthGrid(definition.startNm, definition.endNm, definition.stepNm);
	const stepNm = definition.stepNm ?? (
		wavelengthsNm.length > 1
			? wavelengthsNm[1] - wavelengthsNm[0]
			: 0
	);

	return {
		id: definition.id,
		wavelengthsNm,
		metadata: {
			id: definition.id,
			label: definition.label,
			startNm: definition.startNm,
			endNm: definition.endNm,
			stepNm,
			count: wavelengthsNm.length,
			relationToCieTable: definition.relationToCieTable,
			resamplingPolicy: definition.resamplingPolicy,
			reference: definition.reference,
		},
	};
}

function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	return radians * 180 / Math.PI;
}

function normalizeDegrees(degrees) {
	const normalized = degrees % 360;

	return normalized < 0 ? normalized + 360 : normalized;
}

function formatDegreeId(degrees) {
	return String(Math.round(degrees)).padStart(3, '0');
}

function nearestNumberIndex(values, target) {
	let bestIndex = 0;
	let bestDistance = Infinity;

	for (const [index, value] of values.entries()) {
		const distance = Math.abs(value - target);

		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = index;
		}
	}

	return bestIndex;
}

function bracketingNumberIndices(values, target) {
	if (target <= values[0]) {
		return { lowerIndex: 0, upperIndex: 0, upperWeight: 0 };
	}

	const lastIndex = values.length - 1;
	if (target >= values[lastIndex]) {
		return { lowerIndex: lastIndex, upperIndex: lastIndex, upperWeight: 0 };
	}

	for (let index = 0; index < lastIndex; index += 1) {
		const lower = values[index];
		const upper = values[index + 1];

		if (target >= lower && target <= upper) {
			return {
				lowerIndex: index,
				upperIndex: index + 1,
				upperWeight: upper > lower ? (target - lower) / (upper - lower) : 0,
			};
		}
	}

	const nearestIndex = nearestNumberIndex(values, target);
	return { lowerIndex: nearestIndex, upperIndex: nearestIndex, upperWeight: 0 };
}

function nearestDirectionIndex(directions, targetDirection) {
	const normalized = normalize3(targetDirection);
	let bestIndex = 0;
	let bestDot = -Infinity;

	for (const [index, direction] of directions.entries()) {
		const score = dot3(direction, normalized);

		if (score > bestDot) {
			bestDot = score;
			bestIndex = index;
		}
	}

	return bestIndex;
}

function nearestDirectionNeighbors(directions, targetDirection, count) {
	const normalized = normalize3(targetDirection);

	return directions
		.map((direction, index) => {
			const dot = clamp01Signed(dot3(direction, normalized));

			return {
				index,
				dot,
				angleRad: Math.acos(dot),
			};
		})
		.sort((a, b) => b.dot - a.dot)
		.slice(0, Math.max(1, count));
}

function clamp01Signed(value) {
	return Math.max(-1, Math.min(1, value));
}

function normalize3(vector) {
	const length = Math.hypot(vector[0], vector[1], vector[2]);

	if (!Number.isFinite(length) || length === 0) {
		throw new RangeError('Expected a finite nonzero 3-vector');
	}

	return vector.map((component) => component / length);
}

function length3(vector) {
	return Math.hypot(vector[0], vector[1], vector[2]);
}

function dot3(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add3(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtract3(a, b) {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(vector, scale) {
	return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function cross(a, b) {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = runCli();
}
