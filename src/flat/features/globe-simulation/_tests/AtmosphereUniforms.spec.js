import GlobeSimulationSceneModel from '../models/GlobeSimulationSceneModel.js';
import {
	createGlobeAtmosphereUniformAdapter,
	resolveGlobeAtmosphereSun,
} from '../components/atmosphere-uniforms.js';

describe('globe-simulation atmosphere uniforms', () => {
	const fixedTime = '2026-06-13T13:07:44-07:00';

	it('uses the scene spherical-shell atmosphere frame and profile', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const adapter = createGlobeAtmosphereUniformAdapter(scene);

		expect(adapter.enabled).toBeTrue();
		expect(adapter.atmosphere.getFrame().kind).toBe('spherical-shell');
		expect(adapter.atmosphere.getProfile().id).toBe(scene.atmosphere.profile.id);
		expect(adapter.uniforms.atmosphereFrameKindId.value).toBe(1);
		expect(adapter.uniforms.atmospherePlanetCenter.value).toEqual([
			scene.atmosphere.frame.planetCenter.x,
			scene.atmosphere.frame.planetCenter.y,
			scene.atmosphere.frame.planetCenter.z,
		]);
		expect(adapter.uniforms.atmospherePlanetRadiusKm.value)
			.toBe(scene.geometry.earthRadiusKm);
		expect(adapter.uniforms.atmosphereTopAltitudeKm.value)
			.toBe(scene.atmosphere.profile.topAltitudeKm);
		expect(adapter.uniforms.atmosphereMieExtinctionBetaKm.value[1])
			.toBeCloseTo(adapter.atmosphere.getProfile().mieExtinctionBetaKm.g, 8);
		expect(adapter.uniforms.atmosphereMieScatteringBetaKm.value[1])
			.toBeCloseTo(adapter.atmosphere.getProfile().mieScatteringBetaKm.g, 8);
	});

	it('uses the date-derived real Sun as the atmosphere light source', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const adapter = createGlobeAtmosphereUniformAdapter(scene);
		const resolvedSun = resolveGlobeAtmosphereSun(scene);

		expect(adapter.sun).toEqual(resolvedSun);
		expect(adapter.uniforms.sunKind.value).toBe('point');
		expect(adapter.uniforms.sunKindId.value).toBe(1);
		expect(adapter.uniforms.sunPosition.value).toEqual([
			scene.sun.position.x,
			scene.sun.position.y,
			scene.sun.position.z,
		]);
		expect(adapter.uniforms.sunRadiusKm.value).toBe(scene.sun.radiusKm);
		expect(adapter.uniforms.sunDistanceKm.value).toBe(resolvedSun.distanceKm);
		expect(adapter.uniforms.sunAngularRadiusRad.value)
			.toBe(resolvedSun.apparentAngularRadiusRad);
		expect(adapter.uniforms.sunColor.value).toEqual([
			scene.sun.color.r,
			scene.sun.color.g,
			scene.sun.color.b,
		]);
		expect(adapter.uniforms.sunSolarIrradianceScale.value)
			.toBe(scene.sun.solarIrradianceScale);
		expect(adapter.uniforms.sunTopOfAtmosphereIrradianceWm2.value)
			.toBe(scene.sun.irradiance.topOfAtmosphereIrradianceWm2);
		expect(adapter.uniforms.sunAnchor.value.kind)
			.toBe('globe-simulation-date-derived-sun');
	});

	it('exposes display mapping separately from physical solar irradiance', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const adapter = createGlobeAtmosphereUniformAdapter(scene);

		expect(adapter.uniforms.sunTopOfAtmosphereIrradianceWm2.value)
			.toBeGreaterThan(1300);
		expect(adapter.uniforms.displayModel.value).toBe('radiometric-display-v1');
		expect(adapter.uniforms.displayRadiometricToSceneRgbScale.value)
			.toBe(scene.display.radiometricToSceneRgbScale);
		expect(adapter.uniforms.displayExposure.value).toBe(1);
		expect(adapter.uniforms.displayToneMapping.value).toBe('reinhard');
		expect(adapter.uniforms.displayToneMappingId.value).toBe(1);
		expect(adapter.uniforms.displayRadiometricToSceneRgbScale.value)
			.toBeCloseTo(
				1 / scene.sun.source.rendererIrradianceReferenceWm2,
				12,
			);
	});

	it('fails loudly when a non-spherical frame is provided to the globe adapter', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const badScene = {
			...scene,
			atmosphere: {
				...scene.atmosphere,
				frame: {
					kind: 'flat-slab',
					origin: { x: 0, y: 0, z: 0 },
					up: { x: 0, y: 1, z: 0 },
				},
			},
		};

		expect(() => createGlobeAtmosphereUniformAdapter(badScene))
			.toThrowError('Globe atmosphere requires a spherical-shell frame, received "flat-slab".');
	});
});
