import FalseSimulationSceneModel, {
	DEFAULT_FALSE_SIMULATION_CONFIG,
	DEFAULT_ATMOSPHERE,
	EARTH_PROJECTION_RADIUS_KM,
	KARMAN_LINE_KM,
	KM_PER_MILE,
	MEAN_EARTH_RADIUS_KM,
	SIDEREAL_DAY_DISPLAY_SECONDS,
	SIDEREAL_DAY_HOURS,
	SOLAR_DAY_DISPLAY_SECONDS,
	SOLAR_DAY_HOURS,
} from '../models/FalseSimulationSceneModel.js';

function expectFiniteVector(vector) {
	expect(Number.isFinite(vector.x)).toBeTrue();
	expect(Number.isFinite(vector.y)).toBeTrue();
	expect(Number.isFinite(vector.z)).toBeTrue();
}

describe('FalseSimulationSceneModel', () => {
	it('uses San Jose and the Phase 1 midnight timestamp by default', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.root).toEqual(DEFAULT_FALSE_SIMULATION_CONFIG.root);
		expect(scene.time).toBe('2026-05-22T00:00:00-07:00');
	});

	it('describes the false-simulation projection configuration', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.model.earthProjection).toBe('north-pole-azimuthal-equidistant');
		expect(scene.model.celestialProjection).toBe('north-celestial-pole-azimuthal-equidistant');
		expect(scene.model.skySurfaceProjection).toBe('upper-hemisphere-radial-lift');
	});

	it('projects the observer and fixture stars into finite scene positions', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expectFiniteVector(scene.observer.position);
		expect(scene.stars.length).toBeGreaterThan(10);

		for (const star of scene.stars) {
			expect(star.kind).toBe('star');
			expect(star.id).toEqual(jasmine.any(String));
			expectFiniteVector(star.position);
			expect(star.visible).toEqual(jasmine.any(Boolean));
		}
	});

	it('exposes plain Earth and dome scene dimensions', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.model.options.meanEarthRadiusKm).toBe(MEAN_EARTH_RADIUS_KM);
		expect(scene.earth.radiusKm).toBe(EARTH_PROJECTION_RADIUS_KM);
		expect(scene.dome.radiusKm).toBe(EARTH_PROJECTION_RADIUS_KM);
	});

	it('exposes altitude-sensitive atmosphere haze settings', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.atmosphere).toEqual(DEFAULT_ATMOSPHERE);
		expect(scene.atmosphere.enabled).toBeFalse();
		expect(scene.atmosphere.fullOpacityDistanceKm).toBeCloseTo(300 * KM_PER_MILE, 8);
		expect(scene.atmosphere.seaLevelDensity).toBe(1);
		expect(scene.atmosphere.atmosphereHeightKm).toBe(KARMAN_LINE_KM);
		expect(scene.atmosphere.opacity).toBe(1);
	});

	it('uses the San Jose observer camera by default', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.camera).toBeNull();
		expect(scene.root).toEqual(DEFAULT_FALSE_SIMULATION_CONFIG.root);
		expectFiniteVector(scene.observer.position);
	});

	it('includes the orange altitude reference sphere', () => {
		const scene = new FalseSimulationSceneModel().createScene();
		const sphere = scene.objects.find((object) => object.id === 'orange-reference-sphere');

		expect(sphere.kind).toBe('sphere');
		expectFiniteVector(sphere.position);
		expect(sphere.radiusKm).toBeCloseTo(16 * KM_PER_MILE, 8);
		expect(sphere.position.y).toBeCloseTo(3000 * KM_PER_MILE, 8);
		expect(sphere.source.lat).toBe(24);
		expect(sphere.source.lon).toBeCloseTo(DEFAULT_FALSE_SIMULATION_CONFIG.root.lon + 180, 8);
		expect(sphere.style.color).toBe('#ff8a1f');
		expect(sphere.animation).toEqual({
			type: 'solar-day-fixed-latitude-rotation',
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		});
	});

	it('defines separate solar and sidereal animation periods', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.animation.solarDay).toEqual({
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		});
		expect(scene.animation.siderealDay).toEqual({
			simulatedDurationHours: SIDEREAL_DAY_HOURS,
			displayDurationSeconds: SIDEREAL_DAY_DISPLAY_SECONDS,
		});
		expect(scene.animation.siderealDay.displayDurationSeconds).toBeLessThan(scene.animation.solarDay.displayDurationSeconds);
	});

	it('projects red constellation overlays from available fixture stars', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.constellations.map((constellation) => constellation.id)).toEqual([
			'big-dipper',
			'little-dipper',
			'orion',
			'southern-cross',
		]);

		for (const constellation of scene.constellations) {
			expect(constellation.color).toBe('#ff3030');
			expect(constellation.segments.length).toBeGreaterThan(0);

			for (const segment of constellation.segments) {
				expect(segment.visible).toEqual(jasmine.any(Boolean));
				expectFiniteVector(segment.points[0]);
				expectFiniteVector(segment.points[1]);
			}
		}
	});
});
