import {
	placeObjectOnSphere,
	spherePlacedPointRadius,
	transformSpherePlacedPoint,
} from '../sphere-object-placement.js';

function dotVectors(left, right) {
	return left.x * right.x + left.y * right.y + left.z * right.z;
}

function vectorLength(vector) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

function createCorners(bounds) {
	return [
		{ x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
		{ x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
		{ x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
		{ x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
		{ x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
		{ x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
		{ x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
		{ x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
	];
}

describe('sphere object placement', () => {
	it('places a surface object so no sampled bottom corner hovers over the sphere', () => {
		const placement = placeObjectOnSphere({
			sphereRadiusKm: 100,
			surfaceNormal: { x: 0, y: 1, z: 0 },
			referenceDirection: { x: 0, y: 0, z: 1 },
			bearingRad: Math.PI / 4,
			side: 'outside',
			bounds: {
				size: { x: 4, y: 2, z: 8 },
			},
		});
		const bottomCenter = transformSpherePlacedPoint(placement, { x: 0, y: placement.bounds.min.y, z: 0 });

		expect(vectorLength(placement.orientation.xAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.yAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.zAxis)).toBeCloseTo(1, 8);
		expect(dotVectors(placement.orientation.yAxis, placement.sphere.surfaceNormal)).toBeCloseTo(1, 8);
		expect(spherePlacedPointRadius(placement, bottomCenter)).toBeLessThan(100);

		createCorners({
			min: placement.bounds.min,
			max: {
				x: placement.bounds.max.x,
				y: placement.bounds.min.y,
				z: placement.bounds.max.z,
			},
		}).forEach((corner) => {
			const point = transformSpherePlacedPoint(placement, corner);

			expect(spherePlacedPointRadius(placement, point)).toBeLessThanOrEqual(100.000000001);
		});
	});

	it('places an inside object so no sampled bound corner exits the sphere', () => {
		const placement = placeObjectOnSphere({
			sphereRadiusKm: 100,
			surfaceNormal: { x: 0, y: 1, z: 0 },
			referenceDirection: { x: 0, y: 0, z: 1 },
			side: 'inside',
			bounds: {
				size: { x: 4, y: 2, z: 8 },
			},
		});

		createCorners(placement.bounds).forEach((corner) => {
			const point = transformSpherePlacedPoint(placement, corner);

			expect(spherePlacedPointRadius(placement, point)).toBeLessThanOrEqual(100.000000001);
		});
	});

	it('keeps the object center on the radial line through the selected surface point', () => {
		const surfaceNormal = { x: 1, y: 2, z: 3 };
		const placement = placeObjectOnSphere({
			sphereCenter: { x: 10, y: 20, z: 30 },
			sphereRadiusKm: 50,
			surfaceNormal,
			referenceDirection: { x: 0, y: 1, z: 0 },
			side: 'outside',
			bounds: {
				min: { x: -1, y: 0, z: -1 },
				max: { x: 1, y: 3, z: 1 },
			},
		});
		const centerOffset = {
			x: placement.position.x - placement.sphere.center.x,
			y: placement.position.y - placement.sphere.center.y,
			z: placement.position.z - placement.sphere.center.z,
		};

		expect(vectorLength(centerOffset)).toBeCloseTo(placement.sphere.centerRadiusKm, 8);
		expect(dotVectors(centerOffset, placement.sphere.surfaceNormal))
			.toBeCloseTo(placement.sphere.centerRadiusKm, 8);
	});
});
