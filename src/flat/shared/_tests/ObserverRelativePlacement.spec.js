import {
	placeObserverRelativeObject,
} from '../observer-relative-placement.js';

function vectorLength(vector) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

function dotVectors(left, right) {
	return left.x * right.x + left.y * right.y + left.z * right.z;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

describe('observer-relative placement', () => {
	it('places a center-referenced object on a flat plane', () => {
		const placement = placeObserverRelativeObject({
			frame: {
				kind: 'flat-plane',
				origin: { x: 10, y: 2, z: 20 },
				east: { x: 1, y: 0, z: 0 },
				north: { x: 0, y: 0, z: 1 },
				up: { x: 0, y: 1, z: 0 },
			},
			bearingRad: Math.PI / 2,
			distanceKm: 5,
			heightKm: 2,
		});

		expect(placement.position.x).toBeCloseTo(15, 8);
		expect(placement.position.y).toBeCloseTo(3, 8);
		expect(placement.position.z).toBeCloseTo(20, 8);
		expect(placement.surface.linearDistanceKm).toBe(5);
		expect(placement.surface.nearEdgeDistanceKm).toBe(5);
		expect(vectorLength(placement.orientation.xAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.yAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.zAxis)).toBeCloseTo(1, 8);
	});

	it('keeps flat placement attached to the provided surface origin', () => {
		const surfaceOrigin = { x: 10, y: 0, z: 20 };
		const observerEye = { x: 10, y: 0.03048, z: 20 };
		const placement = placeObserverRelativeObject({
			frame: {
				kind: 'flat-plane',
				origin: surfaceOrigin,
				east: { x: 1, y: 0, z: 0 },
				north: { x: 0, y: 0, z: 1 },
				up: { x: 0, y: 1, z: 0 },
			},
			bearingRad: 0,
			distanceKm: 1,
			heightKm: 0.5,
		});

		expect(observerEye.y).not.toBe(surfaceOrigin.y);
		expect(placement.surface.centerKm.y).toBe(surfaceOrigin.y);
		expect(placement.position.y - 0.25).toBeCloseTo(surfaceOrigin.y, 8);
	});

	it('places a near-edge-referenced object on a spherical surface', () => {
		const radiusKm = 100;
		const placement = placeObserverRelativeObject({
			frame: {
				kind: 'spherical-surface',
				planetRadiusKm: radiusKm,
				east: { x: 1, y: 0, z: 0 },
				north: { x: 0, y: 0, z: 1 },
				up: { x: 0, y: 1, z: 0 },
			},
			bearingRad: 0,
			distanceKm: 10,
			distanceReference: 'near-edge',
			depthKm: 4,
			heightKm: 2,
		});
		const observerUp = { x: 0, y: 1, z: 0 };
		const centerDistanceKm = Math.acos(clamp(
			dotVectors(observerUp, placement.surface.normal),
			-1,
			1,
		)) * radiusKm;
		const nearEdgeDistanceKm = Math.acos(clamp(
			dotVectors(observerUp, placement.surface.nearEdgeCenterKm)
				/ vectorLength(placement.surface.nearEdgeCenterKm),
			-1,
			1,
		)) * radiusKm;

		expect(vectorLength(placement.surface.centerKm)).toBeCloseTo(radiusKm, 8);
		expect(vectorLength(placement.position)).toBeCloseTo(radiusKm + 1, 8);
		expect(centerDistanceKm).toBeCloseTo(12, 8);
		expect(placement.surface.geodesicDistanceKm).toBeCloseTo(12, 8);
		expect(nearEdgeDistanceKm).toBeCloseTo(10, 8);
		expect(placement.surface.nearEdgeDistanceKm).toBe(10);
		expect(vectorLength(placement.orientation.xAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.yAxis)).toBeCloseTo(1, 8);
		expect(vectorLength(placement.orientation.zAxis)).toBeCloseTo(1, 8);
	});
});
