// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.5.1.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, objective scene rendered-pixel checks.
// - tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge.
// - tmp/atmosphere/reconciliation/064-m3-shader-assembly.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    Algorithm32ShaderAssembler,
    buildIncidentRadianceCache,
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    CanonicalAtmosphere,
    CpuPostprocessSoftShader,
    DistantSphericalShaderContributionFactory,
    DistantSphericalShaderDescriptorBuilder,
    DistantSunLightSource,
    RUNTIME_NUMERICAL_CONTROLS,
    SpectralCalculator,
    SphericalEarthGeometry,
    ThreeSceneSoftShaderBridge,
    createShaderLabReferenceScene,
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
const WATCH_TIMEOUT_MS = 120000;
const POLL_MS = 750;
const recordDirectory = parseRecordDirectory(process.argv);
const failures = [];

await appendRunLog(recordDirectory, 'm3IntegratedGpuObjectiveSceneComparison started.');

let descriptor = null;
let assembly = null;
let controlledScene = null;
let capture = null;
let cpuOutput = null;
let command = null;
let latest = null;
let selectedPixels = null;
let browserDiagnostics = null;

try {
    descriptor = new DistantSphericalShaderDescriptorBuilder().build();
    const factory = new DistantSphericalShaderContributionFactory();
    assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    controlledScene = createShaderLabReferenceScene();
    capture = captureControlledScene(controlledScene);
    cpuOutput = runCpuSoftShader(capture);
    command = makeCommand({
        descriptor,
        assembly,
        controlledScene,
    });
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
    failures.push(failure('integrated-gpu-objective-scene-crash', error.message, {
        stack: error.stack,
    }));
}

const shaderDiagnostics = latest?.result?.diagnostics?.shader ?? null;
const gpuPixels = selectedPixels?.selectedPixels ?? [];
const cpuPixels = cpuOutput?.pixels ?? [];
const selectedPixelComparison = compareSelectedPixels({
    cpuPixels,
    gpuPixels,
});
const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('assembled-shader-compile-link-accepted', shaderDiagnostics?.status === 'accepted'),
    criterion('gpu-selected-pixel-readback-recorded',
        Array.isArray(gpuPixels) && gpuPixels.length === 3),
    criterion('gpu-selected-pixel-visible-output-recorded',
        gpuPixels.some((pixel) => pixel.readbackRgba?.slice(0, 3).some((channel) => channel > 0))),
    criterion('gpu-selected-pixels-distinguish-scene-cases',
        new Set(gpuPixels.map((pixel) => JSON.stringify(pixel.readbackRgba))).size > 1),
    criterion('cpu-soft-shader-selected-output-recorded',
        Array.isArray(cpuPixels) && cpuPixels.length === controlledScene?.selectedPixels?.length),
    criterion('cpu-gpu-selected-pixel-ids-align',
        selectedPixelIds(cpuPixels).join('|') === selectedPixelIds(gpuPixels).join('|')),
    criterion('browser-three-scene-captured',
        latest?.result?.diagnostics?.scene?.browserThreeScene?.hitPixelCount > 0),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Integrated GPU objective scene criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Run the first real browser Three scene through the assembled distant/spherical
shader. This replaces the earlier synthetic fixture texture canvas with a
browser-rendered Three color target plus a matching Three raycaster hit-distance
texture.

This record checks that the browser job produces a scene-shaped PNG from the
installed shader path. CPU/GPU selected-pixel comparison remains diagnostic
until final objective numeric RGBA fixtures are materialized.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5.1-real-browser-three-scene',
    runner: 'm3IntegratedGpuObjectiveSceneComparison',
    sceneId: controlledScene?.sceneId ?? null,
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    timeoutMs: WATCH_TIMEOUT_MS,
    browserPayloadSummary: command
        ? summarizePayload(command.payload)
        : null,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#subgoal-35-integrated-gpu-distantspherical-parity',
        'agents/topics/apps/flat/reconciliation/shader-test-design.md',
        'tmp/atmosphere/reconciliation/058-m3-node-three-scene-bridge',
        'tmp/atmosphere/reconciliation/064-m3-shader-assembly',
        'tmp/atmosphere/reconciliation/074-assembled-distant-spherical-smoke',
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
    command: command ? summarizeCommand(command) : null,
    latestSummary: summarizeLatest(latest),
    browserDiagnostics,
    shaderDiagnostics: summarizeShader(shaderDiagnostics),
    cpuCaptureSummary: capture?.summary ?? null,
    cpuSelectedPixels: summarizeCpuPixels(cpuPixels),
    gpuSelectedPixels: gpuPixels,
    comparison: selectedPixelComparison,
    implementationGaps: Object.freeze([
        'Final objective-scene numeric RGBA gates still need external fixture or external-source-backed materialization before this becomes a final M3 parity gate.',
    ]),
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3IntegratedGpuObjectiveSceneComparison.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    sceneId: controlledScene?.sceneId ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Real browser Three scene shader comparison finished with status:
${status}.

- Scene id: \`${controlledScene?.sceneId ?? 'not-built'}\`
- Source hash: \`${assembly?.sourceHash ?? 'not-built'}\`
- Watcher run: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Browser status: \`${latest?.status ?? 'not-completed'}\`
- Shader status: \`${shaderDiagnostics?.status ?? 'not-reported'}\`
- CPU selected pixels: ${cpuPixels.length}
- GPU selected pixels: ${gpuPixels.length}

This record checks real Three scene capture and installed shader rendering.
It is not the final objective-scene numeric RGBA gate because those values
still need external fixture or external-source-backed materialization.
`);
await appendRunLog(recordDirectory, `m3IntegratedGpuObjectiveSceneComparison ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
}));

function captureControlledScene(controlledScene) {
    const bridge = new ThreeSceneSoftShaderBridge({
        sceneId: controlledScene.sceneId,
        camera: controlledScene.camera,
        meshes: controlledScene.meshes,
        viewportPixels: controlledScene.viewportPixels,
        defaultPathIntervalCount: 4,
    });

    return bridge.captureSceneInput({
        selectedPixels: controlledScene.selectedPixels,
        sourceDescriptorId: 'node-three-reference-fixture-source',
        geometryDescriptorId: 'node-three-reference-fixture-geometry',
        atmosphereDescriptorId: 'node-three-reference-fixture-atmosphere',
        lightSourceDescriptorId: 'node-three-reference-fixture-light-source',
        displayDescriptorId: 'bruneton-color-display',
        metadata: controlledScene.metadata,
    });
}

function runCpuSoftShader(capture) {
    const softShader = new CpuPostprocessSoftShader({
        evaluator: Object.freeze({
            evaluate(request) {
                const endDistanceMeters = request.viewRayRequest?.endDistanceMeters ?? 1000;
                const hit = Number.isFinite(request.viewRayRequest?.endDistanceMeters);
                return Object.freeze({
                    outputKind: 'spectral',
                    viewRaySegment: Object.freeze({
                        ray: request.viewRayRequest.ray,
                        startDistanceMeters: 0,
                        endDistanceMeters,
                    }),
                    pathIntegrationPoints: Object.freeze([]),
                    pathRadiance: Object.freeze({
                        inScattered: spectralConstant(hit ? 0.0001 : 0.0004),
                        transmittance: spectralConstant(hit ? 0.75 : 1),
                    }),
                    diagnostics: Object.freeze([]),
                });
            },
        }),
        endpointRadianceResolver(endpointContribution) {
            return endpointContribution.spectralReferenceId === 'fixture-ground-matte'
                ? spectralConstant(0.0015)
                : spectralConstant(0.0025);
        },
    });

    return softShader.render({
        sceneInput: capture.sceneInput,
        pixels: capture.pixels,
    });
}

function makeCommand({ descriptor, assembly, controlledScene }) {
    const distantSunDirection = Object.freeze([0, 0, 1]);
    const incidentRadianceCache = buildDistantIncidentRadianceCacheForShader(distantSunDirection);

    return Object.freeze({
        id: `assembled-objective-scene-${Date.now()}`,
        label: 'm3-integrated-objective-scene',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal:
            'Run the assembled Algorithm32 distant/spherical shader against the first integrated objective scene camera/selection payload.',
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: controlledScene.sceneId,
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
            viewportPixels: Object.freeze([320, 180]),
            selectedPixels: Object.freeze([]),
            comparisonMode: 'browser-three-scene-shader-output',
            cameraWorldPositionMeters: Object.freeze([6360002, 0, 0]),
            inverseProjectionMatrix: Object.freeze([...controlledScene.camera.projectionMatrixInverse.elements]),
            inverseViewMatrix: Object.freeze([...controlledScene.camera.matrixWorld.elements]),
            distantSunDirection,
            incidentRadianceTexture: incidentRadianceCache.shaderPayload.texture,
            incidentRadianceCache: Object.freeze({
                descriptor: incidentRadianceCache.cache.descriptor,
                coordinateCount: incidentRadianceCache.coordinateCount,
                shaderPayloadMetadata: incidentRadianceCache.shaderPayload.metadata,
                lookup: incidentRadianceCache.shaderPayload.lookup,
            }),
            sceneTerminationMeters: 0,
            sceneDepthMaxMeters: 20,
            endpointRadianceScale: 1500,
        }),
    });
}

function buildDistantIncidentRadianceCacheForShader(directionToLight) {
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: 2,
        observerUpDirection: [1, 0, 0],
        sourceDirection: directionToLight,
        cacheAltitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
        cacheBoundaryAltitudeMeters: 2,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new DistantSunLightSource({
        directionToLight,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        cacheAltitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
        cacheDirectionCount: RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: RUNTIME_NUMERICAL_CONTROLS,
    });
    const buildResult = buildIncidentRadianceCache({
        cache: lightSource.createIncidentRadianceCache({
            bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
            topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
            spectralBasis: CANONICAL_SPECTRAL_BASIS,
            boundaryAltitudeMeters: geometry.configuration.cacheBoundaryAltitudeMeters,
        }),
        geometry,
        atmosphere,
        lightSource,
        calculator,
        pathIntervalCount: RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });

    return Object.freeze({
        cache: buildResult.cache,
        coordinateCount: buildResult.coordinateCount,
        shaderPayload: buildResult.cache.createShaderPayload(),
    });
}

function makeSceneColorTexture({ controlledScene, capture }) {
    const [width, height] = controlledScene.viewportPixels;
    const rgbaBytes = new Array(width * height * 4).fill(0);
    for (let index = 0; index < width * height; index += 1) {
        rgbaBytes[index * 4 + 3] = 255;
    }

    for (const pixel of capture.pixels) {
        const coordinate = toWebGlCoordinate({
            x: pixel.coordinate.x,
            y: pixel.coordinate.y,
            height,
        });
        paintFixtureBand({
            rgbaBytes,
            width,
            height,
            centerY: coordinate.y,
            color: endpointColorForPixel(pixel),
        });
    }

    return Object.freeze({
        width,
        height,
        rgbaBytes: Object.freeze(rgbaBytes),
        coordinateConvention: 'webgl-bottom-left',
        purpose: 'selected endpoint radiance fixture colors',
    });
}

function makeSceneDepthTexture({ controlledScene, capture, sceneDepthMaxMeters }) {
    const [width, height] = controlledScene.viewportPixels;
    const rgbaBytes = new Array(width * height * 4).fill(255);

    for (const pixel of capture.pixels) {
        const coordinate = toWebGlCoordinate({
            x: pixel.coordinate.x,
            y: pixel.coordinate.y,
            height,
        });
        const distanceMeters = pixel.sceneIntersection?.distanceMeters;
        const encoded = Number.isFinite(distanceMeters)
            ? Math.max(0, Math.min(254, Math.round((distanceMeters / sceneDepthMaxMeters) * 255)))
            : 255;
        paintFixtureBand({
            rgbaBytes,
            width,
            height,
            centerY: coordinate.y,
            color: Object.freeze([encoded, encoded, encoded]),
        });
    }

    return Object.freeze({
        width,
        height,
        rgbaBytes: Object.freeze(rgbaBytes),
        coordinateConvention: 'webgl-bottom-left',
        encoding: 'red-channel-normalized-distance-times-sceneDepthMaxMeters; 255 means no-hit',
        sceneDepthMaxMeters,
    });
}

function toWebGlCoordinate({ x, y, height }) {
    return Object.freeze({
        x,
        y: height - 1 - y,
    });
}

function endpointColorForPixel(pixel) {
    if (pixel.pixelId.includes('ground')) {
        return Object.freeze([180, 135, 100]);
    }
    if (pixel.pixelId.includes('card')) {
        return Object.freeze([255, 220, 180]);
    }
    return Object.freeze([0, 0, 0]);
}

function paintFixtureBand({ rgbaBytes, width, height, centerY, color }) {
    const startY = Math.max(0, centerY - 1);
    const endY = Math.min(height - 1, centerY + 1);
    for (let y = startY; y <= endY; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const offset = (y * width + x) * 4;
            rgbaBytes[offset] = color[0];
            rgbaBytes[offset + 1] = color[1];
            rgbaBytes[offset + 2] = color[2];
            rgbaBytes[offset + 3] = 255;
        }
    }
}

function convertSelectedPixelsForWebGl(controlledScene) {
    const height = controlledScene.viewportPixels[1];
    return Object.freeze(controlledScene.selectedPixels.map((pixel) => Object.freeze({
        pixelId: pixel.pixelId,
        x: pixel.x,
        y: height - 1 - pixel.y,
        sourceCoordinateConvention: 'top-left',
        readbackCoordinateConvention: 'webgl-bottom-left',
    })));
}

async function waitForWatcherResult(commandId) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < WATCH_TIMEOUT_MS) {
        const candidate = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'latest.json'));
        if (candidate?.command?.id === commandId) {
            return candidate;
        }

        await appendRunLog(recordDirectory, `waiting for watcher result command=${commandId}.`);
        await delay(POLL_MS);
    }

    throw new Error(`Timed out waiting ${WATCH_TIMEOUT_MS} ms for watcher command ${commandId}.`);
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

function summarizePayload(payload) {
    return Object.freeze({
        sceneId: payload.sceneId,
        descriptorFingerprint: payload.descriptorFingerprint,
        sourceHash: payload.sourceHash,
        viewportPixels: payload.viewportPixels,
        selectedPixels: payload.selectedPixels,
        comparisonMode: payload.comparisonMode,
        sceneTerminationMeters: payload.sceneTerminationMeters,
    });
}

function summarizeCommand(command) {
    return Object.freeze({
        id: command.id,
        label: command.label,
        jobType: command.payload.jobType,
        status: command.status,
        createdAt: command.createdAt,
        payload: summarizePayload(command.payload),
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

function summarizeCpuPixels(pixels) {
    return Object.freeze(pixels.map((pixel) => Object.freeze({
        pixelId: pixel.pixelId,
        coordinate: pixel.coordinate,
        sceneIntersectionKind: pixel.sceneIntersectionKind,
        endpointPolicy: pixel.endpointPolicy,
        displayRgba: pixel.displayRgba,
        finalSpectralMean: spectralMean(pixel.finalSpectralRadiance),
        transmittanceMean: spectralMean(pixel.evaluationOutput.pathRadiance.transmittance),
    })));
}

function compareSelectedPixels({ cpuPixels, gpuPixels }) {
    const gpuById = new Map(gpuPixels.map((pixel) => [pixel.pixelId, pixel]));
    return Object.freeze(cpuPixels.map((cpuPixel) => {
        const gpuPixel = gpuById.get(cpuPixel.pixelId);
        const cpuByteRgba = displayRgbaToByteRgba(cpuPixel.displayRgba);
        const gpuByteRgba = gpuPixel?.readbackRgba ?? null;
        const deltas = gpuByteRgba
            ? cpuByteRgba.map((value, index) => Math.abs(value - gpuByteRgba[index]))
            : Object.freeze([255, 255, 255, 255]);
        const maxAbsRgbaDelta = Math.max(...deltas);
        return Object.freeze({
            pixelId: cpuPixel.pixelId,
            cpuDisplayRgba: cpuPixel.displayRgba,
            cpuByteRgba,
            gpuReadbackRgba: gpuByteRgba,
            absRgbaDelta: Object.freeze(deltas),
            maxAbsRgbaDelta,
            comparisonStatus: gpuPixel && maxAbsRgbaDelta <= 3
                ? 'accepted-selected-pixel-tolerance'
                : 'rejected-selected-pixel-tolerance',
            notes: 'Selected-pixel POC tolerance only; final objective numeric RGBA gates still need external materialization.',
        });
    }));
}

function displayRgbaToByteRgba(displayRgba) {
    return Object.freeze(displayRgba.map((value) =>
        Math.max(0, Math.min(255, Math.round(value * 255)))));
}

function selectedPixelIds(pixels) {
    return pixels.map((pixel) => pixel.pixelId);
}

function spectralConstant(value) {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => value));
}

function spectralMean(value) {
    return value.reduce((sum, entry) => sum + entry, 0) / value.length;
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
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
