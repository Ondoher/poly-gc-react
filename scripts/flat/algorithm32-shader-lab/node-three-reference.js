import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const SCRIPT_PATH = path.relative(REPO_ROOT, __filename).replaceAll('\\', '/');
const CLEANROOM_SCRIPT_PATH = 'scripts/flat/experimental/bruneton-start-fresh.js';
const ALGORITHM32_DOC_PATH =
	'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/experiment-032-algorithm.md';
const PLAN_DOC_PATH =
	'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/algorithm32-shader-lab-plan.md';

const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	observerHeightMeters: 2,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
	ozoneAbsorption: 0,
});

const NUMERICAL_CONTROLS = Object.freeze({
	viewRayScatteringIntervals: 20,
	sampleToSunTransmittanceIntervals: 10,
	secondOrderIncomingDirections: 17,
	secondOrderIncidentAltitudeBins: 24,
});

const IMAGE_DEFAULTS = Object.freeze({
	width: 96,
	height: 54,
});
const SCENE_MODES = Object.freeze({
	threeCardReference: 'three-card-reference',
	sunsetFloor: 'sunset-floor',
	mountainRidges: 'mountain-ridges',
});
const SUNSET_FLOOR_FRAMINGS = Object.freeze({
	balanced: {
		id: 'balanced',
		cameraHeightMeters: ATMOSPHERE.observerHeightMeters,
		verticalFovDegrees: 58,
		lookDistanceMeters: 5000,
		lookUpRatio: 0.07,
		backMeters: 0,
	},
	moreSky: {
		id: 'more-sky',
		cameraHeightMeters: 2.5,
		verticalFovDegrees: 64,
		lookDistanceMeters: 8000,
		lookUpRatio: 0.3,
		backMeters: 80,
	},
	lessZoom: {
		id: 'less-zoom',
		cameraHeightMeters: ATMOSPHERE.observerHeightMeters,
		verticalFovDegrees: 92,
		lookDistanceMeters: 8000,
		lookUpRatio: 0.08,
		backMeters: 0,
	},
});
const MOUNTAIN_VIEW_MODES = Object.freeze({
	frontHighSun: 'front-high-sun',
	sunsetBehindCamera: 'sunset-behind-camera',
});
const SCATTERING_ORDERS = Object.freeze({
	algorithm32: 'algorithm32',
	firstOrder: 'first-order',
});

const SPECTRAL_DELTA_NM = (830 - 360) / 15;
const SPECTRAL_CHANNELS = [
	{
		wavelengthNanometers: 375.666666666667,
		solarIrradiance: 1.068866666667,
		cie: [0.00082512, 0.000024284, 0.00388120013333],
	},
	{
		wavelengthNanometers: 407,
		solarIrradiance: 1.729673,
		cie: [0.031318, 0.000868, 0.14908],
	},
	{
		wavelengthNanometers: 438.333333333333,
		solarIrradiance: 1.862071666667,
		cie: [0.341686666667, 0.0209466666667, 1.70569333333],
	},
	{
		wavelengthNanometers: 469.666666666667,
		solarIrradiance: 2.022063333333,
		cie: [0.199076, 0.0898413333333, 1.30367066667],
	},
	{
		wavelengthNanometers: 501,
		solarIrradiance: 1.908154,
		cie: [0.0044, 0.33986, 0.26006],
	},
	{
		wavelengthNanometers: 532.333333333333,
		solarIrradiance: 1.883391,
		cie: [0.19361662, 0.88666338, 0.0364106666667],
	},
	{
		wavelengthNanometers: 563.666666666667,
		solarIrradiance: 1.834246666667,
		cie: [0.656026666667, 0.982973333333, 0.00305666593333],
	},
	{
		wavelengthNanometers: 595,
		solarIrradiance: 1.76744,
		cie: [1.0567, 0.6949, 0.001],
	},
	{
		wavelengthNanometers: 626.333333333333,
		solarIrradiance: 1.65952,
		cie: [0.722333333333, 0.306066666667, 0.000086666664],
	},
	{
		wavelengthNanometers: 657.666666666667,
		solarIrradiance: 1.548102333333,
		cie: [0.190006666667, 0.0706133333333, 0],
	},
	{
		wavelengthNanometers: 689,
		solarIrradiance: 1.45078,
		cie: [0.02474, 0.008952, 0],
	},
	{
		wavelengthNanometers: 720.333333333333,
		solarIrradiance: 1.340960333333,
		cie: [0.0028426512, 0.00102653333333, 0],
	},
	{
		wavelengthNanometers: 751.666666666667,
		solarIrradiance: 1.262433333333,
		cie: [0.000299809433333, 0.000108266666667, 0],
	},
	{
		wavelengthNanometers: 783,
		solarIrradiance: 1.175208,
		cie: [0.000034215932, 0.000012356, 0],
	},
	{
		wavelengthNanometers: 814.333333333333,
		solarIrradiance: 1.090824,
		cie: [0.00000378221413333, 0.00000136582666667, 0],
	},
].map((channel) => ({
	...channel,
	wavelengthBinWidthNanometers: SPECTRAL_DELTA_NM,
}));

const XYZ_TO_SRGB = [
	3.2406, -1.5372, -0.4986,
	-0.9689, 1.8758, 0.0415,
	0.0557, -0.204, 1.057,
];
const MAX_LUMINOUS_EFFICACY = 683;
const BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE = 5;
const DISPLAY_TONE_MAP_K =
	1 / (BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE * MAX_LUMINOUS_EFFICACY);

const SUN_CASES = [
	{
		id: 'figure1-06h00-z87',
		sourceTimeOfDay: '06h00',
		sourceSunZenithDegrees: 87,
		sunAltitudeDegrees: 3,
		sunAzimuthDegrees: -25.83454348280912,
		role: 'sunrise/sunset stress case',
	},
	{
		id: 'figure1-13h15-z21',
		sourceTimeOfDay: '13h15',
		sourceSunZenithDegrees: 21,
		sunAltitudeDegrees: 69,
		sunAzimuthDegrees: 85.31410016049729,
		role: 'highest-Sun render and stress case',
	},
];
const RENDER_SUN_CASE_ID = 'figure1-13h15-z21';

const SOURCE_REFERENCES = [
	{
		id: 'algorithm32-cleanroom-script',
		title: 'Experiment 032 cleanroom script',
		path: CLEANROOM_SCRIPT_PATH,
		usedFor: [
			'implementation guide for Algorithm32 kernels',
			'active experiment-032 constant set',
		],
	},
	{
		id: 'algorithm32-algorithm-doc',
		title: 'Experiment 032 algorithm document',
		path: ALGORITHM32_DOC_PATH,
		usedFor: [
			'accepted Algorithm32 equations, constants, and source labels',
			'Algorithm32 direct-trace contract',
		],
	},
	{
		id: 'bruneton-functions-glsl',
		title: 'Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/functions.glsl',
		url:
			'https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/functions.glsl',
		usedFor: [
			'top-atmosphere boundary distance',
			'optical-length integration',
			'Beer-Lambert transmittance',
			'single-scattering integrand',
			'Rayleigh and Cornette-Shanks Mie phase functions',
		],
	},
	{
		id: 'bruneton-demo-constants',
		title: 'Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/demo/demo.cc',
		url:
			'https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/demo/demo.cc',
		usedFor: [
			'Earth radii',
			'Rayleigh and Mie scale heights',
			'Rayleigh wavelength law',
			'solar irradiance table used by the cleanroom script',
		],
	},
	{
		id: 'bruneton-2016-clear-sky-parameters',
		title: 'Eric Bruneton, A Qualitative and Quantitative Evaluation of 8 Clear Sky Models',
		url: 'https://arxiv.org/abs/1612.04336',
		usedFor: [
			'aerosol Angstrom alpha 0.8',
			'aerosol Angstrom beta 0.04',
			'aerosol single-scattering albedo 0.8',
			'Mie phase asymmetry g 0.7',
			'Figure 1 Sun cases',
		],
	},
	{
		id: 'bruneton-color-constants',
		title: 'Eric Bruneton, Precomputed Atmospheric Scattering, atmosphere/constants.h',
		url:
			'https://github.com/ebruneton/precomputed_atmospheric_scattering/blob/master/atmosphere/constants.h',
		usedFor: [
			'CIE 1931 color matching constants',
			'XYZ to linear sRGB matrix',
			'maximum luminous efficacy 683',
		],
	},
	{
		id: 'bruneton-2016-comparison-source-tone-map',
		title: 'Eric Bruneton, clear-sky-models comparison source, atmosphere/comparisons.cc',
		url:
			'https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/comparisons.cc',
		usedFor: ['display-only k = 1 / (5 * 683) tone map'],
	},
	{
		id: 'gonzalez-2009-fibonacci-sphere-lattice',
		title: 'Alvaro Gonzalez, Measurement of areas on a sphere using Fibonacci and latitude-longitude lattices',
		url: 'https://arxiv.org/abs/0912.4540',
		usedFor: ['full-sphere Fibonacci direction set for second-order sampling'],
	},
	{
		id: 'three-raycaster',
		title: 'Three.js Raycaster documentation',
		url: 'https://threejs.org/docs/#api/en/core/Raycaster',
		usedFor: ['scene hit detection used as the geometry input to Algorithm32'],
	},
];

const SPECTRA = {
	black: {
		id: 'black',
		label: 'Black zero-radiance object',
		evaluate: () => 0,
	},
	neutral: {
		id: 'neutral',
		label: 'Neutral diagnostic object radiance',
		evaluate: () => 0.035,
	},
	red: {
		id: 'red',
		label: 'Red-biased card radiance',
		evaluate: (lambdaNm) => (lambdaNm >= 626.333333333333 ? 0.045 : 0.003),
	},
	green: {
		id: 'green',
		label: 'Green-biased card radiance',
		evaluate: (lambdaNm) =>
			0.002 +
			0.05 * triangularSpectrumWeight(lambdaNm, 532.333333333333, 65) +
			0.012 * triangularSpectrumWeight(lambdaNm, 563.666666666667, 60),
	},
	blue: {
		id: 'blue',
		label: 'Blue-biased card radiance',
		evaluate: (lambdaNm) => (lambdaNm <= 501 ? 0.045 : 0.003),
	},
	ground: {
		id: 'ground',
		label: 'Neutral low-radiance ground',
		evaluate: () => 0.012,
	},
	grassGreenFloor: {
		id: 'grass_green_floor',
		label: 'Grass green floor radiance',
		evaluate: (lambdaNm) =>
			0.0015 +
			0.03 * triangularSpectrumWeight(lambdaNm, 532.333333333333, 70) +
			0.015 * triangularSpectrumWeight(lambdaNm, 563.666666666667, 75) +
			0.002 * triangularSpectrumWeight(lambdaNm, 626.333333333333, 110),
	},
	mountainRidgeGreen: {
		id: 'mountain_ridge_green',
		label: 'Mountain ridge synthetic green radiance',
		evaluate: (lambdaNm) =>
			0.0012 +
			0.012 * triangularSpectrumWeight(lambdaNm, 469.666666666667, 130) +
			0.018 * triangularSpectrumWeight(lambdaNm, 532.333333333333, 85) +
			0.016 * triangularSpectrumWeight(lambdaNm, 563.666666666667, 95) +
			0.003 * triangularSpectrumWeight(lambdaNm, 626.333333333333, 130),
	},
};

const CARD_DEFINITIONS = [
	{
		id: 'near-red-card',
		spectrumId: 'red',
		center: new THREE.Vector3(-260, 130, -1000),
		width: 260,
		height: 260,
		materialColor: 0xcc2936,
	},
	{
		id: 'middle-green-card',
		spectrumId: 'green',
		center: new THREE.Vector3(0, 440, -5000),
		width: 900,
		height: 900,
		materialColor: 0x3a8f43,
	},
	{
		id: 'far-blue-card',
		spectrumId: 'blue',
		center: new THREE.Vector3(5200, 1800, -22000),
		width: 3600,
		height: 3600,
		materialColor: 0x2b68c0,
	},
];

const MOUNTAIN_RIDGE_SCENE = Object.freeze({
	cameraPositionMeters: [0, 350, 1400],
	lookAtMeters: [0, 260, -36000],
	verticalFovDegrees: 42,
	nearMeters: 0.1,
	farMeters: 150000,
	valleyFloor: {
		id: 'mountain-valley-floor',
		widthMeters: 140000,
		depthMeters: 160000,
		centerMeters: [0, 0, -36000],
		materialColor: 0x315b34,
		maskRgb: [82, 102, 78],
	},
});

const MOUNTAIN_RIDGE_DEFINITIONS = [
	{
		id: 'foreground-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -5600,
		bottomMeters: -6000,
		baseHeightMeters: 70,
		amplitudeMeters: 150,
		secondaryAmplitudeMeters: 70,
		frequency: 1.85,
		phase: 0.35,
		peakT: 0.44,
		peakHeightMeters: 120,
		peakWidth: 0.18,
		sampleT: 0.62,
		materialColor: 0x2d6730,
		maskRgb: [40, 150, 80],
	},
	{
		id: 'near-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -9800,
		bottomMeters: -6000,
		baseHeightMeters: 280,
		amplitudeMeters: 260,
		secondaryAmplitudeMeters: 110,
		frequency: 2.15,
		phase: 1.6,
		peakT: 0.58,
		peakHeightMeters: 190,
		peakWidth: 0.2,
		sampleT: 0.44,
		materialColor: 0x336f34,
		maskRgb: [58, 170, 88],
	},
	{
		id: 'near-valley-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -15500,
		bottomMeters: -7000,
		baseHeightMeters: 620,
		amplitudeMeters: 370,
		secondaryAmplitudeMeters: 160,
		frequency: 2.9,
		phase: 2.25,
		peakT: 0.34,
		peakHeightMeters: 260,
		peakWidth: 0.18,
		sampleT: 0.5,
		materialColor: 0x376d45,
		maskRgb: [80, 175, 115],
	},
	{
		id: 'middle-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -26000,
		bottomMeters: -7600,
		baseHeightMeters: 1060,
		amplitudeMeters: 480,
		secondaryAmplitudeMeters: 180,
		frequency: 2.35,
		phase: 0.85,
		peakT: 0.54,
		peakHeightMeters: 340,
		peakWidth: 0.24,
		sampleT: 0.58,
		materialColor: 0x3d7460,
		maskRgb: [100, 190, 150],
	},
	{
		id: 'far-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -43000,
		bottomMeters: -8000,
		baseHeightMeters: 1850,
		amplitudeMeters: 610,
		secondaryAmplitudeMeters: 210,
		frequency: 2.75,
		phase: 2.85,
		peakT: 0.68,
		peakHeightMeters: 440,
		peakWidth: 0.2,
		sampleT: 0.7,
		materialColor: 0x4c7f79,
		maskRgb: [125, 205, 205],
	},
	{
		id: 'horizon-ridge',
		xMinMeters: -100000,
		xMaxMeters: 100000,
		zMeters: -72000,
		bottomMeters: -8500,
		baseHeightMeters: 3200,
		amplitudeMeters: 620,
		secondaryAmplitudeMeters: 210,
		frequency: 3.15,
		phase: 1.2,
		peakT: 0.48,
		peakHeightMeters: 520,
		peakWidth: 0.28,
		sampleT: 0.5,
		materialColor: 0x63898a,
		maskRgb: [165, 220, 230],
	},
];

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		width: IMAGE_DEFAULTS.width,
		height: IMAGE_DEFAULTS.height,
		label: 'node-three-algorithm32-reference',
		sceneMode: SCENE_MODES.threeCardReference,
		sunsetFraming: SUNSET_FLOOR_FRAMINGS.balanced.id,
		mountainView: MOUNTAIN_VIEW_MODES.frontHighSun,
		scatteringOrder: SCATTERING_ORDERS.algorithm32,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--width') {
			options.width = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--height') {
			options.height = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
			index += 1;
		} else if (arg === '--scene') {
			options.sceneMode = argv[index + 1];
			index += 1;
		} else if (arg === '--sunset-framing') {
			options.sunsetFraming = argv[index + 1];
			index += 1;
		} else if (arg === '--mountain-view') {
			options.mountainView = argv[index + 1];
			index += 1;
		} else if (arg === '--scattering-order') {
			options.scatteringOrder = argv[index + 1];
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!Number.isInteger(options.width) || options.width < 16) {
		throw new Error('--width must be an integer >= 16');
	}
	if (!Number.isInteger(options.height) || options.height < 16) {
		throw new Error('--height must be an integer >= 16');
	}
	if (!Object.values(SCENE_MODES).includes(options.sceneMode)) {
		throw new Error(
			`--scene must be one of: ${Object.values(SCENE_MODES).join(', ')}`
		);
	}
	if (
		!Object.values(SUNSET_FLOOR_FRAMINGS)
			.map((framing) => framing.id)
			.includes(options.sunsetFraming)
	) {
		throw new Error(
			`--sunset-framing must be one of: ${Object.values(SUNSET_FLOOR_FRAMINGS)
				.map((framing) => framing.id)
				.join(', ')}`
		);
	}
	if (!Object.values(MOUNTAIN_VIEW_MODES).includes(options.mountainView)) {
		throw new Error(
			`--mountain-view must be one of: ${Object.values(MOUNTAIN_VIEW_MODES).join(', ')}`
		);
	}
	if (!Object.values(SCATTERING_ORDERS).includes(options.scatteringOrder)) {
		throw new Error(
			`--scattering-order must be one of: ${Object.values(SCATTERING_ORDERS).join(', ')}`
		);
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 Node/Three reference

Usage:
  node scripts/flat/algorithm32-shader-lab/node-three-reference.js

Options:
  --out-root <path>   Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --width <pixels>    Reference image width. Default: ${IMAGE_DEFAULTS.width}
  --height <pixels>   Reference image height. Default: ${IMAGE_DEFAULTS.height}
  --label <name>      Artifact folder label.
  --scene <id>        ${Object.values(SCENE_MODES).join(', ')}.
  --sunset-framing <id>
                      balanced, more-sky, or less-zoom. Used only with --scene sunset-floor.
  --mountain-view <id>
                      ${Object.values(MOUNTAIN_VIEW_MODES).join(', ')}. Used only with --scene mountain-ridges.
  --scattering-order <id>
                      ${Object.values(SCATTERING_ORDERS).join(', ')}. Default: ${SCATTERING_ORDERS.algorithm32}.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started Node/Three Algorithm32 reference run.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const sceneSetup = createThreeScene(options);
	log(runLog, `Created ${sceneSetup.sceneMode} Three scene.`);

	const geometryDiagnostics = isSubjectiveScene(sceneSetup.sceneMode)
		? subjectiveSceneDiagnostics(sceneSetup)
		: validateGeometry(sceneSetup);
	log(
		runLog,
		isSubjectiveScene(sceneSetup.sceneMode)
			? 'Skipped formal geometry validation for subjective scene output.'
			: 'Validated manual camera rays against Three Raycaster rays.'
	);

	const renderSunCase = renderSunCaseForScene(sceneSetup);
	const renderResult = renderReferenceImage(sceneSetup, renderSunCase, runLog);
	log(runLog, 'Rendered low-resolution CPU reference image from Three ray hits.');

	const transportDiagnostics = transportDiagnosticsForScene(
		sceneSetup,
		renderResult
	);
	log(
		runLog,
		isSubjectiveScene(sceneSetup.sceneMode)
			? 'Skipped formal transport validation for subjective scene output.'
			: 'Validated Algorithm32 transfer identities on Three-derived hit paths.'
	);

	const criteria = evaluateCriteria({
		geometryDiagnostics,
		renderResult,
		transportDiagnostics,
		sceneMode: sceneSetup.sceneMode,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();

	const packet = {
		kind: 'algorithm32-node-three-reference-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
	};

	await writeReferenceArtifacts({
		artifact,
		options,
		sceneSetup,
		geometryDiagnostics,
		renderResult,
		transportDiagnostics,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(
		`Node/Three Algorithm32 reference run ${packet.status}: ${artifact.directory}`
	);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function createThreeScene(options) {
	if (options.sceneMode === SCENE_MODES.sunsetFloor) {
		return createSunsetFloorScene(options);
	}
	if (options.sceneMode === SCENE_MODES.mountainRidges) {
		return createMountainRidgesScene(options);
	}

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		52,
		options.width / options.height,
		0.1,
		150000
	);
	camera.position.set(0, ATMOSPHERE.observerHeightMeters, 0);
	camera.lookAt(new THREE.Vector3(0, 420, -5000));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const meshes = [];
	const cards = [];

	for (const definition of CARD_DEFINITIONS) {
		const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
		const material = new THREE.MeshBasicMaterial({
			color: definition.materialColor,
			side: THREE.FrontSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = definition.id;
		mesh.position.copy(definition.center);
		mesh.userData = {
			kind: 'card',
			spectrumId: definition.spectrumId,
			widthMeters: definition.width,
			heightMeters: definition.height,
			normal: [0, 0, 1],
		};
		mesh.updateMatrixWorld(true);
		scene.add(mesh);
		meshes.push(mesh);
		cards.push({
			...definition,
			mesh,
			centerMeters: vectorToArray(definition.center),
		});
	}

	const groundGeometry = new THREE.PlaneGeometry(120000, 120000);
	const groundMaterial = new THREE.MeshBasicMaterial({
		color: 0x344038,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(groundGeometry, groundMaterial);
	ground.name = 'ground-plane';
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, -30000);
	ground.userData = {
		kind: 'ground',
		spectrumId: 'ground',
		normal: [0, 1, 0],
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	return {
		sceneMode: SCENE_MODES.threeCardReference,
		scene,
		camera,
		meshes,
		cards,
		ground,
		width: options.width,
		height: options.height,
		scatteringOrder: options.scatteringOrder,
		includeSecondOrder: options.scatteringOrder !== SCATTERING_ORDERS.firstOrder,
	};
}

function createMountainRidgesScene(options) {
	const scene = new THREE.Scene();
	const cameraConfig = mountainRidgeCameraConfig(options.mountainView);
	const camera = new THREE.PerspectiveCamera(
		cameraConfig.verticalFovDegrees,
		options.width / options.height,
		MOUNTAIN_RIDGE_SCENE.nearMeters,
		MOUNTAIN_RIDGE_SCENE.farMeters
	);
	camera.position.fromArray(cameraConfig.cameraPositionMeters);
	camera.lookAt(new THREE.Vector3(...cameraConfig.lookAtMeters));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const meshes = [];
	const ridgeObjects = [];
	const floorDefinition = MOUNTAIN_RIDGE_SCENE.valleyFloor;
	const floorGeometry = new THREE.PlaneGeometry(
		floorDefinition.widthMeters,
		floorDefinition.depthMeters
	);
	const floorMaterial = new THREE.MeshBasicMaterial({
		color: floorDefinition.materialColor,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(floorGeometry, floorMaterial);
	ground.name = floorDefinition.id;
	ground.rotation.x = -Math.PI / 2;
	ground.position.fromArray(floorDefinition.centerMeters);
	ground.userData = {
		kind: 'mountain-valley-floor',
		spectrumId: 'mountainRidgeGreen',
		normal: [0, 1, 0],
		maskRgb: floorDefinition.maskRgb,
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	for (const definition of MOUNTAIN_RIDGE_DEFINITIONS) {
		const geometry = createRidgeSilhouetteGeometry(definition);
		const material = new THREE.MeshBasicMaterial({
			color: definition.materialColor,
			side: THREE.FrontSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = definition.id;
		mesh.position.set(0, 0, definition.zMeters);
		mesh.userData = {
			kind: 'mountain-ridge',
			spectrumId: 'mountainRidgeGreen',
			zMeters: definition.zMeters,
			maskRgb: definition.maskRgb,
		};
		mesh.updateMatrixWorld(true);
		scene.add(mesh);
		meshes.push(mesh);
		ridgeObjects.push({
			id: definition.id,
			kind: 'mountain-ridge',
			spectrumId: 'mountainRidgeGreen',
			zMeters: definition.zMeters,
			xMinMeters: definition.xMinMeters,
			xMaxMeters: definition.xMaxMeters,
			samplePointMeters: [
				lerp(definition.xMinMeters, definition.xMaxMeters, definition.sampleT),
				ridgeHeightAt(definition, definition.sampleT) * 0.55,
				definition.zMeters,
			],
		});
	}

	return {
		sceneMode: SCENE_MODES.mountainRidges,
		scene,
		camera,
		meshes,
		cards: [],
		ground,
		width: options.width,
		height: options.height,
		lookAtMeters: cameraConfig.lookAtMeters,
		mountainView: cameraConfig,
		renderSunCaseId: cameraConfig.renderSunCaseId,
		sceneObjects: ridgeObjects,
		subjectiveScene: {
			id: SCENE_MODES.mountainRidges,
			description:
				'Procedural layered mountain ridge silhouettes with a low valley floor and clear Algorithm32 sky.',
			validationPolicy:
				'Subjective composition scene; successful render only, with no formal pass/fail criteria.',
		},
		scatteringOrder: options.scatteringOrder,
		includeSecondOrder: options.scatteringOrder !== SCATTERING_ORDERS.firstOrder,
	};
}

function mountainRidgeCameraConfig(mountainViewId) {
	const baseConfig = {
		id: MOUNTAIN_VIEW_MODES.frontHighSun,
		cameraPositionMeters: MOUNTAIN_RIDGE_SCENE.cameraPositionMeters,
		lookAtMeters: MOUNTAIN_RIDGE_SCENE.lookAtMeters,
		verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
		renderSunCaseId: RENDER_SUN_CASE_ID,
		description: 'Front-facing mountain range under the high-Sun Figure 1 case.',
	};

	if (mountainViewId !== MOUNTAIN_VIEW_MODES.sunsetBehindCamera) {
		return baseConfig;
	}

	const lowSunCase = SUN_CASES.find(
		(sunCase) => sunCase.id === 'figure1-06h00-z87'
	);
	const sunThree = algorithmDirectionToThree(sunDirection(lowSunCase));
	const sunHorizontal = new THREE.Vector3(sunThree.x, 0, sunThree.z).normalize();
	const cameraPosition = new THREE.Vector3(...MOUNTAIN_RIDGE_SCENE.cameraPositionMeters);
	const viewDistanceMeters = 36000;
	const forward = sunHorizontal.clone().multiplyScalar(-1);
	const lookAt = cameraPosition
		.clone()
		.add(forward.multiplyScalar(viewDistanceMeters));
	lookAt.y = MOUNTAIN_RIDGE_SCENE.lookAtMeters[1];

	return {
		id: MOUNTAIN_VIEW_MODES.sunsetBehindCamera,
		cameraPositionMeters: vectorToArray(cameraPosition),
		lookAtMeters: vectorToArray(lookAt),
		verticalFovDegrees: MOUNTAIN_RIDGE_SCENE.verticalFovDegrees,
		renderSunCaseId: lowSunCase.id,
		description:
			'Oblique mountain range view using the low-Sun Figure 1 case with the Sun behind the camera.',
		sunDirectionThree: vectorToArray(sunThree),
		cameraForwardThree: normalize(
			subtractArrays(vectorToArray(lookAt), vectorToArray(cameraPosition))
		),
	};
}

function createSunsetFloorScene(options) {
	const scene = new THREE.Scene();
	const lowSunCase = SUN_CASES.find((sunCase) => sunCase.id === 'figure1-06h00-z87');
	const sunRay = sunDirection(lowSunCase);
	const framing =
		Object.values(SUNSET_FLOOR_FRAMINGS).find(
			(item) => item.id === options.sunsetFraming
		) || SUNSET_FLOOR_FRAMINGS.balanced;
	const horizontalSunRay = normalize([sunRay[0], 0, -sunRay[1]]);
	const camera = new THREE.PerspectiveCamera(
		framing.verticalFovDegrees,
		options.width / options.height,
		0.1,
		150000
	);
	const lookDistance = framing.lookDistanceMeters;
	camera.position.set(
		-horizontalSunRay[0] * framing.backMeters,
		framing.cameraHeightMeters,
		-horizontalSunRay[2] * framing.backMeters
	);
	camera.lookAt(
		new THREE.Vector3(
			camera.position.x + sunRay[0] * lookDistance,
			framing.cameraHeightMeters + framing.lookUpRatio * lookDistance,
			camera.position.z - sunRay[1] * lookDistance
		)
	);
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const meshes = [];
	const groundGeometry = new THREE.PlaneGeometry(160000, 160000);
	const groundMaterial = new THREE.MeshBasicMaterial({
		color: 0x36a542,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(groundGeometry, groundMaterial);
	ground.name = 'grass-green-floor';
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, 0);
	ground.userData = {
		kind: 'ground',
		spectrumId: 'grassGreenFloor',
		normal: [0, 1, 0],
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	return {
		sceneMode: SCENE_MODES.sunsetFloor,
		scene,
		camera,
		meshes,
		cards: [],
		ground,
		width: options.width,
		height: options.height,
		sunsetFraming: framing,
		lookAtMeters: [
			camera.position.x + sunRay[0] * lookDistance,
			framing.cameraHeightMeters + framing.lookUpRatio * lookDistance,
			camera.position.z - sunRay[1] * lookDistance,
		],
		scatteringOrder: options.scatteringOrder,
		includeSecondOrder: options.scatteringOrder !== SCATTERING_ORDERS.firstOrder,
	};
}

function createRidgeSilhouetteGeometry(definition) {
	const shape = new THREE.Shape();
	const segmentCount = 72;

	shape.moveTo(definition.xMinMeters, definition.bottomMeters);
	for (let index = 0; index <= segmentCount; index += 1) {
		const t = index / segmentCount;
		shape.lineTo(
			lerp(definition.xMinMeters, definition.xMaxMeters, t),
			ridgeHeightAt(definition, t)
		);
	}
	shape.lineTo(definition.xMaxMeters, definition.bottomMeters);
	shape.lineTo(definition.xMinMeters, definition.bottomMeters);

	return new THREE.ShapeGeometry(shape);
}

function ridgeHeightAt(definition, t) {
	const broadPeak =
		definition.peakHeightMeters *
		Math.exp(-(((t - definition.peakT) / definition.peakWidth) ** 2));
	const primary =
		definition.amplitudeMeters *
		(0.5 + 0.5 * Math.sin(2 * Math.PI * definition.frequency * t + definition.phase));
	const secondary =
		definition.secondaryAmplitudeMeters *
		(0.5 +
			0.5 *
				Math.sin(
					2 * Math.PI * (definition.frequency * 1.73) * t +
						definition.phase * 0.61
				));

	return definition.baseHeightMeters + primary + secondary + broadPeak;
}

function renderSunCaseForScene(sceneSetup) {
	const sunCaseId =
		sceneSetup.renderSunCaseId ||
		(sceneSetup.sceneMode === SCENE_MODES.sunsetFloor
			? 'figure1-06h00-z87'
			: RENDER_SUN_CASE_ID);

	return SUN_CASES.find((sunCase) => sunCase.id === sunCaseId);
}

function renderReferenceImage(sceneSetup, sunCase, runLog) {
	const { width, height, camera, meshes } = sceneSetup;
	const pixels = Buffer.alloc(width * height * 4);
	const maskPixels = Buffer.alloc(width * height * 4);
	const raycaster = new THREE.Raycaster();
	const sunRay = sunDirection(sunCase);
	const incidentSkyCache = new Map();
	const objectCounts = new Map();
	const selectedPixelDiagnostics = [];
	const radianceStats = {
		minMeanTransmittance: Number.POSITIVE_INFINITY,
		maxMeanTransmittance: Number.NEGATIVE_INFINITY,
		maxPathRadianceMean: 0,
		skyPixels: 0,
		hitPixels: 0,
	};

	for (let y = 0; y < height; y += 1) {
		if (y > 0 && y % 18 === 0) {
			log(runLog, `Rendered ${y}/${height} image rows.`);
		}

		for (let x = 0; x < width; x += 1) {
			const offset = (y * width + x) * 4;
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const ray = raycaster.ray.clone();
			const hit = firstHit(raycaster, meshes);
			let encodedRgb;
			let maskRgb;
			let diagnostic = null;

			if (hit) {
				radianceStats.hitPixels += 1;
				const spectrumId = hit.object.userData.spectrumId;
				const objectRadiance = objectRadianceSpectrum(SPECTRA[spectrumId]);
				const transfer = traceSegmentForThreeHit({
					camera,
					ray,
					distance: hit.distance,
					sunCase,
					sunRay,
					incidentSkyCache,
					includeSecondOrder: sceneSetup.includeSecondOrder,
				});
				const finalRadiance = addArrays(
					multiplyArrays(objectRadiance, transfer.transmittanceByWavelength),
					transfer.pathRadianceByWavelength
				);
				encodedRgb = spectralToDisplayPreview(finalRadiance).encodedRgb;
				maskRgb = maskColorForHit(hit);
				incrementMap(objectCounts, hit.object.name);
				updateRadianceStats(radianceStats, transfer);

				if (selectedPixelDiagnostics.length < 18 && isDiagnosticPixel(x, y, width, height)) {
					diagnostic = makePixelDiagnostic({
						x,
						y,
						ndc,
						ray,
						hit,
						transfer,
						objectRadiance,
						finalRadiance,
					});
				}
			} else {
				radianceStats.skyPixels += 1;
				const transfer = traceSkyForThreeRay({
					camera,
					ray,
					sunCase,
					sunRay,
					incidentSkyCache,
					includeSecondOrder: sceneSetup.includeSecondOrder,
				});
				encodedRgb = spectralToDisplayPreview(
					transfer.pathRadianceByWavelength
				).encodedRgb;
				maskRgb = [32, 56, 120];
				updateRadianceStats(radianceStats, transfer);
			}

			putPixel(pixels, offset, [encodedRgb[0], encodedRgb[1], encodedRgb[2], 255]);
			putPixel(maskPixels, offset, [maskRgb[0], maskRgb[1], maskRgb[2], 255]);

			if (diagnostic) {
				selectedPixelDiagnostics.push(diagnostic);
			}
		}
	}

	return {
		sunCase: {
			...sunCase,
			sunDirection: sunRay,
		},
		width,
		height,
		pixels,
		maskPixels,
		objectCounts: Object.fromEntries(objectCounts),
		selectedPixelDiagnostics,
		radianceStats: finalizeRadianceStats(radianceStats),
		cacheDiagnostics: {
			incidentSkyCacheEntries: incidentSkyCache.size,
		},
	};
}

function isSubjectiveScene(sceneMode) {
	return sceneMode === SCENE_MODES.mountainRidges;
}

function transportDiagnosticsForScene(sceneSetup, renderResult) {
	if (sceneSetup.sceneMode === SCENE_MODES.sunsetFloor) {
		return validateSunsetFloorTransport(sceneSetup, renderResult);
	}
	if (isSubjectiveScene(sceneSetup.sceneMode)) {
		return describeSubjectiveScene(sceneSetup, renderResult);
	}

	return validateTransport(sceneSetup);
}

function subjectiveSceneDiagnostics(sceneSetup) {
	return {
		kind: 'subjective-scene-geometry-diagnostics',
		sceneMode: sceneSetup.sceneMode,
		formalValidation: 'skipped',
		reason:
			'This optional scene is a subjective composition target; no geometry pass/fail criteria are claimed.',
		sceneObjects: sceneSetup.sceneObjects || [],
	};
}

function describeSubjectiveScene(sceneSetup, renderResult) {
	return {
		kind: 'subjective-scene-transport-diagnostics',
		sceneMode: sceneSetup.sceneMode,
		formalValidation: 'skipped',
		reason:
			'This optional scene is for subjective visual inspection. Rendering still uses Three ray hits and Algorithm32 spectral sky/object transfer, but no objective success criteria are claimed.',
		subjectiveScene: sceneSetup.subjectiveScene,
		mountainView: sceneSetup.mountainView || null,
		sunCase: renderResult.sunCase,
		sceneObjects: sceneSetup.sceneObjects || [],
		objectCounts: renderResult.objectCounts,
		radianceStats: renderResult.radianceStats,
		cacheDiagnostics: renderResult.cacheDiagnostics,
	};
}

function validateGeometry(sceneSetup) {
	const { camera, meshes, cards, width, height } = sceneSetup;
	const raycaster = new THREE.Raycaster();
	const rayChecks = [];
	const samplePixels = [
		[0, 0],
		[Math.floor(width / 2), Math.floor(height / 2)],
		[width - 1, height - 1],
		[Math.floor(width * 0.25), Math.floor(height * 0.5)],
		[Math.floor(width * 0.75), Math.floor(height * 0.5)],
	];

	for (const [x, y] of samplePixels) {
		const ndc = pixelToNdc(x, y, width, height);
		raycaster.setFromCamera(ndc, camera);
		const raycasterRay = raycaster.ray.clone();
		const manualRay = manualCameraRay(camera, ndc);
		const angularErrorRadians = angleBetween(
			vectorToArray(raycasterRay.direction),
			vectorToArray(manualRay.direction)
		);
		const originErrorMeters = raycasterRay.origin.distanceTo(manualRay.origin);

		rayChecks.push({
			kind: 'pixel-ray',
			x,
			y,
			ndc: { x: ndc.x, y: ndc.y },
			angularErrorRadians,
			originErrorMeters,
		});
	}

	const hitChecks = [];
	for (const card of cards) {
		const ndc = worldPointToNdcPixel(card.center, camera, width, height);
		raycaster.setFromCamera(ndc.ndc, camera);
		const hit = firstHit(raycaster, meshes);
		const analyticDistance = analyticDistanceToZPlane(
			raycaster.ray,
			card.center.z
		);
		const hitDistance = hit ? hit.distance : null;
		const distanceErrorMeters =
			hitDistance === null ? null : Math.abs(hitDistance - analyticDistance);

		hitChecks.push({
			kind: 'card-center-hit',
			cardId: card.id,
			projectedPixel: { x: ndc.x, y: ndc.y },
			projectedNdc: { x: ndc.ndc.x, y: ndc.ndc.y },
			expectedObject: card.id,
			hitObject: hit?.object?.name || null,
			analyticDistanceMeters: analyticDistance,
			hitDistanceMeters: hitDistance,
			distanceErrorMeters,
		});
	}

	return {
		rayChecks,
		hitChecks,
	};
}

function validateTransport(sceneSetup) {
	const { camera, meshes, cards } = sceneSetup;
	const raycaster = new THREE.Raycaster();
	const transferSamples = [];
	const compositionSamples = [];
	const beerLambertSamples = [];
	const hitPathSamples = [];
	const incidentSkyCache = new Map();
	const zeroDirection = normalize([0, 1, 0]);

	for (const sunCase of SUN_CASES) {
		const sunRay = sunDirection(sunCase);
		const zeroTransfer = computePathRadianceSegment({
			origin: observerPosition(),
			direction: zeroDirection,
			distance: 0,
			sunCase,
			sunRay,
			controls: NUMERICAL_CONTROLS,
			includeSecondOrder: true,
			incidentSkyCache,
		});
		transferSamples.push({
			kind: 'zero-distance',
			sunCase: sunCase.id,
			distanceMeters: 0,
			...summarizeTransfer(zeroTransfer),
		});

		for (const card of cards) {
			const ndc = worldPointToNdcPixel(card.center, camera, sceneSetup.width, sceneSetup.height);
			raycaster.setFromCamera(ndc.ndc, camera);
			const hit = firstHit(raycaster, meshes);
			if (!hit || hit.object.name !== card.id) {
				hitPathSamples.push({
					cardId: card.id,
					sunCase: sunCase.id,
					status: 'missing-hit',
				});
				continue;
			}

			const transfer = traceSegmentForThreeHit({
				camera,
				ray: raycaster.ray,
				distance: hit.distance,
				sunCase,
				sunRay,
				incidentSkyCache,
				includeSecondOrder: true,
			});
			const neutralRadiance = objectRadianceSpectrum(SPECTRA.neutral);
			const blackRadiance = objectRadianceSpectrum(SPECTRA.black);
			const neutralFinal = composeObjectRadiance(neutralRadiance, transfer);
			const blackFinal = composeObjectRadiance(blackRadiance, transfer);
			const recomposedNeutral = addArrays(
				multiplyArrays(neutralRadiance, transfer.transmittanceByWavelength),
				transfer.pathRadianceByWavelength
			);
			const recomposedBlack = addArrays(
				multiplyArrays(blackRadiance, transfer.transmittanceByWavelength),
				transfer.pathRadianceByWavelength
			);

			compositionSamples.push({
				cardId: card.id,
				sunCase: sunCase.id,
				distanceMeters: hit.distance,
				neutralCompositionError: maxAbs(
					subtractArrays(neutralFinal, recomposedNeutral)
				),
				blackPathOnlyError: maxAbs(
					subtractArrays(blackFinal, transfer.pathRadianceByWavelength)
				),
				blackCompositionError: maxAbs(
					subtractArrays(blackFinal, recomposedBlack)
				),
			});

			for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
				beerLambertSamples.push({
					cardId: card.id,
					sunCase: sunCase.id,
					wavelengthNanometers: SPECTRAL_CHANNELS[index].wavelengthNanometers,
					opticalDepth: transfer.opticalDepthByWavelength[index],
					transmittance: transfer.transmittanceByWavelength[index],
					error: Math.abs(
						transfer.transmittanceByWavelength[index] -
							Math.exp(-transfer.opticalDepthByWavelength[index])
					),
				});
			}

			hitPathSamples.push({
				cardId: card.id,
				sunCase: sunCase.id,
				hitDistanceMeters: hit.distance,
				algorithmDirection: threeDirectionToAlgorithm(raycaster.ray.direction),
				...summarizeTransfer(transfer),
			});
		}
	}

	const splitDiagnostics = computeSplitSegmentDiagnostics(sceneSetup);
	const sunResponseDiagnostics = computeSunResponseDiagnostics(sceneSetup);

	return {
		transferSamples,
		compositionSamples,
		beerLambertSamples,
		hitPathSamples,
		splitDiagnostics,
		sunResponseDiagnostics,
	};
}

function computeSplitSegmentDiagnostics(sceneSetup) {
	const { camera, cards } = sceneSetup;
	const card = cards[1];
	const sunCase = SUN_CASES.find((item) => item.id === RENDER_SUN_CASE_ID);
	const sunRay = sunDirection(sunCase);
	const origin = threeToAlgorithmWorld(camera.position);
	const target = threeToAlgorithmWorld(card.center);
	const direction = normalize(subtractArrays(target, origin));
	const distance = length(subtractArrays(target, origin));
	const halfDistance = distance / 2;
	const midpoint = addScaled(origin, direction, halfDistance);
	const incidentSkyCache = new Map();
	const fullControls = {
		...NUMERICAL_CONTROLS,
		viewRayScatteringIntervals:
			NUMERICAL_CONTROLS.viewRayScatteringIntervals * 2,
	};
	const full = computePathRadianceSegment({
		origin,
		direction,
		distance,
		sunCase,
		sunRay,
		controls: fullControls,
		includeSecondOrder: true,
		incidentSkyCache,
	});
	const first = computePathRadianceSegment({
		origin,
		direction,
		distance: halfDistance,
		sunCase,
		sunRay,
		controls: NUMERICAL_CONTROLS,
		includeSecondOrder: true,
		incidentSkyCache,
	});
	const second = computePathRadianceSegment({
		origin: midpoint,
		direction,
		distance: halfDistance,
		sunCase,
		sunRay,
		controls: NUMERICAL_CONTROLS,
		includeSecondOrder: true,
		incidentSkyCache,
	});
	const recomposedTransmittance = multiplyArrays(
		first.transmittanceByWavelength,
		second.transmittanceByWavelength
	);
	const recomposedPathRadiance = addArrays(
		first.pathRadianceByWavelength,
		multiplyArrays(first.transmittanceByWavelength, second.pathRadianceByWavelength)
	);

	return {
		cardId: card.id,
		sunCase: sunCase.id,
		distanceMeters: distance,
		splitDistanceMeters: halfDistance,
		maxTransmittanceError: maxAbs(
			subtractArrays(full.transmittanceByWavelength, recomposedTransmittance)
		),
		maxPathRadianceError: maxAbs(
			subtractArrays(full.pathRadianceByWavelength, recomposedPathRadiance)
		),
		full: summarizeTransfer(full),
		first: summarizeTransfer(first),
		second: summarizeTransfer(second),
	};
}

function computeSunResponseDiagnostics(sceneSetup) {
	const { camera, cards } = sceneSetup;
	const card = cards[1];
	const origin = threeToAlgorithmWorld(camera.position);
	const target = threeToAlgorithmWorld(card.center);
	const direction = normalize(subtractArrays(target, origin));
	const distance = length(subtractArrays(target, origin));
	const responses = [];

	for (const sunCase of SUN_CASES) {
		const transfer = computePathRadianceSegment({
			origin,
			direction,
			distance,
			sunCase,
			sunRay: sunDirection(sunCase),
			controls: NUMERICAL_CONTROLS,
			includeSecondOrder: true,
			incidentSkyCache: new Map(),
		});
		responses.push({
			sunCase: sunCase.id,
			...summarizeTransfer(transfer),
		});
	}

	return {
		cardId: card.id,
		distanceMeters: distance,
		responses,
		pathRadianceDifferenceMaxAbs: maxAbs(
			subtractArrays(
				responses[0].pathRadianceByWavelength,
				responses[1].pathRadianceByWavelength
			)
		),
	};
}

function validateSunsetFloorTransport(sceneSetup) {
	const { camera, meshes, width, height } = sceneSetup;
	const raycaster = new THREE.Raycaster();
	const sunCase = renderSunCaseForScene(sceneSetup);
	const sunRay = sunDirection(sunCase);
	const incidentSkyCache = new Map();
	const sampleDefinitions = [
		{ id: 'upper-sky', x: Math.floor(width * 0.5), y: Math.floor(height * 0.18) },
		{ id: 'sunset-horizon', x: Math.floor(width * 0.5), y: Math.floor(height * 0.45) },
		{ id: 'near-floor', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78) },
		{ id: 'left-floor', x: Math.floor(width * 0.25), y: Math.floor(height * 0.82) },
		{ id: 'right-floor', x: Math.floor(width * 0.75), y: Math.floor(height * 0.82) },
	];
	const samplePackets = [];
	const beerLambertSamples = [];

	for (const sampleDefinition of sampleDefinitions) {
		const ndc = pixelToNdc(
			sampleDefinition.x,
			sampleDefinition.y,
			width,
			height
		);
		raycaster.setFromCamera(ndc, camera);
		const ray = raycaster.ray.clone();
		const hit = firstHit(raycaster, meshes);
		const transfer = hit
			? traceSegmentForThreeHit({
					camera,
					ray,
					distance: hit.distance,
					sunCase,
					sunRay,
					incidentSkyCache,
					includeSecondOrder: true,
				})
			: traceSkyForThreeRay({
					camera,
					ray,
					sunCase,
					sunRay,
					incidentSkyCache,
				});
		const objectRadiance = hit
			? objectRadianceSpectrum(SPECTRA[hit.object.userData.spectrumId])
			: zeroSpectrum();
		const finalRadiance = hit
			? composeObjectRadiance(objectRadiance, transfer)
			: transfer.pathRadianceByWavelength;

		for (let index = 0; index < SPECTRAL_CHANNELS.length; index += 1) {
			beerLambertSamples.push({
				sampleId: sampleDefinition.id,
				wavelengthNanometers: SPECTRAL_CHANNELS[index].wavelengthNanometers,
				opticalDepth: transfer.opticalDepthByWavelength[index],
				transmittance: transfer.transmittanceByWavelength[index],
				error: Math.abs(
					transfer.transmittanceByWavelength[index] -
						Math.exp(-transfer.opticalDepthByWavelength[index])
				),
			});
		}

		samplePackets.push({
			sampleId: sampleDefinition.id,
			x: sampleDefinition.x,
			y: sampleDefinition.y,
			classification: hit ? hit.object.userData.kind : 'sky',
			hitObject: hit?.object?.name || null,
			hitDistanceMeters: hit?.distance || null,
			threeRay: {
				origin: vectorToArray(ray.origin),
				direction: vectorToArray(ray.direction),
			},
			algorithm32Ray: {
				origin: threeToAlgorithmWorld(ray.origin),
				direction: threeDirectionToAlgorithm(ray.direction),
				distanceMeters: hit?.distance || null,
			},
			objectRadianceByWavelength: objectRadiance,
			finalRadianceByWavelength: finalRadiance,
			displayPreview: spectralToDisplayPreview(finalRadiance),
			transfer: summarizeTransfer(transfer),
		});
	}

	return {
		sceneMode: SCENE_MODES.sunsetFloor,
		sunsetFraming: sceneSetup.sunsetFraming,
		sunCase: {
			...sunCase,
			sunDirection: sunRay,
		},
		samplePackets,
		beerLambertSamples,
		cacheDiagnostics: {
			incidentSkyCacheEntries: incidentSkyCache.size,
		},
	};
}

function evaluateCriteria({
	geometryDiagnostics,
	renderResult,
	transportDiagnostics,
	sceneMode,
}) {
	if (isSubjectiveScene(sceneMode)) {
		return [];
	}

	const criteria = [];
	const maxRayAngularError = Math.max(
		...geometryDiagnostics.rayChecks.map((check) => check.angularErrorRadians)
	);
	const maxRayOriginError = Math.max(
		...geometryDiagnostics.rayChecks.map((check) => check.originErrorMeters)
	);
	const hitFailures = geometryDiagnostics.hitChecks.filter(
		(check) => check.hitObject !== check.expectedObject
	);
	const maxHitDistanceError = Math.max(
		...geometryDiagnostics.hitChecks
			.map((check) => check.distanceErrorMeters)
			.filter((value) => Number.isFinite(value)),
		0
	);

	criteria.push(
		criterion({
			id: 'camera-ray-reconstruction',
			status:
				maxRayAngularError <= 1e-12 && maxRayOriginError <= 1e-12
					? 'pass'
					: 'fail',
			tolerance: { angularRadians: 1e-12, originMeters: 1e-12 },
			measured: { maxRayAngularError, maxRayOriginError },
			notes:
				'Manual inverse-projection rays match Three Raycaster.setFromCamera rays.',
		})
	);

	if (sceneMode === SCENE_MODES.sunsetFloor) {
		criteria.push(...evaluateSunsetFloorCriteria({
			renderResult,
			transportDiagnostics,
		}));
		return criteria;
	}

	criteria.push(
		criterion({
			id: 'analytic-card-hit-distance',
			status:
				hitFailures.length === 0 && maxHitDistanceError <= 1e-6
					? 'pass'
					: 'fail',
			tolerance: { distanceMeters: 1e-6 },
			measured: {
				hitFailures,
				maxHitDistanceError,
			},
			notes:
				'Raycaster card-center hits agree with analytic intersections against the cards z-planes.',
		})
	);

	const expectedObjectIds = ['near-red-card', 'middle-green-card', 'far-blue-card'];
	const missingObjects = expectedObjectIds.filter(
		(id) => !renderResult.objectCounts[id]
	);
	criteria.push(
		criterion({
			id: 'rendered-three-object-mask',
			status: missingObjects.length === 0 ? 'pass' : 'fail',
			tolerance: { missingObjects: 0 },
			measured: {
				objectCounts: renderResult.objectCounts,
				missingObjects,
				skyPixels: renderResult.radianceStats.skyPixels,
				hitPixels: renderResult.radianceStats.hitPixels,
			},
			notes:
				'The image assembly contains Three-classified sky pixels and all diagnostic card objects.',
		})
	);

	let maxCompositionError = 0;
	let maxBlackIdentityError = 0;
	for (const sample of transportDiagnostics.compositionSamples) {
		maxCompositionError = Math.max(
			maxCompositionError,
			sample.neutralCompositionError,
			sample.blackCompositionError
		);
		maxBlackIdentityError = Math.max(
			maxBlackIdentityError,
			sample.blackPathOnlyError
		);
	}
	criteria.push(
		criterion({
			id: 'object-transfer-composition',
			status: maxCompositionError <= 1e-12 ? 'pass' : 'fail',
			tolerance: { absolute: 1e-12 },
			measured: { maxCompositionError },
			notes:
				'Three-derived object paths compose as L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda).',
		})
	);
	criteria.push(
		criterion({
			id: 'black-object-path-only',
			status: maxBlackIdentityError <= 1e-12 ? 'pass' : 'fail',
			tolerance: { absolute: 1e-12 },
			measured: { maxBlackIdentityError },
			notes:
				'Zero object radiance returns only Algorithm32 path radiance for the same Three hit path.',
		})
	);

	const zeroSamples = transportDiagnostics.transferSamples.filter(
		(sample) => sample.kind === 'zero-distance'
	);
	const maxZeroTransmittanceError = Math.max(
		...zeroSamples.map((sample) =>
			maxAbs(sample.transmittanceByWavelength.map((value) => value - 1))
		)
	);
	const maxZeroPathRadiance = Math.max(
		...zeroSamples.map((sample) => maxAbs(sample.pathRadianceByWavelength))
	);
	criteria.push(
		criterion({
			id: 'zero-distance-transfer',
			status:
				maxZeroTransmittanceError <= 1e-12 && maxZeroPathRadiance <= 1e-12
					? 'pass'
					: 'fail',
			tolerance: { absolute: 1e-12 },
			measured: {
				maxZeroTransmittanceError,
				maxZeroPathRadiance,
			},
			notes:
				'Zero-length Algorithm32 transfer keeps T = 1 and path radiance = 0.',
		})
	);

	const maxBeerLambertError = Math.max(
		...transportDiagnostics.beerLambertSamples.map((sample) => sample.error)
	);
	criteria.push(
		criterion({
			id: 'beer-lambert-identity',
			status: maxBeerLambertError <= 1e-12 ? 'pass' : 'fail',
			tolerance: { absolute: 1e-12 },
			measured: { maxBeerLambertError },
			notes: 'Stored spectral transmittance equals exp(-opticalDepth).',
		})
	);

	const allTransmittances = transportDiagnostics.hitPathSamples.flatMap(
		(sample) => sample.transmittanceByWavelength || []
	);
	const minTransmittance = Math.min(...allTransmittances);
	const maxTransmittance = Math.max(...allTransmittances);
	const nonfiniteTransferValues = transportDiagnostics.hitPathSamples.reduce(
		(count, sample) =>
			count +
			[
				...(sample.opticalDepthByWavelength || []),
				...(sample.transmittanceByWavelength || []),
				...(sample.pathRadianceByWavelength || []),
			].filter((value) => !Number.isFinite(value) || value < -1e-12).length,
		0
	);
	criteria.push(
		criterion({
			id: 'finite-nonnegative-transfer',
			status:
				nonfiniteTransferValues === 0 &&
				minTransmittance >= -1e-12 &&
				maxTransmittance <= 1 + 1e-12
					? 'pass'
					: 'fail',
			tolerance: { transmittanceRange: [0, 1], slack: 1e-12 },
			measured: {
				nonfiniteTransferValues,
				minTransmittance,
				maxTransmittance,
			},
			notes:
				'Algorithm32 spectral packets from Three hit paths remain finite, nonnegative, and bounded.',
		})
	);

	const highSunSamples = transportDiagnostics.hitPathSamples.filter(
		(sample) => sample.sunCase === RENDER_SUN_CASE_ID
	);
	const sortedByDistance = [...highSunSamples].sort(
		(a, b) => a.hitDistanceMeters - b.hitDistanceMeters
	);
	const near = sortedByDistance[0];
	const far = sortedByDistance[sortedByDistance.length - 1];
	const distanceTransmittanceDrop =
		near.meanTransmittance - far.meanTransmittance;
	criteria.push(
		criterion({
			id: 'distance-response',
			status: distanceTransmittanceDrop > 0 ? 'pass' : 'fail',
			tolerance: { effect: 'positive transmittance drop from nearest to farthest card' },
			measured: {
				nearCardId: near.cardId,
				nearMeanTransmittance: near.meanTransmittance,
				farCardId: far.cardId,
				farMeanTransmittance: far.meanTransmittance,
				distanceTransmittanceDrop,
			},
			notes:
				'The same Three scene shows stronger atmospheric attenuation over the longer object segment.',
		})
	);

	const split = transportDiagnostics.splitDiagnostics;
	criteria.push(
		criterion({
			id: 'split-segment-composition',
			status:
				split.maxTransmittanceError <= 2e-5 &&
				split.maxPathRadianceError <= 2e-5
					? 'pass'
					: 'fail',
			tolerance: {
				absolute: 2e-5,
				status: 'algorithmic numerical gate for finite quadrature',
			},
			measured: {
				maxTransmittanceError: split.maxTransmittanceError,
				maxPathRadianceError: split.maxPathRadianceError,
			},
			notes:
				'Splitting a Three-derived object segment recomposes T_full and L_path_full within the finite quadrature gate.',
		})
	);

	criteria.push(
		criterion({
			id: 'sun-position-response',
			status:
				transportDiagnostics.sunResponseDiagnostics
					.pathRadianceDifferenceMaxAbs > 0
					? 'pass'
					: 'fail',
			tolerance: { effect: 'nonzero path-radiance delta between Figure 1 Sun cases' },
			measured: transportDiagnostics.sunResponseDiagnostics,
			notes:
				'The same Three hit path changes when Algorithm32 uses the low-Sun versus high-Sun Figure 1 source direction.',
		})
	);

	return criteria;
}

function evaluateSunsetFloorCriteria({ renderResult, transportDiagnostics }) {
	const criteria = [];
	const cardObjectNames = Object.keys(renderResult.objectCounts).filter((name) =>
		name.includes('card')
	);
	const groundPixelCount = renderResult.objectCounts['grass-green-floor'] || 0;
	const totalPixelCount = renderResult.width * renderResult.height;
	const skyFraction = renderResult.radianceStats.skyPixels / totalPixelCount;
	criteria.push(
		criterion({
			id: 'sunset-floor-scene-shape',
			status:
				cardObjectNames.length === 0 &&
				groundPixelCount > 0 &&
				renderResult.radianceStats.skyPixels > 0
					? 'pass'
					: 'fail',
			tolerance: {
				cardObjectCount: 0,
				groundPixels: 'positive',
				skyPixels: 'positive',
			},
			measured: {
				objectCounts: renderResult.objectCounts,
				cardObjectNames,
				groundPixelCount,
				skyPixels: renderResult.radianceStats.skyPixels,
				skyFraction,
			},
			notes:
				'The requested scene has no card objects, only a grass-green floor and sky.',
		})
	);
	if (transportDiagnostics.sunsetFraming?.id === SUNSET_FLOOR_FRAMINGS.moreSky.id) {
		criteria.push(
			criterion({
				id: 'more-sky-framing',
				status: skyFraction >= 0.65 ? 'pass' : 'fail',
				tolerance: { minimumSkyFraction: 0.65 },
				measured: {
					skyFraction,
					skyPixels: renderResult.radianceStats.skyPixels,
					totalPixelCount,
				},
				notes:
					'The more-sky framing keeps the camera pulled back/up enough that sky dominates the generated scene.',
			})
		);
	}
	if (transportDiagnostics.sunsetFraming?.id === SUNSET_FLOOR_FRAMINGS.lessZoom.id) {
		criteria.push(
			criterion({
				id: 'less-zoom-framing',
				status:
					transportDiagnostics.sunsetFraming.verticalFovDegrees >= 85 &&
					skyFraction >= 0.5
						? 'pass'
						: 'fail',
				tolerance: {
					minimumVerticalFovDegrees: 85,
					minimumSkyFraction: 0.5,
				},
				measured: {
					verticalFovDegrees:
						transportDiagnostics.sunsetFraming.verticalFovDegrees,
					skyFraction,
					skyPixels: renderResult.radianceStats.skyPixels,
					totalPixelCount,
				},
				notes:
					'The less-zoom framing uses a wide vertical field of view while keeping the sunset-facing horizon composition.',
			})
		);
	}
	criteria.push(
		criterion({
			id: 'sunset-source-direction',
			status:
				transportDiagnostics.sunCase.id === 'figure1-06h00-z87'
					? 'pass'
					: 'fail',
			tolerance: { expectedSunCase: 'figure1-06h00-z87' },
			measured: {
				sunCaseId: transportDiagnostics.sunCase.id,
				sunAltitudeDegrees: transportDiagnostics.sunCase.sunAltitudeDegrees,
				sunAzimuthDegrees: transportDiagnostics.sunCase.sunAzimuthDegrees,
			},
			notes:
				'The camera faces the low-Sun Bruneton Figure 1 case for a sunset/rise sky.',
		})
	);

	const sampleTransfers = transportDiagnostics.samplePackets.map(
		(packet) => packet.transfer
	);
	const allValues = sampleTransfers.flatMap((transfer) => [
		...transfer.opticalDepthByWavelength,
		...transfer.transmittanceByWavelength,
		...transfer.pathRadianceByWavelength,
	]);
	const allTransmittances = sampleTransfers.flatMap(
		(transfer) => transfer.transmittanceByWavelength
	);
	const nonfiniteTransferValues = allValues.filter(
		(value) => !Number.isFinite(value) || value < -1e-12
	).length;
	const minTransmittance = Math.min(...allTransmittances);
	const maxTransmittance = Math.max(...allTransmittances);
	criteria.push(
		criterion({
			id: 'finite-nonnegative-transfer',
			status:
				nonfiniteTransferValues === 0 &&
				minTransmittance >= -1e-12 &&
				maxTransmittance <= 1 + 1e-12
					? 'pass'
					: 'fail',
			tolerance: { transmittanceRange: [0, 1], slack: 1e-12 },
			measured: {
				nonfiniteTransferValues,
				minTransmittance,
				maxTransmittance,
			},
			notes:
				'Algorithm32 spectral packets for selected sky/floor rays remain finite and bounded.',
		})
	);

	const maxBeerLambertError = Math.max(
		...transportDiagnostics.beerLambertSamples.map((sample) => sample.error)
	);
	criteria.push(
		criterion({
			id: 'beer-lambert-identity',
			status: maxBeerLambertError <= 1e-12 ? 'pass' : 'fail',
			tolerance: { absolute: 1e-12 },
			measured: { maxBeerLambertError },
			notes: 'Stored spectral transmittance equals exp(-opticalDepth).',
		})
	);

	const skyPackets = transportDiagnostics.samplePackets.filter(
		(packet) => packet.classification === 'sky'
	);
	const maxSkyPathRadiance = Math.max(
		...skyPackets.flatMap((packet) => packet.transfer.pathRadianceByWavelength),
		0
	);
	criteria.push(
		criterion({
			id: 'sky-radiance-present',
			status: skyPackets.length > 0 && maxSkyPathRadiance > 0 ? 'pass' : 'fail',
			tolerance: { skySamples: 'positive', pathRadiance: 'positive' },
			measured: {
				skySampleCount: skyPackets.length,
				maxSkyPathRadiance,
			},
			notes:
				'Sky pixels are computed through Algorithm32 path radiance, not a decorative gradient.',
		})
	);

	const floorAverageRgb = averageRgbForMask(renderResult, [90, 90, 90]);
	criteria.push(
		criterion({
			id: 'grass-floor-green-display',
			status:
				floorAverageRgb &&
				floorAverageRgb[1] > floorAverageRgb[0] &&
				floorAverageRgb[1] > floorAverageRgb[2]
					? 'pass'
					: 'fail',
			tolerance: { green: 'greater than red and blue in floor mask average' },
			measured: { floorAverageRgb },
			notes:
				'The synthetic floor radiance is an algorithmic caller color chosen to display grass green after atmospheric transfer.',
		})
	);

	return criteria;
}

async function writeReferenceArtifacts({
	artifact,
	options,
	sceneSetup,
	geometryDiagnostics,
	renderResult,
	transportDiagnostics,
	criteria,
	summary,
	packet,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'inputs.json'), {
		kind: 'algorithm32-node-three-reference-inputs',
		options: {
			width: options.width,
			height: options.height,
			label: options.label,
			sceneMode: options.sceneMode,
			sunsetFraming: options.sunsetFraming,
			mountainView: options.mountainView,
			scatteringOrder: options.scatteringOrder,
		},
		sourceBoundary: {
			authority:
				'Algorithm32 constants and equations are taken from the cleanroom script and Algorithm32 design doc, which trace them to external references.',
			cleanroomScriptPath: CLEANROOM_SCRIPT_PATH,
			algorithmDocumentPath: ALGORITHM32_DOC_PATH,
			planDocumentPath: PLAN_DOC_PATH,
		},
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(sceneSetup.camera.position),
			lookAtMeters: sceneSetup.lookAtMeters || [0, 420, -5000],
			verticalFovDegrees: sceneSetup.camera.fov,
			aspect: sceneSetup.camera.aspect,
			near: sceneSetup.camera.near,
			far: sceneSetup.camera.far,
			threeToAlgorithm32Mapping:
				'Three [x, y, z] maps to Algorithm32 local [east=x, north=-z, up=y].',
		},
		sceneObjects: sceneObjectsForInputs(sceneSetup),
		ground: sceneSetup.ground
			? {
					id: sceneSetup.ground.name,
					kind: sceneSetup.ground.userData.kind || 'horizontal diagnostic plane',
					spectrumId: sceneSetup.ground.userData.spectrumId,
				}
			: null,
		sunCases: SUN_CASES.map((sunCase) => ({
			...sunCase,
			sunDirection: sunDirection(sunCase),
		})),
		renderSunCaseId: renderResult.sunCase.id,
		scatteringOrder: sceneSetup.scatteringOrder,
		includeSecondOrder: sceneSetup.includeSecondOrder,
		algorithmicDecisions: [
			{
				id: 'three-diagnostic-scene',
				value: sceneDescriptionForInputs(sceneSetup),
				reason: sceneReasonForInputs(sceneSetup),
			},
			{
				id: 'low-resolution-reference-image',
				value: `${options.width} x ${options.height}`,
				reason:
					'Keep the CPU Algorithm32 plus Three raycast proof fast enough for iterative shader-lab use.',
			},
			{
				id: 'render-scattering-order',
				value: sceneSetup.scatteringOrder,
				reason:
					sceneSetup.includeSecondOrder
						? 'Default Algorithm32 image render includes the current second-order approximation.'
						: 'First-order-only image render isolates browser shader parity before adding second-order in GLSL.',
			},
			{
				id: 'synthetic-object-spectra',
				value: Object.fromEntries(
					Object.values(SPECTRA).map((spectrum) => [spectrum.id, spectrum.label])
				),
				reason:
					'Object colors are caller-provided stress spectra, not atmospheric constants.',
			},
			{
				id: 'scene-display-target',
				value: sceneDisplayTargetForInputs(sceneSetup),
				reason:
					'User-requested scene content; object and terrain colors are caller-provided synthetic radiance spectra.',
			},
			{
				id: 'sunset-floor-framing',
				value: sceneSetup.sunsetFraming || null,
				reason:
					'Camera composition is an algorithmic scene-display choice. It does not alter Algorithm32 sky or floor transport.',
			},
		],
	});

	await writeJson(path.join(artifact.directory, 'equations-and-constants.json'), {
		kind: 'algorithm32-node-three-reference-equations-and-constants',
		atmosphere: ATMOSPHERE,
		numericalControls: NUMERICAL_CONTROLS,
		spectralChannels: SPECTRAL_CHANNELS.map((channel) => ({
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
			wavelengthBinWidthNanometers: channel.wavelengthBinWidthNanometers,
		})),
		display: {
			maxLuminousEfficacy: MAX_LUMINOUS_EFFICACY,
			toneMapExposureScale: BRUNETON_COMPARISON_TONE_MAP_EXPOSURE_SCALE,
			k: DISPLAY_TONE_MAP_K,
			status:
				'Display-only preview; pass/fail transport criteria use spectral arrays.',
		},
		equations: [
			{
				id: 'three-ray-to-algorithm32-segment',
				expression:
					'pixel -> NDC -> Raycaster.setFromCamera -> hit distance; Algorithm32 segment direction = normalize([dir.x, -dir.z, dir.y])',
				sourceOrStatus: 'Three.js API plus algorithmic coordinate convention',
			},
			{
				id: 'finite-object-transfer',
				expression:
					'L_camera(lambda) = T_view(lambda) * L_object(lambda) + L_path(lambda)',
				sourceOrStatus: 'Bruneton demo finite-object composition',
			},
			{
				id: 'beer-lambert',
				expression:
					'T(lambda) = exp(-(beta_R(lambda) L_R + beta_M_ext(lambda) L_M + beta_O3(lambda) L_O3))',
				sourceOrStatus: 'bruneton-functions-glsl',
			},
			{
				id: 'first-order-path-radiance',
				expression:
					'dL_1 = T_view * T_sun * E_sun * (rho_R beta_R P_R + rho_M beta_M_sca P_M) ds',
				sourceOrStatus: 'bruneton-functions-glsl',
			},
			{
				id: 'second-order-path-radiance',
				expression:
					'dL_2 = T_view * integral_S2(L_1(omega_i) * (rho_R beta_R P_R + rho_M beta_M_sca P_M) d omega_i) ds',
				sourceOrStatus:
					'Algorithm32 approximation with Fibonacci full-sphere quadrature',
			},
		],
		references: SOURCE_REFERENCES,
	});

	await writeJson(path.join(artifact.directory, 'geometry-diagnostics.json'), geometryDiagnostics);
	await writeJson(
		path.join(artifact.directory, 'transport-diagnostics.json'),
		transportDiagnostics
	);
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-node-three-reference-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(path.join(artifact.directory, 'selected-pixels.json'), {
		kind: 'algorithm32-node-three-reference-selected-pixels',
		selectedPixelDiagnostics: renderResult.selectedPixelDiagnostics,
	});
	await writeJson(path.join(artifact.directory, 'image-stats.json'), {
		kind: 'algorithm32-node-three-reference-image-stats',
		width: renderResult.width,
		height: renderResult.height,
		scatteringOrder: sceneSetup.scatteringOrder,
		includeSecondOrder: sceneSetup.includeSecondOrder,
		objectCounts: renderResult.objectCounts,
		radianceStats: renderResult.radianceStats,
		cacheDiagnostics: renderResult.cacheDiagnostics,
	});

	await writePng(
		path.join(artifact.directory, 'reference-image.png'),
		renderResult.width,
		renderResult.height,
		renderResult.pixels
	);
	await writePng(
		path.join(artifact.directory, 'object-mask.png'),
		renderResult.width,
		renderResult.height,
		renderResult.maskPixels
	);

	await writeText(
		path.join(artifact.directory, 'state-goal.md'),
		[
			'# State Goal',
			'',
			stateGoalTitle(sceneSetup),
			'',
			stateGoalSuccessText(sceneSetup),
			'',
		].join('\n')
	);
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({ artifact, summary, renderResult, transportDiagnostics })
	);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));

	await writeJson(path.join(options.outRoot, 'latest-node-three-reference.json'), packet);
}

function makeReport({ artifact, summary, renderResult, transportDiagnostics }) {
	if (transportDiagnostics.sceneMode === SCENE_MODES.sunsetFloor) {
		return makeSunsetFloorReport({
			artifact,
			summary,
			renderResult,
			transportDiagnostics,
		});
	}
	if (transportDiagnostics.sceneMode === SCENE_MODES.mountainRidges) {
		return makeMountainRidgesReport({
			artifact,
			summary,
			renderResult,
			transportDiagnostics,
		});
	}

	const split = transportDiagnostics.splitDiagnostics;
	const response = transportDiagnostics.sunResponseDiagnostics;

	return [
		'# Algorithm32 Node/Three Reference',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This run uses a Three.js scene as the geometry source, then sends each Raycaster hit or sky ray into a CPU Algorithm32 transport path. The rendered PNG is a display preview; the verification criteria use the spectral transfer arrays and geometry diagnostics.',
		'',
		'## Outputs',
		'',
		'- `reference-image.png`: low-resolution Algorithm32 preview assembled from Three rays.',
		'- `object-mask.png`: Three hit classification mask.',
		'- `geometry-diagnostics.json`: camera ray and analytic card-hit checks.',
		'- `transport-diagnostics.json`: selected spectral packets and transfer identity checks.',
		'- `criteria-results.json`: pass/fail criteria.',
		'',
		'## Key Measurements',
		'',
		`- Sky pixels: ${renderResult.radianceStats.skyPixels}`,
		`- Hit pixels: ${renderResult.radianceStats.hitPixels}`,
		`- Incident sky cache entries: ${renderResult.cacheDiagnostics.incidentSkyCacheEntries}`,
		`- Split-segment max T error: ${split.maxTransmittanceError}`,
		`- Split-segment max path-radiance error: ${split.maxPathRadianceError}`,
		`- Low-vs-high Sun path-radiance max delta: ${response.pathRadianceDifferenceMaxAbs}`,
		'',
		'## Interpretation',
		'',
		'The baseline bootstrap problem is solved for the CPU side: Three can provide the camera rays, hit distances, and object metadata needed by Algorithm32. The next shader-lab step can reuse this scene definition as the oracle path when a browser shader adapter is added.',
		'',
	].join('\n');
}

function makeSunsetFloorReport({
	artifact,
	summary,
	renderResult,
	transportDiagnostics,
}) {
	const floorAverageRgb = averageRgbForMask(renderResult, [90, 90, 90]);

	return [
		'# Algorithm32 Sunset Floor Scene',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This run renders a no-card scene with a synthetic grass-green floor, a Three camera facing the low-Sun Figure 1 sunset/rise direction, and Algorithm32 spectral sky/floor transport.',
		'',
		'## Outputs',
		'',
		'- `reference-image.png`: sunset-facing floor and sky preview.',
		'- `object-mask.png`: sky/floor classification mask.',
		'- `transport-diagnostics.json`: selected sky and floor spectral packets.',
		'- `criteria-results.json`: pass/fail criteria for this scene request.',
		'',
		'## Key Measurements',
		'',
		`- Sun case: ${transportDiagnostics.sunCase.id}`,
		`- Sunset framing: ${transportDiagnostics.sunsetFraming?.id || 'balanced'}`,
		`- Vertical FOV: ${transportDiagnostics.sunsetFraming?.verticalFovDegrees || 'unknown'} deg`,
		`- Sky pixels: ${renderResult.radianceStats.skyPixels}`,
		`- Floor pixels: ${renderResult.objectCounts['grass-green-floor'] || 0}`,
		`- Average floor RGB: ${floorAverageRgb ? floorAverageRgb.join(', ') : 'none'}`,
		`- Incident sky cache entries: ${renderResult.cacheDiagnostics.incidentSkyCacheEntries}`,
		'',
		'## Interpretation',
		'',
		'The requested scene is generated through the same Algorithm32 spectral transport path used by the shader-lab reference, with the grass floor treated as caller-provided synthetic radiance and the sky computed from the low-Sun cleanroom atmosphere.',
		'',
	].join('\n');
}

function makeMountainRidgesReport({
	artifact,
	summary,
	renderResult,
	transportDiagnostics,
}) {
	return [
		'# Algorithm32 Mountain Ridges Scene',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This run renders a subjective mountain-range view with several procedural ridge silhouettes receding into the distance. It uses the same Three raycast plus Algorithm32 spectral sky/object transfer path as the reference runner, but no formal visual validation criteria are claimed for this composition.',
		'',
		'## Outputs',
		'',
		'- `reference-image.png`: mountain ridge preview.',
		'- `object-mask.png`: sky, valley floor, and ridge layer classification mask.',
		'- `image-stats.json`: pixel counts and render statistics.',
		'- `transport-diagnostics.json`: scene description and render-path summary only.',
		'',
		'## Key Measurements',
		'',
		`- Sun case: ${transportDiagnostics.sunCase.id}`,
		`- Mountain view: ${transportDiagnostics.mountainView?.id || 'none'}`,
		`- Sky pixels: ${renderResult.radianceStats.skyPixels}`,
		`- Hit pixels: ${renderResult.radianceStats.hitPixels}`,
		`- Scene objects: ${transportDiagnostics.sceneObjects.length}`,
		`- Object counts: ${JSON.stringify(renderResult.objectCounts)}`,
		`- Incident sky cache entries: ${renderResult.cacheDiagnostics.incidentSkyCacheEntries}`,
		'',
		'## Interpretation',
		'',
		'This is a visual study scene for later shader-lab work: a mountain valley layout with multiple ridge distances, no trees or asset dependencies, and Algorithm32 atmospheric transfer on terrain hits. Acceptance here means the artifact rendered successfully for subjective inspection.',
		'',
	].join('\n');
}

function sceneObjectsForInputs(sceneSetup) {
	if (sceneSetup.sceneObjects) {
		return sceneSetup.sceneObjects;
	}

	return sceneSetup.cards.map((card) => ({
		id: card.id,
		kind: 'vertical spectral card',
		spectrumId: card.spectrumId,
		centerMeters: vectorToArray(card.center),
		widthMeters: card.width,
		heightMeters: card.height,
	}));
}

function sceneDescriptionForInputs(sceneSetup) {
	if (sceneSetup.sceneMode === SCENE_MODES.sunsetFloor) {
		return 'Three PerspectiveCamera plus one grass-green floor plane and no card objects.';
	}
	if (sceneSetup.sceneMode === SCENE_MODES.mountainRidges) {
		return 'Three PerspectiveCamera plus procedural layered mountain ridge silhouettes and a valley floor.';
	}

	return 'Three PerspectiveCamera plus three vertical spectral cards and a ground plane.';
}

function sceneReasonForInputs(sceneSetup) {
	if (sceneSetup.sceneMode === SCENE_MODES.sunsetFloor) {
		return 'Generate the requested sunset-facing floor/sky scene while preserving the Algorithm32 sky and floor transfer path.';
	}
	if (sceneSetup.sceneMode === SCENE_MODES.mountainRidges) {
		return 'Generate the requested subjective mountain-range layout while preserving the Algorithm32 sky and terrain transfer path.';
	}

	return 'Stress ray reconstruction, object hits, sky rays, and finite object transfer before browser shader adapters exist.';
}

function sceneDisplayTargetForInputs(sceneSetup) {
	if (sceneSetup.sceneMode === SCENE_MODES.sunsetFloor) {
		return 'Grass-green floor facing the low-Sun Figure 1 sunset/rise sky.';
	}
	if (sceneSetup.sceneMode === SCENE_MODES.mountainRidges) {
		if (sceneSetup.mountainView?.id === MOUNTAIN_VIEW_MODES.sunsetBehindCamera) {
			return 'Layered green mountain ridges with the low-Sun sunset case behind the camera.';
		}

		return 'Layered green mountain ridges fading through atmosphere into a bright high-Sun sky.';
	}

	return 'Not used for the three-card reference scene.';
}

function stateGoalTitle(sceneSetup) {
	if (sceneSetup.sceneMode === SCENE_MODES.mountainRidges) {
		return 'Render the requested subjective mountain ridge scene for visual inspection.';
	}

	return 'Build and verify the first Node/Three CPU reference layer for Algorithm32 shader work.';
}

function stateGoalSuccessText(sceneSetup) {
	if (sceneSetup.sceneMode === SCENE_MODES.mountainRidges) {
		return 'The run succeeds when the requested image artifact is produced through the Algorithm32 scene path. No formal pass/fail visual criteria are claimed for this subjective scene.';
	}

	return 'The run succeeds when Three camera rays and Raycaster hits can drive Algorithm32 sky/object transfer packets, and when geometry and spectral-transfer identities pass on the generated scene.';
}

function traceSegmentForThreeHit({
	camera,
	ray,
	distance,
	sunCase,
	sunRay,
	incidentSkyCache,
	includeSecondOrder,
}) {
	return computePathRadianceSegment({
		origin: threeToAlgorithmWorld(camera.position),
		direction: threeDirectionToAlgorithm(ray.direction),
		distance,
		sunCase,
		sunRay,
		controls: NUMERICAL_CONTROLS,
		includeSecondOrder,
		incidentSkyCache,
	});
}

function traceSkyForThreeRay({
	camera,
	ray,
	sunCase,
	sunRay,
	incidentSkyCache,
	includeSecondOrder = true,
}) {
	const origin = threeToAlgorithmWorld(camera.position);
	const direction = threeDirectionToAlgorithm(ray.direction);
	const radius = length(origin);
	const mu = dot(origin, direction) / radius;
	const distance = distanceToTopAtmosphereBoundary(radius, mu);

	return computePathRadianceSegment({
		origin,
		direction,
		distance,
		sunCase,
		sunRay,
		controls: NUMERICAL_CONTROLS,
		includeSecondOrder,
		incidentSkyCache,
	});
}

function computePathRadianceSegment({
	origin,
	direction,
	distance,
	sunCase,
	sunRay,
	controls,
	includeSecondOrder,
	incidentSkyCache,
}) {
	const fullOpticalLengths = computeOpticalLengthsAlongDistance(
		origin,
		direction,
		distance,
		controls.viewRayScatteringIntervals
	);
	const fullTransmittance = computeTransmittanceSpectrum(fullOpticalLengths);

	if (distance === 0) {
		return {
			opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
			transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
			pathRadianceByWavelength: zeroSpectrum(),
			firstOrderPathRadianceByWavelength: zeroSpectrum(),
			secondOrderPathRadianceByWavelength: zeroSpectrum(),
			diagnostics: {
				sampleCount: controls.viewRayScatteringIntervals,
				minAltitudeMeters: ATMOSPHERE.observerHeightMeters,
				maxAltitudeMeters: ATMOSPHERE.observerHeightMeters,
				rayleighOpticalLength: 0,
				mieOpticalLength: 0,
				absorptionOpticalLength: 0,
			},
		};
	}

	const sampleCount = controls.viewRayScatteringIntervals;
	const step = distance / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	const cumulativeAbsorption = [0];
	const rayleighSum = zeroSpectrum();
	const mieSum = zeroSpectrum();
	const secondOrderSum = zeroSpectrum();
	let minAltitudeMeters = Number.POSITIVE_INFINITY;
	let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(position);

		minAltitudeMeters = Math.min(minAltitudeMeters, density.altitudeMeters);
		maxAltitudeMeters = Math.max(maxAltitudeMeters, density.altitudeMeters);
		samples.push({ position, density });

		if (sampleIndex > 0) {
			const previousDensity = samples[sampleIndex - 1].density;
			cumulativeRayleigh[sampleIndex] =
				cumulativeRayleigh[sampleIndex - 1] +
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie[sampleIndex] =
				cumulativeMie[sampleIndex - 1] +
				0.5 * (previousDensity.mie + density.mie) * step;
			cumulativeAbsorption[sampleIndex] =
				cumulativeAbsorption[sampleIndex - 1] +
				0.5 * (previousDensity.absorption + density.absorption) * step;
		}
	}

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sample = samples[sampleIndex];
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		const viewTransmittance = computeTransmittanceSpectrum({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: cumulativeAbsorption[sampleIndex],
		}).transmittanceByWavelength;
		const sunTransmittance = computeTransmittanceToSunSpectrum(
			sample.position,
			sunRay,
			controls
		);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const transmittance =
				viewTransmittance[channelIndex] * sunTransmittance[channelIndex];

			rayleighSum[channelIndex] +=
				transmittance * sample.density.rayleigh * weight;
			mieSum[channelIndex] += transmittance * sample.density.mie * weight;
		}

		if (includeSecondOrder) {
			const secondOrder = computeSecondOrderAtSample({
				sunCase,
				position: sample.position,
				viewRay: direction,
				sunRay,
				density: sample.density,
				viewTransmittance,
				controls,
				incidentSkyCache,
			});

			for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
				secondOrderSum[channelIndex] += secondOrder[channelIndex] * weight;
			}
		}
	}

	const nu = dot(direction, sunRay);
	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
	const firstOrderPathRadianceByWavelength = SPECTRAL_CHANNELS.map(
		(channel, channelIndex) => {
			const wavelengthMicrometers = wavelengthNanometersToMicrometers(
				channel.wavelengthNanometers
			);
			const rayleigh =
				rayleighSum[channelIndex] *
				step *
				channel.solarIrradiance *
				rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				rayleighPhase;
			const mie =
				mieSum[channelIndex] *
				step *
				channel.solarIrradiance *
				mieScatteringCoefficientAt(wavelengthMicrometers) *
				miePhase;

			return rayleigh + mie;
		}
	);
	const secondOrderPathRadianceByWavelength = secondOrderSum.map(
		(value) => value * step
	);
	const pathRadianceByWavelength = addArrays(
		firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength
	);

	return {
		opticalDepthByWavelength: fullTransmittance.opticalDepthByWavelength,
		transmittanceByWavelength: fullTransmittance.transmittanceByWavelength,
		pathRadianceByWavelength,
		firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength,
		diagnostics: {
			sampleCount,
			minAltitudeMeters,
			maxAltitudeMeters,
			rayleighOpticalLength: fullOpticalLengths.rayleighOpticalLength,
			mieOpticalLength: fullOpticalLengths.mieOpticalLength,
			absorptionOpticalLength: fullOpticalLengths.absorptionOpticalLength,
		},
	};
}

function computeSecondOrderAtSample({
	sunCase,
	position,
	viewRay,
	sunRay,
	density,
	viewTransmittance,
	controls,
	incidentSkyCache,
}) {
	const secondOrder = zeroSpectrum();
	const incomingDirections = fibonacciSphereIncomingDirections(
		sunRay,
		controls.secondOrderIncomingDirections
	);
	const angularWeight = (4 * Math.PI) / incomingDirections.length;

	for (let directionIndex = 0; directionIndex < incomingDirections.length; directionIndex += 1) {
		const incomingDirection = incomingDirections[directionIndex];
		const incidentRadiance = incidentSkyRadianceForSecondOrder({
			sunCase,
			sunRay,
			incomingDirection,
			directionIndex,
			position,
			controls,
			incidentSkyCache,
		});
		const nu = dot(viewRay, incomingDirection);
		const rayleighPhase = rayleighPhaseFunction(nu);
		const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);

		for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
			const wavelengthMicrometers = wavelengthNanometersToMicrometers(
				SPECTRAL_CHANNELS[channelIndex].wavelengthNanometers
			);
			const scatteringCoefficient =
				density.rayleigh *
					rayleighScatteringCoefficientAt(wavelengthMicrometers) *
					rayleighPhase +
				density.mie *
					mieScatteringCoefficientAt(wavelengthMicrometers) *
					miePhase;

			secondOrder[channelIndex] +=
				viewTransmittance[channelIndex] *
				incidentRadiance[channelIndex] *
				scatteringCoefficient *
				angularWeight;
		}
	}

	return secondOrder;
}

function incidentSkyRadianceForSecondOrder({
	sunCase,
	sunRay,
	incomingDirection,
	directionIndex,
	position,
	controls,
	incidentSkyCache,
}) {
	const altitude = clamp(
		length(position) - ATMOSPHERE.bottomRadiusMeters,
		0,
		ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters
	);
	const binSize =
		(ATMOSPHERE.topRadiusMeters - ATMOSPHERE.bottomRadiusMeters) /
		controls.secondOrderIncidentAltitudeBins;
	const binIndex = clamp(
		Math.floor(altitude / binSize),
		0,
		controls.secondOrderIncidentAltitudeBins - 1
	);
	const key = `${sunCase.id}|${directionIndex}|${binIndex}`;

	if (!incidentSkyCache.has(key)) {
		const binAltitude = (binIndex + 0.5) * binSize;
		const binOrigin = [0, 0, ATMOSPHERE.bottomRadiusMeters + binAltitude];
		const radius = length(binOrigin);
		const mu = dot(binOrigin, incomingDirection) / radius;

		if (rayIntersectsGround(radius, mu)) {
			incidentSkyCache.set(key, zeroSpectrum());
		} else {
			const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);
			const incident = computePathRadianceSegment({
				origin: binOrigin,
				direction: incomingDirection,
				distance: distanceToTop,
				sunCase,
				sunRay,
				controls,
				includeSecondOrder: false,
				incidentSkyCache,
			});

			incidentSkyCache.set(key, incident.pathRadianceByWavelength);
		}
	}

	return incidentSkyCache.get(key);
}

function computeOpticalLengthsAlongDistance(origin, direction, distance, sampleCount) {
	if (distance === 0 || sampleCount === 0) {
		return {
			distance,
			rayleighOpticalLength: 0,
			mieOpticalLength: 0,
			absorptionOpticalLength: 0,
		};
	}

	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	let absorptionOpticalLength = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const samplePosition = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(samplePosition);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
		absorptionOpticalLength += density.absorption * weight * step;
	}

	return {
		distance,
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength,
	};
}

function computeOpticalLengthsToTop(origin, direction, sampleCount) {
	const radius = length(origin);
	const mu = dot(origin, direction) / radius;
	const distanceToTop = distanceToTopAtmosphereBoundary(radius, mu);

	return computeOpticalLengthsAlongDistance(
		origin,
		direction,
		distanceToTop,
		sampleCount
	);
}

function computeTransmittanceSpectrum(opticalLengths) {
	const opticalDepthByWavelength = SPECTRAL_CHANNELS.map((channel) => {
		const wavelengthMicrometers = wavelengthNanometersToMicrometers(
			channel.wavelengthNanometers
		);

		return (
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				opticalLengths.rayleighOpticalLength +
			mieExtinctionCoefficientAt(wavelengthMicrometers) *
				opticalLengths.mieOpticalLength +
			ATMOSPHERE.ozoneAbsorption *
				(opticalLengths.absorptionOpticalLength || 0)
		);
	});

	return {
		opticalDepthByWavelength,
		transmittanceByWavelength: opticalDepthByWavelength.map((tau) =>
			Math.exp(-tau)
		),
	};
}

function computeTransmittanceToSunSpectrum(position, sunRay, controls) {
	const radius = length(position);
	const mu = dot(position, sunRay) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return SPECTRAL_CHANNELS.map(() => 0);
	}

	return computeTransmittanceSpectrum(
		computeOpticalLengthsToTop(
			position,
			sunRay,
			controls.sampleToSunTransmittanceIntervals
		)
	).transmittanceByWavelength;
}

function densityAtPosition(position) {
	const altitude = length(position) - ATMOSPHERE.bottomRadiusMeters;

	return {
		altitudeMeters: altitude,
		rayleigh: exponentialDensity(altitude, ATMOSPHERE.rayleighScaleHeightMeters),
		mie: exponentialDensity(altitude, ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

function distanceToTopAtmosphereBoundary(radius, mu) {
	const discriminant =
		radius * radius * (mu * mu - 1) +
		ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

	return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayIntersectsGround(radius, mu) {
	return (
		mu < 0 &&
		radius * radius * (mu * mu - 1) +
			ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
			0
	);
}

function spectralToDisplayPreview(radianceByWavelength) {
	let x = 0;
	let y = 0;
	let z = 0;

	for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNELS.length; channelIndex += 1) {
		const channel = SPECTRAL_CHANNELS[channelIndex];
		const radiance = radianceByWavelength[channelIndex];

		x += channel.cie[0] * radiance * channel.wavelengthBinWidthNanometers;
		y += channel.cie[1] * radiance * channel.wavelengthBinWidthNanometers;
		z += channel.cie[2] * radiance * channel.wavelengthBinWidthNanometers;
	}

	const linearSrgb = [
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[0] * x + XYZ_TO_SRGB[1] * y + XYZ_TO_SRGB[2] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[3] * x + XYZ_TO_SRGB[4] * y + XYZ_TO_SRGB[5] * z),
		MAX_LUMINOUS_EFFICACY *
			(XYZ_TO_SRGB[6] * x + XYZ_TO_SRGB[7] * y + XYZ_TO_SRGB[8] * z),
	];
	const displayRgb = linearSrgb.map((value) =>
		clamp(1 - Math.exp(-DISPLAY_TONE_MAP_K * Math.max(0, value)), 0, 1)
	);
	const encodedRgb = displayRgb.map((value) => clampByte(value * 255));

	return {
		cieXyzUnscaled: [x, y, z],
		linearSrgb,
		displayRgb,
		encodedRgb,
	};
}

function objectRadianceSpectrum(spectrum) {
	return SPECTRAL_CHANNELS.map((channel) =>
		spectrum.evaluate(channel.wavelengthNanometers)
	);
}

function composeObjectRadiance(objectRadiance, transfer) {
	return addArrays(
		multiplyArrays(objectRadiance, transfer.transmittanceByWavelength),
		transfer.pathRadianceByWavelength
	);
}

function sunDirection(sunCase) {
	const altitude = degreesToRadians(sunCase.sunAltitudeDegrees);
	const azimuth = degreesToRadians(sunCase.sunAzimuthDegrees);
	const horizontalLength = Math.cos(altitude);

	return normalize([
		horizontalLength * Math.cos(azimuth),
		horizontalLength * Math.sin(azimuth),
		Math.sin(altitude),
	]);
}

function manualCameraRay(camera, ndc) {
	const origin = new THREE.Vector3();
	camera.getWorldPosition(origin);
	const point = new THREE.Vector3(ndc.x, ndc.y, 0.5).unproject(camera);
	const direction = point.sub(origin).normalize();

	return new THREE.Ray(origin, direction);
}

function firstHit(raycaster, meshes) {
	const hits = raycaster.intersectObjects(meshes, false);
	return hits.length > 0 ? hits[0] : null;
}

function worldPointToNdcPixel(point, camera, width, height) {
	const projected = point.clone().project(camera);
	const x = ((projected.x + 1) / 2) * width - 0.5;
	const y = ((1 - projected.y) / 2) * height - 0.5;

	return {
		x,
		y,
		ndc: { x: projected.x, y: projected.y },
	};
}

function analyticDistanceToZPlane(ray, planeZ) {
	const denominator = ray.direction.z;
	if (Math.abs(denominator) < 1e-12) {
		return Number.POSITIVE_INFINITY;
	}

	return (planeZ - ray.origin.z) / denominator;
}

function pixelToNdc(x, y, width, height) {
	return {
		x: ((x + 0.5) / width) * 2 - 1,
		y: -(((y + 0.5) / height) * 2 - 1),
	};
}

function threeToAlgorithmWorld(vector) {
	return [
		vector.x,
		-vector.z,
		ATMOSPHERE.bottomRadiusMeters + vector.y,
	];
}

function threeDirectionToAlgorithm(vector) {
	return normalize([vector.x, -vector.z, vector.y]);
}

function algorithmDirectionToThree(vector) {
	return new THREE.Vector3(vector[0], vector[2], -vector[1]);
}

function summarizeTransfer(transfer) {
	return {
		opticalDepthByWavelength: transfer.opticalDepthByWavelength,
		transmittanceByWavelength: transfer.transmittanceByWavelength,
		pathRadianceByWavelength: transfer.pathRadianceByWavelength,
		firstOrderPathRadianceByWavelength:
			transfer.firstOrderPathRadianceByWavelength,
		secondOrderPathRadianceByWavelength:
			transfer.secondOrderPathRadianceByWavelength,
		meanTransmittance: mean(transfer.transmittanceByWavelength),
		meanPathRadiance: mean(transfer.pathRadianceByWavelength),
		diagnostics: transfer.diagnostics,
	};
}

function makePixelDiagnostic({
	x,
	y,
	ndc,
	ray,
	hit,
	transfer,
	objectRadiance,
	finalRadiance,
}) {
	return {
		x,
		y,
		ndc,
		hitObject: hit.object.name,
		hitKind: hit.object.userData.kind,
		spectrumId: hit.object.userData.spectrumId,
		threeRay: {
			origin: vectorToArray(ray.origin),
			direction: vectorToArray(ray.direction),
		},
		algorithm32Ray: {
			origin: threeToAlgorithmWorld(ray.origin),
			direction: threeDirectionToAlgorithm(ray.direction),
			distanceMeters: hit.distance,
		},
		objectRadianceByWavelength: objectRadiance,
		finalRadianceByWavelength: finalRadiance,
		transfer: summarizeTransfer(transfer),
	};
}

function updateRadianceStats(stats, transfer) {
	stats.minMeanTransmittance = Math.min(
		stats.minMeanTransmittance,
		mean(transfer.transmittanceByWavelength)
	);
	stats.maxMeanTransmittance = Math.max(
		stats.maxMeanTransmittance,
		mean(transfer.transmittanceByWavelength)
	);
	stats.maxPathRadianceMean = Math.max(
		stats.maxPathRadianceMean,
		mean(transfer.pathRadianceByWavelength)
	);
}

function finalizeRadianceStats(stats) {
	return {
		...stats,
		minMeanTransmittance:
			stats.minMeanTransmittance === Number.POSITIVE_INFINITY
				? null
				: stats.minMeanTransmittance,
		maxMeanTransmittance:
			stats.maxMeanTransmittance === Number.NEGATIVE_INFINITY
				? null
				: stats.maxMeanTransmittance,
	};
}

function isDiagnosticPixel(x, y, width, height) {
	const xPositions = [
		Math.floor(width * 0.25),
		Math.floor(width * 0.5),
		Math.floor(width * 0.75),
	];
	const yPositions = [
		Math.floor(height * 0.35),
		Math.floor(height * 0.5),
		Math.floor(height * 0.65),
	];

	return xPositions.includes(x) && yPositions.includes(y);
}

function maskColorForHit(hit) {
	if (hit.object.userData.maskRgb) {
		return hit.object.userData.maskRgb;
	}

	if (hit.object.userData.kind === 'ground') {
		return [90, 90, 90];
	}

	if (hit.object.userData.spectrumId === 'red') {
		return [230, 40, 55];
	}
	if (hit.object.userData.spectrumId === 'green') {
		return [65, 185, 80];
	}
	if (hit.object.userData.spectrumId === 'blue') {
		return [60, 110, 220];
	}

	return [255, 255, 255];
}

function triangularSpectrumWeight(lambdaNm, centerNm, halfWidthNm) {
	return Math.max(0, 1 - Math.abs(lambdaNm - centerNm) / halfWidthNm);
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		ATMOSPHERE.mieSingleScatteringAlbedo
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}

function fibonacciSphereIncomingDirections(sunRay, count) {
	const halfCount = Math.floor(count / 2);
	const goldenRatio = (1 + Math.sqrt(5)) / 2;
	const sunAxis = normalize(sunRay);
	const reference =
		Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const zAxis = normalize(
		addVectors(reference, scaleVector(sunAxis, -dot(reference, sunAxis)))
	);
	const yAxis = normalize(cross(zAxis, sunAxis));
	const directions = [];

	for (let index = -halfCount; directions.length < count; index += 1) {
		const z = (2 * index) / count;
		const latitude = Math.asin(clamp(z, -1, 1));
		const longitude = (2 * Math.PI * index) / goldenRatio;
		const horizontalScale = Math.cos(latitude);
		const localX = horizontalScale * Math.cos(longitude);
		const localY = horizontalScale * Math.sin(longitude);
		const localZ = z;

		directions.push(
			normalize(
				addVectors(
					addVectors(scaleVector(sunAxis, localX), scaleVector(yAxis, localY)),
					scaleVector(zAxis, localZ)
				)
			)
		);
	}

	return directions;
}

function exponentialDensity(altitudeMeters, scaleHeightMeters) {
	return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

function wavelengthNanometersToMicrometers(wavelengthNanometers) {
	return wavelengthNanometers * 1e-3;
}

function observerPosition() {
	return [
		0,
		0,
		ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters,
	];
}

function zeroSpectrum() {
	return SPECTRAL_CHANNELS.map(() => 0);
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
	return [
		a[1] * b[2] - a[2] * b[1],
		a[2] * b[0] - a[0] * b[2],
		a[0] * b[1] - a[1] * b[0],
	];
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
	const vectorLength = length(vector);

	if (vectorLength === 0) {
		return [0, 0, 0];
	}

	return [
		vector[0] / vectorLength,
		vector[1] / vectorLength,
		vector[2] / vectorLength,
	];
}

function scaleVector(vector, scalar) {
	return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

function addVectors(a, b) {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function subtractArrays(a, b) {
	return a.map((value, index) => value - b[index]);
}

function addArrays(a, b) {
	return a.map((value, index) => value + b[index]);
}

function multiplyArrays(a, b) {
	return a.map((value, index) => value * b[index]);
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
}

function angleBetween(a, b) {
	return Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1));
}

function mean(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxAbs(values) {
	return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function degreesToRadians(degrees) {
	return (degrees * Math.PI) / 180;
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function vectorToArray(vector) {
	return [vector.x, vector.y, vector.z];
}

function putPixel(pixels, offset, rgba) {
	pixels[offset] = rgba[0];
	pixels[offset + 1] = rgba[1];
	pixels[offset + 2] = rgba[2];
	pixels[offset + 3] = rgba[3];
}

function averageRgbForMask(renderResult, maskRgb) {
	let count = 0;
	const sum = [0, 0, 0];

	for (let offset = 0; offset < renderResult.maskPixels.length; offset += 4) {
		if (
			renderResult.maskPixels[offset] !== maskRgb[0] ||
			renderResult.maskPixels[offset + 1] !== maskRgb[1] ||
			renderResult.maskPixels[offset + 2] !== maskRgb[2]
		) {
			continue;
		}

		sum[0] += renderResult.pixels[offset];
		sum[1] += renderResult.pixels[offset + 1];
		sum[2] += renderResult.pixels[offset + 2];
		count += 1;
	}

	return count === 0 ? null : sum.map((value) => value / count);
}

function incrementMap(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function criterion({ id, status, tolerance, measured, notes }) {
	return {
		criterionId: id,
		status,
		tolerance,
		measured,
		notes,
	};
}

function summarizeCriteria(criteria) {
	return {
		total: criteria.length,
		passed: criteria.filter((item) => item.status === 'pass').length,
		failed: criteria.filter((item) => item.status === 'fail').length,
		unresolved: criteria.filter((item) => item.status === 'unresolved').length,
	};
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const maxNumber = entries
		.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
		.reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 3))), 0);
	const folderName = `${String(maxNumber + 1).padStart(3, '0')}-${slug(label)}`;
	const directory = path.join(outRoot, folderName);

	await fs.mkdir(directory, { recursive: false });

	return {
		directory,
		folderName,
		relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
	};
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
	await fs.writeFile(filePath, value);
}

async function writePng(filePath, width, height, pixels) {
	await sharp(pixels, {
		raw: {
			width,
			height,
			channels: 4,
		},
	})
		.png()
		.toFile(filePath);
}

function slug(value) {
	return String(value || 'run')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'run';
}

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
