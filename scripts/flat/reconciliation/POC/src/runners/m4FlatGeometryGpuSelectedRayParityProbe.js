// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.3.1 flat GPU geometry selected-ray parity.
// - scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js, canonical flat ray/path/cache ownership.
// - tmp/atmosphere/reconciliation/535-m4-local-gpu-cache-texture-lookup.

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
const artifactRunDirectory = resolve(recordDirectory);
const seed = M2_LOCAL_FLAT_SEED_CONSTANTS;
const scene = seed.currentReviewScenes[0];
const width = 16;
const height = 16;
const observerPositionMeters = Object.freeze([
    seed.observerPositionMeters[0],
    seed.observerPositionMeters[1],
    numberArg('--observer-height-meters', 150),
]);
const sceneDepthMaxMeters = numberArg('--scene-depth-max-meters', 100000);
const distanceScaleMeters = numberArg(
    '--distance-scale-meters',
    Math.max(seed.sceneSkyRayLimitMeters, seed.observerCenteredDome.maxObserverViewRayExtentMeters),
);
const altitudeScaleMeters = seed.topAltitudeMeters;
const selectedPixels = Object.freeze([
    Object.freeze({ pixelId: 'forward-dome', x: 8, y: 8 }),
    Object.freeze({ pixelId: 'upward-top', x: 8, y: 14 }),
    Object.freeze({ pixelId: 'downward-ground', x: 8, y: 1 }),
    Object.freeze({ pixelId: 'explicit-scene-hit', x: 4, y: 8 }),
    Object.freeze({ pixelId: 'wide-rho', x: 14, y: 8 }),
]);
const sceneHitDepthByPixelId = Object.freeze({
    'explicit-scene-hit': 0.125,
});
const failures = [];

await appendRunLog(recordDirectory, 'm4FlatGeometryGpuSelectedRayParityProbe started.');

let models = null;
let cacheBuildResult = null;
let shaderPayload = null;
let sceneTextures = null;
let diagnosticRuns = [];
let command = null;
let latest = null;
let progress = null;
let selectedPixelArtifact = null;
let browserDiagnostics = null;

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
    sceneTextures = createDiagnosticSceneTextures();
    diagnosticRuns = Object.freeze([
        buildDiagnosticRun('ray-direction'),
        buildDiagnosticRun('path-bounds'),
        buildDiagnosticRun('cache-coordinate'),
    ]);
    command = makeCommand();
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
    selectedPixelArtifact = latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
    browserDiagnostics = latest?.artifact?.paths?.browserDiagnosticsPath
        ? await readJsonIfExists(latest.artifact.paths.browserDiagnosticsPath)
        : null;
} catch (error) {
    failures.push(failure('m4-flat-geometry-gpu-selected-ray-parity-crash', error.message, { stack: error.stack }));
}

const browserSelectedPixels = selectedPixelArtifact?.selectedPixels ?? [];
const expectedSelectedPixelCount = diagnosticRuns.reduce((sum, run) =>
    sum + run.expectedReadbacks.length, 0);
const criteria = Object.freeze([
    criterion('local-flat-models-created-with-derived-dome',
        models?.geometry?.configuration?.observerCenteredDome?.sphereCenterMeters?.length === 3
        && Number.isFinite(models?.geometry?.configuration?.observerCenteredDome?.sphereRadiusMeters)),
    criterion('local-cache-builds-all-coordinates',
        cacheBuildResult?.coordinateCount
            === seed.localCacheZBinsMeters.length * seed.localCacheRhoBinsMeters.length * seed.localCacheDirectionCount
        && cacheBuildResult?.cache.valueCount === cacheBuildResult?.coordinateCount),
    criterion('diagnostic-assemblies-created',
        diagnosticRuns.length === 3
        && diagnosticRuns.every((run) =>
            run.assembly?.status === 'accepted'
            && run.assembly?.validationReport?.status === 'accepted')),
    criterion('fragment-source-uses-flat-geometry-dome-and-local-fibonacci',
        diagnosticRuns.every((run) =>
            run.assembly.fragmentShaderSource.includes('observerDomeBoundaryDistance')
            && run.assembly.fragmentShaderSource.includes('GEOMETRY_OBSERVER_DOME_ENABLED = true')
            && run.assembly.fragmentShaderSource.includes('1.0 - (2.0 * (index + 0.5))'))),
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('browser-readbacks-present',
        browserSelectedPixels.length === expectedSelectedPixelCount),
    criterion('browser-readbacks-match-cpu-flat-geometry-reference',
        browserSelectedPixels.length === expectedSelectedPixelCount
        && browserSelectedPixels.every((pixel) =>
            rgbaWithinTolerance(pixel.readbackRgba, pixel.expectedReadbackRgba, 2))),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Flat geometry GPU selected-ray parity criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish the first half of Milestone 4.3.1 by proving the local/flat GPU shader
uses the same selected-ray geometry contract as FlatEarthGeometry for
reconstructed ray direction, scene-hit ray termination, ground/top/dome/sky
path bounds, and z/rho local cache access coordinates.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '4.3.1-flat-geometry-gpu-selected-ray-parity',
    runner: 'm4FlatGeometryGpuSelectedRayParityProbe',
    sceneSetId: seed.currentReviewSceneSetId,
    sceneId: scene.id,
    artifactRunDirectory,
    viewportPixels: [width, height],
    observerPositionMeters,
    sceneDepthMaxMeters,
    distanceScaleMeters,
    altitudeScaleMeters,
    selectedPixels,
    sceneHitDepthByPixelId,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    generatedAt: nowIso(),
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-431-localflat-gpu-parity-evidence-recreation',
        'scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderDescriptorBuilder.js',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
        'tmp/atmosphere/reconciliation/535-m4-local-gpu-cache-texture-lookup',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    shaderPayload: summarizeShaderPayload(shaderPayload),
    cache: cacheBuildResult
        ? Object.freeze({
            coordinateCount: cacheBuildResult.coordinateCount,
            valueCount: cacheBuildResult.cache.valueCount,
            descriptor: cacheBuildResult.cache.descriptor,
        })
        : null,
    geometryConfiguration: models?.geometry?.configuration ?? null,
    diagnosticRuns: diagnosticRuns.map((run) => summarizeDiagnosticRun(run)),
    command,
    progress,
    latestSummary: summarizeLatest(latest),
    browserDiagnostics,
    selectedPixels: selectedPixelArtifact,
});
for (const run of diagnosticRuns) {
    await writeText(recordDirectory, `fragment-shader-${run.mode}.glsl`, run.assembly?.fragmentShaderSource ?? '');
}
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m4FlatGeometryGpuSelectedRayParityProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    stage: '4.3.1-flat-geometry-gpu-selected-ray-parity',
    recordDirectory,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    expectedSelectedPixelCount,
    browserSelectedPixelCount: browserSelectedPixels.length,
    failureCount: failures.length,
});
await writeText(recordDirectory, 'report.md', `# Report

M4.3.1 flat geometry GPU selected-ray parity probe finished with status:
${status}.

- Scene seed: \`${scene.id}\`.
- Observer position: \`${observerPositionMeters.join(', ')}\` meters.
- Diagnostic modes: \`${diagnosticRuns.map((run) => run.mode).join(', ')}\`.
- Selected readbacks: \`${browserSelectedPixels.length}/${expectedSelectedPixelCount}\`.
- Browser artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`.

The CPU expectation is derived from \`FlatEarthGeometry\`; the browser readback
comes from assembled local/flat GLSL running in WebGL2.
`);
await appendRunLog(recordDirectory, `m4FlatGeometryGpuSelectedRayParityProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    expectedSelectedPixelCount,
    browserSelectedPixelCount: browserSelectedPixels.length,
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

function buildDiagnosticRun(mode) {
    const descriptor = new LocalFlatShaderDescriptorBuilder().build({
        variantId: `algorithm32-local-flat-geometry-diagnostic-${mode}`,
        localFlat: localFlatDescriptorFacts(),
        cachePayload: shaderPayload,
        transportOptimization: Object.freeze({
            pathIntervalCount: seed.numericalControls.pathIntervalCount,
            sourceTransmittanceIntervalCount: seed.numericalControls.sourceTransmittanceIntervalCount,
            pathSampleDistribution: Object.freeze({ kind: 'uniform-distance' }),
        }),
        diagnosticCacheLookup: Object.freeze({ enabled: false }),
        diagnosticFlatGeometry: Object.freeze({
            enabled: true,
            mode,
            distanceScaleMeters,
            altitudeScaleMeters,
        }),
    });
    const factory = new LocalFlatShaderContributionFactory();
    const contributions = factory.createContributions(descriptor);
    const assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions,
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    const expectedReadbacks = selectedPixels.map((selection) =>
        expectedReadbackForSelection(selection, mode));

    return Object.freeze({
        runId: mode,
        mode,
        descriptor,
        contributions,
        assembly,
        selectedPixels,
        expectedReadbacks,
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

function createDiagnosticSceneTextures() {
    const depthBytes = new Array(width * height * 4).fill(255);
    const hitBytes = new Array(width * height * 4).fill(0);
    const decodedHitDistanceByPixelId = {};

    for (const selection of selectedPixels) {
        const hitDepth = sceneHitDepthByPixelId[selection.pixelId];
        if (!Number.isFinite(hitDepth)) {
            continue;
        }

        const encodedDepth = encodeDepthUnit(hitDepth);
        const offset = ((selection.y * width) + selection.x) * 4;
        depthBytes[offset] = encodedDepth[0];
        depthBytes[offset + 1] = encodedDepth[1];
        depthBytes[offset + 2] = encodedDepth[2];
        depthBytes[offset + 3] = 255;
        hitBytes[offset] = 255;
        hitBytes[offset + 3] = 255;
        decodedHitDistanceByPixelId[selection.pixelId] = decodeDepthUnit(encodedDepth) * sceneDepthMaxMeters;
    }

    return Object.freeze({
        sceneDepthTexture: Object.freeze({
            kind: 'rgba8-2d-texture-v1',
            width,
            height,
            rgbaBytes: Object.freeze(depthBytes),
        }),
        sceneHitTexture: Object.freeze({
            kind: 'rgba8-2d-texture-v1',
            width,
            height,
            rgbaBytes: Object.freeze(hitBytes),
        }),
        decodedHitDistanceByPixelId: Object.freeze(decodedHitDistanceByPixelId),
    });
}

function expectedReadbackForSelection(selection, mode) {
    const direction = reconstructModelDirection(selection);
    const hitDistanceMeters = sceneTextures.decodedHitDistanceByPixelId[selection.pixelId];
    const segment = models.geometry.resolveViewRaySegment({
        origin: observerPositionMeters,
        direction,
        ...(Number.isFinite(hitDistanceMeters)
            ? { endDistanceMeters: hitDistanceMeters }
            : {}),
    });
    const groundDistanceMeters = models.geometry.distanceToGroundBoundary(observerPositionMeters, direction);
    const hasSceneEndpoint = Number.isFinite(hitDistanceMeters);
    const hasGroundEndpoint = groundDistanceMeters !== null
        && groundDistanceMeters <= segment.endDistanceMeters + 1e-3;
    const samplePositionMeters = addScaled(
        observerPositionMeters,
        direction,
        Math.max(segment.endDistanceMeters * 0.5, 0),
    );

    if (mode === 'ray-direction') {
        return Object.freeze({
            pixelId: selection.pixelId,
            x: selection.x,
            y: selection.y,
            expectedReadbackRgba: Object.freeze([
                byteFromUnit(direction[0] * 0.5 + 0.5),
                byteFromUnit(direction[1] * 0.5 + 0.5),
                byteFromUnit(direction[2] * 0.5 + 0.5),
                255,
            ]),
            reference: Object.freeze({ direction }),
        });
    }

    if (mode === 'path-bounds') {
        return Object.freeze({
            pixelId: selection.pixelId,
            x: selection.x,
            y: selection.y,
            expectedReadbackRgba: Object.freeze([
                byteFromUnit(segment.endDistanceMeters / distanceScaleMeters),
                hasSceneEndpoint ? 255 : 0,
                hasGroundEndpoint ? 255 : 0,
                255,
            ]),
            reference: Object.freeze({
                endDistanceMeters: segment.endDistanceMeters,
                hasSceneEndpoint,
                hasGroundEndpoint,
                groundDistanceMeters,
                hitDistanceMeters: hitDistanceMeters ?? null,
            }),
        });
    }

    const atmosphereCoordinate = models.geometry.resolveAtmosphereCoordinate(samplePositionMeters);
    const sourceRelativePosition = models.geometry.resolveSourceRelativePosition({
        position: samplePositionMeters,
    });
    const cacheAccess = models.geometry.resolveCacheAccess({
        position: samplePositionMeters,
        atmosphereCoordinate,
        sourceRelativePosition,
    });
    const zBinIndex = cacheAccess.metadata.zBinIndex;
    const rhoBinIndex = cacheAccess.metadata.rhoBinIndex;

    return Object.freeze({
        pixelId: selection.pixelId,
        x: selection.x,
        y: selection.y,
        expectedReadbackRgba: Object.freeze([
            byteFromUnit(samplePositionMeters[2] / altitudeScaleMeters),
            byteFromUnit(zBinIndex / Math.max(seed.localCacheZBinsMeters.length - 1, 1)),
            byteFromUnit(rhoBinIndex / Math.max(seed.localCacheRhoBinsMeters.length - 1, 1)),
            255,
        ]),
        reference: Object.freeze({
            samplePositionMeters,
            altitudeMeters: atmosphereCoordinate.altitudeMeters,
            rhoMeters: cacheAccess.metadata.rhoMeters,
            zBinIndex,
            rhoBinIndex,
        }),
    });
}

function reconstructModelDirection(selection) {
    const uv = [
        (selection.x + 0.5) / width,
        (selection.y + 0.5) / height,
    ];
    const sceneDirection = normalize3([
        uv[0] * 2 - 1,
        uv[1] * 2 - 1,
        1,
    ]);
    const frame = models.geometry.configuration.observerLocalSceneFrame;

    return normalize3(add3(
        add3(scale3(frame.right, sceneDirection[0]), scale3(frame.up, sceneDirection[1])),
        scale3(frame.forward, sceneDirection[2]),
    ));
}

function makeCommand() {
    return Object.freeze({
        id: `m4-flat-geometry-gpu-selected-ray-parity-${Date.now()}`,
        label: 'm4-flat-geometry-gpu-selected-ray-parity',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal:
            'Prove selected-ray flat geometry parity between FlatEarthGeometry and assembled local/flat GLSL.',
        payload: Object.freeze({
            jobType: 'local-flat-geometry-selected-ray-parity',
            sceneId: `m4-flat-geometry-selected-ray-parity-${scene.id}`,
            viewportPixels: Object.freeze([width, height]),
            selectedPixels,
            cameraWorldPositionMeters: observerPositionMeters,
            distantSunDirection: Object.freeze([0, 0, 1]),
            inverseProjectionMatrix: identityMatrix4(),
            inverseViewMatrix: identityMatrix4(),
            sceneDepthMaxMeters,
            sceneTerminationMeters: 0,
            endpointRadianceScale: 1,
            sceneDepthTexture: sceneTextures.sceneDepthTexture,
            sceneHitTexture: sceneTextures.sceneHitTexture,
            incidentRadianceTexture: shaderPayload.texture,
            expectedReadbackToleranceBytes: 2,
            diagnosticRuns: diagnosticRuns.map((run) => Object.freeze({
                runId: run.runId,
                diagnosticMode: run.mode,
                descriptorFingerprint: run.descriptor.fingerprint,
                sourceHash: run.assembly.sourceHash,
                fragmentShaderSource: run.assembly.fragmentShaderSource,
                selectedPixels: run.selectedPixels,
                expectedReadbacks: run.expectedReadbacks,
            })),
        }),
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

function summarizeDiagnosticRun(run) {
    return Object.freeze({
        runId: run.runId,
        mode: run.mode,
        descriptorFingerprint: run.descriptor.fingerprint,
        sourceHash: run.assembly.sourceHash,
        contributionIds: run.contributions.map((contribution) => contribution.id),
        expectedReadbacks: run.expectedReadbacks,
    });
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

function rgbaWithinTolerance(actual, expected, toleranceBytes) {
    return Array.isArray(actual)
        && Array.isArray(expected)
        && actual.length === 4
        && expected.length === 4
        && actual.every((value, index) =>
            Math.abs(value - expected[index]) <= toleranceBytes);
}

function encodeDepthUnit(value) {
    const integer = Math.max(0, Math.min(16777214, Math.round(Math.max(0, Math.min(1, value)) * 16777214)));

    return Object.freeze([
        (integer >> 16) & 255,
        (integer >> 8) & 255,
        integer & 255,
        255,
    ]);
}

function decodeDepthUnit(bytes) {
    return ((bytes[0] * 65536) + (bytes[1] * 256) + bytes[2]) / 16777214;
}

function identityMatrix4() {
    return Object.freeze([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ]);
}

function addScaled(origin, direction, distance) {
    return Object.freeze([
        origin[0] + direction[0] * distance,
        origin[1] + direction[1] * distance,
        origin[2] + direction[2] * distance,
    ]);
}

function add3(left, right) {
    return Object.freeze([
        left[0] + right[0],
        left[1] + right[1],
        left[2] + right[2],
    ]);
}

function scale3(value, scale) {
    return Object.freeze([
        value[0] * scale,
        value[1] * scale,
        value[2] * scale,
    ]);
}

function normalize3(value) {
    const length = Math.max(Math.hypot(value[0], value[1], value[2]), 1e-12);

    return Object.freeze([
        value[0] / length,
        value[1] / length,
        value[2] / length,
    ]);
}

function byteFromUnit(value) {
    return Math.max(0, Math.min(255, Math.round(Math.max(0, Math.min(1, value)) * 255)));
}

function criterion(name, accepted) {
    return Object.freeze({
        name,
        status: accepted ? 'accepted' : 'rejected',
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
