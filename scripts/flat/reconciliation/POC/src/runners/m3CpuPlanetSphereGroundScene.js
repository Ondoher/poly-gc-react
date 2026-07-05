// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader contract.
// - tmp/atmosphere/reconciliation/199-m3-planet-sphere-ground-scene, corrected near-zero sphere view.

import { resolve } from 'node:path';

import * as THREE from 'three';

import {
    BrunetonColorDisplayModel,
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    RUNTIME_NUMERICAL_CONTROLS,
    CanonicalAtmosphere,
    CpuPostprocessSoftShader,
    DistantSunLightSource,
    SpectralCalculator,
    SpectralReferenceEvaluator,
    SphericalEarthGeometry,
    buildIncidentRadianceCache,
} from '../index.js';
import { dot, normalize } from '../math/vector.js';
import { writePng } from '../outputs/pngWriter.js';
import DEFAULT_PLANET_SPHERE_GROUND_SCENE, {
    PLANET_SPHERE_SCENE_OBJECT_NAMES,
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
const width = numberArg('--width', 160);
const height = numberArg('--height', 90);
const bottomRadiusMeters = numberArg('--bottom-radius-meters', 6360000);
const observerAltitudeMeters = numberArg('--observer-altitude-meters', 150);
const scaleDenominator = numberArg('--scale-denominator', 1000);
const verticalFovDegrees = numberArg('--vertical-fov-degrees', 35);
const sceneName = stringArg('--scene-name', DEFAULT_PLANET_SPHERE_GROUND_SCENE.name);
const requestedPlanetSceneDefinition = planetSphereSceneDefinitionByName(sceneName);
const allowShading = booleanArg('--allow-shading');
const withShadows = booleanArg('--with-shadows');
const planetSceneDefinition = planetSphereSceneDefinitionWithRenderOptions(requestedPlanetSceneDefinition, {
    allowShading,
    withShadows,
});
const rawOnly = booleanArg('--raw-only');
const endpointRadianceScale = numberArg(
    '--endpoint-radiance-scale',
    PLANET_SPHERE_SCENE_FACTS.endpointRadianceScale,
);
const incidentCacheEnabled = !process.argv.includes('--no-incident-cache');
const failures = [];
const CAPTURED_SCENE_ENDPOINT_POLICY =
    'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';
const CPU_RAYCASTER_SCENE_COLOR_POLICY = 'node-raycaster-shared-display-rgba';
const RAW_SCENE_DISPLAY_RGBA = PLANET_SPHERE_SCENE_FACTS.displayRgba;
const PLANET_GROUND_SPHERE_WIDTH_SEGMENTS = PLANET_SPHERE_SCENE_FACTS.groundSphereSegments.width;
const PLANET_GROUND_SPHERE_HEIGHT_SEGMENTS = PLANET_SPHERE_SCENE_FACTS.groundSphereSegments.height;

await appendRunLog(recordDirectory, 'm3CpuPlanetSphereGroundScene started.');

let sample = null;
let cpuImagePath = null;
let rawImagePath = null;
let renderDiagnostics = null;
let rawSceneDiagnostics = null;
let sceneDiagnostics = null;

try {
    sample = southernFranceSolarNoonSample();
    const geometry = createSphericalGeometry(sample);
    const threeScene = createPlanetSphereThreeScene(geometry, sample);
    sceneDiagnostics = Object.freeze({
        sceneFacts: PLANET_SPHERE_SCENE_FACTS,
        sceneDefinition: threeScene.sceneDefinition,
        sceneObjects: threeScene.sceneObjects,
        endpointObjectsMetadata: threeScene.endpointObjectsMetadata,
    });
    const rawRender = renderRawObjectSceneImage(threeScene);
    const rawBytes = rawRender.bytes;
    rawSceneDiagnostics = rawRender.diagnostics;
    rawImagePath = resolve(recordDirectory, 'raw-spherical-ground-object-scene.png');
    await writePng(rawImagePath, width, height, rawBytes);
    await appendRunLog(recordDirectory, 'raw spherical ground object scene image written.');

    if (!rawOnly) {
        const cpu = await renderCpuSoftShaderImage(sample, threeScene, geometry);
        cpuImagePath = resolve(recordDirectory, 'cpu-soft-shader-spherical-ground-object.png');
        await writePng(cpuImagePath, width, height, cpu.bytes);
        renderDiagnostics = cpu.diagnostics;
        await appendRunLog(recordDirectory, 'CPU soft-shader spherical ground object image written.');
    }
} catch (error) {
    failures.push(failure('cpu-planet-sphere-ground-scene-crash', error.message, { stack: error.stack }));
}

const criteria = Object.freeze([
    criterion('raw-scene-image-written', typeof rawImagePath === 'string'),
    criterion('shadow-option-implies-shading',
        !withShadows || planetSceneDefinition.lightingPolicy === 'directional-light-from-distant-sun'),
    criterion('effective-shadow-policy-recorded',
        typeof planetSceneDefinition.shadowPolicy === 'string'
            && (withShadows
                ? planetSceneDefinition.shadowPolicy === 'raycast-shadows-from-distant-sun'
                : true)),
    criterion('raw-scene-ground-color-present',
        (rawSceneDiagnostics?.colorCounts?.ground ?? 0) > 0
            || (rawSceneDiagnostics?.objectHitCounts?.['scaled-planet-size-ground-sphere'] ?? 0) > 0),
    criterion('cpu-soft-shader-image-written', rawOnly || typeof cpuImagePath === 'string'),
    criterion('cpu-soft-shader-used-evaluate',
        rawOnly || renderDiagnostics?.evaluatorKind === 'SpectralReferenceEvaluator.evaluate'),
    criterion('scene-has-hit-and-no-hit-pixels',
        rawOnly
            ? rawSceneDiagnostics?.hitPixelCount > 0 && rawSceneDiagnostics?.noHitPixelCount > 0
            : renderDiagnostics?.aggregateDiagnostics?.hitPixelCount > 0
                && renderDiagnostics?.aggregateDiagnostics?.noHitPixelCount > 0),
    criterion('spherical-object-hit-distances-finite',
        rawOnly
            ? rawSceneDiagnostics?.hitPixelCount > 0
            : renderDiagnostics?.hitDistanceSummary?.finiteCount > 0
                && renderDiagnostics?.hitDistanceSummary?.minMeters > 0),
    criterion('selected-pixels-recorded',
        rawOnly || (Array.isArray(renderDiagnostics?.selectedPixels)
            && renderDiagnostics.selectedPixels.length === selectedPixelCoordinates().length)),
    criterion('hit-pixels-use-captured-scene-endpoint-policy',
        rawOnly || (renderDiagnostics?.endpointPolicyCounts?.[CAPTURED_SCENE_ENDPOINT_POLICY] ?? 0) > 0),
    criterion('green-box-cpu-output-remains-green',
        rawOnly || greenBoxOutputIsGreen(renderDiagnostics?.objectDisplayColorSummary?.greenBoxes)),
]);

for (const entry of criteria) {
    if (entry.status !== 'accepted') {
        failures.push(failure(entry.name, 'CPU planet sphere ground scene criterion was not accepted.'));
    }
}

const status = failures.length === 0 ? 'accepted' : 'rejected';

await writeText(recordDirectory, 'state-goal.md', `# State Goal

Show that the CPU postprocess soft-shader can compose a scene with a spherical
ground object as an ordinary opaque object endpoint. The render must use the
public \`evaluate(...)\` path and must not use the browser GPU shader.
`);
await writeJson(recordDirectory, 'inputs.json', {
    stage: '3.5-cpu-spherical-ground-object-composition',
    runner: 'm3CpuPlanetSphereGroundScene',
    width,
    height,
    bottomRadiusMeters,
    observerAltitudeMeters,
    scaleDenominator,
    verticalFovDegrees,
    requestedSceneName: sceneName,
    allowShading,
    withShadows,
    endpointRadianceScale,
    incidentCacheEnabled,
    rawOnly,
    planetSceneFacts: PLANET_SPHERE_SCENE_FACTS,
    planetSceneDefinition,
    sample,
    camera: planetSphereCameraFacts(),
});
await writeJson(recordDirectory, 'provenance.json', {
    references: Object.freeze([
        'agents/topics/apps/flat/reconciliation/shader-design.md#cpu-postprocess-shader',
        'tmp/atmosphere/reconciliation/199-m3-planet-sphere-ground-scene',
        'scripts/flat/reconciliation/POC/src/three/ThreeSceneSoftShaderBridge.js',
        'scripts/flat/reconciliation/POC/src/soft-shader/CpuPostprocessSoftShader.js',
        'scripts/flat/reconciliation/POC/src/evaluation/SpectralReferenceEvaluator.js',
        'scripts/flat/local-second-order/README.md#current-reconciliation-divergence',
    ]),
});
await writeJson(recordDirectory, 'criteria-results.json', {
    status,
    criteria,
    failures,
});
await writeJson(recordDirectory, 'diagnostics.json', {
    sceneDiagnostics,
    rawSceneDiagnostics,
    renderDiagnostics,
});
await writeJson(recordDirectory, 'command.json', {
    commands: Object.freeze([{
        command: `node scripts/flat/reconciliation/POC/src/runners/m3CpuPlanetSphereGroundScene.js --record ${recordDirectory} --scene-name ${sceneName}${allowShading ? ' --allow-shading' : ''}${withShadows ? ' --with-shadows' : ''}${rawOnly ? ' --raw-only' : ''}`,
        timestamp: nowIso(),
    }]),
});
await writeJson(recordDirectory, 'result.json', {
    status,
    failureCount: failures.length,
    rawImagePath,
    cpuImagePath,
});
await writeText(recordDirectory, 'report.md', `# Report

CPU planet sphere ground scene finished with status: ${status}.

- Raw scene from Three raycaster hit classification: \`${rawImagePath ?? 'not-written'}\`
- Scene preset: \`${sceneName}\`
- Effective scene: \`${planetSceneDefinition.name}\`
- Lighting policy: \`${planetSceneDefinition.lightingPolicy}\`
- Shadow policy: \`${planetSceneDefinition.shadowPolicy}\`
- CPU soft-shader: \`${cpuImagePath ?? 'not-written'}\`
- Raw ground-color pixels: \`${rawSceneDiagnostics?.colorCounts?.ground ?? 'not-rendered'}\`
- Hit pixels: \`${renderDiagnostics?.aggregateDiagnostics?.hitPixelCount ?? rawSceneDiagnostics?.hitPixelCount ?? 'not-rendered'}\`
- No-hit pixels: \`${renderDiagnostics?.aggregateDiagnostics?.noHitPixelCount ?? rawSceneDiagnostics?.noHitPixelCount ?? 'not-rendered'}\`
- Green-box CPU average RGBA: \`${JSON.stringify(renderDiagnostics?.objectDisplayColorSummary?.greenBoxes?.averageRgba ?? null)}\`

The CPU image is rendered through \`CpuPostprocessSoftShader\`, which calls
public \`SpectralReferenceEvaluator.evaluate(...)\` for each pixel. Hit pixels
use the local-second-order
\`${CAPTURED_SCENE_ENDPOINT_POLICY}\` display-owned endpoint composition
policy; captured scene color remains outside \`evaluate(...)\`.

The raw CPU raycaster image uses \`${CPU_RAYCASTER_SCENE_COLOR_POLICY}\`.
It records shared material display colors for classified hits, then applies
the effective scene lighting and shadow policy outside \`evaluate(...)\`.
`);
await appendRunLog(recordDirectory, `m3CpuPlanetSphereGroundScene ${status} failures=${failures.length}.`);

console.log(JSON.stringify({
    status,
    recordDirectory,
    failureCount: failures.length,
    rawImagePath,
    cpuImagePath,
}));

async function renderCpuSoftShaderImage(daylightSample, threeScene, geometry) {
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
    const incidentCacheBuildResult = incidentCacheEnabled
        ? buildDistantIncidentRadianceSampling({
            geometry,
            atmosphere,
            lightSource,
            calculator,
        })
        : null;
    const evaluator = new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: RUNTIME_NUMERICAL_CONTROLS,
        incidentRadianceSampling: incidentCacheBuildResult?.incidentRadianceSampling ?? null,
    });
    const displayAdapter = new BrunetonColorDisplayModel();
    const softShader = new CpuPostprocessSoftShader({
        evaluator,
        displayAdapter,
        endpointRadianceResolver: (endpointContribution) =>
            endpointRadianceResolver(endpointContribution, {
                geometry,
                atmosphere,
                lightSource,
                calculator,
                displayAdapter,
            }),
    });
    const bytes = new Uint8Array(width * height * 4);
    const selectedStride = Math.max(1, Math.floor(height / 12));
    const selectedCoordinates = selectedPixelCoordinates();
    const selectedPixels = [];
    const hitDistances = [];
    const objectHitCounts = {};
    const objectDisplayColorAccumulators = {};
    const endpointPolicyCounts = {};
    const aggregateDiagnostics = {
        selectedPixelCount: 0,
        validPixelCount: 0,
        invalidPixelCount: 0,
        hitPixelCount: 0,
        noHitPixelCount: 0,
        warningCount: 0,
        errorCount: 0,
    };

    for (let y = 0; y < height; y += 1) {
        const pixels = [];
        for (let x = 0; x < width; x += 1) {
            pixels.push(cpuPixelInput({ x, y, threeScene }));
        }
        const output = softShader.render({
            sceneInput: {
                sceneId: 'cpu-planet-sphere-ground-object',
                sourceKind: 'three-capture',
                sourceDescriptorId: 'node-three-planet-sphere-ground-object',
                geometryDescriptorId: 'spherical-earth-geometry',
                atmosphereDescriptorId: 'canonical-atmosphere',
                lightSourceDescriptorId: 'distant-sun',
                cacheDescriptorId: incidentCacheBuildResult?.cache.descriptor.sourceKey ?? null,
                displayDescriptorId: 'bruneton-color-display',
                viewportPixels: Object.freeze([width, height]),
                metadata: Object.freeze({
                    captureSource: 'node-three-raycaster-full-frame',
                    sceneId: threeScene.sceneId,
                }),
            },
            pixels,
        });
        addAggregateDiagnostics(aggregateDiagnostics, output.aggregateDiagnostics);
        for (const pixel of output.pixels) {
            const offset = (y * width + pixel.coordinate.x) * 4;
            const rgba = displayRgbaToByteRgba(pixel.displayRgba);
            bytes[offset] = rgba[0];
            bytes[offset + 1] = rgba[1];
            bytes[offset + 2] = rgba[2];
            bytes[offset + 3] = rgba[3];
            incrementObjectDisplayColor(
                objectDisplayColorAccumulators,
                objectColorSummaryKey(pixels[pixel.coordinate.x]),
                rgba,
                pixel.coordinate,
            );
            endpointPolicyCounts[pixel.endpointPolicy] = (endpointPolicyCounts[pixel.endpointPolicy] ?? 0) + 1;

            if (pixel.sceneIntersectionKind === 'hit') {
                const sourcePixel = pixels[pixel.coordinate.x];
                hitDistances.push(sourcePixel.sceneIntersection.distanceMeters);
                incrementObjectHitCount(objectHitCounts, sourcePixel.sceneIntersection.metadata?.objectId);
            }
            if (selectedCoordinates.some((selection) =>
                selection.x === pixel.coordinate.x && selection.y === pixel.coordinate.y)) {
                selectedPixels.push(summarizeSelectedPixel(pixel, rgba));
            }
        }
        if (y % selectedStride === 0 || y === height - 1) {
            await appendRunLog(recordDirectory, `CPU soft-shader render row ${y + 1}/${height}.`);
        }
    }

    return Object.freeze({
        bytes,
        diagnostics: Object.freeze({
            evaluatorKind: 'SpectralReferenceEvaluator.evaluate',
            incidentRadianceCache: incidentCacheBuildResult
                ? Object.freeze({
                    mode: 'distant-l2',
                    coordinateCount: incidentCacheBuildResult.coordinateCount,
                    cacheDescriptor: incidentCacheBuildResult.cache.descriptor,
                    shaderPayload: incidentCacheBuildResult.cache.createShaderPayload(),
                })
                : Object.freeze({ mode: 'disabled-by-runner-option' }),
            aggregateDiagnostics: Object.freeze({ ...aggregateDiagnostics }),
            selectedPixels: Object.freeze(selectedPixels),
            hitDistanceSummary: summarizeHitDistances(hitDistances),
            objectHitCounts: Object.freeze({ ...objectHitCounts }),
            endpointPolicyCounts: Object.freeze({ ...endpointPolicyCounts }),
            objectDisplayColorSummary: summarizeObjectDisplayColors(objectDisplayColorAccumulators),
        }),
    });
}

function buildDistantIncidentRadianceSampling({ geometry, atmosphere, lightSource, calculator }) {
    const cache = lightSource.createIncidentRadianceCache({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        boundaryAltitudeMeters: geometry.configuration.cacheBoundaryAltitudeMeters,
    });

    return buildIncidentRadianceCache({
        cache,
        geometry,
        atmosphere,
        lightSource,
        calculator,
        pathIntervalCount: RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
}

function incrementObjectHitCount(objectHitCounts, objectId) {
    const key = objectId ?? 'unknown';

    objectHitCounts[key] = (objectHitCounts[key] ?? 0) + 1;
}

function addAggregateDiagnostics(target, rowDiagnostics) {
    target.selectedPixelCount += rowDiagnostics.selectedPixelCount;
    target.validPixelCount += rowDiagnostics.validPixelCount;
    target.invalidPixelCount += rowDiagnostics.invalidPixelCount;
    target.hitPixelCount += rowDiagnostics.hitPixelCount;
    target.noHitPixelCount += rowDiagnostics.noHitPixelCount;
    target.warningCount += rowDiagnostics.warningCount;
    target.errorCount += rowDiagnostics.errorCount;
}

function renderRawObjectSceneImage(threeScene) {
    const bytes = new Uint8Array(width * height * 4);
    const objectHitCounts = {};
    let hitPixelCount = 0;
    let noHitPixelCount = 0;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const capture = captureThreePixel({ x, y, threeScene });
            const rgba = capture.sceneDisplayRgba;
            const offset = (y * width + x) * 4;
            bytes[offset] = rgba[0];
            bytes[offset + 1] = rgba[1];
            bytes[offset + 2] = rgba[2];
            bytes[offset + 3] = rgba[3];

            if (capture.sceneIntersection.kind === 'hit') {
                hitPixelCount += 1;
                incrementObjectHitCount(objectHitCounts, capture.hitObjectId);
            } else {
                noHitPixelCount += 1;
            }
        }
    }

    return Object.freeze({
        bytes,
        diagnostics: summarizeRawSceneBytes(bytes, {
            objectHitCounts,
            hitPixelCount,
            noHitPixelCount,
            sceneDefinition: threeScene.sceneDefinition,
        }),
    });
}

function summarizeRawSceneBytes(bytes, hitDiagnostics) {
    const colorCounts = {
        sky: 0,
        ground: 0,
        greenBox: 0,
        other: 0,
    };

    for (let offset = 0; offset < bytes.length; offset += 4) {
        const rgba = [
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ];

        if (rgbaMatches(rgba, RAW_SCENE_DISPLAY_RGBA.sky)) {
            colorCounts.sky += 1;
        } else if (rgbaMatches(rgba, RAW_SCENE_DISPLAY_RGBA.ground)) {
            colorCounts.ground += 1;
        } else if (rgbaMatches(rgba, RAW_SCENE_DISPLAY_RGBA.greenBox)) {
            colorCounts.greenBox += 1;
        } else {
            colorCounts.other += 1;
        }
    }

    return Object.freeze({
        colorPolicy: `${CPU_RAYCASTER_SCENE_COLOR_POLICY}-${hitDiagnostics.sceneDefinition.lightingPolicy}-${hitDiagnostics.sceneDefinition.shadowPolicy}`,
        colorCounts: Object.freeze(colorCounts),
        objectHitCounts: Object.freeze({ ...hitDiagnostics.objectHitCounts }),
        hitPixelCount: hitDiagnostics.hitPixelCount,
        noHitPixelCount: hitDiagnostics.noHitPixelCount,
    });
}

function rgbaMatches(left, right) {
    return left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function cpuPixelInput({ x, y, threeScene }) {
    const capture = captureThreePixel({ x, y, threeScene });
    const hit = capture.sceneIntersection.kind === 'hit';

    return Object.freeze({
        pixelId: `pixel-${x}-${y}`,
        coordinate: Object.freeze({ x, y }),
        ray: Object.freeze({
            origin: capture.ray.origin,
            direction: capture.ray.direction,
        }),
        sceneIntersection: capture.sceneIntersection,
        endpointContribution: hit
            ? Object.freeze({
                policy: CAPTURED_SCENE_ENDPOINT_POLICY,
                opacity: 'opaque',
                capturedSceneColorDisplayRgb: byteRgbaToDisplayRgb(capture.sceneDisplayRgba),
                metadata: Object.freeze({
                    hitObjectId: capture.hitObjectId,
                    captureSource: 'node-three-raycaster',
                    endpointCompositionSource: 'scripts/flat/local-second-order/README.md current reconciliation divergence',
                }),
            })
            : null,
        pathIntervalCount: RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount,
        metadata: capture.metadata,
    });
}

function createPlanetSphereThreeScene(geometry, daylightSample) {
    const facts = planetSphereCameraFacts();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
        facts.verticalFovDegrees,
        width / height,
        facts.nearSceneUnits,
        facts.farSceneUnits,
    );
    camera.position.set(...facts.position);
    camera.lookAt(new THREE.Vector3(...facts.lookAt));
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    const endpointObjects = geometry.createThreeEndpointObjects({
        metersPerSceneUnit: scaleDenominator,
        spectralReferenceId: 'diagnostic-spherical-ground-object-matte',
        visualMaterialColor: 0x566942,
        name: 'scaled-planet-size-ground-sphere',
        widthSegments: PLANET_GROUND_SPHERE_WIDTH_SEGMENTS,
        heightSegments: PLANET_GROUND_SPHERE_HEIGHT_SEGMENTS,
    });
    const groundAlbedo = colorToLinearSrgbAlbedo(new THREE.Color(0x566942));
    const objectRenderResult = renderPlanetSceneObjects({
        scene,
        sceneDefinition: planetSceneDefinition,
        radiusSceneUnits: facts.radiusSceneUnits,
        daylightSample,
    });

    for (const object of endpointObjects.raycastObjects) {
        object.userData.linearSrgbAlbedo = groundAlbedo;
    }
    for (const object of endpointObjects.visualObjects) {
        scene.add(object);
    }
    for (const object of endpointObjects.raycastObjects) {
        scene.add(object);
    }
    scene.updateMatrixWorld(true);

    return Object.freeze({
        sceneId: 'node-three-planet-sphere-ground-object',
        geometry,
        scene,
        camera,
        meshes: Object.freeze([...objectRenderResult.raycastObjects, ...endpointObjects.raycastObjects]),
        visualObjects: endpointObjects.visualObjects,
        diagnosticObjects: objectRenderResult.visualObjects,
        sunDirection: daylightSample.observerLocalDirection,
        sceneDefinition: planetSceneDefinition,
        sceneObjects: objectRenderResult.sceneObjects,
        facts,
        endpointObjectsMetadata: endpointObjects.metadata,
    });
}

function renderPlanetSceneObjects({ scene, sceneDefinition, radiusSceneUnits, daylightSample }) {
    const visualObjects = [];
    const raycastObjects = [];
    const sceneObjects = [];

    for (const objectName of sceneDefinition.objectNames) {
        const renderer = planetSceneObjectRenderers().get(objectName);
        if (!renderer) {
            throw new Error(`No planet scene object renderer registered for ${objectName}.`);
        }
        const rendered = renderer({
            scene,
            objectName,
            objectSpec: sceneDefinition.objectSpecs?.[objectName] ?? null,
            radiusSceneUnits,
            daylightSample,
        });

        for (const object of rendered.visualObjects) {
            scene.add(object);
            visualObjects.push(object);
        }
        for (const object of rendered.raycastObjects) {
            raycastObjects.push(object);
        }
        sceneObjects.push(rendered.description);
    }

    return Object.freeze({
        visualObjects: Object.freeze(visualObjects),
        raycastObjects: Object.freeze(raycastObjects),
        sceneObjects: Object.freeze(sceneObjects),
    });
}

function planetSceneObjectRenderers() {
    return new Map([
        [PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight, renderCpuDistantSunLightObject],
        [PLANET_SPHERE_SCENE_OBJECT_NAMES.nearGreenBox, renderCpuGreenBoxObject],
        [PLANET_SPHERE_SCENE_OBJECT_NAMES.middleGreenBox, renderCpuGreenBoxObject],
        [PLANET_SPHERE_SCENE_OBJECT_NAMES.farGreenBox, renderCpuGreenBoxObject],
        [PLANET_SPHERE_SCENE_OBJECT_NAMES.veryFarGreenBox, renderCpuGreenBoxObject],
    ]);
}

function renderCpuDistantSunLightObject({ daylightSample }) {
    return Object.freeze({
        visualObjects: Object.freeze([]),
        raycastObjects: Object.freeze([]),
        description: Object.freeze({
            name: PLANET_SPHERE_SCENE_OBJECT_NAMES.distantSunLight,
            kind: 'distant-sun-light-source',
            observerLocalDirection: daylightSample.observerLocalDirection,
            renderPolicy: 'cpu-soft-renderer-light-source-only-no-three-object',
        }),
    });
}

function renderCpuGreenBoxObject({ objectName, objectSpec, radiusSceneUnits }) {
    const { centerXZ, sizeSceneUnits } = greenBoxObjectSpec(objectName, objectSpec);
    const color = RAW_SCENE_DISPLAY_RGBA.greenBox;
    const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(color[0] / 255, color[1] / 255, color[2] / 255),
    });
    const box = createDiagnosticGreenBox({
        name: objectName,
        centerXZ,
        sizeSceneUnits,
        radiusSceneUnits,
        material,
    });

    return Object.freeze({
        visualObjects: Object.freeze([box]),
        raycastObjects: Object.freeze([box]),
        description: Object.freeze({
            name: objectName,
            kind: 'diagnostic-green-box',
            renderPolicy: 'registered-scene-object-renderer',
        }),
    });
}

function greenBoxObjectSpec(objectName, objectSpec) {
    if (objectSpec?.kind !== 'diagnostic-green-box'
        || !Array.isArray(objectSpec.centerXZ)
        || objectSpec.centerXZ.length !== 2
        || !objectSpec.centerXZ.every(Number.isFinite)
        || !Number.isFinite(objectSpec.sizeSceneUnits)
        || objectSpec.sizeSceneUnits <= 0) {
        throw new Error(`Scene object ${objectName} requires a diagnostic-green-box object spec.`);
    }

    return Object.freeze({
        centerXZ: Object.freeze([...objectSpec.centerXZ]),
        sizeSceneUnits: objectSpec.sizeSceneUnits,
    });
}

function createDiagnosticGreenBox({ name, centerXZ, sizeSceneUnits, radiusSceneUnits, material }) {
    const [x, z] = centerXZ;
    const surfaceY = sphereSurfaceYAt({ x, z, radiusSceneUnits });
    const box = new THREE.Mesh(
        new THREE.BoxGeometry(sizeSceneUnits, sizeSceneUnits, sizeSceneUnits),
        material,
    );

    box.name = name;
    box.position.set(x, surfaceY + sizeSceneUnits * 0.5, z);
    box.userData.endpointKind = 'diagnostic-scene-object';
    box.userData.metersPerSceneUnit = scaleDenominator;
    box.updateMatrixWorld(true);

    return box;
}

function sphereSurfaceYAt({ x, z, radiusSceneUnits }) {
    const horizontalDistanceSquared = x * x + z * z;
    const offset = Math.sqrt(Math.max(0, radiusSceneUnits * radiusSceneUnits - horizontalDistanceSquared));

    return -radiusSceneUnits + offset;
}

function captureThreePixel({ x, y, threeScene }) {
    const ndc = new THREE.Vector2(
        ((x + 0.5) / width) * 2 - 1,
        1 - ((y + 0.5) / height) * 2,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.near = 0;
    raycaster.far = threeScene.facts.farSceneUnits;
    raycaster.setFromCamera(ndc, threeScene.camera);
    const hits = raycaster.intersectObjects(threeScene.meshes, false);
    const hit = hits.length > 0 ? hits[0] : null;
    const origin = threeScene.geometry.mapObserverLocalScenePointToModelPosition(raycaster.ray.origin, {
        metersPerSceneUnit: scaleDenominator,
    });
    const direction = threeScene.geometry.mapObserverLocalSceneDirectionToModelDirection(raycaster.ray.direction);
    const sceneNormal = hit ? resolveHitNormal(hit) : null;
    const surfaceNormal = sceneNormal
        ? threeScene.geometry.mapObserverLocalSceneDirectionToModelDirection(sceneNormal)
        : null;
    const sceneDisplayRgba = rawSceneDisplayRgbaForHit(hit, {
        sceneDefinition: threeScene.sceneDefinition,
        sceneNormal,
        sunDirection: threeScene.sunDirection,
        shadowObjects: threeScene.meshes,
    });

    return Object.freeze({
        ray: Object.freeze({ origin, direction }),
        sceneIntersection: hit
            ? Object.freeze({
                kind: 'hit',
                distanceMeters: hit.distance * scaleDenominator,
                hitPosition: threeScene.geometry.mapObserverLocalScenePointToModelPosition(hit.point, {
                    metersPerSceneUnit: scaleDenominator,
                }),
                metadata: Object.freeze({
                    objectId: hit.object?.name ?? null,
                    route: 'three-scene-object-endpoint',
                    captureSource: 'node-three-raycaster',
                    sceneUnitsToMeters: scaleDenominator,
                }),
            })
            : Object.freeze({ kind: 'no-hit' }),
        hitObjectId: hit?.object?.name ?? null,
        sceneDisplayRgba,
        linearSrgbAlbedo: hit ? resolveLinearSrgbAlbedo(hit.object) : null,
        surfaceNormal,
        metadata: Object.freeze({
            source: 'node-three-raycaster',
            ndc: Object.freeze([ndc.x, ndc.y]),
            threeRay: Object.freeze({
                origin: freezeVector3(raycaster.ray.origin),
                direction: freezeVector3(raycaster.ray.direction),
            }),
            hitDistanceSceneUnits: hit?.distance ?? null,
        }),
    });
}

function rawSceneDisplayRgbaForHit(hit, { sceneDefinition, sceneNormal, sunDirection, shadowObjects }) {
    if (!hit) {
        return RAW_SCENE_DISPLAY_RGBA.sky;
    }

    const baseRgba = hit.object?.name?.includes('green-box')
        ? RAW_SCENE_DISPLAY_RGBA.greenBox
        : RAW_SCENE_DISPLAY_RGBA.ground;

    if (sceneDefinition.lightingPolicy !== 'directional-light-from-distant-sun' || !sceneNormal) {
        return baseRgba;
    }

    const sceneSunDirection = sceneDirectionFromObserverLocalSun(normalize(sunDirection));
    const lambert = Math.max(0, sceneNormal.dot(new THREE.Vector3(...sceneSunDirection)));
    const shadowed = lambert > 0 && sceneDefinition.shadowPolicy === 'raycast-shadows-from-distant-sun'
        ? sceneHitIsShadowed({
            hit,
            sceneSunDirection,
            shadowObjects,
        })
        : false;
    const intensity = planetSceneEndpointLightFactor({ lambert, shadowed });

    return Object.freeze([
        clampByte(baseRgba[0] * intensity),
        clampByte(baseRgba[1] * intensity),
        clampByte(baseRgba[2] * intensity),
        baseRgba[3],
    ]);
}

function planetSceneEndpointLightFactor({ lambert, shadowed }) {
    const ambient = PLANET_SPHERE_SCENE_FACTS.lighting.ambientIntensity;
    const directional = PLANET_SPHERE_SCENE_FACTS.lighting.directionalIntensity * lambert * (shadowed ? 0 : 1);
    const maximum = Math.max(
        1,
        PLANET_SPHERE_SCENE_FACTS.lighting.ambientIntensity
            + PLANET_SPHERE_SCENE_FACTS.lighting.directionalIntensity,
    );

    return Math.max(0, Math.min(1, (ambient + directional) / maximum));
}

function sceneHitIsShadowed({ hit, sceneSunDirection, shadowObjects }) {
    if (!hit?.point || !Array.isArray(shadowObjects) || shadowObjects.length === 0) {
        return false;
    }

    const direction = new THREE.Vector3(...sceneSunDirection).normalize();
    const origin = hit.point.clone().addScaledVector(direction, 0.0001);
    const raycaster = new THREE.Raycaster(origin, direction, 0.0001, Infinity);
    const blockers = raycaster.intersectObjects(shadowObjects, false)
        .filter((blocker) => blocker.object !== hit.object && blocker.distance > 0.0001);

    return blockers.length > 0;
}

function sceneDirectionFromObserverLocalSun(observerLocalDirection) {
    const up = observerLocalDirection[0];
    const east = observerLocalDirection[1];
    const north = observerLocalDirection[2];
    return Object.freeze([east, up, -north]);
}

function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function resolveHitNormal(hit) {
    if (hit.normal) {
        return hit.normal.clone().normalize();
    }

    if (hit.face?.normal) {
        return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    }

    const objectPosition = new THREE.Vector3();
    objectPosition.setFromMatrixPosition(hit.object.matrixWorld);

    return new THREE.Vector3().subVectors(hit.point, objectPosition).normalize();
}

function resolveLinearSrgbAlbedo(object) {
    if (Array.isArray(object?.userData?.linearSrgbAlbedo)) {
        return Object.freeze([...object.userData.linearSrgbAlbedo]);
    }

    const material = Array.isArray(object?.material) ? object.material[0] : object?.material;
    if (material?.color) {
        return colorToLinearSrgbAlbedo(material.color);
    }

    return Object.freeze([0.5, 0.5, 0.5]);
}

function colorToLinearSrgbAlbedo(color) {
    return Object.freeze([
        clamp01(color.r),
        clamp01(color.g),
        clamp01(color.b),
    ]);
}

function freezeVector3(vector) {
    return Object.freeze([vector.x, vector.y, vector.z]);
}

function planetSphereCameraFacts() {
    const radiusSceneUnits = bottomRadiusMeters / scaleDenominator;
    const observerAltitudeSceneUnits = observerAltitudeMeters / scaleDenominator;
    const horizonDistanceSceneUnits = Math.sqrt(
        Math.max(0, (radiusSceneUnits + observerAltitudeSceneUnits) ** 2 - radiusSceneUnits ** 2),
    );
    const horizonTangentPointSceneUnits = sphereHorizonTangentPoint({
        radiusSceneUnits,
        observerAltitudeSceneUnits,
    });
    const nearSceneUnits = Math.max(0.000001, Math.min(0.01, observerAltitudeSceneUnits * 0.1));

    return Object.freeze({
        position: Object.freeze([0, observerAltitudeSceneUnits, 0]),
        lookAt: horizonTangentPointSceneUnits,
        radiusSceneUnits,
        observerAltitudeSceneUnits,
        horizonDistanceSceneUnits,
        horizonTangentPointSceneUnits,
        verticalFovDegrees,
        nearSceneUnits,
        farSceneUnits: radiusSceneUnits * 3,
    });
}

function sphereHorizonTangentPoint({ radiusSceneUnits, observerAltitudeSceneUnits }) {
    const cameraRadiusSceneUnits = radiusSceneUnits + observerAltitudeSceneUnits;
    if (!Number.isFinite(cameraRadiusSceneUnits) || cameraRadiusSceneUnits <= 0) {
        return Object.freeze([0, 0, 0]);
    }

    const radiusRatio = radiusSceneUnits / cameraRadiusSceneUnits;
    const tangentY = -radiusSceneUnits + radiusSceneUnits * radiusRatio;
    const tangentZ = -radiusSceneUnits * Math.sqrt(Math.max(0, 1 - radiusRatio * radiusRatio));

    return Object.freeze([0, tangentY, tangentZ]);
}

function createSphericalGeometry(daylightSample) {
    return new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: observerAltitudeMeters,
        observerUpDirection: [1, 0, 0],
        sourceDirection: daylightSample.observerLocalDirection,
        cacheAltitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
}

function endpointRadianceResolver(endpointContribution, context) {
    if (endpointContribution.policy === 'matte-lambertian-linear-srgb') {
        return matteLambertianEndpointRadiance(endpointContribution, context);
    }

    if (endpointContribution.spectralReferenceId === 'diagnostic-spherical-ground-object-matte') {
        return diagnosticGroundSpectralRadiance();
    }
    if (endpointContribution.spectralReferenceId === 'diagnostic-green-box-matte') {
        return diagnosticGreenBoxSpectralRadiance();
    }

    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map(() => 0));
}

function matteLambertianEndpointRadiance(endpointContribution, context) {
    const {
        geometry,
        atmosphere,
        lightSource,
        calculator,
        displayAdapter,
    } = context;
    const albedo = displayAdapter.linearSrgbAlbedoToSpectralReflectance(endpointContribution.linearSrgbAlbedo);
    const position = endpointContribution.hitPosition;
    const surfaceNormal = normalize(endpointContribution.surfaceNormal);
    const atmosphereCoordinate = geometry.resolveAtmosphereCoordinate(position);
    const sourceRelativePosition = geometry.resolveSourceRelativePosition({
        position,
        atmosphereCoordinate,
        viewDirection: surfaceNormal,
    });
    const directLighting = lightSource.sampleDirectLighting({
        sourceRelativePosition,
        atmosphereCoordinate,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
    });
    const sourcePathLimit = lightSource.resolveSourcePathLimit({
        sourceRelativePosition,
        directLighting,
    });
    const sourceAtmospherePath = geometry.resolveAtmospherePath({
        startPosition: position,
        direction: directLighting.directionToLight,
        sourcePathLimit,
        sampleCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
    const sourceOpticalDepth = atmosphere.integrateOpticalDepth(sourceAtmospherePath);
    const sourceTransmittance = directLighting.sourceTransmittance
        ?? sourceOpticalDepth.transmittance
        ?? calculator.computeSourceTransmittance(sourceOpticalDepth.opticalDepth);
    const surfaceCosine = Math.max(0, dot(surfaceNormal, directLighting.directionToLight));

    return Object.freeze(directLighting.incidentRadiance.map((radiance, index) =>
        radiance * sourceTransmittance[index] * albedo[index] * surfaceCosine / Math.PI));
}

function diagnosticGroundSpectralRadiance() {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) => {
        const wavelength = channel.wavelengthNanometers;
        const green = Math.exp(-((wavelength - 540) ** 2) / (2 * 85 ** 2));
        const red = Math.exp(-((wavelength - 650) ** 2) / (2 * 130 ** 2));

        return endpointRadianceScale * (0.00022 * green + 0.00010 * red);
    }));
}

function diagnosticGreenBoxSpectralRadiance() {
    return Object.freeze(CANONICAL_SPECTRAL_CHANNELS.map((channel) => {
        const wavelength = channel.wavelengthNanometers;
        const inGreenBand = wavelength >= 490 && wavelength <= 570;

        return inGreenBand ? endpointRadianceScale * 0.006 : 0;
    }));
}

function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

function southernFranceSolarNoonSample() {
    const latitudeDegrees = 37.3382;
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
        date: '2026-06-21',
        location: Object.freeze({ latitudeDegrees, longitudeDegrees: -121.8863 }),
        declinationDegrees,
        hourAngleDegrees,
        localSolarTime: Object.freeze({ label: '13:09' }),
        altitudeDegrees: pose.altitudeDegrees,
        azimuthDegrees: pose.azimuthDegrees,
        observerLocalDirection: pose.observerLocalDirection,
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

function selectedPixelCoordinates() {
    return Object.freeze([
        Object.freeze({ pixelId: 'upper-sky-control', x: Math.floor(width * 0.5), y: Math.floor(height * 0.18) }),
        Object.freeze({ pixelId: 'horizon-control', x: Math.floor(width * 0.5), y: Math.floor(height * 0.50) }),
        Object.freeze({ pixelId: 'lower-ground-hit', x: Math.floor(width * 0.5), y: Math.floor(height * 0.82) }),
    ]);
}

function summarizeSelectedPixel(pixel, rgba) {
    return Object.freeze({
        pixelId: pixel.pixelId,
        coordinate: pixel.coordinate,
        sceneIntersectionKind: pixel.sceneIntersectionKind,
        endpointPolicy: pixel.endpointPolicy,
        displayRgba: rgba,
        displayCompositionKind: pixel.displayComposition?.kind ?? null,
        transmittanceRgb: pixel.displayComposition?.transmittanceRgb ?? null,
        pathRadianceSample: Object.freeze(pixel.evaluationOutput.pathRadiance.inScattered.slice(0, 3)),
        transmittanceSample: Object.freeze(pixel.evaluationOutput.pathRadiance.transmittance.slice(0, 3)),
    });
}

function byteRgbaToDisplayRgb(rgba) {
    return Object.freeze([
        rgba[0] / 255,
        rgba[1] / 255,
        rgba[2] / 255,
    ]);
}

function objectColorSummaryKey(pixelInput) {
    const objectId = pixelInput.sceneIntersection?.metadata?.objectId ?? null;
    if (!objectId) {
        return 'sky';
    }
    if (objectId.includes('green-box')) {
        return 'greenBoxes';
    }

    return 'ground';
}

function incrementObjectDisplayColor(accumulators, key, rgba, coordinate) {
    const entry = accumulators[key] ?? {
        count: 0,
        sum: [0, 0, 0, 0],
        firstCoordinate: coordinate,
    };

    entry.count += 1;
    for (let index = 0; index < 4; index += 1) {
        entry.sum[index] += rgba[index];
    }
    accumulators[key] = entry;
}

function summarizeObjectDisplayColors(accumulators) {
    const summary = {};

    for (const [key, entry] of Object.entries(accumulators)) {
        summary[key] = Object.freeze({
            count: entry.count,
            averageRgba: Object.freeze(entry.sum.map((value) => value / entry.count)),
            firstCoordinate: entry.firstCoordinate,
        });
    }

    return Object.freeze(summary);
}

function greenBoxOutputIsGreen(summary) {
    if (!summary || summary.count <= 0) {
        return false;
    }

    const [red, green, blue] = summary.averageRgba;

    return green > 100 && green > red && green > blue;
}

function summarizeHitDistances(distances) {
    const finite = distances.filter(Number.isFinite);
    if (finite.length === 0) {
        return Object.freeze({
            finiteCount: 0,
            minMeters: null,
            maxMeters: null,
            averageMeters: null,
        });
    }

    return Object.freeze({
        finiteCount: finite.length,
        minMeters: Math.min(...finite),
        maxMeters: Math.max(...finite),
        averageMeters: finite.reduce((sum, value) => sum + value, 0) / finite.length,
    });
}

function displayRgbaToByteRgba(displayRgba) {
    return Object.freeze(displayRgba.map((value) =>
        Math.max(0, Math.min(255, Math.round(value * 255)))));
}

function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
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
