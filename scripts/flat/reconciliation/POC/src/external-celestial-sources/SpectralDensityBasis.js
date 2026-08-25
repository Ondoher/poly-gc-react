// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, spectral basis and bin semantics.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const BOUND_TOLERANCE_NANOMETERS = 1e-12;

export default class SpectralDensityBasis {
    /**
     * @param {SpectralDensityBasisConfiguration} configuration - Quantity-bearing basis configuration.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER1_BASIS_CONFIGURATION_REQUIRED',
                'Spectral density basis configuration is required.');
        }

        this.id = requireText(configuration.id, 'id', 'ER1_BASIS_ID_REQUIRED');
        this.wavelengthUnits = requireText(
            configuration.wavelengthUnits,
            'wavelengthUnits',
            'ER1_BASIS_WAVELENGTH_UNITS_REQUIRED',
        );
        this.sampleSemantics = requireText(
            configuration.sampleSemantics,
            'sampleSemantics',
            'ER1_BASIS_SAMPLE_SEMANTICS_REQUIRED',
        );
        this.quadrature = requireText(
            configuration.quadrature,
            'quadrature',
            'ER1_BASIS_QUADRATURE_REQUIRED',
        );
        this.channels = validateChannels(configuration.channels);
        this.provenance = freezeRequiredJson(
            configuration.provenance,
            'ER1_BASIS_PROVENANCE_REQUIRED',
            'Basis provenance',
        );

        const fingerprintBody = this._fingerprintBody();
        this.fingerprint = stableHash(fingerprintBody);
        Object.freeze(this);
    }

    /**
     * @returns {SpectralDensityBasisDescriptor} Immutable descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._fingerprintBody(),
            fingerprint: this.fingerprint,
        });
    }

    _fingerprintBody() {
        return Object.freeze({
            id: this.id,
            wavelengthUnits: this.wavelengthUnits,
            sampleSemantics: this.sampleSemantics,
            quadrature: this.quadrature,
            channels: this.channels,
            provenance: this.provenance,
        });
    }
}

function validateChannels(channels) {
    if (!Array.isArray(channels) || channels.length === 0) {
        throw configurationError('ER1_BASIS_CHANNELS_REQUIRED',
            'Spectral density basis requires at least one channel.');
    }

    const ids = new Set();
    const validated = channels.map((channel, index) => {
        if (!channel || typeof channel !== 'object') {
            throw configurationError('ER1_BASIS_CHANNEL_INVALID',
                `Spectral density channel ${index} must be an object.`);
        }
        const id = requireText(channel.id, `channels[${index}].id`, 'ER1_BASIS_CHANNEL_ID_REQUIRED');
        if (ids.has(id)) {
            throw configurationError('ER1_BASIS_CHANNEL_ID_DUPLICATE',
                `Spectral density channel id ${id} is duplicated.`);
        }
        ids.add(id);

        const center = requireFinite(channel.centerNanometers, `${id}.centerNanometers`);
        const lower = requireFinite(channel.lowerBoundNanometers, `${id}.lowerBoundNanometers`);
        const upper = requireFinite(channel.upperBoundNanometers, `${id}.upperBoundNanometers`);
        const width = requireFinite(channel.widthNanometers, `${id}.widthNanometers`);
        if (!(lower < center && center < upper && width > 0)) {
            throw configurationError('ER1_BASIS_CHANNEL_BOUNDS_INVALID',
                `Spectral density channel ${id} has invalid ordered bounds.`);
        }
        if (Math.abs((upper - lower) - width) > BOUND_TOLERANCE_NANOMETERS) {
            throw configurationError('ER1_BASIS_CHANNEL_WIDTH_MISMATCH',
                `Spectral density channel ${id} width does not match its bounds.`);
        }
        if (Math.abs((lower + upper) / 2 - center) > BOUND_TOLERANCE_NANOMETERS) {
            throw configurationError('ER1_BASIS_CHANNEL_CENTER_MISMATCH',
                `Spectral density channel ${id} center is not the bin midpoint.`);
        }
        if (index > 0) {
            const previous = channels[index - 1];
            if (Math.abs(previous.upperBoundNanometers - lower) > BOUND_TOLERANCE_NANOMETERS) {
                throw configurationError('ER1_BASIS_CHANNELS_NOT_CONTIGUOUS',
                    `Spectral density channels ${index - 1} and ${index} are not contiguous.`);
            }
        }
        return Object.freeze({
            id,
            centerNanometers: center,
            lowerBoundNanometers: lower,
            upperBoundNanometers: upper,
            widthNanometers: width,
        });
    });
    return Object.freeze(validated);
}

function requireFinite(value, fieldName) {
    if (!Number.isFinite(value)) {
        throw configurationError('ER1_BASIS_CHANNEL_VALUE_INVALID', `${fieldName} must be finite.`);
    }
    return value;
}

function requireText(value, fieldName, code) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw configurationError(code, `${fieldName} must be a non-empty string.`);
    }
    return value;
}

function freezeRequiredJson(value, code, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, `${label} must be a JSON object.`);
    }
    try {
        return freezeJsonValue(value);
    } catch (error) {
        throw configurationError('ER1_BASIS_PROVENANCE_INVALID', `${label} must be valid finite JSON.`, {
            cause: error.message,
        });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

