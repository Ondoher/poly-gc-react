// References:
// - scripts/flat/reconciliation/POC/src/shader/shaderQualityProfiles.js, shader quality candidates.
// - scripts/flat/reconciliation/POC/browser-page/runner.js, browser performance benchmark job.
// - agents/topics/apps/flat/reconciliation/shader-design.md, setup/config versus per-pixel shader boundary.

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
    SHADER_QUALITY_PROFILES,
    SpectralCalculator,
    SphericalEarthGeometry,
    algorithm32ConstantsForShaderQualityProfile,
    shaderQualityProfileById,
} from '../index.js';
import DEFAULT_PLANET_SPHERE_GROUND_SCENE, {
    planetSphereSceneDefinitionByName,
    planetSphereSceneDefinitionWithRenderOptions,
} from '../scenes/planetSphereSceneDefinition.js';
import PLANET_SPHERE_SCENE_FACTS from '../scenes/planetSphereSceneFacts.js';
import {
    appendRunLog,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const DEFAULT_PROFILE_ORDER = Object.freeze([
    'ideal',
    'balanced',
    'balanced-cache-interp',
    'adaptive-balanced',
    'adaptive-balanced-soft',
    'fast',
    'fast-cache-interp',
    'draft',
]);

const recordDirectory = parseRecordDirectory(process.argv);
const COMMAND_PATH = resolve(stringArg('--command-path', 'scripts/flat/reconciliation/POC/browser-jobs/browser-command.json'));
const WATCHER_OUT_ROOT = resolve(stringArg('--watcher-out-root', 'tmp/atmosphere/reconciliation'));
const WATCH_TIMEOUT_MS = numberArg('--timeout-ms', 600000);
const POLL_MS = numberArg('--poll-ms', 750);
const width = numberArg('--width', 320);
const height = numberArg('--height', 180);
const runCount = numberArg('--runs', 100);
const warmupRunCount = numberArg('--warmup-runs', 5);
const yieldEvery = numberArg('--yield-every', 5);
const yieldMs = numberArg('--yield-ms', 10);
const profileYieldMs = numberArg('--profile-yield-ms', 50);
const forceGpuFinish = !booleanArg('--no-gpu-finish');
const bottomRadiusMeters = numberArg('--bottom-radius-meters', 6360000);
const observerAltitudeMeters = numberArg('--observer-altitude-meters', 150);
const scaleDenominator = numberArg('--scale-denominator', 1000);
const sceneDepthMaxMeters = numberArg('--scene-depth-max-meters', 150000);
const verticalFovDegrees = numberArg('--vertical-fov-degrees', 35);
const sceneName = stringArg('--scene-name', DEFAULT_PLANET_SPHERE_GROUND_SCENE.name);
const requestedPlanetSceneDefinition = planetSphereSceneDefinitionByName(sceneName);
const allowShading = booleanArg('--allow-shading');
const withShadows = !booleanArg('--no-shadows');
const planetSceneDefinition = planetSphereSceneDefinitionWithRenderOptions(requestedPlanetSceneDefinition, {
    allowShading,
    withShadows,
});
const endpointRadianceScale = numberArg(
    '--endpoint-radiance-scale',
    PLANET_SPHERE_SCENE_FACTS.endpointRadianceScale,
);
const groundDisplayMode = stringArg('--ground-display-mode', 'pattern');
const requestedSunSample = stringArg('--sun-sample', 'noon-sunset-midpoint');
const profileIds = profileIdsFromArgs();
const shaderQualityProfiles = profileIds.map((id) => shaderQualityProfileById(id));
const failures = [];

await appendRunLog(recordDirectory, 'm3ShaderQualityPerformanceBenchmark started.');

let command = null;
let latest = null;
let performanceArtifact = null;
let performanceArtifactPath = null;
let benchmarkRows = [];

try {
    command = makeCommand();
    await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
    await appendRunLog(recordDirectory, `submitted browser benchmark command ${command.id}.`);
    latest = await waitForWatcherResult(command.id);
    performanceArtifactPath = findSavedArtifactPath(latest, 'performance/benchmark-results.json');
    performanceArtifact = performanceArtifactPath
        ? await readJsonIfExists(performanceArtifactPath)
        : latest?.result?.diagnostics?.performanceBenchmark ?? null;
    benchmarkRows = Array.isArray(performanceArtifact?.profiles)
        ? performanceArtifact.profiles.map((profileResult) => summarizeBenchmarkRow(profileResult))
        : [];
} catch (error) {
    failures.push(failure('shader-quality-performance-benchmark-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('performance-artifact-present', Boolean(performanceArtifact)),
    criterion('performance-clock-is-performance-now', performanceArtifact?.clock === 'performance.now'),
    criterion('gpu-finish-policy-recorded', performanceArtifact?.forceGpuFinish === forceGpuFinish),
    criterion('yield-policy-recorded',
        performanceArtifact?.yieldEvery === yieldEvery
            && performanceArtifact?.yieldMs === yieldMs
            && performanceArtifact?.profileYieldMs === profileYieldMs),
    criterion('all-requested-profiles-benchmarked',
        benchmarkRows.length === shaderQualityProfiles.length
            && shaderQualityProfiles.every((profile) => benchmarkRows.some((row) => row.profileId === profile.id))),
    criterion('all-run-counts-present',
        benchmarkRows.every((row) => row.runCount === runCount)),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Shader quality performance benchmark criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Measure browser-side GPU performance for each shader quality profile, including
the ideal reference. Setup/configuration work, shader assembly, and cache
construction happen before the browser timed loop. The browser uses
\`performance.now()\` around repeated EffectComposer renders, forces GPU
completion with \`gl.finish()\` by default, and yields between small batches so
the benchmark does not monopolize the machine.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-shader-quality-performance-benchmark',
    runner: 'm3ShaderQualityPerformanceBenchmark',
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    artifactRunDirectory: resolve(recordDirectory),
    width,
    height,
    runCount,
    warmupRunCount,
    yieldEvery,
    yieldMs,
    profileYieldMs,
    forceGpuFinish,
    profileIds,
    sceneName,
    effectiveSceneName: planetSceneDefinition.name,
    allowShading,
    withShadows,
    sunSample: requestedSunSample,
    observerAltitudeMeters,
    scaleDenominator,
    sceneDepthMaxMeters,
    verticalFovDegrees,
    endpointRadianceScale,
    groundDisplayMode,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'scripts/flat/reconciliation/POC/src/shader/shaderQualityProfiles.js',
        'scripts/flat/reconciliation/POC/browser-page/algorithm32-composer-passes.js',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
        'tmp/atmosphere/reconciliation/415-m3-gpu-quality-ideal-320x180',
        'tmp/atmosphere/reconciliation/429-m3-gpu-quality-detectable-diff-comparison-320x180',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    command,
    latestSummary: summarizeLatest(latest),
    performanceArtifactPath,
    performanceArtifact,
    benchmarkRows,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3ShaderQualityPerformanceBenchmark.js --record ${recordDirectory} --runs ${runCount} --warmup-runs ${warmupRunCount} --yield-every ${yieldEvery} --yield-ms ${yieldMs} --profile-yield-ms ${profileYieldMs}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    performanceArtifactPath,
    benchmarkRows,
});
await writeText(recordDirectory, 'report.md', `# Report

Shader quality performance benchmark finished with status: ${status}.

- Viewport: \`${width} x ${height}\`
- Scene: \`${planetSceneDefinition.name}\`
- Sun sample: \`${requestedSunSample}\`
- Measured runs/profile: \`${runCount}\`
- Warmup runs/profile: \`${warmupRunCount}\`
- Yield policy: \`${yieldMs} ms every ${yieldEvery} runs; ${profileYieldMs} ms between profiles\`
- Clock: \`${performanceArtifact?.clock ?? 'not-reported'}\`
- GPU finish: \`${performanceArtifact?.forceGpuFinish ?? 'not-reported'}\`
- Timing scope: \`${performanceArtifact?.timingScope ?? 'not-reported'}\`
- Performance artifact: \`${performanceArtifactPath ?? 'not-written'}\`

| Profile | Work ratio | Runs | Setup ms | Warmup mean ms | Warmup max ms | Mean ms | Median ms | P95 ms | Min ms | Max ms | Stddev ms | MP/s | Mean time ratio vs ideal | Speedup vs ideal |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${benchmarkRows.map((row) => `| \`${row.profileId}\` | \`${formatNumber(row.estimatedWorkRatioToIdeal)}\` | \`${row.runCount}\` | \`${formatNumber(row.setupDurationMs)}\` | \`${formatNumber(row.warmupMeanMs)}\` | \`${formatNumber(row.warmupMaxMs)}\` | \`${formatNumber(row.meanMs)}\` | \`${formatNumber(row.medianMs)}\` | \`${formatNumber(row.p95Ms)}\` | \`${formatNumber(row.minMs)}\` | \`${formatNumber(row.maxMs)}\` | \`${formatNumber(row.standardDeviationMs)}\` | \`${formatNumber(row.megapixelsPerSecondAtMean)}\` | \`${formatNumber(row.meanTimeRatioToIdeal)}\` | \`${formatNumber(row.speedupVsIdeal)}\` |`).join('\n')}

Measured timings exclude Node-side shader assembly, descriptor creation, cache
construction, texture-payload packing, and browser diagnostic readbacks inside
the measured loop. They include the browser EffectComposer RenderPass and the
Algorithm32 GPU pass for the same scene and camera. The benchmark uses
\`gl.finish()\` by default so \`performance.now()\` reflects completed GPU work
rather than just command submission. Setup and warmup columns are reported
separately because browser shader compile/JIT and pipeline creation can happen
before steady-state measured frames.
`);
await appendRunLog(recordDirectory, `m3ShaderQualityPerformanceBenchmark ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    performanceArtifactPath,
    benchmarkRows,
}));

function makeCommand() {
    const sun = planetSphereSunSample(requestedSunSample);
    const profileBenchmarks = shaderQualityProfiles.map((profile) => buildProfileBenchmarkPayload(profile, sun));
    const geometryFrame = profileBenchmarks[0]?.geometryFrame ?? null;

    return Object.freeze({
        id: `shader-quality-performance-benchmark-${Date.now()}`,
        label: 'm3-shader-quality-performance-benchmark',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory: resolve(recordDirectory),
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: `Benchmark ${profileBenchmarks.length} Algorithm32 GPU shader quality profiles.`,
        payload: Object.freeze({
            jobType: 'shader-quality-performance-benchmark',
            sceneId: planetSceneDefinition.name,
            sceneKind: 'planet-sphere-ground',
            shaderRuntime: 'three-effect-composer',
            shaderBackend: 'gpu',
            comparisonMode: 'shader-quality-performance-benchmark',
            planetSceneDefinition,
            viewportPixels: Object.freeze([width, height]),
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            sceneDepthMaxMeters,
            verticalFovDegrees,
            groundDisplayMode,
            planetSceneFacts: PLANET_SPHERE_SCENE_FACTS,
            cameraWorldPositionMeters: Object.freeze([bottomRadiusMeters + observerAltitudeMeters, 0, 0]),
            distantSunDirection: sun.observerLocalDirection,
            geometryFrame,
            sceneTerminationMeters: 0,
            endpointRadianceScale,
            solar: sun,
            performanceBenchmark: Object.freeze({
                runCount,
                warmupRunCount,
                yieldEvery,
                yieldMs,
                profileYieldMs,
                forceGpuFinish,
            }),
            profileBenchmarks,
        }),
    });
}

function buildProfileBenchmarkPayload(profile, sun) {
    const constants = algorithm32ConstantsForShaderQualityProfile(profile);
    const descriptor = new DistantSphericalShaderDescriptorBuilder({
        constants,
    }).build({
        variantId: `algorithm32-distant-spherical-performance-${profile.id}`,
        compatibilityTags: Object.freeze([
            `shader-quality-${profile.id}`,
            'shader-quality-performance-benchmark',
        ]),
        transportOptimization: profile.transportOptimization,
        cacheOptimization: profile.cacheOptimization,
    });
    const factory = new DistantSphericalShaderContributionFactory();
    const assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    const incidentRadianceCache = buildDistantIncidentRadianceCacheForShader(
        sun.observerLocalDirection,
        profile.numericalControls,
    );

    return Object.freeze({
        profileId: profile.id,
        shaderQualityProfile: profile,
        descriptorFingerprint: descriptor.fingerprint,
        sourceHash: assembly.sourceHash,
        fragmentShaderSource: assembly.fragmentShaderSource,
        geometryFrame: descriptor.geometry.facts.observerLocalSceneFrame,
        pathIntervalCount: profile.numericalControls.pathIntervalCount,
        incidentRadianceTexture: incidentRadianceCache.shaderPayload.texture,
        incidentRadianceCache: Object.freeze({
            descriptor: incidentRadianceCache.cache.descriptor,
            coordinateCount: incidentRadianceCache.coordinateCount,
            shaderPayloadMetadata: incidentRadianceCache.shaderPayload.metadata,
            lookup: incidentRadianceCache.shaderPayload.lookup,
        }),
    });
}

function buildDistantIncidentRadianceCacheForShader(directionToLight, numericalControls) {
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: observerAltitudeMeters,
        observerUpDirection: [1, 0, 0],
        sourceDirection: directionToLight,
        cacheAltitudeBinCount: numericalControls.incidentAltitudeBinCount,
        cacheBoundaryAltitudeMeters: 2,
        sourceTransmittanceIntervalCount: numericalControls.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new DistantSunLightSource({
        directionToLight,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        cacheAltitudeBinCount: numericalControls.incidentAltitudeBinCount,
        cacheDirectionCount: numericalControls.incidentDirectionCount,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: numericalControls,
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
        pathIntervalCount: numericalControls.pathIntervalCount,
        sourceTransmittanceIntervalCount: numericalControls.sourceTransmittanceIntervalCount,
    });

    return Object.freeze({
        cache: buildResult.cache,
        coordinateCount: buildResult.coordinateCount,
        shaderPayload: buildResult.cache.createShaderPayload(),
    });
}

function planetSphereSunSample(sampleId) {
    if (sampleId === 'solar-noon') {
        return southernFranceSolarNoonSample();
    }
    if (sampleId === 'noon-sunset-midpoint') {
        return southernFranceNoonSunsetMidpointSample();
    }
    if (sampleId === 'sunset') {
        return southernFranceSunsetSample();
    }

    throw new Error(`Unknown planet sphere sun sample: ${sampleId}`);
}

function southernFranceSolarNoonSample() {
    const date = '2026-06-21';
    const latitudeDegrees = 37.3382;
    const longitudeDegrees = -121.8863;
    const declinationDegrees = 23.5;
    const hourAngleDegrees = 0;
    const pose = sphericalSolarPose({
        latitudeDegrees,
        declinationDegrees,
        hourAngleDegrees,
    });

    return Object.freeze({
        id: 'solar-noon',
        label: 'solar noon',
        date,
        location: Object.freeze({ latitudeDegrees, longitudeDegrees }),
        declinationDegrees,
        hourAngleDegrees,
        localSolarTime: Object.freeze({ label: '13:09' }),
        altitudeDegrees: pose.altitudeDegrees,
        azimuthDegrees: pose.azimuthDegrees,
        observerLocalDirection: pose.observerLocalDirection,
        sunsetHourAngleDegrees: null,
    });
}

function southernFranceNoonSunsetMidpointSample() {
    return southernFranceSolarSampleAtSunsetFraction({
        id: 'noon-sunset-midpoint',
        label: 'halfway between solar noon and sunset',
        sunsetFraction: 0.5,
    });
}

function southernFranceSunsetSample() {
    return southernFranceSolarSampleAtSunsetFraction({
        id: 'sunset',
        label: 'sunset, 15 min before horizon',
        minutesBeforeSunset: 15,
    });
}

function southernFranceSolarSampleAtSunsetFraction({
    id,
    label,
    sunsetFraction = null,
    minutesBeforeSunset = null,
}) {
    const date = '2026-06-21';
    const latitudeDegrees = 37.3382;
    const longitudeDegrees = -121.8863;
    const declinationDegrees = 23.5;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const declinationRadians = declinationDegrees * Math.PI / 180;
    const sunsetAltitudeRadians = -0.833 * Math.PI / 180;
    const cosHourAngle = (
        Math.sin(sunsetAltitudeRadians)
        - Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    ) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians));
    const sunsetHourAngleDegrees = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
    const hourAngleDegrees = Number.isFinite(minutesBeforeSunset)
        ? sunsetHourAngleDegrees - minutesBeforeSunset / 4
        : sunsetHourAngleDegrees * sunsetFraction;
    const pose = sphericalSolarPose({
        latitudeDegrees,
        declinationDegrees,
        hourAngleDegrees,
    });

    return Object.freeze({
        id,
        label,
        date,
        location: Object.freeze({ latitudeDegrees, longitudeDegrees }),
        declinationDegrees,
        hourAngleDegrees,
        localSolarTime: Object.freeze({ label: timeLabelFromMinutes(789 + Math.round(hourAngleDegrees * 4)) }),
        altitudeDegrees: pose.altitudeDegrees,
        azimuthDegrees: pose.azimuthDegrees,
        observerLocalDirection: pose.observerLocalDirection,
        sunsetHourAngleDegrees,
        minutesBeforeSunset,
    });
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

    return Object.freeze({
        altitudeDegrees: altitudeRadians * 180 / Math.PI,
        azimuthDegrees,
        observerLocalDirection: Object.freeze([
            Math.sin(altitudeRadians),
            horizontal * Math.sin(azimuthRadians),
            horizontal * Math.cos(azimuthRadians),
        ]),
    });
}

async function waitForWatcherResult(commandId) {
    const startedAt = Date.now();
    let lastProgressMessage = null;
    let waitPollCount = 0;

    while (Date.now() - startedAt < WATCH_TIMEOUT_MS) {
        const candidate = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'latest.json'));
        if (candidate?.command?.id === commandId) {
            return candidate;
        }

        const progress = await readJsonIfExists(resolve(WATCHER_OUT_ROOT, 'progress.json'));
        const progressMessage = watcherProgressMessage(progress, commandId);
        if (progressMessage && progressMessage !== lastProgressMessage) {
            lastProgressMessage = progressMessage;
            await appendRunLog(recordDirectory, `watcher progress: ${progressMessage}`);
        } else if (!progressMessage && waitPollCount % 8 === 0) {
            await appendRunLog(recordDirectory, `waiting for watcher result command=${commandId}.`);
        }
        waitPollCount += 1;
        await delay(POLL_MS);
    }

    throw new Error(`Timed out waiting ${WATCH_TIMEOUT_MS} ms for watcher command ${commandId}.`);
}

function watcherProgressMessage(progress, commandId) {
    if (progress?.currentJobId !== commandId || typeof progress.message !== 'string') {
        return null;
    }

    return progress.message;
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
        wrotePerformanceArtifact: browserArtifactSaved(value, 'performance/benchmark-results.json'),
        requiresPageRecovery: value.browser?.requiresPageRecovery ?? null,
    });
}

function findSavedArtifactPath(value, name) {
    return (value?.artifact?.savedArtifacts ?? []).find((artifact) => artifact.name === name)?.path ?? null;
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

function summarizeBenchmarkRow(profileResult) {
    const benchmark = profileResult.benchmark;
    const summary = benchmark?.summary ?? {};
    const profile = profileResult.shaderQualityProfile ?? {};
    const relativeToIdeal = profileResult.relativeToIdeal ?? {};

    return Object.freeze({
        profileId: profileResult.profileId,
        estimatedWorkRatioToIdeal: profile.estimatedWorkRatioToIdeal ?? null,
        totalDominantSpectralSteps: profile.workEstimate?.totalDominantSpectralSteps ?? null,
        runCount: summary.count ?? null,
        setupDurationMs: benchmark?.setupDurationMs ?? null,
        warmupMeanMs: benchmark?.warmupSummary?.meanMs ?? null,
        warmupMaxMs: benchmark?.warmupSummary?.maxMs ?? null,
        measuredLoopElapsedMs: benchmark?.measuredLoopElapsedMs ?? null,
        totalElapsedMs: benchmark?.totalElapsedMs ?? null,
        meanMs: summary.meanMs ?? null,
        medianMs: summary.medianMs ?? null,
        p95Ms: summary.p95Ms ?? null,
        minMs: summary.minMs ?? null,
        maxMs: summary.maxMs ?? null,
        standardDeviationMs: summary.standardDeviationMs ?? null,
        megapixelsPerSecondAtMean: profileResult.throughput?.megapixelsPerSecondAtMean ?? null,
        meanTimeRatioToIdeal: relativeToIdeal.meanTimeRatio ?? null,
        speedupVsIdeal: relativeToIdeal.speedup ?? null,
    });
}

function profileIdsFromArgs() {
    const value = stringArg('--profiles', '');
    if (value) {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
    }

    const available = new Set(SHADER_QUALITY_PROFILES.map((profile) => profile.id));
    return DEFAULT_PROFILE_ORDER.filter((profileId) => available.has(profileId));
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

function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}

function timeLabelFromMinutes(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    return typeof process.argv[index + 1] === 'string' ? process.argv[index + 1] : fallback;
}

function booleanArg(name) {
    return process.argv.includes(name);
}

function formatNumber(value) {
    return Number.isFinite(value) ? Number(value).toFixed(4) : 'not-reported';
}
