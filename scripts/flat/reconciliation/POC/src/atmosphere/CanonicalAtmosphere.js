// References:
// - agents/topics/apps/flat/algorithm32/conclusions.md, accepted density, coefficient, phase, and transmittance equations.
// - agents/topics/apps/flat/reconciliation/action-plan.md, M1 Subgoal 1.3.
// - tmp/atmosphere/reconciliation/005-shared-baseline-constants.

import { dot } from '../math/vector.js';

export default class CanonicalAtmosphere {
    /**
     * @param {CanonicalAtmosphereConfig} configuration - Canonical constants and spectral channels.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw new TypeError('CanonicalAtmosphere configuration is required.');
        }

        const { constants, spectralChannels } = configuration;

        if (!constants || !Array.isArray(spectralChannels) || spectralChannels.length < 1) {
            throw new TypeError('CanonicalAtmosphere requires constants and spectral channels.');
        }

        this._constants = Object.freeze({ ...constants });
        this._spectralChannels = Object.freeze([...spectralChannels]);
    }

    get constants() {
        return this._constants;
    }

    get spectralChannels() {
        return this._spectralChannels;
    }

    /**
     * @param {AtmosphereCoordinate} coordinate - Geometry-resolved atmosphere coordinate.
     * @returns {MediumSample} Wavelength-aligned medium coefficients at the coordinate.
     */
    sampleMedium(coordinate) {
        const altitudeMeters = coordinate?.altitudeMeters;

        if (!Number.isFinite(altitudeMeters)) {
            throw new TypeError('AtmosphereCoordinate.altitudeMeters must be finite.');
        }

        const density = Object.freeze({
            rayleigh: exponentialDensity(altitudeMeters, this._constants.rayleighScaleHeightMeters),
            mie: exponentialDensity(altitudeMeters, this._constants.mieScaleHeightMeters),
            absorption: 0,
        });
        const rayleighScattering = this._spectralChannels.map((channel) =>
            density.rayleigh * this.rayleighScatteringCoefficientAt(channel.wavelengthNanometers));
        const mieExtinction = this._spectralChannels.map((channel) =>
            density.mie * this.mieExtinctionCoefficientAt(channel.wavelengthNanometers));
        const mieScattering = mieExtinction.map((value) => value * this._constants.mieSingleScatteringAlbedo);
        const absorption = this._spectralChannels.map(() => 0);
        const extinction = rayleighScattering.map((value, index) =>
            value + mieExtinction[index] + absorption[index]);
        const scattering = rayleighScattering.map((value, index) => value + mieScattering[index]);

        return Object.freeze({
            extinction: Object.freeze(extinction),
            scattering: Object.freeze(scattering),
            rayleighScattering: Object.freeze(rayleighScattering),
            mieScattering: Object.freeze(mieScattering),
            mieExtinction: Object.freeze(mieExtinction),
            absorption: Object.freeze(absorption),
            density,
        });
    }

    /**
     * @param {AtmospherePath} path - Geometry-built atmosphere path samples.
     * @returns {OpticalDepthSample} Integrated optical depth and transmittance.
     */
    integrateOpticalDepth(path) {
        const zero = this._zero();

        if (path?.blockedByGround) {
            return Object.freeze({
                opticalDepth: Object.freeze(this._spectralChannels.map(() => Number.POSITIVE_INFINITY)),
                transmittance: zero,
            });
        }

        const samples = path?.samples;

        if (!Array.isArray(samples)) {
            throw new TypeError('AtmospherePath.samples are required for optical-depth integration.');
        }

        const opticalDepth = this._zeroMutable();

        for (const sample of samples) {
            const medium = this.sampleMedium(sample.atmosphereCoordinate);
            const measureMeters = sample.measureMeters;

            for (let index = 0; index < opticalDepth.length; index += 1) {
                opticalDepth[index] += medium.extinction[index] * measureMeters;
            }
        }

        return Object.freeze({
            opticalDepth: Object.freeze(opticalDepth),
            transmittance: Object.freeze(opticalDepth.map((value) => Math.exp(-value))),
        });
    }

    /**
     * @param {{ readonly viewDirection?: UnitVector3, readonly incomingDirection?: UnitVector3 }} request
     *   Phase request.
     * @returns {PhaseSample} Phase values.
     */
    samplePhase(request = {}) {
        const { viewDirection, incomingDirection } = request;

        if (!viewDirection || !incomingDirection) {
            throw new TypeError('samplePhase requires viewDirection and incomingDirection.');
        }

        const nu = dot(viewDirection, incomingDirection);
        const rayleighPhase = rayleighPhaseFunction(nu);
        const miePhase = miePhaseFunction(this._constants.miePhaseFunctionG, nu);
        const phase = this._spectralChannels.map(() => rayleighPhase + miePhase);

        return Object.freeze({
            phase: Object.freeze(phase),
            rayleighPhase,
            miePhase,
        });
    }

    /**
     * @param {number} wavelengthNanometers - Wavelength in nanometers.
     * @returns {number} Rayleigh scattering coefficient.
     */
    rayleighScatteringCoefficientAt(wavelengthNanometers) {
        const wavelengthMicrometers = wavelengthNanometers / 1000;

        return this._constants.rayleighCoefficientScale * wavelengthMicrometers ** -4;
    }

    /**
     * @param {number} wavelengthNanometers - Wavelength in nanometers.
     * @returns {number} Mie extinction coefficient.
     */
    mieExtinctionCoefficientAt(wavelengthNanometers) {
        const wavelengthMicrometers = wavelengthNanometers / 1000;

        return (
            (this._constants.mieAngstromBeta / this._constants.mieScaleHeightMeters)
            * wavelengthMicrometers ** -this._constants.mieAngstromAlpha
        );
    }

    _zero() {
        return Object.freeze(this._spectralChannels.map(() => 0));
    }

    _zeroMutable() {
        return this._spectralChannels.map(() => 0);
    }
}

function exponentialDensity(altitudeMeters, scaleHeightMeters) {
    return Math.exp(-Math.max(0, altitudeMeters) / scaleHeightMeters);
}

function rayleighPhaseFunction(nu) {
    return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
    const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

    return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}
