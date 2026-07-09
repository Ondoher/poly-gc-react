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
