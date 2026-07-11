import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

import { Algorithm32 } from '../../shared/algorithm32/production/Algorithm32.js';
import CanonicalAtmosphere from '../../shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js';
import BrunetonColorDisplayModel from '../../shared/algorithm32/production/color/BrunetonColorDisplayModel.js';
import {
	CANONICAL_ATMOSPHERE_CONSTANTS,
	CANONICAL_SPECTRAL_BASIS,
	CANONICAL_SPECTRAL_CHANNELS,
	FIGURE1_DISPLAY_CONSTANTS,
	SHADER_QUALITY_PROFILES,
	shaderQualityProfileById,
} from '../../shared/algorithm32/production/constants/Algorithm32CanonicalData.js';
import FlatEarthGeometry from '../../shared/algorithm32/production/geometries/FlatEarthGeometry.js';
import SphericalEarthGeometry from '../../shared/algorithm32/production/geometries/SphericalEarthGeometry.js';
import DistantSunLightSource from '../../shared/algorithm32/production/light-sources/DistantSunLightSource.js';
import FlatSynchronizer from '../../shared/algorithm32/production/FlatSynchronizer.js';
import LocalSunLightSource from '../../shared/algorithm32/production/light-sources/LocalSunLightSource.js';
import { POC_STARS } from '../flat/shared/projection/PocStars.js';

const METERS_PER_SCENE_UNIT = 1000;
const CAMERA_HEIGHT_SCENE_UNITS = 0.005;
const CAMERA_NEAR_SCENE_UNITS = 0.002;
const CAMERA_FAR_SCENE_UNITS = 500;
const TOP_ALTITUDE_METERS = 100000;
const SKY_RAY_LIMIT_METERS = 1926774;
const FALSE_SUN_ALTITUDE_METERS = 3000 * 1609.344;
const FALSE_SUN_RADIUS_METERS = 16 * 1609.344;
const FALSE_SUN_REFERENCE_DISTANCE_METERS = 4800 * 1000;
const FALSE_SUN_REFERENCE_SPECTRAL_INCIDENT_SCALE = 2.71970293473;
const LOCATION_PRESETS = Object.freeze([
	Object.freeze({
		key: 'san-jose',
		label: 'San Jose',
		name: 'San Jose, CA',
		latitude: 37.3382,
		longitude: -121.8863,
		dateBasis: '2024-06-20T12:00:00.000Z',
	}),
	Object.freeze({
		key: 'union-glacier',
		label: 'Union Glacier',
		name: 'Union Glacier Camp',
		latitude: -79.768036,
		longitude: -83.261666,
		dateBasis: '2024-12-14T12:00:00.000Z',
	}),
]);
const FLAT_TIME_PRESETS = Object.freeze([
	Object.freeze({ key: 'flat-0', label: 'Flat 0', offsetDegrees: 0 }),
	Object.freeze({ key: 'flat-45', label: 'Flat 45', offsetDegrees: 45 }),
	Object.freeze({ key: 'flat-90', label: 'Flat 90', offsetDegrees: 90 }),
	Object.freeze({ key: 'flat-135', label: 'Flat 135', offsetDegrees: 135 }),
	Object.freeze({ key: 'flat-180', label: 'Flat 180', offsetDegrees: 180 }),
]);
const GLOBE_TIME_PRESETS = Object.freeze([
	Object.freeze({ key: 'globe-sunrise', label: 'Sunrise', kind: 'sunrise' }),
	Object.freeze({ key: 'globe-solar-noon', label: 'Solar Noon', kind: 'solar-noon-offset', offsetHours: 0 }),
	Object.freeze({ key: 'globe-sunset', label: 'Sun Set', kind: 'sunset' }),
]);
const CAMERA_LOOK_AT_DISTANCE_METERS = 800;
const CAMERA_LOOK_AT_HEIGHT_METERS = 272.67;
const BENCHMARK_WARMUP_RUNS = 3;
const BENCHMARK_MEASURED_RUNS = 30;
const BENCHMARK_SETTLE_RUNS = 3;
const BENCHMARK_WIDTH = 1024;
const BENCHMARK_HEIGHT = 768;
const LIVE_PERFORMANCE_SAMPLE_INTERVAL_FRAMES = 120;
const BENCHMARK_PERFORMANCE_SAMPLE_INTERVAL_FRAMES = 1;
const LIVE_PERFORMANCE_MAX_PENDING_QUERIES = 1;
const BENCHMARK_PERFORMANCE_MAX_PENDING_QUERIES = 1;
const LIVE_RENDER_INTERVAL_MS = 1000 / 20;
const DELAYED_SCENE_REFRESH_MS = 450;
const GROUND_GRASS_COLOR = 0x4fa33d;
const DEFAULT_SCENE_BACKGROUND_COLOR = 0x060912;
const ATMOSPHERE_ONLY_BACKGROUND_COLOR = 0x00aa00;
const GREEN_SHELL_DIAGNOSTIC_COLOR = 0x00ff00;
const GREEN_SHELL_RADIUS_SCENE_UNITS = Math.min(CAMERA_FAR_SCENE_UNITS * 0.85, (TOP_ALTITUDE_METERS / METERS_PER_SCENE_UNIT) + 35);
const GREEN_SHELL_THETA_LENGTH_RADIANS = Math.PI;
const GREEN_SHELL_WIDTH_SEGMENTS = 96;
const GREEN_SHELL_HEIGHT_SEGMENTS = 32;
const ENDPOINT_SCENE_DIRECTIONAL_LIGHT_INTENSITY = 4.0;
const ENDPOINT_SCENE_AMBIENT_INTENSITY_RANGE = Object.freeze({
	min: 0.24,
	max: 0.62,
});
const STAR_ANALOG_COUNT = 192;
const STAR_ANALOG_MIN_ALTITUDE_SINE = 0.25;
const STAR_ANALOG_MAX_ALTITUDE_SINE = 0.98;
const STAR_ANALOG_TOP_CLEARANCE_SCENE_UNITS = 25;
const STAR_ANALOG_MAX_DISTANCE_SCENE_UNITS = CAMERA_FAR_SCENE_UNITS * 0.9;
const STAR_ANALOG_REFERENCE_MAGNITUDE = -1.46;
const STAR_ANALOG_REFERENCE_SCENE_RGB = 0.004;
const STAR_ANALOG_RADIUS_BASE_DISTANCE_RATIO = 0.00022;
const STAR_ANALOG_RADIUS_PER_STYLE_PIXEL_DISTANCE_RATIO = 0.00016;
const STAR_ANALOG_MAGNITUDE_PERMUTATION_STEP = 89;
const STAR_ANALOG_GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5));
const STAR_ANALOG_MAGNITUDE_RANGE = starMagnitudeRange(POC_STARS);
const STAR_CALIBRATION_LEVELS = Object.freeze([
	Object.freeze({ label: 'A', sceneRgb: 0.000005 }),
	Object.freeze({ label: 'B', sceneRgb: 0.000015 }),
	Object.freeze({ label: 'C', sceneRgb: 0.00005 }),
	Object.freeze({ label: 'D', sceneRgb: 0.00015 }),
	Object.freeze({ label: 'E', sceneRgb: 0.00045 }),
	Object.freeze({ label: 'F', sceneRgb: 0.00135 }),
	Object.freeze({ label: 'G', sceneRgb: 0.004 }),
	Object.freeze({ label: 'H', sceneRgb: 0.012 }),
]);
const STAR_CALIBRATION_ALTITUDE_SINE = 0.55;
const STAR_CALIBRATION_AZIMUTH_SPACING_RADIANS = Math.PI / 30;
const STAR_CALIBRATION_RADIUS_DISTANCE_RATIO = 0.00075;
const LOCAL_CACHE_Z_BINS_METERS = Object.freeze([2, 1000, 5000, 15000, 45000]);
const LOCAL_CACHE_RHO_BINS_METERS = Object.freeze([0, 500000, 1250000, 2500000, 5000000, 9000000, 13000000]);
const RECONCILIATION_REVIEW_SHADOW_FRAME = Object.freeze({
	focusSceneUnits: Object.freeze([-0.46, 0, -4.3374999999999995]),
	extentSceneUnits: 10.112499999999999,
	lightDistanceSceneUnits: 40.449999999999996,
	cameraNear: 0.5,
	cameraFar: 80.89999999999999,
	mapSize: 4096,
	bias: 0,
	normalBias: 0,
	radius: 2.5,
	shadowIntensity: 0.45,
});
const RECONCILIATION_REVIEW_SHADOW_OBJECT_MIN_MARGINS = Object.freeze({
	'camera-local': 0.01,
	'distant-reference': 0.05,
});
const RECONCILIATION_REVIEW_SHADOW_OBJECT_SIZE_MARGIN_RATIO = 0.25;
const RECONCILIATION_REVIEW_SHADOW_LIGHT_DISTANCE_MIN = 0.05;
const RECONCILIATION_REVIEW_SHADOW_CAMERA_NEAR = 0.001;
const RECONCILIATION_REVIEW_SHADOW_DEPTH_PADDING_MIN = 0.05;
const RECONCILIATION_REVIEW_SHADOW_LOCAL_SURFACE_TOLERANCE_SCENE_UNITS = 0.00001;
const RECONCILIATION_REVIEW_SHADOW_LOCAL_PROJECTION_MIN_DISTANCE_SCENE_UNITS = 0.25;
const RECONCILIATION_REVIEW_SHADOW_LOCAL_PROJECTION_SIZE_RATIO = 50;
const RECONCILIATION_REVIEW_SHADOW_LOCAL_NORMAL_DOT_MIN = 0;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_PADDING_SCENE_UNITS = 1;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_X_EXTENT_SCENE_UNITS = 1;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_Z_EXTENT_SCENE_UNITS = 1;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_TARGET_SPACING_SCENE_UNITS = 0.0005;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_WIDTH_SEGMENTS = 4096;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_HEIGHT_SEGMENTS = 4096;
const RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MAX_SEGMENTS = 4096;
const RECONCILIATION_REVIEW_BOX_SURFACE_PENETRATION_RATIO = 0;
const RECONCILIATION_REVIEW_BOXES = Object.freeze([
	Object.freeze({
		name: 'union-review-near-yellow-box',
		kind: 'diagnostic-color-box',
		color: 0xe2b222,
		centerXZ: Object.freeze([-0.26, -1.6]),
		sizeSceneUnits: Object.freeze([0.18, 0.22, 0.18]),
		rotationYDegrees: 0,
		shadowFrame: 'camera-local',
	}),
	Object.freeze({
		name: 'union-review-close-single-story-building-box',
		kind: 'diagnostic-color-box',
		color: 0x1c69b9,
		centerXZ: Object.freeze([-0.012, -0.03]),
		sizeSceneUnits: Object.freeze([0.014, 0.006, 0.01]),
		rotationYDegrees: 0,
		shadowFrame: 'camera-local',
	}),
	Object.freeze({
		name: 'union-review-mid-white-box',
		kind: 'diagnostic-color-box',
		color: 0xdcd6be,
		centerXZ: Object.freeze([0.62, -3.6]),
		sizeSceneUnits: Object.freeze([0.42, 0.5, 0.42]),
		rotationYDegrees: 0,
		shadowFrame: 'camera-local',
	}),
	Object.freeze({
		name: 'union-review-far-orange-box',
		kind: 'diagnostic-color-box',
		color: 0xda5f1c,
		centerXZ: Object.freeze([-1.3, -8.2]),
		sizeSceneUnits: Object.freeze([0.9, 0.9, 0.9]),
		rotationYDegrees: 0,
		shadowFrame: 'camera-local',
	}),
	Object.freeze({
		name: 'union-review-distant-cyan-box',
		kind: 'diagnostic-color-box',
		color: 0x2aaabc,
		centerXZ: Object.freeze([18, -60]),
		sizeSceneUnits: Object.freeze([6, 5, 6]),
		rotationYDegrees: 0,
		shadowFrame: 'distant-reference',
	}),
	Object.freeze({
		name: 'union-review-denali-200km-orange-box',
		kind: 'diagnostic-color-box',
		color: 0xe05f20,
		centerXZ: Object.freeze([100, -250]),
		sizeSceneUnits: Object.freeze([50, 6.2, 100]),
		rotationYDegrees: 0,
		shadowFrame: 'distant-reference',
	}),
]);
const root = document.getElementById('main-content');

globalThis.__flat32Cleanup?.();
root.replaceChildren();
root.append(createStyle(), createShell());

const canvas = document.getElementById('flat32-canvas');
const status = document.getElementById('flat32-status');
const setupOverlay = document.getElementById('flat32-setup-overlay');
const modeButton = document.getElementById('flat32-mode-button');
const locationButton = document.getElementById('flat32-location-button');
const timeBasisButton = document.getElementById('flat32-time-basis-button');
const timeValue = document.getElementById('flat32-time-value');
const flatTimeControls = document.getElementById('flat32-flat-time-controls');
const globeTimeControls = document.getElementById('flat32-globe-time-controls');
const starCalibrationLabelLayer = document.getElementById('flat32-star-calibration-labels');
const shaderButton = document.getElementById('flat32-shader-button');
const atmosphereDiagnosticButton = document.getElementById('flat32-atmosphere-diagnostic-button');
const greenShellDiagnosticButton = document.getElementById('flat32-green-shell-diagnostic-button');
const qualityButton = document.getElementById('flat32-quality-button');
const performanceButton = document.getElementById('flat32-performance-button');
const benchmarkButton = document.getElementById('flat32-benchmark-button');
const performancePanel = document.getElementById('flat32-performance');
const benchmarkPanel = document.getElementById('flat32-benchmark-report');
const renderer = new THREE.WebGLRenderer({ antialias: false, canvas });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, CAMERA_NEAR_SCENE_UNITS, CAMERA_FAR_SCENE_UNITS);
const composer = new EffectComposer(renderer);
const controls = new PointerLockControls(camera, renderer.domElement);
const bindingValues = createBindingValues();
let currentMode = 'flat';
let currentLocationKey = 'union-glacier';
let currentTimeBasis = 'flat';
let currentFlatTimePresetKey = 'flat-0';
let currentGlobeTimePresetKey = 'globe-solar-noon';
let currentGlobeHourOffset = 0;
let currentSceneTimeIso = resolveCurrentTimeIso();
let currentQualityProfile = shaderQualityProfileById('fast');
let sceneReference = createSceneReference();
let config = createAlgorithm32Config(currentMode);
let algorithm32 = new Algorithm32(config);
let shaderHandle = null;
let setupToken = 0;
let requiredObjects = [];
let shaderEnabled = true;
let atmosphereOnlyDiagnosticEnabled = false;
let greenShellDiagnosticEnabled = false;
let performanceEnabled = false;
const performanceSamples = new Map();
let benchmarkSession = null;
let fixedViewport = null;
let performanceUiUpdatePending = false;
let lastLiveRenderAtMs = 0;
let webglContextLost = false;
let disposed = false;
let renderFrameRequest = null;
let delayedSceneRefreshTimer = null;
const cameraPosesByMode = new Map();
const reviewBoxTransformsByMode = new Map();
const starCalibrationLabels = [];
const starCalibrationWorldPosition = new THREE.Vector3();
const starCalibrationScreenPosition = new THREE.Vector3();

scene.background = new THREE.Color(DEFAULT_SCENE_BACKGROUND_COLOR);
renderer.shadowMap.enabled = true;
if (THREE.PCFSoftShadowMap !== undefined) {
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
} else if (THREE.PCFShadowMap !== undefined) {
	renderer.shadowMap.type = THREE.PCFShadowMap;
}
configureControls();
composer.addPass(new RenderPass(scene, camera));
resize();
applyMode(currentMode);
updateBindingValues();
render();

window.addEventListener('resize', resize);
canvas.addEventListener('click', () => controls.lock());
canvas.addEventListener('webglcontextlost', (event) => {
	event.preventDefault();
	webglContextLost = true;
	controls.unlock();
	hideSetupOverlay();
	status.textContent = 'WebGL context lost. Refresh the page before continuing.';
	benchmarkSession = null;
});
canvas.addEventListener('webglcontextrestored', () => {
	status.textContent = 'WebGL context restored. Refresh the page to rebuild Algorithm32 resources cleanly.';
});
modeButton.addEventListener('click', () => {
	clearBenchmarkReport();
	void switchMode(currentMode === 'flat' ? 'globe' : 'flat');
});
locationButton.addEventListener('click', () => {
	clearBenchmarkReport();
	switchLocation(nextLocationPreset().key);
});
timeBasisButton.addEventListener('click', () => {
	clearBenchmarkReport();
	switchTimeBasis(currentTimeBasis === 'flat' ? 'globe' : 'flat');
});
flatTimeControls.addEventListener('click', (event) => {
	const button = event.target.closest?.('button[data-flat-time-key]');

	if (!button) {
		return;
	}

	clearBenchmarkReport();
	switchFlatTimePreset(button.dataset.flatTimeKey);
});
globeTimeControls.addEventListener('click', (event) => {
	const presetButton = event.target.closest?.('button[data-globe-time-key]');
	const hourButton = event.target.closest?.('button[data-hour-offset]');
	const minuteButton = event.target.closest?.('button[data-minute-offset]');

	if (presetButton) {
		clearBenchmarkReport();
		switchGlobeTimePreset(presetButton.dataset.globeTimeKey);
		return;
	}

	if (hourButton) {
		clearBenchmarkReport();
		adjustGlobeHourOffset(Number(hourButton.dataset.hourOffset));
		return;
	}

	if (minuteButton) {
		clearBenchmarkReport();
		adjustGlobeMinuteOffset(Number(minuteButton.dataset.minuteOffset));
	}
});
qualityButton.addEventListener('click', () => {
	clearBenchmarkReport();
	void switchQualityProfile(nextQualityProfile());
});
shaderButton.addEventListener('click', () => {
	clearBenchmarkReport();
	void switchShaderEnabled(!shaderEnabled);
});
atmosphereDiagnosticButton.addEventListener('click', () => {
	clearBenchmarkReport();
	switchAtmosphereOnlyDiagnostic(!atmosphereOnlyDiagnosticEnabled);
});
greenShellDiagnosticButton.addEventListener('click', () => {
	clearBenchmarkReport();
	switchGreenShellDiagnostic(!greenShellDiagnosticEnabled);
});
performanceButton.addEventListener('click', () => {
	clearBenchmarkReport();
	performanceEnabled = !performanceEnabled;
	updatePerformanceUi();
	shaderHandle?.dispose();
	shaderHandle = null;
	if (shaderEnabled) {
		void setupAlgorithm32Shader(currentMode);
	}
});
benchmarkButton.addEventListener('click', () => {
	clearBenchmarkReport();
	void runBenchmark();
});
globalThis.__flat32Cleanup = cleanupFlat32;
window.addEventListener('beforeunload', cleanupFlat32);

function render() {
	if (disposed) {
		return;
	}

	if (!benchmarkSession && !webglContextLost) {
		const now = performance.now();

		if (now - lastLiveRenderAtMs >= LIVE_RENDER_INTERVAL_MS) {
			lastLiveRenderAtMs = now;
			updateBindingValues();
			updateStarCalibrationLabels();
			composer.render();
		}
	}
	renderFrameRequest = requestAnimationFrame(render);
}

function cleanupFlat32() {
	if (disposed) {
		return;
	}

	disposed = true;
	cancelDelayedSceneRefresh();
	if (renderFrameRequest) {
		cancelAnimationFrame(renderFrameRequest);
		renderFrameRequest = null;
	}
	shaderHandle?.dispose();
	shaderHandle = null;
	algorithm32.dispose();
	controls.dispose();
	renderer.dispose();
}

function resize() {
	const width = fixedViewport?.width ?? Math.max(1, root.clientWidth);
	const height = fixedViewport?.height ?? Math.max(1, root.clientHeight);
	const pixelRatio = fixedViewport?.pixelRatio ?? window.devicePixelRatio ?? 1;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(pixelRatio);
	renderer.setSize(width, height, false);
	composer.setPixelRatio?.(pixelRatio);
	composer.setSize(width, height);
}

function viewportPixels() {
	const size = new THREE.Vector2();

	renderer.getDrawingBufferSize(size);

	return [Math.max(1, Math.floor(size.x)), Math.max(1, Math.floor(size.y))];
}

function configureControls() {
	controls.pointerSpeed = 0.7;
	controls.minPolarAngle = 0.05;
	controls.maxPolarAngle = Math.PI - 0.05;
	controls.addEventListener('lock', () => {
		status.textContent = 'Mouse look active. Press Esc to release.';
	});
	controls.addEventListener('unlock', () => {
		status.textContent = 'Click canvas, then move mouse to look around.';
	});
}

function switchMode(mode) {
	if (mode === currentMode) {
		return;
	}

	saveCameraPoseForMode(currentMode);
	currentMode = mode;
	status.textContent = `Switching to ${modeLabel(mode)}...`;
	rebuildAlgorithm32(mode, { preserveCameraPose: false });
}

function switchLocation(locationKey) {
	if (locationKey === currentLocationKey) {
		return;
	}

	currentLocationKey = locationKey;
	currentSceneTimeIso = resolveCurrentTimeIso();
	status.textContent = `Switching to ${currentLocationPreset().label}...`;
	rebuildAlgorithm32(currentMode);
}

function switchTimeBasis(timeBasis) {
	if (timeBasis === currentTimeBasis) {
		return;
	}

	currentTimeBasis = timeBasis;
	currentSceneTimeIso = resolveCurrentTimeIso();
	updateSceneControlLabels();
	scheduleDelayedSceneRefresh(`Queued ${timeBasisLabel()} time refresh for ${shortTimeLabel(currentSceneTimeIso)}...`);
}

function switchFlatTimePreset(timePresetKey) {
	if (timePresetKey === currentFlatTimePresetKey && currentTimeBasis === 'flat') {
		return;
	}

	currentTimeBasis = 'flat';
	currentFlatTimePresetKey = timePresetKey;
	currentSceneTimeIso = resolveCurrentTimeIso();
	updateSceneControlLabels();
	scheduleDelayedSceneRefresh(`Queued flat ${currentFlatTimePreset().label} refresh for ${shortTimeLabel(currentSceneTimeIso)}...`);
}

function switchGlobeTimePreset(timePresetKey) {
	if (timePresetKey === currentGlobeTimePresetKey && currentTimeBasis === 'globe' && currentGlobeHourOffset === 0) {
		return;
	}

	currentTimeBasis = 'globe';
	currentGlobeTimePresetKey = timePresetKey;
	currentGlobeHourOffset = 0;
	currentSceneTimeIso = resolveCurrentTimeIso();
	updateSceneControlLabels();
	scheduleDelayedSceneRefresh(`Queued globe ${currentGlobeTimePreset().label} refresh for ${shortTimeLabel(currentSceneTimeIso)}...`);
}

function adjustGlobeHourOffset(deltaHours) {
	if (!Number.isFinite(deltaHours) || deltaHours === 0) {
		return;
	}

	currentTimeBasis = 'globe';
	currentGlobeHourOffset += deltaHours;
	currentSceneTimeIso = resolveCurrentTimeIso();
	updateSceneControlLabels();
	scheduleDelayedSceneRefresh(`Queued globe hour ${deltaHours > 0 ? '+' : '-'} refresh for ${shortTimeLabel(currentSceneTimeIso)}...`);
}

function adjustGlobeMinuteOffset(deltaMinutes) {
	if (!Number.isFinite(deltaMinutes) || deltaMinutes === 0) {
		return;
	}

	currentTimeBasis = 'globe';
	currentGlobeHourOffset += deltaMinutes / 60;
	currentSceneTimeIso = resolveCurrentTimeIso();
	updateSceneControlLabels();
	scheduleDelayedSceneRefresh(`Queued globe ${Math.abs(deltaMinutes)} minute ${deltaMinutes > 0 ? '+' : '-'} refresh for ${shortTimeLabel(currentSceneTimeIso)}...`);
}

function switchQualityProfile(profile) {
	if (profile.id === currentQualityProfile.id) {
		return;
	}

	currentQualityProfile = profile;
	status.textContent = `Switching to ${profile.label} quality...`;
	rebuildAlgorithm32(currentMode);
}

async function switchShaderEnabled(enabled) {
	if (enabled === shaderEnabled) {
		return;
	}

	shaderEnabled = enabled;
	updateShaderButton();
	if (!shaderEnabled) {
		shaderHandle?.dispose();
		shaderHandle = null;
		performanceEnabled = false;
		updatePerformanceUi();
		hideSetupOverlay();
		status.textContent = 'Algorithm32 shader disabled. Rendering solid Three scene only.';
		return;
	}

	await setupAlgorithm32Shader(currentMode);
}

function switchAtmosphereOnlyDiagnostic(enabled) {
	if (enabled === atmosphereOnlyDiagnosticEnabled) {
		return;
	}

	atmosphereOnlyDiagnosticEnabled = enabled;
	if (enabled) {
		greenShellDiagnosticEnabled = false;
	}
	status.textContent = enabled
		? 'Switching to atmosphere-only diagnostic...'
		: 'Restoring full scene inputs...';
	rebuildAlgorithm32(currentMode);
}

function switchGreenShellDiagnostic(enabled) {
	if (enabled === greenShellDiagnosticEnabled) {
		return;
	}

	greenShellDiagnosticEnabled = enabled;
	if (enabled) {
		atmosphereOnlyDiagnosticEnabled = false;
	}
	status.textContent = enabled
		? 'Switching to green-shell endpoint diagnostic...'
		: 'Restoring normal scene endpoints...';
	rebuildAlgorithm32(currentMode);
}

function usesGreenShellDiagnosticEndpoint() {
	return atmosphereOnlyDiagnosticEnabled || greenShellDiagnosticEnabled;
}

function nextQualityProfile() {
	const index = SHADER_QUALITY_PROFILES.findIndex((profile) => profile.id === currentQualityProfile.id);

	return SHADER_QUALITY_PROFILES[(index + 1) % SHADER_QUALITY_PROFILES.length];
}

function rebuildAlgorithm32(mode, options = {}) {
	cancelDelayedSceneRefresh();
	if (options.preserveCameraPose !== false) {
		saveCameraPoseForMode(mode);
	}
	controls.unlock();
	shaderHandle?.dispose();
	shaderHandle = null;
	algorithm32.dispose();
	sceneReference = createSceneReference();
	config = createAlgorithm32Config(mode);
	algorithm32 = new Algorithm32(config);
	applyMode(mode);
	updateBindingValues();
}

function applyMode(mode) {
	clearRequiredObjects();
	applySceneBackground();
	applyCameraPoseForMode(mode);
	requiredObjects = createRequiredObjects(config, mode);

	for (const object of requiredObjects) {
		scene.add(object);
	}

	modeButton.textContent = mode === 'flat' ? 'Switch to Globe' : 'Switch to Flat';
	modeButton.setAttribute('aria-label', mode === 'flat'
		? 'Switch to spherical Earth mode'
		: 'Switch to flat Earth mode');
	updateSceneControlLabels();
	qualityButton.textContent = `Quality: ${currentQualityProfile.label}`;
	qualityButton.setAttribute('aria-label', `Switch Algorithm32 shader quality profile from ${currentQualityProfile.label}`);
	updateShaderButton();
	updateAtmosphereDiagnosticButton();
	updateGreenShellDiagnosticButton();
	if (shaderEnabled) {
		void setupAlgorithm32Shader(mode);
	} else {
		hideSetupOverlay();
		status.textContent = `Algorithm32 ${modeLabel(mode)} scene ready. Shader is disabled.`;
	}
}

async function setupAlgorithm32Shader(mode) {
	if (disposed || webglContextLost || !shaderEnabled) {
		hideSetupOverlay();
		return false;
	}

	const token = setupToken + 1;

	setupToken = token;
	status.textContent = `Installing Algorithm32 ${modeLabel(mode)} shader...`;
	showSetupOverlay(`Setting up ${modeLabel(mode)} scene...`);
	if (!await waitForSetupOverlayPaint(token)) {
		return false;
	}

	if (performanceEnabled) {
		performanceSamples.clear();
		updatePerformanceUi();
	}

	try {
		const handle = await algorithm32.setupShader({
			THREE,
			composer,
			scene,
			camera,
			viewportPixels: viewportPixels(),
			sceneDepthMaxMeters: config.geometry.resolveSceneDepthMaxMeters({
				camera,
				metersPerSceneUnit: METERS_PER_SCENE_UNIT,
				cameraWorldPositionMeters: cameraPositionMeters(),
				endpointPositionsSceneUnits: sceneDepthEndpointPositionsSceneUnits(mode),
			}),
			metersPerSceneUnit: METERS_PER_SCENE_UNIT,
			distanceMultiplier: METERS_PER_SCENE_UNIT,
			bindingValues,
			logger: console,
			performanceCallback: performanceEnabled || benchmarkSession ? handleShaderPerformance : undefined,
			performanceSampleIntervalFrames: benchmarkSession
				? BENCHMARK_PERFORMANCE_SAMPLE_INTERVAL_FRAMES
				: LIVE_PERFORMANCE_SAMPLE_INTERVAL_FRAMES,
			performanceMaxPendingQueries: benchmarkSession
				? BENCHMARK_PERFORMANCE_MAX_PENDING_QUERIES
				: LIVE_PERFORMANCE_MAX_PENDING_QUERIES,
		});

		if (disposed || token !== setupToken) {
			handle.dispose();
			return false;
		}

		shaderHandle = handle;
		hideSetupOverlay(token);
		status.textContent = `Algorithm32 ${modeLabel(mode)} shader installed. Click canvas, then move mouse to look around.`;
		console.log(`flat32 ${mode} Algorithm32 diagnostics`, handle.getDiagnostics());
		return true;
	} catch (error) {
		if (token === setupToken) {
			hideSetupOverlay(token);
			status.textContent = `Algorithm32 ${modeLabel(mode)} setup failed: ${error.message}`;
		}
		console.error(error);
		return false;
	}
}

async function runBenchmark() {
	if (benchmarkSession || webglContextLost || !shaderEnabled) {
		if (!shaderEnabled) {
			status.textContent = 'Enable the Algorithm32 shader before running a shader benchmark.';
		}
		return;
	}

	const previousPerformanceEnabled = performanceEnabled;
	const previousPanelHidden = performancePanel.hidden;
	const measuredRuns = BENCHMARK_MEASURED_RUNS;
	const warmupRuns = BENCHMARK_WARMUP_RUNS;
	const width = BENCHMARK_WIDTH;
	const height = BENCHMARK_HEIGHT;

	controls.unlock();
	benchmarkSession = createBenchmarkSession({
		mode: currentMode,
		qualityProfile: currentQualityProfile,
		width,
		height,
		measuredRuns,
		warmupRuns,
	});
	benchmarkButton.disabled = true;
	modeButton.disabled = true;
	locationButton.disabled = true;
	setTimeControlsDisabled(true);
	qualityButton.disabled = true;
	performanceButton.disabled = true;
	performanceEnabled = true;
	performanceSamples.clear();
	performancePanel.hidden = false;
	performancePanel.textContent = 'Benchmark setup...';
	benchmarkPanel.hidden = true;
	benchmarkPanel.textContent = '';
	fixedViewport = {
		width,
		height,
		pixelRatio: 1,
	};
	resize();
	shaderHandle?.dispose();
	shaderHandle = null;
	if (!await setupAlgorithm32Shader(currentMode)) {
		benchmarkSession = null;
		benchmarkButton.disabled = false;
		modeButton.disabled = false;
		locationButton.disabled = false;
		setTimeControlsDisabled(false);
		qualityButton.disabled = false;
		performanceButton.disabled = false;
		performanceEnabled = previousPerformanceEnabled;
		fixedViewport = null;
		resize();
		updatePerformanceUi();
		return;
	}

	let benchmarkReportText = null;
	try {
		status.textContent = `Benchmarking ${modeLabel(currentMode)} at ${width}x${height} DPR 1...`;
		benchmarkSession.phase = 'warmup';
		await renderBenchmarkFrames(warmupRuns, false);
		await delay(50);

		benchmarkSession.phase = 'measured';
		await renderBenchmarkFrames(measuredRuns, true);

		benchmarkSession.phase = 'settle';
		await renderBenchmarkFrames(BENCHMARK_SETTLE_RUNS, false);
		const report = createBenchmarkReport(benchmarkSession);

		window.flat32LastBenchmark = report;
		console.log('flat32 Algorithm32 benchmark', report);
		benchmarkReportText = formatBenchmarkReport(report);
		benchmarkPanel.hidden = false;
		benchmarkPanel.textContent = benchmarkReportText;
		status.textContent = `Benchmark complete. Report is available as window.flat32LastBenchmark.`;
	} catch (error) {
		status.textContent = `Benchmark failed: ${error.message}`;
		console.error(error);
	} finally {
		benchmarkSession = null;
		benchmarkButton.disabled = false;
		modeButton.disabled = false;
		locationButton.disabled = false;
		setTimeControlsDisabled(false);
		qualityButton.disabled = false;
		performanceButton.disabled = false;
		performanceEnabled = benchmarkReportText ? false : previousPerformanceEnabled;
		fixedViewport = null;
		resize();
		shaderHandle?.dispose();
		shaderHandle = null;
		await setupAlgorithm32Shader(currentMode);
		if (benchmarkReportText) {
			performancePanel.hidden = true;
			performancePanel.textContent = '';
			benchmarkPanel.hidden = false;
			benchmarkPanel.textContent = benchmarkReportText;
			performanceButton.textContent = 'Perf Off';
			status.textContent = `Benchmark complete. Report is available as window.flat32LastBenchmark.`;
		} else if (!previousPerformanceEnabled) {
			performancePanel.hidden = previousPanelHidden;
			if (previousPanelHidden) {
				performancePanel.textContent = '';
			}
			updatePerformanceUi();
		} else {
			updatePerformanceUi();
		}
	}
}

async function renderBenchmarkFrames(count, measureWallTime) {
	for (let index = 0; index < count; index += 1) {
		if (webglContextLost) {
			throw new Error('WebGL context lost during benchmark.');
		}
		updateBindingValues();
		const startedAt = performance.now();

		composer.render();

		const durationMs = performance.now() - startedAt;

		if (measureWallTime) {
			benchmarkSession.wallFrameDurationsMs.push(durationMs);
		}

		if (index % 5 === 4) {
			await delay(10);
		} else {
			await animationFrame();
		}
	}
}

function createAlgorithm32Config(mode) {
	return mode === 'globe' ? createGlobeAlgorithm32Config() : createFlatAlgorithm32Config();
}

function currentLocationPreset() {
	return LOCATION_PRESETS.find((location) => location.key === currentLocationKey) ?? LOCATION_PRESETS[0];
}

function nextLocationPreset() {
	const index = LOCATION_PRESETS.findIndex((location) => location.key === currentLocationKey);

	return LOCATION_PRESETS[(index + 1) % LOCATION_PRESETS.length];
}

function currentFlatTimePreset() {
	return FLAT_TIME_PRESETS.find((preset) => preset.key === currentFlatTimePresetKey) ?? FLAT_TIME_PRESETS[0];
}

function currentGlobeTimePreset() {
	return GLOBE_TIME_PRESETS.find((preset) => preset.key === currentGlobeTimePresetKey)
		?? GLOBE_TIME_PRESETS.find((preset) => preset.key === 'globe-solar-noon')
		?? GLOBE_TIME_PRESETS[0];
}

function timeBasisLabel() {
	return currentTimeBasis === 'flat' ? 'flat' : 'globe';
}

function resolveCurrentTimeIso() {
	const location = currentLocationPreset();
	const synchronizer = new FlatSynchronizer().calibrateToWorld();

	if (currentTimeBasis === 'flat') {
		return synchronizer.getTimeFromClosest(
			location.dateBasis,
			location,
			currentFlatTimePreset().offsetDegrees ?? 0,
		);
	}

	const baseIso = resolveGlobeTimePresetIso({
		location,
		preset: currentGlobeTimePreset(),
		synchronizer,
	});

	return new Date(new Date(baseIso).getTime() + currentGlobeHourOffset * 60 * 60 * 1000).toISOString();
}

function resolveGlobeTimePresetIso({ location, preset, synchronizer }) {
	const solarNoonIso = synchronizer.getTimeFromClosest(location.dateBasis, location, 0);
	const solarNoon = new Date(solarNoonIso);

	if (preset.kind === 'solar-noon-offset') {
		return new Date(solarNoon.getTime() + (preset.offsetHours ?? 0) * 60 * 60 * 1000).toISOString();
	}

	const position = synchronizer.getPosition(solarNoonIso);
	const latitudeRadians = degreesToRadians(location.latitude);
	const declinationRadians = degreesToRadians(position.latitude);
	const cosHourAngle = -Math.tan(latitudeRadians) * Math.tan(declinationRadians);

	if (cosHourAngle < -1 || cosHourAngle > 1) {
		status.textContent = `${preset.label} is unavailable for ${location.label} on ${calendarDateLabel(location.dateBasis)}. Using solar noon.`;
		return solarNoonIso;
	}

	const hourAngleHours = radiansToDegrees(Math.acos(cosHourAngle)) / 15;
	const offsetHours = preset.kind === 'sunrise' ? -hourAngleHours : hourAngleHours;

	return new Date(solarNoon.getTime() + offsetHours * 60 * 60 * 1000).toISOString();
}

function updateSceneControlLabels() {
	const flatTimeActive = currentTimeBasis === 'flat';

	locationButton.textContent = `Location: ${currentLocationPreset().label}`;
	locationButton.setAttribute('aria-label', `Switch location from ${currentLocationPreset().label}`);
	timeBasisButton.textContent = flatTimeActive ? 'Use Globe Time' : 'Use Flat Time';
	timeBasisButton.setAttribute('aria-label', flatTimeActive
		? 'Switch to globe time controls'
		: 'Switch to flat time controls');
	timeValue.textContent = `${dateTimeLabel(currentSceneTimeIso)} / ${flatTimeActive
		? currentFlatTimePreset().label
		: globeTimeLabel()}`;
	flatTimeControls.hidden = !flatTimeActive;
	globeTimeControls.hidden = flatTimeActive;

	for (const button of flatTimeControls.querySelectorAll('button[data-flat-time-key]')) {
		button.classList.toggle('is-active', flatTimeActive && button.dataset.flatTimeKey === currentFlatTimePresetKey);
	}
	for (const button of globeTimeControls.querySelectorAll('button[data-globe-time-key]')) {
		button.classList.toggle(
			'is-active',
			!flatTimeActive && button.dataset.globeTimeKey === currentGlobeTimePresetKey && currentGlobeHourOffset === 0,
		);
	}
}

function globeTimeLabel() {
	const preset = currentGlobeTimePreset();

	if (currentGlobeHourOffset === 0) {
		return preset.label;
	}

	const sign = currentGlobeHourOffset > 0 ? '+' : '';
	const offsetMinutes = Math.round(currentGlobeHourOffset * 60);
	const absoluteMinutes = Math.abs(offsetMinutes);
	const hours = Math.trunc(absoluteMinutes / 60);
	const minutes = absoluteMinutes % 60;
	const offsetText = [
		hours > 0 ? `${hours}h` : '',
		minutes > 0 ? `${minutes}m` : '',
	].filter(Boolean).join(' ');

	return `${preset.label} ${sign}${offsetText}`;
}

function setTimeControlsDisabled(disabled) {
	timeBasisButton.disabled = disabled;

	for (const button of flatTimeControls.querySelectorAll('button')) {
		button.disabled = disabled;
	}
	for (const button of globeTimeControls.querySelectorAll('button')) {
		button.disabled = disabled;
	}
}

function scheduleDelayedSceneRefresh(message) {
	cancelDelayedSceneRefresh();
	status.textContent = message;
	delayedSceneRefreshTimer = setTimeout(() => {
		delayedSceneRefreshTimer = null;
		rebuildAlgorithm32(currentMode);
	}, DELAYED_SCENE_REFRESH_MS);
}

function cancelDelayedSceneRefresh() {
	if (delayedSceneRefreshTimer !== null) {
		clearTimeout(delayedSceneRefreshTimer);
		delayedSceneRefreshTimer = null;
	}
}

function showSetupOverlay(message) {
	setupOverlay.hidden = false;
	setupOverlay.querySelector('.flat32-setup-message').textContent = message;
}

function hideSetupOverlay(token = setupToken) {
	if (token !== setupToken) {
		return;
	}

	setupOverlay.hidden = true;
}

function createFlatAlgorithm32Config() {
	const controls = currentQualityProfile.numericalControls;
	const cacheZBinsMeters = LOCAL_CACHE_Z_BINS_METERS;
	const cacheRhoBinsMeters = LOCAL_CACHE_RHO_BINS_METERS;

	return {
		lightSource: new LocalSunLightSource({
			sourceKey: 'flat32-local-sun',
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			referenceDistanceMeters: FALSE_SUN_REFERENCE_DISTANCE_METERS,
			referenceSpectralIncidentScale: FALSE_SUN_REFERENCE_SPECTRAL_INCIDENT_SCALE,
			radiusMeters: FALSE_SUN_RADIUS_METERS,
			distanceFalloff: true,
			cacheZBinsMeters,
			cacheRhoBinsMeters,
			cacheDirectionCount: controls.incidentDirectionCount,
		}),
		atmosphere: new CanonicalAtmosphere({
			constants: CANONICAL_ATMOSPHERE_CONSTANTS,
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
		}),
		geometry: new FlatEarthGeometry({
			observerPositionMeters: [0, 0, CAMERA_HEIGHT_SCENE_UNITS * METERS_PER_SCENE_UNIT],
			sourcePositionMeters: sceneReference.sourcePositionMeters,
			topAltitudeMeters: TOP_ALTITUDE_METERS,
			sceneSkyRayLimitMeters: SKY_RAY_LIMIT_METERS,
			observerCenteredDome: {
				apexAltitudeMeters: TOP_ALTITUDE_METERS,
				maxObserverViewRayExtentMeters: SKY_RAY_LIMIT_METERS,
			},
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
			cacheZBinsMeters,
			cacheRhoBinsMeters,
		}),
		color: new BrunetonColorDisplayModel({
			displayConstants: FIGURE1_DISPLAY_CONSTANTS,
		}),
		spectral: CANONICAL_SPECTRAL_BASIS,
		execution: createExecutionConfigForQualityProfile(currentQualityProfile),
		shader: {
			metersPerSceneUnit: METERS_PER_SCENE_UNIT,
		},
	};
}

function createGlobeAlgorithm32Config() {
	const bottomRadiusMeters = CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters;
	const topRadiusMeters = CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters;
	const controls = currentQualityProfile.numericalControls;

	return {
		lightSource: new DistantSunLightSource({
			directionToLight: sceneReference.directionToLightModel,
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			angularRadiusRadians: 0.004675,
			cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
			cacheDirectionCount: controls.incidentDirectionCount,
			cacheAltitudeLookup: currentQualityProfile.cacheOptimization?.altitudeLookup ?? null,
		}),
		atmosphere: new CanonicalAtmosphere({
			constants: CANONICAL_ATMOSPHERE_CONSTANTS,
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
		}),
		geometry: new SphericalEarthGeometry({
			bottomRadiusMeters,
			topRadiusMeters,
			observerHeightMeters: CAMERA_HEIGHT_SCENE_UNITS * METERS_PER_SCENE_UNIT,
			observerUpDirection: [1, 0, 0],
			sceneFrame: {
				kind: 'observer-local',
			},
			sourceDirection: sceneReference.directionToLightModel,
			cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
		}),
		color: new BrunetonColorDisplayModel({
			displayConstants: FIGURE1_DISPLAY_CONSTANTS,
		}),
		spectral: CANONICAL_SPECTRAL_BASIS,
		execution: createExecutionConfigForQualityProfile(currentQualityProfile),
		shader: {
			metersPerSceneUnit: METERS_PER_SCENE_UNIT,
		},
	};
}

function createExecutionConfigForQualityProfile(profile) {
	const controls = profile.numericalControls;

	return {
		pathIntervalCount: controls.pathIntervalCount,
		sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
		incidentDirectionCount: controls.incidentDirectionCount,
		incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
		cachePathIntervalCount: controls.pathIntervalCount,
		pathSampleDistribution: profile.transportOptimization?.pathSampleDistribution ?? null,
	};
}

function createRequiredObjects(algorithm32Config, mode) {
	if (usesGreenShellDiagnosticEndpoint()) {
		return [
			createGreenShellDiagnosticObject(),
		];
	}

	const sourcePositionSceneUnits = sourcePositionSceneUnitsForConfig(algorithm32Config);
	const shadowObjects = reconciliationReviewShadowObjectsForMode(
		mode,
		algorithm32Config.geometry,
		sourcePositionSceneUnits,
		sceneReference.directionToLightScene,
	);
	const globeGroundPatch = mode === 'globe'
		? reconciliationReviewGlobeGroundVisualMeshRequest(
			algorithm32Config.geometry,
			sourcePositionSceneUnits,
			sceneReference.directionToLightScene,
		)
		: null;
	const globeGroundPatchSegments = globeGroundPatch
		? reconciliationReviewGlobeGroundPatchSegments(globeGroundPatch)
		: null;
	const endpoints = algorithm32Config.geometry.createThreeEndpointObjects({
		metersPerSceneUnit: METERS_PER_SCENE_UNIT,
		name: mode === 'flat' ? 'flat32-ground' : 'flat32-globe-ground',
		visualMaterialColor: GROUND_GRASS_COLOR,
		visualMaterialLighting: 'lambert',
		shadow: {
			enabled: true,
			shadowPolicy: 'geometry-ground-receives-source-shadow-map',
		},
		...(mode === 'globe'
			? {
				widthSegments: globeGroundPatchSegments.widthSegments,
				heightSegments: globeGroundPatchSegments.heightSegments,
				groundVisualMesh: globeGroundPatch,
			}
			: {}),
	});
	enableShadowReceiverLayers(endpoints.visualObjects || [], shadowObjects);
	const lighting = mode === 'flat'
		? addSceneLighting(algorithm32Config.lightSource, {
			THREE,
			sourcePositionSceneUnits,
			observerScenePositionUnits: [0, CAMERA_HEIGHT_SCENE_UNITS, 0],
			sourceRelativePosition: algorithm32Config.geometry.resolveSourceRelativePosition({
				position: [0, 0, CAMERA_HEIGHT_SCENE_UNITS * METERS_PER_SCENE_UNIT],
			}),
			calibrationScalar: endpointSceneFlatLocalCalibrationScalar(),
			ambientIntensityRange: ENDPOINT_SCENE_AMBIENT_INTENSITY_RANGE,
			endpointColorStatus: 'flat32-bare-endpoint-scene',
			endpointSceneLightScalePolicy: 'observer-incident-scale',
			shadow: {
				enabled: true,
				objects: shadowObjects,
			},
		})
		: addSceneLighting(algorithm32Config.lightSource, {
			THREE,
			directionToLightScene: sceneReference.directionToLightScene,
			focusSceneUnits: camera.position.toArray(),
			lightDistanceSceneUnits: 100,
			intensity: endpointSceneDirectionalIntensity(),
			ambientIntensityRange: ENDPOINT_SCENE_AMBIENT_INTENSITY_RANGE,
			shadow: {
				enabled: true,
				objects: shadowObjects,
			},
		});

	return [
		...(endpoints.visualObjects || []),
		...(endpoints.raycastObjects || []),
		...(lighting.lights || []),
		...(lighting.sceneObjects || []),
		...createReconciliationReviewBoxObjects(algorithm32Config, mode),
		...createSyntheticStarAnalogObjects(),
		...createStarCalibrationObjects(),
	];
}

function addSceneLighting(lightSource, request) {
	if (typeof lightSource.addSceneLighting === 'function') {
		return lightSource.addSceneLighting(request);
	}

	throw new TypeError('Algorithm32 lightSource must expose addSceneLighting(...).');
}

function endpointSceneFlatLocalCalibrationScalar() {
	return ENDPOINT_SCENE_DIRECTIONAL_LIGHT_INTENSITY / FALSE_SUN_REFERENCE_SPECTRAL_INCIDENT_SCALE;
}

function endpointSceneDirectionalIntensity() {
	return ENDPOINT_SCENE_DIRECTIONAL_LIGHT_INTENSITY * endpointSceneDirectLightPercent();
}

function endpointSceneDirectLightPercent() {
	const lightPercent = config.lightSource.resolveSceneLightPercent?.({
		directionToLightScene: sceneReference.directionToLightScene,
		localUpScene: [0, 1, 0],
	});

	return lightPercent?.directLightPercent ?? clamp01(sceneReference.directionToLightObserverLocal[0]);
}

function clamp01(value) {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function sourcePositionSceneUnitsForConfig(algorithm32Config) {
	if (typeof algorithm32Config.geometry.mapModelPositionToObserverLocalScenePoint !== 'function') {
		return modelPositionMetersToScenePoint(sceneReference.sourcePositionMeters);
	}

	return algorithm32Config.geometry.mapModelPositionToObserverLocalScenePoint(sceneReference.sourcePositionMeters, {
		metersPerSceneUnit: METERS_PER_SCENE_UNIT,
	});
}

function createReconciliationReviewBoxObjects(algorithm32Config, mode) {
	return activeReconciliationReviewBoxes().map((boxConfig, index) => {
		const transform = reconciliationReviewBoxTransformSceneUnits(mode, boxConfig, index);
		const geometry = new THREE.BoxGeometry(
			boxConfig.sizeSceneUnits[0],
			boxConfig.sizeSceneUnits[1],
			boxConfig.sizeSceneUnits[2],
		);
		const material = new THREE.MeshLambertMaterial({
			color: boxConfig.color,
		});
		const box = new THREE.Mesh(geometry, material);

		box.name = boxConfig.name;
		box.userData.algorithm32SceneInput = true;
		box.userData.endpointKind = boxConfig.kind;
		box.userData.metersPerSceneUnit = METERS_PER_SCENE_UNIT;
		box.userData.shadowObjectKey = boxConfig.name;
		box.userData.shadowFrame = boxConfig.shadowFrame;
		algorithm32Config.lightSource.configureThreeShadowObject?.(box, {
			layerIndex: layerIndexForReviewBox(index),
		});

		box.position.set(transform.position[0], transform.position[1], transform.position[2]);
		box.rotation.y = transform.rotationYRadians;

		return box;
	});
}

function createGreenShellDiagnosticObject() {
	const geometry = new THREE.SphereGeometry(
		GREEN_SHELL_RADIUS_SCENE_UNITS,
		GREEN_SHELL_WIDTH_SEGMENTS,
		GREEN_SHELL_HEIGHT_SEGMENTS,
		0,
		Math.PI * 2,
		0,
		GREEN_SHELL_THETA_LENGTH_RADIANS,
	);
	geometry.scale(-1, 1, 1);
	const material = new THREE.MeshBasicMaterial({
		color: GREEN_SHELL_DIAGNOSTIC_COLOR,
		toneMapped: false,
	});
	const shell = new THREE.Mesh(geometry, material);

	shell.name = 'flat32-green-shell-diagnostic-endpoint';
	shell.frustumCulled = false;
	shell.userData.algorithm32SceneInput = true;
	shell.userData.endpointKind = 'diagnostic-green-sky-shell';
	shell.userData.sceneRgb = [0, 1, 0];
	shell.userData.metersPerSceneUnit = METERS_PER_SCENE_UNIT;
	shell.position.copy(camera.position);

	return shell;
}

function createSyntheticStarAnalogObjects() {
	return createSyntheticStarAnalogSpecs().map((starConfig) => {
		const geometry = new THREE.SphereGeometry(
			starConfig.radiusSceneUnits,
			8,
			6,
		);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(
				starConfig.sceneRgb,
				starConfig.sceneRgb,
				starConfig.sceneRgb,
			),
			toneMapped: false,
		});
		const star = new THREE.Mesh(geometry, material);

		star.name = starConfig.name;
		star.userData.algorithm32SceneInput = true;
		star.userData.endpointKind = 'synthetic-star-analog';
		star.userData.magnitude = starConfig.magnitude;
		star.userData.brightness = starConfig.brightness;
		star.userData.sceneRgb = starConfig.sceneRgb;
		star.userData.metersPerSceneUnit = METERS_PER_SCENE_UNIT;
		star.castShadow = false;
		star.receiveShadow = false;
		star.position.set(
			starConfig.positionSceneUnits[0],
			starConfig.positionSceneUnits[1],
			starConfig.positionSceneUnits[2],
		);

		return star;
	});
}

function createStarCalibrationObjects() {
	return createStarCalibrationSpecs().map((starConfig) => {
		const geometry = new THREE.SphereGeometry(
			starConfig.radiusSceneUnits,
			10,
			8,
		);
		const material = new THREE.MeshBasicMaterial({
			color: new THREE.Color(
				starConfig.sceneRgb,
				starConfig.sceneRgb,
				starConfig.sceneRgb,
			),
			toneMapped: false,
		});
		const star = new THREE.Mesh(geometry, material);

		star.name = `flat32-star-calibration-${starConfig.label}`;
		star.userData.algorithm32SceneInput = true;
		star.userData.endpointKind = 'synthetic-star-calibration';
		star.userData.label = starConfig.label;
		star.userData.sceneRgb = starConfig.sceneRgb;
		star.userData.metersPerSceneUnit = METERS_PER_SCENE_UNIT;
		star.castShadow = false;
		star.receiveShadow = false;
		star.position.set(
			starConfig.positionSceneUnits[0],
			starConfig.positionSceneUnits[1],
			starConfig.positionSceneUnits[2],
		);
		createStarCalibrationLabel(star, starConfig.label);

		return star;
	});
}

function createSyntheticStarAnalogSpecs() {
	return Array.from({ length: STAR_ANALOG_COUNT }, (_, index) => {
		const magnitudeIndex = (index * STAR_ANALOG_MAGNITUDE_PERMUTATION_STEP) % STAR_ANALOG_COUNT;
		const magnitude = starAnalogMagnitudeAt(magnitudeIndex, STAR_ANALOG_COUNT);
		const style = starAnalogStyleFromMagnitude(magnitude);
		const direction = starAnalogDirection(index, STAR_ANALOG_COUNT);
		const distanceSceneUnits = starAnalogDistanceSceneUnits(direction);
		const positionSceneUnits = starAnalogScenePosition(direction, distanceSceneUnits);

		return Object.freeze({
			name: `flat32-synthetic-star-analog-${String(index + 1).padStart(3, '0')}`,
			positionSceneUnits,
			magnitude,
			brightness: style.brightness,
			sceneRgb: style.brightness,
			radiusSceneUnits: starAnalogRadiusSceneUnits(style, distanceSceneUnits),
		});
	});
}

function starAnalogEndpointPositionsSceneUnits() {
	return createSyntheticStarAnalogSpecs().map((starConfig) => starConfig.positionSceneUnits);
}

function starCalibrationEndpointPositionsSceneUnits() {
	return createStarCalibrationSpecs().map((starConfig) => starConfig.positionSceneUnits);
}

function createStarCalibrationSpecs() {
	const antiSolarHorizontal = antiSolarHorizontalDirectionScene();
	const centerOffset = (STAR_CALIBRATION_LEVELS.length - 1) / 2;

	return STAR_CALIBRATION_LEVELS.map((level, index) => {
		const direction = starCalibrationDirection(
			antiSolarHorizontal,
			(index - centerOffset) * STAR_CALIBRATION_AZIMUTH_SPACING_RADIANS,
		);
		const distanceSceneUnits = starAnalogDistanceSceneUnits(direction);
		const positionSceneUnits = starAnalogScenePosition(direction, distanceSceneUnits);

		return Object.freeze({
			label: level.label,
			sceneRgb: level.sceneRgb,
			positionSceneUnits,
			radiusSceneUnits: distanceSceneUnits * STAR_CALIBRATION_RADIUS_DISTANCE_RATIO,
		});
	});
}

function starAnalogMagnitudeAt(index, count) {
	if (count <= 1) {
		return STAR_ANALOG_MAGNITUDE_RANGE.min;
	}

	return STAR_ANALOG_MAGNITUDE_RANGE.min
		+ (STAR_ANALOG_MAGNITUDE_RANGE.max - STAR_ANALOG_MAGNITUDE_RANGE.min)
			* (index / (count - 1));
}

function starAnalogStyleFromMagnitude(magnitude) {
	const relativeFlux = 10 ** (-0.4 * (magnitude - STAR_ANALOG_REFERENCE_MAGNITUDE));
	const brightness = STAR_ANALOG_REFERENCE_SCENE_RGB * relativeFlux;
	const displaySize = clamp(3.5 - magnitude * 0.35, 0.75, 5);

	return Object.freeze({
		size: displaySize,
		brightness,
	});
}

function starAnalogDirection(index, count) {
	const fraction = (index + 0.5) / count;
	const y = STAR_ANALOG_MIN_ALTITUDE_SINE
		+ (STAR_ANALOG_MAX_ALTITUDE_SINE - STAR_ANALOG_MIN_ALTITUDE_SINE) * fraction;
	const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
	const angle = index * STAR_ANALOG_GOLDEN_ANGLE_RADIANS;

	return Object.freeze([
		Math.cos(angle) * horizontal,
		y,
		Math.sin(angle) * horizontal,
	]);
}

function starCalibrationDirection(horizontalDirection, azimuthOffsetRadians) {
	const cosOffset = Math.cos(azimuthOffsetRadians);
	const sinOffset = Math.sin(azimuthOffsetRadians);
	const horizontal = Math.sqrt(Math.max(0, 1 - STAR_CALIBRATION_ALTITUDE_SINE ** 2));
	const x = horizontalDirection[0] * cosOffset + horizontalDirection[1] * sinOffset;
	const z = horizontalDirection[1] * cosOffset - horizontalDirection[0] * sinOffset;

	return Object.freeze([
		x * horizontal,
		STAR_CALIBRATION_ALTITUDE_SINE,
		z * horizontal,
	]);
}

function antiSolarHorizontalDirectionScene() {
	const x = -sceneReference.directionToLightScene[0];
	const z = -sceneReference.directionToLightScene[2];
	const length = Math.hypot(x, z);

	if (length > Number.EPSILON) {
		return Object.freeze([x / length, z / length]);
	}

	const forward = cameraHorizontalForwardSceneUnits();

	return Object.freeze([-forward[0], -forward[1]]);
}

function starAnalogDistanceSceneUnits(direction) {
	const topAltitudeSceneUnits = TOP_ALTITUDE_METERS / METERS_PER_SCENE_UNIT;
	const verticalDistanceToTop = Math.max(0, topAltitudeSceneUnits - camera.position.y);
	const distanceToTop = verticalDistanceToTop / Math.max(STAR_ANALOG_MIN_ALTITUDE_SINE, direction[1]);

	return Math.min(
		STAR_ANALOG_MAX_DISTANCE_SCENE_UNITS,
		distanceToTop + STAR_ANALOG_TOP_CLEARANCE_SCENE_UNITS,
	);
}

function starAnalogRadiusSceneUnits(style, distanceSceneUnits) {
	return distanceSceneUnits * (
		STAR_ANALOG_RADIUS_BASE_DISTANCE_RATIO
		+ style.size * STAR_ANALOG_RADIUS_PER_STYLE_PIXEL_DISTANCE_RATIO
	);
}

function starAnalogScenePosition(direction, distanceSceneUnits) {
	return Object.freeze([
		camera.position.x + direction[0] * distanceSceneUnits,
		camera.position.y + direction[1] * distanceSceneUnits,
		camera.position.z + direction[2] * distanceSceneUnits,
	]);
}

function starMagnitudeRange(stars) {
	const magnitudes = stars
		.map((star) => star.magnitude)
		.filter(Number.isFinite);

	if (magnitudes.length === 0) {
		return Object.freeze({ min: -1.46, max: 5.09 });
	}

	return Object.freeze({
		min: Math.min(...magnitudes),
		max: Math.max(...magnitudes),
	});
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function reconciliationReviewBoxTransformSceneUnits(mode, boxConfig, index) {
	const transform = reviewBoxTransformsForMode(mode)[index];

	if (transform?.name === boxConfig.name) {
		return transform;
	}

	return createInitialReviewBoxTransform(mode, boxConfig);
}

function reviewBoxTransformsForMode(mode) {
	if (!reviewBoxTransformsByMode.has(mode)) {
		reviewBoxTransformsByMode.set(
			mode,
			Object.freeze(activeReconciliationReviewBoxes().map((boxConfig) =>
				createInitialReviewBoxTransform(mode, boxConfig))),
		);
	}

	return reviewBoxTransformsByMode.get(mode);
}

function createInitialReviewBoxTransform(mode, boxConfig) {
	const center = reconciliationReviewBoxCenterSceneUnits(mode, boxConfig);
	const rotationYRadians = cameraAlignedReviewYawRadians()
		+ THREE.MathUtils.degToRad(boxConfig.rotationYDegrees);

	return Object.freeze({
		name: boxConfig.name,
		position: Object.freeze([center[0], center[1], center[2]]),
		rotationYRadians,
	});
}

function sceneDepthEndpointPositionsSceneUnits(mode) {
	if (usesGreenShellDiagnosticEndpoint()) {
		return greenShellEndpointPositionsSceneUnits();
	}

	return Object.freeze([
		...reconciliationReviewBoxEndpointPositionsSceneUnits(mode),
		...starAnalogEndpointPositionsSceneUnits(),
		...starCalibrationEndpointPositionsSceneUnits(),
	]);
}

function greenShellEndpointPositionsSceneUnits() {
	const radius = GREEN_SHELL_RADIUS_SCENE_UNITS;

	return Object.freeze([
		Object.freeze([camera.position.x, camera.position.y + radius, camera.position.z]),
		Object.freeze([camera.position.x, camera.position.y - radius, camera.position.z]),
		Object.freeze([camera.position.x + radius, camera.position.y, camera.position.z]),
		Object.freeze([camera.position.x - radius, camera.position.y, camera.position.z]),
		Object.freeze([camera.position.x, camera.position.y, camera.position.z + radius]),
		Object.freeze([camera.position.x, camera.position.y, camera.position.z - radius]),
	]);
}

function reconciliationReviewBoxEndpointPositionsSceneUnits(mode) {
	return activeReconciliationReviewBoxes().flatMap((boxConfig, index) =>
		reconciliationReviewBoxCornersSceneUnits(mode, boxConfig, index));
}

function reconciliationReviewBoxCornersSceneUnits(mode, boxConfig, index) {
	const transform = reconciliationReviewBoxTransformSceneUnits(mode, boxConfig, index);
	const halfSizes = boxConfig.sizeSceneUnits.map((size) => size / 2);
	const rotationRadians = transform.rotationYRadians;
	const cosRotation = Math.cos(rotationRadians);
	const sinRotation = Math.sin(rotationRadians);
	const corners = [];

	for (const xSign of [-1, 1]) {
		for (const ySign of [-1, 1]) {
			for (const zSign of [-1, 1]) {
				const xOffset = xSign * halfSizes[0];
				const zOffset = zSign * halfSizes[2];
				const yOffset = ySign * halfSizes[1];

				corners.push([
					transform.position[0] + xOffset * cosRotation + zOffset * sinRotation,
					transform.position[1] + yOffset,
					transform.position[2] - xOffset * sinRotation + zOffset * cosRotation,
				]);
			}
		}
	}

	return corners;
}

function reconciliationReviewBoxCenterSceneUnits(mode, boxConfig) {
	const offset = cameraAlignedReviewOffsetSceneUnits(boxConfig.centerXZ);
	const heightAboveGroundSceneUnits = boxConfig.sizeSceneUnits[1]
		* (0.5 - RECONCILIATION_REVIEW_BOX_SURFACE_PENETRATION_RATIO);

	return groundOffsetToScenePoint(mode, offset, heightAboveGroundSceneUnits);
}

function cameraAlignedReviewOffsetSceneUnits(centerXZ) {
	const localRight = centerXZ[0];
	const localForward = -centerXZ[1];
	const forward = cameraHorizontalForwardSceneUnits();
	const right = [forward[1] * -1, forward[0]];

	return Object.freeze([
		right[0] * localRight + forward[0] * localForward,
		right[1] * localRight + forward[1] * localForward,
	]);
}

function cameraAlignedReviewYawRadians() {
	const forward = cameraHorizontalForwardSceneUnits();

	return Math.atan2(-forward[0], -forward[1]);
}

function cameraHorizontalForwardSceneUnits() {
	const x = sceneReference.cameraLookDirectionScene[0];
	const z = sceneReference.cameraLookDirectionScene[2];
	const length = Math.hypot(x, z);

	if (length <= Number.EPSILON) {
		return Object.freeze([0, -1]);
	}

	return Object.freeze([x / length, z / length]);
}

function reconciliationReviewShadowObjectsForMode(mode, geometry, sourcePositionSceneUnits, directionToSourceScene) {
	return Object.freeze(activeReconciliationReviewBoxes().map((boxConfig, index) => {
		const corners = reconciliationReviewBoxCornersSceneUnits(mode, boxConfig, index);
		const receiverPoints = reconciliationReviewShadowReceiverPointsSceneUnits(
			mode,
			geometry,
			corners,
			sourcePositionSceneUnits,
			directionToSourceScene,
			boxConfig,
		);
		const shadowFramePoints = [...corners, ...receiverPoints];
		const bounds = scenePointBounds(shadowFramePoints);
		const focusSceneUnits = scenePointBoundsCenter(bounds);
		const shadowDirectionToSourceScene = mode === 'flat'
			? sceneDirectionBetweenPoints(focusSceneUnits, sourcePositionSceneUnits)
			: normalizeSceneVector(directionToSourceScene, 'globe shadow source direction');
		const margin = reconciliationReviewShadowMarginSceneUnits(boxConfig);
		const cameraMetrics = shadowCameraMetricsForPoints(
			shadowFramePoints,
			focusSceneUnits,
			shadowDirectionToSourceScene,
			margin,
		);
		const lightDistanceSceneUnits = Math.max(
			cameraMetrics.extentSceneUnits * 2,
			cameraMetrics.maxSourceDepthSceneUnits + margin + RECONCILIATION_REVIEW_SHADOW_LIGHT_DISTANCE_MIN,
		);
		const depthPadding = Math.max(margin, RECONCILIATION_REVIEW_SHADOW_DEPTH_PADDING_MIN);
		const cameraNear = RECONCILIATION_REVIEW_SHADOW_CAMERA_NEAR;
		const cameraFar = Math.max(
			cameraNear + 0.001,
			lightDistanceSceneUnits - cameraMetrics.minSourceDepthSceneUnits + depthPadding,
		);

		return Object.freeze({
			...RECONCILIATION_REVIEW_SHADOW_FRAME,
			objectKey: boxConfig.name,
			shadowFrame: boxConfig.shadowFrame,
			layerIndex: layerIndexForReviewBox(index),
			focusSceneUnits,
			extentSceneUnits: cameraMetrics.extentSceneUnits,
			lightDistanceSceneUnits,
			cameraLeft: cameraMetrics.cameraLeft,
			cameraRight: cameraMetrics.cameraRight,
			cameraTop: cameraMetrics.cameraTop,
			cameraBottom: cameraMetrics.cameraBottom,
			cameraNear,
			cameraFar,
		});
	}));
}

function reconciliationReviewShadowReceiverPointsSceneUnits(
	mode,
	geometry,
	corners,
	sourcePositionSceneUnits,
	directionToSourceScene,
	boxConfig,
) {
	if (typeof geometry?.projectScenePointToGroundAlongDirection !== 'function') {
		throw new Error('flat32 review shadows require geometry-owned ground projection.');
	}

	const request = reconciliationReviewShadowProjectionRequest(boxConfig);

	if (mode === 'flat') {
		return corners.map((point) =>
			geometry.projectScenePointToGroundAlongDirection(
				point,
				sceneDirectionBetweenPoints(sourcePositionSceneUnits, point),
				request,
			));
	}

	const shadowRayDirection = normalizeSceneVector([
		-directionToSourceScene[0],
		-directionToSourceScene[1],
		-directionToSourceScene[2],
	], 'globe shadow ray direction');

	return corners.map((point) =>
		geometry.projectScenePointToGroundAlongDirection(
			point,
			shadowRayDirection,
			request,
		));
}

function reconciliationReviewGlobeGroundVisualMeshRequest(geometry, sourcePositionSceneUnits, directionToSourceScene) {
	const points = activeReconciliationReviewBoxes().flatMap((boxConfig, index) => {
		const corners = reconciliationReviewBoxCornersSceneUnits('globe', boxConfig, index);
		const receiverPoints = reconciliationReviewShadowReceiverPointsSceneUnits(
			'globe',
			geometry,
			corners,
			sourcePositionSceneUnits,
			directionToSourceScene,
			boxConfig,
		);

		return [...corners, ...receiverPoints];
	});

	if (points.length === 0) {
		return Object.freeze({
			kind: 'local-spherical-patch',
		});
	}

	const bounds = scenePointBounds(points);
	const padding = RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_PADDING_SCENE_UNITS;
	const xExtentSceneUnits = Math.max(
		RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_X_EXTENT_SCENE_UNITS,
		Math.abs(bounds.minX) + padding,
		Math.abs(bounds.maxX) + padding,
	);
	const zMinSceneUnits = Math.min(
		-RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_Z_EXTENT_SCENE_UNITS,
		bounds.minZ - padding,
	);
	const zMaxSceneUnits = Math.max(
		RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_Z_EXTENT_SCENE_UNITS,
		bounds.maxZ + padding,
	);

	return Object.freeze({
		kind: 'local-spherical-patch',
		xExtentSceneUnits,
		zMinSceneUnits,
		zMaxSceneUnits,
	});
}

function reconciliationReviewGlobeGroundPatchSegments(groundVisualMesh) {
	const targetSpacing = RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_TARGET_SPACING_SCENE_UNITS;
	const xExtentSceneUnits = Number.isFinite(groundVisualMesh.xExtentSceneUnits)
		? groundVisualMesh.xExtentSceneUnits
		: RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_X_EXTENT_SCENE_UNITS;
	const zMinSceneUnits = Number.isFinite(groundVisualMesh.zMinSceneUnits)
		? groundVisualMesh.zMinSceneUnits
		: -RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_Z_EXTENT_SCENE_UNITS;
	const zMaxSceneUnits = Number.isFinite(groundVisualMesh.zMaxSceneUnits)
		? groundVisualMesh.zMaxSceneUnits
		: RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_Z_EXTENT_SCENE_UNITS;
	const widthSceneUnits = Math.max(0, xExtentSceneUnits * 2);
	const heightSceneUnits = Math.max(0, zMaxSceneUnits - zMinSceneUnits);

	return Object.freeze({
		widthSegments: reconciliationReviewGlobeGroundPatchSegmentCount(
			widthSceneUnits,
			RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_WIDTH_SEGMENTS,
			targetSpacing,
		),
		heightSegments: reconciliationReviewGlobeGroundPatchSegmentCount(
			heightSceneUnits,
			RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MIN_HEIGHT_SEGMENTS,
			targetSpacing,
		),
	});
}

function reconciliationReviewGlobeGroundPatchSegmentCount(sizeSceneUnits, minimum, targetSpacing) {
	const targetCount = Math.ceil(sizeSceneUnits / targetSpacing);

	return Math.min(
		RECONCILIATION_REVIEW_GLOBE_GROUND_PATCH_MAX_SEGMENTS,
		Math.max(minimum, targetCount),
	);
}

function reconciliationReviewShadowMarginSceneUnits(boxConfig) {
	const minMargin = RECONCILIATION_REVIEW_SHADOW_OBJECT_MIN_MARGINS[boxConfig.shadowFrame] ?? 0.05;
	const sizeMargin = Math.max(...boxConfig.sizeSceneUnits) * RECONCILIATION_REVIEW_SHADOW_OBJECT_SIZE_MARGIN_RATIO;

	return Math.max(minMargin, sizeMargin);
}

function reconciliationReviewShadowProjectionRequest(boxConfig) {
	const maxSizeSceneUnits = Math.max(...boxConfig.sizeSceneUnits);

	return Object.freeze({
		metersPerSceneUnit: METERS_PER_SCENE_UNIT,
		surfaceToleranceSceneUnits: RECONCILIATION_REVIEW_SHADOW_LOCAL_SURFACE_TOLERANCE_SCENE_UNITS,
		maxLocalDistanceSceneUnits: Math.max(
			RECONCILIATION_REVIEW_SHADOW_LOCAL_PROJECTION_MIN_DISTANCE_SCENE_UNITS,
			maxSizeSceneUnits * RECONCILIATION_REVIEW_SHADOW_LOCAL_PROJECTION_SIZE_RATIO,
		),
		localNormalDotMin: RECONCILIATION_REVIEW_SHADOW_LOCAL_NORMAL_DOT_MIN,
	});
}

function shadowCameraMetricsForPoints(points, focus, directionToSourceScene, margin) {
	const basis = shadowCameraBasis(directionToSourceScene);
	const bounds = {
		minX: Infinity,
		maxX: -Infinity,
		minY: Infinity,
		maxY: -Infinity,
		minZ: Infinity,
		maxZ: -Infinity,
	};

	for (const point of points) {
		const offset = [
			point[0] - focus[0],
			point[1] - focus[1],
			point[2] - focus[2],
		];
		const x = sceneVectorDot(offset, basis.xAxis);
		const y = sceneVectorDot(offset, basis.yAxis);
		const z = sceneVectorDot(offset, basis.zAxis);

		bounds.minX = Math.min(bounds.minX, x);
		bounds.maxX = Math.max(bounds.maxX, x);
		bounds.minY = Math.min(bounds.minY, y);
		bounds.maxY = Math.max(bounds.maxY, y);
		bounds.minZ = Math.min(bounds.minZ, z);
		bounds.maxZ = Math.max(bounds.maxZ, z);
	}

	const cameraLeft = bounds.minX - margin;
	const cameraRight = bounds.maxX + margin;
	const cameraBottom = bounds.minY - margin;
	const cameraTop = bounds.maxY + margin;
	const extentSceneUnits = Math.max(
		0.001,
		Math.abs(cameraLeft),
		Math.abs(cameraRight),
		Math.abs(cameraBottom),
		Math.abs(cameraTop),
	);

	return Object.freeze({
		cameraLeft,
		cameraRight,
		cameraTop,
		cameraBottom,
		extentSceneUnits,
		minSourceDepthSceneUnits: bounds.minZ,
		maxSourceDepthSceneUnits: bounds.maxZ,
	});
}

function shadowCameraBasis(directionToSourceScene) {
	const zAxis = normalizeSceneVector(directionToSourceScene, 'shadow camera source direction');
	const up = Math.abs(sceneVectorDot([0, 1, 0], zAxis)) > 0.999
		? [1, 0, 0]
		: [0, 1, 0];
	const xAxis = normalizeSceneVector(sceneVectorCross(up, zAxis), 'shadow camera x axis');
	const yAxis = normalizeSceneVector(sceneVectorCross(zAxis, xAxis), 'shadow camera y axis');

	return Object.freeze({ xAxis, yAxis, zAxis });
}

function activeReconciliationReviewBoxes() {
	return RECONCILIATION_REVIEW_BOXES;
}

function scenePointBounds(points) {
	const bounds = {
		minX: Infinity,
		maxX: -Infinity,
		minY: Infinity,
		maxY: -Infinity,
		minZ: Infinity,
		maxZ: -Infinity,
	};

	for (const point of points) {
		bounds.minX = Math.min(bounds.minX, point[0]);
		bounds.maxX = Math.max(bounds.maxX, point[0]);
		bounds.minY = Math.min(bounds.minY, point[1]);
		bounds.maxY = Math.max(bounds.maxY, point[1]);
		bounds.minZ = Math.min(bounds.minZ, point[2]);
		bounds.maxZ = Math.max(bounds.maxZ, point[2]);
	}

	return bounds;
}

function scenePointBoundsCenter(bounds) {
	return Object.freeze([
		(bounds.minX + bounds.maxX) / 2,
		(bounds.minY + bounds.maxY) / 2,
		(bounds.minZ + bounds.maxZ) / 2,
	]);
}

function sceneDirectionBetweenPoints(from, to) {
	return normalizeSceneVector([
		to[0] - from[0],
		to[1] - from[1],
		to[2] - from[2],
	], 'scene point direction');
}

function normalizeSceneVector(vector, label) {
	const length = Math.hypot(vector[0], vector[1], vector[2]);

	if (length <= Number.EPSILON) {
		throw new Error(`${label} must be non-zero.`);
	}

	return Object.freeze([
		vector[0] / length,
		vector[1] / length,
		vector[2] / length,
	]);
}

function sceneVectorDot(left, right) {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function sceneVectorCross(left, right) {
	return Object.freeze([
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0],
	]);
}

function enableShadowReceiverLayers(objects, shadowObjects) {
	for (const object of objects) {
		for (const shadowObject of shadowObjects) {
			if (Number.isInteger(shadowObject.layerIndex) && object.layers?.enable) {
				object.layers.enable(shadowObject.layerIndex);
			}
		}
	}
}

function layerIndexForReviewBox(index) {
	return index + 1;
}

function groundOffsetToScenePoint(mode, offsetSceneUnits, heightAboveGroundSceneUnits) {
	if (typeof config.geometry?.mapGroundOffsetToScenePoint === 'function') {
		return config.geometry.mapGroundOffsetToScenePoint(offsetSceneUnits, {
			metersPerSceneUnit: METERS_PER_SCENE_UNIT,
			heightAboveGroundSceneUnits,
		});
	}

	if (mode === 'globe') {
		throw new Error('flat32 globe mode requires geometry-owned ground scene mapping.');
	}

	return Object.freeze([
		offsetSceneUnits[0],
		heightAboveGroundSceneUnits,
		offsetSceneUnits[1],
	]);
}

function clearRequiredObjects() {
	clearStarCalibrationLabels();
	for (const object of requiredObjects) {
		scene.remove(object);
		object.geometry?.dispose?.();
		object.material?.dispose?.();
	}

	requiredObjects = [];
}

function createStarCalibrationLabel(object, label) {
	const element = document.createElement('div');

	element.className = 'flat32-star-calibration-label';
	element.textContent = label;
	starCalibrationLabelLayer.append(element);
	starCalibrationLabels.push({ object, element });
}

function clearStarCalibrationLabels() {
	for (const entry of starCalibrationLabels) {
		entry.element.remove();
	}

	starCalibrationLabels.length = 0;
}

function updateStarCalibrationLabels() {
	if (starCalibrationLabels.length === 0) {
		return;
	}

	const width = Math.max(1, canvas.clientWidth);
	const height = Math.max(1, canvas.clientHeight);

	camera.updateMatrixWorld();
	for (const entry of starCalibrationLabels) {
		entry.object.getWorldPosition(starCalibrationWorldPosition);
		starCalibrationScreenPosition.copy(starCalibrationWorldPosition).project(camera);

		const visible = Number.isFinite(starCalibrationScreenPosition.x)
			&& Number.isFinite(starCalibrationScreenPosition.y)
			&& Number.isFinite(starCalibrationScreenPosition.z)
			&& starCalibrationScreenPosition.z >= -1
			&& starCalibrationScreenPosition.z <= 1
			&& Math.abs(starCalibrationScreenPosition.x) <= 1
			&& Math.abs(starCalibrationScreenPosition.y) <= 1;

		entry.element.hidden = !visible;
		if (!visible) {
			continue;
		}

		entry.element.style.left = `${(starCalibrationScreenPosition.x * 0.5 + 0.5) * width}px`;
		entry.element.style.top = `${(-starCalibrationScreenPosition.y * 0.5 + 0.5) * height}px`;
	}
}

function placeCameraForMode() {
	camera.position.set(0, CAMERA_HEIGHT_SCENE_UNITS, 0);
}

function orientCameraTowardReferenceSun() {
	camera.lookAt(
		camera.position.x + sceneReference.cameraLookDirectionScene[0],
		camera.position.y + sceneReference.cameraLookDirectionScene[1],
		camera.position.z + sceneReference.cameraLookDirectionScene[2],
	);
}

function applyCameraPoseForMode(mode) {
	const pose = cameraPosesByMode.get(mode);

	if (pose) {
		camera.position.copy(pose.position);
		camera.quaternion.copy(pose.quaternion);
		camera.updateMatrixWorld();
		return;
	}

	placeCameraForMode();
	orientCameraTowardReferenceSun();
	saveCameraPoseForMode(mode);
}

function saveCameraPoseForMode(mode) {
	cameraPosesByMode.set(mode, {
		position: camera.position.clone(),
		quaternion: camera.quaternion.clone(),
	});
}

function cameraPositionMeters() {
	if (typeof config.geometry?.mapObserverLocalScenePointToModelPosition === 'function') {
		return config.geometry.mapObserverLocalScenePointToModelPosition(camera.position, {
			metersPerSceneUnit: METERS_PER_SCENE_UNIT,
		});
	}

	return [
		camera.position.x * METERS_PER_SCENE_UNIT,
		camera.position.y * METERS_PER_SCENE_UNIT,
		camera.position.z * METERS_PER_SCENE_UNIT,
	];
}

function createBindingValues() {
	return {
		'geometry.inverseProjectionMatrix': new THREE.Matrix4(),
		'geometry.inverseViewMatrix': new THREE.Matrix4(),
		'geometry.cameraWorldPositionMeters': new THREE.Vector3(),
		'geometry.sceneTerminationMeters': 0,
	};
}

function updateBindingValues() {
	camera.updateMatrixWorld();
	camera.updateProjectionMatrix();
	bindingValues['geometry.inverseProjectionMatrix'].copy(camera.projectionMatrixInverse);
	bindingValues['geometry.inverseViewMatrix'].copy(camera.matrixWorld);
	bindingValues['geometry.cameraWorldPositionMeters'].set(...cameraPositionMeters());
}

function modeLabel(mode) {
	return mode === 'globe' ? 'globe' : 'flat';
}

function handleShaderPerformance(sample) {
	recordBenchmarkPerformance(sample);

	if (performanceEnabled && !benchmarkSession) {
		recordShaderPerformance(sample);
	}
}

function recordShaderPerformance(sample) {
	const key = sample.passName;
	const previous = performanceSamples.get(key) ?? {};
	const next = {
		...previous,
		passName: key,
	};

	if (sample.event === 'cpu-submit') {
		next.cpuSubmitMs = sample.cpuSubmitMs;
		next.gpuAvailable = sample.gpuAvailable;
	}

	if (sample.event === 'gpu-elapsed') {
		next.gpuMs = sample.gpuMs;
		next.disjoint = sample.disjoint;
		next.gpuAvailable = sample.gpuAvailable;
	}

	if (sample.event === 'gpu-query-error') {
		next.errorMessage = sample.errorMessage;
		next.gpuAvailable = false;
	}

	performanceSamples.set(key, next);
	schedulePerformanceUiUpdate();
}

function schedulePerformanceUiUpdate() {
	if (performanceUiUpdatePending) {
		return;
	}

	performanceUiUpdatePending = true;
	requestAnimationFrame(() => {
		performanceUiUpdatePending = false;
		updatePerformanceUi();
	});
}

function createBenchmarkSession({ mode, qualityProfile, width, height, measuredRuns, warmupRuns }) {
	return {
		phase: 'setup',
		mode,
		qualityProfile,
		width,
		height,
		pixelRatio: 1,
		measuredRuns,
		warmupRuns,
		wallFrameDurationsMs: [],
		measuredSampleIds: new Map(),
		passSamples: new Map(),
		startedAtIso: new Date().toISOString(),
	};
}

function recordBenchmarkPerformance(sample) {
	if (!benchmarkSession) {
		return;
	}

	if (sample.event === 'cpu-submit' && benchmarkSession.phase === 'measured') {
		let passIds = benchmarkSession.measuredSampleIds.get(sample.passName);

		if (!passIds) {
			passIds = new Set();
			benchmarkSession.measuredSampleIds.set(sample.passName, passIds);
		}
		passIds.add(sample.sampleId);
	}

	if (!benchmarkSession.measuredSampleIds.get(sample.passName)?.has(sample.sampleId)) {
		return;
	}

	let passSamples = benchmarkSession.passSamples.get(sample.passName);

	if (!passSamples) {
		passSamples = [];
		benchmarkSession.passSamples.set(sample.passName, passSamples);
	}

	let passSample = passSamples.find((entry) => entry.sampleId === sample.sampleId);

	if (!passSample) {
		passSample = {
			sampleId: sample.sampleId,
			passName: sample.passName,
		};
		passSamples.push(passSample);
	}

	if (sample.event === 'cpu-submit') {
		passSample.cpuSubmitMs = sample.cpuSubmitMs;
		passSample.gpuAvailable = sample.gpuAvailable;
	}

	if (sample.event === 'gpu-elapsed') {
		passSample.gpuMs = sample.gpuMs;
		passSample.disjoint = sample.disjoint;
		passSample.gpuAvailable = sample.gpuAvailable;
	}

	if (sample.event === 'gpu-query-error') {
		passSample.errorMessage = sample.errorMessage;
		passSample.gpuAvailable = false;
	}
}

function createBenchmarkReport(session) {
	const drawingBufferSize = new THREE.Vector2();
	const diagnostics = shaderHandle?.getDiagnostics?.() ?? null;
	const viewportPixelsValue = session.width * session.height;
	const passes = {};

	renderer.getDrawingBufferSize(drawingBufferSize);

	for (const [passName, samples] of session.passSamples.entries()) {
		const cpuDurations = samples
			.map((sample) => sample.cpuSubmitMs)
			.filter(Number.isFinite);
		const gpuDurations = samples
			.map((sample) => sample.gpuMs)
			.filter(Number.isFinite);

		passes[passName] = {
			sampleCount: samples.length,
			cpuSubmitMs: summarizeDurations(cpuDurations),
			gpuMs: summarizeDurations(gpuDurations),
			gpuMsPerMegapixel: summarizeDurations(gpuDurations.map((duration) =>
				duration / (viewportPixelsValue / 1000000))),
			gpuSampleCount: gpuDurations.length,
			gpuAvailable: samples.some((sample) => sample.gpuAvailable === true),
			disjointCount: samples.filter((sample) => sample.disjoint).length,
			errorMessages: [...new Set(samples
				.map((sample) => sample.errorMessage)
				.filter(Boolean))],
		};
	}

	return {
		kind: 'flat32-algorithm32-production-browser-benchmark-v1',
		startedAtIso: session.startedAtIso,
		completedAtIso: new Date().toISOString(),
		mode: session.mode,
		qualityProfile: createQualityProfileReport(session.qualityProfile),
		viewport: {
			cssWidth: session.width,
			cssHeight: session.height,
			pixelRatio: session.pixelRatio,
			drawingBufferWidth: drawingBufferSize.x,
			drawingBufferHeight: drawingBufferSize.y,
			viewportPixels: viewportPixelsValue,
		},
		measurement: {
			warmupRuns: session.warmupRuns,
			measuredRuns: session.measuredRuns,
			clock: 'performance.now',
			forceGpuFinish: false,
			timingScope: 'EffectComposer render submit path; per-pass shader GPU times come from EXT_disjoint_timer_query_webgl2 when available',
			yieldPolicy: '10 ms every 5 frames; requestAnimationFrame otherwise',
			livePerformanceSampleIntervalFrames: LIVE_PERFORMANCE_SAMPLE_INTERVAL_FRAMES,
			benchmarkPerformanceSampleIntervalFrames: BENCHMARK_PERFORMANCE_SAMPLE_INTERVAL_FRAMES,
		},
		wallFrameMs: summarizeDurations(session.wallFrameDurationsMs),
		wallFrameMsPerMegapixel: summarizeDurations(session.wallFrameDurationsMs.map((duration) =>
			duration / (viewportPixelsValue / 1000000))),
		passes,
		shader: {
			sourceHash: diagnostics?.runtime?.sourceHash ?? null,
			runtimeFrameCount: diagnostics?.runtime?.frameCount ?? null,
			sceneInputCapture: diagnostics?.runtime?.sceneInputCapture ?? null,
		},
		config: createBenchmarkConfigSummary(config),
	};
}

function createBenchmarkConfigSummary(algorithm32Config) {
	const model = algorithm32.config.model;

	return {
		qualityProfile: currentQualityProfile.id,
		execution: {
			...algorithm32Config.execution,
		},
		spectralChannelCount: algorithm32Config.spectral.wavelengths.length,
		lightSource: {
			kind: model.lightSource?.kind ?? algorithm32Config.lightSource?.constructor?.name ?? null,
			cacheDirectionCount: model.lightSource?.cacheDirectionCount ?? null,
			cacheAltitudeBinCount: model.lightSource?.cacheAltitudeBinCount ?? null,
			cacheZBinCount: model.lightSource?.cacheZBinsMeters?.length ?? null,
			cacheRhoBinCount: model.lightSource?.cacheRhoBinsMeters?.length ?? null,
		},
		geometry: {
			kind: model.geometry?.kind ?? algorithm32Config.geometry?.constructor?.name ?? null,
			sceneFrame: model.geometry?.sceneFrame ?? null,
		},
	};
}

function createQualityProfileReport(profile) {
	return {
		id: profile.id,
		label: profile.label,
		role: profile.role,
		numericalControls: {
			...profile.numericalControls,
		},
		workEstimate: {
			...profile.workEstimate,
		},
		estimatedWorkRatioToIdeal: profile.estimatedWorkRatioToIdeal,
		transportOptimization: profile.transportOptimization,
		cacheOptimization: profile.cacheOptimization,
	};
}

function summarizeDurations(values) {
	const sorted = values
		.filter(Number.isFinite)
		.slice()
		.sort((left, right) => left - right);

	if (sorted.length === 0) {
		return {
			count: 0,
			mean: null,
			median: null,
			min: null,
			max: null,
			p95: null,
		};
	}

	const sum = sorted.reduce((total, value) => total + value, 0);

	return {
		count: sorted.length,
		mean: sum / sorted.length,
		median: percentile(sorted, 0.5),
		min: sorted[0],
		max: sorted[sorted.length - 1],
		p95: percentile(sorted, 0.95),
	};
}

function percentile(sortedValues, fraction) {
	if (sortedValues.length === 1) {
		return sortedValues[0];
	}

	const index = Math.min(
		sortedValues.length - 1,
		Math.max(0, Math.ceil(sortedValues.length * fraction) - 1),
	);

	return sortedValues[index];
}

function formatBenchmarkReport(report) {
	const passLines = Object.entries(report.passes)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([passName, pass]) => `${passName}: ${formatMs(pass.gpuMs.mean)} GPU mean, ${formatMs(pass.cpuSubmitMs.mean)} CPU-submit mean, ${formatMs(pass.gpuMsPerMegapixel.mean)} GPU ms/MP`);

	return [
		`Benchmark ${report.mode} ${report.viewport.drawingBufferWidth}x${report.viewport.drawingBufferHeight} DPR ${report.viewport.pixelRatio}`,
		`Quality: ${report.qualityProfile.id} (${report.qualityProfile.label}), estimated work ${report.qualityProfile.estimatedWorkRatioToIdeal.toFixed(3)}x ideal`,
		`Wall/composer: ${formatMs(report.wallFrameMs.mean)} mean, ${formatMs(report.wallFrameMs.median)} median, ${formatMs(report.wallFrameMs.p95)} p95, ${formatMs(report.wallFrameMsPerMegapixel.mean)} ms/MP`,
		`Shader source: ${report.shader.sourceHash ?? 'unknown'}`,
		...passLines,
		'',
		'Full JSON is available in console and window.flat32LastBenchmark.',
	].join('\n');
}

function formatMs(value) {
	return Number.isFinite(value) ? `${value.toFixed(3)}ms` : 'n/a';
}

function createSceneReference() {
	const synchronizer = new FlatSynchronizer().calibrateToWorld();
	const location = currentLocationPreset();
	const sourceReference = createFlatSourceReference({ synchronizer });
	const cameraReference = sourceReference;
	const position = sourceReference.position;
	const flatOffsetMeters = flatOffsetFromObserverMeters(location, position);
	const sourcePositionMeters = Object.freeze([
		flatOffsetMeters.x,
		flatOffsetMeters.y,
		FALSE_SUN_ALTITUDE_METERS,
	]);
	const observerPositionMeters = Object.freeze([0, 0, CAMERA_HEIGHT_SCENE_UNITS * METERS_PER_SCENE_UNIT]);
	const directionToLightFlatModel = normalizeTuple([
		sourcePositionMeters[0] - observerPositionMeters[0],
		sourcePositionMeters[1] - observerPositionMeters[1],
		sourcePositionMeters[2] - observerPositionMeters[2],
	]);
	const directionToLightObserverLocal = directionToLightFromSubsolarPoint(
		location.latitude,
		location.longitude,
		position.latitude,
		position.longitude,
	);
	const directionToLightScene = sceneDirectionFromObserverLocalSun(directionToLightObserverLocal);
	const cameraReferenceOffsetMeters = flatOffsetFromObserverMeters(location, cameraReference.position);
	const cameraLookDirectionScene = cameraLookDirectionFromReferenceSubpoint(cameraReferenceOffsetMeters);

	return Object.freeze({
		referenceTime: sourceReference.referenceTime,
		cameraReferenceTime: cameraReference.referenceTime,
		position,
		cameraPosition: cameraReference.position,
		sourcePositionMeters,
		directionToLightFlatModel,
		directionToLightObserverLocal,
		directionToLightModel: directionToLightObserverLocal,
		directionToLightScene,
		cameraLookDirectionScene,
	});
}

function cameraLookDirectionFromReferenceSubpoint(referenceOffsetMeters) {
	const horizontalDirection = normalizeHorizontalMeters(referenceOffsetMeters);

	return normalizeTuple([
		horizontalDirection.x * CAMERA_LOOK_AT_DISTANCE_METERS,
		CAMERA_LOOK_AT_HEIGHT_METERS - CAMERA_HEIGHT_SCENE_UNITS * METERS_PER_SCENE_UNIT,
		-horizontalDirection.y * CAMERA_LOOK_AT_DISTANCE_METERS,
	]);
}

function normalizeHorizontalMeters(offsetMeters) {
	const length = Math.hypot(offsetMeters.x, offsetMeters.y);

	if (length <= Number.EPSILON) {
		return Object.freeze({ x: 0, y: -1 });
	}

	return Object.freeze({
		x: offsetMeters.x / length,
		y: offsetMeters.y / length,
	});
}

function createFlatSourceReference(request) {
	return Object.freeze({
		referenceTime: currentSceneTimeIso,
		position: request.synchronizer.getPosition(currentSceneTimeIso),
	});
}

function modelPositionMetersToScenePoint(positionMeters) {
	return Object.freeze([
		positionMeters[0] / METERS_PER_SCENE_UNIT,
		positionMeters[2] / METERS_PER_SCENE_UNIT,
		-positionMeters[1] / METERS_PER_SCENE_UNIT,
	]);
}

function flatOffsetFromObserverMeters(observerLocation, sourcePosition) {
	const observer = projectNorthPoleAzimuthalEquidistantMeters(
		observerLocation.latitude,
		observerLocation.longitude,
	);
	const source = projectNorthPoleAzimuthalEquidistantMeters(
		sourcePosition.latitude,
		sourcePosition.longitude,
	);

	return Object.freeze({
		x: source.x - observer.x,
		y: source.y - observer.y,
	});
}

function projectNorthPoleAzimuthalEquidistantMeters(latitude, longitude) {
	const latitudeRadians = degreesToRadians(latitude);
	const longitudeRadians = degreesToRadians(longitude);
	const radiusMeters = CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters
		* (Math.PI / 2 - latitudeRadians);

	return Object.freeze({
		x: radiusMeters * Math.sin(longitudeRadians),
		y: radiusMeters * Math.cos(longitudeRadians),
	});
}

function sceneDirectionFromObserverLocalSun(observerLocalDirection) {
	const up = observerLocalDirection[0];
	const east = observerLocalDirection[1];
	const north = observerLocalDirection[2];

	return normalizeTuple([east, up, -north]);
}

function directionToLightFromSubsolarPoint(observerLatitude, observerLongitude, sourceLatitude, sourceLongitude) {
	const observer = geocentricUnitVector(observerLatitude, observerLongitude);
	const source = geocentricUnitVector(sourceLatitude, sourceLongitude);
	const east = normalizeTuple([
		-Math.sin(degreesToRadians(observerLongitude)),
		Math.cos(degreesToRadians(observerLongitude)),
		0,
	]);
	const north = normalizeTuple([
		-Math.sin(degreesToRadians(observerLatitude)) * Math.cos(degreesToRadians(observerLongitude)),
		-Math.sin(degreesToRadians(observerLatitude)) * Math.sin(degreesToRadians(observerLongitude)),
		Math.cos(degreesToRadians(observerLatitude)),
	]);

	return normalizeTuple([
		dot(source, observer),
		dot(source, east),
		dot(source, north),
	]);
}

function geocentricUnitVector(latitude, longitude) {
	const latitudeRadians = degreesToRadians(latitude);
	const longitudeRadians = degreesToRadians(longitude);
	const cosLatitude = Math.cos(latitudeRadians);

	return Object.freeze([
		cosLatitude * Math.cos(longitudeRadians),
		cosLatitude * Math.sin(longitudeRadians),
		Math.sin(latitudeRadians),
	]);
}

function normalizeTuple(values) {
	const length = Math.hypot(...values);

	if (length <= Number.EPSILON) {
		throw new RangeError('Cannot normalize a zero-length vector.');
	}

	return Object.freeze(values.map((value) => value / length));
}

function dot(left, right) {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	return radians * 180 / Math.PI;
}

function calendarDateLabel(value) {
	return new Date(value).toISOString().slice(0, 10);
}

function shortTimeLabel(value) {
	const date = new Date(value);

	return `${date.toISOString().slice(0, 16).replace('T', ' ')}Z`;
}

function dateTimeLabel(value) {
	return shortTimeLabel(value);
}

function animationFrame() {
	return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForSetupOverlayPaint(token) {
	await animationFrame();
	await animationFrame();

	return !disposed && token === setupToken;
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function updatePerformanceUi() {
	if (benchmarkSession) {
		return;
	}

	performanceButton.textContent = performanceEnabled ? 'Perf On' : 'Perf Off';
	performancePanel.hidden = !performanceEnabled;

	if (!performanceEnabled) {
		performancePanel.textContent = '';
		performanceSamples.clear();
		return;
	}

	const rows = [...performanceSamples.values()]
		.sort((left, right) => left.passName.localeCompare(right.passName))
		.map((sample) => {
			const cpuText = Number.isFinite(sample.cpuSubmitMs)
				? `${sample.cpuSubmitMs.toFixed(2)}ms CPU`
				: 'CPU pending';
			const gpuText = Number.isFinite(sample.gpuMs)
				? `${sample.gpuMs.toFixed(2)}ms GPU`
				: sample.gpuAvailable === false
					? 'GPU timer unavailable'
					: sample.disjoint
						? 'GPU disjoint'
						: 'GPU pending';

			return `${sample.passName}: ${cpuText}, ${gpuText}`;
		});

	performancePanel.textContent = rows.length > 0
		? rows.join('\n')
		: 'Waiting for shader samples...';
}

function clearBenchmarkReport() {
	benchmarkPanel.hidden = true;
	benchmarkPanel.textContent = '';
}

function spreadBins(min, max, count) {
	if (count <= 1) {
		return [min];
	}

	return Array.from({ length: count }, (_, index) =>
		min + (max - min) * (index / (count - 1)));
}

function createShell() {
	const shell = document.createElement('main');

	shell.className = 'flat32-shell';
	shell.innerHTML = `
		<canvas id="flat32-canvas" class="flat32-canvas"></canvas>
		<div id="flat32-star-calibration-labels" class="flat32-star-calibration-labels" aria-hidden="true"></div>
		<div class="flat32-toolbar">
			<button id="flat32-mode-button" class="flat32-mode-button" type="button">Switch to Globe</button>
			<button id="flat32-location-button" class="flat32-mode-button" type="button">Location: Union Glacier</button>
			<button id="flat32-shader-button" class="flat32-mode-button" type="button">Shader On</button>
			<button id="flat32-atmosphere-diagnostic-button" class="flat32-mode-button" type="button">Full Scene</button>
			<button id="flat32-green-shell-diagnostic-button" class="flat32-mode-button" type="button">Green Shell Off</button>
			<button id="flat32-quality-button" class="flat32-mode-button" type="button">Quality: Fast</button>
			<button id="flat32-performance-button" class="flat32-mode-button" type="button">Perf Off</button>
			<button id="flat32-benchmark-button" class="flat32-mode-button" type="button">Benchmark</button>
		</div>
		<div class="flat32-time-panel" aria-label="Time controls">
			<div id="flat32-time-value" class="flat32-time-value">Flat 0</div>
			<button id="flat32-time-basis-button" class="flat32-mode-button flat32-time-toggle" type="button">Use Globe Time</button>
			<div id="flat32-flat-time-controls" class="flat32-time-buttons">
				<button class="flat32-mode-button" type="button" data-flat-time-key="flat-0">0</button>
				<button class="flat32-mode-button" type="button" data-flat-time-key="flat-45">45</button>
				<button class="flat32-mode-button" type="button" data-flat-time-key="flat-90">90</button>
				<button class="flat32-mode-button" type="button" data-flat-time-key="flat-135">135</button>
				<button class="flat32-mode-button" type="button" data-flat-time-key="flat-180">180</button>
			</div>
			<div id="flat32-globe-time-controls" class="flat32-time-buttons" hidden>
				<button class="flat32-mode-button" type="button" data-globe-time-key="globe-sunrise">Sunrise</button>
				<button class="flat32-mode-button" type="button" data-globe-time-key="globe-solar-noon">Solar Noon</button>
				<button class="flat32-mode-button" type="button" data-globe-time-key="globe-sunset">Sun Set</button>
				<button class="flat32-mode-button" type="button" data-hour-offset="1">Hour +</button>
				<button class="flat32-mode-button" type="button" data-hour-offset="-1">Hour -</button>
				<button class="flat32-mode-button" type="button" data-minute-offset="10">10 Min +</button>
				<button class="flat32-mode-button" type="button" data-minute-offset="-10">10 Min -</button>
			</div>
		</div>
		<div id="flat32-status" class="flat32-status">Installing Algorithm32 flat shader... Click canvas, then move mouse to look around.</div>
		<div id="flat32-setup-overlay" class="flat32-setup-overlay" role="status" aria-live="polite" aria-label="Scene setup">
			<div class="flat32-setup-card">
				<div class="flat32-setup-spinner" aria-hidden="true"></div>
				<div class="flat32-setup-message">Setting up scene...</div>
			</div>
		</div>
		<pre id="flat32-benchmark-report" class="flat32-benchmark-report" hidden></pre>
		<pre id="flat32-performance" class="flat32-performance" hidden></pre>
	`;

	return shell;
}

function updateShaderButton() {
	shaderButton.textContent = shaderEnabled ? 'Shader On' : 'Shader Off';
	shaderButton.setAttribute('aria-label', shaderEnabled
		? 'Disable Algorithm32 shader and render only the solid Three scene'
		: 'Enable Algorithm32 shader');
	performanceButton.disabled = !shaderEnabled;
	benchmarkButton.disabled = !shaderEnabled;
}

function updateAtmosphereDiagnosticButton() {
	atmosphereDiagnosticButton.textContent = atmosphereOnlyDiagnosticEnabled ? 'Atmosphere Only' : 'Full Scene';
	atmosphereDiagnosticButton.classList.toggle('is-active', atmosphereOnlyDiagnosticEnabled);
	atmosphereDiagnosticButton.setAttribute('aria-label', atmosphereOnlyDiagnosticEnabled
		? 'Restore captured scene inputs, including ground, boxes, and star diagnostics'
		: 'Render only Algorithm32 atmosphere over a captured green shell and green diagnostic background');
}

function updateGreenShellDiagnosticButton() {
	greenShellDiagnosticButton.textContent = greenShellDiagnosticEnabled
		? 'Green Shell On'
		: atmosphereOnlyDiagnosticEnabled
			? 'Green Shell Included'
			: 'Green Shell Off';
	greenShellDiagnosticButton.classList.toggle('is-active', usesGreenShellDiagnosticEndpoint());
	greenShellDiagnosticButton.setAttribute('aria-label', greenShellDiagnosticEnabled
		? 'Restore normal captured scene endpoints'
		: 'Render a captured green sky shell endpoint to reveal dark sky output');
}

function applySceneBackground() {
	scene.background = new THREE.Color(
		atmosphereOnlyDiagnosticEnabled
			? ATMOSPHERE_ONLY_BACKGROUND_COLOR
			: DEFAULT_SCENE_BACKGROUND_COLOR,
	);
}

function createStyle() {
	const style = document.createElement('style');

	style.textContent = `
		html,
		body,
		#main-content {
			width: 100%;
			height: 100%;
			margin: 0;
			overflow: hidden;
			background: #060912;
		}

		.flat32-shell {
			position: relative;
			width: 100%;
			height: 100%;
		}

		.flat32-canvas {
			display: block;
			width: 100%;
			height: 100%;
			cursor: crosshair;
			touch-action: none;
		}

		.flat32-star-calibration-labels {
			position: absolute;
			inset: 0;
			z-index: 18;
			pointer-events: none;
			overflow: hidden;
		}

		.flat32-star-calibration-label {
			position: absolute;
			min-width: 14px;
			padding: 2px 4px;
			transform: translate(8px, -50%);
			background: rgba(255, 255, 255, 0.72);
			color: #020617;
			font: 11px/1.1 Consolas, monospace;
			text-align: center;
		}

		.flat32-status {
			position: absolute;
			left: 12px;
			top: 52px;
			padding: 6px 8px;
			background: rgba(0, 0, 0, 0.55);
			color: #ffffff;
			font: 12px/1.4 system-ui, sans-serif;
		}

		.flat32-toolbar {
			position: absolute;
			left: 12px;
			top: 12px;
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
			max-width: calc(100% - 24px);
		}

		.flat32-mode-button {
			appearance: none;
			border: 1px solid rgba(255, 255, 255, 0.35);
			background: rgba(10, 14, 22, 0.72);
			color: #ffffff;
			font: 13px/1.2 system-ui, sans-serif;
			padding: 7px 10px;
			cursor: pointer;
		}

		.flat32-mode-button:focus-visible {
			outline: 2px solid #ffffff;
			outline-offset: 2px;
		}

		.flat32-mode-button.is-active {
			border-color: rgba(255, 255, 255, 0.95);
			background: rgba(68, 106, 171, 0.82);
		}

		.flat32-time-panel {
			position: absolute;
			right: 12px;
			top: 12px;
			display: grid;
			gap: 8px;
			width: 136px;
			padding: 8px;
			background: rgba(0, 0, 0, 0.5);
		}

		.flat32-time-toggle,
		.flat32-time-buttons > .flat32-mode-button {
			width: 100%;
		}

		.flat32-time-buttons {
			display: grid;
			gap: 6px;
		}

		.flat32-time-buttons[hidden] {
			display: none;
		}

		.flat32-time-value {
			color: #ffffff;
			font: 12px/1.35 system-ui, sans-serif;
			text-align: center;
		}

		.flat32-setup-overlay {
			position: absolute;
			inset: 0;
			z-index: 30;
			display: grid;
			place-items: center;
			background: rgba(6, 9, 18, 0.24);
			pointer-events: auto;
		}

		.flat32-setup-overlay[hidden] {
			display: none;
		}

		.flat32-setup-card {
			display: grid;
			justify-items: center;
			gap: 12px;
			min-width: 180px;
			padding: 18px 22px;
			background: #ffffff;
			color: #10141f;
			box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
			font: 14px/1.35 system-ui, sans-serif;
		}

		.flat32-setup-spinner {
			width: 30px;
			height: 30px;
			border: 4px solid #d5dae5;
			border-top-color: #1d4ed8;
			border-radius: 50%;
			animation: flat32-spin 0.8s linear infinite;
		}

		@keyframes flat32-spin {
			to {
				transform: rotate(360deg);
			}
		}

		.flat32-performance {
			position: absolute;
			left: 12px;
			bottom: 12px;
			max-width: min(720px, calc(100% - 24px));
			max-height: min(45%, 420px);
			overflow: auto;
			margin: 0;
			padding: 8px 10px;
			white-space: pre-wrap;
			background: rgba(0, 0, 0, 0.62);
			color: #ffffff;
			font: 12px/1.45 Consolas, monospace;
		}

		.flat32-benchmark-report {
			position: absolute;
			right: 172px;
			top: 52px;
			max-width: min(760px, calc(100% - 184px));
			max-height: min(55%, 520px);
			overflow: auto;
			margin: 0;
			padding: 8px 10px;
			white-space: pre-wrap;
			background: rgba(0, 0, 0, 0.68);
			color: #ffffff;
			font: 12px/1.45 Consolas, monospace;
		}
	`;

	return style;
}
