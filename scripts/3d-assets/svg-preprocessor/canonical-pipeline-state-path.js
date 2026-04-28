import path from 'path';
import { BASE_OUTPUT } from './PipelineModel.js';

/**
 * Returns the canonical tileset state path for a source tileset.
 *
 * @param {string} tilesetId - Source tileset id.
 * @returns {string} Absolute canonical tileset JSON path.
 */
export function canonicalPipelineStatePath(tilesetId) {
	return path.resolve(BASE_OUTPUT, tilesetId, 'pipeline.json');
}
