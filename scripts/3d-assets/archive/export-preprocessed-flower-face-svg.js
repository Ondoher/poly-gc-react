import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parse as parseSvgAst } from 'svg-parser';
import {
	ASSET_FONTS_DIR,
	OTHER_SOURCE_SVGS_DIR,
	OUTPUT_OVERLAYS_DIR,
	PREPARED_SVGS_DIR,
	ROOT_DIR,
} from '../shared/asset-paths.js';

if (typeof globalThis.DOMParser === 'undefined') {
	globalThis.DOMParser = class {
		parseFromString(source) {
			const ast = parseSvgAst(source);
			const svgRoot = ast.children.find((node) => node.type === 'element');
			const idMap = new Map();
			const document = {
				documentElement: null,
				getElementById(id) {
					return idMap.get(id) ?? null;
				},
			};
			const documentElement = wrapSvgAstNode(svgRoot, document, idMap);
			document.documentElement = documentElement;
			assignViewportElement(documentElement, document);
			return document;
		}
	};
}

const SOURCE_SVG = path.resolve(OTHER_SOURCE_SVGS_DIR, 'Plum.svg');
const OUTPUT_SVG = path.resolve(PREPARED_SVGS_DIR, 'flower-1.svg');
const LEGACY_OUTPUT_SVG = path.resolve(OUTPUT_OVERLAYS_DIR, 'flower-1-preprocessed-face.svg');
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const PREVIEW_WIDTH = 94;
const PREVIEW_HEIGHT = 136;

const INLAY_CLASSES = Object.freeze({
	st7: '#FC1D05',
	st8: '#0505D1',
	st9: '#FC1D05',
	st10: '#2FC906',
});

const PNG_TO_FACE_SCALE = Object.freeze({
	x: PREVIEW_WIDTH / 164,
	y: PREVIEW_HEIGHT / 238,
});

const COMPOSITION_GROUPS = Object.freeze([
	{
		id: 'character',
		classes: ['st8'],
		targetBoundsFromPng: [13, 16, 62, 62],
	},
	{
		id: 'flower-and-stem',
		classes: ['st9', 'st10'],
		targetBoundsFromPng: [27, 59, 130, 218],
	},
]);

const svgLoader = new SVGLoader();
const svgSource = fs.readFileSync(SOURCE_SVG, 'utf8');
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const numberPathData = glutenFont.getPath('1', 75, 31.9, 29).toPathData(3);
const orderedPaths = extractOrderedInlayPaths(svgSource);
const outputGroups = COMPOSITION_GROUPS.map((group) => {
	const groupPaths = orderedPaths.filter((pathEntry) => group.classes.includes(pathEntry.className));
	const sourceGlyphBounds = measureSourceGlyphBounds(svgSource, groupPaths);
	const targetRect = convertPngBoundsToFaceRect(group.targetBoundsFromPng);
	const scale = Math.min(
		targetRect.width / Math.max(sourceGlyphBounds.width, 0.000001),
		targetRect.height / Math.max(sourceGlyphBounds.height, 0.000001)
	);
	const targetCenter = {
		x: targetRect.x + (targetRect.width / 2),
		y: targetRect.y + (targetRect.height / 2),
	};
	const translate = {
		x: targetCenter.x - (sourceGlyphBounds.centerX * scale),
		y: targetCenter.y - (sourceGlyphBounds.centerY * scale),
	};

	return {
		id: group.id,
		scale,
		translate,
		outputPaths: groupPaths.map(createOutputPath),
	};
});

const outputSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}">
	<title>Flower 1 preprocessed face</title>
	<desc>
		Preprocessed Plum.svg face using glyph-path class extraction and palette mapping.
		The number, character, and lower flower/stem artwork are positioned as separate groups
		to match the local flower-1.png composition, where the character and number are raised
		relative to the rest of the artwork. The source SVG number is replaced by a house-styled
		tile number matching the rest of the local PNG/PSD faces. Tile/background layers are omitted.
	</desc>
	<g id="flower-1-preprocessed-face">
		<g id="number" transform="translate(-3 -1.6) translate(80.2 21.3) scale(0.72 1.12) translate(-80.2 -21.3)">
			<path class="st7" fill="${INLAY_CLASSES.st7}" data-source-class="st7" data-generated-font="Gluten 800" d="${numberPathData}"/>
		</g>
${indent(outputGroups.map(renderOutputGroup).join('\n'), 2)}
	</g>
</svg>
`;

fs.mkdirSync(path.dirname(OUTPUT_SVG), { recursive: true });
fs.mkdirSync(path.dirname(LEGACY_OUTPUT_SVG), { recursive: true });
fs.writeFileSync(OUTPUT_SVG, outputSvg);
fs.writeFileSync(LEGACY_OUTPUT_SVG, outputSvg);

console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_SVG)}`);
console.log(`Wrote ${path.relative(process.cwd(), LEGACY_OUTPUT_SVG)}`);

function extractOrderedInlayPaths(source) {
	const orderedPaths = [];
	const classCounts = Object.fromEntries(Object.keys(INLAY_CLASSES).map((className) => [className, 0]));
	const pathMatches = source.matchAll(/<path\b[\s\S]*?\/>/g);

	for (const match of pathMatches) {
		const pathSource = match[0];
		const classMatch = pathSource.match(/\bclass="(st(?:7|8|9|10))"/);

		if (classMatch && INLAY_CLASSES[classMatch[1]]) {
			const className = classMatch[1];
			orderedPaths.push({
				className,
				classIndex: classCounts[className],
				sourceIndex: orderedPaths.length,
				pathSource,
			});
			classCounts[className] += 1;
		}
	}

	return orderedPaths;
}

function createOutputPath(pathEntry) {
	const pathWithoutClass = pathEntry.pathSource.replace(/\sclass="[^"]*"/, '');
	return pathWithoutClass.replace(
		/<path\b/,
		`<path class="${pathEntry.className}" fill="${INLAY_CLASSES[pathEntry.className]}" data-source-class="${pathEntry.className}"`
	);
}

function convertPngBoundsToFaceRect([left, top, right, bottom]) {
	return {
		x: left * PNG_TO_FACE_SCALE.x,
		y: top * PNG_TO_FACE_SCALE.y,
		width: (right - left) * PNG_TO_FACE_SCALE.x,
		height: (bottom - top) * PNG_TO_FACE_SCALE.y,
	};
}

function renderOutputGroup(group) {
	return `<g id="${group.id}" transform="translate(${round(group.translate.x)} ${round(group.translate.y)}) scale(${round(group.scale)})">
${indent(group.outputPaths.join('\n'), 1)}
</g>`;
}

function measureSourceGlyphBounds(source, orderedPaths) {
	const geometries = [];

	for (const pathEntry of orderedPaths) {
		const sanitizedSvg = createPathSvg(source, pathEntry);
		const svgData = svgLoader.parse(sanitizedSvg);

		for (const svgPath of svgData.paths) {
			const shapes = SVGLoader.createShapes(svgPath);
			for (const shape of shapes) {
				const geometry = new THREE.ShapeGeometry(shape, 10);
				geometries.push(geometry.index ? geometry.toNonIndexed() : geometry);
			}
		}
	}

	if (geometries.length === 0) {
		throw new Error(`No glyph paths found in ${SOURCE_SVG}`);
	}

	const boundsGeometry = BufferGeometryUtils.mergeGeometries(geometries, false);
	geometries.forEach((geometry) => geometry.dispose());
	boundsGeometry.computeBoundingBox();
	const bounds = boundsGeometry.boundingBox?.clone();
	boundsGeometry.dispose();

	if (!bounds) {
		throw new Error('Could not measure glyph bounds.');
	}

	const size = new THREE.Vector3();
	const center = new THREE.Vector3();
	bounds.getSize(size);
	bounds.getCenter(center);

	return {
		width: size.x,
		height: size.y,
		centerX: center.x,
		centerY: center.y,
	};
}

function createPathSvg(source, pathEntry) {
	const viewBoxMatch = source.match(/viewBox="([^"]+)"/);
	const viewBox = viewBoxMatch?.[1] ?? '-192 293.9 210 255';
	const [, , width = '210', height = '255'] = viewBox.split(/\s+/);
	const withoutClass = pathEntry.pathSource.replace(/\sclass="[^"]*"/, '');
	const coloredPath = withoutClass.replace(/<path\b/, '<path fill="#000000"');

	return `
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">
			${coloredPath}
		</svg>
	`;
}

function round(value) {
	return Number(value).toFixed(4).replace(/\.?0+$/, '');
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

function wrapSvgAstNode(node, document, idMap) {
	const properties = node?.properties ?? {};
	const domNode = {
		nodeType: 1,
		nodeName: node.tagName,
		childNodes: [],
		style: parseInlineStyle(properties.style),
		viewportElement: null,
		getAttribute(name) {
			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		getAttributeNS(namespace, name) {
			if (namespace === 'http://www.w3.org/1999/xlink') {
				const xlinkValue = readSvgProperty(properties, `xlink:${name}`) ?? readSvgProperty(properties, `xlink${capitalize(name)}`);
				return xlinkValue == null ? null : String(xlinkValue);
			}

			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		hasAttribute(name) {
			return readSvgProperty(properties, name) != null;
		},
	};

	if (properties.id) {
		idMap.set(String(properties.id), domNode);
	}

	const children = Array.isArray(node.children) ? node.children : [];
	domNode.childNodes = children
		.filter((child) => child?.type === 'element')
		.map((child) => wrapSvgAstNode(child, document, idMap));

	return domNode;
}

function assignViewportElement(node, document) {
	node.viewportElement = document;
	for (const child of node.childNodes) {
		assignViewportElement(child, document);
	}
}

function parseInlineStyle(styleText) {
	const styleValues = !styleText
		? {}
		: String(styleText)
			.split(';')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.reduce((result, entry) => {
				const [rawKey, rawValue] = entry.split(':');
				if (!rawKey || !rawValue) {
					return result;
				}

				result[rawKey.trim()] = rawValue.trim();
				return result;
			}, {});

	return new Proxy(styleValues, {
		get(target, property) {
			if (typeof property !== 'string') {
				return target[property];
			}

			return property in target ? target[property] : '';
		},
	});
}

function readSvgProperty(properties, name) {
	if (Object.hasOwn(properties, name)) {
		return properties[name];
	}

	const camelCaseName = name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
	if (Object.hasOwn(properties, camelCaseName)) {
		return properties[camelCaseName];
	}

	return null;
}

function capitalize(value) {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

