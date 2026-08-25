// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER2 executable expansion.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { createAnalyticExtendedRadianceDensity } from '../external-celestial-sources/createAnalyticExtendedRadianceDensity.js';
import { createCalspecSiriusIrradianceDensity } from '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from '../external-celestial-sources/fixtureManifest.js';
import GaiaPassbandReader from '../external-celestial-sources/GaiaPassbandReader.js';
import SpectralDensityBasis from '../external-celestial-sources/SpectralDensityBasis.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    POINT_CELESTIAL_SOURCE,
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_IRRADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import { syntheticAbPhotometryFromBinnedDensity } from '../external-celestial-sources/syntheticAbPhotometry.js';
import BilinearPointResponse from '../point-source-raster/BilinearPointResponse.js';
import PointSourceRasterizer from '../point-source-raster/PointSourceRasterizer.js';
import { stableHash } from '../provenance/stableHash.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'er2PointSourceConservation';
const recordDirectory = parseRecordDirectory(process.argv);
const fixtureDirectory = resolve(
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures',
);
const commandText = `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`;
const tolerances = Object.freeze({
    rasterRoundTripAbsolutePixels: 1e-12,
    directionRoundTripAbsoluteRadians: 1e-12,
    pixelSolidAngleAbsoluteSteradians: 1e-15,
    pixelSolidAngleRelative: 1e-12,
    frustumSolidAngleAbsoluteSteradians: 1e-12,
    responseNormalizationAbsolute: 1e-15,
    responseSignatureAbsolute: 1e-15,
    fluxAbsoluteFloor: 1e-30,
    fluxRelative: 1e-12,
    magnitudeRatioRelative: 1e-12,
    passbandMagnitudeAbsolute: 1e-10,
});

await createFreshRecordDirectory(recordDirectory);

try {
    await execute();
} catch (error) {
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        runner: runnerName,
        error: serializeError(error),
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        er2Status: 'invalid-attempt',
        nextPhase: 'ER2 correction in a fresh record',
        imageCount: 0,
    });
    await appendRunLog(recordDirectory, `${runnerName} invalid: ${error.message}`);
    throw error;
}

async function execute() {
    await writeText(recordDirectory, 'state-goal.md', `# State Goal

Accept ER2 unresolved point-source conservation before atmosphere and display.
Use exact perspective-pixel solid angles, an explicitly ideal normalized
bilinear reconstruction response, reported off-raster loss, and
L_lambda,i = F_lambda p_i / Omega_i. Prove conservation over resolution, FOV,
field position, subpixel placement, edges, overlapping sources, and declared
magnitude ratios. Do not use coverage, opacity, a fixed solid-angle divisor, an
authored stellar disk, source exposure, atmosphere, display, or image output.
`);
    await writeJson(recordDirectory, 'command.json', {
        commands: [{ command: commandText, timestamp: nowIso() }],
    });
    await writeJson(recordDirectory, 'inputs.json', {
        stage: 'ER2-point-source-conservation-reference',
        runner: runnerName,
        acceptedSourceRecord:
            'tmp/atmosphere/reconciliation/033-er1-typed-celestial-sources-contract',
        tolerances,
        cameraMatrix: cameraConfigurations(),
        placementKinds: [
            'optical-axis',
            'integer-center',
            'subpixel-a',
            'subpixel-b',
            'near-left-edge',
            'exact-left-edge',
            'exact-right-edge',
            'exact-top-edge',
            'exact-bottom-edge',
            'corner-adjacent',
            'exact-top-left-corner',
            'outside-left',
            'full-off-left-cutoff',
            'independent-direction',
        ],
        prohibited: [
            'atmosphere',
            'display',
            'image',
            'coverage or opacity point weight',
            'fixed pixel solid angle',
            'authored star disk',
            'source-specific exposure',
        ],
    });

    const basis = createCanonicalSpectralDensityBasis();
    const fixtureBytes = await readAndVerifySourceFixtures();
    const sirius = createCalspecSiriusIrradianceDensity(fixtureBytes.sirius, basis);
    const gaia = new GaiaPassbandReader().read(fixtureBytes.gaia);
    const analyticPointPacket = createAnalyticPointIrradianceDensity(basis);
    await retainSourcePayload();
    const response = new BilinearPointResponse();
    const responseSignatures = diagnoseResponseSignatures(response);

    const solidAngleMatrix = [];
    const pointMatrix = [];
    for (const configuration of cameraConfigurations()) {
        const camera = new PerspectiveCameraRaster(configuration);
        const solidAngles = auditCameraSolidAngles(camera);
        solidAngleMatrix.push(solidAngles);
        const rasterizer = new PointSourceRasterizer({ camera, response });
        for (const placement of placementsForCamera(camera)) {
            const direction = placement.independentDirection
                ?? camera.rasterCenterToDirection(placement.rasterX, placement.rasterY);
            const roundTrip = camera.directionToRasterCenter(direction);
            for (const source of [
                { kind: 'calspec-sirius', packet: sirius.packet },
                { kind: 'analytic-pattern', packet: analyticPointPacket },
            ]) {
                const pointSource = createPointSource(
                    `${source.kind}-${configuration.id}-${placement.id}`,
                    source.packet,
                );
                const result = rasterizer.rasterize({
                    source: pointSource,
                    sourceDirectionCamera: direction,
                });
                pointMatrix.push(diagnosePointCase({
                    camera,
                    sourceKind: source.kind,
                    placement,
                    direction,
                    roundTrip,
                    result,
                }));
            }
        }
    }

    const additivity = diagnoseAdditivity({ basis, siriusPacket: sirius.packet, response });
    const magnitudeRatios = diagnoseMagnitudeRatios({
        basis,
        siriusPacket: sirius.packet,
        response,
        gaia,
    });
    const negativeCases = exerciseNegativeCases({
        basis,
        siriusPacket: sirius.packet,
        response,
    });

    const allPixelSolidAnglesPass = solidAngleMatrix.every((camera) =>
        camera.pixels.every((pixel) => pixel.status === 'accepted'));
    const allFrustaPass = solidAngleMatrix.every((camera) =>
        camera.frustumStatus === 'accepted');
    const allRoundTripsPass = pointMatrix.every((entry) =>
        entry.roundTripStatus === 'accepted');
    const allResponsesPass = pointMatrix.every((entry) =>
        entry.responseStatus === 'accepted');
    const allFluxPass = pointMatrix.every((entry) =>
        entry.fluxStatus === 'accepted');
    const opticalAxisSignaturePass = pointMatrix
        .filter((entry) => entry.sourceKind === 'analytic-pattern'
            && entry.placement.id === 'optical-axis')
        .every((entry) => {
            const evenRaster = entry.camera.widthPixels % 2 === 0
                && entry.camera.heightPixels % 2 === 0;
            const expectedCount = evenRaster ? 4 : 1;
            const expectedWeight = evenRaster ? 0.25 : 1;
            return entry.result.response.destinations.length === expectedCount
                && entry.result.response.destinations.every((destination) =>
                    Math.abs(destination.weight - expectedWeight)
                        <= tolerances.responseSignatureAbsolute);
        });
    const edgeCases = pointMatrix.filter((entry) => entry.result.response.offRasterWeight > 0);
    const edgeAccountingPass = edgeCases.length > 0 && edgeCases.every((entry) =>
        entry.result.response.onFrameWeight < 1
        && Math.abs(entry.result.response.onFrameWeight
            + entry.result.response.offRasterWeight - 1)
            <= tolerances.responseNormalizationAbsolute
        && entry.fluxStatus === 'accepted');

    const criteria = Object.freeze([
        criterion('every-perspective-pixel-solid-angle-matches-independent-reference',
            allPixelSolidAnglesPass),
        criterion('summed-pixel-solid-angle-matches-analytic-frustum', allFrustaPass),
        criterion('direction-and-raster-coordinate-round-trips-pass', allRoundTripsPass),
        criterion('known-cardinal-bilinear-weight-signatures-pass',
            responseSignatures.every((entry) => entry.status === 'accepted')),
        criterion('optical-axis-even-and-odd-raster-signatures-pass',
            opticalAxisSignaturePass),
        criterion('bilinear-full-response-is-nonnegative-and-normalized', allResponsesPass),
        criterion('on-frame-plus-off-raster-response-is-one-without-renormalization',
            edgeAccountingPass),
        criterion('every-point-case-reconstructs-each-source-channel', allFluxPass),
        criterion('accounted-flux-is-invariant-across-resolution-fov-field-and-subpixel',
            allFluxPass && pointMatrix.length === cameraConfigurations().length * 14 * 2),
        criterion('overlapping-point-sources-add-linearly', additivity.status === 'accepted'),
        criterion('declared-magnitude-flux-ratios-pass',
            magnitudeRatios.every((entry) => entry.status === 'accepted')),
        criterion('point-raster-path-uses-exact-omega-not-fixed-divisor',
            pointMatrix.every((entry) => entry.result.pixels.every((pixel) =>
                pixel.solidAngleSteradians === entry.cameraPixelSolidAngles[`${pixel.pixelX},${pixel.pixelY}`]))),
        criterion('point-response-never-uses-coverage-opacity-or-authored-disks',
            !response.describe().support.includes('angular disk')
            && response.describe().edgePolicy.includes('never renormalize')),
        criterion('all-invalid-cases-fail-with-predeclared-error-codes',
            negativeCases.every((entry) => entry.status === 'accepted')),
        criterion('er2-produced-no-atmosphere-display-or-image', true),
    ]);
    const status = criteria.every((entry) => entry.status === 'accepted')
        ? 'accepted'
        : 'rejected';

    const codeFiles = [
        `scripts/flat/reconciliation/POC/src/runners/${runnerName}.js`,
        'scripts/flat/reconciliation/POC/src/camera/PerspectiveCameraRaster.js',
        'scripts/flat/reconciliation/POC/src/point-source-raster/BilinearPointResponse.js',
        'scripts/flat/reconciliation/POC/src/point-source-raster/PointSourceRasterizer.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/ExternalCelestialSource.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityPacket.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCalspecSiriusIrradianceDensity.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/GaiaPassbandReader.js',
    ];
    const sourceContentHashes = Object.fromEntries(await Promise.all(
        codeFiles.map(async (path) => [path, sha256Bytes(await readFile(path))]),
    ));
    await writeJson(recordDirectory, 'provenance.json', {
        sourceContentHashes,
        sourceFixtures: {
            sirius: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec,
            gaiaPassband: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.gaiaEdr3PassbandsV2,
        },
        sourcePacketFingerprint: sirius.packet.fingerprint,
        analyticPointPacketFingerprint: analyticPointPacket.fingerprint,
        basisFingerprint: basis.fingerprint,
        responseFingerprint: response.fingerprint,
        governingDesign:
            'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md',
        governingPlan:
            'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md',
    });
    await writeJson(recordDirectory, 'contract-descriptors.json', {
        basis: basis.describe(),
        siriusSource: sirius.packet.describe(),
        analyticPointSource: analyticPointPacket.describe(),
        response: response.describe(),
        equation: 'L_lambda,i = F_lambda * p_i / Omega_i',
        conservation:
            'sum_on_frame(L_lambda,i * Omega_i) + F_lambda * p_off_raster = F_lambda',
        operationBoundary:
            'No visibility or atmosphere in ER2; exact-direction visibility/transmittance precedes this response in ER4.',
    });
    await writeJson(recordDirectory, 'camera-solid-angles.json', solidAngleMatrix);
    await writeJson(recordDirectory, 'response-signatures.json', responseSignatures);
    await writeJson(recordDirectory, 'point-invariance-matrix.json', pointMatrix);
    await writeJson(recordDirectory, 'point-additivity.json', additivity);
    await writeJson(recordDirectory, 'magnitude-ratios.json', magnitudeRatios);
    await writeJson(recordDirectory, 'negative-cases.json', negativeCases);
    await writeJson(recordDirectory, 'criteria-results.json', {
        status,
        mechanicalStatus: status,
        physicalConservationStatus: status,
        observationalStatus: 'not-applicable',
        humanReviewStatus: 'not-applicable',
        criteria,
    });
    await writeJson(recordDirectory, 'result.json', {
        status,
        er2Status: status,
        acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        cameraCount: solidAngleMatrix.length,
        pointCaseCount: pointMatrix.length,
        edgeCaseCount: edgeCases.length,
        sourceGate: status === 'accepted'
            ? 'XA-G03 through XA-G05 accepted for point raster reference; XA-G02 real geometry not claimed'
            : 'not accepted',
        nextPhase: status === 'accepted'
            ? 'ER3 extended-source conservation reference'
            : 'ER2 correction in a fresh record',
        imageCount: 0,
    });
    await writeText(recordDirectory, 'report.md', reportMarkdown({
        status,
        criteria,
        solidAngleMatrix,
        pointMatrix,
        additivity,
        magnitudeRatios,
    }));
    await appendRunLog(recordDirectory,
        `${runnerName} ${status}; point conservation ${status}; no image output.`);
    console.log(JSON.stringify({
        status,
        er2Status: status,
        recordDirectory,
        acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        pointCaseCount: pointMatrix.length,
        nextPhase: status === 'accepted' ? 'ER3' : 'ER2-correction',
    }));
}

function cameraConfigurations() {
    const resolutions = [
        { id: 'square-64', widthPixels: 64, heightPixels: 64 },
        { id: 'landscape-128x96', widthPixels: 128, heightPixels: 96 },
        { id: 'wide-257x129', widthPixels: 257, heightPixels: 129 },
    ];
    const fovs = [10, 60, 100];
    return Object.freeze(resolutions.flatMap((resolution) => fovs.map((verticalFovDegrees) =>
        Object.freeze({
            id: `${resolution.id}-vfov-${verticalFovDegrees}`,
            widthPixels: resolution.widthPixels,
            heightPixels: resolution.heightPixels,
            verticalFovDegrees,
        }))));
}

function placementsForCamera(camera) {
    const centerX = (camera.widthPixels - 1) / 2;
    const centerY = (camera.heightPixels - 1) / 2;
    const independentDirection = normalizeVector([0.02, -0.015, -1]);
    const independentRaster = independentlyProjectDirection(camera, independentDirection);
    return Object.freeze([
        Object.freeze({ id: 'optical-axis', rasterX: centerX, rasterY: centerY }),
        Object.freeze({ id: 'integer-center', rasterX: Math.floor(centerX), rasterY: Math.floor(centerY) }),
        Object.freeze({
            id: 'subpixel-a',
            rasterX: (camera.widthPixels - 1) * 0.31 + 0.23,
            rasterY: (camera.heightPixels - 1) * 0.43 + 0.17,
        }),
        Object.freeze({
            id: 'subpixel-b',
            rasterX: (camera.widthPixels - 1) * 0.76 + 0.61,
            rasterY: (camera.heightPixels - 1) * 0.22 + 0.37,
        }),
        Object.freeze({ id: 'near-left-edge', rasterX: -0.25, rasterY: centerY + 0.2 }),
        Object.freeze({ id: 'exact-left-edge', rasterX: -0.5, rasterY: centerY + 0.1 }),
        Object.freeze({
            id: 'exact-right-edge',
            rasterX: camera.widthPixels - 0.5,
            rasterY: centerY - 0.3,
        }),
        Object.freeze({ id: 'exact-top-edge', rasterX: centerX + 0.1, rasterY: -0.5 }),
        Object.freeze({
            id: 'exact-bottom-edge',
            rasterX: centerX - 0.2,
            rasterY: camera.heightPixels - 0.5,
        }),
        Object.freeze({ id: 'corner-adjacent', rasterX: -0.25, rasterY: -0.25 }),
        Object.freeze({ id: 'exact-top-left-corner', rasterX: -0.5, rasterY: -0.5 }),
        Object.freeze({ id: 'outside-left', rasterX: -0.75, rasterY: centerY }),
        Object.freeze({ id: 'full-off-left-cutoff', rasterX: -1, rasterY: centerY }),
        Object.freeze({
            id: 'independent-direction',
            rasterX: independentRaster.x,
            rasterY: independentRaster.y,
            independentDirection,
        }),
    ]);
}

function diagnoseResponseSignatures(response) {
    const cases = [
        {
            id: 'integer-center',
            rasterX: 2,
            rasterY: 3,
            expectedWeights: { '2,3': 1 },
            expectedOnFrameWeight: 1,
        },
        {
            id: 'half-half',
            rasterX: 2.5,
            rasterY: 3.5,
            expectedWeights: { '2,3': 0.25, '2,4': 0.25, '3,3': 0.25, '3,4': 0.25 },
            expectedOnFrameWeight: 1,
        },
        {
            id: 'quarter-asymmetric',
            rasterX: 2.25,
            rasterY: 3.75,
            expectedWeights: { '2,3': 0.1875, '2,4': 0.5625, '3,3': 0.0625, '3,4': 0.1875 },
            expectedOnFrameWeight: 1,
        },
        { id: 'inside-left-quarter', rasterX: -0.25, rasterY: 3, expectedOnFrameWeight: 0.75 },
        { id: 'exact-left-boundary', rasterX: -0.5, rasterY: 3, expectedOnFrameWeight: 0.5 },
        { id: 'outside-left-quarter', rasterX: -0.75, rasterY: 3, expectedOnFrameWeight: 0.25 },
        { id: 'left-cutoff', rasterX: -1, rasterY: 3, expectedOnFrameWeight: 0 },
        { id: 'exact-right-boundary', rasterX: 9.5, rasterY: 3, expectedOnFrameWeight: 0.5 },
        { id: 'exact-top-boundary', rasterX: 3, rasterY: -0.5, expectedOnFrameWeight: 0.5 },
        { id: 'exact-bottom-boundary', rasterX: 3, rasterY: 9.5, expectedOnFrameWeight: 0.5 },
        { id: 'exact-top-left-corner', rasterX: -0.5, rasterY: -0.5, expectedOnFrameWeight: 0.25 },
        { id: 'exact-bottom-right-corner', rasterX: 9.5, rasterY: 9.5, expectedOnFrameWeight: 0.25 },
        { id: 'outside-top-left-quarter', rasterX: -0.75, rasterY: -0.75, expectedOnFrameWeight: 0.0625 },
    ];
    return Object.freeze(cases.map((entry) => {
        const result = response.resolve({
            rasterX: entry.rasterX,
            rasterY: entry.rasterY,
            widthPixels: 10,
            heightPixels: 10,
        });
        const actualWeights = Object.fromEntries(result.destinations.map((destination) => [
            `${destination.pixelX},${destination.pixelY}`,
            destination.weight,
        ]));
        const keys = new Set([
            ...Object.keys(entry.expectedWeights ?? {}),
            ...Object.keys(actualWeights),
        ]);
        const maximumWeightAbsoluteError = entry.expectedWeights
            ? Math.max(...[...keys].map((key) => Math.abs(
                (actualWeights[key] ?? 0) - (entry.expectedWeights[key] ?? 0),
            )))
            : 0;
        const onFrameWeightAbsoluteError = Math.abs(
            result.onFrameWeight - entry.expectedOnFrameWeight,
        );
        return Object.freeze({
            ...entry,
            result,
            actualWeights,
            maximumWeightAbsoluteError,
            onFrameWeightAbsoluteError,
            status:
                maximumWeightAbsoluteError <= tolerances.responseSignatureAbsolute
                && onFrameWeightAbsoluteError <= tolerances.responseSignatureAbsolute
                    ? 'accepted'
                    : 'rejected',
        });
    }));
}

function auditCameraSolidAngles(camera) {
    const pixels = [];
    let summedSolidAngleSteradians = 0;
    let sumCompensation = 0;
    let maximumAbsoluteErrorSteradians = 0;
    for (let pixelY = 0; pixelY < camera.heightPixels; pixelY += 1) {
        for (let pixelX = 0; pixelX < camera.widthPixels; pixelX += 1) {
            const actual = camera.pixelSolidAngleSteradians(pixelX, pixelY);
            const independentBounds = independentPixelProjectionBounds(camera, pixelX, pixelY);
            const reference = gnomonicRectangleSolidAngle(independentBounds);
            const absoluteError = Math.abs(actual - reference);
            const tolerance = tolerances.pixelSolidAngleAbsoluteSteradians
                + tolerances.pixelSolidAngleRelative * Math.abs(reference);
            maximumAbsoluteErrorSteradians = Math.max(maximumAbsoluteErrorSteradians, absoluteError);
            const compensatedValue = actual - sumCompensation;
            const nextSum = summedSolidAngleSteradians + compensatedValue;
            sumCompensation = (nextSum - summedSolidAngleSteradians) - compensatedValue;
            summedSolidAngleSteradians = nextSum;
            pixels.push(Object.freeze({
                pixelX,
                pixelY,
                solidAngleSteradians: actual,
                independentReferenceSteradians: reference,
                independentProjectionBounds: independentBounds,
                absoluteErrorSteradians: absoluteError,
                toleranceSteradians: tolerance,
                status: absoluteError <= tolerance ? 'accepted' : 'rejected',
            }));
        }
    }
    const analyticFrustumSolidAngleSteradians = camera.analyticFrustumSolidAngleSteradians();
    const frustumAbsoluteErrorSteradians = Math.abs(
        summedSolidAngleSteradians - analyticFrustumSolidAngleSteradians,
    );
    const cornerRays = [
        camera.cornerRay(0, 0),
        camera.cornerRay(camera.widthPixels, 0),
        camera.cornerRay(camera.widthPixels, camera.heightPixels),
        camera.cornerRay(0, camera.heightPixels),
    ];
    const cornerRayInvariantsPass = cornerRays.every((ray) =>
        Math.abs(Math.hypot(...ray) - 1) <= 1e-12 && ray[2] < 0);
    const topLeftBounds = independentPixelProjectionBounds(camera, 0, 0);
    const bottomRightBounds = independentPixelProjectionBounds(
        camera,
        camera.widthPixels - 1,
        camera.heightPixels - 1,
    );
    const projectionSymmetryPass = Math.abs(topLeftBounds.left + bottomRightBounds.right) <= 1e-15
        && Math.abs(topLeftBounds.right + bottomRightBounds.left) <= 1e-15
        && Math.abs(topLeftBounds.top + bottomRightBounds.bottom) <= 1e-15
        && Math.abs(topLeftBounds.bottom + bottomRightBounds.top) <= 1e-15;
    const cameraInvariantsPass = cornerRayInvariantsPass && projectionSymmetryPass;
    return Object.freeze({
        camera: camera.describe(),
        cameraFingerprint: camera.fingerprint,
        pixels: Object.freeze(pixels),
        summedSolidAngleSteradians,
        analyticFrustumSolidAngleSteradians,
        frustumAbsoluteErrorSteradians,
        maximumPixelAbsoluteErrorSteradians: maximumAbsoluteErrorSteradians,
        sumMethod: 'Kahan compensated summation',
        cornerRays: Object.freeze(cornerRays),
        cornerRayInvariantsPass,
        projectionSymmetryPass,
        cameraInvariantsPass,
        frustumStatus: frustumAbsoluteErrorSteradians
            <= tolerances.frustumSolidAngleAbsoluteSteradians
            && cameraInvariantsPass ? 'accepted' : 'rejected',
    });
}

function independentPixelProjectionBounds(camera, pixelX, pixelY) {
    const halfHeight = Math.tan(camera.verticalFovDegrees * Math.PI / 360);
    const halfWidth = halfHeight * camera.widthPixels / camera.heightPixels;
    return Object.freeze({
        left: (2 * pixelX / camera.widthPixels - 1) * halfWidth,
        right: (2 * (pixelX + 1) / camera.widthPixels - 1) * halfWidth,
        top: (1 - 2 * pixelY / camera.heightPixels) * halfHeight,
        bottom: (1 - 2 * (pixelY + 1) / camera.heightPixels) * halfHeight,
    });
}

function gnomonicRectangleSolidAngle(bounds) {
    const primitive = (x, y) => Math.atan2(x * y, Math.sqrt(1 + x * x + y * y));
    return Math.abs(
        primitive(bounds.right, bounds.top)
        - primitive(bounds.left, bounds.top)
        - primitive(bounds.right, bounds.bottom)
        + primitive(bounds.left, bounds.bottom),
    );
}

function diagnosePointCase({ camera, sourceKind, placement, direction, roundTrip, result }) {
    const roundTripErrorX = Math.abs(roundTrip.x - placement.rasterX);
    const roundTripErrorY = Math.abs(roundTrip.y - placement.rasterY);
    const reconstructedDirection = camera.rasterCenterToDirection(roundTrip.x, roundTrip.y);
    const directionRoundTripAngularErrorRadians = angularSeparation(
        direction,
        reconstructedDirection,
    );
    const responseNonnegative = result.response.destinations.every((entry) => entry.weight >= 0);
    const responseResidual = Math.max(
        Math.abs(result.response.normalizationResidual),
        Math.abs(result.response.accountingResidual),
    );
    const fluxChecks = result.residual.map((residual, index) => {
        const sourceValue = result.sourceSpectralIrradiance.values[index];
        const tolerance = tolerances.fluxAbsoluteFloor
            + tolerances.fluxRelative * Math.abs(sourceValue);
        return Object.freeze({
            channelIndex: index,
            sourceValue,
            accountedValue: result.accountedIrradiance[index],
            residual,
            tolerance,
            status: Math.abs(residual) <= tolerance ? 'accepted' : 'rejected',
        });
    });
    const cameraPixelSolidAngles = Object.fromEntries(result.pixels.map((pixel) => [
        `${pixel.pixelX},${pixel.pixelY}`,
        camera.pixelSolidAngleSteradians(pixel.pixelX, pixel.pixelY),
    ]));
    return Object.freeze({
        cameraId: cameraConfigurations().find((entry) =>
            entry.widthPixels === camera.widthPixels
            && entry.heightPixels === camera.heightPixels
            && entry.verticalFovDegrees === camera.verticalFovDegrees)?.id ?? camera.fingerprint,
        camera: camera.describe(),
        sourceKind,
        placement,
        direction,
        roundTrip,
        roundTripErrorX,
        roundTripErrorY,
        reconstructedDirection,
        directionRoundTripAngularErrorRadians,
        roundTripStatus:
            roundTripErrorX <= tolerances.rasterRoundTripAbsolutePixels
            && roundTripErrorY <= tolerances.rasterRoundTripAbsolutePixels
            && directionRoundTripAngularErrorRadians
                <= tolerances.directionRoundTripAbsoluteRadians
                ? 'accepted'
                : 'rejected',
        responseStatus:
            responseNonnegative
            && responseResidual <= tolerances.responseNormalizationAbsolute
                ? 'accepted'
                : 'rejected',
        fluxChecks: Object.freeze(fluxChecks),
        fluxStatus: fluxChecks.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        cameraPixelSolidAngles: Object.freeze(cameraPixelSolidAngles),
        result,
    });
}

function diagnoseAdditivity({ basis, siriusPacket, response }) {
    const camera = new PerspectiveCameraRaster({
        widthPixels: 128,
        heightPixels: 96,
        verticalFovDegrees: 60,
    });
    const rasterizer = new PointSourceRasterizer({ camera, response });
    const secondPacket = scalePacket(siriusPacket, 0.37, 'er2-additivity-second-source');
    const scenarioDefinitions = [
        {
            id: 'same-direction-unequal-spectra',
            positions: [[63.25, 47.75], [63.25, 47.75]],
        },
        {
            id: 'partially-overlapping-four-tap-responses',
            positions: [[63.2, 47.4], [63.7, 47.8]],
        },
        {
            id: 'edge-plus-interior',
            positions: [[-0.5, 40.25], [0.2, 40.7]],
        },
    ];
    const scenarios = scenarioDefinitions.map((definition) => {
        const points = definition.positions.map(([rasterX, rasterY], index) => ({
            source: createPointSource(
                `${definition.id}-${index}`,
                index === 0 ? siriusPacket : secondPacket,
            ),
            sourceDirectionCamera: camera.rasterCenterToDirection(rasterX, rasterY),
        }));
        const forward = diagnoseAdditiveBatch(
            rasterizer.rasterizeMany({ points }),
            basis.channels.length,
        );
        const reverse = diagnoseAdditiveBatch(
            rasterizer.rasterizeMany({ points: [...points].reverse() }),
            basis.channels.length,
        );
        const orderChecks = compareAdditivePixelFrames(forward.result.pixels, reverse.result.pixels);
        return Object.freeze({
            id: definition.id,
            status: forward.status === 'accepted'
                && reverse.status === 'accepted'
                && orderChecks.every((entry) => entry.status === 'accepted')
                ? 'accepted'
                : 'rejected',
            points: points.map((point) => ({
                sourceId: point.source.id,
                direction: point.sourceDirectionCamera,
                packetFingerprint: point.source.spectralMeasure.fingerprint,
            })),
            forward,
            reverse,
            orderChecks,
        });
    });
    return Object.freeze({
        status: scenarios.every((scenario) => scenario.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        camera: camera.describe(),
        scenarios: Object.freeze(scenarios),
    });
}

function diagnoseAdditiveBatch(result, channelCount) {
    const checks = result.residual.map((residual, index) => {
        const tolerance = tolerances.fluxAbsoluteFloor
            + tolerances.fluxRelative * Math.abs(result.inputIrradiance[index]);
        return Object.freeze({
            channelIndex: index,
            input: result.inputIrradiance[index],
            accounted: result.accountedIrradiance[index],
            residual,
            tolerance,
            status: Math.abs(residual) <= tolerance ? 'accepted' : 'rejected',
        });
    });
    const independentPixels = independentlySumSourcePixels(result.sources, channelCount);
    const pixelChecks = result.pixels.map((pixel) => {
        const expected = independentPixels.get(`${pixel.pixelX},${pixel.pixelY}`);
        const channelChecks = pixel.spectralRadianceDensity.map((value, index) => {
            const absoluteError = Math.abs(value - expected[index]);
            const tolerance = tolerances.fluxAbsoluteFloor
                + tolerances.fluxRelative * Math.abs(expected[index]);
            return Object.freeze({ channelIndex: index, absoluteError, tolerance });
        });
        return Object.freeze({
            pixelX: pixel.pixelX,
            pixelY: pixel.pixelY,
            channelChecks: Object.freeze(channelChecks),
            status: channelChecks.every((entry) => entry.absoluteError <= entry.tolerance)
                ? 'accepted'
                : 'rejected',
        });
    });
    return Object.freeze({
        status: checks.every((entry) => entry.status === 'accepted')
            && pixelChecks.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        checks: Object.freeze(checks),
        pixelChecks: Object.freeze(pixelChecks),
        result,
    });
}

function compareAdditivePixelFrames(firstPixels, secondPixels) {
    const first = new Map(firstPixels.map((pixel) => [`${pixel.pixelX},${pixel.pixelY}`, pixel]));
    const second = new Map(secondPixels.map((pixel) => [`${pixel.pixelX},${pixel.pixelY}`, pixel]));
    const keys = new Set([...first.keys(), ...second.keys()]);
    return Object.freeze([...keys].map((key) => {
        const a = first.get(key);
        const b = second.get(key);
        if (!a || !b) {
            return Object.freeze({ key, status: 'rejected', reason: 'pixel-set-mismatch' });
        }
        const channelChecks = a.spectralRadianceDensity.map((value, index) => {
            const absoluteError = Math.abs(value - b.spectralRadianceDensity[index]);
            const tolerance = tolerances.fluxAbsoluteFloor
                + tolerances.fluxRelative * Math.max(
                    Math.abs(value),
                    Math.abs(b.spectralRadianceDensity[index]),
                );
            return Object.freeze({ channelIndex: index, absoluteError, tolerance });
        });
        return Object.freeze({
            key,
            channelChecks: Object.freeze(channelChecks),
            status: channelChecks.every((entry) => entry.absoluteError <= entry.tolerance)
                ? 'accepted'
                : 'rejected',
        });
    }));
}

function diagnoseMagnitudeRatios({ siriusPacket, response, gaia }) {
    const camera = new PerspectiveCameraRaster({
        widthPixels: 257,
        heightPixels: 129,
        verticalFovDegrees: 10,
    });
    const rasterizer = new PointSourceRasterizer({ camera, response });
    const direction = camera.rasterCenterToDirection(128.31, 64.73);
    const base = rasterizer.rasterize({
        source: createPointSource('sirius-base', siriusPacket),
        sourceDirectionCamera: direction,
    });
    const passbandSupport = Object.freeze({ lowerNanometers: 360, upperNanometers: 830 });
    const basePhotometry = syntheticAbPhotometryFromBinnedDensity(
        siriusPacket,
        gaia,
        passbandSupport,
    );
    return Object.freeze([-5, -1, 0, 1, 2.5, 5].map((magnitudeDelta) => {
        const expectedRatio = 10 ** (-0.4 * magnitudeDelta);
        const scaledPacket = scalePacket(
            siriusPacket,
            expectedRatio,
            `er2-magnitude-delta-${magnitudeDelta}`,
        );
        const scaled = rasterizer.rasterize({
            source: createPointSource(`sirius-delta-${magnitudeDelta}`, scaledPacket),
            sourceDirectionCamera: direction,
        });
        const channelRatios = scaled.accountedIrradiance.map((value, index) =>
            value / base.accountedIrradiance[index]);
        const maximumRelativeError = Math.max(...channelRatios.map((ratio) =>
            relativeError(ratio, expectedRatio)));
        const scaledPhotometry = syntheticAbPhotometryFromBinnedDensity(
            scaledPacket,
            gaia,
            passbandSupport,
        );
        const recoveredMagnitudeDelta = scaledPhotometry.abMagnitude
            - basePhotometry.abMagnitude;
        const passbandMagnitudeAbsoluteError = Math.abs(
            recoveredMagnitudeDelta - magnitudeDelta,
        );
        return Object.freeze({
            magnitudeDelta,
            expectedRatio,
            channelRatios: Object.freeze(channelRatios),
            maximumRelativeError,
            passband: 'Gaia EDR3/DR3 G version 2 clipped to 360..830 nm',
            baseAbMagnitude: basePhotometry.abMagnitude,
            scaledAbMagnitude: scaledPhotometry.abMagnitude,
            recoveredMagnitudeDelta,
            passbandMagnitudeAbsoluteError,
            status: maximumRelativeError <= tolerances.magnitudeRatioRelative
                && passbandMagnitudeAbsoluteError <= tolerances.passbandMagnitudeAbsolute
                ? 'accepted'
                : 'rejected',
        });
    }));
}

function createAnalyticPointIrradianceDensity(basis) {
    const values = basis.channels.map((channel, index) => (index + 1) * 1e-12);
    const definition = {
        kind: 'unequal-channel-analytic-point-irradiance',
        values,
        basisFingerprint: basis.fingerprint,
    };
    return new SpectralDensityPacket({
        quantity: SPECTRAL_IRRADIANCE_DENSITY,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
        basis,
        values,
        provenance: {
            sourceId: 'er2-analytic-unequal-channel-point',
            sourceVersion: 'v1',
            sourceHashSha256: stableHash(definition),
            definition,
            claimBoundary: 'Analytic point-conservation fixture; not a physical star.',
        },
        uncertainty: {
            status: 'analytic-fixture',
            model: 'exact-authored-unequal-channel-values',
            values: basis.channels.map(() => 0),
        },
    });
}

function createPointSource(id, packet) {
    return new ExternalCelestialSource({
        id,
        kind: POINT_CELESTIAL_SOURCE,
        geometry: {
            kind: 'camera-direction-owned-by-er2-request',
            owner: 'ER2 analytic camera-local placement',
            epochGeometryClaim: 'none',
        },
        spectralMeasure: packet,
    });
}

function scalePacket(packet, scale, id) {
    const scaledUncertainty = {
        ...packet.uncertainty,
        values: packet.uncertainty.values?.map((value) => value * scale),
        systematicValues: packet.uncertainty.systematicValues?.map((value) => value * scale),
        notes: [...(packet.uncertainty.notes ?? []), `ER2 uniform scale ${scale}.`],
    };
    const derivation = {
        id,
        parentFingerprint: packet.fingerprint,
        scale,
        policy: 'uniform same-SED flux ratio fixture',
    };
    return new SpectralDensityPacket({
        quantity: packet.quantity,
        units: packet.units,
        basis: packet.basis,
        values: packet.values.map((value) => value * scale),
        provenance: {
            sourceId: id,
            sourceVersion: 'er2-derived-v1',
            sourceHashSha256: stableHash(derivation),
            derivation,
        },
        uncertainty: scaledUncertainty,
    });
}

function exerciseNegativeCases({ basis, siriusPacket, response }) {
    const camera = new PerspectiveCameraRaster({
        widthPixels: 16,
        heightPixels: 12,
        verticalFovDegrees: 45,
    });
    const rasterizer = new PointSourceRasterizer({ camera, response });
    const direction = camera.rasterCenterToDirection(7.3, 5.2);
    const extendedPacket = createAnalyticExtendedRadianceDensity(basis, 1);
    const alternateBasis = new SpectralDensityBasis({
        ...basis.describe(),
        quadrature: `${basis.quadrature}-negative-test`,
        provenance: { ...basis.provenance, negativeTest: true },
    });
    const alternatePacket = new SpectralDensityPacket({
        quantity: SPECTRAL_IRRADIANCE_DENSITY,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
        basis: alternateBasis,
        values: siriusPacket.values,
        provenance: {
            sourceId: 'alternate-basis-test',
            sourceVersion: 'v1',
            sourceHashSha256: stableHash({ id: 'alternate-basis-test' }),
        },
        uncertainty: { status: 'analytic-fixture', model: 'negative-test' },
    });
    const validSource = createPointSource('negative-valid-source', siriusPacket);
    const radianceSource = new ExternalCelestialSource({
        id: 'negative-radiance-source',
        kind: 'extended',
        geometry: { kind: 'ownership-only', owner: 'ER2 negative test' },
        spectralMeasure: extendedPacket,
    });
    return Object.freeze([
        expectedFailure('zero-camera-width', 'ER2_CAMERA_DIMENSION_INVALID', () =>
            new PerspectiveCameraRaster({ widthPixels: 0, heightPixels: 10, verticalFovDegrees: 45 })),
        expectedFailure('invalid-camera-fov', 'ER2_CAMERA_VERTICAL_FOV_INVALID', () =>
            new PerspectiveCameraRaster({ widthPixels: 10, heightPixels: 10, verticalFovDegrees: 180 })),
        expectedFailure('fractional-corner-coordinate', 'ER2_CAMERA_CORNER_COORDINATE_INVALID', () =>
            camera.cornerRay(0.5, 0)),
        expectedFailure('overflowing-raster-direction', 'ER2_CAMERA_DIRECTION_DERIVATION_INVALID', () =>
            camera.rasterCenterToDirection(Number.MAX_VALUE, 0)),
        expectedFailure('nonunit-camera-direction', 'ER2_CAMERA_DIRECTION_NOT_UNIT', () =>
            camera.directionToRasterCenter([0, 0, -2])),
        expectedFailure('nonforward-camera-direction', 'ER2_CAMERA_DIRECTION_NOT_FORWARD', () =>
            camera.directionToRasterCenter([0, 0, 1])),
        expectedFailure('invalid-response-coordinate', 'ER2_RESPONSE_RASTER_COORDINATE_INVALID', () =>
            response.resolve({ rasterX: Number.NaN, rasterY: 0, widthPixels: 10, heightPixels: 10 })),
        expectedFailure('unsafe-response-coordinate', 'ER2_RESPONSE_RASTER_COORDINATE_UNSAFE', () =>
            response.resolve({ rasterX: Number.MAX_SAFE_INTEGER, rasterY: 0, widthPixels: 10, heightPixels: 10 })),
        expectedFailure('response-coverage-field', 'ER2_RESPONSE_COVERAGE_FIELD_PROHIBITED', () =>
            response.resolve({ rasterX: 0, rasterY: 0, widthPixels: 10, heightPixels: 10, coverage: 1 })),
        expectedFailure('invalid-response-implementation', 'ER2_RASTERIZER_RESPONSE_REQUIRED', () =>
            new PointSourceRasterizer({ camera, response: { resolve() {} } })),
        expectedFailure('bare-array-source', 'ER2_RASTERIZER_TYPED_SOURCE_REQUIRED', () =>
            rasterizer.rasterize({
                source: siriusPacket.values,
                sourceDirectionCamera: direction,
            })),
        expectedFailure('radiance-packet-source', 'ER2_RASTERIZER_IRRADIANCE_REQUIRED', () =>
            rasterizer.rasterize({
                source: radianceSource,
                sourceDirectionCamera: direction,
            })),
        expectedFailure('rasterizer-coverage-field', 'ER2_RASTERIZER_COVERAGE_FIELD_PROHIBITED', () =>
            rasterizer.rasterize({
                source: validSource,
                sourceDirectionCamera: direction,
                opacity: 1,
            })),
        expectedFailure('duplicate-source-id', 'ER2_RASTERIZER_SOURCE_ID_DUPLICATE', () =>
            rasterizer.rasterizeMany({
                points: [
                    { source: createPointSource('duplicate', siriusPacket), sourceDirectionCamera: direction },
                    { source: createPointSource('duplicate', siriusPacket), sourceDirectionCamera: direction },
                ],
            })),
        expectedFailure('batch-basis-mismatch', 'ER2_RASTERIZER_SOURCE_BASIS_MISMATCH', () =>
            rasterizer.rasterizeMany({
                points: [
                    { source: createPointSource('basis-a', siriusPacket), sourceDirectionCamera: direction },
                    { source: createPointSource('basis-b', alternatePacket), sourceDirectionCamera: direction },
                ],
            })),
    ]);
}

function independentlySumSourcePixels(sources, channelCount) {
    const map = new Map();
    for (const source of sources) {
        for (const pixel of source.pixels) {
            const key = `${pixel.pixelX},${pixel.pixelY}`;
            const current = map.get(key) ?? Array(channelCount).fill(0);
            map.set(key, current.map((value, index) =>
                value + pixel.spectralRadianceDensity[index]));
        }
    }
    return map;
}

async function readAndVerifySourceFixtures() {
    const definitions = {
        sirius: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec,
        gaia: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.gaiaEdr3PassbandsV2,
    };
    const result = {};
    for (const [id, fixture] of Object.entries(definitions)) {
        const bytes = await readFile(resolve(fixtureDirectory, fixture.fileName));
        if (bytes.length !== fixture.byteLength || sha256Bytes(bytes) !== fixture.sourceHashSha256) {
            throw new ReconciliationConfigurationError(
                `ER2 ${id} fixture does not match the accepted ER1 manifest.`,
                { code: 'ER2_SOURCE_FIXTURE_MISMATCH' },
            );
        }
        result[id] = bytes;
    }
    return Object.freeze(result);
}

async function retainSourcePayload() {
    const sourceDirectory = resolve(recordDirectory, 'sources');
    await mkdir(sourceDirectory, { recursive: false });
    await Promise.all([
        copyFile(
            resolve(fixtureDirectory, 'sirius_stis_005.fits'),
            resolve(sourceDirectory, 'sirius_stis_005.fits'),
        ),
        copyFile(
            resolve(fixtureDirectory, 'sirius_stis_005.http-headers.txt'),
            resolve(sourceDirectory, 'sirius_stis_005.http-headers.txt'),
        ),
        copyFile(
            resolve(fixtureDirectory, 'GaiaEDR3_passbands_zeropoints_version2.zip'),
            resolve(sourceDirectory, 'GaiaEDR3_passbands_zeropoints_version2.zip'),
        ),
        copyFile(
            resolve(fixtureDirectory, 'GaiaEDR3_passbands_zeropoints_version2.http-headers.txt'),
            resolve(sourceDirectory, 'GaiaEDR3_passbands_zeropoints_version2.http-headers.txt'),
        ),
    ]);
}

function expectedFailure(id, expectedCode, operation) {
    try {
        operation();
        return Object.freeze({ id, expectedCode, actualCode: null, status: 'rejected' });
    } catch (error) {
        return Object.freeze({
            id,
            expectedCode,
            actualName: error.name,
            actualCode: error.code ?? null,
            message: error.message,
            status: error instanceof ReconciliationConfigurationError && error.code === expectedCode
                ? 'accepted'
                : 'rejected',
        });
    }
}

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}

function relativeError(actual, expected) {
    return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
}

function independentlyProjectDirection(camera, direction) {
    const halfHeight = Math.tan(camera.verticalFovDegrees * Math.PI / 360);
    const halfWidth = halfHeight * camera.widthPixels / camera.heightPixels;
    const projectionX = direction[0] / -direction[2];
    const projectionY = direction[1] / -direction[2];
    return Object.freeze({
        x: (projectionX / halfWidth + 1) * camera.widthPixels / 2 - 0.5,
        y: (1 - projectionY / halfHeight) * camera.heightPixels / 2 - 0.5,
    });
}

function normalizeVector(value) {
    const length = Math.hypot(...value);
    return Object.freeze(value.map((entry) => entry / length));
}

function angularSeparation(a, b) {
    return Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function sha256Bytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function serializeError(error) {
    return Object.freeze({
        name: error.name,
        code: error.code ?? null,
        message: error.message,
        details: error.details ?? null,
        stack: error.stack ?? null,
    });
}

function reportMarkdown({ status, criteria, solidAngleMatrix, pointMatrix, additivity, magnitudeRatios }) {
    const maximumPixelSolidAngleError = Math.max(...solidAngleMatrix.map((entry) =>
        entry.maximumPixelAbsoluteErrorSteradians));
    const maximumFrustumError = Math.max(...solidAngleMatrix.map((entry) =>
        entry.frustumAbsoluteErrorSteradians));
    const maximumFluxResidual = Math.max(...pointMatrix.flatMap((entry) =>
        entry.fluxChecks.map((check) => Math.abs(check.residual))));
    const maximumRoundTripError = Math.max(...pointMatrix.flatMap((entry) => [
        entry.roundTripErrorX,
        entry.roundTripErrorY,
    ]));
    return `# ER2 Point-Source Conservation Reference

Overall status: **${status}**

The accepted target is physical flux accounting, not an image or observer
claim. Sirius remains an unresolved spectral-irradiance source. The ideal
bilinear response distributes that flux without becoming source geometry,
coverage, opacity, atmosphere, or a physical eye/camera PSF.

- Cameras: ${solidAngleMatrix.length}; point cases: ${pointMatrix.length}.
- Maximum pixel-solid-angle reference error:
  ${maximumPixelSolidAngleError.toExponential(12)} sr.
- Maximum summed-frustum error: ${maximumFrustumError.toExponential(12)} sr.
- Maximum direction/raster round-trip error:
  ${maximumRoundTripError.toExponential(12)} pixel.
- Maximum per-channel accounted-flux residual:
  ${maximumFluxResidual.toExponential(12)} W m^-2 nm^-1.
- Overlapping-source additivity: ${additivity.status}.
- Magnitude-ratio cases: ${magnitudeRatios.map((entry) =>
        `${entry.magnitudeDelta} mag=${entry.status}`).join(', ')}.
- Images, atmosphere, and display outputs: none.

Accepted criteria: ${criteria.filter((entry) => entry.status === 'accepted').length}/${criteria.length}.

${status === 'accepted'
        ? 'The next action is ER3 conservative extended-source integration.'
        : 'Correct the isolated ER2 camera/response/raster failure in a fresh immutable record.'}
`;
}
