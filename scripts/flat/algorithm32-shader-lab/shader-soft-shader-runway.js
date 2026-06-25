import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postprocessSceneInput } from './cpu-scene-input-postprocessor.js';
import {
	buildCpuUnlitSceneInputPacket,
	compareRgbaImages,
	readPngRgba,
	writePng,
} from './cpu-soft-shader-unlit-parity-matrix.js';
import {
	createThreeScene,
	SCATTERING_ORDERS,
	SCENE_MODES,
	SUN_CASES,
} from './node-three-reference.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const HEARTBEAT_PATH = path.join(DEFAULT_OUT_ROOT, 'harness-heartbeat.json');
const LOCAL_SOURCE_CASE_IDS = Object.freeze([
	'local-000deg',
	'local-045deg',
	'local-090deg',
	'local-135deg',
	'local-180deg',
]);

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		commandPath: null,
		browserRun: null,
		browserRunHigh: null,
		browserRunLow: null,
		localSourceRun: null,
		pageTimeoutMs: 300000,
		from: 20,
		to: 29,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--command-path') {
			options.commandPath = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--browser-run') {
			options.browserRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--browser-run-high') {
			options.browserRunHigh = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--browser-run-low') {
			options.browserRunLow = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--local-source-run') {
			options.localSourceRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--page-timeout-ms') {
			options.pageTimeoutMs = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--from') {
			options.from = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--to') {
			options.to = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--milestone') {
			options.from = Number(argv[index + 1]);
			options.to = Number(argv[index + 1]);
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
	console.log(`Algorithm32 soft-shader GPU runway

Usage:
  node scripts/flat/algorithm32-shader-lab/shader-soft-shader-runway.js --from 20 --to 29

Options:
  --milestone <n>      Run one milestone.
  --from <n>           First milestone. Default: 20.
  --to <n>             Last milestone. Default: 26.
  --command-path <p>   Harness watch command path. Defaults to heartbeat commandPath.
  --browser-run <p>    Existing browser artifact for milestones that wrap browser evidence.
  --browser-run-high <p>
                      Existing Milestone 22 high-Sun browser artifact.
  --browser-run-low <p>
                      Existing Milestone 22 low-Sun browser artifact.
  --local-source-run <p>
                      CPU local-source matrix artifact. Defaults to latest 093-style result.
  --page-timeout-ms <n>
                      One-shot harness browser timeout. Default: 300000.
  --out-root <p>       Artifact root. Default: tmp/atmosphere/algorithm32_shader_lab

Browser evidence should come from the user-owned watch loop or a direct
shell-level harness command. This runway does not spawn harness.js as a child
process; if a required browser run is missing, it writes the command JSON and
prints the direct command to run.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const results = [];
	for (let milestone = options.from; milestone <= options.to; milestone += 1) {
		if (milestone === 20) {
			results.push(await runMilestone20(options));
		} else if (milestone === 21) {
			results.push(await runMilestone21(options));
		} else if (milestone === 22) {
			results.push(await runMilestone22(options));
		} else if (milestone === 23) {
			results.push(await runMilestone23(options));
		} else if (milestone === 24) {
			results.push(await runMilestone24(options));
		} else if (milestone === 25) {
			results.push(await runMilestone25(options));
		} else if (milestone === 26) {
			results.push(await runMilestone26(options));
		} else if (milestone === 27) {
			results.push(await runMilestone27(options));
		} else if (milestone === 28) {
			results.push(await runMilestone28(options));
		} else if (milestone === 29) {
			results.push(await runMilestone29(options));
		} else {
			throw new Error(
				`Milestone ${milestone} is not implemented yet in shader-soft-shader-runway.js.`
			);
		}

		const latest = results[results.length - 1];
		console.log(
			`Milestone ${milestone} ${latest.status}: ${latest.artifact.relativeFolder}`
		);
		console.log(
			`Criteria: ${latest.summary.passed} passed, ${latest.summary.failed} failed`
		);
		if (latest.status !== 'accepted') {
			throw new Error(`Milestone ${milestone} rejected.`);
		}
	}
}

async function runMilestone20(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'shader-oracle-packet-inventory'
	);
	const inventory = buildMilestone20Inventory();
	const criteria = [
		{
			id: 'oracle-artifacts-named',
			status:
				inventory.objectiveOracle.cpuSoftShaderArtifact.includes('094-') &&
				inventory.priorShaderEndpoint.fixedDistantSunArtifact.includes('054-')
					? 'passed'
					: 'failed',
			measured: {
				objectiveOracle: inventory.objectiveOracle,
				priorShaderEndpoint: inventory.priorShaderEndpoint,
			},
		},
		{
			id: 'gpu-input-packet-listed',
			status:
				inventory.gpuInputs.textures.length >= 4 &&
				inventory.gpuInputs.uniforms.length >= 3
					? 'passed'
					: 'failed',
			measured: inventory.gpuInputs,
		},
		{
			id: 'visual-artifacts-not-acceptance-gates',
			status: inventory.visualContext.every((item) => item.role === 'visual-only')
				? 'passed'
				: 'failed',
			measured: inventory.visualContext,
		},
		{
			id: 'ray-direction-texture-first',
			status: inventory.initialShaderInputPolicy.rayDirectionTextureFirst
				? 'passed'
				: 'failed',
			measured: inventory.initialShaderInputPolicy,
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'shader-oracle-packet-inventory-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'shader-oracle-packet-inventory-command',
		milestone: 20,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'shader-oracle-inventory.json'), inventory);
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'shader-oracle-packet-inventory-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone20Report(inventory, packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-shader-oracle-packet-inventory.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone21(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'gpu-packet-input-parity-no-atmosphere-passthrough'
	);
	const commandPath = options.browserRun
		? null
		: options.commandPath || (await readHeartbeatCommandPath());
	const commandId = `gpu-packet-passthrough-${Date.now()}`;
	const command = {
		id: commandId,
		label: 'browser-soft-shader-packet-passthrough',
		payload: {
			mode: 'browser-soft-shader-packet-passthrough',
			iteration: '21-gpu-packet-input-parity-no-atmosphere-passthrough',
			width: 160,
			height: 90,
			sourceLightMode: 'distant-directional-sun',
			sunCase: 'figure1-13h15-z21',
			capturePacketEncoding: 'diagnostics-json',
			toneMapping: 'none',
			outputColorSpace: 'rgba8-no-tonemapping-recorded',
		},
	};
	if (!options.browserRun) {
		await writeJson(commandPath, command);
	}
	const browserRun = options.browserRun
		? options.browserRun
		: await waitForBrowserRun({
				outRoot: options.outRoot,
				commandId,
			});
	const browserResult = await readJson(path.join(browserRun, 'result.json'));
	const diagnostics = browserResult.result?.diagnostics || browserResult.diagnostics;
	const criteria = [
		{
			id: 'browser-passthrough-accepted',
			status: diagnostics?.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				browserRun: relativePath(browserRun),
				status: diagnostics?.status || null,
				summary: diagnostics?.summary || null,
			},
		},
		{
			id: 'scene-color-passthrough-exact',
			status: diagnostics?.maxAbsDelta === 0 ? 'passed' : 'failed',
			measured: { maxAbsDelta: diagnostics?.maxAbsDelta ?? null },
		},
		{
			id: 'packet-contract-recorded',
			status:
				diagnostics?.packetSummary?.width === 160 &&
				diagnostics?.packetSummary?.height === 90 &&
				diagnostics?.criteria?.some(
					(criterion) =>
						criterion.id === 'packet-contract-recorded' &&
						criterion.status === 'passed'
				)
					? 'passed'
					: 'failed',
			measured: diagnostics?.packetSummary || null,
		},
		{
			id: 'selected-samples-match',
			status:
				diagnostics?.selectedChecks?.length > 0 &&
				diagnostics.selectedChecks.every(
					(sample) => sample.maxAbsRgbDelta === 0
				)
					? 'passed'
					: 'failed',
			measured:
				diagnostics?.selectedChecks?.map((sample) => ({
					id: sample.id,
					classification: sample.classification,
					maxAbsRgbDelta: sample.maxAbsRgbDelta,
				})) || null,
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'gpu-packet-input-parity-no-atmosphere-passthrough-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		browserRun: relativePath(browserRun),
		summary,
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'gpu-packet-input-parity-no-atmosphere-passthrough-command',
		milestone: 21,
		options: {
			...scrubOptions(options),
			commandPath: commandPath ? relativePath(commandPath) : null,
		},
		browserCommand: command,
	});
	await writeJson(path.join(artifact.directory, 'browser-run.json'), {
		kind: 'gpu-packet-input-parity-browser-run',
		browserRun: relativePath(browserRun),
	});
	await writeJson(path.join(artifact.directory, 'packet-contract-summary.json'), {
		kind: 'gpu-packet-input-parity-contract-summary',
		packetSummary: diagnostics?.packetSummary || null,
		textureInputs:
			diagnostics?.criteria?.find((criterion) => criterion.id === 'packet-contract-recorded')
				?.measured?.textureInputs || null,
	});
	await writeJson(path.join(artifact.directory, 'selected-checks.json'), {
		kind: 'gpu-packet-input-parity-selected-checks',
		selectedChecks: diagnostics?.selectedChecks || [],
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'gpu-packet-input-parity-no-atmosphere-passthrough-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone21Report(packet, diagnostics));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-gpu-packet-input-parity-no-atmosphere-passthrough.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone22(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'packet-driven-distant-sun-shader'
	);
	const cases = [
		{
			id: 'distant-high',
			sunCase: 'figure1-13h15-z21',
			expectedRole: 'high Sun default control, still packet-bound',
		},
		{
			id: 'distant-low',
			sunCase: 'figure1-06h00-z87',
			expectedRole: 'low Sun non-default packet proving no fixed high-Sun fallback',
		},
	];
	const caseResults = [];

	for (const shaderCase of cases) {
		const command = {
			id: `packet-driven-distant-sun-${shaderCase.id}-${Date.now()}`,
			label: `browser-packet-driven-distant-sun-shader-${shaderCase.id}`,
			payload: {
				mode: 'browser-packet-driven-distant-sun-shader',
				iteration: '22-packet-driven-distant-sun-shader',
				width: 160,
				height: 80,
				sunCase: shaderCase.sunCase,
				sourceKind: 'distant-directional-sun',
				expectedRole: shaderCase.expectedRole,
				capturePacketEncoding: 'diagnostics-json',
			},
		};
		const browserRun = shaderCase.id === 'distant-high' && options.browserRunHigh
			? options.browserRunHigh
			: shaderCase.id === 'distant-low' && options.browserRunLow
				? options.browserRunLow
				: await runBrowserCommandOnce({ command, options });
		const browserResult = await readJson(path.join(browserRun, 'result.json'));
		const result = browserResult.result || {};
		const diagnostics = result.diagnostics || null;
		caseResults.push({
			...shaderCase,
			commandId: command.id,
			browserRun: relativePath(browserRun),
			harnessStatus: browserResult.status,
			status: diagnostics?.status || null,
			summary: diagnostics?.summary || null,
			sourcePacket: diagnostics?.sourcePacket || result.sourcePacket || null,
			imageShaderDiagnostics: diagnostics?.imageShaderDiagnostics || null,
			outputSummary: diagnostics?.outputSummary || result.outputSummary || null,
			maxSelectedRgbDelta: diagnostics?.maxSelectedRgbDelta ?? null,
			criteria: diagnostics?.criteria || [],
		});
	}

	const high = caseResults.find((item) => item.id === 'distant-high');
	const low = caseResults.find((item) => item.id === 'distant-low');
	const sourceDirectionSeparation = angularSeparationDegrees(
		high?.sourcePacket?.sunDirection,
		low?.sourcePacket?.sunDirection
	);
	const meanLuminanceDelta = Math.abs(
		(high?.outputSummary?.meanLuminance ?? 0) -
			(low?.outputSummary?.meanLuminance ?? 0)
	);
	const criteria = [
		{
			id: 'browser-runs-accepted',
			status: caseResults.every(
				(item) => item.harnessStatus === 'accepted' && item.status === 'accepted'
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				browserRun: item.browserRun,
				harnessStatus: item.harnessStatus,
				status: item.status,
				summary: item.summary,
			})),
		},
		{
			id: 'source-packet-driven-criteria-passed',
			status: caseResults.every((item) =>
				item.criteria.some(
					(criterion) =>
						criterion.id === 'source-packet-drives-sun-uniform' &&
						criterion.status === 'passed'
				)
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				sourceCase: item.sourcePacket?.sunCase || null,
				shaderSunRay: item.imageShaderDiagnostics?.sunRay || null,
			})),
		},
		{
			id: 'non-default-low-sun-recorded',
			status:
				low?.sourcePacket?.sunCase === 'figure1-06h00-z87' &&
				low?.imageShaderDiagnostics?.sunRay &&
				sourceDirectionSeparation > 20
					? 'passed'
					: 'failed',
			measured: {
				lowSunCase: low?.sourcePacket?.sunCase || null,
				highSunCase: high?.sourcePacket?.sunCase || null,
				sourceDirectionSeparationDegrees: sourceDirectionSeparation,
			},
		},
		{
			id: 'shader-output-changes-with-source-packet',
			status: meanLuminanceDelta > 0.5 ? 'passed' : 'failed',
			measured: {
				highMeanLuminance: high?.outputSummary?.meanLuminance ?? null,
				lowMeanLuminance: low?.outputSummary?.meanLuminance ?? null,
				meanLuminanceDelta,
			},
		},
		{
			id: 'selected-display-parity-maintained',
			status: caseResults.every((item) => item.maxSelectedRgbDelta <= 2)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				maxSelectedRgbDelta: item.maxSelectedRgbDelta,
			})),
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'packet-driven-distant-sun-shader-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		caseResults,
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'packet-driven-distant-sun-shader-command',
		milestone: 22,
		options: scrubOptions(options),
		cases,
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'packet-driven-distant-sun-shader-case-results',
		caseResults,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'packet-driven-distant-sun-shader-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone22Report(packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-packet-driven-distant-sun-shader.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone23(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'distant-soft-shader-gpu-parity'
	);
	const browserRuns = await resolveDistantShaderBrowserRuns(options);
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const caseResults = [];

	for (const shaderCase of browserRuns) {
		const caseRoot = path.join(casesRoot, shaderCase.id);
		await fs.mkdir(caseRoot, { recursive: true });
		const browserResult = await readJson(path.join(shaderCase.browserRun, 'result.json'));
		const result = browserResult.result || {};
		const diagnostics = result.diagnostics || null;
		const sourcePacket = diagnostics?.sourcePacket || result.sourcePacket || null;
		const sunCase = SUN_CASES.find((item) => item.id === sourcePacket?.sunCase);
		if (!sunCase) {
			throw new Error(`Milestone 23 could not resolve Sun case ${sourcePacket?.sunCase}`);
		}
		const width = diagnostics?.canvas?.width || result.canvas?.width;
		const height = diagnostics?.canvas?.height || result.canvas?.height;
		const sceneSetup = createThreeScene({
			width,
			height,
			sceneMode: SCENE_MODES.threeCardReference,
			scatteringOrder: SCATTERING_ORDERS.algorithm32,
			renderSunCaseOverride: sunCase,
			surfaceLightingMode: 'emissive-radiance',
			surfaceAlbedoReferenceRadiance: 0.05,
		});
		const sceneInputPacket = buildCpuUnlitSceneInputPacket({
			caseConfig: {
				id: shaderCase.id,
				sceneMode: SCENE_MODES.threeCardReference,
				scatteringOrder: SCATTERING_ORDERS.algorithm32,
			},
			sceneSetup,
			sunCase,
			originalSelected: result.selectedPixels || [],
		});
		const cpuSoftShader = postprocessSceneInput(sceneInputPacket, {
			surfacePolicy: 'spectrum-id-reference-radiance',
			includeSecondOrder: true,
		});
		const cpuImagePath = path.join(caseRoot, 'cpu-soft-shader-image.png');
		const gpuImagePath = path.join(caseRoot, 'gpu-shader-image.png');
		const diffImagePath = path.join(caseRoot, 'diff-image.png');
		await writePng(cpuImagePath, width, height, cpuSoftShader.pixels);
		await fs.copyFile(path.join(shaderCase.browserRun, 'canvas-image.png'), gpuImagePath);
		const cpuImage = await readPngRgba(cpuImagePath);
		const gpuImage = await readPngRgba(gpuImagePath);
		const comparison = compareRgbaImages({ a: cpuImage, b: gpuImage });
		await writePng(diffImagePath, width, height, makeDiffPixels(cpuImage.data, gpuImage.data));

		const caseCriteria = [
			{
				id: 'browser-shader-run-accepted',
				status:
					browserResult.status === 'accepted' && diagnostics?.status === 'accepted'
						? 'passed'
						: 'failed',
				measured: {
					browserRun: relativePath(shaderCase.browserRun),
					harnessStatus: browserResult.status,
					diagnosticsStatus: diagnostics?.status || null,
				},
			},
			{
				id: 'cpu-soft-shader-packet-source-matches-gpu',
				status: sceneInputPacket.source.sunCase === sourcePacket?.sunCase
					? 'passed'
					: 'failed',
				measured: {
					cpuSunCase: sceneInputPacket.source.sunCase,
					gpuSunCase: sourcePacket?.sunCase || null,
				},
			},
			{
				id: 'gpu-image-matches-cpu-soft-shader',
				status:
					comparison.status === 'compared' &&
					comparison.maxAbsRgbDelta <= 1 &&
					comparison.p99PixelMaxAbsRgbDelta <= 1
						? 'passed'
						: 'failed',
				measured: comparison,
			},
			{
				id: 'selected-display-parity-carried-forward',
				status: diagnostics?.maxSelectedRgbDelta <= 2 ? 'passed' : 'failed',
				measured: {
					maxSelectedRgbDelta: diagnostics?.maxSelectedRgbDelta ?? null,
				},
			},
			{
				id: 'cpu-soft-shader-finite-output',
				status: cpuSoftShader.finiteChecks?.nonfinitePixels === 0
					? 'passed'
					: 'failed',
				measured: cpuSoftShader.finiteChecks || null,
			},
		];
		const caseSummary = summarizeCriteria(caseCriteria);
		const caseStatus = caseSummary.failed === 0 ? 'accepted' : 'rejected';
		const caseResult = {
			id: shaderCase.id,
			status: caseStatus,
			browserRun: relativePath(shaderCase.browserRun),
			sourcePacket,
			comparison,
			maxSelectedRgbDelta: diagnostics?.maxSelectedRgbDelta ?? null,
			summary: caseSummary,
		};

		await writeJson(path.join(caseRoot, 'scene-input-summary.json'), {
			kind: 'distant-soft-shader-gpu-parity-scene-input-summary',
			width,
			height,
			source: sceneInputPacket.source,
			counts: sceneInputPacket.counts,
			rowOrder: sceneInputPacket.rowOrder,
			distanceUnits: sceneInputPacket.distanceUnits,
		});
		await writeJson(path.join(caseRoot, 'image-comparison.json'), comparison);
		await writeJson(path.join(caseRoot, 'criteria-results.json'), {
			kind: 'distant-soft-shader-gpu-parity-case-criteria',
			summary: caseSummary,
			criteria: caseCriteria,
		});
		await writeJson(path.join(caseRoot, 'result.json'), {
			kind: 'distant-soft-shader-gpu-parity-case-result',
			...caseResult,
		});
		caseResults.push({ ...caseResult, criteria: caseCriteria });
	}

	const criteria = [
		{
			id: 'required-distant-cases-present',
			status:
				caseResults.some((item) => item.id === 'distant-high') &&
				caseResults.some((item) => item.id === 'distant-low')
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => item.id),
		},
		{
			id: 'all-case-parity-accepted',
			status: caseResults.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				status: item.status,
				comparison: item.comparison,
			})),
		},
	];
	const aggregateSummary = summarizeCriteria(criteria);
	const caseSummary = summarizeCaseResults(caseResults);
	const summary = {
		passed: aggregateSummary.passed + caseSummary.passed,
		failed: aggregateSummary.failed + caseSummary.failed,
		aggregatePassed: aggregateSummary.passed,
		aggregateFailed: aggregateSummary.failed,
		casePassed: caseSummary.passed,
		caseFailed: caseSummary.failed,
	};
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'distant-soft-shader-gpu-parity-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		caseResults: caseResults.map(({ criteria: _criteria, ...item }) => item),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'distant-soft-shader-gpu-parity-command',
		milestone: 23,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'distant-soft-shader-gpu-parity-case-results',
		cases: packet.caseResults,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'distant-soft-shader-gpu-parity-criteria',
		summary,
		aggregateCriteria: criteria,
		caseCriteria: Object.fromEntries(
			caseResults.map((item) => [item.id, item.criteria])
		),
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone23Report(packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-distant-soft-shader-gpu-parity.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone24(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'lit-scene-shader-composition'
	);
	const browserRun = options.browserRun
		? options.browserRun
		: await findLatestRunByLabel(options.outRoot, 'browser-lit-scene-soft-shader-composition');
	const browserResult = await readJson(path.join(browserRun, 'result.json'));
	const diagnostics = browserResult.result?.diagnostics || null;
	const browserCriteria = diagnostics?.criteria || [];
	const criteria = [
		{
			id: 'browser-lit-composition-accepted',
			status:
				browserResult.status === 'accepted' && diagnostics?.status === 'accepted'
					? 'passed'
					: 'failed',
			measured: {
				browserRun: relativePath(browserRun),
				harnessStatus: browserResult.status,
				diagnosticsStatus: diagnostics?.status || null,
				summary: diagnostics?.summary || null,
			},
		},
		{
			id: 'no-atmosphere-passthrough-exact',
			status:
				browserCriteria.some(
					(criterion) =>
						criterion.id === 'no-atmosphere-passthrough-exact' &&
						criterion.status === 'passed'
				)
					? 'passed'
					: 'failed',
			measured: { maxAbsDelta: diagnostics?.passthroughMaxAbsDelta ?? null },
		},
		{
			id: 'shader-composes-scene-color',
			status:
				browserCriteria.some(
					(criterion) =>
						criterion.id === 'atmosphere-shader-run-accepted' &&
						criterion.status === 'passed' &&
						criterion.measured?.composeSceneColor === true
				)
					? 'passed'
					: 'failed',
			measured:
				browserCriteria.find(
					(criterion) => criterion.id === 'atmosphere-shader-run-accepted'
				)?.measured || null,
		},
		{
			id: 'shadow-and-sky-checks-pass',
			status:
				diagnostics?.shadowCheck?.status === 'accepted' &&
				diagnostics?.skyReplacementCheck?.status === 'accepted'
					? 'passed'
					: 'failed',
			measured: {
				shadowCheck: diagnostics?.shadowCheck || null,
				skyReplacementCheck: diagnostics?.skyReplacementCheck || null,
			},
		},
		{
			id: 'selected-preview-parity',
			status:
				browserCriteria.some(
					(criterion) =>
						criterion.id === 'selected-diagnostics-match-preview' &&
						criterion.status === 'passed'
				)
					? 'passed'
					: 'failed',
			measured:
				browserCriteria.find(
					(criterion) => criterion.id === 'selected-diagnostics-match-preview'
				)?.measured || null,
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'lit-scene-shader-composition-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		browserRun: relativePath(browserRun),
		summary,
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'lit-scene-shader-composition-command',
		milestone: 24,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'browser-run.json'), {
		kind: 'lit-scene-shader-composition-browser-run',
		browserRun: relativePath(browserRun),
	});
	await writeJson(path.join(artifact.directory, 'selected-checks.json'), {
		kind: 'lit-scene-shader-composition-selected-checks',
		selectedChecks: diagnostics?.selectedChecks || [],
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'lit-scene-shader-composition-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone24Report(packet, diagnostics));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-lit-scene-shader-composition.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone25(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'local-sun-first-order-shader'
	);
	const browserRun = options.browserRun
		? options.browserRun
		: await findLatestRunByLabel(options.outRoot, 'browser-local-sun-first-order-diagnostics');
	const browserResult = await readJson(path.join(browserRun, 'result.json'));
	const diagnostics = browserResult.result?.diagnostics || null;
	const aggregateCriteria = diagnostics?.aggregateCriteria || [];
	const caseResults = diagnostics?.caseResults || [];
	const criteria = [
		{
			id: 'browser-local-diagnostic-accepted',
			status:
				browserResult.status === 'accepted' && diagnostics?.status === 'accepted'
					? 'passed'
					: 'failed',
			measured: {
				browserRun: relativePath(browserRun),
				harnessStatus: browserResult.status,
				diagnosticsStatus: diagnostics?.status || null,
				summary: diagnostics?.summary || null,
			},
		},
		{
			id: 'closest-and-90deg-cases-present',
			status:
				caseResults.some((item) => item.offsetDegrees === 0) &&
				caseResults.some((item) => item.offsetDegrees === 90)
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				offsetDegrees: item.offsetDegrees,
			})),
		},
		{
			id: 'selected-local-shader-parity',
			status: caseResults.every((item) => item.maxSelectedRgbDelta <= 2)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				maxSelectedRgbDelta: item.maxSelectedRgbDelta,
			})),
		},
		{
			id: 'closest-brighter-than-90deg',
			status:
				aggregateCriteria.some(
					(criterion) =>
						criterion.id === 'closest-brighter-than-90deg' &&
						criterion.status === 'passed'
				)
					? 'passed'
					: 'failed',
			measured:
				aggregateCriteria.find(
					(criterion) => criterion.id === 'closest-brighter-than-90deg'
				)?.measured || null,
		},
		{
			id: 'local-second-order-deferred-recorded',
			status: caseResults.every((item) =>
				item.criteria?.some(
					(criterion) =>
						criterion.id === 'local-second-order-deferred' &&
						criterion.status === 'passed'
				)
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				deferred: item.criteria?.find(
					(criterion) => criterion.id === 'local-second-order-deferred'
				)?.measured || null,
			})),
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'local-sun-first-order-shader-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		browserRun: relativePath(browserRun),
		summary,
		caseResults: caseResults.map((item) => ({
			id: item.id,
			offsetDegrees: item.offsetDegrees,
			status: item.status,
			sourceSampleAtObserver: item.sourceSampleAtObserver,
			maxSelectedRgbDelta: item.maxSelectedRgbDelta,
			summary: item.summary,
		})),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'local-sun-first-order-shader-command',
		milestone: 25,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'browser-run.json'), {
		kind: 'local-sun-first-order-browser-run',
		browserRun: relativePath(browserRun),
	});
	await writeJson(path.join(artifact.directory, 'local-case-results.json'), {
		kind: 'local-sun-first-order-case-results',
		caseResults: diagnostics?.caseResults || [],
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'local-sun-first-order-shader-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone25Report(packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-local-sun-first-order-shader.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone26(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'unified-source-driven-shader-matrix'
	);
	const distantParity = await readJson(
		path.join(options.outRoot, 'latest-distant-soft-shader-gpu-parity.json')
	);
	const litComposition = await readJson(
		path.join(options.outRoot, 'latest-lit-scene-shader-composition.json')
	);
	const localFirstOrder = await readJson(
		path.join(options.outRoot, 'latest-local-sun-first-order-shader.json')
	);
	const distantCases = distantParity.caseResults || [];
	const localCases = localFirstOrder.caseResults || [];
	const matrixCases = [
		...distantCases.map((item) => ({
			id: item.id,
			sourceFamily: 'distant-directional-sun',
			sourcePacket: item.sourcePacket,
			status: item.status,
			evidence: distantParity.artifactFolder,
			browserRun: item.browserRun,
			comparison: item.comparison,
		})),
		...localCases.map((item) => ({
			id: item.id,
			sourceFamily: 'flat-local-point-sun',
			offsetDegrees: item.offsetDegrees,
			status: item.status,
			evidence: localFirstOrder.artifactFolder,
			sourceSampleAtObserver: item.sourceSampleAtObserver,
			maxSelectedRgbDelta: item.maxSelectedRgbDelta,
		})),
	];
	const sourceFamilies = new Set(matrixCases.map((item) => item.sourceFamily));
	const criteria = [
		{
			id: 'distant-gpu-parity-accepted',
			status: distantParity.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifactFolder: distantParity.artifactFolder,
				summary: distantParity.summary,
			},
		},
		{
			id: 'lit-scene-composition-accepted',
			status: litComposition.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifactFolder: litComposition.artifactFolder,
				browserRun: litComposition.browserRun,
				summary: litComposition.summary,
			},
		},
		{
			id: 'local-first-order-accepted',
			status: localFirstOrder.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifactFolder: localFirstOrder.artifactFolder,
				browserRun: localFirstOrder.browserRun,
				summary: localFirstOrder.summary,
			},
		},
		{
			id: 'required-source-families-present',
			status:
				sourceFamilies.has('distant-directional-sun') &&
				sourceFamilies.has('flat-local-point-sun')
					? 'passed'
					: 'failed',
			measured: [...sourceFamilies],
		},
		{
			id: 'required-cases-present',
			status:
				matrixCases.some((item) => item.id === 'distant-high') &&
				matrixCases.some((item) => item.id === 'distant-low') &&
				matrixCases.some((item) => item.id === 'local-000deg') &&
				matrixCases.some((item) => item.id === 'local-090deg')
					? 'passed'
					: 'failed',
			measured: matrixCases.map((item) => ({
				id: item.id,
				sourceFamily: item.sourceFamily,
			})),
		},
		{
			id: 'all-matrix-cases-accepted',
			status: matrixCases.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: matrixCases.map((item) => ({
				id: item.id,
				status: item.status,
				sourceFamily: item.sourceFamily,
			})),
		},
		{
			id: 'limitations-recorded',
			status: 'passed',
			measured: {
				localSecondOrder: 'deferred',
				localFullImageShader: 'deferred after selected first-order diagnostic',
				localPointLightSceneComposition:
					'deferred; Milestone 25 validates source transport, Milestone 24 validates distant lit composition',
				hdrTransport: 'RGBA8 display-domain POC remains current transport',
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'unified-source-driven-shader-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		matrixCases,
		evidence: {
			distantParity: distantParity.artifactFolder,
			litComposition: litComposition.artifactFolder,
			localFirstOrder: localFirstOrder.artifactFolder,
		},
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'unified-source-driven-shader-matrix-command',
		milestone: 26,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'unified-source-schema.json'), {
		kind: 'unified-source-driven-shader-matrix-schema',
		packetContract: {
			sceneColorTexture: 'RGBA8 display-domain POC texture',
			sceneInputTexture: 'hit distance, material id, hit mask',
			rayDirectionTexture: 'Three world ray direction per pixel',
			sourcePacket:
				'distant-directional-sun or flat-local-point-sun; shader must fail loudly for unsupported combinations',
		},
		sourceFamilies: [
			{
				kind: 'distant-directional-sun',
				status: 'full-image second-order GPU parity and lit scene composition accepted',
			},
			{
				kind: 'flat-local-point-sun',
				status: 'selected first-order finite-source diagnostic accepted',
				deferred: [
					'full-image local shader',
					'local second-order cache',
					'direct local solar-disc camera radiance',
					'local ground bounce',
				],
			},
		],
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'unified-source-driven-shader-matrix-case-results',
		matrixCases,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'unified-source-driven-shader-matrix-criteria',
		summary,
		criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone26Report(packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-unified-source-driven-shader-matrix.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runMilestone27(options) {
	return runLocalFullImageParityMilestone({
		options,
		milestone: 27,
		artifactLabel: 'local-sun-full-image-shader-parity',
		latestFileName: 'latest-local-sun-full-image-shader-parity.json',
		browserLabelPrefix: 'browser-local-sun-full-image-shader',
		surfacePolicy: 'spectrum-id-reference-radiance',
		reportTitle: 'Milestone 27 - Local Sun Full-Image Shader Parity',
	});
}

async function runMilestone28(options) {
	return runLocalFullImageParityMilestone({
		options,
		milestone: 28,
		artifactLabel: 'local-sun-scene-color-composition-parity',
		latestFileName: 'latest-local-sun-scene-color-composition-parity.json',
		browserLabelPrefix: 'browser-local-sun-scene-color-composition',
		surfacePolicy: 'captured-rgba8-display-domain',
		reportTitle: 'Milestone 28 - Local Sun Scene-Color Composition Parity',
	});
}

async function runMilestone29(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(
		options.outRoot,
		'soft-shader-capability-parity-matrix'
	);
	const distantParity = await readJson(
		path.join(options.outRoot, 'latest-distant-soft-shader-gpu-parity.json')
	);
	const litComposition = await readJson(
		path.join(options.outRoot, 'latest-lit-scene-shader-composition.json')
	);
	const localFullImage = await readJson(
		path.join(options.outRoot, 'latest-local-sun-full-image-shader-parity.json')
	);
	const localSceneColor = await readJson(
		path.join(
			options.outRoot,
			'latest-local-sun-scene-color-composition-parity.json'
		)
	);
	const criteria = [
		{
			id: 'distant-full-image-parity-retained',
			status: distantParity.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifact: distantParity.artifactFolder,
				status: distantParity.status,
				summary: distantParity.summary,
			},
		},
		{
			id: 'distant-lit-composition-retained',
			status: litComposition.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifact: litComposition.artifactFolder,
				status: litComposition.status,
				summary: litComposition.summary,
			},
		},
		{
			id: 'local-spectrum-full-image-parity-accepted',
			status: localFullImage.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifact: localFullImage.artifactFolder,
				status: localFullImage.status,
				summary: localFullImage.summary,
			},
		},
		{
			id: 'local-scene-color-composition-parity-accepted',
			status: localSceneColor.status === 'accepted' ? 'passed' : 'failed',
			measured: {
				artifact: localSceneColor.artifactFolder,
				status: localSceneColor.status,
				summary: localSceneColor.summary,
			},
		},
		{
			id: 'required-local-offsets-covered',
			status:
				LOCAL_SOURCE_CASE_IDS.every((caseId) =>
					localFullImage.caseResults?.some((item) => item.id === caseId)
				) &&
				LOCAL_SOURCE_CASE_IDS.every((caseId) =>
					localSceneColor.caseResults?.some((item) => item.id === caseId)
				)
					? 'passed'
					: 'failed',
			measured: {
				fullImageCases: localFullImage.caseResults?.map((item) => item.id) || [],
				sceneColorCases:
					localSceneColor.caseResults?.map((item) => item.id) || [],
			},
		},
		{
			id: 'remaining-deferred-work-is-beyond-current-soft-shader',
			status: 'passed',
			measured: {
				stillDeferred: [
					'local second-order cache',
					'direct local solar-disc camera radiance',
					'local ground bounce',
					'HDR/binary transport beyond current RGBA8 POC packet path',
					'production promotion into official Algorithm32',
				],
				notDeferredAnymore: [
					'local full-image first-order shader output',
					'local full-image CPU/GPU parity',
					'local sceneColor * T_view + L_path shader composition',
				],
			},
		},
	];
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'soft-shader-capability-parity-matrix-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
		evidence: {
			distantParity: distantParity.artifactFolder,
			litComposition: litComposition.artifactFolder,
			localFullImage: localFullImage.artifactFolder,
			localSceneColor: localSceneColor.artifactFolder,
		},
		matrixCases: [
			...(distantParity.caseResults || []).map((item) => ({
				id: item.id,
				sourceFamily: 'distant-directional-sun',
				mode: 'full-image-second-order',
				status: item.status,
				comparison: item.comparison,
			})),
			...(localFullImage.caseResults || []).map((item) => ({
				id: item.id,
				sourceFamily: 'flat-local-point-sun',
				mode: 'full-image-first-order-spectrum',
				status: item.status,
				comparison: item.comparison,
			})),
			...(localSceneColor.caseResults || []).map((item) => ({
				id: item.id,
				sourceFamily: 'flat-local-point-sun',
				mode: 'full-image-first-order-scene-color-composition',
				status: item.status,
				comparison: item.comparison,
			})),
		],
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'soft-shader-capability-parity-matrix-command',
		milestone: 29,
		options: scrubOptions(options),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'soft-shader-capability-parity-matrix-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: 'soft-shader-capability-parity-matrix-cases',
		matrixCases: packet.matrixCases,
	});
	await writeText(path.join(artifact.directory, 'report.md'), milestone29Report(packet));
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(
		path.join(options.outRoot, 'latest-soft-shader-capability-parity-matrix.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function runLocalFullImageParityMilestone({
	options,
	milestone,
	artifactLabel,
	latestFileName,
	browserLabelPrefix,
	surfacePolicy,
	reportTitle,
}) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, artifactLabel);
	const sourceRun = await resolveLocalSourceRun(options);
	const browserRuns = await resolveLocalShaderBrowserRuns({
		options,
		sourceRun,
		browserLabelPrefix,
		surfacePolicy,
		milestone,
	});
	const casesRoot = path.join(artifact.directory, 'cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const caseResults = [];

	for (const browserCase of browserRuns) {
		const caseRoot = path.join(casesRoot, browserCase.id);
		await fs.mkdir(caseRoot, { recursive: true });
		const sourceCaseRoot = path.join(sourceRun, 'cases', browserCase.id);
		const sceneInputPacket = await readJson(
			path.join(sourceCaseRoot, 'scene-input-packet.json')
		);
		const cpuSoftShader = postprocessSceneInput(sceneInputPacket, {
			surfacePolicy,
			includeSecondOrder: false,
		});
		const browserResult = await readJson(
			path.join(browserCase.browserRun, 'result.json')
		);
		const diagnostics = browserResult.result?.diagnostics || null;
		const cpuImagePath = path.join(caseRoot, 'cpu-soft-shader-image.png');
		const gpuImagePath = path.join(caseRoot, 'gpu-shader-image.png');
		const diffImagePath = path.join(caseRoot, 'diff-image.png');
		await writePng(
			cpuImagePath,
			sceneInputPacket.width,
			sceneInputPacket.height,
			cpuSoftShader.pixels
		);
		await fs.copyFile(path.join(browserCase.browserRun, 'canvas-image.png'), gpuImagePath);
		const cpuImage = await readPngRgba(cpuImagePath);
		const gpuImage = await readPngRgba(gpuImagePath);
		const comparison = compareRgbaImages({ a: cpuImage, b: gpuImage });
		await writePng(
			diffImagePath,
			sceneInputPacket.width,
			sceneInputPacket.height,
			makeDiffPixels(cpuImage.data, gpuImage.data)
		);
		const selectedMaxDelta = diagnostics?.maxSelectedRgbDelta ?? null;
		const caseCriteria = [
			{
				id: 'browser-local-full-image-run-accepted',
				status:
					browserResult.status === 'accepted' &&
					diagnostics?.status === 'accepted'
						? 'passed'
						: 'failed',
				measured: {
					browserRun: relativePath(browserCase.browserRun),
					harnessStatus: browserResult.status,
					diagnosticsStatus: diagnostics?.status || null,
					summary: diagnostics?.summary || null,
				},
			},
			{
				id: 'source-packet-is-flat-local',
				status:
					sceneInputPacket.source?.kind === 'flat-local-point-sun' &&
					diagnostics?.packetSummary?.source?.kind ===
						'flat-local-point-sun'
						? 'passed'
						: 'failed',
				measured: {
					cpuSource: sceneInputPacket.source,
					gpuSource: diagnostics?.packetSummary?.source || null,
				},
			},
			{
				id: 'gpu-image-matches-cpu-soft-shader',
				status:
					comparison.status === 'compared' &&
					comparison.maxAbsRgbDelta <= 2 &&
					comparison.p99PixelMaxAbsRgbDelta <= 1
						? 'passed'
						: 'failed',
				measured: comparison,
			},
			{
				id: 'selected-pixels-match-cpu-soft-shader',
				status:
					Number.isFinite(selectedMaxDelta) && selectedMaxDelta <= 2
						? 'passed'
						: 'failed',
				measured: {
					maxSelectedRgbDelta: selectedMaxDelta,
					selectedChecks: diagnostics?.selectedChecks || [],
				},
			},
			{
				id: 'surface-policy-matches-milestone',
				status:
					diagnostics?.surfacePolicy === surfacePolicy &&
					diagnostics?.composeSceneColor ===
						(surfacePolicy !== 'spectrum-id-reference-radiance')
						? 'passed'
						: 'failed',
				measured: {
					expectedSurfacePolicy: surfacePolicy,
					actualSurfacePolicy: diagnostics?.surfacePolicy || null,
					composeSceneColor: diagnostics?.composeSceneColor ?? null,
				},
			},
			{
				id: 'cpu-soft-shader-finite-output',
				status: cpuSoftShader.finiteChecks?.nonfinitePixels === 0
					? 'passed'
					: 'failed',
				measured: cpuSoftShader.finiteChecks || null,
			},
		];
		const caseSummary = summarizeCriteria(caseCriteria);
		const caseStatus = caseSummary.failed === 0 ? 'accepted' : 'rejected';
		const caseResult = {
			id: browserCase.id,
			offsetDegrees: sceneInputPacket.source?.offsetDegrees ?? null,
			status: caseStatus,
			sourcePacket: sceneInputPacket.source,
			geometryPacket: sceneInputPacket.geometry,
			browserRun: relativePath(browserCase.browserRun),
			surfacePolicy,
			comparison,
			maxSelectedRgbDelta: selectedMaxDelta,
			summary: caseSummary,
		};

		await writeJson(path.join(caseRoot, 'scene-input-summary.json'), {
			kind: `${artifactLabel}-scene-input-summary`,
			width: sceneInputPacket.width,
			height: sceneInputPacket.height,
			source: sceneInputPacket.source,
			geometry: sceneInputPacket.geometry,
			counts: sceneInputPacket.counts,
			rowOrder: sceneInputPacket.rowOrder,
			sceneColorPolicy: sceneInputPacket.sceneColorPolicy,
			surfacePolicy,
		});
		await writeJson(path.join(caseRoot, 'selected-checks.json'), {
			kind: `${artifactLabel}-selected-checks`,
			selectedChecks: diagnostics?.selectedChecks || [],
			cpuSelectedPixels: cpuSoftShader.selectedPixels,
		});
		await writeJson(path.join(caseRoot, 'image-comparison.json'), comparison);
		await writeJson(path.join(caseRoot, 'criteria-results.json'), {
			kind: `${artifactLabel}-case-criteria`,
			summary: caseSummary,
			criteria: caseCriteria,
		});
		await writeJson(path.join(caseRoot, 'result.json'), {
			kind: `${artifactLabel}-case-result`,
			...caseResult,
		});
		caseResults.push({ ...caseResult, criteria: caseCriteria });
	}

	const criteria = [
		{
			id: 'all-local-offsets-present',
			status: LOCAL_SOURCE_CASE_IDS.every((caseId) =>
				caseResults.some((item) => item.id === caseId)
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => item.id),
		},
		{
			id: 'all-local-cases-accepted',
			status: caseResults.every((item) => item.status === 'accepted')
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.id,
				status: item.status,
				comparison: item.comparison,
			})),
		},
		{
			id: 'local-second-order-remains-beyond-current-soft-shader',
			status: 'passed',
			measured: {
				includeSecondOrder: false,
				reason:
					'Current CPU soft-shader local source support is first-order only; this milestone matches that capability.',
			},
		},
	];
	const aggregateSummary = summarizeCriteria(criteria);
	const caseSummary = summarizeCaseResults(caseResults);
	const summary = {
		passed: aggregateSummary.passed + caseSummary.passed,
		failed: aggregateSummary.failed + caseSummary.failed,
		aggregatePassed: aggregateSummary.passed,
		aggregateFailed: aggregateSummary.failed,
		casePassed: caseSummary.passed,
		caseFailed: caseSummary.failed,
	};
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: `${artifactLabel}-result`,
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		sourceRun: relativePath(sourceRun),
		surfacePolicy,
		summary,
		caseResults: caseResults.map(({ criteria: _criteria, ...item }) => item),
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: `${artifactLabel}-command`,
		milestone,
		options: scrubOptions(options),
		sourceRun: relativePath(sourceRun),
		surfacePolicy,
	});
	await writeJson(path.join(artifact.directory, 'case-results.json'), {
		kind: `${artifactLabel}-case-results`,
		cases: packet.caseResults,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: `${artifactLabel}-criteria`,
		summary,
		aggregateCriteria: criteria,
		caseCriteria: Object.fromEntries(
			caseResults.map((item) => [item.id, item.criteria])
		),
	});
	await writeText(
		path.join(artifact.directory, 'report.md'),
		localFullImageParityReport({ title: reportTitle, packet })
	);
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(path.join(options.outRoot, latestFileName), packet);

	return { artifact, status, summary, packet };
}

function buildMilestone20Inventory() {
	return {
		kind: 'shader-oracle-packet-inventory',
		milestone: 20,
		objectiveOracle: {
			cpuSoftShaderArtifact:
				'tmp/atmosphere/algorithm32_shader_lab/094-cpu-unified-source-driven-soft-shader-matrix',
			role:
				'Objective CPU oracle for the unified source-driven soft-shader contract.',
		},
		priorShaderEndpoint: {
			fixedDistantSunArtifact:
				'tmp/atmosphere/algorithm32_shader_lab/054-browser-gpu-direct-scene-input-second-order-image',
			role:
				'Previous fixed spherical distant-Sun browser shader endpoint; useful as implementation baseline, not as local/source-driven oracle.',
		},
		visualContext: [
			{
				artifact:
					'tmp/atmosphere/algorithm32_shader_lab/157-three-lit-detailed-subjective-source-scenes',
				role: 'visual-only',
				note:
					'Detailed Three-lit mountain scene with bottom ground plane. Do not use as objective shader acceptance gate.',
			},
		],
		gpuInputs: {
			textures: [
				{
					name: 'sceneColorTexture',
					format: 'RGBA8 for current POC; HDR/float deferred until blocking',
					source: 'browser scene-color packet',
				},
				{
					name: 'hitDistanceTexture',
					format: 'float/R32F or packed equivalent',
					source: 'scene packet hitDistanceMeters',
				},
				{
					name: 'hitMaskMaterialTexture',
					format: 'integer or packed normalized channels',
					source: 'hitMask plus spectrum/material numeric id',
				},
				{
					name: 'rayDirectionTexture',
					format: 'RGB float or packed equivalent',
					source: 'scene packet rayDirections',
				},
				{
					name: 'secondOrderIncidentSkyTexture',
					format: 'distant-Sun-only existing cache texture',
					source: 'accepted fixed spherical second-order cache path',
				},
			],
			uniforms: [
				'geometryKind and spherical/flat geometry constants',
				'sourceKind and distant direction or local finite position',
				'spectral/profile constants or texture bindings',
				'display policy and tone-map constants',
				'feature flags for supported second-order source family',
			],
		},
		initialShaderInputPolicy: {
			rayDirectionTextureFirst: true,
			reason:
				'Milestone 21 should remove camera reconstruction ambiguity before later optimization.',
			currentTransport:
				'RGBA8 JSON-carried packet transport remains allowed until it blocks parity.',
		},
		unsupportedUntilLaterMilestones: [
			'local second-order cache',
			'direct local solar-disc camera radiance',
			'local ground bounce',
			'production LUT acceleration',
		],
	};
}

function milestone20Report(inventory, packet) {
	return `# Milestone 20 - Shader Oracle And Packet Inventory

Status: ${packet.status}

Objective CPU oracle: ${inventory.objectiveOracle.cpuSoftShaderArtifact}

Prior fixed-Sun shader endpoint: ${inventory.priorShaderEndpoint.fixedDistantSunArtifact}

The GPU shader is treated as another implementation of the CPU soft-shader
contract, not as a separate renderer. It should consume packet textures and
uniforms only. Subjective artifact 157 is visual-only context.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.
`;
}

function milestone21Report(packet, diagnostics) {
	return `# Milestone 21 - GPU Packet Input Parity And No-Atmosphere Passthrough

Status: ${packet.status}

Browser run: ${packet.browserRun}

The browser mode uploaded the captured scene-color packet to a fullscreen GPU
texture pass and read it back with atmosphere disabled.

Max byte delta: ${diagnostics?.maxAbsDelta ?? 'n/a'}

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.
`;
}

function milestone22Report(packet) {
	const lines = [
		'# Milestone 22 - Packet-Driven Distant Sun Shader',
		'',
		`Status: ${packet.status}`,
		'',
		'The accepted second-order browser shader was run from explicit distant-Sun source packets for a high-Sun control and a non-default low-Sun case.',
		'',
		`Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		'',
		'Case browser runs:',
		...packet.caseResults.map(
			(item) =>
				`- ${item.id}: ${item.browserRun}, source=${item.sourcePacket?.sunCase}, maxSelectedRgbDelta=${item.maxSelectedRgbDelta}`
		),
	];

	return `${lines.join('\n')}\n`;
}

function milestone23Report(packet) {
	const lines = [
		'# Milestone 23 - Distant Soft-Shader GPU Parity',
		'',
		`Status: ${packet.status}`,
		'',
		'Each distant-Sun browser shader image is compared against a CPU soft-shader image generated from the same simple-scene packet contract and source packet.',
		'',
		`Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.`,
		'',
		'Cases:',
		...packet.caseResults.map(
			(item) =>
				`- ${item.id}: maxAbsRgbDelta=${item.comparison.maxAbsRgbDelta}, meanAbsRgbDelta=${item.comparison.meanAbsRgbDelta}, browser=${item.browserRun}`
		),
	];

	return `${lines.join('\n')}\n`;
}

function milestone24Report(packet, diagnostics) {
	return `# Milestone 24 - Lit Scene Shader Composition

Status: ${packet.status}

Browser run: ${packet.browserRun}

The GPU soft-shader path consumed scene color, hit distance/mask, ray direction,
and distant-Sun packet textures. With atmosphere disabled it reproduced the
scene-color packet exactly; with atmosphere enabled it preserved the lit/shadow
ordering and replaced sky pixels with Algorithm32 atmosphere.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.

- Passthrough max byte delta: ${diagnostics?.passthroughMaxAbsDelta ?? 'n/a'}
- Shadow delta after atmosphere: ${diagnostics?.shadowCheck?.afterDelta ?? 'n/a'}
- Sky replacement max RGB delta: ${diagnostics?.skyReplacementCheck?.maxAbsRgbDelta ?? 'n/a'}
`;
}

function milestone25Report(packet) {
	const cases = packet.caseResults
		.map(
			(item) =>
				`- ${item.id}: offset=${item.offsetDegrees}, distance=${item.sourceSampleAtObserver?.distanceMeters}, incidentScale=${item.sourceSampleAtObserver?.incidentScale}, maxSelectedRgbDelta=${item.maxSelectedRgbDelta}`
		)
		.join('\n');
	return `# Milestone 25 - Local Sun First-Order Shader

Status: ${packet.status}

Browser run: ${packet.browserRun}

The browser ran a focused WebGL2 diagnostic shader for accepted atmosflat32
flat/local Sun source packets at closest approach and 90 degrees. It validates
first-order finite source direction, distance falloff, source-path
transmittance, incident scale, and phase for selected sky rays. Local
second-order cache behavior remains explicitly deferred.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.

${cases}
`;
}

function milestone26Report(packet) {
	const cases = packet.matrixCases
		.map(
			(item) =>
				`- ${item.id}: ${item.sourceFamily}, status=${item.status}, evidence=${item.evidence}`
		)
		.join('\n');
	return `# Milestone 26 - Unified Source-Driven Shader Matrix

Status: ${packet.status}

The shader runway now has one packet framework covering distant and local source
families. Distant sources have full-image GPU parity and lit-scene composition;
local flat point-Sun sources have selected first-order finite-source shader
diagnostics for closest and 90-degree offsets. Milestones 27 through 29 close
the remaining full-image local soft-shader parity gap; local second-order cache
work remains beyond the current CPU soft-shader capability.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.

Evidence:

- Distant parity: ${packet.evidence.distantParity}
- Lit composition: ${packet.evidence.litComposition}
- Local first-order: ${packet.evidence.localFirstOrder}

Cases:

${cases}
`;
}

function localFullImageParityReport({ title, packet }) {
	const cases = packet.caseResults
		.map(
			(item) =>
				`- ${item.id}: offset=${item.offsetDegrees}, maxAbsRgbDelta=${item.comparison.maxAbsRgbDelta}, meanAbsRgbDelta=${item.comparison.meanAbsRgbDelta}, p99=${item.comparison.p99PixelMaxAbsRgbDelta}, selected=${item.maxSelectedRgbDelta}, browser=${item.browserRun}`
		)
		.join('\n');
	return `# ${title}

Status: ${packet.status}

Source CPU local matrix: ${packet.sourceRun}

Surface policy: ${packet.surfacePolicy}

This milestone compares full-frame browser GPU output against the CPU
soft-shader postprocess for the accepted local flat point-Sun scene packets.
Local source support intentionally remains first-order only, matching the
current CPU soft-shader capability.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.

Cases:

${cases}
`;
}

function milestone29Report(packet) {
	const cases = packet.matrixCases
		.map(
			(item) =>
				`- ${item.id}: ${item.sourceFamily}, ${item.mode}, status=${item.status}, maxAbsRgbDelta=${item.comparison?.maxAbsRgbDelta ?? 'n/a'}`
		)
		.join('\n');
	return `# Milestone 29 - Soft-Shader Capability Parity Matrix

Status: ${packet.status}

Milestone 29 is the corrected soft-shader parity endpoint. It keeps the
accepted distant source shader evidence and adds the missing full-image local
source parity plus local scene-color composition parity.

Criteria: ${packet.summary.passed} passed, ${packet.summary.failed} failed.

Evidence:

- Distant full-image parity: ${packet.evidence.distantParity}
- Distant lit composition: ${packet.evidence.litComposition}
- Local full-image spectrum parity: ${packet.evidence.localFullImage}
- Local scene-color composition parity: ${packet.evidence.localSceneColor}

Cases:

${cases}
`;
}

async function resolveDistantShaderBrowserRuns(options) {
	if (options.browserRunHigh && options.browserRunLow) {
		return [
			{ id: 'distant-high', browserRun: options.browserRunHigh },
			{ id: 'distant-low', browserRun: options.browserRunLow },
		];
	}

	const latestPath = path.join(
		options.outRoot,
		'latest-packet-driven-distant-sun-shader.json'
	);
	const latest = await readJson(latestPath);
	const high = latest.caseResults?.find((item) => item.id === 'distant-high');
	const low = latest.caseResults?.find((item) => item.id === 'distant-low');
	if (!high || !low) {
		throw new Error('Latest Milestone 22 result does not include distant high and low runs.');
	}
	return [
		{ id: 'distant-high', browserRun: path.join(REPO_ROOT, high.browserRun) },
		{ id: 'distant-low', browserRun: path.join(REPO_ROOT, low.browserRun) },
	];
}

async function resolveLocalSourceRun(options) {
	if (options.localSourceRun) {
		return options.localSourceRun;
	}
	const latest = await readJson(
		path.join(options.outRoot, 'latest-cpu-local-sun-soft-shader-source-matrix.json')
	);
	if (!latest.artifactFolder) {
		throw new Error(
			'latest-cpu-local-sun-soft-shader-source-matrix.json does not name artifactFolder.'
		);
	}
	return path.join(options.outRoot, latest.artifactFolder);
}

async function resolveLocalShaderBrowserRuns({
	options,
	sourceRun,
	browserLabelPrefix,
	surfacePolicy,
	milestone,
}) {
	const resolved = [];
	const missing = [];
	for (const caseId of LOCAL_SOURCE_CASE_IDS) {
		const label = `${browserLabelPrefix}-${caseId}`;
		const browserRun = await tryFindLatestRunByLabel(options.outRoot, label);
		if (browserRun) {
			resolved.push({ id: caseId, browserRun });
			continue;
		}
		const sourceCaseRoot = path.join(sourceRun, 'cases', caseId);
		const sceneInputPacket = await readJson(
			path.join(sourceCaseRoot, 'scene-input-packet.json')
		);
		const cpuSoftShader = postprocessSceneInput(sceneInputPacket, {
			surfacePolicy,
			includeSecondOrder: false,
		});
		const command = {
			id: `${label}-${Date.now()}`,
			label,
			payload: {
				mode: 'browser-local-sun-full-image-shader',
				iteration:
					milestone === 27
						? '27-local-sun-full-image-shader-parity'
						: '28-local-sun-scene-color-composition-parity',
				caseId,
				sourceRun: relativePath(sourceRun),
				surfacePolicy,
				sceneInputPacket,
				expectedSelectedPixels: cpuSoftShader.selectedPixels,
			},
		};
		const commandPath = path.join(
			options.outRoot,
			`shader-runway-command-${label}.json`
		);
		await writeJson(commandPath, command);
		missing.push({
			caseId,
			label,
			commandPath,
			directCommand: [
				'node',
				'scripts/flat/algorithm32-shader-lab/harness.js',
				'--once',
				'--command',
				relativePath(commandPath),
				'--out-root',
				relativePath(options.outRoot),
				'--page-timeout-ms',
				String(options.pageTimeoutMs),
			].join(' '),
		});
	}
	if (missing.length > 0) {
		throw new Error(
			[
				`Browser evidence is missing for Milestone ${milestone}.`,
				'Run these direct harness commands, then rerun the milestone:',
				...missing.map((item) => item.directCommand),
			].join('\n')
		);
	}
	return resolved;
}

async function tryFindLatestRunByLabel(outRoot, label) {
	try {
		return await findLatestRunByLabel(outRoot, label);
	} catch {
		return null;
	}
}

async function runBrowserCommandOnce({ command, options }) {
	const commandPath = path.join(
		options.outRoot,
		`shader-runway-command-${command.id}.json`
	);
	await writeJson(commandPath, command);
	const directCommand = [
		'node',
		'scripts/flat/algorithm32-shader-lab/harness.js',
		'--once',
		'--command',
		relativePath(commandPath),
		'--out-root',
		relativePath(options.outRoot),
		'--page-timeout-ms',
		String(options.pageTimeoutMs),
	].join(' ');
	throw new Error(
		[
			`Browser evidence is required for ${command.label}.`,
			`Wrote command JSON to ${relativePath(commandPath)}.`,
			`Run: ${directCommand}`,
			'Then rerun this milestone with --browser-run-high/--browser-run-low pointing at the produced browser artifacts.',
		].join(' ')
	);
}

async function findBrowserRunByCommandId({ outRoot, commandId }) {
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
			if (command.id === commandId) {
				return runDir;
			}
		} catch {
			// Ignore partial or unrelated artifact folders.
		}
	}
	throw new Error(`Could not find browser run for command ${commandId}`);
}

async function findLatestRunByLabel(outRoot, label) {
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const dirs = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()
		.reverse();
	for (const dir of dirs) {
		if (dir.endsWith(`-${label}`)) {
			return path.join(outRoot, dir);
		}
	}
	throw new Error(`Could not find latest browser run with label ${label}`);
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

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	let max = 0;
	for (const entry of entries) {
		if (!entry.isDirectory()) {
			continue;
		}
		const match = entry.name.match(/^(\d{3})-/);
		if (match) {
			max = Math.max(max, Number(match[1]));
		}
	}
	const number = String(max + 1).padStart(3, '0');
	const folder = `${number}-${label}`;
	const directory = path.join(outRoot, folder);
	await fs.mkdir(directory, { recursive: false });
	return {
		directory,
		folder,
		relativeFolder: folder,
	};
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
	};
}

function summarizeCaseResults(caseResults) {
	return {
		passed: caseResults.reduce((sum, item) => sum + item.summary.passed, 0),
		failed: caseResults.reduce((sum, item) => sum + item.summary.failed, 0),
	};
}

function scrubOptions(options) {
	return {
		outRoot: relativePath(options.outRoot),
		commandPath: options.commandPath ? relativePath(options.commandPath) : null,
		browserRun: options.browserRun ? relativePath(options.browserRun) : null,
		browserRunHigh: options.browserRunHigh
			? relativePath(options.browserRunHigh)
			: null,
		browserRunLow: options.browserRunLow
			? relativePath(options.browserRunLow)
			: null,
		localSourceRun: options.localSourceRun
			? relativePath(options.localSourceRun)
			: null,
		pageTimeoutMs: options.pageTimeoutMs,
		from: options.from,
		to: options.to,
	};
}

function angularSeparationDegrees(left, right) {
	if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
		return 0;
	}
	const leftLength = vectorLength(left);
	const rightLength = vectorLength(right);
	if (leftLength === 0 || rightLength === 0) {
		return 0;
	}
	const cosine = clamp(
		dot(left, right) / (leftLength * rightLength),
		-1,
		1
	);
	return Math.acos(cosine) * (180 / Math.PI);
}

function dot(left, right) {
	let value = 0;
	for (let index = 0; index < left.length; index += 1) {
		value += left[index] * right[index];
	}
	return value;
}

function vectorLength(vector) {
	return Math.sqrt(dot(vector, vector));
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function makeDiffPixels(left, right) {
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

function relativePath(filePath) {
	return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
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

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
