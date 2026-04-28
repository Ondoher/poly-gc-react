import fs from 'fs';
import path from 'path';
import { LARGE_FACES_DIR, OUTPUT_OVERLAYS_DIR, PREPARED_SVGS_DIR } from '../shared/asset-paths.js';

const SOURCE_PNG = path.resolve(LARGE_FACES_DIR, 'd-7.png');
const FACE_SVG = path.resolve(PREPARED_SVGS_DIR, 'd-7.svg');
const OUTPUT_OVERLAY = path.resolve(OUTPUT_OVERLAYS_DIR, 'MJt7-face-png-overlay.svg');

const PNG_WIDTH = 164;
const PNG_HEIGHT = 238;
const FACE_WIDTH = 94;
const FACE_HEIGHT = 136;

const pngData = fs.readFileSync(SOURCE_PNG).toString('base64');
const faceSvg = fs.readFileSync(FACE_SVG, 'utf8');
const faceContent = extractSvgContent(faceSvg);

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PNG_WIDTH}" height="${PNG_HEIGHT}" viewBox="0 0 ${PNG_WIDTH} ${PNG_HEIGHT}">
	<title>Dots 7 SVG over local PNG reference</title>
	<desc>
		Comparison overlay. The local large face PNG is underneath at reduced opacity.
		The extracted SVG face is rendered on top and scaled to the same full face canvas.
	</desc>
	<rect width="${PNG_WIDTH}" height="${PNG_HEIGHT}" fill="#f6f6f6"/>
	<image href="data:image/png;base64,${pngData}" x="0" y="0" width="${PNG_WIDTH}" height="${PNG_HEIGHT}" opacity="0.42"/>
	<g opacity="0.72" transform="scale(${PNG_WIDTH / FACE_WIDTH} ${PNG_HEIGHT / FACE_HEIGHT})">
${indent(faceContent, 2)}
	</g>
</svg>
`;

fs.mkdirSync(path.dirname(OUTPUT_OVERLAY), { recursive: true });
fs.writeFileSync(OUTPUT_OVERLAY, output);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_OVERLAY)}`);

function extractSvgContent(svgSource) {
	const svgOpenTag = svgSource.match(/<svg\b[^>]*>/i);

	if (!svgOpenTag) {
		throw new Error(`Could not find root SVG tag in ${FACE_SVG}`);
	}

	const openTagEnd = svgOpenTag.index + svgOpenTag[0].length - 1;
	const closeTagStart = svgSource.lastIndexOf('</svg>');

	if (closeTagStart === -1) {
		throw new Error(`Could not read SVG content from ${FACE_SVG}`);
	}

	return svgSource.slice(openTagEnd + 1, closeTagStart).trim();
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

