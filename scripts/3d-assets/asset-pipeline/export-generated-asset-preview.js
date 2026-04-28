import { renderGeneratedAssetPreview, closeGeneratedAssetPreviewRenderer } from './generated-asset-preview-renderer.js';

await main();

async function main() {
	const options = readOptions();
	const result = await renderGeneratedAssetPreview(options);
	await closeGeneratedAssetPreviewRenderer();
	console.log(`Wrote ${result.outputPng}`);
}

function readOptions() {
	const tilesetId = readArgument('--tileset-id') || process.env.PIPELINE_TILESET_ID;
	const faceKey = readArgument('--face-key') || readPositionalArguments()[0];
	const referenceName = readArgument('--reference-name') || 'default-large-faces';

	if (!tilesetId) {
		throw new Error('Missing --tileset-id.');
	}

	if (!faceKey) {
		throw new Error('Missing --face-key.');
	}

	return {
		tilesetId,
		faceKey,
		referenceName,
	};
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function readPositionalArguments() {
	const positional = [];
	const optionsWithValues = new Set([
		'--tileset-id',
		'--face-key',
		'--reference-name',
	]);

	for (let index = 2; index < process.argv.length; index += 1) {
		const argument = process.argv[index];
		if (optionsWithValues.has(argument)) {
			index += 1;
			continue;
		}
		if (argument.startsWith('--')) {
			continue;
		}
		positional.push(argument);
	}

	return positional;
}
