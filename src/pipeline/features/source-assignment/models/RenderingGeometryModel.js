export default class RenderingGeometryModel {
	static canvasFromSourceViewBox(viewBox, fallbackBounds = null, defaultSize = { width: 94, height: 136 }) {
		const bounds = fallbackBounds || {};
		const left = viewBox?.minX ?? viewBox?.left ?? bounds.left ?? 0;
		const top = viewBox?.minY ?? viewBox?.top ?? bounds.top ?? 0;

		return {
			left,
			top,
			width: viewBox?.width ?? bounds.width ?? Math.max(1, (viewBox?.right ?? defaultSize.width) - left),
			height: viewBox?.height ?? bounds.height ?? Math.max(1, (viewBox?.bottom ?? defaultSize.height) - top),
		};
	}

	static canvasFromFace(face) {
		const viewBox = face.viewBox || {};
		const bounds = face.sourceBounds || face.alignmentBounds || {};

		return {
			left: viewBox.left ?? viewBox.minX ?? bounds.left ?? 0,
			top: viewBox.top ?? viewBox.minY ?? bounds.top ?? 0,
			width: viewBox.width || bounds.width || 164,
			height: viewBox.height || bounds.height || 238,
		};
	}

	static unionBounds(boundsList) {
		const usable = boundsList.filter(Boolean);

		if (usable.length === 0) {
			return null;
		}

		const left = Math.min(...usable.map((bounds) => bounds.left));
		const top = Math.min(...usable.map((bounds) => bounds.top));
		const right = Math.max(...usable.map((bounds) => bounds.right));
		const bottom = Math.max(...usable.map((bounds) => bounds.bottom));

		return {
			left,
			top,
			right,
			bottom,
			width: right - left,
			height: bottom - top,
		};
	}

	static boundsOverlap(left, right) {
		return Boolean(left && right)
			&& left.right >= right.left
			&& left.left <= right.right
			&& left.bottom >= right.top
			&& left.top <= right.bottom;
	}

	static boundsArea(bounds) {
		return bounds?.area || ((bounds?.width || 0) * (bounds?.height || 0));
	}

	static boundsToTransformString(sourceBounds, targetBounds) {
		const scale = Math.min(
			targetBounds.width / Math.max(0.001, sourceBounds.width),
			targetBounds.height / Math.max(0.001, sourceBounds.height),
		);
		const sourceCenterX = sourceBounds.left + (sourceBounds.width / 2);
		const sourceCenterY = sourceBounds.top + (sourceBounds.height / 2);
		const targetCenterX = targetBounds.left + (targetBounds.width / 2);
		const targetCenterY = targetBounds.top + (targetBounds.height / 2);
		const translateX = targetCenterX - (sourceCenterX * scale);
		const translateY = targetCenterY - (sourceCenterY * scale);

		return `matrix(${[
			RenderingGeometryModel.roundTransformNumber(scale),
			0,
			0,
			RenderingGeometryModel.roundTransformNumber(scale),
			RenderingGeometryModel.roundTransformNumber(translateX),
			RenderingGeometryModel.roundTransformNumber(translateY),
		].join(" ")})`;
	}

	static roundTransformNumber(value) {
		return Math.round(value * 1000000) / 1000000;
	}

	static alignedComponentTransform(alignmentTransform, component) {
		return [
			alignmentTransform || "",
			RenderingGeometryModel.componentTransformString(component),
		].filter(Boolean).join(" ");
	}

	static componentTransformString(component) {
		const transform = component.transform;

		if (!transform || RenderingGeometryModel.identityTransform(transform)) {
			return "";
		}

		return `matrix(${[
			transform.a ?? 1,
			transform.b ?? 0,
			transform.c ?? 0,
			transform.d ?? 1,
			transform.e ?? 0,
			transform.f ?? 0,
		].join(" ")})`;
	}

	static identityTransform(transform) {
		return RenderingGeometryModel.nearlyEqual(transform.a ?? 1, 1)
			&& RenderingGeometryModel.nearlyEqual(transform.b ?? 0, 0)
			&& RenderingGeometryModel.nearlyEqual(transform.c ?? 0, 0)
			&& RenderingGeometryModel.nearlyEqual(transform.d ?? 1, 1)
			&& RenderingGeometryModel.nearlyEqual(transform.e ?? 0, 0)
			&& RenderingGeometryModel.nearlyEqual(transform.f ?? 0, 0);
	}

	static nearlyEqual(left, right) {
		return Math.abs(left - right) < 0.000001;
	}

	static componentPaintOrder(component) {
		return component.sourceIndex
			?? component.sourceElementIndex
			?? Number.MAX_SAFE_INTEGER;
	}

	static sortComponentsForPaintOrder(components) {
		return [...components].sort((left, right) => (
			RenderingGeometryModel.componentPaintOrder(left) - RenderingGeometryModel.componentPaintOrder(right)
		));
	}
}
