import * as THREE from 'three';

import SphericalEarthGeometry from '../SphericalEarthGeometry.js';

describe('SphericalEarthGeometry', () => {
	it('describes spherical geometry and frame facts', () => {
		const geometry = createGeometry();

		expect(geometry.id).toBe('spherical-earth-geometry');
		expect(geometry.describe()).toEqual(jasmine.objectContaining({
			kind: 'spherical-earth-geometry',
			bottomRadiusMeters: 10,
			topRadiusMeters: 20,
			observerHeightMeters: 1,
			cacheAltitudeBinCount: 2,
			cacheBoundaryAltitudeMeters: 2,
		}));
		expect(geometry.getFrameDescriptor()).toEqual(jasmine.objectContaining({
			kind: 'observer-local-spherical-frame',
			observerUpDirection: [1, 0, 0],
		}));
	});

	it('creates its geometry-owned shader contribution', () => {
		const contribution = createGeometry().createShaderContribution({
			descriptor: createDescriptor(),
		});

		expect(contribution.id).toBe('geometry-spherical-earth');
		expect(contribution.owner).toBe('geometry');
		expect(contribution.provides).toEqual([
			'geometry.reconstructViewRay',
			'geometry.resolveAtmospherePath',
			'geometry.cacheAccessCoordinate',
		]);
	});

	it('can reconstruct shader rays from a model-space Three scene frame', () => {
		const geometry = createGeometry({
			sceneFrame: {
				kind: 'model-space',
			},
		});
		const descriptor = createDescriptor(geometry);
		const contribution = geometry.createShaderContribution({ descriptor });
		const constantsBlock = contribution.functions.find((block) => block.id === 'geometry-constants');

		expect(geometry.getFrameDescriptor().kind).toBe('model-space-spherical-frame');
		expect(geometry.describe().sceneFrame.kind).toBe('model-space');
		expect(constantsBlock.code).toContain('const vec3 GEOMETRY_OBSERVER_UP_DIRECTION = vec3(0.0, 1.0, 0.0);');
		expect(constantsBlock.code).toContain('const vec3 GEOMETRY_OBSERVER_RIGHT_DIRECTION = vec3(1.0, 0.0, 0.0);');
		expect(constantsBlock.code).toContain('const vec3 GEOMETRY_OBSERVER_FORWARD_DIRECTION = vec3(0.0, 0.0, 1.0);');
	});

	it('creates geometry-owned Three spherical endpoint objects', () => {
		const endpoints = createGeometry().createThreeEndpointObjects({
			metersPerSceneUnit: 2,
			name: 'test-sphere',
			visualMaterialLighting: 'lambert',
		});
		const visualObject = endpoints.visualObjects[0];
		const raycastObject = endpoints.raycastObjects[0];
		const hits = [];

		raycastObject.updateMatrixWorld(true);
		raycastObject.raycast(new THREE.Raycaster(
			new THREE.Vector3(0, 2, 0),
			new THREE.Vector3(0, -1, 0),
			0,
			100,
		), hits);

		expect(visualObject instanceof THREE.Mesh).toBeTrue();
		expect(visualObject.geometry.type).toBe('SphereGeometry');
		expect(visualObject.material.type).toBe('MeshLambertMaterial');
		expect(visualObject.position.toArray()).toEqual([0, -5, 0]);
		expect(visualObject.userData).toEqual(jasmine.objectContaining({
			algorithm32SceneInput: true,
			algorithm32EndpointRole: 'geometry-ground-visual',
			endpointKind: 'geometry-ground-boundary',
			metersPerSceneUnit: 2,
		}));
		expect(raycastObject.userData).toEqual(jasmine.objectContaining({
			algorithm32SceneInput: true,
			algorithm32EndpointRole: 'geometry-ground-exact-raycast',
			endpointKind: 'geometry-ground-boundary',
			metersPerSceneUnit: 2,
		}));
		expect(hits.length).toBe(1);
		expect(hits[0].distance).toBeCloseTo(2, 12);
		expect(endpoints.metadata).toEqual(jasmine.objectContaining({
			owner: 'SphericalEarthGeometry',
			sceneFrameKind: 'observer-local',
			radiusSceneUnits: 5,
			centerSceneUnits: [0, -5, 0],
			shape: 'sphere',
			visualMeshKind: 'sphere',
		}));
	});

	it('can create a local spherical visual patch while exact raycasting owns ground hits', () => {
		const endpoints = createGeometry().createThreeEndpointObjects({
			metersPerSceneUnit: 2,
			name: 'test-sphere',
			widthSegments: 4,
			heightSegments: 2,
			shadow: {
				enabled: true,
			},
			groundVisualMesh: {
				kind: 'local-spherical-patch',
				xExtentSceneUnits: 1,
				zMinSceneUnits: -1,
				zMaxSceneUnits: 1,
				surfaceLiftSceneUnits: 0.5,
			},
		});
		const visualObject = endpoints.visualObjects[0];
		const raycastObject = endpoints.raycastObjects[0];
		const hits = [];
		const positions = visualObject.geometry.getAttribute('position');

		raycastObject.updateMatrixWorld(true);
		raycastObject.raycast(new THREE.Raycaster(
			new THREE.Vector3(0, 2, 0),
			new THREE.Vector3(0, -1, 0),
			0,
			100,
		), hits);

		expect(visualObject.geometry.type).toBe('BufferGeometry');
		expect(visualObject.position.toArray()).toEqual([0, 0, 0]);
		expect(visualObject.receiveShadow).toBeTrue();
		expect(positions.count).toBe(15);
		expect(positions.getY(7)).toBeCloseTo(0.5, 12);
		expect(visualObject.userData.algorithm32GroundVisualMesh).toEqual(jasmine.objectContaining({
			kind: 'local-spherical-patch',
			hitPolicy: 'visual-mesh-not-semantic-hit-authority',
			shadowReceiverPolicy: 'geometry-owned-ground-receives-three-shadow-map',
		}));
		expect(hits.length).toBe(1);
		expect(hits[0].distance).toBeCloseTo(2, 12);
		expect(endpoints.metadata).toEqual(jasmine.objectContaining({
			shape: 'local-spherical-patch',
			visualMeshKind: 'local-spherical-patch',
			raycastPolicy: 'geometry-owned-exact-sphere-raycast',
			sceneCapturePolicy: 'visual-mesh-raster-depth',
			shadow: jasmine.objectContaining({
				enabled: true,
				receiveShadow: true,
				shadowPolicy: 'geometry-ground-receives-source-shadow-map',
			}),
			groundPatch: jasmine.objectContaining({
				xRangeSceneUnits: [-1, 1],
				zRangeSceneUnits: [-1, 1],
				xSegments: 4,
				zSegments: 2,
				surfaceLiftSceneUnits: 0.5,
			}),
		}));
	});

	it('centers model-space spherical endpoint objects at the model origin', () => {
		const endpoints = createGeometry({
			sceneFrame: {
				kind: 'model-space',
			},
		}).createThreeEndpointObjects({
			metersPerSceneUnit: 2,
		});
		const visualObject = endpoints.visualObjects[0];

		expect(visualObject.position.toArray()).toEqual([0, 0, 0]);
		expect(endpoints.metadata).toEqual(jasmine.objectContaining({
			sceneFrameKind: 'model-space',
			centerSceneUnits: [0, 0, 0],
		}));
	});

	it('maps ground scene offsets through spherical geometry in observer-local frame', () => {
		const geometry = createGeometry();

		expect(geometry.mapGroundOffsetToScenePoint([1, 2], {
			metersPerSceneUnit: 2,
		})).toEqual([
			1,
			Math.sqrt(25 - 5) - 5,
			2,
		]);
	});

	it('maps observer-local scene positions and directions into spherical model space', () => {
		const geometry = createGeometry();
		const modelSpaceGeometry = createGeometry({
			observerUpDirection: [0, 1, 0],
			sceneFrame: {
				kind: 'model-space',
			},
		});

		expect(geometry.mapObserverLocalScenePointToModelPosition([1, 2, 3], {
			metersPerSceneUnit: 2,
		})).toEqual([14, 2, -6]);
		expect(geometry.mapObserverLocalSceneDirectionToModelDirection([0, 1, 0])).toEqual([1, 0, 0]);
		expect(modelSpaceGeometry.mapObserverLocalScenePointToModelPosition([1, 2, 3], {
			metersPerSceneUnit: 2,
		})).toEqual([2, 4, 6]);
		expect(modelSpaceGeometry.mapObserverLocalSceneDirectionToModelDirection([0, 1, 0])).toEqual([0, 1, 0]);
	});

	it('maps ground scene offsets through spherical geometry in model-space frame', () => {
		const geometry = createGeometry({
			observerUpDirection: [0, 1, 0],
			sceneFrame: {
				kind: 'model-space',
			},
		});
		const surfacePoint = geometry.mapGroundOffsetToScenePoint([1, 2], {
			metersPerSceneUnit: 2,
		});
		const elevatedPoint = geometry.mapGroundOffsetToScenePoint([0, 0], {
			metersPerSceneUnit: 2,
			heightAboveGroundSceneUnits: 3,
		});

		expect(surfacePoint[0]).toBeCloseTo(1, 12);
		expect(surfacePoint[1]).toBeCloseTo(Math.sqrt(25 - 5), 12);
		expect(surfacePoint[2]).toBeCloseTo(2, 12);
		expect(elevatedPoint).toEqual([0, 8, 0]);
	});

	it('projects scene points to the local spherical ground receiver', () => {
		const geometry = createGeometry({
			observerUpDirection: [0, 1, 0],
			sceneFrame: {
				kind: 'model-space',
			},
		});

		expect(geometry.projectScenePointToGroundAlongDirection([0, 8, 0], [0, -1, 0], {
			metersPerSceneUnit: 2,
		})).toEqual([0, 5, 0]);
		expect(geometry.projectScenePointToGroundAlongDirection([0, 4.99999, 0], [0, -1, 0], {
			metersPerSceneUnit: 2,
			surfaceToleranceSceneUnits: 0.0001,
		})).toEqual([0, 5, 0]);
		expect(geometry.projectScenePointToGroundAlongDirection([0, 6, 0], [0, 1, 0], {
			metersPerSceneUnit: 2,
		})).toEqual([0, 5, 0]);
	});

	it('resolves a geometry-owned scene-depth cap from horizon distance', () => {
		const geometry = createGeometry();
		const modelSpaceGeometry = createGeometry({
			sceneFrame: {
				kind: 'model-space',
			},
		});

		expect(geometry.resolveSceneDepthMaxMeters()).toBeCloseTo(Math.sqrt(21), 12);
		expect(modelSpaceGeometry.resolveSceneDepthMaxMeters({
			cameraPositionMeters: [12, 0, 0],
		})).toBeCloseTo(Math.sqrt(44), 12);
		expect(modelSpaceGeometry.resolveSceneDepthMaxMeters({
			camera: {
				position: {
					x: 12,
					y: 0,
					z: 0,
				},
			},
			metersPerSceneUnit: 1,
		})).toBeCloseTo(Math.sqrt(44), 12);
		expect(modelSpaceGeometry.resolveSceneDepthMaxMeters({
			cameraPositionMeters: [12, 0, 0],
			endpointPositionsMeters: [
				[12, 0, 9],
			],
		})).toBeCloseTo(9, 12);
		expect(geometry.resolveSceneDepthMaxMeters({
			cameraPositionSceneUnits: [0, 1, 0],
			endpointPositionsSceneUnits: [
				[10, 1, 0],
			],
			metersPerSceneUnit: 1,
		})).toBeCloseTo(10, 12);
		expect(modelSpaceGeometry.resolveSceneDepthMaxMeters({
			camera: {
				position: {
					x: 6,
					y: 0,
					z: 0,
				},
			},
			endpointPositionsSceneUnits: [
				[6, 0, 5],
			],
			metersPerSceneUnit: 2,
		})).toBeCloseTo(10, 12);
	});

	it('resolves view rays against atmosphere and ground boundaries', () => {
		const geometry = createGeometry();

		expect(geometry.resolveViewRaySegment({
			origin: [11, 0, 0],
			direction: [1, 0, 0],
		}).endDistanceMeters).toBeCloseTo(9, 12);
		expect(geometry.resolveViewRaySegment({
			origin: [11, 0, 0],
			direction: [-1, 0, 0],
		}).endDistanceMeters).toBeCloseTo(1, 12);
		expect(geometry.resolveViewRaySegment({
			origin: [11, 0, 0],
			direction: [-1, 0, 0],
			groundBoundaryMode: 'scene-hit-owned',
		}).endDistanceMeters).toBeCloseTo(31, 12);
		expect(geometry.resolveViewRaySegment({
			origin: [11, 0, 0],
			direction: [1, 0, 0],
			maxDistanceMeters: 4,
		}).endDistanceMeters).toBe(4);
	});

	it('resolves atmosphere coordinates and source-relative packets', () => {
		const geometry = createGeometry();

		expect(geometry.resolveAtmosphereCoordinate([12, 0, 0])).toEqual({
			altitudeMeters: 2,
		});
		expect(geometry.resolveSourceRelativePosition({ position: [12, 0, 0] })).toEqual({
			directionFromSource: [-0, -1, -0],
			directionToSource: [0, 1, 0],
			distanceFromSourceMeters: null,
		});
	});

	it('builds endpoint/trapezoid atmosphere path samples', () => {
		const path = createGeometry().resolveAtmospherePath({
			startPosition: [11, 0, 0],
			direction: [1, 0, 0],
			sampleCount: 2,
		});

		expect(path.lengthMeters).toBeCloseTo(9, 12);
		expect(path.samples.length).toBe(3);
		expect(path.samples.map((sample) => sample.measureMeters)).toEqual([2.25, 4.5, 2.25]);
		expect(path.samples[0].atmosphereCoordinate.altitudeMeters).toBeCloseTo(1, 12);
		expect(path.samples[2].atmosphereCoordinate.altitudeMeters).toBeCloseTo(10, 12);
	});

	it('clips source paths by source limit or reports ground blocking', () => {
		const geometry = createGeometry();
		const clipped = geometry.resolveAtmospherePath({
			startPosition: [11, 0, 0],
			direction: [1, 0, 0],
			sourcePathLimit: { maxDistanceMeters: 4 },
			sampleCount: 2,
		});
		const blocked = geometry.resolveAtmospherePath({
			startPosition: [11, 0, 0],
			direction: [-1, 0, 0],
			sampleCount: 2,
		});

		expect(clipped.lengthMeters).toBe(4);
		expect(clipped.metadata.endDistanceMeters).toBe(4);
		expect(blocked.blockedByGround).toBeTrue();
		expect(blocked.samples).toEqual([]);
	});

	it('resolves distant cache access and cache-build rays', () => {
		const geometry = createGeometry();
		const access = geometry.resolveCacheAccess({
			atmosphereCoordinate: { altitudeMeters: 0 },
		});
		const highAccess = geometry.resolveCacheAccess({
			atmosphereCoordinate: { altitudeMeters: 9 },
		});
		const ray = geometry.resolveCacheBuildRay({
			altitudeMeters: 2,
			incomingDirection: [1, 0, 0],
		});
		const blockedRay = geometry.resolveCacheBuildRay({
			altitudeMeters: 2,
			incomingDirection: [-1, 0, 0],
		});

		expect(access).toEqual(jasmine.objectContaining({
			cacheKey: 'altitude:0',
			coordinates: [0],
		}));
		expect(access.metadata.boundaryClampApplied).toBeTrue();
		expect(highAccess.coordinates).toEqual([1]);
		expect(ray.endDistanceMeters).toBeCloseTo(8, 12);
		expect(blockedRay).toBeNull();
	});

	it('fails loudly for invalid geometry inputs', () => {
		expect(() => new SphericalEarthGeometry()).toThrowError(/configuration/);
		expect(() => createGeometry({ topRadiusMeters: 10 })).toThrowError(/top above bottom/);
		expect(() => createGeometry({ observerUpDirection: [0, 0, 0] })).toThrowError(/non-zero/);
		expect(() => createGeometry().resolveViewRaySegment({ groundBoundaryMode: 'other' })).toThrowError(/groundBoundaryMode/);
		expect(() => createGeometry().resolveAtmospherePath({ startPosition: [11, 0, 0] })).toThrowError(/direction/);
		expect(() => createGeometry().resolveCacheBuildRay({ altitudeMeters: 1 })).toThrowError(/incomingDirection/);
		expect(() => createGeometry().createThreeEndpointObjects({
			groundVisualMesh: {
				kind: 'other',
			},
		})).toThrowError(/groundVisualMesh/);
	});
});

function createGeometry(overrides = {}) {
	return new SphericalEarthGeometry({
		bottomRadiusMeters: 10,
		topRadiusMeters: 20,
		observerHeightMeters: 1,
		observerUpDirection: [1, 0, 0],
		sourceDirection: [0, 1, 0],
		cacheAltitudeBinCount: 2,
		cacheBoundaryAltitudeMeters: 2,
		sourceTransmittanceIntervalCount: 2,
		...overrides,
	});
}

function createDescriptor(geometry = createGeometry()) {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 15,
		}),
		geometry: createSection('geometry', geometry.describe()),
		atmosphere: createSection('atmosphere', {
			kind: 'canonical-atmosphere',
			constants: {},
		}),
		lightSource: createSection('light-source', {
			kind: 'distant-sun-light-source',
			directionToLight: [0, 1, 0],
		}),
		cache: createSection('cache', {
			cacheKind: 'distant',
			metadata: {
				altitudeBinCount: 2,
				directionCount: 4,
			},
		}),
		transport: createSection('transport', {
			execution: {
				pathIntervalCount: 2,
				sourceTransmittanceIntervalCount: 2,
			},
		}),
		color: createSection('color', {}),
		runtime: createSection('runtime', {}),
	};
}

function createSection(fingerprint, facts) {
	return {
		descriptorId: fingerprint,
		fingerprint,
		compatibilityTags: [fingerprint],
		facts,
	};
}
