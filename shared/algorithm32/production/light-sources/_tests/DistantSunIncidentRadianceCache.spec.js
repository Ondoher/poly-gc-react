import DistantSunIncidentRadianceCache from '../DistantSunIncidentRadianceCache.js';

describe('DistantSunIncidentRadianceCache', () => {
	it('generates altitude and direction build coordinates', () => {
		const cache = createDistantCache();
		const coordinates = [...cache.coordinates()];

		expect(coordinates.length).toBe(4);
		expect(coordinates[0]).toEqual(jasmine.objectContaining({
			coordinateKey: '0:0',
			coordinates: [0, 0],
			altitudeBinIndex: 0,
			directionIndex: 0,
			altitudeMeters: 2,
		}));
		expect(coordinates[0].incomingDirection.length).toBe(3);
		expect(coordinates[0].metadata.angularWeight).toBeCloseTo(2 * Math.PI, 12);
		expect(coordinates[0].metadata.boundarySamplePolicy).toBe('minimum-in-atmosphere-altitude');
		expect(coordinates[2].metadata.boundarySamplePolicy).toBe('uniform-bin-center');
	});

	it('builds cache values and returns directional sampler packets', () => {
		const cache = createDistantCache();
		const raySegment = createRaySegment();
		const points = Object.freeze([{ pointIndex: 0 }]);
		const geometry = {
			resolveCacheBuildRay: jasmine.createSpy('resolveCacheBuildRay').and.returnValue(raySegment),
		};
		const calculator = {
			buildEndpointTrapezoidPathIntegrationPoints: jasmine.createSpy('buildEndpointTrapezoidPathIntegrationPoints')
				.and.returnValue(points),
			computeRadiance: jasmine.createSpy('computeRadiance')
				.and.returnValue({ inScattered: [1, 2, 3, 4, 5] }),
		};

		for (const coordinate of cache.coordinates()) {
			cache.addCoordinateToCache({
				coordinate,
				geometry,
				calculator,
				pathIntervalCount: 3,
			});
		}

		const sampler = cache.createIncidentRadianceSampler();
		const samples = sampler({ coordinates: [0] });

		expect(cache.valueCount).toBe(4);
		expect(geometry.resolveCacheBuildRay).toHaveBeenCalledTimes(4);
		expect(calculator.buildEndpointTrapezoidPathIntegrationPoints)
			.toHaveBeenCalledWith(raySegment, 3);
		expect(samples.length).toBe(2);
		expect(samples[0].radiance).toEqual([1, 2, 3, 4, 5]);
		expect(samples[0].weight).toBeCloseTo(2 * Math.PI, 12);
	});

	it('creates an rgba32f shader payload descriptor from generated values', () => {
		const cache = createDistantCache();
		const geometry = { resolveCacheBuildRay: () => createRaySegment() };
		const calculator = createConstantCalculator([1, 2, 3, 4, 5]);

		for (const coordinate of cache.coordinates()) {
			cache.addCoordinateToCache({ coordinate, geometry, calculator });
		}

		const payload = cache.createShaderPayload();

		expect(payload).toEqual(jasmine.objectContaining({
			payloadKind: 'distant-incident-radiance-cache',
			dimensions: [2, 2, 5],
			format: 'float32-spectral',
		}));
		expect(payload.texture).toEqual(jasmine.objectContaining({
			kind: 'rgba32f-3d-texture-v1',
			width: 2,
			height: 2,
			depth: 2,
			spectralGroupSize: 4,
			spectralGroupCount: 2,
			spectralChannelCount: 5,
		}));
		expect(payload.texture.rgbaFloat32.length).toBe(32);
		expect(payload.texture.rgbaFloat32.slice(0, 4)).toEqual([1, 2, 3, 4]);
		expect(payload.metadata.uploadValueCount).toBe(32);
	});

	it('creates its cache-owned shader contribution', () => {
		const contribution = createDistantCache().createShaderContribution({
			descriptor: createShaderDescriptor(),
		});

		expect(contribution.id).toBe('cache-distant-l2-incident-radiance');
		expect(contribution.owner).toBe('cache');
		expect(contribution.provides).toEqual(['cache.lookupIncidentRadiance']);
		expect(contribution.bindingRequirements[0].valueKey).toBe('cache.incidentRadianceTexture');
	});

	it('stores zero radiance for cache coordinates without in-atmosphere contribution', () => {
		const cache = createDistantCache();
		const coordinates = [...cache.coordinates()].filter((coordinate) => coordinate.altitudeBinIndex === 0);
		const geometry = { resolveCacheBuildRay: () => null };
		const calculator = createConstantCalculator([9, 9, 9, 9, 9]);

		for (const coordinate of coordinates) {
			cache.addCoordinateToCache({ coordinate, geometry, calculator });
		}

		expect(cache.createIncidentRadianceSampler()({ coordinates: [0] }))
			.toEqual(jasmine.arrayContaining([
				jasmine.objectContaining({ radiance: [0, 0, 0, 0, 0] }),
			]));
	});

	it('fails loudly for missing build capability or missing generated values', () => {
		const cache = createDistantCache();
		const coordinate = [...cache.coordinates()][0];

		expect(() => cache.addCoordinateToCache({
			coordinate,
			geometry: {},
			calculator: createConstantCalculator([1, 2, 3, 4, 5]),
		})).toThrowError(/resolveCacheBuildRay/);

		expect(() => createDistantCache().createShaderPayload()).toThrowError(/missing 0:0/);
		expect(() => createDistantCache().createIncidentRadianceSampler()({ coordinates: [] }))
			.toThrowError(/altitude bin/);
	});
});

function createDistantCache(overrides = {}) {
	return new DistantSunIncidentRadianceCache({
		sourceKey: 'test-distant',
		bottomRadiusMeters: 0,
		topRadiusMeters: 100,
		altitudeBinCount: 2,
		directionCount: 2,
		directionToLight: [1, 0, 0],
		spectralBasis: createSpectralBasis(),
		...overrides,
	});
}

function createSpectralBasis() {
	return {
		wavelengths: [
			{ value: 450, units: 'nanometers' },
			{ value: 500, units: 'nanometers' },
			{ value: 550, units: 'nanometers' },
			{ value: 600, units: 'nanometers' },
			{ value: 650, units: 'nanometers' },
		],
	};
}

function createRaySegment() {
	return {
		ray: {
			origin: [0, 0, 0],
			direction: [1, 0, 0],
		},
		startDistanceMeters: 0,
		endDistanceMeters: 1,
	};
}

function createShaderDescriptor() {
	return {
		descriptorId: 'descriptor',
		variantId: 'variant',
		fingerprint: 'descriptor',
		compatibilityTags: [],
		spectralBasis: createSection('basis', {
			channelCount: 15,
		}),
		geometry: createSection('geometry', {
			kind: 'spherical-earth-geometry',
		}),
		atmosphere: createSection('atmosphere', {}),
		lightSource: createSection('light-source', {
			kind: 'distant-sun-light-source',
		}),
		cache: createSection('cache', {
			cacheKind: 'distant',
			metadata: {
				altitudeBinCount: 2,
				directionCount: 2,
			},
		}),
		transport: createSection('transport', {}),
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

function createConstantCalculator(inScattered) {
	return {
		buildEndpointTrapezoidPathIntegrationPoints() {
			return Object.freeze([{ pointIndex: 0 }]);
		},
		computeRadiance() {
			return { inScattered };
		},
	};
}
