import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import { ASSET_FONTS_DIR, PREPARED_SVGS_DIR, WIKI_SOURCE_SVGS_DIR } from '../shared/asset-paths.js';
import { sourceToReferenceTransform } from './visual-component-alignment.js';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const ROOT_DIR = path.resolve(SCRIPT_DIR, '..', '..');
const FACE_KEY = process.argv[2] ?? 'c-1';
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');

const RED = '#FC1D05';
const BLUE = '#0505D1';
const GREEN = '#2FC906';
const BLACK = '#000000';
const STANDARD_NUMBER_PATH = Object.freeze({ x: 7.1, y: 28, size: 20 });
const STANDARD_NUMBER_TRANSFORM = 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)';
const LARGE_FACE_CANVAS = Object.freeze({ width: 164, height: 238 });
const STANDARD_CHARACTER_CLASS_COLORS = Object.freeze({
	st7: BLACK,
	st8: RED,
});
const STANDARD_CHARACTER_OBJECTS = Object.freeze([
	{
		id: 'upper-character',
		sourceClass: 'st7',
		transform: 'translate(88.1 -161.8) scale(0.415 0.536)',
	},
	{
		id: 'lower-character',
		sourceClass: 'st8',
		transform: 'translate(98.8 -160.5) scale(0.525)',
	},
]);

const FACE_CONFIG = {
	'c-1': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'c-1.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'c-1.svg'),
		title: 'Characters 1 preprocessed face',
		number: '1',
		numberPath: STANDARD_NUMBER_PATH,
		numberTransform: STANDARD_NUMBER_TRANSFORM,
		numberColor: GREEN,
		artGroupId: 'characters-1-face-art',
		objects: [
			{
				id: 'top-stroke',
				sourceClass: 'st7',
				transform: 'translate(88.1 -161.8) scale(0.415 0.536)',
			},
			{
				id: 'lower-character',
				sourceClass: 'st8',
				transform: 'translate(98.8 -160.5) scale(0.525)',
			},
		],
		classColors: {
			st7: BLACK,
			st8: RED,
		},
	},
	'c-2': standardCharacterConfig('2'),
	'c-3': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'c-3.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'c-3.svg'),
		title: 'Characters 3 preprocessed face',
		number: '3',
		numberPath: STANDARD_NUMBER_PATH,
		numberTransform: STANDARD_NUMBER_TRANSFORM,
		numberColor: GREEN,
		artGroupId: 'characters-3-face-art',
		objects: [
			{
				id: 'upper-small-strokes',
				sourceClass: 'st7',
				subpathIndex: 1,
				transform: 'translate(74.3 -83.34) scale(0.301 0.306)',
			},
			{
				id: 'upper-horizontal-stroke',
				sourceClass: 'st7',
				subpathIndex: 0,
				transform: 'translate(86.53 -169.39) scale(0.427 0.536)',
			},
			{
				id: 'lower-character',
				sourceClass: 'st8',
				transform: 'translate(98.8 -160.5) scale(0.525)',
			},
		],
		classColors: {
			st7: BLACK,
			st8: RED,
		},
	},
	'c-4': standardCharacterConfig('4'),
	'c-5': {
		...standardCharacterConfig('5'),
		objects: [
			{
				id: 'upper-character',
				sourceClass: 'st7',
				transform: 'translate(-7 -7) translate(78 83.5) scale(0.744) translate(-79.5 -86.5) translate(88.1 -161.8) scale(0.415 0.536)',
			},
			{
				id: 'lower-character',
				sourceClass: 'st8',
				transform: 'translate(98.8 -160.5) scale(0.525)',
			},
		],
	},
	'c-6': {
		...standardCharacterConfig('6'),
		objects: [
			{
				id: 'upper-character-1',
				sourceClass: 'st7',
				pathIndex: 0,
				targetPixelBounds: bounds(85, 74, 97, 101),
			},
			{
				id: 'upper-character-2',
				sourceClass: 'st7',
				pathIndex: 1,
				targetPixelBounds: bounds(42, 74, 74, 107),
			},
			{
				id: 'upper-character-3',
				sourceClass: 'st7',
				pathIndex: 2,
				targetPixelBounds: bounds(45, 40, 116, 76),
			},
			{
				id: 'lower-character',
				sourceClass: 'st8',
				targetPixelBounds: bounds(38, 118, 119, 207),
			},
		],
	},
	'c-7': {
		...standardCharacterConfig('7'),
		objects: [
			{
				id: 'upper-character',
				sourceClass: 'st7',
				targetPixelBounds: bounds(45, 43, 112, 94),
			},
			{
				id: 'lower-character',
				sourceClass: 'st8',
				targetPixelBounds: bounds(38, 117, 119, 206),
			},
		],
	},
	'c-8': standardCharacterConfig('8'),
	'c-9': standardCharacterConfig('9'),
};

function standardCharacterConfig(number) {
	return {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, `c-${number}.svg`),
		output: path.resolve(PREPARED_SVGS_DIR, `c-${number}.svg`),
		title: `Characters ${number} preprocessed face`,
		number,
		numberPath: STANDARD_NUMBER_PATH,
		numberTransform: STANDARD_NUMBER_TRANSFORM,
		numberColor: GREEN,
		artGroupId: `characters-${number}-face-art`,
		objects: STANDARD_CHARACTER_OBJECTS,
		classColors: STANDARD_CHARACTER_CLASS_COLORS,
	};
}

function bounds(left, top, right, bottom) {
	return { left, top, right, bottom };
}

const config = FACE_CONFIG[FACE_KEY];

if (!config) {
	console.error(`Unsupported character face key "${FACE_KEY}". Supported: ${Object.keys(FACE_CONFIG).join(', ')}`);
	process.exit(1);
}

const source = fs.readFileSync(config.source, 'utf8');
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const numberPathData = glutenFont
	.getPath(config.number, config.numberPath.x, config.numberPath.y, config.numberPath.size)
	.toPathData(3);
const sourcePaths = extractFaceArtPaths(source);
const art = config.objects
	.map((object, index) => buildObjectGroup(object, sourcePaths, index))
	.map((pathSource) => indent(pathSource, 2))
	.join('\n');

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 94 136">
	<title>${config.title}</title>
	<desc>
		Preprocessed path-only character face generated from raw SVG artwork.
		The source tile/background layers are omitted and the top number is generated from Gluten 800.
	</desc>
	<g id="number" transform="${config.numberTransform}">
		<path fill="${config.numberColor}" data-generated-font="Gluten 800" d="${numberPathData}"/>
	</g>
	<g id="${config.artGroupId}">
${art}
	</g>
</svg>
`;

fs.mkdirSync(path.dirname(config.output), { recursive: true });
fs.writeFileSync(config.output, output);
console.log(`Wrote ${path.relative(process.cwd(), config.output)}`);

function extractFaceArtPaths(svgSource) {
	paper.setup([512, 512]);
	const matches = [...svgSource.matchAll(/<path\s+class="(st[78])"\s+d="([^"]+)"\s*\/>/g)];

	if (matches.length < 2) {
		throw new Error(`Expected to find at least two face-art paths in ${config.source}`);
	}

	return matches.map(([fullPath, className, pathData]) => ({
		className,
		fullPath,
		pathData,
		bounds: getPathBounds(pathData),
	}));
}

function buildObjectGroup(object, sourcePaths, index) {
	const matchingPaths = sourcePaths.filter(({ className }) => className === object.sourceClass);
	const sourcePath = matchingPaths[object.pathIndex ?? 0];

	if (!sourcePath) {
		throw new Error(`Could not find source path for ${object.id} (${object.sourceClass})`);
	}

	const transform = object.transform
		|| sourceToReferenceTransform(sourcePath.bounds, object.targetPixelBounds, LARGE_FACE_CANVAS);

	return `<g id="${object.id}" transform="${transform}">
${indent(recolorPath(sourcePath.fullPath, index, object.subpathIndex), 1)}
</g>`;
}

function getPathBounds(pathData) {
	const pathItem = new paper.CompoundPath(pathData);
	const result = {
		left: pathItem.bounds.left,
		top: pathItem.bounds.top,
		right: pathItem.bounds.right,
		bottom: pathItem.bounds.bottom,
		width: pathItem.bounds.width,
		height: pathItem.bounds.height,
	};
	pathItem.remove();
	return result;
}

function recolorPath(pathSource, index, subpathIndex) {
	let outputPath = pathSource;

	if (subpathIndex != null) {
		outputPath = replacePathDataWithSubpath(outputPath, subpathIndex);
	}

	return outputPath.replace(/<path\s+class="(st[78])"/, (match, className) => {
		const color = config.classColors[className];

		if (!color) {
			throw new Error(`No palette mapping configured for ${className}`);
		}

		return `<path id="${config.artGroupId}-path-${index + 1}" class="${className}" fill="${color}" data-source-class="${className}"`;
	});
}

function replacePathDataWithSubpath(pathSource, subpathIndex) {
	return pathSource.replace(/\sd="([^"]+)"/, (match, pathData) => {
		const subpaths = splitSubpaths(pathData);
		const subpath = subpaths[subpathIndex];

		if (!subpath) {
			throw new Error(`Could not find subpath ${subpathIndex} in ${pathSource.slice(0, 80)}...`);
		}

		return ` d="${subpath}"`;
	});
}

function splitSubpaths(pathData) {
	return pathData
		.trim()
		.split(/\s+(?=M[-\d.])/)
		.map((subpath) => subpath.trim())
		.filter(Boolean);
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

