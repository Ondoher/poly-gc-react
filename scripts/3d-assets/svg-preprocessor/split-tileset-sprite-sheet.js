import fs from 'fs';
import path from 'path';
import { requireArgument } from './cli-arguments.js';
import { normalizePath, writeJson } from './preprocessed-face-validation-utils.js';
import { PipelineModel } from './PipelineModel.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import { updateTilesetManifestSync } from './tileset-manifest.js';

const DEFAULT_REFERENCE_NAME = 'default-large-faces';
const sourcePath = path.resolve(process.cwd(), requireArgument('--source'));
const sheetId = requireArgument('--sheet-id');
const outputDir = path.resolve(process.cwd(), requireArgument('--output'));
const manifestPath = path.resolve(outputDir, 'manifest.json');
const model = new PipelineModel({ referenceName: DEFAULT_REFERENCE_NAME, tileSetName: sheetId });
await model.start();

const source = fs.readFileSync(sourcePath, 'utf8');
const svgInfo = readSvgInfo(source);
const defs = readDefs(source);
const elementsById = collectElementsById(source);
const faceGroups = collectFaceGroups(elementsById);
const manifest = {
	description: 'Per-face source SVGs extracted from a semantically grouped tileset sprite sheet.',
	source: normalizePath(sourcePath),
	sheetId,
	generatedAt: new Date().toISOString(),
	outputDir: normalizePath(outputDir),
	faces: {},
};

fs.mkdirSync(outputDir, { recursive: true });

for (const faceGroup of faceGroups) {
	const expanded = expandUses(faceGroup.element, elementsById);
	const cropBounds = findFaceCropBounds({
		svgInfo,
		defs,
		sourceGroupId: faceGroup.groupId,
		faceKey: faceGroup.faceKey,
		body: expanded,
	});
	const outputPath = path.resolve(outputDir, `${faceGroup.faceKey}.svg`);
	const output = renderFaceSvg({
		svgInfo,
		defs,
		sourceGroupId: faceGroup.groupId,
		faceKey: faceGroup.faceKey,
		body: expanded,
		cropBounds,
	});

	fs.writeFileSync(outputPath, output);
	const modelSourcePath = model.sourceSvgPath(faceGroup.faceKey);
	fs.mkdirSync(path.dirname(modelSourcePath), { recursive: true });
	if (path.resolve(outputPath) !== path.resolve(modelSourcePath)) {
		fs.copyFileSync(outputPath, modelSourcePath);
	}
	manifest.faces[faceGroup.faceKey] = {
		sourceGroupId: faceGroup.groupId,
		output: normalizePath(modelSourcePath),
		viewBox: cropBounds,
	};
}

writeJson(manifestPath, manifest);
model.pipelineState = await model.buildPipelineStateFromBootstrap({ manifest });
await model.save({ preserveCurrencyDate: true });
updateTilesetManifestSync({
	tilesetId: sheetId,
	generatedOn: model.getCurrencyDate(),
});
console.log(`Wrote ${faceGroups.length} extracted face SVGs to ${normalizePath(outputDir)}`);
console.log(`Wrote ${normalizePath(manifestPath)}`);
console.log(`Wrote ${normalizePath(model.pipelineFilename)}`);

function readSvgInfo(svgSource) {
	const openTag = /<svg\b[^>]*>/i.exec(svgSource)?.[0] || '<svg>';
	const attrs = parseAttributes(openTag);
	const width = readLength(attrs.width) || 768;
	const height = readLength(attrs.height) || 561;
	const viewBox = attrs.viewBox || `0 0 ${width} ${height}`;
	const namespaces = Object.fromEntries(
		Object.entries(attrs)
			.filter(([name]) => name === 'xmlns' || name.startsWith('xmlns:')),
	);

	return {
		width,
		height,
		viewBox,
		namespaces,
	};
}

function readDefs(svgSource) {
	return findElementByTag(svgSource, 'defs') || '';
}

function collectFaceGroups(elementsById) {
	return [...elementsById.entries()]
		.map(([groupId, element]) => ({
			groupId,
			faceKey: faceKeyFromGroupId(groupId),
			element,
		}))
		.filter((entry) => entry.faceKey)
		.sort((left, right) => left.faceKey.localeCompare(right.faceKey));
}

function faceKeyFromGroupId(groupId) {
	const match = /^(CHARACTER|BAMBOO|ROD|SEASON|FLOWER|WIND|DRAGON)_(\d+)$/i.exec(groupId);

	if (!match) {
		return null;
	}

	const [, kind, rawIndex] = match;
	const index = Number(rawIndex);
	const normalizedKind = kind.toUpperCase();

	if (normalizedKind === 'CHARACTER') {
		return `c-${index}`;
	}

	if (normalizedKind === 'BAMBOO') {
		return `b-${index}`;
	}

	if (normalizedKind === 'ROD') {
		return `d-${index}`;
	}

	if (normalizedKind === 'SEASON') {
		return `season-${index}`;
	}

	if (normalizedKind === 'FLOWER') {
		return `flower-${index}`;
	}

	if (normalizedKind === 'WIND') {
		return {
			1: 'wind-n',
			2: 'wind-s',
			3: 'wind-e',
			4: 'wind-w',
		}[index] || null;
	}

	if (normalizedKind === 'DRAGON') {
		return {
			1: 'dragon-w',
			2: 'dragon-g',
			3: 'dragon-r',
		}[index] || null;
	}

	return null;
}

function collectElementsById(svgSource) {
	const elements = new Map();
	const tagPattern = /<[^>]+>/g;
	let match;

	while ((match = tagPattern.exec(svgSource)) !== null) {
		const tag = match[0];

		if (/^<\//.test(tag) || /^<\?/.test(tag) || /^<!/.test(tag)) {
			continue;
		}

		const tagName = readTagName(tag);
		const attrs = parseAttributes(tag);

		if (!tagName || !attrs.id) {
			continue;
		}

		if (isSelfClosing(tag)) {
			elements.set(attrs.id, tag);
			continue;
		}

		const endIndex = findElementEnd(svgSource, tagPattern.lastIndex, tagName);
		if (endIndex < 0) {
			continue;
		}

		elements.set(attrs.id, svgSource.slice(match.index, endIndex));
	}

	return elements;
}

function expandUses(svgFragment, elementsById, seen = new Set()) {
	return svgFragment.replace(/<use\b[^>]*\/?>/gi, (tag) => {
		const attrs = parseAttributes(tag);
		const href = attrs['xlink:href'] || attrs.href || '';
		const refId = href.startsWith('#') ? href.slice(1) : null;

		if (!refId || !elementsById.has(refId)) {
			return `<!-- Missing use reference: ${escapeXml(href)} -->`;
		}

		if (seen.has(refId)) {
			return `<!-- Skipped recursive use reference: ${escapeXml(href)} -->`;
		}

		const transform = combineUseTransform(attrs);
		const referenced = stripXmlDeclaration(elementsById.get(refId));
		const expanded = expandUses(referenced, elementsById, new Set([...seen, refId]));

		return `<g data-source-use="${escapeXml(refId)}"${transform ? ` transform="${escapeXml(transform)}"` : ''}>${expanded}</g>`;
	});
}

function combineUseTransform(attrs) {
	const transforms = [];
	const x = Number.parseFloat(attrs.x || '0');
	const y = Number.parseFloat(attrs.y || '0');

	if ((Number.isFinite(x) && x !== 0) || (Number.isFinite(y) && y !== 0)) {
		transforms.push(`translate(${Number.isFinite(x) ? x : 0},${Number.isFinite(y) ? y : 0})`);
	}

	if (attrs.transform) {
		transforms.push(attrs.transform);
	}

	return transforms.join(' ');
}

function findFaceCropBounds({ svgInfo, defs, sourceGroupId, faceKey, body }) {
	const svg = renderFaceSvg({
		svgInfo,
		defs,
		sourceGroupId,
		faceKey,
		body,
		cropBounds: null,
	});
	const components = extractSourceSvgComponents(svg).components;
	const faceSize = components.find((component) => component.id === 'facesize');
	const bounds = faceSize?.bounds || unionBounds(components.map((component) => component.bounds));

	if (!bounds) {
		return {
			left: 0,
			top: 0,
			width: svgInfo.width,
			height: svgInfo.height,
		};
	}

	return {
		left: round(bounds.left),
		top: round(bounds.top),
		width: round(bounds.width),
		height: round(bounds.height),
	};
}

function unionBounds(boundsList) {
	const validBounds = boundsList.filter(Boolean);

	if (validBounds.length === 0) {
		return null;
	}

	const left = Math.min(...validBounds.map((bounds) => bounds.left));
	const top = Math.min(...validBounds.map((bounds) => bounds.top));
	const right = Math.max(...validBounds.map((bounds) => bounds.right));
	const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function renderFaceSvg({ svgInfo, defs, sourceGroupId, faceKey, body, cropBounds }) {
	const namespaceAttributes = Object.entries({
		xmlns: 'http://www.w3.org/2000/svg',
		'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
		'xmlns:cc': 'http://web.resource.org/cc/',
		'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
		'xmlns:svg': 'http://www.w3.org/2000/svg',
		'xmlns:xlink': 'http://www.w3.org/1999/xlink',
		'xmlns:sodipodi': 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd',
		'xmlns:inkscape': 'http://www.inkscape.org/namespaces/inkscape',
		...svgInfo.namespaces,
	})
		.map(([name, value]) => `     ${name}="${escapeXml(value)}"`)
		.join('\n');
	const viewBox = cropBounds
		? `${cropBounds.left} ${cropBounds.top} ${cropBounds.width} ${cropBounds.height}`
		: svgInfo.viewBox;
	const width = cropBounds?.width || svgInfo.width;
	const height = cropBounds?.height || svgInfo.height;

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg
${namespaceAttributes}
     width="${width}"
     height="${height}"
     viewBox="${escapeXml(viewBox)}"
     data-source-group="${escapeXml(sourceGroupId)}"
     data-face-key="${escapeXml(faceKey)}">
${defs}
${body}
</svg>
`;
}

function findElementByTag(svgSource, tagName) {
	const openMatch = new RegExp(`<${tagName}\\b[^>]*>`, 'i').exec(svgSource);

	if (!openMatch) {
		return null;
	}

	const endIndex = findElementEnd(svgSource, openMatch.index + openMatch[0].length, tagName);
	return endIndex >= 0 ? svgSource.slice(openMatch.index, endIndex) : null;
}

function findElementEnd(svgSource, startIndex, tagName) {
	const tagPattern = /<[^>]+>/g;
	let depth = 1;
	tagPattern.lastIndex = startIndex;

	for (let match = tagPattern.exec(svgSource); match; match = tagPattern.exec(svgSource)) {
		const tag = match[0];
		const currentName = readTagName(tag);

		if (currentName !== tagName) {
			continue;
		}

		if (/^<\//.test(tag)) {
			depth -= 1;
			if (depth === 0) {
				return tagPattern.lastIndex;
			}
		} else if (!isSelfClosing(tag) && !/^<\?/.test(tag) && !/^<!/.test(tag)) {
			depth += 1;
		}
	}

	return -1;
}

function parseAttributes(tag) {
	const attributes = {};

	for (const match of tag.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) {
		attributes[match[1]] = match[2];
	}

	return attributes;
}

function readTagName(tag) {
	const match = /^<\s*\/?\s*([:\w-]+)/.exec(tag);
	return match?.[1]?.toLowerCase() || '';
}

function isSelfClosing(tag) {
	return /\/>\s*$/.test(tag);
}

function readLength(value) {
	if (!value) {
		return null;
	}

	const number = Number.parseFloat(value);
	return Number.isFinite(number) ? number : null;
}

function round(value) {
	return Number(value.toFixed(3));
}

function stripXmlDeclaration(svgFragment) {
	return svgFragment.replace(/^<\?xml[\s\S]*?\?>\s*/i, '');
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

