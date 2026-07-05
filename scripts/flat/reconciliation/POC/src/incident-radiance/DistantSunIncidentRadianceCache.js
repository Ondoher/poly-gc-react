// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, cache-owned coordinate generator and build callback.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.4.
// - tmp/atmosphere/reconciliation/009-m1-granular-record-strategy.

import { sunOrientedFibonacciSphereDirection } from '../math/vector.js';

const SPECTRAL_GROUP_SIZE = 4;

export default class DistantSunIncidentRadianceCache {
    /**
     * @param {DistantIncidentRadianceCacheConfig} configuration - Distant cache configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('DistantSunIncidentRadianceCache configuration is required.');
        }

        const {
            descriptor,
            bottomRadiusMeters,
            topRadiusMeters,
            altitudeBinCount,
            directionCount,
            directionToLight,
            spectralBasis,
            boundaryAltitudeMeters = 2,
        } = configuration;

        if (
            !descriptor
            || !Number.isInteger(altitudeBinCount)
            || !Number.isInteger(directionCount)
            || !Number.isFinite(boundaryAltitudeMeters)
            || boundaryAltitudeMeters < 0
        ) {
            throw new TypeError('Distant cache requires descriptor and integer dimensions.');
        }

        this.descriptor = Object.freeze(descriptor);
        this._configuration = Object.freeze({
            bottomRadiusMeters,
            topRadiusMeters,
            altitudeBinCount,
            directionCount,
            directionToLight,
            spectralBasis,
            boundaryAltitudeMeters,
        });
        this._valuesByKey = new Map();
    }

    /**
     * @returns {Iterable<CacheBuildCoordinate>} Cache-owned build coordinates.
     */
    *coordinates() {
        const atmosphereHeight =
            this._configuration.topRadiusMeters - this._configuration.bottomRadiusMeters;

        for (let altitudeBinIndex = 0; altitudeBinIndex < this._configuration.altitudeBinCount; altitudeBinIndex += 1) {
            const altitudeMeters = this._altitudeMetersForBin(altitudeBinIndex, atmosphereHeight);

            for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                const incomingDirection = this._incomingDirection(directionIndex);

                yield Object.freeze({
                    coordinateKey: this._key(altitudeBinIndex, directionIndex),
                    coordinates: Object.freeze([altitudeBinIndex, directionIndex]),
                    altitudeBinIndex,
                    directionIndex,
                    altitudeMeters,
                    incomingDirection,
                    metadata: Object.freeze({
                        angularWeight: (4 * Math.PI) / this._configuration.directionCount,
                        boundarySamplePolicy: altitudeBinIndex === 0
                            ? 'minimum-in-atmosphere-altitude'
                            : 'uniform-bin-center',
                    }),
                });
            }
        }
    }

    /**
     * @param {{
     *   readonly coordinate: CacheBuildCoordinate,
     *   readonly geometry: GeometryModel,
     *   readonly calculator: SpectralCalculatorLike,
     *   readonly pathIntervalCount?: number
     * }} request - Build request for one coordinate.
     */
    addCoordinateToCache(request) {
        const { coordinate, geometry, calculator, pathIntervalCount } = request;
        const key = this._key(coordinate.altitudeBinIndex, coordinate.directionIndex);
        const zero = this._zero();
        const raySegment = geometry.resolveCacheBuildRay(coordinate);

        if (raySegment == null) {
            this._valuesByKey.set(key, zero);
            return;
        }

        const intervalCount = pathIntervalCount ?? 1;
        const points = calculator.buildEndpointTrapezoidPathIntegrationPoints(raySegment, intervalCount);
        const pathRadiance = calculator.computeRadiance(raySegment, points);

        this._valuesByKey.set(key, Object.freeze([...pathRadiance.inScattered]));
    }

    /**
     * @returns {IncidentRadianceSampler} Runtime incident sampler.
     */
    createIncidentRadianceSampler() {
        return (cacheAccess) => {
            const altitudeBinIndex = cacheAccess?.coordinates?.[0];

            if (!Number.isInteger(altitudeBinIndex)) {
                throw new TypeError('Distant cache access requires altitude bin coordinate.');
            }

            const samples = [];
            const weight = (4 * Math.PI) / this._configuration.directionCount;

            for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                const key = this._key(altitudeBinIndex, directionIndex);
                const radiance = this._valuesByKey.get(key);

                if (!radiance) {
                    throw new Error(`Distant incident radiance cache is missing ${key}.`);
                }

                samples.push(Object.freeze({
                    incomingDirection: this._incomingDirection(directionIndex),
                    radiance,
                    weight,
                }));
            }

            return Object.freeze(samples);
        };
    }

    /**
     * @returns {CacheShaderPayloadDescriptor} Shader payload descriptor.
     */
    createShaderPayload() {
        const spectralChannelCount = this._configuration.spectralBasis.wavelengthsNanometers.length;
        const spectralGroupCount = Math.ceil(spectralChannelCount / SPECTRAL_GROUP_SIZE);
        const rgbaFloat32 = [];

        for (let spectralGroupIndex = 0; spectralGroupIndex < spectralGroupCount; spectralGroupIndex += 1) {
            for (let altitudeBinIndex = 0; altitudeBinIndex < this._configuration.altitudeBinCount; altitudeBinIndex += 1) {
                for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                    const radiance = this._valuesByKey.get(this._key(altitudeBinIndex, directionIndex));

                    if (!radiance) {
                        throw new Error(`Distant incident radiance cache is missing ${this._key(altitudeBinIndex, directionIndex)}.`);
                    }

                    for (let componentIndex = 0; componentIndex < SPECTRAL_GROUP_SIZE; componentIndex += 1) {
                        const channelIndex = spectralGroupIndex * SPECTRAL_GROUP_SIZE + componentIndex;
                        rgbaFloat32.push(channelIndex < spectralChannelCount ? radiance[channelIndex] : 0);
                    }
                }
            }
        }

        return Object.freeze({
            payloadKind: 'distant-incident-radiance-cache',
            dimensions: Object.freeze([
                this._configuration.altitudeBinCount,
                this._configuration.directionCount,
                spectralChannelCount,
            ]),
            format: 'float32-spectral',
            texture: Object.freeze({
                kind: 'rgba32f-3d-texture-v1',
                textureId: 'incident-radiance-distant-l2',
                width: this._configuration.directionCount,
                height: this._configuration.altitudeBinCount,
                depth: spectralGroupCount,
                dimensionality: '3d',
                format: 'rgba32f',
                samplerPolicy: 'nearest-clamp',
                coordinateOrder: Object.freeze(['directionIndex', 'altitudeBinIndex', 'spectralGroupIndex']),
                spectralGroupSize: SPECTRAL_GROUP_SIZE,
                spectralGroupCount,
                spectralChannelCount,
                rgbaFloat32: Object.freeze(rgbaFloat32),
            }),
            lookup: Object.freeze({
                policy: 'altitude-bin-all-directions',
                directionSequence: 'sun-oriented-fibonacci-sphere',
                directionWeight: (4 * Math.PI) / this._configuration.directionCount,
                boundaryAltitudeMeters: this._configuration.boundaryAltitudeMeters,
            }),
            metadata: Object.freeze({
                valueCount: this._valuesByKey.size,
                boundaryAltitudeMeters: this._configuration.boundaryAltitudeMeters,
                boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
                uploadValueCount: rgbaFloat32.length,
            }),
        });
    }

    get valueCount() {
        return this._valuesByKey.size;
    }

    _key(altitudeBinIndex, directionIndex) {
        return `${altitudeBinIndex}:${directionIndex}`;
    }

    _altitudeMetersForBin(altitudeBinIndex, atmosphereHeight) {
        if (altitudeBinIndex === 0) {
            return Math.min(
                atmosphereHeight,
                Math.max(0, this._configuration.boundaryAltitudeMeters),
            );
        }

        return ((altitudeBinIndex + 0.5) / this._configuration.altitudeBinCount) * atmosphereHeight;
    }

    _incomingDirection(directionIndex) {
        return sunOrientedFibonacciSphereDirection(
            directionIndex,
            this._configuration.directionCount,
            this._configuration.directionToLight,
        );
    }

    _zero() {
        return Object.freeze(this._configuration.spectralBasis.wavelengthsNanometers.map(() => 0));
    }
}
