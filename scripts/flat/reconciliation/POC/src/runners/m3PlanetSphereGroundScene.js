// References:
// - tmp/atmosphere/reconciliation/193-m3-raw-scene-no-ground-object-green-boxes.
// - scripts/flat/reconciliation/POC/browser-page/runner.js, browser Three scene diagnostics.

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
    M2_LOCAL_FLAT_UNION_GLACIER_CAMP_DEC14_2021_DATE_UTC,
    M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LATITUDE_DEGREES,
    M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LONGITUDE_DEGREES,
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

const recordDirectory = parseRecordDirectory(process.argv);
const COMMAND_PATH = resolve(stringArg('--command-path', 'scripts/flat/reconciliation/POC/browser-jobs/browser-command.json'));
const WATCHER_OUT_ROOT = resolve(stringArg('--watcher-out-root', 'tmp/atmosphere/reconciliation'));
const WATCH_TIMEOUT_MS = 120000;
const POLL_MS = 750;
const PROGRESS_LOG_INTERVAL_MS = 5000;
const width = numberArg('--width', 640);
const height = numberArg('--height', 360);
const bottomRadiusMeters = numberArg('--bottom-radius-meters', 6360000);
const observerAltitudeMeters = numberArg('--observer-altitude-meters', 150);
const scaleDenominator = numberArg('--scale-denominator', 1000);
const sceneDepthMaxMeters = numberArg('--scene-depth-max-meters', 150000);
const verticalFovDegrees = numberArg('--vertical-fov-degrees', 35);
const sceneName = stringArg('--scene-name', DEFAULT_PLANET_SPHERE_GROUND_SCENE.name);
const artifactRunDirectory = resolve(recordDirectory);
const requestedPlanetSceneDefinition = planetSphereSceneDefinitionByName(sceneName);
const allowShading = booleanArg('--allow-shading');
const withShadows = booleanArg('--with-shadows');
const planetSceneDefinition = planetSphereSceneDefinitionWithRenderOptions(requestedPlanetSceneDefinition, {
    allowShading,
    withShadows,
});
const withShader = booleanArg('--with-shader');
const shaderBackend = stringArg('--shader-backend', 'gpu') === 'cpu' ? 'cpu' : 'gpu';
const solarNoon = booleanArg('--solar-noon');
const endpointRadianceScale = numberArg(
    '--endpoint-radiance-scale',
    PLANET_SPHERE_SCENE_FACTS.endpointRadianceScale,
);
const groundDisplayMode = stringArg('--ground-display-mode', 'pattern');
const requestedSunSample = stringArg('--sun-sample', solarNoon ? 'solar-noon' : 'solar-noon');
const requestedSunDirection = vectorArgOrNull('--sun-direction');
const requestedSunLabel = stringArg('--sun-label', requestedSunSample);
const requestedSunClockOffsetDegrees = numberArg('--sun-clock-offset-degrees', 0);
const shaderQualityProfileId = stringArg('--shader-quality-profile', 'ideal');
const shaderQualityProfile = shaderQualityProfileById(shaderQualityProfileId);
const shaderQualityConstants = algorithm32ConstantsForShaderQualityProfile(shaderQualityProfile);
const runtimeNumericalControls = shaderQualityProfile.numericalControls;
const failures = [];

await appendRunLog(recordDirectory, 'm3PlanetSphereGroundScene started.');

let command = null;
let latest = null;
let selectedPixels = null;
let browserDiagnostics = null;
let descriptor = null;
let assembly = null;

try {
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
    failures.push(failure('planet-sphere-ground-scene-crash', error.message, { stack: error.stack }));
}

const sceneDiagnostics = latest?.result?.diagnostics?.scene ?? null;
const browserSceneSummary = sceneDiagnostics?.browserThreeScene ?? sceneDiagnostics ?? null;
const browserPlanetSceneDefinition = browserSceneSummary?.planetSceneDefinition
    ?? browserSceneSummary?.sceneDefinition
    ?? null;
const criteria = Object.freeze([
    criterion('command-submitted-pending', command?.status === 'pending'),
    criterion('watcher-completed-matching-command', latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', await commandFileIsDone(command?.id)),
    criterion('browser-artifacts-written-in-record-directory',
        sameResolvedPath(latest?.artifact?.runDir, artifactRunDirectory)),
    criterion('shadow-option-implies-shading',
        !withShadows || planetSceneDefinition.lightingPolicy === 'directional-light-from-distant-sun'),
    criterion('browser-shadow-policy-as-requested',
        browserPlanetSceneDefinition?.shadowPolicy === planetSceneDefinition.shadowPolicy),
    criterion('browser-job-accepted', latest?.status === 'accepted'),
    criterion('canvas-image-written', browserArtifactSaved(latest, 'images/canvas-image.png')),
    criterion('pre-shader-scene-color-image-written',
        withShader
            ? browserArtifactSaved(latest, 'images/pre-shader-scene-color.png')
                && typeof latest?.artifact?.paths?.preShaderSceneColorImagePath === 'string'
            : !browserArtifactSaved(latest, 'images/pre-shader-scene-color.png')),
    criterion('planet-ground-and-boxes-scene-reported',
        withShader
            ? browserSceneSummary?.visualMeshCount >= 5
                && browserSceneSummary?.objectHitCounts?.['scaled-planet-size-ground-sphere'] > 0
                && everyDiagnosticBoxHit(browserSceneSummary?.objectHitCounts, planetSceneDefinition)
            : browserSceneSummary?.meshCount >= 5
                && constructedSceneHasExpectedObjects(browserSceneSummary, planetSceneDefinition.objectNames)),
    criterion('scene-color-comes-from-constructed-raycast-endpoints',
        withShader
            ? (
                browserSceneSummary?.colorSource === 'constructed scene raycast endpoint color'
                || browserSceneSummary?.colorSource === 'EffectComposer RenderPass readBuffer.texture'
            )
                && browserSceneSummary?.hitMaskSource === 'constructed scene raycast hit mask'
                && browserSceneSummary?.groundColorPolicy?.includes('exact ground raycast')
            : browserSceneSummary?.kind === 'browser-planet-sphere-scene'),
    criterion('ground-raycast-endpoint-color-present',
        withShader
            ? objectColorExtentsPresent(browserSceneSummary?.objectColorExtents?.['scaled-planet-size-ground-sphere'])
            : browserSceneSummary?.sphere?.owner === 'geometry'),
    criterion('diagnostic-box-raycast-endpoint-color-present',
        withShader
            ? everyDiagnosticBoxColorExtentPresent(browserSceneSummary?.objectColorExtents, planetSceneDefinition)
            : constructedSceneHasExpectedObjects(browserSceneSummary, planetSceneDefinition.objectNames)),
    criterion('shader-mode-as-requested', withShader
        ? latest?.result?.diagnostics?.shader?.status === 'accepted'
        : latest?.result?.diagnostics?.shader?.kind === 'none'),
    criterion('shader-backend-as-requested',
        !withShader || latest?.result?.diagnostics?.shader?.backend === shaderBackend),
    criterion('selected-pixel-readback-recorded',
        Array.isArray(selectedPixels?.selectedPixels) && selectedPixels.selectedPixels.length === 3),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Planet sphere ground scene criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render a fresh browser Three scene containing scene-owned colored diagnostic
boxes plus a scaled planet-size sphere used as depth/occlusion geometry at a
${observerAltitudeMeters} m observer elevation. In shader mode, this proves
the browser shader path consumes constructed-scene raycast endpoint color, hit
distance, and hit mask from the same semantic scene objects. The visible ground
mesh remains visual only; a geometry-owned exact spherical ground raycast
object owns ground hit distance and hit-mask classification. The watcher also
writes the pre-shader endpoint-color texture for comparison.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-ground-object-isolation',
    runner: 'm3PlanetSphereGroundScene',
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
    artifactRunDirectory,
    sceneName,
    width,
    height,
    requestedSceneName: sceneName,
    effectiveSceneName: planetSceneDefinition.name,
    allowShading,
    withShadows,
    bottomRadiusMeters,
    observerAltitudeMeters,
    scaleDenominator,
    sceneDepthMaxMeters,
    verticalFovDegrees,
    withShader,
    shaderBackend,
    solarNoon,
    sunSample: requestedSunSample,
    sunClockOffsetDegrees: requestedSunClockOffsetDegrees,
    endpointRadianceScale,
    groundDisplayMode,
    shaderQualityProfile,
    timeoutMs: WATCH_TIMEOUT_MS,
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'tmp/atmosphere/reconciliation/192-m3-raw-scene-low-camera-green-boxes',
        'tmp/atmosphere/reconciliation/193-m3-raw-scene-no-ground-object-green-boxes',
        'scripts/flat/reconciliation/POC/browser-page/runner.js',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    command,
    descriptorFingerprint: descriptor?.fingerprint ?? null,
    sourceHash: assembly?.sourceHash ?? null,
    shaderQualityProfile,
    latestSummary: summarizeLatest(latest),
    sceneDiagnostics,
    browserSceneSummary,
    browserPlanetSceneDefinition,
    browserDiagnostics,
    solar: latest?.command?.payload?.solar ?? null,
    selectedPixels,
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
});
await writeText(recordDirectory, 'report.md', `# Report

Planet sphere ground scene finished with status: ${status}.

- Artifact directory: \`${latest?.artifact?.runDir ?? 'not-completed'}\`
- Scene preset: \`${sceneName}\`
- Effective scene: \`${planetSceneDefinition.name}\`
- Lighting policy: \`${planetSceneDefinition.lightingPolicy}\`
- Shadow policy: \`${planetSceneDefinition.shadowPolicy}\`
- Sun sample: \`${latest?.command?.payload?.solar?.label ?? requestedSunSample}\`
- Sun altitude/azimuth: \`${latest?.command?.payload?.solar?.altitudeDegrees ?? 'not-reported'} / ${latest?.command?.payload?.solar?.azimuthDegrees ?? 'not-reported'}\`
- Canvas image: \`${latest?.artifact?.paths?.canvasImagePath ?? 'not-written'}\`
- Pre-shader scene color image: \`${latest?.artifact?.paths?.preShaderSceneColorImagePath ?? 'not-written'}\`
- Visible mesh count: \`${browserSceneSummary?.visualMeshCount ?? browserSceneSummary?.meshCount ?? 'not-reported'}\`
- Raycast diagnostic object count: \`${browserSceneSummary?.raycastObjectCount ?? 'not-reported'}\`
- Color source: \`${browserSceneSummary?.colorSource ?? 'not-reported'}\`
- Ground color policy: \`${browserSceneSummary?.groundColorPolicy ?? 'not-reported'}\`
- Shadowed hit pixels: \`${browserSceneSummary?.sceneShadows?.shadowedHitPixelCount ?? 'not-reported'}\`
- Object hit counts: \`${JSON.stringify(browserSceneSummary?.objectHitCounts ?? null)}\`
- Shader kind: \`${latest?.result?.diagnostics?.shader?.kind ?? 'not-reported'}\`
- Shader status: \`${latest?.result?.diagnostics?.shader?.status ?? 'not-reported'}\`
- Shader backend: \`${latest?.result?.diagnostics?.shader?.backend ?? 'not-reported'}\`
- Shader quality profile: \`${shaderQualityProfile.id}\`
- Estimated dominant spectral work per pixel: \`${shaderQualityProfile.workEstimate.totalDominantSpectralSteps}\`
- Estimated work ratio to ideal: \`${shaderQualityProfile.estimatedWorkRatioToIdeal}\`

In shader mode, the constructed Three scene is rendered through an integrated
EffectComposer path. The shader backend consumes composer scene color, raycaster
hit distance encoded in Algorithm32 meters, the explicit scene-hit mask, camera
matrices, camera world position, Sun direction, and the packed distant L2 cache
payload. The visible ground sphere contributes only rendered scene color; the
geometry-owned exact spherical ground raycast object owns the ground hit
distance and hit mask, keeping CPU and GPU ground-hit authority aligned.
`);
await appendRunLog(recordDirectory, `m3PlanetSphereGroundScene ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    artifactDirectory: latest?.artifact?.runDir ?? null,
    canvasImagePath: latest?.artifact?.paths?.canvasImagePath ?? null,
    preShaderSceneColorImagePath: latest?.artifact?.paths?.preShaderSceneColorImagePath ?? null,
}));

function makeCommand() {
    const sun = planetSphereSunSample(requestedSunSample);

    if (withShader) {
        descriptor = new DistantSphericalShaderDescriptorBuilder({
            constants: shaderQualityConstants,
        }).build({
            variantId: `algorithm32-distant-spherical-planet-sphere-ground-${shaderQualityProfile.id}`,
            compatibilityTags: Object.freeze([
                `shader-quality-${shaderQualityProfile.id}`,
            ]),
            transportOptimization: shaderQualityProfile.transportOptimization,
            cacheOptimization: shaderQualityProfile.cacheOptimization,
        });
        const factory = new DistantSphericalShaderContributionFactory();
        assembly = new Algorithm32ShaderAssembler().assemble({
            descriptor,
            contributions: factory.createContributions(descriptor),
            mainRequiredSymbols: factory.mainRequiredSymbols(),
        });
        const incidentRadianceCache = buildDistantIncidentRadianceCacheForShader(
            sun.observerLocalDirection,
            runtimeNumericalControls,
        );

        return Object.freeze({
            id: `planet-sphere-ground-shader-scene-${Date.now()}`,
            label: 'm3-planet-sphere-ground-shader-scene',
            page: 'index.html',
            entrypoint: 'runReconciliationShaderJob',
            captures: Object.freeze({
                screenshot: 'images/screenshot.png',
            }),
            artifactRunDirectory,
            status: 'pending',
            createdAt: new Date().toISOString(),
            stateGoal: `Render ${planetSceneDefinition.name} through the assembled distant/spherical shader.`,
            payload: Object.freeze({
                jobType: 'assembled-three-scene-comparison',
                sceneId: planetSceneDefinition.name,
                sceneKind: 'planet-sphere-ground',
                shaderRuntime: 'three-effect-composer',
                shaderBackend,
                planetSceneDefinition,
                comparisonMode: 'planet-sphere-ground-shader',
                descriptorFingerprint: descriptor.fingerprint,
                sourceHash: assembly.sourceHash,
                fragmentShaderSource: assembly.fragmentShaderSource,
                shaderQualityProfile,
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
                geometryFrame: descriptor.geometry.facts.observerLocalSceneFrame,
                pathIntervalCount: runtimeNumericalControls.pathIntervalCount,
                incidentRadianceTexture: incidentRadianceCache.shaderPayload.texture,
                incidentRadianceCache: Object.freeze({
                    descriptor: incidentRadianceCache.cache.descriptor,
                    coordinateCount: incidentRadianceCache.coordinateCount,
                    shaderPayloadMetadata: incidentRadianceCache.shaderPayload.metadata,
                    lookup: incidentRadianceCache.shaderPayload.lookup,
                }),
                sceneTerminationMeters: 0,
                endpointRadianceScale,
                solar: sun,
            }),
        });
    }

    return Object.freeze({
        id: `planet-sphere-ground-scene-${Date.now()}`,
        label: 'm3-planet-sphere-ground-scene',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        artifactRunDirectory,
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: 'Render a direct browser Three scene with one scaled planet-size sphere.',
        payload: Object.freeze({
            jobType: 'browser-planet-sphere-scene',
            viewportPixels: Object.freeze([width, height]),
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            verticalFovDegrees,
            planetSceneFacts: PLANET_SPHERE_SCENE_FACTS,
            planetSceneDefinition,
            distantSunDirection: sun.observerLocalDirection,
            solar: sun,
        }),
    });
}

function planetSphereSunSample(sampleId) {
    if (requestedSunDirection) {
        const direction = normalizeVector(requestedSunDirection);

        return Object.freeze({
            id: requestedSunLabel,
            label: requestedSunLabel,
            date: 'review-direction',
            location: Object.freeze({ latitudeDegrees: null, longitudeDegrees: null }),
            declinationDegrees: null,
            hourAngleDegrees: null,
            localSolarTime: Object.freeze({ label: requestedSunLabel }),
            altitudeDegrees: Math.asin(direction[0]) * 180 / Math.PI,
            azimuthDegrees: normalizeDegrees(Math.atan2(direction[1], direction[2]) * 180 / Math.PI),
            observerLocalDirection: direction,
        });
    }
    if (sampleId === 'union-glacier-2021-dec14-solar-noon-offset') {
        return unionGlacier2021SolarNoonOffsetSample(requestedSunClockOffsetDegrees);
    }
    const unionGlacierOffsetMatch =
        /^union-glacier-2021-dec14-(\d{3})deg-from-solar-noon$/.exec(sampleId);
    if (unionGlacierOffsetMatch) {
        return unionGlacier2021SolarNoonOffsetSample(Number(unionGlacierOffsetMatch[1]));
    }
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

function unionGlacier2021SolarNoonOffsetSample(clockOffsetDegrees) {
    const offsetDegrees = normalizeDegrees(clockOffsetDegrees);
    const date = M2_LOCAL_FLAT_UNION_GLACIER_CAMP_DEC14_2021_DATE_UTC;
    const latitudeDegrees = M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LATITUDE_DEGREES;
    const longitudeDegrees = M2_LOCAL_FLAT_UNION_GLACIER_FINAL_EXPERIMENT_LONGITUDE_DEGREES;
    const declinationDegrees = solarDeclinationApproxDegrees(date);
    const hourAngleDegrees = offsetDegrees;
    const pose = sphericalSolarPose({
        latitudeDegrees,
        declinationDegrees,
        hourAngleDegrees,
    });
    const solarNoonUtcMinutes = 720 - longitudeDegrees * 4;
    const rowUtcMinutes = solarNoonUtcMinutes + hourAngleDegrees * 4;
    const sourceSubpointLongitudeDegrees = normalizeLongitudeDegrees(longitudeDegrees - hourAngleDegrees);
    const offsetSlug = `${String(Math.round(offsetDegrees)).padStart(3, '0')}deg`;

    return Object.freeze({
        id: `union-glacier-2021-dec14-${offsetSlug}-from-solar-noon`,
        label: `Union Glacier 2021-12-14 ${offsetSlug} from real solar noon`,
        date,
        location: Object.freeze({ latitudeDegrees, longitudeDegrees }),
        declinationDegrees,
        hourAngleDegrees,
        sourceSubpointLongitudeDegrees,
        localSolarTime: Object.freeze({
            label: timeLabelFromMinutes(720 + Math.round(hourAngleDegrees * 4)),
            noonLabel: '12:00',
            utcLabel: timeLabelFromMinutes(Math.round(rowUtcMinutes)),
            solarNoonUtcLabel: timeLabelFromMinutes(Math.round(solarNoonUtcMinutes)),
            policy: '0 degrees is real local solar noon at Union Glacier. The source latitude corresponds to the real-world subsolar latitude for the date at longitude-0 solar noon; positive offsets advance local solar time by 4 minutes per degree.',
        }),
        altitudeDegrees: pose.altitudeDegrees,
        azimuthDegrees: pose.azimuthDegrees,
        observerLocalDirection: pose.observerLocalDirection,
        clockSync: Object.freeze({
            kind: 'real-subsolar-longitude0-noon',
            anchor: 'default sync policy unless overridden: local Sun latitude and 0 degree row correspond to real-world subsolar latitude at longitude-0 solar noon, with the observer row at real local solar noon',
            offsetDegrees,
            date,
            observerLongitudeDegrees: longitudeDegrees,
            sourceSubpointLongitudeDegrees,
        }),
    });
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

function objectColorExtentsPresent(extents) {
    return Array.isArray(extents?.minRgb)
        && Array.isArray(extents?.maxRgb)
        && extents.minRgb.length === 3
        && extents.maxRgb.length === 3
        && extents.minRgb.every(Number.isFinite)
        && extents.maxRgb.every(Number.isFinite);
}

function everyDiagnosticBoxColorExtentPresent(objectColorExtents, sceneDefinition) {
    const boxNames = diagnosticBoxObjectNames(sceneDefinition);

    return boxNames.length > 0 && boxNames.every((name) => objectColorExtentsPresent(objectColorExtents?.[name]));
}

function constructedSceneHasExpectedObjects(sceneSummary, expectedObjectNames) {
    const names = new Set((sceneSummary?.sceneObjects ?? []).map((entry) => entry.name));

    return expectedObjectNames.every((name) => names.has(name));
}

function everyDiagnosticBoxHit(objectHitCounts, sceneDefinition) {
    const boxNames = diagnosticBoxObjectNames(sceneDefinition);

    return boxNames.length > 0 && boxNames.every((name) => (objectHitCounts?.[name] ?? 0) > 0);
}

function diagnosticBoxObjectNames(sceneDefinition) {
    const specs = sceneDefinition?.objectSpecs ?? {};

    return (sceneDefinition?.objectNames ?? []).filter((name) => {
        const spec = specs[name];
        return spec?.kind === 'diagnostic-color-box' || spec?.kind === 'diagnostic-green-box';
    });
}

function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}

function normalizeLongitudeDegrees(longitudeDegrees) {
    const normalized = ((((longitudeDegrees + 180) % 360) + 360) % 360) - 180;

    return Math.abs(normalized + 180) < 1e-9 ? 180 : normalized;
}

function solarDeclinationApproxDegrees(dateText) {
    const date = new Date(`${dateText}T12:00:00Z`);
    const start = new Date(`${date.getUTCFullYear()}-01-01T00:00:00Z`);
    const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;

    return 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
}

function timeLabelFromMinutes(minutes) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hours = Math.floor(normalized / 60);
    const mins = normalized % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function runnerInvocationCommand() {
    const parts = [
        'node',
        'scripts/flat/reconciliation/POC/src/runners/m3PlanetSphereGroundScene.js',
        '--record', recordDirectory,
        '--width', String(width),
        '--height', String(height),
        '--scene-name', sceneName,
        '--bottom-radius-meters', String(bottomRadiusMeters),
        '--observer-altitude-meters', String(observerAltitudeMeters),
        '--scale-denominator', String(scaleDenominator),
        '--scene-depth-max-meters', String(sceneDepthMaxMeters),
        '--vertical-fov-degrees', String(verticalFovDegrees),
        '--endpoint-radiance-scale', String(endpointRadianceScale),
        '--ground-display-mode', groundDisplayMode,
        '--sun-sample', requestedSunSample,
        '--sun-clock-offset-degrees', String(requestedSunClockOffsetDegrees),
    ];

    if (allowShading) {
        parts.push('--allow-shading');
    }
    if (withShadows) {
        parts.push('--with-shadows');
    }
    if (withShader) {
        parts.push(
            '--with-shader',
            '--shader-backend', shaderBackend,
            '--shader-quality-profile', shaderQualityProfile.id,
        );
    }
    if (solarNoon) {
        parts.push('--solar-noon');
    }
    if (requestedSunDirection) {
        parts.push('--sun-direction', requestedSunDirection.join(','));
    }
    if (requestedSunLabel !== requestedSunSample) {
        parts.push('--sun-label', requestedSunLabel);
    }

    return parts.join(' ');
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

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return fallback;
    }

    return typeof process.argv[index + 1] === 'string' ? process.argv[index + 1] : fallback;
}

function vectorArgOrNull(name) {
    const raw = stringArg(name, '');
    if (!raw) {
        return null;
    }
    const values = raw.split(',').map((entry) => Number(entry.trim()));
    if (values.length !== 3 || !values.every(Number.isFinite)) {
        throw new Error(`${name} requires three comma-separated finite numbers.`);
    }

    return Object.freeze(values);
}

function normalizeVector(vector) {
    const length = Math.hypot(...vector);
    if (!Number.isFinite(length) || length <= 0) {
        throw new Error('Sun direction must have positive length.');
    }

    return Object.freeze(vector.map((entry) => entry / length));
}

function booleanArg(name) {
    return process.argv.includes(name);
}
