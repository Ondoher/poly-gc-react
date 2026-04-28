import fs from 'fs';
import path from 'path';
import paper from 'paper';
import {
	ASSET_FONTS_DIR,
	ASSETS_3D_JSON_DIR,
	LARGE_FACES_DIR,
	OUTPUT_3D_DIR,
} from '../shared/asset-paths.js';
import { findSmallIsolatedCandidates, getComponentUnionBounds } from './normalized-face-components.js';
import { extractReferenceImageComponents } from './reference-image-components.js';

const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const FACE_METADATA_PATH = path.resolve(ASSETS_3D_JSON_DIR, 'face-preprocessing-metadata.json');
const OUTPUT_DIR = path.resolve(OUTPUT_3D_DIR, 'metadata-inference');
const OUTPUT_PATH = path.resolve(OUTPUT_DIR, 'reference-glyphs.json');
const existingMetadata = JSON.parse(fs.readFileSync(FACE_METADATA_PATH, 'utf8'));

paper.setup([512, 512]);

const files = fs.readdirSync(LARGE_FACES_DIR)
	.filter((file) => file.toLowerCase().endsWith('.png'))
	.sort((left, right) => left.localeCompare(right));
const metadata = {
	description: 'Metadata inferred from canonical large-face reference PNGs.',
	generatedAt: new Date().toISOString(),
	referenceGlyphs: {},
};

for (const file of files) {
	const fileFaceKey = path.basename(file, '.png');
	const faceKey = canonicalFaceKey(fileFaceKey);
	const referencePath = path.resolve(LARGE_FACES_DIR, file);
	const faceInfo = existingMetadata[faceKey] || existingMetadata[fileFaceKey] || inferBasicFaceMetadata(faceKey);
	const reference = await extractReferenceImageComponents(referencePath, {
		labelColor: faceInfo.labelColor,
		labelText: faceInfo.labelText,
		fontPath: GLUTEN_FONT,
	});
	const allBounds = referenceBounds(reference.components);
	const glyphCandidates = findReferenceGlyphCandidates(reference, allBounds);
	const labelCandidate = findReferenceLabelCandidate(reference, faceInfo, glyphCandidates);
	const entry = {
		sourceFile: path.relative(process.cwd(), referencePath).replaceAll('\\', '/'),
		referenceComponents: reference.components.map((component) => formatReferenceComponent(component, allBounds)),
		glyphCandidates: glyphCandidates.map((candidate) => formatCandidate(candidate, allBounds)),
	};

	if (faceInfo.labelText && labelCandidate) {
		entry.number = {
			present: true,
			text: faceInfo.labelText,
			color: labelCandidate.component.dominantColor || faceInfo.labelColor,
			location: relativePosition(referenceComponentCandidate(labelCandidate.component), allBounds),
			corner: nearestCorner(referenceComponentCandidate(labelCandidate.component), allBounds),
			bounds: compactBounds(labelCandidate.component),
			inference: labelCandidate.inference,
		};
	}

	if (isFlowerOrSeason(faceKey)) {
		const character = findReferenceCharacterCandidate(reference);
		const characterCandidate = character ? referenceComponentCandidate(character) : null;

		entry.character = character
			? {
				present: true,
				color: character.dominantColor || '',
				location: relativePosition(characterCandidate, allBounds),
				corner: nearestCorner(characterCandidate, allBounds),
				bounds: compactBounds(character),
			}
			: { present: false };
	}

	if (faceInfo.labelText || entry.character || existingMetadata[faceKey] || existingMetadata[fileFaceKey]) {
		metadata.referenceGlyphs[faceKey] = entry;
	}
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);

function findReferenceCharacterCandidate(reference) {
	const labelCorner = reference.labelComponent
		? nearestCorner(referenceComponentCandidate(reference.labelComponent), referenceBounds(reference.components))
		: null;
	const items = reference.artworkComponents.map(referenceComponentCandidate);
	const outerBounds = getComponentUnionBounds(reference.components.map((component) => referenceComponentCandidate(component)));
	const candidates = findSmallIsolatedCandidates(items, outerBounds, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.24,
		minWidth: 10,
		minHeight: 10,
	})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.34)
		.filter((candidate) => !labelCorner || candidate.nearestCorner !== labelCorner)
		.sort((left, right) => cornerDistance(left, oppositeTopCorner(labelCorner)) - cornerDistance(right, oppositeTopCorner(labelCorner))
			|| right.area - left.area);

	return candidates[0]?.item.sourceComponent || null;
}

function findReferenceLabelCandidate(reference, metadata, glyphCandidates) {
	if (reference.labelComponent) {
		return {
			component: reference.labelComponent,
			inference: 'glyph-or-color-match',
		};
	}

	if (!metadata.labelText) {
		return null;
	}

	const expectedCorner = metadata.glyphLayout?.number?.referenceCorner || defaultReferenceNumberCorner(metadata.labelText);
	const candidates = glyphCandidates
		.filter((candidate) => candidate.areaRatio <= 0.16);
	const sortedCandidates = candidates.sort((left, right) => {
			const leftCorner = expectedCorner ? cornerDistance(left, expectedCorner) : Infinity;
			const rightCorner = expectedCorner ? cornerDistance(right, expectedCorner) : Infinity;
			const leftColorMismatch = colorMismatch(left, metadata.labelColor);
			const rightColorMismatch = colorMismatch(right, metadata.labelColor);

			return leftCorner - rightCorner
				|| leftColorMismatch - rightColorMismatch
				|| left.normalizedCenter.y - right.normalizedCenter.y
				|| left.area - right.area;
		});

	return sortedCandidates[0]
		? {
			component: sortedCandidates[0].item.sourceComponent,
			inference: 'top-isolated-candidate',
		}
		: null;
}

function findReferenceGlyphCandidates(reference, allBounds) {
	const items = reference.components.map(referenceComponentCandidate);

	return findSmallIsolatedCandidates(items, allBounds, {
		topBandRatio: 0.45,
		maxAreaRatio: 0.16,
		minWidth: 6,
		minHeight: 8,
	}).slice(0, 12);
}

function formatCandidate(candidate, allBounds) {
	const component = candidate.item.sourceComponent;

	return {
		color: component.dominantColor,
		location: relativePosition(candidate.item, allBounds),
		nearestCorner: candidate.nearestCorner,
		cornerDistances: Object.fromEntries(Object.entries(candidate.cornerDistances)
			.map(([corner, distanceValue]) => [corner, Number(distanceValue.toFixed(4))])),
		areaRatio: Number(candidate.areaRatio.toFixed(4)),
		bounds: compactBounds(component),
	};
}

function formatReferenceComponent(component, allBounds) {
	const item = referenceComponentCandidate(component);

	return {
		id: component.id || null,
		color: component.dominantColor || null,
		location: allBounds ? relativePosition(item, allBounds) : null,
		nearestCorner: allBounds ? nearestCorner(item, allBounds) : null,
		bounds: compactBounds(component),
		area: Number((component.area || component.width * component.height).toFixed(3)),
	};
}

function referenceComponentCandidate(component) {
	const bounds = {
		left: component.left,
		top: component.top,
		right: component.right,
		bottom: component.bottom,
		width: component.width,
		height: component.height,
	};

	return {
		sourceComponent: component,
		bounds,
		center: component.center || {
			x: component.left + (component.width / 2),
			y: component.top + (component.height / 2),
		},
	};
}

function referenceBounds(components) {
	return getComponentUnionBounds(components.map((component) => referenceComponentCandidate(component)));
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

function relativePosition(candidate, bounds) {
	const center = candidate.center;
	const x = (center.x - bounds.left) / Math.max(1, bounds.width);
	const y = (center.y - bounds.top) / Math.max(1, bounds.height);

	return [
		y < 0.36 ? 'top' : y > 0.68 ? 'bottom' : 'middle',
		x < 0.36 ? 'left' : x > 0.64 ? 'right' : 'center',
	].join('-');
}

function cornerDistance(candidate, corner) {
	return candidate.cornerDistances?.[corner] ?? Infinity;
}

function oppositeTopCorner(corner) {
	return corner === 'topRight' ? 'topLeft' : 'topRight';
}

function compactBounds(component) {
	return {
		left: component.left,
		top: component.top,
		right: component.right,
		bottom: component.bottom,
		width: component.width,
		height: component.height,
	};
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

function defaultReferenceNumberCorner(labelText) {
	return /^[NSWE]$/i.test(labelText) ? 'topLeft' : 'topLeft';
}

function colorMismatch(candidate, expectedColor) {
	if (!expectedColor) {
		return 0;
	}

	return candidate.item.sourceComponent.dominantColor?.toLowerCase() === expectedColor.toLowerCase()
		? 0
		: 1;
}

function canonicalFaceKey(faceKey) {
	const bambooTypo = /^b(?<rank>[1-9])$/.exec(faceKey);
	return bambooTypo ? `b-${bambooTypo.groups.rank}` : faceKey;
}

function isFlowerOrSeason(faceKey) {
	return /^(flower|season)-[1-4]$/.test(faceKey);
}

