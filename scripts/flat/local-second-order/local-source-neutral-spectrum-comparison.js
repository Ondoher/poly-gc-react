import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/local-second-order');
const HEARTBEAT_PATH = path.join(OUT_ROOT, 'harness-heartbeat.json');
const DEFAULT_COMMAND_PATH = path.join(OUT_ROOT, 'browser-command.json');
const ACCEPTED_TINT = Object.freeze({ r: 1, g: 0.98, b: 0.95 });
const NEUTRAL_WHITE = Object.freeze({ r: 1, g: 1, b: 1 });

function parseArgs(argv) {
	const options = {
		outRoot: OUT_ROOT,
		commandPath: null,
		label: 'local-source-neutral-spectrum-comparison',
		width: 960,
		height: 540,
		renderScale: 2,
		timeoutMs: 300000,
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
		} else if (arg === '--label') {
			options.label = argv[index + 1];
			index += 1;
		} else if (arg === '--width') {
			options.width = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--height') {
			options.height = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--render-scale') {
			options.renderScale = Number(argv[index + 1]);
			index += 1;
		} else if (arg === '--timeout-ms') {
			options.timeoutMs = Number(argv[index + 1]);
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
	console.log(`Local source neutral spectrum comparison

Usage:
  node scripts/flat/local-second-order/local-source-neutral-spectrum-comparison.js

Requires the user-owned watcher:
  node scripts/flat/local-second-order/harness.js --watch

Options:
  --command-path <path>  Running local harness command file.
  --out-root <path>      Output root. Default: tmp/atmosphere/local-second-order
  --width <px>           Output width. Default: 960
  --height <px>          Row image height. Default: 540
  --render-scale <n>     Internal render scale. Default: 2
  --timeout-ms <ms>      Browser wait timeout. Default: 300000
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}
	const result = await runLocalSourceNeutralSpectrumComparison(options);
	console.log(`${result.status}: ${result.artifact.relativeFolder}`);
	console.log(`Comparison: ${result.packet.comparisonPath}`);
	console.log(`Criteria: ${result.summary.pass}/${result.summary.total} pass, ${result.summary.fail} fail`);
}

export async function runLocalSourceNeutralSpectrumComparison(options) {
	const startedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const commandPath = options.commandPath || (await resolveCommandPath(options.outRoot));
	const runLog = [
		`${startedAt.toISOString()} Started local source neutral spectrum comparison.`,
		`${new Date().toISOString()} Using command path ${relative(commandPath)}.`,
	];
	const baseline = await runBrowserSourceMatrix({
		commandPath,
		outRoot: options.outRoot,
		options,
		variantId: 'accepted-app-tint',
		sourceColorOverride: null,
		runLog,
	});
	const neutral = await runBrowserSourceMatrix({
		commandPath,
		outRoot: options.outRoot,
		options,
		variantId: 'neutral-white-source',
		sourceColorOverride: NEUTRAL_WHITE,
		runLog,
	});
	const comparison = await writeImageComparison({
		artifact,
		baselineImagePath: path.join(baseline.runDir, 'canvas-image.png'),
		neutralImagePath: path.join(neutral.runDir, 'canvas-image.png'),
	});
	const criteria = buildCriteria({ baseline, neutral, comparison });
	const summary = summarizeCriteria(criteria);
	const status = summary.fail === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'algorithm32-local-source-neutral-spectrum-comparison-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		stateGoal:
			'Render accepted local-source subjective images, rerender the same cases with the inherited app RGB source tint replaced by neutral white, and compare actual integrated shader output.',
		sourceScalePolicy: {
			baseline: {
				kind: 'accepted-app-fixture-tint',
				color: ACCEPTED_TINT,
				notes:
					'Uses the existing local-source packet color from the accepted app-fixture path.',
			},
			neutral: {
				kind: 'neutral-white-source-scale',
				color: NEUTRAL_WHITE,
				notes:
					'Overrides only flat-local-point-sun source color so local spectral source scale no longer applies the inherited RGB tint.',
			},
		},
		browserRuns: {
			baseline: relative(baseline.runDir),
			neutral: relative(neutral.runDir),
		},
		comparisonPath: relative(comparison.comparisonPath),
		diffPath: relative(comparison.diffPath),
		summary,
		diff: comparison.diff,
	};

	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-local-source-neutral-spectrum-comparison-command',
		options: {
			...options,
			outRoot: relative(options.outRoot),
			commandPath: relative(commandPath),
		},
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-local-source-neutral-spectrum-comparison-criteria',
		status,
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'state-goal.md'), makeStateGoal({ packet }));
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({ packet }));
	await writeText(path.join(artifact.directory, 'run.log'), runLog.join('\n'));
	await appendRunningLog(options.outRoot, packet);

	return { artifact, status, summary, packet };
}

async function runBrowserSourceMatrix({
	commandPath,
	outRoot,
	options,
	variantId,
	sourceColorOverride,
	runLog,
}) {
	const command = {
		id: `${variantId}-${Date.now()}`,
		label: `${options.label}-${variantId}`,
		type: 'three-terrain-integrated-source-matrix',
		createdAt: new Date().toISOString(),
		stateGoal:
			'Render the accepted Southern France local-source subjective vertical stack with the integrated Algorithm32 shader, varying only the local source spectral color scale policy.',
		payload: {
			width: options.width,
			height: options.height,
			renderScale: options.renderScale,
			rendererAntialias: true,
			enableShadows: false,
			shadowPolicy: 'off',
			galleryMode: 'with-shader-vertical',
			forceLocalToward180Sun: true,
			terrainSeed: 'southern-france-blender-obj-diffuse-v1',
			terrainBackend: 'southern-france-obj-diffuse',
			starField: {
				enabled: true,
				intensity: 1,
				density: 1.15,
				pointSize: 1.15,
			},
			cases: [
				'local-closest',
				'local-045deg',
				'local-090deg',
				'local-135deg',
				'local-180deg',
			],
			sourceColorOverride,
			experiment: {
				kind: 'local-source-neutral-spectrum-comparison',
				variantId,
				acceptedTint: ACCEPTED_TINT,
				neutralWhite: NEUTRAL_WHITE,
			},
		},
	};
	if (!sourceColorOverride) {
		delete command.payload.sourceColorOverride;
	}
	await writeJson(commandPath, command);
	runLog.push(`${new Date().toISOString()} Wrote browser command ${command.id}.`);
	const runDir = await waitForBrowserRun({
		outRoot,
		commandId: command.id,
		timeoutMs: options.timeoutMs,
	});
	const result = await readJson(path.join(runDir, 'result.json'));
	runLog.push(
		`${new Date().toISOString()} Browser command ${command.id} completed ${result.status}.`
	);
	return {
		command,
		runDir,
		status: result.status,
		result,
	};
}

async function writeImageComparison({ artifact, baselineImagePath, neutralImagePath }) {
	const baseline = sharp(baselineImagePath).ensureAlpha();
	const neutral = sharp(neutralImagePath).ensureAlpha();
	const baselineMetadata = await baseline.metadata();
	const neutralMetadata = await neutral.metadata();
	if (
		baselineMetadata.width !== neutralMetadata.width ||
		baselineMetadata.height !== neutralMetadata.height
	) {
		throw new Error('Baseline and neutral images must have matching dimensions.');
	}
	const width = baselineMetadata.width;
	const height = baselineMetadata.height;
	const baselinePixels = await sharp(baselineImagePath)
		.ensureAlpha()
		.raw()
		.toBuffer();
	const neutralPixels = await sharp(neutralImagePath)
		.ensureAlpha()
		.raw()
		.toBuffer();
	const { diffPixels, diff } = diffRgba(baselinePixels, neutralPixels);
	const diffPath = path.join(artifact.directory, 'neutral-minus-app-tint-diff-x4.png');
	await sharp(Buffer.from(diffPixels), {
		raw: { width, height, channels: 4 },
	})
		.png()
		.toFile(diffPath);
	const comparisonPath = path.join(artifact.directory, 'app-tint-vs-neutral-white-comparison.png');
	const labelHeight = 46;
	const gutter = 16;
	await sharp({
		create: {
			width: width * 3 + gutter * 4,
			height: height + labelHeight + gutter * 2,
			channels: 4,
			background: '#101418',
		},
	})
		.composite([
			{
				input: labelSvg({
					width: width * 3 + gutter * 4,
					height: labelHeight,
					labels: [
						'accepted app tint',
						'neutral white source scale',
						'diff x4',
					],
				}),
				left: 0,
				top: gutter,
			},
			{ input: baselineImagePath, left: gutter, top: gutter + labelHeight },
			{
				input: neutralImagePath,
				left: width + gutter * 2,
				top: gutter + labelHeight,
			},
			{
				input: diffPath,
				left: width * 2 + gutter * 3,
				top: gutter + labelHeight,
			},
		])
		.png()
		.toFile(comparisonPath);
	return { comparisonPath, diffPath, diff };
}

function diffRgba(a, b) {
	const diffPixels = Buffer.alloc(a.length);
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	let changedPixels = 0;
	const pixelCount = Math.floor(a.length / 4);
	for (let offset = 0; offset < a.length; offset += 4) {
		let pixelChanged = false;
		for (let channel = 0; channel < 3; channel += 1) {
			const delta = Number(b[offset + channel]) - Number(a[offset + channel]);
			const abs = Math.abs(delta);
			maxAbsRgbDelta = Math.max(maxAbsRgbDelta, abs);
			sumAbsRgbDelta += abs;
			if (abs > 0) {
				pixelChanged = true;
			}
			diffPixels[offset + channel] = Math.max(0, Math.min(255, abs * 4));
		}
		diffPixels[offset + 3] = 255;
		if (pixelChanged) {
			changedPixels += 1;
		}
	}
	return {
		diffPixels,
		diff: {
			maxAbsRgbDelta,
			meanAbsRgbDelta: sumAbsRgbDelta / Math.max(1, pixelCount * 3),
			changedPixels,
			pixelCount,
			changedPixelFraction: changedPixels / Math.max(1, pixelCount),
		},
	};
}

function buildCriteria({ baseline, neutral, comparison }) {
	return [
		{
			criterionId: 'baseline-browser-run-accepted',
			status: baseline.status === 'accepted' ? 'pass' : 'fail',
			tolerance: 'accepted',
			measuredError: baseline.status,
			sourceOrStatus: relative(baseline.runDir),
			notes: 'The unmodified accepted app-tint local source stack rendered successfully.',
		},
		{
			criterionId: 'neutral-browser-run-accepted',
			status: neutral.status === 'accepted' ? 'pass' : 'fail',
			tolerance: 'accepted',
			measuredError: neutral.status,
			sourceOrStatus: relative(neutral.runDir),
			notes: 'The neutral white source-scale local source stack rendered successfully.',
		},
		{
			criterionId: 'neutral-source-scale-changes-output',
			status: comparison.diff.maxAbsRgbDelta > 0 ? 'pass' : 'fail',
			tolerance: 'max RGB delta > 0',
			measuredError: comparison.diff,
			sourceOrStatus: 'image-diff',
			notes:
				'The actual integrated shader output changes when the inherited app tint is removed.',
		},
	];
}

function makeStateGoal({ packet }) {
	return [
		'# Local Source Neutral Spectrum Comparison',
		'',
		packet.stateGoal,
		'',
		`Status: ${packet.status}`,
		`Criteria: ${packet.summary.pass}/${packet.summary.total} pass, ${packet.summary.fail} fail`,
		'',
		'This experiment changes only the flat-local-point-sun source color used to derive local spectral source scale.',
		'',
	].join('\n');
}

function makeReport({ packet }) {
	return [
		'# Local Source Neutral Spectrum Comparison',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact compares the accepted local-source subjective integrated-shader gallery against the same gallery with the inherited flat-app RGB source tint replaced by neutral white.',
		'',
		`Comparison: \`${packet.comparisonPath}\``,
		`Diff: \`${packet.diffPath}\``,
		'',
		`Max RGB delta: ${packet.diff.maxAbsRgbDelta}`,
		`Mean RGB delta: ${packet.diff.meanAbsRgbDelta.toFixed(4)}`,
		`Changed pixels: ${packet.diff.changedPixels}/${packet.diff.pixelCount}`,
		'',
		'## Browser Runs',
		'',
		`- accepted app tint: \`${packet.browserRuns.baseline}\``,
		`- neutral white source scale: \`${packet.browserRuns.neutral}\``,
		'',
	].join('\n');
}

async function waitForBrowserRun({ outRoot, commandId, timeoutMs }) {
	const start = Date.now();
	for (;;) {
		try {
			const latest = await readJson(path.join(outRoot, 'latest.json'));
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

async function resolveCommandPath(outRoot) {
	try {
		const heartbeat = await readJson(HEARTBEAT_PATH);
		if (heartbeat.commandPath) {
			return path.resolve(heartbeat.commandPath);
		}
	} catch {
		// Fall back to the lane default.
	}
	return path.join(outRoot, path.relative(OUT_ROOT, DEFAULT_COMMAND_PATH));
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
	const name = `${String(maxNumber + 1).padStart(3, '0')}-${slug(label)}`;
	const directory = path.join(outRoot, name);
	await fs.mkdir(directory, { recursive: false });
	return { directory, relativeFolder: relative(directory) };
}

async function appendRunningLog(outRoot, packet) {
	await fs.appendFile(
		path.join(outRoot, 'running-log.md'),
		[
			`- ${packet.completedAt}: ${packet.artifactFolder} ${packet.status}; ${packet.summary.pass}/${packet.summary.total} criteria passed; max RGB delta ${packet.diff.maxAbsRgbDelta}; comparison ${packet.comparisonPath}.`,
			'',
		].join('\n')
	);
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

function labelSvg({ width, height, labels }) {
	const columnWidth = width / labels.length;
	const text = labels.map((label, index) => {
		const x = columnWidth * index + columnWidth / 2;
		return `<text x="${x}" y="29" text-anchor="middle">${escapeXml(label)}</text>`;
	}).join('');
	return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#101418"/>
  <style>
    text { fill: #eef2f7; font: 18px Arial, sans-serif; font-weight: 700; }
  </style>
  ${text}
</svg>`);
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function slug(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 72);
}

function relative(filePath) {
	return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
