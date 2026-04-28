import fs from 'fs';
import path from 'path';
import {
	ASSETS_3D_JSON_DIR,
	OUTPUT_3D_DIR,
	WIKI_SOURCE_SVGS_DIR,
} from '../shared/asset-paths.js';
import { findSmallIsolatedCandidates, getComponentUnionBounds } from './normalized-face-components.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import { normalizePath, writeJson } from './preprocessed-face-validation-utils.js';

const FACE_METADATA_PATH = path.resolve(ASSETS_3D_JSON_DIR, 'face-preprocessing-metadata.json');
const OUTPUT_DIR = path.resolve(OUTPUT_3D_DIR, 'metadata-inference');
const DEFAULT_OUTPUT_PATH = path.resolve(OUTPUT_DIR, 'tileset-glyphs.json');
const sourceDir = path.resolve(process.cwd(), readArgument('--source-dir') || WIKI_SOURCE_SVGS_DIR);
const outputPath = path.resolve(process.cwd(), readArgument('--output') || DEFAULT_OUTPUT_PATH);
const tilesetId = readArgument('--tileset-id') || inferTilesetId(sourceDir);
const faceMetadata = JSON.parse(fs.readFileSync(FACE_METADATA_PATH, 'utf8'));

const files = fs.readdirSync(sourceDir)
	.filter((file) => file.toLowerCase().endsWith('.svg'))
	.sort((left, right) => left.localeCompare(right));
const metadata = {
	description: 'Metadata inferred from source tileset SVGs.',
	tilesetId,
	sourceDir: normalizePath(sourceDir),
	generatedAt: new Date().toISOString(),
	tilesetGlyphs: {},
};

for (const file of files) {
	const faceKey = path.basename(file, '.svg');
	const svgPath = path.resolve(sourceDir, file);
	const source = fs.readFileSync(svgPath, 'utf8');
	const extracted = extractSourceSvgComponents(source);
	const faceInfo = faceMetadata[faceKey] || inferBasicFaceMetadata(faceKey);
	const paintComponents = extracted.components
		.filter((component) => !component.tileLayerCandidate)
		.filter((component) => !component.negativeSpaceCandidate);
	const allBounds = getComponentUnionBounds(paintComponents);
	const glyphCandidates = allBounds
		? findSourceGlyphCandidates(paintComponents, allBounds)
		: [];
	const entry = {
		sourceFile: normalizePath(svgPath),
		canvas: canvasFromViewBox(extracted.viewBox, allBounds),
		sourceContainsLabel: sourceNumberPresent(faceInfo),
		sourceComponents: paintComponents.map((component) => formatSourceComponent(component, allBounds)),
		glyphCandidates: glyphCandidates.map((candidate) => formatCandidate(candidate)),
	};

	const number = inferNumber(faceInfo, glyphCandidates, allBounds);
	if (number) {
		entry.number = number;
	}

	const character = inferCharacter(faceKey, faceInfo, glyphCandidates, allBounds);
	if (character) {
		entry.character = character;
	}

	if (entry.number || entry.character || entry.glyphCandidates.length > 0 || faceInfo.labelText || faceMetadata[faceKey]) {
		metadata.tilesetGlyphs[faceKey] = entry;
	}
}

writeJson(outputPath, metadata);
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : null;
}

function inferTilesetId(directory) {
	const normalized = normalizePath(directory);

	if (normalized.endsWith('/wiki-source-svgs')) {
		return 'wiki';
	}

	return path.basename(directory);
}

function findSourceGlyphCandidates(components, allBounds) {
	const items = components.map(sourceComponentCandidate);

	return findSmallIsolatedCandidates(items, allBounds, {
		topBandRatio: 0.45,
		maxAreaRatio: 0.18,
		minWidth: 2,
		minHeight: 2,
	}).slice(0, 16);
}

function inferNumber(metadata, glyphCandidates, allBounds) {
	if (!metadata.labelText) {
		return null;
	}

	if (!sourceNumberPresent(metadata)) {
		return {
			present: false,
			text: metadata.labelText,
			color: metadata.labelColor,
		};
	}

	const expectedCorner = metadata.glyphLayout?.number?.sourceCorner
		|| metadata.referenceGlyphs?.number?.location
		|| 'topLeft';
	const candidate = pickCandidate(glyphCandidates, {
		expectedCorner,
		expectedColor: metadata.labelColor,
		maxAreaRatio: 0.08,
	});

	return candidate
		? {
			present: true,
			text: metadata.labelText,
			color: candidate.item.sourceComponent.fill || candidate.item.sourceComponent.stroke || metadata.labelColor,
			location: relativePosition(candidate.item, allBounds),
			corner: candidate.nearestCorner,
			bounds: compactBounds(candidate.item.sourceComponent),
			inference: 'source-isolated-candidate',
		}
		: { present: false, text: metadata.labelText, color: metadata.labelColor };
}

function sourceNumberPresent(metadata) {
	return metadata.glyphLayout?.number?.sourcePresent ?? metadata.sourceContainsLabel !== false;
}

function inferCharacter(faceKey, metadata, glyphCandidates, allBounds) {
	if (!isFlowerOrSeason(faceKey) || metadata.glyphLayout?.character?.sourcePresent === false) {
		return null;
	}

	const numberCorner = metadata.glyphLayout?.number?.sourceCorner || null;
	const expectedCorner = metadata.glyphLayout?.character?.sourceCorner || oppositeTopCorner(numberCorner);
	const candidate = pickCandidate(glyphCandidates, {
		expectedCorner,
		excludedCorner: numberCorner,
	});

	return candidate
		? {
			present: true,
			color: candidate.item.sourceComponent.fill || candidate.item.sourceComponent.stroke || '',
			location: relativePosition(candidate.item, allBounds),
			corner: candidate.nearestCorner,
			bounds: compactBounds(candidate.item.sourceComponent),
			inference: 'source-isolated-candidate',
		}
		: { present: false };
}

function pickCandidate(glyphCandidates, { expectedCorner, excludedCorner = null, expectedColor = null, maxAreaRatio = null }) {
	const candidates = glyphCandidates
		.filter((candidate) => !excludedCorner || candidate.nearestCorner !== excludedCorner)
		.filter((candidate) => maxAreaRatio == null || candidate.areaRatio <= maxAreaRatio);

	return candidates.sort((left, right) => {
		const leftCorner = cornerOrLocationDistance(left, expectedCorner);
		const rightCorner = cornerOrLocationDistance(right, expectedCorner);
		const leftColorMismatch = colorMismatch(left, expectedColor);
		const rightColorMismatch = colorMismatch(right, expectedColor);

		return leftCorner - rightCorner
			|| leftColorMismatch - rightColorMismatch
			|| left.normalizedCenter.y - right.normalizedCenter.y
			|| left.area - right.area;
	})[0] || null;
}

function formatCandidate(candidate) {
	const component = candidate.item.sourceComponent;

	return {
		color: component.fill || component.stroke || null,
		location: candidate.relativePosition,
		nearestCorner: candidate.nearestCorner,
		cornerDistances: Object.fromEntries(Object.entries(candidate.cornerDistances)
			.map(([corner, distanceValue]) => [corner, Number(distanceValue.toFixed(4))])),
		areaRatio: Number(candidate.areaRatio.toFixed(4)),
		bounds: compactBounds(component),
	};
}

function formatSourceComponent(component, allBounds) {
	const item = sourceComponentCandidate(component);

	return {
		id: component.id || null,
		color: component.fill || component.stroke || null,
		location: allBounds ? relativePosition(item, allBounds) : null,
		nearestCorner: allBounds ? nearestCorner(item, allBounds) : null,
		bounds: compactBounds(component),
		area: Number(component.area.toFixed(3)),
	};
}

function sourceComponentCandidate(component) {
	return {
		sourceComponent: component,
		bounds: component.bounds,
		center: component.center,
	};
}

function nearestCorner(candidate, bounds) {
	const center = candidate.center;
	const normalizedCenter = {
		x: (center.x - bounds.left) / Math.max(1, bounds.width),
		y: (center.y - bounds.top) / Math.max(1, bounds.height),
	};
	const distances = {
		topLeft: Math.hypot(normalizedCenter.x, normalizedCenter.y),
		topRight: Math.hypot(1 - normalizedCenter.x, normalizedCenter.y),
		bottomLeft: Math.hypot(normalizedCenter.x, 1 - normalizedCenter.y),
		bottomRight: Math.hypot(1 - normalizedCenter.x, 1 - normalizedCenter.y),
	};

	return Object.entries(distances).sort((left, right) => left[1] - right[1])[0][0];
}

function canvasFromViewBox(viewBox, fallbackBounds) {
	if (viewBox) {
		return {
			left: viewBox.minX,
			top: viewBox.minY,
			width: viewBox.width,
			height: viewBox.height,
		};
	}

	return fallbackBounds
		? {
			left: fallbackBounds.left,
			top: fallbackBounds.top,
			width: fallbackBounds.width,
			height: fallbackBounds.height,
		}
		: { left: 0, top: 0, width: 164, height: 238 };
}

function compactBounds(component) {
	return {
		left: component.bounds.left,
		top: component.bounds.top,
		right: component.bounds.right,
		bottom: component.bounds.bottom,
		width: component.bounds.width,
		height: component.bounds.height,
	};
}

function relativePosition(candidate, bounds) {
	const center = candidate.center;
	const x = (center.x - bounds.left) / Math.max(1, bounds.width);
	const y = (center.y - bounds.top) / Math.max(1, bounds.height);

	return [
		y < 0.36 ? 'top' : y > 0.68 ? 'bottom' : 'middle',
		x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'center',
	].join('-');
}

function cornerOrLocationDistance(candidate, cornerOrLocation) {
	if (!cornerOrLocation) {
		return Infinity;
	}

	const cornerMap = {
		'top-left': 'topLeft',
		'top-right': 'topRight',
		'bottom-left': 'bottomLeft',
		'bottom-right': 'bottomRight',
	};
	const corner = cornerMap[cornerOrLocation] || cornerOrLocation;
	return candidate.cornerDistances?.[corner] ?? Infinity;
}

function oppositeTopCorner(corner) {
	return corner === 'topRight' ? 'topLeft' : 'topRight';
}

function colorMismatch(candidate, expectedColor) {
	if (!expectedColor) {
		return 0;
	}

	const color = candidate.item.sourceComponent.fill || candidate.item.sourceComponent.stroke || '';
	return color.toLowerCase() === expectedColor.toLowerCase() ? 0 : 1;
}

function isFlowerOrSeason(faceKey) {
	return /^(flower|season)-[1-4]$/.test(faceKey);
}

function inferBasicFaceMetadata(faceKey) {
	const match = /^(?<suit>[bcd])-(?<rank>[1-9])$/.exec(faceKey);

	if (match) {
		const suitColors = {
			b: '#2FC906',
			c: match.groups.rank === '8' ? '#FC1D05' : '#2FC906',
			d: '#FC1D05',
		};

		return {
			labelText: match.groups.rank,
			labelColor: suitColors[match.groups.suit],
		};
	}

	const wind = /^wind-(?<letter>[ensw])$/.exec(faceKey);

	if (wind) {
		return {
			labelText: wind.groups.letter.toUpperCase(),
			labelColor: '#FC1D05',
			sourceContainsLabel: false,
		};
	}

	const special = /^(flower|season)-(?<rank>[1-4])$/.exec(faceKey);

	if (special) {
		return {
			labelText: special.groups.rank,
			labelColor: '#FC1D05',
		};
	}

	return {};
}

