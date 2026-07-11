import * as THREE from 'three';

import DistantSunIncidentRadianceCache from '../DistantSunIncidentRadianceCache.js';
import DistantSunLightSource from '../DistantSunLightSource.js';

describe('DistantSunLightSource', () => {
	it('describes direct source and incident cache policy', () => {
		const source = createDistantSource();

		expect(source.id).toBe('distant-sun');
		expect(source.configuration.directionToLight).toEqual([1, 0, 0]);
		expect(source.describe()).toEqual(jasmine.objectContaining({
			kind: 'distant-sun-light-source',
			sourceKey: 'distant-sun',
			angularRadiusRadians: 0.004,
			spectralChannelCount: 2,
		}));
		expect(source.describe().incidentRadianceCachePolicy).toEqual({
			altitudeBinCount: 3,
			directionCount: 4,
			boundaryAltitudeMeters: 2,
			boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
			altitudeLookup: null,
		});
	});

	it('creates a source-owned distant incident-radiance cache', () => {
		const source = createDistantSource();
		const cache = source.createIncidentRadianceCache({
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
			spectralBasis: createSpectralBasis(),
		});

		expect(cache instanceof DistantSunIncidentRadianceCache).toBeTrue();
		expect(cache.descriptor).toEqual(jasmine.objectContaining({
			cacheKind: 'distant',
			sourceKey: 'distant-sun',
			payloadKind: 'distant-incident-radiance-cache',
			payloadDimensions: [3, 4, 2],
			altitudeLookup: null,
		}));
		expect(cache.descriptor.metadata).toEqual(jasmine.objectContaining({
			altitudeBinCount: 3,
			directionCount: 4,
			boundaryAltitudeMeters: 2,
		}));
		expect([...cache.coordinates()].length).toBe(12);
	});

	it('passes the requested cache altitude lookup policy into the cache descriptor', () => {
		const source = createDistantSource({
			cacheAltitudeLookup: {
				kind: 'linear-altitude-v1',
			},
		});
		const cache = source.createIncidentRadianceCache({
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
			spectralBasis: createSpectralBasis(),
		});

		expect(source.describe().incidentRadianceCachePolicy.altitudeLookup).toEqual({
			kind: 'linear-altitude-v1',
		});
		expect(cache.descriptor.altitudeLookup).toEqual({
			kind: 'linear-altitude-v1',
		});
		expect(cache.descriptor.lookup.altitudeLookup).toEqual({
			kind: 'linear-altitude-v1',
		});
	});

	it('samples direct lighting and resolves an unbounded source path', () => {
		const source = createDistantSource({
			directionToLight: [10, 0, 0],
		});

		expect(source.sampleDirectLighting()).toEqual({
			incidentRadiance: [1, 2],
			directionToLight: [1, 0, 0],
			metadata: {
				directionFromSource: [-1, -0, -0],
				angularRadiusRadians: 0.004,
			},
		});
		expect(source.resolveSourcePathLimit()).toEqual({
			maxDistanceMeters: null,
			reason: 'distant-source-to-atmosphere-boundary',
		});
	});

	it('resolves twilight-aware scene light percentages', () => {
		const source = createDistantSource();
		const sunrise = source.resolveSceneLightPercent({
			directionToLightScene: [1, 0, 0],
			localUpScene: [0, 1, 0],
			twilightStartSourceUpDot: -0.2,
			fullAmbientSourceUpDot: 0.2,
		});
		const night = source.resolveSceneLightPercent({
			directionToLightScene: [0, -1, 0],
			localUpScene: [0, 1, 0],
			twilightStartSourceUpDot: -0.2,
			fullAmbientSourceUpDot: 0.2,
		});
		const daylight = source.resolveSceneLightPercent({
			directionToLightScene: [0, 1, 0],
			localUpScene: [0, 1, 0],
			twilightStartSourceUpDot: -0.2,
			fullAmbientSourceUpDot: 0.2,
		});

		expect(sunrise.sourceUpDot).toBeCloseTo(0, 12);
		expect(sunrise.directLightPercent).toBe(0);
		expect(sunrise.ambientLightPercent).toBeCloseTo(0.5, 12);
		expect(night.directLightPercent).toBe(0);
		expect(night.ambientLightPercent).toBe(0);
		expect(daylight.directLightPercent).toBe(1);
		expect(daylight.ambientLightPercent).toBe(1);
		expect(daylight.policy).toBe('distant-source-twilight-aware-scene-light-percent');
	});

	it('creates source-owned Three directional lighting objects for endpoints', () => {
		const objects = createDistantSource().addSceneLighting({
			THREE,
			directionToLightScene: [0, 1, 0],
			focusSceneUnits: [1, 2, 3],
			lightDistanceSceneUnits: 10,
			intensity: 4,
			ambientIntensity: 0.5,
			shadow: {
				enabled: true,
				extentSceneUnits: 5,
				mapSize: 64,
				shadowIntensity: 0.75,
			},
		});
		const ambient = objects.lights[0];
		const sourceLight = objects.lights[1];
		const target = objects.sceneObjects[0];

		expect(ambient instanceof THREE.AmbientLight).toBeTrue();
		expect(sourceLight instanceof THREE.DirectionalLight).toBeTrue();
		expect(sourceLight.position.toArray()).toEqual([1, 12, 3]);
		expect(sourceLight.intensity).toBe(4);
		expect(sourceLight.castShadow).toBeTrue();
		expect(sourceLight.shadow.mapSize.width).toBe(64);
		expect(sourceLight.shadow.intensity).toBe(0.75);
		expect(sourceLight.target).toBe(target);
		expect(target.position.toArray()).toEqual([1, 2, 3]);
		expect(sourceLight.userData).toEqual(jasmine.objectContaining({
			algorithm32SourceLight: true,
			sourceKey: 'distant-sun',
			lightingRole: 'source-directional-light',
			directionToSourceScene: [0, 1, 0],
		}));
		expect(objects.metadata).toEqual(jasmine.objectContaining({
			owner: 'DistantSunLightSource',
			lightingPolicy: 'source-driven-distant-directional-light',
			intensity: 4,
			ambientIntensity: 0.5,
			ambientIntensityRange: {
				min: 0.06,
				max: 0.5,
			},
			ambientLightPercent: 1,
			directLightPercent: 1,
			directionToSourceScene: [0, 1, 0],
			focusSceneUnits: [1, 2, 3],
			lightDistanceSceneUnits: 10,
			shadowPolicy: 'three-shadow-map-from-distant-source-direction',
		}));
	});

	it('adds source-owned scene lighting to a supplied Three scene', () => {
		const scene = new THREE.Scene();
		const objects = createDistantSource().addSceneLighting({
			THREE,
			scene,
			directionToLightScene: [0, 1, 0],
			focusSceneUnits: [1, 2, 3],
			intensity: 4,
			ambientIntensity: 1,
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[1] instanceof THREE.DirectionalLight).toBeTrue();
		expect(scene.children).toContain(objects.lights[0]);
		expect(scene.children).toContain(objects.lights[1]);
		expect(scene.children).toContain(objects.sceneObjects[0]);
		expect(objects.metadata.ambientIntensity).toBe(1);
	});

	it('scales ambient lighting between configured bounds with twilight percent', () => {
		const objects = createDistantSource().addSceneLighting({
			THREE,
			directionToLightScene: [1, 0, 0],
			focusSceneUnits: [1, 2, 3],
			ambientIntensityRange: {
				min: 0.2,
				max: 1.0,
			},
			twilightStartSourceUpDot: -0.2,
			fullAmbientSourceUpDot: 0.2,
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.6, 12);
		expect(objects.metadata.ambientLightPercent).toBeCloseTo(0.5, 12);
		expect(objects.metadata.ambientIntensityRange).toEqual({
			min: 0.2,
			max: 1.0,
		});
	});

	it('defaults ambient bounds to absolute scene-light intensities', () => {
		const objects = createDistantSource().addSceneLighting({
			THREE,
			directionToLightScene: [0, 1, 0],
			focusSceneUnits: [1, 2, 3],
			intensity: 4,
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.5, 12);
		expect(objects.metadata.ambientIntensityRange).toEqual({
			min: 0.06,
			max: 0.5,
		});
		expect(objects.metadata.ambientLightPercent).toBe(1);
	});

	it('keeps default no-light ambient slightly above black', () => {
		const objects = createDistantSource().addSceneLighting({
			THREE,
			directionToLightScene: [0, -1, 0],
			focusSceneUnits: [1, 2, 3],
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.06, 12);
		expect(objects.metadata.ambientLightPercent).toBe(0);
	});

	it('creates one source-owned directional shadow light per shadow object', () => {
		const objects = createDistantSource().addSceneLighting({
			THREE,
			directionToLightScene: [0, 1, 0],
			intensity: 4,
			shadow: {
				enabled: true,
				mapSize: 64,
				objects: [
					{
						objectKey: 'near-box',
						layerIndex: 5,
						focusSceneUnits: [1, 2, 3],
						extentSceneUnits: 5,
						cameraLeft: -1,
						cameraRight: 2,
						cameraTop: 3,
						cameraBottom: -4,
						radius: 0,
					},
					{
						objectKey: 'far-box',
						layerIndex: 6,
						focusSceneUnits: [4, 5, 6],
						extentSceneUnits: 20,
					},
				],
			},
		});
		const ambient = objects.lights[0];
		const firstLight = objects.lights[1];
		const secondLight = objects.lights[2];

		expect(objects.lights.length).toBe(3);
		expect(ambient instanceof THREE.AmbientLight).toBeTrue();
		expect(firstLight instanceof THREE.DirectionalLight).toBeTrue();
		expect(secondLight instanceof THREE.DirectionalLight).toBeTrue();
		expect(firstLight.intensity).toBeCloseTo(2);
		expect(secondLight.intensity).toBeCloseTo(2);
		expect(firstLight.castShadow).toBeTrue();
		expect(secondLight.castShadow).toBeTrue();
		expect(firstLight.shadow.intensity).toBe(2);
		expect(secondLight.shadow.intensity).toBe(2);
		expect(firstLight.shadow.camera.left).toBe(-1);
		expect(firstLight.shadow.camera.right).toBe(2);
		expect(firstLight.shadow.camera.top).toBe(3);
		expect(firstLight.shadow.camera.bottom).toBe(-4);
		expect(firstLight.shadow.radius).toBe(0);
		expect(secondLight.shadow.camera.left).toBe(-20);
		expect(firstLight.shadow.camera.layers.mask).toBe(1 << 5);
		expect(secondLight.shadow.camera.layers.mask).toBe(1 << 6);
		expect(firstLight.userData.shadowObjectKey).toBe('near-box');
		expect(secondLight.userData.shadowObjectKey).toBe('far-box');
		expect(objects.sceneObjects[0].position.toArray()).toEqual([1, 2, 3]);
		expect(objects.sceneObjects[1].position.toArray()).toEqual([4, 5, 6]);
		expect(objects.metadata.shadowObjects.length).toBe(2);
	});

	it('configures app-authored Three objects for distant source shadows', () => {
		const source = createDistantSource();
		const group = new THREE.Group();
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

		group.add(mesh);

		expect(source.configureThreeShadowObject(group)).toBe(group);
		expect(group.castShadow).toBeTrue();
		expect(group.receiveShadow).toBeTrue();
		expect(mesh.castShadow).toBeTrue();
		expect(mesh.receiveShadow).toBeTrue();
		expect(mesh.userData).toEqual(jasmine.objectContaining({
			algorithm32ShadowObject: true,
			shadowPolicy: 'three-shadow-map-from-distant-source-direction',
			shadowSourceKey: 'distant-sun',
		}));
		expect(group.userData.algorithm32ShadowConfiguration).toEqual(jasmine.objectContaining({
			owner: 'DistantSunLightSource',
			sourceKey: 'distant-sun',
			shadowPolicy: 'three-shadow-map-from-distant-source-direction',
			configuredNodeCount: 2,
		}));
	});

	it('fails loudly for invalid source configuration', () => {
		expect(() => new DistantSunLightSource()).toThrowError(/configuration/);
		expect(() => createDistantSource({ directionToLight: [0, 0, 0] })).toThrowError(/non-zero/);
		expect(() => createDistantSource({ spectralChannels: [] })).toThrowError(/spectral channels/);
		expect(() => createDistantSource({ cacheDirectionCount: 0 })).toThrowError(/cacheDirectionCount/);
		expect(() => createDistantSource({ cacheAltitudeLookup: { kind: 'other' } })).toThrowError(/cacheAltitudeLookup/);
		expect(() => createDistantSource().addSceneLighting()).toThrowError(/THREE/);
		expect(() => createDistantSource().configureThreeShadowObject(null)).toThrowError(/Three object/);
	});
});

function createDistantSource(overrides = {}) {
	return new DistantSunLightSource({
		directionToLight: [1, 0, 0],
		spectralChannels: createSpectralChannels(),
		angularRadiusRadians: 0.004,
		cacheAltitudeBinCount: 3,
		cacheDirectionCount: 4,
		cacheBoundaryAltitudeMeters: 2,
		...overrides,
	});
}

function createSpectralChannels() {
	return [
		{
			name: 'a',
			wavelength: {
				value: 500,
				units: 'nanometers',
			},
			solarIrradiance: 1,
		},
		{
			name: 'b',
			wavelength: {
				value: 600,
				units: 'nanometers',
			},
			solarIrradiance: 2,
		},
	];
}

function createSpectralBasis() {
	return {
		wavelengths: [
			{ value: 500, units: 'nanometers' },
			{ value: 600, units: 'nanometers' },
		],
	};
}
