// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.3.1 local/flat integrated CPU/GPU parity.
// - scripts/flat/reconciliation/POC/browser-page/runner.js, local-flat constructed-scene composer route.
// - tmp/atmosphere/reconciliation/536-m4-flat-geometry-gpu-selected-ray-parity.

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

const COMMAND_PATH = resolve('scripts/flat/reconciliation/POC/browser-jobs/browser-command.json');
const WATCHER_OUT_ROOT = resolve('tmp/atmosphere/reconciliation');
const WATCH_TIMEOUT_MS = numberArg('--watch-timeout-ms', 300000);
const POLL_MS = 750;
const PROGRESS_LOG_INTERVAL_MS = 5000;
const recordDirectory = parseRecordDirectory(process.argv);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const scene = seed.currentReviewScenes[0];
const width = numberArg('--width', 96);
const height = numberArg('--height', 54);
const observerHeightMeters = numberArg('--observer-height-meters', 150);
const observerPositionMeters = Object.freeze([
    seed.observerPositionMeters[0],
    seed.observerPositionMeters[1],
    observerHeightMeters,
]);
const metersPerSceneUnit = numberArg('--meters-per-scene-unit', 1000);
const sceneDepthMaxMeters = numberArg('--scene-depth-max-meters', seed.sceneSkyRayLimitMeters);
const verticalFovDegrees = numberArg('--vertical-fov-degrees', 45);
const parityToleranceBytes = numberArg('--parity-tolerance-bytes', 10);
const cpuArtifactRunDirectory = resolve(recordDirectory, 'cpu');
const gpuArtifactRunDirectory = resolve(recordDirectory, 'gpu');
const failures = [];

await appendRunLog(recordDirectory, 'm4LocalFlatGpuIntegratedSelectedPixelParityProbe started.');

let models = null;
let cacheBuildResult = null;
let shaderPayload = null;
let descriptor = null;
let contributions = [];
let assembly = null;
let cpuCommand = null;
let gpuCommand = null;
let cpuLatest = null;
let gpuLatest = null;
let progress = null;
let cpuSelectedPixelArtifact = null;
let gpuSelectedPixelArtifact = null;
let cpuBrowserDiagnostics = null;
let gpuBrowserDiagnostics = null;
let comparisons = [];

try {
    models = createLocalFlatModels();
    const cache = models.lightSource.createIncidentRadianceCache({
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
    });
    cacheBuildResult = buildIncidentRadianceCache({
        cache,
        geometry: models.geometry,
        atmosphere: models.atmosphere,
        lightSource: models.lightSource,
        calculator: models.calculator,
        pathIntervalCount: seed.numericalControls.pathIntervalCount,
        sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
    });
    shaderPayload = cacheBuildResult.cache.createShaderPayload();
    descriptor = new LocalFlatShaderDescriptorBuilder().build({
        variantId: 'algorithm32-local-flat-integrated-gpu-l2-parity',
        localFlat: localFlatDescriptorFacts(),
        cachePayload: shaderPayload,
        transportOptimization: Object.freeze({
            pathIntervalCount: seed.numericalControls.pathIntervalCount,
            sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
            pathSampleDistribution: Object.freeze({ kind: 'uniform-distance' }),
        }),
        diagnosticCacheLookup: Object.freeze({ enabled: false }),
        diagnosticFlatGeometry: Object.freeze({ enabled: false }),
    });
    const factory = new LocalFlatShaderContributionFactory();
    contributions = factory.createContributions(descriptor);
    assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions,
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });

    cpuCommand = makeCommand('cpu', cpuArtifactRunDirectory, '');
    await submitCommand(cpuCommand);
    cpuLatest = await waitForWatcherResult(cpuCommand.id);
    cpuSelectedPixelArtifact = await selectedPixelArtifactFor(cpuLatest);
    cpuBrowserDiagnostics = await browserDiagnosticsFor(cpuLatest);

    gpuCommand = makeCommand('gpu', gpuArtifactRunDirectory, assembly.fragmentShaderSource);
    await submitCommand(gpuCommand);
    gpuLatest = await waitForWatcherResult(gpuCommand.id);
    gpuSelectedPixelArtifact = await selectedPixelArtifactFor(gpuLatest);
    gpuBrowserDiagnostics = await browserDiagnosticsFor(gpuLatest);
    progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
    comparisons = compareSelectedPixels(
        cpuSelectedPixelArtifact?.selectedPixels ?? [],
        gpuSelectedPixelArtifact?.selectedPixels ?? [],
    );
} catch (error) {
    failures.push(failure('m4-local-flat-gpu-integrated-selected-pixel-parity-crash', error.message, { stack: error.stack }));
}

const cpuSelectedPixels = cpuSelectedPixelArtifact?.selectedPixels ?? [];
const gpuSelectedPixels = gpuSelectedPixelArtifact?.selectedPixels ?? [];
const cpuComposerDiagnostics = cpuLatest?.result?.diagnostics?.shader?.composer ?? null;
const gpuComposerDiagnostics = gpuLatest?.result?.diagnostics?.shader?.composer ?? null;
const criteria = Object.freeze([
    criterion('local-cache-builds-all-coordinates',
        cacheBuildResult?.coordinateCount
            === seed.localCacheZBinsMeters.length * seed.localCacheRhoBinsMeters.length * seed.localCacheDirectionCount
        && cacheBuildResult?.cache.valueCount === cacheBuildResult?.coordinateCount),
    criterion('gpu-assembly-created',
        assembly?.status === 'accepted'
        && assembly?.validationReport?.status === 'accepted'
        && typeof assembly.fragmentShaderSource === 'string'),
    criterion('gpu-fragment-source-uses-local-l2-and-flat-dome',
        assembly?.fragmentShaderSource?.includes('readLocalIncidentRadianceTexture') === true
        && assembly.fragmentShaderSource.includes('observerDomeBoundaryDistance')
        && assembly.fragmentShaderSource.includes('GEOMETRY_OBSERVER_DOME_ENABLED = true')),
    criterion('cpu-command-submitted-pending', cpuCommand?.status === 'pending'),
    criterion('gpu-command-submitted-pending', gpuCommand?.status === 'pending'),
    criterion('cpu-watcher-completed-matching-command', cpuLatest?.command?.id === cpuCommand?.id),
    criterion('gpu-watcher-completed-matching-command', gpuLatest?.command?.id === gpuCommand?.id),
    criterion('watcher-marked-gpu-command-done', await commandFileIsDone(gpuCommand?.id)),
    criterion('cpu-browser-artifacts-written-in-cpu-subdirectory',
        sameResolvedPath(cpuLatest?.artifact?.runDir, cpuArtifactRunDirectory)),
    criterion('gpu-browser-artifacts-written-in-gpu-subdirectory',
        sameResolvedPath(gpuLatest?.artifact?.runDir, gpuArtifactRunDirectory)),
    criterion('cpu-browser-job-accepted', cpuLatest?.status === 'accepted'),
    criterion('gpu-browser-job-accepted', gpuLatest?.status === 'accepted'),
    criterion('cpu-backend-is-integrated-cpu',
        cpuLatest?.result?.diagnostics?.shader?.backend === 'cpu'
        && cpuComposerDiagnostics?.evaluatorKind === 'SpectralReferenceEvaluator.evaluate'),
    criterion('gpu-backend-is-integrated-gpu',
        gpuLatest?.result?.diagnostics?.shader?.backend === 'gpu'
        && gpuComposerDiagnostics?.kind === 'algorithm32-gpu-composer-pass'),
    criterion('cpu-input-contract-is-flat-local',
        cpuComposerDiagnostics?.inputContract?.geometryKind === 'flat-earth'
        && cpuComposerDiagnostics?.inputContract?.lightSourceKind === 'local-sun'),
    criterion('gpu-input-contract-is-flat-local',
        gpuComposerDiagnostics?.inputContract?.geometryKind === 'flat-earth'
        && gpuComposerDiagnostics?.inputContract?.lightSourceKind === 'local-sun'),
    criterion('cpu-local-l2-cache-used',
        cpuComposerDiagnostics?.incidentRadianceCache?.mode === 'local-l2-cache-sampler'
        && cpuComposerDiagnostics?.incidentRadianceCache?.cacheKind === 'local'
        && cpuComposerDiagnostics?.incidentRadianceCache?.coordinateCount > 0),
    criterion('gpu-local-l2-texture-uploaded',
        gpuComposerDiagnostics?.inputContract?.incidentRadianceTexture?.kind === 'rgba32f-3d-texture-v1'
        && gpuComposerDiagnostics?.inputContract?.incidentRadianceTexture?.uploadValueCount
            === shaderPayload?.texture.rgbaFloat32.length),
    criterion('selected-pixel-counts-match',
        cpuSelectedPixels.length > 0
        && cpuSelectedPixels.length === gpuSelectedPixels.length
        && comparisons.length === cpuSelectedPixels.length),
    criterion('selected-pixel-readbacks-within-tolerance',
        comparisons.length > 0
        && comparisons.every((comparison) => comparison.withinTolerance),
        { parityToleranceBytes }),
    criterion('cpu-and-gpu-images-written',
        browserArtifactSaved(cpuLatest, 'images/canvas-image.png')
        && browserArtifactSaved(gpuLatest, 'images/canvas-image.png')
        && browserArtifactSaved(cpuLatest, 'images/pre-shader-scene-color.png')
        && browserArtifactSaved(gpuLatest, 'images/pre-shader-scene-color.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Local/flat integrated GPU selected-pixel parity criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish Milestone 4.3.1 by running the same constructed local-flat scene through
the integrated CPU and GPU composer backends, both using the local L2 cache
contract, then compare selected-pixel browser readbacks objectively.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '4.3.1-local-flat-gpu-integrated-selected-pixel-parity',
    runner: 'm4LocalFlatGpuIntegratedSelectedPixelParityProbe',
    sceneId: scene.id,
    viewportPixels: [width, height],
    observerPositionMeters,
    metersPerSceneUnit,
    sceneDepthMaxMeters,
    verticalFovDegrees,
    parityToleranceBytes,
    cpuArtifactRunDirectory,
    gpuArtifactRunDirectory,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-431-localflat-gpu-parity-evidence-recreation',
        'tmp/atmosphere/reconciliation/535-m4-local-gpu-cache-texture-lookup',
        'tmp/atmosphere/reconciliation/536-m4-flat-geometry-gpu-selected-ray-parity',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
        'scripts/flat/reconciliation/POC/browser-page/algorithm32-composer-passes.js',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    contributionIds: contributions.map((contribution) => contribution.id),
    cache: cacheBuildResult
        ? Object.freeze({
            coordinateCount: cacheBuildResult.coordinateCount,
            valueCount: cacheBuildResult.cache.valueCount,
            descriptor: cacheBuildResult.cache.descriptor,
        })
        : null,
    shaderPayload: summarizeShaderPayload(shaderPayload),
    geometryConfiguration: models?.geometry?.configuration ?? null,
    commands: Object.freeze({
        cpu: cpuCommand,
        gpu: gpuCommand,
    }),
    progress,
    latestSummary: Object.freeze({
        cpu: summarizeLatest(cpuLatest),
        gpu: summarizeLatest(gpuLatest),
    }),
    browserDiagnostics: Object.freeze({
        cpu: cpuBrowserDiagnostics,
        gpu: gpuBrowserDiagnostics,
    }),
    selectedPixels: Object.freeze({
        cpu: cpuSelectedPixelArtifact,
        gpu: gpuSelectedPixelArtifact,
        comparisons,
    }),
});
await writeText(recordDirectory, 'fragment-shader.glsl', assembly?.fragmentShaderSource ?? '');
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m4LocalFlatGpuIntegratedSelectedPixelParityProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    stage: '4.3.1-local-flat-gpu-integrated-selected-pixel-parity',
    recordDirectory,
    cpuWatcherRunDir: cpuLatest?.artifact?.runDir ?? null,
    gpuWatcherRunDir: gpuLatest?.artifact?.runDir ?? null,
    selectedPixelComparisonCount: comparisons.length,
    maxReadbackDelta: comparisons.reduce((max, comparison) => Math.max(max, comparison.maxAbsoluteDelta), 0),
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

M4.3.1 local/flat integrated CPU/GPU selected-pixel parity probe finished with
status: ${status}.

- Scene seed: \`${scene.id}\`.
- GPU source hash: \`${assembly?.sourceHash ?? 'not-built'}\`.
- Selected comparisons: \`${comparisons.length}\`.
- Max byte delta: \`${comparisons.reduce((max, comparison) => Math.max(max, comparison.maxAbsoluteDelta), 0)}\`.
- Tolerance: \`${parityToleranceBytes}\` byte(s).
- CPU artifact directory: \`${cpuLatest?.artifact?.runDir ?? 'not-completed'}\`.
- GPU artifact directory: \`${gpuLatest?.artifact?.runDir ?? 'not-completed'}\`.
`);
await appendRunLog(recordDirectory, `m4LocalFlatGpuIntegratedSelectedPixelParityProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    cpuWatcherRunDir: cpuLatest?.artifact?.runDir ?? null,
    gpuWatcherRunDir: gpuLatest?.artifact?.runDir ?? null,
    selectedPixelComparisonCount: comparisons.length,
    maxReadbackDelta: comparisons.reduce((max, comparison) => Math.max(max, comparison.maxAbsoluteDelta), 0),
    failureCount: failures.length,
}));

function createLocalFlatModels() {
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

    return Object.freeze({
        geometry,
        atmosphere,
        lightSource,
        calculator,
    });
}

function localFlatDescriptorFacts() {
    return Object.freeze({
        sourceKey: scene.id,
        observerPositionMeters,
        sourcePositionMeters: scene.sourcePositionMeters,
        topAltitudeMeters: seed.topAltitudeMeters,
        sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
        observerCenteredDome: models.geometry.configuration.observerCenteredDome,
        referenceDistanceMeters: seed.referenceDistanceMeters,
        referenceSpectralIncidentScale:
            scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale,
        radiusMeters: seed.sourceRadiusMeters,
        distanceFalloff: seed.distanceFalloff,
    });
}

function makeCommand(shaderBackend, artifactRunDirectory, fragmentShaderSource) {
    return Object.freeze({
        id: `m4-local-flat-${shaderBackend}-integrated-parity-${Date.now()}`,
        label: `m4-local-flat-${shaderBackend}-integrated-parity`,
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal:
            `Render the same local-flat constructed scene through the integrated ${shaderBackend.toUpperCase()} composer pass.`,
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: `m4-local-flat-integrated-${shaderBackend}-${scene.id}`,
            sceneKind: 'local-flat-ground',
            shaderRuntime: 'three-effect-composer',
            shaderBackend,
            comparisonMode: 'm4-local-flat-cpu-gpu-integrated-parity',
            fragmentShaderSource,
            viewportPixels: Object.freeze([width, height]),
            metersPerSceneUnit,
            sceneDepthMaxMeters,
            verticalFovDegrees,
            shadowsEnabled: false,
            minimumDiagnosticBoxHitCount: 5,
            pathIntervalCount: seed.numericalControls.pathIntervalCount,
            sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
            endpointRadianceScale: 1,
            incidentRadianceTexture: shaderPayload.texture,
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
                endpointSceneLightScalePolicy: 'endpoint-material-shading',
                groundDisplayRgba: Object.freeze([86, 105, 66, 255]),
                diagnosticBoxesEnabled: true,
                cameraForwardReviewBoxes: false,
                farHorizonReviewBoxEnabled: false,
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

async function submitCommand(command) {
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
}

async function selectedPixelArtifactFor(latest) {
    return latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
}

async function browserDiagnosticsFor(latest) {
    return latest?.artifact?.paths?.browserDiagnosticsPath
        ? await readJsonIfExists(latest.artifact.paths.browserDiagnosticsPath)
        : null;
}

function compareSelectedPixels(cpuPixels, gpuPixels) {
    const gpuById = new Map(gpuPixels.map((pixel) => [pixel.pixelId, pixel]));

    return cpuPixels
        .filter((cpuPixel) => gpuById.has(cpuPixel.pixelId))
        .map((cpuPixel) => {
            const gpuPixel = gpuById.get(cpuPixel.pixelId);
            const deltas = cpuPixel.readbackRgba.map((value, index) =>
                gpuPixel.readbackRgba[index] - value);
            const absoluteDeltas = deltas.map(Math.abs);
            const maxAbsoluteDelta = Math.max(...absoluteDeltas);

            return Object.freeze({
                pixelId: cpuPixel.pixelId,
                x: cpuPixel.x,
                y: cpuPixel.y,
                cpuReadbackRgba: cpuPixel.readbackRgba,
                gpuReadbackRgba: gpuPixel.readbackRgba,
                deltas,
                maxAbsoluteDelta,
                absoluteDeltaSum: absoluteDeltas.reduce((sum, value) => sum + value, 0),
                withinTolerance: maxAbsoluteDelta <= parityToleranceBytes,
            });
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
        wrotePreShaderSceneColor: browserArtifactSaved(value, 'images/pre-shader-scene-color.png'),
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

function criterion(name, accepted, details = null) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
        details,
    });
}

function failure(id, message, details = null) {
    return Object.freeze({ id, message, details });
}

function delay(ms) {
    return new Promise((resolveDelay) => {
        setTimeout(resolveDelay, ms);
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
