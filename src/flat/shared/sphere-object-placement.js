import {
	addScaledVectors,
	crossVectors,
	normalizeVector,
	scaleVector,
} from './observer-relative-placement.js';

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

function tangentRadiusFromBounds(bounds) {
	return Math.max(
		Math.hypot(bounds.min.x, bounds.min.z),
		Math.hypot(bounds.min.x, bounds.max.z),
		Math.hypot(bounds.max.x, bounds.min.z),
		Math.hypot(bounds.max.x, bounds.max.z),
	);
}

/**
 * Place a rigid object relative to a spherical surface.
 *
 * The returned center always lies on the radial line through the selected
 * surface normal. The returned orientation maps the object's local `y` axis to
 * that radial surface normal. `side: "outside"` places the object as a
 * surface-mounted object: the bottom footprint is sunk far enough that no
 * bottom point hovers above the sphere, while the object's height extends
 * outward from that embedded footprint. `side: "inside"` guarantees the object
 * bounds are on or inside the sphere.
 *
 * A flat-bottomed rigid box on a sphere must be partially embedded if its
 * bottom footprint should never hover above the curved surface.
 *
 * @param {FlatSphereObjectPlacementConfig} config - Store placement inputs.
 * @returns {FlatSphereObjectPlacement} The resolved sphere placement.
 */
export function placeObjectOnSphere(config) {
	const sphereCenter = config.sphereCenter || { x: 0, y: 0, z: 0 };
	const sphereRadiusKm = Math.max(0.000001, finiteNumber(config.sphereRadiusKm, 1));
	const side = config.side === 'inside' ? 'inside' : 'outside';
	const surfaceNormal = normalizeVector(config.surfaceNormal || DEFAULT_UP);
	const referenceTangent = createReferenceTangent(surfaceNormal, config.referenceDirection);
	const bearingRad = finiteNumber(config.bearingRad, 0);
	const tangentRight = normalizeVector(crossVectors(referenceTangent, surfaceNormal));
	const zAxis = normalizeVector(addScaledVectors([
		{ vector: referenceTangent, scale: Math.cos(bearingRad) },
		{ vector: tangentRight, scale: Math.sin(bearingRad) },
	]));
	const xAxis = normalizeVector(crossVectors(surfaceNormal, zAxis));
	const bounds = normalizeBounds(config.bounds || {});
	const tangentRadiusKm = tangentRadiusFromBounds(bounds);
	let centerRadiusKm;

	if (side === 'inside') {
		if (tangentRadiusKm >= sphereRadiusKm) {
			throw new Error('Cannot place object inside sphere: tangent bounds are wider than the sphere radius.');
		}

		centerRadiusKm = Math.sqrt((sphereRadiusKm * sphereRadiusKm) - (tangentRadiusKm * tangentRadiusKm))
			- bounds.max.y;
	} else {
		if (tangentRadiusKm >= sphereRadiusKm) {
			throw new Error('Cannot place object on sphere: tangent bounds are wider than the sphere radius.');
		}

		centerRadiusKm = Math.sqrt((sphereRadiusKm * sphereRadiusKm) - (tangentRadiusKm * tangentRadiusKm))
			- bounds.min.y;
	}

	const radialCenterOffset = scaleVector(surfaceNormal, centerRadiusKm);
	const position = addScaledVectors([
		{ vector: sphereCenter, scale: 1 },
		{ vector: radialCenterOffset, scale: 1 },
	]);

	return {
		side,
		position,
		orientation: {
			xAxis,
			yAxis: surfaceNormal,
			zAxis,
		},
		sphere: {
			center: { ...sphereCenter },
			radiusKm: sphereRadiusKm,
			surfaceNormal,
			surfacePoint: addScaledVectors([
				{ vector: sphereCenter, scale: 1 },
				{ vector: surfaceNormal, scale: sphereRadiusKm },
			]),
			centerRadiusKm,
			tangentRadiusKm,
		},
		bounds,
	};
}

/**
 * Transform a local object-space point into world space using sphere placement.
 *
 * @param {FlatSphereObjectPlacement} placement - Store the sphere placement.
 * @param {FlatVector3} point - Store the local object point.
 * @returns {FlatVector3} The world-space point.
 */
export function transformSpherePlacedPoint(placement, point) {
	return addScaledVectors([
		{ vector: placement.position, scale: 1 },
		{ vector: placement.orientation.xAxis, scale: point.x },
		{ vector: placement.orientation.yAxis, scale: point.y },
		{ vector: placement.orientation.zAxis, scale: point.z },
	]);
}

/**
 * Measure a placed point's distance from the sphere center.
 *
 * @param {FlatSphereObjectPlacement} placement - Store the sphere placement.
 * @param {FlatVector3} point - Store the world-space point.
 * @returns {number} The radial distance from sphere center.
 */
export function spherePlacedPointRadius(placement, point) {
	return vectorLength(subtractVectors(point, placement.sphere.center));
}
