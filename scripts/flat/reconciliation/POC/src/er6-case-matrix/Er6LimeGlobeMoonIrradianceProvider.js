// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   accepted release-authoritative LIME and canonical-Sun transfer policy.
// - tmp/atmosphere/reconciliation/049-er5-lunar-physical-reference-calibration,
//   accepted disk-integrated source-reference scope.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import LimeCoefficientModel from '../external-celestial-sources/LimeCoefficientModel.js';
import SpectralDensityBasis from '../external-celestial-sources/SpectralDensityBasis.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    createCanonicalSolarIrradianceDensity,
} from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import {
    createCanonicalSpectralDensityBasis,
} from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import {
    SPECTRAL_IRRADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import {
    EXTERNAL_CELESTIAL_FIXTURE_MANIFEST,
} from '../external-celestial-sources/fixtureManifest.js';
import {
    validateCelestialWorldState,
    validateObserverState,
} from '../globe-moon/GlobeMoonStateResolver.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    validateEr6HorizonsPhysicalGlobeStateIntegrity,
} from './Er6HorizonsPhysicalGlobeStateProvider.js';

const ASTRONOMICAL_UNIT_KILOMETERS = 149597870.7;
const EXPECTED_CANONICAL_BASIS = createCanonicalSpectralDensityBasis();
const EXPECTED_CANONICAL_SOLAR = createCanonicalSolarIrradianceDensity(
    EXPECTED_CANONICAL_BASIS,
);
const REQUEST_FIELDS = Object.freeze([
    'physicalState',
]);

export default class Er6LimeGlobeMoonIrradianceProvider {
    /**
     * Create a physical globe-Moon irradiance bridge over the accepted LIME owner.
     *
     * @param {Er6LimeGlobeMoonIrradianceProviderConfiguration} configuration - Accepted model and canonical source identity.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER6_LIME_PROVIDER_CONFIGURATION_REQUIRED',
                'ER6 LIME globe-Moon provider configuration is required.');
        }
        rejectUnknownFields(configuration, ['model', 'sourceId'], 'provider configuration');
        if (!(configuration.model instanceof LimeCoefficientModel)) {
            throw configurationError('ER6_LIME_PROVIDER_MODEL_REQUIRED',
                'ER6 LIME globe-Moon provider requires the accepted LimeCoefficientModel.');
        }
        this.sourceId = requireIdentifier(configuration.sourceId, 'sourceId');
        this.model = configuration.model;
        if (
            !(this.model.basis instanceof SpectralDensityBasis)
            || !(this.model.canonicalSolar instanceof SpectralDensityPacket)
            || this.model.canonicalSolar.basis !== this.model.basis
            || this.model.basis.fingerprint !== EXPECTED_CANONICAL_BASIS.fingerprint
            || this.model.canonicalSolar.fingerprint !== EXPECTED_CANONICAL_SOLAR.fingerprint
            || this.model.canonicalSolar.quantity !== SPECTRAL_IRRADIANCE_DENSITY
            || this.model.canonicalSolar.units !== 'W m^-2 nm^-1'
        ) {
            throw configurationError('ER6_LIME_PROVIDER_CANONICAL_SUN_INVALID',
                'LIME model must retain one aligned canonical solar irradiance owner.');
        }
        this.modelPolicy = this.model.describeExecutablePolicy();
        this.sourceProvenance = buildSourceProvenance(this.model);
        this._descriptor = freezeJsonValue({
            kind: 'er6-lime-globe-moon-irradiance-provider-v1',
            sourceId: this.sourceId,
            modelPolicy: this.modelPolicy,
            basisFingerprint: this.model.basis.fingerprint,
            canonicalSolarFingerprint: this.model.canonicalSolar.fingerprint,
            sourceProvenance: this.sourceProvenance,
            astronomicalUnitKilometers: ASTRONOMICAL_UNIT_KILOMETERS,
            outputQuantity: SPECTRAL_IRRADIANCE_DENSITY,
            outputUnits: 'W m^-2 nm^-1',
            centralOutput: 'LimeCoefficientModel distanceCases.calibratedRuntime',
            geometryPolicy: Object.freeze({
                signedPhase: 'provider-owned MOON_ME physical aspect',
                subobserverCoordinates:
                    'provider-owned MOON_ME physical aspect; longitude wrapped to signed degrees for LIME',
                subsolarLongitude:
                    'provider-owned MOON_ME physical aspect wrapped to signed radians for LIME',
                subsolarLatitude:
                    'retained for provenance but not consumed by the LIME v1.4.1 equation',
                observerMoonDistance: 'computed from returned-epoch vectors',
                sunMoonDistance: 'computed from returned-epoch vectors and exact AU conversion',
            }),
            exclusions: Object.freeze([
                'neutral-albedo-0.12',
                'source-gain-or-exposure',
                'moved-or-overridden-direction',
                'display-values',
                'earthshine',
                'eclipse-model',
                'resolved-texture-or-brdf',
            ]),
        });
        this.fingerprint = stableHash(this._descriptor);
        Object.freeze(this);
    }

    /**
     * Describe the accepted LIME central branch and canonical ownership.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable provider descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Evaluate one returned-epoch physical state inside the accepted LIME phase domain.
     *
     * @param {Er6LimeGlobeMoonIrradianceRequest} request - Provider-owned physical state.
     * @returns {Er6LimeGlobeMoonIrradianceEvaluation} Disk-integrated lunar irradiance.
     */
    evaluate(request) {
        if (!request || typeof request !== 'object' || Array.isArray(request)) {
            throw configurationError('ER6_LIME_PROVIDER_REQUEST_REQUIRED',
                'ER6 LIME globe-Moon evaluation requires a request object.');
        }
        rejectProhibitedFields(request, 'evaluation request');
        rejectUnknownFields(request, REQUEST_FIELDS, 'evaluation request');
        const physicalState = validateEr6HorizonsPhysicalGlobeStateIntegrity(
            request.physicalState,
        );
        const worldState = validateCelestialWorldState(physicalState.worldState);
        const observerState = validateObserverState(physicalState.observerState);
        const lunarAspect = physicalState.lunarAspect;
        const signedPhaseDegrees = lunarAspect.signedPhaseDegrees;
        const absolutePhaseDegrees = lunarAspect.absolutePhaseDegrees;
        if (
            Math.abs(signedPhaseDegrees) > 90
            || absolutePhaseDegrees < 0
            || absolutePhaseDegrees > 90
            || Math.abs(Math.abs(signedPhaseDegrees) - absolutePhaseDegrees) > 1e-12
        ) {
            throw configurationError('ER6_LIME_PROVIDER_PHASE_OUTSIDE_DOMAIN',
                'Physical lunar phase is outside the accepted LIME absolute-phase domain.', {
                    signedPhaseDegrees,
                    absolutePhaseDegrees,
                });
        }

        const observerToMoonKilometers = subtract(
            worldState.moon.positionKm,
            observerState.positionKm,
        );
        const observerMoonDistanceKilometers = magnitude(observerToMoonKilometers);
        const sunMoonDistanceKilometers = magnitude(subtract(
            worldState.sun.positionKm,
            worldState.moon.positionKm,
        ));
        if (
            !Number.isFinite(observerMoonDistanceKilometers)
            || !Number.isFinite(sunMoonDistanceKilometers)
            || !(observerMoonDistanceKilometers > worldState.moon.radiusKm)
            || !(sunMoonDistanceKilometers > 0)
        ) {
            throw configurationError('ER6_LIME_PROVIDER_DISTANCE_INVALID',
                'Returned-epoch Moon distances must be finite, positive, and outside the body.');
        }
        const sunMoonDistanceAstronomicalUnits = sunMoonDistanceKilometers
            / ASTRONOMICAL_UNIT_KILOMETERS;
        const finiteBodyCenterDepthMeters = observerMoonDistanceKilometers * 1000;
        if (
            !Number.isFinite(sunMoonDistanceAstronomicalUnits)
            || !(sunMoonDistanceAstronomicalUnits > 0)
            || !Number.isFinite(finiteBodyCenterDepthMeters)
            || !(finiteBodyCenterDepthMeters > 0)
        ) {
            throw configurationError('ER6_LIME_PROVIDER_DISTANCE_CONVERSION_INVALID',
                'Returned-epoch lunar distances must convert to finite positive AU and meter values.');
        }
        const directionJ2000 = Object.freeze(observerToMoonKilometers.map((value) =>
            value / observerMoonDistanceKilometers));
        const angularRadiusRadians = Math.asin(
            worldState.moon.radiusKm / observerMoonDistanceKilometers,
        );
        const distanceCase = Object.freeze({
            id: `${physicalState.fingerprint}-returned-epoch-distances`,
            sunMoonDistanceAstronomicalUnits,
            observerMoonDistanceKilometers,
        });
        const limeSubobserverLongitudeDegrees = wrapSignedDegrees(
            lunarAspect.subobserverLongitudeDegrees,
        );
        const limeSubsolarLongitudeDegrees = wrapSignedDegrees(
            lunarAspect.subsolarLongitudeDegrees,
        );
        const modelRequest = Object.freeze({
            id: `${this.sourceId}-${physicalState.fingerprint}`,
            signedPhaseDegrees,
            geometry: Object.freeze({
                absolutePhaseDegrees,
                sunSelenographicLongitudeRadians:
                    limeSubsolarLongitudeDegrees * Math.PI / 180,
                observerSelenographicLatitudeDegrees:
                    lunarAspect.subobserverLatitudeDegrees,
                observerSelenographicLongitudeDegrees:
                    limeSubobserverLongitudeDegrees,
            }),
            distanceCases: Object.freeze([distanceCase]),
        });
        let modelEvaluation;
        try {
            modelEvaluation = this.model.evaluate(modelRequest);
        } catch (error) {
            throw configurationError('ER6_LIME_PROVIDER_MODEL_EVALUATION_FAILED',
                'Accepted LIME model failed the returned-epoch physical request.', {
                    cause: error instanceof Error ? error.message : String(error),
                });
        }
        const distanceEvaluation = modelEvaluation.distanceCases[0];
        if (
            distanceEvaluation?.id !== distanceCase.id
            || distanceEvaluation.calibratedRuntime?.units !== 'W m^-2 nm^-1'
            || !Array.isArray(distanceEvaluation.calibratedRuntime.values)
            || distanceEvaluation.calibratedRuntime.values.length
                !== this.model.basis.channels.length
            || !distanceEvaluation.calibratedRuntime.values.every((value) =>
                Number.isFinite(value) && value >= 0)
        ) {
            throw configurationError('ER6_LIME_PROVIDER_CALIBRATED_RUNTIME_INVALID',
                'LIME calibratedRuntime output must be a finite canonical irradiance spectrum.');
        }
        const values = Object.freeze([...distanceEvaluation.calibratedRuntime.values]);
        const diskIntegratedSpectralIrradiance = Object.freeze({
            quantity: SPECTRAL_IRRADIANCE_DENSITY,
            units: 'W m^-2 nm^-1',
            basisFingerprint: this.model.basis.fingerprint,
            values,
            calibration:
                'release-authoritative LIME central prediction transferred through the retained canonical Sun owner',
            uncertaintyStatus:
                'central-only; record 049 owns accepted joint uncertainty and this bridge does not copy its outputs',
        });
        const geometry = Object.freeze({
            epochIso: worldState.epochIso,
            frame: worldState.frame,
            directionJ2000,
            finiteBodyCenterDepthMeters,
            angularRadiusRadians,
            signedPhaseDegrees,
            absolutePhaseDegrees,
            subobserverLongitudeDegrees: lunarAspect.subobserverLongitudeDegrees,
            subobserverLatitudeDegrees: lunarAspect.subobserverLatitudeDegrees,
            subsolarLongitudeDegrees: lunarAspect.subsolarLongitudeDegrees,
            subsolarLatitudeDegrees: lunarAspect.subsolarLatitudeDegrees,
            limeSubobserverLongitudeDegrees,
            limeSubsolarLongitudeDegrees,
            limeLongitudeNormalization: 'signed-longitude-in-minus-180-to-180-degrees',
            subsolarLatitudeDisposition:
                'retained-but-not-consumed-by-lime-v1.4.1-equation',
            observerMoonDistanceKilometers,
            sunMoonDistanceKilometers,
            sunMoonDistanceAstronomicalUnits,
        });
        const evaluationCore = Object.freeze({
            kind: 'er6-lime-globe-moon-irradiance-evaluation-v1',
            providerFingerprint: this.fingerprint,
            sourceId: this.sourceId,
            physicalState,
            lunarAspect,
            basis: this.model.basis,
            canonicalSolar: this.model.canonicalSolar,
            geometry,
            modelRequest,
            modelEvaluation,
            diskIntegratedSpectralIrradiance,
            provenance: this.sourceProvenance,
            ownership: Object.freeze({
                limeModel: 'existing LimeCoefficientModel instance',
                coefficientsAndAsd: 'existing LimeCalibrationFixtures instance',
                canonicalSolar: 'same SpectralDensityPacket object held by LimeCoefficientModel',
                physicalState: 'same Er6HorizonsPhysicalGlobeState object',
                lunarAspect: 'same provider-owned lunarAspect object',
            }),
            qualifications: Object.freeze({
                quantity: 'disk-integrated spectral irradiance density only',
                spatialRadiance: 'not supplied by LIME; requires a separately labeled normalized surrogate',
                subsolarLatitude:
                    'retained for physical provenance but absent from the accepted LIME equation',
                earthshine: 'excluded',
                eclipses: 'excluded',
            }),
        });
        return Object.freeze({
            ...evaluationCore,
            fingerprint: createEr6LimeGlobeMoonIrradianceEvaluationFingerprint(
                evaluationCore,
            ),
        });
    }
}

/**
 * Reconstruct the reset-only LIME evaluation fingerprint at the consumer seam.
 *
 * @param {Er6LimeGlobeMoonIrradianceEvaluation | Omit<Er6LimeGlobeMoonIrradianceEvaluation, 'fingerprint'>} value - Evaluation or evaluation core.
 * @returns {string} Stable SHA-256 fingerprint.
 */
export function createEr6LimeGlobeMoonIrradianceEvaluationFingerprint(value) {
    return stableHash({
        kind: value.kind,
        providerFingerprint: value.providerFingerprint,
        physicalStateFingerprint: value.physicalState?.fingerprint,
        lunarAspectFingerprint: value.lunarAspect?.fingerprint,
        sourceId: value.sourceId,
        basisFingerprint: value.basis?.fingerprint,
        canonicalSolarFingerprint: value.canonicalSolar?.fingerprint,
        geometry: value.geometry,
        modelRequest: value.modelRequest,
        diskIntegratedSpectralIrradiance: value.diskIntegratedSpectralIrradiance,
        provenance: value.provenance,
        canonicalSolarCalibrationMaximumReconstructionRelativeResidual:
            value.modelEvaluation?.canonicalSolarCalibration
                ?.maximumReconstructionRelativeResidual,
    });
}

function buildSourceProvenance(model) {
    const release = model.fixtures?.provenance?.release;
    const coefficient = model.fixtures?.provenance?.coefficient;
    const asd = model.fixtures?.provenance?.asd;
    const expected = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate;
    if (
        release?.sourceHashSha256 !== expected.release.sourceHashSha256
        || coefficient?.sourceHashSha256 !== expected.coefficients.sourceHashSha256
        || asd?.sourceHashSha256 !== expected.spectralReference.sourceHashSha256
    ) {
        throw configurationError('ER6_LIME_PROVIDER_FIXTURE_PROVENANCE_INVALID',
            'Accepted LIME model must retain the pinned release, coefficient, and ASD hashes.', {
                expected: Object.freeze({
                    release: expected.release.sourceHashSha256,
                    coefficient: expected.coefficients.sourceHashSha256,
                    asd: expected.spectralReference.sourceHashSha256,
                }),
                actual: Object.freeze({
                    release: release?.sourceHashSha256 ?? null,
                    coefficient: coefficient?.sourceHashSha256 ?? null,
                    asd: asd?.sourceHashSha256 ?? null,
                }),
            });
    }
    return freezeJsonValue({
        sourceId: 'esa-lime-lunar-reflectance-model',
        sourceVersion: expected.sourceVersion,
        sourceHashSha256: release.sourceHashSha256,
        executableModelIdentity: model.describeExecutablePolicy().modelIdentity,
        releaseHashSha256: release.sourceHashSha256,
        coefficientHashSha256: coefficient.sourceHashSha256,
        asdHashSha256: asd.sourceHashSha256,
        canonicalSolarFingerprint: model.canonicalSolar.fingerprint,
        basisFingerprint: model.basis.fingerprint,
    });
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
        'moonDirectionOverride',
        'neutralAlbedo',
        'sceneRgb',
        'sourceGain',
    ].filter((field) => Object.hasOwn(value, field));
    if (prohibited.length > 0) {
        throw configurationError('ER6_LIME_PROVIDER_FIELD_PROHIBITED',
            'ER6 LIME source bridge prohibits presentation, gain, neutral-albedo, and unsupported illumination fields.', {
                context,
                fields: prohibited,
            });
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_LIME_PROVIDER_FIELD_UNSUPPORTED',
            'ER6 LIME source bridge received unsupported fields.', {
                context,
                fields: unknown,
            });
    }
}

function requireIdentifier(value, context) {
    if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
        throw configurationError('ER6_LIME_PROVIDER_ID_INVALID',
            'ER6 LIME source id must be non-empty without outer whitespace.', {
                context,
                value,
            });
    }
    return value;
}

function subtract(left, right) {
    return left.map((value, index) => value - right[index]);
}

function magnitude(value) {
    return Math.hypot(...value);
}

function wrapSignedDegrees(value) {
    const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
    return Object.is(wrapped, -0) ? 0 : wrapped;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
