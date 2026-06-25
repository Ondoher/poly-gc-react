import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import * as THREE from 'three';

import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';
import {
	createThreeScene,
	firstHit,
	objectRadianceSpectrum,
	pixelToNdc,
	renderSunCaseForScene,
	runNodeThreeReference,
	SCATTERING_ORDERS,
	SCENE_MODES,
	SPECTRA,
	spectralToDisplayPreview,
	sunDirection,
} from './node-three-reference.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);

const MATRIX_CASES = [
	{
		id: 'simple-card-algorithm32',
		label: 'Simple Card Full Algorithm32',
		sceneMode: SCENE_MODES.threeCardReference,
		scatteringOrder: SCATTERING_ORDERS.algorithm32,
	},
	{
		id: 'simple-card-first-order',
		label: 'Simple Card First Order',
		sceneMode: SCENE_MODES.threeCardReference,
		scatteringOrder: SCATTERING_ORDERS.firstOrder,
	},
	{
		id: 'sunset-floor-algorithm32',
		label: 'Sunset Floor Full Algorithm32',
		sceneMode: SCENE_MODES.sunsetFloor,
		sunsetFraming: 'balanced',
		scatteringOrder: SCATTERING_ORDERS.algorithm32,
	},
];

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-soft-shader-unlit-parity-matrix',
		width: 96,
		height: 54,
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
		} else if (arg === '--width') {
			options.width = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--height') {
			options.height = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.help) {
		if (!Number.isInteger(options.width) || options.width < 16) {
			throw new Error('--width must be an integer >= 16');
		}
		if (!Number.isInteger(options.height) || options.height < 16) {
			throw new Error('--height must be an integer >= 16');
		}
	}

	return options;
}

function printHelp() {
	console.log(`CPU soft-shader unlit parity matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-soft-shader-unlit-parity-matrix.js

Options:
  --out-root <path>  Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>    Artifact folder label.
  --width <pixels>  Matrix image width. Default: 96.
  --height <pixels> Matrix image height. Default: 54.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const result = await runCpuSoftShaderUnlitParityMatrix(options);
	console.log(
		`CPU soft-shader unlit parity matrix ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuSoftShaderUnlitParityMatrix(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU soft-shader unlit parity matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });

	const caseResults = [];
	for (const caseConfig of MATRIX_CASES) {
		log(runLog, `Running case ${caseConfig.id}.`);
		const caseResult = await runMatrixCase({
			artifact,
			casesRoot,
			caseConfig,
			options,
			runLog,
		});
		caseResults.push(caseResult);
		log(
			runLog,
			`Case ${caseConfig.id} ${caseResult.status}: ${caseResult.summary.passed} passed, ${caseResult.summary.failed} failed.`
		);
	}

	const criteria = buildAggregateCriteria(caseResults);
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-soft-shader-unlit-parity-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		cases: caseResults.map((caseResult) => caseResult.resultSummary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
		},
		cases: MATRIX_CASES,
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-case-results',
		cases: caseResults.map((caseResult) => caseResult.resultSummary),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeAggregateReport({ packet, caseResults })
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-soft-shader-unlit-parity-matrix.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
		caseResults,
	};
}

async function runMatrixCase({ artifact, casesRoot, caseConfig, options, runLog }) {
	const caseRoot = path.join(casesRoot, caseConfig.id);
	await fs.mkdir(caseRoot, { recursive: true });

	const originalRoot = path.join(caseRoot, 'original-renderer-run');
	await fs.mkdir(originalRoot, { recursive: true });
	const referenceArgs = [
		'--out-root',
		originalRoot,
		'--width',
		String(options.width),
		'--height',
		String(options.height),
		'--label',
		`${caseConfig.id}-original-renderer`,
		'--scattering-order',
		caseConfig.scatteringOrder,
	];
	if (caseConfig.sceneMode !== SCENE_MODES.threeCardReference) {
		referenceArgs.push('--scene', caseConfig.sceneMode);
	}
	if (caseConfig.sunsetFraming) {
		referenceArgs.push('--sunset-framing', caseConfig.sunsetFraming);
	}

	const original = await runNodeThreeReference(referenceArgs);
	const originalImagePath = path.join(original.artifact.directory, 'reference-image.png');
	const originalSelectedPath = path.join(
		original.artifact.directory,
		'selected-pixels.json'
	);
	const originalSelected = await readJson(originalSelectedPath);
	const sceneOptions = {
		width: options.width,
		height: options.height,
		sceneMode: caseConfig.sceneMode,
		sunsetFraming: caseConfig.sunsetFraming || 'balanced',
		mountainView: 'front-high-sun',
		scatteringOrder: caseConfig.scatteringOrder,
		renderSunCaseOverride: null,
		surfaceLightingMode: 'emissive-radiance',
		surfaceAlbedoReferenceRadiance: 0.05,
	};
	const sceneSetup = createThreeScene(sceneOptions);
	const sunCase = renderSunCaseForScene(sceneSetup);
	const sceneInputPacket = buildCpuUnlitSceneInputPacket({
		caseConfig,
		sceneSetup,
		sunCase,
		originalSelected:
			originalSelected.selectedPixelDiagnostics ||
			originalSelected.selectedPixels ||
			[],
	});
	const includeSecondOrder =
		caseConfig.scatteringOrder !== SCATTERING_ORDERS.firstOrder;
	const softShader = postprocessSceneInput(sceneInputPacket, {
		surfacePolicy: 'spectrum-id-reference-radiance',
		includeSecondOrder,
	});

	const softImagePath = path.join(caseRoot, 'soft-shader-image.png');
	const originalCopyPath = path.join(caseRoot, 'original-renderer-image.png');
	const diffImagePath = path.join(caseRoot, 'diff-image.png');
	await writePng(
		softImagePath,
		sceneInputPacket.width,
		sceneInputPacket.height,
		softShader.pixels
	);
	await fs.copyFile(originalImagePath, originalCopyPath);
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
		originalSelected:
			originalSelected.selectedPixelDiagnostics ||
			originalSelected.selectedPixels ||
			[],
		softSelected: softShader.selectedPixels,
	});
	const criteria = buildCaseCriteria({
		original,
		sceneInputPacket,
		softShader,
		comparison,
		selectedTransportComparison,
		includeSecondOrder,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const resultSummary = {
		id: caseConfig.id,
		label: caseConfig.label,
		status,
		sceneMode: caseConfig.sceneMode,
		scatteringOrder: caseConfig.scatteringOrder,
		includeSecondOrder,
		caseFolder: path.relative(artifact.directory, caseRoot).replaceAll('\\', '/'),
		originalRendererArtifact: path
			.relative(REPO_ROOT, original.artifact.directory)
			.replaceAll('\\', '/'),
		comparison,
		selectedTransportComparison,
		summary,
	};

	await writeJson(path.join(caseRoot, 'scene-input-packet.json'), sceneInputPacket);
	await writeJson(path.join(caseRoot, 'scene-input-summary.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-scene-input-summary',
		...summarizeSceneInputPacket(sceneInputPacket),
	});
	await writeJson(path.join(caseRoot, 'selected-pixels.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-selected-pixels',
		original:
			originalSelected.selectedPixelDiagnostics ||
			originalSelected.selectedPixels ||
			[],
		softShader: softShader.selectedPixels,
		selectedTransportComparison,
	});
	await writeJson(path.join(caseRoot, 'image-comparison.json'), comparison);
	await writeJson(path.join(caseRoot, 'criteria-results.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-case-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(caseRoot, 'result.json'), {
		kind: 'cpu-soft-shader-unlit-parity-matrix-case-result',
		...resultSummary,
	});
	await writeText(
		path.join(caseRoot, 'report.md'),
		makeCaseReport({
			caseConfig,
			resultSummary,
			sceneInputPacket,
			comparison,
			selectedTransportComparison,
		})
	);

	log(
		runLog,
		`Case ${caseConfig.id} original artifact ${path.relative(REPO_ROOT, original.artifact.directory).replaceAll('\\', '/')}.`
	);

	return {
		caseConfig,
		status,
		summary,
		resultSummary,
		criteria,
	};
}

export function buildCpuUnlitSceneInputPacket({
	caseConfig,
	sceneSetup,
	sunCase,
	originalSelected,
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
		kind: 'algorithm32-cpu-unlit-scene-input-packet',
		version: 1,
		captureId: caseConfig.id,
		sceneMode: caseConfig.sceneMode,
		sceneColorPolicy: 'spectrum-id-reference-radiance',
		width,
		height,
		rowOrder: 'top-left-row-major',
		colorEncoding: 'rgba8-unattenuated-spectrum-preview',
		distanceUnits: 'meters',
		hitMaskMeaning: '1 = raycaster hit, 0 = sky/no-hit',
		scatteringOrder: caseConfig.scatteringOrder,
		includeSecondOrder:
			caseConfig.scatteringOrder !== SCATTERING_ORDERS.firstOrder,
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
		source: {
			kind: 'distant-directional-sun',
			sunCase: sunCase.id,
			sunDirection: sunDirection(sunCase),
		},
		geometry: {
			kind: 'spherical-atmosphere-geometry',
			threeToAlgorithmDirection: '[x, y, z] -> [x, -z, y]',
			threeToAlgorithmPosition: '[x, y, z] -> [x, -z, bottomRadiusMeters + y]',
		},
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
		knownLimitations: [
			'CPU-synthesized unlit packet for Milestone 14; sceneColor is a display preview only.',
			'Hit pixels reconstruct spectral object radiance from spectrumNumericIds for exact old-renderer parity.',
		],
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
	const matches = [];
	let maxTransferDelta = 0;
	let comparedSamples = 0;
	let missingSamples = 0;

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
			status: delta <= 1e-12 ? 'matched' : 'delta',
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
		tolerance: 1e-12,
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

function buildCaseCriteria({
	original,
	sceneInputPacket,
	softShader,
	comparison,
	selectedTransportComparison,
	includeSecondOrder,
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
			tolerance: {
				maxAbsRgbDelta: 0,
				meanAbsRgbDelta: 0,
				p99PixelMaxAbsRgbDelta: 0,
				reason:
					'Milestone 14 uses CPU-synthesized unlit packets and spectrum-id reference radiance, so exact byte parity is expected.',
			},
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
			id: 'source-and-scattering-order-explicit',
			status:
				sceneInputPacket.source?.kind === 'distant-directional-sun' &&
				sceneInputPacket.source?.sunCase &&
				sceneInputPacket.includeSecondOrder === includeSecondOrder
					? 'passed'
					: 'failed',
			measured: {
				source: sceneInputPacket.source,
				scatteringOrder: sceneInputPacket.scatteringOrder,
				includeSecondOrder: sceneInputPacket.includeSecondOrder,
				expectedIncludeSecondOrder: includeSecondOrder,
			},
		},
	];
}

function buildAggregateCriteria(caseResults) {
	return [
		{
			id: 'all-matrix-cases-accepted',
			status: caseResults.every((caseResult) => caseResult.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: caseResults.map((caseResult) => ({
				id: caseResult.caseConfig.id,
				status: caseResult.status,
				summary: caseResult.summary,
			})),
		},
		{
			id: 'matrix-case-count',
			status: caseResults.length >= 3 ? 'passed' : 'failed',
			measured: {
				caseCount: caseResults.length,
				requiredMinimum: 3,
			},
		},
		{
			id: 'first-and-second-order-covered',
			status:
				caseResults.some(
					(caseResult) =>
						caseResult.caseConfig.scatteringOrder ===
						SCATTERING_ORDERS.firstOrder
				) &&
				caseResults.some(
					(caseResult) =>
						caseResult.caseConfig.scatteringOrder ===
						SCATTERING_ORDERS.algorithm32
				)
					? 'passed'
					: 'failed',
			measured: caseResults.map((caseResult) => ({
				id: caseResult.caseConfig.id,
				scatteringOrder: caseResult.caseConfig.scatteringOrder,
			})),
		},
		{
			id: 'sky-floor-card-coverage',
			status:
				caseResults.some(
					(caseResult) =>
						caseResult.caseConfig.sceneMode === SCENE_MODES.sunsetFloor
				) &&
				caseResults.some(
					(caseResult) =>
						caseResult.caseConfig.sceneMode === SCENE_MODES.threeCardReference
				)
					? 'passed'
					: 'failed',
			measured: caseResults.map((caseResult) => ({
				id: caseResult.caseConfig.id,
				sceneMode: caseResult.caseConfig.sceneMode,
			})),
		},
	];
}

function unattenuatedSpectrumPreview(spectrumId) {
	const spectrum = SPECTRA[spectrumId] || SPECTRA.black;
	return spectralToDisplayPreview(objectRadianceSpectrum(spectrum)).encodedRgb;
}

function sceneObjectsForPacket(sceneSetup) {
	return sceneSetup.meshes.map((mesh) => ({
		id: mesh.name,
		kind: mesh.userData?.kind || null,
		spectrumId: mesh.userData?.spectrumId || null,
	}));
}

function summarizeSceneInputPacket(sceneInputPacket) {
	return {
		kind: sceneInputPacket.kind,
		version: sceneInputPacket.version,
		captureId: sceneInputPacket.captureId,
		sceneMode: sceneInputPacket.sceneMode,
		sceneColorPolicy: sceneInputPacket.sceneColorPolicy,
		width: sceneInputPacket.width,
		height: sceneInputPacket.height,
		rowOrder: sceneInputPacket.rowOrder,
		colorEncoding: sceneInputPacket.colorEncoding,
		distanceUnits: sceneInputPacket.distanceUnits,
		hitMaskMeaning: sceneInputPacket.hitMaskMeaning,
		scatteringOrder: sceneInputPacket.scatteringOrder,
		includeSecondOrder: sceneInputPacket.includeSecondOrder,
		camera: sceneInputPacket.camera,
		source: sceneInputPacket.source,
		geometry: sceneInputPacket.geometry,
		sceneObjects: sceneInputPacket.sceneObjects,
		spectrumNumericIdMap: sceneInputPacket.spectrumNumericIdMap,
		counts: sceneInputPacket.counts,
		hitDistanceMetersSummary: sceneInputPacket.hitDistanceMetersSummary,
		selectedPixels: sceneInputPacket.selectedPixels,
		knownLimitations: sceneInputPacket.knownLimitations,
	};
}

function makeDiffPixels(a, b) {
	const diff = Buffer.alloc(a.length);
	for (let index = 0; index < a.length; index += 4) {
		diff[index] = Math.min(Math.abs(a[index] - b[index]) * 16, 255);
		diff[index + 1] = Math.min(Math.abs(a[index + 1] - b[index + 1]) * 16, 255);
		diff[index + 2] = Math.min(Math.abs(a[index + 2] - b[index + 2]) * 16, 255);
		diff[index + 3] = 255;
	}
	return diff;
}

export function compareRgbaImages({ a, b }) {
	if (a.width !== b.width || a.height !== b.height) {
		return {
			status: 'dimension-mismatch',
			a: { width: a.width, height: a.height },
			b: { width: b.width, height: b.height },
		};
	}

	const pixelMaxDeltas = [];
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let rgbSamples = 0;

	for (let index = 0; index < a.data.length; index += 4) {
		const deltas = [
			Math.abs(a.data[index] - b.data[index]),
			Math.abs(a.data[index + 1] - b.data[index + 1]),
			Math.abs(a.data[index + 2] - b.data[index + 2]),
		];
		const pixelMax = Math.max(...deltas);
		pixelMaxDeltas.push(pixelMax);
		maxAbsRgbDelta = Math.max(maxAbsRgbDelta, pixelMax);
		sumAbsRgbDelta += deltas[0] + deltas[1] + deltas[2];
		rgbSamples += 3;
	}

	pixelMaxDeltas.sort((left, right) => left - right);

	return {
		status: 'compared',
		width: a.width,
		height: a.height,
		maxAbsRgbDelta,
		meanAbsRgbDelta: sumAbsRgbDelta / rgbSamples,
		p95PixelMaxAbsRgbDelta: percentile(pixelMaxDeltas, 0.95),
		p99PixelMaxAbsRgbDelta: percentile(pixelMaxDeltas, 0.99),
	};
}

export async function readPngRgba(filePath) {
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

	return {
		directory,
		relativeFolder,
	};
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

export async function writePng(filePath, width, height, pixels) {
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

function makeAggregateReport({ packet, caseResults }) {
	return [
		'# CPU Soft-Shader Unlit Parity Matrix',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Prove the CPU soft-shader/postprocess path can reproduce the original CPU Algorithm32 renderer when no Three lighting or shadows are involved.',
		'',
		'## Cases',
		'',
		...caseResults.map(
			(caseResult) =>
				`- ${caseResult.caseConfig.id}: ${caseResult.status}, max RGB delta ${caseResult.resultSummary.comparison.maxAbsRgbDelta}, selected transfer max delta ${caseResult.resultSummary.selectedTransportComparison.maxTransferDelta}`
		),
		'',
		'## Interpretation',
		'',
		'Milestone 14 proves unlit renderer equivalence only. Lit browser scene colors, scene-light coupling, and local Sun behavior remain later milestones.',
		'',
	].join('\n');
}

function makeCaseReport({
	caseConfig,
	resultSummary,
	sceneInputPacket,
	comparison,
	selectedTransportComparison,
}) {
	return [
		`# ${caseConfig.label}`,
		'',
		`Status: ${resultSummary.status}`,
		'',
		`Scene mode: ${caseConfig.sceneMode}`,
		`Scattering order: ${caseConfig.scatteringOrder}`,
		`Sun case: ${sceneInputPacket.source.sunCase}`,
		'',
		'## Outputs',
		'',
		'- `original-renderer-image.png`: original `node-three-reference.js` image.',
		'- `soft-shader-image.png`: CPU soft-shader image over the synthesized unlit scene packet.',
		'- `diff-image.png`: amplified RGB byte difference.',
		'- `scene-input-packet.json`: CPU scene packet consumed by the soft shader.',
		'- `selected-pixels.json`: original and soft-shader selected diagnostics.',
		'',
		'## Results',
		'',
		`- Max RGB delta: ${comparison.maxAbsRgbDelta}.`,
		`- Mean RGB delta: ${comparison.meanAbsRgbDelta}.`,
		`- Selected transfer max delta: ${selectedTransportComparison.maxTransferDelta}.`,
		`- Sky pixels: ${sceneInputPacket.counts.skyPixels}.`,
		`- Hit pixels: ${sceneInputPacket.counts.hitPixels}.`,
		'',
	].join('\n');
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function incrementMap(map, key) {
	map.set(key, (map.get(key) || 0) + 1);
}

function maxArrayDelta(left, right) {
	if (left.length !== right.length) {
		return Number.POSITIVE_INFINITY;
	}
	let maxDelta = 0;
	for (let index = 0; index < left.length; index += 1) {
		maxDelta = Math.max(maxDelta, Math.abs(left[index] - right[index]));
	}
	return maxDelta;
}

function percentile(sortedValues, p) {
	if (sortedValues.length === 0) {
		return null;
	}
	const index = (sortedValues.length - 1) * p;
	const lower = Math.floor(index);
	const upper = Math.ceil(index);
	if (lower === upper) {
		return sortedValues[lower];
	}
	const ratio = index - lower;
	return sortedValues[lower] * (1 - ratio) + sortedValues[upper] * ratio;
}

function dedupeSamples(samples) {
	const seen = new Set();
	const deduped = [];
	for (const sample of samples) {
		const key = `${sample.x},${sample.y}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		deduped.push(sample);
	}
	return deduped;
}

function vectorToArray(vector) {
	return [vector.x, vector.y, vector.z];
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

class SpectrumNumericMap {
	constructor() {
		this.nextId = 1;
		this.spectrumToId = new Map();
		this.idToSpectrum = new Map([[0, null]]);
	}

	idForSpectrum(spectrumId) {
		if (!this.spectrumToId.has(spectrumId)) {
			const id = this.nextId;
			this.nextId += 1;
			this.spectrumToId.set(spectrumId, id);
			this.idToSpectrum.set(id, spectrumId);
		}
		return this.spectrumToId.get(spectrumId);
	}

	toPacketMap() {
		return Object.fromEntries(
			[...this.idToSpectrum.entries()].map(([id, spectrumId]) => [
				String(id),
				spectrumId,
			])
		);
	}
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
