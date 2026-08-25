// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   fixed catalog-J2000 point geometry and accepted CALSPEC Sirius irradiance.
// - tmp/atmosphere/reconciliation/025-m5-flat32-globe-celestial-cpu-soft-shader/provenance.json,
//   bounded source revision and copied bright-star fixture hash.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from
    '../external-celestial-sources/ExternalCelestialSource.js';
import SpectralDensityPacket from
    '../external-celestial-sources/SpectralDensityPacket.js';
import { createCanonicalSpectralDensityBasis } from
    '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import {
    POINT_CELESTIAL_SOURCE,
    SPECTRAL_IRRADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const UNIT_VECTOR_TOLERANCE = 1e-12;
const ROTATION_TOLERANCE = 1e-12;
const DEGREES_TO_RADIANS = Math.PI / 180;
const ARCSECONDS_PER_DEGREE = 3600;
const J2000_MEAN_OBLIQUITY_ARCSECONDS = 84381.448;
const CONFIGURATION_FIELDS = Object.freeze([
    'calspecPacket',
    'j2000ToCameraRotationMatrix',
]);
const EXPECTED_BASIS_FINGERPRINT = createCanonicalSpectralDensityBasis().fingerprint;
const EXPECTED_CALSPEC = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec;
const SOURCE_DEPTH = Object.freeze({ kind: 'infinite' });
const CATALOG_PROVENANCE = freezeJsonValue({
    copiedFactScope: 'HIP 32349 identity and fixed catalog-J2000 right ascension/declination only',
    copiedFrom:
        'scripts/flat/reconciliation/POC/src/external-celestial-candidates/fixtures/flat-bright-star-subset.js',
    copiedFixtureHashSha256:
        'd22d89007b02b78eb9ac9bd0c8c3957cf2715377bacaf66b5b49d7adb5141b1b',
    retainedByRecord:
        '025-m5-flat32-globe-celestial-cpu-soft-shader',
    sourceRevisionAtRecordExecution:
        '514d5f6080d2dd485efdb07b5da9a203357a40c0',
    originalFixtureSourceLabel: 'iau-bright-named-j2000',
    runtimeDependencyOnCopiedFixture: false,
    qualification:
        'This bounded POC snapshot supplies fixed catalog-J2000 direction only; CALSPEC independently owns physical spectral irradiance.',
});
const SIRIUS_CATALOG_ENTRY = freezeJsonValue({
    id: 'HIP 32349',
    name: 'Sirius',
    rightAscensionDegrees: 101.287155,
    declinationDegrees: -16.716116,
    frame: 'equatorial-ICRF-J2000-fixed',
    provenance: CATALOG_PROVENANCE,
});
const APPARENT_PLACE_EXCLUSIONS = Object.freeze([
    'proper-motion',
    'parallax',
    'annual-or-diurnal-aberration',
    'precession-to-date',
    'nutation',
    'atmospheric-refraction',
]);

export default class Er6CalspecSiriusCatalogPointSource {
    /**
     * Create the ER6 fixed-J2000 Sirius point source from the accepted CALSPEC packet.
     *
     * @param {Readonly<Record<string, unknown>>} configuration - CALSPEC packet and proper J2000-to-camera rotation.
     */
    constructor(configuration) {
        requireConfiguration(configuration);
        const calspecPacket = validateCalspecPacket(configuration.calspecPacket);
        const j2000ToCameraRotationMatrix = validateRotationMatrix(
            configuration.j2000ToCameraRotationMatrix,
        );
        const equatorialJ2000Direction = equatorialDirectionFromCatalog(
            SIRIUS_CATALOG_ENTRY,
        );
        const meanObliquityRadians = J2000_MEAN_OBLIQUITY_ARCSECONDS
            / ARCSECONDS_PER_DEGREE * DEGREES_TO_RADIANS;
        const eclipticJ2000Direction = validateUnitDirection(
            rotateEquatorialJ2000ToEclipticJ2000(
                equatorialJ2000Direction,
                meanObliquityRadians,
            ),
            'derived ecliptic J2000 direction',
        );
        const directionCamera = validateUnitDirection(
            multiplyMatrixVector(
                j2000ToCameraRotationMatrix,
                eclipticJ2000Direction,
            ),
            'derived camera direction',
        );
        const catalogFingerprint = stableHash(SIRIUS_CATALOG_ENTRY);
        const transform = freezeJsonValue({
            kind: 'fixed-catalog-j2000-to-camera-transform-v1',
            catalogFingerprint,
            sourceFrame: 'equatorial-ICRF-J2000-fixed',
            intermediateFrame: 'ecliptic-of-J2000-IAU76',
            targetFrame: 'camera-space-unit-vector-forward-minus-z',
            equatorialJ2000Direction,
            meanObliquityArcseconds: J2000_MEAN_OBLIQUITY_ARCSECONDS,
            meanObliquityRadians,
            equatorialToEclipticConvention:
                '[x, cos(epsilon)*y + sin(epsilon)*z, -sin(epsilon)*y + cos(epsilon)*z]',
            eclipticJ2000Direction,
            j2000ToCameraRotationMatrix,
            matrixConvention:
                'row-major-direction-camera-equals-matrix-times-direction-ecliptic-j2000',
            directionCamera,
        });
        const transformFingerprint = stableHash(transform);

        this.catalog = SIRIUS_CATALOG_ENTRY;
        this.catalogFingerprint = catalogFingerprint;
        this.calspecPacket = calspecPacket;
        this.j2000ToCameraRotationMatrix = j2000ToCameraRotationMatrix;
        this.equatorialJ2000Direction = equatorialJ2000Direction;
        this.eclipticJ2000Direction = eclipticJ2000Direction;
        this.directionCamera = directionCamera;
        this.sourceDepth = SOURCE_DEPTH;
        this.transform = transform;
        this.transformFingerprint = transformFingerprint;
        this.apparentPlaceScope = freezeJsonValue({
            kind: 'fixed-catalog-j2000-only',
            retainedCorrections: Object.freeze([]),
            excludedCorrections: APPARENT_PLACE_EXCLUSIONS,
            qualification:
                'ER6 tests physical transport at a fixed catalog-J2000 direction, not apparent place or astrometric accuracy at the scene epoch.',
        });
        this.source = new ExternalCelestialSource({
            id: EXPECTED_CALSPEC.sourceId,
            kind: POINT_CELESTIAL_SOURCE,
            geometry: {
                kind: 'fixed-catalog-j2000-infinite-point-source-v1',
                owner: 'Er6CalspecSiriusCatalogPointSource',
                catalog: this.catalog,
                catalogFingerprint,
                sourceFrame: this.transform.sourceFrame,
                intermediateFrame: this.transform.intermediateFrame,
                equatorialJ2000Direction,
                eclipticJ2000Direction,
                j2000ToCameraRotationMatrix,
                directionCamera,
                directionFrame: this.transform.targetFrame,
                transformFingerprint,
                depth: SOURCE_DEPTH,
                apparentPlaceScope: this.apparentPlaceScope,
            },
            spectralMeasure: calspecPacket,
        });
        this.fingerprint = stableHash({
            kind: 'er6-calspec-sirius-catalog-point-source-v1',
            sourceFingerprint: this.source.fingerprint,
            catalogFingerprint,
            transformFingerprint,
            calspecPacketFingerprint: calspecPacket.fingerprint,
            sourceDepth: SOURCE_DEPTH,
        });
        Object.freeze(this);
    }

    /**
     * Describe the fixed-J2000 geometry, accepted CALSPEC measure, and accuracy scope.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable Sirius source descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'er6-calspec-sirius-catalog-point-source-v1',
            fingerprint: this.fingerprint,
            source: this.source.describe(),
            sourceDepth: this.sourceDepth,
            catalog: this.catalog,
            catalogFingerprint: this.catalogFingerprint,
            transform: this.transform,
            transformFingerprint: this.transformFingerprint,
            apparentPlaceScope: this.apparentPlaceScope,
            radiometryQualification:
                'The accepted CALSPEC packet owns top-of-atmosphere spectral irradiance; catalog magnitude is neither copied nor reapplied.',
        });
    }
}

function requireConfiguration(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError('ER6_SIRIUS_CONFIGURATION_REQUIRED',
            'ER6 CALSPEC Sirius source configuration is required.');
    }
    const unknown = Object.keys(value).filter((field) =>
        !CONFIGURATION_FIELDS.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_SIRIUS_CONFIGURATION_FIELD_UNSUPPORTED',
            'ER6 CALSPEC Sirius configuration contains unsupported fields.', {
                fields: unknown,
            });
    }
}

function validateCalspecPacket(value) {
    if (
        !(value instanceof SpectralDensityPacket)
        || value.quantity !== SPECTRAL_IRRADIANCE_DENSITY
        || value.units !== 'W m^-2 nm^-1'
        || value.basis.fingerprint !== EXPECTED_BASIS_FINGERPRINT
        || value.values.length !== 15
        || !value.values.every((entry) => Number.isFinite(entry) && entry >= 0)
        || value.provenance.sourceId !== EXPECTED_CALSPEC.sourceId
        || value.provenance.sourceVersion !== EXPECTED_CALSPEC.sourceVersion
        || value.provenance.sourceHashSha256 !== EXPECTED_CALSPEC.sourceHashSha256
        || value.provenance.sourceRowCount !== EXPECTED_CALSPEC.expectedRowCount
        || value.provenance.fitsHeader?.targetId !== EXPECTED_CALSPEC.expectedTargetId
        || value.provenance.fitsHeader?.pedigree !== EXPECTED_CALSPEC.expectedPedigree
    ) {
        throw configurationError('ER6_SIRIUS_CALSPEC_PACKET_INVALID',
            'ER6 Sirius requires the untampered accepted canonical CALSPEC packet.');
    }
    return value;
}

function equatorialDirectionFromCatalog(entry) {
    const rightAscensionRadians = entry.rightAscensionDegrees * DEGREES_TO_RADIANS;
    const declinationRadians = entry.declinationDegrees * DEGREES_TO_RADIANS;
    const cosDeclination = Math.cos(declinationRadians);
    return validateUnitDirection([
        cosDeclination * Math.cos(rightAscensionRadians),
        cosDeclination * Math.sin(rightAscensionRadians),
        Math.sin(declinationRadians),
    ], 'catalog equatorial J2000 direction');
}

function rotateEquatorialJ2000ToEclipticJ2000(direction, obliquityRadians) {
    const cosine = Math.cos(obliquityRadians);
    const sine = Math.sin(obliquityRadians);
    return Object.freeze([
        direction[0],
        cosine * direction[1] + sine * direction[2],
        -sine * direction[1] + cosine * direction[2],
    ]);
}

function validateRotationMatrix(value) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every((row) =>
            Array.isArray(row) && row.length === 3 && row.every(Number.isFinite))
    ) {
        throw configurationError('ER6_SIRIUS_CAMERA_MATRIX_INVALID',
            'J2000-to-camera rotation must be a finite row-major 3-by-3 matrix.');
    }
    const matrix = Object.freeze(value.map((row) => Object.freeze([...row])));
    const columns = Object.freeze([0, 1, 2].map((column) => Object.freeze([
        matrix[0][column],
        matrix[1][column],
        matrix[2][column],
    ])));
    const normResiduals = [...matrix, ...columns].map((axis) =>
        Math.abs(Math.hypot(...axis) - 1));
    const orthogonalityResiduals = [
        Math.abs(dot(matrix[0], matrix[1])),
        Math.abs(dot(matrix[0], matrix[2])),
        Math.abs(dot(matrix[1], matrix[2])),
        Math.abs(dot(columns[0], columns[1])),
        Math.abs(dot(columns[0], columns[2])),
        Math.abs(dot(columns[1], columns[2])),
    ];
    const maximumOrthonormalityResidual = Math.max(
        ...normResiduals,
        ...orthogonalityResiduals,
    );
    const determinant = determinant3(matrix);
    const determinantResidual = Math.abs(determinant - 1);
    if (
        maximumOrthonormalityResidual > ROTATION_TOLERANCE
        || determinantResidual > ROTATION_TOLERANCE
    ) {
        throw configurationError('ER6_SIRIUS_CAMERA_MATRIX_NOT_PROPER_ROTATION',
            'J2000-to-camera matrix must be a proper orthonormal rotation.', {
                maximumOrthonormalityResidual,
                determinant,
                determinantResidual,
                tolerance: ROTATION_TOLERANCE,
            });
    }
    return matrix;
}

function multiplyMatrixVector(matrix, vector) {
    return Object.freeze(matrix.map((row) => dot(row, vector)));
}

function validateUnitDirection(value, label) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw configurationError('ER6_SIRIUS_DIRECTION_INVALID',
            `${label} must be a finite 3-tuple.`);
    }
    const length = Math.hypot(...value);
    if (Math.abs(length - 1) > UNIT_VECTOR_TOLERANCE) {
        throw configurationError('ER6_SIRIUS_DIRECTION_NOT_UNIT',
            `${label} must be unit length.`, {
                length,
                tolerance: UNIT_VECTOR_TOLERANCE,
            });
    }
    return Object.freeze([...value]);
}

function dot(left, right) {
    return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function determinant3(matrix) {
    return matrix[0][0] * (
        matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1]
    ) - matrix[0][1] * (
        matrix[1][0] * matrix[2][2] - matrix[1][2] * matrix[2][0]
    ) + matrix[0][2] * (
        matrix[1][0] * matrix[2][1] - matrix[1][1] * matrix[2][0]
    );
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
