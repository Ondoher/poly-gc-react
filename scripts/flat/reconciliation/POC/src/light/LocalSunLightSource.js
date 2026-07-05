// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, M2 Subgoal 2.2 local light source.
// - agents/topics/apps/flat/reconciliation/local-sun-flat-geometry-fact-inventory.md, local-013, local-017, local-019, local-020.
// - tmp/atmosphere/reconciliation/017-m2-reference-gap-carry-forward.

import LocalSunIncidentRadianceCache from '../incident-radiance/LocalSunIncidentRadianceCache.js';
import { normalize } from '../math/vector.js';

export default class LocalSunLightSource {
    /**
     * @param {LocalSunLightSourceConfig} configuration - Local finite-source configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('LocalSunLightSource configuration is required.');
        }

        const {
            sourceKey,
            spectralChannels,
            referenceDistanceMeters,
            referenceSpectralIncidentScale,
            radiusMeters,
            distanceFalloff = true,
            cacheZBinsMeters = [0],
            cacheRhoBinsMeters = [0],
            cacheDirectionCount = 1,
        } = configuration;

        if (!sourceKey || !Array.isArray(spectralChannels) || spectralChannels.length < 1) {
            throw new TypeError('LocalSunLightSource requires sourceKey and spectralChannels.');
        }

        if (![referenceDistanceMeters, referenceSpectralIncidentScale, radiusMeters].every(Number.isFinite)) {
            throw new TypeError('LocalSunLightSource distance, scale, and radius must be finite.');
        }

        this._configuration = Object.freeze({
            sourceKey,
            spectralChannels: Object.freeze([...spectralChannels]),
            referenceDistanceMeters,
            referenceSpectralIncidentScale,
            radiusMeters,
            distanceFalloff,
            cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
            cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
            cacheDirectionCount,
        });
    }

    get configuration() {
        return this._configuration;
    }

    /**
     * @returns {IncidentRadianceCacheDescriptor} Local incident-radiance cache descriptor.
     */
    describeIncidentRadianceCache() {
        return Object.freeze({
            cacheKind: 'local',
            sourceKey: this._configuration.sourceKey,
            version: 1,
            dimensions: Object.freeze(['z', 'rho', 'incomingDirection', 'wavelength']),
            metadata: Object.freeze({
                zBinCount: this._configuration.cacheZBinsMeters.length,
                rhoBinCount: this._configuration.cacheRhoBinsMeters.length,
                directionCount: this._configuration.cacheDirectionCount,
                lookupPolicy: 'nearest-neighbor-poc-grid',
            }),
        });
    }

    /**
     * @param {{ readonly spectralBasis?: SpectralBasis }} [request] - Cache creation request.
     * @returns {IncidentRadianceCache} Local incident-radiance cache.
     */
    createIncidentRadianceCache(request = {}) {
        const spectralBasis = request.spectralBasis ?? Object.freeze({
            wavelengthsNanometers: Object.freeze(
                this._configuration.spectralChannels.map((channel) => channel.wavelengthNanometers),
            ),
        });

        return new LocalSunIncidentRadianceCache({
            descriptor: this.describeIncidentRadianceCache(),
            zBinsMeters: this._configuration.cacheZBinsMeters,
            rhoBinsMeters: this._configuration.cacheRhoBinsMeters,
            directionCount: this._configuration.cacheDirectionCount,
            spectralBasis,
        });
    }

    /**
     * @param {{
     *   readonly sourceRelativePosition?: SourceRelativePosition,
     *   readonly spectralBasis?: SpectralBasis
     * }} request - Direct lighting request.
     * @returns {DirectLightingSample} Local direct-light sample.
     */
    sampleDirectLighting(request = {}) {
        const sourceRelativePosition = request.sourceRelativePosition;

        if (!sourceRelativePosition) {
            throw new TypeError('LocalSunLightSource.sampleDirectLighting requires sourceRelativePosition.');
        }

        const distanceFromSourceMeters = sourceRelativePosition.distanceFromSourceMeters;
        const directionToLight = normalize(sourceRelativePosition.directionToSource ?? [0, 0, 1]);
        const safeDistanceMeters = Math.max(
            this._configuration.radiusMeters,
            Number.isFinite(distanceFromSourceMeters) ? distanceFromSourceMeters : this._configuration.referenceDistanceMeters,
        );
        const falloffScale = this._configuration.distanceFalloff
            ? (this._configuration.referenceDistanceMeters / safeDistanceMeters) ** 2
            : 1;
        const incidentScale = this._configuration.referenceSpectralIncidentScale * falloffScale;
        const incidentRadiance = this._configuration.spectralChannels.map((channel) =>
            channel.solarIrradiance * incidentScale);

        return Object.freeze({
            incidentRadiance: Object.freeze(incidentRadiance),
            directionToLight,
            metadata: Object.freeze({
                sourceKey: this._configuration.sourceKey,
                distanceFromSourceMeters,
                safeDistanceMeters,
                radiusMeters: this._configuration.radiusMeters,
                referenceDistanceMeters: this._configuration.referenceDistanceMeters,
                referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
                falloffScale,
                incidentScale,
                distanceClampedToRadius: safeDistanceMeters !== distanceFromSourceMeters,
                spectralScaleKind: 'neutral-no-tint',
            }),
        });
    }

    /**
     * @param {{ readonly sourceRelativePosition?: SourceRelativePosition }} request - Source-path request.
     * @returns {SourcePathLimit} Finite source path limit.
     */
    resolveSourcePathLimit(request = {}) {
        const distance = request.sourceRelativePosition?.distanceFromSourceMeters;

        return Object.freeze({
            maxDistanceMeters: Number.isFinite(distance) ? Math.max(0, distance) : null,
            reason: 'finite-local-source-distance',
        });
    }
}
