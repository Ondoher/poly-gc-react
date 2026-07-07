// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, cache-created coordinate generator.
// - agents/topics/apps/flat/reconciliation/m2-calibration-and-evidence-plan.md, ext-012 and cache-001 through cache-005.
// - tmp/atmosphere/reconciliation/024-m2-pre-asset-experiment-gate.

import { fibonacciSphereDirection } from '../math/vector.js';

const SPECTRAL_GROUP_SIZE = 4;

export default class LocalSunIncidentRadianceCache {
    /**
     * @param {LocalIncidentRadianceCacheConfig} configuration - Local cache configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('LocalSunIncidentRadianceCache configuration is required.');
        }

        const {
            descriptor,
            zBinsMeters,
            rhoBinsMeters,
            directionCount,
            spectralBasis,
        } = configuration;

        if (!descriptor || !Array.isArray(zBinsMeters) || !Array.isArray(rhoBinsMeters)) {
            throw new TypeError('Local cache requires descriptor and z/rho bins.');
        }

        if (!Number.isInteger(directionCount) || directionCount < 1) {
            throw new RangeError('Local cache directionCount must be a positive integer.');
        }

        this.descriptor = Object.freeze(descriptor);
        this._configuration = Object.freeze({
            zBinsMeters: Object.freeze([...zBinsMeters]),
            rhoBinsMeters: Object.freeze([...rhoBinsMeters]),
            directionCount,
            spectralBasis,
            runtimeDiagnosticLimit: 50,
        });
        this._valuesByKey = new Map();
        this._runtimeDiagnostics = [];
    }

    get valueCount() {
        return this._valuesByKey.size;
    }

    get runtimeDiagnostics() {
        return Object.freeze([...this._runtimeDiagnostics]);
    }

    /**
     * @returns {Iterable<CacheBuildCoordinate>} Cache-owned build coordinates.
     */
    *coordinates() {
        for (let zBinIndex = 0; zBinIndex < this._configuration.zBinsMeters.length; zBinIndex += 1) {
            const altitudeMeters = this._configuration.zBinsMeters[zBinIndex];

            for (let rhoBinIndex = 0; rhoBinIndex < this._configuration.rhoBinsMeters.length; rhoBinIndex += 1) {
                const rhoMeters = this._configuration.rhoBinsMeters[rhoBinIndex];

                for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                    const incomingDirection = fibonacciSphereDirection(directionIndex, this._configuration.directionCount);

                    yield Object.freeze({
                        coordinateKey: this._key(zBinIndex, rhoBinIndex, directionIndex),
                        coordinates: Object.freeze([zBinIndex, rhoBinIndex, directionIndex]),
                        zBinIndex,
                        rhoBinIndex,
                        directionIndex,
                        altitudeMeters,
                        rhoMeters,
                        incomingDirection,
                        metadata: Object.freeze({
                            angularWeight: (4 * Math.PI) / this._configuration.directionCount,
                            coordinateSystem: 'local-source-z-rho',
                        }),
                    });
                }
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
        const key = this._key(coordinate.zBinIndex, coordinate.rhoBinIndex, coordinate.directionIndex);
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
            const zBinIndex = cacheAccess?.coordinates?.[0];
            const rhoBinIndex = cacheAccess?.coordinates?.[1];

            if (!Number.isInteger(zBinIndex) || !Number.isInteger(rhoBinIndex)) {
                this._diagnose('local-cache-invalid-access', 'error',
                    'Local cache access requires z and rho bin coordinates.', { cacheAccess });

                return Object.freeze([]);
            }

            const samples = [];
            const weight = (4 * Math.PI) / this._configuration.directionCount;

            for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                const key = this._key(zBinIndex, rhoBinIndex, directionIndex);
                const radiance = this._valuesByKey.get(key);

                if (!radiance) {
                    this._diagnose('local-cache-missing-value', 'error',
                        'Local cache missing value at runtime; returning safe empty contribution.', {
                            key,
                            cacheAccess,
                        });

                    return Object.freeze([]);
                }

                samples.push(Object.freeze({
                    incomingDirection: fibonacciSphereDirection(directionIndex, this._configuration.directionCount),
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
        const zBinCount = this._configuration.zBinsMeters.length;
        const rhoBinCount = this._configuration.rhoBinsMeters.length;
        const rgbaFloat32 = [];

        for (let zBinIndex = 0; zBinIndex < zBinCount; zBinIndex += 1) {
            for (let spectralGroupIndex = 0; spectralGroupIndex < spectralGroupCount; spectralGroupIndex += 1) {
                for (let rhoBinIndex = 0; rhoBinIndex < rhoBinCount; rhoBinIndex += 1) {
                    for (let directionIndex = 0; directionIndex < this._configuration.directionCount; directionIndex += 1) {
                        const key = this._key(zBinIndex, rhoBinIndex, directionIndex);
                        const radiance = this._valuesByKey.get(key);

                        if (!radiance) {
                            throw new Error(`Local incident radiance cache is missing ${key}.`);
                        }

                        for (let componentIndex = 0; componentIndex < SPECTRAL_GROUP_SIZE; componentIndex += 1) {
                            const channelIndex = spectralGroupIndex * SPECTRAL_GROUP_SIZE + componentIndex;
                            rgbaFloat32.push(channelIndex < spectralChannelCount ? radiance[channelIndex] : 0);
                        }
                    }
                }
            }
        }

        return Object.freeze({
            payloadKind: 'local-incident-radiance-cache',
            dimensions: Object.freeze([
                zBinCount,
                rhoBinCount,
                this._configuration.directionCount,
                spectralChannelCount,
            ]),
            format: 'float32-spectral',
            texture: Object.freeze({
                kind: 'rgba32f-3d-texture-v1',
                textureId: 'incident-radiance-local-l2',
                width: this._configuration.directionCount,
                height: rhoBinCount,
                depth: zBinCount * spectralGroupCount,
                dimensionality: '3d',
                format: 'rgba32f',
                samplerPolicy: 'nearest-clamp',
                coordinateOrder: Object.freeze(['directionIndex', 'rhoBinIndex', 'zSpectralGroupIndex']),
                spectralGroupSize: SPECTRAL_GROUP_SIZE,
                spectralGroupCount,
                spectralChannelCount,
                rgbaFloat32: Object.freeze(rgbaFloat32),
            }),
            lookup: Object.freeze({
                policy: 'z-rho-bin-all-directions',
                directionSequence: 'fibonacci-sphere',
                directionWeight: (4 * Math.PI) / this._configuration.directionCount,
                zBinsMeters: this._configuration.zBinsMeters,
                rhoBinsMeters: this._configuration.rhoBinsMeters,
                depthPacking: 'z-bin-major-spectral-group-minor',
            }),
            metadata: Object.freeze({
                valueCount: this._valuesByKey.size,
                zBinCount,
                rhoBinCount,
                directionCount: this._configuration.directionCount,
                lookupPolicy: 'nearest-neighbor-poc-grid',
                uploadValueCount: rgbaFloat32.length,
            }),
        });
    }

    _key(zBinIndex, rhoBinIndex, directionIndex) {
        return `${zBinIndex}:${rhoBinIndex}:${directionIndex}`;
    }

    _zero() {
        return Object.freeze(this._configuration.spectralBasis.wavelengthsNanometers.map(() => 0));
    }

    _diagnose(id, severity, message, details) {
        if (this._runtimeDiagnostics.length >= this._configuration.runtimeDiagnosticLimit) {
            return;
        }

        this._runtimeDiagnostics.push(Object.freeze({
            id,
            severity,
            message,
            details: Object.freeze({ ...details }),
        }));
    }
}
