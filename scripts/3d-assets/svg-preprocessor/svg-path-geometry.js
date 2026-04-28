import paper from 'paper';
import { parseTransform } from './source-svg-components.js';

export function transformPathData(pathData, transform) {
	const matrix = typeof transform === 'string'
		? parseTransform(transform)
		: transform;
	const item = new paper.CompoundPath(pathData);
	item.transform(new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f));
	const result = item.pathData;
	item.remove();
	return result;
}

export function makeCompoundPathData(pathDataList) {
	return pathDataList
		.map((pathData) => pathData.trim())
		.filter(Boolean)
		.join(' ');
}

