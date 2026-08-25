// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   conservative extended-source integration and uniform-disk normalization.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import SpectralDensityBasis from '../external-celestial-sources/SpectralDensityBasis.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    createCanonicalSolarIrradianceDensity,
} from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import {
    createCanonicalSpectralDensityBasis,
} from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import {
    EXTENDED_CELESTIAL_SOURCE,
    SPECTRAL_IRRADIANCE_DENSITY,
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_RADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import {
    EXTERNAL_CELESTIAL_FIXTURE_MANIFEST,
} from '../external-celestial-sources/fixtureManifest.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    validateEr6HorizonsPhysicalGlobeStateIntegrity,
} from './Er6HorizonsPhysicalGlobeStateProvider.js';
import {
    createEr6LimeGlobeMoonIrradianceEvaluationFingerprint,
} from './Er6LimeGlobeMoonIrradianceProvider.js';

const UNIT_VECTOR_TOLERANCE = 1e-12;
const RECONSTRUCTION_RELATIVE_TOLERANCE = 1e-10;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const EXPECTED_CANONICAL_BASIS = createCanonicalSpectralDensityBasis();
const EXPECTED_CANONICAL_BASIS_FINGERPRINT = EXPECTED_CANONICAL_BASIS.fingerprint;
const EXPECTED_CANONICAL_SOLAR_FINGERPRINT = createCanonicalSolarIrradianceDensity(
    EXPECTED_CANONICAL_BASIS,
).fingerprint;
const EXPECTED_LIME_SOURCE = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate;
const CONFIGURATION_FIELDS = Object.freeze([
    'evaluation',
    'cameraTransform',
]);
const CAMERA_TRANSFORM_FIELDS = Object.freeze([
    'kind',
    'physicalStateFingerprint',
    'sourceFrame',
    'sourceDirectionJ2000',
    'j2000ToCameraRotationMatrix',
    'matrixConvention',
    'cameraDirectionFrame',
]);
const CAMERA_MATRIX_CONVENTION =
    'row-major-direction-camera-equals-matrix-times-source-direction-j2000';
const CAMERA_DIRECTION_FRAME = 'camera-space-unit-vector-forward-minus-z';

export default class Er6UniformGlobeMoonDiskSource {
    /**
     * Create a finite uniform-radiance transport surrogate from calibrated disk irradiance.
     *
     * @param {Er6UniformGlobeMoonDiskSourceConfiguration} configuration - LIME evaluation and physical camera transform.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER6_UNIFORM_MOON_CONFIGURATION_REQUIRED',
                'ER6 uniform globe-Moon disk configuration is required.');
        }
        rejectProhibitedFields(configuration, 'disk configuration');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'disk configuration');
        const evaluation = validateEvaluation(configuration.evaluation);
        const cameraTransform = validateCameraTransform(
            configuration.cameraTransform,
            evaluation,
        );
        const angularRadiusRadians = evaluation.geometry.angularRadiusRadians;
        const finiteBodyCenterDepthMeters =
            evaluation.geometry.finiteBodyCenterDepthMeters;
        if (
            !Number.isFinite(angularRadiusRadians)
            || angularRadiusRadians <= 0
            || angularRadiusRadians >= Math.PI / 2
            || !Number.isFinite(finiteBodyCenterDepthMeters)
            || finiteBodyCenterDepthMeters <= 0
        ) {
            throw configurationError('ER6_UNIFORM_MOON_GEOMETRY_INVALID',
                'ER6 uniform globe-Moon disk requires finite positive angular radius and depth.');
        }
        const projectedDiskSolidAngleSteradians = Math.PI
            * Math.sin(angularRadiusRadians) ** 2;
        const irradianceValues = evaluation.diskIntegratedSpectralIrradiance.values;
        const radianceValues = Object.freeze(irradianceValues.map((value) =>
            value / projectedDiskSolidAngleSteradians));
        const reconstructedIrradianceValues = Object.freeze(radianceValues.map((value) =>
            value * projectedDiskSolidAngleSteradians));
        const reconstructionRelativeResiduals = Object.freeze(
            reconstructedIrradianceValues.map((value, index) => {
                const expected = irradianceValues[index];
                return expected === 0 ? Math.abs(value) : Math.abs(value / expected - 1);
            }),
        );
        const maximumReconstructionRelativeResidual = Math.max(
            ...reconstructionRelativeResiduals,
        );
        if (maximumReconstructionRelativeResidual > RECONSTRUCTION_RELATIVE_TOLERANCE) {
            throw configurationError('ER6_UNIFORM_MOON_RECONSTRUCTION_FAILED',
                'Uniform Moon radiance must reconstruct calibrated disk irradiance.', {
                    maximumReconstructionRelativeResidual,
                    tolerance: RECONSTRUCTION_RELATIVE_TOLERANCE,
                });
        }

        this.evaluation = evaluation;
        this.cameraTransform = cameraTransform;
        this.centerDirectionCamera = cameraTransform.directionCamera;
        this.angularRadiusRadians = angularRadiusRadians;
        this.sourceDepth = Object.freeze({
            kind: 'finite',
            distanceMeters: finiteBodyCenterDepthMeters,
        });
        this.depthQualification = freezeJsonValue({
            semantics: 'observer-to-finite-body-center',
            ordinaryEarthAndSceneBlockers: 'supported when materially nearer than the Moon',
            rayVaryingLunarSurfaceDepth: 'not represented by integrator-v1',
            nearMoonBlockerAndContactClaims: 'excluded',
        });
        const radianceDerivationHash = stableHash({
            kind: 'er6-lime-uniform-globe-moon-disk-radiance-derivation-v1',
            irradianceEvaluationFingerprint: evaluation.fingerprint,
            basisFingerprint: evaluation.basis.fingerprint,
            angularRadiusRadians,
            projectedDiskSolidAngleSteradians,
            formula: 'L_lambda = E_lambda / (pi * sin(alpha)^2)',
        });
        this.packet = new SpectralDensityPacket({
            quantity: SPECTRAL_RADIANCE_DENSITY,
            units: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
            basis: evaluation.basis,
            values: radianceValues,
            provenance: {
                sourceId: 'esa-lime-uniform-globe-moon-disk-radiance',
                sourceVersion: 'er6-derived-uniform-disk-v1',
                sourceHashSha256: radianceDerivationHash,
                irradianceEvaluationFingerprint: evaluation.fingerprint,
                physicalStateFingerprint: evaluation.physicalState.fingerprint,
                normalization:
                    'L_lambda = E_lambda / (pi * sin(angularRadiusRadians)^2)',
                angularRadiusRadians,
                projectedDiskSolidAngleSteradians,
                limeSourceIdentity: evaluation.provenance,
                spatialQualification:
                    'Uniform radiance is a flux-conserving transport surrogate, not a lunar texture, BRDF, limb, terrain, or resolved-radiance claim.',
            },
            uncertainty: {
                status: 'partial',
                model:
                    'record-049-accepted-lime-central-and-joint-uncertainty-owner-not-copied-into-er6-bridge',
                notes: [
                    'This packet transports the release-authoritative central prediction.',
                    'Record 049 remains the owner of accepted joint spectral/phase uncertainty.',
                    'The uniform spatial profile adds no claim about real resolved lunar radiance.',
                ],
            },
        });
        this.source = new ExternalCelestialSource({
            id: evaluation.sourceId,
            kind: EXTENDED_CELESTIAL_SOURCE,
            geometry: {
                kind: 'finite-uniform-globe-moon-disk-surrogate-v1',
                owner: 'Er6UniformGlobeMoonDiskSource',
                physicalStateFingerprint: evaluation.physicalState.fingerprint,
                irradianceEvaluationFingerprint: evaluation.fingerprint,
                directionTransformFingerprint: cameraTransform.transformFingerprint,
                directionTransformConvention: cameraTransform.matrixConvention,
                cameraDirectionFrame: cameraTransform.cameraDirectionFrame,
                sourceFrame: cameraTransform.sourceFrame,
                sourceDirectionJ2000: cameraTransform.sourceDirectionJ2000,
                j2000ToCameraRotationMatrix:
                    cameraTransform.j2000ToCameraRotationMatrix,
                centerDirectionCamera: this.centerDirectionCamera,
                finiteBodyCenterDepthMeters,
                depthSemantics: 'observer-to-finite-body-center',
                surfaceDepthQualification:
                    'TransportedExtendedSourceIntegrator v1 carries one body-center depth; ray-varying lunar-surface depth and near-Moon contact are outside this surrogate.',
                angularRadiusRadians,
                spatialProfile: 'uniform-flux-conserving-transport-surrogate',
            },
            spectralMeasure: this.packet,
        });
        this.reconstruction = freezeJsonValue({
            equation: 'E_lambda = L_lambda * pi * sin(alpha)^2',
            projectedDiskSolidAngleSteradians,
            inputSpectralIrradianceValues: irradianceValues,
            radianceValues,
            reconstructedSpectralIrradianceValues: reconstructedIrradianceValues,
            relativeResiduals: reconstructionRelativeResiduals,
            maximumRelativeResidual: maximumReconstructionRelativeResidual,
            tolerance: RECONSTRUCTION_RELATIVE_TOLERANCE,
            status: maximumReconstructionRelativeResidual
                <= RECONSTRUCTION_RELATIVE_TOLERANCE ? 'accepted' : 'rejected',
        });
        this.fingerprint = stableHash({
            kind: 'er6-uniform-globe-moon-disk-source-v1',
            sourceFingerprint: this.source.fingerprint,
            sourceDepth: this.sourceDepth,
            reconstruction: this.reconstruction,
        });
        Object.freeze(this);
    }

    /**
     * Describe the finite uniform transport surrogate and reconstruction boundary.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable adapter descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'er6-uniform-globe-moon-disk-source-v1',
            fingerprint: this.fingerprint,
            source: this.source.describe(),
            sourceDepth: this.sourceDepth,
            depthQualification: this.depthQualification,
            centerDirectionCamera: this.centerDirectionCamera,
            angularRadiusRadians: this.angularRadiusRadians,
            cameraTransform: this.cameraTransform,
            reconstruction: this.reconstruction,
            spatialQualification:
                'Uniformity is a normalized transport surrogate only; depth is exact to the finite-body center for ordinary nearer Earth/scene blockers, while ray-varying lunar-surface depth and near-Moon contacts are outside scope.',
            exclusions: Object.freeze([
                'neutral-albedo-0.12',
                'gain-or-exposure',
                'moved-direction',
                'display-values',
                'earthshine',
                'eclipses',
                'near-moon-blocker-or-contact-depth',
            ]),
        });
    }

    /**
     * Return constant top-of-atmosphere radiance at one physical disk sample.
     *
     * @param {ExtendedAngularSample} _sample - Integrator-owned physical sample.
     * @returns {readonly number[]} Uniform aligned spectral radiance density.
     */
    radianceForSample(_sample) {
        return this.packet.values;
    }
}

function validateEvaluation(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError('ER6_UNIFORM_MOON_EVALUATION_REQUIRED',
            'ER6 uniform globe-Moon disk requires a LIME irradiance evaluation.');
    }
    const irradiance = value.diskIntegratedSpectralIrradiance;
    const calibratedRuntime = value.modelEvaluation?.distanceCases?.[0]
        ?.calibratedRuntime;
    let physicalState;
    try {
        physicalState = validateEr6HorizonsPhysicalGlobeStateIntegrity(
            value.physicalState,
        );
    } catch {
        physicalState = null;
    }
    let expectedEvaluationFingerprint = null;
    try {
        expectedEvaluationFingerprint =
            createEr6LimeGlobeMoonIrradianceEvaluationFingerprint(value);
    } catch {
        expectedEvaluationFingerprint = null;
    }
    if (
        value.kind !== 'er6-lime-globe-moon-irradiance-evaluation-v1'
        || !FINGERPRINT_PATTERN.test(value.fingerprint ?? '')
        || !FINGERPRINT_PATTERN.test(value.providerFingerprint ?? '')
        || value.fingerprint !== expectedEvaluationFingerprint
        || !physicalState
        || physicalState !== value.physicalState
        || value.lunarAspect !== physicalState.lunarAspect
        || !(value.basis instanceof SpectralDensityBasis)
        || value.basis.fingerprint !== EXPECTED_CANONICAL_BASIS_FINGERPRINT
        || !(value.canonicalSolar instanceof SpectralDensityPacket)
        || value.canonicalSolar.basis !== value.basis
        || value.canonicalSolar.fingerprint !== EXPECTED_CANONICAL_SOLAR_FINGERPRINT
        || value.canonicalSolar.quantity !== SPECTRAL_IRRADIANCE_DENSITY
        || value.canonicalSolar.units !== 'W m^-2 nm^-1'
        || value.provenance?.sourceId !== EXPECTED_LIME_SOURCE.sourceId
        || value.provenance?.sourceVersion !== EXPECTED_LIME_SOURCE.sourceVersion
        || value.provenance?.sourceHashSha256
            !== EXPECTED_LIME_SOURCE.release.sourceHashSha256
        || value.provenance?.releaseHashSha256
            !== EXPECTED_LIME_SOURCE.release.sourceHashSha256
        || value.provenance?.coefficientHashSha256
            !== EXPECTED_LIME_SOURCE.coefficients.sourceHashSha256
        || value.provenance?.asdHashSha256
            !== EXPECTED_LIME_SOURCE.spectralReference.sourceHashSha256
        || value.provenance?.basisFingerprint !== value.basis.fingerprint
        || value.provenance?.canonicalSolarFingerprint
            !== value.canonicalSolar.fingerprint
        || irradiance?.quantity !== SPECTRAL_IRRADIANCE_DENSITY
        || irradiance?.units !== 'W m^-2 nm^-1'
        || irradiance?.basisFingerprint !== value.basis.fingerprint
        || !Array.isArray(irradiance?.values)
        || irradiance.values.length !== 15
        || !irradiance.values.every((entry) => Number.isFinite(entry) && entry >= 0)
        || calibratedRuntime?.units !== 'W m^-2 nm^-1'
        || !Array.isArray(calibratedRuntime?.values)
        || !sameNumberArray(calibratedRuntime.values, irradiance.values)
    ) {
        throw configurationError('ER6_UNIFORM_MOON_EVALUATION_INVALID',
            'ER6 uniform globe-Moon disk requires an untampered canonical 15-channel LIME evaluation.');
    }
    return value;
}

function validateCameraTransform(value, evaluation) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError('ER6_UNIFORM_MOON_CAMERA_TRANSFORM_REQUIRED',
            'ER6 uniform globe-Moon disk requires a physical J2000-to-camera transform.');
    }
    rejectProhibitedFields(value, 'camera transform');
    rejectUnknownFields(value, CAMERA_TRANSFORM_FIELDS, 'camera transform');
    if (
        value.kind !== 'physical-state-to-camera-transform-v1'
        || value.physicalStateFingerprint !== evaluation.physicalState.fingerprint
        || value.sourceFrame !== evaluation.geometry.frame
        || value.matrixConvention !== CAMERA_MATRIX_CONVENTION
        || value.cameraDirectionFrame !== CAMERA_DIRECTION_FRAME
    ) {
        throw configurationError('ER6_UNIFORM_MOON_CAMERA_TRANSFORM_INVALID',
            'Camera transform must identify the same physical state, source frame, and matrix convention.');
    }
    const sourceDirectionJ2000 = validateUnitDirection(
        value.sourceDirectionJ2000,
        'sourceDirectionJ2000',
    );
    const maximumSourceDirectionDifference = Math.max(...sourceDirectionJ2000.map(
        (entry, index) => Math.abs(entry - evaluation.geometry.directionJ2000[index]),
    ));
    if (maximumSourceDirectionDifference > UNIT_VECTOR_TOLERANCE) {
        throw configurationError('ER6_UNIFORM_MOON_MOVED_DIRECTION_PROHIBITED',
            'Camera transform input must equal the returned-epoch physical Moon direction.', {
                maximumSourceDirectionDifference,
                tolerance: UNIT_VECTOR_TOLERANCE,
            });
    }
    const j2000ToCameraRotationMatrix = validateRotationMatrix(
        value.j2000ToCameraRotationMatrix,
    );
    const transformCore = Object.freeze({
        kind: value.kind,
        physicalStateFingerprint: value.physicalStateFingerprint,
        sourceFrame: value.sourceFrame,
        sourceDirectionJ2000,
        j2000ToCameraRotationMatrix,
        matrixConvention: value.matrixConvention,
        cameraDirectionFrame: value.cameraDirectionFrame,
    });
    const transformFingerprint = stableHash(transformCore);
    const directionCamera = validateUnitDirection(
        j2000ToCameraRotationMatrix.map((row) => dot(row, sourceDirectionJ2000)),
        'derived directionCamera',
    );
    return Object.freeze({
        ...transformCore,
        directionCamera,
        transformFingerprint,
    });
}

function validateRotationMatrix(value) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every((row) =>
            Array.isArray(row) && row.length === 3 && row.every(Number.isFinite))
    ) {
        throw configurationError('ER6_UNIFORM_MOON_CAMERA_MATRIX_INVALID',
            'J2000-to-camera rotation matrix must be a finite row-major 3-by-3 matrix.');
    }
    const matrix = Object.freeze(value.map((row) => Object.freeze([...row])));
    const maximumRowNormResidual = Math.max(...matrix.map((row) =>
        Math.abs(Math.hypot(...row) - 1)));
    const maximumOrthogonalityResidual = Math.max(
        Math.abs(dot(matrix[0], matrix[1])),
        Math.abs(dot(matrix[0], matrix[2])),
        Math.abs(dot(matrix[1], matrix[2])),
    );
    const determinantResidual = Math.abs(determinant3(matrix) - 1);
    if (
        maximumRowNormResidual > UNIT_VECTOR_TOLERANCE
        || maximumOrthogonalityResidual > UNIT_VECTOR_TOLERANCE
        || determinantResidual > UNIT_VECTOR_TOLERANCE
    ) {
        throw configurationError('ER6_UNIFORM_MOON_CAMERA_MATRIX_NOT_ROTATION',
            'J2000-to-camera matrix must be a proper orthonormal rotation.', {
                maximumRowNormResidual,
                maximumOrthogonalityResidual,
                determinantResidual,
                tolerance: UNIT_VECTOR_TOLERANCE,
            });
    }
    return matrix;
}

function validateUnitDirection(value, label) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw configurationError('ER6_UNIFORM_MOON_DIRECTION_INVALID',
            'ER6 uniform globe-Moon directions must be finite three-vectors.', { label });
    }
    const length = Math.hypot(...value);
    if (Math.abs(length - 1) > UNIT_VECTOR_TOLERANCE) {
        throw configurationError('ER6_UNIFORM_MOON_DIRECTION_NOT_UNIT',
            'ER6 uniform globe-Moon directions must be unit length.', {
                label,
                length,
            });
    }
    return Object.freeze([...value]);
}

function dot(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function sameNumberArray(left, right) {
    return left.length === right.length
        && left.every((value, index) => Object.is(value, right[index]));
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

function rejectProhibitedFields(value, context) {
    const prohibited = [
        'albedo',
        'displayRgb',
        'displayRgba',
        'earthshine',
        'eclipse',
        'exposure',
        'gain',
        'directionCamera',
        'moonDirectionOverride',
        'neutralAlbedo',
        'sceneRgb',
        'sourceGain',
        'sourceDirectionOverride',
    ].filter((field) => Object.hasOwn(value, field));
    if (prohibited.length > 0) {
        throw configurationError('ER6_UNIFORM_MOON_FIELD_PROHIBITED',
            'ER6 uniform globe-Moon disk prohibits presentation, gain, neutral-albedo, and unsupported illumination fields.', {
                context,
                fields: prohibited,
            });
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_UNIFORM_MOON_FIELD_UNSUPPORTED',
            'ER6 uniform globe-Moon disk received unsupported fields.', {
                context,
                fields: unknown,
            });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
