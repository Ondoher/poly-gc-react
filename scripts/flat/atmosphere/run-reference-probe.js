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
	MOLECULAR_PROFILE_POLICY_IDS,
	molecularDensityScaleForPolicy,
	resolveMolecularProfilePolicy,
} from './composition/profile-policy.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_STAGE = 'full';
const DEFAULT_FORMAT = 'json';
const DEFAULT_COLOR_POLICY = 'official-cie';
const DEFAULT_PIXEL_ENCODING = 'srgb';
const DEFAULT_TONE_MAP = 'clip';
const DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID = 'preview-20nm';
const DEFAULT_SOLAR_SPECTRUM_POLICY = 'blackbody-5778k';
const DEFAULT_RAYLEIGH_POLICY_ID = 'rayleigh-lambda4-preview';
const DEFAULT_OZONE_POLICY_ID = 'preview-chappuis';
const DEFAULT_AEROSOL_POLICY_ID = 'preview-earthlike-aerosol';
const DEFAULT_MOLECULAR_PROFILE_POLICY_ID = 'preview-exponential-8km';
const DEFAULT_SUN_VISUAL = 'none';
const SUN_VISUAL_OPTIONS = Object.freeze(['none', 'diagnostic']);
const DEFAULT_SCATTERING_MODE = 'single';
const SCATTERING_MODE_OPTIONS = Object.freeze(['single', 'single-plus-haze-lift']);
const DEFAULT_HAZE_LIFT_STRENGTH = 0.015;
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
const DEBUG_RGB_WAVELENGTHS = Object.freeze({
	r: 650,
	g: 550,
	b: 450,
});
const SKY_PATCH_SIZE = Object.freeze({ width: 44, height: 28 });
const SKY_PATCH_MAX_PIXELS = 262144;
const DEFAULT_SKY_PATCH_IDS = Object.freeze([
	'midday.zenith',
	'midday.horizon',
	'sunset.horizon',
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
		sunTransmittanceSteps: 2,
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
		sunTransmittanceSteps: 2,
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
		sunTransmittanceSteps: 6,
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

		if (arg === '--scattering-mode') {
			options.scatteringMode = readOptionValue(argv, ++index, arg);
			options.skyPatches = true;
			continue;
		}

		if (arg === '--haze-lift-strength') {
			options.hazeLiftStrength = readFiniteNumberOption(argv, ++index, arg);
			options.skyPatches = true;
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

		if (arg === '--stage') {
			options.stage = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--format') {
			options.format = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--sky-patches') {
			options.skyPatches = true;
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

	if (options.toneMap && !['clip', 'preserve-hue'].includes(options.toneMap)) {
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

	if (options.solarSpectrum && !['blackbody-5778k', 'astm-g173'].includes(options.solarSpectrum)) {
		throw new Error(`Unknown solar spectrum policy: ${options.solarSpectrum}`);
	}

	if (options.rayleighPolicy && !RAYLEIGH_POLICY_IDS.includes(options.rayleighPolicy)) {
		throw new Error(`Unknown Rayleigh policy: ${options.rayleighPolicy}`);
	}

	if (options.aerosolPolicy && !aerosolPolicyIds().includes(options.aerosolPolicy)) {
		throw new Error(`Unknown aerosol policy: ${options.aerosolPolicy}`);
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

	if (options.scatteringMode && !SCATTERING_MODE_OPTIONS.includes(options.scatteringMode)) {
		throw new Error(`Unknown scattering mode: ${options.scatteringMode}`);
	}

	if (options.hazeLiftStrength !== undefined && options.hazeLiftStrength < 0) {
		throw new Error('--haze-lift-strength must be nonnegative');
	}

	if (options.skyPatches && options.lightExtent) {
		throw new Error('Choose only one of --sky-patches or --light-extent');
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

export function helpText() {
	const probeList = Object.values(BUILT_IN_PROBES)
		.map((probe) => `  ${probe.id.padEnd(24)} ${probe.description}`)
		.join('\n');

	return [
		'Usage: node scripts/flat/atmosphere/run-reference-probe.js [options]',
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
		'  --encoding srgb|linear  Select sky-patch pixel byte encoding. Default: srgb.',
		'  --tone-map clip|preserve-hue',
		'                          Select display tone mapping. Default: clip.',
		'  --exposure <scale>      Override sky-patch display exposure.',
		'  --wavelength-grid preview-20nm|benchmark-5nm|cie-1nm',
		'                          Select sky-patch wavelength sampling grid. Default: preview-20nm.',
		'  --solar-spectrum blackbody-5778k|astm-g173',
		'                          Select sky-patch solar source spectrum. Default: blackbody-5778k.',
		'  --rayleigh-policy rayleigh-lambda4-preview|bucholtz-standard-air',
		'                          Select sky-patch Rayleigh coefficient policy. Default: rayleigh-lambda4-preview.',
		`  --aerosol-policy ${aerosolPolicyIds().join('|')}`,
		'                          Select sky-patch aerosol/Mie policy. Default: preview-earthlike-aerosol.',
		'  --ozone-policy preview-chappuis|brion-1998-ozone-295k',
		'                          Select sky-patch ozone cross-section policy. Default: preview-chappuis.',
		'  --molecular-profile preview-exponential-8km|us-standard-atmosphere-1976-density',
		'                          Select sky-patch molecular density profile. Default: preview-exponential-8km.',
		'  --sun-visual none|diagnostic',
		'                          Add diagnostic finite-sun visual panels. Default: none.',
		'  --scattering-mode single|single-plus-haze-lift',
		'                          Select diagnostic transport-comparison mode. Default: single.',
		'  --haze-lift-strength <scale>',
		`                          Strength for single-plus-haze-lift. Default: ${DEFAULT_HAZE_LIFT_STRENGTH}.`,
		'  --patch-size WIDTHxHEIGHT',
		'                          Select sky-patch pixel dimensions. Default: 44x28.',
		'  --fov-y-deg <degrees>   Override sky-patch vertical field of view.',
		'  --format json|summary   Print JSON or concise summary to stdout.',
		'  --sky-patches           Render built-in sky patch views.',
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

	if (options.skyPatches) {
		return runSkyPatchSet(options);
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

function runSkyPatchSet(options = {}) {
	const colorPolicy = options.color ?? DEFAULT_COLOR_POLICY;
	const encoding = options.encoding ?? DEFAULT_PIXEL_ENCODING;
	const toneMap = options.toneMap ?? DEFAULT_TONE_MAP;
	const wavelengthGrid = resolveSkyPatchWavelengthGrid(options.wavelengthGrid);
	const solarSpectrumPolicy = options.solarSpectrum ?? DEFAULT_SOLAR_SPECTRUM_POLICY;
	const rayleighPolicy = resolveRayleighPolicy(options.rayleighPolicy ?? DEFAULT_RAYLEIGH_POLICY_ID);
	const aerosolPolicy = resolveAerosolPolicy(options.aerosolPolicy ?? DEFAULT_AEROSOL_POLICY_ID);
	const ozonePolicy = resolveOzonePolicy(options.ozonePolicy ?? DEFAULT_OZONE_POLICY_ID);
	const molecularProfilePolicy = resolveMolecularProfilePolicy(
		options.molecularProfile ?? DEFAULT_MOLECULAR_PROFILE_POLICY_ID,
	);
	const sunVisual = options.sunVisual ?? DEFAULT_SUN_VISUAL;
	const scatteringMode = options.scatteringMode ?? DEFAULT_SCATTERING_MODE;
	const hazeLiftStrength = options.hazeLiftStrength ?? DEFAULT_HAZE_LIFT_STRENGTH;
	const patchSize = options.patchSize ?? SKY_PATCH_SIZE;
	const selectedIds = options.patchIds?.length
		? options.patchIds
		: DEFAULT_SKY_PATCH_IDS;
	const skyPatches = selectedIds.map((id) => {
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
			ozonePolicy,
			molecularProfilePolicy,
			patchSize,
			fovYDegOverride: options.fovYDeg,
			sunVisual,
			scatteringMode,
			hazeLiftStrength,
		});
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
			scatteringMode: {
				id: scatteringMode,
				hazeLiftStrength,
				policy: scatteringMode === 'single-plus-haze-lift'
					? 'diagnostic approximation: adds a bounded aerosol-aware diffuse sky airlight term from source spectrum, view optical depth, aerosol optical depth, and lost view transmittance'
					: 'canonical single-scattering transport output',
			},
			wavelengthGrid: wavelengthGrid.metadata,
			patchSize,
			note: 'Patch colors integrate the sky spectrum through the selected CIE color policy, convert XYZ to linear sRGB, then apply display-only tone mapping, exposure, and byte encoding.',
		},
		model: createSkyPatchModelMetadata(rayleighPolicy, aerosolPolicy, ozonePolicy, molecularProfilePolicy),
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
	ozonePolicy,
	molecularProfilePolicy,
	patchSize,
	fovYDegOverride,
	sunVisual,
	scatteringMode,
	hazeLiftStrength,
}) {
	const cameraConfig = fovYDegOverride === undefined
		? scene.camera
		: { ...scene.camera, fovYDeg: fovYDegOverride };
	const wavelengthsNm = [...wavelengthGrid.wavelengthsNm];
	const numerical = {
		...DEFAULT_NUMERICAL,
		viewSteps: scene.viewSteps ?? 12,
		sunTransmittanceSteps: scene.sunTransmittanceSteps ?? 2,
		...(scatteringMode === 'single-plus-haze-lift'
			? { diffuseSkyAirlightStrength: hazeLiftStrength }
			: {}),
	};
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
		ozonePolicy,
		molecularProfilePolicy,
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
			const finalByWavelength = packet.spectralRadiance?.finalByWavelength
				?? wavelengthsNm.map(() => 0);
			const canonicalFinalByWavelength = subtractSpectrum(
				finalByWavelength,
				packet.diffuseSkyAirlight?.radianceByWavelength,
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
			const hazeLiftDiagnostic = createHazeLiftDiagnosticSpectrum({
				mode: scatteringMode,
				strength: hazeLiftStrength,
				solarSpectrum,
				finalByWavelength: canonicalFinalByWavelength,
				viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength,
				totalOpticalDepthByWavelength,
				wavelengthsNm,
				pipelineApproximation: packet.diffuseSkyAirlight,
			});
			const renderedByWavelength = hazeLiftDiagnostic.renderedByWavelength;
			const sunGeometry = createSunPixelGeometry(direction, sunDirection, packet);
			const directDiskByWavelength = createDiagnosticDirectDiskSpectrum({
				sunGeometry,
				solarSpectrum,
				viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength,
				wavelengthsNm,
			});
			const combinedByWavelength = renderedByWavelength.map((value, wavelengthIndex) => {
				return value + directDiskByWavelength[wavelengthIndex];
			});
			const displayExposure = exposureOverride ?? scene.displayExposure ?? 1;
			const rgb = createPatchRgb(renderedByWavelength, wavelengthsNm, {
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
					finalByWavelength: renderedByWavelength,
					canonicalFinalByWavelength,
					diagnosticHazeLiftByWavelength: hazeLiftDiagnostic.addedByWavelength,
				},
				xyz: rgb.xyz,
				linearRgb: rgb.linearRgb,
				colorProvenance: rgb.colorProvenance,
			});
			if (sunDiagnosticSources) {
				appendSunDiagnosticSources(sunDiagnosticSources, {
					sunGeometry,
					finalByWavelength: renderedByWavelength,
					directDiskByWavelength,
					combinedByWavelength,
					wavelengthsNm,
					colorPolicy,
				});
				addSunAngleBucketSample(sunAngleBucketAccumulators, {
					sunGeometry,
					skyRadianceByWavelength: renderedByWavelength,
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
					skyRadianceByWavelength: renderedByWavelength,
					renderedRadianceByWavelength: renderedByWavelength,
					hazeLiftDiagnostic,
					directDiskByWavelength,
					combinedByWavelength,
					viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
					speciesOpticalDepth,
					totalOpticalDepthByWavelength,
					opticalDepthValidity,
					speciesRadianceContribution,
					skyCompletenessDiagnostics,
				};
			}

			if (x === centerColumnX) {
				horizonProfileSamples.push(createHorizonProfileSample({
					x,
					y,
					direction,
					packet,
					rgb,
					renderedByWavelength,
					canonicalFinalByWavelength,
					hazeLiftDiagnostic,
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
					finalByWavelength: canonicalFinalByWavelength,
					renderedByWavelength,
					hazeLiftDiagnostic,
					viewTransmittanceByWavelength: pathEnd?.viewTransmittanceByWavelength ?? null,
					speciesOpticalDepth,
					totalOpticalDepthByWavelength,
					opticalDepthValidity,
					speciesRadianceContribution,
					skyCompletenessDiagnostics,
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

	return {
		id: scene.id,
		label: scene.label,
		description: scene.description,
		stage,
		size: { ...patchSize },
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
		scatteringMode: {
			id: scatteringMode,
			hazeLiftStrength,
			policy: scatteringMode === 'single-plus-haze-lift'
				? 'diagnostic approximation: adds a bounded aerosol-aware diffuse sky airlight term from source spectrum, view optical depth, aerosol optical depth, and lost view transmittance'
				: 'canonical single-scattering transport output',
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
			asymmetryG: aerosolPolicy.asymmetryG,
			scaleHeightKm: aerosolPolicy.scaleHeightKm,
		},
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
	renderedByWavelength,
	canonicalFinalByWavelength,
	hazeLiftDiagnostic,
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
		renderedByWavelength,
		canonicalFinalByWavelength,
		hazeLiftByWavelength: hazeLiftDiagnostic.addedByWavelength,
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
			? 'view max tau is in a high-tau regime; single scattering is qualitative and may understate pale haze lift'
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

function createHazeLiftDiagnosticSpectrum({
	mode,
	strength,
	solarSpectrum,
	finalByWavelength,
	viewTransmittanceByWavelength,
	totalOpticalDepthByWavelength,
	wavelengthsNm,
	pipelineApproximation,
}) {
	if (pipelineApproximation) {
		return {
			mode: pipelineApproximation.mode ?? mode ?? DEFAULT_SCATTERING_MODE,
			strength: pipelineApproximation.diagnostics?.strength ?? strength,
			addedByWavelength: [...(pipelineApproximation.radianceByWavelength ?? wavelengthsNm.map(() => 0))],
			renderedByWavelength: [...(pipelineApproximation.renderedSinglePlusSkyAirlightByWavelength ?? finalByWavelength)],
			activation: pipelineApproximation.diagnostics?.activation ?? 0,
			tau560: selectedSpectrumValues(
				totalOpticalDepthByWavelength,
				wavelengthsNm,
				[560],
			)[0]?.value ?? null,
			maxTau: pipelineApproximation.diagnostics?.activationTau ?? null,
			policy: 'canonical pipeline integrateDiffuseSkyAirlight aerosol-aware output',
		};
	}

	if (mode !== 'single-plus-haze-lift') {
		return {
			mode: mode ?? DEFAULT_SCATTERING_MODE,
			strength,
			addedByWavelength: wavelengthsNm.map(() => 0),
			renderedByWavelength: [...finalByWavelength],
			activation: 0,
			tau560: null,
			policy: 'disabled',
		};
	}

	const wavelengthIndex560 = nearestWavelengthIndex(wavelengthsNm, 560);
	const tau560 = totalOpticalDepthByWavelength?.[wavelengthIndex560] ?? 0;
	const maxTau = Array.isArray(totalOpticalDepthByWavelength)
		? Math.max(...totalOpticalDepthByWavelength)
		: 0;
	const activation = smoothstep(1, 8, maxTau);
	const transmittance = Array.isArray(viewTransmittanceByWavelength)
		? viewTransmittanceByWavelength
		: wavelengthsNm.map(() => 1);
	const addedByWavelength = wavelengthsNm.map((_, wavelengthIndex) => {
		const lostViewLight = 1 - Math.max(0, Math.min(1, transmittance[wavelengthIndex] ?? 1));
		const sourceValue = solarSpectrum.valuesByWavelength[wavelengthIndex] ?? 0;

		return sourceValue * lostViewLight * activation * strength;
	});

	return {
		mode,
		strength,
		addedByWavelength,
		renderedByWavelength: finalByWavelength.map((value, wavelengthIndex) => {
			return value + addedByWavelength[wavelengthIndex];
		}),
		activation,
		tau560,
		maxTau,
		policy: 'diagnostic bounded diffuse sky airlight fallback from lost view transmittance; full pipeline uses integrateDiffuseSkyAirlight aerosol-aware output',
	};
}

function subtractSpectrum(values, subtractValues) {
	if (!Array.isArray(subtractValues)) {
		return [...values];
	}

	return values.map((value, index) => {
		return value - (subtractValues[index] ?? 0);
	});
}

function smoothstep(edge0, edge1, value) {
	if (edge0 === edge1) {
		return value >= edge1 ? 1 : 0;
	}

	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));

	return t * t * (3 - 2 * t);
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

function createSkyPatchModel(
	scene,
	wavelengthsNm,
	solarSpectrum,
	rayleighPolicy,
	aerosolPolicy,
	ozonePolicy,
	molecularProfilePolicy,
) {
	const planetRadiusKm = EARTH_LIKE_SKY.planetRadiusKm;
	const atmosphereRadiusKm = planetRadiusKm + EARTH_LIKE_SKY.atmosphereTopAltitudeKm;
	const planetCenterKm = [0, -planetRadiusKm, 0];
	const sunDirection = directionFromElevationAzimuth(
		scene.sunElevationDeg ?? 45,
		scene.sunAzimuthDeg ?? 0,
	);

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
			aerosolAsymmetryG: aerosolPolicy.asymmetryG,
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

				return [{
					id: 'earth-like-sun',
					direction: sunDirection,
					weight: 1,
					solidAngleSr: 1,
					sourceSpectrum: {
						kind: 'spectral-irradiance',
						valuesByWavelength: solarSpectrum.valuesByWavelength,
						units: 'W m-2 nm-1',
						derivation: solarSpectrum.provenance.title,
						provenance: solarSpectrum.provenance,
					},
				}];
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
					kind: 'henyey-greenstein',
					parameters: { g: aerosolPolicy.asymmetryG },
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

function createSkyPatchModelMetadata(rayleighPolicy, aerosolPolicy, ozonePolicy, molecularProfilePolicy) {
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
			aerosolAsymmetryG: aerosolPolicy.asymmetryG,
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
			asymmetryG: aerosolPolicy.asymmetryG,
			scaleHeightKm: aerosolPolicy.scaleHeightKm,
			defaultPolicy: DEFAULT_AEROSOL_POLICY_ID,
		},
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
			aerosol: 'henyey-greenstein',
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
		'This report is generated by `scripts/flat/atmosphere/run-reference-probe.js`.',
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
	return pixelImageToPng(composeSkyPatchPixelImage(result, 'PNG'));
}

export function buildPpm(result) {
	return pixelImageToPpm(composeSkyPatchPixelImage(result, 'PPM'));
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
		'This report is generated by `scripts/flat/atmosphere/run-reference-probe.js --sky-patches`.',
		'',
		'The image is made from many `traceRay` calls through the current canonical transport stages. The adapters are intentionally basic: a small camera model, a spherical Earth-like sky shell, named top-of-atmosphere solar spectrum samples, named Rayleigh/aerosol/ozone/profile composition policies, and official CIE 1931 2-degree table-backed XYZ to sRGB display mapping. This is meant to show colors and gradients now, not final validated Earth truth.',
		imageLink,
		jsonLink,
		`Stage: \`${result.stage}\``,
		`Patch count: \`${result.skyPatchCount}\``,
		`Model: \`${result.model?.kind ?? 'n/a'}\``,
		`Display: \`${result.visual?.colorSpace ?? 'n/a'}\`, encoding \`${result.visual?.encoding ?? 'n/a'}\`, tone map \`${result.visual?.toneMap ?? 'n/a'}\`, exposure \`${result.visual?.exposure ?? 'n/a'}\`, solar \`${result.visual?.solarSpectrum?.policy ?? 'n/a'}\`, Rayleigh \`${result.visual?.rayleighPolicy?.id ?? 'n/a'}\`, aerosol \`${result.visual?.aerosolPolicy?.id ?? 'n/a'}\`, ozone \`${result.visual?.ozonePolicy?.id ?? 'n/a'}\`, molecular profile \`${result.visual?.molecularProfile?.id ?? 'n/a'}\`, grid \`${formatWavelengthGrid(result.visual?.wavelengthGrid)}\``,
		`Scattering mode: \`${result.visual?.scatteringMode?.id ?? 'single'}\`, haze-lift strength \`${formatNumber(result.visual?.scatteringMode?.hazeLiftStrength)}\`, policy \`${result.visual?.scatteringMode?.policy ?? 'n/a'}\``,
		`Sun visual: \`${result.visual?.sunVisual?.mode ?? 'none'}\`, solar angular diameter \`${formatNumber(result.visual?.sunVisual?.solarAngularDiameterDeg)} deg\``,
		...(result.visual?.sunVisual?.mode === 'diagnostic'
			? [
				'',
				'Diagnostic panel order for PNG/PPM output: sky-only, angular-distance heatmap, disk mask, direct-disk approximation, sky-plus-disk approximation.',
			]
			: []),
		`World parameters: radius \`${formatPlainNumber(result.model?.parameters?.planetRadiusKm)} km\`, atmosphere top \`${formatPlainNumber(result.model?.parameters?.atmosphereTopAltitudeKm)} km\`, Rayleigh scale height \`${formatPlainNumber(result.model?.parameters?.rayleighScaleHeightKm)} km\`, aerosol optical depth 550 nm \`${formatPlainNumber(result.model?.parameters?.aerosolOpticalDepth550Nm)}\`, aerosol g \`${formatPlainNumber(result.model?.parameters?.aerosolAsymmetryG)}\`, ozone \`${formatPlainNumber(result.model?.parameters?.ozoneDobsonUnits)} DU\``,
		'',
		'| Patch | View | Center display | Cells | Preview exposure | Center linear sRGB | Center rendered radiance samples | Center transmittance samples |',
		'| --- | --- | --- | ---: | ---: | --- | --- | --- |',
		...rows.map((row) => `| ${row} |`),
		'',
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
				`- Ozone policy: \`${patch.ozonePolicy?.id ?? 'n/a'}\``,
				`- Molecular profile: \`${patch.molecularProfile?.id ?? 'n/a'}\``,
				`- Scattering mode: \`${patch.scatteringMode?.id ?? 'single'}\`, haze-lift strength \`${formatNumber(patch.scatteringMode?.hazeLiftStrength)}\``,
				`- Sun/source: \`${patch.sun.mode ?? `${patch.sun.elevationDeg} deg elevation`}\``,
				`- Center canonical radiance: \`${formatSelectedSpectrum(centerSample?.finalByWavelength, patch.wavelengthsNm)}\``,
				`- Center rendered radiance: \`${formatSelectedSpectrum(centerSample?.renderedByWavelength ?? centerSample?.finalByWavelength, patch.wavelengthsNm)}\``,
				`- Center haze lift: \`${formatHazeLiftDiagnostic(centerSample?.hazeLiftDiagnostic, patch.wavelengthsNm)}\``,
				`- Center optical-depth validity: \`${formatOpticalDepthValiditySummary(centerSample?.opticalDepthValidity)}\``,
				`- Center scattering geometry: \`${formatPhaseDiagnosticSummary(centerSample?.skyCompletenessDiagnostics?.phase)}\``,
				`- Center altitude distribution: \`${formatAltitudeDistributionSummary(centerSample?.skyCompletenessDiagnostics?.altitude)}\``,
				`- Center single-scattering budget: \`${formatSingleScatteringBudgetSummary(centerSample?.skyCompletenessDiagnostics?.singleScatteringBudget)}\``,
				`- Missing-light estimate: \`${formatMissingLightEstimate(centerSample?.skyCompletenessDiagnostics?.missingLightEstimate)}\``,
				`- Disabled completeness terms: \`${formatDisabledTerms(centerSample?.skyCompletenessDiagnostics?.disabledTerms)}\``,
				`- Horizon profile: \`${formatHorizonProfileSummary(patch.horizonProfile)}\``,
				'',
				'| Center-column row | Elevation | Class | Display | Linear luminance | Rendered radiance | Haze lift | View transmittance | Tau class |',
				'| ---: | ---: | --- | --- | ---: | --- | --- | --- | --- |',
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
		return ['| n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |'];
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
			formatSelectedSpectrum(sample.renderedByWavelength, wavelengthsNm),
			formatSelectedSpectrum(sample.hazeLiftByWavelength, wavelengthsNm),
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

function formatHazeLiftDiagnostic(diagnostic, wavelengthsNm) {
	if (!diagnostic) {
		return 'n/a';
	}

	return `activation ${formatNumber(diagnostic.activation)}, maxTau ${formatNumber(diagnostic.maxTau)}, tau560 ${formatNumber(diagnostic.tau560)}, added ${formatSelectedSpectrum(diagnostic.addedByWavelength, wavelengthsNm)}`;
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

		if (options.help) {
			stdout.write(`${helpText()}\n`);
			return 0;
		}

		const result = runReferenceProbe(options);

		if (options.outPath) {
			writeFileEnsuringDirectory(options.outPath, `${JSON.stringify(result, null, 2)}\n`);
		}

		if (options.imagePath) {
			writeFileEnsuringDirectory(options.imagePath, buildImageArtifact(result, options.imagePath));
		}

		if (options.reportPath) {
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

		return 0;
	} catch (error) {
		stderr.write(`${error.message}\n`);
		return 1;
	}
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

				return `- ${patch.id}: center=${center?.displayHex ?? center?.debugHex ?? 'n/a'} linearSrgb=${formatRgb(center?.linearSrgb)} radiance=${formatSelectedSpectrum(center?.renderedByWavelength ?? center?.finalByWavelength, patch.wavelengthsNm)} viewT=${formatSelectedSpectrum(center?.viewTransmittanceByWavelength, patch.wavelengthsNm)}`;
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

export function resolveSkyPatchWavelengthGrid(gridId = DEFAULT_SKY_PATCH_WAVELENGTH_GRID_ID) {
	const definition = SKY_PATCH_WAVELENGTH_GRIDS[gridId];

	if (!definition) {
		throw new Error(`Unknown wavelength grid: ${gridId}`);
	}

	const wavelengthsNm = createUniformWavelengthGrid(definition.startNm, definition.endNm, definition.stepNm);

	return {
		id: definition.id,
		wavelengthsNm,
		metadata: {
			id: definition.id,
			label: definition.label,
			startNm: definition.startNm,
			endNm: definition.endNm,
			stepNm: definition.stepNm,
			count: wavelengthsNm.length,
			relationToCieTable: definition.relationToCieTable,
			resamplingPolicy: definition.resamplingPolicy,
		},
	};
}

function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	return radians * 180 / Math.PI;
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
