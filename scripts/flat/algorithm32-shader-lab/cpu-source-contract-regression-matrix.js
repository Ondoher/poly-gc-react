import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runNodeThreeReference } from './node-three-reference.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const SCRIPT_PATH = path.relative(REPO_ROOT, __filename).replaceAll('\\', '/');

const CASES = [
	{
		id: 'simple-card-algorithm32',
		label: 'simple-card-algorithm32',
		reference: 'tmp/atmosphere/algorithm32_shader_lab/037-algorithm32-simple-card-reference',
		args: ['--width', '240', '--height', '120'],
	},
	{
		id: 'simple-card-first-order',
		label: 'simple-card-first-order',
		reference:
			'tmp/atmosphere/algorithm32_shader_lab/039-algorithm32-first-order-simple-card-reference',
		args: [
			'--width',
			'240',
			'--height',
			'120',
			'--scattering-order',
			'first-order',
		],
	},
	{
		id: 'sunset-floor-algorithm32',
		label: 'sunset-floor-algorithm32',
		reference: 'tmp/atmosphere/algorithm32_shader_lab/005-sunset-floor',
		args: ['--scene', 'sunset-floor', '--width', '320', '--height', '180'],
	},
];

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU source-contract distant-Sun regression matrix.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');

	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const caseResults = [];
	for (const matrixCase of CASES) {
		log(runLog, `Running ${matrixCase.id}.`);
		const caseRun = await runCase({ matrixCase, casesRoot });
		caseResults.push(caseRun);
		log(
			runLog,
			`${matrixCase.id} completed with ${caseRun.result.status}: ${caseRun.relativeRunDir}.`
		);
	}

	const criteria = evaluateMatrixCriteria(caseResults);
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const packet = {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
	};

	await writeArtifact({
		artifact,
		options,
		caseResults,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(
		`CPU source-contract regression matrix ${packet.status}: ${artifact.directory}`
	);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-source-contract-distant-sun-matrix',
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (options.help) {
		printHelp();
		process.exit(0);
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 CPU source-contract regression matrix

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-source-contract-regression-matrix.js

Options:
  --out-root <path>   Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>      Artifact folder label.
`);
}

async function runCase({ matrixCase, casesRoot }) {
	const referencePath = path.resolve(REPO_ROOT, matrixCase.reference);
	const args = [
		'--out-root',
		casesRoot,
		'--label',
		matrixCase.label,
		...matrixCase.args,
		'--compare-reference',
		referencePath,
	];
	const run = await runNodeThreeReference(args);
	const latest = JSON.parse(
		await fs.readFile(path.join(casesRoot, 'latest-node-three-reference.json'), 'utf8')
	);
	const runDir = run.artifact.directory;
	const comparison = JSON.parse(
		await fs.readFile(path.join(runDir, 'source-contract-comparison.json'), 'utf8')
	);
	const traces = JSON.parse(
		await fs.readFile(path.join(runDir, 'source-sample-traces.json'), 'utf8')
	);
	const criteria = JSON.parse(
		await fs.readFile(path.join(runDir, 'criteria-results.json'), 'utf8')
	);

	return {
		id: matrixCase.id,
		label: matrixCase.label,
		reference: matrixCase.reference,
		args: matrixCase.args,
		invocation: 'in-process',
		result: latest,
		relativeRunDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		comparison,
		sourceSampleTraces: traces,
		criteria,
	};
}

function evaluateMatrixCriteria(caseResults) {
	const criteria = [];

	for (const caseResult of caseResults) {
		criteria.push(
			criterion({
				id: `${caseResult.id}-accepted`,
				status: caseResult.result.status === 'accepted' ? 'pass' : 'fail',
				tolerance: { status: 'accepted' },
				measured: {
					status: caseResult.result.status,
					summary: caseResult.result.summary,
					runDir: caseResult.relativeRunDir,
				},
				notes:
					'Per-case CPU source-contract run completed as an accepted artifact.',
			})
		);
		criteria.push(
			criterion({
				id: `${caseResult.id}-reference-parity`,
				status: allComparisonCriteriaPass(caseResult.comparison) ? 'pass' : 'fail',
				tolerance: {
					referenceImage: 'exact raw RGBA',
					stableJson: 'exact canonical JSON',
				},
				measured: comparisonSummary(caseResult.comparison),
				notes:
					'Per-case source-contract output matches its accepted CPU distant-Sun reference.',
			})
		);
		criteria.push(
			criterion({
				id: `${caseResult.id}-distant-source-sample-contract`,
				status: distantSourceTracePasses(caseResult.sourceSampleTraces)
					? 'pass'
					: 'fail',
				tolerance: {
					sourceKind: 'distant-directional-sun',
					distanceKind: 'infinite',
					incidentScale: 1,
				},
				measured: summarizeTraceContract(caseResult.sourceSampleTraces),
				notes:
					'Distant-Sun source samples remain constant-direction, infinite-distance, unit-scale samples.',
			})
		);
	}

	return criteria;
}

function allComparisonCriteriaPass(comparison) {
	return comparison.criteria.every((item) => item.status === 'pass');
}

function comparisonSummary(comparison) {
	return {
		imageMatches: comparison.imageComparison.matches,
		imageMaxAbsByteDelta: comparison.imageComparison.maxAbsByteDelta,
		selectedMatches: comparison.selectedComparison.matches,
		geometryMatches: comparison.geometryComparison.matches,
		transportMatches: comparison.transportComparison.matches,
		criteriaMatches: comparison.criteriaComparison.matches,
	};
}

function distantSourceTracePasses(traces) {
	return traces.samples.every((sample) => {
		const source = sample.sourceSample;

		return (
			source.kind === 'distant-directional-sun' &&
			source.distanceKind === 'infinite' &&
			source.distanceMeters === null &&
			source.incidentScale === 1 &&
			source.sourcePathPolicy === 'spherical-top-atmosphere-boundary' &&
			source.spectralIncidentScaleByWavelength.every((value) => value === 1)
		);
	});
}

function summarizeTraceContract(traces) {
	return {
		sourceKind: traces.sourceKind,
		sourceId: traces.sourceId,
		geometryKind: traces.geometryKind,
		sampleCount: traces.samples.length,
		sampleSummaries: traces.samples.map((sample) => ({
			id: sample.id,
			distanceKind: sample.sourceSample.distanceKind,
			incidentScale: sample.sourceSample.incidentScale,
			sourcePathPolicy: sample.sourceSample.sourcePathPolicy,
		})),
	};
}

async function writeArtifact({
	artifact,
	options,
	caseResults,
	criteria,
	summary,
	packet,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-command',
		scriptPath: SCRIPT_PATH,
		options,
	});
	await writeJson(path.join(artifact.directory, 'matrix-cases.json'), {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-cases',
		cases: caseResults.map((caseResult) => ({
			id: caseResult.id,
			label: caseResult.label,
			reference: caseResult.reference,
			args: caseResult.args,
			runDir: caseResult.relativeRunDir,
			status: caseResult.result.status,
			summary: caseResult.result.summary,
		})),
	});
	await writeJson(path.join(artifact.directory, 'source-sample-traces.json'), {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-source-traces',
		cases: caseResults.map((caseResult) => ({
			id: caseResult.id,
			runDir: caseResult.relativeRunDir,
			sourceSampleTraces: caseResult.sourceSampleTraces,
		})),
	});
	await writeJson(path.join(artifact.directory, 'comparison-summary.json'), {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-comparison-summary',
		cases: caseResults.map((caseResult) => ({
			id: caseResult.id,
			runDir: caseResult.relativeRunDir,
			reference: caseResult.reference,
			comparison: comparisonSummary(caseResult.comparison),
		})),
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-cpu-source-contract-regression-matrix-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		artifact,
		summary,
		caseResults,
	}));
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));
}

function makeReport({ artifact, summary, caseResults }) {
	return [
		'# CPU Source Contract Distant-Sun Regression Matrix',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This CPU-only matrix proves the source/geometry contract remains a no-op for existing distant-Sun Algorithm32 reference cases. It does not use the browser harness or shader path.',
		'',
		'## Cases',
		'',
		...caseResults.map(
			(caseResult) =>
				`- \`${caseResult.id}\`: \`${caseResult.relativeRunDir}\` compared against \`${caseResult.reference}\`.`
		),
		'',
		'## Outputs',
		'',
		'- `matrix-cases.json`: case list and per-case result summaries.',
		'- `source-sample-traces.json`: source-sample contract traces for each case.',
		'- `comparison-summary.json`: exact image and stable JSON comparison summaries.',
		'- `criteria-results.json`: aggregate pass/fail criteria.',
		'',
	].join('\n');
}

function criterion({ id, status, tolerance, measured, notes }) {
	return {
		criterionId: id,
		status,
		tolerance,
		measured,
		notes,
	};
}

function summarizeCriteria(criteria) {
	return {
		total: criteria.length,
		passed: criteria.filter((item) => item.status === 'pass').length,
		failed: criteria.filter((item) => item.status === 'fail').length,
		unresolved: criteria.filter((item) => item.status === 'unresolved').length,
	};
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const maxNumber = entries
		.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
		.reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 3))), 0);
	const folderName = `${String(maxNumber + 1).padStart(3, '0')}-${slug(label)}`;
	const directory = path.join(outRoot, folderName);

	await fs.mkdir(directory, { recursive: false });

	return {
		directory,
		folderName,
		relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
	};
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
	await fs.writeFile(filePath, value);
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

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
