import FalseSimulationSceneModel from '../models/FalseSimulationSceneModel.js';
import { resolveAnimatedSun } from '../models/sun-animation.js';
import {
	createAtmosphereUniformAdapter,
	updateAtmosphereSunUniforms,
} from '../components/atmosphere-uniforms.js';

describe('false-simulation atmosphere uniforms', () => {
	it('uses scene atmosphere profile and frame settings', () => {
		const scene = new FalseSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const resolvedSun = resolveAnimatedSun(scene.sun, 0, {
			observerPosition: scene.observer.position,
		});
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, resolvedSun.light);

		expect(adapter.enabled).toBeTrue();
		expect(adapter.atmosphere.getFrame().kind).toBe(scene.atmosphere.frame.kind);
		expect(adapter.atmosphere.getProfile().id).toBe(scene.atmosphere.profile.id);
		expect(adapter.uniforms.atmosphereTopAltitudeKm.value).toBe(scene.atmosphere.profile.topAltitudeKm);
		expect(adapter.uniforms.atmosphereFrameKindId.value).toBe(0);
		expect(adapter.uniforms.atmosphereFrameOrigin.value).toEqual([0, 0, 0]);
		expect(adapter.uniforms.atmosphereFrameUp.value).toEqual([0, 1, 0]);
	});

	it('uses the resolved animated sun instead of the initial scene light', () => {
		const scene = new FalseSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const duration = scene.sun.animation.displayDurationSeconds;
		const resolvedSun = resolveAnimatedSun(scene.sun, duration / 4, {
			observerPosition: scene.observer.position,
		});
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, resolvedSun.light);

		expect(adapter.uniforms.sunKind.value).toBe('point');
		expect(adapter.uniforms.sunKindId.value).toBe(1);
		expect(adapter.uniforms.sunPosition.value).toEqual([
			resolvedSun.light.position.x,
			resolvedSun.light.position.y,
			resolvedSun.light.position.z,
		]);
		expect(adapter.uniforms.sunPosition.value).not.toEqual([
			scene.lighting.sun.position.x,
			scene.lighting.sun.position.y,
			scene.lighting.sun.position.z,
		]);
		expect(adapter.uniforms.sunRadiusKm.value).toBe(scene.sun.radiusKm);
		expect(adapter.uniforms.sunColor.value).toEqual([
			scene.lighting.sun.color.r,
			scene.lighting.sun.color.g,
			scene.lighting.sun.color.b,
		]);
	});

	it('updates mutable sun uniforms without replacing the uniform map', () => {
		const scene = new FalseSimulationSceneModel({
			atmosphere: {
				enabled: true,
			},
		}).createScene();
		const adapter = createAtmosphereUniformAdapter(scene.atmosphere, scene.lighting.sun);
		const originalUniforms = adapter.uniforms;
		const originalSunPosition = adapter.uniforms.sunPosition.value;
		const nextSun = resolveAnimatedSun(scene.sun, scene.sun.animation.displayDurationSeconds / 2, {
			observerPosition: scene.observer.position,
		});

		const updatedUniforms = updateAtmosphereSunUniforms(adapter.uniforms, nextSun.light);

		expect(updatedUniforms).toBe(originalUniforms);
		expect(adapter.uniforms.sunPosition.value).toBe(originalSunPosition);
		expect(adapter.uniforms.sunPosition.value).toEqual([
			nextSun.light.position.x,
			nextSun.light.position.y,
			nextSun.light.position.z,
		]);
		expect(adapter.uniforms.sunIntensity.value).toBe(nextSun.light.intensity);
		expect(adapter.uniforms.sunAngularRadiusRad.value).toBe(nextSun.light.apparentAngularRadiusRad);
	});
});
