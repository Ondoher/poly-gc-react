/**
 * Normalize a vector.
 *
 * @param {FlatVector3} vector - Store the vector to normalize.
 * @returns {FlatVector3} The normalized vector.
 */
export function normalizeVector(vector) {
	const length = Math.hypot(vector.x, vector.y, vector.z) || 1;

	return {
		x: vector.x / length,
		y: vector.y / length,
		z: vector.z / length,
	};
}

/**
 * Scale a vector.
 *
 * @param {FlatVector3} vector - Store the vector to scale.
 * @param {number} scale - Store the scale factor.
 * @returns {FlatVector3} The scaled vector.
 */
export function scaleVector(vector, scale) {
	return {
		x: vector.x * scale,
		y: vector.y * scale,
		z: vector.z * scale,
	};
}

/**
 * Add scaled vector terms.
 *
 * @param {{ vector: FlatVector3, scale: number }[]} terms - Store vector terms.
 * @returns {FlatVector3} The summed vector.
 */
export function addScaledVectors(terms) {
	return terms.reduce((sum, term) => ({
		x: sum.x + term.vector.x * term.scale,
		y: sum.y + term.vector.y * term.scale,
		z: sum.z + term.vector.z * term.scale,
	}), { x: 0, y: 0, z: 0 });
}

/**
 * Calculate a cross product.
 *
 * @param {FlatVector3} left - Store the left-hand vector.
 * @param {FlatVector3} right - Store the right-hand vector.
 * @returns {FlatVector3} The cross product.
 */
export function crossVectors(left, right) {
	return {
		x: left.y * right.z - left.z * right.y,
		y: left.z * right.x - left.x * right.z,
		z: left.x * right.y - left.y * right.x,
	};
}

/**
 * Resolve the local tangent direction for a compass bearing.
 *
 * @param {FlatObserverRelativeFrame} frame - Store the observer frame.
 * @param {number} bearingRad - Store clockwise bearing from north in radians.
 * @returns {FlatVector3} The normalized bearing direction.
 */
export function createBearingDirection(frame, bearingRad) {
	return normalizeVector(addScaledVectors([
		{ vector: frame.east, scale: Math.sin(bearingRad) },
		{ vector: frame.north, scale: Math.cos(bearingRad) },
	]));
}

/**
 * Place an observer-relative object on a flat plane or spherical surface.
 *
 * Placement frames describe the surface, not the observer eye position. The
 * returned object center is always offset from the resolved surface point by
 * half the requested height along the local surface normal, so the object
 * contacts the active surface.
 *
 * The distance is interpreted as the object center by default. Use
 * `distanceReference: 'near-edge'` with `depthKm` when the requested distance
 * should refer to the nearest face/edge of a depth-bearing marker.
 *
 * @param {FlatObserverRelativePlacementConfig} config - Store placement inputs.
 * @returns {FlatObserverRelativePlacement} The resolved object placement.
 */
export function placeObserverRelativeObject(config) {
	const frame = config.frame;
	const heightKm = Number(config.heightKm) || 0;
	const depthKm = Number(config.depthKm) || 0;
	const requestedDistanceKm = Number(config.distanceKm) || 0;
	const centerDistanceKm = config.distanceReference === 'near-edge'
		? requestedDistanceKm + depthKm / 2
		: requestedDistanceKm;
	const bearingDirection = createBearingDirection(frame, config.bearingRad);

	if (frame.kind === 'spherical-surface') {
		const planetRadiusKm = Number(frame.planetRadiusKm) || 1;
		const angularDistanceRad = centerDistanceKm / planetRadiusKm;
		const nearEdgeAngularDistanceRad = requestedDistanceKm / planetRadiusKm;
		const surfaceNormal = normalizeVector(addScaledVectors([
			{ vector: frame.up, scale: Math.cos(angularDistanceRad) },
			{ vector: bearingDirection, scale: Math.sin(angularDistanceRad) },
		]));
		const nearEdgeNormal = normalizeVector(addScaledVectors([
			{ vector: frame.up, scale: Math.cos(nearEdgeAngularDistanceRad) },
			{ vector: bearingDirection, scale: Math.sin(nearEdgeAngularDistanceRad) },
		]));
		const forward = normalizeVector(addScaledVectors([
			{ vector: frame.up, scale: -Math.sin(angularDistanceRad) },
			{ vector: bearingDirection, scale: Math.cos(angularDistanceRad) },
		]));
		const xAxis = normalizeVector(crossVectors(surfaceNormal, forward));
		const zAxis = normalizeVector(crossVectors(xAxis, surfaceNormal));

		return {
			position: scaleVector(surfaceNormal, planetRadiusKm + heightKm / 2),
			orientation: {
				xAxis,
				yAxis: surfaceNormal,
				zAxis,
			},
			surface: {
				centerKm: scaleVector(surfaceNormal, planetRadiusKm),
				normal: surfaceNormal,
				bearingDirection: zAxis,
				geodesicDistanceKm: centerDistanceKm,
				nearEdgeCenterKm: scaleVector(nearEdgeNormal, planetRadiusKm),
				nearEdgeDistanceKm: requestedDistanceKm,
			},
		};
	}

	const up = normalizeVector(frame.up);
	const xAxis = normalizeVector(crossVectors(up, bearingDirection));
	const zAxis = normalizeVector(crossVectors(xAxis, up));
	const surfaceCenter = addScaledVectors([
		{ vector: frame.origin, scale: 1 },
		{ vector: bearingDirection, scale: centerDistanceKm },
	]);

	return {
		position: addScaledVectors([
			{ vector: surfaceCenter, scale: 1 },
			{ vector: up, scale: heightKm / 2 },
		]),
		orientation: {
			xAxis,
			yAxis: up,
			zAxis,
		},
		surface: {
			centerKm: surfaceCenter,
			normal: up,
			bearingDirection: zAxis,
			linearDistanceKm: centerDistanceKm,
		nearEdgeCenterKm: addScaledVectors([
			{ vector: frame.origin, scale: 1 },
			{ vector: bearingDirection, scale: requestedDistanceKm },
			]),
			nearEdgeDistanceKm: requestedDistanceKm,
		},
	};
}
