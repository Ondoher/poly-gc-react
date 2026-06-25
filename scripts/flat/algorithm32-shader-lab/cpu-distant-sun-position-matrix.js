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
const REQUIRED_CASE_KEYS = ['high', 'low', 'side', 'behind'];

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-distant-sun-position-matrix',
		cases: [],
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
		} else if (arg === '--case') {
			const spec = argv[index + 1] || '';
			const separatorIndex = spec.indexOf('=');
			if (separatorIndex <= 0) {
				throw new Error('--case expects key=browser-artifact-path');
			}
			options.cases.push({
				key: spec.slice(0, separatorIndex),
				browserRun: path.resolve(spec.slice(separatorIndex + 1)),
			});
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.help && options.cases.length === 0) {
		throw new Error('At least one --case key=browser-artifact-path is required');
	}

	return options;
}

function printHelp() {
	console.log(`CPU distant-Sun position matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-distant-sun-position-matrix.js \\
    --case high=<browser-artifact> --case low=<browser-artifact> \\
    --case side=<browser-artifact> --case behind=<browser-artifact>

Options:
  --case <key=path> Browser source-driven scene-input capture for one case.
  --out-root <path> Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>    Artifact folder label.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runCpuDistantSunPositionMatrix(options);
	console.log(
		`CPU distant-Sun position matrix ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuDistantSunPositionMatrix(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU distant-Sun position matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);
	const casesDirectory = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesDirectory);

	const duplicateKeys = findDuplicateKeys(options.cases);
	if (duplicateKeys.length > 0) {
		throw new Error(`Duplicate case keys: ${duplicateKeys.join(', ')}`);
	}

	const caseResults = [];
	for (const caseOption of options.cases) {
		const caseResult = await runCase({
			caseOption,
			casesDirectory,
			runLog,
		});
		caseResults.push(caseResult);
	}

	const matrixCriteria = buildMatrixCriteria(caseResults);
	const matrixSummary = summarizeCriteria(matrixCriteria);
	const perCaseFailures = caseResults.reduce(
		(sum, item) => sum + item.summary.failed,
		0
	);
	const summary = {
		passed:
			matrixSummary.passed +
			caseResults.reduce((sum, item) => sum + item.summary.passed, 0),
		failed: matrixSummary.failed + perCaseFailures,
		matrixPassed: matrixSummary.passed,
		matrixFailed: matrixSummary.failed,
		caseCount: caseResults.length,
	};
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-distant-sun-position-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		cases: caseResults.map((item) => item.caseSummary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-distant-sun-position-matrix-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			cases: options.cases.map((item) => ({
				key: item.key,
				browserRun: path
					.relative(REPO_ROOT, item.browserRun)
					.replaceAll('\\', '/'),
			})),
		},
	});
	await writeJson(path.join(artifact.directory, 'matrix-summary.json'), {
		kind: 'cpu-distant-sun-position-matrix-summary',
		status,
		summary,
		matrixDiagnostics: summarizeMatrixDiagnostics(caseResults),
		cases: caseResults.map((item) => item.caseSummary),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-distant-sun-position-matrix-criteria',
		summary,
		matrixCriteria,
		caseCriteria: Object.fromEntries(
			caseResults.map((item) => [item.caseKey, item.criteria])
		),
	});
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({ packet, matrixCriteria, caseResults })
	);
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-distant-sun-position-matrix.json'),
		packet
	);

	return {
		artifact,
		status,
		summary,
		packet,
	};
}

async function runCase({ caseOption, casesDirectory, runLog }) {
	const caseKey = slug(caseOption.key);
	const caseDirectory = path.join(casesDirectory, caseKey);
	await fs.mkdir(caseDirectory);
	log(runLog, `Loaded case ${caseKey} from ${caseOption.browserRun}.`);

	const browserCommand = await readJson(
		path.join(caseOption.browserRun, 'command.json')
	);
	const browserDiagnostics = await readJson(
		path.join(caseOption.browserRun, 'diagnostics.json')
	);
	const diagnostics = browserDiagnostics.diagnostics;
	const litPacket = diagnostics?.captures?.litShadowScene;
	if (!litPacket) {
		throw new Error(`Case ${caseKey} does not contain litShadowScene capture.`);
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
		postprocess,
	});
	const shadowCheck = postAtmosphereShadowCheck({
		litPacket,
		postprocessPixels: postprocess.pixels,
	});
	const brightnessCheck = brightnessCheckForCase({ litPacket });
	const representativeSky = representativeSelectedSample({
		postprocess,
		predicate: (sample) => !sample.hit,
	});
	const representativeHit = representativeSelectedSample({
		postprocess,
		predicate: (sample) => sample.hit,
	});
	const sourceTrace = makeSourceTrace({
		caseKey,
		command: browserCommand,
		litPacket,
		postprocess,
		sourceLightCheck,
		brightnessCheck,
		shadowCheck,
		representativeSky,
		representativeHit,
	});
	const criteria = buildCaseCriteria({
		diagnostics,
		litPacket,
		postprocess,
		zeroDensityCheck,
		sourceLightCheck,
		shadowCheck,
		brightnessCheck,
	});
	const summary = summarizeCriteria(criteria);
	const caseSummary = {
		caseKey,
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		summary,
		browserRun: path
			.relative(REPO_ROOT, caseOption.browserRun)
			.replaceAll('\\', '/'),
		requestedSunCase: sourceLightCheck.requestedSunCase,
		packetSunCase: sourceLightCheck.packetSunCase,
		sourceLightMode: sourceLightCheck.requestedSourceLightMode,
		sourceDirectionAlgorithm: litPacket.source?.sunDirection || null,
		directionToSourceThree:
			litPacket.sceneLight?.sourceLightAgreement?.directionToSourceThree || null,
		lightTravelDirectionDelta: sourceLightCheck.lightTravelDirectionDelta,
		calibrationScalar: brightnessCheck.calibrationScalar,
		inputShadowDelta: shadowCheck.inputSceneColorLuminanceDelta,
		postAtmosphereShadowDelta: shadowCheck.postAtmosphereLuminanceDelta,
		representativeSkyRgba: representativeSky?.postprocessRgba8 || null,
		representativeHitRgba: representativeHit?.postprocessRgba8 || null,
		sunCaseResolution: postprocess.sourceContract.sunCaseResolution,
	};

	await writePng(
		path.join(caseDirectory, 'soft-shader-image.png'),
		litPacket.width,
		litPacket.height,
		postprocess.pixels
	);
	await writePng(
		path.join(caseDirectory, 'scene-color-preview.png'),
		litPacket.width,
		litPacket.height,
		Buffer.from(litPacket.sceneColorRgba8)
	);
	await writeJson(path.join(caseDirectory, 'source-trace.json'), sourceTrace);
	await writeJson(path.join(caseDirectory, 'source-light-check.json'), {
		kind: 'cpu-distant-sun-position-matrix-source-light-check',
		sourceLightCheck,
		brightnessCheck,
	});
	await writeJson(path.join(caseDirectory, 'selected-pixels.json'), {
		kind: 'cpu-distant-sun-position-matrix-selected-pixels',
		selectedPixels: postprocess.selectedPixels,
		shadowCheck,
	});
	await writeJson(path.join(caseDirectory, 'scene-input-summary.json'), {
		kind: 'cpu-distant-sun-position-matrix-scene-input-summary',
		browserRun: caseSummary.browserRun,
		lit: summarizeSceneInputPacket(litPacket),
	});
	await writeJson(path.join(caseDirectory, 'criteria-results.json'), {
		kind: 'cpu-distant-sun-position-matrix-case-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(caseDirectory, 'result.json'), {
		kind: 'cpu-distant-sun-position-matrix-case-result',
		...caseSummary,
	});

	return {
		caseKey,
		caseDirectory,
		caseSummary,
		criteria,
		summary,
		litPacket,
		postprocess,
		sourceTrace,
		sourceLightCheck,
		shadowCheck,
		brightnessCheck,
		representativeSky,
		representativeHit,
	};
}

function sourceLightCouplingCheck({ command, litPacket, postprocess }) {
	const requestedSunCase = sunCaseId(command?.payload?.sunCase);
	const requestedSourceLightMode = command?.payload?.sourceLightMode || null;
	const source = litPacket.source || {};
	const sceneLight = litPacket.sceneLight || {};
	const agreement = sceneLight.sourceLightAgreement || {};
	const lightTravelDirectionDelta =
		agreement.lightTravelDirectionDelta ?? Number.POSITIVE_INFINITY;
	const sunCaseResolution = postprocess.sourceContract?.sunCaseResolution || {};
	return {
		requestedSunCase,
		requestedSourceLightMode,
		packetSunCase: source.sunCase || null,
		postprocessSunCase: postprocess.sunCase?.id || null,
		sceneLightSunCase: sceneLight.sunCase || null,
		packetSource: source,
		sceneLight,
		sunCaseResolution,
		sourceSunCaseMatches:
			source.sunCase === requestedSunCase &&
			sceneLight.sunCase === requestedSunCase &&
			postprocess.sunCase?.id === requestedSunCase,
		sourceLightModeMatches:
			requestedSourceLightMode === 'distant-directional-sun' &&
			sceneLight.mode === 'distant-directional-sun' &&
			sceneLight.kind === 'source-driven-distant-directional-light',
		lightTravelDirectionDelta,
		lightTravelDirectionMatches: lightTravelDirectionDelta <= 1e-12,
		noDefaultFallback:
			requestedSunCase === source.sunCase &&
			requestedSunCase === sceneLight.sunCase &&
			requestedSourceLightMode === sceneLight.mode &&
			sunCaseResolution.status !== 'fallback-default-sun-case',
	};
}

function brightnessCheckForCase({ litPacket }) {
	const sceneLight = litPacket.sceneLight || {};
	const selected = litPacket.selectedPixels || [];
	const maxSelectedSceneByte = Math.max(
		...selected.flatMap((sample) => sample.rgba?.slice(0, 3) || [0])
	);
	const brightestGround =
		litPacket.shadowCheck?.brightestGround ||
		selected.find((sample) => sample.id === 'brightest-ground') ||
		null;
	return {
		calibrationScalar: sceneLight.calibrationScalar,
		directionalIntensity: sceneLight.intensity,
		colorRgb: sceneLight.colorRgb,
		brightestGround,
		maxSelectedSceneByte,
		accepted:
			sceneLight.calibrationScalar === sceneLight.intensity &&
			sceneLight.intensity > 0 &&
			Number.isFinite(maxSelectedSceneByte) &&
			maxSelectedSceneByte < 255,
	};
}

function buildCaseCriteria({
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

function buildMatrixCriteria(caseResults) {
	const caseKeys = new Set(caseResults.map((item) => item.caseKey));
	const missingRequired = REQUIRED_CASE_KEYS.filter((key) => !caseKeys.has(key));
	const directionDiagnostics = directionVariationDiagnostics(caseResults);
	const brightnessDiagnostics = luminanceRangeDiagnostics(
		caseResults,
		(item) => item.brightnessCheck.brightestGround?.luminance,
		'brightest-ground-scene-luminance'
	);
	const skyDiagnostics = luminanceRangeDiagnostics(
		caseResults,
		(item) => luminance(item.representativeSky?.postprocessRgba8 || null),
		'representative-sky-postprocess-luminance'
	);
	const shadowDiagnostics = shadowVariationDiagnostics(caseResults);
	const highControl = caseResults.find((item) => item.caseKey === 'high');

	return [
		{
			id: 'default-distant-sun-position-matrix-covered',
			status:
				caseResults.length >= REQUIRED_CASE_KEYS.length &&
				missingRequired.length === 0
					? 'passed'
					: 'failed',
			measured: {
				required: REQUIRED_CASE_KEYS,
				present: [...caseKeys],
				missing: missingRequired,
			},
		},
		{
			id: 'all-cases-accepted',
			status: caseResults.every((item) => item.summary.failed === 0)
				? 'passed'
				: 'failed',
			measured: Object.fromEntries(
				caseResults.map((item) => [item.caseKey, item.summary])
			),
		},
		{
			id: 'source-directions-vary-across-matrix',
			status: directionDiagnostics.maxAngleDegrees > 20 ? 'passed' : 'failed',
			measured: directionDiagnostics,
		},
		{
			id: 'surface-brightness-changes-with-source-position',
			status: brightnessDiagnostics.range > 1 ? 'passed' : 'failed',
			measured: brightnessDiagnostics,
		},
		{
			id: 'sky-radiance-changes-with-source-position',
			status: skyDiagnostics.range > 1 ? 'passed' : 'failed',
			measured: skyDiagnostics,
		},
		{
			id: 'shadow-response-changes-with-source-position',
			status:
				shadowDiagnostics.uniqueDarkestGroundPixels > 1 ||
				shadowDiagnostics.postAtmosphereDeltaRange > 1
					? 'passed'
					: 'failed',
			measured: shadowDiagnostics,
		},
		{
			id: 'high-sun-control-remains-source-driven',
			status:
				highControl?.sourceLightCheck?.requestedSunCase ===
					'figure1-13h15-z21' &&
				highControl.sourceLightCheck.noDefaultFallback &&
				highControl.brightnessCheck.calibrationScalar === 2.4
					? 'passed'
					: 'failed',
			measured: highControl?.caseSummary || null,
		},
	];
}

function makeSourceTrace({
	caseKey,
	command,
	litPacket,
	postprocess,
	sourceLightCheck,
	brightnessCheck,
	shadowCheck,
	representativeSky,
	representativeHit,
}) {
	return {
		kind: 'cpu-distant-sun-position-matrix-source-trace',
		caseKey,
		requestedSunCase: sunCaseId(command?.payload?.sunCase),
		requestedSourceLightMode: command?.payload?.sourceLightMode || null,
		packetSource: litPacket.source || null,
		sceneLight: litPacket.sceneLight || null,
		postprocessSunCase: postprocess.sunCase,
		sunCaseResolution: postprocess.sourceContract.sunCaseResolution,
		sourceLightCheck,
		brightnessCheck,
		shadowCheck,
		representativeSky,
		representativeHit,
	};
}

function summarizeMatrixDiagnostics(caseResults) {
	return {
		directionVariation: directionVariationDiagnostics(caseResults),
		brightnessVariation: luminanceRangeDiagnostics(
			caseResults,
			(item) => item.brightnessCheck.brightestGround?.luminance,
			'brightest-ground-scene-luminance'
		),
		skyVariation: luminanceRangeDiagnostics(
			caseResults,
			(item) => luminance(item.representativeSky?.postprocessRgba8 || null),
			'representative-sky-postprocess-luminance'
		),
		shadowVariation: shadowVariationDiagnostics(caseResults),
	};
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

function directionVariationDiagnostics(caseResults) {
	let maxAngleDegrees = 0;
	let maxPair = null;
	for (let a = 0; a < caseResults.length; a += 1) {
		for (let b = a + 1; b < caseResults.length; b += 1) {
			const left = caseResults[a].litPacket.source?.sunDirection || [];
			const right = caseResults[b].litPacket.source?.sunDirection || [];
			const angle = angleDegrees(left, right);
			if (angle > maxAngleDegrees) {
				maxAngleDegrees = angle;
				maxPair = [caseResults[a].caseKey, caseResults[b].caseKey];
			}
		}
	}
	return {
		maxAngleDegrees,
		maxPair,
		perCase: Object.fromEntries(
			caseResults.map((item) => [
				item.caseKey,
				item.litPacket.source?.sunDirection || null,
			])
		),
	};
}

function luminanceRangeDiagnostics(caseResults, getter, label) {
	const values = caseResults
		.map((item) => ({
			caseKey: item.caseKey,
			value: getter(item),
		}))
		.filter((item) => Number.isFinite(item.value));
	const numbers = values.map((item) => item.value);
	const min = numbers.length ? Math.min(...numbers) : null;
	const max = numbers.length ? Math.max(...numbers) : null;
	return {
		label,
		values,
		min,
		max,
		range: min === null || max === null ? 0 : max - min,
	};
}

function shadowVariationDiagnostics(caseResults) {
	const darkestPixels = caseResults
		.map((item) => {
			const sample = item.shadowCheck.darkestGround?.input;
			return sample ? `${sample.x},${sample.y}` : null;
		})
		.filter(Boolean);
	const deltas = caseResults
		.map((item) => item.shadowCheck.postAtmosphereLuminanceDelta)
		.filter(Number.isFinite);
	const minDelta = deltas.length ? Math.min(...deltas) : null;
	const maxDelta = deltas.length ? Math.max(...deltas) : null;
	return {
		darkestGroundPixels: Object.fromEntries(
			caseResults.map((item) => [
				item.caseKey,
				item.shadowCheck.darkestGround?.input
					? {
							x: item.shadowCheck.darkestGround.input.x,
							y: item.shadowCheck.darkestGround.input.y,
						}
					: null,
			])
		),
		uniqueDarkestGroundPixels: new Set(darkestPixels).size,
		postAtmosphereDeltas: Object.fromEntries(
			caseResults.map((item) => [
				item.caseKey,
				item.shadowCheck.postAtmosphereLuminanceDelta,
			])
		),
		postAtmosphereDeltaRange:
			minDelta === null || maxDelta === null ? 0 : maxDelta - minDelta,
	};
}

function representativeSelectedSample({ postprocess, predicate }) {
	return postprocess.selectedPixels.find(predicate) || null;
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

function makeReport({ packet, matrixCriteria, caseResults }) {
	return [
		'# CPU Distant-Sun Position Matrix',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Validate the source-driven distant-Sun lighting path across high, low, side, and behind-camera Sun positions before introducing local Sun behavior.',
		'',
		'## Summary',
		'',
		`- Cases: ${caseResults.map((item) => item.caseKey).join(', ')}.`,
		`- Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		'',
		'## Matrix Criteria',
		'',
		...matrixCriteria.map(
			(criterion) => `- ${criterion.id}: ${criterion.status}.`
		),
		'',
		'## Case Summary',
		'',
		...caseResults.map(
			(item) =>
				`- ${item.caseKey}: ${item.caseSummary.status}, source ${item.caseSummary.packetSunCase}, post-shadow delta ${item.caseSummary.postAtmosphereShadowDelta}.`
		),
		'',
		'## Limitations',
		'',
		'- This remains RGBA8 display-domain POC transport for scene color.',
		'- Local finite-source behavior is deferred to Milestone 18.',
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

function findDuplicateKeys(cases) {
	const seen = new Set();
	const duplicates = new Set();
	for (const item of cases) {
		if (seen.has(item.key)) {
			duplicates.add(item.key);
		}
		seen.add(item.key);
	}
	return [...duplicates];
}

function sunCaseId(value) {
	if (!value) {
		return null;
	}
	if (typeof value === 'object') {
		return value.id || null;
	}
	return value;
}

function angleDegrees(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length < 3 || b.length < 3) {
		return 0;
	}
	const denominator = length(a) * length(b);
	if (denominator === 0) {
		return 0;
	}
	const cosine = clamp(dot(a, b) / denominator, -1, 1);
	return Math.acos(cosine) * (180 / Math.PI);
}

function luminance(rgba) {
	if (!Array.isArray(rgba) || rgba.length < 3) {
		return null;
	}
	return rgba[0] * 0.2126 + rgba[1] * 0.7152 + rgba[2] * 0.0722;
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
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
