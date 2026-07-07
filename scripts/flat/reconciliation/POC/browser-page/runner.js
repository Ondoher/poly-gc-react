// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 3.4 browser diagnostics.
// - agents/topics/apps/flat/reconciliation/experimental-guidelines.md, GPU/browser artifact rules.

import * as THREE_RUNTIME from 'three';
import {
    benchmarkAlgorithm32ComposerScene,
    renderAlgorithm32ComposerScene,
} from './algorithm32-composer-passes.js';
import {
    CANONICAL_SPECTRAL_CHANNELS,
} from '/scripts/flat/reconciliation/POC/src/constants/consts.js';
import FlatEarthGeometry from '/scripts/flat/reconciliation/POC/src/geometry/FlatEarthGeometry.js';
import LocalSunLightSource from '/scripts/flat/reconciliation/POC/src/light/LocalSunLightSource.js';

(function installReconciliationShaderRunner() {
    const PLANET_SCENE_DISPLAY_RGBA = Object.freeze({
        sky: Object.freeze([132, 160, 190, 255]),
        ground: Object.freeze([86, 105, 66, 255]),
        greenBox: Object.freeze([0, 170, 40, 255]),
    });
    const PLANET_GROUND_SPHERE_WIDTH_SEGMENTS = 512;
    const PLANET_GROUND_SPHERE_HEIGHT_SEGMENTS = 256;
    const PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY = 4.0;
    const PLANET_SCENE_AMBIENT_TO_DIRECTIONAL_RATIO = 0.25;
    const PLANET_SCENE_AMBIENT_LIGHT_INTENSITY =
        PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY * PLANET_SCENE_AMBIENT_TO_DIRECTIONAL_RATIO;
    const PLANET_SCENE_OBJECT_NAMES = Object.freeze({
        distantSunLight: 'distant-sun-light',
        nearRedBox: 'near-red-box',
        nearGreenBox: 'near-green-box',
        middleGreenBox: 'middle-green-box',
        middleYellowBox: 'middle-yellow-box',
        farBlueBox: 'far-blue-box',
        farCyanBox: 'far-cyan-box',
        farGreenBox: 'far-green-box',
        veryFarMagentaBox: 'very-far-magenta-box',
        veryFarGreenBox: 'very-far-green-box',
        unionNearYellowBox: 'union-review-near-yellow-box',
        unionMidWhiteBox: 'union-review-mid-white-box',
        unionFarOrangeBox: 'union-review-far-orange-box',
        unionDistantCyanBox: 'union-review-distant-cyan-box',
        unionDenaliOrangeBox: 'union-review-denali-200km-orange-box',
        unionCloseSingleStoryBuildingBox: 'union-review-close-single-story-building-box',
    });
    const PLANET_SPHERE_SCENE_OBJECT_SPECS = Object.freeze({
        [PLANET_SCENE_OBJECT_NAMES.nearRedBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([-0.65, -2.0]),
            sizeSceneUnits: 0.35,
            displayRgba: Object.freeze([190, 32, 24, 255]),
            spectralCoverageHint: 'long-wavelength-red',
        }),
        [PLANET_SCENE_OBJECT_NAMES.nearGreenBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([0.1, -2.8]),
            sizeSceneUnits: 0.35,
            displayRgba: Object.freeze([0, 170, 40, 255]),
            spectralCoverageHint: 'middle-wavelength-green',
        }),
        [PLANET_SCENE_OBJECT_NAMES.middleGreenBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([1.4, -8.0]),
            sizeSceneUnits: 0.9,
            displayRgba: Object.freeze([0, 170, 40, 255]),
            spectralCoverageHint: 'middle-wavelength-green',
        }),
        [PLANET_SCENE_OBJECT_NAMES.middleYellowBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([-1.8, -11.0]),
            sizeSceneUnits: 0.75,
            displayRgba: Object.freeze([205, 170, 22, 255]),
            spectralCoverageHint: 'red-plus-green-yellow',
        }),
        [PLANET_SCENE_OBJECT_NAMES.farBlueBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([2.6, -6.0]),
            sizeSceneUnits: 0.6,
            displayRgba: Object.freeze([38, 88, 210, 255]),
            spectralCoverageHint: 'short-wavelength-blue',
        }),
        [PLANET_SCENE_OBJECT_NAMES.farCyanBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([-3.4, -24.0]),
            sizeSceneUnits: 2.0,
            displayRgba: Object.freeze([32, 178, 190, 255]),
            spectralCoverageHint: 'green-plus-blue-cyan',
        }),
        [PLANET_SCENE_OBJECT_NAMES.veryFarMagentaBox]: Object.freeze({
            kind: 'diagnostic-color-box',
            centerXZ: Object.freeze([3.15, -10.0]),
            sizeSceneUnits: 0.7,
            displayRgba: Object.freeze([178, 48, 190, 255]),
            spectralCoverageHint: 'red-plus-blue-magenta',
        }),
    });
    const PLANET_SPHERE_GROUND_SCENE = Object.freeze({
        name: 'planet-sphere-ground-solar-noon-unlit',
        objectNames: Object.freeze([
            PLANET_SCENE_OBJECT_NAMES.nearRedBox,
            PLANET_SCENE_OBJECT_NAMES.nearGreenBox,
            PLANET_SCENE_OBJECT_NAMES.middleGreenBox,
            PLANET_SCENE_OBJECT_NAMES.middleYellowBox,
            PLANET_SCENE_OBJECT_NAMES.farBlueBox,
            PLANET_SCENE_OBJECT_NAMES.farCyanBox,
            PLANET_SCENE_OBJECT_NAMES.veryFarMagentaBox,
        ]),
        objectSpecs: PLANET_SPHERE_SCENE_OBJECT_SPECS,
        groundPolicy: 'geometry-owned-spherical-ground',
        lightingPolicy: 'unlit-endpoint-color',
        shadowPolicy: 'shadows-disabled',
    });
    const pendingHostProgressPromises = [];

    installShaderHostFacade();

    window.runReconciliationShaderJob = async function runReconciliationShaderJob(payload) {
        const startedAt = performance.now();
        const command = browserCommandFromPayload(payload);
        const canvas = document.getElementById('shader-canvas');
        const gl = canvas.getContext('webgl2', {
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: true,
        });

        if (!gl) {
            return rejected(command, 'WebGL2 context is not available.');
        }

        const diagnostics = collectBrowserDiagnostics(gl, canvas);
        const job = command.type === 'assembled-three-scene-comparison'
            ? runAssembledThreeSceneComparison(gl, canvas, command, diagnostics, startedAt)
            : command.type === 'browser-planet-sphere-scene'
                ? runBrowserPlanetSphereScene(gl, canvas, command, diagnostics, startedAt)
            : command.type === 'shader-quality-performance-benchmark'
                ? runShaderQualityPerformanceBenchmark(gl, canvas, command, diagnostics, startedAt)
            : command.type === 'local-cache-texture-lookup-smoke'
                ? runLocalCacheTextureLookupSmoke(gl, canvas, command, diagnostics, startedAt)
            : command.type === 'local-flat-geometry-selected-ray-parity'
                ? runLocalFlatGeometrySelectedRayParity(gl, canvas, command, diagnostics, startedAt)
            : command.type === 'assembled-objective-scene-comparison'
                ? runAssembledObjectiveSceneComparison(gl, canvas, command, diagnostics, startedAt)
                : command.type === 'assembled-distant-spherical-smoke'
                ? runAssembledDistantSphericalSmoke(gl, canvas, command, diagnostics, startedAt)
                : runCapabilitySmoke(gl, canvas, command, diagnostics, startedAt);

        const result = await job;
        await drainHostProgress();
        await saveStandardBrowserArtifacts(result);
        return result;
    };

    function installShaderHostFacade() {
        window.shaderHost = Object.freeze({
            progress: async (progress) => {
                if (typeof window.__algorithm32HostProgress === 'function') {
                    return window.__algorithm32HostProgress(progress);
                }
                console.info(`browser-progress: ${progress?.message ?? 'Browser job progress.'}`);
                return Object.freeze({ status: 'unavailable' });
            },
            saveArtifact: async (artifact) => {
                if (typeof window.__algorithm32HostSaveArtifact === 'function') {
                    return window.__algorithm32HostSaveArtifact(artifact);
                }
                console.info(`browser-artifact: ${artifact?.name ?? 'unnamed artifact'} not saved outside watcher.`);
                return Object.freeze({ status: 'unavailable' });
            },
        });
    }

    function browserCommandFromPayload(payload) {
        const normalizedPayload = payload && typeof payload === 'object' ? payload : {};
        return Object.freeze({
            type: typeof normalizedPayload.jobType === 'string'
                ? normalizedPayload.jobType
                : 'capability-smoke',
            payload: normalizedPayload,
        });
    }

    async function saveStandardBrowserArtifacts(result) {
        if (typeof result?.imageDataUrl === 'string') {
            await window.shaderHost.saveArtifact({
                name: 'images/canvas-image.png',
                kind: 'data-url',
                data: result.imageDataUrl,
            });
        }
        if (typeof result?.preShaderSceneColorImageDataUrl === 'string') {
            await window.shaderHost.saveArtifact({
                name: 'images/pre-shader-scene-color.png',
                kind: 'data-url',
                data: result.preShaderSceneColorImageDataUrl,
            });
        }
        if (Array.isArray(result?.selectedPixels)) {
            await window.shaderHost.saveArtifact({
                name: 'selected-pixels.json',
                kind: 'json',
                data: {
                    kind: 'algorithm32-reconciliation-browser-selected-pixels',
                    selectedPixels: result.selectedPixels,
                },
            });
        }
        if (result?.diagnostics?.browser) {
            await window.shaderHost.saveArtifact({
                name: 'browser-diagnostics.json',
                kind: 'json',
                data: result.diagnostics.browser,
            });
        }
    }

    async function runBrowserPlanetSphereScene(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [640, 360];
        resizeCanvas(canvas, viewportPixels);

        const constructedScene = await constructPlanetSphereGroundScene(payload, canvas);
        const {
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
            radiusSceneUnits,
            visualObjects,
            raycastObjects,
            planetSceneDefinition,
            distantSunDirection,
            sceneObjects,
            ground,
            cameraFacts,
        } = constructedScene;
        const observerAltitudeSceneUnits = ground.userData.observerAltitudeSceneUnits;
        const colorBytes = renderSceneColorBytes({
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
        });
        const selectedPixels = readSelectedPixelsFromRgbaBytes(colorBytes, width, height);
        const imageDataUrl = dataUrlFromBottomLeftRgbaBytes({
            width,
            height,
            rgbaBytes: colorBytes,
        });
        renderer.dispose();

        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('planet-sphere-radius-finite', Number.isFinite(radiusSceneUnits) && radiusSceneUnits > 0, 'scaled sphere radius'),
            criterion('planet-sphere-camera-above-surface', observerAltitudeSceneUnits > 0, 'scaled observer altitude'),
            criterion('selected-pixel-readback-present', selectedPixels.length === 3, 'three selected pixel readbacks'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has visible RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: {
                    status: 'accepted',
                    kind: 'none',
                    note: 'Direct Three scene render; no Algorithm32 shader compiled.',
                },
                scene: {
                    kind: 'browser-planet-sphere-scene',
                    sceneDefinition: planetSceneDefinition,
                    sceneLighting: planetSceneLightingSummary(planetSceneDefinition, distantSunDirection),
                    sceneObjects,
                    meshCount: 1 + raycastObjects.length,
                    threeObjectCount: visualObjects.length,
                    raycastObjectCount: raycastObjects.length,
                    sphere: ground.userData,
                    camera: cameraFacts,
                    viewportPixels: [width, height],
                },
                canvas: {
                    width,
                    height,
                    imageDataUrlKind: 'image/png',
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function runCapabilitySmoke(gl, canvas, command, diagnostics, startedAt) {
        const shaderProgram = compileSmokeProgram(gl);
        if (shaderProgram.status === 'rejected') {
            return {
                kind: 'algorithm32-reconciliation-browser-result',
                status: 'rejected',
                command,
                diagnostics: {
                    status: 'rejected',
                    browser: diagnostics,
                    shader: shaderProgram,
                },
                selectedPixels: [],
                criteriaResults: criteriaFor({
                    diagnostics,
                    shaderProgram,
                    selectedPixels: [],
                    imageDataUrl: null,
                }),
                imageDataUrl: null,
                timings: timing(startedAt),
            };
        }

        drawSmokeTriangle(gl, shaderProgram.program);
        const selectedPixels = readSelectedPixels(gl, canvas);
        const imageDataUrl = canvas.toDataURL('image/png');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: 'accepted',
            command,
            diagnostics: {
                status: 'accepted',
                browser: diagnostics,
                shader: shaderProgram,
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: 'image/png',
                },
            },
            selectedPixels,
            criteriaResults: criteriaFor({
                diagnostics,
                shaderProgram,
                selectedPixels,
                imageDataUrl,
            }),
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function runAssembledDistantSphericalSmoke(gl, canvas, command, diagnostics, startedAt) {
        const fragmentSource = typeof command.payload.fragmentShaderSource === 'string'
            ? command.payload.fragmentShaderSource
            : '';
        const shaderProgram = compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource,
        });

        if (shaderProgram.status === 'accepted') {
            bindAssembledSmokeResources(gl, shaderProgram.program, canvas);
            drawSmokeTriangle(gl, shaderProgram.program);
        }

        const selectedPixels = shaderProgram.status === 'accepted'
            ? readSelectedPixels(gl, canvas)
            : [];
        const imageDataUrl = shaderProgram.status === 'accepted'
            ? canvas.toDataURL('image/png')
            : null;
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('assembled-fragment-source-present', fragmentSource.includes('ShaderState') && fragmentSource.includes('void main()'), 'assembled Algorithm32 fragment source'),
            criterion('assembled-shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('selected-pixel-readback-present', selectedPixels.length === 3, 'three selected pixel readbacks'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: shaderProgram,
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'assembled-distant-spherical-smoke-dummy-bindings',
                    sceneColorTexture: '2d-gradient-rgba8',
                    sceneDepthTexture: '2d-constant-rgba8',
                    sceneHitTexture: '2d-constant-mask-rgba8',
                    incidentRadianceTexture: '3d-zero-rgba32f-smoke-fallback',
                    cameraWorldPositionMeters: [6360002, 0, 0],
                    sceneTerminationMeters: 0,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function runLocalCacheTextureLookupSmoke(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const fragmentSource = typeof payload.fragmentShaderSource === 'string'
            ? payload.fragmentShaderSource
            : '';
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [16, 16];
        resizeCanvas(canvas, viewportPixels);
        const shaderProgram = compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource,
        });

        if (shaderProgram.status === 'accepted') {
            bindObjectiveSceneResources(gl, shaderProgram.program, canvas, payload);
            drawSmokeTriangle(gl, shaderProgram.program);
        }

        const selectedPixels = shaderProgram.status === 'accepted'
            ? readPayloadSelectedPixels(gl, canvas, payload.selectedPixels)
            : [];
        const imageDataUrl = shaderProgram.status === 'accepted'
            ? canvas.toDataURL('image/png')
            : null;
        const expectedTexture = payload.expectedTexture && typeof payload.expectedTexture === 'object'
            ? payload.expectedTexture
            : {};
        const expectedReadbackRgba = Array.isArray(payload.expectedReadbackRgba)
            ? payload.expectedReadbackRgba
            : null;
        const readbackToleranceBytes = Number.isFinite(payload.expectedReadbackToleranceBytes)
            ? Math.max(0, payload.expectedReadbackToleranceBytes)
            : 2;
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('local-cache-fragment-source-present',
                fragmentSource.includes('readLocalIncidentRadianceTexture')
                    && fragmentSource.includes('zSpectralGroupDepthIndex')
                    && fragmentSource.includes('LOCAL_CACHE_LOOKUP_DIAGNOSTIC_ENABLED = true'),
                'assembled local/flat cache lookup fragment source'),
            criterion('assembled-shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('local-cache-payload-uploadable',
                hasIncidentRadianceTexturePayload(payload.incidentRadianceTexture),
                'packed local incident-radiance texture payload'),
            criterion('local-cache-payload-dimensions-match',
                payload.incidentRadianceTexture?.textureId === expectedTexture.textureId
                    && payload.incidentRadianceTexture?.width === expectedTexture.width
                    && payload.incidentRadianceTexture?.height === expectedTexture.height
                    && payload.incidentRadianceTexture?.depth === expectedTexture.depth
                    && Array.isArray(payload.incidentRadianceTexture?.rgbaFloat32)
                    && payload.incidentRadianceTexture.rgbaFloat32.length === expectedTexture.uploadValueCount,
                'local texture dimensions match descriptor handoff'),
            criterion('selected-pixel-readback-present',
                selectedPixels.length === expectedSelectedPixelCount(payload.selectedPixels),
                'payload selected pixel readbacks'),
            criterion('local-cache-selected-readback-matches-expected-texel',
                expectedReadbackRgba
                    && selectedPixels.length > 0
                    && selectedPixels.every((pixel) =>
                        rgbaWithinTolerance(pixel.readbackRgba, expectedReadbackRgba, readbackToleranceBytes)),
                'diagnostic output matches expected packed local-cache texel'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: shaderProgram,
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: 'local-cache-texture-lookup-smoke',
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'local-cache-texture-lookup-bindings',
                    sceneColorTexture: payload.sceneColorTextureKind ?? '2d-gradient-rgba8',
                    sceneDepthTexture: payload.sceneDepthTextureKind ?? '2d-constant-rgba8',
                    sceneHitTexture: payload.sceneHitTextureKind ?? '2d-constant-mask-rgba8',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    expectedTexture,
                    expectedReadbackRgba,
                    readbackToleranceBytes,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function runLocalFlatGeometrySelectedRayParity(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [16, 16];
        const diagnosticRuns = Array.isArray(payload.diagnosticRuns)
            ? payload.diagnosticRuns
            : [];
        const readbackToleranceBytes = Number.isFinite(payload.expectedReadbackToleranceBytes)
            ? Math.max(0, payload.expectedReadbackToleranceBytes)
            : 2;

        resizeCanvas(canvas, viewportPixels);

        const runResults = [];
        const selectedPixels = [];
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('diagnostic-run-list-present', diagnosticRuns.length > 0, 'one or more geometry diagnostic runs'),
            criterion('local-cache-payload-uploadable',
                hasIncidentRadianceTexturePayload(payload.incidentRadianceTexture),
                'packed local incident-radiance texture payload'),
            criterion('camera-matrix-bindings-present',
                hasMatrix16(payload.inverseProjectionMatrix) && hasMatrix16(payload.inverseViewMatrix),
                'camera inverse projection/view matrices'),
        ];
        let imageDataUrl = null;

        for (const run of diagnosticRuns) {
            const runId = typeof run.runId === 'string' && run.runId.length > 0
                ? run.runId
                : `diagnostic-run-${runResults.length}`;
            const fragmentSource = typeof run.fragmentShaderSource === 'string'
                ? run.fragmentShaderSource
                : '';
            const shaderProgram = compileProgram(gl, {
                vertexSource: fullScreenVertexSource(),
                fragmentSource,
            });
            const runPayload = {
                ...payload,
                ...run,
                selectedPixels: Array.isArray(run.selectedPixels) ? run.selectedPixels : payload.selectedPixels,
                sceneDepthTexture: run.sceneDepthTexture ?? payload.sceneDepthTexture,
                sceneHitTexture: run.sceneHitTexture ?? payload.sceneHitTexture,
                sceneColorTexture: run.sceneColorTexture ?? payload.sceneColorTexture,
                incidentRadianceTexture: run.incidentRadianceTexture ?? payload.incidentRadianceTexture,
            };

            if (shaderProgram.status === 'accepted') {
                bindObjectiveSceneResources(gl, shaderProgram.program, canvas, runPayload);
                drawSmokeTriangle(gl, shaderProgram.program);
            }

            const runSelectedPixels = shaderProgram.status === 'accepted'
                ? readPayloadSelectedPixels(gl, canvas, runPayload.selectedPixels)
                : [];
            const runSelectedWithExpectations = runSelectedPixels.map((pixel) => {
                const expectedReadbackRgba = expectedDiagnosticReadback(run, pixel);
                const readbackDelta = expectedReadbackRgba
                    ? pixel.readbackRgba.map((value, index) => value - expectedReadbackRgba[index])
                    : null;

                return {
                    ...pixel,
                    runId,
                    diagnosticMode: run.diagnosticMode ?? null,
                    expectedReadbackRgba,
                    readbackDelta,
                };
            });
            const runReadbacksMatch = runSelectedWithExpectations.length === expectedSelectedPixelCount(runPayload.selectedPixels)
                && runSelectedWithExpectations.every((pixel) =>
                    pixel.expectedReadbackRgba
                    && rgbaWithinTolerance(pixel.readbackRgba, pixel.expectedReadbackRgba, readbackToleranceBytes));

            selectedPixels.push(...runSelectedWithExpectations);
            runResults.push({
                runId,
                diagnosticMode: run.diagnosticMode ?? null,
                sourceHash: run.sourceHash ?? null,
                shader: shaderProgram,
                selectedPixelCount: runSelectedWithExpectations.length,
                readbacksMatch: runReadbacksMatch,
            });
            criteriaResults.push(
                criterion(`geometry-${runId}-fragment-source-present`,
                    fragmentSource.includes('LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_ENABLED = true')
                        && fragmentSource.includes('observerDomeBoundaryDistance')
                        && fragmentSource.includes('resolveAtmospherePath'),
                    'assembled local/flat geometry diagnostic fragment source'),
                criterion(`geometry-${runId}-compile-link-accepted`,
                    shaderProgram.status === 'accepted',
                    'compile and link accepted'),
                criterion(`geometry-${runId}-selected-pixels-present`,
                    runSelectedWithExpectations.length === expectedSelectedPixelCount(runPayload.selectedPixels),
                    'payload selected pixel readbacks'),
                criterion(`geometry-${runId}-readbacks-match-cpu-reference`,
                    runReadbacksMatch,
                    `readback tolerance ${readbackToleranceBytes} byte(s)`),
            );

            if (shaderProgram.status === 'accepted') {
                imageDataUrl = canvas.toDataURL('image/png');
            }
        }

        criteriaResults.push(
            criterion('selected-pixel-readback-present',
                selectedPixels.length === diagnosticRuns.reduce((sum, run) =>
                    sum + expectedSelectedPixelCount(run.selectedPixels ?? payload.selectedPixels), 0),
                'all diagnostic selected pixel readbacks'),
            criterion('png-data-url-present',
                typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'),
                'PNG data URL'),
        );
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: {
                    kind: 'algorithm32-local-flat-geometry-selected-ray-parity',
                    runs: runResults,
                },
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: 'local-flat-geometry-selected-ray-parity',
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'local-flat-geometry-selected-ray-parity-bindings',
                    sceneColorTexture: payload.sceneColorTextureKind ?? '2d-gradient-rgba8',
                    sceneDepthTexture: payload.sceneDepthTextureKind ?? 'payload-rgba8',
                    sceneHitTexture: payload.sceneHitTextureKind ?? 'payload-mask-rgba8',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                    sceneDepthMaxMeters: payload.sceneDepthMaxMeters ?? null,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                    readbackToleranceBytes,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    async function runAssembledThreeSceneComparison(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const fragmentSource = typeof payload.fragmentShaderSource === 'string'
            ? payload.fragmentShaderSource
            : '';
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [320, 180];
        resizeCanvas(canvas, viewportPixels);

        if (payload.sceneKind === 'southern-france-daylight-stack') {
            return await runSouthernFranceDaylightStackComparison(gl, canvas, command, diagnostics, startedAt, {
                payload,
                fragmentSource,
            });
        }
        if (payload.sceneKind === 'planet-sphere-ground') {
            return await runPlanetSphereGroundComposerComparison(gl, canvas, command, diagnostics, startedAt, {
                payload,
                fragmentSource,
            });
        }
        if (payload.sceneKind === 'local-flat-ground') {
            return await runLocalFlatGroundComposerComparison(gl, canvas, command, diagnostics, startedAt, {
                payload,
                fragmentSource,
            });
        }

        const sceneCapture = payload.sceneKind === 'southern-france-solar-noon'
            ? await createSouthernFranceSolarNoonSceneCapture(payload, canvas)
            : await createBrowserThreeSceneCapture(payload, canvas);
        const shaderProgram = compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource,
        });

        if (shaderProgram.status === 'accepted') {
            bindObjectiveSceneResources(gl, shaderProgram.program, canvas, {
                ...payload,
                selectedPixels: sceneCapture.selectedPixels,
                sceneColorTexture: sceneCapture.sceneColorTexture,
                sceneDepthTexture: sceneCapture.sceneDepthTexture,
                sceneHitTexture: sceneCapture.sceneHitTexture,
                inverseProjectionMatrix: sceneCapture.inverseProjectionMatrix,
                inverseViewMatrix: sceneCapture.inverseViewMatrix,
                sceneDepthMaxMeters: sceneCapture.sceneDepthMaxMeters,
            });
            drawSmokeTriangle(gl, shaderProgram.program);
        }

        const selectedPixels = shaderProgram.status === 'accepted'
            ? readPayloadSelectedPixels(gl, canvas, sceneCapture.selectedPixels)
            : [];
        const imageDataUrl = shaderProgram.status === 'accepted'
            ? canvas.toDataURL('image/png')
            : null;
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('three-module-loaded', sceneCapture.status === 'accepted', 'browser imports local Three module'),
            criterion('three-scene-render-target-captured', sceneCapture.sceneColorTexture.rgbaBytes.some((value, index) => index % 4 !== 3 && value > 0), 'non-empty Three color render target'),
            criterion('three-hit-depth-texture-captured', sceneCapture.hitPixelCount > 0, 'raycaster hit-distance texture has at least one hit'),
            criterion('assembled-fragment-source-present', fragmentSource.includes('ShaderState') && fragmentSource.includes('void main()'), 'assembled Algorithm32 fragment source'),
            criterion('camera-matrix-bindings-present', hasMatrix16(sceneCapture.inverseProjectionMatrix) && hasMatrix16(sceneCapture.inverseViewMatrix), 'browser Three camera inverse projection/view matrices'),
            criterion('assembled-shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('incident-radiance-cache-payload-present', hasIncidentRadianceTexturePayload(payload.incidentRadianceTexture), 'packed distant incident-radiance texture payload'),
            criterion('selected-pixel-readback-present', selectedPixels.length === expectedSelectedPixelCount(sceneCapture.selectedPixels), 'payload selected pixel readbacks'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: shaderProgram,
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: payload.comparisonMode ?? null,
                    browserThreeScene: sceneCapture.summary,
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                    preShaderSceneColorImageDataUrlKind: sceneCapture.sceneColorImageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'assembled-three-scene-bindings',
                    sceneColorTexture: sceneCapture.sceneColorTexture?.purpose ?? 'three-render-target-rgba8',
                    sceneDepthTexture: 'three-raycaster-distance-rgba8',
                    sceneHitTexture: 'three-raycaster-hit-mask-rgba8',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                    sceneDepthMaxMeters: sceneCapture.sceneDepthMaxMeters,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            ...(sceneCapture.sceneColorImageDataUrl
                ? { preShaderSceneColorImageDataUrl: sceneCapture.sceneColorImageDataUrl }
                : {}),
            timings: timing(startedAt),
        };
    }

    async function runPlanetSphereGroundComposerComparison(gl, canvas, command, diagnostics, startedAt, options) {
        const payload = options.payload;
        const fragmentSource = options.fragmentSource;
        const shaderBackend = payload.shaderBackend === 'cpu' ? 'cpu' : 'gpu';
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [320, 180];
        resizeCanvas(canvas, viewportPixels);

        let constructedScene = null;
        let composerResult = null;
        let selectedPixels = [];
        let imageDataUrl = null;
        let preShaderSceneColorImageDataUrl = null;
        let distanceCapture = null;
        let colorDiagnosticCapture = null;
        let depthSummary = null;
        let runtimeError = null;

        try {
            constructedScene = await constructPlanetSphereGroundScene(payload, canvas, {
                THREE: THREE_RUNTIME,
                renderCanvas: canvas,
                context: gl,
            });
            const {
                THREE,
                renderer,
                scene,
                camera,
                width,
                height,
                radiusSceneUnits,
                scaleDenominator,
                sceneDepthMaxMeters,
                raycastObjects,
            } = constructedScene;
            distanceCapture = buildRaycasterSceneDistanceCapture({
                THREE,
                meshes: raycastObjects,
                camera,
                width,
                height,
                sceneDepthMaxMeters,
                distanceMultiplier: scaleDenominator,
            });
            depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);
            const selectedPixelSelections = planetSphereSelectedPixels(width, height);
            composerResult = renderAlgorithm32ComposerScene({
                renderer,
                scene,
                camera,
                width,
                height,
                fragmentShaderSource: fragmentSource,
                backend: shaderBackend,
                progressCallback: shaderBackend === 'cpu'
                    ? browserCpuProgressLogger(payload.sceneId ?? 'planet-sphere-ground')
                    : null,
                runtimeInput: {
                    sceneId: payload.sceneId ?? 'planet-sphere-ground',
                    width,
                    height,
                    sceneDepthBytes: distanceCapture.depthBytes,
                    sceneHitBytes: distanceCapture.hitMaskBytes,
                    sceneDepthTextureEncoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                    sceneDepthMaxMeters,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                    endpointRadianceScale: payload.endpointRadianceScale ?? 1,
                    endpointCameraDistanceScale: payload.endpointCameraDistanceScale ?? null,
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters,
                    distantSunDirection: payload.distantSunDirection,
                    inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
                    inverseViewMatrix: Array.from(camera.matrixWorld.elements),
                    incidentRadianceTexture: payload.incidentRadianceTexture,
                    incidentRadianceCache: payload.incidentRadianceCache,
                    geometryFrame: payload.geometryFrame,
                    selectedPixels: selectedPixelSelections,
                    pathIntervalCount: payload.pathIntervalCount,
                },
            });
            selectedPixels = readPayloadSelectedPixels(gl, canvas, selectedPixelSelections);
            imageDataUrl = canvas.toDataURL('image/png');
            if (composerResult.sceneColorBytes) {
                preShaderSceneColorImageDataUrl = dataUrlFromBottomLeftRgbaBytes({
                    width,
                    height,
                    rgbaBytes: composerResult.sceneColorBytes,
                });
                colorDiagnosticCapture = buildRaycasterSceneDistanceCapture({
                    THREE,
                    meshes: raycastObjects,
                    camera,
                    width,
                    height,
                    sceneDepthMaxMeters,
                    distanceMultiplier: scaleDenominator,
                    diagnosticColorBytes: composerResult.sceneColorBytes,
                });
            }
            renderer.dispose();
        } catch (error) {
            runtimeError = {
                name: error?.name ?? 'Error',
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
            };
            constructedScene?.renderer?.dispose?.();
        }

        const sceneSummary = constructedScene
            ? planetSphereComposerSceneSummary({
                constructedScene,
                composerResult,
                distanceCapture,
                colorDiagnosticCapture,
                depthSummary,
                shaderBackend,
            })
            : null;
        const selectedPixelSelections = constructedScene
            ? planetSphereSelectedPixels(constructedScene.width, constructedScene.height)
            : [];
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('three-module-loaded', Boolean(constructedScene), 'browser imports local Three module'),
            criterion('effect-composer-runtime-rendered', composerResult?.status === 'accepted', 'Three EffectComposer runtime pass rendered'),
            criterion('shader-backend-supported', shaderBackend === 'gpu' || shaderBackend === 'cpu', 'supported integrated shader backend'),
            criterion('three-scene-render-target-captured',
                composerResult?.sceneColorBytes?.some((value, index) => index % 4 !== 3 && value > 0) === true,
                'non-empty composer RenderPass read buffer'),
            criterion('three-hit-depth-texture-captured', (distanceCapture?.hitPixelCount ?? 0) > 0, 'raycaster hit-distance texture has at least one hit'),
            criterion('assembled-fragment-source-present',
                shaderBackend === 'cpu' || (fragmentSource.includes('ShaderState') && fragmentSource.includes('void main()')),
                'assembled Algorithm32 fragment source'),
            criterion('camera-matrix-bindings-present',
                hasMatrix16(constructedScene?.camera?.projectionMatrixInverse?.elements ? Array.from(constructedScene.camera.projectionMatrixInverse.elements) : null)
                    && hasMatrix16(constructedScene?.camera?.matrixWorld?.elements ? Array.from(constructedScene.camera.matrixWorld.elements) : null),
                'browser Three camera inverse projection/view matrices'),
            criterion('integrated-shader-backend-accepted',
                composerResult?.diagnostics?.status === 'accepted', 'integrated CPU/GPU composer shader pass accepted'),
            criterion('incident-radiance-cache-payload-present', hasIncidentRadianceTexturePayload(payload.incidentRadianceTexture), 'packed distant incident-radiance texture payload'),
            criterion('cpu-composer-pass-used-evaluate',
                shaderBackend !== 'cpu' || composerResult?.diagnostics?.evaluatorKind === 'SpectralReferenceEvaluator.evaluate',
                'CPU composer pass calls public evaluator'),
            criterion('selected-pixel-readback-present', selectedPixels.length === expectedSelectedPixelCount(selectedPixelSelections), 'payload selected pixel readbacks'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = !runtimeError && criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: {
                    kind: `algorithm32-${shaderBackend}-effect-composer-pass`,
                    status: composerResult?.diagnostics?.status ?? 'rejected',
                    backend: shaderBackend,
                    descriptorFingerprint: payload.descriptorFingerprint ?? null,
                    sourceHash: payload.sourceHash ?? null,
                    shaderQualityProfile: payload.shaderQualityProfile ?? null,
                    composer: composerResult?.diagnostics ?? null,
                    runtimeError,
                },
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: constructedScene ? [constructedScene.width, constructedScene.height] : [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: payload.comparisonMode ?? null,
                    browserThreeScene: sceneSummary,
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                    preShaderSceneColorImageDataUrlKind: preShaderSceneColorImageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'algorithm32-effect-composer-bindings',
                    shaderBackend,
                    sceneColorTexture: 'EffectComposer RenderPass readBuffer.texture',
                    sceneDepthTexture: 'constructed-scene-raycaster-distance-rgba8',
                    sceneHitTexture: 'constructed-scene-raycaster-hit-mask-rgba8',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    shaderQualityProfile: payload.shaderQualityProfile ?? null,
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                    sceneDepthMaxMeters: constructedScene?.sceneDepthMaxMeters ?? null,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            ...(preShaderSceneColorImageDataUrl
                ? { preShaderSceneColorImageDataUrl }
                : {}),
            timings: timing(startedAt),
        };
    }

    async function runLocalFlatGroundComposerComparison(gl, canvas, command, diagnostics, startedAt, options) {
        const payload = options.payload;
        const fragmentSource = options.fragmentSource;
        const shaderBackend = payload.shaderBackend === 'cpu' ? 'cpu' : 'gpu';
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [96, 54];
        resizeCanvas(canvas, viewportPixels);

        let constructedScene = null;
        let composerResult = null;
        let selectedPixels = [];
        let imageDataUrl = null;
        let preShaderSceneColorImageDataUrl = null;
        let distanceCapture = null;
        let colorDiagnosticCapture = null;
        let depthSummary = null;
        let runtimeError = null;
        let selectedPixelSelections = [];

        try {
            constructedScene = await constructLocalFlatGroundScene(payload, canvas, {
                THREE: THREE_RUNTIME,
                renderCanvas: canvas,
                context: gl,
            });
            const {
                THREE,
                renderer,
                scene,
                camera,
                width,
                height,
                metersPerSceneUnit,
                sceneDepthMaxMeters,
                raycastObjects,
                cameraWorldPositionMeters,
                geometryFrame,
                localFlat,
            } = constructedScene;
            const raycastCaptureOptions = localFlat.farHorizonReviewBoxEnabled === true
                || localFlat.denaliReviewBoxEnabled === true
                ? {
                    raycastSampleOffsets: subpixelGridSampleOffsets(5),
                    preferNonGroundSampleHits: true,
                }
                : {};
            distanceCapture = buildLocalFlatSceneDistanceCapture({
                THREE,
                renderer,
                scene,
                camera,
                raycastObjects,
                width,
                height,
                sceneDepthMaxMeters,
                metersPerSceneUnit,
                capturePolicy: localFlat.sceneDepthCapturePolicy,
                raycastCaptureOptions,
            });
            depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);
            selectedPixelSelections = localFlatSelectedPixels(width, height, distanceCapture);
            composerResult = renderAlgorithm32ComposerScene({
                renderer,
                scene,
                camera,
                width,
                height,
                fragmentShaderSource: fragmentSource,
                backend: shaderBackend,
                renderTargetSamples: constructedScene.renderQualityFacts?.renderTargetSampleCount ?? undefined,
                progressCallback: shaderBackend === 'cpu'
                    ? browserCpuProgressLogger(payload.sceneId ?? 'local-flat-ground')
                    : null,
                runtimeInput: {
                    sceneId: payload.sceneId ?? 'local-flat-ground',
                    width,
                    height,
                    geometryKind: 'flat-earth',
                    lightSourceKind: 'local-sun',
                    sceneDepthBytes: distanceCapture.depthBytes,
                    sceneHitBytes: distanceCapture.hitMaskBytes,
                    sceneDepthTextureEncoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                    sceneDepthMaxMeters,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                    endpointRadianceScale: payload.endpointRadianceScale ?? 1,
                    endpointCameraDistanceScale: payload.endpointCameraDistanceScale ?? null,
                    cameraWorldPositionMeters,
                    distantSunDirection: [0, 0, 1],
                    inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
                    inverseViewMatrix: Array.from(camera.matrixWorld.elements),
                    incidentRadianceTexture: payload.incidentRadianceTexture,
                    incidentRadianceCache: null,
                    geometryFrame,
                    localFlat,
                    selectedPixels: selectedPixelSelections,
                    pathIntervalCount: payload.pathIntervalCount,
                    sourceTransmittanceIntervalCount: payload.sourceTransmittanceIntervalCount,
                    outputTextureFilter: constructedScene.renderQualityFacts?.cpuOutputTextureFilter === 'nearest-display-copy'
                        ? 'nearest'
                        : 'linear',
                },
            });
            selectedPixels = readPayloadSelectedPixels(gl, canvas, selectedPixelSelections);
            imageDataUrl = canvas.toDataURL('image/png');
            if (composerResult.sceneColorBytes) {
                preShaderSceneColorImageDataUrl = dataUrlFromBottomLeftRgbaBytes({
                    width,
                    height,
                    rgbaBytes: composerResult.sceneColorBytes,
                });
                colorDiagnosticCapture = buildRaycasterSceneDistanceCapture({
                    THREE,
                    meshes: raycastObjects,
                    camera,
                    width,
                    height,
                    sceneDepthMaxMeters,
                    distanceMultiplier: metersPerSceneUnit,
                    diagnosticColorBytes: composerResult.sceneColorBytes,
                    ...raycastCaptureOptions,
                });
            }
            renderer.dispose();
        } catch (error) {
            runtimeError = {
                name: error?.name ?? 'Error',
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
            };
            constructedScene?.renderer?.dispose?.();
        }

        const sceneSummary = constructedScene
            ? localFlatComposerSceneSummary({
                constructedScene,
                composerResult,
                distanceCapture,
                colorDiagnosticCapture,
                depthSummary,
                shaderBackend,
            })
            : null;
        const cpuSelectedDiagnostics = composerResult?.diagnostics?.selectedPixels ?? [];
        const localFlatSceneObjects = sceneSummary?.sceneObjects ?? {};
        const localFlatDiagnosticBoxNames = Object.keys(localFlatSceneObjects)
            .filter((name) => localFlatSceneObjects[name]?.kind === 'diagnostic-flat-box');
        const localFlatReviewBoxNames = Object.keys(localFlatSceneObjects)
            .filter((name) => localFlatSceneObjects[name]?.kind === 'review-flat-box');
        const minimumDiagnosticBoxHitCount = Math.max(
            0,
            Math.floor(numberOrDefault(payload.minimumDiagnosticBoxHitCount, 5)),
        );
        const localFlatHitDiagnosticBoxNames = localFlatDiagnosticBoxNames.filter((name) =>
            (sceneSummary?.objectHitCounts?.[name] ?? 0) > 0);
        const localFlatHitReviewBoxNames = localFlatReviewBoxNames.filter((name) =>
            (sceneSummary?.objectHitCounts?.[name] ?? 0) > 0);
        const shadowsExpected = payload.shadowsEnabled !== false;
        const farHorizonReviewBoxExpected = payload.localFlat?.farHorizonReviewBoxEnabled === true;
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('three-module-loaded', Boolean(constructedScene), 'browser imports local Three module'),
            criterion('effect-composer-runtime-rendered', composerResult?.status === 'accepted', 'Three EffectComposer runtime pass rendered'),
            criterion('three-scene-render-target-captured',
                composerResult?.sceneColorBytes?.some((value, index) => index % 4 !== 3 && value > 0) === true,
                'non-empty composer RenderPass read buffer'),
            criterion('three-hit-depth-texture-captured', (distanceCapture?.hitPixelCount ?? 0) > 0, 'scene hit-distance texture has at least one hit'),
            criterion('three-no-hit-sky-pixels-present',
                (distanceCapture?.hitPixelCount ?? 0) < (constructedScene?.width ?? 0) * (constructedScene?.height ?? 0),
                'scene hit capture leaves at least one no-hit sky pixel'),
            criterion('camera-matrix-bindings-present',
                hasMatrix16(constructedScene?.camera?.projectionMatrixInverse?.elements ? Array.from(constructedScene.camera.projectionMatrixInverse.elements) : null)
                    && hasMatrix16(constructedScene?.camera?.matrixWorld?.elements ? Array.from(constructedScene.camera.matrixWorld.elements) : null),
                'browser Three camera inverse projection/view matrices'),
            criterion('shader-backend-supported',
                shaderBackend === 'cpu' || shaderBackend === 'gpu',
                'local flat verification uses an integrated composer shader backend'),
            criterion('integrated-shader-backend-accepted',
                composerResult?.diagnostics?.status === 'accepted', 'integrated composer shader pass accepted'),
            criterion('cpu-composer-pass-used-evaluate',
                shaderBackend !== 'cpu'
                    || composerResult?.diagnostics?.evaluatorKind === 'SpectralReferenceEvaluator.evaluate',
                'CPU composer pass calls public evaluator when CPU backend is selected'),
            criterion('input-contract-is-flat-local',
                composerResult?.diagnostics?.inputContract?.geometryKind === 'flat-earth'
                    && composerResult?.diagnostics?.inputContract?.lightSourceKind === 'local-sun',
                'composer input contract reports flat geometry and local Sun'),
            criterion(shadowsExpected ? 'local-flat-shadows-enabled' : 'local-flat-shadows-disabled',
                shadowsExpected
                    ? sceneSummary?.shadowPolicy === 'three-shadow-map-from-local-source-direction'
                        && sceneSummary?.sceneLighting?.shadowPolicy === 'three-shadow-map-from-local-source-direction'
                    : sceneSummary?.shadowPolicy === 'shadows-disabled'
                        && sceneSummary?.sceneLighting?.shadowPolicy === 'shadows-disabled',
                shadowsExpected
                    ? 'local flat scene uses source-owned Three shadow map lighting'
                    : 'local flat scene keeps source-owned shading but disables Three shadow maps'),
            criterion('local-l2-cache-used',
                shaderBackend === 'cpu'
                    ? composerResult?.diagnostics?.incidentRadianceCache?.mode === 'local-l2-cache-sampler'
                        && composerResult?.diagnostics?.incidentRadianceCache?.cacheKind === 'local'
                        && composerResult?.diagnostics?.incidentRadianceCache?.coordinateCount > 0
                    : composerResult?.diagnostics?.inputContract?.incidentRadianceTexture?.kind === 'rgba32f-3d-texture-v1'
                        && composerResult?.diagnostics?.inputContract?.incidentRadianceTexture?.uploadValueCount > 0,
                'local L2 incident-radiance cache built/bound for CPU or uploaded for GPU'),
            criterion('flat-geometry-ground-owned-by-abstraction',
                sceneSummary?.ground?.metadata?.owner === 'FlatEarthGeometry'
                    && sceneSummary?.ground?.metadata?.observerLocalSceneFrame,
                'flat geometry returned ground endpoint and frame metadata'),
            criterion('local-flat-diagnostic-boxes-hit',
                localFlatDiagnosticBoxNames.length >= minimumDiagnosticBoxHitCount
                    && localFlatHitDiagnosticBoxNames.length >= minimumDiagnosticBoxHitCount,
                `${minimumDiagnosticBoxHitCount} or more local-flat diagnostic boxes have raycast hit pixels`),
            criterion('far-horizon-review-box-hit',
                !farHorizonReviewBoxExpected
                    || (localFlatReviewBoxNames.length > 0
                        && localFlatReviewBoxNames.every((name) => localFlatHitReviewBoxNames.includes(name))),
                'optional far-horizon review boxes have raycast hit pixels when requested'),
            criterion('selected-pixel-readback-present', selectedPixels.length === expectedSelectedPixelCount(selectedPixelSelections), 'payload selected pixel readbacks'),
            criterion('cpu-selected-pixel-diagnostics-present',
                shaderBackend !== 'cpu'
                    || cpuSelectedDiagnostics.length === expectedSelectedPixelCount(selectedPixelSelections),
                'CPU pass selected-pixel diagnostics when CPU backend is selected'),
            criterion('local-sun-path-radiance-positive',
                shaderBackend !== 'cpu'
                    || cpuSelectedDiagnostics.some((pixel) => pixel.pathRadianceMean > 0),
                'at least one selected CPU pixel has positive local-sun path radiance'),
            criterion('selected-pixel-incident-inscattering-positive',
                shaderBackend !== 'cpu'
                    || cpuSelectedDiagnostics.some((pixel) => pixel.incidentInScatteringMean > 0),
                'at least one selected CPU pixel has positive L2 incident in-scattering'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = !runtimeError && criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: {
                    kind: `algorithm32-${shaderBackend}-effect-composer-pass`,
                    status: composerResult?.diagnostics?.status ?? 'rejected',
                    backend: shaderBackend,
                    composer: composerResult?.diagnostics ?? null,
                    runtimeError,
                },
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: constructedScene ? [constructedScene.width, constructedScene.height] : [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: payload.comparisonMode ?? null,
                    browserThreeScene: sceneSummary,
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                    preShaderSceneColorImageDataUrlKind: preShaderSceneColorImageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'algorithm32-effect-composer-bindings',
                    shaderBackend,
                    sceneColorTexture: 'EffectComposer RenderPass readBuffer.texture',
                    sceneDepthTexture: `${distanceCapture?.capturePolicy ?? 'unknown'}-distance-rgba8`,
                    sceneHitTexture: `${distanceCapture?.capturePolicy ?? 'unknown'}-hit-mask-rgba8`,
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    cameraWorldPositionMeters: constructedScene?.cameraWorldPositionMeters ?? null,
                    sceneDepthMaxMeters: constructedScene?.sceneDepthMaxMeters ?? null,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            ...(preShaderSceneColorImageDataUrl
                ? { preShaderSceneColorImageDataUrl }
                : {}),
            timings: timing(startedAt),
        };
    }

    async function runShaderQualityPerformanceBenchmark(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [320, 180];
        const benchmarkOptions = normalizePerformanceBenchmarkOptions(payload.performanceBenchmark);
        const profileBenchmarks = Array.isArray(payload.profileBenchmarks)
            ? payload.profileBenchmarks
            : [];
        resizeCanvas(canvas, viewportPixels);

        let constructedScene = null;
        let distanceCapture = null;
        let depthSummary = null;
        let benchmarkArtifact = null;
        let benchmarkArtifactSave = null;
        let selectedPixels = [];
        let imageDataUrl = null;
        let runtimeError = null;

        try {
            constructedScene = await constructPlanetSphereGroundScene(payload, canvas, {
                THREE: THREE_RUNTIME,
                renderCanvas: canvas,
                context: gl,
            });
            const {
                THREE,
                renderer,
                scene,
                camera,
                width,
                height,
                scaleDenominator,
                sceneDepthMaxMeters,
                raycastObjects,
            } = constructedScene;
            distanceCapture = buildRaycasterSceneDistanceCapture({
                THREE,
                meshes: raycastObjects,
                camera,
                width,
                height,
                sceneDepthMaxMeters,
                distanceMultiplier: scaleDenominator,
            });
            depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);

            const selectedPixelSelections = planetSphereSelectedPixels(width, height);
            const commonRuntimeInput = {
                sceneId: payload.sceneId ?? 'planet-sphere-ground-performance-benchmark',
                width,
                height,
                sceneDepthBytes: distanceCapture.depthBytes,
                sceneHitBytes: distanceCapture.hitMaskBytes,
                sceneDepthTextureEncoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                sceneDepthMaxMeters,
                sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                endpointRadianceScale: payload.endpointRadianceScale ?? 1,
                endpointCameraDistanceScale: payload.endpointCameraDistanceScale ?? null,
                cameraWorldPositionMeters: payload.cameraWorldPositionMeters,
                distantSunDirection: payload.distantSunDirection,
                inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
                inverseViewMatrix: Array.from(camera.matrixWorld.elements),
                geometryFrame: payload.geometryFrame,
                selectedPixels: selectedPixelSelections,
            };
            const profileResults = [];

            for (const profileBenchmark of profileBenchmarks) {
                const profileId = profileBenchmark?.shaderQualityProfile?.id
                    ?? profileBenchmark?.profileId
                    ?? 'unknown-profile';
                queueHostProgress(window.shaderHost.progress({
                    message: `GPU performance benchmark ${profileId} started.`,
                    detail: {
                        profileId,
                        runCount: benchmarkOptions.runCount,
                        warmupRunCount: benchmarkOptions.warmupRunCount,
                    },
                }));

                const benchmarkResult = await benchmarkAlgorithm32ComposerScene({
                    renderer,
                    scene,
                    camera,
                    width,
                    height,
                    fragmentShaderSource: profileBenchmark.fragmentShaderSource,
                    runtimeInput: {
                        ...commonRuntimeInput,
                        incidentRadianceTexture: profileBenchmark.incidentRadianceTexture,
                        incidentRadianceCache: profileBenchmark.incidentRadianceCache,
                        pathIntervalCount: profileBenchmark.pathIntervalCount,
                    },
                    runCount: benchmarkOptions.runCount,
                    warmupRunCount: benchmarkOptions.warmupRunCount,
                    yieldEvery: benchmarkOptions.yieldEvery,
                    yieldMs: benchmarkOptions.yieldMs,
                    forceGpuFinish: benchmarkOptions.forceGpuFinish,
                    progressCallback: browserGpuBenchmarkProgressLogger(profileId),
                });

                profileResults.push(Object.freeze({
                    profileId,
                    shaderQualityProfile: profileBenchmark.shaderQualityProfile ?? null,
                    descriptorFingerprint: profileBenchmark.descriptorFingerprint ?? null,
                    sourceHash: profileBenchmark.sourceHash ?? null,
                    benchmark: benchmarkResult,
                    throughput: throughputSummary(width, height, benchmarkResult.summary),
                }));
                await browserDelay(benchmarkOptions.profileYieldMs);
            }

            benchmarkArtifact = Object.freeze({
                kind: 'algorithm32-shader-quality-performance-benchmark-v1',
                clock: 'performance.now',
                timingScope: 'EffectComposer RenderPass plus Algorithm32 GPU pass; setup/cache construction excluded; diagnostic readbacks disabled during measured runs',
                forceGpuFinish: benchmarkOptions.forceGpuFinish,
                viewportPixels: Object.freeze([width, height]),
                runCount: benchmarkOptions.runCount,
                warmupRunCount: benchmarkOptions.warmupRunCount,
                yieldEvery: benchmarkOptions.yieldEvery,
                yieldMs: benchmarkOptions.yieldMs,
                profileYieldMs: benchmarkOptions.profileYieldMs,
                sceneDepthSummary: depthSummary,
                profiles: Object.freeze(addRelativePerformance(profileResults)),
            });
            benchmarkArtifactSave = await window.shaderHost.saveArtifact({
                name: 'performance/benchmark-results.json',
                kind: 'json',
                data: benchmarkArtifact,
            });
            selectedPixels = readPayloadSelectedPixels(gl, canvas, selectedPixelSelections);
            imageDataUrl = canvas.toDataURL('image/png');
            renderer.dispose();
        } catch (error) {
            runtimeError = {
                name: error?.name ?? 'Error',
                message: error?.message ?? String(error),
                stack: error?.stack ?? null,
            };
            constructedScene?.renderer?.dispose?.();
        }

        const allProfilesAccepted = Array.isArray(benchmarkArtifact?.profiles)
            && benchmarkArtifact.profiles.length === profileBenchmarks.length
            && benchmarkArtifact.profiles.every((entry) => entry.benchmark?.status === 'accepted');
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('profile-benchmarks-present', profileBenchmarks.length > 0, 'one or more profiles to benchmark'),
            criterion('three-module-loaded', Boolean(constructedScene), 'browser imports local Three module'),
            criterion('three-hit-depth-texture-captured', (distanceCapture?.hitPixelCount ?? 0) > 0, 'raycaster hit-distance texture has at least one hit'),
            criterion('all-profile-benchmarks-accepted', allProfilesAccepted, 'all profile benchmark loops completed'),
            criterion('benchmark-run-counts-present',
                benchmarkArtifact?.profiles?.every((entry) => entry.benchmark?.summary?.count === benchmarkOptions.runCount) === true,
                'each profile has requested measured run count'),
            criterion('benchmark-artifact-saved', benchmarkArtifactSave?.status === 'accepted', 'performance artifact saved through watcher host'),
            criterion('selected-pixel-readback-present',
                selectedPixels.length === expectedSelectedPixelCount(constructedScene ? planetSphereSelectedPixels(constructedScene.width, constructedScene.height) : []),
                'final benchmark canvas selected pixel readbacks'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = !runtimeError && criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: {
                    kind: 'algorithm32-gpu-quality-performance-benchmark',
                    status: accepted ? 'accepted' : 'rejected',
                    backend: 'gpu',
                    runtimeError,
                },
                performanceBenchmark: benchmarkArtifact,
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: constructedScene ? [constructedScene.width, constructedScene.height] : [canvas.width, canvas.height],
                    comparisonMode: payload.comparisonMode ?? null,
                    browserThreeScene: constructedScene
                        ? planetSphereComposerSceneSummary({
                            constructedScene,
                            composerResult: null,
                            distanceCapture,
                            colorDiagnosticCapture: null,
                            depthSummary,
                            shaderBackend: 'gpu',
                        })
                        : null,
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function browserCpuProgressLogger(sceneId) {
        return (progress) => {
            const detail = {
                ...progress,
                sceneId,
            };
            queueHostProgress(window.shaderHost.progress({
                message: formatBrowserCpuProgressMessage(progress),
                detail,
            }));
        };
    }

    function browserGpuBenchmarkProgressLogger(profileId) {
        return (progress) => {
            queueHostProgress(window.shaderHost.progress({
                message: formatBrowserGpuBenchmarkProgressMessage(profileId, progress),
                detail: {
                    ...progress,
                    profileId,
                },
            }));
        };
    }

    function queueHostProgress(progressPromise) {
        pendingHostProgressPromises.push(Promise.resolve(progressPromise).catch((error) => {
            console.warn(`browser progress failed: ${error?.message ?? String(error)}`);
        }));
    }

    async function drainHostProgress() {
        while (pendingHostProgressPromises.length > 0) {
            const batch = pendingHostProgressPromises.splice(0);
            await Promise.all(batch);
        }
    }

    function formatBrowserCpuProgressMessage(progress) {
        const percent = Number.isFinite(progress.percent) ? progress.percent : 0;
        const completedRows = Number.isFinite(progress.completedRows) ? progress.completedRows : 0;
        const totalRows = Number.isFinite(progress.totalRows) ? progress.totalRows : 0;
        const elapsedMs = Number.isFinite(progress.elapsedMs) ? Math.round(progress.elapsedMs) : 0;

        return `CPU composer shader rows ${completedRows}/${totalRows} (${percent}%) elapsed=${elapsedMs}ms`;
    }

    function formatBrowserGpuBenchmarkProgressMessage(profileId, progress) {
        const percent = Number.isFinite(progress.percent) ? progress.percent : 0;
        const completedRuns = Number.isFinite(progress.completedRuns) ? progress.completedRuns : 0;
        const runCount = Number.isFinite(progress.runCount) ? progress.runCount : 0;
        const elapsedMs = Number.isFinite(progress.elapsedMs) ? Math.round(progress.elapsedMs) : 0;

        return `GPU benchmark ${profileId} runs ${completedRuns}/${runCount} (${percent}%) elapsed=${elapsedMs}ms`;
    }

    function normalizePerformanceBenchmarkOptions(value) {
        const options = value && typeof value === 'object' ? value : {};

        return Object.freeze({
            runCount: clampInteger(options.runCount, 1, 10000),
            warmupRunCount: clampInteger(options.warmupRunCount, 0, 1000),
            yieldEvery: clampInteger(options.yieldEvery, 1, 10000),
            yieldMs: Math.max(0, numberOrDefault(options.yieldMs, 10)),
            profileYieldMs: Math.max(0, numberOrDefault(options.profileYieldMs, 50)),
            forceGpuFinish: options.forceGpuFinish !== false,
        });
    }

    function throughputSummary(width, height, durationSummary) {
        const pixels = width * height;
        const meanMs = durationSummary?.meanMs ?? 0;

        return Object.freeze({
            pixelsPerFrame: pixels,
            megapixelsPerSecondAtMean: meanMs > 0 ? pixels / (meanMs * 1000) : 0,
        });
    }

    function addRelativePerformance(profileResults) {
        const ideal = profileResults.find((entry) => entry.profileId === 'ideal') ?? profileResults[0];
        const idealMeanMs = ideal?.benchmark?.summary?.meanMs ?? null;

        return Object.freeze(profileResults.map((entry) => Object.freeze({
            ...entry,
            relativeToIdeal: Number.isFinite(idealMeanMs) && idealMeanMs > 0
                ? Object.freeze({
                    meanTimeRatio: entry.benchmark.summary.meanMs / idealMeanMs,
                    speedup: idealMeanMs / entry.benchmark.summary.meanMs,
                })
                : null,
        })));
    }

    function browserDelay(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }

    async function runSouthernFranceDaylightStackComparison(gl, canvas, command, diagnostics, startedAt, options) {
        const payload = options.payload;
        const fragmentSource = options.fragmentSource;
        const rowViewportPixels = Array.isArray(payload.rowViewportPixels)
            ? payload.rowViewportPixels
            : [480, 270];
        const rowWidth = clampInteger(rowViewportPixels[0], 1, 2048);
        const rowHeight = clampInteger(rowViewportPixels[1], 1, 2048);
        const renderScale = Math.max(1, numberOrDefault(payload.renderScale, 1));
        const internalRowWidth = clampInteger(rowWidth * renderScale, 1, 4096);
        const internalRowHeight = clampInteger(rowHeight * renderScale, 1, 4096);
        const samples = southernFranceDaylightSamplesForPayload(payload);
        resizeCanvas(canvas, [internalRowWidth, internalRowHeight]);
        const shaderProgram = compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource,
        });
        const compositeCanvas = document.createElement('canvas');
        const outputColumnCount = payload.cpuGpuSideBySide === true ? 2 : 1;
        compositeCanvas.width = rowWidth * outputColumnCount;
        compositeCanvas.height = rowHeight * samples.length;
        const compositeContext = compositeCanvas.getContext('2d', { willReadFrequently: true });
        const rowSummaries = [];
        const selectedPixels = [];

        if (shaderProgram.status === 'accepted') {
            for (let rowIndex = 0; rowIndex < samples.length; rowIndex += 1) {
                const sample = samples[rowIndex];
                resizeCanvas(canvas, [internalRowWidth, internalRowHeight]);
                const sceneCapture = await createSouthernFranceTexturedSceneCapture({
                    ...payload,
                    daylightSample: sample,
                    distantSunDirection: sample.observerLocalDirection,
                }, canvas);
                const rowIncidentRadianceTexture = incidentRadianceTextureForDaylightSample(payload, sample);
                bindObjectiveSceneResources(gl, shaderProgram.program, canvas, {
                    ...payload,
                    distantSunDirection: sample.observerLocalDirection,
                    incidentRadianceTexture: rowIncidentRadianceTexture,
                    selectedPixels: sceneCapture.selectedPixels,
                    sceneColorTexture: sceneCapture.sceneColorTexture,
                    sceneDepthTexture: sceneCapture.sceneDepthTexture,
                    sceneHitTexture: sceneCapture.sceneHitTexture,
                    inverseProjectionMatrix: sceneCapture.inverseProjectionMatrix,
                    inverseViewMatrix: sceneCapture.inverseViewMatrix,
                    sceneDepthMaxMeters: sceneCapture.sceneDepthMaxMeters,
                });
                drawSmokeTriangle(gl, shaderProgram.program);
                const rowImage = await imageFromDataUrl(canvas.toDataURL('image/png'));
                if (payload.cpuGpuSideBySide === true) {
                    throw new Error('cpuGpuSideBySide is disabled until it uses the same cache-backed spectral Algorithm32 path as the GPU shader.');
                } else {
                    compositeContext.drawImage(rowImage, 0, rowIndex * rowHeight, rowWidth, rowHeight);
                }
                rowSummaries.push(sceneCapture.summary);
                for (const pixel of readPayloadSelectedPixels(gl, canvas, sceneCapture.selectedPixels)) {
                    selectedPixels.push({
                        ...pixel,
                        rowIndex,
                        rowId: sample.id,
                    });
                }
            }
        }

        resizeCanvas(canvas, [rowWidth * outputColumnCount, rowHeight * samples.length]);
        const compositeImage = await imageFromDataUrl(compositeCanvas.toDataURL('image/png'));
        const outputGl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
        if (outputGl) {
            outputGl.viewport(0, 0, canvas.width, canvas.height);
            outputGl.clearColor(0, 0, 0, 1);
            outputGl.clear(outputGl.COLOR_BUFFER_BIT);
        }
        const imageDataUrl = compositeCanvas.toDataURL('image/png');
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('daylight-row-count-present', rowSummaries.length === samples.length, 'requested daylight rows'),
            criterion('assembled-fragment-source-present', fragmentSource.includes('ShaderState') && fragmentSource.includes('void main()'), 'assembled Algorithm32 fragment source'),
            criterion('assembled-shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('incident-radiance-cache-payload-present', daylightSamplesHaveIncidentRadianceTexture(payload, samples), 'packed distant incident-radiance texture payload for each daylight row'),
            criterion('selected-pixel-readback-present', selectedPixels.length === samples.length * 3, 'three selected pixel readbacks per daylight row'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: shaderProgram,
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: [rowWidth, rowHeight * samples.length],
                    rowViewportPixels: [rowWidth, rowHeight],
                    internalRowViewportPixels: [internalRowWidth, internalRowHeight],
                    renderScale,
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: payload.comparisonMode ?? null,
                    outputColumns: payload.cpuGpuSideBySide === true
                        ? ['cpu-diagnostic-shader', 'gpu-assembled-shader']
                        : ['gpu-assembled-shader'],
                    browserThreeScene: {
                        kind: 'browser-three-southern-france-daylight-stack-capture',
                        rowCount: samples.length,
                        rows: rowSummaries,
                    },
                    planetSceneFacts,
                },
                canvas: {
                    width: rowWidth * outputColumnCount,
                    height: rowHeight * samples.length,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'assembled-three-daylight-stack-bindings',
                    sceneColorTexture: 'three-render-target-rgba8-per-row',
                    sceneDepthTexture: 'three-distance-rgba8-per-row',
                    sceneHitTexture: 'three-raycaster-hit-mask-rgba8-per-row',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    rowIncidentRadianceTextures: summarizeDaylightIncidentRadianceTextures(payload, samples),
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                    sceneDepthMaxMeters: payload.sceneDepthMaxMeters ?? null,
                    rowSunDirections: samples.map((sample) => sample.observerLocalDirection),
                    renderScale,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    function runAssembledObjectiveSceneComparison(gl, canvas, command, diagnostics, startedAt) {
        const payload = command.payload && typeof command.payload === 'object'
            ? command.payload
            : {};
        const fragmentSource = typeof payload.fragmentShaderSource === 'string'
            ? payload.fragmentShaderSource
            : '';
        const viewportPixels = Array.isArray(payload.viewportPixels)
            ? payload.viewportPixels
            : [canvas.width, canvas.height];
        resizeCanvas(canvas, viewportPixels);
        const shaderProgram = compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource,
        });

        if (shaderProgram.status === 'accepted') {
            bindObjectiveSceneResources(gl, shaderProgram.program, canvas, payload);
            drawSmokeTriangle(gl, shaderProgram.program);
        }

        const selectedPixels = shaderProgram.status === 'accepted'
            ? readPayloadSelectedPixels(gl, canvas, payload.selectedPixels)
            : [];
        const imageDataUrl = shaderProgram.status === 'accepted'
            ? canvas.toDataURL('image/png')
            : null;
        const criteriaResults = [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL 2.0'), 'WebGL2 diagnostic version string'),
            criterion('objective-scene-id-present', typeof payload.sceneId === 'string' && payload.sceneId.length > 0, 'scene descriptor id'),
            criterion('assembled-fragment-source-present', fragmentSource.includes('ShaderState') && fragmentSource.includes('void main()'), 'assembled Algorithm32 fragment source'),
            criterion('camera-matrix-bindings-present', hasMatrix16(payload.inverseProjectionMatrix) && hasMatrix16(payload.inverseViewMatrix), 'camera inverse projection/view matrices'),
            criterion('assembled-shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('incident-radiance-cache-payload-present', hasIncidentRadianceTexturePayload(payload.incidentRadianceTexture), 'packed distant incident-radiance texture payload'),
            criterion('selected-pixel-readback-present', selectedPixels.length === expectedSelectedPixelCount(payload.selectedPixels), 'payload selected pixel readbacks'),
            criterion('selected-pixel-visible-output-present', selectedPixels.some(hasVisibleRgb), 'at least one selected pixel has non-black RGB'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
        const accepted = criteriaResults.every((entry) => entry.status === 'pass');

        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: accepted ? 'accepted' : 'rejected',
            command,
            diagnostics: {
                status: accepted ? 'accepted' : 'rejected',
                browser: diagnostics,
                shader: shaderProgram,
                scene: {
                    sceneId: payload.sceneId ?? null,
                    viewportPixels: [canvas.width, canvas.height],
                    selectedPixelCount: selectedPixels.length,
                    comparisonMode: payload.comparisonMode ?? null,
                },
                canvas: {
                    width: canvas.width,
                    height: canvas.height,
                    imageDataUrlKind: imageDataUrl ? 'image/png' : null,
                },
                bindings: {
                    kind: 'assembled-objective-scene-bindings',
                    sceneColorTexture: payload.sceneColorTextureKind ?? '2d-gradient-rgba8',
                    sceneDepthTexture: payload.sceneDepthTextureKind ?? '2d-constant-rgba8',
                    sceneHitTexture: payload.sceneHitTextureKind ?? '2d-constant-mask-rgba8',
                    incidentRadianceTexture: summarizeIncidentRadianceTexture(payload.incidentRadianceTexture),
                    cameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                    sceneTerminationMeters: payload.sceneTerminationMeters ?? 0,
                },
            },
            selectedPixels,
            criteriaResults,
            imageDataUrl,
            timings: timing(startedAt),
        };
    }

    async function createBrowserThreeSceneCapture(payload, canvas) {
        const THREE = await import('/vendor/three.module.js');
        const width = canvas.width;
        const height = canvas.height;
        const sceneDepthMaxMeters = numberOrDefault(payload.sceneDepthMaxMeters, 20);
        const threeCanvas = document.createElement('canvas');
        threeCanvas.width = width;
        threeCanvas.height = height;
        const renderer = new THREE.WebGLRenderer({
            canvas: threeCanvas,
            antialias: false,
            alpha: false,
            preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x03070c, 1);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x03070c);
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
        camera.position.set(0, 1.5, 0);
        camera.lookAt(new THREE.Vector3(0, 1.2, -12));
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const meshes = [];
        const card = new THREE.Mesh(
            new THREE.PlaneGeometry(4, 3),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(1, 0.86, 0.71),
                side: THREE.DoubleSide,
            }),
        );
        card.name = 'fixture-card-center';
        card.position.set(0, 1.35, -10);
        card.updateMatrixWorld(true);
        scene.add(card);
        meshes.push(card);

        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(30, 36),
            new THREE.MeshBasicMaterial({
                color: new THREE.Color(0.71, 0.53, 0.39),
                side: THREE.DoubleSide,
            }),
        );
        ground.name = 'fixture-ground-plane';
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, 0, -18);
        ground.updateMatrixWorld(true);
        scene.add(ground);
        meshes.push(ground);
        scene.updateMatrixWorld(true);

        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: true,
            stencilBuffer: false,
        });
        renderer.setRenderTarget(renderTarget);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        const colorBytes = new Uint8Array(width * height * 4);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, colorBytes);
        renderer.setRenderTarget(null);

        const distanceCapture = buildRaycasterSceneDistanceCapture({
            THREE,
            meshes,
            camera,
            width,
            height,
            sceneDepthMaxMeters,
        });

        renderTarget.dispose();
        renderer.dispose();

        return {
            status: 'accepted',
            sceneColorTexture: {
                width,
                height,
                rgbaBytes: Array.from(colorBytes),
                coordinateConvention: 'webgl-bottom-left',
                purpose: 'browser Three render target color',
            },
            sceneDepthTexture: {
                width,
                height,
                rgbaBytes: Array.from(distanceCapture.depthBytes),
                coordinateConvention: 'webgl-bottom-left',
                encoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                sceneDepthMaxMeters,
            },
            sceneHitTexture: sceneHitTexturePacket({
                width,
                height,
                hitMaskBytes: distanceCapture.hitMaskBytes,
                purpose: 'browser Three raycaster hit mask',
            }),
            selectedPixels: browserThreeSelectedPixels(width, height),
            inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
            inverseViewMatrix: Array.from(camera.matrixWorld.elements),
            sceneDepthMaxMeters,
            hitPixelCount: distanceCapture.hitPixelCount,
            summary: {
                kind: 'browser-three-controlled-scene-capture',
                colorSource: 'Three.WebGLRenderTarget',
                depthSource: 'Three.Raycaster per pixel',
                hitMaskSource: 'Three.Raycaster per pixel',
                meshCount: meshes.length,
                hitPixelCount: distanceCapture.hitPixelCount,
                viewportPixels: [width, height],
            },
        };
    }

    async function createPlanetSphereGroundSceneCapture(payload, canvas) {
        const constructedScene = await constructPlanetSphereGroundScene(payload, canvas);

        return capturePlanetSphereConstructedScene(constructedScene);
    }

    async function constructPlanetSphereGroundScene(payload, canvas, options = {}) {
        const THREE = options.THREE ?? await import('/vendor/three.module.js');
        const width = canvas.width;
        const height = canvas.height;
        const scaleDenominator = numberOrDefault(payload.scaleDenominator, 1000);
        const bottomRadiusMeters = numberOrDefault(payload.bottomRadiusMeters, 6360000);
        const observerAltitudeMeters = numberOrDefault(payload.observerAltitudeMeters, 150);
        const verticalFovDegrees = numberOrDefault(payload.verticalFovDegrees, 35);
        const radiusSceneUnits = bottomRadiusMeters / scaleDenominator;
        const observerAltitudeSceneUnits = observerAltitudeMeters / scaleDenominator;
        const horizonDistanceSceneUnits = Math.sqrt(
            Math.max(0, (radiusSceneUnits + observerAltitudeSceneUnits) ** 2 - radiusSceneUnits ** 2),
        );
        const horizonTangentPointSceneUnits = planetSphereHorizonTangentPoint({
            radiusSceneUnits,
            observerAltitudeSceneUnits,
        });
        const sceneDepthMaxMeters = numberOrDefault(
            payload.sceneDepthMaxMeters,
            Math.max(150000, horizonDistanceSceneUnits * scaleDenominator * 4),
        );
        const planetSceneFacts = planetSceneFactsFromPayload(payload);
        const planetSceneDefinition = planetSceneDefinitionFromPayload(payload);
        const shadowsEnabled = planetSceneShadowsEnabled(planetSceneDefinition);
        const groundDisplayMode = payload.groundDisplayMode === 'solid' ? 'solid' : 'pattern';
        const distantSunDirection = vector3OrDefault(payload.distantSunDirection, [1, 0, 0]);
        const cameraPosition = Array.isArray(payload.cameraPositionSceneUnits)
            ? payload.cameraPositionSceneUnits
            : [0, observerAltitudeSceneUnits, 0];
        const lookAt = Array.isArray(payload.lookAtSceneUnits)
            ? payload.lookAtSceneUnits
            : horizonTangentPointSceneUnits;
        const near = Math.max(0.000001, Math.min(0.01, Math.max(observerAltitudeSceneUnits, 0.000001) * 0.1));
        const far = Math.max(radiusSceneUnits * 3, horizonDistanceSceneUnits * 4, sceneDepthMaxMeters / scaleDenominator);
        const threeCanvas = options.renderCanvas ?? document.createElement('canvas');
        threeCanvas.width = width;
        threeCanvas.height = height;
        const rendererOptions = {
            canvas: threeCanvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
        };
        if (options.context) {
            rendererOptions.context = options.context;
        }
        const renderer = options.renderer ?? new THREE.WebGLRenderer(rendererOptions);
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(colorFromDisplayRgba(THREE, planetSceneFacts.displayRgba.sky), 1);
        renderer.shadowMap.enabled = shadowsEnabled;
        if (shadowsEnabled && THREE.PCFSoftShadowMap) {
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        if ('toneMapping' in renderer) {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        const scene = new THREE.Scene();
        scene.background = colorFromDisplayRgba(THREE, planetSceneFacts.displayRgba.sky);
        const camera = new THREE.PerspectiveCamera(verticalFovDegrees, width / height, near, far);
        camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
        camera.lookAt(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]));
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const ground = renderPlanetGeometryGroundObject({
            THREE,
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            radiusSceneUnits,
            observerAltitudeSceneUnits,
            horizonDistanceSceneUnits,
            horizonTangentPointSceneUnits,
            groundDisplayMode,
            planetSceneFacts,
            planetSceneDefinition,
        });
        const groundRaycastObject = renderPlanetGeometryGroundRaycastObject({
            THREE,
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            radiusSceneUnits,
            observerAltitudeSceneUnits,
            horizonDistanceSceneUnits,
            horizonTangentPointSceneUnits,
            groundDisplayMode,
            planetSceneFacts,
        });
        scene.add(ground);
        const objectRenderResult = renderPlanetSceneObjects({
            THREE,
            scene,
            sceneDefinition: planetSceneDefinition,
            radiusSceneUnits,
            metersPerSceneUnit: scaleDenominator,
            distantSunDirection,
        });
        scene.updateMatrixWorld(true);

        return Object.freeze({
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
            radiusSceneUnits,
            scaleDenominator,
            sceneDepthMaxMeters,
            distantSunDirection,
            planetSceneFacts,
            planetSceneDefinition,
            groundDisplayMode,
            ground,
            groundRaycastObject,
            visualObjects: Object.freeze([ground, ...objectRenderResult.visualObjects]),
            raycastObjects: Object.freeze([...objectRenderResult.raycastObjects, groundRaycastObject]),
            sceneObjects: objectRenderResult.sceneObjects,
            cameraFacts: Object.freeze({
                positionSceneUnits: cameraPosition,
                lookAtSceneUnits: lookAt,
                algorithmCameraWorldPositionMeters: payload.cameraWorldPositionMeters ?? null,
                verticalFovDegrees,
                near,
                far,
            }),
            transformFacts: Object.freeze({
                scaleDenominator,
                metersPerSceneUnit: scaleDenominator,
                algorithmBasisFromSceneDirection: '[scene.y, scene.x, -scene.z]',
                sceneSphereCenter: Object.freeze([0, -radiusSceneUnits, 0]),
                algorithmSphereCenter: Object.freeze([0, 0, 0]),
            }),
        });
    }

    async function constructLocalFlatGroundScene(payload, canvas, options = {}) {
        const THREE = options.THREE ?? await import('/vendor/three.module.js');
        const width = canvas.width;
        const height = canvas.height;
        const localFlat = payload.localFlat && typeof payload.localFlat === 'object'
            ? payload.localFlat
            : {};
        const observerPositionMeters = vector3OrDefault(localFlat.observerPositionMeters, [0, 0, 2]);
        const metersPerSceneUnit = Math.max(
            0.000001,
            numberOrDefault(payload.metersPerSceneUnit ?? payload.scaleDenominator, 1),
        );
        const sceneDepthMaxMeters = Math.max(1, numberOrDefault(payload.sceneDepthMaxMeters, 5000));
        const verticalFovDegrees = Math.max(1, Math.min(120, numberOrDefault(payload.verticalFovDegrees, 45)));
        const shadowsEnabled = payload.shadowsEnabled !== false;
        const antialiasEnabled = payload.antialias !== false;
        const observerHeightSceneUnits = observerPositionMeters[2] / metersPerSceneUnit;
        const cameraPosition = Array.isArray(payload.cameraPositionSceneUnits)
            ? payload.cameraPositionSceneUnits
            : [0, observerHeightSceneUnits, 0];
        const defaultLookAtDistanceMeters = Math.max(800, observerPositionMeters[2] * 3.7);
        const lookAt = Array.isArray(payload.lookAtSceneUnits)
            ? payload.lookAtSceneUnits
            : [0, 0, -defaultLookAtDistanceMeters / metersPerSceneUnit];
        const near = Math.max(0.000001, Math.min(0.1, Math.max(observerHeightSceneUnits, 0.000001) * 0.05));
        const far = Math.max(sceneDepthMaxMeters / metersPerSceneUnit, 1000 / metersPerSceneUnit);
        const threeCanvas = options.renderCanvas ?? document.createElement('canvas');
        threeCanvas.width = width;
        threeCanvas.height = height;
        const rendererOptions = {
            canvas: threeCanvas,
            antialias: antialiasEnabled,
            alpha: false,
            preserveDrawingBuffer: true,
        };
        if (options.context) {
            rendererOptions.context = options.context;
        }
        const renderer = options.renderer ?? new THREE.WebGLRenderer(rendererOptions);
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = shadowsEnabled;
        if (shadowsEnabled && THREE.PCFSoftShadowMap !== undefined) {
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        renderer.setClearColor(colorFromDisplayRgba(THREE, [132, 160, 190, 255]), 1);
        if ('toneMapping' in renderer) {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        const scene = new THREE.Scene();
        scene.background = colorFromDisplayRgba(THREE, [132, 160, 190, 255]);
        const camera = new THREE.PerspectiveCamera(verticalFovDegrees, width / height, near, far);
        camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
        camera.lookAt(new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]));
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const geometry = new FlatEarthGeometry({
            observerPositionMeters,
            sourcePositionMeters: vector3OrDefault(localFlat.sourcePositionMeters, [0, 1000000, 500000]),
            topAltitudeMeters: numberOrDefault(localFlat.topAltitudeMeters, 100000),
            sceneSkyRayLimitMeters: Number.isFinite(localFlat.sceneSkyRayLimitMeters)
                ? localFlat.sceneSkyRayLimitMeters
                : sceneDepthMaxMeters,
            observerCenteredDome: localFlat.observerCenteredDome ?? null,
            sourceTransmittanceIntervalCount: numberOrDefault(payload.sourceTransmittanceIntervalCount, 10),
            cacheZBinsMeters: Array.isArray(localFlat.cacheZBinsMeters) ? localFlat.cacheZBinsMeters : [2],
            cacheRhoBinsMeters: Array.isArray(localFlat.cacheRhoBinsMeters) ? localFlat.cacheRhoBinsMeters : [0],
        });
        const groundObjects = geometry.createThreeEndpointObjects({
            metersPerSceneUnit,
            visualMaterialDisplayRgba: rgbaOrDefault(localFlat.groundDisplayRgba, [86, 105, 66, 255]),
            visualMaterialLighting: 'lambert',
            name: 'local-flat-geometry-ground',
            widthSegments: 32,
            heightSegments: 32,
        });
        const objectRenderResult = renderLocalFlatSceneObjects({
            THREE,
            scene,
            metersPerSceneUnit,
            cameraPosition,
            lookAt,
            diagnosticBoxesEnabled: localFlat.diagnosticBoxesEnabled !== false,
            cameraForwardReviewBoxes: localFlat.cameraForwardReviewBoxes === true,
            farHorizonReviewBoxEnabled: localFlat.farHorizonReviewBoxEnabled === true,
            denaliReviewBoxEnabled: localFlat.denaliReviewBoxEnabled === true,
            shadowsEnabled,
            endpointIndirectFillEnabled: localFlat.endpointIndirectFillEnabled !== false,
            endpointFillPolicy: localFlat.endpointFillPolicy ?? 'general-ambient-fill',
            endpointAmbientFillRatio: numberOrDefault(localFlat.endpointAmbientFillRatio, 0.25),
        });
        const shadowFrame = localFlatShadowFrame(objectRenderResult.sceneObjects);
        const lightingSummary = addLocalFlatSceneLighting({
            THREE,
            scene,
            geometry,
            localFlat,
            observerPositionMeters,
            observerScenePositionUnits: cameraPosition,
            metersPerSceneUnit,
            shadowsEnabled,
            shadowFrame,
            endpointIndirectFill: objectRenderResult.endpointIndirectFill,
        });
        for (const object of groundObjects.visualObjects) {
            object.receiveShadow = shadowsEnabled;
            scene.add(object);
        }
        scene.updateMatrixWorld(true);

        return Object.freeze({
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
            metersPerSceneUnit,
            sceneDepthMaxMeters,
            localFlat,
            cameraWorldPositionMeters: observerPositionMeters,
            geometryFrame: geometry.configuration.observerLocalSceneFrame,
            groundObjects,
            visualObjects: Object.freeze([
                ...groundObjects.visualObjects,
                ...objectRenderResult.visualObjects,
            ]),
            raycastObjects: Object.freeze([
                ...objectRenderResult.raycastObjects,
                ...groundObjects.raycastObjects,
            ]),
            sceneObjects: objectRenderResult.sceneObjects,
            lightingSummary,
            shadowsEnabled,
            shadowFrame,
            cameraFacts: Object.freeze({
                positionSceneUnits: cameraPosition,
                lookAtSceneUnits: lookAt,
                algorithmCameraWorldPositionMeters: observerPositionMeters,
                verticalFovDegrees,
                near,
                far,
            }),
            transformFacts: Object.freeze({
                metersPerSceneUnit,
                algorithmBasisFromSceneDirection: '[scene.x, -scene.z, scene.y]',
                sceneGroundPlane: 'y=0',
                algorithmGroundPlane: 'z=0',
            }),
            renderQualityFacts: Object.freeze({
                rendererAntialias: antialiasEnabled,
                renderTargetSampleCount: antialiasEnabled ? 4 : 0,
                renderTargetSamples: antialiasEnabled
                    ? 'browser-composer-msaa-when-supported'
                    : 'disabled-single-sample-composer-target',
                cpuOutputTextureFilter: antialiasEnabled
                    ? 'linear-display-copy'
                    : 'nearest-display-copy',
                hitMaskSampling: 'single-center-ray-per-output-pixel',
            }),
        });
    }

    function addLocalFlatSceneLighting({
        THREE,
        scene,
        geometry,
        localFlat,
        observerPositionMeters,
        observerScenePositionUnits,
        metersPerSceneUnit,
        shadowsEnabled,
        shadowFrame,
        endpointIndirectFill,
    }) {
        const sourcePositionMeters = vector3OrDefault(localFlat.sourcePositionMeters, [0, 1000000, 500000]);
        const sourceRelativePosition = geometry.resolveSourceRelativePosition({
            position: observerPositionMeters,
        });
        const sourcePositionSceneUnits = geometry.mapModelPositionToObserverLocalScenePoint(
            sourcePositionMeters,
            { metersPerSceneUnit },
        );
        const lightSource = new LocalSunLightSource({
            sourceKey: localFlat.sourceKey ?? 'local-flat-source',
            spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
            referenceDistanceMeters: numberOrDefault(
                localFlat.referenceDistanceMeters,
                sourceRelativePosition.distanceFromSourceMeters,
            ),
            referenceSpectralIncidentScale: numberOrDefault(localFlat.referenceSpectralIncidentScale, 1),
            radiusMeters: numberOrDefault(localFlat.radiusMeters, 0),
            distanceFalloff: localFlat.distanceFalloff !== false,
        });
        const lightingObjects = lightSource.createThreeLightingObjects({
            THREE,
            sourceRelativePosition,
            sourcePositionSceneUnits,
            observerScenePositionUnits,
            endpointSceneLightScalePolicy: localFlat.endpointSceneLightScalePolicy,
            endpointIndirectFill,
            shadow: shadowsEnabled
                ? {
                    enabled: true,
                    focusSceneUnits: shadowFrame.focusSceneUnits,
                    extentSceneUnits: shadowFrame.extentSceneUnits,
                    lightDistanceSceneUnits: shadowFrame.extentSceneUnits * 4,
                    cameraNear: 0.1,
                    cameraFar: shadowFrame.extentSceneUnits * 8,
                    mapSize: 2048,
                    bias: -0.00002,
                    normalBias: 0,
                }
                : null,
        });

        for (const light of lightingObjects.lights) {
            scene.add(light);
        }
        for (const object of lightingObjects.sceneObjects ?? []) {
            scene.add(object);
        }

        return Object.freeze({
            ...lightingObjects.metadata,
            sourcePositionSceneUnits: Object.freeze([...sourcePositionSceneUnits]),
            sourcePositionMeters: Object.freeze([...sourcePositionMeters]),
            shadowFrame,
        });
    }

    function renderLocalFlatSceneObjects({
        THREE,
        scene,
        metersPerSceneUnit,
        cameraPosition,
        lookAt,
        diagnosticBoxesEnabled = true,
        cameraForwardReviewBoxes = false,
        farHorizonReviewBoxEnabled = false,
        denaliReviewBoxEnabled = false,
        shadowsEnabled = false,
        endpointIndirectFillEnabled = true,
        endpointFillPolicy = 'general-ambient-fill',
        endpointAmbientFillRatio = 0.25,
    }) {
        const diagnosticSpecs = diagnosticBoxesEnabled === false
            ? []
            : [
                {
                    name: 'local-flat-close-red-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [205, 42, 36, 255],
                    centerSceneUnits: [-235 / metersPerSceneUnit, 75 / metersPerSceneUnit, -900 / metersPerSceneUnit],
                    sizeSceneUnits: [120 / metersPerSceneUnit, 150 / metersPerSceneUnit, 120 / metersPerSceneUnit],
                    rotationYDegrees: 18,
                },
                {
                    name: 'local-flat-close-orange-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [220, 105, 28, 255],
                    centerSceneUnits: [85 / metersPerSceneUnit, 100 / metersPerSceneUnit, -1800 / metersPerSceneUnit],
                    sizeSceneUnits: [180 / metersPerSceneUnit, 200 / metersPerSceneUnit, 180 / metersPerSceneUnit],
                    rotationYDegrees: -24,
                },
                {
                    name: 'local-flat-close-white-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [210, 214, 198, 255],
                    centerSceneUnits: [-1450 / metersPerSceneUnit, 125 / metersPerSceneUnit, -3500 / metersPerSceneUnit],
                    sizeSceneUnits: [250 / metersPerSceneUnit, 250 / metersPerSceneUnit, 250 / metersPerSceneUnit],
                    rotationYDegrees: 31,
                },
                {
                    name: 'local-flat-near-green-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [0, 170, 40, 255],
                    centerSceneUnits: [3900 / metersPerSceneUnit, 500 / metersPerSceneUnit, -11000 / metersPerSceneUnit],
                    sizeSceneUnits: [1000 / metersPerSceneUnit, 1000 / metersPerSceneUnit, 1000 / metersPerSceneUnit],
                    rotationYDegrees: -16,
                },
                {
                    name: 'local-flat-far-blue-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [38, 88, 210, 255],
                    centerSceneUnits: [-8500 / metersPerSceneUnit, 750 / metersPerSceneUnit, -15000 / metersPerSceneUnit],
                    sizeSceneUnits: [1400 / metersPerSceneUnit, 1500 / metersPerSceneUnit, 1400 / metersPerSceneUnit],
                    rotationYDegrees: 22,
                },
                {
                    name: 'local-flat-mid-yellow-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [205, 170, 22, 255],
                    centerSceneUnits: [6000 / metersPerSceneUnit, 1000 / metersPerSceneUnit, -30000 / metersPerSceneUnit],
                    sizeSceneUnits: [3000 / metersPerSceneUnit, 2000 / metersPerSceneUnit, 3000 / metersPerSceneUnit],
                    rotationYDegrees: -12,
                },
                {
                    name: 'local-flat-far-cyan-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [32, 178, 190, 255],
                    centerSceneUnits: [-4850 / metersPerSceneUnit, 1250 / metersPerSceneUnit, -45000 / metersPerSceneUnit],
                    sizeSceneUnits: [5000 / metersPerSceneUnit, 2500 / metersPerSceneUnit, 5000 / metersPerSceneUnit],
                    rotationYDegrees: 17,
                },
                {
                    name: 'local-flat-very-far-magenta-box',
                    kind: 'diagnostic-flat-box',
                    displayRgba: [178, 48, 190, 255],
                    centerSceneUnits: [30000 / metersPerSceneUnit, 1500 / metersPerSceneUnit, -60000 / metersPerSceneUnit],
                    sizeSceneUnits: [7000 / metersPerSceneUnit, 3000 / metersPerSceneUnit, 7000 / metersPerSceneUnit],
                    rotationYDegrees: -20,
                },
            ];
        const specs = [
            ...diagnosticSpecs,
            ...cameraForwardReviewBoxSpecs({
                cameraForwardReviewBoxes,
                cameraPosition,
                lookAt,
                metersPerSceneUnit,
            }),
            ...farHorizonReviewBoxSpecs({
                farHorizonReviewBoxEnabled,
                cameraPosition,
                lookAt,
                metersPerSceneUnit,
            }),
            ...denaliReviewBoxSpecs({
                denaliReviewBoxEnabled,
                cameraPosition,
                lookAt,
                metersPerSceneUnit,
            }),
        ];
        const visualObjects = [];
        const sceneObjects = {};
        const endpointIndirectFillParticipants = [];

        for (const spec of specs) {
            const geometry = new THREE.BoxGeometry(
                spec.sizeSceneUnits[0],
                spec.sizeSceneUnits[1],
                spec.sizeSceneUnits[2],
            );
            const material = new THREE.MeshLambertMaterial({
                color: colorFromDisplayRgba(THREE, spec.displayRgba),
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = spec.name;
            mesh.position.set(...spec.centerSceneUnits);
            mesh.rotation.y = (spec.rotationYDegrees ?? 0) * Math.PI / 180;
            mesh.userData.endpointKind = spec.endpointKind ?? 'diagnostic-flat-scene-object';
            mesh.userData.displayRgba = spec.displayRgba;
            mesh.userData.rotationYDegrees = spec.rotationYDegrees ?? 0;
            mesh.castShadow = shadowsEnabled;
            mesh.receiveShadow = shadowsEnabled;
            mesh.updateMatrixWorld(true);
            scene.add(mesh);
            visualObjects.push(mesh);
            sceneObjects[spec.name] = Object.freeze({
                kind: spec.kind ?? 'diagnostic-flat-box',
                displayRgba: Object.freeze([...spec.displayRgba]),
                centerSceneUnits: Object.freeze([...spec.centerSceneUnits]),
                sizeSceneUnits: Object.freeze([...spec.sizeSceneUnits]),
                rotationYDegrees: spec.rotationYDegrees ?? 0,
                metersPerSceneUnit,
                reviewDistanceMeters: spec.reviewDistanceMeters ?? null,
                reviewCenterDistanceMeters: spec.reviewCenterDistanceMeters ?? null,
                reviewHeightMeters: spec.reviewHeightMeters ?? null,
                reviewFootprintMeters: spec.reviewFootprintMeters ?? null,
                reviewWidthMeters: spec.reviewWidthMeters ?? null,
                reviewDepthMeters: spec.reviewDepthMeters ?? null,
                reviewLateralOffsetMeters: spec.reviewLateralOffsetMeters ?? null,
                endpointIndirectFillParticipant: spec.endpointIndirectFillParticipant === true,
            });
            if (spec.endpointIndirectFillParticipant === true) {
                endpointIndirectFillParticipants.push(spec);
            }
        }
        const endpointIndirectFill = endpointIndirectFillEnabled
            ? localFlatEndpointIndirectFill(endpointIndirectFillParticipants, endpointAmbientFillRatio, endpointFillPolicy)
            : Object.freeze({
                enabled: false,
                policy: `${endpointFillPolicy}-disabled`,
            });

        return Object.freeze({
            visualObjects: Object.freeze(visualObjects),
            raycastObjects: Object.freeze([...visualObjects]),
            sceneObjects: Object.freeze(sceneObjects),
            endpointIndirectFill,
        });
    }

    function cameraForwardReviewBoxSpecs({
        cameraForwardReviewBoxes,
        cameraPosition,
        lookAt,
        metersPerSceneUnit,
    }) {
        if (cameraForwardReviewBoxes !== true) {
            return [];
        }

        const forwardX = numberOrDefault(lookAt?.[0], 0) - numberOrDefault(cameraPosition?.[0], 0);
        const forwardZ = numberOrDefault(lookAt?.[2], -1) - numberOrDefault(cameraPosition?.[2], 0);
        const forwardLength = Math.hypot(forwardX, forwardZ);
        if (forwardLength <= 0.000001) {
            return [];
        }

        const unitForwardX = forwardX / forwardLength;
        const unitForwardZ = forwardZ / forwardLength;
        const unitRightX = -unitForwardZ;
        const unitRightZ = unitForwardX;
        const yawDegrees = Math.atan2(unitForwardX, unitForwardZ) * 180 / Math.PI;
        const reviewSpecs = [
            {
                name: 'local-flat-sunward-near-yellow-box',
                displayRgba: [226, 178, 34, 255],
                distanceMeters: 1600,
                lateralMeters: -260,
                sizeMeters: [180, 220, 180],
                rotationOffsetDegrees: 15,
            },
            {
                name: 'local-flat-sunward-mid-white-box',
                displayRgba: [220, 214, 190, 255],
                distanceMeters: 3600,
                lateralMeters: 620,
                sizeMeters: [420, 500, 420],
                rotationOffsetDegrees: -21,
            },
            {
                name: 'local-flat-sunward-far-orange-box',
                displayRgba: [218, 95, 28, 255],
                distanceMeters: 8200,
                lateralMeters: -1300,
                sizeMeters: [900, 900, 900],
                rotationOffsetDegrees: 28,
            },
        ];

        return reviewSpecs.map((spec) => {
            const centerX = unitForwardX * spec.distanceMeters / metersPerSceneUnit
                + unitRightX * spec.lateralMeters / metersPerSceneUnit;
            const centerZ = unitForwardZ * spec.distanceMeters / metersPerSceneUnit
                + unitRightZ * spec.lateralMeters / metersPerSceneUnit;
            const sizeSceneUnits = spec.sizeMeters.map((value) => value / metersPerSceneUnit);

            return Object.freeze({
                name: spec.name,
                displayRgba: spec.displayRgba,
                centerSceneUnits: Object.freeze([
                    centerX,
                    sizeSceneUnits[1] / 2,
                    centerZ,
                ]),
                sizeSceneUnits: Object.freeze(sizeSceneUnits),
                rotationYDegrees: yawDegrees + spec.rotationOffsetDegrees,
                endpointIndirectFillParticipant: true,
            });
        });
    }

    function localFlatEndpointIndirectFill(specs, endpointAmbientFillRatio, endpointFillPolicy) {
        const policy = localFlatEndpointFillPolicy(endpointFillPolicy);

        if (policy !== 'source-direction-falloff-fill' && (!Array.isArray(specs) || specs.length === 0)) {
            return Object.freeze({
                enabled: false,
                policy: `${policy}-no-participants`,
            });
        }

        return Object.freeze({
            enabled: true,
            policy,
            role: localFlatEndpointFillRole(policy),
            participantCount: Array.isArray(specs) ? specs.length : 0,
            intensityRatio: Math.max(0, numberOrDefault(endpointAmbientFillRatio, 0.25)),
            distanceSceneUnits: 100,
        });
    }

    function localFlatEndpointFillPolicy(endpointFillPolicy) {
        if (endpointFillPolicy === 'opposite-directional-fill') {
            return 'opposite-directional-fill';
        }
        if (endpointFillPolicy === 'source-direction-falloff-fill') {
            return 'source-direction-falloff-fill';
        }
        return 'general-ambient-fill';
    }

    function localFlatEndpointFillRole(policy) {
        if (policy === 'opposite-directional-fill') {
            return 'vacuum-endpoint-opposite-directional-approximation';
        }
        if (policy === 'source-direction-falloff-fill') {
            return 'vacuum-endpoint-source-direction-falloff-approximation';
        }
        return 'vacuum-endpoint-general-ambient-approximation';
    }

    function farHorizonReviewBoxSpecs({
        farHorizonReviewBoxEnabled,
        cameraPosition,
        lookAt,
        metersPerSceneUnit,
    }) {
        if (farHorizonReviewBoxEnabled !== true) {
            return [];
        }

        const forwardX = numberOrDefault(lookAt?.[0], 0) - numberOrDefault(cameraPosition?.[0], 0);
        const forwardZ = numberOrDefault(lookAt?.[2], -1) - numberOrDefault(cameraPosition?.[2], 0);
        const forwardLength = Math.hypot(forwardX, forwardZ);
        if (forwardLength <= 0.000001) {
            return [];
        }

        const unitForwardX = forwardX / forwardLength;
        const unitForwardZ = forwardZ / forwardLength;
        const heightMeters = 6200;
        const widthMeters = 50000;
        const depthMeters = 100000;
        const unitRightX = -unitForwardZ;
        const unitRightZ = unitForwardX;
        const yawDegrees = Math.atan2(unitForwardX, unitForwardZ) * 180 / Math.PI;
        const boxSpecs = [
            {
                name: 'local-flat-left-160km-6p2kmx50kmx100km-orange-box',
                frontFaceDistanceMeters: 160000,
                lateralMeters: -35000,
            },
            {
                name: 'local-flat-right-240km-6p2kmx50kmx100km-orange-box',
                frontFaceDistanceMeters: 240000,
                lateralMeters: 35000,
            },
        ];

        return boxSpecs.map((spec) => {
            const centerDistanceMeters = spec.frontFaceDistanceMeters + depthMeters / 2;
            const centerX = numberOrDefault(cameraPosition?.[0], 0)
                + unitForwardX * centerDistanceMeters / metersPerSceneUnit
                + unitRightX * spec.lateralMeters / metersPerSceneUnit;
            const centerZ = numberOrDefault(cameraPosition?.[2], 0)
                + unitForwardZ * centerDistanceMeters / metersPerSceneUnit
                + unitRightZ * spec.lateralMeters / metersPerSceneUnit;

            return Object.freeze({
                name: spec.name,
                kind: 'review-flat-box',
                endpointKind: 'review-flat-scene-object',
                displayRgba: [224, 95, 32, 255],
                centerSceneUnits: Object.freeze([
                    centerX,
                    heightMeters / metersPerSceneUnit / 2,
                    centerZ,
                ]),
                sizeSceneUnits: Object.freeze([
                    widthMeters / metersPerSceneUnit,
                    heightMeters / metersPerSceneUnit,
                    depthMeters / metersPerSceneUnit,
                ]),
                rotationYDegrees: yawDegrees,
                reviewDistanceMeters: spec.frontFaceDistanceMeters,
                reviewCenterDistanceMeters: centerDistanceMeters,
                reviewHeightMeters: heightMeters,
                reviewWidthMeters: widthMeters,
                reviewDepthMeters: depthMeters,
                reviewLateralOffsetMeters: spec.lateralMeters,
            });
        });
    }

    function denaliReviewBoxSpecs({
        denaliReviewBoxEnabled,
        cameraPosition,
        lookAt,
        metersPerSceneUnit,
    }) {
        if (denaliReviewBoxEnabled !== true) {
            return [];
        }

        const forwardX = numberOrDefault(lookAt?.[0], 0) - numberOrDefault(cameraPosition?.[0], 0);
        const forwardZ = numberOrDefault(lookAt?.[2], -1) - numberOrDefault(cameraPosition?.[2], 0);
        const forwardLength = Math.hypot(forwardX, forwardZ);
        if (forwardLength <= 0.000001) {
            return [];
        }

        const unitForwardX = forwardX / forwardLength;
        const unitForwardZ = forwardZ / forwardLength;
        const heightMeters = 6200;
        const widthMeters = 50000;
        const depthMeters = 100000;
        const frontFaceDistanceMeters = 200000;
        const lateralMeters = 100000;
        const centerDistanceMeters = frontFaceDistanceMeters + depthMeters / 2;
        const unitRightX = -unitForwardZ;
        const unitRightZ = unitForwardX;
        const centerX = numberOrDefault(cameraPosition?.[0], 0)
            + unitForwardX * centerDistanceMeters / metersPerSceneUnit
            + unitRightX * lateralMeters / metersPerSceneUnit;
        const centerZ = numberOrDefault(cameraPosition?.[2], 0)
            + unitForwardZ * centerDistanceMeters / metersPerSceneUnit
            + unitRightZ * lateralMeters / metersPerSceneUnit;
        const yawDegrees = Math.atan2(unitForwardX, unitForwardZ) * 180 / Math.PI;

        return Object.freeze([
            Object.freeze({
                name: 'local-flat-denali-200km-6p2kmx50kmx100km-orange-box',
                kind: 'review-flat-box',
                endpointKind: 'review-flat-scene-object',
                displayRgba: [224, 95, 32, 255],
                centerSceneUnits: Object.freeze([
                    centerX,
                    heightMeters / metersPerSceneUnit / 2,
                    centerZ,
                ]),
                sizeSceneUnits: Object.freeze([
                    widthMeters / metersPerSceneUnit,
                    heightMeters / metersPerSceneUnit,
                    depthMeters / metersPerSceneUnit,
                ]),
                rotationYDegrees: yawDegrees,
                reviewDistanceMeters: frontFaceDistanceMeters,
                reviewCenterDistanceMeters: centerDistanceMeters,
                reviewHeightMeters: heightMeters,
                reviewWidthMeters: widthMeters,
                reviewDepthMeters: depthMeters,
                reviewLateralOffsetMeters: lateralMeters,
            }),
        ]);
    }

    function localFlatShadowFrame(sceneObjects) {
        const values = Object.values(sceneObjects ?? {});
        if (values.length === 0) {
            return Object.freeze({
                focusSceneUnits: Object.freeze([0, 0, -20]),
                extentSceneUnits: 40,
                policy: 'default-local-flat-shadow-frame',
            });
        }

        let minX = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let minY = 0;
        let maxY = Number.NEGATIVE_INFINITY;
        let minZ = Number.POSITIVE_INFINITY;
        let maxZ = Number.NEGATIVE_INFINITY;

        for (const object of values) {
            const center = object.centerSceneUnits;
            const size = object.sizeSceneUnits;
            minX = Math.min(minX, center[0] - size[0] / 2);
            maxX = Math.max(maxX, center[0] + size[0] / 2);
            minY = Math.min(minY, center[1] - size[1] / 2);
            maxY = Math.max(maxY, center[1] + size[1] / 2);
            minZ = Math.min(minZ, center[2] - size[2] / 2);
            maxZ = Math.max(maxZ, center[2] + size[2] / 2);
        }

        const spanX = maxX - minX;
        const spanY = maxY - minY;
        const spanZ = maxZ - minZ;
        const extentSceneUnits = Math.max(12, Math.max(spanX, spanY, spanZ) / 2 + 10);

        return Object.freeze({
            focusSceneUnits: Object.freeze([
                (minX + maxX) / 2,
                Math.max(0, (minY + maxY) / 2),
                (minZ + maxZ) / 2,
            ]),
            extentSceneUnits,
            boundsSceneUnits: Object.freeze({
                min: Object.freeze([minX, minY, minZ]),
                max: Object.freeze([maxX, maxY, maxZ]),
            }),
            policy: 'local-flat-shadow-frame-from-diagnostic-box-bounds',
        });
    }

    function capturePlanetSphereConstructedScene(constructedScene) {
        const {
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
            radiusSceneUnits,
            scaleDenominator,
            sceneDepthMaxMeters,
            distantSunDirection,
            planetSceneFacts,
            planetSceneDefinition,
            groundDisplayMode,
            ground,
            groundRaycastObject,
            visualObjects,
            raycastObjects,
            sceneObjects,
            cameraFacts,
            transformFacts,
        } = constructedScene;

        const shadowDiagnostics = { shadowedHitPixelCount: 0 };
        const distanceCapture = buildRaycasterSceneDistanceCapture({
            THREE,
            meshes: raycastObjects,
            camera,
            width,
            height,
            sceneDepthMaxMeters,
            distanceMultiplier: scaleDenominator,
            noHitColorRgba: planetSceneFacts.displayRgba.sky,
            colorResolver: (hit) => resolvePlanetSceneHitRgba({
                THREE,
                hit,
                planetSceneFacts,
                planetSceneDefinition,
                distantSunDirection,
                shadowObjects: raycastObjects,
                shadowRayFarSceneUnits: Math.max(cameraFacts.far, radiusSceneUnits * 3),
                shadowDiagnostics,
            }),
        });
        const colorBytes = distanceCapture.colorBytes;
        const objectHitDiagnostics = Object.freeze({
            objectHitCounts: distanceCapture.objectHitCounts,
            objectColorExtents: distanceCapture.objectColorExtents,
        });
        const hitPixelCount = distanceCapture.hitPixelCount;
        const depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);
        const sceneColorImageDataUrl = dataUrlFromBottomLeftRgbaBytes({
            width,
            height,
            rgbaBytes: colorBytes,
        });
        renderer.dispose();

        return {
            status: 'accepted',
            sceneColorImageDataUrl,
            sceneColorTexture: {
                width,
                height,
                rgbaBytes: Array.from(colorBytes),
                coordinateConvention: 'webgl-bottom-left',
                purpose: 'constructed scene raycast endpoint color',
            },
            sceneDepthTexture: {
                width,
                height,
                rgbaBytes: Array.from(distanceCapture.depthBytes),
                coordinateConvention: 'webgl-bottom-left',
                encoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                sceneDepthMaxMeters,
                distanceUnits: 'Algorithm32 meters',
                sceneUnitsToMeters: scaleDenominator,
            },
            sceneHitTexture: sceneHitTexturePacket({
                width,
                height,
                hitMaskBytes: distanceCapture.hitMaskBytes,
                purpose: 'browser Three scaled planet sphere hit mask',
            }),
            selectedPixels: planetSphereSelectedPixels(width, height),
            inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
            inverseViewMatrix: Array.from(camera.matrixWorld.elements),
            sceneDepthMaxMeters,
            hitPixelCount,
            summary: {
                kind: 'browser-three-planet-sphere-ground-capture',
                colorSource: 'constructed scene raycast endpoint color',
                depthSource: 'constructed scene raycast hit distances, converted from scene units to Algorithm32 meters',
                hitMaskSource: 'constructed scene raycast hit mask',
                groundColorPolicy: 'geometry-owned exact ground raycast owns ground hit distance and hit mask',
                sceneLighting: {
                    ...planetSceneLightingSummary(planetSceneDefinition, distantSunDirection),
                    endpointColorStatus: planetSceneDefinition.lightingPolicy === 'directional-light-from-distant-sun'
                        ? 'applied-to-raycast-endpoint-color-in-this-capture'
                        : 'not-applied-to-raycast-endpoint-color-in-this-capture',
                },
                sceneShadows: Object.freeze({
                    policy: planetSceneDefinition.shadowPolicy,
                    enabled: planetSceneShadowsEnabled(planetSceneDefinition),
                    endpointColorStatus: planetSceneShadowsEnabled(planetSceneDefinition)
                        ? 'shadow-rays-applied-to-raycast-endpoint-color-in-this-capture'
                        : 'not-applied-to-raycast-endpoint-color-in-this-capture',
                    shadowedHitPixelCount: shadowDiagnostics.shadowedHitPixelCount,
                }),
                planetSceneFacts,
                planetSceneDefinition,
                sceneObjects,
                meshCount: raycastObjects.length,
                visualMeshCount: raycastObjects.length,
                threeObjectCount: visualObjects.length,
                raycastObjectCount: raycastObjects.length,
                hitPixelCount,
                objectHitCounts: objectHitDiagnostics.objectHitCounts,
                objectColorExtents: objectHitDiagnostics.objectColorExtents,
                depthSummary,
                viewportPixels: [width, height],
                cameraProfile: 'scaled-planet-sphere-tangent-view',
                groundDisplayMode,
                sphere: groundRaycastObject.userData,
                visualGround: ground.userData,
                camera: cameraFacts,
                transform: transformFacts,
            },
        };
    }

    function planetSphereComposerSceneSummary({
        constructedScene,
        composerResult,
        distanceCapture,
        colorDiagnosticCapture,
        depthSummary,
        shaderBackend,
    }) {
        const {
            width,
            height,
            radiusSceneUnits,
            sceneDepthMaxMeters,
            distantSunDirection,
            planetSceneFacts,
            planetSceneDefinition,
            groundDisplayMode,
            ground,
            groundRaycastObject,
            visualObjects,
            raycastObjects,
            sceneObjects,
            cameraFacts,
            transformFacts,
        } = constructedScene;
        const objectDiagnostics = colorDiagnosticCapture ?? distanceCapture;

        return Object.freeze({
            kind: 'browser-three-planet-sphere-ground-composer-capture',
            shaderRuntime: 'three-effect-composer',
            shaderBackend,
            colorSource: 'EffectComposer RenderPass readBuffer.texture',
            depthSource: 'constructed scene raycast hit distances, converted from scene units to Algorithm32 meters',
            hitMaskSource: 'constructed scene raycast hit mask',
            groundColorPolicy: 'visible ground mesh contributes only through composer scene color; geometry-owned exact ground raycast owns ground hit distance and hit mask',
            sceneLighting: {
                ...planetSceneLightingSummary(planetSceneDefinition, distantSunDirection),
                endpointColorStatus: 'captured-from-effect-composer-render-pass',
            },
            sceneShadows: Object.freeze({
                policy: planetSceneDefinition.shadowPolicy,
                enabled: planetSceneShadowsEnabled(planetSceneDefinition),
                endpointColorStatus: planetSceneShadowsEnabled(planetSceneDefinition)
                    ? 'three-shadow-map-rendered-into-composer-scene-color'
                    : 'not-applied-to-composer-scene-color',
                shadowedHitPixelCount: composerResult?.diagnostics?.selectedPixels
                    ? null
                    : null,
            }),
            planetSceneFacts,
            planetSceneDefinition,
            sceneObjects,
            meshCount: raycastObjects.length,
            visualMeshCount: visualObjects.length,
            threeObjectCount: visualObjects.length,
            raycastObjectCount: raycastObjects.length,
            hitPixelCount: distanceCapture?.hitPixelCount ?? 0,
            objectHitCounts: objectDiagnostics?.objectHitCounts ?? Object.freeze({}),
            objectColorExtents: objectDiagnostics?.objectColorExtents ?? Object.freeze({}),
            objectDistanceExtents: distanceCapture?.objectDistanceExtents ?? Object.freeze({}),
            objectFirstHitCoordinates: distanceCapture?.objectFirstHitCoordinates ?? Object.freeze({}),
            depthSummary,
            viewportPixels: [width, height],
            sceneDepthMaxMeters,
            cameraProfile: 'scaled-planet-sphere-tangent-view',
            groundDisplayMode,
            radiusSceneUnits,
            sphere: groundRaycastObject.userData,
            visualGround: ground.userData,
            camera: cameraFacts,
            transform: transformFacts,
        });
    }

    function localFlatComposerSceneSummary({
        constructedScene,
        composerResult,
        distanceCapture,
        colorDiagnosticCapture,
        depthSummary,
        shaderBackend,
    }) {
        const {
            width,
            height,
            metersPerSceneUnit,
            sceneDepthMaxMeters,
            localFlat,
            groundObjects,
            visualObjects,
            raycastObjects,
            sceneObjects,
            cameraFacts,
            transformFacts,
            geometryFrame,
            lightingSummary,
            shadowsEnabled,
            shadowFrame,
            renderQualityFacts,
        } = constructedScene;
        const objectDiagnostics = colorDiagnosticCapture ?? distanceCapture;

        return Object.freeze({
            kind: 'browser-three-local-flat-ground-composer-capture',
            shaderRuntime: 'three-effect-composer',
            shaderBackend,
            geometryKind: 'flat-earth',
            lightSourceKind: 'local-sun',
            colorSource: 'EffectComposer RenderPass readBuffer.texture',
            depthSource: distanceCapture?.depthSource
                ?? 'geometry-owned exact flat ground plus scene-object raycaster hit distances, converted to Algorithm32 meters',
            hitMaskSource: distanceCapture?.hitMaskSource ?? 'local flat scene raycaster hit mask',
            sceneDepthCapturePolicy: distanceCapture?.capturePolicy ?? 'unknown',
            groundColorPolicy: distanceCapture?.capturePolicy === 'renderer-distance'
                ? 'visible flat ground mesh contributes through composer scene color; renderer distance pass owns ground/object hit distance and hit mask'
                : 'visible flat ground mesh contributes only through composer scene color; geometry-owned exact flat ground raycast owns ground hit distance and hit mask',
            sceneLighting: Object.freeze({
                ...(lightingSummary ?? {}),
                algorithmLightSource: 'local-sun',
            }),
            shadowPolicy: shadowsEnabled
                ? 'three-shadow-map-from-local-source-direction'
                : 'shadows-disabled',
            shadowFrame,
            renderQuality: renderQualityFacts,
            localFlat: Object.freeze({
                sourceKey: localFlat.sourceKey ?? null,
                observerPositionMeters: localFlat.observerPositionMeters ?? null,
                sourcePositionMeters: localFlat.sourcePositionMeters ?? null,
                topAltitudeMeters: localFlat.topAltitudeMeters ?? null,
                sceneSkyRayLimitMeters: localFlat.sceneSkyRayLimitMeters ?? null,
                observerCenteredDome: localFlat.observerCenteredDome ?? null,
            }),
            sceneObjects,
            meshCount: raycastObjects.length,
            visualMeshCount: visualObjects.length,
            threeObjectCount: visualObjects.length,
            raycastObjectCount: raycastObjects.length,
            hitPixelCount: distanceCapture?.hitPixelCount ?? 0,
            objectHitCounts: objectDiagnostics?.objectHitCounts ?? Object.freeze({}),
            objectColorExtents: objectDiagnostics?.objectColorExtents ?? Object.freeze({}),
            objectDistanceExtents: distanceCapture?.objectDistanceExtents ?? Object.freeze({}),
            objectFirstHitCoordinates: distanceCapture?.objectFirstHitCoordinates ?? Object.freeze({}),
            depthSummary,
            viewportPixels: [width, height],
            sceneDepthMaxMeters,
            cameraProfile: 'local-flat-planet-scale-low-observer-downrange-view',
            metersPerSceneUnit,
            ground: Object.freeze({
                metadata: groundObjects.metadata,
                raycastUserData: groundObjects.raycastObjects[0]?.userData ?? null,
                visualUserData: groundObjects.visualObjects[0]?.userData ?? null,
                visualMaterial: Object.freeze({
                    materialKind: 'lambert-matte',
                    policy: 'geometry-owned-flat-ground-lambert-visual',
                    displayRgba: groundObjects.metadata?.visualMaterialDisplayRgba ?? null,
                    visualObjectCount: groundObjects.visualObjects.length,
                }),
            }),
            camera: cameraFacts,
            transform: transformFacts,
            geometryFrame,
            cpuSelectedPixelDiagnostics: composerResult?.diagnostics?.selectedPixels ?? Object.freeze([]),
        });
    }

    async function createSouthernFranceSolarNoonSceneCapture(payload, canvas) {
        const THREE = await import('/vendor/three.module.js');
        const { OBJLoader } = await import('/vendor/loaders/OBJLoader.js');
        const width = canvas.width;
        const height = canvas.height;
        const sceneDepthMaxMeters = numberOrDefault(payload.sceneDepthMaxMeters, 150000);
        const solar = solarNoonSunForToday(payload);
        const threeCanvas = document.createElement('canvas');
        threeCanvas.width = width;
        threeCanvas.height = height;
        const renderer = new THREE.WebGLRenderer({
            canvas: threeCanvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x87a9d8, 1);
        if ('toneMapping' in renderer) {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87a9d8);
        const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, sceneDepthMaxMeters);
        camera.position.set(0, 6200, 15800);
        camera.lookAt(new THREE.Vector3(0, 4200, -56000));
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const meshes = [];
        const obj = await new OBJLoader().loadAsync(
            './assets/southern-france-blender-obj/Mountain Range in Southern France.obj',
        );
        const terrainMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.14, 0.235, 0.105),
            roughness: 0.96,
            metalness: 0,
            side: THREE.DoubleSide,
        });
        const transform = southernFranceTransform();
        obj.name = 'southern-france-obj-root';
        obj.traverse((child) => {
            if (!child.isMesh) {
                return;
            }
            child.geometry = child.geometry.clone();
            transformSouthernFranceGeometry(child.geometry, transform);
            child.geometry.computeVertexNormals();
            child.geometry.computeBoundingSphere();
            child.material = terrainMaterial;
            child.name = `southern-france-terrain-${meshes.length}`;
            child.userData = {
                kind: 'subjective-southern-france-terrain',
                materialPolicy: 'single-matte-material',
            };
            meshes.push(child);
        });
        scene.add(obj);

        const ground = createSphericalEarthFloorMesh({
            THREE,
            cameraConfig: {
                cameraPositionMeters: [0, 6200, 15800],
            },
            algorithmCameraWorldPositionMeters: payload.cameraWorldPositionMeters,
            material: new THREE.MeshStandardMaterial({
                color: new THREE.Color(0.22, 0.20, 0.15),
                roughness: 1,
                metalness: 0,
                side: THREE.DoubleSide,
            }),
        });
        ground.name = 'southern-france-bottom-ground';
        ground.userData = {
            ...ground.userData,
            kind: 'subjective-southern-france-spherical-ground',
            geometryPolicy: 'observer-local-spherical-earth-mesh',
        };
        scene.add(ground);
        meshes.push(ground);

        scene.add(new THREE.AmbientLight(0xffffff, 0.12));
        const light = new THREE.DirectionalLight(0xffffff, 1.35);
        const sceneSunDirection = sceneDirectionFromObserverLocalSun(solar.observerLocalDirection);
        light.position.set(
            sceneSunDirection[0] * 50000,
            sceneSunDirection[1] * 50000,
            sceneSunDirection[2] * 50000,
        );
        light.target.position.set(0, 120, -30000);
        scene.add(light);
        scene.add(light.target);
        scene.updateMatrixWorld(true);

        const colorBytes = renderSceneColorBytes({
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
        });
        const distanceCapture = buildRaycasterSceneDistanceCapture({
            THREE,
            meshes,
            camera,
            width,
            height,
            sceneDepthMaxMeters,
        });
        const hitPixelCount = distanceCapture.hitPixelCount;
        const depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);
        renderer.dispose();

        return {
            status: 'accepted',
            sceneColorTexture: {
                width,
                height,
                rgbaBytes: Array.from(colorBytes),
                coordinateConvention: 'webgl-bottom-left',
                purpose: 'browser Three Southern France subjective render target color',
            },
            sceneDepthTexture: {
                width,
                height,
                rgbaBytes: Array.from(distanceCapture.depthBytes),
                coordinateConvention: 'webgl-bottom-left',
                encoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                sceneDepthMaxMeters,
            },
            sceneHitTexture: sceneHitTexturePacket({
                width,
                height,
                hitMaskBytes: distanceCapture.hitMaskBytes,
                purpose: 'browser Three Southern France solar-noon hit mask',
            }),
            selectedPixels: browserSubjectiveSelectedPixels(width, height),
            inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
            inverseViewMatrix: Array.from(camera.matrixWorld.elements),
            sceneDepthMaxMeters,
            hitPixelCount,
            summary: {
                kind: 'browser-three-southern-france-solar-noon-capture',
                colorSource: 'Three.WebGLRenderTarget',
                depthSource: 'Three.Raycaster per pixel',
                hitMaskSource: 'Three.Raycaster per pixel',
                meshCount: meshes.length,
                hitPixelCount,
                depthSummary,
                viewportPixels: [width, height],
                date: solar.date,
                location: solar.location,
                sun: {
                    altitudeDegrees: solar.altitudeDegrees,
                    azimuthDegrees: solar.azimuthDegrees,
                    observerLocalDirection: solar.observerLocalDirection,
                    sceneDirection: sceneSunDirection,
                    policy: 'solar noon on local meridian; approximate Southern France review fixture',
                },
                terrain: {
                    asset: 'Mountain Range in Southern France.obj',
                    materialPolicy: 'single-matte-material-no-shadows',
                    sourceLineage: 'local-second-order Southern France no-shadow subjective lineage',
                    cameraProfile: 'accepted-high-southern-france-obj-ridge-view',
                    cameraPositionMeters: [0, 6200, 15800],
                    lookAtMeters: [0, 4200, -56000],
                    verticalFovDegrees: 62,
                },
            },
        };
    }

    async function createSouthernFranceTexturedSceneCapture(payload, canvas) {
        const THREE = await import('/vendor/three.module.js');
        const { OBJLoader } = await import('/vendor/loaders/OBJLoader.js');
        const { TGALoader } = await import('/vendor/loaders/TGALoader.js');
        const width = canvas.width;
        const height = canvas.height;
        const sceneDepthMaxMeters = numberOrDefault(payload.sceneDepthMaxMeters, 150000);
        const daylightSample = payload.daylightSample;
        const threeCanvas = document.createElement('canvas');
        threeCanvas.width = width;
        threeCanvas.height = height;
        const renderer = new THREE.WebGLRenderer({
            canvas: threeCanvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x87a9d8, 1);
        if ('toneMapping' in renderer) {
            renderer.toneMapping = THREE.NoToneMapping;
        }

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87a9d8);
        const cameraConfig = southernFranceSunsetCameraConfig(THREE, payload);
        const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, sceneDepthMaxMeters);
        camera.position.fromArray(cameraConfig.cameraPositionMeters);
        camera.lookAt(new THREE.Vector3(...cameraConfig.lookAtMeters));
        camera.updateMatrixWorld(true);
        camera.updateProjectionMatrix();

        const omitTerrainMesh = payload.omitTerrainMesh === true;
        const floorKind = payload.floorKind === 'ocean' ? 'ocean' : 'terrain-domain';
        const textureSetup = await loadSouthernFranceDiffuseTextures(THREE, TGALoader);
        const sharedMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.14, 0.235, 0.105),
            roughness: 0.96,
            metalness: 0,
            side: THREE.DoubleSide,
        });
        const materialsById = new Map();
        const meshes = [];
        const transform = southernFranceTransform();
        if (!omitTerrainMesh) {
            const obj = await new OBJLoader().loadAsync(
                './assets/southern-france-blender-obj/Mountain Range in Southern France.obj',
            );
            obj.name = 'southern-france-obj-root';
            obj.traverse((child) => {
                if (!child.isMesh) {
                    return;
                }
                child.geometry = child.geometry.clone();
                transformSouthernFranceGeometry(child.geometry, transform);
                child.geometry.computeVertexNormals();
                child.geometry.computeBoundingSphere();
                const materialId = southernFranceMaterialIdFromMaterial(child.material);
                child.material = southernFranceDiffuseMaterial({
                    THREE,
                    materialId,
                    textureSetup,
                    sharedMaterial,
                    materialsById,
                });
                child.name = `southern-france-terrain-${meshes.length}`;
                child.userData = {
                    kind: 'subjective-southern-france-terrain',
                    materialPolicy: 'diffuse-tga-only',
                    materialId,
                };
                meshes.push(child);
            });
            scene.add(obj);
        }

        const ground = createSphericalEarthFloorMesh({
            THREE,
            cameraConfig,
            algorithmCameraWorldPositionMeters: payload.cameraWorldPositionMeters,
            material: groundMaterialForPayload({
                THREE,
                payload,
                floorKind,
            }),
        });
        ground.name = floorKind === 'ocean'
            ? 'southern-france-diagnostic-ocean-floor'
            : 'southern-france-bottom-ground';
        ground.userData = {
            ...ground.userData,
            kind: 'subjective-southern-france-spherical-ground',
            geometryPolicy: 'observer-local-spherical-earth-mesh',
        };
        scene.add(ground);
        meshes.push(ground);

        scene.add(new THREE.AmbientLight(0xffffff, 0.06));
        const light = new THREE.DirectionalLight(0xffffff, numberOrDefault(payload.sceneDirectionalLightIntensity, 2.4));
        const sceneSunDirection = sceneDirectionFromObserverLocalSun(daylightSample.observerLocalDirection);
        light.position.set(
            sceneSunDirection[0] * 50000,
            sceneSunDirection[1] * 50000,
            sceneSunDirection[2] * 50000,
        );
        light.target.position.set(...cameraConfig.lookAtMeters);
        scene.add(light);
        scene.add(light.target);
        scene.updateMatrixWorld(true);

        const colorBytes = renderSceneColorBytes({
            THREE,
            renderer,
            scene,
            camera,
            width,
            height,
        });
        const distanceCapture = buildRaycasterSceneDistanceCapture({
            THREE,
            meshes,
            camera,
            width,
            height,
            sceneDepthMaxMeters,
        });
        const hitPixelCount = distanceCapture.hitPixelCount;
        const depthSummary = summarizeEncodedDepthBytes(distanceCapture.depthBytes, distanceCapture.hitMaskBytes);
        renderer.dispose();

        return {
            status: 'accepted',
            sceneColorTexture: {
                width,
                height,
                rgbaBytes: Array.from(colorBytes),
                coordinateConvention: 'webgl-bottom-left',
                purpose: 'browser Three Southern France diffuse daylight row color',
            },
            sceneDepthTexture: {
                width,
                height,
                rgbaBytes: Array.from(distanceCapture.depthBytes),
                coordinateConvention: 'webgl-bottom-left',
                encoding: 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
                sceneDepthMaxMeters,
            },
            sceneHitTexture: sceneHitTexturePacket({
                width,
                height,
                hitMaskBytes: distanceCapture.hitMaskBytes,
                purpose: 'browser Three Southern France daylight-row hit mask',
            }),
            selectedPixels: browserSubjectiveSelectedPixels(width, height),
            inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
            inverseViewMatrix: Array.from(camera.matrixWorld.elements),
            sceneDepthMaxMeters,
            hitPixelCount,
            summary: {
                kind: 'browser-three-southern-france-diffuse-daylight-row-capture',
                rowId: daylightSample.id,
                rowLabel: daylightSample.label,
                localSolarTime: daylightSample.localSolarTime,
                colorSource: 'Three.WebGLRenderTarget',
                depthSource: 'Three.Raycaster per pixel',
                meshCount: meshes.length,
                hitPixelCount,
                depthSummary,
                viewportPixels: [width, height],
                date: daylightSample.date,
                location: daylightSample.location,
                sun: {
                    altitudeDegrees: daylightSample.altitudeDegrees,
                    azimuthDegrees: daylightSample.azimuthDegrees,
                    hourAngleDegrees: daylightSample.hourAngleDegrees,
                    observerLocalDirection: daylightSample.observerLocalDirection,
                    sceneDirection: sceneSunDirection,
                    policy: 'five evenly spaced daylight samples from sunrise through sunset',
                },
                terrain: {
                    asset: 'Mountain Range in Southern France.obj',
                    materialPolicy: omitTerrainMesh
                        ? 'terrain-mesh-omitted-ocean-floor-diagnostic'
                        : 'diffuse-tga-only-no-shadows',
                    omitTerrainMesh,
                    floorKind,
                    helperGroundGeometryPolicy: 'observer-local-spherical-earth-mesh',
                    loadedDiffuseTextureCount: textureSetup.loadedCount,
                    sourceLineage: 'local-second-order Southern France diffuse no-shadow subjective lineage',
                    cameraProfile: 'accepted-high-southern-france-obj-ridge-view-yawed-to-sunset',
                    cameraPositionMeters: cameraConfig.cameraPositionMeters,
                    lookAtMeters: cameraConfig.lookAtMeters,
                    verticalFovDegrees: 62,
                    cameraYawPolicy: cameraConfig.cameraYawPolicy,
                    transform,
                },
            },
        };
    }

    function renderSceneColorBytes({ THREE, renderer, scene, camera, width, height }) {
        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: true,
            stencilBuffer: false,
        });
        const bytes = new Uint8Array(width * height * 4);
        renderer.setRenderTarget(renderTarget);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, bytes);
        renderer.setRenderTarget(null);
        renderTarget.dispose();
        return bytes;
    }

    function buildLocalFlatSceneDistanceCapture({
        THREE,
        renderer,
        scene,
        camera,
        raycastObjects,
        width,
        height,
        sceneDepthMaxMeters,
        metersPerSceneUnit,
        capturePolicy,
        raycastCaptureOptions,
    }) {
        if (capturePolicy === 'renderer-distance') {
            return renderSceneDistanceCapture({
                THREE,
                renderer,
                scene,
                camera,
                width,
                height,
                sceneDepthMaxMeters,
                distanceMultiplier: metersPerSceneUnit,
            });
        }

        const capture = buildRaycasterSceneDistanceCapture({
            THREE,
            meshes: raycastObjects,
            camera,
            width,
            height,
            sceneDepthMaxMeters,
            distanceMultiplier: metersPerSceneUnit,
            ...(raycastCaptureOptions ?? {}),
        });

        return Object.freeze({
            ...capture,
            capturePolicy: 'raycaster',
            depthSource: 'geometry-owned exact flat ground plus scene-object raycaster hit distances, converted to Algorithm32 meters',
            hitMaskSource: 'local flat scene raycaster hit mask',
        });
    }

    function renderSceneDistanceCapture({
        THREE,
        renderer,
        scene,
        camera,
        width,
        height,
        sceneDepthMaxMeters,
        distanceMultiplier,
    }) {
        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: true,
            stencilBuffer: false,
        });
        const distanceBytes = new Uint8Array(width * height * 4);
        const depthBytes = new Uint8Array(width * height * 4);
        const hitMaskBytes = new Uint8Array(width * height * 4);
        const previousOverrideMaterial = scene.overrideMaterial;
        const previousBackground = scene.background;
        const previousClearColor = renderer.getClearColor(new THREE.Color());
        const previousClearAlpha = renderer.getClearAlpha();
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uCameraWorldPosition: { value: camera.getWorldPosition(new THREE.Vector3()) },
                uDistanceMultiplier: { value: distanceMultiplier },
                uSceneDepthMaxMeters: { value: sceneDepthMaxMeters },
            },
            vertexShader: `
                varying vec3 vWorldPosition;

                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                precision highp float;

                uniform vec3 uCameraWorldPosition;
                uniform float uDistanceMultiplier;
                uniform float uSceneDepthMaxMeters;
                varying vec3 vWorldPosition;

                vec3 packNormalizedDistance24(float value) {
                    float normalized = clamp(value, 0.0, 1.0);
                    float packed = floor(normalized * 16777214.0 + 0.5);
                    float red = floor(packed / 65536.0);
                    packed -= red * 65536.0;
                    float green = floor(packed / 256.0);
                    float blue = packed - green * 256.0;
                    return vec3(red, green, blue) / 255.0;
                }

                void main() {
                    float distanceMeters = distance(vWorldPosition, uCameraWorldPosition) * uDistanceMultiplier;
                    gl_FragColor = vec4(packNormalizedDistance24(distanceMeters / uSceneDepthMaxMeters), 1.0);
                }
            `,
        });

        renderer.setRenderTarget(renderTarget);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        scene.overrideMaterial = material;
        scene.background = null;
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, distanceBytes);
        scene.overrideMaterial = previousOverrideMaterial;
        scene.background = previousBackground;
        renderer.setClearColor(previousClearColor, previousClearAlpha);
        renderer.setRenderTarget(null);
        renderTarget.dispose();
        material.dispose();

        let hitPixelCount = 0;
        for (let index = 0; index < width * height; index += 1) {
            const offset = index * 4;
            const hit = distanceBytes[offset] > 0
                || distanceBytes[offset + 1] > 0
                || distanceBytes[offset + 2] > 0;
            depthBytes[offset] = hit ? distanceBytes[offset] : 0;
            depthBytes[offset + 1] = hit ? distanceBytes[offset + 1] : 0;
            depthBytes[offset + 2] = hit ? distanceBytes[offset + 2] : 0;
            depthBytes[offset + 3] = 255;
            hitMaskBytes[offset] = hit ? 255 : 0;
            hitMaskBytes[offset + 1] = hit ? 255 : 0;
            hitMaskBytes[offset + 2] = hit ? 255 : 0;
            hitMaskBytes[offset + 3] = 255;
            if (hit) {
                hitPixelCount += 1;
            }
        }

        return Object.freeze({
            depthBytes,
            hitMaskBytes,
            hitPixelCount,
            capturePolicy: 'renderer-distance',
            depthSource: 'renderer override-material fragment distance pass, converted from scene units to Algorithm32 meters',
            hitMaskSource: 'renderer override-material fragment coverage mask',
        });
    }

    function summarizeRenderedSceneHitDiagnostics({
        colorBytes,
        hitMaskBytes,
        boxHitMaskBytes,
        boxObjectHitCounts,
        boxObjectColorExtents,
        groundObjectName,
    }) {
        const objectHitCounts = { ...boxObjectHitCounts };
        const objectColorExtents = {};
        for (const [name, extents] of Object.entries(boxObjectColorExtents ?? {})) {
            objectColorExtents[name] = {
                minRgb: [...extents.minRgb],
                maxRgb: [...extents.maxRgb],
            };
        }

        let groundHitCount = 0;
        for (let offset = 0; offset < hitMaskBytes.length; offset += 4) {
            const hasRenderedHit = hitMaskBytes[offset] > 127;
            const hasBoxHit = boxHitMaskBytes?.[offset] > 127;
            if (!hasRenderedHit || hasBoxHit) {
                continue;
            }

            groundHitCount += 1;
            updateObjectColorExtents(objectColorExtents, groundObjectName, [
                colorBytes[offset],
                colorBytes[offset + 1],
                colorBytes[offset + 2],
                colorBytes[offset + 3],
            ]);
        }
        objectHitCounts[groundObjectName] = groundHitCount;

        return Object.freeze({
            objectHitCounts: Object.freeze(objectHitCounts),
            objectColorExtents: freezeObjectColorExtents(objectColorExtents),
        });
    }

    function dataUrlFromBottomLeftRgbaBytes({ width, height, rgbaBytes }) {
        const source = rgbaBytes instanceof Uint8Array
            ? rgbaBytes
            : Uint8Array.from(rgbaBytes);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
            throw new Error('Unable to create 2D context for scene color PNG readback.');
        }

        const imageData = context.createImageData(width, height);
        const rowLength = width * 4;
        for (let y = 0; y < height; y += 1) {
            const sourceY = height - 1 - y;
            const sourceOffset = sourceY * rowLength;
            const targetOffset = y * rowLength;
            imageData.data.set(source.subarray(sourceOffset, sourceOffset + rowLength), targetOffset);
        }
        context.putImageData(imageData, 0, 0);

        return canvas.toDataURL('image/png');
    }

    function planetSphereHorizonTangentPoint({ radiusSceneUnits, observerAltitudeSceneUnits }) {
        const cameraRadiusSceneUnits = radiusSceneUnits + observerAltitudeSceneUnits;
        if (!Number.isFinite(cameraRadiusSceneUnits) || cameraRadiusSceneUnits <= 0) {
            return Object.freeze([0, 0, 0]);
        }

        const radiusRatio = radiusSceneUnits / cameraRadiusSceneUnits;
        const tangentY = -radiusSceneUnits + radiusSceneUnits * radiusRatio;
        const tangentZ = -radiusSceneUnits * Math.sqrt(Math.max(0, 1 - radiusRatio * radiusRatio));

        return Object.freeze([0, tangentY, tangentZ]);
    }

    function renderPlanetGeometryGroundObject({
        THREE,
        bottomRadiusMeters,
        observerAltitudeMeters,
        scaleDenominator,
        radiusSceneUnits,
        observerAltitudeSceneUnits,
        horizonDistanceSceneUnits,
        horizonTangentPointSceneUnits,
        groundDisplayMode,
        planetSceneFacts,
        planetSceneDefinition,
    }) {
        const shadowsEnabled = planetSceneShadowsEnabled(planetSceneDefinition);
        const geometry = createPlanetLocalSphericalGroundPatchGeometry({
            THREE,
            radiusSceneUnits,
            horizonDistanceSceneUnits,
            planetSceneFacts,
            planetSceneDefinition,
        });
        const ground = new THREE.Mesh(
            geometry,
            planetSceneMaterial(THREE, planetSceneFacts.displayRgba.ground, planetSceneDefinition, {
                depthWrite: true,
                depthTest: true,
                side: THREE.FrontSide,
            }),
        );

        ground.name = 'scaled-planet-size-ground-sphere';
        ground.renderOrder = -100;
        ground.receiveShadow = shadowsEnabled;
        ground.userData = {
            kind: 'diagnostic-local-spherical-ground-patch',
            owner: 'geometry',
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            radiusSceneUnits,
            observerAltitudeSceneUnits,
            horizonDistanceSceneUnits,
            horizonTangentPointSceneUnits,
            groundDisplayMode,
            colorPolicy: 'visible-local-spherical-patch-color',
            hitPolicy: 'visual-mesh-not-semantic-hit-authority',
            endpointKind: 'diagnostic-scene-object',
            metersPerSceneUnit: scaleDenominator,
            groundPatch: geometry.userData.groundPatch,
            shadowPolicy: planetSceneDefinition.shadowPolicy,
        };

        return ground;
    }

    function createPlanetLocalSphericalGroundPatchGeometry({
        THREE,
        radiusSceneUnits,
        horizonDistanceSceneUnits,
        planetSceneFacts,
        planetSceneDefinition,
    }) {
        const specs = Object.values(planetSceneDefinition.objectSpecs ?? {})
            .filter((spec) =>
                isDiagnosticColorBoxSpecKind(spec?.kind)
                && Array.isArray(spec.centerXZ)
                && spec.centerXZ.length === 2
                && spec.centerXZ.every(Number.isFinite)
                && planetSceneBoxSizeIsValid(spec.sizeSceneUnits));
        const shadowFrame = planetSceneShadowFrame(planetSceneDefinition);
        const maxObjectSize = specs.reduce((maxSize, spec) => {
            const size = planetSceneBoxSizeTuple(spec.sizeSceneUnits);
            return Math.max(maxSize, size[0], size[1], size[2]);
        }, 1);
        const xExtent = Math.max(
            shadowFrame.extentSceneUnits,
            horizonDistanceSceneUnits * 1.2,
            maxObjectSize * 8,
            40,
        );
        const zMin = Math.min(
            -horizonDistanceSceneUnits * 1.8,
            ...specs.map((spec) => spec.centerXZ[1] - planetSceneBoxSizeTuple(spec.sizeSceneUnits)[2] * 8),
            -80,
        );
        const zMax = Math.max(
            horizonDistanceSceneUnits * 0.25,
            ...specs.map((spec) => spec.centerXZ[1] + planetSceneBoxSizeTuple(spec.sizeSceneUnits)[2] * 6),
            12,
        );
        const xSegments = positiveIntegerOrDefault(
            planetSceneFacts.groundSphereSegments.width,
            PLANET_GROUND_SPHERE_WIDTH_SEGMENTS,
        );
        const zSegments = positiveIntegerOrDefault(
            planetSceneFacts.groundSphereSegments.height,
            PLANET_GROUND_SPHERE_HEIGHT_SEGMENTS,
        );
        const positions = [];
        const indices = [];

        for (let zIndex = 0; zIndex <= zSegments; zIndex += 1) {
            const zRatio = zIndex / zSegments;
            const z = zMin + (zMax - zMin) * zRatio;
            for (let xIndex = 0; xIndex <= xSegments; xIndex += 1) {
                const xRatio = xIndex / xSegments;
                const x = -xExtent + xExtent * 2 * xRatio;
                positions.push(x, planetSphereSurfaceYAt({ x, z, radiusSceneUnits }), z);
            }
        }

        for (let zIndex = 0; zIndex < zSegments; zIndex += 1) {
            for (let xIndex = 0; xIndex < xSegments; xIndex += 1) {
                const a = zIndex * (xSegments + 1) + xIndex;
                const b = a + 1;
                const c = (zIndex + 1) * (xSegments + 1) + xIndex;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        geometry.userData.groundPatch = Object.freeze({
            kind: 'local-spherical-ground-patch',
            surfacePolicy: 'vertices-sampled-from-analytic-scaled-sphere',
            xRangeSceneUnits: Object.freeze([-xExtent, xExtent]),
            zRangeSceneUnits: Object.freeze([zMin, zMax]),
            xSegments,
            zSegments,
            shadowReceiverPolicy: 'visible-patch-receives-three-shadow-map',
        });

        return geometry;
    }

    function renderPlanetGeometryGroundRaycastObject({
        THREE,
        bottomRadiusMeters,
        observerAltitudeMeters,
        scaleDenominator,
        radiusSceneUnits,
        observerAltitudeSceneUnits,
        horizonDistanceSceneUnits,
        horizonTangentPointSceneUnits,
        groundDisplayMode,
        planetSceneFacts,
    }) {
        const sphere = new THREE.Object3D();

        sphere.name = 'scaled-planet-size-ground-sphere';
        sphere.position.set(0, -radiusSceneUnits, 0);
        sphere.userData = {
            kind: 'diagnostic-scaled-planet-sphere',
            owner: 'geometry',
            bottomRadiusMeters,
            observerAltitudeMeters,
            scaleDenominator,
            radiusSceneUnits,
            observerAltitudeSceneUnits,
            horizonDistanceSceneUnits,
            horizonTangentPointSceneUnits,
            groundDisplayMode,
            colorPolicy: 'raycast-endpoint-lambert-color',
            hitPolicy: 'geometry-owned-exact-sphere-raycast',
            endpointKind: 'diagnostic-scene-object',
            metersPerSceneUnit: scaleDenominator,
            displayRgba: planetSceneFacts.displayRgba.ground,
            groundSphereWidthSegments: planetSceneFacts.groundSphereSegments.width,
            groundSphereHeightSegments: planetSceneFacts.groundSphereSegments.height,
        };
        sphere.raycast = (raycaster, intersects) => {
            const center = new THREE.Vector3();
            center.setFromMatrixPosition(sphere.matrixWorld);

            const ray = raycaster.ray;
            const oc = new THREE.Vector3().subVectors(ray.origin, center);
            const b = oc.dot(ray.direction);
            const c = oc.dot(oc) - radiusSceneUnits ** 2;
            const discriminant = b * b - c;

            if (discriminant < 0) {
                return;
            }

            const root = Math.sqrt(discriminant);
            const near = -b - root;
            const far = -b + root;
            const distance = near >= raycaster.near ? near : far >= raycaster.near ? far : null;

            if (!Number.isFinite(distance) || distance < raycaster.near || distance > raycaster.far) {
                return;
            }

            const point = ray.at(distance, new THREE.Vector3());
            const normal = new THREE.Vector3().subVectors(point, center).normalize();

            intersects.push({
                distance,
                point,
                object: sphere,
                normal,
            });
        };
        sphere.updateMatrixWorld(true);

        return sphere;
    }

    function resolvePlanetSceneHitRgba({
        THREE,
        hit,
        planetSceneFacts,
        planetSceneDefinition,
        distantSunDirection,
        shadowObjects,
        shadowRayFarSceneUnits,
        shadowDiagnostics,
    }) {
        const baseRgba = planetSceneBaseDisplayRgba(THREE, hit, planetSceneFacts);
        if (planetSceneDefinition.lightingPolicy !== 'directional-light-from-distant-sun') {
            return baseRgba;
        }

        const normal = hit.normal?.clone?.().normalize?.();
        if (!normal) {
            return baseRgba;
        }

        const sceneSunDirection = sceneDirectionFromObserverLocalSun(normalize3(distantSunDirection));
        const lambert = Math.max(0, normal.dot(new THREE.Vector3(...sceneSunDirection)));
        const shadowed = lambert > 0 && planetSceneShadowsEnabled(planetSceneDefinition)
            ? planetSceneHitIsShadowed({
                THREE,
                hit,
                sceneSunDirection,
                shadowObjects,
                shadowRayFarSceneUnits,
            })
            : false;
        if (shadowed && shadowDiagnostics) {
            shadowDiagnostics.shadowedHitPixelCount += 1;
        }
        const intensity = planetSceneEndpointLightFactor({ lambert, shadowed });

        return Object.freeze([
            clampByte(baseRgba[0] * intensity),
            clampByte(baseRgba[1] * intensity),
            clampByte(baseRgba[2] * intensity),
            baseRgba[3],
        ]);
    }

    function planetSceneEndpointLightFactor({ lambert, shadowed }) {
        const ambient = PLANET_SCENE_AMBIENT_LIGHT_INTENSITY;
        const directional = PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY * lambert * (shadowed ? 0 : 1);
        const maximum = Math.max(1, PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY);

        return Math.max(0, Math.min(1, (ambient + directional) / maximum));
    }

    function planetSceneHitIsShadowed({
        THREE,
        hit,
        sceneSunDirection,
        shadowObjects,
        shadowRayFarSceneUnits,
    }) {
        if (!Array.isArray(shadowObjects) || shadowObjects.length === 0 || !hit?.point) {
            return false;
        }

        const direction = new THREE.Vector3(...sceneSunDirection).normalize();
        const origin = hit.point.clone().addScaledVector(direction, 0.0001);
        const raycaster = new THREE.Raycaster(origin, direction, 0.0001, shadowRayFarSceneUnits);
        const blockers = raycaster.intersectObjects(shadowObjects, false)
            .filter((blocker) => blocker.object !== hit.object && blocker.distance > 0.0001);

        return blockers.length > 0;
    }

    function planetSceneBaseDisplayRgba(THREE, hit, planetSceneFacts) {
        if (Array.isArray(hit.object?.userData?.displayRgba)) {
            return hit.object.userData.displayRgba;
        }

        const material = Array.isArray(hit.object?.material) ? hit.object.material[0] : hit.object?.material;
        if (material?.color) {
            return Object.freeze([
                clampByte(material.color.r * 255),
                clampByte(material.color.g * 255),
                clampByte(material.color.b * 255),
                255,
            ]);
        }

        return hit.object?.name?.includes('green-box')
            ? planetSceneFacts.displayRgba.greenBox
            : planetSceneFacts.displayRgba.ground;
    }

    function clampByte(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
    }

    function renderPlanetSceneObjects({
        THREE,
        scene,
        sceneDefinition,
        radiusSceneUnits,
        metersPerSceneUnit,
        distantSunDirection,
    }) {
        const visualObjects = [];
        const raycastObjects = [];
        const sceneObjects = [];

        for (const objectName of sceneDefinition.objectNames) {
            const renderer = planetSceneObjectRenderers().get(objectName);
            if (!renderer) {
                throw new Error(`No planet scene object renderer registered for ${objectName}.`);
            }
            const rendered = renderer({
                THREE,
                objectName,
                objectSpec: sceneDefinition.objectSpecs?.[objectName] ?? null,
                sceneDefinition,
                radiusSceneUnits,
                metersPerSceneUnit,
                distantSunDirection,
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
            [PLANET_SCENE_OBJECT_NAMES.distantSunLight, renderPlanetDistantSunLightObject],
            [PLANET_SCENE_OBJECT_NAMES.nearRedBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.nearGreenBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.middleGreenBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.middleYellowBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.farBlueBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.farCyanBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.farGreenBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.veryFarMagentaBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.veryFarGreenBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionNearYellowBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionCloseSingleStoryBuildingBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionMidWhiteBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionFarOrangeBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionDistantCyanBox, renderPlanetColorBoxObject],
            [PLANET_SCENE_OBJECT_NAMES.unionDenaliOrangeBox, renderPlanetColorBoxObject],
        ]);
    }

    function renderPlanetDistantSunLightObject({ THREE, sceneDefinition, radiusSceneUnits, distantSunDirection }) {
        const sceneSunDirection = sceneDirectionFromObserverLocalSun(normalize3(distantSunDirection));
        const ambientLight = new THREE.AmbientLight(0xffffff, PLANET_SCENE_AMBIENT_LIGHT_INTENSITY);
        const light = new THREE.DirectionalLight(0xffffff, PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY);
        const shadowsEnabled = planetSceneShadowsEnabled(sceneDefinition);
        const shadowFrame = planetSceneShadowFrame(sceneDefinition);
        const distance = shadowsEnabled
            ? Math.max(80, shadowFrame.extentSceneUnits * 3)
            : Math.max(1, radiusSceneUnits);
        const target = shadowsEnabled
            ? shadowFrame.focusSceneUnits
            : [0, 0, 0];

        ambientLight.name = 'distant-sun-endpoint-material-fill-light';
        ambientLight.userData = {
            kind: 'diagnostic-distant-sun-endpoint-material-fill-light',
            ambientIntensity: PLANET_SCENE_AMBIENT_LIGHT_INTENSITY,
            ambientToDirectionalRatio: PLANET_SCENE_AMBIENT_TO_DIRECTIONAL_RATIO,
            note: 'Endpoint-scene material color preservation before Algorithm32 composition.',
        };
        light.name = 'distant-sun-directional-light';
        light.castShadow = shadowsEnabled;
        light.position.set(
            target[0] + sceneSunDirection[0] * distance,
            target[1] + sceneSunDirection[1] * distance,
            target[2] + sceneSunDirection[2] * distance,
        );
        light.target.position.set(target[0], target[1], target[2]);
        if (shadowsEnabled) {
            const extent = shadowFrame.extentSceneUnits;
            light.shadow.mapSize.width = 2048;
            light.shadow.mapSize.height = 2048;
            light.shadow.camera.left = -extent;
            light.shadow.camera.right = extent;
            light.shadow.camera.top = extent;
            light.shadow.camera.bottom = -extent;
            light.shadow.camera.near = 0.5;
            light.shadow.camera.far = distance + extent * 3;
            light.shadow.bias = 0;
            light.shadow.normalBias = 0;
        }
        light.userData = {
            kind: 'diagnostic-distant-sun-directional-light',
            directionToLightScene: sceneSunDirection,
            observerLocalDirection: distantSunDirection,
            ambientIntensity: PLANET_SCENE_AMBIENT_LIGHT_INTENSITY,
            directionalIntensity: PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY,
            shadowPolicy: sceneDefinition.shadowPolicy,
            shadowFrame,
        };

        return Object.freeze({
            visualObjects: Object.freeze([ambientLight, light, light.target]),
            raycastObjects: Object.freeze([]),
            description: Object.freeze({
                name: PLANET_SCENE_OBJECT_NAMES.distantSunLight,
                kind: 'distant-sun-light-source',
                sceneDirection: sceneSunDirection,
                observerLocalDirection: distantSunDirection,
                renderPolicy: 'registered-scene-object-renderer',
                ambientToDirectionalRatio: PLANET_SCENE_AMBIENT_TO_DIRECTIONAL_RATIO,
                shadowPolicy: sceneDefinition.shadowPolicy,
                shadowFrame,
            }),
        });
    }

    function planetSceneShadowFrame(sceneDefinition) {
        const activeObjectNames = new Set(Array.isArray(sceneDefinition.objectNames)
            ? sceneDefinition.objectNames
            : []);
        const specs = Object.entries(sceneDefinition.objectSpecs ?? {})
            .filter(([objectName, spec]) => {
                return activeObjectNames.has(objectName)
                    && objectName !== PLANET_SCENE_OBJECT_NAMES.distantSunLight
                    && isDiagnosticColorBoxSpecKind(spec?.kind)
                    && planetSceneShadowRegionForSpec(spec) === 'camera-local'
                    && Array.isArray(spec.centerXZ)
                    && spec.centerXZ.length === 2
                    && spec.centerXZ.every(Number.isFinite)
                    && planetSceneBoxSizeIsValid(spec.sizeSceneUnits);
            })
            .map(([, spec]) => spec);
        if (specs.length === 0) {
            return Object.freeze({
                focusSceneUnits: Object.freeze([0, 0, 0]),
                extentSceneUnits: 90,
                policy: 'default-local-shadow-frustum',
            });
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        let maxSize = 0;
        for (const spec of specs) {
            const size = planetSceneBoxSizeTuple(spec.sizeSceneUnits);
            const halfX = size[0] * 0.5;
            const halfZ = size[2] * 0.5;
            minX = Math.min(minX, spec.centerXZ[0] - halfX);
            maxX = Math.max(maxX, spec.centerXZ[0] + halfX);
            minZ = Math.min(minZ, spec.centerXZ[1] - halfZ);
            maxZ = Math.max(maxZ, spec.centerXZ[1] + halfZ);
            maxSize = Math.max(maxSize, size[0], size[1], size[2]);
        }

        const spanX = Math.max(maxX - minX, maxSize);
        const spanZ = Math.max(maxZ - minZ, maxSize);
        const extent = Math.max(4, spanX * 0.5 + maxSize * 2 + 4, spanZ * 0.5 + maxSize * 2 + 4);

        return Object.freeze({
            focusSceneUnits: Object.freeze([
                (minX + maxX) * 0.5,
                0,
                (minZ + maxZ) * 0.5,
            ]),
            extentSceneUnits: extent,
            policy: 'local-scene-shadow-frustum-from-object-specs',
        });
    }

    function renderPlanetColorBoxObject({
        THREE,
        objectName,
        objectSpec,
        sceneDefinition,
        radiusSceneUnits,
        metersPerSceneUnit,
    }) {
        const { centerXZ, sizeSceneUnits, displayRgba, spectralCoverageHint, shadowRegion } =
            colorBoxObjectSpec(objectName, objectSpec);
        const material = planetSceneMaterial(THREE, displayRgba, sceneDefinition);
        const shadowsEnabled = planetSceneShadowsEnabled(sceneDefinition);
        const box = createPlanetDiagnosticColorBox({
            THREE,
            name: objectName,
            centerXZ,
            sizeSceneUnits,
            displayRgba,
            spectralCoverageHint,
            shadowRegion,
            radiusSceneUnits,
            metersPerSceneUnit,
            material,
        });
        box.castShadow = shadowsEnabled;
        box.receiveShadow = shadowsEnabled;

        return Object.freeze({
            visualObjects: Object.freeze([box]),
            raycastObjects: Object.freeze([box]),
            description: Object.freeze({
                name: objectName,
                kind: 'diagnostic-color-box',
                displayRgba,
                spectralCoverageHint,
                shadowRegion,
                renderPolicy: 'registered-scene-object-renderer',
                shadowPolicy: sceneDefinition.shadowPolicy,
            }),
        });
    }

    function planetSceneMaterial(THREE, displayRgba, sceneDefinition, options = {}) {
        const color = colorFromDisplayRgba(THREE, displayRgba);
        const configuration = { color, ...options };

        return sceneDefinition.lightingPolicy === 'directional-light-from-distant-sun'
            ? new THREE.MeshLambertMaterial(configuration)
            : new THREE.MeshBasicMaterial(configuration);
    }

    function colorBoxObjectSpec(objectName, objectSpec) {
        if (!isDiagnosticColorBoxSpecKind(objectSpec?.kind)
            || !Array.isArray(objectSpec.centerXZ)
            || objectSpec.centerXZ.length !== 2
            || !objectSpec.centerXZ.every(Number.isFinite)
            || !planetSceneBoxSizeIsValid(objectSpec.sizeSceneUnits)) {
            throw new Error(`Scene object ${objectName} requires a diagnostic-color-box object spec.`);
        }

        return Object.freeze({
            centerXZ: Object.freeze([...objectSpec.centerXZ]),
            sizeSceneUnits: planetSceneBoxSizeTuple(objectSpec.sizeSceneUnits),
            displayRgba: rgbaOrDefault(objectSpec.displayRgba, PLANET_SCENE_DISPLAY_RGBA.greenBox),
            spectralCoverageHint: typeof objectSpec.spectralCoverageHint === 'string'
                ? objectSpec.spectralCoverageHint
                : 'unspecified-color-box',
            shadowRegion: planetSceneShadowRegionForSpec(objectSpec),
        });
    }

    function planetSceneShadowRegionForSpec(spec) {
        return typeof spec?.shadowRegion === 'string' && spec.shadowRegion.length > 0
            ? spec.shadowRegion
            : 'camera-local';
    }

    function createPlanetDiagnosticColorBox({
        THREE,
        name,
        centerXZ,
        sizeSceneUnits,
        displayRgba,
        spectralCoverageHint,
        shadowRegion,
        radiusSceneUnits,
        metersPerSceneUnit,
        material,
    }) {
        const [x, z] = centerXZ;
        const surfaceY = planetSphereSurfaceYAt({ x, z, radiusSceneUnits });
        const box = new THREE.Mesh(
            new THREE.BoxGeometry(sizeSceneUnits[0], sizeSceneUnits[1], sizeSceneUnits[2]),
            material,
        );

        box.name = name;
        box.renderOrder = 0;
        box.position.set(x, surfaceY + sizeSceneUnits[1] * 0.5, z);
        box.userData.endpointKind = 'diagnostic-scene-object';
        box.userData.metersPerSceneUnit = metersPerSceneUnit;
        box.userData.displayRgba = displayRgba;
        box.userData.spectralCoverageHint = spectralCoverageHint;
        box.userData.shadowRegion = shadowRegion;
        box.updateMatrixWorld(true);

        return box;
    }

    function planetSphereSurfaceYAt({ x, z, radiusSceneUnits }) {
        const horizontalDistanceSquared = x * x + z * z;
        const offset = Math.sqrt(Math.max(0, radiusSceneUnits * radiusSceneUnits - horizontalDistanceSquared));

        return -radiusSceneUnits + offset;
    }

    function planetSceneFactsFromPayload(payload) {
        const candidate = payload.planetSceneFacts && typeof payload.planetSceneFacts === 'object'
            ? payload.planetSceneFacts
            : {};
        const displayRgba = candidate.displayRgba && typeof candidate.displayRgba === 'object'
            ? candidate.displayRgba
            : {};
        const lighting = candidate.lighting && typeof candidate.lighting === 'object'
            ? candidate.lighting
            : {};
        const groundSphereSegments = candidate.groundSphereSegments && typeof candidate.groundSphereSegments === 'object'
            ? candidate.groundSphereSegments
            : {};

        return Object.freeze({
            displayRgba: Object.freeze({
                sky: rgbaOrDefault(displayRgba.sky, PLANET_SCENE_DISPLAY_RGBA.sky),
                ground: rgbaOrDefault(displayRgba.ground, PLANET_SCENE_DISPLAY_RGBA.ground),
                greenBox: rgbaOrDefault(displayRgba.greenBox, PLANET_SCENE_DISPLAY_RGBA.greenBox),
            }),
            lighting: Object.freeze({
                ambientIntensity: numberOrDefault(
                    lighting.ambientIntensity,
                    PLANET_SCENE_AMBIENT_LIGHT_INTENSITY,
                ),
                directionalIntensity: numberOrDefault(
                    lighting.directionalIntensity,
                    PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY,
                ),
            }),
            groundSphereSegments: Object.freeze({
                width: positiveIntegerOrDefault(
                    groundSphereSegments.width,
                    PLANET_GROUND_SPHERE_WIDTH_SEGMENTS,
                ),
                height: positiveIntegerOrDefault(
                    groundSphereSegments.height,
                    PLANET_GROUND_SPHERE_HEIGHT_SEGMENTS,
                ),
            }),
            endpointRadianceScale: numberOrDefault(
                candidate.endpointRadianceScale,
                5200,
            ),
            materialPolicy: typeof candidate.materialPolicy === 'string'
                ? candidate.materialPolicy
                : 'visible-mesh-lambert-scene-color',
        });
    }

    function planetSceneDefinitionFromPayload(payload) {
        const candidate = payload.planetSceneDefinition && typeof payload.planetSceneDefinition === 'object'
            ? payload.planetSceneDefinition
            : {};
        const objectNames = Array.isArray(candidate.objectNames)
            ? candidate.objectNames.filter((name) => typeof name === 'string' && name.length > 0)
            : PLANET_SPHERE_GROUND_SCENE.objectNames;
        const objectSpecs = sceneObjectSpecsOrDefault(candidate.objectSpecs, PLANET_SPHERE_GROUND_SCENE.objectSpecs);

        const shadowPolicy = typeof candidate.shadowPolicy === 'string' && candidate.shadowPolicy.length > 0
            ? candidate.shadowPolicy
            : PLANET_SPHERE_GROUND_SCENE.shadowPolicy;
        const shadowsEnabled = shadowPolicy === 'raycast-shadows-from-distant-sun';
        const lightingPolicy = shadowsEnabled
            ? 'directional-light-from-distant-sun'
            : typeof candidate.lightingPolicy === 'string' && candidate.lightingPolicy.length > 0
                ? candidate.lightingPolicy
                : PLANET_SPHERE_GROUND_SCENE.lightingPolicy;
        const resolvedObjectNames = shadowsEnabled
            && !objectNames.includes(PLANET_SCENE_OBJECT_NAMES.distantSunLight)
            ? Object.freeze([PLANET_SCENE_OBJECT_NAMES.distantSunLight, ...objectNames])
            : Object.freeze([...objectNames]);

        return Object.freeze({
            name: typeof candidate.name === 'string' && candidate.name.length > 0
                ? candidate.name
                : PLANET_SPHERE_GROUND_SCENE.name,
            objectNames: resolvedObjectNames,
            objectSpecs,
            groundPolicy: typeof candidate.groundPolicy === 'string' && candidate.groundPolicy.length > 0
                ? candidate.groundPolicy
                : PLANET_SPHERE_GROUND_SCENE.groundPolicy,
            lightingPolicy,
            shadowPolicy,
        });
    }

    function planetSceneShadowsEnabled(sceneDefinition) {
        return sceneDefinition?.shadowPolicy === 'raycast-shadows-from-distant-sun';
    }

    function planetSceneLightingSummary(sceneDefinition, distantSunDirection) {
        return Object.freeze({
            kind: sceneDefinition.lightingPolicy,
            shadowPolicy: sceneDefinition.shadowPolicy,
            observerLocalDirection: distantSunDirection,
            sceneDirection: sceneDirectionFromObserverLocalSun(distantSunDirection),
            ambientIntensity: PLANET_SCENE_AMBIENT_LIGHT_INTENSITY,
            directionalIntensity: PLANET_SCENE_DIRECTIONAL_LIGHT_INTENSITY,
            shadowsImplyShading: planetSceneShadowsEnabled(sceneDefinition)
                ? sceneDefinition.lightingPolicy === 'directional-light-from-distant-sun'
                : true,
        });
    }

    function sceneObjectSpecsOrDefault(candidate, fallback) {
        const source = candidate && typeof candidate === 'object' ? candidate : fallback;
        const specs = {};

        for (const [name, spec] of Object.entries(source)) {
            if (!isDiagnosticColorBoxSpecKind(spec?.kind)) {
                continue;
            }
            if (!Array.isArray(spec.centerXZ)
                || spec.centerXZ.length !== 2
                || !spec.centerXZ.every(Number.isFinite)
                || !planetSceneBoxSizeIsValid(spec.sizeSceneUnits)) {
                continue;
            }
            specs[name] = Object.freeze({
                kind: 'diagnostic-color-box',
                centerXZ: Object.freeze([...spec.centerXZ]),
                sizeSceneUnits: planetSceneBoxSizeTuple(spec.sizeSceneUnits),
                displayRgba: rgbaOrDefault(spec.displayRgba, PLANET_SCENE_DISPLAY_RGBA.greenBox),
                spectralCoverageHint: typeof spec.spectralCoverageHint === 'string'
                    ? spec.spectralCoverageHint
                    : 'unspecified-color-box',
                shadowRegion: planetSceneShadowRegionForSpec(spec),
            });
        }

        return Object.freeze(specs);
    }

    function planetSceneBoxSizeIsValid(value) {
        return (Number.isFinite(value) && value > 0)
            || (Array.isArray(value) && value.length === 3 && value.every((entry) => Number.isFinite(entry) && entry > 0));
    }

    function planetSceneBoxSizeTuple(value) {
        if (Array.isArray(value)) {
            return Object.freeze([value[0], value[1], value[2]]);
        }

        return Object.freeze([value, value, value]);
    }

    function isDiagnosticColorBoxSpecKind(kind) {
        return kind === 'diagnostic-color-box' || kind === 'diagnostic-green-box';
    }

    function rgbaOrDefault(value, fallback) {
        if (Array.isArray(value) && value.length === 4 && value.every(Number.isFinite)) {
            return Object.freeze(value.map((channel) => Math.max(0, Math.min(255, Math.round(channel)))));
        }

        return Object.freeze([...fallback]);
    }

    function positiveIntegerOrDefault(value, fallback) {
        return Number.isInteger(value) && value > 0 ? value : fallback;
    }

    function colorFromDisplayRgba(THREE, rgba) {
        return new THREE.Color(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255);
    }

    function buildRaycasterSceneDistanceCapture({
        THREE,
        meshes,
        camera,
        width,
        height,
        sceneDepthMaxMeters,
        distanceMultiplier = 1,
        colorResolver = null,
        noHitColorRgba = [0, 0, 0, 255],
        diagnosticColorBytes = null,
        raycastSampleOffsets = [[0.5, 0.5]],
        preferNonGroundSampleHits = false,
    }) {
        const raycaster = new THREE.Raycaster();
        const representableFarSceneUnits = sceneDepthMaxMeters / distanceMultiplier;
        const depthBytes = new Uint8Array(width * height * 4);
        const hitMaskBytes = new Uint8Array(width * height * 4);
        const colorBytes = typeof colorResolver === 'function'
            ? new Uint8Array(width * height * 4)
            : null;
        const hasDiagnosticColorBytes = diagnosticColorBytes instanceof Uint8Array
            && diagnosticColorBytes.length === width * height * 4;
        const objectHitCounts = {};
        const objectColorExtents = {};
        const objectDistanceExtents = {};
        const objectFirstHitCoordinates = {};
        for (let index = 0; index < width * height; index += 1) {
            const offset = index * 4;
            depthBytes[offset + 3] = 255;
            hitMaskBytes[offset + 3] = 255;
            if (colorBytes) {
                colorBytes[offset] = noHitColorRgba[0];
                colorBytes[offset + 1] = noHitColorRgba[1];
                colorBytes[offset + 2] = noHitColorRgba[2];
                colorBytes[offset + 3] = noHitColorRgba[3];
            }
        }

        let hitPixelCount = 0;
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const hit = raycastPixelSample({
                    raycaster,
                    meshes,
                    camera,
                    x,
                    y,
                    width,
                    height,
                    representableFarSceneUnits,
                    raycastSampleOffsets,
                    preferNonGroundSampleHits,
                });
                if (!hit) {
                    continue;
                }

                hitPixelCount += 1;
                const objectName = hit.object?.name ?? 'unknown';
                objectHitCounts[objectName] = (objectHitCounts[objectName] ?? 0) + 1;
                const distanceMeters = hit.distance * distanceMultiplier;
                updateObjectDistanceExtents(objectDistanceExtents, objectName, distanceMeters);
                if (!objectFirstHitCoordinates[objectName]) {
                    objectFirstHitCoordinates[objectName] = {
                        pixelId: `first-hit-${objectName}`,
                        x,
                        y,
                        sceneHitDistanceMeters: distanceMeters,
                        sourceCoordinateConvention: 'webgl-bottom-left',
                    };
                }
                const encoded = packNormalizedDistance24(distanceMeters / sceneDepthMaxMeters);
                const offset = (y * width + x) * 4;
                depthBytes[offset] = encoded[0];
                depthBytes[offset + 1] = encoded[1];
                depthBytes[offset + 2] = encoded[2];
                depthBytes[offset + 3] = 255;
                hitMaskBytes[offset] = 255;
                hitMaskBytes[offset + 1] = 255;
                hitMaskBytes[offset + 2] = 255;
                hitMaskBytes[offset + 3] = 255;
                if (colorBytes) {
                    const rgba = colorResolver(hit);
                    colorBytes[offset] = rgba[0];
                    colorBytes[offset + 1] = rgba[1];
                    colorBytes[offset + 2] = rgba[2];
                    colorBytes[offset + 3] = rgba[3];
                    updateObjectColorExtents(objectColorExtents, objectName, rgba);
                } else if (hasDiagnosticColorBytes) {
                    updateObjectColorExtents(objectColorExtents, objectName, [
                        diagnosticColorBytes[offset],
                        diagnosticColorBytes[offset + 1],
                        diagnosticColorBytes[offset + 2],
                        diagnosticColorBytes[offset + 3],
                    ]);
                }
            }
        }

        return Object.freeze({
            depthBytes,
            hitMaskBytes,
            colorBytes,
            hitPixelCount,
            objectHitCounts: Object.freeze({ ...objectHitCounts }),
            objectColorExtents: freezeObjectColorExtents(objectColorExtents),
            objectDistanceExtents: freezeObjectDistanceExtents(objectDistanceExtents),
            objectFirstHitCoordinates: freezeObjectFirstHitCoordinates(objectFirstHitCoordinates),
        });
    }

    function raycastPixelSample({
        raycaster,
        meshes,
        camera,
        x,
        y,
        width,
        height,
        representableFarSceneUnits,
        raycastSampleOffsets,
        preferNonGroundSampleHits,
    }) {
        const sampleOffsets = Array.isArray(raycastSampleOffsets) && raycastSampleOffsets.length > 0
            ? raycastSampleOffsets
            : [[0.5, 0.5]];
        let fallbackHit = null;
        let preferredHit = null;

        for (const offset of sampleOffsets) {
            const offsetX = Array.isArray(offset) && Number.isFinite(offset[0]) ? offset[0] : 0.5;
            const offsetY = Array.isArray(offset) && Number.isFinite(offset[1]) ? offset[1] : 0.5;
            const ndcX = ((x + offsetX) / width) * 2 - 1;
            const ndcY = ((y + offsetY) / height) * 2 - 1;

            raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
            raycaster.near = Number.isFinite(camera.near) ? camera.near : 0;
            raycaster.far = Number.isFinite(camera.far)
                ? Math.min(camera.far, representableFarSceneUnits)
                : representableFarSceneUnits;

            const intersections = raycaster.intersectObjects(meshes, false);
            if (intersections.length === 0) {
                continue;
            }

            const hit = intersections[0];
            if (!fallbackHit || hit.distance < fallbackHit.distance) {
                fallbackHit = hit;
            }
            if (preferNonGroundSampleHits && !isGeometryGroundHit(hit)) {
                if (!preferredHit || hit.distance < preferredHit.distance) {
                    preferredHit = hit;
                }
            }
        }

        return preferredHit ?? fallbackHit;
    }

    function isGeometryGroundHit(hit) {
        const name = hit?.object?.name ?? '';
        const endpointKind = hit?.object?.userData?.endpointKind ?? '';
        return name === 'local-flat-geometry-ground'
            || endpointKind === 'geometry-ground-boundary';
    }

    function subpixelGridSampleOffsets(gridSize) {
        const count = Math.max(1, Math.floor(gridSize));
        const samples = [[0.5, 0.5]];
        const seen = new Set(['0.5,0.5']);

        for (let y = 0; y < count; y += 1) {
            for (let x = 0; x < count; x += 1) {
                const offsetX = (x + 0.5) / count;
                const offsetY = (y + 0.5) / count;
                const key = `${offsetX},${offsetY}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                samples.push([offsetX, offsetY]);
            }
        }

        return Object.freeze(samples.map((sample) => Object.freeze(sample)));
    }

    function updateObjectColorExtents(extents, objectName, rgba) {
        const current = extents[objectName] ?? {
            minRgb: [255, 255, 255],
            maxRgb: [0, 0, 0],
        };

        for (let index = 0; index < 3; index += 1) {
            current.minRgb[index] = Math.min(current.minRgb[index], rgba[index]);
            current.maxRgb[index] = Math.max(current.maxRgb[index], rgba[index]);
        }
        extents[objectName] = current;
    }

    function freezeObjectColorExtents(extents) {
        const frozen = {};
        for (const [objectName, value] of Object.entries(extents)) {
            frozen[objectName] = Object.freeze({
                minRgb: Object.freeze([...value.minRgb]),
                maxRgb: Object.freeze([...value.maxRgb]),
            });
        }

        return Object.freeze(frozen);
    }

    function updateObjectDistanceExtents(extents, objectName, distanceMeters) {
        const current = extents[objectName] ?? {
            minMeters: Number.POSITIVE_INFINITY,
            maxMeters: 0,
            sumMeters: 0,
            count: 0,
        };

        current.minMeters = Math.min(current.minMeters, distanceMeters);
        current.maxMeters = Math.max(current.maxMeters, distanceMeters);
        current.sumMeters += distanceMeters;
        current.count += 1;
        extents[objectName] = current;
    }

    function freezeObjectDistanceExtents(extents) {
        const frozen = {};
        for (const [objectName, value] of Object.entries(extents)) {
            frozen[objectName] = Object.freeze({
                minMeters: value.minMeters,
                maxMeters: value.maxMeters,
                meanMeters: value.count > 0 ? value.sumMeters / value.count : 0,
                count: value.count,
            });
        }

        return Object.freeze(frozen);
    }

    function freezeObjectFirstHitCoordinates(coordinates) {
        const frozen = {};
        for (const [objectName, value] of Object.entries(coordinates)) {
            frozen[objectName] = Object.freeze({
                pixelId: value.pixelId,
                x: value.x,
                y: value.y,
                sceneHitDistanceMeters: value.sceneHitDistanceMeters,
                sourceCoordinateConvention: value.sourceCoordinateConvention,
            });
        }

        return Object.freeze(frozen);
    }

    function sceneHitTexturePacket({ width, height, hitMaskBytes, purpose }) {
        return {
            width,
            height,
            rgbaBytes: Array.from(hitMaskBytes),
            coordinateConvention: 'webgl-bottom-left',
            encoding: 'r8-explicit-hit-mask-in-rgba8-red-channel',
            purpose,
        };
    }

    function summarizeEncodedDepthBytes(rgbaBytes, hitMaskBytes) {
        if (!(hitMaskBytes instanceof Uint8Array) || hitMaskBytes.length !== rgbaBytes.length) {
            throw new Error('summarizeEncodedDepthBytes requires an explicit hit mask matching the depth texture.');
        }

        let min = 255;
        let max = 0;
        let noHitBucket = 0;
        let nearMaxDepthHitBucket = 0;
        let hitBucket = 0;
        let hitMaskBucket = 0;
        for (let index = 0; index < rgbaBytes.length; index += 4) {
            const value = rgbaBytes[index];
            min = Math.min(min, value);
            max = Math.max(max, value);
            if (hitMaskBytes[index] <= 127) {
                noHitBucket += 1;
            } else if (value >= 252) {
                hitMaskBucket += 1;
                nearMaxDepthHitBucket += 1;
            } else {
                hitMaskBucket += 1;
                hitBucket += 1;
            }
        }
        return {
            minRed: min,
            maxRed: max,
            noHitBucket,
            nearMaxDepthHitBucket,
            hitBucket,
            hitMaskBucket,
            totalPixels: rgbaBytes.length / 4,
        };
    }

    function packNormalizedDistance24(value) {
        const normalized = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
        let packed = Math.round(normalized * 16777214);
        const red = Math.floor(packed / 65536);
        packed -= red * 65536;
        const green = Math.floor(packed / 256);
        const blue = packed - green * 256;
        return [red, green, blue];
    }

    function unpackNormalizedDistance24(redByte, greenByte, blueByte) {
        return ((redByte * 65536) + (greenByte * 256) + blueByte) / 16777214;
    }

    async function loadSouthernFranceDiffuseTextures(THREE, TGALoader) {
        if (window.__algorithm32SouthernFranceDiffuseTextureSetup) {
            return window.__algorithm32SouthernFranceDiffuseTextureSetup;
        }
        const materialIds = [
            'ID4', 'ID409', 'ID422', 'ID435', 'ID640', 'ID661', 'ID706',
            'ID727', 'ID740', 'ID785', 'ID1014', 'ID1091', 'ID1104',
            'ID1133', 'ID1146', 'ID1159', 'ID1188', 'ID1233', 'ID1270',
            'ID1283', 'ID1296', 'ID1549', 'ID1618', 'ID1631', 'ID1644',
            'ID1729', 'ID1742', 'ID1771',
        ];
        const loader = new TGALoader();
        const texturesById = new Map();
        await Promise.all(materialIds.map(async (materialId) => {
            const texture = await loader.loadAsync(
                `./assets/southern-france-blender-obj/diffuse-tga-source/Mountain Range in Southern France_${materialId}_diffuse.tga`,
            );
            texture.name = `${materialId}_diffuse`;
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.needsUpdate = true;
            texturesById.set(materialId, texture);
        }));
        const setup = {
            texturesById,
            loadedCount: texturesById.size,
        };
        window.__algorithm32SouthernFranceDiffuseTextureSetup = setup;
        return setup;
    }

    function southernFranceDiffuseMaterial({ THREE, materialId, textureSetup, sharedMaterial, materialsById }) {
        const texture = textureSetup.texturesById.get(materialId);
        if (!texture) {
            return sharedMaterial;
        }
        if (!materialsById.has(materialId)) {
            const material = new THREE.MeshStandardMaterial({
                map: texture.clone(),
                color: new THREE.Color(1, 1, 1),
                roughness: 0.96,
                metalness: 0,
                side: THREE.DoubleSide,
                flatShading: false,
            });
            material.map.colorSpace = THREE.SRGBColorSpace;
            material.map.needsUpdate = true;
            materialsById.set(materialId, material);
        }
        return materialsById.get(materialId);
    }

    function southernFranceMaterialIdFromMaterial(material) {
        const selected = Array.isArray(material) ? material[0] : material;
        const name = selected?.name || '';
        const match = /ID\d+/.exec(name);
        return match ? match[0] : null;
    }

    function groundMaterialForPayload({ THREE, payload, floorKind }) {
        const groundSceneColor = Array.isArray(payload.groundSceneColorRgb)
            ? payload.groundSceneColorRgb
            : null;

        if (groundSceneColor) {
            return new THREE.MeshBasicMaterial({
                color: new THREE.Color(
                    clampNumber(groundSceneColor[0], 0, 1),
                    clampNumber(groundSceneColor[1], 0, 1),
                    clampNumber(groundSceneColor[2], 0, 1),
                ),
                side: THREE.DoubleSide,
            });
        }

        return new THREE.MeshStandardMaterial({
            color: floorKind === 'ocean'
                ? new THREE.Color(0.025, 0.135, 0.215)
                : new THREE.Color(0.055, 0.115, 0.055),
            roughness: 1,
            metalness: 0,
            side: THREE.DoubleSide,
        });
    }

    function createSphericalEarthFloorMesh({ THREE, cameraConfig, algorithmCameraWorldPositionMeters, material }) {
        const bottomRadiusMeters = 6360000;
        const cameraPosition = cameraConfig?.cameraPositionMeters || [0, 0, 0];
        const algorithmCamera = vector3OrDefault(algorithmCameraWorldPositionMeters, [6360002, 0, 0]);
        const center = [
            (Number(cameraPosition[0]) || 0) - algorithmCamera[1],
            (Number(cameraPosition[1]) || 0) - algorithmCamera[0],
            (Number(cameraPosition[2]) || 0) + algorithmCamera[2],
        ];
        material.side = THREE.FrontSide;
        const widthSegments = 512;
        const heightSegments = 256;
        const geometry = new THREE.SphereGeometry(bottomRadiusMeters, widthSegments, heightSegments);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(center[0], center[1], center[2]);
        mesh.userData = {
            kind: 'subjective-southern-france-spherical-ground',
            geometryPolicy: 'algorithm32-spherical-ground-boundary-mesh',
            bottomRadiusMeters,
            algorithmCameraWorldPositionMeters: algorithmCamera,
            centerMeters: center,
            cameraPositionMeters: cameraPosition,
            widthSegments,
            heightSegments,
        };
        return mesh;
    }

    function southernFranceSunsetCameraConfig(THREE, payload) {
        return {
            cameraPositionMeters: [0, 6200, 15800],
            lookAtMeters: [-61646.3700893115, 4200, -21009.849969969167],
            cameraYawPolicy: {
                kind: 'yaw-only-distant-sunset-bearing',
                targetDistantSunEvent: 'sunset',
                sourceArtifact: 'tmp/atmosphere/local-second-order/097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset',
                targetDistantSunOffsetDegrees: 110.58739287618563,
                targetDistantSunAzimuthDegrees: 300.8,
                targetDistantSunAltitudeDegrees: -0.8,
                preservedCameraAltitudeMeters: 6200,
                preservedLookAtY: 4200,
                preservedHorizontalDistance: 71800,
            },
        };
    }

    function southernFranceTransform() {
        const sourceBounds = {
            minX: -164125.0625,
            maxX: 100434.75,
            minY: -112238.882813,
            maxY: 114357.015625,
            minZ: -10594.121094,
        };
        return {
            sourceCenterX: (sourceBounds.minX + sourceBounds.maxX) * 0.5,
            sourceMinY: sourceBounds.minY,
            sourceRangeY: sourceBounds.maxY - sourceBounds.minY,
            sourceMinZ: sourceBounds.minZ,
            horizontalScale: 1.12,
            verticalScale: 0.105,
            baseHeight: 0,
            offsetX: 0,
            zNear: 18000,
            zFar: -168000,
            yawRadians: -1.0325023128416375,
            rotationPivotMeters: [0, 15800],
            localViewTerrainFit: {
                kind: 'yaw-aligned-wider-footprint',
                sourceArtifact: 'tmp/atmosphere/local-second-order/097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset',
                policy: 'Rotate and widen the staged OBJ footprint so the finite source mesh remains under the sunset-yawed camera frame.',
                horizontalScaleBefore: 0.41,
                horizontalScaleAfter: 1.12,
                zFarBefore: -76000,
                zFarAfter: -168000,
            },
        };
    }

    function transformSouthernFranceGeometry(geometry, transform) {
        const positions = geometry.attributes.position;
        const hasYaw = Number.isFinite(transform.yawRadians);
        const pivot = Array.isArray(transform.rotationPivotMeters)
            ? transform.rotationPivotMeters
            : [0, 0];
        const pivotX = Number(pivot[0]) || 0;
        const pivotZ = Number(pivot[1]) || 0;
        const cosYaw = hasYaw ? Math.cos(transform.yawRadians) : 1;
        const sinYaw = hasYaw ? Math.sin(transform.yawRadians) : 0;
        for (let index = 0; index < positions.count; index += 1) {
            const sourceX = positions.getX(index);
            const sourceY = positions.getY(index);
            const sourceZ = positions.getZ(index);
            let x = (sourceX - transform.sourceCenterX) * transform.horizontalScale + transform.offsetX;
            let z = transform.zFar
                + ((sourceY - transform.sourceMinY) / transform.sourceRangeY)
                * (transform.zNear - transform.zFar);
            if (hasYaw) {
                const dx = x - pivotX;
                const dz = z - pivotZ;
                x = pivotX + dx * cosYaw - dz * sinYaw;
                z = pivotZ + dx * sinYaw + dz * cosYaw;
            }
            const y = (sourceZ - transform.sourceMinZ) * transform.verticalScale + transform.baseHeight;
            positions.setXYZ(index, x, y, z);
        }
        positions.needsUpdate = true;
        geometry.computeBoundingBox();
    }

    function solarNoonSunForToday(payload) {
        const date = payload.renderDate || '2026-07-04';
        const latitudeDegrees = numberOrDefault(payload.latitudeDegrees, 44);
        const longitudeDegrees = numberOrDefault(payload.longitudeDegrees, 6);
        const declinationDegrees = solarDeclinationApproxDegrees(date);
        const altitudeDegrees = 90 - Math.abs(latitudeDegrees - declinationDegrees);
        const azimuthDegrees = latitudeDegrees >= declinationDegrees ? 180 : 0;
        const altitudeRadians = altitudeDegrees * Math.PI / 180;
        const azimuthRadians = azimuthDegrees * Math.PI / 180;
        const horizontal = Math.cos(altitudeRadians);
        return {
            date,
            location: {
                latitudeDegrees,
                longitudeDegrees,
            },
            declinationDegrees,
            altitudeDegrees,
            azimuthDegrees,
            observerLocalDirection: [
                Math.sin(altitudeRadians),
                horizontal * Math.sin(azimuthRadians),
                horizontal * Math.cos(azimuthRadians),
            ],
        };
    }

    function southernFranceDaylightSamplesForPayload(payload) {
        if (payload.daylightSampleMode !== 'minutes-before-sunset') {
            return southernFranceDaylightSamples(payload, 5);
        }
        const date = payload.renderDate || '2026-07-04';
        const latitudeDegrees = numberOrDefault(payload.latitudeDegrees, 44);
        const longitudeDegrees = numberOrDefault(payload.longitudeDegrees, 6);
        const declinationDegrees = numberOrDefault(
            payload.solarDeclinationDegrees,
            date === '2026-06-21' ? 23.5 : solarDeclinationApproxDegrees(date),
        );
        const solarClock = southernFranceSolarClock(payload, date, longitudeDegrees);
        const latitudeRadians = latitudeDegrees * Math.PI / 180;
        const declinationRadians = declinationDegrees * Math.PI / 180;
        const sunriseAltitudeRadians = -0.833 * Math.PI / 180;
        const cosHourAngle = (
            Math.sin(sunriseAltitudeRadians)
            - Math.sin(latitudeRadians) * Math.sin(declinationRadians)
        ) / (Math.cos(latitudeRadians) * Math.cos(declinationRadians));
        const sunsetHourAngleDegrees = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
        const minutesBeforeSunset = Math.max(0, numberOrDefault(payload.minutesBeforeSunset, 5));
        const hourAngleDegrees = sunsetHourAngleDegrees - minutesBeforeSunset / 4;
        const pose = sphericalSolarPose({
            latitudeDegrees,
            declinationDegrees,
            hourAngleDegrees,
        });

        return [{
            id: `01-${minutesBeforeSunset}min-before-sunset`,
            label: `${minutesBeforeSunset} min before sunset`,
            index: 0,
            count: 1,
            daylightFraction: null,
            date,
            location: {
                latitudeDegrees,
                longitudeDegrees,
            },
            declinationDegrees,
            hourAngleDegrees,
            localSolarTime: localSolarTimeFromHourAngle(hourAngleDegrees, solarClock),
            altitudeDegrees: pose.altitudeDegrees,
            azimuthDegrees: pose.azimuthDegrees,
            observerLocalDirection: pose.observerLocalDirection,
            samplePolicy: {
                kind: 'minutes-before-sunset',
                minutesBeforeSunset,
                sunsetHourAngleDegrees,
            },
        }];
    }

    function southernFranceDaylightSamples(payload, sampleCount) {
        const date = payload.renderDate || '2026-07-04';
        const latitudeDegrees = numberOrDefault(payload.latitudeDegrees, 44);
        const longitudeDegrees = numberOrDefault(payload.longitudeDegrees, 6);
        const declinationDegrees = numberOrDefault(
            payload.solarDeclinationDegrees,
            date === '2026-06-21' ? 23.5 : solarDeclinationApproxDegrees(date),
        );
        const solarClock = southernFranceSolarClock(payload, date, longitudeDegrees);
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
            samples.push({
                id: `${String(index + 1).padStart(2, '0')}-${event}`,
                label: daylightLabel(event),
                index,
                count,
                daylightFraction: t,
                date,
                location: {
                    latitudeDegrees,
                    longitudeDegrees,
                },
                declinationDegrees,
                hourAngleDegrees,
                localSolarTime: localSolarTimeFromHourAngle(hourAngleDegrees, solarClock),
                altitudeDegrees: pose.altitudeDegrees,
                azimuthDegrees: pose.azimuthDegrees,
                observerLocalDirection: pose.observerLocalDirection,
            });
        }
        return samples;
    }

    function southernFranceSolarClock(payload, date, longitudeDegrees) {
        const localSolarNoonMinutes = Math.round(numberOrDefault(
            payload.localSolarNoonMinutes,
            date === '2026-06-21' && Math.abs(longitudeDegrees + 121.8863) < 0.01 ? 789 : 720,
        ));
        const noonLabel = timeLabelFromMinutes(localSolarNoonMinutes);
        return {
            kind: 'approximate-local-solar-clock',
            dayOfYear: date === '2026-06-21' ? 172 : null,
            timezoneOffsetMinutes: numberOrDefault(payload.timezoneOffsetMinutes, -420),
            equationOfTimeMinutes: numberOrDefault(payload.equationOfTimeMinutes, -1.3282368002224763),
            solarNoonLocalMinutes: localSolarNoonMinutes,
            solarNoonLabel: noonLabel,
            sourceArtifact: 'tmp/atmosphere/local-second-order/097-reconciliation-d1-endpoint-proxy-distant-local-sunrise-sunset',
            policy: 'Copied from the 097 local-second-order NOAA-style solar clock for visual comparison.',
        };
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
        return {
            altitudeDegrees,
            azimuthDegrees,
            observerLocalDirection: [
                Math.sin(altitudeRadians),
                horizontal * Math.sin(azimuthRadians),
                horizontal * Math.cos(azimuthRadians),
            ],
        };
    }

    function daylightLabel(event) {
        if (event === 'solar-noon') {
            return 'Solar noon';
        }
        return event
            .split('-')
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }

    function localSolarTimeFromHourAngle(hourAngleDegrees, solarClock) {
        const minutesAfterNoon = hourAngleDegrees * 4;
        const minutes = Math.round(solarClock.solarNoonLocalMinutes + minutesAfterNoon);
        return {
            kind: 'local-solar-time',
            minutesAfterNoon,
            dayOffset: Math.floor(minutes / 1440),
            label: timeLabelFromMinutes(minutes),
            noonLabel: solarClock.solarNoonLabel,
            policy: 'Positive 15-degree hour-angle offsets advance local solar time by one hour from copied 097 solar noon.',
        };
    }

    function timeLabelFromMinutes(minutes) {
        const normalized = ((minutes % 1440) + 1440) % 1440;
        const hours = Math.floor(normalized / 60);
        const mins = normalized % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    }

    function normalizeDegrees(degrees) {
        return ((degrees % 360) + 360) % 360;
    }

    function clampNumber(value, min, max) {
        return Math.max(min, Math.min(max, Number(value) || 0));
    }

    function solarDeclinationApproxDegrees(dateText) {
        const date = new Date(`${dateText}T12:00:00Z`);
        const start = new Date(`${date.getUTCFullYear()}-01-01T00:00:00Z`);
        const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
        return 23.44 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    }

    function sceneDirectionFromObserverLocalSun(observerLocalDirection) {
        const up = observerLocalDirection[0];
        const east = observerLocalDirection[1];
        const north = observerLocalDirection[2];
        return [east, up, -north];
    }

    function browserSubjectiveSelectedPixels(width, height) {
        const topLeftSelections = [
            { pixelId: 'upper-sky-control', x: Math.floor(width * 0.5), y: Math.floor(height * 0.16) },
            { pixelId: 'ridge-center', x: Math.floor(width * 0.5), y: Math.floor(height * 0.52) },
            { pixelId: 'lower-terrain', x: Math.floor(width * 0.5), y: Math.floor(height * 0.78) },
        ];

        return topLeftSelections.map((selection) => ({
            pixelId: selection.pixelId,
            x: selection.x,
            y: height - 1 - selection.y,
            sourceCoordinateConvention: 'top-left',
            readbackCoordinateConvention: 'webgl-bottom-left',
        }));
    }

    function browserThreeSelectedPixels(width, height) {
        const topLeftSelections = [
            { pixelId: 'upper-sky-control', x: Math.floor(width / 2), y: Math.floor(height * 0.12) },
            { pixelId: 'center-card-hit', x: Math.floor(width / 2), y: Math.floor(height * 0.48) },
            { pixelId: 'lower-ground-hit', x: Math.floor(width / 2), y: Math.floor(height * 0.86) },
        ];

        return topLeftSelections.map((selection) => ({
            pixelId: selection.pixelId,
            x: selection.x,
            y: height - 1 - selection.y,
            sourceCoordinateConvention: 'top-left',
            readbackCoordinateConvention: 'webgl-bottom-left',
        }));
    }

    function planetSphereSelectedPixels(width, height) {
        const topLeftSelections = [
            { pixelId: 'upper-sky-control', x: Math.floor(width * 0.5), y: Math.floor(height * 0.18) },
            { pixelId: 'horizon-control', x: Math.floor(width * 0.5), y: Math.floor(height * 0.50) },
            { pixelId: 'lower-ground-hit', x: Math.floor(width * 0.5), y: Math.floor(height * 0.82) },
        ];

        return topLeftSelections.map((selection) => ({
            pixelId: selection.pixelId,
            x: selection.x,
            y: height - 1 - selection.y,
            sourceCoordinateConvention: 'top-left',
            readbackCoordinateConvention: 'webgl-bottom-left',
        }));
    }

    function localFlatSelectedPixels(width, height, distanceCapture = null) {
        const selections = [
            {
                pixelId: 'upper-sky-control',
                x: Math.floor(width * 0.5),
                y: height - 1 - Math.floor(height * 0.08),
                sourceCoordinateConvention: 'top-left',
                readbackCoordinateConvention: 'webgl-bottom-left',
            },
        ];
        const firstHits = distanceCapture?.objectFirstHitCoordinates ?? {};
        const objectSelectionOrder = [
            'local-flat-close-red-box',
            'local-flat-close-orange-box',
            'local-flat-close-white-box',
            'local-flat-near-green-box',
            'local-flat-far-blue-box',
            'local-flat-mid-yellow-box',
            'local-flat-far-cyan-box',
            'local-flat-very-far-magenta-box',
            'local-flat-left-160km-6p2kmx50kmx100km-orange-box',
            'local-flat-right-240km-6p2kmx50kmx100km-orange-box',
            'local-flat-denali-200km-6p2kmx50kmx100km-orange-box',
            'local-flat-geometry-ground',
        ];

        for (const objectName of objectSelectionOrder) {
            const hit = firstHits[objectName];
            if (!hit || !Number.isFinite(hit.x) || !Number.isFinite(hit.y)) {
                continue;
            }
            selections.push({
                pixelId: `object-hit-${objectName}`,
                x: hit.x,
                y: hit.y,
                objectName,
                sceneHitDistanceMeters: hit.sceneHitDistanceMeters ?? null,
                sourceCoordinateConvention: 'webgl-bottom-left',
                readbackCoordinateConvention: 'webgl-bottom-left',
            });
        }

        if (selections.length === 1) {
            selections.push(
                {
                    pixelId: 'center-box-or-ground-control',
                    x: Math.floor(width * 0.5),
                    y: height - 1 - Math.floor(height * 0.50),
                    sourceCoordinateConvention: 'top-left',
                    readbackCoordinateConvention: 'webgl-bottom-left',
                },
                {
                    pixelId: 'lower-ground-hit',
                    x: Math.floor(width * 0.5),
                    y: height - 1 - Math.floor(height * 0.82),
                    sourceCoordinateConvention: 'top-left',
                    readbackCoordinateConvention: 'webgl-bottom-left',
                },
            );
        }

        return uniqueSelectedPixels(selections, width, height);
    }

    function uniqueSelectedPixels(selections, width, height) {
        const seen = new Set();
        const unique = [];
        for (const selection of selections) {
            const x = clampInteger(selection.x, 0, width - 1);
            const y = clampInteger(selection.y, 0, height - 1);
            const key = `${x},${y}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            unique.push({
                ...selection,
                x,
                y,
            });
        }

        return unique;
    }

    function collectBrowserDiagnostics(gl, canvas) {
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        const extensions = gl.getSupportedExtensions() || [];

        return {
            kind: 'algorithm32-reconciliation-webgl-diagnostics',
            userAgent: navigator.userAgent,
            devicePixelRatio: window.devicePixelRatio,
            viewport: [canvas.width, canvas.height],
            webglVersion: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
            unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
            highFloatPrecision: precision
                ? {
                    precision: precision.precision,
                    rangeMin: precision.rangeMin,
                    rangeMax: precision.rangeMax,
                }
                : null,
            extensions,
            readbackFormat: 'uint8-rgba',
        };
    }

    function compileSmokeProgram(gl) {
        return compileProgram(gl, {
            vertexSource: fullScreenVertexSource(),
            fragmentSource: `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
void main() {
    outColor = vec4(vUv.x, vUv.y, 1.0 - vUv.x * 0.5, 1.0);
}`,
        });
    }

    function fullScreenVertexSource() {
        return `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
    }

    function compileProgram(gl, sources) {
        const vertex = compileShader(gl, gl.VERTEX_SHADER, sources.vertexSource);
        const fragment = compileShader(gl, gl.FRAGMENT_SHADER, sources.fragmentSource);
        if (vertex.status === 'rejected' || fragment.status === 'rejected') {
            return {
                status: 'rejected',
                vertex,
                fragment,
                linkLog: null,
            };
        }

        const program = gl.createProgram();
        gl.attachShader(program, vertex.shader);
        gl.attachShader(program, fragment.shader);
        gl.linkProgram(program);

        const linked = gl.getProgramParameter(program, gl.LINK_STATUS) === true;
        return {
            status: linked ? 'accepted' : 'rejected',
            vertex,
            fragment,
            linkLog: gl.getProgramInfoLog(program),
            program,
        };
    }

    function compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true;
        return {
            status: compiled ? 'accepted' : 'rejected',
            type: type === gl.VERTEX_SHADER ? 'vertex' : 'fragment',
            compileLog: gl.getShaderInfoLog(shader),
            sourceLength: source.length,
            shader,
        };
    }

    function drawSmokeTriangle(gl, program) {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 3, -1, -1, 3]),
            gl.STATIC_DRAW,
        );
        const location = gl.getAttribLocation(program, 'aPosition');
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(program);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.finish();
    }

    function bindAssembledSmokeResources(gl, program, canvas) {
        gl.useProgram(program);
        setUniform2f(gl, program, 'uViewportPixels', canvas.width, canvas.height);
        setUniform1f(gl, program, 'uSceneTerminationMeters', 0);
        setUniform1f(gl, program, 'uSceneDepthMaxMeters', 1);
        setUniform1f(gl, program, 'uEndpointRadianceScale', 1);
        setUniform1f(gl, program, 'uEndpointCameraDistanceScaleEnabled', 0);
        setUniform1f(gl, program, 'uEndpointCameraDistanceReferenceMeters', 200000);
        setUniform1f(gl, program, 'uEndpointCameraDistanceMinScale', 0.05);
        setUniform1f(gl, program, 'uEndpointCameraDistanceMaxScale', 1);
        setUniform3f(gl, program, 'uCameraWorldPositionMeters', 6360002, 0, 0);
        setUniform3f(gl, program, 'uDistantSunDirection', 0, 0, 1);
        setUniformMatrix4fv(gl, program, 'uInverseProjectionMatrix', identityMatrix4());
        setUniformMatrix4fv(gl, program, 'uInverseViewMatrix', identityMatrix4());
        const sceneColorTexture = createSceneColorTexture(gl);
        const sceneDepthTexture = createConstantTexture2d(gl, [255, 255, 255, 255]);
        const sceneHitTexture = createConstantTexture2d(gl, [0, 0, 0, 255]);
        const incidentRadianceTexture = createZeroTexture3d(gl, 34, 48, 4);
        bindTexture2d(gl, program, 'uSceneColorTexture', 0, sceneColorTexture);
        bindTexture2d(gl, program, 'uSceneDepthTexture', 1, sceneDepthTexture);
        bindTexture3d(gl, program, 'uIncidentRadianceCacheTexture', 2, incidentRadianceTexture);
        bindTexture2d(gl, program, 'uSceneHitTexture', 3, sceneHitTexture);
    }

    function bindObjectiveSceneResources(gl, program, canvas, payload) {
        gl.useProgram(program);
        const cameraWorldPosition = vector3OrDefault(payload.cameraWorldPositionMeters, [6360002, 0, 0]);
        const distantSunDirection = vector3OrDefault(payload.distantSunDirection, [0, 0, 1]);
        setUniform2f(gl, program, 'uViewportPixels', canvas.width, canvas.height);
        setUniform1f(gl, program, 'uSceneTerminationMeters', numberOrDefault(payload.sceneTerminationMeters, 0));
        setUniform1f(gl, program, 'uSceneDepthMaxMeters', numberOrDefault(payload.sceneDepthMaxMeters, 1));
        setUniform1f(gl, program, 'uEndpointRadianceScale', numberOrDefault(payload.endpointRadianceScale, 1));
        const endpointCameraDistanceScale = normalizeEndpointCameraDistanceScalePayload(payload.endpointCameraDistanceScale);
        setUniform1f(gl, program, 'uEndpointCameraDistanceScaleEnabled',
            endpointCameraDistanceScale.policy === 'reverse-square' ? 1 : 0);
        setUniform1f(gl, program, 'uEndpointCameraDistanceReferenceMeters', endpointCameraDistanceScale.referenceMeters);
        setUniform1f(gl, program, 'uEndpointCameraDistanceMinScale', endpointCameraDistanceScale.minScale);
        setUniform1f(gl, program, 'uEndpointCameraDistanceMaxScale', endpointCameraDistanceScale.maxScale);
        setUniform3f(gl, program, 'uCameraWorldPositionMeters',
            cameraWorldPosition[0], cameraWorldPosition[1], cameraWorldPosition[2]);
        setUniform3f(gl, program, 'uDistantSunDirection',
            distantSunDirection[0], distantSunDirection[1], distantSunDirection[2]);
        setUniformMatrix4fv(gl, program, 'uInverseProjectionMatrix',
            hasMatrix16(payload.inverseProjectionMatrix)
                ? new Float32Array(payload.inverseProjectionMatrix)
                : identityMatrix4());
        setUniformMatrix4fv(gl, program, 'uInverseViewMatrix',
            hasMatrix16(payload.inverseViewMatrix)
                ? new Float32Array(payload.inverseViewMatrix)
                : identityMatrix4());
        const sceneColorTexture = createPayloadTexture2d(gl, payload.sceneColorTexture, createSceneColorTexture(gl));
        const sceneDepthTexture = createPayloadTexture2d(gl, payload.sceneDepthTexture, createConstantTexture2d(gl, [255, 255, 255, 255]));
        const sceneHitTexture = createPayloadTexture2d(gl, payload.sceneHitTexture, createConstantTexture2d(gl, [0, 0, 0, 255]));
        const incidentRadianceTexture = createPayloadTexture3d(
            gl,
            payload.incidentRadianceTexture,
            createZeroTexture3d(gl, 34, 48, 4),
        );
        bindTexture2d(gl, program, 'uSceneColorTexture', 0, sceneColorTexture);
        bindTexture2d(gl, program, 'uSceneDepthTexture', 1, sceneDepthTexture);
        bindTexture3d(gl, program, 'uIncidentRadianceCacheTexture', 2, incidentRadianceTexture);
        bindTexture2d(gl, program, 'uSceneHitTexture', 3, sceneHitTexture);
    }

    function createSceneColorTexture(gl) {
        const width = 2;
        const height = 2;
        const data = new Uint8Array([
            64, 96, 128, 255,
            128, 96, 64, 255,
            32, 160, 192, 255,
            192, 160, 32, 255,
        ]);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return texture;
    }

    function createConstantTexture2d(gl, rgba) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
        return texture;
    }

    function createPayloadTexture2d(gl, payloadTexture, fallbackTexture) {
        if (
            !payloadTexture
            || typeof payloadTexture !== 'object'
            || !Number.isInteger(payloadTexture.width)
            || !Number.isInteger(payloadTexture.height)
            || payloadTexture.width <= 0
            || payloadTexture.height <= 0
            || !Array.isArray(payloadTexture.rgbaBytes)
            || payloadTexture.rgbaBytes.length !== payloadTexture.width * payloadTexture.height * 4
            || payloadTexture.rgbaBytes.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
        ) {
            return fallbackTexture;
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            payloadTexture.width,
            payloadTexture.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array(payloadTexture.rgbaBytes),
        );
        return texture;
    }

    function createZeroTexture3d(gl, width, height, depth) {
        const texture = gl.createTexture();
        const safeWidth = clampInteger(width, 1, 4096);
        const safeHeight = clampInteger(height, 1, 4096);
        const safeDepth = clampInteger(depth, 1, 2048);
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texImage3D(
            gl.TEXTURE_3D,
            0,
            gl.RGBA32F,
            safeWidth,
            safeHeight,
            safeDepth,
            0,
            gl.RGBA,
            gl.FLOAT,
            new Float32Array(safeWidth * safeHeight * safeDepth * 4),
        );
        return texture;
    }

    function createPayloadTexture3d(gl, payloadTexture, fallbackTexture) {
        if (
            !payloadTexture
            || typeof payloadTexture !== 'object'
            || payloadTexture.kind !== 'rgba32f-3d-texture-v1'
            || !Number.isInteger(payloadTexture.width)
            || !Number.isInteger(payloadTexture.height)
            || !Number.isInteger(payloadTexture.depth)
            || payloadTexture.width <= 0
            || payloadTexture.height <= 0
            || payloadTexture.depth <= 0
            || !Array.isArray(payloadTexture.rgbaFloat32)
            || payloadTexture.rgbaFloat32.length !== payloadTexture.width * payloadTexture.height * payloadTexture.depth * 4
            || payloadTexture.rgbaFloat32.some((value) => !Number.isFinite(value))
        ) {
            return fallbackTexture;
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texImage3D(
            gl.TEXTURE_3D,
            0,
            gl.RGBA32F,
            payloadTexture.width,
            payloadTexture.height,
            payloadTexture.depth,
            0,
            gl.RGBA,
            gl.FLOAT,
            new Float32Array(payloadTexture.rgbaFloat32),
        );
        return texture;
    }

    function bindTexture2d(gl, program, uniformName, unit, texture) {
        const location = gl.getUniformLocation(program, uniformName);
        if (location === null) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(location, unit);
    }

    function bindTexture3d(gl, program, uniformName, unit, texture) {
        const location = gl.getUniformLocation(program, uniformName);
        if (location === null) return;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.uniform1i(location, unit);
    }

    function setUniform1f(gl, program, name, value) {
        const location = gl.getUniformLocation(program, name);
        if (location !== null) gl.uniform1f(location, value);
    }

    function setUniform2f(gl, program, name, x, y) {
        const location = gl.getUniformLocation(program, name);
        if (location !== null) gl.uniform2f(location, x, y);
    }

    function setUniform3f(gl, program, name, x, y, z) {
        const location = gl.getUniformLocation(program, name);
        if (location !== null) gl.uniform3f(location, x, y, z);
    }

    function setUniformMatrix4fv(gl, program, name, value) {
        const location = gl.getUniformLocation(program, name);
        if (location !== null) gl.uniformMatrix4fv(location, false, value);
    }

    function identityMatrix4() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);
    }

    function readSelectedPixels(gl, canvas) {
        const selections = [
            { pixelId: 'center', x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
            { pixelId: 'lower-left', x: 8, y: canvas.height - 9 },
            { pixelId: 'upper-right', x: canvas.width - 9, y: 8 },
        ];

        return selections.map((selection) => {
            const rgba = new Uint8Array(4);
            gl.readPixels(selection.x, selection.y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
            return {
                ...selection,
                readbackRgba: Array.from(rgba),
            };
        });
    }

    function readSelectedPixelsFromRgbaBytes(bytes, width, height) {
        const selections = [
            { pixelId: 'center', x: Math.floor(width / 2), y: Math.floor(height / 2) },
            { pixelId: 'lower-left', x: 8, y: 8 },
            { pixelId: 'upper-right', x: width - 9, y: height - 9 },
        ];

        return selections.map((selection) => {
            const x = clampInteger(selection.x, 0, width - 1);
            const y = clampInteger(selection.y, 0, height - 1);
            const offset = (y * width + x) * 4;
            return {
                ...selection,
                readbackRgba: Array.from(bytes.slice(offset, offset + 4)),
            };
        });
    }

    function readPayloadSelectedPixels(gl, canvas, selectedPixels) {
        const selections = Array.isArray(selectedPixels) && selectedPixels.length > 0
            ? selectedPixels
            : [
                { pixelId: 'center', x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
            ];

        return selections.map((selection, index) => {
            const x = clampInteger(selection.x, 0, canvas.width - 1);
            const y = clampInteger(selection.y, 0, canvas.height - 1);
            const rgba = new Uint8Array(4);
            gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
            return {
                pixelId: typeof selection.pixelId === 'string' ? selection.pixelId : `selected-${index}`,
                x,
                y,
                readbackRgba: Array.from(rgba),
            };
        });
    }

    function imageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('Unable to decode row PNG data URL.'));
            image.src = dataUrl;
        });
    }

    function hasVisibleRgb(selection) {
        return selection.readbackRgba.slice(0, 3).some((channel) => channel > 0);
    }

    function rgbaWithinTolerance(actual, expected, toleranceBytes) {
        return Array.isArray(actual)
            && Array.isArray(expected)
            && actual.length === 4
            && expected.length === 4
            && actual.every((value, index) =>
                Math.abs(value - expected[index]) <= toleranceBytes);
    }

    function expectedDiagnosticReadback(run, pixel) {
        if (Array.isArray(run.expectedReadbacks)) {
            const match = run.expectedReadbacks.find((entry) =>
                entry?.pixelId === pixel.pixelId
                || (entry?.x === pixel.x && entry?.y === pixel.y));

            return Array.isArray(match?.expectedReadbackRgba)
                ? match.expectedReadbackRgba
                : null;
        }

        if (run.expectedReadbacks && typeof run.expectedReadbacks === 'object') {
            const byId = run.expectedReadbacks[pixel.pixelId];

            return Array.isArray(byId) ? byId : null;
        }

        return null;
    }

    function addVec3(a, b) {
        return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    }

    function scaleVec3(value, scale) {
        return [value[0] * scale, value[1] * scale, value[2] * scale];
    }

    function dot3(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    function length3(value) {
        return Math.hypot(value[0], value[1], value[2]);
    }

    function normalize3(value) {
        const length = Math.max(length3(value), 0.000001);
        return [value[0] / length, value[1] / length, value[2] / length];
    }

    function resizeCanvas(canvas, viewportPixels) {
        const width = clampInteger(viewportPixels[0], 1, 2048);
        const height = clampInteger(viewportPixels[1], 1, 2048);
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${Math.max(width, 128)}px`;
        canvas.style.height = `${Math.max(height, 72)}px`;
    }

    function expectedSelectedPixelCount(selectedPixels) {
        return Array.isArray(selectedPixels) && selectedPixels.length > 0
            ? selectedPixels.length
            : 1;
    }

    function hasMatrix16(value) {
        return Array.isArray(value) && value.length === 16 && value.every(Number.isFinite);
    }

    function vector3OrDefault(value, fallback) {
        return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)
            ? value
            : fallback;
    }

    function numberOrDefault(value, fallback) {
        return Number.isFinite(value) ? value : fallback;
    }

    function normalizeEndpointCameraDistanceScalePayload(scaleConfig) {
        if (!scaleConfig || typeof scaleConfig !== 'object' || scaleConfig.policy !== 'reverse-square') {
            return {
                policy: 'none',
                referenceMeters: 200000,
                minScale: 0.05,
                maxScale: 1,
            };
        }

        const referenceMeters = Number.isFinite(scaleConfig.referenceMeters) && scaleConfig.referenceMeters > 0
            ? scaleConfig.referenceMeters
            : 200000;
        const minScale = Number.isFinite(scaleConfig.minScale)
            ? Math.max(0, scaleConfig.minScale)
            : 0.05;
        const maxScale = Number.isFinite(scaleConfig.maxScale)
            ? Math.max(minScale, scaleConfig.maxScale)
            : 1;

        return {
            policy: 'reverse-square',
            referenceMeters,
            minScale,
            maxScale,
        };
    }

    function summarizeIncidentRadianceTexture(texturePayload) {
        if (
            !texturePayload
            || typeof texturePayload !== 'object'
            || texturePayload.kind !== 'rgba32f-3d-texture-v1'
        ) {
            return '3d-zero-rgba32f-missing-payload-fallback';
        }

        return {
            kind: texturePayload.kind,
            width: texturePayload.width,
            height: texturePayload.height,
            depth: texturePayload.depth,
            format: texturePayload.format,
            samplerPolicy: texturePayload.samplerPolicy,
            coordinateOrder: texturePayload.coordinateOrder,
            spectralGroupSize: texturePayload.spectralGroupSize,
            spectralGroupCount: texturePayload.spectralGroupCount,
            spectralChannelCount: texturePayload.spectralChannelCount,
            uploadValueCount: Array.isArray(texturePayload.rgbaFloat32)
                ? texturePayload.rgbaFloat32.length
                : null,
        };
    }

    function hasIncidentRadianceTexturePayload(texturePayload) {
        return Boolean(
            texturePayload
            && typeof texturePayload === 'object'
            && texturePayload.kind === 'rgba32f-3d-texture-v1'
            && Number.isInteger(texturePayload.width)
            && Number.isInteger(texturePayload.height)
            && Number.isInteger(texturePayload.depth)
            && texturePayload.width > 0
            && texturePayload.height > 0
            && texturePayload.depth > 0
            && Array.isArray(texturePayload.rgbaFloat32)
            && texturePayload.rgbaFloat32.length === texturePayload.width * texturePayload.height * texturePayload.depth * 4
            && texturePayload.rgbaFloat32.every(Number.isFinite),
        );
    }

    function incidentRadianceTextureForDaylightSample(payload, sample) {
        const bySampleId = payload.incidentRadianceTextureBySampleId;
        if (bySampleId && typeof bySampleId === 'object') {
            const rowPayload = bySampleId[sample.id];
            if (hasIncidentRadianceTexturePayload(rowPayload)) {
                return rowPayload;
            }
        }

        return payload.incidentRadianceTexture;
    }

    function daylightSamplesHaveIncidentRadianceTexture(payload, samples) {
        return samples.every((sample) =>
            hasIncidentRadianceTexturePayload(incidentRadianceTextureForDaylightSample(payload, sample)));
    }

    function summarizeDaylightIncidentRadianceTextures(payload, samples) {
        return samples.map((sample) => ({
            sampleId: sample.id,
            texture: summarizeIncidentRadianceTexture(incidentRadianceTextureForDaylightSample(payload, sample)),
        }));
    }

    function clampInteger(value, min, max) {
        if (!Number.isFinite(value)) {
            return min;
        }
        return Math.max(min, Math.min(max, Math.round(value)));
    }

    function criteriaFor({ diagnostics, shaderProgram, selectedPixels, imageDataUrl }) {
        return [
            criterion('webgl2-context-created', diagnostics.webglVersion.includes('WebGL'), 'WebGL2 diagnostic version string'),
            criterion('shader-compile-link-accepted', shaderProgram.status === 'accepted', 'compile and link accepted'),
            criterion('selected-pixel-readback-present', selectedPixels.length === 3, 'three selected pixel readbacks'),
            criterion('png-data-url-present', typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:image/png;base64,'), 'PNG data URL'),
        ];
    }

    function criterion(criterionId, accepted, tolerance) {
        return {
            criterionId,
            status: accepted ? 'pass' : 'fail',
            tolerance,
            measuredError: accepted ? 0 : 1,
            sourceOrStatus: 'browser-page',
            notes: '',
        };
    }

    function rejected(command, message) {
        return {
            kind: 'algorithm32-reconciliation-browser-result',
            status: 'rejected',
            command,
            diagnostics: {
                status: 'rejected',
                error: message,
            },
            selectedPixels: [],
            criteriaResults: [criterion('webgl2-context-created', false, 'WebGL2 context')],
            imageDataUrl: null,
            timings: timing(performance.now()),
        };
    }

    function timing(startedAt) {
        const completedAt = performance.now();
        return {
            startedAt,
            completedAt,
            durationMs: completedAt - startedAt,
        };
    }
}());
