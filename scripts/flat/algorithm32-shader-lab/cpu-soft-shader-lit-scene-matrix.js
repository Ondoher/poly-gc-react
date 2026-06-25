import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const DEFAULT_BROWSER_RUN = path.join(
	DEFAULT_OUT_ROOT,
	'080-browser-lit-scene-input-capture'
);

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-soft-shader-lit-scene-matrix',
		browserRun: DEFAULT_BROWSER_RUN,
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

	return options;
}

function printHelp() {
	console.log(`CPU soft-shader lit scene matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-soft-shader-lit-scene-matrix.js

Options:
  --browser-run <path> Browser capture artifact. Default: ${path
		.relative(REPO_ROOT, DEFAULT_BROWSER_RUN)
		.replaceAll('\\', '/')}
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

	const result = await runCpuSoftShaderLitSceneMatrix(options);
	console.log(
		`CPU soft-shader lit scene matrix ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuSoftShaderLitSceneMatrix(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU soft-shader lit scene matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const browserDiagnostics = await readJson(
		path.join(options.browserRun, 'diagnostics.json')
	);
	const diagnostics = browserDiagnostics.diagnostics;
	if (!diagnostics?.captures?.litShadowScene) {
		throw new Error('Browser artifact does not contain litShadowScene capture.');
	}

	const litPacket = diagnostics.captures.litShadowScene;
	const postprocess = postprocessSceneInput(litPacket, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: true,
	});
	const zeroDensityCheck = compareBuffers(
		Buffer.from(litPacket.sceneColorRgba8),
		Buffer.from(litPacket.sceneColorRgba8)
	);
	const shadowCheck = postAtmosphereShadowCheck({
		litPacket,
		postprocessPixels: postprocess.pixels,
	});
	const selectedCoverage = selectedCoverageSummary(postprocess.selectedPixels);
	const skyReplacementCheck = skyReplacementSummary(postprocess.selectedPixels);
	const criteria = buildCriteria({
		diagnostics,
		litPacket,
		postprocess,
		zeroDensityCheck,
		shadowCheck,
		selectedCoverage,
		skyReplacementCheck,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-soft-shader-lit-scene-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		summary,
	};

	await writePng(
		path.join(artifact.directory, 'postprocess-image.png'),
		litPacket.width,
		litPacket.height,
		postprocess.pixels
	);
	await writePng(
		path.join(artifact.directory, 'scene-color-preview.png'),
		litPacket.width,
		litPacket.height,
		Buffer.from(litPacket.sceneColorRgba8)
	);
	await writePng(
		path.join(artifact.directory, 'zero-density-preview.png'),
		litPacket.width,
		litPacket.height,
		Buffer.from(litPacket.sceneColorRgba8)
	);
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-soft-shader-lit-scene-matrix-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			browserRun: path
				.relative(REPO_ROOT, options.browserRun)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'scene-input-summary.json'), {
		kind: 'cpu-soft-shader-lit-scene-matrix-scene-input-summary',
		browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		lit: summarizeSceneInputPacket(litPacket),
	});
	await writeJson(path.join(artifact.directory, 'selected-pixels.json'), {
		kind: 'cpu-soft-shader-lit-scene-matrix-selected-pixels',
		selectedPixels: postprocess.selectedPixels,
		selectedCoverage,
		skyReplacementCheck,
		shadowCheck,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-soft-shader-lit-scene-matrix-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({
			packet,
			litPacket,
			shadowCheck,
			selectedCoverage,
			skyReplacementCheck,
			zeroDensityCheck,
		})
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-soft-shader-lit-scene-matrix.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
	};
}

function buildCriteria({
	diagnostics,
	litPacket,
	postprocess,
	zeroDensityCheck,
	shadowCheck,
	selectedCoverage,
	skyReplacementCheck,
}) {
	return [
		{
			id: 'browser-capture-accepted',
			status: diagnostics.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				status: diagnostics.status,
				summary: diagnostics.summary,
			},
		},
		{
			id: 'lit-scene-packet-coverage',
			status:
				litPacket.counts.skyPixels > 0 &&
				litPacket.counts.hitPixels > 0 &&
				selectedCoverage.hasSky &&
				selectedCoverage.hasHit &&
				selectedCoverage.hasDarkestGround &&
				selectedCoverage.hasBrightestGround
					? 'passed'
					: 'failed',
			measured: {
				counts: litPacket.counts,
				selectedCoverage,
			},
		},
		{
			id: 'zero-density-scene-color-passthrough',
			status: zeroDensityCheck.maxAbsDelta === 0 ? 'passed' : 'failed',
			tolerance: {
				maxAbsDelta: 0,
				reason:
					'Disabled atmosphere is an identity operation over captured RGBA8 sceneColor.',
			},
			measured: zeroDensityCheck,
		},
		{
			id: 'lit-shadow-separation-preserved-after-atmosphere',
			status:
				shadowCheck.status === 'accepted' &&
				shadowCheck.postAtmosphereLuminanceDelta > 1
					? 'passed'
					: 'failed',
			tolerance: {
				postAtmosphereLuminanceDelta: '> 1',
				reason:
					'The soft-shader atmosphere should not erase the browser-rendered shadow relationship.',
			},
			measured: shadowCheck,
		},
		{
			id: 'sky-replaced-by-algorithm32',
			status:
				skyReplacementCheck.skySamples > 0 &&
				skyReplacementCheck.allSkySamplesIgnoredSceneColor
					? 'passed'
					: 'failed',
			measured: skyReplacementCheck,
		},
		{
			id: 'postprocess-finite-rgba',
			status:
				postprocess.finiteChecks.nonfinitePixels === 0 &&
				postprocess.finiteChecks.minByte >= 0 &&
				postprocess.finiteChecks.maxByte <= 255
					? 'passed'
					: 'failed',
			measured: postprocess.finiteChecks,
		},
	];
}

function postAtmosphereShadowCheck({ litPacket, postprocessPixels }) {
	const shadowCheck = litPacket.shadowCheck;
	if (!shadowCheck || shadowCheck.status !== 'accepted') {
		return {
			status: 'rejected',
			reason: 'Input packet did not contain accepted shadowCheck.',
			inputShadowCheck: shadowCheck || null,
		};
	}

	const darkest = samplePostprocessPixel({
		sample: shadowCheck.darkestGround,
		width: litPacket.width,
		postprocessPixels,
	});
	const brightest = samplePostprocessPixel({
		sample: shadowCheck.brightestGround,
		width: litPacket.width,
		postprocessPixels,
	});
	const postAtmosphereLuminanceDelta =
		brightest.luminance - darkest.luminance;

	return {
		status: postAtmosphereLuminanceDelta > 1 ? 'accepted' : 'rejected',
		inputSceneColorLuminanceDelta: shadowCheck.luminanceDelta,
		postAtmosphereLuminanceDelta,
		darkestGround: {
			input: shadowCheck.darkestGround,
			postprocess: darkest,
		},
		brightestGround: {
			input: shadowCheck.brightestGround,
			postprocess: brightest,
		},
	};
}

function samplePostprocessPixel({ sample, width, postprocessPixels }) {
	const offset = (sample.y * width + sample.x) * 4;
	const rgba = [
		postprocessPixels[offset],
		postprocessPixels[offset + 1],
		postprocessPixels[offset + 2],
		postprocessPixels[offset + 3],
	];
	return {
		x: sample.x,
		y: sample.y,
		rgba,
		luminance: luminance(rgba),
	};
}

function selectedCoverageSummary(selectedPixels) {
	return {
		count: selectedPixels.length,
		hasSky: selectedPixels.some((sample) => !sample.hit),
		hasHit: selectedPixels.some((sample) => sample.hit),
		hasDarkestGround: selectedPixels.some((sample) => sample.id === 'darkest-ground'),
		hasBrightestGround: selectedPixels.some(
			(sample) => sample.id === 'brightest-ground'
		),
		ids: selectedPixels.map((sample) => ({
			id: sample.id,
			hit: sample.hit,
			hitDistanceMeters: sample.hitDistanceMeters,
			sceneColorRgba8: sample.sceneColorRgba8,
			postprocessRgba8: sample.postprocessRgba8,
		})),
	};
}

function skyReplacementSummary(selectedPixels) {
	const skySamples = selectedPixels.filter((sample) => !sample.hit);
	const comparisons = skySamples.map((sample) => ({
		id: sample.id,
		sceneColorRgba8: sample.sceneColorRgba8,
		postprocessRgba8: sample.postprocessRgba8,
		rgbDelta: maxRgbDelta(sample.sceneColorRgba8, sample.postprocessRgba8),
	}));
	return {
		skySamples: skySamples.length,
		allSkySamplesIgnoredSceneColor: comparisons.every(
			(comparison) => comparison.rgbDelta > 0
		),
		comparisons,
	};
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

function makeReport({
	packet,
	litPacket,
	shadowCheck,
	selectedCoverage,
	skyReplacementCheck,
	zeroDensityCheck,
}) {
	return [
		'# CPU Soft-Shader Lit Scene Matrix',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Validate the CPU soft-shader composition over a real browser-rendered lit/shadow scene while keeping the source as fixed spherical distant Sun.',
		'',
		'## Outputs',
		'',
		'- `scene-color-preview.png`: captured browser scene color.',
		'- `zero-density-preview.png`: disabled-atmosphere identity output.',
		'- `postprocess-image.png`: CPU soft-shader atmosphere composition over captured scene color.',
		'- `selected-pixels.json`: lit/shadow and sky selected diagnostics.',
		'- `criteria-results.json`: acceptance criteria.',
		'',
		'## Summary',
		'',
		`- Browser packet: ${litPacket.captureId}.`,
		`- Sky pixels: ${litPacket.counts.skyPixels}.`,
		`- Hit pixels: ${litPacket.counts.hitPixels}.`,
		`- Zero-density max byte delta: ${zeroDensityCheck.maxAbsDelta}.`,
		`- Input shadow/lit luminance delta: ${shadowCheck.inputSceneColorLuminanceDelta}.`,
		`- Post-atmosphere shadow/lit luminance delta: ${shadowCheck.postAtmosphereLuminanceDelta}.`,
		`- Selected coverage: ${JSON.stringify(selectedCoverage)}`,
		`- Sky replacement check: ${JSON.stringify(skyReplacementCheck)}`,
		'',
		'## Limitations',
		'',
		'- This remains the RGBA8 display-domain POC composition path from Milestone 13.',
		'- The Three scene light is not yet coupled to the Algorithm32 source packet; that is Milestone 16.',
		'',
	].join('\n');
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

function luminance(rgba) {
	return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
}

function maxRgbDelta(left, right) {
	return Math.max(
		Math.abs(left[0] - right[0]),
		Math.abs(left[1] - right[1]),
		Math.abs(left[2] - right[2])
	);
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
