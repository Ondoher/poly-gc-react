import fs from 'fs';
import path from 'path';

export const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
export const ROOT_DIR = path.resolve(SCRIPT_DIR, '..', '..', '..');
export const SCRIPT_DATA_DIR = path.resolve(ROOT_DIR, 'scripts', 'data');
export const OUTPUT_3D_DIR = path.resolve(ROOT_DIR, 'scripts', 'output', '3d-assets');
export const ASSETS_3D_DIR = path.resolve(SCRIPT_DATA_DIR, '3d-assets');
export const OUTPUT_3D_ASSETS_DIR = OUTPUT_3D_DIR;
export const ASSETS_3D_JSON_DIR = path.resolve(ASSETS_3D_DIR, 'json');
export const REFERENCE_FACES_DIR = path.resolve(ASSETS_3D_DIR, 'reference-faces');
export const LARGE_FACES_DIR = path.resolve(REFERENCE_FACES_DIR, 'large-faces');
export const FACE_REFERENCES_DIR = path.resolve(REFERENCE_FACES_DIR, 'faces');
export const BODY_REFERENCES_DIR = path.resolve(REFERENCE_FACES_DIR, 'bodies');
export const WIKI_SOURCE_SVGS_DIR = path.resolve(ASSETS_3D_DIR, 'wiki-source-svgs');
export const OTHER_SOURCE_SVGS_DIR = path.resolve(ASSETS_3D_DIR, 'other-source-svgs');
export const SPRITE_SHEETS_DIR = path.resolve(ASSETS_3D_DIR, 'sprite-sheets');
export const SPRITE_SOURCE_SVGS_DIR = path.resolve(ASSETS_3D_DIR, 'sprite-source-svgs');
export const PREPARED_SVGS_DIR = path.resolve(OUTPUT_3D_ASSETS_DIR, 'prepared-svgs');
export const ASSET_FONTS_DIR = path.resolve(ASSETS_3D_DIR, 'fonts');
export const ASSETS_3D_MODELS_DIR = path.resolve(ASSETS_3D_DIR, 'models');
export const BASE_TILE_MODELS_DIR = path.resolve(ASSETS_3D_MODELS_DIR, 'base-tiles');
export const GENERATED_IMAGES_DIR = path.resolve(ASSETS_3D_DIR, 'generated-images');
export const GENERATED_FACE_IMAGES_DIR = path.resolve(GENERATED_IMAGES_DIR, 'faces');
export const GENERATED_TOP_MAPS_DIR = path.resolve(GENERATED_IMAGES_DIR, 'top-maps');
export const OUTPUT_MODELS_DIR = path.resolve(OUTPUT_3D_DIR, 'models');
export const OUTPUT_VALIDATION_DIR = path.resolve(OUTPUT_3D_DIR, 'preprocessed', 'validation');
export const OUTPUT_OVERLAYS_DIR = path.resolve(OUTPUT_3D_DIR, 'overlays');

export function generatedFaceImagePath(faceKey, filename) {
	return path.resolve(GENERATED_FACE_IMAGES_DIR, faceKey, filename);
}

export function sourceSvgPath(faceKey) {
	if (process.env.FACE_SOURCE_SVGS_DIR) {
		return path.resolve(process.cwd(), process.env.FACE_SOURCE_SVGS_DIR, `${faceKey}.svg`);
	}

	const sourceId = sanitizeOutputScope(
		process.env.PIPELINE_TILESET_ID
		|| process.env.FACE_OUTPUT_SCOPE
		|| process.env.PIPELINE_TILESET_SOURCE
		|| '',
	);
	const scopedSpriteSourceSvg = sourceId
		? path.resolve(SPRITE_SOURCE_SVGS_DIR, sourceId, `${faceKey}.svg`)
		: null;

	if (exists(scopedSpriteSourceSvg)) {
		return scopedSpriteSourceSvg;
	}

	const wikiSourceSvg = path.resolve(WIKI_SOURCE_SVGS_DIR, `${faceKey}.svg`);
	const otherSourceSvg = path.resolve(OTHER_SOURCE_SVGS_DIR, `${faceKey}.svg`);
	const spriteSourceSvg = path.resolve(SPRITE_SOURCE_SVGS_DIR, 'default', `${faceKey}.svg`);

	if (exists(wikiSourceSvg)) {
		return wikiSourceSvg;
	}

	if (exists(otherSourceSvg)) {
		return otherSourceSvg;
	}

	return spriteSourceSvg;
}

export function preparedSvgPath(faceKey, outputScope = preprocessingOutputScope()) {
	return outputScope
		? path.resolve(PREPARED_SVGS_DIR, outputScope, `${faceKey}.svg`)
		: path.resolve(PREPARED_SVGS_DIR, `${faceKey}.svg`);
}

export function validationArtifactPath(type, filename, outputScope = preprocessingOutputScope()) {
	return outputScope
		? path.resolve(OUTPUT_VALIDATION_DIR, outputScope, type, filename)
		: path.resolve(OUTPUT_VALIDATION_DIR, type, filename);
}

export function preprocessingOutputScope() {
	return sanitizeOutputScope(process.env.FACE_OUTPUT_SCOPE || process.env.PIPELINE_TILESET_ID || '');
}

export function sanitizeOutputScope(value) {
	const normalized = String(value || '')
		.trim()
		.toLowerCase()
		.replace(/\\/g, '/')
		.split('/')
		.filter(Boolean)
		.at(-1)
		?.replace(/-source-svgs$/, '')
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return normalized || null;
}

function exists(filename) {
	return Boolean(filename) && fs.existsSync(filename);
}
