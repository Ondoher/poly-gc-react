import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import * as THREE from 'three';

import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';
import {
	createThreeScene,
	firstHit,
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	NUMERICAL_CONTROLS,
	objectRadianceSpectrum,
	pixelToNdc,
	renderSunCaseForScene,
	runNodeThreeReference,
	SCATTERING_ORDERS,
	SCENE_MODES,
	SPECTRA,
	SPECTRAL_CHANNELS,
	spectralToDisplayPreview,
	sunDirection,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	GEOMETRY_KINDS,
	SOURCE_KINDS,
} from './algorithm32-source-contract.js';

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
const LOCAL_OFFSETS_DEGREES = [0, 45, 90, 135, 180];

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-local-sun-soft-shader-source-matrix',
		atmosflatReference: DEFAULT_ATMOSFLAT_REFERENCE,
		width: 96,
		height: 54,
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
		} else if (arg === '--atmosflat-reference') {
			options.atmosflatReference = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--width') {
			options.width = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--height') {
			options.height = Number(argv[index + 1]);
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

	if (!options.help) {
		if (!Number.isInteger(options.width) || options.width < 32) {
			throw new Error('--width must be an integer >= 32');
		}
		if (!Number.isInteger(options.height) || options.height < 24) {
			throw new Error('--height must be an integer >= 24');
		}
		if (
			!Number.isFinite(options.sceneSkyRayLimitMeters) ||
			options.sceneSkyRayLimitMeters <= 0
		) {
			throw new Error('--scene-sky-ray-limit-meters must be positive');
		}
	}

	return options;
}

function printHelp() {
	console.log(`CPU local-Sun soft-shader source matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-local-sun-soft-shader-source-matrix.js

Options:
  --out-root <path>                    Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>                       Artifact folder label.
  --atmosflat-reference <path>         Accepted atmosflat32 source artifact.
  --width <pixels>                     Matrix image width. Default: 96.
  --height <pixels>                    Matrix image height. Default: 54.
  --scene-sky-ray-limit-meters <value> Flat no-hit sky segment limit.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runCpuLocalSunSoftShaderSourceMatrix(options);
	console.log(
		`CPU local-Sun soft-shader source matrix ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuLocalSunSoftShaderSourceMatrix(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU local-Sun soft-shader source matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const reference = await loadAtmosflatReference(options.atmosflatReference);
	const distantControl = await runDistantControl({
		artifact,
		casesRoot,
		options,
		runLog,
	});
	const localCases = [];
	for (const offsetDegrees of LOCAL_OFFSETS_DEGREES) {
		const localCase = await runLocalCase({
			artifact,
			casesRoot,
			options,
			reference,
			offsetDegrees,
			runLog,
		});
		localCases.push(localCase);
	}

	const criteria = buildAggregateCriteria({
		distantControl,
		localCases,
		reference,
		options,
	});
	const aggregateSummary = summarizeCriteria(criteria);
	const caseCriteriaSummary = summarizeCaseCriteria([
		distantControl,
		...localCases,
	]);
	const summary = {
		passed: aggregateSummary.passed + caseCriteriaSummary.passed,
		failed: aggregateSummary.failed + caseCriteriaSummary.failed,
		aggregatePassed: aggregateSummary.passed,
		aggregateFailed: aggregateSummary.failed,
		casePassed: caseCriteriaSummary.passed,
		caseFailed: caseCriteriaSummary.failed,
		caseCount: caseCriteriaSummary.caseCount,
	};
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-local-sun-soft-shader-source-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		distantControl: distantControl.resultSummary,
		localCases: localCases.map((item) => item.resultSummary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-local-sun-soft-shader-source-matrix-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			atmosflatReference: path
				.relative(REPO_ROOT, options.atmosflatReference)
				.replaceAll('\\', '/'),
		},
		localOffsetsDegrees: LOCAL_OFFSETS_DEGREES,
	});
	await writeJson(path.join(artifact.directory, 'inputs.json'), {
		kind: 'cpu-local-sun-soft-shader-source-matrix-inputs',
		sourceReference: reference.relativeDirectory,
		sourceBoundary: reference.inputs.sourceBoundary,
		atmosflatGeometry: reference.inputs.geometry,
		brightnessCalibration: reference.inputs.brightnessCalibration,
		sceneSkyRayLimit: {
			meters: options.sceneSkyRayLimitMeters,
			kilometers: options.sceneSkyRayLimitMeters / 1000,
			policy: options.sceneSkyRayLimitPolicy,
			status:
				'Renderer-owned POC no-hit sky ray length for flat scene images; configurable and not an Algorithm32 atmosphere constant.',
		},
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'cpu-local-sun-soft-shader-source-matrix-case-results',
		distantControl: distantControl.resultSummary,
		localCases: localCases.map((item) => item.resultSummary),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-local-sun-soft-shader-source-matrix-criteria',
		summary,
		aggregateCriteria: criteria,
		caseCriteria: Object.fromEntries(
			[distantControl, ...localCases].map((item) => [
				item.caseId,
				item.criteria,
			])
		),
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({ packet, criteria, distantControl, localCases, options })
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-local-sun-soft-shader-source-matrix.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
		distantControl,
		localCases,
	};
}

async function runDistantControl({ artifact, casesRoot, options, runLog }) {
	const caseRoot = path.join(casesRoot, 'distant-control');
	await fs.mkdir(caseRoot, { recursive: true });
	const originalRoot = path.join(caseRoot, 'original-renderer-run');
	await fs.mkdir(originalRoot, { recursive: true });
	const original = await runNodeThreeReference([
		'--out-root',
		originalRoot,
		'--label',
		'distant-control-original-renderer',
		'--width',
		String(options.width),
		'--height',
		String(options.height),
		'--scattering-order',
		SCATTERING_ORDERS.firstOrder,
	]);
	const sceneSetup = createThreeScene({
		width: options.width,
		height: options.height,
		sceneMode: SCENE_MODES.threeCardReference,
		scatteringOrder: SCATTERING_ORDERS.firstOrder,
		renderSunCaseOverride: null,
		surfaceLightingMode: 'emissive-radiance',
		surfaceAlbedoReferenceRadiance: 0.05,
	});
	const sunCase = renderSunCaseForScene(sceneSetup);
	const originalSelected = await readOriginalSelected(original.artifact.directory);
	const sceneInputPacket = buildCpuSceneInputPacket({
		captureId: 'distant-control',
		sceneSetup,
		sourcePacket: {
			kind: SOURCE_KINDS.distantDirectionalSun,
			sunCase: sunCase.id,
			sunDirection: sunDirection(sunCase),
			sunAltitudeDegrees: sunCase.sunAltitudeDegrees,
			sunAzimuthDegrees: sunCase.sunAzimuthDegrees,
		},
		geometryPacket: {
			kind: GEOMETRY_KINDS.sphericalAtmosphere,
			threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
			threeToAlgorithmPosition: '[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
		},
		scatteringOrder: SCATTERING_ORDERS.firstOrder,
		colorEncoding: 'rgba8-unattenuated-spectrum-preview',
		sceneColorPolicy: 'spectrum-id-reference-radiance',
		originalSelected,
		knownLimitations: [
			'CPU-synthesized distant control packet for Milestone 18.',
		],
	});
	const softShader = postprocessSceneInput(sceneInputPacket, {
		surfacePolicy: 'spectrum-id-reference-radiance',
		includeSecondOrder: false,
	});
	const result = await finishCase({
		artifact,
		caseRoot,
		caseId: 'distant-control',
		caseLabel: 'Distant Sun first-order control',
		original,
		originalSelected,
		sceneInputPacket,
		softShader,
		extraCriteria: [],
		runLog,
	});
	return {
		...result,
		resultSummary: {
			...result.resultSummary,
			offsetDegrees: null,
			sourceKind: SOURCE_KINDS.distantDirectionalSun,
		},
	};
}

async function runLocalCase({
	artifact,
	casesRoot,
	options,
	reference,
	offsetDegrees,
	runLog,
}) {
	const caseId = `local-${String(offsetDegrees).padStart(3, '0')}deg`;
	const caseRoot = path.join(casesRoot, caseId);
	await fs.mkdir(caseRoot, { recursive: true });
	const sourceConfig = sourceConfigForOffset({ reference, offsetDegrees });
	const model = createLocalModel({ options, reference, sourceConfig });
	const observerSample = model.sampleSource(sourceConfig.observerPositionMeters);
	const sunCaseOverride = sunCaseFromSourceSample({
		id: caseId,
		role: offsetDegrees === 0 ? 'closest-approach' : `${offsetDegrees}-degree-orbit-offset`,
		offsetDegrees,
		sourceSample: observerSample,
	});
	const originalRoot = path.join(caseRoot, 'original-renderer-run');
	await fs.mkdir(originalRoot, { recursive: true });
	const original = await runNodeThreeReference(
		[
			'--out-root',
			originalRoot,
			'--label',
			`${caseId}-original-renderer`,
			'--width',
			String(options.width),
			'--height',
			String(options.height),
			'--scattering-order',
			SCATTERING_ORDERS.firstOrder,
		],
		{
			algorithm32Model: model,
			sunCaseOverride,
			sourceRunLabel: sunCaseOverride.role,
		}
	);
	const originalSelected = await readOriginalSelected(original.artifact.directory);
	const sourceSampleTraces = await readJson(
		path.join(original.artifact.directory, 'source-sample-traces.json')
	);
	const transportDiagnostics = await readJson(
		path.join(original.artifact.directory, 'transport-diagnostics.json')
	);
	const sourceContract = await readJson(
		path.join(original.artifact.directory, 'source-contract.json')
	);
	const sceneSetup = createThreeScene({
		width: options.width,
		height: options.height,
		sceneMode: SCENE_MODES.threeCardReference,
		scatteringOrder: SCATTERING_ORDERS.firstOrder,
		renderSunCaseOverride: sunCaseOverride,
		surfaceLightingMode: 'emissive-radiance',
		surfaceAlbedoReferenceRadiance: 0.05,
	});
	const sceneInputPacket = buildCpuSceneInputPacket({
		captureId: caseId,
		sceneSetup,
		sourcePacket: localSourcePacket({ reference, sourceConfig, offsetDegrees }),
		geometryPacket: localGeometryPacket({ options, reference, sourceConfig }),
		scatteringOrder: SCATTERING_ORDERS.firstOrder,
		colorEncoding: 'rgba8-unattenuated-spectrum-preview',
		sceneColorPolicy: 'spectrum-id-reference-radiance',
		originalSelected,
		knownLimitations: [
			'CPU-synthesized local-source packet for Milestone 18.',
			'Local source path is first-order only; local second-order cache, visible solar disc, ground bounce, and browser point-light proxy are deferred.',
		],
	});
	const softShader = postprocessSceneInput(sceneInputPacket, {
		surfacePolicy: 'spectrum-id-reference-radiance',
		includeSecondOrder: false,
	});
	const traceSummary = summarizeLocalTrace({
		sourceSampleTraces,
		transportDiagnostics,
		softShader,
	});
	const extraCriteria = localCaseCriteria({
		sceneInputPacket,
		softShader,
		sourceContract,
		sourceSampleTraces,
		transportDiagnostics,
		traceSummary,
	});
	const result = await finishCase({
		artifact,
		caseRoot,
		caseId,
		caseLabel: `Local Sun ${offsetDegrees} deg`,
		original,
		originalSelected,
		sceneInputPacket,
		softShader,
		extraCriteria,
		runLog,
	});
	await writeJson(path.join(caseRoot, 'source-trace.json'), {
		kind: 'cpu-local-sun-soft-shader-source-trace',
		offsetDegrees,
		sourceConfig: summarizeSourceConfig(sourceConfig),
		sunCaseOverride,
		sourceContract,
		sourceSampleTraces,
		transportDiagnostics: summarizeTransportDiagnostics(transportDiagnostics),
		traceSummary,
	});

	return {
		...result,
		offsetDegrees,
		sourceConfig,
		sunCaseOverride,
		sourceSampleTraces,
		transportDiagnostics,
		traceSummary,
		resultSummary: {
			...result.resultSummary,
			offsetDegrees,
			sourceKind: SOURCE_KINDS.flatLocalPointSun,
			sourceId: sourceConfig.sceneKey,
			sourceDistanceMeters: observerSample.distanceMeters,
			incidentScale: observerSample.incidentScale,
			distanceFalloffScale: observerSample.distanceFalloffScale,
			meanObserverSourceTransmittance:
				traceSummary.observerMeanSourceTransmittance,
			postprocessSourceResolution:
				softShader.sourceContract.sourceResolution?.status ||
				softShader.sourceContract.sunCaseResolution?.status,
		},
	};
}

async function finishCase({
	artifact,
	caseRoot,
	caseId,
	caseLabel,
	original,
	originalSelected,
	sceneInputPacket,
	softShader,
	extraCriteria,
	runLog,
}) {
	const originalImagePath = path.join(original.artifact.directory, 'reference-image.png');
	const originalCopyPath = path.join(caseRoot, 'original-renderer-image.png');
	const softImagePath = path.join(caseRoot, 'soft-shader-image.png');
	const diffImagePath = path.join(caseRoot, 'diff-image.png');
	await fs.copyFile(originalImagePath, originalCopyPath);
	await writePng(
		softImagePath,
		sceneInputPacket.width,
		sceneInputPacket.height,
		softShader.pixels
	);
	const originalPixels = await readPngRgba(originalImagePath);
	const comparison = compareRgbaImages({
		a: originalPixels,
		b: {
			width: sceneInputPacket.width,
			height: sceneInputPacket.height,
			data: softShader.pixels,
		},
	});
	await writePng(
		diffImagePath,
		sceneInputPacket.width,
		sceneInputPacket.height,
		makeDiffPixels(originalPixels.data, softShader.pixels)
	);
	const selectedTransportComparison = compareSelectedTransport({
		originalSelected,
		softSelected: softShader.selectedPixels,
	});
	const criteria = buildCaseCriteria({
		original,
		sceneInputPacket,
		softShader,
		comparison,
		selectedTransportComparison,
		extraCriteria,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const resultSummary = {
		id: caseId,
		label: caseLabel,
		status,
		caseFolder: path.relative(artifact.directory, caseRoot).replaceAll('\\', '/'),
		originalRendererArtifact: path
			.relative(REPO_ROOT, original.artifact.directory)
			.replaceAll('\\', '/'),
		comparison,
		selectedTransportComparison,
		summary,
		postprocessSourceResolution:
			softShader.sourceContract.sourceResolution?.status ||
			softShader.sourceContract.sunCaseResolution?.status,
	};

	await writeJson(path.join(caseRoot, 'scene-input-packet.json'), sceneInputPacket);
	await writeJson(path.join(caseRoot, 'scene-input-summary.json'), {
		kind: 'cpu-local-sun-soft-shader-scene-input-summary',
		...summarizeSceneInputPacket(sceneInputPacket),
		postprocessSourceContract: softShader.sourceContract,
	});
	await writeJson(path.join(caseRoot, 'selected-pixels.json'), {
		kind: 'cpu-local-sun-soft-shader-selected-pixels',
		original: originalSelected,
		softShader: softShader.selectedPixels,
		selectedTransportComparison,
	});
	await writeJson(path.join(caseRoot, 'image-comparison.json'), comparison);
	await writeJson(path.join(caseRoot, 'criteria-results.json'), {
		kind: 'cpu-local-sun-soft-shader-case-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(caseRoot, 'result.json'), {
		kind: 'cpu-local-sun-soft-shader-case-result',
		...resultSummary,
	});
	await writeText(
		path.join(caseRoot, 'report.md'),
		makeCaseReport({ caseLabel, resultSummary, sceneInputPacket })
	);
	log(
		runLog,
		`${caseId} ${status}: original ${path.relative(REPO_ROOT, original.artifact.directory).replaceAll('\\', '/')}.`
	);

	return {
		caseId,
		status,
		summary,
		resultSummary,
		criteria,
		comparison,
		selectedTransportComparison,
		softShader,
		sceneInputPacket,
	};
}

function buildCpuSceneInputPacket({
	captureId,
	sceneSetup,
	sourcePacket,
	geometryPacket,
	scatteringOrder,
	colorEncoding,
	sceneColorPolicy,
	originalSelected,
	knownLimitations,
}) {
	const { width, height, camera, meshes } = sceneSetup;
	const raycaster = new THREE.Raycaster();
	const sceneColorRgba8 = [];
	const hitDistanceMeters = new Array(width * height);
	const hitMask = new Array(width * height);
	const spectrumNumericIds = new Array(width * height);
	const rayDirections = new Array(width * height * 3);
	const classificationIds = new Array(width * height);
	const selectedCoordinates = selectedCoordinatesForPacket({
		width,
		height,
		originalSelected,
	});
	const selectedPixels = [];
	const spectrumMap = new SpectrumNumericMap();
	const countsBySpectrumId = new Map();
	const countsByClassification = new Map();
	let skyPixels = 0;
	let hitPixels = 0;
	let minHitDistanceMeters = Number.POSITIVE_INFINITY;
	let maxHitDistanceMeters = 0;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = y * width + x;
			const directionOffset = pixelIndex * 3;
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const ray = raycaster.ray.clone();
			const hit = firstHit(raycaster, meshes);
			rayDirections[directionOffset] = ray.direction.x;
			rayDirections[directionOffset + 1] = ray.direction.y;
			rayDirections[directionOffset + 2] = ray.direction.z;

			if (hit) {
				const spectrumId = hit.object.userData?.spectrumId || 'black';
				const numericSpectrumId = spectrumMap.idForSpectrum(spectrumId);
				const classification = hit.object.userData?.kind || 'object';
				const encodedRgb = unattenuatedSpectrumPreview(spectrumId);
				sceneColorRgba8.push(encodedRgb[0], encodedRgb[1], encodedRgb[2], 255);
				hitDistanceMeters[pixelIndex] = hit.distance;
				hitMask[pixelIndex] = 1;
				spectrumNumericIds[pixelIndex] = numericSpectrumId;
				classificationIds[pixelIndex] = classification;
				hitPixels += 1;
				minHitDistanceMeters = Math.min(minHitDistanceMeters, hit.distance);
				maxHitDistanceMeters = Math.max(maxHitDistanceMeters, hit.distance);
				incrementMap(countsBySpectrumId, numericSpectrumId);
				incrementMap(countsByClassification, classification);
			} else {
				sceneColorRgba8.push(0, 0, 0, 255);
				hitDistanceMeters[pixelIndex] = -1;
				hitMask[pixelIndex] = 0;
				spectrumNumericIds[pixelIndex] = 0;
				classificationIds[pixelIndex] = 'sky';
				skyPixels += 1;
			}

			const selectedId = selectedCoordinates.get(`${x},${y}`);
			if (selectedId) {
				selectedPixels.push(
					makeSceneInputSample({
						id: selectedId,
						x,
						y,
						ndc,
						ray,
						hit,
						sceneColorRgba8,
						pixelIndex,
						spectrumNumericIds,
						classificationIds,
					})
				);
			}
		}
	}

	ensureSelectedCoverage({
		selectedPixels,
		width,
		height,
		camera,
		meshes,
		sceneColorRgba8,
	});

	return {
		kind: 'algorithm32-cpu-soft-shader-scene-input-packet',
		version: 2,
		captureId,
		sceneMode: sceneSetup.sceneMode,
		sceneColorPolicy,
		width,
		height,
		rowOrder: 'top-left-row-major',
		colorEncoding,
		distanceUnits: 'meters',
		hitMaskMeaning: '1 = raycaster hit, 0 = sky/no-hit',
		scatteringOrder,
		includeSecondOrder: false,
		camera: {
			type: 'THREE.PerspectiveCamera',
			positionMeters: vectorToArray(camera.position),
			verticalFovDegrees: camera.fov,
			aspect: camera.aspect,
			near: camera.near,
			far: camera.far,
			projectionMatrix: camera.projectionMatrix.toArray(),
			matrixWorld: camera.matrixWorld.toArray(),
		},
		source: sourcePacket,
		geometry: geometryPacket,
		sceneObjects: sceneObjectsForPacket(sceneSetup),
		spectrumNumericIdMap: spectrumMap.toPacketMap(),
		sceneColorRgba8,
		hitDistanceMeters,
		hitMask,
		spectrumNumericIds,
		rayDirections,
		classificationIds,
		counts: {
			skyPixels,
			hitPixels,
			bySpectrumNumericId: Object.fromEntries(
				[...countsBySpectrumId.entries()].sort((a, b) => a[0] - b[0])
			),
			byClassification: Object.fromEntries(
				[...countsByClassification.entries()].sort((a, b) =>
					String(a[0]).localeCompare(String(b[0]))
				)
			),
		},
		hitDistanceMetersSummary: {
			min: Number.isFinite(minHitDistanceMeters) ? minHitDistanceMeters : null,
			max: maxHitDistanceMeters || null,
		},
		selectedPixels: dedupeSamples(selectedPixels),
		knownLimitations,
	};
}

function loadAtmosflatReferencePath(referenceDirectory) {
	return path.resolve(referenceDirectory);
}

async function loadAtmosflatReference(referenceDirectory) {
	const directory = loadAtmosflatReferencePath(referenceDirectory);
	const inputs = await readJson(path.join(directory, 'inputs.json'));
	return {
		directory,
		relativeDirectory: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
		inputs,
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

function createLocalModel({ options, reference, sourceConfig }) {
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters:
			reference.inputs.geometry.atmosphereGeometry.atmosphereTopAltitudeMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
	});
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
		provenance: localSourceProvenance({ reference, sourceConfig }),
	});
	return createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: {
			kind: 'algorithm32-15-channel-profile',
			channels: SPECTRAL_CHANNELS.map((channel) => ({
				wavelengthNanometers: channel.wavelengthNanometers,
				solarIrradiance: channel.solarIrradiance,
			})),
		},
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			localSourceMode: 'soft-shader-source-matrix',
			localSecondOrder: 'deferred',
		},
	});
}

function localSourcePacket({ reference, sourceConfig, offsetDegrees }) {
	return {
		kind: SOURCE_KINDS.flatLocalPointSun,
		id: sourceConfig.sceneKey,
		sunCase: sourceConfig.sceneKey,
		sceneKey: sourceConfig.sceneKey,
		flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
		offsetDegrees,
		role: offsetDegrees === 0 ? 'closest-approach' : `${offsetDegrees}-degree-orbit-offset`,
		positionMeters: sourceConfig.positionMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		referenceSpectralIncidentScale:
			sourceConfig.referenceSpectralIncidentScale,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		color: sourceConfig.color,
		provenance: localSourceProvenance({ reference, sourceConfig }),
	};
}

function localGeometryPacket({ options, reference, sourceConfig }) {
	return {
		kind: GEOMETRY_KINDS.flatZUpAtmosphere,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		topAltitudeMeters:
			reference.inputs.geometry.atmosphereGeometry.atmosphereTopAltitudeMeters,
		sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
		threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
		threeToAlgorithmPosition: '[x, y, z] -> [x, -z, y]',
	};
}

function localSourceProvenance({ reference, sourceConfig }) {
	return {
		sourceArtifact: reference.relativeDirectory,
		flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
		appSolarIrradianceScale:
			sourceConfig.flatSourceConfig.solarIrradianceScale,
		calibratedSolarIrradianceScale: sourceConfig.solarIrradianceScale,
		brightnessCalibration: sourceConfig.brightnessCalibration,
	};
}

function sunCaseFromSourceSample({ id, role, offsetDegrees, sourceSample }) {
	const direction = sourceSample.direction;
	return {
		id,
		role,
		sourceKind: SOURCE_KINDS.flatLocalPointSun,
		offsetDegrees,
		sunAltitudeDegrees: radiansToDegrees(Math.asin(direction[2])),
		sunAzimuthDegrees: radiansToDegrees(Math.atan2(direction[1], direction[0])),
		sunDirection: direction,
		sourceDistanceMeters: sourceSample.distanceMeters,
		incidentScale: sourceSample.incidentScale,
	};
}

function localCaseCriteria({
	sceneInputPacket,
	softShader,
	sourceContract,
	sourceSampleTraces,
	transportDiagnostics,
	traceSummary,
}) {
	return [
		{
			id: 'flat-local-source-packet-active',
			status:
				sceneInputPacket.source.kind === SOURCE_KINDS.flatLocalPointSun &&
				sceneInputPacket.geometry.kind === GEOMETRY_KINDS.flatZUpAtmosphere &&
				softShader.sourceContract.source.kind === SOURCE_KINDS.flatLocalPointSun &&
				softShader.sourceContract.geometry.kind === GEOMETRY_KINDS.flatZUpAtmosphere &&
				sourceContract.source.kind === SOURCE_KINDS.flatLocalPointSun
					? 'passed'
					: 'failed',
			measured: {
				packetSourceKind: sceneInputPacket.source.kind,
				packetGeometryKind: sceneInputPacket.geometry.kind,
				postprocessSourceKind: softShader.sourceContract.source.kind,
				postprocessGeometryKind: softShader.sourceContract.geometry.kind,
				originalSourceKind: sourceContract.source.kind,
			},
		},
		{
			id: 'postprocessor-resolved-local-source-from-packet',
			status:
				softShader.sourceContract.sourceResolution?.status ===
					'packet-supplied-flat-local-point-sun' ||
				softShader.sourceContract.sunCaseResolution?.status ===
					'packet-supplied-flat-local-point-sun'
					? 'passed'
					: 'failed',
			measured: {
				sourceResolution: softShader.sourceContract.sourceResolution,
				sunCaseResolution: softShader.sourceContract.sunCaseResolution,
			},
		},
		{
			id: 'finite-source-sample-traces',
			status:
				sourceSampleTraces.samples.every(
					(sample) =>
						sample.sourceSample.kind === SOURCE_KINDS.flatLocalPointSun &&
						sample.sourceSample.distanceKind === 'finite' &&
						Number.isFinite(sample.sourceSample.distanceMeters) &&
						sample.sourceSample.distanceMeters > 0 &&
						Number.isFinite(sample.sourceSample.incidentScale) &&
						Number.isFinite(sample.meanSourceTransmittance)
				) && traceSummary.transportSamplesHaveFiniteSource
					? 'passed'
					: 'failed',
			measured: {
				sourceTraceSampleCount: sourceSampleTraces.samples.length,
				transportSampleCount: transportDiagnostics.samplePackets.length,
				traceSummary,
			},
		},
		{
			id: 'local-source-first-order-only',
			status:
				softShader.includeSecondOrder === false &&
				softShader.cacheDiagnostics.incidentSkyCacheEntries === 0 &&
				traceSummary.maxSecondOrderPathRadiance === 0
					? 'passed'
					: 'failed',
			measured: {
				includeSecondOrder: softShader.includeSecondOrder,
				cacheDiagnostics: softShader.cacheDiagnostics,
				maxSecondOrderPathRadiance: traceSummary.maxSecondOrderPathRadiance,
			},
		},
	];
}

function buildCaseCriteria({
	original,
	sceneInputPacket,
	softShader,
	comparison,
	selectedTransportComparison,
	extraCriteria,
}) {
	return [
		{
			id: 'original-renderer-case-accepted',
			status: original.packet.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				status: original.packet.status,
				summary: original.summary,
			},
		},
		{
			id: 'soft-shader-image-exact-parity',
			status:
				comparison.maxAbsRgbDelta === 0 &&
				comparison.meanAbsRgbDelta === 0 &&
				comparison.p99PixelMaxAbsRgbDelta === 0
					? 'passed'
					: 'failed',
			measured: comparison,
		},
		{
			id: 'selected-transport-diagnostics-parity',
			status:
				selectedTransportComparison.missingSamples === 0 &&
				selectedTransportComparison.comparedSamples > 0 &&
				selectedTransportComparison.maxTransferDelta <=
					selectedTransportComparison.tolerance
					? 'passed'
					: 'failed',
			measured: selectedTransportComparison,
		},
		{
			id: 'sky-and-hit-coverage',
			status:
				sceneInputPacket.counts.skyPixels > 0 &&
				sceneInputPacket.counts.hitPixels > 0 &&
				softShader.selectedPixels.some((sample) => !sample.hit) &&
				softShader.selectedPixels.some((sample) => sample.hit)
					? 'passed'
					: 'failed',
			measured: {
				counts: sceneInputPacket.counts,
				selectedPixels: softShader.selectedPixels.map((sample) => ({
					id: sample.id,
					hit: sample.hit,
					hitDistanceMeters: sample.hitDistanceMeters,
				})),
			},
		},
		{
			id: 'postprocess-finite-rgba',
			status:
				softShader.finiteChecks.nonfinitePixels === 0 &&
				softShader.finiteChecks.minByte >= 0 &&
				softShader.finiteChecks.maxByte <= 255
					? 'passed'
					: 'failed',
			measured: softShader.finiteChecks,
		},
		...extraCriteria,
	];
}

function buildAggregateCriteria({ distantControl, localCases, reference, options }) {
	const localOffsets = localCases.map((item) => item.offsetDegrees);
	const localDistances = localCases.map(
		(item) => item.resultSummary.sourceDistanceMeters
	);
	const localIncidentScales = localCases.map(
		(item) => item.resultSummary.incidentScale
	);
	const meanSkyRadiance = localCases.map(
		(item) => item.traceSummary.maxMeanPathRadiance
	);
	return [
		{
			id: 'distant-control-exact-soft-shader-parity',
			status:
				distantControl.status === 'accepted' &&
				distantControl.comparison.maxAbsRgbDelta === 0
					? 'passed'
					: 'failed',
			measured: distantControl.resultSummary,
		},
		{
			id: 'local-orbit-offset-matrix-covered',
			status: arraysEqual(localOffsets, LOCAL_OFFSETS_DEGREES)
				? 'passed'
				: 'failed',
			measured: {
				expected: LOCAL_OFFSETS_DEGREES,
				actual: localOffsets,
			},
		},
		{
			id: 'all-local-cases-accepted',
			status: localCases.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: Object.fromEntries(
				localCases.map((item) => [item.caseId, item.summary])
			),
		},
		{
			id: 'local-source-distance-increases-with-orbit-offset',
			status: strictlyIncreasing(localDistances) ? 'passed' : 'failed',
			measured: Object.fromEntries(
				localCases.map((item) => [
					String(item.offsetDegrees),
					item.resultSummary.sourceDistanceMeters,
				])
			),
		},
		{
			id: 'local-incident-scale-decreases-with-orbit-offset',
			status: strictlyDecreasing(localIncidentScales) ? 'passed' : 'failed',
			measured: Object.fromEntries(
				localCases.map((item) => [
					String(item.offsetDegrees),
					item.resultSummary.incidentScale,
				])
			),
		},
		{
			id: 'local-source-traces-change-with-orbit-offset',
			status:
				range(localDistances) > 1000000 &&
				range(localIncidentScales) > 0.1 &&
				range(meanSkyRadiance) > 0
					? 'passed'
					: 'failed',
			measured: {
				distanceRangeMeters: range(localDistances),
				incidentScaleRange: range(localIncidentScales),
				maxMeanPathRadianceRange: range(meanSkyRadiance),
			},
		},
		{
			id: 'flat-scene-sky-ray-limit-policy-recorded',
			status: 'passed',
			measured: {
				sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
				sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
				sourceReference: reference.relativeDirectory,
			},
		},
	];
}

function summarizeLocalTrace({
	sourceSampleTraces,
	transportDiagnostics,
	softShader,
}) {
	const observer = sourceSampleTraces.samples.find(
		(sample) => sample.id === 'observer'
	);
	const transportSamples = transportDiagnostics.samplePackets || [];
	const sourceDistances = transportSamples
		.map((packet) => packet.sourceSampleAtRayOrigin?.distanceMeters)
		.filter(Number.isFinite);
	const incidentScales = transportSamples
		.map((packet) => packet.sourceSampleAtRayOrigin?.incidentScale)
		.filter(Number.isFinite);
	const maxSecondOrderPathRadiance = Math.max(
		0,
		...softShader.selectedPixels.flatMap((sample) =>
			sample.transfer.secondOrderPathRadianceByWavelength || [0]
		)
	);
	const maxMeanPathRadiance = Math.max(
		0,
		...softShader.selectedPixels.map(
			(sample) => sample.transfer.meanPathRadiance || 0
		)
	);
	return {
		observerDistanceMeters: observer?.sourceSample?.distanceMeters || null,
		observerIncidentScale: observer?.sourceSample?.incidentScale || null,
		observerDistanceFalloffScale:
			observer?.sourceSample?.distanceFalloffScale || null,
		observerMeanSourceTransmittance: observer?.meanSourceTransmittance || null,
		transportSamplesHaveFiniteSource: transportSamples.every(
			(packet) =>
				packet.sourceSampleAtRayOrigin?.kind === SOURCE_KINDS.flatLocalPointSun &&
				packet.sourceSampleAtRayOrigin?.distanceKind === 'finite' &&
				Number.isFinite(packet.sourceSampleAtRayOrigin?.distanceMeters) &&
				Number.isFinite(packet.sourceSampleAtRayOrigin?.incidentScale)
		),
		minTransportSourceDistanceMeters: sourceDistances.length
			? Math.min(...sourceDistances)
			: null,
		maxTransportSourceDistanceMeters: sourceDistances.length
			? Math.max(...sourceDistances)
			: null,
		minTransportIncidentScale: incidentScales.length
			? Math.min(...incidentScales)
			: null,
		maxTransportIncidentScale: incidentScales.length
			? Math.max(...incidentScales)
			: null,
		maxSecondOrderPathRadiance,
		maxMeanPathRadiance,
	};
}

function summarizeTransportDiagnostics(transportDiagnostics) {
	return {
		sourceKind: transportDiagnostics.sourceKind,
		geometryKind: transportDiagnostics.geometryKind,
		sampleCount: transportDiagnostics.samplePackets.length,
		samplePackets: transportDiagnostics.samplePackets.map((packet) => ({
			sampleId: packet.sampleId,
			classification: packet.classification,
			hitObject: packet.hitObject,
			sourceSampleAtRayOrigin: packet.sourceSampleAtRayOrigin,
			meanPathRadiance: packet.transfer.meanPathRadiance,
			meanTransmittance: packet.transfer.meanTransmittance,
		})),
		cacheDiagnostics: transportDiagnostics.cacheDiagnostics,
	};
}

function summarizeSourceConfig(sourceConfig) {
	return {
		sceneKey: sourceConfig.sceneKey,
		flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
		positionMeters: sourceConfig.positionMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		observerDistanceKm: sourceConfig.observerDistanceKm,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		referenceSpectralIncidentScale:
			sourceConfig.referenceSpectralIncidentScale,
		calibratedSolarIrradianceScale: sourceConfig.solarIrradianceScale,
		rawAppSolarIrradianceScale:
			sourceConfig.flatSourceConfig.solarIrradianceScale,
		brightnessCalibration: sourceConfig.brightnessCalibration,
	};
}

function selectedCoordinatesForPacket({ width, height, originalSelected }) {
	const coordinates = new Map();
	for (let index = 0; index < originalSelected.length; index += 1) {
		const sample = originalSelected[index];
		if (Number.isInteger(sample.x) && Number.isInteger(sample.y)) {
			coordinates.set(`${sample.x},${sample.y}`, `original-selected-${index}`);
		}
	}
	setCoordinateIfAbsent(
		coordinates,
		Math.floor(width * 0.5),
		Math.floor(height * 0.16),
		'upper-sky'
	);
	setCoordinateIfAbsent(
		coordinates,
		Math.floor(width * 0.5),
		Math.floor(height * 0.5),
		'center'
	);
	setCoordinateIfAbsent(
		coordinates,
		Math.floor(width * 0.5),
		Math.floor(height * 0.78),
		'lower-center'
	);
	return coordinates;
}

function setCoordinateIfAbsent(coordinates, x, y, id) {
	const key = `${x},${y}`;
	if (!coordinates.has(key)) {
		coordinates.set(key, id);
	}
}

function ensureSelectedCoverage({
	selectedPixels,
	width,
	height,
	camera,
	meshes,
	sceneColorRgba8,
}) {
	const hasSky = selectedPixels.some((sample) => !sample.hit);
	const hasHit = selectedPixels.some((sample) => sample.hit);
	if (hasSky && hasHit) {
		return;
	}
	const raycaster = new THREE.Raycaster();
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const ndc = pixelToNdc(x, y, width, height);
			raycaster.setFromCamera(ndc, camera);
			const ray = raycaster.ray.clone();
			const hit = firstHit(raycaster, meshes);
			if ((!hasSky && !hit) || (!hasHit && hit)) {
				selectedPixels.push(
					makeSceneInputSample({
						id: hit ? 'first-hit-coverage' : 'first-sky-coverage',
						x,
						y,
						ndc,
						ray,
						hit,
						sceneColorRgba8,
						pixelIndex: y * width + x,
					})
				);
				return ensureSelectedCoverage({
					selectedPixels,
					width,
					height,
					camera,
					meshes,
					sceneColorRgba8,
				});
			}
		}
	}
}

function makeSceneInputSample({
	id,
	x,
	y,
	ndc,
	ray,
	hit,
	sceneColorRgba8,
	pixelIndex,
}) {
	const offset = pixelIndex * 4;
	return {
		id,
		x,
		y,
		ndc,
		hit: Boolean(hit),
		hitObject: hit?.object?.name || null,
		hitKind: hit?.object?.userData?.kind || null,
		spectrumId: hit?.object?.userData?.spectrumId || null,
		hitDistanceMeters: hit?.distance || null,
		sceneColorRgba8: sceneColorRgba8.slice(offset, offset + 4),
		threeRay: {
			origin: vectorToArray(ray.origin),
			direction: vectorToArray(ray.direction),
		},
	};
}

function compareSelectedTransport({ originalSelected, softSelected }) {
	const softById = new Map(softSelected.map((sample) => [sample.id, sample]));
	let maxTransferDelta = 0;
	let comparedSamples = 0;
	let missingSamples = 0;
	const matches = [];
	for (let index = 0; index < originalSelected.length; index += 1) {
		const original = originalSelected[index];
		const id = `original-selected-${index}`;
		const soft = softById.get(id);
		if (!soft) {
			missingSamples += 1;
			matches.push({ id, status: 'missing-soft-sample' });
			continue;
		}
		const delta = maxTransferDeltaForPair(original.transfer, soft.transfer);
		maxTransferDelta = Math.max(maxTransferDelta, delta);
		comparedSamples += 1;
		matches.push({
			id,
			status: delta <= 1e-10 ? 'matched' : 'delta',
			x: original.x,
			y: original.y,
			hitObject: original.hitObject,
			maxTransferDelta: delta,
		});
	}
	return {
		comparedSamples,
		missingSamples,
		maxTransferDelta,
		tolerance: 1e-10,
		matches,
	};
}

function maxTransferDeltaForPair(originalTransfer, softTransfer) {
	if (!originalTransfer || !softTransfer) {
		return Number.POSITIVE_INFINITY;
	}
	const fields = [
		'opticalDepthByWavelength',
		'transmittanceByWavelength',
		'pathRadianceByWavelength',
		'firstOrderPathRadianceByWavelength',
		'secondOrderPathRadianceByWavelength',
	];
	let maxDelta = 0;
	for (const field of fields) {
		maxDelta = Math.max(
			maxDelta,
			maxArrayDelta(originalTransfer[field] || [], softTransfer[field] || [])
		);
	}
	return maxDelta;
}

function unattenuatedSpectrumPreview(spectrumId) {
	const spectrum = SPECTRA[spectrumId] || SPECTRA.black;
	return spectralToDisplayPreview(objectRadianceSpectrum(spectrum)).encodedRgb;
}

function sceneObjectsForPacket(sceneSetup) {
	return sceneSetup.meshes.map((mesh) => ({
		id: mesh.name,
		kind: mesh.userData?.kind || 'object',
		spectrumId: mesh.userData?.spectrumId || null,
		positionMeters: vectorToArray(mesh.position),
	}));
}

class SpectrumNumericMap {
	constructor() {
		this.map = new Map([[null, 0]]);
		this.nextId = 1;
	}

	idForSpectrum(spectrumId) {
		const key = spectrumId || null;
		if (!this.map.has(key)) {
			this.map.set(key, this.nextId);
			this.nextId += 1;
		}
		return this.map.get(key);
	}

	toPacketMap() {
		return Object.fromEntries(
			[...this.map.entries()]
				.map(([spectrumId, numericId]) => [numericId, spectrumId])
				.sort((a, b) => a[0] - b[0])
		);
	}
}

function summarizeSceneInputPacket(packet) {
	return {
		kind: packet.kind,
		version: packet.version,
		captureId: packet.captureId,
		sceneMode: packet.sceneMode,
		sceneColorPolicy: packet.sceneColorPolicy,
		width: packet.width,
		height: packet.height,
		rowOrder: packet.rowOrder,
		colorEncoding: packet.colorEncoding,
		source: packet.source,
		geometry: packet.geometry,
		counts: packet.counts,
		hitDistanceMetersSummary: packet.hitDistanceMetersSummary,
		selectedPixels: packet.selectedPixels,
		knownLimitations: packet.knownLimitations,
	};
}

function makeReport({ packet, criteria, distantControl, localCases, options }) {
	return [
		'# CPU Local-Sun Soft-Shader Source Matrix',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Validate packet-driven local flat-Sun source handling in the CPU soft-shader postprocessor before browser shader implementation.',
		'',
		'## Summary',
		'',
		`- Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		`- Distant control: ${distantControl.status}, max RGB delta ${distantControl.comparison.maxAbsRgbDelta}.`,
		`- Local offsets: ${localCases.map((item) => item.offsetDegrees).join(', ')} degrees.`,
		`- Flat sky ray limit: ${options.sceneSkyRayLimitMeters} m.`,
		'',
		'## Criteria',
		'',
		...criteria.map((criterion) => `- ${criterion.id}: ${criterion.status}.`),
		'',
		'## Local Cases',
		'',
		...localCases.map(
			(item) =>
				`- ${item.caseId}: ${item.status}, distance ${(item.resultSummary.sourceDistanceMeters / 1000).toFixed(3)} km, incident scale ${item.resultSummary.incidentScale}.`
		),
		'',
		'## Limits',
		'',
		'- This milestone uses CPU-synthesized scene packets and unlit/material radiance to isolate local atmospheric transport.',
		'- Local second-order cache, visible solar disc radiance, ground bounce, browser point-light proxy, and shader packing remain deferred.',
		'',
	].join('\n');
}

function makeCaseReport({ caseLabel, resultSummary, sceneInputPacket }) {
	return [
		`# ${caseLabel}`,
		'',
		`Status: ${resultSummary.status}`,
		'',
		`- Source kind: ${sceneInputPacket.source.kind}.`,
		`- Geometry kind: ${sceneInputPacket.geometry.kind}.`,
		`- Max RGB delta: ${resultSummary.comparison.maxAbsRgbDelta}.`,
		`- Selected transfer max delta: ${resultSummary.selectedTransportComparison.maxTransferDelta}.`,
		'',
	].join('\n');
}

async function readOriginalSelected(directory) {
	const selected = await readJson(path.join(directory, 'selected-pixels.json'));
	return selected.selectedPixelDiagnostics || selected.selectedPixels || [];
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

async function readPngRgba(filePath) {
	const { data, info } = await sharp(filePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return {
		width: info.width,
		height: info.height,
		data,
	};
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

function compareRgbaImages({ a, b }) {
	if (a.width !== b.width || a.height !== b.height) {
		throw new Error('Image dimensions do not match.');
	}
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	const pixelMaxDeltas = [];
	for (let index = 0; index < a.data.length; index += 4) {
		let pixelMax = 0;
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Math.abs(a.data[index + channel] - b.data[index + channel]);
			maxAbsRgbDelta = Math.max(maxAbsRgbDelta, delta);
			sumAbsRgbDelta += delta;
			pixelMax = Math.max(pixelMax, delta);
		}
		pixelMaxDeltas.push(pixelMax);
	}
	pixelMaxDeltas.sort((left, right) => left - right);
	return {
		width: a.width,
		height: a.height,
		pixels: a.width * a.height,
		maxAbsRgbDelta,
		meanAbsRgbDelta: sumAbsRgbDelta / (a.width * a.height * 3),
		p95PixelMaxAbsRgbDelta: percentile(pixelMaxDeltas, 0.95),
		p99PixelMaxAbsRgbDelta: percentile(pixelMaxDeltas, 0.99),
	};
}

function makeDiffPixels(a, b) {
	const diff = Buffer.alloc(a.length);
	for (let index = 0; index < a.length; index += 4) {
		for (let channel = 0; channel < 3; channel += 1) {
			diff[index + channel] = Math.min(
				255,
				Math.abs(a[index + channel] - b[index + channel]) * 8
			);
		}
		diff[index + 3] = 255;
	}
	return diff;
}

function percentile(sortedValues, percentileValue) {
	if (sortedValues.length === 0) {
		return 0;
	}
	const index = Math.min(
		sortedValues.length - 1,
		Math.floor(sortedValues.length * percentileValue)
	);
	return sortedValues[index];
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function summarizeCaseCriteria(cases) {
	return {
		passed: cases.reduce((sum, item) => sum + item.summary.passed, 0),
		failed: cases.reduce((sum, item) => sum + item.summary.failed, 0),
		caseCount: cases.length,
	};
}

function dedupeSamples(samples) {
	const byKey = new Map();
	for (const sample of samples) {
		byKey.set(`${sample.x},${sample.y},${sample.id}`, sample);
	}
	return [...byKey.values()];
}

function vectorToArray(vector) {
	return [vector.x, vector.y, vector.z];
}

function incrementMap(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function maxArrayDelta(a, b) {
	const length = Math.max(a.length, b.length);
	let maxDelta = 0;
	for (let index = 0; index < length; index += 1) {
		maxDelta = Math.max(maxDelta, Math.abs((a[index] || 0) - (b[index] || 0)));
	}
	return maxDelta;
}

function arraysEqual(a, b) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function strictlyIncreasing(values) {
	return values.every((value, index) => index === 0 || value > values[index - 1]);
}

function strictlyDecreasing(values) {
	return values.every((value, index) => index === 0 || value < values[index - 1]);
}

function range(values) {
	const finite = values.filter(Number.isFinite);
	return finite.length ? Math.max(...finite) - Math.min(...finite) : 0;
}

function radiansToDegrees(value) {
	return (value * 180) / Math.PI;
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

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
