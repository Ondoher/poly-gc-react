import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import { ASSET_FONTS_DIR, PREPARED_SVGS_DIR, WIKI_SOURCE_SVGS_DIR } from '../shared/asset-paths.js';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const FACE_KEY = process.argv[2] || 'b-8';
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const RED = '#FC1D05';
const GREEN = '#2FC906';
const BLUE = '#0505D1';
const FACE_VIEWBOX = '0 0 94 136';

const FACE_CONFIG = {
	'b-8': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'b-8.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'b-8.svg'),
		number: '8',
		title: 'Bamboo 8 preprocessed face',
		artGroupId: 'bamboo-8-face-art',
		numberTransform: 'translate(39.55 68.0) scale(1.052 1.829) translate(-35.4 -69.1)',
		artTransform: 'matrix(0.604516 0 0 0.627642 108.6101 -207.8369)',
	},
};

const config = FACE_CONFIG[FACE_KEY];

if (!config) {
	console.error(`Unsupported bamboo face key "${FACE_KEY}". Supported: ${Object.keys(FACE_CONFIG).join(', ')}`);
	process.exit(1);
}

const source = fs.readFileSync(config.source, 'utf8');
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const art = recolorBambooArt(extractBamboo8Art(source));
const numberPathData = glutenFont.getPath(config.number, 35.4, 75.2, 18).toPathData(3);

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}">
	<title>${config.title}</title>
	<desc>
		Preprocessed path-only bamboo 8 face generated from raw SVG bamboo/bird geometry.
		Bamboo 8 is a special layout: its red number is centered inside the artwork
		rather than placed in the normal upper-left suit-label position.
	</desc>
	<g id="${config.artGroupId}" transform="${config.artTransform}">
${indent(art, 2)}
	</g>
	<g id="number" transform="${config.numberTransform}">
		<path fill="${RED}" data-generated-font="Gluten 800" d="${numberPathData}"/>
	</g>
</svg>
`;

fs.mkdirSync(path.dirname(config.output), { recursive: true });
fs.writeFileSync(config.output, output);
console.log(`Wrote ${path.relative(process.cwd(), config.output)}`);

function extractBamboo8Art(svgSource) {
	const startMatch = /<g>\s*<path class="st7"/.exec(svgSource);

	if (!startMatch) {
		throw new Error(`Could not find bamboo 8 art group in ${config.source}`);
	}

	const start = svgSource.lastIndexOf('<g>', startMatch.index + 1);
	const end = findGroupEnd(svgSource, start + 3);

	if (!end) {
		throw new Error(`Could not find bamboo 8 art group end in ${config.source}`);
	}

	return svgSource.slice(start, end);
}

function findGroupEnd(svgSource, startIndex) {
	const tagPattern = /<\/?g\b[^>]*>/gi;
	tagPattern.lastIndex = startIndex;
	let depth = 1;
	let match;

	while ((match = tagPattern.exec(svgSource)) !== null) {
		if (match[0].startsWith('</')) {
			depth -= 1;
		} else if (!match[0].endsWith('/>')) {
			depth += 1;
		}

		if (depth === 0) {
			return tagPattern.lastIndex;
		}
	}

	return null;
}

function recolorBambooArt(svgFragment) {
	return svgFragment
		.replace(/\bclass="st7"/g, `class="st7" fill="${GREEN}" stroke="${GREEN}" stroke-width="2" stroke-miterlimit="10"`)
		.replace(/\bclass="st8"/g, `class="st8" fill="${GREEN}" stroke="${GREEN}" stroke-width="2" stroke-miterlimit="10"`)
		.replace(/#038249/gi, GREEN)
		.replace(/#2A3B92/gi, BLUE);
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

