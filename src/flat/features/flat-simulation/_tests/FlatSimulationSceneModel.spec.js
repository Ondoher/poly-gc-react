import {
	CLEAR_DAY_EARTH_ATMOSPHERE,
} from '../../../shared/consts.js';
import {
	DEFAULT_FLAT_SIMULATION_CONFIG,
	DEFAULT_ATMOSPHERE,
	DEFAULT_EARTH_FLOOR_TEXTURE,
	DEFAULT_FALSE_SUN_LATITUDE_MODEL,
	DEFAULT_OBSERVER_VIEW,
	DEFAULT_FLAT_SIMULATION_SUN,
	EARTH_PROJECTION_RADIUS_KM,
	FALSE_SUN_LIGHT_INTENSITY,
	KM_PER_MILE,
	MEAN_EARTH_RADIUS_KM,
	SIDEREAL_DAY_DISPLAY_SECONDS,
	SIDEREAL_DAY_HOURS,
	SOLAR_DAY_DISPLAY_SECONDS,
	SOLAR_DAY_HOURS,
} from '../models/consts.js';
import FlatSimulationSceneModel from '../models/FlatSimulationSceneModel.js';
import {
	resolveAnimatedAtmosphereSun,
	resolveAnimatedSun,
} from '../models/sun-animation.js';
import { resolveFalseSunLatitudeDeg } from '../models/sun-latitude.js';

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

describe('FlatSimulationSceneModel', () => {
	it('uses San Jose and the Phase 1 midnight timestamp by default', () => {
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.root).toEqual(DEFAULT_FLAT_SIMULATION_CONFIG.root);
		expect(scene.root.elevationMeters).toBeCloseTo(30.48, 8);
		expect(scene.time).toBe('2026-05-22T00:00:00-07:00');
	});

	it('describes the flat-simulation projection configuration', () => {
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.model.earthProjection).toBe('north-pole-azimuthal-equidistant');
		expect(scene.model.celestialProjection).toBe('north-celestial-pole-azimuthal-equidistant');
		expect(scene.model.skySurfaceProjection).toBe('upper-hemisphere-radial-lift');
	});

	it('projects the observer and fixture stars into finite scene positions', () => {
		const scene = new FlatSimulationSceneModel().createScene();

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
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.model.options.meanEarthRadiusKm).toBe(MEAN_EARTH_RADIUS_KM);
		expect(scene.earth.radiusKm).toBe(EARTH_PROJECTION_RADIUS_KM);
		expect(scene.dome.radiusKm).toBe(EARTH_PROJECTION_RADIUS_KM);
	});

	it('uses the azimuthal equidistant floor texture with the scene projection orientation', () => {
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.earth.floorTexture).toEqual(DEFAULT_EARTH_FLOOR_TEXTURE);
		expect(scene.earth.floorTexture.url).toBe('assets/images/natural-earth-2-50m.jpg');
		expect(scene.earth.floorTexture.sourceProjection).toBe('equirectangular');
		expect(scene.earth.floorTexture.floorProjection).toBe(scene.model.earthProjection);
		expect(scene.earth.floorTexture.textureRotationRad).toBe(0);
	});

	it('exposes shared atmosphere settings without the old haze shell', () => {
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.atmosphere).toEqual(DEFAULT_ATMOSPHERE);
		expect(scene.atmosphere.enabled).toBeTrue();
		expect(scene.atmosphere.model).toBe('shared-atmosphere');
		expect(scene.atmosphere.frame.kind).toBe('flat-slab');
		expect(scene.atmosphere.profile).toEqual(CLEAR_DAY_EARTH_ATMOSPHERE);
		expect(scene.atmosphere.profile.id).toBe('earth-clear-day');
		expect(scene.atmosphere.profile.aerosolOpticalDepth550nm).toBe(0.08);
		expect(scene.atmosphere.profile.aerosolSingleScatteringAlbedo).toBe(0.95);
		expect(scene.atmosphere.profile.aerosolAngstromExponent).toBe(1.3);
		expect(scene.atmosphere.rendering.status).toBe('depth-aware-composer-clear-day-atmosphere');
		expect(scene.atmosphere.rendering.target).toBe('depth-aware-composition');
		expect(scene.atmosphere.rendering.debugMode).toBe('none');
		expect(scene.atmosphere.rendering.falseSunRadiance).toEqual({
			model: 'point-inverse-square-reference',
			referenceDistanceKm: 4800,
			distanceFalloff: true,
		});
		expect(scene.atmosphere.rendering.threeLightUnitScale).toBe(0.04);
		expect(scene.atmosphere.rendering.skyDiffuseIrradianceScale).toBe(0.35);
		expect(scene.atmosphere.rendering.sampleToSunTransmittanceModel).toBe('air-mass');
		expect(scene.atmosphere.rendering.sampleToSunTransmittanceSteps).toBe(4);
		expect(scene.atmosphere.rendering.backgroundAtmosphereViewDistanceKm).toBe(100);
		expect(scene.atmosphere.rendering.flatSlabHorizonViewDistanceFactor).toBe(0.25);
		expect(scene.atmosphere.rendering.starExposure).toBe(0.02);
		expect(scene.atmosphere.rendering.constellationOverlayExposure).toBe(0.04);
		expect(scene.atmosphere.fullOpacityDistanceKm).toBeUndefined();
		expect(scene.atmosphere.seaLevelDensity).toBeUndefined();
		expect(scene.atmosphere.atmosphereHeightKm).toBeUndefined();
	});

	it('uses the San Jose observer camera by default', () => {
		const scene = new FlatSimulationSceneModel().createScene();

		expect(scene.camera).toBeNull();
		expect(scene.root).toEqual(DEFAULT_FLAT_SIMULATION_CONFIG.root);
		expectFiniteVector(scene.observer.position);
		expect(scene.observer.view).toEqual(DEFAULT_OBSERVER_VIEW);
		expect(scene.observer.position.y).toBeCloseTo(0.03048, 8);
		expect(scene.observer.view.altitudeKm).toBe(0);
	});

	it('places deterministic mountain simulation rectangles around the observer', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const mountains = scene.objects.filter((object) => object.role === 'mountain-simulation');
		const expectedDistancesMiles = Array.from({ length: 21 }, (_, index) => 1 + (index * 5));
		const expectedBearingsDeg = expectedDistancesMiles.map((_, index) => {
			const bearingIndex = index % 8;
			const ringIndex = Math.floor(index / 8);

			return ((bearingIndex * 45) + (ringIndex * 10)) % 360;
		});

		expect(mountains.length).toBe(22);
		expect(mountains[0].source.role).toBe('stray-near-field-calibration');
		expect(mountains[0].source.distanceMiles).toBe(0.5);
		expect(mountains[0].source.bearingDeg).toBe(22.5);
		expect(horizontalDistanceBetween(scene.observer.position, mountains[0].position))
			.toBeCloseTo(0.5 * KM_PER_MILE, 8);

		for (const [index, mountain] of mountains.slice(1).entries()) {
			expect(mountain.kind).toBe('box');
			expect(mountain.visible).toBeTrue();
			expectFiniteVector(mountain.position);
			expectFiniteVector(mountain.size);
			expect(mountain.position.y).toBeCloseTo(mountain.size.y / 2, 8);
			expect(mountain.size.y).toBeCloseTo(2000 * 0.0003048, 8);
			expect(mountain.size.x).toBeCloseTo(mountain.size.y * 5, 8);
			expect(mountain.size.z).toBeCloseTo(mountain.size.y * 10, 8);
			expect(mountain.style.color).toBe('#ff0000');
			expect(mountain.source.heightFeet).toBe(2000);
			expect(mountain.source.distanceMiles).toBeGreaterThanOrEqual(0.5);
			expect(mountain.source.distanceMiles).toBeLessThanOrEqual(101);
			expect(mountain.source.distanceMiles).toBe(expectedDistancesMiles[index]);
			expect(mountain.source.bearingDeg).toBe(expectedBearingsDeg[index]);
			expect(horizontalDistanceBetween(scene.observer.position, mountain.position))
				.toBeCloseTo(expectedDistancesMiles[index] * KM_PER_MILE, 8);
		}
	});

	it('keeps Florida to the observer-camera east when San Jose looks north', () => {
		const model = new FlatSimulationSceneModel().createProjectionModel();
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

	it('formalizes the flat-simulation sun as a visible body and point light', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const sphere = scene.objects.find((object) => object.id === 'false-sun');
		const observerDistanceKm = distanceBetween(scene.observer.position, sphere.position);
		const apparentAngularRadiusRad = Math.asin(sphere.radiusKm / observerDistanceKm);
		const resolvedSun = resolveAnimatedSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});
		const atmosphereSun = resolveAnimatedAtmosphereSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});

		expect(scene.sun.id).toBe('false-sun');
		expect(scene.sun.kind).toBe('sun');
		expect(scene.sun.object).toBe(sphere);
		expect(sphere.kind).toBe('sphere');
		expect(sphere.role).toBe('sun');
		expect(scene.sun.rendering).toEqual(DEFAULT_FLAT_SIMULATION_SUN.rendering);
		expect(sphere.rendering).toEqual(DEFAULT_FLAT_SIMULATION_SUN.rendering);
		expect(sphere.rendering.renderBody).toBeTrue();
		expectFiniteVector(sphere.position);
		expect(sphere.radiusKm).toBeCloseTo(16 * KM_PER_MILE, 8);
		expect(sphere.position.y).toBeCloseTo(3000 * KM_PER_MILE, 8);
		expect(scene.sun.apparent).toBe(sphere.apparent);
		expect(scene.sun.apparent.distanceKm).toBeCloseTo(observerDistanceKm, 8);
		expect(scene.sun.apparent.angularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(scene.sun.apparent.angularDiameterRad).toBeCloseTo(apparentAngularRadiusRad * 2, 8);
		expect(sphere.source.lat).toBeCloseTo(
			resolveFalseSunLatitudeDeg(DEFAULT_FLAT_SIMULATION_SUN, scene.time),
			8,
		);
		expect(sphere.source.latitude).toEqual(DEFAULT_FALSE_SUN_LATITUDE_MODEL);
		expect(sphere.source.latitudeResolvedAt).toBe(scene.time);
		expect(sphere.source.lon).toBeCloseTo(DEFAULT_FLAT_SIMULATION_CONFIG.root.lon + 180, 8);
		expect(sphere.style).toEqual(DEFAULT_FLAT_SIMULATION_SUN.style);
		expect(sphere.animation).toEqual({
			type: 'solar-day-latitude-ring-rotation',
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		});
		expect(scene.sun.atmosphere).toEqual(DEFAULT_FLAT_SIMULATION_SUN.atmosphere);
		expect(scene.lighting.sun).toEqual(resolvedSun.light);
		expect(scene.lighting.sun.kind).toBe('point');
		expect(scene.lighting.sun.position).toEqual(resolvedSun.position);
		expect(scene.lighting.sun.radiusKm).toBe(resolvedSun.radiusKm);
		expect(scene.lighting.sun.intensity).toBe(FALSE_SUN_LIGHT_INTENSITY);
		expect(scene.lighting.sun.anchor.kind).toBe('flat-simulation-visible-sun');
		expect(scene.lighting.atmosphereSun).toEqual(atmosphereSun);
		expect(scene.lighting.atmosphereSun.kind).toBe('point');
		expect(scene.lighting.atmosphereSun.position).toEqual(scene.lighting.sun.position);
		expect(scene.lighting.atmosphereSun.radiusKm).toBe(scene.lighting.sun.radiusKm);
		expect(scene.lighting.atmosphereSun.apparentAngularRadiusRad)
			.toBe(scene.lighting.sun.apparentAngularRadiusRad);
		expect(scene.lighting.atmosphereSun.color).toEqual(DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color);
		expect(scene.lighting.atmosphereSun.intensity).toBe(1);
		expect(scene.lighting.atmosphereSun.solarIrradianceScale).toBe(58);
		expect(scene.lighting.atmosphereSun.anchor.kind).toBe('flat-simulation-visible-sun-atmosphere');
	});

	it('keeps atmosphere radiance configurable on the visible false sun', () => {
		const scene = new FlatSimulationSceneModel({
			sun: {
				atmosphere: {
					color: { r: 0.9, g: 0.95, b: 1 },
					intensity: 2,
					solarIrradianceScale: 75,
					anchor: {
						kind: 'test-atmosphere-sun',
					},
				},
			},
		}).createScene();
		const resolvedSun = resolveAnimatedSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});

		expect(scene.sun.light.color).toEqual(DEFAULT_FLAT_SIMULATION_SUN.light.color);
		expect(scene.sun.light.intensity).toBe(FALSE_SUN_LIGHT_INTENSITY);
		expect(scene.lighting.sun).toEqual(resolvedSun.light);
		expect(scene.lighting.atmosphereSun.kind).toBe('point');
		expect(scene.lighting.atmosphereSun.position).toEqual(scene.lighting.sun.position);
		expect(scene.lighting.atmosphereSun.radiusKm).toBe(scene.lighting.sun.radiusKm);
		expect(scene.lighting.atmosphereSun.color).toEqual({ r: 0.9, g: 0.95, b: 1 });
		expect(scene.lighting.atmosphereSun.intensity).toBe(2);
		expect(scene.lighting.atmosphereSun.solarIrradianceScale).toBe(75);
		expect(scene.lighting.atmosphereSun.anchor.kind).toBe('test-atmosphere-sun');
		expect(scene.lighting.atmosphereSun.anchor.status).toBe('open');
	});

	it('derives atmosphere scattering from the resolved visible false sun', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const atmosphereSun = resolveAnimatedAtmosphereSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});

		expect(scene.lighting.atmosphereSun.kind).toBe('point');
		expect(scene.lighting.atmosphereSun).toEqual(atmosphereSun);
		expect(scene.lighting.atmosphereSun.position).toEqual(scene.lighting.sun.position);
		expect(scene.lighting.atmosphereSun.color).toEqual(DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color);
		expect(scene.lighting.atmosphereSun.intensity).toBe(1);
		expect(scene.lighting.atmosphereSun.solarIrradianceScale).toBe(58);
		expect(scene.lighting.atmosphereSun.anchor.kind).toBe('flat-simulation-visible-sun-atmosphere');
		expect(scene.lighting.atmosphereSun.anchor.status).toBe('open');
	});

	it('keeps false-sun latitude, elevation, and radius configurable', () => {
		const scene = new FlatSimulationSceneModel({
			sun: {
				latitude: {
					type: 'fixed-latitude',
					latitudeDeg: 12,
				},
				altitudeKm: 1200,
				radiusKm: 40,
			},
		}).createScene();
		const sphere = scene.sun.object;
		const observerDistanceKm = distanceBetween(scene.observer.position, sphere.position);
		const apparentAngularRadiusRad = Math.asin(sphere.radiusKm / observerDistanceKm);
		const resolvedSun = resolveAnimatedSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});

		expect(scene.sun.source.lat).toBe(12);
		expect(scene.sun.source.altitudeKm).toBe(1200);
		expect(scene.sun.source.diameterKm).toBe(80);
		expect(sphere.radiusKm).toBe(40);
		expect(sphere.position.y).toBe(1200);
		expect(scene.lighting.sun.radiusKm).toBe(40);
		expect(scene.sun.light.distanceKm).toBeCloseTo(observerDistanceKm, 8);
		expect(scene.sun.light.apparentAngularRadiusRad).toBeCloseTo(apparentAngularRadiusRad, 8);
		expect(scene.lighting.sun).toEqual(resolvedSun.light);
	});

	it('migrates the false-sun latitude between the tropics over the year', () => {
		expect(resolveFalseSunLatitudeDeg(DEFAULT_FLAT_SIMULATION_SUN, '2026-06-21T00:00:00-07:00'))
			.toBeCloseTo(23.5, 2);
		expect(resolveFalseSunLatitudeDeg(DEFAULT_FLAT_SIMULATION_SUN, '2026-12-21T00:00:00-08:00'))
			.toBeCloseTo(-23.5, 2);
		expect(resolveFalseSunLatitudeDeg(DEFAULT_FLAT_SIMULATION_SUN, DEFAULT_FLAT_SIMULATION_CONFIG.time))
			.toBeGreaterThan(0);
	});

	it('defines separate solar and sidereal animation periods', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const fixedSun = resolveAnimatedSun(scene.sun, scene.animation.playback.fixedSolarRotationAngleRad, {
			observerPosition: scene.observer.position,
		});
		const oppositeSun = resolveAnimatedSun(
			scene.sun,
			scene.animation.playback.fixedSolarRotationAngleRad + Math.PI,
			{ observerPosition: scene.observer.position },
		);

		expect(scene.animation.playback.mode).toBe('fixed');
		expect(scene.animation.playback.reason).toBe('closest-false-sun-to-observer');
		expect(scene.animation.playback.fixedSolarRotationAngleRad).toBeGreaterThanOrEqual(0);
		expect(scene.animation.playback.fixedSolarRotationAngleRad).toBeLessThan(Math.PI * 2);
		expect(fixedSun.light.distanceKm).toBeLessThan(oppositeSun.light.distanceKm);
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
		const scene = new FlatSimulationSceneModel().createScene();

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
