// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, subjective Southern France review scenes.
// - tmp/atmosphere/reconciliation/100-m3-integrated-objective-scene, accepted real Three shader path.
// - scripts/flat/local-second-order/page/subjective-scenes.js, Southern France no-shadow scene lineage.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
    Algorithm32ShaderAssembler,
    buildIncidentRadianceCache,
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    CanonicalAtmosphere,
    DistantSphericalShaderContributionFactory,
    DistantSphericalShaderDescriptorBuilder,
    DistantSunLightSource,
    RUNTIME_NUMERICAL_CONTROLS,
    SpectralCalculator,
    SphericalEarthGeometry,
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
const WATCH_TIMEOUT_MS = 180000;
const POLL_MS = 750;
const recordDirectory = parseRecordDirectory(process.argv);
const artifactRunDirectory = resolve(recordDirectory);
const failures = [];

await appendRunLog(recordDirectory, 'm3SubjectiveSolarNoonRender started.');

let descriptor = null;
let assembly = null;
let command = null;
let latest = null;
let selectedPixels = null;

try {
    descriptor = new DistantSphericalShaderDescriptorBuilder().build({
        variantId: 'algorithm32-distant-spherical-subjective-southern-france',
    });
    const factory = new DistantSphericalShaderContributionFactory();
    assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    command = makeCommand({ descriptor, assembly });
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    selectedPixels = latest?.artifact?.paths?.selectedPixelsPath
        ? await readJsonIfExists(latest.artifact.paths.selectedPixelsPath)
        : null;
} catch (error) {
    failures.push(failure('subjective-solar-noon-crash', error.message, { stack: error.stack }));
}

const shaderDiagnostics = latest?.result?.diagnostics?.shader ?? null;
const sceneDiagnostics = latest?.result?.diagnostics?.scene?.browserThreeScene ?? null;
const gpuPixels = selectedPixels?.selectedPixels ?? [];
const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('assembled-shader-compile-link-accepted', shaderDiagnostics?.status === 'accepted'),
    criterion('subjective-scene-captured', sceneDiagnostics?.kind === 'browser-three-southern-france-solar-noon-capture'),
    criterion('subjective-scene-hit-texture-populated', sceneDiagnostics?.hitPixelCount > 0),
    criterion('selected-pixel-readback-recorded', gpuPixels.length === 3),
    criterion('selected-pixel-visible-output-recorded',
        gpuPixels.some((pixel) => pixel.readbackRgba?.slice(0, 3).some((channel) => channel > 0))),
    criterion('selected-pixels-distinguish-scene-cases',
        new Set(gpuPixels.map((pixel) => JSON.stringify(pixel.readbackRgba))).size > 1),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Subjective solar-noon render criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render one subjective Southern France no-shadow scene through the reconciled
assembled distant/spherical shader path at solar noon today.

Today is interpreted as 2026-07-04. This first subjective pass uses an
approximate Southern France review fixture location of latitude 44N, longitude
6E, and solar noon on the local meridian.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-subjective-southern-france-solar-noon',
    runner: 'm3SubjectiveSolarNoonRender',
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    artifactRunDirectory,
    timeoutMs: WATCH_TIMEOUT_MS,
    scene: command?.payload
        ? {
            sceneId: command.payload.sceneId,
            sceneKind: command.payload.sceneKind,
            renderDate: command.payload.renderDate,
            latitudeDegrees: command.payload.latitudeDegrees,
            longitudeDegrees: command.payload.longitudeDegrees,
            viewportPixels: command.payload.viewportPixels,
            terrainBackend: command.payload.terrainBackend,
        }
        : null,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/action-plan.md#gpu-validation-scene-set',
        'tmp/atmosphere/reconciliation/100-m3-integrated-objective-scene',
        'scripts/flat/local-second-order/page/subjective-scenes.js',
        'scripts/flat/local-second-order/page/assets/southern-france-blender-obj/Mountain Range in Southern France.obj',
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
    shaderDiagnostics: summarizeShader(shaderDiagnostics),
    sceneDiagnostics,
    selectedPixels: gpuPixels,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3SubjectiveSolarNoonRender.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    sceneId: command?.payload?.sceneId ?? null,
});
await writeText(recordDirectory, 'report.md', `# Report

Subjective Southern France solar-noon render finished with status: ${status}.

- Scene id: \`${command?.payload?.sceneId ?? 'not-built'}\`
- Scene kind: \`${command?.payload?.sceneKind ?? 'not-built'}\`
- Date: \`${command?.payload?.renderDate ?? 'not-built'}\`
- Approximate location: \`${command?.payload?.latitudeDegrees ?? 'n/a'}N, ${command?.payload?.longitudeDegrees ?? 'n/a'}E\`
- Artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Browser status: \`${latest?.status ?? 'not-completed'}\`
- Shader status: \`${shaderDiagnostics?.status ?? 'not-reported'}\`
- Selected pixels: ${gpuPixels.length}

This is subjective review evidence, not an objective numeric parity gate.
`);
await appendRunLog(recordDirectory, `m3SubjectiveSolarNoonRender ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
}));

function makeCommand({ descriptor, assembly }) {
    const distantSunDirection = Object.freeze([0.930596, 0, -0.366049]);
    const incidentRadianceCache = buildDistantIncidentRadianceCacheForShader(distantSunDirection);

    return Object.freeze({
        id: `subjective-southern-france-solar-noon-${Date.now()}`,
        label: 'm3-subjective-southern-france-solar-noon',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: 'Render one subjective Southern France no-shadow scene through the assembled Algorithm32 shader at solar noon today.',
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: 'southern-france-solar-noon-2026-07-04',
            sceneKind: 'southern-france-solar-noon',
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
            viewportPixels: Object.freeze([480, 270]),
            selectedPixels: Object.freeze([]),
            comparisonMode: 'subjective-single-render',
            terrainBackend: 'southern-france-obj-geometry',
            renderDate: '2026-07-04',
            latitudeDegrees: 44,
            longitudeDegrees: 6,
            cameraWorldPositionMeters: Object.freeze([6360002, 0, 0]),
            distantSunDirection,
            incidentRadianceTexture: incidentRadianceCache.shaderPayload.texture,
            incidentRadianceCache: Object.freeze({
                descriptor: incidentRadianceCache.shaderPayload.descriptor,
                coordinateCount: incidentRadianceCache.coordinateCount,
                shaderPayloadMetadata: incidentRadianceCache.shaderPayload.metadata,
                lookup: incidentRadianceCache.shaderPayload.lookup,
            }),
            sceneTerminationMeters: 0,
            sceneDepthMaxMeters: 150000,
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

function summarizeCommand(command) {
    return Object.freeze({
        id: command.id,
        label: command.label,
        jobType: command.payload.jobType,
        status: command.status,
        createdAt: command.createdAt,
        payload: {
            sceneId: command.payload.sceneId,
            sceneKind: command.payload.sceneKind,
            sourceHash: command.payload.sourceHash,
            viewportPixels: command.payload.viewportPixels,
            renderDate: command.payload.renderDate,
            latitudeDegrees: command.payload.latitudeDegrees,
            longitudeDegrees: command.payload.longitudeDegrees,
        },
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
