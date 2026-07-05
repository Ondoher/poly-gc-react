// References:
// - agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/README.md,
//   accepted Southern France diffuse no-shadow sunrise-to-sunset gallery lineage.
// - tmp/atmosphere/reconciliation/104-m3-subjective-southern-france-solar-noon,
//   corrected high-camera single render.

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
const WATCH_TIMEOUT_MS = 600000;
const POLL_MS = 1000;
const recordDirectory = parseRecordDirectory(process.argv);
const artifactRunDirectory = resolve(recordDirectory);
const omitTerrainMesh = process.argv.includes('--omit-terrain-mesh');
const floorKind = process.argv.includes('--ocean-floor') ? 'ocean' : 'terrain-domain';
const fiveMinutesBeforeSunset = process.argv.includes('--five-minutes-before-sunset');
const minutesBeforeSunset = minutesBeforeSunsetFromArgs(process.argv);
const cpuGpuSideBySide = process.argv.includes('--cpu-gpu-side-by-side');
const failures = [];

await appendRunLog(recordDirectory, 'm3SubjectiveSouthernFranceDaylightStack started.');

let descriptor = null;
let assembly = null;
let command = null;
let latest = null;
let selectedPixels = null;

try {
    descriptor = new DistantSphericalShaderDescriptorBuilder().build({
        variantId: 'algorithm32-distant-spherical-subjective-southern-france-daylight-stack',
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
    failures.push(failure('subjective-daylight-stack-crash', error.message, { stack: error.stack }));
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
    criterion('subjective-daylight-stack-captured',
        sceneDiagnostics?.kind === 'browser-three-southern-france-daylight-stack-capture'),
    criterion('subjective-daylight-row-count', sceneDiagnostics?.rowCount === (minutesBeforeSunset !== null ? 1 : 5)),
    criterion('diffuse-textures-loaded',
        sceneDiagnostics?.rows?.every((row) => row.terrain?.loadedDiffuseTextureCount === 28) === true),
    criterion('selected-pixel-readback-recorded', gpuPixels.length === (minutesBeforeSunset !== null ? 3 : 15)),
    criterion('selected-pixel-visible-output-recorded',
        gpuPixels.some((pixel) => pixel.readbackRgba?.slice(0, 3).some((channel) => channel > 0))),
    criterion('png-artifacts-written',
        browserArtifactSaved(latest, 'images/canvas-image.png') && browserArtifactSaved(latest, 'images/screenshot.png')),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Subjective daylight-stack render criterion did not get the expected result.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render the Southern France subjective scene as a five-row sunrise-to-sunset
stack through the assembled Algorithm32 distant/spherical browser shader.

The camera uses the accepted high Southern France profile, yawed toward the
computed sunset while preserving camera altitude and look-at elevation. Terrain
uses the diffuse TGA texture backend with shadows disabled.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-subjective-southern-france-daylight-stack',
    runner: 'm3SubjectiveSouthernFranceDaylightStack',
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
            rowViewportPixels: command.payload.rowViewportPixels,
            terrainBackend: command.payload.terrainBackend,
        }
        : null,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/plans/atmosphere-cleanroom-design/local-sun-second-order/README.md#current-subjective-request',
        'scripts/flat/local-second-order/page/subjective-scenes.js',
        'scripts/flat/local-second-order/page/assets/southern-france-blender-obj/',
        'tmp/atmosphere/reconciliation/104-m3-subjective-southern-france-solar-noon',
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
        command: `node scripts/flat/reconciliation/POC/src/runners/m3SubjectiveSouthernFranceDaylightStack.js --record ${recordDirectory}`,
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

Subjective Southern France daylight stack finished with status: ${status}.

- Scene id: \`${command?.payload?.sceneId ?? 'not-built'}\`
- Date: \`${command?.payload?.renderDate ?? 'not-built'}\`
- Approximate location: \`${command?.payload?.latitudeDegrees ?? 'n/a'}N, ${command?.payload?.longitudeDegrees ?? 'n/a'}E\`
- Artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Browser status: \`${latest?.status ?? 'not-completed'}\`
- Shader status: \`${shaderDiagnostics?.status ?? 'not-reported'}\`
- Selected pixels: ${gpuPixels.length}

This is subjective review evidence, not an objective numeric parity gate.
`);
await appendRunLog(recordDirectory, `m3SubjectiveSouthernFranceDaylightStack ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
}));

function makeCommand({ descriptor, assembly }) {
    const basePayload = Object.freeze({
        daylightSampleMode: minutesBeforeSunset !== null ? 'minutes-before-sunset' : 'five-row-gallery',
        minutesBeforeSunset,
        renderDate: '2026-06-21',
        latitudeDegrees: 37.3382,
        longitudeDegrees: -121.8863,
        localSolarNoonMinutes: 789,
        timezoneOffsetMinutes: -420,
        equationOfTimeMinutes: -1.3282368002224763,
        solarDeclinationDegrees: 23.5,
    });
    const daylightSamples = southernFranceDaylightSamplesForPayload(basePayload);
    const incidentCacheEntries = daylightSamples.map((sample) =>
        [sample.id, buildDistantIncidentRadianceCacheForShader(sample.observerLocalDirection)]);
    const incidentRadianceTextureBySampleId = Object.freeze(Object.fromEntries(
        incidentCacheEntries.map(([sampleId, cache]) => [sampleId, cache.shaderPayload.texture]),
    ));
    const incidentRadianceCacheBySampleId = Object.freeze(Object.fromEntries(
        incidentCacheEntries.map(([sampleId, cache]) => [sampleId, Object.freeze({
            descriptor: cache.shaderPayload.descriptor,
            coordinateCount: cache.coordinateCount,
            shaderPayloadMetadata: cache.shaderPayload.metadata,
            lookup: cache.shaderPayload.lookup,
        })]),
    ));
    const defaultSunDirection = daylightSamples[Math.floor(daylightSamples.length / 2)]?.observerLocalDirection
        ?? [0.930596, 0, -0.366049];
    const defaultCache = incidentCacheEntries[Math.floor(incidentCacheEntries.length / 2)]?.[1]
        ?? buildDistantIncidentRadianceCacheForShader(defaultSunDirection);

    return Object.freeze({
        id: `subjective-southern-france-daylight-stack-${Date.now()}`,
        label: 'm3-subjective-southern-france-daylight-stack',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: 'Render the Southern France diffuse scene from sunrise to sunset as five stacked shader images.',
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: omitTerrainMesh
                ? 'southern-france-daylight-stack-2026-06-21-san-jose-no-mesh-ocean-floor'
                : 'southern-france-daylight-stack-2026-06-21-san-jose',
            sceneKind: 'southern-france-daylight-stack',
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
            viewportPixels: Object.freeze([960, 540]),
            rowViewportPixels: Object.freeze([960, 540]),
            renderScale: 2,
            selectedPixels: Object.freeze([]),
            comparisonMode: 'subjective-daylight-stack',
            daylightSampleMode: basePayload.daylightSampleMode,
            minutesBeforeSunset: basePayload.minutesBeforeSunset,
            cpuGpuSideBySide,
            terrainBackend: 'southern-france-obj-diffuse',
            omitTerrainMesh,
            floorKind,
            renderDate: basePayload.renderDate,
            latitudeDegrees: basePayload.latitudeDegrees,
            longitudeDegrees: basePayload.longitudeDegrees,
            localSolarNoonMinutes: basePayload.localSolarNoonMinutes,
            timezoneOffsetMinutes: basePayload.timezoneOffsetMinutes,
            equationOfTimeMinutes: basePayload.equationOfTimeMinutes,
            solarDeclinationDegrees: basePayload.solarDeclinationDegrees,
            cameraWorldPositionMeters: Object.freeze([6360002, 0, 0]),
            distantSunDirection: Object.freeze([...defaultSunDirection]),
            incidentRadianceTexture: defaultCache.shaderPayload.texture,
            incidentRadianceCache: Object.freeze({
                descriptor: defaultCache.shaderPayload.descriptor,
                coordinateCount: defaultCache.coordinateCount,
                shaderPayloadMetadata: defaultCache.shaderPayload.metadata,
                lookup: defaultCache.shaderPayload.lookup,
                defaultSampleId: daylightSamples[Math.floor(daylightSamples.length / 2)]?.id ?? null,
            }),
            incidentRadianceTextureBySampleId,
            incidentRadianceCacheBySampleId,
            sceneTerminationMeters: 0,
            sceneDepthMaxMeters: 150000,
            endpointRadianceScale: 5200,
            sceneDirectionalLightIntensity: 2.4,
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

function southernFranceDaylightSamplesForPayload(payload) {
    if (payload.daylightSampleMode !== 'minutes-before-sunset') {
        return southernFranceDaylightSamples(payload, 5);
    }
    const latitudeDegrees = payload.latitudeDegrees;
    const declinationDegrees = payload.solarDeclinationDegrees;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const declinationRadians = declinationDegrees * Math.PI / 180;
    const sunriseAltitudeRadians = -0.833 * Math.PI / 180;
    const cosHourAngle = (
        Math.sin(sunriseAltitudeRadians)
        - Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    ) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians));
    const sunsetHourAngleDegrees = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
    const sampleMinutesBeforeSunset = Math.max(0, payload.minutesBeforeSunset ?? 5);
    const hourAngleDegrees = sunsetHourAngleDegrees - sampleMinutesBeforeSunset / 4;
    const pose = sphericalSolarPose({
        latitudeDegrees,
        declinationDegrees,
        hourAngleDegrees,
    });

    return [Object.freeze({
        id: `01-${sampleMinutesBeforeSunset}min-before-sunset`,
        observerLocalDirection: Object.freeze(pose.observerLocalDirection),
    })];
}

function southernFranceDaylightSamples(payload, sampleCount) {
    const latitudeDegrees = payload.latitudeDegrees;
    const declinationDegrees = payload.solarDeclinationDegrees;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const declinationRadians = declinationDegrees * Math.PI / 180;
    const sunriseAltitudeRadians = -0.833 * Math.PI / 180;
    const cosHourAngle = (
        Math.sin(sunriseAltitudeRadians)
        - Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    ) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians));
    const hourAngleLimitDegrees = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
    const count = Math.max(2, sampleCount);
    const samples = [];
    for (let index = 0; index < count; index += 1) {
        const t = count === 1 ? 0.5 : index / (count - 1);
        const hourAngleDegrees = -hourAngleLimitDegrees + hourAngleLimitDegrees * 2 * t;
        const pose = sphericalSolarPose({
            latitudeDegrees,
            declinationDegrees,
            hourAngleDegrees,
        });
        const event = index === 0
            ? 'sunrise'
            : index === count - 1
                ? 'sunset'
                : Math.abs(hourAngleDegrees) < 1e-9
                    ? 'solar-noon'
                    : hourAngleDegrees < 0
                        ? 'morning'
                        : 'afternoon';
        samples.push(Object.freeze({
            id: `${String(index + 1).padStart(2, '0')}-${event}`,
            observerLocalDirection: Object.freeze(pose.observerLocalDirection),
        }));
    }

    return Object.freeze(samples);
}

function sphericalSolarPose({ latitudeDegrees, declinationDegrees, hourAngleDegrees }) {
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const declinationRadians = declinationDegrees * Math.PI / 180;
    const hourAngleRadians = hourAngleDegrees * Math.PI / 180;
    const sinAltitude = Math.sin(latitudeRadians) * Math.sin(declinationRadians)
        + Math.cos(latitudeRadians) * Math.cos(declinationRadians) * Math.cos(hourAngleRadians);
    const altitudeRadians = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
    const azimuthDegrees = normalizeDegrees(
        Math.atan2(
            Math.sin(hourAngleRadians),
            Math.cos(hourAngleRadians) * Math.sin(latitudeRadians)
                - Math.tan(declinationRadians) * Math.cos(latitudeRadians),
        ) * 180 / Math.PI + 180,
    );
    const azimuthRadians = azimuthDegrees * Math.PI / 180;
    const horizontal = Math.cos(altitudeRadians);
    return {
        observerLocalDirection: [
            Math.sin(altitudeRadians),
            horizontal * Math.sin(azimuthRadians),
            horizontal * Math.cos(azimuthRadians),
        ],
    };
}

function normalizeDegrees(value) {
    return ((value % 360) + 360) % 360;
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
            rowViewportPixels: command.payload.rowViewportPixels,
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

function minutesBeforeSunsetFromArgs(args) {
    const explicitIndex = args.indexOf('--minutes-before-sunset');
    if (explicitIndex >= 0) {
        const value = Number(args[explicitIndex + 1]);
        if (Number.isFinite(value) && value >= 0) {
            return value;
        }
        return 5;
    }
    if (fiveMinutesBeforeSunset) {
        return 5;
    }
    return null;
}
