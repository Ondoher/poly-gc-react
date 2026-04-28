import paper from 'paper';
import { composeMatrices, parseTransform } from './source-svg-components.js';
import { transformPathData } from './svg-path-geometry.js';

const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

export function getPaintComponents(components, classNames) {
	const classSet = new Set(classNames);
	return components.filter((component) => classSet.has(component.className));
}

export function makePaintPathWithKnockouts({
	component,
	color,
	knockouts = [],
	transform = IDENTITY,
	attributes = {},
}) {
	const knockoutPathData = pruneNestedKnockouts(knockouts)
		.map((knockout) => transformComponentPath(knockout, transform));
	const hasKnockouts = knockoutPathData.length > 0;
	const pathData = hasKnockouts
		? transformComponentPath(component, transform)
		: component.pathData;
	const bakedPathData = hasKnockouts
		? subtractKnockouts(pathData, knockoutPathData)
		: pathData;
	const transformAttribute = hasKnockouts
		? ''
		: makeTransformAttribute(composeMatrices(normalizeMatrix(transform), component.transform || IDENTITY));
	const knockoutAttributes = knockoutPathData.length > 0
		? ` data-negative-space="paper-subtract" data-knockout-count="${knockoutPathData.length}"`
		: '';
	const customAttributes = Object.entries(attributes)
		.map(([name, value]) => value == null ? '' : ` ${name}="${escapeAttribute(String(value))}"`)
		.join('');
	const paintAttributes = makePaintAttributes(component, color);

	return `<path${paintAttributes}${transformAttribute}${knockoutAttributes}${customAttributes} data-source-id="${escapeAttribute(component.id || '')}" data-source-class="${escapeAttribute(component.className || '')}" d="${escapeAttribute(bakedPathData)}"/>`;
}

export function selectKnockoutComponents(components, paintComponents, options = {}) {
	const {
		maxArea = Infinity,
		paintUnionAreaRatio = 0.95,
		sourceArtGroupId = null,
	} = options;
	const paintUnion = getComponentUnionBounds(paintComponents);

	return components.filter((component) => {
		if (!component.negativeSpaceCandidate || !paintUnion) {
			return false;
		}

		if (sourceArtGroupId && !component.parentGroupIds.includes(sourceArtGroupId)) {
			return false;
		}

		return component.area <= maxArea
			&& component.area < paintUnion.area * paintUnionAreaRatio
			&& boundsOverlap(component.bounds, paintUnion)
			&& !boundsContainBounds(component.bounds, paintUnion);
	});
}

export function isRelatedKnockout(paintComponent, knockoutComponent) {
	return knockoutComponent.area < paintComponent.area
		&& (
			sharesNestedGroup(paintComponent, knockoutComponent)
			|| boundsContainCenter(paintComponent.bounds, knockoutComponent.center)
			|| boundsOverlap(paintComponent.bounds, knockoutComponent.bounds)
		);
}

export function transformComponentPath(component, transform = IDENTITY) {
	return transformPathData(
		transformPathData(component.pathData, component.transform || IDENTITY),
		transform,
	);
}

export function subtractKnockouts(pathData, knockoutPathDataList) {
	if (knockoutPathDataList.length === 0) {
		return pathData;
	}

	let result = new paper.CompoundPath(pathData);

	for (const knockoutPathData of knockoutPathDataList) {
		const knockout = new paper.CompoundPath(knockoutPathData);
		const next = result.subtract(knockout, { insert: false });

		result.remove();
		knockout.remove();
		result = next;
	}

	const output = result.pathData;
	result.remove();
	return output;
}

export function pruneNestedKnockouts(knockouts) {
	return knockouts.filter((candidate) => !knockouts.some((other) => {
		if (candidate === other || candidate.area >= other.area) {
			return false;
		}

		return boundsContainBounds(other.bounds, candidate.bounds);
	}));
}

export function getComponentUnionBounds(components) {
	if (components.length === 0) {
		return null;
	}

	const boundsList = components.map((component) => component.bounds || component);
	const left = Math.min(...boundsList.map((bounds) => bounds.left));
	const top = Math.min(...boundsList.map((bounds) => bounds.top));
	const right = Math.max(...boundsList.map((bounds) => bounds.right));
	const bottom = Math.max(...boundsList.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		area: (right - left) * (bottom - top),
	};
}

export function findSmallIsolatedCandidates(items, outerBounds = null, options = {}) {
	const bounds = outerBounds || getComponentUnionBounds(items.map((item) => item.bounds || item));

	if (!bounds) {
		return [];
	}

	const {
		topBandRatio = 0.4,
		maxAreaRatio = 0.22,
		minWidth = 1,
		minHeight = 1,
		isolationGapRatio = 0.025,
	} = options;
	const outerArea = bounds.width * bounds.height;
	const isolationGap = Math.max(bounds.width, bounds.height) * isolationGapRatio;

	return items
		.map((item) => makeSemanticCandidate({
			item,
			outerBounds: bounds,
			outerArea,
			isolationGap,
			items,
		}))
		.filter((candidate) => candidate.areaRatio <= maxAreaRatio)
		.filter((candidate) => candidate.bounds.width >= minWidth && candidate.bounds.height >= minHeight)
		.map((candidate) => ({
			...candidate,
			topBand: candidate.normalizedCenter.y <= topBandRatio,
			topBandRatio,
		}))
		.sort((left, right) => {
			if (left.topBand !== right.topBand) {
				return left.topBand ? -1 : 1;
			}

			return right.isolationScore - left.isolationScore
				|| left.normalizedCenter.y - right.normalizedCenter.y
				|| left.normalizedCenter.x - right.normalizedCenter.x;
		});
}

export function boundsContainCenter(bounds, center) {
	return center.x >= bounds.left
		&& center.x <= bounds.right
		&& center.y >= bounds.top
		&& center.y <= bounds.bottom;
}

export function boundsContainBounds(outer, inner) {
	return inner.left >= outer.left
		&& inner.top >= outer.top
		&& inner.right <= outer.right
		&& inner.bottom <= outer.bottom;
}

export function boundsOverlap(left, right) {
	return left.left < right.right
		&& left.right > right.left
		&& left.top < right.bottom
		&& left.bottom > right.top;
}

function sharesNestedGroup(left, right) {
	const nearestGroup = left.parentGroupIds[left.parentGroupIds.length - 1];
	return Boolean(nearestGroup) && right.parentGroupIds.includes(nearestGroup);
}

function makeSemanticCandidate({ item, outerBounds, outerArea, isolationGap, items }) {
	const bounds = item.bounds || item;
	const center = item.center || {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
	const area = bounds.width * bounds.height;
	const nearbyLargerItems = items.filter((other) => {
		if (other === item) {
			return false;
		}

		const otherBounds = other.bounds || other;
		const otherArea = otherBounds.width * otherBounds.height;

		return otherArea > area * 1.5 && boundsOverlap(expandBounds(bounds, isolationGap), otherBounds);
	});
	const normalizedCenter = {
		x: (center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
	const cornerDistances = {
		topLeft: Math.hypot(normalizedCenter.x, normalizedCenter.y),
		topRight: Math.hypot(1 - normalizedCenter.x, normalizedCenter.y),
		bottomLeft: Math.hypot(normalizedCenter.x, 1 - normalizedCenter.y),
		bottomRight: Math.hypot(1 - normalizedCenter.x, 1 - normalizedCenter.y),
	};

	return {
		item,
		bounds,
		center,
		area,
		areaRatio: area / Math.max(1, outerArea),
		normalizedCenter,
		normalizedBottom: (bounds.bottom - outerBounds.top) / Math.max(1, outerBounds.height),
		cornerDistances,
		nearestCorner: Object.entries(cornerDistances)
			.sort((left, right) => left[1] - right[1])[0][0],
		relativePosition: [
			normalizedCenter.y < 0.4 ? 'top' : normalizedCenter.y > 0.72 ? 'bottom' : 'middle',
			normalizedCenter.x < 0.4 ? 'left' : normalizedCenter.x > 0.6 ? 'right' : 'center',
		].join('-'),
		side: normalizedCenter.x < 0.5 ? 'left' : 'right',
		isolationScore: 1 / (nearbyLargerItems.length + 1),
	};
}

function expandBounds(bounds, amount) {
	return {
		left: bounds.left - amount,
		top: bounds.top - amount,
		right: bounds.right + amount,
		bottom: bounds.bottom + amount,
		width: bounds.width + (amount * 2),
		height: bounds.height + (amount * 2),
	};
}

function escapeAttribute(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function makePaintAttributes(component, color) {
	if (isStrokeOnly(component)) {
		const strokeWidth = component.strokeWidth
			? ` stroke-width="${escapeAttribute(String(component.strokeWidth))}"`
			: '';
		return ` fill="none" stroke="${escapeAttribute(color)}"${strokeWidth}`;
	}

	const fillRule = component.fillRule
		? ` fill-rule="${escapeAttribute(component.fillRule)}"`
		: '';
	return ` fill="${escapeAttribute(color)}"${fillRule}`;
}

function isStrokeOnly(component) {
	return !isPaint(component.fill) && isPaint(component.stroke);
}

function isPaint(value) {
	return Boolean(value) && value !== 'none' && value !== 'transparent';
}

function makeTransformAttribute(matrix) {
	if (isIdentity(matrix)) {
		return '';
	}

	return ` transform="matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})"`;
}

function normalizeMatrix(transform) {
	return typeof transform === 'string'
		? parseTransform(transform)
		: transform || IDENTITY;
}

function isIdentity(matrix) {
	return nearlyEqual(matrix.a, 1)
		&& nearlyEqual(matrix.b, 0)
		&& nearlyEqual(matrix.c, 0)
		&& nearlyEqual(matrix.d, 1)
		&& nearlyEqual(matrix.e, 0)
		&& nearlyEqual(matrix.f, 0);
}

function nearlyEqual(left, right) {
	return Math.abs(left - right) < 0.000001;
}

function format(value) {
	return Number(value.toFixed(6)).toString();
}

