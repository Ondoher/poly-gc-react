import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';
import { runThreeLitSubjectiveSourceScenes } from './cpu-three-lit-subjective-source-scenes.js';
import {
	compareRgbaImages,
	readPngRgba,
	writePng,
} from './cpu-soft-shader-unlit-parity-matrix.js';
import {
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
} from './node-three-reference.js';

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
const HEARTBEAT_PATH = path.join(DEFAULT_OUT_ROOT, 'harness-heartbeat.json');
const DEFAULT_TERRAIN_SEED = 'algorithm32-mountain-detail-v1';

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'subjective-soft-vs-gpu-source-scenes',
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
		} else if (arg === '--command-path') {
			options.commandPath = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--atmosflat-reference') {
			options.atmosflatReference = path.resolve(argv[index + 1]);
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
	console.log(`Subjective soft-shader vs GPU source scenes

Usage:
  node scripts/flat/algorithm32-shader-lab/subjective-soft-vs-gpu-source-scenes.js

Options:
  --command-path <path>         Watch command file. Defaults to heartbeat commandPath.
  --out-root <path>             Output root.
  --label <name>                Artifact folder label.
  --atmosflat-reference <path>  Accepted atmosflat32 source artifact.
  --terrain-seed <value>        Deterministic mountain-detail seed.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const result = await runSubjectiveSoftVsGpuSourceScenes(options);
	console.log(
		`Subjective soft-vs-GPU source scenes ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

async function runSubjectiveSoftVsGpuSourceScenes(options) {
	const startedAt = new Date();
	const commandPath = options.commandPath || (await readHeartbeatCommandPath());
	const sourceRun = await runThreeLitSubjectiveSourceScenes({
		...options,
		commandPath,
	});
	const artifact = sourceRun.artifact;
	const sourceCases = await readJson(path.join(artifact.directory, 'case-results.json'));
	const caseResults = [];

	for (const caseSummary of sourceCases.cases) {
		caseResults.push(
			await renderGpuCase({
				artifact,
				caseSummary,
				commandPath,
				options,
			})
		);
	}

	const galleryPath = await writeGallery({ artifact, caseResults });
	const criteria = buildCriteria({ caseResults, galleryPath });
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'subjective-soft-vs-gpu-source-scenes-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		sourceSceneArtifact: artifact.relativeFolder,
		galleryPath,
		summary,
		cases: caseResults.map((item) => item.summary),
	};

	await writeJson(path.join(artifact.directory, 'soft-vs-gpu-result.json'), packet);
	await writeJson(path.join(artifact.directory, 'soft-vs-gpu-case-results.json'), {
		kind: 'subjective-soft-vs-gpu-source-scenes-case-results',
		cases: caseResults.map((item) => item.summary),
	});
	await writeJson(path.join(artifact.directory, 'soft-vs-gpu-criteria-results.json'), {
		kind: 'subjective-soft-vs-gpu-source-scenes-criteria',
		summary,
		criteria,
	});
	await writeText(
		path.join(artifact.directory, 'soft-vs-gpu-report.md'),
		makeReport({ packet, caseResults })
	);
	await writeJson(
		path.join(options.outRoot, 'latest-subjective-soft-vs-gpu-source-scenes.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function renderGpuCase({ artifact, caseSummary, commandPath, options }) {
	const caseRoot = path.join(artifact.directory, 'cases', caseSummary.id);
	const browserRun = path.join(REPO_ROOT, caseSummary.browserRun);
	const browserDiagnostics = await readJson(path.join(browserRun, 'diagnostics.json'));
	const capture = browserDiagnostics.diagnostics?.capture;
	if (!capture) {
		throw new Error(`Missing capture packet in ${browserRun}.`);
	}
	const cpuPostprocess = postprocessSceneInput(capture, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: Boolean(caseSummary.includeSecondOrder),
	});
	const sceneInputPacket = compactSceneInputPacket(capture);
	const command = {
		id: `subjective-soft-vs-gpu-${caseSummary.id}-${Date.now()}`,
		label: `browser-subjective-soft-vs-gpu-${caseSummary.id}`,
		createdAt: new Date().toISOString(),
		payload: {
			mode: 'browser-scene-packet-soft-shader-image',
			iteration: 'subjective-soft-vs-gpu-source-scenes',
			caseId: caseSummary.id,
			surfacePolicy: 'captured-rgba8-display-domain',
			includeSecondOrder: Boolean(caseSummary.includeSecondOrder),
			sceneInputPacket,
			expectedSelectedPixels: cpuPostprocess.selectedPixels,
		},
	};
	await writeJson(commandPath, command);
	const gpuBrowserRun = await waitForBrowserRun({
		outRoot: options.outRoot,
		commandId: command.id,
	});
	const gpuHarnessResult = await readJson(path.join(gpuBrowserRun, 'result.json'));
	const gpuResult = gpuHarnessResult.result || {};
	const gpuPixels = Buffer.from(gpuResult.shaderReadbackRgba8 || []);
	if (gpuPixels.length !== capture.width * capture.height * 4) {
		throw new Error(`GPU run ${gpuBrowserRun} did not return full RGBA8 readback.`);
	}

	const gpuPath = path.join(caseRoot, 'gpu-shader.png');
	const softPath = path.join(caseRoot, 'atmosphere-postprocess.png');
	const diffPath = path.join(caseRoot, 'soft-vs-gpu-diff.png');
	const sideBySidePath = path.join(caseRoot, 'soft-vs-gpu-side-by-side.png');
	const browserRunPath = path.join(caseRoot, 'gpu-browser-run.json');
	const selectedPath = path.join(caseRoot, 'soft-vs-gpu-selected-pixels.json');
	const comparisonPath = path.join(caseRoot, 'soft-vs-gpu-comparison.json');
	await writePng(gpuPath, capture.width, capture.height, gpuPixels);

	const softImage = await readPngRgba(softPath);
	const gpuImage = await readPngRgba(gpuPath);
	const comparison = compareRgbaImages({ a: softImage, b: gpuImage });
	await writePng(diffPath, capture.width, capture.height, diffPixels(softImage.data, gpuImage.data));
	await writeSideBySide({
		caseSummary,
		softPath,
		gpuPath,
		outputPath: sideBySidePath,
		width: capture.width,
		height: capture.height,
	});
	await writeJson(browserRunPath, {
		kind: 'subjective-soft-vs-gpu-browser-run',
		browserRun: relativePath(gpuBrowserRun),
		command: compactBrowserCommandForReport(command),
		harnessStatus: gpuHarnessResult.status,
		browserStatus: gpuResult.status,
	});
	await writeJson(selectedPath, {
		kind: 'subjective-soft-vs-gpu-selected-pixels',
		cpuSelectedPixels: cpuPostprocess.selectedPixels,
		gpuSelectedPixels: gpuResult.selectedPixels || [],
	});
	await writeJson(comparisonPath, {
		kind: 'subjective-soft-vs-gpu-comparison',
		caseId: caseSummary.id,
		comparison,
		softPath: relativePath(softPath),
		gpuPath: relativePath(gpuPath),
		diffPath: relativePath(diffPath),
		sideBySidePath: relativePath(sideBySidePath),
	});

	return {
		caseSummary,
		caseRoot,
		summary: {
			id: caseSummary.id,
			label: caseSummary.label,
			sourceKind: capture.source.kind,
			includeSecondOrder: Boolean(caseSummary.includeSecondOrder),
			softPath: relativePath(softPath),
			gpuPath: relativePath(gpuPath),
			diffPath: relativePath(diffPath),
			sideBySidePath: relativePath(sideBySidePath),
			gpuBrowserRun: relativePath(gpuBrowserRun),
			harnessStatus: gpuHarnessResult.status,
			browserStatus: gpuResult.status,
			comparison,
		},
	};
}

function compactSceneInputPacket(capture) {
	return {
		kind: capture.kind,
		version: capture.version,
		captureId: capture.captureId,
		sceneMode: capture.sceneMode,
		sceneColorPolicy: capture.sceneColorPolicy,
		width: capture.width,
		height: capture.height,
		rowOrder: capture.rowOrder,
		colorEncoding: capture.colorEncoding,
		distanceUnits: capture.distanceUnits,
		hitMaskMeaning: capture.hitMaskMeaning,
		camera: capture.camera,
		source: capture.source,
		sceneLight: capture.sceneLight,
		geometry: capture.geometry,
		spectrumNumericIdMap: capture.spectrumNumericIdMap,
		sceneColorRgba8: capture.sceneColorRgba8,
		hitDistanceMeters: capture.hitDistanceMeters,
		hitMask: capture.hitMask,
		spectrumNumericIds: capture.spectrumNumericIds,
		rayDirections: capture.rayDirections,
		counts: capture.counts,
		hitDistanceMetersSummary: capture.hitDistanceMetersSummary,
		selectedPixels: capture.selectedPixels,
		shadowCheck: capture.shadowCheck,
	};
}

function compactBrowserCommandForReport(command) {
	return {
		...command,
		payload: {
			...command.payload,
			sceneInputPacket: {
				width: command.payload.sceneInputPacket.width,
				height: command.payload.sceneInputPacket.height,
				captureId: command.payload.sceneInputPacket.captureId,
				sceneMode: command.payload.sceneInputPacket.sceneMode,
				counts: command.payload.sceneInputPacket.counts,
				source: command.payload.sceneInputPacket.source,
				geometry: command.payload.sceneInputPacket.geometry,
			},
			expectedSelectedPixels: command.payload.expectedSelectedPixels.map((sample) => ({
				id: sample.id,
				x: sample.x,
				y: sample.y,
				postprocessRgba8: sample.postprocessRgba8,
			})),
		},
	};
}

function diffPixels(left, right) {
	const length = Math.min(left.length, right.length);
	const pixels = Buffer.alloc(length);
	for (let index = 0; index < length; index += 4) {
		pixels[index] = Math.abs(left[index] - right[index]);
		pixels[index + 1] = Math.abs(left[index + 1] - right[index + 1]);
		pixels[index + 2] = Math.abs(left[index + 2] - right[index + 2]);
		pixels[index + 3] = 255;
	}
	return pixels;
}

async function writeSideBySide({
	caseSummary,
	softPath,
	gpuPath,
	outputPath,
	width,
	height,
}) {
	const labelHeight = 44;
	const gap = 10;
	await sharp({
		create: {
			width: width * 2 + gap,
			height: height + labelHeight,
			channels: 4,
			background: { r: 18, g: 22, b: 28, alpha: 1 },
		},
	})
		.composite([
			{
				input: Buffer.from(
					labelSvg({
						width,
						height: labelHeight,
						title: 'CPU soft shader',
						subtitle: caseSummary.label,
					})
				),
				left: 0,
				top: 0,
			},
			{
				input: Buffer.from(
					labelSvg({
						width,
						height: labelHeight,
						title: 'GPU shader',
						subtitle: caseSummary.label,
					})
				),
				left: width + gap,
				top: 0,
			},
			{ input: softPath, left: 0, top: labelHeight },
			{ input: gpuPath, left: width + gap, top: labelHeight },
		])
		.png()
		.toFile(outputPath);
}

async function writeGallery({ artifact, caseResults }) {
	const panels = await Promise.all(
		caseResults.map((item) => readPngRgba(item.summary.sideBySidePath))
	);
	const width = Math.max(...panels.map((item) => item.width));
	const gap = 16;
	const padding = 18;
	const height =
		padding * 2 +
		panels.reduce((sum, item) => sum + item.height, 0) +
		gap * (panels.length - 1);
	const composites = [];
	let top = padding;
	for (let index = 0; index < caseResults.length; index += 1) {
		composites.push({
			input: caseResults[index].summary.sideBySidePath,
			left: padding,
			top,
		});
		top += panels[index].height + gap;
	}
	const galleryPath = path.join(artifact.directory, 'soft-vs-gpu-gallery.png');
	await sharp({
		create: {
			width: width + padding * 2,
			height,
			channels: 4,
			background: { r: 12, g: 15, b: 20, alpha: 1 },
		},
	})
		.composite(composites)
		.png()
		.toFile(galleryPath);
	return relativePath(galleryPath);
}

function buildCriteria({ caseResults, galleryPath }) {
	return [
		{
			id: 'four-subjective-scenes-rendered',
			status:
				caseResults.length === 4 &&
				caseResults.every((item) => item.summary.harnessStatus === 'accepted')
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				gpuBrowserRun: item.summary.gpuBrowserRun,
				harnessStatus: item.summary.harnessStatus,
				browserStatus: item.summary.browserStatus,
			})),
		},
		{
			id: 'soft-and-gpu-side-by-side-written',
			status:
				galleryPath &&
				caseResults.every((item) => item.summary.sideBySidePath)
					? 'passed'
					: 'failed',
			measured: {
				galleryPath,
				sideBySidePaths: caseResults.map((item) => item.summary.sideBySidePath),
			},
		},
		{
			id: 'soft-and-gpu-images-compared',
			status: caseResults.every((item) => item.summary.comparison.status === 'compared')
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				comparison: item.summary.comparison,
			})),
		},
		{
			id: 'subjective-soft-gpu-parity-within-byte-tolerance',
			status: caseResults.every(
				(item) =>
					item.summary.comparison.status === 'compared' &&
					item.summary.comparison.maxAbsRgbDelta <= 2
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				maxAbsRgbDelta: item.summary.comparison.maxAbsRgbDelta,
				p99PixelMaxAbsRgbDelta: item.summary.comparison.p99PixelMaxAbsRgbDelta,
			})),
		},
	];
}

function makeReport({ packet, caseResults }) {
	return [
		'# Subjective Soft Shader vs GPU Source Scenes',
		'',
		`Status: ${packet.status}`,
		'',
		'These are visual inspection scenes. Each case uses the same captured Three-lit scene packet for both the CPU soft shader and the browser GPU shader.',
		'',
		'## Gallery',
		'',
		`- \`${packet.galleryPath}\``,
		'',
		'## Cases',
		'',
		...caseResults.map(
			(item) =>
				`- ${item.summary.label}: side-by-side \`${item.summary.sideBySidePath}\`, maxAbsRgbDelta=${item.summary.comparison.maxAbsRgbDelta}, p99=${item.summary.comparison.p99PixelMaxAbsRgbDelta}.`
		),
		'',
	].join('\n');
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
			try {
				const command = await readJson(path.join(runDir, 'command.json'));
				if (command.id !== commandId) {
					continue;
				}
				await readJson(path.join(runDir, 'diagnostics.json'));
				return runDir;
			} catch {
				// Keep polling while the watch harness writes the artifact.
			}
		}
		await delay(500);
	}
	throw new Error(`Timed out waiting for browser command ${commandId}`);
}

async function readHeartbeatCommandPath() {
	const heartbeat = await readJson(HEARTBEAT_PATH);
	if (!heartbeat.commandPath) {
		throw new Error('Harness heartbeat does not include commandPath.');
	}
	return heartbeat.commandPath;
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function labelSvg({ width, height, title, subtitle }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<rect width="100%" height="100%" fill="#151922"/>
	<text x="10" y="18" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#f2f4f8">${escapeXml(title)}</text>
	<text x="10" y="36" font-family="Arial, sans-serif" font-size="11" fill="#aeb7c8">${escapeXml(subtitle)}</text>
</svg>`;
}

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
	await fs.writeFile(filePath, value);
}

function relativePath(filePath) {
	return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
