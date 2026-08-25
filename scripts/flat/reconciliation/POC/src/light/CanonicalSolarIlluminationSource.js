// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   canonical solar ownership and incident-light separation.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER4C/ER5.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    createCanonicalSpectralDensityBasis,
} from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import {
    CANONICAL_DENSITY_BASIS_ID,
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_IRRADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import DistantSunIncidentRadianceCache from
    '../incident-radiance/DistantSunIncidentRadianceCache.js';
import { stableHash } from '../provenance/stableHash.js';

const CONFIGURATION_FIELDS = Object.freeze([
    'irradiancePacket',
    'directionToLight',
    'angularRadiusRadians',
    'cacheAltitudeBinCount',
    'cacheDirectionCount',
    'cacheBoundaryAltitudeMeters',
]);
const CACHE_REQUEST_FIELDS = Object.freeze([
    'bottomRadiusMeters',
    'topRadiusMeters',
    'spectralBasis',
    'boundaryAltitudeMeters',
]);
const CANONICAL_CHANNEL_COUNT = 15;
const UNIT_DIRECTION_TOLERANCE = 1e-12;
const SOURCE_KEY = 'distant-sun';
const EXPECTED_CANONICAL_BASIS_FINGERPRINT =
    createCanonicalSpectralDensityBasis().fingerprint;

export default class CanonicalSolarIlluminationSource {
    /**
     * Create a reset-only canonical solar illumination source.
     *
     * @param {CanonicalSolarIlluminationSourceConfiguration} configuration - Exact
     * canonical packet, source geometry, and cache controls.
     */
    constructor(configuration) {
        this._validateConfigurationShape(configuration);
        const irradiancePacket = this._validateIrradiancePacket(
            configuration.irradiancePacket,
        );
        const directionToLight = this._validateDirection(configuration.directionToLight);
        const angularRadiusRadians = this._validateAngularRadius(
            configuration.angularRadiusRadians,
        );
        const cacheAltitudeBinCount = this._validatePositiveSafeInteger(
            configuration.cacheAltitudeBinCount,
            'cacheAltitudeBinCount',
        );
        const cacheDirectionCount = this._validatePositiveSafeInteger(
            configuration.cacheDirectionCount,
            'cacheDirectionCount',
        );
        const cacheBoundaryAltitudeMeters = this._validateBoundaryAltitude(
            configuration.cacheBoundaryAltitudeMeters,
        );

        this.irradiancePacket = irradiancePacket;
        this.canonicalIrradiancePacketFingerprint = irradiancePacket.fingerprint;
        this.canonicalIrradianceProvenance = irradiancePacket.provenance;
        this.directionToLight = directionToLight;
        this.directionFromSource = Object.freeze(directionToLight.map((value) => -value));
        this.angularRadiusRadians = angularRadiusRadians;
        this.cacheAltitudeBinCount = cacheAltitudeBinCount;
        this.cacheDirectionCount = cacheDirectionCount;
        this.cacheBoundaryAltitudeMeters = cacheBoundaryAltitudeMeters;
        this.incidentRadianceCacheDescriptor = this.describeIncidentRadianceCache();
        this.descriptor = this._describeFingerprintBody();
        this.fingerprint = stableHash(this.descriptor);
        this.ownership = Object.freeze({
            canonicalPacketRetainedByIdentity: this.irradiancePacket === irradiancePacket,
            canonicalProvenanceRetainedByIdentity:
                this.canonicalIrradianceProvenance === irradiancePacket.provenance,
            canonicalPacketFingerprint: irradiancePacket.fingerprint,
            canonicalBasisFingerprint: irradiancePacket.basis.fingerprint,
            incidentRadianceArrayRetainedByIdentity:
                this.sampleDirectLighting().incidentRadiance === irradiancePacket.values,
            singleSpectrumPolicy:
                'Direct lighting returns the retained canonical packet values by identity.',
            excludedIntegrationSeams: Object.freeze([
                'visible-disk-provider',
                'alternate-or-fallback-spectrum',
                'source-specific-multiplier',
                'gpu-calibration-value',
            ]),
        });
        Object.freeze(this);
    }

    /**
     * Create one fail-loud source error.
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
     * Reject missing, alternate, fallback, gain, visible-disk, and GPU fields.
     *
     * @param {unknown} configuration - Candidate constructor configuration.
     * @returns {void}
     */
    _validateConfigurationShape(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CONFIGURATION_REQUIRED',
                'Canonical solar illumination configuration is required.',
            );
        }
        const unknownFields = Object.keys(configuration)
            .filter((field) => !CONFIGURATION_FIELDS.includes(field));
        if (unknownFields.length > 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CONFIGURATION_FIELD_UNSUPPORTED',
                'Canonical solar illumination rejects alternate spectra, fallbacks, gains, visible providers, and GPU values.',
                { unknownFields },
            );
        }
        const missingFields = CONFIGURATION_FIELDS
            .filter((field) => !Object.hasOwn(configuration, field));
        if (missingFields.length > 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CONFIGURATION_FIELD_REQUIRED',
                'Canonical solar illumination requires every exact source and cache control.',
                { missingFields },
            );
        }
    }

    /**
     * Validate the sole canonical solar irradiance owner.
     *
     * @param {unknown} packet - Candidate typed packet.
     * @returns {SpectralDensityPacket} Validated packet retained by identity.
     */
    _validateIrradiancePacket(packet) {
        if (!(packet instanceof SpectralDensityPacket)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_PACKET_REQUIRED',
                'Canonical solar illumination requires a SpectralDensityPacket.',
            );
        }
        if (packet.quantity !== SPECTRAL_IRRADIANCE_DENSITY) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_QUANTITY_MISMATCH',
                'Canonical solar illumination requires spectral irradiance density.',
                { expected: SPECTRAL_IRRADIANCE_DENSITY, actual: packet.quantity },
            );
        }
        const expectedUnits = SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY];
        if (packet.units !== expectedUnits) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_UNITS_MISMATCH',
                'Canonical solar illumination irradiance units do not match the reset contract.',
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
                'ER4C_CANONICAL_SOLAR_LIGHT_BASIS_MISMATCH',
                'Canonical solar illumination requires the exact canonical 15-channel basis.',
                {
                    expectedBasisId: CANONICAL_DENSITY_BASIS_ID,
                    actualBasisId: packet.basis.id,
                    expectedBasisFingerprint: EXPECTED_CANONICAL_BASIS_FINGERPRINT,
                    actualBasisFingerprint: packet.basis.fingerprint,
                    channelCount: packet.basis.channels.length,
                },
            );
        }
        return packet;
    }

    /**
     * Validate and freeze an exact unit direction without normalization.
     *
     * @param {unknown} direction - Candidate direction to the Sun.
     * @returns {UnitVector3} Frozen exact direction copy.
     */
    _validateDirection(direction) {
        if (
            !Array.isArray(direction)
            || direction.length !== 3
            || !direction.every(Number.isFinite)
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_DIRECTION_INVALID',
                'Canonical solar illumination direction must be a finite 3-tuple.',
            );
        }
        const length = Math.hypot(...direction);
        if (Math.abs(length - 1) > UNIT_DIRECTION_TOLERANCE) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_DIRECTION_NOT_UNIT',
                'Canonical solar illumination direction must already be unit length.',
                { length, tolerance: UNIT_DIRECTION_TOLERANCE },
            );
        }
        return Object.freeze([...direction]);
    }

    /**
     * Validate an exact positive solar angular radius.
     *
     * @param {unknown} angularRadiusRadians - Candidate angular radius.
     * @returns {number} Validated angular radius.
     */
    _validateAngularRadius(angularRadiusRadians) {
        if (
            !Number.isFinite(angularRadiusRadians)
            || angularRadiusRadians <= 0
            || angularRadiusRadians >= Math.PI / 2
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_ANGULAR_RADIUS_INVALID',
                'Canonical solar illumination angular radius must be finite in (0, pi/2).',
            );
        }
        return angularRadiusRadians;
    }

    /**
     * Validate one required positive safe-integer cache control.
     *
     * @param {unknown} value - Candidate control.
     * @param {string} field - Control name.
     * @returns {number} Validated control.
     */
    _validatePositiveSafeInteger(value, field) {
        if (!Number.isSafeInteger(value) || value <= 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_COUNT_INVALID',
                `Canonical solar illumination ${field} must be a positive safe integer.`,
                { field, value },
            );
        }
        return value;
    }

    /**
     * Validate one exact nonnegative cache boundary altitude.
     *
     * @param {unknown} value - Candidate altitude in meters.
     * @returns {number} Validated altitude.
     */
    _validateBoundaryAltitude(value) {
        if (!Number.isFinite(value) || value < 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_BOUNDARY_INVALID',
                'Canonical solar illumination cache boundary altitude must be finite and nonnegative.',
            );
        }
        return value;
    }

    /**
     * Validate a cache-factory request against the canonical packet and controls.
     *
     * @param {CanonicalSolarIncidentRadianceCacheRequest} request - Cache request.
     * @returns {void}
     */
    _validateCacheRequest(request) {
        if (!request || typeof request !== 'object' || Array.isArray(request)) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_REQUEST_REQUIRED',
                'Canonical solar illumination cache request is required.',
            );
        }
        const unknownFields = Object.keys(request)
            .filter((field) => !CACHE_REQUEST_FIELDS.includes(field));
        if (unknownFields.length > 0) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_REQUEST_FIELD_UNSUPPORTED',
                'Canonical solar illumination cache request contains unsupported controls.',
                { unknownFields },
            );
        }
        if (
            !Number.isFinite(request.bottomRadiusMeters)
            || request.bottomRadiusMeters <= 0
            || !Number.isFinite(request.topRadiusMeters)
            || request.topRadiusMeters <= request.bottomRadiusMeters
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_RADII_INVALID',
                'Canonical solar illumination cache requires ordered positive atmosphere radii.',
            );
        }
        const wavelengths = request.spectralBasis?.wavelengthsNanometers;
        if (
            !Array.isArray(wavelengths)
            || wavelengths.length !== this.irradiancePacket.basis.channels.length
            || wavelengths.some((wavelength, index) =>
                wavelength !== this.irradiancePacket.basis.channels[index].centerNanometers)
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_BASIS_MISMATCH',
                'Cache spectral basis must exactly match canonical irradiance channel centers.',
            );
        }
        if (
            request.boundaryAltitudeMeters !== undefined
            && request.boundaryAltitudeMeters !== this.cacheBoundaryAltitudeMeters
        ) {
            throw this._configurationError(
                'ER4C_CANONICAL_SOLAR_LIGHT_CACHE_CONTROL_MISMATCH',
                'Cache request boundary altitude must match the source-owned exact control.',
                { expected: this.cacheBoundaryAltitudeMeters,
                    actual: request.boundaryAltitudeMeters },
            );
        }
    }

    /**
     * Build the stable source descriptor body without duplicating spectrum values.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable descriptor body.
     */
    _describeFingerprintBody() {
        return Object.freeze({
            kind: 'canonical-solar-illumination-source-v1',
            sourceKey: SOURCE_KEY,
            canonicalIrradiancePacketFingerprint: this.irradiancePacket.fingerprint,
            canonicalIrradianceBasisFingerprint: this.irradiancePacket.basis.fingerprint,
            canonicalIrradianceSourceIdentity: Object.freeze({
                sourceId: this.irradiancePacket.provenance.sourceId,
                sourceVersion: this.irradiancePacket.provenance.sourceVersion,
                sourceHashSha256: this.irradiancePacket.provenance.sourceHashSha256,
            }),
            directionToLight: this.directionToLight,
            angularRadiusRadians: this.angularRadiusRadians,
            incidentRadianceCache: this.incidentRadianceCacheDescriptor,
            ownership: Object.freeze({
                incidentSpectrum: 'retained canonical irradiance packet values by identity',
                excludedIntegrationSeams: Object.freeze([
                    'visible-disk-provider',
                    'alternate-or-fallback-spectrum',
                    'source-specific-multiplier',
                    'gpu-calibration-value',
                ]),
            }),
        });
    }

    /**
     * Describe this reset-only illumination source and its stable fingerprint.
     *
     * @returns {CanonicalSolarIlluminationDescriptor} Immutable descriptor.
     */
    describe() {
        return Object.freeze({
            ...this.descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Describe the source-owned distant incident-radiance cache.
     *
     * @returns {IncidentRadianceCacheDescriptor} Distant cache descriptor.
     */
    describeIncidentRadianceCache() {
        return Object.freeze({
            cacheKind: 'distant',
            sourceKey: SOURCE_KEY,
            version: 1,
            dimensions: Object.freeze(['altitude', 'incomingDirection']),
            metadata: Object.freeze({
                altitudeBinCount: this.cacheAltitudeBinCount,
                directionCount: this.cacheDirectionCount,
                boundaryAltitudeMeters: this.cacheBoundaryAltitudeMeters,
                boundarySamplePolicy:
                    'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
            }),
        });
    }

    /**
     * Create one distant incident-radiance cache from exact source controls.
     *
     * @param {CanonicalSolarIncidentRadianceCacheRequest} request - Geometry and
     * legacy calculator spectral-basis request.
     * @returns {IncidentRadianceCache} Distant incident-radiance cache.
     */
    createIncidentRadianceCache(request) {
        this._validateCacheRequest(request);
        return new DistantSunIncidentRadianceCache({
            descriptor: this.incidentRadianceCacheDescriptor,
            bottomRadiusMeters: request.bottomRadiusMeters,
            topRadiusMeters: request.topRadiusMeters,
            altitudeBinCount: this.cacheAltitudeBinCount,
            directionCount: this.cacheDirectionCount,
            directionToLight: this.directionToLight,
            spectralBasis: request.spectralBasis,
            boundaryAltitudeMeters: this.cacheBoundaryAltitudeMeters,
        });
    }

    /**
     * Sample canonical top-of-atmosphere direct solar irradiance by identity.
     *
     * @returns {DirectLightingSample} Direct solar facts.
     */
    sampleDirectLighting() {
        return Object.freeze({
            incidentRadiance: this.irradiancePacket.values,
            directionToLight: this.directionToLight,
            metadata: Object.freeze({
                directionFromSource: this.directionFromSource,
                angularRadiusRadians: this.angularRadiusRadians,
            }),
        });
    }

    /**
     * Resolve the distant source path at the atmosphere boundary.
     *
     * @returns {SourcePathLimit} Distant source path limit.
     */
    resolveSourcePathLimit() {
        return Object.freeze({
            maxDistanceMeters: null,
            reason: 'distant-source-to-atmosphere-boundary',
        });
    }
}
