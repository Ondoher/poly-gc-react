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
