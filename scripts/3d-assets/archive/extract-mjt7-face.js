import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import {
	ASSET_FONTS_DIR,
	OUTPUT_OVERLAYS_DIR,
	PREPARED_SVGS_DIR,
	WIKI_SOURCE_SVGS_DIR,
} from '../shared/asset-paths.js';

const INPUT_SVG = path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-7.svg');
const OUTPUT_SVG = path.resolve(OUTPUT_OVERLAYS_DIR, 'MJt7-face.svg');
const OUTPUT_TRIMMED_SVG = path.resolve(OUTPUT_OVERLAYS_DIR, 'MJt7-face-trimmed.svg');
const OUTPUT_PREPROCESSED_SVG = path.resolve(PREPARED_SVGS_DIR, 'd-7.svg');
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');

const FACE_VIEWBOX = '0 0 94 136';
const TRIMMED_FACE_VIEWBOX = '8.02 9.71 73.94 111.43';
const FACE_ART_TRANSFORM = 'matrix(1.236 -0.0012 -0.0292 1.3136 -10.476 -22.553) translate(46 69) scale(-0.46 0.46) translate(100.4 -234.2)';
const NUMBER_RED = '#FB1D05';
const DOT_RED = '#FB1D05';
const DOT_GREEN = '#038248';

const source = fs.readFileSync(INPUT_SVG, 'utf8');
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const numberPathData = glutenFont.getPath('7', 7.1, 28, 20).toPathData(3);
const dotArt = extractGroupById(source, 'g5021')
	.replace(/\bclass="st7"/g, `class="st7" fill="${DOT_RED}" stroke="${DOT_RED}" stroke-width="1.15" stroke-linejoin="round"`)
	.replace(/\bclass="st8"/g, `class="st8" fill="${DOT_GREEN}" stroke="${DOT_GREEN}" stroke-width="1.15" stroke-linejoin="round"`)
	.replace(/\bclass="st3"/g, 'fill="#FFFFFF"');

const output = buildFaceSvg({
	viewBox: FACE_VIEWBOX,
	title: 'Dots 7 face extracted from MJt7-.svg',
	descExtra: '',
});

const trimmedOutput = buildFaceSvg({
	viewBox: TRIMMED_FACE_VIEWBOX,
	title: 'Dots 7 face extracted from MJt7-.svg, trimmed to local PNG bounds',
	descExtra: `
		This version is cropped to match the transparent alpha bounds of scripts/data/3d-assets/reference-faces/large-faces/d-7.png.`,
});

fs.writeFileSync(OUTPUT_SVG, output);
fs.writeFileSync(OUTPUT_TRIMMED_SVG, trimmedOutput);
fs.mkdirSync(path.dirname(OUTPUT_PREPROCESSED_SVG), { recursive: true });
fs.writeFileSync(OUTPUT_PREPROCESSED_SVG, output);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_SVG)}`);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_TRIMMED_SVG)}`);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PREPROCESSED_SVG)}`);

function buildFaceSvg({ viewBox, title, descExtra }) {
	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
	<title>${title}</title>
	<desc>
		Face-only experiment using Wikimedia MJt7-.svg dot geometry, recolored to the local PNG palette,
		with an added upper-left red 7 based on scripts/data/3d-assets/reference-faces/faces/d-7.png.
		The dot art is horizontally flipped to match the local PNG orientation.
${descExtra}
	</desc>
	<style>
		.face-number {
			font-family: "Gluten", sans-serif;
			font-size: 20px;
			font-weight: 800;
			font-style: italic;
			paint-order: stroke fill;
		}
	</style>
	<g id="number" transform="translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)">
		<path class="st7" fill="${NUMBER_RED}" data-source-class="st7" data-generated-font="Gluten 800" d="${numberPathData}"/>
	</g>
	<g id="dots-7-face-art" transform="${FACE_ART_TRANSFORM}">
${indent(dotArt, 2)}
	</g>
</svg>
`;
}

function extractGroupById(svgSource, id) {
	const openTagPattern = new RegExp(`<g\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>`, 'i');
	const match = openTagPattern.exec(svgSource);

	if (!match) {
		throw new Error(`Could not find group id "${id}" in ${INPUT_SVG}`);
	}

	let cursor = match.index;
	let depth = 0;

	while (cursor < svgSource.length) {
		const nextOpen = svgSource.indexOf('<g', cursor);
		const nextClose = svgSource.indexOf('</g>', cursor);

		if (nextClose === -1) {
			break;
		}

		if (nextOpen !== -1 && nextOpen < nextClose) {
			depth += 1;
			cursor = nextOpen + 2;
			continue;
		}

		depth -= 1;
		cursor = nextClose + 4;

		if (depth === 0) {
			return svgSource.slice(match.index, cursor);
		}
	}

	throw new Error(`Could not find closing tag for group id "${id}" in ${INPUT_SVG}`);
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

