import * as THREE from 'three';

import LocalSunIncidentRadianceCache from '../LocalSunIncidentRadianceCache.js';
import LocalSunLightSource from '../LocalSunLightSource.js';

describe('LocalSunLightSource', () => {
	it('describes finite source and incident cache policy', () => {
		const source = createLocalSource();

		expect(source.id).toBe('test-local');
		expect(source.describe()).toEqual(jasmine.objectContaining({
			kind: 'local-sun-light-source',
			sourceKey: 'test-local',
			referenceDistanceMeters: 10,
			radiusMeters: 1,
			distanceFalloff: true,
			spectralChannelCount: 2,
		}));
		expect(source.describe().incidentRadianceCachePolicy).toEqual({
				zBinCount: 2,
				rhoBinCount: 1,
				directionCount: 3,
				lookupPolicy: 'nearest-neighbor-poc-grid',
		});
	});

	it('creates a source-owned local incident-radiance cache', () => {
		const source = createLocalSource();
		const cache = source.createIncidentRadianceCache();

		expect(cache instanceof LocalSunIncidentRadianceCache).toBeTrue();
		expect(cache.descriptor).toEqual(jasmine.objectContaining({
			cacheKind: 'local',
			sourceKey: 'test-local',
			payloadKind: 'local-incident-radiance-cache',
			payloadDimensions: [2, 1, 3, 2],
		}));
		expect(cache.descriptor.metadata).toEqual(jasmine.objectContaining({
			zBinCount: 2,
			rhoBinCount: 1,
			directionCount: 3,
		}));
		expect([...cache.coordinates()].length).toBe(6);
	});

	it('samples direct lighting with finite-distance falloff', () => {
		const source = createLocalSource();
		const sample = source.sampleDirectLighting({
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 0, 2],
			},
		});

		expect(sample.incidentRadiance).toEqual([0.5, 1]);
		expect(sample.directionToLight).toEqual([0, 0, 1]);
		expect(sample.metadata).toEqual(jasmine.objectContaining({
			sourceKey: 'test-local',
			distanceFromSourceMeters: 20,
			safeDistanceMeters: 20,
			radiusMeters: 1,
			referenceDistanceMeters: 10,
			referenceSpectralIncidentScale: 2,
			falloffScale: 0.25,
			incidentScale: 0.5,
			distanceClampedToRadius: false,
			spectralScaleKind: 'neutral-no-tint',
		}));
	});

	it('supports radius clamping and disabled distance falloff', () => {
		const clamped = createLocalSource().sampleDirectLighting({
			sourceRelativePosition: {
				distanceFromSourceMeters: 0.5,
				directionToSource: [0, 1, 0],
			},
		});
		const noFalloff = createLocalSource({ distanceFalloff: false }).sampleDirectLighting({
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
		});

		expect(clamped.incidentRadiance).toEqual([200, 400]);
		expect(clamped.metadata).toEqual(jasmine.objectContaining({
			safeDistanceMeters: 1,
			distanceClampedToRadius: true,
			incidentScale: 200,
		}));
		expect(noFalloff.incidentRadiance).toEqual([2, 4]);
		expect(noFalloff.metadata).toEqual(jasmine.objectContaining({
			falloffScale: 1,
			incidentScale: 2,
		}));
	});

	it('resolves finite source path limits', () => {
		const source = createLocalSource();

		expect(source.resolveSourcePathLimit({
			sourceRelativePosition: { distanceFromSourceMeters: 20 },
		})).toEqual({
			maxDistanceMeters: 20,
			reason: 'finite-local-source-distance',
		});
		expect(source.resolveSourcePathLimit()).toEqual({
			maxDistanceMeters: null,
			reason: 'finite-local-source-distance',
		});
	});

	it('resolves reference-relative scene light percentages', () => {
		const source = createLocalSource();
		const reference = source.resolveSceneLightPercent({
			sourceRelativePosition: {
				distanceFromSourceMeters: 10,
				directionToSource: [0, 1, 0],
			},
		});
		const half = source.resolveSceneLightPercent({
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
		});

		expect(reference.directLightPercent).toBe(1);
		expect(reference.ambientLightPercent).toBe(1);
		expect(half.directLightPercent).toBeCloseTo(0.25, 12);
		expect(half.ambientLightPercent).toBeCloseTo(0.25, 12);
		expect(half.policy).toBe('local-source-reference-incident-scene-light-percent');
	});

	it('creates source-owned Three point and ambient lights for endpoints', () => {
		const objects = createLocalSource().addSceneLighting({
			THREE,
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
			calibrationScalar: 2,
			ambientIntensity: 0.5,
			endpointSceneLightScalePolicy: 'observer-incident-scale',
		});
		const ambient = objects.lights[0];
		const pointLight = objects.lights[1];

		expect(ambient instanceof THREE.AmbientLight).toBeTrue();
		expect(pointLight instanceof THREE.PointLight).toBeTrue();
		expect(pointLight.position.toArray()).toEqual([0, 10, 0]);
		expect(pointLight.decay).toBe(0);
		expect(ambient.intensity).toBeCloseTo(0.17, 12);
		expect(pointLight.intensity).toBeCloseTo(1, 12);
		expect(pointLight.userData).toEqual(jasmine.objectContaining({
			algorithm32SourceLight: true,
			sourceKey: 'test-local',
			observerIncidentScale: 0.5,
			endpointSceneIncidentScale: 0.5,
			endpointSceneLightScalePolicy: 'observer-incident-scale',
		}));
		expect(objects.sceneObjects).toEqual([]);
		expect(objects.metadata).toEqual(jasmine.objectContaining({
			owner: 'LocalSunLightSource',
			lightingPolicy: 'source-driven-flat-local-point-light',
			ambientIntensityRange: {
				min: 0.06,
				max: 0.5,
			},
			ambientLightPercent: 0.25,
			ambientIntensity: 0.16999999999999998,
			pointLightIntensity: 1,
			directionToSourceScene: [0, 1, 0],
		}));
	});

	it('scales ambient lighting between configured bounds with local light percent', () => {
		const objects = createLocalSource().addSceneLighting({
			THREE,
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
			ambientIntensityRange: {
				min: 0.2,
				max: 1,
			},
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.4, 12);
		expect(objects.metadata.ambientLightPercent).toBeCloseTo(0.25, 12);
		expect(objects.metadata.ambientIntensityRange).toEqual({
			min: 0.2,
			max: 1,
		});
	});

	it('defaults ambient bounds to absolute scene-light intensities', () => {
		const objects = createLocalSource().addSceneLighting({
			THREE,
			sourceRelativePosition: {
				distanceFromSourceMeters: 10,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.5, 12);
		expect(objects.metadata.ambientIntensityRange).toEqual({
			min: 0.06,
			max: 0.5,
		});
		expect(objects.metadata.ambientLightPercent).toBe(1);
	});

	it('adds observer-scaled scene lighting to a supplied Three scene', () => {
		const scene = new THREE.Scene();
		const objects = createLocalSource().addSceneLighting({
			THREE,
			scene,
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
			calibrationScalar: 4,
			ambientIntensity: 1,
			endpointSceneLightScalePolicy: 'observer-incident-scale',
		});

		expect(objects.lights[0] instanceof THREE.AmbientLight).toBeTrue();
		expect(objects.lights[1] instanceof THREE.PointLight).toBeTrue();
		expect(objects.lights[0].intensity).toBeCloseTo(0.295, 12);
		expect(objects.lights[1].intensity).toBeCloseTo(2, 12);
		expect(scene.children).toContain(objects.lights[0]);
		expect(scene.children).toContain(objects.lights[1]);
		expect(objects.metadata.ambientIntensity).toBeCloseTo(0.295, 12);
	});

	it('creates source-owned Three directional shadow lights for endpoints', () => {
		const objects = createLocalSource().addSceneLighting({
			THREE,
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
			shadow: {
				enabled: true,
				focusSceneUnits: [1, 2, 3],
				extentSceneUnits: 5,
				lightDistanceSceneUnits: 12,
				mapSize: 64,
				shadowIntensity: 0.75,
			},
		});
		const sourceLight = objects.lights[1];
		const target = objects.sceneObjects[0];
		const expectedShadowDirection = [-1 / Math.sqrt(74), 8 / Math.sqrt(74), -3 / Math.sqrt(74)];

		expect(sourceLight instanceof THREE.DirectionalLight).toBeTrue();
		expectVectorCloseTo(sourceLight.position.toArray(), [
			1 + expectedShadowDirection[0] * 12,
			2 + expectedShadowDirection[1] * 12,
			3 + expectedShadowDirection[2] * 12,
		]);
		expect(sourceLight.castShadow).toBeTrue();
		expect(sourceLight.shadow.mapSize.width).toBe(64);
		expect(sourceLight.shadow.intensity).toBe(0.75);
		expect(sourceLight.shadow.camera.left).toBe(-5);
		expect(sourceLight.target).toBe(target);
		expectVectorCloseTo(sourceLight.userData.directionToSourceScene, expectedShadowDirection);
		expect(target.position.toArray()).toEqual([1, 2, 3]);
		expect(objects.metadata).toEqual(jasmine.objectContaining({
			lightingPolicy: 'source-driven-flat-local-directional-shadow-light',
			shadowPolicy: 'three-shadow-map-from-local-source-direction',
			shadowDirectionPolicy: 'per-shadow-focus-to-local-source-position',
		}));
	});

	it('creates one source-owned directional shadow light per shadow object', () => {
		const objects = createLocalSource().addSceneLighting({
			THREE,
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 1, 0],
			},
			sourcePositionSceneUnits: [0, 10, 0],
			observerScenePositionUnits: [0, 0, 0],
			shadow: {
				enabled: true,
				mapSize: 64,
				objects: [
					{
						objectKey: 'near-box',
						layerIndex: 5,
						focusSceneUnits: [1, 2, 3],
						extentSceneUnits: 5,
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
		const firstLight = objects.lights[1];
		const secondLight = objects.lights[2];

		expect(objects.lights.length).toBe(3);
		expect(firstLight instanceof THREE.DirectionalLight).toBeTrue();
		expect(secondLight instanceof THREE.DirectionalLight).toBeTrue();
		expect(firstLight.intensity).toBeCloseTo(secondLight.intensity);
		expect(firstLight.castShadow).toBeTrue();
		expect(secondLight.castShadow).toBeTrue();
		expect(firstLight.shadow.intensity).toBe(2);
		expect(secondLight.shadow.intensity).toBe(2);
		expect(firstLight.shadow.camera.left).toBe(-5);
		expect(secondLight.shadow.camera.left).toBe(-20);
		expect(firstLight.shadow.camera.layers.mask).toBe(1 << 5);
		expect(secondLight.shadow.camera.layers.mask).toBe(1 << 6);
		expect(firstLight.userData.shadowObjectKey).toBe('near-box');
		expect(secondLight.userData.shadowObjectKey).toBe('far-box');
		expect(objects.sceneObjects[0].position.toArray()).toEqual([1, 2, 3]);
		expect(objects.sceneObjects[1].position.toArray()).toEqual([4, 5, 6]);
		expect(objects.metadata.shadowObjects.length).toBe(2);
	});

	it('configures app-authored Three objects for local source shadows', () => {
		const source = createLocalSource();
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));

		expect(source.configureThreeShadowObject(mesh, {
			receiveShadow: false,
			includeDescendants: false,
			layerIndex: 5,
		})).toBe(mesh);
		expect(mesh.castShadow).toBeTrue();
		expect(mesh.receiveShadow).toBeFalse();
		expect(mesh.layers.mask & (1 << 5)).toBe(1 << 5);
		expect(mesh.userData).toEqual(jasmine.objectContaining({
			algorithm32ShadowObject: true,
			shadowPolicy: 'three-shadow-map-from-local-source-direction',
			shadowSourceKey: 'test-local',
			shadowLayerIndex: 5,
		}));
		expect(mesh.userData.algorithm32ShadowConfiguration).toEqual(jasmine.objectContaining({
			owner: 'LocalSunLightSource',
			sourceKey: 'test-local',
			shadowPolicy: 'three-shadow-map-from-local-source-direction',
			receiveShadow: false,
			includeDescendants: false,
			configuredNodeCount: 1,
		}));
	});

	it('fails loudly for invalid source configuration or lighting requests', () => {
		expect(() => new LocalSunLightSource()).toThrowError(/configuration/);
		expect(() => createLocalSource({ sourceKey: '' })).toThrowError(/sourceKey/);
		expect(() => createLocalSource({ spectralChannels: [] })).toThrowError(/spectral channels/);
		expect(() => createLocalSource({ referenceDistanceMeters: 0 })).toThrowError(/valid ranges/);
		expect(() => createLocalSource({ cacheZBinsMeters: [] })).toThrowError(/z\/rho/);
		expect(() => createLocalSource().sampleDirectLighting()).toThrowError(/sourceRelativePosition/);
		expect(() => createLocalSource().sampleDirectLighting({
			sourceRelativePosition: {
				distanceFromSourceMeters: 20,
				directionToSource: [0, 0, 0],
			},
		})).toThrowError(/non-zero/);
		expect(() => createLocalSource().addSceneLighting({ THREE })).toThrowError(/sourcePositionSceneUnits/);
		expect(() => createLocalSource().configureThreeShadowObject(null)).toThrowError(/Three object/);
	});
});

function createLocalSource(overrides = {}) {
	return new LocalSunLightSource({
		sourceKey: 'test-local',
		spectralChannels: createSpectralChannels(),
		referenceDistanceMeters: 10,
		referenceSpectralIncidentScale: 2,
		radiusMeters: 1,
		distanceFalloff: true,
		cacheZBinsMeters: [1, 2],
		cacheRhoBinsMeters: [10],
		cacheDirectionCount: 3,
		...overrides,
	});
}

function expectVectorCloseTo(actual, expected, precision = 12) {
	expect(actual.length).toBe(expected.length);
	for (let index = 0; index < expected.length; index += 1) {
		expect(actual[index]).toBeCloseTo(expected[index], precision);
	}
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
