import GlobeSimulationSceneModel from '../models/GlobeSimulationSceneModel.js';

describe('GlobeSimulationSceneModel', () => {
	const fixedTime = '2026-06-13T13:07:44-07:00';
	const KM_PER_MILE = 1.609344;

	function expectFiniteVector(vector) {
		expect(Number.isFinite(vector.x)).toBeTrue();
		expect(Number.isFinite(vector.y)).toBeTrue();
		expect(Number.isFinite(vector.z)).toBeTrue();
	}

	function vectorLength(vector) {
		return Math.hypot(vector.x, vector.y, vector.z);
	}

	function dotVectors(left, right) {
		return left.x * right.x + left.y * right.y + left.z * right.z;
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function addScaledVectors(terms) {
		return terms.reduce((sum, term) => ({
			x: sum.x + term.vector.x * term.scale,
			y: sum.y + term.vector.y * term.scale,
			z: sum.z + term.vector.z * term.scale,
		}), { x: 0, y: 0, z: 0 });
	}

	it('creates a spherical Sun atmosphere calibration scene', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();

		expect(scene.id).toBe('globe-simulation-sun-atmosphere');
		expect(scene.geometry.kind).toBe('spherical-earth');
		expect(scene.atmosphere.frame.kind).toBe('spherical-shell');
		expect(scene.scope.celestialObjects).toEqual(['sun', 'northern-bright-stars']);
	});

	it('defaults to the fixed San Jose solar-noon calibration time', () => {
		const scene = new GlobeSimulationSceneModel().createScene();

		expect(scene.time).toBe('2026-06-13T20:07:44.000Z');
		expect(scene.sun.altitudeDeg).toBeGreaterThan(75);
		expect(scene.sun.altitudeDeg).toBeLessThan(77);
	});

	it('positions the Sun at an AU-scale distance in three-dimensional space', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const direction = scene.sun.direction;
		const position = scene.sun.position;
		const length = Math.hypot(direction.x, direction.y, direction.z);
		const sunDistance = Math.hypot(position.x, position.y, position.z);

		expect(length).toBeCloseTo(1, 8);
		expect(sunDistance).toBeCloseTo(scene.sun.distanceKm, 3);
		expect(scene.sun.distanceKm).toBeGreaterThan(147000000);
		expect(scene.sun.distanceKm).toBeLessThan(153000000);
		expect(scene.sun.radiusKm).toBe(696340);
		expect(scene.sun.apparentAngularDiameterRad).toBeCloseTo(0.0093, 3);
	});

	it('uses Earth-like solar source defaults for calibration', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();

		expect(scene.sun.source.model).toBe('approximate-real-solar-system');
		expect(scene.sun.source.totalSolarIrradianceWm2).toBe(1361);
		expect(scene.sun.source.colorTemperatureK).toBe(5778);
		expect(scene.sun.source.targetDirectNormalIrradianceWm2AtReferencePoint).toBe(1000);
		expect(scene.sun.source.rendererBridge.model)
			.toBe('temporary-irradiance-to-scattering-source-scale');
	});

	it('exposes display settings separately from atmosphere and solar probes', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();

		expect(scene.display).toEqual({
			model: 'radiometric-display-v1',
			radiometricToSceneRgbScale:
				1 / scene.sun.source.rendererIrradianceReferenceWm2,
			exposure: 1,
			toneMapping: 'reinhard',
		});
		expect(Object.isFrozen(scene.display)).toBeTrue();
		expect(scene.display).not.toBe(scene.atmosphere);
		expect(scene.display).not.toBe(scene.sun.irradiance);
		expect(scene.atmosphere.display).toBeUndefined();
		expect(scene.sun.irradiance.display).toBeUndefined();
	});

	it('derives solar irradiance probes from physical source values', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const irradiance = scene.sun.irradiance;

		expect(irradiance.model).toBe('single-scattering-clear-sky-probes');
		expect(irradiance.shadowed).toBeFalse();
		expect(irradiance.topOfAtmosphereIrradianceWm2).toBeGreaterThan(1300);
		expect(irradiance.topOfAtmosphereIrradianceWm2).toBeLessThan(1400);
		expect(irradiance.directNormalIrradianceAtObserverWm2).toBeGreaterThan(900);
		expect(irradiance.directNormalIrradianceAtObserverWm2).toBeLessThan(1150);
		expect(irradiance.directHorizontalIrradianceAtObserverWm2)
			.toBeLessThan(irradiance.directNormalIrradianceAtObserverWm2);
		expect(irradiance.estimatedDiffuseSkyIrradianceWm2).toBeGreaterThan(0);
		expect(irradiance.relativeAirMass).toBeGreaterThan(1);
		expect(irradiance.visibleTransmittance).toBeGreaterThan(0);
		expect(irradiance.visibleTransmittance).toBeLessThan(1);
		expect(irradiance.transmittance.b).toBeLessThan(irradiance.transmittance.r);
		expect(scene.sun.solarIrradianceScale)
			.toBe(irradiance.renderer.atmosphereSourceScale);
		expect(irradiance.renderer.atmosphereSourceScale)
			.toBeCloseTo(
				irradiance.topOfAtmosphereIrradianceWm2
					/ scene.sun.source.rendererIrradianceReferenceWm2,
				8,
			);
	});

	it('uses a matte green featureless globe surface', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();

		expect(scene.surface.material).toEqual({
			model: 'matte-solid-color',
			color: '#3f7f45',
			roughness: 1,
			metalness: 0,
			surfaceFeatures: false,
		});
	});

	it('places the 50 brightest northern-hemisphere fixture stars with magnitude flux', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const stars = scene.stars;

		expect(stars.length).toBe(50);

		stars.forEach((star, index) => {
			expect(star.kind).toBe('star');
			expect(star.role).toBe('daytime-sky-visibility-calibration');
			expect(star.visible).toBeTrue();
			expect(star.decDeg).toBeGreaterThan(0);
			expectFiniteVector(star.direction);
			expectFiniteVector(star.position);
			expect(vectorLength(star.direction)).toBeCloseTo(1, 8);
			expect(vectorLength(star.position)).toBeCloseTo(1000000, 3);
			expect(star.relativeFlux).toBeCloseTo(10 ** (-0.4 * star.magnitude), 12);
			expect(star.azimuthDeg).toBeGreaterThanOrEqual(0);
			expect(star.azimuthDeg).toBeLessThan(360);
			expect(star.altitudeDeg).toBeGreaterThanOrEqual(-90);
			expect(star.altitudeDeg).toBeLessThanOrEqual(90);

			if (index > 0) {
				expect(star.magnitude).toBeGreaterThanOrEqual(stars[index - 1].magnitude);
			}
		});
	});

	it('orients Earth with the correct axial tilt', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const axis = scene.geometry.earth.axis.north;
		const eclipticNorth = { x: 0, y: 1, z: 0 };
		const axisDotEclipticNorth = axis.x * eclipticNorth.x
			+ axis.y * eclipticNorth.y
			+ axis.z * eclipticNorth.z;

		expect(scene.geometry.earth.axis.tiltDeg).toBeCloseTo(23.43928, 5);
		expect(axisDotEclipticNorth).toBeCloseTo(Math.cos(23.43928 * Math.PI / 180), 5);
	});

	it('places the camera at standing height above the San Jose surface point', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const observer = scene.observer.positionKm;
		const camera = scene.camera.positionKm;
		const target = scene.camera.targetKm;
		const observerDistance = Math.hypot(observer.x, observer.y, observer.z);
		const cameraDistanceFromSurface = Math.hypot(
			camera.x - observer.x,
			camera.y - observer.y,
			camera.z - observer.z,
		);

		expect(target).toEqual(scene.sun.position);
		expect(observerDistance).toBeCloseTo(scene.geometry.earthRadiusKm + 0.03048, 5);
		expect(cameraDistanceFromSurface).toBeCloseTo(0.0017, 5);
		expect(scene.root.id).toBe('san-jose-ca');
	});

	it('places deterministic mountain simulation rectangles on the San Jose globe surface', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const mountains = scene.objects.filter((object) => object.role === 'mountain-simulation');
		const expectedDistancesMiles = Array.from({ length: 21 }, (_, index) => 1 + (index * 5));
		const expectedBearingsDeg = expectedDistancesMiles.map((_, index) => {
			const bearingIndex = index % 8;
			const ringIndex = Math.floor(index / 8);

			return ((bearingIndex * 45) + (ringIndex * 10)) % 360;
		});

		expect(scene.scope.terrain).toBe('synthetic-mountain-markers');
		expect(mountains.length).toBe(22);
		expect(mountains[0].source.role).toBe('stray-near-field-calibration');
		expect(mountains[0].source.distanceMiles).toBe(0.5);
		expect(mountains[0].source.bearingDeg).toBe(22.5);

		for (const mountain of mountains) {
			const geodesicDistanceKm = Math.acos(clamp(
				dotVectors(scene.observer.frame.up, mountain.surface.normal),
				-1,
				1,
			)) * scene.geometry.earthRadiusKm;
			const nearEdgeDistanceKm = Math.acos(clamp(
				dotVectors(scene.observer.frame.up, mountain.surface.nearEdgeCenterKm)
					/ vectorLength(mountain.surface.nearEdgeCenterKm),
				-1,
				1,
			)) * scene.geometry.earthRadiusKm;

			expect(mountain.kind).toBe('box');
			expect(mountain.visible).toBeTrue();
			expectFiniteVector(mountain.position);
			expectFiniteVector(mountain.size);
			expectFiniteVector(mountain.orientation.xAxis);
			expectFiniteVector(mountain.orientation.yAxis);
			expectFiniteVector(mountain.orientation.zAxis);
			expect(vectorLength(mountain.surface.centerKm)).toBeCloseTo(scene.geometry.earthRadiusKm, 5);
			expect(vectorLength(mountain.orientation.xAxis)).toBeCloseTo(1, 8);
			expect(vectorLength(mountain.orientation.yAxis)).toBeCloseTo(1, 8);
			expect(vectorLength(mountain.orientation.zAxis)).toBeCloseTo(1, 8);
			expect(dotVectors(mountain.orientation.xAxis, mountain.orientation.yAxis)).toBeCloseTo(0, 8);
			expect(dotVectors(mountain.orientation.yAxis, mountain.orientation.zAxis)).toBeCloseTo(0, 8);
			expect(dotVectors(mountain.orientation.xAxis, mountain.orientation.zAxis)).toBeCloseTo(0, 8);
			expect(mountain.size.y).toBeCloseTo(2000 * 0.0003048, 8);
			expect(mountain.size.x).toBeCloseTo(mountain.size.y * 5, 8);
			expect(mountain.size.z).toBeCloseTo(mountain.size.y * 10, 8);
			expect(mountain.style.color).toBe('#ff0000');
			expect(mountain.source.heightFeet).toBe(2000);
			expect(vectorLength(mountain.surface.nearEdgeCenterKm))
				.toBeCloseTo(scene.geometry.earthRadiusKm, 5);
			expect(mountain.surface.nearEdgeDistanceKm)
				.toBeCloseTo(mountain.source.distanceMiles * KM_PER_MILE, 8);
			expect(nearEdgeDistanceKm).toBeCloseTo(mountain.source.distanceMiles * KM_PER_MILE, 5);
			expect(geodesicDistanceKm)
				.toBeCloseTo((mountain.source.distanceMiles * KM_PER_MILE) + mountain.size.z / 2, 5);

			for (const x of [-mountain.size.x / 2, mountain.size.x / 2]) {
				for (const z of [-mountain.size.z / 2, mountain.size.z / 2]) {
					const bottomCorner = addScaledVectors([
						{ vector: mountain.position, scale: 1 },
						{ vector: mountain.orientation.xAxis, scale: x },
						{ vector: mountain.orientation.yAxis, scale: -mountain.size.y / 2 },
						{ vector: mountain.orientation.zAxis, scale: z },
					]);

					expect(vectorLength(bottomCorner))
						.toBeLessThanOrEqual(scene.geometry.earthRadiusKm + 0.000000001);
				}
			}
		}

		for (const [index, mountain] of mountains.slice(1).entries()) {
			expect(mountain.source.distanceMiles).toBe(expectedDistancesMiles[index]);
			expect(mountain.source.bearingDeg).toBe(expectedBearingsDeg[index]);
		}
	});
});
