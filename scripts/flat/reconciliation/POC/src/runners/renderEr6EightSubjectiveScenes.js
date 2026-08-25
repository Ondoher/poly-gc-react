// References:
// - tmp/atmosphere/reconciliation/056-er6-physical-globe-scene-validation,
//   accepted eight-case physical CPU rendering dependency.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   accepted pre-display claim and one-global-display boundary.

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import Er6LimeGlobeMoonIrradianceProvider from
    '../er6-case-matrix/Er6LimeGlobeMoonIrradianceProvider.js';
import Er6PhysicalGlobeSceneRenderer from
    '../er6-case-matrix/Er6PhysicalGlobeSceneRenderer.js';
import LimeCalibrationFixtureReader from
    '../external-celestial-sources/LimeCalibrationFixtureReader.js';
import LimeCoefficientModel from
    '../external-celestial-sources/LimeCoefficientModel.js';
import { createCalspecSiriusIrradianceDensity } from
    '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSolarIrradianceDensity } from
    '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from
    '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import { writePng } from '../outputs/pngWriter.js';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER = 'renderEr6EightSubjectiveScenes';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '071-controlled-day-night-moon-sirius-visibility';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const SEALED_ER6_RECORD_ID = '056-er6-physical-globe-scene-validation';
const SEALED_ER6_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ER6_RECORD_ID}`;
const FIXTURE_ROOT =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures';
const SEALED_CASE_COUNT = 8;
const REQUIRED_CASE_COUNT = 2;
const CAMERA_CONFIGURATION = Object.freeze({
    widthPixels: 384,
    heightPixels: 288,
    verticalFovDegrees: 20,
});
const ATMOSPHERE_CONTROLS = Object.freeze({
    pathIntervalCount: 6,
    sourceTransmittanceIntervalCount: 4,
    incidentDirectionCount: 4,
    incidentAltitudeBinCount: 4,
});
const EXTENDED_QUADRATURE = Object.freeze({
    sun: Object.freeze({ radialCount: 6, azimuthCount: 24 }),
    moon: Object.freeze({ radialCount: 6, azimuthCount: 24 }),
});
const DEPTH_TIE_TOLERANCE_METERS = 1e-6;
const INDIVIDUAL_REVIEW_SCALE = 2;
const MONTAGE_REVIEW_SCALE = 1;
const CROP_HALF_SIZE_PIXELS = 16;
const CROP_REVIEW_SCALE = 8;
const SKY_TARGET_LINEAR_LUMA = 0.18;
const MIN_REVIEW_EXPOSURE = 0.25;
const MAX_REVIEW_EXPOSURE = 1e6;
const DAY_STAR_MAXIMUM_BYTE_RESIDUAL = 1;
const VISIBLE_OBJECT_MINIMUM_BYTE_RESIDUAL = 3;
const TARGET_PIXELS = Object.freeze({
    moon: Object.freeze({ pixelX: 120, pixelY: 86 }),
    sirius: Object.freeze({ pixelX: 264, pixelY: 86 }),
});
const SEALED_ER6_FILES = Object.freeze({
    result: 'result.json',
    criteria: 'criteria-results.json',
    attachments: 'reconstructed-case-attachments.json',
    sourceReferences: 'source-references.json',
});
const SEALED_ER6_PINS = Object.freeze({
    result: '1d8c0415b6c58a7c42ce117ac25b79f9d35438628ce363cba9bce3bb5ef71550',
    criteria: '22f38188926a3b221d5b4f3de89278bebcb7ff3d92f617bbe49ee950e2fbe96f',
    attachments: '66736ad48d3f927f769a161353dd3fa7a5f0bdaccaa09682873431e37d0629de',
    sourceReferences: '79290c5d148fd2233f02b706900c63ecf6ceafeacd750bb29262fa3d740b7a49',
});
const EXPECTED_CASES = Object.freeze([
    Object.freeze({ id: 'san-jose-globe-sunrise', epochIso: '2024-06-20T12:51:29.018Z' }),
    Object.freeze({ id: 'san-jose-globe-solar-noon', epochIso: '2024-06-20T20:08:46.261Z' }),
    Object.freeze({ id: 'san-jose-globe-sunset', epochIso: '2024-06-21T03:26:03.503Z' }),
    Object.freeze({ id: 'san-jose-globe-sunset-plus-1', epochIso: '2024-06-21T04:26:03.503Z' }),
    Object.freeze({ id: 'union-glacier-globe-sunrise', epochIso: '2024-12-14T10:10:24.244Z' }),
    Object.freeze({ id: 'union-glacier-globe-solar-noon', epochIso: '2024-12-14T17:27:41.487Z' }),
    Object.freeze({ id: 'union-glacier-globe-sunset', epochIso: '2024-12-15T00:44:58.729Z' }),
    Object.freeze({ id: 'union-glacier-globe-sunset-plus-1', epochIso: '2024-12-15T01:44:58.729Z' }),
]);
const SELECTED_CASES = Object.freeze([
    EXPECTED_CASES[1],
    EXPECTED_CASES[3],
]);
const CRITERIA = freezeJsonValue([
    criterionDefinition('sealed-er6', 'record 056 hashes and 22/22 acceptance are exact'),
    criterionDefinition('case-selection', 'the accepted San Jose noon and sunset-plus-one attachments are exact'),
    criterionDefinition('controlled-geometry', 'Moon and Sirius use explicit nonastronomical on-frame presentation directions'),
    criterionDefinition('source-integrity', 'accepted source packets remain unchanged and no source-specific gain is introduced'),
    criterionDefinition('day-moon-visible', 'daytime Moon counterfactual residual is at least 3 output bytes'),
    criterionDefinition('day-star-absent', 'daytime Sirius counterfactual residual is at most 1 output byte'),
    criterionDefinition('night-moon-visible', 'nighttime Moon counterfactual residual is at least 3 output bytes'),
    criterionDefinition('night-star-visible', 'nighttime Sirius counterfactual residual is at least 3 output bytes'),
    criterionDefinition('image-artifacts', 'two panels, four fixed crops, and one paired overview are retained'),
    criterionDefinition('claim-boundary', 'geometry and review exposure are presentation-only; no astronomical or observational visibility claim is made'),
]);

const mode = parseMode(process.argv);
const startedAt = performance.now();
let recordCreated = false;
let completedCaseCount = 0;

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    await mkdir(resolve(mode.recordDirectory, 'images'), { recursive: false });
    await writeInitialArtifacts(mode.recordDirectory, mode);
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} started; controlled CPU-only day/night Moon and Sirius presentation capture, browser watcher unused.`,
    );

    const sealedEr6 = await loadSealedEr6();
    await writeJson(mode.recordDirectory, 'sealed-er6-dependency.json', sealedEr6.descriptor);
    const sources = await loadPhysicalSources();
    await writeJson(mode.recordDirectory, 'source-references.json', sources.descriptor);
    const moduleGraph = await new LocalModuleGraphHasher({
        workspaceRoot: process.cwd(),
        allowedRoot: 'scripts/flat/reconciliation/POC/src',
    }).collect([RUNNER_PATH]);
    await writeJson(mode.recordDirectory, 'module-graph.json', moduleGraph);

    const camera = new PerspectiveCameraRaster(CAMERA_CONFIGURATION);
    const displayModel = new BrunetonColorDisplayModel();
    const renderer = new Er6PhysicalGlobeSceneRenderer({
        camera,
        canonicalSolarIrradiance: sources.canonicalSolar,
        calspecSiriusIrradiance: sources.calspecSirius,
        lunarIrradianceProvider: sources.lunarProvider,
        displayModel,
        atmosphereControls: ATMOSPHERE_CONTROLS,
        extendedQuadrature: EXTENDED_QUADRATURE,
        depthTieToleranceMeters: DEPTH_TIE_TOLERANCE_METERS,
    });
    await writeJson(mode.recordDirectory, 'renderer.json', {
        renderer: renderer.describe(),
        camera: CAMERA_CONFIGURATION,
        atmosphereControls: ATMOSPHERE_CONTROLS,
        extendedQuadrature: EXTENDED_QUADRATURE,
        display: displayModel.describeDisplayConversion(),
        pngOutputTransfer: 'IEC 61966-2-1 sRGB OETF after the shared Figure-1 display transform',
        reviewScaling: {
            individual: `nearest-neighbor ${INDIVIDUAL_REVIEW_SCALE}x`,
            montage: `nearest-neighbor ${MONTAGE_REVIEW_SCALE}x`,
        },
        outputMode: 'compact-review',
    });

    const nativeFrames = [];
    const cropArtifacts = [];
    const caseDiagnostics = [];
    const selectedAttachments = SELECTED_CASES.map((selected) => {
        const attachment = sealedEr6.attachments.find((entry) =>
            entry.matrixCase.id === selected.id);
        if (!attachment) {
            throw new Error(`Missing selected sealed attachment ${selected.id}.`);
        }
        return attachment;
    });
    const presentationDirections = freezeJsonValue({
        astronomicalPosition: false,
        moonDirectionCamera: camera.rasterCenterToDirection(
            TARGET_PIXELS.moon.pixelX,
            TARGET_PIXELS.moon.pixelY,
        ),
        siriusDirectionCamera: camera.rasterCenterToDirection(
            TARGET_PIXELS.sirius.pixelX,
            TARGET_PIXELS.sirius.pixelY,
        ),
        targetPixels: TARGET_PIXELS,
    });
    for (const attachment of selectedAttachments) {
        const caseStartedAt = performance.now();
        await appendRunLog(
            mode.recordDirectory,
            `${attachment.matrixCase.id} render started.`,
        );
        const rendered = renderer.renderCase({
            caseAttachment: attachment,
            outputMode: 'compact-review',
            presentationOverrides: {
                id: `record-071-${attachment.matrixCase.id}`,
                astronomicalPosition: false,
                moonDirectionCamera: presentationDirections.moonDirectionCamera,
                siriusDirectionCamera: presentationDirections.siriusDirectionCamera,
            },
        });
        const reviewMapping = deriveSceneReviewMapping(rendered.composition);
        const nativeRgba = compositionToSrgbBytes(
            rendered.composition,
            reviewMapping.exposure,
            'full',
        );
        const withoutSiriusRgba = compositionToSrgbBytes(
            rendered.composition,
            reviewMapping.exposure,
            'withoutSirius',
        );
        const withoutMoonRgba = compositionToSrgbBytes(
            rendered.composition,
            reviewMapping.exposure,
            'withoutMoon',
        );
        const visibility = freezeJsonValue({
            moon: residualStatistics(
                nativeRgba,
                withoutMoonRgba,
                TARGET_PIXELS.moon,
                CROP_HALF_SIZE_PIXELS,
            ),
            sirius: residualStatistics(
                nativeRgba,
                withoutSiriusRgba,
                TARGET_PIXELS.sirius,
                CROP_HALF_SIZE_PIXELS,
            ),
        });
        const reviewRgba = upscaleNearest(
            nativeRgba,
            camera.widthPixels,
            camera.heightPixels,
            INDIVIDUAL_REVIEW_SCALE,
        );
        const filename = `${rendered.caseOrdinal + 1}-${rendered.caseId}.png`;
        const recordPath = `images/${filename}`;
        const absolutePath = resolve(mode.recordDirectory, recordPath);
        await writePng(
            absolutePath,
            camera.widthPixels * INDIVIDUAL_REVIEW_SCALE,
            camera.heightPixels * INDIVIDUAL_REVIEW_SCALE,
            reviewRgba,
        );
        for (const [objectId, target] of Object.entries(TARGET_PIXELS)) {
            const crop = cropRgba(
                nativeRgba,
                camera.widthPixels,
                camera.heightPixels,
                target,
                CROP_HALF_SIZE_PIXELS,
            );
            const enlargedCrop = upscaleNearest(
                crop.rgba,
                crop.widthPixels,
                crop.heightPixels,
                CROP_REVIEW_SCALE,
            );
            const cropRecordPath = `images/${rendered.caseId}-${objectId}-crop.png`;
            const cropAbsolutePath = resolve(mode.recordDirectory, cropRecordPath);
            await writePng(
                cropAbsolutePath,
                crop.widthPixels * CROP_REVIEW_SCALE,
                crop.heightPixels * CROP_REVIEW_SCALE,
                enlargedCrop,
            );
            const cropBytes = await readFile(cropAbsolutePath);
            cropArtifacts.push(freezeJsonValue({
                caseId: rendered.caseId,
                objectId,
                path: cropRecordPath,
                nativeBounds: crop.bounds,
                widthPixels: crop.widthPixels * CROP_REVIEW_SCALE,
                heightPixels: crop.heightPixels * CROP_REVIEW_SCALE,
                byteLength: cropBytes.byteLength,
                sha256: hashBytes(cropBytes),
            }));
        }
        nativeFrames.push(nativeRgba);
        completedCaseCount += 1;
        const imageBytes = await readFile(absolutePath);
        const diagnostics = freezeJsonValue({
            caseId: rendered.caseId,
            caseOrdinal: rendered.caseOrdinal,
            epochIso: rendered.epochIso,
            sourceAltitudesDegrees: rendered.sourceAltitudesDegrees,
            presentationOverrides: rendered.presentationOverrides,
            presentationDirections,
            sourceIds: rendered.sourceIds,
            rendererOutputMode: rendered.outputMode,
            status: rendered.status,
            displayPass: rendered.composition.displayPass,
            componentSpectralRadianceSolidAngleIntegrals:
                rendered.composition.componentSpectralRadianceSolidAngleIntegrals,
            fingerprints: rendered.fingerprints,
            reviewMapping,
            automatedVisibility: visibility,
            nativePixelStatistics: byteStatistics(nativeRgba),
            image: {
                path: recordPath,
                widthPixels: camera.widthPixels * INDIVIDUAL_REVIEW_SCALE,
                heightPixels: camera.heightPixels * INDIVIDUAL_REVIEW_SCALE,
                byteLength: imageBytes.byteLength,
                sha256: hashBytes(imageBytes),
            },
            elapsedMilliseconds: performance.now() - caseStartedAt,
        });
        caseDiagnostics.push(diagnostics);
        await writeJson(
            mode.recordDirectory,
            `${rendered.caseOrdinal + 1}-${rendered.caseId}.json`,
            diagnostics,
        );
        await appendRunLog(
            mode.recordDirectory,
            `${rendered.caseId} image written; presentation residuals moon=${visibility.moon.maximumByteResidual}, Sirius=${visibility.sirius.maximumByteResidual}.`,
        );
        console.log(JSON.stringify({
            progress: `${completedCaseCount}/${REQUIRED_CASE_COUNT}`,
            caseId: rendered.caseId,
            image: recordPath,
        }));
    }

    const nativeMontage = montageBytes(
        nativeFrames,
        camera.widthPixels,
        camera.heightPixels,
        2,
    );
    const reviewMontage = upscaleNearest(
        nativeMontage,
        camera.widthPixels * 2,
        camera.heightPixels,
        MONTAGE_REVIEW_SCALE,
    );
    const montagePath = resolve(mode.recordDirectory, 'images/overview.png');
    await writePng(
        montagePath,
        camera.widthPixels * 2 * MONTAGE_REVIEW_SCALE,
        camera.heightPixels * MONTAGE_REVIEW_SCALE,
        reviewMontage,
    );
    const montageBytesOnDisk = await readFile(montagePath);
    const montage = freezeJsonValue({
        path: 'images/overview.png',
        order: caseDiagnostics.map((entry) => entry.caseId),
        columns: 2,
        rows: 1,
        widthPixels: camera.widthPixels * 2 * MONTAGE_REVIEW_SCALE,
        heightPixels: camera.heightPixels * MONTAGE_REVIEW_SCALE,
        byteLength: montageBytesOnDisk.byteLength,
        sha256: hashBytes(montageBytesOnDisk),
    });
    const criteria = await buildCriteriaResults({
        sealedEr6,
        caseDiagnostics,
        montage,
        cropArtifacts,
        camera,
    });
    const acceptedCriterionCount = criteria.filter((entry) =>
        entry.status === 'accepted').length;
    const status = acceptedCriterionCount === CRITERIA.length
        ? 'accepted'
        : 'rejected';
    const result = freezeJsonValue({
        status,
        scope: 'controlled presentation-only day/night Moon and Sirius review capture',
        rendererOutputMode: 'compact-review',
        caseCount: caseDiagnostics.length,
        expectedCaseCount: REQUIRED_CASE_COUNT,
        nativeResolution: [camera.widthPixels, camera.heightPixels],
        individualReviewResolution: [
            camera.widthPixels * INDIVIDUAL_REVIEW_SCALE,
            camera.heightPixels * INDIVIDUAL_REVIEW_SCALE,
        ],
        imageCount: REQUIRED_CASE_COUNT + cropArtifacts.length + 1,
        acceptedCriterionCount,
        criterionCount: CRITERIA.length,
        physicalRadiometryStatus: 'inherited-source-packets; geometry-overridden-presentation-only',
        automatedReviewabilityStatus: status,
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        astronomicalGeometryStatus: 'not-claimed-controlled-override',
        browserUsed: false,
        gpuClaimed: false,
        elapsedMilliseconds: performance.now() - startedAt,
        overviewImage: montage.path,
    });
    await writeJson(mode.recordDirectory, 'case-diagnostics.json', {
        kind: 'controlled-day-night-moon-sirius-diagnostics-v1',
        cases: caseDiagnostics,
        montage,
        crops: cropArtifacts,
    });
    await writeJson(mode.recordDirectory, 'criteria-results.json', {
        status,
        criteria,
    });
    await writeJson(mode.recordDirectory, 'result.json', result);
    await writeText(mode.recordDirectory, 'report.md', reportText(result, caseDiagnostics));
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} ${status}; ${acceptedCriterionCount}/${CRITERIA.length}; images=${result.imageCount}.`,
    );
    console.log(JSON.stringify({
        status,
        acceptedCriterionCount,
        criterionCount: CRITERIA.length,
        caseCount: caseDiagnostics.length,
        overviewImage: `${mode.recordDirectory}/${montage.path}`,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailure(mode.recordDirectory, error, completedCaseCount);
    }
    throw error;
}

async function writeInitialArtifacts(recordDirectory, resolvedMode) {
    await writeText(recordDirectory, 'state-goal.md', `# State And Goal

Record: ${EXPECTED_RECORD_ID}

Render a controlled San Jose day/night pair from the accepted record-056 noon
and sunset-plus-one attachments. Put the Moon and physical CALSPEC Sirius at
the same explicit on-frame presentation directions in both panels. Retain the
accepted source packets, atmosphere, depth ordering, and point/extended
integration without changing source facts or adding source-specific gain.

The native calculation is 384x288 with a 20-degree vertical field of view.
One deterministic scene-wide exposure derived from the upper-sky median is
applied equally to each complete scene and its exact Moon-free and Sirius-free
counterfactuals before the standard sRGB OETF. The predeclared byte-residual
criteria require the Moon to distinguish in day and night, Sirius not to
distinguish in day, and both to distinguish at night. All moved geometry and
review exposure are presentation-only. This record makes no astronomical,
human/camera, browser/GPU, or real-world observational visibility claim.
`);
    await writeJson(recordDirectory, 'command.json', {
        runner: RUNNER,
        runnerPath: RUNNER_PATH,
        recordId: EXPECTED_RECORD_ID,
        recordDirectory,
        argv: resolvedMode.argv,
        command: `node ${RUNNER_PATH} --record ${EXPECTED_RECORD_DIRECTORY}`,
        startedAt: nowIso(),
        rerunPermitted: false,
        browserUsed: false,
        networkAcquisition: false,
    });
    await writeJson(recordDirectory, 'criteria-and-tolerances.json', {
        criteria: CRITERIA,
        tolerances: {
            dependencyHashes: 'exact lowercase SHA-256 equality',
            caseIdsAndEpochs: 'exact selected equality',
            requiredCaseCount: REQUIRED_CASE_COUNT,
            requiredIndividualImageCount: REQUIRED_CASE_COUNT,
            requiredCropImageCount: REQUIRED_CASE_COUNT * 2,
            displayCallsPerPixel: 1,
            daytimeSiriusMaximumByteResidual: DAY_STAR_MAXIMUM_BYTE_RESIDUAL,
            visibleObjectMinimumByteResidual: VISIBLE_OBJECT_MINIMUM_BYTE_RESIDUAL,
            skyTargetLinearLuma: SKY_TARGET_LINEAR_LUMA,
            exposureRange: [MIN_REVIEW_EXPOSURE, MAX_REVIEW_EXPOSURE],
            outputEncoding: 'one fixed IEC 61966-2-1 sRGB OETF',
        },
    });
}

async function loadSealedEr6() {
    const parsed = {};
    const actualPins = {};
    const files = {};
    for (const [id, filename] of Object.entries(SEALED_ER6_FILES)) {
        const path = resolve(SEALED_ER6_DIRECTORY, filename);
        const bytes = await readFile(path);
        actualPins[id] = hashBytes(bytes);
        parsed[id] = JSON.parse(bytes.toString('utf8'));
        files[id] = {
            path: relative(process.cwd(), path).replaceAll('\\', '/'),
            byteLength: bytes.byteLength,
            sha256: actualPins[id],
        };
    }
    if (stableHash(actualPins) !== stableHash(SEALED_ER6_PINS)) {
        throw new Error('Sealed record 056 dependency hashes do not match the predeclared pins.');
    }
    if (
        parsed.result.status !== 'accepted'
        || parsed.result.acceptedCriterionCount !== 22
        || parsed.result.criterionCount !== 22
        || parsed.criteria.status !== 'accepted'
        || parsed.criteria.criteria.length !== 22
        || !parsed.criteria.criteria.every((entry) => entry.status === 'accepted')
    ) {
        throw new Error('Sealed record 056 is not accepted 22/22.');
    }
    if (!Array.isArray(parsed.attachments) || parsed.attachments.length !== SEALED_CASE_COUNT) {
        throw new Error('Sealed record 056 does not retain exactly eight attachments.');
    }
    for (let index = 0; index < EXPECTED_CASES.length; index += 1) {
        const attachment = parsed.attachments[index];
        const expected = EXPECTED_CASES[index];
        if (
            attachment.matrixCase.id !== expected.id
            || attachment.matrixCase.ordinal !== index
            || attachment.matrixCase.exactTimeIso !== expected.epochIso
            || attachment.ephemerisState.worldState.epochIso !== expected.epochIso
        ) {
            throw new Error(`Sealed ER6 attachment ${index} does not match ${expected.id}.`);
        }
    }
    return Object.freeze({
        attachments: Object.freeze(parsed.attachments),
        descriptor: freezeJsonValue({
            kind: 'sealed-er6-subjective-capture-dependency-v1',
            recordId: SEALED_ER6_RECORD_ID,
            directory: SEALED_ER6_DIRECTORY,
            expectedPins: SEALED_ER6_PINS,
            actualPins,
            files,
            acceptedCriterionCount: 22,
            criterionCount: 22,
            caseCount: parsed.attachments.length,
            caseIds: parsed.attachments.map((entry) => entry.matrixCase.id),
            attachmentFingerprints: parsed.attachments.map((entry) => entry.fingerprint),
        }),
    });
}

async function loadPhysicalSources() {
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const fixturePaths = Object.freeze({
        canonicalSolarRaw: resolve(FIXTURE_ROOT, manifest.canonicalSolar.fileName),
        calspecSirius: resolve(FIXTURE_ROOT, manifest.siriusCalspec.fileName),
        limeCoefficient: resolve(
            FIXTURE_ROOT,
            manifest.limeLunarCandidate.coefficients.fileName,
        ),
        limeRelease: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.release.fileName),
        limeAtbd: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.atbd.fileName),
    });
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        Object.entries(fixturePaths).map(async ([id, path]) => [id, await readFile(path)]),
    )));
    const expectedHashes = Object.freeze({
        canonicalSolarRaw: manifest.canonicalSolar.sourceHashSha256,
        calspecSirius: manifest.siriusCalspec.sourceHashSha256,
        limeCoefficient: manifest.limeLunarCandidate.coefficients.sourceHashSha256,
        limeRelease: manifest.limeLunarCandidate.release.sourceHashSha256,
        limeAtbd: manifest.limeLunarCandidate.atbd.sourceHashSha256,
    });
    const fixtureFiles = {};
    for (const [id, value] of Object.entries(bytes)) {
        const sha256 = hashBytes(value);
        if (sha256 !== expectedHashes[id]) {
            throw new Error(`${id} SHA-256 does not match the canonical fixture manifest.`);
        }
        fixtureFiles[id] = {
            path: relative(process.cwd(), fixturePaths[id]).replaceAll('\\', '/'),
            byteLength: value.byteLength,
            sha256,
        };
    }
    const basis = createCanonicalSpectralDensityBasis();
    const canonicalSolar = createCanonicalSolarIrradianceDensity(basis);
    const calspec = createCalspecSiriusIrradianceDensity(bytes.calspecSirius, basis);
    const limeFixtures = await new LimeCalibrationFixtureReader().read();
    const limeModel = new LimeCoefficientModel({
        fixtures: limeFixtures,
        basis,
        canonicalSolar,
    });
    const lunarProvider = new Er6LimeGlobeMoonIrradianceProvider({
        model: limeModel,
        sourceId: manifest.limeLunarCandidate.sourceId,
    });
    return Object.freeze({
        canonicalSolar,
        calspecSirius: calspec.packet,
        lunarProvider,
        descriptor: freezeJsonValue({
            kind: 'post-reset-subjective-capture-source-inputs-v1',
            manifestVersion: manifest.manifestVersion,
            fixtureFiles,
            basis: basis.describe(),
            canonicalSolar: canonicalSolar.describe(),
            calspecSirius: calspec.packet.describe(),
            limePolicy: limeModel.describeExecutablePolicy(),
            lunarProvider: lunarProvider.describe(),
            sourceMagnitudePolicy: 'unchanged accepted packets; no source-specific gain',
        }),
    });
}

async function buildCriteriaResults({
    sealedEr6,
    caseDiagnostics,
    montage,
    cropArtifacts,
    camera,
}) {
    const imageFiles = await Promise.all(caseDiagnostics.map(async (entry) => ({
        path: entry.image.path,
        exists: (await stat(resolve(mode.recordDirectory, entry.image.path))).isFile(),
        byteLength: entry.image.byteLength,
        sha256: entry.image.sha256,
    })));
    const cropFiles = await Promise.all(cropArtifacts.map(async (entry) => ({
        path: entry.path,
        exists: (await stat(resolve(mode.recordDirectory, entry.path))).isFile(),
        byteLength: entry.byteLength,
        sha256: entry.sha256,
    })));
    const day = caseDiagnostics.find((entry) =>
        entry.caseId === SELECTED_CASES[0].id);
    const night = caseDiagnostics.find((entry) =>
        entry.caseId === SELECTED_CASES[1].id);
    const geometryEvidence = caseDiagnostics.map((entry) => ({
        caseId: entry.caseId,
        actualAstronomicalAltitudesDegrees: entry.sourceAltitudesDegrees,
        presentationOverrides: entry.presentationOverrides,
        targetPixels: entry.presentationDirections.targetPixels,
        projectedMoon: camera.directionToRasterCenter(
            entry.presentationDirections.moonDirectionCamera,
        ),
        projectedSirius: camera.directionToRasterCenter(
            entry.presentationDirections.siriusDirectionCamera,
        ),
    }));
    const evidence = {
        'sealed-er6': sealedEr6.descriptor,
        'case-selection': caseDiagnostics.map((entry) => ({
            caseId: entry.caseId,
            epochIso: entry.epochIso,
        })),
        'controlled-geometry': geometryEvidence,
        'source-integrity': {
            sourceFingerprints: caseDiagnostics.map((entry) => entry.fingerprints),
            displayPasses: caseDiagnostics.map((entry) => entry.displayPass),
            reviewMappings: caseDiagnostics.map((entry) => entry.reviewMapping),
            sourceSpecificGain: false,
        },
        'day-moon-visible': day?.automatedVisibility.moon ?? null,
        'day-star-absent': day?.automatedVisibility.sirius ?? null,
        'night-moon-visible': night?.automatedVisibility.moon ?? null,
        'night-star-visible': night?.automatedVisibility.sirius ?? null,
        'image-artifacts': { imageFiles, cropFiles, montage },
        'claim-boundary': {
            astronomicalPosition: false,
            reviewExposurePurpose: 'scene-wide presentation only',
            browserUsed: false,
            gpuClaimed: false,
            humanReviewStatus: 'not-claimed',
            observationalStatus: 'not-claimed',
        },
    };
    const accepted = {
        'sealed-er6': sealedEr6.descriptor.acceptedCriterionCount === 22,
        'case-selection': stableHash(caseDiagnostics.map((entry) => ({
            id: entry.caseId,
            epochIso: entry.epochIso,
        }))) === stableHash(SELECTED_CASES),
        'controlled-geometry': geometryEvidence.every((entry) =>
            entry.presentationOverrides.astronomicalPosition === false
            && projectionMatchesTarget(entry.projectedMoon, TARGET_PIXELS.moon)
            && projectionMatchesTarget(entry.projectedSirius, TARGET_PIXELS.sirius)),
        'source-integrity': caseDiagnostics.length === REQUIRED_CASE_COUNT
            && caseDiagnostics.every((entry) =>
                entry.rendererOutputMode === 'compact-review'
                && entry.displayPass.actualCallCount === camera.widthPixels * camera.heightPixels
                && entry.displayPass.expectedCallCount === camera.widthPixels * camera.heightPixels
                && entry.displayPass.sourceSpecificGain === false
                && entry.displayPass.preDisplaySpectralValuesRetained === true
                && entry.reviewMapping.sourceSpecificGain === false),
        'day-moon-visible': (day?.automatedVisibility.moon.maximumByteResidual ?? -1)
            >= VISIBLE_OBJECT_MINIMUM_BYTE_RESIDUAL,
        'day-star-absent': (day?.automatedVisibility.sirius.maximumByteResidual ?? Infinity)
            <= DAY_STAR_MAXIMUM_BYTE_RESIDUAL,
        'night-moon-visible': (night?.automatedVisibility.moon.maximumByteResidual ?? -1)
            >= VISIBLE_OBJECT_MINIMUM_BYTE_RESIDUAL,
        'night-star-visible': (night?.automatedVisibility.sirius.maximumByteResidual ?? -1)
            >= VISIBLE_OBJECT_MINIMUM_BYTE_RESIDUAL,
        'image-artifacts': imageFiles.length === REQUIRED_CASE_COUNT
            && imageFiles.every((entry) => entry.exists && entry.byteLength > 0)
            && cropFiles.length === REQUIRED_CASE_COUNT * 2
            && cropFiles.every((entry) => entry.exists && entry.byteLength > 0)
            && montage.byteLength > 0,
        'claim-boundary': caseDiagnostics.every((entry) =>
            entry.presentationOverrides.astronomicalPosition === false
            && entry.status.humanReviewStatus === 'not-claimed'
            && entry.status.observationalStatus === 'not-claimed'
            && entry.displayPass.actualCallCount === camera.widthPixels * camera.heightPixels
        ),
    };
    return freezeJsonValue(CRITERIA.map((definition) => ({
        ...definition,
        status: accepted[definition.id] ? 'accepted' : 'rejected',
        evidence: evidence[definition.id],
    })));
}

function deriveSceneReviewMapping(composition) {
    const skyLumas = composition.pixels
        .filter((pixel) => pixel.pixelY < Math.floor(CAMERA_CONFIGURATION.heightPixels * 0.35))
        .map((pixel) => linearLuma(pixel.display.rgb))
        .filter(Number.isFinite)
        .sort((left, right) => left - right);
    if (skyLumas.length === 0) {
        throw new Error('Cannot derive scene-wide review exposure without upper-sky pixels.');
    }
    const middle = Math.floor(skyLumas.length / 2);
    const medianSkyLinearLuma = skyLumas.length % 2 === 0
        ? (skyLumas[middle - 1] + skyLumas[middle]) / 2
        : skyLumas[middle];
    const exposure = Math.max(
        MIN_REVIEW_EXPOSURE,
        Math.min(
            MAX_REVIEW_EXPOSURE,
            SKY_TARGET_LINEAR_LUMA / Math.max(medianSkyLinearLuma, Number.EPSILON),
        ),
    );
    return freezeJsonValue({
        kind: 'upper-sky-median-scene-wide-review-exposure-v1',
        upperSkyFraction: 0.35,
        medianSkyLinearLuma,
        targetLinearLuma: SKY_TARGET_LINEAR_LUMA,
        exposure,
        minimumExposure: MIN_REVIEW_EXPOSURE,
        maximumExposure: MAX_REVIEW_EXPOSURE,
        sourceSpecificGain: false,
        appliesIdenticallyTo: ['full', 'withoutSirius', 'withoutMoon'],
        outputTransfer: 'IEC 61966-2-1 sRGB OETF',
        claim: 'presentation-only; not observer or visibility calibration',
    });
}

function compositionToSrgbBytes(composition, exposure, variant) {
    const expectedCount = CAMERA_CONFIGURATION.widthPixels
        * CAMERA_CONFIGURATION.heightPixels;
    if (!Array.isArray(composition?.pixels) || composition.pixels.length !== expectedCount) {
        throw new Error('Physical composition does not contain the complete native frame.');
    }
    const bytes = new Uint8Array(expectedCount * 4);
    for (const pixel of composition.pixels) {
        const offset = (pixel.pixelY * CAMERA_CONFIGURATION.widthPixels + pixel.pixelX) * 4;
        const rgb = variant === 'full'
            ? pixel.display.rgb
            : variant === 'withoutSirius'
                ? pixel.counterfactualDisplay?.withoutSiriusRgb
                : variant === 'withoutMoon'
                    ? pixel.counterfactualDisplay?.withoutMoonRgb
                    : null;
        if (!Array.isArray(rgb) || rgb.length !== 3) {
            throw new Error(`Compact composition is missing ${variant} display RGB.`);
        }
        for (let channel = 0; channel < 3; channel += 1) {
            bytes[offset + channel] = Math.round(
                255 * linearToSrgb(clamp01(exposure * rgb[channel])),
            );
        }
        bytes[offset + 3] = 255;
    }
    return bytes;
}

function linearLuma(rgb) {
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function residualStatistics(full, counterfactual, target, halfSizePixels) {
    let maximumByteResidual = 0;
    let changedPixelCount = 0;
    let sumAbsoluteByteResidual = 0;
    const minimumX = Math.max(0, target.pixelX - halfSizePixels);
    const maximumX = Math.min(
        CAMERA_CONFIGURATION.widthPixels - 1,
        target.pixelX + halfSizePixels - 1,
    );
    const minimumY = Math.max(0, target.pixelY - halfSizePixels);
    const maximumY = Math.min(
        CAMERA_CONFIGURATION.heightPixels - 1,
        target.pixelY + halfSizePixels - 1,
    );
    for (let pixelY = minimumY; pixelY <= maximumY; pixelY += 1) {
        for (let pixelX = minimumX; pixelX <= maximumX; pixelX += 1) {
            const offset = (pixelY * CAMERA_CONFIGURATION.widthPixels + pixelX) * 4;
            let pixelChanged = false;
            for (let channel = 0; channel < 3; channel += 1) {
                const residual = Math.abs(full[offset + channel] - counterfactual[offset + channel]);
                maximumByteResidual = Math.max(maximumByteResidual, residual);
                sumAbsoluteByteResidual += residual;
                pixelChanged ||= residual > 0;
            }
            changedPixelCount += pixelChanged ? 1 : 0;
        }
    }
    return Object.freeze({
        targetPixel: target,
        window: Object.freeze({ minimumX, maximumX, minimumY, maximumY }),
        maximumByteResidual,
        changedPixelCount,
        sumAbsoluteByteResidual,
    });
}

function cropRgba(source, width, height, target, halfSizePixels) {
    const minimumX = Math.max(0, target.pixelX - halfSizePixels);
    const maximumX = Math.min(width, target.pixelX + halfSizePixels);
    const minimumY = Math.max(0, target.pixelY - halfSizePixels);
    const maximumY = Math.min(height, target.pixelY + halfSizePixels);
    const cropWidth = maximumX - minimumX;
    const cropHeight = maximumY - minimumY;
    const rgba = new Uint8Array(cropWidth * cropHeight * 4);
    for (let pixelY = 0; pixelY < cropHeight; pixelY += 1) {
        const sourceStart = ((minimumY + pixelY) * width + minimumX) * 4;
        const targetStart = pixelY * cropWidth * 4;
        rgba.set(source.subarray(sourceStart, sourceStart + cropWidth * 4), targetStart);
    }
    return Object.freeze({
        rgba,
        widthPixels: cropWidth,
        heightPixels: cropHeight,
        bounds: Object.freeze({ minimumX, maximumX, minimumY, maximumY }),
    });
}

function projectionMatchesTarget(projection, target) {
    return projection.x >= -0.5
        && projection.x <= CAMERA_CONFIGURATION.widthPixels - 0.5
        && projection.y >= -0.5
        && projection.y <= CAMERA_CONFIGURATION.heightPixels - 0.5
        && Math.abs(projection.x - target.pixelX) < 1e-9
        && Math.abs(projection.y - target.pixelY) < 1e-9;
}

function linearToSrgb(value) {
    return value <= 0.0031308
        ? 12.92 * value
        : 1.055 * value ** (1 / 2.4) - 0.055;
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function upscaleNearest(source, width, height, scale) {
    const targetWidth = width * scale;
    const targetHeight = height * scale;
    const target = new Uint8Array(targetWidth * targetHeight * 4);
    for (let targetY = 0; targetY < targetHeight; targetY += 1) {
        const sourceY = Math.floor(targetY / scale);
        for (let targetX = 0; targetX < targetWidth; targetX += 1) {
            const sourceX = Math.floor(targetX / scale);
            const sourceOffset = (sourceY * width + sourceX) * 4;
            const targetOffset = (targetY * targetWidth + targetX) * 4;
            target.set(source.subarray(sourceOffset, sourceOffset + 4), targetOffset);
        }
    }
    return target;
}

function montageBytes(images, width, height, columns) {
    const rows = Math.ceil(images.length / columns);
    const outputWidth = width * columns;
    const output = new Uint8Array(outputWidth * height * rows * 4);
    for (let index = 0; index < images.length; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        for (let y = 0; y < height; y += 1) {
            const sourceStart = y * width * 4;
            const destinationStart = ((row * height + y) * outputWidth + column * width) * 4;
            output.set(images[index].subarray(sourceStart, sourceStart + width * 4), destinationStart);
        }
    }
    return output;
}

function byteStatistics(bytes) {
    let minimum = 255;
    let maximum = 0;
    let sum = 0;
    let sampleCount = 0;
    let nonblackPixelCount = 0;
    for (let offset = 0; offset < bytes.length; offset += 4) {
        let pixelNonblack = false;
        for (let channel = 0; channel < 3; channel += 1) {
            const value = bytes[offset + channel];
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
            sum += value;
            sampleCount += 1;
            pixelNonblack ||= value > 0;
        }
        nonblackPixelCount += pixelNonblack ? 1 : 0;
    }
    return Object.freeze({
        minimum,
        maximum,
        mean: sum / sampleCount,
        nonblackPixelCount,
        pixelCount: bytes.length / 4,
    });
}

async function writeFailure(recordDirectory, error, casesCompleted) {
    const failure = freezeJsonValue({
        status: 'invalid',
        runner: RUNNER,
        recordId: EXPECTED_RECORD_ID,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack ?? null : null,
        completedCaseCount: casesCompleted,
        elapsedMilliseconds: performance.now() - startedAt,
        rerunPermitted: false,
    });
    try {
        await writeJson(recordDirectory, 'failure.json', failure);
        await writeJson(recordDirectory, 'result.json', {
            status: 'invalid',
            caseCount: casesCompleted,
            expectedCaseCount: REQUIRED_CASE_COUNT,
            acceptedCriterionCount: 0,
            criterionCount: CRITERIA.length,
            failure: failure.message,
        });
        await appendRunLog(
            recordDirectory,
            `${RUNNER} invalid after ${casesCompleted}/${REQUIRED_CASE_COUNT}: ${failure.message}`,
        );
    } catch {
        // Preserve the original exception if failure-artifact writing also fails.
    }
}

function reportText(result, cases) {
    return `# Controlled Day/Night Moon And Sirius CPU Renders

- Status: ${result.status}
- Cases: ${result.caseCount}/${result.expectedCaseCount}
- Criteria: ${result.acceptedCriterionCount}/${result.criterionCount}
- Native physical resolution: ${result.nativeResolution.join('x')}
- Review image resolution: ${result.individualReviewResolution.join('x')}
- Physical radiometry: ${result.physicalRadiometryStatus}
- Automated reviewability: ${result.automatedReviewabilityStatus}
- Astronomical geometry: ${result.astronomicalGeometryStatus}
- Human review: ${result.humanReviewStatus}
- Observational claim: ${result.observationalStatus}
- Browser used: no
- GPU claim: no
- Overview: ${result.overviewImage}

Image order and exact counterfactual residuals:
${cases.map((entry, index) => `- ${index + 1}. ${entry.caseId}: ${entry.image.path}; Moon max ${entry.automatedVisibility.moon.maximumByteResidual} bytes; Sirius max ${entry.automatedVisibility.sirius.maximumByteResidual} bytes; scene exposure ${entry.reviewMapping.exposure}`).join('\n')}

The Moon and Sirius directions are controlled presentation geometry, not their
astronomical positions. The retained real altitudes remain in the case
diagnostics. Scene-wide review exposure and byte residuals are mechanical
presentation evidence only, not naked-eye, camera, or real-world visibility.
`;
}

function parseMode(argv) {
    const recordDirectory = parseRecordDirectory(argv);
    if (argv.length !== 4 || argv[2] !== '--record') {
        throw new Error(`Runner requires exactly --record ${EXPECTED_RECORD_DIRECTORY}.`);
    }
    if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD_DIRECTORY) {
        throw new Error(`Runner may write only ${EXPECTED_RECORD_DIRECTORY}.`);
    }
    return Object.freeze({
        recordDirectory,
        argv: Object.freeze([...argv]),
    });
}

function criterionDefinition(id, name) {
    return Object.freeze({ id, name });
}

function hashBytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}
