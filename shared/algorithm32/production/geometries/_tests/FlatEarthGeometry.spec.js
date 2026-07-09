import FlatEarthGeometry from '../FlatEarthGeometry.js';

describe('FlatEarthGeometry', () => {
	it('describes flat geometry and frame facts', () => {
		const geometry = createGeometry();

		expect(geometry.id).toBe('flat-earth-geometry');
		expect(geometry.describe()).toEqual(jasmine.objectContaining({
			kind: 'flat-earth-geometry',
			observerPositionMeters: [0, 0, 2],
			sourcePositionMeters: [10, 0, 5],
			topAltitudeMeters: 12,
			sceneSkyRayLimitMeters: 100,
			hasObserverCenteredDome: false,
			cacheZBinCount: 3,
			cacheRhoBinCount: 3,
		}));
		expect(geometry.getFrameDescriptor()).toEqual({
			kind: 'observer-local-flat-frame',
			observerLocalSceneFrame: {
				up: [0, 0, 1],
				right: [1, 0, 0],
				forward: [0, -1, 0],
			},
		});
	});

	it('creates its geometry-owned shader contribution', () => {
		const contribution = createGeometry().createShaderContribution({
			descriptor: createDescriptor(),
		});

		expect(contribution.id).toBe('geometry-flat-earth');
		expect(contribution.owner).toBe('geometry');
		expect(contribution.provides).toEqual([
			'geometry.reconstructViewRay',
			'geometry.resolveAtmospherePath',
			'geometry.cacheAccessCoordinate',
		]);
	});

	it('resolves view rays against flat top, ground, and safe cap boundaries', () => {
		const geometry = createGeometry();

		expect(geometry.resolveViewRaySegment({ direction: [0, 0, 1] }).endDistanceMeters).toBe(10);
		expect(geometry.resolveViewRaySegment({ direction: [0, 0, -1] }).endDistanceMeters).toBe(2);
		expect(geometry.resolveViewRaySegment({ direction: [1, 0, 0] }).endDistanceMeters).toBe(100);
		expect(geometry.runtimeDiagnostics[0]).toEqual(jasmine.objectContaining({
			id: 'flat-ray-parallel-no-boundary-hit',
			severity: 'warning',
		}));
		expect(geometry.resolveViewRaySegment({
			direction: [0, 0, 1],
			maxDistanceMeters: 4,
		}).endDistanceMeters).toBe(4);
	});

	it('resolves atmosphere coordinates and records domain diagnostics', () => {
		const geometry = createGeometry();

		expect(geometry.resolveAtmosphereCoordinate([1, 2, 3])).toEqual({ altitudeMeters: 3 });
		expect(geometry.resolveAtmosphereCoordinate([1, 2, 20])).toEqual({ altitudeMeters: 20 });
		expect(geometry.runtimeDiagnostics[0]).toEqual(jasmine.objectContaining({
			id: 'flat-atmosphere-coordinate-out-of-domain',
			severity: 'warning',
		}));
	});

	it('builds flat atmosphere path samples and clips by source or ground', () => {
		const geometry = createGeometry();
		const path = geometry.resolveAtmospherePath({
			startPosition: [0, 0, 2],
			direction: [0, 0, 1],
			sampleCount: 2,
		});
		const clipped = geometry.resolveAtmospherePath({
			startPosition: [0, 0, 2],
			direction: [0, 0, 1],
			sourcePathLimit: { maxDistanceMeters: 3 },
			sampleCount: 2,
		});
		const blocked = geometry.resolveAtmospherePath({
			startPosition: [0, 0, 2],
			direction: [0, 0, -1],
			sampleCount: 2,
		});

		expect(path.lengthMeters).toBe(10);
		expect(path.samples.map((sample) => sample.measureMeters)).toEqual([2.5, 5, 2.5]);
		expect(clipped.lengthMeters).toBe(3);
		expect(blocked.blockedByGround).toBeTrue();
		expect(blocked.samples).toEqual([]);
	});

	it('resolves local source-relative facts and z/rho cache access', () => {
		const geometry = createGeometry();
		const sourceRelativePosition = geometry.resolveSourceRelativePosition({
			position: [0, 0, 2],
		});
		const access = geometry.resolveCacheAccess({
			sourceRelativePosition: {
				altitudeMeters: 4.9,
				radialDistanceFromSourceSubpointMeters: 9,
			},
		});

		expect(sourceRelativePosition.distanceFromSourceMeters).toBeCloseTo(Math.sqrt(109), 12);
		expect(sourceRelativePosition.directionToSource[0]).toBeCloseTo(10 / Math.sqrt(109), 12);
		expect(sourceRelativePosition.directionToSource[2]).toBeCloseTo(3 / Math.sqrt(109), 12);
		expect(sourceRelativePosition.radialDistanceFromSourceSubpointMeters).toBe(10);
		expect(sourceRelativePosition.altitudeMeters).toBe(2);
		expect(access).toEqual(jasmine.objectContaining({
			cacheKey: 'z:1/rho:1',
			coordinates: [1, 1],
		}));
	});

	it('maps observer-local scene positions and directions', () => {
		const geometry = createGeometry();

		expect(geometry.mapObserverLocalScenePointToModelPosition([1, 2, 3], {
			metersPerSceneUnit: 2,
		})).toEqual([2, -6, 4]);
		expect(geometry.mapObserverLocalSceneDirectionToModelDirection([0, 1, 0])).toEqual([0, -0, 1]);
		expect(geometry.mapModelPositionToObserverLocalScenePoint([2, -6, 4], {
			metersPerSceneUnit: 2,
		})).toEqual([1, 2, 3]);
	});

	it('resolves local cache-build rays from z/rho coordinates', () => {
		const geometry = createGeometry();
		const ray = geometry.resolveCacheBuildRay({
			altitudeMeters: 5,
			rhoMeters: 10,
			incomingDirection: [0, 0, 1],
		});
		const blockedRay = geometry.resolveCacheBuildRay({
			altitudeMeters: 5,
			rhoMeters: 10,
			incomingDirection: [0, 0, -1],
		});

		expect(ray.ray.origin).toEqual([0, 0, 5]);
		expect(ray.endDistanceMeters).toBe(7);
		expect(blockedRay).toBeNull();
	});

	it('supports an observer-centered dome boundary', () => {
		const geometry = createGeometry({
			observerCenteredDome: {
				apexAltitudeMeters: 12,
				maxObserverViewRayExtentMeters: 10,
			},
		});

		expect(geometry.configuration.observerCenteredDome).toEqual(jasmine.objectContaining({
			centerPolicy: 'observer-centered',
			sphereCenterMeters: [0, 0, 2],
			sphereRadiusMeters: 10,
		}));
		expect(geometry.distanceToObserverCenteredDomeBoundary([0, 0, 2], [1, 0, 0])).toBe(10);
	});

	it('fails loudly for invalid flat geometry inputs', () => {
		expect(() => new FlatEarthGeometry()).toThrowError(/configuration/);
		expect(() => createGeometry({ sourcePositionMeters: null })).toThrowError(/sourcePositionMeters/);
		expect(() => createGeometry({ topAltitudeMeters: 0 })).toThrowError(/topAltitudeMeters/);
		expect(() => createGeometry({ cacheZBinsMeters: [] })).toThrowError(/z\/rho/);
		expect(() => createGeometry().resolveAtmospherePath({ startPosition: [0, 0, 2] })).toThrowError(/direction/);
		expect(() => createGeometry().resolveCacheBuildRay({ altitudeMeters: 1 })).toThrowError(/incomingDirection/);
		expect(() => createGeometry().mapObserverLocalScenePointToModelPosition([1, 2, 3], {
			metersPerSceneUnit: 0,
		})).toThrowError(/metersPerSceneUnit/);
	});
});

function createGeometry(overrides = {}) {
	return new FlatEarthGeometry({
		observerPositionMeters: [0, 0, 2],
		sourcePositionMeters: [10, 0, 5],
		topAltitudeMeters: 12,
		sceneSkyRayLimitMeters: 100,
		sourceTransmittanceIntervalCount: 2,
		cacheZBinsMeters: [0, 5, 10],
		cacheRhoBinsMeters: [0, 10, 20],
		...overrides,
	});
}

function createDescriptor() {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 15,
		}),
		geometry: createSection('geometry', createGeometry().describe()),
		atmosphere: createSection('atmosphere', {
			kind: 'canonical-atmosphere',
			constants: {},
		}),
		lightSource: createSection('light-source', {
			kind: 'local-sun-light-source',
			sourceKey: 'local-test',
			referenceDistanceMeters: 4800000,
			referenceSpectralIncidentScale: 1.25,
			radiusMeters: 25749.504,
			distanceFalloff: true,
		}),
		cache: createSection('cache', {
			cacheKind: 'local',
			metadata: {
				zBinCount: 3,
				rhoBinCount: 3,
				directionCount: 9,
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
