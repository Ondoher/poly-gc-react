import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';

import HorizonsGlobeMoonStateProvider from '../globe-moon/HorizonsGlobeMoonStateProvider.js';
import { writePng } from '../outputs/pngWriter.js';
import Flat32CpuSoftShaderSceneRenderer from '../subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js';
import Flat32SceneStateResolver from '../subjective-scenes/Flat32SceneStateResolver.js';
import FLAT32_SCENE_SNAPSHOT from '../subjective-scenes/flat32SceneSnapshot.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'm5Flat32GlobeCelestialCpuSoftShader';
const recordDirectory = parseRecordDirectory(process.argv);
const width = numberArg('--width', 128);
const height = numberArg('--height', 96);
const patchSize = numberArg('--patch-size', 64);
const patchFovDegrees = numberArg('--patch-fov-degrees', 4);
const acquireHorizons = process.argv.includes('--acquire-horizons');
const incidentCacheEnabled = !process.argv.includes('--no-incident-cache');
const flat32ApproximateSunDirectionToleranceRadians = 0.015;
const nearFullMoonMinimumSampledSurfaceCosine = 0.9;
const subjectiveExecutionControls = Object.freeze({
    pathIntervalCount: 12,
    sourceTransmittanceIntervalCount: 6,
    incidentDirectionCount: 8,
    incidentAltitudeBinCount: 12,
    cachePathIntervalCount: 12,
});
const sanJoseSolarNoonIso = '2024-06-20T20:08:46.261Z';
const unionGlacierSolarNoonIso = '2024-12-14T17:27:41.487Z';
const timeCases = Object.freeze([
    createTimeCase('sunrise', 'globe-sunrise', 0, '2024-06-20T12:51:29.018Z'),
    createTimeCase('solar-noon', 'globe-solar-noon', 0, sanJoseSolarNoonIso),
    createTimeCase('sunset', 'globe-sunset', 0, '2024-06-21T03:26:03.503Z'),
    createTimeCase('sunset-plus-1', 'globe-sunset', 1, '2024-06-21T04:26:03.503Z'),
]);
const observerLocationKeys = Object.freeze(['san-jose', 'union-glacier']);
const caseRequests = Object.freeze(observerLocationKeys.flatMap((locationKey) =>
    timeCases.map((timeCase) => createCaseRequest(locationKey, timeCase))));

await createFreshRecordDirectory(recordDirectory);
const imagesDirectory = resolve(recordDirectory, 'images');
await mkdir(imagesDirectory, { recursive: false });
await appendRunLog(recordDirectory, `${runnerName} started.`);

const sourceRevisionAtExecution = await resolveGitHeadRevision();
const pocSourceTreeContentHashes = await sha256Tree('scripts/flat/reconciliation/POC/src');
const sourceContentHashes = Object.freeze({
    flat32Index: await sha256File('src/flat32/index.js'),
    flatSynchronizer: await sha256File('shared/algorithm32/production/light-sources/FlatSynchronizer.js'),
    packageManifest: await sha256File('package.json'),
    packageLock: await sha256File('package-lock.json'),
    horizonsGlobeMoonStateProvider: await sha256File('scripts/flat/reconciliation/POC/src/globe-moon/HorizonsGlobeMoonStateProvider.js'),
    globeMoonStateResolver: await sha256File('scripts/flat/reconciliation/POC/src/globe-moon/GlobeMoonStateResolver.js'),
    subjectiveSceneTimeResolver: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/SubjectiveSceneTimeResolver.js'),
    subjectiveSceneConstants: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/consts.js'),
    externalCelestialDepthResolver: await sha256File('scripts/flat/reconciliation/POC/src/external-celestial-candidates/ExternalCelestialDepthResolver.js'),
    sceneSnapshot: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js'),
    sceneResolver: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js'),
    ephemerisAdapter: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/GlobeEphemerisSceneAdapter.js'),
    celestialProvider: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneCelestialProvider.js'),
    cpuRenderer: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js'),
    runner: await sha256File('scripts/flat/reconciliation/POC/src/runners/m5Flat32GlobeCelestialCpuSoftShader.js'),
});
const commandText = `node --use-system-ca scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory} --acquire-horizons --width ${width} --height ${height} --patch-size ${patchSize} --patch-fov-degrees ${patchFovDegrees}${incidentCacheEnabled ? '' : ' --no-incident-cache'}`;

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Run the real Flat32 globe scene through the CPU spectral soft shader for San
Jose and Union Glacier while preserving each location's authored date. San Jose
uses its sunrise, solar noon, sunset, and sunset-plus-one-hour instants. Union
uses those San Jose event offsets around its own December solar noon. Acquire
exact-time Horizons Sun/Moon state for every scene, keep the Moon at its
physical direction and distance, compose Sun/Moon/stars through external
boundary radiance, and retain canonical linear plus sRGB-encoded review images.
`);
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({ command: commandText, timestamp: nowIso() })]),
});
await writeJson(recordDirectory, 'inputs.json', {
    stage: '5.6-flat32-globe-location-date-reviewable-celestial-cpu-soft-shader',
    runner: runnerName,
    caseRequests,
    timeOwnership: 'Each location keeps its authored date; Union applies San Jose event offsets around Union solar noon.',
    sanJoseSolarNoonIso,
    unionGlacierSolarNoonIso,
    observerElevationKm: 0.005,
    sceneSnapshot: FLAT32_SCENE_SNAPSHOT,
    mainViewportPixels: Object.freeze([width, height]),
    mainVerticalFovDegrees: FLAT32_SCENE_SNAPSHOT.camera.verticalFovDegrees,
    patchViewportPixels: Object.freeze([patchSize, patchSize]),
    patchVerticalFovDegrees: patchFovDegrees,
    patchPolicy: 'Rotate camera to physical body direction; never move Sun or Moon.',
    acquireHorizons,
    incidentCacheEnabled,
    subjectiveExecutionControls,
});
await writeJson(recordDirectory, 'provenance.json', {
    sourceRevisionAtExecution,
    sourceContentHashes,
    pocSourceTreeContentHashes,
    snapshotRevision: FLAT32_SCENE_SNAPSHOT.sourceRevision,
    runtimeLinkPolicy: FLAT32_SCENE_SNAPSHOT.runtimeLinkPolicy,
    ephemerisSource: 'NASA/JPL Horizons API, exact-time VECTORS, ECLIPTIC ICRF, KM-S, no aberration correction',
    acquisitionPolicy: 'Node-only, fresh provider per observer/epoch, sequential requests, raw payload retained in this immutable record',
    references: Object.freeze([
        'src/flat32/index.js',
        'shared/algorithm32/production/light-sources/FlatSynchronizer.js',
        'scripts/flat/reconciliation/POC/src/globe-moon/HorizonsGlobeMoonStateProvider.js',
        'scripts/flat/reconciliation/POC/src/globe-moon/GlobeMoonStateResolver.js',
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
    ]),
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    canonicalComposition: 'finalSpectralRadiance = pathRadiance + viewTransmittance * endpointOrCelestialRadiance',
    observerFrame: 'Horizons ecliptic J2000 -> geodetic observer-local [up,east,north] -> Three scene [east,up,-north]',
    j2000MeanObliquityArcseconds: 84381.448,
    moonDirection: 'normalize(worldMoonPosition - observerPosition)',
    moonAngularRadius: 'asin(moonRadius / observerMoonDistance)',
    moonPhaseAngle: 'acos(dot(normalize(Sun-Moon), normalize(observer-Moon)))',
    moonIlluminatedFraction: '(1 + cos(phaseAngle)) / 2',
    moonSurfaceRadiance: 'solarIncidentSpectrum * prototypeSpectralAlbedo(0.12) * max(dot(surfaceNormal, MoonToSun), 0) / pi',
    unresolvedMoonSurfaceRadiance: 'solarIncidentSpectrum * prototypeSpectralAlbedo(0.12) * (2/3) * LambertPhase(phaseAngle) / pi',
    moonCoverage: 'angular disk/pixel overlap; coverage is applied once by ExternalCelestialDepthResolver',
    moonCalibrationQualification: 'Position, distance, angular size, phase geometry, and per-ray terminator are physical; neutral albedo/display exposure remains prototype calibration.',
    starQualification: 'The 192 Flat32 analogs are fixed scene diagnostics, not a sidereal catalog or astronomical occultation claim.',
    canonicalPngEncoding: 'tone-mapped linear-sRGB written directly to 8-bit for numerical continuity',
    reviewPngEncoding: 'the same tone-mapped linear-sRGB passed through the standard sRGB OETF before 8-bit quantization',
    endpointShadow: 'analytic hard CPU ray; GPU PCF shadow filtering remains outside this experiment',
    flat32ApproximateSunDirectionToleranceRadians,
    flat32ApproximateSunDirectionToleranceDegrees: flat32ApproximateSunDirectionToleranceRadians * 180 / Math.PI,
    flat32SunDirectionQualification: 'This is a coherence check against Flat32 approximate solar synchronization, not an accuracy limit on the exact Horizons direction.',
    nearFullMoonMinimumSampledSurfaceCosine,
    subjectiveExecutionControls,
});

const failures = [];
let sceneStates = [];
let acquisitions = [];
let renderedCases = [];
let imageStats = [];
let overviewPaths = Object.freeze({});

try {
    if (!acquireHorizons) {
        throw new Error('Runner requires --acquire-horizons so every Moon state matches its exact scene timestamp.');
    }

    const sceneResolver = new Flat32SceneStateResolver();
    sceneStates = caseRequests.map((request) => sceneResolver.resolve(request));
    assertSceneSchedule(sceneStates);
    await writeJson(recordDirectory, 'resolved-scenes.json', {
        scenes: sceneStates.map(sceneStateInputSummary),
        sharedSolidManifest: sceneStates[0].objectInventory.solidEndpointIds,
        sharedExternalManifest: sceneStates[0].objectInventory.externalBoundaryIds,
        syntheticStarSpecs: sceneStates[0].syntheticStars,
    });

    for (const sceneState of sceneStates) {
        const provider = new HorizonsGlobeMoonStateProvider();
        await appendRunLog(recordDirectory, `${sceneState.id} Horizons acquisition started.`);
        const state = await provider.resolve({
            timeIso: sceneState.time.finalTimeIso,
            observer: Object.freeze({
                id: sceneState.location.key,
                latitudeDegrees: sceneState.location.latitude,
                longitudeDegrees: sceneState.location.longitude,
                elevationKm: 0.005,
            }),
        });
        acquisitions.push(Object.freeze({
            sceneId: sceneState.id,
            eventId: caseRequests.find((entry) => entry.id === sceneState.id).eventId,
            state,
            rawQueries: Object.freeze([...provider.rawQueries]),
        }));
        await writeEphemerisEvidence('acquiring', acquisitions);
        await appendRunLog(recordDirectory, `${sceneState.id} Horizons acquisition complete queries=${provider.rawQueries.length}.`);
    }
    acquisitions = acquisitions.map((entry) => Object.freeze({
        ...entry,
        renderState: Object.freeze({
            worldState: entry.state.worldState,
            observerState: entry.state.observerState,
        }),
    }));
    await writeEphemerisEvidence('complete', acquisitions);

    const mainRenderer = new Flat32CpuSoftShaderSceneRenderer({
        width,
        height,
        incidentCacheEnabled,
        executionControls: subjectiveExecutionControls,
        onProgress: (message) => appendRunLog(recordDirectory, message),
    });
    const patchRenderer = new Flat32CpuSoftShaderSceneRenderer({
        width: patchSize,
        height: patchSize,
        verticalFovDegrees: patchFovDegrees,
        incidentCacheEnabled,
        executionControls: subjectiveExecutionControls,
        onProgress: (message) => appendRunLog(recordDirectory, `patch ${message}`),
    });

    for (const sceneState of sceneStates) {
        const acquisition = acquisitions.find((entry) => entry.sceneId === sceneState.id);
        await appendRunLog(recordDirectory, `${sceneState.id} CPU globe render started.`);
        const main = await mainRenderer.render(sceneState, {
            moonEphemerisState: acquisition.renderState,
            cameraTarget: 'presentation',
        });
        const moonPatch = await patchRenderer.render(sceneState, {
            moonEphemerisState: acquisition.renderState,
            cameraTarget: 'moon',
        });
        const sunPatch = await patchRenderer.render(sceneState, {
            moonEphemerisState: acquisition.renderState,
            cameraTarget: 'sun',
        });
        const paths = await writeCaseImages({
            sceneId: sceneState.id,
            main,
            moonPatch,
            sunPatch,
        });
        renderedCases.push(Object.freeze({
            sceneState,
            acquisition,
            main,
            moonPatch,
            sunPatch,
            paths,
            meanMainDisplayLuminance: meanByteLuminance(main.softShaderBytes),
            mainCanonicalStats: byteImageReviewStats(main.softShaderBytes),
            mainReviewStats: byteImageReviewStats(main.reviewSrgbBytes),
            meanMoonPatchLuminance: meanByteLuminance(moonPatch.softShaderBytes),
            meanSunPatchLuminance: meanByteLuminance(sunPatch.softShaderBytes),
        }));
        await appendRunLog(recordDirectory, `${sceneState.id} CPU globe images written.`);
    }

    overviewPaths = await writeOverviewImages(renderedCases);
    const allImagePaths = [
        ...renderedCases.flatMap((entry) => Object.values(entry.paths)),
        ...Object.values(overviewPaths),
    ];
    imageStats = await Promise.all(allImagePaths.map(async (path) => Object.freeze({
        path: relative(recordDirectory, path).replaceAll('\\', '/'),
        sizeBytes: (await stat(path)).size,
    })));
} catch (error) {
    failures.push(failure('globe-scene-experiment-crash', error));
    await appendRunLog(recordDirectory, `${runnerName} crash: ${error.message}`);
    try {
        await writeEphemerisEvidence('incomplete', acquisitions);
    } catch (evidenceError) {
        failures.push(failure('ephemeris-evidence-write-after-crash', evidenceError));
    }
}

const diagnosticCases = renderedCases.map((entry) => Object.freeze({
    sceneId: entry.sceneState.id,
    observerLocation: entry.sceneState.location,
    timeSourceLocation: entry.sceneState.timeLocation,
    time: entry.sceneState.time,
    meanMainDisplayLuminance: entry.meanMainDisplayLuminance,
    mainCanonicalStats: entry.mainCanonicalStats,
    mainReviewStats: entry.mainReviewStats,
    meanMoonPatchLuminance: entry.meanMoonPatchLuminance,
    meanSunPatchLuminance: entry.meanSunPatchLuminance,
    paths: Object.freeze(Object.fromEntries(Object.entries(entry.paths).map(([key, path]) => [
        key,
        relative(recordDirectory, path).replaceAll('\\', '/'),
    ]))),
    main: entry.main.diagnostics,
    moonPatch: patchDiagnostics(entry.moonPatch.diagnostics),
    sunPatch: patchDiagnostics(entry.sunPatch.diagnostics),
}));
const criteria = buildCriteria({
    sceneStates,
    acquisitions,
    renderedCases,
    imageStats,
    acquireHorizons,
});
const reviewabilityCriterionNames = new Set([
    'main-review-srgb-daylight-and-twilight-frames-are-reviewable',
    'san-jose-post-sunset-review-frame-retains-celestial-signal',
    'review-images-apply-output-transfer-without-changing-canonical-buffer',
    'all-case-and-overview-pngs-are-written',
]);
const reviewabilityCriteria = criteria.filter((entry) =>
    reviewabilityCriterionNames.has(entry.name));
const mechanicalCriteria = criteria.filter((entry) =>
    !reviewabilityCriterionNames.has(entry.name));
for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(Object.freeze({ id: entry.name, message: entry.details ?? 'Criterion rejected.' }));
    }
}
const mechanicalStatus = mechanicalCriteria.every((entry) => entry.status === 'accepted')
    ? 'accepted'
    : 'rejected';
const reviewabilityStatus = reviewabilityCriteria.every((entry) => entry.status === 'accepted')
    ? 'accepted'
    : 'rejected';
const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    mechanicalStatus,
    reviewabilityStatus,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    cases: diagnosticCases,
    matchedSlotComparisons: matchedSlotDiagnostics(renderedCases),
    imageStats,
});
await writeJson(recordDirectory, 'result.json', {
    status,
    mechanicalStatus,
    reviewabilityStatus,
    caseCount: renderedCases.length,
    expectedCaseCount: caseRequests.length,
    acquisitionCount: acquisitions.length,
    rawQueryCount: acquisitions.reduce((sum, entry) => sum + entry.rawQueries.length, 0),
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    overviewPaths: Object.freeze(Object.fromEntries(Object.entries(overviewPaths).map(([key, path]) => [
        key,
        relative(recordDirectory, path).replaceAll('\\', '/'),
    ]))),
    failures,
});
await writeText(recordDirectory, 'report.md', reportMarkdown({
    status,
    mechanicalStatus,
    reviewabilityStatus,
    renderedCases,
    criteria,
    failures,
}));
await appendRunLog(recordDirectory, `${runnerName} ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    mechanicalStatus,
    reviewabilityStatus,
    recordDirectory,
    caseCount: renderedCases.length,
    acquisitionCount: acquisitions.length,
    criteriaCount: criteria.length,
    failureCount: failures.length,
    overviewPaths,
}));
if (status !== 'accepted') process.exitCode = 1;

async function writeCaseImages({ sceneId, main, moonPatch, sunPatch }) {
    const outputs = {
        main: resolve(imagesDirectory, `${sceneId}-cpu-soft-shader.png`),
        mainReview: resolve(imagesDirectory, `${sceneId}-review-srgb.png`),
        mainObjectId: resolve(imagesDirectory, `${sceneId}-object-id.png`),
        moonPatch: resolve(imagesDirectory, `${sceneId}-moon-angular-patch.png`),
        moonPatchReview: resolve(imagesDirectory, `${sceneId}-moon-angular-patch-review-srgb.png`),
        moonPatchObjectId: resolve(imagesDirectory, `${sceneId}-moon-angular-patch-object-id.png`),
        sunPatch: resolve(imagesDirectory, `${sceneId}-sun-angular-patch.png`),
        sunPatchReview: resolve(imagesDirectory, `${sceneId}-sun-angular-patch-review-srgb.png`),
        sunPatchObjectId: resolve(imagesDirectory, `${sceneId}-sun-angular-patch-object-id.png`),
    };
    await writePng(outputs.main, width, height, main.softShaderBytes);
    await writePng(outputs.mainReview, width, height, main.reviewSrgbBytes);
    await writePng(outputs.mainObjectId, width, height, main.objectIdBytes);
    await writePng(outputs.moonPatch, patchSize, patchSize, moonPatch.softShaderBytes);
    await writePng(outputs.moonPatchReview, patchSize, patchSize, moonPatch.reviewSrgbBytes);
    await writePng(outputs.moonPatchObjectId, patchSize, patchSize, moonPatch.objectIdBytes);
    await writePng(outputs.sunPatch, patchSize, patchSize, sunPatch.softShaderBytes);
    await writePng(outputs.sunPatchReview, patchSize, patchSize, sunPatch.reviewSrgbBytes);
    await writePng(outputs.sunPatchObjectId, patchSize, patchSize, sunPatch.objectIdBytes);
    return Object.freeze(outputs);
}

async function writeOverviewImages(cases) {
    const columns = 4;
    const paths = Object.freeze({
        main: resolve(imagesDirectory, 'overview-globe-scenes.png'),
        mainReview: resolve(imagesDirectory, 'overview-globe-scenes-review-srgb.png'),
        mainObjectId: resolve(imagesDirectory, 'overview-globe-object-id.png'),
        moonPatch: resolve(imagesDirectory, 'overview-moon-angular-patches.png'),
        moonPatchReview: resolve(imagesDirectory, 'overview-moon-angular-patches-review-srgb.png'),
        sunPatch: resolve(imagesDirectory, 'overview-sun-angular-patches.png'),
        sunPatchReview: resolve(imagesDirectory, 'overview-sun-angular-patches-review-srgb.png'),
    });
    await writePng(paths.main, width * columns, height * 2,
        montageBytes(cases.map((entry) => entry.main.softShaderBytes), width, height, columns));
    await writePng(paths.mainReview, width * columns, height * 2,
        montageBytes(cases.map((entry) => entry.main.reviewSrgbBytes), width, height, columns));
    await writePng(paths.mainObjectId, width * columns, height * 2,
        montageBytes(cases.map((entry) => entry.main.objectIdBytes), width, height, columns));
    await writePng(paths.moonPatch, patchSize * columns, patchSize * 2,
        montageBytes(cases.map((entry) => entry.moonPatch.softShaderBytes), patchSize, patchSize, columns));
    await writePng(paths.moonPatchReview, patchSize * columns, patchSize * 2,
        montageBytes(cases.map((entry) => entry.moonPatch.reviewSrgbBytes), patchSize, patchSize, columns));
    await writePng(paths.sunPatch, patchSize * columns, patchSize * 2,
        montageBytes(cases.map((entry) => entry.sunPatch.softShaderBytes), patchSize, patchSize, columns));
    await writePng(paths.sunPatchReview, patchSize * columns, patchSize * 2,
        montageBytes(cases.map((entry) => entry.sunPatch.reviewSrgbBytes), patchSize, patchSize, columns));
    return paths;
}

function buildCriteria({
    sceneStates: states,
    acquisitions: acquired,
    renderedCases: rendered,
    imageStats: stats,
    acquireHorizons: acquisitionEnabled,
}) {
    const complete = rendered.length === 8;
    const acquisitionComplete = acquired.length === 8;
    const mainDiagnostics = rendered.map((entry) => entry.main.diagnostics);
    const patchDiagnosticsRows = rendered.flatMap((entry) => [
        entry.moonPatch.diagnostics,
        entry.sunPatch.diagnostics,
    ]);
    const mainMoonEntries = rendered.filter((entry) =>
        (entry.main.diagnostics.boundaryBodyHitCounts.moon ?? 0) > 0);
    const maximumFlat32SunDirectionErrorRadians = complete
        ? Math.max(...mainDiagnostics.map((entry) =>
            entry.globeEphemerisState.sun.flat32ApproximateAngularErrorRadians))
        : Number.POSITIVE_INFINITY;

    return Object.freeze([
        criterion('exact-eight-case-two-observer-four-time-matrix', states.length === 8
            && states.map((entry) => entry.id).join(',') === caseRequests.map((entry) => entry.id).join(',')),
        criterion('each-location-keeps-authored-date-and-union-uses-san-jose-event-offsets',
            states.length === 8 && states.every((entry) => {
                const request = caseRequests.find((candidate) => candidate.id === entry.id);
                return entry.time.finalTimeIso === request.expectedTimeIso
                    && entry.time.location.key === entry.location.key
                    && entry.timeLocationOverrideApplied === false;
            })),
        criterion('horizons-acquired-exact-state-for-every-observer-and-epoch',
            acquisitionEnabled && acquisitionComplete
            && acquired.every((entry) => {
                const expectedEpochIso = states.find((state) =>
                    state.id === entry.sceneId).time.finalTimeIso;
                const expectedQueryOwners = [
                    Object.freeze({ target: '301', observerId: null }),
                    Object.freeze({ target: '10', observerId: null }),
                    Object.freeze({ target: '301', observerId: entry.state.observerState.id }),
                    Object.freeze({ target: '10', observerId: entry.state.observerState.id }),
                ];
                return entry.rawQueries.length === expectedQueryOwners.length
                    && entry.rawQueries.every((query, index) =>
                        query.target === expectedQueryOwners[index].target
                        && query.observerId === expectedQueryOwners[index].observerId
                        && query.requestedEpochIso === expectedEpochIso
                        && query.returnedEpochIso === expectedEpochIso
                        && Number.isFinite(query.returnedEpochJulianDateUt)
                        && typeof query.returnedEpochCalendarDateUt === 'string'
                        && rawQueryUrlMatches(
                            query,
                            expectedQueryOwners[index],
                            expectedEpochIso,
                            entry.state.observerState,
                        ))
                    && entry.state.worldState.epochIso === expectedEpochIso;
            })),
        criterion('all-topocentric-observers-use-flat32-five-meter-height',
            acquisitionComplete && acquired.every((entry) =>
                entry.state.observerState.elevationKm === 0.005)),
        criterion('independent-moon-and-sun-observer-reconstructions-agree',
            acquisitionComplete && acquired.every((entry) =>
                entry.state.observerState.validation.observerPositionAgreementKm < 1e-5)),
        criterion('every-scene-renders-its-own-returned-epoch-world-state',
            acquisitionComplete && acquired.every((entry) =>
                entry.renderState.worldState.epochIso === entry.state.worldState.epochIso
                && arraysNear(
                    entry.renderState.worldState.moon.positionKm,
                    entry.state.worldState.moon.positionKm,
                    0,
                )
                && arraysNear(
                    entry.renderState.worldState.sun.positionKm,
                    entry.state.worldState.sun.positionKm,
                    0,
                ))),
        criterion('j2000-observer-local-transform-agrees-with-flat32-sun-direction',
            complete && maximumFlat32SunDirectionErrorRadians
                < flat32ApproximateSunDirectionToleranceRadians,
            `Maximum ${maximumFlat32SunDirectionErrorRadians} rad; named Flat32-approximation coherence tolerance ${flat32ApproximateSunDirectionToleranceRadians} rad.`),
        criterion('moon-position-distance-size-and-phase-are-finite-per-case',
            complete && mainDiagnostics.every((entry) => {
                const moon = entry.globeEphemerisState.moon;
                return unitVector(moon.directionModel)
                    && moon.distanceKm > 300000 && moon.distanceKm < 450000
                    && moon.angularRadiusRadians > 0.003 && moon.angularRadiusRadians < 0.006
                    && moon.illuminatedFraction >= 0 && moon.illuminatedFraction <= 1;
            })),
        criterion('moon-uses-per-ray-physical-sphere-phase-shading',
            complete && rendered.every((entry) => {
                const descriptor = entry.moonPatch.diagnostics.celestialProvider.moon;
                const runtime = entry.moonPatch.diagnostics.celestialProviderRuntime;
                return descriptor.shadingPolicy
                    === 'resolved-per-ray-lambert-sphere-and-unresolved-disk-integrated-lambert-phase'
                    && runtime.moonCoverageSampleCount > 0
                    && runtime.moonExactSphereHitCount > 0
                    && runtime.resolvedMoonSampleCount > 0
                    && runtime.minimumMoonSurfaceCosine >= 0
                    && runtime.maximumMoonSurfaceCosine <= 1
                    && runtime.maximumMoonSurfaceCosine > nearFullMoonMinimumSampledSurfaceCosine;
            })),
        criterion('subpixel-main-moon-uses-nonzero-disk-integrated-phase-shading',
            complete && mainMoonEntries.length > 0
                && mainMoonEntries.every((entry) => {
                    const runtime = entry.main.diagnostics.celestialProviderRuntime;
                    return runtime.unresolvedMoonSampleCount > 0
                        && runtime.maximumMoonSurfaceCosine > 0;
                })),
        criterion('moon-remains-visible-or-solid-scene-occluded-at-physical-direction',
            complete && rendered.every((entry) => bodyEvidence(entry.moonPatch.diagnostics, 'moon') !== 'missing')),
        criterion('sun-remains-visible-or-solid-scene-occluded-at-physical-direction',
            complete && rendered.every((entry) => bodyEvidence(entry.sunPatch.diagnostics, 'distant-sun') !== 'missing')),
        criterion('sun-source-owner-uses-exact-ephemeris-direction-and-angular-radius',
            complete && mainDiagnostics.every((entry) =>
                entry.celestialProvider.sourceOwner === 'DistantSunLightSource'
                && entry.celestialProvider.sourceCandidatePolicy
                    === 'source-owned-distant-sun-visible-body-provider'
                && arraysNear(
                    entry.celestialProvider.sun.directionModel,
                    entry.globeEphemerisState.sun.directionModel,
                    1e-15,
                )
                && Math.abs(entry.celestialProvider.sun.angularRadiusRadians
                    - entry.globeEphemerisState.sun.angularRadiusRadians) < 1e-15)),
        criterion('spherical-ground-and-six-authored-objects-are-declared',
            complete && mainDiagnostics.every((entry) =>
                entry.solidEndpointIds.length === 7
                && entry.solidEndpointIds[0] === FLAT32_SCENE_SNAPSHOT.globeGround.objectId
                && entry.reviewObjectDiagnostics.length === 6)),
        criterion('sun-moon-stars-use-external-boundary-not-solid-raycast',
            complete && mainDiagnostics.every((entry) =>
                Object.keys(entry.objectHitCounts).every((id) =>
                    !entry.externalBoundaryIds.includes(id)))),
        criterion('subjective-transport-profile-has-multi-altitude-direction-cache',
            complete && [...mainDiagnostics, ...patchDiagnosticsRows].every((entry) =>
                entry.renderer.executionControls.incidentAltitudeBinCount >= 12
                && entry.renderer.executionControls.incidentDirectionCount >= 8
                && entry.renderer.executionControls.pathIntervalCount >= 12
                && entry.renderer.executionControls.sourceTransmittanceIntervalCount >= 6)),
        criterion('main-and-patch-renders-have-finite-exact-spectral-composition',
            complete && [...mainDiagnostics, ...patchDiagnosticsRows].every((entry) =>
                entry.allSpectralOutputsFiniteNonnegative
                && entry.maximumCompositionEquationError < 1e-12
                && entry.aggregateDiagnostics.invalidPixelCount === 0
                && entry.aggregateDiagnostics.errorCount === 0)),
        criterion('all-solid-hits-precede-finite-moon',
            complete && [...mainDiagnostics, ...patchDiagnosticsRows].every((entry) =>
                entry.allSolidHitsPrecedeFiniteCelestial)),
        criterion('location-owned-schedules-produce-distinct-moon-observations',
            complete && timeCases.every((timeCase) => {
                const pair = rendered.filter((entry) => entry.sceneState.id.endsWith(`-${timeCase.id}`));
                return pair.length === 2 && angleBetween(
                    pair[0].main.diagnostics.globeEphemerisState.moon.directionModel,
                    pair[1].main.diagnostics.globeEphemerisState.moon.directionModel,
                ) > 1e-5;
            })),
        criterion('main-review-srgb-daylight-and-twilight-frames-are-reviewable',
            complete && rendered
                .filter((entry) => entry.sceneState.id !== 'san-jose-globe-sunset-plus-1')
                .every((entry) => entry.mainReviewStats.nonBlackFraction >= 0.25
                    && entry.mainReviewStats.maximumLuminanceByte >= 8
                    && entry.mainReviewStats.uniqueLuminanceCodeCount >= 8
                    && entry.mainReviewStats.exactWhiteFraction < 0.5)),
        criterion('san-jose-post-sunset-review-frame-retains-celestial-signal',
            complete && rendered.some((entry) =>
                entry.sceneState.id === 'san-jose-globe-sunset-plus-1'
                && entry.mainReviewStats.nonBlackPixelCount >= 8
                && entry.mainReviewStats.maximumLuminanceByte >= 2
                && Object.keys(entry.main.diagnostics.boundaryBodyHitCounts).some((id) =>
                    id === 'moon' || id.includes('star')))),
        criterion('review-images-apply-output-transfer-without-changing-canonical-buffer',
            complete && rendered.every((entry) =>
                entry.main.softShaderBytes.length === entry.main.reviewSrgbBytes.length
                && byteBuffersDiffer(entry.main.softShaderBytes, entry.main.reviewSrgbBytes))),
        criterion('cpu-only-no-browser-or-gpu-shader',
            complete && [...mainDiagnostics, ...patchDiagnosticsRows].every((entry) =>
                entry.gpuShaderUsed === false && entry.browserUsed === false)),
        criterion('all-case-and-overview-pngs-are-written',
            stats.length === 79 && stats.every((entry) => entry.sizeBytes > 0)),
        criterion('raw-horizons-evidence-is-retained',
            acquisitionComplete
            && acquired.reduce((sum, entry) => sum + entry.rawQueries.length, 0) === 32
            && acquired.every((entry) => entry.rawQueries.every((query) =>
                typeof query.payload?.result === 'string'
                && typeof query.apiVersion === 'string'
                && /^[a-f0-9]{64}$/.test(query.queryHash)))),
    ]);
}

function bodyEvidence(diagnostics, bodyId) {
    if ((diagnostics.boundaryBodyHitCounts[bodyId] ?? 0) > 0) {
        return 'visible';
    }

    const occludingPixel = diagnostics.selectedPixels.find((pixel) =>
        pixel.boundaryWithSceneOcclusion?.bodyId === bodyId
        && pixel.boundaryWithSceneOcclusion?.state === 'occluded'
        && diagnostics.solidEndpointIds.includes(pixel.hitObjectId));
    return occludingPixel ? `scene-occluded:${occludingPixel.hitObjectId}` : 'missing';
}

function rawQueryUrlMatches(query, expectedOwner, expectedEpochIso, observerState) {
    const params = new URL(query.url).searchParams;
    const topocentric = expectedOwner.observerId !== null;
    const expectedSite = `'${observerState.longitudeDegrees},${observerState.latitudeDegrees},${observerState.elevationKm}'`;
    return params.get('COMMAND') === `'${expectedOwner.target}'`
        && params.get('CENTER') === (topocentric ? "'coord@399'" : "'500@399'")
        && params.get('TLIST') === `'${expectedEpochIso.replace('T', ' ').replace('Z', '')}'`
        && params.get('TIME_TYPE') === "'UT'"
        && params.get('EPHEM_TYPE') === "'VECTORS'"
        && params.get('REF_PLANE') === "'ECLIPTIC'"
        && params.get('REF_SYSTEM') === "'ICRF'"
        && params.get('OUT_UNITS') === "'KM-S'"
        && params.get('VEC_CORR') === "'NONE'"
        && (!topocentric || (params.get('COORD_TYPE') === "'GEODETIC'"
            && params.get('SITE_COORD') === expectedSite));
}

function assertSceneSchedule(states) {
    for (const state of states) {
        const request = caseRequests.find((candidate) => candidate.id === state.id);
        if (!request
            || state.time.finalTimeIso !== request.expectedTimeIso
            || state.time.location.key !== state.location.key
            || state.timeLocationOverrideApplied) {
            throw new Error(`Scene ${state.id} did not preserve its location-owned date and expected event offset.`);
        }
    }
}

function sceneStateInputSummary(state) {
    return Object.freeze({
        id: state.id,
        earthMode: state.earthMode,
        observerLocation: state.location,
        timeSourceLocation: state.timeLocation,
        timeLocationOverrideApplied: state.timeLocationOverrideApplied,
        synchronizedTimeIso: state.time.synchronizedTimeIso,
        basisResolvedTimeIso: state.time.basisResolvedTimeIso,
        finalTimeIso: state.time.finalTimeIso,
        eventAvailability: state.time.eventAvailability,
        sourceSnapshot: state.source,
        presentationFrame: state.presentationFrame,
        reviewBoxes: state.reviewBoxes,
        starCalibration: state.starCalibration,
        objectInventory: state.objectInventory,
    });
}

function patchDiagnostics(value) {
    const { sceneState, reviewObjectDiagnostics, ...rest } = value;
    return Object.freeze({
        ...rest,
        omittedSceneStateId: sceneState.id,
        omittedReviewObjectDiagnosticCount: reviewObjectDiagnostics.length,
    });
}

function matchedSlotDiagnostics(rendered) {
    return Object.freeze(timeCases.map((timeCase) => {
        const pair = rendered.filter((entry) => entry.sceneState.id.endsWith(`-${timeCase.id}`));
        if (pair.length !== 2) {
            return Object.freeze({ eventId: timeCase.id, status: 'missing-pair' });
        }
        const leftMoon = pair[0].main.diagnostics.globeEphemerisState.moon;
        const rightMoon = pair[1].main.diagnostics.globeEphemerisState.moon;
        return Object.freeze({
            eventId: timeCase.id,
            epochIsoByObserver: Object.freeze(Object.fromEntries(pair.map((entry) => [
                entry.sceneState.location.key,
                entry.sceneState.time.finalTimeIso,
            ]))),
            observerIds: Object.freeze(pair.map((entry) => entry.sceneState.location.key)),
            nonSimultaneousMoonDirectionSeparationRadians: angleBetween(
                leftMoon.directionModel,
                rightMoon.directionModel,
            ),
            moonDistanceDifferenceKm: leftMoon.distanceKm - rightMoon.distanceKm,
            illuminatedFractionDifference: leftMoon.illuminatedFraction - rightMoon.illuminatedFraction,
            mainMeanLuminanceDifference: pair[0].meanMainDisplayLuminance - pair[1].meanMainDisplayLuminance,
        });
    }));
}

function reportMarkdown({
    status,
    mechanicalStatus,
    reviewabilityStatus,
    renderedCases: rendered,
    criteria,
    failures: failed,
}) {
    const maximumFlat32SunDirectionErrorRadians = rendered.length > 0
        ? Math.max(...rendered.map((entry) =>
            entry.main.diagnostics.globeEphemerisState.sun.flat32ApproximateAngularErrorRadians))
        : null;
    const rows = rendered.map((entry) => {
        const ephemeris = entry.main.diagnostics.globeEphemerisState;
        const moonEvidence = bodyEvidence(entry.moonPatch.diagnostics, 'moon');
        const sunEvidence = bodyEvidence(entry.sunPatch.diagnostics, 'distant-sun');
        return `| ${entry.sceneState.id} | ${entry.sceneState.time.finalTimeIso} | ${(ephemeris.moon.illuminatedFraction * 100).toFixed(3)}% | ${ephemeris.moon.distanceKm.toFixed(1)} | ${(entry.mainReviewStats.nonBlackFraction * 100).toFixed(2)}% | ${entry.mainReviewStats.maximumLuminanceByte.toFixed(2)} | ${moonEvidence} | ${sunEvidence} |`;
    }).join('\n');

    return `# Report

Status: **${status}**

Mechanical status: **${mechanicalStatus}**

Reviewability status: **${reviewabilityStatus}**

Each location keeps its authored Flat32 date. San Jose uses its four globe
events; Union Glacier applies the same San Jose event offsets around its own
December solar noon. Every scene owns returned-epoch-verified Horizons state
and a 5 m topocentric observer. The Moon is never moved for framing. Main
images retain the Flat32 Union-startup camera; narrow angular patches rotate
the camera to the physical Moon or Sun direction.

| Case | Exact UTC | Moon illuminated | Moon distance km | Review nonblack | Review max byte | Moon patch | Sun patch |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
${rows}

- Ground is an exact sphere. The six authored box centers preserve Flat32's
  spherical placement and yaw-only orientation; they are not independently
  tilted to each local radial up.
- DistantSunLightSource owns atmospheric illumination and the visible Sun disk
  from the exact Horizons direction and angular radius.
- The Moon is a finite opaque sphere at its topocentric distance. Resolved
  patches use per-ray surface normals; subpixel main-frame disks use the
  disk-integrated Lambert phase response rather than a dark-limb point sample.
- The neutral lunar albedo/exposure is still prototype calibration; geometry,
  angular size, phase, horizon occlusion, and depth are the claims under test.
- The 192 Flat32 stars remain fixed synthetic scene diagnostics, not a
  sidereal catalog. Moon/star overlaps in these images are not astronomical
  occultation claims.
- The exact Horizons Sun direction differs from Flat32's approximate solar
  synchronizer by at most ${maximumFlat32SunDirectionErrorRadians === null ? 'n/a' : `${maximumFlat32SunDirectionErrorRadians} rad (${(maximumFlat32SunDirectionErrorRadians * 180 / Math.PI).toFixed(4)} degrees)`} in this matrix. The named ${flat32ApproximateSunDirectionToleranceRadians} rad
  tolerance is a coherence check on the copied Flat32 approximation, not an
  ephemeris-accuracy limit.
- Canonical PNGs preserve the linear-sRGB byte path. Separately labeled review
  PNGs apply the sRGB output transfer before 8-bit quantization; they do not
  change spectral radiance or exposure.
- Record 025 remains immutable and mechanically useful, but is invalid as the
  subjective baseline because five of eight main frames were effectively
  black. This runner corrects its Union schedule, output encoding, Moon
  undersampling, and missing reviewability criteria.

Accepted criteria: ${criteria.filter((entry) => entry.status === 'accepted').length}/${criteria.length}.
Failures: ${failed.length === 0 ? 'none' : failed.map((entry) => entry.id).join(', ')}.

Overview images:

- \`images/overview-globe-scenes.png\`
- \`images/overview-globe-scenes-review-srgb.png\`
- \`images/overview-globe-object-id.png\`
- \`images/overview-moon-angular-patches.png\`
- \`images/overview-moon-angular-patches-review-srgb.png\`
- \`images/overview-sun-angular-patches.png\`
- \`images/overview-sun-angular-patches-review-srgb.png\`
`;
}

function createTimeCase(id, timePresetKey, hourOffset, expectedSanJoseTimeIso) {
    return Object.freeze({
        id,
        timePresetKey,
        hourOffset,
        expectedSanJoseTimeIso,
        sanJoseOffsetHours: (
            new Date(expectedSanJoseTimeIso).getTime()
            - new Date(sanJoseSolarNoonIso).getTime()
        ) / (60 * 60 * 1000),
    });
}

function createCaseRequest(locationKey, timeCase) {
    const unionGlacier = locationKey === 'union-glacier';
    return Object.freeze({
        id: `${locationKey}-globe-${timeCase.id}`,
        eventId: timeCase.id,
        locationKey,
        timeLocationKey: locationKey,
        earthMode: 'globe',
        timePresetKey: unionGlacier ? 'globe-solar-noon' : timeCase.timePresetKey,
        hourOffset: unionGlacier ? timeCase.sanJoseOffsetHours : timeCase.hourOffset,
        expectedTimeIso: unionGlacier
            ? addHoursIso(unionGlacierSolarNoonIso, timeCase.sanJoseOffsetHours)
            : timeCase.expectedSanJoseTimeIso,
        schedulePolicy: unionGlacier
            ? 'union-authored-date-plus-san-jose-event-offset'
            : 'san-jose-authored-globe-event',
    });
}

function addHoursIso(timeIso, hours) {
    return new Date(
        new Date(timeIso).getTime() + Math.round(hours * 60 * 60 * 1000),
    ).toISOString();
}

async function writeEphemerisEvidence(acquisitionStatus, values) {
    await writeJson(recordDirectory, 'ephemeris-evidence.json', {
        acquisitionStatus,
        expectedAcquisitionCount: caseRequests.length,
        acquisitionCount: values.length,
        rawQueryCount: values.reduce((sum, entry) => sum + entry.rawQueries.length, 0),
        acquisitions: values,
    });
}

async function createFreshRecordDirectory(value) {
    const root = resolve('tmp/atmosphere/reconciliation');
    const target = resolve(value);
    if (dirname(target) !== root || !/^\d{3}-[a-z0-9][a-z0-9-]*$/.test(basename(target))) {
        throw new Error('Record path must be a direct NNN-kebab-case child of tmp/atmosphere/reconciliation.');
    }
    await mkdir(target, { recursive: false });
}

async function resolveGitHeadRevision() {
    const gitDirectory = resolve('.git');
    const head = (await readFile(resolve(gitDirectory, 'HEAD'), 'utf8')).trim();
    if (!head.startsWith('ref: ')) return head;
    const reference = head.slice('ref: '.length);
    try {
        return (await readFile(resolve(gitDirectory, reference), 'utf8')).trim();
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    const packedReferences = await readFile(resolve(gitDirectory, 'packed-refs'), 'utf8');
    const match = packedReferences.split(/\r?\n/)
        .map((line) => line.trim().split(' '))
        .find(([, name]) => name === reference);
    if (!match) throw new Error(`Unable to resolve Git HEAD reference ${reference}.`);
    return match[0];
}

async function sha256File(path) {
    return createHash('sha256').update(await readFile(resolve(path))).digest('hex');
}

async function sha256Tree(rootPath) {
    const root = resolve(rootPath);
    const files = await collectTreeFiles(root);
    const entries = await Promise.all(files.map(async (path) => Object.freeze([
        relative(root, path).replaceAll('\\', '/'),
        await sha256File(path),
    ])));
    return Object.freeze(Object.fromEntries(entries));
}

async function collectTreeFiles(directory) {
    const entries = (await readdir(directory, { withFileTypes: true }))
        .sort((left, right) => left.name.localeCompare(right.name));
    const paths = [];
    for (const entry of entries) {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) {
            paths.push(...await collectTreeFiles(path));
        } else if (entry.isFile()) {
            paths.push(path);
        }
    }
    return paths;
}

function montageBytes(images, imageWidth, imageHeight, columns) {
    const rows = Math.ceil(images.length / columns);
    const outputWidth = imageWidth * columns;
    const output = new Uint8Array(outputWidth * imageHeight * rows * 4);
    images.forEach((bytes, imageIndex) => {
        const column = imageIndex % columns;
        const row = Math.floor(imageIndex / columns);
        for (let y = 0; y < imageHeight; y += 1) {
            const sourceStart = y * imageWidth * 4;
            const destinationStart = ((row * imageHeight + y) * outputWidth + column * imageWidth) * 4;
            output.set(bytes.subarray(sourceStart, sourceStart + imageWidth * 4), destinationStart);
        }
    });
    return output;
}

function meanByteLuminance(bytes) {
    let sum = 0;
    for (let offset = 0; offset < bytes.length; offset += 4) {
        sum += (0.2126 * bytes[offset] + 0.7152 * bytes[offset + 1] + 0.0722 * bytes[offset + 2]) / 255;
    }
    return sum / (bytes.length / 4);
}

function byteImageReviewStats(bytes) {
    const luminances = [];
    const luminanceCodes = new Set();
    let nonBlackPixelCount = 0;
    let exactWhitePixelCount = 0;
    let maximumLuminanceByte = 0;
    for (let offset = 0; offset < bytes.length; offset += 4) {
        const red = bytes[offset];
        const green = bytes[offset + 1];
        const blue = bytes[offset + 2];
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        luminances.push(luminance);
        luminanceCodes.add(Math.round(luminance));
        if (red !== 0 || green !== 0 || blue !== 0) nonBlackPixelCount += 1;
        if (red === 255 && green === 255 && blue === 255) exactWhitePixelCount += 1;
        maximumLuminanceByte = Math.max(maximumLuminanceByte, luminance);
    }
    luminances.sort((left, right) => left - right);
    const pixelCount = luminances.length;
    return Object.freeze({
        pixelCount,
        nonBlackPixelCount,
        nonBlackFraction: nonBlackPixelCount / pixelCount,
        exactBlackFraction: 1 - nonBlackPixelCount / pixelCount,
        exactWhitePixelCount,
        exactWhiteFraction: exactWhitePixelCount / pixelCount,
        minimumLuminanceByte: luminances[0],
        maximumLuminanceByte,
        percentile05LuminanceByte: percentile(luminances, 0.05),
        percentile50LuminanceByte: percentile(luminances, 0.5),
        percentile95LuminanceByte: percentile(luminances, 0.95),
        uniqueLuminanceCodeCount: luminanceCodes.size,
    });
}

function percentile(sortedValues, fraction) {
    const index = Math.min(
        sortedValues.length - 1,
        Math.max(0, Math.round(fraction * (sortedValues.length - 1))),
    );
    return sortedValues[index];
}

function byteBuffersDiffer(left, right) {
    return left.some((value, index) => value !== right[index]);
}

function arraysNear(left, right, tolerance) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
        && left.every((value, index) => Math.abs(value - right[index]) <= tolerance);
}

function unitVector(value) {
    return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
        && Math.abs(Math.hypot(...value) - 1) < 1e-9;
}

function angleBetween(left, right) {
    const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
    return Math.acos(Math.min(1, Math.max(-1, dot)));
}

function criterion(name, accepted, details = null) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected', ...(details ? { details } : {}) });
}

function failure(id, error) {
    return Object.freeze({ id, message: error.message, stack: error.stack });
}

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) return fallback;
    const value = Number(process.argv[index + 1]);
    if (!Number.isFinite(value) || value <= 0) throw new TypeError(`${name} requires a positive number.`);
    return value;
}
