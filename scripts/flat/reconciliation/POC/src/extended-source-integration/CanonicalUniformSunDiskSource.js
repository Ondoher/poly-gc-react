// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   canonical source ownership and typed extended boundary radiance.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER4C/ER5.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    createCanonicalSpectralDensityBasis,
} from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import {
    CANONICAL_DENSITY_BASIS_ID,
    EXTENDED_CELESTIAL_SOURCE,
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_IRRADIANCE_DENSITY,
    SPECTRAL_RADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import { stableHash } from '../provenance/stableHash.js';

const CONFIGURATION_FIELDS = Object.freeze([
    'id',
    'irradiancePacket',
    'angularRadiusRadians',
    'centerDirectionCamera',
]);
const CANONICAL_CHANNEL_COUNT = 15;
const EXPECTED_CANONICAL_BASIS_FINGERPRINT =
    createCanonicalSpectralDensityBasis().fingerprint;
const UNIT_DIRECTION_TOLERANCE = 1e-12;
const MAX_RECONSTRUCTION_RELATIVE_RESIDUAL = 1e-10;

export default class CanonicalUniformSunDiskSource {
    /**
     * Create a reset-only uniform solar-disk radiance adapter.
     *
     * @param {CanonicalUniformSunDiskSourceConfiguration} configuration - Canonical
     * irradiance owner, exact geometry, and source identity.
     */
    constructor(configuration) {
        this._validateConfigurationShape(configuration);
        const id = this._validateSourceId(configuration.id);
        const irradiancePacket = this._validateIrradiancePacket(
            configuration.irradiancePacket,
        );
        const angularRadiusRadians = this._validateAngularRadius(
            configuration.angularRadiusRadians,
        );
        const centerDirectionCamera = this._validateCenterDirection(
            configuration.centerDirectionCamera,
        );
        const projectedSolidAngleSteradians = Math.PI * Math.sin(angularRadiusRadians) ** 2;
        if (
            !Number.isFinite(projectedSolidAngleSteradians)
            || projectedSolidAngleSteradians <= 0
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_PROJECTED_SOLID_ANGLE_INVALID',
                'Uniform Sun-disk projected solid angle must be finite and positive.',
            );
        }
        const radianceScalePerSteradian = 1 / projectedSolidAngleSteradians;
        const radianceValues = irradiancePacket.values.map((value) =>
            value * radianceScalePerSteradian);
        if (!radianceValues.every((value) => Number.isFinite(value) && value >= 0)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_RADIANCE_INVALID',
                'Uniform Sun-disk radiance derivation produced an invalid channel value.',
            );
        }

        const uncertainty = this._deriveRadianceUncertainty(
            irradiancePacket.uncertainty,
            radianceScalePerSteradian,
        );
        const derivedHash = stableHash({
            kind: 'canonical-uniform-sun-disk-radiance-derivation-v1',
            canonicalIrradiancePacketFingerprint: irradiancePacket.fingerprint,
            angularRadiusRadians,
            formula: 'L_lambda = E_lambda / (pi * sin(alpha)^2)',
        });
        const packet = new SpectralDensityPacket({
            quantity: SPECTRAL_RADIANCE_DENSITY,
            units: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
            basis: irradiancePacket.basis,
            values: radianceValues,
            provenance: {
                sourceId: `${irradiancePacket.provenance.sourceId}-uniform-sun-disk-radiance`,
                sourceVersion: 'reset-derived-uniform-disk-v1',
                sourceHashSha256: derivedHash,
                derivation: 'L_lambda = E_lambda / (pi * sin(alpha)^2)',
                canonicalIrradiancePacketFingerprint: irradiancePacket.fingerprint,
                canonicalIrradianceBasisFingerprint: irradiancePacket.basis.fingerprint,
                canonicalIrradianceSourceIdentity: {
                    sourceId: irradiancePacket.provenance.sourceId,
                    sourceVersion: irradiancePacket.provenance.sourceVersion,
                    sourceHashSha256: irradiancePacket.provenance.sourceHashSha256,
                },
                angularRadiusRadians,
                projectedSolidAngleSteradians,
                ownership:
                    'Derived radiance adapter only; the retained irradiance packet remains the sole canonical solar-spectrum owner.',
            },
            uncertainty,
        });
        if (packet.basis !== irradiancePacket.basis) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_DERIVED_BASIS_MISMATCH',
                'Derived Sun-disk radiance must retain the canonical irradiance basis object.',
            );
        }

        const reconstruction = this._verifyReconstruction(
            irradiancePacket,
            packet,
            projectedSolidAngleSteradians,
        );
        const source = new ExternalCelestialSource({
            id,
            kind: EXTENDED_CELESTIAL_SOURCE,
            geometry: {
                kind: 'canonical-uniform-angular-sun-disk',
                owner: 'canonical solar irradiance packet through a deterministic radiance adapter',
                centerDirectionCamera,
                directionFrame: 'camera-space-unit-vector-forward-minus-z',
                angularRadiusRadians,
                projectedSolidAngleSteradians,
                radianceDerivation: 'L_lambda = E_lambda / (pi * sin(alpha)^2)',
                canonicalIrradiancePacketFingerprint: irradiancePacket.fingerprint,
                qualification:
                    'Uniform projected disk for source reconstruction only; no physical solar limb-darkening claim.',
            },
            spectralMeasure: packet,
        });

        this.id = id;
        this.irradiancePacket = irradiancePacket;
        this.canonicalIrradiancePacketFingerprint = irradiancePacket.fingerprint;
        this.canonicalIrradianceProvenance = irradiancePacket.provenance;
        this.angularRadiusRadians = angularRadiusRadians;
        this.centerDirectionCamera = centerDirectionCamera;
        this.projectedSolidAngleSteradians = projectedSolidAngleSteradians;
        this.radianceScalePerSteradian = radianceScalePerSteradian;
        this.packet = packet;
        this.source = source;
        this.reconstruction = reconstruction;
        this.ownership = Object.freeze({
            canonicalQuantity: irradiancePacket.quantity,
            canonicalUnits: irradiancePacket.units,
            canonicalPacketFingerprint: irradiancePacket.fingerprint,
            canonicalBasisFingerprint: irradiancePacket.basis.fingerprint,
            irradiancePacketRetainedByIdentity: this.irradiancePacket === irradiancePacket,
            canonicalProvenanceRetainedByIdentity:
                this.canonicalIrradianceProvenance === irradiancePacket.provenance,
            derivedQuantity: packet.quantity,
            derivedUnits: packet.units,
            derivedPacketFingerprint: packet.fingerprint,
            sourceSpecificGain: 'none',
            limbDarkeningClaim: 'none',
        });
        Object.freeze(this);
    }

    /**
     * Create one fail-loud adapter error.
     *
     * @param {string} code - Stable reconciliation error code.
     * @param {string} message - Human-readable failure.
     * @param {unknown} details - Optional structured diagnostics.
     * @returns {ReconciliationConfigurationError} Configuration error.
     */
    _configurationError(code, message, details = null) {
        return new ReconciliationConfigurationError(message, { code, details });
    }

    /**
     * Reject missing, array, and noncanonical configuration fields.
     *
     * @param {unknown} configuration - Candidate constructor configuration.
     * @returns {void}
     */
    _validateConfigurationShape(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_CONFIGURATION_REQUIRED',
                'Canonical uniform Sun-disk configuration is required.',
            );
        }
        const unknownFields = Object.keys(configuration)
            .filter((field) => !CONFIGURATION_FIELDS.includes(field));
        if (unknownFields.length > 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_CONFIGURATION_FIELD_UNSUPPORTED',
                'Canonical uniform Sun-disk configuration rejects alternate values, gains, and limb controls.',
                { unknownFields },
            );
        }
        const missingFields = CONFIGURATION_FIELDS
            .filter((field) => !Object.hasOwn(configuration, field));
        if (missingFields.length > 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_CONFIGURATION_FIELD_REQUIRED',
                'Canonical uniform Sun-disk configuration is incomplete.',
                { missingFields },
            );
        }
    }

    /**
     * Validate one exact source identifier.
     *
     * @param {unknown} id - Candidate source id.
     * @returns {string} Validated id.
     */
    _validateSourceId(id) {
        if (typeof id !== 'string' || id === '' || id !== id.trim()) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_ID_INVALID',
                'Canonical uniform Sun-disk id must be nonempty and whitespace-normalized.',
            );
        }
        return id;
    }

    /**
     * Validate the retained canonical solar irradiance owner.
     *
     * @param {unknown} packet - Candidate canonical packet.
     * @returns {SpectralDensityPacket} Validated packet retained by identity.
     */
    _validateIrradiancePacket(packet) {
        if (!(packet instanceof SpectralDensityPacket)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_IRRADIANCE_PACKET_REQUIRED',
                'Canonical uniform Sun disk requires a SpectralDensityPacket irradiance owner.',
            );
        }
        if (packet.quantity !== SPECTRAL_IRRADIANCE_DENSITY) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_IRRADIANCE_QUANTITY_MISMATCH',
                'Canonical uniform Sun disk requires spectral irradiance density input.',
                { expected: SPECTRAL_IRRADIANCE_DENSITY, actual: packet.quantity },
            );
        }
        const expectedUnits = SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY];
        if (packet.units !== expectedUnits) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_IRRADIANCE_UNITS_MISMATCH',
                'Canonical uniform Sun-disk irradiance units do not match the reset contract.',
                { expected: expectedUnits, actual: packet.units },
            );
        }
        if (
            packet.basis.id !== CANONICAL_DENSITY_BASIS_ID
            || packet.basis.fingerprint !== EXPECTED_CANONICAL_BASIS_FINGERPRINT
            || packet.basis.channels.length !== CANONICAL_CHANNEL_COUNT
            || packet.values.length !== CANONICAL_CHANNEL_COUNT
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_IRRADIANCE_BASIS_MISMATCH',
                'Canonical uniform Sun disk requires the canonical 15-channel density basis.',
                { expectedBasisId: CANONICAL_DENSITY_BASIS_ID,
                    actualBasisId: packet.basis.id,
                    expectedBasisFingerprint: EXPECTED_CANONICAL_BASIS_FINGERPRINT,
                    actualBasisFingerprint: packet.basis.fingerprint,
                    channelCount: packet.basis.channels.length },
            );
        }
        return packet;
    }

    /**
     * Validate one exact positive angular radius.
     *
     * @param {unknown} angularRadiusRadians - Candidate source radius.
     * @returns {number} Validated radius.
     */
    _validateAngularRadius(angularRadiusRadians) {
        if (
            !Number.isFinite(angularRadiusRadians)
            || angularRadiusRadians <= 0
            || angularRadiusRadians >= Math.PI / 2
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_ANGULAR_RADIUS_INVALID',
                'Canonical uniform Sun-disk angular radius must be finite in (0, pi/2).',
            );
        }
        return angularRadiusRadians;
    }

    /**
     * Validate and freeze one exact camera-space unit direction without normalization.
     *
     * @param {unknown} direction - Candidate center direction.
     * @returns {UnitVector3} Frozen exact direction copy.
     */
    _validateCenterDirection(direction) {
        if (
            !Array.isArray(direction)
            || direction.length !== 3
            || !direction.every(Number.isFinite)
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_CENTER_DIRECTION_INVALID',
                'Canonical uniform Sun-disk center direction must be a finite camera-space 3-tuple.',
            );
        }
        const length = Math.hypot(...direction);
        if (Math.abs(length - 1) > UNIT_DIRECTION_TOLERANCE) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_CENTER_DIRECTION_NOT_UNIT',
                'Canonical uniform Sun-disk center direction must already be unit length.',
                { length, tolerance: UNIT_DIRECTION_TOLERANCE },
            );
        }
        return Object.freeze([...direction]);
    }

    /**
     * Scale available absolute uncertainty arrays into radiance units.
     *
     * @param {SpectralDensityUncertainty} uncertainty - Canonical irradiance uncertainty.
     * @param {number} radianceScalePerSteradian - Deterministic E-to-L scale.
     * @returns {SpectralDensityUncertainty} Derived radiance uncertainty descriptor.
     */
    _deriveRadianceUncertainty(uncertainty, radianceScalePerSteradian) {
        const derived = {
            status: uncertainty.status,
            model: `${uncertainty.model}; scaled by 1/(pi*sin(alpha)^2)`,
            notes: Object.freeze([
                ...(uncertainty.notes ?? []),
                'Absolute uncertainty arrays, when present, use the same deterministic irradiance-to-uniform-radiance scale as the central values.',
                'No additional angular-profile or limb-darkening uncertainty is invented.',
            ]),
        };
        for (const field of ['values', 'systematicValues']) {
            if (uncertainty[field] !== undefined) {
                derived[field] = uncertainty[field].map((value) =>
                    value * radianceScalePerSteradian);
            }
        }
        return derived;
    }

    /**
     * Verify channel-wise irradiance reconstruction before exposing the adapter.
     *
     * @param {SpectralDensityPacket} irradiancePacket - Canonical input owner.
     * @param {SpectralDensityPacket} radiancePacket - Derived uniform radiance.
     * @param {number} projectedSolidAngleSteradians - Projected disk solid angle.
     * @returns {CanonicalUniformSunDiskReconstruction} Frozen residual diagnostics.
     */
    _verifyReconstruction(irradiancePacket, radiancePacket, projectedSolidAngleSteradians) {
        const relativeResiduals = radiancePacket.values.map((radiance, channelIndex) => {
            const expected = irradiancePacket.values[channelIndex];
            const reconstructed = radiance * projectedSolidAngleSteradians;
            if (expected === 0) {
                return reconstructed === 0 ? 0 : Number.POSITIVE_INFINITY;
            }
            return Math.abs(reconstructed - expected) / expected;
        });
        const maxRelativeResidual = Math.max(...relativeResiduals);
        if (
            !Number.isFinite(maxRelativeResidual)
            || maxRelativeResidual > MAX_RECONSTRUCTION_RELATIVE_RESIDUAL
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SUN_IRRADIANCE_RECONSTRUCTION_FAILED',
                'Uniform Sun-disk radiance does not reconstruct canonical irradiance.',
                { maxRelativeResidual,
                    tolerance: MAX_RECONSTRUCTION_RELATIVE_RESIDUAL },
            );
        }
        return Object.freeze({
            formula:
                'E_reconstructed_lambda = L_uniform_lambda * pi * sin(alpha)^2',
            canonicalIrradiancePacketFingerprint: irradiancePacket.fingerprint,
            derivedRadiancePacketFingerprint: radiancePacket.fingerprint,
            projectedSolidAngleSteradians,
            relativeResiduals: Object.freeze(relativeResiduals),
            maxRelativeResidual,
            tolerance: MAX_RECONSTRUCTION_RELATIVE_RESIDUAL,
            accepted: true,
        });
    }

    /**
     * Return source-uniform top-of-atmosphere radiance for one quadrature sample.
     *
     * @param {ExtendedAngularSample} _sample - Integrator-owned angular sample.
     * @returns {readonly number[]} Immutable derived radiance channels.
     */
    radianceForSample(_sample) {
        return this.packet.values;
    }
}
