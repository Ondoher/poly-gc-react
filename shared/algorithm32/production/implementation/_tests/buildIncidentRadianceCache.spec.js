import buildIncidentRadianceCache from '../buildIncidentRadianceCache.js';
import noIncidentRadiance from '../noIncidentRadiance.js';

describe('buildIncidentRadianceCache', () => {
	it('builds cache-owned coordinates and returns operation-ready sampling', () => {
		const coordinates = [
			{ coordinateKey: 'a', coordinates: [0] },
			{ coordinateKey: 'b', coordinates: [1] },
		];
		const builtCoordinates = [];
		const sampler = () => [];
		const cache = {
			descriptor: {
				cacheKind: 'local',
				sourceKey: 'test-cache',
				version: 1,
			},
			coordinates: function* coordinateGenerator() {
				yield* coordinates;
			},
			addCoordinateToCache(request) {
				builtCoordinates.push(request);
			},
			createIncidentRadianceSampler() {
				return sampler;
			},
		};
		const geometry = {};
		const atmosphere = {};
		const lightSource = {};
		const calculator = {};

		const result = buildIncidentRadianceCache({
			cache,
			geometry,
			atmosphere,
			lightSource,
			calculator,
			pathIntervalCount: 3,
			sourceTransmittanceIntervalCount: 5,
		});

		expect(result).toEqual({
			cache,
			coordinateCount: 2,
			incidentRadianceSampling: {
				cacheDescriptor: cache.descriptor,
				incidentRadianceSampler: sampler,
			},
		});
		expect(builtCoordinates.map((request) => request.coordinate)).toEqual(coordinates);
		expect(builtCoordinates[0]).toEqual(jasmine.objectContaining({
			geometry,
			atmosphere,
			lightSource,
			calculator,
			pathIntervalCount: 3,
			sourceTransmittanceIntervalCount: 5,
		}));
	});

	it('fails loudly for missing collaborators', () => {
		expect(() => buildIncidentRadianceCache({
			cache: {
				descriptor: { cacheKind: 'none', sourceKey: 'none', version: 1 },
				coordinates: function* coordinates() {},
				addCoordinateToCache() {},
				createIncidentRadianceSampler() {
					return () => [];
				},
			},
			geometry: {},
			atmosphere: {},
			lightSource: {},
		})).toThrowError(/calculator/);
	});

	it('provides a no-incident-radiance sampling packet', () => {
		expect(noIncidentRadiance.cacheDescriptor).toEqual({
			cacheKind: 'none',
			sourceKey: 'none',
			version: 1,
			dimensions: [],
		});
		expect(noIncidentRadiance.incidentRadianceSampler({ cacheKey: 'none', coordinates: [] })).toEqual([]);
	});
});
