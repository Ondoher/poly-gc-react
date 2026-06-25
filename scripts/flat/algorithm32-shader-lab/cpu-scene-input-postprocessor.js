import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import * as THREE from 'three';

import {
	composeObjectRadiance,
	createDistantSunAlgorithm32Model,
	NUMERICAL_CONTROLS,
	objectRadianceSpectrum,
	runNodeThreeReference,
	SPECTRA,
	SPECTRAL_CHANNELS,
	spectralToDisplayPreview,
	summarizeTransfer,
	SUN_CASES,
	sunDirection,
	traceSegmentForThreeHit,
	traceSkyForThreeRay,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	SOURCE_KINDS,
} from './algorithm32-source-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'browser-lit-scene-input-cpu-postprocessor',
		browserRun: null,
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
		} else if (arg === '--browser-run') {
			options.browserRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.help && !options.browserRun) {
		throw new Error('--browser-run is required');
	}

	return options;
}

function printHelp() {
	console.log(`CPU scene-input postprocessor

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js --browser-run <browser-capture-artifact>

Options:
  --browser-run <path> Browser capture artifact with diagnostics.json.
  --out-root <path>    Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>       Artifact folder label.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const result = await runCpuSceneInputPostprocessor(options);
	console.log(
		`CPU scene-input postprocessor ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

async function runCpuSceneInputPostprocessor(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU scene-input postprocessor milestone.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const browserDiagnostics = await readJson(
		path.join(options.browserRun, 'diagnostics.json')
	);
	const diagnostics = browserDiagnostics.diagnostics;
	if (!diagnostics?.captures?.unlitMaterialControl) {
		throw new Error('Browser artifact does not contain unlitMaterialControl capture.');
	}
	if (!diagnostics?.captures?.litShadowScene) {
		throw new Error('Browser artifact does not contain litShadowScene capture.');
	}

	const unlitPacket = diagnostics.captures.unlitMaterialControl;
	const litPacket = diagnostics.captures.litShadowScene;
	log(runLog, 'Loaded browser scene-input capture packets.');

	const originalControl = await runOriginalRendererControl({
		artifact,
		width: unlitPacket.width,
		height: unlitPacket.height,
	});
	log(runLog, 'Rendered original CPU renderer unlit control.');

	const unlitPostprocess = postprocessSceneInput(unlitPacket, {
		surfacePolicy: 'spectrum-id-reference-radiance',
	});
	const litPostprocess = postprocessSceneInput(litPacket, {
		surfacePolicy: 'captured-rgba8-display-domain',
	});
	log(runLog, 'Rendered CPU postprocess outputs from captured packets.');

	await writePng(
		path.join(artifact.directory, 'unlit-control-postprocess-image.png'),
		unlitPacket.width,
		unlitPacket.height,
		unlitPostprocess.pixels
	);
	await writePng(
		path.join(artifact.directory, 'postprocess-image.png'),
		litPacket.width,
		litPacket.height,
		litPostprocess.pixels
	);
	await writePng(
		path.join(artifact.directory, 'scene-color-preview.png'),
		litPacket.width,
		litPacket.height,
		Buffer.from(litPacket.sceneColorRgba8)
	);
	await writePng(
		path.join(artifact.directory, 'unlit-scene-color-preview.png'),
		unlitPacket.width,
		unlitPacket.height,
		Buffer.from(unlitPacket.sceneColorRgba8)
	);
	await fs.copyFile(
		originalControl.referenceImagePath,
		path.join(artifact.directory, 'original-renderer-control-image.png')
	);

	const originalPixels = await readPngRgba(originalControl.referenceImagePath);
	const unlitComparison = compareRgbaImages({
		a: originalPixels,
		b: {
			width: unlitPacket.width,
			height: unlitPacket.height,
			data: unlitPostprocess.pixels,
		},
	});
	const zeroDensityCheck = compareBuffers(
		Buffer.from(litPacket.sceneColorRgba8),
		identitySceneColor(litPacket)
	);
	const criteria = buildCriteria({
		browserDiagnostics: diagnostics,
		unlitComparison,
		zeroDensityCheck,
		litPostprocess,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const status = summary.failed === 0 ? 'accepted' : 'rejected';

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-scene-input-postprocessor-command',
		options: {
			...options,
			browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'scene-input-summary.json'), {
		kind: 'cpu-scene-input-postprocessor-scene-input-summary',
		browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		unlit: summarizeSceneInputPacket(unlitPacket),
		lit: summarizeSceneInputPacket(litPacket),
	});
	await writeJson(path.join(artifact.directory, 'source-geometry-packet.json'), {
		kind: 'cpu-scene-input-postprocessor-source-geometry-packet',
		source: litPacket.source,
		geometry: litPacket.geometry,
		sunCase: litPostprocess.sunCase,
		sourceContract: litPostprocess.sourceContract,
	});
	await writeJson(
		path.join(artifact.directory, 'unlit-control-comparison.json'),
		{
			kind: 'cpu-scene-input-postprocessor-unlit-control-comparison',
			originalRendererArtifact: path
				.relative(REPO_ROOT, originalControl.artifact.directory)
				.replaceAll('\\', '/'),
			comparison: unlitComparison,
		}
	);
	await writeJson(path.join(artifact.directory, 'selected-pixels.json'), {
		kind: 'cpu-scene-input-postprocessor-selected-pixels',
		unlit: unlitPostprocess.selectedPixels,
		lit: litPostprocess.selectedPixels,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-scene-input-postprocessor-criteria',
		summary,
		criteria,
	});
	const packet = {
		kind: 'cpu-scene-input-postprocessor-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		summary,
	};
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({
			packet,
			browserDiagnostics: diagnostics,
			unlitComparison,
			zeroDensityCheck,
			originalControl,
		})
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-scene-input-postprocessor.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
	};
}

async function runOriginalRendererControl({ artifact, width, height }) {
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const result = await runNodeThreeReference([
		'--out-root',
		casesRoot,
		'--width',
		String(width),
		'--height',
		String(height),
		'--label',
		'original-renderer-unlit-control',
	]);

	return {
		...result,
		referenceImagePath: path.join(result.artifact.directory, 'reference-image.png'),
	};
}

export function postprocessSceneInput(
	sceneInput,
	{ surfacePolicy, includeSecondOrder = true } = {}
) {
	const width = sceneInput.width;
	const height = sceneInput.height;
	const pixels = Buffer.alloc(width * height * 4);
	const selectedPixelIds = new Map(
		(sceneInput.selectedPixels || []).map((sample) => [
			`${sample.x},${sample.y}`,
			sample.id,
		])
	);
	const selectedPixels = [];
	const { algorithm32Model, sunCase, sunRay, sourceResolution } =
		resolveSceneInputAlgorithm32Model(sceneInput);
	const camera = {
		position: new THREE.Vector3(...sceneInput.camera.positionMeters),
	};
	const incidentSkyCache = new Map();
	const finiteChecks = {
		pixels: 0,
		nonfinitePixels: 0,
		minByte: 255,
		maxByte: 0,
	};

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelIndex = y * width + x;
			const outputOffset = pixelIndex * 4;
			const directionOffset = pixelIndex * 3;
			const ray = {
				direction: new THREE.Vector3(
					sceneInput.rayDirections[directionOffset],
					sceneInput.rayDirections[directionOffset + 1],
					sceneInput.rayDirections[directionOffset + 2]
				).normalize(),
			};
			const hit = sceneInput.hitMask[pixelIndex] === 1;
			const transfer = hit
				? traceSegmentForThreeHit({
						camera,
						ray,
						distance: sceneInput.hitDistanceMeters[pixelIndex],
						sunCase,
						sunRay,
						algorithm32Model,
						incidentSkyCache,
						includeSecondOrder,
					})
				: traceSkyForThreeRay({
						camera,
						ray,
						sunCase,
						sunRay,
						algorithm32Model,
						incidentSkyCache,
						includeSecondOrder,
					});
			const encodedRgb = hit
				? composeHitPixel({
						sceneInput,
						pixelIndex,
						transfer,
						surfacePolicy,
					})
				: spectralToDisplayPreview(transfer.pathRadianceByWavelength).encodedRgb;

			pixels[outputOffset] = encodedRgb[0];
			pixels[outputOffset + 1] = encodedRgb[1];
			pixels[outputOffset + 2] = encodedRgb[2];
			pixels[outputOffset + 3] = 255;
			updateFiniteChecks(finiteChecks, encodedRgb);

			const selectedId = selectedPixelIds.get(`${x},${y}`);
			if (selectedId) {
				selectedPixels.push({
					id: selectedId,
					x,
					y,
					hit,
					hitDistanceMeters: hit
						? sceneInput.hitDistanceMeters[pixelIndex]
						: null,
					spectrumId: hit
						? spectrumIdForNumeric(
								sceneInput,
								sceneInput.spectrumNumericIds[pixelIndex]
							)
						: null,
					sceneColorRgba8: Array.from(
						sceneInput.sceneColorRgba8.slice(outputOffset, outputOffset + 4)
					),
					postprocessRgba8: [
						pixels[outputOffset],
						pixels[outputOffset + 1],
						pixels[outputOffset + 2],
						pixels[outputOffset + 3],
					],
					meanTransmittance:
						transfer.transmittanceByWavelength.reduce(
							(sum, value) => sum + value,
							0
						) / transfer.transmittanceByWavelength.length,
					transfer: summarizeTransfer(transfer),
				});
			}
		}
	}

	return {
		width,
		height,
		pixels,
		selectedPixels,
		finiteChecks,
		sunCase: {
			...sunCase,
			sunDirection: sunRay,
		},
		sourceContract: {
			kind: algorithm32Model.kind,
			geometry: algorithm32Model.geometry,
			sourceResolution,
			sunCaseResolution: sourceResolution,
			source: {
				kind: algorithm32Model.source.kind,
				id: algorithm32Model.source.id,
				direction: algorithm32Model.source.direction,
				distanceKind: algorithm32Model.source.distanceKind,
				positionMeters: algorithm32Model.source.positionMeters || null,
			},
		},
		cacheDiagnostics: {
			incidentSkyCacheEntries: incidentSkyCache.size,
		},
		surfacePolicy,
		includeSecondOrder,
	};
}

function resolveSceneInputAlgorithm32Model(sceneInput) {
	if (sceneInput.source?.kind === SOURCE_KINDS.flatLocalPointSun) {
		return resolveSceneInputFlatLocalModel(sceneInput);
	}

	const { sunCase, sunCaseResolution } = resolveSceneInputSunCase(sceneInput);
	const algorithm32Model = createDistantSunAlgorithm32Model(sunCase);
	return {
		algorithm32Model,
		sunCase,
		sunRay: sunDirection(sunCase),
		sourceResolution: sunCaseResolution,
	};
}

function resolveSceneInputFlatLocalModel(sceneInput) {
	const sourcePacket = sceneInput.source || {};
	const geometryPacket = sceneInput.geometry || {};
	const observerPositionMeters =
		geometryPacket.observerPositionMeters ||
		sourcePacket.observerPositionMeters ||
		[0, 0, 2];
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters: finiteOrDefault(
			geometryPacket.topAltitudeMeters,
			geometryPacket.atmosphereTopAltitudeMeters,
			60000
		),
		observerPositionMeters,
		sceneSkyRayLimitMeters: finiteOrNull(geometryPacket.sceneSkyRayLimitMeters),
		sceneSkyRayLimitPolicy: geometryPacket.sceneSkyRayLimitPolicy || null,
	});
	const localSource = createFlatLocalPointSunSource({
		id: sourcePacket.id || sourcePacket.sunCase || 'packet-flat-local-point-sun',
		positionMeters: finiteVectorOrThrow(
			sourcePacket.positionMeters,
			'flat local source positionMeters'
		),
		radiusKm: finiteOrDefault(sourcePacket.radiusKm, 25),
		referenceDistanceKm: finiteOrDefault(sourcePacket.referenceDistanceKm, 1),
		referenceSpectralIncidentScale: finiteOrDefault(
			sourcePacket.referenceSpectralIncidentScale,
			sourcePacket.incidentScale,
			1
		),
		distanceFalloff: sourcePacket.distanceFalloff !== false,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourcePacket.color || { r: 1, g: 0.98, b: 0.95 },
		provenance: sourcePacket.provenance || null,
	});
	const algorithm32Model = createAlgorithm32Model({
		geometry,
		source: localSource,
		spectralProfile: {
			kind: 'algorithm32-15-channel-profile',
			channels: SPECTRAL_CHANNELS.map((channel) => ({
				wavelengthNanometers: channel.wavelengthNanometers,
				solarIrradiance: channel.solarIrradiance,
			})),
		},
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			localSourceMode: 'soft-shader-postprocessor',
			localSecondOrder: 'deferred',
		},
	});
	const observerSample = algorithm32Model.sampleSource(observerPositionMeters);
	const direction = observerSample.direction;
	const sunCase = {
		id: localSource.id,
		role: sourcePacket.role || 'packet flat/local point Sun source',
		sourceKind: SOURCE_KINDS.flatLocalPointSun,
		offsetDegrees: sourcePacket.offsetDegrees ?? null,
		sunAltitudeDegrees: radiansToDegrees(Math.asin(direction[2])),
		sunAzimuthDegrees: radiansToDegrees(Math.atan2(direction[1], direction[0])),
		sunDirection: direction,
		sourceDistanceMeters: observerSample.distanceMeters,
		incidentScale: observerSample.incidentScale,
	};

	return {
		algorithm32Model,
		sunCase,
		sunRay: direction,
		sourceResolution: {
			status: 'packet-supplied-flat-local-point-sun',
			requestedSource: localSource.id,
			observerSourceDistanceMeters: observerSample.distanceMeters,
			observerIncidentScale: observerSample.incidentScale,
		},
	};
}

function resolveSceneInputSunCase(sceneInput) {
	const source = sceneInput.source || {};
	const canonical = SUN_CASES.find(
		(candidate) => candidate.id === source.sunCase
	);
	if (canonical) {
		return {
			sunCase: canonical,
			sunCaseResolution: {
				status: 'canonical-sun-case',
				requestedSunCase: source.sunCase,
			},
		};
	}

	if (
		source.kind === 'distant-directional-sun' &&
		Number.isFinite(source.sunAltitudeDegrees) &&
		Number.isFinite(source.sunAzimuthDegrees)
	) {
		return {
			sunCase: {
				id: source.sunCase || 'packet-distant-directional-sun',
				sourceTimeOfDay: source.sourceTimeOfDay || null,
				sourceSunZenithDegrees:
					source.sourceSunZenithDegrees ??
					90 - source.sunAltitudeDegrees,
				sunAltitudeDegrees: source.sunAltitudeDegrees,
				sunAzimuthDegrees: source.sunAzimuthDegrees,
				role: source.role || 'packet-supplied distant Sun source',
			},
			sunCaseResolution: {
				status: 'packet-supplied-sun-case',
				requestedSunCase: source.sunCase || null,
			},
		};
	}

	const fallback =
		SUN_CASES.find((candidate) => candidate.id === 'figure1-13h15-z21') ||
		SUN_CASES[0];
	return {
		sunCase: fallback,
		sunCaseResolution: {
			status: 'fallback-default-sun-case',
			requestedSunCase: source.sunCase || null,
			reason:
				'sceneInput.source did not identify a canonical Sun case or carry altitude/azimuth for a packet-supplied distant Sun',
		},
	};
}

function finiteVectorOrThrow(value, label) {
	if (
		!Array.isArray(value) ||
		value.length < 3 ||
		!value.slice(0, 3).every(Number.isFinite)
	) {
		throw new Error(`Missing finite ${label}.`);
	}
	return value.slice(0, 3);
}

function finiteOrDefault(...values) {
	for (const value of values) {
		if (Number.isFinite(value)) {
			return value;
		}
	}
	return null;
}

function finiteOrNull(value) {
	return Number.isFinite(value) ? value : null;
}

function radiansToDegrees(value) {
	return (value * 180) / Math.PI;
}

function composeHitPixel({ sceneInput, pixelIndex, transfer, surfacePolicy }) {
	if (surfacePolicy === 'spectrum-id-reference-radiance') {
		const spectrumId = spectrumIdForNumeric(
			sceneInput,
			sceneInput.spectrumNumericIds[pixelIndex]
		);
		const spectrum = SPECTRA[spectrumId] || SPECTRA.black;
		const objectRadiance = objectRadianceSpectrum(spectrum);
		const finalRadiance = composeObjectRadiance(objectRadiance, transfer);

		return spectralToDisplayPreview(finalRadiance).encodedRgb;
	}

	const rgbaOffset = pixelIndex * 4;
	const sceneRgb = [
		sceneInput.sceneColorRgba8[rgbaOffset] / 255,
		sceneInput.sceneColorRgba8[rgbaOffset + 1] / 255,
		sceneInput.sceneColorRgba8[rgbaOffset + 2] / 255,
	];
	const transmittanceRgb = rgbTransmittanceBands(
		transfer.transmittanceByWavelength
	);
	const pathRgb = spectralToDisplayPreview(
		transfer.pathRadianceByWavelength
	).encodedRgb.map((value) => value / 255);

	return sceneRgb.map((value, index) =>
		clampByte((value * transmittanceRgb[index] + pathRgb[index]) * 255)
	);
}

function rgbTransmittanceBands(transmittanceByWavelength) {
	const blue = average(transmittanceByWavelength.slice(0, 5));
	const green = average(transmittanceByWavelength.slice(4, 9));
	const red = average(transmittanceByWavelength.slice(8));

	return [red, green, blue];
}

function identitySceneColor(sceneInput) {
	return Buffer.from(sceneInput.sceneColorRgba8);
}

function summarizeSceneInputPacket(sceneInput) {
	return {
		kind: sceneInput.kind,
		version: sceneInput.version,
		captureId: sceneInput.captureId,
		sceneMode: sceneInput.sceneMode,
		sceneColorPolicy: sceneInput.sceneColorPolicy,
		width: sceneInput.width,
		height: sceneInput.height,
		rowOrder: sceneInput.rowOrder,
		colorEncoding: sceneInput.colorEncoding,
		distanceUnits: sceneInput.distanceUnits,
		hitMaskMeaning: sceneInput.hitMaskMeaning,
		camera: sceneInput.camera,
		source: sceneInput.source,
		geometry: sceneInput.geometry,
		sceneObjects: sceneInput.sceneObjects,
		ground: sceneInput.ground,
		counts: sceneInput.counts,
		hitDistanceMetersSummary: sceneInput.hitDistanceMetersSummary,
		selectedPixels: sceneInput.selectedPixels,
		shadowCheck: sceneInput.shadowCheck,
		knownLimitations: sceneInput.knownLimitations,
	};
}

function buildCriteria({
	browserDiagnostics,
	unlitComparison,
	zeroDensityCheck,
	litPostprocess,
}) {
	return [
		{
			id: 'browser-capture-accepted',
			status: browserDiagnostics.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				status: browserDiagnostics.status,
				summary: browserDiagnostics.summary,
			},
		},
		{
			id: 'unlit-control-original-renderer-parity',
			status:
				unlitComparison.maxAbsRgbDelta <= 2 &&
				unlitComparison.meanAbsRgbDelta <= 0.05 &&
				unlitComparison.p99PixelMaxAbsRgbDelta <= 1
					? 'passed'
					: 'failed',
			tolerance: {
				maxAbsRgbDelta: '<= 2',
				meanAbsRgbDelta: '<= 0.05',
				p99PixelMaxAbsRgbDelta: '<= 1',
				reason:
					'Unlit packet should be structurally equivalent to the original CPU renderer; tolerance allows browser/Node ray edge quantization only.',
			},
			measured: unlitComparison,
		},
		{
			id: 'zero-density-scene-color-passthrough',
			status: zeroDensityCheck.maxAbsDelta === 0 ? 'passed' : 'failed',
			tolerance: {
				maxAbsDelta: 0,
				reason:
					'Disabled atmosphere is an identity operation over captured sceneColor.',
			},
			measured: zeroDensityCheck,
		},
		{
			id: 'lit-postprocess-finite-rgba',
			status:
				litPostprocess.finiteChecks.nonfinitePixels === 0 &&
				litPostprocess.finiteChecks.minByte >= 0 &&
				litPostprocess.finiteChecks.maxByte <= 255
					? 'passed'
					: 'failed',
			measured: litPostprocess.finiteChecks,
		},
		{
			id: 'lit-selected-pixel-coverage',
			status:
				litPostprocess.selectedPixels.some((sample) => !sample.hit) &&
				litPostprocess.selectedPixels.some((sample) => sample.hit)
					? 'passed'
					: 'failed',
			measured: litPostprocess.selectedPixels.map((sample) => ({
				id: sample.id,
				hit: sample.hit,
				hitDistanceMeters: sample.hitDistanceMeters,
				sceneColorRgba8: sample.sceneColorRgba8,
				postprocessRgba8: sample.postprocessRgba8,
			})),
		},
	];
}

function updateFiniteChecks(finiteChecks, encodedRgb) {
	finiteChecks.pixels += 1;
	for (const value of encodedRgb) {
		if (!Number.isFinite(value)) {
			finiteChecks.nonfinitePixels += 1;
			continue;
		}
		finiteChecks.minByte = Math.min(finiteChecks.minByte, value);
		finiteChecks.maxByte = Math.max(finiteChecks.maxByte, value);
	}
}

function spectrumIdForNumeric(sceneInput, numericId) {
	const key = String(numericId);
	return sceneInput.spectrumNumericIdMap[key] || null;
}

function compareRgbaImages({ a, b }) {
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

function compareBuffers(a, b) {
	let maxAbsDelta = 0;
	let sumAbsDelta = 0;

	for (let index = 0; index < a.length; index += 1) {
		const delta = Math.abs(a[index] - b[index]);
		maxAbsDelta = Math.max(maxAbsDelta, delta);
		sumAbsDelta += delta;
	}

	return {
		byteLength: a.length,
		maxAbsDelta,
		meanAbsDelta: sumAbsDelta / a.length,
	};
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

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function makeReport({
	packet,
	browserDiagnostics,
	unlitComparison,
	zeroDensityCheck,
	originalControl,
}) {
	return [
		'# CPU Scene Input Postprocessor',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Validate a CPU software-shader path over a browser-captured scene packet before implementing the shader.',
		'',
		'## Outputs',
		'',
		'- `original-renderer-control-image.png`: original CPU renderer output for the unlit control.',
		'- `unlit-control-postprocess-image.png`: new CPU postprocessor output over the unlit packet.',
		'- `postprocess-image.png`: new CPU postprocessor output over the lit/shadow packet.',
		'- `scene-color-preview.png`: captured lit Three scene color.',
		'- `unlit-control-comparison.json`: original renderer vs postprocessor image diff.',
		'- `criteria-results.json`: acceptance criteria.',
		'',
		'## Summary',
		'',
		`- Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		`- Browser capture status: ${browserDiagnostics.status}.`,
		`- Original renderer control: ${path.relative(REPO_ROOT, originalControl.artifact.directory).replaceAll('\\', '/')}.`,
		`- Unlit max RGB delta: ${unlitComparison.maxAbsRgbDelta}.`,
		`- Unlit mean RGB delta: ${unlitComparison.meanAbsRgbDelta}.`,
		`- Zero-density passthrough max byte delta: ${zeroDensityCheck.maxAbsDelta}.`,
		'',
		'## Limitations',
		'',
		'- The lit scene path composes captured RGBA8 display-domain scene color with band-averaged spectral transmittance.',
		'- The unlit control uses spectrum-id reference radiance to compare against the original spectral CPU renderer.',
		'- Binary/HDR browser attachments remain deferred so the current long-running harness can be used without relaunch.',
		'',
	].join('\n');
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

function average(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampByte(value) {
	return Math.max(0, Math.min(255, Math.round(value)));
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

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
