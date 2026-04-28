import path from 'node:path';
import { BASE_OUTPUT } from './PipelineModel.js';

export function tilesetOutputRoot(tilesetId) {
	return path.resolve(BASE_OUTPUT, tilesetId);
}

export function tilesetJsonRoot(tilesetId) {
	return path.resolve(tilesetOutputRoot(tilesetId), 'json');
}

export function tilesetImagesRoot(tilesetId) {
	return path.resolve(tilesetOutputRoot(tilesetId), 'images');
}

export function tilesetJsonDir(tilesetId, artifactType) {
	return path.resolve(tilesetJsonRoot(tilesetId), artifactType);
}

export function tilesetImageDir(tilesetId, imageType) {
	return path.resolve(tilesetImagesRoot(tilesetId), imageType);
}
