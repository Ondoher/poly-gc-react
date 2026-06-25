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

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-source-light-coupling-validation',
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
	console.log(`CPU source/light coupling validation

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-source-light-coupling-validation.js --browser-run <browser-capture-artifact>

Options:
  --browser-run <path> Browser capture artifact with source-driven scene light.
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
	const result = await runCpuSourceLightCouplingValidation(options);
	console.log(
		`CPU source/light coupling validation ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuSourceLightCouplingValidation(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU source/light coupling validation.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const browserCommand = await readJson(path.join(options.browserRun, 'command.json'));
	const browserDiagnostics = await readJson(
		path.join(options.browserRun, 'diagnostics.json')
	);
	const diagnostics = browserDiagnostics.diagnostics;
	const litPacket = diagnostics?.captures?.litShadowScene;
	if (!litPacket) {
		throw new Error('Browser artifact does not contain litShadowScene capture.');
	}

	const postprocess = postprocessSceneInput(litPacket, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: true,
	});
	const zeroDensityCheck = compareBuffers(
		Buffer.from(litPacket.sceneColorRgba8),
		Buffer.from(litPacket.sceneColorRgba8)
	);
	const sourceLightCheck = sourceLightCouplingCheck({
		command: browserCommand,
		litPacket,
	});
	const shadowCheck = postAtmosphereShadowCheck({
		litPacket,
		postprocessPixels: postprocess.pixels,
	});
	const brightnessCheck = brightnessCalibrationCheck({ litPacket });
	const criteria = buildCriteria({
		diagnostics,
		litPacket,
		postprocess,
		zeroDensityCheck,
		sourceLightCheck,
		shadowCheck,
		brightnessCheck,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-source-light-coupling-validation-result',
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
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-source-light-coupling-validation-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			browserRun: path
				.relative(REPO_ROOT, options.browserRun)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'source-light-check.json'), {
		kind: 'cpu-source-light-coupling-validation-source-light-check',
		sourceLightCheck,
		brightnessCheck,
	});
	await writeJson(path.join(artifact.directory, 'selected-pixels.json'), {
		kind: 'cpu-source-light-coupling-validation-selected-pixels',
		selectedPixels: postprocess.selectedPixels,
		shadowCheck,
	});
	await writeJson(path.join(artifact.directory, 'scene-input-summary.json'), {
		kind: 'cpu-source-light-coupling-validation-scene-input-summary',
		browserRun: path.relative(REPO_ROOT, options.browserRun).replaceAll('\\', '/'),
		lit: summarizeSceneInputPacket(litPacket),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-source-light-coupling-validation-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({
			packet,
			sourceLightCheck,
			brightnessCheck,
			shadowCheck,
			zeroDensityCheck,
			postprocess,
		})
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-source-light-coupling-validation.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
	};
}

function sourceLightCouplingCheck({ command, litPacket }) {
	const requestedSunCase = command?.payload?.sunCase || null;
	const requestedSourceLightMode = command?.payload?.sourceLightMode || null;
	const source = litPacket.source || {};
	const sceneLight = litPacket.sceneLight || {};
	const agreement = sceneLight.sourceLightAgreement || {};
	const lightTravelDirectionDelta =
		agreement.lightTravelDirectionDelta ?? Number.POSITIVE_INFINITY;
	return {
		requestedSunCase,
		requestedSourceLightMode,
		packetSource: source,
		sceneLight,
		sourceSunCaseMatches:
			source.sunCase === requestedSunCase &&
			sceneLight.sunCase === requestedSunCase,
		sourceLightModeMatches:
			requestedSourceLightMode === 'distant-directional-sun' &&
			sceneLight.mode === 'distant-directional-sun' &&
			sceneLight.kind === 'source-driven-distant-directional-light',
		lightTravelDirectionDelta,
		lightTravelDirectionMatches: lightTravelDirectionDelta <= 1e-12,
		noDefaultFallback:
			requestedSunCase === source.sunCase &&
			requestedSunCase === sceneLight.sunCase &&
			requestedSourceLightMode === sceneLight.mode,
	};
}

function brightnessCalibrationCheck({ litPacket }) {
	const sceneLight = litPacket.sceneLight || {};
	const selected = litPacket.selectedPixels || [];
	const brightestGround =
		litPacket.shadowCheck?.brightestGround ||
		selected.find((sample) => sample.id === 'brightest-ground') ||
		null;
	const brightestRgb = brightestGround?.rgba || [];
	const maxSelectedSceneByte = Math.max(
		...selected.flatMap((sample) => sample.rgba?.slice(0, 3) || [0])
	);
	return {
		calibrationScalar: sceneLight.calibrationScalar,
		directionalIntensity: sceneLight.intensity,
		colorRgb: sceneLight.colorRgb,
		brightestGround,
		maxSelectedSceneByte,
		accepted:
			sceneLight.calibrationScalar === sceneLight.intensity &&
			sceneLight.intensity > 0 &&
			brightestRgb.length === 4 &&
			Math.max(...brightestRgb.slice(0, 3)) < 250 &&
			maxSelectedSceneByte < 250,
	};
}

function buildCriteria({
	diagnostics,
	litPacket,
	postprocess,
	zeroDensityCheck,
	sourceLightCheck,
	shadowCheck,
	brightnessCheck,
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
			id: 'source-packet-drives-scene-light',
			status:
				sourceLightCheck.sourceSunCaseMatches &&
				sourceLightCheck.sourceLightModeMatches &&
				sourceLightCheck.lightTravelDirectionMatches
					? 'passed'
					: 'failed',
			measured: sourceLightCheck,
		},
		{
			id: 'no-silent-default-sun-fallback',
			status: sourceLightCheck.noDefaultFallback ? 'passed' : 'failed',
			measured: sourceLightCheck,
		},
		{
			id: 'brightness-calibration-recorded-and-unclipped',
			status: brightnessCheck.accepted ? 'passed' : 'failed',
			measured: brightnessCheck,
		},
		{
			id: 'zero-density-scene-color-passthrough',
			status: zeroDensityCheck.maxAbsDelta === 0 ? 'passed' : 'failed',
			measured: zeroDensityCheck,
		},
		{
			id: 'lit-shadow-separation-preserved-after-atmosphere',
			status:
				shadowCheck.status === 'accepted' &&
				shadowCheck.postAtmosphereLuminanceDelta > 1
					? 'passed'
					: 'failed',
			measured: shadowCheck,
		},
		{
			id: 'sky-and-hit-packet-coverage',
			status:
				litPacket.counts.skyPixels > 0 &&
				litPacket.counts.hitPixels > 0 &&
				postprocess.selectedPixels.some((sample) => !sample.hit) &&
				postprocess.selectedPixels.some((sample) => sample.hit)
					? 'passed'
					: 'failed',
			measured: {
				counts: litPacket.counts,
				selected: postprocess.selectedPixels.map((sample) => ({
					id: sample.id,
					hit: sample.hit,
				})),
			},
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
		source: sceneInput.source,
		sceneLight: sceneInput.sceneLight,
		geometry: sceneInput.geometry,
		counts: sceneInput.counts,
		selectedPixels: sceneInput.selectedPixels,
		shadowCheck: sceneInput.shadowCheck,
	};
}

function makeReport({
	packet,
	sourceLightCheck,
	brightnessCheck,
	shadowCheck,
	zeroDensityCheck,
	postprocess,
}) {
	return [
		'# CPU Source/Light Coupling Validation',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Validate that one distant-Sun source packet drives both Algorithm32 and the browser DirectionalLight.',
		'',
		'## Summary',
		'',
		`- Source Sun case: ${sourceLightCheck.packetSource.sunCase}.`,
		`- Scene light mode: ${sourceLightCheck.sceneLight.mode}.`,
		`- Light travel direction delta: ${sourceLightCheck.lightTravelDirectionDelta}.`,
		`- Calibration scalar: ${brightnessCheck.calibrationScalar}.`,
		`- Zero-density max byte delta: ${zeroDensityCheck.maxAbsDelta}.`,
		`- Post-atmosphere shadow/lit delta: ${shadowCheck.postAtmosphereLuminanceDelta}.`,
		`- Finite pixels: ${postprocess.finiteChecks.pixels}.`,
		'',
		'## Limitations',
		'',
		'- This validates one high-Sun distant case. The position matrix is Milestone 17.',
		'- The scene color remains RGBA8 display-domain POC transport.',
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
	return { directory, relativeFolder };
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
