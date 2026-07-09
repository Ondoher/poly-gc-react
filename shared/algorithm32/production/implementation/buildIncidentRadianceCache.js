/**
 * Build a concrete incident-radiance cache through its cache-owned coordinate
 * generator.
 *
 * @param {CacheBuildRequest} request - Supplies the cache build request.
 * @returns {CacheBuildResult} The built cache and operation-ready sampling.
 */
export default function buildIncidentRadianceCache(request) {
	if (!request || typeof request !== 'object') {
		throw new TypeError('Cache build request is required.');
	}

	const { cache, geometry, atmosphere, lightSource, calculator } = request;

	if (
		!cache
		|| typeof cache.coordinates !== 'function'
		|| typeof cache.addCoordinateToCache !== 'function'
		|| typeof cache.createIncidentRadianceSampler !== 'function'
	) {
		throw new TypeError('Cache must expose coordinates(), addCoordinateToCache(...), and createIncidentRadianceSampler().');
	}

	for (const [name, collaborator] of Object.entries({ geometry, atmosphere, lightSource, calculator })) {
		if (!collaborator) {
			throw new TypeError(`Cache build request is missing ${name}.`);
		}
	}

	let coordinateCount = 0;

	for (const coordinate of cache.coordinates()) {
		cache.addCoordinateToCache({
			coordinate,
			geometry,
			atmosphere,
			lightSource,
			calculator,
			pathIntervalCount: request.pathIntervalCount,
			sourceTransmittanceIntervalCount: request.sourceTransmittanceIntervalCount,
		});
		coordinateCount += 1;
	}

	const incidentRadianceSampling = Object.freeze({
		cacheDescriptor: cache.descriptor,
		incidentRadianceSampler: cache.createIncidentRadianceSampler(),
	});

	return Object.freeze({
		cache,
		coordinateCount,
		incidentRadianceSampling,
	});
}
