// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader contract.
// - agents/topics/apps/flat/reconciliation/shader-design.md, ThreeGateway pass installation.
// - scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';

import CanonicalAtmosphere from '/scripts/flat/reconciliation/POC/src/atmosphere/CanonicalAtmosphere.js';
import BrunetonColorDisplayModel from '/scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js';
import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    RUNTIME_NUMERICAL_CONTROLS,
} from '/scripts/flat/reconciliation/POC/src/constants/consts.js';
import SpectralCalculator from '/scripts/flat/reconciliation/POC/src/calculator/SpectralCalculator.js';
import SpectralReferenceEvaluator from '/scripts/flat/reconciliation/POC/src/evaluation/SpectralReferenceEvaluator.js';
import SphericalEarthGeometry from '/scripts/flat/reconciliation/POC/src/geometry/SphericalEarthGeometry.js';
import DistantSunLightSource from '/scripts/flat/reconciliation/POC/src/light/DistantSunLightSource.js';
import { normalize, sunOrientedFibonacciSphereDirection } from '/scripts/flat/reconciliation/POC/src/math/vector.js';
import CpuPostprocessSoftShader from '/scripts/flat/reconciliation/POC/src/soft-shader/CpuPostprocessSoftShader.js';

const CAPTURED_SCENE_ENDPOINT_POLICY =
    'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';
const DEPTH_NORMALIZATION_DENOMINATOR = 16777214;
const CPU_PROGRESS_REPORT_INTERVAL_MS = 5000;

/**
 * @param {{
 *   readonly renderer: THREE.WebGLRenderer,
 *   readonly scene: THREE.Scene,
 *   readonly camera: THREE.Camera,
 *   readonly width: number,
 *   readonly height: number,
 *   readonly fragmentShaderSource: string,
 *   readonly backend: 'gpu' | 'cpu',
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly progressCallback?: BrowserAlgorithm32ProgressCallback | null,
 *   readonly captureSceneColorBytes?: boolean
 * }} request - Browser composer render request.
 * @returns {BrowserAlgorithm32ComposerResult} Composer output diagnostics.
 */
export function renderAlgorithm32ComposerScene(request) {
    const width = positiveInteger(request.width, 'width');
    const height = positiveInteger(request.height, 'height');
    const backend = request.backend === 'cpu' ? 'cpu' : 'gpu';
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true,
        stencilBuffer: false,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });
    renderTarget.texture.name = 'Algorithm32Composer.rgba8';

    request.renderer.setSize(width, height, false);
    request.renderer.setPixelRatio(1);
    request.renderer.setRenderTarget(null);
    request.renderer.autoClear = true;

    const composer = new EffectComposer(request.renderer, renderTarget);
    composer.setSize(width, height);
    composer.setPixelRatio(1);
    composer.addPass(new RenderPass(request.scene, request.camera));

    const shaderPass = backend === 'cpu'
        ? new Algorithm32CpuComposerPass(request.runtimeInput, {
            progressCallback: request.progressCallback,
        })
        : new Algorithm32GpuComposerPass({
            fragmentShaderSource: request.fragmentShaderSource,
            runtimeInput: request.runtimeInput,
            captureSceneColorBytes: request.captureSceneColorBytes !== false,
        });
    composer.addPass(shaderPass);
    composer.render(0);

    const sceneColorBytes = shaderPass.sceneColorBytes
        ? Uint8Array.from(shaderPass.sceneColorBytes)
        : null;
    const diagnostics = shaderPass.diagnostics();

    composer.dispose();

    return Object.freeze({
        kind: 'algorithm32-browser-composer-result',
        status: 'accepted',
        backend,
        sceneColorBytes,
        diagnostics,
    });
}

/**
 * @param {{
 *   readonly renderer: THREE.WebGLRenderer,
 *   readonly scene: THREE.Scene,
 *   readonly camera: THREE.Camera,
 *   readonly width: number,
 *   readonly height: number,
 *   readonly fragmentShaderSource: string,
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly runCount?: number,
 *   readonly warmupRunCount?: number,
 *   readonly yieldEvery?: number,
 *   readonly yieldMs?: number,
 *   readonly forceGpuFinish?: boolean,
 *   readonly progressCallback?: BrowserAlgorithm32ProgressCallback | null
 * }} request - Browser composer performance benchmark request.
 * @returns {Promise<BrowserAlgorithm32ComposerBenchmarkResult>} Timed benchmark result.
 */
export async function benchmarkAlgorithm32ComposerScene(request) {
    const width = positiveInteger(request.width, 'width');
    const height = positiveInteger(request.height, 'height');
    const runCount = positiveInteger(request.runCount ?? 100, 'runCount');
    const warmupRunCount = Math.max(0, Math.floor(request.warmupRunCount ?? 5));
    const yieldEvery = Math.max(1, Math.floor(request.yieldEvery ?? 5));
    const yieldMs = Math.max(0, Number.isFinite(request.yieldMs) ? request.yieldMs : 10);
    const forceGpuFinish = request.forceGpuFinish !== false;
    const progressCallback = typeof request.progressCallback === 'function'
        ? request.progressCallback
        : null;
    const setupStartedAt = performance.now();
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
        depthBuffer: true,
        stencilBuffer: false,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
    });
    renderTarget.texture.name = 'Algorithm32Composer.benchmark.rgba8';

    request.renderer.setSize(width, height, false);
    request.renderer.setPixelRatio(1);
    request.renderer.setRenderTarget(null);
    request.renderer.autoClear = true;

    const composer = new EffectComposer(request.renderer, renderTarget);
    composer.setSize(width, height);
    composer.setPixelRatio(1);
    composer.addPass(new RenderPass(request.scene, request.camera));

    const shaderPass = new Algorithm32GpuComposerPass({
        fragmentShaderSource: request.fragmentShaderSource,
        runtimeInput: request.runtimeInput,
        captureSceneColorBytes: false,
    });
    composer.addPass(shaderPass);
    const setupDurationMs = performance.now() - setupStartedAt;

    reportBenchmarkProgress(progressCallback, {
        phase: 'started',
        completedRuns: 0,
        runCount,
        warmupRunCount,
        elapsedMs: 0,
    });

    const benchmarkStartedAt = performance.now();
    const gl = request.renderer.getContext();
    const warmupDurationsMs = [];

    for (let warmupIndex = 0; warmupIndex < warmupRunCount; warmupIndex += 1) {
        const warmupStartedAt = performance.now();
        composer.render(0);
        finishGpu(gl, forceGpuFinish);
        warmupDurationsMs.push(performance.now() - warmupStartedAt);
        if ((warmupIndex + 1) % yieldEvery === 0) {
            await delay(yieldMs);
        }
    }

    const runDurationsMs = [];
    const measuredLoopStartedAt = performance.now();
    for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
        const startedAt = performance.now();
        composer.render(0);
        finishGpu(gl, forceGpuFinish);
        runDurationsMs.push(performance.now() - startedAt);

        const completedRuns = runIndex + 1;
        if (completedRuns === 1 || completedRuns === runCount || completedRuns % yieldEvery === 0) {
            reportBenchmarkProgress(progressCallback, {
                phase: completedRuns === runCount ? 'completed' : 'run-complete',
                completedRuns,
                runCount,
                warmupRunCount,
                elapsedMs: performance.now() - benchmarkStartedAt,
            });
            await delay(yieldMs);
        }
    }
    const measuredLoopElapsedMs = performance.now() - measuredLoopStartedAt;

    const diagnostics = shaderPass.diagnostics();

    composer.dispose();

    return Object.freeze({
        kind: 'algorithm32-browser-composer-performance-benchmark',
        status: 'accepted',
        backend: 'gpu',
        clock: 'performance.now',
        forceGpuFinish,
        yieldEvery,
        yieldMs,
        warmupRunCount,
        runCount,
        setupDurationMs,
        warmupSummary: summarizeDurations(warmupDurationsMs),
        measuredLoopElapsedMs,
        totalElapsedMs: performance.now() - benchmarkStartedAt,
        summary: summarizeDurations(runDurationsMs),
        warmupDurationsMs: Object.freeze(warmupDurationsMs),
        runDurationsMs: Object.freeze(runDurationsMs),
        diagnostics,
    });
}

class Algorithm32GpuComposerPass extends Pass {
    /**
 * @param {{
 *   readonly fragmentShaderSource: string,
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly captureSceneColorBytes?: boolean
 * }} configuration - GPU pass configuration.
 */
    constructor(configuration) {
        super();
        this.needsSwap = false;
        this._runtimeInput = normalizeRuntimeInput(configuration.runtimeInput);
        this._captureSceneColorBytes = configuration.captureSceneColorBytes !== false;
        this._sceneColorBytes = null;
        this._textures = createRuntimeTextures(this._runtimeInput);
        this._uniforms = createRuntimeUniforms(this._runtimeInput, this._textures);
        this._material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: stripGlslVersion(fullScreenVertexShader()),
            fragmentShader: stripGlslVersion(configuration.fragmentShaderSource),
            uniforms: this._uniforms,
            depthTest: false,
            depthWrite: false,
        });
        this._fsQuad = new FullScreenQuad(this._material);
    }

    get sceneColorBytes() {
        return this._sceneColorBytes;
    }

    /**
     * @param {THREE.WebGLRenderer} renderer - Active renderer.
     * @param {THREE.WebGLRenderTarget} writeBuffer - Composer write buffer.
     * @param {THREE.WebGLRenderTarget} readBuffer - Composer read buffer.
     * @returns {void}
     */
    render(renderer, writeBuffer, readBuffer) {
        this._uniforms.uSceneColorTexture.value = readBuffer.texture;
        this._sceneColorBytes = this._captureSceneColorBytes
            ? readRenderTargetRgbaBytes(renderer, readBuffer, this._runtimeInput.width, this._runtimeInput.height)
            : null;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        if (this.clear) {
            renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
        }
        this._fsQuad.render(renderer);
    }

    dispose() {
        this._fsQuad.dispose();
        this._material.dispose();
        disposeRuntimeTextures(this._textures);
    }

    diagnostics() {
        return Object.freeze({
            kind: 'algorithm32-gpu-composer-pass',
            backend: 'gpu',
            status: 'accepted',
            inputContract: runtimeInputSummary(this._runtimeInput),
            sceneColorReadbackCaptured: this._sceneColorBytes instanceof Uint8Array,
            captureSceneColorBytes: this._captureSceneColorBytes,
        });
    }
}

class Algorithm32CpuComposerPass extends Pass {
    /**
     * @param {BrowserAlgorithm32RuntimeInput} runtimeInput - Shared shader runtime inputs.
     * @param {{ readonly progressCallback?: BrowserAlgorithm32ProgressCallback | null }} [options] - CPU progress options.
     */
    constructor(runtimeInput, options = {}) {
        super();
        this.needsSwap = false;
        this._runtimeInput = normalizeRuntimeInput(runtimeInput);
        this._progressCallback = typeof options.progressCallback === 'function'
            ? options.progressCallback
            : null;
        this._sceneColorBytes = null;
        this._outputBytes = new Uint8Array(this._runtimeInput.width * this._runtimeInput.height * 4);
        this._outputTexture = createRgbaDataTexture({
            width: this._runtimeInput.width,
            height: this._runtimeInput.height,
            bytes: this._outputBytes,
        });
        this._displayAdapter = new BrunetonColorDisplayModel();
        this._softShader = new CpuPostprocessSoftShader({
            evaluator: createDistantSphericalEvaluatorFromRuntimeInput(this._runtimeInput),
            displayAdapter: this._displayAdapter,
        });
        this._uniforms = {
            uCpuOutputTexture: { value: this._outputTexture },
        };
        this._material = new THREE.ShaderMaterial({
            glslVersion: THREE.GLSL3,
            vertexShader: stripGlslVersion(fullScreenVertexShader()),
            fragmentShader: stripGlslVersion(textureCopyFragmentShader()),
            uniforms: this._uniforms,
            depthTest: false,
            depthWrite: false,
        });
        this._fsQuad = new FullScreenQuad(this._material);
        this._diagnostics = null;
    }

    get sceneColorBytes() {
        return this._sceneColorBytes;
    }

    /**
     * @param {THREE.WebGLRenderer} renderer - Active renderer.
     * @param {THREE.WebGLRenderTarget} writeBuffer - Composer write buffer.
     * @param {THREE.WebGLRenderTarget} readBuffer - Composer read buffer.
     * @returns {void}
     */
    render(renderer, writeBuffer, readBuffer) {
        this._sceneColorBytes = readRenderTargetRgbaBytes(renderer, readBuffer, this._runtimeInput.width, this._runtimeInput.height);
        this._diagnostics = renderCpuSoftShaderBytes({
            runtimeInput: this._runtimeInput,
            sceneColorBytes: this._sceneColorBytes,
            softShader: this._softShader,
            outputBytes: this._outputBytes,
            progressCallback: this._progressCallback,
        });
        this._outputTexture.needsUpdate = true;
        renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
        if (this.clear) {
            renderer.clear(renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil);
        }
        this._fsQuad.render(renderer);
    }

    dispose() {
        this._fsQuad.dispose();
        this._material.dispose();
        this._outputTexture.dispose();
    }

    diagnostics() {
        return Object.freeze({
            kind: 'algorithm32-cpu-composer-pass',
            backend: 'cpu',
            status: 'accepted',
            inputContract: runtimeInputSummary(this._runtimeInput),
            evaluatorKind: 'SpectralReferenceEvaluator.evaluate',
            aggregateDiagnostics: this._diagnostics?.aggregateDiagnostics ?? null,
            selectedPixels: this._diagnostics?.selectedPixels ?? Object.freeze([]),
            incidentRadianceCache: this._diagnostics?.incidentRadianceCache ?? null,
            sceneColorReadbackCaptured: this._sceneColorBytes instanceof Uint8Array,
        });
    }
}

/**
 * @param {{
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly sceneColorBytes: Uint8Array,
 *   readonly softShader: CpuPostprocessSoftShader,
 *   readonly outputBytes: Uint8Array,
 *   readonly progressCallback?: BrowserAlgorithm32ProgressCallback | null
 * }} request - CPU render request.
 * @returns {BrowserAlgorithm32CpuPassDiagnostics} CPU pass diagnostics.
 */
function renderCpuSoftShaderBytes({ runtimeInput, sceneColorBytes, softShader, outputBytes, progressCallback = null }) {
    const aggregateDiagnostics = {
        selectedPixelCount: 0,
        validPixelCount: 0,
        invalidPixelCount: 0,
        hitPixelCount: 0,
        noHitPixelCount: 0,
        warningCount: 0,
        errorCount: 0,
    };
    const selectedPixels = [];
    const selectedByCoordinate = new Map(runtimeInput.selectedPixels.map((pixel) => [
        `${pixel.x},${pixel.y}`,
        pixel,
    ]));
    const progressIntervalRows = Math.max(1, Math.floor(runtimeInput.height / 12));
    const startedAt = performance.now();
    let lastProgressReportAt = startedAt;

    reportCpuProgress(progressCallback, {
        phase: 'started',
        completedRows: 0,
        totalRows: runtimeInput.height,
        viewportPixels: [runtimeInput.width, runtimeInput.height],
        elapsedMs: 0,
    });

    for (let y = 0; y < runtimeInput.height; y += 1) {
        const rowPixels = [];
        for (let x = 0; x < runtimeInput.width; x += 1) {
            rowPixels.push(pixelInputFromRuntime({
                runtimeInput,
                sceneColorBytes,
                x,
                y,
            }));
        }
        const rowOutput = softShader.render({
            sceneInput: softShaderSceneInputDescriptor(runtimeInput),
            pixels: rowPixels,
        });
        addAggregateDiagnostics(aggregateDiagnostics, rowOutput.aggregateDiagnostics);

        for (const pixel of rowOutput.pixels) {
            const offset = (pixel.coordinate.y * runtimeInput.width + pixel.coordinate.x) * 4;
            const rgba = displayRgbaToByteRgba(pixel.displayRgba);
            outputBytes[offset] = rgba[0];
            outputBytes[offset + 1] = rgba[1];
            outputBytes[offset + 2] = rgba[2];
            outputBytes[offset + 3] = rgba[3];

            const selected = selectedByCoordinate.get(`${pixel.coordinate.x},${pixel.coordinate.y}`);
            if (selected) {
                selectedPixels.push(Object.freeze({
                    pixelId: selected.pixelId,
                    x: pixel.coordinate.x,
                    y: pixel.coordinate.y,
                    readbackRgba: rgba,
                    sceneIntersectionKind: pixel.sceneIntersectionKind,
                    endpointPolicy: pixel.endpointPolicy,
                    displayRgba: pixel.displayRgba,
                    transmittanceMean: average(pixel.evaluationOutput.pathRadiance.transmittance),
                    pathRadianceMean: average(pixel.evaluationOutput.pathRadiance.inScattered),
                }));
            }
        }

        const completedRows = y + 1;
        const now = performance.now();
        if (
            completedRows === 1
            || completedRows === runtimeInput.height
            || completedRows % progressIntervalRows === 0
            || now - lastProgressReportAt >= CPU_PROGRESS_REPORT_INTERVAL_MS
        ) {
            lastProgressReportAt = now;
            reportCpuProgress(progressCallback, {
                phase: completedRows === runtimeInput.height ? 'completed' : 'row-complete',
                completedRows,
                totalRows: runtimeInput.height,
                viewportPixels: [runtimeInput.width, runtimeInput.height],
                hitPixelCount: aggregateDiagnostics.hitPixelCount,
                noHitPixelCount: aggregateDiagnostics.noHitPixelCount,
                elapsedMs: now - startedAt,
            });
        }
    }

    return Object.freeze({
        aggregateDiagnostics: Object.freeze({ ...aggregateDiagnostics }),
        selectedPixels: Object.freeze(selectedPixels),
        incidentRadianceCache: Object.freeze({
            mode: 'packed-gpu-cache-payload-sampler',
            textureId: runtimeInput.incidentRadianceTexture.textureId ?? null,
            width: runtimeInput.incidentRadianceTexture.width,
            height: runtimeInput.incidentRadianceTexture.height,
            depth: runtimeInput.incidentRadianceTexture.depth,
            spectralChannelCount: runtimeInput.incidentRadianceTexture.spectralChannelCount,
        }),
    });
}

function reportCpuProgress(progressCallback, progress) {
    if (typeof progressCallback !== 'function') {
        return;
    }

    progressCallback(Object.freeze({
        kind: 'algorithm32-cpu-composer-progress',
        ...progress,
        percent: progress.totalRows > 0
            ? Math.round((progress.completedRows / progress.totalRows) * 100)
            : 0,
    }));
}

function reportBenchmarkProgress(progressCallback, progress) {
    if (typeof progressCallback !== 'function') {
        return;
    }

    progressCallback(Object.freeze({
        kind: 'algorithm32-gpu-composer-benchmark-progress',
        ...progress,
        percent: progress.runCount > 0
            ? Math.round((progress.completedRuns / progress.runCount) * 100)
            : 0,
    }));
}

/**
 * @param {{
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly sceneColorBytes: Uint8Array,
 *   readonly x: number,
 *   readonly y: number
 * }} request - Pixel decode request.
 * @returns {SoftShaderScenePixelInput} Soft shader pixel input.
 */
function pixelInputFromRuntime({ runtimeInput, sceneColorBytes, x, y }) {
    const offset = (y * runtimeInput.width + x) * 4;
    const hasSceneEndpoint = runtimeInput.sceneHitBytes[offset] > 127;
    const distanceMeters = unpackNormalizedDistance24(
        runtimeInput.sceneDepthBytes[offset],
        runtimeInput.sceneDepthBytes[offset + 1],
        runtimeInput.sceneDepthBytes[offset + 2],
    ) * runtimeInput.sceneDepthMaxMeters;

    return Object.freeze({
        pixelId: `pixel-${x}-${y}`,
        coordinate: Object.freeze({ x, y }),
        ray: reconstructViewRay({
            runtimeInput,
            x,
            y,
        }),
        sceneIntersection: hasSceneEndpoint
            ? Object.freeze({
                kind: 'hit',
                distanceMeters,
                metadata: Object.freeze({
                    route: 'composer-depth-hit-attachments',
                    distanceEncoding: runtimeInput.sceneDepthTextureEncoding,
                }),
            })
            : Object.freeze({ kind: 'no-hit' }),
        endpointContribution: hasSceneEndpoint
            ? Object.freeze({
                policy: CAPTURED_SCENE_ENDPOINT_POLICY,
                opacity: 'opaque',
                capturedSceneColorDisplayRgb: Object.freeze([
                    sceneColorBytes[offset] / 255,
                    sceneColorBytes[offset + 1] / 255,
                    sceneColorBytes[offset + 2] / 255,
                ]),
                metadata: Object.freeze({
                    captureSource: 'effect-composer-render-pass-read-buffer',
                    endpointCompositionSource: 'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy',
                }),
            })
            : null,
        pathIntervalCount: runtimeInput.pathIntervalCount,
        groundBoundaryMode: 'scene-hit-owned',
        metadata: Object.freeze({
            coordinateConvention: 'webgl-bottom-left',
            hasSceneEndpoint,
        }),
    });
}

/**
 * @param {BrowserAlgorithm32RuntimeInput} runtimeInput - Shared runtime input.
 * @returns {SpectralReferenceEvaluator} Browser CPU evaluator.
 */
function createDistantSphericalEvaluatorFromRuntimeInput(runtimeInput) {
    const cameraRadiusMeters = Math.hypot(
        runtimeInput.cameraWorldPositionMeters[0],
        runtimeInput.cameraWorldPositionMeters[1],
        runtimeInput.cameraWorldPositionMeters[2],
    );
    const observerHeightMeters = Math.max(
        0,
        cameraRadiusMeters - CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
    );
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters,
        observerUpDirection: runtimeInput.geometryFrame.up,
        sourceDirection: runtimeInput.distantSunDirection,
        cacheAltitudeBinCount: RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
        cacheBoundaryAltitudeMeters: 2,
        sourceTransmittanceIntervalCount: RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new DistantSunLightSource({
        directionToLight: runtimeInput.distantSunDirection,
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

    return new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: RUNTIME_NUMERICAL_CONTROLS,
        incidentRadianceSampling: incidentRadianceSamplingFromPackedTexture(runtimeInput),
    });
}

/**
 * @param {BrowserAlgorithm32RuntimeInput} runtimeInput - Shared runtime input.
 * @returns {IncidentRadianceSampling} Incident sampler backed by the GPU texture payload.
 */
function incidentRadianceSamplingFromPackedTexture(runtimeInput) {
    const texture = runtimeInput.incidentRadianceTexture;
    const values = texture.rgbaFloat32;
    const directionCount = texture.width;
    const altitudeBinCount = texture.height;
    const spectralChannelCount = texture.spectralChannelCount;
    const directionWeight = runtimeInput.incidentRadianceCache?.lookup?.directionWeight
        ?? (4 * Math.PI) / directionCount;

    return Object.freeze({
        cacheDescriptor: runtimeInput.incidentRadianceCache?.descriptor
            ?? Object.freeze({ cacheKind: 'packed-gpu-cache-payload' }),
        incidentRadianceSampler(cacheAccess) {
            const altitudeBinIndex = cacheAccess?.coordinates?.[0];
            if (!Number.isInteger(altitudeBinIndex) || altitudeBinIndex < 0 || altitudeBinIndex >= altitudeBinCount) {
                throw new TypeError('Packed incident radiance cache access requires a valid altitude bin.');
            }

            const samples = [];
            for (let directionIndex = 0; directionIndex < directionCount; directionIndex += 1) {
                const radiance = [];
                for (let channelIndex = 0; channelIndex < spectralChannelCount; channelIndex += 1) {
                    const spectralGroupIndex = Math.floor(channelIndex / 4);
                    const componentIndex = channelIndex % 4;
                    const offset = ((((spectralGroupIndex * altitudeBinCount) + altitudeBinIndex) * directionCount)
                        + directionIndex) * 4 + componentIndex;
                    radiance.push(values[offset]);
                }

                samples.push(Object.freeze({
                    incomingDirection: sunOrientedFibonacciSphereDirection(
                        directionIndex,
                        directionCount,
                        runtimeInput.distantSunDirection,
                    ),
                    radiance: Object.freeze(radiance),
                    weight: directionWeight,
                }));
            }

            return Object.freeze(samples);
        },
    });
}

/**
 * @param {BrowserAlgorithm32RuntimeInput} runtimeInput - Shared runtime input.
 * @returns {SoftShaderSceneInputDescriptor} Soft shader scene input descriptor.
 */
function softShaderSceneInputDescriptor(runtimeInput) {
    return Object.freeze({
        sceneId: runtimeInput.sceneId,
        sourceKind: 'three-capture',
        sourceDescriptorId: 'browser-effect-composer-render-pass',
        geometryDescriptorId: 'shader-descriptor-spherical-earth',
        atmosphereDescriptorId: 'canonical-atmosphere',
        lightSourceDescriptorId: 'distant-sun',
        cacheDescriptorId: runtimeInput.incidentRadianceCache?.descriptor?.sourceKey ?? 'packed-gpu-cache-payload',
        displayDescriptorId: 'bruneton-color-display',
        viewportPixels: Object.freeze([runtimeInput.width, runtimeInput.height]),
        metadata: Object.freeze({
            inputContract: 'algorithm32-browser-composer-runtime-input-v1',
            coordinateConvention: 'webgl-bottom-left',
        }),
    });
}

/**
 * @param {{
 *   readonly runtimeInput: BrowserAlgorithm32RuntimeInput,
 *   readonly x: number,
 *   readonly y: number
 * }} request - Ray reconstruction request.
 * @returns {Ray} Model-space view ray.
 */
function reconstructViewRay({ runtimeInput, x, y }) {
    const uv = [
        (x + 0.5) / runtimeInput.width,
        (y + 0.5) / runtimeInput.height,
    ];
    const clip = [uv[0] * 2 - 1, uv[1] * 2 - 1, 1, 1];
    const view = multiplyMatrix4Vector4(runtimeInput.inverseProjectionMatrix, clip);
    const viewW = Math.max(view[3], 0.000001);
    const viewDirection = normalize([view[0] / viewW, view[1] / viewW, view[2] / viewW]);
    const scene = multiplyMatrix4Vector4(runtimeInput.inverseViewMatrix, [
        viewDirection[0],
        viewDirection[1],
        viewDirection[2],
        0,
    ]);
    const sceneDirection = normalize([scene[0], scene[1], scene[2]]);
    const frame = runtimeInput.geometryFrame;
    const modelDirection = normalize([
        frame.right[0] * sceneDirection[0] + frame.up[0] * sceneDirection[1] + frame.forward[0] * sceneDirection[2],
        frame.right[1] * sceneDirection[0] + frame.up[1] * sceneDirection[1] + frame.forward[1] * sceneDirection[2],
        frame.right[2] * sceneDirection[0] + frame.up[2] * sceneDirection[1] + frame.forward[2] * sceneDirection[2],
    ]);

    return Object.freeze({
        origin: runtimeInput.cameraWorldPositionMeters,
        direction: modelDirection,
    });
}

/**
 * @param {BrowserAlgorithm32RuntimeInput} runtimeInput - Raw runtime input.
 * @returns {BrowserAlgorithm32RuntimeInput} Normalized runtime input.
 */
function normalizeRuntimeInput(runtimeInput) {
    const width = positiveInteger(runtimeInput?.width, 'runtimeInput.width');
    const height = positiveInteger(runtimeInput?.height, 'runtimeInput.height');
    const expectedByteLength = width * height * 4;
    const sceneDepthBytes = uint8Bytes(runtimeInput.sceneDepthBytes, expectedByteLength, 'sceneDepthBytes');
    const sceneHitBytes = uint8Bytes(runtimeInput.sceneHitBytes, expectedByteLength, 'sceneHitBytes');
    const incidentRadianceTexture = normalizeIncidentRadianceTexture(runtimeInput.incidentRadianceTexture);

    return Object.freeze({
        sceneId: typeof runtimeInput.sceneId === 'string' && runtimeInput.sceneId
            ? runtimeInput.sceneId
            : 'browser-composer-scene',
        width,
        height,
        sceneDepthBytes,
        sceneHitBytes,
        sceneDepthTextureEncoding: runtimeInput.sceneDepthTextureEncoding
            ?? 'rgb24-normalized-distance-times-sceneDepthMaxMeters; sceneHitTexture carries hit mask',
        sceneDepthMaxMeters: finiteNumber(runtimeInput.sceneDepthMaxMeters, 'sceneDepthMaxMeters'),
        sceneTerminationMeters: Number.isFinite(runtimeInput.sceneTerminationMeters)
            ? runtimeInput.sceneTerminationMeters
            : 0,
        endpointRadianceScale: Number.isFinite(runtimeInput.endpointRadianceScale)
            ? runtimeInput.endpointRadianceScale
            : 1,
        cameraWorldPositionMeters: vector3(runtimeInput.cameraWorldPositionMeters, 'cameraWorldPositionMeters'),
        distantSunDirection: normalize(vector3(runtimeInput.distantSunDirection, 'distantSunDirection')),
        inverseProjectionMatrix: matrix4(runtimeInput.inverseProjectionMatrix, 'inverseProjectionMatrix'),
        inverseViewMatrix: matrix4(runtimeInput.inverseViewMatrix, 'inverseViewMatrix'),
        incidentRadianceTexture,
        incidentRadianceCache: runtimeInput.incidentRadianceCache ?? null,
        geometryFrame: normalizeGeometryFrame(runtimeInput.geometryFrame),
        selectedPixels: Object.freeze(Array.isArray(runtimeInput.selectedPixels)
            ? runtimeInput.selectedPixels.map(normalizeSelectedPixel)
            : []),
        pathIntervalCount: Number.isInteger(runtimeInput.pathIntervalCount) && runtimeInput.pathIntervalCount > 0
            ? runtimeInput.pathIntervalCount
            : RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount,
    });
}

function createRuntimeUniforms(runtimeInput, textures) {
    return {
        uViewportPixels: { value: new THREE.Vector2(runtimeInput.width, runtimeInput.height) },
        uSceneTerminationMeters: { value: runtimeInput.sceneTerminationMeters },
        uSceneDepthMaxMeters: { value: runtimeInput.sceneDepthMaxMeters },
        uEndpointRadianceScale: { value: runtimeInput.endpointRadianceScale },
        uCameraWorldPositionMeters: { value: vectorToThree(runtimeInput.cameraWorldPositionMeters) },
        uDistantSunDirection: { value: vectorToThree(runtimeInput.distantSunDirection) },
        uInverseProjectionMatrix: { value: matrixToThree(runtimeInput.inverseProjectionMatrix) },
        uInverseViewMatrix: { value: matrixToThree(runtimeInput.inverseViewMatrix) },
        uSceneColorTexture: { value: null },
        uSceneDepthTexture: { value: textures.sceneDepthTexture },
        uSceneHitTexture: { value: textures.sceneHitTexture },
        uIncidentRadianceCacheTexture: { value: textures.incidentRadianceTexture },
    };
}

function createRuntimeTextures(runtimeInput) {
    return Object.freeze({
        sceneDepthTexture: createRgbaDataTexture({
            width: runtimeInput.width,
            height: runtimeInput.height,
            bytes: runtimeInput.sceneDepthBytes,
        }),
        sceneHitTexture: createRgbaDataTexture({
            width: runtimeInput.width,
            height: runtimeInput.height,
            bytes: runtimeInput.sceneHitBytes,
        }),
        incidentRadianceTexture: createIncidentRadianceDataTexture(runtimeInput.incidentRadianceTexture),
    });
}

function createRgbaDataTexture({ width, height, bytes }) {
    const texture = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
}

function createIncidentRadianceDataTexture(texturePayload) {
    const texture = new THREE.Data3DTexture(
        new Float32Array(texturePayload.rgbaFloat32),
        texturePayload.width,
        texturePayload.height,
        texturePayload.depth,
    );
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.FloatType;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
}

function disposeRuntimeTextures(textures) {
    textures.sceneDepthTexture.dispose();
    textures.sceneHitTexture.dispose();
    textures.incidentRadianceTexture.dispose();
}

function readRenderTargetRgbaBytes(renderer, renderTarget, width, height) {
    const bytes = new Uint8Array(width * height * 4);
    renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, bytes);
    return bytes;
}

function runtimeInputSummary(runtimeInput) {
    return Object.freeze({
        kind: 'algorithm32-browser-composer-runtime-input-v1',
        sceneId: runtimeInput.sceneId,
        viewportPixels: Object.freeze([runtimeInput.width, runtimeInput.height]),
        sceneDepthEncoding: runtimeInput.sceneDepthTextureEncoding,
        sceneDepthMaxMeters: runtimeInput.sceneDepthMaxMeters,
        sceneHitMaskEncoding: 'r8-explicit-hit-mask-in-rgba8-red-channel',
        cameraWorldPositionMeters: runtimeInput.cameraWorldPositionMeters,
        distantSunDirection: runtimeInput.distantSunDirection,
        incidentRadianceTexture: Object.freeze({
            kind: runtimeInput.incidentRadianceTexture.kind,
            width: runtimeInput.incidentRadianceTexture.width,
            height: runtimeInput.incidentRadianceTexture.height,
            depth: runtimeInput.incidentRadianceTexture.depth,
            spectralChannelCount: runtimeInput.incidentRadianceTexture.spectralChannelCount,
            uploadValueCount: runtimeInput.incidentRadianceTexture.rgbaFloat32.length,
        }),
        selectedPixelCount: runtimeInput.selectedPixels.length,
    });
}

function fullScreenVertexShader() {
    return `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
}

function textureCopyFragmentShader() {
    return `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D uCpuOutputTexture;

in vec2 vUv;
out vec4 outColor;

void main() {
    outColor = texture(uCpuOutputTexture, vUv);
}
`;
}

function stripGlslVersion(source) {
    return source.replace(/^#version\s+300\s+es\s*/u, '');
}

function displayRgbaToByteRgba(displayRgba) {
    return Object.freeze(displayRgba.map((value) =>
        Math.max(0, Math.min(255, Math.round(value * 255)))));
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

function unpackNormalizedDistance24(redByte, greenByte, blueByte) {
    return ((redByte * 65536) + (greenByte * 256) + blueByte) / DEPTH_NORMALIZATION_DENOMINATOR;
}

function multiplyMatrix4Vector4(matrix, vector) {
    const x = vector[0];
    const y = vector[1];
    const z = vector[2];
    const w = vector[3];

    return Object.freeze([
        matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * w,
        matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * w,
        matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * w,
        matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15] * w,
    ]);
}

function matrixToThree(values) {
    const matrix = new THREE.Matrix4();
    matrix.fromArray(values);
    return matrix;
}

function vectorToThree(values) {
    return new THREE.Vector3(values[0], values[1], values[2]);
}

function normalizeGeometryFrame(frame) {
    const candidate = frame && typeof frame === 'object'
        ? frame
        : {
            up: [1, 0, 0],
            right: [0, 1, 0],
            forward: [0, 0, -1],
        };

    return Object.freeze({
        up: normalize(vector3(candidate.up, 'geometryFrame.up')),
        right: normalize(vector3(candidate.right, 'geometryFrame.right')),
        forward: normalize(vector3(candidate.forward, 'geometryFrame.forward')),
    });
}

function normalizeIncidentRadianceTexture(texture) {
    if (
        !texture
        || typeof texture !== 'object'
        || texture.kind !== 'rgba32f-3d-texture-v1'
        || !Number.isInteger(texture.width)
        || !Number.isInteger(texture.height)
        || !Number.isInteger(texture.depth)
        || texture.width <= 0
        || texture.height <= 0
        || texture.depth <= 0
        || !Array.isArray(texture.rgbaFloat32)
        || texture.rgbaFloat32.length !== texture.width * texture.height * texture.depth * 4
        || texture.rgbaFloat32.some((value) => !Number.isFinite(value))
        || !Number.isInteger(texture.spectralChannelCount)
        || texture.spectralChannelCount <= 0
    ) {
        throw new Error('Algorithm32 composer runtime requires a valid packed incidentRadianceTexture payload.');
    }

    return Object.freeze({
        ...texture,
        rgbaFloat32: Object.freeze([...texture.rgbaFloat32]),
    });
}

function normalizeSelectedPixel(selection, index) {
    return Object.freeze({
        pixelId: typeof selection.pixelId === 'string' ? selection.pixelId : `selected-${index}`,
        x: Math.max(0, Math.floor(selection.x)),
        y: Math.max(0, Math.floor(selection.y)),
    });
}

function uint8Bytes(value, expectedLength, fieldName) {
    const bytes = value instanceof Uint8Array
        ? value
        : Array.isArray(value)
            ? Uint8Array.from(value)
            : null;
    if (!(bytes instanceof Uint8Array) || bytes.length !== expectedLength) {
        throw new Error(`${fieldName} must contain ${expectedLength} RGBA8 bytes.`);
    }
    return bytes;
}

function matrix4(value, fieldName) {
    if (!Array.isArray(value) || value.length !== 16 || !value.every(Number.isFinite)) {
        throw new Error(`${fieldName} must be a finite 4x4 matrix array.`);
    }
    return Object.freeze([...value]);
}

function vector3(value, fieldName) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw new Error(`${fieldName} must be a finite 3-tuple.`);
    }
    return Object.freeze([...value]);
}

function finiteNumber(value, fieldName) {
    if (!Number.isFinite(value)) {
        throw new Error(`${fieldName} must be finite.`);
    }
    return value;
}

function positiveInteger(value, fieldName) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${fieldName} must be a positive integer.`);
    }
    return value;
}

function average(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function summarizeDurations(values) {
    if (!Array.isArray(values) || values.length === 0) {
        return Object.freeze({
            count: 0,
            minMs: 0,
            maxMs: 0,
            meanMs: 0,
            medianMs: 0,
            p95Ms: 0,
            standardDeviationMs: 0,
        });
    }

    const sorted = [...values].sort((left, right) => left - right);
    const mean = average(values);
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

    return Object.freeze({
        count: values.length,
        minMs: sorted[0],
        maxMs: sorted[sorted.length - 1],
        meanMs: mean,
        medianMs: percentile(sorted, 0.5),
        p95Ms: percentile(sorted, 0.95),
        standardDeviationMs: Math.sqrt(variance),
    });
}

function percentile(sortedValues, fraction) {
    if (sortedValues.length === 0) {
        return 0;
    }
    if (sortedValues.length === 1) {
        return sortedValues[0];
    }

    const position = (sortedValues.length - 1) * fraction;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const blend = position - lowerIndex;

    return sortedValues[lowerIndex] * (1 - blend) + sortedValues[upperIndex] * blend;
}

function finishGpu(gl, forceGpuFinish) {
    if (forceGpuFinish && gl && typeof gl.finish === 'function') {
        gl.finish();
    }
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
