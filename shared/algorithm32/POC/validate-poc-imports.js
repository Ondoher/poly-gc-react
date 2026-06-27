import {
	createAlgorithm32Model,
	createDistantDirectionalSunSource,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	createSphericalAtmosphereGeometry,
} from './source-contract/algorithm32-source-contract.js';
import {
	ATMOSPHERE as BASE_ATMOSPHERE,
	FIGURE1_FOUR_VIEW_SCENES,
	activeSpectralChannels as activeBaseSpectralChannels,
	computeSingleScatteringRadiance as computeBaseSingleScatteringRadiance,
	sunDirection as baseSunDirection,
} from './bruneton-start-fresh/bruneton-start-fresh.js';
import {
	ATMOSPHERE,
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	SUN_CASES,
	computePathRadianceSegment,
	createDistantSunAlgorithm32Model,
	distanceToSkyBoundary,
	sunDirection,
} from './cpu/node-three-reference.js';
import { postprocessSceneInput } from './cpu/cpu-scene-input-postprocessor.js';
import {
	createAlgorithm32FlatLocalPointSunSource,
	computeSingleScatteringRadiance,
} from './atmosflat32/run.js';
import { Algorithm32AtmospherePass } from './three/shader-lab-page.js';
import { createAlgorithm32PocPassConfig } from './three/local-second-order-renderer.js';
import {
	makeFlatLocalSunSourcePacket,
	sourceMatrixTemporalContextFromPayload,
} from './local-second-order/local-sun-source.js';

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

const sunCase = SUN_CASES.find((candidate) => candidate.id === 'figure1-13h15-z21') || SUN_CASES[0];
const distantModel = createDistantSunAlgorithm32Model(sunCase);
assert(distantModel.source.kind === 'distant-directional-sun', 'Expected distant source model.');

const explicitDistantSource = createDistantDirectionalSunSource({
	sunCase,
	direction: sunDirection(sunCase),
	spectralChannels: SPECTRAL_CHANNELS,
});
assert(
	explicitDistantSource.sample([ATMOSPHERE.bottomRadiusMeters + 2, 0, 0]).distanceKind === 'infinite',
	'Expected distant source sample to be infinite.'
);

const localSource = createFlatLocalPointSunSource({
	id: 'poc-validation-local-source',
	positionMeters: [0, 0, 5000000],
	radiusKm: 32,
	referenceDistanceKm: 4800,
	referenceSpectralIncidentScale: 1,
	distanceFalloff: true,
	spectralChannels: SPECTRAL_CHANNELS,
});
const localSample = localSource.sample([0, 0, 2]);
assert(localSample.kind === 'flat-local-point-sun', 'Expected flat/local source sample.');
assert(Number.isFinite(localSample.distanceMeters), 'Expected finite local source distance.');

const flatModel = createAlgorithm32Model({
	geometry: createFlatZUpAtmosphereGeometry({
		topAltitudeMeters: 100000,
		observerPositionMeters: [0, 0, 2],
	}),
	source: localSource,
	spectralProfile: {
		kind: 'algorithm32-15-channel-profile',
		channels: SPECTRAL_CHANNELS.map((channel) => ({
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
		})),
	},
	numericalConfig: NUMERICAL_CONTROLS,
});
assert(flatModel.sampleSource([0, 0, 2]).kind === 'flat-local-point-sun', 'Expected flat model source sampling.');

const sphericalGeometry = createSphericalAtmosphereGeometry({ atmosphere: ATMOSPHERE });
assert(sphericalGeometry.kind === 'spherical-atmosphere-geometry', 'Expected spherical geometry.');
assert(typeof postprocessSceneInput === 'function', 'Expected CPU soft-shader export.');
assert(typeof computeSingleScatteringRadiance === 'function', 'Expected atmosflat32 transport export.');
assert(typeof Algorithm32AtmospherePass === 'function', 'Expected importable Three atmosphere pass.');
assert(
	FIGURE1_FOUR_VIEW_SCENES.length === 4,
	'Expected original Bruneton start-fresh Figure 1 scene set.'
);

const baseSunCase =
	FIGURE1_FOUR_VIEW_SCENES.find((candidate) => candidate.id === 'figure1-13h15-z21') ||
	FIGURE1_FOUR_VIEW_SCENES[FIGURE1_FOUR_VIEW_SCENES.length - 1];
const baseRadiance = computeBaseSingleScatteringRadiance(
	[
		0,
		0,
		BASE_ATMOSPHERE.bottomRadiusMeters + BASE_ATMOSPHERE.observerHeightMeters,
	],
	[0, 1, 0],
	baseSunDirection(baseSunCase),
	{
		scene: baseSunCase,
		includeDirectSun: false,
		includeSecondOrder: false,
		includeGroundBounce: false,
	}
);
assert(
	baseRadiance.radiance.length === activeBaseSpectralChannels().length,
	'Expected original base Algorithm32 spectral radiance channel count.'
);
assert(
	baseRadiance.radiance.every(Number.isFinite),
	'Expected finite original base Algorithm32 radiance.'
);

const observer = [0, 0, ATMOSPHERE.bottomRadiusMeters + ATMOSPHERE.observerHeightMeters];
const skyRay = [0, 1, 0];
const skyDistance = distanceToSkyBoundary(observer, skyRay, distantModel.geometry);
const distantTransfer = computePathRadianceSegment({
	origin: observer,
	direction: skyRay,
	distance: skyDistance,
	sunCase,
	sunRay: sunDirection(sunCase),
	algorithm32Model: distantModel,
	controls: NUMERICAL_CONTROLS,
	includeSecondOrder: false,
});
assert(
	distantTransfer.pathRadianceByWavelength.every(Number.isFinite),
	'Expected finite distant CPU path radiance.'
);
assert(
	distantTransfer.pathRadianceByWavelength.some((value) => value > 0),
	'Expected nonzero distant CPU path radiance.'
);

const atmosflatLocalSource = createAlgorithm32FlatLocalPointSunSource({
	sceneKey: 'poc-validation',
	observerPositionMeters: [0, 0, 2],
	observerDirection: [1, 0, 0],
	observerDistanceKm: 5000,
	radiusKm: 32,
	color: { r: 1, g: 1, b: 1 },
	intensity: 1,
	solarIrradianceScale: 1,
	radianceConfig: {
		model: 'point-inverse-square-reference',
		referenceDistanceKm: 4800,
		distanceFalloff: true,
	},
	anchor: { kind: 'validation' },
	flatSourceConfig: { kind: 'validation' },
	brightnessCalibration: { kind: 'validation' },
});
const atmosflatSample = atmosflatLocalSource.sourceSamplesAt([0, 0, 2])[0];
assert(atmosflatSample.kind === 'flat-local-point-sun', 'Expected atmosflat32 local source sample.');
const localRadiance = computeSingleScatteringRadiance(
	[0, 0, 2],
	[1, 0, 0],
	atmosflatLocalSource,
	{
		viewDistanceMeters: 1000,
		includeSecondOrder: false,
	}
);
assert(
	localRadiance.radiance.every(Number.isFinite),
	'Expected finite flat/local single-scattering radiance.'
);

const localSecondOrderContext = sourceMatrixTemporalContextFromPayload({
	flatSimulationTime: '2026-06-21T12:00:00-07:00',
});
const localSecondOrderSource = makeFlatLocalSunSourcePacket(
	45,
	localSecondOrderContext
);
assert(
	localSecondOrderSource.positionMeters.every(Number.isFinite),
	'Expected finite accepted local second-order source position.'
);
assert(
	Number.isFinite(localSecondOrderSource.referenceSpectralIncidentScale),
	'Expected finite accepted local second-order source calibration scale.'
);
const localSecondOrderPassConfig = createAlgorithm32PocPassConfig({
	sourcePacket: localSecondOrderSource,
	geometryPacket: {
		topAltitudeMeters: 100000,
		observerPositionMeters: [0, 0, 2],
		sceneSkyRayLimitMeters: FLAT_SCENE_SKY_RAY_LIMIT_METERS,
		sceneSkyRayLimitPolicy: FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	},
	cachePayload: { incomingDirectionCount: 9 },
	displayPayload: {
		starField: { enabled: true, intensity: 1, density: 1.15, pointSize: 1.15 },
	},
});
assert(
	localSecondOrderPassConfig.config.localIncidentCache?.texture?.isData3DTexture === true,
	'Expected local second-order pass config to prepare a Data3DTexture cache.'
);
assert(
	localSecondOrderPassConfig.localIncidentCache.entries > 0,
	'Expected local second-order pass config to build cache entries.'
);
localSecondOrderPassConfig.dispose();

const onePixelPacket = {
	width: 1,
	height: 1,
	camera: { positionMeters: [0, ATMOSPHERE.observerHeightMeters, 0] },
	rayDirections: [0, 0, -1],
	hitMask: [0],
	hitDistanceMeters: [0],
	sceneColorRgba8: Buffer.from([0, 0, 0, 255]),
	source: {
		kind: 'distant-directional-sun',
		sunCase: sunCase.id,
	},
	selectedPixels: [{ id: 'single-sky', x: 0, y: 0 }],
};
const softShader = postprocessSceneInput(onePixelPacket, {
	surfacePolicy: 'captured-rgba8-display-domain',
	includeSecondOrder: false,
});
assert(softShader.pixels.length === 4, 'Expected one soft-shader output pixel.');
assert(
	Array.from(softShader.pixels).every(Number.isFinite),
	'Expected finite soft-shader output pixel.'
);

console.log(
	JSON.stringify(
		{
			status: 'ok',
			checked: [
				'source-contract distant/local source factories',
				'original bruneton-start-fresh base algorithm import',
				'original bruneton-start-fresh base radiance execution',
				'CPU reference imports',
				'CPU soft-shader export',
				'atmosflat32 local source factory export',
				'CPU distant radiance execution',
				'flat/local single-scattering execution',
				'local second-order source resolver execution',
				'local second-order Three pass config/cache texture preparation',
				'CPU soft-shader one-pixel execution',
				'importable Three Algorithm32AtmospherePass class',
			],
		},
		null,
		2
	)
);

// Some preserved experiment imports may keep library handles alive after the
// smoke proof completes. The validator is intentionally a one-shot check.
process.exit(0);
