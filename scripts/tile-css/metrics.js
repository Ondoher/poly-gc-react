import { GRID_DEPTH, GRID_WIDTH, GRID_HEIGHT } from "./table-size.js";

export function normalizeSizeName(sizeName) {
	if (typeof sizeName !== "string") {
		return "";
	}

	return sizeName.replace(/-size$/, "");
}

export function getSizeDefinition(sizes, sizeName) {
	let normalizedSize = normalizeSizeName(sizeName);

	return sizes[sizeName] || sizes[normalizedSize] || sizes.normal;
}

export function getFaceDimensions(sizeConfig) {
	return {
		faceWidth: sizeConfig.width - sizeConfig.rpad,
		faceHeight: sizeConfig.height - sizeConfig.bpad,
	};
}

export function getCellDimensions(sizeConfig) {
	let { faceWidth, faceHeight } = getFaceDimensions(sizeConfig);

	return {
		cellWidth: faceWidth / 2,
		cellHeight: faceHeight / 2,
	};
}

export function getDepthOffsets(sizeConfig) {
	return {
		depthX: sizeConfig.xdepth,
		depthY: sizeConfig.ydepth,
	};
}

export function buildMetrics(sizeConfig) {
	return {
		width: sizeConfig.width,
		height: sizeConfig.height,
		rightPad: sizeConfig.rpad,
		bottomPad: sizeConfig.bpad,
		...getFaceDimensions(sizeConfig),
		...getCellDimensions(sizeConfig),
		...getDepthOffsets(sizeConfig),
	};
}

export function gridToCssPosition(x, y, z, metrics) {
	let depthIndex = GRID_DEPTH - 1 - z;
	let left = x * metrics.cellWidth + (metrics.depthX * depthIndex);
	let top = y * metrics.cellHeight + (metrics.depthY * depthIndex);
	let zindex = (y + x) + ((z + 1) * GRID_WIDTH * GRID_HEIGHT);

	return { left, top, zindex };
}

export function getCanvasDimensions(metrics) {
	let maxLeft = gridToCssPosition(GRID_WIDTH - 1, 0, 0, metrics).left;
	let maxTop = gridToCssPosition(0, GRID_HEIGHT - 1, 0, metrics).top;

	return {
		canvasWidth: maxLeft + metrics.width,
		canvasHeight: maxTop + metrics.height,
	};
}

export function buildLayoutMetricSet(sizeConfig) {
	let metrics = buildMetrics(sizeConfig);

	return {
		tileWidth: metrics.width,
		tileHeight: metrics.height,
		faceWidth: metrics.faceWidth,
		faceHeight: metrics.faceHeight,
		rightPad: metrics.rightPad,
		bottomPad: metrics.bottomPad,
		cellWidth: metrics.cellWidth,
		cellHeight: metrics.cellHeight,
		depthX: metrics.depthX,
		depthY: metrics.depthY,
		...getCanvasDimensions(metrics),
	};
}
