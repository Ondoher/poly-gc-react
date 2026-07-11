import * as THREE from 'three';

import {
	algorithm32ViewportPixels,
	createAlgorithm32BindingValues,
	createAlgorithm32RequiredThreeObjects,
	createAlgorithm32SceneColorRenderTarget,
} from '../Algorithm32ReactUtils.js';

describe('Algorithm32ReactUtils', () => {
	it('creates common camera binding values with optional scene-depth override', () => {
		const defaultBindings = createAlgorithm32BindingValues(THREE);
		const overrideBindings = createAlgorithm32BindingValues(THREE, 42);

		expect(defaultBindings['geometry.inverseProjectionMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(defaultBindings['geometry.inverseViewMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(defaultBindings['geometry.cameraWorldPositionMeters'])
			.toEqual(jasmine.any(THREE.Vector3));
		expect(defaultBindings['geometry.sceneTerminationMeters']).toBe(0);
		expect(defaultBindings['geometry.sceneDepthMaxMeters']).toBeUndefined();
		expect(overrideBindings['geometry.sceneDepthMaxMeters']).toBe(42);
	});

	it('creates a configurable scene-color render target', () => {
		const target = createAlgorithm32SceneColorRenderTarget({
			THREE,
			width: 64,
			height: 32,
			type: THREE.HalfFloatType,
			name: 'test.sceneColor',
			colorSpace: THREE.LinearSRGBColorSpace,
		});

		expect(target).toEqual(jasmine.any(THREE.WebGLRenderTarget));
		expect(target.width).toBe(64);
		expect(target.height).toBe(32);
		expect(target.texture.type).toBe(THREE.HalfFloatType);
		expect(target.texture.name).toBe('test.sceneColor');
		expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);

		target.dispose();
	});

	it('creates required Three objects from geometry and light source abstractions', () => {
		const visualObject = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
		const raycastObject = new THREE.Object3D();
		const light = new THREE.DirectionalLight();
		const target = new THREE.Object3D();
		const config = {
			geometry: {
				createThreeEndpointObjects: jasmine.createSpy('createThreeEndpointObjects').and.returnValue({
					visualObjects: [visualObject],
					raycastObjects: [raycastObject],
					metadata: { owner: 'test-geometry' },
				}),
			},
			lightSource: {
				addSceneLighting: jasmine.createSpy('addSceneLighting').and.returnValue({
					lights: [light],
					sceneObjects: [target],
					metadata: { owner: 'test-light' },
				}),
			},
		};
		const packet = createAlgorithm32RequiredThreeObjects({
			THREE,
			config,
			metersPerSceneUnit: 1000,
			geometryEndpointRequest: { name: 'test-ground' },
			lightingRequest: { focusSceneUnits: [1, 2, 3] },
		});

		expect(config.geometry.createThreeEndpointObjects).toHaveBeenCalledWith(jasmine.objectContaining({
			metersPerSceneUnit: 1000,
			name: 'test-ground',
		}));
		expect(config.lightSource.addSceneLighting).toHaveBeenCalledWith(jasmine.objectContaining({
			THREE,
			focusSceneUnits: [1, 2, 3],
		}));
		expect(packet.objects).toEqual([visualObject, raycastObject, light, target]);
		expect(light.userData.algorithm32SceneInput).toBeFalse();
		expect(target.userData.algorithm32SceneInput).toBeFalse();

		visualObject.geometry.dispose();
		visualObject.material.dispose();
	});

	it('normalizes viewport dimensions for setup', () => {
		expect(algorithm32ViewportPixels({ width: 12.8, height: 0 }))
			.toEqual([12, 1]);
		expect(algorithm32ViewportPixels(null))
			.toEqual([1, 1]);
	});
});
