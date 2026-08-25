import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import * as THREE from 'three';

import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/consts.js';
import HorizonsGlobeMoonStateProvider from '../globe-moon/HorizonsGlobeMoonStateProvider.js';
import { writePng } from '../outputs/pngWriter.js';
import Flat32CpuSoftShaderSceneRenderer from '../subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js';
import GlobeEphemerisSceneAdapter from '../subjective-scenes/GlobeEphemerisSceneAdapter.js';
import Flat32SceneStateResolver from '../subjective-scenes/Flat32SceneStateResolver.js';
import FLAT32_SCENE_SNAPSHOT from '../subjective-scenes/flat32SceneSnapshot.js';
import { RECORD_020_PROTOTYPE_STAR_CALIBRATION } from '../subjective-scenes/consts.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'm5Flat32ControlledCelestialVisibilityCpuSoftShader';
const recordDirectory = parseRecordDirectory(process.argv);
const acquireHorizons = process.argv.includes('--acquire-horizons');
const starsOnly = process.argv.includes('--stars-only');
const syntheticStarRadiancePolicy = process.argv.includes('--record-020-magnitude-stars')
    ? 'record-020-prototype-magnitude'
    : 'legacy-linear-working-appearance';
const imagesDirectory = resolve(recordDirectory, 'images');
const controlledMoonDirectionScene = Object.freeze([
    0.8217974881,
    0.4943363306,
    -0.2833381035,
]);
const controlledMoonOverrideId = 'san-jose-noon-controlled-day-moon';
const starTargetIds = Object.freeze([
    'flat32-synthetic-star-analog-137',
    'flat32-synthetic-star-analog-150',
]);
const executionControls = Object.freeze({
    pathIntervalCount: 12,
    sourceTransmittanceIntervalCount: 6,
    incidentDirectionCount: 8,
    incidentAltitudeBinCount: 12,
    cachePathIntervalCount: 12,
});
const viewSpecs = Object.freeze([
    Object.freeze({
        id: 'san-jose-noon-controlled-moon-context',
        sceneId: 'san-jose-globe-solar-noon',
        width: 512,
        height: 384,
        verticalFovDegrees: 45,
        cameraTarget: 'presentation',
        controlledMoon: true,
        analysisKind: 'moon-context',
    }),
    Object.freeze({
        id: 'san-jose-noon-controlled-moon-detail',
        sceneId: 'san-jose-globe-solar-noon',
        width: 160,
        height: 160,
        verticalFovDegrees: 2,
        cameraTarget: 'moon',
        controlledMoon: true,
        analysisKind: 'moon-detail',
    }),
    Object.freeze({
        id: 'san-jose-noon-star-field',
        sceneId: 'san-jose-globe-solar-noon',
        width: 256,
        height: 256,
        verticalFovDegrees: 10,
        cameraTarget: 'custom-star-field',
        controlledMoon: false,
        analysisKind: 'star-noon',
    }),
    Object.freeze({
        id: 'san-jose-post-sunset-star-field',
        sceneId: 'san-jose-globe-sunset-plus-1',
        width: 256,
        height: 256,
        verticalFovDegrees: 10,
        cameraTarget: 'custom-star-field',
        controlledMoon: false,
        analysisKind: 'star-night',
    }),
]);
const activeViewSpecs = Object.freeze(viewSpecs.filter((entry) =>
    !starsOnly || entry.analysisKind.startsWith('star')));
const sceneRequests = Object.freeze([
    Object.freeze({
        id: 'san-jose-globe-solar-noon',
        locationKey: 'san-jose',
        timeLocationKey: 'san-jose',
        earthMode: 'globe',
        timePresetKey: 'globe-solar-noon',
        hourOffset: 0,
        expectedTimeIso: '2024-06-20T20:08:46.261Z',
    }),
    Object.freeze({
        id: 'san-jose-globe-sunset-plus-1',
        locationKey: 'san-jose',
        timeLocationKey: 'san-jose',
        earthMode: 'globe',
        timePresetKey: 'globe-sunset',
        hourOffset: 1,
        expectedTimeIso: '2024-06-21T04:26:03.503Z',
    }),
]);
const thresholds = Object.freeze({
    moonContextMinimumPredictedDiameterPixels: 4,
    moonContextMinimumSupportPixels: 8,
    moonContextMinimumMeanAbsoluteLumaResidual: 3,
    moonContextMinimumPeakAbsoluteLumaResidual: 6,
    moonDetailPredictedDiameterRangePixels: Object.freeze([38, 45]),
    moonDetailSupportAreaRatioRange: Object.freeze([0.75, 1.35]),
    moonDetailMinimumMeanAbsoluteLumaResidual: 10,
    moonDetailMinimumPeakAbsoluteLumaResidual: 20,
    nightStarMinimumPeakPositiveLumaResidual:
        syntheticStarRadiancePolicy === 'record-020-prototype-magnitude' ? 60 : 5,
    nightStarMinimumMeanPositiveLumaResidual:
        syntheticStarRadiancePolicy === 'record-020-prototype-magnitude' ? 30 : 2,
    noonStarMaximumPeakPositiveLumaResidual:
        syntheticStarRadiancePolicy === 'record-020-prototype-magnitude' ? 8 : 1,
    noonStarMaximumMeanPositiveLumaResidual:
        syntheticStarRadiancePolicy === 'record-020-prototype-magnitude' ? 5 : 0.5,
});

if (starsOnly && syntheticStarRadiancePolicy !== 'record-020-prototype-magnitude') {
    throw new Error('--stars-only requires --record-020-magnitude-stars.');
}

await createFreshRecordDirectory(recordDirectory);
await mkdir(imagesDirectory, { recursive: false });
await appendRunLog(recordDirectory, `${runnerName} started.`);

const commandText = `node --use-system-ca scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory} --acquire-horizons${starsOnly ? ' --stars-only' : ''}${syntheticStarRadiancePolicy === 'record-020-prototype-magnitude' ? ' --record-020-magnitude-stars' : ''}`;
const sourceRevisionAtExecution = await resolveGitHeadRevision();
const sourceContentHashes = Object.freeze({
    flat32Index: await sha256File('src/flat32/index.js'),
    packageManifest: await sha256File('package.json'),
    packageLock: await sha256File('package-lock.json'),
    displayModel: await sha256File('scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js'),
    horizonsProvider: await sha256File('scripts/flat/reconciliation/POC/src/globe-moon/HorizonsGlobeMoonStateProvider.js'),
    sceneSnapshot: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/flat32SceneSnapshot.js'),
    sceneResolver: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js'),
    ephemerisAdapter: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/GlobeEphemerisSceneAdapter.js'),
    celestialProvider: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneCelestialProvider.js'),
    cpuRenderer: await sha256File('scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js'),
    runner: await sha256File(`scripts/flat/reconciliation/POC/src/runners/${runnerName}.js`),
});
const pocSourceTreeContentHashes = await sha256Tree('scripts/flat/reconciliation/POC/src');

await writeText(recordDirectory, 'state-goal.md', starsOnly ? `# State Goal

Run a focused correction after record 027 produced a clearly resolved
controlled-Moon artifact while retaining human-review status as pending; its
legacy-appearance star pair remained nearly invisible. Reuse the exact
record-020 review-only prototype magnitude/pixel-solid-angle/exposure bridge for authored
Flat32 synthetic analogs 137 and 150. Render the identical 10-degree camera at
San Jose solar noon and sunset plus one hour. Require high night contrast and
local daytime burial without changing authored directions or footprints.

Fixed thresholds:

- both named analogs after sunset: peak positive local-luma residual >=
  ${thresholds.nightStarMinimumPeakPositiveLumaResidual} bytes and mean >=
  ${thresholds.nightStarMinimumMeanPositiveLumaResidual} bytes;
- both named analogs at noon: peak positive residual <=
  ${thresholds.noonStarMaximumPeakPositiveLumaResidual} bytes and mean <=
  ${thresholds.noonStarMaximumMeanPositiveLumaResidual} bytes.
` : `# State Goal

Replace record 026's imperceptible-pixel gate with a focused CPU visibility
proof. Retain the real Flat32 San Jose globe scene and exact returned-epoch
ephemeris. Put the solar-noon Moon at one explicitly artificial presentation
direction while retaining its exact distance, angular size, and phase angle.
Render it at true angular scale in a scene context and a narrow detail view.

Render the same fixed camera around authored synthetic star analogs 137 and 150
at solar noon and sunset plus one hour. Require connected footprints, local-sky
contrast at night, and burial at noon. Automated acceptance does not constitute
human review; human review remains pending until the images are inspected.

Fixed thresholds:

- controlled Moon context: predicted diameter >= 4 px, >= 8 support pixels,
  mean absolute local-luma residual >= 3 bytes, peak >= 6 bytes;
- controlled Moon detail: predicted diameter 38-45 px, support/projected-area
  ratio 0.75-1.35, mean absolute local-luma residual >= 10 bytes, peak >= 20;
- both named star analogs at night: peak positive local-luma residual >= 5
  bytes and mean positive residual >= 2 bytes;
- both named star analogs at noon: peak positive residual <= 1 byte and mean
  positive residual <= 0.5 byte.
`);
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([Object.freeze({ command: commandText, timestamp: nowIso() })]),
});
await writeJson(recordDirectory, 'inputs.json', {
    stage: starsOnly
        ? '5.8-flat32-record-020-calibrated-star-visibility-cpu-soft-shader'
        : '5.7-flat32-controlled-celestial-human-visibility-cpu-soft-shader',
    runner: runnerName,
    sceneRequests,
    viewSpecs: activeViewSpecs,
    starsOnly,
    syntheticStarRadiancePolicy,
    controlledMoon: starsOnly ? null : Object.freeze({
        overrideId: controlledMoonOverrideId,
        directionScene: controlledMoonDirectionScene,
        astronomicalPosition: false,
        retainedFacts: Object.freeze(['epoch', 'distance', 'angular-radius', 'phase-angle', 'illuminated-fraction']),
        screenLimbPositionAngle: 'controlled-frame-dependent-not-ephemeris-preserved',
    }),
    starTargetIds,
    thresholds,
    executionControls,
    acquireHorizons,
    sceneSnapshot: FLAT32_SCENE_SNAPSHOT,
});
await writeJson(recordDirectory, 'provenance.json', {
    sourceRevisionAtExecution,
    sourceContentHashes,
    pocSourceTreeContentHashes,
    snapshotRevision: FLAT32_SCENE_SNAPSHOT.sourceRevision,
    runtimeLinkPolicy: FLAT32_SCENE_SNAPSHOT.runtimeLinkPolicy,
    ephemerisSource: 'NASA/JPL Horizons API, exact-time VECTORS, ECLIPTIC ICRF, KM-S, no aberration correction',
    acquisitionPolicy: 'Node-only, fresh sequential queries, exact returned epoch and raw payload retained',
    references: Object.freeze([
        'src/flat32/index.js',
        'agents/topics/apps/flat/reconciliation/milestone-5-boundary-radiance-design.md',
        'agents/topics/apps/flat/reconciliation/experimental-guidelines.md',
        'tmp/atmosphere/reconciliation/026-m5-flat32-globe-reviewable-cpu-soft-shader/report.md',
        ...(starsOnly ? [
            'tmp/atmosphere/reconciliation/027-m5-flat32-controlled-celestial-visibility-cpu-soft-shader/report.md',
            'tmp/atmosphere/reconciliation/020-m5-day-night-star-calibration/report.md',
        ] : []),
    ]),
});
await writeJson(recordDirectory, 'equations-and-constants.json', {
    canonicalComposition: 'finalSpectralRadiance = pathRadiance + viewTransmittance * celestialRadiance',
    controlledMoonDirectionScene: starsOnly ? null : controlledMoonDirectionScene,
    controlledMoonPolicy: starsOnly ? 'not-used' : 'Override apparent direction only; rigidly rotate Moon-to-Sun direction by the same shortest-arc rotation to preserve phase angle.',
    controlledMoonQualification: starsOnly ? 'not-used' : 'Counterfactual presentation, not an astronomical position. Screen-space limb position angle is not preserved.',
    predictedAngularDiameterPixels: '2 * angularRadiusRadians / (verticalFovRadians / viewportHeight)',
    starRadianceBridge: syntheticStarRadiancePolicy === 'record-020-prototype-magnitude'
        ? 'record-020 prototype magnitude/pixel-solid-angle/exposure bridge for synthetic analogs'
        : 'Flat32 neutral linear-working appearance target -> inverse Figure-1 tone map -> minimum-norm neutral 15-channel emission spectrum',
    calibrationLadderRadianceBridge: 'Flat32 neutral linear-working appearance target -> inverse Figure-1 tone map -> minimum-norm neutral 15-channel emission spectrum',
    syntheticStarRadiancePolicy,
    record020MagnitudeBridge: 'solarIrradiance * 10^(-0.4 * (magnitude - -26.74)) / 1.6e-5 sr * 2500',
    starQualification: 'The two targets are authored Flat32 synthetic diagnostics, not astronomical stellar angular diameters or catalog positions.',
    localContrast: 'Fit luma = a + b*x + c*y over sky pixels in a 3-10 px component annulus; subtract fitted luma from body support pixels.',
    reviewEncoding: 'Tone-mapped linear-sRGB through the standard sRGB OETF; magnified star images use exact 4x nearest-neighbor pixels with no exposure change.',
    thresholds,
    executionControls,
});

const failures = [];
let sceneStates = [];
let acquisitions = [];
let renderedViews = [];
let imageStats = [];
let overviewPath = null;
let starCameraDirectionScene = null;
let neutralEmissionRoundTrips = [];

try {
    if (!acquireHorizons) {
        throw new Error('Runner requires --acquire-horizons.');
    }
    const sceneResolver = new Flat32SceneStateResolver();
    sceneStates = sceneRequests.map((request) => sceneResolver.resolve(request));
    for (let index = 0; index < sceneStates.length; index += 1) {
        if (sceneStates[index].time.finalTimeIso !== sceneRequests[index].expectedTimeIso) {
            throw new Error(`${sceneStates[index].id} resolved unexpected time ${sceneStates[index].time.finalTimeIso}.`);
        }
    }
    const targetStars = starTargetIds.map((id) => {
        const star = sceneStates[0].syntheticStars.find((entry) => entry.objectId === id);
        if (!star) throw new Error(`Missing authored star target ${id}.`);
        return star;
    });
    starCameraDirectionScene = normalize(targetStars.reduce(
        (sum, star) => sum.map((value, index) => value + star.directionScene[index]),
        [0, 0, 0],
    ));
    await writeJson(recordDirectory, 'resolved-scenes.json', {
        scenes: sceneStates,
        starTargets: targetStars,
        starCameraDirectionScene,
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
            state,
            renderState: Object.freeze({
                worldState: state.worldState,
                observerState: state.observerState,
            }),
            rawQueries: Object.freeze([...provider.rawQueries]),
        }));
        await writeEphemerisEvidence('acquiring', acquisitions);
        await appendRunLog(recordDirectory, `${sceneState.id} Horizons acquisition complete.`);
    }
    await writeEphemerisEvidence('complete', acquisitions);

    const displayModel = new BrunetonColorDisplayModel();
    neutralEmissionRoundTrips = ['G', 'H'].map((label) => {
        const level = sceneStates[0].starCalibration.find((entry) =>
            entry.label === label)?.sceneRgb;
        if (!Number.isFinite(level)) throw new Error(`Missing Flat32 star calibration ${label}.`);
        const spectrum = displayModel.neutralLinearSrgbAppearanceTargetToSpectralRadiance(level);
        return Object.freeze({
            label,
            level,
            spectrum,
            output: displayModel.radianceToDisplayRgb(spectrum),
        });
    });

    for (const spec of activeViewSpecs) {
        const sceneState = sceneStates.find((entry) => entry.id === spec.sceneId);
        const acquisition = acquisitions.find((entry) => entry.sceneId === spec.sceneId);
        const renderer = new Flat32CpuSoftShaderSceneRenderer({
            width: spec.width,
            height: spec.height,
            verticalFovDegrees: spec.verticalFovDegrees,
            executionControls,
            incidentCacheEnabled: true,
            onProgress: (message) => appendRunLog(recordDirectory, `${spec.id}: ${message}`),
        });
        const options = {
            moonEphemerisState: acquisition.renderState,
            syntheticStarRadiancePolicy,
            cameraTarget: spec.cameraTarget === 'custom-star-field'
                ? 'presentation'
                : spec.cameraTarget,
        };
        if (spec.controlledMoon) {
            options.moonDirectionSceneOverride = controlledMoonDirectionScene;
            options.moonDirectionOverrideId = controlledMoonOverrideId;
        }
        if (spec.cameraTarget === 'custom-star-field') {
            options.cameraDirectionScene = starCameraDirectionScene;
        }
        await appendRunLog(recordDirectory, `${spec.id} render started.`);
        const render = await renderer.render(sceneState, options);
        const paths = await writeViewImages(spec, render);
        const analysis = spec.analysisKind.startsWith('moon')
            ? analyzeBody({ spec, render, bodyId: 'controlled-moon' })
            : Object.freeze(starTargetIds.map((bodyId) => {
                const target = sceneState.syntheticStars.find((entry) => entry.objectId === bodyId);
                return analyzeBody({
                    spec,
                    render,
                    bodyId,
                    angularRadiusRadians: target.angularRadiusRadians,
                    projectedCoordinate: projectDirectionToPixel({
                        spec,
                        cameraPositionScene: sceneState.camera.positionSceneUnits,
                        cameraDirectionScene: starCameraDirectionScene,
                        targetDirectionScene: target.directionScene,
                    }),
                });
            }));
        const magnifiedReviewPath = spec.analysisKind.startsWith('star')
            ? await writeMagnifiedStarReview(spec, render.reviewSrgbBytes)
            : null;
        renderedViews.push(Object.freeze({
            spec,
            sceneState,
            acquisition,
            render,
            paths,
            magnifiedReviewPath,
            analysis,
        }));
        await appendRunLog(recordDirectory, `${spec.id} render complete.`);
    }

    overviewPath = await writeOverview(renderedViews);
    const imagePaths = [
        ...renderedViews.flatMap((entry) => [
            ...Object.values(entry.paths),
            ...(entry.magnifiedReviewPath ? [entry.magnifiedReviewPath] : []),
        ]),
        overviewPath,
    ];
    imageStats = await Promise.all(imagePaths.map(async (path) => Object.freeze({
        path: relative(recordDirectory, path).replaceAll('\\', '/'),
        sizeBytes: (await stat(path)).size,
    })));
} catch (error) {
    failures.push(Object.freeze({ id: 'experiment-crash', message: error.stack ?? error.message }));
    await appendRunLog(recordDirectory, `${runnerName} crash: ${error.message}`);
    try {
        await writeEphemerisEvidence('incomplete', acquisitions);
    } catch (evidenceError) {
        failures.push(Object.freeze({ id: 'evidence-write-crash', message: evidenceError.message }));
    }
}

const criteria = buildCriteria({
    sceneStates,
    acquisitions,
    renderedViews,
    imageStats,
    neutralEmissionRoundTrips,
});
for (const criterion of criteria) {
    if (criterion.status !== 'accepted') {
        failures.push(Object.freeze({ id: criterion.name, message: criterion.details ?? 'Criterion rejected.' }));
    }
}
const automatedCriterionNames = new Set([
    'controlled-moon-context-is-human-scale-and-locally-distinct',
    'controlled-moon-detail-has-resolved-footprint-and-local-contrast',
    'both-authored-stars-are-visible-post-sunset',
    'both-authored-stars-are-buried-at-noon',
    'star-footprints-are-identical-across-fixed-camera-pair',
    'review-and-magnified-images-are-written',
]);
const mechanicalStatus = criteria
    .filter((entry) => !automatedCriterionNames.has(entry.name))
    .every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';
const automatedReviewabilityStatus = criteria
    .filter((entry) => automatedCriterionNames.has(entry.name))
    .every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';
const humanReviewStatus = 'pending';
const status = mechanicalStatus === 'accepted' && automatedReviewabilityStatus === 'accepted'
    ? 'accepted'
    : 'rejected';

const serializableViews = renderedViews.map((entry) => Object.freeze({
    id: entry.spec.id,
    spec: entry.spec,
    sceneTimeIso: entry.sceneState.time.finalTimeIso,
    paths: Object.freeze(Object.fromEntries(Object.entries(entry.paths).map(([key, path]) => [
        key,
        relative(recordDirectory, path).replaceAll('\\', '/'),
    ]))),
    magnifiedReviewPath: entry.magnifiedReviewPath
        ? relative(recordDirectory, entry.magnifiedReviewPath).replaceAll('\\', '/')
        : null,
    analysis: entry.analysis,
    diagnostics: entry.render.diagnostics,
}));
await writeJson(recordDirectory, 'diagnostics.json', {
    views: serializableViews,
    starCameraDirectionScene,
    neutralEmissionRoundTrips,
    imageStats,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    mechanicalStatus,
    automatedReviewabilityStatus,
    humanReviewStatus,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'result.json', {
    status,
    mechanicalStatus,
    automatedReviewabilityStatus,
    humanReviewStatus,
    viewCount: renderedViews.length,
    acquisitionCount: acquisitions.length,
    rawQueryCount: acquisitions.reduce((sum, entry) => sum + entry.rawQueries.length, 0),
    imageCount: imageStats.length,
    overviewPath: overviewPath
        ? relative(recordDirectory, overviewPath).replaceAll('\\', '/')
        : null,
    acceptedCriteriaCount: criteria.filter((entry) => entry.status === 'accepted').length,
    criteriaCount: criteria.length,
    failures,
});
await writeText(recordDirectory, 'report.md', reportMarkdown({
    status,
    mechanicalStatus,
    automatedReviewabilityStatus,
    humanReviewStatus,
    renderedViews,
    criteria,
    failures,
}));
await appendRunLog(recordDirectory, `${runnerName} ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    mechanicalStatus,
    automatedReviewabilityStatus,
    humanReviewStatus,
    recordDirectory,
    viewCount: renderedViews.length,
    criteriaCount: criteria.length,
    failureCount: failures.length,
}, null, 2));
if (status === 'rejected') process.exitCode = 1;

function buildCriteria({
    sceneStates: scenes,
    acquisitions: acquired,
    renderedViews: views,
    imageStats: images,
    neutralEmissionRoundTrips: roundTrips,
}) {
    const context = views.find((entry) => entry.spec.analysisKind === 'moon-context');
    const detail = views.find((entry) => entry.spec.analysisKind === 'moon-detail');
    const noon = views.find((entry) => entry.spec.analysisKind === 'star-noon');
    const night = views.find((entry) => entry.spec.analysisKind === 'star-night');
    const contextAnalysis = context?.analysis;
    const detailAnalysis = detail?.analysis;
    const physicalAdapter = acquired.length > 0
        ? new GlobeEphemerisSceneAdapter().resolve({
            ephemerisState: acquired[0].renderState,
        })
        : null;
    const controlledMoons = [context, detail]
        .filter(Boolean)
        .map((entry) => entry.render.diagnostics.globeEphemerisState.moon);
    const nightAnalyses = Array.isArray(night?.analysis) ? night.analysis : [];
    const noonAnalyses = Array.isArray(noon?.analysis) ? noon.analysis : [];
    const pairedStars = starTargetIds.map((bodyId) => Object.freeze({
        bodyId,
        noon: noonAnalyses.find((entry) => entry.bodyId === bodyId),
        night: nightAnalyses.find((entry) => entry.bodyId === bodyId),
    }));
    const criteriaValues = [
        criterion('exact-two-scene-returned-epoch-acquisition',
            scenes.length === 2 && acquired.length === 2
            && acquired.every((entry) => entry.rawQueries.length === 4)
            && acquired.every((entry) => entry.state.worldState.epochIso
                === scenes.find((scene) => scene.id === entry.sceneId)?.time.finalTimeIso)
            && acquired.flatMap((entry) => entry.rawQueries).every((query) =>
                query.returnedEpochIso === query.requestedEpochIso)),
        ...(!starsOnly ? [
        criterion('controlled-moon-is-explicitly-nonastronomical',
            controlledMoons.length === 2 && controlledMoons.every((moon) =>
                moon.bodyId === 'controlled-moon'
                && moon.presentationOverride?.astronomicalPosition === false
                && moon.presentationOverride?.id === controlledMoonOverrideId
                && moon.presentationOverride?.limbPositionAnglePolicy
                    === 'controlled-frame-dependent-not-ephemeris-preserved'
                && maximumVectorError(
                    moon.presentationOverride.controlledDirectionScene,
                    normalize(controlledMoonDirectionScene),
                ) < 1e-12)),
        criterion('controlled-moon-preserves-exact-distance-size-and-phase-angle',
            physicalAdapter && controlledMoons.length === 2
            && controlledMoons.every((moon) => controlledMoonMatchesPhysical(moon, physicalAdapter.moon))),
        ] : []),
        criterion('star-views-retain-physical-ephemeris-with-no-moon-override',
            noon && night
            && [noon, night].every((entry) =>
                entry.render.diagnostics.globeEphemerisState.moon.presentationOverride === null
                && entry.render.diagnostics.globeEphemerisState.epochIso
                    === entry.sceneState.time.finalTimeIso)),
        ...(starsOnly ? [
            criterion('record-020-magnitude-policy-and-radiance-formula-are-active',
                record020PolicyEvidenceMatches({ views: [noon, night], scenes })),
        ] : []),
        criterion('neutral-emission-bridge-round-trips-g-and-h',
            roundTrips.length === 2 && roundTrips.every((entry) =>
                entry.spectrum.every((value) => Number.isFinite(value) && value >= 0)
                && entry.output.every((value) => Math.abs(value - entry.level) < 1e-12))),
        criterion('cpu-only-no-browser-or-gpu',
            views.length === activeViewSpecs.length && views.every((entry) =>
                entry.render.diagnostics.browserUsed === false
                && entry.render.diagnostics.gpuShaderUsed === false)),
        ...(!starsOnly ? [
        criterion('controlled-moon-context-is-human-scale-and-locally-distinct',
            contextAnalysis?.component && contextAnalysis?.localContrast
            && contextAnalysis.localContrast.valid === true
            && contextAnalysis.predictedDiameterPixels >= thresholds.moonContextMinimumPredictedDiameterPixels
            && contextAnalysis.component.supportPixelCount >= thresholds.moonContextMinimumSupportPixels
            && contextAnalysis.component.boundingDiameterPixels >= 4
            && contextAnalysis.localContrast.meanAbsoluteResidual
                >= thresholds.moonContextMinimumMeanAbsoluteLumaResidual
            && contextAnalysis.localContrast.peakAbsoluteResidual
                >= thresholds.moonContextMinimumPeakAbsoluteLumaResidual,
            contextAnalysis ? JSON.stringify(contextAnalysis) : 'missing context analysis'),
        criterion('controlled-moon-detail-has-resolved-footprint-and-local-contrast',
            detailAnalysis?.component && detailAnalysis?.localContrast
            && detailAnalysis.localContrast.valid === true
            && detailAnalysis.predictedDiameterPixels >= thresholds.moonDetailPredictedDiameterRangePixels[0]
            && detailAnalysis.predictedDiameterPixels <= thresholds.moonDetailPredictedDiameterRangePixels[1]
            && detailAnalysis.component.supportAreaRatio >= thresholds.moonDetailSupportAreaRatioRange[0]
            && detailAnalysis.component.supportAreaRatio <= thresholds.moonDetailSupportAreaRatioRange[1]
            && detailAnalysis.localContrast.meanAbsoluteResidual
                >= thresholds.moonDetailMinimumMeanAbsoluteLumaResidual
            && detailAnalysis.localContrast.peakAbsoluteResidual
                >= thresholds.moonDetailMinimumPeakAbsoluteLumaResidual,
            detailAnalysis ? JSON.stringify(detailAnalysis) : 'missing detail analysis'),
        ] : []),
        criterion('star-footprints-are-identical-across-fixed-camera-pair',
            pairedStars.every((pair) => pair.noon?.component && pair.night?.component
                && pair.noon.projectionErrorPixels <= 1.5
                && pair.night.projectionErrorPixels <= 1.5
                && JSON.stringify(pair.noon.component.coordinateKeys)
                    === JSON.stringify(pair.night.component.coordinateKeys))
            && distinctTargetComponents(noonAnalyses)
            && distinctTargetComponents(nightAnalyses)),
        criterion('both-authored-stars-are-visible-post-sunset',
            pairedStars.every((pair) => pair.night?.component
                && pair.night.component.supportPixelCount > 0
                && pair.night.localContrast.valid === true
                && pair.night.localContrast.skySampleCount >= 6
                && pair.night.localContrast.peakPositiveResidual
                    >= thresholds.nightStarMinimumPeakPositiveLumaResidual
                && pair.night.localContrast.meanPositiveResidual
                    >= thresholds.nightStarMinimumMeanPositiveLumaResidual),
            JSON.stringify(nightAnalyses)),
        criterion('both-authored-stars-are-buried-at-noon',
            pairedStars.every((pair) => pair.noon?.component
                && pair.noon.localContrast.valid === true
                && pair.noon.localContrast.skySampleCount >= 6
                && pair.noon.localContrast.peakPositiveResidual
                    <= thresholds.noonStarMaximumPeakPositiveLumaResidual
                && pair.noon.localContrast.meanPositiveResidual
                    <= thresholds.noonStarMaximumMeanPositiveLumaResidual),
            JSON.stringify(noonAnalyses)),
        criterion('review-and-magnified-images-are-written',
            images.length === (starsOnly ? 9 : 15)
                && images.every((entry) => entry.sizeBytes > 0)),
    ];

    return Object.freeze(criteriaValues);
}

function analyzeBody({
    spec,
    render,
    bodyId,
    angularRadiusRadians: providedAngularRadiusRadians = null,
    projectedCoordinate = null,
}) {
    const selection = render.diagnostics.selectedPixels.find((entry) =>
        entry.externalBoundaryRadiance?.bodyId === bodyId);
    const expectedColor = bodyId === 'controlled-moon'
        ? Object.freeze([186, 196, 212, 255])
        : Object.freeze([242, 242, 255, 255]);
    const startCoordinate = projectedCoordinate
        ? nearestMatchingPixel({
            bytes: render.objectIdBytes,
            width: spec.width,
            height: spec.height,
            projectedCoordinate,
            expectedColor,
            maximumDistancePixels: 4,
        })
        : selection?.coordinate ?? null;
    if (!startCoordinate) {
        return Object.freeze({ bodyId, missing: true, projectedCoordinate });
    }
    const component = connectedComponent({
        bytes: render.objectIdBytes,
        width: spec.width,
        height: spec.height,
        start: startCoordinate,
        expectedColor,
    });
    const angularRadiusRadians = providedAngularRadiusRadians
        ?? selection?.externalBoundaryRadiance?.apparentFootprint?.angularRadiusRadians;
    if (!Number.isFinite(angularRadiusRadians)) {
        return Object.freeze({ bodyId, missing: true, projectedCoordinate });
    }
    const predictedDiameterPixels = 2 * angularRadiusRadians
        / (spec.verticalFovDegrees * Math.PI / 180 / spec.height);
    const projectedAreaPixels = Math.PI * (predictedDiameterPixels / 2) ** 2;
    const componentWithArea = Object.freeze({
        ...component,
        projectedAreaPixels,
        supportAreaRatio: projectedAreaPixels > 0
            ? component.supportPixelCount / projectedAreaPixels
            : null,
    });
    const localContrast = fitLocalSkyResidual({
        reviewBytes: render.reviewSrgbBytes,
        objectIdBytes: render.objectIdBytes,
        width: spec.width,
        height: spec.height,
        component,
    });

    return Object.freeze({
        bodyId,
        coordinate: startCoordinate,
        projectedCoordinate,
        projectionErrorPixels: projectedCoordinate
            ? Math.hypot(
                component.centroid.x - projectedCoordinate.x,
                component.centroid.y - projectedCoordinate.y,
            )
            : 0,
        apparentCoverage: selection?.externalBoundaryRadiance?.apparentCoverage ?? null,
        angularRadiusRadians,
        predictedDiameterPixels,
        displayRgb: selection?.displayRgb ?? null,
        component: componentWithArea,
        localContrast,
    });
}

function connectedComponent({ bytes, width, height, start, expectedColor }) {
    if (!pixelEquals(bytes, width, start.x, start.y, expectedColor)) {
        return Object.freeze({
            supportPixelCount: 0,
            pixels: Object.freeze([]),
            coordinateKeys: Object.freeze([]),
            centroid: null,
            boundingWidthPixels: 0,
            boundingHeightPixels: 0,
            boundingDiameterPixels: 0,
        });
    }
    const queue = [[start.x, start.y]];
    const seen = new Set([`${start.x},${start.y}`]);
    const pixels = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const [x, y] = queue[cursor];
        pixels.push(Object.freeze({ x, y }));
        for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                const key = `${nx},${ny}`;
                if (nx < 0 || nx >= width || ny < 0 || ny >= height || seen.has(key)) continue;
                seen.add(key);
                if (pixelEquals(bytes, width, nx, ny, expectedColor)) queue.push([nx, ny]);
            }
        }
    }
    const xs = pixels.map((entry) => entry.x);
    const ys = pixels.map((entry) => entry.y);
    const boundingWidthPixels = Math.max(...xs) - Math.min(...xs) + 1;
    const boundingHeightPixels = Math.max(...ys) - Math.min(...ys) + 1;
    const coordinateKeys = pixels.map((entry) => `${entry.x},${entry.y}`).sort();

    return Object.freeze({
        supportPixelCount: pixels.length,
        pixels: Object.freeze(pixels),
        coordinateKeys: Object.freeze(coordinateKeys),
        centroid: Object.freeze({ x: mean(xs), y: mean(ys) }),
        bounds: Object.freeze({
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
            minY: Math.min(...ys),
            maxY: Math.max(...ys),
        }),
        boundingWidthPixels,
        boundingHeightPixels,
        boundingDiameterPixels: Math.max(boundingWidthPixels, boundingHeightPixels),
    });
}

function fitLocalSkyResidual({ reviewBytes, objectIdBytes, width, height, component }) {
    if (!component.bounds || component.pixels.length === 0) {
        return Object.freeze({
            valid: false,
            skySampleCount: 0,
            fittedPlane: null,
            meanPositiveResidual: 0,
            peakPositiveResidual: 0,
            meanAbsoluteResidual: 0,
            peakAbsoluteResidual: 0,
        });
    }
    const skyColor = [6, 9, 18, 255];
    const innerMargin = 3;
    const outerMargin = 10;
    const samples = [];
    for (let y = Math.max(0, component.bounds.minY - outerMargin);
        y <= Math.min(height - 1, component.bounds.maxY + outerMargin); y += 1) {
        for (let x = Math.max(0, component.bounds.minX - outerMargin);
            x <= Math.min(width - 1, component.bounds.maxX + outerMargin); x += 1) {
            const insideInner = x >= component.bounds.minX - innerMargin
                && x <= component.bounds.maxX + innerMargin
                && y >= component.bounds.minY - innerMargin
                && y <= component.bounds.maxY + innerMargin;
            if (!insideInner && pixelEquals(objectIdBytes, width, x, y, skyColor)) {
                samples.push(Object.freeze({ x, y, luma: pixelLuma(reviewBytes, width, x, y) }));
            }
        }
    }
    if (samples.length < 6) {
        return Object.freeze({
            valid: false,
            skySampleCount: samples.length,
            fittedPlane: null,
            meanPositiveResidual: 0,
            peakPositiveResidual: 0,
            meanAbsoluteResidual: 0,
            peakAbsoluteResidual: 0,
        });
    }
    let coefficients;
    try {
        coefficients = fitPlane(samples);
    } catch {
        return Object.freeze({
            valid: false,
            skySampleCount: samples.length,
            fittedPlane: null,
            meanPositiveResidual: 0,
            peakPositiveResidual: 0,
            meanAbsoluteResidual: 0,
            peakAbsoluteResidual: 0,
        });
    }
    const residuals = component.pixels.map(({ x, y }) =>
        pixelLuma(reviewBytes, width, x, y)
        - (coefficients[0] + coefficients[1] * x + coefficients[2] * y));
    const positive = residuals.map((value) => Math.max(0, value));
    const absolute = residuals.map(Math.abs);

    return Object.freeze({
        valid: coefficients.every(Number.isFinite),
        skySampleCount: samples.length,
        fittedPlane: coefficients,
        meanResidual: mean(residuals),
        meanPositiveResidual: mean(positive),
        peakPositiveResidual: Math.max(...positive),
        meanAbsoluteResidual: mean(absolute),
        peakAbsoluteResidual: Math.max(...absolute),
    });
}

function fitPlane(samples) {
    const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const right = [0, 0, 0];
    for (const sample of samples) {
        const row = [1, sample.x, sample.y];
        for (let a = 0; a < 3; a += 1) {
            right[a] += row[a] * sample.luma;
            for (let b = 0; b < 3; b += 1) normal[a][b] += row[a] * row[b];
        }
    }

    return multiplyMatrixVector(invertMatrix3(normal), right);
}

async function writeViewImages(spec, render) {
    const paths = Object.freeze({
        canonical: resolve(imagesDirectory, `${spec.id}-canonical-linear.png`),
        review: resolve(imagesDirectory, `${spec.id}-review-srgb.png`),
        objectId: resolve(imagesDirectory, `${spec.id}-object-id.png`),
    });
    await Promise.all([
        writePng(paths.canonical, spec.width, spec.height, render.softShaderBytes),
        writePng(paths.review, spec.width, spec.height, render.reviewSrgbBytes),
        writePng(paths.objectId, spec.width, spec.height, render.objectIdBytes),
    ]);

    return paths;
}

async function writeMagnifiedStarReview(spec, bytes) {
    const scale = 4;
    const path = resolve(imagesDirectory, `${spec.id}-review-srgb-${scale}x-nearest.png`);
    await writePng(
        path,
        spec.width * scale,
        spec.height * scale,
        scaleNearest(bytes, spec.width, spec.height, scale),
    );

    return path;
}

async function writeOverview(views) {
    const context = views.find((entry) => entry.spec.analysisKind === 'moon-context');
    const detail = views.find((entry) => entry.spec.analysisKind === 'moon-detail');
    const noon = views.find((entry) => entry.spec.analysisKind === 'star-noon');
    const night = views.find((entry) => entry.spec.analysisKind === 'star-night');
    if (starsOnly && noon && night) {
        const width = 1032;
        const height = 512;
        const bytes = solidRgba(width, height, [20, 20, 20, 255]);
        const noon2x = scaleNearest(noon.render.reviewSrgbBytes, noon.spec.width, noon.spec.height, 2);
        const night2x = scaleNearest(night.render.reviewSrgbBytes, night.spec.width, night.spec.height, 2);
        blit(bytes, width, noon2x, noon.spec.width * 2, noon.spec.height * 2, 0, 0);
        blit(bytes, width, night2x, night.spec.width * 2, night.spec.height * 2, 520, 0);
        const path = resolve(imagesDirectory, 'overview-calibrated-stars-noon-night-review-srgb.png');
        await writePng(path, width, height, bytes);
        return path;
    }
    if (!context || !detail || !noon || !night) return null;
    const width = 1032;
    const height = 904;
    const bytes = solidRgba(width, height, [20, 20, 20, 255]);
    blit(bytes, width, context.render.reviewSrgbBytes, context.spec.width, context.spec.height, 0, 0);
    const detail2x = scaleNearest(detail.render.reviewSrgbBytes, detail.spec.width, detail.spec.height, 2);
    blit(bytes, width, detail2x, detail.spec.width * 2, detail.spec.height * 2, 520, 0);
    const noon2x = scaleNearest(noon.render.reviewSrgbBytes, noon.spec.width, noon.spec.height, 2);
    const night2x = scaleNearest(night.render.reviewSrgbBytes, night.spec.width, night.spec.height, 2);
    blit(bytes, width, noon2x, noon.spec.width * 2, noon.spec.height * 2, 0, 392);
    blit(bytes, width, night2x, night.spec.width * 2, night.spec.height * 2, 520, 392);
    const path = resolve(imagesDirectory, 'overview-controlled-moon-and-stars-review-srgb.png');
    await writePng(path, width, height, bytes);

    return path;
}

function reportMarkdown({
    status: resultStatus,
    mechanicalStatus,
    automatedReviewabilityStatus,
    humanReviewStatus,
    renderedViews: views,
    criteria: resultCriteria,
    failures: resultFailures,
}) {
    const context = views.find((entry) => entry.spec.analysisKind === 'moon-context');
    const detail = views.find((entry) => entry.spec.analysisKind === 'moon-detail');
    const noon = views.find((entry) => entry.spec.analysisKind === 'star-noon');
    const night = views.find((entry) => entry.spec.analysisKind === 'star-night');
    const starRows = starTargetIds.map((bodyId) => {
        const noonValue = noon?.analysis.find((entry) => entry.bodyId === bodyId);
        const nightValue = night?.analysis.find((entry) => entry.bodyId === bodyId);
        return `| ${bodyId} | ${formatResidual(noonValue)} | ${formatResidual(nightValue)} |`;
    }).join('\n');

    if (starsOnly) {
        return `# Report

Status: **${resultStatus}**

Mechanical status: **${mechanicalStatus}**

Automated reviewability status: **${automatedReviewabilityStatus}**

Human review status: **${humanReviewStatus}**

Record 027 made the controlled daytime Moon clearly visible, but its two
legacy-appearance stars remained too faint for human review. This focused
correction keeps the same exact noon/post-sunset epochs, fixed 10-degree camera,
and authored Flat32 diagnostic footprints. It changes only the synthetic-star
radiance bridge to the record-020 review-only prototype magnitude calibration:
solar reference magnitude -26.74, pixel solid angle 1.6e-5 sr, and exposure
2500. These values remain prototype display calibration rather than physical
photometric truth.

| Star target | Noon local residual mean/peak | Post-sunset local residual mean/peak |
| --- | ---: | ---: |
${starRows}

Human inspection must compare:

- \`images/san-jose-noon-star-field-review-srgb-4x-nearest.png\`
- \`images/san-jose-post-sunset-star-field-review-srgb-4x-nearest.png\`
- \`images/overview-calibrated-stars-noon-night-review-srgb.png\`

The 4x files use exact nearest-neighbor pixel magnification with no exposure or
color change. Accepted criteria: ${resultCriteria.filter((entry) => entry.status === 'accepted').length}/${resultCriteria.length}.
Failures: ${resultFailures.length === 0 ? 'none' : resultFailures.map((entry) => entry.id).join(', ')}.
`;
    }

    return `# Report

Status: **${resultStatus}**

Mechanical status: **${mechanicalStatus}**

Automated reviewability status: **${automatedReviewabilityStatus}**

Human review status: **${humanReviewStatus}**

Record 026's subpixel/nonzero gate did not establish visible celestial objects.
This focused correction keeps the real Flat32 San Jose globe scene and exact
Horizons epochs, but deliberately places the noon Moon at a controlled clear-sky
direction. That direction is **not astronomical**. Exact distance, angular size,
phase angle, and illuminated fraction are retained. Screen-space limb position
angle is controlled-frame-dependent and is not an ephemeris claim.

The context and detail views retain the Moon's true angular diameter; only FOV
and sampling density change. The two star targets retain their authored Flat32
diagnostic footprints. The 4x star files use nearest-neighbor pixel magnification
with no exposure or color change.

| Moon view | Predicted diameter px | Support px | Mean abs local luma | Peak abs local luma |
| --- | ---: | ---: | ---: | ---: |
| context | ${formatNumber(context?.analysis?.predictedDiameterPixels)} | ${context?.analysis?.component?.supportPixelCount ?? 'n/a'} | ${formatNumber(context?.analysis?.localContrast?.meanAbsoluteResidual)} | ${formatNumber(context?.analysis?.localContrast?.peakAbsoluteResidual)} |
| detail | ${formatNumber(detail?.analysis?.predictedDiameterPixels)} | ${detail?.analysis?.component?.supportPixelCount ?? 'n/a'} | ${formatNumber(detail?.analysis?.localContrast?.meanAbsoluteResidual)} | ${formatNumber(detail?.analysis?.localContrast?.peakAbsoluteResidual)} |

| Star target | Noon local residual mean/peak | Post-sunset local residual mean/peak |
| --- | ---: | ---: |
${starRows}

Human inspection must use these review files before the result is promoted:

- \`images/san-jose-noon-controlled-moon-context-review-srgb.png\`
- \`images/san-jose-noon-controlled-moon-detail-review-srgb.png\`
- \`images/san-jose-noon-star-field-review-srgb-4x-nearest.png\`
- \`images/san-jose-post-sunset-star-field-review-srgb-4x-nearest.png\`
- \`images/overview-controlled-moon-and-stars-review-srgb.png\`

Accepted criteria: ${resultCriteria.filter((entry) => entry.status === 'accepted').length}/${resultCriteria.length}.
Failures: ${resultFailures.length === 0 ? 'none' : resultFailures.map((entry) => entry.id).join(', ')}.
`;
}

function formatResidual(value) {
    if (!value?.localContrast) return 'n/a';
    return `${value.localContrast.meanPositiveResidual.toFixed(3)} / ${value.localContrast.peakPositiveResidual.toFixed(3)}`;
}

function formatNumber(value) {
    return Number.isFinite(value) ? value.toFixed(3) : 'n/a';
}

function criterion(name, accepted, details = undefined) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected', ...(details ? { details } : {}) });
}

function controlledMoonMatchesPhysical(controlled, physical) {
    const controlledPhaseDot = -dot(controlled.directionModel, controlled.moonToSunDirectionModel);
    const physicalPhaseDot = -dot(physical.directionModel, physical.moonToSunDirectionModel);

    return Math.abs(controlled.distanceKm - physical.distanceKm) < 1e-9
        && Math.abs(controlled.angularRadiusRadians - physical.angularRadiusRadians) < 1e-15
        && Math.abs(controlled.phaseAngleRadians - physical.phaseAngleRadians) < 1e-15
        && Math.abs(controlled.illuminatedFraction - physical.illuminatedFraction) < 1e-15
        && Math.abs(controlledPhaseDot - physicalPhaseDot) < 1e-12
        && Math.abs(phaseAngleFromControlledMoon(controlled) - controlled.phaseAngleRadians) < 1e-12;
}

function record020PolicyEvidenceMatches({ views, scenes }) {
    if (views.some((entry) => !entry)) return false;
    const sourceScene = scenes[0];
    const expectedById = new Map(starTargetIds.map((bodyId) => {
        const star = sourceScene.syntheticStars.find((entry) => entry.objectId === bodyId);
        return [bodyId, prototypeMagnitudeStarRadiance(star.magnitude)];
    }));

    return views.every((entry) => {
        const descriptor = entry.render.diagnostics.celestialProvider;
        const policy = descriptor.starRadiancePolicy;
        if (policy.syntheticStars !== 'record-020-prototype-magnitude'
            || policy.record020PrototypeMagnitudeCalibration.solarReferenceMagnitude
                !== RECORD_020_PROTOTYPE_STAR_CALIBRATION.solarReferenceMagnitude
            || policy.record020PrototypeMagnitudeCalibration.pixelSolidAngleSteradians
                !== RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians
            || policy.record020PrototypeMagnitudeCalibration.exposure
                !== RECORD_020_PROTOTYPE_STAR_CALIBRATION.exposure
            || policy.record020PrototypeMagnitudeCalibration.status
                !== RECORD_020_PROTOTYPE_STAR_CALIBRATION.status) {
            return false;
        }

        return starTargetIds.every((bodyId) => {
            const evidence = descriptor.starRadianceEvidence.find((value) =>
                value.bodyId === bodyId);
            const expected = expectedById.get(bodyId);
            return evidence?.radianceCalibration
                === 'record-020-prototype-magnitude-pixel-solid-angle-exposure'
                && evidence.celestialRadiance.length === expected.length
                && maximumVectorError(evidence.celestialRadiance, expected) < 1e-15;
        });
    });
}

function prototypeMagnitudeStarRadiance(magnitude) {
    const relativeSolarFlux = 10 ** (-0.4 * (
        magnitude - RECORD_020_PROTOTYPE_STAR_CALIBRATION.solarReferenceMagnitude
    ));
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) =>
        channel.solarIrradiance
        * relativeSolarFlux
        / RECORD_020_PROTOTYPE_STAR_CALIBRATION.pixelSolidAngleSteradians
        * RECORD_020_PROTOTYPE_STAR_CALIBRATION.exposure));
}

function distinctTargetComponents(analyses) {
    if (analyses.length !== starTargetIds.length
        || analyses.some((entry) => !entry.component?.coordinateKeys?.length)) {
        return false;
    }

    return new Set(analyses.map((entry) =>
        entry.component.coordinateKeys.join('|'))).size === analyses.length;
}

function projectDirectionToPixel({
    spec,
    cameraPositionScene,
    cameraDirectionScene,
    targetDirectionScene,
}) {
    const camera = new THREE.PerspectiveCamera(
        spec.verticalFovDegrees,
        spec.width / spec.height,
        FLAT32_SCENE_SNAPSHOT.camera.nearSceneUnits,
        FLAT32_SCENE_SNAPSHOT.camera.farSceneUnits,
    );
    camera.position.set(...cameraPositionScene);
    const forward = new THREE.Vector3(...normalize(cameraDirectionScene));
    camera.lookAt(camera.position.clone().add(forward));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const projected = camera.position.clone()
        .add(new THREE.Vector3(...normalize(targetDirectionScene)))
        .project(camera);

    return Object.freeze({
        x: (projected.x + 1) * spec.width / 2 - 0.5,
        y: (1 - projected.y) * spec.height / 2 - 0.5,
        ndc: Object.freeze([projected.x, projected.y, projected.z]),
    });
}

function nearestMatchingPixel({
    bytes,
    width,
    height,
    projectedCoordinate,
    expectedColor,
    maximumDistancePixels,
}) {
    let best = null;
    let bestDistance = Infinity;
    const radius = Math.ceil(maximumDistancePixels);
    const centerX = Math.round(projectedCoordinate.x);
    const centerY = Math.round(projectedCoordinate.y);
    for (let y = Math.max(0, centerY - radius); y <= Math.min(height - 1, centerY + radius); y += 1) {
        for (let x = Math.max(0, centerX - radius); x <= Math.min(width - 1, centerX + radius); x += 1) {
            if (!pixelEquals(bytes, width, x, y, expectedColor)) continue;
            const distance = Math.hypot(x - projectedCoordinate.x, y - projectedCoordinate.y);
            if (distance <= maximumDistancePixels && distance < bestDistance) {
                best = Object.freeze({ x, y });
                bestDistance = distance;
            }
        }
    }

    return best;
}

function phaseAngleFromControlledMoon(moon) {
    return Math.acos(Math.min(1, Math.max(-1, -moon.directionModel.reduce(
        (sum, value, index) => sum + value * moon.moonToSunDirectionModel[index],
        0,
    ))));
}

function dot(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function maximumVectorError(left, right) {
    return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function pixelEquals(bytes, width, x, y, color) {
    const offset = (y * width + x) * 4;
    return color.every((value, index) => bytes[offset + index] === value);
}

function pixelLuma(bytes, width, x, y) {
    const offset = (y * width + x) * 4;
    return 0.2126 * bytes[offset] + 0.7152 * bytes[offset + 1] + 0.0722 * bytes[offset + 2];
}

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function normalize(value) {
    const length = Math.hypot(...value);
    if (!(length > 0)) throw new RangeError('Cannot normalize a zero vector.');
    return Object.freeze(value.map((entry) => entry / length));
}

function scaleNearest(source, width, height, scale) {
    const output = new Uint8Array(width * scale * height * scale * 4);
    const outputWidth = width * scale;
    for (let y = 0; y < height * scale; y += 1) {
        for (let x = 0; x < width * scale; x += 1) {
            const sourceOffset = (Math.floor(y / scale) * width + Math.floor(x / scale)) * 4;
            const outputOffset = (y * outputWidth + x) * 4;
            output.set(source.subarray(sourceOffset, sourceOffset + 4), outputOffset);
        }
    }
    return output;
}

function solidRgba(width, height, color) {
    const bytes = new Uint8Array(width * height * 4);
    for (let offset = 0; offset < bytes.length; offset += 4) bytes.set(color, offset);
    return bytes;
}

function blit(target, targetWidth, source, sourceWidth, sourceHeight, offsetX, offsetY) {
    for (let y = 0; y < sourceHeight; y += 1) {
        const sourceStart = y * sourceWidth * 4;
        const targetStart = ((offsetY + y) * targetWidth + offsetX) * 4;
        target.set(source.subarray(sourceStart, sourceStart + sourceWidth * 4), targetStart);
    }
}

function multiplyMatrixVector(matrix, vector) {
    return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function invertMatrix3(matrix) {
    const [a, b, c] = matrix[0];
    const [d, e, f] = matrix[1];
    const [g, h, i] = matrix[2];
    const determinant = a * (e * i - f * h)
        - b * (d * i - f * g)
        + c * (d * h - e * g);
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON) {
        throw new RangeError('Local sky plane matrix is singular.');
    }
    const s = 1 / determinant;
    return [
        [(e * i - f * h) * s, (c * h - b * i) * s, (b * f - c * e) * s],
        [(f * g - d * i) * s, (a * i - c * g) * s, (c * d - a * f) * s],
        [(d * h - e * g) * s, (b * g - a * h) * s, (a * e - b * d) * s],
    ];
}

async function writeEphemerisEvidence(status, values) {
    await writeJson(recordDirectory, 'ephemeris-evidence.json', {
        acquisitionStatus: status,
        expectedAcquisitionCount: sceneRequests.length,
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
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? collectTreeFiles(path) : [path];
    }));
    return nested.flat().sort((left, right) => left.localeCompare(right));
}
