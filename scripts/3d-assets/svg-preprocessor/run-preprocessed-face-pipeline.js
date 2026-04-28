import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { loadFacePreprocessingMetadata } from './face-preprocessing-metadata.js';
import { sanitizeOutputScope } from '../shared/asset-paths.js';

const EXPORTER_BY_KIND = Object.freeze({
	generic: 'export-preprocessed-generic-face-svg.js',
	'generic-special': 'export-preprocessed-generic-special-face-svg.js',
});
const metadataPath = readArgument('--metadata');
const metadataOverride = readMetadataOverride(metadataPath);
const metadataEnv = buildMetadataEnv(metadataPath, metadataOverride);
const metadata = loadFacePreprocessingMetadata(metadataPath);
const requestedFaceKeys = readPositionalArguments();
const faceKeys = requestedFaceKeys.length > 0
	? requestedFaceKeys
	: Object.keys(metadata);
const results = [];

for (const faceKey of faceKeys) {
	const faceMetadata = metadata[faceKey];

	if (!faceMetadata) {
		results.push({ faceKey, status: 'skipped', reason: 'no-metadata' });
		continue;
	}

	const exporterKind = faceMetadata.exporter || 'generic';
	const exporter = EXPORTER_BY_KIND[exporterKind];

	if (!exporter) {
		results.push({ faceKey, status: 'skipped', reason: `unsupported-exporter-${exporterKind}` });
		continue;
	}

	const steps = [
		[exporter, [faceKey]],
		['inspect-source-svg-components.js', [faceKey]],
		['compare-preprocessed-face.js', [faceKey]],
	];
	let status = 'ok';
	let failedStep = null;

	for (const [script, args] of steps) {
		const step = runNodeScript(script, args);

		if (step.status !== 0) {
			status = 'failed';
			failedStep = script;
			break;
		}
	}

	results.push({ faceKey, status, exporter: exporterKind, failedStep });
}

console.log('\nPreprocessed face pipeline summary');
for (const result of results) {
	const suffix = result.reason
		? ` (${result.reason})`
		: result.failedStep
			? ` (${result.exporter}; ${result.failedStep})`
			: ` (${result.exporter})`;
	console.log(`- ${result.faceKey}: ${result.status}${suffix}`);
}

if (results.some((result) => result.status === 'failed')) {
	process.exit(1);
}

function runNodeScript(script, args) {
	const command = ['scripts/3d-assets/svg-preprocessor/' + script, ...args];
	console.log(`\n> node ${command.join(' ')}`);
	return spawnSync(process.execPath, command, {
		stdio: 'inherit',
		shell: false,
		env: {
			...process.env,
			...metadataEnv,
		},
	});
}

function readMetadataOverride(filename) {
	if (!filename) {
		return null;
	}

	const resolvedPath = path.resolve(process.cwd(), filename);

	if (!fs.existsSync(resolvedPath)) {
		return null;
	}

	return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

function buildMetadataEnv(filename, override) {
	const env = filename
		? { FACE_PREPROCESSING_METADATA: path.resolve(process.cwd(), filename) }
		: {};
	const sourceDir = override?.sourceDir;
	const outputScope = deriveOutputScope(override);

	if (sourceDir && !process.env.FACE_SOURCE_SVGS_DIR) {
		env.FACE_SOURCE_SVGS_DIR = sourceDir;
	}

	if (outputScope && !process.env.FACE_OUTPUT_SCOPE && !process.env.PIPELINE_TILESET_ID) {
		env.FACE_OUTPUT_SCOPE = outputScope;
	}

	return env;
}

function deriveOutputScope(override) {
	if (!override?.tilesetGlyphs) {
		return null;
	}

	const explicit = override.tilesetId || override.tilesetName || override.outputScope;
	if (explicit) {
		return sanitizeOutputScope(explicit);
	}

	if (override.sourceDir) {
		return sanitizeOutputScope(override.sourceDir);
	}

	return null;
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function readPositionalArguments() {
	const positional = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		const argument = process.argv[index];
		if (argument === '--metadata') {
			index += 1;
			continue;
		}
		positional.push(argument);
	}
	return positional;
}


