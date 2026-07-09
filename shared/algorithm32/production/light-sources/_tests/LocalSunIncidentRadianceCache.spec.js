import LocalSunIncidentRadianceCache from '../LocalSunIncidentRadianceCache.js';

describe('LocalSunIncidentRadianceCache', () => {
	it('generates z, rho, and direction build coordinates', () => {
		const cache = createLocalCache();
		const coordinates = [...cache.coordinates()];

		expect(coordinates.length).toBe(4);
		expect(coordinates[0]).toEqual(jasmine.objectContaining({
			coordinateKey: '0:0:0',
			coordinates: [0, 0, 0],
			zBinIndex: 0,
			rhoBinIndex: 0,
			directionIndex: 0,
			altitudeMeters: 1,
			rhoMeters: 10,
		}));
		expect(coordinates[0].incomingDirection.length).toBe(3);
		expect(coordinates[0].metadata).toEqual(jasmine.objectContaining({
			angularWeight: 2 * Math.PI,
			coordinateSystem: 'local-source-z-rho',
		}));
	});

	it('builds cache values and returns local directional sampler packets', () => {
		const cache = createLocalCache();
		const raySegment = createRaySegment();
		const points = Object.freeze([{ pointIndex: 0 }]);
		const geometry = {
			resolveCacheBuildRay: jasmine.createSpy('resolveCacheBuildRay').and.returnValue(raySegment),
		};
		const calculator = {
			buildEndpointTrapezoidPathIntegrationPoints: jasmine.createSpy('buildEndpointTrapezoidPathIntegrationPoints')
				.and.returnValue(points),
			computeRadiance: jasmine.createSpy('computeRadiance')
				.and.returnValue({ inScattered: [5, 4, 3, 2, 1] }),
		};

		for (const coordinate of cache.coordinates()) {
			cache.addCoordinateToCache({
				coordinate,
				geometry,
				calculator,
				pathIntervalCount: 4,
			});
		}

		const samples = cache.createIncidentRadianceSampler()({ coordinates: [0, 0] });

		expect(cache.valueCount).toBe(4);
		expect(geometry.resolveCacheBuildRay).toHaveBeenCalledTimes(4);
		expect(calculator.buildEndpointTrapezoidPathIntegrationPoints)
			.toHaveBeenCalledWith(raySegment, 4);
		expect(samples.length).toBe(2);
		expect(samples[0].radiance).toEqual([5, 4, 3, 2, 1]);
		expect(samples[0].weight).toBeCloseTo(2 * Math.PI, 12);
	});

	it('creates an rgba32f shader payload descriptor from generated values', () => {
		const cache = createLocalCache();
		const geometry = { resolveCacheBuildRay: () => createRaySegment() };
		const calculator = createConstantCalculator([5, 4, 3, 2, 1]);

		for (const coordinate of cache.coordinates()) {
			cache.addCoordinateToCache({ coordinate, geometry, calculator });
		}

		const payload = cache.createShaderPayload();

		expect(payload).toEqual(jasmine.objectContaining({
			payloadKind: 'local-incident-radiance-cache',
			dimensions: [2, 1, 2, 5],
			format: 'float32-spectral',
		}));
		expect(payload.texture).toEqual(jasmine.objectContaining({
			kind: 'rgba32f-3d-texture-v1',
			width: 2,
			height: 1,
			depth: 4,
			spectralGroupSize: 4,
			spectralGroupCount: 2,
			spectralChannelCount: 5,
		}));
		expect(payload.texture.rgbaFloat32.length).toBe(32);
		expect(payload.texture.rgbaFloat32.slice(0, 4)).toEqual([5, 4, 3, 2]);
		expect(payload.lookup).toEqual(jasmine.objectContaining({
			policy: 'z-rho-bin-all-directions',
			directionSequence: 'fibonacci-sphere',
			depthPacking: 'z-bin-major-spectral-group-minor',
		}));
	});

	it('creates its cache-owned shader contribution', () => {
		const contribution = createLocalCache().createShaderContribution({
			descriptor: createShaderDescriptor(),
		});

		expect(contribution.id).toBe('cache-local-l2-incident-radiance');
		expect(contribution.owner).toBe('cache');
		expect(contribution.provides).toEqual(['cache.lookupIncidentRadiance']);
		expect(contribution.bindingRequirements[0].valueKey).toBe('cache.localIncidentRadianceTexture');
	});

	it('records tolerant runtime diagnostics for invalid or missing local cache accesses', () => {
		const cache = createLocalCache();

		expect(cache.createIncidentRadianceSampler()({ coordinates: [] })).toEqual([]);
		expect(cache.runtimeDiagnostics[0]).toEqual(jasmine.objectContaining({
			id: 'local-cache-invalid-access',
			severity: 'error',
		}));

		expect(cache.createIncidentRadianceSampler()({ coordinates: [0, 0] })).toEqual([]);
		expect(cache.runtimeDiagnostics[1]).toEqual(jasmine.objectContaining({
			id: 'local-cache-missing-value',
			severity: 'error',
		}));
	});

	it('fails loudly for missing build capability or missing generated payload values', () => {
		const cache = createLocalCache();
		const coordinate = [...cache.coordinates()][0];

		expect(() => cache.addCoordinateToCache({
			coordinate,
			geometry: {},
			calculator: createConstantCalculator([5, 4, 3, 2, 1]),
		})).toThrowError(/resolveCacheBuildRay/);

		expect(() => createLocalCache().createShaderPayload()).toThrowError(/missing 0:0:0/);
	});
});

function createLocalCache(overrides = {}) {
	return new LocalSunIncidentRadianceCache({
		sourceKey: 'test-local',
		zBinsMeters: [1, 2],
		rhoBinsMeters: [10],
		directionCount: 2,
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
			kind: 'flat-earth-geometry',
		}),
		atmosphere: createSection('atmosphere', {}),
		lightSource: createSection('light-source', {
			kind: 'local-sun-light-source',
		}),
		cache: createSection('cache', {
			cacheKind: 'local',
			metadata: {
				zBinCount: 2,
				rhoBinCount: 1,
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
