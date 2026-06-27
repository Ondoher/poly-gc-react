import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import Random from '../../../src/gc/utils/random.js';
import {
	createFlatLocalPointSunSource,
	createFlatLocalSunAlgorithm32Model,
	createFlatZUpAtmosphereGeometry,
	SPECTRAL_CHANNELS,
} from '../../../shared/algorithm32/POC/cpu/algorithm32-transport.js';
import { postprocessSceneInput } from '../../../shared/algorithm32/POC/cpu/soft-shader.js';
import {
	buildLocalIncidentGridCache,
	makeDefaultLocalIncidentCacheConfig,
	makeLocalIncomingDirections,
} from '../../../shared/algorithm32/POC/local-second-order/local-cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/local-second-order');
const HEARTBEAT_PATH = path.join(OUT_ROOT, 'harness-heartbeat.json');
const DEFAULT_COMMAND_PATH = path.join(OUT_ROOT, 'browser-command.json');
const CASES = Object.freeze([
	{
		id: 'distant-midday',
		label: 'Distant Midday',
		sourceFamily: 'distant-directional-sun',
		secondOrderNote: 'distant altitude cache control',
	},
	{
		id: 'distant-sunset-behind-camera',
		label: 'Distant Sunset Behind Camera',
		sourceFamily: 'distant-directional-sun',
		secondOrderNote: 'distant altitude cache control',
	},
	{
		id: 'local-closest',
		label: 'Local Closest Approach',
		sourceFamily: 'flat-local-point-sun',
		secondOrderNote: 'local z/rho/direction cache',
	},
	{
		id: 'local-090deg',
		label: 'Local 90 Degree Orbit',
		sourceFamily: 'flat-local-point-sun',
		secondOrderNote: 'local z/rho/direction cache',
	},
]);

function parseArgs(argv) {
	const options = {
		outRoot: OUT_ROOT,
		label: 'subjective-l2-cache-comparison',
		commandPath: null,
		width: 480,
		height: 270,
		timeoutMs: 300000,
		terrainSeed: 'algorithm32-mountain-detail-v1',
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
		} else if (arg === '--command-path') {
			options.commandPath = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--width') {
			options.width = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--height') {
			options.height = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--timeout-ms') {
			options.timeoutMs = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--terrain-seed') {
			options.terrainSeed = argv[index + 1];
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
	console.log(`Local subjective L2-cache comparison

Usage:
  node scripts/flat/local-second-order/subjective-l2-cache-comparison.js

Options:
  --command-path <path>  Running local harness command file.
  --out-root <path>      Output root. Default: tmp/atmosphere/local-second-order
  --width <px>           Scene width. Default: 480
  --height <px>          Scene height. Default: 270
  --timeout-ms <ms>      Browser wait timeout. Default: 300000
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runSubjectiveL2CacheComparison(options);
	console.log(`${result.status}: ${result.artifact.relativeFolder}`);
	console.log(`Gallery: ${path.relative(REPO_ROOT, result.galleryPath).replaceAll('\\', '/')}`);
	console.log(`Criteria: ${result.summary.pass}/${result.summary.total} pass, ${result.summary.fail} fail`);
}

export async function runSubjectiveL2CacheComparison(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const commandPath = options.commandPath || (await resolveCommandPath());
	const runLog = [
		`${startedAt.toISOString()} Started local subjective L2-cache comparison.`,
		`${new Date().toISOString()} Using command path ${path.relative(REPO_ROOT, commandPath).replaceAll('\\', '/')}.`,
	];
	const terrainSpec = createDetailedMountainTerrainSpec(options.terrainSeed);
	const caseResults = [];

	for (const caseConfig of CASES) {
		const caseResult = await runCase({
			artifact,
			casesRoot,
			commandPath,
			caseConfig,
			options,
			terrainSpec,
			runLog,
		});
		caseResults.push(caseResult);
	}

	const galleryPath = await writeGallery({ artifact, caseResults });
	const criteria = buildCriteria({ caseResults, galleryPath });
	const summary = summarizeCriteria(criteria);
	const status = summary.fail === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'algorithm32-local-second-order-subjective-l2-cache-comparison-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		galleryPath: path.relative(REPO_ROOT, galleryPath).replaceAll('\\', '/'),
		summary,
		cases: caseResults.map((item) => item.summary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-local-second-order-subjective-l2-cache-comparison-command',
		options: {
			...options,
			commandPath: path.relative(REPO_ROOT, commandPath).replaceAll('\\', '/'),
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'algorithm32-local-second-order-subjective-l2-cache-comparison-cases',
		cases: packet.cases,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-local-second-order-subjective-l2-cache-comparison-criteria',
		status,
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'state-goal.md'), makeStateGoal({ status, summary }));
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({ packet, caseResults }));
	await appendRunningLog(options.outRoot, packet);

	return { artifact, status, summary, packet, galleryPath };
}

async function runCase({
	artifact,
	casesRoot,
	commandPath,
	caseConfig,
	options,
	terrainSpec,
	runLog,
}) {
	const caseRoot = path.join(casesRoot, caseConfig.id);
	await fs.mkdir(caseRoot, { recursive: true });
	const browserRun = await runBrowserCapture({
		commandPath,
		outRoot: options.outRoot,
		caseConfig,
		options,
		terrainSpec,
		runLog,
	});
	const browserPacket = await readJson(path.join(browserRun, 'result.json'));
	const capture = browserPacket.result?.diagnostics?.capture;
	if (!capture) {
		throw new Error(`Browser run ${browserRun} did not return diagnostics.capture.`);
	}

	const withoutSecondOrder = postprocessSceneInput(capture, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: false,
	});
	const incidentField = createIncidentFieldForCase(capture, caseConfig);
	const withSecondOrder = postprocessSceneInput(capture, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: true,
		incidentField,
	});
	const diff = diffRgba(withoutSecondOrder.pixels, withSecondOrder.pixels);
	const diffPixels = makeDiffImage(withoutSecondOrder.pixels, withSecondOrder.pixels);

	const sceneColorPath = path.join(caseRoot, 'three-lit-scene-color.png');
	const withoutPath = path.join(caseRoot, 'without-second-order.png');
	const withPath = path.join(caseRoot, 'with-second-order-cache.png');
	const diffPath = path.join(caseRoot, 'l2-diff-x4.png');
	const sideBySidePath = path.join(caseRoot, 'side-by-side.png');

	await fs.copyFile(path.join(browserRun, 'canvas-image.png'), sceneColorPath);
	await writePng(withoutPath, capture.width, capture.height, withoutSecondOrder.pixels);
	await writePng(withPath, capture.width, capture.height, withSecondOrder.pixels);
	await writePng(diffPath, capture.width, capture.height, diffPixels);
	await writeSideBySide({
		caseConfig,
		width: capture.width,
		height: capture.height,
		withoutPath,
		withPath,
		diffPath,
		outputPath: sideBySidePath,
	});

	const selectedPixels = {
		withoutSecondOrder: withoutSecondOrder.selectedPixels,
		withSecondOrder: withSecondOrder.selectedPixels,
	};
	const summary = {
		id: caseConfig.id,
		label: caseConfig.label,
		sourceFamily: caseConfig.sourceFamily,
		status:
			withoutSecondOrder.finiteChecks.nonfinitePixels === 0 &&
			withSecondOrder.finiteChecks.nonfinitePixels === 0
				? 'accepted'
				: 'rejected',
		browserRun: path.relative(REPO_ROOT, browserRun).replaceAll('\\', '/'),
		sceneColorPath: path.relative(REPO_ROOT, sceneColorPath).replaceAll('\\', '/'),
		withoutSecondOrderPath: path.relative(REPO_ROOT, withoutPath).replaceAll('\\', '/'),
		withSecondOrderCachePath: path.relative(REPO_ROOT, withPath).replaceAll('\\', '/'),
		diffPath: path.relative(REPO_ROOT, diffPath).replaceAll('\\', '/'),
		sideBySidePath: path.relative(REPO_ROOT, sideBySidePath).replaceAll('\\', '/'),
		secondOrderNote: caseConfig.secondOrderNote,
		sourceKind: capture.source?.kind || null,
		sceneLightKind: capture.sceneLight?.kind || null,
		counts: capture.counts,
		diff,
		cacheDiagnostics: withSecondOrder.cacheDiagnostics,
		withoutFiniteChecks: withoutSecondOrder.finiteChecks,
		withFiniteChecks: withSecondOrder.finiteChecks,
	};

	await writeJson(path.join(caseRoot, 'browser-run.json'), {
		kind: 'algorithm32-local-second-order-subjective-browser-run-link',
		browserRun: summary.browserRun,
		commandId: browserPacket.command?.id || null,
	});
	await writeJson(path.join(caseRoot, 'source-light-packet.json'), {
		kind: 'algorithm32-local-second-order-subjective-source-light-packet',
		source: capture.source,
		geometry: capture.geometry,
		sceneLight: capture.sceneLight,
		sceneDetail: capture.sceneDetail,
		cacheDiagnostics: withSecondOrder.cacheDiagnostics,
	});
	await writeJson(path.join(caseRoot, 'selected-pixels.json'), {
		kind: 'algorithm32-local-second-order-subjective-selected-pixels',
		browserSelectedPixels: capture.selectedPixels,
		...selectedPixels,
	});
	await writeJson(path.join(caseRoot, 'result.json'), {
		kind: 'algorithm32-local-second-order-subjective-case-result',
		...summary,
	});
	runLog.push(
		`${new Date().toISOString()} Rendered ${caseConfig.id}; max RGB delta ${diff.maxAbsRgbDelta}.`
	);

	return {
		caseConfig,
		caseRoot,
		summary,
		withoutPath,
		withPath,
		diffPath,
		sideBySidePath,
	};
}

async function runBrowserCapture({
	commandPath,
	outRoot,
	caseConfig,
	options,
	terrainSpec,
	runLog,
}) {
	const command = {
		id: `local-subjective-capture-${caseConfig.id}-${Date.now()}`,
		label: `subjective-scene-capture-${caseConfig.id}`,
		type: 'subjective-scene-capture',
		createdAt: new Date().toISOString(),
		stateGoal:
			'Generate a local-lane live Three subjective mountain scene packet for first-order versus L2-cache soft-shader comparison.',
		payload: {
			caseId: caseConfig.id,
			width: options.width,
			height: options.height,
			terrainSeed: options.terrainSeed,
			sceneDetailSpec: terrainSpec,
		},
	};
	await writeJson(commandPath, command);
	runLog.push(`${new Date().toISOString()} Wrote browser command ${command.id}.`);
	return waitForBrowserRun({
		outRoot,
		commandId: command.id,
		timeoutMs: options.timeoutMs,
	});
}

function createIncidentFieldForCase(capture, caseConfig) {
	if (caseConfig.sourceFamily !== 'flat-local-point-sun') {
		return null;
	}
	const sourcePacket = capture.source;
	const geometryPacket = capture.geometry || {};
	const observerPositionMeters =
		geometryPacket.observerPositionMeters ||
		sourcePacket.observerPositionMeters ||
		[0, 0, 2];
	const source = createFlatLocalPointSunSource({
		id: sourcePacket.id,
		positionMeters: sourcePacket.positionMeters,
		radiusKm: sourcePacket.radiusKm,
		referenceDistanceKm: sourcePacket.referenceDistanceKm,
		referenceSpectralIncidentScale:
			sourcePacket.referenceSpectralIncidentScale ?? sourcePacket.incidentScale ?? 1,
		distanceFalloff: sourcePacket.distanceFalloff !== false,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourcePacket.color || { r: 1, g: 0.98, b: 0.95 },
		provenance: sourcePacket.provenance || null,
	});
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters:
			geometryPacket.topAltitudeMeters ??
			geometryPacket.atmosphereTopAltitudeMeters ??
			100000,
		observerPositionMeters,
		sceneSkyRayLimitMeters: geometryPacket.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: geometryPacket.sceneSkyRayLimitPolicy || null,
	});
	const model = createFlatLocalSunAlgorithm32Model({ source, geometry });
	const incomingDirections = makeLocalIncomingDirections(17);
	const cacheConfig = makeDefaultLocalIncidentCacheConfig({ incomingDirections });
	return buildLocalIncidentGridCache({
		model,
		sourceKey: source.id,
		cacheConfig,
		incomingDirections,
	});
}

function createDetailedMountainTerrainSpec(seedValue) {
	const seed = String(seedValue || 'algorithm32-mountain-detail-v1');
	const numericSeed = numericSeedFromString(seed);
	Random.randomize(numericSeed);
	const floor = buildContinuousDetailedTerrainMesh();
	const bottomGround = buildBottomGroundSurface();

	return {
		kind: 'mountain-detail-v1',
		seed,
		numericSeed,
		generatedBy: 'src/gc/utils/random.js',
		coordinateSystem: 'THREE meters, y-up, x-horizontal, negative z into view',
		ambientIntensity: 0.055,
		bottomGround,
		floor,
		terrainBands: [],
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
			const height = continuousTerrainHeight({ features, u, v });
			minHeight = Math.min(minHeight, height);
			maxHeight = Math.max(maxHeight, height);
			positions.push(round3(x), round3(height), round3(z));
			colors.push(...continuousTerrainColor().map((channel) => round4(channel)));
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
		height +=
			peak.height *
			Math.exp(-distance) *
			smoothstep(0.08, 1.0, peak.v) *
			edgeEnvelope;
	}
	for (const wave of features.waves) {
		height +=
			wave.amplitude *
			Math.sin((u * wave.frequencyU + v * wave.frequencyV) * Math.PI + wave.phase) *
			Math.pow(v, wave.vPower) *
			edgeEnvelope;
	}
	for (const gully of features.gullies) {
		const center = gully.u + 0.035 * Math.sin(v * Math.PI * 3.0 + gully.phase);
		const du = (u - center) / gully.width;
		height -= gully.depth * Math.exp(-(du * du)) * smoothstep(0.18, 0.95, v);
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

function smoothstep(edge0, edge1, value) {
	const t = clamp01((value - edge0) / (edge1 - edge0));
	return t * t * (3 - 2 * t);
}

function interpolate(a, b, t) {
	return a + (b - a) * t;
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

async function waitForBrowserRun({ outRoot, commandId, timeoutMs }) {
	const start = Date.now();
	for (;;) {
		const latestPath = path.join(outRoot, 'latest.json');
		try {
			const latest = await readJson(latestPath);
			if (latest.command?.id === commandId && latest.artifact?.runDir) {
				return latest.artifact.runDir;
			}
		} catch {
			// Keep waiting while the watcher writes the next artifact.
		}
		if (Date.now() - start > timeoutMs) {
			throw new Error(`Timed out waiting for local harness command ${commandId}.`);
		}
		await delay(750);
	}
}

async function writeGallery({ artifact, caseResults }) {
	const first = caseResults[0];
	const metadata = await sharp(first.withoutPath).metadata();
	const imageWidth = metadata.width;
	const imageHeight = metadata.height;
	const gutter = 16;
	const labelHeight = 42;
	const rowGap = 22;
	const columns = 2;
	const width = imageWidth * columns + gutter * (columns + 1);
	const rowHeight = labelHeight + imageHeight;
	const height = caseResults.length * rowHeight + (caseResults.length + 1) * rowGap;
	const composites = [];

	for (let index = 0; index < caseResults.length; index += 1) {
		const item = caseResults[index];
		const top = rowGap + index * (rowHeight + rowGap);
		composites.push({
			input: labelSvg({
				width,
				height: labelHeight,
				left: item.caseConfig.label,
				center: 'without second order',
				right: 'with second-order cache',
			}),
			left: 0,
			top,
		});
		composites.push({
			input: item.withoutPath,
			left: gutter,
			top: top + labelHeight,
		});
		composites.push({
			input: item.withPath,
			left: gutter * 2 + imageWidth,
			top: top + labelHeight,
		});
	}

	const outputPath = path.join(artifact.directory, 'subjective-l2-cache-comparison-gallery.png');
	await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: '#101418',
		},
	})
		.composite(composites)
		.png()
		.toFile(outputPath);
	return outputPath;
}

async function writeSideBySide({
	caseConfig,
	width,
	height,
	withoutPath,
	withPath,
	diffPath,
	outputPath,
}) {
	const gutter = 14;
	const labelHeight = 40;
	const columns = 3;
	const panelWidth = width * columns + gutter * (columns + 1);
	const panelHeight = height + labelHeight + gutter;
	await sharp({
		create: {
			width: panelWidth,
			height: panelHeight,
			channels: 4,
			background: '#101418',
		},
	})
		.composite([
			{
				input: labelSvg({
					width: panelWidth,
					height: labelHeight,
					left: caseConfig.label,
					center: 'without',
					right: 'with cache / diff x4',
				}),
				left: 0,
				top: 0,
			},
			{ input: withoutPath, left: gutter, top: labelHeight },
			{ input: withPath, left: gutter * 2 + width, top: labelHeight },
			{ input: diffPath, left: gutter * 3 + width * 2, top: labelHeight },
		])
		.png()
		.toFile(outputPath);
}

function labelSvg({ width, height, left, center, right }) {
	const escapedLeft = escapeXml(left);
	const escapedCenter = escapeXml(center);
	const escapedRight = escapeXml(right);
	return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#101418"/>
  <text x="16" y="26" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#edf3f7">${escapedLeft}</text>
  <text x="${Math.floor(width * 0.28)}" y="26" font-family="Arial, sans-serif" font-size="15" fill="#aab8c2">${escapedCenter}</text>
  <text x="${Math.floor(width * 0.68)}" y="26" font-family="Arial, sans-serif" font-size="15" fill="#aab8c2">${escapedRight}</text>
</svg>`);
}

function diffRgba(a, b) {
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let rgbCount = 0;
	let changedPixels = 0;
	for (let index = 0; index < Math.min(a.length, b.length); index += 4) {
		let pixelChanged = false;
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Math.abs(a[index + channel] - b[index + channel]);
			maxAbsRgbDelta = Math.max(maxAbsRgbDelta, delta);
			sumAbsRgbDelta += delta;
			rgbCount += 1;
			pixelChanged ||= delta > 0;
		}
		if (pixelChanged) {
			changedPixels += 1;
		}
	}
	return {
		maxAbsRgbDelta,
		meanAbsRgbDelta: rgbCount === 0 ? 0 : sumAbsRgbDelta / rgbCount,
		changedPixels,
	};
}

function makeDiffImage(a, b) {
	const output = Buffer.alloc(Math.min(a.length, b.length));
	for (let index = 0; index < output.length; index += 4) {
		output[index] = clampByte(Math.abs(a[index] - b[index]) * 4);
		output[index + 1] = clampByte(Math.abs(a[index + 1] - b[index + 1]) * 4);
		output[index + 2] = clampByte(Math.abs(a[index + 2] - b[index + 2]) * 4);
		output[index + 3] = 255;
	}
	return output;
}

function buildCriteria({ caseResults, galleryPath }) {
	const criteria = [
		{
			criterionId: 'four-subjective-cases-rendered',
			status: caseResults.length === CASES.length ? 'pass' : 'fail',
			tolerance: `${CASES.length} cases`,
			measuredError: caseResults.map((item) => item.summary.id),
			sourceOrStatus: 'comparison-runner',
			notes: 'The matrix contains distant midday, distant sunset, local closest, and local 90 degree scenes.',
		},
		{
			criterionId: 'gallery-written',
			status: galleryPath ? 'pass' : 'fail',
			tolerance: 'gallery PNG exists',
			measuredError: galleryPath ? 0 : 1,
			sourceOrStatus: 'comparison-runner',
			notes: 'The output includes a top-level side-by-side gallery.',
		},
	];

	for (const item of caseResults) {
		criteria.push({
			criterionId: `${item.summary.id}-postprocess-finite`,
			status: item.summary.status === 'accepted' ? 'pass' : 'fail',
			tolerance: '0 nonfinite postprocess pixels',
			measuredError: {
				without: item.summary.withoutFiniteChecks,
				with: item.summary.withFiniteChecks,
			},
			sourceOrStatus: item.summary.id,
			notes: 'Both first-order and second-order/cache images are finite.',
		});
		if (item.summary.sourceFamily === 'flat-local-point-sun') {
			criteria.push({
				criterionId: `${item.summary.id}-uses-local-incident-cache`,
				status:
					item.summary.cacheDiagnostics?.incidentFieldKind ===
					'local-grid-first-order-incident-field'
						? 'pass'
						: 'fail',
				tolerance: 'local-grid-first-order-incident-field',
				measuredError: item.summary.cacheDiagnostics,
				sourceOrStatus: item.summary.id,
				notes: 'The local with-cache image uses the accepted z/rho/direction local incident cache.',
			});
			criteria.push({
				criterionId: `${item.summary.id}-local-l2-changes-image`,
				status: item.summary.diff.maxAbsRgbDelta > 0 ? 'pass' : 'fail',
				tolerance: 'max RGB delta > 0',
				measuredError: item.summary.diff,
				sourceOrStatus: item.summary.id,
				notes: 'The requested local L2 cache contribution is visible in image-space.',
			});
		}
	}
	return criteria;
}

function makeReport({ packet, caseResults }) {
	return [
		'# Subjective L2 Cache Comparison',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact regenerates the four shader-lab subjective scenes inside the local second-order lane, then renders each captured scene packet through the CPU soft shader without second order and with second order enabled.',
		'',
		'The local Sun cases are the important L2-cache proof: their with-cache column uses the accepted local `z/rho/incomingDirection/wavelength` incident-field cache. Distant scenes are retained as visual controls and use the existing distant altitude cache when second order is enabled.',
		'',
		`Gallery: \`${packet.galleryPath}\``,
		'',
		'## Cases',
		'',
		...caseResults.flatMap((item) => [
			`- ${item.summary.label}: max RGB delta ${item.summary.diff.maxAbsRgbDelta}, mean RGB delta ${item.summary.diff.meanAbsRgbDelta.toFixed(4)}, cache \`${item.summary.cacheDiagnostics?.incidentFieldKind || 'distant/default'}\`.`,
		]),
		'',
	].join('\n');
}

function makeStateGoal({ status, summary }) {
	return [
		'# State Goal',
		'',
		'Render the four subjective source scenes from a local-lane scene generator, then build side-by-side views without second order and with second-order caching.',
		'',
		`Status: ${status}`,
		`Criteria: ${summary.pass}/${summary.total} pass, ${summary.fail} fail`,
		'',
	].join('\n');
}

async function resolveCommandPath() {
	try {
		const heartbeat = await readJson(HEARTBEAT_PATH);
		if (heartbeat.commandPath) {
			return path.resolve(heartbeat.commandPath);
		}
	} catch {
		// Fall back to the lane default.
	}
	return DEFAULT_COMMAND_PATH;
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const maxNumber = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => /^(\d+)-/.exec(entry.name)?.[1])
		.filter(Boolean)
		.map(Number)
		.reduce((max, value) => Math.max(max, value), 0);
	const name = `${String(maxNumber + 1).padStart(3, '0')}-${label}`;
	const directory = path.join(outRoot, name);
	await fs.mkdir(directory, { recursive: false });
	return {
		directory,
		relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
	};
}

async function appendRunningLog(outRoot, packet) {
	await fs.appendFile(
		path.join(outRoot, 'running-log.md'),
		[
			`- ${packet.completedAt}: ${packet.artifactFolder} ${packet.status}; ${packet.summary.pass}/${packet.summary.total} criteria passed; gallery ${packet.galleryPath}.`,
			'',
		].join('\n')
	);
}

async function writePng(filePath, width, height, pixels) {
	await sharp(Buffer.from(pixels), {
		raw: { width, height, channels: 4 },
	})
		.png()
		.toFile(filePath);
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

function summarizeCriteria(criteria) {
	return criteria.reduce(
		(summary, criterion) => {
			summary.total += 1;
			summary[criterion.status] += 1;
			return summary;
		},
		{ total: 0, pass: 0, fail: 0, unresolved: 0, 'not-applicable': 0 }
	);
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
