// References:
// - agents/topics/apps/flat/algorithm32/conclusions.md, distant source and solar irradiance treatment.
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, light-source-owned cache factory.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.2 and 1.4.

import DistantSunIncidentRadianceCache from '../incident-radiance/DistantSunIncidentRadianceCache.js';
import { normalize, scale } from '../math/vector.js';

export default class DistantSunLightSource {
    /**
     * @param {DistantSunLightSourceConfig} configuration - Distant Sun configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('DistantSunLightSource configuration is required.');
        }

        const {
            directionToLight,
            spectralChannels,
            angularRadiusRadians,
            cacheAltitudeBinCount = 1,
            cacheDirectionCount = 1,
            cacheBoundaryAltitudeMeters = 2,
        } = configuration;

        if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
            throw new TypeError('DistantSunLightSource requires spectral channels.');
        }

        this._configuration = Object.freeze({
            directionToLight: normalize(directionToLight),
            spectralChannels: Object.freeze([...spectralChannels]),
            angularRadiusRadians,
            cacheAltitudeBinCount,
            cacheDirectionCount,
            cacheBoundaryAltitudeMeters,
        });
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @returns {IncidentRadianceCacheDescriptor} Distant cache descriptor.
     */
    describeIncidentRadianceCache() {
        return Object.freeze({
            cacheKind: 'distant',
            sourceKey: 'distant-sun',
            version: 1,
            dimensions: Object.freeze(['altitude', 'incomingDirection']),
            metadata: Object.freeze({
                altitudeBinCount: this._configuration.cacheAltitudeBinCount,
                directionCount: this._configuration.cacheDirectionCount,
                boundaryAltitudeMeters: this._configuration.cacheBoundaryAltitudeMeters,
                boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
            }),
        });
    }

    /**
     * @param {{ readonly bottomRadiusMeters: number, readonly topRadiusMeters: number, readonly spectralBasis: SpectralBasis }} request
     *   Cache factory request.
     * @returns {IncidentRadianceCache} Distant incident radiance cache.
     */
    createIncidentRadianceCache(request) {
        const descriptor = this.describeIncidentRadianceCache();

        return new DistantSunIncidentRadianceCache({
            descriptor,
            bottomRadiusMeters: request.bottomRadiusMeters,
            topRadiusMeters: request.topRadiusMeters,
            altitudeBinCount: this._configuration.cacheAltitudeBinCount,
            directionCount: this._configuration.cacheDirectionCount,
            directionToLight: this._configuration.directionToLight,
            spectralBasis: request.spectralBasis,
            boundaryAltitudeMeters: request.boundaryAltitudeMeters
                ?? this._configuration.cacheBoundaryAltitudeMeters,
        });
    }

    /**
     * @returns {DirectLightingSample} Direct source facts.
     */
    sampleDirectLighting() {
        return Object.freeze({
            incidentRadiance: Object.freeze(
                this._configuration.spectralChannels.map((channel) => channel.solarIrradiance),
            ),
            directionToLight: this._configuration.directionToLight,
            metadata: Object.freeze({
                directionFromSource: scale(this._configuration.directionToLight, -1),
                angularRadiusRadians: this._configuration.angularRadiusRadians,
            }),
        });
    }

    /**
     * @returns {SourcePathLimit} Distant source path limit.
     */
    resolveSourcePathLimit() {
        return Object.freeze({
            maxDistanceMeters: null,
            reason: 'distant-source-to-atmosphere-boundary',
        });
    }
}
