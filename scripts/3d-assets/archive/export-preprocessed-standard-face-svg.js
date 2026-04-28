import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import sharp from 'sharp';
import { ASSET_FONTS_DIR, LARGE_FACES_DIR, PREPARED_SVGS_DIR, WIKI_SOURCE_SVGS_DIR } from '../shared/asset-paths.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import {
	getPaintComponents,
	isRelatedKnockout,
	makePaintPathWithKnockouts,
	selectKnockoutComponents,
} from './normalized-face-components.js';
import { sourceToReferenceTransform } from './visual-component-alignment.js';

const FACE_KEY = process.argv[2] || 'd-7';
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const FACE_VIEWBOX = '0 0 94 136';
const LARGE_FACE_CANVAS = Object.freeze({ width: 164, height: 238 });
const RED = '#FC1D05';
const GREEN = '#2FC906';
const BLUE = '#0505D1';
const PALETTE = Object.freeze([
	{ color: RED, rgb: [252, 29, 5] },
	{ color: GREEN, rgb: [47, 201, 6] },
	{ color: BLUE, rgb: [5, 5, 209] },
]);

const FACE_CONFIG = {
	'd-2': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-2.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-2.svg'),
		title: 'Dots 2 preprocessed face',
		number: '2',
		artGroupId: 'dots-2-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: GREEN,
			st8: BLUE,
		},
		targets: [
			bounds(42, 42, 118, 117),
			bounds(45, 130, 121, 206),
		],
	},
	'd-3': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-3.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-3.svg'),
		title: 'Dots 3 preprocessed face',
		number: '3',
		artGroupId: 'dots-3-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: RED,
			st8: GREEN,
			st9: BLUE,
		},
		targets: [
			bounds(76, 25, 142, 90),
			bounds(47, 91, 112, 156),
			bounds(19, 157, 84, 223),
		],
	},
	'd-4': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-4.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-4.svg'),
		title: 'Dots 4 preprocessed face',
		number: '4',
		artGroupId: 'dots-4-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: GREEN,
			st8: BLUE,
		},
		targets: [
			bounds(83, 60, 129, 105),
			bounds(33, 62, 78, 108),
			bounds(81, 139, 126, 185),
			bounds(31, 141, 77, 187),
		],
	},
	'd-5': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-5.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-5.svg'),
		title: 'Dots 5 preprocessed face',
		number: '5',
		artGroupId: 'dots-5-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: BLUE,
			st8: GREEN,
			st9: RED,
		},
		targets: [
			bounds(82, 58, 127, 104, BLUE),
			bounds(34, 62, 79, 108, GREEN),
			bounds(58, 104, 104, 150, RED),
			bounds(33, 147, 78, 192, BLUE),
			bounds(81, 147, 126, 192, GREEN),
		],
	},
	'd-6': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-6.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-6.svg'),
		title: 'Dots 6 preprocessed face',
		number: '6',
		artGroupId: 'dots-6-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: RED,
			st8: GREEN,
		},
		targets: [
			bounds(34, 51, 78, 96),
			bounds(80, 52, 125, 96),
			bounds(35, 99, 78, 143),
			bounds(81, 100, 125, 144),
			bounds(35, 146, 79, 190),
			bounds(82, 147, 126, 190),
		],
	},
	'd-7': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-7.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-7.svg'),
		title: 'Dots 7 preprocessed face',
		number: '7',
		artGroupId: 'dots-7-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		sourceArtGroupId: 'g5021',
		classColors: {
			st7: RED,
			st8: GREEN,
		},
		// Matched from the canonical d-7 reference components, excluding the top number.
		targets: [
			bounds(99, 31, 143, 75),
			bounds(57, 53, 101, 97),
			bounds(16, 75, 60, 119),
			bounds(80, 120, 124, 164),
			bounds(32, 120, 76, 164),
			bounds(79, 168, 123, 212),
			bounds(32, 166, 76, 211),
		],
	},
	'd-8': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-8.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-8.svg'),
		title: 'Dots 8 preprocessed face',
		number: '8',
		artGroupId: 'dots-8-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		classColors: {
			st7: BLUE,
		},
		targets: [
			bounds(52, 29, 96, 73),
			bounds(101, 29, 146, 73),
			bounds(52, 78, 96, 122),
			bounds(101, 78, 146, 122),
			bounds(52, 127, 96, 171),
			bounds(101, 127, 146, 171),
			bounds(51, 176, 95, 221),
			bounds(101, 176, 146, 221),
		],
	},
	'd-9': {
		source: path.resolve(WIKI_SOURCE_SVGS_DIR, 'd-9.svg'),
		output: path.resolve(PREPARED_SVGS_DIR, 'd-9.svg'),
		title: 'Dots 9 preprocessed face',
		number: '9',
		artGroupId: 'dots-9-face-art',
		numberPath: { x: 7.1, y: 28, size: 20 },
		numberTransform: 'translate(2 -1.5) translate(-0.86 -3.1) translate(14.35 18.3) scale(1 1.65) translate(-14.35 -18.3)',
		sourceArtGroupId: 'g7499',
		classColors: {
			st7: RED,
			st8: GREEN,
			st9: BLUE,
		},
		// Matched from the canonical d-9 reference components, excluding the top number.
		targets: [
			bounds(13, 58, 55, 100),
			bounds(59, 58, 101, 100),
			bounds(103, 58, 144, 100),
			bounds(13, 102, 55, 144),
			bounds(59, 103, 101, 145),
			bounds(104, 103, 146, 145),
			bounds(13, 148, 55, 190),
			bounds(59, 149, 101, 190),
			bounds(104, 149, 146, 190),
		],
	},
};

const config = FACE_CONFIG[FACE_KEY];

if (!config) {
	console.error(`Unsupported standard face key "${FACE_KEY}". Supported: ${Object.keys(FACE_CONFIG).join(', ')}`);
	process.exit(1);
}

paper.setup([512, 512]);
const source = fs.readFileSync(config.source, 'utf8');
const referenceRaster = await readReferenceRaster(path.resolve(LARGE_FACES_DIR, `${FACE_KEY}.png`));
const targetColors = config.targets.map((targetBounds) => targetBounds.color || sampleTargetColor(referenceRaster, targetBounds));
const sourceComponents = extractSourceSvgComponents(source).components;
const coloredComponents = getPaintComponents(sourceComponents, Object.keys(config.classColors))
	.sort(compareByPosition);
const cutoutComponents = selectKnockoutComponents(sourceComponents, coloredComponents, {
	maxArea: 500,
	sourceArtGroupId: config.sourceArtGroupId,
}).filter((component) => coloredComponents.some((colored) => isRelatedKnockout(colored, component)));

if (coloredComponents.length !== config.targets.length) {
	throw new Error(`Expected ${config.targets.length} colored components for ${FACE_KEY}; found ${coloredComponents.length}.`);
}

const glutenFont = opentype.loadSync(GLUTEN_FONT);
const numberPathData = glutenFont
	.getPath(config.number, config.numberPath.x, config.numberPath.y, config.numberPath.size)
	.toPathData(3);
const art = coloredComponents
	.map((component, index) => buildColoredComponent(component, config.targets[index], index, cutoutComponents))
	.map((sourceFragment) => indent(sourceFragment, 2))
	.join('\n');

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}">
	<title>${config.title}</title>
	<desc>
		Preprocessed path-only standard face generated from source visual components.
		White and tile-body-colored source details that belong to colored artwork are baked as transparent compound-path cutouts.
	</desc>
	<g id="number" transform="${config.numberTransform}">
		<path fill="${RED}" data-generated-font="Gluten 800" d="${numberPathData}"/>
	</g>
	<g id="${config.artGroupId}">
${art}
	</g>
</svg>
`;

fs.mkdirSync(path.dirname(config.output), { recursive: true });
fs.writeFileSync(config.output, output);
console.log(`Wrote ${path.relative(process.cwd(), config.output)}`);

function buildColoredComponent(component, targetBounds, index, cutouts) {
	const transform = sourceToReferenceTransform(component.bounds, targetBounds, LARGE_FACE_CANVAS);
	const relatedCutouts = cutouts.filter((cutout) => isRelatedKnockout(component, cutout));
	const color = targetColors[index] || config.classColors[component.className];

	return makePaintPathWithKnockouts({
		component,
		color,
		knockouts: relatedCutouts,
		transform,
		attributes: {
			id: `${config.artGroupId}-component-${index + 1}`,
		},
	});
}

function compareByPosition(left, right) {
	return left.center.y - right.center.y || left.center.x - right.center.x;
}

function bounds(left, top, right, bottom, color) {
	return { left, top, right, bottom, color };
}

async function readReferenceRaster(referencePath) {
	const { data, info } = await sharp(referencePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return { data, width: info.width, height: info.height };
}

function sampleTargetColor(referenceRaster, targetBounds) {
	const counts = new Map(PALETTE.map(({ color }) => [color, 0]));

	for (let y = Math.max(0, targetBounds.top); y <= Math.min(referenceRaster.height - 1, targetBounds.bottom); y++) {
		for (let x = Math.max(0, targetBounds.left); x <= Math.min(referenceRaster.width - 1, targetBounds.right); x++) {
			const offset = ((y * referenceRaster.width) + x) * 4;
			const alpha = referenceRaster.data[offset + 3];

			if (alpha <= 20) {
				continue;
			}

			const color = nearestPaletteColor([
				referenceRaster.data[offset],
				referenceRaster.data[offset + 1],
				referenceRaster.data[offset + 2],
			]);
			counts.set(color, counts.get(color) + 1);
		}
	}

	return [...counts.entries()]
		.sort((left, right) => right[1] - left[1])[0]?.[0];
}

function nearestPaletteColor(rgb) {
	return PALETTE
		.map((entry) => ({
			color: entry.color,
			distance: square(rgb[0] - entry.rgb[0]) + square(rgb[1] - entry.rgb[1]) + square(rgb[2] - entry.rgb[2]),
		}))
		.sort((left, right) => left.distance - right.distance)[0].color;
}

function square(value) {
	return value * value;
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

