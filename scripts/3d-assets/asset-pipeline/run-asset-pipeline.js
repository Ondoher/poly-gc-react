import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ROOT_DIR, sanitizeOutputScope } from '../shared/asset-paths.js';

const DEFAULT_CONFIG = 'scripts/data/3d-assets/json/asset-pipeline.json';
const STAGE_COMMANDS = Object.freeze({
	preprocess: (job) => [
		'scripts/3d-assets/svg-preprocessor/run-preprocessed-face-pipeline.js',
		'--metadata',
		job.metadata,
		job.faceKey,
	],
	cutter: (job) => ['scripts/3d-assets/asset-pipeline/export-svg-cutter.js', job.faceKey],
	'stamped-pair': (job) => ['scripts/3d-assets/asset-pipeline/export-stamped-tile-pair.js', job.faceKey],
	inlay: (job) => ['scripts/3d-assets/asset-pipeline/export-stamped-tile-inlay.js', job.faceKey],
});

const configPath = path.resolve(ROOT_DIR, readArgument('--config') || DEFAULT_CONFIG);
const config = readJson(configPath);
const requestedJobIds = readPositionalArguments();
const selectedJobIds = requestedJobIds.length > 0
	? requestedJobIds
	: [config.defaultJob].filter(Boolean);
const jobs = selectedJobIds.length > 0
	? selectedJobIds.map((jobId) => findJob(config, jobId))
	: config.jobs || [];

if (jobs.length === 0) {
	throw new Error('No asset pipeline jobs selected.');
}

for (const job of jobs) {
	runJob(job);
}

writePocManifest(config);
syncDistModels(config);

function runJob(job) {
	const stages = job.stages || [];
	const outputScope = sanitizeOutputScope(job.outputScope || job.tilesetId || '');
	const env = {
		...process.env,
		...(outputScope ? { FACE_OUTPUT_SCOPE: outputScope, PIPELINE_TILESET_ID: outputScope } : {}),
	};

	if (job.sourceDir) {
		env.FACE_SOURCE_SVGS_DIR = job.sourceDir;
	}

	console.log(`\nAsset pipeline job: ${job.id || job.faceKey}`);
	for (const stage of stages) {
		const makeCommand = STAGE_COMMANDS[stage];
		if (!makeCommand) {
			throw new Error(`Unsupported asset pipeline stage "${stage}" for ${job.id || job.faceKey}.`);
		}

		const command = makeCommand(job);
		console.log(`\n> node ${command.join(' ')}`);
		const result = spawnSync(process.execPath, command, {
			cwd: ROOT_DIR,
			env,
			stdio: 'inherit',
			shell: false,
		});

		if (result.status !== 0) {
			throw new Error(`Asset pipeline stage "${stage}" failed for ${job.id || job.faceKey}.`);
		}
	}
}

function writePocManifest(config) {
	const manifestPath = config.poc?.manifestPath;
	if (!manifestPath) {
		return;
	}

	const outputPath = path.resolve(ROOT_DIR, manifestPath);
	const manifest = {
		generatedAt: new Date().toISOString(),
		tiles: config.poc.tiles || [],
	};

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
	console.log(`\nWrote ${path.relative(ROOT_DIR, outputPath)}`);
}

function syncDistModels(config) {
	if (!config.poc?.syncDist) {
		return;
	}

	const sourceDir = path.resolve(ROOT_DIR, 'scripts/output/3d-assets/models');
	const distDir = path.resolve(ROOT_DIR, 'dist/3d-poc/models');
	if (!fs.existsSync(sourceDir) || !fs.existsSync(distDir)) {
		return;
	}

	for (const filename of fs.readdirSync(sourceDir)) {
		if (!/\.(glb|json)$/i.test(filename)) {
			continue;
		}

		fs.copyFileSync(path.resolve(sourceDir, filename), path.resolve(distDir, filename));
	}
	console.log(`Synced generated models to ${path.relative(ROOT_DIR, distDir)}`);
}

function findJob(config, jobId) {
	const job = (config.jobs || []).find((candidate) => candidate.id === jobId);
	if (!job) {
		throw new Error(`Unknown asset pipeline job "${jobId}".`);
	}
	return job;
}

function readJson(filename) {
	return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function readPositionalArguments() {
	const positional = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		const argument = process.argv[index];
		if (argument === '--config') {
			index += 1;
			continue;
		}
		positional.push(argument);
	}
	return positional;
}


