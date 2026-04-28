import fs from 'fs';
import path from 'path';
import { ASSETS_3D_JSON_DIR, OUTPUT_3D_DIR } from '../shared/asset-paths.js';

const BASE_METADATA_PATH = path.resolve(ASSETS_3D_JSON_DIR, 'face-preprocessing-metadata.json');
const DEFAULT_REFERENCE_METADATA_PATH = path.resolve(
	OUTPUT_3D_DIR,
	'metadata-inference',
	'reference-glyphs.json',
);

export function loadFacePreprocessingMetadata(metadataPath = process.env.FACE_PREPROCESSING_METADATA) {
	const base = JSON.parse(fs.readFileSync(BASE_METADATA_PATH, 'utf8'));

	if (!metadataPath) {
		return base;
	}

	const resolvedPath = path.resolve(process.cwd(), metadataPath);
	if (!fs.existsSync(resolvedPath)) {
		throw new Error(`Face preprocessing metadata override not found: ${path.relative(process.cwd(), resolvedPath)}`);
	}

	const override = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
	return mergeMetadata(base, override);
}

export function loadFacePreprocessingMetadataEntry(faceKey, metadataPath = process.env.FACE_PREPROCESSING_METADATA) {
	return loadFacePreprocessingMetadata(metadataPath)[faceKey] || null;
}

function mergeMetadata(base, override) {
	const merged = structuredClone(base);

	if (override.tilesetGlyphs && fs.existsSync(DEFAULT_REFERENCE_METADATA_PATH)) {
		const referenceOverride = JSON.parse(fs.readFileSync(DEFAULT_REFERENCE_METADATA_PATH, 'utf8'));
		mergeMetadataEntries(merged, referenceOverride.referenceGlyphs || {}, 'reference');
	}

	if (override.referenceGlyphs) {
		mergeMetadataEntries(merged, override.referenceGlyphs, 'reference');
	} else if (override.tilesetGlyphs) {
		mergeMetadataEntries(merged, override.tilesetGlyphs, 'tileset');
	} else {
		mergeMetadataEntries(merged, override, 'reference');
	}

	return merged;
}

function mergeMetadataEntries(merged, entries, kind) {
	for (const [faceKey, reviewEntry] of Object.entries(entries)) {
		if (!reviewEntry || typeof reviewEntry !== 'object') {
			continue;
		}

		merged[faceKey] = {
			...(merged[faceKey] || {}),
			...(kind === 'tileset'
				? metadataFromTilesetEntry(reviewEntry)
				: metadataFromReferenceEntry(reviewEntry)),
		};
		if (reviewEntry.exporter) {
			merged[faceKey].exporter = normalizeExporter(reviewEntry.exporter);
		} else if (merged[faceKey].exporter === 'special') {
			merged[faceKey].exporter = 'generic-special';
		}
	}
}

function normalizeExporter(exporter) {
	return exporter === 'special' ? 'generic-special' : exporter;
}

function metadataFromReferenceEntry(entry) {
	const metadata = {};

	if (entry.number?.text) {
		metadata.labelText = entry.number.text;
	}

	if (entry.number?.color) {
		metadata.labelColor = entry.number.color;
	}

	if (entry.sourceContainsLabel != null) {
		metadata.sourceContainsLabel = Boolean(entry.sourceContainsLabel);
	}
	const sourceNumberPresent = entry.number?.sourcePresent ?? (
		entry.sourceContainsLabel != null ? Boolean(entry.sourceContainsLabel) : null
	);

	if (entry.number || entry.character) {
		metadata.referenceGlyphs = {
			...(entry.number
				? {
					number: {
						present: Boolean(entry.number.present),
						location: entry.number.location || null,
						color: entry.number.color || null,
						bounds: entry.number.bounds || null,
					},
				}
				: {}),
			...(entry.character
				? {
					character: {
						present: Boolean(entry.character.present),
						location: entry.character.location || null,
						color: entry.character.color || null,
						bounds: entry.character.bounds || null,
					},
				}
				: {}),
		};
	}

	if (entry.number || entry.character) {
		const glyphOutputColors = {
			...(outputColor(entry.number) ? { number: outputColor(entry.number) } : {}),
			...(outputColor(entry.character) ? { character: outputColor(entry.character) } : {}),
		};

		if (Object.keys(glyphOutputColors).length > 0) {
			metadata.glyphOutputColors = glyphOutputColors;
		}

		metadata.glyphLayout = {
			...(metadata.glyphLayout || {}),
			...(entry.number
				? {
					number: {
						...(entry.number.location
							? { referenceCorner: locationToCorner(entry.number.location) }
							: {}),
						...(entry.number.outputPresent != null
							? { outputPresent: Boolean(entry.number.outputPresent) }
							: {}),
						...(sourceNumberPresent != null
							? {
								sourcePresent: Boolean(sourceNumberPresent),
								...(sourceNumberPresent && entry.number.location
									? { sourceCorner: locationToCorner(entry.number.location) }
									: {}),
							}
							: {}),
					},
				}
				: {}),
			...(entry.character
				? {
					character: {
						...(entry.character.location
							? { referenceCorner: locationToCorner(entry.character.location) }
							: {}),
						...(entry.character.outputPresent != null
							? { outputPresent: Boolean(entry.character.outputPresent) }
							: {}),
					},
				}
				: {}),
		};
	}

	return metadata;
}

function metadataFromTilesetEntry(entry) {
	const metadata = {};
	const sourceHasNumber = entry.number?.sourcePresent ?? entry.number?.present === true;
	const sourceHasCharacter = entry.character?.sourcePresent ?? entry.character?.present === true;

	if (entry.sourceComponentColors) {
		metadata.sourceComponentColors = entry.sourceComponentColors;
	}

	const sourceBackgroundColors = normalizeColorList(
		entry.sourceBackgroundColors
			|| entry.sourceTileBackgroundColors
			|| entry.tileBackgroundColors
			|| entry.sourceBackgroundColor
			|| entry.sourceTileBackgroundColor
			|| entry.tileBackgroundColor,
	);

	if (sourceBackgroundColors.length > 0) {
		metadata.sourceBackgroundColors = sourceBackgroundColors;
	}

	if (entry.recolorComponents != null) {
		metadata.recolorComponents = Boolean(entry.recolorComponents);
	}

	if (entry.groupByColor != null) {
		metadata.groupByColor = Boolean(entry.groupByColor);
	}

	if (Array.isArray(entry.gapCandidates)) {
		metadata.gapCandidates = entry.gapCandidates
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value));
	}

	if (entry.number) {
		metadata.sourceContainsLabel = sourceHasNumber;
	} else if (entry.sourceContainsLabel != null) {
		metadata.sourceContainsLabel = Boolean(entry.sourceContainsLabel);
	}

	if (entry.number || entry.character) {
		const glyphOutputColors = {
			...(outputColor(entry.number) ? { number: outputColor(entry.number) } : {}),
			...(outputColor(entry.character) ? { character: outputColor(entry.character) } : {}),
		};

		if (Object.keys(glyphOutputColors).length > 0) {
			metadata.glyphOutputColors = glyphOutputColors;
		}

		metadata.glyphLayout = {
			...(metadata.glyphLayout || {}),
			...(entry.number
				? {
					number: {
						sourcePresent: sourceHasNumber,
						...(entry.number.outputPresent != null
							? { outputPresent: Boolean(entry.number.outputPresent) }
							: {}),
						...(sourceHasNumber
							? {
								sourceCorner: locationToCorner(entry.number.location),
								sourceBounds: entry.number.bounds || null,
							}
							: {}),
					},
				}
				: {}),
			...(entry.character
				? {
					character: {
						sourcePresent: sourceHasCharacter,
						...(entry.character.outputPresent != null
							? { outputPresent: Boolean(entry.character.outputPresent) }
							: {}),
						...(sourceHasCharacter
							? {
								sourceCorner: locationToCorner(entry.character.location),
								sourceBounds: entry.character.bounds || null,
							}
							: {}),
					},
				}
				: {}),
		};
	}

	return metadata;
}

function locationToCorner(location) {
	const map = {
		'top-left': 'topLeft',
		'top-right': 'topRight',
		'bottom-left': 'bottomLeft',
		'bottom-right': 'bottomRight',
	};

	return map[location] || null;
}

function outputColor(entrySection) {
	return typeof entrySection?.outputColor === 'string'
		? entrySection.outputColor.trim()
		: null;
}

function normalizeColorList(value) {
	if (!value) {
		return [];
	}

	return (Array.isArray(value) ? value : [value])
		.map((color) => typeof color === 'string' ? color.trim().toLowerCase() : null)
		.filter(Boolean);
}

