import * as THREE from 'three';
import GlobeSimulationSceneModel from '../models/GlobeSimulationSceneModel.js';
import GlobeAlgorithm32AtmosphereComposer, {
	createGlobeSceneColorRenderTarget,
} from '../components/GlobeAlgorithm32AtmosphereComposer.jsx';
import {
	STEP032_ARTIFACT_NUMERICAL_CONTROLS,
} from '../../../../../shared/algorithm32/production/constants/Algorithm32CanonicalData.js';
import {
	createAlgorithm32BindingValues,
	createGlobeAlgorithm32Config,
	updateGlobeAlgorithm32BindingValues,
} from '../../../shared/algorithm32-production-config.js';

describe('GlobeAlgorithm32AtmosphereComposer', () => {
	const fixedTime = '2026-06-13T13:07:44-07:00';

	it('creates a half-float color target for the globe solid scene', () => {
		const target = createGlobeSceneColorRenderTarget(320, 180);

		expect(target).toEqual(jasmine.any(THREE.WebGLRenderTarget));
		expect(target.width).toBe(320);
		expect(target.height).toBe(180);
		expect(target.texture.type).toBe(THREE.HalfFloatType);
		expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
		expect(target.texture.name).toBe('GlobeSimulation.Algorithm32.sceneColor');

		target.dispose();
	});

	it('creates the production spherical/distant Algorithm32 config', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const config = createGlobeAlgorithm32Config(scene);

		expect(config.geometry.describe().kind).toBe('spherical-earth-geometry');
		expect(config.lightSource.describe().kind).toBe('distant-sun-light-source');
		expect(config.atmosphere.describe().kind).toBe('canonical-atmosphere');
		expect(config.color.describe().id).toBe('bruneton-figure1-display');
		expect(config.geometry.describe().sceneFrame.kind).toBe('model-space');
		expect(config.shader.metersPerSceneUnit).toBe(1000);
		expect(config.shader.sceneDepthMaxMeters).toBeUndefined();
		expect(config.execution).toEqual(jasmine.objectContaining({
			pathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
			sourceTransmittanceIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
			incidentDirectionCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount,
			incidentAltitudeBinCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			cachePathIntervalCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.pathIntervalCount,
		}));
		expect(config.lightSource.describe().incidentRadianceCachePolicy).toEqual(jasmine.objectContaining({
			altitudeBinCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			directionCount: STEP032_ARTIFACT_NUMERICAL_CONTROLS.incidentDirectionCount,
			altitudeLookup: null,
		}));
		expect(config.geometry.resolveSceneDepthMaxMeters()).toBeGreaterThan(0);
	});

	it('feeds spherical geometry and distant source facts to abstraction-created Three objects', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const config = createGlobeAlgorithm32Config(scene);
		const component = new GlobeAlgorithm32AtmosphereComposer({ scene });
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
		expect(endpoints.metadata.owner).toBe('SphericalEarthGeometry');
		expect(lighting.lights.length).toBeGreaterThan(1);
		expect(lighting.metadata.owner).toBe('DistantSunLightSource');

		endpoints.visualObjects[0].geometry.dispose();
		endpoints.visualObjects[0].material.dispose();
	});

	it('keeps geometry-resolved globe scene input depth on the local terrain scale', () => {
		const scene = new GlobeSimulationSceneModel({ time: fixedTime }).createScene();
		const config = createGlobeAlgorithm32Config(scene);
		const depthMaxMeters = config.geometry.resolveSceneDepthMaxMeters({
			cameraPositionSceneUnits: scene.camera.positionKm,
			metersPerSceneUnit: 1000,
		});

		expect(depthMaxMeters).toBeGreaterThan(0);
		expect(depthMaxMeters).toBeLessThan(Number(scene.camera.farKm) * 1000);
	});

	it('updates live camera bindings in Algorithm32 meters', () => {
		const bindings = createAlgorithm32BindingValues(THREE, 42);
		const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);

		camera.position.set(1, 2, 3);
		camera.updateProjectionMatrix();
		camera.updateMatrixWorld();
		updateGlobeAlgorithm32BindingValues(bindings, camera);

		expect(bindings['geometry.inverseProjectionMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(bindings['geometry.inverseViewMatrix'])
			.toEqual(jasmine.any(THREE.Matrix4));
		expect(bindings['geometry.cameraWorldPositionMeters'])
			.toEqual(new THREE.Vector3(1000, 2000, 3000));
		expect(bindings['geometry.sceneDepthMaxMeters']).toBe(42);
	});
});
