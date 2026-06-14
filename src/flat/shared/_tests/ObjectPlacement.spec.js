import {
	placeObjectForGeometry,
} from '../object-placement.js';
import {
	spherePlacedPointRadius,
	transformSpherePlacedPoint,
} from '../sphere-object-placement.js';

function vectorLength(vector) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

describe('object placement dispatcher', () => {
	it('places an object on flat-plane geometry', () => {
		const placement = placeObjectForGeometry({
			geometry: {
				kind: 'flat-plane',
				origin: { x: 0, y: 0, z: 0 },
				up: { x: 0, y: 1, z: 0 },
			},
			position: { x: 10, y: 0, z: 20 },
			referenceDirection: { x: 0, y: 0, z: 1 },
			bounds: {
				min: { x: -1, y: 0, z: -1 },
				max: { x: 1, y: 2, z: 1 },
			},
		});

		expect(placement.geometryKind).toBe('flat-plane');
		expect(placement.position.x).toBe(10);
		expect(placement.position.y).toBe(0);
		expect(placement.position.z).toBe(20);
		expect(vectorLength(placement.orientation.yAxis)).toBeCloseTo(1, 8);
	});

	it('places an object on spherical geometry from a surface point', () => {
		const placement = placeObjectForGeometry({
			geometry: {
				kind: 'sphere',
				center: { x: 0, y: 0, z: 0 },
				radiusKm: 100,
			},
			position: {
				surfacePoint: { x: 0, y: 100, z: 0 },
			},
			referenceDirection: { x: 0, y: 0, z: 1 },
			bounds: {
				size: { x: 4, y: 2, z: 8 },
			},
		});
		const bottomCorner = transformSpherePlacedPoint(placement, {
			x: placement.bounds.max.x,
			y: placement.bounds.min.y,
			z: placement.bounds.max.z,
		});

		expect(placement.side).toBe('outside');
		expect(placement.sphere.radiusKm).toBe(100);
		expect(placement.sphere.surfaceNormal.y).toBeCloseTo(1, 8);
		expect(spherePlacedPointRadius(placement, bottomCorner)).toBeLessThanOrEqual(100.000000001);
	});

	it('fails loudly for unsupported geometry', () => {
		expect(() => placeObjectForGeometry({
			geometry: {
				kind: 'unsupported',
			},
			position: { x: 0, y: 0, z: 0 },
		})).toThrowError('Unsupported object placement geometry: unsupported');
	});
});
