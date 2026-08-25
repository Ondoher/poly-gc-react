// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, typed spectrum wrapper.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import SpectralDensityBasis from './SpectralDensityBasis.js';
import {
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_IRRADIANCE_DENSITY,
    SPECTRAL_RADIANCE_DENSITY,
} from './consts.js';

const SUPPORTED_QUANTITIES = Object.freeze([
    SPECTRAL_IRRADIANCE_DENSITY,
    SPECTRAL_RADIANCE_DENSITY,
]);

export default class SpectralDensityPacket {
    /**
     * @param {SpectralDensityPacketConfiguration} configuration - Typed spectral-density packet.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER1_PACKET_CONFIGURATION_REQUIRED',
                'Spectral density packet configuration is required.');
        }

        if (!SUPPORTED_QUANTITIES.includes(configuration.quantity)) {
            throw configurationError('ER1_PACKET_QUANTITY_UNSUPPORTED',
                'Spectral density packet quantity is unsupported.');
        }
        this.quantity = configuration.quantity;

        const expectedUnits = SPECTRAL_DENSITY_UNITS[this.quantity];
        if (configuration.units !== expectedUnits) {
            throw configurationError('ER1_PACKET_UNITS_MISMATCH',
                `${this.quantity} requires exact units ${expectedUnits}.`, {
                    expectedUnits,
                    actualUnits: configuration.units ?? null,
                });
        }
        this.units = configuration.units;

        if (!(configuration.basis instanceof SpectralDensityBasis)) {
            throw configurationError('ER1_PACKET_BASIS_REQUIRED',
                'Spectral density packet requires a SpectralDensityBasis.');
        }
        this.basis = configuration.basis;
        this.values = validateValues(configuration.values, this.basis.channels.length);
        this.provenance = freezeRequiredJson(
            configuration.provenance,
            'ER1_PACKET_PROVENANCE_REQUIRED',
            'ER1_PACKET_PROVENANCE_INVALID',
            'Spectral density provenance',
        );
        validateProvenanceIdentity(this.provenance);
        this.uncertainty = freezeRequiredJson(
            configuration.uncertainty,
            'ER1_PACKET_UNCERTAINTY_REQUIRED',
            'ER1_PACKET_UNCERTAINTY_INVALID',
            'Spectral density uncertainty',
        );
        validateUncertainty(this.uncertainty, this.values.length);

        this.fingerprint = stableHash(this._fingerprintBody());
        Object.freeze(this);
    }

    /**
     * @returns {SpectralDensityPacketDescriptor} Immutable descriptor.
     */
    describe() {
        return Object.freeze({
            quantity: this.quantity,
            units: this.units,
            basis: this.basis.describe(),
            values: this.values,
            provenance: this.provenance,
            uncertainty: this.uncertainty,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Fail when a consumer expects a different basis fingerprint.
     *
     * @param {SpectralDensityBasis} expectedBasis - Consumer's active basis.
     * @returns {void}
     */
    assertBasisCompatibility(expectedBasis) {
        if (
            !(expectedBasis instanceof SpectralDensityBasis)
            || expectedBasis.fingerprint !== this.basis.fingerprint
        ) {
            throw configurationError('ER1_PACKET_BASIS_FINGERPRINT_MISMATCH',
                'Spectral density packet basis does not match the consumer basis.', {
                    packetBasisFingerprint: this.basis.fingerprint,
                    expectedBasisFingerprint: expectedBasis?.fingerprint ?? null,
                });
        }
    }

    _fingerprintBody() {
        return Object.freeze({
            quantity: this.quantity,
            units: this.units,
            basisFingerprint: this.basis.fingerprint,
            values: this.values,
            provenance: this.provenance,
            uncertainty: this.uncertainty,
        });
    }
}

function validateValues(values, expectedLength) {
    if (!Array.isArray(values)) {
        throw configurationError('ER1_PACKET_VALUES_ARRAY_REQUIRED',
            'Spectral density packet values must be an array before wrapping.');
    }
    if (values.length !== expectedLength) {
        throw configurationError('ER1_PACKET_VALUES_BASIS_MISMATCH',
            'Spectral density packet values do not match the basis channel count.', {
                expectedLength,
                actualLength: values.length,
            });
    }
    if (!values.every(Number.isFinite)) {
        throw configurationError('ER1_PACKET_VALUES_NONFINITE',
            'Spectral density packet values must be finite.');
    }
    if (values.some((value) => value < 0)) {
        throw configurationError('ER1_PACKET_VALUES_NEGATIVE',
            'Spectral density packet values must be nonnegative.');
    }
    return Object.freeze([...values]);
}

function validateProvenanceIdentity(provenance) {
    for (const field of ['sourceId', 'sourceVersion', 'sourceHashSha256']) {
        if (typeof provenance[field] !== 'string' || provenance[field].trim() === '') {
            throw configurationError('ER1_PACKET_PROVENANCE_IDENTITY_INCOMPLETE',
                `Spectral density provenance requires ${field}.`);
        }
    }
    if (!/^[a-f0-9]{64}$/i.test(provenance.sourceHashSha256)) {
        throw configurationError('ER1_PACKET_PROVENANCE_HASH_INVALID',
            'Spectral density provenance sourceHashSha256 must be a SHA-256 hex digest.');
    }
}

function validateUncertainty(uncertainty, expectedLength) {
    if (!['known', 'partial', 'unknown', 'analytic-fixture'].includes(uncertainty.status)) {
        throw configurationError('ER1_PACKET_UNCERTAINTY_STATUS_INVALID',
            'Spectral density uncertainty requires a supported status.');
    }
    if (typeof uncertainty.model !== 'string' || uncertainty.model.trim() === '') {
        throw configurationError('ER1_PACKET_UNCERTAINTY_MODEL_REQUIRED',
            'Spectral density uncertainty requires a named model.');
    }
    for (const field of ['values', 'systematicValues']) {
        if (uncertainty[field] === undefined) {
            continue;
        }
        if (
            !Array.isArray(uncertainty[field])
            || uncertainty[field].length !== expectedLength
            || !uncertainty[field].every((value) => Number.isFinite(value) && value >= 0)
        ) {
            throw configurationError('ER1_PACKET_UNCERTAINTY_VALUES_INVALID',
                `${field} must be a nonnegative finite array aligned to the basis.`);
        }
    }
}

function freezeRequiredJson(value, requiredCode, invalidCode, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(requiredCode, `${label} must be a JSON object.`);
    }
    try {
        return freezeJsonValue(value);
    } catch (error) {
        throw configurationError(invalidCode, `${label} must be valid finite JSON.`, {
            cause: error.message,
        });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
