import NorthCelestialPoleAzimuthalEquidistantProjection from '../projection/celestial/NorthCelestialPoleAzimuthalEquidistantProjection.js';

const DOME_RADIUS_KM = 20015.114442035923;
const projection = new NorthCelestialPoleAzimuthalEquidistantProjection();
const context = Object.freeze({
	options: {
		domeRadiusKm: DOME_RADIUS_KM,
		referenceRightAscensionDeg: 0,
	},
});

describe('NorthCelestialPoleAzimuthalEquidistantProjection', () => {
	// These expectations come from the azimuthal equidistant definition:
	// projected radius is proportional to angular distance from the north
	// celestial pole.
	it('maps the north celestial pole to the projection origin', () => {
		const result = projection.projectCelestial({ raDeg: 0, decDeg: 90 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(0, 8);
		expect(result.projected.x).toBeCloseTo(0, 8);
		expect(result.projected.y).toBeCloseTo(0, 8);
	});

	// These expectations come from the full celestial-pole-to-pole domain:
	// the celestial equator is pi/2 radians from the north celestial pole.
	it('maps the celestial equator halfway to the projection radius', () => {
		const result = projection.projectCelestial({ raDeg: 0, decDeg: 0 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(DOME_RADIUS_KM / 2, 8);
		expect(result.projected.angularDistanceRad).toBeCloseTo(Math.PI / 2, 8);
	});

	// These expectations come from the full celestial-pole-to-pole domain:
	// the south celestial pole is pi radians from the north celestial pole.
	it('maps the south celestial pole to the projection edge', () => {
		const result = projection.projectCelestial({ raDeg: 0, decDeg: -90 }, context);

		expect(result.visible).toBeTrue();
		expect(result.projected.radius).toBeCloseTo(DOME_RADIUS_KM, 8);
		expect(result.projected.angularDistanceRad).toBeCloseTo(Math.PI, 8);
	});

	// These expectations come from the RA convention in this POC:
	// right ascension offset from the reference meridian controls theta.
	it('uses right ascension offset as projection angle', () => {
		const result = projection.projectCelestial({ raDeg: 90, decDeg: 0 }, context);

		expect(result.projected.theta).toBeCloseTo(Math.PI / 2, 8);
		expect(result.projected.x).toBeCloseTo(result.projected.radius, 8);
		expect(result.projected.y).toBeCloseTo(0, 8);
	});

	// These expectations come from the reference-RA rotation rule:
	// changing referenceRightAscensionDeg rotates theta but preserves radius.
	it('rotates around the projection origin when reference right ascension changes', () => {
		const base = projection.projectCelestial({ raDeg: 90, decDeg: 0 }, context);
		const rotated = projection.projectCelestial({ raDeg: 90, decDeg: 0 }, {
			options: {
				domeRadiusKm: DOME_RADIUS_KM,
				referenceRightAscensionDeg: 90,
			},
		});

		expect(rotated.projected.radius).toBeCloseTo(base.projected.radius, 8);
		expect(rotated.projected.theta).toBeCloseTo(0, 8);
		expect(rotated.projected.x).toBeCloseTo(0, 8);
		expect(rotated.projected.y).toBeCloseTo(rotated.projected.radius, 8);
	});
});
