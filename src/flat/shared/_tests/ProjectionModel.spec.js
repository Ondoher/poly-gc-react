import { ProjectionModel } from '../projection/index.js';

const MEAN_EARTH_RADIUS_KM = 6371.0088;
const EARTH_PROJECTION_RADIUS_KM = Math.PI * MEAN_EARTH_RADIUS_KM;
const SAN_JOSE = Object.freeze({
	id: 'san-jose-ca-us',
	name: 'San Jose',
	admin1: 'CA',
	country: 'US',
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 0,
});

function createModel(config = {}) {
	return new ProjectionModel({
		id: 'flat-poc-test',
		root: SAN_JOSE,
		time: '2026-05-22T00:00:00-07:00',
		earthProjection: 'north-pole-azimuthal-equidistant',
		celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
		skySurfaceProjection: 'upper-hemisphere-radial-lift',
		options: {
			meanEarthRadiusKm: MEAN_EARTH_RADIUS_KM,
			earthProjectionRadiusKm: EARTH_PROJECTION_RADIUS_KM,
			domeRadiusKm: EARTH_PROJECTION_RADIUS_KM,
			referenceRightAscensionDeg: 0,
		},
		...config,
	});
}

function expectFiniteVector(vector) {
	expect(Number.isFinite(vector.x)).toBeTrue();
	expect(Number.isFinite(vector.y)).toBeTrue();
	expect(Number.isFinite(vector.z)).toBeTrue();
}

describe('ProjectionModel', () => {
	it('registers the false-simulation projection roles', () => {
		expect(ProjectionModel.projectionIds('earth')).toContain('north-pole-azimuthal-equidistant');
		expect(ProjectionModel.projectionIds('celestial')).toContain('north-celestial-pole-azimuthal-equidistant');
		expect(ProjectionModel.projectionIds('sky-surface')).toContain('upper-hemisphere-radial-lift');
	});

	it('fails loudly when a configured projection is missing', () => {
		expect(() => createModel({ earthProjection: 'missing-earth-projection' }))
			.toThrowError('Unknown earth projection "missing-earth-projection".');
	});

	it('keeps San Jose as the root context', () => {
		const model = createModel();

		expect(model.getRoot()).toEqual(SAN_JOSE);
		expect(model.getTime()).toBe('2026-05-22T00:00:00-07:00');
	});

	it('projects the root observer to finite Earth coordinates', () => {
		const observer = createModel().projectObserver();

		expect(observer.kind).toBe('observer');
		expect(observer.visible).toBeTrue();
		expectFiniteVector(observer.position);
		expect(Number.isFinite(observer.projected.radius)).toBeTrue();
	});

	it('projects the north celestial pole to the top of the dome', () => {
		const star = createModel().projectStar({
			id: 'ncp',
			name: 'North celestial pole',
			raDeg: 0,
			decDeg: 90,
			magnitude: 2,
		});

		expect(star.visible).toBeTrue();
		expect(star.projected.radius).toBeCloseTo(0, 8);
		expect(star.position.x).toBeCloseTo(0, 8);
		expect(star.position.y).toBeCloseTo(EARTH_PROJECTION_RADIUS_KM, 8);
		expect(star.position.z).toBeCloseTo(0, 8);
	});

	it('maps the celestial equator to half the dome radius with the default full-sphere mapping', () => {
		const star = createModel().projectStar({
			id: 'equator',
			name: 'Equator reference',
			raDeg: 90,
			decDeg: 0,
			magnitude: 2,
		});

		expect(star.visible).toBeTrue();
		expect(star.projected.radius).toBeCloseTo(EARTH_PROJECTION_RADIUS_KM / 2, 8);
		expect(star.position.x).toBeCloseTo(EARTH_PROJECTION_RADIUS_KM / Math.sqrt(2), 8);
		expect(star.position.y).toBeCloseTo(EARTH_PROJECTION_RADIUS_KM / Math.sqrt(2), 8);
		expect(star.position.z).toBeCloseTo(0, 8);
	});
});
