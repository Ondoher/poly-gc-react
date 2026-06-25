import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import Random from '../../../src/gc/utils/random.js';
import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';
import {
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	SPECTRAL_CHANNELS,
	sunDirection,
} from './node-three-reference.js';
import { createFlatLocalPointSunSource, SOURCE_KINDS } from './algorithm32-source-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const DEFAULT_ATMOSFLAT_REFERENCE = path.join(
	REPO_ROOT,
	'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes'
);
const HEARTBEAT_PATH = path.join(
	DEFAULT_OUT_ROOT,
	'harness-heartbeat.json'
);
const WIDTH = 480;
const HEIGHT = 270;
const DEFAULT_TERRAIN_SEED = 'algorithm32-mountain-detail-v1';
const DISTANT_SUN_CASES = Object.freeze({
	midday: {
		id: 'figure1-13h15-z21',
		sourceTimeOfDay: '13h15',
		sourceSunZenithDegrees: 21,
		sunAltitudeDegrees: 69,
		sunAzimuthDegrees: 85.31410016049729,
		role: 'midday high-Sun subjective case',
	},
	sunset: {
		id: 'figure1-06h00-z87',
		sourceTimeOfDay: '06h00',
		sourceSunZenithDegrees: 87,
		sunAltitudeDegrees: 3,
		sunAzimuthDegrees: -25.83454348280912,
		role: 'sunset behind-camera subjective case',
	},
});

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'three-lit-detailed-subjective-source-scenes',
		atmosflatReference: DEFAULT_ATMOSFLAT_REFERENCE,
		commandPath: null,
		sceneVariant: 'mountain-detail',
		terrainSeed: DEFAULT_TERRAIN_SEED,
		sceneSkyRayLimitMeters: FLAT_SCENE_SKY_RAY_LIMIT_METERS,
		sceneSkyRayLimitPolicy: FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = argv[index + 1];
			index += 1;
		} else if (arg === '--scene-variant') {
			options.sceneVariant = argv[index + 1];
			index += 1;
		} else if (arg === '--terrain-seed') {
			options.terrainSeed = argv[index + 1];
			index += 1;
		} else if (arg === '--atmosflat-reference') {
			options.atmosflatReference = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--command-path') {
			options.commandPath = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--scene-sky-ray-limit-meters') {
			options.sceneSkyRayLimitMeters = Number(argv[index + 1]);
			options.sceneSkyRayLimitPolicy = 'explicit-command-line-poc-override';
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	return options;
}

function printHelp() {
	console.log(`Three-lit subjective source scenes

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-three-lit-subjective-source-scenes.js

Options:
  --command-path <path>         Watch command file. Defaults to heartbeat commandPath.
  --atmosflat-reference <path>  Accepted atmosflat32 source artifact.
  --out-root <path>             Output root.
  --label <name>                Artifact folder label.
  --scene-variant <name>        mountain-detail or mountain-ridges.
  --terrain-seed <value>        Deterministic mountain-detail seed.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runThreeLitSubjectiveSourceScenes(options);
	console.log(
		`Three-lit subjective source scenes ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runThreeLitSubjectiveSourceScenes(options) {
	const startedAt = new Date();
	const runLog = [];
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const commandPath = options.commandPath || (await readHeartbeatCommandPath());
	const reference = await loadAtmosflatReference(options.atmosflatReference);
	const terrainSpec =
		options.sceneVariant === 'mountain-detail'
			? createDetailedMountainTerrainSpec(options.terrainSeed)
			: null;
	const cases = buildCases({ reference, options, terrainSpec });
	const caseResults = [];

	for (const caseConfig of cases) {
		const caseResult = await runCase({
			artifact,
			casesRoot,
			commandPath,
			caseConfig,
			runLog,
		});
		caseResults.push(caseResult);
	}

	const galleryPath = await writeGallery({ artifact, caseResults });
	const criteria = buildCriteria({ caseResults, galleryPath });
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'three-lit-subjective-source-scenes-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		galleryPath,
		cases: caseResults.map((item) => item.resultSummary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'three-lit-subjective-source-scenes-command',
		options: {
			...options,
			commandPath: path.relative(REPO_ROOT, commandPath).replaceAll('\\', '/'),
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			atmosflatReference: path
				.relative(REPO_ROOT, options.atmosflatReference)
				.replaceAll('\\', '/'),
		},
		sceneDetail: terrainSpec
			? {
					kind: terrainSpec.kind,
					seed: terrainSpec.seed,
					numericSeed: terrainSpec.numericSeed,
					terrainBandCount: terrainSpec.terrainBands.length,
					generatedBy: terrainSpec.generatedBy,
				}
			: null,
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'three-lit-subjective-source-scenes-case-results',
		cases: caseResults.map((item) => item.resultSummary),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'three-lit-subjective-source-scenes-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({ packet, caseResults })
	);

	return { artifact, status, summary, packet };
}

function buildCases({ reference, options, terrainSpec }) {
	const sceneDetailSpec = terrainSpec;
	return [
		{
			id: 'distant-midday',
			label: 'Distant midday',
			sourceFamily: 'distant-directional-sun',
			mountainView: 'front-high-sun',
			cameraViewMode: null,
			sourcePacket: distantSourcePacket(DISTANT_SUN_CASES.midday),
			geometryPacket: sphericalGeometryPacket(),
			sceneDetailSpec,
			includeSecondOrder: true,
			subtitle: 'DirectionalLight, high Sun',
		},
		{
			id: 'distant-sunset-behind-camera',
			label: 'Distant sunset behind camera',
			sourceFamily: 'distant-directional-sun',
			mountainView: 'sunset-behind-camera',
			cameraViewMode: null,
			sourcePacket: distantSourcePacket(DISTANT_SUN_CASES.sunset),
			geometryPacket: sphericalGeometryPacket(),
			sceneDetailSpec,
			includeSecondOrder: true,
			subtitle: 'DirectionalLight, low Sun',
		},
		localCase({
			reference,
			options,
			offsetDegrees: 0,
			id: 'local-closest',
			label: 'Local closest approach',
			mountainView: 'front-high-sun',
			cameraViewMode: null,
			sceneDetailSpec,
		}),
		localCase({
			reference,
			options,
			offsetDegrees: 90,
			id: 'local-090deg',
			label: 'Local 90 degree orbit',
			mountainView: 'front-high-sun',
			cameraViewMode: null,
			sceneDetailSpec,
		}),
	];
}

async function runCase({
	artifact,
	casesRoot,
	commandPath,
	caseConfig,
	runLog,
}) {
	const caseRoot = path.join(casesRoot, caseConfig.id);
	await fs.mkdir(caseRoot, { recursive: true });
	const command = {
		id: `browser-mountain-lit-${caseConfig.id}-${Date.now()}`,
		label: `browser-mountain-lit-${caseConfig.id}`,
		createdAt: new Date().toISOString(),
		payload: {
			mode: 'browser-mountain-lit-scene-input-capture',
			width: WIDTH,
			height: HEIGHT,
			captureId: caseConfig.id,
			mountainView: caseConfig.mountainView,
			cameraViewMode: caseConfig.cameraViewMode,
			sourcePacket: caseConfig.sourcePacket,
			geometryPacket: caseConfig.geometryPacket,
			sceneDetailSpec: caseConfig.sceneDetailSpec,
			iteration: 'subjective-three-lit-source-scenes',
		},
	};
	await writeJson(commandPath, command);
	runLog.push(`${new Date().toISOString()} Wrote browser command ${command.id}.`);
	const browserRun = await waitForBrowserRun({
		outRoot: DEFAULT_OUT_ROOT,
		commandId: command.id,
	});
	runLog.push(
		`${new Date().toISOString()} Browser run ${path.basename(browserRun)} complete.`
	);
	const diagnostics = await readJson(path.join(browserRun, 'diagnostics.json'));
	const capture = diagnostics.diagnostics?.capture;
	if (!capture) {
		throw new Error(`Browser run ${browserRun} did not write a capture packet.`);
	}
	const postprocess = postprocessSceneInput(capture, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: caseConfig.includeSecondOrder,
	});
	const scenePreviewPath = path.join(caseRoot, 'three-lit-scene-color.png');
	const atmospherePath = path.join(caseRoot, 'atmosphere-postprocess.png');
	await fs.copyFile(path.join(browserRun, 'canvas-image.png'), scenePreviewPath);
	await writePng(atmospherePath, capture.width, capture.height, postprocess.pixels);
	await writeJson(path.join(caseRoot, 'browser-run.json'), {
		kind: 'three-lit-subjective-source-browser-run',
		browserRun: path.relative(REPO_ROOT, browserRun).replaceAll('\\', '/'),
		command,
	});
	await writeJson(path.join(caseRoot, 'source-light-packet.json'), {
		kind: 'three-lit-subjective-source-light-packet',
		source: capture.source,
		geometry: capture.geometry,
		sceneDetail: capture.sceneDetail || null,
		sceneLight: capture.sceneLight,
		postprocessSourceContract: postprocess.sourceContract,
	});
	await writeJson(path.join(caseRoot, 'selected-pixels.json'), {
		kind: 'three-lit-subjective-source-selected-pixels',
		browserSelectedPixels: capture.selectedPixels,
		postprocessSelectedPixels: postprocess.selectedPixels,
	});
	const criteria = buildCaseCriteria({ capture, postprocess, caseConfig });
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const resultSummary = {
		id: caseConfig.id,
		label: caseConfig.label,
		status,
		sourceFamily: caseConfig.sourceFamily,
		browserRun: path.relative(REPO_ROOT, browserRun).replaceAll('\\', '/'),
		scenePreviewPath: path
			.relative(REPO_ROOT, scenePreviewPath)
			.replaceAll('\\', '/'),
		atmospherePath: path.relative(REPO_ROOT, atmospherePath).replaceAll('\\', '/'),
		sourceKind: capture.source.kind,
		sceneLightKind: capture.sceneLight?.kind || null,
		sceneLightMode: capture.sceneLight?.mode || null,
		sceneLightIntensity: capture.sceneLight?.intensity || null,
		sourceDistanceKm: caseConfig.sourcePacket.observerDistanceKm || null,
		observerIncidentScale: caseConfig.sourcePacket.observerIncidentScale || null,
		sceneVariant: caseConfig.sceneDetailSpec?.kind || 'mountain-ridges',
		terrainSeed: caseConfig.sceneDetailSpec?.seed || null,
		includeSecondOrder: caseConfig.includeSecondOrder,
		summary,
	};
	await writeJson(path.join(caseRoot, 'criteria-results.json'), {
		kind: 'three-lit-subjective-source-case-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(caseRoot, 'result.json'), {
		kind: 'three-lit-subjective-source-case-result',
		...resultSummary,
	});
	return {
		caseConfig,
		caseRoot,
		status,
		summary,
		criteria,
		resultSummary,
	};
}

function distantSourcePacket(sunCase) {
	return {
		kind: 'distant-directional-sun',
		sunCase: sunCase.id,
		sunDirection: sunDirection(sunCase),
		sourceTimeOfDay: sunCase.sourceTimeOfDay,
		sourceSunZenithDegrees: sunCase.sourceSunZenithDegrees,
		sunAltitudeDegrees: sunCase.sunAltitudeDegrees,
		sunAzimuthDegrees: sunCase.sunAzimuthDegrees,
	};
}

function localCase({
	reference,
	options,
	offsetDegrees,
	id,
	label,
	mountainView,
	cameraViewMode,
	sceneDetailSpec,
}) {
	const sourceConfig = sourceConfigForOffset({ reference, offsetDegrees });
	const source = createFlatLocalPointSunSource({
		id: sourceConfig.sceneKey,
		positionMeters: sourceConfig.positionMeters,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		referenceSpectralIncidentScale:
			sourceConfig.referenceSpectralIncidentScale,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourceConfig.color,
	});
	const observerSample = source.sample(sourceConfig.observerPositionMeters);
	return {
		id,
		label,
		sourceFamily: SOURCE_KINDS.flatLocalPointSun,
		mountainView,
		cameraViewMode,
		sourcePacket: {
			kind: SOURCE_KINDS.flatLocalPointSun,
			id: sourceConfig.sceneKey,
			sunCase: sourceConfig.sceneKey,
			sceneKey: sourceConfig.sceneKey,
			flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
			offsetDegrees,
			positionMeters: sourceConfig.positionMeters,
			observerPositionMeters: sourceConfig.observerPositionMeters,
			observerDistanceKm: observerSample.distanceKm,
			observerIncidentScale: observerSample.incidentScale,
			radiusKm: sourceConfig.radiusKm,
			referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
			referenceSpectralIncidentScale:
				sourceConfig.referenceSpectralIncidentScale,
			distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
			color: sourceConfig.color,
			provenance: {
				sourceArtifact: reference.relativeDirectory,
				flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
				brightnessCalibration: sourceConfig.brightnessCalibration,
			},
		},
		geometryPacket: {
			kind: 'flat-z-up-atmosphere',
			observerPositionMeters: sourceConfig.observerPositionMeters,
			topAltitudeMeters:
				reference.inputs.geometry.atmosphereGeometry.atmosphereTopAltitudeMeters,
			sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
			sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
			threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
			threeToAlgorithmPosition: '[x, y, z] -> [x, -z, y]',
		},
		sceneDetailSpec,
		includeSecondOrder: false,
		subtitle: `PointLight, ${offsetDegrees} deg, scale ${observerSample.incidentScale.toFixed(3)}`,
	};
}

function sphericalGeometryPacket() {
	return {
		kind: 'spherical-atmosphere-geometry',
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
	};
}

function sourceConfigForOffset({ reference, offsetDegrees }) {
	const suffix = `${String(offsetDegrees).padStart(3, '0')}deg`;
	const sourceConfig = reference.inputs.transportSourceConfigs.find((item) =>
		item.flatSourceConfig.sceneKey.includes(suffix)
	);
	if (!sourceConfig) {
		throw new Error(`Missing atmosflat local source config for offset ${offsetDegrees}.`);
	}
	return sourceConfig;
}

function createDetailedMountainTerrainSpec(seedValue) {
	const seed = String(seedValue || DEFAULT_TERRAIN_SEED);
	const numericSeed = numericSeedFromString(seed);
	Random.randomize(numericSeed);

	const floor = buildContinuousDetailedTerrainMesh();
	const bottomGround = buildBottomGroundSurface();
	const terrainBands = [];

	return {
		kind: 'mountain-detail-v1',
		seed,
		numericSeed,
		generatedBy: 'src/gc/utils/random.js',
		coordinateSystem: 'THREE meters, y-up, x-horizontal, negative z into view',
		ambientIntensity: 0.055,
		bottomGround,
		floor,
		terrainBands,
		summary: {
			meshTopology: 'single-continuous-heightfield',
			terrainMeshId: floor.id,
			terrainVertices: floor.vertexCount,
			terrainTriangles: floor.triangleCount,
			bottomGroundId: bottomGround.id,
			bottomGroundPolicy:
				'large y=0 scene-bottom surface catches rays beyond the finite mountain mesh so distant ground is not rendered as sky',
			terrainBandCount: 0,
			terrainBandPolicy:
				'disabled; older independent terrain bands caused visible gaps',
		},
	};
}

function buildBottomGroundSurface() {
	return {
		kind: 'mountain-detail-bottom-ground-plane',
		id: 'detail-bottom-ground-plane',
		spectrumId: 'ground',
		color: [0.055, 0.115, 0.055],
		centerMeters: [0, 0, -140000],
		widthMeters: 620000,
		depthMeters: 620000,
		material: {
			roughness: 0.98,
			metalness: 0,
		},
		bounds: {
			xMin: -310000,
			xMax: 310000,
			zNear: 170000,
			zFar: -450000,
			y: 0,
		},
	};
}

function buildContinuousDetailedTerrainMesh() {
	const definition = {
		id: 'detail-continuous-valley-and-mountains',
		xMin: -132000,
		xMax: 132000,
		zNear: 2400,
		zFar: -42000,
		segmentsX: 72,
		segmentsZ: 40,
		rockLine: 2400,
		snowLine: 5200,
	};
	const features = continuousTerrainFeatures();
	const positions = [];
	const colors = [];
	const indices = [];
	let minHeight = Number.POSITIVE_INFINITY;
	let maxHeight = Number.NEGATIVE_INFINITY;

	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const x = interpolate(definition.xMin, definition.xMax, u);
			const z = interpolate(definition.zNear, definition.zFar, v);
			const height = continuousTerrainHeight({ definition, features, u, v });
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
			positions.push(round3(x), round3(height), round3(z));
			colors.push(
				...continuousTerrainColor({
					definition,
					features,
					height,
					u,
					v,
				}).map((channel) => round4(channel))
			);
		}
	}

	pushGridIndices(indices, definition.segmentsX, definition.segmentsZ);

	return {
		kind: 'mountain-detail-continuous-heightfield',
		id: definition.id,
		spectrumId: 'mountainRidgeGreen',
		positions,
		colors,
		indices,
		material: {
			roughness: 0.94,
			metalness: 0,
		},
		bounds: {
			xMin: definition.xMin,
			xMax: definition.xMax,
			zNear: definition.zNear,
			zFar: definition.zFar,
			minHeight: round3(minHeight),
			maxHeight: round3(maxHeight),
		},
		vertexCount: positions.length / 3,
		triangleCount: indices.length / 3,
	};
}

function continuousTerrainFeatures() {
	return {
		peaks: Array.from({ length: 18 }, () => ({
			u: randomRange(0.08, 0.92),
			v: randomRange(0.1, 0.98),
			widthU: randomRange(0.035, 0.14),
			widthV: randomRange(0.045, 0.2),
			height: randomRange(1200, 5200),
			sharpness: randomRange(0.85, 1.6),
		})),
		waves: Array.from({ length: 7 }, () => ({
			amplitude: randomRange(40, 280),
			frequencyU: randomRange(1.4, 7.8),
			frequencyV: randomRange(0.6, 5.4),
			phase: randomRange(0, Math.PI * 2),
			vPower: randomRange(0.7, 1.5),
		})),
		gullies: Array.from({ length: 9 }, () => ({
			u: randomRange(0.14, 0.86),
			width: randomRange(0.012, 0.04),
			depth: randomRange(45, 260),
			phase: randomRange(0, Math.PI * 2),
		})),
	};
}

function continuousTerrainHeight({ features, u, v }) {
	const edgeEnvelope = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.38);
	const mountainRamp = smoothstep(0.045, 0.74, v);
	const nearValleyFade = smoothstep(0.0, 0.15, v);
	const farRamp = Math.pow(mountainRamp, 1.04);
	const valleyChannel = Math.exp(-Math.pow((u - 0.5) / 0.22, 2));
	const sideSlope = (1 - valleyChannel) * smoothstep(0.035, 0.42, v) * 2600;
	const nearRidge =
		3600 *
		Math.exp(-Math.pow((v - 0.12) / 0.055, 2)) *
		edgeEnvelope *
		(0.6 + 0.4 * Math.sin((u * 3.5 + 0.2) * Math.PI));
	const midRidge =
		6200 *
		Math.exp(-Math.pow((v - 0.28) / 0.09, 2)) *
		edgeEnvelope *
		(0.55 + 0.45 * Math.sin((u * 5.4 + 1.1) * Math.PI));
	const farRidge =
		8600 *
		Math.exp(-Math.pow((v - 0.58) / 0.16, 2)) *
		edgeEnvelope *
		(0.58 + 0.42 * Math.sin((u * 6.8 + 2.2) * Math.PI));
	let height =
		18 * Math.sin((u * 4.0 + v * 1.5) * Math.PI) * (1 - v * 0.35) +
		sideSlope +
		nearRidge +
		midRidge +
		farRidge +
		farRamp * 4800 +
		edgeEnvelope * farRamp * 2600 -
		valleyChannel * nearValleyFade * 180;

	for (const peak of features.peaks) {
		const du = (u - peak.u) / peak.widthU;
		const dv = (v - peak.v) / peak.widthV;
		const distance = Math.pow(du * du + dv * dv, peak.sharpness);
		const peakShape = Math.exp(-distance);
		const peakDepth = smoothstep(0.08, 1.0, peak.v);
		height += peak.height * peakShape * peakDepth * edgeEnvelope;
	}

	for (const wave of features.waves) {
		height +=
			wave.amplitude *
			Math.sin(
				(u * wave.frequencyU + v * wave.frequencyV) * Math.PI + wave.phase
			) *
			Math.pow(v, wave.vPower) *
			edgeEnvelope;
	}

	for (const gully of features.gullies) {
		const center = gully.u + 0.035 * Math.sin(v * Math.PI * 3.0 + gully.phase);
		const du = (u - center) / gully.width;
		const cut = Math.exp(-(du * du));
		height -= gully.depth * cut * smoothstep(0.18, 0.95, v);
	}

	const foregroundRoll =
		34 *
		Math.sin((u * 7.0 + 0.4) * Math.PI) *
		Math.sin((v * 3.1 + 0.2) * Math.PI) *
		(1 - smoothstep(0.12, 0.34, v));

	return Math.max(0, height + foregroundRoll);
}

function continuousTerrainColor() {
	return [0.045, 0.14, 0.06];
}

function smoothstep(edge0, edge1, value) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function detailedMountainBandDefinitions() {
	return [
		{
			id: 'detail-foreground-folds',
			xMin: -62000,
			xMax: 62000,
			zNear: -2800,
			zFar: -9500,
			segmentsX: 42,
			segmentsZ: 8,
			baseHeight: 10,
			depthRise: 620,
			peakCount: 4,
			peakMin: 180,
			peakMax: 520,
			peakWidthMin: 0.08,
			peakWidthMax: 0.2,
			waveAmplitude: 90,
			grooveDepth: 45,
			rockLine: 520,
			snowLine: 1800,
			roughness: 0.95,
		},
		{
			id: 'detail-near-mountain-wall',
			xMin: -76000,
			xMax: 76000,
			zNear: -8200,
			zFar: -18500,
			segmentsX: 46,
			segmentsZ: 9,
			baseHeight: 120,
			depthRise: 1380,
			peakCount: 5,
			peakMin: 380,
			peakMax: 1100,
			peakWidthMin: 0.055,
			peakWidthMax: 0.15,
			waveAmplitude: 150,
			grooveDepth: 95,
			rockLine: 980,
			snowLine: 2650,
			roughness: 0.94,
		},
		{
			id: 'detail-middle-sawtooth',
			xMin: -92000,
			xMax: 92000,
			zNear: -17000,
			zFar: -34500,
			segmentsX: 50,
			segmentsZ: 9,
			baseHeight: 520,
			depthRise: 2200,
			peakCount: 7,
			peakMin: 620,
			peakMax: 1720,
			peakWidthMin: 0.04,
			peakWidthMax: 0.12,
			waveAmplitude: 230,
			grooveDepth: 140,
			rockLine: 1500,
			snowLine: 3300,
			roughness: 0.93,
		},
		{
			id: 'detail-far-alpine-ridge',
			xMin: -112000,
			xMax: 112000,
			zNear: -32500,
			zFar: -58000,
			segmentsX: 52,
			segmentsZ: 8,
			baseHeight: 1150,
			depthRise: 3000,
			peakCount: 8,
			peakMin: 900,
			peakMax: 2050,
			peakWidthMin: 0.035,
			peakWidthMax: 0.1,
			waveAmplitude: 260,
			grooveDepth: 170,
			rockLine: 2100,
			snowLine: 3900,
			roughness: 0.92,
		},
		{
			id: 'detail-horizon-snowline',
			xMin: -140000,
			xMax: 140000,
			zNear: -56000,
			zFar: -92000,
			segmentsX: 54,
			segmentsZ: 7,
			baseHeight: 1700,
			depthRise: 3750,
			peakCount: 9,
			peakMin: 1100,
			peakMax: 2500,
			peakWidthMin: 0.035,
			peakWidthMax: 0.095,
			waveAmplitude: 300,
			grooveDepth: 190,
			rockLine: 2600,
			snowLine: 4400,
			roughness: 0.91,
		},
	];
}

function buildDetailedFloorMesh() {
	const definition = {
		id: 'detail-valley-floor',
		xMin: -72000,
		xMax: 72000,
		zNear: 2300,
		zFar: -92000,
		segmentsX: 32,
		segmentsZ: 16,
	};
	const positions = [];
	const colors = [];
	const indices = [];

	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const x = interpolate(definition.xMin, definition.xMax, u);
			const z = interpolate(definition.zNear, definition.zFar, v);
			const riverCenter =
				0.5 + 0.045 * Math.sin(v * Math.PI * 3.8 + Random.random() * 0.02);
			const riverDistance = Math.abs(u - riverCenter);
			const lowRoll =
				26 * Math.sin(u * Math.PI * 5.2 + 0.7) *
					Math.sin(v * Math.PI * 2.7 + 1.8) +
				12 * Math.sin((u + v) * Math.PI * 11.0);
			const y = Math.max(0, lowRoll * (0.35 + v * 0.65));
			positions.push(round3(x), round3(y), round3(z));

			const meadow = [0.24, 0.33, 0.21];
			const sage = [0.34, 0.38, 0.27];
			const riverStone = [0.28, 0.31, 0.28];
			const color = riverDistance < 0.018
				? mixColor(riverStone, sage, riverDistance / 0.018)
				: mixColor(meadow, sage, clamp01(v * 0.85 + u * 0.08));
			const shade = 0.82 + 0.12 * Math.sin((u * 13.1 + v * 9.7) * Math.PI);
			colors.push(...color.map((channel) => round4(clamp01(channel * shade))));
		}
	}

	pushGridIndices(indices, definition.segmentsX, definition.segmentsZ);

	return {
		kind: 'mountain-detail-floor',
		id: definition.id,
		spectrumId: 'mountainRidgeGreen',
		positions,
		colors,
		indices,
		material: {
			roughness: 0.96,
			metalness: 0,
		},
		bounds: {
			xMin: definition.xMin,
			xMax: definition.xMax,
			zNear: definition.zNear,
			zFar: definition.zFar,
		},
		vertexCount: positions.length / 3,
		triangleCount: indices.length / 3,
	};
}

function buildDetailedTerrainBand(definition) {
	const peaks = Array.from({ length: definition.peakCount }, () => ({
		center: randomRange(0.08, 0.92),
		width: randomRange(definition.peakWidthMin, definition.peakWidthMax),
		height: randomRange(definition.peakMin, definition.peakMax),
		zBias: randomRange(0.3, 1.0),
	}));
	const waves = Array.from({ length: 5 }, () => ({
		amplitude: randomRange(definition.waveAmplitude * 0.25, definition.waveAmplitude),
		frequencyX: randomRange(1.5, 7.5),
		frequencyZ: randomRange(0.6, 4.2),
		phase: randomRange(0, Math.PI * 2),
	}));
	const positions = [];
	const colors = [];
	const indices = [];
	let minHeight = Number.POSITIVE_INFINITY;
	let maxHeight = Number.NEGATIVE_INFINITY;

	for (let iz = 0; iz <= definition.segmentsZ; iz += 1) {
		const v = iz / definition.segmentsZ;
		for (let ix = 0; ix <= definition.segmentsX; ix += 1) {
			const u = ix / definition.segmentsX;
			const x = interpolate(definition.xMin, definition.xMax, u);
			const z = interpolate(definition.zNear, definition.zFar, v);
			const height = detailedTerrainHeight({
				definition,
				peaks,
				waves,
				u,
				v,
			});
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
			positions.push(round3(x), round3(height), round3(z));
			colors.push(
				...detailedTerrainColor({ definition, height, u, v }).map((channel) =>
					round4(channel)
				)
			);
		}
	}

	pushGridIndices(indices, definition.segmentsX, definition.segmentsZ);

	return {
		kind: 'mountain-detail-terrain-band',
		id: definition.id,
		spectrumId: 'mountainRidgeGreen',
		positions,
		colors,
		indices,
		material: {
			roughness: definition.roughness,
			metalness: 0,
		},
		bounds: {
			xMin: definition.xMin,
			xMax: definition.xMax,
			zNear: definition.zNear,
			zFar: definition.zFar,
			minHeight: round3(minHeight),
			maxHeight: round3(maxHeight),
		},
		vertexCount: positions.length / 3,
		triangleCount: indices.length / 3,
	};
}

function detailedTerrainHeight({ definition, peaks, waves, u, v }) {
	const edgeEnvelope = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.42);
	let height =
		definition.baseHeight +
		definition.depthRise * Math.pow(v, 1.18) +
		definition.depthRise * 0.18 * edgeEnvelope;

	for (const peak of peaks) {
		const dx = (u - peak.center) / peak.width;
		const peakShape = Math.exp(-dx * dx);
		const zScale = 0.45 + 0.75 * Math.pow(v, peak.zBias);
		height += peak.height * peakShape * zScale;
	}

	for (const wave of waves) {
		height +=
			wave.amplitude *
			Math.sin(
				(u * wave.frequencyX + v * wave.frequencyZ) * Math.PI + wave.phase
			) *
			(0.35 + 0.65 * v) *
			edgeEnvelope;
	}

	const grooves =
		definition.grooveDepth *
		Math.abs(Math.sin((u * 13.0 + v * 4.5) * Math.PI)) *
		Math.pow(v, 0.9) *
		edgeEnvelope;

	return Math.max(0, height - grooves);
}

function detailedTerrainColor({ definition, height, u, v }) {
	const forest = [0.12, 0.23, 0.15];
	const meadow = [0.28, 0.36, 0.22];
	const rock = [0.39, 0.38, 0.33];
	const snow = [0.78, 0.79, 0.74];
	let color;

	if (height >= definition.snowLine) {
		color = mixColor(
			rock,
			snow,
			clamp01((height - definition.snowLine) / 1500)
		);
	} else if (height >= definition.rockLine) {
		color = mixColor(
			meadow,
			rock,
			clamp01((height - definition.rockLine) /
				(definition.snowLine - definition.rockLine))
		);
	} else {
		color = mixColor(
			forest,
			meadow,
			clamp01(height / Math.max(1, definition.rockLine))
		);
	}

	const treeLineStripe =
		height < definition.rockLine * 0.9 &&
		Math.sin((u * 23.0 + v * 3.0) * Math.PI) > 0.55
			? 0.82
			: 1;
	const shade =
		(0.78 + 0.1 * v + 0.08 * Math.sin((u * 17.3 + v * 8.1) * Math.PI)) *
		treeLineStripe;

	return color.map((channel) => clamp01(channel * shade));
}

function pushGridIndices(indices, segmentsX, segmentsZ) {
	for (let iz = 0; iz < segmentsZ; iz += 1) {
		for (let ix = 0; ix < segmentsX; ix += 1) {
			const a = iz * (segmentsX + 1) + ix;
			const b = a + 1;
			const c = a + segmentsX + 1;
			const d = c + 1;
			indices.push(a, c, b, b, c, d);
		}
	}
}

function numericSeedFromString(value) {
	let hash = 2166136261;
	for (const char of String(value)) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function randomRange(min, max) {
	return min + Random.random() * (max - min);
}

function interpolate(a, b, t) {
	return a + (b - a) * t;
}

function mixColor(a, b, t) {
	const amount = clamp01(t);
	return a.map((channel, index) => channel + (b[index] - channel) * amount);
}

function clamp01(value) {
	return Math.min(1, Math.max(0, value));
}

function round3(value) {
	return Math.round(value * 1000) / 1000;
}

function round4(value) {
	return Math.round(value * 10000) / 10000;
}

function buildCaseCriteria({ capture, postprocess, caseConfig }) {
	return [
		{
			id: 'browser-capture-accepted-shape',
			status:
				capture.width === WIDTH &&
				capture.height === HEIGHT &&
				capture.counts.skyPixels > 0 &&
				capture.counts.hitPixels > 0
					? 'passed'
					: 'failed',
			measured: {
				width: capture.width,
				height: capture.height,
				counts: capture.counts,
			},
		},
		{
			id: 'three-source-light-recorded',
			status:
				capture.sceneLight?.kind &&
				capture.sceneLight?.intensity > 0 &&
				capture.source?.kind === caseConfig.sourcePacket.kind
					? 'passed'
					: 'failed',
			measured: {
				source: capture.source,
				sceneLight: capture.sceneLight,
			},
		},
		{
			id: 'postprocess-finite-output',
			status:
				postprocess.finiteChecks.nonfinitePixels === 0 &&
				postprocess.finiteChecks.minByte >= 0 &&
				postprocess.finiteChecks.maxByte <= 255
					? 'passed'
					: 'failed',
			measured: postprocess.finiteChecks,
		},
		{
			id: 'sky-and-hit-selected-samples',
			status:
				postprocess.selectedPixels.some((sample) => !sample.hit) &&
				postprocess.selectedPixels.some((sample) => sample.hit)
					? 'passed'
					: 'failed',
			measured: postprocess.selectedPixels.map((sample) => ({
				id: sample.id,
				hit: sample.hit,
				postprocessRgba8: sample.postprocessRgba8,
			})),
		},
	];
}

function buildCriteria({ caseResults, galleryPath }) {
	return [
		{
			id: 'four-requested-subjective-scenes-rendered',
			status:
				caseResults.length === 4 &&
				caseResults.every((item) => item.status === 'accepted')
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => item.resultSummary),
		},
		{
			id: 'distant-and-local-three-lights-covered',
			status:
				caseResults.some(
					(item) => item.resultSummary.sceneLightMode === 'distant-directional-sun'
				) &&
				caseResults.some(
					(item) => item.resultSummary.sceneLightMode === 'flat-local-point-sun'
				)
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => ({
				id: item.resultSummary.id,
				mode: item.resultSummary.sceneLightMode,
				kind: item.resultSummary.sceneLightKind,
			})),
		},
		{
			id: 'gallery-written',
			status: galleryPath ? 'passed' : 'failed',
			measured: { galleryPath },
		},
	];
}

async function waitForBrowserRun({ outRoot, commandId }) {
	const deadline = Date.now() + 420000;
	while (Date.now() < deadline) {
		const entries = await fs.readdir(outRoot, { withFileTypes: true });
		const dirs = entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name)
			.sort()
			.reverse();
		for (const dir of dirs) {
			const runDir = path.join(outRoot, dir);
			const commandFile = path.join(runDir, 'command.json');
			const diagnosticsFile = path.join(runDir, 'diagnostics.json');
			try {
				const command = await readJson(commandFile);
				if (command.id !== commandId) {
					continue;
				}
				await readJson(diagnosticsFile);
				return runDir;
			} catch {
				// Keep polling while the watch harness is writing this artifact.
			}
		}
		await delay(500);
	}
	throw new Error(`Timed out waiting for browser command ${commandId}`);
}

async function writeGallery({ artifact, caseResults }) {
	const panelWidth = WIDTH;
	const panelHeight = HEIGHT;
	const labelHeight = 54;
	const gap = 14;
	const padding = 18;
	const columns = 2;
	const rows = 2;
	const width = padding * 2 + columns * panelWidth + (columns - 1) * gap;
	const height = padding * 2 + rows * (labelHeight + panelHeight) + (rows - 1) * gap;
	const composites = [];
	for (let index = 0; index < caseResults.length; index += 1) {
		const item = caseResults[index];
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = padding + column * (panelWidth + gap);
		const top = padding + row * (labelHeight + panelHeight + gap);
		composites.push({
			input: Buffer.from(labelSvg({
				width: panelWidth,
				height: labelHeight,
				title: item.caseConfig.label,
				subtitle: item.caseConfig.subtitle,
			})),
			left,
			top,
		});
		composites.push({
			input: path.join(item.caseRoot, 'atmosphere-postprocess.png'),
			left,
			top: top + labelHeight,
		});
	}
	const galleryPath = path.join(artifact.directory, 'three-lit-subjective-gallery.png');
	await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 18, g: 22, b: 28, alpha: 1 },
		},
	})
		.composite(composites)
		.png()
		.toFile(galleryPath);
	return path.relative(REPO_ROOT, galleryPath).replaceAll('\\', '/');
}

function labelSvg({ width, height, title, subtitle }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<rect width="100%" height="100%" fill="#151922"/>
	<text x="10" y="21" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#f2f4f8">${escapeXml(title)}</text>
	<text x="10" y="42" font-family="Arial, sans-serif" font-size="12" fill="#aeb7c8">${escapeXml(subtitle)}</text>
</svg>`;
}

function makeReport({ packet, caseResults }) {
	return [
		'# Three-Lit Subjective Source Scenes',
		'',
		`Status: ${packet.status}`,
		'',
		'These are subjective inspection renders. Three.js renders the mountain scene first with white source lights, then the CPU soft shader applies Algorithm32 atmosphere over the captured scene color.',
		'',
		'## Gallery',
		'',
		`- \`${packet.galleryPath}\``,
		'',
		'## Cases',
		'',
		...caseResults.map(
			(item) =>
				`- ${item.resultSummary.label}: \`${item.resultSummary.atmospherePath}\`, light ${item.resultSummary.sceneLightKind}, intensity ${item.resultSummary.sceneLightIntensity}.`
		),
		'',
		'## Notes',
		'',
		'- Distant scenes use white Three DirectionalLight direction and intensity from the source packet.',
		'- Local scenes use a white Three PointLight at the configured flat-Sun position with intensity scaled by the accepted observer incident scale.',
		'- Local PointLight decay is disabled for this subjective scene; Algorithm32 still uses the true finite local source for atmospheric transport.',
		'',
	].join('\n');
}

async function loadAtmosflatReference(referenceDirectory) {
	const directory = path.resolve(referenceDirectory);
	const inputs = await readJson(path.join(directory, 'inputs.json'));
	return {
		directory,
		relativeDirectory: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
		inputs,
	};
}

async function readHeartbeatCommandPath() {
	const heartbeat = await readJson(HEARTBEAT_PATH);
	if (!heartbeat.commandPath) {
		throw new Error('Harness heartbeat does not include commandPath.');
	}
	return heartbeat.commandPath;
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	let max = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const match = /^(\d+)-/.exec(entry.name);
		if (match) {
			max = Math.max(max, Number(match[1]));
		}
	}
	const prefix = String(max + 1).padStart(3, '0');
	const relativeFolder = `${prefix}-${slug(label)}`;
	const directory = path.join(outRoot, relativeFolder);
	await fs.mkdir(directory);
	return { directory, relativeFolder };
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, JSON.stringify(value, null, 2));
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

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function slug(value) {
	return (
		String(value || 'run')
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80) || 'run'
	);
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
