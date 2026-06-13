import {
	DEFAULT_FALSE_SIMULATION_CONFIG,
	DEFAULT_ATMOSPHERE,
	DEFAULT_EARTH_FLOOR_TEXTURE,
	DEFAULT_OBSERVER_VIEW,
	DEFAULT_FALSE_SIMULATION_SUN,
	EARTH_PROJECTION_RADIUS_KM,
	FALSE_SUN_LIGHT_INTENSITY,
	KM_PER_MILE,
	MEAN_EARTH_RADIUS_KM,
	SIDEREAL_DAY_DISPLAY_SECONDS,
	SIDEREAL_DAY_HOURS,
	SOLAR_DAY_DISPLAY_SECONDS,
	SOLAR_DAY_HOURS,
} from '../models/consts.js';
import FalseSimulationSceneModel from '../models/FalseSimulationSceneModel.js';
import { createMountainSimulationRectangles } from '../models/mountain-simulation.js';
import Random from '../../../../gc/utils/random.js';

function expectFiniteVector(vector) {
	expect(Number.isFinite(vector.x)).toBeTrue();
	expect(Number.isFinite(vector.y)).toBeTrue();
	expect(Number.isFinite(vector.z)).toBeTrue();
}

function horizontalUnitVector(from, to) {
	const x = to.x - from.x;
	const z = to.z - from.z;
	const length = Math.hypot(x, z);

	return {
		x: x / length,
		z: z / length,
	};
}

function horizontalDot(a, b) {
	return a.x * b.x + a.z * b.z;
}

function distanceBetween(left, right) {
	return Math.hypot(
		right.x - left.x,
		right.y - left.y,
		right.z - left.z,
	);
}

function horizontalDistanceBetween(left, right) {
	return Math.hypot(
		right.x - left.x,
		right.z - left.z,
	);
}

describe('FalseSimulationSceneModel', () => {
	it('uses San Jose and the Phase 1 midnight timestamp by default', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.root).toEqual(DEFAULT_FALSE_SIMULATION_CONFIG.root);
		expect(scene.root.elevationMeters).toBeCloseTo(30.48, 8);
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

	it('uses the azimuthal equidistant floor texture with the scene projection orientation', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.earth.floorTexture).toEqual(DEFAULT_EARTH_FLOOR_TEXTURE);
		expect(scene.earth.floorTexture.url).toBe('assets/images/natural-earth-2-50m.jpg');
		expect(scene.earth.floorTexture.sourceProjection).toBe('equirectangular');
		expect(scene.earth.floorTexture.floorProjection).toBe(scene.model.earthProjection);
		expect(scene.earth.floorTexture.textureRotationRad).toBe(0);
	});

	it('exposes shared atmosphere settings without the old haze shell', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.atmosphere).toEqual(DEFAULT_ATMOSPHERE);
		expect(scene.atmosphere.enabled).toBeTrue();
		expect(scene.atmosphere.model).toBe('shared-atmosphere');
		expect(scene.atmosphere.frame.kind).toBe('flat-slab');
		expect(scene.atmosphere.profile.id).toBe('earth-standard');
		expect(scene.atmosphere.rendering.status).toBe('depth-aware-composer-first-pass');
		expect(scene.atmosphere.rendering.target).toBe('depth-aware-composition');
		expect(scene.atmosphere.rendering.shellExposure).toBe(36);
		expect(scene.atmosphere.rendering.shellOpacity).toBe(18);
		expect(scene.atmosphere.fullOpacityDistanceKm).toBeUndefined();
		expect(scene.atmosphere.seaLevelDensity).toBeUndefined();
		expect(scene.atmosphere.atmosphereHeightKm).toBeUndefined();
	});

	it('uses the San Jose observer camera by default', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.camera).toBeNull();
		expect(scene.root).toEqual(DEFAULT_FALSE_SIMULATION_CONFIG.root);
		expectFiniteVector(scene.observer.position);
		expect(scene.observer.view).toEqual(DEFAULT_OBSERVER_VIEW);
		expect(scene.observer.position.y).toBeCloseTo(0.03048, 8);
		expect(scene.observer.view.altitudeKm).toBe(0);
	});

	it('places deterministic mountain simulation rectangles around the observer', () => {
		const scene = new FalseSimulationSceneModel().createScene();
		const mountains = scene.objects.filter((object) => object.role === 'mountain-simulation');
		const colors = new Set(['#ff0000', '#ffff00', '#0000ff', '#00ff00', '#ff8000', '#8000ff']);

		expect(mountains.length).toBe(200);

		for (const mountain of mountains) {
			expect(mountain.kind).toBe('box');
			expect(mountain.visible).toBeTrue();
			expectFiniteVector(mountain.position);
			expectFiniteVector(mountain.size);
			expect(mountain.position.y).toBeCloseTo(mountain.size.y / 2, 8);
			expect(horizontalDistanceBetween(scene.observer.position, mountain.position)).toBeGreaterThanOrEqual(KM_PER_MILE);
			expect(horizontalDistanceBetween(scene.observer.position, mountain.position)).toBeLessThanOrEqual(100 * KM_PER_MILE);
			expect(mountain.size.y).toBeGreaterThanOrEqual(500 * 0.0003048);
			expect(mountain.size.y).toBeLessThanOrEqual(3000 * 0.0003048);
			expect(mountain.size.x).toBeCloseTo(mountain.size.y * 5, 8);
			expect(mountain.size.z).toBeCloseTo(mountain.size.y * 10, 8);
			expect(colors.has(mountain.style.color)).toBeTrue();
			expect(mountain.source.heightFeet).toBeGreaterThanOrEqual(500);
			expect(mountain.source.heightFeet).toBeLessThanOrEqual(3000);
			expect(mountain.source.distanceMiles).toBeGreaterThanOrEqual(1);
			expect(mountain.source.distanceMiles).toBeLessThanOrEqual(100);
		}
	});

	it('does not leak mountain generation seed state into the shared Random module', () => {
		Random.randomize(12345);
		const expectedNext = Random.random();

		Random.randomize(12345);
		createMountainSimulationRectangles({ seed: 67890 });

		expect(Random.random()).toBe(expectedNext);
	});

	it('keeps Florida to the observer-camera east when San Jose looks north', () => {
		const model = new FalseSimulationSceneModel().createProjectionModel();
		const observer = model.projectObserver();
		const florida = model.projectEarthPoint({
			lat: 27.9944024,
			lon: -81.7602544,
			elevationMeters: 0,
		});
		const forwardToNorthPole = horizontalUnitVector(observer.position, { x: 0, z: 0 });
		const cameraRight = {
			x: -forwardToNorthPole.z,
			z: forwardToNorthPole.x,
		};
		const observerToFlorida = horizontalUnitVector(observer.position, florida.position);

		expect(horizontalDot(observerToFlorida, cameraRight)).toBeGreaterThan(0);
	});

	it('formalizes the false-simulation sun as a visible body and point light', () => {
		const scene = new FalseSimulationSceneModel().createScene();
		const sphere = scene.objects.find((object) => object.id === 'false-sun');
		const observerDistanceKm = distanceBetween(scene.observer.position, sphere.position);
		const apparentAngularRadiusRad = Math.asin(sphere.radiusKm / observerDistanceKm);

		expect(scene.sun.id).toBe('false-sun');
		expect(scene.sun.kind).toBe('sun');
		expect(scene.sun.object).toBe(sphere);
		expect(sphere.kind).toBe('sphere');
		expect(sphere.role).toBe('sun');
		expect(scene.sun.rendering).toEqual(DEFAULT_FALSE_SIMULATION_SUN.rendering);
		expect(sphere.rendering).toEqual(DEFAULT_FALSE_SIMULATION_SUN.rendering);
		expect(sphere.rendering.renderBody).toBeTrue();
		expectFiniteVector(sphere.position);
		expect(sphere.radiusKm).toBeCloseTo(16 * KM_PER_MILE, 8);
		expect(sphere.position.y).toBeCloseTo(3000 * KM_PER_MILE, 8);
		expect(scene.sun.apparent).toBe(sphere.apparent);
		expect(scene.sun.apparent.distanceKm).toBeCloseTo(observerDistanceKm, 8);
		expect(scene.sun.apparent.angularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(scene.sun.apparent.angularDiameterRad).toBeCloseTo(apparentAngularRadiusRad * 2, 8);
		expect(sphere.source.lat).toBe(24);
		expect(sphere.source.lon).toBeCloseTo(DEFAULT_FALSE_SIMULATION_CONFIG.root.lon + 180, 8);
		expect(sphere.style).toEqual(DEFAULT_FALSE_SIMULATION_SUN.style);
		expect(sphere.animation).toEqual({
			type: 'solar-day-fixed-latitude-rotation',
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		});
		expect(scene.lighting.sun).toEqual(scene.sun.light);
		expect(scene.lighting.sun.kind).toBe('point');
		expect(scene.lighting.sun.position).toEqual(sphere.position);
		expect(scene.lighting.sun.radiusKm).toBe(sphere.radiusKm);
		expect(scene.lighting.sun.distanceKm).toBeCloseTo(observerDistanceKm, 8);
		expect(scene.lighting.sun.apparentAngularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(scene.lighting.sun.apparentAngularDiameterRad).toBeCloseTo(apparentAngularRadiusRad * 2, 8);
		expect(scene.lighting.sun.intensity).toBe(FALSE_SUN_LIGHT_INTENSITY);
		expect(scene.lighting.sun.anchor.kind).toBe('false-simulation-visible-sun');
	});

	it('keeps false-sun latitude, elevation, and radius configurable', () => {
		const scene = new FalseSimulationSceneModel({
			sun: {
				lat: 12,
				altitudeKm: 1200,
				radiusKm: 40,
			},
		}).createScene();
		const sphere = scene.sun.object;
		const observerDistanceKm = distanceBetween(scene.observer.position, sphere.position);
		const apparentAngularRadiusRad = Math.asin(sphere.radiusKm / observerDistanceKm);

		expect(scene.sun.source.lat).toBe(12);
		expect(scene.sun.source.altitudeKm).toBe(1200);
		expect(scene.sun.source.diameterKm).toBe(80);
		expect(sphere.radiusKm).toBe(40);
		expect(sphere.position.y).toBe(1200);
		expect(scene.lighting.sun.radiusKm).toBe(40);
		expect(scene.lighting.sun.distanceKm).toBeCloseTo(observerDistanceKm, 8);
		expect(scene.lighting.sun.apparentAngularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
	});

	it('defines separate solar and sidereal animation periods', () => {
		const scene = new FalseSimulationSceneModel().createScene();

		expect(scene.animation.solarDay).toEqual({
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		});
		expect(scene.animation.solarDay.displayDurationSeconds).toBe(40);
		expect(scene.animation.siderealDay).toEqual({
			simulatedDurationHours: SIDEREAL_DAY_HOURS,
			displayDurationSeconds: SIDEREAL_DAY_DISPLAY_SECONDS,
		});
		expect(scene.animation.siderealDay.displayDurationSeconds).toBeCloseTo(39.89078266666667, 8);
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
