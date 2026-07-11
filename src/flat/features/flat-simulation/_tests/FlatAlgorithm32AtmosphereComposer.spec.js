import * as THREE from 'three';
import FlatSimulationSceneModel from '../models/FlatSimulationSceneModel.js';
import FlatAlgorithm32AtmosphereComposer, {
	createFlatSceneColorRenderTarget,
} from '../components/FlatAlgorithm32AtmosphereComposer.jsx';
import {
	STEP032_ARTIFACT_NUMERICAL_CONTROLS,
} from '../../../../../shared/algorithm32/production/constants/Algorithm32CanonicalData.js';
import {
	createAlgorithm32BindingValues,
	createFlatAlgorithm32Config,
	updateFlatAlgorithm32BindingValues,
} from '../../../shared/algorithm32-production-config.js';

describe('FlatAlgorithm32AtmosphereComposer', () => {
	it('creates an unsigned-byte color target for the flat solid scene', () => {
		const target = createFlatSceneColorRenderTarget(320, 180);

		expect(target).toEqual(jasmine.any(THREE.WebGLRenderTarget));
		expect(target.width).toBe(320);
		expect(target.height).toBe(180);
		expect(target.texture.type).toBe(THREE.UnsignedByteType);
		expect(target.texture.name).toBe('FlatSimulation.Algorithm32.sceneColor');

		target.dispose();
	});

	it('creates the production flat/local Algorithm32 config', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const config = createFlatAlgorithm32Config(scene, scene.lighting.atmosphereSun);

		expect(config.geometry.describe().kind).toBe('flat-earth-geometry');
		expect(config.lightSource.describe().kind).toBe('local-sun-light-source');
		expect(config.atmosphere.describe().kind).toBe('canonical-atmosphere');
		expect(config.color.describe().id).toBe('bruneton-figure1-display');
		expect(config.shader.metersPerSceneUnit).toBe(1000);
		expect(config.shader.sceneDepthMaxMeters).toBeUndefined();
		expect(config.execution).toEqual(jasmine.objectContaining({
			pathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
			sourceTransmittanceIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
			incidentDirectionCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount,
			incidentAltitudeBinCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			cachePathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
		}));
		expect(config.lightSource.describe().incidentRadianceCachePolicy.directionCount)
			.toBe(STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount);
		expect(config.geometry.resolveSceneDepthMaxMeters()).toBeGreaterThan(0);
	});

	it('feeds flat geometry and local source facts to abstraction-created Three objects', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const config = createFlatAlgorithm32Config(scene, scene.lighting.atmosphereSun);
		const component = new FlatAlgorithm32AtmosphereComposer({ scene });
		const endpoints = config.geometry.createThreeEndpointObjects({
			metersPerSceneUnit: 1000,
			...component._createGeometryEndpointRequest({ config }),
		});
		const lighting = config.lightSource.createThreeLightingObjects({
			THREE,
			...component._createLightingRequest({ config }),
		});

		expect(endpoints.visualObjects[0]).toEqual(jasmine.any(THREE.Mesh));
		expect(endpoints.raycastObjects.length).toBe(1);
		expect(endpoints.metadata.owner).toBe('FlatEarthGeometry');
		expect(lighting.lights.length).toBeGreaterThan(1);
		expect(lighting.metadata.owner).toBe('LocalSunLightSource');

		endpoints.visualObjects[0].geometry.dispose();
		endpoints.visualObjects[0].material.dispose();
	});

	it('updates live camera bindings from observer-local scene kilometers into flat model meters', () => {
		const scene = new FlatSimulationSceneModel().createScene();
		const config = createFlatAlgorithm32Config(scene, scene.lighting.atmosphereSun);
		const bindings = createAlgorithm32BindingValues(THREE, 42);
		const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

		camera.position.set(1, 2, 3);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		updateFlatAlgorithm32BindingValues(bindings, camera, scene, config);

		expect(bindings['geometry.inverseProjectionMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(bindings['geometry.inverseViewMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(bindings['geometry.cameraWorldPositionMeters'])
			.toEqual(new THREE.Vector3(...config.geometry.mapObserverLocalScenePointToModelPosition(
				camera.position,
				{ metersPerSceneUnit: 1000 },
			)));
		expect(bindings['geometry.sceneDepthMaxMeters']).toBe(42);
	});
});
