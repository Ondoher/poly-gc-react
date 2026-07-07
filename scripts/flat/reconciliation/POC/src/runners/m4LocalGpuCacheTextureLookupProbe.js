// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.2 local GPU cache texture and shader lookup.
// - tmp/atmosphere/reconciliation/534-m4-local-cache-texture-prep.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    Algorithm32ShaderAssembler,
    CANONICAL_SPECTRAL_BASIS,
    LocalFlatShaderContributionFactory,
    LocalFlatShaderDescriptorBuilder,
    M2_LOCAL_FLAT_SEED_CONSTANTS,
    buildIncidentRadianceCache,
} from '../index.js';
import { createM2LocalFlatModels, makeM2SeedSummary } from './createM2Models.js';
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
const failures = [];

await appendRunLog(recordDirectory, 'm4LocalGpuCacheTextureLookupProbe started.');

let cacheBuildResult = null;
let shaderPayload = null;
let diagnosticSample = null;
let descriptor = null;
let contributions = [];
let assembly = null;
let repeatedAssembly = null;
let command = null;
let latest = null;
let progress = null;
let selectedPixels = null;
let browserDiagnostics = null;

try {
    const models = createM2LocalFlatModels(scene);
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
    diagnosticSample = findCacheDiagnosticSample(shaderPayload.texture);
    descriptor = new LocalFlatShaderDescriptorBuilder().build({
        variantId: 'algorithm32-local-flat-cache-texture-lookup-smoke',
        localFlat: localFlatDescriptorFacts(),
        cachePayload: shaderPayload,
        transportOptimization: Object.freeze({
            pathSampleDistribution: Object.freeze({ kind: 'uniform-distance' }),
        }),
        diagnosticCacheLookup: Object.freeze({
            enabled: true,
            zBinIndex: diagnosticSample.zBinIndex,
            rhoBinIndex: diagnosticSample.rhoBinIndex,
            directionIndex: diagnosticSample.directionIndex,
            redChannelIndex: diagnosticSample.redChannelIndex,
            greenChannelIndex: diagnosticSample.greenChannelIndex,
            blueChannelIndex: diagnosticSample.blueChannelIndex,
            outputScale: diagnosticSample.outputScale,
        }),
    });
    const factory = new LocalFlatShaderContributionFactory();
    contributions = factory.createContributions(descriptor);
    const assembler = new Algorithm32ShaderAssembler();
    assembly = assembler.assemble({
        descriptor,
        contributions,
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    repeatedAssembly = assembler.assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    command = makeCommand();
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
    selectedPixels = latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
    browserDiagnostics = latest?.artifact?.paths?.browserDiagnosticsPath
        ? await readJsonIfExists(latest.artifact.paths.browserDiagnosticsPath)
        : null;
} catch (error) {
    failures.push(failure('m4-local-gpu-cache-lookup-crash', error.message, { stack: error.stack }));
}

const shaderDiagnostics = latest?.result?.diagnostics?.shader ?? null;
const browserBindingDiagnostics = latest?.result?.diagnostics?.bindings ?? null;
const browserSelectedPixels = selectedPixels?.selectedPixels ?? [];
const criteria = Object.freeze([
    criterion('local-cache-builds-all-coordinates',
        cacheBuildResult?.coordinateCount
            === seed.localCacheZBinsMeters.length * seed.localCacheRhoBinsMeters.length * seed.localCacheDirectionCount
        && cacheBuildResult?.cache.valueCount === cacheBuildResult?.coordinateCount),
    criterion('local-flat-descriptor-created',
        descriptor?.compatibilityTags?.includes('local-light-source') === true
        && descriptor?.compatibilityTags?.includes('flat-geometry') === true
        && descriptor?.cache?.facts?.cacheKind === 'local'),
    criterion('local-cache-contribution-owns-texture-binding',
        contributions.some((contribution) =>
            contribution.owner === 'cache'
            && contribution.bindingRequirements.some((binding) =>
                binding.id === 'cache.localIncidentRadianceTexture'
                && binding.valueKey === 'cache.localIncidentRadianceTexture')
            && contribution.functions.some((block) =>
                block.code.includes('readLocalIncidentRadianceTexture')
                && block.code.includes('zSpectralGroupDepthIndex')))),
    criterion('assembly-created',
        assembly?.status === 'accepted'
        && assembly?.validationReport?.status === 'accepted'
        && typeof assembly.fragmentShaderSource === 'string'),
    criterion('source-build-deterministic',
        assembly?.sourceHash === repeatedAssembly?.sourceHash),
    criterion('fragment-source-uses-local-cache-lookup',
        assembly?.fragmentShaderSource?.includes('LOCAL_CACHE_LOOKUP_DIAGNOSTIC_ENABLED = true') === true
        && assembly.fragmentShaderSource.includes('texelFetch(sourceTexture, ivec3(clampedDirectionIndex, clampedRhoBinIndex, depthIndex), 0)')
        && assembly.fragmentShaderSource.includes('nearestLocalCacheZBinIndex(vec3 positionMeters)')
        && assembly.fragmentShaderSource.includes('nearestLocalCacheRhoBinIndex(vec3 positionMeters)')),
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('browser-shader-compile-link-accepted', shaderDiagnostics?.status === 'accepted'),
    criterion('browser-bound-local-cache-texture',
        browserBindingDiagnostics?.kind === 'local-cache-texture-lookup-bindings'
        && browserBindingDiagnostics?.incidentRadianceTexture?.width === shaderPayload?.texture.width
        && browserBindingDiagnostics?.incidentRadianceTexture?.height === shaderPayload?.texture.height
        && browserBindingDiagnostics?.incidentRadianceTexture?.depth === shaderPayload?.texture.depth
        && browserBindingDiagnostics?.incidentRadianceTexture?.uploadValueCount === shaderPayload?.texture.rgbaFloat32.length),
    criterion('selected-pixel-readback-matches-packed-cache-texel',
        browserSelectedPixels.length === 3
        && browserSelectedPixels.every((pixel) =>
            rgbaWithinTolerance(pixel.readbackRgba, diagnosticSample?.expectedReadbackRgba, 2))),
    criterion('selected-pixel-visible-output-present',
        browserSelectedPixels.some((pixel) => pixel.readbackRgba.slice(0, 3).some((channel) => channel > 0))),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Local GPU cache texture lookup criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Finish Milestone 4.2 without advancing into Milestone 4.3: build the local
flat shader descriptor/contributions, upload the real local L2 cache as a
browser WebGL2 3D texture, bind it to the local cache sampler, and prove GLSL
lookup reads the packed z/rho/direction/spectral-group layout.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '4.2-local-gpu-cache-texture-and-lookup',
    runner: 'm4LocalGpuCacheTextureLookupProbe',
    sceneSetId: seed.currentReviewSceneSetId,
    sceneId: scene.id,
    seed: makeM2SeedSummary(),
    artifactRunDirectory,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-42-local-gpu-cache-texture-and-shader-lookup',
        'tmp/atmosphere/reconciliation/534-m4-local-cache-texture-prep',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderDescriptorBuilder.js',
        'scripts/flat/reconciliation/POC/src/shader/LocalFlatShaderContributionFactory.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
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
    bindingRequirements: assembly?.bindingRequirements ?? [],
    cache: cacheBuildResult
        ? Object.freeze({
            descriptor: cacheBuildResult.cache.descriptor,
            coordinateCount: cacheBuildResult.coordinateCount,
            valueCount: cacheBuildResult.cache.valueCount,
        })
        : null,
    shaderPayload: summarizeShaderPayload(shaderPayload),
    diagnosticSample,
    command,
    progress,
    latestSummary: summarizeLatest(latest),
    browserDiagnostics,
    selectedPixels,
    shaderDiagnostics: summarizeShader(shaderDiagnostics),
});
await writeText(recordDirectory, 'fragment-shader.glsl', assembly?.fragmentShaderSource ?? '');
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([
        Object.freeze({
            command: `node scripts/flat/reconciliation/POC/src/runners/m4LocalGpuCacheTextureLookupProbe.js --record ${recordDirectory}`,
            timestamp: nowIso(),
        }),
    ]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    stage: '4.2-local-gpu-cache-texture-and-lookup',
    recordDirectory,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    textureId: shaderPayload?.texture.textureId ?? null,
    textureDimensions: shaderPayload?.texture
        ? Object.freeze([shaderPayload.texture.width, shaderPayload.texture.height, shaderPayload.texture.depth])
        : null,
    uploadValueCount: shaderPayload?.texture.rgbaFloat32.length ?? null,
    expectedReadbackRgba: diagnosticSample?.expectedReadbackRgba ?? null,
    failureCount: failures.length,
    stoppedBefore: '4.3-local-flat-gpu-parity-evidence-recreation',
});
await writeText(recordDirectory, 'report.md', `# Report

M4.2 local GPU cache texture and shader lookup probe finished with status:
${status}.

- Scene seed: \`${scene.id}\`.
- Source hash: \`${assembly?.sourceHash ?? 'not-built'}\`.
- Texture: \`${shaderPayload?.texture.textureId ?? 'n/a'}\`,
  dimensions \`${shaderPayload?.texture
        ? [shaderPayload.texture.width, shaderPayload.texture.height, shaderPayload.texture.depth].join(' x ')
        : 'n/a'}\`,
  upload floats \`${shaderPayload?.texture.rgbaFloat32.length ?? 'n/a'}\`.
- Diagnostic sample z/rho/direction:
  \`${diagnosticSample
        ? `${diagnosticSample.zBinIndex}/${diagnosticSample.rhoBinIndex}/${diagnosticSample.directionIndex}`
        : 'n/a'}\`.
- Expected readback: \`${JSON.stringify(diagnosticSample?.expectedReadbackRgba ?? null)}\`.
- Browser artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`.

This intentionally stops before M4.3. It proves browser texture
materialization/binding and local-source GLSL lookup, not full local/flat
selected-pixel parity recreation.
`);
await appendRunLog(recordDirectory, `m4LocalGpuCacheTextureLookupProbe ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    textureId: shaderPayload?.texture.textureId ?? null,
    uploadValueCount: shaderPayload?.texture.rgbaFloat32.length ?? null,
    expectedReadbackRgba: diagnosticSample?.expectedReadbackRgba ?? null,
    failureCount: failures.length,
}));

function localFlatDescriptorFacts() {
    return Object.freeze({
        sourceKey: scene.id,
        observerPositionMeters: seed.observerPositionMeters,
        sourcePositionMeters: scene.sourcePositionMeters,
        topAltitudeMeters: seed.topAltitudeMeters,
        sceneSkyRayLimitMeters: seed.sceneSkyRayLimitMeters,
        observerCenteredDome: seed.observerCenteredDome,
        referenceDistanceMeters: seed.referenceDistanceMeters,
        referenceSpectralIncidentScale:
            scene.referenceSpectralIncidentScale ?? seed.referenceSpectralIncidentScale,
        radiusMeters: seed.sourceRadiusMeters,
        distanceFalloff: seed.distanceFalloff,
    });
}

function makeCommand() {
    return Object.freeze({
        id: `local-cache-texture-lookup-${Date.now()}`,
        label: 'm4-local-cache-texture-lookup',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal:
            'Compile the local/flat shader and prove browser WebGL2 lookup from the real local L2 cache texture.',
        payload: Object.freeze({
            jobType: 'local-cache-texture-lookup-smoke',
            sceneId: `local-cache-texture-lookup-${scene.id}`,
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
            viewportPixels: Object.freeze([16, 16]),
            selectedPixels: Object.freeze([
                Object.freeze({ pixelId: 'center', x: 8, y: 8 }),
                Object.freeze({ pixelId: 'lower-left', x: 2, y: 2 }),
                Object.freeze({ pixelId: 'upper-right', x: 13, y: 13 }),
            ]),
            cameraWorldPositionMeters: seed.observerPositionMeters,
            distantSunDirection: Object.freeze([0, 0, 1]),
            inverseProjectionMatrix: identityMatrix4(),
            inverseViewMatrix: identityMatrix4(),
            sceneDepthMaxMeters: 1,
            sceneTerminationMeters: 0,
            endpointRadianceScale: 1,
            incidentRadianceTexture: shaderPayload.texture,
            expectedTexture: Object.freeze({
                textureId: shaderPayload.texture.textureId,
                width: shaderPayload.texture.width,
                height: shaderPayload.texture.height,
                depth: shaderPayload.texture.depth,
                uploadValueCount: shaderPayload.texture.rgbaFloat32.length,
            }),
            expectedReadbackRgba: diagnosticSample.expectedReadbackRgba,
            expectedReadbackToleranceBytes: 2,
        }),
    });
}

function findCacheDiagnosticSample(texture) {
    const channels = Object.freeze({
        redChannelIndex: 10,
        greenChannelIndex: 6,
        blueChannelIndex: 2,
    });
    let best = null;

    for (let zBinIndex = 0; zBinIndex < texture.depth / texture.spectralGroupCount; zBinIndex += 1) {
        for (let rhoBinIndex = 0; rhoBinIndex < texture.height; rhoBinIndex += 1) {
            for (let directionIndex = 0; directionIndex < texture.width; directionIndex += 1) {
                const values = diagnosticChannelValues(texture, {
                    zBinIndex,
                    rhoBinIndex,
                    directionIndex,
                    ...channels,
                });
                const score = values.reduce((sum, value) => sum + Math.max(0, value), 0);

                if (!best || score > best.score) {
                    best = {
                        zBinIndex,
                        rhoBinIndex,
                        directionIndex,
                        values,
                        score,
                    };
                }
            }
        }
    }

    if (!best || best.score <= 0) {
        throw new Error('Local cache texture contains no positive diagnostic sample.');
    }

    const maxComponent = Math.max(...best.values);
    const outputScale = maxComponent > 0 ? 0.8 / maxComponent : 1;
    const expectedReadbackRgba = Object.freeze([
        ...best.values.map((value) => byteFromUnit(value * outputScale)),
        255,
    ]);

    return Object.freeze({
        zBinIndex: best.zBinIndex,
        rhoBinIndex: best.rhoBinIndex,
        directionIndex: best.directionIndex,
        ...channels,
        sourceValues: Object.freeze(best.values),
        outputScale,
        expectedReadbackRgba,
    });
}

function diagnosticChannelValues(texture, sample) {
    return Object.freeze([
        textureChannelValue(texture, sample.zBinIndex, sample.rhoBinIndex, sample.directionIndex, sample.redChannelIndex),
        textureChannelValue(texture, sample.zBinIndex, sample.rhoBinIndex, sample.directionIndex, sample.greenChannelIndex),
        textureChannelValue(texture, sample.zBinIndex, sample.rhoBinIndex, sample.directionIndex, sample.blueChannelIndex),
    ]);
}

function textureChannelValue(texture, zBinIndex, rhoBinIndex, directionIndex, channelIndex) {
    const spectralGroupIndex = Math.floor(channelIndex / texture.spectralGroupSize);
    const componentIndex = channelIndex % texture.spectralGroupSize;
    const depthIndex = zBinIndex * texture.spectralGroupCount + spectralGroupIndex;
    const offset = (((depthIndex * texture.height) + rhoBinIndex) * texture.width + directionIndex) * 4
        + componentIndex;

    return texture.rgbaFloat32[offset];
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

function summarizeShader(shader) {
    if (!shader) {
        return null;
    }

    return Object.freeze({
        status: shader.status,
        vertexStatus: shader.vertex?.status ?? null,
        fragmentStatus: shader.fragment?.status ?? null,
        vertexCompileLog: shader.vertex?.compileLog ?? null,
        fragmentCompileLog: shader.fragment?.compileLog ?? null,
        linkLog: shader.linkLog ?? null,
    });
}

function rgbaWithinTolerance(actual, expected, toleranceBytes) {
    return Array.isArray(actual)
        && Array.isArray(expected)
        && actual.length === 4
        && expected.length === 4
        && actual.every((value, index) =>
            Math.abs(value - expected[index]) <= toleranceBytes);
}

function identityMatrix4() {
    return Object.freeze([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
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
