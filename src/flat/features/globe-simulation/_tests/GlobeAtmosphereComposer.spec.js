import * as THREE from 'three';
import GlobeSimulationSceneModel from '../models/GlobeSimulationSceneModel.js';
import { createGlobeAtmosphereUniformAdapter } from '../components/atmosphere-uniforms.js';
import {
	createGlobeAtmosphereCompositionUniforms,
	createGlobeSolidRenderTarget,
} from '../components/GlobeAtmosphereComposer.jsx';

describe('GlobeAtmosphereComposer', () => {
	const fixedTime = '2026-06-13T13:07:44-07:00';

	it('creates a color/depth render target for the globe solid scene', () => {
		const target = createGlobeSolidRenderTarget(320, 180);

		expect(target).toEqual(jasmine.any(THREE.WebGLRenderTarget));
		expect(target.width).toBe(320);
		expect(target.height).toBe(180);
		expect(target.depthTexture).toEqual(jasmine.any(THREE.DepthTexture));
		expect(target.depthTexture.format).toBe(THREE.DepthFormat);
		expect(target.depthTexture.type).toBe(THREE.UnsignedIntType);
		expect(target.texture.type).toBe(THREE.HalfFloatType);
		expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);

		target.dispose();
		target.depthTexture.dispose();
	});

	it('exposes atmosphere composition uniforms for the globe composer', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const adapter = createGlobeAtmosphereUniformAdapter(scene);
		const target = createGlobeSolidRenderTarget(64, 64);
		const camera = new THREE.PerspectiveCamera();
		const uniforms = createGlobeAtmosphereCompositionUniforms(target, adapter, camera);

		expect(uniforms.sceneColorTexture.value).toBe(target.texture);
		expect(uniforms.sceneDepthTexture.value).toBe(target.depthTexture);
		expect(uniforms.atmospherePlanetRadiusKm.value).toBe(scene.geometry.earthRadiusKm);
		expect(uniforms.sunTopOfAtmosphereIrradianceWm2.value)
			.toBe(scene.sun.irradiance.topOfAtmosphereIrradianceWm2);
		expect(uniforms.displayRadiometricToSceneRgbScale.value)
			.toBe(scene.display.radiometricToSceneRgbScale);
		expect(uniforms.displayToneMappingId.value).toBe(1);
		expect(uniforms.sunPosition.value).toEqual([
			scene.sun.position.x,
			scene.sun.position.y,
			scene.sun.position.z,
		]);
		expect(uniforms.cameraProjectionMatrixInverse.value)
			.toBe(camera.projectionMatrixInverse);
		expect(uniforms.cameraViewMatrixInverse.value).toBe(camera.matrixWorld);
		expect(uniforms.cameraWorldPosition.value).toEqual(jasmine.any(THREE.Vector3));
		expect(uniforms.cameraForward.value).toEqual(jasmine.any(THREE.Vector3));
		expect(uniforms.cameraRight.value).toEqual(jasmine.any(THREE.Vector3));
		expect(uniforms.cameraUp.value).toEqual(jasmine.any(THREE.Vector3));
		expect(uniforms.cameraTanHalfFov.value).toBe(1);
		expect(uniforms.cameraAspect.value).toBe(1);

		target.dispose();
		target.depthTexture.dispose();
	});
});
