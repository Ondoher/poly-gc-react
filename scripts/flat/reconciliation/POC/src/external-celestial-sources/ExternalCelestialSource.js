// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, discriminated source ownership.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import SpectralDensityPacket from './SpectralDensityPacket.js';
import {
    CELESTIAL_SOURCE_MEASURE_QUANTITY,
    EXTENDED_CELESTIAL_SOURCE,
    POINT_CELESTIAL_SOURCE,
} from './consts.js';

const SUPPORTED_SOURCE_KINDS = Object.freeze([
    POINT_CELESTIAL_SOURCE,
    EXTENDED_CELESTIAL_SOURCE,
]);

export default class ExternalCelestialSource {
    /**
     * @param {ExternalCelestialSourceConfiguration} configuration - Celestial source ownership descriptor.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER1_SOURCE_CONFIGURATION_REQUIRED',
                'External celestial source configuration is required.');
        }
        if (typeof configuration.id !== 'string' || configuration.id.trim() === '') {
            throw configurationError('ER1_SOURCE_ID_REQUIRED',
                'External celestial source requires a non-empty id.');
        }
        if (!SUPPORTED_SOURCE_KINDS.includes(configuration.kind)) {
            throw configurationError('ER1_SOURCE_KIND_UNSUPPORTED',
                'External celestial source kind is unsupported.');
        }
        if (!(configuration.spectralMeasure instanceof SpectralDensityPacket)) {
            throw configurationError('ER1_SOURCE_TYPED_MEASURE_REQUIRED',
                'External celestial source requires a SpectralDensityPacket; bare arrays are prohibited.');
        }

        const expectedQuantity = CELESTIAL_SOURCE_MEASURE_QUANTITY[configuration.kind];
        if (configuration.spectralMeasure.quantity !== expectedQuantity) {
            throw configurationError('ER1_SOURCE_MEASURE_KIND_MISMATCH',
                `${configuration.kind} sources require ${expectedQuantity}.`, {
                    actualQuantity: configuration.spectralMeasure.quantity,
                });
        }

        this.id = configuration.id;
        this.kind = configuration.kind;
        this.geometry = freezeGeometry(configuration.geometry);
        this.spectralMeasure = configuration.spectralMeasure;
        this.fingerprint = stableHash({
            id: this.id,
            kind: this.kind,
            geometry: this.geometry,
            spectralMeasureFingerprint: this.spectralMeasure.fingerprint,
        });
        Object.freeze(this);
    }

    /**
     * @returns {Readonly<Record<string, unknown>>} Immutable source descriptor.
     */
    describe() {
        return Object.freeze({
            id: this.id,
            kind: this.kind,
            geometry: this.geometry,
            spectralMeasure: this.spectralMeasure.describe(),
            fingerprint: this.fingerprint,
        });
    }
}

function freezeGeometry(geometry) {
    if (!geometry || typeof geometry !== 'object' || Array.isArray(geometry)) {
        throw configurationError('ER1_SOURCE_GEOMETRY_REQUIRED',
            'External celestial source requires a geometry ownership descriptor.');
    }
    try {
        const frozen = freezeJsonValue(geometry);
        if (
            typeof frozen.kind !== 'string'
            || frozen.kind.trim() === ''
            || typeof frozen.owner !== 'string'
            || frozen.owner.trim() === ''
        ) {
            throw new TypeError('Geometry descriptor requires non-empty kind and owner.');
        }
        return frozen;
    } catch (error) {
        throw configurationError('ER1_SOURCE_GEOMETRY_INVALID',
            'External celestial source geometry must be valid finite JSON ownership metadata.', {
                cause: error.message,
            });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

