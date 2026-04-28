import fs from 'fs';
import path from 'path';
import { readArgument, requireArgument } from './cli-arguments.js';
import { PipelineModel, PIPELINE_MANIFESTS } from './PipelineModel.js';
import { normalizePath } from './preprocessed-face-validation-utils.js';
import { updateTilesetManifestSync } from './tileset-manifest.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';

await main();

async function main() {
	const tilesetId = requireArgument('--tileset-id');
	if (readArgument('--pipeline-state')) {
		throw new Error('--pipeline-state is no longer accepted. Intake writes through PipelineModel.');
	}
	if (readArgument('--bootstrap')) {
		throw new Error('--bootstrap is no longer accepted. Intake reads the model-owned bootstrap.');
	}

	const referenceName = readArgument('--reference-name') || DEFAULT_REFERENCE_NAME;
	const model = new PipelineModel({ referenceName, tileSetName: tilesetId });

	await model.start();

	const manifestPath = path.resolve(
		process.cwd(),
		readArgument('--manifest') || path.join(PIPELINE_MANIFESTS, `${tilesetId}.json`),
	);
	const manifest = readJson(manifestPath);

	validateManifest({ manifest, tilesetId });
	writeModelSourceSvgs({ manifest, model });
	model.pipelineState = await model.buildPipelineStateFromBootstrap({ manifest });
	await model.save({ preserveCurrencyDate: true });

	updateTilesetManifestSync({
		tilesetId,
		generatedOn: model.getCurrencyDate(),
	});

	console.log(`Intook ${Object.keys(manifest.faces || {}).length} source SVGs from ${normalizePath(manifestPath)}`);
	console.log(`Wrote ${normalizePath(model.pipelineFilename)}`);
}

function validateManifest({ manifest, tilesetId }) {
	if (manifest.sheetId && manifest.sheetId !== tilesetId) {
		throw new Error(`Manifest sheetId "${manifest.sheetId}" does not match --tileset-id "${tilesetId}".`);
	}
	if (!manifest.faces || typeof manifest.faces !== 'object' || Array.isArray(manifest.faces)) {
		throw new Error('Source SVG manifest must contain a faces object.');
	}
}

function readJson(filePath) {
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeModelSourceSvgs({ manifest, model }) {
	for (const [faceKey, manifestFace] of Object.entries(manifest.faces || {})) {
		writeManifestFaceSourceSvg({
			manifest,
			manifestFace,
			outputSvgPath: model.sourceSvgPath(faceKey),
			faceKey,
		});
	}
}

function writeManifestFaceSourceSvg({ manifest, manifestFace, outputSvgPath, faceKey }) {
	const source = manifestFace?.source || manifestFace?.output;
	if (!source) {
		throw new Error(`Manifest face ${faceKey} is missing source/output.`);
	}

	const sourceSvgPath = path.resolve(process.cwd(), source);
	if (!fs.existsSync(sourceSvgPath)) {
		throw new Error(`Manifest face ${faceKey} source SVG is missing: ${normalizePath(sourceSvgPath)}`);
	}

	const sourceSvg = fs.readFileSync(sourceSvgPath, 'utf8');
	const outputSvg = annotateSourceSvgForIntake(sourceSvg, {
		...(manifest.sourceSvgHints || {}),
		...(manifestFace.sourceSvgHints || {}),
	});

	fs.mkdirSync(path.dirname(outputSvgPath), { recursive: true });
	fs.writeFileSync(outputSvgPath, cleanHintLineEndings(outputSvg));
}

function annotateSourceSvgForIntake(svgSource, hints = {}) {
	const tileBackgroundGroupIds = hints.tileBackgroundGroupIds || [];
	const tileBackgroundElementIds = hints.tileBackgroundElementIds || [];
	const svgWithElementHints = tileBackgroundElementIds.reduce(
		(output, elementId) => annotateElementSourceLayer(output, elementId, 'tile-background'),
		svgSource,
	);

	return tileBackgroundGroupIds.reduce(
		(output, groupId) => annotateGroupSourceLayer(output, groupId, 'tile-background'),
		svgWithElementHints,
	);
}

function annotateGroupSourceLayer(svgSource, groupId, sourceLayerRole) {
	return annotateTagSourceLayer(svgSource, 'g', groupId, sourceLayerRole);
}

function annotateElementSourceLayer(svgSource, elementId, sourceLayerRole) {
	return annotateTagSourceLayer(svgSource, '[A-Za-z][:\\w-]*', elementId, sourceLayerRole);
}

function annotateTagSourceLayer(svgSource, tagNamePattern, elementId, sourceLayerRole) {
	return svgSource.replace(new RegExp(`<${tagNamePattern}\\b[^>]*>`, 'gi'), (tag) => {
		const attributes = parseAttributes(tag);

		if (attributes.id !== elementId || attributes['data-source-layer']) {
			return tag;
		}

		const closing = tag.endsWith('/>') ? '/>' : '>';
		const body = tag.slice(0, -closing.length);

		return `${body} data-source-layer="${escapeXml(sourceLayerRole)}"${closing}`;
	});
}

function cleanHintLineEndings(svgSource) {
	return svgSource.replace(/([^\n]*data-source-layer="tile-background"[^\n]*)\r\n/g, '$1\n');
}

function parseAttributes(tag) {
	const attributes = {};

	for (const match of tag.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) {
		attributes[match[1]] = match[2];
	}

	return attributes;
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
