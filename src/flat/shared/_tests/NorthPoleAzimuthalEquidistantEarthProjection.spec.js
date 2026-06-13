import NorthPoleAzimuthalEquidistantEarthProjection from '../projection/earth/NorthPoleAzimuthalEquidistantEarthProjection.js';

const MEAN_EARTH_RADIUS_KM = 6371.0088;
const projection = new NorthPoleAzimuthalEquidistantEarthProjection();
const context = Object.freeze({
	options: {
		meanEarthRadiusKm: MEAN_EARTH_RADIUS_KM,
	},
});

describe('NorthPoleAzimuthalEquidistantEarthProjection', () => {
	// These expectations come from the azimuthal equidistant definition:
	// projected radius is proportional to angular distance from the north pole.
	it('maps the north pole to the projection origin', () => {
		const result = projection.projectGeo({ lat: 90, lon: 0 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(0, 8);
		expect(result.projected.x).toBeCloseTo(0, 8);
		expect(result.projected.y).toBeCloseTo(0, 8);
	});

	// These expectations come from the full pole-to-pole domain:
	// equator angular distance is pi/2, half of the pi maximum.
	it('maps the equator halfway to the outer map radius', () => {
		const result = projection.projectGeo({ lat: 0, lon: 0 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(MEAN_EARTH_RADIUS_KM * Math.PI / 2, 8);
		expect(result.projected.angularDistanceRad).toBeCloseTo(Math.PI / 2, 8);
	});

	// These expectations come from the full pole-to-pole domain:
	// the south pole is pi radians from the north pole and lands on the edge.
	it('maps the south pole to the outer map radius', () => {
		const result = projection.projectGeo({ lat: -90, lon: 0 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(MEAN_EARTH_RADIUS_KM * Math.PI, 8);
		expect(result.projected.angularDistanceRad).toBeCloseTo(Math.PI, 8);
	});

	// These expectations come from the polar-coordinate convention:
	// longitude changes theta/direction, not radial distance.
	it('keeps radius stable while longitude changes direction', () => {
		const atZero = projection.projectGeo({ lat: 45, lon: 0 }, context);
		const atNinety = projection.projectGeo({ lat: 45, lon: 90 }, context);

		expect(atNinety.projected.radius).toBeCloseTo(atZero.projected.radius, 8);
		expect(atZero.projected.x).toBeCloseTo(0, 8);
		expect(atZero.projected.y).toBeCloseTo(atZero.projected.radius, 8);
		expect(atZero.position.z).toBeCloseTo(atZero.projected.y, 8);
		expect(atNinety.projected.x).toBeCloseTo(atNinety.projected.radius, 8);
		expect(atNinety.projected.y).toBeCloseTo(0, 8);
	});
});
