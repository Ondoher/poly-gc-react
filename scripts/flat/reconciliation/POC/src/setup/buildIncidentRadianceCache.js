// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, incident-cache build coordinator.
// - agents/topics/apps/flat/reconciliation/action-plan.md, cache-build setup stages.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

/**
 * @param {CacheBuildRequest} request - Cache build coordinator request.
 * @returns {CacheBuildResult} Built cache and build summary.
 */
export default function buildIncidentRadianceCache(request) {
    if (!request || typeof request !== 'object') {
        throw new ReconciliationConfigurationError('Cache build request is required.');
    }

    const { cache, geometry, atmosphere, lightSource, calculator } = request;

    if (
        !cache
        || typeof cache.coordinates !== 'function'
        || typeof cache.addCoordinateToCache !== 'function'
        || typeof cache.createIncidentRadianceSampler !== 'function'
    ) {
        throw new ReconciliationConfigurationError(
            'Cache must expose coordinates(), addCoordinateToCache(...), and createIncidentRadianceSampler().',
            { code: 'INVALID_CACHE_BUILD_TARGET' },
        );
    }

    for (const [name, collaborator] of Object.entries({ geometry, atmosphere, lightSource, calculator })) {
        if (!collaborator) {
            throw new ReconciliationConfigurationError(`Cache build request is missing ${name}.`, {
                code: 'MISSING_CACHE_BUILD_COLLABORATOR',
                details: { name },
            });
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
