import FlatSimulationSceneModel from '../models/FlatSimulationSceneModel.js';
import {
	createAtmosphereUniformAdapter,
	updateAtmosphereSunUniforms,
} from '../components/atmosphere-uniforms.js';

describe('flat-simulation atmosphere uniforms', () => {
	it('uses scene atmosphere profile and frame settings', () => {
		const scene = new FlatSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, scene.lighting.atmosphereSun);

		expect(adapter.enabled).toBeTrue();
		expect(adapter.atmosphere.getFrame().kind).toBe(scene.atmosphere.frame.kind);
		expect(adapter.atmosphere.getProfile().id).toBe(scene.atmosphere.profile.id);
		expect(adapter.uniforms.atmosphereTopAltitudeKm.value).toBe(scene.atmosphere.profile.topAltitudeKm);
		expect(adapter.uniforms.atmosphereMieExtinctionBetaKm.value[1])
			.toBeCloseTo(adapter.atmosphere.getProfile().mieExtinctionBetaKm.g, 8);
		expect(adapter.uniforms.atmosphereMieScatteringBetaKm.value[1])
			.toBeCloseTo(adapter.atmosphere.getProfile().mieScatteringBetaKm.g, 8);
		expect(adapter.uniforms.atmosphereFrameKindId.value).toBe(0);
		expect(adapter.uniforms.atmosphereFrameOrigin.value).toEqual([0, 0, 0]);
		expect(adapter.uniforms.atmosphereFrameUp.value).toEqual([0, 1, 0]);
	});

	it('uses atmosphere radiance from the same visible false-sun body', () => {
		const scene = new FlatSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, scene.lighting.atmosphereSun);

		expect(adapter.uniforms.sunKind.value).toBe('point');
		expect(adapter.uniforms.sunKindId.value).toBe(1);
		expect(adapter.uniforms.sunDirection.value).toEqual([
			scene.lighting.atmosphereSun.direction.x,
			scene.lighting.atmosphereSun.direction.y,
			scene.lighting.atmosphereSun.direction.z,
		]);
		expect(adapter.uniforms.sunPosition.value).toEqual([
			scene.lighting.sun.position.x,
			scene.lighting.sun.position.y,
			scene.lighting.sun.position.z,
		]);
		expect(adapter.uniforms.sunRadiusKm.value).toBe(scene.lighting.atmosphereSun.radiusKm);
		expect(adapter.uniforms.sunColor.value).toEqual([
			scene.lighting.atmosphereSun.color.r,
			scene.lighting.atmosphereSun.color.g,
			scene.lighting.atmosphereSun.color.b,
		]);
		expect(adapter.uniforms.sunColor.value).not.toEqual([
			scene.lighting.sun.color.r,
			scene.lighting.sun.color.g,
			scene.lighting.sun.color.b,
		]);
		expect(adapter.uniforms.sunIntensity.value).toBe(1);
		expect(adapter.uniforms.sunSolarIrradianceScale.value)
			.toBe(scene.lighting.atmosphereSun.solarIrradianceScale);
	});

	it('updates mutable sun uniforms without replacing the uniform map', () => {
		const scene = new FlatSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, scene.lighting.atmosphereSun);
		const originalUniforms = adapter.uniforms;
		const originalSunDirection = adapter.uniforms.sunDirection.value;
		const nextSun = {
			...scene.lighting.atmosphereSun,
			direction: { x: 0, y: 0.5, z: 0.5 },
			color: { r: 0.9, g: 0.95, b: 1 },
			intensity: 2,
			solarIrradianceScale: 80,
			apparentAngularRadiusRad: 0.01,
		};

		const updatedUniforms = updateAtmosphereSunUniforms(adapter.uniforms, nextSun);

		expect(updatedUniforms).toBe(originalUniforms);
		expect(adapter.uniforms.sunDirection.value).toBe(originalSunDirection);
		expect(adapter.uniforms.sunDirection.value).toEqual([
			nextSun.direction.x,
			nextSun.direction.y,
			nextSun.direction.z,
		]);
		expect(adapter.uniforms.sunIntensity.value).toBe(nextSun.intensity);
		expect(adapter.uniforms.sunSolarIrradianceScale.value).toBe(nextSun.solarIrradianceScale);
		expect(adapter.uniforms.sunAngularRadiusRad.value).toBe(nextSun.apparentAngularRadiusRad);
	});
});
