// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   ER6 typed Sun/Moon/Sirius transport in the bounded Flat32 globe scene.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   exact returned-epoch eight-case physical scene validation.

import CanonicalAtmosphere from '../atmosphere/CanonicalAtmosphere.js';
import SpectralCalculator from '../calculator/SpectralCalculator.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
} from '../constants/consts.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import SpectralReferenceEvaluator from '../evaluation/SpectralReferenceEvaluator.js';
import ExternalCelestialSource from
    '../external-celestial-sources/ExternalCelestialSource.js';
import SpectralDensityPacket from
    '../external-celestial-sources/SpectralDensityPacket.js';
import { createCanonicalSolarIrradianceDensity } from
    '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from
    '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import CanonicalUniformSunDiskSource from
    '../extended-source-integration/CanonicalUniformSunDiskSource.js';
import TransportedExtendedSourceIntegrator from
    '../extended-source-integration/TransportedExtendedSourceIntegrator.js';
import SphericalEarthGeometry from '../geometry/SphericalEarthGeometry.js';
import CanonicalSolarIlluminationSource from
    '../light/CanonicalSolarIlluminationSource.js';
import FrozenAtmosphereSpectralFrameEvaluator from
    '../physical-frame/FrozenAtmosphereSpectralFrameEvaluator.js';
import PhysicalSpectralFrameComposer from
    '../physical-frame/PhysicalSpectralFrameComposer.js';
import BilinearPointResponse from '../point-source-raster/BilinearPointResponse.js';
import TransportedPointSourceAccumulator from
    '../point-source-raster/TransportedPointSourceAccumulator.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import GlobeEphemerisSceneAdapter from
    '../subjective-scenes/GlobeEphemerisSceneAdapter.js';
import Er6CalspecSiriusCatalogPointSource from
    './Er6CalspecSiriusCatalogPointSource.js';
import Er6Flat32PhysicalSceneGeometry from
    './Er6Flat32PhysicalSceneGeometry.js';
import Er6GlobeCaseMatrixResolver from './Er6GlobeCaseMatrixResolver.js';
import Er6LimeGlobeMoonIrradianceProvider from
    './Er6LimeGlobeMoonIrradianceProvider.js';
import Er6UniformGlobeMoonDiskSource from
    './Er6UniformGlobeMoonDiskSource.js';
import { validateEr6HorizonsPhysicalGlobeStateIntegrity } from
    './Er6HorizonsPhysicalGlobeStateProvider.js';
import createEr6PhysicalSourceIdentities from
    './createEr6PhysicalSourceIdentities.js';
import { ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY } from
    './er6Flat32DiagnosticSourcePolicyConsts.js';
import { ER6_FLAT32_SCENE_GEOMETRY_FACTS } from
    './er6Flat32PhysicalSceneGeometryConsts.js';

const CONFIGURATION_FIELDS = Object.freeze([
    'camera',
    'canonicalSolarIrradiance',
    'calspecSiriusIrradiance',
    'lunarIrradianceProvider',
    'displayModel',
    'atmosphereControls',
    'extendedQuadrature',
    'depthTieToleranceMeters',
]);
const REQUEST_FIELDS = Object.freeze([
    'caseAttachment',
    'outputMode',
    'presentationOverrides',
]);
const OUTPUT_MODES = Object.freeze(new Set(['full-evidence', 'compact-review']));
const PRESENTATION_OVERRIDE_FIELDS = Object.freeze([
    'id',
    'astronomicalPosition',
    'moonDirectionCamera',
    'siriusDirectionCamera',
]);
const ATMOSPHERE_CONTROL_FIELDS = Object.freeze([
    'pathIntervalCount',
    'sourceTransmittanceIntervalCount',
    'incidentDirectionCount',
    'incidentAltitudeBinCount',
]);
const QUADRATURE_FIELDS = Object.freeze(['sun', 'moon']);
const SOURCE_QUADRATURE_FIELDS = Object.freeze(['radialCount', 'azimuthCount']);
const EXPECTED_BASIS = createCanonicalSpectralDensityBasis();
const EXPECTED_SOLAR = createCanonicalSolarIrradianceDensity(EXPECTED_BASIS);
const SOURCE_FRAME = 'earth-centered-ecliptic-j2000';
const GEOMETRY_TOLERANCE = 1e-10;
const RELATIVE_NUMERICAL_TOLERANCE = 1e-12;

export default class Er6PhysicalGlobeSceneRenderer {
    /**
     * Create the reset-owned ER6 physical scene renderer.
     *
     * @param {Readonly<Record<string, unknown>>} configuration - Camera, canonical sources, frozen atmosphere controls, quadrature, and sole display owner.
     */
    constructor(configuration) {
        requirePlainObject(configuration, 'ER6_RENDERER_CONFIGURATION_REQUIRED',
            'ER6 physical globe scene renderer configuration is required.');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'renderer configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER6_RENDERER_CAMERA_INVALID',
                'ER6 renderer requires a PerspectiveCameraRaster.');
        }
        const canonicalSolarIrradiance = validateCanonicalSolar(
            configuration.canonicalSolarIrradiance,
        );
        const calspecSiriusIrradiance = validateCalspecPacket(
            configuration.calspecSiriusIrradiance,
        );
        if (!(configuration.lunarIrradianceProvider
            instanceof Er6LimeGlobeMoonIrradianceProvider)) {
            throw configurationError('ER6_RENDERER_LUNAR_PROVIDER_INVALID',
                'ER6 renderer requires an Er6LimeGlobeMoonIrradianceProvider.');
        }
        if (configuration.lunarIrradianceProvider.model.canonicalSolar
            !== canonicalSolarIrradiance
            || configuration.lunarIrradianceProvider.model.basis
                !== canonicalSolarIrradiance.basis
            || calspecSiriusIrradiance.basis !== canonicalSolarIrradiance.basis
            || configuration.lunarIrradianceProvider.sourceId
                !== EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate.sourceId) {
            throw configurationError('ER6_RENDERER_LUNAR_CANONICAL_SUN_IDENTITY_MISMATCH',
                'ER6 LIME, Sirius, atmosphere, and visible-Sun paths must retain one canonical basis and solar packet by object identity.');
        }
        validateDisplayModel(configuration.displayModel);

        this.camera = configuration.camera;
        this.canonicalSolarIrradiance = canonicalSolarIrradiance;
        this.calspecSiriusIrradiance = calspecSiriusIrradiance;
        this.lunarIrradianceProvider = configuration.lunarIrradianceProvider;
        this.displayModel = configuration.displayModel;
        this.atmosphereControls = validateAtmosphereControls(
            configuration.atmosphereControls,
        );
        this.extendedQuadrature = validateExtendedQuadrature(
            configuration.extendedQuadrature,
        );
        this.depthTieToleranceMeters = requireNonnegativeFinite(
            configuration.depthTieToleranceMeters,
            'depthTieToleranceMeters',
        );
        this.sourceIdentitySet = createEr6PhysicalSourceIdentities();
        this.caseMatrixResolver = new Er6GlobeCaseMatrixResolver();
        this.queryOrder = this.caseMatrixResolver.describe()
            .ephemerisAttachmentContract.queryOrder;
        this.canonicalCaseMatrix = this.caseMatrixResolver.resolveCaseMatrix({
            sourceIdentities: this.sourceIdentitySet.identities,
        });
        this._descriptor = freezeJsonValue({
            kind: 'er6-physical-globe-scene-renderer-v1',
            camera: this.camera.describe(),
            canonicalSolar: this.canonicalSolarIrradiance.describe(),
            calspecSirius: this.calspecSiriusIrradiance.describe(),
            lunarProvider: this.lunarIrradianceProvider.describe(),
            sourceIdentities: this.sourceIdentitySet,
            caseMatrixResolver: this.caseMatrixResolver.describe(),
            canonicalCaseMatrixFingerprint: this.canonicalCaseMatrix.fingerprint,
            atmosphereControls: this.atmosphereControls,
            extendedQuadrature: this.extendedQuadrature,
            depthTieToleranceMeters: this.depthTieToleranceMeters,
            observerHeightMeters: sceneObserverHeightMeters(),
            observerUpDirectionAtmosphere: Object.freeze([1, 0, 0]),
            baseEndpointPolicy:
                'geometry-only finite depth with absent zero physical spectral endpoint',
            syntheticSourcePolicy: ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY,
            physicalOrder: Object.freeze([
                'validate exact returned-epoch attachment',
                'build reset-owned camera, ground, review-box, and Moon geometry',
                'evaluate frozen atmosphere at each base/source direction',
                'integrate canonical Sun and LIME Moon directionally',
                'transport fixed-catalog CALSPEC Sirius at its exact direction',
                'compose complete spectral frame',
                'apply one shared display conversion per pixel',
            ]),
        });
        this.fingerprint = stableHash(this._descriptor);
        Object.freeze(this);
    }

    /**
     * Describe the complete ER6 physical-rendering boundary.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable renderer descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Render one exact returned-epoch Flat32 globe case without retargeting or tuning.
     *
     * @param {Readonly<Record<string, unknown>>} request - Resolver-owned case attachment.
     * @returns {Readonly<Record<string, unknown>>} Physical source, depth, frame, and status evidence.
     */
    renderCase(request) {
        requirePlainObject(request, 'ER6_RENDERER_REQUEST_REQUIRED',
            'ER6 physical scene rendering requires a request object.');
        rejectUnknownFields(request, REQUEST_FIELDS, 'render request');
        const outputMode = request.outputMode ?? 'full-evidence';
        if (!OUTPUT_MODES.has(outputMode)) {
            throw configurationError('ER6_RENDERER_OUTPUT_MODE_INVALID',
                `ER6 renderer outputMode must be one of ${[...OUTPUT_MODES].join(', ')}.`, {
                    outputMode,
                });
        }
        const presentationOverrides = validatePresentationOverrides(
            request.presentationOverrides,
        );
        const attachment = validateAttachment(
            request.caseAttachment,
            this.canonicalCaseMatrix,
            this.queryOrder,
        );
        const physicalState = validateEr6HorizonsPhysicalGlobeStateIntegrity(
            attachment.ephemerisState,
        );
        const sceneGeometry = new Er6Flat32PhysicalSceneGeometry({
            observerBasis: attachment.sceneGeometry.basis,
            depthTieToleranceMeters: this.depthTieToleranceMeters,
        });
        const transformDescriptor = sceneGeometry.describe().transforms;
        const sunGeometry = resolveSunGeometry(
            physicalState,
            attachment.sceneGeometry,
            sceneGeometry,
        );
        const lunarEvaluation = this.lunarIrradianceProvider.evaluate({
            physicalState,
        });
        const moonTransform = sceneGeometry.createPhysicalStateCameraTransform({
            physicalStateFingerprint: physicalState.fingerprint,
            sourceFrame: lunarEvaluation.geometry.frame,
            sourceDirectionJ2000: lunarEvaluation.geometry.directionJ2000,
        });
        const physicalMoon = new Er6UniformGlobeMoonDiskSource({
            evaluation: lunarEvaluation,
            cameraTransform: moonTransform,
        });
        const moonDirectionResidual = maximumAbsoluteDifference(
            sceneGeometry.cameraDirectionToAtmosphere(
                physicalMoon.centerDirectionCamera,
            ),
            attachment.sceneGeometry.moon.directionModel,
        );
        const moonDistanceResidualKilometers = Math.abs(
            lunarEvaluation.geometry.observerMoonDistanceKilometers
                - attachment.sceneGeometry.moon.distanceKm,
        );
        const moonAngularRadiusResidualRadians = Math.abs(
            lunarEvaluation.geometry.angularRadiusRadians
                - attachment.sceneGeometry.moon.angularRadiusRadians,
        );
        const moonRadiusDerivedAngularRadiusRadians = Math.asin(
            physicalState.worldState.moon.radiusKm
                / lunarEvaluation.geometry.observerMoonDistanceKilometers,
        );
        const moonRadiusDerivationResidualRadians = Math.abs(
            moonRadiusDerivedAngularRadiusRadians
                - lunarEvaluation.geometry.angularRadiusRadians,
        );
        if (
            moonDirectionResidual > GEOMETRY_TOLERANCE
            || moonDistanceResidualKilometers > 1e-9
            || moonAngularRadiusResidualRadians > GEOMETRY_TOLERANCE
            || moonRadiusDerivationResidualRadians > GEOMETRY_TOLERANCE
        ) {
            throw configurationError('ER6_RENDERER_MOON_DIRECTION_MISMATCH',
                'Moon J2000, observer-local, distance, radius, and angular-support routes disagree.', {
                    moonDirectionResidual,
                    moonDistanceResidualKilometers,
                    moonAngularRadiusResidualRadians,
                    moonRadiusDerivationResidualRadians,
                    tolerance: GEOMETRY_TOLERANCE,
                });
        }
        const moon = presentationOverrides
            ? createControlledMoonPresentationSource(
                physicalMoon,
                presentationOverrides,
            )
            : physicalMoon;

        const moonBlockerRequest = Object.freeze({
            sourceId: moon.source.id,
            centerDirectionCamera: moon.centerDirectionCamera,
            finiteBodyCenterDepthMeters:
                lunarEvaluation.geometry.finiteBodyCenterDepthMeters,
            angularRadiusRadians: lunarEvaluation.geometry.angularRadiusRadians,
        });
        const blockerDescriptors = Object.freeze(
            sceneGeometry.createDirectionalBlockers(moonBlockerRequest)
                .map((blocker) => Object.freeze({
                    id: blocker.id,
                    kind: blocker.kind,
                    fingerprint: blocker.fingerprint,
                })),
        );
        const visibilityResolver = sceneGeometry.createDirectionalVisibilityResolver(
            moonBlockerRequest,
        );
        const atmosphereModel = createAtmosphereModel({
            canonicalSolar: this.canonicalSolarIrradiance,
            sunDirectionAtmosphere: sunGeometry.directionAtmosphere,
            sunAngularRadiusRadians: sunGeometry.angularRadiusRadians,
            controls: this.atmosphereControls,
        });
        const frameEvaluator = new FrozenAtmosphereSpectralFrameEvaluator({
            camera: this.camera,
            evaluator: atmosphereModel.evaluator,
            basisFingerprint: this.canonicalSolarIrradiance.basis.fingerprint,
            cameraToAtmosphereMatrix:
                transformDescriptor.cameraToAtmosphereRotationMatrix,
            evaluatorDescriptor: atmosphereModel.descriptor,
        });
        const baseFrame = evaluateBaseFrame({
            camera: this.camera,
            frameEvaluator,
            sceneGeometry,
        });

        const sun = new CanonicalUniformSunDiskSource({
            id: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar.sourceId,
            irradiancePacket: this.canonicalSolarIrradiance,
            angularRadiusRadians: sunGeometry.angularRadiusRadians,
            centerDirectionCamera: sunGeometry.directionCamera,
        });
        const extendedIntegrator = new TransportedExtendedSourceIntegrator({
            camera: this.camera,
            visibilityResolver,
            transmittanceSampler: frameEvaluator,
        });
        const sunIntegration = extendedIntegrator.integrate({
            source: sun,
            sourceDepth: Object.freeze({ kind: 'infinite' }),
            ...this.extendedQuadrature.sun,
        });
        const moonIntegration = extendedIntegrator.integrate({
            source: moon,
            sourceDepth: moon.sourceDepth,
            ...this.extendedQuadrature.moon,
        });

        const sirius = new Er6CalspecSiriusCatalogPointSource({
            calspecPacket: this.calspecSiriusIrradiance,
            j2000ToCameraRotationMatrix:
                transformDescriptor.j2000ToCameraRotationMatrix,
        });
        const siriusDirectionCamera = presentationOverrides
            ? presentationOverrides.siriusDirectionCamera
            : sirius.directionCamera;
        const siriusAccumulation = new TransportedPointSourceAccumulator({
            camera: this.camera,
            response: new BilinearPointResponse(),
            visibilityResolver,
            transmittanceSampler: frameEvaluator,
        }).accumulate({
            source: sirius.source,
            sourceDirectionCamera: siriusDirectionCamera,
            sourceDepth: sirius.sourceDepth,
        });

        const composition = new PhysicalSpectralFrameComposer({
            camera: this.camera,
            displayModel: this.displayModel,
        }).compose({
            basisFingerprint: this.canonicalSolarIrradiance.basis.fingerprint,
            basePixels: baseFrame.basePixels,
            extendedIntegrations: Object.freeze([
                sunIntegration,
                moonIntegration,
            ]),
            pointAccumulations: Object.freeze([siriusAccumulation]),
        });
        const sourceIds = Object.freeze({
            sun: sun.source.id,
            moon: moon.source.id,
            sirius: sirius.source.id,
        });
        validateRenderedSourceIds(sourceIds, this.sourceIdentitySet);
        const geometryDepthEvidence = createGeometryDepthEvidence({
            attachment,
            sceneGeometryDescriptor: sceneGeometry.describe(),
            blockerDescriptors,
            baseFrame,
            sunGeometry,
            moon,
            moonDirectionResidual,
            moonDistanceResidualKilometers,
            moonAngularRadiusResidualRadians,
            moonRadiusDerivationResidualRadians,
            sunIntegration,
            moonIntegration,
            siriusAccumulation,
        });
        const status = createCaseStatus({
            camera: this.camera,
            composition,
            baseFrame,
            sun,
            moon,
            siriusAccumulation,
            sunIntegration,
            moonIntegration,
            atmosphereModel,
            canonicalSolar: this.canonicalSolarIrradiance,
            geometryDepthEvidence,
        });

        if (outputMode === 'compact-review') {
            return createCompactReviewResult({
                attachment,
                physicalState,
                sourceIds,
                sourceIdentitySetFingerprint: this.sourceIdentitySet.fingerprint,
                sourceAltitudesDegrees: Object.freeze({
                    sun: altitudeDegrees(sunGeometry.directionAtmosphere),
                    moon: altitudeDegrees(attachment.sceneGeometry.moon.directionModel),
                    sirius: altitudeDegrees(
                        sceneGeometry.cameraDirectionToAtmosphere(sirius.directionCamera),
                    ),
                }),
                composition,
                status,
                displayModel: this.displayModel,
                moonIntegration,
                presentationOverrides,
                fingerprints: Object.freeze({
                    renderer: this.fingerprint,
                    camera: this.camera.fingerprint,
                    basis: this.canonicalSolarIrradiance.basis.fingerprint,
                    sceneGeometry: sceneGeometry.fingerprint,
                    visibilityResolver: visibilityResolver.fingerprint,
                    frameEvaluator: frameEvaluator.fingerprint,
                    composition: stableHash({
                        caseId: attachment.matrixCase.id,
                        componentIntegrals:
                            composition.componentSpectralRadianceSolidAngleIntegrals,
                        displayPass: composition.displayPass,
                    }),
                }),
            });
        }

        return freezeJsonValue({
            kind: 'er6-physical-globe-scene-case-v1',
            caseId: attachment.matrixCase.id,
            caseOrdinal: attachment.matrixCase.ordinal,
            epochIso: attachment.matrixCase.exactTimeIso,
            attachmentFingerprint: attachment.fingerprint,
            physicalStateFingerprint: physicalState.fingerprint,
            sourceIdentitySetFingerprint: this.sourceIdentitySet.fingerprint,
            sourceIds,
            sourceAltitudesDegrees: Object.freeze({
                sun: altitudeDegrees(sunGeometry.directionAtmosphere),
                moon: altitudeDegrees(attachment.sceneGeometry.moon.directionModel),
                sirius: altitudeDegrees(
                    sceneGeometry.cameraDirectionToAtmosphere(sirius.directionCamera),
                ),
            }),
            returnedEpoch: attachment.returnedEpoch,
            nativeEventAvailability: attachment.matrixCase.schedule.nativeEventAvailability,
            geometry: Object.freeze({
                scene: sceneGeometry.describe(),
                sun: sunGeometry,
                moonDirectionResidual,
                moonDistanceResidualKilometers,
                moonAngularRadiusResidualRadians,
                moonRadiusDerivationResidualRadians,
                moonTransform: moon.cameraTransform,
                blockers: blockerDescriptors,
                visibilityResolver: visibilityResolver.describe(),
                depthEvidence: geometryDepthEvidence,
            }),
            sources: Object.freeze({
                sun: sun.source.describe(),
                moon: moon.describe(),
                lunarIrradianceEvaluation: describeLunarEvaluation(lunarEvaluation),
                sirius: sirius.describe(),
                syntheticFlat32Diagnostics: ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY,
            }),
            atmosphere: Object.freeze({
                descriptor: atmosphereModel.descriptor,
                frameEvaluator: frameEvaluator.describe(),
                canonicalPacketSharedByIdentity:
                    atmosphereModel.lightSource.irradiancePacket
                        === this.canonicalSolarIrradiance
                    && sun.irradiancePacket === this.canonicalSolarIrradiance
                    && this.lunarIrradianceProvider.model.canonicalSolar
                        === this.canonicalSolarIrradiance,
            }),
            baseFrame,
            transport: Object.freeze({
                sun: sunIntegration,
                moon: moonIntegration,
                sirius: siriusAccumulation,
            }),
            composition,
            status,
            qualifications: freezeJsonValue({
                endpointRadiometry: 'absent; authored scene RGB is geometry metadata only',
                moonSpatialRadiance:
                    'uniform flux-conserving surrogate; no texture, resolved BRDF, Earthshine, eclipse, or near-Moon contact claim',
                siriusAstrometry:
                    'fixed catalog J2000; no apparent-place or atmospheric-refraction claim',
                automatedReviewability: 'not-claimed',
                humanReview: 'not-claimed',
                observationalVisibility: 'not-claimed',
            }),
            fingerprints: Object.freeze({
                renderer: this.fingerprint,
                camera: this.camera.fingerprint,
                basis: this.canonicalSolarIrradiance.basis.fingerprint,
                sceneGeometry: sceneGeometry.fingerprint,
                visibilityResolver: visibilityResolver.fingerprint,
                frameEvaluator: frameEvaluator.fingerprint,
                composition: stableHash({
                    caseId: attachment.matrixCase.id,
                    componentIntegrals:
                        composition.componentSpectralRadianceSolidAngleIntegrals,
                    displayPass: composition.displayPass,
                }),
            }),
        });
    }
}

function createCompactReviewResult({
    attachment,
    physicalState,
    sourceIds,
    sourceIdentitySetFingerprint,
    sourceAltitudesDegrees,
    composition,
    status,
    displayModel,
    moonIntegration,
    presentationOverrides,
    fingerprints,
}) {
    const moonByPixel = new Map(moonIntegration.pixels.map((pixel) => [
        `${pixel.pixelX},${pixel.pixelY}`,
        pixel.transportedExtendedSpectralRadianceDensity,
    ]));
    return freezeJsonValue({
        kind: 'er6-physical-globe-scene-compact-review-case-v1',
        outputMode: 'compact-review',
        caseId: attachment.matrixCase.id,
        caseOrdinal: attachment.matrixCase.ordinal,
        epochIso: attachment.matrixCase.exactTimeIso,
        attachmentFingerprint: attachment.fingerprint,
        physicalStateFingerprint: physicalState.fingerprint,
        sourceIdentitySetFingerprint,
        sourceIds,
        sourceAltitudesDegrees,
        presentationOverrides,
        composition: Object.freeze({
            kind: 'physical-spectral-frame-compact-review-v1',
            widthPixels: composition.widthPixels,
            heightPixels: composition.heightPixels,
            pixels: Object.freeze(composition.pixels.map((pixel) => {
                const moonValues = moonByPixel.get(`${pixel.pixelX},${pixel.pixelY}`)
                    ?? zeroSpectrum(pixel.finalSpectralRadianceDensity.length);
                const withoutSirius = subtractAlignedSpectra(
                    pixel.finalSpectralRadianceDensity,
                    pixel.components.pointSpectralRadianceDensity,
                );
                const withoutMoon = subtractAlignedSpectra(
                    pixel.finalSpectralRadianceDensity,
                    moonValues,
                );
                return Object.freeze({
                    pixelX: pixel.pixelX,
                    pixelY: pixel.pixelY,
                    display: pixel.display,
                    counterfactualDisplay: presentationOverrides
                        ? Object.freeze({
                            withoutSiriusRgb:
                                displayModel.radianceToDisplayRgb(withoutSirius),
                            withoutMoonRgb:
                                displayModel.radianceToDisplayRgb(withoutMoon),
                        })
                        : null,
                });
            })),
            componentSpectralRadianceSolidAngleIntegrals:
                composition.componentSpectralRadianceSolidAngleIntegrals,
            maximumAbsoluteCompositionResidual:
                composition.maximumAbsoluteCompositionResidual,
            displayPass: composition.displayPass,
        }),
        status,
        qualifications: Object.freeze({
            outputDetail:
                'compact review pixels retain display RGB while full per-pixel spectral diagnostics are omitted',
            physicalContract:
                'identical source, geometry, visibility, atmosphere, transport, composition, and display evaluation',
            humanReview: 'not-claimed',
            observationalVisibility: 'not-claimed',
        }),
        fingerprints,
    });
}

function createControlledMoonPresentationSource(physicalMoon, overrides) {
    const centerDirectionCamera = overrides.moonDirectionCamera;
    const presentationOverride = freezeJsonValue({
        id: overrides.id,
        astronomicalPosition: false,
        directionPolicy: 'controlled-camera-presentation-override',
        physicalCenterDirectionCamera: physicalMoon.centerDirectionCamera,
        controlledCenterDirectionCamera: centerDirectionCamera,
        preservedFacts: Object.freeze([
            'physical-state-fingerprint',
            'disk-integrated-spectral-irradiance',
            'angular-radius',
            'finite-body-center-depth',
            'phase-and-distance-radiometry',
        ]),
    });
    const source = new ExternalCelestialSource({
        id: physicalMoon.source.id,
        kind: physicalMoon.source.kind,
        geometry: {
            kind: 'controlled-presentation-uniform-globe-moon-disk-v1',
            owner: 'Er6PhysicalGlobeSceneRenderer',
            physicalSourceFingerprint: physicalMoon.source.fingerprint,
            physicalStateFingerprint: physicalMoon.evaluation.physicalState.fingerprint,
            centerDirectionCamera,
            angularRadiusRadians: physicalMoon.angularRadiusRadians,
            finiteBodyCenterDepthMeters: physicalMoon.sourceDepth.distanceMeters,
            presentationOverride,
        },
        spectralMeasure: physicalMoon.packet,
    });
    const adapter = {
        evaluation: physicalMoon.evaluation,
        cameraTransform: physicalMoon.cameraTransform,
        centerDirectionCamera,
        angularRadiusRadians: physicalMoon.angularRadiusRadians,
        sourceDepth: physicalMoon.sourceDepth,
        depthQualification: physicalMoon.depthQualification,
        packet: physicalMoon.packet,
        source,
        reconstruction: physicalMoon.reconstruction,
        presentationOverride,
        radianceForSample: (sample) => physicalMoon.radianceForSample(sample),
        describe: () => Object.freeze({
            kind: 'controlled-presentation-uniform-globe-moon-disk-v1',
            fingerprint: adapter.fingerprint,
            physicalMoon: physicalMoon.describe(),
            source: source.describe(),
            centerDirectionCamera,
            angularRadiusRadians: physicalMoon.angularRadiusRadians,
            sourceDepth: physicalMoon.sourceDepth,
            presentationOverride,
        }),
    };
    adapter.fingerprint = stableHash({
        kind: 'controlled-presentation-uniform-globe-moon-disk-v1',
        physicalMoonFingerprint: physicalMoon.fingerprint,
        sourceFingerprint: source.fingerprint,
        presentationOverride,
    });
    return Object.freeze(adapter);
}

function validatePresentationOverrides(value) {
    if (value == null) {
        return null;
    }
    requirePlainObject(value, 'ER6_RENDERER_PRESENTATION_OVERRIDE_INVALID',
        'ER6 renderer presentationOverrides must be an object.');
    rejectUnknownFields(
        value,
        PRESENTATION_OVERRIDE_FIELDS,
        'presentation overrides',
    );
    if (
        typeof value.id !== 'string'
        || value.id.trim() === ''
        || value.astronomicalPosition !== false
    ) {
        throw configurationError('ER6_RENDERER_PRESENTATION_OVERRIDE_IDENTITY_INVALID',
            'Controlled presentation overrides require an id and astronomicalPosition false.');
    }
    return freezeJsonValue({
        id: value.id,
        astronomicalPosition: false,
        moonDirectionCamera: validatePresentationDirection(
            value.moonDirectionCamera,
            'moonDirectionCamera',
        ),
        siriusDirectionCamera: validatePresentationDirection(
            value.siriusDirectionCamera,
            'siriusDirectionCamera',
        ),
    });
}

function validatePresentationDirection(value, fieldName) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every(Number.isFinite)
    ) {
        throw configurationError('ER6_RENDERER_PRESENTATION_DIRECTION_INVALID',
            `${fieldName} must be a finite three-vector.`);
    }
    const length = Math.hypot(...value);
    if (Math.abs(length - 1) > 1e-12 || !(value[2] < 0)) {
        throw configurationError('ER6_RENDERER_PRESENTATION_DIRECTION_INVALID',
            `${fieldName} must be a unit direction in the forward -z hemisphere.`, {
                length,
            });
    }
    return Object.freeze([...value]);
}

function subtractAlignedSpectra(left, right) {
    return Object.freeze(left.map((value, index) => Math.max(0, value - right[index])));
}

function zeroSpectrum(channelCount) {
    return Object.freeze(Array(channelCount).fill(0));
}

function describeLunarEvaluation(value) {
    return freezeJsonValue({
        kind: value.kind,
        fingerprint: value.fingerprint,
        providerFingerprint: value.providerFingerprint,
        sourceId: value.sourceId,
        physicalStateFingerprint: value.physicalState.fingerprint,
        lunarAspect: value.lunarAspect,
        basis: value.basis.describe(),
        canonicalSolar: value.canonicalSolar.describe(),
        geometry: value.geometry,
        modelRequest: value.modelRequest,
        modelEvaluation: value.modelEvaluation,
        diskIntegratedSpectralIrradiance: value.diskIntegratedSpectralIrradiance,
        provenance: value.provenance,
        ownership: value.ownership,
        qualifications: value.qualifications,
    });
}

function createAtmosphereModel({
    canonicalSolar,
    sunDirectionAtmosphere,
    sunAngularRadiusRadians,
    controls,
}) {
    const observerHeightMeters = sceneObserverHeightMeters();
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters,
        observerUpDirection: [1, 0, 0],
        sourceDirection: sunDirectionAtmosphere,
        cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
        cacheBoundaryAltitudeMeters: observerHeightMeters,
        sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new CanonicalSolarIlluminationSource({
        irradiancePacket: canonicalSolar,
        directionToLight: sunDirectionAtmosphere,
        angularRadiusRadians: sunAngularRadiusRadians,
        cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
        cacheDirectionCount: controls.incidentDirectionCount,
        cacheBoundaryAltitudeMeters: observerHeightMeters,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: controls,
    });
    const evaluator = new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: controls,
    });
    const descriptor = freezeJsonValue({
        kind: 'er6-canonical-solar-spherical-atmosphere-v1',
        geometry: Object.freeze({
            bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
            topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
            observerHeightMeters,
            observerUpDirection: Object.freeze([1, 0, 0]),
        }),
        controls,
        illumination: lightSource.describe(),
        canonicalSolarPacketFingerprint: canonicalSolar.fingerprint,
    });
    return Object.freeze({ geometry, atmosphere, lightSource, calculator, evaluator, descriptor });
}

function evaluateBaseFrame({ camera, frameEvaluator, sceneGeometry }) {
    const basePixels = [];
    const rays = [];
    const hitCounts = new Map();
    for (let pixelY = 0; pixelY < camera.heightPixels; pixelY += 1) {
        for (let pixelX = 0; pixelX < camera.widthPixels; pixelX += 1) {
            const directionCamera = camera.rasterCenterToDirection(pixelX, pixelY);
            const geometryRay = sceneGeometry.resolveBaseRay({ directionCamera });
            const intersection = geometryRay.sceneIntersection;
            const depth = intersection.kind === 'hit'
                ? Object.freeze({
                    kind: 'finite',
                    distanceMeters: intersection.distanceMeters,
                })
                : null;
            const evaluation = frameEvaluator.evaluateCameraDirection(
                directionCamera,
                depth,
            );
            basePixels.push(Object.freeze({
                pixelX,
                pixelY,
                pathSpectralRadianceDensity: evaluation.pathSpectralRadianceDensity,
                viewSpectralTransmittance: evaluation.viewSpectralTransmittance,
                endpointSpectralRadianceDensity: null,
            }));
            if (intersection.kind === 'hit') {
                hitCounts.set(intersection.objectId,
                    (hitCounts.get(intersection.objectId) ?? 0) + 1);
            }
            rays.push(Object.freeze({
                pixelX,
                pixelY,
                pixelSolidAngleSteradians: camera.pixelSolidAngleSteradians(pixelX, pixelY),
                geometry: geometryRay,
                atmosphere: evaluation,
            }));
        }
    }
    return Object.freeze({
        kind: 'er6-physical-base-spectral-frame-v1',
        widthPixels: camera.widthPixels,
        heightPixels: camera.heightPixels,
        basePixels: Object.freeze(basePixels),
        rays: Object.freeze(rays),
        objectHitCounts: Object.freeze(Object.fromEntries(
            [...hitCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
        )),
        endpointPolicy: 'typed-null-zero-physical-spectral-endpoint',
        complete: basePixels.length === camera.widthPixels * camera.heightPixels,
        fingerprints: Object.freeze({
            camera: camera.fingerprint,
            frameEvaluator: frameEvaluator.fingerprint,
            sceneGeometry: sceneGeometry.fingerprint,
        }),
    });
}

function resolveSunGeometry(physicalState, adaptedGeometry, sceneGeometry) {
    const observerToSun = subtract(
        physicalState.worldState.sun.positionKm,
        physicalState.observerState.positionKm,
    );
    const directionJ2000 = normalize(observerToSun, 'observer-to-Sun direction');
    const directionCamera = sceneGeometry.j2000DirectionToCamera(directionJ2000);
    const directionAtmosphere = sceneGeometry.cameraDirectionToAtmosphere(directionCamera);
    const distanceKm = Math.hypot(...observerToSun);
    const angularRadiusRadians = Math.asin(
        physicalState.worldState.sun.radiusKm / distanceKm,
    );
    const angularRadiusResidualRadians = Math.abs(
        angularRadiusRadians - adaptedGeometry.sun.angularRadiusRadians,
    );
    const distanceResidualKilometers = Math.abs(
        distanceKm - adaptedGeometry.sun.distanceKm,
    );
    const modelRouteResidual = maximumAbsoluteDifference(
        directionAtmosphere,
        adaptedGeometry.sun.directionModel,
    );
    const sceneRouteResidual = maximumAbsoluteDifference(
        sceneGeometry.cameraDirectionToScene(directionCamera),
        adaptedGeometry.sun.directionScene,
    );
    if (
        Math.max(
            modelRouteResidual,
            sceneRouteResidual,
            angularRadiusResidualRadians,
        ) > GEOMETRY_TOLERANCE
        || distanceResidualKilometers > 1e-6
    ) {
        throw configurationError('ER6_RENDERER_SUN_DIRECTION_MISMATCH',
            'Sun J2000, observer-local, scene, distance, radius, and camera routes disagree.', {
                modelRouteResidual,
                sceneRouteResidual,
                angularRadiusResidualRadians,
                distanceResidualKilometers,
                tolerance: GEOMETRY_TOLERANCE,
            });
    }
    return freezeJsonValue({
        directionJ2000,
        directionCamera,
        directionAtmosphere,
        directionScene: sceneGeometry.cameraDirectionToScene(directionCamera),
        distanceKm,
        angularRadiusRadians,
        angularRadiusResidualRadians,
        distanceResidualKilometers,
        modelRouteResidual,
        sceneRouteResidual,
    });
}

function createGeometryDepthEvidence({
    attachment,
    sceneGeometryDescriptor,
    blockerDescriptors,
    baseFrame,
    sunGeometry,
    moon,
    moonDirectionResidual,
    moonDistanceResidualKilometers,
    moonAngularRadiusResidualRadians,
    moonRadiusDerivationResidualRadians,
    sunIntegration,
    moonIntegration,
    siriusAccumulation,
}) {
    const transforms = sceneGeometryDescriptor.transforms;
    const rotationResiduals = Object.values(transforms.rotationDiagnostics)
        .flatMap((entry) => [
            entry.maximumRowNormResidual,
            entry.maximumOrthogonalityResidual,
            entry.determinantResidual,
        ]);
    const inverseResiduals = Object.values(transforms.inverseDiagnostics);
    const maximumTransformResidual = Math.max(
        ...rotationResiduals,
        ...inverseResiduals,
        transforms.presentationForwardMaximumResidual,
    );
    const expectedBlockerIds = Object.freeze([
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround.objectId,
        ...ER6_FLAT32_SCENE_GEOMETRY_FACTS.reviewBoxes.map((entry) => entry.objectId),
        moon.source.id,
    ].sort());
    const actualBlockerIds = Object.freeze(blockerDescriptors
        .map((entry) => entry.id).sort());
    const blockerRegistryExact = stableHash(actualBlockerIds)
        === stableHash(expectedBlockerIds)
        && new Set(actualBlockerIds).size === expectedBlockerIds.length;
    const hitRays = baseFrame.rays.filter((ray) =>
        ray.geometry.sceneIntersection.kind === 'hit');
    const baseDepthsValid = hitRays.length > 0
        && hitRays.every((ray) =>
            Number.isFinite(ray.geometry.sceneIntersection.distanceMeters)
            && ray.geometry.sceneIntersection.distanceMeters > 0)
        && baseFrame.rays.every((ray) => ray.geometry.endpointContribution === null);
    const moonSelfExcluded = moonIntegration.samples.length > 0
        && moonIntegration.samples.every((sample) =>
            sample.visibility.diagnostics?.evaluations?.some((entry) =>
                entry.blockerId === moon.source.id
                && entry.disposition === 'self-excluded'
                && entry.callbackCallCount === 0));
    const blockedSamples = [
        ...sunIntegration.samples,
        ...moonIntegration.samples,
    ].filter((sample) => !sample.visibility.visible);
    const everyBlockedSampleNamesOccluder = blockedSamples.every((sample) =>
        typeof sample.visibility.occluder?.id === 'string');
    const siriusBlockerNamed = siriusAccumulation.visibility.visible
        || typeof siriusAccumulation.visibility.occluder?.id === 'string';
    const finiteMoonDepthExact = moon.sourceDepth.kind === 'finite'
        && moon.sourceDepth.distanceMeters
            === moon.evaluation.geometry.finiteBodyCenterDepthMeters;
    const sourceDepthKindsExact = sunIntegration.sourceDepth.kind === 'infinite'
        && moonIntegration.sourceDepth.kind === 'finite'
        && siriusAccumulation.exactSourceRay.depth.kind === 'infinite'
        && finiteMoonDepthExact;
    const accepted = attachment.returnedEpoch.worldStateEpochIso
            === attachment.matrixCase.exactTimeIso
        && maximumTransformResidual <= 1e-12
        && sunGeometry.modelRouteResidual <= GEOMETRY_TOLERANCE
        && sunGeometry.sceneRouteResidual <= GEOMETRY_TOLERANCE
        && sunGeometry.angularRadiusResidualRadians <= GEOMETRY_TOLERANCE
        && sunGeometry.distanceResidualKilometers <= 1e-6
        && moonDirectionResidual <= GEOMETRY_TOLERANCE
        && moonDistanceResidualKilometers <= 1e-9
        && moonAngularRadiusResidualRadians <= GEOMETRY_TOLERANCE
        && moonRadiusDerivationResidualRadians <= GEOMETRY_TOLERANCE
        && blockerRegistryExact
        && baseDepthsValid
        && moonSelfExcluded
        && everyBlockedSampleNamesOccluder
        && siriusBlockerNamed
        && sourceDepthKindsExact;
    return freezeJsonValue({
        status: accepted ? 'accepted' : 'rejected',
        maximumTransformResidual,
        expectedBlockerIds,
        actualBlockerIds,
        blockerRegistryExact,
        baseRayCount: baseFrame.rays.length,
        finiteBaseHitCount: hitRays.length,
        baseDepthsValid,
        moonSelfExcluded,
        blockedExtendedSampleCount: blockedSamples.length,
        everyBlockedSampleNamesOccluder,
        siriusBlockerNamed,
        sourceDepthKindsExact,
        routeResiduals: Object.freeze({
            sunModel: sunGeometry.modelRouteResidual,
            sunScene: sunGeometry.sceneRouteResidual,
            sunAngularRadiusRadians: sunGeometry.angularRadiusResidualRadians,
            sunDistanceKilometers: sunGeometry.distanceResidualKilometers,
            moonModel: moonDirectionResidual,
            moonDistanceKilometers: moonDistanceResidualKilometers,
            moonAngularRadiusRadians: moonAngularRadiusResidualRadians,
            moonRadiusDerivationRadians: moonRadiusDerivationResidualRadians,
        }),
        tolerances: Object.freeze({
            transform: 1e-12,
            directionAndAngularRadius: GEOMETRY_TOLERANCE,
            sunDistanceKilometers: 1e-6,
            moonDistanceKilometers: 1e-9,
        }),
    });
}

function createCaseStatus(values) {
    const expectedPixelCount = values.camera.widthPixels * values.camera.heightPixels;
    const compositionScale = maximumFrameSpectralScale(
        values.composition.pixels,
    );
    const siriusAccountingRelativeResidual =
        values.siriusAccumulation.accounting.maximumAbsoluteResidual
        / spectralScale(
            values.siriusAccumulation.transmittedSpectralIrradiance.values,
        );
    const sunConservationRelativeResidual =
        values.sunIntegration.componentConservation.maximumAbsoluteSpectralResidual
        / spectralScale(values.sunIntegration.integrals.total.input
            .spectralRadianceSolidAngleIntegral.values);
    const moonConservationRelativeResidual =
        values.moonIntegration.componentConservation.maximumAbsoluteSpectralResidual
        / spectralScale(values.moonIntegration.integrals.total.input
            .spectralRadianceSolidAngleIntegral.values);
    const sunProjectedRecoveryRelativeResidual = maximumRelativeSpectralResidual(
        values.sunIntegration.integrals.total.input.projectedSpectralIrradiance.values,
        values.sun.irradiancePacket.values,
    );
    const moonProjectedRecoveryRelativeResidual = maximumRelativeSpectralResidual(
        values.moonIntegration.integrals.total.input.projectedSpectralIrradiance.values,
        values.moon.evaluation.diskIntegratedSpectralIrradiance.values,
    );
    const compositionRelativeResidual =
        values.composition.maximumAbsoluteCompositionResidual / compositionScale;
    const mechanicalAccepted = values.baseFrame.complete
        && values.baseFrame.basePixels.length === expectedPixelCount
        && values.composition.pixels.length === expectedPixelCount
        && values.composition.displayPass.actualCallCount === expectedPixelCount
        && values.composition.displayPass.expectedCallCount === expectedPixelCount
        && values.composition.displayPass.sourceSpecificGain === false
        && values.composition.displayPass.preDisplaySpectralValuesRetained === true
        && compositionRelativeResidual <= RELATIVE_NUMERICAL_TOLERANCE;
    const geometryDepthAccepted = values.geometryDepthEvidence.status === 'accepted';
    const physicalAccepted = mechanicalAccepted
        && geometryDepthAccepted
        && values.atmosphereModel.lightSource.irradiancePacket === values.canonicalSolar
        && values.sun.irradiancePacket === values.canonicalSolar
        && values.sun.reconstruction.maxRelativeResidual <= 1e-10
        && values.moon.reconstruction.maximumRelativeResidual <= 1e-10
        && siriusAccountingRelativeResidual <= RELATIVE_NUMERICAL_TOLERANCE
        && sunProjectedRecoveryRelativeResidual <= 1e-10
        && moonProjectedRecoveryRelativeResidual <= 1e-10
        && values.sunIntegration.transportCalls.sameDirectionAndDepthObjectForVisibleCallbacks
        && values.moonIntegration.transportCalls.sameDirectionAndDepthObjectForVisibleCallbacks
        && sunConservationRelativeResidual <= RELATIVE_NUMERICAL_TOLERANCE
        && moonConservationRelativeResidual <= RELATIVE_NUMERICAL_TOLERANCE;
    return freezeJsonValue({
        mechanicalStatus: mechanicalAccepted ? 'accepted' : 'rejected',
        geometryDepthStatus: geometryDepthAccepted ? 'accepted' : 'rejected',
        physicalRadiometryStatus: physicalAccepted ? 'accepted' : 'rejected',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        overallPhysicalCaseStatus: physicalAccepted ? 'accepted' : 'rejected',
        metrics: Object.freeze({
            compositionRelativeResidual,
            siriusAccountingRelativeResidual,
            sunConservationRelativeResidual,
            moonConservationRelativeResidual,
            sunProjectedRecoveryRelativeResidual,
            moonProjectedRecoveryRelativeResidual,
        }),
    });
}

function validateAttachment(value, canonicalCaseMatrix, canonicalQueryOrder) {
    requirePlainObject(value, 'ER6_RENDERER_ATTACHMENT_REQUIRED',
        'ER6 renderer requires a returned-epoch attachment.');
    const matrixCase = value.matrixCase;
    const physicalState = validateEr6HorizonsPhysicalGlobeStateIntegrity(
        value.ephemerisState,
    );
    const canonicalCase = Number.isSafeInteger(matrixCase?.ordinal)
        ? canonicalCaseMatrix.cases[matrixCase.ordinal]
        : null;
    const canonicalCaseIntact = canonicalCase != null
        && matrixCase.fingerprint === canonicalCase.fingerprint
        && stableHash(matrixCase) === stableHash(canonicalCase);
    const queryIdentities = value.queryIdentities;
    const queryHashes = Array.isArray(queryIdentities)
        ? queryIdentities.map((entry) => entry.queryHash)
        : [];
    const queryEpochs = Array.isArray(queryIdentities)
        ? queryIdentities.map((entry) => entry.returnedEpochIso)
        : [];
    const queryOrderIntact = Array.isArray(queryIdentities)
        && queryIdentities.length === canonicalQueryOrder.length
        && queryIdentities.every((query, index) => {
            const expected = canonicalQueryOrder[index];
            const expectedObserverId = expected.observer ? matrixCase?.observer?.id : null;
            return query.queryKind === expected.queryKind
                && query.target === expected.target
                && query.observerId === expectedObserverId
                && query.requestedEpochIso === matrixCase.exactTimeIso
                && query.returnedEpochIso === matrixCase.exactTimeIso
                && /^[a-f0-9]{64}$/.test(query.queryHash ?? '')
                && query.apiVersion === physicalState.provenance.sourceVersion
                && (expected.queryKind === 'lunar-aspect-observer'
                    ? query.lunarAspectFingerprint
                        === physicalState.lunarAspect.fingerprint
                    : query.lunarAspectFingerprint === null);
        });
    const returnedEpochIntact = Array.isArray(value.returnedEpoch?.queryReturnedEpochs)
        && Array.isArray(value.returnedEpoch?.queryHashes)
        && Array.isArray(physicalState.provenance.queryHashes)
        && value.returnedEpoch.requestedEpochIso === matrixCase?.exactTimeIso
        && value.returnedEpoch?.worldStateEpochIso === matrixCase?.exactTimeIso
        && stableHash(value.returnedEpoch.queryReturnedEpochs) === stableHash(queryEpochs)
        && stableHash(value.returnedEpoch.queryHashes) === stableHash(queryHashes)
        && stableHash(physicalState.provenance.queryHashes) === stableHash(queryHashes);
    const lunarAspectIntact = value.lunarAspect?.fingerprint
        === physicalState.lunarAspect.fingerprint
        && stableHash(value.lunarAspect) === stableHash(physicalState.lunarAspect);
    const recomputedSceneGeometry = new GlobeEphemerisSceneAdapter().resolve({
        ephemerisState: physicalState,
    });
    const sceneGeometryIntact = stableHash(value.sceneGeometry)
        === stableHash(recomputedSceneGeometry);
    if (
        value.kind !== 'er6-globe-case-with-ephemeris-v1'
        || matrixCase?.kind !== 'er6-globe-case-v1'
        || !canonicalCaseIntact
        || !queryOrderIntact
        || !returnedEpochIntact
        || !lunarAspectIntact
        || !sceneGeometryIntact
        || physicalState.worldState.epochIso !== matrixCase.exactTimeIso
        || value.sceneGeometry?.epochIso !== matrixCase.exactTimeIso
        || value.sceneGeometry?.moon?.presentationOverride !== null
        || value.ownership?.sameEphemerisStateObject !== true
        || value.ownership?.sameLunarAspectObject !== true
    ) {
        throw configurationError('ER6_RENDERER_ATTACHMENT_INVALID',
            'ER6 renderer requires one canonical untampered exact-epoch case, query set, state, aspect, and scene attachment.', {
                canonicalCaseIntact,
                queryOrderIntact,
                returnedEpochIntact,
                lunarAspectIntact,
                sceneGeometryIntact,
            });
    }
    const expectedFingerprint = stableHash({
        resolverFingerprint: matrixCase.resolverFingerprint,
        caseFingerprint: matrixCase.fingerprint,
        returnedEpoch: value.returnedEpoch,
        lunarAspect: value.lunarAspect,
        sceneGeometry: value.sceneGeometry,
    });
    if (value.fingerprint !== expectedFingerprint) {
        throw configurationError('ER6_RENDERER_ATTACHMENT_FINGERPRINT_MISMATCH',
            'ER6 attachment fingerprint does not reconstruct from retained state.');
    }
    return value;
}

function validateRenderedSourceIds(sourceIds, sourceIdentitySet) {
    const expected = new Set(sourceIdentitySet.identities.map((entry) => entry.id));
    const actual = new Set(Object.values(sourceIds));
    if (expected.size !== actual.size || [...expected].some((id) => !actual.has(id))) {
        throw configurationError('ER6_RENDERER_SOURCE_IDENTITY_MISMATCH',
            'Rendered Sun, Moon, and Sirius ids must equal the canonical identity set.', {
                expected: [...expected],
                actual: [...actual],
            });
    }
}

function validateCanonicalSolar(value) {
    if (
        !(value instanceof SpectralDensityPacket)
        || value.fingerprint !== EXPECTED_SOLAR.fingerprint
        || value.basis.fingerprint !== EXPECTED_BASIS.fingerprint
        || value.quantity !== 'spectral-irradiance-density'
        || value.units !== 'W m^-2 nm^-1'
    ) {
        throw configurationError('ER6_RENDERER_CANONICAL_SOLAR_INVALID',
            'ER6 renderer requires the exact canonical solar irradiance packet.');
    }
    return value;
}

function validateCalspecPacket(value) {
    const expected = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec;
    if (
        !(value instanceof SpectralDensityPacket)
        || value.basis.fingerprint !== EXPECTED_BASIS.fingerprint
        || value.quantity !== 'spectral-irradiance-density'
        || value.units !== 'W m^-2 nm^-1'
        || value.provenance.sourceId !== expected.sourceId
        || value.provenance.sourceVersion !== expected.sourceVersion
        || value.provenance.sourceHashSha256 !== expected.sourceHashSha256
    ) {
        throw configurationError('ER6_RENDERER_CALSPEC_SIRIUS_INVALID',
            'ER6 renderer requires the accepted CALSPEC Sirius packet.');
    }
    return value;
}

function validateDisplayModel(value) {
    if (!value || typeof value.radianceToDisplayRgb !== 'function'
        || typeof value.describeDisplayConversion !== 'function') {
        throw configurationError('ER6_RENDERER_DISPLAY_MODEL_INVALID',
            'ER6 renderer requires one shared physical-frame display model.');
    }
}

function validateAtmosphereControls(value) {
    requirePlainObject(value, 'ER6_RENDERER_ATMOSPHERE_CONTROLS_REQUIRED',
        'ER6 renderer requires explicit atmosphere controls.');
    rejectUnknownFields(value, ATMOSPHERE_CONTROL_FIELDS, 'atmosphere controls');
    return freezeJsonValue(Object.fromEntries(ATMOSPHERE_CONTROL_FIELDS.map((field) => [
        field,
        requirePositiveInteger(value[field], field),
    ])));
}

function validateExtendedQuadrature(value) {
    requirePlainObject(value, 'ER6_RENDERER_QUADRATURE_REQUIRED',
        'ER6 renderer requires explicit Sun and Moon quadrature controls.');
    rejectUnknownFields(value, QUADRATURE_FIELDS, 'extended quadrature');
    return freezeJsonValue(Object.fromEntries(QUADRATURE_FIELDS.map((sourceId) => {
        const controls = value[sourceId];
        requirePlainObject(controls, 'ER6_RENDERER_SOURCE_QUADRATURE_REQUIRED',
            `ER6 renderer requires ${sourceId} quadrature controls.`);
        rejectUnknownFields(controls, SOURCE_QUADRATURE_FIELDS, `${sourceId} quadrature`);
        return [sourceId, Object.fromEntries(SOURCE_QUADRATURE_FIELDS.map((field) => [
            field,
            requirePositiveInteger(controls[field], `${sourceId}.${field}`),
        ]))];
    })));
}

function sceneObserverHeightMeters() {
    return ER6_FLAT32_SCENE_GEOMETRY_FACTS.camera.positionSceneUnits[1]
        * ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit;
}

function altitudeDegrees(directionAtmosphere) {
    return Math.asin(Math.max(-1, Math.min(1, directionAtmosphere[0])))
        * 180 / Math.PI;
}

function subtract(left, right) {
    return left.map((entry, index) => entry - right[index]);
}

function normalize(value, label) {
    const length = Math.hypot(...value);
    if (!(length > 0) || !Number.isFinite(length)) {
        throw configurationError('ER6_RENDERER_DIRECTION_INVALID',
            `${label} must have finite positive length.`);
    }
    return Object.freeze(value.map((entry) => entry / length));
}

function maximumAbsoluteDifference(left, right) {
    return Math.max(...left.map((entry, index) => Math.abs(entry - right[index])));
}

function spectralScale(values) {
    return Math.max(...values.map(Math.abs), 1e-30);
}

function maximumFrameSpectralScale(pixels) {
    let maximum = 1e-30;
    for (const pixel of pixels) {
        for (const value of pixel.finalSpectralRadianceDensity) {
            maximum = Math.max(maximum, Math.abs(value));
        }
    }
    return maximum;
}

function maximumRelativeSpectralResidual(actual, expected) {
    if (
        !Array.isArray(actual)
        || !Array.isArray(expected)
        || actual.length !== expected.length
        || actual.length === 0
    ) {
        throw configurationError('ER6_RENDERER_SPECTRAL_COMPARISON_INVALID',
            'ER6 spectral recovery comparisons require aligned nonempty arrays.');
    }
    return Math.max(...actual.map((value, index) =>
        Math.abs(value - expected[index]) / Math.max(Math.abs(expected[index]), 1e-30)));
}

function requirePlainObject(value, code, message) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, message);
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknownFields = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknownFields.length > 0) {
        throw configurationError('ER6_RENDERER_UNKNOWN_FIELDS',
            `ER6 ${context} contains unsupported fields.`, { unknownFields });
    }
}

function requirePositiveInteger(value, label) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw configurationError('ER6_RENDERER_POSITIVE_INTEGER_REQUIRED',
            `${label} must be a positive safe integer.`);
    }
    return value;
}

function requireNonnegativeFinite(value, label) {
    if (!Number.isFinite(value) || value < 0) {
        throw configurationError('ER6_RENDERER_NONNEGATIVE_FINITE_REQUIRED',
            `${label} must be finite and nonnegative.`);
    }
    return value;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
