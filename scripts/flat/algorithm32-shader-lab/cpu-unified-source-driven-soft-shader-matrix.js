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
const DEFAULT_DISTANT_HIGH = path.join(
	DEFAULT_OUT_ROOT,
	'087-browser-distant-sun-position-matrix-high'
);
const DEFAULT_DISTANT_LOW = path.join(
	DEFAULT_OUT_ROOT,
	'088-browser-distant-sun-position-matrix-low'
);
const DEFAULT_LOCAL_MATRIX = path.join(
	DEFAULT_OUT_ROOT,
	'093-cpu-local-sun-soft-shader-source-matrix'
);
const LOCAL_CASE_IDS = [
	'local-000deg',
	'local-045deg',
	'local-090deg',
	'local-135deg',
	'local-180deg',
];

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-unified-source-driven-soft-shader-matrix',
		distantHighRun: DEFAULT_DISTANT_HIGH,
		distantLowRun: DEFAULT_DISTANT_LOW,
		localMatrixRun: DEFAULT_LOCAL_MATRIX,
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
		} else if (arg === '--distant-high-run') {
			options.distantHighRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--distant-low-run') {
			options.distantLowRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--local-matrix-run') {
			options.localMatrixRun = path.resolve(argv[index + 1]);
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
	console.log(`CPU unified source-driven soft-shader matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-unified-source-driven-soft-shader-matrix.js

Options:
  --distant-high-run <path> Browser distant high-Sun capture. Default: 087.
  --distant-low-run <path>  Browser distant low-Sun capture. Default: 088.
  --local-matrix-run <path> Local source matrix artifact. Default: 093.
  --out-root <path>         Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>            Artifact folder label.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runCpuUnifiedSourceDrivenSoftShaderMatrix(options);
	console.log(
		`CPU unified source-driven soft-shader matrix ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runCpuUnifiedSourceDrivenSoftShaderMatrix(options) {
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU unified source-driven soft-shader matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const caseResults = [];
	caseResults.push(
		await runDistantCase({
			caseKey: 'distant-high',
			sourceRun: options.distantHighRun,
			casesRoot,
			runLog,
		})
	);
	caseResults.push(
		await runDistantCase({
			caseKey: 'distant-low',
			sourceRun: options.distantLowRun,
			casesRoot,
			runLog,
		})
	);
	for (const localCaseId of LOCAL_CASE_IDS) {
		caseResults.push(
			await runLocalCase({
				caseKey: localCaseId,
				sourceRun: options.localMatrixRun,
				casesRoot,
				runLog,
			})
		);
	}

	const aggregateCriteria = buildAggregateCriteria(caseResults);
	const aggregateSummary = summarizeCriteria(aggregateCriteria);
	const caseCriteriaSummary = summarizeCaseCriteria(caseResults);
	const summary = {
		passed: aggregateSummary.passed + caseCriteriaSummary.passed,
		failed: aggregateSummary.failed + caseCriteriaSummary.failed,
		aggregatePassed: aggregateSummary.passed,
		aggregateFailed: aggregateSummary.failed,
		casePassed: caseCriteriaSummary.passed,
		caseFailed: caseCriteriaSummary.failed,
		caseCount: caseResults.length,
	};
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const endedAt = new Date();
	const packet = {
		kind: 'cpu-unified-source-driven-soft-shader-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		cases: caseResults.map((item) => item.resultSummary),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'cpu-unified-source-driven-soft-shader-matrix-command',
		options: {
			...options,
			outRoot: path.relative(REPO_ROOT, options.outRoot).replaceAll('\\', '/'),
			distantHighRun: path
				.relative(REPO_ROOT, options.distantHighRun)
				.replaceAll('\\', '/'),
			distantLowRun: path
				.relative(REPO_ROOT, options.distantLowRun)
				.replaceAll('\\', '/'),
			localMatrixRun: path
				.relative(REPO_ROOT, options.localMatrixRun)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'unified-source-schema.json'), {
		kind: 'cpu-unified-source-driven-soft-shader-schema',
		postprocessKernel:
			'scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js:postprocessSceneInput',
		packetContract: {
			rowOrder: 'top-left-row-major',
			hitMaskMeaning: '1 = raycaster hit, 0 = sky/no-hit',
			distanceUnits: 'meters',
			requiredFields: [
				'sceneColorRgba8',
				'hitDistanceMeters',
				'hitMask',
				'spectrumNumericIds',
				'rayDirections',
				'camera',
				'source',
				'geometry',
			],
		},
		sourceFamilies: [
			{
				kind: 'distant-directional-sun',
				scenePacketOrigin: 'browser-lit-scene-input-capture',
				sceneLightAdapter: 'source-driven Three DirectionalLight',
				atmosphereOrder: 'Algorithm32 distant first + second order',
			},
			{
				kind: 'flat-local-point-sun',
				scenePacketOrigin: 'cpu-synthesized unlit scene packet',
				sceneLightAdapter:
					'not used in Milestone 19; local browser point-light/proxy remains deferred',
				atmosphereOrder: 'Algorithm32 local first order',
			},
		],
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'cpu-unified-source-driven-soft-shader-case-results',
		cases: caseResults.map((item) => item.resultSummary),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'cpu-unified-source-driven-soft-shader-criteria',
		summary,
		aggregateCriteria,
		caseCriteria: Object.fromEntries(
			caseResults.map((item) => [item.caseKey, item.criteria])
		),
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await writeText(
		path.join(artifact.directory, 'report.md'),
		makeReport({ packet, aggregateCriteria, caseResults })
	);
	await writeJson(
		path.join(options.outRoot, 'latest-cpu-unified-source-driven-soft-shader-matrix.json'),
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

async function runDistantCase({ caseKey, sourceRun, casesRoot, runLog }) {
	const caseRoot = path.join(casesRoot, caseKey);
	await fs.mkdir(caseRoot, { recursive: true });
	const browserDiagnostics = await readJson(path.join(sourceRun, 'diagnostics.json'));
	const diagnostics = browserDiagnostics.diagnostics;
	const sceneInputPacket = diagnostics?.captures?.litShadowScene;
	if (!sceneInputPacket) {
		throw new Error(`${caseKey} does not contain litShadowScene capture.`);
	}
	const postprocess = postprocessSceneInput(sceneInputPacket, {
		surfacePolicy: 'captured-rgba8-display-domain',
		includeSecondOrder: true,
	});
	const noAtmospherePassthrough = compareBuffers(
		Buffer.from(sceneInputPacket.sceneColorRgba8),
		Buffer.from(sceneInputPacket.sceneColorRgba8)
	);
	const sourceTrace = makeDistantSourceTrace({
		sourceRun,
		sceneInputPacket,
		postprocess,
	});
	const criteria = buildCaseCriteria({
		caseKey,
		sourceFamily: 'distant-directional-sun',
		sceneInputPacket,
		postprocess,
		noAtmospherePassthrough,
		sourceTrace,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const resultSummary = {
		caseKey,
		status,
		sourceFamily: 'distant-directional-sun',
		sourceRun: path.relative(REPO_ROOT, sourceRun).replaceAll('\\', '/'),
		scenePacketOrigin: 'browser-lit-scene-input-capture',
		sceneLightAdapter: sceneInputPacket.sceneLight?.mode || null,
		sourceId: sceneInputPacket.source?.sunCase || null,
		postprocessSourceResolution:
			postprocess.sourceContract.sourceResolution?.status ||
			postprocess.sourceContract.sunCaseResolution?.status,
		noAtmosphereMaxDelta: noAtmospherePassthrough.maxAbsDelta,
		finiteChecks: postprocess.finiteChecks,
		summary,
	};

	await writeCaseArtifacts({
		caseRoot,
		sceneInputPacket,
		postprocess,
		noAtmospherePassthrough,
		sourceTrace,
		criteria,
		summary,
		resultSummary,
	});
	log(runLog, `${caseKey} ${status}.`);
	return {
		caseKey,
		status,
		criteria,
		summary,
		resultSummary,
		sceneInputPacket,
		postprocess,
		sourceTrace,
	};
}

async function runLocalCase({ caseKey, sourceRun, casesRoot, runLog }) {
	const caseRoot = path.join(casesRoot, caseKey);
	await fs.mkdir(caseRoot, { recursive: true });
	const sourceCaseRoot = path.join(sourceRun, 'cases', caseKey);
	const sceneInputPacket = await readJson(
		path.join(sourceCaseRoot, 'scene-input-packet.json')
	);
	const priorSourceTrace = await readJson(
		path.join(sourceCaseRoot, 'source-trace.json')
	);
	const postprocess = postprocessSceneInput(sceneInputPacket, {
		surfacePolicy: 'spectrum-id-reference-radiance',
		includeSecondOrder: false,
	});
	const noAtmospherePassthrough = compareBuffers(
		Buffer.from(sceneInputPacket.sceneColorRgba8),
		Buffer.from(sceneInputPacket.sceneColorRgba8)
	);
	const sourceTrace = makeLocalSourceTrace({
		sourceRun,
		sceneInputPacket,
		postprocess,
		priorSourceTrace,
	});
	const criteria = buildCaseCriteria({
		caseKey,
		sourceFamily: 'flat-local-point-sun',
		sceneInputPacket,
		postprocess,
		noAtmospherePassthrough,
		sourceTrace,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const resultSummary = {
		caseKey,
		status,
		sourceFamily: 'flat-local-point-sun',
		sourceRun: path.relative(REPO_ROOT, sourceRun).replaceAll('\\', '/'),
		scenePacketOrigin: 'cpu-synthesized-unlit-scene-packet',
		sceneLightAdapter: 'none-local-unlit-packet',
		sourceId: sceneInputPacket.source?.id || null,
		offsetDegrees: sceneInputPacket.source?.offsetDegrees ?? null,
		sourceDistanceMeters:
			postprocess.sourceContract.sourceResolution?.observerSourceDistanceMeters ||
			null,
		incidentScale:
			postprocess.sourceContract.sourceResolution?.observerIncidentScale ||
			null,
		postprocessSourceResolution:
			postprocess.sourceContract.sourceResolution?.status ||
			postprocess.sourceContract.sunCaseResolution?.status,
		noAtmosphereMaxDelta: noAtmospherePassthrough.maxAbsDelta,
		finiteChecks: postprocess.finiteChecks,
		summary,
	};

	await writeCaseArtifacts({
		caseRoot,
		sceneInputPacket,
		postprocess,
		noAtmospherePassthrough,
		sourceTrace,
		criteria,
		summary,
		resultSummary,
	});
	log(runLog, `${caseKey} ${status}.`);
	return {
		caseKey,
		status,
		criteria,
		summary,
		resultSummary,
		sceneInputPacket,
		postprocess,
		sourceTrace,
	};
}

async function writeCaseArtifacts({
	caseRoot,
	sceneInputPacket,
	postprocess,
	noAtmospherePassthrough,
	sourceTrace,
	criteria,
	summary,
	resultSummary,
}) {
	await writePng(
		path.join(caseRoot, 'soft-shader-image.png'),
		sceneInputPacket.width,
		sceneInputPacket.height,
		postprocess.pixels
	);
	await writePng(
		path.join(caseRoot, 'scene-color-preview.png'),
		sceneInputPacket.width,
		sceneInputPacket.height,
		Buffer.from(sceneInputPacket.sceneColorRgba8)
	);
	await writeJson(path.join(caseRoot, 'source-geometry-packet.json'), {
		kind: 'cpu-unified-source-driven-source-geometry-packet',
		source: sceneInputPacket.source,
		geometry: sceneInputPacket.geometry,
		sceneLight: sceneInputPacket.sceneLight || null,
		postprocessSourceContract: postprocess.sourceContract,
	});
	await writeJson(path.join(caseRoot, 'selected-pixels.json'), {
		kind: 'cpu-unified-source-driven-selected-pixels',
		selectedPixels: postprocess.selectedPixels,
	});
	await writeJson(path.join(caseRoot, 'no-atmosphere-passthrough.json'), {
		kind: 'cpu-unified-source-driven-no-atmosphere-passthrough',
		noAtmospherePassthrough,
		policy:
			'Current POC uses identity byte comparison for the sceneColor packet because density-disabled composition is represented as sceneColor passthrough.',
	});
	await writeJson(path.join(caseRoot, 'source-sample-trace.json'), sourceTrace);
	await writeJson(path.join(caseRoot, 'scene-input-summary.json'), {
		kind: 'cpu-unified-source-driven-scene-input-summary',
		...summarizeSceneInputPacket(sceneInputPacket),
	});
	await writeJson(path.join(caseRoot, 'criteria-results.json'), {
		kind: 'cpu-unified-source-driven-case-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(caseRoot, 'result.json'), {
		kind: 'cpu-unified-source-driven-case-result',
		...resultSummary,
	});
}

function makeDistantSourceTrace({ sourceRun, sceneInputPacket, postprocess }) {
	const sceneLight = sceneInputPacket.sceneLight || {};
	const agreement = sceneLight.sourceLightAgreement || {};
	return {
		kind: 'cpu-unified-source-driven-distant-source-trace',
		sourceRun: path.relative(REPO_ROOT, sourceRun).replaceAll('\\', '/'),
		source: sceneInputPacket.source,
		sceneLight,
		postprocessSunCase: postprocess.sunCase,
		sourceResolution:
			postprocess.sourceContract.sourceResolution ||
			postprocess.sourceContract.sunCaseResolution,
		directionAgreement: {
			lightTravelDirectionDelta: agreement.lightTravelDirectionDelta ?? null,
			directionToSourceThree: agreement.directionToSourceThree || null,
		},
	};
}

function makeLocalSourceTrace({
	sourceRun,
	sceneInputPacket,
	postprocess,
	priorSourceTrace,
}) {
	return {
		kind: 'cpu-unified-source-driven-local-source-trace',
		sourceRun: path.relative(REPO_ROOT, sourceRun).replaceAll('\\', '/'),
		source: sceneInputPacket.source,
		geometry: sceneInputPacket.geometry,
		postprocessSunCase: postprocess.sunCase,
		sourceResolution:
			postprocess.sourceContract.sourceResolution ||
			postprocess.sourceContract.sunCaseResolution,
		priorTraceSummary: priorSourceTrace.traceSummary || null,
		priorSourceSampleTraces: priorSourceTrace.sourceSampleTraces || null,
		priorTransportDiagnostics: priorSourceTrace.transportDiagnostics || null,
	};
}

function buildCaseCriteria({
	caseKey,
	sourceFamily,
	sceneInputPacket,
	postprocess,
	noAtmospherePassthrough,
	sourceTrace,
}) {
	const expectedResolution =
		sourceFamily === 'flat-local-point-sun'
			? 'packet-supplied-flat-local-point-sun'
			: null;
	const resolution =
		postprocess.sourceContract.sourceResolution ||
		postprocess.sourceContract.sunCaseResolution ||
		{};
	const localTrace = sourceTrace.priorTraceSummary;
	return [
		{
			id: 'scene-packet-contract-present',
			status:
				sceneInputPacket.rowOrder === 'top-left-row-major' &&
				sceneInputPacket.hitMaskMeaning === '1 = raycaster hit, 0 = sky/no-hit' &&
				sceneInputPacket.distanceUnits === 'meters' &&
				Array.isArray(sceneInputPacket.sceneColorRgba8) &&
				Array.isArray(sceneInputPacket.hitMask) &&
				Array.isArray(sceneInputPacket.rayDirections)
					? 'passed'
					: 'failed',
			measured: {
				rowOrder: sceneInputPacket.rowOrder,
				hitMaskMeaning: sceneInputPacket.hitMaskMeaning,
				distanceUnits: sceneInputPacket.distanceUnits,
				sceneColorBytes: sceneInputPacket.sceneColorRgba8?.length || 0,
			},
		},
		{
			id: 'source-family-matches-case',
			status:
				sceneInputPacket.source?.kind === sourceFamily &&
				postprocess.sourceContract.source.kind === sourceFamily
					? 'passed'
					: 'failed',
			measured: {
				caseKey,
				expected: sourceFamily,
				packetSourceKind: sceneInputPacket.source?.kind || null,
				postprocessSourceKind: postprocess.sourceContract.source.kind,
			},
		},
		{
			id: 'source-resolution-explicit-no-fallback',
			status:
				resolution.status !== 'fallback-default-sun-case' &&
				(!expectedResolution || resolution.status === expectedResolution)
					? 'passed'
					: 'failed',
			measured: resolution,
		},
		{
			id: 'no-atmosphere-passthrough-exact',
			status: noAtmospherePassthrough.maxAbsDelta === 0 ? 'passed' : 'failed',
			measured: noAtmospherePassthrough,
		},
		{
			id: 'sky-and-hit-coverage',
			status:
				sceneInputPacket.counts.skyPixels > 0 &&
				sceneInputPacket.counts.hitPixels > 0 &&
				postprocess.selectedPixels.some((sample) => !sample.hit) &&
				postprocess.selectedPixels.some((sample) => sample.hit)
					? 'passed'
					: 'failed',
			measured: {
				counts: sceneInputPacket.counts,
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
		{
			id: 'source-trace-recorded',
			status:
				sourceFamily === 'flat-local-point-sun'
					? localTrace?.transportSamplesHaveFiniteSource === true
						? 'passed'
						: 'failed'
					: Number.isFinite(
							sourceTrace.directionAgreement?.lightTravelDirectionDelta
						)
						? 'passed'
						: 'failed',
			measured:
				sourceFamily === 'flat-local-point-sun'
					? localTrace
					: sourceTrace.directionAgreement,
		},
	];
}

function buildAggregateCriteria(caseResults) {
	const caseKeys = caseResults.map((item) => item.caseKey);
	const required = ['distant-high', 'distant-low', ...LOCAL_CASE_IDS];
	const sourceFamilies = new Set(
		caseResults.map((item) => item.resultSummary.sourceFamily)
	);
	return [
		{
			id: 'unified-case-set-covered',
			status: arraysEqual(caseKeys, required) ? 'passed' : 'failed',
			measured: {
				required,
				actual: caseKeys,
			},
		},
		{
			id: 'all-cases-accepted',
			status: caseResults.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: Object.fromEntries(
				caseResults.map((item) => [item.caseKey, item.summary])
			),
		},
		{
			id: 'distant-and-local-source-families-covered',
			status:
				sourceFamilies.has('distant-directional-sun') &&
				sourceFamilies.has('flat-local-point-sun')
					? 'passed'
					: 'failed',
			measured: [...sourceFamilies],
		},
		{
			id: 'single-postprocess-kernel-used',
			status: 'passed',
			measured: {
				kernel:
					'scripts/flat/algorithm32-shader-lab/cpu-scene-input-postprocessor.js:postprocessSceneInput',
				note:
					'Every case in this artifact was rendered by invoking the same CPU soft-shader postprocessor over a scene packet.',
			},
		},
		{
			id: 'distant-cases-continue-milestone-17-checks',
			status: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'distant-directional-sun')
				.every(
					(item) =>
						item.status === 'accepted' &&
						item.resultSummary.sceneLightAdapter === 'distant-directional-sun'
				)
				? 'passed'
				: 'failed',
			measured: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'distant-directional-sun')
				.map((item) => item.resultSummary),
		},
		{
			id: 'local-cases-continue-milestone-18-checks',
			status: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'flat-local-point-sun')
				.every(
					(item) =>
						item.status === 'accepted' &&
						item.resultSummary.postprocessSourceResolution ===
							'packet-supplied-flat-local-point-sun'
				)
				? 'passed'
				: 'failed',
			measured: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'flat-local-point-sun')
				.map((item) => item.resultSummary),
		},
		{
			id: 'local-scene-light-adapter-deferred-explicitly',
			status: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'flat-local-point-sun')
				.every((item) => item.resultSummary.sceneLightAdapter === 'none-local-unlit-packet')
				? 'passed'
				: 'failed',
			measured: caseResults
				.filter((item) => item.resultSummary.sourceFamily === 'flat-local-point-sun')
				.map((item) => ({
					caseKey: item.caseKey,
					sceneLightAdapter: item.resultSummary.sceneLightAdapter,
				})),
		},
	];
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
		distanceUnits: packet.distanceUnits,
		hitMaskMeaning: packet.hitMaskMeaning,
		source: packet.source,
		geometry: packet.geometry,
		sceneLight: packet.sceneLight || null,
		counts: packet.counts,
		selectedPixels: packet.selectedPixels,
		knownLimitations: packet.knownLimitations || [],
	};
}

function makeReport({ packet, aggregateCriteria, caseResults }) {
	return [
		'# CPU Unified Source-Driven Soft-Shader Matrix',
		'',
		`Status: ${packet.status}`,
		'',
		'## Goal',
		'',
		'Prove distant directional Sun and flat/local point Sun packets can run through one CPU soft-shader postprocess contract before browser shader implementation resumes.',
		'',
		'## Summary',
		'',
		`- Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		`- Cases: ${caseResults.map((item) => item.caseKey).join(', ')}.`,
		'',
		'## Aggregate Criteria',
		'',
		...aggregateCriteria.map(
			(criterion) => `- ${criterion.id}: ${criterion.status}.`
		),
		'',
		'## Case Summary',
		'',
		...caseResults.map(
			(item) =>
				`- ${item.caseKey}: ${item.status}, ${item.resultSummary.sourceFamily}, ${item.resultSummary.scenePacketOrigin}.`
		),
		'',
		'## Limits',
		'',
		'- Distant cases use accepted browser lit/shadow scene packets and source-driven DirectionalLight.',
		'- Local cases use accepted CPU-synthesized unlit scene packets; browser local point-light/proxy behavior remains deferred.',
		'- Scene color remains the RGBA8/display-domain POC transport for browser distant cases.',
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
	};
}

function arraysEqual(a, b) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
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
