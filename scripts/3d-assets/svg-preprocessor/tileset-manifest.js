import { promises as fsPromises } from 'fs';
import fs from 'fs';
import path from 'path';
import { BASE_OUTPUT } from './PipelineModel.js';

export const TILESET_MANIFEST_PATH = path.resolve(BASE_OUTPUT, 'tilesets.json');

export function emptyTilesetManifest() {
	return {
		schemaVersion: 1,
		activeTilesetId: null,
		tilesets: [],
		updatedOn: null,
	};
}

export async function readTilesetManifest() {
	try {
		return normalizeTilesetManifest(JSON.parse(await fsPromises.readFile(TILESET_MANIFEST_PATH, 'utf8')));
	} catch (error) {
		if (error.code === 'ENOENT') {
			return emptyTilesetManifest();
		}
		throw error;
	}
}

export async function writeTilesetManifest(manifest) {
	await fsPromises.mkdir(path.dirname(TILESET_MANIFEST_PATH), { recursive: true });
	await fsPromises.writeFile(TILESET_MANIFEST_PATH, `${JSON.stringify(normalizeTilesetManifest(manifest), null, 2)}\n`, 'utf8');
}

export async function setActiveTileset(tilesetId, now = new Date().toISOString()) {
	const manifest = await readTilesetManifest();

	if (!manifest.tilesets.some((tileset) => tileset.tilesetId === tilesetId)) {
		throw new Error(`Unknown tileset in manifest: ${tilesetId}`);
	}

	manifest.activeTilesetId = tilesetId;
	manifest.updatedOn = now;
	await writeTilesetManifest(manifest);

	return manifest;
}

export function updateTilesetManifestSync({
	tilesetId,
	generatedOn = new Date().toISOString(),
}) {
	const manifest = readTilesetManifestSync();
	const nextEntry = {
		tilesetId,
	};
	const entries = new Map(manifest.tilesets.map((entry) => [entry.tilesetId, entry]));
	entries.set(tilesetId, nextEntry);
	const nextManifest = normalizeTilesetManifest({
		...manifest,
		activeTilesetId: manifest.activeTilesetId || tilesetId,
		tilesets: [...entries.values()],
		updatedOn: generatedOn,
	});

	fs.mkdirSync(path.dirname(TILESET_MANIFEST_PATH), { recursive: true });
	fs.writeFileSync(TILESET_MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

	return nextManifest;
}

function readTilesetManifestSync() {
	if (!fs.existsSync(TILESET_MANIFEST_PATH)) {
		return emptyTilesetManifest();
	}

	return normalizeTilesetManifest(JSON.parse(fs.readFileSync(TILESET_MANIFEST_PATH, 'utf8')));
}

function normalizeTilesetManifest(manifest) {
	const tilesets = Array.isArray(manifest?.tilesets)
		? manifest.tilesets
			.filter((tileset) => tileset?.tilesetId)
			.map((tileset) => ({
				tilesetId: String(tileset.tilesetId),
			}))
			.sort((left, right) => left.tilesetId.localeCompare(right.tilesetId))
		: [];
	const activeTilesetId = tilesets.some((tileset) => tileset.tilesetId === manifest?.activeTilesetId)
		? manifest.activeTilesetId
		: tilesets[0]?.tilesetId || null;

	return {
		schemaVersion: 1,
		activeTilesetId,
		tilesets,
		updatedOn: manifest?.updatedOn || null,
	};
}
