// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader must use evaluate(...).
// - tmp/atmosphere/reconciliation/154-m3-subjective-southern-france-daylight-stack,
//   superseded GPU self-mirror diagnostic.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import sharp from 'sharp';

import {
    Algorithm32ShaderAssembler,
    BrunetonColorDisplayModel,
    buildIncidentRadianceCache,
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    RUNTIME_NUMERICAL_CONTROLS,
    CanonicalAtmosphere,
    CpuPostprocessSoftShader,
    DistantSunLightSource,
    DistantSphericalShaderContributionFactory,
    DistantSphericalShaderDescriptorBuilder,
    SpectralCalculator,
    SpectralReferenceEvaluator,
    SphericalEarthGeometry,
} from '../index.js';
import { normalize } from '../math/vector.js';
import { writePng } from '../outputs/pngWriter.js';
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
const width = numberArg('--width', 320);
const height = numberArg('--height', 180);
const minutesBeforeSunset = numberArg('--minutes-before-sunset', 30);
const cpuBaselineImagePath = stringArg('--cpu-baseline-image', null);
const cpuOnly = booleanArg('--cpu-only');
const cpuGreenBoxes = booleanArg('--cpu-green-boxes');
const rawSceneOnly = booleanArg('--raw-scene-only');
const rawSceneNoGroundObject = booleanArg('--raw-scene-no-ground-object');
const solarNoon = booleanArg('--solar-noon');
const endpointRadianceScale = numberArg('--endpoint-radiance-scale', 5200);
const diagnosticGroundRadianceScale = numberArg('--diagnostic-ground-radiance-scale', 100);
const failures = [];

await appendRunLog(recordDirectory, 'm3CanonicalCpuGpuOceanComparison started.');

let sample = null;
let command = null;
let latest = null;
let cpuImagePath = null;
let gpuImagePath = null;
let sideBySidePath = null;
let pixelComparison = null;

try {
    sample = solarNoon
        ? southernFranceSolarNoonSample()
        : southernFranceMinutesBeforeSunsetSample(minutesBeforeSunset);

    if (rawSceneOnly) {
        const rawBytes = renderRawSceneImage();
        cpuImagePath = resolve(recordDirectory, 'raw-scene.png');
        await writePng(cpuImagePath, width, height, rawBytes);
        await appendRunLog(recordDirectory, 'raw scene image written without CPU/GPU shader.');
    } else if (cpuBaselineImagePath) {
        cpuImagePath = resolve(cpuBaselineImagePath);
        await appendRunLog(recordDirectory, `using existing canonical CPU baseline image ${cpuImagePath}.`);
    } else {
        const cpuBytes = await renderCanonicalCpuImage(sample);
        cpuImagePath = resolve(recordDirectory, 'canonical-cpu-evaluate.png');
        await writePng(cpuImagePath, width, height, cpuBytes);
        await appendRunLog(recordDirectory, 'canonical CPU evaluate image written.');
    }

    if (!cpuOnly && !rawSceneOnly) {
        command = makeGpuCommand(sample);
        await writeFile(COMMAND_PATH, `${JSON.stringify(command, null, 2)}\n`, 'utf8');
        await appendRunLog(recordDirectory, `submitted browser command ${command.id}.`);
        latest = await waitForWatcherResult(command.id);
        gpuImagePath = latest?.artifact?.paths?.canvasImagePath
            ?? latest?.artifact?.paths?.screenshotPath
            ?? null;

        sideBySidePath = resolve(recordDirectory, 'canonical-cpu-left-gpu-right.png');
        await writeSideBySide({ cpuImagePath, gpuImagePath, sideBySidePath });
        pixelComparison = await compareCpuGpuPixels({ cpuImagePath, gpuImagePath });
    }
} catch (error) {
    failures.push(failure('canonical-cpu-gpu-ocean-comparison-crash', error.message, { stack: error.stack }));
}

const shaderDiagnostics = latest?.result?.diagnostics?.shader ?? null;
const sceneDiagnostics = latest?.result?.diagnostics?.scene?.browserThreeScene ?? null;
const criteria = Object.freeze([
    criterion('command-submitted-pending', cpuOnly || rawSceneOnly || command?.status === 'pending'),
    criterion('watcher-completed-matching-command', cpuOnly || rawSceneOnly || latest?.command?.id === command?.id),
    criterion('watcher-marked-command-done', cpuOnly || rawSceneOnly || await commandFileIsDone(command?.id)),
    criterion('browser-job-accepted', cpuOnly || rawSceneOnly || latest?.status === 'accepted'),
    criterion('assembled-shader-compile-link-accepted', cpuOnly || rawSceneOnly || shaderDiagnostics?.status === 'accepted'),
    criterion('canonical-cpu-image-written', typeof cpuImagePath === 'string'),
    criterion('gpu-image-written', cpuOnly || rawSceneOnly || typeof gpuImagePath === 'string'),
    criterion('side-by-side-image-written', cpuOnly || rawSceneOnly || typeof sideBySidePath === 'string'),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'Canonical CPU/GPU ocean comparison criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Render the no-mesh Southern France ocean scene as a canonical CPU/GPU
comparison. The CPU side uses the public reconciliation \`evaluate(...)\`
operation and Bruneton display adapter; the GPU side uses the installed
assembled browser shader.

The CPU image is the baseline. The GPU is expected to move toward that output,
not the other way around.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-canonical-cpu-gpu-ocean-comparison',
    runner: 'm3CanonicalCpuGpuOceanComparison',
    width,
    height,
    minutesBeforeSunset,
    cpuBaselineImagePath,
    cpuOnly,
    cpuGreenBoxes,
    rawSceneOnly,
    rawSceneNoGroundObject,
    solarNoon,
    endpointRadianceScale,
    diagnosticGroundRadianceScale,
    sample,
    commandPath: COMMAND_PATH,
    watcherOutRoot: WATCHER_OUT_ROOT,
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    command: command ? summarizeCommand(command) : null,
    latestSummary: summarizeLatest(latest),
    shaderDiagnostics,
    sceneDiagnostics,
    cpuBaseline: {
        method: rawSceneOnly
            ? 'Raw scene render; direct object colors without CpuPostprocessSoftShader, evaluate(...), or GPU shader'
            : cpuBaselineImagePath
            ? 'Reused existing canonical CPU baseline image'
            : 'CpuPostprocessSoftShader with public SpectralReferenceEvaluator.evaluate(...)',
        reusedImagePath: cpuBaselineImagePath ? resolve(cpuBaselineImagePath) : null,
        display: 'BrunetonColorDisplayModel',
        sceneEndpointPolicy: cpuGreenBoxes
            ? 'green box hits use a fixed spectral diagnostic fixture; ocean hits use a fixed spectral diagnostic fixture; sky/no-hit pixels use evaluate path radiance only'
            : 'ocean hits use a fixed spectral diagnostic fixture; sky/no-hit pixels use evaluate path radiance only',
    },
    greenBoxScene: cpuGreenBoxes ? greenBoxSceneDiagnostics() : null,
    cpuGroundSamples: cpuImagePath ? await sampleImagePixels(cpuImagePath, groundSampleCoordinates()) : null,
    cpuGreenBoxSamples: cpuGreenBoxes && cpuImagePath
        ? await sampleImagePixels(cpuImagePath, greenBoxSampleCoordinates())
        : null,
    comparison: pixelComparison,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3CanonicalCpuGpuOceanComparison.js --record ${recordDirectory}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    cpuImagePath,
    gpuImagePath,
    sideBySidePath,
});
await writeText(recordDirectory, 'report.md', `# Report

Canonical CPU/GPU ocean comparison finished with status: ${status}.

- CPU baseline: \`${cpuImagePath ?? 'not-written'}\`
- GPU shader: \`${gpuImagePath ?? 'not-written'}\`
- Side-by-side: \`${sideBySidePath ?? 'not-written'}\`
- Watcher run: \`${latest?.artifact?.runDir ?? 'not-completed'}\`

The CPU image is generated through public \`evaluate(...)\`; the GPU image is
the installed assembled shader output for the same camera/time/ocean scene.
`);
await appendRunLog(recordDirectory, `m3CanonicalCpuGpuOceanComparison ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    watcherRunDir: latest?.artifact?.runDir ?? null,
    cpuOnly,
    rawSceneOnly,
    cpuImagePath,
    sideBySidePath,
}));

function makeGpuCommand(daylightSample) {
    const descriptor = new DistantSphericalShaderDescriptorBuilder().build({
        variantId: 'algorithm32-distant-spherical-canonical-cpu-gpu-ocean-comparison',
    });
    const factory = new DistantSphericalShaderContributionFactory();
    const assembly = new Algorithm32ShaderAssembler().assemble({
        descriptor,
        contributions: factory.createContributions(descriptor),
        mainRequiredSymbols: factory.mainRequiredSymbols(),
    });
    const incidentRadianceCache = buildDistantIncidentRadianceCacheForShader(daylightSample.observerLocalDirection);

    return Object.freeze({
        id: `canonical-cpu-gpu-ocean-${Date.now()}`,
        label: 'm3-canonical-cpu-gpu-ocean-comparison',
        page: 'index.html',
        entrypoint: 'runReconciliationShaderJob',
        captures: Object.freeze({
            screenshot: 'images/screenshot.png',
        }),
        status: 'pending',
        createdAt: new Date().toISOString(),
        stateGoal: 'Render GPU installed shader for canonical CPU/GPU ocean comparison.',
        payload: Object.freeze({
            jobType: 'assembled-three-scene-comparison',
            sceneId: 'southern-france-daylight-stack-2026-06-21-san-jose-no-mesh-ocean-floor-canonical-cpu-gpu',
            sceneKind: 'southern-france-daylight-stack',
            descriptorFingerprint: descriptor.fingerprint,
            sourceHash: assembly.sourceHash,
            fragmentShaderSource: assembly.fragmentShaderSource,
            viewportPixels: Object.freeze([width, height]),
            rowViewportPixels: Object.freeze([width, height]),
            renderScale: 1,
            selectedPixels: Object.freeze([]),
            comparisonMode: 'canonical-cpu-gpu-ocean-comparison',
            daylightSampleMode: 'minutes-before-sunset',
            minutesBeforeSunset,
            terrainBackend: 'southern-france-obj-diffuse',
            omitTerrainMesh: true,
            floorKind: 'ocean',
            renderDate: '2026-06-21',
            latitudeDegrees: 37.3382,
            longitudeDegrees: -121.8863,
            localSolarNoonMinutes: 789,
            timezoneOffsetMinutes: -420,
            equationOfTimeMinutes: -1.3282368002224763,
            solarDeclinationDegrees: 23.5,
            cameraWorldPositionMeters: Object.freeze([6360002, 0, 0]),
            distantSunDirection: daylightSample.observerLocalDirection,
            incidentRadianceTexture: incidentRadianceCache.shaderPayload.texture,
            incidentRadianceCache: Object.freeze({
                descriptor: incidentRadianceCache.cache.descriptor,
                coordinateCount: incidentRadianceCache.coordinateCount,
                shaderPayloadMetadata: incidentRadianceCache.shaderPayload.metadata,
                lookup: incidentRadianceCache.shaderPayload.lookup,
            }),
            groundSceneColorRgb: diagnosticOceanSceneColorRgb(),
            sceneTerminationMeters: 0,
            sceneDepthMaxMeters: 150000,
            endpointRadianceScale,
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
        angularRadiusRadians: DISTANT_SUN_CONSTANTS.angularRadiusRadians,
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

async function renderCanonicalCpuImage(daylightSample) {
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: 2,
        observerUpDirection: [1, 0, 0],
        sourceDirection: daylightSample.observerLocalDirection,
        cacheAltitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new DistantSunLightSource({
        directionToLight: daylightSample.observerLocalDirection,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
        angularRadiusRadians: DISTANT_SUN_CONSTANTS.angularRadiusRadians,
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
    const evaluator = new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: RUNTIME_NUMERICAL_CONTROLS,
    });
    const softShader = new CpuPostprocessSoftShader({
        evaluator,
        displayAdapter: new BrunetonColorDisplayModel(),
        endpointRadianceResolver,
    });
    const bytes = new Uint8Array(width * height * 4);
    const selectedStride = Math.max(1, Math.floor(height / 12));

    for (let y = 0; y < height; y += 1) {
        const pixels = [];
        for (let x = 0; x < width; x += 1) {
            pixels.push(cpuPixelInput({ x, y }));
        }
        const output = softShader.render({
            sceneInput: {
                sceneId: 'canonical-cpu-ocean-baseline',
                sourceKind: 'analytic-southern-france-ocean',
            },
            pixels,
        });
        for (const pixel of output.pixels) {
            const offset = (y * width + pixel.coordinate.x) * 4;
            const rgba = displayRgbaToByteRgba(pixel.displayRgba);
            bytes[offset] = rgba[0];
            bytes[offset + 1] = rgba[1];
            bytes[offset + 2] = rgba[2];
            bytes[offset + 3] = rgba[3];
        }
        if (y % selectedStride === 0 || y === height - 1) {
            await appendRunLog(recordDirectory, `canonical CPU render row ${y + 1}/${height}.`);
        }
    }

    return bytes;
}

function renderRawSceneImage() {
    const bytes = new Uint8Array(width * height * 4);
    const colors = Object.freeze({
        sky: Object.freeze([132, 160, 190, 255]),
        ground: Object.freeze([86, 105, 66, 255]),
        greenBox: Object.freeze([0, 220, 46, 255]),
    });

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const sceneRay = sceneRayForPixel({ x, y });
            const oceanHitDistanceMeters = rawSceneNoGroundObject
                ? null
                : intersectOceanSphere(sceneRay);
            const boxHit = cpuGreenBoxes ? intersectGreenBoxes(sceneRay) : null;
            const nearestHit = nearestSceneHit(boxHit, Number.isFinite(oceanHitDistanceMeters)
                ? Object.freeze({ distanceMeters: oceanHitDistanceMeters, spectralReferenceId: 'diagnostic-ocean-matte' })
                : null);
            const rgba = !nearestHit
                ? colors.sky
                : nearestHit.spectralReferenceId === 'diagnostic-green-box-matte'
                    ? colors.greenBox
                    : colors.ground;
            const offset = (y * width + x) * 4;
            bytes[offset] = rgba[0];
            bytes[offset + 1] = rgba[1];
            bytes[offset + 2] = rgba[2];
            bytes[offset + 3] = rgba[3];
        }
    }

    return bytes;
}

function cpuPixelInput({ x, y }) {
    const sceneRay = sceneRayForPixel({ x, y });
    const algorithmDirection = normalize([sceneRay.direction[1], sceneRay.direction[0], -sceneRay.direction[2]]);
    const oceanHitDistanceMeters = intersectOceanSphere(sceneRay);
    const boxHit = cpuGreenBoxes ? intersectGreenBoxes(sceneRay) : null;
    const nearestHit = nearestSceneHit(boxHit, Number.isFinite(oceanHitDistanceMeters)
        ? Object.freeze({ distanceMeters: oceanHitDistanceMeters, spectralReferenceId: 'diagnostic-ocean-matte' })
        : null);

    return Object.freeze({
        pixelId: `pixel-${x}-${y}`,
        coordinate: Object.freeze({ x, y }),
        ray: Object.freeze({
            origin: Object.freeze([6360002, 0, 0]),
            direction: algorithmDirection,
        }),
        sceneIntersection: nearestHit
            ? Object.freeze({
                kind: 'hit',
                distanceMeters: nearestHit.distanceMeters,
            })
            : Object.freeze({ kind: 'no-hit' }),
        endpointContribution: nearestHit
            ? Object.freeze({
                policy: 'spectrum-id-reference-radiance',
                opacity: 'opaque',
                spectralReferenceId: nearestHit.spectralReferenceId,
            })
            : null,
        pathIntervalCount: RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount,
    });
}

function sceneRayForPixel({ x, y }) {
    const camera = southernFranceCamera();
    const cameraPosition = camera.position;
    const lookAt = camera.lookAt;
    const verticalFovRadians = 62 * Math.PI / 180;
    const aspect = width / height;
    const ndcX = ((x + 0.5) / width) * 2 - 1;
    const ndcY = 1 - ((y + 0.5) / height) * 2;
    const tanY = Math.tan(verticalFovRadians * 0.5);
    const cameraDirection = normalize([ndcX * aspect * tanY, ndcY * tanY, -1]);
    const forward = normalize([
        lookAt[0] - cameraPosition[0],
        lookAt[1] - cameraPosition[1],
        lookAt[2] - cameraPosition[2],
    ]);
    const right = normalize(cross(forward, [0, 1, 0]));
    const up = normalize(cross(right, forward));
    const direction = normalize([
        right[0] * cameraDirection[0] + up[0] * cameraDirection[1] + forward[0] * -cameraDirection[2],
        right[1] * cameraDirection[0] + up[1] * cameraDirection[1] + forward[1] * -cameraDirection[2],
        right[2] * cameraDirection[0] + up[2] * cameraDirection[1] + forward[2] * -cameraDirection[2],
    ]);

    return Object.freeze({
        origin: Object.freeze(cameraPosition),
        direction,
    });
}

function intersectOceanSphere(ray) {
    const radius = 6360000;
    const center = geometryGroundCenterForSceneCamera();
    const oc = [
        ray.origin[0] - center[0],
        ray.origin[1] - center[1],
        ray.origin[2] - center[2],
    ];
    const b = dot(oc, ray.direction);
    const c = dot(oc, oc) - radius * radius;
    const discriminant = b * b - c;

    if (discriminant < 0) {
        return null;
    }

    const root = Math.sqrt(discriminant);
    const near = -b - root;
    const far = -b + root;
    const distance = near > 0 ? near : far > 0 ? far : null;

    return Number.isFinite(distance) ? distance : null;
}

function intersectGreenBoxes(ray) {
    let nearest = null;
    for (const box of greenBoxes()) {
        const distance = intersectAxisAlignedBox(ray, box.min, box.max);
        if (!Number.isFinite(distance)) {
            continue;
        }
        if (!nearest || distance < nearest.distanceMeters) {
            nearest = Object.freeze({
                id: box.id,
                distanceMeters: distance,
                spectralReferenceId: 'diagnostic-green-box-matte',
            });
        }
    }

    return nearest;
}

function intersectAxisAlignedBox(ray, min, max) {
    let tMin = -Infinity;
    let tMax = Infinity;

    for (let axis = 0; axis < 3; axis += 1) {
        const origin = ray.origin[axis];
        const direction = ray.direction[axis];
        if (Math.abs(direction) < 1e-9) {
            if (origin < min[axis] || origin > max[axis]) {
                return null;
            }
            continue;
        }

        const t1 = (min[axis] - origin) / direction;
        const t2 = (max[axis] - origin) / direction;
        tMin = Math.max(tMin, Math.min(t1, t2));
        tMax = Math.min(tMax, Math.max(t1, t2));
        if (tMin > tMax) {
            return null;
        }
    }

    if (tMax <= 0) {
        return null;
    }

    return tMin > 0 ? tMin : tMax;
}

function nearestSceneHit(...hits) {
    return hits
        .filter((hit) => hit && Number.isFinite(hit.distanceMeters))
        .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] ?? null;
}

function geometryGroundCenterForSceneCamera() {
    const cameraPosition = southernFranceCamera().position;
    const algorithmCamera = [6360002, 0, 0];

    return Object.freeze([
        cameraPosition[0] - algorithmCamera[1],
        cameraPosition[1] - algorithmCamera[0],
        cameraPosition[2] + algorithmCamera[2],
    ]);
}

function endpointRadianceResolver(endpointContribution) {
    if (endpointContribution.spectralReferenceId === 'diagnostic-ocean-matte') {
        return diagnosticOceanSpectralRadiance();
    }
    if (endpointContribution.spectralReferenceId === 'diagnostic-green-box-matte') {
        return diagnosticGreenBoxSpectralRadiance();
    }

    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => 0));
}

function diagnosticOceanSpectralRadiance() {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) => {
        const wavelength = channel.wavelengthNanometers;
        const blueGreen = Math.exp(-((wavelength - 500) ** 2) / (2 * 70 ** 2));
        const red = Math.exp(-((wavelength - 650) ** 2) / (2 * 110 ** 2));

        return diagnosticGroundRadianceScale * (0.00035 * blueGreen + 0.00008 * red);
    }));
}

function diagnosticOceanLinearSrgbRadiance() {
    return new BrunetonColorDisplayModel().radianceToLinearSrgb(diagnosticOceanSpectralRadiance());
}

function diagnosticGreenBoxSpectralRadiance() {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) => {
        const wavelength = channel.wavelengthNanometers;
        return Math.exp(-((wavelength - 530) ** 2) / (2 * 25 ** 2)) * 0.18;
    }));
}

function diagnosticOceanSceneColorRgb() {
    return Object.freeze(diagnosticOceanLinearSrgbRadiance().map((value) =>
        Math.max(0, Math.min(1, value / Math.max(endpointRadianceScale, 1)))));
}

function greenBoxes() {
    const camera = southernFranceCamera();
    const basis = southernFranceCameraBasis();
    const specs = [
        { id: 'foreground-left-green-box', distanceMeters: 4500, lateralMeters: -2200, halfSize: [450, 700, 450] },
        { id: 'foreground-right-green-box', distanceMeters: 7000, lateralMeters: 2600, halfSize: [650, 900, 650] },
        { id: 'near-left-green-box', distanceMeters: 18000, lateralMeters: -6500, halfSize: [1500, 2200, 1500] },
        { id: 'near-right-green-box', distanceMeters: 24000, lateralMeters: 8500, halfSize: [1900, 2600, 1900] },
        { id: 'mid-center-green-box', distanceMeters: 38000, lateralMeters: -1500, halfSize: [3600, 4300, 3600] },
        { id: 'back-left-green-box', distanceMeters: 57000, lateralMeters: -13500, halfSize: [6500, 7200, 6500] },
        { id: 'back-right-green-box', distanceMeters: 72000, lateralMeters: 15000, halfSize: [9000, 9800, 9000] },
    ];

    return Object.freeze(specs.map((spec) => {
        const center = [
            camera.position[0] + basis.forward[0] * spec.distanceMeters + basis.right[0] * spec.lateralMeters,
            camera.position[1] + basis.forward[1] * spec.distanceMeters + basis.right[1] * spec.lateralMeters,
            camera.position[2] + basis.forward[2] * spec.distanceMeters + basis.right[2] * spec.lateralMeters,
        ];

        return Object.freeze({
            id: spec.id,
            center: Object.freeze(center),
            halfSize: Object.freeze(spec.halfSize),
            min: Object.freeze(center.map((value, index) => value - spec.halfSize[index])),
            max: Object.freeze(center.map((value, index) => value + spec.halfSize[index])),
        });
    }));
}

function greenBoxSceneDiagnostics() {
    return Object.freeze({
        endpointSpectralReferenceId: 'diagnostic-green-box-matte',
        boxes: greenBoxes().map((box) => Object.freeze({
            id: box.id,
            center: box.center,
            halfSize: box.halfSize,
            projectedCenterPixel: projectScenePointToPixel(box.center),
        })),
    });
}

function projectScenePointToPixel(point) {
    const camera = southernFranceCamera();
    const basis = southernFranceCameraBasis();
    const relative = [
        point[0] - camera.position[0],
        point[1] - camera.position[1],
        point[2] - camera.position[2],
    ];
    const zForward = dot(relative, basis.forward);
    if (zForward <= 0) {
        return null;
    }

    const verticalFovRadians = 62 * Math.PI / 180;
    const aspect = width / height;
    const tanY = Math.tan(verticalFovRadians * 0.5);
    const ndcX = dot(relative, basis.right) / (zForward * aspect * tanY);
    const ndcY = dot(relative, basis.up) / (zForward * tanY);

    return Object.freeze({
        x: Math.round((ndcX + 1) * 0.5 * width - 0.5),
        y: Math.round((1 - ndcY) * 0.5 * height - 0.5),
    });
}

function southernFranceCamera() {
    return Object.freeze({
        position: Object.freeze([0, 900, 15800]),
        lookAt: Object.freeze([-61646.3700893115, 450, -21009.849969969167]),
    });
}

function southernFranceCameraBasis() {
    const camera = southernFranceCamera();
    const forward = normalize([
        camera.lookAt[0] - camera.position[0],
        camera.lookAt[1] - camera.position[1],
        camera.lookAt[2] - camera.position[2],
    ]);
    const right = normalize(cross(forward, [0, 1, 0]));
    const up = normalize(cross(right, forward));

    return Object.freeze({ forward, right, up });
}

async function writeSideBySide({ cpuImagePath, gpuImagePath, sideBySidePath }) {
    if (!gpuImagePath) {
        throw new Error('GPU image path is missing.');
    }
    await mkdir(resolve(recordDirectory, 'comparison'), { recursive: true });
    const gpuBuffer = await sharp(gpuImagePath)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();
    const cpuBuffer = await sharp(cpuImagePath)
        .resize(width, height, { fit: 'fill' })
        .png()
        .toBuffer();

    await sharp({
        create: {
            width: width * 2,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 1 },
        },
    })
        .composite([
            { input: cpuBuffer, left: 0, top: 0 },
            { input: gpuBuffer, left: width, top: 0 },
        ])
        .png()
        .toFile(sideBySidePath);
}

async function compareCpuGpuPixels({ cpuImagePath, gpuImagePath }) {
    if (!gpuImagePath) {
        return null;
    }
    const cpu = await sharp(cpuImagePath).raw().toBuffer({ resolveWithObject: true });
    const gpu = await sharp(gpuImagePath)
        .resize(width, height, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });
    const samples = [
        ['upper-sky', Math.floor(width * 0.5), Math.floor(height * 0.16)],
        ['horizon-center', Math.floor(width * 0.5), Math.floor(height * 0.52)],
        ['lower-ocean', Math.floor(width * 0.5), Math.floor(height * 0.78)],
    ];

    return Object.freeze(samples.map(([id, x, y]) => {
        const offset = (y * width + x) * 4;
        const cpuRgba = Array.from(cpu.data.subarray(offset, offset + 4));
        const gpuRgba = Array.from(gpu.data.subarray(offset, offset + 4));
        return Object.freeze({
            id,
            coordinate: Object.freeze({ x, y }),
            cpuRgba,
            gpuRgba,
            delta: Object.freeze(gpuRgba.map((value, index) => value - cpuRgba[index])),
        });
    }));
}

async function sampleImagePixels(imagePath, samples) {
    const image = await sharp(imagePath)
        .resize(width, height, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

    return Object.freeze(samples.map((sample) => {
        const offset = (sample.y * width + sample.x) * 4;
        return Object.freeze({
            id: sample.id,
            coordinate: Object.freeze({ x: sample.x, y: sample.y }),
            rgba: Array.from(image.data.subarray(offset, offset + 4)),
        });
    }));
}

function groundSampleCoordinates() {
    return Object.freeze([
        { id: 'upper-ground-left', x: Math.floor(width * 0.25), y: Math.floor(height * 0.49) },
        { id: 'upper-ground-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.49) },
        { id: 'upper-ground-right', x: Math.floor(width * 0.75), y: Math.floor(height * 0.49) },
        { id: 'middle-ground-left', x: Math.floor(width * 0.25), y: Math.floor(height * 0.62) },
        { id: 'middle-ground-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.62) },
        { id: 'middle-ground-right', x: Math.floor(width * 0.75), y: Math.floor(height * 0.62) },
        { id: 'lower-ground-left', x: Math.floor(width * 0.25), y: Math.floor(height * 0.84) },
        { id: 'lower-ground-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.84) },
        { id: 'lower-ground-right', x: Math.floor(width * 0.75), y: Math.floor(height * 0.84) },
    ]);
}

function greenBoxSampleCoordinates() {
    return Object.freeze(greenBoxSceneDiagnostics().boxes
        .filter((box) => box.projectedCenterPixel
            && box.projectedCenterPixel.x >= 0
            && box.projectedCenterPixel.x < width
            && box.projectedCenterPixel.y >= 0
            && box.projectedCenterPixel.y < height)
        .map((box) => Object.freeze({
            id: box.id,
            x: box.projectedCenterPixel.x,
            y: box.projectedCenterPixel.y,
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

function southernFranceMinutesBeforeSunsetSample(minutes) {
    const date = '2026-06-21';
    const latitudeDegrees = 37.3382;
    const longitudeDegrees = -121.8863;
    const declinationDegrees = 23.5;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const declinationRadians = declinationDegrees * Math.PI / 180;
    const sunriseAltitudeRadians = -0.833 * Math.PI / 180;
    const cosHourAngle = (
        Math.sin(sunriseAltitudeRadians)
        - Math.sin(latitudeRadians) * Math.sin(declinationRadians)
    ) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians));
    const sunsetHourAngleDegrees = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
    const hourAngleDegrees = sunsetHourAngleDegrees - minutes / 4;
    const pose = sphericalSolarPose({
        latitudeDegrees,
        declinationDegrees,
        hourAngleDegrees,
    });

    return Object.freeze({
        id: `01-${minutes}min-before-sunset`,
        label: `${minutes} min before sunset`,
        date,
        location: Object.freeze({ latitudeDegrees, longitudeDegrees }),
        declinationDegrees,
        hourAngleDegrees,
        localSolarTime: Object.freeze({ label: timeLabelFromMinutes(789 + Math.round(hourAngleDegrees * 4)) }),
        altitudeDegrees: pose.altitudeDegrees,
        azimuthDegrees: pose.azimuthDegrees,
        observerLocalDirection: pose.observerLocalDirection,
        sunsetHourAngleDegrees,
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
    const altitudeDegrees = altitudeRadians * 180 / Math.PI;
    const azimuthRadians = azimuthDegrees * Math.PI / 180;
    const horizontal = Math.cos(altitudeRadians);

    return Object.freeze({
        altitudeDegrees,
        azimuthDegrees,
        observerLocalDirection: Object.freeze([
            Math.sin(altitudeRadians),
            horizontal * Math.sin(azimuthRadians),
            horizontal * Math.cos(azimuthRadians),
        ]),
    });
}

function displayRgbaToByteRgba(displayRgba) {
    return Object.freeze(displayRgba.map((value) =>
        Math.max(0, Math.min(255, Math.round(value * 255)))));
}

function cross(a, b) {
    return Object.freeze([
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]);
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
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

function summarizeCommand(command) {
    return Object.freeze({
        id: command.id,
        label: command.label,
        jobType: command.payload.jobType,
        status: command.status,
        createdAt: command.createdAt,
        payload: Object.freeze({
            sceneId: command.payload.sceneId,
            sceneKind: command.payload.sceneKind,
            sourceHash: command.payload.sourceHash,
            rowViewportPixels: command.payload.rowViewportPixels,
            minutesBeforeSunset: command.payload.minutesBeforeSunset,
        }),
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
        savedArtifactNames: savedArtifactNames(value),
        wroteCanvasImage: browserArtifactSaved(value, 'images/canvas-image.png'),
        pageErrors: value.browser?.pageErrors ?? [],
        fatalErrors: value.browser?.fatalErrors ?? [],
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

function numberArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index < 0) {
        return fallback;
    }
    const value = Number(process.argv[index + 1]);
    return Number.isFinite(value) ? value : fallback;
}

function booleanArg(name) {
    return process.argv.includes(name);
}

function stringArg(name, fallback) {
    const index = process.argv.indexOf(name);
    if (index < 0 || !process.argv[index + 1]) {
        return fallback;
    }

    return process.argv[index + 1];
}
