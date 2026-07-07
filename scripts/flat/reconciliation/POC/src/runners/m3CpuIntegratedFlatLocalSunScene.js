// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader contract.
// - tmp/atmosphere/reconciliation/027-m2-local-flat-cpu, direct local/flat CPU transport smoke.
// - scripts/flat/reconciliation/POC/browser-page/runner.js, integrated browser composer scene routing.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    Algorithm32ShaderAssembler,
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    CanonicalAtmosphere,
    FlatEarthGeometry,
    LocalFlatShaderContributionFactory,
    LocalFlatShaderDescriptorBuilder,
    LocalSunLightSource,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    SpectralCalculator,
    buildIncidentRadianceCache,
} from '../index.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const recordDirectory = parseRecordDirectory(process.argv);
const COMMAND_PATH = resolve(stringArg('--command-path', 'scripts/flat/reconciliation/POC/browser-jobs/browser-command.json'));
const WATCHER_OUT_ROOT = resolve(stringArg('--watcher-out-root', 'tmp/atmosphere/reconciliation'));
const WATCH_TIMEOUT_MS = numberArg('--watch-timeout-ms', 300000);
const POLL_MS = 750;
const PROGRESS_LOG_INTERVAL_MS = 5000;
const width = numberArg('--width', 96);
const height = numberArg('--height', 54);
const shaderBackend = shaderBackendArg('--shader-backend', 'cpu');
const sceneIndex = Math.max(0, Math.floor(numberArg('--scene-index', 0)));
const verticalFovDegrees = numberArg('--vertical-fov-degrees', 45);
const metersPerSceneUnit = numberArg('--meters-per-scene-unit', 1000);
const observerHeightMeters = numberArg('--observer-height-meters', 150);
const lookAtDistanceMeters = numberArg('--look-at-distance-meters', Math.max(800, observerHeightMeters * 3.7));
const lookAtHeightMeters = optionalNumberArg('--look-at-height-meters', null);
const lookTowardSceneIndex = optionalIntegerArg('--look-toward-scene-index', null);
const shadowsEnabled = booleanArg('--shadows-enabled', !process.argv.includes('--no-shadows'));
const endpointRadianceScale = numberArg('--endpoint-radiance-scale', 1);
const endpointSceneLightScalePolicy = endpointSceneLightScalePolicyArg(
    '--endpoint-light-scale-policy',
    'endpoint-material-shading',
);
const groundDisplayRgba = rgbaArg('--ground-display-rgba', Object.freeze([86, 105, 66, 255]));
const diagnosticBoxesEnabled = booleanArg('--diagnostic-boxes-enabled', true);
const cameraForwardReviewBoxes = booleanArg('--camera-forward-review-boxes', false);
const farHorizonReviewBoxEnabled = booleanArg('--far-horizon-review-box-enabled', false);
const denaliReviewBoxEnabled = booleanArg('--denali-review-box-enabled', false);
const antialiasEnabled = booleanArg('--antialias', !process.argv.includes('--no-antialias'));
const endpointIndirectFillEnabled = booleanArg('--endpoint-indirect-fill-enabled', true);
const endpointFillPolicy = endpointFillPolicyArg('--endpoint-fill-policy', 'general-ambient-fill');
const endpointAmbientFillRatio = numberArg('--endpoint-ambient-fill-ratio', 0.25);
const sceneDepthCapturePolicy = sceneDepthCapturePolicyArg('--scene-depth-capture-policy', 'raycaster');
const endpointCameraDistanceScalePolicy = endpointCameraDistanceScalePolicyArg(
    '--endpoint-camera-distance-scale-policy',
    'none',
);
const endpointCameraDistanceScale = Object.freeze({
    policy: endpointCameraDistanceScalePolicy,
    referenceMeters: numberArg('--endpoint-camera-distance-reference-meters', 200000),
    minScale: numberArg('--endpoint-camera-distance-min-scale', 0.05),
    maxScale: numberArg('--endpoint-camera-distance-max-scale', 1),
});
const effectiveEndpointIndirectFillEnabled = endpointCameraDistanceScalePolicy === 'reverse-square'
    ? false
    : endpointIndirectFillEnabled;
const endpointIndirectFillSuppressedByCameraDistanceScale =
    endpointCameraDistanceScalePolicy === 'reverse-square' && endpointIndirectFillEnabled;
const minimumDiagnosticBoxHitCount = Math.max(
    0,
    Math.floor(numberArg('--minimum-diagnostic-box-hit-count', diagnosticBoxesEnabled ? 5 : 0)),
);
const artifactRunDirectory = resolve(recordDirectory);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const sceneSetId = stringArg('--scene-set', seed.currentReviewSceneSetId ?? 'step018-rotation');
const sceneSet = seed.sceneSets[sceneSetId] ?? seed.sceneSets['step018-rotation'] ?? null;
const activeScenes = sceneSet?.scenes ?? seed.currentReviewScenes ?? seed.scenes;
const scene = activeScenes[Math.min(sceneIndex, activeScenes.length - 1)];
const lookTowardScene = Number.isInteger(lookTowardSceneIndex)
    ? activeScenes[Math.min(Math.max(lookTowardSceneIndex, 0), activeScenes.length - 1)]
    : null;
const sceneDepthMaxMeters = numberArg('--scene-depth-max-meters', seed.sceneSkyRayLimitMeters);
const observerPositionMeters = Object.freeze([
    seed.observerPositionMeters[0],
    seed.observerPositionMeters[1],
    observerHeightMeters,
]);
const lookAtSceneUnits = resolveLookAtSceneUnits();
const failures = [];

await appendRunLog(recordDirectory, 'm3CpuIntegratedFlatLocalSunScene started.');

let command = null;
let latest = null;
let selectedPixels = null;
let browserDiagnostics = null;
let shaderPayload = null;
let assembly = null;
let cacheBuildResult = null;

try {
    if (shaderBackend === 'gpu') {
        const gpuSetup = buildGpuShaderSetup();
        shaderPayload = gpuSetup.shaderPayload;
        assembly = gpuSetup.assembly;
        cacheBuildResult = gpuSetup.cacheBuildResult;
    }
    command = makeCommand();
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    selectedPixels = latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
    browserDiagnostics = latest?.artifact?.paths?.browserDiagnosticsPath
        ? await readJsonIfExists(latest.artifact.paths.browserDiagnosticsPath)
        : null;
} catch (error) {
    failures.push(failure('integrated-flat-local-scene-crash', error.message, { stack: error.stack }));
}

const sceneDiagnostics = latest?.result?.diagnostics?.scene ?? null;
const browserSceneSummary = sceneDiagnostics?.browserThreeScene ?? sceneDiagnostics ?? null;
const composerDiagnostics = latest?.result?.diagnostics?.shader?.composer ?? null;
const cpuSelectedDiagnostics = browserSceneSummary?.cpuSelectedPixelDiagnostics
    ?? composerDiagnostics?.selectedPixels
    ?? [];
const expectedSelectedPixelCount = composerDiagnostics?.inputContract?.selectedPixelCount ?? 0;
const flatGroundHitCount = browserSceneSummary?.objectHitCounts?.['local-flat-geometry-ground']
    ?? browserSceneSummary?.objectHitCounts?.['local-flat-geometry-ground-endpoint']
    ?? 0;
const localFlatSceneObjects = browserSceneSummary?.sceneObjects ?? {};
const localFlatDiagnosticBoxNames = Object.keys(localFlatSceneObjects)
    .filter((name) => localFlatSceneObjects[name]?.kind === 'diagnostic-flat-box');
const localFlatReviewBoxNames = Object.keys(localFlatSceneObjects)
    .filter((name) => localFlatSceneObjects[name]?.kind === 'review-flat-box');
const denaliReviewBoxName = 'local-flat-denali-200km-6p2kmx50kmx100km-orange-box';
const localFlatHitDiagnosticBoxNames = localFlatDiagnosticBoxNames.filter((name) =>
    (browserSceneSummary?.objectHitCounts?.[name] ?? 0) > 0);
const localFlatHitReviewBoxNames = localFlatReviewBoxNames.filter((name) =>
    (browserSceneSummary?.objectHitCounts?.[name] ?? 0) > 0);
const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('canvas-image-written', browserArtifactSaved(latest, 'images/canvas-image.png')),
    criterion('pre-shader-scene-color-image-written',
        browserArtifactSaved(latest, 'images/pre-shader-scene-color.png')
            && typeof latest?.artifact?.paths?.preShaderSceneColorImagePath === 'string'),
    criterion(`shader-backend-is-${shaderBackend}`, latest?.result?.diagnostics?.shader?.backend === shaderBackend),
    criterion('cpu-composer-pass-used-evaluate',
        shaderBackend !== 'cpu'
            || composerDiagnostics?.evaluatorKind === 'SpectralReferenceEvaluator.evaluate'),
    criterion('input-contract-is-flat-local',
        composerDiagnostics?.inputContract?.geometryKind === 'flat-earth'
            && composerDiagnostics?.inputContract?.lightSourceKind === 'local-sun'),
    criterion(shadowsEnabled ? 'local-flat-shadows-enabled' : 'local-flat-shadows-disabled',
        shadowsEnabled
            ? browserSceneSummary?.shadowPolicy === 'three-shadow-map-from-local-source-direction'
                && browserSceneSummary?.sceneLighting?.shadowPolicy === 'three-shadow-map-from-local-source-direction'
            : browserSceneSummary?.shadowPolicy === 'shadows-disabled'
                && browserSceneSummary?.sceneLighting?.shadowPolicy === 'shadows-disabled'),
    criterion('local-l2-cache-used',
        shaderBackend === 'cpu'
            ? composerDiagnostics?.incidentRadianceCache?.mode === 'local-l2-cache-sampler'
                && composerDiagnostics?.incidentRadianceCache?.cacheKind === 'local'
                && composerDiagnostics?.incidentRadianceCache?.coordinateCount > 0
                && composerDiagnostics?.incidentRadianceCache?.valueCount === composerDiagnostics?.incidentRadianceCache?.coordinateCount
            : composerDiagnostics?.inputContract?.incidentRadianceTexture?.kind === 'rgba32f-3d-texture-v1'
                && composerDiagnostics?.inputContract?.incidentRadianceTexture?.uploadValueCount === shaderPayload?.texture.rgbaFloat32.length),
    criterion('flat-geometry-ground-owned-by-abstraction',
        browserSceneSummary?.ground?.metadata?.owner === 'FlatEarthGeometry'
            && Boolean(browserSceneSummary?.ground?.metadata?.observerLocalSceneFrame)),
    criterion('hit-and-no-hit-pixels-present',
        (browserSceneSummary?.hitPixelCount ?? 0) > 0
            && (browserSceneSummary?.depthSummary?.noHitBucket ?? 0) > 0),
    criterion('local-flat-scene-objects-hit',
        diagnosticBoxesEnabled
            ? (localFlatHitDiagnosticBoxNames.length >= minimumDiagnosticBoxHitCount && flatGroundHitCount > 0)
            : flatGroundHitCount > 0),
    criterion('local-flat-diagnostic-boxes-hit',
        diagnosticBoxesEnabled
            ? localFlatDiagnosticBoxNames.length >= minimumDiagnosticBoxHitCount
                && localFlatHitDiagnosticBoxNames.length >= minimumDiagnosticBoxHitCount
            : localFlatDiagnosticBoxNames.length === 0),
    criterion('far-horizon-review-box-hit',
        !farHorizonReviewBoxEnabled
            || (localFlatReviewBoxNames.length > 0
                && localFlatReviewBoxNames.every((name) => localFlatHitReviewBoxNames.includes(name)))),
    criterion('denali-review-box-hit',
        !denaliReviewBoxEnabled
            || (browserSceneSummary?.objectHitCounts?.[denaliReviewBoxName] ?? 0) > 0),
    criterion('local-sun-path-radiance-positive',
        shaderBackend !== 'cpu'
            || cpuSelectedDiagnostics.some((pixel) => pixel.pathRadianceMean > 0)),
    criterion('selected-pixel-incident-inscattering-positive',
        shaderBackend !== 'cpu'
            || cpuSelectedDiagnostics.some((pixel) => pixel.incidentInScatteringMean > 0)),
    criterion('selected-hit-pixel-atmosphere-delta-present',
        shaderBackend !== 'cpu'
            || cpuSelectedDiagnostics.some((pixel) =>
                pixel.sceneIntersectionKind === 'hit'
                && (pixel.absoluteOutputSceneColorByteDeltaSum ?? 0) > 0)),
    criterion('selected-pixel-readback-recorded',
        Array.isArray(selectedPixels?.selectedPixels)
            && expectedSelectedPixelCount > 0
            && selectedPixels.selectedPixels.length === expectedSelectedPixelCount),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, `Integrated flat/local ${shaderBackend.toUpperCase()} scene criterion was not accepted.`));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Verify that the browser-integrated ${shaderBackend.toUpperCase()} Algorithm32 shader pass can run flat
geometry with a local Sun through the same EffectComposer runtime shape used by
the planet CPU/GPU parity path. This record does not use the older standalone
M2 local/flat Node CPU renderer as evidence.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: `m3-${shaderBackend}-integrated-flat-local-sun`,
    runner: 'm3CpuIntegratedFlatLocalSunScene',
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    artifactRunDirectory,
    viewportPixels: [width, height],
    shaderBackend,
    sceneSetId,
    sceneSetLabel: sceneSet?.label ?? null,
    sceneIndex,
    sceneId: scene.id,
    sourceLatitudeResolvedAt: scene.sourceLatitudeResolvedAt ?? null,
    sourceSubpointLatitudeDegrees: scene.sourceSubpointLatitudeDegrees ?? null,
    sourceSubpointLongitudeDegrees: scene.sourceSubpointLongitudeDegrees ?? null,
    sourceAltitudeDegrees: scene.sourceAltitudeDegrees,
    sourceAzimuthDegrees: scene.sourceAzimuthDegrees,
    incidentScaleAtObserver: scene.incidentScaleAtObserver,
    sceneDepthMaxMeters,
    verticalFovDegrees,
    metersPerSceneUnit,
    observerHeightMeters,
    lookAtDistanceMeters,
    lookAtHeightMeters,
    lookTowardSceneIndex,
    lookTowardSceneId: lookTowardScene?.id ?? null,
    lookAtSceneUnits,
    observerPositionMeters,
    shadowsEnabled,
    endpointRadianceScale,
    endpointSceneLightScalePolicy,
    groundDisplayRgba,
    diagnosticBoxesEnabled,
    cameraForwardReviewBoxes,
    farHorizonReviewBoxEnabled,
    denaliReviewBoxEnabled,
    antialiasEnabled,
    endpointIndirectFillEnabled,
    effectiveEndpointIndirectFillEnabled,
    endpointIndirectFillSuppressedByCameraDistanceScale,
    endpointFillPolicy,
    endpointAmbientFillRatio,
    endpointCameraDistanceScale,
    minimumDiagnosticBoxHitCount,
    pathIntervalCount: seed.numericalControls.pathIntervalCount,
    sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
    incidentRadianceCacheEnabled: true,
    cachePathIntervalCount: seed.numericalControls.pathIntervalCount,
    localCacheZBinCount: seed.localCacheZBinsMeters.length,
    localCacheRhoBinCount: seed.localCacheRhoBinsMeters.length,
    localCacheDirectionCount: seed.localCacheDirectionCount,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    sourceTrails: [
        'tmp/atmosphere/reconciliation/027-m2-local-flat-cpu',
        'tmp/atmosphere/reconciliation/399 through 405, integrated browser CPU/GPU composer architecture',
        'scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js',
        'scripts/flat/reconciliation/POC/src/light/LocalSunLightSource.js',
        'scripts/flat/reconciliation/POC/browser-page/algorithm32-composer-passes.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
    ],
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    command,
    latestSummary: summarizeLatest(latest),
    sceneDiagnostics,
    browserSceneSummary,
    composerDiagnostics,
    browserDiagnostics,
    selectedPixels,
    shaderPayload: summarizeShaderPayload(shaderPayload),
    cacheBuildResult: cacheBuildResult
        ? Object.freeze({
            coordinateCount: cacheBuildResult.coordinateCount,
            valueCount: cacheBuildResult.cache.valueCount,
            descriptor: cacheBuildResult.cache.descriptor,
        })
        : null,
    assembly: assembly
        ? Object.freeze({
            status: assembly.status,
            sourceHash: assembly.sourceHash,
            validationStatus: assembly.validationReport?.status ?? null,
        })
        : null,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: runnerInvocationCommand(),
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    canvasImagePath: latest?.artifact?.paths?.canvasImagePath ?? null,
    preShaderSceneColorImagePath: latest?.artifact?.paths?.preShaderSceneColorImagePath ?? null,
    sourceHash: assembly?.sourceHash ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Integrated ${shaderBackend.toUpperCase()} flat/local scene finished with status: ${status}.

- Artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Scene seed: \`${scene.id}\`
- Canvas image: \`${latest?.artifact?.paths?.canvasImagePath ?? 'not-written'}\`
- Pre-shader scene color image: \`${latest?.artifact?.paths?.preShaderSceneColorImagePath ?? 'not-written'}\`
- Geometry/source contract: \`${composerDiagnostics?.inputContract?.geometryKind ?? 'not-reported'} / ${composerDiagnostics?.inputContract?.lightSourceKind ?? 'not-reported'}\`
- CPU evaluator: \`${composerDiagnostics?.evaluatorKind ?? 'not-reported'}\`
- GPU source hash: \`${assembly?.sourceHash ?? 'not-used'}\`
- Incident cache mode: \`${composerDiagnostics?.incidentRadianceCache?.mode ?? 'not-reported'}\`
- Incident cache coordinate/value count: \`${composerDiagnostics?.incidentRadianceCache?.coordinateCount ?? 'not-reported'} / ${composerDiagnostics?.incidentRadianceCache?.valueCount ?? 'not-reported'}\`
- Shadow policy: \`${browserSceneSummary?.shadowPolicy ?? 'not-reported'}\`
- Endpoint indirect fill: \`${JSON.stringify(browserSceneSummary?.sceneLighting?.endpointIndirectFill ?? null)}\`
- Hit pixels: \`${browserSceneSummary?.hitPixelCount ?? 'not-reported'}\`
- No-hit bucket: \`${browserSceneSummary?.depthSummary?.noHitBucket ?? 'not-reported'}\`
- Object hit counts: \`${JSON.stringify(browserSceneSummary?.objectHitCounts ?? null)}\`
- Diagnostic boxes hit: \`${JSON.stringify(localFlatHitDiagnosticBoxNames)}\`
- Review boxes hit: \`${JSON.stringify(localFlatHitReviewBoxNames)}\`
- Minimum diagnostic box hit count: \`${minimumDiagnosticBoxHitCount}\`
- Ground display RGBA: \`${JSON.stringify(groundDisplayRgba)}\`
- Diagnostic boxes enabled: \`${diagnosticBoxesEnabled}\`
- Camera-forward review boxes: \`${cameraForwardReviewBoxes}\`
- Far-horizon review box enabled: \`${farHorizonReviewBoxEnabled}\`
- Denali review box enabled: \`${denaliReviewBoxEnabled}\`
- Object distance extents: \`${JSON.stringify(browserSceneSummary?.objectDistanceExtents ?? null)}\`
- Selected CPU diagnostics: \`${JSON.stringify(cpuSelectedDiagnostics)}\`

This is a direct integrated ${shaderBackend.toUpperCase()} shader verification for flat geometry and a
local Sun. The endpoint colors come from the composer RenderPass and are
composed after spectral transport; only ray and hit-distance facts enter
\`evaluate(...)\`.
`);
await appendRunLog(recordDirectory, `m3CpuIntegratedFlatLocalSunScene ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    canvasImagePath: latest?.artifact?.paths?.canvasImagePath ?? null,
    preShaderSceneColorImagePath: latest?.artifact?.paths?.preShaderSceneColorImagePath ?? null,
    sourceHash: assembly?.sourceHash ?? null,
}));

function makeCommand() {
    return Object.freeze({
        id: `${shaderBackend}-integrated-flat-local-sun-${Date.now()}`,
        label: `m3-${shaderBackend}-integrated-flat-local-sun`,
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: 'Render flat geometry with a local Sun through the integrated browser CPU Algorithm32 composer pass.',
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: `local-flat-ground-${scene.id}`,
            sceneKind: 'local-flat-ground',
            sceneSetId,
            shaderRuntime: 'three-effect-composer',
            shaderBackend,
            comparisonMode: `${shaderBackend}-integrated-flat-local-sun-smoke`,
            fragmentShaderSource: assembly?.fragmentShaderSource ?? '',
            viewportPixels: Object.freeze([width, height]),
            metersPerSceneUnit,
            sceneDepthMaxMeters,
            verticalFovDegrees,
            shadowsEnabled,
            endpointRadianceScale,
            endpointCameraDistanceScale,
            antialias: antialiasEnabled,
            ...(lookAtSceneUnits ? { lookAtSceneUnits } : {}),
            minimumDiagnosticBoxHitCount,
            pathIntervalCount: seed.numericalControls.pathIntervalCount,
            sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
            endpointRadianceScale,
            incidentRadianceTexture: shaderPayload?.texture ?? zeroIncidentRadianceTexturePayload(),
            localFlat: Object.freeze({
                sourceKey: scene.id,
                observerPositionMeters,
                sourcePositionMeters: scene.sourcePositionMeters,
                sourceLatitudeResolvedAt: scene.sourceLatitudeResolvedAt ?? null,
                sourceSubpointLatitudeDegrees: scene.sourceSubpointLatitudeDegrees ?? null,
                sourceSubpointLongitudeDegrees: scene.sourceSubpointLongitudeDegrees ?? null,
                sourceAltitudeDegrees: scene.sourceAltitudeDegrees,
                sourceAzimuthDegrees: scene.sourceAzimuthDegrees,
                incidentScaleAtObserver: scene.incidentScaleAtObserver,
                endpointSceneLightScalePolicy,
                groundDisplayRgba,
                diagnosticBoxesEnabled,
                cameraForwardReviewBoxes,
                farHorizonReviewBoxEnabled,
                denaliReviewBoxEnabled,
                endpointIndirectFillEnabled: effectiveEndpointIndirectFillEnabled,
                endpointIndirectFillSuppressedByCameraDistanceScale,
                endpointFillPolicy,
                endpointAmbientFillRatio,
                sceneDepthCapturePolicy,
                topAltitudeMeters: seed.topAltitudeMeters,
                sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
                observerCenteredDome: seed.observerCenteredDome,
                sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
                cacheZBinsMeters: seed.localCacheZBinsMeters,
                cacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
                referenceDistanceMeters: seed.referenceDistanceMeters,
                referenceSpectralIncidentScale:
                    scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale,
                radiusMeters: seed.sourceRadiusMeters,
                distanceFalloff: seed.distanceFalloff,
                cacheDirectionCount: seed.localCacheDirectionCount,
                incidentRadianceCacheEnabled: true,
                cachePathIntervalCount: seed.numericalControls.pathIntervalCount,
            }),
        }),
    });
}

function zeroIncidentRadianceTexturePayload() {
    const spectralChannelCount = CANONICAL_SPECTRAL_CHANNELS.length;
    const spectralGroupSize = 4;
    const spectralGroupCount = Math.ceil(spectralChannelCount / spectralGroupSize);

    return Object.freeze({
        kind: 'rgba32f-3d-texture-v1',
        textureId: 'zero-local-flat-direct-placeholder',
        width: 1,
        height: 1,
        depth: spectralGroupCount,
        format: 'rgba32f',
        samplerPolicy: 'not-sampled-for-direct-local-sun-cpu-smoke',
        coordinateOrder: Object.freeze(['directionIndex', 'altitudeBinIndex', 'spectralGroupIndex']),
        spectralGroupSize,
        spectralGroupCount,
        spectralChannelCount,
        rgbaFloat32: Object.freeze(new Array(spectralGroupCount * spectralGroupSize).fill(0)),
    });
}

function buildGpuShaderSetup() {
    const geometry = new FlatEarthGeometry({
        observerPositionMeters,
        sourcePositionMeters: scene.sourcePositionMeters,
        topAltitudeMeters: seed.topAltitudeMeters,
        sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
        observerCenteredDome: seed.observerCenteredDome,
        sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
        cacheZBinsMeters: seed.localCacheZBinsMeters,
        cacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new LocalSunLightSource({
        sourceKey: scene.id,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        referenceDistanceMeters: seed.referenceDistanceMeters,
        referenceSpectralIncidentScale:
            scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale,
        radiusMeters: seed.sourceRadiusMeters,
        distanceFalloff: seed.distanceFalloff,
        cacheZBinsMeters: seed.localCacheZBinsMeters,
        cacheRhoBinsMeters: seed.localCacheRhoBinsMeters,
        cacheDirectionCount: seed.localCacheDirectionCount,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: seed.numericalControls,
    });
    const cache = lightSource.createIncidentRadianceCache({
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
    });
    const localCacheBuildResult = buildIncidentRadianceCache({
        cache,
        geometry,
        atmosphere,
        lightSource,
        calculator,
        pathIntervalCount: seed.numericalControls.pathIntervalCount,
        sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
    });
    const localShaderPayload = localCacheBuildResult.cache.createShaderPayload();
    const descriptor = new LocalFlatShaderDescriptorBuilder().build({
        variantId: `algorithm32-local-flat-integrated-gpu-${scene.id}`,
        localFlat: Object.freeze({
            sourceKey: scene.id,
            observerPositionMeters,
            sourcePositionMeters: scene.sourcePositionMeters,
            topAltitudeMeters: seed.topAltitudeMeters,
            sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
            observerCenteredDome: geometry.configuration.observerCenteredDome,
            referenceDistanceMeters: seed.referenceDistanceMeters,
            referenceSpectralIncidentScale:
                scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale,
            radiusMeters: seed.sourceRadiusMeters,
            distanceFalloff: seed.distanceFalloff,
        }),
        cachePayload: localShaderPayload,
        transportOptimization: Object.freeze({
            pathIntervalCount: seed.numericalControls.pathIntervalCount,
            sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
            pathSampleDistribution: Object.freeze({ kind: 'uniform-distance' }),
        }),
        diagnosticCacheLookup: Object.freeze({ enabled: false }),
        diagnosticFlatGeometry: Object.freeze({ enabled: false }),
    });
    const factory = new LocalFlatShaderContributionFactory();
    const contributions = factory.createContributions(descriptor);
    const localAssembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions,
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });

    return Object.freeze({
        cacheBuildResult: localCacheBuildResult,
        shaderPayload: localShaderPayload,
        assembly: localAssembly,
    });
}

async function waitForWatcherResult(commandId) {
    const startedAt = Date.now();
    let lastWatcherProgressAt = startedAt;
    let lastProgressLogAt = 0;
    let lastProgressSignature = null;
    let waitPollCount = 0;

    while (Date.now() - lastWatcherProgressAt < WATCH_TIMEOUT_MS) {
        const now = Date.now();
        const candidate = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'latest.json'));
        if (candidate?.command?.id === commandId) {
            return candidate;
        }

        const progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
        const progressMessage = watcherProgressMessage(progress, commandId);
        const progressSignature = watcherProgressSignature(progress, commandId);
        const progressChanged = progressSignature && progressSignature !== lastProgressSignature;
        if (progressChanged) {
            lastProgressSignature = progressSignature;
            lastWatcherProgressAt = now;
        }
        if (progressMessage
            && progressChanged
            && (lastProgressLogAt === 0 || now - lastProgressLogAt >= PROGRESS_LOG_INTERVAL_MS)) {
            lastProgressLogAt = now;
            await appendRunLog(recordDirectory, `watcher progress: ${progressMessage}`);
        } else if (!progressMessage && waitPollCount % 8 === 0) {
            await appendRunLog(recordDirectory, `waiting for watcher result command=${commandId}.`);
        }
        waitPollCount += 1;
        await delay(POLL_MS);
    }

    throw new Error(`Timed out after ${WATCH_TIMEOUT_MS} ms without watcher progress for command ${commandId}.`);
}

function watcherProgressMessage(progress, commandId) {
    if (progress?.currentJobId !== commandId || typeof progress.message !== 'string') {
        return null;
    }

    return progress.message;
}

function watcherProgressSignature(progress, commandId) {
    if (progress?.currentJobId !== commandId || typeof progress.message !== 'string') {
        return null;
    }

    return JSON.stringify({
        updatedAt: progress.updatedAt ?? null,
        message: progress.message,
        detail: progress.detail ?? null,
    });
}

async function commandFileIsDone(commandId) {
    const current = await readJsonIfExists(COMMAND_PATH);
    return current?.id === commandId && current?.status === 'done';
}

async function readJsonIfExists(filePath) {
    try {
        return JSON.parse(await readFile(filePath, 'utf8'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function summarizeLatest(value) {
    if (!value) {
        return null;
    }

    return Object.freeze({
        status: value.status,
        commandId: value.command?.id ?? null,
        runDir: value.artifact?.runDir ?? null,
        pageErrors: value.browser?.pageErrors ?? [],
        fatalErrors: value.browser?.fatalErrors ?? [],
        savedArtifactNames: savedArtifactNames(value),
        wroteCanvasImage: browserArtifactSaved(value, 'images/canvas-image.png'),
        wrotePreShaderSceneColorImage: browserArtifactSaved(value, 'images/pre-shader-scene-color.png'),
        requiresPageRecovery: value.browser?.requiresPageRecovery ?? null,
    });
}

function browserArtifactSaved(value, artifactName) {
    return savedArtifactNames(value).includes(artifactName);
}

function savedArtifactNames(value) {
    const artifacts = Array.isArray(value?.artifact?.savedArtifacts)
        ? value.artifact.savedArtifacts
        : Array.isArray(value?.browser?.savedArtifacts)
            ? value.browser.savedArtifacts
            : [];

    return artifacts.map((artifact) => artifact.name).filter(Boolean);
}

function sameResolvedPath(left, right) {
    return typeof left === 'string'
        && typeof right === 'string'
        && resolve(left).toLowerCase() === resolve(right).toLowerCase();
}

function criterion(name, condition) {
    return Object.freeze({
        name,
        status: condition ? 'accepted' : 'rejected',
    });
}

function failure(name, message, details = {}) {
    return Object.freeze({ name, message, details });
}

function delay(milliseconds) {
    return new Promise((resolveDelay) => {
        setTimeout(resolveDelay, milliseconds);
    });
}

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

function booleanArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    const value = process.argv[index + 1];
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }

    return fallback;
}

function optionalNumberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

function optionalIntegerArg(name, fallback) {
    const value = optionalNumberArg(name, fallback);
    return Number.isInteger(value) ? value : fallback;
}

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    return typeof process.argv[index + 1] === 'string' ? process.argv[index + 1] : fallback;
}

function shaderBackendArg(name, fallback) {
    const value = stringArg(name, fallback);
    return value === 'gpu' ? 'gpu' : 'cpu';
}

function endpointSceneLightScalePolicyArg(name, fallback) {
    const value = stringArg(name, fallback);
    return value === 'observer-incident-scale'
        ? 'observer-incident-scale'
        : 'endpoint-material-shading';
}

function endpointFillPolicyArg(name, fallback) {
    const value = stringArg(name, fallback);
    if (value === 'opposite-directional-fill') {
        return 'opposite-directional-fill';
    }
    if (value === 'source-direction-falloff-fill') {
        return 'source-direction-falloff-fill';
    }
    return 'general-ambient-fill';
}

function sceneDepthCapturePolicyArg(name, fallback) {
    const value = stringArg(name, fallback);
    return value === 'renderer-distance'
        ? 'renderer-distance'
        : 'raycaster';
}

function endpointCameraDistanceScalePolicyArg(name, fallback) {
    const value = stringArg(name, fallback);
    return value === 'reverse-square'
        ? 'reverse-square'
        : 'none';
}

function rgbaArg(name, fallback) {
    const rawValue = stringArg(name, '');
    const values = rawValue.split(',').map((entry) => Number(entry.trim()));
    if (values.length < 3 || values.some((value) => !Number.isFinite(value))) {
        return fallback;
    }

    return Object.freeze([
        clampByte(values[0]),
        clampByte(values[1]),
        clampByte(values[2]),
        values.length >= 4 ? clampByte(values[3]) : 255,
    ]);
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function resolveLookAtSceneUnits() {
    if (!Number.isFinite(lookAtHeightMeters) && !lookTowardScene) {
        return null;
    }

    const lookAtHeightSceneUnits = (Number.isFinite(lookAtHeightMeters) ? lookAtHeightMeters : 0)
        / metersPerSceneUnit;
    const lookAtDistanceSceneUnits = lookAtDistanceMeters / metersPerSceneUnit;

    if (!lookTowardScene) {
        return Object.freeze([0, lookAtHeightSceneUnits, -lookAtDistanceSceneUnits]);
    }

    const sourcePositionMeters = lookTowardScene.sourcePositionMeters;
    const sceneHorizontalX = sourcePositionMeters[0] - observerPositionMeters[0];
    const sceneHorizontalZ = -(sourcePositionMeters[1] - observerPositionMeters[1]);
    const sceneHorizontalLength = Math.hypot(sceneHorizontalX, sceneHorizontalZ);
    if (sceneHorizontalLength <= 0.000001) {
        return Object.freeze([0, lookAtHeightSceneUnits, -lookAtDistanceSceneUnits]);
    }

    return Object.freeze([
        sceneHorizontalX / sceneHorizontalLength * lookAtDistanceSceneUnits,
        lookAtHeightSceneUnits,
        sceneHorizontalZ / sceneHorizontalLength * lookAtDistanceSceneUnits,
    ]);
}

function runnerInvocationCommand() {
    const parts = [
        'node',
        'scripts/flat/reconciliation/POC/src/runners/m3CpuIntegratedFlatLocalSunScene.js',
        '--record', recordDirectory,
        '--width', String(width),
        '--height', String(height),
        '--shader-backend', shaderBackend,
        '--scene-set', sceneSetId,
        '--scene-index', String(sceneIndex),
        '--scene-depth-max-meters', String(sceneDepthMaxMeters),
        '--vertical-fov-degrees', String(verticalFovDegrees),
        '--meters-per-scene-unit', String(metersPerSceneUnit),
        '--observer-height-meters', String(observerHeightMeters),
        '--look-at-distance-meters', String(lookAtDistanceMeters),
        '--shadows-enabled', String(shadowsEnabled),
        '--endpoint-radiance-scale', String(endpointRadianceScale),
        '--endpoint-indirect-fill-enabled', String(effectiveEndpointIndirectFillEnabled),
        '--endpoint-fill-policy', endpointFillPolicy,
        '--endpoint-ambient-fill-ratio', String(endpointAmbientFillRatio),
        '--endpoint-camera-distance-scale-policy', endpointCameraDistanceScale.policy,
        '--endpoint-camera-distance-reference-meters', String(endpointCameraDistanceScale.referenceMeters),
        '--endpoint-camera-distance-min-scale', String(endpointCameraDistanceScale.minScale),
        '--endpoint-camera-distance-max-scale', String(endpointCameraDistanceScale.maxScale),
        '--scene-depth-capture-policy', sceneDepthCapturePolicy,
        '--endpoint-light-scale-policy', endpointSceneLightScalePolicy,
        '--ground-display-rgba', groundDisplayRgba.join(','),
        '--diagnostic-boxes-enabled', String(diagnosticBoxesEnabled),
        '--minimum-diagnostic-box-hit-count', String(minimumDiagnosticBoxHitCount),
    ];

    if (Number.isInteger(lookTowardSceneIndex)) {
        parts.push('--look-toward-scene-index', String(lookTowardSceneIndex));
    }
    if (Number.isFinite(lookAtHeightMeters)) {
        parts.push('--look-at-height-meters', String(lookAtHeightMeters));
    }
    if (cameraForwardReviewBoxes) {
        parts.push('--camera-forward-review-boxes', 'true');
    }
    if (farHorizonReviewBoxEnabled) {
        parts.push('--far-horizon-review-box-enabled', 'true');
    }
    if (denaliReviewBoxEnabled) {
        parts.push('--denali-review-box-enabled', 'true');
    }
    if (!antialiasEnabled) {
        parts.push('--no-antialias');
    }

    return parts.join(' ');
}

function summarizeShaderPayload(payload) {
    if (!payload) {
        return null;
    }

    return Object.freeze({
        payloadKind: payload.payloadKind,
        dimensions: payload.dimensions,
        format: payload.format,
        texture: Object.freeze({
            textureId: payload.texture.textureId,
            width: payload.texture.width,
            height: payload.texture.height,
            depth: payload.texture.depth,
            coordinateOrder: payload.texture.coordinateOrder,
            spectralGroupSize: payload.texture.spectralGroupSize,
            spectralGroupCount: payload.texture.spectralGroupCount,
            spectralChannelCount: payload.texture.spectralChannelCount,
            uploadValueCount: payload.texture.rgbaFloat32.length,
        }),
        lookup: payload.lookup,
        metadata: payload.metadata,
    });
}
