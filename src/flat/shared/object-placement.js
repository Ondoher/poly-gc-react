import {
	addScaledVectors,
	crossVectors,
	normalizeVector,
} from './observer-relative-placement.js';
import {
	placeObjectOnSphere,
} from './sphere-object-placement.js';

const DEFAULT_UP = Object.freeze({ x: 0, y: 1, z: 0 });
const DEFAULT_FORWARD = Object.freeze({ x: 0, y: 0, z: 1 });

function finiteNumber(value, fallback) {
	return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function vectorLength(vector) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

function subtractVectors(left, right) {
	return {
		x: left.x - right.x,
		y: left.y - right.y,
		z: left.z - right.z,
	};
}

function projectOntoPlane(vector, normal) {
	const normalComponent = vector.x * normal.x + vector.y * normal.y + vector.z * normal.z;

	return addScaledVectors([
		{ vector, scale: 1 },
		{ vector: normal, scale: -normalComponent },
	]);
}

function createReferenceTangent(surfaceNormal, referenceDirection) {
	const tangent = projectOntoPlane(referenceDirection || DEFAULT_FORWARD, surfaceNormal);

	if (vectorLength(tangent) > 0.0000001) {
		return normalizeVector(tangent);
	}

	return normalizeVector(projectOntoPlane(DEFAULT_UP, surfaceNormal));
}

function normalizeBounds(bounds) {
	const size = bounds?.size || {};
	const halfWidthKm = Math.max(0, finiteNumber(size.x, 0) / 2);
	const halfHeightKm = Math.max(0, finiteNumber(size.y, 0) / 2);
	const halfDepthKm = Math.max(0, finiteNumber(size.z, 0) / 2);

	return {
		min: {
			x: finiteNumber(bounds?.min?.x, -halfWidthKm),
			y: finiteNumber(bounds?.min?.y, -halfHeightKm),
			z: finiteNumber(bounds?.min?.z, -halfDepthKm),
		},
		max: {
			x: finiteNumber(bounds?.max?.x, halfWidthKm),
			y: finiteNumber(bounds?.max?.y, halfHeightKm),
			z: finiteNumber(bounds?.max?.z, halfDepthKm),
		},
	};
}

function createFlatOrientation(surfaceNormal, referenceDirection, bearingRad) {
	const referenceTangent = createReferenceTangent(surfaceNormal, referenceDirection);
	const tangentRight = normalizeVector(crossVectors(referenceTangent, surfaceNormal));
	const zAxis = normalizeVector(addScaledVectors([
		{ vector: referenceTangent, scale: Math.cos(bearingRad) },
		{ vector: tangentRight, scale: Math.sin(bearingRad) },
	]));

	return {
		xAxis: normalizeVector(crossVectors(surfaceNormal, zAxis)),
		yAxis: surfaceNormal,
		zAxis,
	};
}

function resolveSurfacePosition(position, fallback) {
	if (position?.surfacePoint) {
		return position.surfacePoint;
	}

	if (position?.point) {
		return position.point;
	}

	return position || fallback;
}

function resolveSphereSurfaceNormal(geometry, position) {
	const center = geometry.center || geometry.planetCenter || { x: 0, y: 0, z: 0 };

	if (position?.surfaceNormal) {
		return normalizeVector(position.surfaceNormal);
	}

	return normalizeVector(subtractVectors(resolveSurfacePosition(position, { x: 0, y: 1, z: 0 }), center));
}

/**
 * Place a rigid object relative to a flat surface.
 *
 * `side: "outside"` makes the object's bottom plane coincide with the flat
 * surface. `side: "inside"` makes the object's top plane coincide with it.
 *
 * @param {FlatObjectPlacementConfig} config - Store placement inputs.
 * @returns {FlatGenericObjectPlacement} The resolved placement.
 */
export function placeObjectOnFlatPlane(config) {
	const geometry = config.geometry || {};
	const surfaceNormal = normalizeVector(geometry.normal || geometry.up || config.position?.surfaceNormal || DEFAULT_UP);
	const surfacePoint = resolveSurfacePosition(config.position, geometry.origin || { x: 0, y: 0, z: 0 });
	const bounds = normalizeBounds(config.bounds || {});
	const side = config.side === 'inside' ? 'inside' : 'outside';
	const bearingRad = finiteNumber(config.bearingRad, 0);
	const orientation = createFlatOrientation(surfaceNormal, config.referenceDirection, bearingRad);
	const centerOffsetKm = side === 'inside'
		? -bounds.max.y
		: -bounds.min.y;
	const position = addScaledVectors([
		{ vector: surfacePoint, scale: 1 },
		{ vector: surfaceNormal, scale: centerOffsetKm },
	]);

	return {
		geometryKind: 'flat-plane',
		side,
		position,
		orientation,
		surface: {
			point: { ...surfacePoint },
			normal: surfaceNormal,
		},
		bounds,
	};
}

/**
 * Place a rigid object by dispatching to the matching geometry placement rule.
 *
 * @param {FlatObjectPlacementConfig} config - Store placement inputs.
 * @returns {FlatGenericObjectPlacement | FlatSphereObjectPlacement} The resolved placement.
 */
export function placeObjectForGeometry(config) {
	const geometry = config.geometry || {};

	if (geometry.kind === 'sphere' || geometry.kind === 'spherical-surface') {
		return placeObjectOnSphere({
			sphereCenter: geometry.center || geometry.planetCenter || { x: 0, y: 0, z: 0 },
			sphereRadiusKm: finiteNumber(geometry.radiusKm, geometry.planetRadiusKm),
			surfaceNormal: resolveSphereSurfaceNormal(geometry, config.position),
			referenceDirection: config.referenceDirection,
			bearingRad: config.bearingRad,
			side: config.side,
			bounds: config.bounds,
		});
	}

	if (geometry.kind === 'flat-plane') {
		return placeObjectOnFlatPlane(config);
	}

	throw new Error(`Unsupported object placement geometry: ${geometry.kind || 'unknown'}`);
}
