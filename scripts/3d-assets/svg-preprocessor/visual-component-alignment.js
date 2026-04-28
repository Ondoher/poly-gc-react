export const PREPARED_FACE_VIEWBOX = Object.freeze({
	width: 94,
	height: 136,
});

export function targetPixelsToViewBoxBounds(targetBounds, referenceCanvas, viewBox = PREPARED_FACE_VIEWBOX) {
	const scaleX = viewBox.width / referenceCanvas.width;
	const scaleY = viewBox.height / referenceCanvas.height;

	return {
		left: targetBounds.left * scaleX,
		top: targetBounds.top * scaleY,
		right: targetBounds.right * scaleX,
		bottom: targetBounds.bottom * scaleY,
		width: (targetBounds.right - targetBounds.left) * scaleX,
		height: (targetBounds.bottom - targetBounds.top) * scaleY,
	};
}

export function boundsToTransform(sourceBounds, targetBounds) {
	return matrixToString(boundsToTransformMatrix(sourceBounds, targetBounds));
}

export function boundsToTransformMatrix(sourceBounds, targetBounds, options = {}) {
	const sourceWidth = sourceBounds.right - sourceBounds.left;
	const sourceHeight = sourceBounds.bottom - sourceBounds.top;
	const targetWidth = targetBounds.right - targetBounds.left;
	const targetHeight = targetBounds.bottom - targetBounds.top;

	if ([sourceWidth, sourceHeight, targetWidth, targetHeight].some((value) => !Number.isFinite(value) || value === 0)) {
		throw new Error('Cannot align component with invalid source or target bounds.');
	}

	const containedScale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
	const requestedScale = options.scale ?? containedScale;
	const scale = Math.min(requestedScale, containedScale);
	const sourceCenterX = sourceBounds.left + (sourceWidth / 2);
	const sourceCenterY = sourceBounds.top + (sourceHeight / 2);
	const targetCenterX = targetBounds.left + (targetWidth / 2);
	const targetCenterY = targetBounds.top + (targetHeight / 2);
	const translateX = targetCenterX - (sourceCenterX * scale);
	const translateY = targetCenterY - (sourceCenterY * scale);

	return {
		a: scale,
		b: 0,
		c: 0,
		d: scale,
		e: translateX,
		f: translateY,
	};
}

export function sourceToReferenceTransform(sourceBounds, targetPixelBounds, referenceCanvas, viewBox = PREPARED_FACE_VIEWBOX) {
	return boundsToTransform(
		sourceBounds,
		targetPixelsToViewBoxBounds(targetPixelBounds, referenceCanvas, viewBox),
	);
}

export function unionBounds(boundsList) {
	const validBounds = boundsList.filter(Boolean);

	if (validBounds.length === 0) {
		return null;
	}

	const left = Math.min(...validBounds.map((bounds) => bounds.left));
	const top = Math.min(...validBounds.map((bounds) => bounds.top));
	const right = Math.max(...validBounds.map((bounds) => bounds.right));
	const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

export function matrixToString(matrix) {
	return `matrix(${formatNumber(matrix.a)} ${formatNumber(matrix.b)} ${formatNumber(matrix.c)} ${formatNumber(matrix.d)} ${formatNumber(matrix.e)} ${formatNumber(matrix.f)})`;
}

function formatNumber(value) {
	return Number(value.toFixed(6)).toString();
}

