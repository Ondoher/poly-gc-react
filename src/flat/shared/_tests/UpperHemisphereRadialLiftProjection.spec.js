import UpperHemisphereRadialLiftProjection from '../projection/sky-surface/UpperHemisphereRadialLiftProjection.js';

const DOME_RADIUS_KM = 20015.114442035923;
const projection = new UpperHemisphereRadialLiftProjection();
const context = Object.freeze({
	options: {
		domeRadiusKm: DOME_RADIUS_KM,
	},
});

function distanceFromOrigin(position) {
	return Math.hypot(position.x, position.y, position.z);
}

describe('UpperHemisphereRadialLiftProjection', () => {
	// These expectations come from the radial-lift definition:
	// the projection center maps to the top of the upper hemisphere.
	it('maps the projection center to the dome top', () => {
		const result = projection.projectSurface({
			theta: 0,
			angularDistanceRad: 0,
			maxAngularDistanceRad: Math.PI,
		}, context);

		expect(result.visible).toBeTrue();
		expect(result.position.x).toBeCloseTo(0, 8);
		expect(result.position.y).toBeCloseTo(DOME_RADIUS_KM, 8);
		expect(result.position.z).toBeCloseTo(0, 8);
	});

	// These expectations come from the radial-lift definition:
	// the projection edge maps to the hemisphere rim/horizon.
	it('maps the projection edge to the dome rim', () => {
		const result = projection.projectSurface({
			theta: 0,
			angularDistanceRad: Math.PI,
			maxAngularDistanceRad: Math.PI,
		}, context);

		expect(result.visible).toBeTrue();
		expect(result.position.x).toBeCloseTo(0, 8);
		expect(result.position.y).toBeCloseTo(0, 8);
		expect(result.position.z).toBeCloseTo(DOME_RADIUS_KM, 8);
	});

	// These expectations come from hemisphere geometry:
	// halfway through the projected angular domain maps to a 45-degree dome
	// polar angle, not half the horizontal radius.
	it('lifts a halfway projected point onto the sphere surface', () => {
		const result = projection.projectSurface({
			theta: Math.PI / 2,
			angularDistanceRad: Math.PI / 2,
			maxAngularDistanceRad: Math.PI,
		}, context);
		const expected = DOME_RADIUS_KM / Math.sqrt(2);

		expect(result.visible).toBeTrue();
		expect(result.position.x).toBeCloseTo(expected, 8);
		expect(result.position.y).toBeCloseTo(expected, 8);
		expect(result.position.z).toBeCloseTo(0, 8);
		expect(distanceFromOrigin(result.position)).toBeCloseTo(DOME_RADIUS_KM, 8);
		expect(result.metadata.domePolarAngleRad).toBeCloseTo(Math.PI / 4, 8);
	});

	// These expectations come from the surface contract:
	// out-of-domain projected values are clamped to finite surface coordinates
	// while still reporting that the source point is not visible.
	it('clamps out-of-domain points but marks them not visible', () => {
		const result = projection.projectSurface({
			theta: Math.PI,
			angularDistanceRad: Math.PI * 2,
			maxAngularDistanceRad: Math.PI,
		}, context);

		expect(result.visible).toBeFalse();
		expect(distanceFromOrigin(result.position)).toBeCloseTo(DOME_RADIUS_KM, 8);
		expect(result.metadata.ratio).toBe(1);
		expect(result.metadata.unclampedRatio).toBe(2);
	});
});
