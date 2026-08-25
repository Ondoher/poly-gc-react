// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   physically typed full-frame composition and one post-composition display pass.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   combined ER4C full-frame correction and ER5 source closure.

import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import FrozenAtmosphereSpectralFrameEvaluator from
    './FrozenAtmosphereSpectralFrameEvaluator.js';
import PhysicalSpectralFrameComposer from './PhysicalSpectralFrameComposer.js';

const CHANNEL_COUNT = 15;
const RADIANCE_QUANTITY = 'spectral-radiance-density';
const RADIANCE_UNITS = 'W m^-2 sr^-1 nm^-1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const CONFIGURATION_FIELDS = Object.freeze([
    'camera',
    'frameEvaluator',
    'basisFingerprint',
    'pointAccumulation',
    'extendedIntegration',
    'displayModel',
]);
const PRECOMPOSITION_DISPLAY_FIELDS = new Set([
    'display',
    'displayfingerprint',
    'displaygain',
    'displayrgb',
    'displayvalue',
    'displayvalues',
    'finaldisplay',
    'finaldisplayrgb',
    'sourcedisplay',
    'sourcedisplayrgb',
    'tonemappedrgb',
]);
const SOURCE_GAIN_FIELDS = new Set([
    'sourcespecificgain',
    'sourcegain',
    'sourceonlygain',
    'sourceexposure',
    'sourceonlyexposure',
]);
const ENDPOINT_FIXTURE_VALUES = Object.freeze(Array.from(
    { length: CHANNEL_COUNT },
    (_, channelIndex) => (channelIndex + 1) * 1e-7,
));

export default class Er4cPhysicalFullFrameClosureEvaluator {
    /**
     * Create one isolated full-frame closure evaluator from accepted ER4C modules.
     *
     * @param {Er4cPhysicalFullFrameClosureEvaluatorConfiguration} configuration - Closure inputs.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_CONFIGURATION_REQUIRED',
                'ER4C full-frame closure configuration is required.');
        }
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_CAMERA_REQUIRED',
                'ER4C full-frame closure requires a PerspectiveCameraRaster.');
        }
        if (!(configuration.frameEvaluator instanceof FrozenAtmosphereSpectralFrameEvaluator)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_FRAME_EVALUATOR_REQUIRED',
                'ER4C full-frame closure requires a FrozenAtmosphereSpectralFrameEvaluator.');
        }
        if (!(configuration.displayModel instanceof BrunetonColorDisplayModel)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_DISPLAY_MODEL_REQUIRED',
                'ER4C full-frame closure requires a BrunetonColorDisplayModel.');
        }
        if (!FINGERPRINT_PATTERN.test(configuration.basisFingerprint ?? '')) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASIS_INVALID',
                'ER4C full-frame closure requires a SHA-256 spectral-basis fingerprint.');
        }
        if (
            configuration.frameEvaluator.camera !== configuration.camera
            || configuration.frameEvaluator.camera.fingerprint !== configuration.camera.fingerprint
        ) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_CAMERA_IDENTITY_MISMATCH',
                'The closure and frozen frame evaluator must retain the same camera object.');
        }
        if (configuration.frameEvaluator.basisFingerprint !== configuration.basisFingerprint) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_FRAME_BASIS_MISMATCH',
                'The closure and frozen frame evaluator must retain the same basis fingerprint.');
        }

        const pointSourceIds = validatePointAccumulation(
            configuration.pointAccumulation,
            configuration.camera.fingerprint,
            configuration.basisFingerprint,
        );
        const extendedSourceId = validateExtendedIntegration(
            configuration.extendedIntegration,
            configuration.camera.fingerprint,
            configuration.basisFingerprint,
        );
        if (pointSourceIds.includes(extendedSourceId)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_SOURCE_ID_COLLISION',
                'Point and extended source identities must remain distinct.', {
                    sourceId: extendedSourceId,
                });
        }

        let displayDescriptor;
        try {
            displayDescriptor = freezeJsonValue(
                configuration.displayModel.describeDisplayConversion(),
            );
        } catch (error) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_DISPLAY_DESCRIPTOR_INVALID',
                'The Bruneton display descriptor must be finite JSON.', {
                    cause: error.message,
                });
        }

        this.camera = configuration.camera;
        this.frameEvaluator = configuration.frameEvaluator;
        this.basisFingerprint = configuration.basisFingerprint;
        this.pointAccumulation = configuration.pointAccumulation;
        this.extendedIntegration = configuration.extendedIntegration;
        this.displayModel = configuration.displayModel;
        this.pointSourceIds = pointSourceIds;
        this.extendedSourceId = extendedSourceId;
        this.displayDescriptor = displayDescriptor;
        this.displayFingerprint = stableHash(displayDescriptor);
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the isolated closure inputs and prohibited pre-composition behavior.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable closure descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'er4c-physical-full-frame-closure-evaluator-v1',
            cameraFingerprint: this.camera.fingerprint,
            frameEvaluatorFingerprint: this.frameEvaluator.fingerprint,
            basisFingerprint: this.basisFingerprint,
            sourceIds: Object.freeze({
                point: this.pointSourceIds,
                extended: Object.freeze([this.extendedSourceId]),
            }),
            displayFingerprint: this.displayFingerprint,
            displayDescriptor: this.displayDescriptor,
            endpointFixture: endpointFixtureDescriptor(this.camera),
            physicalOrder: Object.freeze([
                'evaluate-complete-frozen-atmosphere-base-frame',
                'inject-one-typed-non-celestial-endpoint-radiance-fixture',
                'multiply-endpoint-radiance-by-destination-view-transmittance-once',
                'add-already-transported-extended-radiance',
                'add-already-transported-point-radiance',
                'retain-complete-pre-display-component-spectra',
                'invoke-one-shared-bruneton-display-conversion-per-completed-pixel',
            ]),
            prohibitedBeforeComposition: Object.freeze([
                'source-specific-gain-or-exposure',
                'display-domain-source-payload',
                'display-conversion-in-base-point-or-extended-path',
            ]),
        });
    }

    /**
     * Evaluate and verify the complete physical full-frame closure once.
     *
     * @returns {Er4cPhysicalFullFrameClosureResult} Immutable closure evidence.
     */
    evaluate() {
        const baseFrame = this.frameEvaluator.evaluateBaseFrame();
        const baseValidation = validateBaseFrame(
            baseFrame,
            this.camera,
            this.frameEvaluator.fingerprint,
            this.basisFingerprint,
        );
        const preCompositionAudit = auditPreCompositionInputs(Object.freeze({
            baseFrame,
            pointAccumulation: this.pointAccumulation,
            extendedIntegration: this.extendedIntegration,
        }));
        const prepared = injectEndpointFixture(
            baseFrame.basePixels,
            this.camera,
            this.basisFingerprint,
        );

        const displayAudit = { callCount: 0 };
        const displayModel = Object.freeze({
            describeDisplayConversion: () => this.displayDescriptor,
            radianceToDisplayRgb: (spectralRadiance) => {
                displayAudit.callCount += 1;
                return this.displayModel.radianceToDisplayRgb(spectralRadiance);
            },
        });
        const composer = new PhysicalSpectralFrameComposer({
            camera: this.camera,
            displayModel,
        });
        const displayCallCountBeforeComposition = displayAudit.callCount;
        const composition = composer.compose({
            basisFingerprint: this.basisFingerprint,
            basePixels: prepared.basePixels,
            extendedIntegrations: [this.extendedIntegration],
            pointAccumulations: [this.pointAccumulation],
        });
        const displayCallCountAfterComposition = displayAudit.callCount;
        const evidence = validateClosureComposition({
            camera: this.camera,
            basisFingerprint: this.basisFingerprint,
            baseValidation,
            preparedBasePixels: prepared.basePixels,
            endpointFixture: prepared.endpointFixture,
            pointAccumulation: this.pointAccumulation,
            pointSourceIds: this.pointSourceIds,
            extendedIntegration: this.extendedIntegration,
            extendedSourceId: this.extendedSourceId,
            composition,
            preCompositionAudit,
            displayCallCountBeforeComposition,
            displayCallCountAfterComposition,
            displayFingerprint: this.displayFingerprint,
        });

        return Object.freeze({
            kind: 'er4c-physical-full-frame-closure-v1',
            baseFrameEvaluation: baseFrame,
            preparedBasePixels: prepared.basePixels,
            endpointFixture: prepared.endpointFixture,
            composition,
            evidence,
            accepted: true,
            fingerprints: Object.freeze({
                closureEvaluator: this.fingerprint,
                frameEvaluator: this.frameEvaluator.fingerprint,
                composer: composition.fingerprints.composer,
                camera: this.camera.fingerprint,
                basis: this.basisFingerprint,
                display: this.displayFingerprint,
            }),
        });
    }
}

function validatePointAccumulation(accumulation, cameraFingerprint, basisFingerprint) {
    if (!accumulation || typeof accumulation !== 'object' || Array.isArray(accumulation)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_POINT_ACCUMULATION_REQUIRED',
            'ER4C full-frame closure requires one point accumulation object.');
    }
    validateContributionFingerprints(
        accumulation,
        cameraFingerprint,
        basisFingerprint,
        'point accumulation',
    );
    if (!Array.isArray(accumulation.pixels)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_POINT_PIXELS_REQUIRED',
            'The point accumulation must retain its transported destination pixels.');
    }
    if (accumulation?.quantity?.destination !== 'point-spectral-radiance-density') {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_POINT_QUANTITY_INVALID',
            'The point accumulation must own transported point spectral radiance density.');
    }
    if (accumulation.quantity.pathRadianceOwnership !== 'outside-this-class') {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_POINT_PATH_OWNERSHIP_INVALID',
            'Path radiance must remain outside the point accumulation.');
    }
    const sourceIds = Array.isArray(accumulation.sourceIds)
        ? accumulation.sourceIds
        : [accumulation?.source?.id];
    if (
        sourceIds.length === 0
        || sourceIds.some((sourceId) => typeof sourceId !== 'string' || sourceId.trim() === '')
        || new Set(sourceIds).size !== sourceIds.length
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_POINT_SOURCE_IDS_INVALID',
            'The point accumulation must retain distinct non-empty source identities.');
    }
    return Object.freeze([...sourceIds]);
}

function validateExtendedIntegration(integration, cameraFingerprint, basisFingerprint) {
    if (!integration || typeof integration !== 'object' || Array.isArray(integration)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_EXTENDED_INTEGRATION_REQUIRED',
            'ER4C full-frame closure requires one extended integration object.');
    }
    validateContributionFingerprints(
        integration,
        cameraFingerprint,
        basisFingerprint,
        'extended integration',
    );
    if (!Array.isArray(integration.pixels)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_EXTENDED_PIXELS_REQUIRED',
            'The extended integration must retain its transported destination pixels.');
    }
    if (
        integration?.quantity?.destination
            !== 'transported-extended-spectral-radiance-density'
        || integration.quantity.pathRadianceOwnership !== 'outside-this-class'
        || integration.quantity.finalDisplayOwnership !== 'outside-this-class'
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_EXTENDED_QUANTITY_INVALID',
            'The extended integration must retain transported radiance while excluding path and display.');
    }
    const sourceId = integration?.source?.id;
    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_EXTENDED_SOURCE_ID_INVALID',
            'The extended integration must retain one non-empty source identity.');
    }
    return sourceId;
}

function validateContributionFingerprints(result, cameraFingerprint, basisFingerprint, label) {
    if (result?.fingerprints?.camera !== cameraFingerprint) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_CONTRIBUTION_CAMERA_MISMATCH',
            `The ${label} camera fingerprint does not match the closure camera.`);
    }
    if (result?.fingerprints?.basis !== basisFingerprint) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_CONTRIBUTION_BASIS_MISMATCH',
            `The ${label} basis fingerprint does not match the closure basis.`);
    }
}

function validateBaseFrame(baseFrame, camera, frameEvaluatorFingerprint, basisFingerprint) {
    const expectedPixelCount = camera.widthPixels * camera.heightPixels;
    if (
        !baseFrame
        || typeof baseFrame !== 'object'
        || baseFrame.kind !== 'frozen-atmosphere-base-spectral-frame-v1'
        || baseFrame.widthPixels !== camera.widthPixels
        || baseFrame.heightPixels !== camera.heightPixels
        || !Array.isArray(baseFrame.basePixels)
        || baseFrame.basePixels.length !== expectedPixelCount
        || !Array.isArray(baseFrame.directions)
        || baseFrame.directions.length !== expectedPixelCount
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_FRAME_INCOMPLETE',
            'evaluateBaseFrame() must return every closure-camera pixel exactly once.', {
                expectedPixelCount,
                actualPixelCount: Array.isArray(baseFrame?.basePixels)
                    ? baseFrame.basePixels.length
                    : null,
            });
    }
    if (
        baseFrame?.fingerprints?.frameEvaluator !== frameEvaluatorFingerprint
        || baseFrame?.fingerprints?.camera !== camera.fingerprint
        || baseFrame?.fingerprints?.basis !== basisFingerprint
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_FINGERPRINT_MISMATCH',
            'The evaluated base frame must retain exact evaluator, camera, and basis identity.');
    }
    if (baseFrame?.quantity?.endpoint !== 'absent') {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_ENDPOINT_OWNERSHIP_INVALID',
            'The frozen atmosphere base frame must not supply an endpoint fixture.');
    }

    const seen = new Set();
    let nonzeroPathPixelCount = 0;
    for (const pixel of baseFrame.basePixels) {
        validatePixelCoordinate(pixel?.pixelX, pixel?.pixelY, camera, 'base frame');
        const key = pixelKey(pixel.pixelX, pixel.pixelY);
        if (seen.has(key)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_PIXEL_DUPLICATE',
                `The evaluated base frame duplicates pixel ${key}.`);
        }
        seen.add(key);
        const path = validateRadiancePacket(
            pixel.pathSpectralRadianceDensity,
            basisFingerprint,
            'base path',
        );
        validateTransmittancePacket(pixel.viewSpectralTransmittance, basisFingerprint);
        if (pixel.endpointSpectralRadianceDensity !== null) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_ENDPOINT_PRESENT',
                'The evaluated base frame must retain a null endpoint before fixture injection.');
        }
        if (hasNonzeroValue(path)) {
            nonzeroPathPixelCount += 1;
        }
    }
    for (let pixelY = 0; pixelY < camera.heightPixels; pixelY += 1) {
        for (let pixelX = 0; pixelX < camera.widthPixels; pixelX += 1) {
            if (!seen.has(pixelKey(pixelX, pixelY))) {
                throw configurationError('ER4C_FULL_FRAME_CLOSURE_BASE_PIXEL_MISSING',
                    `The evaluated base frame is missing pixel ${pixelKey(pixelX, pixelY)}.`);
            }
        }
    }
    return Object.freeze({
        evaluateBaseFrameCallCount: 1,
        expectedPixelCount,
        actualPixelCount: baseFrame.basePixels.length,
        uniquePixelCount: seen.size,
        directionCount: baseFrame.directions.length,
        endpointCountBeforeInjection: 0,
        nonzeroPathPixelCount,
        completeAndUnique: true,
    });
}

function injectEndpointFixture(basePixels, camera, basisFingerprint) {
    const descriptor = endpointFixtureDescriptor(camera);
    const packet = Object.freeze({
        quantity: RADIANCE_QUANTITY,
        units: RADIANCE_UNITS,
        basisFingerprint,
        values: ENDPOINT_FIXTURE_VALUES,
    });
    const preparedBasePixels = Object.freeze(basePixels.map((pixel) => Object.freeze({
        pixelX: pixel.pixelX,
        pixelY: pixel.pixelY,
        pathSpectralRadianceDensity: pixel.pathSpectralRadianceDensity,
        viewSpectralTransmittance: pixel.viewSpectralTransmittance,
        endpointSpectralRadianceDensity:
            pixel.pixelX === descriptor.pixelX && pixel.pixelY === descriptor.pixelY
                ? packet
                : null,
    })));
    const fixtureBasePixel = preparedBasePixels.find((pixel) =>
        pixel.pixelX === descriptor.pixelX && pixel.pixelY === descriptor.pixelY);
    const expectedTransportedValues = Object.freeze(packet.values.map((value, channelIndex) =>
        value * fixtureBasePixel.viewSpectralTransmittance.values[channelIndex]));
    if (!hasNonzeroValue(expectedTransportedValues)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_ENDPOINT_FULLY_EXTINGUISHED',
            'The deterministic endpoint fixture must retain a nonzero transported component.');
    }
    return Object.freeze({
        basePixels: preparedBasePixels,
        endpointFixture: Object.freeze({
            ...descriptor,
            packet,
            viewSpectralTransmittance: fixtureBasePixel.viewSpectralTransmittance,
            expectedTransportedSpectralRadianceDensity: Object.freeze({
                quantity: RADIANCE_QUANTITY,
                units: RADIANCE_UNITS,
                basisFingerprint,
                values: expectedTransportedValues,
            }),
        }),
    });
}

function endpointFixtureDescriptor(camera) {
    return Object.freeze({
        id: 'er4c-deterministic-non-celestial-endpoint-radiance-v1',
        role: 'typed-composition-fixture-not-a-celestial-source-or-calibration-fact',
        pixelX: Math.floor((camera.widthPixels - 1) / 2),
        pixelY: Math.floor((camera.heightPixels - 1) / 2),
        quantity: RADIANCE_QUANTITY,
        units: RADIANCE_UNITS,
        channelCount: CHANNEL_COUNT,
        valueFormula: 'L_endpoint[channelIndex] = (channelIndex + 1) * 1e-7',
        transportFormula: 'L_endpoint_transported = T_view * L_endpoint',
        sourceSpecificGain: 'none',
    });
}

function auditPreCompositionInputs(inputs) {
    const displayFieldPaths = [];
    const sourceGainFieldPaths = [];
    const explicitNoGainDeclarations = [];
    const visited = new WeakSet();
    visitInput(inputs, '$', visited, {
        displayFieldPaths,
        sourceGainFieldPaths,
        explicitNoGainDeclarations,
    });
    if (displayFieldPaths.length > 0 || sourceGainFieldPaths.length > 0) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_PRECOMPOSITION_POLICY_VIOLATION',
            'Base, point, and extended inputs must contain no display payload or source-specific gain.', {
                displayFieldPaths,
                sourceGainFieldPaths,
            });
    }
    return Object.freeze({
        roots: Object.freeze(['baseFrame', 'pointAccumulation', 'extendedIntegration']),
        displayFieldPaths: Object.freeze(displayFieldPaths),
        sourceGainFieldPaths: Object.freeze(sourceGainFieldPaths),
        explicitNoGainDeclarations: Object.freeze(explicitNoGainDeclarations),
        displayPayloadAbsent: true,
        sourceSpecificGainAbsent: true,
    });
}

function visitInput(value, path, visited, audit) {
    if (!value || typeof value !== 'object') {
        return;
    }
    if (visited.has(value)) {
        return;
    }
    visited.add(value);
    for (const [key, entry] of Object.entries(value)) {
        const normalizedKey = key.replace(/[-_]/g, '').toLowerCase();
        const entryPath = `${path}.${key}`;
        if (PRECOMPOSITION_DISPLAY_FIELDS.has(normalizedKey)) {
            audit.displayFieldPaths.push(entryPath);
        }
        if (SOURCE_GAIN_FIELDS.has(normalizedKey)) {
            if (entry === 'none' || entry === false) {
                audit.explicitNoGainDeclarations.push(entryPath);
            } else {
                audit.sourceGainFieldPaths.push(entryPath);
            }
        }
        visitInput(entry, entryPath, visited, audit);
    }
}

function validateClosureComposition(context) {
    const {
        camera,
        basisFingerprint,
        baseValidation,
        preparedBasePixels,
        endpointFixture,
        pointAccumulation,
        pointSourceIds,
        extendedIntegration,
        extendedSourceId,
        composition,
        preCompositionAudit,
        displayCallCountBeforeComposition,
        displayCallCountAfterComposition,
        displayFingerprint,
    } = context;
    const expectedPixelCount = camera.widthPixels * camera.heightPixels;
    if (
        composition?.kind !== 'physical-spectral-frame-composition-v1'
        || composition.widthPixels !== camera.widthPixels
        || composition.heightPixels !== camera.heightPixels
        || !Array.isArray(composition.pixels)
        || composition.pixels.length !== expectedPixelCount
        || composition.fingerprints.camera !== camera.fingerprint
        || composition.fingerprints.basis !== basisFingerprint
        || composition.fingerprints.display !== displayFingerprint
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_COMPOSITION_INVALID',
            'The composer must return one complete frame with exact camera, basis, and display identity.');
    }

    const baseByPixel = indexPixels(preparedBasePixels, camera, 'prepared base');
    const pointByPixel = indexContributionPixels(
        pointAccumulation.pixels,
        camera,
        'point',
        'pointSpectralRadianceDensity',
    );
    const extendedByPixel = indexContributionPixels(
        extendedIntegration.pixels,
        camera,
        'extended',
        'transportedExtendedSpectralRadianceDensity',
    );
    const expectedPointSourceIds = [...pointSourceIds];
    const actualPointSourceIds = [...composition.sources.point];
    const actualExtendedSourceIds = [...composition.sources.extended];
    if (
        !arraysEqual(actualPointSourceIds, expectedPointSourceIds)
        || !arraysEqual(actualExtendedSourceIds, [extendedSourceId])
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_SOURCE_IDENTITY_MISMATCH',
            'The composed frame must retain exact point and extended source identities.');
    }

    const independentTotals = createZeroTotals();
    const nonzeroPixelCounts = {
        path: 0,
        transportedEndpoint: 0,
        extended: 0,
        point: 0,
        final: 0,
    };
    let maximumAbsoluteDirectAlgebraResidual = 0;
    let maximumAbsoluteEndpointTransportResidual = 0;
    let maximumAbsoluteComponentRetentionResidual = 0;
    let displayPixelCallCount = 0;
    let displayPixelsWithExactlyOneCall = 0;
    for (const pixel of composition.pixels) {
        const key = pixelKey(pixel.pixelX, pixel.pixelY);
        const base = baseByPixel.get(key);
        const expectedPath = base.pathSpectralRadianceDensity.values;
        const expectedTransmittance = base.viewSpectralTransmittance.values;
        const expectedEndpoint = base.endpointSpectralRadianceDensity?.values ?? zeroSpectrum();
        const expectedTransportedEndpoint = expectedEndpoint.map((value, channelIndex) =>
            value * expectedTransmittance[channelIndex]);
        const expectedExtended = extendedByPixel.get(key) ?? zeroSpectrum();
        const expectedPoint = pointByPixel.get(key) ?? zeroSpectrum();
        const expectedBase = addSpectra(expectedPath, expectedTransportedEndpoint);
        const expectedBaseWithExtended = addSpectra(expectedBase, expectedExtended);
        const expectedFinal = addSpectra(expectedBaseWithExtended, expectedPoint);
        const components = pixel.components;

        maximumAbsoluteComponentRetentionResidual = Math.max(
            maximumAbsoluteComponentRetentionResidual,
            maximumAbsoluteResidual(components.pathSpectralRadianceDensity, expectedPath),
            maximumAbsoluteResidual(components.viewSpectralTransmittance, expectedTransmittance),
            maximumAbsoluteResidual(components.endpointSpectralRadianceDensity, expectedEndpoint),
            maximumAbsoluteResidual(
                components.transportedEndpointSpectralRadianceDensity,
                expectedTransportedEndpoint,
            ),
            maximumAbsoluteResidual(components.extendedSpectralRadianceDensity, expectedExtended),
            maximumAbsoluteResidual(components.pointSpectralRadianceDensity, expectedPoint),
        );
        maximumAbsoluteEndpointTransportResidual = Math.max(
            maximumAbsoluteEndpointTransportResidual,
            maximumAbsoluteResidual(
                components.transportedEndpointSpectralRadianceDensity,
                expectedTransportedEndpoint,
            ),
        );
        maximumAbsoluteDirectAlgebraResidual = Math.max(
            maximumAbsoluteDirectAlgebraResidual,
            maximumAbsoluteResidual(pixel.finalSpectralRadianceDensity, expectedFinal),
        );

        incrementNonzeroCounts(nonzeroPixelCounts, {
            path: components.pathSpectralRadianceDensity,
            transportedEndpoint: components.transportedEndpointSpectralRadianceDensity,
            extended: components.extendedSpectralRadianceDensity,
            point: components.pointSpectralRadianceDensity,
            final: pixel.finalSpectralRadianceDensity,
        });
        accumulateTotals(independentTotals, pixel.pixelSolidAngleSteradians, {
            path: components.pathSpectralRadianceDensity,
            transportedEndpoint: components.transportedEndpointSpectralRadianceDensity,
            extended: components.extendedSpectralRadianceDensity,
            point: components.pointSpectralRadianceDensity,
            final: pixel.finalSpectralRadianceDensity,
        });
        displayPixelCallCount += pixel?.display?.callCount ?? 0;
        if (
            pixel?.display?.callCount === 1
            && pixel.display.displayFingerprint === displayFingerprint
        ) {
            displayPixelsWithExactlyOneCall += 1;
        }
    }

    if (
        maximumAbsoluteComponentRetentionResidual !== 0
        || maximumAbsoluteEndpointTransportResidual !== 0
        || maximumAbsoluteDirectAlgebraResidual !== 0
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_ALGEBRA_MISMATCH',
            'The composed frame must retain every component and prescribed operation exactly.', {
                maximumAbsoluteComponentRetentionResidual,
                maximumAbsoluteEndpointTransportResidual,
                maximumAbsoluteDirectAlgebraResidual,
            });
    }
    if (Object.values(nonzeroPixelCounts).some((count) => count === 0)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_COMPONENT_NOT_EXERCISED',
            'Path, transported endpoint, extended, point, and final components must each be nonzero.', {
                nonzeroPixelCounts,
            });
    }

    const totalRetentionResiduals = compareComponentTotals(
        composition.componentSpectralRadianceSolidAngleIntegrals,
        independentTotals,
        basisFingerprint,
    );
    const maximumAbsoluteTotalRetentionResidual = Math.max(
        ...Object.values(totalRetentionResiduals).map(maximumAbsoluteValue),
    );
    if (maximumAbsoluteTotalRetentionResidual !== 0) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_TOTAL_RETENTION_MISMATCH',
            'Composer component totals must equal independent pixel-solid-angle totals exactly.', {
                maximumAbsoluteTotalRetentionResidual,
            });
    }
    const totalAlgebraResidual = subtractSpectra(
        composition.componentSpectralRadianceSolidAngleIntegrals.final.values,
        addSpectra(
            addSpectra(
                composition.componentSpectralRadianceSolidAngleIntegrals.path.values,
                composition.componentSpectralRadianceSolidAngleIntegrals
                    .transportedEndpoint.values,
            ),
            addSpectra(
                composition.componentSpectralRadianceSolidAngleIntegrals.extended.values,
                composition.componentSpectralRadianceSolidAngleIntegrals.point.values,
            ),
        ),
    );
    const totalAlgebraScale = Math.max(
        1,
        maximumAbsoluteValue(
            composition.componentSpectralRadianceSolidAngleIntegrals.final.values,
        ),
    );
    const totalAlgebraRoundoffTolerance = 32 * Number.EPSILON * totalAlgebraScale;
    const maximumAbsoluteTotalAlgebraResidual = maximumAbsoluteValue(totalAlgebraResidual);
    const compositionRoundoffTolerance = 16 * Number.EPSILON * maximumFrameScale(
        composition.pixels,
    );
    if (
        maximumAbsoluteTotalAlgebraResidual > totalAlgebraRoundoffTolerance
        || composition.maximumAbsoluteCompositionResidual > compositionRoundoffTolerance
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_ROUNDOFF_BOUND_EXCEEDED',
            'Associative composition diagnostics must remain within a machine-roundoff bound.', {
                maximumAbsoluteTotalAlgebraResidual,
                totalAlgebraRoundoffTolerance,
                maximumAbsoluteCompositionResidual:
                    composition.maximumAbsoluteCompositionResidual,
                compositionRoundoffTolerance,
            });
    }

    if (
        displayCallCountBeforeComposition !== 0
        || displayCallCountAfterComposition !== expectedPixelCount
        || displayPixelCallCount !== expectedPixelCount
        || displayPixelsWithExactlyOneCall !== expectedPixelCount
        || composition.displayPass.expectedCallCount !== expectedPixelCount
        || composition.displayPass.actualCallCount !== expectedPixelCount
        || composition.displayPass.sourceSpecificGain !== false
        || composition.displayPass.preDisplaySpectralValuesRetained !== true
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_DISPLAY_PASS_INVALID',
            'Bruneton display conversion must run exactly once after each completed spectral pixel.');
    }

    const endpointTransmittanceValues = endpointFixture.viewSpectralTransmittance.values;
    const endpointTransportedValues = endpointFixture
        .expectedTransportedSpectralRadianceDensity.values;
    const endpointUntransportedValues = endpointFixture.packet.values;
    const hasStrictNonzeroAttenuation = endpointTransmittanceValues.some((value) =>
        value > 0 && value < 1);
    const transportedDiffersFromUntransported = maximumAbsoluteResidual(
        endpointTransportedValues,
        endpointUntransportedValues,
    ) > 0;
    if (!hasStrictNonzeroAttenuation || !transportedDiffersFromUntransported) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_ENDPOINT_TRANSPORT_VACUOUS',
            'The endpoint fixture must observe strict nonzero attenuation and change value.', {
                hasStrictNonzeroAttenuation,
                transportedDiffersFromUntransported,
            });
    }

    return Object.freeze({
        baseFrame: baseValidation,
        endpointTransport: Object.freeze({
            fixtureId: endpointFixture.id,
            pixelX: endpointFixture.pixelX,
            pixelY: endpointFixture.pixelY,
            equation: 'L_endpoint_transported = T_view * L_endpoint',
            maximumAbsoluteResidual: maximumAbsoluteEndpointTransportResidual,
            typedNonzeroFixtureInjected: true,
            viewSpectralTransmittance: endpointFixture.viewSpectralTransmittance,
            untransportedSpectralRadianceDensity: endpointFixture.packet,
            transportedSpectralRadianceDensity:
                endpointFixture.expectedTransportedSpectralRadianceDensity,
            hasStrictNonzeroAttenuation,
            transportedDiffersFromUntransported,
        }),
        componentRetention: Object.freeze({
            retainedComponents: Object.freeze([
                'pathSpectralRadianceDensity',
                'viewSpectralTransmittance',
                'endpointSpectralRadianceDensity',
                'transportedEndpointSpectralRadianceDensity',
                'extendedSpectralRadianceDensity',
                'pointSpectralRadianceDensity',
                'finalSpectralRadianceDensity',
            ]),
            nonzeroPixelCounts: Object.freeze(nonzeroPixelCounts),
            maximumAbsoluteResidual: maximumAbsoluteComponentRetentionResidual,
            accepted: true,
        }),
        algebra: Object.freeze({
            equation:
                'L_final=L_path+T_view*L_endpoint+L_extended_transport+L_point_transport',
            prescribedOperationMaximumAbsoluteResidual:
                maximumAbsoluteDirectAlgebraResidual,
            composerAssociativeMaximumAbsoluteResidual:
                composition.maximumAbsoluteCompositionResidual,
            composerAssociativeRoundoffTolerance: compositionRoundoffTolerance,
            totalAlgebraResidual: Object.freeze(totalAlgebraResidual),
            maximumAbsoluteTotalAlgebraResidual,
            totalAlgebraRoundoffTolerance,
            exactPrescribedAlgebra: true,
        }),
        display: Object.freeze({
            model: 'BrunetonColorDisplayModel',
            displayFingerprint,
            callCountBeforeComposition: displayCallCountBeforeComposition,
            callCountAfterComposition: displayCallCountAfterComposition,
            expectedCallCount: expectedPixelCount,
            pixelsWithExactlyOneCall: displayPixelsWithExactlyOneCall,
            oneCallPerCompletedPixel: true,
            sourceSpecificGain: 'none',
            preDisplaySpectralValuesRetained: true,
        }),
        preCompositionPolicy: Object.freeze({
            ...preCompositionAudit,
            displayCallCountBeforeComposition,
            noDisplayBeforeComposition: true,
            noSourceSpecificGain: true,
        }),
        sourceIdentities: Object.freeze({
            expected: Object.freeze({
                point: pointSourceIds,
                extended: Object.freeze([extendedSourceId]),
            }),
            composed: composition.sources,
            exactIdentityRetention: true,
        }),
        componentTotals: Object.freeze({
            quantity: 'spectral-radiance-solid-angle-integral',
            units: 'W m^-2 nm^-1',
            values: composition.componentSpectralRadianceSolidAngleIntegrals,
            independentResiduals: totalRetentionResiduals,
            maximumAbsoluteRetentionResidual: maximumAbsoluteTotalRetentionResidual,
        }),
        accepted: true,
    });
}

function indexPixels(pixels, camera, label) {
    const result = new Map();
    for (const pixel of pixels) {
        validatePixelCoordinate(pixel?.pixelX, pixel?.pixelY, camera, label);
        const key = pixelKey(pixel.pixelX, pixel.pixelY);
        if (result.has(key)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_PIXEL_DUPLICATE',
                `The ${label} duplicates pixel ${key}.`);
        }
        result.set(key, pixel);
    }
    return result;
}

function indexContributionPixels(pixels, camera, label, valuesField) {
    const result = new Map();
    for (const pixel of pixels) {
        validatePixelCoordinate(pixel?.pixelX, pixel?.pixelY, camera, label);
        const key = pixelKey(pixel.pixelX, pixel.pixelY);
        if (result.has(key)) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_CONTRIBUTION_PIXEL_DUPLICATE',
                `The ${label} contribution duplicates pixel ${key}.`);
        }
        result.set(key, validateSpectrum(pixel?.[valuesField], `${label} contribution`, false));
    }
    return result;
}

function compareComponentTotals(actual, expected, basisFingerprint) {
    const residuals = {};
    for (const componentName of Object.keys(expected)) {
        const packet = actual?.[componentName];
        if (
            packet?.quantity !== 'spectral-radiance-solid-angle-integral'
            || packet?.units !== 'W m^-2 nm^-1'
            || packet?.basisFingerprint !== basisFingerprint
        ) {
            throw configurationError('ER4C_FULL_FRAME_CLOSURE_COMPONENT_TOTAL_INVALID',
                `The ${componentName} total lacks the required typed integral packet.`);
        }
        residuals[componentName] = Object.freeze(subtractSpectra(
            validateSpectrum(packet.values, `${componentName} total`, false),
            expected[componentName],
        ));
    }
    return Object.freeze(residuals);
}

function createZeroTotals() {
    return {
        path: Array(CHANNEL_COUNT).fill(0),
        transportedEndpoint: Array(CHANNEL_COUNT).fill(0),
        extended: Array(CHANNEL_COUNT).fill(0),
        point: Array(CHANNEL_COUNT).fill(0),
        final: Array(CHANNEL_COUNT).fill(0),
    };
}

function accumulateTotals(totals, solidAngle, components) {
    if (!Number.isFinite(solidAngle) || solidAngle <= 0) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_PIXEL_SOLID_ANGLE_INVALID',
            'Composed pixels must retain positive finite solid angle.');
    }
    for (const [componentName, values] of Object.entries(components)) {
        for (let channelIndex = 0; channelIndex < CHANNEL_COUNT; channelIndex += 1) {
            totals[componentName][channelIndex] += values[channelIndex] * solidAngle;
        }
    }
}

function incrementNonzeroCounts(counts, components) {
    for (const [componentName, values] of Object.entries(components)) {
        if (hasNonzeroValue(values)) {
            counts[componentName] += 1;
        }
    }
}

function maximumFrameScale(pixels) {
    return Math.max(
        1,
        ...pixels.map((pixel) => maximumAbsoluteValue(pixel.finalSpectralRadianceDensity)),
    );
}

function validateRadiancePacket(packet, basisFingerprint, label) {
    if (
        packet?.quantity !== RADIANCE_QUANTITY
        || packet?.units !== RADIANCE_UNITS
        || packet?.basisFingerprint !== basisFingerprint
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_RADIANCE_PACKET_INVALID',
            `The ${label} packet must retain typed aligned spectral radiance density.`);
    }
    return validateSpectrum(packet.values, label, false);
}

function validateTransmittancePacket(packet, basisFingerprint) {
    if (
        packet?.quantity !== 'spectral-transmittance'
        || packet?.units !== '1'
        || packet?.basisFingerprint !== basisFingerprint
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_TRANSMITTANCE_PACKET_INVALID',
            'Base-frame view transmittance must retain a typed aligned packet.');
    }
    const values = validateSpectrum(packet.values, 'base transmittance', false);
    if (values.some((value) => value > 1)) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_TRANSMITTANCE_RANGE_INVALID',
            'Base-frame transmittance values must remain in [0, 1].');
    }
    return values;
}

function validateSpectrum(values, label, allowNegative) {
    if (
        !Array.isArray(values)
        || values.length !== CHANNEL_COUNT
        || !values.every(Number.isFinite)
        || (!allowNegative && values.some((value) => value < 0))
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_SPECTRUM_INVALID',
            `${label} must contain 15 finite${allowNegative ? '' : ' nonnegative'} values.`);
    }
    return values;
}

function validatePixelCoordinate(pixelX, pixelY, camera, label) {
    if (
        !Number.isSafeInteger(pixelX)
        || !Number.isSafeInteger(pixelY)
        || pixelX < 0
        || pixelX >= camera.widthPixels
        || pixelY < 0
        || pixelY >= camera.heightPixels
    ) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_PIXEL_COORDINATE_INVALID',
            `The ${label} pixel coordinate must lie inside the closure camera.`, {
                pixelX,
                pixelY,
            });
    }
}

function addSpectra(left, right) {
    return left.map((value, channelIndex) => value + right[channelIndex]);
}

function subtractSpectra(left, right) {
    return left.map((value, channelIndex) => value - right[channelIndex]);
}

function maximumAbsoluteResidual(left, right) {
    return Math.max(...left.map((value, channelIndex) =>
        Math.abs(value - right[channelIndex])));
}

function maximumAbsoluteValue(values) {
    return Math.max(...values.map(Math.abs));
}

function hasNonzeroValue(values) {
    return values.some((value) => value !== 0);
}

function arraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function zeroSpectrum() {
    return Array(CHANNEL_COUNT).fill(0);
}

function pixelKey(pixelX, pixelY) {
    return `${pixelX},${pixelY}`;
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_FULL_FRAME_CLOSURE_FIELD_UNSUPPORTED',
            `Unsupported ${context} fields are prohibited.`, { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
