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
		}));
		expect(cache.descriptor.metadata).toEqual(jasmine.objectContaining({
			altitudeBinCount: 3,
			directionCount: 4,
			boundaryAltitudeMeters: 2,
		}));
		expect([...cache.coordinates()].length).toBe(12);
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

	it('fails loudly for invalid source configuration', () => {
		expect(() => new DistantSunLightSource()).toThrowError(/configuration/);
		expect(() => createDistantSource({ directionToLight: [0, 0, 0] })).toThrowError(/non-zero/);
		expect(() => createDistantSource({ spectralChannels: [] })).toThrowError(/spectral channels/);
		expect(() => createDistantSource({ cacheDirectionCount: 0 })).toThrowError(/cacheDirectionCount/);
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
